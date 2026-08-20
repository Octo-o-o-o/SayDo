// Focus 基线三元组工具(合同 §6):focusRevision + eventHWM + obligationsDigest。
// openObligationsDigest 单源——closeSettlement 与确认环 digest 共用,禁复制粘贴。

import { computeObligationsDigest } from "@saydo/contracts";
import type { Db } from "../storage/db.js";

/** 未结义务 digest(与 writeTx.obligationsDigestOf / 确认 baseline 同型) */
export function openObligationsDigest(db: Db, focusId: string): string {
  const rows = db
    .prepare(
      `SELECT id, status, verification, owner, kind, dedupe_key, resolution FROM focus_obligations
       WHERE focus_id = ? AND status IN ('open','in_progress','waiting','deferred','blocked')`
    )
    .all(focusId) as {
    id: string;
    status: string;
    verification: string;
    owner: string;
    kind: string;
    dedupe_key: string;
    resolution: string | null;
  }[];
  return computeObligationsDigest(
    rows.map((r) => ({
      id: r.id,
      status: r.status,
      verification: r.verification,
      owner: r.owner,
      kind: r.kind,
      dedupeKey: r.dedupe_key,
      ...(r.resolution ? { resolution: r.resolution } : {})
    }))
  );
}

export function maxFocusEventSeq(db: Db, focusId: string): number {
  const r = db.prepare("SELECT MAX(seq) AS m FROM focus_events WHERE focus_id = ?").get(focusId) as {
    m: number | null;
  };
  return r.m ?? 0;
}

/**
 * 确认环 baselineString(合同 §6):
 * - focus_* 且有 focusId:`${focusId}:${revision}:${eventHWM}:${obligationsDigest}`
 * - focus_create_anchor 无 focusId:`new:${title}`
 * - 非 focus 域:空串
 */
export function computeConfirmBaselineString(
  db: Db | null | undefined,
  payload: { kind: string; focusId?: string | undefined; title?: string | undefined }
): string {
  if (!payload.kind.startsWith("focus_")) return "";
  if (payload.kind === "focus_create_anchor") {
    return `new:${payload.title ?? ""}`;
  }
  const focusId = payload.focusId;
  if (!focusId || !db) return "";
  const row = db.prepare("SELECT current_revision FROM focuses WHERE id = ?").get(focusId) as
    | { current_revision: number }
    | undefined;
  if (!row) return `${focusId}:0:0:`;
  const eventHWM = maxFocusEventSeq(db, focusId);
  const obDigest = openObligationsDigest(db, focusId);
  return `${focusId}:${row.current_revision}:${eventHWM}:${obDigest}`;
}
