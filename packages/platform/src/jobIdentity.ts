/** Windows 具名 Job 与 owner/run/generation 的精确 identity。禁止 substring / 字段拼接碰撞。 */

import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute as posixIsAbsolute, join, win32 } from "node:path";
import { isObjectLike, isProxyValue, readOwnData } from "./errno.js";
import { fsyncDir, fsyncFile, type FsyncDirResult } from "./fs.js";
export { withHomeOwnerBoundary, withHomeOwnerBoundarySync } from "./homeLock.js";

export const SAYDO_JOB_SCOPE_LOCAL = "Local";
export const SAYDO_JOB_SCOPE_GLOBAL = "Global";

const IDENTITY_TOKEN = /^[A-Za-z0-9._-]+$/u;
const JOB_NAME_RE = /^(?:Local|Global)\\SayDoJob-v1-[0-9a-f]{64}$/u;

export function isSayDoIdentityToken(value: unknown): value is string {
  return typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 80 &&
    IDENTITY_TOKEN.test(value) &&
    !value.includes("\0");
}

/** 可进入 destructive recovery 的 binary：非空、无 NUL、POSIX 或 Windows 绝对路径。 */
export function isTrustedOwnerBinary(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 1 || value.includes("\0")) return false;
  return posixIsAbsolute(value) || win32.isAbsolute(value);
}

const GENERATION_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const GENERATED_COMMAND_TOKEN =
  /^saydo-child-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export function isSayDoGeneration(value: unknown): value is string {
  return typeof value === "string" &&
    value.length === 36 &&
    GENERATION_UUID.test(value) &&
    !value.includes("\0");
}

export function commandTokenForGeneration(generation: string): string {
  return `saydo-child-${generation}`;
}

/** 只接受完整 `saydo-child-<uuid>`；trim 后才合法、t/tok/token 全部 invalid。 */
export function isTrustedCommandToken(value: unknown): value is string {
  return typeof value === "string" && GENERATED_COMMAND_TOKEN.test(value) && !value.includes("\0");
}

export function commandTokenMatchesGeneration(commandToken: unknown, generation: unknown): boolean {
  return isSayDoGeneration(generation) && commandToken === commandTokenForGeneration(generation);
}

export function sayDoJobDigest(ownerInstanceId: string, runId: string, generation: string): string {
  if (!isSayDoIdentityToken(ownerInstanceId) || !isSayDoIdentityToken(runId) || !isSayDoGeneration(generation)) {
    throw new Error("saydo job identity invalid");
  }
  return createHash("sha256")
    .update(`saydo-job-v1\0${ownerInstanceId}\0${runId}\0${generation}`, "utf8")
    .digest("hex");
}

export function formatSayDoJobName(
  scope: "Local" | "Global",
  ownerInstanceId: string,
  runId: string,
  generation: string
): string {
  const digest = sayDoJobDigest(ownerInstanceId, runId, generation);
  return `${scope}\\SayDoJob-v1-${digest}`;
}

export function isSayDoJobName(value: unknown): value is string {
  return typeof value === "string" && JOB_NAME_RE.test(value);
}

export function sayDoJobNameMatchesIdentity(
  jobName: unknown,
  ownerInstanceId: unknown,
  runId: unknown,
  generation?: unknown
): boolean {
  if (
    !isSayDoIdentityToken(ownerInstanceId) ||
    !isSayDoIdentityToken(runId) ||
    !isSayDoGeneration(generation) ||
    typeof jobName !== "string"
  ) {
    return false;
  }
  return jobName === formatSayDoJobName("Local", ownerInstanceId, runId, generation) ||
    jobName === formatSayDoJobName("Global", ownerInstanceId, runId, generation);
}

export function win32JobIdentityOk(record: {
  jobName?: string;
  ownerInstanceId?: string;
  runId?: string;
  generation?: string;
}): boolean {
  return sayDoJobNameMatchesIdentity(record.jobName, record.ownerInstanceId, record.runId, record.generation);
}

function readOwnInteger(obj: object, key: string): { ok: false } | { ok: true; present: false } | { ok: true; present: true; value: number } {
  const read = readOwnData(obj, key);
  if (!read.ok) return { ok: false };
  if (!read.present) return { ok: true, present: false };
  if (typeof read.value !== "number" || !Number.isInteger(read.value)) return { ok: false };
  return { ok: true, present: true, value: read.value };
}

function readOwnOptionalString(obj: object, key: string): { ok: false } | { ok: true; value: string | undefined } {
  const read = readOwnData(obj, key);
  if (!read.ok) return { ok: false };
  if (!read.present) return { ok: true, value: undefined };
  if (typeof read.value !== "string") return { ok: false };
  return { ok: true, value: read.value };
}

export interface ParsedAgentOwner {
  version: 1;
  runId: string;
  pid: number;
  binary: string;
  processStart: string;
  // 必需：写入方（daemon executor）始终写 worktree，且 daemon 侧的 AgentOwnershipRecord
  // 也按必需字段消费。此前这里是可选，导致同一个 durable 文件被 platform 判 valid、
  // 被 daemon 判 invalid——而宽松的一方正是会据此终止 Job 的 CLI emergency reaper。
  worktree: string;
  kind: string;
  commandToken: string;
  generation: string;
  ownerPid: number;
  ownerInstanceId: string;
  jobName: string;
}

export interface ParsedRuntimeOwner {
  version: 1;
  pid: number;
  kind: string;
  binary: string;
  processStart: string;
  ownerPid: number;
  ownerInstanceId: string;
  runId: string;
  commandToken: string;
  generation: string;
  jobName: string;
}

export interface ParsedPendingRuntimeOwner {
  version: 1;
  pid: number;
  kind: string;
  binary: string;
  processStart: null;
  ownerPid: number;
  ownerInstanceId: string;
  runId: string;
  commandToken: string;
  generation: string;
  jobName: string;
}

export interface OwnerImmutableIdentity {
  version: 1;
  pid: number;
  processStart: string | null;
  ownerPid: number;
  ownerInstanceId: string;
  runId: string;
  jobName: string;
  binary: string;
  kind: string;
  commandToken: string;
  generation: string;
}

function readRequiredKind(obj: object): { ok: false } | { ok: true; value: string } {
  const kind = readOwnOptionalString(obj, "kind");
  if (!kind.ok || kind.value === undefined) return { ok: false };
  if (kind.value.trim().length < 1 || kind.value.length > 80 || kind.value.includes("\0")) return { ok: false };
  return { ok: true, value: kind.value };
}

function finishRequiredJobFields(
  obj: object,
  runId: string,
  ownerInstanceId: string
): { ok: false } | { ok: true; jobName: string; commandToken: string; generation: string } {
  const jobName = readOwnOptionalString(obj, "jobName");
  const commandToken = readOwnOptionalString(obj, "commandToken");
  const generation = readOwnOptionalString(obj, "generation");
  if (!jobName.ok || !commandToken.ok || !generation.ok) return { ok: false };
  if (!isSayDoJobName(jobName.value) || !isTrustedCommandToken(commandToken.value) || !isSayDoGeneration(generation.value)) {
    return { ok: false };
  }
  if (!commandTokenMatchesGeneration(commandToken.value, generation.value)) return { ok: false };
  if (!sayDoJobNameMatchesIdentity(jobName.value, ownerInstanceId, runId, generation.value)) return { ok: false };
  return { ok: true, jobName: jobName.value, commandToken: commandToken.value, generation: generation.value };
}

export function parseAgentOwnerRecord(
  value: unknown,
  expectedRunId: string
): { status: "invalid" } | { status: "valid"; record: ParsedAgentOwner } {
  if (!isObjectLike(value) || isProxyValue(value)) return { status: "invalid" };
  const version = readOwnInteger(value, "version");
  const runId = readOwnOptionalString(value, "runId");
  const pid = readOwnInteger(value, "pid");
  const binary = readOwnOptionalString(value, "binary");
  const processStart = readOwnOptionalString(value, "processStart");
  const worktree = readOwnOptionalString(value, "worktree");
  const ownerPid = readOwnInteger(value, "ownerPid");
  const ownerInstanceId = readOwnOptionalString(value, "ownerInstanceId");
  const kind = readRequiredKind(value);
  if (
    !version.ok || !version.present || version.value !== 1 ||
    !runId.ok || runId.value !== expectedRunId ||
    !pid.ok || !pid.present || pid.value <= 1 ||
    !binary.ok || !isTrustedOwnerBinary(binary.value) ||
    !processStart.ok || processStart.value === undefined || processStart.value.length === 0 ||
    !worktree.ok || worktree.value === undefined || worktree.value.length === 0 ||
    !ownerPid.ok || !ownerPid.present || ownerPid.value <= 0 ||
    !ownerInstanceId.ok || !isSayDoIdentityToken(ownerInstanceId.value) ||
    !kind.ok
  ) return { status: "invalid" };
  const extra = finishRequiredJobFields(value, runId.value, ownerInstanceId.value);
  if (!extra.ok) return { status: "invalid" };
  return {
    status: "valid",
    record: {
      version: 1,
      runId: runId.value,
      pid: pid.value,
      binary: binary.value,
      processStart: processStart.value,
      kind: kind.value,
      ownerPid: ownerPid.value,
      ownerInstanceId: ownerInstanceId.value,
      jobName: extra.jobName,
      commandToken: extra.commandToken,
      generation: extra.generation,
      worktree: worktree.value
    }
  };
}

function parseRuntimeOwnerCore(
  value: unknown,
  pending: boolean
): { status: "invalid" } | { status: "valid"; record: ParsedRuntimeOwner | ParsedPendingRuntimeOwner } {
  if (!isObjectLike(value) || isProxyValue(value)) return { status: "invalid" };
  const version = readOwnInteger(value, "version");
  const pid = readOwnInteger(value, "pid");
  const kind = readRequiredKind(value);
  const binary = readOwnOptionalString(value, "binary");
  const processStartRead = readOwnData(value, "processStart");
  const ownerPid = readOwnInteger(value, "ownerPid");
  const ownerInstanceId = readOwnOptionalString(value, "ownerInstanceId");
  const runId = readOwnOptionalString(value, "runId");
  if (
    !version.ok || !version.present || version.value !== 1 ||
    !pid.ok || !pid.present || pid.value <= 1 ||
    !kind.ok ||
    !binary.ok || !isTrustedOwnerBinary(binary.value) ||
    !processStartRead.ok || !processStartRead.present ||
    !ownerPid.ok || !ownerPid.present || ownerPid.value <= 1 ||
    !ownerInstanceId.ok || !isSayDoIdentityToken(ownerInstanceId.value) ||
    !runId.ok || !isSayDoIdentityToken(runId.value)
  ) return { status: "invalid" };
  if (pending) {
    if (processStartRead.value !== null) return { status: "invalid" };
  } else if (typeof processStartRead.value !== "string" || processStartRead.value.length === 0) {
    return { status: "invalid" };
  }
  const extra = finishRequiredJobFields(value, runId.value, ownerInstanceId.value);
  if (!extra.ok) return { status: "invalid" };
  return {
    status: "valid",
    record: {
      version: 1,
      pid: pid.value,
      kind: kind.value,
      binary: binary.value,
      processStart: pending ? null : processStartRead.value as string,
      ownerPid: ownerPid.value,
      ownerInstanceId: ownerInstanceId.value,
      runId: runId.value,
      commandToken: extra.commandToken,
      generation: extra.generation,
      jobName: extra.jobName
    }
  };
}

export function parseRuntimeOwnerRecord(
  value: unknown
): { status: "invalid" } | { status: "valid"; record: ParsedRuntimeOwner } {
  const parsed = parseRuntimeOwnerCore(value, false);
  if (parsed.status === "invalid") return parsed;
  return { status: "valid", record: parsed.record as ParsedRuntimeOwner };
}

export function parsePendingRuntimeOwnerRecord(
  value: unknown
): { status: "invalid" } | { status: "valid"; record: ParsedPendingRuntimeOwner } {
  const parsed = parseRuntimeOwnerCore(value, true);
  if (parsed.status === "invalid") return parsed;
  return { status: "valid", record: parsed.record as ParsedPendingRuntimeOwner };
}

export function parseAnyRuntimeOwnerRecord(
  value: unknown
):
  | { status: "invalid" }
  | { status: "pending"; record: ParsedPendingRuntimeOwner }
  | { status: "valid"; record: ParsedRuntimeOwner } {
  const pending = parsePendingRuntimeOwnerRecord(value);
  if (pending.status === "valid") return { status: "pending", record: pending.record };
  const durable = parseRuntimeOwnerRecord(value);
  if (durable.status === "valid") return durable;
  return { status: "invalid" };
}

const ownerCasErrors = new WeakSet<object>();
const brandedFailureTexts = new WeakSet<object>();

export function isOwnerIdentityCasError(err: unknown): boolean {
  return typeof err === "object" && err !== null && ownerCasErrors.has(err);
}

function ownerCasFailed(): never {
  throw brandTrustedFailure("owner identity cas failed", ownerCasErrors);
}

/** 投影到用户可见失败文本的受信 Error；message 在 brand 时刻冻结。 */
export function brandTrustedFailure(message: string, extraBrand?: WeakSet<object>): Error {
  const err = new Error(message);
  Object.defineProperty(err, "message", {
    value: message,
    writable: false,
    configurable: false,
    enumerable: false
  });
  brandedFailureTexts.add(err);
  extraBrand?.add(err);
  return err;
}

export function commitOwnerReap(audit: () => void, remove: () => void): void {
  if (typeof audit !== "function") ownerCasFailed();
  audit();
  remove();
}

export function runtimeOwnerIdentity(
  rec: ParsedRuntimeOwner | ParsedPendingRuntimeOwner
): OwnerImmutableIdentity {
  return {
    version: 1,
    pid: rec.pid,
    processStart: rec.processStart,
    ownerPid: rec.ownerPid,
    ownerInstanceId: rec.ownerInstanceId,
    runId: rec.runId,
    jobName: rec.jobName,
    binary: rec.binary,
    kind: rec.kind,
    commandToken: rec.commandToken,
    generation: rec.generation
  };
}

export function agentOwnerIdentity(rec: ParsedAgentOwner): OwnerImmutableIdentity {
  return {
    version: 1,
    pid: rec.pid,
    processStart: rec.processStart,
    ownerPid: rec.ownerPid,
    ownerInstanceId: rec.ownerInstanceId,
    runId: rec.runId,
    jobName: rec.jobName,
    binary: rec.binary,
    kind: rec.kind,
    commandToken: rec.commandToken,
    generation: rec.generation
  };
}

export function ownerIdentityEqual(left: OwnerImmutableIdentity, right: OwnerImmutableIdentity): boolean {
  return left.version === right.version &&
    left.pid === right.pid &&
    left.processStart === right.processStart &&
    left.ownerPid === right.ownerPid &&
    left.ownerInstanceId === right.ownerInstanceId &&
    left.runId === right.runId &&
    left.jobName === right.jobName &&
    left.binary === right.binary &&
    left.kind === right.kind &&
    left.commandToken === right.commandToken &&
    left.generation === right.generation;
}

export function commitOwnerReapIfIdentity(
  path: string,
  expected: OwnerImmutableIdentity,
  audit: () => void,
  remove: () => void
): void {
  if (typeof audit !== "function") ownerCasFailed();
  if (!existsSync(path)) ownerCasFailed();
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    ownerCasFailed();
  }
  const runtime = parseAnyRuntimeOwnerRecord(raw);
  if (runtime.status !== "invalid") {
    if (!ownerIdentityEqual(runtimeOwnerIdentity(runtime.record), expected)) ownerCasFailed();
    commitOwnerReap(audit, remove);
    return;
  }
  const agent = parseAgentOwnerRecord(raw, expected.runId);
  if (agent.status === "invalid") ownerCasFailed();
  if (!ownerIdentityEqual(agentOwnerIdentity(agent.record), expected)) ownerCasFailed();
  commitOwnerReap(audit, remove);
}

export function writeDurableJson(path: string, value: unknown): FsyncDirResult {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify(value), { mode: 0o600 });
    fsyncFile(temporary);
    renameSync(temporary, path);
    return fsyncDir(dir);
  } finally {
    rmSync(temporary, { force: true });
  }
}

export function appendReapAudit(home: string, record: Record<string, string | number | boolean | null>): FsyncDirResult {
  const dir = join(home, "audit");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = join(dir, "reap.jsonl");
  appendFileSync(path, `${JSON.stringify(record)}\n`);
  fsyncFile(path);
  return fsyncDir(dir);
}

export function projectUntrustedFailureText(err: unknown, fallback: string): string {
  try {
    if (typeof err === "object" && err !== null && brandedFailureTexts.has(err)) {
      const read = readOwnData(err, "message");
      if (read.ok && read.present && typeof read.value === "string") return read.value.slice(0, 200);
    }
    return fallback;
  } catch {
    return fallback;
  }
}
