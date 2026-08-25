import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import { verifiedProjectWorkspace } from "../storage/dao/projects.js";
import { classifyActiveWork } from "./activeWorkClassifier.js";
import {
  agentOwnerIdentity,
  appendReapAudit,
  classifyKillProbe,
  commitOwnerReapIfIdentity,
  hostKind,
  isOwnerIdentityCasError,
  isSayDoIdentityToken,
  killOwnedTree,
  observeVerifiedOwnedJob,
  parseAgentOwnerRecord,
  processAlive,
  PROCESS_KILL_UNKNOWN,
  PROCESS_PROBE_UNKNOWN,
  readOwnErrnoCode,
  readOwnedProcessBirth,
  sayDoJobNameMatchesIdentity,
  withHomeOwnerBoundary,
  type HostKind,
  type OwnerImmutableIdentity
} from "@saydo/platform";

interface RestartPolicyTestHooks {
  hostKind?: () => HostKind;
  processGroupAlive?: (pid: number) => boolean;
  processBirth?: (pid: number) => string | null;
  afterKillBeforeDelete?: () => void | Promise<void>;
}

let restartPolicyTestHooks: RestartPolicyTestHooks = {};

export function setRestartPolicyTestHooks(hooks: RestartPolicyTestHooks | null): void {
  restartPolicyTestHooks = hooks ?? {};
}

function effectiveHostKind(): HostKind {
  return restartPolicyTestHooks.hostKind?.() ?? hostKind();
}

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
  finalize_pending_json?: string | null;
}

export interface AgentOwnershipRecord {
  version: 1;
  runId: string;
  pid: number;
  binary: string;
  worktree: string;
  processStart: string;
  kind: string;
  commandToken: string;
  generation: string;
  ownerPid: number;
  ownerInstanceId: string;
  jobName: string;
}

export type OrphanAgentReapOutcome = "absent" | "already_exited" | "reaped" | "identity_changed";

function drainCandidates(db: Db): RestartCandidate[] {
  return db.prepare(
    `SELECT tier1_runs.id AS run_id, tier1_runs.task_id AS task_id,
            tasks.project_id AS project_id, tier1_runs.state AS state,
            tier1_runs.worktree_path AS worktree_path,
            tier1_runs.finalize_pending_json AS finalize_pending_json
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

type OwnerFile =
  | { status: "absent" }
  | { status: "invalid" }
  | { status: "valid"; record: AgentOwnershipRecord };

const restartPolicyErrors = new WeakSet<object>();

function policyError(message: string): Error {
  const err = new Error(message);
  restartPolicyErrors.add(err);
  return err;
}

function jobBoundToOwner(jobName: string, record: AgentOwnershipRecord): boolean {
  return sayDoJobNameMatchesIdentity(jobName, record.ownerInstanceId, record.runId, record.generation);
}

function projectReapFailure(err: unknown): Error {
  if (typeof err === "object" && err !== null && restartPolicyErrors.has(err)) return err as Error;
  return policyError(PROCESS_KILL_UNKNOWN);
}

function win32JobNameAbsent(raw: unknown): boolean {
  if (typeof raw !== "object" || raw === null) return true;
  if (!Object.prototype.hasOwnProperty.call(raw, "jobName")) return true;
  const jobName = (raw as { jobName?: unknown }).jobName;
  return jobName === undefined || jobName === null || jobName === "";
}

function readOwnedAgentFile(saydoHome: string, row: RestartCandidate): OwnerFile {
  const ownerPath = join(saydoHome, "tier1", "runs", row.run_id, "agent-owner.json");
  if (!existsSync(ownerPath)) return { status: "absent" };
  try {
    const raw = JSON.parse(readFileSync(ownerPath, "utf8")) as unknown;
    if (effectiveHostKind() === "win32" && win32JobNameAbsent(raw)) {
      throw policyError(`tier1 agent job name missing:${row.run_id}`);
    }
    const parsed = parseAgentOwnerRecord(raw, row.run_id);
    if (parsed.status !== "valid") return { status: "invalid" };
    if (parsed.record.worktree !== row.worktree_path) return { status: "invalid" };
    return { status: "valid", record: parsed.record as AgentOwnershipRecord };
  } catch (err) {
    if (typeof err === "object" && err !== null && restartPolicyErrors.has(err)) throw err;
    return { status: "invalid" };
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
  return readOwnedProcessBirth(pid, binary, commandToken);
}

function processGroupAlive(pgid: number, jobName?: string): boolean {
  if (restartPolicyTestHooks.processGroupAlive) return restartPolicyTestHooks.processGroupAlive(pgid);
  if (effectiveHostKind() === "win32") {
    if (jobName) {
      throw policyError(PROCESS_PROBE_UNKNOWN);
    }
    return processAlive(pgid);
  }
  try {
    process.kill(-pgid, 0);
    return true;
  } catch (err) {
    const kind = classifyKillProbe(err);
    if (kind === "gone") return false;
    if (kind === "alive") return true;
    throw policyError(PROCESS_PROBE_UNKNOWN);
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
  const file = readOwnedAgentFile(saydoHome, row);
  if (file.status === "invalid") throw policyError(`tier1 agent ownership record invalid:${row.run_id}`);
  const pid = legacyPid(saydoHome, row);
  if (file.status === "absent") {
    if (pid && (processGroupAlive(pid) || (() => {
      try {
        process.kill(pid, 0);
        return true;
      } catch (err) {
        const kind = classifyKillProbe(err);
        if (kind === "gone") return false;
        if (kind === "alive") return true;
        throw policyError(PROCESS_PROBE_UNKNOWN);
      }
    })())) {
      throw policyError(`tier1 live legacy agent ownership unverified:${row.run_id}`);
    }
    audit.record({ actor: "daemon", action: "tier1.orphan_agent_reap_skipped", meta: { runId: row.run_id, reason: "ownership_unverified" } });
    return null;
  }
  const record = file.record;
  if (pid !== null && pid !== record.pid) {
    if (processGroupAlive(pid, record.jobName) || processGroupAlive(record.pid, record.jobName)) {
      throw policyError(`tier1 agent ownership records disagree:${row.run_id}`);
    }
    return null;
  }
  if (effectiveHostKind() === "win32") {
    if (
      !record.jobName ||
      !isSayDoIdentityToken(record.ownerInstanceId) ||
      !isSayDoIdentityToken(record.runId) ||
      !jobBoundToOwner(record.jobName, record)
    ) {
      throw policyError(`tier1 agent job name missing:${row.run_id}`);
    }
    let observed;
    try {
      observed = observeVerifiedOwnedJob({
        jobName: record.jobName,
        ownerInstanceId: record.ownerInstanceId,
        runId: record.runId,
        generation: record.generation,
        pid: record.pid,
        expectedBirth: record.processStart
      });
    } catch (err) {
      throw projectReapFailure(err);
    }
    if (observed.kind === "fail-closed") {
      if (observed.reason.includes("mismatch")) {
        throw policyError(`tier1 agent ownership identity mismatch:${row.run_id}`);
      }
      if (observed.reason.includes("empty while process alive")) {
        throw policyError(`tier1 agent job empty while process alive:${row.run_id}`);
      }
      throw policyError(`tier1 agent ownership identity unverified:${row.run_id}`);
    }
    if (observed.kind === "already_exited") return null;
    return record;
  }
  const observedStart = readOwnedAgentProcessStart(record.pid, record.binary, record.commandToken);
  if (observedStart !== null && observedStart !== record.processStart) {
    throw policyError(`tier1 agent ownership identity mismatch:${row.run_id}`);
  }
  if (observedStart === null) {
    let leaderAlive = false;
    try {
      process.kill(record.pid, 0);
      leaderAlive = true;
    } catch (err) {
      const kind = classifyKillProbe(err);
      if (kind === "gone") leaderAlive = false;
      else if (kind === "alive") leaderAlive = true;
      else throw policyError(PROCESS_PROBE_UNKNOWN);
    }
    if (leaderAlive) throw policyError(`tier1 agent ownership identity unverified:${row.run_id}`);
    // A4: leader 已死时不得仅凭数值 PGID 收口——PID/PGID 复用可误杀无关组。
    // 无法证明存活成员的 birth identity 时保留 owner、fail-closed。
    if (processGroupAlive(record.pid, record.jobName)) {
      throw policyError(`tier1 agent process group alive after leader death:${row.run_id}`);
    }
    return null;
  }
  if (!processGroupAlive(record.pid, record.jobName)) return null;
  return record;
}

/** 只终止带版本化 ownership 记录且仍匹配进程组/命令的 agent，防 PID 复用误杀。 */
export async function reapOwnedTier1Agent(
  saydoHome: string,
  row: RestartCandidate,
  audit: AuditSink
): Promise<OrphanAgentReapOutcome> {
  const ownerPath = join(saydoHome, "tier1", "runs", row.run_id, "agent-owner.json");
  const hadDurableOwner = existsSync(ownerPath);
  // 兼容旧版只落 agent.pid 的 run：即使进程已在 daemon 崩溃前快速退出，pid 文件本身
  // 仍是“本 run 曾启动过 agent”的 durable tombstone，恢复时不得误判为 absent 再 spawn。
  const hadLegacyPid = legacyPid(saydoHome, row) !== null;
  const record = verifiedOwnedAgent(saydoHome, row, audit);
  if (!record) {
    return hadDurableOwner || hadLegacyPid ? "already_exited" : "absent";
  }
  try {
    await killOwnedTree({
      pid: record.pid,
      expectedBirth: record.processStart,
      ...(effectiveHostKind() === "win32"
        ? {
            jobName: record.jobName,
            ownerInstanceId: record.ownerInstanceId,
            runId: record.runId,
            generation: record.generation
          }
        : {})
    });
  } catch (err) {
    const code = readOwnErrnoCode(err);
    if (code === "ESRCH") {
      // own-data ESRCH：目标已不在，可继续删 owner。
    } else if (code === "EPERM") {
      throw policyError(PROCESS_KILL_UNKNOWN);
    } else {
      throw projectReapFailure(err);
    }
  }
  if (restartPolicyTestHooks.afterKillBeforeDelete) {
    await restartPolicyTestHooks.afterKillBeforeDelete();
  }
  let casMismatch = false;
  try {
    await withHomeOwnerBoundary(saydoHome, () => {
      try {
        commitOwnerReapIfIdentity(
          ownerPath,
          agentOwnerIdentity(record),
          () => {
            audit.record({ actor: "daemon", action: "tier1.orphan_agent_reaped", meta: { runId: row.run_id, pid: record.pid } });
          },
          () => {
            if (existsSync(ownerPath)) rmSync(ownerPath);
          }
        );
      } catch (err) {
        if (isOwnerIdentityCasError(err)) {
          casMismatch = true;
          return;
        }
        throw err;
      }
    });
  } catch (err) {
    throw projectReapFailure(err);
  }
  return casMismatch ? "identity_changed" : "reaped";
}

/**
 * 正常清除路径：HOME boundary 内按 captured identity CAS unlink + durable audit。
 * 无 captured identity 时不得删现存 owner（可能已是 successor）。
 */
export function shouldClearAgentOwnershipAfterDurable(
  row: { state: string; finalize_pending_json: string | null; restart_pending_at: string | null } | undefined
): boolean {
  return !row ||
    !["reserved", "running", "step_paused", "cancel_requested"].includes(row.state) ||
    row.finalize_pending_json !== null ||
    row.restart_pending_at !== null;
}

export async function releaseAgentOwnershipAfterDurable(
  saydoHome: string,
  runId: string,
  expected: OwnerImmutableIdentity | undefined,
  row: { state: string; finalize_pending_json: string | null; restart_pending_at: string | null } | undefined
): Promise<boolean> {
  if (!shouldClearAgentOwnershipAfterDurable(row)) return false;
  await releaseAgentOwnershipIfIdentity(saydoHome, runId, expected);
  return true;
}

export async function releaseAgentOwnershipIfIdentity(
  saydoHome: string,
  runId: string,
  expected: OwnerImmutableIdentity | undefined
): Promise<void> {
  const runDir = join(saydoHome, "tier1", "runs", runId);
  const ownerPath = join(runDir, "agent-owner.json");
  const pidPath = join(runDir, "agent.pid");
  await withHomeOwnerBoundary(saydoHome, () => {
    try {
      if (!existsSync(ownerPath)) {
        rmSync(pidPath, { force: true });
        return;
      }
      if (!expected) return;
      commitOwnerReapIfIdentity(
        ownerPath,
        expected,
        () => {
          appendReapAudit(saydoHome, {
            action: "tier1.agent_owner_released",
            kind: expected.kind,
            pid: expected.pid,
            ownerInstanceId: expected.ownerInstanceId,
            runId: expected.runId,
            generation: expected.generation
          });
        },
        () => {
          rmSync(ownerPath, { force: true });
          rmSync(pidPath, { force: true });
        }
      );
    } catch (err) {
      if (isOwnerIdentityCasError(err)) return;
      throw err;
    }
  });
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
    // 已有 durable finalization intent 的 run 只收口、禁止再挂 restart marker。
    if (row.finalize_pending_json) return false;
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
         WHERE id=? AND state IN ${RESTART_RECOVERABLE_STATES} AND finalize_pending_json IS NULL`
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
