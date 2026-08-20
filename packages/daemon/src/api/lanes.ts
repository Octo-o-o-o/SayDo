// 线三调整 API(批 3):retire / redo-from。
// console 写口直接执行+audit;window.confirm 在前端。

import { z } from "zod";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import { FocusWriteError } from "../focus/writeTx.js";
import { redoFromLane, retireLane } from "../focus/lanes.js";

export interface ApiResponse {
  status: number;
  payload: unknown;
}

function err(status: number, code: string, message: string, retryable = false): ApiResponse {
  return { status, payload: { ok: false, code, message, retryable } };
}

export function retireLaneApi(
  db: Db,
  audit: AuditSink,
  focusId: string,
  laneId: string
): ApiResponse {
  try {
    const r = retireLane(db, { focusId, laneId, actorKind: "user" });
    audit.record({
      actor: "owner",
      action: "lane.retired",
      meta: { focusId, laneId, resolvedIds: r.resolvedIds, eventId: r.eventId }
    });
    return {
      status: 200,
      payload: { ok: true, focusId, laneId, resolvedIds: r.resolvedIds, eventId: r.eventId }
    };
  } catch (e) {
    if (e instanceof FocusWriteError) {
      return err(e.code === "lane_not_found" ? 404 : 409, e.code, e.message);
    }
    return err(409, "retire_failed", e instanceof Error ? e.message : String(e));
  }
}

const redoBody = z.object({
  anchorSeq: z.number().int().nonnegative(),
  /** exact set;可与建议集合并 */
  supersededIds: z.array(z.string()).optional(),
  extraSupersededIds: z.array(z.string()).optional()
});

export function redoFromLaneApi(
  db: Db,
  audit: AuditSink,
  focusId: string,
  laneId: string,
  body: unknown
): ApiResponse {
  const parsed = redoBody.safeParse(body ?? {});
  if (!parsed.success) return err(400, "invalid_input", parsed.error.message);

  // 建议集(created_from_event > anchor;仅展示,不自动入集)
  const suggested = db
    .prepare(
      `SELECT id, title, created_from_event FROM focus_obligations
       WHERE focus_id = ? AND lane_id = ?
         AND status IN ('open','in_progress','waiting','deferred','blocked')
         AND created_from_event IS NOT NULL AND created_from_event > ?`
    )
    .all(focusId, laneId, parsed.data.anchorSeq) as Array<{
    id: string;
    title: string;
    created_from_event: number;
  }>;
  // unknown_origin:created_from_event IS NULL 的未结行——不自动入集,响应单列
  const unknownOrigin = db
    .prepare(
      `SELECT id, title FROM focus_obligations
       WHERE focus_id = ? AND lane_id = ?
         AND status IN ('open','in_progress','waiting','deferred','blocked')
         AND created_from_event IS NULL`
    )
    .all(focusId, laneId) as Array<{ id: string; title: string }>;

  const exact = [
    ...new Set([
      ...(parsed.data.supersededIds ?? []),
      ...(parsed.data.extraSupersededIds ?? [])
    ])
  ];
  // 若调用方未给 exact set,仅返回建议(不执行)——前端勾选后二次提交
  if (exact.length === 0 && !parsed.data.supersededIds && !parsed.data.extraSupersededIds) {
    return {
      status: 200,
      payload: {
        ok: true,
        preview: true,
        suggestedIds: suggested.map((s) => s.id),
        suggested,
        unknownOrigin
      }
    };
  }

  try {
    const r = redoFromLane(db, {
      focusId,
      laneId,
      anchorSeq: parsed.data.anchorSeq,
      supersededIds: exact,
      actorKind: "user"
    });
    audit.record({
      actor: "owner",
      action: "lane.redo_from",
      meta: {
        focusId,
        laneId,
        anchorSeq: parsed.data.anchorSeq,
        supersededIds: r.supersededIds,
        eventId: r.eventId
      }
    });
    return {
      status: 200,
      payload: {
        ok: true,
        focusId,
        laneId,
        supersededIds: r.supersededIds,
        suggestedIds: r.suggestedIds,
        unknownOrigin,
        eventId: r.eventId
      }
    };
  } catch (e) {
    if (e instanceof FocusWriteError) {
      return err(e.code === "lane_not_found" || e.code === "obligation_not_found" ? 404 : 409, e.code, e.message);
    }
    return err(409, "redo_failed", e instanceof Error ? e.message : String(e));
  }
}
