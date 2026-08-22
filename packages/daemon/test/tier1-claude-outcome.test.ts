import { describe, expect, it } from "vitest";
import { isRateRejectStatus,
  buildTier1SubscriptionCostEntry,
  classifyClaudeRunOutcome
} from "../src/tier1/claudeOutcome.js";

describe("classifyClaudeRunOutcome", () => {
  const cases: Array<{
    name: string;
    result?: Parameters<typeof classifyClaudeRunOutcome>[0];
    rates?: Parameters<typeof classifyClaudeRunOutcome>[1];
    stderr?: string;
    exit?: number;
    abort?: { kind: string } | null;
    action: string;
    reason?: string;
  }> = [
    { name: "success settle", result: { subtype: "success", isError: false }, action: "settle" },
    { name: "error_max_turns", result: { subtype: "error_max_turns", isError: true, terminalReason: "max_turns" }, action: "failed", reason: "max_turns" },
    { name: "terminal_reason max_turns", result: { subtype: "success", terminal_reason: "max_turns" }, action: "failed", reason: "max_turns" },
    {
      name: "rate limited blocked",
      result: { subtype: "error_during_execution", isError: true },
      rates: [{ status: "rejected" }],
      action: "blocked",
      reason: "subscription_rate_limited"
    },
    {
      name: "Login expired",
      result: { isError: true },
      stderr: "Login expired",
      exit: 1,
      action: "blocked",
      reason: "auth_required"
    },
    {
      name: "Please run /login",
      stderr: "Please run /login",
      exit: 1,
      action: "blocked",
      reason: "auth_required"
    },
    {
      name: "resume_not_found",
      result: { subtype: "error_during_execution", isError: true },
      stderr: "No conversation found with session ID: x",
      exit: 1,
      action: "failed",
      reason: "resume_not_found"
    },
    { name: "143+abort cancel", exit: 143, abort: { kind: "cancel" }, action: "cancel" },
    { name: "143 no abort", exit: 143, abort: null, action: "failed", reason: "agent_killed_externally" },
    { name: "agent_exit 2", result: { subtype: "error_during_execution", isError: true }, exit: 2, action: "failed", reason: "agent_exit:2" },
    { name: "success despite empty rates", result: { subtype: "success" }, rates: [{ status: "allowed" }], action: "settle" },
    { name: "unknown exit 1", exit: 1, action: "failed", reason: "agent_exit:1" }
  ];

  it.each(cases)("$name", (row) => {
    const d = classifyClaudeRunOutcome(row.result, row.rates ?? [], row.stderr ?? "", row.exit ?? 0, row.abort);
    expect(d.action).toBe(row.action);
    if (row.reason) expect((d as { reason?: string }).reason).toBe(row.reason);
  });
});

describe("buildTier1SubscriptionCostEntry", () => {
  it("requests===1 amount null known 0 source subscription", () => {
    const e = buildTier1SubscriptionCostEntry({
      usage: { input_tokens: 4, output_tokens: 2, cache_read_input_tokens: 1, cache_creation_input_tokens: 3 },
      numTurns: 2,
      modelUsage: { "claude-sonnet-5": { inputTokens: 4 } },
      totalCostUsdEstimate: 0.01,
      model: "opus"
    });
    expect(e.kind).toBe("tier1.run");
    expect(e.source).toBe("subscription");
    expect(e.amount).toBeNull();
    expect(e.known).toBe(0);
    expect(e.requests).toBe(1);
    expect(e.meta.input_tokens).toBe(4);
    expect(e.meta.num_turns).toBe(2);
    expect(e.meta.usage_unavailable).toBeUndefined();
  });

  it("usage_unavailable 时四键 0 且并存", () => {
    const e = buildTier1SubscriptionCostEntry({ usageUnavailable: true, numTurns: 3 });
    expect(e.requests).toBe(1);
    expect(e.meta.usage_unavailable).toBe(true);
    expect(e.meta.input_tokens).toBe(0);
    expect(e.meta.output_tokens).toBe(0);
    expect(e.meta.cached_input_tokens).toBe(0);
    expect(e.meta.cache_creation_input_tokens).toBe(0);
    expect(e.meta.num_turns).toBe(3);
  });

  it("缺 usage 视为 0", () => {
    const e = buildTier1SubscriptionCostEntry({});
    expect(e.meta.input_tokens).toBe(0);
    expect(e.requests).toBe(1);
  });

  it("不 INSERT:只返回纯对象", () => {
    const e = buildTier1SubscriptionCostEntry({ taskId: "t1", runId: "r1" });
    expect("id" in e).toBe(false);
    expect(e.meta.taskId).toBe("t1");
  });
});

describe("isRateRejectStatus(评审 92:按实测枚举精确匹配,不做自然语言分词)", () => {
  it("枚举内的拒绝态命中(大小写与前后空白归一)", () => {
    for (const s of ["rejected", "rate_limited", "RATE_LIMITED", " exhausted ", "quota_exceeded", "blocked"]) {
      expect(isRateRejectStatus(s)).toBe(true);
    }
  });

  it("真实 fixture 的 allowed 不命中", () => {
    expect(isRateRejectStatus("allowed")).toBe(false);
  });

  it("前三版分词方案各自漏掉的形态,现在一律不命中(未知串不判限流)", () => {
    for (const s of [
      "unlimited",        // v1 裸子串误判
      "not_limited",      // v2 整词误判
      "quota_not_exceeded",
      "not_rate_limited", // v3 否定前缀方案仍漏(否定词不与拒绝词相邻)
      "not_quota_exceeded",
      "unblocked",
      "active",
      ""
    ]) {
      expect(isRateRejectStatus(s)).toBe(false);
    }
  });

  it("枚举外的复合串不再靠猜(要支持须补枚举 + 补 fixture)", () => {
    expect(isRateRejectStatus("rate_limited_not_cached")).toBe(false);
    expect(isRateRejectStatus("not_cached_but_limited")).toBe(false);
  });
});
