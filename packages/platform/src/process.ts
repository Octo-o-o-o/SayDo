import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import {
  classifyKillProbe,
  isObjectLike,
  isProxyValue,
  PROCESS_KILL_UNKNOWN,
  PROCESS_PROBE_UNKNOWN,
  readOwnData,
  readOwnErrnoCode
} from "./errno.js";
import { hostKind, type HostKind } from "./host.js";
import {
  assignPidToJobWin32,
  assignProcessHandleToJobWin32,
  closeJobHandleWin32,
  closeRawHandleWin32,
  createNamedJobWin32,
  closeWin32Permit as closeWin32PermitWin32,
  createSuspendedOwnedProcessWin32,
  createWin32PermitPipe as createWin32PermitPipeWin32,
  grantWin32Permit as grantWin32PermitWin32,
  roundtripWin32NamedPipe as roundtripWin32NamedPipeWin32,
  ERROR_ALREADY_EXISTS,
  exitCodeFromHandleWin32,
  isPlatformNativeError,
  isProcessInJobFromHandlesWin32,
  namedJobActiveProcessCountByNameWin32,
  namedJobActiveProcessCountWin32,
  namedJobContainsPidWin32,
  nativeSync,
  openJobHandleWin32,
  openProcessHandleWin32,
  processBirthFromHandleWin32,
  processBirthWin32,
  processHandleCountWin32,
  isWin32HandleOpen as isWin32HandleOpenWin32,
  isWin32FdClosed as isWin32FdClosedWin32,
  lastWin32SpawnRollbackAudit as lastWin32SpawnRollbackAuditWin32,
  type Win32SpawnResourceAudit,
  processStillActiveFromHandleWin32,
  queryJobActiveFromHandleWin32,
  terminateJobFromHandleWin32,
  terminateNamedJobHandleWin32,
  terminateProcessFromHandleWin32,
  parseCommandLineWin32,
  setWin32SpawnFaultForTests,
  tryLockFileExclusiveWin32,
  waitProcessHandleWin32,
  type OwnedWindowsProcessWin32,
  type Win32Job,
  type Win32SpawnFault
} from "./win32.js";
import {
  isSayDoGeneration,
  isSayDoIdentityToken,
  isSayDoJobName,
  isTrustedCommandToken,
  isTrustedOwnerBinary,
  sayDoJobNameMatchesIdentity
} from "./jobIdentity.js";

export {
  agentOwnerIdentity,
  appendReapAudit,
  commandTokenForGeneration,
  commitOwnerReap,
  formatSayDoJobName,
  isSayDoGeneration,
  isSayDoIdentityToken,
  isSayDoJobName,
  isTrustedCommandToken,
  isTrustedOwnerBinary,
  ownerIdentityEqual,
  parseAgentOwnerRecord,
  parseAnyRuntimeOwnerRecord,
  parsePendingRuntimeOwnerRecord,
  parseRuntimeOwnerRecord,
  brandTrustedFailure,
  projectUntrustedFailureText,
  runtimeOwnerIdentity,
  sayDoJobDigest,
  withHomeOwnerBoundary,
  withHomeOwnerBoundarySync,
  writeDurableJson,
  commitOwnerReapIfIdentity,
  isOwnerIdentityCasError,
  sayDoJobNameMatchesIdentity,
  win32JobIdentityOk,
  type OwnerImmutableIdentity,
  type ParsedAgentOwner,
  type ParsedPendingRuntimeOwner,
  type ParsedRuntimeOwner
} from "./jobIdentity.js";
export { quoteWin32Arg, quoteWin32CommandLine, WIN32_ARGV_QUOTE_CASES } from "./win32Quote.js";
export { HOME_OWNER_LOCK_ABORTED, HOME_OWNER_LOCK_FAILED, HOME_OWNER_LOCK_TIMEOUT } from "./homeLock.js";

export {
  ERROR_ALREADY_EXISTS,
  SpawnRollbackRetainedError,
  win32StartupLayout,
  WIN32_PROC_THREAD_ATTRIBUTE_HANDLE_LIST
} from "./win32.js";

export interface KillClaim {
  pid: number;
  expectedBirth: string;
  jobName?: string;
  ownerInstanceId?: string;
  runId?: string;
  generation?: string;
}

export interface NamedJob {
  name: string;
  handle: unknown;
}

const killOwnedTreeErrors = new WeakSet<object>();

export interface OwnedJobNativeSeam {
  createJob?: (name: string) => { handle: unknown; lastError: number };
  openJob?: (name: string) => { handle: unknown } | "missing";
  openProcess?: (pid: number) => { handle: unknown } | "missing";
  processBirth?: (processHandle: unknown) => string | null;
  processAlive?: (processHandle: unknown) => boolean;
  queryActive?: (jobHandle: unknown) => number;
  queryContainsPid?: (
    jobHandle: unknown,
    processHandle: unknown,
    pid: number
  ) => boolean | "unknown" | "missing";
  terminateJob?: (jobHandle: unknown) => "terminated" | "missing" | "unknown";
  closeHandle?: (handle: unknown) => void;
}

export interface KillOwnedTreeTestHooks {
  hostKind?: () => HostKind;
  processBirth?: (pid: number) => string | null;
  processAnchor?: (pid: number) => ProcessAnchor | null;
  jobActive?: (jobName: string) => number | "missing";
  jobContainsPid?: (jobName: string, pid: number) => boolean | "missing" | "unknown";
  terminateJob?: (jobName: string) => "terminated" | "missing";
  processAlive?: (pid: number) => boolean;
  groupAlive?: (pid: number) => boolean;
  ownedJobNative?: OwnedJobNativeSeam;
}

let killOwnedTreeTestHooks: KillOwnedTreeTestHooks = {};

export function setKillOwnedTreeTestHooks(hooks: KillOwnedTreeTestHooks | null): void {
  killOwnedTreeTestHooks = hooks ?? {};
}

class KillOwnedTreeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KillOwnedTreeError";
    killOwnedTreeErrors.add(this);
  }
}

export function isKillOwnedTreeError(err: unknown): boolean {
  return typeof err === "object" && err !== null && killOwnedTreeErrors.has(err);
}

export function effectiveKillHostKind(): HostKind {
  return killOwnedTreeTestHooks.hostKind?.() ?? hostKind();
}

export function observedProcessBirth(pid: number): string | null {
  try {
    const observed = (killOwnedTreeTestHooks.processBirth ?? processBirth)(pid);
    if (observed !== null && typeof observed !== "string") return null;
    return observed;
  } catch (err) {
    if (isPlatformNativeError(err)) throw err;
    if (isKillOwnedTreeError(err)) throw err;
    return null;
  }
}

export function observedProcessAnchor(pid: number): ProcessAnchor | null {
  try {
    return (killOwnedTreeTestHooks.processAnchor ?? processAnchor)(pid);
  } catch {
    return null;
  }
}

export function observedProcessAlive(pid: number): boolean {
  const fn = killOwnedTreeTestHooks.processAlive ?? processAlive;
  return fn(pid);
}

function commandHasExactArg(command: string, token: string): boolean {
  if (token.length < 1) return false;
  const parts = command.split(/[\s\0]+/u).filter((part) => part.length > 0);
  return parts.includes(token);
}

/** POSIX: PGID + binary/commandToken + birth；win32: 仅 birth（Job identity 由 killOwnedTree 钉死）。 */
export function readOwnedProcessBirth(pid: number, binary?: string, commandToken?: string): string | null {
  if (binary !== undefined && !isTrustedOwnerBinary(binary)) return null;
  if (commandToken !== undefined && !isTrustedCommandToken(commandToken)) return null;
  if (effectiveKillHostKind() === "win32") return observedProcessBirth(pid);
  const anchor = observedProcessAnchor(pid);
  if (!anchor || anchor.pgid !== pid) return null;
  if (binary !== undefined || commandToken !== undefined) {
    const command = anchor.command;
    if (command === null) return null;
    if (binary !== undefined && !commandHasExactArg(command, binary)) return null;
    if (commandToken !== undefined && !commandHasExactArg(command, commandToken)) return null;
  }
  return observedProcessBirth(pid);
}

export type VerifiedOwnedJobKind = "live-owned" | "already_exited" | "fail-closed";

export interface VerifiedOwnedJobObservation {
  kind: VerifiedOwnedJobKind;
  reason: string;
  birth: string | null;
  processAlive: boolean | "unknown";
  job: "open" | "missing" | "unknown";
  active: number | "missing" | "unknown";
  member: boolean | "missing" | "unknown";
  jobHandleId: unknown;
  processHandleId: unknown;
}

export interface VerifiedOwnedJobSession {
  observe(): VerifiedOwnedJobObservation;
  terminate(): "terminated" | "missing" | "unknown";
  queryActive(): number | "missing" | "unknown";
  close(): void;
}

type SessionHandles = {
  jobName: string;
  pid: number;
  expectedBirth: string;
  jobHandle: unknown | null;
  processHandle: unknown | null;
  jobStatus: "open" | "missing" | "unknown";
  processStatus: "open" | "missing" | "unknown";
  closed: boolean;
  native: OwnedJobNativeSeam | null;
};

function nameHookSeam(): OwnedJobNativeSeam | null {
  const hooks = killOwnedTreeTestHooks;
  if (hooks.ownedJobNative) return hooks.ownedJobNative;
  // 仅 processBirth/processAlive 不得切换整段 virtual Job seam；那是 Windows 真机路径。
  if (!hooks.jobActive && !hooks.jobContainsPid && !hooks.terminateJob) {
    return null;
  }
  const jobHandles = new WeakMap<object, string>();
  const processHandles = new WeakMap<object, number>();
  return {
    openJob(name) {
      try {
        const count = hooks.jobActive?.(name);
        if (count === "missing") return "missing";
        const handle = { kind: "job", name };
        jobHandles.set(handle, name);
        return { handle };
      } catch {
        throw new KillOwnedTreeError(`killOwnedTree job query unknown:${name}:untrusted`);
      }
    },
    openProcess(pid) {
      const handle = { kind: "process", pid };
      processHandles.set(handle, pid);
      return { handle };
    },
    processBirth(processHandle) {
      const pid = processHandles.get(processHandle as object);
      if (pid === undefined) return null;
      return (hooks.processBirth ?? processBirth)(pid);
    },
    processAlive(processHandle) {
      const pid = processHandles.get(processHandle as object);
      if (pid === undefined) return false;
      return (hooks.processAlive ?? processAlive)(pid);
    },
    queryActive(jobHandle) {
      const name = jobHandles.get(jobHandle as object);
      if (name === undefined) throw new KillOwnedTreeError("killOwnedTree job query unknown:untrusted");
      const count = hooks.jobActive?.(name);
      if (count === "missing") throw new KillOwnedTreeError(`killOwnedTree job query unknown:${name}:untrusted`);
      if (typeof count !== "number") throw new KillOwnedTreeError(`killOwnedTree job query unknown:${name}:untrusted`);
      return count;
    },
    queryContainsPid(jobHandle, _processHandle, pid) {
      const name = jobHandles.get(jobHandle as object);
      if (name === undefined) return "unknown";
      const member = hooks.jobContainsPid?.(name, pid);
      if (member === undefined) return "unknown";
      return member;
    },
    terminateJob(jobHandle) {
      const name = jobHandles.get(jobHandle as object);
      if (name === undefined) return "missing";
      return hooks.terminateJob?.(name) ?? "missing";
    },
    closeHandle() {
      // name-hook handles are virtual
    }
  };
}

function closeSessionHandle(native: OwnedJobNativeSeam | null, handle: unknown, label: string): void {
  if (handle == null) return;
  try {
    if (native?.closeHandle) {
      native.closeHandle(handle);
      return;
    }
    if (hostKind() === "win32") closeRawHandleWin32(handle, label);
  } catch {
    throw new KillOwnedTreeError(`killOwnedTree job close unknown:${label}:untrusted`);
  }
}

function openVerifiedOwnedJobSession(claim: {
  jobName: string;
  ownerInstanceId: string;
  runId: string;
  generation: string;
  pid: number;
  expectedBirth: string;
}): VerifiedOwnedJobSession {
  if (!sayDoJobNameMatchesIdentity(claim.jobName, claim.ownerInstanceId, claim.runId, claim.generation)) {
    throw new KillOwnedTreeError("killOwnedTree jobName invalid");
  }
  const native = nameHookSeam();
  const session: SessionHandles = {
    jobName: claim.jobName,
    pid: claim.pid,
    expectedBirth: claim.expectedBirth,
    jobHandle: null,
    processHandle: null,
    jobStatus: "unknown",
    processStatus: "unknown",
    closed: false,
    native
  };
  try {
    if (native?.openProcess) {
      const opened = native.openProcess(claim.pid);
      if (opened === "missing") {
        session.processStatus = "missing";
      } else {
        session.processHandle = opened.handle;
        session.processStatus = "open";
      }
    } else if (killOwnedTreeTestHooks.hostKind === undefined && hostKind() === "win32") {
      nativeSync();
      const opened = openProcessHandleWin32(claim.pid);
      if (opened === "missing") {
        session.processStatus = "missing";
      } else {
        session.processHandle = opened.handle;
        session.processStatus = "open";
      }
    } else {
      session.processStatus = "unknown";
    }
  } catch {
    session.processStatus = "unknown";
  }
  try {
    if (native?.openJob) {
      const opened = native.openJob(claim.jobName);
      if (opened === "missing") {
        session.jobStatus = "missing";
      } else {
        session.jobHandle = opened.handle;
        session.jobStatus = "open";
      }
    } else if (killOwnedTreeTestHooks.hostKind === undefined && hostKind() === "win32") {
      nativeSync();
      const opened = openJobHandleWin32(claim.jobName);
      if (opened === "missing") {
        session.jobStatus = "missing";
      } else {
        session.jobHandle = opened.handle;
        session.jobStatus = "open";
      }
    } else {
      session.jobStatus = "unknown";
    }
  } catch {
    session.jobStatus = "unknown";
  }

  const queryActive = (): number | "missing" | "unknown" => {
    if (session.jobStatus === "missing") return "missing";
    if (session.jobStatus !== "open" || session.jobHandle == null) return "unknown";
    try {
      if (native?.queryActive) return native.queryActive(session.jobHandle);
      if (hostKind() === "win32") return queryJobActiveFromHandleWin32(session.jobHandle);
      return "unknown";
    } catch {
      return "unknown";
    }
  };

  const queryMember = (): boolean | "missing" | "unknown" => {
    if (session.jobStatus === "missing") return "missing";
    if (session.jobStatus !== "open" || session.jobHandle == null) return "unknown";
    if (session.processStatus === "missing") return "missing";
    if (session.processHandle == null) return "unknown";
    try {
      if (native?.queryContainsPid) {
        return native.queryContainsPid(session.jobHandle, session.processHandle, session.pid);
      }
      if (hostKind() === "win32") {
        return isProcessInJobFromHandlesWin32(session.processHandle, session.jobHandle);
      }
      return "unknown";
    } catch {
      return "unknown";
    }
  };

  const readBirth = (): string | null | "unknown" => {
    if (session.processStatus === "missing") return null;
    if (session.processStatus !== "open" || session.processHandle == null) return "unknown";
    try {
      if (native?.processBirth) return native.processBirth(session.processHandle);
      if (hostKind() === "win32") return processBirthFromHandleWin32(session.processHandle, session.pid);
      return "unknown";
    } catch {
      return "unknown";
    }
  };

  const readAlive = (): boolean | "unknown" => {
    if (session.processStatus === "missing") return false;
    if (session.processStatus !== "open" || session.processHandle == null) return "unknown";
    try {
      if (native?.processAlive) return native.processAlive(session.processHandle);
      if (hostKind() === "win32") {
        const still = processStillActiveFromHandleWin32(session.processHandle);
        return still;
      }
      return (killOwnedTreeTestHooks.processAlive ?? processAlive)(session.pid);
    } catch {
      return "unknown";
    }
  };

  const close = (): void => {
    if (session.closed) return;
    session.closed = true;
    const job = session.jobHandle;
    const proc = session.processHandle;
    session.jobHandle = null;
    session.processHandle = null;
    let closeFailed = false;
    try {
      closeSessionHandle(native, proc, `process:${String(session.pid)}`);
    } catch {
      closeFailed = true;
    }
    try {
      closeSessionHandle(native, job, `job:${session.jobName}`);
    } catch {
      closeFailed = true;
    }
    if (closeFailed) throw new KillOwnedTreeError(`killOwnedTree job close unknown:${session.jobName}:untrusted`);
  };

  return {
    observe(): VerifiedOwnedJobObservation {
      const birth = readBirth();
      const alive = readAlive();
      const active = queryActive();
      const member = queryMember();
      const fail = (reason: string): VerifiedOwnedJobObservation => ({
        kind: "fail-closed",
        reason,
        birth: birth === "unknown" ? null : birth,
        processAlive: alive,
        job: session.jobStatus,
        active,
        member,
        jobHandleId: session.jobHandle,
        processHandleId: session.processHandle
      });
      if (member === "unknown") {
        return fail(`killOwnedTree job membership unknown:${session.jobName}:untrusted`);
      }
      if (active === "unknown" || session.jobStatus === "unknown") {
        return fail(`killOwnedTree job query unknown:${session.jobName}:untrusted`);
      }
      if (birth === "unknown" || alive === "unknown") {
        return fail("killOwnedTree birth identity unavailable while process/group alive");
      }
      if (birth !== null && birth !== session.expectedBirth) {
        return fail("killOwnedTree birth identity mismatch");
      }
      if (alive === true && birth === session.expectedBirth) {
        if (session.jobStatus === "missing" || active === "missing" || active === 0 || member === "missing") {
          return fail("killOwnedTree job empty while process alive");
        }
        if (member !== true) {
          return fail("killOwnedTree pid is not a job member");
        }
        return {
          kind: "live-owned",
          reason: "owned-live",
          birth,
          processAlive: true,
          job: "open",
          active,
          member,
          jobHandleId: session.jobHandle,
          processHandleId: session.processHandle
        };
      }
      if (alive === false && birth === session.expectedBirth) {
        if (session.jobStatus === "missing" || active === 0 || active === "missing") {
          return {
            kind: "already_exited",
            reason: "proven-exited",
            birth,
            processAlive: false,
            job: session.jobStatus,
            active,
            member,
            jobHandleId: session.jobHandle,
            processHandleId: session.processHandle
          };
        }
        if (typeof active === "number" && active > 0) {
          if (member !== true) {
            return fail("killOwnedTree job membership not proven after leader death");
          }
          return {
            kind: "live-owned",
            reason: "owned-job-still-active",
            birth,
            processAlive: false,
            job: "open",
            active,
            member,
            jobHandleId: session.jobHandle,
            processHandleId: session.processHandle
          };
        }
        return fail("killOwnedTree job still active after leader death");
      }
      if (alive === false && birth === null) {
        if (typeof active === "number" && active > 0) {
          return fail("killOwnedTree birth identity unavailable while process/group alive");
        }
        if (session.jobStatus === "missing" || active === 0 || active === "missing") {
          return {
            kind: "already_exited",
            reason: "proven-exited",
            birth: null,
            processAlive: false,
            job: session.jobStatus,
            active,
            member,
            jobHandleId: session.jobHandle,
            processHandleId: session.processHandle
          };
        }
      }
      return fail("killOwnedTree birth identity unavailable while process/group alive");
    },
    terminate() {
      if (session.jobStatus === "missing") return "missing";
      if (session.jobStatus !== "open" || session.jobHandle == null) return "unknown";
      try {
        if (native?.terminateJob) return native.terminateJob(session.jobHandle);
        if (hostKind() === "win32") {
          terminateJobFromHandleWin32(session.jobHandle);
          return "terminated";
        }
        return "unknown";
      } catch {
        return "unknown";
      }
    },
    queryActive,
    close
  };
}

export function observeVerifiedOwnedJob(claim: {
  jobName: string;
  ownerInstanceId: string;
  runId: string;
  generation: string;
  pid: number;
  expectedBirth: string;
}): VerifiedOwnedJobObservation {
  const session = openVerifiedOwnedJobSession(claim);
  try {
    return session.observe();
  } finally {
    session.close();
  }
}

export async function withVerifiedOwnedJob<T>(
  claim: {
    jobName: string;
    ownerInstanceId: string;
    runId: string;
    generation: string;
    pid: number;
    expectedBirth: string;
  },
  fn: (session: VerifiedOwnedJobSession) => Promise<T> | T
): Promise<T> {
  const session = openVerifiedOwnedJobSession(claim);
  try {
    return await fn(session);
  } finally {
    session.close();
  }
}

function readOwnToken(claim: object, key: string): string | undefined {
  const read = readOwnData(claim, key);
  if (!read.ok) throw new KillOwnedTreeError("killOwnedTree claim invalid");
  if (!read.present) return undefined;
  if (!isSayDoIdentityToken(read.value)) throw new KillOwnedTreeError("killOwnedTree claim invalid");
  return read.value;
}

function readOwnGeneration(claim: object): string | undefined {
  const read = readOwnData(claim, "generation");
  if (!read.ok) throw new KillOwnedTreeError("killOwnedTree claim invalid");
  if (!read.present) return undefined;
  if (!isSayDoGeneration(read.value)) throw new KillOwnedTreeError("killOwnedTree claim invalid");
  return read.value;
}

function readTrustedKillClaim(claim: unknown): {
  pid: number;
  expectedBirth: string;
  jobName?: string;
  ownerInstanceId?: string;
  runId?: string;
  generation?: string;
} {
  if (!isObjectLike(claim) || isProxyValue(claim)) {
    throw new KillOwnedTreeError("killOwnedTree claim invalid");
  }
  const pidRead = readOwnData(claim, "pid");
  const birthRead = readOwnData(claim, "expectedBirth");
  const jobRead = readOwnData(claim, "jobName");
  if (
    !pidRead.ok ||
    !pidRead.present ||
    typeof pidRead.value !== "number" ||
    !Number.isInteger(pidRead.value) ||
    pidRead.value <= 0
  ) {
    throw new KillOwnedTreeError("killOwnedTree claim invalid");
  }
  if (!birthRead.ok || !birthRead.present || typeof birthRead.value !== "string" || birthRead.value.length === 0) {
    throw new KillOwnedTreeError("killOwnedTree requires expectedBirth");
  }
  const ownerInstanceId = readOwnToken(claim, "ownerInstanceId");
  const runId = readOwnToken(claim, "runId");
  const generation = readOwnGeneration(claim);
  if (!jobRead.ok) throw new KillOwnedTreeError("killOwnedTree claim invalid");
  if (jobRead.present) {
    if (
      !isSayDoJobName(jobRead.value) ||
      !sayDoJobNameMatchesIdentity(jobRead.value, ownerInstanceId, runId, generation)
    ) {
      throw new KillOwnedTreeError("killOwnedTree jobName invalid");
    }
    return {
      pid: pidRead.value,
      expectedBirth: birthRead.value,
      jobName: jobRead.value,
      ...(ownerInstanceId ? { ownerInstanceId } : {}),
      ...(runId ? { runId } : {}),
      ...(generation ? { generation } : {})
    };
  }
  return {
    pid: pidRead.value,
    expectedBirth: birthRead.value,
    ...(ownerInstanceId ? { ownerInstanceId } : {}),
    ...(runId ? { runId } : {}),
    ...(generation ? { generation } : {})
  };
}

function posixBirthFromPs(pid: number): string | null {
  try {
    const ps = existsSync("/bin/ps") ? "/bin/ps" : existsSync("/usr/bin/ps") ? "/usr/bin/ps" : "ps";
    const raw = execFileSync(ps, ["-o", "lstart=", "-p", String(pid)], {
      encoding: "utf8",
      timeout: 2_000
    }).trim();
    return raw || null;
  } catch {
    return null;
  }
}

function linuxBirthFromProc(pid: number): string | null {
  try {
    const stat = readFileSync(`/proc/${String(pid)}/stat`, "utf8");
    const close = stat.lastIndexOf(")");
    if (close < 0) return null;
    const rest = stat.slice(close + 2).split(" ");
    const starttime = rest[19];
    if (!starttime) return null;
    return `ticks:${starttime}:${String(pid)}`;
  } catch {
    return null;
  }
}

export interface ProcessAnchor {
  /** 进程组 id。win32 无进程组语义,processAnchor 在该平台恒为 null。 */
  pgid: number;
  /** 完整命令行(argv 以空格连接);读不到为 null。 */
  command: string | null;
}

function linuxAnchor(pid: number): ProcessAnchor | null {
  try {
    // comm 字段可能含空格与括号,只能从最后一个 ")" 之后重新切分。
    const stat = readFileSync(`/proc/${String(pid)}/stat`, "utf8");
    const close = stat.lastIndexOf(")");
    if (close < 0) return null;
    const rest = stat.slice(close + 2).split(" ");
    const pgrp = Number(rest[2]);
    if (!Number.isInteger(pgrp)) return null;
    let command: string | null = null;
    try {
      command = readFileSync(`/proc/${String(pid)}/cmdline`, "utf8").replaceAll("\0", " ").trim() || null;
    } catch {
      command = null;
    }
    return { pgid: pgrp, command };
  } catch {
    return null;
  }
}

function psAnchor(pid: number): ProcessAnchor | null {
  try {
    const ps = existsSync("/bin/ps") ? "/bin/ps" : existsSync("/usr/bin/ps") ? "/usr/bin/ps" : "ps";
    const raw = execFileSync(ps, ["-o", "pgid=", "-o", "command=", "-p", String(pid)], {
      encoding: "utf8",
      timeout: 2_000
    }).trim();
    const match = /^(\d+)\s+([\s\S]*)$/u.exec(raw);
    if (!match) return null;
    const pgid = Number(match[1]);
    if (!Number.isInteger(pgid)) return null;
    return { pgid, command: (match[2] ?? "").trim() || null };
  } catch {
    return null;
  }
}

/**
 * POSIX 进程身份锚:进程组 id + 命令行。
 * 用途是「杀之前先证明这个 pid 仍是我们启动的那个组长」——POSIX 收口走 kill(-pid) 作用于整组,
 * 只靠秒级 birth 时间戳不足以挡住 PID 复用。win32 无进程组语义,由具名 Job 承担同一职责,返回 null。
 */
export function processAnchor(pid: number): ProcessAnchor | null {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  const kind = hostKind();
  if (kind === "win32") return null;
  if (kind === "linux") return linuxAnchor(pid);
  return psAnchor(pid);
}

export function processBirth(pid: number): string | null {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  const kind = hostKind();
  if (kind === "win32") {
    nativeSync();
    return processBirthWin32(pid);
  }
  if (kind === "linux") return linuxBirthFromProc(pid);
  return posixBirthFromPs(pid);
}

export function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    const kind = classifyKillProbe(err);
    if (kind === "gone") return false;
    if (kind === "alive") return true;
    throw new Error(PROCESS_PROBE_UNKNOWN);
  }
}

function groupAlive(pid: number): boolean {
  if (hostKind() === "win32") return processAlive(pid);
  try {
    process.kill(-pid, 0);
    return true;
  } catch (err) {
    const kind = classifyKillProbe(err);
    if (kind === "gone") return false;
    if (kind === "alive") return true;
    throw new Error(PROCESS_PROBE_UNKNOWN);
  }
}

function observeBirth(pid: number): { ok: true; value: string | null } | { ok: false; reason: "mismatch" | "unavailable" } {
  try {
    const observed = (killOwnedTreeTestHooks.processBirth ?? processBirth)(pid);
    if (observed !== null && typeof observed !== "string") return { ok: false, reason: "mismatch" };
    return { ok: true, value: observed };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

function targetAlive(pid: number, kind: HostKind): boolean {
  const aliveFn = killOwnedTreeTestHooks.processAlive ?? processAlive;
  const groupFn = killOwnedTreeTestHooks.groupAlive ?? groupAlive;
  try {
    if (aliveFn(pid)) return true;
  } catch {
    return true;
  }
  if (kind === "win32") return false;
  try {
    return groupFn(pid);
  } catch {
    return true;
  }
}

async function pollSessionEmpty(session: VerifiedOwnedJobSession, jobName: string): Promise<void> {
  const deadline = performance.now() + 5_000;
  while (performance.now() < deadline) {
    const count = session.queryActive();
    if (count === "unknown") {
      throw new KillOwnedTreeError(`killOwnedTree job query unknown:${jobName}:untrusted`);
    }
    if (count === "missing" || count === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new KillOwnedTreeError("killOwnedTree job drain timeout");
}

export async function killOwnedTree(claim: KillClaim): Promise<void> {
  const trusted = readTrustedKillClaim(claim);
  const { pid, expectedBirth, jobName } = trusted;
  const kind = effectiveKillHostKind();
  if (kind === "win32") {
    const { ownerInstanceId, runId } = trusted;
    if (!jobName || !ownerInstanceId || !runId) {
      throw new KillOwnedTreeError("killOwnedTree on win32 requires job identity");
    }
    const { generation } = trusted;
    if (!generation) {
      throw new KillOwnedTreeError("killOwnedTree on win32 requires job identity");
    }
    await withVerifiedOwnedJob({
      jobName,
      ownerInstanceId,
      runId,
      generation,
      pid,
      expectedBirth
    }, async (session) => {
      const observed = session.observe();
      if (observed.kind === "fail-closed") {
        throw new KillOwnedTreeError(observed.reason);
      }
      if (observed.kind === "already_exited") return;
      const outcome = session.terminate();
      if (outcome === "unknown") {
        throw new KillOwnedTreeError(`killOwnedTree job terminate unknown:${jobName}:untrusted`);
      }
      if (outcome === "missing") {
        throw new KillOwnedTreeError("killOwnedTree job terminate missing before drain");
      }
      await pollSessionEmpty(session, jobName);
      const after = session.observe();
      if (after.kind !== "already_exited") {
        if (after.processAlive === true) {
          throw new KillOwnedTreeError("killOwnedTree process still alive after TerminateJob");
        }
        if (after.kind === "fail-closed") {
          throw new KillOwnedTreeError(after.reason);
        }
        throw new KillOwnedTreeError("killOwnedTree job not proven drained after TerminateJob");
      }
    });
    return;
  }
  const birth = observeBirth(pid);
  if (!birth.ok) {
    if (birth.reason === "mismatch") {
      throw new KillOwnedTreeError("killOwnedTree birth identity mismatch");
    }
    if (!targetAlive(pid, kind)) return;
    throw new KillOwnedTreeError("killOwnedTree birth identity unavailable while process/group alive");
  }
  const observed = birth.value;
  if (observed !== null && observed !== expectedBirth) {
    throw new KillOwnedTreeError("killOwnedTree birth identity mismatch");
  }
  if (observed === null) {
    if (targetAlive(pid, kind)) {
      throw new KillOwnedTreeError("killOwnedTree birth identity unavailable while process/group alive");
    }
    return;
  }
  if (!targetAlive(pid, kind)) return;
  try {
    process.kill(-pid, "SIGKILL");
  } catch (err) {
    if (readOwnErrnoCode(err) !== "ESRCH") throw new KillOwnedTreeError(PROCESS_KILL_UNKNOWN);
  }
  const deadline = performance.now() + 5_000;
  while (groupAlive(pid) && performance.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  if (groupAlive(pid)) throw new KillOwnedTreeError("killOwnedTree process group drain timeout");
}

export function createNamedJob(name: string): NamedJob {
  if (!isSayDoJobName(name)) throw new Error("saydo job identity invalid");
  const native = killOwnedTreeTestHooks.ownedJobNative;
  if (native?.createJob) {
    const created = native.createJob(name);
    if (created.lastError === ERROR_ALREADY_EXISTS) {
      try {
        native.closeHandle?.(created.handle);
      } catch {
        // 已存在的 handle 必须关掉且不得继续 attach
      }
      throw new Error(`CreateJobObjectW already exists:${name}`);
    }
    if (created.handle == null) throw new Error(`CreateJobObjectW failed:${name}`);
    return { name, handle: created.handle };
  }
  if (hostKind() !== "win32") throw new Error("createNamedJob is win32-only");
  nativeSync();
  return createNamedJobWin32(name);
}

export function assignPidToJob(job: NamedJob, pid: number): void {
  if (hostKind() !== "win32") throw new Error("assignPidToJob is win32-only");
  assignPidToJobWin32(job as Win32Job, pid);
}

export function assignProcessHandleToJob(job: NamedJob, processHandle: unknown): void {
  if (hostKind() !== "win32") throw new Error("assignProcessHandleToJob is win32-only");
  assignProcessHandleToJobWin32(job as Win32Job, processHandle);
}

export function processBirthFromHandle(processHandle: unknown, pid: number): string | null {
  return processBirthFromHandleWin32(processHandle, pid);
}

export function processStillActiveFromHandle(processHandle: unknown): boolean | "unknown" {
  return processStillActiveFromHandleWin32(processHandle);
}

export function isProcessInJobFromHandles(processHandle: unknown, jobHandle: unknown): boolean {
  return isProcessInJobFromHandlesWin32(processHandle, jobHandle);
}

export function terminateProcessFromHandle(processHandle: unknown): void {
  terminateProcessFromHandleWin32(processHandle);
}

export function closeRawHandle(handle: unknown, label: string): void {
  closeRawHandleWin32(handle, label);
}

export function processHandleCount(processHandle: unknown): number {
  return processHandleCountWin32(processHandle);
}

export function isWin32HandleOpen(handle: unknown): boolean {
  return isWin32HandleOpenWin32(handle);
}

export function isWin32FdClosed(fd: number): boolean {
  return isWin32FdClosedWin32(fd);
}

export function lastWin32SpawnRollbackAudit(): Win32SpawnResourceAudit[] {
  return lastWin32SpawnRollbackAuditWin32();
}

export type { Win32SpawnResourceAudit };

export type OwnedWindowsProcess = OwnedWindowsProcessWin32;

export function createSuspendedOwnedWindowsProcess(input: {
  file: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  generation?: string;
}): OwnedWindowsProcess {
  if (hostKind() !== "win32") throw new Error("createSuspendedOwnedWindowsProcess is win32-only");
  return createSuspendedOwnedProcessWin32(input);
}

export function createWin32PermitPipe(generation: string): { name: string; handle: unknown } {
  if (hostKind() !== "win32") throw new Error("createWin32PermitPipe is win32-only");
  return createWin32PermitPipeWin32(generation);
}

export async function roundtripWin32NamedPipe(payload: string): Promise<string> {
  if (hostKind() !== "win32") throw new Error("roundtripWin32NamedPipe is win32-only");
  return roundtripWin32NamedPipeWin32(payload);
}

export async function grantWin32Permit(handle: unknown, signal?: AbortSignal): Promise<void> {
  if (hostKind() !== "win32") throw new Error("grantWin32Permit is win32-only");
  await grantWin32PermitWin32(handle, signal);
}

export function closeWin32Permit(handle: unknown): void {
  if (hostKind() !== "win32") return;
  closeWin32PermitWin32(handle);
}

export function setWin32SpawnTestFault(next: Win32SpawnFault | null): void {
  setWin32SpawnFaultForTests(next);
}

export function waitProcessHandle(processHandle: unknown, timeoutMs: number): "signaled" | "timeout" | "unknown" {
  return waitProcessHandleWin32(processHandle, timeoutMs);
}

export function exitCodeFromHandle(processHandle: unknown): number | "live" | "unknown" {
  return exitCodeFromHandleWin32(processHandle);
}

export function parseWin32CommandLine(commandLine: string): string[] {
  return parseCommandLineWin32(commandLine);
}

export function tryLockFileExclusive(path: string): { release(): void } | "busy" {
  return tryLockFileExclusiveWin32(path);
}

export function closeNamedJob(job: NamedJob): void {
  if (hostKind() !== "win32") return;
  closeJobHandleWin32(job as Win32Job);
}

export function namedJobActiveProcessCount(job: NamedJob): number {
  if (hostKind() !== "win32") throw new Error("namedJobActiveProcessCount is win32-only");
  return namedJobActiveProcessCountWin32(job as Win32Job);
}

export function terminateNamedJobHandle(job: NamedJob): void {
  if (hostKind() !== "win32") throw new Error("terminateNamedJobHandle is win32-only");
  terminateNamedJobHandleWin32(job as Win32Job);
}

export function namedJobActiveProcessCountByName(name: string): number | "missing" {
  if (hostKind() !== "win32") throw new Error("namedJobActiveProcessCountByName is win32-only");
  return namedJobActiveProcessCountByNameWin32(name);
}

export function namedJobContainsPid(name: string, pid: number): boolean | "missing" {
  if (hostKind() !== "win32") throw new Error("namedJobContainsPid is win32-only");
  return namedJobContainsPidWin32(name, pid);
}
