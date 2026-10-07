// Focus 写口(批 2):POST 新建 / archive / reopen;PG-01B 增 POST abandon。
// create=registry.createFocus + 可选归空间 + 可选首 revision(direction);
// archive/reopen/abandon 的生命周期、会话段与独立 audit 同库原子提交。abandon 不得写 archived。

import { z } from "zod";
import { withSqliteAuditTransaction } from "./sqliteAuditTransaction.js";
import { jcsDigest } from "@saydo/contracts";
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

const abandonBody = z.object({
  reason: z.string().trim().min(1)
});

/** writeTx 边表:active|dormant|archived → abandoned。captured/closed 不开放。 */
const ABANDON_FROM = new Set(["active", "dormant", "archived"]);

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

  try {
    return withSqliteAuditTransaction<ApiResponse>(db, audit, () => {
      const created = createFocus(db, { title, actorKind: "user" });
      const focusId = created.focusId;

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
    });
  } catch (e) {
    if (e instanceof FocusWriteError) return err(409, e.code, e.message);
    const msg = e instanceof Error ? e.message : String(e);
    return err(409, "create_failed", msg);
  }

}

/** DAILY-01(合同 §15.2):归档前置——有在途执行(queued/running/review/merge 链)的 Focus 拒绝直接归档;
 *  先停任务再归档。归档≠放弃≠关闭;running work 不能被静默归档。 */
const ARCHIVE_BLOCKING_TASK_STATUSES = [
  "confirmed",
  "queued",
  "running",
  "paused_step_boundary",
  "ready_for_review",
  "review_approved_waiting_merge",
  "merging",
  "cancel_requested"
] as const;

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

  const running = db
    .prepare(
      `SELECT COUNT(*) AS n FROM action_execution_bindings b
       JOIN tasks t ON t.id = b.task_id
       WHERE b.focus_id = ? AND b.superseded_by_binding_id IS NULL
         AND t.status IN (${ARCHIVE_BLOCKING_TASK_STATUSES.map(() => "?").join(",")})`
    )
    .get(focusId, ...ARCHIVE_BLOCKING_TASK_STATUSES) as { n: number };
  if (running.n > 0) {
    audit.record({
      actor: "owner",
      action: "focus.archive_rejected",
      meta: { focusId, reason: "running_work", runningTasks: running.n }
    });
    return err(
      409,
      "focus_has_running_work",
      `该 Focus 有 ${running.n} 个在途任务(排队/执行/待验收/合并中)——先停下或等它们落定,再归档。归档≠放弃,正在执行的事不能被静默收起。`
    );
  }

  try {
    return withSqliteAuditTransaction<ApiResponse>(db, audit, () => {
      const acts = db
        .prepare(
          `SELECT id, session_id, focus_id FROM focus_activations
           WHERE focus_id = ? AND status = 'active'`
        )
        .all(focusId) as Array<{ id: string; session_id: string; focus_id: string }>;
      for (const a of acts) {
        closeActivation(db, {
          activationId: a.id,
          sessionId: a.session_id,
          focusId: a.focus_id,
          actorKind: "user"
        });
      }
      const r = changeFocusLifecycle(db, focusId, {
        to: "archived",
        reason: parsed.data.reason,
        actorKind: "user"
      });
      audit.record({
        actor: "owner",
        action: "focus.archived",
        refDigest: jcsDigest(parsed.data.reason),
        meta: { focusId, eventId: r.eventId, closedActivations: acts.length }
      });
      return { status: 200, payload: { ok: true, id: focusId, lifecycle: "archived" } };
    });
  } catch (e) {
    if (e instanceof FocusWriteError) {
      return err(409, e.code, e.message);
    }
    return err(409, "archive_failed", e instanceof Error ? e.message : String(e));
  }
}

/** active|dormant|archived → abandoned;理由必填;独立 audit,绝不写 archived。 */
export function abandonFocusApi(
  db: Db,
  audit: AuditSink,
  focusId: string,
  body: unknown
): ApiResponse {
  const parsed = abandonBody.safeParse(body ?? {});
  if (!parsed.success) return err(400, "invalid_input", "abandon 需要 reason");

  const focus = db.prepare("SELECT id, lifecycle FROM focuses WHERE id = ?").get(focusId) as
    | { id: string; lifecycle: string }
    | undefined;
  if (!focus) return err(404, "not_found", `focus ${focusId} not found`);
  if (!ABANDON_FROM.has(focus.lifecycle)) {
    return err(409, "abandon_from_invalid", `abandon 仅限 active/dormant/archived,当前 ${focus.lifecycle}`);
  }


  try {
    return withSqliteAuditTransaction<ApiResponse>(db, audit, () => {
      const acts = db
        .prepare(
          `SELECT id, session_id, focus_id FROM focus_activations
       WHERE focus_id = ? AND status = 'active'`
        )
        .all(focusId) as Array<{ id: string; session_id: string; focus_id: string }>;
      for (const a of acts) {
        closeActivation(db, {
          activationId: a.id,
          sessionId: a.session_id,
          focusId: a.focus_id,
          actorKind: "user"
        });
      }

      const reason = parsed.data.reason;
      const r = changeFocusLifecycle(db, focusId, {
        to: "abandoned",
        reason,
        actorKind: "user"
      });
      // E3:abandon 独立 audit 不落理由原文;关联只走顶层 refDigest。
      audit.record({
        actor: "owner",
        action: "focus.abandoned",
        refDigest: jcsDigest(reason),
        meta: { focusId, eventId: r.eventId, closedActivations: acts.length }
      });
      return { status: 200, payload: { ok: true, id: focusId, lifecycle: "abandoned" } };
    });
  } catch (e) {
    if (e instanceof FocusWriteError) {
      return err(409, e.code, e.message);
    }
    return err(409, "abandon_failed", e instanceof Error ? e.message : String(e));
  }
}

const forkBody = z.object({
  title: z.string().optional(),
  direction: z.string().optional()
});

/**
 * DAILY-01:POST /api/focuses/:id/fork —— 开新分支(新 Focus 身份,forked_from=源;
 * 复制 space 归属;direction 可选写首 revision;focus_forked 事件落新 Focus 事件流)。
 * 不复制义务/任务/审批——分叉=另起一件事,历史留在原 Focus。
 */
export function forkFocusApi(db: Db, audit: AuditSink, focusId: string, body: unknown): ApiResponse {
  const parsed = forkBody.safeParse(body ?? {});
  if (!parsed.success) return err(400, "invalid_input", parsed.error.message);

  const src = db
    .prepare("SELECT id, title, lifecycle, space_id FROM focuses WHERE id = ?")
    .get(focusId) as
    | { id: string; title: string; lifecycle: string; space_id: string | null }
    | undefined;
  if (!src) return err(404, "not_found", `focus ${focusId} not found`);

  const title = parsed.data.title?.trim() || `${src.title}(分叉)`;
  try {
    return withSqliteAuditTransaction<ApiResponse>(db, audit, () => {
      const r = withFocusWriteTx(db, {}, (ops) => {
        const created = ops.createFocus({ title, actorKind: "user" });
        db.prepare("UPDATE focuses SET forked_from = ?, space_id = ?, updated_at = ? WHERE id = ?").run(
          src.id,
          src.space_id,
          ops.nowIso,
          created.focusId
        );
        ops.appendEvent(created.focusId, {
          type: "focus_forked",
          payload: { sourceId: src.id, sourceTitle: src.title, newId: created.focusId },
          actorKind: "user"
        });
        return created;
      });
      const forkedId = r.focusId;

      let directionIgnored = false;
      const direction = parsed.data.direction?.trim();
      if (direction) {
        try {
          withFocusWriteTx(db, {}, (ops) => {
            ops.settleRevision(forkedId, {
              currentDirection: direction,
              lastReliableState: `自「${src.title}」分叉`,
              actorKind: "user"
            });
          });
        } catch {
          directionIgnored = true;
        }
      }

      audit.record({
        actor: "owner",
        action: "focus.forked",
        meta: { focusId: forkedId, sourceId: src.id, title, directionIgnored }
      });
      return {
        status: 200,
        payload: {
          ok: true,
          id: forkedId,
          title,
          forkedFrom: src.id,
          ...(directionIgnored ? { directionIgnored: true as const } : {})
        }
      };
    });
  } catch (e) {
    if (e instanceof FocusWriteError) return err(409, e.code, e.message);
    return err(409, "fork_failed", e instanceof Error ? e.message : String(e));
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
    return withSqliteAuditTransaction<ApiResponse>(db, audit, () => {
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
    });
  } catch (e) {
    if (e instanceof FocusWriteError) {
      return err(409, e.code, e.message);
    }
    return err(409, "reopen_failed", e instanceof Error ? e.message : String(e));
  }
}
