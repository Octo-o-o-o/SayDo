// docs/09 §13 Brain 工具契约的共享载荷类型(TaskView / Decision / AcceptanceCheck / 统一错误)。
// 工具 handler 在 daemon(1.3b);命名统一 camelCase(§13 注)。

import { z } from "zod";
import { idSchema } from "../ids.js";
import { tsSchema } from "./common.js";

/** 统一错误形状(§13:错误统一 { ok:false, code, message, retryable }) */
export const toolErrorSchema = z.strictObject({
  ok: z.literal(false),
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean()
});
export type ToolError = z.infer<typeof toolErrorSchema>;

/** TaskView 最小字段(§13,Codex 复审 B3 定形;status 用 §7 用户语词表承载) */
export const taskViewSchema = z.strictObject({
  taskId: idSchema,
  title: z.string(),
  status: z.string(), // §7 用户语词表(呈现层);机器态见 TaskCard.status
  attempt: z.number().int().positive(),
  elapsedActiveMs: z.number().int().nonnegative(), // 活跃墙钟,停靠停表
  currentStep: z.strictObject({ seq: z.number().int().positive(), name: z.string() }).optional(),
  budget: z.strictObject({
    spentKnown: z.number().nonnegative().optional(),
    max: z.number().positive(),
    subscriptionCalls: z.number().int().nonnegative().optional()
  }),
  lastEventOneLiner: z.string(),
  asOf: tsSchema
});
export type TaskView = z.infer<typeof taskViewSchema>;

export const decisionSchema = z.strictObject({
  what: z.string().min(1),
  why: z.string().min(1),
  overridable: z.literal(true)
});
export type Decision = z.infer<typeof decisionSchema>;

/** AcceptanceCheck(§13 A3 结果合同):逐条验收标准对账,绑不上诚实标 unknown */
export const acceptanceCheckSchema = z.strictObject({
  criterion: z.string().min(1),
  status: z.enum(["pass", "fail", "unknown"]),
  evidenceRef: z.string().optional(),
  source: z.enum(["verify", "agent_claim", "manual"])
});
export type AcceptanceCheck = z.infer<typeof acceptanceCheckSchema>;

export const readinessVerdictSchema = z.enum(["ready", "gap_knowledge", "gap_requirement", "gap_critical"]);
export type ReadinessVerdict = z.infer<typeof readinessVerdictSchema>;

// content_done = writing/非 coding 成稿完成(09 §6.1a/§13;R-A 2026-07-26;10 §5 完成话术分支)
export const explainKindSchema = z.enum(["coding_done", "content_done", "blocked", "failed", "unknown"]);
export type ExplainKind = z.infer<typeof explainKindSchema>;

export const steerAppliedSchema = z.enum(["live", "cancel_resume", "queued_delta"]);
export type SteerApplied = z.infer<typeof steerAppliedSchema>;
