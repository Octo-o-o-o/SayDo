import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hostKind } from "../src/host.js";
import {
  assignPidToJob,
  closeNamedJob,
  createNamedJob,
  killOwnedTree,
  processAlive,
  processAnchor,
  processBirth
} from "../src/process.js";
import { nativeSync } from "../src/win32.js";

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
    const birth = processBirth(pid);
    expect(birth).toBeTruthy();
    if (hostKind() === "win32") {
      const job = createNamedJob(`Local\\SayDoTest-${randomUUID()}`);
      try {
        assignPidToJob(job, pid);
        await killOwnedTree({ pid, expectedBirth: birth as string, jobName: job.name });
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
        ...(hostKind() === "win32" ? { jobName: `Local\\SayDoTest-${randomUUID()}` } : {})
      })
    ).rejects.toThrow(/mismatch|requires expectedBirth/u);
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
    const birth = processBirth(pid);
    expect(birth).toBeTruthy();
    child.kill("SIGKILL");
    const deadline = Date.now() + 5_000;
    while (processAlive(pid) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(processAlive(pid)).toBe(false);
    await expect(
      killOwnedTree({ pid, expectedBirth: birth as string, jobName: `Local\\SayDoGone-${randomUUID()}` })
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
