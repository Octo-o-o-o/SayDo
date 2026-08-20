// First-run setup:probe 容错 / 向导判定 / mock fetch 保存与 restart_required / 自检三态
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deriveProviderViaName,
  getInvalidProjectOverrides,
  isDialogReadyFromProbe,
  isDialogSlotOk,
  needsSetupWizard,
  parseHealth,
  parseSetupProbe,
  parseSetupTestResult,
  postClearInvalidProjectOverrides,
  saveDialogApiConfig,
  SetupApiError,
  slotEffectiveLabel,
  setupTestSlotNote,
  slotHealthLabel,
  testStatusColor,
  testStatusLabel,
  waitForRestart,
  type SetupProbe
} from "./setupApi";
import {
  activateStagedPlan,
  enterAppAfterSetup,
  failedSetupSlots,
  planAcksSatisfied,
  preserveSetupCompletionRoute,
  SETUP_COMPLETION_ROUTE,
  summarizeTestResults
} from "../components/SetupWizard";

/** node 单测无 DOM:为 capToken/localStorage 提供最小桩 */
function stubBrowserGlobals() {
  const store = new Map<string, string>();
  vi.stubGlobal("location", { search: "", host: "127.0.0.1:47120", hostname: "127.0.0.1" });
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    }
  });
}

function minimalProbe(over: Partial<SetupProbe["config"]> & { slots?: SetupProbe["config"]["slots"] } = {}): SetupProbe {
  return {
    config: {
      present: over.present ?? false,
      slots: over.slots ?? {}
    },
    secrets: {},
    acks: { evaluator_isolation: false, evaluator_same_family: false },
    hints: [],
    clis: [],
    voice: { asr: "unknown", tts: "unknown" },
    pendingConfig: null,
    pendingEnv: null,
    recovery: { active: false, mode: "normal", violations: [] }
  };
}

describe("parseSetupProbe 缺字段容错", () => {
  it("空对象给出安全缺省,不伪精确", () => {
    const p = parseSetupProbe({});
    expect(p.config.present).toBe(false);
    expect(p.config.slots).toEqual({});
    expect(p.secrets).toEqual({});
    expect(p.acks).toEqual({ evaluator_isolation: false, evaluator_same_family: false });
    expect(p.hints).toEqual([]);
    expect(p.clis).toEqual([]);
    expect(p.voice.asr).toBe("unknown");
    expect(p.pendingConfig).toBeNull();
    expect(p.recovery).toEqual({ active: false, mode: "normal", violations: [] });
  });

  it("布尔 secrets 只认 true;字符串/1 不算已配", () => {
    const p = parseSetupProbe({
      secrets: { OPENROUTER_API_KEY: true, VOLC_ASR: "yes", VOLC_TTS: 1, X: false }
    });
    expect(p.secrets["OPENROUTER_API_KEY"]).toBe(true);
    expect(p.secrets["VOLC_ASR"]).toBe(false);
    expect(p.secrets["VOLC_TTS"]).toBe(false);
    expect(p.secrets["X"]).toBe(false);
  });

  it("槽键/状态与 pending 顶层真实形状对齐,非法值丢弃", () => {
    const p = parseSetupProbe({
      config: {
        present: true,
        slots: {
          dialog: { status: "ok", provider: "api", model: "gpt-x", effective: "active" },
          thinking: { status: "broken" },
          cheap: { status: "missing", effective: "unarmed" },
          evaluator: {
            status: "configured",
            provider: "claude_cli",
            effective: "unarmed",
            mode: "oneshot",
            reason: "cli_self_test_required"
          }
        }
      },
      recovery: {
        active: true,
        mode: "recovery_only",
        violations: [{ code: "dialog_must_be_api", message: "请改 API" }]
      },
      pendingConfig: { present: true, status: "validation_failed", error: "bad" },
      pendingEnv: { present: true }
    });
    expect(p.config.slots.dialog).toEqual({ status: "ok", provider: "api", model: "gpt-x", effective: "active" });
    expect(p.config.slots.thinking).toBeUndefined();
    expect(p.config.slots.cheap?.status).toBe("missing");
    expect(p.config.slots.evaluator).toMatchObject({
      status: "configured",
      effective: "unarmed",
      mode: "oneshot",
      reason: "cli_self_test_required"
    });
    expect(p.pendingConfig).toEqual({ present: true, status: "validation_failed", error: "bad" });
    expect(p.pendingEnv).toEqual({ present: true });
    expect(p.recovery).toEqual({
      active: true,
      mode: "recovery_only",
      violations: [{ code: "dialog_must_be_api", message: "请改 API" }]
    });
  });

  it("旧 probe 即使 status=ok,缺 effective 也 fail-closed 为 unarmed", () => {
    const p = parseSetupProbe({ config: { slots: { dialog: { status: "ok", provider: "api" } } } });
    expect(p.config.slots.dialog?.effective).toBe("unarmed");
  });

  it("clis 缺 name 跳过;found 非 true 即 false", () => {
    const p = parseSetupProbe({
      clis: [{ name: "codex", found: true, version: "1.0" }, { found: true }, { name: "claude", found: 1 }]
    });
    expect(p.clis).toEqual([{ name: "codex", found: true, version: "1.0" }, { name: "claude", found: false }]);
  });

  it("acks 与 hints 按 daemon 新字段解析", () => {
    const p = parseSetupProbe({
      acks: { evaluator_isolation: true, evaluator_same_family: false },
      hints: [{ code: "evaluator_isolation_unproven", slot: "evaluator", message: "隔离性不可证", fix: "换 claude" }]
    });
    expect(p.acks).toEqual({ evaluator_isolation: true, evaluator_same_family: false });
    expect(p.hints).toEqual([
      { code: "evaluator_isolation_unproven", slot: "evaluator", message: "隔离性不可证", fix: "换 claude" }
    ]);
  });
});

describe("first-run 判定:probe 缺槽 → 向导出现", () => {
  it("dialog 非 ok ⇒ needsSetupWizard", () => {
    expect(needsSetupWizard(minimalProbe({ slots: { dialog: { status: "missing", effective: "unarmed" } } }))).toBe(true);
    expect(needsSetupWizard(minimalProbe({ slots: { dialog: { status: "key_missing", effective: "unarmed" } } }))).toBe(true);
    expect(needsSetupWizard(minimalProbe({ slots: {} }))).toBe(true);
    expect(needsSetupWizard(null)).toBe(false);
  });

  it("dialog API realtime 与 CLI oneshot 绿灯都放行;探测失败不挡页", () => {
    const apiOk = minimalProbe({ slots: { dialog: { status: "ok", provider: "api", effective: "active" } } });
    const apiConfigured = minimalProbe({
      slots: { dialog: { status: "configured", provider: "api", effective: "active" } }
    });
    expect(needsSetupWizard(apiOk)).toBe(false);
    expect(isDialogSlotOk(apiOk)).toBe(true);
    expect(isDialogSlotOk(apiConfigured)).toBe(true);
    expect(
      isDialogSlotOk(
        minimalProbe({
          slots: {
            dialog: { status: "ok", provider: "codex_cli", effective: "active", mode: "oneshot" }
          }
        })
      )
    ).toBe(true);
    expect(isDialogSlotOk(null)).toBe(true);
    expect(isDialogSlotOk(minimalProbe({ slots: { dialog: { status: "missing", effective: "unarmed" } } }))).toBe(false);
    expect(isDialogReadyFromProbe(null)).toBe(false);
    expect(isDialogReadyFromProbe(apiOk)).toBe(true);
  });

  it.each(["codex_cli", "claude_cli", "cursor_cli", "grok_cli", "gemini_cli", "qwen_cli", "copilot_cli"])(
    "dialog=%s 未过 self-test 时不放行",
    (provider) => {
    const probe = minimalProbe({
      slots: {
        dialog: { status: "configured", provider, effective: "unarmed", mode: "oneshot", reason: "cli_self_test_required" }
      }
    });
    expect(isDialogSlotOk(probe)).toBe(false);
    expect(needsSetupWizard(probe)).toBe(true);
  });

  it("状态点人话:已配/缺 key/未配/未知", () => {
    expect(slotHealthLabel("ok")).toBe("已配");
    expect(slotHealthLabel("configured")).toBe("已配置,待自检");
    expect(slotHealthLabel("configured", true)).toBe("已配置·但暂不可用");
    expect(slotHealthLabel("key_missing")).toBe("缺 key");
    expect(slotHealthLabel("missing")).toBe("未配");
    expect(slotHealthLabel(undefined)).toBe("未知");
  });

  it("effective/reason/fallbackTo 按 resolver 实况渲染", () => {
    expect(
      slotEffectiveLabel("cheap", {
        status: "configured",
        effective: "fallback_dialog",
        reason: "cli_self_test_required",
        fallbackTo: "dialog"
      })
    ).toBe("实际走对话档模型计费");
    expect(
      slotEffectiveLabel("evaluator", {
        status: "configured",
        effective: "unarmed",
        reason: "cli_self_test_failed"
      })
    ).toBe("CLI 自检失败,当前未武装");
    expect(
      slotEffectiveLabel("dialog", { status: "configured", effective: "unarmed", reason: "recovery_only" })
    ).toBe("配置自救模式中,当前未武装");
  });
});

describe("first-run query 接线", () => {
  beforeEach(() => stubBrowserGlobals());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("同 session 并发探询共享请求,StrictMode 重放不会吞开场白", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({ sessionId: "ses_01TEST" });
      return new Response(
        JSON.stringify({ ok: true, state: "presented", delivered: true, message: "固定开场白", turnId: "onboarding-1" }),
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const { postFirstRunQuery } = await import("./setupApi");
    const first = postFirstRunQuery("ses_01TEST");
    const replay = postFirstRunQuery("ses_01TEST");
    expect(replay).toBe(first);
    await expect(first).resolves.toEqual({
      state: "presented",
      delivered: true,
      message: "固定开场白",
      turnId: "onboarding-1"
    });
    await expect(replay).resolves.toMatchObject({ state: "presented", delivered: true });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/setup/first-run/query");
  });
});

describe("cli-capability reprobe", () => {
  beforeEach(() => stubBrowserGlobals());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("POST /api/setup/cli-capability/reprobe 解析 clis,不走 confirm", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({ names: ["codex"] });
      return new Response(
        JSON.stringify({
          ok: true,
          clis: [
            {
              name: "codex",
              provider: "codex_cli",
              found: true,
              auth: { status: "logged_in" },
              enumerable: false,
              models: []
            }
          ]
        }),
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const { postReprobeCliCapabilities } = await import("./setupApi");
    const clis = await postReprobeCliCapabilities(["codex"]);
    expect(clis).toHaveLength(1);
    expect(clis[0]).toMatchObject({ name: "codex", auth: { status: "logged_in" } });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/setup/cli-capability/reprobe");
  });
});

describe("setup 完成流", () => {
  it("重启前先保留新对话路由意图", () => {
    const go = vi.fn();
    expect(SETUP_COMPLETION_ROUTE).toBe("/chat-new");
    preserveSetupCompletionRoute(true, go);
    expect(go).toHaveBeenCalledWith("/chat-new");
    go.mockClear();
    preserveSetupCompletionRoute(false, go);
    expect(go).not.toHaveBeenCalled();
  });

  it("live self-test 后 probe 已武装则就地进 app;未武装才整页进入", () => {
    const reload = vi.fn();
    const ready = minimalProbe({
      slots: { dialog: { status: "ok", provider: "codex_cli", effective: "active", mode: "oneshot" } }
    });
    expect(enterAppAfterSetup(ready, reload)).toBe("app");
    expect(reload).not.toHaveBeenCalled();
    expect(enterAppAfterSetup(minimalProbe({ slots: { dialog: { status: "missing", effective: "unarmed" } } }), reload)).toBe(
      "reload"
    );
    expect(reload).toHaveBeenCalledOnce();
    reload.mockClear();
    expect(enterAppAfterSetup(null, reload)).toBe("reload");
    expect(reload).toHaveBeenCalledOnce();
  });

  it("一键卡必须双确认,且严格按保存、自检、重启顺序激活", async () => {
    const plan = {
      requiredAcks: { evaluatorIsolation: true, evaluatorSameFamily: true }
    } as Parameters<typeof planAcksSatisfied>[0];
    expect(planAcksSatisfied(plan, { evaluatorIsolation: true, evaluatorSameFamily: false })).toBe(false);
    expect(planAcksSatisfied(plan, { evaluatorIsolation: true, evaluatorSameFamily: true })).toBe(true);

    const calls: string[] = [];
    const ok = { dialog: { status: "ok" }, thinking: { status: "ok" }, cheap: { status: "ok" }, evaluator: { status: "ok" } } as const;
    await expect(
      activateStagedPlan({
        stage: async () => { calls.push("save"); },
        test: async () => { calls.push("test"); return ok; },
        activate: async () => { calls.push("restart"); }
      })
    ).resolves.toMatchObject({ failedSlots: [] });
    expect(calls).toEqual(["save", "test", "restart"]);
  });

  it("self-test 任一槽失败时不重启", async () => {
    const calls: string[] = [];
    const failed = {
      dialog: { status: "ok" },
      thinking: { status: "fail" },
      cheap: { status: "ok" },
      evaluator: { status: "ok" }
    } as const;
    await expect(
      activateStagedPlan({
        stage: async () => { calls.push("save"); },
        test: async () => { calls.push("test"); return failed; },
        activate: async () => { calls.push("restart"); }
      })
    ).resolves.toMatchObject({ failedSlots: ["thinking"] });
    expect(calls).toEqual(["save", "test"]);
    expect(failedSetupSlots(failed)).toEqual(["thinking"]);
  });
});

describe("via 名由 baseURL 推导", () => {
  it("三例:openrouter.ai / api.openai.com / 自建域", () => {
    expect(deriveProviderViaName("https://openrouter.ai/api/v1")).toBe("openrouter");
    expect(deriveProviderViaName("https://api.openai.com/v1")).toBe("openai");
    expect(deriveProviderViaName("https://llm.mycorp.internal/v1")).toBe("llm");
  });

  it("非法字符转 _;api. 前缀跳过", () => {
    expect(deriveProviderViaName("https://my-gateway.example.com/v1")).toBe("my_gateway");
    expect(deriveProviderViaName("https://API.OpenAI.com/v1")).toBe("openai");
  });
});

describe("保存 → restart_required 提示(mock fetch)", () => {
  beforeEach(() => {
    stubBrowserGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("POST config/secret 回 restart_required:true 可解析", async () => {
    const calls: { url: string; body: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        calls.push({ url, body });
        if (url.includes("/api/setup/config")) {
          return new Response(JSON.stringify({ ok: true, restart_required: true }), { status: 200 });
        }
        if (url.includes("/api/setup/secret")) {
          return new Response(JSON.stringify({ ok: true, name: "OPENROUTER_API_KEY", restart_required: true }), {
            status: 200
          });
        }
        return new Response("not found", { status: 404 });
      })
    );
    const { postSetupConfig, postSetupSecret } = await import("./setupApi");
    const c = await postSetupConfig({
      providers: {
        api: {
          openrouter: {
            base_url: "https://openrouter.ai/api/v1",
            api_key: "env:OPENROUTER_API_KEY"
          }
        }
      },
      models: { dialog: { provider: "api", via: "openrouter", model: "deepseek/deepseek-chat" } }
    });
    const s = await postSetupSecret("OPENROUTER_API_KEY", "sk-test");
    expect(c.restart_required).toBe(true);
    expect(s.restart_required).toBe(true);
    expect(c.ok).toBe(true);
    // 保存成功后 UI 应展示「已保存,需重启服务生效」——由 restart_required 驱动
    const restartHint = c.restart_required || s.restart_required;
    expect(restartHint).toBe(true);
    expect(calls.some((x) => x.url.includes("/api/setup/config"))).toBe(true);
    expect(calls.some((x) => x.url.includes("/api/setup/secret") && (x.body as { name: string }).name === "OPENROUTER_API_KEY")).toBe(
      true
    );
  });

  it("recovery 自救先列出项目再按明确 projectIds 清除", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).endsWith("/invalid")) {
          return new Response(
            JSON.stringify({
              ok: true,
              receipt: "receipt-1",
              expiresAt: "2026-08-11T12:00:00.000Z",
              deleteWholeOverride: true,
              issues: [{
                projectId: "prj_bad",
                violations: [{ code: "project_override_invalid" }],
                affectedKeys: ["models", "budget"]
              }]
            }),
            { status: 200 }
          );
        }
        expect(String(input)).toBe("/api/setup/project-overrides/clear-invalid");
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({
          receipt: "receipt-1",
          projectIds: ["prj_bad"],
          deleteWholeOverride: true
        });
        return new Response(JSON.stringify({ ok: true, cleared: ["prj_bad"], deletedWholeOverride: true }), { status: 200 });
      })
    );
    await expect(getInvalidProjectOverrides()).resolves.toEqual({
      receipt: "receipt-1",
      expiresAt: "2026-08-11T12:00:00.000Z",
      deleteWholeOverride: true,
      issues: [{
        projectId: "prj_bad",
        violations: [{ code: "project_override_invalid" }],
        affectedKeys: ["models", "budget"]
      }]
    });
    await expect(postClearInvalidProjectOverrides("receipt-1", ["prj_bad"])).resolves.toEqual(["prj_bad"]);
  });

  it("v5:saveDialogApiConfig 提交体形状(providers + models.dialog,无 base_url 在 modelBinding)", async () => {
    const calls: { url: string; body: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        calls.push({ url, body });
        if (url.includes("/api/setup/config") || url.includes("/api/setup/secret")) {
          return new Response(JSON.stringify({ ok: true, restart_required: true, name: "OPENROUTER_API_KEY" }), {
            status: 200
          });
        }
        return new Response("not found", { status: 404 });
      })
    );

    const r = await saveDialogApiConfig({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: "sk-test-key",
      model: "deepseek/deepseek-chat"
    });
    expect(r.via).toBe("openrouter");
    expect(r.restartRequired).toBe(true);

    const configCall = calls.find((x) => x.url.includes("/api/setup/config"));
    expect(configCall).toBeDefined();
    expect(configCall!.body).toEqual({
      providers: {
        api: {
          openrouter: {
            base_url: "https://openrouter.ai/api/v1",
            api_key: "env:OPENROUTER_API_KEY"
          }
        }
      },
      models: {
        dialog: {
          provider: "api",
          via: "openrouter",
          model: "deepseek/deepseek-chat"
        }
      }
    });
    // modelBinding 不得夹带 base_url
    const dialog = (configCall!.body as { models: { dialog: Record<string, unknown> } }).models.dialog;
    expect(dialog).not.toHaveProperty("base_url");

    const secretCall = calls.find((x) => x.url.includes("/api/setup/secret"));
    expect(secretCall?.body).toEqual({ name: "OPENROUTER_API_KEY", value: "sk-test-key" });
  });

  it("saveDialogApiConfig 改用 OpenAI 端点时 config 与 secret 使用同一 env 名", async () => {
    const calls: { url: string; body: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({
          url: String(input),
          body: init?.body ? JSON.parse(String(init.body)) : null
        });
        return new Response(JSON.stringify({ ok: true, restart_required: true }), { status: 200 });
      })
    );

    await saveDialogApiConfig({
      baseURL: "https://api.openai.com/v1",
      apiKey: "sk-openai",
      model: "gpt-5.6-sol"
    });

    const config = calls.find((call) => call.url.includes("/api/setup/config"))?.body as {
      providers: { api: { openai: { api_key: string } } };
    };
    const secret = calls.find((call) => call.url.includes("/api/setup/secret"))?.body;
    expect(config.providers.api.openai.api_key).toBe("env:OPENAI_API_KEY");
    expect(secret).toEqual({ name: "OPENAI_API_KEY", value: "sk-openai" });
  });

  it("v5:422 message 原样展示且 code 不吞", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: false,
            code: "via_provider_missing",
            message: '模型槽 dialog 的 via="x" 在 providers.api 中没有对应端点'
          }),
          { status: 422 }
        )
      )
    );
    const { postSetupConfig } = await import("./setupApi");
    try {
      await postSetupConfig({
        models: { dialog: { provider: "api", via: "x", model: "m" } }
      });
      expect.fail("应抛 SetupApiError");
    } catch (e) {
      expect(e).toBeInstanceOf(SetupApiError);
      const err = e as SetupApiError;
      expect(err.message).toBe('模型槽 dialog 的 via="x" 在 providers.api 中没有对应端点');
      expect(err.code).toBe("via_provider_missing");
      expect(err.status).toBe(422);
    }
  });
});

describe("自检渲染三态", () => {
  it("parseSetupTestResult:ok/fail/untested + 兼容布尔", () => {
    const r = parseSetupTestResult({
      ok: true,
      configSource: "pending",
      envSource: "active",
      slots: {
        dialog: {
          status: "ok",
          latencyMs: 120,
          detail: "CLI 将 claude-fable-5 降级为 claude-opus-4-8(通常是订阅限流),同族仍生效"
        },
        thinking: { status: "fail", error: "CLI 不在 PATH" },
        cheap: { status: "untested" },
        evaluator: { ok: true },
        dev: { ok: false, error: "未配置" }
      }
    });
    expect(r["dialog"]).toEqual({
      status: "ok",
      latencyMs: 120,
      detail: "CLI 将 claude-fable-5 降级为 claude-opus-4-8(通常是订阅限流),同族仍生效"
    });
    expect(r["thinking"]?.status).toBe("fail");
    expect(r["thinking"]?.error).toBe("CLI 不在 PATH");
    expect(r["cheap"]?.status).toBe("untested");
    expect(r["evaluator"]?.status).toBe("ok");
    expect(r["dev"]?.status).toBe("fail");
    expect(r["configSource"]).toBeUndefined();
    expect(r["envSource"]).toBeUndefined();
  });

  it("parseSetupTestResult 收下 requestedModel;同族降级说明不依赖 detail", () => {
    const r = parseSetupTestResult({
      slots: {
        thinking: {
          status: "ok",
          requestedModel: "claude-fable-5",
          observedModel: "claude-opus-4-8"
        }
      }
    });
    expect(r["thinking"]).toEqual({
      status: "ok",
      requestedModel: "claude-fable-5",
      observedModel: "claude-opus-4-8"
    });
    expect(setupTestSlotNote(r["thinking"]!)).toBe("实际 claude-opus-4-8(claude-fable-5 被 CLI 降级)");
    expect(setupTestSlotNote({ status: "ok", observedModel: "claude-opus-4-8" })).toBe("—");
    expect(setupTestSlotNote({ status: "ok", requestedModel: "claude-fable-5", observedModel: "claude-fable-5" })).toBe(
      "—"
    );
    expect(setupTestSlotNote({ status: "fail", error: "CLI 返回错误终态(通常是用量受限或拒答),num_turns=2" })).toBe(
      "CLI 返回错误终态(通常是用量受限或拒答),num_turns=2"
    );
  });

  it("三态标签与色 token;summarize 可断言", () => {
    expect(testStatusLabel("ok")).toBe("通过");
    expect(testStatusLabel("fail")).toBe("失败");
    expect(testStatusLabel("untested")).toBe("未测");
    expect(testStatusColor("ok")).toContain("success");
    expect(testStatusColor("fail")).toContain("error");
    expect(testStatusColor("untested")).toContain("muted");
    const rows = summarizeTestResults({
      dialog: { status: "ok" },
      thinking: { status: "fail", error: "超时" },
      cheap: { status: "untested" }
    });
    expect(rows).toEqual([
      { slot: "dialog", status: "ok" },
      { slot: "thinking", status: "fail", error: "超时" },
      { slot: "cheap", status: "untested" }
    ]);
    expect(
      summarizeTestResults({
        dialog: { status: "ok" },
        thinking: { status: "ok" },
        cheap: { status: "ok" },
        evaluator: { status: "ok" },
        voice: { status: "fail", error: "语音还没配,可以先跳过——打字全功能可用" }
      }).map((row) => row.slot)
    ).toEqual(["dialog", "thinking", "cheap", "evaluator"]);
    expect(
      failedSetupSlots({
        dialog: { status: "ok" },
        thinking: { status: "ok" },
        cheap: { status: "ok" },
        evaluator: { status: "ok" },
        voice: { status: "fail", error: "可跳过" }
      })
    ).toEqual([]);
  });
});

describe("restart 轮询 health(pid 变化)", () => {
  beforeEach(() => {
    stubBrowserGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("pid 变化且 ok ⇒ 完成", async () => {
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        n += 1;
        const pid = n < 3 ? 100 : 200;
        return new Response(JSON.stringify({ ok: true, pid, startedAt: "2026-08-10T00:00:00Z" }), { status: 200 });
      })
    );
    let t = 0;
    const h = await waitForRestart(100, {
      timeoutMs: 5_000,
      intervalMs: 1,
      now: () => {
        t += 10;
        return t;
      },
      sleep: async () => {}
    });
    expect(h.pid).toBe(200);
    expect(h.ok).toBe(true);
  });

  it("超时给人话失败", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true, pid: 100 }), { status: 200 }))
    );
    let t = 0;
    await expect(
      waitForRestart(100, {
        timeoutMs: 50,
        intervalMs: 1,
        now: () => {
          t += 20;
          return t;
        },
        sleep: async () => {}
      })
    ).rejects.toThrow(/重启超时/);
  });

  it("parseHealth 容错", () => {
    expect(parseHealth({ ok: true, pid: 1, startedAt: "t" })).toEqual({ ok: true, pid: 1, startedAt: "t" });
    expect(parseHealth({})).toEqual({ ok: false, pid: undefined, startedAt: undefined });
  });
});

// ---- 多槽位供给的 T17 API 规则与存量 CLI 兼容 ----

describe("parseCliCapabilities 容错", () => {
  it("解析三家能力;未知 auth 状态归 unknown 不伪造", async () => {
    const { parseCliCapabilities } = await import("./setupApi");
    const list = parseCliCapabilities({
      clis: [
        {
          name: "cursor-agent",
          provider: "cursor_cli",
          found: true,
          auth: { status: "logged_in" },
          enumerable: true,
          models: [
            { id: "gpt-5.3-codex", label: "Codex 5.3", source: "listed" },
            { id: "auto", source: "alias" },
            { id: "missing-source" }
          ]
        },
        { name: "codex", provider: "codex_cli", found: true, auth: { status: "weird" }, enumerable: false, models: [] },
        { name: "不是CLI", found: true }
      ]
    });
    expect(list.length).toBe(2); // 非法 name 被丢弃
    expect(list[0]?.models.map((m) => m.id)).toEqual(["gpt-5.3-codex", "auto"]);
    expect(list[1]?.auth.status).toBe("unknown");
  });

  it("缺 clis 字段 ⇒ 空数组(不抛)", async () => {
    const { parseCliCapabilities } = await import("./setupApi");
    expect(parseCliCapabilities({})).toEqual([]);
    expect(parseCliCapabilities(null)).toEqual([]);
  });

  it("grok_cli 已接线可解析;kimi inventory-only 仍不可用", async () => {
    const { parseCliCapabilities, cliUsable, cliWiredForSupply } = await import("./setupApi");
    const list = parseCliCapabilities({
      clis: [
        {
          name: "grok",
          provider: "grok_cli",
          label: "Grok",
          found: true,
          auth: { status: "logged_in" },
          enumerable: true,
          models: [{ id: "grok-4.5", source: "listed" }]
        },
        {
          name: "kimi",
          provider: null,
          found: true,
          auth: { status: "logged_in" },
          enumerable: false,
          models: []
        }
      ]
    });
    expect(list).toHaveLength(2);
    expect(list[0]?.provider).toBe("grok_cli");
    expect(cliWiredForSupply(list[0]!)).toBe(true);
    expect(cliUsable(list[0]!)).toBe(true);
    expect(list[1]?.provider).toBeNull();
    expect(cliUsable(list[1]!)).toBe(false);
  });

  it("gemini/qwen/copilot 接线并保留 billing provenance", async () => {
    const { parseCliCapabilities, cliWiredForSupply, WIRED_CLI_NAMES } = await import("./setupApi");
    expect(WIRED_CLI_NAMES).toEqual(["cursor-agent", "codex", "claude", "grok", "gemini", "qwen", "copilot"]);
    const list = parseCliCapabilities({
      clis: [
        {
          name: "gemini",
          provider: "gemini_cli",
          found: true,
          auth: { status: "logged_in" },
          enumerable: false,
          models: [],
          billing: { provenance: "subscription", detail: "gemini oauth-personal" }
        },
        {
          name: "qwen",
          provider: "qwen_cli",
          found: true,
          auth: { status: "not_logged_in", fixHint: "配置 OpenAI 兼容端点或 OPENAI_API_KEY(0.18 已移除 qwen auth)" },
          enumerable: false,
          models: [],
          billing: { provenance: "external_api" }
        },
        {
          name: "copilot",
          provider: "copilot_cli",
          found: true,
          auth: { status: "unknown" },
          enumerable: false,
          models: [],
          billing: { provenance: "unknown" }
        }
      ]
    });
    expect(list.map((item) => item.provider)).toEqual(["gemini_cli", "qwen_cli", "copilot_cli"]);
    expect(list.every((item) => cliWiredForSupply(item))).toBe(true);
    expect(list[0]?.billing).toEqual({ provenance: "subscription", detail: "gemini oauth-personal" });
    expect(list[1]?.auth.fixHint).toContain("已移除 qwen auth");
    expect(list[2]?.billing?.provenance).toBe("unknown");
  });

  it("confirm 端点结果可解析并原位并回画像", async () => {
    const { parseConfirmCliCapability, applyConfirmCliResult } = await import("./setupApi");
    const parsed = parseConfirmCliCapability({
      ok: true,
      name: "gemini",
      auth: "logged_in",
      confirmed: true,
      observedModel: "gemini-2.5-flash",
      detail: "受控一发成功",
      billing: { provenance: "subscription" }
    });
    expect(parsed).toMatchObject({ ok: true, confirmed: true, observedModel: "gemini-2.5-flash" });
    const merged = applyConfirmCliResult(
      {
        name: "gemini",
        provider: "gemini_cli",
        found: true,
        auth: { status: "unknown", fixHint: "测一下" },
        enumerable: false,
        models: []
      },
      parsed!
    );
    expect(merged.auth).toEqual({ status: "logged_in", detail: "受控一发成功" });
    expect(merged.models).toEqual([{ id: "gemini-2.5-flash", source: "listed" }]);
    expect(merged.billing).toEqual({ provenance: "subscription" });
  });
});

describe("API key env 名归一(白名单只放行三个)", () => {
  it("按 host 归一;认不出的借 OPENROUTER 槽", async () => {
    const { apiKeyEnvForBaseUrl } = await import("./setupApi");
    expect(apiKeyEnvForBaseUrl("https://api.openai.com/v1")).toBe("OPENAI_API_KEY");
    expect(apiKeyEnvForBaseUrl("https://api.anthropic.com")).toBe("ANTHROPIC_API_KEY");
    expect(apiKeyEnvForBaseUrl("https://openrouter.ai/api/v1")).toBe("OPENROUTER_API_KEY");
    expect(apiKeyEnvForBaseUrl("https://my-gateway.internal/v1")).toBe("OPENROUTER_API_KEY");
  });
});

describe("supplyReady:各家必填项不同", () => {
  it("codex/claude 允许留空模型;cursor 必须选模型", async () => {
    const { supplyReady } = await import("../components/SupplyPicker");
    expect(supplyReady({ kind: "cli", provider: "codex_cli" })).toBe(true);
    expect(supplyReady({ kind: "cli", provider: "claude_cli" })).toBe(true);
    expect(supplyReady({ kind: "cli", provider: "gemini_cli" })).toBe(true);
    expect(supplyReady({ kind: "cli", provider: "qwen_cli" })).toBe(true);
    expect(supplyReady({ kind: "cli", provider: "copilot_cli" })).toBe(true);
    expect(supplyReady({ kind: "cli", provider: "cursor_cli" })).toBe(false);
    expect(supplyReady({ kind: "cli", provider: "cursor_cli", model: "gpt-5.3-codex" })).toBe(true);
    expect(supplyReady({ kind: "skip" })).toBe(true);
    expect(supplyReady({ kind: "api", baseURL: "https://x/v1", apiKey: "", model: "m" })).toBe(false);
    expect(
      supplyReady({
        kind: "api",
        baseURL: "https://api.openai.com/v1",
        apiKey: "",
        presentKeyNames: ["OPENAI_API_KEY"],
        model: "m"
      })
    ).toBe(true);
    expect(
      supplyReady({
        kind: "api",
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: "",
        presentKeyNames: ["OPENAI_API_KEY"],
        model: "m"
      })
    ).toBe(false);
    expect(
      supplyReady({
        kind: "api",
        baseURL: "http://api.openai.com/v1",
        apiKey: "",
        presentKeyNames: ["OPENAI_API_KEY"],
        model: "m"
      })
    ).toBe(false);
    expect(
      supplyReady({
        kind: "api",
        baseURL: "https://evil.example/v1",
        apiKey: "",
        presentKeyNames: ["OPENROUTER_API_KEY"],
        model: "m"
      })
    ).toBe(false);
    expect(
      supplyReady({
        kind: "api",
        baseURL: "https://custom.internal/v1",
        apiKey: "",
        presentKeyNames: ["OPENROUTER_API_KEY"],
        writtenKeyBaseURL: "https://custom.internal/v1",
        model: "m"
      })
    ).toBe(true);
    expect(supplyReady({ kind: "api", baseURL: "https://x/v1", apiKey: "k", model: "m" })).toBe(true);
  });
});

describe("saveSlotSupplies:多槽多 CLI 混搭一次提交", () => {
  beforeEach(() => {
    stubBrowserGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("CLI 槽不写 key;API 槽写 providers + secret;skip 槽不出现", async () => {
    type CapturedBody = {
      models?: Record<string, unknown>;
      providers?: { api?: Record<string, { api_key?: string }> };
      name?: string;
    };
    const calls: { url: string; body: CapturedBody }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, body: (init?.body ? JSON.parse(String(init.body)) : {}) as CapturedBody });
        return new Response(JSON.stringify({ ok: true, restart_required: true }), { status: 200 });
      })
    );
    const { saveSlotSupplies } = await import("./setupApi");
    const r = await saveSlotSupplies({
      dialog: { kind: "cli", provider: "cursor_cli", model: "claude-opus-5-thinking-high" },
      thinking: { kind: "cli", provider: "codex_cli" },
      cheap: { kind: "api", baseURL: "https://openrouter.ai/api/v1", apiKey: "sk-x", model: "deepseek/deepseek-chat" },
      evaluator: { kind: "skip" }
    });
    expect(r.savedSlots).toEqual(["dialog", "thinking", "cheap"]);

    const cfg = calls.find((c) => c.url.includes("/api/setup/config"))!.body;
    const models = cfg.models ?? {};
    // 三槽各自独立 provider,CLI 与 API 混搭
    expect(models["dialog"]).toEqual({ provider: "cursor_cli", model: "claude-opus-5-thinking-high" });
    // codex 无模型 ⇒ 只写 provider(用 CLI 默认模型)
    expect(models["thinking"]).toEqual({ provider: "codex_cli" });
    expect(models["cheap"]).toEqual({ provider: "api", via: "openrouter", model: "deepseek/deepseek-chat" });
    expect(models["evaluator"]).toBeUndefined();
    expect(cfg.providers?.api?.["openrouter"]?.api_key).toBe("env:OPENROUTER_API_KEY");

    // key 只为 API 槽写一次;CLI 槽不产生 secret 调用
    const secretCalls = calls.filter((c) => c.url.includes("/api/setup/secret"));
    expect(secretCalls.length).toBe(1);
    expect(secretCalls[0]!.body.name).toBe("OPENROUTER_API_KEY");
  });

  it("全部 skip ⇒ 不发请求", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { saveSlotSupplies } = await import("./setupApi");
    const r = await saveSlotSupplies({ thinking: { kind: "skip" }, cheap: { kind: "skip" } });
    expect(r.savedSlots).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("高级 step2 保存会重带 step1 dialog,并只续写用户新选的 API 槽", async () => {
    const { advancedSuppliesForSave } = await import("../components/SetupWizard");
    const dialog = {
      kind: "api" as const,
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: "",
      model: "deepseek/deepseek-chat",
      presentKeyNames: ["OPENROUTER_API_KEY" as const]
    };
    const merged = advancedSuppliesForSave(
      dialog,
      {
      dialog: { kind: "skip" },
        thinking: {
          kind: "api",
          baseURL: "https://openrouter.ai/api/v1",
          apiKey: "",
          model: "openai/gpt-5.6-terra-pro",
          presentKeyNames: ["OPENROUTER_API_KEY"]
        },
        cheap: { kind: "skip" },
        evaluator: {
          kind: "api",
          baseURL: "https://openrouter.ai/api/v1",
          apiKey: "",
          model: "anthropic/claude-sonnet-5",
          presentKeyNames: ["OPENROUTER_API_KEY"]
        }
      }
    );
    expect(merged).toEqual({
      dialog,
      thinking: {
        kind: "api",
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: "",
        model: "openai/gpt-5.6-terra-pro",
        presentKeyNames: ["OPENROUTER_API_KEY"]
      },
      evaluator: {
        kind: "api",
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: "",
        model: "anthropic/claude-sonnet-5",
        presentKeyNames: ["OPENROUTER_API_KEY"]
      }
    });
  });
});

describe("SLOT_POLICY 的 CLI 实施规则", () => {
  it("dialog 已接线 CLI 都可选并如实说明慢速模式", async () => {
    const { SLOT_POLICY } = await import("./setupApi");
    const { WIRED_CLI_PROVIDERS } = await import("@saydo/contracts");
    expect(SLOT_POLICY.dialog.allowedCli).toEqual([...WIRED_CLI_PROVIDERS]);
    expect(SLOT_POLICY.dialog.caveat).toContain("15-25 秒");
  });

  it("四槽 CLI 可提交;cursor 仍要求显式模型", async () => {
    const { SLOT_POLICY } = await import("./setupApi");
    const { supplyReady, supplyBlockReason } = await import("../components/SupplyPicker");
    const pick = { kind: "cli", provider: "cursor_cli", model: "claude-opus-5-thinking-high" } as const;
    expect(supplyReady(pick, SLOT_POLICY.dialog)).toBe(true);
    expect(supplyBlockReason(pick, SLOT_POLICY.dialog)).toBeNull();
    expect(supplyReady(pick, SLOT_POLICY.cheap)).toBe(true);
    expect(supplyReady({ kind: "cli", provider: "cursor_cli" }, SLOT_POLICY.cheap)).toBe(false);
  });

  it("evaluator CLI 需要隔离 ack,其余槽不代加确认", async () => {
    const { SLOT_POLICY } = await import("./setupApi");
    const { supplyReady } = await import("../components/SupplyPicker");
    expect(supplyReady({ kind: "cli", provider: "codex_cli" }, SLOT_POLICY.thinking)).toBe(true);
    expect(supplyReady({ kind: "cli", provider: "codex_cli" }, SLOT_POLICY.evaluator)).toBe(false);
    expect(supplyReady({ kind: "cli", provider: "codex_cli", ack: true }, SLOT_POLICY.evaluator)).toBe(true);
  });
});

describe("异族知情豁免:同族不是死路", () => {
  beforeEach(() => {
    stubBrowserGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("勾了确认 ⇒ ack 落进 models(不是只放在请求里,晋升/重启后仍成立)", async () => {
    const bodies: Array<Record<string, Record<string, unknown>>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(init?.body ? JSON.parse(String(init.body)) : {});
        return new Response(JSON.stringify({ ok: true, restart_required: true }), { status: 200 });
      })
    );
    const { saveSlotSupplies } = await import("./setupApi");
    await saveSlotSupplies(
      { evaluator: { kind: "api", baseURL: "https://openrouter.ai/api/v1", apiKey: "", model: "openai/gpt-5.6-sol", presentKeyNames: ["OPENROUTER_API_KEY"] } },
      { evaluatorSameFamilyAck: true }
    );
    const models = bodies.find((b) => b["models"])?.["models"];
    expect(models?.["evaluator_same_family_ack"]).toBe(true);
  });

  it("没勾 ⇒ 不写 ack 字段(默认仍走 fail-closed)", async () => {
    const bodies: Array<Record<string, Record<string, unknown>>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(init?.body ? JSON.parse(String(init.body)) : {});
        return new Response(JSON.stringify({ ok: true, restart_required: true }), { status: 200 });
      })
    );
    const { saveSlotSupplies } = await import("./setupApi");
    await saveSlotSupplies({
      evaluator: {
        kind: "api",
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: "",
        model: "anthropic/claude-sonnet-5",
        presentKeyNames: ["OPENROUTER_API_KEY"]
      }
    });
    const models = bodies.find((b) => b["models"])?.["models"];
    expect(models).toBeDefined();
    expect(models?.["evaluator_same_family_ack"]).toBeUndefined();
  });

  it("撤销引导可把两条 ack 与新 evaluator 同次显式写 false", async () => {
    const bodies: Array<Record<string, Record<string, unknown>>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(init?.body ? JSON.parse(String(init.body)) : {});
        return new Response(JSON.stringify({ ok: true, restart_required: true }), { status: 200 });
      })
    );
    const { saveSlotSupplies } = await import("./setupApi");
    await saveSlotSupplies(
      {
        evaluator: {
          kind: "api",
          baseURL: "https://openrouter.ai/api/v1",
          apiKey: "",
          model: "anthropic/claude-sonnet-5",
          presentKeyNames: ["OPENROUTER_API_KEY"]
        }
      },
      { evaluatorIsolationAck: false, evaluatorSameFamilyAck: false }
    );
    const models = bodies.find((body) => body["models"])?.["models"];
    expect(models?.["evaluator"]).toEqual({
      provider: "api",
      via: "openrouter",
      model: "anthropic/claude-sonnet-5"
    });
    expect(models?.["evaluator_isolation_ack"]).toBe(false);
    expect(models?.["evaluator_same_family_ack"]).toBe(false);
  });

  it("daemon 422 的真实形状:顶层 code 恒是 config_validation_failed,具体码在 violations 里", async () => {
    // 下面这份响应体逐字取自真实 daemon(2026-08-10 curl 实测)。
    // 早先这条测试用的是想当然的 {code:"evaluator_same_family"},测试绿但线上确认框从未弹出。
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: false,
            code: "config_validation_failed",
            message: "就绪评估器默认要与 dialog/thinking 异族(防相关错误链,04 §2.3):evaluator=gpt 与 dialog 同族",
            violations: [
              {
                code: "evaluator_same_family",
                slot: "evaluator",
                message: "就绪评估器默认要与 dialog/thinking 异族",
                fix: "换成另一家族,或在 [models] 写 evaluator_same_family_ack = true"
              }
            ],
            retryable: false
          }),
          { status: 422 }
        )
      )
    );
    const { saveSlotSupplies, SetupApiError, ACKABLE_VIOLATION } = await import("./setupApi");
    const err = await saveSlotSupplies({
      evaluator: {
        kind: "api",
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: "",
        model: "openai/gpt-5.6-sol",
        presentKeyNames: ["OPENROUTER_API_KEY"]
      }
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SetupApiError);
    const se = err as InstanceType<typeof SetupApiError>;
    // 顶层 code 匹配不上——这正是原来的 bug
    expect(se.code).toBe("config_validation_failed");
    expect(se.code).not.toBe(ACKABLE_VIOLATION.sameFamily);
    // 必须靠 violations 才认得出来
    expect(se.violations.map((v) => v.code)).toContain(ACKABLE_VIOLATION.sameFamily);
    expect(se.hasViolation(ACKABLE_VIOLATION.sameFamily)).toBe(true);
    expect(se.hasViolation("something_else")).toBe(false);
  });

  it("hasViolation 顶层 code 也认(防 daemon 换形状)", async () => {
    const { SetupApiError } = await import("./setupApi");
    expect(new SetupApiError("x", { code: "evaluator_same_family" }).hasViolation("evaluator_same_family")).toBe(true);
    expect(new SetupApiError("x").hasViolation("evaluator_same_family")).toBe(false);
  });

  it("422 violations 没有 code 时仍逐条人话展示", async () => {
    const { setupErrorMessage, SetupApiError } = await import("./setupApi");
    const text = setupErrorMessage(
      new SetupApiError("配置校验没通过", {
        status: 422,
        violations: [{ path: "models.dialog", message: "字段不符合 schema" }]
      })
    );
    expect(text).toContain("models.dialog");
    expect(text).toContain("字段不符合 schema");
  });
});

describe("provider 契约表驱动 model 规则", () => {
  it("覆盖全部已接线 provider,且只有 cursor 必填", async () => {
    const { CLI_PROVIDER_CONTRACT, cliModelRequired, cliModelEditable, cliDefaultModelLabel } = await import("./setupApi");
    const { WIRED_CLI_PROVIDERS } = await import("@saydo/contracts");
    expect(Object.keys(CLI_PROVIDER_CONTRACT).sort()).toEqual([...WIRED_CLI_PROVIDERS].sort());
    expect(cliModelRequired("cursor_cli")).toBe(true);
    expect(cliModelEditable("cursor_cli")).toBe(true);
    for (const provider of WIRED_CLI_PROVIDERS.filter((item) => item !== "cursor_cli")) {
      expect(cliModelRequired(provider)).toBe(false);
    }
    expect(cliModelEditable("codex_cli")).toBe(true);
    expect(cliModelEditable("claude_cli")).toBe(true);
    expect(cliModelEditable("grok_cli")).toBe(true);
    expect(cliModelEditable("gemini_cli")).toBe(true);
    expect(cliModelEditable("qwen_cli")).toBe(true);
    expect(cliModelEditable("copilot_cli")).toBe(true);
    expect(cliDefaultModelLabel("codex_cli")).toContain("Codex");
    expect(CLI_PROVIDER_CONTRACT.codex_cli.defaultSlotModels).toEqual({
      dialog: "gpt-5.6-sol",
      thinking: "gpt-5.6-sol",
      cheap: "gpt-5.6-luna",
      evaluator: "gpt-5.6-sol"
    });
    expect(CLI_PROVIDER_CONTRACT.claude_cli.defaultSlotModels).toEqual({
      dialog: "claude-fable-5",
      thinking: "claude-fable-5",
      cheap: "claude-opus-5",
      evaluator: "claude-fable-5"
    });
    expect(CLI_PROVIDER_CONTRACT.cursor_cli.defaultSlotModels).toEqual({
      dialog: "cursor-grok-4.6-high-fast",
      thinking: "cursor-grok-4.6-high-fast",
      cheap: "composer-2.5-fast",
      evaluator: "cursor-grok-4.6-high-fast"
    });
    expect(CLI_PROVIDER_CONTRACT.grok_cli.defaultSlotModels).toEqual({
      dialog: "grok-4.6",
      thinking: "grok-4.6",
      cheap: "grok-4.6",
      evaluator: "grok-4.6"
    });
    for (const provider of WIRED_CLI_PROVIDERS) {
      expect(CLI_PROVIDER_CONTRACT[provider].defaultSlotModels).toMatchObject({
        dialog: expect.any(String),
        thinking: expect.any(String),
        cheap: expect.any(String),
        evaluator: expect.any(String)
      });
    }
  });
});

describe("评估槽 CLI 资格:T18 已实施", () => {
  it("三家 CLI 均须显式隔离 ack 后才可提交", async () => {
    const { SLOT_POLICY } = await import("./setupApi");
    const { supplyReady, cliNeedsAck } = await import("../components/SupplyPicker");
    const p = SLOT_POLICY.evaluator;
    const { WIRED_CLI_PROVIDERS } = await import("@saydo/contracts");
    expect(p.allowedCli).toEqual([...WIRED_CLI_PROVIDERS]);
    for (const prov of WIRED_CLI_PROVIDERS) {
      expect(cliNeedsAck(prov, p)).toBe(true);
      expect(supplyReady({ kind: "cli", provider: prov, model: "m" }, p)).toBe(false);
      expect(supplyReady({ kind: "cli", provider: prov, model: "m", ack: true }, p)).toBe(true);
    }
  });
});

describe("知情确认的文案要对上各自的代价", () => {
  it("每个要求确认的槽都得有自己的 ack 文案,不能共用", async () => {
    const { SLOT_POLICY, WIZARD_SLOTS } = await import("./setupApi");
    for (const slot of WIZARD_SLOTS) {
      const p = SLOT_POLICY[slot];
      if (!p.cliAckRequiredFor?.length) continue;
      expect(p.cliAckLabel, `${slot} 槽要求勾确认却没写 ack 文案`).toBeTruthy();
    }
    // dialog 慢速代价由卡面说明;只有 evaluator 的隔离边界需要落 ack。
    expect(SLOT_POLICY.dialog.cliAckLabel).toBeUndefined();
    expect(SLOT_POLICY.evaluator.cliAckLabel).toContain("本机读取边界");
  });
});

describe("登录态显式重探(v2.5)", () => {
  it("未登录/未知才需要行内重探;整区 names 走已探测列表否则目录全量", async () => {
    const { cliAuthNeedsReprobe, namesForFullReprobe, PROBE_CLI_NAMES } = await import("./setupApi");
    expect(cliAuthNeedsReprobe("not_logged_in")).toBe(true);
    expect(cliAuthNeedsReprobe("unknown")).toBe(true);
    expect(cliAuthNeedsReprobe("logged_in")).toBe(false);
    expect(cliAuthNeedsReprobe("not_found")).toBe(false);
    expect(namesForFullReprobe([{ name: "claude" }, { name: "codex" }, { name: "claude" }])).toEqual([
      "claude",
      "codex"
    ]);
    expect(namesForFullReprobe([])).toEqual([...PROBE_CLI_NAMES]);
  });
});
