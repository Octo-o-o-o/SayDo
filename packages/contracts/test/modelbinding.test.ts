// ModelBinding 五家扩容:三家 wired accept/round-trip;kimi_cli/opencode_cli 拒(inventory_only)。

import { describe, expect, it } from "vitest";
import {
  costProvenanceSchema,
  isWiredCliProvider,
  modelBindingSchema,
  WIRED_CLI_PROVIDERS
} from "../src/types/modelbinding.js";

describe("WIRED_CLI_PROVIDERS", () => {
  it("含三家新接线,不含 kimi_cli/opencode_cli", () => {
    expect(WIRED_CLI_PROVIDERS).toContain("gemini_cli");
    expect(WIRED_CLI_PROVIDERS).toContain("qwen_cli");
    expect(WIRED_CLI_PROVIDERS).toContain("copilot_cli");
    expect(isWiredCliProvider("kimi_cli")).toBe(false);
    expect(isWiredCliProvider("opencode_cli")).toBe(false);
  });
});

describe("costProvenanceSchema", () => {
  it("只接受三值", () => {
    expect(costProvenanceSchema.safeParse("subscription").success).toBe(true);
    expect(costProvenanceSchema.safeParse("external_api").success).toBe(true);
    expect(costProvenanceSchema.safeParse("unknown").success).toBe(true);
    expect(costProvenanceSchema.safeParse("free").success).toBe(false);
  });
});

describe("modelBindingSchema 新 CLI", () => {
  const wired = [
    { provider: "gemini_cli" as const, model: "gemini-2.5-pro" },
    { provider: "qwen_cli" as const, model: "qwen3-coder-plus" },
    { provider: "copilot_cli" as const, model: "gpt-5.2" }
  ];

  it("三家 wired accept:有 model / 可省 model", () => {
    for (const b of wired) {
      expect(modelBindingSchema.safeParse(b).success).toBe(true);
      expect(modelBindingSchema.safeParse({ provider: b.provider }).success).toBe(true);
    }
  });

  it("三家 wired 拒绝额外字段与空 model", () => {
    for (const b of wired) {
      expect(modelBindingSchema.safeParse({ ...b, extra: true }).success).toBe(false);
      expect(modelBindingSchema.safeParse({ provider: b.provider, model: "" }).success).toBe(false);
    }
  });

  it("三家 wired round-trip 保持 provider/model", () => {
    for (const b of wired) {
      const parsed = modelBindingSchema.parse(b);
      expect(parsed).toEqual(b);
      const again = modelBindingSchema.parse(JSON.parse(JSON.stringify(parsed)));
      expect(again).toEqual(b);
    }
  });

  it("kimi_cli / opencode_cli 拒(未升 wired,不得进 ModelBinding)", () => {
    expect(modelBindingSchema.safeParse({ provider: "kimi_cli", model: "kimi-k3" }).success).toBe(false);
    expect(modelBindingSchema.safeParse({ provider: "opencode_cli", model: "opencode/big-pickle" }).success).toBe(false);
  });
});
