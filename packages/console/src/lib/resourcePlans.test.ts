import { describe, expect, it } from "vitest";
import {
  allCliPlan,
  apiDraftFromSecrets,
  apiKeyPlan,
  cliUsableForPlans,
  costCopyForProvenance,
  defaultModelId,
  filterModelOptions,
  followSlotToPreset,
  listAvailableSupplies,
  listUnreadyClis,
  mixedPlan,
  mixedPrefillForFailedPlan,
  mixedSlotsOf,
  needsCapabilityReprobe,
  oneKeyFromForm,
  planForAvailableSupply,
  requiredAcksForSupplies,
  resolveCliPortraitAction,
  resolveDefaultSlotModels,
  presetSupplyForSlot,
  applySlotHousePreset,
  decideLeftRailSelect,
  MIX_SNAPSHOT_ID,
  mixSnapshotLine,
  reduceMixAfterEdit,
  reduceMixAfterSelectHouse,
  reduceMixRestore,
  shouldConfirmLeftSupplyChange,
  startButtonLabel,
  supplyOneLiner,
  suppliesWithModels,
  unreadyCliAllowsLiveCheck,
  unreadyReasonCopy,
  type QuickConfigPlan,
  type ResourceProfile
} from "./resourcePlans";
import type { CliCapability } from "./setupApi";
import { supplyReady } from "../components/SupplyPicker";

function slotModelsOf(plan: QuickConfigPlan): Record<string, string | undefined> {
  return {
    dialog: plan.supplies.dialog.kind === "cli" ? plan.supplies.dialog.model : undefined,
    thinking: plan.supplies.thinking.kind === "cli" ? plan.supplies.thinking.model : undefined,
    cheap: plan.supplies.cheap.kind === "cli" ? plan.supplies.cheap.model : undefined,
    evaluator: plan.supplies.evaluator.kind === "cli" ? plan.supplies.evaluator.model : undefined
  };
}

function cli(overrides: Partial<CliCapability> = {}): CliCapability {
  return {
    name: "codex",
    provider: "codex_cli",
    found: true,
    auth: { status: "logged_in" },
    enumerable: false,
    models: [],
    ...overrides
  };
}

function profile(secrets: Record<string, boolean>, clis: CliCapability[] = [cli()]): ResourceProfile {
  return { secrets, clis };
}

describe("listAvailableSupplies", () => {
  it("只列已登录 wired CLI 与已存 key,inventory 与未登录不进", () => {
    const supplies = listAvailableSupplies(
      profile(
        { OPENROUTER_API_KEY: true },
        [
          cli({ models: [{ id: "gpt-5.6", source: "used", seen: 3 }] }),
          cli({ name: "opencode", provider: null, found: true, auth: { status: "logged_in" } }),
          cli({ name: "claude", provider: "claude_cli", auth: { status: "not_logged_in" } })
        ]
      )
    );
    expect(supplies.map((item) => item.id)).toEqual(["cli:codex", "api:OPENROUTER_API_KEY"]);
    expect(supplyOneLiner(supplies[0]!)).toContain("已登录");
    expect(supplyOneLiner(supplies[0]!)).toContain("本机用过 1 个模型");
    expect(supplyOneLiner(supplies[1]!)).toContain("已存 key");
    expect(supplyOneLiner(supplies[1]!)).not.toContain("有效 key");
  });

  it("空态:无可用 CLI 也无 key", () => {
    expect(listAvailableSupplies(profile({}, []))).toEqual([]);
    expect(listAvailableSupplies(profile({}, [cli({ auth: { status: "not_logged_in" } })]))).toEqual([]);
    const autoOnly = cli({
      name: "cursor-agent",
      provider: "cursor_cli",
      enumerable: true,
      models: [{ id: "auto", source: "listed" }]
    });
    expect(cliUsableForPlans(autoOnly)).toBe(false);
    expect(listAvailableSupplies(profile({}, [autoOnly]))).toEqual([]);
  });

  it("选中供给用 allCliPlan / apiKeyPlan factory,不再生成三席推荐卡", () => {
    const resources = profile({ OPENROUTER_API_KEY: true }, [
      cli({ models: [{ id: "gpt-5.6", source: "used", seen: 3 }], billing: { provenance: "subscription" } })
    ]);
    const supplies = listAvailableSupplies(resources);
    expect(supplies).toHaveLength(2);
    expect(planForAvailableSupply(supplies[0]!)).toMatchObject({
      id: "all-cli-codex_cli",
      shape: "all-cli",
      supplies: {
        dialog: { kind: "cli", provider: "codex_cli", model: "gpt-5.6-sol" },
        cheap: { kind: "cli", provider: "codex_cli", model: "gpt-5.6-luna" }
      }
    });
    expect(planForAvailableSupply(supplies[1]!)).toMatchObject({
      id: "one-api-key",
      shape: "all-api"
    });
  });
});

describe("listUnreadyClis", () => {
  it("未登录/超时/inventory 进未就绪;未安装不进", () => {
    const unready = listUnreadyClis([
      cli({ auth: { status: "logged_in" } }),
      cli({ name: "claude", provider: "claude_cli", auth: { status: "not_logged_in", fixHint: "claude auth login" } }),
      cli({ name: "gemini", provider: "gemini_cli", auth: { status: "unknown" }, found: true }),
      cli({ name: "opencode", provider: null, found: true, auth: { status: "logged_in" } }),
      cli({ name: "qwen", provider: "qwen_cli", found: false, auth: { status: "not_found" } })
    ]);
    expect(unready.map((item) => item.name)).toEqual(["opencode", "claude", "gemini"]);
    expect(unreadyReasonCopy(unready[0]!)).toContain("暂不能当模型供给");
    expect(unreadyReasonCopy(unready[1]!)).toContain("claude auth login");
    expect(unreadyReasonCopy(unready[2]!)).toBe("探测超时");
    expect(needsCapabilityReprobe(unready[2]!)).toBe(true);
    expect(needsCapabilityReprobe(unready[1]!)).toBe(false);
    expect(unreadyCliAllowsLiveCheck(unready[0]!)).toBe(false);
    expect(unreadyCliAllowsLiveCheck(unready[1]!)).toBe(true);
    expect(unreadyCliAllowsLiveCheck(unready[2]!)).toBe(true);
  });

  it("登录成功后从 unready 升入主列表(刷新后主网格同步)", () => {
    const loggedOut = cli({ name: "claude", provider: "claude_cli", auth: { status: "not_logged_in" } });
    expect(listAvailableSupplies(profile({}, [loggedOut]))).toEqual([]);
    expect(listUnreadyClis([loggedOut]).map((item) => item.name)).toEqual(["claude"]);
    const loggedIn = cli({ name: "claude", provider: "claude_cli", auth: { status: "logged_in" } });
    expect(listAvailableSupplies(profile({}, [loggedIn])).map((item) => item.id)).toEqual(["cli:claude"]);
    expect(listUnreadyClis([loggedIn])).toEqual([]);
  });
});

describe("plan factories", () => {
  it("allCliPlan 仍是选中供给到四槽的 factory", () => {
    const gemini = cli({
      name: "gemini",
      provider: "gemini_cli",
      billing: { provenance: "unknown" },
      models: [{ id: "gemini-2.5-pro", source: "listed" }]
    });
    const plan = allCliPlan(gemini);
    expect(plan).toMatchObject({
      id: "all-cli-gemini_cli",
      shape: "all-cli",
      supplies: {
        dialog: { kind: "cli", provider: "gemini_cli", model: "gemini-3.2-pro" },
        thinking: { kind: "cli", provider: "gemini_cli", model: "gemini-3.2-pro" },
        cheap: { kind: "cli", provider: "gemini_cli", model: "gemini-3.2-flash" }
      }
    });
    expect(plan.cost).toContain("每轮约 15-25 秒");
  });

  it("mixedPlan 可预填但不自动降级", () => {
    const resources = profile({ OPENROUTER_API_KEY: true }, [cli({ billing: { provenance: "subscription" } })]);
    const failed = allCliPlan(resources.clis[0]!);
    const prefill = mixedPrefillForFailedPlan(failed, resources);
    expect(prefill).toMatchObject({
      id: "mixed-codex_cli",
      shape: "mixed",
      supplies: { dialog: { kind: "api" }, thinking: { kind: "cli", provider: "codex_cli" } }
    });
    expect(mixedPlan(resources.clis[0]!)).toEqual(prefill);
    expect(mixedPrefillForFailedPlan(apiKeyPlan("OPENROUTER_API_KEY"), resources)).toBeUndefined();
  });

  it("空表单一 key 构造完整四槽 pending", () => {
    const plan = oneKeyFromForm({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: "sk-test",
      model: "openai/gpt-5.6-luna"
    });
    expect(plan.shape).toBe("all-api");
    expect(Object.values(plan.supplies).every((supply) => supply.kind === "api" && supply.model === "openai/gpt-5.6-luna")).toBe(
      true
    );
    expect(plan.supplies.dialog).toMatchObject({ apiKey: "sk-test" });
  });

  it("成本文案按 provenance 分流,缺字段当 unknown", () => {
    expect(costCopyForProvenance("subscription")).toBe("订阅内零成本");
    expect(costCopyForProvenance("external_api")).toBe("按该 CLI 配置的上游计费,SayDo 不代付");
    expect(costCopyForProvenance("unknown")).toBe("计费方式未知,以你的 CLI 账单为准");
    expect(costCopyForProvenance(undefined)).toBe("计费方式未知,以你的 CLI 账单为准");
    expect(allCliPlan(cli({ billing: { provenance: "external_api" } })).cost).toContain(
      "按该 CLI 配置的上游计费,SayDo 不代付"
    );
    expect(allCliPlan(cli()).title).toContain("计费方式未知,以你的 CLI 账单为准");
  });

  it("画像行按登录/接线/模型态分派直达动作", () => {
    expect(
      resolveCliPortraitAction(cli({ name: "codex", provider: "codex_cli", auth: { status: "logged_in" } }))
    ).toBe("use_all");
    expect(
      resolveCliPortraitAction(
        cli({ name: "qwen", provider: "qwen_cli", auth: { status: "not_logged_in" }, found: true })
      )
    ).toBe("login_and_reprobe");
    expect(
      resolveCliPortraitAction(cli({ name: "gemini", provider: "gemini_cli", auth: { status: "unknown" }, found: true }))
    ).toBe("confirm");
    expect(
      resolveCliPortraitAction(cli({ name: "kimi", provider: null, found: true, auth: { status: "logged_in" } }))
    ).toBe("inventory_only");
    expect(
      resolveCliPortraitAction(
        cli({
          name: "cursor-agent",
          provider: "cursor_cli",
          enumerable: true,
          models: [{ id: "auto", source: "listed" }]
        })
      )
    ).toBe("none");
    expect(resolveCliPortraitAction(cli({ found: false, auth: { status: "not_found" } }))).toBe("none");
  });

  it("模型覆盖只改有输入的槽位,其余槽保持预置", () => {
    const plan = allCliPlan(cli());
    const supplies = suppliesWithModels(plan, { dialog: "gpt-5.6" });
    expect(supplies.dialog).toMatchObject({ kind: "cli", model: "gpt-5.6" });
    expect(supplies.thinking).toMatchObject({ kind: "cli", provider: "codex_cli", model: "gpt-5.6-sol" });
    expect(supplies.cheap).toMatchObject({ kind: "cli", provider: "codex_cli", model: "gpt-5.6-luna" });
  });
});

describe("每家预置模型", () => {
  it("codex/claude/cursor/grok 四家四槽期望值", () => {
    expect(slotModelsOf(allCliPlan(cli()))).toEqual({
      dialog: "gpt-5.6-sol",
      thinking: "gpt-5.6-sol",
      cheap: "gpt-5.6-luna",
      evaluator: "gpt-5.6-sol"
    });

    const claude = cli({
      name: "claude",
      provider: "claude_cli",
      enumerable: false,
      models: [
        { id: "sonnet", source: "alias" },
        { id: "opus", source: "alias" },
        { id: "claude-fable-5", source: "alias" },
        { id: "claude-opus-5", source: "used", seen: 4 }
      ]
    });
    expect(slotModelsOf(allCliPlan(claude))).toEqual({
      dialog: "claude-fable-5",
      thinking: "claude-fable-5",
      cheap: "claude-opus-5",
      evaluator: "claude-fable-5"
    });

    const cursor = cli({
      name: "cursor-agent",
      provider: "cursor_cli",
      enumerable: true,
      models: [
        { id: "auto", source: "listed" },
        { id: "cursor-grok-4.6-high-fast", source: "listed" },
        { id: "composer-2.5-fast", source: "listed" }
      ]
    });
    expect(slotModelsOf(allCliPlan(cursor))).toEqual({
      dialog: "cursor-grok-4.6-high-fast",
      thinking: "cursor-grok-4.6-high-fast",
      cheap: "composer-2.5-fast",
      evaluator: "cursor-grok-4.6-high-fast"
    });

    const grok = cli({
      name: "grok",
      provider: "grok_cli",
      enumerable: true,
      models: [{ id: "grok-4.6", source: "listed" }]
    });
    expect(slotModelsOf(allCliPlan(grok))).toEqual({
      dialog: "grok-4.6",
      thinking: "grok-4.6",
      cheap: "grok-4.6",
      evaluator: "grok-4.6"
    });
  });

  it("探测大小写/前缀漂移用探测真名;可枚举匹配不到回退列表首项", () => {
    const drifted = resolveDefaultSlotModels(
      cli({
        models: [{ id: "OpenAI/GPT-5.6-SOL", source: "configured" }]
      })
    );
    expect(drifted.dialog).toBe("OpenAI/GPT-5.6-SOL");
    expect(drifted.cheap).toBe("gpt-5.6-luna");

    const cursorMiss = resolveDefaultSlotModels(
      cli({
        name: "cursor-agent",
        provider: "cursor_cli",
        enumerable: true,
        models: [
          { id: "auto", source: "listed" },
          { id: "sonnet", source: "listed" }
        ]
      })
    );
    expect(cursorMiss.dialog).toBe("sonnet");
    expect(cursorMiss.cheap).toBe("sonnet");
  });

  it("改对话槽不再带动其它槽", () => {
    const plan = allCliPlan(cli());
    const next = suppliesWithModels(plan, { dialog: "hand-edit" });
    expect(next.dialog).toMatchObject({ model: "hand-edit" });
    expect(next.thinking).toMatchObject({ model: "gpt-5.6-sol" });
    expect(next.cheap).toMatchObject({ model: "gpt-5.6-luna" });
    expect(next.evaluator).toMatchObject({ model: "gpt-5.6-sol" });
  });
});

describe("DeepSeek 一键方案(11 §5 owner 2026-08-15:异族规则让位开箱即用)", () => {
  it("四槽带预设模型,baseURL 指官方 v1 端点(09 §11 [providers.api.deepseek] 同源)", () => {
    const plan = apiKeyPlan("DEEPSEEK_API_KEY");
    // 模型名以 2026-08-15 实测官方 /v1/models 为准(仅 v4-flash / v4-pro);
    // 旧别名 deepseek-chat/reasoner 会被服务端双双映射到 v4-flash,不得用。
    expect(plan.supplies.dialog).toMatchObject({
      kind: "api",
      baseURL: "https://api.deepseek.com/v1",
      model: "deepseek-v4-flash"
    });
    expect(plan.supplies.thinking).toMatchObject({ model: "deepseek-v4-pro" });
    expect(plan.supplies.cheap).toMatchObject({ model: "deepseek-v4-flash" });
    expect(plan.supplies.evaluator).toMatchObject({ model: "deepseek-v4-pro" });
  });

  it("same-family ack 前置(四槽同族恒成立),隔离 ack 不前置", () => {
    expect(apiKeyPlan("DEEPSEEK_API_KEY").requiredAcks).toEqual({
      evaluatorIsolation: false,
      evaluatorSameFamily: true
    });
  });

  it("其他单家端点不受影响:模型仍留空、ack 仍不前置", () => {
    const plan = apiKeyPlan("OPENAI_API_KEY");
    expect(plan.supplies.dialog).toMatchObject({ model: "" });
    expect(plan.requiredAcks).toEqual({ evaluatorIsolation: false, evaluatorSameFamily: false });
  });
});

describe("requiredAcksForSupplies C-9", () => {
  const cliDialog = {
    dialog: { kind: "cli" as const, provider: "codex_cli" as const, model: "gpt-5.6-sol" },
    thinking: { kind: "cli" as const, provider: "codex_cli" as const, model: "gpt-5.6-sol" },
    cheap: { kind: "cli" as const, provider: "codex_cli" as const, model: "gpt-5.6-luna" }
  };

  it("评估改同族 API → 不前置 same-family(走 422 摊开)", () => {
    expect(
      requiredAcksForSupplies({
        ...cliDialog,
        evaluator: {
          kind: "api",
          baseURL: "https://api.openai.com/v1",
          apiKey: "",
          model: "gpt-5.6-sol",
          presentKeyNames: ["OPENAI_API_KEY"]
        }
      })
    ).toEqual({ evaluatorIsolation: false, evaluatorSameFamily: false });
  });

  it("评估改异家 CLI → 仍双 ack", () => {
    expect(
      requiredAcksForSupplies({
        ...cliDialog,
        evaluator: { kind: "cli", provider: "claude_cli", model: "claude-fable-5" }
      })
    ).toEqual({ evaluatorIsolation: true, evaluatorSameFamily: true });
  });

  it("dialog 换 API 无 key → supplyReady 必须 false,且不得套 mixedPlan 假 OR key", () => {
    const empty = apiDraftFromSecrets({});
    expect(empty).toEqual({ kind: "api", baseURL: "", apiKey: "", model: "" });
    expect(empty.presentKeyNames).toBeUndefined();
    expect(supplyReady(empty)).toBe(false);
    const fakeOr = mixedPlan(cli()).supplies.dialog;
    expect(fakeOr.kind).toBe("api");
    if (fakeOr.kind === "api") {
      expect(fakeOr.presentKeyNames).toEqual(["OPENROUTER_API_KEY"]);
      expect(empty.presentKeyNames).not.toEqual(fakeOr.presentKeyNames);
    }
  });
});

describe("切家覆盖与混搭清零", () => {
  it("有混搭切另一家直接 apply,不再 confirm;再点当前家 no-op;单槽恢复预置后撤混搭", () => {
    const plan = allCliPlan(cli());
    const mixed = {
      ...plan.supplies,
      evaluator: { kind: "cli" as const, provider: "claude_cli" as const, model: "claude-fable-5" }
    };
    expect(mixedSlotsOf(mixed, plan.supplies)).toEqual(["evaluator"]);
    expect(decideLeftRailSelect({ busy: false, currentId: "cli:codex", nextId: "cli:claude" })).toBe("apply");
    expect(shouldConfirmLeftSupplyChange({ busy: false, currentId: "cli:codex", nextId: "cli:claude", mixed: true })).toBe(
      "apply"
    );
    expect(shouldConfirmLeftSupplyChange({ busy: false, currentId: "cli:codex", nextId: "cli:codex", mixed: true })).toBe(
      "noop"
    );
    expect(shouldConfirmLeftSupplyChange({ busy: false, currentId: "cli:codex", nextId: "cli:claude", mixed: false })).toBe(
      "apply"
    );
    const followed = followSlotToPreset(mixed, plan.supplies, "evaluator");
    expect(mixedSlotsOf(followed, plan.supplies)).toEqual([]);
    expect(startButtonLabel(true)).toBe("按这套配置,启动");
    expect(startButtonLabel(false)).toBe("全用它,启动");
  });
});

describe("单槽换家预置", () => {
  const cursor = cli({
    name: "cursor-agent",
    provider: "cursor_cli",
    enumerable: true,
    models: [
      { id: "auto", source: "listed" },
      { id: "cursor-grok-4.6-high-fast", source: "listed" },
      { id: "composer-2.5-fast", source: "listed" }
    ]
  });

  it("思考档槽用思考档值,廉价槽用廉价档值,与左栏 allCliPlan 同源", () => {
    const next = { kind: "cli" as const, provider: "cursor_cli" as const };
    const thinking = applySlotHousePreset("thinking", next, [cursor]);
    const cheap = applySlotHousePreset("cheap", next, [cursor]);
    const left = allCliPlan(cursor).supplies;
    expect(thinking).toEqual({
      kind: "cli",
      provider: "cursor_cli",
      model: "cursor-grok-4.6-high-fast"
    });
    expect(cheap).toEqual({
      kind: "cli",
      provider: "cursor_cli",
      model: "composer-2.5-fast"
    });
    expect(thinking).toEqual(left.thinking);
    expect(cheap).toEqual(left.cheap);
    expect(presetSupplyForSlot(cursor, "thinking")).toEqual(left.thinking);
    expect(presetSupplyForSlot(cursor, "cheap")).toEqual(left.cheap);
  });

  it("换家后模型写入混搭快照", () => {
    const plan = allCliPlan(cli());
    const cheap = applySlotHousePreset("cheap", { kind: "cli", provider: "cursor_cli" }, [cursor]);
    const after = reduceMixAfterEdit(
      { selectedId: "cli:codex", plan, supplies: plan.supplies, snapshot: null },
      { ...plan.supplies, cheap },
      "Codex"
    );
    expect(after.selectedId).toBe(MIX_SNAPSHOT_ID);
    expect(after.snapshot?.supplies.cheap).toEqual({
      kind: "cli",
      provider: "cursor_cli",
      model: "composer-2.5-fast"
    });
    expect(after.supplies.cheap).toEqual(after.snapshot?.supplies.cheap);
  });

  it("无预置的家回退探测首选;探测也空则留空", () => {
    const qwen = cli({
      name: "qwen",
      provider: "qwen_cli",
      models: [{ id: "qwen-plus", source: "configured" }]
    });
    expect(applySlotHousePreset("dialog", { kind: "cli", provider: "qwen_cli" }, [qwen])).toEqual({
      kind: "cli",
      provider: "qwen_cli",
      model: "qwen-plus"
    });
    const qwenCheap = applySlotHousePreset("cheap", { kind: "cli", provider: "qwen_cli" }, [qwen]);
    expect(qwenCheap.kind).toBe("cli");
    if (qwenCheap.kind === "cli") expect(qwenCheap.model).toBe("qwen-plus");
    const empty = cli({ name: "qwen", provider: "qwen_cli", models: [] });
    expect(applySlotHousePreset("dialog", { kind: "cli", provider: "qwen_cli" }, [empty])).toEqual({
      kind: "cli",
      provider: "qwen_cli"
    });
  });

  it("同家已带模型则保留,不覆盖手改", () => {
    const kept = { kind: "cli" as const, provider: "codex_cli" as const, model: "hand-edit" };
    expect(applySlotHousePreset("dialog", kept, [cli()])).toEqual(kept);
  });
});

describe("混搭快照状态机", () => {
  it("编辑产生快照;切另一家保留;点回恢复;混搭槽清零解散", () => {
    const plan = allCliPlan(cli());
    const other = allCliPlan(
      cli({
        name: "claude",
        provider: "claude_cli",
        models: [{ id: "claude-fable-5", source: "alias" }]
      })
    );
    const edited = {
      ...plan.supplies,
      evaluator: { kind: "cli" as const, provider: "claude_cli" as const, model: "claude-fable-5" }
    };
    const afterEdit = reduceMixAfterEdit(
      { selectedId: "cli:codex", plan, supplies: plan.supplies, snapshot: null },
      edited,
      "Codex"
    );
    expect(afterEdit.selectedId).toBe(MIX_SNAPSHOT_ID);
    expect(afterEdit.snapshot?.baseId).toBe("cli:codex");
    expect(afterEdit.snapshot?.baseLabel).toBe("Codex");
    expect(mixSnapshotLine(afterEdit.snapshot!)).toBe("以 Codex 为底 · 1 槽自定义");

    const afterSwitch = reduceMixAfterSelectHouse(afterEdit, "cli:claude", other);
    expect(afterSwitch.selectedId).toBe("cli:claude");
    expect(afterSwitch.snapshot).toEqual(afterEdit.snapshot);
    expect(afterSwitch.supplies.evaluator).toEqual(other.supplies.evaluator);
    expect(decideLeftRailSelect({ busy: false, currentId: "cli:claude", nextId: MIX_SNAPSHOT_ID })).toBe("restore");

    const restored = reduceMixRestore(afterSwitch);
    expect(restored.selectedId).toBe(MIX_SNAPSHOT_ID);
    expect(restored.supplies.evaluator).toEqual(edited.evaluator);

    const followed = followSlotToPreset(restored.supplies, restored.snapshot!.plan.supplies, "evaluator");
    const dissolved = reduceMixAfterEdit(restored, followed, "Codex");
    expect(dissolved.snapshot).toBeNull();
    expect(dissolved.selectedId).toBe("cli:codex");
  });
});

describe("选中联动与搜索", () => {

  it("搜索即筛 id 与 label", () => {
    const models = [
      { id: "gpt-5.6", label: "GPT" },
      { id: "claude-opus", label: "Opus" },
      { id: "grok-4" }
    ];
    expect(filterModelOptions(models, "opus").map((item) => item.id)).toEqual(["claude-opus"]);
    expect(filterModelOptions(models, "GROK").map((item) => item.id)).toEqual(["grok-4"]);
    expect(filterModelOptions(models, "   ")).toHaveLength(3);
  });

  it("默认模型优先 used 次数,cursor 仍跳过 auto", () => {
    expect(
      defaultModelId(
        cli({
          models: [
            { id: "listed-a", source: "listed" },
            { id: "used-low", source: "used", seen: 1 },
            { id: "used-high", source: "used", seen: 4 }
          ]
        })
      )
    ).toBe("used-high");
    expect(
      defaultModelId(
        cli({
          name: "cursor-agent",
          provider: "cursor_cli",
          enumerable: true,
          models: [
            { id: "auto", source: "listed" },
            { id: "sonnet", source: "listed" }
          ]
        })
      )
    ).toBe("sonnet");
  });
});
