import { describe, expect, it } from "vitest";
import { acceptanceStateForCriterion, humanizeTier1RunEvidence } from "./TaskDetail";

describe("Tier1 run 阻塞原因人话", () => {
  it.each([
    ["subscription_rate_limited", "订阅额度到上限,已停住等待窗口重置"],
    ["auth_required", "Claude 登录已失效,请重新登录后重试"],
    ["binary_identity_mismatch:digest", "执行器文件身份发生变化,请重新自检并重启服务"],
    ["max_turns", "本轮达到最大交互次数,已停住等你处理"]
  ])("%s", (evidence, expected) => {
    expect(humanizeTier1RunEvidence(evidence)).toBe(expected);
  });

  it("未知技术码不直接端给用户", () => {
    expect(humanizeTier1RunEvidence("internal_code:detail")).toBeNull();
  });
});

describe("coding 验收逐条证据", () => {
  const checks = [
    { criterion: "lint", status: "pass" as const, source: "verify" as const, evidenceRef: "verify:lint" },
    { criterion: "人工走查", status: "unknown" as const, source: "manual" as const },
    { criterion: "安全反例", status: "fail" as const, source: "verify" as const, evidenceRef: "verify:security" }
  ];

  it("只采用唯一同名 AcceptanceCheck，不据 settled 状态补绿", () => {
    expect(acceptanceStateForCriterion("lint", checks)).toBe("pass");
    expect(acceptanceStateForCriterion("人工走查", checks)).toBe("unknown");
    expect(acceptanceStateForCriterion("安全反例", checks)).toBe("fail");
    expect(acceptanceStateForCriterion("没有证据", checks)).toBe("unknown");
  });

  it("重复 criterion 视为冲突并回落 unknown", () => {
    expect(acceptanceStateForCriterion("lint", [...checks, checks[0]!])).toBe("unknown");
  });

  it("pass/fail 缺 evidenceRef 时回落 unknown，不展示无证据结论", () => {
    expect(acceptanceStateForCriterion("lint", [{ criterion: "lint", status: "pass", source: "verify" }])).toBe("unknown");
    expect(acceptanceStateForCriterion("lint", [{ criterion: "lint", status: "fail", source: "manual", evidenceRef: "  " }])).toBe("unknown");
  });
});
