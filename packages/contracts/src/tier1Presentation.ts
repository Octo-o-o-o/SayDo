import { z } from "zod";

/** Tier1 run 终态审计 action 单源；任务详情只认这三种可与 run.state 对账的终态证据。 */
export const TIER1_TERMINAL_AUDIT_ACTIONS = ["tier1.settled_review", "tier1.failed", "tier1.blocked"] as const;
export const tier1TerminalAuditActionSchema = z.enum(TIER1_TERMINAL_AUDIT_ACTIONS);
export type Tier1TerminalAuditAction = z.infer<typeof tier1TerminalAuditActionSchema>;

/**
 * Tier1 终止原因的用户可见单源(docs/10 §3.4)。
 * 未登记的技术码返回 null，调用方只能展示通用话术或留在技术详情，不能直接口播。
 */
export function renderTier1BlockedReason(exitEvidence: unknown): string | null {
  if (typeof exitEvidence !== "string" || exitEvidence === "") return null;
  if (exitEvidence.startsWith("subscription_rate_limited")) return "订阅额度到上限,已停住等待窗口重置";
  if (exitEvidence.startsWith("auth_required")) return "Claude 登录已失效,请重新登录后重试";
  if (exitEvidence.startsWith("binary_identity_mismatch")) return "执行器文件身份发生变化,请重新自检并重启服务";
  if (exitEvidence.startsWith("max_turns")) return "本轮达到最大交互次数,已停住等你处理";
  return null;
}
