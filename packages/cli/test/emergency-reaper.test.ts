import { spawn, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assignPidToJob,
  closeNamedJob,
  createNamedJob,
  nativeSync,
  processAlive,
  processBirth,
  type NamedJob
} from "@saydo/platform";
import { reapOwnedAgentGroups } from "../src/emergencyReaper.js";

const homes = new Set<string>();
const pids = new Set<number>();
const jobs = new Set<NamedJob>();

afterEach(() => {
  for (const job of jobs) {
    try { closeNamedJob(job); } catch { /* 已关 */ }
  }
  jobs.clear();
  for (const pid of pids) {
    try {
      if (process.platform === "win32") process.kill(pid);
      else process.kill(-pid, "SIGKILL");
    } catch { /* 已退出 */ }
  }
  pids.clear();
  for (const home of homes) rmSync(home, { recursive: true, force: true });
  homes.clear();
});

function startIdentity(pid: number, binary = process.execPath, commandToken?: string): string {
  const birth = processBirth(pid);
  if (birth) return birth;
  try {
    return execFileSync("ps", ["-o", "lstart=", "-p", String(pid)], { encoding: "utf8" }).trim();
  } catch {
    const pattern = commandToken && commandToken.length >= 8 ? commandToken : binary;
    const raw = execFileSync("pgrep", ["-lf", pattern], { encoding: "utf8" });
    const line = raw
      .split("\n")
      .map((item) => item.trim())
      .find((item) => item === String(pid) || item.startsWith(`${String(pid)} `));
    if (!line) throw new Error("startIdentity unavailable");
    return `pgrep1:${line.slice(0, 240)}`;
  }
}

function attachJob(pid: number, token: string = randomUUID()): NamedJob | undefined {
  if (process.platform !== "win32") return undefined;
  nativeSync();
  const job = createNamedJob(`Local\\SayDoTest-${token}`);
  assignPidToJob(job, pid);
  jobs.add(job);
  return job;
}

function ownerJobFields(job: NamedJob | undefined, commandToken?: string): { jobName?: string; commandToken?: string } {
  return {
    ...(job ? { jobName: job.name } : {}),
    ...(commandToken ? { commandToken } : {})
  };
}

describe("CLI emergency agent reaper", () => {
  it("只按匹配的 pid/binary/birth identity 回收进程组", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cli-reaper-"));
    homes.add(home);
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      detached: true,
      stdio: "ignore"
    });
    if (!child.pid) throw new Error("测试 agent 未获得 pid");
    const childPid = child.pid;
    pids.add(childPid);
    await once(child, "spawn");
    const job = attachJob(childPid);
    const runId = "run_test";
    const runDir = join(home, "tier1", "runs", runId);
    mkdirSync(runDir, { recursive: true });
    writeFileSync(join(runDir, "agent.pid"), String(childPid));
    writeFileSync(join(runDir, "agent-owner.json"), JSON.stringify({
      version: 1,
      runId,
      pid: childPid,
      binary: process.execPath,
      worktree: join(home, "worktree"),
      processStart: startIdentity(childPid),
      ownerPid: 7001,
      ownerInstanceId: "instance-a",
      ...ownerJobFields(job)
    }));

    const closed = once(child, "close");
    await expect(reapOwnedAgentGroups(home, { pid: 7001, instanceId: "instance-a" })).resolves.toBe(1);
    await closed;
    expect(() => process.kill(childPid, 0)).toThrow();
    pids.delete(childPid);
  });

  it("只回收本次 daemon generation，后来接管 HOME 的 owner 不受影响", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cli-reaper-"));
    homes.add(home);
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      detached: true,
      stdio: "ignore"
    });
    if (!child.pid) throw new Error("测试 agent 未获得 pid");
    const childPid = child.pid;
    pids.add(childPid);
    await once(child, "spawn");
    const job = attachJob(childPid);
    const runId = "run_new_owner";
    const runDir = join(home, "tier1", "runs", runId);
    mkdirSync(runDir, { recursive: true });
    writeFileSync(join(runDir, "agent.pid"), String(childPid));
    writeFileSync(join(runDir, "agent-owner.json"), JSON.stringify({
      version: 1,
      runId,
      pid: childPid,
      binary: process.execPath,
      worktree: join(home, "worktree"),
      processStart: startIdentity(childPid),
      ownerPid: 8002,
      ownerInstanceId: "instance-new",
      ...ownerJobFields(job)
    }));

    await expect(reapOwnedAgentGroups(home, { pid: 7001, instanceId: "instance-old" })).resolves.toBe(0);
    expect(() => process.kill(childPid, 0)).not.toThrow();
  });

  it("agent 完整 owner 发布前先按同 generation runtime owner 收口，再复核 legacy 锚", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cli-reaper-"));
    homes.add(home);
    const token = "saydo-child-agent-owner-window";
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", token], {
      detached: true,
      stdio: "ignore"
    });
    if (!child.pid) throw new Error("测试 agent wrapper 未获得 pid");
    const childPid = child.pid;
    pids.add(childPid);
    await once(child, "spawn");
    const job = attachJob(childPid, token);
    const runDir = join(home, "tier1", "runs", "run_owner_window");
    mkdirSync(runDir, { recursive: true });
    writeFileSync(join(runDir, "agent.pid"), String(childPid));
    const childrenRoot = join(home, "runtime", "children");
    mkdirSync(childrenRoot, { recursive: true });
    writeFileSync(join(childrenRoot, `${String(childPid)}.json`), JSON.stringify({
      version: 1,
      pid: childPid,
      kind: "tier1:agent",
      binary: process.execPath,
      processStart: startIdentity(childPid),
      ownerPid: 7001,
      ownerInstanceId: "instance-a",
      ...ownerJobFields(job, token)
    }));

    const closed = once(child, "close");
    await expect(reapOwnedAgentGroups(home, { pid: 7001, instanceId: "instance-a" })).resolves.toBe(1);
    await closed;
    expect(processAlive(childPid)).toBe(false);
    pids.delete(childPid);
  });

  it("birth identity 不匹配时 fail-closed 且不误杀", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cli-reaper-"));
    homes.add(home);
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      detached: true,
      stdio: "ignore"
    });
    if (!child.pid) throw new Error("测试 agent 未获得 pid");
    const childPid = child.pid;
    pids.add(childPid);
    await once(child, "spawn");
    const runId = "run_mismatch";
    const runDir = join(home, "tier1", "runs", runId);
    mkdirSync(runDir, { recursive: true });
    writeFileSync(join(runDir, "agent.pid"), String(childPid));
    writeFileSync(join(runDir, "agent-owner.json"), JSON.stringify({
      version: 1,
      runId,
      pid: childPid,
      binary: process.execPath,
      worktree: join(home, "worktree"),
      processStart: "Thu Jan  1 00:00:00 1970"
    }));

    await expect(reapOwnedAgentGroups(home)).rejects.toThrow("identity mismatch");
    expect(() => process.kill(childPid, 0)).not.toThrow();
  });

  it("daemon 硬退后也回收 durable registry 中的 managed/BYOA 进程组", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cli-reaper-"));
    homes.add(home);
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      detached: true,
      stdio: "ignore"
    });
    if (!child.pid) throw new Error("测试 runtime child 未获得 pid");
    const childPid = child.pid;
    pids.add(childPid);
    await once(child, "spawn");
    const job = attachJob(childPid);
    const root = join(home, "runtime", "children");
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, `${String(childPid)}.json`), JSON.stringify({
      version: 1,
      pid: childPid,
      kind: "byoa:test",
      binary: process.execPath,
      processStart: startIdentity(childPid),
      ownerPid: 999999,
      ...ownerJobFields(job)
    }));

    const closed = once(child, "close");
    await expect(reapOwnedAgentGroups(home)).resolves.toBe(1);
    await closed;
    expect(() => process.kill(childPid, 0)).toThrow();
    pids.delete(childPid);
  });

  it.skipIf(process.platform === "win32")("A4: durable wrapper 组长先死后不得仅凭数值 PGID 回收后代", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cli-reaper-"));
    homes.add(home);
    const marker = join(home, "target.pid");
    const token = "saydo-child-leader-dead";
    const child = spawn(process.execPath, [
      "-e",
      "const {spawn}=require('node:child_process'),fs=require('node:fs');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});fs.writeFileSync(process.argv[1],String(c.pid));setInterval(()=>{},1000)",
      marker,
      token
    ], { detached: true, stdio: "ignore" });
    if (!child.pid) throw new Error("测试 runtime wrapper 未获得 pid");
    const childPid = child.pid;
    pids.add(childPid);
    await once(child, "spawn");
    const deadline = Date.now() + 2_000;
    while (!existsSync(marker)) {
      if (Date.now() >= deadline) throw new Error("测试 target 未启动");
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const processStart = startIdentity(childPid);
    const targetPid = Number(readFileSync(marker, "utf8"));
    pids.add(targetPid);
    const root = join(home, "runtime", "children");
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, `${String(childPid)}.json`), JSON.stringify({
      version: 1,
      pid: childPid,
      kind: "leader-dead",
      binary: process.execPath,
      processStart,
      ownerPid: 999999,
      commandToken: token
    }));
    const closed = once(child, "close");
    process.kill(childPid, "SIGKILL");
    await closed;

    await expect(reapOwnedAgentGroups(home)).rejects.toThrow(/alive after leader death/);
    expect(() => process.kill(targetPid, 0)).not.toThrow();
    pids.delete(childPid);
  });

  it.skipIf(process.platform !== "win32")("win32: 组长死后仍经具名 Job 回收后代", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cli-reaper-"));
    homes.add(home);
    const marker = join(home, "target.pid");
    const token = "saydo-child-leader-dead-win";
    const child = spawn(process.execPath, [
      "-e",
      "const {spawn}=require('node:child_process'),fs=require('node:fs');setTimeout(()=>{const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});fs.writeFileSync(process.argv[1],String(c.pid));},400);setInterval(()=>{},1000)",
      marker,
      token
    ], { detached: true, stdio: "ignore" });
    if (!child.pid) throw new Error("测试 runtime wrapper 未获得 pid");
    const childPid = child.pid;
    pids.add(childPid);
    await once(child, "spawn");
    const job = attachJob(childPid, token);
    const deadline = Date.now() + 3_000;
    while (!existsSync(marker)) {
      if (Date.now() >= deadline) throw new Error("测试 target 未启动");
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const processStart = startIdentity(childPid);
    const targetPid = Number(readFileSync(marker, "utf8"));
    pids.add(targetPid);
    const root = join(home, "runtime", "children");
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, `${String(childPid)}.json`), JSON.stringify({
      version: 1,
      pid: childPid,
      kind: "leader-dead",
      binary: process.execPath,
      processStart,
      ownerPid: 999999,
      ...ownerJobFields(job, token)
    }));
    const closed = once(child, "close");
    process.kill(childPid, "SIGKILL");
    await closed;
    await expect(reapOwnedAgentGroups(home)).resolves.toBe(1);
    expect(processAlive(targetPid)).toBe(false);
    pids.delete(childPid);
    pids.delete(targetPid);
  });

  it("pending wrapper 仅在 command token 匹配时回收", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cli-reaper-"));
    homes.add(home);
    const token = "saydo-child-pending-test";
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", token], {
      detached: true,
      stdio: "ignore"
    });
    if (!child.pid) throw new Error("测试 pending wrapper 未获得 pid");
    const childPid = child.pid;
    pids.add(childPid);
    await once(child, "spawn");
    const job = attachJob(childPid, token);
    const root = join(home, "runtime", "children");
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, `${String(childPid)}.json`), JSON.stringify({
      version: 1,
      pid: childPid,
      kind: "byoa:pending",
      binary: process.execPath,
      processStart: null,
      ownerPid: 999999,
      ...ownerJobFields(job, token)
    }));

    const closed = once(child, "close");
    await expect(reapOwnedAgentGroups(home)).resolves.toBe(1);
    await closed;
    expect(() => process.kill(childPid, 0)).toThrow();
    pids.delete(childPid);
  });

  it("pending wrapper token 不匹配时 fail-closed 且不误杀", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cli-reaper-"));
    homes.add(home);
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", "actual-token"], {
      detached: true,
      stdio: "ignore"
    });
    if (!child.pid) throw new Error("测试 pending wrapper 未获得 pid");
    const childPid = child.pid;
    pids.add(childPid);
    await once(child, "spawn");
    const job = attachJob(childPid);
    const root = join(home, "runtime", "children");
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, `${String(childPid)}.json`), JSON.stringify({
      version: 1,
      pid: childPid,
      kind: "byoa:pending",
      binary: process.execPath,
      processStart: null,
      ownerPid: 999999,
      commandToken: "wrong-token",
      ...ownerJobFields(job)
    }));

    await expect(reapOwnedAgentGroups(home)).rejects.toThrow("ownership pending");
    expect(() => process.kill(childPid, 0)).not.toThrow();
  });
});
