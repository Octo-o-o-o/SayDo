import { spawn, type ChildProcessByStdio } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { Readable, Writable } from "node:stream";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
  child = spawn(target, args, { cwd: process.cwd(), env: process.env, stdio: ["pipe", "inherit", "inherit"] });
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

let runtimeChildHome: string | null = null;
let runtimeOwnerInstanceId = `pid-${String(process.pid)}`;

export function configureRuntimeChildRegistry(home: string, ownerInstanceId = `pid-${String(process.pid)}`): void {
  runtimeChildHome = home;
  runtimeOwnerInstanceId = ownerInstanceId;
}

export function runtimeChildOwnerIdentity(): { ownerPid: number; ownerInstanceId: string } {
  return { ownerPid: process.pid, ownerInstanceId: runtimeOwnerInstanceId };
}

function prepareRuntimeChildRoot(): void {
  if (!runtimeChildHome || process.platform === "win32") return;
  const root = join(runtimeChildHome, "runtime", "children");
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
  if (process.platform === "win32") return "unknown";
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
  options: { commandToken?: string; permit?: NodeJS.WritableStream } = {}
): RuntimeChildLease {
  if (!runtimeChildHome || process.platform === "win32" || pid <= 1) {
    return {
      establish: async () => { options.permit?.end("1"); },
      release: () => undefined
    };
  }
  const root = join(runtimeChildHome, "runtime", "children");
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
    ...(options.commandToken ? { commandToken: options.commandToken } : {})
  };
  writeRecord(path, pending);
  let released = false;
  return {
    async establish() {
      const deadline = Date.now() + 2_000;
      let processStart: string | null = null;
      while (!released && processStart === null && Date.now() < deadline) {
        processStart = readOwnedAgentProcessStart(pid, binary, options.commandToken);
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
export function spawnRuntimeChild(
  file: string,
  args: string[],
  options: RuntimeChildSpawnOptions,
  kind: string
): SpawnedRuntimeChild {
  // 先验证 durable registry 可写，避免 wrapper 已启动却没有任何 ownership 锚点。
  prepareRuntimeChildRoot();
  const commandToken = `saydo-child-${randomUUID()}`;
  const child = spawn(
    process.execPath,
    ["-e", RUNTIME_CHILD_WRAPPER, commandToken, file, JSON.stringify(args)],
    {
      ...(options.cwd ? { cwd: options.cwd } : {}),
      ...(options.env ? { env: options.env } : {}),
      stdio: ["pipe", "pipe", "pipe", "pipe"],
      detached: process.platform !== "win32"
    }
  );
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
      ...(permitWritable ? { permit: permitWritable } : {})
    });
  } catch (err) {
    // preflight 后仍可能被外部文件系统变更击中；目标尚未获 permit，只需收口 wrapper。
    try { permitWritable?.end(); } catch { /* best effort */ }
    try { child.stdin.end(); } catch { /* best effort */ }
    try { child.kill("SIGKILL"); } catch { /* best effort */ }
    child.stdout.resume();
    child.stderr.resume();
    throw err;
  }
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
      if (process.platform !== "win32" && child.pid) process.kill(-child.pid, signal);
      else child.kill(signal);
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
