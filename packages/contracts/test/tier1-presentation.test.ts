import { describe, expect, it } from "vitest";
import { renderTier1BlockedReason, tier1TerminalAuditActionSchema } from "../src/tier1Presentation.js";

describe("renderTier1BlockedReason", () => {
  it.each([
    ["subscription_rate_limited", "订阅额度到上限,已停住等待窗口重置"],
    ["auth_required:expired", "Claude 登录已失效,请重新登录后重试"],
    ["binary_identity_mismatch:digest", "执行器文件身份发生变化,请重新自检并重启服务"],
    ["max_turns:80", "本轮达到最大交互次数,已停住等你处理"]
  ])("%s", (evidence, expected) => {
    expect(renderTier1BlockedReason(evidence)).toBe(expected);
  });

  it("未知技术码不外显", () => {
    expect(renderTier1BlockedReason("private_internal_code:/secret/path")).toBeNull();
    expect(renderTier1BlockedReason(null)).toBeNull();
  });
});

describe("tier1TerminalAuditActionSchema", () => {
  it("只接受可与 Tier1 run 终态逐一对账的 canonical action", () => {
    expect(tier1TerminalAuditActionSchema.options).toEqual(["tier1.settled_review", "tier1.failed", "tier1.blocked"]);
    expect(tier1TerminalAuditActionSchema.safeParse("tier1.run_completed").success).toBe(false);
  });
});
