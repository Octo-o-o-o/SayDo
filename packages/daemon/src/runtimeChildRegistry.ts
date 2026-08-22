import { execFileSync, spawn, type ChildProcessByStdio } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { Readable, Writable } from "node:stream";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { delimiter, extname, join } from "node:path";
import {
  assignPidToJob,
  closeNamedJob,
  createNamedJob,
  hostKind,
  processAlive,
  processBirth,
  type NamedJob
} from "@saydo/platform";
import { readOwnedAgentProcessStart } from "./tier1/restartPolicy.js";

export interface RuntimeChildOwnershipRecord {
  version: 1;
  pid: number;
  kind: string;
  binary: string;
  processStart: string | null;
  ownerPid: number;
  ownerInstanceId: string;
  commandToken?: string;
  jobName?: string;
}

export interface RuntimeChildLease {
  establish(): Promise<void>;
  release(): void;
}

export interface RuntimeChildSpawnOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdin: "ignore" | "pipe";
  stdout: "ignore" | "pipe";
  stderr: "ignore" | "pipe" | "inherit";
  /** 覆盖进程级 registry 根;并行测试必须按调用方 HOME 隔离 */
  registryHome?: string;
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

export interface SpawnedRuntimeChild {
  child: ChildProcessByStdio<Writable, Readable, Readable>;
  lease: RuntimeChildLease;
  commandToken: string;
}

const RUNTIME_CHILD_WRAPPER = String.raw`
const { spawn, spawnSync } = require("node:child_process");
const { createReadStream } = require("node:fs");
const target = process.argv[2];
const args = JSON.parse(process.argv[3]);
let granted = false;
let child = null;
let draining = false;
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
function drainAndExit(code) {
  if (draining) return;
  draining = true;
  signalOthers("SIGTERM");
  const killAt = Date.now() + 100;
  const deadline = Date.now() + 3000;
  const poll = () => {
    const pids = otherGroupPids();
    if (pids.length === 0) process.exit(code);
    if (Date.now() >= killAt) for (const pid of pids) { try { process.kill(pid, "SIGKILL"); } catch {} }
    if (Date.now() >= deadline) process.exit(124);
    setTimeout(poll, 20);
  };
  poll();
}
const permit = createReadStream(null, { fd: 3, autoClose: true });
permit.once("data", () => {
  if (granted) return;
  granted = true;
  const js = require("node:path").extname(target).toLowerCase();
  const wrapJs = js === ".js" || js === ".mjs" || js === ".cjs" ||
    (process.platform === "win32" && js === "");
  const spawnFile = wrapJs ? process.execPath : target;
  const spawnArgs = wrapJs ? [target, ...args] : args;
  const useShell = process.platform === "win32" && (js === ".cmd" || js === ".bat");
  // shell:true 下 Node 对 Windows 是零转义 join,元字符会被 cmd 当语法执行 ⇒ fail-closed。
  if (useShell && [spawnFile, ...spawnArgs].some((a) => /[&|<>^"%!()\r\n]/.test(String(a)))) {
    process.stderr.write("saydo: cmd/bat argument contains shell metacharacter (fail-closed)");
    drainAndExit(126);
    return;
  }
  child = spawn(spawnFile, spawnArgs, { cwd: process.cwd(), env: process.env, stdio: ["pipe", "inherit", "inherit"], windowsHide: true, shell: useShell });
  process.stdin.pipe(child.stdin);
  child.once("error", (err) => { process.stderr.write(String(err)); drainAndExit(127); });
  child.once("exit", (code, signal) => {
    drainAndExit(signal ? 128 : (code ?? 1));
  });
});
permit.once("end", () => { if (!granted) process.exit(125); });
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    if (draining) return;
    if (!child) process.exit(signal === "SIGTERM" ? 143 : 130);
    try { child.kill(signal); } catch {}
  });
}
`;

export function runtimeChildJobName(pid: number): string | undefined {
  return runtimeJobs.get(pid)?.name;
}

export function signalRuntimeChildTree(pid: number, signal: NodeJS.Signals): void {
  if (hostKind() === "win32") {
    if (signal === "SIGKILL") {
      const owned = runtimeJobs.get(pid);
      if (owned) {
        closeNamedJob(owned);
        runtimeJobs.delete(pid);
        return;
      }
    }
    try {
      process.kill(pid, signal);
    } catch {
      // ESRCH / EINVAL
    }
    return;
  }
  try {
    process.kill(-pid, signal);
  } catch {
    // ESRCH
  }
}
/** wrapper 源码(供门禁做语法自检:它经 `node -e` 执行,语法错会让所有受管子进程静默失败)。 */
export function runtimeChildWrapperSource(): string {
  return RUNTIME_CHILD_WRAPPER;
}

let runtimeChildHome: string | undefined;
let runtimeOwnerInstanceId = `pid-${String(process.pid)}`;
const runtimeJobs = new Map<number, NamedJob>();

export function configureRuntimeChildRegistry(home: string, ownerInstanceId = `pid-${String(process.pid)}`): void {
  runtimeChildHome = home;
  runtimeOwnerInstanceId = ownerInstanceId;
}

export function runtimeChildOwnerIdentity(): { ownerPid: number; ownerInstanceId: string } {
  return { ownerPid: process.pid, ownerInstanceId: runtimeOwnerInstanceId };
}

function prepareRuntimeChildRoot(home = runtimeChildHome): void {
  if (!home) return;
  const root = join(home, "runtime", "children");
  mkdirSync(root, { recursive: true, mode: 0o700 });
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
  if (hostKind() === "win32") return processAlive(pid) ? "alive" : "gone";
  try {
    process.kill(-pid, 0);
    return "alive";
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ESRCH") return "gone";
    return "unknown";
  }
}

function groupAlive(pid: number): boolean {
  return runtimeProcessGroupState(pid) !== "gone";
}

function writeRecord(path: string, record: RuntimeChildOwnershipRecord): void {
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify(record), { mode: 0o600 });
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
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
  options: { commandToken?: string; permit?: NodeJS.WritableStream; jobName?: string; registryHome?: string } = {}
): RuntimeChildLease {
  const home = options.registryHome ?? runtimeChildHome;
  if (!home || pid <= 1) {
    return {
      establish: async () => { options.permit?.end("1"); },
      release: () => undefined
    };
  }
  const root = join(home, "runtime", "children");
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const path = join(root, `${String(pid)}.json`);
  const pending: RuntimeChildOwnershipRecord = {
    version: 1,
    pid,
    kind: kind.slice(0, 80),
    binary,
    processStart: null,
    ownerPid: process.pid,
    ownerInstanceId: runtimeOwnerInstanceId,
    ...(options.commandToken ? { commandToken: options.commandToken } : {}),
    ...(options.jobName ? { jobName: options.jobName } : {})
  };
  writeRecord(path, pending);
  let released = false;
  return {
    async establish() {
      const deadline = Date.now() + 2_000;
      let processStart: string | null = null;
      while (!released && processStart === null && Date.now() < deadline) {
        processStart = hostKind() === "win32"
          ? processBirth(pid)
          : readOwnedAgentProcessStart(pid, binary, options.commandToken);
        if (processStart === null && groupAlive(pid)) await new Promise((resolve) => setTimeout(resolve, 20));
        else if (processStart === null) return;
      }
      if (released) return;
      if (processStart === null) throw new Error(`runtime child ownership identity unavailable:${kind}:${String(pid)}`);
      writeRecord(path, { ...pending, processStart });
      options.permit?.end("1");
    },
    release() {
      // durable owner 只在整组明确 ESRCH 后删除；EPERM/未知/超时必须留给 supervisor reaper。
      if (runtimeProcessGroupState(pid) !== "gone") return;
      released = true;
      try {
        const current = JSON.parse(readFileSync(path, "utf8")) as { pid?: unknown; ownerPid?: unknown };
        if (current.pid === pid && current.ownerPid === process.pid) rmSync(path, { force: true });
      } catch {
        if (!existsSync(path)) return;
      }
    }
  };
}

/**
 * wrapper 在 fd3 收到 permit 前不 spawn 目标；daemon 硬退会关闭 pipe，wrapper 自退。
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
  const ext = extname(resolved).toLowerCase();
  const wrapJs = ext === ".js" || ext === ".mjs" || ext === ".cjs" ||
    (hostKind() === "win32" && ext === "");
  const useShell = hostKind() === "win32" && (ext === ".cmd" || ext === ".bat");
  const spawnFile = wrapJs ? process.execPath : resolved;
  const spawnArgs = wrapJs ? [resolved, ...args] : args;
  if (useShell) assertNoCmdShellMetachars([spawnFile, ...spawnArgs]);
  return execFileSync(spawnFile, spawnArgs, {
    encoding: options.encoding,
    ...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
    windowsHide: true,
    ...(useShell ? { shell: true } : {})
  }).trim();
}

export function spawnRuntimeChild(
  file: string,
  args: string[],
  options: RuntimeChildSpawnOptions,
  kind: string
): SpawnedRuntimeChild {
  const registryHome = options.registryHome ?? runtimeChildHome;
  // 先验证 durable registry 可写，避免 wrapper 已启动却没有任何 ownership 锚点。
  prepareRuntimeChildRoot(registryHome);
  const commandToken = `saydo-child-${randomUUID()}`;
  const resolvedFile = resolveSpawnFile(file, options.env);
  let job: NamedJob | undefined;
  if (hostKind() === "win32") {
    job = createNamedJob(`Local\\SayDoJob-${runtimeOwnerInstanceId}-${commandToken}`);
  }
  const child = spawn(
    process.execPath,
    ["-e", RUNTIME_CHILD_WRAPPER, commandToken, resolvedFile, JSON.stringify(args)],
    {
      ...(options.cwd ? { cwd: options.cwd } : {}),
      ...(options.env ? { env: options.env } : {}),
      stdio: ["pipe", "pipe", "pipe", "pipe"],
      detached: hostKind() !== "win32",
      windowsHide: true
    }
  );
  if (job && child.pid) {
    assignPidToJob(job, child.pid);
    runtimeJobs.set(child.pid, job);
  }
  const permit = child.stdio[3] as Readable | Writable | null;
  const permitWritable = permit && "write" in permit ? permit : undefined;
  if (options.stdin === "ignore") child.stdin.end();
  if (options.stdout === "ignore") child.stdout.resume();
  if (options.stderr === "ignore") child.stderr.resume();
  else if (options.stderr === "inherit") child.stderr.pipe(process.stderr);
  let lease: RuntimeChildLease;
  try {
    lease = beginRuntimeChild(child.pid ?? -1, process.execPath, kind, {
      commandToken,
      ...(permitWritable ? { permit: permitWritable } : {}),
      ...(job ? { jobName: job.name } : {}),
      ...(registryHome ? { registryHome } : {})
    });
  } catch (err) {
    try { permitWritable?.end(); } catch { /* best effort */ }
    try { child.stdin.end(); } catch { /* best effort */ }
    try { child.kill("SIGKILL"); } catch { /* best effort */ }
    if (job) {
      try { closeNamedJob(job); } catch { /* best effort */ }
      if (child.pid) runtimeJobs.delete(child.pid);
    }
    child.stdout.resume();
    child.stderr.resume();
    throw err;
  }
  const innerRelease = lease.release.bind(lease);
  lease.release = () => {
    innerRelease();
    if (child.pid) {
      const owned = runtimeJobs.get(child.pid);
      if (owned) {
        try { closeNamedJob(owned); } catch { /* KILL_ON_JOB_CLOSE */ }
        runtimeJobs.delete(child.pid);
      }
    }
  };
  return { child, lease, commandToken };
}

export interface RuntimeExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeout?: number;
  maxBuffer?: number;
  signal?: AbortSignal;
}

/** execFile 的可收口替代：独立 PGID、durable owner、TERM→KILL、整组 ESRCH 后才返回。 */
export async function execRuntimeChild(
  file: string,
  args: string[],
  options: RuntimeExecOptions = {}
): Promise<{ stdout: string; stderr: string }> {
  const spawned = spawnRuntimeChild(file, args, {
    ...(options.cwd ? { cwd: options.cwd } : {}),
    ...(options.env ? { env: options.env } : {}),
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe"
  }, "exec");
  const { child, lease } = spawned;
  let stdout = "";
  let stderr = "";
  let overflow = false;
  let timedOut = false;
  let stopping = false;
  let killTimer: NodeJS.Timeout | undefined;
  const maxBuffer = options.maxBuffer ?? 512 * 1024;
  const signalTree = (signal: NodeJS.Signals): void => {
    try {
      if (hostKind() !== "win32" && child.pid) process.kill(-child.pid, signal);
      else if (child.pid) {
        const owned = runtimeJobs.get(child.pid);
        if (owned) {
          runtimeJobs.delete(child.pid);
          closeNamedJob(owned);
        } else {
          child.kill(signal);
        }
      }
    } catch {
      // close/group probe 决定最终结果。
    }
  };
  const requestStop = (): void => {
    if (stopping) return;
    stopping = true;
    signalTree("SIGTERM");
    killTimer = setTimeout(() => signalTree("SIGKILL"), 3_000);
    killTimer.unref();
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
  const started = new Promise<void>((resolveStarted, rejectStarted) => {
    child.once("spawn", resolveStarted);
    child.once("error", rejectStarted);
  });
  const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolveClosed) => {
    child.once("close", (code, signal) => resolveClosed({ code, signal }));
  });
  const timeout = setTimeout(() => {
    timedOut = true;
    requestStop();
  }, options.timeout ?? 30_000);
  timeout.unref();
  const onAbort = (): void => requestStop();
  if (options.signal?.aborted) onAbort();
  else options.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    await started;
    await lease.establish();
    const result = await closed;
    if (child.pid && runtimeProcessGroupState(child.pid) === "alive") signalTree("SIGKILL");
    const deadline = Date.now() + 5_000;
    while (child.pid) {
      const state = runtimeProcessGroupState(child.pid);
      if (state === "gone") break;
      if (Date.now() >= deadline) {
        throw new Error(
          state === "unknown"
            ? `runtime child process group state unknown:${String(child.pid)}`
            : `runtime child process group did not exit:${String(child.pid)}`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    if (result.code !== 0 || result.signal !== null || timedOut || overflow) {
      const error = new Error(
        timedOut ? `Command timed out after ${String(options.timeout ?? 30_000)}ms` :
          overflow ? "stdout maxBuffer length exceeded" : `Command failed with exit code ${String(result.code)}`
      ) as Error & { stdout?: string; stderr?: string; code?: number | null };
      error.stdout = stdout;
      error.stderr = stderr;
      error.code = result.code;
      throw error;
    }
    return { stdout, stderr };
  } catch (err) {
    signalTree("SIGKILL");
    await closed.catch(() => undefined);
    throw err;
  } finally {
    clearTimeout(timeout);
    if (killTimer) clearTimeout(killTimer);
    options.signal?.removeEventListener("abort", onAbort);
    lease.release();
  }
}
