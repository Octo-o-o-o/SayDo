import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import {
  appendReapAudit,
  classifyKillProbe,
  commitOwnerReapIfIdentity,
  effectiveKillHostKind,
  hostKind,
  isKillOwnedTreeError,
  killOwnedTree,
  nativeSync,
  observeVerifiedOwnedJob,
  observedProcessAlive,
  parseAgentOwnerRecord,
  agentOwnerIdentity,
  isOwnerIdentityCasError,
  parseAnyRuntimeOwnerRecord,
  runtimeOwnerIdentity,
  withHomeOwnerBoundary,
  PROCESS_KILL_UNKNOWN,
  PROCESS_PROBE_UNKNOWN,
  projectUntrustedFailureText,
  readOwnedProcessBirth,
  win32JobIdentityOk,
  type ParsedAgentOwner,
  type ParsedPendingRuntimeOwner,
  type ParsedRuntimeOwner
} from "@saydo/platform";

const reaperErrors = new WeakSet<object>();

function reaperError(message: string): Error {
  const err = new Error(message);
  reaperErrors.add(err);
  return err;
}

function isReaperError(err: unknown): boolean {
  return typeof err === "object" && err !== null && reaperErrors.has(err);
}

function projectReaperFailure(err: unknown, fallback: string): Error {
  if (isReaperError(err) || isKillOwnedTreeError(err)) {
    return err as Error;
  }
  return reaperError(projectUntrustedFailureText(err, fallback));
}

function leaderAlive(pid: number): boolean {
  try {
    return observedProcessAlive(pid);
  } catch (err) {
    const kind = classifyKillProbe(err);
    if (kind === "gone") return false;
    if (kind === "alive") return true;
    throw reaperError(PROCESS_PROBE_UNKNOWN);
  }
}

function killIdentity(owner: {
  jobName?: string;
  ownerInstanceId?: string;
  runId?: string;
  generation?: string;
}): {
  jobName?: string;
  ownerInstanceId?: string;
  runId?: string;
  generation?: string;
} {
  return {
    ...(owner.jobName !== undefined ? { jobName: owner.jobName } : {}),
    ...(owner.ownerInstanceId !== undefined ? { ownerInstanceId: owner.ownerInstanceId } : {}),
    ...(owner.runId !== undefined ? { runId: owner.runId } : {}),
    ...(owner.generation !== undefined ? { generation: owner.generation } : {})
  };
}

async function killOwned(
  pid: number,
  expectedBirth: string,
  owner: { jobName?: string; ownerInstanceId?: string; runId?: string; generation?: string }
): Promise<void> {
  try {
    await killOwnedTree({
      pid,
      expectedBirth,
      ...(effectiveKillHostKind() === "win32" ? killIdentity(owner) : {})
    });
  } catch (err) {
    throw projectReaperFailure(err, PROCESS_KILL_UNKNOWN);
  }
}

function assertWin32JobIdentity(
  owner: { jobName?: string; ownerInstanceId?: string; runId?: string; generation?: string },
  label: string
): void {
  if (effectiveKillHostKind() !== "win32") return;
  if (!win32JobIdentityOk(owner)) {
    throw reaperError(`${label} missing jobName`);
  }
}

function readLegacyPid(runDir: string): number | null {
  try {
    const pid = Number(readFileSync(join(runDir, "agent.pid"), "utf8").trim());
    return Number.isInteger(pid) && pid > 1 ? pid : null;
  } catch {
    return null;
  }
}

type OwnerRead<T> =
  | { status: "absent" }
  | { status: "invalid" }
  | { status: "missing-job"; record: T }
  | { status: "valid"; record: T };

function ownerFileExists(path: string): boolean {
  try {
    return existsSync(path);
  } catch {
    return false;
  }
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function win32JobNameAbsent(raw: unknown): boolean {
  if (typeof raw !== "object" || raw === null) return true;
  if (!Object.prototype.hasOwnProperty.call(raw, "jobName")) return true;
  const jobName = (raw as { jobName?: unknown }).jobName;
  return jobName === undefined || jobName === null || jobName === "";
}

function readAgentOwner(runDir: string, runId: string): OwnerRead<ParsedAgentOwner> {
  const path = join(runDir, "agent-owner.json");
  if (!ownerFileExists(path)) return { status: "absent" };
  try {
    const raw = readJson(path);
    if (effectiveKillHostKind() === "win32" && win32JobNameAbsent(raw)) {
      return { status: "missing-job", record: raw as ParsedAgentOwner };
    }
    const parsed = parseAgentOwnerRecord(raw, runId);
    if (parsed.status !== "valid") return { status: "invalid" };
    if (!isAbsolute(parsed.record.binary)) return { status: "invalid" };
    if (effectiveKillHostKind() === "win32" && !win32JobIdentityOk(parsed.record)) {
      return { status: "missing-job", record: parsed.record };
    }
    return { status: "valid", record: parsed.record };
  } catch {
    return { status: "invalid" };
  }
}

function readRuntimeOwner(path: string): OwnerRead<ParsedRuntimeOwner | ParsedPendingRuntimeOwner> {
  if (!ownerFileExists(path)) return { status: "absent" };
  try {
    const raw = readJson(path);
    if (effectiveKillHostKind() === "win32" && win32JobNameAbsent(raw)) {
      return { status: "missing-job", record: raw as ParsedRuntimeOwner };
    }
    const parsed = parseAnyRuntimeOwnerRecord(raw);
    if (parsed.status === "invalid") return { status: "invalid" };
    if (effectiveKillHostKind() === "win32" && !win32JobIdentityOk(parsed.record)) {
      return { status: "missing-job", record: parsed.record };
    }
    return { status: "valid", record: parsed.record };
  } catch {
    return { status: "invalid" };
  }
}

function commitAgentDelete(
  home: string,
  ownerPath: string,
  owner: ParsedAgentOwner,
  rec: Record<string, string | number | boolean | null>
): void {
  commitOwnerReapIfIdentity(
    ownerPath,
    agentOwnerIdentity(owner),
    () => {
      appendReapAudit(home, rec);
    },
    () => {
      rmSync(ownerPath, { force: true });
    }
  );
}

function commitDelete(
  home: string,
  ownerPath: string,
  identity: ReturnType<typeof runtimeOwnerIdentity>,
  rec: Record<string, string | number | boolean | null>
): void {
  commitOwnerReapIfIdentity(
    ownerPath,
    identity,
    () => {
      appendReapAudit(home, rec);
    },
    () => {
      rmSync(ownerPath, { force: true });
    }
  );
}

function assertConfirmedDeadAndDrained(
  owner: {
    jobName?: string;
    ownerInstanceId?: string;
    runId?: string;
    generation?: string;
    pid: number;
    processStart?: string | null;
  },
  label: string
): void {
  if (effectiveKillHostKind() === "win32") {
    if (!win32JobIdentityOk(owner)) {
      throw reaperError(`${label} identity incomplete`);
    }
    const expectedBirth = typeof owner.processStart === "string" && owner.processStart.length > 0
      ? owner.processStart
      : "pending-unestablished";
    let observed;
    try {
      observed = observeVerifiedOwnedJob({
        jobName: owner.jobName as string,
        ownerInstanceId: owner.ownerInstanceId as string,
        runId: owner.runId as string,
        generation: owner.generation as string,
        pid: owner.pid,
        expectedBirth
      });
    } catch (err) {
      throw projectReaperFailure(err, PROCESS_KILL_UNKNOWN);
    }
    if (observed.kind !== "already_exited") {
      throw reaperError(`${label} job not proven drained`);
    }
    return;
  }
  if (posixGroupAlive(owner.pid)) {
    throw reaperError(`${label} process group alive after leader death`);
  }
}

function posixGroupAlive(pid: number): boolean {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (err) {
    const kind = classifyKillProbe(err);
    if (kind === "alive") return true;
    if (kind === "gone") return false;
    throw reaperError(PROCESS_PROBE_UNKNOWN);
  }
}

export interface OwnedDaemonGeneration {
  pid: number;
  instanceId: string;
}

export interface ReapOwnedAgentGroupsOptions {
  afterKillBeforeDelete?: () => Promise<void> | void;
}

export async function reapOwnedAgentGroups(
  home: string,
  generation?: OwnedDaemonGeneration,
  options: ReapOwnedAgentGroupsOptions = {}
): Promise<number> {
  if (hostKind() === "win32") nativeSync();
  return reapOwnedAgentGroupsLocked(home, generation, options);
}

async function reapOwnedAgentGroupsLocked(
  home: string,
  generation: OwnedDaemonGeneration | undefined,
  options: ReapOwnedAgentGroupsOptions
): Promise<number> {
  const runsRoot = join(home, "tier1", "runs");
  let reaped = 0;
  const deferredLegacy: { runId: string; pid: number }[] = [];
  for (const entry of existsSync(runsRoot) ? readdirSync(runsRoot, { withFileTypes: true }) : []) {
    if (!entry.isDirectory()) continue;
    const runDir = join(runsRoot, entry.name);
    const ownerPath = join(runDir, "agent-owner.json");
    const ownerFile = readAgentOwner(runDir, entry.name);
    const legacyPid = readLegacyPid(runDir);
    if (ownerFile.status === "invalid") {
      throw reaperError(`agent ownership record invalid:${entry.name}`);
    }
    if (ownerFile.status === "missing-job") {
      throw reaperError(`agent ownership missing jobName:${entry.name}`);
    }
    if (ownerFile.status === "absent") {
      if (legacyPid !== null && leaderAlive(legacyPid)) {
        if (!generation) throw reaperError(`live agent ownership unverified:${entry.name}`);
        deferredLegacy.push({ runId: entry.name, pid: legacyPid });
      }
      continue;
    }
    const owner = ownerFile.record;
    if (generation && (owner.ownerPid !== generation.pid || owner.ownerInstanceId !== generation.instanceId)) {
      continue;
    }
    if (legacyPid !== null && legacyPid !== owner.pid) {
      if (leaderAlive(legacyPid) || leaderAlive(owner.pid)) {
        throw reaperError(`agent ownership records disagree:${entry.name}`);
      }
      continue;
    }
    assertWin32JobIdentity(owner, "agent ownership");
    const observedStart = readOwnedProcessBirth(owner.pid, owner.binary, owner.commandToken);
    if (observedStart === null) {
      if (leaderAlive(owner.pid)) throw reaperError(`agent ownership identity unverified:${entry.name}`);
      assertConfirmedDeadAndDrained(owner, `agent ownership:${entry.name}`);
      try {
        await withHomeOwnerBoundary(home, () => {
          commitAgentDelete(home, ownerPath, owner, {
            action: "tier1.orphan_agent_reaped",
            runId: owner.runId,
            pid: owner.pid
          });
        });
      } catch (err) {
        if (isOwnerIdentityCasError(err)) continue;
        throw projectReaperFailure(err, PROCESS_KILL_UNKNOWN);
      }
      reaped += 1;
      continue;
    }
    if (observedStart !== owner.processStart) {
      throw reaperError(`agent ownership identity mismatch:${entry.name}`);
    }
    await killOwned(owner.pid, owner.processStart, owner);
    if (options.afterKillBeforeDelete) await options.afterKillBeforeDelete();
    try {
      await withHomeOwnerBoundary(home, () => {
        commitAgentDelete(home, ownerPath, owner, {
          action: "tier1.orphan_agent_reaped",
          runId: owner.runId,
          pid: owner.pid
        });
      });
    } catch (err) {
      if (isOwnerIdentityCasError(err)) continue;
      throw projectReaperFailure(err, PROCESS_KILL_UNKNOWN);
    }
    reaped += 1;
  }
  const childrenRoot = join(home, "runtime", "children");
  for (const entry of existsSync(childrenRoot) ? readdirSync(childrenRoot, { withFileTypes: true }) : []) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const path = join(childrenRoot, entry.name);
    const ownerFile = readRuntimeOwner(path);
    if (ownerFile.status === "invalid" || ownerFile.status === "absent") {
      throw reaperError(`runtime child ownership record invalid:${entry.name}`);
    }
    if (ownerFile.status === "missing-job") {
      throw reaperError(`runtime child ownership missing jobName:${entry.name}`);
    }
    const owner = ownerFile.record;
    if (generation && (owner.ownerPid !== generation.pid || owner.ownerInstanceId !== generation.instanceId)) {
      continue;
    }
    assertWin32JobIdentity(owner, "runtime child ownership");
    if (owner.processStart === null) {
      const observedPending = readOwnedProcessBirth(owner.pid, owner.binary, owner.commandToken);
      if (observedPending === null) {
        if (leaderAlive(owner.pid)) {
          throw reaperError(`live runtime child ownership pending:${owner.kind}:${String(owner.pid)}`);
        }
        assertConfirmedDeadAndDrained(owner, `runtime child ownership:${owner.kind}:${String(owner.pid)}`);
        try {
          await withHomeOwnerBoundary(home, () => {
            commitDelete(home, path, runtimeOwnerIdentity(owner), {
              action: "runtime.orphan_child_reaped",
              kind: owner.kind,
              pid: owner.pid
            });
          });
        } catch (err) {
          if (isOwnerIdentityCasError(err)) continue;
          throw projectReaperFailure(err, PROCESS_KILL_UNKNOWN);
        }
        reaped += 1;
        continue;
      }
      await killOwned(owner.pid, observedPending, killIdentity(owner));
      if (options.afterKillBeforeDelete) await options.afterKillBeforeDelete();
      try {
        await withHomeOwnerBoundary(home, () => {
          commitDelete(home, path, runtimeOwnerIdentity(owner), {
            action: "runtime.orphan_child_reaped",
            kind: owner.kind,
            pid: owner.pid
          });
        });
      } catch (err) {
        if (isOwnerIdentityCasError(err)) continue;
        throw projectReaperFailure(err, PROCESS_KILL_UNKNOWN);
      }
      reaped += 1;
      continue;
    }
    const observedStart = readOwnedProcessBirth(owner.pid, owner.binary, owner.commandToken);
    if (observedStart === null) {
      if (leaderAlive(owner.pid)) throw reaperError(`runtime child ownership identity unverified:${owner.kind}:${String(owner.pid)}`);
      assertConfirmedDeadAndDrained(owner, `runtime child ownership:${owner.kind}:${String(owner.pid)}`);
      try {
        await withHomeOwnerBoundary(home, () => {
          commitDelete(home, path, runtimeOwnerIdentity(owner), {
            action: "runtime.orphan_child_reaped",
            kind: owner.kind,
            pid: owner.pid
          });
        });
      } catch (err) {
        if (isOwnerIdentityCasError(err)) continue;
        throw projectReaperFailure(err, PROCESS_KILL_UNKNOWN);
      }
      reaped += 1;
      continue;
    }
    if (observedStart !== owner.processStart) {
      throw reaperError(`runtime child ownership identity mismatch:${owner.kind}:${String(owner.pid)}`);
    }
    await killOwned(owner.pid, owner.processStart, killIdentity(owner));
    if (options.afterKillBeforeDelete) await options.afterKillBeforeDelete();
    try {
      await withHomeOwnerBoundary(home, () => {
        commitDelete(home, path, runtimeOwnerIdentity(owner), {
          action: "runtime.orphan_child_reaped",
          kind: owner.kind,
          pid: owner.pid
        });
      });
    } catch (err) {
      if (isOwnerIdentityCasError(err)) continue;
      throw projectReaperFailure(err, PROCESS_KILL_UNKNOWN);
    }
    reaped += 1;
  }
  for (const legacy of deferredLegacy) {
    if (leaderAlive(legacy.pid)) throw reaperError(`live agent ownership unverified:${legacy.runId}`);
  }
  return reaped;
}
