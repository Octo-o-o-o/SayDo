// first-run onboarding 四端点纯逻辑 + 写口(GET probe / POST config|secret|test 装配在 index)。
// 红线:密钥永不回显;tailnet 403 由装配层守;staged=pending 文件,活动文件不动。

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseToml, stringify as tomlStringify } from "smol-toml";
import { z } from "zod";
import { execRuntimeChild } from "../runtimeChildRegistry.js";
import { isWiredCliProvider, modelBindingSchema, namedApiProviderSchema, type ModelBinding } from "@saydo/contracts";
import { cliNameForProvider } from "../config/cliProviders.js";
import { resolveExecutable } from "../config/executable.js";
import {
  isSecretName,
  mergeEnvText,
  PROBE_SECRET_NAMES,
  readEnvMerged,
  SECRET_NAME_WHITELIST,
  secretPresent,
  type SecretName
} from "../config/envFile.js";
import {
  defaultConfigTemplate,
  isPlaceholderBinding
} from "../config/defaultTemplate.js";
import { loadConfigFile, parseConfigText } from "../config/load.js";
import { pendingPaths, writePendingFile } from "../config/pending.js";
import type { SaydoConfig } from "../config/types.js";
import { configSchema } from "../config/types.js";
import { evaluatorFamilyContext, validateConfig } from "../config/validate.js";
import type { Violation } from "../config/validate.js";
import { sanitizedConfigErrorSummary } from "../config/runtime.js";
import { familyFromModelName, sameFamilyCliDowngradeDisplay, type Family } from "../config/family.js";
import {
  CLI_CATALOG,
  isCliName,
  probeCliCapability,
  rememberProbedCliCapability,
  type CliAuthStatus,
  type CliCapability,
  type CliName
} from "../config/cliCapability.js";
import { createByoaProvider } from "../providers/byoa/provider.js";
import {
  clearCliSelfTest,
  loadCliRuntimeRegistry,
  loadPendingCliRuntimeRegistry,
  pendingCliRuntimeActivationMatches,
  preparePendingCliRuntimeActivation,
  registeredCliSlot,
  registerCliSelfTest,
  type CliRuntimeReceiptIndex,
  type CliRuntimeSlot
} from "../config/cliRuntime.js";
import type { AuditSink } from "../obs/audit.js";
import {
  resolveDialogProvider,
  resolveDrafterProvider,
  resolveEvaluatorProvider,
  resolveProviderProjection,
  resolveThinkingProvider,
  createCliSelfTestProvider,
  type CliResolverContext,
  type EffectiveProviderReason,
  type EffectiveProviderState,
  type ResolverLog
} from "../providers/slotResolvers.js";
import type { ChatRequest, ChatResult, LlmProvider } from "../providers/types.js";
import {
  defaultTier1Probes,
  runTier1SelfTest,
  type Tier1SelfTestProbes,
  type Tier1SelfTestReport
} from "../tier1/selfTest.js";
import { DRAFT_JSON_SCHEMA, draftPackageSchema } from "../brain/liveTools.js";
import {
  DIALOG_CLI_ONESHOT_JSON_SCHEMA,
  parseDialogCliOneshotEnvelope
} from "../brain/dialogLoop.js";
import { DEEP_OUTPUT_JSON_SCHEMA, deepOutputSchema } from "../evaluator/readiness.js";

export type { SecretName };

const execFileAsync = (
  file: string,
  args: string[],
  options: { timeout?: number; maxBuffer?: number; encoding?: string; signal?: AbortSignal } = {}
) => execRuntimeChild(file, args, {
  ...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
  ...(options.maxBuffer !== undefined ? { maxBuffer: options.maxBuffer } : {}),
  ...(options.signal ? { signal: options.signal } : {})
});

// ---------- 类型 ----------

export type SlotStatus = "ok" | "missing" | "key_missing" | "configured";
export type SlotName = "dialog" | "thinking" | "cheap" | "evaluator" | "dev";
export type CliProbeName = CliName;

export interface SetupProbeResult {
  config: {
    present: boolean;
    slots: Record<
      SlotName,
      {
        status: SlotStatus;
        provider?: string;
        model?: string;
        agent?: string;
        effective: EffectiveProviderState;
        mode?: "realtime" | "oneshot";
        reason?: EffectiveProviderReason;
        fallbackTo?: "dialog";
      }
    >;
  };
  secrets: Record<string, boolean>;
  acks: {
    evaluator_isolation: boolean;
    evaluator_same_family: boolean;
  };
  hints: Violation[];
  clis: Array<{
    name: CliProbeName;
    found: boolean;
    version?: string;
    path?: string;
    /** PATH 探测仅标 candidate,不判 ok */
    candidate: boolean;
  }>;
  voice: {
    pipelinePeer: boolean;
    asr: "ok" | "degraded" | "down";
    tts: "ok" | "degraded" | "down";
    note?: string;
  };
  pendingConfig: null | {
    present: boolean;
    status: "ready_to_promote" | "validation_failed";
    error?: string;
  };
  pendingEnv: null | { present: boolean };
  recovery: {
    active: boolean;
    mode: "normal" | "recovery_only";
    violations: Violation[];
  };
}

export type SlotTestStatus = "ok" | "fail" | "untested";
export interface SlotTestResult {
  status: SlotTestStatus;
  latencyMs?: number;
  error?: string;
  /** 人话 error 之外的技术细节(如 env 名),给 tooltip/详情,不进语音 */
  detail?: string;
  requestedModel?: string;
  observedModel?: string;
  observedModelSource?: "stream" | "verified_binary_default" | "unknown";
  observedModelExempted?: boolean;
}

export interface SetupTestResult {
  configSource: "pending" | "active" | "none";
  envSource: "pending" | "active" | "none";
  slots: Partial<Record<SlotName | "voice", SlotTestResult>>;
  /** scope=tier1 的执行器后端自检报告(W5.4-b C1;additive,其余 scope 不带) */
  tier1?: Tier1SelfTestReport;
}

export type WriteConfigResult =
  | { ok: true; restart_required: true }
  | { ok: false; status: 422 | 400; code: string; message: string; violations?: unknown };

// ---------- 配置写口白名单 ----------
// v5:providers.api.<name> 走 contracts namedApiProviderSchema(base_url + api_key=env:NAME);
// base_url 落点在 providers,不在 modelBinding。

const setupConfigBodySchema = z
  .strictObject({
    models: z
      .strictObject({
        profile: z.enum(["default", "dev"]).optional(),
        dialog: modelBindingSchema.optional(),
        thinking: modelBindingSchema.optional(),
        cheap: modelBindingSchema.optional(),
        evaluator: modelBindingSchema.optional(),
        // 异族知情豁免(09 §11 规则 5);向导勾选后随 models 一起写入配置
        evaluator_same_family_ack: z.boolean().optional(),
        // 评估档隔离性知情豁免(规则 4):接受 codex/cursor 当评估器,独立性不可证
        evaluator_isolation_ack: z.boolean().optional(),
        dev: z
          .strictObject({
            agent: z.enum(["claude_code", "cursor", "codex"]),
            model: z.string().min(1),
            transport: z.enum(["cli", "sdk"]).optional()
          })
          .optional()
      })
      .optional(),
    providers: z
      .strictObject({
        api: z.record(z.string().min(1), namedApiProviderSchema).optional()
      })
      .optional(),
    budget: z.record(z.string(), z.unknown()).optional(),
    dnd: z.record(z.string(), z.unknown()).optional()
  })
  .strict();

const MODEL_SLOTS_WITH_VIA = ["dialog", "thinking", "cheap", "evaluator"] as const;

/** 人话化 body 校验失败(含 api_key 非 env:NAME) */
function rejectSetupBody(issues: z.ZodIssue[]): WriteConfigResult {
  const apiKeyIssue = issues.find(
    (i) => i.path.includes("api_key") || /env:NAME|env reference/i.test(i.message)
  );
  if (apiKeyIssue) {
    const path = apiKeyIssue.path.join(".") || "providers.api.*.api_key";
    return {
      ok: false,
      status: 422,
      code: "setup_config_rejected",
      message: `api_key 只能写 env:NAME 引用(真值走 secret 端点),路径 ${path}`,
      violations: issues.map((i) => ({ path: i.path.join("."), message: i.message }))
    };
  }
  return {
    ok: false,
    status: 422,
    code: "setup_config_rejected",
    message: "body 仅允许 models(五槽)/providers/budget/dnd;非白名单键拒写",
    violations: issues.map((i) => ({
      path: i.path.join("."),
      message: i.message
    }))
  };
}

/** models 各槽 via 必须在 providers.api 有同名端点 */
function checkViaProviderRefs(cfg: SaydoConfig): WriteConfigResult | null {
  const named = cfg.providers?.api;
  for (const slot of MODEL_SLOTS_WITH_VIA) {
    const binding = cfg.models[slot];
    if (!binding || typeof binding === "string") continue;
    if (binding.provider !== "api" || !binding.via) continue;
    if (!named?.[binding.via]) {
      return {
        ok: false,
        status: 422,
        code: "via_provider_missing",
        message: `模型槽 ${slot} 的 via="${binding.via}" 在 providers.api 中没有对应端点,请先配置 providers.api.${binding.via}`
      };
    }
  }
  return null;
}

// ---------- binding / key ----------

function bindingProvider(b: ModelBinding): string {
  return typeof b === "string" ? "api" : b.provider;
}

function bindingModel(b: ModelBinding): string | undefined {
  if (typeof b === "string") return b;
  if ("model" in b && typeof b.model === "string") return b.model;
  return undefined;
}

/** api 槽所需 env 名(官方 OPENAI;via 命名端点从 providers 解 env:NAME) */
export function requiredApiKeyEnv(
  binding: ModelBinding,
  providers: SaydoConfig["providers"]
): string | null {
  if (typeof binding === "string") return "OPENAI_API_KEY";
  if (binding.provider !== "api") return null;
  if (binding.via) {
    const ep = providers?.api?.[binding.via];
    if (!ep) return null;
    return ep.api_key.startsWith("env:") ? ep.api_key.slice(4) : null;
  }
  return "OPENAI_API_KEY";
}

function classifySlot(
  binding: ModelBinding | undefined,
  providers: SaydoConfig["providers"],
  env: Record<string, string | undefined>
): { status: SlotStatus; provider?: string; model?: string; agent?: string } {
  if (binding === undefined) return { status: "missing" };
  // 首启模板占位:一律 missing(禁把占位当已配;v6)
  if (isPlaceholderBinding(binding as ModelBinding)) {
    if (typeof binding !== "string" && binding !== null && typeof binding === "object" && "agent" in binding) {
      const dev = binding as { agent: string; model: string };
      return { status: "missing", provider: "dev_agent", model: dev.model, agent: dev.agent };
    }
    const mb = binding as ModelBinding;
    const out: { status: SlotStatus; provider: string; model?: string } = {
      status: "missing",
      provider: bindingProvider(mb)
    };
    const model = bindingModel(mb);
    if (model !== undefined) out.model = model;
    return out;
  }
  if (typeof binding !== "string" && binding !== null && typeof binding === "object" && "agent" in binding) {
    const dev = binding as { agent: string; model: string };
    return { status: "configured", provider: "dev_agent", model: dev.model, agent: dev.agent };
  }
  const mb = binding as ModelBinding;
  const provider = bindingProvider(mb);
  const model = bindingModel(mb);
  const base: { status: SlotStatus; provider: string; model?: string } = { status: "configured", provider };
  if (model !== undefined) base.model = model;
  if (provider === "api") {
    const keyEnv = requiredApiKeyEnv(mb, providers);
    if (!keyEnv || !secretPresent(env, keyEnv)) {
      return { ...base, status: "key_missing" };
    }
    return { ...base, status: "ok" };
  }
  // CLI 槽:配置在即 configured;ok 只来自 setup/test
  return base;
}

// ---------- CLI PATH 探测 ----------

const CLI_BINS: Array<{ name: CliProbeName; bins: readonly string[]; versionSignature?: RegExp }> =
  CLI_CATALOG.map((e) => ({
    name: e.name,
    bins: e.bins,
    ...(e.versionSignature ? { versionSignature: e.versionSignature } : {})
  }));

export async function probeCliOnce(
  bin: string,
  timeoutMs = 3000,
  signal?: AbortSignal
): Promise<{ found: boolean; version?: string; path?: string }> {
  try {
    const path = await resolveExecutable(bin);
    if (!path) return { found: false };
    try {
      const ver = await execFileAsync(path, ["--version"], {
        timeout: timeoutMs,
        encoding: "utf8",
        maxBuffer: 64 * 1024,
        ...(signal ? { signal } : {})
      });
      const version = (ver.stdout || ver.stderr).trim().split("\n")[0]?.slice(0, 120);
      return { found: true, path, ...(version ? { version } : {}) };
    } catch {
      return { found: true, path };
    }
  } catch {
    return { found: false };
  }
}

/** 按目录 bins 顺序探测;带 versionSignature 时做消歧,避免短名误命中。 */
export async function probeCliEntry(
  entry: { name: CliProbeName; bins: readonly string[]; versionSignature?: RegExp },
  probeFn: (bin: string) => Promise<{ found: boolean; version?: string; path?: string }>,
  identityFn?: (path: string) => Promise<string>
): Promise<{ found: boolean; version?: string; path?: string }> {
  for (const bin of entry.bins) {
    const r = await probeFn(bin);
    if (!r.found || !r.path) continue;
    if (entry.versionSignature) {
      if (entry.versionSignature.test(r.version ?? "")) return r;
      const identity = identityFn
        ? await identityFn(r.path)
        : `${r.version ?? ""}\n${await collectCliIdentity(r.path)}`;
      if (!entry.versionSignature.test(identity)) continue;
    }
    return r;
  }
  return { found: false };
}

async function collectCliIdentity(path: string): Promise<string> {
  const chunks = await Promise.all(
    ([["--version"], ["--help"]] as const).map(async (args) => {
      try {
        const r = await execFileAsync(path, [...args], { timeout: 3000, encoding: "utf8", maxBuffer: 64 * 1024 });
        return `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
      } catch (err) {
        const e = err as { stdout?: string; stderr?: string; message?: string };
        return `${e.stdout ?? ""}\n${e.stderr ?? ""}\n${e.message ?? ""}`;
      }
    })
  );
  return chunks.join("\n");
}

// ---------- probe ----------

export interface ProbeInput {
  saydoHome: string;
  voice: {
    pipelinePeer: boolean;
    asr: "ok" | "degraded" | "down";
    tts: "ok" | "degraded" | "down";
  };
  processEnv?: Record<string, string | undefined>;
  /** composition root 注入的额外活动配置违规(如存量 project override 与新全局模型冲突)。 */
  recoveryViolations?: Violation[];
  skipCliProbe?: boolean;
  cliProbeFn?: (bin: string) => Promise<{ found: boolean; version?: string; path?: string }>;
  cliRuntimeReceipts?: CliRuntimeReceiptIndex;
  signal?: AbortSignal;
}

export async function buildSetupProbe(input: ProbeInput): Promise<SetupProbeResult> {
  const { saydoHome } = input;
  const activeEnvMerged = readEnvMerged(saydoHome, false);
  const pendingEnvMerged = readEnvMerged(saydoHome, true);
  const activeEnv: Record<string, string | undefined> = {
    ...(input.processEnv ?? process.env),
    ...activeEnvMerged.values
  };
  const candidateEnv: Record<string, string | undefined> = {
    ...(input.processEnv ?? process.env),
    ...pendingEnvMerged.values
  };

  const configPath = join(saydoHome, "config.toml");
  const pendingCfg = pendingPaths(saydoHome, "config.toml");
  let present = false;
  let cfg: SaydoConfig | null = null;
  let configReadViolation: Violation | null = null;
  try {
    if (existsSync(configPath)) {
      cfg = loadConfigFile(configPath);
      present = true;
    }
  } catch (err) {
    present = existsSync(configPath);
    cfg = null;
    configReadViolation = {
      code: "active_config_unreadable",
      message: `活动 config.toml 不可读:${sanitizedConfigErrorSummary(err)}`
    };
  }

  const providers = cfg?.providers;
  const models = cfg?.models;
  const acks: SetupProbeResult["acks"] = {
    evaluator_isolation: models?.evaluator_isolation_ack === true,
    evaluator_same_family: models?.evaluator_same_family_ack === true
  };
  const validation = cfg ? validateConfig({ config: cfg, env: activeEnv }) : null;
  const hints = validation?.hints ?? [];
  const recoveryViolations = [
    ...(configReadViolation ? [configReadViolation] : validation?.violations ?? []),
    ...(input.recoveryViolations ?? [])
  ].filter(
    (violation, index, all) =>
      all.findIndex((candidate) => candidate.code === violation.code && candidate.message === violation.message) === index
  );
  const recoveryActive = recoveryViolations.length > 0;
  const slots: SetupProbeResult["config"]["slots"] = {
    dialog: { ...classifySlot(models?.dialog, providers, activeEnv), effective: "unarmed" },
    thinking: { ...classifySlot(models?.thinking, providers, activeEnv), effective: "unarmed" },
    cheap: { ...classifySlot(models?.cheap, providers, activeEnv), effective: "unarmed" },
    evaluator: { ...classifySlot(models?.evaluator, providers, activeEnv), effective: "unarmed" },
    dev: {
      ...classifySlot(models?.dev as ModelBinding | undefined, providers, activeEnv),
      effective: models?.dev && !isPlaceholderBinding(models.dev as never) ? "active" : "unarmed"
    }
  };
  if (cfg && validation?.ok && !recoveryActive) {
    const projection = resolveProviderProjection(cfg, activeEnv, undefined, undefined, {
      registry: loadCliRuntimeRegistry(saydoHome),
      ...(input.cliRuntimeReceipts ? { receipts: input.cliRuntimeReceipts } : {})
    });
    for (const slot of ["dialog", "thinking", "cheap", "evaluator"] as const) {
      const resolved = projection[slot];
      slots[slot].effective = resolved.effective;
      if (resolved.mode) slots[slot].mode = resolved.mode;
      if (resolved.reason) slots[slot].reason = resolved.reason;
      if (resolved.fallbackTo) slots[slot].fallbackTo = resolved.fallbackTo;
    }
  } else if (recoveryActive) {
    for (const slot of ["dialog", "thinking", "cheap", "evaluator"] as const) {
      slots[slot].effective = "unarmed";
      slots[slot].reason = "recovery_only";
    }
  }

  const secrets: Record<string, boolean> = {};
  for (const name of PROBE_SECRET_NAMES) {
    secrets[name] = secretPresent(candidateEnv, name);
  }

  const probeFn: (bin: string) => Promise<{ found: boolean; version?: string; path?: string }> =
    input.cliProbeFn ?? (input.skipCliProbe ? async () => ({ found: false }) : (bin) => probeCliOnce(bin, 3000, input.signal));
  // 画像装没装面也并行:哪家慢不堵其余,整体墙钟 ≈ 最慢一家而不是串行叠加
  const clis: SetupProbeResult["clis"] = await Promise.all(
    CLI_BINS.map(async (c) => {
      const r = input.skipCliProbe
        ? { found: false as const }
        : await probeCliEntry(c, probeFn);
      const entry: SetupProbeResult["clis"][number] = {
        name: c.name,
        found: r.found,
        candidate: r.found
      };
      if (r.version) entry.version = r.version;
      if (r.path) entry.path = r.path;
      return entry;
    })
  );

  let pendingConfig: SetupProbeResult["pendingConfig"] = null;
  if (existsSync(pendingCfg.pending)) {
    try {
      const text = readFileSync(pendingCfg.pending, "utf8");
      const parsed = parseConfigText(text);
      const v = validateConfig({ config: parsed, env: candidateEnv });
      if (v.ok) {
        pendingConfig = { present: true, status: "ready_to_promote" };
      } else {
        pendingConfig = {
          present: true,
          status: "validation_failed",
          error: v.violations.map((x) => x.message).join("; ").slice(0, 300)
        };
      }
    } catch (err) {
      pendingConfig = {
        present: true,
        status: "validation_failed",
        error: sanitizedConfigErrorSummary(err)
      };
    }
  }

  const pendingEnvPath = join(saydoHome, ".env.pending");
  const pendingEnv = existsSync(pendingEnvPath) ? { present: true } : null;

  const voiceNote =
    !input.voice.pipelinePeer
      ? "语音服务未跟上,重跑启动脚本或稍候"
      : input.voice.asr !== "ok" || input.voice.tts === "down"
        ? "语音管线已连但 ASR/TTS 降级"
        : undefined;

  return {
    config: { present, slots },
    secrets,
    acks,
    hints,
    clis,
    voice: {
      pipelinePeer: input.voice.pipelinePeer,
      asr: input.voice.asr,
      tts: input.voice.tts,
      ...(voiceNote ? { note: voiceNote } : {})
    },
    pendingConfig,
    pendingEnv,
    recovery: {
      active: recoveryActive,
      mode: recoveryActive ? "recovery_only" : "normal",
      violations: recoveryViolations
    }
  };
}

// ---------- POST config (staged) ----------

/** configSchema 失败 → 人话 message;原始 issues 放 violations 供工程排查(v6) */
function rejectConfigSchema(err: unknown): WriteConfigResult {
  if (err instanceof z.ZodError) {
    const violations = err.issues.map((i) => ({
      path: i.path.length > 0 ? i.path.join(".") : "(root)",
      message: i.message
    }));
    const first = violations[0];
    const pathLabel = first?.path && first.path !== "(root)" ? first.path : "配置";
    const detail = first?.message ?? "字段不符合 schema";
    // 多字段时提示条数,不 dump 原始 JSON
    const more =
      violations.length > 1 ? `等 ${violations.length} 处` : "";
    return {
      ok: false,
      status: 422,
      code: "config_schema_invalid",
      message: `配置校验没通过:${pathLabel} ${detail}${more}`.slice(0, 300),
      violations
    };
  }
  // 非 zod(如 TOML 解析中间态):仍避免把巨型 JSON 原文塞进 message
  const raw = String(err instanceof Error ? err.message : err).slice(0, 200);
  const startsLikeJson = raw.trimStart().startsWith("{") || raw.trimStart().startsWith("[");
  return {
    ok: false,
    status: 422,
    code: "config_schema_invalid",
    message: startsLikeJson
      ? "配置校验没通过:结构不符合 schema(详见 violations)"
      : `配置校验没通过:${raw}`,
    violations: [{ message: raw }]
  };
}

export function writeSetupConfigStaged(
  saydoHome: string,
  body: unknown,
  processEnv?: Record<string, string | undefined>,
  validateCandidate?: (config: SaydoConfig) => Violation[]
): WriteConfigResult {
  const parsed = setupConfigBodySchema.safeParse(body);
  if (!parsed.success) {
    return rejectSetupBody(parsed.error.issues);
  }
  const patch = parsed.data;

  let base: Record<string, unknown> = {};
  const activePath = join(saydoHome, "config.toml");
  if (existsSync(activePath)) {
    try {
      base = parseToml(readFileSync(activePath, "utf8")) as Record<string, unknown>;
    } catch {
      // recovery-only 自救:损坏 active 无法安全合并,从最小模板重建 pending；隐私与 Gate 0 取收紧值。
      base = {
        ...defaultConfigTemplate(),
        privacy: { store_audio: false, store_transcript: false, audio_retention_days: 0 },
        gate0: { enabled: true, bypass: false }
      };
    }
  } else {
    // v6:无活动文件时套缺省模板再合并 patch(与启动自举同一 defaultConfigTemplate)
    base = defaultConfigTemplate();
  }

  const candidate: Record<string, unknown> = { ...base };
  if (patch.models) {
    const baseModels =
      typeof base["models"] === "object" && base["models"] !== null
        ? { ...(base["models"] as Record<string, unknown>) }
        : {};
    candidate["models"] = { ...baseModels, ...patch.models };
  }
  if (patch.providers) {
    const baseProviders =
      typeof base["providers"] === "object" && base["providers"] !== null
        ? { ...(base["providers"] as Record<string, unknown>) }
        : {};
    const baseApi =
      typeof baseProviders["api"] === "object" && baseProviders["api"] !== null
        ? { ...(baseProviders["api"] as Record<string, unknown>) }
        : {};
    const patchApi =
      typeof patch.providers.api === "object" && patch.providers.api !== null
        ? patch.providers.api
        : {};
    candidate["providers"] = { ...baseProviders, api: { ...baseApi, ...patchApi } };
  }
  if (patch.budget !== undefined) candidate["budget"] = patch.budget;
  if (patch.dnd !== undefined) candidate["dnd"] = patch.dnd;

  // 保存为四槽全 API 时,旧 CLI 时代的 isolation ack 永远无效;异族方案连同 same-family ack 同次移除。
  const candidateModels = candidate["models"] as Record<string, unknown> | undefined;
  const allApi =
    candidateModels !== undefined &&
    MODEL_SLOTS_WITH_VIA.every((slot) => {
      const binding = candidateModels[slot] as ModelBinding | undefined;
      return binding !== undefined && bindingProvider(binding) === "api";
    });
  if (allApi) {
    delete candidateModels["evaluator_isolation_ack"];
  }

  let tomlText: string;
  try {
    tomlText = tomlStringify(candidate);
  } catch (err) {
    return {
      ok: false,
      status: 422,
      code: "toml_stringify_failed",
      message: String(err).slice(0, 200)
    };
  }

  let cfg: SaydoConfig;
  try {
    cfg = parseConfigText(tomlText);
    configSchema.parse(cfg);
  } catch (err) {
    return rejectConfigSchema(err);
  }

  // v5:via 引用一致性(显式 code=via_provider_missing,先于 validateConfig 的同语义检查)
  const viaMiss = checkViaProviderRefs(cfg);
  if (viaMiss) return viaMiss;

  // loadConfigFile 同源:把 pending 文本当文件内容再 parse 一次(已由 parseConfigText 完成)
  const env = { ...(processEnv ?? process.env), ...readEnvMerged(saydoHome, true).values };
  if (allApi) {
    const families = evaluatorFamilyContext(cfg, env);
    const sameFamily =
      families.evaluator !== null &&
      (families.evaluator === families.dialog || families.evaluator === families.thinking);
    if (!sameFamily) {
      delete candidateModels["evaluator_same_family_ack"];
      tomlText = tomlStringify(candidate);
      cfg = parseConfigText(tomlText);
      configSchema.parse(cfg);
    }
  }
  const v = validateConfig({ config: cfg, env });
  if (!v.ok) {
    return {
      ok: false,
      status: 422,
      code: "config_validation_failed",
      message: v.violations.map((x) => x.message).join("; ").slice(0, 400),
      violations: v.violations
    };
  }

  const candidateViolations = validateCandidate?.(cfg) ?? [];
  if (candidateViolations.length > 0) {
    return {
      ok: false,
      status: 422,
      code: "project_overrides_conflict",
      message: candidateViolations.map((x) => x.message).join(";").slice(0, 400),
      violations: candidateViolations
    };
  }

  const { pending } = pendingPaths(saydoHome, "config.toml");
  writePendingFile(pending, tomlText, 0o600);
  return { ok: true, restart_required: true };
}

// ---------- POST secret (staged) ----------

export type WriteSecretResult =
  | { ok: true; name: SecretName; restart_required: true }
  | { ok: false; status: 422 | 400; code: string; message: string };

export function writeSetupSecretStaged(
  saydoHome: string,
  body: unknown,
  audit?: AuditSink
): WriteSecretResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, status: 400, code: "bad_body", message: "body 须为 {name,value}" };
  }
  const rec = body as Record<string, unknown>;
  const extra = Object.keys(rec).filter((k) => k !== "name" && k !== "value");
  if (extra.length > 0) {
    return {
      ok: false,
      status: 422,
      code: "secret_body_rejected",
      message: `非白名单字段:${extra.join(",")}`
    };
  }
  const name = rec["name"];
  const value = rec["value"];
  if (typeof name !== "string" || !isSecretName(name)) {
    return {
      ok: false,
      status: 422,
      code: "secret_name_rejected",
      message: `name 不在白名单(允许:${SECRET_NAME_LIST})`
    };
  }
  if (typeof value !== "string" || value.length === 0) {
    return { ok: false, status: 422, code: "secret_value_required", message: "value 须为非空字符串" };
  }
  // 拒路径穿越式 name(白名单已挡,双保险)
  if (name.includes("/") || name.includes("..") || name.includes("\0")) {
    return { ok: false, status: 422, code: "secret_name_rejected", message: "非法 name" };
  }

  const activePath = join(saydoHome, ".env");
  const pendingPath = join(saydoHome, ".env.pending");
  // 合并基底:已有 pending 优先,否则活动 .env
  let baseText: string | null = null;
  if (existsSync(pendingPath)) baseText = readFileSync(pendingPath, "utf8");
  else if (existsSync(activePath)) baseText = readFileSync(activePath, "utf8");

  const merged = mergeEnvText(baseText, name, value);
  writePendingFile(pendingPath, merged, 0o600);

  // audit 只记 name,永不记 value
  audit?.record({ actor: "owner", action: "setup.secret_staged", meta: { name } });

  return { ok: true, name, restart_required: true };
}

// 派生自 envFile 单源(AGENTS.md 契约不分叉):此前是手抄副本,加 key 时会漏同步。
const SECRET_NAME_LIST = SECRET_NAME_WHITELIST.join("|");

// ---------- POST test ----------

export type SetupTestScope = "plan" | "voice" | "tier1";

export interface SetupTestInput {
  saydoHome: string;
  voice: { pipelinePeer: boolean; asr: "ok" | "degraded" | "down"; tts: "ok" | "degraded" | "down" };
  processEnv?: Record<string, string | undefined>;
  audit?: AuditSink;
  /** plan=方案自检(默认,不含 voice);voice=设置页单独测语音;tier1=执行器后端自检(W5.4-b C1)。 */
  scope?: SetupTestScope;
  /** scope=tier1 的检查 probe(缺省真调本机;测试注入 fake,不真调 claude)。 */
  tier1Probes?: Tier1SelfTestProbes;
  /** 注入:保留真实 resolver,仅替换 provider.chat 网络边界。 */
  slotChatFn?: (slot: "dialog" | "thinking" | "cheap" | "evaluator", req: ChatRequest, callIndex: number) => Promise<ChatResult>;
  cliTestFn?: (bin: string, signal?: AbortSignal) => Promise<SlotTestResult>;
  cliCapabilityFn?: (name: CliName) => Promise<CliCapability>;
  onSubscriptionInvocation?: CliResolverContext["onSubscriptionInvocation"];
  cliRuntimeReceipts?: CliRuntimeReceiptIndex;
  now?: () => Date;
  signal?: AbortSignal;
  /** daemon logger;self-test 的 safetyStop 触发行走这里。 */
  log?: ResolverLog;
}

/** 四槽一发一收 / dialog oneshot 自检硬禁令。dialog API 工具环自检不加。 */
export const SETUP_SELF_TEST_NO_TOOL_BAN =
  "不要使用任何工具、不要读写文件、不要执行命令。只输出纯文本。";
export const SETUP_SELF_TEST_NO_TOOL_BAN_REINFORCED =
  `${SETUP_SELF_TEST_NO_TOOL_BAN}\n再次强调:不要调用任何工具;检测到命令或工具事件时本次结果会立即作废。`;

export function setupSelfTestPrompt(body: string, reinforced = false): string {
  return `${reinforced ? SETUP_SELF_TEST_NO_TOOL_BAN_REINFORCED : SETUP_SELF_TEST_NO_TOOL_BAN}\n${body}`;
}

export function parseSetupTestRequest(body: unknown): { scope: SetupTestScope } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { scope: "plan" };
  const scope = (body as Record<string, unknown>)["scope"];
  if (scope === "voice") return { scope: "voice" };
  if (scope === "tier1") return { scope: "tier1" };
  return { scope: "plan" };
}

/** 最小真调用 max_tokens≤8(独立 fetch,不经 openaiCompat 的 3000 下限) */
export async function minimalApiChat(args: {
  baseUrl: string;
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<{ ok: boolean; error?: string; latencyMs: number }> {
  const t0 = Date.now();
  const fetchImpl = args.fetchImpl ?? fetch;
  const controller = new AbortController();
  const onAbort = (): void => controller.abort();
  if (args.signal?.aborted) onAbort();
  else args.signal?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? 15_000);
  try {
    const res = await fetchImpl(`${args.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${args.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: args.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 8
      }),
      signal: controller.signal
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      const text = (await res.text().catch(() => "")).slice(0, 160);
      // 人话错误,不含 key
      return {
        ok: false,
        error: `上游返回 ${res.status}${text ? `: ${redactSecrets(text)}` : ""}`,
        latencyMs
      };
    }
    return { ok: true, latencyMs };
  } catch (err) {
    return {
      ok: false,
      error: redactSecrets(String(err instanceof Error ? err.message : err).slice(0, 200)),
      latencyMs: Date.now() - t0
    };
  } finally {
    clearTimeout(timer);
    args.signal?.removeEventListener("abort", onAbort);
  }
}

function redactSecrets(s: string): string {
  return s
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9]{8,}/g, "[redacted]")
    .replace(/key[=:]\s*["']?[^"'\s]+/gi, "key=[redacted]");
}

function redactCliError(s: string): string {
  return redactSecrets(s).replace(/(?:\/[^/\s:;,]+){2,}/g, "[path]");
}

async function defaultCliTest(bin: string, signal?: AbortSignal): Promise<SlotTestResult> {
  const t0 = Date.now();
  try {
    const path = await resolveExecutable(bin);
    if (!path) return { status: "fail", error: `未找到 ${bin}`, latencyMs: Date.now() - t0 };
    await execFileAsync(path, ["--version"], { timeout: 3000, encoding: "utf8", maxBuffer: 64 * 1024, ...(signal ? { signal } : {}) });
    // 登录态可测则测(不可测标 untested 不伪造)
    if (bin === "codex") {
      try {
        await execFileAsync(path, ["login", "status"], {
          timeout: 5000,
          encoding: "utf8",
          maxBuffer: 64 * 1024,
          ...(signal ? { signal } : {})
        });
        return { status: "ok", latencyMs: Date.now() - t0 };
      } catch {
        return {
          status: "untested",
          error: "codex --version 可用,登录态无法可靠探测(未伪造 ok)",
          latencyMs: Date.now() - t0
        };
      }
    }
    if (bin === "claude") {
      try {
        await execFileAsync(path, ["auth", "status"], {
          timeout: 5000,
          encoding: "utf8",
          maxBuffer: 64 * 1024,
          ...(signal ? { signal } : {})
        });
        return { status: "ok", latencyMs: Date.now() - t0 };
      } catch {
        return {
          status: "untested",
          error: "claude --version 可用,登录态无法可靠探测(未伪造 ok)",
          latencyMs: Date.now() - t0
        };
      }
    }
    // cursor-agent: --version 即 canonical 最小
    return { status: "ok", latencyMs: Date.now() - t0 };
  } catch (err) {
    return {
      status: "fail",
      error: String(err instanceof Error ? err.message : err).slice(0, 160),
      latencyMs: Date.now() - t0
    };
  }
}

function loadConfigPreferPending(saydoHome: string): {
  cfg: SaydoConfig | null;
  source: "pending" | "active" | "none";
} {
  const pending = join(saydoHome, "config.toml.pending");
  const active = join(saydoHome, "config.toml");
  if (existsSync(pending)) {
    try {
      return { cfg: parseConfigText(readFileSync(pending, "utf8")), source: "pending" };
    } catch {
      // fall through
    }
  }
  if (existsSync(active)) {
    try {
      return { cfg: loadConfigFile(active), source: "active" };
    } catch {
      return { cfg: null, source: "none" };
    }
  }
  return { cfg: null, source: "none" };
}

/**
 * staged config 含 CLI binding 时,只有同一 activation 的四字段 self-test 登记齐全才允许重启晋升。
 * API-only 或没有 config pending 的普通重启不受此门影响。
 */
export function pendingCliSelfTestGate(
  saydoHome: string,
  receipts: CliRuntimeReceiptIndex,
  allowActiveFallback = false
): { ok: true } | { ok: false; missingSlots: CliRuntimeSlot[] } {
  const pendingPath = join(saydoHome, "config.toml.pending");
  const envPendingPath = join(saydoHome, ".env.pending");
  const registry = loadPendingCliRuntimeRegistry(saydoHome);
  if (!existsSync(pendingPath) && !existsSync(envPendingPath) && !registry.activation) return { ok: true };
  const configPath = existsSync(pendingPath) ? pendingPath : join(saydoHome, "config.toml");
  let cfg: SaydoConfig;
  try {
    cfg = parseConfigText(readFileSync(configPath, "utf8"));
  } catch {
    return { ok: false, missingSlots: ["dialog", "thinking", "cheap", "evaluator"] };
  }
  const missingSlots: CliRuntimeSlot[] = [];
  for (const slot of ["dialog", "thinking", "cheap", "evaluator"] as const) {
    const binding = cfg.models[slot];
    const provider = bindingProvider(binding);
    if (!isWiredCliProvider(provider)) {
      continue;
    }
    if (!registeredCliSlot(registry, slot, binding, receipts)) missingSlots.push(slot);
  }
  if (!pendingCliRuntimeActivationMatches(saydoHome, registry.activation, allowActiveFallback)) {
    const cliSlots = (["dialog", "thinking", "cheap", "evaluator"] as const).filter((slot) => {
      const provider = bindingProvider(cfg.models[slot]);
      return isWiredCliProvider(provider);
    });
    return cliSlots.length === 0 ? { ok: true } : { ok: false, missingSlots: cliSlots };
  }
  return missingSlots.length === 0 ? { ok: true } : { ok: false, missingSlots };
}

/** 语音自检:密钥布尔 + pipeline peer。方案链不调用;设置页 scope=voice 才跑。 */
export function evaluateVoiceSlot(
  env: Record<string, string | undefined>,
  voice: SetupTestInput["voice"]
): SlotTestResult {
  const hasAsr = secretPresent(env, "VOLC_APP_ID") && secretPresent(env, "VOLC_ACCESS_TOKEN");
  const hasTts = secretPresent(env, "DOUBAO_TTS_API_KEY");
  if (!hasAsr && !hasTts) {
    return {
      status: "fail",
      error: "语音还没配,可以先跳过——打字全功能可用",
      detail: "VOLC_APP_ID / VOLC_ACCESS_TOKEN / DOUBAO_TTS_API_KEY"
    };
  }
  if (!voice.pipelinePeer) {
    return {
      status: "fail",
      error: "语音密钥已见,但 pipeline peer 未在线"
    };
  }
  const voiceOk: SlotTestResult = { status: "ok" };
  if (voice.asr !== "ok" || voice.tts === "down") {
    voiceOk.error = `peer 在线但 asr=${voice.asr} tts=${voice.tts}`;
  }
  return voiceOk;
}

export async function runSetupTest(input: SetupTestInput): Promise<SetupTestResult> {
  const { saydoHome } = input;
  const { cfg, source: configSource } = loadConfigPreferPending(saydoHome);
  const envMerged = readEnvMerged(saydoHome, true);
  const env: Record<string, string | undefined> = {
    ...(input.processEnv ?? process.env),
    ...envMerged.values
  };
  const envSource = envMerged.source;
  if (input.scope === "voice") {
    return { configSource, envSource, slots: { voice: evaluateVoiceSlot(env, input.voice) } };
  }
  if (input.scope === "tier1") {
    // W5.4-b C1:执行器后端自检(按生效 adapter 分叉;检查项经 probe 注入,live 走查归 W5.4-c)
    const tier1 = await runTier1SelfTest({
      saydoHome,
      cfg,
      probes: input.tier1Probes ?? defaultTier1Probes(),
      ...(input.now ? { now: input.now } : {}),
      ...(input.signal ? { signal: input.signal } : {})
    });
    return { configSource, envSource, slots: {}, tier1 };
  }
  const runtimeTarget = configSource === "pending" || envSource === "pending" ? "pending" : "active";
  const runtimeActivation =
    runtimeTarget === "pending"
      ? {
          ...(configSource === "pending"
            ? { configDigest: createHash("sha256").update(readFileSync(join(saydoHome, "config.toml.pending"))).digest("hex") }
            : {}),
          ...(envSource === "pending"
            ? { envDigest: createHash("sha256").update(readFileSync(join(saydoHome, ".env.pending"))).digest("hex") }
            : {})
        }
      : undefined;
  if (runtimeTarget === "pending" && runtimeActivation) {
    preparePendingCliRuntimeActivation(saydoHome, runtimeActivation);
  }
  const slots: SetupTestResult["slots"] = {};
  const cliTest = input.cliTestFn ?? defaultCliTest;
  const runtimeReceipts = new Map(input.cliRuntimeReceipts ?? []);

  if (cfg) {
    const runtimeContext = (): CliResolverContext => ({
      registry:
        runtimeTarget === "active"
          ? loadCliRuntimeRegistry(saydoHome)
          : loadPendingCliRuntimeRegistry(saydoHome),
      receipts: runtimeReceipts,
      ...(input.onSubscriptionInvocation
        ? { onSubscriptionInvocation: input.onSubscriptionInvocation }
        : {})
    });
    const dialog = resolveDialogProvider(cfg, env, undefined, input.audit, runtimeContext());
    const expectedEvaluatorFamily = evaluatorFamilyContext(cfg, env).evaluator;
    const capabilityFn = input.cliCapabilityFn ?? ((name: CliName) => probeCliCapability(name, { ...(input.signal ? { signal: input.signal } : {}) }));
    const capabilityPromises = new Map<CliName, Promise<CliCapability>>();
    const capabilityFor = (provider: string): Promise<CliCapability> => {
      const name = cliNameForProvider(provider);
      if (!name) throw new Error(`未知 CLI provider:${provider}`);
      const existing = capabilityPromises.get(name);
      if (existing) return existing;
      const pending = capabilityFn(name);
      capabilityPromises.set(name, pending);
      return pending;
    };

    for (const slot of ["dialog", "thinking", "cheap", "evaluator"] as const) {
      const binding = cfg.models[slot];
      const configuredProvider = bindingProvider(binding);
      const isCli = isWiredCliProvider(configuredProvider);
      let resolved =
        slot === "dialog"
          ? dialog
          : slot === "thinking"
            ? resolveThinkingProvider(
                cfg,
                env,
                dialog.provider,
                undefined,
                cfg.models.thinking,
                input.audit,
                runtimeContext()
              )
            : slot === "cheap"
              ? resolveDrafterProvider(cfg, env, dialog.provider, undefined, input.audit, runtimeContext())
              : resolveEvaluatorProvider(cfg, env, undefined, input.audit, runtimeContext());
      let capability: CliCapability | undefined;
      let expectedFamily = slot === "evaluator" ? expectedEvaluatorFamily ?? undefined : undefined;
      if (isCli) {
        if (
          slot === "evaluator" &&
          (cfg.models.evaluator_same_family_ack !== true || cfg.models.evaluator_isolation_ack !== true)
        ) {
          clearCliSelfTest(saydoHome, "evaluator", binding, runtimeTarget);
          slots[slot] = {
            status: "fail",
            error: "CLI evaluator 需要同族 ack 与隔离 ack 双齐;未确认前不发起自检、不写入 armed 登记"
          };
          continue;
        }
        try {
          capability = await capabilityFor(configuredProvider);
          const provisional = createCliSelfTestProvider({
            slot: slot as CliRuntimeSlot,
            cfg,
            binding,
            capability,
            env,
            ...(input.audit ? { audit: input.audit } : {}),
            context: input.onSubscriptionInvocation
              ? { onSubscriptionInvocation: input.onSubscriptionInvocation }
              : {},
            ...(input.log ? { log: input.log } : {})
          });
          resolved = { provider: provisional.provider, effective: "active" };
          expectedFamily = provisional.expectedFamily as Family;
        } catch (err) {
          clearCliSelfTest(saydoHome, slot as CliRuntimeSlot, binding, runtimeTarget);
          slots[slot] = {
            status: "fail",
            error: `CLI 无法进入真实自检:${redactCliError(String(err instanceof Error ? err.message : err).slice(0, 180))}`
          };
          continue;
        }
      }
      if (!resolved.provider) {
        slots[slot] = {
          status: "fail",
          error:
            resolved.reason === "same_family_blocked"
              ? "评估器与实际对话/沉思模型同族且未确认,深评线不武装"
              : resolved.reason === "isolation_ack_required"
                ? "CLI evaluator 隔离确认未完成,深评线不武装"
                : "模型供给不可用,请检查 API 端点、key 或 CLI self-test"
        };
        continue;
      }
      const tested = await testResolvedModelSlot(
        slot,
        resolved.provider,
        input.slotChatFn
          ? (req, callIndex) => input.slotChatFn!(slot, req, callIndex)
          : undefined,
        expectedFamily,
        input.signal
      );
      slots[slot] = tested;
      if (isCli) {
        if (
          tested.status === "ok" &&
          capability?.path &&
          capability.binaryDigest &&
          tested.observedModelSource &&
          tested.observedModelSource !== "unknown" &&
          expectedFamily
        ) {
          try {
            if (!input.audit) throw new Error("CLI self-test 登记要求不可变 audit sink");
            const registration = registerCliSelfTest(
              saydoHome,
              binding,
              {
                slot: slot as CliRuntimeSlot,
                provider: configuredProvider,
                binaryPath: capability.path,
                binaryDigest: capability.binaryDigest,
                expectedFamily,
                ...(tested.requestedModel ? { requestedModel: tested.requestedModel } : {}),
                ...(tested.observedModel && tested.observedModelSource !== "verified_binary_default"
                  ? { observedModel: tested.observedModel }
                  : {}),
                observedModelSource: tested.observedModelSource,
                observedModelExempted: tested.observedModelExempted === true,
                testedAt: (input.now ?? (() => new Date()))().toISOString()
              },
              input.audit,
              runtimeTarget,
              runtimeActivation
            );
            runtimeReceipts.set(registration.receipt.auditId, registration.receipt.evidenceDigest);
          } catch (err) {
            clearCliSelfTest(saydoHome, slot as CliRuntimeSlot, binding, runtimeTarget);
            slots[slot] = {
              status: "fail",
              error: `CLI self-test 通过但登记失败:${redactCliError(String(err instanceof Error ? err.message : err).slice(0, 160))}`
            };
          }
        } else {
          clearCliSelfTest(saydoHome, slot as CliRuntimeSlot, binding, runtimeTarget);
        }
      }
    }
    if (cfg.models.dev) {
      const agent = cfg.models.dev.agent;
      const bin = agent === "cursor" ? "cursor-agent" : agent === "codex" ? "codex" : "claude";
      slots["dev"] = await cliTest(bin, input.signal);
    } else {
      slots["dev"] = { status: "untested", error: "开发槽未配置" };
    }
  } else {
    for (const s of ["dialog", "thinking", "cheap", "evaluator", "dev"] as const) {
      slots[s] = { status: "untested", error: "无可用配置" };
    }
  }

  return { configSource, envSource, slots };
}

/** 按生产真实请求形态逐槽自检;失败原因直接回槽位红灯。 */
export async function testResolvedModelSlot(
  slot: "dialog" | "thinking" | "cheap" | "evaluator",
  provider: LlmProvider,
  chatOverride?: (req: ChatRequest, callIndex: number) => Promise<ChatResult>,
  expectedEvaluatorFamily?: Family,
  signal?: AbortSignal
): Promise<SlotTestResult> {
  const started = Date.now();
  let callIndex = 0;
  const chat = (req: ChatRequest): Promise<ChatResult> =>
    chatOverride ? chatOverride(req, callIndex++) : provider.chat(req, signal);
  const chatWithTripwireRetry = async (
    build: (reinforced: boolean) => Omit<ChatRequest, "retryBudget">
  ): Promise<ChatResult> => {
    const first = await chat({ ...build(false), retryBudget: 0 });
    if (first.ok) return first;
    if (first.code === "voided_tripwire") return chat({ ...build(true), retryBudget: 0 });
    if (first.code === "voided_unknown_event") return chat({ ...build(false), retryBudget: 0 });
    return first;
  };
  const fail = (error: string): SlotTestResult => ({ status: "fail", error, latencyMs: Date.now() - started });
  const evidence = (result: Extract<ChatResult, { ok: true }>): SlotTestResult | null => {
    const source = result.observedModelSource ?? (provider.kind === "api" && result.observedModel ? "stream" : "unknown");
    if (provider.kind !== "api") {
      if (source === "unknown") return fail("CLI self-test 无 observedModel 证据,保持 unarmed");
      if (source === "stream" && !result.observedModel) return fail("CLI stream 未给出 observedModel,保持 unarmed");
      if (source === "stream" && result.observedModelExempted) return fail("CLI stream 证据不得标记豁免,保持 unarmed");
      if (source === "verified_binary_default" && result.observedModelExempted !== true) {
        return fail("CLI 二进制默认模型未完成登记豁免,保持 unarmed");
      }
      if (
        source === "verified_binary_default" &&
        provider.kind !== "codex_cli" &&
        provider.kind !== "claude_cli"
      ) {
        return fail("该 CLI 不属于固定家族,不得使用二进制默认模型豁免");
      }
    }
    const downgradeNote =
      provider.kind !== "api"
        ? sameFamilyCliDowngradeDisplay(result.requestedModel, result.observedModel)
        : undefined;
    return {
      status: "ok",
      latencyMs: Date.now() - started,
      ...(result.requestedModel ? { requestedModel: result.requestedModel } : {}),
      ...(result.observedModel ? { observedModel: result.observedModel } : {}),
      ...(provider.kind !== "api" || result.observedModelSource
        ? { observedModelSource: source, observedModelExempted: result.observedModelExempted === true }
        : {}),
      ...(downgradeNote ? { detail: downgradeNote } : {})
    };
  };
  try {
    if (slot === "dialog") {
      if (provider.kind !== "api") {
        const result = await chatWithTripwireRetry((reinforced) => ({
          messages: [
            {
              role: "user",
              content: setupSelfTestPrompt(
                '返回 dialog_cli_oneshot 自检 envelope:version=1,reply="pong",actions=[]。只输出 JSON。',
                reinforced
              )
            }
          ],
          jsonSchema: DIALOG_CLI_ONESHOT_JSON_SCHEMA as unknown as Record<string, unknown>,
          temperature: 0,
          maxTokens: 128
        }));
        if (!result.ok) return fail(`oneshot 结构化请求失败:${result.message}`);
        const envelope = parseDialogCliOneshotEnvelope(result.text);
        if (!envelope || envelope.reply !== "pong" || envelope.actions.length !== 0) {
          return fail("dialog CLI 未返回固定的 oneshot 自检 envelope");
        }
        return evidence(result) ?? fail("dialog CLI self-test 证据无效");
      }
      const tool = {
        name: "saydo_self_test",
        description: "setup 自检工具,要求模型必须调用一次",
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["value"],
          properties: { value: { type: "string", enum: ["ping"] } }
        }
      };
      const first = await chat({
        messages: [{ role: "user", content: "调用 saydo_self_test,value 必须是 ping。" }],
        tools: [tool],
        temperature: 0,
        maxTokens: 64
      });
      if (!first.ok) return fail(`工具调用请求失败:${first.message}`);
      const call = first.toolCalls?.find((item) => item.name === tool.name);
      if (!call) return fail("模型没有按要求发起 tool call,对话工具协议不可用");
      let args: unknown;
      try {
        args = JSON.parse(call.arguments);
      } catch {
        return fail("tool call arguments 不是合法 JSON");
      }
      if ((args as Record<string, unknown> | null)?.["value"] !== "ping") {
        return fail("tool call arguments 未按 schema 返回 value=ping");
      }
      const second = await chat({
        messages: [
          { role: "user", content: "调用 saydo_self_test,value 必须是 ping。" },
          { role: "assistant", content: first.text, toolCalls: first.toolCalls ?? [call] },
          { role: "tool", content: '{"ok":true}', toolCallId: call.id }
        ],
        tools: [tool],
        temperature: 0,
        maxTokens: 64
      });
      if (!second.ok) return fail(`tool result 往返失败:${second.message}`);
      if (!second.text.trim()) return fail("tool result 往返后模型没有给出文本响应");
      return evidence(second) ?? fail("对话档 self-test 证据无效");
    }

    if (slot === "cheap") {
      const result = await chatWithTripwireRetry((reinforced) => ({
        messages: [
          { role: "system", content: "按给定 schema 起草最小决策包,只输出 JSON。" },
          { role: "user", content: setupSelfTestPrompt("做一次 setup 自检", reinforced) }
        ],
        jsonSchema: DRAFT_JSON_SCHEMA as unknown as Record<string, unknown>,
        temperature: 0,
        maxTokens: 256
      }));
      if (!result.ok) return fail(`结构化起草请求失败:${result.message}`);
      try {
        draftPackageSchema.parse(JSON.parse(result.text));
      } catch (err) {
        return fail(`起草输出不符合真实 JSON schema:${String(err).slice(0, 160)}`);
      }
      return evidence(result) ?? fail("cheap self-test 证据无效");
    }

    if (slot === "evaluator") {
      const result = await chatWithTripwireRetry((reinforced) => ({
        messages: [
          { role: "user", content: setupSelfTestPrompt("按 schema 返回空 perClaim 数组,只输出 JSON。", reinforced) }
        ],
        jsonSchema: DEEP_OUTPUT_JSON_SCHEMA as unknown as Record<string, unknown>,
        temperature: 0,
        maxTokens: 128
      }));
      if (!result.ok) return fail(`结构化评估请求失败:${result.message}`);
      try {
        deepOutputSchema.parse(JSON.parse(result.text));
      } catch (err) {
        return fail(`评估输出不符合结构化合同:${String(err).slice(0, 160)}`);
      }
      const checked = evidence(result);
      if (!checked || checked.status !== "ok") return checked ?? fail("evaluator self-test 证据无效");
      if (!result.observedModel && result.observedModelSource !== "verified_binary_default") {
        return fail("评估响应没有 observedModel 证据,无法证明实际模型");
      }
      if (expectedEvaluatorFamily !== undefined) {
        if (result.observedModel) {
          const observedFamily = familyFromModelName(result.observedModel);
          if (!observedFamily) return fail("无法从 observed model 判断实际评估家族");
          if (observedFamily !== expectedEvaluatorFamily) {
            return fail(`observed model 家族为 ${observedFamily},与配置家族 ${expectedEvaluatorFamily} 不一致`);
          }
        } else if (provider.kind !== "codex_cli" && provider.kind !== "claude_cli") {
          return fail("只有完成二进制登记的固定家族 CLI 才能豁免流内 model");
        }
      }
      return checked;
    }

    const result = await chatWithTripwireRetry((reinforced) => ({
      messages: [
        { role: "user", content: setupSelfTestPrompt("用一句纯文本回答 setup thinking self-test。", reinforced) }
      ],
      temperature: 0,
      maxTokens: 64
    }));
    if (!result.ok) return fail(`沉思档请求失败:${result.message}`);
    if (!result.text.trim()) return fail("沉思档返回空文本");
    return evidence(result) ?? fail("thinking self-test 证据无效");
  } catch (err) {
    return fail(redactSecrets(String(err instanceof Error ? err.message : err).slice(0, 200)));
  }
}

// ---------- 扫描响应防 key 泄露(测试用) ----------

export function responseContainsSecretValue(payload: unknown, secrets: string[]): boolean {
  const s = JSON.stringify(payload);
  for (const secret of secrets) {
    if (secret.length >= 8 && s.includes(secret)) return true;
  }
  return false;
}

export interface ConfirmCliCapabilityResult {
  ok: boolean;
  name: CliName;
  auth: CliAuthStatus;
  confirmed: boolean;
  observedModel?: string;
  detail?: string;
  billing?: CliCapability["billing"];
}

/** unknown 恢复路径:受控一发自检。成功则 auth=logged_in(confirmed)。inventory_only 只探测不接线。 */
export async function confirmCliCapability(input: {
  name: string;
  signal?: AbortSignal;
  audit?: AuditSink;
}): Promise<ConfirmCliCapabilityResult> {
  if (!isCliName(input.name)) {
    return { ok: false, name: "gemini", auth: "unknown", confirmed: false, detail: "未知 CLI 名" };
  }
  const name = input.name;
  const capability = await probeCliCapability(name, {
    bypassCache: true,
    ...(input.signal ? { signal: input.signal } : {})
  });
  if (!capability.found) {
    rememberProbedCliCapability(capability);
    return {
      ok: false,
      name,
      auth: "not_found",
      confirmed: false,
      detail: capability.auth.detail ?? "未找到该 CLI",
      ...(capability.billing ? { billing: capability.billing } : {})
    };
  }
  if (capability.provider === null || !capability.path || !capability.binaryDigest) {
    rememberProbedCliCapability(capability);
    return {
      ok: true,
      name,
      auth: capability.auth.status,
      confirmed: false,
      detail: "可识别,暂不能当模型供给",
      ...(capability.billing ? { billing: capability.billing } : {})
    };
  }
  const model = capability.models[0]?.id ?? "";
  const expectedFamily = (model && familyFromModelName(model)) || "unknown";
  const llm = createByoaProvider({
    provider: capability.provider,
    model,
    expectedFamily,
    familyOf: familyFromModelName,
    profile: "default",
    audit: input.audit ?? { record: () => ({ id: "aud_cli_confirm" }) },
    binaryPath: capability.path,
    binaryIdentity: { path: capability.path, digest: capability.binaryDigest },
    wallTimeoutMs: 90_000,
    idleTimeoutMs: 45_000
  });
  const result = await llm.chat(
    {
      messages: [{ role: "user", content: "Reply with exactly pong. Do not read files or run commands." }],
      temperature: 0,
      maxTokens: 32
    },
    input.signal
  );
  if (result.ok) {
    rememberProbedCliCapability({
      ...capability,
      auth: {
        ...capability.auth,
        status: "logged_in",
        detail: "受控一发成功"
      },
      billing: capability.billing ?? { provenance: "unknown" }
    });
    return {
      ok: true,
      name,
      auth: "logged_in",
      confirmed: true,
      ...(result.observedModel ? { observedModel: result.observedModel } : {}),
      detail: "受控一发成功",
      billing: capability.billing ?? { provenance: "unknown" }
    };
  }
  const msg = result.message.toLowerCase();
  const notLogged = /not logged|login|unauth|credential|oauth|sign in/u.test(msg);
  rememberProbedCliCapability({
    ...capability,
    auth: {
      ...capability.auth,
      status: notLogged ? "not_logged_in" : capability.auth.status
    }
  });
  return {
    ok: false,
    name,
    auth: notLogged ? "not_logged_in" : capability.auth.status,
    confirmed: false,
    detail: redactCliError(result.message.slice(0, 200)),
    ...(capability.billing ? { billing: capability.billing } : {})
  };
}
