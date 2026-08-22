import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hostKind } from "../src/host.js";
import {
  assignPidToJob,
  closeNamedJob,
  createNamedJob,
  killOwnedTree,
  processAlive,
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
