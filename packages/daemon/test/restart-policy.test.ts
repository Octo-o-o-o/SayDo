import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assignPidToJob,
  closeNamedJob,
  createNamedJob,
  nativeSync,
  type NamedJob
} from "@saydo/platform";
import type { AuditEvent, AuditSink } from "../src/obs/audit.js";
import { openDb } from "../src/storage/db.js";
import {
  markDurableTier1RestartPending,
  readOwnedAgentProcessStart,
  reapOwnedTier1Agent,
  recoverableTier1Count
} from "../src/tier1/restartPolicy.js";

const spawned = new Set<number>();
const tempDirs = new Set<string>();
const jobs = new Set<NamedJob>();

afterEach(() => {
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
  }
  spawned.clear();
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.clear();
});

function attachJob(pid: number): NamedJob | undefined {
  if (process.platform !== "win32") return undefined;
  nativeSync();
  const job = createNamedJob(`Local\\SayDoTest-${randomUUID()}`);
  assignPidToJob(job, pid);
  jobs.add(job);
  return job;
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
    const job = attachJob(childPid);
    const runDir = join(home, "tier1", "runs", "run_owned");
    mkdirSync(runDir, { recursive: true });
    const processStart = readOwnedAgentProcessStart(childPid, process.execPath);
    if (!processStart) throw new Error("无法读取测试子进程 identity");
    writeFileSync(
      join(runDir, "agent-owner.json"),
      JSON.stringify({
        version: 1,
        runId: "run_owned",
        pid: childPid,
        binary: process.execPath,
        worktree,
        processStart,
        ...(job ? { jobName: job.name } : {})
      })
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
    const job2 = attachJob(child2Pid);
    const processStart2 = readOwnedAgentProcessStart(child2Pid, process.execPath);
    if (!processStart2) throw new Error("无法读取测试子进程2 identity");
    writeFileSync(
      join(runDir, "agent-owner.json"),
      JSON.stringify({
        version: 1,
        runId: "run_owned",
        pid: child2Pid,
        binary: process.execPath,
        worktree,
        processStart: processStart2,
        ...(job2 ? { jobName: job2.name } : {})
      })
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
          `const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore',detached:true});` +
          `c.unref();writeFileSync(${JSON.stringify(childPidPath)},String(c.pid));setTimeout(()=>process.exit(0),200)`
      ],
      { detached: true, stdio: "ignore" }
    );
    if (!leader.pid) throw new Error("组长测试进程未获得 pid");
    const leaderPid = leader.pid;
    spawned.add(leaderPid);
    await once(leader, "spawn");
    const leaderJob = attachJob(leaderPid);
    const leaderStart = readOwnedAgentProcessStart(leaderPid, process.execPath);
    if (!leaderStart) throw new Error("无法读取组长 identity");
    const missingRunDir = join(home, "tier1", "runs", "run_missing");
    mkdirSync(missingRunDir, { recursive: true });
    writeFileSync(
      join(missingRunDir, "agent-owner.json"),
      JSON.stringify({
        version: 1,
        runId: "run_missing",
        pid: leaderPid,
        binary: process.execPath,
        worktree: join(home, "missing"),
        processStart: leaderStart,
        ...(leaderJob ? { jobName: leaderJob.name } : {})
      })
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
    ).rejects.toThrow("ownership unverified");
    expect(() => process.kill(legacyPid, 0)).not.toThrow();
    } finally {
      db.close();
    }
  });
});
