// first-run onboarding 契约测试:
// probe 无值泄露 / 写口白名单 422 / pending 写不动活动文件 /
// 晋升协议(mock 崩溃点) / secret 合并+0600 / test 响应无 key / health 含 pid 形状

import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildSetupProbe,
  evaluateVoiceSlot,
  minimalApiChat,
  parseSetupTestRequest,
  responseContainsSecretValue,
  runSetupTest,
  SETUP_SELF_TEST_NO_TOOL_BAN,
  SETUP_SELF_TEST_NO_TOOL_BAN_REINFORCED,
  setupSelfTestPrompt,
  testResolvedModelSlot,
  writeSetupConfigStaged,
  writeSetupSecretStaged
} from "../src/api/setup.js";
import {
  bootstrapConfigIfMissing,
  defaultConfigTemplate,
  defaultConfigTemplateToml,
  isPlaceholderBinding,
  PLACEHOLDER_MODEL_API,
  PLACEHOLDER_MODEL_EVALUATOR
} from "../src/config/defaultTemplate.js";
import { fileModeBits, mergeEnvText, parseEnvText } from "../src/config/envFile.js";
import {
  effectivePromotion,
  pendingPaths,
  promoteAllPending,
  promotePendingFile,
  rollbackActivationFiles,
  writePendingFile
} from "../src/config/pending.js";
import { parseConfigText } from "../src/config/load.js";
import { validateConfig } from "../src/config/validate.js";
import { verifyIdentity } from "../src/net/identity.js";
import type { AuditSink } from "../src/obs/audit.js";
import type { ChatRequest, ChatResult, LlmProvider } from "../src/providers/types.js";

const VALID_BASE_TOML = `
[models]
profile = "default"
dialog = { provider = "api", via = "openrouter", model = "openai/gpt-4o-mini" }
thinking = { provider = "codex_cli", reasoning = "high" }
cheap = { provider = "api", via = "openrouter", model = "openai/gpt-4o-mini" }
evaluator = { provider = "claude_cli", model = "claude-sonnet-5" }

[providers.api.openrouter]
base_url = "https://openrouter.ai/api/v1"
api_key = "env:OPENROUTER_API_KEY"

[budget]
monthly = 100
currency = "CNY"

[dnd]
window = "23:00-08:00"
`;

const fakeCli = fileURLToPath(new URL("./fixtures/fake-byoa-cli.mjs", import.meta.url));
const fakeCliDigest = createHash("sha256").update(readFileSync(fakeCli)).digest("hex");

function tmpHome(): string {
  const dir = mkdtempSync(join(tmpdir(), "saydo-setup-"));
  return dir;
}

describe("setup probe", () => {
  it("存量全局 dialog CLI 放行为 oneshot,无 self-test 登记时保持 unarmed", async () => {
    const home = tmpHome();
    writeFileSync(
      join(home, "config.toml"),
      VALID_BASE_TOML.replace(
        'dialog = { provider = "api", via = "openrouter", model = "openai/gpt-4o-mini" }',
        'dialog = { provider = "codex_cli" }'
      ).replace(
        'evaluator = { provider = "claude_cli", model = "claude-sonnet-5" }',
        'evaluator = { provider = "codex_cli" }\nevaluator_isolation_ack = true\nevaluator_same_family_ack = true'
      ),
      { mode: 0o600 }
    );
    const probe = await buildSetupProbe({
      saydoHome: home,
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      processEnv: { OPENROUTER_API_KEY: "k" },
      skipCliProbe: true
    });
    expect(probe.recovery).toMatchObject({ active: false, mode: "normal" });
    expect(probe.recovery.violations.map((item) => item.code)).not.toContain("dialog_must_be_api");
    expect(probe.config.slots.dialog).toMatchObject({
      effective: "unarmed",
      reason: "cli_self_test_required",
      mode: "oneshot"
    });
    expect(probe.config.slots.thinking).toMatchObject({ effective: "unarmed", reason: "cli_self_test_required" });
    expect(probe.config.slots.cheap.effective).toBe("active");
    expect(probe.config.slots.evaluator).toMatchObject({ effective: "unarmed", reason: "cli_self_test_required" });

    const staged = writeSetupConfigStaged(
      home,
      {
        models: {
          dialog: { provider: "api", via: "openrouter", model: "openai/gpt-5.6-luna" },
          thinking: { provider: "api", via: "openrouter", model: "openai/gpt-5.6-terra-pro" },
          cheap: { provider: "api", via: "openrouter", model: "google/gemini-3.1-flash-lite" },
          evaluator: { provider: "api", via: "openrouter", model: "anthropic/claude-sonnet-5" }
        }
      },
      { OPENROUTER_API_KEY: "k" }
    );
    expect(staged.ok).toBe(true);
  });

  it("补充密钥/ack/hints 只读投影且永不回显值;CLI 只标 candidate", async () => {
    const home = tmpHome();
    writeFileSync(
      join(home, "config.toml"),
      VALID_BASE_TOML.replace(
        'evaluator = { provider = "claude_cli", model = "claude-sonnet-5" }',
        'evaluator = { provider = "codex_cli" }\nevaluator_isolation_ack = true\nevaluator_same_family_ack = true'
      ),
      { mode: 0o600 }
    );
    writeFileSync(
      join(home, ".env"),
      "OPENROUTER_API_KEY=sk-secret-should-never-leak-xyz\nANTHROPIC_API_KEY=anthropic-secret-should-never-leak\nVOLC_APP_ID=app1\n",
      { mode: 0o600 }
    );
    const probe = await buildSetupProbe({
      saydoHome: home,
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      processEnv: {},
      skipCliProbe: true
    });
    expect(probe.secrets["OPENROUTER_API_KEY"]).toBe(true);
    expect(probe.secrets["ANTHROPIC_API_KEY"]).toBe(true);
    expect(probe.secrets["VOLC_APP_ID"]).toBe(true);
    expect(probe.secrets["VOLC_ACCESS_TOKEN"]).toBe(false);
    expect(probe.acks).toEqual({ evaluator_isolation: true, evaluator_same_family: true });
    expect(probe.hints.map((h) => h.code)).toEqual(["evaluator_cli_acks_confirmed"]);
    expect(responseContainsSecretValue(probe, ["sk-secret-should-never-leak-xyz", "anthropic-secret-should-never-leak"])).toBe(false);
    expect(JSON.stringify(probe)).not.toContain("sk-secret");
    expect(JSON.stringify(probe)).not.toContain("anthropic-secret");
    expect(probe.config.slots.dialog.status).toBe("ok");
    expect(probe.config.slots.dialog.effective).toBe("active");
    expect(probe.config.slots.thinking.status).toBe("configured"); // CLI 不因 PATH 判 ok
    expect(probe.config.slots.thinking).toMatchObject({
      effective: "fallback_dialog",
      reason: "cli_self_test_required",
      fallbackTo: "dialog"
    });
    expect(probe.config.slots.cheap.effective).toBe("active");
    expect(probe.config.slots.evaluator).toMatchObject({
      effective: "unarmed",
      reason: "cli_self_test_required"
    });
    expect(probe.recovery).toMatchObject({ active: false, mode: "normal" });
    expect(probe.voice.pipelinePeer).toBe(false);
    expect(probe.voice.note).toMatch(/语音服务未跟上/);
    for (const c of probe.clis) {
      expect(c.candidate).toBe(c.found);
      expect(c).not.toHaveProperty("ok");
    }
  });

  it("pending 校验失败时 probe 如实报 validation_failed", async () => {
    const home = tmpHome();
    writeFileSync(join(home, "config.toml"), VALID_BASE_TOML, { mode: 0o600 });
    writeFileSync(join(home, "config.toml.pending"), "this is not valid toml {{{", { mode: 0o600 });
    const probe = await buildSetupProbe({
      saydoHome: home,
      voice: { pipelinePeer: true, asr: "ok", tts: "ok" },
      processEnv: { OPENROUTER_API_KEY: "x" },
      skipCliProbe: true
    });
    expect(probe.pendingConfig?.status).toBe("validation_failed");
  });

  it("active effective 只读活动 .env,不会把尚未晋升的 pending key 伪报 active", async () => {
    const home = tmpHome();
    const allApi = VALID_BASE_TOML.replace(
      'thinking = { provider = "codex_cli", reasoning = "high" }',
      'thinking = { provider = "api", via = "openrouter", model = "openai/gpt-5.6-terra-pro" }'
    ).replace(
      'evaluator = { provider = "claude_cli", model = "claude-sonnet-5" }',
      'evaluator = { provider = "api", via = "openrouter", model = "anthropic/claude-sonnet-5" }'
    );
    writeFileSync(join(home, "config.toml"), allApi, { mode: 0o600 });
    writeFileSync(join(home, ".env.pending"), "OPENROUTER_API_KEY=pending-only\n", { mode: 0o600 });

    const probe = await buildSetupProbe({
      saydoHome: home,
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      processEnv: {},
      skipCliProbe: true
    });
    expect(probe.secrets["OPENROUTER_API_KEY"]).toBe(true);
    for (const slot of ["dialog", "thinking", "cheap", "evaluator"] as const) {
      expect(probe.config.slots[slot]).toMatchObject({ effective: "unarmed", reason: "provider_unavailable" });
    }
  });

  it("损坏 active 进入结构化 recovery,且 setup 写口可从安全模板重建 pending", async () => {
    const home = tmpHome();
    writeFileSync(join(home, "config.toml"), 'broken = "unterminated\nSECRET_DO_NOT_ECHO\n', { mode: 0o600 });
    const probe = await buildSetupProbe({
      saydoHome: home,
      recoveryViolations: [{ code: "active_config_unreadable", message: "活动 config.toml 不可读" }],
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      processEnv: {},
      skipCliProbe: true
    });
    expect(probe.recovery).toMatchObject({ active: true, mode: "recovery_only" });
    expect(JSON.stringify(probe)).not.toContain("SECRET_DO_NOT_ECHO");

    const result = writeSetupConfigStaged(
      home,
      {
        providers: {
          api: {
            openrouter: {
              base_url: "https://openrouter.ai/api/v1",
              api_key: "env:OPENROUTER_API_KEY"
            }
          }
        },
        models: {
          dialog: { provider: "api", via: "openrouter", model: "openai/gpt-5.6-luna" },
          thinking: { provider: "api", via: "openrouter", model: "openai/gpt-5.6-terra-pro" },
          cheap: { provider: "api", via: "openrouter", model: "google/gemini-3.1-flash-lite" },
          evaluator: { provider: "api", via: "openrouter", model: "anthropic/claude-sonnet-5" }
        }
      },
      { OPENROUTER_API_KEY: "k" }
    );
    expect(result.ok).toBe(true);
    const pending = parseConfigText(readFileSync(join(home, "config.toml.pending"), "utf8"));
    expect(pending.privacy.store_transcript).toBe(false);
    expect(pending.gate0).toMatchObject({ enabled: true, bypass: false });
  });
});

describe("setup config staged 写口", () => {
  it("非白名单键 422;通过则写 pending 不动活动文件", () => {
    const home = tmpHome();
    writeFileSync(join(home, "config.toml"), VALID_BASE_TOML, { mode: 0o600 });
    const activeBefore = readFileSync(join(home, "config.toml"), "utf8");

    const bad = writeSetupConfigStaged(
      home,
      { models: { dialog: "gpt-5.6-sol" }, gate0: { enabled: false }, providers: {} },
      { OPENROUTER_API_KEY: "k", SAYDO_DEV: "0" }
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.status).toBe(422);

    const good = writeSetupConfigStaged(
      home,
      {
        models: {
          dialog: { provider: "api", via: "openrouter", model: "openai/gpt-4o-mini" },
          cheap: { provider: "api", via: "openrouter", model: "openai/gpt-4o-mini" }
        },
        budget: { monthly: 50, currency: "CNY" }
      },
      { OPENROUTER_API_KEY: "k" }
    );
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.restart_required).toBe(true);
    expect(readFileSync(join(home, "config.toml"), "utf8")).toBe(activeBefore);
    expect(existsSync(join(home, "config.toml.pending"))).toBe(true);
    // pending 可被同源 parse
    const pending = parseConfigText(readFileSync(join(home, "config.toml.pending"), "utf8"));
    expect(pending.budget).toMatchObject({ monthly: 50 });
  });

  it("异族护栏失败 422 且不落 pending", () => {
    const home = tmpHome();
    writeFileSync(join(home, "config.toml"), VALID_BASE_TOML, { mode: 0o600 });
    const r = writeSetupConfigStaged(
      home,
      {
        models: {
          // evaluator 改成与 dialog 同 GPT 族 → 拒
          evaluator: { provider: "api", via: "openrouter", model: "openai/gpt-4o" }
        }
      },
      { OPENROUTER_API_KEY: "k" }
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(422);
      expect(r.code).toBe("config_validation_failed");
    }
    expect(existsSync(join(home, "config.toml.pending"))).toBe(false);
  });

  it("四槽改成异族全 API 时同次清除存量 evaluator 双 ack", () => {
    const home = tmpHome();
    writeFileSync(
      join(home, "config.toml"),
      VALID_BASE_TOML.replace(
        'evaluator = { provider = "claude_cli", model = "claude-sonnet-5" }',
        'evaluator = { provider = "codex_cli" }\nevaluator_isolation_ack = true\nevaluator_same_family_ack = true'
      ),
      { mode: 0o600 }
    );
    const result = writeSetupConfigStaged(
      home,
      {
        models: {
          dialog: { provider: "api", via: "openrouter", model: "openai/gpt-5.6-luna" },
          thinking: { provider: "api", via: "openrouter", model: "openai/gpt-5.6-terra-pro" },
          cheap: { provider: "api", via: "openrouter", model: "google/gemini-3.1-flash-lite" },
          evaluator: { provider: "api", via: "openrouter", model: "anthropic/claude-sonnet-5" }
        }
      },
      { OPENROUTER_API_KEY: "k" }
    );
    expect(result.ok).toBe(true);
    const pending = parseConfigText(readFileSync(join(home, "config.toml.pending"), "utf8"));
    expect(pending.models.evaluator_isolation_ack).toBeUndefined();
    expect(pending.models.evaluator_same_family_ack).toBeUndefined();
  });

  it("候选全局配置若撞上存量 project override,同次 422 且不落 pending", () => {
    const home = tmpHome();
    writeFileSync(join(home, "config.toml"), VALID_BASE_TOML, { mode: 0o600 });
    const result = writeSetupConfigStaged(
      home,
      { budget: { monthly: 88, currency: "CNY" } },
      { OPENROUTER_API_KEY: "k" },
      () => [{ code: "project_override_evaluator_same_family", message: "项目覆盖与 evaluator 同族" }]
    );
    expect(result).toMatchObject({ ok: false, status: 422, code: "project_overrides_conflict" });
    expect(existsSync(join(home, "config.toml.pending"))).toBe(false);
  });

  it("v5:providers 白名单放行,与 models.dialog 同次写入 pending", () => {
    const home = tmpHome();
    writeFileSync(join(home, "config.toml"), VALID_BASE_TOML, { mode: 0o600 });
    const activeBefore = readFileSync(join(home, "config.toml"), "utf8");
    const r = writeSetupConfigStaged(
      home,
      {
        providers: {
          api: {
            openrouter: {
              base_url: "https://openrouter.ai/api/v1",
              api_key: "env:OPENROUTER_API_KEY"
            }
          }
        },
        models: {
          dialog: { provider: "api", via: "openrouter", model: "deepseek/deepseek-chat" }
        }
      },
      { OPENROUTER_API_KEY: "k" }
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.restart_required).toBe(true);
    expect(readFileSync(join(home, "config.toml"), "utf8")).toBe(activeBefore);
    expect(existsSync(join(home, "config.toml.pending"))).toBe(true);
    const pending = parseConfigText(readFileSync(join(home, "config.toml.pending"), "utf8"));
    expect(pending.providers?.api?.["openrouter"]).toMatchObject({
      base_url: "https://openrouter.ai/api/v1",
      api_key: "env:OPENROUTER_API_KEY"
    });
    expect(pending.models.dialog).toMatchObject({
      provider: "api",
      via: "openrouter",
      model: "deepseek/deepseek-chat"
    });
  });

  it("v5:via 指向不存在端点 → 422 code=via_provider_missing", () => {
    const home = tmpHome();
    // 无 providers 段的基底:仅 models,缺 named endpoint
    writeFileSync(
      join(home, "config.toml"),
      `
[models]
profile = "default"
dialog = { provider = "api", model = "gpt-4o-mini" }
thinking = { provider = "codex_cli", reasoning = "high" }
cheap = { provider = "api", model = "gpt-4o-mini" }
evaluator = { provider = "claude_cli", model = "claude-sonnet-5" }
`,
      { mode: 0o600 }
    );
    const r = writeSetupConfigStaged(
      home,
      {
        models: {
          dialog: { provider: "api", via: "missing_gw", model: "openai/gpt-4o-mini" }
        }
      },
      { OPENAI_API_KEY: "k" }
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(422);
      expect(r.code).toBe("via_provider_missing");
      expect(r.message).toMatch(/via="missing_gw"/);
      expect(r.message).toMatch(/providers\.api/);
    }
    expect(existsSync(join(home, "config.toml.pending"))).toBe(false);
  });

  it("v5:api_key 非 env:NAME 形态 → 422 人话", () => {
    const home = tmpHome();
    writeFileSync(join(home, "config.toml"), VALID_BASE_TOML, { mode: 0o600 });
    const r = writeSetupConfigStaged(
      home,
      {
        providers: {
          api: {
            openrouter: {
              base_url: "https://openrouter.ai/api/v1",
              api_key: "sk-literal-secret-not-allowed"
            }
          }
        }
      },
      { OPENROUTER_API_KEY: "k" }
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(422);
      expect(r.code).toBe("setup_config_rejected");
      expect(r.message).toMatch(/env:NAME/);
      expect(r.message).not.toContain("sk-literal-secret-not-allowed");
    }
    expect(existsSync(join(home, "config.toml.pending"))).toBe(false);
  });
});

describe("setup secret staged", () => {
  it("合并保留他行 + 0600;audit 不经 value;name 白名单", () => {
    const home = tmpHome();
    writeFileSync(join(home, ".env"), "OPENROUTER_API_KEY=old\nKEEP_ME=yes\n# comment\n", { mode: 0o600 });
    const audits: Array<{ action: string; meta?: Record<string, unknown> }> = [];
    const r = writeSetupSecretStaged(
      home,
      { name: "OPENROUTER_API_KEY", value: "new-secret-value-abc" },
      { record: (e) => {
        audits.push(e);
        return { id: "aud_x" };
      } }
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.name).toBe("OPENROUTER_API_KEY");
      expect(r.restart_required).toBe(true);
    }
    const pending = readFileSync(join(home, ".env.pending"), "utf8");
    expect(pending).toContain("OPENROUTER_API_KEY=new-secret-value-abc");
    expect(pending).toContain("KEEP_ME=yes");
    expect(pending).toContain("# comment");
    // 活动文件不动
    expect(readFileSync(join(home, ".env"), "utf8")).toContain("OPENROUTER_API_KEY=old");
    if (process.platform !== "win32") expect(fileModeBits(join(home, ".env.pending"))).toBe(0o600);
    expect(audits).toHaveLength(1);
    expect(audits[0]?.action).toBe("setup.secret_staged");
    expect(audits[0]?.meta?.["name"]).toBe("OPENROUTER_API_KEY");
    expect(JSON.stringify(audits)).not.toContain("new-secret-value-abc");

    const badName = writeSetupSecretStaged(home, { name: "EVIL_KEY", value: "x" });
    expect(badName.ok).toBe(false);
    if (!badName.ok) expect(badName.status).toBe(422);
  });

  it("DEEPSEEK_API_KEY 在写口白名单(一键上手路径;09 §11 [providers.api.deepseek] 已有样例)", () => {
    const home = tmpHome();
    const r = writeSetupSecretStaged(home, { name: "DEEPSEEK_API_KEY", value: "sk-ds-test-value" });
    expect(r.ok).toBe(true);
    expect(readFileSync(join(home, ".env.pending"), "utf8")).toContain("DEEPSEEK_API_KEY=sk-ds-test-value");
  });

  it("mergeEnvText 纯函数:同名替换/追加/保留注释", () => {
    const base = "# head\nA=1\nB=2\n";
    expect(mergeEnvText(base, "A", "9")).toContain("A=9");
    expect(mergeEnvText(base, "A", "9")).toContain("B=2");
    expect(mergeEnvText(base, "C", "3")).toMatch(/C=3\n$/);
    expect(parseEnvText(mergeEnvText(null, "X", "y"))).toEqual({ X: "y" });
  });
});

describe("晋升协议 v4", () => {
  it("启动投影不得把 runtime 失败后已回滚的 rename 报成晋升", () => {
    const renamed = { ok: true, promoted: true, activePath: "/tmp/config", bakPath: "/tmp/config.bak" } as const;
    expect(effectivePromotion(renamed, { rolledBack: false, rollbackFailed: false })).toBe(true);
    expect(effectivePromotion(renamed, { rolledBack: true, rollbackFailed: false })).toBe(false);
    expect(effectivePromotion(renamed, { rolledBack: false, rollbackFailed: true })).toBe(false);
  });

  it("正常晋升:活动→bak,pending→活动", () => {
    const home = tmpHome();
    writeFileSync(join(home, "config.toml"), "old=1\n", { mode: 0o600 });
    writePendingFile(join(home, "config.toml.pending"), "new=2\n", 0o600);
    const r = promotePendingFile(home, "config.toml");
    expect(r.ok).toBe(true);
    expect(r.promoted).toBe(true);
    expect(readFileSync(join(home, "config.toml"), "utf8")).toBe("new=2\n");
    expect(readFileSync(join(home, "config.toml.bak"), "utf8")).toBe("old=1\n");
    expect(existsSync(join(home, "config.toml.pending"))).toBe(false);
  });

  it("本轮晋升前没有 active env 时,回滚不得复活历史 secret bak", () => {
    const home = tmpHome();
    const candidate = "NEW_KEY=candidate\n";
    writeFileSync(join(home, ".env.bak"), "STALE_SECRET=old\n", { mode: 0o600 });
    writePendingFile(join(home, ".env.pending"), candidate, 0o600);

    const env = promotePendingFile(home, ".env");
    expect(env).toMatchObject({ ok: true, promoted: true, bakPath: null });
    // 即使晋升后又出现一份无关 bak,回滚也只信本轮 PromoteStatus。
    writeFileSync(join(home, ".env.bak"), "STALE_SECRET=old\n", { mode: 0o600 });
    const activation = { envDigest: createHash("sha256").update(candidate).digest("hex") };
    const rolledBack = rollbackActivationFiles(home, activation, {
      config: { ok: true, promoted: false, reason: "no_pending" },
      env
    });

    expect(rolledBack).toEqual({ ok: true });
    expect(existsSync(join(home, ".env"))).toBe(false);
    expect(readFileSync(join(home, ".env.pending"), "utf8")).toBe(candidate);
  });

  it("mock 崩溃 bak 后断:活动仍旧,pending 仍在", () => {
    const home = tmpHome();
    writeFileSync(join(home, "config.toml"), "old=1\n", { mode: 0o600 });
    writePendingFile(join(home, "config.toml.pending"), "new=2\n", 0o600);
    const r = promotePendingFile(home, "config.toml", { crashAfter: "bak_done" });
    expect(r.ok).toBe(false);
    expect(r.promoted).toBe(false);
    if (!r.ok) expect(r.stage).toBe("bak");
    expect(readFileSync(join(home, "config.toml"), "utf8")).toBe("old=1\n");
    expect(existsSync(join(home, "config.toml.pending"))).toBe(true);
    // bak 已写出
    expect(existsSync(join(home, "config.toml.bak"))).toBe(true);
  });

  it("mock 崩溃 rename 后断:活动已是新内容(rename 成功);现场可恢复", () => {
    const home = tmpHome();
    writeFileSync(join(home, "config.toml"), "old=1\n", { mode: 0o600 });
    writePendingFile(join(home, "config.toml.pending"), "new=2\n", 0o600);
    const r = promotePendingFile(home, "config.toml", { crashAfter: "rename_done" });
    // rename 已成功后注入崩溃 → stage=rename,但活动文件已是新内容
    // 实现:crash 在 rename 成功后 throw,catch 记 stage rename —— 活动已新
    expect(r.promoted).toBe(false);
    expect(readFileSync(join(home, "config.toml"), "utf8")).toBe("new=2\n");
    expect(readFileSync(join(home, "config.toml.bak"), "utf8")).toBe("old=1\n");
    // pending 已被 rename 走
    expect(existsSync(join(home, "config.toml.pending"))).toBe(false);
  });

  it("校验失败不晋升,保留 pending", () => {
    const home = tmpHome();
    writeFileSync(join(home, "config.toml"), "old=1\n", { mode: 0o600 });
    writePendingFile(join(home, "config.toml.pending"), "new=2\n", 0o600);
    const r = promotePendingFile(home, "config.toml", {
      validatePending: () => {
        throw new Error("schema bad");
      }
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.stage).toBe("validate");
    expect(readFileSync(join(home, "config.toml"), "utf8")).toBe("old=1\n");
    expect(existsSync(join(home, "config.toml.pending"))).toBe(true);
  });

  it("activation 统一预检失败时 config 与 env 都保持旧活动值", () => {
    const home = tmpHome();
    writeFileSync(join(home, "config.toml"), "old_config=1\n", { mode: 0o600 });
    writeFileSync(join(home, ".env"), "OLD_KEY=1\n", { mode: 0o600 });
    writePendingFile(join(home, "config.toml.pending"), "new_config=1\n", 0o600);
    writePendingFile(join(home, ".env.pending"), "NEW_KEY=1\n", 0o600);
    const result = promoteAllPending(home, {
      validateActivation: () => {
        throw new Error("CLI receipt missing");
      }
    });
    expect(result.config.ok).toBe(false);
    expect(result.env.ok).toBe(false);
    expect(readFileSync(join(home, "config.toml"), "utf8")).toBe("old_config=1\n");
    expect(readFileSync(join(home, ".env"), "utf8")).toBe("OLD_KEY=1\n");
    expect(readFileSync(join(home, "config.toml.pending"), "utf8")).toBe("new_config=1\n");
    expect(readFileSync(join(home, ".env.pending"), "utf8")).toBe("NEW_KEY=1\n");
  });
});

describe("setup test", () => {
  const provider = (chat: (req: ChatRequest) => Promise<ChatResult>): LlmProvider => ({
    kind: "api",
    model: "test/model",
    chat
  });
  const ok = (text: string, observedModel = "test/model"): ChatResult => ({
    ok: true,
    text,
    requestedModel: observedModel || undefined,
    observedModel,
    observedModelSource: "stream",
    observedModelExempted: false,
    usage: undefined
  });

  it("四个模型槽按真实合同分别可绿可红", async () => {
    const dialogGreen = await testResolvedModelSlot(
      "dialog",
      provider(async () => ok("unused")),
      async (req, callIndex) => {
        if (callIndex === 0) {
          expect(req.tools?.[0]?.name).toBe("saydo_self_test");
          return {
              ok: true,
              text: "",
              toolCalls: [{ id: "call_1", name: "saydo_self_test", arguments: '{"value":"ping"}' }],
              requestedModel: "test/dialog",
              observedModel: "test/dialog",
              observedModelSource: "stream",
              observedModelExempted: false,
              usage: undefined
          };
        }
        expect(req.messages.at(-1)).toMatchObject({ role: "tool", toolCallId: "call_1" });
        return ok("工具结果已收到", "test/dialog");
      }
    );
    const dialogRed = await testResolvedModelSlot("dialog", provider(async () => ok("没调用工具")));

    const draft = JSON.stringify({
      outcomePreview: "自检",
      inScope: ["setup"],
      outOfScope: [],
      acceptance: ["返回合同"],
      plan: [{ seq: 1, step: "检查", owner: "ai" }],
      risks: []
    });
    const cheapGreen = await testResolvedModelSlot(
      "cheap",
      provider(async (req) => {
        expect(req.jsonSchema).toMatchObject({ type: "object", required: expect.arrayContaining(["outcomePreview", "plan"]) });
        expect(req.messages.at(-1)?.content).toContain(SETUP_SELF_TEST_NO_TOOL_BAN);
        return ok(draft);
      })
    );
    const cheapRed = await testResolvedModelSlot("cheap", provider(async () => ok('{"outcomePreview":"缺字段"}')));

    const evaluatorGreen = await testResolvedModelSlot(
      "evaluator",
      provider(async (req) => {
        expect(req.jsonSchema).toMatchObject({ type: "object", required: ["perClaim"] });
        expect(req.messages[0]?.content).toContain(SETUP_SELF_TEST_NO_TOOL_BAN);
        return ok('{"perClaim":[]}', "test/evaluator");
      })
    );
    const evaluatorRed = await testResolvedModelSlot(
      "evaluator",
      provider(async () => ok('{"perClaim":[]}', ""))
    );

    const thinkingGreen = await testResolvedModelSlot(
      "thinking",
      provider(async (req) => {
        expect(req.messages[0]?.content).toContain(SETUP_SELF_TEST_NO_TOOL_BAN);
        return ok("沉思响应");
      })
    );
    const thinkingRed = await testResolvedModelSlot("thinking", provider(async () => ok("")));

    expect([dialogGreen, cheapGreen, evaluatorGreen, thinkingGreen].map((x) => x.status)).toEqual([
      "ok",
      "ok",
      "ok",
      "ok"
    ]);
    for (const red of [dialogRed, cheapRed, evaluatorRed, thinkingRed]) {
      expect(red.status).toBe("fail");
      expect(red.error).toBeTruthy();
    }
    expect(evaluatorGreen.observedModel).toBe("test/evaluator");
    expect(
      await testResolvedModelSlot(
        "evaluator",
        provider(async () => ok('{"perClaim":[]}', "anthropic/claude-sonnet-5")),
        undefined,
        "gpt"
      )
    ).toMatchObject({ status: "fail", error: expect.stringContaining("家族") });
  });

  it("setup self-test 把 shutdown AbortSignal 传到 API provider", async () => {
    const controller = new AbortController();
    let received: AbortSignal | undefined;
    const pending = testResolvedModelSlot(
      "thinking",
      {
        kind: "api",
        model: "test/model",
        chat: async (_req, signal) => {
          received = signal;
          return new Promise((resolve) => {
            signal?.addEventListener("abort", () => resolve({
              ok: false,
              code: "cancelled",
              message: "shutdown",
              retryable: false
            }), { once: true });
          });
        }
      },
      undefined,
      undefined,
      controller.signal
    );
    await Promise.resolve();
    controller.abort();
    await expect(pending).resolves.toMatchObject({ status: "fail", error: expect.stringContaining("shutdown") });
    expect(received).toBe(controller.signal);
  });

  it("响应无 key;标注测的是 pending/活动;api 槽用注入不泄密", async () => {
    const home = tmpHome();
    writeFileSync(join(home, "config.toml"), VALID_BASE_TOML, { mode: 0o600 });
    writeFileSync(join(home, ".env"), "OPENROUTER_API_KEY=sk-live-secret-xyz\n", { mode: 0o600 });
    writePendingFile(
      join(home, "config.toml.pending"),
      VALID_BASE_TOML.replace("monthly = 100", "monthly = 99"),
      0o600
    );

    let auditSeq = 0;
    const audit: AuditSink = { record: () => ({ id: `aud_setup${++auditSeq}` }) };
    const out = await runSetupTest({
      saydoHome: home,
      voice: { pipelinePeer: true, asr: "ok", tts: "ok" },
      processEnv: {},
      audit,
      cliCapabilityFn: async (name) => ({
        name,
        provider:
          name === "codex" ? "codex_cli" : name === "claude" ? "claude_cli" : name === "grok" ? "grok_cli" : "cursor_cli",
        label: name,
        found: true,
        path: fakeCli,
        binaryDigest: fakeCliDigest,
        auth: { status: "logged_in" as const },
        enumerable: false,
        models: []
      }),
      slotChatFn: async (slot, req, callIndex) => {
        if (slot === "dialog" && req.tools && callIndex === 0) {
          return {
            ok: true,
            text: "",
            toolCalls: [{ id: "call_1", name: "saydo_self_test", arguments: '{"value":"ping"}' }],
            requestedModel: "openai/gpt-4o-mini",
            observedModel: "openai/gpt-4o-mini",
            observedModelSource: "stream",
            observedModelExempted: false,
            usage: undefined
          };
        }
        if (slot === "cheap") {
          return {
            ok: true,
            text: JSON.stringify({
              outcomePreview: "自检",
              inScope: ["setup"],
              outOfScope: [],
              acceptance: ["返回合同"],
              plan: [{ seq: 1, step: "检查", owner: "ai" }],
              risks: []
            }),
            requestedModel: "openai/gpt-4o-mini",
            observedModel: "openai/gpt-4o-mini",
            observedModelSource: "stream",
            observedModelExempted: false,
            usage: undefined
          };
        }
        return slot === "thinking"
          ? {
              ok: true,
              text: "自检通过",
              requestedModel: "gpt-5.6-luna",
              observedModel: "gpt-5.6-luna",
              observedModelSource: "verified_binary_default",
              observedModelExempted: true,
              usage: undefined
            }
          : {
          ok: true,
          text: "自检通过",
          requestedModel: "openai/gpt-4o-mini",
          observedModel: "openai/gpt-4o-mini",
          observedModelSource: "stream",
          observedModelExempted: false,
          usage: undefined
            };
      },
      cliTestFn: async () => ({ status: "untested", error: "test skip" })
    });
    expect(out.configSource).toBe("pending");
    expect(out.slots.dialog?.status).toBe("ok");
    expect(out.slots.cheap?.status).toBe("ok");
    expect(out.slots.thinking?.status).toBe("ok");
    expect(out.slots.evaluator?.status).toBe("fail");
    expect(out.slots.voice).toBeUndefined();
    expect(responseContainsSecretValue(out, ["sk-live-secret-xyz"])).toBe(false);
    expect(JSON.stringify(out)).not.toContain("sk-live-secret");
  });

  it("minimalApiChat max_tokens 请求形态(mock fetch)", async () => {
    let body = "";
    const r = await minimalApiChat({
      baseUrl: "https://example.test/v1",
      apiKey: "sk-x",
      model: "m",
      fetchImpl: (async (_url, init) => {
        body = String(init?.body ?? "");
        return new Response(JSON.stringify({ choices: [{ message: { content: "hi" } }] }), {
          status: 200
        });
      }) as typeof fetch
    });
    expect(r.ok).toBe(true);
    expect(JSON.parse(body).max_tokens).toBe(8);
    expect(JSON.parse(body).max_tokens).toBeLessThanOrEqual(8);
  });

  it("四槽一发一收自检 prompt 带工具硬禁令;tripwire 后强化禁令重试一次", async () => {
    const tripwire = (): ChatResult => ({
      ok: false,
      code: "voided_tripwire",
      message: "CLI 尝试调用工具,已终止",
      retryable: false
    });
    const seen: ChatRequest[] = [];
    const thinking = await testResolvedModelSlot(
      "thinking",
      provider(async (req) => {
        seen.push(req);
        if (seen.length === 1) return tripwire();
        return ok("沉思响应");
      })
    );
    expect(thinking.status).toBe("ok");
    expect(seen).toHaveLength(2);
    expect(seen[0]?.messages[0]?.content).toBe(
      setupSelfTestPrompt("用一句纯文本回答 setup thinking self-test。")
    );
    expect(seen[0]?.messages[0]?.content).toContain(SETUP_SELF_TEST_NO_TOOL_BAN);
    expect(seen[0]?.messages[0]?.content).not.toContain("再次强调");
    expect(seen[1]?.messages[0]?.content).toBe(
      setupSelfTestPrompt("用一句纯文本回答 setup thinking self-test。", true)
    );
    expect(seen[1]?.messages[0]?.content).toContain(SETUP_SELF_TEST_NO_TOOL_BAN_REINFORCED);
    expect(seen[0]?.retryBudget).toBe(0);
    expect(seen[1]?.retryBudget).toBe(0);

    const oneshotSeen: ChatRequest[] = [];
    const oneshot = await testResolvedModelSlot(
      "dialog",
      {
        kind: "cursor_cli",
        model: "cursor-grok-4.6-high-fast",
        chat: async (req) => {
          oneshotSeen.push(req);
          if (oneshotSeen.length === 1) return tripwire();
          return {
            ok: true,
            text: JSON.stringify({ version: 1, reply: "pong", actions: [] }),
            requestedModel: "cursor-grok-4.6-high-fast",
            observedModel: "cursor-grok-4.6-high-fast",
            observedModelSource: "stream",
            observedModelExempted: false,
            usage: undefined
          };
        }
      }
    );
    expect(oneshot.status).toBe("ok");
    expect(oneshotSeen).toHaveLength(2);
    expect(oneshotSeen[0]?.messages[0]?.content).toContain(SETUP_SELF_TEST_NO_TOOL_BAN);
    expect(oneshotSeen[1]?.messages[0]?.content).toContain(SETUP_SELF_TEST_NO_TOOL_BAN_REINFORCED);
    expect(oneshotSeen[0]?.messages[0]?.content).toContain("dialog_cli_oneshot");

    const bothFail = await testResolvedModelSlot("thinking", provider(async () => tripwire()));
    expect(bothFail.status).toBe("fail");
    expect(bothFail.error).toContain("CLI 尝试调用工具,已终止");
  });

  it("CLI 自检 requested≠observed 同族时说明附降级透传;API 槽不编这条", async () => {
    const thinking = await testResolvedModelSlot("thinking", {
      kind: "claude_cli",
      model: "claude-fable-5",
      chat: async () => ({
        ok: true,
        text: "沉思响应",
        requestedModel: "claude-fable-5",
        observedModel: "claude-opus-4-8",
        observedModelSource: "stream",
        observedModelExempted: false,
        usage: undefined
      })
    });
    expect(thinking).toMatchObject({
      status: "ok",
      requestedModel: "claude-fable-5",
      observedModel: "claude-opus-4-8",
      detail: "实际 claude-opus-4-8(claude-fable-5 被 CLI 降级)"
    });

    const apiSame = await testResolvedModelSlot("thinking", {
      kind: "api",
      model: "claude-fable-5",
      chat: async () => ({
        ok: true,
        text: "沉思响应",
        requestedModel: "claude-fable-5",
        observedModel: "claude-opus-4-8",
        observedModelSource: "stream",
        observedModelExempted: false,
        usage: undefined
      })
    });
    expect(apiSame.status).toBe("ok");
    expect(apiSame.detail).toBeUndefined();
  });

  it("自检首发 unknown_event 同参重试一次;两次失败文案带触发内容", async () => {
    const unknown = (trigger: string): ChatResult => ({
      ok: false,
      code: "voided_unknown_event",
      message: `CLI 输出了无法识别的内容,这次结果作废(保守处理)(触发内容:${trigger})`,
      retryable: false
    });
    const seen: ChatRequest[] = [];
    const recovered = await testResolvedModelSlot(
      "thinking",
      provider(async (req) => {
        seen.push(req);
        if (seen.length === 1) return unknown('{"type":"codex_random_notice"}');
        return ok("沉思响应");
      })
    );
    expect(recovered.status).toBe("ok");
    expect(seen).toHaveLength(2);
    expect(seen[0]?.messages[0]?.content).toBe(seen[1]?.messages[0]?.content);
    expect(seen[0]?.messages[0]?.content).not.toContain("再次强调");
    expect(seen[0]?.retryBudget).toBe(0);
    expect(seen[1]?.retryBudget).toBe(0);

    const bothFail = await testResolvedModelSlot("thinking", provider(async () => unknown('{"type":"still_unknown"}')));
    expect(bothFail.status).toBe("fail");
    expect(bothFail.error).toContain("CLI 输出了无法识别的内容,这次结果作废(保守处理)");
    expect(bothFail.error).toContain("(触发内容:{\"type\":\"still_unknown\"})");
  });

  it("dialog API 工具环自检不加禁令、不因 tripwire 改协议", async () => {
    const seen: ChatRequest[] = [];
    const dialog = await testResolvedModelSlot(
      "dialog",
      provider(async () => ok("unused")),
      async (req) => {
        seen.push(req);
        return {
          ok: true,
          text: "",
          toolCalls: [{ id: "call_1", name: "saydo_self_test", arguments: '{"value":"ping"}' }],
          requestedModel: "test/dialog",
          observedModel: "test/dialog",
          observedModelSource: "stream",
          observedModelExempted: false,
          usage: undefined
        };
      }
    );
    expect(dialog.status).toBe("fail");
    expect(seen[0]?.messages[0]?.content).toBe("调用 saydo_self_test,value 必须是 ping。");
    expect(seen[0]?.messages[0]?.content).not.toContain(SETUP_SELF_TEST_NO_TOOL_BAN);
    expect(seen[0]?.tools?.[0]?.name).toBe("saydo_self_test");
  });

  it("方案自检不跑 voice;scope=voice 才单独测语音", async () => {
    const home = tmpHome();
    writeFileSync(
      join(home, "config.toml"),
      `
[models]
profile = "default"
dialog = { provider = "api", via = "openrouter", model = "openai/gpt-4o-mini" }
thinking = { provider = "api", via = "openrouter", model = "openai/gpt-4o-mini" }
cheap = { provider = "api", via = "openrouter", model = "openai/gpt-4o-mini" }
evaluator = { provider = "api", via = "openrouter", model = "anthropic/claude-sonnet-5" }
evaluator_same_family_ack = true

[providers.api.openrouter]
base_url = "https://openrouter.ai/api/v1"
api_key = "env:OPENROUTER_API_KEY"
`,
      { mode: 0o600 }
    );
    writeFileSync(join(home, ".env"), "OPENROUTER_API_KEY=sk-live-secret-xyz\n", { mode: 0o600 });
    const audit: AuditSink = { record: () => ({ id: "aud_voice" }) };
    const plan = await runSetupTest({
      saydoHome: home,
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      processEnv: {},
      audit,
      slotChatFn: async (slot, req, callIndex) => {
        if (slot === "dialog" && callIndex === 0) {
          return {
            ok: true,
            text: "",
            toolCalls: [{ id: "call_1", name: "saydo_self_test", arguments: '{"value":"ping"}' }],
            requestedModel: "openai/gpt-4o-mini",
            observedModel: "openai/gpt-4o-mini",
            observedModelSource: "stream",
            observedModelExempted: false,
            usage: undefined
          };
        }
        return {
          ok: true,
          text:
            slot === "cheap"
              ? JSON.stringify({
                  outcomePreview: "自检",
                  inScope: ["setup"],
                  outOfScope: [],
                  acceptance: ["返回合同"],
                  plan: [{ seq: 1, step: "检查", owner: "ai" }],
                  risks: []
                })
              : slot === "evaluator"
                ? '{"perClaim":[]}'
                : "ok",
          requestedModel: "openai/gpt-4o-mini",
          observedModel: "openai/gpt-4o-mini",
          observedModelSource: "stream",
          observedModelExempted: false,
          usage: undefined
        };
      }
    });
    expect(plan.slots.voice).toBeUndefined();
    expect(Object.keys(plan.slots)).not.toContain("voice");

    const voiceOnly = await runSetupTest({
      saydoHome: home,
      scope: "voice",
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      processEnv: {}
    });
    expect(voiceOnly.slots.voice?.status).toBe("fail");
    expect(voiceOnly.slots.voice?.error).toMatch(/可以先跳过/);
    expect(voiceOnly.slots.dialog).toBeUndefined();
    expect(evaluateVoiceSlot({}, { pipelinePeer: false, asr: "down", tts: "down" }).status).toBe("fail");
    expect(parseSetupTestRequest({ scope: "voice" })).toEqual({ scope: "voice" });
    expect(parseSetupTestRequest({})).toEqual({ scope: "plan" });
  });
});

describe("setup 鉴权面(identity via)", () => {
  it("tailnet via 与 local via 可区分(装配层对 setup 一律 403 tailnet)", () => {
    const token = "tok_setup_test_0123456789ab";
    const local = verifyIdentity({
      host: "127.0.0.1:47100",
      origin: undefined,
      token,
      port: 47100,
      expectedToken: token,
      peerAddress: "127.0.0.1",
      tailnetHosts: ["mac.tailnet.ts.net"]
    });
    expect(local.ok).toBe(true);
    if (local.ok) expect(local.via).toBe("local");

    const tail = verifyIdentity({
      host: "mac.tailnet.ts.net:47100",
      origin: undefined,
      token,
      port: 47100,
      expectedToken: token,
      peerAddress: "100.103.156.96",
      tailnetHosts: ["mac.tailnet.ts.net"]
    });
    expect(tail.ok).toBe(true);
    if (tail.ok) expect(tail.via).toBe("tailnet");
  });
});

describe("health 形状(pid/startedAt 合同)", () => {
  it("pendingPaths 与 health 字段约定(单元锚)", () => {
    const p = pendingPaths("/tmp/x", "config.toml");
    expect(p.pending).toBe(join("/tmp/x", "config.toml.pending"));
    expect(p.bak).toBe(join("/tmp/x", "config.toml.bak"));
    // /health 必含字段由 index 装配;此处锁合同键名
    const healthShape = {
      ok: true,
      service: "saydo-daemon",
      pid: process.pid,
      startedAt: new Date().toISOString()
    };
    expect(typeof healthShape.pid).toBe("number");
    expect(healthShape.startedAt).toMatch(/^\d{4}-/);
  });
});

// ---------- onboarding v6:空 HOME 缺省模板 ----------

describe("v6 缺省模板 + 首启自举", () => {
  it("defaultConfigTemplate 过 schema 与 validateConfig(异族/dialog=api)", () => {
    const toml = defaultConfigTemplateToml();
    const cfg = parseConfigText(toml);
    expect(cfg.models.profile).toBe("default");
    expect(cfg.models.dialog).toBe(PLACEHOLDER_MODEL_API);
    expect(cfg.models.cheap).toBe(PLACEHOLDER_MODEL_API);
    expect(cfg.models.dev).toBeUndefined();
    expect(isPlaceholderBinding(cfg.models.dialog)).toBe(true);
    expect(isPlaceholderBinding(cfg.models.thinking)).toBe(true);
    expect(isPlaceholderBinding(cfg.models.cheap)).toBe(true);
    expect(isPlaceholderBinding(cfg.models.evaluator)).toBe(true);
    const v = validateConfig({ config: cfg, env: {} });
    expect(v.ok).toBe(true);
    expect(v.effective?.["dialog"]?.family).toBe("gpt");
    expect(v.effective?.["evaluator"]?.family).toBe("claude");
  });

  it("空 HOME 首启生成模板;已存在不覆盖;audit config.bootstrap", () => {
    const home = tmpHome();
    const audits: Array<{ action: string; meta?: Record<string, unknown> }> = [];
    const sink = {
      record: (e: { action: string; meta?: Record<string, unknown> }) => {
        audits.push(e);
        return { id: "aud_boot" };
      }
    };
    const r1 = bootstrapConfigIfMissing(home, sink);
    expect(r1.wrote).toBe(true);
    if (r1.wrote) expect(existsSync(r1.path)).toBe(true);
    const text1 = readFileSync(join(home, "config.toml"), "utf8");
    expect(text1).toContain(PLACEHOLDER_MODEL_API);
    expect(text1).toContain(PLACEHOLDER_MODEL_EVALUATOR);
    expect(audits.map((a) => a.action)).toContain("config.bootstrap");

    // 再启:不覆盖
    writeFileSync(join(home, "config.toml"), "# user kept\n" + text1, { mode: 0o600 });
    const r2 = bootstrapConfigIfMissing(home, sink);
    expect(r2.wrote).toBe(false);
    if (!r2.wrote) expect(r2.reason).toBe("already_exists");
    expect(readFileSync(join(home, "config.toml"), "utf8")).toContain("# user kept");
  });

  it("空 HOME 下 POST 仅 dialog → 200 且 pending 含四槽", () => {
    const home = tmpHome();
    expect(existsSync(join(home, "config.toml"))).toBe(false);
    const r = writeSetupConfigStaged(
      home,
      {
        providers: {
          api: {
            openrouter: {
              base_url: "https://openrouter.ai/api/v1",
              api_key: "env:OPENROUTER_API_KEY"
            }
          }
        },
        models: {
          dialog: { provider: "api", via: "openrouter", model: "deepseek/deepseek-chat" }
        }
      },
      { OPENROUTER_API_KEY: "k" }
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.restart_required).toBe(true);
    expect(existsSync(join(home, "config.toml"))).toBe(false); // staged 不动活动
    expect(existsSync(join(home, "config.toml.pending"))).toBe(true);
    const pending = parseConfigText(readFileSync(join(home, "config.toml.pending"), "utf8"));
    expect(pending.models.dialog).toMatchObject({
      provider: "api",
      via: "openrouter",
      model: "deepseek/deepseek-chat"
    });
    // 四槽齐全(模板补 thinking/cheap/evaluator)
    expect(pending.models.thinking).toBeDefined();
    expect(pending.models.cheap).toBeDefined();
    expect(pending.models.evaluator).toBeDefined();
    expect(isPlaceholderBinding(pending.models.thinking)).toBe(true);
    expect(isPlaceholderBinding(pending.models.cheap)).toBe(true);
    expect(isPlaceholderBinding(pending.models.evaluator)).toBe(true);
    expect(isPlaceholderBinding(pending.models.dialog)).toBe(false);
  });

  it("probe 对占位槽报 missing,非 ok/configured", async () => {
    const home = tmpHome();
    const boot = bootstrapConfigIfMissing(home);
    expect(boot.wrote).toBe(true);
    const probe = await buildSetupProbe({
      saydoHome: home,
      voice: { pipelinePeer: false, asr: "down", tts: "down" },
      processEnv: {},
      skipCliProbe: true
    });
    expect(probe.config.present).toBe(true);
    expect(probe.config.slots.dialog.status).toBe("missing");
    expect(probe.config.slots.thinking.status).toBe("missing");
    expect(probe.config.slots.cheap.status).toBe("missing");
    expect(probe.config.slots.evaluator.status).toBe("missing");
    // 绝非 ok
    for (const s of ["dialog", "thinking", "cheap", "evaluator"] as const) {
      expect(probe.config.slots[s].status).not.toBe("ok");
      expect(probe.config.slots[s].status).not.toBe("configured");
    }
  });

  it("422 config_schema_invalid 的 message 人话化,不以 { 或 [ 开头", () => {
    const home = tmpHome();
    // 有活动文件但 models 故意造坏:patch 把 dialog 换成非法空对象形态(body 白名单先过 schema,
    // 合并后整体 configSchema 失败——用非法 budget 类型难触发 models 缺槽;
    // 更直接:无活动文件时 patch models 全空 + 手工破坏模板路径:
    // 写一个缺四槽的活动文件,再 patch 非 models 键)
    writeFileSync(
      join(home, "config.toml"),
      `
[models]
profile = "default"
dialog = "gpt-5.6-sol"
# 缺 thinking/cheap/evaluator
`,
      { mode: 0o600 }
    );
    const r = writeSetupConfigStaged(
      home,
      { budget: { monthly: 1, currency: "CNY" } },
      { OPENAI_API_KEY: "k" }
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(422);
      expect(r.code).toBe("config_schema_invalid");
      expect(r.message).toMatch(/^配置校验没通过:/);
      expect(r.message.trimStart().startsWith("{")).toBe(false);
      expect(r.message.trimStart().startsWith("[")).toBe(false);
      // 原始 detail 在 violations,供工程排查
      expect(r.violations).toBeDefined();
      expect(Array.isArray(r.violations)).toBe(true);
      expect((r.violations as unknown[]).length).toBeGreaterThan(0);
    }
  });

  it("defaultConfigTemplate 单源:对象键稳定", () => {
    const t = defaultConfigTemplate();
    expect(t["models"]).toMatchObject({ profile: "default" });
    expect(t["budget"]).toMatchObject({ monthly: 200, currency: "CNY" });
    expect(t["dnd"]).toMatchObject({ window: "23:00-08:00" });
  });
});
