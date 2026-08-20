import { execFileSync, fork, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  supervisorFrameSchema,
  type PrepareShutdownReason,
  type SupervisorFrame
} from "@saydo/contracts";
import { CLI_PROTOCOL_VERSION } from "./buildIdentity.js";
import { consoleUrl, openExternal } from "./open.js";
import { probeDaemon, type DaemonProbe } from "./probe.js";
import { reapOwnedAgentGroups, type OwnedDaemonGeneration } from "./emergencyReaper.js";

export interface SupervisorPaths {
  daemon: string;
  consoleDist: string;
}

export function distributionPaths(): SupervisorPaths {
  const dist = import.meta.dirname;
  return { daemon: join(dist, "runtime", "daemon.mjs"), consoleDist: join(dist, "console") };
}

function tokenOf(home: string): string {
  return readFileSync(join(home, ".cap-token"), "utf8").trim();
}

class SignalQueue {
  private readonly queued: PrepareShutdownReason[] = [];
  private waiter: ((reason: PrepareShutdownReason) => void) | undefined;

  constructor() {
    process.on("SIGINT", () => this.push("cli_sigint"));
    process.on("SIGTERM", () => this.push("supervisor_stop"));
  }

  next(): Promise<PrepareShutdownReason> {
    const reason = this.queued.shift();
    if (reason) return Promise.resolve(reason);
    return new Promise((resolveSignal) => { this.waiter = resolveSignal; });
  }

  private push(reason: PrepareShutdownReason): void {
    const waiter = this.waiter;
    if (waiter) {
      this.waiter = undefined;
      waiter(reason);
    } else {
      this.queued.push(reason);
    }
  }
}

export async function holdAttached(probe: Extract<DaemonProbe, { kind: "attached" }>): Promise<void> {
  const signals = new SignalQueue();
  process.stdout.write(`${JSON.stringify({ mode: "attached", pid: probe.pid, identity: probe.identity })}\n`);
  await signals.next();
}

interface OwnedRunOptions {
  home: string;
  port: number;
  paths: SupervisorPaths;
  openBrowser: boolean;
}

type ChildEvent =
  | { kind: "frame"; frame: SupervisorFrame }
  | { kind: "exit"; code: number | null; signal: NodeJS.Signals | null };

class ChildEventQueue {
  private readonly queued: ChildEvent[] = [];
  private waiter: ((event: ChildEvent) => void) | undefined;

  constructor(child: ChildProcess) {
    child.on("message", (message: unknown) => {
      const parsed = supervisorFrameSchema.safeParse(message);
      if (parsed.success) this.push({ kind: "frame", frame: parsed.data });
    });
    child.once("exit", (code, signal) => this.push({ kind: "exit", code, signal }));
  }

  next(): Promise<ChildEvent> {
    const event = this.queued.shift();
    if (event) return Promise.resolve(event);
    return new Promise((resolveEvent) => { this.waiter = resolveEvent; });
  }

  private push(event: ChildEvent): void {
    const waiter = this.waiter;
    if (waiter) {
      this.waiter = undefined;
      waiter(event);
    } else {
      this.queued.push(event);
    }
  }
}

function requestShutdown(child: ChildProcess, reason: PrepareShutdownReason): void {
  if (child.connected) child.send({ v: 1, t: "prepareShutdown", reason });
}

function processStart(pid: number): string | null {
  try {
    const ps = existsSync("/bin/ps") ? "/bin/ps" : existsSync("/usr/bin/ps") ? "/usr/bin/ps" : "ps";
    return execFileSync(ps, ["-o", "lstart=", "-p", String(pid)], {
      encoding: "utf8",
      timeout: 2_000
    }).trim() || null;
  } catch {
    try {
      // pgrep -lf 以 pattern 搜命令行，不能把 pid 当 pattern；用 node 再按 pid 过滤。
      const raw = execFileSync("pgrep", ["-lf", "node"], { encoding: "utf8", timeout: 2_000 });
      const line = raw
        .split("\n")
        .map((item) => item.trim())
        .find((item) => item === String(pid) || item.startsWith(`${String(pid)} `));
      if (line) return `pgrep1:${line.slice(0, 240)}`;
    } catch {
      // fall through
    }
    try {
      process.kill(pid, 0);
      // 最后回退：仅证明仍存活 + pid（配合 instanceId 防串 HOME）。
      return `alive1:${pid}`;
    } catch {
      return null;
    }
  }
}

export function homeLockAllowsReap(home: string, generation: OwnedDaemonGeneration): boolean {
  const lock = join(home, ".daemon-supervisor.lock");
  if (!existsSync(lock)) return false;
  try {
    const owner = JSON.parse(readFileSync(lock, "utf8")) as {
      version?: unknown;
      pid?: unknown;
      processStart?: unknown;
      instanceId?: unknown;
    };
    return owner.version === 1 &&
      Number.isInteger(owner.pid) &&
      owner.pid === generation.pid &&
      owner.instanceId === generation.instanceId &&
      typeof owner.processStart === "string" &&
      owner.processStart !== "" &&
      processStart(generation.pid) === owner.processStart;
  } catch {
    return false;
  }
}

async function reapStartupChildGroups(home: string, generation: OwnedDaemonGeneration): Promise<void> {
  await reapOwnedAgentGroups(home, generation);
}

async function probeStartupRace(home: string, port: number): Promise<DaemonProbe> {
  const deadline = Date.now() + 15_000;
  for (;;) {
    const probe = await probeDaemon(home, port, CLI_PROTOCOL_VERSION);
    // B9: 同 HOME starting/unknown 有界重试；无法验证时不 kill。
    if (
      probe.kind === "attached" ||
      (probe.kind === "conflict" &&
        probe.reason !== "unknown_service" &&
        probe.reason !== "ownership_unverified" &&
        probe.reason !== "token_unavailable") ||
      Date.now() >= deadline
    ) {
      return probe;
    }
    if (probe.kind !== "available" && probe.kind !== "conflict") return probe;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function waitForChildExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolveExit) => {
    const timer = setTimeout(resolveExit, 2_000);
    timer.unref();
    child.once("exit", () => {
      clearTimeout(timer);
      resolveExit();
    });
  });
}

async function emergencyStop(
  child: ChildProcess,
  home: string,
  generation: OwnedDaemonGeneration
): Promise<void> {
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  await waitForChildExit(child);
  if (child.exitCode === null && child.signalCode === null) {
    throw new Error("daemon SIGKILL 后仍未退出");
  }
  await reapOwnedAgentGroups(home, generation);
}

async function shutdownDuringStartup(
  child: ChildProcess,
  events: ChildEventQueue,
  signals: SignalQueue,
  home: string,
  generation: OwnedDaemonGeneration,
  reason: PrepareShutdownReason
): Promise<void> {
  requestShutdown(child, reason);
  let stopped: Extract<SupervisorFrame, { t: "stopped" }> | undefined;
  const deadline = new Promise<{ kind: "deadline" }>((resolveDeadline) => {
    setTimeout(() => resolveDeadline({ kind: "deadline" }), 30_000).unref();
  });
  const pendingSignal = signals.next().then((nextReason) => ({ kind: "signal" as const, reason: nextReason }));
  for (;;) {
    const winner = await Promise.race([
      events.next().then((event) => ({ kind: "child" as const, event })),
      pendingSignal,
      deadline
    ]);
    // B2: 启动期第二信号立即 emergency stop。
    if (winner.kind === "signal") {
      await emergencyStop(child, home, generation);
      throw new Error("daemon startup shutdown forced by repeated signal");
    }
    if (winner.kind === "deadline") {
      await emergencyStop(child, home, generation);
      throw new Error("daemon startup shutdown deadline exceeded");
    }
    if (winner.event.kind === "frame") {
      if (winner.event.frame.t === "stopped") stopped = winner.event.frame;
      else if (winner.event.frame.t === "fatal") {
        await emergencyStop(child, home, generation);
        throw new Error(`${winner.event.frame.code}:${winner.event.frame.message}`);
      }
      continue;
    }
    if (stopped?.reason === reason && winner.event.code === 0 && winner.event.signal === null) return;
    await reapStartupChildGroups(home, generation);
    throw new Error(
      `daemon 启动期未优雅停止(code=${String(winner.event.code)},signal=${String(winner.event.signal)})`
    );
  }
}

export async function runOwned(options: OwnedRunOptions): Promise<void> {
  const { home, port, paths } = options;
  if (!existsSync(paths.daemon) || !existsSync(paths.consoleDist)) {
    throw new Error("distribution_incomplete:daemon 或 console 产物缺失");
  }
  mkdirSync(home, { recursive: true, mode: 0o700 });
  const signals = new SignalQueue();
  let pendingSignal: Promise<{ kind: "signal"; reason: PrepareShutdownReason }> = signals.next().then((reason) => ({
    kind: "signal",
    reason
  }));
  let openBrowser = options.openBrowser;
  const restartTimes: number[] = [];
  for (;;) {
    const instanceId = randomUUID();
    const child = fork(paths.daemon, [], {
      stdio: ["inherit", "inherit", "inherit", "ipc"],
      env: {
        ...process.env,
        SAYDO_HOME: home,
        SAYDO_DAEMON_PORT: String(port),
        SAYDO_CONSOLE_DIST: paths.consoleDist,
        SAYDO_SUPERVISED: "1",
        SAYDO_RUNTIME_INSTANCE_ID: instanceId
      }
    });
    if (!child.pid) throw new Error("daemon fork 未返回 pid");
    const generation: OwnedDaemonGeneration = { pid: child.pid, instanceId };
    const events = new ChildEventQueue(child);
    const startupDeadline = new Promise<{ kind: "startup_deadline" }>((resolveDeadline) => {
      setTimeout(() => resolveDeadline({ kind: "startup_deadline" }), 30_000).unref();
    });
    const firstWinner = await Promise.race([
      events.next().then((event) => ({ kind: "child" as const, event })),
      pendingSignal,
      startupDeadline
    ]);
    if (firstWinner.kind === "startup_deadline") {
      await emergencyStop(child, home, generation);
      throw new Error("daemon startup deadline exceeded");
    }
    if (firstWinner.kind === "signal") {
      pendingSignal = signals.next().then((reason) => ({ kind: "signal" as const, reason }));
      await shutdownDuringStartup(child, events, signals, home, generation, firstWinner.reason);
      return;
    }
    const first = firstWinner.event;
    if (first.kind === "exit") {
      const race = await probeStartupRace(home, port);
      if (race.kind === "attached") {
        process.stdout.write(`${JSON.stringify({ mode: "attached", pid: race.pid, identity: race.identity })}\n`);
        await pendingSignal;
        return;
      }
      await reapStartupChildGroups(home, generation);
      throw new Error(`daemon exited before IPC frame(code=${String(first.code)},signal=${String(first.signal)})`);
    }
    const frame = first.frame;
    if (frame.t === "fatal" && frame.code === "port_conflict") {
      const race = await probeStartupRace(home, port);
      if (race.kind === "attached") {
        process.stdout.write(`${JSON.stringify({ mode: "attached", pid: race.pid, identity: race.identity })}\n`);
        await pendingSignal;
        return;
      }
    }
    if (frame.t === "fatal") {
      await emergencyStop(child, home, generation);
      throw new Error(`${frame.code}:${frame.message}`);
    }
    if (frame.t !== "ready") {
      await emergencyStop(child, home, generation);
      throw new Error(`daemon 首帧必须为 ready,got ${frame.t}`);
    }
    process.stdout.write(`${JSON.stringify({
      mode: "owned",
      runtimeMode: frame.readiness.coreReady ? "normal" : "recovery_only",
      pid: child.pid,
      ...frame
    })}\n`);
    if (openBrowser) {
      void openExternal(consoleUrl(port, tokenOf(home))).catch((err) => {
        process.stderr.write(`[warn] 浏览器打开失败:${String(err instanceof Error ? err.message : err)}\n`);
      });
      openBrowser = false;
    }

    let restartRequested = false;
    let stopped: Extract<SupervisorFrame, { t: "stopped" }> | undefined;
    let shutdownReason: PrepareShutdownReason | undefined;
    let shutdownDeadline: Promise<{ kind: "deadline" }> | undefined;
    const armShutdownDeadline = (): void => {
      // B2: prepare 所有来源（signal / restartRequested）统一 arm supervisor deadline。
      shutdownDeadline = new Promise((resolveDeadline) => {
        setTimeout(() => resolveDeadline({ kind: "deadline" }), 30_000).unref();
      });
    };
    let pendingEvent = events.next();
    for (;;) {
      const winner = await Promise.race([
        pendingEvent.then((event) => ({ kind: "child" as const, event })),
        pendingSignal,
        shutdownDeadline ?? new Promise<never>(() => undefined)
      ]);
      if (winner.kind === "deadline") {
        await emergencyStop(child, home, generation);
        throw new Error("daemon shutdown deadline exceeded");
      }
      if (winner.kind === "signal") {
        if (shutdownReason || restartRequested) {
          await emergencyStop(child, home, generation);
          throw new Error("daemon shutdown forced by repeated signal");
        }
        shutdownReason ??= winner.reason;
        pendingSignal = signals.next().then((reason) => ({ kind: "signal" as const, reason }));
        requestShutdown(child, winner.reason);
        armShutdownDeadline();
        continue;
      }
      pendingEvent = events.next();
      if (winner.event.kind === "frame") {
        const next = winner.event.frame;
        if (next.t === "restartRequested") {
          restartRequested = true;
          requestShutdown(child, "restart");
          armShutdownDeadline();
        }
        else if (next.t === "stopped") stopped = next;
        else if (next.t === "fatal") {
          await emergencyStop(child, home, generation);
          throw new Error(`${next.code}:${next.message}`);
        }
        continue;
      }
      const { code, signal: exitSignal } = winner.event;
      if (shutdownReason) {
        const acceptedReason = stopped?.reason === shutdownReason || (restartRequested && stopped?.reason === "restart");
        if (!stopped || !acceptedReason || code !== 0 || exitSignal !== null) {
          await reapOwnedAgentGroups(home, generation);
          throw new Error(`daemon 未优雅停止(code=${String(code)},signal=${String(exitSignal)})`);
        }
        return;
      }
      if (restartRequested && stopped?.reason === "restart" && code === 0 && exitSignal === null) {
        const now = Date.now();
        restartTimes.push(now);
        while (restartTimes[0] !== undefined && now - restartTimes[0] > 60_000) restartTimes.shift();
        if (restartTimes.length > 3) throw new Error("daemon restart fuse opened:60 秒内超过 3 次");
        await new Promise((resolve) => setTimeout(resolve, restartTimes.length * 100));
        break;
      }
      await reapOwnedAgentGroups(home, generation);
      throw new Error(`owned daemon 意外退出(code=${String(code)},signal=${String(exitSignal)})`);
    }
  }
}
