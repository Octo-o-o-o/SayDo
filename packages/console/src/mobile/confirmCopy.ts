/** 确认卡动作副文字：按钮副行 ≤12 字，主问题已在标题展示故不复述全文。 */

const MAX_SUBTEXT_CHARS = 12;

export function clipConfirmSubtext(text: string, maxChars = MAX_SUBTEXT_CHARS): string {
  const trimmed = text.replace(/\s+/gu, " ").trim();
  if (trimmed === "") return "";
  const chars = Array.from(trimmed);
  if (chars.length <= maxChars) return trimmed;
  return `${chars.slice(0, maxChars).join("")}…`;
}

/**
 * 「做」副文字：有建议方向或全文过长 →「按建议」；否则 ≤12 字摘要。
 * 主问题已在卡片 h1，副行不再塞 prompt 全文。
 */
export function confirmAcceptSubtext(promptOrTitle: string): string {
  const trimmed = promptOrTitle.replace(/\s+/gu, " ").trim();
  if (trimmed === "") return "按建议";
  const chars = Array.from(trimmed);
  if (chars.length > MAX_SUBTEXT_CHARS) return "按建议";
  // 短标题本身即摘要
  return trimmed;
}

export const CONFIRM_REJECT_SUBTEXT = "不按这个来";
export const CONFIRM_WITHDRAW_SUBTEXT = "当我没问过";
