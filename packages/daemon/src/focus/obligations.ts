// Obligation 台账(实施计划 B2):双轴状态机 + dedupeKey 幂等 upsert + resolution 跨表 validator。

import {
  isOpenObligationStatus,
  type FocusObligation,
  type FocusObligationOwner,
  type FocusObligationStatus
} from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import { obligationFromRow, type ObligationRow } from "./rows.js";
import {
  withFocusWriteTx,
  type FocusWriteTxOptions,
  type UpsertObligationInput
} from "./writeTx.js";

export function upsertObligation(
  db: Db,
  focusId: string,
  input: UpsertObligationInput,
  opts: FocusWriteTxOptions = {}
): { obligationId: string; eventId: string } {
  return withFocusWriteTx(db, opts, (ops) => ops.upsertObligation(focusId, input));
}

export function getObligation(db: Db, obligationId: string): FocusObligation | null {
  const row = db.prepare("SELECT * FROM focus_obligations WHERE id = ?").get(obligationId) as ObligationRow | undefined;
  return row ? obligationFromRow(row) : null;
}

export function getObligationByDedupe(db: Db, focusId: string, dedupeKey: string): FocusObligation | null {
  const row = db
    .prepare("SELECT * FROM focus_obligations WHERE focus_id = ? AND dedupe_key = ?")
    .get(focusId, dedupeKey) as ObligationRow | undefined;
  return row ? obligationFromRow(row) : null;
}

export function listObligations(db: Db, focusId: string): FocusObligation[] {
  const rows = db
    .prepare("SELECT * FROM focus_obligations WHERE focus_id = ? ORDER BY created_at, id")
    .all(focusId) as ObligationRow[];
  return rows.map(obligationFromRow);
}

export function listOpenObligations(db: Db, focusId: string): FocusObligation[] {
  return listObligations(db, focusId).filter((o) => isOpenObligationStatus(o.status));
}

/** owner=human 的未结义务(V1 exact-set 分母) */
export function listOpenHumanObligations(db: Db, focusId: string): FocusObligation[] {
  return listOpenObligations(db, focusId).filter((o) => o.owner === "human");
}

/**
 * 收场/RP 用 obligationsSnapshot:与 DB exact-set 对账用。
 * 每项带 owner/status/nextStep(V1 合同)。
 */
export function buildObligationsSnapshot(
  obligations: FocusObligation[],
  filter?: { owner?: FocusObligationOwner; openOnly?: boolean }
): Array<{
  id: string;
  kind: string;
  title: string;
  owner: FocusObligationOwner;
  status: FocusObligationStatus;
  verification: string;
  nextStep?: string;
  dedupeKey: string;
}> {
  let list = obligations;
  if (filter?.openOnly) list = list.filter((o) => isOpenObligationStatus(o.status));
  if (filter?.owner) list = list.filter((o) => o.owner === filter.owner);
  return list
    .map((o) => ({
      id: o.id,
      kind: o.kind,
      title: o.title,
      owner: o.owner,
      status: o.status,
      verification: o.verification,
      ...(o.nextStep !== undefined ? { nextStep: o.nextStep } : {}),
      dedupeKey: o.dedupeKey
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** V1: snapshot id 集 vs DB owner=human 未结义务 id 集 exact-set */
export function assertHumanOpenExactSet(
  db: Db,
  focusId: string,
  snapshotIds: ReadonlyArray<string>
): { ok: true } | { ok: false; missing: string[]; extra: string[] } {
  const dbIds = new Set(listOpenHumanObligations(db, focusId).map((o) => o.id));
  const snap = new Set(snapshotIds);
  const missing = [...dbIds].filter((id) => !snap.has(id));
  const extra = [...snap].filter((id) => !dbIds.has(id));
  if (missing.length === 0 && extra.length === 0) return { ok: true };
  return { ok: false, missing, extra };
}

export function buildObligationDedupeKey(parts: {
  focusId: string;
  kind: string;
  sourceKey: string;
}): string {
  return `${parts.focusId}:${parts.kind}:${parts.sourceKey}`;
}
