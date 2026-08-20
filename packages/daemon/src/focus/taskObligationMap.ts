// C6 task→obligation 自动映射(经 binding.focusId + dedupeKey)。
// 结算状态表写死;outbox ack 不触发任何 obligation 变更。

import type { Db } from "../storage/db.js";
import { getActiveBindingForTask } from "./binding.js";
import { upsertObligation, getObligationByDedupe, buildObligationDedupeKey } from "./obligations.js";
import { FocusWriteError } from "./writeTx.js";

/** 任务状态 → 义务结算(写死表;approve≠交付) */
export type TaskStatusForMap =
  | "queued"
  | "running"
  | "blocked"
  | "paused"
  | "ready_for_review"
  | "review_approved_waiting_merge"
  | "merging"
  | "task_done"
  | "cancel_settled"
  | "superseded"
  | string;

export type ObligationMapAction =
  | { kind: "noop"; reason: string }
  | { kind: "ensure_open" }
  | { kind: "resolve"; resolution: "done" | "abandoned" | "no_longer_applicable" | "superseded" };

/**
 * 结算状态表:
 * - task_done → resolved(done)
 * - cancel_settled(user_cancel/park_expired) → abandoned | no_longer_applicable
 * - superseded → superseded
 * - queued/running/blocked/paused/ready_for_review/review_approved_waiting_merge/merging → 不 resolve
 */
export function mapTaskStatusToObligationAction(
  status: TaskStatusForMap,
  cancelReason?: "user_cancel" | "park_expired" | string
): ObligationMapAction {
  if (status === "task_done") return { kind: "resolve", resolution: "done" };
  if (status === "superseded") return { kind: "resolve", resolution: "superseded" };
  if (status === "cancel_settled") {
    if (cancelReason === "park_expired") {
      return { kind: "resolve", resolution: "no_longer_applicable" };
    }
    return { kind: "resolve", resolution: "abandoned" };
  }
  const openLike = new Set([
    "queued",
    "running",
    "blocked",
    "paused",
    "ready_for_review",
    "review_approved_waiting_merge",
    "merging",
    "confirmed"
  ]);
  if (openLike.has(status)) return { kind: "noop", reason: `status=${status} does not resolve obligation` };
  return { kind: "noop", reason: `unmapped status=${status}` };
}

export function taskObligationDedupeKey(focusId: string, taskId: string, attempt = 1): string {
  return buildObligationDedupeKey({
    focusId,
    kind: "action",
    sourceKey: `task:${taskId}:attempt:${attempt}`
  });
}

/**
 * 任务状态变更钩:有 active binding 才映射。
 * outbox ack 不得调用本函数(负向测试覆盖)。
 */
export function applyTaskStatusToObligation(
  db: Db,
  input: {
    taskId: string;
    taskTitle: string;
    status: TaskStatusForMap;
    cancelReason?: string;
    attempt?: number;
    sessionId?: string;
  }
): { applied: boolean; obligationId?: string; action: ObligationMapAction } {
  const binding = getActiveBindingForTask(db, input.taskId);
  if (!binding) {
    return { applied: false, action: { kind: "noop", reason: "no_active_binding" } };
  }
  const action = mapTaskStatusToObligationAction(input.status, input.cancelReason);
  if (action.kind === "noop") {
    return { applied: false, action };
  }

  const dedupeKey = taskObligationDedupeKey(binding.focusId, input.taskId, input.attempt ?? 1);
  const existing = getObligationByDedupe(db, binding.focusId, dedupeKey);

  if (action.kind === "resolve") {
    // ④e A7:agent done 必带 task 证据;abandoned/superseded/nla 不受门
    const attempt = input.attempt ?? 1;
    const doneEvidence =
      action.resolution === "done"
        ? ({ type: "task" as const, id: input.taskId, attempt })
        : undefined;
    if (!existing) {
      // 无既有义务:先开再结(幂等落账)
      const opened = upsertObligation(db, binding.focusId, {
        kind: "action",
        title: input.taskTitle,
        owner: "agent",
        status: "open",
        verification: "confirmed",
        dedupeKey,
        actionRef: input.taskId,
        nextStep: "执行任务",
        actorKind: "daemon",
        sessionId: input.sessionId
      });
      const resolved = upsertObligation(db, binding.focusId, {
        id: opened.obligationId,
        kind: "action",
        title: input.taskTitle,
        owner: "agent",
        status: action.resolution === "superseded" ? "superseded" : "resolved",
        verification: "confirmed",
        dedupeKey,
        resolution: action.resolution,
        actionRef: input.taskId,
        actorKind: "daemon",
        sessionId: input.sessionId,
        ...(doneEvidence ? { evidence: doneEvidence } : {})
      });
      return { applied: true, obligationId: resolved.obligationId, action };
    }
    if (existing.status === "resolved" || existing.status === "superseded") {
      return { applied: false, obligationId: existing.id, action: { kind: "noop", reason: "already_terminal" } };
    }
    // unverified 不得 resolved(done)
    if (existing.verification === "unverified" && action.resolution === "done") {
      throw new FocusWriteError("unverified_done_denied", "unverified obligation cannot resolve(done)");
    }
    const resolved = upsertObligation(db, binding.focusId, {
      id: existing.id,
      kind: existing.kind,
      title: existing.title,
      owner: existing.owner,
      status: action.resolution === "superseded" ? "superseded" : "resolved",
      verification: existing.verification,
      dedupeKey: existing.dedupeKey,
      resolution: action.resolution,
      actionRef: input.taskId,
      actorKind: "daemon",
      sessionId: input.sessionId,
      ...(doneEvidence ? { evidence: doneEvidence } : {})
    });
    return { applied: true, obligationId: resolved.obligationId, action };
  }

  return { applied: false, action };
}

/** 负向:outbox ack 入口显式 no-op(调用方若误接也零变更) */
export function onOutboxAck(_db: Db, _taskId: string): { applied: false; reason: "outbox_ack_ignored" } {
  return { applied: false, reason: "outbox_ack_ignored" };
}
