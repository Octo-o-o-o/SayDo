// First-run setup API(与 daemon 并行批合同写死;响应缺字段容错,不发明契约字段)。
// 快照来源:施工 prompt 接口快照 + .onboarding-spec.md v2/v4。

import { isWiredCliProvider, WIRED_CLI_PROVIDERS, type CostProvenance, type WiredCliProvider } from "@saydo/contracts";
import { apiGet, capToken, daemonBase } from "./api";
import { ApiError, apiErrorFromNetwork, apiErrorFromResponse } from "./apiError";

/** probe 槽位键与 daemon SetupProbeResult 完全一致 */
export type ProbeSlot = "dialog" | "thinking" | "cheap" | "evaluator" | "dev";

export type SlotHealth = "ok" | "missing" | "key_missing" | "configured";
export type EffectiveSlotState = "active" | "fallback_dialog" | "unarmed";

export type ProbeSlotState = {
  status: SlotHealth;
  effective: EffectiveSlotState;
  mode?: "realtime" | "oneshot";
  provider?: string;
  model?: string;
  agent?: string;
  reason?:
    | "cli_self_test_required"
    | "cli_self_test_failed"
    | "provider_unavailable"
    | "same_family_blocked"
    | "isolation_ack_required"
    | "recovery_only";
  fallbackTo?: "dialog";
};

export type ProbeCli = {
  name: string;
  found: boolean;
  version?: string;
  path?: string;
};

export type SetupProbe = {
  config: {
    present: boolean;
    slots: Partial<Record<ProbeSlot, ProbeSlotState>>;
  };
  secrets: Record<string, boolean>;
  acks: {
    evaluator_isolation: boolean;
    evaluator_same_family: boolean;
  };
  hints: SetupViolation[];
  clis: ProbeCli[];
  voice: { pipelinePeer?: boolean; asr: string; tts: string; note?: string };
  pendingConfig: null | {
    present: boolean;
    status: "ready_to_promote" | "validation_failed";
    error?: string;
  };
  pendingEnv: null | { present: boolean };
  recovery: {
    active: boolean;
    mode: "normal" | "recovery_only";
    violations: SetupViolation[];
  };
};

/** 命名 API 端点(contracts namedApiProviderSchema;api_key 仅 env:NAME) */
export type NamedApiProviderBody = {
  base_url: string;
  api_key: `env:${string}`;
  family?: string;
  provider_order?: string[];
};

export type SetupModelBindingBody =
  | { provider: "api"; model: string; via?: string }
  | { provider: "cursor_cli"; model: string }
  | {
      provider: Exclude<WiredCliProvider, "cursor_cli">;
      model?: string;
    };

export type SetupConfigBody = {
  models?: {
    dialog?: SetupModelBindingBody;
    thinking?: SetupModelBindingBody;
    cheap?: SetupModelBindingBody;
    evaluator?: SetupModelBindingBody;
    evaluator_isolation_ack?: boolean;
    evaluator_same_family_ack?: boolean;
  };
  /** v5:providers.api.<name> 与 models 同次提交,保证原子 */
  providers?: {
    api?: Record<string, NamedApiProviderBody>;
  };
  budget?: unknown;
  dnd?: unknown;
};

export type SetupViolation = { code?: string; path?: string; slot?: string; message?: string; fix?: string };

/**
 * setup 写口错误:保留 daemon 的 code + violations。
 * 注意 daemon 的校验失败响应里,顶层 code 恒为 config_validation_failed,
 * 具体是哪条规则在 violations[] 里——只看顶层 code 会永远匹配不上
 * (2026-08-10 实测:同族确认框因此从未弹出过)。
 */
export class SetupApiError extends Error {
  readonly code?: string;
  readonly status?: number;
  readonly violations: SetupViolation[];
  constructor(message: string, opts?: { code?: string; status?: number; violations?: SetupViolation[] }) {
    super(message);
    this.name = "SetupApiError";
    this.code = opts?.code;
    this.status = opts?.status;
    this.violations = opts?.violations ?? [];
  }

  /** 顶层 code 或任一 violation 命中 */
  hasViolation(code: string): boolean {
    return this.code === code || this.violations.some((v) => v.code === code);
  }
}

function parseViolations(raw: unknown): SetupViolation[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: SetupViolation[] = [];
  for (const item of list) {
    const o = asRecord(item);
    const code = asString(o["code"]);
    const path = asString(o["path"]);
    const message = asString(o["message"]);
    if (!code && !path && !message) continue;
    out.push({
      ...(code ? { code } : {}),
      ...(path ? { path } : {}),
      ...(asString(o["slot"]) ? { slot: asString(o["slot"]) as string } : {}),
      ...(message ? { message } : {}),
      ...(asString(o["fix"]) ? { fix: asString(o["fix"]) as string } : {})
    });
  }
  return out;
}

/**
 * 由 baseURL 推导 providers.api 端点名 / models.*.via。
 * host 首段小写,非法字符转 _;常见 api. 前缀跳过(api.openai.com → openai)。
 */
export function deriveProviderViaName(baseURL: string): string {
  let host = "";
  try {
    host = new URL(baseURL).hostname;
  } catch {
    host = baseURL.replace(/^https?:\/\//i, "").split("/")[0] ?? "";
    // 去掉可能的 userinfo / 端口
    host = host.replace(/^[^@]*@/, "").replace(/:\d+$/, "");
  }
  const labels = host
    .toLowerCase()
    .split(".")
    .map((s) => s.trim())
    .filter(Boolean);
  let name = labels[0] ?? "api";
  if (name === "api" && labels.length >= 2) {
    name = labels[1]!;
  }
  name = name.replace(/[^a-z0-9_]/g, "_").replace(/^_+|_+$/g, "");
  return name.length > 0 ? name : "api";
}

export type SetupWriteResult = {
  ok: boolean;
  restart_required: boolean;
  name?: string;
};

export type TestSlotStatus = "ok" | "fail" | "untested";

export type SetupTestSlot = {
  status: TestSlotStatus;
  latencyMs?: number;
  error?: string;
  detail?: string;
  requestedModel?: string;
  observedModel?: string;
};

export type SetupTestResult = Record<string, SetupTestSlot>;

export type HealthSnapshot = {
  ok: boolean;
  pid?: number;
  startedAt?: string;
};

const PROBE_SLOTS: ProbeSlot[] = ["dialog", "thinking", "cheap", "evaluator", "dev"];

function asRecord(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function asBool(v: unknown): boolean {
  return v === true;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/**
 * setup 端点的自管 fetch。
 *
 * 这些端点各有自己的响应形状(422 的 violations、test 的槽位 map、restart 的 202),
 * 不能一律走 apiPost;但**传输层**没有理由各写一套:连不上、凭证失效、服务正在启动,
 * 都与"你填的配置对不对"无关,一律交给 apiError 统一分类。
 * (2026-08-12 实测:这些路径此前把 `TypeError: Failed to fetch` 和 daemon 的
 * "G1 identity check failed" 原样端给用户——首启保存配置正走这条链。)
 * 业务层错误仍由各函数抛 SetupApiError,violations 一个不丢。
 */
async function setupFetch(path: string, init?: RequestInit): Promise<{ res: Response; body: Record<string, unknown> }> {
  let res: Response;
  try {
    res = await fetch(`${daemonBase()}${path}`, init);
  } catch (err) {
    throw apiErrorFromNetwork(err, path);
  }
  const body = asRecord(await res.json().catch(() => null));
  if (res.status === 401 || res.status === 403 || res.status === 503) {
    throw apiErrorFromResponse(res.status, body, path);
  }
  return { res, body };
}

function parseSlotState(v: unknown): ProbeSlotState | undefined {
  const o = asRecord(v);
  const status = asString(o["status"]);
  if (status !== "ok" && status !== "missing" && status !== "key_missing" && status !== "configured") {
    return undefined;
  }
  const effectiveRaw = asString(o["effective"]);
  const effective: EffectiveSlotState =
    effectiveRaw === "active" || effectiveRaw === "fallback_dialog" || effectiveRaw === "unarmed"
      ? effectiveRaw
      : "unarmed";
  const reason = asString(o["reason"]);
  const mode = asString(o["mode"]);
  return {
    status,
    effective,
    ...(asString(o["provider"]) ? { provider: asString(o["provider"]) as string } : {}),
    ...(asString(o["model"]) ? { model: asString(o["model"]) as string } : {}),
    ...(asString(o["agent"]) ? { agent: asString(o["agent"]) as string } : {}),
    ...(mode === "realtime" || mode === "oneshot" ? { mode } : {}),
    ...(reason === "cli_self_test_required" ||
    reason === "cli_self_test_failed" ||
    reason === "provider_unavailable" ||
    reason === "same_family_blocked" ||
    reason === "isolation_ack_required" ||
    reason === "recovery_only"
      ? { reason }
      : {}),
    ...(o["fallbackTo"] === "dialog" ? { fallbackTo: "dialog" as const } : {})
  };
}

function parsePendingConfig(v: unknown): SetupProbe["pendingConfig"] {
  const o = asRecord(v);
  const status = asString(o["status"]);
  if (status !== "ready_to_promote" && status !== "validation_failed") return null;
  return {
    present: asBool(o["present"]),
    status,
    ...(asString(o["error"]) ? { error: asString(o["error"]) as string } : {})
  };
}

function parseTestStatus(v: unknown): TestSlotStatus {
  if (v === "ok" || v === "fail" || v === "untested") return v;
  // 兼容 v1 布尔形态(若 daemon 仍回 {ok:true})
  if (v === true) return "ok";
  if (v === false) return "fail";
  return "untested";
}

/** 容错解析 probe 响应;缺字段给安全缺省,布尔如实,不伪精确 */
export function parseSetupProbe(raw: unknown): SetupProbe {
  const r = asRecord(raw);
  const configRaw = asRecord(r["config"]);
  const slotsRaw = asRecord(configRaw["slots"]);
  const slots: Partial<Record<ProbeSlot, ProbeSlotState>> = {};
  for (const k of PROBE_SLOTS) {
    const state = parseSlotState(slotsRaw[k]);
    if (state !== undefined) slots[k] = state;
  }
  const secretsRaw = asRecord(r["secrets"]);
  const secrets: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(secretsRaw)) {
    // 只认布尔 true;false/缺/非布尔一律 false(禁把未知渲染成已配)
    secrets[k] = asBool(v);
  }
  const acksRaw = asRecord(r["acks"]);
  const clisRaw = Array.isArray(r["clis"]) ? r["clis"] : [];
  const clis: ProbeCli[] = [];
  for (const c of clisRaw) {
    const o = asRecord(c);
    const name = asString(o["name"]);
    if (!name) continue;
    const cli: ProbeCli = { name, found: asBool(o["found"]) };
    const version = asString(o["version"]);
    const path = asString(o["path"]);
    if (version) cli.version = version;
    if (path) cli.path = path;
    clis.push(cli);
  }
  const voiceRaw = asRecord(r["voice"]);
  const pendingEnvRaw = asRecord(r["pendingEnv"]);
  const recoveryRaw = asRecord(r["recovery"]);
  return {
    config: {
      present: asBool(configRaw["present"]),
      slots
    },
    secrets,
    acks: {
      evaluator_isolation: asBool(acksRaw["evaluator_isolation"]),
      evaluator_same_family: asBool(acksRaw["evaluator_same_family"])
    },
    hints: parseViolations(r["hints"]),
    clis,
    voice: {
      ...(typeof voiceRaw["pipelinePeer"] === "boolean" ? { pipelinePeer: voiceRaw["pipelinePeer"] } : {}),
      asr: asString(voiceRaw["asr"]) ?? "unknown",
      tts: asString(voiceRaw["tts"]) ?? "unknown",
      ...(asString(voiceRaw["note"]) ? { note: asString(voiceRaw["note"]) as string } : {})
    },
    pendingConfig: parsePendingConfig(r["pendingConfig"]),
    pendingEnv: asBool(pendingEnvRaw["present"]) ? { present: true } : null,
    recovery: {
      active: asBool(recoveryRaw["active"]),
      mode: recoveryRaw["mode"] === "recovery_only" ? "recovery_only" : "normal",
      violations: parseViolations(recoveryRaw["violations"])
    }
  };
}

export function parseSetupTestResult(raw: unknown): SetupTestResult {
  const r = asRecord(raw);
  // daemon 真实形状={ok,configSource,envSource,slots:{...}};历史快照曾是扁平槽 map。
  const nestedSlots = asRecord(r["slots"]);
  const source = Object.keys(nestedSlots).length > 0 ? nestedSlots : r;
  const out: SetupTestResult = {};
  for (const [k, v] of Object.entries(source)) {
    if (k === "ok" || k === "configSource" || k === "envSource" || k === "slots") continue;
    const o = asRecord(v);
    // 兼容 {status} 与 {ok:boolean}
    const status =
      o["status"] !== undefined
        ? parseTestStatus(o["status"])
        : o["ok"] !== undefined
          ? parseTestStatus(o["ok"])
          : parseTestStatus(v);
    const slot: SetupTestSlot = { status };
    if (typeof o["latencyMs"] === "number") slot.latencyMs = o["latencyMs"];
    const err = asString(o["error"]);
    if (err) slot.error = err;
    const detail = asString(o["detail"]);
    if (detail) slot.detail = detail;
    const requestedModel = asString(o["requestedModel"]);
    if (requestedModel) slot.requestedModel = requestedModel;
    const observedModel = asString(o["observedModel"]);
    if (observedModel) slot.observedModel = observedModel;
    out[k] = slot;
  }
  return out;
}

export function parseHealth(raw: unknown): HealthSnapshot {
  const r = asRecord(raw);
  const pid = typeof r["pid"] === "number" ? r["pid"] : undefined;
  return {
    ok: r["ok"] === true,
    pid,
    startedAt: asString(r["startedAt"]) ?? asString(r["started_at"])
  };
}

export const DIALOG_CLI_UNSUPPORTED_MESSAGE =
  "对话可用 CLI 慢速模式:每轮约 15-25 秒,支持记点和提议;配 API key 可切到秒级实时模式";

export function isDialogCliProvider(provider: string | undefined): boolean {
  return provider !== undefined && isWiredCliProvider(provider);
}

export function isDialogCliUnsupported(probe: SetupProbe | null): boolean {
  const dialog = probe?.config.slots.dialog;
  return isDialogCliProvider(dialog?.provider) && dialog?.effective !== "active";
}

/** dialog 槽是否已就绪:API realtime 与通过 self-test 的 CLI oneshot 都可用。 */
export function isDialogSlotOk(probe: SetupProbe | null): boolean {
  if (!probe) return true; // 探测失败不挡页(连接错误另有 ErrorCard)
  const dialog = probe.config.slots.dialog;
  if (dialog?.effective !== "active") return false;
  return dialog.provider === "api" || (isDialogCliProvider(dialog.provider) && dialog.mode === "oneshot");
}

/** SetupContext.dialogReady 同口径:probe 必须在场且 dialog 槽已武装,失败/空快照不得 fail-open。 */
export function isDialogReadyFromProbe(probe: SetupProbe | null): boolean {
  return probe !== null && isDialogSlotOk(probe);
}

/** 是否应展示配置向导入口(dialog 非 ok,或主动重配) */
export function needsSetupWizard(probe: SetupProbe | null): boolean {
  if (!probe) return false;
  return !isDialogSlotOk(probe);
}

/** probe 槽状态 → 人话(已配/缺 key/未配);未知如实「未知」 */
export function slotHealthLabel(h: SlotHealth | undefined, unavailable = false): string {
  if (unavailable) return "已配置·但暂不可用";
  if (h === "ok") return "已配";
  if (h === "configured") return "已配置,待自检";
  if (h === "key_missing") return "缺 key";
  if (h === "missing") return "未配";
  return "未知";
}

export function slotEffectiveLabel(slot: ProbeSlot, state: ProbeSlotState | undefined): string {
  if (!state) return "实际状态未知";
  if (state.effective === "active") return "实际生效";
  if (state.effective === "fallback_dialog") {
    return slot === "cheap" ? "实际走对话档模型计费" : "实际回落对话档";
  }
  if (state.reason === "cli_self_test_required") return "已配置,等待 CLI 自检";
  if (state.reason === "cli_self_test_failed") return "CLI 自检失败,当前未武装";
  if (state.reason === "same_family_blocked") return "同族未确认,深评未武装";
  if (state.reason === "isolation_ack_required") return "隔离边界未确认,深评未武装";
  if (state.reason === "recovery_only") return "配置自救模式中,当前未武装";
  return "当前未武装";
}

export type FirstRunQueryResult = {
  state: "presented" | "legacy_not_eligible" | "skipped_by_user";
  delivered: boolean;
  message?: string;
  turnId?: string;
};

const firstRunQueries = new Map<string, Promise<FirstRunQueryResult>>();

async function requestFirstRunQuery(sessionId: string): Promise<FirstRunQueryResult> {
  const { res, body: raw } = await setupFetch("/api/setup/first-run/query", {
    method: "POST",
    headers: { "content-type": "application/json", "x-saydo-token": capToken() },
    body: JSON.stringify({ sessionId })
  });
  if (!res.ok || raw["ok"] === false) throw new Error(asString(raw["message"]) ?? `${res.status} first-run query`);
  const state = raw["state"];
  if (state !== "presented" && state !== "legacy_not_eligible" && state !== "skipped_by_user") {
    throw new Error("first-run query 返回未知状态");
  }
  return {
    state,
    delivered: asBool(raw["delivered"]),
    ...(asString(raw["message"]) ? { message: asString(raw["message"]) as string } : {}),
    ...(asString(raw["turnId"]) ? { turnId: asString(raw["turnId"]) as string } : {})
  };
}

/** React StrictMode 会重放 effect；同一 session 的并发探询共享一次消费 marker 的请求。 */
export function postFirstRunQuery(sessionId: string): Promise<FirstRunQueryResult> {
  const existing = firstRunQueries.get(sessionId);
  if (existing) return existing;
  const shared = requestFirstRunQuery(sessionId);
  const clear = () => {
    setTimeout(() => {
      if (firstRunQueries.get(sessionId) === shared) firstRunQueries.delete(sessionId);
    }, 0);
  };
  void shared.then(clear, clear);
  firstRunQueries.set(sessionId, shared);
  return shared;
}

/** probe 短名 → 设置页展示槽名 */
export const PROBE_TO_DISPLAY_SLOT: Record<ProbeSlot, string> = {
  dialog: "dialog",
  thinking: "thinking",
  cheap: "cheap",
  evaluator: "evaluator",
  dev: "dev"
};

export const DISPLAY_TO_PROBE_SLOT: Record<string, ProbeSlot> = {
  dialog: "dialog",
  thinking: "thinking",
  cheap: "cheap",
  evaluator: "evaluator",
  dev: "dev"
};

export const SETUP_SLOT_LABEL: Record<ProbeSlot, string> = {
  dialog: "对话",
  thinking: "沉思",
  cheap: "廉价",
  evaluator: "评估",
  dev: "开发"
};

/** 自检三态人话/色 token 名 */
export function testStatusLabel(s: TestSlotStatus): string {
  if (s === "ok") return "通过";
  if (s === "fail") return "失败";
  return "未测";
}

export function testStatusColor(s: TestSlotStatus): string {
  if (s === "ok") return "var(--color-success)";
  if (s === "fail") return "var(--color-error)";
  return "var(--text-muted)";
}

/** 自检结果表说明列:通过行 requested≠observed 显示降级;失败走人话 error。 */
export function setupTestSlotNote(slot: SetupTestSlot): string {
  if (slot.status === "fail") return slot.error ?? "调用失败";
  if (slot.status === "untested") return "未跑测";
  if (slot.requestedModel && slot.observedModel && slot.requestedModel !== slot.observedModel) {
    return `实际 ${slot.observedModel}(${slot.requestedModel} 被 CLI 降级)`;
  }
  return slot.detail ?? "—";
}

// ---- API ----

export async function fetchSetupProbe(): Promise<SetupProbe> {
  // 晋升重启后若沿用首载 GET 缓存,会把启动前的未就绪快照写回 context,向导出不去。
  const raw = await apiGet<unknown>(`/api/setup/probe?_=${Date.now()}`);
  return parseSetupProbe(raw);
}

export async function postSetupConfig(body: SetupConfigBody): Promise<SetupWriteResult> {
  // 自管 fetch:保留 422 的 violations(apiPost 的 ApiError 只带 code,不带逐条规则)
  const { res, body: r } = await setupFetch("/api/setup/config", {
    method: "POST",
    headers: { "content-type": "application/json", "x-saydo-token": capToken() },
    body: JSON.stringify(body ?? {})
  });
  if (!res.ok || r["ok"] === false) {
    throw new SetupApiError(asString(r["message"]) ?? `${res.status} /api/setup/config`, {
      code: asString(r["code"]),
      status: res.status,
      violations: parseViolations(r["violations"])
    });
  }
  return {
    ok: r["ok"] !== false,
    restart_required: r["restart_required"] === true
  };
}

export async function postSetupSecret(name: string, value: string): Promise<SetupWriteResult> {
  const { res, body: r } = await setupFetch("/api/setup/secret", {
    method: "POST",
    headers: { "content-type": "application/json", "x-saydo-token": capToken() },
    body: JSON.stringify({ name, value })
  });
  if (!res.ok || r["ok"] === false) {
    throw new SetupApiError(asString(r["message"]) ?? `${res.status} /api/setup/secret`, {
      code: asString(r["code"]),
      status: res.status
    });
  }
  return {
    ok: r["ok"] !== false,
    restart_required: r["restart_required"] === true,
    name: asString(r["name"]) ?? name
  };
}

export type InvalidProjectOverrideIssue = {
  projectId: string;
  violations: SetupViolation[];
  affectedKeys: string[];
};

export type InvalidProjectOverrideListing = {
  receipt: string;
  expiresAt: string;
  deleteWholeOverride: true;
  issues: InvalidProjectOverrideIssue[];
};

/** recovery-only 先列出失效项目，不回传原始 overrides_json。 */
export async function getInvalidProjectOverrides(): Promise<InvalidProjectOverrideListing> {
  const { res, body: record } = await setupFetch("/api/setup/project-overrides/invalid", {
    headers: { "x-saydo-token": capToken() }
  });
  if (!res.ok || record["ok"] === false) {
    throw new SetupApiError(asString(record["message"]) ?? `${res.status} list invalid project overrides`, {
      code: asString(record["code"]),
      status: res.status
    });
  }
  const receipt = asString(record["receipt"]);
  const expiresAt = asString(record["expiresAt"]);
  if (!receipt || !expiresAt || record["deleteWholeOverride"] !== true || !Array.isArray(record["issues"])) {
    throw new SetupApiError("非法覆盖列表响应缺少删除确认凭据", { code: "invalid_override_listing" });
  }
  const issues = record["issues"].flatMap((item) => {
    const issue = asRecord(item);
    const projectId = asString(issue["projectId"]);
    const affectedKeys = Array.isArray(issue["affectedKeys"])
      ? issue["affectedKeys"].filter((value): value is string => typeof value === "string")
      : [];
    return projectId ? [{ projectId, violations: parseViolations(issue["violations"]), affectedKeys }] : [];
  });
  return { receipt, expiresAt, deleteWholeOverride: true, issues };
}

/** recovery-only 显式自救：只清除用户点名且 daemon 复核后仍非法的项目模型覆盖。 */
export async function postClearInvalidProjectOverrides(receipt: string, projectIds: readonly string[]): Promise<string[]> {
  const { res, body: record } = await setupFetch("/api/setup/project-overrides/clear-invalid", {
    method: "POST",
    headers: { "content-type": "application/json", "x-saydo-token": capToken() },
    body: JSON.stringify({ receipt, projectIds, deleteWholeOverride: true })
  });
  if (!res.ok || record["ok"] === false) {
    throw new SetupApiError(asString(record["message"]) ?? `${res.status} clear invalid project overrides`, {
      code: asString(record["code"]),
      status: res.status
    });
  }
  return Array.isArray(record["cleared"])
    ? record["cleared"].filter((value): value is string => typeof value === "string")
    : [];
}

export async function postSetupTest(body: { scope?: "plan" | "voice" } = {}): Promise<SetupTestResult> {
  // apiPost 要求 ok!==false;test 结果是槽位 map,可能无顶层 ok——走自管 fetch
  const { res, body: payload } = await setupFetch("/api/setup/test", {
    method: "POST",
    headers: { "content-type": "application/json", "x-saydo-token": capToken() },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const msg = asString(payload["message"]) ?? `${res.status} /api/setup/test`;
    throw new Error(msg);
  }
  return parseSetupTestResult(payload);
}

/** POST restart → 202;不要求 JSON ok */
export async function postSetupRestart(): Promise<void> {
  const { res, body: payload } = await setupFetch("/api/setup/restart", {
    method: "POST",
    headers: { "content-type": "application/json", "x-saydo-token": capToken() },
    body: "{}"
  });
  // 202 成功;200 也接受;其余抛
  if (res.status !== 202 && !res.ok) {
    const msg = asString(payload["message"]) ?? `${res.status} /api/setup/restart`;
    throw new Error(msg);
  }
}

export async function fetchHealth(): Promise<HealthSnapshot> {
  // 重启窗口内本就会连不上/正在启动,交给统一分类:waitForRestart 照常吞掉继续轮询,
  // 但超时后报出来的那句话是人话而不是 "TypeError: Failed to fetch"
  const { res, body } = await setupFetch("/health", { headers: { "x-saydo-token": capToken() } });
  if (!res.ok) throw new Error(`${res.status} /health`);
  return parseHealth(body);
}

/**
 * 重启后轮询 /health:观测到 pid 变化且 ok = 完成。
 * 超时 30s 抛人话错误。
 */
export async function waitForRestart(
  previousPid: number | undefined,
  opts?: { timeoutMs?: number; intervalMs?: number; now?: () => number; sleep?: (ms: number) => Promise<void> }
): Promise<HealthSnapshot> {
  const timeoutMs = opts?.timeoutMs ?? 30_000;
  const intervalMs = opts?.intervalMs ?? 500;
  const now = opts?.now ?? Date.now;
  const sleep = opts?.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const deadline = now() + timeoutMs;
  let lastErr: string | null = null;
  while (now() < deadline) {
    try {
      const h = await fetchHealth();
      if (h.ok && previousPid !== undefined && h.pid !== undefined && h.pid !== previousPid) {
        return h;
      }
      // 无旧 pid 时:只要 ok 且有 pid 就算起来(冷启动/首次)
      if (h.ok && previousPid === undefined && h.pid !== undefined) {
        return h;
      }
      // pid 尚未变:继续等
      lastErr = h.ok
        ? `仍在旧进程(pid=${h.pid ?? "未知"})`
        : "健康检查未就绪";
    } catch (e) {
      // 重启窗口内 health 不可达是常态
      lastErr = e instanceof Error ? e.message : String(e);
    }
    await sleep(intervalMs);
  }
  throw new Error(
    `重启超时(30 秒内没等到新进程)。${lastErr ? `最后状态:${lastErr}。` : ""}可点重试,或到终端确认 daemon 是否起来。`
  );
}

/**
 * 向导步 1 保存:同次写 providers.api.<via> + models.dialog(原子),再写 secret。
 * via 与 key env 名由 baseURL 推导;api_key 只写 env 引用,真值走 secret。
 */
export async function saveDialogApiConfig(input: {
  baseURL: string;
  apiKey: string;
  model: string;
}): Promise<{ restartRequired: boolean; via: string }> {
  const via = deriveProviderViaName(input.baseURL);
  const envName = apiKeyEnvForBaseUrl(input.baseURL);
  const configRes = await postSetupConfig({
    providers: {
      api: {
        [via]: {
          base_url: input.baseURL,
          api_key: `env:${envName}`
        }
      }
    },
    models: {
      dialog: {
        provider: "api",
        via,
        model: input.model
      }
    }
  });
  const secretRes = await postSetupSecret(envName, input.apiKey);
  return {
    restartRequired: configRes.restart_required || secretRes.restart_required || true,
    via
  };
}

// ---- CLI 能力(登录态 + 可枚举模型;daemon /api/setup/cli-capability) ----

/** 与 daemon CLI_CATALOG 对齐:含仅识别、尚未接线供给的主流 agent */
export type CliName =
  | "cursor-agent"
  | "codex"
  | "claude"
  | "grok"
  | "kimi"
  | "opencode"
  | "pi"
  | "gemini"
  | "aider"
  | "qwen"
  | "copilot"
  | "vibe";
/** 已接线的 ModelBinding provider;inventory_only 的 CLI provider 为 null */
export type CliProvider = WiredCliProvider;
export type CliAuthStatus = "logged_in" | "not_logged_in" | "not_found" | "unknown";
export type CliCostProvenance = CostProvenance;

/** 与 daemon CLI_CATALOG 对齐:已接线 CLI 名 → provider */
export const CLI_NAME_TO_PROVIDER: Partial<Record<CliName, CliProvider>> = {
  "cursor-agent": "cursor_cli",
  codex: "codex_cli",
  claude: "claude_cli",
  grok: "grok_cli",
  gemini: "gemini_cli",
  qwen: "qwen_cli",
  copilot: "copilot_cli"
};

export type DefaultSlotModels = {
  dialog: string;
  thinking: string;
  cheap: string;
  evaluator: string;
};

export type CliProviderContract = {
  /** docs/09:cursor 必填;其余可省 */
  modelRequired: boolean;
  /** 确认卡/供给器是否给手改入口(传输型 CLI family 来自 model 名) */
  modelEditable: boolean;
  /** 候选模型里丢掉 auto(cursor 的 auto 不能当一键卡模型) */
  skipAutoCandidate: boolean;
  defaultModelLabel: string;
  /**
   * 选中该家时四槽预置初值(单源)。空串=无分档,回退探测单值。
   * 匹配规则在 resourcePlans.resolvePresetModelId:探测能对上则用探测 id。
   */
  defaultSlotModels: DefaultSlotModels;
};

/** SetupWizard/SupplyPicker 的 model 可编辑性、标签、必填、槽位预置单源,禁止再按旧 provider 名单硬编码 */
export const CLI_PROVIDER_CONTRACT: Record<CliProvider, CliProviderContract> = {
  cursor_cli: {
    modelRequired: true,
    modelEditable: true,
    skipAutoCandidate: true,
    defaultModelLabel: "Cursor CLI 模型",
    defaultSlotModels: {
      dialog: "cursor-grok-4.6-high-fast",
      thinking: "cursor-grok-4.6-high-fast",
      cheap: "composer-2.5-fast",
      evaluator: "cursor-grok-4.6-high-fast"
    }
  },
  codex_cli: {
    modelRequired: false,
    modelEditable: true,
    skipAutoCandidate: false,
    defaultModelLabel: "Codex CLI 默认模型",
    defaultSlotModels: {
      dialog: "gpt-5.6-sol",
      thinking: "gpt-5.6-sol",
      cheap: "gpt-5.6-luna",
      evaluator: "gpt-5.6-sol"
    }
  },
  claude_cli: {
    modelRequired: false,
    modelEditable: true,
    skipAutoCandidate: false,
    defaultModelLabel: "Claude CLI 默认模型",
    // 预置用 --help 实证全名;探测 alias/used 能对上(如 claude-fable-5)则取探测真名
    defaultSlotModels: {
      dialog: "claude-fable-5",
      thinking: "claude-fable-5",
      cheap: "claude-opus-5",
      evaluator: "claude-fable-5"
    }
  },
  grok_cli: {
    modelRequired: false,
    modelEditable: true,
    skipAutoCandidate: false,
    defaultModelLabel: "Grok CLI 默认模型",
    defaultSlotModels: {
      dialog: "grok-4.6",
      thinking: "grok-4.6",
      cheap: "grok-4.6",
      evaluator: "grok-4.6"
    }
  },
  gemini_cli: {
    modelRequired: false,
    modelEditable: true,
    skipAutoCandidate: false,
    defaultModelLabel: "Gemini CLI 默认模型",
    defaultSlotModels: {
      dialog: "gemini-3.2-pro",
      thinking: "gemini-3.2-pro",
      cheap: "gemini-3.2-flash",
      evaluator: "gemini-3.2-pro"
    }
  },
  qwen_cli: {
    modelRequired: false,
    modelEditable: true,
    skipAutoCandidate: false,
    defaultModelLabel: "Qwen CLI 默认模型",
    defaultSlotModels: { dialog: "", thinking: "", cheap: "", evaluator: "" }
  },
  copilot_cli: {
    modelRequired: false,
    modelEditable: true,
    skipAutoCandidate: false,
    defaultModelLabel: "Copilot CLI 默认模型",
    // help 只实证 --model gpt-5.2,无廉价分档 → 单值
    defaultSlotModels: {
      dialog: "gpt-5.2",
      thinking: "gpt-5.2",
      cheap: "gpt-5.2",
      evaluator: "gpt-5.2"
    }
  }
};

export function cliModelRequired(provider: CliProvider): boolean {
  return CLI_PROVIDER_CONTRACT[provider].modelRequired;
}

export function cliModelEditable(provider: CliProvider): boolean {
  return CLI_PROVIDER_CONTRACT[provider].modelEditable;
}

export function cliDefaultModelLabel(provider: CliProvider): string {
  return CLI_PROVIDER_CONTRACT[provider].defaultModelLabel;
}

/** 模型名来源:listed=CLI 列的全集 / used=本机记录里你用过的 / configured=CLI 当前配置 / alias=官方别名 */
export type ModelSource = "listed" | "used" | "configured" | "alias";

export type CliModelOption = { id: string; label?: string; source: ModelSource; seen?: number };

/** 来源 → 角标人话;listed 不加角标(那是常规全集项,加了全是噪声) */
export function modelSourceLabel(m: CliModelOption): string | null {
  if (m.source === "used") return m.seen && m.seen > 1 ? `用过 ${m.seen} 次` : "用过";
  if (m.source === "configured") return "当前配置";
  if (m.source === "alias") return "官方别名";
  return null;
}

/** daemon 固定探测目录(与 cliCapability CLI_CATALOG 对齐) */
export const PROBE_CLI_NAMES: CliName[] = [
  "cursor-agent",
  "codex",
  "claude",
  "grok",
  "kimi",
  "opencode",
  "pi",
  "gemini",
  "aider",
  "qwen",
  "copilot",
  "vibe"
];
/** 已接线、可选进推理槽的 CLI;加载占位只渲染这些,避免把"仅识别"误当成能配 */
export const WIRED_CLI_NAMES: CliName[] = (Object.keys(CLI_NAME_TO_PROVIDER) as CliName[]).filter(
  (name) => CLI_NAME_TO_PROVIDER[name] !== undefined
);

export const CLI_LABEL: Record<CliName, string> = {
  "cursor-agent": "Cursor",
  codex: "Codex",
  claude: "Claude",
  grok: "Grok",
  kimi: "Kimi",
  opencode: "OpenCode",
  pi: "Pi",
  gemini: "Gemini",
  aider: "Aider",
  qwen: "Qwen",
  copilot: "Copilot",
  vibe: "Vibe"
};

export function isCliName(value: string): value is CliName {
  return (PROBE_CLI_NAMES as string[]).includes(value);
}

/** 未登录或登录态未知:给显式重探入口,不轮询。 */
export function cliAuthNeedsReprobe(status: CliAuthStatus): boolean {
  return status === "not_logged_in" || status === "unknown";
}

/** 整区重新检测的 names:已探测列表优先(保序去重);空则走目录全量。 */
export function namesForFullReprobe(clis: readonly { name: CliName }[]): CliName[] {
  const seen = new Set<CliName>();
  const names: CliName[] = [];
  for (const cli of clis) {
    if (!seen.has(cli.name)) {
      seen.add(cli.name);
      names.push(cli.name);
    }
  }
  return names.length > 0 ? names : [...PROBE_CLI_NAMES];
}

/** 可作为推理槽 CLI 供给(已接线 + daemon 回了 provider) */
export function cliWiredForSupply(c: Pick<CliCapability, "provider">): boolean {
  return c.provider !== null && isWiredCliProvider(c.provider);
}

export interface CliProbeFailureCopy {
  message: string;
  hint?: string;
  /** 是否顺势建议"直接用 API 直连" */
  suggestApi: boolean;
}

/**
 * CLI 探测失败的文案分流。
 *
 * 2026-08-12 实测教训:向导对任何失败都说"CLI 检测失败(Failed to fetch)——可以直接用 API
 * 直连配置",而当时失败的真实原因是页面连不上 daemon(旧 vite 端口的僵尸页)。本机三家 CLI
 * 全部已登录、可零成本用,用户却被这句话引着去填 key 花钱。所以:**连不上/凭证失效/正在启动
 * 一律不是 CLI 的问题,此时不得建议 API 直连**——那不解决问题,只是把人推向更贵的路。
 */
export function cliProbeFailureCopy(err: unknown): CliProbeFailureCopy {
  if (err instanceof ApiError) {
    const notCliFault = err.kind === "network" || err.kind === "auth" || err.kind === "starting";
    return {
      message: err.message,
      hint: err.hint,
      suggestApi: !notCliFault
    };
  }
  return {
    message: err instanceof Error ? err.message : String(err),
    suggestApi: true
  };
}

export type CliCapability = {
  name: CliName;
  /** null = 仅识别,不可选进推理槽 */
  provider: CliProvider | null;
  label?: string;
  found: boolean;
  version?: string;
  path?: string;
  auth: { status: CliAuthStatus; detail?: string; fixHint?: string };
  enumerable: boolean;
  models: CliModelOption[];
  note?: string;
  /** 探测采集的计费来源;只有 subscription 才允许「订阅内零成本」 */
  billing?: { provenance: CliCostProvenance; detail?: string };
};

function parseBilling(raw: unknown): CliCapability["billing"] | undefined {
  const o = asRecord(raw);
  const provenance = asString(o["provenance"]);
  if (provenance !== "subscription" && provenance !== "external_api" && provenance !== "unknown") {
    return undefined;
  }
  const detail = asString(o["detail"]);
  return { provenance, ...(detail ? { detail } : {}) };
}

function parseCliCapability(raw: unknown): CliCapability | null {
  const o = asRecord(raw);
  const nameRaw = asString(o["name"]);
  if (!nameRaw || !isCliName(nameRaw)) return null;
  const name = nameRaw;
  const providerField = o["provider"];
  const providerRaw = asString(providerField);
  const resolvedProvider: CliProvider | null =
    providerField === null
      ? null
      : providerRaw && isWiredCliProvider(providerRaw)
        ? providerRaw
        : (CLI_NAME_TO_PROVIDER[name] ?? null);
  const authRaw = asRecord(o["auth"]);
  const st = asString(authRaw["status"]);
  const authStatus: CliAuthStatus =
    st === "logged_in" || st === "not_logged_in" || st === "not_found" ? st : "unknown";
  const models: CliModelOption[] = [];
  const modelsRaw = Array.isArray(o["models"]) ? o["models"] : [];
  for (const m of modelsRaw) {
    const mo = asRecord(m);
    const id = asString(mo["id"]);
    if (!id) continue;
    const label = asString(mo["label"]);
    const src = asString(mo["source"]);
    const source: ModelSource | undefined =
      src === "listed" || src === "used" || src === "configured" || src === "alias" ? src : undefined;
    if (!source) continue;
    const seen = typeof mo["seen"] === "number" ? mo["seen"] : undefined;
    models.push({
      id,
      ...(label ? { label } : {}),
      source,
      ...(seen !== undefined ? { seen } : {})
    });
  }
  const label = asString(o["label"]) ?? CLI_LABEL[name];
  const billing = parseBilling(o["billing"]);
  return {
    name,
    provider: resolvedProvider,
    label,
    found: asBool(o["found"]),
    ...(asString(o["version"]) ? { version: asString(o["version"]) as string } : {}),
    ...(asString(o["path"]) ? { path: asString(o["path"]) as string } : {}),
    auth: {
      status: authStatus,
      ...(asString(authRaw["detail"]) ? { detail: asString(authRaw["detail"]) as string } : {}),
      ...(asString(authRaw["fixHint"]) ? { fixHint: asString(authRaw["fixHint"]) as string } : {})
    },
    enumerable: asBool(o["enumerable"]),
    models,
    ...(asString(o["note"]) ? { note: asString(o["note"]) as string } : {}),
    ...(billing ? { billing } : {})
  };
}

export function parseCliCapabilities(raw: unknown): CliCapability[] {
  const r = asRecord(raw);
  const list = Array.isArray(r["clis"]) ? r["clis"] : [];
  const out: CliCapability[] = [];
  for (const c of list) {
    const parsed = parseCliCapability(c);
    if (parsed) out.push(parsed);
  }
  return out;
}

export async function fetchCliCapabilities(): Promise<CliCapability[]> {
  const raw = await apiGet<unknown>("/api/setup/cli-capability");
  return parseCliCapabilities(raw);
}

/** 轻量重探:绕缓存、单家 8s、不做模型真实调用。 */
export async function postReprobeCliCapabilities(names: CliName[]): Promise<CliCapability[]> {
  const { res, body } = await setupFetch("/api/setup/cli-capability/reprobe", {
    method: "POST",
    headers: { "content-type": "application/json", "x-saydo-token": capToken() },
    body: JSON.stringify({ names })
  });
  if (!res.ok || body["ok"] === false) {
    throw new SetupApiError(asString(body["message"]) ?? `${res.status} /api/setup/cli-capability/reprobe`, {
      code: asString(body["code"]),
      status: res.status
    });
  }
  return parseCliCapabilities(body);
}

/** 与 daemon ConfirmCliCapabilityResult 对齐(POST /api/setup/cli-capability/confirm) */
export type ConfirmCliCapabilityResult = {
  ok: boolean;
  name: CliName;
  auth: CliAuthStatus;
  confirmed: boolean;
  observedModel?: string;
  detail?: string;
  billing?: CliCapability["billing"];
};

export function parseConfirmCliCapability(raw: unknown): ConfirmCliCapabilityResult | null {
  const o = asRecord(raw);
  const nameRaw = asString(o["name"]);
  if (!nameRaw || !isCliName(nameRaw)) return null;
  const authRaw = asString(o["auth"]);
  const auth: CliAuthStatus =
    authRaw === "logged_in" || authRaw === "not_logged_in" || authRaw === "not_found" ? authRaw : "unknown";
  const billing = parseBilling(o["billing"]);
  return {
    ok: o["ok"] === true,
    name: nameRaw,
    auth,
    confirmed: o["confirmed"] === true,
    ...(asString(o["observedModel"]) ? { observedModel: asString(o["observedModel"]) as string } : {}),
    ...(asString(o["detail"]) ? { detail: asString(o["detail"]) as string } : {}),
    ...(billing ? { billing } : {})
  };
}

/** unknown 恢复路径:受控一发自检。400 仍是结构化结果,不当传输层错误抛。 */
export async function postConfirmCliCapability(name: CliName): Promise<ConfirmCliCapabilityResult> {
  const { res, body } = await setupFetch("/api/setup/cli-capability/confirm", {
    method: "POST",
    headers: { "content-type": "application/json", "x-saydo-token": capToken() },
    body: JSON.stringify({ name })
  });
  const parsed = parseConfirmCliCapability(body);
  if (!parsed) {
    throw new SetupApiError(asString(body["message"]) ?? `${res.status} /api/setup/cli-capability/confirm`, {
      code: asString(body["code"]),
      status: res.status
    });
  }
  return parsed;
}

/** 把 confirm 端点结果并回画像行(原位更新;随后可静默重拉补全模型列表) */
export function applyConfirmCliResult(cli: CliCapability, result: ConfirmCliCapabilityResult): CliCapability {
  const models = [...cli.models];
  if (result.observedModel && !models.some((model) => model.id === result.observedModel)) {
    models.push({ id: result.observedModel, source: "listed" });
  }
  return {
    ...cli,
    auth: {
      status: result.auth,
      ...(result.detail ? { detail: result.detail } : cli.auth.detail ? { detail: cli.auth.detail } : {}),
      ...(result.auth !== "logged_in" && cli.auth.fixHint ? { fixHint: cli.auth.fixHint } : {})
    },
    models,
    ...(result.billing ? { billing: result.billing } : cli.billing ? { billing: cli.billing } : {})
  };
}

/** CLI 可直接用于配置:必须已接线供给 + 登录只认 daemon 明确返回 logged_in */
export function cliUsable(c: CliCapability): boolean {
  return cliWiredForSupply(c) && c.found && c.auth.status === "logged_in";
}

export function cliAuthLabel(s: CliAuthStatus): string {
  if (s === "logged_in") return "已登录";
  if (s === "not_logged_in") return "未登录";
  if (s === "not_found") return "未安装";
  return "登录态未知";
}

// ---- 多槽位供给(T17 新配置只走 API;CLI 形状仅供存量读取/替换) ----

/** 向导可配的槽位(dev 槽形状不同,不在向导内) */
export type WizardSlot = "dialog" | "thinking" | "cheap" | "evaluator";
export type ApiKeyName = "OPENROUTER_API_KEY" | "OPENAI_API_KEY" | "ANTHROPIC_API_KEY" | "DEEPSEEK_API_KEY";

export const WIZARD_SLOTS: WizardSlot[] = ["dialog", "thinking", "cheap", "evaluator"];

export const WIZARD_SLOT_LABEL: Record<WizardSlot, string> = {
  dialog: "对话",
  thinking: "沉思",
  cheap: "廉价",
  evaluator: "评估"
};

export const MODEL_SLOT_DESCRIPTION = {
  dialog: "跟你聊天的",
  thinking: "复杂事后台深想",
  cheap: "大量小活省钱用",
  evaluator: "独立检查 AI 自己干的活",
  dev: "真写代码的执行器"
} as const;

export const WIZARD_SLOT_HINT: Record<WizardSlot, string> = {
  dialog: MODEL_SLOT_DESCRIPTION.dialog,
  thinking: MODEL_SLOT_DESCRIPTION.thinking,
  cheap: MODEL_SLOT_DESCRIPTION.cheap,
  evaluator: MODEL_SLOT_DESCRIPTION.evaluator
};

export type SlotSupply =
  | { kind: "cli"; provider: CliProvider; model?: string; /** 需知情确认的槽(dialog)已勾选 */ ack?: boolean }
  | {
      kind: "api";
      baseURL: string;
      apiKey: string;
      model: string;
      /** probe 或本轮写口只给存在性;仅允许与 baseURL 推导出的 env 名精确匹配时复用 */
      presentKeyNames?: ApiKeyName[];
      /** 本轮刚提交过 key 的原始端点;只允许完全相同端点在其他槽复用 */
      writtenKeyBaseURL?: string;
    }
  | { kind: "skip" };

/** 各槽位允许的供给形态。四个推理槽均已接通 CLI;dialog 是 oneshot 慢速形态。 */
export type SlotPolicy = {
  /** 该槽允许的 CLI provider;空数组=该槽不能用 CLI */
  allowedCli: CliProvider[];
  /** false=完全不展示 CLI 选项(dialog);true/default=可展示禁用画像。 */
  showCliOptions?: boolean;
  /** CLI 被禁时的原因(如实告知,不藏选项) */
  cliBlockedReason?: string;
  /** 兼容旧配置编辑器的 CLI 风险说明;当前策略不允许新选 CLI。 */
  cliWarning?: string;
  /** 兼容字段;当前策略无 CLI 确认旁路。 */
  cliAckRequiredFor?: CliProvider[];
  /** 兼容字段;当前策略不渲染 CLI 确认框。 */
  cliAckLabel?: string;
  /** 额外约束的人话提醒(不阻断,daemon 兜底) */
  caveat?: string;
};

const ALL_WIRED_CLI: CliProvider[] = [...WIRED_CLI_PROVIDERS];

export const SLOT_POLICY: Record<WizardSlot, SlotPolicy> = {
  dialog: {
    allowedCli: [...ALL_WIRED_CLI],
    caveat: DIALOG_CLI_UNSUPPORTED_MESSAGE
  },
  thinking: { allowedCli: [...ALL_WIRED_CLI] },
  cheap: { allowedCli: [...ALL_WIRED_CLI] },
  evaluator: {
    allowedCli: [...ALL_WIRED_CLI],
    cliWarning:
      "CLI 评估器能读取本机工作区,隔离边界弱于独立 API;而且和沉思槽同家族时会一起犯错。保存前需分别确认这两项代价。",
    cliAckRequiredFor: [...ALL_WIRED_CLI],
    cliAckLabel: "我知道 CLI 评估器的本机读取边界,仍要使用"
  },
};

/**
 * baseURL → 该端点 key 存哪个 env 名。
 * daemon SECRET_NAME_WHITELIST 只放行三个 API key 名,故按 host 归一;
 * 认不出的第三方端点统一借 OPENROUTER_API_KEY 槽(白名单外的名字 daemon 会 422)。
 */
export function apiKeyEnvForBaseUrl(baseURL: string): ApiKeyName {
  const via = deriveProviderViaName(baseURL);
  if (via === "openai") return "OPENAI_API_KEY";
  if (via === "anthropic") return "ANTHROPIC_API_KEY";
  return "OPENROUTER_API_KEY";
}

/** probe 既存 key 只允许复用于明确的官方 host;未知/第三方端点必须重新输入 key。 */
export function reusableApiKeyEnvForBaseUrl(baseURL: string): ApiKeyName | null {
  let url: URL;
  try {
    url = new URL(baseURL);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.port !== "") return null;
  const host = url.hostname.toLowerCase();
  if (host === "api.openai.com") return "OPENAI_API_KEY";
  if (host === "api.anthropic.com") return "ANTHROPIC_API_KEY";
  if (host === "openrouter.ai" || host === "api.openrouter.ai") return "OPENROUTER_API_KEY";
  return null;
}

/**
 * 一次提交多槽位:models 与 providers.api 同次写(原子),再逐个写 secret。
 * 存量 CLI 槽只作兼容序列化且不需要 key;新配置 API 槽的 key 按 baseURL 归一到白名单 env 名。
 */
/** API evaluator 同族可由 owner 知情确认的违规码。 */
export const ACKABLE_VIOLATION = { sameFamily: "evaluator_same_family" } as const;

export async function saveSlotSupplies(
  supplies: Partial<Record<WizardSlot, SlotSupply>>,
  opts?: { evaluatorIsolationAck?: boolean; evaluatorSameFamilyAck?: boolean }
): Promise<{ restartRequired: boolean; savedSlots: WizardSlot[] }> {
  const models: Record<string, unknown> = {};
  const apiProviders: Record<string, NamedApiProviderBody> = {};
  const secrets = new Map<string, string>();
  const savedSlots: WizardSlot[] = [];

  for (const slot of WIZARD_SLOTS) {
    const s = supplies[slot];
    if (!s || s.kind === "skip") continue;
    if (s.kind === "cli") {
      // model 可省(契约表 modelRequired=false);cursor_cli 必填,由提交前校验兜住
      models[slot] = s.model && s.model.trim() ? { provider: s.provider, model: s.model.trim() } : { provider: s.provider };
    } else {
      const via = deriveProviderViaName(s.baseURL);
      const envName = apiKeyEnvForBaseUrl(s.baseURL);
      apiProviders[via] = { base_url: s.baseURL.trim(), api_key: `env:${envName}` };
      models[slot] = { provider: "api", via, model: s.model.trim() };
      if (s.apiKey.trim()) secrets.set(envName, s.apiKey);
    }
    savedSlots.push(slot);
  }

  if (savedSlots.length === 0) return { restartRequired: false, savedSlots: [] };

  const evaluator = supplies.evaluator;
  if (opts?.evaluatorIsolationAck !== undefined) {
    models["evaluator_isolation_ack"] = opts.evaluatorIsolationAck;
  } else if (evaluator && evaluator.kind !== "skip") {
    // 用户这次明确改了 evaluator:API 同次清旧 isolation 字段;CLI 仅为存量序列化兼容。
    models["evaluator_isolation_ack"] =
      evaluator.kind === "cli" && evaluator.ack === true;
  }

  // same-family 无法在 console 可靠推断,由确认态显式写 true/false,daemon 全量校验裁决。
  if (opts?.evaluatorSameFamilyAck !== undefined) {
    models["evaluator_same_family_ack"] = opts.evaluatorSameFamilyAck;
  }

  const body: SetupConfigBody = {};
  (body as Record<string, unknown>)["models"] = models;
  if (Object.keys(apiProviders).length > 0) body.providers = { api: apiProviders };

  const configRes = await postSetupConfig(body);
  let restart = configRes.restart_required;
  for (const [name, value] of secrets) {
    const r = await postSetupSecret(name, value);
    restart = restart || r.restart_required;
  }
  return { restartRequired: restart || true, savedSlots };
}

/** 422 violations 必须 fail-visible:逐条展示人话与修复提示,不只露顶层 code。 */
export function setupErrorMessage(err: unknown): string {
  // 传输层失败(连不上/凭证/启动中)带上恢复指引——否则用户只看到"连不上",不知道下一步做什么
  if (err instanceof ApiError) {
    return err.hint ? `${err.message}\n${err.hint}` : err.message;
  }
  if (!(err instanceof SetupApiError) || err.violations.length === 0) {
    return err instanceof Error ? err.message : String(err);
  }
  const details = err.violations.map((v, index) => {
    const slot = v.slot ? `(${WIZARD_SLOT_LABEL[v.slot as WizardSlot] ?? v.slot}槽)` : "";
    const path = v.path ? `(${v.path})` : "";
    const message = v.message ?? v.code ?? "配置不符合要求";
    return `${index + 1}. ${slot}${path}${message}${v.fix ? `\n修复:${v.fix}` : ""}`;
  });
  return `${err.message}\n${details.join("\n")}`;
}

/** 向导步 2:写两项 VOLC secret(空值跳过对应项) */
export async function saveVoiceSecrets(input: {
  appId: string;
  accessToken: string;
}): Promise<{ restartRequired: boolean }> {
  let restart = false;
  if (input.appId.trim()) {
    const r = await postSetupSecret("VOLC_APP_ID", input.appId.trim());
    restart = restart || r.restart_required;
  }
  if (input.accessToken.trim()) {
    const r = await postSetupSecret("VOLC_ACCESS_TOKEN", input.accessToken.trim());
    restart = restart || r.restart_required;
  }
  return { restartRequired: restart || true };
}
