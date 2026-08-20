// §12-9 配置/启动子集(0.4 验收):校验器反例 + dev 双开关 + family 冲突 + 两份模板 TOML 解析与 effective binding。

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseConfigText, mergeConfig, paramValue } from "../src/config/load.js";
import { validateConfig, formatViolations } from "../src/config/validate.js";
import { probeOnce, probeFixHint, type ProbeFn } from "../src/config/probe.js";
import { familyFromModelName } from "../src/config/family.js";

const TEMPLATES = resolve(__dirname, "../../../templates");

function cfg(toml: string) {
  return parseConfigText(toml);
}

const OPENROUTER = `
[providers.api.openrouter]
base_url = "https://openrouter.ai/api/v1"
api_key = "env:OPENROUTER_API_KEY"
`;

describe("familyFromModelName(前缀表)", () => {
  it("vendor 前缀 + 裸名前缀 + cursor(fable/luna)", () => {
    expect(familyFromModelName("openai/gpt-4o-mini")).toBe("gpt");
    expect(familyFromModelName("anthropic/claude-sonnet-5")).toBe("claude");
    expect(familyFromModelName("google/gemini-2.5-flash")).toBe("gemini");
    expect(familyFromModelName("deepseek/deepseek-chat")).toBe("deepseek");
    expect(familyFromModelName("gpt-5.6-sol")).toBe("gpt");
    expect(familyFromModelName("claude-fable-5-thinking-max")).toBe("claude");
    expect(familyFromModelName("gpt-5.6-luna")).toBe("gpt");
    expect(familyFromModelName("cursor-grok-4.6-high-fast")).toBe("grok");
    expect(familyFromModelName("composer-2.5-fast")).toBe("composer");
    expect(familyFromModelName("Cursor Grok 4.6 High Fast")).toBe("grok");
    expect(familyFromModelName("some-unknown-model")).toBeNull();
  });
});

describe("校验器全套(fail-closed)", () => {
  const base = (over: string) =>
    cfg(`
[models]
profile = "default"
dialog = "gpt-5.6-sol"
thinking = "gpt-5.6-sol"
cheap = "gpt-5-mini"
${over}
${OPENROUTER}
`);

  it("gemini/qwen/copilot:有可解析 model 则 family 来自模型名;无 model 则 unknown", () => {
    const withModel = validateConfig({
      config: cfg(`
[models]
profile = "default"
dialog = { provider = "gemini_cli", model = "gemini-2.5-pro" }
thinking = { provider = "qwen_cli", model = "qwen3-coder-plus" }
cheap = { provider = "copilot_cli", model = "gpt-5.2" }
evaluator = { provider = "claude_cli" }
`),
      env: {}
    });
    expect(withModel.ok).toBe(true);
    expect(withModel.effective?.["dialog"]?.family).toBe("gemini");
    expect(withModel.effective?.["thinking"]?.family).toBe("qwen");
    expect(withModel.effective?.["cheap"]?.family).toBe("gpt");

    const noModel = validateConfig({
      config: cfg(`
[models]
profile = "default"
dialog = { provider = "qwen_cli" }
thinking = "gpt-5.6-sol"
cheap = "gpt-5-mini"
evaluator = { provider = "claude_cli" }
`),
      env: { OPENAI_API_KEY: "k" }
    });
    expect(noModel.ok).toBe(true);
    expect(noModel.effective?.["dialog"]?.family).toBe("unknown");
  });

  it("全局 dialog CLI 三形态放行为 oneshot binding", () => {
    for (const line of [
      'dialog = { provider = "codex_cli" }',
      'dialog = { provider = "claude_cli" }',
      'dialog = { provider = "cursor_cli", model = "gpt-5.6-luna" }'
    ]) {
      const r = validateConfig({
        config: cfg(`
[models]
profile = "default"
${line}
thinking = "gpt-5.6-sol"
cheap = "gpt-5-mini"
evaluator = { provider = "claude_cli" }
`),
        env: {}
      });
      expect(r.violations.map((violation) => violation.code)).not.toContain("dialog_must_be_api");
      expect(r.effective?.["dialog"]?.provider).toBe(line.includes("codex") ? "codex_cli" : line.includes("claude") ? "claude_cli" : "cursor_cli");
    }
  });

  it("thinking/cheap CLI 可配置;evaluator 双 ack 齐时给已确认提示", () => {
    const r = validateConfig({
      config: cfg(`
[models]
profile = "default"
evaluator_isolation_ack = true
evaluator_same_family_ack = true
dialog = "gpt-5.6-sol"
thinking = { provider = "codex_cli" }
cheap = { provider = "claude_cli" }
evaluator = { provider = "codex_cli" }
`),
      env: { OPENAI_API_KEY: "k" }
    });
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
    expect(r.hints.map((h) => h.code)).toEqual(["evaluator_cli_acks_confirmed"]);
  });

  it("evaluator 真值表:API 异族武装合法;同族无 ack 拒;同族有 ack 放行", () => {
    const different = validateConfig({
      config: base('evaluator = { provider = "api", via = "openrouter", model = "anthropic/claude-sonnet-5" }'),
      env: { OPENAI_API_KEY: "k", OPENROUTER_API_KEY: "k" }
    });
    expect(different.ok).toBe(true);

    const same = validateConfig({
      config: base('evaluator = { provider = "api", via = "openrouter", model = "openai/gpt-5.6-luna" }'),
      env: { OPENAI_API_KEY: "k", OPENROUTER_API_KEY: "k" }
    });
    expect(same.violations.map((v) => v.code)).toContain("evaluator_same_family");

    const acked = validateConfig({
      config: cfg(`
[models]
profile = "default"
evaluator_same_family_ack = true
dialog = "gpt-5.6-sol"
thinking = "gpt-5.6-sol"
cheap = "gpt-5-mini"
evaluator = { provider = "api", via = "openrouter", model = "openai/gpt-5.6-luna" }
${OPENROUTER}
`),
      env: { OPENAI_API_KEY: "k", OPENROUTER_API_KEY: "k" }
    });
    expect(acked.ok).toBe(true);
    expect(acked.hints.map((h) => h.code)).toContain("evaluator_same_family_acked");
  });

  it("反例:acp 供给 P0 拒", () => {
    const r = validateConfig({
      config: base(`evaluator = { provider = "acp", bin = "/x/acp", model = "claude-sonnet-5" }`),
      env: {}
    });
    expect(r.ok).toBe(false);
    expect(r.violations.map((v) => v.code)).toContain("acp_p0_rejected");
  });

  it("命名端点 family 优先于模型名猜测", () => {
    const r = validateConfig({
      config: cfg(`
[models]
profile = "default"
dialog = { provider = "api", via = "gw", model = "openai/gpt-4o-mini" }
thinking = "gpt-5.6-sol"
cheap = "gpt-5-mini"
evaluator = { provider = "claude_cli", model = "claude-sonnet-5" }
[providers.api.gw]
base_url = "https://x/v1"
api_key = "env:GW_KEY"
family = "claude"
`),
      env: {}
    });
    expect(r.ok).toBe(true);
    expect(r.effective?.["dialog"]?.family).toBe("claude");
  });

  it("反例:api 模型名解析不出且无 family 拒;via 指向未定义端点拒", () => {
    const r1 = validateConfig({
      config: cfg(`
[models]
profile = "default"
dialog = { provider = "api", via = "gw", model = "mystery-model" }
thinking = "gpt-5.6-sol"
cheap = "gpt-5-mini"
evaluator = { provider = "claude_cli", model = "claude-sonnet-5" }
[providers.api.gw]
base_url = "https://x/v1"
api_key = "env:GW_KEY"
`),
      env: {}
    });
    expect(r1.violations.map((v) => v.code)).toContain("model_unresolved");

    const r2 = validateConfig({
      config: cfg(`
[models]
profile = "default"
dialog = { provider = "api", via = "ghost", model = "gpt-5.6-sol" }
thinking = "gpt-5.6-sol"
cheap = "gpt-5-mini"
evaluator = { provider = "claude_cli", model = "claude-sonnet-5" }
`),
      env: {}
    });
    expect(r2.violations.map((v) => v.code)).toContain("named_endpoint_missing");
  });

  it("CLI evaluator 参与 family 校验,模型未知或固定族冲突都拒", () => {
    const r1 = validateConfig({
      config: base(`evaluator = { provider = "cursor_cli", model = "mystery-x" }`),
      env: { SAYDO_DEV: "1" }
    });
    expect(r1.ok).toBe(false);
    expect(r1.violations.map((v) => v.code)).toContain("model_unresolved");

    const r2 = validateConfig({
      config: cfg(`
[models]
profile = "dev"
dialog = "google/gemini-2.5-flash"
thinking = "gpt-5.6-sol"
cheap = "gpt-5-mini"
evaluator = { provider = "codex_cli", model = "claude-sonnet-5" }
${OPENROUTER}
`),
      env: { SAYDO_DEV: "1" }
    });
    expect(r2.ok).toBe(false);
    expect(r2.violations.map((v) => v.code)).toContain("family_conflict");
  });

  it("cursor 预置模型(cursor-grok / composer)staged 校验通过;未知 cursor- 前缀仍拒", () => {
    const staged = validateConfig({
      config: cfg(`
[models]
profile = "default"
evaluator_isolation_ack = true
evaluator_same_family_ack = true
dialog = { provider = "cursor_cli", model = "cursor-grok-4.6-high-fast" }
thinking = { provider = "cursor_cli", model = "cursor-grok-4.6-high-fast" }
cheap = { provider = "cursor_cli", model = "composer-2.5-fast" }
evaluator = { provider = "cursor_cli", model = "cursor-grok-4.6-high-fast" }
`),
      env: {}
    });
    expect(staged.violations.map((v) => v.code)).not.toContain("model_unresolved");
    expect(staged.ok).toBe(true);
    expect(staged.effective?.["dialog"]?.family).toBe("grok");
    expect(staged.effective?.["thinking"]?.family).toBe("grok");
    expect(staged.effective?.["cheap"]?.family).toBe("composer");
    expect(staged.effective?.["evaluator"]?.family).toBe("grok");

    const unknown = validateConfig({
      config: base(`evaluator = { provider = "cursor_cli", model = "cursor-mystery-x" }`),
      env: {}
    });
    expect(unknown.ok).toBe(false);
    expect(unknown.violations.map((v) => v.code)).toContain("model_unresolved");
  });
});

describe("dev 双开关(复评 A1)", () => {
  const devConfig = () =>
    cfg(`
[models]
profile = "dev"
dialog = { provider = "api", via = "openrouter", model = "google/gemini-2.5-flash" }
thinking = { provider = "cursor_cli", model = "claude-fable-5-thinking-max" }
cheap = { provider = "api", via = "openrouter", model = "google/gemini-2.5-flash-lite" }
evaluator = { provider = "codex_cli", model = "gpt-5.6-luna", reasoning = "max" }
${OPENROUTER}
`);

  it("双开关齐全 => dev 生效,CLI 槽参与真实 family 投影", () => {
    const r = validateConfig({ config: devConfig(), env: { SAYDO_DEV: "1" } });
    expect(r.ok).toBe(true);
    expect(r.devMode).toBe(true);
    // dev 缺省配对异族:thinking=claude(cursor fable)/ evaluator=gpt(codex luna)
    expect(r.effective?.["thinking"]?.family).toBe("claude");
    expect(r.effective?.["evaluator"]?.family).toBe("gpt");
    expect(r.effective?.["dialog"]?.family).toBe("gemini");
  });

  it("仅 profile=dev(缺 SAYDO_DEV)=> 按 default 放行 + 提示缺开关和 evaluator 双 ack", () => {
    const r = validateConfig({ config: devConfig(), env: {} });
    expect(r.ok).toBe(true);
    expect(r.devMode).toBe(false);
    expect(r.hints.map((v) => v.code)).toEqual(
      expect.arrayContaining([
        "dev_switch_incomplete",
        "evaluator_same_family_ack_required",
        "evaluator_isolation_ack_required"
      ])
    );
  });

  it("仅 SAYDO_DEV=1(profile=default)=> 按 default 校验 + 提示", () => {
    const c = cfg(`
[models]
profile = "default"
dialog = "gpt-5.6-sol"
thinking = "gpt-5.6-sol"
cheap = "gpt-5-mini"
evaluator = { provider = "codex_cli", model = "gpt-5.6-luna" }
    `);
    const r = validateConfig({ config: c, env: { SAYDO_DEV: "1" } });
    expect(r.ok).toBe(true);
    expect(r.hints.map((v) => v.code)).toEqual(
      expect.arrayContaining([
        "dev_switch_incomplete",
        "evaluator_same_family_ack_required",
        "evaluator_isolation_ack_required"
      ])
    );
  });

  it("单开关 + 配置在 default 下本就合法 => 放行 + 仅提示(提示不硬拒,评审 B5/09 §11)", () => {
    const c = cfg(`
[models]
profile = "default"
dialog = "gpt-5.6-sol"
thinking = "gpt-5.6-sol"
cheap = "gpt-5-mini"
evaluator = { provider = "claude_cli", model = "claude-sonnet-5" }
`);
    const r = validateConfig({ config: c, env: { SAYDO_DEV: "1" } });
    expect(r.ok).toBe(true);
    expect(r.devMode).toBe(false);
    expect(r.hints.map((v) => v.code)).toContain("dev_switch_incomplete");
  });
});

describe("两份模板 TOML 解析与 P0 语音固定配置", () => {
  const envTemplate = readFileSync(resolve(TEMPLATES, "saydo.env.example"), "utf8");

  it("语音模板与当前 ASR/TTS 实现一致", () => {
    const configs = ["saydo.config.example.toml", "saydo.config.dev.example.toml"].map((name) =>
      readFileSync(resolve(TEMPLATES, name), "utf8")
    );
    expect(envTemplate).toContain("VOLC_APP_ID=");
    expect(envTemplate).toContain("VOLC_ACCESS_TOKEN=");
    expect(envTemplate).not.toContain("VOLC_API_KEY");
    for (const text of configs) {
      expect(text).toContain('asr    = "volc"');
      expect(text).toContain('tts    = "volc"');
      expect(text).not.toContain("[voice.tts]");
      expect(text).not.toContain("[secrets]");
      expect(text).not.toContain("zh_female_jitangmei_uranus_bigtts");
      expect(text).not.toContain("VOLC_API_KEY");
    }
    expect(envTemplate).toContain("DOUBAO_TTS_API_KEY=");
  });

  it("saydo.config.example.toml(default)解析 + 校验通过", () => {
    const c = parseConfigText(readFileSync(resolve(TEMPLATES, "saydo.config.example.toml"), "utf8"));
    // 缺省模板:四个推理槽均为 API,dialog/thinking=gpt、cheap=gemini、evaluator=claude。
    const r = validateConfig({ config: c, env: {} });
    expect(r.ok).toBe(true);
    expect(r.effective?.["evaluator"]?.family).toBe("claude");
    expect(r.violations.length).toBe(0);
    expect(c.models.dev?.agent).toBe("cursor");
    expect(c.models.dev?.transport).toBe("cli");
  });

  it("saydo.config.dev.example.toml(dev)解析 + 双开关下校验通过", () => {
    const c = parseConfigText(readFileSync(resolve(TEMPLATES, "saydo.config.dev.example.toml"), "utf8"));
    const r = validateConfig({ config: c, env: { SAYDO_DEV: "1" } });
    expect(r.ok).toBe(true);
    expect(r.devMode).toBe(true);
    expect(c.models.dev?.agent).toBe("cursor");
    expect(c.models.dev?.transport).toBe("cli");
    expect(c.models.evaluator_same_family_ack).toBe(true);
    expect(c.models.evaluator_isolation_ack).toBe(true);
  });

  it("owner 已落的 ~/.saydo/config.toml 若存在也应可解析(容错跳过)", () => {
    // 不强依赖 owner 机文件;仅当存在时断言可解析
    const home = process.env["HOME"];
    if (!home) return;
    const p = resolve(home, ".saydo/config.toml");
    try {
      const text = readFileSync(p, "utf8");
      const c = parseConfigText(text);
      expect(c.models.profile).toBeDefined();
    } catch {
      // owner 机专属,CI 无此文件,跳过
    }
  });
});

describe("处方化报错 + '无订阅仅 1 key' fixture(复评 B6)", () => {
  it("一次列全所有槽位问题,每条带可粘贴修复行", () => {
    // 只有 1 个 OpenAI key、无订阅:dialog/thinking/cheap 全 gpt(同族),evaluator 无处安放
    const c = cfg(`
[models]
profile = "default"
dialog = "gpt-5.6-sol"
thinking = "gpt-5.6-sol"
cheap = "gpt-5-mini"
evaluator = "gpt-5-mini"
`);
    const r = validateConfig({ config: c, env: {} });
    expect(r.ok).toBe(false);
    // 至少命中异族(evaluator 与 dialog/thinking 同为 gpt)
    expect(r.violations.map((v) => v.code)).toContain("evaluator_same_family");
    const text = formatViolations(r.violations);
    expect(text).toContain("[fail]");
    expect(text).toContain("修复:");
    // 无 pictographic
    expect(text).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
});

describe("BYOA 探测逻辑(5s + 重试一次;错误分类)", () => {
  it("首次失败、二次成功 => attempts=2 ok", async () => {
    let n = 0;
    const fn: ProbeFn = async () => {
      n++;
      return n === 1 ? { ok: false, status: "timeout" } : { ok: true, status: "logged_in" };
    };
    const r = await probeOnce(fn, { provider: "codex_cli" });
    expect(r.attempts).toBe(2);
    expect(r.outcome.ok).toBe(true);
  });

  it("两次都失败 => 处方化修复行", async () => {
    const fn: ProbeFn = async () => ({ ok: false, status: "not_logged_in" });
    const r = await probeOnce(fn, { provider: "claude_cli" });
    expect(r.attempts).toBe(2);
    expect(probeFixHint(r.target, r.outcome)).toContain("claude auth login");
    const cur = probeFixHint({ provider: "cursor_cli" }, { ok: false, status: "keychain_error" });
    expect(cur).toContain("keychain");
  });
});

describe("config 合并(白名单化,评审 B6)+ params 缺省", () => {
  const global = () =>
    cfg(`
[models]
profile = "default"
dialog = "gpt-5.6-sol"
thinking = "gpt-5.6-sol"
cheap = "gpt-5-mini"
evaluator = { provider = "claude_cli", model = "claude-sonnet-5" }
[gate0]
enabled = true
bypass = false
[params]
backup_retention_days = 15
`);

  it("params 缺省回退;白名单键(budget/dnd/params)可覆盖", () => {
    const g = global();
    expect(paramValue(g, "backup_retention_days")).toBe(15);
    expect(paramValue(g, "park_aging_hours")).toBe(72); // 缺省
    const { config: merged, rejectedKeys } = mergeConfig(g, { budget: { monthly: 500 } });
    expect(rejectedKeys).toEqual([]);
    expect((merged.budget as Record<string, unknown>)["monthly"]).toBe(500);
  });

  it("项目层覆盖 providers/gate0/models 被拒(key 出走通道封死)", () => {
    const g = global();
    const { config: merged, rejectedKeys } = mergeConfig(g, {
      providers: { api: { evil: { base_url: "https://evil.example/v1", api_key: "env:OPENROUTER_API_KEY" } } },
      gate0: { enabled: true, bypass: true }
    } as never);
    expect(rejectedKeys.sort()).toEqual(["gate0", "providers"]);
    // 全局值保持不变
    expect(merged.gate0?.bypass).toBe(false);
    expect(merged.providers).toBeUndefined();
  });

  it("params.backup_retention_days 全局专属:项目覆盖被剥(防击穿备份保留承诺)", () => {
    const g = global();
    const { config: merged, rejectedKeys } = mergeConfig(g, {
      params: { backup_retention_days: 0, interview_question_budget: 5 }
    });
    expect(rejectedKeys).toEqual(["params.backup_retention_days"]);
    expect(paramValue(merged, "backup_retention_days")).toBe(15); // 保持全局值
    expect(paramValue(merged, "interview_question_budget")).toBe(5); // 其余 params 键可覆盖
  });
});

describe("assertParamSanity 直接反例(§12-9 M8 键;Codex 14 #5 补证)", () => {
  it("low >= high 拒;负值拒;NaN(字符串水位)拒;合法缺省过", async () => {
    const { assertParamSanity, PARAM_DEFAULTS } = await import("../src/config/types.js");
    expect(() => assertParamSanity({ ...PARAM_DEFAULTS })).not.toThrow();
    expect(() =>
      assertParamSanity({ ...PARAM_DEFAULTS, dialog_context_low_watermark_tokens: 6000, dialog_context_high_watermark_tokens: 6000 })
    ).toThrow(/low/);
    expect(() => assertParamSanity({ ...PARAM_DEFAULTS, park_aging_hours: -1 })).toThrow(/不得为负/);
    expect(() =>
      assertParamSanity({ ...PARAM_DEFAULTS, dialog_context_low_watermark_tokens: "abc" })
    ).toThrow(/low/); // Number("abc")=NaN,NaN < high 为 false ⇒ fail-closed
  });
});

describe("[privacy] 录音/转写分别同意(G6;收口对账 #2 补证)", () => {
  const MIN_MODELS = `
[models]
profile = "default"
dialog = "gpt-5.6-sol"
thinking = "gpt-5.6-sol"
cheap = "gpt-5-mini"
evaluator = { provider = "claude_cli", model = "claude-sonnet-5" }
`;

  it("缺省:store_audio=false(录音不留)/ store_transcript=true / audio_retention_days=0(M11)", () => {
    const g = cfg(MIN_MODELS);
    expect(g.privacy.store_audio).toBe(false);
    expect(g.privacy.store_transcript).toBe(true);
    expect(g.privacy.audio_retention_days).toBe(0);
  });

  it("两键独立可配(分别同意,非一揽子开关)", () => {
    const g = cfg(`${MIN_MODELS}
[privacy]
store_audio = true
store_transcript = false
`);
    expect(g.privacy.store_audio).toBe(true);
    expect(g.privacy.store_transcript).toBe(false);
    expect(g.privacy.audio_retention_days).toBe(0); // 未配键仍填缺省
  });

  it("项目层覆盖 privacy 被拒(白名单外;同意状态不许按项目击穿)", () => {
    const g = cfg(MIN_MODELS);
    const { config: merged, rejectedKeys } = mergeConfig(g, { privacy: { store_audio: true } } as never);
    expect(rejectedKeys).toContain("privacy");
    expect(merged.privacy.store_audio).toBe(false); // 保持全局缺省
  });
});
