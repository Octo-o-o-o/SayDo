// T18a CLI runtime 登记:setup 真实 self-test 通过后固化槽位 binding 与二进制身份。
// 文件不含 token/prompt;resolver 每次按 binding digest 命中，provider 每次调用前重验 binary digest。

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { isWiredCliProvider, jcsDigest, type ModelBinding } from "@saydo/contracts";
import type { AuditSink } from "../obs/audit.js";
import type { Db } from "../storage/db.js";
import { familyFromModelName } from "./family.js";

export type CliRuntimeSlot = "dialog" | "thinking" | "cheap" | "evaluator";
export type CliRuntimeProvider =
  | "codex_cli"
  | "claude_cli"
  | "cursor_cli"
  | "grok_cli"
  | "gemini_cli"
  | "qwen_cli"
  | "copilot_cli";

export interface CliSlotRegistration {
  slot: CliRuntimeSlot;
  provider: CliRuntimeProvider;
  bindingDigest: string;
  binaryPath: string;
  binaryDigest: string;
  expectedFamily: string;
  requestedModel?: string;
  observedModel?: string;
  observedModelSource: "stream" | "verified_binary_default";
  observedModelExempted: boolean;
  testedAt: string;
  receipt: {
    auditId: string;
    evidenceDigest: string;
  };
}

export interface CliRuntimeRegistry {
  version: 3;
  registrations: Record<string, CliSlotRegistration>;
  activation?: {
    configDigest?: string;
    envDigest?: string;
  };
}

export type CliRuntimeReceiptIndex = ReadonlyMap<string, string>;

type CliRegistrationEvidence = Omit<CliSlotRegistration, "receipt">;

function emptyRegistry(): CliRuntimeRegistry {
  return { version: 3, registrations: {} };
}

function registrationKey(slot: CliRuntimeSlot, bindingDigest: string): string {
  return `${slot}:${bindingDigest}`;
}

function registrationEvidenceValid(registration: {
  provider: CliRuntimeProvider;
  expectedFamily: string;
  requestedModel?: string;
  observedModel?: string;
  observedModelSource: "stream" | "verified_binary_default";
  observedModelExempted: boolean;
}): boolean {
  if (registration.observedModel !== undefined && registration.observedModel.trim() === "") return false;
  if (registration.requestedModel !== undefined && registration.requestedModel.trim() === "") return false;
  if (
    registration.observedModel !== undefined &&
    familyFromModelName(registration.observedModel) !== registration.expectedFamily
  ) {
    return false;
  }
  if (
    registration.requestedModel !== undefined &&
    familyFromModelName(registration.requestedModel) !== registration.expectedFamily
  ) {
    return false;
  }
  if (registration.observedModelSource === "stream") {
    return registration.observedModel !== undefined && registration.observedModelExempted === false;
  }
  const fixedFamily = registration.provider === "codex_cli" ? "gpt" : registration.provider === "claude_cli" ? "claude" : null;
  return (
    registration.observedModel === undefined &&
    registration.observedModelExempted === true &&
    fixedFamily === registration.expectedFamily
  );
}

function registrationEvidence(registration: CliRegistrationEvidence): Record<string, unknown> {
  return {
    slot: registration.slot,
    provider: registration.provider,
    bindingDigest: registration.bindingDigest,
    binaryPath: registration.binaryPath,
    binaryDigest: registration.binaryDigest,
    expectedFamily: registration.expectedFamily,
    requestedModel: registration.requestedModel ?? null,
    observedModel: registration.observedModel ?? null,
    observedModelSource: registration.observedModelSource,
    observedModelExempted: registration.observedModelExempted,
    testedAt: registration.testedAt
  };
}

function registrationEvidenceDigest(registration: CliRegistrationEvidence): string {
  return jcsDigest(registrationEvidence(registration));
}

function issueRegistrationReceipt(
  evidence: CliRegistrationEvidence,
  audit: AuditSink,
  target: "active" | "pending",
  activation?: CliRuntimeRegistry["activation"],
  promotedFromAuditId?: string
): CliSlotRegistration["receipt"] {
  const evidenceDigest = registrationEvidenceDigest(evidence);
  const auditId = audit.record({
    actor: "daemon",
    action: "config.cli_runtime_registered",
    refDigest: evidenceDigest,
    meta: {
      ...registrationEvidence(evidence),
      selfTestStatus: "ok",
      target,
      activationConfigDigest: activation?.configDigest ?? null,
      activationEnvDigest: activation?.envDigest ?? null,
      promotedFromAuditId: promotedFromAuditId ?? null
    }
  }).id;
  return { auditId, evidenceDigest };
}

export function shouldPromotePendingCliRuntime(saydoHome: string, status: {
  config: { ok: boolean; promoted: boolean };
  env: { ok: boolean; promoted: boolean };
}): boolean {
  if (!status.config.ok || !status.env.ok) return false;
  const activation = loadPendingCliRuntimeRegistry(saydoHome).activation;
  if (!activation || (!activation.configDigest && !activation.envDigest)) return false;
  const matches = (baseName: string, digest: string | undefined): boolean => {
    if (!digest) return true;
    try {
      return createHash("sha256").update(readFileSync(join(saydoHome, baseName))).digest("hex") === digest;
    } catch {
      return false;
    }
  };
  return matches("config.toml", activation.configDigest) && matches(".env", activation.envDigest);
}

/** staged self-test 凭据必须绑定当前两份 pending 文件内容,文件被改写后立即失效。 */
export function pendingCliRuntimeActivationMatches(
  saydoHome: string,
  activation: CliRuntimeRegistry["activation"] = loadPendingCliRuntimeRegistry(saydoHome).activation,
  allowActiveFallback = false
): boolean {
  if (!activation || (!activation.configDigest && !activation.envDigest)) return false;
  const matchesPending = (baseName: string, digest: string | undefined): boolean => {
    const pendingPath = join(saydoHome, `${baseName}.pending`);
    const path = existsSync(pendingPath)
      ? pendingPath
      : allowActiveFallback
        ? join(saydoHome, baseName)
        : pendingPath;
    if (!existsSync(path)) return digest === undefined;
    if (!digest) return false;
    try {
      return createHash("sha256").update(readFileSync(path)).digest("hex") === digest;
    } catch {
      return false;
    }
  };
  return matchesPending("config.toml", activation.configDigest) && matchesPending(".env", activation.envDigest);
}

export function cliBinaryRegistrationMatches(registration: CliSlotRegistration): boolean {
  try {
    const digest = createHash("sha256").update(readFileSync(registration.binaryPath)).digest("hex");
    return digest === registration.binaryDigest;
  } catch {
    return false;
  }
}

export function cliRuntimePath(saydoHome: string): string {
  return join(saydoHome, "cli-runtime.json");
}

export function cliRuntimePendingPath(saydoHome: string): string {
  return join(saydoHome, "cli-runtime.pending.json");
}

export function cliBindingDigest(binding: ModelBinding): string {
  return jcsDigest(binding);
}

function parseRegistration(slot: CliRuntimeSlot, value: unknown): CliSlotRegistration | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  const provider = row["provider"];
  const source = row["observedModelSource"];
  if (
    row["slot"] !== slot ||
    (typeof provider !== "string" || !isWiredCliProvider(provider)) ||
    typeof row["bindingDigest"] !== "string" ||
    !/^sha256:[a-f0-9]{64}$/.test(row["bindingDigest"]) ||
    typeof row["binaryPath"] !== "string" ||
    !isAbsolute(row["binaryPath"]) ||
    typeof row["binaryDigest"] !== "string" ||
    !/^[a-f0-9]{64}$/.test(row["binaryDigest"]) ||
    typeof row["expectedFamily"] !== "string" ||
    (source !== "stream" && source !== "verified_binary_default") ||
    typeof row["observedModelExempted"] !== "boolean" ||
    typeof row["testedAt"] !== "string" ||
    !Number.isFinite(Date.parse(row["testedAt"])) ||
    !row["receipt"] ||
    typeof row["receipt"] !== "object" ||
    Array.isArray(row["receipt"])
  ) {
    return undefined;
  }
  const receipt = row["receipt"] as Record<string, unknown>;
  if (
    typeof receipt["auditId"] !== "string" ||
    !/^aud_[A-Za-z0-9]+$/.test(receipt["auditId"]) ||
    typeof receipt["evidenceDigest"] !== "string" ||
    !/^sha256:[a-f0-9]{64}$/.test(receipt["evidenceDigest"])
  ) {
    return undefined;
  }
  if (row["requestedModel"] !== undefined && typeof row["requestedModel"] !== "string") return undefined;
  if (row["observedModel"] !== undefined && typeof row["observedModel"] !== "string") return undefined;
  const registration: CliSlotRegistration = {
    slot,
    provider,
    bindingDigest: row["bindingDigest"],
    binaryPath: row["binaryPath"],
    binaryDigest: row["binaryDigest"],
    expectedFamily: row["expectedFamily"],
    ...(typeof row["requestedModel"] === "string" ? { requestedModel: row["requestedModel"] } : {}),
    ...(typeof row["observedModel"] === "string" ? { observedModel: row["observedModel"] } : {}),
    observedModelSource: source,
    observedModelExempted: row["observedModelExempted"],
    testedAt: row["testedAt"],
    receipt: {
      auditId: receipt["auditId"],
      evidenceDigest: receipt["evidenceDigest"]
    }
  };
  return registrationEvidenceValid(registration) && registrationEvidenceDigest(registration) === registration.receipt.evidenceDigest
    ? registration
    : undefined;
}

function loadRegistry(path: string): CliRuntimeRegistry {
  if (!existsSync(path)) return emptyRegistry();
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    const registry = emptyRegistry();
    if (raw["version"] === 3 && raw["registrations"] && typeof raw["registrations"] === "object") {
      for (const [key, value] of Object.entries(raw["registrations"] as Record<string, unknown>)) {
        const slot = key.split(":", 1)[0];
        if (slot !== "dialog" && slot !== "thinking" && slot !== "cheap" && slot !== "evaluator") continue;
        const parsed = parseRegistration(slot, value);
        if (parsed && key === registrationKey(slot, parsed.bindingDigest)) registry.registrations[key] = parsed;
      }
      if (raw["activation"] && typeof raw["activation"] === "object" && !Array.isArray(raw["activation"])) {
        const activation = raw["activation"] as Record<string, unknown>;
        const configDigest = activation["configDigest"];
        const envDigest = activation["envDigest"];
        if (
          (configDigest === undefined || (typeof configDigest === "string" && /^[a-f0-9]{64}$/.test(configDigest))) &&
          (envDigest === undefined || (typeof envDigest === "string" && /^[a-f0-9]{64}$/.test(envDigest))) &&
          (configDigest !== undefined || envDigest !== undefined)
        ) {
          registry.activation = {
            ...(typeof configDigest === "string" ? { configDigest } : {}),
            ...(typeof envDigest === "string" ? { envDigest } : {})
          };
        }
      }
      return registry;
    }
    // version 1/2 没有不可变 audit receipt，升级后必须重跑真实 self-test，不能兼容武装。
    return emptyRegistry();
  } catch {
    return emptyRegistry();
  }
}

export function loadCliRuntimeRegistry(saydoHome: string): CliRuntimeRegistry {
  return loadRegistry(cliRuntimePath(saydoHome));
}

export function loadPendingCliRuntimeRegistry(saydoHome: string): CliRuntimeRegistry {
  return loadRegistry(cliRuntimePendingPath(saydoHome));
}

function registryPath(saydoHome: string, target: "active" | "pending"): string {
  return target === "active" ? cliRuntimePath(saydoHome) : cliRuntimePendingPath(saydoHome);
}

function writeRegistry(saydoHome: string, registry: CliRuntimeRegistry, target: "active" | "pending"): void {
  const path = registryPath(saydoHome, target);
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(registry, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(temporary, path);
}

function activationEqual(
  left: CliRuntimeRegistry["activation"],
  right: CliRuntimeRegistry["activation"]
): boolean {
  return left?.configDigest === right?.configDigest && left?.envDigest === right?.envDigest;
}

export function preparePendingCliRuntimeActivation(
  saydoHome: string,
  activation: NonNullable<CliRuntimeRegistry["activation"]>
): void {
  if (!activation.configDigest && !activation.envDigest) {
    throw new Error("staged CLI runtime 登记要求 config/env 激活 digest");
  }
  const current = loadPendingCliRuntimeRegistry(saydoHome);
  if (activationEqual(current.activation, activation)) return;
  writeRegistry(saydoHome, { version: 3, registrations: {}, activation }, "pending");
}

export function registerCliSelfTest(
  saydoHome: string,
  binding: ModelBinding,
  registration: Omit<CliSlotRegistration, "bindingDigest" | "receipt">,
  audit: AuditSink,
  target: "active" | "pending" = "active",
  activation?: CliRuntimeRegistry["activation"]
): CliSlotRegistration {
  if (!isAbsolute(registration.binaryPath) || !/^[a-f0-9]{64}$/.test(registration.binaryDigest)) {
    throw new Error("CLI runtime 登记要求绝对路径与 SHA-256 digest");
  }
  if (!registrationEvidenceValid(registration)) {
    throw new Error("CLI runtime observedModel 四字段证据不合法");
  }
  if (target === "pending" && (!activation || (!activation.configDigest && !activation.envDigest))) {
    throw new Error("staged CLI runtime 登记要求 config/env 激活 digest");
  }
  if (target === "pending" && activation) preparePendingCliRuntimeActivation(saydoHome, activation);
  const evidence: CliRegistrationEvidence = { ...registration, bindingDigest: cliBindingDigest(binding) };
  const row: CliSlotRegistration = {
    ...evidence,
    receipt: issueRegistrationReceipt(evidence, audit, target, activation)
  };
  const registry = target === "active" ? loadCliRuntimeRegistry(saydoHome) : loadPendingCliRuntimeRegistry(saydoHome);
  const key = registrationKey(registration.slot, row.bindingDigest);
  writeRegistry(
    saydoHome,
    {
      version: 3,
      registrations: { ...registry.registrations, [key]: row },
      ...(target === "pending" && activation ? { activation } : {})
    },
    target
  );
  return row;
}

export function clearCliSelfTest(
  saydoHome: string,
  slot: CliRuntimeSlot,
  binding?: ModelBinding,
  target: "active" | "pending" = "active"
): void {
  const path = registryPath(saydoHome, target);
  const registry = target === "active" ? loadCliRuntimeRegistry(saydoHome) : loadPendingCliRuntimeRegistry(saydoHome);
  if (!existsSync(path)) return;
  const registrations = { ...registry.registrations };
  if (binding) delete registrations[registrationKey(slot, cliBindingDigest(binding))];
  else {
    for (const [key, registration] of Object.entries(registrations)) {
      if (registration.slot === slot) delete registrations[key];
    }
  }
  writeRegistry(
    saydoHome,
    { version: 3, registrations, ...(target === "pending" && registry.activation ? { activation: registry.activation } : {}) },
    target
  );
}

/** 启动时仅把已晋升 active config 命中的 staged self-test 证据并入活动登记。 */
export function promotePendingCliRuntime(
  saydoHome: string,
  bindings: Record<Exclude<CliRuntimeSlot, "dialog">, ModelBinding> & { dialog?: ModelBinding },
  audit: AuditSink,
  pendingReceipts: CliRuntimeReceiptIndex,
  expectedActivation: CliRuntimeRegistry["activation"],
  options: { cleanupPending?: boolean } = {}
): {
  promoted: number;
  promotedBindings: Array<{ slot: CliRuntimeSlot; bindingDigest: string; binaryDigest: string }>;
  cleanupError?: string;
} {
  const pendingPath = cliRuntimePendingPath(saydoHome);
  if (!existsSync(pendingPath)) return { promoted: 0, promotedBindings: [] };
  const active = loadCliRuntimeRegistry(saydoHome);
  const pending = loadPendingCliRuntimeRegistry(saydoHome);
  if (!activationEqual(pending.activation, expectedActivation)) return { promoted: 0, promotedBindings: [] };
  if (!pendingCliRuntimeActivationMatches(saydoHome, pending.activation, true)) {
    return { promoted: 0, promotedBindings: [] };
  }
  const candidates: Array<{ slot: CliRuntimeSlot; row: CliSlotRegistration }> = [];
  for (const slot of ["dialog", "thinking", "cheap", "evaluator"] as const) {
    const binding = bindings[slot];
    if (!binding || typeof binding === "string" || binding.provider === "api") continue;
    const key = registrationKey(slot, cliBindingDigest(binding));
    const row = pending.registrations[key];
    if (
      !row ||
      pendingReceipts.get(row.receipt.auditId) !== row.receipt.evidenceDigest ||
      registrationEvidenceDigest(row) !== row.receipt.evidenceDigest ||
      !cliBinaryRegistrationMatches(row)
    ) {
      // activation 是全候选单元:缺一时不得发布成功子集或删除 staged 证据。
      return { promoted: 0, promotedBindings: [] };
    }
    candidates.push({ slot, row });
  }
  const registrations = { ...active.registrations };
  let promoted = 0;
  const promotedBindings: Array<{ slot: CliRuntimeSlot; bindingDigest: string; binaryDigest: string }> = [];
  for (const { slot, row } of candidates) {
    const key = registrationKey(slot, row.bindingDigest);
    const { receipt: pendingReceipt, ...evidence } = row;
    const activeRow: CliSlotRegistration = {
      ...evidence,
      receipt: issueRegistrationReceipt(evidence, audit, "active", pending.activation, pendingReceipt.auditId)
    };
    if (JSON.stringify(registrations[key]) === JSON.stringify(activeRow)) continue;
    registrations[key] = activeRow;
    promoted += 1;
    promotedBindings.push({ slot, bindingDigest: row.bindingDigest, binaryDigest: row.binaryDigest });
  }
  if (promoted > 0) writeRegistry(saydoHome, { version: 3, registrations }, "active");
  if (options.cleanupPending === false) return { promoted, promotedBindings };
  try {
    unlinkSync(pendingPath);
    return { promoted, promotedBindings };
  } catch (err) {
    return {
      promoted,
      promotedBindings,
      cleanupError: String(err instanceof Error ? err.message : err).slice(0, 200)
    };
  }
}

export function registeredCliSlot(
  registry: CliRuntimeRegistry | undefined,
  slot: CliRuntimeSlot,
  binding: ModelBinding,
  receipts?: CliRuntimeReceiptIndex
): CliSlotRegistration | undefined {
  const digest = cliBindingDigest(binding);
  const row = registry?.registrations[registrationKey(slot, digest)];
  if (
    !row ||
    row.bindingDigest !== digest ||
    receipts?.get(row.receipt.auditId) !== row.receipt.evidenceDigest ||
    registrationEvidenceDigest(row) !== row.receipt.evidenceDigest ||
    !cliBinaryRegistrationMatches(row)
  ) {
    return undefined;
  }
  const provider = typeof binding === "string" ? "api" : binding.provider;
  return provider === row.provider ? row : undefined;
}

/** 从不可变 SQLite audit_log 重建指定发布目标可接受的 self-test receipt 索引。 */
export function loadCliRuntimeReceiptIndex(
  db: Db,
  target: "active" | "pending" = "active",
  activation?: CliRuntimeRegistry["activation"]
): Map<string, string> {
  const out = new Map<string, string>();
  if (target === "pending" && (!activation || (!activation.configDigest && !activation.envDigest))) return out;
  const rows = db
    .prepare(
      `SELECT id, ref_digest, meta_json
         FROM audit_log
        WHERE actor='daemon' AND action='config.cli_runtime_registered' AND ref_digest IS NOT NULL`
    )
    .all() as Array<{ id: string; ref_digest: string; meta_json: string | null }>;
  for (const row of rows) {
    if (!/^aud_[A-Za-z0-9]+$/.test(row.id) || !/^sha256:[a-f0-9]{64}$/.test(row.ref_digest) || !row.meta_json) continue;
    try {
      const meta = JSON.parse(row.meta_json) as Record<string, unknown>;
      if (meta["selfTestStatus"] !== "ok" || meta["target"] !== target) continue;
      if (
        target === "pending" &&
        (meta["activationConfigDigest"] !== (activation?.configDigest ?? null) ||
          meta["activationEnvDigest"] !== (activation?.envDigest ?? null))
      ) {
        continue;
      }
      const slot = meta["slot"];
      const provider = meta["provider"];
      const source = meta["observedModelSource"];
      if (
        (slot !== "dialog" && slot !== "thinking" && slot !== "cheap" && slot !== "evaluator") ||
        (typeof provider !== "string" || !isWiredCliProvider(provider)) ||
        (source !== "stream" && source !== "verified_binary_default") ||
        typeof meta["bindingDigest"] !== "string" ||
        typeof meta["binaryPath"] !== "string" ||
        typeof meta["binaryDigest"] !== "string" ||
        typeof meta["expectedFamily"] !== "string" ||
        typeof meta["observedModelExempted"] !== "boolean" ||
        typeof meta["testedAt"] !== "string"
      ) {
        continue;
      }
      const evidence: CliRegistrationEvidence = {
        slot,
        provider,
        bindingDigest: meta["bindingDigest"],
        binaryPath: meta["binaryPath"],
        binaryDigest: meta["binaryDigest"],
        expectedFamily: meta["expectedFamily"],
        ...(typeof meta["requestedModel"] === "string" ? { requestedModel: meta["requestedModel"] } : {}),
        ...(typeof meta["observedModel"] === "string" ? { observedModel: meta["observedModel"] } : {}),
        observedModelSource: source,
        observedModelExempted: meta["observedModelExempted"],
        testedAt: meta["testedAt"]
      };
      if (!registrationEvidenceValid(evidence) || registrationEvidenceDigest(evidence) !== row.ref_digest) continue;
      out.set(row.id, row.ref_digest);
    } catch {
      // 损坏/伪造的审计元数据不产生可用 receipt。
    }
  }
  return out;
}
