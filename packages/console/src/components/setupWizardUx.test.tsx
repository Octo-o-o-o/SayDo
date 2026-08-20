import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { comboFilterQuery, highlightModelText, ModelCombo, nextComboActiveIndex } from "./ModelCombo";
import { SetupLoadingScreen, SetupProbeErrorCard } from "./SetupBootstrapBoundary";
import { SetupValueProvider, type SetupApi } from "../shell/SetupContext";
import {
  SetupBanner,
  SetupGate,
  SetupWizardBrandFooter,
  SetupWizardBrandHeader,
  shortSourceRevision
} from "./SetupGate";
import { SupplyPicker } from "./SupplyPicker";
import {
  canChangeSupply,
  DetectingProgressRow,
  detectingProgressCopy,
  fusionLayoutForViewport,
  MixSnapshotCard,
  PurposeZones,
  scrollSetupAnchor,
  SetupWizard,
  TestTrafficLight,
  SupplyCardGrid,
  SupplySkeletonGrid,
  supplyGridTemplateColumns,
  wizardContentMaxWidth
} from "./SetupWizard";
import type { SetupProbe } from "../lib/setupApi";
import { closeFusionOverlay, openFusionOverlay, setModelOverlay } from "../lib/setupOverlay";
import { SETUP_COPY } from "../lib/setupCopy";
import {
  filterModelOptions,
  MIX_SNAPSHOT_ID,
  mixedPrefillForFailedPlan,
  unreadyCliAllowsLiveCheck,
  unreadyReasonCopy
} from "../lib/resourcePlans";
import type { CliCapability } from "../lib/setupApi";

describe("busy 锁", () => {
  it("启动后禁止换供给", () => {
    expect(canChangeSupply(true)).toBe(false);
    expect(canChangeSupply(false)).toBe(true);
  });
});

describe("搜索过滤", () => {
  it("ModelCombo 只在 open 时渲染列表", () => {
    const models = [
      { id: "gpt-5.6", source: "listed" as const },
      { id: "claude-opus", source: "listed" as const }
    ];
    const closed = renderToStaticMarkup(
      <ModelCombo models={models} value="" onChange={() => {}} complete open={false} onOpenChange={() => {}} />
    );
    expect(closed).not.toContain("data-model-popover");
    const opened = renderToStaticMarkup(
      <ModelCombo models={models} value="opus" onChange={() => {}} complete open onOpenChange={() => {}} />
    );
    expect(opened).toContain("data-model-popover");
    expect(opened).toContain("position:absolute");
    expect(opened).toContain("var(--z-setup-overlay)");
    expect(opened).toContain("var(--shadow-card-hover)");
    expect(opened).toContain("data-model-match-count");
    expect(opened).toContain("匹配 2 / 2");
    expect(opened).not.toContain("position:static");
    expect(opened).not.toContain("margin-bottom:8px");
    expect(opened).toContain("claude-opus");
    expect(opened).toContain("gpt-5.6");
    expect(opened).toContain("搜索模型(共 2 个)");
    expect(opened).not.toContain("点输入框看全部");
    expect(opened).not.toContain("打字可筛选");
    expect(filterModelOptions(models, "5.6").map((item) => item.id)).toEqual(["gpt-5.6"]);
  });

  it("点击展开全量列表,未打字不用已选 id 过滤", () => {
    expect(comboFilterQuery("cursor-grok-4.6-high-fast", false)).toBe("");
    expect(comboFilterQuery("cursor-grok-4.6-high-fast", true)).toBe("cursor-grok-4.6-high-fast");
    const models = [
      { id: "cursor-grok-4.6-high-fast", source: "listed" as const },
      { id: "composer-2.5-fast", source: "listed" as const },
      { id: "gpt-5.6", source: "listed" as const }
    ];
    const html = renderToStaticMarkup(
      <ModelCombo
        models={models}
        value="cursor-grok-4.6-high-fast"
        onChange={() => {}}
        complete
        open
        onOpenChange={() => {}}
      />
    );
    expect(html).toContain("cursor-grok-4.6-high-fast");
    expect(html).toContain("composer-2.5-fast");
    expect(html).toContain("gpt-5.6");
    expect(html).toContain("匹配 3 / 3");
    expect(html).toContain("max-height:320px");
    const inset = renderToStaticMarkup(
      <ModelCombo
        models={models}
        value="gpt-5.6"
        onChange={() => {}}
        complete
        open
        onOpenChange={() => {}}
        surface="inset"
      />
    );
    expect(inset).toContain("data-combo-surface=\"inset\"");
    expect(inset).toContain("position:relative");
    expect(inset).not.toContain("position:absolute");
    expect(inset).not.toContain("data-fusion-overlay=\"model\"");
  });

  it("候选项两行排版且搜索命中高亮,listbox 语义齐全", () => {
    const models = [{ id: "claude-sonnet-5-high", label: "Sonnet 5 1M Thinking", source: "listed" as const }];
    const html = renderToStaticMarkup(
      <ModelCombo models={models} value="sonnet" onChange={() => {}} complete open onOpenChange={() => {}} />
    );
    expect(html).toContain("role=\"listbox\"");
    expect(html).toContain("role=\"option\"");
    expect(html).toContain("aria-controls");
    expect(html).toContain("5 1M Thinking");
    expect(html).toContain("var(--text-secondary)");
    expect(html).not.toContain("claude-sonnet-5-highSonnet");
    const highlighted = renderToStaticMarkup(<>{highlightModelText("claude-sonnet-5-high", "sonnet")}</>);
    expect(highlighted).toContain("data-hl");
    expect(highlighted).toContain("var(--active-ink-wash)");
    expect(nextComboActiveIndex(0, "ArrowDown", 3)).toBe(1);
    expect(nextComboActiveIndex(0, "ArrowUp", 3)).toBe(0);
    expect(nextComboActiveIndex(2, "ArrowDown", 3)).toBe(2);
  });

  it("空态只报状态,不教怎么筛或怎么填", () => {
    expect(SETUP_COPY.comboEmptyComplete).toBe("没有匹配的模型");
    expect(SETUP_COPY.comboEmptyPartial).toBe("列表里没有这个名字");
    expect(SETUP_COPY.comboEmptyComplete).not.toContain("换个关键词");
    expect(SETUP_COPY.comboEmptyPartial).not.toContain("直接填即可");
    expect(SETUP_COPY.comboMatchExtra).toContain("不在列表里也能用");
    expect(SETUP_COPY.noListNote).toBe("没有完整列表");
    expect(SETUP_COPY.enumerableCount(2)).toBe("2 个模型");
    expect("comboHintComplete" in SETUP_COPY).toBe(false);
    expect("comboHintPartial" in SETUP_COPY).toBe(false);
    expect("usedRecordNote" in SETUP_COPY).toBe(false);
    expect("fusionLead" in SETUP_COPY).toBe(false);
  });
});

describe("供给网格", () => {
  it("响应式列数 3/2/1,radiogroup 语义,busy 锁卡与添加 API", () => {
    expect(supplyGridTemplateColumns(1440)).toBe("repeat(3, minmax(0, 1fr))");
    expect(supplyGridTemplateColumns(1100)).toBe("repeat(3, minmax(0, 1fr))");
    expect(supplyGridTemplateColumns(900)).toBe("repeat(2, minmax(0, 1fr))");
    expect(supplyGridTemplateColumns(720)).toBe("repeat(2, minmax(0, 1fr))");
    expect(supplyGridTemplateColumns(719)).toBe("minmax(0, 1fr)");
    const idle = renderToStaticMarkup(
      <SupplyCardGrid
        items={[
          { id: "cli:codex", title: "Codex", line: "已登录" },
          { id: "api:new", title: "添加 API 直连", line: "填 key" }
        ]}
        selectedId="cli:codex"
        busy={false}
        onSelect={() => {}}
      />
    );
    expect(idle).toContain("role=\"radiogroup\"");
    expect(idle).toContain("role=\"radio\"");
    expect(idle).toContain("aria-checked");
    expect(idle).toContain("data-supply-seal");
    expect(idle).toContain("data-action=\"add-api\"");
    expect(idle).toContain("class=\"setup-supply-grid\"");
    const busy = renderToStaticMarkup(
      <SupplyCardGrid
        items={[
          { id: "cli:codex", title: "Codex", line: "已登录" },
          { id: "api:new", title: "添加 API 直连", line: "填 key" }
        ]}
        selectedId="cli:codex"
        busy
        onSelect={() => {}}
      />
    );
    expect(busy).toContain("disabled");
    expect(busy).toContain("not-allowed");
    const picker = renderToStaticMarkup(
      <SupplyPicker
        slotKey="dialog"
        clis={[]}
        value={{ kind: "api", baseURL: "", apiKey: "", model: "" }}
        onChange={() => {}}
        allowSkip={false}
        disabled
      />
    );
    expect(picker).toContain("disabled");
    const target = { called: false, scrollIntoView(this: void) { void this; target.called = true; } };
    scrollSetupAnchor(target as unknown as HTMLElement);
    expect(target.called).toBe(true);
  });
});

describe("SetupGate 向导页", () => {
  it("不渲染遮罩,也不把 fixed/overflow 放在向导根上", () => {
    const probe: SetupProbe = {
      config: { present: false, slots: { dialog: { status: "missing", effective: "unarmed" } } },
      secrets: {},
      acks: { evaluator_isolation: false, evaluator_same_family: false },
      hints: [],
      clis: [],
      voice: { asr: "down", tts: "down" },
      pendingConfig: null,
      pendingEnv: null,
      recovery: { active: false, mode: "normal", violations: [] }
    };
    const setup: SetupApi = {
      probe,
      probeError: null,
      probeErrorCode: null,
      loading: false,
      dialogReady: false,
      showWizardEntry: true,
      wizardOpen: false,
      setWizardOpen: () => {},
      refreshProbe: async () => probe,
      peeked: false,
      setPeeked: () => {}
    };
    const html = renderToStaticMarkup(
      <SetupValueProvider value={setup}>
        <SetupGate />
      </SetupValueProvider>
    );
    expect(html).toContain("data-setup-gate");
    expect(html).not.toContain("rgba(8,10,16");
    expect(html).not.toContain("position:fixed");
    expect(html).not.toContain("aria-modal");
    expect(html).not.toContain("overflow-y:auto");
    expect(html).toContain("class=\"setup-wizard\"");
    expect(html).toContain("data-setup-wizard-header");
    expect(html).toContain("data-setup-wizard-seal");
    expect(html).toContain("首次配置");
    expect(html).toContain("data-setup-wizard-footer");
    expect(html).toContain("本机运行 · 数据不出这台电脑");
    expect(html).toContain("先把对话模型配好");
    expect(html).toContain("说到聊不了天");
    expect(html).not.toContain("没有对话模型,SayDo 聊不了天");
    expect(html).toContain("font-family:var(--font-display)");
    expect(html).toContain("data-brand-cn");
    expect(html).toContain("说到");
    expect(html).not.toContain("data-action=\"toggle-advanced\"");
  });

  it("页头页尾结构独立可渲染,版本缺省不报错", () => {
    const header = renderToStaticMarkup(<SetupWizardBrandHeader />);
    expect(header).toContain("data-setup-wizard-header");
    expect(header).toContain("data-setup-wizard-header-inner");
    expect(header).toContain("max-width:720px");
    expect(renderToStaticMarkup(<SetupWizardBrandHeader contentMaxWidth={1080} />)).toContain("max-width:1080px");
    expect(header).toContain("margin:0 auto");
    expect(header).toContain("说到");
    expect(header).toContain("SayDo");
    expect(header).toContain("首次配置");
    expect(header).toContain("data-setup-wizard-seal");
    expect(header).toContain("data-setup-brand-lockup");
    const footerHidden = renderToStaticMarkup(<SetupWizardBrandFooter revision={null} />);
    expect(footerHidden).toContain("本机运行 · 数据不出这台电脑");
    expect(footerHidden).not.toContain("版本 ");
    const footerShown = renderToStaticMarkup(<SetupWizardBrandFooter revision="b1e591d" />);
    expect(footerShown).toContain("版本 b1e591d");
    expect(shortSourceRevision({ identity: { sourceRevision: "b1e591d5cd393a251bbdf2e33a31c07b54e7f686" } })).toBe(
      "b1e591d"
    );
    expect(shortSourceRevision({ runtimeSha: "abcdef123456" })).toBe("abcdef1");
    expect(shortSourceRevision({})).toBeNull();
    expect(shortSourceRevision({ identity: { sourceRevision: "abc" } })).toBeNull();
  });

  it("顶栏横幅只报状态,不教点这里", () => {
    const probe: SetupProbe = {
      config: { present: false, slots: { dialog: { status: "missing", effective: "unarmed" } } },
      secrets: {},
      acks: { evaluator_isolation: false, evaluator_same_family: false },
      hints: [],
      clis: [],
      voice: { asr: "down", tts: "down" },
      pendingConfig: null,
      pendingEnv: null,
      recovery: { active: false, mode: "normal", violations: [] }
    };
    const setup: SetupApi = {
      probe,
      probeError: null,
      probeErrorCode: null,
      loading: false,
      dialogReady: false,
      showWizardEntry: true,
      wizardOpen: false,
      setWizardOpen: () => {},
      refreshProbe: async () => probe,
      peeked: true,
      setPeeked: () => {}
    };
    const html = renderToStaticMarkup(
      <SetupValueProvider value={setup}>
        <SetupBanner />
      </SetupValueProvider>
    );
    expect(html).toContain("对话模型还没配好,现在还聊不了");
    expect(html).not.toContain("点这里");
  });
});

describe("检测中骨架", () => {
  it("进度行是墨色正文+呼吸圆点,骨架正好 3 张", () => {
    expect(detectingProgressCopy(false, false)).toBe("正在清点这台机器能用的模型来源…");
    expect(detectingProgressCopy(true, false)).toBe("正在清点这台机器能用的模型来源…");
    expect(detectingProgressCopy(true, true)).toBe("正在清点这台机器能用的模型来源…");
    expect(detectingProgressCopy(true, false)).not.toContain("再核对一遍");
    const row = renderToStaticMarkup(<DetectingProgressRow reprobing={false} phase2Done={false} />);
    expect(row).toContain("data-cli-detecting");
    expect(row).toContain("data-detecting-dot");
    expect(row).toContain("class=\"setup-detecting-dot\"");
    expect(row).toContain("var(--text-base)");
    expect(row).toContain("var(--text-primary)");
    expect(row).toContain("正在清点这台机器能用的模型来源…");
    expect(row).not.toContain("正在检测本机 CLI");
    const grid = renderToStaticMarkup(<SupplySkeletonGrid />);
    expect(grid).toContain("data-supply-skeleton-grid");
    expect(grid).toContain("class=\"setup-supply-grid\"");
    expect(grid.match(/data-supply-skeleton=/g)?.length).toBe(3);
    expect(grid).toContain("data-supply-skeleton-title");
    expect(grid).toContain("data-supply-skeleton-line");
    expect(grid).toContain("setup-skeleton-card");
    expect(grid).toContain("var(--surface)");
    expect(grid).toContain("var(--surface-ink-wash)");
  });

  it("SetupWizard 首帧(仍在检测)只出骨架不出空态真卡", () => {
    const probe: SetupProbe = {
      config: { present: false, slots: { dialog: { status: "missing", effective: "unarmed" } } },
      secrets: {},
      acks: { evaluator_isolation: false, evaluator_same_family: false },
      hints: [],
      clis: [],
      voice: { asr: "down", tts: "down" },
      pendingConfig: null,
      pendingEnv: null,
      recovery: { active: false, mode: "normal", violations: [] }
    };
    const html = renderToStaticMarkup(
      <SetupWizard probe={probe} onDone={() => {}} onProbeRefresh={async () => probe} />
    );
    expect(html).toContain("data-supply-skeleton-grid");
    expect(html).toContain("正在清点这台机器能用的模型来源");
    expect(html).not.toContain("正在检测本机 CLI");
    expect(html).not.toContain("data-empty-supply");
    expect(html).not.toContain("data-available-supplies");
    expect(html).not.toContain("data-unready-entry");
  });
});

describe("失败去向", () => {
  it("all-cli 失败给出 mixed 预填,不自动替换当前方案", () => {
    const cli: CliCapability = {
      name: "codex",
      provider: "codex_cli",
      found: true,
      auth: { status: "logged_in" },
      enumerable: false,
      models: []
    };
    const plan = {
      kind: "config" as const,
      id: "all-cli-codex_cli",
      shape: "all-cli" as const,
      title: "全用 Codex",
      positioning: "",
      cost: "",
      supplies: {
        dialog: { kind: "cli" as const, provider: "codex_cli" as const },
        thinking: { kind: "cli" as const, provider: "codex_cli" as const },
        cheap: { kind: "cli" as const, provider: "codex_cli" as const },
        evaluator: { kind: "cli" as const, provider: "codex_cli" as const }
      },
      requiredAcks: { evaluatorIsolation: true, evaluatorSameFamily: true }
    };
    const prefill = mixedPrefillForFailedPlan(plan, { clis: [cli], secrets: { OPENROUTER_API_KEY: true } });
    expect(prefill?.shape).toBe("mixed");
    expect(prefill?.supplies.dialog.kind).toBe("api");
    expect(plan.shape).toBe("all-cli");
  });
});

describe("登录态刷新入口", () => {
  const loggedOut: CliCapability = {
    name: "claude",
    provider: "claude_cli",
    found: true,
    auth: { status: "not_logged_in", fixHint: "claude auth login" },
    enumerable: false,
    models: []
  };
  const loggedIn: CliCapability = {
    name: "codex",
    provider: "codex_cli",
    found: true,
    auth: { status: "logged_in" },
    enumerable: false,
    models: []
  };

  it("换家 popover 内核:未登录行内有重新检测,已登录没有", () => {
    const html = renderToStaticMarkup(
      <SupplyPicker
        slotKey="thinking"
        clis={[loggedOut, loggedIn]}
        value={{ kind: "skip" }}
        onChange={() => {}}
        allowSkip
        onReprobeCli={() => {}}
      />
    );
    expect(html).toContain("data-action=\"reprobe-claude\"");
    expect(html).toContain("重新检测");
    expect(html).not.toContain("data-action=\"reprobe-codex\"");
  });

  it("融合页无高级切换;撤销豁免留在融合页;重新检测走 bypass", () => {
    const probe: SetupProbe = {
      config: { present: false, slots: { dialog: { status: "missing", effective: "unarmed" } } },
      secrets: {},
      acks: { evaluator_isolation: false, evaluator_same_family: false },
      hints: [],
      clis: [],
      voice: { asr: "down", tts: "down" },
      pendingConfig: null,
      pendingEnv: null,
      recovery: { active: false, mode: "normal", violations: [] }
    };
    const revoke = renderToStaticMarkup(
      <SetupWizard probe={probe} onDone={() => {}} onProbeRefresh={async () => probe} advancedNotice="撤销豁免" />
    );
    expect(revoke).toContain("data-wizard-view=\"fusion\"");
    expect(revoke).not.toContain("data-action=\"toggle-advanced\"");
    expect(revoke).not.toContain(">高级配置<");
    expect(revoke).toContain(">选一个能用的供给<");
    const fusion = renderToStaticMarkup(
      <SetupWizard probe={probe} onDone={() => {}} onProbeRefresh={async () => probe} />
    );
    expect(fusion).toContain(">选一个能用的供给<");
    expect(fusion).not.toContain("data-action=\"toggle-advanced\"");
    expect(fusion).not.toContain("data-advanced-setup");
  });
});

describe("分栏与回落两形态", () => {
  const probe: SetupProbe = {
    config: { present: false, slots: { dialog: { status: "missing", effective: "unarmed" } } },
    secrets: {},
    acks: { evaluator_isolation: false, evaluator_same_family: false },
    hints: [],
    clis: [],
    voice: { asr: "down", tts: "down" },
    pendingConfig: null,
    pendingEnv: null,
    recovery: { active: false, mode: "normal", violations: [] }
  };

  it("断点:视口≥1080 分栏,内嵌强制回落,720 帽只约束回落", () => {
    expect(fusionLayoutForViewport(1080)).toBe("split");
    expect(fusionLayoutForViewport(1079)).toBe("stack");
    expect(fusionLayoutForViewport(1440, true)).toBe("stack");
    expect(wizardContentMaxWidth("split")).toBe(1080);
    expect(wizardContentMaxWidth("stack")).toBe(720);
  });

  it("分栏与回落都有 radiogroup/骨架/busy 锁", () => {
    const split = renderToStaticMarkup(
      <SetupWizard probe={probe} onDone={() => {}} onProbeRefresh={async () => probe} layout="split" />
    );
    const stack = renderToStaticMarkup(
      <SetupWizard probe={probe} onDone={() => {}} onProbeRefresh={async () => probe} layout="stack" />
    );
    expect(split).toContain("data-fusion-layout=\"split\"");
    expect(stack).toContain("data-fusion-layout=\"stack\"");
    expect(split).toContain("data-fusion-left");
    expect(split).toContain("data-fusion-right");
    expect(stack).not.toContain("data-fusion-left");
    expect(split).toContain("data-supply-skeleton-grid");
    expect(stack).toContain("data-supply-skeleton-grid");
    expect(split).toContain("data-supply-variant=\"rail\"");
    expect(stack).toContain("data-supply-variant=\"grid\"");
    const rail = renderToStaticMarkup(
      <SupplyCardGrid
        variant="rail"
        items={[{ id: "cli:codex", title: "Codex", line: "已登录" }]}
        selectedId="cli:codex"
        busy
        onSelect={() => {}}
      />
    );
    const grid = renderToStaticMarkup(
      <SupplyCardGrid
        variant="grid"
        items={[{ id: "cli:codex", title: "Codex", line: "已登录" }]}
        selectedId="cli:codex"
        busy
        onSelect={() => {}}
      />
    );
    expect(rail).toContain("role=\"radiogroup\"");
    expect(grid).toContain("role=\"radiogroup\"");
    expect(rail).toContain("disabled");
    expect(grid).toContain("disabled");
    expect(rail).toContain("setup-supply-rail");
    expect(grid).toContain("setup-supply-grid");
  });

  it("内嵌强制回落,不分栏", () => {
    const html = renderToStaticMarkup(
      <SetupWizard probe={probe} onDone={() => {}} onProbeRefresh={async () => probe} embedded />
    );
    expect(html).toContain("data-fusion-layout=\"stack\"");
    expect(html).not.toContain("data-fusion-left");
  });
});

describe("自检结果表", () => {
  it("通过行 requested≠observed 说明列渲染同族降级 note", () => {
    const html = renderToStaticMarkup(
      <TestTrafficLight
        results={{
          thinking: {
            status: "ok",
            requestedModel: "claude-fable-5",
            observedModel: "claude-opus-4-8"
          },
          cheap: { status: "ok" }
        }}
      />
    );
    expect(html).toContain("data-setup-test-results");
    expect(html).toContain("实际 claude-opus-4-8(claude-fable-5 被 CLI 降级)");
    expect(html).toContain("data-test-detail=\"1\"");
    expect(html).toContain("—");
  });
});

describe("未就绪入口", () => {
  it("未登录给登录命令,超时给人话,inventory 说明安全原因", () => {
    expect(
      unreadyReasonCopy({
        name: "claude",
        provider: "claude_cli",
        found: true,
        auth: { status: "not_logged_in", fixHint: "claude auth login" },
        enumerable: false,
        models: []
      })
    ).toContain("claude auth login");
    expect(
      unreadyReasonCopy({
        name: "gemini",
        provider: "gemini_cli",
        found: true,
        auth: { status: "unknown" },
        enumerable: false,
        models: []
      })
    ).toBe("探测超时");
    expect(
      unreadyReasonCopy({
        name: "opencode",
        provider: null,
        found: true,
        auth: { status: "logged_in" },
        enumerable: true,
        models: [{ id: "x", source: "listed" }]
      })
    ).toContain("暂不能当模型供给");
    expect(
      unreadyCliAllowsLiveCheck({
        name: "opencode",
        provider: null,
        found: true,
        auth: { status: "logged_in" },
        enumerable: true,
        models: [{ id: "x", source: "listed" }]
      })
    ).toBe(false);
    expect(
      unreadyCliAllowsLiveCheck({
        name: "claude",
        provider: "claude_cli",
        found: true,
        auth: { status: "not_logged_in" },
        enumerable: false,
        models: []
      })
    ).toBe(true);
    expect(
      unreadyCliAllowsLiveCheck({
        name: "gemini",
        provider: "gemini_cli",
        found: true,
        auth: { status: "unknown" },
        enumerable: false,
        models: []
      })
    ).toBe(true);
  });
});

describe("boundary 呈现", () => {
  it("Loading 与 probe 失败卡都是显式第三态", () => {
    const loading = renderToStaticMarkup(<SetupLoadingScreen />);
    expect(loading).toContain("正在看这台机器的资源");
    expect(loading).toContain("data-setup-brand-lockup");
    expect(loading).toContain("data-setup-wizard-seal");
    expect(loading).toContain("说到");
    expect(loading).toContain("SayDo");
    const error = renderToStaticMarkup(<SetupProbeErrorCard message="ECONNREFUSED" onRetry={() => {}} />);
    expect(error).toContain("没连上本机服务/读不到配置");
    expect(error).toContain("data-action=\"retry-setup-probe\"");
    expect(error).not.toContain("已配好");
  });
});

describe("单浮层与混搭快照卡", () => {
  const supplies = {
    dialog: { kind: "cli" as const, provider: "codex_cli" as const, model: "gpt-5.6-sol" },
    thinking: { kind: "cli" as const, provider: "codex_cli" as const, model: "gpt-5.6-sol" },
    cheap: { kind: "cli" as const, provider: "codex_cli" as const, model: "gpt-5.6-luna" },
    evaluator: { kind: "cli" as const, provider: "codex_cli" as const, model: "gpt-5.6-sol" }
  };

  it("打开新浮层替换旧浮层", () => {
    const house = openFusionOverlay({ type: "none" }, { type: "house", slot: "dialog" });
    expect(house).toEqual({ type: "house", slot: "dialog" });
    expect(openFusionOverlay(house, { type: "model", slot: "cheap" })).toEqual({ type: "model", slot: "cheap" });
    expect(setModelOverlay(true, "thinking")).toEqual({ type: "model", slot: "thinking" });
    expect(closeFusionOverlay()).toEqual({ type: "none" });
  });

  it("快照卡与切换提供商文案,页面无孤立花括号", () => {
    const card = renderToStaticMarkup(
      <MixSnapshotCard selected line="以 Codex 为底 · 1 槽自定义" busy={false} onSelect={() => {}} />
    );
    expect(card).toContain("data-mix-snapshot-card");
    expect(card).toContain(SETUP_COPY.mixTitle);
    expect(card).toContain("以 Codex 为底 · 1 槽自定义");
    expect(card).toContain("data-action=\"select-mix-snapshot\"");
    expect(MIX_SNAPSHOT_ID).toBe("mix:snapshot");

    const zones = renderToStaticMarkup(
      <PurposeZones
        supplies={supplies}
        preset={supplies}
        clis={[]}
        openModelSlot={null}
        onOpenModelSlot={() => {}}
        openHouseSlot="dialog"
        onOpenHouseSlot={() => {}}
        onModelChange={() => {}}
        onHouseChange={() => {}}
        disabled={false}
        reprobing={false}
        onReprobeCli={() => {}}
      />
    );
    expect(zones).toContain(SETUP_COPY.switchProvider);
    expect(zones).not.toContain("换家");
    expect(zones).toContain("data-fusion-overlay=\"house\"");
    expect(zones).toContain("data-house-picker=\"dialog\"");
    const textOnly = zones.replace(/<[^>]+>/g, " ");
    expect(textOnly).not.toMatch(/\{/);

    const picker = renderToStaticMarkup(
      <SupplyPicker
        slotKey="dialog"
        clis={[
          {
            name: "claude",
            provider: "claude_cli",
            found: true,
            auth: { status: "logged_in" },
            enumerable: false,
            models: [
              { id: "claude-fable-5", source: "used", seen: 3 },
              { id: "sonnet", source: "alias" }
            ],
            note: "claude 没有列出全部模型的接口。下面是从本机记录里找到的:你用过的 3 个,加上官方别名——不是全集,别的模型直接填就行。"
          },
          {
            name: "grok",
            provider: "grok_cli",
            found: true,
            auth: { status: "logged_in" },
            enumerable: true,
            models: [{ id: "grok-4.6", source: "listed" }]
          }
        ]}
        value={{ kind: "cli", provider: "claude_cli", model: "claude-fable-5" }}
        onChange={() => {}}
        allowSkip={false}
      />
    );
    expect(picker).not.toContain("从你本机用过的记录里找到");
    expect(picker).not.toContain("其他模型名可直接填");
    expect(picker).not.toContain("data-supply-note");
    expect(picker).toContain("搜索或直接填模型名(已知 2 个)");
    expect(picker).toContain("没有完整列表");
    expect(picker).not.toContain("可留空或直接填");
    expect(picker).toContain("1 个模型");
    expect(picker).not.toContain("个模型可搜");
    expect(picker).not.toContain("没有列出全部模型的接口");
    expect(picker).not.toContain("想从列表里挑");
    expect(picker).toContain("data-combo-surface=\"inset\"");
    expect(picker.replace(/<[^>]+>/g, " ")).not.toMatch(/\{/);

    const mixedZones = renderToStaticMarkup(
      <PurposeZones
        supplies={{
          ...supplies,
          evaluator: { kind: "cli", provider: "claude_cli", model: "claude-fable-5" }
        }}
        preset={supplies}
        clis={[]}
        openModelSlot={null}
        onOpenModelSlot={() => {}}
        openHouseSlot={null}
        onOpenHouseSlot={() => {}}
        onModelChange={() => {}}
        onHouseChange={() => {}}
        disabled={false}
        reprobing={false}
        onReprobeCli={() => {}}
      />
    );
    expect(mixedZones).toContain("data-mixed-badge=\"evaluator\"");
    expect(mixedZones).not.toContain("跟回");
    expect(mixedZones).not.toContain("follow-back");
  });

  it("向导首帧不再渲染覆盖确认框", () => {
    const probe: SetupProbe = {
      config: { present: false, slots: { dialog: { status: "missing", effective: "unarmed" } } },
      secrets: {},
      acks: { evaluator_isolation: false, evaluator_same_family: false },
      hints: [],
      clis: [],
      voice: { asr: "down", tts: "down" },
      pendingConfig: null,
      pendingEnv: null,
      recovery: { active: false, mode: "normal", violations: [] }
    };
    const html = renderToStaticMarkup(
      <SetupWizard probe={probe} onDone={() => {}} onProbeRefresh={async () => probe} />
    );
    expect(html).not.toContain("data-overwrite-mix-confirm");
    expect(html).not.toContain("覆盖这套混搭");
    expect(html).not.toContain("点左边选一家");
    expect(html).not.toContain("点「切换提供商」即可");
    expect(html).not.toContain("想换家");
    expect(html).not.toContain("看看为什么");
  });
});
