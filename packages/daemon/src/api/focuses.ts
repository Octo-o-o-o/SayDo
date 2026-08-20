// Focus 写口(批 2):POST 新建 / archive / reopen。
// create=registry.createFocus + 可选归空间 + 可选首 revision(direction);
// archive/reopen 走 changeFocusLifecycle + audit。

import { z } from "zod";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import { createFocus, changeFocusLifecycle } from "../focus/registry.js";
import { withFocusWriteTx, FocusWriteError } from "../focus/writeTx.js";
import { closeActivation } from "../focus/activation.js";

export interface ApiResponse {
  status: number;
  payload: unknown;
}

function err(status: number, code: string, message: string, retryable = false): ApiResponse {
  return { status, payload: { ok: false, code, message, retryable } };
}

const createBody = z.object({
  title: z.string().min(1),
  direction: z.string().optional(),
  spaceId: z.string().nullable().optional()
});

const archiveBody = z.object({
  reason: z.string().min(1)
});

export function createFocusApi(
  db: Db,
  audit: AuditSink,
  body: unknown,
  nowIso: string
): ApiResponse {
  const parsed = createBody.safeParse(body ?? {});
  if (!parsed.success) return err(400, "invalid_input", parsed.error.message);

  const title = parsed.data.title.trim();
  if (!title) return err(400, "invalid_input", "title required");

  if (parsed.data.spaceId) {
    const sp = db.prepare("SELECT id FROM focus_spaces WHERE id = ?").get(parsed.data.spaceId);
    if (!sp) return err(404, "space_not_found", `space ${parsed.data.spaceId} not found`);
  }

  let focusId: string;
  try {
    const created = createFocus(db, { title, actorKind: "user" });
    focusId = created.focusId;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return err(409, "create_failed", msg);
  }

  if (parsed.data.spaceId) {
    db.prepare("UPDATE focuses SET space_id = ?, updated_at = ? WHERE id = ?").run(
      parsed.data.spaceId,
      nowIso,
      focusId
    );
  }

  let directionIgnored = false;
  const direction = parsed.data.direction?.trim();
  if (direction) {
    try {
      // settleRevision 写 focus_states 首 revision;create 后 current_revision=0 → 升 1
      withFocusWriteTx(db, {}, (ops) => {
        ops.settleRevision(focusId, {
          currentDirection: direction,
          lastReliableState: "新建",
          actorKind: "user"
        });
      });
    } catch {
      // 不硬造写入路径:失败则标 directionIgnored,前端可隐藏方向框
      directionIgnored = true;
    }
  }

  audit.record({
    actor: "owner",
    action: "focus.created",
    meta: {
      focusId,
      title,
      spaceId: parsed.data.spaceId ?? null,
      hasDirection: Boolean(direction) && !directionIgnored,
      directionIgnored
    }
  });

  return {
    status: 200,
    payload: {
      ok: true,
      id: focusId,
      title,
      spaceId: parsed.data.spaceId ?? null,
      ...(directionIgnored ? { directionIgnored: true as const } : {})
    }
  };
}

/** active|captured → archived(W2:刚建也能中途放下);理由必填;关闭该 focus 全部 active activation */
export function archiveFocusApi(
  db: Db,
  audit: AuditSink,
  focusId: string,
  body: unknown
): ApiResponse {
  const parsed = archiveBody.safeParse(body ?? {});
  if (!parsed.success) return err(400, "invalid_input", "archive 需要 reason");

  const focus = db.prepare("SELECT id, lifecycle FROM focuses WHERE id = ?").get(focusId) as
    | { id: string; lifecycle: string }
    | undefined;
  if (!focus) return err(404, "not_found", `focus ${focusId} not found`);

  // 先关 active activation(合同 §4.1 archive 事务)
  const acts = db
    .prepare(
      `SELECT id, session_id, focus_id FROM focus_activations
       WHERE focus_id = ? AND status = 'active'`
    )
    .all(focusId) as Array<{ id: string; session_id: string; focus_id: string }>;
  for (const a of acts) {
    try {
      closeActivation(db, {
        activationId: a.id,
        sessionId: a.session_id,
        focusId: a.focus_id,
        actorKind: "user"
      });
    } catch {
      // 竞态已关:忽略
    }
  }

  try {
    const r = changeFocusLifecycle(db, focusId, {
      to: "archived",
      reason: parsed.data.reason,
      actorKind: "user"
    });
    audit.record({
      actor: "owner",
      action: "focus.archived",
      meta: { focusId, reason: parsed.data.reason, eventId: r.eventId, closedActivations: acts.length }
    });
    return { status: 200, payload: { ok: true, id: focusId, lifecycle: "archived" } };
  } catch (e) {
    if (e instanceof FocusWriteError) {
      return err(409, e.code, e.message);
    }
    return err(409, "archive_failed", e instanceof Error ? e.message : String(e));
  }
}

/** archived → active */
export function reopenFocusApi(db: Db, audit: AuditSink, focusId: string): ApiResponse {
  const focus = db.prepare("SELECT id, lifecycle FROM focuses WHERE id = ?").get(focusId) as
    | { id: string; lifecycle: string }
    | undefined;
  if (!focus) return err(404, "not_found", `focus ${focusId} not found`);
  // W3:reopen 只对 archived 态开放(合同 archived → active;此前实现比合同宽,captured 被 reopen 成 active)
  if (focus.lifecycle !== "archived") {
    return err(409, "reopen_from_invalid", `reopen 仅限归档态,当前 ${focus.lifecycle}`);
  }

  try {
    const r = changeFocusLifecycle(db, focusId, {
      to: "active",
      reason: "reopen",
      actorKind: "user"
    });
    audit.record({
      actor: "owner",
      action: "focus.reopened",
      meta: { focusId, eventId: r.eventId, from: focus.lifecycle }
    });
    return { status: 200, payload: { ok: true, id: focusId, lifecycle: "active" } };
  } catch (e) {
    if (e instanceof FocusWriteError) {
      return err(409, e.code, e.message);
    }
    return err(409, "reopen_failed", e instanceof Error ? e.message : String(e));
  }
}
