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

const RATE_REJECT = /rejected|exhausted|limited|exceeded|blocked/i;

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

  const rateReject = rateLimitEvents.some((e) => typeof e.status === "string" && RATE_REJECT.test(e.status));
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
