import { execFileSync, spawn, type ChildProcess, type ChildProcessByStdio } from "node:child_process";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { PassThrough, type Readable, type Writable } from "node:stream";
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { delimiter, dirname, extname, join, resolve, win32 } from "node:path";
import {
  appendReapAudit,
  assignPidToJob,
  assignProcessHandleToJob,
  classifyKillProbe,
  closeNamedJob,
  closeRawHandle,
  closeWin32Permit,
  commandTokenForGeneration,
  commitOwnerReapIfIdentity,
  isOwnerIdentityCasError,
  createNamedJob,
  createSuspendedOwnedWindowsProcess,
  createWin32PermitPipe,
  formatSayDoJobName,
  grantWin32Permit,
  hostKind,
  isProcessInJobFromHandles,
  isSayDoGeneration,
  isSayDoIdentityToken,
  isTrustedCommandToken,
  killOwnedTree,
  namedJobActiveProcessCount,
  observeVerifiedOwnedJob,
  parseAnyRuntimeOwnerRecord,
  processAlive,
  processBirth,
  processBirthFromHandle,
  readOwnErrnoCode,
  runtimeOwnerIdentity,
  terminateNamedJobHandle,
  terminateProcessFromHandle,
  isReparsePoint,
  restrictOwnerOnly,
  SpawnRollbackRetainedError,
  win32JobIdentityOk,
  withHomeOwnerBoundary,
  withHomeOwnerBoundarySync,
  writeDurableJson,
  type HostKind,
  type NamedJob,
  type OwnedWindowsProcess,
  type OwnerImmutableIdentity
} from "@saydo/platform";
import {
  ProcessGroupLifecycleError,
  appendLifecycleFailure,
  asProcessGroupLifecycleError,
  combineLifecycleFailureList,
  combineLifecycleFailures,
  combinePipeBusinessFailures,
  contaminateSharedLifecycle,
  inspectUntrustedPipeFailure,
  isProcessGroupLifecycleError,
  PIPE_OPAQUE_FAILURE,
  projectTrustedKillFailure,
  resetSharedLifecycleForTests,
  RuntimeInvocationError,
  safeFailureText,
  settleWithLeaseRelease,
  sharedLifecycleContaminationError,
  type PipeFailureRecord
} from "./processGroupLifecycle.js";
import { readOwnedAgentProcessStart } from "./tier1/restartPolicy.js";

export interface RuntimeChildOwnershipRecord {
  version: 1;
  pid: number;
  kind: string;
  binary: string;
  processStart: string | null;
  ownerPid: number;
  ownerInstanceId: string;
  runId: string;
  commandToken: string;
  generation: string;
  jobName: string;
}

export interface RuntimeChildLease {
  establish(): Promise<void>;
  release(): Promise<void>;
}

export interface RuntimeChildSpawnOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdin: "ignore" | "pipe";
  stdout: "ignore" | "pipe";
  stderr: "ignore" | "pipe" | "inherit";
  /** 覆盖进程级 registry 根;并行测试必须按调用方 HOME 隔离 */
  registryHome?: string;
  /** Windows Job / owner 精确 identity；不得用 commandToken 冒充 */
  runId?: string;
  signal?: AbortSignal;
}

/** Windows ReadStream 把 pipe write-end close 报成这些码，语义等于 end。 */
const PIPE_CLOSE_AS_END_CODES = new Set(["EOF", "EBADF"]);
/** 仅收口期可忽略的读端噪声。EPIPE 永不忽略。 */
const TERMINATING_PIPE_NOISE_CODES = new Set([
  "ECONNRESET",
  "UNKNOWN",
  "ERR_STREAM_DESTROYED",
  "ERR_STREAM_PREMATURE_CLOSE"
]);

/**
 * EOF/EBADF 是 write-end close ≡ end，活动期也忽略。
 * Linux 收口期 ECONNRESET、以及 Windows 收口期 UNKNOWN/destroy 是终止噪声。
 * EPIPE 始终失败，避免把真正的写端错误收成成功。
 */
export function shouldIgnoreTerminatingPipeError(code: string | undefined, terminating: boolean): boolean {
  if (code === undefined) return false;
  if (PIPE_CLOSE_AS_END_CODES.has(code)) return true;
  return terminating && TERMINATING_PIPE_NOISE_CODES.has(code);
}

export const RUNTIME_KILL_GRACE_MS = 5_000;
export const RUNTIME_DRAIN_DEADLINE_MS = 5_000;
export const RUNTIME_CLOSE_DEADLINE_MS = 5_000;
/** GetExitCodeProcess 的 STILL_ACTIVE。句柄已 signaled 后再读到它，只能是真实退出码。 */
const WIN32_STILL_ACTIVE_EXIT_CODE = 259;

export interface RuntimeChildTestHooks {
  now?: () => number;
  setTimeout?: (fn: () => void, ms: number) => NodeJS.Timeout;
  clearTimeout?: (timer: NodeJS.Timeout) => void;
  groupState?: (pid: number) => RuntimeProcessGroupState;
  hostKind?: () => HostKind;
  createNamedJob?: (name: string) => NamedJob;
  assignPidToJob?: (job: NamedJob, pid: number) => void;
  assignProcessHandleToJob?: (job: NamedJob, processHandle: unknown) => void;
  spawnOwnedWindows?: (input: {
    file: string;
    args: string[];
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    generation?: string;
  }) => OwnedWindowsProcess;
  closeNamedJob?: (job: NamedJob) => void;
  terminateNamedJob?: (job: NamedJob) => void;
  existingJob?: (pid: number) => NamedJob | undefined;
  processAlive?: (pid: number) => boolean;
  namedJobActiveCount?: (job: NamedJob) => number;
  closeDeadlineMs?: number;
  spawn?: (
    file: string,
    args: string[],
    options: RuntimeChildSpawnOptions,
    kind: string
  ) => Omit<SpawnedRuntimeChild, "generation" | "signal"> & {
    generation?: RuntimeJobGeneration | string;
    signal?: (signal: NodeJS.Signals) => void;
  };
  drainDeadlineMs?: number;
  killGraceMs?: number;
  onSpawn?: (file: string, args: string[], kind: string) => void;
  spawnImpl?: (
    file: string,
    args: string[],
    options: Parameters<typeof spawn>[2]
  ) => ChildProcessByStdio<Writable, Readable, Readable>;
  pidOf?: (child: ChildProcess) => number | undefined;
  killChild?: (child: ChildProcess) => void;
  killProcess?: (pid: number, signal: NodeJS.Signals) => void;
  processBirth?: (pid: number) => string | null;
  leaseReleaseError?: Error;
}

let runtimeTestHooks: RuntimeChildTestHooks = {};

export function setRuntimeChildTestHooks(hooks: RuntimeChildTestHooks | null): void {
  runtimeTestHooks = hooks ?? {};
}

export interface RuntimeJobGeneration {
  id: string;
  pid: number;
  ownerInstanceId: string;
  runId: string;
  processStart: string | null;
  jobName: string;
  job: NamedJob;
  commandToken: string;
  binary: string;
  kind: string;
  processHandle?: unknown;
}

function jobGeneration(pid: number, job: NamedJob, extra?: Partial<RuntimeJobGeneration>): RuntimeJobGeneration {
  const id = extra?.id ?? randomUUID();
  return {
    id,
    pid,
    ownerInstanceId: extra?.ownerInstanceId ?? runtimeOwnerInstanceId,
    runId: extra?.runId ?? `pid-${String(pid)}`,
    processStart: extra?.processStart ?? null,
    jobName: extra?.jobName ?? job.name,
    job,
    commandToken: extra?.commandToken ?? commandTokenForGeneration(id),
    binary: extra?.binary ?? process.execPath,
    kind: extra?.kind ?? "runtime",
    ...(extra?.processHandle !== undefined ? { processHandle: extra.processHandle } : {})
  };
}

function jobGenerationsMatch(left: RuntimeJobGeneration, right: RuntimeJobGeneration): boolean {
  return left.id === right.id &&
    left.pid === right.pid &&
    left.ownerInstanceId === right.ownerInstanceId &&
    left.runId === right.runId &&
    left.jobName === right.jobName &&
    left.processStart === right.processStart &&
    left.commandToken === right.commandToken &&
    left.processHandle === right.processHandle &&
    left.binary === right.binary &&
    left.kind === right.kind &&
    left.job.name === right.job.name &&
    left.job.handle === right.job.handle;
}

function registerGeneration(generation: RuntimeJobGeneration): void {
  const previous = runtimeJobs.get(generation.pid);
  if (previous && previous.id !== generation.id) {
    generationsById.delete(previous.id);
    jobSignalKillFailures.delete(previous.id);
  }
  runtimeJobs.set(generation.pid, generation);
  generationsById.set(generation.id, generation);
}

function forgetGeneration(generation: RuntimeJobGeneration): void {
  const current = runtimeJobs.get(generation.pid);
  if (current && current.id === generation.id) runtimeJobs.delete(generation.pid);
  generationsById.delete(generation.id);
}

export function installRuntimeJobForTests(
  pid: number,
  job: NamedJob,
  extra?: Partial<RuntimeJobGeneration>
): RuntimeJobGeneration {
  const generation = jobGeneration(pid, job, extra);
  registerGeneration(generation);
  return generation;
}

export function runtimeGenerationIsCurrent(generation: RuntimeJobGeneration): boolean {
  return generationIsCurrent(generation);
}

export function runtimeNow(): number {
  return runtimeTestHooks.now?.() ?? performance.now();
}

export function runtimeCloseDeadlineMs(): number {
  return runtimeTestHooks.closeDeadlineMs ?? RUNTIME_CLOSE_DEADLINE_MS;
}

export function runtimeDrainDeadlineMs(): number {
  return runtimeTestHooks.drainDeadlineMs ?? RUNTIME_DRAIN_DEADLINE_MS;
}

export function runtimeKillGraceMs(): number {
  return runtimeTestHooks.killGraceMs ?? RUNTIME_KILL_GRACE_MS;
}

export function runtimeSetTimeout(fn: () => void, ms: number): NodeJS.Timeout {
  if (runtimeTestHooks.setTimeout) return runtimeTestHooks.setTimeout(fn, ms);
  const timer = setTimeout(fn, ms);
  timer.unref?.();
  return timer;
}

export function runtimeClearTimeout(timer: NodeJS.Timeout | undefined): void {
  if (!timer) return;
  if (runtimeTestHooks.clearTimeout) {
    runtimeTestHooks.clearTimeout(timer);
    return;
  }
  clearTimeout(timer);
}

function effectiveHostKind(): HostKind {
  return runtimeTestHooks.hostKind?.() ?? hostKind();
}

export function runtimeChildRecordPath(home: string, pid: number): string {
  return join(home, "runtime", "children", `${String(pid)}.json`);
}

/**
 * cmd.exe 元字符。Node 在 Windows 上对 `shell: true` 是「把 file 与 args 用空格 join、零转义」
 * 后整串交给 `cmd.exe /d /s /c`,任何元字符都会被 cmd 当语法解释(命令拼接、重定向、变量展开)。
 * 我们不自己实现 cmd 引用规则(其引号/脱字符/`%` 展开的交互极易写出静默错误的转义),
 * 而是 fail-closed 拒绝:.cmd/.bat 目标一律要求参数不含元字符。需要传这类参数时,
 * 应改用 .exe 或显式 `node <script>` 形态,两者都不经 shell。
 */
export const CMD_SHELL_METACHARS = /[&|<>^"%!()\r\n]/u;

export function assertNoCmdShellMetachars(parts: readonly string[]): void {
  const bad = parts.find((part) => CMD_SHELL_METACHARS.test(part));
  if (bad !== undefined) {
    throw new Error(`cmd/bat 参数含 shell 元字符,fail-closed 拒绝执行:${bad.slice(0, 80)}`);
  }
}

export interface RuntimeInvocation {
  file: string;
  args: string[];
}

/**
 * Windows npm 的 cmd-shim 不经 cmd.exe：只接受 npm 完整标准 Node shim 模板，
 * 从唯一终端行取出 JS 入口后改为当前 node.exe 直接执行。
 * npm 的全局 bin 到 package 入口通常含 `..`；安全边界是“整份 shim 结构可证”，
 * 而不是把合法的相对目标误判为路径穿越。任何额外命令或非 Node 模板一律拒绝。
 */
export function resolveRuntimeInvocation(
  file: string,
  args: string[],
  platform: NodeJS.Platform = process.platform
): RuntimeInvocation {
  const extension = extname(file).toLowerCase();
  if (platform !== "win32" || (extension !== ".cmd" && extension !== ".bat")) return { file, args };
  const raw = readFileSync(file, "utf8");
  if (Buffer.byteLength(raw, "utf8") > 64 * 1024) throw new Error("cmd/bat shim 过大，拒绝解析");
  const text = raw.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
  const legacyMatch = text.match(
    /^@ECHO off\nGOTO start\n:find_dp0\nSET dp0=%~dp0\nEXIT \/b\n:start\nSETLOCAL\nCALL :find_dp0\n\nIF EXIST "%dp0%\\node\.exe" \(\n {2}SET "_prog=%dp0%\\node\.exe"\n\) ELSE \(\n {2}SET "_prog=node"\n {2}SET PATHEXT=%PATHEXT:;\.JS;=;%\n\)\n\nendLocal & goto #_undefined_# 2>NUL \|\| title %COMSPEC% & "%_prog%"\s+"%dp0%\\([^"\n]+?\.(?:cjs|mjs|js))" %\*\n?$/iu
  );
  // cmd-shim 9.x（npm 12 当前依赖）把 PATHEXT 收窄从 ELSE 分支移到唯一终端行。
  // 仍然整份锚定，只提取该标准模板的唯一 JS 入口。
  const currentMatch = text.match(
    /^@ECHO off\nGOTO start\n:find_dp0\nSET dp0=%~dp0\nEXIT \/b\n:start\nSETLOCAL\nCALL :find_dp0\n\nIF EXIST "%dp0%\\node\.exe" \(\n {2}SET "_prog=%dp0%\\node\.exe"\n\) ELSE \(\n {2}SET "_prog=node"\n\)\n\nendLocal & goto #_undefined_# 2>NUL \|\| title %COMSPEC% & set PATHEXT=%PATHEXT:;\.JS;=;% & "%_prog%"\s+"%dp0%\\([^"\n]+?\.(?:cjs|mjs|js))" %\*\n?$/iu
  );
  const candidate = (legacyMatch?.[1] ?? currentMatch?.[1])?.replace(/\\/gu, "/");
  if (!candidate) {
    throw new Error("cmd/bat 仅支持可证明的 npm node shim；请改用 .exe 或 node <script>");
  }
  if (candidate.includes("\0") || win32.isAbsolute(candidate)) {
    throw new Error("cmd/bat npm shim 的 JS 入口必须是相对路径");
  }
  const script = resolve(dirname(file), candidate);
  if (!existsSync(script) || !statSync(script).isFile()) {
    throw new Error("cmd/bat npm shim 的 JS 入口不存在或不是文件");
  }
  return { file: process.execPath, args: [realpathSync(script), ...args] };
}

/** 身份登记除 shim 本体外，还要钉住它最终执行的 JS 入口；非 shim 返回 null。 */
export function runtimeInvocationIdentityTarget(
  file: string,
  platform: NodeJS.Platform = process.platform
): string | null {
  const invocation = resolveRuntimeInvocation(file, [], platform);
  if (invocation.file !== process.execPath || invocation.args.length !== 1) return null;
  return invocation.args[0] as string;
}

export interface SpawnedRuntimeChild {
  child: ChildProcessByStdio<Writable, Readable, Readable>;
  lease: RuntimeChildLease;
  commandToken: string;
  generation?: RuntimeJobGeneration | string;
  signal?: (signal: NodeJS.Signals) => void;
}

const RUNTIME_CHILD_WRAPPER = String.raw`
const { spawn, spawnSync } = require("node:child_process");
const { appendFileSync, fstatSync, readSync } = require("node:fs");
const target = process.argv[2];
const args = JSON.parse(process.argv[3]);
let granted = false;
let child = null;
let draining = false;
// 调试轨迹默认关闭：置 SAYDO_WRAPPER_TRACE=1 才写。此前无条件对每个 stdout/stderr
// chunk 同步 appendFileSync 到固定 %TEMP% 文件，无开关无轮转无清理，长任务会持续
// 增长并叠加同步 I/O，且把 permit 管道名泄漏到 SAYDO_HOME 与 logger 之外。
const wtrace = process.platform === "win32" && process.env.SAYDO_WRAPPER_TRACE === "1"
  ? require("node:os").tmpdir() + "/saydo-wrapper-permit.txt"
  : "";
const wlog = (msg) => {
  if (!wtrace) return;
  try { appendFileSync(wtrace, performance.now() + " " + msg + "\n"); } catch {}
};
const wstat = (fd) => {
  try {
    const st = fstatSync(fd);
    return "fd" + fd + " isFIFO=" + st.isFIFO() + " isFile=" + st.isFile() + " isChar=" + st.isCharacterDevice() + " size=" + st.size;
  } catch (err) {
    return "fd" + fd + " throw=" + String(err && err.code);
  }
};
function otherGroupPids() {
  if (process.platform === "win32") return [];
  // Linux:直接扫 /proc。最小部署镜像(node:*-slim 等)常无 procps,
  // pgrep/ps 双缺时下面的回退会返回空表 => 后代静默逃逸收口。/proc 无额外依赖。
  if (process.platform === "linux") {
    try {
      const fsmod = require("node:fs");
      const out = [];
      for (const name of fsmod.readdirSync("/proc")) {
        if (!/^[0-9]+$/.test(name)) continue;
        const pid = Number(name);
        if (pid <= 1 || pid === process.pid) continue;
        try {
          const stat = fsmod.readFileSync("/proc/" + name + "/stat", "utf8");
          const close = stat.lastIndexOf(")");
          if (close < 0) continue;
          if (Number(stat.slice(close + 2).split(" ")[2]) === process.pid) out.push(pid);
        } catch {}
      }
      return out;
    } catch { return []; }
  }
  try {
    // 优先 pgrep -g（不依赖 setuid ps；macOS sandbox 常禁 /bin/ps）。
    const probe = spawnSync("pgrep", ["-g", String(process.pid)], {
      encoding: "utf8",
      timeout: 2000,
      detached: true
    });
    if (probe.status === 0 && typeof probe.stdout === "string") {
      return probe.stdout
        .split("\n")
        .map((line) => Number(line.trim()))
        .filter((pid) => Number.isInteger(pid) && pid > 1 && pid !== process.pid);
    }
    // 回退 ps 全表扫描（生产机可用时）。
    const ps = require("node:fs").existsSync("/bin/ps") ? "/bin/ps" : "/usr/bin/ps";
    const psProbe = spawnSync(ps, ["-ax", "-o", "pid=", "-o", "pgid="], {
      encoding: "utf8",
      timeout: 2000,
      detached: true
    });
    if (psProbe.status !== 0 || typeof psProbe.stdout !== "string") return [];
    return psProbe.stdout
      .split("\n")
      .map((line) => /^(\d+)\s+(\d+)$/.exec(line.trim()))
      .filter(Boolean)
      .map((match) => [Number(match[1]), Number(match[2])])
      .filter(([pid, pgid]) => Number.isInteger(pid) && pid !== process.pid && pgid === process.pid)
      .map(([pid]) => pid);
  } catch { return []; }
}
function signalOthers(signal) {
  for (const pid of otherGroupPids()) { try { process.kill(pid, signal); } catch {} }
}
function flushStdioThenExit(code) {
  if (process.platform !== "win32") {
    process.exit(code);
    return;
  }
  // 等 fd1/fd2 内核队列空再退；不得用固定超时截断尾部输出。
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    wlog("flush-exit " + code);
    process.exit(code);
  };
  const drained = (stream) => {
    if (!stream || !stream.writable || stream.destroyed) return true;
    const js = stream.writableLength || 0;
    const native = stream._handle && stream._handle.writeQueueSize ? stream._handle.writeQueueSize : 0;
    return js === 0 && native === 0;
  };
  const pendingBytes = (stream) => {
    if (!stream || !stream.writable || stream.destroyed) return 0;
    const js = stream.writableLength || 0;
    const native = stream._handle && stream._handle.writeQueueSize ? stream._handle.writeQueueSize : 0;
    return js + native;
  };
  // 只要队列还在变小就无限等——保持"不得用固定超时截断尾部输出"的原意。
  // 但若对端已停止读取,队列会长期纹丝不动:此前没有任何截止,wrapper 会在
  // setTimeout(wait,0) 里永久轮询不退出,上层最终只能按命令 wall timeout 或
  // close withheld 杀 Job,把一个成功退出的目标报告成失败。
  // 故只对"完全停滞"设限,不对总时长设限。
  let lastPending = -1;
  let stalledSince = 0;
  const wait = () => {
    if (drained(process.stdout) && drained(process.stderr)) {
      process.stdout.write("", () => {
        process.stderr.write("", () => finish());
      });
      return;
    }
    const pending = pendingBytes(process.stdout) + pendingBytes(process.stderr);
    const now = performance.now();
    if (pending !== lastPending) {
      lastPending = pending;
      stalledSince = now;
    } else if (stalledSince > 0 && now - stalledSince >= 10000) {
      wlog("flush-stalled pending=" + String(pending));
      finish();
      return;
    }
    setTimeout(wait, 0);
  };
  wait();
}
function drainAndExit(code) {
  if (draining) return;
  draining = true;
  signalOthers("SIGTERM");
  const killAt = performance.now() + 100;
  const deadline = performance.now() + 3000;
  const poll = () => {
    const pids = otherGroupPids();
    if (pids.length === 0) {
      if (process.platform === "win32") flushStdioThenExit(code);
      else process.exit(code);
      return;
    }
    if (performance.now() >= killAt) for (const pid of pids) { try { process.kill(pid, "SIGKILL"); } catch {} }
    if (performance.now() >= deadline) {
      if (process.platform === "win32") flushStdioThenExit(124);
      else process.exit(124);
      return;
    }
    setTimeout(poll, 20);
  };
  poll();
}
function attachSignals() {
  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.on(signal, () => {
      if (draining) return;
      if (!child) process.exit(signal === "SIGTERM" ? 143 : 130);
      try { child.kill(signal); } catch {}
    });
  }
}
function runTarget() {
  if (granted) return;
  granted = true;
  const js = require("node:path").extname(target).toLowerCase();
  const wrapJs = js === ".js" || js === ".mjs" || js === ".cjs" ||
    (process.platform === "win32" && js === "");
  const spawnFile = wrapJs ? process.execPath : target;
  const spawnArgs = wrapJs ? [target, ...args] : args;
  const unsupportedShell = process.platform === "win32" && (js === ".cmd" || js === ".bat");
  if (unsupportedShell) {
    process.stderr.write("saydo: unresolved cmd/bat target reached runtime wrapper (fail-closed)");
    drainAndExit(126);
    return;
  }
  const stdinEnded = process.stdin.readableEnded || process.stdin.destroyed;
  const inheritOut = process.platform !== "win32";
  child = spawn(spawnFile, spawnArgs, {
    cwd: process.cwd(),
    env: process.env,
    stdio: [stdinEnded ? "ignore" : "pipe", inheritOut ? "inherit" : "pipe", inheritOut ? "inherit" : "pipe"],
    windowsHide: true
  });
  if (!stdinEnded) {
    process.stdin.pipe(child.stdin);
    child.stdin.on("error", () => {});
  }
  child.once("error", () => { drainAndExit(127); });
  if (inheritOut) {
    child.once("exit", (code, signal) => {
      drainAndExit(signal ? 128 : (code ?? 1));
    });
    return;
  }
  // win32：exit 才有权威退出码；close 的 code 可能是 null，?? 1 会把 0 收成失败。
  // pipe 默认 end:true 会提前关掉 wrapper fd1，父进程读到空 stdout。
  let finalCode = 1;
  child.once("exit", (code, signal) => {
    wlog("child-exit code=" + String(code) + " signal=" + String(signal));
    if (signal) finalCode = 128;
    else if (typeof code === "number") finalCode = code;
  });
  if (child.stdout) {
    wlog("child-stdout fd=" + String(child.stdout.fd) + " readable=" + String(child.stdout.readable));
    child.stdout.on("data", (chunk) => {
      wlog("child-stdout-data n=" + String(chunk && chunk.length));
    });
    child.stdout.on("end", () => { wlog("child-stdout-end"); });
    child.stdout.pipe(process.stdout, { end: false });
    child.stdout.on("error", (err) => { wlog("child-stdout-error code=" + String(err && err.code)); });
  } else {
    wlog("child-stdout missing");
  }
  if (child.stderr) {
    child.stderr.on("data", (chunk) => {
      wlog("child-stderr-data n=" + String(chunk && chunk.length));
    });
    child.stderr.on("end", () => { wlog("child-stderr-end"); });
    child.stderr.pipe(process.stderr, { end: false });
    child.stderr.on("error", (err) => { wlog("child-stderr-error code=" + String(err && err.code)); });
  }
  child.once("close", () => {
    wlog("child-close");
    drainAndExit(finalCode);
  });
}
if (process.platform === "win32") {
  wlog("enter " + process.platform);
  wlog(wstat(0));
  wlog(wstat(1));
  wlog(wstat(2));
  wlog(wstat(3));
  wlog("stdout.fd=" + String(process.stdout.fd) + " isTTY=" + String(process.stdout.isTTY));
  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.on(signal, () => {
      if (draining) return;
      if (!child) process.exit(signal === "SIGTERM" ? 143 : 130);
      try { child.kill(signal); } catch {}
    });
  }
  const pipeName = process.env.SAYDO_PERMIT_PIPE;
  wlog("pipe=" + String(pipeName));
  if (typeof pipeName !== "string" || pipeName.length === 0) process.exit(125);
  try {
    const fd = require("node:fs").openSync(pipeName, "r");
    wlog("opened");
    const permitBuf = Buffer.alloc(8);
    const n = readSync(fd, permitBuf, 0, permitBuf.length, null);
    wlog("after-read n=" + String(n));
    try { require("node:fs").closeSync(fd); } catch {}
    if (n <= 0) process.exit(125);
  } catch (err) {
    wlog("permit-throw code=" + String(err && err.code));
    process.exit(125);
  }
  runTarget();
  wlog("after-runTarget pid=" + String(child && child.pid));
} else {
  const { createReadStream } = require("node:fs");
  const permit = createReadStream(null, { fd: 3, autoClose: true });
  permit.once("data", () => runTarget());
  permit.once("end", () => { if (!granted) process.exit(125); });
  attachSignals();
}
`;

export function runtimeChildJobName(pid: number): string | undefined {
  return runtimeJobs.get(pid)?.job.name;
}

const jobSignalKillFailures = new Map<string, ProcessGroupLifecycleError>();

function readOwnErrorCode(err: unknown): string | undefined {
  return readOwnErrnoCode(err);
}

function invokeProcessKill(pid: number, signal: NodeJS.Signals): void {
  (runtimeTestHooks.killProcess ?? process.kill)(pid, signal);
}

function throwUnlessEsrch(err: unknown, signal: NodeJS.Signals): void {
  if (readOwnErrorCode(err) === "ESRCH") return;
  throw contaminateRuntimeChildLifecycle(projectTrustedKillFailure(signal, err, "primary"));
}

function rememberJobSignalFailure(generationId: string, current: ProcessGroupLifecycleError): ProcessGroupLifecycleError {
  const prior = jobSignalKillFailures.get(generationId);
  const stored = prior && prior !== current
    ? asProcessGroupLifecycleError(combineLifecycleFailures(prior, current))
    : current;
  jobSignalKillFailures.set(generationId, stored);
  return current;
}

function generationIsCurrent(generation: RuntimeJobGeneration): boolean {
  const current = runtimeJobs.get(generation.pid);
  return !!current && jobGenerationsMatch(current, generation);
}

export function signalRuntimeChildGeneration(generation: RuntimeJobGeneration, signal: NodeJS.Signals): void {
  if (!generationIsCurrent(generation)) return;
  if (effectiveHostKind() === "win32") {
    try {
      (runtimeTestHooks.terminateNamedJob ?? terminateNamedJobHandle)(generation.job);
    } catch (err) {
      throw rememberJobSignalFailure(generation.id, contaminateRuntimeChildLifecycle(err));
    }
    return;
  }
  if (typeof generation.processStart !== "string" || generation.processStart.length === 0) {
    throw contaminateRuntimeChildLifecycle(new ProcessGroupLifecycleError(
      "posix destructive signal requires captured birth"
    ));
  }
  let observed: string | null;
  try {
    observed = runtimeTestHooks.processBirth
      ? runtimeTestHooks.processBirth(generation.pid)
      : processBirth(generation.pid);
  } catch (err) {
    throw contaminateRuntimeChildLifecycle(err);
  }
  if (observed === null || observed.length === 0) {
    const state = runtimeProcessGroupState(generation.pid);
    if (state === "gone") return;
    throw contaminateRuntimeChildLifecycle(new ProcessGroupLifecycleError(
      "posix destructive signal birth unavailable while process/group alive"
    ));
  }
  if (observed !== generation.processStart) {
    throw contaminateRuntimeChildLifecycle(new ProcessGroupLifecycleError(
      "posix destructive signal birth mismatch"
    ));
  }
  try {
    invokeProcessKill(-generation.pid, signal);
  } catch (err) {
    throwUnlessEsrch(err, signal);
  }
}

export function signalRuntimeChildTree(pid: number, signal: NodeJS.Signals): void {
  const owned = runtimeJobs.get(pid);
  if (!owned) {
    throw contaminateRuntimeChildLifecycle(new ProcessGroupLifecycleError(
      "runtime job identity missing"
    ));
  }
  signalRuntimeChildGeneration(owned, signal);
}
/** wrapper 源码(供门禁做语法自检:它经 `node -e` 执行,语法错会让所有受管子进程静默失败)。 */
export function runtimeChildWrapperSource(): string {
  return RUNTIME_CHILD_WRAPPER;
}

let runtimeChildHome: string | undefined;
let runtimeOwnerInstanceId = `pid-${String(process.pid)}`;
const runtimeJobs = new Map<number, RuntimeJobGeneration>();
const generationsById = new Map<string, RuntimeJobGeneration>();
let runtimeChildLifecycleContamination: ProcessGroupLifecycleError | null = null;

export function runtimeChildLifecycleError(): ProcessGroupLifecycleError | null {
  return runtimeChildLifecycleContamination ?? sharedLifecycleContaminationError();
}

export function contaminateRuntimeChildLifecycle(err: unknown): ProcessGroupLifecycleError {
  const current = asProcessGroupLifecycleError(err);
  runtimeChildLifecycleContamination ??= current;
  contaminateSharedLifecycle(current);
  return current;
}

export function assertRuntimeChildExactEmpty(home = runtimeChildHome): void {
  const jobs = remainingRuntimeJobCount();
  const owners = remainingRuntimeChildOwnerCount(home);
  const contamination = runtimeChildLifecycleError();
  if (jobs > 0 || owners > 0 || contamination) {
    throw new ProcessGroupLifecycleError(
      `runtime child exact-empty failed:jobs=${String(jobs)}:owners=${String(owners)}:${contamination ? safeFailureText(contamination) : "clean"}`
    );
  }
}

export function resetRuntimeChildLifecycleForTests(): void {
  const leakedJobs = [...runtimeJobs.entries()];
  const contamination = runtimeChildLifecycleError();
  const closeErrors: string[] = [];
  for (const [pid, generation] of leakedJobs) {
    try {
      (runtimeTestHooks.closeNamedJob ?? closeNamedJob)(generation.job);
    } catch (err) {
      closeErrors.push(safeFailureText(err, 160));
    }
    runtimeJobs.delete(pid);
    generationsById.delete(generation.id);
  }
  generationsById.clear();
  runtimeChildLifecycleContamination = null;
  jobSignalKillFailures.clear();
  resetSharedLifecycleForTests();
  if (leakedJobs.length > 0 || contamination || closeErrors.length > 0) {
    throw new ProcessGroupLifecycleError(
      `test reset observed leak:jobs=${String(leakedJobs.length)}:contaminated=${contamination ? "yes" : "no"}:close=${closeErrors.join(",") || "ok"}`
    );
  }
}

export function remainingRuntimeJobCount(): number {
  return runtimeJobs.size;
}

export function runtimeJobRegistered(pid: number): boolean {
  return runtimeJobs.has(pid);
}

export function runtimeGenerationRegistered(id: string): boolean {
  return generationsById.has(id);
}

export function remainingRuntimeGenerationCount(): number {
  return generationsById.size;
}

export function runtimeJobPidsForTests(): number[] {
  return [...runtimeJobs.keys()];
}

export function remainingRuntimeChildOwnerCount(home = runtimeChildHome): number {
  if (!home) return 0;
  const root = join(home, "runtime", "children");
  if (!existsSync(root)) return 0;
  return readdirSync(root).filter((name) => name.endsWith(".json")).length;
}

export function assertRuntimeChildShutdownAllowsStopped(home = runtimeChildHome): void {
  const contamination = runtimeChildLifecycleError();
  if (contamination) throw contamination;
  if (remainingRuntimeJobCount() > 0) {
    throw new ProcessGroupLifecycleError("runtime jobs not empty at shutdown");
  }
  if (remainingRuntimeChildOwnerCount(home) > 0) {
    throw new ProcessGroupLifecycleError("runtime child owners not empty at shutdown");
  }
}

export function configureRuntimeChildRegistry(home: string, ownerInstanceId = `pid-${String(process.pid)}`): void {
  runtimeChildHome = home;
  runtimeOwnerInstanceId = ownerInstanceId;
}

export function runtimeChildOwnerIdentity(): { ownerPid: number; ownerInstanceId: string } {
  return { ownerPid: process.pid, ownerInstanceId: runtimeOwnerInstanceId };
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new ProcessGroupLifecycleError("runtime recover aborted");
}

export interface RecoverPriorOwnersOptions {
  signal?: AbortSignal;
  afterKillBeforeDelete?: () => Promise<void> | void;
}

export async function recoverPriorGenerationRuntimeOwners(
  home: string,
  current: { ownerPid: number; ownerInstanceId: string },
  options: RecoverPriorOwnersOptions = {}
): Promise<number> {
  throwIfAborted(options.signal);
  const root = join(home, "runtime", "children");
  if (!existsSync(root)) return 0;
  const names = readdirSync(root).filter((name) => name.endsWith(".json"));
  let reaped = 0;
  for (const name of names) {
    throwIfAborted(options.signal);
    const path = join(root, name);
    const captured = await withHomeOwnerBoundary(home, () => {
      throwIfAborted(options.signal);
      let parsed: ReturnType<typeof parseAnyRuntimeOwnerRecord>;
      try {
        parsed = parseAnyRuntimeOwnerRecord(JSON.parse(readFileSync(path, "utf8")) as unknown);
      } catch {
        throw new ProcessGroupLifecycleError("prior runtime owner unreadable");
      }
      if (parsed.status === "invalid") {
        throw new ProcessGroupLifecycleError("prior runtime owner invalid");
      }
      return parsed.record;
    }, options.signal ? { signal: options.signal } : {});
    if (captured.ownerPid === current.ownerPid && captured.ownerInstanceId === current.ownerInstanceId) {
      continue;
    }
    if (effectiveHostKind() === "win32" && !win32JobIdentityOk(captured)) {
      throw new ProcessGroupLifecycleError("prior runtime owner identity incomplete");
    }
    const identity = runtimeOwnerIdentity(captured);
    if (captured.processStart !== null) {
      try {
        await killOwnedTree({
          pid: captured.pid,
          expectedBirth: captured.processStart,
          ...(effectiveHostKind() === "win32"
            ? {
                jobName: captured.jobName,
                ownerInstanceId: captured.ownerInstanceId,
                runId: captured.runId,
                generation: captured.generation
              }
            : {})
        });
      } catch (err) {
        throw asProcessGroupLifecycleError(err);
      }
    } else if (runtimeProcessGroupState(captured.pid) !== "gone") {
      throw new ProcessGroupLifecycleError("prior runtime owner still live");
    }
    throwIfAborted(options.signal);
    if (effectiveHostKind() === "win32" && captured.jobName && captured.ownerInstanceId && captured.runId) {
      let observed;
      try {
        observed = observeVerifiedOwnedJob({
          jobName: captured.jobName,
          ownerInstanceId: captured.ownerInstanceId,
          runId: captured.runId,
          generation: captured.generation,
          pid: captured.pid,
          expectedBirth: captured.processStart ?? "pending-unestablished"
        });
      } catch (err) {
        throw asProcessGroupLifecycleError(err);
      }
      if (observed.kind !== "already_exited") {
        throw new ProcessGroupLifecycleError("prior runtime owner not proven drained");
      }
    }
    if (options.afterKillBeforeDelete) await options.afterKillBeforeDelete();
    throwIfAborted(options.signal);
    let deleted = false;
    await withHomeOwnerBoundary(home, () => {
      throwIfAborted(options.signal);
      try {
        commitOwnerReapIfIdentity(
          path,
          identity,
          () => {
            appendReapAudit(home, {
              action: "runtime.prior_owner_reaped",
              kind: captured.kind,
              pid: captured.pid,
              ownerInstanceId: captured.ownerInstanceId,
              runId: captured.runId,
              generation: captured.generation
            });
          },
          () => {
            rmSync(path, { force: true });
          }
        );
        deleted = true;
      } catch (err) {
        if (isOwnerIdentityCasError(err)) return;
        throw asProcessGroupLifecycleError(err);
      }
    }, options.signal ? { signal: options.signal } : {});
    if (deleted) reaped += 1;
  }
  return reaped;
}

function prepareRuntimeChildRoot(home = runtimeChildHome): void {
  if (!home) return;
  const runtimeDir = join(home, "runtime");
  const root = join(runtimeDir, "children");
  // ADR-004 P0：durable ownership 记录与锁同属 owner-only 机密。Windows 上 mode 位
  // 不构成访问控制，需去继承 ACL；且 runtime/ 若被预置成 junction，ownership 记录会
  // 落到信任边界外，控制该目录的进程即可替换记录、制造错误 CAS 或诱导误 reap。
  mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });
  if (isReparsePoint(runtimeDir)) {
    throw new ProcessGroupLifecycleError(`runtime root is a reparse point:${runtimeDir}`);
  }
  restrictOwnerOnly(runtimeDir, "dir");
  mkdirSync(root, { recursive: true, mode: 0o700 });
  if (isReparsePoint(root)) {
    throw new ProcessGroupLifecycleError(`runtime children root is a reparse point:${root}`);
  }
  restrictOwnerOnly(root, "dir");
  const probe = join(root, `.write-probe-${process.pid}-${randomUUID()}`);
  let created = false;
  try {
    writeFileSync(probe, "", { flag: "wx", mode: 0o600 });
    created = true;
  } finally {
    if (created) rmSync(probe, { force: true });
  }
}

export type RuntimeProcessGroupState = "alive" | "gone" | "unknown";

export function runtimeProcessGroupState(pid: number): RuntimeProcessGroupState {
  if (runtimeTestHooks.groupState) {
    try {
      return runtimeTestHooks.groupState(pid);
    } catch {
      return "unknown";
    }
  }
  if (effectiveHostKind() === "win32") {
    try {
      const job = runtimeJobs.get(pid);
      if (job) {
        try {
          const active = (runtimeTestHooks.namedJobActiveCount ?? namedJobActiveProcessCount)(job.job);
          if (active > 0) return "alive";
          return "gone";
        } catch {
          return "unknown";
        }
      }
      try {
        return (runtimeTestHooks.processAlive ?? processAlive)(pid) ? "alive" : "gone";
      } catch (err) {
        const kind = classifyKillProbe(err);
        if (kind === "alive") return "alive";
        if (kind === "gone") return "gone";
        return "unknown";
      }
    } catch {
      return "unknown";
    }
  }
  try {
    process.kill(-pid, 0);
    return "alive";
  } catch (err) {
    const kind = classifyKillProbe(err);
    if (kind === "gone") return "gone";
    if (kind === "alive") return "alive";
    return "unknown";
  }
}

function groupAlive(pid: number): boolean {
  return runtimeProcessGroupState(pid) !== "gone";
}

function writeRecord(path: string, record: RuntimeChildOwnershipRecord): void {
  const dirFsync = writeDurableJson(path, record);
  if (dirFsync !== "synced" && dirFsync !== "unsupported") {
    throw new ProcessGroupLifecycleError("runtime owner dir fsync result invalid");
  }
}

/**
 * detached 子进程返回 PID 后立即写 pending owner；目标执行前等待 birth identity 落盘。
 * CLI 只会按 birth identity 或不可复用 command token 回收，未知进程一律 fail-closed。
 */
export function beginRuntimeChild(
  pid: number,
  binary: string,
  kind: string,
  options: {
    commandToken?: string;
    generation?: string;
    permit?: NodeJS.WritableStream;
    jobName?: string;
    registryHome?: string;
    runId?: string;
    processHandle?: unknown;
    processStart?: string | null;
    deferPermit?: boolean;
    afterDurableOwner?: () => void | Promise<void>;
    signal?: AbortSignal;
  } = {}
): RuntimeChildLease {
  const home = options.registryHome ?? runtimeChildHome;
  if (!home || pid <= 1) {
    throw new ProcessGroupLifecycleError("runtime child registry missing");
  }
  const root = join(home, "runtime", "children");
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const path = join(root, `${String(pid)}.json`);
  const runId = options.runId;
  if (!isSayDoIdentityToken(runId) || !isSayDoIdentityToken(runtimeOwnerInstanceId)) {
    throw new ProcessGroupLifecycleError("runtime child run identity missing");
  }
  if (!isTrustedCommandToken(options.commandToken) || !isSayDoGeneration(options.generation)) {
    throw new ProcessGroupLifecycleError("runtime child command token missing");
  }
  const generation = options.generation;
  const jobName = options.jobName ?? formatSayDoJobName("Local", runtimeOwnerInstanceId, runId, generation);
  const pending: RuntimeChildOwnershipRecord = {
    version: 1,
    pid,
    kind: kind.slice(0, 80),
    binary,
    processStart: options.processStart === undefined ? null : options.processStart,
    ownerPid: process.pid,
    ownerInstanceId: runtimeOwnerInstanceId,
    runId,
    commandToken: options.commandToken,
    generation,
    jobName
  };
  withHomeOwnerBoundarySync(home, () => {
    writeRecord(path, pending);
  });
  let released = false;
  let establishedStart: string | null = pending.processStart;
  const identityOf = (processStart: string | null): OwnerImmutableIdentity => ({
    version: 1,
    pid,
    processStart,
    ownerPid: process.pid,
    ownerInstanceId: runtimeOwnerInstanceId,
    runId,
    jobName,
    binary,
    kind: pending.kind,
    commandToken: options.commandToken as string,
    generation
  });
  const endPermit = (token?: string): void => {
    try {
      if (token !== undefined) options.permit?.end(token);
      else options.permit?.end();
    } catch {
      // permit 可能已关
    }
  };
  return {
    async establish() {
      if (released) {
        endPermit();
        return;
      }
      let processStart = establishedStart;
      if (processStart === null) {
        const startedAt = runtimeNow();
        const deadline = startedAt + 2_000;
        while (!released && processStart === null) {
          const t = runtimeNow();
          if (t >= deadline || t < startedAt) break;
          processStart = effectiveHostKind() === "win32"
            ? (options.processHandle
              ? processBirthFromHandle(options.processHandle, pid)
              : processBirth(pid))
            : readOwnedAgentProcessStart(pid, binary, options.commandToken);
          if (processStart === null && groupAlive(pid)) {
            await new Promise((resolve) => {
              runtimeSetTimeout(() => resolve(undefined), 20);
            });
          } else if (processStart === null) return;
        }
      }
      if (released) {
        endPermit();
        return;
      }
      if (processStart === null) {
        endPermit();
        throw new ProcessGroupLifecycleError(`runtime child ownership identity unavailable:${kind}:${String(pid)}`);
      }
      establishedStart = processStart;
      const currentJob = runtimeJobs.get(pid);
      if (currentJob && currentJob.id === generation) {
        currentJob.processStart = processStart;
      }
      await withHomeOwnerBoundary(home, () => {
        writeRecord(path, { ...pending, processStart });
      });
      if (released || options.signal?.aborted) {
        endPermit();
        if (options.signal?.aborted) throw new ProcessGroupLifecycleError("runtime child establish aborted");
        return;
      }
      await options.afterDurableOwner?.();
      if (released || options.signal?.aborted) {
        endPermit();
        if (options.signal?.aborted) throw new ProcessGroupLifecycleError("runtime child establish aborted");
        return;
      }
      if (!options.deferPermit) endPermit("1");
    },
    async release() {
      released = true;
      endPermit();
      if (runtimeJobs.has(pid) && runtimeJobs.get(pid)?.id === generation) return;
      if (runtimeProcessGroupState(pid) !== "gone") return;
      await withHomeOwnerBoundary(home, () => {
        try {
          commitOwnerReapIfIdentity(
            path,
            identityOf(establishedStart),
            () => {
              appendReapAudit(home, {
                action: "runtime.owner_released",
                kind: pending.kind,
                pid,
                ownerInstanceId: runtimeOwnerInstanceId,
                runId,
                generation
              });
            },
            () => {
              rmSync(path, { force: true });
            }
          );
        } catch (err) {
          if (isOwnerIdentityCasError(err)) return;
          throw err;
        }
      });
    }
  };
}

/**
 * wrapper 在收到 permit 前不 spawn 目标；daemon 硬退会关掉通道，wrapper 自退。
 * POSIX 走 fd3；win32 走 SAYDO_PERMIT_PIPE 命名管道（不依赖 CRT lpReserved2）。
 * durable birth owner 原子发布后才写 permit，因此不存在“目标已执行但 owner 仍 pending”的窗口。
 */
function resolveSpawnFile(file: string, env?: NodeJS.ProcessEnv): string {
  if (hostKind() !== "win32") return file;
  if (file.includes("/") || file.includes("\\") || extname(file) !== "") {
    return file;
  }
  const pathEnv = env?.PATH ?? process.env.PATH ?? "";
  const pathext = (env?.PATHEXT ?? process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";").filter(Boolean);
  for (const dir of pathEnv.split(delimiter)) {
    if (!dir) continue;
    for (const suffix of pathext) {
      const candidate = join(dir, file + suffix);
      if (existsSync(candidate)) return candidate;
    }
  }
  return file;
}

/** Windows 上无扩展名/.js 的 agent 必须经 node.exe;生产 cursor-agent.exe 直跑。 */
export function execAgentFileSync(
  file: string,
  args: string[],
  options: { encoding: "utf8"; timeout?: number } = { encoding: "utf8" }
): string {
  const resolved = resolveSpawnFile(file);
  const invocation = resolveRuntimeInvocation(resolved, args);
  const ext = extname(invocation.file).toLowerCase();
  const wrapJs = ext === ".js" || ext === ".mjs" || ext === ".cjs" ||
    (hostKind() === "win32" && ext === "");
  const spawnFile = wrapJs ? process.execPath : invocation.file;
  const spawnArgs = wrapJs ? [invocation.file, ...invocation.args] : invocation.args;
  return execFileSync(spawnFile, spawnArgs, {
    encoding: options.encoding,
    ...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
    windowsHide: true
  }).trim();
}

function swallowStreamError(stream: { on?(event: "error", listener: () => void): unknown } | null | undefined): void {
  if (typeof stream?.on === "function") stream.on("error", () => undefined);
}

let rollbackInFlight: Promise<void> = Promise.resolve();
let rollbackBusy = 0;

export function pendingRuntimeChildRollback(): Promise<void> {
  return rollbackInFlight;
}

function enqueueRollback(work: Promise<void>): void {
  rollbackBusy += 1;
  rollbackInFlight = rollbackInFlight.then(() => work, () => work).finally(() => {
    rollbackBusy -= 1;
  });
}

async function waitChildTerminal(
  child: ChildProcessByStdio<Writable, Readable, Readable>,
  deadlineMs = RUNTIME_DRAIN_DEADLINE_MS
): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  const startedAt = runtimeNow();
  return await new Promise((resolve) => {
    const finish = (ok: boolean): void => {
      runtimeClearTimeout(timer);
      resolve(ok);
    };
    const timer = runtimeSetTimeout(() => finish(false), deadlineMs);
    child.once("close", () => finish(true));
    child.once("exit", () => {
      if (runtimeNow() - startedAt >= deadlineMs) finish(false);
    });
  });
}

async function abandonSpawnedWrapper(
  child: ChildProcessByStdio<Writable, Readable, Readable>,
  job: NamedJob | undefined,
  permitWritable: Writable | undefined,
  processHandle?: unknown
): Promise<void> {
  swallowStreamError(child.stdin);
  swallowStreamError(child.stdout);
  swallowStreamError(child.stderr);
  swallowStreamError(permitWritable);
  try { permitWritable?.end(); } catch { /* pipe 可能已断 */ }
  try { child.stdin.end(); } catch { /* pipe 可能已断 */ }
  try { child.stdout.resume(); } catch { /* 已结束 */ }
  try { child.stderr.resume(); } catch { /* 已结束 */ }
  const realWindows = hostKind() === "win32";
  try {
    if (processHandle !== undefined) {
      terminateProcessFromHandle(processHandle);
    } else if (realWindows) {
      if (!job) throw new ProcessGroupLifecycleError("runtime job identity missing");
      (runtimeTestHooks.terminateNamedJob ?? terminateNamedJobHandle)(job);
    } else {
      if (job && runtimeTestHooks.terminateNamedJob) {
        runtimeTestHooks.terminateNamedJob(job);
      }
      (runtimeTestHooks.killChild ?? ((target: ChildProcess) => { target.kill("SIGKILL"); }))(child);
    }
  } catch (err) {
    if (job && child.pid) {
      registerGeneration(jobGeneration(child.pid, job, processHandle !== undefined ? { processHandle } : {}));
    }
    contaminateRuntimeChildLifecycle(err);
    return;
  }
  const terminal = await waitChildTerminal(child);
  if (!terminal) {
    if (job && child.pid) {
      registerGeneration(jobGeneration(child.pid, job, processHandle !== undefined ? { processHandle } : {}));
    }
    contaminateRuntimeChildLifecycle(new ProcessGroupLifecycleError(
      `runtime child rollback did not exit:${String(child.pid ?? "unknown")}`
    ));
    return;
  }
  if (job) {
    const current = child.pid ? runtimeJobs.get(child.pid) : undefined;
    if (current && current.job === job) forgetGeneration(current);
    try {
      (runtimeTestHooks.closeNamedJob ?? closeNamedJob)(job);
    } catch (err) {
      if (child.pid) {
        registerGeneration(jobGeneration(child.pid, job, processHandle !== undefined ? { processHandle } : {}));
      }
      contaminateRuntimeChildLifecycle(err);
    }
  }
}

function rollbackAndThrow(
  child: ChildProcessByStdio<Writable, Readable, Readable>,
  job: NamedJob | undefined,
  permitWritable: Writable | undefined,
  err: unknown,
  processHandle?: unknown
): never {
  enqueueRollback(abandonSpawnedWrapper(child, job, permitWritable, processHandle));
  throw err;
}

async function teardownRuntimeJob(expected: RuntimeJobGeneration): Promise<void> {
  const priorSignalKill = jobSignalKillFailures.get(expected.id);
  const current = generationsById.get(expected.id) ?? runtimeJobs.get(expected.pid);
  if (!current || current.id !== expected.id) {
    return;
  }
  if (!jobGenerationsMatch(current, expected)) {
    return;
  }
  // signal 路径已记下的 Job 失败不得在 release 再 TerminateJob 投影成新对象；
  // 第二次 distinct Job 失败只来自另一次 signalRuntimeChildTree。
  if (priorSignalKill) throw priorSignalKill;
  const job = current.job;
  let active: number;
  try {
    active = (runtimeTestHooks.namedJobActiveCount ?? namedJobActiveProcessCount)(job);
  } catch (err) {
    throw contaminateRuntimeChildLifecycle(err);
  }
  if (active > 0) {
    try {
      (runtimeTestHooks.terminateNamedJob ?? terminateNamedJobHandle)(job);
    } catch (err) {
      throw contaminateRuntimeChildLifecycle(err);
    }
    const deadline = runtimeNow() + (runtimeTestHooks.drainDeadlineMs ?? RUNTIME_DRAIN_DEADLINE_MS);
    while (runtimeNow() < deadline) {
      try {
        active = (runtimeTestHooks.namedJobActiveCount ?? namedJobActiveProcessCount)(job);
      } catch (err) {
        throw contaminateRuntimeChildLifecycle(err);
      }
      if (active === 0) break;
      await new Promise((resolve) => {
        runtimeSetTimeout(() => resolve(undefined), 20);
      });
    }
    if (active > 0) {
      throw contaminateRuntimeChildLifecycle(new ProcessGroupLifecycleError(
        `runtime child process group did not exit:${String(expected.pid)}`
      ));
    }
  }
  try {
    (runtimeTestHooks.closeNamedJob ?? closeNamedJob)(job);
  } catch (err) {
    throw contaminateRuntimeChildLifecycle(err);
  }
  if (current.processHandle !== undefined) {
    try {
      closeRawHandle(current.processHandle, "runtime-process");
    } catch (err) {
      throw contaminateRuntimeChildLifecycle(err);
    }
  }
  forgetGeneration(expected);
}

/**
 * Windows `fs.ReadStream` 在匿名 pipe 的 write-end 关闭时，常把 UV_EOF / ERROR_BROKEN_PIPE
 * 以 `error` 而不是 `end` 抛出。owned 流上这些码等于读完，转成 wrapper 的 end。
 * 假 spawn 的 PassThrough 不经此函数，exit→EPIPE 仍失败。
 */
const OWNED_WINDOWS_READ_PIPE_CLOSE_CODES = new Set([
  "EOF",
  "EBADF",
  "EPIPE",
  "ECONNRESET",
  "UNKNOWN",
  "ERR_STREAM_DESTROYED",
  "ERR_STREAM_PREMATURE_CLOSE"
]);

function wrapOwnedWindowsReadStream(stream: Readable): Readable {
  const out = new PassThrough();
  let done = false;
  const finish = (): void => {
    if (done) return;
    done = true;
    if (!out.destroyed && !out.writableEnded) out.end();
  };
  stream.on("data", (chunk: Buffer | string) => {
    if (done || out.destroyed || !out.writable) return;
    out.write(chunk);
  });
  stream.once("end", finish);
  stream.once("close", finish);
  stream.on("error", (err: unknown) => {
    const code = inspectUntrustedPipeFailure(err).trustedCode;
    if (code !== undefined && OWNED_WINDOWS_READ_PIPE_CLOSE_CODES.has(code)) {
      finish();
      return;
    }
    if (!out.destroyed) out.emit("error", err);
    finish();
  });
  out.on("error", () => undefined);
  return out;
}

function childFromOwnedWindows(
  owned: OwnedWindowsProcess
): ChildProcessByStdio<Writable, Readable, Readable> {
  const stdout = wrapOwnedWindowsReadStream(owned.stdout as unknown as Readable);
  const stderr = wrapOwnedWindowsReadStream(owned.stderr as unknown as Readable);
  const child = new EventEmitter() as ChildProcessByStdio<Writable, Readable, Readable>;
  child.stdin = owned.stdin as unknown as Writable;
  child.stdout = stdout;
  child.stderr = stderr;
  Object.defineProperty(child, "stdio", {
    value: [owned.stdin, stdout, stderr, owned.extra]
  });
  Object.defineProperty(child, "pid", { value: owned.pid });
  Object.defineProperty(child, "exitCode", { value: null, configurable: true, writable: true });
  Object.defineProperty(child, "signalCode", { value: null, configurable: true, writable: true });
  child.kill = (() => {
    throw new ProcessGroupLifecycleError("windows child.kill forbidden");
  }) as ChildProcess["kill"];
  let exitEmitted = false;
  let closeEmitted = false;
  let exitCode: number | null = null;
  let exitUnknown = false;
  const pending = new Set(["process", "stdout", "stderr", "stdin", "permit"]);
  const emitClose = (): void => {
    if (closeEmitted || pending.size > 0) return;
    closeEmitted = true;
    try {
      owned.disposeStdio();
    } catch {
      // 测试 stub 可能无 disposeStdio
    }
    child.emit("close", exitCode, null);
  };
  const mark = (name: string): void => {
    pending.delete(name);
    emitClose();
  };
  const onStreamDone = (stream: { once(event: string, listener: () => void): unknown } | null | undefined, name: string): void => {
    if (!stream) {
      mark(name);
      return;
    }
    let done = false;
    const finishStream = (): void => {
      if (done) return;
      done = true;
      mark(name);
    };
    stream.once("close", finishStream);
    stream.once("end", finishStream);
    stream.once("finish", finishStream);
    stream.once("error", finishStream);
  };
  onStreamDone(owned.stdout, "stdout");
  onStreamDone(owned.stderr, "stderr");
  onStreamDone(owned.stdin, "stdin");
  onStreamDone(owned.extra, "permit");
  owned.stdin.on("error", (err: unknown) => {
    const code = inspectUntrustedPipeFailure(err).trustedCode;
    if (code === "EPIPE" || code === "EOF") return;
    child.emit("error", err);
  });
  owned.extra.on("error", (err: unknown) => {
    const code = inspectUntrustedPipeFailure(err).trustedCode;
    if (code === "EPIPE" || code === "EOF") return;
    child.emit("error", err);
  });
  const emitExit = (code: number): void => {
    if (exitEmitted) return;
    exitEmitted = true;
    exitCode = code;
    Object.defineProperty(child, "exitCode", { value: code, configurable: true });
    child.emit("exit", code, null);
    mark("process");
  };
  // `waitForExit(0)` 的 "timeout" 与 `readExitCode()` 的 "live" 都表示子进程**仍在正常运行**
  // （零超时的 WaitForSingleObject 对未 signaled 的句柄返回 WAIT_TIMEOUT，这是正常返回值，
  // 不是错误）。因此不得对这两种状态套用任何从 spawn 起算的 deadline——否则任何存活时间超过
  // RUNTIME_CLOSE_DEADLINE_MS 的健康 Tier1 agent 都会被判为超时，走 emit("error") →
  // executor beginFinish(127) → hardKill → TerminateJobObject，把整个 Job 连同后代杀光。
  // 有界重试只对真正的异常读数（WAIT_FAILED / 退出码不可读）生效，且从**首次异常**开始计时。
  const anomalyBudgetMs = runtimeTestHooks.closeDeadlineMs ?? RUNTIME_CLOSE_DEADLINE_MS;
  let anomalyStartedAt: number | null = null;
  const poll = (): void => {
    // 平台层为 waitForExit / readExitCode 定义了 "wait-process" / "exit-code" 故障点，
    // Koffi/native 异常会从 timer 回调逃逸成未捕获异常并直接打崩 daemon（无总兜底），
    // 届时 contamination、child error/close、lease 与 HANDLE 收口全都不会发生。
    // 统一转成 finishUnknown：与其他不可判定读数同路收口。
    // 正常读数：清掉异常计时，健康进程永远不因存活时长被判死。
    const clearAnomaly = (): void => {
      anomalyStartedAt = null;
    };
    // 异常读数：首次进入时起算，此后按预算判定；wall 回拨视为到期。
    const boundedOut = (): boolean => {
      const now = runtimeNow();
      if (anomalyStartedAt === null) {
        anomalyStartedAt = now;
        return false;
      }
      return now >= anomalyStartedAt + anomalyBudgetMs || now < anomalyStartedAt;
    };
    const finishUnknown = (reason: string): void => {
      if (!exitUnknown) {
        exitUnknown = true;
        contaminateRuntimeChildLifecycle(new ProcessGroupLifecycleError(reason));
      }
      try {
        child.emit("error", runtimeChildLifecycleError());
      } catch {
        // waiter 由 contamination 收口；不得伪造 exit，不得关权威 HANDLE
      }
    };
    let wait: ReturnType<typeof owned.waitForExit>;
    try {
      wait = owned.waitForExit(0);
    } catch (err) {
      finishUnknown(`runtime child wait threw:${String(owned.pid)}:${String(err)}`);
      return;
    }
    if (wait === "timeout") {
      clearAnomaly();
      runtimeSetTimeout(poll, 20);
      return;
    }
    if (wait === "unknown") {
      // 重试窗内**不得**污染：contamination 是全局且不可逆的，一旦落下，此后所有
      // runtime spawn 都会被拒绝直到 daemon 重启。原先在首次 unknown 就污染，
      // 使得 unknown -> timeout -> exit 0 这种可自愈的读数抖动也会永久拖垮运行时，
      // 「有界重试」只推迟了 child error，并没有真的提供恢复窗口。
      // 只有预算耗尽仍未恢复，才由 finishUnknown 落污染。
      if (boundedOut()) {
        finishUnknown(`runtime child wait unknown:${String(owned.pid)}`);
        return;
      }
      runtimeSetTimeout(poll, 20);
      return;
    }
    let code: ReturnType<typeof owned.readExitCode>;
    try {
      code = owned.readExitCode();
    } catch (err) {
      finishUnknown(`runtime child exit read threw:${String(owned.pid)}:${String(err)}`);
      return;
    }
    if (code === "live") {
      // 走到这里说明 waitForExit 已返回 "signaled"——句柄已 signaled 即进程确已终止。
      // 此时 GetExitCodeProcess 仍报 STILL_ACTIVE(259) 只可能是目标真的以 259 退出
      // （MSDN 明确警告不要把 259 当作"仍在运行"的凭据）。若在此续期轮询，exit/close
      // 将永不发出，lease / process HANDLE / Job / owner 记录全部无法释放。
      clearAnomaly();
      emitExit(WIN32_STILL_ACTIVE_EXIT_CODE);
      return;
    }
    if (code === "unknown") {
      // 同上：重试窗内不污染，预算耗尽才收口。
      if (boundedOut()) {
        finishUnknown(`runtime child exit unknown:${String(owned.pid)}`);
        return;
      }
      runtimeSetTimeout(poll, 20);
      return;
    }
    emitExit(code);
  };
  queueMicrotask(() => {
    child.emit("spawn");
    poll();
  });
  return child;
}

/** 测试用：直接走 Windows wait 状态机，不经真实 CreateProcessW。 */
export function childFromOwnedWindowsForTests(owned: OwnedWindowsProcess) {
  return childFromOwnedWindows(owned);
}

function requireCapturedSignal(spawned: SpawnedRuntimeChild): (signal: NodeJS.Signals) => void {
  if (spawned.signal) return spawned.signal;
  const captured = typeof spawned.generation === "object" && spawned.generation && "job" in spawned.generation
    ? spawned.generation
    : (typeof spawned.child.pid === "number" ? runtimeJobs.get(spawned.child.pid) : undefined);
  if (captured) {
    return (signal: NodeJS.Signals): void => {
      signalRuntimeChildGeneration(captured, signal);
    };
  }
  return (): void => {
    throw contaminateRuntimeChildLifecycle(new ProcessGroupLifecycleError("runtime job identity missing"));
  };
}

function spawnRuntimeChildImpl(
  file: string,
  args: string[],
  options: RuntimeChildSpawnOptions,
  kind: string
): SpawnedRuntimeChild {
  const registryHome = options.registryHome ?? runtimeChildHome;
  if (!registryHome) {
    throw new ProcessGroupLifecycleError("runtime child registry missing");
  }
  // 先验证 durable registry 可写，避免 wrapper 已启动却没有任何 ownership 锚点。
  prepareRuntimeChildRoot(registryHome);
  const generationId = randomUUID();
  const commandToken = commandTokenForGeneration(generationId);
  const runId = options.runId ?? generationId;
  if (!isSayDoIdentityToken(runId) || !isSayDoIdentityToken(runtimeOwnerInstanceId) || !isSayDoGeneration(generationId)) {
    throw new ProcessGroupLifecycleError("runtime child run identity missing");
  }
  const resolvedFile = resolveSpawnFile(file, options.env);
  const invocation = resolveRuntimeInvocation(resolvedFile, args);
  const jobName = formatSayDoJobName("Local", runtimeOwnerInstanceId, runId, generationId);
  const windows = effectiveHostKind() === "win32";
  const job: NamedJob = windows
    ? (runtimeTestHooks.createNamedJob ?? createNamedJob)(jobName)
    : { name: jobName, handle: null };
  const spawnArgs = ["-e", RUNTIME_CHILD_WRAPPER, commandToken, invocation.file, JSON.stringify(invocation.args)];
  const spawnOptions: Parameters<typeof spawn>[2] = {
    ...(options.cwd ? { cwd: options.cwd } : {}),
    ...(options.env ? { env: options.env } : {}),
    stdio: ["pipe", "pipe", "pipe", "pipe"],
    detached: !windows,
    windowsHide: true
  };
  const nativeWindows = windows && hostKind() === "win32" && !runtimeTestHooks.spawnImpl;
  let ownedWindows: OwnedWindowsProcess | undefined;
  let child: ChildProcessByStdio<Writable, Readable, Readable>;
  let permitPipe: { name: string; handle: unknown } | undefined;
  const closePermitQuiet = (): void => {
    if (!permitPipe) return;
    try {
      closeWin32Permit(permitPipe.handle);
    } catch {
      // 已关
    }
    permitPipe = undefined;
  };
  try {
    if (nativeWindows) {
      const spawnEnv: NodeJS.ProcessEnv = { ...(options.env ?? process.env) };
      if (!runtimeTestHooks.spawnOwnedWindows) {
        permitPipe = createWin32PermitPipe(generationId);
        spawnEnv.SAYDO_PERMIT_PIPE = permitPipe.name;
      }
      ownedWindows = (runtimeTestHooks.spawnOwnedWindows ?? createSuspendedOwnedWindowsProcess)({
        file: process.execPath,
        args: spawnArgs,
        ...(options.cwd ? { cwd: options.cwd } : {}),
        env: spawnEnv,
        generation: generationId
      });
      child = childFromOwnedWindows(ownedWindows);
    } else {
      child = (runtimeTestHooks.spawnImpl ?? spawn)(
        process.execPath,
        spawnArgs,
        spawnOptions
      ) as ChildProcessByStdio<Writable, Readable, Readable>;
    }
  } catch (err) {
    closePermitQuiet();
    if (job) {
      try {
        (runtimeTestHooks.closeNamedJob ?? closeNamedJob)(job);
      } catch (closeErr) {
        contaminateRuntimeChildLifecycle(closeErr);
      }
    }
    // CreateProcessW 已成功、但后续 wrap-stdio 等步骤失败且平台层 rollback 未能证明
    // 目标终止时，会抛出携带 pid/HANDLE 的 SpawnRollbackRetainedError。此刻目标仍是
    // suspended 且**尚未** AssignProcessToJobObject——上面关掉的是一个空 Job，杀不到它。
    // 不在这里亲自终止，该进程与其 HANDLE 就彻底失联（无 durable owner 可供 reaper 认领）。
    if (err instanceof SpawnRollbackRetainedError) {
      try {
        terminateProcessFromHandle(err.processHandle);
      } catch (terminateErr) {
        contaminateRuntimeChildLifecycle(terminateErr);
      }
      // 即使终止成功，本次 spawn 的收口链已断，运行时状态不可信。
      contaminateRuntimeChildLifecycle(err);
    }
    throw err;
  }
  const permit = child.stdio[3] as Readable | Writable | null;
  const permitWritable = permit && "write" in permit ? permit : undefined;
  const childPid = runtimeTestHooks.pidOf ? runtimeTestHooks.pidOf(child) : child.pid;
  let ownershipRollbackStarted = false;
  const rollbackOwnership = (error: unknown): never => {
    ownershipRollbackStarted = true;
    closePermitQuiet();
    rollbackAndThrow(child, job, permitWritable, error, ownedWindows?.processHandle);
  };
  try {
    if (!childPid) {
      rollbackOwnership(
        new ProcessGroupLifecycleError("runtime child pid undefined")
      );
    }
    const ownedPid = childPid as number;
    const existingHook = runtimeTestHooks.existingJob?.(ownedPid);
    const existing = existingHook ?? runtimeJobs.get(ownedPid)?.job;
    if (existing) {
      if (windows) {
        let active = 0;
        try {
          active = (runtimeTestHooks.namedJobActiveCount ?? namedJobActiveProcessCount)(existing);
        } catch (err) {
          rollbackOwnership(contaminateRuntimeChildLifecycle(new ProcessGroupLifecycleError(
            `runtime job pid reused while previous job unreadable:${String(ownedPid)}:${safeFailureText(err, 120)}`
          )));
        }
        if (active > 0) {
          rollbackOwnership(contaminateRuntimeChildLifecycle(new ProcessGroupLifecycleError(
            `runtime job pid reused while previous job active:${String(ownedPid)}`
          )));
        }
        try {
          (runtimeTestHooks.closeNamedJob ?? closeNamedJob)(existing);
        } catch (err) {
          rollbackOwnership(contaminateRuntimeChildLifecycle(err));
        }
      }
      const prior = runtimeJobs.get(ownedPid);
      if (prior) forgetGeneration(prior);
      else runtimeJobs.delete(ownedPid);
    }
    if (ownedWindows && job) {
      (runtimeTestHooks.assignProcessHandleToJob ?? assignProcessHandleToJob)(job, ownedWindows.processHandle);
      if (isProcessInJobFromHandles(ownedWindows.processHandle, job.handle) !== true) {
        rollbackOwnership(new ProcessGroupLifecycleError("runtime job membership not proven"));
      }
      const birth = processBirthFromHandle(ownedWindows.processHandle, ownedPid);
      if (!birth) {
        rollbackOwnership(new ProcessGroupLifecycleError("runtime child ownership identity unavailable"));
      }
      registerGeneration(jobGeneration(ownedPid, job, {
        id: generationId,
        ownerInstanceId: runtimeOwnerInstanceId,
        runId,
        jobName: job.name,
        processStart: birth,
        processHandle: ownedWindows.processHandle,
        commandToken,
        binary: process.execPath,
        kind
      }));
    } else if (windows && job) {
      (runtimeTestHooks.assignPidToJob ?? assignPidToJob)(job, ownedPid);
      registerGeneration(jobGeneration(ownedPid, job, {
        id: generationId,
        ownerInstanceId: runtimeOwnerInstanceId,
        runId,
        jobName: job.name,
        commandToken,
        binary: process.execPath,
        kind
      }));
    } else if (job) {
      const posixBirth = processBirth(ownedPid);
      registerGeneration(jobGeneration(ownedPid, job, {
        id: generationId,
        ownerInstanceId: runtimeOwnerInstanceId,
        runId,
        jobName: job.name,
        commandToken,
        binary: process.execPath,
        kind,
        ...(posixBirth ? { processStart: posixBirth } : {})
      }));
    }
  } catch (err) {
    if (ownershipRollbackStarted) throw err;
    rollbackOwnership(asProcessGroupLifecycleError(err));
  }
  // stdin 与 fd3 都是只写控制 pipe；wrapper/目标先退时它们也可能在 Linux 报 EPIPE/ECONNRESET。
  // 对 stdin=ignore，目标结果由 exit/close 决定；fd3 写失败则由未获 permit 的 wrapper 退出码决定。
  if (options.stdin === "ignore") {
    swallowStreamError(child.stdin);
    child.stdin.end();
  }
  swallowStreamError(permitWritable);
  // wrapper 固定用 pipe 承接目标 stdio；调用方选择 ignore 时，Linux 在终止进程组后仍可能让
  // 读端收到 ECONNRESET。既然该流的合同就是丢弃，必须同时消费数据与 error，不能让它越过
  // child 的权威 exit/close 结果成为进程级 uncaughtException。
  if (options.stdout === "ignore") {
    swallowStreamError(child.stdout);
    child.stdout.resume();
  }
  if (options.stderr === "ignore") {
    swallowStreamError(child.stderr);
    child.stderr.resume();
  }
  else if (options.stderr === "inherit") child.stderr.pipe(process.stderr);
  let lease: RuntimeChildLease;
  const ownedPid = childPid as number;
  const nativeBirth = ownedWindows
    ? processBirthFromHandle(ownedWindows.processHandle, ownedPid)
    : (child.pid ? runtimeJobs.get(child.pid)?.processStart ?? processBirth(child.pid) : undefined);
  try {
    lease = beginRuntimeChild(child.pid ?? -1, process.execPath, kind, {
      commandToken,
      generation: generationId,
      runId,
      ...(permitWritable ? { permit: permitWritable } : {}),
      jobName,
      ...(registryHome ? { registryHome } : {}),
      ...(ownedWindows ? { processHandle: ownedWindows.processHandle } : {}),
      ...(nativeBirth ? { processStart: nativeBirth } : {}),
      ...(ownedWindows && nativeBirth ? { deferPermit: true } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
      ...(ownedWindows ? {
        afterDurableOwner: async () => {
          try {
            ownedWindows.resume();
            if (permitPipe) await grantWin32Permit(permitPipe.handle, options.signal);
          } finally {
            closePermitQuiet();
            try {
              permitWritable?.end();
            } catch {
              // extra pipe 可能已关
            }
          }
        }
      } : {})
    });
  } catch (err) {
    rollbackAndThrow(child, job, permitWritable, err, ownedWindows?.processHandle);
  }
  const capturedGeneration = (child.pid ? runtimeJobs.get(child.pid) : undefined) ??
    jobGeneration(ownedPid, job, {
      id: generationId,
      ownerInstanceId: runtimeOwnerInstanceId,
      runId,
      jobName: job.name,
      commandToken,
      binary: process.execPath,
      kind,
      ...(ownedWindows ? { processHandle: ownedWindows.processHandle, processStart: nativeBirth ?? null } : {})
    });
  const innerRelease = lease.release.bind(lease);
  lease.release = async () => {
    try {
      if (capturedGeneration && effectiveHostKind() === "win32" && capturedGeneration.job.handle != null) {
        await teardownRuntimeJob(capturedGeneration);
      } else if (capturedGeneration) {
        forgetGeneration(capturedGeneration);
      }
      await innerRelease();
    } catch (err) {
      const extra = runtimeTestHooks.leaseReleaseError;
      if (extra !== undefined && extra !== err) throw combineLifecycleFailures(err, extra);
      throw err;
    }
    if (runtimeTestHooks.leaseReleaseError) throw runtimeTestHooks.leaseReleaseError;
  };
  const signalCaptured = (signal: NodeJS.Signals): void => {
    signalRuntimeChildGeneration(capturedGeneration, signal);
  };
  return { child, lease, commandToken, generation: capturedGeneration, signal: signalCaptured };
}

export function spawnRuntimeChild(
  file: string,
  args: string[],
  options: RuntimeChildSpawnOptions,
  kind: string
): SpawnedRuntimeChild {
  const barrier = runtimeChildLifecycleError();
  if (barrier) throw barrier;
  runtimeTestHooks.onSpawn?.(file, args, kind);
  if (runtimeTestHooks.spawn) {
    const spawned = runtimeTestHooks.spawn(file, args, options, kind);
    const captured = typeof spawned.generation === "object" && spawned.generation && "job" in spawned.generation
      ? spawned.generation
      : (typeof spawned.child.pid === "number" ? runtimeJobs.get(spawned.child.pid) : undefined);
    const signal = requireCapturedSignal({
      ...spawned,
      ...(captured ? { generation: captured } : {})
    });
    return {
      child: spawned.child,
      lease: spawned.lease,
      commandToken: spawned.commandToken,
      signal,
      ...(captured ? { generation: captured } : {})
    };
  }
  return spawnRuntimeChildImpl(file, args, options, kind);
}

export interface RuntimeExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeout?: number;
  maxBuffer?: number;
  signal?: AbortSignal;
}

function abortedError(): Error {
  const err = new RuntimeInvocationError("aborted", { exitCode: 1 });
  err.name = "AbortError";
  Object.defineProperty(err, "code", { value: "ABORT_ERR", enumerable: true });
  return err;
}

function isGroupUnreapedFailure(err: unknown): boolean {
  if (!isProcessGroupLifecycleError(err)) return false;
  const text = safeFailureText(err, 400);
  return text.includes("did not exit") ||
    text.includes("state unknown") ||
    text.includes("close withheld");
}

/** execFile 的可收口替代：独立 PGID、durable owner、TERM→KILL、整组 ESRCH 后才返回。 */
export async function execRuntimeChild(
  file: string,
  args: string[],
  options: RuntimeExecOptions = {}
): Promise<{ stdout: string; stderr: string }> {
  if (options.signal?.aborted) throw abortedError();
  // 已完成的 Promise 也要 await 会把后续 spawn 推进到微任务，测试里 queueMicrotask('spawn')
  // 会在 listener 挂上之前先发出，exit→close 永远等不到。无在途 rollback 时不得 yield。
  if (rollbackBusy > 0) await rollbackInFlight;
  if (options.signal?.aborted) throw abortedError();
  const spawned = spawnRuntimeChild(file, args, {
    ...(options.cwd ? { cwd: options.cwd } : {}),
    ...(options.env ? { env: options.env } : {}),
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    runId: randomUUID(),
    ...(options.signal ? { signal: options.signal } : {})
  }, "exec");
  const { child, lease } = spawned;
  let stdout = "";
  let stderr = "";
  let overflow = false;
  let timedOut = false;
  let aborted = false;
  let stopping = false;
  let exiting = false;
  const pipeFailures: PipeFailureRecord[] = [];
  const seenPipeProjected = new WeakSet<object>();
  let killTimer: NodeJS.Timeout | undefined;
  let closeDeadlineAt: number | undefined;
  let childClosed = false;
  let closeWithheld = false;
  const maxBuffer = options.maxBuffer ?? 512 * 1024;
  let signalFailure: Error | undefined;
  const signalTree = (signal: NodeJS.Signals): void => {
    try {
      requireCapturedSignal(spawned)(signal);
    } catch (err) {
      signalFailure = appendLifecycleFailure(
        signalFailure,
        contaminateRuntimeChildLifecycle(projectTrustedKillFailure(signal, err, "primary"))
      );
    }
  };
  const rejectIfSignaled = (work?: { present: true; error: unknown }): void => {
    if (!signalFailure) return;
    if (work?.present === true && work.error !== signalFailure) {
      throw combineLifecycleFailures(work.error, signalFailure);
    }
    throw signalFailure;
  };
  const latchedBusinessFailure = (): Error | undefined => {
    if (aborted) return abortedError();
    if (timedOut) {
      return new RuntimeInvocationError(`Command timed out after ${String(options.timeout ?? 30_000)}ms`, {
        exitCode: 1,
        timedOut: true
      });
    }
    if (overflow) {
      return new RuntimeInvocationError("stdout maxBuffer length exceeded", { exitCode: 1 });
    }
    if (pipeFailures.length > 0) return combinePipeBusinessFailures(pipeFailures);
    return undefined;
  };
  const requestStop = (): void => {
    if (stopping) return;
    stopping = true;
    closeDeadlineAt ??= runtimeNow() + (runtimeTestHooks.closeDeadlineMs ?? RUNTIME_CLOSE_DEADLINE_MS);
    signalTree("SIGTERM");
    killTimer = runtimeSetTimeout(() => signalTree("SIGKILL"), runtimeTestHooks.killGraceMs ?? 3_000);
  };
  child.stdout?.on("data", (chunk: Buffer) => {
    stdout += chunk.toString("utf8");
    if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) > maxBuffer) {
      overflow = true;
      requestStop();
    }
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
    if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) > maxBuffer) {
      overflow = true;
      requestStop();
    }
  });
  const handlePipeError = (stream: "stdout" | "stderr", err: unknown): void => {
    try {
      const inspection = inspectUntrustedPipeFailure(err);
      const terminating = stopping || exiting;
      if (shouldIgnoreTerminatingPipeError(inspection.trustedCode, terminating)) return;
      if (seenPipeProjected.has(inspection.projected)) return;
      seenPipeProjected.add(inspection.projected);
      pipeFailures.push({ stream, code: inspection.diagnostic.code });
      requestStop();
    } catch {
      if (!seenPipeProjected.has(PIPE_OPAQUE_FAILURE)) {
        seenPipeProjected.add(PIPE_OPAQUE_FAILURE);
        pipeFailures.push({ stream, code: "unknown" });
      }
      requestStop();
    }
  };
  child.stdout?.on("error", (err: unknown) => handlePipeError("stdout", err));
  child.stderr?.on("error", (err: unknown) => handlePipeError("stderr", err));
  child.once("exit", () => {
    exiting = true;
    closeDeadlineAt ??= runtimeNow() + (runtimeTestHooks.closeDeadlineMs ?? RUNTIME_CLOSE_DEADLINE_MS);
  });
  const started = new Promise<void>((resolveStarted, rejectStarted) => {
    child.once("spawn", resolveStarted);
    child.once("error", rejectStarted);
  });
  const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolveClosed) => {
    child.once("close", (code, signal) => {
      childClosed = true;
      resolveClosed({ code, signal });
    });
  });
  const timeout = runtimeSetTimeout(() => {
    timedOut = true;
    requestStop();
  }, options.timeout ?? 30_000);
  const onAbort = (): void => {
    aborted = true;
    requestStop();
  };
  if (options.signal?.aborted) onAbort();
  else options.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    return await settleWithLeaseRelease((async () => {
      try {
        await started;
        if (options.signal?.aborted) {
          requestStop();
          throw abortedError();
        }
        await lease.establish();
        const result = await (async () => {
          while (!childClosed) {
            const barrier = runtimeChildLifecycleError();
            if (barrier) throw barrier;
            if (closeDeadlineAt !== undefined && runtimeNow() >= closeDeadlineAt) {
              closeWithheld = true;
              if (child.pid && runtimeProcessGroupState(child.pid) !== "gone") signalTree("SIGKILL");
              throw contaminateRuntimeChildLifecycle(new ProcessGroupLifecycleError(
                `runtime child close withheld:${String(child.pid)}`
              ));
            }
            await Promise.race([
              closed,
              new Promise((resolve) => {
                runtimeSetTimeout(() => resolve(undefined), 10);
              })
            ]);
          }
          return closed;
        })();
        if (child.pid && runtimeProcessGroupState(child.pid) !== "gone") signalTree("SIGKILL");
        const deadline = runtimeNow() + (runtimeTestHooks.drainDeadlineMs ?? RUNTIME_DRAIN_DEADLINE_MS);
        while (child.pid) {
          const state = runtimeProcessGroupState(child.pid);
          if (state === "gone") break;
          if (runtimeNow() >= deadline) {
            throw contaminateRuntimeChildLifecycle(new ProcessGroupLifecycleError(
              state === "unknown"
                ? `runtime child process group state unknown:${String(child.pid)}`
                : `runtime child process group did not exit:${String(child.pid)}`
            ));
          }
          await new Promise((resolve) => {
            runtimeSetTimeout(() => resolve(undefined), 20);
          });
        }
        if (closeWithheld) {
          throw contaminateRuntimeChildLifecycle(new ProcessGroupLifecycleError(
            `runtime child close withheld:${String(child.pid)}`
          ));
        }
        if (aborted) throw abortedError();
        if (result.code !== 0 || result.signal !== null || timedOut || overflow || pipeFailures.length > 0) {
          const latched = latchedBusinessFailure();
          if (latched) throw latched;
          throw new RuntimeInvocationError(`Command failed with exit code ${String(result.code)}`, {
            exitCode: typeof result.code === "number" ? result.code : 1,
            terminationCause: "exit"
          });
        }
        rejectIfSignaled();
        return { stdout, stderr };
      } catch (err) {
        if (!signalFailure) signalTree("SIGKILL");
        const drainAt = runtimeNow() + (runtimeTestHooks.drainDeadlineMs ?? RUNTIME_DRAIN_DEADLINE_MS);
        while (!childClosed && runtimeNow() < drainAt) {
          await new Promise((resolve) => {
            runtimeSetTimeout(() => resolve(undefined), 10);
          });
        }
        const latched = latchedBusinessFailure();
        let unreaped: unknown;
        if (isGroupUnreapedFailure(err) && err !== latched && err !== signalFailure) {
          unreaped = err;
        }
        if (unreaped === undefined) {
          if (!childClosed) {
            unreaped = contaminateRuntimeChildLifecycle(new ProcessGroupLifecycleError(
              `runtime child close withheld:${String(child.pid)}`
            ));
          } else if (child.pid) {
            const state = runtimeProcessGroupState(child.pid);
            if (state !== "gone") {
              unreaped = contaminateRuntimeChildLifecycle(new ProcessGroupLifecycleError(
                state === "unknown"
                  ? `runtime child process group state unknown:${String(child.pid)}`
                  : `runtime child process group did not exit:${String(child.pid)}`
              ));
            }
          }
        }
        if (unreaped === latched || unreaped === signalFailure) unreaped = undefined;
        const parts: unknown[] = [];
        if (latched !== undefined) parts.push(latched);
        if (signalFailure) parts.push(signalFailure);
        if (unreaped !== undefined) parts.push(unreaped);
        if (parts.length === 0) {
          if (err !== signalFailure) parts.push(err);
          if (signalFailure) parts.push(signalFailure);
        } else if (latched === undefined && err !== signalFailure && err !== unreaped) {
          parts.unshift(err);
        }
        const work = parts.length <= 1
          ? (parts[0] ?? err)
          : combineLifecycleFailureList(parts);
        throw work;
      }
    })(), () => lease.release());
  } finally {
    runtimeClearTimeout(timeout);
    runtimeClearTimeout(killTimer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
