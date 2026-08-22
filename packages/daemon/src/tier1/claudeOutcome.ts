import { explainCliProcessFailure } from "../providers/byoa/processFailure.js";

export type ClaudeRunDisposition =
  | { action: "settle" }
  | { action: "failed"; reason: string }
  | { action: "blocked"; reason: "subscription_rate_limited" | "auth_required" }
  | { action: "cancel" };

export interface ClaudeResultLike {
  subtype?: string;
  isError?: boolean;
  is_error?: boolean;
  terminalReason?: string;
  terminal_reason?: string;
}

export interface RateLimitLike {
  status?: string;
}

/**
 * 限流拒绝态判定:**按实测枚举精确匹配**,不做自然语言分词。
 *
 * 演进与教训(评审 90/91/92 三轮):
 *  1. 最初裸子串 `/rejected|exhausted|limited|exceeded|blocked/` —— `unlimited` 被误判为限流;
 *  2. 改整词切分 —— `not_limited` / `quota_not_exceeded` 仍被误判(字面语义恰好相反);
 *  3. 加否定前缀消解 —— `not_rate_limited` 仍漏(否定词不与拒绝词相邻);
 *  4. **现版:枚举白名单**。前三版都在给一个凭空构造的语法打补丁——
 *     仓内唯一真实 fixture(`fixtures/claude-cli/2.1.220/rate_limit.jsonl`)的
 *     `rate_limit_info.status` 只出现 `"allowed"`,`"rejected"` 出现在**另一个字段** `overageStatus`。
 *     也就是说那套分词从来没有证据支撑,只会制造误判。
 *
 * 判定规则:归一化(去空白、转小写)后落在拒绝枚举内才算拒绝。**未知串一律不判限流**——
 * 限流会把任务转 blocked 叫人,误判的代价是白挂;真限流另有 result 层
 * `isCliSubscriptionRateLimit` 与 stderr 兜底,不靠这一条独木。
 * 新 vendor 枚举出现时,**补进这张表并同批补 fixture**,不要回退成模糊匹配。
 */
const RATE_REJECT_STATUS = new Set([
  "rejected",
  "exhausted",
  "rate_limited",
  "quota_exceeded",
  "blocked",
  "limit_exceeded",
  "usage_limit_reached"
]);

export function isRateRejectStatus(status: string): boolean {
  return RATE_REJECT_STATUS.has(status.trim().toLowerCase());
}

export function classifyClaudeRunOutcome(
  result: ClaudeResultLike | undefined,
  rateLimitEvents: readonly RateLimitLike[],
  stderrTail: string,
  exitCode: number,
  abort: { kind: string } | null | undefined
): ClaudeRunDisposition {
  const subtype = result?.subtype ?? "";
  const isError = result?.isError === true || result?.is_error === true;
  const terminal = result?.terminalReason ?? result?.terminal_reason ?? "";

  if (subtype === "error_max_turns" || terminal === "max_turns") {
    return { action: "failed", reason: "max_turns" };
  }

  const rateReject = rateLimitEvents.some((e) => typeof e.status === "string" && isRateRejectStatus(e.status));
  const auth = explainCliProcessFailure("claude_cli", { exitCode, stderrTail });
  if (isError && (rateReject || auth.code === "subscription_rate_limited")) {
    return { action: "blocked", reason: "subscription_rate_limited" };
  }
  if (auth.code === "auth_required" || /login expired|please run \/login/i.test(stderrTail)) {
    return { action: "blocked", reason: "auth_required" };
  }
  if (
    (subtype === "error_during_execution" || isError) &&
    /No conversation found/i.test(stderrTail)
  ) {
    return { action: "failed", reason: "resume_not_found" };
  }

  if (exitCode === 143 && abort) {
    return { action: "cancel" };
  }
  if (exitCode === 143 && !abort) {
    return { action: "failed", reason: "agent_killed_externally" };
  }

  if (subtype === "success" && !isError) {
    return { action: "settle" };
  }

  return { action: "failed", reason: `agent_exit:${exitCode}` };
}

export interface Tier1SubscriptionCostInput {
  taskId?: string;
  runId?: string;
  adapter?: string;
  model?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  modelUsage?: unknown;
  numTurns?: number;
  totalCostUsdEstimate?: number;
  usageUnavailable?: boolean;
}

export function buildTier1SubscriptionCostEntry(input: Tier1SubscriptionCostInput): {
  kind: "tier1.run";
  source: "subscription";
  amount: null;
  known: 0;
  requests: 1;
  meta: Record<string, unknown>;
} {
  const unavailable = input.usageUnavailable === true;
  const u = input.usage ?? {};
  const inputTokens = unavailable ? 0 : (u.input_tokens ?? 0);
  const outputTokens = unavailable ? 0 : (u.output_tokens ?? 0);
  const cacheRead = unavailable ? 0 : (u.cache_read_input_tokens ?? 0);
  const cacheWrite = unavailable ? 0 : (u.cache_creation_input_tokens ?? 0);
  return {
    kind: "tier1.run",
    source: "subscription",
    amount: null,
    known: 0,
    requests: 1,
    meta: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cached_input_tokens: cacheRead,
      cache_creation_input_tokens: cacheWrite,
      ...(input.modelUsage !== undefined ? { modelUsage: input.modelUsage } : {}),
      ...(input.numTurns !== undefined ? { num_turns: input.numTurns } : {}),
      ...(input.totalCostUsdEstimate !== undefined
        ? { total_cost_usd_estimate: input.totalCostUsdEstimate }
        : {}),
      ...(unavailable ? { usage_unavailable: true } : {}),
      ...(input.model ? { model: input.model } : {}),
      ...(input.adapter ? { adapter: input.adapter } : {}),
      ...(input.taskId ? { taskId: input.taskId } : {}),
      ...(input.runId ? { runId: input.runId } : {})
    }
  };
}
