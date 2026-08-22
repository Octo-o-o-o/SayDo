// DAO:tasks / tier1_runs(docs/09 §6.1/§9)。
// tier1_runs = Tier1 本地 invocation journal(崩溃重放基元;计划 0.3 / §12-7 Tier1 子集)。

import type { TaskCard, TaskStatus, TaskTrigger, Tier1RunState } from "@saydo/contracts";
import { canTransitionTask, canTransitionTier1Run, taskCardSchema } from "@saydo/contracts";
import type { Db } from "../db.js";

export function insertTask(db: Db, t: TaskCard, createdAt: string): void {
  taskCardSchema.parse(t);
  db.prepare(
    `INSERT INTO tasks(id, project_id, package_id, package_rev, package_digest, title, spec_markdown, route, status,
       cancel_reason, supersedes, adapter, native_session_id, cwd, budget_json, actual_cost_ref, parked_at, parked_deadline,
       created_at, updated_at)
     VALUES (@id, @projectId, @packageId, @packageRev, @packageDigest, @title, @specMarkdown, @route, @status,
       @cancelReason, @supersedes, @adapter, @nativeSessionId, @cwd, @budgetJson, @actualCostRef, @parkedAt, @parkedDeadline,
       @createdAt, @updatedAt)`
  ).run({
    id: t.id,
    projectId: t.projectId,
    packageId: t.packageRef.packageId,
    packageRev: t.packageRef.revision,
    packageDigest: t.packageRef.digest,
    title: t.title,
    specMarkdown: t.specMarkdown,
    route: t.route,
    status: t.status,
    cancelReason: t.cancelReason ?? null,
    supersedes: t.supersedes ?? null,
    adapter: t.adapter ?? null,
    nativeSessionId: t.nativeSessionId ?? null,
    cwd: t.cwd ?? null,
    budgetJson: JSON.stringify(t.budget),
    actualCostRef: t.actualCostRef ?? null,
    parkedAt: t.parkedAt ?? null,
    parkedDeadline: t.parkedDeadline ?? null,
    createdAt,
    updatedAt: t.updatedAt
  });
}

export function getTask(db: Db, id: string): TaskCard | null {
  const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return taskCardSchema.parse({
    id: row["id"],
    projectId: row["project_id"],
    packageRef: { packageId: row["package_id"], revision: row["package_rev"], digest: row["package_digest"] },
    title: row["title"],
    specMarkdown: row["spec_markdown"],
    route: row["route"],
    status: row["status"],
    ...(row["cancel_reason"] ? { cancelReason: row["cancel_reason"] } : {}),
    ...(row["supersedes"] ? { supersedes: row["supersedes"] } : {}),
    ...(row["adapter"] ? { adapter: row["adapter"] } : {}),
    ...(row["native_session_id"] ? { nativeSessionId: row["native_session_id"] } : {}),
    ...(row["cwd"] ? { cwd: row["cwd"] } : {}),
    budget: JSON.parse(row["budget_json"] as string),
    ...(row["actual_cost_ref"] ? { actualCostRef: row["actual_cost_ref"] } : {}),
    ...(row["parked_at"] ? { parkedAt: row["parked_at"] } : {}),
    ...(row["parked_deadline"] ? { parkedDeadline: row["parked_deadline"] } : {}),
    updatedAt: row["updated_at"]
  });
}

/** 停靠态(09 §6.1:blocked / ready_for_review 进入时落 parked 字段,72h 老化;paused 先经 30s 转 blocked) */
const PARKED_STATES: readonly TaskStatus[] = ["blocked", "ready_for_review"];

/**
 * 状态推进(09 §6.1 全量转换表校验;非法转换抛错、留审计由调用方)。
 * CAS(Codex 14 #2,接线批 2026-07-25):`WHERE status=from` 先提交者胜——停靠老化定时器(T)
 * 与用户动作(U)竞态时不得相互覆盖;changes=0 抛竞态错,调用方重读现状。
 * 停靠字段:进入停靠态落 parked_at/parked_deadline(缺省 72h,[params].park_aging_hours);离开清空。
 */
export function transitionTask(
  db: Db,
  id: string,
  to: TaskStatus,
  trigger: TaskTrigger,
  opts: { cancelReason?: "user_cancel" | "supersede" | "park_expired"; now: string; parkAgingHours?: number }
): void {
  const row = db.prepare("SELECT status FROM tasks WHERE id = ?").get(id) as { status: TaskStatus } | undefined;
  if (!row) throw new Error(`task not found: ${id}`);
  if (!canTransitionTask(row.status, to, trigger)) {
    throw new Error(`illegal task transition ${row.status} -> ${to} (trigger=${trigger})`);
  }
  const entersParked = PARKED_STATES.includes(to);
  const leavesParked = PARKED_STATES.includes(row.status) && !entersParked;
  const parkedClause = entersParked
    ? ", parked_at = @parkedAt, parked_deadline = @parkedDeadline"
    : leavesParked
      ? ", parked_at = NULL, parked_deadline = NULL"
      : "";
  const res = db
    .prepare(
      `UPDATE tasks SET status = @to, cancel_reason = COALESCE(@cancelReason, cancel_reason), updated_at = @now${parkedClause}
       WHERE id = @id AND status = @from`
    )
    .run({
      id,
      to,
      from: row.status,
      cancelReason: opts.cancelReason ?? null,
      now: opts.now,
      ...(entersParked
        ? {
            parkedAt: opts.now,
            parkedDeadline: new Date(Date.parse(opts.now) + (opts.parkAgingHours ?? 72) * 3_600_000).toISOString()
          }
        : {})
    });
  if (res.changes === 0) {
    throw new Error(`task transition race: ${id} left ${row.status} concurrently (CAS, 先提交者胜)`);
  }
}

export interface Tier1RunRow {
  id: string;
  taskId: string;
  attempt: number;
  adapter: "claude_code" | "cursor" | "codex";
  nativeSessionId?: string | undefined;
  cwd: string;
  worktreePath: string;
  treeSha?: string | undefined;
  eventCursor?: string | undefined;
  state: Tier1RunState;
  settleProofJson?: string | undefined;
  cancelProofJson?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export function insertTier1Run(db: Db, r: Tier1RunRow): void {
  db.prepare(
    `INSERT INTO tier1_runs(id, task_id, attempt, adapter, native_session_id, cwd, worktree_path, tree_sha, event_cursor,
       state, settle_proof_json, cancel_proof_json, created_at, updated_at)
     VALUES (@id, @taskId, @attempt, @adapter, @nativeSessionId, @cwd, @worktreePath, @treeSha, @eventCursor,
       @state, @settleProofJson, @cancelProofJson, @createdAt, @updatedAt)`
  ).run({
    ...r,
    nativeSessionId: r.nativeSessionId ?? null,
    treeSha: r.treeSha ?? null,
    eventCursor: r.eventCursor ?? null,
    settleProofJson: r.settleProofJson ?? null,
    cancelProofJson: r.cancelProofJson ?? null
  });
}

export function getTier1Run(db: Db, id: string): Tier1RunRow | null {
  const row = db.prepare("SELECT * FROM tier1_runs WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row["id"] as string,
    taskId: row["task_id"] as string,
    attempt: row["attempt"] as number,
    adapter: row["adapter"] as Tier1RunRow["adapter"],
    nativeSessionId: (row["native_session_id"] as string | null) ?? undefined,
    cwd: row["cwd"] as string,
    worktreePath: row["worktree_path"] as string,
    treeSha: (row["tree_sha"] as string | null) ?? undefined,
    eventCursor: (row["event_cursor"] as string | null) ?? undefined,
    state: row["state"] as Tier1RunState,
    settleProofJson: (row["settle_proof_json"] as string | null) ?? undefined,
    cancelProofJson: (row["cancel_proof_json"] as string | null) ?? undefined,
    createdAt: row["created_at"] as string,
    updatedAt: row["updated_at"] as string
  };
}

export function transitionTier1Run(
  db: Db,
  id: string,
  to: Tier1RunState,
  now: string,
  patch: { nativeSessionId?: string; treeSha?: string; eventCursor?: string; settleProofJson?: string; cancelProofJson?: string } = {}
): void {
  const row = db.prepare("SELECT state FROM tier1_runs WHERE id = ?").get(id) as { state: Tier1RunState } | undefined;
  if (!row) throw new Error(`tier1 run not found: ${id}`);
  if (!canTransitionTier1Run(row.state, to)) {
    throw new Error(`illegal tier1_run transition ${row.state} -> ${to}`);
  }
  // CAS(Codex 16 6.4:与 transitionTask 同律——并发 settle/fail 后写者不得覆盖先写者终态与 proof)
  const res = db
    .prepare(
      `UPDATE tier1_runs SET state = @to, updated_at = @now,
         native_session_id = COALESCE(@nativeSessionId, native_session_id),
         tree_sha = COALESCE(@treeSha, tree_sha),
         event_cursor = COALESCE(@eventCursor, event_cursor),
         settle_proof_json = COALESCE(@settleProofJson, settle_proof_json),
         cancel_proof_json = COALESCE(@cancelProofJson, cancel_proof_json)
       WHERE id = @id AND state = @from`
    )
    .run({
      id,
      to,
      now,
      from: row.state,
      nativeSessionId: patch.nativeSessionId ?? null,
      treeSha: patch.treeSha ?? null,
      eventCursor: patch.eventCursor ?? null,
      settleProofJson: patch.settleProofJson ?? null,
      cancelProofJson: patch.cancelProofJson ?? null
    });
  if (res.changes === 0) {
    throw new Error(`tier1_run transition race: ${id} left ${row.state} concurrently (CAS)`);
  }
}

/** 运行中采集原生会话 id(W1.4;§12-7 恢复钥匙落 tier1_runs 列,reconciler 按此判 resumable)。
 *  只写一次(IS NULL 守卫):同 run 重复 init(--resume 续跑段)不覆盖首采钥匙。 */
export function setTier1RunNativeSession(db: Db, id: string, nativeSessionId: string, now: string): void {
  db.prepare(
    "UPDATE tier1_runs SET native_session_id = @sid, updated_at = @now WHERE id = @id AND native_session_id IS NULL"
  ).run({ id, sid: nativeSessionId, now });
}

/** claude 首跑预生成 / reserved 恢复重生成:覆写钥匙并回到未确认。 */
export function overwriteTier1RunNativeSession(db: Db, id: string, nativeSessionId: string, now: string): void {
  db.prepare(
    "UPDATE tier1_runs SET native_session_id = @sid, native_session_confirmed = 0, updated_at = @now WHERE id = @id"
  ).run({ id, sid: nativeSessionId, now });
}

/** system/init.session_id 对上后置确认位。 */
export function confirmTier1RunNativeSession(db: Db, id: string, now: string): void {
  db.prepare(
    "UPDATE tier1_runs SET native_session_confirmed = 1, updated_at = @now WHERE id = @id AND native_session_id IS NOT NULL"
  ).run({ id, now });
}

/** 返工/retry:INSERT 新行 attempt+1(旧行终态不动、证据不串线,09 §9 attempt 规则) */
export function nextAttempt(db: Db, taskId: string): number {
  const row = db.prepare("SELECT MAX(attempt) AS a FROM tier1_runs WHERE task_id = ?").get(taskId) as { a: number | null };
  return (row.a ?? 0) + 1;
}
