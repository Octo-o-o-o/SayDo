import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { formatSayDoJobName, processBirth } from "@saydo/platform";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import {
  cliStopPath,
  consumeCliStop,
  homeLockAllowsReap,
  reapOwnedAgentsIfHomeOwner,
  OS_SIGNAL_DEDUP_WINDOW_MS,
  probeStartupRace,
  pruneRestartStorm,
  SignalQueue,
  shutdownDuringStartup,
  ChildEventQueue
} from "../src/supervisor.js";

// 取一个几乎不可能存活的 pid：用于构造"leader 已死"的 owner 记录。
const DEAD_PID = 2147483646;
// generation 必须是 36 字符 UUID（isSayDoGeneration 的硬约束），与 emergency-reaper.test.ts 一致。

const homes = new Set<string>();

afterEach(() => {
  for (const home of homes) rmSync(home, { recursive: true, force: true });
  homes.clear();
});

function home(): string {
  const value = mkdtempSync(join(tmpdir(), "saydo-supervisor-home-"));
  homes.add(value);
  return value;
}

describe("startup emergency cleanup ownership", () => {
  it("只允许清理本次 child 的 HOME；另一端口的现役 owner 不受影响", () => {
    const root = home();
    const processStart = processBirth(process.pid);
    if (!processStart) throw new Error("本进程 birth 不可用");
    writeFileSync(join(root, ".daemon-supervisor.lock"), JSON.stringify({
      version: 1,
      pid: process.pid,
      processStart,
      instanceId: "current-instance"
    }));
    expect(homeLockAllowsReap(root, { pid: process.pid, instanceId: "current-instance" })).toBe(true);
    expect(homeLockAllowsReap(root, { pid: process.pid, instanceId: "other-instance" })).toBe(false);
  });

  it("锁损坏或缺失时都 fail-closed", () => {
    const root = home();
    const lock = join(root, ".daemon-supervisor.lock");
    writeFileSync(lock, "invalid");
    expect(homeLockAllowsReap(root, { pid: process.pid, instanceId: "current-instance" })).toBe(false);
    rmSync(lock);
    expect(homeLockAllowsReap(root, { pid: process.pid, instanceId: "current-instance" })).toBe(false);
  });

  it("未持锁的 generation reapOwnedAgentsIfHomeOwner 必须是 no-op", async () => {
    const root = home();
    // 锁属于他人。
    writeFileSync(join(root, ".daemon-supervisor.lock"), JSON.stringify({
      version: 1,
      pid: 4242,
      processStart: "owner-birth",
      instanceId: "owner-instance"
    }));
    // 关键:owner 记录的 ownerPid/ownerInstanceId 与下面传入的 generation **匹配**,
    // 且 pid 指向一个已死进程。于是两种实现产生可观测差异:
    //   早退(正确)      -> 记录原样留存
    //   未早退而走 reaper -> generation 匹配 + leader 已死,记录会被 commitAgentDelete 删掉
    // 旧版本只断言 homeLockAllowsReap 的返回值——那是另一个函数,与 reap 是否发生无关,
    // 把生产早退删掉照样能过。
    const generation = { pid: 9001, instanceId: "loser-instance" };
    const gen = "01234567-89ab-cdef-0123-456789abcdef";
    const runId = "run_noop_probe";
    const runDir = join(root, "tier1", "runs", runId);
    mkdirSync(runDir, { recursive: true });
    const ownerPath = join(runDir, "agent-owner.json");
    writeFileSync(ownerPath, JSON.stringify({
      version: 1,
      kind: "tier1:agent",
      binary: process.execPath,
      worktree: join(root, "worktree"),
      runId,
      generation: gen,
      commandToken: `saydo-child-${gen}`,
      jobName: formatSayDoJobName("Local", generation.instanceId, runId, gen),
      pid: DEAD_PID,
      processStart: "dead-birth",
      ownerPid: generation.pid,
      ownerInstanceId: generation.instanceId
    }));

    await reapOwnedAgentsIfHomeOwner(root, generation);

    expect(existsSync(ownerPath)).toBe(true);
  });
});

describe("cli-stop 文件", () => {
  it("按 pid 分文件,白名单 reason 消费后删除,非法内容忽略", () => {
    const root = home();
    mkdirSync(join(root, "runtime"), { recursive: true });
    const path = cliStopPath(root, 4242);
    expect(path).toBe(join(root, "runtime", "cli-stop-4242"));
    writeFileSync(path, "cli_sigint\n");
    expect(consumeCliStop(root, 4242)).toBe("cli_sigint");
    expect(consumeCliStop(root, 4242)).toBeUndefined();
    writeFileSync(cliStopPath(root, 4242), "taskkill\n");
    expect(consumeCliStop(root, 4242)).toBeUndefined();
  });
});

describe("OS signal 去重", () => {
  function queue(now: () => number): SignalQueue {
    return new SignalQueue(home(), { now, attach: false });
  }

  it("同一种 OS signal 瞬时重复只产生一个队列事件", () => {
    let now = 0;
    const signals = queue(() => now);
    signals.enqueueOsSignal("SIGINT");
    signals.enqueueOsSignal("SIGINT");
    now = OS_SIGNAL_DEDUP_WINDOW_MS - 1;
    signals.enqueueOsSignal("SIGINT");
    expect(signals.queuedReasons()).toEqual(["cli_sigint"]);
  });

  it("不同 signal 都保留", () => {
    const signals = queue(() => 0);
    signals.enqueueOsSignal("SIGINT");
    signals.enqueueOsSignal("SIGTERM");
    signals.enqueueOsSignal("SIGINT");
    expect(signals.queuedReasons()).toEqual(["cli_sigint", "supervisor_stop"]);
  });

  it("超过去重窗口的同种 signal 仍产生第二个事件", () => {
    let now = 0;
    const signals = queue(() => now);
    signals.enqueueOsSignal("SIGINT");
    now = OS_SIGNAL_DEDUP_WINDOW_MS;
    signals.enqueueOsSignal("SIGINT");
    expect(signals.queuedReasons()).toEqual(["cli_sigint", "cli_sigint"]);
  });

  it("cli-stop 显式控制原因不被 OS signal 去重吞掉", () => {
    const signals = queue(() => 0);
    signals.enqueueOsSignal("SIGINT");
    signals.enqueueControl("cli_sigint");
    signals.enqueueControl("app_quit");
    expect(signals.queuedReasons()).toEqual(["cli_sigint", "cli_sigint", "app_quit"]);
  });

  it("时钟回拨后的第二次 signal 不被无限吞掉", () => {
    let now = 100;
    const signals = queue(() => now);
    signals.enqueueOsSignal("SIGINT");
    now = 10;
    signals.enqueueOsSignal("SIGINT");
    expect(signals.queuedReasons()).toEqual(["cli_sigint", "cli_sigint"]);
  });

  it("超过 50ms 的同 signal 仍保留第二次", () => {
    let now = 0;
    const signals = queue(() => now);
    signals.enqueueOsSignal("SIGTERM");
    now = OS_SIGNAL_DEDUP_WINDOW_MS + 1;
    signals.enqueueOsSignal("SIGTERM");
    expect(signals.queuedReasons()).toEqual(["supervisor_stop", "supervisor_stop"]);
  });
});

describe("启动期第二原因只由 shutdownDuringStartup 消费", () => {
  function fakeChild(): ChildProcess {
    const child = new EventEmitter() as ChildProcess;
    Object.defineProperty(child, "pid", { value: 99 });
    Object.defineProperty(child, "connected", { value: false });
    Object.defineProperty(child, "exitCode", { value: 0, writable: true });
    Object.defineProperty(child, "signalCode", { value: null, writable: true });
    child.kill = () => {
      Object.defineProperty(child, "exitCode", { value: 0, writable: true });
      return true;
    };
    child.send = () => false;
    return child;
  }

  it("首个 pending 已 resolve、启动分支尚未处理时，不同 OS signal 触发 emergency", async () => {
    const root = home();
    const signals = new SignalQueue(root, { now: () => 0, attach: false });
    const firstPending = signals.next();
    signals.enqueueOsSignal("SIGINT");
    const first = await firstPending;
    expect(first).toBe("cli_sigint");
    signals.enqueueOsSignal("SIGTERM");
    const child = fakeChild();
    const events = new ChildEventQueue(child);
    await expect(shutdownDuringStartup(child, events, signals, root, { pid: 99, instanceId: "i" }, first))
      .rejects.toThrow(/repeated signal/u);
  });

  it("超过窗口的同 signal 作为第二原因触发 emergency", async () => {
    const root = home();
    let now = 0;
    const signals = new SignalQueue(root, { now: () => now, attach: false });
    const firstPending = signals.next();
    signals.enqueueOsSignal("SIGINT");
    await firstPending;
    now = OS_SIGNAL_DEDUP_WINDOW_MS;
    signals.enqueueOsSignal("SIGINT");
    const child = fakeChild();
    const events = new ChildEventQueue(child);
    await expect(shutdownDuringStartup(child, events, signals, root, { pid: 99, instanceId: "i" }, "cli_sigint"))
      .rejects.toThrow(/repeated signal/u);
  });

  it("cli-stop/control 作为第二原因触发 emergency", async () => {
    const root = home();
    const signals = new SignalQueue(root, { now: () => 0, attach: false });
    const firstPending = signals.next();
    signals.enqueueOsSignal("SIGINT");
    await firstPending;
    signals.enqueueControl("app_quit");
    const child = fakeChild();
    const events = new ChildEventQueue(child);
    await expect(shutdownDuringStartup(child, events, signals, root, { pid: 99, instanceId: "i" }, "cli_sigint"))
      .rejects.toThrow(/repeated signal/u);
  });
});

describe("probeStartupRace 与 restart fuse 单调时钟", () => {
  it("wall 回拨时启动探测有界返回", async () => {
    let now = 100;
    let probes = 0;
    const result = await probeStartupRace(home(), 9, {
      now: () => now,
      deadlineMs: 15_000,
      sleep: async () => {
        now = 10;
      },
      probe: async () => {
        probes += 1;
        return { kind: "conflict", reason: "unknown_service" } as Awaited<ReturnType<typeof probeStartupRace>>;
      }
    });
    expect(result.kind).toBe("conflict");
    expect(probes).toBeLessThan(5);
  });

  it("wall 前跳时启动探测有界返回", async () => {
    let now = 100;
    let probes = 0;
    const result = await probeStartupRace(home(), 9, {
      now: () => now,
      deadlineMs: 15_000,
      sleep: async () => {
        now = 100 + 20_000;
      },
      probe: async () => {
        probes += 1;
        return { kind: "conflict", reason: "unknown_service" } as Awaited<ReturnType<typeof probeStartupRace>>;
      }
    });
    expect(result.kind).toBe("conflict");
    expect(probes).toBeLessThan(5);
  });

  it("回拨不得清空 restart storm", () => {
    const kept = pruneRestartStorm([100, 100, 100], 10);
    expect(kept).toEqual([100, 100, 100]);
  });

  it("前跳到期记录被丢掉，不得长期保留", () => {
    const kept = pruneRestartStorm([100], 100 + 60_001);
    expect(kept).toEqual([]);
  });
});
