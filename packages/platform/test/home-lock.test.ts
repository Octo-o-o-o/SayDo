import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  HOME_OWNER_LOCK_FAILED,
  HOME_OWNER_LOCK_TIMEOUT,
  withHomeOwnerBoundary,
  withHomeOwnerBoundarySync
} from "../src/homeLock.js";
import { commitOwnerReapIfIdentity, formatSayDoJobName, runtimeOwnerIdentity, parseAnyRuntimeOwnerRecord } from "../src/jobIdentity.js";

const CHILD_STOP_MS = 3_000;
const ownedHomes: string[] = [];
const ownedChildren: ChildProcess[] = [];
const childDiagnostics = new WeakMap<ChildProcess, { output: Buffer; spawnError: string | null }>();

/** 只保留测试子进程最后8KiB诊断；失败不能仅丢失为exit1。 */
function childFailureDetail(child: ChildProcess): string {
  const diag = childDiagnostics.get(child);
  return JSON.stringify({ pid: child.pid ?? null, exitCode: child.exitCode, signalCode: child.signalCode,
    spawnError: diag?.spawnError ?? null, output: diag?.output.toString("utf8") ?? "" });
}

function childHasExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null;
}

function resolveExisting(path: string): string {
  try {
    if (existsSync(path)) return realpathSync(path);
  } catch {
    // 目录已不在，只按字面路径约束
  }
  return resolve(path);
}

function isOwnedTempHome(home: string): boolean {
  const root = resolveExisting(tmpdir());
  const target = resolveExisting(home);
  const rel = relative(root, target);
  if (rel === "" || rel.startsWith("..") || rel.split(sep).length !== 1) return false;
  const name = basename(target);
  return name.startsWith("saydo-lock-") || name.startsWith("saydo-cas-");
}

function waitChildExit(child: ChildProcess, timeoutMs: number): Promise<"exited" | "timeout"> {
  return new Promise((resolveWait) => {
    let settled = false;
    const finish = (result: "exited" | "timeout"): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off("exit", onExit);
      resolveWait(result);
    };
    const onExit = (): void => {
      finish("exited");
    };
    const timer = setTimeout(() => finish("timeout"), timeoutMs);
    child.once("exit", onExit);
    if (childHasExited(child)) finish("exited");
  });
}

async function waitChildTerminated(
  child: ChildProcess,
  timeoutMs: number,
  onTimeout: () => Error
): Promise<{ exitCode: number | null; signalCode: NodeJS.Signals | null }> {
  const result = await waitChildExit(child, timeoutMs);
  if (result !== "exited") throw onTimeout();
  return { exitCode: child.exitCode, signalCode: child.signalCode };
}

async function stopOwnedChild(child: ChildProcess, timeoutMs: number): Promise<"exited" | "timeout"> {
  if (childHasExited(child)) return "exited";
  try {
    child.kill("SIGKILL");
  } catch {
    // 已退出或尚未启动
  }
  if (childHasExited(child)) return "exited";
  return waitChildExit(child, timeoutMs);
}

async function disposeOwned(): Promise<void> {
  const children = ownedChildren.slice();
  const live: ChildProcess[] = [];
  await Promise.all(children.map(async (child) => {
    if ((await stopOwnedChild(child, CHILD_STOP_MS)) !== "exited") live.push(child);
  }));
  ownedChildren.length = 0;
  for (const child of live) ownedChildren.push(child);
  if (live.length > 0) {
    const detail = live.map((child) => {
      return `pid=${String(child.pid ?? "?")}:exitCode=${String(child.exitCode)}:signalCode=${String(child.signalCode)}`;
    }).join(",");
    throw new Error(`owned child still live after ${String(CHILD_STOP_MS)}ms:${detail}`);
  }
  const homes = ownedHomes.slice();
  const leftoverHomes: string[] = [];
  for (const home of homes) {
    if (!isOwnedTempHome(home)) {
      leftoverHomes.push(home);
      continue;
    }
    try {
      rmSync(home, { recursive: true, force: true });
    } catch {
      leftoverHomes.push(home);
      continue;
    }
    const idx = ownedHomes.indexOf(home);
    if (idx >= 0) ownedHomes.splice(idx, 1);
  }
  if (leftoverHomes.length > 0) {
    throw new Error(`owned home not removed:${leftoverHomes.join(",")}`);
  }
}

function createOwnedHome(prefix: string): string {
  const home = mkdtempSync(join(tmpdir(), prefix));
  ownedHomes.push(home);
  return home;
}

function spawnOwned(command: string, args: string[], options: Parameters<typeof spawn>[2]): ChildProcess {
  // ignore原先丢弃waiter启动错误；改为有界捕获，不改变stdin、argv或env。
  const child = spawn(command, args, options?.stdio === "ignore"
    ? { ...options, stdio: ["ignore", "pipe", "pipe"] }
    : options);
  const diag = { output: Buffer.alloc(0), spawnError: null as string | null };
  childDiagnostics.set(child, diag);
  const capture = (chunk: Buffer): void => {
    diag.output = Buffer.concat([diag.output, chunk]).subarray(-8192);
  };
  child.stdout?.on("data", capture);
  child.stderr?.on("data", capture);
  child.once("error", (err) => { diag.spawnError = err.message; });
  ownedChildren.push(child);
  return child;
}

afterEach(async () => {
  await disposeOwned();
});

const GEN = "01234567-89ab-cdef-0123-456789abcdef";
const TOKEN = `saydo-child-${GEN}`;

function ownerRecord(overrides: Record<string, unknown> = {}) {
  const ownerInstanceId = String(overrides.ownerInstanceId ?? "owner");
  const runId = String(overrides.runId ?? "run");
  const generation = String(overrides.generation ?? GEN);
  return {
    version: 1,
    pid: 4242,
    kind: "exec",
    binary: process.execPath,
    processStart: "birth-a",
    ownerPid: 2,
    ownerInstanceId: "owner",
    runId: "run",
    commandToken: TOKEN,
    generation: GEN,
    jobName: formatSayDoJobName("Local", ownerInstanceId, runId, generation),
    ...overrides
  };
}

describe("跨进程 home owner lock", () => {
  it("同一 home 串行：第二个等待第一个释放", async () => {
    const home = createOwnedHome("saydo-lock-");
    const order: string[] = [];
    let releaseFirst!: () => void;
    const firstHold = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const first = withHomeOwnerBoundary(home, async () => {
      order.push("first-enter");
      await firstHold;
      order.push("first-leave");
      return 1;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const second = withHomeOwnerBoundary(home, async () => {
      order.push("second-enter");
      return 2;
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(order).toEqual(["first-enter"]);
    releaseFirst();
    expect(await first).toBe(1);
    expect(await second).toBe(2);
    expect(order).toEqual(["first-enter", "first-leave", "second-enter"]);
  });

  it("deadline 内拿不到锁则 fail-closed", async () => {
    const home = createOwnedHome("saydo-lock-to-");
    let releaseFirst!: () => void;
    const firstHold = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const first = withHomeOwnerBoundary(home, () => firstHold);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await expect(withHomeOwnerBoundary(home, () => 1, {
      deadlineMs: 40,
      now: (() => {
        let t = 0;
        return () => {
          t += 20;
          return t;
        };
      })(),
      sleep: async () => undefined
    })).rejects.toThrow(HOME_OWNER_LOCK_TIMEOUT);
    releaseFirst();
    await first;
  });

  it("identity 变化时 CAS 保留 successor owner", async () => {
    const home = createOwnedHome("saydo-cas-");
    const root = join(home, "runtime", "children");
    const { mkdirSync } = await import("node:fs");
    mkdirSync(root, { recursive: true, mode: 0o700 });
    const path = join(root, "4242.json");
    const first = ownerRecord();
    writeFileSync(path, JSON.stringify(first));
    const parsed = parseAnyRuntimeOwnerRecord(first);
    expect(parsed.status).not.toBe("invalid");
    if (parsed.status === "invalid") return;
    const captured = runtimeOwnerIdentity(parsed.record);
    const successor = ownerRecord({
      generation: "01234567-89ab-cdef-0123-456789abcde0",
      commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcde0"
    });
    writeFileSync(path, JSON.stringify(successor));
    expect(() => commitOwnerReapIfIdentity(path, captured, () => undefined, () => {
      throw new Error("must not unlink successor");
    })).toThrow(/owner identity cas failed/u);
    expect(existsSync(path)).toBe(true);
    expect(JSON.parse(readFileSync(path, "utf8")).generation).toBe("01234567-89ab-cdef-0123-456789abcde0");
  });
});

describe("两进程 writer/reaper 窗口", () => {
  it("CAS 在 identity 变化时不得 unlink", () => {
    const home = createOwnedHome("saydo-cas-sync-");
    const root = join(home, "runtime", "children");
    mkdirSync(root, { recursive: true, mode: 0o700 });
    const path = join(root, "88001.json");
    const first = ownerRecord({ pid: 88001 });
    writeFileSync(path, JSON.stringify(first));
    const parsed = parseAnyRuntimeOwnerRecord(first);
    expect(parsed.status).not.toBe("invalid");
    if (parsed.status === "invalid") return;
    const captured = runtimeOwnerIdentity(parsed.record);
    const successor = ownerRecord({
      pid: 88001,
      generation: "01234567-89ab-cdef-0123-456789abcde0",
      commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcde0"
    });
    writeFileSync(path, JSON.stringify(successor));
    expect(() => commitOwnerReapIfIdentity(path, captured, () => undefined, () => {
      throw new Error("must not unlink successor");
    })).toThrow(/owner identity cas failed/u);
    expect(existsSync(path)).toBe(true);
    expect(JSON.parse(readFileSync(path, "utf8")).generation).toBe("01234567-89ab-cdef-0123-456789abcde0");
  });

  it("async 持锁时 sync 不得 Atomics.wait 堵死事件循环", async () => {
    const home = createOwnedHome("saydo-lock-sync-");
    let releaseFirst!: () => void;
    const firstHold = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const first = withHomeOwnerBoundary(home, () => firstHold);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const started = performance.now();
    expect(() => withHomeOwnerBoundarySync(home, () => 1)).toThrow(HOME_OWNER_LOCK_TIMEOUT);
    expect(performance.now() - started).toBeLessThan(500);
    releaseFirst();
    await first;
  });

  it("sync 临界区业务异常不得降级成锁错误", () => {
    const home = createOwnedHome("saydo-lock-biz-");
    const err = new Error("permission denied writing owner") as NodeJS.ErrnoException;
    Object.defineProperty(err, "code", { value: "EACCES" });
    try {
      withHomeOwnerBoundarySync(home, () => {
        throw err;
      });
      throw new Error("expected throw");
    } catch (caught) {
      expect(caught).toBe(err);
      expect((caught as Error).message).toBe("permission denied writing owner");
      expect((caught as NodeJS.ErrnoException).code).toBe("EACCES");
      expect((caught as Error).message).not.toBe(HOME_OWNER_LOCK_FAILED);
    }
  });

  it("独立 Node 进程：sync 边界必须走 OS 锁，holder 存活时 waiter 不得 acquired", async () => {
    const home = createOwnedHome("saydo-lock-sync-proc-");
    const marker = join(home, "acquired.marker");
    const holdMarker = join(home, "holding.marker");
    const tsx = new URL("../../daemon/node_modules/tsx/dist/loader.mjs", import.meta.url).href;
    const worker = fileURLToPath(new URL("./fixtures/home-lock-worker.mjs", import.meta.url));
    const lockModule = fileURLToPath(new URL("../src/homeLock.ts", import.meta.url));
    const holder = spawnOwned(process.execPath, ["--import", tsx, worker], {
      env: {
        ...process.env,
        SAYDO_LOCK_HOME: home,
        SAYDO_LOCK_ROLE: "crash-hold",
        SAYDO_LOCK_MARKER: holdMarker,
        SAYDO_LOCK_MODULE: lockModule
      },
      stdio: "ignore"
    });
    try {
      const started = Date.now();
      while (!existsSync(holdMarker) && Date.now() - started < 5_000) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(existsSync(holdMarker)).toBe(true);
      const waiter = spawnOwned(process.execPath, ["--import", tsx, worker], {
        env: {
          ...process.env,
          SAYDO_LOCK_HOME: home,
          SAYDO_LOCK_ROLE: "sync-wait",
          SAYDO_LOCK_MARKER: marker,
          SAYDO_LOCK_MODULE: lockModule
        },
        stdio: "ignore"
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(existsSync(marker)).toBe(false);
      expect(childHasExited(holder), `holder:${childFailureDetail(holder)}`).toBe(false);
      holder.kill("SIGKILL");
      await waitChildTerminated(holder, CHILD_STOP_MS, () => new Error("holder stop timeout"));
      const waiterTerm = await waitChildTerminated(waiter, 8_000, () => {
        return new Error(`sync waiter lock timeout:${childFailureDetail(waiter)}:${existsSync(`${marker}.error`) ? readFileSync(`${marker}.error`, "utf8") : "no-error"}`);
      });
      const waiterExit = waiterTerm.exitCode ?? 1;
      if (waiterExit !== 0) {
        throw new Error(`waiter exit ${String(waiterExit)}:${childFailureDetail(waiter)}:${existsSync(`${marker}.error`) ? readFileSync(`${marker}.error`, "utf8") : "no-error"}`);
      }
      expect(readFileSync(marker, "utf8")).toBe("acquired");
    } finally {
      await disposeOwned();
    }
  }, 15_000);

  it("独立 Node 进程：持锁时另一进程等待，崩溃后锁自动释放", async () => {
    const home = createOwnedHome("saydo-lock-proc-");
    const marker = join(home, "acquired.marker");
    const holdMarker = join(home, "holding.marker");
    const tsx = new URL("../../daemon/node_modules/tsx/dist/loader.mjs", import.meta.url).href;
    const worker = fileURLToPath(new URL("./fixtures/home-lock-worker.mjs", import.meta.url));
    const lockModule = fileURLToPath(new URL("../src/homeLock.ts", import.meta.url));
    const holder = spawnOwned(process.execPath, ["--import", tsx, worker], {
      env: {
        ...process.env,
        SAYDO_LOCK_HOME: home,
        SAYDO_LOCK_ROLE: "crash-hold",
        SAYDO_LOCK_MARKER: holdMarker,
        SAYDO_LOCK_MODULE: lockModule
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    try {
      const started = Date.now();
      while (!existsSync(holdMarker) && Date.now() - started < 5_000) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      if (!existsSync(holdMarker)) {
        throw new Error(`holder failed:${childFailureDetail(holder)}:${existsSync(`${holdMarker}.error`) ? readFileSync(`${holdMarker}.error`, "utf8") : "no-error-file"}`);
      }
      const waiter = spawnOwned(process.execPath, ["--import", tsx, worker], {
        env: {
          ...process.env,
          SAYDO_LOCK_HOME: home,
          SAYDO_LOCK_ROLE: "wait",
          SAYDO_LOCK_MARKER: marker,
          SAYDO_LOCK_MODULE: lockModule
        },
        stdio: "ignore"
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(existsSync(marker)).toBe(false);
      expect(childHasExited(holder), `holder:${childFailureDetail(holder)}`).toBe(false);
      holder.kill("SIGKILL");
      const waiterTerm = await waitChildTerminated(waiter, 8_000, () => new Error("waiter lock timeout"));
      expect(waiterTerm.exitCode, `waiter:${childFailureDetail(waiter)}:marker-error:${existsSync(`${marker}.error`) ? readFileSync(`${marker}.error`, "utf8") : "absent"}`).toBe(0);
      expect(readFileSync(marker, "utf8")).toBe("acquired");
    } finally {
      await disposeOwned();
    }
  }, 15_000);

  it("本测试子进程与 mkdtemp：先退出再删除，已 signal 退出按双条件收口", async () => {
    const tsx = new URL("../../daemon/node_modules/tsx/dist/loader.mjs", import.meta.url).href;
    const worker = fileURLToPath(new URL("./fixtures/home-lock-worker.mjs", import.meta.url));
    const lockModule = fileURLToPath(new URL("../src/homeLock.ts", import.meta.url));
    const held = createOwnedHome("saydo-lock-cleanup-");
    const holdMarker = join(held, "holding.marker");
    const holder = spawnOwned(process.execPath, ["--import", tsx, worker], {
      env: {
        ...process.env,
        SAYDO_LOCK_HOME: held,
        SAYDO_LOCK_ROLE: "crash-hold",
        SAYDO_LOCK_MARKER: holdMarker,
        SAYDO_LOCK_MODULE: lockModule
      },
      stdio: "ignore"
    });
    const holderPid = holder.pid;
    const started = Date.now();
    while (!existsSync(holdMarker) && Date.now() - started < 5_000) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(existsSync(holdMarker)).toBe(true);
    expect(typeof holderPid).toBe("number");
    await disposeOwned();
    expect(existsSync(held)).toBe(false);
    expect(childHasExited(holder)).toBe(true);
    expect(() => process.kill(holderPid as number, 0)).toThrow();

    const signaled = createOwnedHome("saydo-lock-cleanup-sig-");
    const signaledChild = spawnOwned(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      stdio: "ignore"
    });
    signaledChild.kill("SIGKILL");
    await disposeOwned();
    expect(existsSync(signaled)).toBe(false);
    expect(childHasExited(signaledChild)).toBe(true);
    expect(signaledChild.exitCode !== null || signaledChild.signalCode !== null).toBe(true);
  }, 15_000);
});
