import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  HOME_OWNER_LOCK_FAILED,
  HOME_OWNER_LOCK_TIMEOUT,
  withHomeOwnerBoundary,
  withHomeOwnerBoundarySync
} from "../src/homeLock.js";
import { commitOwnerReapIfIdentity, formatSayDoJobName, runtimeOwnerIdentity, parseAnyRuntimeOwnerRecord } from "../src/jobIdentity.js";

const homes: string[] = [];

afterEach(() => {
  for (const home of homes) {
    try {
      // 测试目录由 OS 回收即可
      void home;
    } catch {
      // ignore
    }
  }
  homes.length = 0;
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
    const home = mkdtempSync(join(tmpdir(), "saydo-lock-"));
    homes.push(home);
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
    const home = mkdtempSync(join(tmpdir(), "saydo-lock-to-"));
    homes.push(home);
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
    const home = mkdtempSync(join(tmpdir(), "saydo-cas-"));
    homes.push(home);
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
    const home = mkdtempSync(join(tmpdir(), "saydo-cas-sync-"));
    homes.push(home);
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
    const home = mkdtempSync(join(tmpdir(), "saydo-lock-sync-"));
    homes.push(home);
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
    const home = mkdtempSync(join(tmpdir(), "saydo-lock-biz-"));
    homes.push(home);
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
    const home = mkdtempSync(join(tmpdir(), "saydo-lock-sync-proc-"));
    homes.push(home);
    const marker = join(home, "acquired.marker");
    const holdMarker = join(home, "holding.marker");
    const tsx = fileURLToPath(new URL("../../daemon/node_modules/tsx/dist/cli.mjs", import.meta.url));
    const worker = fileURLToPath(new URL("./fixtures/home-lock-worker.mjs", import.meta.url));
    const lockModule = fileURLToPath(new URL("../src/homeLock.ts", import.meta.url));
    const holder = spawn(process.execPath, [tsx, worker], {
      env: {
        ...process.env,
        SAYDO_LOCK_HOME: home,
        SAYDO_LOCK_ROLE: "crash-hold",
        SAYDO_LOCK_MARKER: holdMarker,
        SAYDO_LOCK_MODULE: lockModule
      },
      stdio: "ignore"
    });
    const started = Date.now();
    while (!existsSync(holdMarker) && Date.now() - started < 5_000) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(existsSync(holdMarker)).toBe(true);
    const waiter = spawn(process.execPath, [tsx, worker], {
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
    holder.kill("SIGKILL");
    await new Promise<void>((resolve) => {
      if (holder.exitCode !== null) resolve();
      else holder.once("exit", () => resolve());
    });
    const waiterExit = await new Promise<number>((resolve, reject) => {
      waiter.once("exit", (code) => resolve(code ?? 1));
      setTimeout(() => reject(new Error(`sync waiter lock timeout:${existsSync(`${marker}.error`) ? readFileSync(`${marker}.error`, "utf8") : "no-error"}`)), 8_000);
    });
    if (waiterExit !== 0) {
      throw new Error(`waiter exit ${String(waiterExit)}:${existsSync(`${marker}.error`) ? readFileSync(`${marker}.error`, "utf8") : "no-error"}`);
    }
    expect(readFileSync(marker, "utf8")).toBe("acquired");
  }, 15_000);

  it("独立 Node 进程：持锁时另一进程等待，崩溃后锁自动释放", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-lock-proc-"));
    homes.push(home);
    const marker = join(home, "acquired.marker");
    const holdMarker = join(home, "holding.marker");
    const tsx = fileURLToPath(new URL("../../daemon/node_modules/tsx/dist/cli.mjs", import.meta.url));
    const worker = fileURLToPath(new URL("./fixtures/home-lock-worker.mjs", import.meta.url));
    const lockModule = fileURLToPath(new URL("../src/homeLock.ts", import.meta.url));
    const holderOut: Buffer[] = [];
    const holder = spawn(process.execPath, [tsx, worker], {
      env: {
        ...process.env,
        SAYDO_LOCK_HOME: home,
        SAYDO_LOCK_ROLE: "crash-hold",
        SAYDO_LOCK_MARKER: holdMarker,
        SAYDO_LOCK_MODULE: lockModule
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    holder.stdout?.on("data", (c: Buffer) => holderOut.push(c));
    holder.stderr?.on("data", (c: Buffer) => holderOut.push(c));
    holder.once("exit", (code, signal) => {
      holderOut.push(Buffer.from(`exit:${String(code)}:${String(signal)}`));
    });
    const started = Date.now();
    while (!existsSync(holdMarker) && Date.now() - started < 5_000) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    if (!existsSync(holdMarker)) {
      throw new Error(`holder failed:${Buffer.concat(holderOut).toString("utf8") || "no output"}:${existsSync(`${holdMarker}.error`) ? readFileSync(`${holdMarker}.error`, "utf8") : "no-error-file"}`);
    }
    const waiter = spawn(process.execPath, [tsx, worker], {
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
    holder.kill("SIGKILL");
    const waiterExit = await new Promise<number>((resolve, reject) => {
      waiter.once("exit", (code) => resolve(code ?? 1));
      setTimeout(() => reject(new Error("waiter lock timeout")), 8_000);
    });
    expect(waiterExit).toBe(0);
    expect(readFileSync(marker, "utf8")).toBe("acquired");
  }, 15_000);
});
