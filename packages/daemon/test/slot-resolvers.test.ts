import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuditEvent, AuditSink } from "../src/obs/audit.js";
import { effectiveModelBinding } from "../src/config/projectOverrides.js";
import { parseConfigText } from "../src/config/load.js";
import {
  resolveDialogProvider,
  resolveDrafterProvider,
  resolveEvaluatorProvider,
  resolveProviderProjection,
  resolveThinkingProvider
} from "../src/providers/slotResolvers.js";

afterEach(() => vi.unstubAllGlobals());

const API_ENDPOINT = `
[providers.api.openrouter]
base_url = "https://openrouter.ai/api/v1"
api_key = "env:OPENROUTER_API_KEY"
`;

function config(thinking: string, evaluator: string, ack = false) {
  return parseConfigText(`
[models]
profile = "default"
dialog = { provider = "api", via = "openrouter", model = "openai/gpt-5.6-luna" }
thinking = ${thinking}
cheap = { provider = "api", via = "openrouter", model = "google/gemini-3.1-flash-lite" }
evaluator = ${evaluator}
${ack ? "evaluator_same_family_ack = true" : ""}
${ack ? "evaluator_isolation_ack = true" : ""}
${API_ENDPOINT}
`);
}

describe("模型槽 resolver 真值", () => {
  it("thinking API 真接通;CLI 与解析失败都回落全局 dialog 并告警", () => {
    const env = { OPENROUTER_API_KEY: "k" };
    const apiCfg = config(
      '{ provider = "api", via = "openrouter", model = "openai/gpt-5.6-terra-pro" }',
      '{ provider = "api", via = "openrouter", model = "anthropic/claude-sonnet-5" }'
    );
    const dialog = resolveDialogProvider(apiCfg, env).provider;
    const active = resolveThinkingProvider(apiCfg, env, dialog);
    expect(active).toMatchObject({ effective: "active" });
    expect(active.provider?.model).toBe("openai/gpt-5.6-terra-pro");

    const warnings: string[] = [];
    const log = { warn: (message: string) => warnings.push(message) };
    const cliCfg = config(
      '{ provider = "codex_cli", reasoning = "high" }',
      '{ provider = "api", via = "openrouter", model = "anthropic/claude-sonnet-5" }'
    );
    expect(resolveThinkingProvider(cliCfg, env, dialog, log)).toMatchObject({
      provider: dialog,
      effective: "fallback_dialog",
      reason: "cli_self_test_required",
      fallbackTo: "dialog"
    });
    expect(resolveThinkingProvider(apiCfg, {}, dialog, log)).toMatchObject({
      provider: dialog,
      effective: "fallback_dialog",
      reason: "provider_unavailable",
      fallbackTo: "dialog"
    });
    expect(warnings).toHaveLength(2);
  });

  it("project thinking override 的 binding 被 resolver 实际消费", () => {
    const env = { OPENROUTER_API_KEY: "k" };
    const cfg = config(
      '{ provider = "api", via = "openrouter", model = "openai/gpt-5.6-terra-pro" }',
      '{ provider = "api", via = "openrouter", model = "anthropic/claude-sonnet-5" }'
    );
    const override = effectiveModelBinding(
      cfg,
      { models: { thinking: { provider: "api", via: "openrouter", model: "deepseek/deepseek-r1" } } },
      "thinking"
    );
    const dialog = resolveDialogProvider(cfg, env).provider;
    const resolved = resolveThinkingProvider(cfg, env, dialog, undefined, override.binding);
    expect(override.source).toBe("project");
    expect(resolved.effective).toBe("active");
    expect(resolved.provider?.model).toBe("deepseek/deepseek-r1");
  });

  it("cheap CLI 回落 dialog 时发出 warn", () => {
    const cfg = config(
      '{ provider = "api", via = "openrouter", model = "openai/gpt-5.6-terra-pro" }',
      '{ provider = "api", via = "openrouter", model = "anthropic/claude-sonnet-5" }'
    );
    cfg.models.cheap = { provider: "codex_cli" };
    const dialog = resolveDialogProvider(cfg, { OPENROUTER_API_KEY: "k" }).provider;
    const warnings: string[] = [];
    const result = resolveDrafterProvider(cfg, { OPENROUTER_API_KEY: "k" }, dialog, {
      warn: (message) => warnings.push(message)
    });
    expect(result).toMatchObject({ effective: "fallback_dialog", fallbackTo: "dialog" });
    expect(warnings).toEqual(["cheap provider falling back to dialog"]);
  });

  it("evaluator CLI 缓存登记前不武装;同族 API 只在 same-family ack 后武装", () => {
    const env = { OPENROUTER_API_KEY: "k" };
    const cli = config(
      '{ provider = "api", via = "openrouter", model = "openai/gpt-5.6-terra-pro" }',
      '{ provider = "claude_cli" }'
    );
    expect(resolveEvaluatorProvider(cli, env)).toMatchObject({
      provider: null,
      effective: "unarmed",
      reason: "same_family_blocked"
    });

    const blocked = config(
      '{ provider = "api", via = "openrouter", model = "openai/gpt-5.6-terra-pro" }',
      '{ provider = "api", via = "openrouter", model = "openai/gpt-5.6-sol" }'
    );
    expect(resolveEvaluatorProvider(blocked, env)).toMatchObject({
      provider: null,
      effective: "unarmed",
      reason: "same_family_blocked"
    });

    const armed = config(
      '{ provider = "api", via = "openrouter", model = "openai/gpt-5.6-terra-pro" }',
      '{ provider = "api", via = "openrouter", model = "openai/gpt-5.6-sol" }',
      true
    );
    const result = resolveEvaluatorProvider(armed, env);
    expect(result.effective).toBe("active");
    expect(result.provider?.model).toBe("openai/gpt-5.6-sol");
  });

  it("四个 API 槽都在适配器边界拒绝 observedModel 家族冲突并逐槽审计", async () => {
    const cfg = config(
      '{ provider = "api", via = "openrouter", model = "openai/gpt-5.6-terra-pro" }',
      '{ provider = "api", via = "openrouter", model = "openai/gpt-5.6-sol" }',
      true
    );
    cfg.providers!.api!.openrouter!.family = "claude";
    cfg.models.cheap = { provider: "api", via: "openrouter", model: "openai/gpt-5.6-luna-mini" };
    const observedByConfiguredModel: Record<string, string> = {
      "openai/gpt-5.6-luna": "openai/gpt-5.6-luna",
      "openai/gpt-5.6-terra-pro": "openai/gpt-5.6-terra-pro",
      "openai/gpt-5.6-luna-mini": "openai/gpt-5.6-luna-mini",
      "openai/gpt-5.6-sol": "openai/gpt-5.6-sol"
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const configuredModel = (JSON.parse(String(init?.body)) as { model: string }).model;
        return new Response(
          JSON.stringify({
            model: observedByConfiguredModel[configuredModel],
            choices: [{ message: { content: "ok" } }]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      })
    );
    const events: AuditEvent[] = [];
    const audit: AuditSink = {
      record(event) {
        events.push(event);
        return { id: `aud_${events.length}` };
      }
    };
    const projection = resolveProviderProjection(cfg, { OPENROUTER_API_KEY: "k" }, undefined, audit);

    for (const slot of ["dialog", "thinking", "cheap", "evaluator"] as const) {
      await expect(
        projection[slot].provider?.chat({ messages: [{ role: "user", content: "test" }] })
      ).resolves.toMatchObject({ ok: false, code: "observed_model_family_mismatch" });
    }
    expect(events.map((event) => event.action)).toEqual([
      "provider.observed_model_rejected",
      "provider.observed_model_rejected",
      "provider.observed_model_rejected",
      "provider.observed_model_rejected"
    ]);
    expect(events.map((event) => event.meta?.["slot"])).toEqual(["dialog", "thinking", "cheap", "evaluator"]);
    expect(events.map((event) => event.meta?.["expectedFamily"])).toEqual(["claude", "claude", "claude", "claude"]);
    expect(events.map((event) => event.meta?.["observedFamily"])).toEqual(["gpt", "gpt", "gpt", "gpt"]);
  });
});
