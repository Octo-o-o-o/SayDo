// Tier1 运行时操作(计划 4.5;09 §13 工具承载 + §6.1 状态机):
// steerTask / cancelTask(取消全链)/ reviewTask(三态)/ requestManualMerge + MergeProof / retryTask。
// 全部经 task/tier1_run 状态机(canTransitionTask),非法转换拒;attempt 规则:返工/retry = 新 attempt。

import type { AdapterKind } from "./adapter.js";
import {
  canTransitionTask,
  jcsDigest,
  newId,
  textDigest,
  tier1SettleProofSchema,
  writingSettleProofSchema,
  writingSettleStructuralViolations,
  isWritingSettleProof,
  type AcceptanceCheck,
  type MergeProof,
  type Tier1CancelProof
} from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import { resolveActiveEntriesForTask } from "../storage/dao/outbox.js";
import { hopperSteerSupport } from "../bridge/capabilities.js";

/** retry message / 返工 comments 原文的 durable 落点(DDL v3;audit 只记 digest 是 E3 纪律,功能存储在此) */
function persistTaskMessage(
  db: Db,
  i: { taskId: string; attempt: number; kind: "retry" | "review_comments" | "steer"; body: string },
  nowIso: string
): void {
  db.prepare("INSERT INTO task_messages(id, task_id, attempt, kind, body, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    newId("cmd"),
    i.taskId,
    i.attempt,
    i.kind,
    i.body,
    nowIso
  );
}

/** 执行器认领新 attempt 时读取编译上下文(09 §13 message 语义的消费口) */
export function readTaskMessages(db: Db, taskId: string, attempt: number): { kind: string; body: string }[] {
  return db
    .prepare("SELECT kind, body FROM task_messages WHERE task_id=? AND attempt=? ORDER BY created_at")
    .all(taskId, attempt) as { kind: string; body: string }[];
}

/** 取消/返工冻结接线(Phase4 评审 A3;09 §6.3):活跃 outbox 条目 superseded,防幽灵升级 */
function freezeOutbox(db: Db, audit: AuditSink, taskId: string, nowIso: string, trigger?: string): void {
  const n = resolveActiveEntriesForTask(db, taskId, nowIso, trigger);
  if (n > 0) audit.record({ actor: "daemon", action: "callback.freeze", meta: { taskId, frozen: n, trigger } });
}

// ---------- steerTask(运行中注入)----------

// 契约不分叉(迟到评审 C 回收):SteerApplied 收编 contracts(此前本地重定义同名类型)
export type { SteerApplied } from "@saydo/contracts";
import type { SteerApplied } from "@saydo/contracts";

/**
 * steer 应答(09 §13 三态):claude_sdk 支持流中注入=live;cursor_cli 无 live steer ⇒
 * queued_delta(下个回合注入)或 cancel_resume(取消当前 + 带新指令 resume)。
 * W2 阶段0-③(Codex 20 B3 后半):steerApplied 与真实能力绑定——当前无任何后端实现流中注入
 * (claude_sdk 挂订阅解锁,HANDOFF §2-6;执行器仅 cursor),非运行中恒 queued_delta,不预先谎报
 * live;claude_sdk 接入并实测 live steer 后再放开(canonical 三后端能力表随该批回写)。
 * W5a 3.4:running ∧ 有活跃 run ⇒ cancel_resume(运行中改需求档;steerTask 内按上下文判)。
 */
export function steerApplied(adapter: AdapterKind): SteerApplied {
  void adapter;
  return "queued_delta";
}

/**
 * steerTask 生产实现(09 §13;W5a 3.4 增量):
 * - route=hopper ⇒ 按 capabilities steer 分级诚实应答(baseline.2 steer=none ⇒ 拒 + 替代话术;
 *   此前静默落 task_messages 是谎报面——桥不消费该表)。
 * - running ∧ 有活跃 run(running/step_paused)⇒ **cancel_resume**:终止当前 run(run 级
 *   cancel_requested,任务不动)→ worktree 保留(按 taskId 确定性路径,认领复用)→ 指令落
 *   task_messages(attempt=下次认领号)→ 认领循环捡起"running 无活跃 run"起新 attempt,
 *   新 spec 编译进下次 run(readTaskMessages 消费口)。
 * - 其余(queued/blocked/ready_for_review/停靠)⇒ queued_delta:指令排队,下次 run 认领时注入。
 *   诚实语义:若本 run 直接 settle 且验收通过,queued_delta 指令不会被消费——验收时用户提返工,
 *   指令随 comments 一起进新 attempt(audit 有账,不静默蒸发)。终态任务拒。
 */
export function steerTask(
  db: Db,
  audit: AuditSink,
  i: { taskId: string; instruction: string },
  nowIso: string,
  opts: { hopperSteerLevel?: () => "runtime" | "schema_only" | "none" } = {}
): { applied: SteerApplied } {
  const task = db.prepare("SELECT status, adapter, route FROM tasks WHERE id=?").get(i.taskId) as
    | { status: string; adapter: string | null; route: string }
    | undefined;
  if (!task) throw new Error(`task not found: ${i.taskId}`);
  const STEERABLE = ["queued", "running", "paused_step_boundary", "blocked", "ready_for_review"];
  if (!STEERABLE.includes(task.status)) {
    throw new Error(`steerTask requires active task, got ${task.status}(终态/合并链任务用别的工具)`);
  }
  if (i.instruction.trim() === "") throw new Error("steer instruction is empty");
  if (task.route === "hopper") {
    // W5a 3.4:Hopper steer 分级消费(capabilities 握手值;缺省 none = baseline.2 实测)
    const level = opts.hopperSteerLevel?.() ?? "none";
    const support = hopperSteerSupport(level);
    audit.record({
      actor: "daemon",
      action: "hopper.steer_capability_consulted",
      meta: { taskId: i.taskId, level, steerable: support.steerable }
    });
    // 能力未到:诚实拒绝(不落 task_messages——桥不消费,排队即谎报);能力到(runtime)= 锁定
    // 二进制升级已发生,桥消费面随升级批接线(出站 op 形状属 canonical §6.2,不在此杜撰)
    throw new Error(support.phrase);
  }
  const adapter = (task.adapter ?? "cursor") as AdapterKind;
  const activeRun = db
    .prepare("SELECT id FROM tier1_runs WHERE task_id=? AND state IN ('running','step_paused') LIMIT 1")
    .get(i.taskId) as { id: string } | undefined;
  let applied: SteerApplied;
  if (task.status === "running" && activeRun) {
    // cancel_resume:run 级取消(任务保持 running;执行器 reap 辨识"run cancel_requested ∧
    // task 非 cancel_requested"= steer_resume,杀进程 + run 级结算,worktree 留)
    applied = "cancel_resume";
    db.prepare("UPDATE tier1_runs SET state='cancel_requested', updated_at=? WHERE id=? AND state IN ('running','step_paused')").run(
      nowIso,
      activeRun.id
    );
  } else {
    applied = steerApplied(adapter);
  }
  const run = db.prepare("SELECT MAX(attempt) AS a FROM tier1_runs WHERE task_id=?").get(i.taskId) as { a: number | null };
  const nextAttemptNo = (run.a ?? 0) + 1;
  persistTaskMessage(db, { taskId: i.taskId, attempt: nextAttemptNo, kind: "steer", body: i.instruction }, nowIso);
  audit.record({
    actor: "owner",
    action: "task.steer",
    meta: { taskId: i.taskId, applied, forAttempt: nextAttemptNo, instructionDigest: textDigest(i.instruction) }
  });
  return { applied };
}

// ---------- cancelTask(取消全链)----------

export function isCancelProofComplete(p: Tier1CancelProof | undefined): p is Tier1CancelProof {
  return !!p && p.processExited === true && p.worktreeLockReleased === true && p.lastEventId !== "" && p.runId !== "";
}

export interface CancelResult {
  state: "cancel_requested" | "cancel_settled";
}

/** 请求取消:task -> cancel_requested(U);tier1_run -> cancel_requested */
export function requestCancel(db: Db, audit: AuditSink, taskId: string, nowIso: string): CancelResult {
  const row = db.prepare("SELECT status FROM tasks WHERE id=?").get(taskId) as { status: string } | undefined;
  if (!row) throw new Error(`task not found: ${taskId}`);
  if (!canTransitionTask(row.status as never, "cancel_requested", "U")) {
    throw new Error(`cannot cancel task in status ${row.status}`);
  }
  // CAS(评审 B7):status 变了就不写(changes=0 => 竞态,拒);离开停靠态清 parked 字段
  const upd = db
    .prepare(
      "UPDATE tasks SET status='cancel_requested', cancel_reason='user_cancel', updated_at=?, parked_at=NULL, parked_deadline=NULL WHERE id=? AND status=?"
    )
    .run(nowIso, taskId, row.status);
  if (upd.changes === 0) throw new Error(`cancel race: task status changed concurrently (${taskId})`);
  db.prepare("UPDATE tier1_runs SET state='cancel_requested', updated_at=? WHERE task_id=? AND state IN ('reserved','running','step_paused')").run(nowIso, taskId);
  freezeOutbox(db, audit, taskId, nowIso); // A3:取消冻结全部活跃条目(09 §6.3)
  audit.record({ actor: "daemon", action: "task.cancel_requested", meta: { taskId } });
  return { state: "cancel_requested" };
}

/**
 * 结算取消:Tier1CancelProof 齐备(进程退出 + worktree 锁释放 + lastEventId)才 cancel_settled。
 * 旧 run 晚到事件转历史、不触发当前回叫(晚到判定:eventId <= lastEventId ⇒ 历史)。
 */
export function settleCancel(db: Db, audit: AuditSink, proof: Tier1CancelProof, nowIso: string): CancelResult {
  if (!isCancelProofComplete(proof)) throw new Error("cancel proof incomplete (需进程退出+worktree 锁释放+lastEventId)");
  const row = db.prepare("SELECT status FROM tasks WHERE id=?").get(proof.taskId) as { status: string } | undefined;
  if (!row) throw new Error(`task not found: ${proof.taskId}`);
  if (row.status !== "cancel_requested") throw new Error(`settle requires cancel_requested, got ${row.status}`);
  // CAS + 幂等(评审 B7):重复 settle 不重复写/不重复审计
  const upd = db
    .prepare("UPDATE tasks SET status='cancel_settled', updated_at=? WHERE id=? AND status='cancel_requested'")
    .run(nowIso, proof.taskId);
  if (upd.changes === 0) return { state: "cancel_settled" }; // 已结算(幂等)
  db.prepare("UPDATE tier1_runs SET state='cancel_settled', cancel_proof_json=?, updated_at=? WHERE task_id=? AND state='cancel_requested'").run(
    JSON.stringify(proof),
    nowIso,
    proof.taskId
  );
  audit.record({ actor: "daemon", action: "task.cancel_settled", meta: { taskId: proof.taskId, lastEventId: proof.lastEventId } });
  return { state: "cancel_settled" };
}

/**
 * 无活跃 run 的即时结算(09 §6.1 括注,一致性评审 C4:confirmed/queued/ready_for_review 取消时
 * 该时点无活跃 run ⇒ 即时 settled,不需 Tier1CancelProof)。有活跃 run 行 ⇒ 拒(走 proof 链)。
 */
export function settleCancelNoActiveRun(db: Db, audit: AuditSink, taskId: string, nowIso: string): CancelResult {
  const row = db.prepare("SELECT status FROM tasks WHERE id=?").get(taskId) as { status: string } | undefined;
  if (!row) throw new Error(`task not found: ${taskId}`);
  if (row.status !== "cancel_requested") throw new Error(`settle requires cancel_requested, got ${row.status}`);
  const active = (
    db
      .prepare(
        "SELECT COUNT(*) AS c FROM tier1_runs WHERE task_id=? AND state IN ('reserved','running','step_paused','cancel_requested')"
      )
      .get(taskId) as { c: number }
  ).c;
  if (active > 0) throw new Error(`task ${taskId} has ${active} active run(s); settle requires Tier1CancelProof`);
  const upd = db
    .prepare("UPDATE tasks SET status='cancel_settled', updated_at=? WHERE id=? AND status='cancel_requested'")
    .run(nowIso, taskId);
  if (upd.changes === 0) return { state: "cancel_settled" }; // 已结算(幂等)
  audit.record({ actor: "daemon", action: "task.cancel_settled", meta: { taskId, noActiveRun: true } });
  return { state: "cancel_settled" };
}

/** cancelTask 全链(09 §13 工具面与 console 写口共用):请求取消 + 无活跃 run 即时结算(09 §6.1 括注) */
export function cancelWithAutoSettle(db: Db, audit: AuditSink, taskId: string, nowIso: string): CancelResult {
  const r = requestCancel(db, audit, taskId, nowIso);
  const active = (
    db
      .prepare(
        "SELECT COUNT(*) AS c FROM tier1_runs WHERE task_id=? AND state IN ('reserved','running','step_paused','cancel_requested')"
      )
      .get(taskId) as { c: number }
  ).c;
  if (active === 0) return settleCancelNoActiveRun(db, audit, taskId, nowIso);
  return r;
}

/**
 * 晚到事件判定(取消后旧 run 事件):incoming <= cancelProof.lastEventId ⇒ 历史,不回叫。
 * 评审 B2:裸字典序对变长数字 id 误判("e-10" < "e-9")——数字感知比较:
 * 同前缀时按尾部数字大小比;解析不出数字对时退回"先长度后字典序"(等宽 ULID 与之等价)。
 */
export function isLateEventHistory(cancelLastEventId: string, incomingEventId: string): boolean {
  const split = (s: string): { prefix: string; num: number | null } => {
    const m = /^(.*?)(\d+)$/.exec(s);
    return m ? { prefix: m[1] as string, num: Number(m[2]) } : { prefix: s, num: null };
  };
  const a = split(incomingEventId);
  const b = split(cancelLastEventId);
  if (a.prefix === b.prefix && a.num !== null && b.num !== null) return a.num <= b.num;
  if (incomingEventId.length !== cancelLastEventId.length) {
    return incomingEventId.length < cancelLastEventId.length; // 长度序(变长数字 id 的时间序近似)
  }
  return incomingEventId <= cancelLastEventId; // 等宽(ULID)字典序=时间序
}

// ---------- reviewTask(三态)----------

export type ReviewVerdict = "approve" | "request_changes" | "reject";

export interface ReviewResult {
  // 字段名 state 照抄 09 §13 reviewTask 返回契约(Codex 14 #7 回修:旧字段名 status 与 canonical 不符);
  // reject 承载于取消链(§6.1 边表 ready_for_review 无 failed/rejected 边,唯一作废边=cancel_requested,
  // 话术 #34"停了,这轮作废"——09 §13 勘误已回写 2026-07-25)
  state: "review_approved_waiting_merge" | "running" | "cancel_requested";
  attempt?: number;
}

/**
 * 验收裁决(§6.1 返工/批准边;expectedAttempt 防串旧 attempt):
 * - approve → review_approved_waiting_merge(evidenceDigest **库内自取**——当前 attempt run 的
 *   Tier1SettleProof.tier1VerifyDigest,不接受调用方传入(接线批收紧:外部注入=伪造面);
 *   缺 settle proof = 无可批准的证据,fail-closed 拒;S3 合并收据在 merge 环节 P0.5);
 * - request_changes → running(#29b 同 task 新 attempt,复用 worktree,这轮不作废);
 * - reject → cancel_requested(取消链,作废这轮;非 failed 终态)。
 */
export function reviewTask(
  db: Db,
  audit: AuditSink,
  input: {
    taskId: string;
    verdict: ReviewVerdict;
    expectedAttempt: number;
    comments?: string;
    /** writing approve(09 §6.1a barrier ④):manual 验收项逐条裁决;UI 未逐条 ⇒ 拒 approve(11 §5.5) */
    acceptanceVerdicts?: { criterion: string; status: "pass" | "fail" }[];
  },
  nowIso: string
): ReviewResult {
  const task = db.prepare("SELECT status, project_id FROM tasks WHERE id=?").get(input.taskId) as
    | { status: string; project_id: string }
    | undefined;
  if (!task) throw new Error(`task not found: ${input.taskId}`);
  if (task.status !== "ready_for_review") throw new Error(`reviewTask requires ready_for_review, got ${task.status}`);
  const run = db
    .prepare("SELECT MAX(attempt) AS a FROM tier1_runs WHERE task_id=?")
    .get(input.taskId) as { a: number | null };
  const currentAttempt = run.a ?? 0;
  if (currentAttempt !== input.expectedAttempt) {
    throw new Error(`expectedAttempt ${input.expectedAttempt} != current ${currentAttempt} (防串旧 attempt)`);
  }

  // 评审 B5 回修:三条边统一过状态机守卫(与 requestCancel 纪律一致,防绕过 canonical 边表)
  const guard = (to: Parameters<typeof canTransitionTask>[1]): void => {
    if (!canTransitionTask("ready_for_review", to, "U")) {
      throw new Error(`illegal transition ready_for_review -> ${to} (状态机守卫)`);
    }
  };
  if (input.verdict === "approve") {
    guard("review_approved_waiting_merge");
    // A1:批准即落库 prospectiveTree + evidenceDigest(都取自当前 attempt run;缺失 = 无可批准的证据,fail-closed)
    // Codex 16 4.2 回修:proof 严格 schema 校验 + run 必须 settled_review + taskId/attempt/treeSha 交叉核对
    const run = db
      .prepare(
        "SELECT id, state, tree_sha, settle_proof_json FROM tier1_runs WHERE task_id=? AND attempt=? ORDER BY created_at DESC LIMIT 1"
      )
      .get(input.taskId, currentAttempt) as
      | { id: string; state: string; tree_sha: string | null; settle_proof_json: string | null }
      | undefined;
    if (!run) throw new Error("approve requires a run for current attempt (无可批准的执行记录)");
    if (run.state !== "settled_review") {
      throw new Error(`approve requires run state settled_review, got ${run.state}(settled_failed/中间态不可批)`);
    }
    if (!run.tree_sha) throw new Error("approve requires run.tree_sha (prospectiveTree 缺失,无可批准的树)");
    if (!run.settle_proof_json) {
      throw new Error("approve requires settle proof (evidenceDigest 库内自取,无证据不批——fail-closed)");
    }
    const rawProof: unknown = JSON.parse(run.settle_proof_json);
    // writing 分支(09 §6.1a barrier ④):evidenceDigest = H(JCS(WritingSettleProof)),manual 项逐条置 pass
    if (isWritingSettleProof(rawProof)) {
      return approveWritingTask(db, audit, {
        taskId: input.taskId,
        projectId: task.project_id,
        currentAttempt,
        run,
        rawProof,
        ...(input.acceptanceVerdicts !== undefined ? { acceptanceVerdicts: input.acceptanceVerdicts } : {}),
        nowIso
      });
    }
    const proof = tier1SettleProofSchema.parse(rawProof);
    if (proof.taskId !== input.taskId || proof.attempt !== currentAttempt || proof.runId !== run.id || proof.treeSha !== run.tree_sha) {
      throw new Error("settle proof 与 run 行交叉核对不符(taskId/attempt/runId/treeSha 任一失配,拒批)");
    }
    const evidenceDigest = proof.tier1VerifyDigest;
    const tx = db.transaction(() => {
      const upd = db
        .prepare(
          "UPDATE tasks SET status='review_approved_waiting_merge', approved_tree_sha=?, updated_at=?, parked_at=NULL, parked_deadline=NULL WHERE id=? AND status='ready_for_review'"
        )
        .run(run.tree_sha, nowIso, input.taskId);
      if (upd.changes === 0) throw new Error("approve race: task left ready_for_review concurrently");
      freezeOutbox(db, audit, input.taskId, nowIso, "ready_for_review"); // 验收已答,收叫人条目
      audit.record({
        actor: "owner",
        action: "task.review_approve",
        meta: { taskId: input.taskId, evidenceDigest, prospectiveTreeSha: run.tree_sha, attempt: currentAttempt }
      });
    });
    tx();
    return { state: "review_approved_waiting_merge" };
  }
  if (input.verdict === "request_changes") {
    // 返工:同 task 新 attempt(复用 worktree),这轮不作废(§6.1 ready_for_review -> running)
    guard("running");
    const nextAttempt = currentAttempt + 1;
    // Codex 16 3.4/4.3 回修:状态 CAS + 冻结 + comments 持久化 + 审计同事务(崩溃不留半程);
    // comments 原文落 task_messages(功能存储,执行器认领 nextAttempt 时读),审计仍只记 digest(E3)
    const tx = db.transaction(() => {
      const upd = db
        .prepare(
          "UPDATE tasks SET status='running', updated_at=?, parked_at=NULL, parked_deadline=NULL WHERE id=? AND status='ready_for_review'"
        )
        .run(nowIso, input.taskId);
      if (upd.changes === 0) throw new Error("request_changes race: task left ready_for_review concurrently");
      freezeOutbox(db, audit, input.taskId, nowIso, "ready_for_review"); // A3:防旧条目幽灵升级(09 §6.3)
      if (input.comments !== undefined && input.comments !== "") {
        persistTaskMessage(db, { taskId: input.taskId, attempt: nextAttempt, kind: "review_comments", body: input.comments }, nowIso);
      }
      audit.record({
        actor: "owner",
        action: "task.request_changes",
        meta: { taskId: input.taskId, newAttempt: nextAttempt, ...(input.comments !== undefined ? { commentsDigest: textDigest(input.comments) } : {}) }
      });
    });
    tx();
    return { state: "running", attempt: nextAttempt };
  }
  // reject → 取消链(作废这轮;worktree 留存可捡回,#34)
  guard("cancel_requested");
  const upd = db
    .prepare(
      "UPDATE tasks SET status='cancel_requested', cancel_reason='user_cancel', updated_at=?, parked_at=NULL, parked_deadline=NULL WHERE id=? AND status='ready_for_review'"
    )
    .run(nowIso, input.taskId);
  if (upd.changes === 0) throw new Error("reject race: task left ready_for_review concurrently");
  db.prepare("UPDATE tier1_runs SET state='cancel_requested', updated_at=? WHERE task_id=? AND state IN ('reserved','running','step_paused')").run(nowIso, input.taskId);
  freezeOutbox(db, audit, input.taskId, nowIso); // A3:取消冻结全部活跃条目
  audit.record({
    actor: "owner",
    action: "task.reject",
    meta: { taskId: input.taskId, ...(input.comments !== undefined ? { commentsDigest: textDigest(input.comments) } : {}) }
  });
  return { state: "cancel_requested" };
}

/**
 * writing approve(09 §6.1a barrier ④;R-A 补完 2026-07-27,Codex 21 A5):
 * 与 proof 同一事务对账(断言 ①②③ 仍成立 ∧ manual 项由本次 approve 逐条置 pass);
 * UI 未逐条裁决 ⇒ 拒 approve(11 §5.5);"settled 即全绿"为非法投影(§12-14 反例)。
 * evidenceDigest = H(JCS(WritingSettleProof))(settle_proof_json 原文 JCS 后哈希,库内自取同构)。
 */
function approveWritingTask(
  db: Db,
  audit: AuditSink,
  i: {
    taskId: string;
    projectId: string;
    currentAttempt: number;
    run: { id: string; tree_sha: string | null };
    rawProof: unknown;
    acceptanceVerdicts?: { criterion: string; status: "pass" | "fail" }[];
    nowIso: string;
  }
): ReviewResult {
  const proof = writingSettleProofSchema.parse(i.rawProof);
  if (proof.taskId !== i.taskId || proof.attempt !== i.currentAttempt || proof.runId !== i.run.id || proof.treeSha !== i.run.tree_sha) {
    throw new Error("writing settle proof 与 run 行交叉核对不符(taskId/attempt/runId/treeSha 任一失配,拒批)");
  }
  // 决策包正文(plan/acceptance;barrier ①②③ 对账源)
  const body = packageBodyForReview(db, i.taskId);
  if (!body) throw new Error("读不到决策包正文,无法对账 writing 验收(fail-closed)");
  // ④ 人评终局:manual 项须由本次 approve 逐条裁决(UI 未逐条 ⇒ 拒);verdicts exact-set 覆盖全部 manual 项
  const manualCriteria = proof.acceptanceChecks.filter((c) => c.source === "manual").map((c) => c.criterion);
  const verdicts = new Map((i.acceptanceVerdicts ?? []).map((v) => [v.criterion, v.status]));
  for (const c of manualCriteria) {
    if (!verdicts.has(c)) {
      throw new Error(`验收项未逐条裁决:「${c}」——writing 任务须逐条 pass/fail(settled ≠ 全绿,11 §5.5)`);
    }
  }
  // 逐条落定:manual 项按裁决置 pass/fail;非 manual 项保持
  const decided: AcceptanceCheck[] = proof.acceptanceChecks.map((c) =>
    c.source === "manual" ? { ...c, status: verdicts.get(c.criterion) ?? "unknown" } : c
  );
  // 断言 ①②③ 仍成立(approve 门 requireAllDrafted;manual 此刻已裁决,不再要求 unknown)
  const violations = writingSettleStructuralViolations(
    { sectionCoverage: proof.sectionCoverage, acceptanceChecks: decided },
    { plan: body.plan, acceptance: body.acceptance },
    { requireAllDrafted: true, manualMustBeUnknown: false }
  );
  if (violations.length > 0) throw new Error(`writing approve 对账没过:${violations.slice(0, 2).join(";")}`);
  // critical 验收项 fail ⇒ 不批准(人评判否)——至少一条 fail 即整体不通过,回 request_changes 语义由 UI 引导
  const failed = decided.filter((c) => c.status === "fail").map((c) => c.criterion);
  if (failed.length > 0) {
    throw new Error(`有验收项未通过:${failed.slice(0, 2).join(";")}——请提修改或作废这轮,不能带病批准`);
  }
  const evidenceDigest = jcsDigest(proof); // H(JCS(WritingSettleProof))
  const tx = db.transaction(() => {
    const upd = db
      .prepare(
        "UPDATE tasks SET status='review_approved_waiting_merge', approved_tree_sha=?, updated_at=?, parked_at=NULL, parked_deadline=NULL WHERE id=? AND status='ready_for_review'"
      )
      .run(proof.treeSha, i.nowIso, i.taskId);
    if (upd.changes === 0) throw new Error("approve race: task left ready_for_review concurrently");
    freezeOutbox(db, audit, i.taskId, i.nowIso, "ready_for_review");
    audit.record({
      actor: "owner",
      action: "task.review_approve",
      meta: { taskId: i.taskId, kind: "writing", evidenceDigest, prospectiveTreeSha: proof.treeSha, attempt: i.currentAttempt, acceptancePassed: manualCriteria.length }
    });
  });
  tx();
  return { state: "review_approved_waiting_merge" };
}

function packageBodyForReview(db: Db, taskId: string): { plan: { seq: number; owner: "ai" | "human" }[]; acceptance: string[] } | null {
  const row = db
    .prepare(
      "SELECT dp.body_json FROM tasks t JOIN decision_packages dp ON dp.id=t.package_id AND dp.revision=t.package_rev WHERE t.id=?"
    )
    .get(taskId) as { body_json: string } | undefined;
  if (!row) return null;
  try {
    const body = JSON.parse(row.body_json) as { plan?: { seq: number; owner: "ai" | "human" }[]; acceptance?: string[] };
    return { plan: body.plan ?? [], acceptance: body.acceptance ?? [] };
  } catch {
    return null;
  }
}

// ---------- requestManualMerge + MergeProof watcher ----------

export interface ManualMergeHandoff {
  handoffUrl: string;
}

/** P0 无 S3 卡:导航用户到受信终端合并;daemon 起 merge-result watcher(本函数返回 handoff,watcher 由调用方轮询 verifyMergeProof) */
export function requestManualMerge(db: Db, audit: AuditSink, taskId: string): ManualMergeHandoff {
  const task = db.prepare("SELECT status FROM tasks WHERE id=?").get(taskId) as { status: string } | undefined;
  if (!task) throw new Error(`task not found: ${taskId}`);
  if (task.status !== "review_approved_waiting_merge") {
    throw new Error(`requestManualMerge requires review_approved_waiting_merge, got ${task.status}`);
  }
  audit.record({ actor: "daemon", action: "task.request_manual_merge", meta: { taskId } });
  return { handoffUrl: `saydo://merge/${taskId}` };
}

/**
 * MergeProof watcher 判定(Phase4 评审 A1 回修):对账基准 = **批准时落库的 tasks.approved_tree_sha**,
 * 不信 proof 自带的 approvedProspectiveTreeSha(自证不算证;proof 两字段仅作交叉一致性检查)。
 * 观察到外部合并 + treeSha 与库值匹配 ⇒ task_done;不匹配/库值缺失 ⇒ 拒推进(防已回滚显示完成)。
 */
export function verifyAndCompleteMerge(db: Db, audit: AuditSink, proof: MergeProof, nowIso: string): { done: boolean; reason?: string } {
  const task = db.prepare("SELECT status, approved_tree_sha FROM tasks WHERE id=?").get(proof.taskId) as
    | { status: string; approved_tree_sha: string | null }
    | undefined;
  if (!task) throw new Error(`task not found: ${proof.taskId}`);
  if (task.status !== "review_approved_waiting_merge") {
    return { done: false, reason: `task not awaiting merge (status=${task.status})` };
  }
  if (!task.approved_tree_sha) {
    return { done: false, reason: "no approved_tree_sha on record (批准未落树基准,fail-closed)" };
  }
  if (proof.treeSha !== task.approved_tree_sha || proof.approvedProspectiveTreeSha !== task.approved_tree_sha) {
    audit.record({
      actor: "daemon",
      action: "task.merge_proof_mismatch",
      meta: { taskId: proof.taskId, treeSha: proof.treeSha, proofClaims: proof.approvedProspectiveTreeSha, recorded: task.approved_tree_sha }
    });
    return { done: false, reason: "treeSha != 批准时落库的 prospectiveTree (拒推进,防已回滚显示完成)" };
  }
  const upd = db
    .prepare("UPDATE tasks SET status='task_done', updated_at=? WHERE id=? AND status='review_approved_waiting_merge'")
    .run(nowIso, proof.taskId);
  if (upd.changes === 0) return { done: false, reason: "merge race: status changed concurrently" };
  audit.record({ actor: "daemon", action: "task.done", meta: { taskId: proof.taskId, mergeCommit: proof.mergeCommit } });
  return { done: true };
}

// ---------- retryTask(重派发语义,owner 2026-07-25 拍板;09 §6.1 failed→queued (U) 边 + §13 语义注)----------

/**
 * failed/blocked 后重试(10 #31;09 §13 retryTask 语义注,接线批改重派发):
 * - failed ⇒ **重派发**:failed → queued (U)(09 §6.1 新边)——旧 run 保持终态、证据不串线,
 *   不直进 running(不开绕同仓串行队列的第二口子);attempt+1 新派发在 queued→running 认领时
 *   INSERT 新 tier1_run 并**重过全部派发前置**(worktree 供给/预算/Gate 0);
 *   离开 failed 时活跃 trigger=failed 回叫条目置 resolved(superseded)(与离开 ready_for_review 冻结同构);
 * - blocked ⇒ **应答注入**:blocked → running (U)(既有边),message = 答案(一答一 run);
 * - 全部走 canTransitionTask + CAS(裸 UPDATE 已删——Codex 14 横1/15 Q3 回修);
 * - message 原文不落审计(E3 敏感纪律,只记 digest);其编译上下文注入随生产执行器认领消费。
 */
export function retryTask(
  db: Db,
  audit: AuditSink,
  taskId: string,
  nowIso: string,
  message?: string
): { attempt: number } {
  const task = db.prepare("SELECT status FROM tasks WHERE id=?").get(taskId) as { status: string } | undefined;
  if (!task) throw new Error(`task not found: ${taskId}`);
  if (task.status !== "failed" && task.status !== "blocked") {
    throw new Error(`retryTask requires failed/blocked, got ${task.status}`);
  }
  // Codex 16 3.3 回修:failed 重派发要求旧 run 已达终态(证据不串线的机械前提);
  // blocked 应答注入时 run 活跃合法(agent 等答复,tier1_runs 无 blocked 态)
  if (task.status === "failed") {
    const active = (
      db
        .prepare(
          "SELECT COUNT(*) AS c FROM tier1_runs WHERE task_id=? AND state IN ('reserved','running','step_paused','cancel_requested')"
        )
        .get(taskId) as { c: number }
    ).c;
    if (active > 0) throw new Error(`retry(failed) requires terminal runs, found ${active} active run(s)(数据异常,拒重派发)`);
  }
  const run = db.prepare("SELECT MAX(attempt) AS a FROM tier1_runs WHERE task_id=?").get(taskId) as { a: number | null };
  const nextAttempt = (run.a ?? 0) + 1;
  const to = task.status === "failed" ? "queued" : "running";
  if (!canTransitionTask(task.status as never, to, "U")) {
    throw new Error(`illegal task transition ${task.status} -> ${to} (状态机守卫)`);
  }
  // Codex 16 3.4 回修:CAS + 冻结 + message 持久化 + 审计同事务(崩溃不留"已 queued 但旧 failed 回叫还活着");
  // message 原文落 task_messages(09 §13 "进下次 run 编译上下文"的机械落点),审计只记 digest(E3)
  const tx = db.transaction(() => {
    const upd = db
      .prepare("UPDATE tasks SET status=?, updated_at=?, parked_at=NULL, parked_deadline=NULL WHERE id=? AND status=?")
      .run(to, nowIso, taskId, task.status);
    if (upd.changes === 0) throw new Error(`retry race: task left ${task.status} concurrently (${taskId})`);
    if (task.status === "failed") {
      freezeOutbox(db, audit, taskId, nowIso, "failed"); // 离开 failed:trigger=failed 活跃条目 superseded(09 §6.1)
    } else {
      // impl-readback 回收批 2(B3):blocked→running(应答注入)同样冻结 trigger=blocked 活跃条目——
      // 与 failed/ready_for_review/cancel 的冻结同构,防通知链上线后重叫已答复的问题
      freezeOutbox(db, audit, taskId, nowIso, "blocked");
    }
    if (message !== undefined && message !== "") {
      persistTaskMessage(db, { taskId, attempt: nextAttempt, kind: "retry", body: message }, nowIso);
    }
    audit.record({
      actor: "owner",
      action: "task.retry",
      meta: {
        taskId,
        from: task.status,
        to,
        attempt: nextAttempt,
        ...(message !== undefined ? { messageDigest: textDigest(message) } : {})
      }
    });
  });
  tx();
  return { attempt: nextAttempt };
}
