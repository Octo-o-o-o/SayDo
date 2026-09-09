// Focus v0.4 ④a:confirmation_ledger 跨域 carrier 类型(与 daemon DDL 对齐)。
// 权威终局账;有 focusId 的 focus_* 另写 focus_events 三事件,本表全 kind 全终局必记。

import { z } from "zod";
import { idSchema } from "../ids.js";
import { digestSchema, tsSchema } from "./common.js";

/**
 * 确认环 kind 单源(09 §15.1;GAP-02 2.1):daemon `live/confirm.ts` 的分类器与 console 确认卡都 import 本表,
 * 不得再造第二份枚举(AGENTS.md 硬规则 5)。SEMANTIC = consumer-owned finalize 的 focus 语义 mutation(六个 focus_* +
 * expectation_ack);NON_SEMANTIC = 轻终局 accept(dispatch / runtime_effect / readiness / memory / project_anchor)。
 * 两集合不相交,并集 = CONFIRM_KINDS = PendingPayload 每个 kind(daemon 侧有编译期 parity 断言)。
 */
export const SEMANTIC_MUTATION_KINDS = [
  "focus_anchor",
  "focus_obligation",
  "focus_obligation_resolve",
  "focus_create_anchor",
  "focus_revision",
  "focus_lane_split",
  "expectation_ack"
] as const;
export type SemanticMutationKind = (typeof SEMANTIC_MUTATION_KINDS)[number];

export const NON_SEMANTIC_CONFIRM_KINDS = [
  "dispatch",
  "runtime_effect",
  "readiness",
  "memory",
  "project_anchor"
] as const;
export type NonSemanticConfirmKind = (typeof NON_SEMANTIC_CONFIRM_KINDS)[number];

export const CONFIRM_KINDS = [...SEMANTIC_MUTATION_KINDS, ...NON_SEMANTIC_CONFIRM_KINDS] as const;
export const confirmKindSchema = z.enum(CONFIRM_KINDS);
export type ConfirmKind = z.infer<typeof confirmKindSchema>;

export function isConfirmKind(value: string): value is ConfirmKind {
  return (CONFIRM_KINDS as readonly string[]).includes(value);
}

/** ledger 八终局(与 ConfirmationLoop hooks/onResolve 对齐)。
 * 映射说明(代码现状):Focus 语义 mutation 的 accept 走 hold→commitConsume,
 * 终局 outcome 写 'accepted'(无独立 'consumed' 值);非 Focus accept 经 lightFinalize 同写 'accepted'。
 * reread/invalidated_reread 非终局,不入 ledger outcome。 */
export const confirmationOutcomeSchema = z.enum([
  "accepted",
  "rejected",
  "dismissed",
  "to_screen",
  "withdrawn",
  "stale",
  "expired"
]);
export type ConfirmationOutcome = z.infer<typeof confirmationOutcomeSchema>;

/** payload_summary_json 白名单(v3 R8);detail/路径/全文不进 summary */
export const confirmationPayloadSummarySchema = z.strictObject({
  kind: z.string().min(1),
  title: z.string().max(80).optional(),
  dedupeKey: z.string().optional(),
  focusId: idSchema.optional(),
  obligationKind: z.string().optional()
});
export type ConfirmationPayloadSummary = z.infer<typeof confirmationPayloadSummarySchema>;

export const confirmationDowngradeStatusSchema = z.enum([
  "n/a",
  "pending",
  "failed",
  "done",
  "abandoned"
]);
export type ConfirmationDowngradeStatus = z.infer<typeof confirmationDowngradeStatusSchema>;

/** focus_obligation expired 时写入的最小降格 payload(④a 只写不消费;④b saga 消费) */
export const confirmationDowngradePayloadSchema = z.strictObject({
  owner: z.enum(["human", "agent", "external"]),
  needs: z.enum(["decision", "input", "action", "unknown"]).optional(),
  kind: z.enum(["answer", "decision", "action", "followup", "check"]),
  title: z.string().min(1),
  detail: z.string().optional(),
  verification: z.enum(["provisional", "unverified", "confirmed"]).optional(),
  nextStep: z.string().optional(),
  laneId: idSchema.optional(),
  dedupeKey: z.string().min(1)
});
export type ConfirmationDowngradePayload = z.infer<typeof confirmationDowngradePayloadSchema>;

/** remaining_intent_json 结构(v5.3):text 仅 handled=false 期间存在;控制轮注入成功后清 text 留 digest */
export const remainingIntentJsonSchema = z.strictObject({
  textDigest: digestSchema,
  sourceTurnId: z.string().min(1),
  handled: z.boolean(),
  /** operational work store:handled=true 后必须缺省/清空 */
  text: z.string().max(300).optional()
});
export type RemainingIntentJson = z.infer<typeof remainingIntentJsonSchema>;

export const confirmationLedgerRowSchema = z.strictObject({
  receiptId: idSchema,
  kind: z.string().min(1),
  outcome: confirmationOutcomeSchema.nullable(),
  payloadSummaryJson: z.string().min(2),
  payloadDigest: digestSchema,
  sessionId: idSchema,
  focusId: idSchema.nullable(),
  presentedAt: tsSchema,
  finalizedAt: tsSchema.nullable(),
  downgradeStatus: confirmationDowngradeStatusSchema,
  downgradePayloadJson: z.string().nullable(),
  retryCount: z.number().int().nonnegative(),
  nextRetryAt: tsSchema.nullable(),
  remainingIntentJson: z.string().nullable()
});
export type ConfirmationLedgerRow = z.infer<typeof confirmationLedgerRowSchema>;
