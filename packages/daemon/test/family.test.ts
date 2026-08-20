// familyFromModelName 前缀表核验(cursor --list-models 实际模型 + 常见 api 模型)。
// 防回归:异族校验/observedModel 族断言都依赖它,误判会致合法配置被误拒或谎报漏过。

import { describe, expect, it } from "vitest";
import { familyFromModelName, sameFamilyCliDowngradeDisplay, sameFamilyCliDowngradeNote } from "../src/config/family.js";

describe("familyFromModelName", () => {
  it("cursor --list-models 实际模型(2026-07-25)家族解析正确", () => {
    expect(familyFromModelName("sonnet-4.5")).toBe("claude");
    expect(familyFromModelName("sonnet-4.5-thinking")).toBe("claude");
    expect(familyFromModelName("opus-4.1")).toBe("claude");
    expect(familyFromModelName("haiku-4.5")).toBe("claude");
    expect(familyFromModelName("gpt-5")).toBe("gpt");
    expect(familyFromModelName("gpt-5-codex")).toBe("gpt");
    expect(familyFromModelName("grok")).toBe("grok");
    expect(familyFromModelName("deepseek-v3.1")).toBe("deepseek");
    expect(familyFromModelName("deepseek-r1")).toBe("deepseek");
  });

  it("vendor 前缀段(网关模型名)解析正确", () => {
    expect(familyFromModelName("openai/gpt-4o-mini")).toBe("gpt");
    expect(familyFromModelName("anthropic/claude-sonnet-5")).toBe("claude");
    expect(familyFromModelName("google/gemini-2.5-flash")).toBe("gemini");
    expect(familyFromModelName("deepseek/deepseek-chat")).toBe("deepseek");
  });

  it("cursor 订阅历史模型名(fable/luna)仍可解析", () => {
    expect(familyFromModelName("claude-fable-5-thinking-max")).toBe("claude");
    expect(familyFromModelName("gpt-5.6-luna")).toBe("gpt");
  });

  it("cursor- 供应商前缀剥一层后按裸名重解析;composer 独立成族", () => {
    expect(familyFromModelName("cursor-grok-4.6-high-fast")).toBe("grok");
    expect(familyFromModelName("composer-2.5-fast")).toBe("composer");
    expect(familyFromModelName("cursor-composer-2.5-fast")).toBe("composer");
    expect(familyFromModelName("cursor-fable-5")).toBe("claude");
  });

  it("解析不出返回 null(fail-closed 由调用方决定)", () => {
    expect(familyFromModelName("mystery-model-x")).toBeNull();
    expect(familyFromModelName("cursor-mystery-x")).toBeNull();
    expect(familyFromModelName("cursor-")).toBeNull();
  });

  it("显示名空格分隔时走词级兜底,乱名仍 null", () => {
    expect(familyFromModelName("Cursor Grok 4.6 High Fast")).toBe("grok");
    expect(familyFromModelName("Composer 2.5 Fast")).toBe("composer");
    expect(familyFromModelName("Cursor Composer 2.5 Fast")).toBe("composer");
    expect(familyFromModelName("GPT 5.6 Sol")).toBe("gpt");
    expect(familyFromModelName("Sonnet 5 300K High No Thinking")).toBe("claude");
    expect(familyFromModelName("Totally Mystery High Fast")).toBeNull();
  });
});

describe("sameFamilyCliDowngradeNote", () => {
  it("同族 requested≠observed 给出降级说明;同名/异族/缺字段不编", () => {
    expect(sameFamilyCliDowngradeNote("claude-fable-5", "claude-opus-4-8")).toBe(
      "CLI 将 claude-fable-5 降级为 claude-opus-4-8(通常是订阅限流),同族仍生效"
    );
    expect(sameFamilyCliDowngradeNote("claude-fable-5", "claude-fable-5")).toBeUndefined();
    expect(sameFamilyCliDowngradeNote("claude-fable-5", "gpt-5.6-luna")).toBeUndefined();
    expect(sameFamilyCliDowngradeNote("claude-fable-5", undefined)).toBeUndefined();
    expect(sameFamilyCliDowngradeNote(undefined, "claude-opus-4-8")).toBeUndefined();
  });
});

describe("sameFamilyCliDowngradeDisplay", () => {
  it("自检说明列用实际 observed + requested 被降级", () => {
    expect(sameFamilyCliDowngradeDisplay("claude-fable-5", "claude-opus-4-8")).toBe(
      "实际 claude-opus-4-8(claude-fable-5 被 CLI 降级)"
    );
    expect(sameFamilyCliDowngradeDisplay("claude-fable-5", "claude-fable-5")).toBeUndefined();
    expect(sameFamilyCliDowngradeDisplay("claude-fable-5", "gpt-5.6-luna")).toBeUndefined();
  });
});
