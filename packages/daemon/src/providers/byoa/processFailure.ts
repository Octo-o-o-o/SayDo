// CLI 非零退出死因解析:把 ActionRequiredError / 用量上限 / 认证类错误转成人话,
// 未知错误保留退出码 + stderr 尾行。供 self-test 槽位说明透传(L25 / P6a 话术分因同族)。
// 流作废(tripwire / unknown_event / family_mismatch)也走同族分因,避免诊断被同一句「安全终止」带偏。

export type CliProcessFailureKind = "usage_limit" | "auth" | "unknown";

export interface CliProcessFailureExplanation {
  kind: CliProcessFailureKind;
  code: "subscription_rate_limited" | "auth_required" | "process_exit";
  message: string;
}

const USAGE_RE =
  /(?:ActionRequiredError[^\n]{0,160})?(?:you(?:'ve| have) (?:hit|reached|exceeded)[^\n]{0,60}limit|usage limit|spend limit)/i;
const RESET_RE = /resets?(?:\s+on)?\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i;
const AUTH_RE =
  /not logged|unauthoriz|authentication (?:expired|invalid|required)|login required|login expired|please (?:log|sign) in|please run \/login|credential(?:s)? (?:missing|invalid|expired)/i;
const RATE_OR_QUOTA_RE = /(?:rate|usage|spend)[_ -]?limit|quota exceeded/i;

function lastNonEmptyLine(text: string): string {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  return lines.at(-1) ?? "";
}

function evidenceText(input: { stderrTail: string; lines?: readonly string[] }): string {
  return [input.stderrTail, ...(input.lines ?? [])].filter((part) => part.trim().length > 0).join("\n");
}

function formatResetDate(raw: string): string {
  const match = raw.match(/^(\d{1,2}\/\d{1,2})(?:\/\d{2,4})?$/);
  return match?.[1] ?? raw;
}

function providerLabel(provider: string): string {
  if (provider === "cursor_cli") return "Cursor";
  if (provider === "codex_cli") return "Codex";
  if (provider === "claude_cli") return "Claude";
  if (provider === "grok_cli") return "Grok";
  return "该 CLI";
}

/** BYOA 流作废人话(P6a 同族):tripwire / unknown_event / family_mismatch 必须分因。 */
export function explainByoaVoidReason(
  reason: string,
  source: "safety_stop" | "consume" = "consume",
  observedModel?: string
): string {
  if (reason === "tripwire") return "CLI 尝试调用工具,已终止";
  if (reason === "unknown_event") return "CLI 输出了无法识别的内容,这次结果作废(保守处理)";
  if (reason === "cli_error") return "CLI 返回错误终态(通常是用量受限或拒答)";
  if (reason === "family_mismatch") {
    return observedModel
      ? `CLI 实际运行的模型与配置家族不符(观测到 ${observedModel})`
      : "CLI 实际运行的模型与配置家族不符";
  }
  return source === "safety_stop" ? "CLI 流式输出触发安全终止" : "CLI 输出未通过安全校验";
}

/** 把 CLI 进程失败解析成槽位可展示的人话;未知则保留退出码与 stderr 尾行。 */
export function explainCliProcessFailure(
  provider: string,
  input: { exitCode?: number | null; stderrTail: string; lines?: readonly string[] }
): CliProcessFailureExplanation {
  const evidence = evidenceText(input);
  if (USAGE_RE.test(evidence)) {
    const resetRaw = evidence.match(RESET_RE)?.[1];
    const resetPart = resetRaw ? `,${formatResetDate(resetRaw)} 重置` : "";
    const spend =
      provider === "cursor_cli" ? "——换一家或去 Cursor 设置 Spend Limit" : "——换一家或等额度重置";
    return {
      kind: "usage_limit",
      code: "subscription_rate_limited",
      message: `${providerLabel(provider)} 本月用量已到上限${resetPart}${spend}`
    };
  }
  // 认证类只在没有额度/限流措辞时认:混写 "auth + rate limit" 的普通进程错误必须保留退出码。
  if (AUTH_RE.test(evidence) && !RATE_OR_QUOTA_RE.test(evidence)) {
    return {
      kind: "auth",
      code: "auth_required",
      message: "CLI 登录已失效或未登录,请重新登录后再试"
    };
  }
  const tail = lastNonEmptyLine(input.stderrTail);
  const exitCode = typeof input.exitCode === "number" ? input.exitCode : 1;
  return {
    kind: "unknown",
    code: "process_exit",
    message: tail ? `CLI 进程退出码 ${exitCode}: ${tail}` : `CLI 进程退出码 ${exitCode}`
  };
}
