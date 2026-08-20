// Focus v0.4 ④d Expectation aggregate——期待层与执行边界分离。
// 权威派生投影(包/产物/义务 due)→ active 行;用户 adjust → pending_ack → ack CAS 转 active。
// 历史以 superseded 行保留;dispatch 编译只读 status=active(+applies_from 过滤)。

import { createHash } from "node:crypto";
import {
  focusExpectationSchema,
  newId,
  type DecisionPackage,
  type FocusExpectation,
  type FocusExpectationAppliesFrom,
  type FocusExpectationKind,
  type FocusExpectationSourceRef,
  type FocusExpectationStatus
} from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import { FocusWriteError, type FocusWriteOps } from "./writeTx.js";

const US = "\x1f";

export interface ExpectationRow {
  id: string;
  focus_id: string;
  logical_key: string;
  kind: string;
  source_ref_json: string;
  text: string;
  status: string;
  revision: number;
  applies_from: string;
  created_from_event: number | null;
  created_at: string;
  updated_at: string;
}

export function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** criterion 文本 sha256 前 16 位(v5.6 稳定部) */
export function textHash16(text: string): string {
  return sha256Hex(text).slice(0, 16);
}

/**
 * logical_key = hash(focusId ‖ kind ‖ 稳定部)(v3 R4 / v5.6)。
 * acceptance: lineage 根 digest + textHash16 + 同文本序次 n
 * artifact: artifactId
 * budget: lineage 根 digest
 * due: obligationId
 */
export function computeExpectationLogicalKey(
  focusId: string,
  kind: FocusExpectationKind,
  stablePart: string
): string {
  return sha256Hex(focusId + US + kind + US + stablePart);
}

export function acceptanceLogicalKey(
  focusId: string,
  lineageRootDigest: string,
  criterionText: string,
  textOrdinal: number
): string {
  const h = textHash16(criterionText);
  return computeExpectationLogicalKey(focusId, "acceptance", `${lineageRootDigest}${US}${h}${US}${textOrdinal}`);
}

export function artifactLogicalKey(focusId: string, artifactId: string): string {
  return computeExpectationLogicalKey(focusId, "artifact", artifactId);
}

export function budgetLogicalKey(focusId: string, lineageRootDigest: string): string {
  return computeExpectationLogicalKey(focusId, "budget", lineageRootDigest);
}

export function dueLogicalKey(focusId: string, obligationId: string): string {
  return computeExpectationLogicalKey(focusId, "due", obligationId);
}

/**
 * 包 lineage 根 digest:沿 supersedes 链走到链首 revision 的 digest。
 * 断链时以当前可达最旧包 digest 为准。
 * 链回读优先用列 digest + body_json.supersedes(避免完整 schema 解析脆弱)。
 */
export function packageLineageRootDigest(db: Db, pkg: DecisionPackage): string {
  let packageId = pkg.id;
  let revision = pkg.revision;
  let digest = pkg.digest;
  let supersedes = pkg.supersedes;
  const seen = new Set<string>();
  while (supersedes) {
    const key = `${supersedes.packageId}@${supersedes.revision}`;
    if (seen.has(key)) break;
    seen.add(key);
    const row = db
      .prepare(
        `SELECT id, revision, digest, body_json FROM decision_packages WHERE id = ? AND revision = ?`
      )
      .get(supersedes.packageId, supersedes.revision) as
      | { id: string; revision: number; digest: string; body_json: string }
      | undefined;
    if (!row) break;
    packageId = row.id;
    revision = row.revision;
    digest = row.digest;
    try {
      const body = JSON.parse(row.body_json) as { supersedes?: { packageId: string; revision: number } };
      supersedes = body.supersedes;
    } catch {
      supersedes = undefined;
    }
  }
  void packageId;
  void revision;
  return digest;
}

/** 同包内 acceptance 文本 → 序次(1-based,同文本出现次数) */
export function assignTextOrdinals(criteria: string[]): Array<{ text: string; textHash16: string; ordinal: number }> {
  const counts = new Map<string, number>();
  return criteria.map((text) => {
    const h = textHash16(text);
    const n = (counts.get(h) ?? 0) + 1;
    counts.set(h, n);
    return { text, textHash16: h, ordinal: n };
  });
}

export function expectationFromRow(row: ExpectationRow): FocusExpectation {
  const sourceRef = JSON.parse(row.source_ref_json) as FocusExpectationSourceRef;
  return focusExpectationSchema.parse({
    id: row.id,
    focusId: row.focus_id,
    logicalKey: row.logical_key,
    kind: row.kind,
    sourceRef,
    text: row.text,
    status: row.status,
    revision: row.revision,
    appliesFrom: row.applies_from,
    ...(row.created_from_event != null ? { createdFromEvent: row.created_from_event } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}

export function getExpectationRow(db: Db, id: string): ExpectationRow | undefined {
  return db.prepare("SELECT * FROM focus_expectations WHERE id = ?").get(id) as ExpectationRow | undefined;
}

export function listExpectationRows(
  db: Db,
  focusId: string,
  status?: FocusExpectationStatus
): ExpectationRow[] {
  if (status) {
    return db
      .prepare(
        `SELECT * FROM focus_expectations WHERE focus_id = ? AND status = ? ORDER BY kind, created_at, id`
      )
      .all(focusId, status) as ExpectationRow[];
  }
  return db
    .prepare(`SELECT * FROM focus_expectations WHERE focus_id = ? ORDER BY kind, created_at, id`)
    .all(focusId) as ExpectationRow[];
}

/**
 * dispatch/frozen 编译输入:只读 active;
 * applies_from='next_dispatch' 在 includeNextDispatch=false 时排除
 * (目标任务仍在飞时,next_dispatch 行不进当前编译)。
 */
export function listExpectationsForDispatch(
  db: Db,
  focusId: string,
  opts?: { includeNextDispatch?: boolean }
): FocusExpectation[] {
  const includeNext = opts?.includeNextDispatch === true;
  const rows = listExpectationRows(db, focusId, "active");
  return rows
    .filter((r) => includeNext || r.applies_from === "current")
    .map(expectationFromRow);
}

/** Focus 下是否仍有未 settle 的执行绑定任务(非终态) */
export function focusHasUnsettledAuthorizedTask(db: Db, focusId: string): boolean {
  const row = db
    .prepare(
      `SELECT b.task_id FROM action_execution_bindings b
       JOIN tasks t ON t.id = b.task_id
       WHERE b.focus_id = ?
         AND b.superseded_by_binding_id IS NULL
         AND t.status NOT IN ('task_done','failed','merge_failed','cancel_settled','superseded')
       LIMIT 1`
    )
    .get(focusId) as { task_id: string } | undefined;
  return !!row;
}

function insertExpectationRow(
  db: Db,
  row: {
    id: string;
    focusId: string;
    logicalKey: string;
    kind: FocusExpectationKind;
    sourceRef: FocusExpectationSourceRef;
    text: string;
    status: FocusExpectationStatus;
    revision: number;
    appliesFrom: FocusExpectationAppliesFrom;
    createdFromEvent: number | null;
    createdAt: string;
    updatedAt: string;
  }
): void {
  db.prepare(
    `INSERT INTO focus_expectations(
      id, focus_id, logical_key, kind, source_ref_json, text, status, revision,
      applies_from, created_from_event, created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    row.id,
    row.focusId,
    row.logicalKey,
    row.kind,
    JSON.stringify(row.sourceRef),
    row.text,
    row.status,
    row.revision,
    row.appliesFrom,
    row.createdFromEvent,
    row.createdAt,
    row.updatedAt
  );
}

function supersedeById(db: Db, id: string, nowIso: string): number {
  const r = db
    .prepare(
      `UPDATE focus_expectations SET status = 'superseded', updated_at = ?
       WHERE id = ? AND status IN ('active','pending_ack')`
    )
    .run(nowIso, id) as { changes: number };
  return r.changes;
}

function getActiveByLogicalKey(db: Db, logicalKey: string): ExpectationRow | undefined {
  return db
    .prepare(`SELECT * FROM focus_expectations WHERE logical_key = ? AND status = 'active'`)
    .get(logicalKey) as ExpectationRow | undefined;
}

function getPendingByLogicalKey(db: Db, logicalKey: string): ExpectationRow | undefined {
  return db
    .prepare(`SELECT * FROM focus_expectations WHERE logical_key = ? AND status = 'pending_ack'`)
    .get(logicalKey) as ExpectationRow | undefined;
}

export interface ProjectPackageResult {
  created: string[];
  superseded: string[];
}

/**
 * 包批准投影(dispatchApprovedPackage 消费事务内):acceptance 逐条 + cost.max→budget。
 * 包 revision 更新时按 textHash+序次一对一迁移(同 logical_key);未匹配旧行 superseded。
 * 存量不回填——仅本路径调用时写入。
 */
export function projectPackageExpectationsOnOps(
  ops: FocusWriteOps,
  focusId: string,
  pkg: DecisionPackage
): ProjectPackageResult {
  const db = ops.db;
  const nowIso = ops.nowIso;
  const lineageRoot = packageLineageRootDigest(db, pkg);
  const created: string[] = [];
  const superseded: string[] = [];

  // --- acceptance ---
  const criteria = assignTextOrdinals(pkg.acceptance);
  const matchedKeys = new Set<string>();

  for (let i = 0; i < criteria.length; i++) {
    const c = criteria[i]!;
    const logicalKey = acceptanceLogicalKey(focusId, lineageRoot, c.text, c.ordinal);
    matchedKeys.add(logicalKey);
    const sourceRef: FocusExpectationSourceRef = {
      type: "decision_package",
      id: `${pkg.id}@${pkg.revision}`,
      packageId: pkg.id,
      digest: pkg.digest,
      revision: pkg.revision,
      criterionIndex: i,
      textHash16: c.textHash16,
      textOrdinal: c.ordinal,
      lineageRootDigest: lineageRoot
    };
    const existing = getActiveByLogicalKey(db, logicalKey);
    if (existing) {
      // 同键迁移:旧行 superseded + 新 active(revision+1),source_ref 换新包
      if (
        existing.text === c.text &&
        (JSON.parse(existing.source_ref_json) as FocusExpectationSourceRef).digest === pkg.digest
      ) {
        // 同包同 digest 幂等:不重复投影
        continue;
      }
      supersedeById(db, existing.id, nowIso);
      superseded.push(existing.id);
      const id = newId("fex");
      insertExpectationRow(db, {
        id,
        focusId,
        logicalKey,
        kind: "acceptance",
        sourceRef,
        text: c.text,
        status: "active",
        revision: existing.revision + 1,
        appliesFrom: "current",
        createdFromEvent: null,
        createdAt: nowIso,
        updatedAt: nowIso
      });
      created.push(id);
    } else {
      const id = newId("fex");
      insertExpectationRow(db, {
        id,
        focusId,
        logicalKey,
        kind: "acceptance",
        sourceRef,
        text: c.text,
        status: "active",
        revision: 1,
        appliesFrom: "current",
        createdFromEvent: null,
        createdAt: nowIso,
        updatedAt: nowIso
      });
      created.push(id);
    }
  }

  // 未匹配的同 lineage 旧 acceptance active 行 → superseded
  const oldAcceptances = db
    .prepare(
      `SELECT * FROM focus_expectations
       WHERE focus_id = ? AND kind = 'acceptance' AND status = 'active'`
    )
    .all(focusId) as ExpectationRow[];
  for (const old of oldAcceptances) {
    if (matchedKeys.has(old.logical_key)) continue;
    const ref = JSON.parse(old.source_ref_json) as FocusExpectationSourceRef;
    if (ref.lineageRootDigest && ref.lineageRootDigest !== lineageRoot) continue;
    if (ref.packageId && ref.packageId !== pkg.id) continue;
    supersedeById(db, old.id, nowIso);
    superseded.push(old.id);
  }

  // --- budget ---
  const budgetKey = budgetLogicalKey(focusId, lineageRoot);
  const budgetText = `预算封顶 ${pkg.cost.max} ${pkg.cost.currency}`;
  const budgetRef: FocusExpectationSourceRef = {
    type: "decision_package",
    id: `${pkg.id}@${pkg.revision}`,
    packageId: pkg.id,
    digest: pkg.digest,
    revision: pkg.revision,
    lineageRootDigest: lineageRoot,
    budgetMax: pkg.cost.max
  };
  const existingBudget = getActiveByLogicalKey(db, budgetKey);
  if (existingBudget) {
    const prevRef = JSON.parse(existingBudget.source_ref_json) as FocusExpectationSourceRef;
    if (prevRef.digest !== pkg.digest || existingBudget.text !== budgetText) {
      supersedeById(db, existingBudget.id, nowIso);
      superseded.push(existingBudget.id);
      const id = newId("fex");
      insertExpectationRow(db, {
        id,
        focusId,
        logicalKey: budgetKey,
        kind: "budget",
        sourceRef: budgetRef,
        text: budgetText,
        status: "active",
        revision: existingBudget.revision + 1,
        appliesFrom: "current",
        createdFromEvent: null,
        createdAt: nowIso,
        updatedAt: nowIso
      });
      created.push(id);
    }
  } else {
    const id = newId("fex");
    insertExpectationRow(db, {
      id,
      focusId,
      logicalKey: budgetKey,
      kind: "budget",
      sourceRef: budgetRef,
      text: budgetText,
      status: "active",
      revision: 1,
      appliesFrom: "current",
      createdFromEvent: null,
      createdAt: nowIso,
      updatedAt: nowIso
    });
    created.push(id);
  }

  ops.touchUpdatedAt(focusId);
  return { created, superseded };
}

/**
 * expected artifact create 同事务投影 artifact 期待行。
 */
export function projectArtifactExpectationOnOps(
  ops: FocusWriteOps,
  focusId: string,
  artifactId: string,
  title: string,
  createdFromEvent: number | null
): string {
  const db = ops.db;
  const nowIso = ops.nowIso;
  const logicalKey = artifactLogicalKey(focusId, artifactId);
  const existing = getActiveByLogicalKey(db, logicalKey);
  if (existing) return existing.id;
  const id = newId("fex");
  insertExpectationRow(db, {
    id,
    focusId,
    logicalKey,
    kind: "artifact",
    sourceRef: {
      type: "artifact",
      id: artifactId,
      artifactId
    },
    text: title,
    status: "active",
    revision: 1,
    appliesFrom: "current",
    createdFromEvent,
    createdAt: nowIso,
    updatedAt: nowIso
  });
  ops.touchUpdatedAt(focusId);
  return id;
}

/**
 * upsertObligation 设 dueOrTrigger 时投影 due 行;清空 due 时 supersede 现 active。
 */
export function projectDueExpectationOnOps(
  ops: FocusWriteOps,
  focusId: string,
  obligationId: string,
  dueOrTrigger: string | null | undefined,
  _title: string
): string | null {
  const db = ops.db;
  const nowIso = ops.nowIso;
  const logicalKey = dueLogicalKey(focusId, obligationId);
  const existing = getActiveByLogicalKey(db, logicalKey);

  if (dueOrTrigger === undefined) {
    // 未触碰 due 字段
    return existing?.id ?? null;
  }
  if (dueOrTrigger === null || dueOrTrigger.trim() === "") {
    if (existing) {
      supersedeById(db, existing.id, nowIso);
      ops.touchUpdatedAt(focusId);
    }
    return null;
  }

  const text = dueOrTrigger.trim();
  const sourceRef: FocusExpectationSourceRef = {
    type: "obligation",
    id: obligationId,
    obligationId
  };

  if (existing) {
    if (existing.text === text) return existing.id;
    supersedeById(db, existing.id, nowIso);
    const id = newId("fex");
    insertExpectationRow(db, {
      id,
      focusId,
      logicalKey,
      kind: "due",
      sourceRef,
      text,
      status: "active",
      revision: existing.revision + 1,
      appliesFrom: "current",
      createdFromEvent: null,
      createdAt: nowIso,
      updatedAt: nowIso
    });
    ops.touchUpdatedAt(focusId);
    return id;
  }

  const id = newId("fex");
  insertExpectationRow(db, {
    id,
    focusId,
    logicalKey,
    kind: "due",
    sourceRef,
    text,
    status: "active",
    revision: 1,
    appliesFrom: "current",
    createdFromEvent: null,
    createdAt: nowIso,
    updatedAt: nowIso
  });
  ops.touchUpdatedAt(focusId);
  return id;
}

export interface AdjustExpectationPatch {
  text?: string;
  dueOrTrigger?: string;
  budgetNote?: string;
}

export interface AdjustExpectationResult {
  expectationId: string;
  logicalKey: string;
  fromRevision: number;
  toRevision: number;
  previousActiveId: string | null;
  eventId: string;
  appliesFrom: FocusExpectationAppliesFrom;
  text: string;
  kind: FocusExpectationKind;
}

/**
 * adjust 写口:已有 pending_ack → 409;落 expectation_adjusted 事件 + 新 revision pending_ack 行。
 * 旧 active 保留(pending_ack 期间 dispatch 仍读 active)。
 * 目标任务未 settle 时 applies_from 保持 current;已有未 settle 任务时仍 current;
 * 目标任务已 settle(无在飞任务)时 applies_from='next_dispatch'。
 */
export function adjustExpectationOnOps(
  ops: FocusWriteOps,
  focusId: string,
  expectationId: string,
  patch: AdjustExpectationPatch,
  actor?: { actorKind?: "user" | "daemon" | "brain_proposal"; sessionId?: string }
): AdjustExpectationResult {
  const db = ops.db;
  const nowIso = ops.nowIso;
  const row = getExpectationRow(db, expectationId);
  if (!row || row.focus_id !== focusId) {
    throw new FocusWriteError("not_found", `expectation ${expectationId} not found on focus`);
  }
  if (row.status === "superseded") {
    throw new FocusWriteError("superseded", "cannot adjust superseded expectation");
  }
  // 若调的是 active:检查同 key 是否已有 pending_ack
  // 若调的是 pending_ack:二次 adjust → 409
  if (row.status === "pending_ack") {
    throw new FocusWriteError("pending_ack_exists", "already has pending_ack; ack or withdraw first");
  }
  const pending = getPendingByLogicalKey(db, row.logical_key);
  if (pending) {
    throw new FocusWriteError("pending_ack_exists", "already has pending_ack; ack or withdraw first");
  }

  const kind = row.kind as FocusExpectationKind;
  let newText = row.text;
  if (patch.text !== undefined && patch.text.trim() !== "") {
    newText = patch.text.trim();
  } else if (kind === "due" && patch.dueOrTrigger !== undefined && patch.dueOrTrigger.trim() !== "") {
    newText = patch.dueOrTrigger.trim();
  } else if (kind === "budget" && patch.budgetNote !== undefined && patch.budgetNote.trim() !== "") {
    newText = patch.budgetNote.trim();
  } else if (
    patch.text === undefined &&
    patch.dueOrTrigger === undefined &&
    patch.budgetNote === undefined
  ) {
    throw new FocusWriteError("empty_patch", "adjust requires text, dueOrTrigger, or budgetNote");
  }

  // 目标任务已 settle(无在飞授权任务)→ next_dispatch;否则 current
  const appliesFrom: FocusExpectationAppliesFrom = focusHasUnsettledAuthorizedTask(db, focusId)
    ? "current"
    : "next_dispatch";
  // 无任何绑定任务时也用 current(首次期待调整直接生效路径)
  const hasAnyBinding = db
    .prepare(`SELECT 1 AS x FROM action_execution_bindings WHERE focus_id = ? LIMIT 1`)
    .get(focusId) as { x: number } | undefined;
  const finalApplies: FocusExpectationAppliesFrom = hasAnyBinding ? appliesFrom : "current";

  // 若当前无 active 可继承(异常),仍允许从任意非 superseded 开链
  const active = row.status === "active" ? row : getActiveByLogicalKey(db, row.logical_key);
  const fromRevision = active?.revision ?? row.revision;
  const toRevision = fromRevision + 1;
  const newId_ = newId("fex");
  const sourceRef = JSON.parse(row.source_ref_json) as FocusExpectationSourceRef;

  insertExpectationRow(db, {
    id: newId_,
    focusId,
    logicalKey: row.logical_key,
    kind,
    sourceRef,
    text: newText,
    status: "pending_ack",
    revision: toRevision,
    appliesFrom: finalApplies,
    createdFromEvent: null,
    createdAt: nowIso,
    updatedAt: nowIso
  });

  const ev = ops.appendEvent(focusId, {
    type: "expectation_adjusted",
    payload: {
      expectationId: newId_,
      logicalKey: row.logical_key,
      kind,
      fromRevision,
      toRevision,
      ...(active ? { previousExpectationId: active.id } : {}),
      text: newText,
      patch: {
        ...(patch.text !== undefined ? { text: patch.text } : {}),
        ...(patch.dueOrTrigger !== undefined ? { dueOrTrigger: patch.dueOrTrigger } : {}),
        ...(patch.budgetNote !== undefined ? { budgetNote: patch.budgetNote } : {})
      }
    },
    actorKind: actor?.actorKind ?? "user",
    sessionId: actor?.sessionId
  });

  // 回填 created_from_event
  db.prepare(`UPDATE focus_expectations SET created_from_event = ? WHERE id = ?`).run(ev.seq, newId_);

  return {
    expectationId: newId_,
    logicalKey: row.logical_key,
    fromRevision,
    toRevision,
    previousActiveId: active?.id ?? null,
    eventId: ev.id,
    appliesFrom: finalApplies,
    text: newText,
    kind
  };
}

/**
 * 用户撤回 pending_ack → superseded + expectation_ack_settled(outcome=withdrawn)。
 */
export function withdrawExpectationOnOps(
  ops: FocusWriteOps,
  focusId: string,
  expectationId: string,
  actor?: { actorKind?: "user" | "daemon"; sessionId?: string }
): { eventId: string; logicalKey: string; revision: number } {
  const db = ops.db;
  const nowIso = ops.nowIso;
  const row = getExpectationRow(db, expectationId);
  if (!row || row.focus_id !== focusId) {
    throw new FocusWriteError("not_found", `expectation ${expectationId} not found on focus`);
  }
  if (row.status !== "pending_ack") {
    throw new FocusWriteError("not_pending_ack", `expectation status=${row.status}, only pending_ack can withdraw`);
  }
  const cas = db
    .prepare(
      `UPDATE focus_expectations SET status = 'superseded', updated_at = ?
       WHERE id = ? AND status = 'pending_ack'`
    )
    .run(nowIso, expectationId) as { changes: number };
  if (cas.changes !== 1) {
    throw new FocusWriteError("cas_failed", "withdraw CAS failed");
  }
  const kind = row.kind as FocusExpectationKind;
  const ev = ops.appendEvent(focusId, {
    type: "expectation_ack_settled",
    payload: {
      expectationId,
      logicalKey: row.logical_key,
      kind,
      fromRevision: row.revision,
      toRevision: row.revision,
      outcome: "withdrawn"
    },
    actorKind: actor?.actorKind ?? "user",
    sessionId: actor?.sessionId
  });
  return { eventId: ev.id, logicalKey: row.logical_key, revision: row.revision };
}

export type ExpectationAckOutcome = "accepted" | "rejected" | "withdrawn" | "withdrawn_system";

/**
 * ack 四合一 CAS(须在与 commitConsume 同一事务):
 * accepted: 旧 active→superseded + pending_ack→active + expectation_ack_settled
 * rejected/withdrawn: pending_ack→superseded
 * CAS 失败抛 cas_failed(调用方 releaseHold 保卡)
 */
export function settleExpectationAckOnOps(
  ops: FocusWriteOps,
  input: {
    focusId: string;
    expectationId: string;
    fromRevision: number;
    toRevision: number;
    outcome: ExpectationAckOutcome;
    receiptRef?: string;
    sessionId?: string;
  }
): { previousActiveId: string | null; eventId: string } {
  const db = ops.db;
  const nowIso = ops.nowIso;
  const pending = getExpectationRow(db, input.expectationId);
  if (!pending || pending.focus_id !== input.focusId) {
    throw new FocusWriteError("not_found", `expectation ${input.expectationId} not found`);
  }
  if (pending.status !== "pending_ack") {
    throw new FocusWriteError("cas_failed", `expected pending_ack, got ${pending.status}`);
  }
  if (pending.revision !== input.toRevision) {
    throw new FocusWriteError(
      "cas_failed",
      `revision drift: pending=${pending.revision} expected to=${input.toRevision}`
    );
  }

  const kind = pending.kind as FocusExpectationKind;
  let previousActiveId: string | null = null;

  if (input.outcome === "accepted") {
    const active = getActiveByLogicalKey(db, pending.logical_key);
    if (active) {
      if (active.revision !== input.fromRevision && input.fromRevision > 0) {
        // fromRevision=0 表示此前无 active;>0 时须匹配
        throw new FocusWriteError(
          "cas_failed",
          `active revision drift: active=${active.revision} expected from=${input.fromRevision}`
        );
      }
      const sup = db
        .prepare(
          `UPDATE focus_expectations SET status = 'superseded', updated_at = ?
           WHERE id = ? AND status = 'active'`
        )
        .run(nowIso, active.id) as { changes: number };
      if (sup.changes !== 1) {
        throw new FocusWriteError("cas_failed", "active supersede CAS failed");
      }
      previousActiveId = active.id;
    }
    const act = db
      .prepare(
        `UPDATE focus_expectations SET status = 'active', updated_at = ?
         WHERE id = ? AND status = 'pending_ack' AND revision = ?`
      )
      .run(nowIso, input.expectationId, input.toRevision) as { changes: number };
    if (act.changes !== 1) {
      throw new FocusWriteError("cas_failed", "pending_ack→active CAS failed");
    }
  } else {
    // rejected / withdrawn / withdrawn_system
    const sup = db
      .prepare(
        `UPDATE focus_expectations SET status = 'superseded', updated_at = ?
         WHERE id = ? AND status = 'pending_ack' AND revision = ?`
      )
      .run(nowIso, input.expectationId, input.toRevision) as { changes: number };
    if (sup.changes !== 1) {
      throw new FocusWriteError("cas_failed", "pending_ack supersede CAS failed");
    }
  }

  const ev = ops.appendEvent(input.focusId, {
    type: "expectation_ack_settled",
    payload: {
      expectationId: input.expectationId,
      logicalKey: pending.logical_key,
      kind,
      fromRevision: input.fromRevision,
      toRevision: input.toRevision,
      outcome: input.outcome,
      ...(previousActiveId ? { previousActiveId } : {}),
      ...(input.receiptRef ? { receiptRef: input.receiptRef } : {})
    },
    actorKind: "user",
    sessionId: input.sessionId
  });

  return { previousActiveId, eventId: ev.id };
}
