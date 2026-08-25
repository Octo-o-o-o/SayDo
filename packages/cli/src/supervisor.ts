import { fork, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  supervisorFrameSchema,
  type PrepareShutdownReason,
  type SupervisorFrame
} from "@saydo/contracts";
import { brandTrustedFailure, isReparsePoint, processBirth, projectUntrustedFailureText } from "@saydo/platform";
import { CLI_PROTOCOL_VERSION } from "./buildIdentity.js";
import { consoleUrl, openExternal } from "./open.js";
import { probeDaemon, type DaemonProbe } from "./probe.js";
import { reapOwnedAgentGroups, type OwnedDaemonGeneration } from "./emergencyReaper.js";

export function pruneRestartStorm(times: number[], now: number, windowMs = 60_000): number[] {
  return times.filter((stamp) => {
    const delta = now - stamp;
    return delta < 0 || delta <= windowMs;
  });
}

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

export function cliStopPath(home: string, pid: number): string {
  return join(home, "runtime", `cli-stop-${String(pid)}`);
}

export function consumeCliStop(home: string, pid: number): PrepareShutdownReason | undefined {
  const path = cliStopPath(home, pid);
  try {
    if (!existsSync(path)) return undefined;
    if (isReparsePoint(path) || !lstatSync(path).isFile()) return undefined;
    const raw = readFileSync(path, "utf8").trim();
    rmSync(path, { force: true });
    if (raw === "cli_sigint" || raw === "app_quit" || raw === "restart" || raw === "supervisor_stop") {
      return raw;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/** npm exec / 前台进程组会把同一次 Ctrl+C 瞬时投递多次;窗口须短于人工二次按键。 */
export const OS_SIGNAL_DEDUP_WINDOW_MS = 50;

type SupervisorOsSignal = "SIGINT" | "SIGTERM";

export class SignalQueue {
  private readonly queued: PrepareShutdownReason[] = [];
  private waiter: ((reason: PrepareShutdownReason) => void) | undefined;
  private readonly lastOsSignalAt = new Map<SupervisorOsSignal, number>();
  private readonly now: () => number;

  constructor(home: string, options: { now?: () => number; attach?: boolean } = {}) {
    this.now = options.now ?? (() => performance.now());
    if (options.attach === false) return;
    process.on("SIGINT", () => this.enqueueOsSignal("SIGINT"));
    process.on("SIGTERM", () => this.enqueueOsSignal("SIGTERM"));
    mkdirSync(join(home, "runtime"), { recursive: true, mode: 0o700 });
    const timer = setInterval(() => {
      const reason = consumeCliStop(home, process.pid);
      if (reason) this.enqueueControl(reason);
    }, 100);
    timer.unref();
  }

  next(): Promise<PrepareShutdownReason> {
    const reason = this.queued.shift();
    if (reason) return Promise.resolve(reason);
    return new Promise((resolveSignal) => { this.waiter = resolveSignal; });
  }

  queuedReasons(): readonly PrepareShutdownReason[] {
    return this.queued;
  }

  enqueueOsSignal(signal: SupervisorOsSignal): void {
    const now = this.now();
    const last = this.lastOsSignalAt.get(signal);
    const delta = last === undefined ? undefined : now - last;
    if (delta !== undefined && delta >= 0 && delta < OS_SIGNAL_DEDUP_WINDOW_MS) return;
    this.lastOsSignalAt.set(signal, now);
    this.push(signal === "SIGINT" ? "cli_sigint" : "supervisor_stop");
  }

  enqueueControl(reason: PrepareShutdownReason): void {
    this.push(reason);
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

export async function holdAttached(
  probe: Extract<DaemonProbe, { kind: "attached" }>,
  home: string
): Promise<void> {
  const signals = new SignalQueue(home);
  process.stdout.write(
    `${JSON.stringify({ mode: "attached", pid: probe.pid, supervisorPid: process.pid, identity: probe.identity })}\n`
  );
  await signals.next();
}

interface OwnedRunOptions {
  home: string;
  port: number;
  paths: SupervisorPaths;
  openBrowser: boolean;
  now?: () => number;
}

type ChildEvent =
  | { kind: "frame"; frame: SupervisorFrame }
  | { kind: "exit"; code: number | null; signal: NodeJS.Signals | null };

export class ChildEventQueue {
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
  return processBirth(pid);
}

/**
 * 锁归属三态。`homeLockAllowsReap` 只回答"是不是我的"，把「锁不存在」「锁损坏」
 * 与「锁属于他人」压成同一个 false——据此报 home_owned 会把 daemon 在取锁之前就
 * 失败（Koffi 缺失 / ABI 不匹配 / 不支持的架构）误述成"已有实例占用"，掩盖真故障。
 */
export type HomeLockOwnership = "self" | "foreign" | "absent" | "unreadable";

export function homeLockOwnership(home: string, generation: OwnedDaemonGeneration): HomeLockOwnership {
  const lock = join(home, ".daemon-supervisor.lock");
  if (!existsSync(lock)) return "absent";
  try {
    const owner = JSON.parse(readFileSync(lock, "utf8")) as {
      version?: unknown;
      pid?: unknown;
      processStart?: unknown;
      instanceId?: unknown;
    };
    const wellFormed = owner.version === 1 &&
      Number.isInteger(owner.pid) &&
      typeof owner.processStart === "string" &&
      owner.processStart !== "";
    if (!wellFormed) return "unreadable";
    const mine = owner.pid === generation.pid &&
      owner.instanceId === generation.instanceId &&
      processStart(generation.pid) === owner.processStart;
    return mine ? "self" : "foreign";
  } catch {
    return "unreadable";
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

export async function reapOwnedAgentsIfHomeOwner(
  home: string,
  generation: OwnedDaemonGeneration
): Promise<void> {
  if (!homeLockAllowsReap(home, generation)) return;
  await reapOwnedAgentGroups(home, generation);
}

async function reapStartupChildGroups(home: string, generation: OwnedDaemonGeneration): Promise<void> {
  await reapOwnedAgentsIfHomeOwner(home, generation);
}

export async function probeStartupRace(
  home: string,
  port: number,
  options: {
    now?: () => number;
    deadlineMs?: number;
    sleep?: (ms: number) => Promise<void>;
    probe?: typeof probeDaemon;
  } = {}
): Promise<DaemonProbe> {
  const now = options.now ?? (() => performance.now());
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const probeFn = options.probe ?? probeDaemon;
  const startedAt = now();
  const deadlineAt = startedAt + (options.deadlineMs ?? 15_000);
  for (;;) {
    const probe = await probeFn(home, port, CLI_PROTOCOL_VERSION);
    const t = now();
    // B9: 同 HOME starting/unknown 有界重试；无法验证时不 kill。wall 回拨视为到期。
    if (
      probe.kind === "attached" ||
      (probe.kind === "conflict" &&
        probe.reason !== "unknown_service" &&
        probe.reason !== "ownership_unverified" &&
        probe.reason !== "token_unavailable") ||
      t >= deadlineAt ||
      t < startedAt
    ) {
      return probe;
    }
    if (probe.kind !== "available" && probe.kind !== "conflict") return probe;
    await sleep(50);
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
  await reapOwnedAgentsIfHomeOwner(home, generation);
}

export async function shutdownDuringStartup(
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
  const signals = new SignalQueue(home);
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
      // 启动期第二原因只由 shutdownDuringStartup 消费，禁止在此预取 signals.next()。
      await shutdownDuringStartup(child, events, signals, home, generation, firstWinner.reason);
      return;
    }
    const first = firstWinner.event;
    if (first.kind === "exit") {
      const ownership = homeLockOwnership(home, generation);
      if (ownership === "foreign") {
        throw brandTrustedFailure("home_owned");
      }
      if (ownership !== "self") {
        // 锁不存在或不可解析：daemon 在取得 HOME 锁之前就退出了（Koffi 缺失、ABI/bind
        // 失败、不支持的架构等）。此时报 home_owned 会把 native 启动失败说成"已有实例
        // 占用"，用户按后者排查永远找不到原因。如实报启动失败，不做 reap。
        throw new Error(
          `daemon exited before acquiring home lock(code=${String(first.code)},signal=${String(first.signal)},lock=${ownership})`
        );
      }
      const race = await probeStartupRace(home, port);
      if (race.kind === "attached") {
        process.stdout.write(
          `${JSON.stringify({ mode: "attached", pid: race.pid, supervisorPid: process.pid, identity: race.identity })}\n`
        );
        await pendingSignal;
        return;
      }
      await reapStartupChildGroups(home, generation);
      if (race.kind === "conflict") {
        throw brandTrustedFailure(`port_conflict:${race.reason}`);
      }
      throw new Error(`daemon exited before IPC frame(code=${String(first.code)},signal=${String(first.signal)})`);
    }
    const frame = first.frame;
    if (frame.t === "fatal" && frame.code === "home_owned") {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      await waitForChildExit(child);
      // waitForChildExit 只等 2s 便无条件返回，不保证目标真的退出——必须显式复核，
      // 否则 loser child/IPC 可能仍存活：attached CLI 收到退出信号后会被该 child
      // handle 拖住不退，强退 supervisor 还会留下孤儿。与 emergencyStop 同一判据。
      if (child.exitCode === null && child.signalCode === null) {
        throw new Error("daemon SIGKILL 后仍未退出");
      }
      // 此时 loser 已收口。而探到的现役必然属于他人还有第二重依据：发出
      // fatal/home_owned 的子进程从未取得 HOME 锁，不会在任何端口提供服务。
      // 于是同 HOME 同端口收敛为 attach，同 HOME 不同端口才拒绝。
      // 两条路径都不得 reap/kill 现役进程组。
      // 这里不能在 probe 返回 available 时提前退出：端口空闲有两种
      // 可能——(a) 同端口场景下赢者尚在启动、还没 listen，必须等它起来后 attach；
      // (b) 不同端口场景下 owner 监听在别处，等也无用。而 HOME 锁只记
      // pid/processStart/instanceId、不记端口，无从区分。提前放弃会让 (a) 的并发
      // attach 退化成拒绝（Windows 真机 verify:distribution :842 实测复现）。
      // 代价是 (b) 会空等到 deadline —— 作为已知限制记录，不以正确性换延迟。
      const race = await probeStartupRace(home, port);
      if (race.kind === "attached") {
        process.stdout.write(
          `${JSON.stringify({ mode: "attached", pid: race.pid, supervisorPid: process.pid, identity: race.identity })}\n`
        );
        await pendingSignal;
        return;
      }
      throw brandTrustedFailure("home_owned");
    }
    if (frame.t === "fatal" && frame.code === "port_conflict") {
      const race = await probeStartupRace(home, port);
      if (race.kind === "attached") {
        process.stdout.write(
          `${JSON.stringify({ mode: "attached", pid: race.pid, supervisorPid: process.pid, identity: race.identity })}\n`
        );
        await pendingSignal;
        return;
      }
      await emergencyStop(child, home, generation);
      throw brandTrustedFailure(
        race.kind === "conflict" ? `port_conflict:${race.reason}` : "port_conflict"
      );
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
      supervisorPid: process.pid,
      ...frame
    })}\n`);
    if (openBrowser) {
      void openExternal(consoleUrl(port, tokenOf(home))).catch((err) => {
        try {
          process.stderr.write(`[warn] 浏览器打开失败:${projectUntrustedFailureText(err, "open failed")}\n`);
        } catch {
          process.stderr.write("[warn] 浏览器打开失败:open failed\n");
        }
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
          await reapOwnedAgentsIfHomeOwner(home, generation);
          throw new Error(`daemon 未优雅停止(code=${String(code)},signal=${String(exitSignal)})`);
        }
        return;
      }
      if (restartRequested && stopped?.reason === "restart" && code === 0 && exitSignal === null) {
        const now = options.now ?? (() => performance.now());
        const stamp = now();
        restartTimes.push(stamp);
        const kept = pruneRestartStorm(restartTimes, stamp);
        restartTimes.length = 0;
        restartTimes.push(...kept);
        if (restartTimes.length > 3) throw new Error("daemon restart fuse opened:60 秒内超过 3 次");
        await new Promise((resolve) => setTimeout(resolve, restartTimes.length * 100));
        break;
      }
      await reapOwnedAgentsIfHomeOwner(home, generation);
      throw new Error(`owned daemon 意外退出(code=${String(code)},signal=${String(exitSignal)})`);
    }
  }
}
