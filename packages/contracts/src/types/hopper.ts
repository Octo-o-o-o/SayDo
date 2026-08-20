// P0.5-A A3/A4 契约封闭:Hopper 真实 14 值枚举 + total mapping 输入 + CancelProof + MutationResult。
// SoT:09 §7(裁决 §2.3.3 投影推导表)/ §6.2(MutationResult 五状态,expired != 失败)/ §6.3(RunSettled)。

import { z } from "zod";
import { digestSchema, tsSchema } from "./common.js";

/** Hopper task 层真实 14 值枚举(裁决 §2.3.3;task 层无 cancelled——failed+cancelled_by_user 承载) */
export const hopperTaskStateSchema = z.enum([
  "received",
  "ready",
  "draft",
  "plan_needed",
  "research",
  "deferred",
  "conflict",
  "blocked",
  "running",
  "review",
  "done",
  "failed",
  "rejected",
  "archived"
]);
export type HopperTaskState = z.infer<typeof hopperTaskStateSchema>;

/** RunSettled 事件载荷(Hopper baseline.2;§6.3——payload 单写者自报,消费方廉价复核) */
export const runSettledSchema = z.strictObject({
  final_status: z.enum(["review", "failed", "blocked"]),
  runner_status: z.string().optional(),
  runner_outcome: z.string().optional(),
  evidence_digest: z.string().nullable().optional(),
  summary_path: z.string().nullable().optional(),
  run_dir: z.string().optional(),
  recovery: z.boolean().optional() // dead-owner 兜底 emit 标志
});
export type RunSettled = z.infer<typeof runSettledSchema>;

/** Hopper 路径二取消证明(A4:cancel settled 判据统一 = RunSettled 出现;旧 RunnerFinished 判据废弃) */
export const hopperCancelProofSchema = z.strictObject({
  taskId: z.string().min(1), // Hopper 侧 task id(非 SayDo id 域)
  runSettled: runSettledSchema,
  /** 事件流游标(晚到事件判历史) */
  lastEventId: z.string().min(1),
  settledAt: tsSchema
});
export type HopperCancelProof = z.infer<typeof hopperCancelProofSchema>;

/** MutationResult 五状态(裁决 §2.5;09 §6.2):expired != 失败——请求保留,轮询 result.json 或按业务事实对账 */
export const mutationResultStatusSchema = z.enum(["applied", "duplicate", "conflict", "expired", "failed"]);
export type MutationResultStatus = z.infer<typeof mutationResultStatusSchema>;

export const mutationResultSchema = z.strictObject({
  status: mutationResultStatusSchema,
  reqId: z.string().optional(),
  message: z.string().optional()
});
export type MutationResult = z.infer<typeof mutationResultSchema>;

/** retryability 表(A3 关闭标准的机械面):盲重试只允许 failed;expired 走对账不重发;conflict 先重读再决策 */
export const MUTATION_RETRYABILITY: Record<MutationResultStatus, "no" | "reconcile" | "reread_then_decide" | "retry"> = {
  applied: "no",
  duplicate: "no", // 幂等已生效(注:drop 三级去重的 duplicate_ignored 属 dropOutcome 域,不落 MutationResult)
  conflict: "reread_then_decide",
  expired: "reconcile", // != 失败:轮询 .hopper/requests/<req_id>.result.json 或业务对账
  failed: "retry"
};

/** dispatch 注释行(A3 幂等锚:授权变 => 正文 hash 变,绝不落 duplicate_ignored) */
export function buildDispatchComment(dispatchId: string, revision: number, digest: string): string {
  return `<!-- saydo:dispatch ${dispatchId} rev=${revision} digest=${digest} -->`;
}

export function parseDispatchComment(line: string): { dispatchId: string; revision: number; digest: string } | null {
  const m = /^<!-- saydo:dispatch (\S+) rev=(\d+) digest=(\S+) -->$/.exec(line.trim());
  if (!m) return null;
  return { dispatchId: m[1] as string, revision: Number(m[2]), digest: m[3] as string };
}

export const dispatchCommentDigestSchema = digestSchema;
