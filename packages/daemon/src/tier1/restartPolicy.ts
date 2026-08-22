import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import { verifiedProjectWorkspace } from "../storage/dao/projects.js";
import { classifyActiveWork } from "./activeWorkClassifier.js";
import { hostKind, killOwnedTree, processAlive, processAnchor, processBirth } from "@saydo/platform";

export const RESTART_RECOVERABLE_STATES = "('reserved','running','step_paused')";
const DRAINABLE_TIER1_STATES = "('reserved','running','step_paused','cancel_requested')";
export const RESTART_RECOVERABLE_PREDICATE =
  `tier1_runs.state IN ${RESTART_RECOVERABLE_STATES} AND tasks.status='running'`;

export interface RestartCandidate {
  run_id: string;
  task_id: string;
  project_id: string;
  state: string;
  worktree_path: string;
}

export interface AgentOwnershipRecord {
  version: 1;
  runId: string;
  pid: number;
  binary: string;
  worktree: string;
  processStart: string;
  commandToken?: string;
  ownerPid?: number;
  ownerInstanceId?: string;
  jobName?: string;
}

function drainCandidates(db: Db): RestartCandidate[] {
  return db.prepare(
    `SELECT tier1_runs.id AS run_id, tier1_runs.task_id AS task_id,
            tasks.project_id AS project_id, tier1_runs.state AS state,
            tier1_runs.worktree_path AS worktree_path
     FROM tier1_runs JOIN tasks ON tasks.id=tier1_runs.task_id
     WHERE tier1_runs.state IN ${DRAINABLE_TIER1_STATES}`
  ).all() as RestartCandidate[];
}

export function restartCandidates(db: Db): RestartCandidate[] {
  return drainCandidates(db).filter(
    (row) => row.state !== "cancel_requested" &&
      (db.prepare("SELECT status FROM tasks WHERE id=?").get(row.task_id) as { status: string } | undefined)?.status === "running"
  );
}

export function tier1RecoveryPrerequisite(db: Db, row: RestartCandidate): string | null {
  try {
    const repoPath = verifiedProjectWorkspace(db, row.project_id);
    if (row.state !== "reserved" && !existsSync(join(row.worktree_path, ".git"))) return null;
    return repoPath;
  } catch {
    return null;
  }
}

export function isTier1RestartRecoverable(db: Db, row: RestartCandidate): boolean {
  return tier1RecoveryPrerequisite(db, row) !== null;
}

export function recoverableTier1Count(db: Db): number {
  return restartCandidates(db).filter((row) => isTier1RestartRecoverable(db, row)).length;
}

function readOwnedAgent(saydoHome: string, row: RestartCandidate): AgentOwnershipRecord | null {
  try {
    const parsed = JSON.parse(
      readFileSync(join(saydoHome, "tier1", "runs", row.run_id, "agent-owner.json"), "utf8")
    ) as Partial<AgentOwnershipRecord>;
    if (
      parsed.version !== 1 ||
      parsed.runId !== row.run_id ||
      parsed.worktree !== row.worktree_path ||
      !Number.isInteger(parsed.pid) ||
      (parsed.pid ?? 0) <= 1 ||
      typeof parsed.binary !== "string" ||
      parsed.binary.length === 0 ||
      typeof parsed.processStart !== "string" ||
      parsed.processStart.length === 0
    ) return null;
    return parsed as AgentOwnershipRecord;
  } catch {
    return null;
  }
}

/**
 * 受管 agent 的身份锚。
 *
 * win32:具名 Job + birth 已足够,Job 句柄本身就把「哪些进程属于这次执行」钉死。
 * POSIX:收口走 `kill(-pid)` 作用于**整个进程组**,只比对秒级 birth 时间戳挡不住 PID 复用——
 * 复用到同一数值且同秒启动的无关进程,会让我们把它所在的组整组杀掉。因此在取 birth 之前
 * 必须先证明:(1) pid 仍是自身进程组的组长(pgid === pid),(2) 命令行仍是我们启动的那个
 * 二进制 / 一次性 commandToken。任一不成立即返回 null,由调用方走 fail-closed 分支。
 */
export function readOwnedAgentProcessStart(pid: number, binary?: string, commandToken?: string): string | null {
  if (hostKind() === "win32") return processBirth(pid);
  const anchor = processAnchor(pid);
  if (!anchor || anchor.pgid !== pid) return null;
  if (binary !== undefined || commandToken !== undefined) {
    const command = anchor.command;
    if (command === null) return null;
    if (binary !== undefined && !command.includes(binary)) return null;
    if (commandToken !== undefined && !command.includes(commandToken)) return null;
  }
  return processBirth(pid);
}

function processGroupAlive(pgid: number): boolean {
  if (hostKind() === "win32") return processAlive(pgid);
  try {
    process.kill(-pgid, 0);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ESRCH") return false;
    if ((err as NodeJS.ErrnoException).code === "EPERM") return true;
    throw err;
  }
}

function legacyPid(saydoHome: string, row: RestartCandidate): number | null {
  try {
    const pid = Number(readFileSync(join(saydoHome, "tier1", "runs", row.run_id, "agent.pid"), "utf8").trim());
    return Number.isInteger(pid) && pid > 1 ? pid : null;
  } catch {
    return null;
  }
}

function verifiedOwnedAgent(saydoHome: string, row: RestartCandidate, audit: AuditSink): AgentOwnershipRecord | null {
  const record = readOwnedAgent(saydoHome, row);
  const pid = legacyPid(saydoHome, row);
  if (!record) {
    if (pid && (processGroupAlive(pid) || (() => {
      try {
        process.kill(pid, 0);
        return true;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ESRCH") return false;
        throw err;
      }
    })())) {
      throw new Error(`tier1 live legacy agent ownership unverified:${row.run_id}`);
    }
    audit.record({ actor: "daemon", action: "tier1.orphan_agent_reap_skipped", meta: { runId: row.run_id, reason: "ownership_unverified" } });
    return null;
  }
  if (pid !== null && pid !== record.pid) {
    if (processGroupAlive(pid) || processGroupAlive(record.pid)) {
      throw new Error(`tier1 agent ownership records disagree:${row.run_id}`);
    }
    return null;
  }
  const observedStart = readOwnedAgentProcessStart(record.pid, record.binary, record.commandToken);
  if (observedStart !== null && observedStart !== record.processStart) {
    throw new Error(`tier1 agent ownership identity mismatch:${row.run_id}`);
  }
  if (observedStart === null) {
    let leaderAlive = false;
    try {
      process.kill(record.pid, 0);
      leaderAlive = true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ESRCH") throw err;
    }
    if (leaderAlive) throw new Error(`tier1 agent ownership identity unverified:${row.run_id}`);
    if (hostKind() === "win32") {
      if (!record.jobName) return null;
      return record;
    }
    // A4: leader 已死时不得仅凭数值 PGID 收口——PID/PGID 复用可误杀无关组。
    // 无法证明存活成员的 birth identity 时保留 owner、fail-closed。
    if (processGroupAlive(record.pid)) {
      throw new Error(`tier1 agent process group alive after leader death:${row.run_id}`);
    }
    return null;
  }
  if (!processGroupAlive(record.pid)) return null;
  return record;
}

/** 只终止带版本化 ownership 记录且仍匹配进程组/命令的 agent，防 PID 复用误杀。 */
export async function reapOwnedTier1Agent(
  saydoHome: string,
  row: RestartCandidate,
  audit: AuditSink
): Promise<void> {
  const record = verifiedOwnedAgent(saydoHome, row, audit);
  if (!record) return;
  try {
    if (hostKind() === "win32") {
      if (!record.jobName) throw new Error(`tier1 agent job name missing:${row.run_id}`);
      await killOwnedTree({ pid: record.pid, expectedBirth: record.processStart, jobName: record.jobName });
    } else {
      process.kill(-record.pid, "SIGKILL");
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ESRCH") throw err;
  }
  const deadline = Date.now() + 2_000;
  while (processGroupAlive(record.pid)) {
    if (Date.now() >= deadline) throw new Error(`tier1 agent process group drain timeout:${row.run_id}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  audit.record({ actor: "daemon", action: "tier1.orphan_agent_reaped", meta: { runId: row.run_id, pid: record.pid } });
}

/** 执行器未武装时仍按同一 durable predicate 标记，并清理已验证 ownership 的旧 agent。 */
export async function markDurableTier1RestartPending(
  db: Db,
  audit: AuditSink,
  saydoHome: string,
  reason: string,
  nowIso = new Date().toISOString()
): Promise<{ recoverableTier1: number; abortedUnrecoverable: number }> {
  const candidates = drainCandidates(db);
  const rows = candidates.filter((row) => {
    if (row.state === "cancel_requested") return false;
    if ((db.prepare("SELECT status FROM tasks WHERE id=?").get(row.task_id) as { status: string } | undefined)?.status !== "running") {
      return false;
    }
    if (!isTier1RestartRecoverable(db, row)) return false;
    // B3: graceful prior-running 仅 exact native key 可恢复；reserved 可无钥匙重走供给。
    if (row.state !== "reserved") {
      const sid = (db.prepare("SELECT native_session_id AS s FROM tier1_runs WHERE id=?").get(row.run_id) as { s: string | null } | undefined)?.s;
      if (!sid) return false;
    }
    return true;
  });
  const tx = db.transaction(() => {
    for (const row of rows) {
      db.prepare(
        `UPDATE tier1_runs SET restart_pending_at=?, restart_reason=?, updated_at=?
         WHERE id=? AND state IN ${RESTART_RECOVERABLE_STATES}`
      ).run(nowIso, reason.slice(0, 80), nowIso, row.run_id);
      audit.record({
        actor: "daemon",
        action: "tier1.restart_pending",
        meta: { taskId: row.task_id, runId: row.run_id, reason: reason.slice(0, 80), executorDisabled: true }
      });
    }
  });
  tx();
  await Promise.all(candidates.map((row) => reapOwnedTier1Agent(saydoHome, row, audit)));
  const classified = classifyActiveWork(db, 0, { requireNativeForGracefulRunning: true });
  // recoverable = 本轮实际挂上 marker 且通过 B3 native/reserved 门的数量。
  return {
    recoverableTier1: rows.length,
    abortedUnrecoverable: classified.abortedUnrecoverable
  };
}
