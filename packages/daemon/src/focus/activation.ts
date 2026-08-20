// FocusActivation 基础(实施计划 B3):create / 正常 close / sessions.focus_anchor_revision CAS。
// 恢复回接(interrupted 扫描 + 尾部重建)归 M3 C2。

import {
  newId,
  type FocusActivation,
  type FocusActivationTrigger,
  type FocusResumeSource
} from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import { activationFromRow, type ActivationRow } from "./rows.js";
import { withFocusWriteTx, FocusWriteError, type FocusWriteTxOptions, type FocusWriteOps } from "./writeTx.js";

export interface StartActivationInput {
  focusId: string;
  sessionId: string;
  trigger: FocusActivationTrigger;
  resumeSource?: FocusResumeSource;
  packetRevision?: number;
  actorKind?: "user" | "daemon" | "brain_proposal";
  /**
   * 消费前 CAS 的期望 focus_anchor_revision。
   * 省略则读当前 session 值并 +1 消费。
   * 若提供且与库中不等 → 漂移拒。
   */
  expectedAnchorRevision?: number;
}

export interface StartActivationResult {
  activationId: string;
  anchorRevision: number;
  inputFocusRevision: number;
  eventId: string;
}

/** 合同 §4.1 activation 硬门:仅 active/captured/dormant 可开 activation */
const ACTIVATION_LIVE_LIFECYCLES = new Set(["active", "captured", "dormant"]);

function assertFocusActivatable(lifecycle: string, focusId: string): void {
  if (!ACTIVATION_LIVE_LIFECYCLES.has(lifecycle)) {
    throw new FocusWriteError(
      "focus_not_active",
      `focus ${focusId} lifecycle=${lifecycle};这个 Focus 归档了,要先重新打开吗?`
    );
  }
}

/** 可在已有 FocusWriteTx 内调用(确认消费同事务用) */
export function startActivationOnOps(
  ops: FocusWriteOps,
  input: StartActivationInput,
  opts: { injectCrashAfterTargetWrite?: boolean } = {}
): StartActivationResult {
  const db = ops.db;
  const focus = ops.getFocus(input.focusId);
  // 合同 A-3:lifecycle 硬门;captured/dormant 后续自动提升保留
  assertFocusActivatable(focus.lifecycle, input.focusId);
  const session = db
    .prepare("SELECT id, primary_focus_id, focus_anchor_revision, state FROM sessions WHERE id = ?")
    .get(input.sessionId) as
    | { id: string; primary_focus_id: string | null; focus_anchor_revision: number; state: string }
    | undefined;
  if (!session) throw new FocusWriteError("session_not_found", `session ${input.sessionId} not found`);

  const existingActive = db
    .prepare("SELECT id FROM focus_activations WHERE session_id = ? AND status = 'active'")
    .get(input.sessionId) as { id: string } | undefined;
  if (existingActive) {
    throw new FocusWriteError("activation_already_active", `session already has active activation ${existingActive.id}`);
  }

  const currentAnchor = session.focus_anchor_revision;
  if (input.expectedAnchorRevision !== undefined && input.expectedAnchorRevision !== currentAnchor) {
    throw new FocusWriteError(
      "anchor_revision_drift",
      `expected anchorRevision=${input.expectedAnchorRevision}, actual=${currentAnchor}`
    );
  }
  const newAnchor = currentAnchor + 1;
  const activationId = newId("fac");
  const inputFocusRevision = focus.current_revision;
  const resumeSource = input.resumeSource ?? "cold";

  db.prepare(
    `INSERT INTO focus_activations(
      id, focus_id, session_id, anchor_revision, input_focus_revision, resume_source,
      packet_revision, trigger, status, started_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`
  ).run(
    activationId,
    input.focusId,
    input.sessionId,
    newAnchor,
    inputFocusRevision,
    resumeSource,
    input.packetRevision ?? null,
    input.trigger,
    ops.nowIso
  );

  db.prepare("UPDATE sessions SET primary_focus_id = ?, focus_anchor_revision = ? WHERE id = ?").run(
    input.focusId,
    newAnchor,
    input.sessionId
  );

  if (focus.lifecycle === "captured" || focus.lifecycle === "dormant") {
    const from = focus.lifecycle;
    db.prepare("UPDATE focuses SET lifecycle = 'active', updated_at = ? WHERE id = ?").run(ops.nowIso, input.focusId);
    // 方向保留不覆写(J14/W5),状态描述人话(J7)
    ops.settleRevision(input.focusId, {
      lastReliableState: from === "captured" ? "第一次开工" : "睡眠中被唤醒,接续开工",
      createdBySessionId: input.sessionId,
      actorKind: input.actorKind ?? "user",
      sessionId: input.sessionId
    });
    ops.appendEvent(input.focusId, {
      type: "lifecycle_changed",
      payload: {
        from,
        to: "active",
        reason: from === "captured" ? "first_activation" : "activation"
      },
      actorKind: input.actorKind ?? "user",
      sessionId: input.sessionId
    });
  }

  if (opts.injectCrashAfterTargetWrite) {
    throw new FocusWriteError("injected_crash", "injected crash before event write");
  }

  const ev = ops.appendEvent(input.focusId, {
    type: "activation_started",
    payload: {
      activationId,
      sessionId: input.sessionId,
      trigger: input.trigger,
      inputFocusRevision
    },
    actorKind: input.actorKind ?? "user",
    sessionId: input.sessionId
  });

  return {
    activationId,
    anchorRevision: newAnchor,
    inputFocusRevision,
    eventId: ev.id
  };
}

export function startActivation(
  db: Db,
  input: StartActivationInput,
  opts: FocusWriteTxOptions = {}
): StartActivationResult {
  return withFocusWriteTx(db, opts, (ops) =>
    startActivationOnOps(
      ops,
      input,
      opts.injectCrashAfterTargetWrite ? { injectCrashAfterTargetWrite: true } : {}
    )
  );
}

export interface CloseActivationInput {
  activationId: string;
  /** 必须与 activation 的 session+focus 一致;关错即拒(IM-25 同源) */
  sessionId: string;
  focusId: string;
  actorKind?: "user" | "daemon" | "brain_proposal";
}

export function closeActivation(
  db: Db,
  input: CloseActivationInput,
  opts: FocusWriteTxOptions = {}
): { eventId: string; outputFocusRevision: number } {
  return withFocusWriteTx(db, opts, (ops) => {
    const row = db.prepare("SELECT * FROM focus_activations WHERE id = ?").get(input.activationId) as
      | ActivationRow
      | undefined;
    if (!row) throw new FocusWriteError("activation_not_found", `activation ${input.activationId} not found`);
    if (row.status !== "active") {
      throw new FocusWriteError("activation_not_active", `activation status=${row.status}`);
    }
    if (row.session_id !== input.sessionId || row.focus_id !== input.focusId) {
      throw new FocusWriteError(
        "activation_anchor_mismatch",
        `activation belongs to session=${row.session_id} focus=${row.focus_id}, not session=${input.sessionId} focus=${input.focusId}`
      );
    }
    const focus = ops.getFocus(input.focusId);
    const outputFocusRevision = focus.current_revision;

    db.prepare(
      `UPDATE focus_activations SET status = 'closed', output_focus_revision = ?, closed_at = ? WHERE id = ?`
    ).run(outputFocusRevision, ops.nowIso, input.activationId);

    if (opts.injectCrashAfterTargetWrite) {
      throw new FocusWriteError("injected_crash", "injected crash before event write");
    }

    const ev = ops.appendEvent(input.focusId, {
      type: "activation_closed",
      payload: {
        activationId: input.activationId,
        sessionId: input.sessionId,
        status: "closed",
        outputFocusRevision
      },
      actorKind: input.actorKind ?? "daemon",
      sessionId: input.sessionId
    });

    return { eventId: ev.id, outputFocusRevision };
  });
}

export function getActivation(db: Db, activationId: string): FocusActivation | null {
  const row = db.prepare("SELECT * FROM focus_activations WHERE id = ?").get(activationId) as ActivationRow | undefined;
  return row ? activationFromRow(row) : null;
}

export function getActiveActivationForSession(db: Db, sessionId: string): FocusActivation | null {
  const row = db
    .prepare("SELECT * FROM focus_activations WHERE session_id = ? AND status = 'active'")
    .get(sessionId) as ActivationRow | undefined;
  return row ? activationFromRow(row) : null;
}

/**
 * E2 热修(2026-08-04):会话在收场后恢复 talking 时 activation 已被原子关闭,
 * Focus 工具层调用前自愈重建——无 active 且 session.primary_focus_id 匹配则新建
 * (resume_source=state_direct/trigger=reopen),有则原样返回。读路径不需调用。
 * 合同 A-3:自愈同走 lifecycle 硬门——archived/closed/abandoned 抛 focus_not_active,
 * 不静默吞,调用方话术"这个 Focus 归档了,要先重新打开吗?"。
 */
export function ensureActiveActivationForSession(
  db: Db,
  sessionId: string,
  focusId: string
): FocusActivation | null {
  const active = getActiveActivationForSession(db, sessionId);
  if (active) return active.focusId === focusId ? active : null;
  const session = db
    .prepare("SELECT primary_focus_id, focus_anchor_revision FROM sessions WHERE id = ?")
    .get(sessionId) as { primary_focus_id: string | null; focus_anchor_revision: number } | undefined;
  if (!session || session.primary_focus_id !== focusId) return null;
  // 先验 lifecycle:不合法则抛,不开始 startActivation
  const focus = db.prepare("SELECT lifecycle FROM focuses WHERE id = ?").get(focusId) as
    | { lifecycle: string }
    | undefined;
  if (!focus) throw new FocusWriteError("not_found", `focus ${focusId} not found`);
  assertFocusActivatable(focus.lifecycle, focusId);
  const r = startActivation(db, {
    focusId,
    sessionId,
    expectedAnchorRevision: session.focus_anchor_revision,
    resumeSource: "state_direct",
    trigger: "reopen"
  });
  return getActivation(db, r.activationId);
}

/**
 * 双速直通(2026-08-04):换锚一步到位。
 * 合同 §4.1 换锚原子性:先验目标 lifecycle,再关旧+开新并入同一 FocusWriteTx;
 * 目标不合法=事务不开始,零副作用拒。
 */
export function switchAnchorActivation(
  db: Db,
  sessionId: string,
  focusId: string,
  trigger: "user_explicit" | "session_open_suggest" | "reopen"
): { activation: FocusActivation | null; prevFocusId: string | null; already: boolean } {
  const cur = getActiveActivationForSession(db, sessionId);
  if (cur && cur.focusId === focusId) return { activation: cur, prevFocusId: null, already: true };

  // 先验目标 lifecycle(事务外快检;事务内 startActivationOnOps 再断言)
  const focus = db.prepare("SELECT lifecycle FROM focuses WHERE id = ?").get(focusId) as
    | { lifecycle: string }
    | undefined;
  if (!focus) throw new FocusWriteError("not_found", `focus ${focusId} not found`);
  assertFocusActivatable(focus.lifecycle, focusId);

  const prevFocusId = cur?.focusId ?? null;
  return withFocusWriteTx(db, {}, (ops) => {
    if (cur) {
      const row = ops.db
        .prepare("SELECT * FROM focus_activations WHERE id = ?")
        .get(cur.id) as { id: string; status: string; session_id: string; focus_id: string } | undefined;
      if (row && row.status === "active") {
        const f = ops.getFocus(row.focus_id);
        ops.db
          .prepare(
            `UPDATE focus_activations SET status = 'closed', output_focus_revision = ?, closed_at = ? WHERE id = ?`
          )
          .run(f.current_revision, ops.nowIso, cur.id);
        ops.appendEvent(row.focus_id, {
          type: "activation_closed",
          payload: {
            activationId: cur.id,
            sessionId,
            status: "closed",
            outputFocusRevision: f.current_revision
          },
          actorKind: "user",
          sessionId
        });
      }
    }
    const sess = ops.db
      .prepare("SELECT focus_anchor_revision FROM sessions WHERE id = ?")
      .get(sessionId) as { focus_anchor_revision: number } | undefined;
    const r = startActivationOnOps(ops, {
      focusId,
      sessionId,
      trigger,
      expectedAnchorRevision: sess?.focus_anchor_revision ?? 0,
      resumeSource: "state_direct",
      actorKind: "user"
    });
    return {
      activation: getActivation(db, r.activationId),
      prevFocusId,
      already: false
    };
  });
}
