// docs/09 §6.3 回叫 outbox 与 settle barrier。

import { z } from "zod";
import { idSchema } from "../ids.js";
import { tsSchema } from "./common.js";
import { tier1MinimalProofSchema } from "./task.js";

export const outboxTriggerSchema = z.enum([
  "ready_for_review",
  "blocked",
  "failed",
  "approval_request",
  "step_boundary",
  "parked_expired",
  "subscription_stalled"
]);
export type OutboxTrigger = z.infer<typeof outboxTriggerSchema>;

export const outboxStateSchema = z.enum(["pending", "notified", "acked", "requeued", "resolved"]);
export type OutboxState = z.infer<typeof outboxStateSchema>;

export const callbackOutboxEntrySchema = z.strictObject({
  id: idSchema,
  taskId: idSchema,
  trigger: outboxTriggerSchema,
  occurrenceKey: z.string().min(1),
  dedupeKey: z.string().min(1), // NOT NULL:四段恒可构造(SOL 反例 active_null_dedupe)
  settleProof: z.strictObject({
    projectionCursor: z.string(),
    artifactChecks: z.array(z.string()),
    // blocked/failed 回叫的最小 settle proof(09 §9:questionId 或 exitEvidence + transcriptCursor;
    // Codex 16 6.2 回修:外呼必须有可定位证据,入队时结构化落 settle_json——additive 可选字段)
    minimalProof: tier1MinimalProofSchema.optional()
  }),
  state: outboxStateSchema,
  resolution: z.enum(["done", "superseded", "expired"]).optional(),
  escalationLevel: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  notifiedAt: tsSchema.optional(),
  ackedAt: tsSchema.optional(),
  resolvedAt: tsSchema.optional(),
  snoozedUntil: tsSchema.optional(),
  /** EMAIL-A:该条目已发邮件的 Message-ID(每任务一线程锚;additive 可空,DDL v32) */
  threadMessageId: z.string().min(1).optional(),
  createdAt: tsSchema,
  updatedAt: tsSchema
});
export type CallbackOutboxEntry = z.infer<typeof callbackOutboxEntrySchema>;

/** dedupeKey 口径(09 §6.3):taskId:trigger:packageRevision:occurrenceKey */
export function buildDedupeKey(i: {
  taskId: string;
  trigger: OutboxTrigger;
  packageRevision: number;
  occurrenceKey: string;
}): string {
  return `${i.taskId}:${i.trigger}:${i.packageRevision}:${i.occurrenceKey}`;
}

/** 活跃态集合(outbox_active_dedupe 部分唯一索引口径) */
export const OUTBOX_ACTIVE_STATES: readonly OutboxState[] = ["pending", "notified", "acked", "requeued"];
