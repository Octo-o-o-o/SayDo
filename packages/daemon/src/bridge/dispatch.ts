// P0.5-B 两阶段 dispatch(09 §6.2 DispatchBinding):
// 写序 = 先 INSERT binding(dropOutcome=NULL) -> drop -> 回填 outcome;重启扫 NULL 行原 key 重放。
// 幂等 key = frontmatter id(+ 正文 dispatch 注释:授权变 => 正文 hash 变,绝不落 duplicate_ignored)。

import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import { activateHopperBindingOnDispatchComplete } from "../focus/binding.js";

export type DropOutcome = "created" | "updated_draft" | "new_revision" | "duplicate_ignored";

export interface BindingInput {
  voiceTaskId: string;
  idemKey: string; // frontmatter id(saydo-<ulid>)
  packageDigest: string;
  mode: "direct_to_review" | "step_confirm";
}

/** 阶段一:落 binding(dropOutcome=NULL = in-flight);同 voiceTaskId 幂等(重放不重插) */
export function beginDispatch(db: Db, audit: AuditSink, i: BindingInput, nowIso: string): { fresh: boolean } {
  const existing = db.prepare("SELECT drop_outcome FROM dispatch_bindings WHERE voice_task_id = ?").get(i.voiceTaskId) as
    | { drop_outcome: string | null }
    | undefined;
  if (existing) return { fresh: false }; // 已有行:调用方按 outcome 分支(NULL=重放,非 NULL=已完成)
  db.prepare(
    "INSERT INTO dispatch_bindings(voice_task_id, dispatch_id, idem_key, package_digest, mode, hopper_json, drop_outcome, created_at) VALUES (?, NULL, ?, ?, ?, NULL, NULL, ?)"
  ).run(i.voiceTaskId, i.idemKey, i.packageDigest, i.mode, nowIso);
  audit.record({ actor: "daemon", action: "bridge.dispatch_begin", meta: { voiceTaskId: i.voiceTaskId, idemKey: i.idemKey } });
  return { fresh: true };
}

export interface HopperBinding {
  projectId: string;
  taskId: string;
  revision: number;
  runId?: string;
  vaultId?: string;
  projectSnapshotDigest?: string;
}

/** 阶段二:drop 成功后回填(dispatchId + hopper 侧锚 + outcome) */
export function completeDispatch(
  db: Db,
  audit: AuditSink,
  voiceTaskId: string,
  fill: { dispatchId: string; hopper: HopperBinding; outcome: DropOutcome },
  opts?: { hopperFocusBindingEnabled?: boolean; nowIso?: string }
): void {
  const res = db
    .prepare("UPDATE dispatch_bindings SET dispatch_id = ?, hopper_json = ?, drop_outcome = ? WHERE voice_task_id = ? AND drop_outcome IS NULL")
    .run(fill.dispatchId, JSON.stringify(fill.hopper), fill.outcome, voiceTaskId);
  if (res.changes === 0) throw new Error(`completeDispatch: no in-flight binding for ${voiceTaskId}(两阶段序破坏)`);
  // C5 hopper dormant:写口对准本事务后的 binding 回填;开关缺省关
  const hop = activateHopperBindingOnDispatchComplete(db, {
    taskId: voiceTaskId,
    projectId: fill.hopper.projectId,
    enabled: opts?.hopperFocusBindingEnabled === true,
    ...(opts?.nowIso ? { nowIso: opts.nowIso } : {})
  });
  audit.record({
    actor: "daemon",
    action: "bridge.dispatch_complete",
    meta: {
      voiceTaskId,
      outcome: fill.outcome,
      hopperTaskId: fill.hopper.taskId,
      focusBindingId: hop?.id ?? null
    }
  });
}

/** 重启对账:NULL 行 = drop 未确认,用原 idemKey 重放(C7 danglingDispatchBindings 的消费面) */
export function pendingDispatches(db: Db): { voiceTaskId: string; idemKey: string; packageDigest: string; mode: string }[] {
  return db
    .prepare("SELECT voice_task_id, idem_key, package_digest, mode FROM dispatch_bindings WHERE drop_outcome IS NULL")
    .all()
    .map((r) => {
      const row = r as Record<string, string>;
      return { voiceTaskId: row["voice_task_id"] as string, idemKey: row["idem_key"] as string, packageDigest: row["package_digest"] as string, mode: row["mode"] as string };
    });
}

/** runId 换新(retry 换 run;审计留痕) */
export function updateBindingRunId(db: Db, audit: AuditSink, voiceTaskId: string, runId: string): void {
  const row = db.prepare("SELECT hopper_json FROM dispatch_bindings WHERE voice_task_id = ?").get(voiceTaskId) as { hopper_json: string | null } | undefined;
  if (!row?.hopper_json) throw new Error(`no hopper binding for ${voiceTaskId}`);
  const h = JSON.parse(row.hopper_json) as HopperBinding;
  const prev = h.runId;
  h.runId = runId;
  db.prepare("UPDATE dispatch_bindings SET hopper_json = ? WHERE voice_task_id = ?").run(JSON.stringify(h), voiceTaskId);
  audit.record({ actor: "daemon", action: "bridge.run_id_updated", meta: { voiceTaskId, prev, runId } });
}

export function getBinding(db: Db, voiceTaskId: string): (HopperBinding & { idemKey: string; outcome: DropOutcome | null }) | null {
  const row = db.prepare("SELECT idem_key, hopper_json, drop_outcome FROM dispatch_bindings WHERE voice_task_id = ?").get(voiceTaskId) as
    | { idem_key: string; hopper_json: string | null; drop_outcome: DropOutcome | null }
    | undefined;
  if (!row) return null;
  const h = row.hopper_json ? (JSON.parse(row.hopper_json) as HopperBinding) : ({} as HopperBinding);
  return { ...h, idemKey: row.idem_key, outcome: row.drop_outcome };
}
