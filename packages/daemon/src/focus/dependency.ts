// 义务依赖与唤醒矩阵(合同 §3.4,四审 A-1/A-2)。
// 设置=同语句写三值(status=waiting + waiting_on 文本 + waiting_on_obligation_id);
// resolve 单点同事务处理 waiting 依赖方:done→open 清两列+woken;终态拒→blocked 保留 provenance。
// 批 3 零主动通知:只写账本,不写 outbox。

import type { FocusObligationResolution, TaskDependencyCondition } from "@saydo/contracts";
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
        waiting_on_task_id: string | null;
      }
    | undefined;
  if (!dep) throw new FocusWriteError("not_found", `obligation ${input.obligationId} not found`);

  // 清除(DAILY-01:同时清义务级与任务级前置列)
  if (input.preId === null) {
    if (dep.status === "waiting" || dep.waiting_on_obligation_id || depHasTaskPre(dep)) {
      db.prepare(
        `UPDATE focus_obligations
         SET status = CASE WHEN status IN ('waiting','blocked') THEN 'open' ELSE status END,
             waiting_on = NULL,
             waiting_on_obligation_id = NULL,
             waiting_on_task_id = NULL,
             waiting_task_condition = NULL,
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

  if (dep.status === "resolved" || dep.status === "superseded") {
    throw new FocusWriteError("obligation_terminal", `obligation ${dep.id} is ${dep.status}`);
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
       SET status = 'blocked', waiting_on = ?, waiting_on_obligation_id = ?,
           waiting_on_task_id = NULL, waiting_task_condition = NULL, updated_at = ?
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
     SET status = 'waiting', waiting_on = ?, waiting_on_obligation_id = ?,
         waiting_on_task_id = NULL, waiting_task_condition = NULL, updated_at = ?
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
         SET status = 'open', waiting_on = NULL, waiting_on_obligation_id = NULL,
             waiting_on_task_id = NULL, waiting_task_condition = NULL, updated_at = ?
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

// ---------- DAILY-01:任务级前置依赖(合同 §15.2) ----------
// 义务等待同 Focus 绑定任务到达条件:accepted=当前版本验收通过(review_approved_waiting_merge
// 及后继 merging/task_done),delivered=已交付(task_done)。
// 前置任务负向终态(failed/cancel_settled/superseded)→ dependent blocked,列保留 provenance。
// 唤醒/阻塞挂在 dao transitionTask 状态机单点,与义务级唤醒同事务语义。

function depHasTaskPre(row: { waiting_on_task_id?: string | null }): boolean {
  return row.waiting_on_task_id != null;
}

/** 任务现势是否已满足依赖条件 */
export function taskSatisfiesCondition(status: string, condition: TaskDependencyCondition): boolean {
  if (condition === "accepted") {
    return status === "review_approved_waiting_merge" || status === "merging" || status === "task_done";
  }
  return status === "task_done";
}

/** 前置任务负向终态(merge_failed=可重试中间态,不算终态) */
const TASK_NEGATIVE_TERMINAL = new Set(["failed", "cancel_settled", "superseded"]);

export interface SetWaitingOnTaskInput {
  obligationId: string;
  taskId: string;
  condition: TaskDependencyCondition;
  actorKind?: "user" | "daemon" | "brain_proposal";
  sessionId?: string;
}

/**
 * 设任务级前置:与 waiting_on_obligation_id 互斥(设置即清)。
 * 任务须绑定同 Focus(action_execution_bindings);已满足→set+woken 同事务即时落地;
 * 前置已负向终态→直接 blocked。
 */
export function setObligationWaitingOnTask(
  db: Db,
  input: SetWaitingOnTaskInput,
  opts: FocusWriteTxOptions = {}
): { ok: true; status: string } {
  return withFocusWriteTx(db, opts, (ops) => setWaitingOnTaskOnOps(ops, input));
}

export function setWaitingOnTaskOnOps(
  ops: FocusWriteOps,
  input: SetWaitingOnTaskInput
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
      }
    | undefined;
  if (!dep) throw new FocusWriteError("not_found", `obligation ${input.obligationId} not found`);
  if (dep.status === "resolved" || dep.status === "superseded") {
    throw new FocusWriteError("obligation_terminal", `obligation ${dep.id} is ${dep.status}`);
  }

  const task = db
    .prepare("SELECT id, title, status FROM tasks WHERE id = ?")
    .get(input.taskId) as { id: string; title: string; status: string } | undefined;
  if (!task) throw new FocusWriteError("not_found", `prerequisite task ${input.taskId} not found`);

  // 同 Focus 边界:任务须经 action_execution_bindings 锚在本 focus(含历史 superseded 绑定)
  const bound = db
    .prepare(
      `SELECT 1 AS x FROM action_execution_bindings WHERE task_id = ? AND focus_id = ? LIMIT 1`
    )
    .get(input.taskId, dep.focus_id) as { x: number } | undefined;
  if (!bound) {
    throw new FocusWriteError("dependency_cross_focus", "prerequisite task must be bound to same focus");
  }

  const writeCols = (status: string | null) =>
    db.prepare(
      `UPDATE focus_obligations
       SET status = COALESCE(?, status),
           waiting_on = ?, waiting_on_obligation_id = NULL,
           waiting_on_task_id = ?, waiting_task_condition = ?, updated_at = ?
       WHERE id = ?`
    ).run(status, task.title, task.id, input.condition, ops.nowIso, dep.id);

  const clearCols = (toStatus: string) =>
    db.prepare(
      `UPDATE focus_obligations
       SET status = ?, waiting_on = NULL, waiting_on_obligation_id = NULL,
           waiting_on_task_id = NULL, waiting_task_condition = NULL, updated_at = ?
       WHERE id = ?`
    ).run(toStatus, ops.nowIso, dep.id);

  writeCols("waiting");
  ops.appendEvent(dep.focus_id, {
    type: "dependency_task_set",
    payload: {
      depId: dep.id,
      depTitle: dep.title,
      preTaskId: task.id,
      preTaskTitle: task.title,
      condition: input.condition
    },
    actorKind: input.actorKind ?? "user",
    sessionId: input.sessionId
  });

  if (taskSatisfiesCondition(task.status, input.condition)) {
    // 前置条件已满足:同事务即时唤醒,不留 waiting 挂账
    clearCols("open");
    ops.appendEvent(dep.focus_id, {
      type: "dependency_task_woken",
      payload: {
        depId: dep.id,
        depTitle: dep.title,
        preTaskId: task.id,
        preTaskTitle: task.title,
        condition: input.condition
      },
      actorKind: "daemon",
      sessionId: input.sessionId
    });
    return { ok: true, status: "open" };
  }

  if (TASK_NEGATIVE_TERMINAL.has(task.status)) {
    writeCols("blocked");
    ops.appendEvent(dep.focus_id, {
      type: "dependency_task_blocked",
      payload: {
        depId: dep.id,
        depTitle: dep.title,
        preTaskId: task.id,
        preTaskTitle: task.title,
        condition: input.condition,
        preStatus: task.status
      },
      actorKind: "daemon",
      sessionId: input.sessionId
    });
    return { ok: true, status: "blocked" };
  }

  return { ok: true, status: "waiting" };
}

/**
 * 任务状态机钩子(dao/tasks.ts transitionTask 成功后调用):
 * 到达满足态 → waiting 依赖方 open+清列+dependency_task_woken;
 * 负向终态 → 依赖方 blocked+dependency_task_blocked(列保留 provenance)。
 * 每个受影响 focus 各开一次 FocusWriteTx(义务不跨 focus,事件落在各自流)。
 */
export function applyTaskDependencyTransition(
  db: Db,
  taskId: string,
  toStatus: string
): { woken: string[]; blocked: string[] } {
  const deps = db
    .prepare(
      `SELECT id, title, focus_id, waiting_task_condition
       FROM focus_obligations
       WHERE waiting_on_task_id = ? AND status = 'waiting'`
    )
    .all(taskId) as Array<{
    id: string;
    title: string;
    focus_id: string;
    waiting_task_condition: string | null;
  }>;
  if (deps.length === 0) return { woken: [], blocked: [] };

  const satisfies =
    toStatus === "task_done" || toStatus === "review_approved_waiting_merge" || toStatus === "merging";
  const negative = TASK_NEGATIVE_TERMINAL.has(toStatus);
  if (!satisfies && !negative) return { woken: [], blocked: [] };

  const task = db.prepare("SELECT title FROM tasks WHERE id = ?").get(taskId) as
    | { title: string }
    | undefined;
  const taskTitle = task?.title ?? taskId;

  const byFocus = new Map<string, typeof deps>();
  for (const d of deps) {
    const list = byFocus.get(d.focus_id) ?? [];
    list.push(d);
    byFocus.set(d.focus_id, list);
  }

  const woken: string[] = [];
  const blocked: string[] = [];
  for (const [focusId, group] of byFocus) {
    withFocusWriteTx(db, {}, (ops) => {
      for (const d of group) {
        const condition = (d.waiting_task_condition ?? "accepted") as TaskDependencyCondition;
        if (satisfies && taskSatisfiesCondition(toStatus, condition)) {
          db.prepare(
            `UPDATE focus_obligations
             SET status = 'open', waiting_on = NULL, waiting_on_obligation_id = NULL,
                 waiting_on_task_id = NULL, waiting_task_condition = NULL, updated_at = ?
             WHERE id = ? AND status = 'waiting'`
          ).run(ops.nowIso, d.id);
          ops.appendEvent(focusId, {
            type: "dependency_task_woken",
            payload: {
              depId: d.id,
              depTitle: d.title,
              preTaskId: taskId,
              preTaskTitle: taskTitle,
              condition
            },
            actorKind: "daemon"
          });
          woken.push(d.id);
        } else if (negative) {
          db.prepare(
            `UPDATE focus_obligations SET status = 'blocked', updated_at = ?
             WHERE id = ? AND status = 'waiting'`
          ).run(ops.nowIso, d.id);
          ops.appendEvent(focusId, {
            type: "dependency_task_blocked",
            payload: {
              depId: d.id,
              depTitle: d.title,
              preTaskId: taskId,
              preTaskTitle: taskTitle,
              condition,
              preStatus: toStatus
            },
            actorKind: "daemon"
          });
          blocked.push(d.id);
        }
      }
      ops.touchUpdatedAt(focusId);
    });
  }
  return { woken, blocked };
}

/** 启动恢复:waiting 依赖的任务已满足/负向终态时补推进(崩溃在 task_done 与依赖之间)。 */
export function recoverWaitingDependencies(db: Db): { obligationId: string; taskId: string; status: string }[] {
  const rows = db
    .prepare(
      `SELECT o.id AS obligationId, o.waiting_on_task_id AS taskId, t.status AS status
       FROM focus_obligations o
       JOIN tasks t ON t.id = o.waiting_on_task_id
       WHERE o.status = 'waiting' AND o.waiting_on_task_id IS NOT NULL`
    )
    .all() as Array<{ obligationId: string; taskId: string; status: string }>;
  const seen = new Set<string>();
  const out: { obligationId: string; taskId: string; status: string }[] = [];
  for (const row of rows) {
    if (seen.has(row.taskId)) continue;
    seen.add(row.taskId);
    applyTaskDependencyTransition(db, row.taskId, row.status);
    out.push(row);
  }
  return out;
}
