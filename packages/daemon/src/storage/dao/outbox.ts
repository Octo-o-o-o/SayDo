// DAO:callback_outbox(docs/09 §6.3)。
// 活跃唯一由 DDL 部分唯一索引把守;settle 缺一不叫的裁决在 C4(4.4),本层提供"proof 齐备才可写"的入口形状。

import type { CallbackOutboxEntry, OutboxState } from "@saydo/contracts";
import { callbackOutboxEntrySchema, canTransitionOutbox } from "@saydo/contracts";
import type { Db } from "../db.js";

export function insertOutboxEntry(db: Db, e: CallbackOutboxEntry): void {
  callbackOutboxEntrySchema.parse(e);
  db.prepare(
    `INSERT INTO callback_outbox(id, task_id, trigger, occurrence_key, dedupe_key, settle_json, state, resolution,
       escalation, notified_at, acked_at, resolved_at, snoozed_until, created_at, updated_at)
     VALUES (@id, @taskId, @trigger, @occurrenceKey, @dedupeKey, @settleJson, @state, @resolution,
       @escalation, @notifiedAt, @ackedAt, @resolvedAt, @snoozedUntil, @createdAt, @updatedAt)`
  ).run({
    id: e.id,
    taskId: e.taskId,
    trigger: e.trigger,
    occurrenceKey: e.occurrenceKey,
    dedupeKey: e.dedupeKey,
    settleJson: JSON.stringify(e.settleProof),
    state: e.state,
    resolution: e.resolution ?? null,
    escalation: e.escalationLevel,
    notifiedAt: e.notifiedAt ?? null,
    ackedAt: e.ackedAt ?? null,
    resolvedAt: e.resolvedAt ?? null,
    snoozedUntil: e.snoozedUntil ?? null,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt
  });
}

export function getOutboxEntry(db: Db, id: string): CallbackOutboxEntry | null {
  const row = db.prepare("SELECT * FROM callback_outbox WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return callbackOutboxEntrySchema.parse({
    id: row["id"],
    taskId: row["task_id"],
    trigger: row["trigger"],
    occurrenceKey: row["occurrence_key"],
    dedupeKey: row["dedupe_key"],
    settleProof: JSON.parse(row["settle_json"] as string),
    state: row["state"],
    ...(row["resolution"] ? { resolution: row["resolution"] } : {}),
    escalationLevel: row["escalation"],
    ...(row["notified_at"] ? { notifiedAt: row["notified_at"] } : {}),
    ...(row["acked_at"] ? { ackedAt: row["acked_at"] } : {}),
    ...(row["resolved_at"] ? { resolvedAt: row["resolved_at"] } : {}),
    ...(row["snoozed_until"] ? { snoozedUntil: row["snoozed_until"] } : {}),
    createdAt: row["created_at"],
    updatedAt: row["updated_at"]
  });
}

export function transitionOutbox(
  db: Db,
  id: string,
  to: OutboxState,
  now: string,
  patch: { resolution?: "done" | "superseded" | "expired"; escalationDelta?: number; snoozedUntil?: string } = {}
): void {
  const row = db.prepare("SELECT state, escalation FROM callback_outbox WHERE id = ?").get(id) as
    | { state: OutboxState; escalation: number }
    | undefined;
  if (!row) throw new Error(`outbox entry not found: ${id}`);
  if (!canTransitionOutbox(row.state, to)) {
    throw new Error(`illegal outbox transition ${row.state} -> ${to}`);
  }
  db.prepare(
    `UPDATE callback_outbox SET state = @to, updated_at = @now,
       resolution = COALESCE(@resolution, resolution),
       escalation = MIN(escalation + @escalationDelta, 2),
       snoozed_until = COALESCE(@snoozedUntil, snoozed_until),
       notified_at = CASE WHEN @to = 'notified' THEN @now ELSE notified_at END,
       acked_at = CASE WHEN @to = 'acked' THEN @now ELSE acked_at END,
       resolved_at = CASE WHEN @to = 'resolved' THEN @now ELSE resolved_at END
     WHERE id = @id`
  ).run({
    id,
    to,
    now,
    resolution: patch.resolution ?? null,
    escalationDelta: patch.escalationDelta ?? 0,
    snoozedUntil: patch.snoozedUntil ?? null
  });
}

/**
 * L0 未 ack 升 L1:状态保持 notified,只 bump escalation(上限 cap)。
 * 不是状态转换——canTransitionOutbox 不允许 notified→notified,且 requeued 唯一语义禁止 notified→requeued。
 * 不刷新 notified_at(L0 应答窗只认首次语音投递时刻)。
 */
export function bumpOutboxEscalation(db: Db, id: string, now: string, cap: number): boolean {
  const row = db.prepare("SELECT state, escalation FROM callback_outbox WHERE id = ?").get(id) as
    | { state: OutboxState; escalation: number }
    | undefined;
  if (!row || row.state !== "notified") return false;
  if (row.escalation >= cap) return false;
  const result = db
    .prepare(
      `UPDATE callback_outbox SET escalation = MIN(escalation + 1, @cap), updated_at = @now
       WHERE id = @id AND state = 'notified'`
    )
    .run({ id, now, cap });
  return result.changes > 0;
}

/** 取消冻结(09 §6.3):task 的全部活跃条目立即 resolved(superseded),不再外呼 */
export function resolveActiveEntriesForTask(db: Db, taskId: string, now: string, trigger?: string): number {
  const result = trigger
    ? db
        .prepare(
          `UPDATE callback_outbox SET state='resolved', resolution='superseded', resolved_at=@now, updated_at=@now
           WHERE task_id=@taskId AND trigger=@trigger AND state IN ('pending','notified','acked','requeued')`
        )
        .run({ taskId, now, trigger })
    : db
        .prepare(
          `UPDATE callback_outbox SET state='resolved', resolution='superseded', resolved_at=@now, updated_at=@now
           WHERE task_id=@taskId AND state IN ('pending','notified','acked','requeued')`
        )
        .run({ taskId, now });
  return result.changes;
}
