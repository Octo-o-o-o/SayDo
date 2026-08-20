// C5 ActionExecutionBinding:授权快照 + 同事务 authorized + claim 回填 bound。
// Hopper 分支完整实现但 dormant(配置开关缺省关;fake-hopper 事务测写序)。

import { newId, actionExecutionBindingSchema, type ActionExecutionBinding } from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import { withFocusWriteTx, FocusWriteError } from "./writeTx.js";

/** 签发收据时冻结的 Focus 授权快照(session 无 Focus → null)。
 *  sessionId=签发时的会话(A5 修复:消费复核按它精确重读,不再按 focus 反查"最新一场");
 *  存量快照无此值(null)→ 消费端 fail-closed 拒。 */
export interface FocusAuthSnapshot {
  focusId: string;
  focusRevision: number;
  focusAnchorRevision: number;
  authorityEpoch: number;
  sessionId: string | null;
}

export function captureFocusAuthSnapshot(db: Db, sessionId: string | undefined | null): FocusAuthSnapshot | null {
  if (!sessionId) return null;
  const session = db
    .prepare("SELECT primary_focus_id, focus_anchor_revision FROM sessions WHERE id = ?")
    .get(sessionId) as { primary_focus_id: string | null; focus_anchor_revision: number } | undefined;
  if (!session?.primary_focus_id) return null;
  const focus = db
    .prepare("SELECT id, current_revision, authority_epoch, semantic_authority FROM focuses WHERE id = ?")
    .get(session.primary_focus_id) as
    | { id: string; current_revision: number; authority_epoch: number; semantic_authority: string }
    | undefined;
  if (!focus) return null;
  return {
    focusId: focus.id,
    focusRevision: focus.current_revision,
    focusAnchorRevision: session.focus_anchor_revision,
    authorityEpoch: focus.authority_epoch,
    sessionId
  };
}

export function storeFocusAuthSnapshot(db: Db, receiptId: string, snapshot: FocusAuthSnapshot | null, nowIso: string): void {
  db.prepare(
    `INSERT INTO focus_auth_snapshots(receipt_id, focus_id, focus_revision, focus_anchor_revision, authority_epoch, session_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(receipt_id) DO UPDATE SET
       focus_id=excluded.focus_id,
       focus_revision=excluded.focus_revision,
       focus_anchor_revision=excluded.focus_anchor_revision,
       authority_epoch=excluded.authority_epoch,
       session_id=excluded.session_id,
       created_at=excluded.created_at`
  ).run(
    receiptId,
    snapshot?.focusId ?? null,
    snapshot?.focusRevision ?? null,
    snapshot?.focusAnchorRevision ?? null,
    snapshot?.authorityEpoch ?? null,
    snapshot?.sessionId ?? null,
    nowIso
  );
}

export function getFocusAuthSnapshot(db: Db, receiptId: string): FocusAuthSnapshot | null {
  const row = db
    .prepare(
      `SELECT focus_id, focus_revision, focus_anchor_revision, authority_epoch, session_id FROM focus_auth_snapshots WHERE receipt_id = ?`
    )
    .get(receiptId) as
    | {
        focus_id: string | null;
        focus_revision: number | null;
        focus_anchor_revision: number | null;
        authority_epoch: number | null;
        session_id: string | null;
      }
    | undefined;
  if (!row || row.focus_id == null || row.focus_revision == null || row.focus_anchor_revision == null || row.authority_epoch == null) {
    return null;
  }
  return {
    focusId: row.focus_id,
    focusRevision: row.focus_revision,
    focusAnchorRevision: row.focus_anchor_revision,
    authorityEpoch: row.authority_epoch,
    sessionId: row.session_id
  };
}

/**
 * CAS:快照非 null 时校验 focusRevision/anchor/epoch 未漂移。
 * 漂移 → throw(调用方事务回滚)。
 */
export function assertFocusAuthSnapshotCas(db: Db, snapshot: FocusAuthSnapshot): void {
  const focus = db
    .prepare("SELECT current_revision, authority_epoch FROM focuses WHERE id = ?")
    .get(snapshot.focusId) as { current_revision: number; authority_epoch: number } | undefined;
  if (!focus) throw new FocusWriteError("focus_not_found", `focus ${snapshot.focusId} missing at CAS`);
  if (focus.current_revision !== snapshot.focusRevision) {
    throw new FocusWriteError(
      "focus_revision_drift",
      `focusRevision drift: snap=${snapshot.focusRevision} now=${focus.current_revision}`
    );
  }
  if (focus.authority_epoch !== snapshot.authorityEpoch) {
    throw new FocusWriteError(
      "authority_epoch_drift",
      `authorityEpoch drift: snap=${snapshot.authorityEpoch} now=${focus.authority_epoch}`
    );
  }
  // anchor 复核(A5 修复,codex v0.3 审):按签发 session 的 PK 精确重读——
  // 旧实现按 primary_focus_id 反查"最新一场",多会话复核错对象、原会话换锚后静默跳过(fail-open)。
  // 存量快照无 session_id → fail-closed 拒(重新提议;receipt TTL 24h 无长期挂单)。
  if (!snapshot.sessionId) {
    throw new FocusWriteError(
      "snapshot_missing_session",
      "授权快照缺 session 锚(v19 前存量),不可消费——请重新提议"
    );
  }
  const sess = db
    .prepare(`SELECT primary_focus_id, focus_anchor_revision FROM sessions WHERE id = ?`)
    .get(snapshot.sessionId) as { primary_focus_id: string | null; focus_anchor_revision: number } | undefined;
  if (!sess) {
    throw new FocusWriteError("anchor_session_missing", `签发 session ${snapshot.sessionId} 不存在`);
  }
  if (sess.primary_focus_id !== snapshot.focusId) {
    throw new FocusWriteError(
      "anchor_focus_drift",
      `签发 session 已换锚: snap focus=${snapshot.focusId} now=${sess.primary_focus_id ?? "null"}`
    );
  }
  if (sess.focus_anchor_revision !== snapshot.focusAnchorRevision) {
    throw new FocusWriteError(
      "anchor_revision_drift",
      `anchorRevision drift: snap=${snapshot.focusAnchorRevision} now=${sess.focus_anchor_revision}`
    );
  }
}

export interface CreateBindingInput {
  focusId: string;
  taskId: string;
  focusRevisionAtAuthorization: number;
  selectedAuthority: "tier1" | "hopper";
  mode?: "direct_to_review" | "step_confirm";
  sessionId?: string;
}

/** 与 TaskCard 同事务创建(phase=authorized)+ binding_authorized event */
export function createAuthorizedBinding(db: Db, input: CreateBindingInput, nowIso: string): ActionExecutionBinding {
  return withFocusWriteTx(db, { now: () => new Date(nowIso) }, (ops) => {
    ops.getFocus(input.focusId);
    const bindingId = newId("aeb");
    // 先插 binding 行,再 event(authorizedByEventId 需要 event id——先 event 再 update? 
    // 合同:authorizedByEventId 恒必填。顺序=先 appendEvent 得 id,再 INSERT binding)
    const ev = ops.appendEvent(input.focusId, {
      type: "binding_authorized",
      payload: {
        bindingId,
        taskId: input.taskId,
        selectedAuthority: input.selectedAuthority
      },
      actorKind: "daemon",
      sessionId: input.sessionId
    });
    db.prepare(
      `INSERT INTO action_execution_bindings(
        id, focus_id, task_id, focus_revision_at_authorization, selected_authority, phase,
        authorized_by_event_id, authoritative_ledger_ref, mode, settlement_ref, superseded_by_binding_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'authorized', ?, NULL, ?, NULL, NULL, ?, ?)`
    ).run(
      bindingId,
      input.focusId,
      input.taskId,
      input.focusRevisionAtAuthorization,
      input.selectedAuthority,
      ev.id,
      input.mode ?? null,
      nowIso,
      nowIso
    );
    return getBinding(db, bindingId)!;
  });
}

/** claimNext / hopper complete 时回填 ledgerRef → bound */
export function bindLedgerRef(
  db: Db,
  taskId: string,
  ledgerRef: string,
  opts: { nowIso?: string; sessionId?: string } = {}
): ActionExecutionBinding | null {
  const row = db
    .prepare(
      `SELECT * FROM action_execution_bindings WHERE task_id = ? AND superseded_by_binding_id IS NULL`
    )
    .get(taskId) as BindingRow | undefined;
  if (!row) return null;
  if (row.phase === "bound") {
    if (row.authoritative_ledger_ref !== ledgerRef) {
      throw new FocusWriteError("ledger_ref_immutable", "authoritativeLedgerRef already set and differs");
    }
    return bindingFromRow(row);
  }
  const nowIso = opts.nowIso ?? new Date().toISOString();
  return withFocusWriteTx(db, { now: () => new Date(nowIso) }, (ops) => {
    db.prepare(
      `UPDATE action_execution_bindings
       SET phase = 'bound', authoritative_ledger_ref = ?, updated_at = ?
       WHERE id = ? AND phase = 'authorized'`
    ).run(ledgerRef, nowIso, row.id);
    ops.appendEvent(row.focus_id, {
      type: "binding_ledger_bound",
      payload: { bindingId: row.id, authoritativeLedgerRef: ledgerRef },
      actorKind: "daemon",
      sessionId: opts.sessionId
    });
    return getBinding(db, row.id)!;
  });
}

export function getBinding(db: Db, bindingId: string): ActionExecutionBinding | null {
  const row = db.prepare("SELECT * FROM action_execution_bindings WHERE id = ?").get(bindingId) as BindingRow | undefined;
  return row ? bindingFromRow(row) : null;
}

export function getActiveBindingForTask(db: Db, taskId: string): ActionExecutionBinding | null {
  const row = db
    .prepare(
      `SELECT * FROM action_execution_bindings WHERE task_id = ? AND superseded_by_binding_id IS NULL`
    )
    .get(taskId) as BindingRow | undefined;
  return row ? bindingFromRow(row) : null;
}

interface BindingRow {
  id: string;
  focus_id: string;
  task_id: string;
  focus_revision_at_authorization: number;
  selected_authority: string;
  phase: string;
  authorized_by_event_id: string;
  authoritative_ledger_ref: string | null;
  mode: string | null;
  settlement_ref: string | null;
  superseded_by_binding_id: string | null;
  created_at: string;
  updated_at: string;
}

function bindingFromRow(row: BindingRow): ActionExecutionBinding {
  return actionExecutionBindingSchema.parse({
    id: row.id,
    focusId: row.focus_id,
    taskId: row.task_id,
    focusRevisionAtAuthorization: row.focus_revision_at_authorization,
    selectedAuthority: row.selected_authority,
    phase: row.phase,
    authorizedByEventId: row.authorized_by_event_id,
    ...(row.authoritative_ledger_ref ? { authoritativeLedgerRef: row.authoritative_ledger_ref } : {}),
    ...(row.mode ? { mode: row.mode } : {}),
    ...(row.settlement_ref ? { settlementRef: row.settlement_ref } : {}),
    ...(row.superseded_by_binding_id ? { supersededByBindingId: row.superseded_by_binding_id } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}

/**
 * Hopper dormant 激活写口:在 DispatchBinding 落行同事务回填 hopper ledgerRef。
 * 配置开关缺省关;本函数是完整写序实现,由 fake-hopper 测试与未来桥通路调用。
 */
export function activateHopperBindingOnDispatchComplete(
  db: Db,
  input: {
    taskId: string;
    projectId: string;
    enabled: boolean;
    nowIso?: string;
  }
): ActionExecutionBinding | null {
  if (!input.enabled) return null;
  const ledgerRef = `hopper:${input.projectId}/${input.taskId}`;
  return bindLedgerRef(db, input.taskId, ledgerRef, {
    ...(input.nowIso ? { nowIso: input.nowIso } : {})
  });
}

/** tier1 ledger ref 命名空间 */
export function tier1LedgerRef(taskId: string): string {
  return `tier1:task:${taskId}`;
}
