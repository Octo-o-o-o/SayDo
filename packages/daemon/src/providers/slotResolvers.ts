import type { ModelBinding } from "@saydo/contracts";
import { projectUntrustedFailureText } from "@saydo/platform";
import { isAbsolute } from "node:path";
import type { CliCapability } from "../config/cliCapability.js";
import {
  cliBindingDigest,
  registeredCliSlot,
  type CliRuntimeProvider,
  type CliRuntimeReceiptIndex,
  type CliRuntimeRegistry,
  type CliRuntimeSlot
} from "../config/cliRuntime.js";
import type { SaydoConfig } from "../config/types.js";
import { familyFromModelName } from "../config/family.js";
import { evaluatorFamilyContext, resolveFamily } from "../config/validate.js";
import type { AuditSink } from "../obs/audit.js";
import { createByoaProvider } from "./byoa/provider.js";
import type { CageProvider } from "./byoa/cage.js";
import type { LlmProvider } from "./types.js";
import { resolveApiProvider } from "./resolve.js";


export type EffectiveProviderState = "active" | "fallback_dialog" | "unarmed";
export type EffectiveProviderReason =
  | "cli_self_test_required"
  | "cli_self_test_failed"
  | "provider_unavailable"
  | "same_family_blocked"
  | "isolation_ack_required"
  | "recovery_only";

export interface ProviderResolution {
  provider: LlmProvider | null;
  effective: EffectiveProviderState;
  mode?: "realtime" | "oneshot";
  reason?: EffectiveProviderReason;
  fallbackTo?: "dialog";
}

export interface ResolverLog {
  warn(message: string, meta?: Record<string, unknown>): void;
}

export interface SubscriptionInvocation {
  provider: CageProvider;
  model: string;
  requests: number;
  provenance?: "subscription" | "external_api" | "unknown";
}

export interface CliResolverContext {
  registry?: CliRuntimeRegistry;
  receipts?: CliRuntimeReceiptIndex;
  onSubscriptionInvocation?: (slot: CliRuntimeSlot, invocation: SubscriptionInvocation) => void;
}

const noLog: ResolverLog = { warn: () => {} };
const noAudit: AuditSink = { record: () => ({ id: "aud_noop" }) };
const CLI_PROVIDERS = new Set<CliRuntimeProvider>([
  "codex_cli",
  "claude_cli",
  "cursor_cli",
  "grok_cli",
  "gemini_cli",
  "qwen_cli",
  "copilot_cli"
]);

function bindingProvider(binding: ModelBinding): string {
  return typeof binding === "string" ? "api" : binding.provider;
}

function bindingModel(binding: ModelBinding): string | undefined {
  return typeof binding === "string" ? binding : "model" in binding ? binding.model : undefined;
}

function apiProvider(
  slot: "dialog" | "thinking" | "cheap" | "evaluator",
  cfg: SaydoConfig,
  binding: ModelBinding,
  env: Record<string, string | undefined>,
  audit?: AuditSink
): LlmProvider {
  return resolveApiProvider(binding, cfg.providers?.api, env, "OPENAI_API_KEY", audit ? { slot, audit } : undefined);
}

function makeCliProvider(args: {
  slot: CliRuntimeSlot;
  cfg: SaydoConfig;
  binding: ModelBinding;
  env: Record<string, string | undefined>;
  binaryPath: string;
  binaryDigest: string;
  audit?: AuditSink;
  context?: CliResolverContext;
  log?: ResolverLog;
}): { provider: LlmProvider; expectedFamily: string } {
  const provider = bindingProvider(args.binding);
  if (!CLI_PROVIDERS.has(provider as CliRuntimeProvider)) throw new Error(`不是 CLI binding:${provider}`);
  const family = resolveFamily(args.slot, args.binding, args.cfg.providers?.api);
  if ("violation" in family) throw new Error(family.violation.message);
  const model = bindingModel(args.binding) ?? "";
  const reasoning =
    typeof args.binding !== "string" &&
    args.binding.provider === "codex_cli" &&
    "reasoning" in args.binding &&
    typeof args.binding.reasoning === "string"
      ? args.binding.reasoning
      : undefined;
  return {
    expectedFamily: family.family,
    provider: createByoaProvider({
      provider: provider as CageProvider,
      model,
      ...(reasoning ? { reasoning } : {}),
      expectedFamily: family.family,
      familyOf: familyFromModelName,
      profile: args.cfg.models.profile,
      audit: args.audit ?? noAudit,
      binaryPath: args.binaryPath,
      binaryIdentity: {
        path: args.binaryPath,
        digest: args.binaryDigest
      },
      passEnv: args.env,
      slot: args.slot,
      ...(args.log ? { log: args.log } : {}),
      ...(args.context?.onSubscriptionInvocation
        ? {
            onSubscriptionInvocation: (invocation) =>
              args.context!.onSubscriptionInvocation!(args.slot, invocation)
          }
        : {})
    })
  };
}

function registeredProvider(
  slot: CliRuntimeSlot,
  cfg: SaydoConfig,
  binding: ModelBinding,
  env: Record<string, string | undefined>,
  audit: AuditSink | undefined,
  context: CliResolverContext | undefined,
  log?: ResolverLog
): LlmProvider | null {
  const provider = bindingProvider(binding);
  const bindingDigest = cliBindingDigest(binding);
  const registration = registeredCliSlot(context?.registry, slot, binding, context?.receipts);
  if (!registration) {
    audit?.record({
      actor: "daemon",
      action: "provider.cli_runtime_rejected",
      refDigest: bindingDigest,
      meta: {
        slot,
        provider,
        reason: "cli_self_test_required",
        bindingDigest
      }
    });
    return null;
  }
  const resolved = makeCliProvider({
    slot,
    cfg,
    binding,
    env,
    binaryPath: registration.binaryPath,
    binaryDigest: registration.binaryDigest,
    ...(audit ? { audit } : {}),
    ...(context ? { context } : {}),
    ...(log ? { log } : {})
  });
  if (registration.expectedFamily !== resolved.expectedFamily) {
    audit?.record({
      actor: "daemon",
      action: "provider.cli_runtime_rejected",
      refDigest: bindingDigest,
      meta: {
        slot,
        provider,
        reason: "expected_family_mismatch",
        bindingDigest,
        registeredFamily: registration.expectedFamily,
        expectedFamily: resolved.expectedFamily
      }
    });
    return null;
  }
  return resolved.provider;
}

/** setup/test 专用:绕过“尚未登记”门，但仍要求能力探测给出绝对路径与内容 digest。 */
export function createCliSelfTestProvider(args: {
  slot: CliRuntimeSlot;
  cfg: SaydoConfig;
  binding: ModelBinding;
  capability: CliCapability;
  env: Record<string, string | undefined>;
  audit?: AuditSink;
  context?: CliResolverContext;
  log?: ResolverLog;
}): { provider: LlmProvider; expectedFamily: string } {
  const configured = bindingProvider(args.binding);
  if (args.capability.provider !== configured) throw new Error("CLI 探测结果与槽位 provider 不一致");
  if (
    !args.capability.found ||
    !args.capability.path ||
    !isAbsolute(args.capability.path) ||
    !args.capability.binaryDigest
  ) {
    throw new Error("CLI 缺少可登记的绝对路径或内容 digest");
  }
  return makeCliProvider({
    slot: args.slot,
    cfg: args.cfg,
    binding: args.binding,
    env: args.env,
    binaryPath: args.capability.path,
    binaryDigest: args.capability.binaryDigest,
    ...(args.audit ? { audit: args.audit } : {}),
    ...(args.context ? { context: args.context } : {}),
    ...(args.log ? { log: args.log } : {})
  });
}

export function resolveDialogProvider(
  cfg: SaydoConfig,
  env: Record<string, string | undefined>,
  log: ResolverLog = noLog,
  audit?: AuditSink,
  context?: CliResolverContext
): ProviderResolution {
  const binding = cfg.models.dialog;
  const provider = bindingProvider(binding);
  if (CLI_PROVIDERS.has(provider as CliRuntimeProvider)) {
    try {
      const resolved = registeredProvider("dialog", cfg, binding, env, audit, context, log);
      return resolved
        ? { provider: resolved, effective: "active", mode: "oneshot" }
        : { provider: null, effective: "unarmed", reason: "cli_self_test_required", mode: "oneshot" };
    } catch (err) {
      log.warn("dialog CLI self-test registration rejected", { error: projectUntrustedFailureText(err, "provider_error").slice(0, 160) });
      return { provider: null, effective: "unarmed", reason: "cli_self_test_failed", mode: "oneshot" };
    }
  }
  if (provider !== "api") return { provider: null, effective: "unarmed", reason: "provider_unavailable", mode: "realtime" };
  try {
    return { provider: apiProvider("dialog", cfg, binding, env, audit), effective: "active", mode: "realtime" };
  } catch (err) {
    log.warn("dialog provider unavailable", { error: projectUntrustedFailureText(err, "provider_error").slice(0, 160) });
    return { provider: null, effective: "unarmed", reason: "provider_unavailable", mode: "realtime" };
  }
}

function fallbackDialog(
  slot: "thinking" | "cheap",
  dialogProvider: LlmProvider | null,
  reason: EffectiveProviderReason,
  log: ResolverLog,
  meta: Record<string, unknown>
): ProviderResolution {
  log.warn(`${slot} provider falling back to dialog`, meta);
  return dialogProvider
    ? { provider: dialogProvider, effective: "fallback_dialog", reason, fallbackTo: "dialog" }
    : { provider: null, effective: "unarmed", reason };
}

export function resolveThinkingProvider(
  cfg: SaydoConfig,
  env: Record<string, string | undefined>,
  dialogProvider: LlmProvider | null,
  log: ResolverLog = noLog,
  binding: ModelBinding = cfg.models.thinking,
  audit?: AuditSink,
  context?: CliResolverContext
): ProviderResolution {
  const provider = bindingProvider(binding);
  if (CLI_PROVIDERS.has(provider as CliRuntimeProvider)) {
    try {
      const resolved = registeredProvider("thinking", cfg, binding, env, audit, context, log);
      return resolved
        ? { provider: resolved, effective: "active" }
        : fallbackDialog("thinking", dialogProvider, "cli_self_test_required", log, { provider });
    } catch (err) {
      return fallbackDialog("thinking", dialogProvider, "cli_self_test_failed", log, {
        provider,
        error: projectUntrustedFailureText(err, "provider_error").slice(0, 160)
      });
    }
  }
  if (provider !== "api") return fallbackDialog("thinking", dialogProvider, "provider_unavailable", log, { provider });
  try {
    return { provider: apiProvider("thinking", cfg, binding, env, audit), effective: "active" };
  } catch (err) {
    return fallbackDialog("thinking", dialogProvider, "provider_unavailable", log, {
      error: projectUntrustedFailureText(err, "provider_error").slice(0, 160)
    });
  }
}

export function resolveDrafterProvider(
  cfg: SaydoConfig,
  env: Record<string, string | undefined>,
  dialogProvider: LlmProvider | null,
  log: ResolverLog = noLog,
  audit?: AuditSink,
  context?: CliResolverContext
): ProviderResolution {
  const binding = cfg.models.cheap;
  const provider = bindingProvider(binding);
  if (CLI_PROVIDERS.has(provider as CliRuntimeProvider)) {
    try {
      const resolved = registeredProvider("cheap", cfg, binding, env, audit, context, log);
      return resolved
        ? { provider: resolved, effective: "active" }
        : fallbackDialog("cheap", dialogProvider, "cli_self_test_required", log, { provider });
    } catch (err) {
      return fallbackDialog("cheap", dialogProvider, "cli_self_test_failed", log, {
        provider,
        error: projectUntrustedFailureText(err, "provider_error").slice(0, 160)
      });
    }
  }
  if (provider !== "api") return fallbackDialog("cheap", dialogProvider, "provider_unavailable", log, { provider });
  try {
    return { provider: apiProvider("cheap", cfg, binding, env, audit), effective: "active" };
  } catch (err) {
    return fallbackDialog("cheap", dialogProvider, "provider_unavailable", log, {
      error: projectUntrustedFailureText(err, "provider_error").slice(0, 160)
    });
  }
}

export function resolveEvaluatorProvider(
  cfg: SaydoConfig,
  env: Record<string, string | undefined>,
  log: ResolverLog = noLog,
  audit?: AuditSink,
  context?: CliResolverContext
): ProviderResolution {
  const binding = cfg.models.evaluator;
  const provider = bindingProvider(binding);
  if (CLI_PROVIDERS.has(provider as CliRuntimeProvider)) {
    if (cfg.models.evaluator_same_family_ack !== true) {
      return { provider: null, effective: "unarmed", reason: "same_family_blocked" };
    }
    if (cfg.models.evaluator_isolation_ack !== true) {
      return { provider: null, effective: "unarmed", reason: "isolation_ack_required" };
    }
    try {
      const resolved = registeredProvider("evaluator", cfg, binding, env, audit, context, log);
      return resolved
        ? { provider: resolved, effective: "active" }
        : { provider: null, effective: "unarmed", reason: "cli_self_test_required" };
    } catch (err) {
      log.warn("evaluator CLI self-test registration rejected", { error: projectUntrustedFailureText(err, "provider_error").slice(0, 160) });
      return { provider: null, effective: "unarmed", reason: "cli_self_test_failed" };
    }
  }
  if (provider !== "api") return { provider: null, effective: "unarmed", reason: "provider_unavailable" };
  const families = evaluatorFamilyContext(cfg, env);
  const thinkingBinding = cfg.models.thinking;
  if (CLI_PROVIDERS.has(bindingProvider(thinkingBinding) as CliRuntimeProvider)) {
    const thinkingRegistration = registeredCliSlot(
      context?.registry,
      "thinking",
      thinkingBinding,
      context?.receipts
    );
    if (thinkingRegistration) families.thinking = thinkingRegistration.expectedFamily;
  }
  if (
    families.evaluator &&
    (families.evaluator === families.dialog || families.evaluator === families.thinking) &&
    cfg.models.evaluator_same_family_ack !== true
  ) {
    log.warn("evaluator same-family; deep readiness pipeline unarmed", { family: families.evaluator });
    return { provider: null, effective: "unarmed", reason: "same_family_blocked" };
  }
  try {
    return { provider: apiProvider("evaluator", cfg, binding, env, audit), effective: "active" };
  } catch (err) {
    log.warn("evaluator provider unavailable; deep readiness pipeline unarmed", {
      error: projectUntrustedFailureText(err, "provider_error").slice(0, 160)
    });
    return { provider: null, effective: "unarmed", reason: "provider_unavailable" };
  }
}

export function resolveProviderProjection(
  cfg: SaydoConfig,
  env: Record<string, string | undefined>,
  log: ResolverLog = noLog,
  audit?: AuditSink,
  context?: CliResolverContext
): Record<"dialog" | "thinking" | "cheap" | "evaluator", ProviderResolution> {
  const dialog = resolveDialogProvider(cfg, env, log, audit, context);
  return {
    dialog,
    thinking: resolveThinkingProvider(cfg, env, dialog.provider, log, cfg.models.thinking, audit, context),
    cheap: resolveDrafterProvider(cfg, env, dialog.provider, log, audit, context),
    evaluator: resolveEvaluatorProvider(cfg, env, log, audit, context)
  };
}
