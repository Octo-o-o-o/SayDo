// owner 2026-07-25 裁定:dev 期只用 cursor 一家(思考 Claude 族 / 评估 GPT 族,异族成立)。
// cursor 流带 model 字段(system.init),observedModel 严格口径天然满足,不依赖 ADR-002 豁免。

import { describe, expect, it } from "vitest";
import { parseConfigText } from "../src/config/load.js";
import { validateConfig } from "../src/config/validate.js";

describe("dev 只用 cursor 一家(owner 2026-07-25)", () => {
  it("thinking=cursor sonnet-4.5-thinking(Claude)/evaluator=cursor gpt-5(GPT) 异族成立 + 校验通过", () => {
    const c = parseConfigText([
      "[models]",
      'profile = "dev"',
      'dialog = { provider = "api", via = "openrouter", model = "google/gemini-2.5-flash" }',
      'thinking = { provider = "cursor_cli", model = "sonnet-4.5-thinking" }',
      'cheap = { provider = "api", via = "openrouter", model = "google/gemini-2.5-flash-lite" }',
      'evaluator = { provider = "cursor_cli", model = "gpt-5" }',
      "[providers.api.openrouter]",
      'base_url = "https://openrouter.ai/api/v1"',
      'api_key = "env:OPENROUTER_API_KEY"'
    ].join("\n"));
    const r = validateConfig({ config: c, env: { SAYDO_DEV: "1" } });
    expect(r.ok).toBe(true);
    expect(r.devMode).toBe(true);
    expect(r.effective?.["thinking"]?.family).toBe("claude");
    expect(r.effective?.["evaluator"]?.family).toBe("gpt");
    expect(r.effective?.["dialog"]?.family).toBe("gemini");
  });
});
