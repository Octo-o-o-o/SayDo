import {
  CLI_LABEL,
  CLI_PROVIDER_CONTRACT,
  MODEL_SLOT_DESCRIPTION,
  cliWiredForSupply,
  type ApiKeyName,
  type CliCapability,
  type CliCostProvenance,
  type CliName,
  type CliProvider,
  type SlotSupply,
  type WizardSlot
} from "./setupApi";

export type PlanAcks = {
  evaluatorIsolation: boolean;
  evaluatorSameFamily: boolean;
};

export type ResourcePlanShape = "all-cli" | "mixed" | "all-api";

export type QuickConfigPlan = {
  kind: "config";
  id: string;
  shape: ResourcePlanShape;
  title: string;
  positioning: string;
  cost: string;
  supplies: Record<WizardSlot, Exclude<SlotSupply, { kind: "skip" }>>;
  requiredAcks: PlanAcks;
  // fallbackPlanId 已删除:无消费方。自检失败降级走 fallbackResourcePlan(按 provider 现场构造 mixed),不另维护一套 id 关系。
};

export type ResourcePlan = QuickConfigPlan;

export type ResourceProfile = {
  clis: CliCapability[];
  secrets: Record<string, boolean>;
};

export const API_SECRET_NAMES: ApiKeyName[] = [
  "OPENROUTER_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "DEEPSEEK_API_KEY"
];

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_KEY: ApiKeyName = "OPENROUTER_API_KEY";
const DEEPSEEK_KEY: ApiKeyName = "DEEPSEEK_API_KEY";
/**
 * DeepSeek 单家直连的四槽预设(09 §11 [providers.api.deepseek] 样例同源)。
 * 四槽同为 deepseek-* ⇒ familyFromModelName 恒解析为 deepseek ⇒ evaluator 必然与 dialog 同族,
 * 故本方案的 same-family ack 前置默认勾选(11 §5 owner 2026-08-15 裁决)。
 *
 * 模型名以 2026-08-15 实测的官方 /v1/models 为准:仅 deepseek-v4-flash / deepseek-v4-pro 两个。
 * 旧别名 deepseek-chat / deepseek-reasoner 仍可调用,但服务端**都**映射到 v4-flash
 * (实测 observedModel 恒为 deepseek-v4-flash) —— 那会让沉思档拿不到更强模型,
 * 且配置写的与实际跑的不一致,违反 observedModel 纪律,故不用别名。
 * 证据:e2e/spikes/deepseek-toolloop/。
 */
const DEEPSEEK_SLOT_MODELS: Record<WizardSlot, string> = {
  dialog: "deepseek-v4-flash",
  thinking: "deepseek-v4-pro",
  cheap: "deepseek-v4-flash",
  evaluator: "deepseek-v4-pro"
};
const SLOT_ORDER: WizardSlot[] = ["dialog", "thinking", "cheap", "evaluator"];
const CLI_VENDOR_ORDER: Record<CliName, number> = {
  codex: 0,
  "cursor-agent": 1,
  claude: 2,
  grok: 3,
  kimi: 4,
  opencode: 5,
  pi: 6,
  gemini: 7,
  aider: 8,
  qwen: 9,
  copilot: 10,
  vibe: 11
};

/** 方案卡优先展示的已接线 CLI(顺序稳定;其余家只从画像行进入) */
export const PLAN_CLI_PRIORITY: CliName[] = [
  "codex",
  "cursor-agent",
  "claude",
  "grok",
  "gemini",
  "qwen",
  "copilot"
];

function openrouter(model: string) {
  return {
    kind: "api" as const,
    baseURL: OPENROUTER_BASE_URL,
    apiKey: "",
    model,
    presentKeyNames: [OPENROUTER_KEY]
  };
}

function apiSupplies(): QuickConfigPlan["supplies"] {
  return {
    dialog: openrouter("openai/gpt-5.6-luna"),
    thinking: openrouter("openai/gpt-5.6-terra-pro"),
    cheap: openrouter("google/gemini-3.1-flash-lite"),
    evaluator: openrouter("anthropic/claude-sonnet-5")
  };
}

function cliLabel(cli: CliCapability): string {
  return cli.label ?? CLI_LABEL[cli.name] ?? cli.name;
}

export function firstCliModel(cli: CliCapability): string | undefined {
  const skipAuto = cli.provider ? CLI_PROVIDER_CONTRACT[cli.provider].skipAutoCandidate : false;
  const models = skipAuto
    ? cli.models.filter((model) => model.id.trim().toLowerCase() !== "auto")
    : cli.models;
  return models.find((model) => model.id.trim())?.id;
}

export function cliUsableForPlans(cli: CliCapability): boolean {
  if (!cliWiredForSupply(cli) || !cli.found || cli.auth.status !== "logged_in" || !cli.provider) {
    return false;
  }
  return !CLI_PROVIDER_CONTRACT[cli.provider].modelRequired || firstCliModel(cli) !== undefined;
}

/** 计费文案只认探测 provenance;缺字段按 unknown,禁止把登录写成免费 */
export function costCopyForProvenance(provenance: CliCostProvenance | undefined): string {
  if (provenance === "subscription") return "探测为订阅登录态;费用以服务商账单为准";
  if (provenance === "external_api") return "按该 CLI 配置的上游计费,SayDo 不代付";
  return "计费方式未知,以你的 CLI 账单为准";
}

export type CliPortraitActionKind = "use_all" | "login_and_reprobe" | "confirm" | "inventory_only" | "none";

/** 画像行直达动作分派(列表即菜单) */
export function resolveCliPortraitAction(cli: CliCapability): CliPortraitActionKind {
  if (!cli.found) return "none";
  if (!cliWiredForSupply(cli)) return "inventory_only";
  if (cli.auth.status === "unknown") return "confirm";
  if (cli.auth.status === "not_logged_in") return "login_and_reprobe";
  if (cliUsableForPlans(cli)) return "use_all";
  return "none";
}

function cliSupply(provider: CliProvider, model: string | undefined) {
  return { kind: "cli" as const, provider, ...(model ? { model } : {}) };
}

function usableModelId(cli: CliCapability, id: string): boolean {
  const skipAuto = cli.provider ? CLI_PROVIDER_CONTRACT[cli.provider].skipAutoCandidate : false;
  return Boolean(id.trim()) && !(skipAuto && id.trim().toLowerCase() === "auto");
}

/** 默认模型:used 次数最高;无 used 则列表首项(cursor 仍跳过 auto);再没有则空。空预置家回退用。 */
export function defaultModelId(cli: CliCapability): string | undefined {
  const used = cli.models
    .filter((model) => model.source === "used" && usableModelId(cli, model.id))
    .sort((a, b) => (b.seen ?? 1) - (a.seen ?? 1));
  if (used[0]) return used[0].id;
  return firstCliModel(cli);
}

function normalizeModelId(id: string): string {
  return id.trim().toLowerCase();
}

function vendorTail(id: string): string {
  const normalized = normalizeModelId(id);
  const slash = normalized.lastIndexOf("/");
  return slash >= 0 ? normalized.slice(slash + 1) : normalized;
}

const SOURCE_MATCH_RANK: Record<string, number> = { alias: 0, used: 1, configured: 2, listed: 3 };

/** 探测 id 对上预置(精确 / 大小写 / 前缀漂移 / 家族子串)。对上则返回探测真名。 */
export function findMatchingProbeModelId(
  preset: string,
  cli: CliCapability
): string | undefined {
  const target = normalizeModelId(preset);
  if (!target) return undefined;
  const candidates = cli.models.filter((model) => usableModelId(cli, model.id));
  const exact = candidates.find((model) => normalizeModelId(model.id) === target);
  if (exact) return exact.id;
  const targetTail = vendorTail(preset);
  const prefixed = candidates.find((model) => vendorTail(model.id) === targetTail);
  if (prefixed) return prefixed.id;
  const family = candidates.filter((model) => normalizeModelId(model.id).includes(target));
  if (family.length === 0) return undefined;
  family.sort((a, b) => {
    const rankA = SOURCE_MATCH_RANK[a.source] ?? 4;
    const rankB = SOURCE_MATCH_RANK[b.source] ?? 4;
    if (rankA !== rankB) return rankA - rankB;
    if ((b.seen ?? 0) !== (a.seen ?? 0)) return (b.seen ?? 0) - (a.seen ?? 0);
    return a.id.length - b.id.length;
  });
  return family[0]?.id;
}

/**
 * 预置串 → 槽位初值。探测能对上用探测 id;对不上时可枚举家回退列表首项、不可枚举家回退预置串。
 * 预置空串=无分档,回退 defaultModelId(探测单值)。
 */
export function resolvePresetModelId(preset: string, cli: CliCapability): string | undefined {
  const hint = preset.trim();
  if (!hint) return defaultModelId(cli);
  const matched = findMatchingProbeModelId(hint, cli);
  if (matched) return matched;
  if (cli.enumerable) return firstCliModel(cli);
  return hint;
}

export function resolveDefaultSlotModels(cli: CliCapability): Record<WizardSlot, string | undefined> {
  const presets = cli.provider ? CLI_PROVIDER_CONTRACT[cli.provider].defaultSlotModels : undefined;
  if (!presets) {
    const fallback = defaultModelId(cli);
    return { dialog: fallback, thinking: fallback, cheap: fallback, evaluator: fallback };
  }
  return {
    dialog: resolvePresetModelId(presets.dialog, cli),
    thinking: resolvePresetModelId(presets.thinking, cli),
    cheap: resolvePresetModelId(presets.cheap, cli),
    evaluator: resolvePresetModelId(presets.evaluator, cli)
  };
}

/** 单槽预置供给:该家 defaultSlotModels 对应档。左栏 allCliPlan 与槽行换家同源。 */
export function presetSupplyForSlot(
  cli: CliCapability,
  slot: WizardSlot
): Extract<SlotSupply, { kind: "cli" }> {
  if (!cli.provider) {
    throw new Error(`inventory-only CLI 不能生成槽供给:${cli.name}`);
  }
  return cliSupply(cli.provider, resolveDefaultSlotModels(cli)[slot]);
}

function cliSupplies(cli: CliCapability): QuickConfigPlan["supplies"] {
  return {
    dialog: presetSupplyForSlot(cli, "dialog"),
    thinking: presetSupplyForSlot(cli, "thinking"),
    cheap: presetSupplyForSlot(cli, "cheap"),
    evaluator: presetSupplyForSlot(cli, "evaluator")
  };
}

/**
 * 槽行换家:新家且未带模型 → 填 presetSupplyForSlot(对应档)。
 * 同家已带模型(pickCli 保留)原样;API/跳过原样;找不到探测能力则留空。
 */
export function applySlotHousePreset(
  slot: WizardSlot,
  next: SlotSupply,
  clis: readonly CliCapability[]
): SlotSupply {
  if (next.kind !== "cli") return next;
  if (next.model) return next;
  const cli = clis.find((item) => item.provider === next.provider);
  if (!cli) return next;
  const preset = presetSupplyForSlot(cli, slot);
  return next.ack ? { ...preset, ack: true } : preset;
}

/**
 * ack 显隐单源。console 不推断家族:
 * 评估=CLI ⇒ 恒双 ack(缺则 daemon 侧 unarmed,不能按「异家」藏 same-family);
 * 评估=API / 跳过 / 缺省 ⇒ 不前置勾选,same-family 走「先存、422 再摊开」。
 */
export function requiredAcksForSupplies(
  supplies: Partial<Record<WizardSlot, SlotSupply>>
): PlanAcks {
  const evaluator = supplies.evaluator;
  if (!evaluator || evaluator.kind === "skip" || evaluator.kind === "api") {
    return { evaluatorIsolation: false, evaluatorSameFamily: false };
  }
  return { evaluatorIsolation: true, evaluatorSameFamily: true };
}

export function isSlotMixed(supply: SlotSupply, preset: SlotSupply): boolean {
  if (supply.kind === "skip") return true;
  if (supply.kind !== preset.kind) return true;
  if (supply.kind === "cli" && preset.kind === "cli") {
    return supply.provider !== preset.provider || (supply.model ?? "") !== (preset.model ?? "");
  }
  if (supply.kind === "api" && preset.kind === "api") {
    return supply.baseURL.trim() !== preset.baseURL.trim() || (supply.model ?? "") !== (preset.model ?? "");
  }
  return true;
}

export function mixedSlotsOf(
  supplies: Record<WizardSlot, SlotSupply>,
  preset: QuickConfigPlan["supplies"]
): WizardSlot[] {
  return SLOT_ORDER.filter((slot) => isSlotMixed(supplies[slot], preset[slot]));
}

export function followSlotToPreset(
  supplies: Record<WizardSlot, SlotSupply>,
  preset: QuickConfigPlan["supplies"],
  slot: WizardSlot
): Record<WizardSlot, SlotSupply> {
  return { ...supplies, [slot]: { ...preset[slot] } };
}

/** 已存 key 按 probe.secrets 选;没有就空表单。禁止套 mixedPlan 假 OR key。 */
export function apiDraftFromSecrets(secrets: Record<string, boolean>): Extract<SlotSupply, { kind: "api" }> {
  const keyName = API_SECRET_NAMES.find((name) => secrets[name] === true);
  if (!keyName) return { kind: "api", baseURL: "", apiKey: "", model: "" };
  return {
    kind: "api",
    baseURL: API_KEY_BASE_URL[keyName],
    apiKey: "",
    model: "",
    presentKeyNames: [keyName]
  };
}

export function startButtonLabel(mixed: boolean): string {
  return mixed ? "按这套配置,启动" : "全用它,启动";
}

export const MIX_SNAPSHOT_ID = "mix:snapshot";

export type MixSnapshot = {
  baseId: string;
  baseLabel: string;
  plan: QuickConfigPlan;
  supplies: Record<WizardSlot, SlotSupply>;
};

export type MixViewState = {
  selectedId: string;
  plan: QuickConfigPlan;
  supplies: Record<WizardSlot, SlotSupply>;
  snapshot: MixSnapshot | null;
};

export function mixSnapshotLine(snapshot: MixSnapshot): string {
  const n = mixedSlotsOf(snapshot.supplies, snapshot.plan.supplies).length;
  return `以 ${snapshot.baseLabel} 为底 · ${n} 槽自定义`;
}

export type LeftRailDecision = "noop" | "apply" | "restore";

/** 左栏点选:同刻直接切,不再弹覆盖确认。点「我的混搭」=restore。 */
export function decideLeftRailSelect(input: {
  busy: boolean;
  currentId: string | null;
  nextId: string;
}): LeftRailDecision {
  if (input.busy) return "noop";
  if (input.currentId === input.nextId) return "noop";
  if (input.nextId === MIX_SNAPSHOT_ID) return "restore";
  return "apply";
}

/** @deprecated v3.2 确认框退役;保留别名以免旧测试瞬间断裂。 */
export type LeftSupplyDecision = LeftRailDecision | "confirm";

export function shouldConfirmLeftSupplyChange(input: {
  busy: boolean;
  currentId: string | null;
  nextId: string;
  mixed?: boolean;
}): LeftSupplyDecision {
  return decideLeftRailSelect(input);
}

export function reduceMixAfterEdit(
  state: MixViewState,
  nextSupplies: Record<WizardSlot, SlotSupply>,
  houseLabel: string
): MixViewState {
  if (state.selectedId === MIX_SNAPSHOT_ID && state.snapshot) {
    const mixed = mixedSlotsOf(nextSupplies, state.snapshot.plan.supplies);
    if (mixed.length === 0) {
      return {
        selectedId: state.snapshot.baseId,
        plan: state.snapshot.plan,
        supplies: nextSupplies,
        snapshot: null
      };
    }
    return {
      ...state,
      supplies: nextSupplies,
      snapshot: { ...state.snapshot, supplies: nextSupplies }
    };
  }
  const mixed = mixedSlotsOf(nextSupplies, state.plan.supplies);
  if (mixed.length === 0) {
    return { ...state, supplies: nextSupplies };
  }
  return {
    selectedId: MIX_SNAPSHOT_ID,
    plan: state.plan,
    supplies: nextSupplies,
    snapshot: {
      baseId: state.selectedId,
      baseLabel: houseLabel,
      plan: state.plan,
      supplies: nextSupplies
    }
  };
}

export function reduceMixAfterSelectHouse(
  state: MixViewState,
  nextId: string,
  nextPlan: QuickConfigPlan
): MixViewState {
  if (state.selectedId === nextId) return state;
  return {
    selectedId: nextId,
    plan: nextPlan,
    supplies: {
      dialog: nextPlan.supplies.dialog,
      thinking: nextPlan.supplies.thinking,
      cheap: nextPlan.supplies.cheap,
      evaluator: nextPlan.supplies.evaluator
    },
    snapshot: state.snapshot
  };
}

export function reduceMixRestore(state: MixViewState): MixViewState {
  if (!state.snapshot) return state;
  return {
    selectedId: MIX_SNAPSHOT_ID,
    plan: state.snapshot.plan,
    supplies: state.snapshot.supplies,
    snapshot: state.snapshot
  };
}

function usedScore(cli: CliCapability): number {
  return cli.models.reduce((total, model) => total + (model.source === "used" ? Math.max(1, model.seen ?? 1) : 0), 0);
}

/** 排序不依赖接口或对象遍历顺序:登录态、使用记录、安装态、固定厂商序。 */
export function sortCliCapabilities(clis: readonly CliCapability[]): CliCapability[] {
  const authScore = (cli: CliCapability) => (cli.auth.status === "logged_in" ? 2 : cli.found ? 1 : 0);
  return [...clis].sort(
    (a, b) =>
      authScore(b) - authScore(a) ||
      usedScore(b) - usedScore(a) ||
      Number(b.found) - Number(a.found) ||
      CLI_VENDOR_ORDER[a.name] - CLI_VENDOR_ORDER[b.name]
  );
}

/** 公共 all-cli factory:推荐槽首位与画像行「全用它」共用,禁止再写一套卡面 */
export function allCliPlan(cli: CliCapability): QuickConfigPlan {
  if (!cli.provider) {
    throw new Error(`inventory-only CLI 不能生成方案卡:${cli.name}`);
  }
  const label = cliLabel(cli);
  const phrase = costCopyForProvenance(cli.billing?.provenance);
  const supplies = cliSupplies(cli);
  return {
    kind: "config",
    id: `all-cli-${cli.provider}`,
    shape: "all-cli",
    title: `全用 ${label}(${phrase})`,
    positioning: `对话走 ${label} CLI 慢速模式,沉思、廉价、评估槽也复用本机 ${label}。其它检测到的 CLI 在上方列表里,点『全用它』同样一键配好`,
    cost: `${phrase}。对话每轮约 15-25 秒。启动前会真实自检,四槽全过才生效。`,
    supplies,
    requiredAcks: requiredAcksForSupplies(supplies)
  };
}

export function mixedPlan(cli: CliCapability): QuickConfigPlan {
  const label = cliLabel(cli);
  const cliSlots = cliSupplies(cli);
  const phrase = costCopyForProvenance(cli.billing?.provenance);
  return {
    kind: "config",
    id: `mixed-${cli.provider}`,
    shape: "mixed",
    title: "对话走 API+其余槽 CLI",
    positioning: `对话用 API;沉思、廉价、评估槽走本机 ${label}。时延以服务商为准。`,
    cost: `对话按 API 实际用量计费;其余三槽${phrase}。`,
    supplies: { ...cliSlots, dialog: apiSupplies().dialog },
    requiredAcks: requiredAcksForSupplies({ ...cliSlots, dialog: apiSupplies().dialog })
  };
}

const ONE_KEY_PLAN: QuickConfigPlan = {
  kind: "config",
  id: "one-api-key",
  shape: "all-api",
  title: "一个 key 全搞定",
  positioning: "四个推理槽都经 OpenRouter API,保存后按各槽真实模型调用。",
  cost: "API 按实际用量计费;这里不展示月费数字,以服务商账单为准。",
  supplies: apiSupplies(),
  requiredAcks: requiredAcksForSupplies(apiSupplies())
};

export type AvailableSupply =
  | { kind: "cli"; id: string; cli: CliCapability }
  | { kind: "api"; id: string; keyName: ApiKeyName };

const API_KEY_LABEL: Record<ApiKeyName, string> = {
  OPENROUTER_API_KEY: "OpenRouter",
  OPENAI_API_KEY: "OpenAI",
  ANTHROPIC_API_KEY: "Anthropic",
  DEEPSEEK_API_KEY: "DeepSeek"
};

const API_KEY_BASE_URL: Record<ApiKeyName, string> = {
  OPENROUTER_API_KEY: OPENROUTER_BASE_URL,
  OPENAI_API_KEY: "https://api.openai.com/v1",
  ANTHROPIC_API_KEY: "https://api.anthropic.com/v1",
  DEEPSEEK_API_KEY: "https://api.deepseek.com/v1" // 09 §11 [providers.api.deepseek] 同源
};

export function apiKeyLabel(name: ApiKeyName): string {
  return API_KEY_LABEL[name];
}

export function apiKeyBaseUrl(name: ApiKeyName): string {
  return API_KEY_BASE_URL[name];
}

/** 快速视图主列表:只列可用 CLI + 已存 key。inventory/未登录/无模型不进。 */
export function listAvailableSupplies(profile: ResourceProfile): AvailableSupply[] {
  const clis = sortCliCapabilities(profile.clis)
    .filter(cliUsableForPlans)
    .map((cli) => ({ kind: "cli" as const, id: `cli:${cli.name}`, cli }));
  const apis = API_SECRET_NAMES.filter((name) => profile.secrets[name] === true).map((keyName) => ({
    kind: "api" as const,
    id: `api:${keyName}`,
    keyName
  }));
  return [...clis, ...apis];
}

/** 两轮后仍不可用:已装但未登录/超时/inventory/缺模型。未安装不进,避免噪声。 */
export function listUnreadyClis(clis: readonly CliCapability[]): CliCapability[] {
  return sortCliCapabilities(clis).filter(
    (cli) => !cliUsableForPlans(cli) && (cli.found || cli.auth.status === "unknown")
  );
}

export function needsCapabilityReprobe(cli: CliCapability): boolean {
  return cli.auth.status === "unknown";
}

export function unreadyReasonCopy(cli: CliCapability): string {
  if (!cliWiredForSupply(cli)) return "可识别,暂不能当模型供给(安全原因)";
  if (cli.auth.status === "not_logged_in") {
    const hint = cli.auth.fixHint?.trim();
    return hint ? `未登录,跑 \`${hint}\` 后点刷新` : "未登录,登录后点刷新";
  }
  if (cli.auth.status === "unknown") return "探测超时";
  if (cli.provider && CLI_PROVIDER_CONTRACT[cli.provider].modelRequired && firstCliModel(cli) === undefined) {
    return "未发现可选的非 auto 模型";
  }
  return "暂不可用";
}

/** inventory(provider=null) 重测也进不了主列表;仅超时/未登录等 wired 家保留重试与真实测一发。 */
export function unreadyCliAllowsLiveCheck(cli: CliCapability): boolean {
  return cli.provider !== null;
}

export function supplyOneLiner(supply: AvailableSupply): string {
  if (supply.kind === "api") return "已存 key · 计费以服务商为准 · 有效性以启动自检为准";
  const cli = supply.cli;
  const used = cli.models.filter((model) => model.source === "used").length;
  const usedPart = used > 0 ? `本机用过 ${used} 个模型` : cli.enumerable ? `${cli.models.length} 个模型` : "模型数未知";
  return `已登录 · ${usedPart}`;
}

export function apiKeyPlan(keyName: ApiKeyName): QuickConfigPlan {
  if (keyName === OPENROUTER_KEY) return ONE_KEY_PLAN;
  const baseURL = API_KEY_BASE_URL[keyName];
  const label = API_KEY_LABEL[keyName];
  const isDeepseek = keyName === DEEPSEEK_KEY;
  // DeepSeek 单家直连有四槽预设(一键即可用);其余端点模型仍留空,由用户在槽行选。
  const slot = (slotName: WizardSlot) => ({
    kind: "api" as const,
    baseURL,
    apiKey: "",
    model: isDeepseek ? DEEPSEEK_SLOT_MODELS[slotName] : "",
    presentKeyNames: [keyName]
  });
  const supplies = {
    dialog: slot("dialog"),
    thinking: slot("thinking"),
    cheap: slot("cheap"),
    evaluator: slot("evaluator")
  };
  return {
    kind: "config",
    id: `one-api-${keyName}`,
    shape: "all-api",
    title: `全用 ${label}(已存 key · 有效性以启动自检为准)`,
    positioning: `四个推理槽都经 ${label} API,保存后按各槽真实模型调用。`,
    cost: "已存 key · 计费以服务商为准。有效性以启动自检为准。",
    supplies,
    // 单家直连四槽同族恒成立 ⇒ same-family ack 前置(11 §5 owner 2026-08-15);
    // 不走 requiredAcksForSupplies 的「API 一律不前置」缺省,否则用户必撞一次 422。
    requiredAcks: isDeepseek
      ? { evaluatorIsolation: false, evaluatorSameFamily: true }
      : requiredAcksForSupplies(supplies)
  };
}

export function oneKeyFromForm(input: { baseURL: string; apiKey: string; model: string }): QuickConfigPlan {
  const slot = {
    kind: "api" as const,
    baseURL: input.baseURL.trim(),
    apiKey: input.apiKey,
    model: input.model.trim()
  };
  return {
    kind: "config",
    id: "one-api-draft",
    shape: "all-api",
    title: "全用这个 API(按量计费)",
    positioning: "四个推理槽都走刚填的 API 端点。",
    cost: "API 按实际用量计费;有效性以启动自检为准。",
    supplies: { dialog: slot, thinking: { ...slot }, cheap: { ...slot }, evaluator: { ...slot } },
    requiredAcks: requiredAcksForSupplies({
      dialog: slot,
      thinking: { ...slot },
      cheap: { ...slot },
      evaluator: { ...slot }
    })
  };
}

export function planForAvailableSupply(supply: AvailableSupply): QuickConfigPlan {
  return supply.kind === "cli" ? allCliPlan(supply.cli) : apiKeyPlan(supply.keyName);
}

export function filterModelOptions<T extends { id: string; label?: string }>(models: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return models;
  return models.filter(
    (model) => model.id.toLowerCase().includes(needle) || (model.label ?? "").toLowerCase().includes(needle)
  );
}

/** 自检失败去向:不再自动换成 mixed,只提供可预填的草稿。 */
export function mixedPrefillForFailedPlan(
  plan: QuickConfigPlan,
  profile: ResourceProfile
): QuickConfigPlan | undefined {
  const dialogSupply = plan.supplies.dialog;
  if (dialogSupply.kind !== "cli") return undefined;
  const cli = profile.clis.find((candidate) => candidate.provider === dialogSupply.provider);
  return cli ? mixedPlan(cli) : undefined;
}

/** @deprecated 三席推荐槽已退役;保留别名以免旧测试/调用瞬间断裂。 */
export function fallbackResourcePlan(
  plan: QuickConfigPlan,
  profile: ResourceProfile
): QuickConfigPlan | undefined {
  return mixedPrefillForFailedPlan(plan, profile);
}

export function suppliesWithModels(
  plan: QuickConfigPlan,
  models: Partial<Record<WizardSlot, string>>
): QuickConfigPlan["supplies"] {
  return Object.fromEntries(
    SLOT_ORDER.map((slot) => {
      const supply = plan.supplies[slot];
      const model = models[slot];
      return [slot, model === undefined ? supply : { ...supply, model }];
    })
  ) as QuickConfigPlan["supplies"];
}

export const PLAN_SLOT_DESCRIPTION: Record<WizardSlot | "dev", string> = MODEL_SLOT_DESCRIPTION;
