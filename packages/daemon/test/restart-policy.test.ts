import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  agentOwnerIdentity,
  assignPidToJob,
  closeNamedJob,
  createNamedJob,
  formatSayDoJobName,
  nativeSync,
  parseAgentOwnerRecord,
  PROCESS_KILL_UNKNOWN,
  processBirth,
  setKillOwnedTreeTestHooks,
  type NamedJob
} from "@saydo/platform";
import type { AuditEvent, AuditSink } from "../src/obs/audit.js";
import { openDb } from "../src/storage/db.js";
import {
  markDurableTier1RestartPending,
  reapOwnedTier1Agent,
  recoverableTier1Count,
  releaseAgentOwnershipAfterDurable,
  releaseAgentOwnershipIfIdentity,
  setRestartPolicyTestHooks,
  shouldClearAgentOwnershipAfterDurable
} from "../src/tier1/restartPolicy.js";

const GEN = "01234567-89ab-cdef-0123-456789abcdef";

const spawned = new Set<number>();
const tempDirs = new Set<string>();
const jobs = new Set<NamedJob>();

afterEach(() => {
  setRestartPolicyTestHooks(null);
  setKillOwnedTreeTestHooks(null);
  for (const job of jobs) {
    try { closeNamedJob(job); } catch { /* 已关 */ }
  }
  jobs.clear();
  for (const pid of spawned) {
    try {
      if (process.platform === "win32") process.kill(pid);
      else process.kill(-pid, "SIGKILL");
    } catch {
      // 测试目标已退出。
    }
    try { process.kill(pid, "SIGKILL"); } catch { /* 已退出 */ }
  }
  spawned.clear();
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.clear();
});

function completeAgentOwner(rec: Record<string, unknown>): Record<string, unknown> {
  const runId = String(rec.runId ?? "run");
  const ownerInstanceId = String(rec.ownerInstanceId ?? "owner");
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

function writeCompleteOwner(path: string, rec: Record<string, unknown>): void {
  writeFileSync(path, JSON.stringify(completeAgentOwner(rec)));
}

function attachJob(pid: number, ownerInstanceId: string, runId: string): NamedJob | undefined {
  if (process.platform !== "win32") return undefined;
  nativeSync();
  const job = createNamedJob(formatSayDoJobName("Local", ownerInstanceId, runId, GEN));
  assignPidToJob(job, pid);
  jobs.add(job);
  return job;
}

function observeLivePid(pid: number, token = `saydo-child-${GEN}`): string {
  if (process.platform === "win32") nativeSync();
  const birth = processBirth(pid);
  if (typeof birth !== "string" || birth.length === 0) {
    throw new Error("测试目标 birth 不可用");
  }
  setKillOwnedTreeTestHooks({
    processBirth: (observed) => (observed === pid ? birth : null),
    processAnchor: (observed) => observed === pid
      ? { pgid: observed, command: `${process.execPath} -e setInterval ${token}` }
      : null
  });
  return birth;
}

function auditCollector(): { events: AuditEvent[]; sink: AuditSink } {
  const events: AuditEvent[] = [];
  return {
    events,
    sink: {
      record(event) {
        events.push(event);
        return { id: `aud_${events.length}` };
      }
    }
  };
}

async function waitUntil(predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("waitUntil timeout");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe("Tier1 executor-disabled restart policy", () => {
  it("按受信项目 workspace 统计，并在 stopped 前清掉 ownership 匹配的旧进程组", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-restart-policy-"));
    tempDirs.add(home);
    const worktree = join(home, "worktree");
    mkdirSync(worktree);
    mkdirSync(join(worktree, ".git"));
    const repo = realpathSync(mkdtempSync(join(realpathSync(process.cwd()), ".saydo-restart-repo-")));
    tempDirs.add(repo);
    const db = openDb(join(home, "saydo.db"));
    try {
    const now = "2026-08-12T00:00:00.000Z";
    const identity = statSync(repo, { bigint: true });
    db.prepare(
      `INSERT INTO projects(id,title,type,status,workspace_json,canonical_workspace_path,workspace_dev,workspace_ino,exec_mode_default,created_at,updated_at)
       VALUES ('prj_restart','p','coding','active',?,?,?,?, 'step_confirm',?,?)`
    ).run(JSON.stringify({ kind: "local_folder", path: repo, managed: false }), repo, String(identity.dev), String(identity.ino), now, now);
    for (const [taskId, runId, path] of [
      ["tsk_owned", "run_owned", worktree],
      ["tsk_missing", "run_missing", join(home, "missing")]
    ]) {
      db.prepare(
        `INSERT INTO tasks(id,project_id,title,spec_markdown,route,status,adapter,budget_json,created_at,updated_at)
         VALUES (?,'prj_restart','t','# t','tier1','running','cursor','{}',?,?)`
      ).run(taskId, now, now);
      db.prepare(
        `INSERT INTO tier1_runs(id,task_id,attempt,adapter,cwd,worktree_path,state,created_at,updated_at)
         VALUES (?,?,1,'cursor',?,?,'running',?,?)`
      ).run(runId, taskId, path, path, now, now);
    }

    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      detached: true,
      stdio: "ignore"
    });
    if (!child.pid) throw new Error("测试子进程未获得 pid");
    const childPid = child.pid;
    spawned.add(childPid);
    await once(child, "spawn");
    const job = attachJob(childPid, "restart-owner", "run_owned");
    const runDir = join(home, "tier1", "runs", "run_owned");
    mkdirSync(runDir, { recursive: true });
    const processStart = observeLivePid(childPid);
    writeFileSync(
      join(runDir, "agent-owner.json"),
      JSON.stringify(completeAgentOwner({
        version: 1,
        runId: "run_owned",
        pid: childPid,
        binary: process.execPath,
        worktree,
        processStart,
        ownerInstanceId: "restart-owner",
        ...(job ? { jobName: job.name } : {})
      }))
    );
    const audit = auditCollector();
    const childClosed = once(child, "close");

    expect(recoverableTier1Count(db)).toBe(1);
    // B3: running 无 native session 时不挂 recoverable marker；仍会 reap 已验证 ownership 的进程组。
    await expect(markDurableTier1RestartPending(db, audit.sink, home, "cli_sigint", now)).resolves.toMatchObject({
      recoverableTier1: 0
    });
    await childClosed;
    expect(() => process.kill(childPid, 0)).toThrow();
    spawned.delete(childPid);
    expect(
      db.prepare("SELECT restart_pending_at FROM tier1_runs WHERE id='run_owned'").get()
    ).toMatchObject({ restart_pending_at: null });
    expect(
      db.prepare("SELECT restart_pending_at FROM tier1_runs WHERE id='run_missing'").get()
    ).toMatchObject({ restart_pending_at: null });
    expect(audit.events.some((event) => event.action === "tier1.orphan_agent_reaped")).toBe(true);

    // 补 native session + 新进程组后应可标记 recoverable。
    const child2 = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      detached: true,
      stdio: "ignore"
    });
    if (!child2.pid) throw new Error("测试子进程2未获得 pid");
    const child2Pid = child2.pid;
    spawned.add(child2Pid);
    await once(child2, "spawn");
    const job2 = attachJob(child2Pid, "restart-owner", "run_owned");
    const processStart2 = observeLivePid(child2Pid);
    writeFileSync(
      join(runDir, "agent-owner.json"),
      JSON.stringify(completeAgentOwner({
        version: 1,
        runId: "run_owned",
        pid: child2Pid,
        binary: process.execPath,
        worktree,
        processStart: processStart2,
        ownerInstanceId: "restart-owner",
        ...(job2 ? { jobName: job2.name } : {})
      }))
    );
    db.prepare("UPDATE tier1_runs SET native_session_id='chat-owned' WHERE id='run_owned'").run();
    const child2Closed = once(child2, "close");
    await expect(markDurableTier1RestartPending(db, audit.sink, home, "cli_sigint", now)).resolves.toMatchObject({
      recoverableTier1: 1
    });
    await child2Closed;
    spawned.delete(child2Pid);
    expect(
      db.prepare("SELECT restart_pending_at FROM tier1_runs WHERE id='run_owned'").get()
    ).toMatchObject({ restart_pending_at: now });

    const childPidPath = join(home, "leader-child.pid");
    const leader = spawn(
      process.execPath,
      [
        "-e",
        `const{spawn}=require('node:child_process');const{writeFileSync}=require('node:fs');` +
          // POSIX:后代必须留在组长进程组内,A4 断言的前提就是"组长死后组内仍有存活成员";
          // win32 无进程组,后代需独立于 leader 才能验"经具名 Job 回收"。
          `const w=process.platform==='win32';` +
          `const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore',detached:w});` +
          `if(w)c.unref();writeFileSync(${JSON.stringify(childPidPath)},String(c.pid));setTimeout(()=>process.exit(0),200)`
      ],
      { detached: true, stdio: "ignore" }
    );
    if (!leader.pid) throw new Error("组长测试进程未获得 pid");
    const leaderPid = leader.pid;
    spawned.add(leaderPid);
    await once(leader, "spawn");
    const leaderJob = attachJob(leaderPid, "restart-owner", "run_missing");
    const leaderStart = processBirth(leaderPid);
    if (typeof leaderStart !== "string" || leaderStart.length === 0) {
      throw new Error("组长 birth 不可用");
    }
    setKillOwnedTreeTestHooks(null);
    const missingRunDir = join(home, "tier1", "runs", "run_missing");
    mkdirSync(missingRunDir, { recursive: true });
    writeFileSync(
      join(missingRunDir, "agent-owner.json"),
      JSON.stringify(completeAgentOwner({
        version: 1,
        runId: "run_missing",
        pid: leaderPid,
        binary: process.execPath,
        worktree: join(home, "missing"),
        processStart: leaderStart,
        ownerInstanceId: "restart-owner",
        ...(leaderJob ? { jobName: leaderJob.name } : {})
      }))
    );
    await waitUntil(() => existsSync(childPidPath));
    const descendantPid = Number(readFileSync(childPidPath, "utf8"));
    spawned.add(descendantPid);
    await once(leader, "close");
    if (process.platform === "win32") {
      // POSIX A4(数值 PGID)在 win32 不成立:无 jobName 时 fail-closed 跳过,不得盲杀后代。
      await reapOwnedTier1Agent(
        home,
        {
          run_id: "run_missing",
          task_id: "tsk_missing",
          project_id: "prj_restart",
          state: "running",
          worktree_path: join(home, "missing")
        },
        audit.sink
      );
      expect(() => process.kill(descendantPid, 0)).not.toThrow();
    } else {
      await expect(
        reapOwnedTier1Agent(
          home,
          {
            run_id: "run_missing",
            task_id: "tsk_missing",
            project_id: "prj_restart",
            state: "running",
            worktree_path: join(home, "missing")
          },
          audit.sink
        )
      ).rejects.toThrow(/alive after leader death/);
      expect(() => process.kill(descendantPid, 0)).not.toThrow();
    }
    spawned.delete(leaderPid);

    const legacy = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      detached: true,
      stdio: "ignore"
    });
    if (!legacy.pid) throw new Error("legacy 测试进程未获得 pid");
    const legacyPid = legacy.pid;
    spawned.add(legacyPid);
    await once(legacy, "spawn");
    writeFileSync(join(missingRunDir, "agent.pid"), String(legacyPid));
    writeFileSync(join(missingRunDir, "agent-owner.json"), "invalid");
    await expect(
      reapOwnedTier1Agent(
        home,
        {
          run_id: "run_missing",
          task_id: "tsk_missing",
          project_id: "prj_restart",
          state: "running",
          worktree_path: join(home, "missing")
        },
        audit.sink
      )
    ).rejects.toThrow(/ownership record invalid/u);
    expect(() => process.kill(legacyPid, 0)).not.toThrow();
    } finally {
      db.close();
    }
  });

  it("已有 finalize_pending 的 run 仍 reap 进程组，但不得再写 restart marker", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-restart-pending-"));
    tempDirs.add(home);
    const worktree = join(home, "worktree");
    mkdirSync(join(worktree, ".git"), { recursive: true });
    const repo = realpathSync(mkdtempSync(join(realpathSync(process.cwd()), ".saydo-restart-repo-")));
    tempDirs.add(repo);
    const db = openDb(join(home, "saydo.db"));
    try {
      const now = "2026-08-23T00:00:00.000Z";
      const identity = statSync(repo, { bigint: true });
      db.prepare(
        `INSERT INTO projects(id,title,type,status,workspace_json,canonical_workspace_path,workspace_dev,workspace_ino,exec_mode_default,created_at,updated_at)
         VALUES ('prj_restart','p','coding','active',?,?,?,?, 'step_confirm',?,?)`
      ).run(JSON.stringify({ kind: "local_folder", path: repo, managed: false }), repo, String(identity.dev), String(identity.ino), now, now);
      db.prepare(
        `INSERT INTO tasks(id,project_id,title,spec_markdown,route,status,adapter,budget_json,created_at,updated_at)
         VALUES ('tsk_pending','prj_restart','t','# t','tier1','running','cursor','{}',?,?)`
      ).run(now, now);
      db.prepare(
        `INSERT INTO tier1_runs(id,task_id,attempt,adapter,cwd,worktree_path,state,native_session_id,finalize_pending_json,created_at,updated_at)
         VALUES ('run_pending','tsk_pending',1,'cursor',?,?,'running','chat-pending',?, ?,?)`
      ).run(
        worktree,
        worktree,
        JSON.stringify({ kind: "review", recordedAt: now, eventLine: 2, observedModel: "fable-5-max", observedModels: ["fable-5-max"] }),
        now,
        now
      );
      const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
        detached: true,
        stdio: "ignore"
      });
      if (!child.pid) throw new Error("测试子进程未获得 pid");
      const childPid = child.pid;
      spawned.add(childPid);
      await once(child, "spawn");
      const job = attachJob(childPid, "restart-owner", "run_pending");
      const runDir = join(home, "tier1", "runs", "run_pending");
      mkdirSync(runDir, { recursive: true });
      const processStart = observeLivePid(childPid);
      writeFileSync(
        join(runDir, "agent-owner.json"),
        JSON.stringify(completeAgentOwner({
          version: 1,
          runId: "run_pending",
          pid: childPid,
          binary: process.execPath,
          worktree,
          processStart,
          ownerInstanceId: "restart-owner",
          ...(job ? { jobName: job.name } : {})
        }))
      );
      const audit = auditCollector();
      const childClosed = once(child, "close");
      await expect(markDurableTier1RestartPending(db, audit.sink, home, "executor_disabled", now)).resolves.toMatchObject({
        recoverableTier1: 0
      });
      await childClosed;
      spawned.delete(childPid);
      expect(() => process.kill(childPid, 0)).toThrow();
      expect(
        db.prepare("SELECT restart_pending_at, finalize_pending_json FROM tier1_runs WHERE id='run_pending'").get()
      ).toMatchObject({
        restart_pending_at: null,
        finalize_pending_json: expect.any(String)
      });
      expect(audit.events.some((event) => event.action === "tier1.orphan_agent_reaped")).toBe(true);
      expect(audit.events.some((event) => event.action === "tier1.restart_pending")).toBe(false);
    } finally {
      db.close();
    }
  });

  it("Windows live PID birth mismatch 拒绝 TerminateJob，保留 owner", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-restart-win-reuse-"));
    tempDirs.add(home);
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      detached: true,
      stdio: "ignore"
    });
    if (!child.pid) throw new Error("测试子进程未获得 pid");
    const childPid = child.pid;
    spawned.add(childPid);
    await once(child, "spawn");
    try { process.kill(childPid, 0); } catch { throw new Error("测试子进程未存活"); }
    const ownerPath = join(home, "tier1", "runs", "run_reuse", "agent-owner.json");
    mkdirSync(join(home, "tier1", "runs", "run_reuse"), { recursive: true });
    writeCompleteOwner(ownerPath, {
        version: 1,
        runId: "run_reuse",
        pid: childPid,
        binary: process.execPath,
        worktree: join(home, "wt"),
        processStart: "recorded-birth",
        ownerInstanceId: "reuse",
        jobName: formatSayDoJobName("Local", "reuse", "run_reuse", GEN)
    });
    let jobKillCalls = 0;
    setRestartPolicyTestHooks({
      hostKind: () => "win32",
      processBirth: () => "observed-birth",
      processGroupAlive: () => true
    });
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      processBirth: () => "observed-birth",
      processAlive: () => true,
      jobActive: () => 1,
      jobContainsPid: () => true,
      terminateJob: () => {
        jobKillCalls += 1;
        return "terminated";
      }
    });
    const audit = auditCollector();
    await expect(
      reapOwnedTier1Agent(
        home,
        {
          run_id: "run_reuse",
          task_id: "tsk_reuse",
          project_id: "prj_restart",
          state: "running",
          worktree_path: join(home, "wt")
        },
        audit.sink
      )
    ).rejects.toThrow(/identity mismatch/u);
    expect(jobKillCalls).toBe(0);
    expect(existsSync(ownerPath)).toBe(true);
    expect(audit.events.some((event) => event.action === "tier1.orphan_agent_reaped")).toBe(false);
    expect(() => process.kill(childPid, 0)).not.toThrow();
  });

  it("Windows owner 缺 jobName fail-closed", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-restart-noj-"));
    tempDirs.add(home);
    const runDir = join(home, "tier1", "runs", "run_noj");
    mkdirSync(runDir, { recursive: true });
    writeFileSync(
      join(runDir, "agent-owner.json"),
      JSON.stringify({
        version: 1,
        runId: "run_noj",
        pid: 424243,
        binary: process.execPath,
        worktree: join(home, "wt"),
        processStart: "fake-start"
      })
    );
    setRestartPolicyTestHooks({ hostKind: () => "win32" });
    const audit = auditCollector();
    await expect(
      reapOwnedTier1Agent(
        home,
        {
          run_id: "run_noj",
          task_id: "tsk_noj",
          project_id: "prj_restart",
          state: "running",
          worktree_path: join(home, "wt")
        },
        audit.sink
      )
    ).rejects.toThrow(/job name missing/u);
  });

  it("POSIX reap SIGKILL own-data EPERM 不删 owner、不记 reaped、无 SECRET", async () => {
    if (process.platform === "win32") return;
    const home = mkdtempSync(join(tmpdir(), "saydo-restart-eperm-"));
    tempDirs.add(home);
    const runDir = join(home, "tier1", "runs", "run_eperm");
    mkdirSync(runDir, { recursive: true });
    const ownerPath = join(runDir, "agent-owner.json");
    writeCompleteOwner(ownerPath, {
        version: 1,
        runId: "run_eperm",
        pid: 424244,
        binary: process.execPath,
        worktree: join(home, "wt"),
        processStart: "owned-start",
        ownerInstanceId: "eperm",
        jobName: formatSayDoJobName("Local", "eperm", "run_eperm", GEN)
    });
    setRestartPolicyTestHooks({
      hostKind: () => "win32",
      processGroupAlive: () => true,
      processBirth: () => "owned-start"
    });
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      processBirth: () => "owned-start",
      processAlive: () => true,
      jobActive: () => 1,
      jobContainsPid: () => true,
      terminateJob: () => {
        const err = new Error("SECRET");
        Object.defineProperty(err, "code", { value: "EPERM" });
        throw err;
      }
    });
    const audit = auditCollector();
    await expect(
      reapOwnedTier1Agent(
        home,
        {
          run_id: "run_eperm",
          task_id: "tsk_eperm",
          project_id: "prj_restart",
          state: "running",
          worktree_path: join(home, "wt")
        },
        audit.sink
      )
    ).rejects.toThrow(PROCESS_KILL_UNKNOWN);
    expect(existsSync(ownerPath)).toBe(true);
    expect(audit.events.some((event) => event.action === "tier1.orphan_agent_reaped")).toBe(false);
  });

  it("owner 文件存在但内容 invalid 不得当作 already_exited", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-restart-inv-"));
    tempDirs.add(home);
    const runDir = join(home, "tier1", "runs", "run_inv");
    mkdirSync(runDir, { recursive: true });
    writeFileSync(join(runDir, "agent-owner.json"), "{not-json");
    const audit = auditCollector();
    await expect(
      reapOwnedTier1Agent(
        home,
        {
          run_id: "run_inv",
          task_id: "tsk_inv",
          project_id: "prj_restart",
          state: "running",
          worktree_path: join(home, "wt")
        },
        audit.sink
      )
    ).rejects.toThrow(/ownership record invalid/u);
  });

  it("valid-but-dead durable tombstone 返回 already_exited", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-restart-tomb-"));
    tempDirs.add(home);
    const runDir = join(home, "tier1", "runs", "run_tomb");
    mkdirSync(runDir, { recursive: true });
    writeFileSync(
      join(runDir, "agent-owner.json"),
      JSON.stringify(completeAgentOwner({
        version: 1,
        runId: "run_tomb",
        pid: 2_147_483_600,
        binary: process.execPath,
        worktree: join(home, "wt"),
        processStart: "dead-process"
      }))
    );
    const audit = auditCollector();
    await expect(
      reapOwnedTier1Agent(
        home,
        {
          run_id: "run_tomb",
          task_id: "tsk_tomb",
          project_id: "prj_restart",
          state: "running",
          worktree_path: join(home, "wt")
        },
        audit.sink
      )
    ).resolves.toBe("already_exited");
  });

  it("不存在 owner 且无 legacy pid 返回 absent", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-restart-abs-"));
    tempDirs.add(home);
    mkdirSync(join(home, "tier1", "runs", "run_abs"), { recursive: true });
    const audit = auditCollector();
    await expect(
      reapOwnedTier1Agent(
        home,
        {
          run_id: "run_abs",
          task_id: "tsk_abs",
          project_id: "prj_restart",
          state: "running",
          worktree_path: join(home, "wt")
        },
        audit.sink
      )
    ).resolves.toBe("absent");
  });

  it("invalid owner 与 live legacy pid 同时存在时以 record invalid 为第一原因且不得杀进程", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-restart-inv-live-"));
    tempDirs.add(home);
    const runDir = join(home, "tier1", "runs", "run_inv_live");
    mkdirSync(runDir, { recursive: true });
    const legacy = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      detached: true,
      stdio: "ignore"
    });
    if (!legacy.pid) throw new Error("invalid+live 测试进程未获得 pid");
    const legacyPid = legacy.pid;
    spawned.add(legacyPid);
    await once(legacy, "spawn");
    writeFileSync(join(runDir, "agent.pid"), String(legacyPid));
    writeFileSync(join(runDir, "agent-owner.json"), "invalid");
    const audit = auditCollector();
    await expect(
      reapOwnedTier1Agent(
        home,
        {
          run_id: "run_inv_live",
          task_id: "tsk_inv_live",
          project_id: "prj_restart",
          state: "running",
          worktree_path: join(home, "wt")
        },
        audit.sink
      )
    ).rejects.toSatisfy((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      return /ownership record invalid/u.test(message) && !/unverified/u.test(message);
    });
    expect(() => process.kill(legacyPid, 0)).not.toThrow();
  });

  it("owner 缺失但 live legacy pid 必须 ownership unverified 且不得杀进程", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-restart-live-legacy-"));
    tempDirs.add(home);
    const runDir = join(home, "tier1", "runs", "run_live_legacy");
    mkdirSync(runDir, { recursive: true });
    const legacy = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      detached: true,
      stdio: "ignore"
    });
    if (!legacy.pid) throw new Error("live legacy 测试进程未获得 pid");
    const legacyPid = legacy.pid;
    spawned.add(legacyPid);
    await once(legacy, "spawn");
    writeFileSync(join(runDir, "agent.pid"), String(legacyPid));
    const audit = auditCollector();
    await expect(
      reapOwnedTier1Agent(
        home,
        {
          run_id: "run_live_legacy",
          task_id: "tsk_live_legacy",
          project_id: "prj_restart",
          state: "running",
          worktree_path: join(home, "wt")
        },
        audit.sink
      )
    ).rejects.toSatisfy((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      return /ownership unverified/u.test(message) && !/ownership record invalid/u.test(message);
    });
    expect(() => process.kill(legacyPid, 0)).not.toThrow();
  });

  it("reap hook 抛 Proxy/revoked/字符串时受控、保留 owner、不记 reaped", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-restart-hostile-"));
    tempDirs.add(home);
    const runDir = join(home, "tier1", "runs", "run_hostile");
    mkdirSync(runDir, { recursive: true });
    const ownerPath = join(runDir, "agent-owner.json");
    const row = {
      run_id: "run_hostile",
      task_id: "tsk_hostile",
      project_id: "prj_restart",
      state: "running",
      worktree_path: join(home, "wt")
    };
    const writeOwner = (): void => {
      writeCompleteOwner(ownerPath, {
        version: 1,
        runId: "run_hostile",
        pid: 424245,
        binary: process.execPath,
        worktree: join(home, "wt"),
        processStart: "owned-start",
        ownerInstanceId: "hostile",
        jobName: formatSayDoJobName("Local", "hostile", "run_hostile", GEN)
      });
    };
    writeOwner();
    const audit = auditCollector();
    let gets = 0;
    const proxy = new Proxy(new Error("SECRET"), {
      get(target, prop, receiver) {
        gets += 1;
        return Reflect.get(target, prop, receiver);
      }
    });
    const winObs = {
      hostKind: () => "win32" as const,
      processGroupAlive: () => true,
      processBirth: () => "owned-start"
    };
    const winKill = (terminateJob: () => "terminated" | "missing"): void => {
      setRestartPolicyTestHooks(winObs);
      setKillOwnedTreeTestHooks({
        hostKind: () => "win32",
        processBirth: () => "owned-start",
        processAlive: () => true,
        jobActive: () => 1,
        jobContainsPid: () => true,
        terminateJob
      });
    };
    winKill(() => {
      throw proxy;
    });
    await expect(reapOwnedTier1Agent(home, row, audit.sink)).rejects.toThrow(PROCESS_KILL_UNKNOWN);
    expect(gets).toBe(0);
    expect(existsSync(ownerPath)).toBe(true);
    expect(audit.events.some((event) => event.action === "tier1.orphan_agent_reaped")).toBe(false);

    const revoked = Proxy.revocable(new Error("SECRET"), {
      get() {
        gets += 1;
        return "SECRET";
      }
    });
    revoked.revoke();
    winKill(() => {
      throw revoked.proxy;
    });
    await expect(reapOwnedTier1Agent(home, row, audit.sink)).rejects.toThrow(PROCESS_KILL_UNKNOWN);
    expect(gets).toBe(0);
    expect(existsSync(ownerPath)).toBe(true);

    winKill(() => {
      throw "SECRET";
    });
    await expect(reapOwnedTier1Agent(home, row, audit.sink)).rejects.toSatisfy((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      return message === PROCESS_KILL_UNKNOWN && !message.includes("SECRET");
    });
    expect(existsSync(ownerPath)).toBe(true);
    expect(audit.events.some((event) => event.action === "tier1.orphan_agent_reaped")).toBe(false);
  });

  it("Windows 任意 truthy jobName / owner 污染 fail-closed 且不 TerminateJob", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-restart-jobfmt-"));
    tempDirs.add(home);
    const runDir = join(home, "tier1", "runs", "run_fmt");
    mkdirSync(runDir, { recursive: true });
    const ownerPath = join(runDir, "agent-owner.json");
    const row = {
      run_id: "run_fmt",
      task_id: "tsk_fmt",
      project_id: "prj_restart",
      state: "running",
      worktree_path: join(home, "wt")
    };
    let jobKillCalls = 0;
    setRestartPolicyTestHooks({
      hostKind: () => "win32",
      processGroupAlive: () => true,
      processBirth: () => "owned-start"
    });
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      processBirth: () => "owned-start",
      processAlive: () => true,
      jobActive: () => 1,
      jobContainsPid: () => true,
      terminateJob: () => {
        jobKillCalls += 1;
        return "terminated";
      }
    });
    writeCompleteOwner(ownerPath, {
      version: 1,
      runId: "run_fmt",
      pid: 424246,
      binary: process.execPath,
      worktree: join(home, "wt"),
      processStart: "owned-start",
      jobName: true
    });
    const audit = auditCollector();
    await expect(reapOwnedTier1Agent(home, row, audit.sink)).rejects.toThrow(/ownership record invalid/u);
    expect(jobKillCalls).toBe(0);
    expect(existsSync(ownerPath)).toBe(true);

    writeCompleteOwner(ownerPath, {
      version: 1,
      runId: "run_fmt",
      pid: 424246,
      binary: process.execPath,
      worktree: join(home, "wt"),
      processStart: "owned-start",
      jobName: "not-a-job"
    });
    await expect(reapOwnedTier1Agent(home, row, audit.sink)).rejects.toThrow(/ownership record invalid/u);
    expect(jobKillCalls).toBe(0);

    writeCompleteOwner(ownerPath, {
      version: 1,
      runId: "run_fmt",
      pid: 424246,
      binary: process.execPath,
      worktree: join(home, "wt"),
      processStart: "owned-start",
      jobName: "Local\\SayDoJob-other-owner",
      ownerInstanceId: "expected-owner"
    });
    await expect(reapOwnedTier1Agent(home, row, audit.sink)).rejects.toThrow(/ownership record invalid|job name missing/u);
    expect(jobKillCalls).toBe(0);
    expect(existsSync(ownerPath)).toBe(true);
  });

  it("Windows same-name Job + birth mismatch 拒绝杀并保留 owner", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-restart-samename-"));
    tempDirs.add(home);
    const runDir = join(home, "tier1", "runs", "run_same");
    mkdirSync(runDir, { recursive: true });
    const ownerPath = join(runDir, "agent-owner.json");
    writeCompleteOwner(ownerPath, {
      version: 1,
      runId: "run_same",
      pid: 424247,
      binary: process.execPath,
      worktree: join(home, "wt"),
      processStart: "birth-old",
      ownerInstanceId: "same",
      jobName: formatSayDoJobName("Local", "same", "run_same", GEN)
    });
    let jobKillCalls = 0;
    setRestartPolicyTestHooks({
      hostKind: () => "win32",
      processGroupAlive: () => true,
      processBirth: () => "birth-reused"
    });
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      processBirth: () => "birth-reused",
      processAlive: () => true,
      jobActive: () => 1,
      jobContainsPid: () => true,
      terminateJob: () => {
        jobKillCalls += 1;
        return "terminated";
      }
    });
    const audit = auditCollector();
    await expect(reapOwnedTier1Agent(home, {
      run_id: "run_same",
      task_id: "tsk_same",
      project_id: "prj_restart",
      state: "running",
      worktree_path: join(home, "wt")
    }, audit.sink)).rejects.toThrow(/identity mismatch/u);
    expect(jobKillCalls).toBe(0);
    expect(existsSync(ownerPath)).toBe(true);
    expect(audit.events.some((event) => event.action === "tier1.orphan_agent_reaped")).toBe(false);
  });

  it("audit 失败不删 owner、不记 reaped", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-restart-audit-"));
    tempDirs.add(home);
    const runDir = join(home, "tier1", "runs", "run_audit");
    mkdirSync(runDir, { recursive: true });
    const ownerPath = join(runDir, "agent-owner.json");
    writeCompleteOwner(ownerPath, {
      version: 1,
      runId: "run_audit",
      pid: 424248,
      binary: process.execPath,
      worktree: join(home, "wt"),
      processStart: "owned-start",
      ownerInstanceId: "audit",
      jobName: formatSayDoJobName("Local", "audit", "run_audit", GEN)
    });
    let killed = 0;
    setRestartPolicyTestHooks({
      hostKind: () => "win32",
      processGroupAlive: () => true,
      processBirth: () => "owned-start"
    });
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      processBirth: () => "owned-start",
      processAlive: () => false,
      jobActive: () => (killed > 0 ? 0 : 1),
      jobContainsPid: () => true,
      terminateJob: () => {
        killed += 1;
        return "terminated";
      }
    });
    const events: AuditEvent[] = [];
    const sink: AuditSink = {
      record(event) {
        if (event.action === "tier1.orphan_agent_reaped") throw new Error("SECRET");
        events.push(event);
        return { id: `aud_${events.length}` };
      }
    };
    await expect(reapOwnedTier1Agent(home, {
      run_id: "run_audit",
      task_id: "tsk_audit",
      project_id: "prj_restart",
      state: "running",
      worktree_path: join(home, "wt")
    }, sink)).rejects.toSatisfy((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      return message === PROCESS_KILL_UNKNOWN && !message.includes("SECRET");
    });
    expect(killed).toBe(1);
    expect(existsSync(ownerPath)).toBe(true);
    expect(events.some((event) => event.action === "tier1.orphan_agent_reaped")).toBe(false);
  });

  it("Windows birth exact + live PID + empty/missing/unknown Job 不得 already_exited、不删 owner、不报 reaped", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-restart-empty-live-"));
    tempDirs.add(home);
    const runDir = join(home, "tier1", "runs", "run_empty_live");
    mkdirSync(runDir, { recursive: true });
    const ownerPath = join(runDir, "agent-owner.json");
    const row = {
      run_id: "run_empty_live",
      task_id: "tsk_empty_live",
      project_id: "prj_restart",
      state: "running",
      worktree_path: join(home, "wt")
    };
    writeCompleteOwner(ownerPath, {
      version: 1,
      runId: "run_empty_live",
      pid: 424260,
      binary: process.execPath,
      worktree: join(home, "wt"),
      processStart: "owned-start",
      ownerInstanceId: "empty",
      jobName: formatSayDoJobName("Local", "empty", "run_empty_live", GEN)
    });
    const cases: Array<number | "missing"> = [0, "missing"];
    for (const active of cases) {
      let terminated = 0;
      setRestartPolicyTestHooks({ hostKind: () => "win32" });
      setKillOwnedTreeTestHooks({
        hostKind: () => "win32",
        processBirth: () => "owned-start",
        processAlive: () => true,
        jobActive: () => active,
        jobContainsPid: () => (active === "missing" ? "missing" : false),
        terminateJob: () => {
          terminated += 1;
          return "terminated";
        }
      });
      const audit = auditCollector();
      await expect(reapOwnedTier1Agent(home, row, audit.sink)).rejects.toThrow(/empty while process alive|identity unverified/u);
      expect(terminated).toBe(0);
      expect(existsSync(ownerPath)).toBe(true);
      expect(audit.events.some((event) => event.action === "tier1.orphan_agent_reaped")).toBe(false);
    }
    setRestartPolicyTestHooks({ hostKind: () => "win32" });
    setKillOwnedTreeTestHooks({
      hostKind: () => "win32",
      processBirth: () => "owned-start",
      processAlive: () => true,
      jobActive: () => 0,
      jobContainsPid: () => "unknown",
      terminateJob: () => "terminated"
    });
    const audit = auditCollector();
    await expect(reapOwnedTier1Agent(home, row, audit.sink)).rejects.toThrow(/membership unknown|identity unverified/u);
    expect(existsSync(ownerPath)).toBe(true);
    expect(audit.events.some((event) => event.action === "tier1.orphan_agent_reaped")).toBe(false);
  });

  it("正常清除路径 CAS：旧 identity 不得 unlink successor owner", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-agent-cas-"));
    tempDirs.add(home);
    const runId = "run_cas";
    const runDir = join(home, "tier1", "runs", runId);
    mkdirSync(runDir, { recursive: true });
    const ownerPath = join(runDir, "agent-owner.json");
    writeCompleteOwner(ownerPath, {
      runId,
      pid: 4242,
      worktree: join(home, "wt"),
      processStart: "birth-a",
      ownerInstanceId: "owner"
    });
    const parsed = parseAgentOwnerRecord(JSON.parse(readFileSync(ownerPath, "utf8")) as unknown, runId);
    expect(parsed.status).toBe("valid");
    if (parsed.status !== "valid") return;
    const captured = agentOwnerIdentity(parsed.record);
    const successorGen = "01234567-89ab-cdef-0123-456789abcde0";
    writeCompleteOwner(ownerPath, {
      runId,
      pid: 4242,
      worktree: join(home, "wt"),
      processStart: "birth-b",
      ownerInstanceId: "owner",
      generation: successorGen,
      commandToken: `saydo-child-${successorGen}`
    });
    writeFileSync(join(runDir, "agent.pid"), "4242");
    await releaseAgentOwnershipIfIdentity(home, runId, captured);
    expect(existsSync(ownerPath)).toBe(true);
    expect(JSON.parse(readFileSync(ownerPath, "utf8")).generation).toBe(successorGen);
    expect(existsSync(join(runDir, "agent.pid"))).toBe(true);
  });

  it("running 且无 durable marker 时不得清 ownership", async () => {
    expect(shouldClearAgentOwnershipAfterDurable({
      state: "running",
      finalize_pending_json: null,
      restart_pending_at: null
    })).toBe(false);
    expect(shouldClearAgentOwnershipAfterDurable({
      state: "ready_for_review",
      finalize_pending_json: null,
      restart_pending_at: null
    })).toBe(true);
    const home = mkdtempSync(join(tmpdir(), "saydo-agent-durable-"));
    tempDirs.add(home);
    const runId = "run_keep";
    const runDir = join(home, "tier1", "runs", runId);
    mkdirSync(runDir, { recursive: true });
    const ownerPath = join(runDir, "agent-owner.json");
    writeCompleteOwner(ownerPath, {
      runId,
      pid: 4242,
      worktree: join(home, "wt"),
      processStart: "birth-a",
      ownerInstanceId: "owner"
    });
    const parsed = parseAgentOwnerRecord(JSON.parse(readFileSync(ownerPath, "utf8")) as unknown, runId);
    expect(parsed.status).toBe("valid");
    if (parsed.status !== "valid") return;
    const kept = await releaseAgentOwnershipAfterDurable(
      home,
      runId,
      agentOwnerIdentity(parsed.record),
      { state: "running", finalize_pending_json: null, restart_pending_at: null }
    );
    expect(kept).toBe(false);
    expect(existsSync(ownerPath)).toBe(true);
    const cleared = await releaseAgentOwnershipAfterDurable(
      home,
      runId,
      agentOwnerIdentity(parsed.record),
      { state: "ready_for_review", finalize_pending_json: null, restart_pending_at: null }
    );
    expect(cleared).toBe(true);
    expect(existsSync(ownerPath)).toBe(false);
  });

  it("无 captured identity 时不得盲删现存 owner", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-no-expected-"));
    tempDirs.add(home);
    const runId = "run_keep_no_id";
    const runDir = join(home, "tier1", "runs", runId);
    mkdirSync(runDir, { recursive: true });
    const ownerPath = join(runDir, "agent-owner.json");
    writeCompleteOwner(ownerPath, {
      runId,
      pid: 4242,
      worktree: join(home, "wt"),
      processStart: "birth-a",
      ownerInstanceId: "owner"
    });
    writeFileSync(join(runDir, "agent.pid"), "4242");
    await releaseAgentOwnershipIfIdentity(home, runId, undefined);
    expect(existsSync(ownerPath)).toBe(true);
    expect(existsSync(join(runDir, "agent.pid"))).toBe(true);
  });

  it("normal release 必须先写 reap audit 再 unlink", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-release-audit-"));
    tempDirs.add(home);
    const runId = "run_audit";
    const runDir = join(home, "tier1", "runs", runId);
    mkdirSync(runDir, { recursive: true });
    const ownerPath = join(runDir, "agent-owner.json");
    writeCompleteOwner(ownerPath, {
      runId,
      pid: 4242,
      worktree: join(home, "wt"),
      processStart: "birth-a",
      ownerInstanceId: "owner"
    });
    const parsed = parseAgentOwnerRecord(JSON.parse(readFileSync(ownerPath, "utf8")) as unknown, runId);
    expect(parsed.status).toBe("valid");
    if (parsed.status !== "valid") return;
    await releaseAgentOwnershipIfIdentity(home, runId, agentOwnerIdentity(parsed.record));
    expect(existsSync(ownerPath)).toBe(false);
    const audit = readFileSync(join(home, "audit", "reap.jsonl"), "utf8");
    expect(audit).toContain("tier1.agent_owner_released");
    expect(audit).toContain(runId);
  });

  it("reapOwnedTier1Agent：successor 在 kill 与 delete 之间发布后不得被删", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-reap-cas-"));
    tempDirs.add(home);
    const runId = "run_succ";
    const runDir = join(home, "tier1", "runs", runId);
    mkdirSync(runDir, { recursive: true });
    const ownerPath = join(runDir, "agent-owner.json");
    writeCompleteOwner(ownerPath, {
      runId,
      pid: 4242,
      worktree: join(home, "wt"),
      processStart: "birth-a",
      ownerInstanceId: "owner"
    });
    const successorGen = "01234567-89ab-cdef-0123-456789abcde0";
    setKillOwnedTreeTestHooks({
      processBirth: () => "birth-a",
      processAnchor: () => ({ pgid: 4242, command: `${process.execPath} saydo-child-${GEN}` }),
      processAlive: () => true,
      groupAlive: () => true,
      ...(process.platform === "win32"
        ? {
            jobActive: () => 1,
            jobContainsPid: () => true,
            terminateJob: () => "terminated" as const
          }
        : {})
    });
    setRestartPolicyTestHooks({
      processGroupAlive: () => true,
      processBirth: () => "birth-a",
      afterKillBeforeDelete: () => {
        writeCompleteOwner(ownerPath, {
          runId,
          pid: 4242,
          worktree: join(home, "wt"),
          processStart: "birth-a",
          ownerInstanceId: "owner",
          generation: successorGen,
          commandToken: `saydo-child-${successorGen}`
        });
      }
    });
    const { events, sink } = auditCollector();
    const outcome = await reapOwnedTier1Agent(home, {
      run_id: runId,
      task_id: "tsk",
      project_id: "prj",
      state: "running",
      worktree_path: join(home, "wt")
    }, sink);
    expect(existsSync(ownerPath)).toBe(true);
    expect(JSON.parse(readFileSync(ownerPath, "utf8")).generation).toBe(successorGen);
    expect(outcome).toBe("identity_changed");
    expect(events.some((event) => event.action === "tier1.orphan_agent_reaped")).toBe(false);
  });

  it("executor running 无 marker 时清 ownership 必须保留 owner 文件", async () => {
    expect(shouldClearAgentOwnershipAfterDurable({
      state: "running",
      finalize_pending_json: null,
      restart_pending_at: null
    })).toBe(false);
    const home = mkdtempSync(join(tmpdir(), "saydo-exec-row-"));
    tempDirs.add(home);
    const runId = "run_exec_row";
    const runDir = join(home, "tier1", "runs", runId);
    mkdirSync(runDir, { recursive: true });
    const ownerPath = join(runDir, "agent-owner.json");
    writeCompleteOwner(ownerPath, {
      runId,
      pid: 4242,
      worktree: join(home, "wt"),
      processStart: "birth-a",
      ownerInstanceId: "owner"
    });
    const parsed = parseAgentOwnerRecord(JSON.parse(readFileSync(ownerPath, "utf8")) as unknown, runId);
    expect(parsed.status).toBe("valid");
    if (parsed.status !== "valid") return;
    const kept = await releaseAgentOwnershipAfterDurable(
      home,
      runId,
      agentOwnerIdentity(parsed.record),
      { state: "running", finalize_pending_json: null, restart_pending_at: null }
    );
    expect(kept).toBe(false);
    expect(existsSync(ownerPath)).toBe(true);
  });

  it("agent durable owner 写必须走 HOME boundary：持锁时不得写成", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-agent-write-lock-"));
    tempDirs.add(home);
    const holdMarker = join(home, "holding.marker");
    const writeMarker = join(home, "wrote.marker");
    const attemptMarker = join(home, "attempt.marker");
    const tsx = fileURLToPath(new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url));
    const worker = fileURLToPath(new URL("./fixtures/owner-boundary-worker.mjs", import.meta.url));
    const envBase = {
      ...process.env,
      SAYDO_LOCK_HOME: home,
      SAYDO_LOCK_MODULE: fileURLToPath(new URL("../../platform/src/homeLock.ts", import.meta.url)),
      SAYDO_REGISTRY_MODULE: fileURLToPath(new URL("../src/runtimeChildRegistry.ts", import.meta.url)),
      SAYDO_RESTART_MODULE: fileURLToPath(new URL("../src/tier1/restartPolicy.ts", import.meta.url)),
      SAYDO_IDENTITY_MODULE: fileURLToPath(new URL("../../platform/src/jobIdentity.ts", import.meta.url)),
      SAYDO_EXECUTOR_MODULE: fileURLToPath(new URL("../src/tier1/executor.ts", import.meta.url))
    };
    const holder = spawn(process.execPath, [tsx, worker], {
      env: { ...envBase, SAYDO_LOCK_ROLE: "hold", SAYDO_LOCK_MARKER: holdMarker },
      stdio: "ignore"
    });
    const started = Date.now();
    while (!existsSync(holdMarker) && Date.now() - started < 8_000) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(existsSync(holdMarker)).toBe(true);
    const waiter = spawn(process.execPath, [tsx, worker], {
      env: {
        ...envBase,
        SAYDO_LOCK_ROLE: "agent-write",
        SAYDO_LOCK_MARKER: writeMarker,
        SAYDO_LOCK_ATTEMPT: attemptMarker
      },
      stdio: "ignore"
    });
    const attemptStarted = Date.now();
    while (!existsSync(attemptMarker) && Date.now() - attemptStarted < 12_000) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(existsSync(attemptMarker)).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(existsSync(writeMarker)).toBe(false);
    expect(existsSync(join(home, "tier1", "runs", "run_write", "agent-owner.json"))).toBe(false);
    holder.kill("SIGKILL");
    await new Promise<void>((resolve) => {
      if (holder.exitCode !== null) resolve();
      else holder.once("exit", () => resolve());
    });
    const waiterExit = await new Promise<number>((resolve, reject) => {
      waiter.once("exit", (code) => resolve(code ?? 1));
      setTimeout(() => reject(new Error("agent-write waiter timeout")), 12_000);
    });
    if (waiterExit !== 0) {
      throw new Error(`agent-write exit ${String(waiterExit)}:${existsSync(`${writeMarker}.error`) ? readFileSync(`${writeMarker}.error`, "utf8") : "no-error"}`);
    }
    expect(existsSync(writeMarker)).toBe(true);
  }, 30_000);
});
