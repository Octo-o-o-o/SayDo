import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "../storage/db.js";
import { verifiedProjectWorkspace } from "../storage/dao/projects.js";
const DRAINABLE_STATES = "('reserved','running','step_paused','cancel_requested')";
const RECOVERABLE_RUN_STATES = new Set(["reserved", "running", "step_paused"]);

export interface ActiveWorkClass {
  recoverableTier1: number;
  unrecoverableTier1: number;
  byoa: number;
  abortedUnrecoverable: number;
  total: number;
}

export interface ActiveTier1Row {
  run_id: string;
  task_id: string;
  project_id: string;
  state: string;
  worktree_path: string;
  task_status: string;
  native_session_id: string | null;
  restart_pending_at: string | null;
}

function drainableRows(db: Db): ActiveTier1Row[] {
  return db.prepare(
    `SELECT tier1_runs.id AS run_id, tier1_runs.task_id AS task_id,
            tasks.project_id AS project_id, tier1_runs.state AS state,
            tier1_runs.worktree_path AS worktree_path, tasks.status AS task_status,
            tier1_runs.native_session_id AS native_session_id,
            tier1_runs.restart_pending_at AS restart_pending_at
     FROM tier1_runs JOIN tasks ON tasks.id=tier1_runs.task_id
     WHERE tier1_runs.state IN ${DRAINABLE_STATES}`
  ).all() as ActiveTier1Row[];
}

/** 可恢复：任务 running、run 非 cancel_requested、workspace/worktree 有效。 */
export function isRecoverableTier1Row(db: Db, row: ActiveTier1Row): boolean {
  if (row.state === "cancel_requested") return false;
  if (row.task_status !== "running") return false;
  try {
    verifiedProjectWorkspace(db, row.project_id);
  } catch {
    return false;
  }
  if (row.state !== "reserved" && !existsSync(join(row.worktree_path, ".git"))) return false;
  return true;
}

/**
 * summary / prepare / recover / stopped 同源分类。
 * unrecoverableCalls = active-unrecoverable Tier1 + BYOA（合同字段不拆第三项）。
 */
export function classifyActiveWork(
  db: Db,
  byoaCount: number,
  options: {
    /** 内存中已 abort 的 run 不得算可恢复 */
    isAborted?: (runId: string) => boolean;
    /** graceful prior-running 缺 exact native key 时不算可恢复（D1 B3） */
    requireNativeForGracefulRunning?: boolean;
  } = {}
): ActiveWorkClass {
  const isAborted = options.isAborted ?? (() => false);
  let recoverableTier1 = 0;
  let unrecoverableTier1 = 0;
  for (const row of drainableRows(db)) {
    if (row.state === "cancel_requested") {
      unrecoverableTier1 += 1;
      continue;
    }
    if (!RECOVERABLE_RUN_STATES.has(row.state)) continue;
    if (isAborted(row.run_id)) {
      unrecoverableTier1 += 1;
      continue;
    }
    let recoverable = isRecoverableTier1Row(db, row);
    if (
      recoverable &&
      options.requireNativeForGracefulRunning &&
      row.state !== "reserved" &&
      row.restart_pending_at &&
      !row.native_session_id
    ) {
      recoverable = false;
    }
    if (recoverable) recoverableTier1 += 1;
    else unrecoverableTier1 += 1;
  }
  const byoa = Math.max(0, byoaCount);
  const abortedUnrecoverable = unrecoverableTier1 + byoa;
  return {
    recoverableTier1,
    unrecoverableTier1,
    byoa,
    abortedUnrecoverable,
    total: recoverableTier1 + abortedUnrecoverable
  };
}

export function activeUnrecoverableTier1Rows(db: Db): ActiveTier1Row[] {
  return drainableRows(db).filter((row) => {
    if (row.state === "cancel_requested") return true;
    if (!["reserved", "running", "step_paused"].includes(row.state)) return false;
    return !isRecoverableTier1Row(db, row);
  });
}
