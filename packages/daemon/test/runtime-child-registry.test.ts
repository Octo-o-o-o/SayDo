import { execFileSync, spawn } from "node:child_process";
import { EventEmitter, once } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { commitOwnerReapIfIdentity, formatSayDoJobName, HOME_OWNER_LOCK_TIMEOUT, processAlive, setKillOwnedTreeTestHooks, withHomeOwnerBoundary, type OwnedWindowsProcess } from "@saydo/platform";
import {
  contaminateSharedLifecycle,
  isProcessGroupLifecycleError,
  lifecycleFailureLeaves,
  OPAQUE_ERROR_GRAPH_VALUE,
  ProcessGroupLifecycleError,
  resetSharedLifecycleForTests,
  RuntimeInvocationError
} from "../src/processGroupLifecycle.js";
import {
  contaminateByoaLifecycle,
  getByoaLifecycleContamination,
  resetByoaLifecycleForTests,
  runSpawnTurn
} from "../src/providers/byoa/runner.js";
import {
  assertRuntimeChildExactEmpty,
  assertRuntimeChildShutdownAllowsStopped,
  beginRuntimeChild,
  childFromOwnedWindowsForTests,
  contaminateRuntimeChildLifecycle,
  configureRuntimeChildRegistry,
  execRuntimeChild,
  installRuntimeJobForTests,
  pendingRuntimeChildRollback,
  remainingRuntimeChildOwnerCount,
  recoverPriorGenerationRuntimeOwners,
  remainingRuntimeGenerationCount,
  remainingRuntimeJobCount,
  resetRuntimeChildLifecycleForTests,
  runtimeChildLifecycleError,
  runtimeChildRecordPath,
  runtimeChildWrapperSource,
  runtimeGenerationIsCurrent,
  runtimeGenerationRegistered,
  runtimeJobPidsForTests,
  runtimeJobRegistered,
  runtimeProcessGroupState,
  setRuntimeChildTestHooks,
  shouldIgnoreTerminatingPipeError,
  signalRuntimeChildGeneration,
  signalRuntimeChildTree,
  spawnRuntimeChild,
  type SpawnedRuntimeChild
} from "../src/runtimeChildRegistry.js";

const homes = new Set<string>();
const GEN = "01234567-89ab-cdef-0123-456789abcdef";
const GEN_B = "01234567-89ab-cdef-0123-456789abcde0";

function completeRuntimeOwner(rec: Record<string, unknown>): Record<string, unknown> {
  const ownerInstanceId = String(rec.ownerInstanceId ?? "owner");
  const runId = String(rec.runId ?? "run");
  const generation = String(rec.generation ?? GEN);
  const merged: Record<string, unknown> = {
    version: 1,
    kind: "exec",
    binary: process.execPath,
    ownerPid: 2,
    ownerInstanceId,
    runId,
    commandToken: `saydo-child-${generation}`,
    generation,
    ...rec
  };
  if (merged.jobName === undefined) {
    merged.jobName = formatSayDoJobName(
      "Local",
      String(merged.ownerInstanceId),
      String(merged.runId),
      String(merged.generation)
    );
  }
  return merged;
}

function reapPid(pid: number): void {
  try {
    if (process.platform === "win32") process.kill(pid, "SIGKILL");
    else process.kill(-pid, "SIGKILL");
  } catch { /* 已退出 */ }
  try { process.kill(pid, "SIGKILL"); } catch { /* 已退出 */ }
}

afterEach(() => {
  for (const pid of runtimeJobPidsForTests()) reapPid(pid);
  setKillOwnedTreeTestHooks(null);
  setRuntimeChildTestHooks(null);
  try {
    resetRuntimeChildLifecycleForTests();
  } finally {
    resetByoaLifecycleForTests();
    resetSharedLifecycleForTests();
    for (const home of homes) rmSync(home, { recursive: true, force: true });
    homes.clear();
  }
});

function harvestRuntimeLeak(): void {
  expect(() => resetRuntimeChildLifecycleForTests()).toThrow(/test reset observed leak/u);
}

function home(): string {
  const path = mkdtempSync(join(tmpdir(), "saydo-runtime-child-"));
  homes.add(path);
  configureRuntimeChildRegistry(path);
  return path;
}

function runtimeWrapperChildren(): number[] {
  if (process.platform === "win32") return [];
  try {
    // 只统计本测试 worker 的直接子进程，避免并发 suite 的其它 saydo-child 污染断言。
    const raw = execFileSync("pgrep", ["-P", String(process.pid), "-lf", "saydo-child-"], { encoding: "utf8" });
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => Number(line.split(/\s+/u)[0]))
      .filter((pid) => Number.isInteger(pid) && pid > 1);
  } catch {
    return [];
  }
}

describe("runtime child durable ownership", () => {
  it("pipe close 噪声：EOF/EBADF 恒忽略，UNKNOWN 仅收口期，EPIPE 永不忽略", () => {
    expect(shouldIgnoreTerminatingPipeError("EOF", false)).toBe(true);
    expect(shouldIgnoreTerminatingPipeError("EOF", true)).toBe(true);
    expect(shouldIgnoreTerminatingPipeError("EBADF", false)).toBe(true);
    expect(shouldIgnoreTerminatingPipeError("EBADF", true)).toBe(true);
    expect(shouldIgnoreTerminatingPipeError("ECONNRESET", true)).toBe(true);
    expect(shouldIgnoreTerminatingPipeError("ECONNRESET", false)).toBe(false);
    expect(shouldIgnoreTerminatingPipeError("UNKNOWN", true)).toBe(true);
    expect(shouldIgnoreTerminatingPipeError("UNKNOWN", false)).toBe(false);
    expect(shouldIgnoreTerminatingPipeError("ERR_STREAM_DESTROYED", true)).toBe(true);
    expect(shouldIgnoreTerminatingPipeError("ERR_STREAM_DESTROYED", false)).toBe(false);
    expect(shouldIgnoreTerminatingPipeError("EPIPE", true)).toBe(false);
    expect(shouldIgnoreTerminatingPipeError("EPIPE", false)).toBe(false);
    expect(shouldIgnoreTerminatingPipeError("EIO", true)).toBe(false);
    expect(shouldIgnoreTerminatingPipeError(undefined, true)).toBe(false);
  });

  it("registry 根损坏时在 spawn 前拒绝且不遗留 wrapper", async () => {
    const root = home();
    const marker = join(root, "target-started");
    writeFileSync(join(root, "runtime"), "not-a-directory");
    const before = runtimeWrapperChildren();

    expect(() => spawnRuntimeChild(
      process.execPath,
      ["-e", "require('node:fs').writeFileSync(process.argv[1], 'started')", marker],
      { stdin: "ignore", stdout: "ignore", stderr: "ignore" },
      "test"
    )).toThrow();

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(existsSync(marker)).toBe(false);
    expect(runtimeWrapperChildren()).toEqual(before);
  });

  it("短命 managed command 不把 wrapper 自己的 ps 探针误认作后代", async () => {
    home();
    const startedAt = Date.now();
    await expect(execRuntimeChild(process.platform === "win32" ? "git" : "/usr/bin/git", ["--version"])).resolves.toMatchObject({
      stdout: expect.stringContaining("git version")
    });
    expect(Date.now() - startedAt).toBeLessThan(2000);
  });

  it("durable birth owner 建立前不执行目标进程", async () => {
    const root = home();
    const marker = join(root, "target-started");
    const spawned = spawnRuntimeChild(
      process.execPath,
      [
        "-e",
        "const fs=require('node:fs'),p=require('node:path');const root=process.argv[1],marker=process.argv[2];const name=fs.readdirSync(p.join(root,'runtime','children'))[0];const owner=JSON.parse(fs.readFileSync(p.join(root,'runtime','children',name),'utf8'));fs.writeFileSync(marker,String(owner.processStart))",
        root,
        marker
      ],
      { stdin: "ignore", stdout: "ignore", stderr: "ignore" },
      "test"
    );
    await once(spawned.child, "spawn");
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(existsSync(marker)).toBe(false);

    await spawned.lease.establish();
    await once(spawned.child, "close");
    await spawned.lease.release();
    expect(readFileSync(marker, "utf8")).not.toBe("null");
  });

  it("ignore stdio 与 permit 在目标启动前已消费 pipe 错误，退出码仍是权威结果", async () => {
    home();
    const spawned = spawnRuntimeChild(
      process.execPath,
      ["-e", "process.exit(0)"],
      { stdin: "ignore", stdout: "ignore", stderr: "ignore" },
      "test"
    );
    await once(spawned.child, "spawn");
    const permit = spawned.child.stdio[3];
    if (!permit) throw new Error("wrapper permit pipe 缺失");
    expect(spawned.child.stdin.listenerCount("error")).toBeGreaterThan(0);
    expect(spawned.child.stdout.listenerCount("error")).toBeGreaterThan(0);
    expect(spawned.child.stderr.listenerCount("error")).toBeGreaterThan(0);
    expect(permit.listenerCount("error")).toBeGreaterThan(0);

    const reset = Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
    expect(() => spawned.child.stdin.emit("error", reset)).not.toThrow();
    expect(() => spawned.child.stdout.emit("error", reset)).not.toThrow();
    expect(() => spawned.child.stderr.emit("error", reset)).not.toThrow();
    expect(() => permit.emit("error", reset)).not.toThrow();

    await spawned.lease.establish();
    const [code] = await once(spawned.child, "close");
    await spawned.lease.release();
    expect(code).toBe(0);
  });

  it("daemon 在 permit 前硬退时 wrapper 收口且目标未执行", async () => {
    const root = home();
    const marker = join(root, "target-started");
    const spawned = spawnRuntimeChild(
      process.execPath,
      ["-e", "require('node:fs').writeFileSync(process.argv[1], 'started')", marker],
      { stdin: "ignore", stdout: "ignore", stderr: "ignore" },
      "test"
    );
    await once(spawned.child, "spawn");
    if (!spawned.child.pid) throw new Error("wrapper 未获得 pid");
    spawned.signal?.("SIGKILL");
    await once(spawned.child, "close");
    await spawned.lease.release();
    expect(existsSync(marker)).toBe(false);
    expect(processAlive(spawned.child.pid)).toBe(false);
  });

  it("目标退出后 wrapper 先回收同组孙进程再退出", async () => {
    const root = home();
    const marker = join(root, "grandchild.pid");
    const spawned = spawnRuntimeChild(
      process.execPath,
      [
        "-e",
        "const {spawn}=require('node:child_process'),fs=require('node:fs');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});fs.writeFileSync(process.argv[1],String(c.pid));c.unref();process.exit(0)",
        marker
      ],
      { stdin: "ignore", stdout: "ignore", stderr: "ignore" },
      "test"
    );
    await once(spawned.child, "spawn");
    await spawned.lease.establish();
    await once(spawned.child, "close");
    await spawned.lease.release();
    const grandchildPid = Number(readFileSync(marker, "utf8"));
    try {
      expect(() => process.kill(grandchildPid, 0)).toThrow();
      expect(processAlive(spawned.child.pid!)).toBe(false);
    } finally {
      reapPid(grandchildPid);
      if (spawned.child.pid) reapPid(spawned.child.pid);
    }
  });

  it("后代 argv 伪装 ps 探针片段也不能逃逸收口", async () => {
    const root = home();
    const marker = join(root, "sentinel-grandchild.pid");
    const sentinel = " -ax -o pid= -o pgid= -o command=";
    const spawned = spawnRuntimeChild(
      process.execPath,
      [
        "-e",
        "const {spawn}=require('node:child_process'),fs=require('node:fs');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)',process.argv[2]],{stdio:'ignore'});fs.writeFileSync(process.argv[1],String(c.pid));c.unref();process.exit(0)",
        marker,
        sentinel
      ],
      { stdin: "ignore", stdout: "ignore", stderr: "ignore" },
      "test"
    );
    await once(spawned.child, "spawn");
    await spawned.lease.establish();
    await once(spawned.child, "close");
    await spawned.lease.release();
    const grandchildPid = Number(readFileSync(marker, "utf8"));
    try {
      expect(() => process.kill(grandchildPid, 0)).toThrow();
    } finally {
      reapPid(grandchildPid);
      if (spawned.child.pid) reapPid(spawned.child.pid);
    }
  });

  it("后代 process.title 精确伪装 ps 探针也不能逃逸收口", async () => {
    const root = home();
    const marker = join(root, "title-grandchild.pid");
    const title = "/bin/ps -ax -o pid= -o pgid= -o command=";
    const spawned = spawnRuntimeChild(
      process.execPath,
      [
        "-e",
        "const {spawn}=require('node:child_process'),fs=require('node:fs');const c=spawn(process.execPath,['-e','process.title=process.argv[1];setInterval(()=>{},1000)',process.argv[2]],{stdio:'ignore'});fs.writeFileSync(process.argv[1],String(c.pid));c.unref();process.exit(0)",
        marker,
        title
      ],
      { stdin: "ignore", stdout: "ignore", stderr: "ignore" },
      "test"
    );
    await once(spawned.child, "spawn");
    await spawned.lease.establish();
    await once(spawned.child, "close");
    await spawned.lease.release();
    const grandchildPid = Number(readFileSync(marker, "utf8"));
    try {
      expect(() => process.kill(grandchildPid, 0)).toThrow();
    } finally {
      reapPid(grandchildPid);
      if (spawned.child.pid) reapPid(spawned.child.pid);
    }
  });
});

describe("execRuntimeChild exit-to-close 窗口", () => {
  function pipeErr(code: string): NodeJS.ErrnoException {
    return Object.assign(new Error(code), { code });
  }

  function fakeSpawned(pid = 424201): SpawnedRuntimeChild {
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const stdin = new PassThrough();
    const child = new EventEmitter() as SpawnedRuntimeChild["child"];
    child.stdout = stdout;
    child.stderr = stderr;
    child.stdin = stdin;
    Object.defineProperty(child, "pid", { value: pid });
    child.kill = () => true;
    queueMicrotask(() => child.emit("spawn"));
    return {
      child,
      commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcdef",
      generation: "01234567-89ab-cdef-0123-456789abcdef",
      signal: () => undefined,
      lease: { establish: async () => undefined, release: async () => undefined }
    };
  }

  it("exit -> ECONNRESET -> close 成功", async () => {
    const spawned = fakeSpawned();
    setRuntimeChildTestHooks({
      spawn: () => spawned,
      groupState: () => "gone"
    });
    const pending = execRuntimeChild("git", ["--version"]);
    await once(spawned.child, "spawn");
    spawned.child.emit("exit", 0, null);
    spawned.child.stdout.emit("error", pipeErr("ECONNRESET"));
    spawned.child.emit("close", 0, null);
    await expect(pending).resolves.toMatchObject({ stdout: "", stderr: "" });
  });

  it("exit -> EPIPE -> close 失败", async () => {
    const spawned = fakeSpawned();
    setRuntimeChildTestHooks({
      spawn: () => spawned,
      groupState: () => "gone"
    });
    const pending = execRuntimeChild("git", ["--version"]);
    await once(spawned.child, "spawn");
    spawned.child.emit("exit", 0, null);
    spawned.child.stdout.emit("error", pipeErr("EPIPE"));
    spawned.child.emit("close", 0, null);
    await expect(pending).rejects.toThrow(/stdout pipe failed:EPIPE/u);
  });

  it("exit -> EOF -> close 成功", async () => {
    const spawned = fakeSpawned();
    setRuntimeChildTestHooks({
      spawn: () => spawned,
      groupState: () => "gone"
    });
    const pending = execRuntimeChild("git", ["--version"]);
    await once(spawned.child, "spawn");
    spawned.child.emit("exit", 0, null);
    spawned.child.stdout.emit("error", pipeErr("EOF"));
    spawned.child.stderr.emit("error", pipeErr("EOF"));
    spawned.child.emit("close", 0, null);
    await expect(pending).resolves.toMatchObject({ stdout: "", stderr: "" });
  });

  it("活动期 EOF 视为 write-end close，成功", async () => {
    const spawned = fakeSpawned();
    setRuntimeChildTestHooks({
      spawn: () => spawned,
      groupState: () => "gone"
    });
    const pending = execRuntimeChild("git", ["--version"]);
    await once(spawned.child, "spawn");
    spawned.child.stdout.emit("error", pipeErr("EOF"));
    spawned.child.emit("exit", 0, null);
    spawned.child.emit("close", 0, null);
    await expect(pending).resolves.toMatchObject({ stdout: "", stderr: "" });
  });

  it("exit -> EBADF -> close 成功", async () => {
    const spawned = fakeSpawned();
    setRuntimeChildTestHooks({
      spawn: () => spawned,
      groupState: () => "gone"
    });
    const pending = execRuntimeChild("git", ["--version"]);
    await once(spawned.child, "spawn");
    spawned.child.emit("exit", 0, null);
    spawned.child.stdout.emit("error", pipeErr("EBADF"));
    spawned.child.emit("close", 0, null);
    await expect(pending).resolves.toMatchObject({ stdout: "", stderr: "" });
  });

  it("exit -> UNKNOWN -> close 成功", async () => {
    const spawned = fakeSpawned();
    setRuntimeChildTestHooks({
      spawn: () => spawned,
      groupState: () => "gone"
    });
    const pending = execRuntimeChild("git", ["--version"]);
    await once(spawned.child, "spawn");
    spawned.child.emit("exit", 0, null);
    spawned.child.stdout.emit("error", pipeErr("UNKNOWN"));
    spawned.child.emit("close", 0, null);
    await expect(pending).resolves.toMatchObject({ stdout: "", stderr: "" });
  });

  it("活动期 UNKNOWN 失败", async () => {
    const spawned = fakeSpawned();
    setRuntimeChildTestHooks({
      spawn: () => spawned,
      groupState: () => "gone"
    });
    const pending = execRuntimeChild("git", ["--version"]);
    await once(spawned.child, "spawn");
    spawned.child.stdout.emit("error", pipeErr("UNKNOWN"));
    spawned.child.emit("exit", 0, null);
    spawned.child.emit("close", 0, null);
    await expect(pending).rejects.toThrow(/stdout pipe failed:UNKNOWN/u);
  });

  it("活动期 ECONNRESET 失败", async () => {
    const spawned = fakeSpawned();
    setRuntimeChildTestHooks({
      spawn: () => spawned,
      groupState: () => "gone"
    });
    const pending = execRuntimeChild("git", ["--version"]);
    await once(spawned.child, "spawn");
    spawned.child.stdout.emit("error", pipeErr("ECONNRESET"));
    spawned.child.emit("exit", 0, null);
    spawned.child.emit("close", 0, null);
    await expect(pending).rejects.toThrow(/stdout pipe failed:ECONNRESET/u);
  });

  it("pipe listener 消费 projection：hostile/primitive/Proxy/null 不抛不泄漏", async () => {
    const spawned = fakeSpawned(424209);
    setRuntimeChildTestHooks({
      spawn: () => spawned,
      groupState: () => "gone"
    });
    const pending = execRuntimeChild("git", ["--version"]);
    await once(spawned.child, "spawn");
    const traps = {
      get: 0,
      getOwnPropertyDescriptor: 0,
      ownKeys: 0,
      getPrototypeOf: 0
    };
    const proxy = new Proxy(Object.assign(new Error("read EIO"), { code: "EIO" }), {
      get(t, p, r) {
        traps.get += 1;
        return Reflect.get(t, p, r);
      },
      getOwnPropertyDescriptor(t, p) {
        traps.getOwnPropertyDescriptor += 1;
        return Reflect.getOwnPropertyDescriptor(t, p);
      },
      ownKeys(t) {
        traps.ownKeys += 1;
        return Reflect.ownKeys(t);
      },
      getPrototypeOf(t) {
        traps.getPrototypeOf += 1;
        return Reflect.getPrototypeOf(t);
      }
    });
    const secretObj = { code: "SECRET", message: "SECRET" };
    let accessorGets = 0;
    const accessor = new Error("init");
    Object.defineProperty(accessor, "code", {
      get(): string {
        accessorGets += 1;
        return "SECRET";
      }
    });
    Object.defineProperty(accessor, "message", {
      get(): string {
        accessorGets += 1;
        return "SECRET";
      }
    });
    const fn = function hostilePipe(): string {
      return "SECRET";
    };
    const revoked = Proxy.revocable(Object.assign(new Error("read EIO"), { code: "EIO" }), {
      get() {
        traps.get += 1;
        throw new Error("revoked get");
      }
    });
    revoked.revoke();
    const uncaught: unknown[] = [];
    const rejections: unknown[] = [];
    const onUncaught = (err: unknown): void => {
      uncaught.push(err);
    };
    const onReject = (reason: unknown): void => {
      rejections.push(reason);
    };
    process.on("uncaughtException", onUncaught);
    process.on("unhandledRejection", onReject);
    try {
      expect(() => {
        spawned.child.stdout.emit("error", secretObj);
        spawned.child.stdout.emit("error", accessor);
        spawned.child.stderr.emit("error", fn);
        spawned.child.stdout.emit("error", 42);
        spawned.child.stderr.emit("error", null);
        spawned.child.stdout.emit("error", undefined);
        spawned.child.stderr.emit("error", proxy);
        spawned.child.stdout.emit("error", revoked.proxy);
      }).not.toThrow();
      spawned.child.emit("exit", 0, null);
      spawned.child.emit("close", 0, null);
      const err = await pending.then(
        (value) => {
          throw new Error(`expected reject, got ${JSON.stringify(value)}`);
        },
        (reason: unknown) => reason
      );
      expect(String((err as Error).message)).toMatch(/stdout pipe failed:unknown/u);
      expect(JSON.stringify(lifecycleFailureLeaves(err).map((item) => item.message))).not.toContain("SECRET");
      expect((err as Error).message).not.toContain("SECRET");
      expect((err as Error).stack ?? "").not.toContain("SECRET");
      expect(accessorGets).toBe(0);
      expect(traps.get + traps.getOwnPropertyDescriptor + traps.ownKeys + traps.getPrototypeOf).toBe(0);
      await new Promise((resolve) => setImmediate(resolve));
      expect(uncaught).toEqual([]);
      expect(rejections).toEqual([]);
    } finally {
      process.off("uncaughtException", onUncaught);
      process.off("unhandledRejection", onReject);
    }
  });

  it("own-data EIO Error(SECRET) 最终 message/stack 不含 SECRET", async () => {
    const spawned = fakeSpawned(424210);
    setRuntimeChildTestHooks({
      spawn: () => spawned,
      groupState: () => "gone"
    });
    const pending = execRuntimeChild("git", ["--version"]);
    await once(spawned.child, "spawn");
    const secret = Object.assign(new Error("SECRET"), { code: "EIO" });
    spawned.child.stdout.emit("error", secret);
    spawned.child.emit("exit", 0, null);
    spawned.child.emit("close", 0, null);
    const err = await pending.then(
      (value) => {
        throw new Error(`expected reject, got ${JSON.stringify(value)}`);
      },
      (reason: unknown) => reason
    );
    expect(err).toBeInstanceOf(RuntimeInvocationError);
    expect((err as Error).message).toBe("stdout pipe failed:EIO");
    expect((err as Error).message).not.toContain("SECRET");
    expect((err as Error).stack ?? "").not.toContain("SECRET");
    expect(Object.is(err, secret)).toBe(false);
  });

  it("两个 distinct pipe failure 按 first-seen 全留，同 identity 只一次", async () => {
    const spawned = fakeSpawned(424211);
    setRuntimeChildTestHooks({
      spawn: () => spawned,
      groupState: () => "gone"
    });
    const pending = execRuntimeChild("git", ["--version"]);
    await once(spawned.child, "spawn");
    const first = Object.assign(new Error("SECRET"), { code: "EIO" });
    const second = Object.assign(new Error("SECRET"), { code: "EIO" });
    spawned.child.stdout.emit("error", first);
    spawned.child.stdout.emit("error", first);
    spawned.child.stderr.emit("error", second);
    const revoked = Proxy.revocable(Object.assign(new Error("SECRET"), { code: "EPIPE" }), {});
    revoked.revoke();
    spawned.child.stderr.emit("error", revoked.proxy);
    spawned.child.emit("exit", 0, null);
    spawned.child.emit("close", 0, null);
    const err = await pending.then(
      (value) => {
        throw new Error(`expected reject, got ${JSON.stringify(value)}`);
      },
      (reason: unknown) => reason
    );
    const leaves = lifecycleFailureLeaves(err);
    expect(leaves.map((item) => item.message)).toEqual([
      "stdout pipe failed:EIO",
      "stderr pipe failed:EIO",
      "stderr pipe failed:unknown"
    ]);
    expect(leaves[0]).toBeInstanceOf(RuntimeInvocationError);
    expect(leaves[1]).toBeInstanceOf(RuntimeInvocationError);
    expect(leaves[0]).not.toBe(leaves[1]);
    expect(JSON.stringify(leaves.map((item) => item.message))).not.toContain("SECRET");
    expect(leaves.every((item) => !(item.stack ?? "").includes("SECRET"))).toBe(true);
  });
});

describe("Windows spawn/job 边界", () => {
  it("assignPidToJob 失败时消费 pipe、杀掉 wrapper、关闭 job 且无 owner", async () => {
    const root = home();
    let closed = 0;
    const before = runtimeWrapperChildren();
    setRuntimeChildTestHooks({
      hostKind: () => "win32",
      createNamedJob: () => ({ name: "job", handle: 1 }),
      assignPidToJob: () => {
        throw new ProcessGroupLifecycleError("assign fail");
      },
      closeNamedJob: () => {
        closed += 1;
      }
    });
    expect(() =>
      spawnRuntimeChild(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
        stdin: "ignore",
        stdout: "ignore",
        stderr: "ignore"
      }, "test")
    ).toThrow(/assign fail/u);
    await pendingRuntimeChildRollback();
    expect(closed).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(runtimeWrapperChildren()).toEqual(before);
    expect(existsSync(join(root, "runtime", "children"))).toBe(true);
    expect((() => {
      try {
        return readFileSync(join(root, "runtime", "children"), "utf8");
      } catch {
        return "dir";
      }
    })()).toBe("dir");
  });

  it("processAlive 抛非 EPERM 时 group state 为 unknown", () => {
    setRuntimeChildTestHooks({
      hostKind: () => "win32",
      processAlive: () => {
        throw new Error("probe exploded");
      }
    });
    expect(runtimeProcessGroupState(9)).toBe("unknown");
  });

  it("processAlive EPERM 仍视为 alive", () => {
    setRuntimeChildTestHooks({
      hostKind: () => "win32",
      processAlive: () => {
        const err = new Error("denied") as NodeJS.ErrnoException;
        err.code = "EPERM";
        throw err;
      }
    });
    expect(runtimeProcessGroupState(9)).toBe("alive");
  });

  it("group 非 gone 时 release 保留 durable owner", async () => {
    const root = home();
    const lease = beginRuntimeChild(4242, process.execPath, "test", { registryHome: root, runId: "run-4242", commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcdef", generation: "01234567-89ab-cdef-0123-456789abcdef" });
    expect(existsSync(runtimeChildRecordPath(root, 4242))).toBe(true);
    setRuntimeChildTestHooks({ groupState: () => "alive" });
    await lease.release();
    expect(existsSync(runtimeChildRecordPath(root, 4242))).toBe(true);
  });

  it("wrapper 已退但 Job 仍有活动进程时视为 alive", async () => {
    home();
    setRuntimeChildTestHooks({
      hostKind: () => "win32",
      createNamedJob: () => ({ name: "job-active", handle: 1 }),
      assignPidToJob: () => undefined,
      closeNamedJob: () => undefined,
      terminateNamedJob: () => undefined,
      namedJobActiveCount: () => 2,
      processAlive: () => false,
      drainDeadlineMs: 0
    });
    const spawned = spawnRuntimeChild(process.execPath, ["-e", "process.exit(0)"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore"
    }, "test");
    expect(spawned.child.pid).toBeGreaterThan(1);
    expect(runtimeProcessGroupState(spawned.child.pid!)).toBe("alive");
    spawned.child.kill("SIGKILL");
    await once(spawned.child, "close").catch(() => undefined);
    await expect(spawned.lease.release()).rejects.toThrow(/process group did not exit/u);
    expect(runtimeProcessGroupState(spawned.child.pid!)).toBe("alive");
    harvestRuntimeLeak();
  });

  it.skipIf(process.platform !== "win32")("Windows 真实 Job 孙进程在命令返回时不可存活", async () => {
    const root = home();
    const marker = join(root, "win-grandchild.pid");
    const spawned = spawnRuntimeChild(
      process.execPath,
      [
        "-e",
        "const {spawn}=require('node:child_process'),fs=require('node:fs');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});fs.writeFileSync(process.argv[1],String(c.pid));c.unref();process.exit(0)",
        marker
      ],
      { stdin: "ignore", stdout: "ignore", stderr: "ignore" },
      "test"
    );
    await once(spawned.child, "spawn");
    await spawned.lease.establish();
    await once(spawned.child, "close");
    await spawned.lease.release();
    const grandchildPid = Number(readFileSync(marker, "utf8"));
    try {
      expect(processAlive(grandchildPid)).toBe(false);
      expect(processAlive(spawned.child.pid!)).toBe(false);
    } finally {
      reapPid(grandchildPid);
      if (spawned.child.pid) reapPid(spawned.child.pid);
    }
  });

  it("native probe 异常时 release 保留 owner", async () => {
    const root = home();
    const lease = beginRuntimeChild(4243, process.execPath, "test", { registryHome: root, runId: "run-4243", commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcdef", generation: "01234567-89ab-cdef-0123-456789abcdef" });
    setRuntimeChildTestHooks({
      groupState: () => {
        throw new Error("native");
      }
    });
    await expect(lease.release()).resolves.toBeUndefined();
    expect(existsSync(runtimeChildRecordPath(root, 4243))).toBe(true);
  });

  it("SIGKILL 终止 Job 但不先 close/delete mapping", () => {
    home();
    // 只统计 mock 调用次数无法证明契约:本例要验的是「terminate 时 mapping 必须仍在」,
    // 所以记录每次调用**当时**的 mapping 实况与先后顺序,而不是事后各数一遍。
    const trace: string[] = [];
    let observedPid = 0;
    setRuntimeChildTestHooks({
      hostKind: () => "win32",
      createNamedJob: () => ({ name: "job-k", handle: 1 }),
      assignPidToJob: () => undefined,
      terminateNamedJob: () => {
        trace.push(`terminate:mapping=${String(observedPid !== 0 && runtimeJobRegistered(observedPid))}`);
      },
      closeNamedJob: () => {
        trace.push(`close:mapping=${String(observedPid !== 0 && runtimeJobRegistered(observedPid))}`);
      },
      namedJobActiveCount: () => 1
    });
    const spawned = spawnRuntimeChild(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore"
    }, "test");
    const pid = spawned.child.pid!;
    observedPid = pid;
    try {
      signalRuntimeChildTree(pid, "SIGKILL");
      // 恰好一次 terminate，且发生时 mapping 仍在；全程不得 close。
      expect(trace).toEqual(["terminate:mapping=true"]);
      expect(runtimeJobRegistered(pid)).toBe(true);
    } finally {
      try { spawned.child.kill("SIGKILL"); } catch { /* 收口 */ }
    }
    harvestRuntimeLeak();
  });

  it("signalRuntimeChildTree 在 TerminateJob 失败时抛出、污染且保留 job", () => {
    home();
    setRuntimeChildTestHooks({
      hostKind: () => "win32",
      createNamedJob: () => ({ name: "job-sig-throw", handle: 1 }),
      assignPidToJob: () => undefined,
      terminateNamedJob: () => {
        throw new ProcessGroupLifecycleError("TerminateJobObject failed in signal path");
      },
      closeNamedJob: () => undefined,
      namedJobActiveCount: () => 0
    });
    const spawned = spawnRuntimeChild(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore"
    }, "test");
    const pid = spawned.child.pid!;
    try {
      expect(() => signalRuntimeChildTree(pid, "SIGKILL")).toThrow(/TerminateJobObject failed in signal path/u);
      expect(runtimeChildLifecycleError()).toBeInstanceOf(ProcessGroupLifecycleError);
      expect(runtimeJobRegistered(pid)).toBe(true);
    } finally {
      try { spawned.child.kill("SIGKILL"); } catch { /* 收口 */ }
    }
    harvestRuntimeLeak();
  });

  it("PID reuse 且旧 Job 未 empty 时拒绝新 spawn 并保留旧 Job", async () => {
    home();
    const closed: string[] = [];
    const oldJob = { name: "old-job", handle: 1 };
    setRuntimeChildTestHooks({
      hostKind: () => "win32",
      createNamedJob: () => ({ name: "new-job", handle: 2 }),
      assignPidToJob: () => undefined,
      existingJob: () => oldJob,
      namedJobActiveCount: (job) => (job === oldJob ? 3 : 0),
      closeNamedJob: (job) => {
        closed.push(job.name);
      },
      terminateNamedJob: () => undefined
    });
    expect(() =>
      spawnRuntimeChild(process.execPath, ["-e", "process.exit(0)"], {
        stdin: "ignore",
        stdout: "ignore",
        stderr: "ignore"
      }, "test")
    ).toThrow(/pid reused/u);
    expect(closed).not.toContain("old-job");
    expect(runtimeChildLifecycleError()).toBeInstanceOf(ProcessGroupLifecycleError);
    await pendingRuntimeChildRollback();
    harvestRuntimeLeak();
  });

  it("CloseHandle 失败时保留 mapping 与 owner", async () => {
    const root = home();
    setRuntimeChildTestHooks({
      hostKind: () => "win32",
      createNamedJob: () => ({ name: "job-close", handle: 1 }),
      assignPidToJob: () => undefined,
      namedJobActiveCount: () => 0,
      processAlive: () => false,
      closeNamedJob: () => {
        throw new ProcessGroupLifecycleError("CloseHandle failed");
      }
    });
    const spawned = spawnRuntimeChild(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore"
    }, "test");
    const pid = spawned.child.pid!;
    try {
      spawned.child.kill("SIGKILL");
      await once(spawned.child, "close").catch(() => undefined);
      await expect(spawned.lease.release()).rejects.toThrow(/CloseHandle failed/u);
      expect(runtimeJobRegistered(pid)).toBe(true);
      expect(existsSync(runtimeChildRecordPath(root, pid))).toBe(true);
      expect(runtimeChildLifecycleError()).toBeInstanceOf(ProcessGroupLifecycleError);
    } finally {
      try { spawned.child.kill("SIGKILL"); } catch { /* 已退 */ }
      harvestRuntimeLeak();
    }
  });
});

describe("execRuntimeChild close deadline 与 contamination", () => {
  function virtualClock() {
    let now = 0;
    const timers: { id: number; at: number; fn: () => void }[] = [];
    let seq = 1;
    return {
      hooks: {
        now: () => now,
        setTimeout(fn: () => void, ms: number) {
          const id = seq++;
          timers.push({ id, at: now + ms, fn });
          return { id } as unknown as NodeJS.Timeout;
        },
        clearTimeout(timer: NodeJS.Timeout) {
          const id = (timer as unknown as { id: number }).id;
          const index = timers.findIndex((item) => item.id === id);
          if (index >= 0) timers.splice(index, 1);
        }
      },
      advance(ms: number) {
        now += ms;
        let progressed = true;
        while (progressed) {
          progressed = false;
          for (const timer of [...timers]) {
            if (timer.at > now) continue;
            const i = timers.indexOf(timer);
            if (i < 0) continue;
            timers.splice(i, 1);
            timer.fn();
            progressed = true;
          }
        }
      }
    };
  }

  function fakeSpawned(pid: number, root: string): SpawnedRuntimeChild {
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const stdin = new PassThrough();
    const child = new EventEmitter() as SpawnedRuntimeChild["child"];
    child.stdout = stdout;
    child.stderr = stderr;
    child.stdin = stdin;
    Object.defineProperty(child, "pid", { value: pid });
    child.kill = () => true;
    queueMicrotask(() => child.emit("spawn"));
    const realLease = beginRuntimeChild(pid, process.execPath, "exec", {
      registryHome: root,
      runId: `exec-${String(pid)}`,
      commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcdef",
      generation: "01234567-89ab-cdef-0123-456789abcdef",
      processStart: "fake-birth"
    });
    return {
      child,
      commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcdef",
      generation: "01234567-89ab-cdef-0123-456789abcdef",
      signal: () => undefined,
      lease: { establish: async () => undefined, release: () => realLease.release() }
    };
  }

  async function pump(clock: ReturnType<typeof virtualClock>, pending: Promise<unknown>, steps = 40): Promise<unknown> {
    let settled: unknown;
    let done = false;
    const finished = pending.then(
      (value) => {
        done = true;
        settled = value;
      },
      (err) => {
        done = true;
        settled = err;
      }
    );
    for (let i = 0; i < steps && !done; i++) {
      clock.advance(20);
      await Promise.resolve();
      await Promise.resolve();
    }
    await finished;
    return settled;
  }

  it("exit emitted, close withheld 有界 contamination 并保留 owner", async () => {
    const root = home();
    const clock = virtualClock();
    const spawned = fakeSpawned(61001, root);
    setRuntimeChildTestHooks({
      ...clock.hooks,
      spawn: () => spawned,
      groupState: () => "alive",
      killProcess: () => undefined,
      closeDeadlineMs: 20,
      drainDeadlineMs: 20
    });
    const pending = execRuntimeChild("git", ["--version"]);
    await once(spawned.child, "spawn");
    spawned.child.emit("exit", 0, null);
    const settled = await pump(clock, pending);
    expect(settled).toBeInstanceOf(ProcessGroupLifecycleError);
    expect(runtimeChildLifecycleError()).toBeInstanceOf(ProcessGroupLifecycleError);
    expect(existsSync(runtimeChildRecordPath(root, 61001))).toBe(true);
    expect(() => assertRuntimeChildShutdownAllowsStopped(root)).toThrow(ProcessGroupLifecycleError);
    expect(() => spawnRuntimeChild(process.execPath, ["-e", "process.exit(0)"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore"
    }, "test")).toThrow(ProcessGroupLifecycleError);
    harvestRuntimeLeak();
  });

  it("group unknown drain 污染 lifecycle，业务层失败后仍拒绝新 job", async () => {
    const root = home();
    const clock = virtualClock();
    const spawned = fakeSpawned(61002, root);
    setRuntimeChildTestHooks({
      ...clock.hooks,
      spawn: () => spawned,
      groupState: () => "unknown",
      killProcess: () => undefined,
      drainDeadlineMs: 20
    });
    const pending = execRuntimeChild("git", ["--version"]);
    await once(spawned.child, "spawn");
    spawned.child.emit("exit", 0, null);
    spawned.child.emit("close", 0, null);
    const settled = await pump(clock, pending);
    expect(settled).toBeInstanceOf(ProcessGroupLifecycleError);
    expect(remainingRuntimeChildOwnerCount(root)).toBe(1);
    expect(runtimeChildLifecycleError()).toBeInstanceOf(ProcessGroupLifecycleError);
    harvestRuntimeLeak();
  });

  it("establish birth probe 回拨仍有界拒绝", async () => {
    const root = home();
    let now = 1_000;
    setRuntimeChildTestHooks({
      now: () => now,
      setTimeout(fn) {
        now = 10;
        queueMicrotask(fn);
        return { id: 1 } as unknown as NodeJS.Timeout;
      },
      clearTimeout() {},
      groupState: () => "alive"
    });
    const lease = beginRuntimeChild(62001, process.execPath, "test", { registryHome: root, runId: "run-62001", commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcdef", generation: "01234567-89ab-cdef-0123-456789abcdef" });
    await expect(lease.establish()).rejects.toBeInstanceOf(ProcessGroupLifecycleError);
    expect(existsSync(runtimeChildRecordPath(root, 62001))).toBe(true);
  });

  it("正常 close + group gone 后 registry exact empty", async () => {
    const root = home();
    const spawned = fakeSpawned(61003, root);
    setRuntimeChildTestHooks({
      spawn: () => spawned,
      groupState: () => "gone"
    });
    const pending = execRuntimeChild("git", ["--version"]);
    await once(spawned.child, "spawn");
    spawned.child.emit("exit", 0, null);
    spawned.child.emit("close", 0, null);
    await expect(pending).resolves.toMatchObject({ stdout: "", stderr: "" });
    expect(remainingRuntimeChildOwnerCount(root)).toBe(0);
    expect(() => assertRuntimeChildShutdownAllowsStopped(root)).not.toThrow();
  });

  it("pre-aborted 零 spawn", async () => {
    const root = home();
    let spawned = 0;
    setRuntimeChildTestHooks({
      onSpawn: () => {
        spawned += 1;
      }
    });
    const signal = AbortSignal.abort();
    await expect(execRuntimeChild("git", ["--version"], { signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(spawned).toBe(0);
    expect(remainingRuntimeChildOwnerCount(root)).toBe(0);
  });

  it("active abort 即使 TERM 后 exit 0 也 reject 且 owner exact clean", async () => {
    const root = home();
    const spawned = fakeSpawned(61004, root);
    setRuntimeChildTestHooks({
      spawn: () => spawned,
      groupState: () => "gone",
      killProcess: () => undefined
    });
    const controller = new AbortController();
    const pending = execRuntimeChild("git", ["--version"], { signal: controller.signal });
    await once(spawned.child, "spawn");
    controller.abort();
    spawned.child.emit("exit", 0, null);
    spawned.child.emit("close", 0, null);
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(remainingRuntimeChildOwnerCount(root)).toBe(0);
    expect(() => assertRuntimeChildShutdownAllowsStopped(root)).not.toThrow();
  });

  it("reset hook 后下一测试不受 contamination 影响", () => {
    expect(runtimeChildLifecycleError()).toBeNull();
    expect(() => assertRuntimeChildShutdownAllowsStopped(home())).not.toThrow();
  });

  it("abort 且 child 永不 exit/close 时按单调时钟有界 settle", async () => {
    const root = home();
    const clock = virtualClock();
    const spawned = fakeSpawned(61005, root);
    const frozen = Date.now();
    const realNow = Date.now;
    Date.now = () => frozen;
    try {
      setRuntimeChildTestHooks({
        ...clock.hooks,
        spawn: () => spawned,
        groupState: () => "alive",
        killProcess: () => undefined,
        closeDeadlineMs: 20,
        drainDeadlineMs: 20,
        killGraceMs: 5
      });
      const controller = new AbortController();
      const pending = execRuntimeChild("git", ["--version"], { signal: controller.signal });
      await once(spawned.child, "spawn");
      controller.abort();
      const settled = await pump(clock, pending);
      expect(isProcessGroupLifecycleError(settled)).toBe(true);
      expect(lifecycleFailureLeaves(settled).map((item) => item.message)).toEqual([
        "aborted",
        "runtime child close withheld:61005"
      ]);
      expect(runtimeChildLifecycleError()).toBeInstanceOf(ProcessGroupLifecycleError);
      expect(existsSync(runtimeChildRecordPath(root, 61005))).toBe(true);
      expect(() => spawnRuntimeChild(process.execPath, ["-e", "process.exit(0)"], {
        stdin: "ignore",
        stdout: "ignore",
        stderr: "ignore"
      }, "next")).toThrow(ProcessGroupLifecycleError);
    } finally {
      Date.now = realNow;
    }
    harvestRuntimeLeak();
  });

  it("timeout 且 child 永不 exit/close 时按单调时钟有界 settle", async () => {
    const root = home();
    const clock = virtualClock();
    const spawned = fakeSpawned(61006, root);
    setRuntimeChildTestHooks({
      ...clock.hooks,
      spawn: () => spawned,
      groupState: () => "alive",
      killProcess: () => undefined,
      closeDeadlineMs: 20,
      drainDeadlineMs: 20,
      killGraceMs: 5
    });
    const pending = execRuntimeChild("git", ["--version"], { timeout: 10 });
    await once(spawned.child, "spawn");
    const settled = await pump(clock, pending, 80);
    expect(isProcessGroupLifecycleError(settled)).toBe(true);
    expect(lifecycleFailureLeaves(settled).map((item) => item.message)).toEqual([
      "Command timed out after 10ms",
      "runtime child close withheld:61006"
    ]);
    expect(existsSync(runtimeChildRecordPath(root, 61006))).toBe(true);
    expect(runtimeChildLifecycleError()).toBeInstanceOf(ProcessGroupLifecycleError);
    harvestRuntimeLeak();
  });

  it("pipe error 且 child 永不 exit/close 时按单调时钟有界 settle", async () => {
    const root = home();
    const clock = virtualClock();
    const spawned = fakeSpawned(61007, root);
    setRuntimeChildTestHooks({
      ...clock.hooks,
      spawn: () => spawned,
      groupState: () => "alive",
      killProcess: () => undefined,
      closeDeadlineMs: 20,
      drainDeadlineMs: 20,
      killGraceMs: 5
    });
    const pending = execRuntimeChild("git", ["--version"]);
    await once(spawned.child, "spawn");
    spawned.child.stdout.emit("error", Object.assign(new Error("EPIPE"), { code: "EPIPE" }));
    const settled = await pump(clock, pending);
    expect(isProcessGroupLifecycleError(settled)).toBe(true);
    expect(lifecycleFailureLeaves(settled).map((item) => item.message)).toEqual([
      "stdout pipe failed:EPIPE",
      "runtime child close withheld:61007"
    ]);
    expect(existsSync(runtimeChildRecordPath(root, 61007))).toBe(true);
    expect(runtimeChildLifecycleError()).toBeInstanceOf(ProcessGroupLifecycleError);
    harvestRuntimeLeak();
  });

  it("后续 exit/close 不能延长已武装的 close 总截止", async () => {
    const root = home();
    const clock = virtualClock();
    const spawned = fakeSpawned(61008, root);
    setRuntimeChildTestHooks({
      ...clock.hooks,
      spawn: () => spawned,
      groupState: () => "alive",
      killProcess: () => undefined,
      closeDeadlineMs: 20,
      drainDeadlineMs: 20,
      killGraceMs: 5
    });
    const pending = execRuntimeChild("git", ["--version"], { timeout: 10 });
    await once(spawned.child, "spawn");
    clock.advance(15);
    spawned.child.emit("exit", 0, null);
    const settled = await pump(clock, pending);
    expect(isProcessGroupLifecycleError(settled)).toBe(true);
    expect(lifecycleFailureLeaves(settled).map((item) => item.message)).toEqual([
      "Command timed out after 10ms",
      "runtime child close withheld:61008"
    ]);
    expect(runtimeChildLifecycleError()).toBeInstanceOf(ProcessGroupLifecycleError);
    harvestRuntimeLeak();
  });
});

describe("spawn 事务回滚与 ownership barrier", () => {
  function fakeChild(pid: number, opts: { autoClose?: boolean; code?: number } = {}) {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const permit = new PassThrough();
    const child = new EventEmitter() as EventEmitter & {
      pid: number;
      stdin: PassThrough;
      stdout: PassThrough;
      stderr: PassThrough;
      stdio: unknown[];
      kill: (signal?: NodeJS.Signals) => boolean;
    };
    child.pid = pid;
    child.stdin = stdin;
    child.stdout = stdout;
    child.stderr = stderr;
    child.stdio = [stdin, stdout, stderr, permit];
    child.kill = () => true;
    queueMicrotask(() => {
      child.emit("spawn");
      if (opts.autoClose === false) return;
      stdout.end();
      stderr.end();
      child.emit("exit", opts.code ?? 0, null);
      child.emit("close", opts.code ?? 0, null);
    });
    return child;
  }

  function fakeExitingChild(pid: number, code = 0) {
    return fakeChild(pid, { code });
  }

  function fakeHangingChild(pid: number) {
    return fakeChild(pid, { autoClose: false });
  }

  function expectExactFailureLeaves(err: unknown, messages: string[]): Error[] {
    const leaves = lifecycleFailureLeaves(err);
    expect(new Set(leaves).size).toBe(leaves.length);
    expect(leaves.map((item) => item.message)).toEqual(messages);
    return leaves;
  }

  function windowsSignalHooks(
    pid: number,
    child: ReturnType<typeof fakeHangingChild>,
    phase: { current: "boot" | "live" | "killed" }
  ) {
    return {
      hostKind: () => "win32" as const,
      createNamedJob: () => ({ name: `job-sig-${String(pid)}`, handle: 1 }),
      assignPidToJob: () => undefined,
      spawnImpl: () => child as never,
      pidOf: () => pid,
      namedJobActiveCount: () => (phase.current === "killed" ? 0 : phase.current === "live" ? 1 : 0),
      terminateNamedJob: () => {
        phase.current = "killed";
        throw new ProcessGroupLifecycleError("TerminateJobObject failed in signal path");
      },
      closeNamedJob: () => undefined,
      killGraceMs: 5,
      closeDeadlineMs: 40,
      drainDeadlineMs: 40
    };
  }

  async function expectSignalPathLifecycleReject(
    pending: Promise<unknown>,
    root: string,
    messages: string[]
  ): Promise<unknown> {
    const err = await pending.then(
      (value) => {
        throw new Error(`expected reject, got ${JSON.stringify(value)}`);
      },
      (reason) => reason
    );
    expect(isProcessGroupLifecycleError(err)).toBe(true);
    const leaves = expectExactFailureLeaves(err, messages);
    expect(leaves.map((item) => item.message)).not.toContain("fallback SIGKILL failed");
    expect(runtimeChildLifecycleError()).toBeInstanceOf(ProcessGroupLifecycleError);
    expect(remainingRuntimeJobCount()).toBe(1);
    expect(remainingRuntimeChildOwnerCount(root)).toBe(1);
    expect(() => spawnRuntimeChild(process.execPath, ["-e", "process.exit(0)"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore"
    }, "next")).toThrow(ProcessGroupLifecycleError);
    harvestRuntimeLeak();
    return err;
  }

  it("pid undefined 时回滚 job/pipe 且无 owner", async () => {
    const root = home();
    let closed = 0;
    let killed = 0;
    setRuntimeChildTestHooks({
      hostKind: () => "win32",
      createNamedJob: () => ({ name: "job-undef", handle: 1 }),
      assignPidToJob: () => {
        throw new Error("should not assign");
      },
      closeNamedJob: () => {
        closed += 1;
      },
      pidOf: () => undefined,
      killChild: () => {
        killed += 1;
      }
    });
    expect(() => spawnRuntimeChild(process.execPath, ["-e", "process.exit(0)"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore"
    }, "test")).toThrow(/pid undefined/u);
    await pendingRuntimeChildRollback();
    expect(killed).toBe(1);
    expect(closed).toBe(1);
    expect(remainingRuntimeChildOwnerCount(root)).toBe(0);
  });

  it("同步 spawn throw 时关闭已创建 Job", () => {
    let closed = 0;
    setRuntimeChildTestHooks({
      hostKind: () => "win32",
      createNamedJob: () => ({ name: "job-sync", handle: 1 }),
      spawnImpl: () => {
        throw new Error("sync spawn throw");
      },
      closeNamedJob: () => {
        closed += 1;
      }
    });
    expect(() => spawnRuntimeChild(process.execPath, ["-e", "process.exit(0)"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore"
    }, "test")).toThrow(/sync spawn throw/u);
    expect(closed).toBe(1);
    expect(remainingRuntimeJobCount()).toBe(0);
  });

  it("kill 失败时污染并保留可恢复 map", async () => {
    home();
    setRuntimeChildTestHooks({
      hostKind: () => "win32",
      createNamedJob: () => ({ name: "job-kill", handle: 1 }),
      assignPidToJob: () => {
        throw new ProcessGroupLifecycleError("assign fail");
      },
      killChild: () => {
        throw new Error("kill failed");
      },
      closeNamedJob: () => undefined
    });
    expect(() => spawnRuntimeChild(process.execPath, ["-e", "process.exit(0)"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore"
    }, "test")).toThrow(/assign fail/u);
    await pendingRuntimeChildRollback();
    expect(runtimeChildLifecycleError()).toBeInstanceOf(ProcessGroupLifecycleError);
    harvestRuntimeLeak();
  });

  it("assignPidToJob revoked Proxy 仍回滚 wrapper/job 且错误受控", async () => {
    const { proxy, revoke } = Proxy.revocable(new Error("SECRET"), {
      get() {
        throw new Error("trap");
      }
    });
    revoke();
    let closed = 0;
    let killed = 0;
    const child = fakeExitingChild(62099);
    setRuntimeChildTestHooks({
      hostKind: () => "win32",
      createNamedJob: () => ({ name: "job-revoked-assign", handle: 1 }),
      spawnImpl: () => child as never,
      pidOf: () => 62099,
      assignPidToJob: () => {
        throw proxy;
      },
      killChild: () => {
        killed += 1;
      },
      closeNamedJob: () => {
        closed += 1;
      }
    });
    let thrown: unknown;
    expect(() => {
      try {
        spawnRuntimeChild(process.execPath, ["-e", "process.exit(0)"], {
          stdin: "ignore",
          stdout: "ignore",
          stderr: "ignore"
        }, "test");
      } catch (err) {
        thrown = err;
        throw err;
      }
    }).toThrow();
    expect(thrown).toBeInstanceOf(ProcessGroupLifecycleError);
    expect(Object.is(thrown, proxy)).toBe(false);
    expect((thrown as Error).message).not.toContain("SECRET");
    expect((thrown as Error).stack ?? "").not.toContain("SECRET");
    await pendingRuntimeChildRollback();
    expect(closed).toBeGreaterThanOrEqual(1);
    expect(killed).toBeGreaterThanOrEqual(1);
    expect(remainingRuntimeJobCount()).toBe(0);
  });

  it("close 二次失败时污染并保留 map", async () => {
    home();
    setRuntimeChildTestHooks({
      hostKind: () => "win32",
      createNamedJob: () => ({ name: "job-close2", handle: 1 }),
      assignPidToJob: () => {
        throw new ProcessGroupLifecycleError("assign fail");
      },
      killChild: (child) => {
        child.kill("SIGKILL");
      },
      closeNamedJob: () => {
        throw new ProcessGroupLifecycleError("CloseHandle failed again");
      }
    });
    expect(() => spawnRuntimeChild(process.execPath, ["-e", "process.exit(0)"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore"
    }, "test")).toThrow(/assign fail/u);
    await pendingRuntimeChildRollback();
    expect(runtimeChildLifecycleError()?.message).toMatch(/CloseHandle failed again/u);
    harvestRuntimeLeak();
  });

  it("release 与未完成 establish 竞态时 release 胜出且不发 permit", async () => {
    const root = home();
    let granted = "";
    const permit = { end(chunk?: string) { granted += chunk ?? ""; } } as unknown as NodeJS.WritableStream;
    setRuntimeChildTestHooks({
      groupState: () => "alive",
      now: () => 0,
      setTimeout(fn) {
        queueMicrotask(fn);
        return { id: 1 } as unknown as NodeJS.Timeout;
      },
      clearTimeout() {}
    });
    const lease = beginRuntimeChild(4249, process.execPath, "test", {
      registryHome: root,
      permit,
      runId: "run-4249",
      commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcdef", generation: "01234567-89ab-cdef-0123-456789abcdef"
    });
    const establishing = lease.establish();
    await lease.release();
    await establishing.catch(() => undefined);
    expect(granted).toBe("");
    expect(existsSync(runtimeChildRecordPath(root, 4249))).toBe(true);
  });

  it("BYOA 污染后 spawnRuntimeChild 拒绝新进入", () => {
    contaminateByoaLifecycle(new ProcessGroupLifecycleError("byoa barrier"));
    expect(() => spawnRuntimeChild(process.execPath, ["-e", "process.exit(0)"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore"
    }, "test")).toThrow(ProcessGroupLifecycleError);
    harvestRuntimeLeak();
  });

  it("共享 contamination 后另一路拒新，unknown 不能当 empty", () => {
    const root = home();
    contaminateSharedLifecycle(new ProcessGroupLifecycleError("tier1 barrier"));
    expect(() => spawnRuntimeChild(process.execPath, ["-e", "process.exit(0)"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore"
    }, "test")).toThrow(/tier1 barrier/u);
    expect(() => assertRuntimeChildShutdownAllowsStopped(root)).toThrow(ProcessGroupLifecycleError);
    harvestRuntimeLeak();
  });

  it("Job 已绑定且 active=0 时 PID 不可访问仍判 gone", () => {
    home();
    setRuntimeChildTestHooks({
      hostKind: () => "win32",
      createNamedJob: () => ({ name: "job-eperm", handle: 1 }),
      assignPidToJob: () => undefined,
      namedJobActiveCount: () => 0,
      processAlive: () => {
        throw new Error("pid inaccessible");
      },
      closeNamedJob: () => undefined
    });
    const spawned = spawnRuntimeChild(process.execPath, ["-e", "process.exit(0)"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore"
    }, "test");
    expect(runtimeProcessGroupState(spawned.child.pid!)).toBe("gone");
    try { spawned.child.kill("SIGKILL"); } catch { /* 收口 */ }
    harvestRuntimeLeak();
  });

  it("Job active=0 即使 PID 复用仍判 gone", () => {
    home();
    setRuntimeChildTestHooks({
      hostKind: () => "win32",
      createNamedJob: () => ({ name: "job-zero", handle: 1 }),
      assignPidToJob: () => undefined,
      namedJobActiveCount: () => 0,
      processAlive: () => true,
      closeNamedJob: () => undefined
    });
    const spawned = spawnRuntimeChild(process.execPath, ["-e", "process.exit(0)"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore"
    }, "test");
    expect(runtimeProcessGroupState(spawned.child.pid!)).toBe("gone");
    try { spawned.child.kill("SIGKILL"); } catch { /* 收口 */ }
    harvestRuntimeLeak();
  });

  it("Job 查询失败时为 unknown 且不得当 empty", () => {
    home();
    setRuntimeChildTestHooks({
      hostKind: () => "win32",
      createNamedJob: () => ({ name: "job-q", handle: 1 }),
      assignPidToJob: () => undefined,
      namedJobActiveCount: () => {
        throw new Error("query failed");
      },
      processAlive: () => false,
      closeNamedJob: () => undefined
    });
    const spawned = spawnRuntimeChild(process.execPath, ["-e", "process.exit(0)"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore"
    }, "test");
    expect(runtimeProcessGroupState(spawned.child.pid!)).toBe("unknown");
    expect(() => assertRuntimeChildShutdownAllowsStopped()).toThrow();
    harvestRuntimeLeak();
  });

  it("exec Job query 失败时当前调用 reject、保留 owner/job、拒新 spawn", async () => {
    const root = home();
    setRuntimeChildTestHooks({
      hostKind: () => "win32",
      createNamedJob: () => ({ name: "job-query", handle: 1 }),
      assignPidToJob: () => undefined,
      spawnImpl: () => fakeExitingChild(62001) as never,
      pidOf: () => 62001,
      groupState: () => "gone",
      namedJobActiveCount: () => {
        throw new ProcessGroupLifecycleError("job query failed");
      },
      closeNamedJob: () => undefined
    });
    await expect(execRuntimeChild(process.execPath, ["-e", "process.exit(0)"], { timeout: 5_000 }))
      .rejects.toThrow(/job query failed/u);
    expect(runtimeChildLifecycleError()).toBeInstanceOf(ProcessGroupLifecycleError);
    expect(remainingRuntimeJobCount()).toBe(1);
    expect(remainingRuntimeChildOwnerCount(root)).toBe(1);
    expect(() => spawnRuntimeChild(process.execPath, ["-e", "process.exit(0)"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore"
    }, "next")).toThrow(ProcessGroupLifecycleError);
    harvestRuntimeLeak();
  });

  it("exec Job terminate 失败时当前调用 reject 且保留 owner/job", async () => {
    const root = home();
    setRuntimeChildTestHooks({
      hostKind: () => "win32",
      createNamedJob: () => ({ name: "job-term", handle: 1 }),
      assignPidToJob: () => undefined,
      spawnImpl: () => fakeExitingChild(62002) as never,
      pidOf: () => 62002,
      groupState: () => "gone",
      namedJobActiveCount: () => 1,
      terminateNamedJob: () => {
        throw new ProcessGroupLifecycleError("job terminate failed");
      },
      closeNamedJob: () => undefined
    });
    await expect(execRuntimeChild(process.execPath, ["-e", "process.exit(0)"], { timeout: 5_000 }))
      .rejects.toThrow(/job terminate failed/u);
    expect(runtimeChildLifecycleError()).toBeInstanceOf(ProcessGroupLifecycleError);
    expect(remainingRuntimeJobCount()).toBe(1);
    expect(remainingRuntimeChildOwnerCount(root)).toBe(1);
    harvestRuntimeLeak();
  });

  it("exec Job drain 未到 0 时当前调用 reject 且保留 owner/job", async () => {
    const root = home();
    setRuntimeChildTestHooks({
      hostKind: () => "win32",
      createNamedJob: () => ({ name: "job-drain", handle: 1 }),
      assignPidToJob: () => undefined,
      spawnImpl: () => fakeExitingChild(62003) as never,
      pidOf: () => 62003,
      groupState: () => "gone",
      namedJobActiveCount: () => 1,
      terminateNamedJob: () => undefined,
      drainDeadlineMs: 0,
      closeNamedJob: () => undefined
    });
    await expect(execRuntimeChild(process.execPath, ["-e", "process.exit(0)"], { timeout: 5_000 }))
      .rejects.toThrow(/process group did not exit/u);
    expect(runtimeChildLifecycleError()).toBeInstanceOf(ProcessGroupLifecycleError);
    expect(remainingRuntimeJobCount()).toBe(1);
    expect(remainingRuntimeChildOwnerCount(root)).toBe(1);
    harvestRuntimeLeak();
  });

  it("exec Job close 失败时当前调用 reject 且保留 owner/job", async () => {
    const root = home();
    setRuntimeChildTestHooks({
      hostKind: () => "win32",
      createNamedJob: () => ({ name: "job-close", handle: 1 }),
      assignPidToJob: () => undefined,
      spawnImpl: () => fakeExitingChild(62004) as never,
      pidOf: () => 62004,
      groupState: () => "gone",
      namedJobActiveCount: () => 0,
      closeNamedJob: () => {
        throw new ProcessGroupLifecycleError("job close failed");
      }
    });
    await expect(execRuntimeChild(process.execPath, ["-e", "process.exit(0)"], { timeout: 5_000 }))
      .rejects.toThrow(/job close failed/u);
    expect(runtimeChildLifecycleError()).toBeInstanceOf(ProcessGroupLifecycleError);
    expect(remainingRuntimeJobCount()).toBe(1);
    expect(remainingRuntimeChildOwnerCount(root)).toBe(1);
    harvestRuntimeLeak();
  });

  it("signal-path TerminateJob 失败且 active=0 时 work 成功形状仍 reject 为 lifecycle", async () => {
    const root = home();
    const pid = 64101;
    const child = fakeHangingChild(pid);
    const phase: { current: "boot" | "live" | "killed" } = { current: "boot" };
    setRuntimeChildTestHooks(windowsSignalHooks(pid, child, phase));
    const pending = execRuntimeChild(process.execPath, ["-e", "process.exit(0)"], { timeout: 5_000 });
    await once(child, "spawn");
    await Promise.resolve();
    await Promise.resolve();
    if (phase.current === "boot") phase.current = "live";
    child.stdout.end();
    child.stderr.end();
    child.emit("exit", 0, null);
    child.emit("close", 0, null);
    await expectSignalPathLifecycleReject(pending, root, ["TerminateJobObject failed in signal path"]);
  });

  it("signal-path TerminateJob 失败且 active=0 时 work 失败形状保留双错", async () => {
    const root = home();
    const pid = 64102;
    const child = fakeHangingChild(pid);
    const phase: { current: "boot" | "live" | "killed" } = { current: "boot" };
    setRuntimeChildTestHooks(windowsSignalHooks(pid, child, phase));
    const pending = execRuntimeChild(process.execPath, ["-e", "process.exit(1)"], { timeout: 5_000 });
    await once(child, "spawn");
    await Promise.resolve();
    await Promise.resolve();
    if (phase.current === "boot") phase.current = "live";
    child.stdout.end();
    child.stderr.end();
    child.emit("exit", 1, null);
    child.emit("close", 1, null);
    const err = await expectSignalPathLifecycleReject(pending, root, [
      "Command failed with exit code 1",
      "TerminateJobObject failed in signal path"
    ]);
    expect(err).toBeInstanceOf(AggregateError);
  });

  it("timeout 路径 TerminateJob 失败不得未处理拒绝且当前调用 reject", async () => {
    const root = home();
    const pid = 64103;
    const child = fakeHangingChild(pid);
    const phase: { current: "boot" | "live" | "killed" } = { current: "boot" };
    const term = new ProcessGroupLifecycleError("TerminateJobObject failed TERM");
    const kill = new ProcessGroupLifecycleError("TerminateJobObject failed KILL");
    let terminateCalls = 0;
    setRuntimeChildTestHooks({
      ...windowsSignalHooks(pid, child, phase),
      terminateNamedJob: () => {
        terminateCalls += 1;
        if (terminateCalls === 1) throw term;
        phase.current = "killed";
        throw kill;
      }
    });
    const rejections: unknown[] = [];
    const onReject = (reason: unknown): void => {
      rejections.push(reason);
    };
    process.on("unhandledRejection", onReject);
    try {
      const pending = execRuntimeChild(process.execPath, ["-e", "process.exit(0)"], { timeout: 20 });
      await once(child, "spawn");
      await Promise.resolve();
      await Promise.resolve();
      if (phase.current === "boot") phase.current = "live";
      const err = await expectSignalPathLifecycleReject(pending, root, [
        "Command timed out after 20ms",
        "TerminateJobObject failed TERM",
        "TerminateJobObject failed KILL",
        "runtime child close withheld:64103"
      ]);
      expect(lifecycleFailureLeaves(err)[1]).toBe(term);
      expect(lifecycleFailureLeaves(err)[2]).toBe(kill);
      expect(terminateCalls).toBe(2);
      await new Promise((resolve) => setImmediate(resolve));
      expect(rejections).toEqual([]);
    } finally {
      process.off("unhandledRejection", onReject);
    }
  });

  it("timeout 路径两个 distinct signal 按 first-seen 全留且同 identity 只一次", async () => {
    const root = home();
    const pid = 64105;
    const child = fakeHangingChild(pid);
    const phase: { current: "boot" | "live" | "killed" } = { current: "boot" };
    const signalFirst = new ProcessGroupLifecycleError("signal-first");
    const signalSecond = new ProcessGroupLifecycleError("signal-second");
    let terminateCalls = 0;
    setRuntimeChildTestHooks({
      ...windowsSignalHooks(pid, child, phase),
      terminateNamedJob: () => {
        terminateCalls += 1;
        if (terminateCalls === 1) throw signalFirst;
        phase.current = "killed";
        throw signalSecond;
      }
    });
    const pending = execRuntimeChild(process.execPath, ["-e", "process.exit(0)"], { timeout: 20 });
    await once(child, "spawn");
    await Promise.resolve();
    await Promise.resolve();
    if (phase.current === "boot") phase.current = "live";
    const err = await pending.then(
      (value) => {
        throw new Error(`expected reject, got ${JSON.stringify(value)}`);
      },
      (reason) => reason
    );
    expect(isProcessGroupLifecycleError(err)).toBe(true);
    expectExactFailureLeaves(err, [
      "Command timed out after 20ms",
      "signal-first",
      "signal-second",
      "runtime child close withheld:64105"
    ]);
    expect(lifecycleFailureLeaves(err)[1]).toBe(signalFirst);
    expect(lifecycleFailureLeaves(err)[2]).toBe(signalSecond);
    expect(terminateCalls).toBe(2);
    expect(lifecycleFailureLeaves(err).map((item) => item.message)).not.toContain("fallback SIGKILL failed");
    expect(runtimeChildLifecycleError()).toBeInstanceOf(ProcessGroupLifecycleError);
    expect(remainingRuntimeJobCount()).toBe(1);
    expect(remainingRuntimeChildOwnerCount(root)).toBe(1);
    expect(() => spawnRuntimeChild(process.execPath, ["-e", "process.exit(0)"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore"
    }, "next")).toThrow(ProcessGroupLifecycleError);
    harvestRuntimeLeak();
  });

  it("timeout 路径同一 signal identity 重复只留一次", async () => {
    const root = home();
    const pid = 64106;
    const child = fakeHangingChild(pid);
    const phase: { current: "boot" | "live" | "killed" } = { current: "boot" };
    const sameSignal = new ProcessGroupLifecycleError("signal-once");
    let terminateCalls = 0;
    setRuntimeChildTestHooks({
      ...windowsSignalHooks(pid, child, phase),
      terminateNamedJob: () => {
        terminateCalls += 1;
        if (terminateCalls >= 2) phase.current = "killed";
        throw sameSignal;
      }
    });
    const pending = execRuntimeChild(process.execPath, ["-e", "process.exit(0)"], { timeout: 20 });
    await once(child, "spawn");
    await Promise.resolve();
    await Promise.resolve();
    if (phase.current === "boot") phase.current = "live";
    const err = await pending.then(
      (value) => {
        throw new Error(`expected reject, got ${JSON.stringify(value)}`);
      },
      (reason) => reason
    );
    expectExactFailureLeaves(err, [
      "Command timed out after 20ms",
      "signal-once",
      "runtime child close withheld:64106"
    ]);
    expect(lifecycleFailureLeaves(err).filter((item) => item === sameSignal)).toHaveLength(1);
    expect(terminateCalls).toBe(2);
    harvestRuntimeLeak();
  });

  it("pipe EIO + 三个 distinct signal + unreaped 五叶 exact", async () => {
    const root = home();
    const pid = 64108;
    const child = fakeHangingChild(pid);
    installRuntimeJobForTests(pid, { name: `job-five-${String(pid)}`, handle: 1 });
    const signalA = new ProcessGroupLifecycleError("signal-a");
    const signalB = new ProcessGroupLifecycleError("signal-b");
    const signalC = new ProcessGroupLifecycleError("signal-c");
    let terminateCalls = 0;
    const clock = (() => {
      let now = 0;
      const timers: { id: number; at: number; fn: () => void }[] = [];
      let seq = 1;
      return {
        hooks: {
          now: () => now,
          setTimeout(fn: () => void, ms: number) {
            const id = seq++;
            timers.push({ id, at: now + ms, fn });
            return { id } as unknown as NodeJS.Timeout;
          },
          clearTimeout(timer: NodeJS.Timeout) {
            const id = (timer as unknown as { id: number }).id;
            const index = timers.findIndex((item) => item.id === id);
            if (index >= 0) timers.splice(index, 1);
          }
        },
        advance(ms: number) {
          now += ms;
          let progressed = true;
          while (progressed) {
            progressed = false;
            for (const timer of [...timers]) {
              if (timer.at > now) continue;
              const i = timers.indexOf(timer);
              if (i < 0) continue;
              timers.splice(i, 1);
              timer.fn();
              progressed = true;
            }
          }
        }
      };
    })();
    setRuntimeChildTestHooks({
      ...clock.hooks,
      hostKind: () => "win32",
      spawn: () => ({
        child: child as never,
        commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcdef", generation: "01234567-89ab-cdef-0123-456789abcdef",
        lease: {
          establish: async () => undefined,
          release: async () => undefined
        }
      }),
      namedJobActiveCount: () => 1,
      killProcess: () => {
        throw signalA;
      },
      terminateNamedJob: () => {
        terminateCalls += 1;
        throw terminateCalls === 1 ? signalB : signalC;
      },
      closeNamedJob: () => undefined,
      killGraceMs: 5,
      closeDeadlineMs: 20,
      drainDeadlineMs: 20
    });
    const pending = execRuntimeChild(process.execPath, ["-e", "process.exit(0)"], { timeout: 5_000 });
    await once(child, "spawn");
    await Promise.resolve();
    await Promise.resolve();
    const eio = new Error("SECRET");
    Object.defineProperty(eio, "code", { value: "EIO" });
    child.stdout.emit("error", eio);
    child.stdout.end();
    child.stderr.end();
    child.emit("exit", 0, null);
    child.emit("close", 0, null);
    let settled: unknown;
    const finished = pending.then(
      (value) => {
        settled = value;
      },
      (reason) => {
        settled = reason;
      }
    );
    for (let i = 0; i < 40 && settled === undefined; i++) {
      clock.advance(5);
      await Promise.resolve();
      await Promise.resolve();
    }
    await finished;
    expect(isProcessGroupLifecycleError(settled)).toBe(true);
    expectExactFailureLeaves(settled, [
      "stdout pipe failed:EIO",
      "signal-b",
      "signal-c",
      `runtime child process group did not exit:${String(pid)}`
    ]);
    expect(JSON.stringify(lifecycleFailureLeaves(settled).map((item) => item.message))).not.toContain("SECRET");
    expect(runtimeChildLifecycleError()).toBeInstanceOf(ProcessGroupLifecycleError);
    expect(remainingRuntimeJobCount()).toBe(1);
    expect(() => spawnRuntimeChild(process.execPath, ["-e", "process.exit(0)"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore"
    }, "next")).toThrow(ProcessGroupLifecycleError);
    harvestRuntimeLeak();
  });

  it("work=undefined + signal 保留 opaque work 叶与 signal-first", async () => {
    const root = home();
    const pid = 64107;
    const child = fakeHangingChild(pid);
    installRuntimeJobForTests(pid, { name: `job-undef-${String(pid)}`, handle: 1 });
    setRuntimeChildTestHooks({
      hostKind: () => "win32",
      spawn: () => ({
        child: child as never,
        commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcdef", generation: "01234567-89ab-cdef-0123-456789abcdef",
        lease: {
          establish: async () => {
            throw undefined;
          },
          release: async () => undefined
        }
      }),
      terminateNamedJob: () => {
        throw new ProcessGroupLifecycleError("signal-first");
      },
      namedJobActiveCount: () => 0,
      closeNamedJob: () => undefined,
      killGraceMs: 5,
      closeDeadlineMs: 40,
      drainDeadlineMs: 40
    });
    const pending = execRuntimeChild(process.execPath, ["-e", "process.exit(0)"], { timeout: 5_000 });
    try {
      const err = await pending.then(
        (value) => {
          throw new Error(`expected reject, got ${JSON.stringify(value)}`);
        },
        (reason) => reason
      );
      const leaves = lifecycleFailureLeaves(err);
      expect(leaves.map((item) => item.message)).toEqual([
        OPAQUE_ERROR_GRAPH_VALUE.message,
        "signal-first",
        `runtime child close withheld:${String(pid)}`
      ]);
      expect(leaves[0]).toBe(OPAQUE_ERROR_GRAPH_VALUE);
      expect(leaves).toHaveLength(3);
      expect(runtimeChildLifecycleError()).toBeInstanceOf(ProcessGroupLifecycleError);
      expect(remainingRuntimeJobCount()).toBe(1);
      expect(remainingRuntimeChildOwnerCount(root)).toBe(0);
    } finally {
      harvestRuntimeLeak();
    }
  });

  it("BYOA signal-path TerminateJob 失败且 work 失败时保留业务字段并拒绝下次 spawn", async () => {
    const root = home();
    const pid = 64104;
    const child = fakeHangingChild(pid);
    const phase: { current: "boot" | "live" | "killed" } = { current: "boot" };
    let terminateCalls = 0;
    setRuntimeChildTestHooks({
      ...windowsSignalHooks(pid, child, phase),
      terminateNamedJob: () => {
        terminateCalls += 1;
        phase.current = "killed";
        throw new ProcessGroupLifecycleError("TerminateJobObject failed in signal path");
      }
    });
    const pending = runSpawnTurn({
      argv: { bin: process.execPath, args: ["-e", "process.exit(1)"], cwd: root },
      prompt: "hi",
      wallTimeoutMs: 5_000,
      idleTimeoutMs: 0,
      killGraceMs: 5,
      networkRetryLimit: 0
    });
    await once(child, "spawn");
    await Promise.resolve();
    await Promise.resolve();
    if (phase.current === "boot") phase.current = "live";
    child.stdout.end();
    child.stderr.end();
    child.emit("exit", 1, null);
    child.emit("close", 1, null);
    const result = await pending;
    expect(result.exitCode).toBe(1);
    expect(result.lifecycleError).toBe("process_group_not_reaped");
    expect(result.timedOut).toBe(false);
    expect(terminateCalls).toBeGreaterThan(0);
    expect(getByoaLifecycleContamination()).toBeInstanceOf(ProcessGroupLifecycleError);
    expect(runtimeChildLifecycleError()).toBeInstanceOf(ProcessGroupLifecycleError);
    expect(remainingRuntimeJobCount()).toBe(1);
    expect(remainingRuntimeChildOwnerCount(root)).toBe(1);
    expect(() => spawnRuntimeChild(process.execPath, ["-e", "process.exit(0)"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore"
    }, "next")).toThrow(ProcessGroupLifecycleError);
    harvestRuntimeLeak();
  });

  it("wrapper 源码硬截止使用单调时钟", () => {
    const source = runtimeChildWrapperSource();
    // 只禁字面量 Date.now( 挡不住等价写法：new Date().getTime() / +new Date / Date.parse
    // 都能拿到同一个会被系统时钟调整影响的墙钟。wrapper 里所有超时判定都必须用单调时钟，
    // 故整类 Date 读取一并禁掉（wrapper 无需格式化时间，没有合法用途）。
    expect(source).not.toMatch(/\bDate\.now\s*\(/u);
    expect(source).not.toMatch(/\bnew\s+Date\b/u);
    expect(source).not.toMatch(/\bDate\.parse\s*\(/u);
    expect(source).not.toMatch(/\bDate\.UTC\s*\(/u);
    expect(source).toMatch(/performance\.now\s*\(/u);
  });

  it("预置泄漏时 exact-empty 必须 throw，reset 报告后可继续", () => {
    home();
    setRuntimeChildTestHooks({
      hostKind: () => "win32",
      createNamedJob: () => ({ name: "job-leak", handle: 1 }),
      assignPidToJob: () => undefined,
      namedJobActiveCount: () => 1,
      closeNamedJob: () => undefined
    });
    spawnRuntimeChild(process.execPath, ["-e", "process.exit(0)"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore"
    }, "test");
    expect(remainingRuntimeJobCount()).toBeGreaterThan(0);
    expect(() => assertRuntimeChildExactEmpty()).toThrow(/exact-empty failed/u);
    harvestRuntimeLeak();
    expect(remainingRuntimeJobCount()).toBe(0);
    expect(runtimeChildLifecycleError()).toBeNull();
  });

  it("contaminateRuntimeChildLifecycle 返回当前错误且全局 first-wins", () => {
    const first = contaminateRuntimeChildLifecycle(new ProcessGroupLifecycleError("TerminateJobObject failed first"));
    const second = contaminateRuntimeChildLifecycle(new ProcessGroupLifecycleError("TerminateJobObject failed second"));
    expect(first.message).toContain("first");
    expect(second.message).toContain("second");
    expect(second).not.toBe(first);
    expect(runtimeChildLifecycleError()).toBe(first);
    harvestRuntimeLeak();
  });

  it("POSIX kill 仅 own-data ESRCH 可忽略", () => {
    setRuntimeChildTestHooks({
      hostKind: () => "linux",
      killProcess: () => {
        const err = new Error("gone");
        Object.defineProperty(err, "code", { value: "ESRCH" });
        throw err;
      }
    });
    expect(() => signalRuntimeChildTree(4242, "SIGKILL")).toThrow(/runtime job identity missing/u);
    expect(runtimeChildLifecycleError()).toBeInstanceOf(ProcessGroupLifecycleError);
    harvestRuntimeLeak();
  });

  it("POSIX kill EPERM 污染 lifecycle", () => {
    setRuntimeChildTestHooks({
      hostKind: () => "linux",
      killProcess: () => {
        const err = new Error("denied");
        Object.defineProperty(err, "code", { value: "EPERM" });
        throw err;
      }
    });
    expect(() => signalRuntimeChildTree(4242, "SIGKILL")).toThrow(ProcessGroupLifecycleError);
    expect(runtimeChildLifecycleError()).toBeInstanceOf(ProcessGroupLifecycleError);
    harvestRuntimeLeak();
  });

  it("POSIX kill revoked Proxy 污染且不抛 TypeError", () => {
    const { proxy, revoke } = Proxy.revocable(new Error("kill"), {});
    revoke();
    setRuntimeChildTestHooks({
      hostKind: () => "linux",
      killProcess: () => {
        throw proxy;
      }
    });
    expect(() => signalRuntimeChildTree(4242, "SIGKILL")).toThrow(ProcessGroupLifecycleError);
    expect(runtimeChildLifecycleError()).toBeInstanceOf(ProcessGroupLifecycleError);
    harvestRuntimeLeak();
  });

  it("POSIX group state 只认 own-data ESRCH/EPERM，继承/Proxy 不得当 gone", () => {
    const orig = process.kill.bind(process);
    const inherited = Object.create({ code: "ESRCH" }) as Error;
    Object.defineProperty(inherited, "message", { value: "SECRET" });
    try {
      process.kill = ((pid: number, signal?: NodeJS.Signals | number) => {
        if (signal === 0 || signal === "SIGTERM") throw inherited;
        return orig(pid, signal as never);
      }) as typeof process.kill;
      expect(runtimeProcessGroupState(4242)).toBe("unknown");
    } finally {
      process.kill = orig;
    }

    const eperm = new Error("denied");
    Object.defineProperty(eperm, "code", { value: "EPERM" });
    try {
      process.kill = ((pid: number, signal?: NodeJS.Signals | number) => {
        if (signal === 0) throw eperm;
        return orig(pid, signal as never);
      }) as typeof process.kill;
      expect(runtimeProcessGroupState(4242)).toBe("alive");
    } finally {
      process.kill = orig;
    }

    let gets = 0;
    const proxy = new Proxy(new Error("SECRET"), {
      get(t, p, r) {
        gets += 1;
        return Reflect.get(t, p, r);
      }
    });
    try {
      process.kill = ((pid: number, signal?: NodeJS.Signals | number) => {
        if (signal === 0) throw proxy;
        return orig(pid, signal as never);
      }) as typeof process.kill;
      expect(runtimeProcessGroupState(4242)).toBe("unknown");
      expect(gets).toBe(0);
    } finally {
      process.kill = orig;
    }
  });

  it("PID successor 时旧 lease 迟到 release 不得 teardown 新 Job", async () => {
    const root = home();
    let closed = 0;
    const childA = fakeHangingChild(77001);
    const childB = fakeHangingChild(77001);
    let spawnN = 0;
    setRuntimeChildTestHooks({
      hostKind: () => "win32",
      createNamedJob: (name) => ({ name, handle: spawnN + 1 }),
      assignPidToJob: () => undefined,
      namedJobActiveCount: () => 0,
      terminateNamedJob: () => undefined,
      closeNamedJob: () => {
        closed += 1;
      },
      pidOf: () => 77001,
      spawnImpl: () => {
        spawnN += 1;
        return (spawnN === 1 ? childA : childB) as never;
      }
    });
    const first = spawnRuntimeChild(process.execPath, ["-e", "process.exit(0)"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
      runId: "run-old-aaaa"
    }, "test");
    const second = spawnRuntimeChild(process.execPath, ["-e", "process.exit(0)"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
      runId: "run-new-bbbb"
    }, "test");
    expect(runtimeJobRegistered(77001)).toBe(true);
    await first.lease.release();
    expect(runtimeJobRegistered(77001)).toBe(true);
    expect(existsSync(runtimeChildRecordPath(root, 77001))).toBe(true);
    await second.lease.release();
    expect(runtimeJobRegistered(77001)).toBe(false);
    expect(closed).toBeGreaterThanOrEqual(1);
  });

  it("Windows SIGTERM 与 TerminateJob failure 无裸 PID fallback", () => {
    home();
    let processKills = 0;
    const orig = process.kill.bind(process);
    const child = fakeHangingChild(77002);
    child.kill = () => {
      throw new Error("child.kill forbidden");
    };
    try {
      process.kill = ((pid: number, signal?: NodeJS.Signals | number) => {
        if (signal !== undefined && signal !== 0) processKills += 1;
        return orig(pid, signal as never);
      }) as typeof process.kill;
      setRuntimeChildTestHooks({
        hostKind: () => "win32",
        createNamedJob: () => ({ name: "job-nopid", handle: 1 }),
        assignPidToJob: () => undefined,
        namedJobActiveCount: () => 1,
        terminateNamedJob: () => {
          throw new ProcessGroupLifecycleError("TerminateJobObject failed in signal path");
        },
        closeNamedJob: () => undefined,
        pidOf: () => 77002,
        spawnImpl: () => child as never
      });
      spawnRuntimeChild(process.execPath, ["-e", "process.exit(0)"], {
        stdin: "ignore",
        stdout: "ignore",
        stderr: "ignore"
      }, "test");
      expect(() => signalRuntimeChildTree(77002, "SIGTERM")).toThrow(/TerminateJobObject failed/u);
      expect(processKills).toBe(0);
    } finally {
      process.kill = orig;
      harvestRuntimeLeak();
    }
  });

  it("generation 替换后旧 identity 不得删除新 owner", () => {
    const root = home();
    const path = runtimeChildRecordPath(root, 77003);
    mkdirSync(join(root, "runtime", "children"), { recursive: true, mode: 0o700 });
    writeFileSync(path, JSON.stringify(completeRuntimeOwner({
      version: 1,
      pid: 77003,
      kind: "exec",
      binary: process.execPath,
      processStart: "birth-b",
      ownerPid: 9,
      ownerInstanceId: "owner-b",
      runId: "run-b",
      commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcdef", generation: "01234567-89ab-cdef-0123-456789abcdef"
    })));
    expect(() => commitOwnerReapIfIdentity(
      path,
      {
        version: 1,
        pid: 77003,
        ownerInstanceId: "owner-a",
        runId: "run-a",
        processStart: "birth-a",
        ownerPid: 9,
        binary: process.execPath,
        kind: "exec",
        jobName: formatSayDoJobName("Local", "owner-a", "run-a", GEN),
        commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcdef",
        generation: "01234567-89ab-cdef-0123-456789abcdef"
      },
      () => undefined,
      () => {
        rmSync(path, { force: true });
      }
    )).toThrow(/identity cas failed/u);
    expect(existsSync(path)).toBe(true);
    expect(JSON.parse(readFileSync(path, "utf8")).runId).toBe("run-b");
  });

  it("prior-generation owners 在当前 generation 前回收", async () => {
    const root = home();
    const path = runtimeChildRecordPath(root, 880001);
    mkdirSync(join(root, "runtime", "children"), { recursive: true, mode: 0o700 });
    writeFileSync(path, JSON.stringify(completeRuntimeOwner({
      version: 1,
      pid: 880001,
      kind: "exec",
      binary: process.execPath,
      processStart: "owned-start",
      ownerPid: 2,
      ownerInstanceId: "prior-owner",
      runId: "prior-run",
      commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcdef", generation: "01234567-89ab-cdef-0123-456789abcdef"
    })));
    const reaped = await recoverPriorGenerationRuntimeOwners(root, {
      ownerPid: process.pid,
      ownerInstanceId: "current-owner"
    });
    expect(reaped).toBe(1);
    expect(existsSync(path)).toBe(false);
  });

  it("延迟 signal 捕获 generation，successor 注册后旧 callback 不得杀新一代", async () => {
    const child = new EventEmitter() as EventEmitter & {
      pid: number;
      stdin: { end: () => void; on: () => void };
      stdout: { resume: () => void; on: () => void };
      stderr: { resume: () => void; on: () => void };
      stdio: unknown[];
      kill: () => boolean;
    };
    child.pid = 88011;
    child.stdin = { end: () => undefined, on: () => undefined };
    child.stdout = { resume: () => undefined, on: () => undefined };
    child.stderr = { resume: () => undefined, on: () => undefined };
    child.stdio = [child.stdin, child.stdout, child.stderr, { write: () => true, end: () => undefined, on: () => undefined }];
    child.kill = () => true;
    let terminated: string[] = [];
    setRuntimeChildTestHooks({
      hostKind: () => "win32",
      createNamedJob: (name) => ({ name, handle: 1 }),
      assignPidToJob: () => undefined,
      namedJobActiveCount: () => 0,
      closeNamedJob: () => undefined,
      terminateNamedJob: (job) => {
        terminated.push(job.name);
      },
      pidOf: () => 88011,
      spawnImpl: () => child as never
    });
    configureRuntimeChildRegistry(home(), "owner-a");
    const first = spawnRuntimeChild(process.execPath, ["-e", "0"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
      registryHome: home()
    }, "test");
    const captured = first.generation;
    const later = spawnRuntimeChild(process.execPath, ["-e", "0"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
      registryHome: home()
    }, "test");
    terminated = [];
    first.signal?.("SIGKILL");
    expect(terminated).toEqual([]);
    later.signal?.("SIGKILL");
    expect(terminated).toEqual([typeof later.generation === "object" ? later.generation?.jobName : undefined]);
    expect(captured && typeof captured === "object" ? captured.id : undefined)
      .not.toBe(typeof later.generation === "object" ? later.generation?.id : later.generation);
    harvestRuntimeLeak();
  });

  it("successor 在 kill 与 delete 之间发布时 CAS 保留新 owner", async () => {
    const root = home();
    const path = runtimeChildRecordPath(root, 88012);
    mkdirSync(join(root, "runtime", "children"), { recursive: true, mode: 0o700 });
    setKillOwnedTreeTestHooks({
      processBirth: () => "birth-a",
      processAlive: () => false,
      groupAlive: () => false
    });
    const first = completeRuntimeOwner({
      version: 1 as const,
      pid: 88012,
      kind: "exec",
      binary: process.execPath,
      processStart: "birth-a",
      ownerPid: 2,
      ownerInstanceId: "prior-owner",
      runId: "run-a",
      commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcdef",
      generation: "01234567-89ab-cdef-0123-456789abcdef"
    });
    writeFileSync(path, JSON.stringify(first));
    const successor = completeRuntimeOwner({
      ...first,
      ownerInstanceId: "successor-owner",
      runId: "run-b",
      generation: GEN_B,
      commandToken: `saydo-child-${GEN_B}`
    });
    const reaped = await recoverPriorGenerationRuntimeOwners(root, {
      ownerPid: process.pid,
      ownerInstanceId: "current-owner"
    }, {
      afterKillBeforeDelete: () => {
        writeFileSync(path, JSON.stringify(successor));
      }
    });
    expect(reaped).toBe(0);
    expect(existsSync(path)).toBe(true);
    expect(JSON.parse(readFileSync(path, "utf8")).generation).toBe(successor.generation);
  });

  it("POSIX null-birth 拒绝 destructive signal，且不得 kill(-pid)", () => {
    const orig = process.kill.bind(process);
    let killed: Array<[number, NodeJS.Signals | number | undefined]> = [];
    try {
      process.kill = ((pid: number, signal?: NodeJS.Signals | number) => {
        killed.push([pid, signal]);
        return orig(pid, signal as never);
      }) as typeof process.kill;
      setRuntimeChildTestHooks({
        hostKind: () => "linux",
        killProcess: (pid, signal) => {
          killed.push([pid, signal]);
        }
      });
      installRuntimeJobForTests(4242, { name: formatSayDoJobName("Local", "owner", "run", GEN), handle: null });
      expect(() => signalRuntimeChildTree(4242, "SIGKILL")).toThrow(/captured birth/u);
      expect(killed).toEqual([]);
    } finally {
      process.kill = orig;
      harvestRuntimeLeak();
    }
  });

  it("POSIX birth=null 且 group gone 才视为已退出：不杀、不污染", () => {
    const killed: NodeJS.Signals[] = [];
    const jobName = formatSayDoJobName("Local", "owner", "run", GEN);
    setRuntimeChildTestHooks({
      hostKind: () => "linux",
      processBirth: () => null,
      groupState: () => "gone",
      killProcess: (_pid, signal) => {
        killed.push(signal);
      }
    });
    installRuntimeJobForTests(2_147_483_600, { name: jobName, handle: null }, {
      id: GEN,
      processStart: "birth-old",
      runId: "run",
      ownerInstanceId: "owner",
      jobName
    });
    expect(() => signalRuntimeChildTree(2_147_483_600, "SIGKILL")).not.toThrow();
    expect(killed).toEqual([]);
    expect(runtimeChildLifecycleError()).toBeNull();
    harvestRuntimeLeak();
  });

  it("POSIX birth=null 且目标仍存活/未知时 fail-closed 污染，不得静默放行 SIGKILL", () => {
    const killed: NodeJS.Signals[] = [];
    const jobName = formatSayDoJobName("Local", "owner", "run", GEN);
    for (const state of ["alive", "unknown"] as const) {
      setRuntimeChildTestHooks({
        hostKind: () => "linux",
        processBirth: () => null,
        groupState: () => state,
        killProcess: (_pid, signal) => {
          killed.push(signal);
        }
      });
      installRuntimeJobForTests(424201, { name: jobName, handle: null }, {
        id: GEN,
        processStart: "birth-old",
        runId: "run",
        ownerInstanceId: "owner",
        jobName
      });
      expect(() => signalRuntimeChildTree(424201, "SIGKILL")).toThrow(/birth unavailable while process\/group alive/u);
      expect(killed).toEqual([]);
      expect(runtimeChildLifecycleError()).toBeInstanceOf(ProcessGroupLifecycleError);
      harvestRuntimeLeak();
    }
  });

  it("同 PID 两代：旧 SIGTERM/SIGKILL/release 不得触碰 successor", async () => {
    const child = new EventEmitter() as EventEmitter & {
      pid: number;
      stdin: { end: () => void; on: () => void };
      stdout: { resume: () => void; on: () => void };
      stderr: { resume: () => void; on: () => void };
      stdio: unknown[];
      kill: () => boolean;
    };
    child.pid = 99001;
    child.stdin = { end: () => undefined, on: () => undefined };
    child.stdout = { resume: () => undefined, on: () => undefined };
    child.stderr = { resume: () => undefined, on: () => undefined };
    child.stdio = [child.stdin, child.stdout, child.stderr, { write: () => true, end: () => undefined, on: () => undefined }];
    child.kill = () => true;
    const signals: NodeJS.Signals[] = [];
    setRuntimeChildTestHooks({
      hostKind: () => "linux",
      pidOf: () => 99001,
      spawnImpl: () => child as never,
      killProcess: (_pid, signal) => {
        signals.push(signal);
      },
      groupState: () => "gone"
    });
    const first = spawnRuntimeChild(process.execPath, ["-e", "0"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
      registryHome: home(),
      runId: "run-old"
    }, "test");
    if (typeof first.generation === "object" && first.generation) first.generation.processStart = "birth-old";
    const later = spawnRuntimeChild(process.execPath, ["-e", "0"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
      registryHome: home(),
      runId: "run-new"
    }, "test");
    if (typeof later.generation === "object" && later.generation) later.generation.processStart = "birth-new";
    signals.length = 0;
    first.signal?.("SIGTERM");
    first.signal?.("SIGKILL");
    await first.lease.release();
    expect(signals).toEqual([]);
    expect(runtimeJobRegistered(99001)).toBe(true);
    harvestRuntimeLeak();
  });

  it("同 PID 两代：registerGeneration 必须淘汰旧 id，旧 generation 不得 current", () => {
    const jobNameA = formatSayDoJobName("Local", "owner", "run-a", GEN);
    const jobNameB = formatSayDoJobName("Local", "owner", "run-b", GEN_B);
    const old = installRuntimeJobForTests(88011, { name: jobNameA, handle: 1 }, {
      id: GEN,
      processStart: "birth-a",
      runId: "run-a",
      ownerInstanceId: "owner",
      jobName: jobNameA,
      binary: process.execPath,
      kind: "runtime"
    });
    const neu = installRuntimeJobForTests(88011, { name: jobNameB, handle: 2 }, {
      id: GEN_B,
      processStart: "birth-b",
      runId: "run-b",
      ownerInstanceId: "owner",
      jobName: jobNameB,
      binary: process.execPath,
      kind: "runtime"
    });
    expect(remainingRuntimeJobCount()).toBe(1);
    expect(remainingRuntimeGenerationCount()).toBe(1);
    expect(runtimeGenerationRegistered(old.id)).toBe(false);
    expect(runtimeGenerationRegistered(neu.id)).toBe(true);
    expect(runtimeGenerationIsCurrent(old)).toBe(false);
    expect(runtimeGenerationIsCurrent(neu)).toBe(true);
    const killed: NodeJS.Signals[] = [];
    setRuntimeChildTestHooks({
      hostKind: () => "linux",
      processBirth: () => "birth-a",
      groupState: () => "alive",
      killProcess: (_pid, signal) => {
        killed.push(signal);
      }
    });
    signalRuntimeChildGeneration(old, "SIGKILL");
    expect(killed).toEqual([]);
    harvestRuntimeLeak();
  });

  it("generationIsCurrent 必须按 PID 位完整身份，不能只查 id", () => {
    const jobName = formatSayDoJobName("Local", "owner", "run", GEN);
    const installed = installRuntimeJobForTests(88012, { name: jobName, handle: 1 }, {
      id: GEN,
      processStart: "birth-a",
      runId: "run",
      ownerInstanceId: "owner",
      jobName,
      binary: process.execPath,
      kind: "runtime"
    });
    const captured = {
      ...installed,
      binary: "/tmp/other-bin",
      kind: "other",
      job: { name: jobName, handle: 99 }
    };
    expect(runtimeGenerationIsCurrent(installed)).toBe(true);
    expect(runtimeGenerationIsCurrent(captured)).toBe(false);
    const birthShift = { ...installed, processStart: "other-birth" };
    const tokenShift = {
      ...installed,
      commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcde0"
    };
    expect(runtimeGenerationIsCurrent(birthShift)).toBe(false);
    expect(runtimeGenerationIsCurrent(tokenShift)).toBe(false);
    harvestRuntimeLeak();
  });

  it("beginRuntimeChild 无 home 或 pid<=1 必须 throw，不得变成 permit-granting no-op", () => {
    const token = "saydo-child-01234567-89ab-cdef-0123-456789abcdef";
    expect(() => beginRuntimeChild(1, process.execPath, "test", {
      registryHome: "/tmp/saydo-missing-home",
      runId: "run-1",
      commandToken: token,
      generation: GEN
    })).toThrow(/runtime child registry missing/u);
    expect(() => beginRuntimeChild(4242, process.execPath, "test", {
      registryHome: "",
      runId: "run-1",
      commandToken: token,
      generation: GEN
    })).toThrow(/runtime child registry missing/u);
    expect(runtimeChildLifecycleError()).toBeNull();
  });

  it("beginRuntimeChild 必须走 HOME boundary：async 持锁时 sync 不得写入", async () => {
    const root = home();
    let holding = false;
    let releaseHold!: () => void;
    const hold = new Promise<void>((resolve) => {
      releaseHold = resolve;
    });
    const first = withHomeOwnerBoundary(root, async () => {
      holding = true;
      await hold;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(holding).toBe(true);
    const path = runtimeChildRecordPath(root, 88013);
    expect(() => beginRuntimeChild(88013, process.execPath, "test", {
      registryHome: root,
      runId: "run-lock",
      commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcdef",
      generation: GEN
    })).toThrow(HOME_OWNER_LOCK_TIMEOUT);
    expect(existsSync(path)).toBe(false);
    releaseHold();
    await first;
  });

  it("establish 必须在 durable owner 发布后才放行 permit", async () => {
    const root = home();
    const path = runtimeChildRecordPath(root, 88021);
    const order: string[] = [];
    const permit = {
      end(token?: string) {
        order.push(`permit:${token ?? ""}`);
        expect(existsSync(path)).toBe(true);
        const rec = JSON.parse(readFileSync(path, "utf8")) as { processStart: string | null };
        expect(rec.processStart).toBe("birth-established");
      }
    };
    const lease = beginRuntimeChild(88021, process.execPath, "test", {
      registryHome: root,
      runId: "run-permit",
      commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcdef",
      generation: GEN,
      processStart: "birth-established",
      permit: permit as never,
      afterDurableOwner: () => {
        order.push("durable");
      }
    });
    await lease.establish();
    expect(order[0]).toBe("durable");
    expect(order[1]).toBe("permit:1");
  });

  it("establish 在 pending processStart=null 时必须补写 durable birth 后才 permit", async () => {
    const root = home();
    const path = runtimeChildRecordPath(root, 88031);
    const { setKillOwnedTreeTestHooks } = await import("@saydo/platform");
    setKillOwnedTreeTestHooks({
      processBirth: () => "birth-from-probe",
      processAnchor: () => ({ pgid: 88031, command: `${process.execPath} saydo-child-${GEN}` }),
      processAlive: () => true,
      groupAlive: () => true
    });
    setRuntimeChildTestHooks({
      hostKind: () => "linux",
      groupState: () => "alive"
    });
    const order: string[] = [];
    const permit = {
      end(token?: string) {
        order.push(`permit:${token ?? ""}`);
        expect(JSON.parse(readFileSync(path, "utf8")).processStart).toBe("birth-from-probe");
      }
    };
    const lease = beginRuntimeChild(88031, process.execPath, "test", {
      registryHome: root,
      runId: "run-null-birth",
      commandToken: `saydo-child-${GEN}`,
      generation: GEN,
      permit: permit as never,
      afterDurableOwner: () => {
        order.push("durable");
      }
    });
    expect(JSON.parse(readFileSync(path, "utf8")).processStart).toBeNull();
    await lease.establish();
    expect(JSON.parse(readFileSync(path, "utf8")).processStart).toBe("birth-from-probe");
    expect(order[0]).toBe("durable");
    expect(order[1]).toBe("permit:1");
  });

  it("POSIX birth mismatch 必须拒杀，不得 SIGKILL successor", () => {
    const killed: NodeJS.Signals[] = [];
    const jobName = formatSayDoJobName("Local", "owner", "run", GEN);
    setRuntimeChildTestHooks({
      hostKind: () => "linux",
      processBirth: () => "birth-successor",
      groupState: () => "alive",
      killProcess: (_pid, signal) => {
        killed.push(signal);
      }
    });
    installRuntimeJobForTests(88022, { name: jobName, handle: null }, {
      id: GEN,
      processStart: "birth-captured",
      runId: "run",
      ownerInstanceId: "owner",
      jobName
    });
    expect(() => signalRuntimeChildTree(88022, "SIGKILL")).toThrow(/birth mismatch/u);
    expect(killed).toEqual([]);
    expect(runtimeChildLifecycleError()).toBeInstanceOf(ProcessGroupLifecycleError);
    harvestRuntimeLeak();
  });

  it("wait unknown/timeout 不得伪造 exit，不得关闭权威 HANDLE", async () => {
    home();
    let closed = 0;
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const extra = new PassThrough();
    const owned: OwnedWindowsProcess = {
      pid: 42424,
      processHandle: { id: "process-handle" },
      threadHandle: { id: "thread-handle" },
      stdioFds: { stdin: 3, stdout: 4, stderr: 5, extra: 6 },
      stdin: stdin as unknown as OwnedWindowsProcess["stdin"],
      stdout: stdout as unknown as OwnedWindowsProcess["stdout"],
      stderr: stderr as unknown as OwnedWindowsProcess["stderr"],
      extra: extra as unknown as OwnedWindowsProcess["extra"],
      resume() {},
      terminateFromHandle() {},
      disposeStdio() {},
      closeProcessHandle() {
        closed += 1;
      },
      waitForExit: () => "unknown",
      readExitCode: () => "live"
    };
    setRuntimeChildTestHooks({ closeDeadlineMs: 0 });
    const child = childFromOwnedWindowsForTests(owned);
    const exits: unknown[] = [];
    const closes: unknown[] = [];
    child.on("exit", (...args: unknown[]) => {
      exits.push(args);
    });
    child.on("close", (...args: unknown[]) => {
      closes.push(args);
    });
    child.on("error", () => undefined);
    await vi.waitFor(() => {
      expect(runtimeChildLifecycleError()).toBeInstanceOf(ProcessGroupLifecycleError);
    });
    expect(exits).toEqual([]);
    expect(closes).toEqual([]);
    expect(closed).toBe(0);
    expect(child.exitCode).toBeNull();
    stdin.destroy();
    stdout.destroy();
    stderr.destroy();
    extra.destroy();
    harvestRuntimeLeak();
  });

  // 回归锚:健康运行的子进程不得因存活时长被判死。
  // `waitForExit(0)` 的 "timeout" 是零超时 WaitForSingleObject 对未 signaled 句柄的正常返回,
  // 一旦对它套用从 spawn 起算的 deadline,任何长驻 Tier1 agent 都会被 emit("error") ->
  // executor beginFinish(127) -> hardKill -> TerminateJobObject 连同整个 Job 杀光。
  // 上面那条测试名写着 "unknown/timeout" 但 stub 只返回 "unknown",健康路径此前无覆盖。
  it("wait 持续 timeout(进程健康)时即使超过 deadline 也不得 error/exit,真正退出后才收口", async () => {
    home();
    let closed = 0;
    let exitReady = false;
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const extra = new PassThrough();
    const owned: OwnedWindowsProcess = {
      pid: 42425,
      processHandle: { id: "process-handle" },
      threadHandle: { id: "thread-handle" },
      stdioFds: { stdin: 3, stdout: 4, stderr: 5, extra: 6 },
      stdin: stdin as unknown as OwnedWindowsProcess["stdin"],
      stdout: stdout as unknown as OwnedWindowsProcess["stdout"],
      stderr: stderr as unknown as OwnedWindowsProcess["stderr"],
      extra: extra as unknown as OwnedWindowsProcess["extra"],
      resume() {},
      terminateFromHandle() {},
      disposeStdio() {},
      closeProcessHandle() {
        closed += 1;
      },
      // 健康运行:未 signaled -> "timeout";退出后 -> "signaled" + 真实退出码。
      waitForExit: () => (exitReady ? "signaled" : "timeout"),
      readExitCode: () => (exitReady ? 0 : "live")
    };
    // deadline 设为 0:修复前第一次 poll 就会 boundedOut 并 finishUnknown。
    setRuntimeChildTestHooks({ closeDeadlineMs: 0 });
    const child = childFromOwnedWindowsForTests(owned);
    const exits: unknown[] = [];
    const errors: unknown[] = [];
    child.on("exit", (...args: unknown[]) => {
      exits.push(args);
    });
    child.on("error", (err: unknown) => {
      errors.push(err);
    });

    // 跨过 deadline 的多轮 poll(每轮 20ms)后,健康进程仍不得产生任何终态。
    await new Promise((resolveWait) => setTimeout(resolveWait, 150));
    expect(errors).toEqual([]);
    expect(exits).toEqual([]);
    expect(child.exitCode).toBeNull();
    expect(runtimeChildLifecycleError()).toBeNull();

    // 真正退出后才正常收口。
    exitReady = true;
    await vi.waitFor(() => {
      expect(exits.length).toBe(1);
    });
    expect(errors).toEqual([]);
    expect(child.exitCode).toBe(0);
    expect(closed).toBe(0);
    stdin.destroy();
    stdout.destroy();
    stderr.destroy();
    extra.destroy();
    // 本例走的是干净路径:无 lifecycle 污染可收割,故不调 harvestRuntimeLeak——
    // afterEach 的 resetRuntimeChildLifecycleForTests() 已负责收尾。
  });

  // 回归锚:句柄已 signaled 之后读到 STILL_ACTIVE(259) 必须按真实退出码收口。
  // GetExitCodeProcess 把 259 无条件映射为 "live";若在 signaled 之后仍解释为
  // "仍在运行",poll 会每 20ms 永久续期,exit/close 永不发出,
  // lease / process HANDLE / Job / owner 记录全部无法释放。
  it("signaled 后 readExitCode 报 live(259) 按退出码 259 收口,不得永久续期", async () => {
    home();
    let closed = 0;
    let polls = 0;
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const extra = new PassThrough();
    const owned: OwnedWindowsProcess = {
      pid: 42426,
      processHandle: { id: "process-handle" },
      threadHandle: { id: "thread-handle" },
      stdioFds: { stdin: 3, stdout: 4, stderr: 5, extra: 6 },
      stdin: stdin as unknown as OwnedWindowsProcess["stdin"],
      stdout: stdout as unknown as OwnedWindowsProcess["stdout"],
      stderr: stderr as unknown as OwnedWindowsProcess["stderr"],
      extra: extra as unknown as OwnedWindowsProcess["extra"],
      resume() {},
      terminateFromHandle() {},
      disposeStdio() {},
      closeProcessHandle() {
        closed += 1;
      },
      // 进程已终止（句柄 signaled），但退出码恰好就是 259。
      waitForExit: () => "signaled",
      readExitCode: () => {
        polls += 1;
        return "live";
      }
    };
    setRuntimeChildTestHooks({ closeDeadlineMs: 0 });
    const child = childFromOwnedWindowsForTests(owned);
    const exits: unknown[] = [];
    const errors: unknown[] = [];
    child.on("exit", (...args: unknown[]) => {
      exits.push(args);
    });
    child.on("error", (err: unknown) => {
      errors.push(err);
    });

    await vi.waitFor(() => {
      expect(exits.length).toBe(1);
    });
    expect(child.exitCode).toBe(259);
    expect(errors).toEqual([]);
    // 不得反复轮询:一次读出 259 即收口。
    expect(polls).toBe(1);
    expect(runtimeChildLifecycleError()).toBeNull();
    expect(closed).toBe(0);
    stdin.destroy();
    stdout.destroy();
    stderr.destroy();
    extra.destroy();
  });

  // 回归锚:transient unknown 必须可自愈。contamination 是全局且不可逆的——
  // 一旦落下,此后所有 runtime spawn 都被拒绝直到 daemon 重启。若在首次 unknown 就污染,
  // unknown -> timeout -> exit 0 这种读数抖动会永久拖垮运行时,
  // 「有界重试」就只是推迟 child error,并没有真的给出恢复窗口。
  it("unknown 在重试窗内恢复为正常读数时不得污染,最终按真实退出码收口", async () => {
    home();
    let closed = 0;
    let phase = 0;
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const extra = new PassThrough();
    const owned: OwnedWindowsProcess = {
      pid: 42427,
      processHandle: { id: "process-handle" },
      threadHandle: { id: "thread-handle" },
      stdioFds: { stdin: 3, stdout: 4, stderr: 5, extra: 6 },
      stdin: stdin as unknown as OwnedWindowsProcess["stdin"],
      stdout: stdout as unknown as OwnedWindowsProcess["stdout"],
      stderr: stderr as unknown as OwnedWindowsProcess["stderr"],
      extra: extra as unknown as OwnedWindowsProcess["extra"],
      resume() {},
      terminateFromHandle() {},
      disposeStdio() {},
      closeProcessHandle() {
        closed += 1;
      },
      // 抖动一次 unknown -> 恢复为健康 timeout -> 真实退出。
      waitForExit: () => {
        phase += 1;
        if (phase <= 2) return "unknown";
        if (phase <= 5) return "timeout";
        return "signaled";
      },
      readExitCode: () => (phase > 5 ? 0 : "live")
    };
    // 预算足够大,保证抖动发生在重试窗内而非窗外。
    setRuntimeChildTestHooks({ closeDeadlineMs: 10_000 });
    const child = childFromOwnedWindowsForTests(owned);
    const exits: unknown[] = [];
    const errors: unknown[] = [];
    child.on("exit", (...args: unknown[]) => {
      exits.push(args);
    });
    child.on("error", (err: unknown) => {
      errors.push(err);
    });

    await vi.waitFor(() => {
      expect(exits.length).toBe(1);
    });
    expect(child.exitCode).toBe(0);
    expect(errors).toEqual([]);
    // 关键:抖动过后运行时仍然干净,后续 spawn 不应被拒绝。
    expect(runtimeChildLifecycleError()).toBeNull();
    expect(closed).toBe(0);
    stdin.destroy();
    stdout.destroy();
    stderr.destroy();
    extra.destroy();
  });

  function ownedWindowsStub(pid: number): {
    owned: OwnedWindowsProcess;
    stdout: PassThrough;
    stderr: PassThrough;
    dispose: () => void;
  } {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const extra = new PassThrough();
    const owned: OwnedWindowsProcess = {
      pid,
      processHandle: { id: "process-handle" },
      threadHandle: { id: "thread-handle" },
      stdioFds: { stdin: 3, stdout: 4, stderr: 5, extra: 6 },
      stdin: stdin as unknown as OwnedWindowsProcess["stdin"],
      stdout: stdout as unknown as OwnedWindowsProcess["stdout"],
      stderr: stderr as unknown as OwnedWindowsProcess["stderr"],
      extra: extra as unknown as OwnedWindowsProcess["extra"],
      resume() {},
      terminateFromHandle() {},
      disposeStdio() {},
      closeProcessHandle() {},
      waitForExit: () => "signaled",
      readExitCode: () => 0
    };
    return {
      owned,
      stdout,
      stderr,
      dispose() {
        stdin.destroy();
        stdout.destroy();
        stderr.destroy();
        extra.destroy();
      }
    };
  }

  it("owned Windows 流把 EOF/EPIPE 收成 end，error 不外溢", async () => {
    const stub = ownedWindowsStub(42426);
    try {
      const child = childFromOwnedWindowsForTests(stub.owned);
      const errors: unknown[] = [];
      const chunks: string[] = [];
      const stdoutEnded = once(child.stdout, "end");
      const stderrEnded = once(child.stderr, "end");
      child.stdout.on("error", (err: unknown) => errors.push(err));
      child.stderr.on("error", (err: unknown) => errors.push(err));
      child.stderr.resume();
      child.stdout.on("data", (chunk: Buffer | string) => {
        chunks.push(String(chunk));
      });
      stub.stdout.write("fixture-out");
      stub.stdout.emit("error", Object.assign(new Error("EOF"), { code: "EOF" }));
      stub.stderr.emit("error", Object.assign(new Error("EPIPE"), { code: "EPIPE" }));
      await stdoutEnded;
      await stderrEnded;
      expect(chunks.join("")).toBe("fixture-out");
      expect(errors).toEqual([]);
    } finally {
      stub.dispose();
    }
  });

  it("owned Windows 流的 EIO 仍外溢", async () => {
    const stub = ownedWindowsStub(42427);
    try {
      const child = childFromOwnedWindowsForTests(stub.owned);
      const pending = once(child.stdout, "error");
      stub.stdout.emit("error", Object.assign(new Error("EIO"), { code: "EIO" }));
      const [err] = await pending;
      expect((err as NodeJS.ErrnoException).code).toBe("EIO");
    } finally {
      stub.dispose();
    }
  });

  it("recoverPriorGenerationRuntimeOwners 在 aborted 时必须立刻停止", async () => {
    const root = home();
    const path = join(root, "runtime", "children", "9.json");
    mkdirSync(join(root, "runtime", "children"), { recursive: true });
    writeFileSync(path, JSON.stringify(completeRuntimeOwner({
      pid: 9,
      processStart: "birth",
      ownerPid: 2,
      ownerInstanceId: "prior-owner",
      runId: "run-prior",
      generation: GEN
    })));
    const signal = AbortSignal.abort();
    await expect(recoverPriorGenerationRuntimeOwners(root, {
      ownerPid: process.pid,
      ownerInstanceId: "current-owner"
    }, { signal })).rejects.toThrow(/runtime recover aborted/u);
  });

  it("recoverPriorGenerationRuntimeOwners 在生产 await 之后 abort 必须停在 delete 前", async () => {
    const root = home();
    const path = join(root, "runtime", "children", "999999999.json");
    mkdirSync(join(root, "runtime", "children"), { recursive: true });
    writeFileSync(path, JSON.stringify(completeRuntimeOwner({
      pid: 999999999,
      processStart: "birth",
      ownerPid: 2,
      ownerInstanceId: "prior-owner",
      runId: "run-prior-await",
      generation: GEN
    })));
    setKillOwnedTreeTestHooks({
      processBirth: () => "birth",
      processAlive: () => false,
      groupAlive: () => false
    });
    const signal = new AbortController();
    try {
      await expect(recoverPriorGenerationRuntimeOwners(root, {
        ownerPid: process.pid,
        ownerInstanceId: "current-owner"
      }, {
        signal: signal.signal,
        afterKillBeforeDelete: () => {
          signal.abort();
        }
      })).rejects.toThrow(/runtime recover aborted/u);
      expect(existsSync(path)).toBe(true);
    } finally {
      setKillOwnedTreeTestHooks(null);
    }
  });

  it("prior-owner reaper 的 CAS/unlink 必须走 HOME boundary：持锁时不得删", async () => {
    const root = home();
    const path = join(root, "runtime", "children", "9.json");
    mkdirSync(join(root, "runtime", "children"), { recursive: true });
    writeFileSync(path, JSON.stringify(completeRuntimeOwner({
      pid: 9,
      processStart: "birth",
      ownerPid: 2,
      ownerInstanceId: "prior-owner",
      runId: "run-prior-lock",
      generation: GEN
    })));
    setKillOwnedTreeTestHooks({
      processBirth: () => "birth",
      processAlive: () => false,
      groupAlive: () => false
    });
    const holdAbort = new AbortController();
    const pending = recoverPriorGenerationRuntimeOwners(root, {
      ownerPid: process.pid,
      ownerInstanceId: "current-owner"
    }, {
      afterKillBeforeDelete: async () => {
        void withHomeOwnerBoundary(root, () => new Promise(() => undefined), { signal: holdAbort.signal });
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    });
    await expect(pending).rejects.toThrow(/home owner lock timeout|runtime recover/u);
    expect(existsSync(path)).toBe(true);
    holdAbort.abort();
  }, 20_000);

  it("runtime lease release 必须写 durable reap audit 后才 unlink", async () => {
    const root = home();
    const lease = beginRuntimeChild(88041, process.execPath, "test", {
      registryHome: root,
      runId: "run-release-audit",
      commandToken: `saydo-child-${GEN}`,
      generation: GEN,
      processStart: "birth"
    });
    await lease.establish();
    const path = runtimeChildRecordPath(root, 88041);
    expect(existsSync(path)).toBe(true);
    setRuntimeChildTestHooks({ groupState: () => "gone" });
    await lease.release();
    expect(existsSync(path)).toBe(false);
    const audit = readFileSync(join(root, "audit", "reap.jsonl"), "utf8");
    expect(audit).toContain("runtime.owner_released");
    expect(audit).toContain("run-release-audit");
  });
});
