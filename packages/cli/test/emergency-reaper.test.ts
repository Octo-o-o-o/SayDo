import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  assignPidToJob,
  closeNamedJob,
  createNamedJob,
  formatSayDoJobName,
  nativeSync,
  PROCESS_KILL_UNKNOWN,
  processAlive,
  processBirth,
  setKillOwnedTreeTestHooks,
  type NamedJob
} from "@saydo/platform";
import { reapOwnedAgentGroups } from "../src/emergencyReaper.js";
import { reapOwnedAgentsIfHomeOwner } from "../src/supervisor.js";

const GEN = "01234567-89ab-cdef-0123-456789abcdef";

const homes = new Set<string>();
const pids = new Set<number>();
const jobs = new Set<NamedJob>();

afterEach(() => {
  setKillOwnedTreeTestHooks(null);
  for (const job of jobs) {
    try { closeNamedJob(job); } catch { /* 已关 */ }
  }
  jobs.clear();
  for (const pid of pids) {
    try {
      if (process.platform === "win32") process.kill(pid);
      else process.kill(-pid, "SIGKILL");
    } catch { /* 已退出 */ }
    try { process.kill(pid, "SIGKILL"); } catch { /* 已退出 */ }
  }
  pids.clear();
  for (const home of homes) rmSync(home, { recursive: true, force: true });
  homes.clear();
});

function attachJob(pid: number, ownerInstanceId: string, runId: string): NamedJob | undefined {
  if (process.platform !== "win32") return undefined;
  nativeSync();
  const job = createNamedJob(formatSayDoJobName("Local", ownerInstanceId, runId, GEN));
  assignPidToJob(job, pid);
  jobs.add(job);
  return job;
}

function captureLiveBirth(pid: number): string {
  if (process.platform === "win32") nativeSync();
  const birth = processBirth(pid);
  if (typeof birth !== "string" || birth.length === 0) {
    throw new Error("测试目标 birth 不可用");
  }
  return birth;
}

function liveIdentityHooks(
  pid: number,
  command = `${process.execPath} -e setInterval saydo-child-${GEN}`
): string {
  const birth = captureLiveBirth(pid);
  setKillOwnedTreeTestHooks({
    processBirth: (observed) => (observed === pid ? birth : null),
    processAnchor: (observed) => (observed === pid ? { pgid: pid, command } : null)
  });
  return birth;
}

function ownerJobFields(
  job: NamedJob | undefined,
  extras?: { commandToken?: string; runId?: string; ownerInstanceId?: string; generation?: string }
): Record<string, string> {
  const generation = extras?.generation ?? GEN;
  const ownerInstanceId = extras?.ownerInstanceId ?? "cli-owner";
  const runId = extras?.runId ?? "run";
  return {
    kind: "tier1:agent",
    commandToken: extras?.commandToken ?? `saydo-child-${generation}`,
    generation,
    ...(extras?.ownerInstanceId ? { ownerInstanceId: extras.ownerInstanceId } : {}),
    ...(extras?.runId ? { runId: extras.runId } : {}),
    ...(job ? { jobName: job.name } : {})
  };
}

function stampJobName(rec: Record<string, unknown>): Record<string, unknown> {
  const ownerInstanceId = String(rec.ownerInstanceId ?? "cli-owner");
  const runId = String(rec.runId ?? "run");
  const generation = String(rec.generation ?? GEN);
  return {
    ...rec,
    jobName: rec.jobName ?? formatSayDoJobName("Local", ownerInstanceId, runId, generation)
  };
}

function completeAgentOwner(rec: Record<string, unknown>): Record<string, unknown> {
  const runId = String(rec.runId ?? "run");
  const ownerInstanceId = String(rec.ownerInstanceId ?? "cli-owner");
  const generation = String(rec.generation ?? GEN);
  const merged: Record<string, unknown> = {
    version: 1,
    kind: "tier1:agent",
    binary: process.execPath,
    ownerPid: 2,
    ownerInstanceId,
    runId,
    commandToken: `saydo-child-${generation}`,
    generation,
    ...rec
  };
  if (rec.jobName === undefined) {
    merged.jobName = formatSayDoJobName(
      "Local",
      String(merged.ownerInstanceId),
      String(merged.runId),
      String(merged.generation)
    );
  }
  return merged;
}

function writeAgentOwner(home: string, rec: Record<string, unknown>): { runDir: string; ownerPath: string } {
  const filled = completeAgentOwner(rec);
  const runId = String(filled.runId);
  const runDir = join(home, "tier1", "runs", runId);
  mkdirSync(runDir, { recursive: true });
  const ownerPath = join(runDir, "agent-owner.json");
  writeFileSync(ownerPath, JSON.stringify(filled));
  return { runDir, ownerPath };
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
    const runId = "run_test";
    const job = attachJob(childPid, "instance-a", runId);
    const birth = liveIdentityHooks(childPid);
    writeAgentOwner(home, {
      version: 1,
      runId,
      pid: childPid,
      binary: process.execPath,
      worktree: join(home, "worktree"),
      processStart: birth,
      ownerPid: 7001,
      ownerInstanceId: "instance-a",
      ...ownerJobFields(job)
    });
    writeFileSync(join(home, "tier1", "runs", runId, "agent.pid"), String(childPid));

    const closed = once(child, "close");
    await expect(reapOwnedAgentGroups(home, { pid: 7001, instanceId: "instance-a" })).resolves.toBe(1);
    await closed;
    expect(() => process.kill(childPid, 0)).toThrow();
    pids.delete(childPid);
    expect(existsSync(join(home, "audit", "reap.jsonl"))).toBe(true);
    expect(readFileSync(join(home, "audit", "reap.jsonl"), "utf8")).not.toContain("SECRET");
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
    const runId = "run_new_owner";
    const job = attachJob(childPid, "instance-new", runId);
    const birth = liveIdentityHooks(childPid);
    writeAgentOwner(home, {
      version: 1,
      runId,
      pid: childPid,
      binary: process.execPath,
      worktree: join(home, "worktree"),
      processStart: birth,
      ownerPid: 8002,
      ownerInstanceId: "instance-new",
      ...ownerJobFields(job)
    });
    writeFileSync(join(home, "tier1", "runs", runId, "agent.pid"), String(childPid));

    await expect(reapOwnedAgentGroups(home, { pid: 7001, instanceId: "instance-old" })).resolves.toBe(0);
    expect(() => process.kill(childPid, 0)).not.toThrow();
  });

  it("未持 HOME 锁的 generation 不得 reap 现役 agent", async () => {
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
    const runId = "run_lock_loser";
    const job = attachJob(childPid, "instance-owner", runId);
    writeAgentOwner(home, {
      version: 1,
      runId,
      pid: childPid,
      binary: process.execPath,
      worktree: join(home, "worktree"),
      processStart: "owner-agent-birth",
      ownerPid: 8002,
      ownerInstanceId: "instance-owner",
      ...ownerJobFields(job)
    });
    writeFileSync(join(home, "tier1", "runs", runId, "agent.pid"), String(childPid));
    writeFileSync(join(home, ".daemon-supervisor.lock"), JSON.stringify({
      version: 1,
      pid: 8002,
      processStart: "owner-birth",
      instanceId: "instance-owner"
    }));
    await reapOwnedAgentsIfHomeOwner(home, { pid: 9009, instanceId: "instance-loser" });
    expect(() => process.kill(childPid, 0)).not.toThrow();
  });

  it("agent 完整 owner 发布前先按同 generation runtime owner 收口，再复核 legacy 锚", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cli-reaper-"));
    homes.add(home);
    const token = "saydo-child-01234567-89ab-cdef-0123-456789abcdef";
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", token], {
      detached: true,
      stdio: "ignore"
    });
    if (!child.pid) throw new Error("测试 agent wrapper 未获得 pid");
    const childPid = child.pid;
    pids.add(childPid);
    await once(child, "spawn");
    const job = attachJob(childPid, "instance-a", token);
    const birth = liveIdentityHooks(childPid, `${process.execPath} ${token}`);
    const runDir = join(home, "tier1", "runs", "run_owner_window");
    mkdirSync(runDir, { recursive: true });
    writeFileSync(join(runDir, "agent.pid"), String(childPid));
    const childrenRoot = join(home, "runtime", "children");
    mkdirSync(childrenRoot, { recursive: true });
    writeFileSync(join(childrenRoot, `${String(childPid)}.json`), JSON.stringify(stampJobName({
      version: 1,
      pid: childPid,
      kind: "tier1:agent",
      binary: process.execPath,
      processStart: birth,
      ownerPid: 7001,
      ownerInstanceId: "instance-a",
      runId: token,
      commandToken: token,
      generation: "01234567-89ab-cdef-0123-456789abcdef",
      ...ownerJobFields(job, { commandToken: token, runId: token })
    })));

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
    liveIdentityHooks(childPid);
    writeAgentOwner(home, {
      version: 1,
      runId,
      pid: childPid,
      binary: process.execPath,
      worktree: join(home, "worktree"),
      processStart: "recorded-birth"
    });
    writeFileSync(join(home, "tier1", "runs", runId, "agent.pid"), String(childPid));

    await expect(reapOwnedAgentGroups(home)).rejects.toThrow("identity mismatch");
    expect(() => process.kill(childPid, 0)).not.toThrow();
  });

  it("agent 路径 identity changed 时 CAS no-op，不得顶掉 supervisor 错误", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cli-reaper-cas-"));
    homes.add(home);
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      detached: true,
      stdio: "ignore"
    });
    if (!child.pid) throw new Error("测试 agent 未获得 pid");
    const childPid = child.pid;
    pids.add(childPid);
    await once(child, "spawn");
    const runId = "run_cas";
    const job = attachJob(childPid, "instance-a", runId);
    const birth = liveIdentityHooks(childPid);
    const { ownerPath } = writeAgentOwner(home, {
      version: 1,
      runId,
      pid: childPid,
      binary: process.execPath,
      worktree: join(home, "worktree"),
      processStart: birth,
      ownerPid: 7001,
      ownerInstanceId: "instance-a",
      ...(job ? { jobName: job.name } : {})
    });
    writeFileSync(join(home, "tier1", "runs", runId, "agent.pid"), String(childPid));
    const successorGen = "01234567-89ab-cdef-0123-456789abcde0";
    await expect(reapOwnedAgentGroups(home, undefined, {
      afterKillBeforeDelete: () => {
        writeAgentOwner(home, {
          version: 1,
          runId,
          pid: childPid,
          binary: process.execPath,
          worktree: join(home, "worktree"),
          processStart: birth,
          ownerPid: 7001,
          ownerInstanceId: "instance-a",
          generation: successorGen,
          commandToken: `saydo-child-${successorGen}`
        });
      }
    })).resolves.toBe(0);
    expect(existsSync(ownerPath)).toBe(true);
    expect(JSON.parse(readFileSync(ownerPath, "utf8")).generation).toBe(successorGen);
  });

  it("CLI agent delete 必须走 HOME boundary：持锁时不得 unlink", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cli-reap-lock-"));
    homes.add(home);
    const { ownerPath } = writeAgentOwner(home, {
      version: 1,
      runId: "run_lock",
      pid: 9,
      binary: process.execPath,
      worktree: join(home, "worktree"),
      processStart: "birth-dead",
      ownerPid: 7001,
      ownerInstanceId: "instance-a"
    });
    writeFileSync(join(home, "tier1", "runs", "run_lock", "agent.pid"), "9");
    const holdMarker = join(home, "holding.marker");
    const reapMarker = join(home, "reaped.marker");
    const tsx = fileURLToPath(new URL("../../daemon/node_modules/tsx/dist/cli.mjs", import.meta.url));
    const worker = fileURLToPath(new URL("./fixtures/cli-reap-worker.mjs", import.meta.url));
    const envBase = {
      ...process.env,
      SAYDO_LOCK_HOME: home,
      SAYDO_LOCK_MODULE: fileURLToPath(new URL("../../platform/src/homeLock.ts", import.meta.url)),
      SAYDO_REAPER_MODULE: fileURLToPath(new URL("../src/emergencyReaper.ts", import.meta.url))
    };
    const holder = spawn(process.execPath, [tsx, worker], {
      env: { ...envBase, SAYDO_LOCK_ROLE: "hold", SAYDO_LOCK_MARKER: holdMarker },
      stdio: "ignore"
    });
    const started = Date.now();
    while (!existsSync(holdMarker) && Date.now() - started < 5_000) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(existsSync(holdMarker)).toBe(true);
    const waiter = spawn(process.execPath, [tsx, worker], {
      env: { ...envBase, SAYDO_LOCK_ROLE: "cli-reap", SAYDO_LOCK_MARKER: reapMarker },
      stdio: "ignore"
    });
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(existsSync(ownerPath)).toBe(true);
    expect(existsSync(reapMarker)).toBe(false);
    holder.kill("SIGKILL");
    await new Promise<void>((resolve) => {
      if (holder.exitCode !== null) resolve();
      else holder.once("exit", () => resolve());
    });
    // waiter 要等 HOME 锁释放后完成 reap；容器/CI 上进程调度与文件锁明显慢于本机开发机，
    // 原来的 8s 在 ubuntu 容器里会超时（本地 CI 模拟实测，macOS/Windows 上均不复现）。
    // it 自身超时同步放宽，保证是 waiter 判据到期而不是被 testTimeout 截断。
    await new Promise<void>((resolve, reject) => {
      waiter.once("exit", () => resolve());
      setTimeout(() => reject(new Error("cli-reap waiter timeout")), 20_000);
    });
  }, 40_000);

  it("daemon 硬退后也回收 durable registry 中的 managed/BYOA 进程组", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cli-reaper-"));
    homes.add(home);
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", "saydo-child-01234567-89ab-cdef-0123-456789abcdef"], {
      detached: true,
      stdio: "ignore"
    });
    if (!child.pid) throw new Error("测试 runtime child 未获得 pid");
    const childPid = child.pid;
    pids.add(childPid);
    await once(child, "spawn");
    const job = attachJob(childPid, "cli-owner", "run_byoa");
    const birth = liveIdentityHooks(
      childPid,
      `${process.execPath} -e setInterval saydo-child-01234567-89ab-cdef-0123-456789abcdef`
    );
    const root = join(home, "runtime", "children");
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, `${String(childPid)}.json`), JSON.stringify(stampJobName({
      version: 1,
      pid: childPid,
      kind: "byoa:test",
      binary: process.execPath,
      processStart: birth,
      ownerPid: 999999,
      ownerInstanceId: "cli-owner",
      runId: "run_byoa",
      commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcdef",
      generation: "01234567-89ab-cdef-0123-456789abcdef",
      ...ownerJobFields(job, { runId: "run_byoa" })
    })));

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
    const token = "saydo-child-01234567-89ab-cdef-0123-456789abcdef";
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
    const targetPid = Number(readFileSync(marker, "utf8"));
    pids.add(targetPid);
    const root = join(home, "runtime", "children");
    mkdirSync(root, { recursive: true });
    const birth = captureLiveBirth(childPid);
    writeFileSync(join(root, `${String(childPid)}.json`), JSON.stringify(stampJobName({
      version: 1,
      pid: childPid,
      kind: "leader-dead",
      binary: process.execPath,
      processStart: birth,
      ownerPid: 999999,
      ownerInstanceId: "cli-owner",
      runId: token,
      commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcdef",
      generation: "01234567-89ab-cdef-0123-456789abcdef"
    })));
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
    const token = "saydo-child-01234567-89ab-cdef-0123-456789abcdef";
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
    const job = attachJob(childPid, "cli-owner", token);
    const deadline = Date.now() + 3_000;
    while (!existsSync(marker)) {
      if (Date.now() >= deadline) throw new Error("测试 target 未启动");
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const targetPid = Number(readFileSync(marker, "utf8"));
    pids.add(targetPid);
    const birth = liveIdentityHooks(childPid, `${process.execPath} ${token}`);
    const root = join(home, "runtime", "children");
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, `${String(childPid)}.json`), JSON.stringify(stampJobName({
      version: 1,
      pid: childPid,
      kind: "leader-dead",
      binary: process.execPath,
      processStart: birth,
      ownerPid: 999999,
      ownerInstanceId: "cli-owner",
      runId: token,
      commandToken: token,
      generation: "01234567-89ab-cdef-0123-456789abcdef",
      ...ownerJobFields(job, { commandToken: token, runId: token })
    })));
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
    const token = "saydo-child-01234567-89ab-cdef-0123-456789abcdef";
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", token], {
      detached: true,
      stdio: "ignore"
    });
    if (!child.pid) throw new Error("测试 pending wrapper 未获得 pid");
    const childPid = child.pid;
    pids.add(childPid);
    await once(child, "spawn");
    const job = attachJob(childPid, "cli-owner", token);
    liveIdentityHooks(childPid, `${process.execPath} ${token}`);
    const root = join(home, "runtime", "children");
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, `${String(childPid)}.json`), JSON.stringify(stampJobName({
      version: 1,
      pid: childPid,
      kind: "byoa:pending",
      binary: process.execPath,
      processStart: null,
      ownerPid: 999999,
      ownerInstanceId: "cli-owner",
      runId: token,
      commandToken: token,
      generation: "01234567-89ab-cdef-0123-456789abcdef",
      ...ownerJobFields(job, { commandToken: token, runId: token })
    })));

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
    liveIdentityHooks(childPid, `${process.execPath} actual-token`);
    const root = join(home, "runtime", "children");
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, `${String(childPid)}.json`), JSON.stringify(stampJobName({
      version: 1,
      pid: childPid,
      kind: "byoa:pending",
      binary: process.execPath,
      processStart: null,
      ownerPid: 999999,
      ownerInstanceId: "cli-owner",
      runId: "run_pending",
      commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcdef",
      generation: "01234567-89ab-cdef-0123-456789abcdef",
      ...ownerJobFields(undefined, { runId: "run_pending" })
    })));

    await expect(reapOwnedAgentGroups(home)).rejects.toThrow(
      /ownership pending|job empty while process alive|not a job member/
    );
    expect(() => process.kill(childPid, 0)).not.toThrow();
  });

  it("agent owner absent 且无 legacy PID 视为 absent", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cli-reaper-"));
    homes.add(home);
    mkdirSync(join(home, "tier1", "runs", "run_absent"), { recursive: true });
    await expect(reapOwnedAgentGroups(home)).resolves.toBe(0);
  });

  it("agent owner invalid 时 fail-closed 且保留文件", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cli-reaper-"));
    homes.add(home);
    const runDir = join(home, "tier1", "runs", "run_invalid");
    mkdirSync(runDir, { recursive: true });
    const ownerPath = join(runDir, "agent-owner.json");
    writeFileSync(ownerPath, "{not-json");
    await expect(reapOwnedAgentGroups(home)).rejects.toThrow(/ownership record invalid/u);
    expect(existsSync(ownerPath)).toBe(true);
  });

  it("Windows agent owner 缺 jobName 一律红且保留文件", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cli-reaper-"));
    homes.add(home);
    const runDir = join(home, "tier1", "runs", "run_missing_job");
    mkdirSync(runDir, { recursive: true });
    const ownerPath = join(runDir, "agent-owner.json");
    writeFileSync(ownerPath, JSON.stringify({
      version: 1,
      runId: "run_missing_job",
      pid: 424242,
      binary: process.execPath,
      worktree: join(home, "wt"),
      processStart: "fake-start",
      ownerPid: 2,
      ownerInstanceId: "cli-owner",
      kind: "tier1:agent",
      generation: GEN,
      commandToken: `saydo-child-${GEN}`
    }));
    setKillOwnedTreeTestHooks({ hostKind: () => "win32" });
    await expect(reapOwnedAgentGroups(home)).rejects.toThrow(/missing jobName/u);
    expect(existsSync(ownerPath)).toBe(true);
  });

  it("runtime owner invalid 时 fail-closed 且保留文件", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cli-reaper-"));
    homes.add(home);
    const root = join(home, "runtime", "children");
    mkdirSync(root, { recursive: true });
    const path = join(root, "9.json");
    writeFileSync(path, "{bad");
    await expect(reapOwnedAgentGroups(home)).rejects.toThrow(/runtime child ownership record invalid/u);
    expect(existsSync(path)).toBe(true);
  });

  it("Windows runtime owner 缺 jobName 一律红且保留文件", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cli-reaper-"));
    homes.add(home);
    const root = join(home, "runtime", "children");
    mkdirSync(root, { recursive: true });
    const path = join(root, "424243.json");
    writeFileSync(path, JSON.stringify({
      version: 1,
      pid: 424243,
      kind: "exec",
      binary: process.execPath,
      processStart: "fake-start",
      ownerPid: 2,
      ownerInstanceId: "cli-owner",
      runId: "run_missing_job",
      commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcdef",
      generation: "01234567-89ab-cdef-0123-456789abcdef"
    }));
    setKillOwnedTreeTestHooks({ hostKind: () => "win32" });
    await expect(reapOwnedAgentGroups(home)).rejects.toThrow(/missing jobName/u);
    expect(existsSync(path)).toBe(true);
  });

  it("valid-dead runtime owner 仅在权威 gone 后删除", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cli-reaper-"));
    homes.add(home);
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      detached: true,
      stdio: "ignore"
    });
    if (!child.pid) throw new Error("测试 dead owner 未获得 pid");
    const childPid = child.pid;
    pids.add(childPid);
    await once(child, "spawn");
    const job = attachJob(childPid, "cli-owner", "run_dead");
    const birth = liveIdentityHooks(childPid);
    const root = join(home, "runtime", "children");
    mkdirSync(root, { recursive: true });
    const path = join(root, `${String(childPid)}.json`);
    writeFileSync(path, JSON.stringify(stampJobName({
      version: 1,
      pid: childPid,
      kind: "exec",
      binary: process.execPath,
      processStart: birth,
      ownerPid: 999999,
      ownerInstanceId: "cli-owner",
      runId: "run_dead",
      commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcdef",
      generation: "01234567-89ab-cdef-0123-456789abcdef",
      ...ownerJobFields(job, { runId: "run_dead" })
    })));
    child.kill("SIGKILL");
    await once(child, "close");
    pids.delete(childPid);
    await expect(reapOwnedAgentGroups(home)).resolves.toBeGreaterThanOrEqual(0);
    expect(existsSync(path)).toBe(false);
  });

  it("CLI 生产路径 unknown 失败零 SECRET、audit-before-delete、保留 owner", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cli-reaper-"));
    homes.add(home);
    const runId = "run_secret";
    const { ownerPath } = writeAgentOwner(home, {
      version: 1,
      runId,
      pid: 424249,
      binary: process.execPath,
      worktree: join(home, "wt"),
      processStart: "owned-start",
      ownerInstanceId: "cli-owner",
      jobName: formatSayDoJobName("Local", "cli-owner", runId, GEN)
    });
    const samples: unknown[] = [
      new Error("SECRET"),
      new AggregateError([new Error("SECRET")], "SECRET"),
      "SECRET",
      42n
    ];
    const accessor = new Error("init");
    Object.defineProperty(accessor, "message", {
      get(): string {
        return "SECRET";
      }
    });
    samples.push(accessor);
    const proxy = new Proxy(new Error("SECRET"), {
      get() {
        return "SECRET";
      }
    });
    samples.push(proxy);
    const revoked = Proxy.revocable(new Error("SECRET"), {
      get() {
        throw new TypeError("revoked");
      }
    });
    revoked.revoke();
    samples.push(revoked.proxy);
    for (const sample of samples) {
      setKillOwnedTreeTestHooks({
        hostKind: () => "win32",
        processBirth: () => "owned-start",
        processAlive: () => true,
        jobActive: () => 1,
        jobContainsPid: () => true,
        terminateJob: () => {
          throw sample as Error;
        }
      });
      await expect(reapOwnedAgentGroups(home)).rejects.toSatisfy((err: unknown) => {
        const message = err instanceof Error ? err.message : "not-error";
        return !message.includes("SECRET") && (message === PROCESS_KILL_UNKNOWN || /untrusted|unknown|invalid/u.test(message));
      });
      expect(existsSync(ownerPath)).toBe(true);
      expect(existsSync(join(home, "audit", "reap.jsonl"))).toBe(false);
    }
  });

  it("Windows empty Job + live PID 拒绝、不 TerminateJob、保留 owner", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cli-reaper-"));
    homes.add(home);
    const runId = "run_empty";
    const { ownerPath } = writeAgentOwner(home, {
      version: 1,
      runId,
      pid: 424251,
      binary: process.execPath,
      worktree: join(home, "wt"),
      processStart: "owned-start",
      ownerInstanceId: "cli-owner",
      jobName: formatSayDoJobName("Local", "cli-owner", runId, GEN)
    });
    let terminated = 0;
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      processBirth: () => "owned-start",
      processAlive: () => true,
      jobActive: () => 0,
      jobContainsPid: () => "missing",
      terminateJob: () => {
        terminated += 1;
        return "terminated";
      }
    });
    await expect(reapOwnedAgentGroups(home)).rejects.toThrow(/empty while process alive/u);
    expect(terminated).toBe(0);
    expect(existsSync(ownerPath)).toBe(true);
  });

  it("Windows PID 不属于 Job / wrong-run / substring owner 均拒绝 TerminateJob", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cli-reaper-"));
    homes.add(home);
    let terminated = 0;
    const base = {
      hostKind: () => "win32" as const,
      processBirth: () => "owned-start",
      processAlive: () => true,
      jobActive: () => 2,
      jobContainsPid: () => false,
      terminateJob: (): "terminated" => {
        terminated += 1;
        return "terminated";
      }
    };
    const { ownerPath } = writeAgentOwner(home, {
      version: 1,
      runId: "run_member",
      pid: 424252,
      binary: process.execPath,
      worktree: join(home, "wt"),
      processStart: "owned-start",
      ownerInstanceId: "cli-owner",
      jobName: formatSayDoJobName("Local", "cli-owner", "run_member", GEN)
    });
    setKillOwnedTreeTestHooks(base);
    await expect(reapOwnedAgentGroups(home)).rejects.toThrow(/not a job member/u);
    expect(terminated).toBe(0);
    expect(existsSync(ownerPath)).toBe(true);

    writeFileSync(ownerPath, JSON.stringify({
      version: 1,
      runId: "run_member",
      pid: 424252,
      binary: process.execPath,
      worktree: join(home, "wt"),
      processStart: "owned-start",
      ownerInstanceId: "cli-owner",
      jobName: formatSayDoJobName("Local", "cli-owner", "other-run", GEN)
    }));
    setKillOwnedTreeTestHooks({ ...base, jobContainsPid: () => true });
    await expect(reapOwnedAgentGroups(home)).rejects.toThrow(/invalid|missing jobName/u);
    expect(terminated).toBe(0);

    writeFileSync(ownerPath, JSON.stringify({
      version: 1,
      runId: "run_member",
      pid: 424252,
      binary: process.execPath,
      worktree: join(home, "wt"),
      processStart: "owned-start",
      ownerInstanceId: "own",
      jobName: formatSayDoJobName("Local", "owner", "run_member", GEN)
    }));
    await expect(reapOwnedAgentGroups(home)).rejects.toThrow(/invalid|missing jobName/u);
    expect(terminated).toBe(0);
  });

  it("audit 失败不删 owner 且不记成功 reap", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cli-reaper-"));
    homes.add(home);
    const runId = "run_audit";
    const { ownerPath } = writeAgentOwner(home, {
      version: 1,
      runId,
      pid: 424253,
      binary: process.execPath,
      worktree: join(home, "wt"),
      processStart: "owned-start",
      ownerInstanceId: "cli-owner",
      jobName: formatSayDoJobName("Local", "cli-owner", runId, GEN)
    });
    writeFileSync(join(home, "audit"), "not-a-dir");
    let killed = 0;
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      processBirth: () => "owned-start",
      processAlive: () => killed === 0,
      jobActive: () => (killed > 0 ? 0 : 1),
      jobContainsPid: () => true,
      terminateJob: () => {
        killed += 1;
        return "terminated";
      }
    });
    await expect(reapOwnedAgentGroups(home)).rejects.toSatisfy((err: unknown) => {
      const message = err instanceof Error ? err.message : "not-error";
      return !message.includes("SECRET");
    });
    expect(existsSync(ownerPath)).toBe(true);
  });

  it("leader 已确认死亡且 Job drain 时 audit-before-delete；audit 失败/Job 仍活/generation mismatch 保留 owner", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cli-reaper-"));
    homes.add(home);
    const runId = "run_stale";
    const { ownerPath } = writeAgentOwner(home, {
      version: 1,
      runId,
      pid: 424270,
      binary: process.execPath,
      worktree: join(home, "wt"),
      processStart: "owned-start",
      ownerPid: 7001,
      ownerInstanceId: "cli-owner",
      jobName: formatSayDoJobName("Local", "cli-owner", runId, GEN)
    });
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      processBirth: () => null,
      processAlive: () => false,
      jobActive: () => "missing",
      jobContainsPid: () => "missing"
    });
    await expect(reapOwnedAgentGroups(home, { pid: 7001, instanceId: "cli-owner" })).resolves.toBe(1);
    expect(existsSync(ownerPath)).toBe(false);
    expect(existsSync(join(home, "audit", "reap.jsonl"))).toBe(true);

    const { ownerPath: otherGen } = writeAgentOwner(home, {
      version: 1,
      runId: "run_other",
      pid: 424271,
      binary: process.execPath,
      worktree: join(home, "wt"),
      processStart: "owned-start",
      ownerPid: 8002,
      ownerInstanceId: "other-gen",
      jobName: formatSayDoJobName("Local", "other-gen", "run_other", GEN)
    });
    await expect(reapOwnedAgentGroups(home, { pid: 7001, instanceId: "cli-owner" })).resolves.toBe(0);
    expect(existsSync(otherGen)).toBe(true);

    const { ownerPath: activeJob } = writeAgentOwner(home, {
      version: 1,
      runId: "run_active",
      pid: 424272,
      binary: process.execPath,
      worktree: join(home, "wt"),
      processStart: "owned-start",
      ownerPid: 7001,
      ownerInstanceId: "cli-owner",
      jobName: formatSayDoJobName("Local", "cli-owner", "run_active", GEN)
    });
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      processBirth: () => null,
      processAlive: () => false,
      jobActive: () => 2,
      jobContainsPid: () => true
    });
    await expect(reapOwnedAgentGroups(home, { pid: 7001, instanceId: "cli-owner" })).rejects.toThrow(/not proven drained|still active/u);
    expect(existsSync(activeJob)).toBe(true);

    const auditHome = mkdtempSync(join(tmpdir(), "saydo-cli-reaper-"));
    homes.add(auditHome);
    writeFileSync(join(auditHome, "audit"), "not-a-dir");
    const { ownerPath: auditFail } = writeAgentOwner(auditHome, {
      version: 1,
      runId: "run_audit_dead",
      pid: 424273,
      binary: process.execPath,
      worktree: join(home, "wt"),
      processStart: "owned-start",
      ownerPid: 7001,
      ownerInstanceId: "cli-owner",
      jobName: formatSayDoJobName("Local", "cli-owner", "run_audit_dead", GEN)
    });
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      processBirth: () => null,
      processAlive: () => false,
      jobActive: () => "missing",
      jobContainsPid: () => "missing"
    });
    await expect(reapOwnedAgentGroups(auditHome, { pid: 7001, instanceId: "cli-owner" })).rejects.toSatisfy((err: unknown) => {
      const message = err instanceof Error ? err.message : "not-error";
      return !message.includes("SECRET");
    });
    expect(existsSync(auditFail)).toBe(true);
  });

  it("runtime owner 空串/相对路径/缺 token/hostile 保留文件且不 kill", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-cli-reaper-"));
    homes.add(home);
    const root = join(home, "runtime", "children");
    mkdirSync(root, { recursive: true });
    let terminated = 0;
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      processBirth: () => "owned-start",
      processAlive: () => true,
      jobActive: () => 1,
      jobContainsPid: () => true,
      terminateJob: () => {
        terminated += 1;
        return "terminated";
      }
    });
    const samples = [
      {
        binary: "",
        commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcdef",
        generation: "01234567-89ab-cdef-0123-456789abcdef",
        ownerInstanceId: "cli-owner",
        runId: "r1",
        ownerPid: 2,
        jobName: "Local\\SayDoJob-cli-owner-r1"
      },
      {
        binary: "relative/bin",
        commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcdef",
        generation: "01234567-89ab-cdef-0123-456789abcdef",
        ownerInstanceId: "cli-owner",
        runId: "r2",
        ownerPid: 2,
        jobName: "Local\\SayDoJob-cli-owner-r2"
      },
      {
        binary: process.execPath,
        commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcdef",
        generation: "01234567-89ab-cdef-0123-456789abcdef",
        ownerInstanceId: "cli-owner",
        runId: "r3",
        ownerPid: 2,
        jobName: "Local\\SayDoJob-cli-owner-r3"
      }
    ];
    for (const [index, extra] of samples.entries()) {
      const path = join(root, `${String(424280 + index)}.json`);
      writeFileSync(path, JSON.stringify({
        version: 1,
        pid: 424280 + index,
        kind: "exec",
        processStart: "owned-start",
        ...extra
      }));
      await expect(reapOwnedAgentGroups(home)).rejects.toThrow(/invalid|missing jobName/u);
      expect(existsSync(path)).toBe(true);
    }
    const accessorPath = join(root, "424290.json");
    const rec: Record<string, unknown> = {
      version: 1,
      pid: 424290,
      kind: "exec",
      binary: process.execPath,
      processStart: "owned-start",
      ownerPid: 2,
      ownerInstanceId: "cli-owner",
      runId: "r4",
      commandToken: "saydo-child-01234567-89ab-cdef-0123-456789abcdef",
      generation: "01234567-89ab-cdef-0123-456789abcdef",
      jobName: "Local\\SayDoJob-cli-owner-r4"
    };
    Object.defineProperty(rec, "binary", { get(): string { return "SECRET"; } });
    writeFileSync(accessorPath, JSON.stringify({
      version: 1,
      pid: 424290,
      kind: "exec",
      processStart: "owned-start",
      ownerPid: 1
    }));
    await expect(reapOwnedAgentGroups(home)).rejects.toThrow(/invalid/u);
    expect(terminated).toBe(0);
    expect(existsSync(accessorPath)).toBe(true);
    expect(existsSync(join(home, "audit", "reap.jsonl"))).toBe(false);
  });
});
