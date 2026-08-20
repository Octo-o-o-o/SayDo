/** 移动端 toast 人话：禁机房腔，带内容摘要与可证明去向。 */

export function summarizeForToast(text: string, maxChars = 20): string {
  const trimmed = text.replace(/\s+/gu, " ").trim();
  if (trimmed === "") return "";
  const chars = Array.from(trimmed);
  if (chars.length <= maxChars) return trimmed;
  return `${chars.slice(0, maxChars).join("")}…`;
}

/** 发送成功：已发送:"摘要" */
export function sentToast(text: string): string {
  const summary = summarizeForToast(text, 20);
  return summary === "" ? "已发送" : `已发送:"${summary}"`;
}

/** 发送失败人话（保留草稿语义由调用方决定）。 */
export function sendFailedToast(kind: "offline" | "busy" | "unknown" = "unknown"): string {
  if (kind === "offline") return "还没发出去，等连接恢复后再试。";
  if (kind === "busy") return "上一条还在路上，请稍等一下。";
  return "还没发出去，草稿给你留着了。";
}

export type ConfirmSettlementDecision = "accept" | "reject" | "withdraw";

/**
 * 拍板回执 toast。去向只消费调用方已证明的字段。
 * destination 有则拼「已确认·{destination}」；无则「已确认·已记账」。
 * 确认卡常见去向「记入记忆库」→「已确认·记入记忆库」。
 */
export function confirmSettlementToast(
  decision: ConfirmSettlementDecision,
  destination?: string | null
): string {
  if (decision === "reject") return "已拒绝·不按这个来";
  if (decision === "withdraw") return "已撤下·当没问过";
  const dest = destination?.replace(/\s+/gu, " ").trim();
  if (dest) {
    const short = summarizeForToast(dest, 12);
    return `已确认·${short}`;
  }
  return "已确认·已记账";
}

/** 从 attention 可证明字段推导拍板去向文案（无则 null，不造假）。 */
export function confirmDestinationHint(input: {
  focusTitle?: string | null;
  needs?: string | null;
  sourceKind?: string | null;
}): string | null {
  const focus = input.focusTitle?.trim();
  if (focus) return `归入「${summarizeForToast(focus, 10)}」`;
  if (input.needs === "decision") return "方向已拍板";
  // 确认卡 consumed → 可证去向「记入记忆库」(记忆库入口已消费同源只读 API)
  if (input.sourceKind === "confirmation") return "记入记忆库";
  return null;
}
