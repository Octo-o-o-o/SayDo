import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { classifyKillProbe, PROCESS_KILL_UNKNOWN, PROCESS_PROBE_UNKNOWN, readOwnErrnoCode } from "../src/errno.js";
import { hostKind } from "../src/host.js";
import {
  assignPidToJob,
  assignProcessHandleToJob,
  closeNamedJob,
  createNamedJob,
  closeWin32Permit,
  createSuspendedOwnedWindowsProcess,
  createWin32PermitPipe,
  grantWin32Permit,
  roundtripWin32NamedPipe,
  formatSayDoJobName,
  isSayDoJobName,
  killOwnedTree,
  namedJobActiveProcessCount,
  observeVerifiedOwnedJob,
  processAlive,
  processAnchor,
  isProcessInJobFromHandles,
  processBirth,
  processBirthFromHandle,
  isWin32HandleOpen,
  lastWin32SpawnRollbackAudit,
  readOwnedProcessBirth,
  setKillOwnedTreeTestHooks,
  setWin32SpawnTestFault,
  SpawnRollbackRetainedError,
  tryLockFileExclusive,
  win32StartupLayout,
  WIN32_PROC_THREAD_ATTRIBUTE_HANDLE_LIST
} from "../src/process.js";
import { captureNativeBindFailure, nativeSync, PlatformNativeError, settleCheckedHandleWork } from "../src/win32.js";

const GEN = "01234567-89ab-cdef-0123-456789abcdef";
const spawnedPids = new Set<number>();

function trackPid(pid: number | undefined): void {
  if (typeof pid === "number" && pid > 1) spawnedPids.add(pid);
}

/** destroy() 只排队关 fd；须等 close 后才能看本 spawn 的句柄是否已释放。 */
async function waitOwnedStdioClosed(
  owned: ReturnType<typeof createSuspendedOwnedWindowsProcess>
): Promise<void> {
  const streams = [owned.stdin, owned.stdout, owned.stderr, owned.extra];
  const closed = streams.map((stream) => {
    if (stream.closed) return Promise.resolve();
    return once(stream, "close").then(
      () => undefined,
      () => undefined
    );
  });
  for (const stream of streams) {
    try {
      stream.destroy();
    } catch {
      // 已关
    }
  }
  await Promise.race([
    Promise.all(closed),
    new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error("owned stdio close timeout")), 5_000);
    })
  ]);
}

async function closeOwnedWindowsProcessForTests(
  owned: ReturnType<typeof createSuspendedOwnedWindowsProcess>
): Promise<void> {
  await waitOwnedStdioClosed(owned);
  try {
    owned.closeProcessHandle();
  } catch {
    // rollback / 重复 close
  }
}

function expectRollbackReleasedTrackedResources(): void {
  const leftover = lastWin32SpawnRollbackAudit().filter(
    (item) => item.owner === "native" || item.owner === "open"
  );
  expect(leftover).toEqual([]);
}

function expectSpawnOwnedClosed(
  owned: ReturnType<typeof createSuspendedOwnedWindowsProcess>,
  processHandle: unknown,
  threadHandle: unknown
): void {
  expect(owned.stdin.destroyed).toBe(true);
  expect(owned.stdout.destroyed).toBe(true);
  expect(owned.stderr.destroyed).toBe(true);
  expect(owned.extra.destroyed).toBe(true);
  expect(isWin32HandleOpen(processHandle)).toBe(false);
  expect(isWin32HandleOpen(threadHandle)).toBe(false);
}

afterEach(() => {
  setKillOwnedTreeTestHooks(null);
  setWin32SpawnTestFault(null);
  for (const pid of spawnedPids) {
    try { process.kill(-pid, "SIGKILL"); } catch { /* 已退出 */ }
    try { process.kill(pid, "SIGKILL"); } catch { /* 已退出 */ }
  }
  spawnedPids.clear();
});

describe("process identity", () => {
  it("本进程 birth 非空且 alive", () => {
    if (hostKind() === "win32") nativeSync();
    const birth = processBirth(process.pid);
    expect(birth).toBeTruthy();
    expect(processAlive(process.pid)).toBe(true);
    expect(processBirth(process.pid)).toBe(birth);
  });

  it("killOwnedTree 仅在 birth 匹配时回收派生进程", async () => {
    if (hostKind() === "win32") nativeSync();
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      detached: hostKind() !== "win32",
      stdio: "ignore"
    });
    if (!child.pid) throw new Error("child pid missing");
    const pid = child.pid;
    trackPid(pid);
    const birth = processBirth(pid);
    expect(birth).toBeTruthy();
    if (hostKind() === "win32") {
      const ownerInstanceId = "test";
      const runId = randomUUID();
      const job = createNamedJob(formatSayDoJobName("Local", ownerInstanceId, runId, GEN));
      try {
        assignPidToJob(job, pid);
        await killOwnedTree({
          pid,
          expectedBirth: birth as string,
          jobName: job.name,
          ownerInstanceId,
          runId,
          generation: GEN
        });
      } finally {
        closeNamedJob(job);
      }
    } else {
      await killOwnedTree({ pid, expectedBirth: birth as string });
    }
    expect(processAlive(pid)).toBe(false);
  });

  it("birth 不匹配则拒绝杀", async () => {
    if (hostKind() === "win32") nativeSync();
    await expect(
      killOwnedTree({
        pid: process.pid,
        expectedBirth: "ft:0:0:1",
        ...(hostKind() === "win32"
          ? {
              jobName: formatSayDoJobName("Local", "gone", "gone-run", GEN),
              ownerInstanceId: "gone",
              runId: "gone-run",
              generation: GEN
            }
          : {})
      })
    ).rejects.toThrow(/mismatch|requires expectedBirth|unavailable/u);
    expect(processAlive(process.pid)).toBe(true);
  });

  it("job 已不存在且进程已死视为已收口", async () => {
    if (hostKind() !== "win32") return;
    nativeSync();
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      stdio: "ignore",
      windowsHide: true
    });
    if (!child.pid) throw new Error("child pid missing");
    const pid = child.pid;
    trackPid(pid);
    const birth = processBirth(pid);
    expect(birth).toBeTruthy();
    child.kill("SIGKILL");
    const deadline = Date.now() + 5_000;
    while (processAlive(pid) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(processAlive(pid)).toBe(false);
    await expect(
      killOwnedTree({
        pid,
        expectedBirth: birth as string,
        jobName: formatSayDoJobName("Local", "gone", "dead", GEN),
        ownerInstanceId: "gone",
        runId: "dead",
        generation: GEN
      })
    ).resolves.toBeUndefined();
  });
});

describe("processAnchor(POSIX 进程组锚)", () => {
  it("win32 无进程组语义返回 null;POSIX 给出 pgid 与命令行", () => {
    const anchor = processAnchor(process.pid);
    if (hostKind() === "win32") {
      expect(anchor).toBeNull();
      return;
    }
    expect(anchor).not.toBeNull();
    expect(Number.isInteger(anchor?.pgid)).toBe(true);
    expect(anchor?.command).toContain("node");
  });

  it("detached 子进程是自身组长,普通子进程不是", async () => {
    if (hostKind() === "win32") return;
    const leader = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      detached: true,
      stdio: "ignore"
    });
    const member = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      detached: false,
      stdio: "ignore"
    });
    try {
      await Promise.all([once(leader, "spawn"), once(member, "spawn")]);
      const leaderPid = leader.pid as number;
      const memberPid = member.pid as number;
      trackPid(leaderPid);
      trackPid(memberPid);
      expect(processAnchor(leaderPid)?.pgid).toBe(leaderPid);
      expect(processAnchor(memberPid)?.pgid).not.toBe(memberPid);
      expect(processAnchor(leaderPid)?.command).toContain("setInterval");
    } finally {
      try { process.kill(leader.pid as number, "SIGKILL"); } catch { /* 已退出 */ }
      try { member.kill("SIGKILL"); } catch { /* 已退出 */ }
    }
  });

  it("不存在的 pid 返回 null", () => {
    expect(processAnchor(-1)).toBeNull();
    expect(processAnchor(0)).toBeNull();
  });
});

describe("Windows Job 权威", () => {
  it.skipIf(process.platform !== "win32")("active=0 且 PID 仍活时拒绝并保留", async () => {
    nativeSync();
    const victim = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      stdio: "ignore",
      windowsHide: true
    });
    if (!victim.pid) throw new Error("victim pid missing");
    const pid = victim.pid;
    trackPid(pid);
    const birth = processBirth(pid);
    expect(birth).toBeTruthy();
    const ownerInstanceId = "empty";
    const runId = randomUUID();
    const emptyJob = createNamedJob(formatSayDoJobName("Local", ownerInstanceId, runId, GEN));
    try {
      expect(namedJobActiveProcessCount(emptyJob)).toBe(0);
      await expect(
        killOwnedTree({
          pid,
          expectedBirth: birth as string,
          jobName: emptyJob.name,
          ownerInstanceId,
          runId,
          generation: GEN
        })
      ).rejects.toThrow(/empty while process alive/u);
      expect(processAlive(pid)).toBe(true);
    } finally {
      closeNamedJob(emptyJob);
      try { victim.kill("SIGKILL"); } catch { /* 收口 */ }
    }
  });

  it.skipIf(process.platform !== "win32")("真实孙进程在 TerminateJob 后不可存活", async () => {
    nativeSync();
    const marker = `saydo-job-gc-${randomUUID()}`;
    const child = spawn(process.execPath, [
      "-e",
      "const {spawn}=require('node:child_process');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});process.stdout.write(String(c.pid));setInterval(()=>{},1000)"
    ], { stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
    if (!child.pid) throw new Error("leader pid missing");
    const ownerInstanceId = "tree";
    const runId = randomUUID();
    const job = createNamedJob(formatSayDoJobName("Local", ownerInstanceId, runId, GEN));
    try {
      assignPidToJob(job, child.pid);
      const raw = await new Promise<string>((resolve, reject) => {
        let acc = "";
        child.stdout.on("data", (chunk: Buffer) => {
          acc += chunk.toString("utf8");
          if (acc.trim().length > 0) resolve(acc.trim());
        });
        child.once("error", reject);
        setTimeout(() => reject(new Error("grandchild pid timeout")), 3_000);
      });
      const grandchildPid = Number(raw);
      trackPid(child.pid);
      trackPid(grandchildPid);
      expect(namedJobActiveProcessCount(job)).toBeGreaterThan(0);
      await killOwnedTree({
        pid: child.pid,
        expectedBirth: processBirth(child.pid) as string,
        jobName: job.name,
        ownerInstanceId,
        runId,
        generation: GEN
      });
      expect(namedJobActiveProcessCount(job)).toBe(0);
      expect(processAlive(child.pid)).toBe(false);
      expect(processAlive(grandchildPid)).toBe(false);
      expect(marker.length).toBeGreaterThan(0);
    } finally {
      try { closeNamedJob(job); } catch { /* 已关 */ }
      try { child.kill("SIGKILL"); } catch { /* 已退 */ }
    }
  });

});

describe("own-data errno 合同", () => {
  it("readOwnErrnoCode 拒 Proxy/accessor/继承，只认 own-data 字符串", () => {
    const own = new Error("x");
    Object.defineProperty(own, "code", { value: "ESRCH" });
    expect(readOwnErrnoCode(own)).toBe("ESRCH");
    expect(classifyKillProbe(own)).toBe("gone");

    const inherited = Object.create({ code: "ESRCH" }) as Error;
    Object.defineProperty(inherited, "message", { value: "SECRET" });
    expect(readOwnErrnoCode(inherited)).toBeUndefined();
    expect(classifyKillProbe(inherited)).toBe("unknown");

    const accessor = new Error("x");
    Object.defineProperty(accessor, "code", {
      get(): string {
        return "ESRCH";
      }
    });
    expect(readOwnErrnoCode(accessor)).toBeUndefined();

    let gets = 0;
    const proxy = new Proxy(own, {
      get(t, p, r) {
        gets += 1;
        return Reflect.get(t, p, r);
      }
    });
    expect(readOwnErrnoCode(proxy)).toBeUndefined();
    expect(gets).toBe(0);

    const revoked = Proxy.revocable(own, {
      get() {
        gets += 1;
        return "ESRCH";
      }
    });
    revoked.revoke();
    expect(() => readOwnErrnoCode(revoked.proxy)).not.toThrow();
    expect(readOwnErrnoCode(revoked.proxy)).toBeUndefined();
    expect(gets).toBe(0);
  });

  it("processAlive 继承 ESRCH 不得当 gone；EPERM 探测为 alive；unknown 不泄漏 SECRET", () => {
    const orig = process.kill.bind(process);
    try {
      const inherited = Object.create({ code: "ESRCH" }) as Error;
      Object.defineProperty(inherited, "message", { value: "SECRET" });
      process.kill = (() => {
        throw inherited;
      }) as typeof process.kill;
      expect(() => processAlive(4242)).toThrow(PROCESS_PROBE_UNKNOWN);
      try {
        processAlive(4242);
      } catch (err) {
        expect(String(err)).not.toContain("SECRET");
      }

      const eperm = new Error("denied");
      Object.defineProperty(eperm, "code", { value: "EPERM" });
      process.kill = (() => {
        throw eperm;
      }) as typeof process.kill;
      expect(processAlive(4242)).toBe(true);

      const esrch = new Error("gone");
      Object.defineProperty(esrch, "code", { value: "ESRCH" });
      process.kill = (() => {
        throw esrch;
      }) as typeof process.kill;
      expect(processAlive(4242)).toBe(false);

      let gets = 0;
      const proxy = new Proxy(new Error("SECRET"), {
        get(t, p, r) {
          gets += 1;
          return Reflect.get(t, p, r);
        }
      });
      process.kill = (() => {
        throw proxy;
      }) as typeof process.kill;
      expect(() => processAlive(4242)).toThrow(PROCESS_PROBE_UNKNOWN);
      expect(gets).toBe(0);
    } finally {
      process.kill = orig;
    }
  });

  it("killOwnedTree SIGKILL 的 own-data EPERM 失败且不泄漏 SECRET", async () => {
    if (hostKind() === "win32") return;
    const birth = processBirth(process.pid);
    if (!birth) return;
    const orig = process.kill.bind(process);
    const eperm = new Error("SECRET");
    Object.defineProperty(eperm, "code", { value: "EPERM" });
    try {
      process.kill = ((pid: number, signal?: NodeJS.Signals | number) => {
        if (signal === "SIGKILL") throw eperm;
        return orig(pid, signal as never);
      }) as typeof process.kill;
      await expect(
        killOwnedTree({ pid: process.pid, expectedBirth: birth })
      ).rejects.toThrow(PROCESS_KILL_UNKNOWN);
      expect(processAlive(process.pid)).toBe(true);
    } finally {
      process.kill = orig;
    }
  });

  it("captureNativeBindFailure 对 Proxy/revoked/SECRET 受控且零 trap", () => {
    const secret = new Error("SECRET");
    const branded = captureNativeBindFailure(new PlatformNativeError("native bind failed"));
    expect(branded).toBeInstanceOf(PlatformNativeError);
    expect(branded.message).toBe("native bind failed");

    let gets = 0;
    let getPrototypeOf = 0;
    const proxy = new Proxy(secret, {
      get(t, p, r) {
        gets += 1;
        return Reflect.get(t, p, r);
      },
      getPrototypeOf(t) {
        getPrototypeOf += 1;
        return Reflect.getPrototypeOf(t);
      }
    });
    const captured = captureNativeBindFailure(proxy);
    expect(captured).toBeInstanceOf(PlatformNativeError);
    expect(captured.message).toBe("native bind failed");
    expect(captured.message).not.toContain("SECRET");
    expect(gets + getPrototypeOf).toBe(0);

    const revoked = Proxy.revocable(secret, {
      get() {
        gets += 1;
        return "SECRET";
      }
    });
    revoked.revoke();
    expect(() => captureNativeBindFailure(revoked.proxy)).not.toThrow();
    const fromRevoked = captureNativeBindFailure(revoked.proxy);
    expect(fromRevoked.message).toBe("native bind failed");
    expect(fromRevoked.message).not.toContain("SECRET");
    expect(gets).toBe(0);
  });

  it("PlatformNativeError message/stack 在 brand 时刻冻结，改写不得污染后续投影", () => {
    const err = new PlatformNativeError("native bind failed");
    const snapshot = err.frozenMessage;
    try {
      err.message = "SECRET";
      err.stack = "SECRET\n    at fake";
      (err as { frozenMessage: string }).frozenMessage = "SECRET";
    } catch {
      // 冻结
    }
    expect(err.message).toBe("native bind failed");
    expect(err.frozenMessage).toBe(snapshot);
    expect(err.message).not.toContain("SECRET");
    expect(err.frozenMessage).not.toContain("SECRET");
    expect(String(err.stack ?? "")).not.toContain("SECRET");
    const projected = captureNativeBindFailure(err);
    expect(projected).not.toBe(err);
    expect(projected.message).toBe("native bind failed");
    try {
      projected.message = "SECRET";
    } catch {
      // 冻结
    }
    expect(projected.message).toBe("native bind failed");
  });

  it("settleCheckedHandleWork 任意 falsy rejection 失败且不抛原对象", () => {
    expect(settleCheckedHandleWork(() => 0, () => undefined)).toBe(0);
    expect(settleCheckedHandleWork(() => "", () => undefined)).toBe("");
    expect(settleCheckedHandleWork(() => false, () => undefined)).toBe(false);

    expect(() => settleCheckedHandleWork(() => {
      throw 0;
    }, () => undefined)).toThrow(PlatformNativeError);
    expect(() => settleCheckedHandleWork(() => {
      throw "";
    }, () => undefined)).toThrow(PlatformNativeError);
    expect(() => settleCheckedHandleWork(() => {
      throw false;
    }, () => undefined)).toThrow(PlatformNativeError);

    let closeRan = false;
    expect(() => settleCheckedHandleWork(() => {
      throw 0;
    }, () => {
      closeRan = true;
    })).toThrow(PlatformNativeError);
    expect(closeRan).toBe(true);

    const branded = new PlatformNativeError("work native");
    try {
      settleCheckedHandleWork(() => {
        throw branded;
      }, () => {
        throw new Error("SECRET");
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBe(branded);
      expect(String(err)).not.toContain("SECRET");
    }

    let gets = 0;
    const proxy = new Proxy(new Error("SECRET"), {
      get() {
        gets += 1;
        return "SECRET";
      }
    });
    expect(() => settleCheckedHandleWork(() => {
      throw proxy;
    }, () => undefined)).toThrow(PlatformNativeError);
    expect(gets).toBe(0);

    const revoked = Proxy.revocable(new Error("SECRET"), {
      get() {
        gets += 1;
        throw new TypeError("revoked");
      }
    });
    revoked.revoke();
    expect(() => settleCheckedHandleWork(() => {
      throw revoked.proxy;
    }, () => undefined)).not.toThrow(TypeError);
    expect(() => settleCheckedHandleWork(() => {
      throw revoked.proxy;
    }, () => undefined)).toThrow(PlatformNativeError);
    expect(gets).toBe(0);
  });
});

function winClaim(extra: Record<string, unknown> = {}) {
  return {
    pid: 4242,
    expectedBirth: "birth-A",
    jobName: formatSayDoJobName("Local", "owner", "run", GEN),
    ownerInstanceId: "owner",
    runId: "run",
    generation: GEN,
    ...extra
  };
}

describe("killOwnedTree identity-matched 回收", () => {
  it("jobName 只接受 SayDoJob 格式", () => {
    expect(isSayDoJobName(formatSayDoJobName("Local", "owner", "run", GEN))).toBe(true);
    expect(isSayDoJobName(formatSayDoJobName("Global", "abc", "run", GEN))).toBe(true);
    expect(isSayDoJobName("Local\\SayDoJob-owner-run")).toBe(false);
    expect(isSayDoJobName(true)).toBe(false);
    expect(isSayDoJobName(1)).toBe(false);
    expect(isSayDoJobName("x")).toBe(false);
    expect(isSayDoJobName("Local\\SayDoGone-abc")).toBe(false);
  });

  it("Windows birth mismatch 即使 Job 有成员也不 TerminateJob", async () => {
    let terminated = 0;
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      processBirth: () => "birth-B",
      jobActive: () => 2,
      jobContainsPid: () => true,
      terminateJob: () => {
        terminated += 1;
        return "terminated";
      }
    });
    await expect(killOwnedTree(winClaim())).rejects.toThrow(/mismatch/u);
    expect(terminated).toBe(0);
  });

  it("Windows birth unavailable 且 Job 有成员时 fail-closed", async () => {
    let terminated = 0;
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      processBirth: () => null,
      processAlive: () => false,
      jobActive: () => 3,
      jobContainsPid: () => true,
      terminateJob: () => {
        terminated += 1;
        return "terminated";
      }
    });
    await expect(killOwnedTree(winClaim())).rejects.toThrow(/unavailable/u);
    expect(terminated).toBe(0);
  });

  it("Windows Proxy/畸形 identity 拒绝终止", async () => {
    let terminated = 0;
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      jobActive: () => 1,
      terminateJob: () => {
        terminated += 1;
        return "terminated";
      }
    });
    const proxy = new Proxy(winClaim(), {
      get() {
        return "SECRET";
      }
    });
    await expect(killOwnedTree(proxy as never)).rejects.toThrow(/invalid/u);
    expect(terminated).toBe(0);

    const accessor = {
      pid: 4242,
      jobName: "Local\\SayDoJob-owner-run"
    };
    Object.defineProperty(accessor, "expectedBirth", {
      get(): string {
        return "SECRET";
      }
    });
    await expect(killOwnedTree(accessor as never)).rejects.toThrow(/invalid|requires expectedBirth/u);
    expect(terminated).toBe(0);
  });

  it("Windows 任意 truthy jobName 拒绝 TerminateJob", async () => {
    let terminated = 0;
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      processBirth: () => "birth-A",
      jobActive: () => 1,
      terminateJob: () => {
        terminated += 1;
        return "terminated";
      }
    });
    await expect(killOwnedTree(winClaim({ jobName: "true" }))).rejects.toThrow(/jobName invalid|claim invalid/u);
    expect(terminated).toBe(0);
  });

  it("Windows birth exact match 且 Job 可证明才 TerminateJob", async () => {
    let terminated = 0;
    let active = 2;
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      processBirth: () => "birth-A",
      processAlive: () => false,
      jobActive: () => active,
      jobContainsPid: () => true,
      terminateJob: () => {
        terminated += 1;
        active = 0;
        return "terminated";
      }
    });
    await killOwnedTree(winClaim());
    expect(terminated).toBe(1);
  });

  it("empty/missing Job + live PID 拒绝成功", async () => {
    let terminated = 0;
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      processBirth: () => "birth-A",
      processAlive: () => true,
      jobActive: () => 0,
      jobContainsPid: () => "missing",
      terminateJob: () => {
        terminated += 1;
        return "terminated";
      }
    });
    await expect(killOwnedTree(winClaim())).rejects.toThrow(/empty while process alive/u);
    expect(terminated).toBe(0);
  });

  it("PID 不属于 Job 时拒绝 TerminateJob", async () => {
    let terminated = 0;
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      processBirth: () => "birth-A",
      processAlive: () => true,
      jobActive: () => 2,
      jobContainsPid: () => false,
      terminateJob: () => {
        terminated += 1;
        return "terminated";
      }
    });
    await expect(killOwnedTree(winClaim())).rejects.toThrow(/not a job member/u);
    expect(terminated).toBe(0);
  });

  it("wrong-run Job 名与 owner/run 不一致时拒绝", async () => {
    let terminated = 0;
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      processBirth: () => "birth-A",
      jobActive: () => 1,
      jobContainsPid: () => true,
      terminateJob: () => {
        terminated += 1;
        return "terminated";
      }
    });
    await expect(killOwnedTree(winClaim({
      jobName: formatSayDoJobName("Local", "owner", "other-run", GEN)
    }))).rejects.toThrow(/jobName invalid/u);
    expect(terminated).toBe(0);
  });

  it("缺 ownerInstanceId / runId 拒绝", async () => {
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      processBirth: () => "birth-A",
      jobActive: () => 1,
      jobContainsPid: () => true,
      terminateJob: () => "terminated"
    });
    await expect(killOwnedTree({
      pid: 4242,
      expectedBirth: "birth-A",
      jobName: formatSayDoJobName("Local", "owner", "run", GEN),
      runId: "run",
      generation: GEN
    })).rejects.toThrow(/invalid|requires job identity/u);
    await expect(killOwnedTree({
      pid: 4242,
      expectedBirth: "birth-A",
      jobName: formatSayDoJobName("Local", "owner", "run", GEN),
      ownerInstanceId: "owner",
      generation: GEN
    })).rejects.toThrow(/invalid|requires job identity/u);
  });

  it("substring 碰撞的 ownerInstanceId 不能过 identity", async () => {
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      processBirth: () => "birth-A",
      jobActive: () => 1,
      jobContainsPid: () => true,
      terminateJob: () => "terminated"
    });
    await expect(killOwnedTree({
      pid: 4242,
      expectedBirth: "birth-A",
      jobName: formatSayDoJobName("Local", "owner-long", "run", GEN),
      ownerInstanceId: "owner",
      runId: "run",
      generation: GEN
    })).rejects.toThrow(/jobName invalid/u);
  });

  it("membership unknown 不得 TerminateJob 也不得报成功", async () => {
    let terminated = 0;
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      processBirth: () => "birth-A",
      processAlive: () => false,
      jobActive: () => 0,
      jobContainsPid: () => "unknown",
      terminateJob: () => {
        terminated += 1;
        return "terminated";
      }
    });
    await expect(killOwnedTree(winClaim())).rejects.toThrow(/membership unknown/u);
    expect(terminated).toBe(0);
  });

  it("TerminateJob 后 leader 仍活或 probe 未知不得报成功", async () => {
    let terminated = 0;
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      processBirth: () => "birth-A",
      processAlive: () => true,
      jobActive: () => (terminated > 0 ? 0 : 1),
      jobContainsPid: () => true,
      terminateJob: () => {
        terminated += 1;
        return "terminated";
      }
    });
    await expect(killOwnedTree(winClaim())).rejects.toThrow(/still alive after TerminateJob/u);
    expect(terminated).toBe(1);
  });

  it("missing Job + live matching birth 拒绝且不 TerminateJob", async () => {
    let terminated = 0;
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      processBirth: () => "birth-A",
      processAlive: () => true,
      jobActive: () => "missing",
      jobContainsPid: () => "missing",
      terminateJob: () => {
        terminated += 1;
        return "missing";
      }
    });
    await expect(killOwnedTree(winClaim())).rejects.toThrow(/empty while process alive/u);
    expect(terminated).toBe(0);
  });

  it("同一 handle 生命周期：openJob 只一次，query/member/terminate 用同一 handle", async () => {
    const opened: unknown[] = [];
    const used: unknown[] = [];
    const handle = { id: "job-1" };
    const proc = { id: "proc-1" };
    let killed = false;
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      ownedJobNative: {
        openJob: () => {
          opened.push(handle);
          return { handle };
        },
        openProcess: () => ({ handle: proc }),
        processBirth: () => "birth-A",
        processAlive: (h) => {
          used.push(h);
          return !killed;
        },
        queryActive: (h) => {
          used.push(h);
          return killed ? 0 : 1;
        },
        queryContainsPid: (jobHandle, processHandle) => {
          used.push(jobHandle, processHandle);
          return true;
        },
        terminateJob: (h) => {
          used.push(h);
          killed = true;
          return "terminated";
        },
        closeHandle: () => undefined
      }
    });
    await killOwnedTree(winClaim());
    expect(opened).toHaveLength(1);
    expect(used.every((item) => item === handle || item === proc)).toBe(true);
    expect(used).toContain(handle);
    expect(used).toContain(proc);
  });

  it("CreateJobObjectW ERROR_ALREADY_EXISTS 立即 fail-closed 且 close handle", () => {
    let closed = 0;
    const handle = { id: "dup" };
    setKillOwnedTreeTestHooks({
      ownedJobNative: {
        createJob: () => ({ handle, lastError: 183 }),
        closeHandle: (h) => {
          if (h === handle) closed += 1;
        }
      }
    });
    expect(() => createNamedJob(formatSayDoJobName("Local", "owner", "run", GEN))).toThrow(/already exists/u);
    expect(closed).toBe(1);
  });

  it("同名 Job 替换：第二次 open 的 handle 不得用于 terminate", async () => {
    const first = { id: "first" };
    const second = { id: "second" };
    let opens = 0;
    let killed = false;
    const terminated: unknown[] = [];
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      ownedJobNative: {
        openJob: () => {
          opens += 1;
          return { handle: opens === 1 ? first : second };
        },
        openProcess: () => ({ handle: { id: "p" } }),
        processBirth: () => "birth-A",
        processAlive: () => !killed,
        queryActive: (h) => {
          if (h !== first) return 9;
          return killed ? 0 : 1;
        },
        queryContainsPid: (h) => h === first,
        terminateJob: (h) => {
          terminated.push(h);
          killed = true;
          return "terminated";
        },
        closeHandle: () => undefined
      }
    });
    await killOwnedTree(winClaim());
    expect(opens).toBe(1);
    expect(terminated).toEqual([first]);
  });
});

describe("owner schema trap-free", () => {
  it("runtime owner 空串/相对路径/缺 token/hostile 一律 invalid", async () => {
    const { parseRuntimeOwnerRecord, parseAgentOwnerRecord, parsePendingRuntimeOwnerRecord } = await import("../src/jobIdentity.js");
    const base = {
      version: 1,
      pid: 4242,
      kind: "exec",
      binary: process.execPath,
      processStart: "birth",
      ownerPid: 2,
      ownerInstanceId: "owner",
      runId: "run",
      commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcdef",
      generation: "01234567-89ab-cdef-0123-456789abcdef",
      jobName: formatSayDoJobName("Local", "owner", "run", GEN)
    };
    expect(parseRuntimeOwnerRecord({ ...base, binary: "" }).status).toBe("invalid");
    expect(parseRuntimeOwnerRecord({ ...base, binary: "relative/bin" }).status).toBe("invalid");
    expect(parseRuntimeOwnerRecord({ ...base, binary: "node" }).status).toBe("invalid");
    expect(parseRuntimeOwnerRecord({ ...base, binary: "C:rel" }).status).toBe("invalid");
    expect(parseRuntimeOwnerRecord({ ...base, commandToken: "" }).status).toBe("invalid");
    expect(parseRuntimeOwnerRecord({ ...base, commandToken: "   " }).status).toBe("invalid");
    expect(parseRuntimeOwnerRecord({ ...base, commandToken: "token" }).status).toBe("invalid");
    expect(parseRuntimeOwnerRecord({ ...base, commandToken: "t" }).status).toBe("invalid");
    expect(parseRuntimeOwnerRecord({ ...base, commandToken: "tok" }).status).toBe("invalid");
    expect(parseRuntimeOwnerRecord({ ...base, commandToken: ` ${base.commandToken}` }).status).toBe("invalid");
    expect(parseRuntimeOwnerRecord({ ...base, commandToken: `${base.commandToken} ` }).status).toBe("invalid");
    expect(parseRuntimeOwnerRecord({ ...base, generation: "01234567-89ab-cdef-0123-456789abcde0" }).status).toBe("invalid");
    expect(parseRuntimeOwnerRecord({ ...base, processStart: null }).status).toBe("invalid");
    expect(parseRuntimeOwnerRecord({ ...base, ownerPid: 1 }).status).toBe("invalid");
    expect(parsePendingRuntimeOwnerRecord({ ...base, processStart: null }).status).toBe("valid");
    expect(parsePendingRuntimeOwnerRecord({ ...base, processStart: "birth" }).status).toBe("invalid");
    const noToken = { ...base };
    delete (noToken as { commandToken?: string }).commandToken;
    expect(parseRuntimeOwnerRecord(noToken).status).toBe("invalid");
    const accessor = { ...base };
    Object.defineProperty(accessor, "binary", { get(): string { return "SECRET"; } });
    expect(parseRuntimeOwnerRecord(accessor).status).toBe("invalid");
    const proxy = new Proxy(base, { get() { return "SECRET"; } });
    expect(parseRuntimeOwnerRecord(proxy).status).toBe("invalid");
    const revoked = Proxy.revocable(base, { get() { throw new TypeError("revoked"); } });
    revoked.revoke();
    expect(parseRuntimeOwnerRecord(revoked.proxy).status).toBe("invalid");
    expect(parseAgentOwnerRecord({ ...base, runId: "run", worktree: "/tmp/wt", binary: "" }, "run").status).toBe("invalid");
    expect(parseAgentOwnerRecord({ ...base, runId: "run", worktree: "/tmp/wt", binary: "rel" }, "run").status).toBe("invalid");
  });

  it("空 commandToken 不得让 command.includes 恒真", () => {
    setKillOwnedTreeTestHooks({
      hostKind: () => "darwin",
      processAnchor: () => ({ pgid: 4242, command: "/usr/bin/unrelated --help" }),
      processBirth: () => "birth"
    });
    expect(readOwnedProcessBirth(4242, "", "token")).toBeNull();
    expect(readOwnedProcessBirth(4242, "/usr/bin/unrelated", "")).toBeNull();
    expect(readOwnedProcessBirth(4242, "/usr/bin/unrelated", "token")).toBeNull();
  });
});

describe("atomic verified-owned-Job", () => {
  function claim() {
    return {
      jobName: formatSayDoJobName("Local", "owner", "run", GEN),
      ownerInstanceId: "owner",
      runId: "run",
      generation: GEN,
      pid: 4242,
      expectedBirth: "birth-A"
    };
  }

  it("query/close/terminate 失败与成功 drain 走同一 handle", async () => {
    const handle = { id: "job-q" };
    const proc = { id: "proc-q" };
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      ownedJobNative: {
        openJob: () => ({ handle }),
        openProcess: () => ({ handle: proc }),
        processBirth: () => "birth-A",
        processAlive: () => true,
        queryActive: () => {
          throw new Error("SECRET");
        },
        queryContainsPid: () => true,
        terminateJob: () => "terminated",
        closeHandle: () => undefined
      }
    });
    const unknown = observeVerifiedOwnedJob(claim());
    expect(unknown.kind).toBe("fail-closed");
    expect(unknown.reason).toMatch(/job query unknown/u);
    expect(unknown.reason).not.toContain("SECRET");

    let closed = 0;
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      ownedJobNative: {
        openJob: () => ({ handle }),
        openProcess: () => ({ handle: proc }),
        processBirth: () => "birth-A",
        processAlive: () => true,
        queryActive: () => 1,
        queryContainsPid: () => true,
        terminateJob: () => "unknown",
        closeHandle: () => {
          closed += 1;
        }
      }
    });
    await expect(killOwnedTree({
      pid: 4242,
      expectedBirth: "birth-A",
      jobName: formatSayDoJobName("Local", "owner", "run", GEN),
      ownerInstanceId: "owner",
      runId: "run",
      generation: GEN
    })).rejects.toThrow(/terminate unknown/u);
    expect(closed).toBe(2);

    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      ownedJobNative: {
        openJob: () => "missing",
        openProcess: () => "missing",
        processBirth: () => null,
        processAlive: () => false,
        queryActive: () => {
          throw new Error("should not query missing job");
        },
        queryContainsPid: () => "unknown",
        terminateJob: () => "terminated",
        closeHandle: () => undefined
      }
    });
    expect(observeVerifiedOwnedJob(claim()).kind).toBe("already_exited");
  });

  it("IsProcessInJob=false 不得用 PID 数组回退；leader 死且 membership 非 true 时 fail-closed", async () => {
    let terminated = 0;
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      ownedJobNative: {
        openJob: () => ({ handle: { id: "job" } }),
        openProcess: () => ({ handle: { id: "proc" } }),
        processBirth: () => "birth-A",
        processAlive: () => false,
        queryActive: () => 2,
        queryContainsPid: () => false,
        terminateJob: () => {
          terminated += 1;
          return "terminated";
        },
        closeHandle: () => undefined
      }
    });
    await expect(killOwnedTree(winClaim())).rejects.toThrow(/membership not proven|not a job member/u);
    expect(terminated).toBe(0);
  });

  it("TerminateJob 后 observe 非 already_exited 不得成功", async () => {
    let terminated = false;
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      ownedJobNative: {
        openJob: () => ({ handle: { id: "job" } }),
        openProcess: () => ({ handle: { id: "proc" } }),
        processBirth: () => "birth-A",
        processAlive: () => false,
        queryActive: () => {
          if (terminated) throw new Error("SECRET");
          return 2;
        },
        queryContainsPid: () => true,
        terminateJob: () => {
          terminated = true;
          return "terminated";
        },
        closeHandle: () => undefined
      }
    });
    await expect(killOwnedTree(winClaim())).rejects.toThrow(/query unknown|not proven drained/u);
  });

  it("仅设置 processBirth 不得切换 virtual Job seam", () => {
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      processBirth: () => "birth-A"
    });
    const observed = observeVerifiedOwnedJob({
      jobName: formatSayDoJobName("Local", "owner", "run", GEN),
      ownerInstanceId: "owner",
      runId: "run",
      generation: GEN,
      pid: 4242,
      expectedBirth: "birth-A"
    });
    expect(observed.kind).toBe("fail-closed");
  });

  it.skipIf(process.platform !== "win32")("Windows 真机：CreateJobObjectW 后 ERROR_ALREADY_EXISTS 且无 partial hook", () => {
    nativeSync();
    const name = formatSayDoJobName("Local", "native", "exists", GEN);
    const first = createNamedJob(name);
    try {
      expect(() => createNamedJob(name)).toThrow(/already exists/u);
    } finally {
      closeNamedJob(first);
    }
  });

  it.skipIf(process.platform !== "win32")("Windows 真机：同 handle CreateProcessW assign/birth/membership 且 close 恰好一次", () => {
    nativeSync();
    const ownerInstanceId = "native";
    const runId = randomUUID();
    const job = createNamedJob(formatSayDoJobName("Local", ownerInstanceId, runId, GEN));
    const owned = createSuspendedOwnedWindowsProcess({
      file: process.execPath,
      args: ["-e", "setTimeout(() => {}, 200)"]
    });
    try {
      assignProcessHandleToJob(job, owned.processHandle);
      expect(isProcessInJobFromHandles(owned.processHandle, job.handle)).toBe(true);
      const birth = processBirthFromHandle(owned.processHandle, owned.pid);
      expect(typeof birth).toBe("string");
      expect(birth?.length).toBeGreaterThan(0);
      owned.resume();
      owned.terminateFromHandle();
      owned.closeProcessHandle();
      expect(() => owned.closeProcessHandle()).toThrow(/closed twice/u);
    } finally {
      closeNamedJob(job);
    }
  });

  it("close handle 失败不得假装 drain", () => {
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      ownedJobNative: {
        openJob: () => ({ handle: { id: "j" } }),
        openProcess: () => ({ handle: { id: "p" } }),
        processBirth: () => null,
        processAlive: () => false,
        queryActive: () => 0,
        queryContainsPid: () => "missing",
        terminateJob: () => "missing",
        closeHandle: () => {
          throw new Error("SECRET");
        }
      }
    });
    expect(() => observeVerifiedOwnedJob(claim())).toThrow(/close unknown/u);
  });
});

describe("Windows 生产适配层", () => {
  it.skipIf(process.platform !== "win32")("LockFileEx 两进程互斥且崩溃后释放", async () => {
    nativeSync();
    const dir = mkdtempSync(join(tmpdir(), "saydo-win-lock-proc-"));
    const lock = join(dir, "owner.lock");
    writeFileSync(lock, "");
    const holdMarker = join(dir, "holding.marker");
    const waitMarker = join(dir, "wait.marker");
    const tsx = fileURLToPath(new URL("../../daemon/node_modules/tsx/dist/cli.mjs", import.meta.url));
    const worker = fileURLToPath(new URL("./fixtures/home-lock-worker.mjs", import.meta.url));
    const processModule = fileURLToPath(new URL("../src/process.ts", import.meta.url));
    const lockModule = fileURLToPath(new URL("../src/homeLock.ts", import.meta.url));
    const holder = spawn(process.execPath, [tsx, worker], {
      env: {
        ...process.env,
        SAYDO_LOCK_HOME: dir,
        SAYDO_LOCK_FILE: lock,
        SAYDO_LOCK_ROLE: "exclusive-hold",
        SAYDO_LOCK_MARKER: holdMarker,
        SAYDO_LOCK_MODULE: lockModule,
        SAYDO_PROCESS_MODULE: processModule
      },
      stdio: "ignore"
    });
    const started = Date.now();
    while (!existsSync(holdMarker) && Date.now() - started < 8_000) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(existsSync(holdMarker)).toBe(true);
    const waiter = spawn(process.execPath, [tsx, worker], {
      env: {
        ...process.env,
        SAYDO_LOCK_HOME: dir,
        SAYDO_LOCK_FILE: lock,
        SAYDO_LOCK_ROLE: "exclusive-wait",
        SAYDO_LOCK_MARKER: waitMarker,
        SAYDO_LOCK_MODULE: lockModule,
        SAYDO_PROCESS_MODULE: processModule
      },
      stdio: "ignore"
    });
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(existsSync(waitMarker) ? readFileSync(waitMarker, "utf8") : "busy").toBe("busy");
    holder.kill("SIGKILL");
    await new Promise<void>((resolve) => {
      if (holder.exitCode !== null) resolve();
      else holder.once("exit", () => resolve());
    });
    const waiterExit = await new Promise<number>((resolve) => {
      if (waiter.exitCode !== null) resolve(waiter.exitCode);
      else waiter.once("exit", (code) => resolve(code ?? 1));
    });
    expect(waiterExit).toBe(0);
    const after = spawn(process.execPath, [tsx, worker], {
      env: {
        ...process.env,
        SAYDO_LOCK_HOME: dir,
        SAYDO_LOCK_FILE: lock,
        SAYDO_LOCK_ROLE: "exclusive-wait",
        SAYDO_LOCK_MARKER: join(dir, "after.marker"),
        SAYDO_LOCK_MODULE: lockModule,
        SAYDO_PROCESS_MODULE: processModule
      },
      stdio: "ignore"
    });
    const afterCode = await new Promise<number>((resolve, reject) => {
      after.once("exit", (code) => resolve(code ?? 1));
      setTimeout(() => reject(new Error("win lock after timeout")), 8_000);
    });
    expect(afterCode).toBe(0);
    expect(readFileSync(join(dir, "after.marker"), "utf8")).toBe("acquired");
  }, 20_000);

  it.skipIf(process.platform !== "win32")("STARTUPINFOEXW/PROCESS_INFORMATION ABI 与 HANDLE_LIST 接到生产布局", () => {
    nativeSync();
    const layout = win32StartupLayout();
    expect(process.arch === "x64" || process.arch === "arm64").toBe(true);
    expect(layout.pointerSize).toBe(8);
    expect(layout.startupinfo).toBe(104);
    expect(layout.startupinfoex).toBe(112);
    expect(layout.processInformation).toBe(24);
    expect(layout.lpAttributeListOffset).toBe(104);
    expect(layout.processIdOffset).toBe(16);
    expect(layout.handleListAttribute).toBe(WIN32_PROC_THREAD_ATTRIBUTE_HANDLE_LIST);
    expect(WIN32_PROC_THREAD_ATTRIBUTE_HANDLE_LIST).toBe(0x00020002);
  });

  it.skipIf(process.platform !== "win32")("CreateProcessW 各故障点 rollback：创建前无残留，resume 后进程必须被证死", async () => {
    nativeSync();
    for (const point of [
      "create-pipe",
      "set-handle-information",
      "init-attr-list",
      "update-attr",
      "create-process"
    ] as const) {
      setWin32SpawnTestFault(point);
      try {
        createSuspendedOwnedWindowsProcess({
          file: process.execPath,
          args: ["-e", "0"]
        });
        throw new Error(`expected spawn fault:${point}`);
      } catch (err) {
        expect(err).toBeInstanceOf(PlatformNativeError);
        expect(err instanceof SpawnRollbackRetainedError).toBe(false);
        expect(String(err)).toContain(`spawn fault:${point}`);
      }
      expectRollbackReleasedTrackedResources();
    }
    for (const point of ["after-create-before-close-child", "wrap-stdio"] as const) {
      setWin32SpawnTestFault(point);
      try {
        createSuspendedOwnedWindowsProcess({
          file: process.execPath,
          args: ["-e", "0"]
        });
        throw new Error(`expected spawn fault:${point}`);
      } catch (err) {
        expect(err).toBeInstanceOf(PlatformNativeError);
        expect(err instanceof SpawnRollbackRetainedError).toBe(false);
        expect(String(err)).toContain(`spawn fault:${point}`);
      }
      expectRollbackReleasedTrackedResources();
    }
    setWin32SpawnTestFault("resume-thread");
    const owned = createSuspendedOwnedWindowsProcess({
      file: process.execPath,
      args: ["-e", "0"]
    });
    const processHandle = owned.processHandle;
    const threadHandle = owned.threadHandle;
    try {
      owned.resume();
      throw new Error("expected spawn fault:resume-thread");
    } catch (err) {
      expect(err).toBeInstanceOf(PlatformNativeError);
      expect(err instanceof SpawnRollbackRetainedError).toBe(false);
      expect(String(err)).toContain("spawn fault:resume-thread");
    }
    await waitOwnedStdioClosed(owned);
    expectSpawnOwnedClosed(owned, processHandle, threadHandle);
    expectRollbackReleasedTrackedResources();
  });

  it.skipIf(process.platform !== "win32")("CreateProcessW 成功路径：close 后本 spawn 的 HANDLE/fd 均已关闭且无 suspended 残留", async () => {
    nativeSync();
    const owned = createSuspendedOwnedWindowsProcess({
      file: process.execPath,
      args: ["-e", "process.exit(0)"]
    });
    const processHandle = owned.processHandle;
    const threadHandle = owned.threadHandle;
    try {
      expect(owned.readExitCode()).toBe("live");
      expect(isWin32HandleOpen(processHandle)).toBe(true);
      expect(isWin32HandleOpen(threadHandle)).toBe(true);
      owned.resume();
      expect(isWin32HandleOpen(threadHandle)).toBe(false);
      expect(owned.waitForExit(8_000)).toBe("signaled");
      const exitCode = owned.readExitCode();
      expect(typeof exitCode).toBe("number");
    } finally {
      await closeOwnedWindowsProcessForTests(owned);
    }
    expectSpawnOwnedClosed(owned, processHandle, threadHandle);
    expect(() => owned.closeProcessHandle()).toThrow(/closed twice/u);
  });

  it.skipIf(process.platform !== "win32")("命名管道往返不经 CreateProcessW", async () => {
    nativeSync();
    await expect(roundtripWin32NamedPipe("PIPE-OK-12345")).resolves.toBe("PIPE-OK-12345");
  });

  it.skipIf(process.platform !== "win32")("CreateProcessW stdout 可读：node -e 写出 RAW-OK-12345 且无 EBADF", async () => {
    nativeSync();
    const owned = createSuspendedOwnedWindowsProcess({
      file: process.execPath,
      args: ["-e", "process.stdout.write('RAW-OK-12345\\n');process.exit(0);"]
    });
    const processHandle = owned.processHandle;
    const threadHandle = owned.threadHandle;
    let out = "";
    const errors: string[] = [];
    owned.stdout.on("data", (chunk: string | Buffer) => {
      out += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    });
    owned.stdout.on("error", (err: NodeJS.ErrnoException) => {
      errors.push(String(err.code ?? err.message));
    });
    try {
      owned.resume();
      const deadline = Date.now() + 8_000;
      while (owned.readExitCode() === "live" && Date.now() < deadline) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 20);
        });
      }
      expect(owned.readExitCode()).not.toBe("live");
      await new Promise<void>((resolve) => {
        if (out.length > 0 || owned.stdout.readableEnded || owned.stdout.destroyed) {
          resolve();
          return;
        }
        const done = (): void => resolve();
        owned.stdout.once("end", done);
        owned.stdout.once("close", done);
        setTimeout(done, 1_000);
      });
      expect(out).toContain("RAW-OK-12345");
      expect(errors).not.toContain("EBADF");
    } finally {
      await closeOwnedWindowsProcessForTests(owned);
    }
    expectSpawnOwnedClosed(owned, processHandle, threadHandle);
  });

  it.skipIf(process.platform !== "win32")("named permit pipe: 客户端读到 grant 的一字节", async () => {
    nativeSync();
    const generation = randomUUID();
    const pipe = createWin32PermitPipe(generation);
    const child = spawn(process.execPath, [
      "-e",
      "const fs=require('fs');const fd=fs.openSync(process.env.SAYDO_PERMIT_PIPE,'r');const b=Buffer.alloc(8);const n=fs.readSync(fd,b,0,8,null);process.stdout.write('got='+String(n)+','+b.slice(0,Math.max(0,n)).toString('utf8'));"
    ], {
      env: { ...process.env, SAYDO_PERMIT_PIPE: pipe.name },
      windowsHide: true
    });
    trackPid(child.pid);
    let out = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      out += chunk.toString("utf8");
    });
    try {
      await grantWin32Permit(pipe.handle);
      const code = await new Promise<number>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("permit client exit timeout")), 8_000);
        child.once("exit", (exitCode) => {
          clearTimeout(timer);
          resolve(exitCode ?? 1);
        });
      });
      expect(code).toBe(0);
      expect(out).toContain("got=1,1");
    } finally {
      closeWin32Permit(pipe.handle);
      if (child.exitCode == null && child.pid) {
        try {
          child.kill();
        } catch {
          // 已退
        }
      }
    }
  });

  it.skipIf(process.platform !== "win32")("KILL_ON_JOB_CLOSE：关 Job 即证死子进程，无需 TerminateProcess", async () => {
    nativeSync();
    const ownerInstanceId = "kill-close";
    const runId = randomUUID();
    const job = createNamedJob(formatSayDoJobName("Local", ownerInstanceId, runId, GEN));
    const owned = createSuspendedOwnedWindowsProcess({
      file: process.execPath,
      args: ["-e", "setInterval(() => {}, 1000)"]
    });
    try {
      assignProcessHandleToJob(job, owned.processHandle);
      expect(isProcessInJobFromHandles(owned.processHandle, job.handle)).toBe(true);
      owned.resume();
      expect(owned.readExitCode()).toBe("live");
      closeNamedJob(job);
      expect(owned.waitForExit(8_000)).toBe("signaled");
      expect(owned.readExitCode()).not.toBe("live");
    } finally {
      try { owned.terminateFromHandle(); } catch { /* 已死 */ }
      try { owned.stdin.destroy(); } catch { /* 已关 */ }
      try { owned.stdout.destroy(); } catch { /* 已关 */ }
      try { owned.stderr.destroy(); } catch { /* 已关 */ }
      try { owned.extra.destroy(); } catch { /* 已关 */ }
      try { owned.closeProcessHandle(); } catch { /* 已关 */ }
    }
  });
});
