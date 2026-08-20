// 义务依赖与唤醒矩阵(合同 §3.4,四审 A-1/A-2)。
// 设置=同语句写三值(status=waiting + waiting_on 文本 + waiting_on_obligation_id);
// resolve 单点同事务处理 waiting 依赖方:done→open 清两列+woken;终态拒→blocked 保留 provenance。
// 批 3 零主动通知:只写账本,不写 outbox。

import type { FocusObligationResolution } from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import { FocusWriteError, withFocusWriteTx, type FocusWriteOps, type FocusWriteTxOptions } from "./writeTx.js";

const TERMINAL_BLOCKING_RESOLUTIONS = new Set<string>([
  "abandoned",
  "no_longer_applicable",
  "superseded"
]);

/** 上溯依赖链环检测(≤16) */
export function assertNoDependencyCycle(
  db: Db,
  focusId: string,
  depId: string,
  preId: string
): void {
  if (depId === preId) {
    throw new FocusWriteError("dependency_cycle", "obligation cannot wait on itself");
  }
  let cur: string | null = preId;
  for (let depth = 0; depth < 16; depth++) {
    if (cur === depId) {
      throw new FocusWriteError("dependency_cycle", `dependency cycle involving ${depId}`);
    }
    const row = db
      .prepare(
        `SELECT waiting_on_obligation_id AS w FROM focus_obligations
         WHERE id = ? AND focus_id = ?`
      )
      .get(cur, focusId) as { w: string | null } | undefined;
    if (!row || !row.w) return;
    cur = row.w;
  }
  throw new FocusWriteError("dependency_cycle", "dependency chain depth exceeded 16");
}

export interface SetWaitingOnInput {
  obligationId: string;
  /** null=清除等待 */
  preId: string | null;
  actorKind?: "user" | "daemon" | "brain_proposal";
  sessionId?: string;
}

/**
 * REST/API 入口:设置或清除结构化依赖。
 * preId 非空:status=waiting + waiting_on=preTitle + waiting_on_obligation_id=preId + dependency_set 事件。
 * preId null:若当前 waiting 则回 open 并清两列。
 */
export function setObligationWaitingOn(
  db: Db,
  input: SetWaitingOnInput,
  opts: FocusWriteTxOptions = {}
): { ok: true; status: string } {
  return withFocusWriteTx(db, opts, (ops) => setWaitingOnOnOps(ops, input));
}

export function setWaitingOnOnOps(
  ops: FocusWriteOps,
  input: SetWaitingOnInput
): { ok: true; status: string } {
  const db = ops.db;
  const dep = db
    .prepare("SELECT * FROM focus_obligations WHERE id = ?")
    .get(input.obligationId) as
    | {
        id: string;
        focus_id: string;
        title: string;
        status: string;
        waiting_on: string | null;
        waiting_on_obligation_id: string | null;
      }
    | undefined;
  if (!dep) throw new FocusWriteError("not_found", `obligation ${input.obligationId} not found`);

  // 清除
  if (input.preId === null) {
    if (dep.status === "waiting" || dep.waiting_on_obligation_id) {
      db.prepare(
        `UPDATE focus_obligations
         SET status = CASE WHEN status IN ('waiting','blocked') THEN 'open' ELSE status END,
             waiting_on = NULL,
             waiting_on_obligation_id = NULL,
             updated_at = ?
         WHERE id = ?`
      ).run(ops.nowIso, dep.id);
      ops.touchUpdatedAt(dep.focus_id);
    }
    const after = db.prepare("SELECT status FROM focus_obligations WHERE id = ?").get(dep.id) as {
      status: string;
    };
    return { ok: true, status: after.status };
  }

  const pre = db
    .prepare("SELECT id, focus_id, title, status FROM focus_obligations WHERE id = ?")
    .get(input.preId) as
    | { id: string; focus_id: string; title: string; status: string }
    | undefined;
  if (!pre) throw new FocusWriteError("not_found", `prerequisite obligation ${input.preId} not found`);
  if (pre.focus_id !== dep.focus_id) {
    throw new FocusWriteError("dependency_cross_focus", "prerequisite must be same focus");
  }
  assertNoDependencyCycle(db, dep.focus_id, dep.id, pre.id);

  // 前置已终态:直接 blocked 而非 waiting
  const preTerminal = pre.status === "resolved" || pre.status === "superseded";
  if (preTerminal) {
    const preRes = db
      .prepare("SELECT resolution FROM focus_obligations WHERE id = ?")
      .get(pre.id) as { resolution: string | null };
    const resolution = (preRes.resolution ?? "abandoned") as FocusObligationResolution;
    db.prepare(
      `UPDATE focus_obligations
       SET status = 'blocked', waiting_on = ?, waiting_on_obligation_id = ?, updated_at = ?
       WHERE id = ?`
    ).run(pre.title, pre.id, ops.nowIso, dep.id);
    ops.appendEvent(dep.focus_id, {
      type: "dependency_blocked",
      payload: {
        depId: dep.id,
        depTitle: dep.title,
        preId: pre.id,
        preTitle: pre.title,
        preResolution: resolution
      },
      actorKind: input.actorKind ?? "user",
      sessionId: input.sessionId
    });
    return { ok: true, status: "blocked" };
  }

  db.prepare(
    `UPDATE focus_obligations
     SET status = 'waiting', waiting_on = ?, waiting_on_obligation_id = ?, updated_at = ?
     WHERE id = ?`
  ).run(pre.title, pre.id, ops.nowIso, dep.id);

  ops.appendEvent(dep.focus_id, {
    type: "dependency_set",
    payload: {
      depId: dep.id,
      depTitle: dep.title,
      preId: pre.id,
      preTitle: pre.title
    },
    actorKind: input.actorKind ?? "user",
    sessionId: input.sessionId
  });
  return { ok: true, status: "waiting" };
}

/**
 * resolve 单点同事务:处理 waiting 在本义务上的依赖方(合同 §3.4)。
 * WHERE status='waiting' AND waiting_on_obligation_id=:pre —— 幂等。
 * 零主动通知。
 */
export function wakeDependentsOnOps(
  ops: FocusWriteOps,
  pre: {
    id: string;
    focusId: string;
    title: string;
    resolution: FocusObligationResolution;
  }
): { woken: string[]; blocked: string[] } {
  const db = ops.db;
  const deps = db
    .prepare(
      `SELECT id, title, status, needs FROM focus_obligations
       WHERE focus_id = ? AND status = 'waiting' AND waiting_on_obligation_id = ?`
    )
    .all(pre.focusId, pre.id) as Array<{
    id: string;
    title: string;
    status: string;
    needs: string | null;
  }>;

  const woken: string[] = [];
  const blocked: string[] = [];

  for (const d of deps) {
    if (pre.resolution === "done") {
      // done → open + 清两列;不改 needs
      db.prepare(
        `UPDATE focus_obligations
         SET status = 'open', waiting_on = NULL, waiting_on_obligation_id = NULL, updated_at = ?
         WHERE id = ? AND status = 'waiting' AND waiting_on_obligation_id = ?`
      ).run(ops.nowIso, d.id, pre.id);
      ops.appendEvent(pre.focusId, {
        type: "dependency_woken",
        payload: {
          depId: d.id,
          depTitle: d.title,
          preId: pre.id,
          preTitle: pre.title
        },
        actorKind: "daemon"
      });
      woken.push(d.id);
    } else if (TERMINAL_BLOCKING_RESOLUTIONS.has(pre.resolution)) {
      // abandoned/no_longer_applicable/superseded → blocked;两列保留;不改 needs
      db.prepare(
        `UPDATE focus_obligations
         SET status = 'blocked', updated_at = ?
         WHERE id = ? AND status = 'waiting' AND waiting_on_obligation_id = ?`
      ).run(ops.nowIso, d.id, pre.id);
      ops.appendEvent(pre.focusId, {
        type: "dependency_blocked",
        payload: {
          depId: d.id,
          depTitle: d.title,
          preId: pre.id,
          preTitle: pre.title,
          preResolution: pre.resolution
        },
        actorKind: "daemon"
      });
      blocked.push(d.id);
    }
  }
  if (woken.length + blocked.length > 0) ops.touchUpdatedAt(pre.focusId);
  return { woken, blocked };
}
