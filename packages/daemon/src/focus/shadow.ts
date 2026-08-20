// C6 shadow 层:projection/compare record;external_bootstrap 禁写 canonical(走 FocusWriteTx 即被拒)。

import { jcsDigest, newId } from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import { FocusWriteError, readFocus } from "./writeTx.js";

export interface ShadowProjectionInput {
  focusId: string;
  sourceAuthority: string;
  sourceRevision: string;
  payload: unknown;
  observedAt?: string;
}

export function writeShadowProjection(db: Db, input: ShadowProjectionInput): { projectionId: string; digest: string } {
  const focus = readFocus(db, input.focusId);
  if (!focus) throw new FocusWriteError("focus_not_found", `focus ${input.focusId} not found`);
  // shadow 期 external_bootstrap 只写 projection,不写 canonical——本函数只碰 shadow 表
  const payloadJson = JSON.stringify(input.payload);
  const sourceDigest = jcsDigest(input.payload);
  const id = newId("fsp");
  const observedAt = input.observedAt ?? new Date().toISOString();
  db.prepare(
    `INSERT INTO focus_shadow_projections(id, focus_id, source_authority, source_revision, source_digest, observed_at, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.focusId, input.sourceAuthority, input.sourceRevision, sourceDigest, observedAt, payloadJson, observedAt);
  return { projectionId: id, digest: sourceDigest };
}

export interface CompareFieldDiff {
  field: string;
  projection: unknown;
  ledger: unknown;
}

export interface WriteCompareInput {
  focusId: string;
  projectionId: string;
  ledgerRevision: string;
  projectionPayload: Record<string, unknown>;
  ledgerPayload: Record<string, unknown>;
  sceneTag?: string;
  fields?: string[];
}

export function writeCompareRecord(db: Db, input: WriteCompareInput): {
  compareId: string;
  zeroDivergence: boolean;
  diffs: CompareFieldDiff[];
} {
  const fields = input.fields ?? uniqueKeys(input.projectionPayload, input.ledgerPayload);
  const diffs: CompareFieldDiff[] = [];
  for (const field of fields) {
    const p = input.projectionPayload[field];
    const l = input.ledgerPayload[field];
    if (jcsDigest(p ?? null) !== jcsDigest(l ?? null)) {
      diffs.push({ field, projection: p, ledger: l });
    }
  }
  const zero = diffs.length === 0;
  const id = newId("fcr");
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO focus_compare_records(id, focus_id, projection_id, ledger_revision, diff_json, zero_divergence, scene_tag, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.focusId, input.projectionId, input.ledgerRevision, JSON.stringify(diffs), zero ? 1 : 0, input.sceneTag ?? null, now);
  return { compareId: id, zeroDivergence: zero, diffs };
}

function uniqueKeys(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
}

/**
 * 收场后 shadow 对账钩:若 Focus 为 external_bootstrap,写 projection+compare。
 * saydo authority 不写 shadow(canonical 已是主)。
 */
export function maybeShadowOnClose(
  db: Db,
  input: {
    focusId: string;
    settlementId: string;
    candidatesDigest: string;
    obligationsDigest: string;
    sceneTag?: string;
  }
): { wrote: boolean; zeroDivergence?: boolean } {
  const focus = readFocus(db, input.focusId);
  if (!focus || focus.semanticAuthority !== "external_bootstrap") {
    return { wrote: false };
  }
  const payload = {
    settlementId: input.settlementId,
    candidatesDigest: input.candidatesDigest,
    obligationsDigest: input.obligationsDigest,
    focusRevision: focus.currentRevision
  };
  const { projectionId } = writeShadowProjection(db, {
    focusId: input.focusId,
    sourceAuthority: "external_bootstrap",
    sourceRevision: String(focus.currentRevision),
    payload
  });
  // v0:ledger 侧以同结构自比(零分叉基线);真实 OctoAgent ledger 在 eval 窗注入
  const cmp = writeCompareRecord(db, {
    focusId: input.focusId,
    projectionId,
    ledgerRevision: String(focus.currentRevision),
    projectionPayload: payload,
    ledgerPayload: payload,
    sceneTag: input.sceneTag ?? "close_settlement"
  });
  return { wrote: true, zeroDivergence: cmp.zeroDivergence };
}
