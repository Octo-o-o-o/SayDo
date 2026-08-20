// Focus lanes(合同 §3):拆分 / 收起 / 从某步重走。
// 建线断言 parent 存在∧同 focus∧retired_at IS NULL(A-4)+无环(≤16)。
// 父线 retire 前置:无未 retire 子线(lane_has_children)。

import { newId, type FocusBaselineTriple } from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import {
  FocusWriteError,
  withFocusWriteTx,
  type FocusWriteOps,
  type FocusWriteTxOptions
} from "./writeTx.js";
import { openObligationsDigest, maxFocusEventSeq } from "./baseline.js";

export interface LaneSplitLaneSpec {
  title: string;
  parentLaneId: string | null;
  obligationIds: string[];
}

export interface ConsumeLaneSplitInput {
  focusId: string;
  lanes: LaneSplitLaneSpec[];
  baseline?: FocusBaselineTriple;
  actorKind?: "user" | "daemon" | "brain_proposal";
  sessionId?: string;
}

function assertParentLaneOk(
  db: Db,
  focusId: string,
  parentLaneId: string | null,
  selfId?: string
): void {
  if (parentLaneId === null) return;
  if (selfId && parentLaneId === selfId) {
    throw new FocusWriteError("lane_self_parent", "parent_lane_id cannot equal id");
  }
  const parent = db
    .prepare(
      `SELECT id, retired_at FROM focus_lanes WHERE focus_id = ? AND id = ?`
    )
    .get(focusId, parentLaneId) as { id: string; retired_at: string | null } | undefined;
  if (!parent) {
    throw new FocusWriteError("lane_parent_missing", `parent lane ${parentLaneId} not found on focus`);
  }
  if (parent.retired_at != null) {
    throw new FocusWriteError("lane_parent_retired", `parent lane ${parentLaneId} is retired`);
  }
  // 环检测:沿 parent 上溯 ≤16
  let cur: string | null = parentLaneId;
  for (let d = 0; d < 16; d++) {
    if (selfId && cur === selfId) {
      throw new FocusWriteError("lane_cycle", "lane parent chain cycles");
    }
    const row = db
      .prepare(`SELECT parent_lane_id AS p FROM focus_lanes WHERE focus_id = ? AND id = ?`)
      .get(focusId, cur) as { p: string | null } | undefined;
    if (!row || !row.p) return;
    cur = row.p;
  }
  throw new FocusWriteError("lane_depth_exceeded", "lane parent chain depth exceeded 16");
}

function readBaseline(db: Db, focusId: string): FocusBaselineTriple {
  const row = db.prepare("SELECT current_revision FROM focuses WHERE id = ?").get(focusId) as
    | { current_revision: number }
    | undefined;
  return {
    focusRevision: row?.current_revision ?? 0,
    eventHWM: maxFocusEventSeq(db, focusId),
    obligationsDigest: openObligationsDigest(db, focusId)
  };
}

function assertBaseline(
  db: Db,
  focusId: string,
  expected?: FocusBaselineTriple
): FocusBaselineTriple {
  const actual = readBaseline(db, focusId);
  if (!expected) return actual;
  if (
    expected.focusRevision !== actual.focusRevision ||
    expected.eventHWM !== actual.eventHWM ||
    expected.obligationsDigest !== actual.obligationsDigest
  ) {
    throw new FocusWriteError(
      "stale_baseline",
      `baseline drift: expected r${expected.focusRevision}/hwm${expected.eventHWM}, actual r${actual.focusRevision}/hwm${actual.eventHWM}`
    );
  }
  return actual;
}

/** 消费 proposeLaneSplit:建 lanes + lane_split 事件 + 逐义务 UPDATE(双断言) */
export function consumeLaneSplit(
  db: Db,
  input: ConsumeLaneSplitInput,
  opts: FocusWriteTxOptions = {}
): { laneIds: string[]; eventId: string } {
  return withFocusWriteTx(db, opts, (ops) => consumeLaneSplitOnOps(ops, input));
}

export function consumeLaneSplitOnOps(
  ops: FocusWriteOps,
  input: ConsumeLaneSplitInput
): { laneIds: string[]; eventId: string } {
  const db = ops.db;
  ops.getFocus(input.focusId);
  const baseline = assertBaseline(db, input.focusId, input.baseline);

  if (!input.lanes.length) {
    throw new FocusWriteError("lane_split_empty", "lanes array required");
  }

  // 预分配 id,便于同批父子引用(仅当 parent 在本批已建)
  const laneIds: string[] = [];
  const titles: string[] = [];
  const parentLaneIds: Array<string | null> = [];
  const allObIds: string[] = [];
  const created: Array<{ id: string; title: string; parentLaneId: string | null; obligationIds: string[] }> =
    [];

  // 两遍:先分配 id,再校验 parent(允许本批内前序线作父)
  for (const spec of input.lanes) {
    const title = spec.title.trim();
    if (!title) throw new FocusWriteError("lane_title_required", "lane title required");
    const id = newId("lan");
    created.push({
      id,
      title,
      parentLaneId: spec.parentLaneId,
      obligationIds: spec.obligationIds
    });
    laneIds.push(id);
    titles.push(title);
    parentLaneIds.push(spec.parentLaneId);
    allObIds.push(...spec.obligationIds);
  }
  const batchIds = new Set(laneIds);
  for (const c of created) {
    if (c.parentLaneId === null) continue;
    if (c.parentLaneId === c.id) {
      throw new FocusWriteError("lane_self_parent", "parent_lane_id cannot equal id");
    }
    if (batchIds.has(c.parentLaneId)) {
      // 本批内父线:须先于子线出现(拓扑序)
      const parentIdx = created.findIndex((x) => x.id === c.parentLaneId);
      const selfIdx = created.findIndex((x) => x.id === c.id);
      if (parentIdx < 0 || parentIdx >= selfIdx) {
        throw new FocusWriteError(
          "lane_parent_order",
          "parent lane must appear before child in same split batch"
        );
      }
      continue;
    }
    assertParentLaneOk(db, input.focusId, c.parentLaneId, c.id);
  }

  // 先写 lane_split 事件取 seq,再插 lane 行(FK created_from_event)
  const ev = ops.appendEvent(input.focusId, {
    type: "lane_split",
    payload: {
      laneIds,
      titles,
      parentLaneIds,
      obligationIds: allObIds,
      baseline
    },
    actorKind: input.actorKind ?? "user",
    sessionId: input.sessionId
  });

  for (const c of created) {
    db.prepare(
      `INSERT INTO focus_lanes(focus_id, id, title, parent_lane_id, created_from_event, retired_at)
       VALUES (?,?,?,?,?,NULL)`
    ).run(input.focusId, c.id, c.title, c.parentLaneId, ev.seq);

    for (const oid of c.obligationIds) {
      const r = db
        .prepare(
          `UPDATE focus_obligations SET lane_id = ?, updated_at = ?
           WHERE id = ? AND focus_id = ?`
        )
        .run(c.id, ops.nowIso, oid, input.focusId) as { changes: number };
      if (r.changes !== 1) {
        throw new FocusWriteError(
          "obligation_lane_assign_failed",
          `obligation ${oid} not on focus ${input.focusId} or missing`
        );
      }
    }
  }

  return { laneIds, eventId: ev.id };
}

export interface RetireLaneInput {
  focusId: string;
  laneId: string;
  actorKind?: "user" | "daemon" | "brain_proposal";
  sessionId?: string;
}

/** 收起线:未结义务 resolve superseded + retired_at + lane_retired 事件 */
export function retireLane(
  db: Db,
  input: RetireLaneInput,
  opts: FocusWriteTxOptions = {}
): { resolvedIds: string[]; eventId: string } {
  return withFocusWriteTx(db, opts, (ops) => {
    const dbx = ops.db;
    ops.getFocus(input.focusId);
    const lane = dbx
      .prepare(`SELECT id, title, retired_at FROM focus_lanes WHERE focus_id = ? AND id = ?`)
      .get(input.focusId, input.laneId) as { id: string; title: string; retired_at: string | null } | undefined;
    if (!lane) throw new FocusWriteError("lane_not_found", `lane ${input.laneId} not found`);
    if (lane.retired_at != null) {
      throw new FocusWriteError("lane_already_retired", `lane ${input.laneId} already retired`);
    }
    // 父线 retire 前置:无未 retire 子线
    const child = dbx
      .prepare(
        `SELECT id FROM focus_lanes
         WHERE focus_id = ? AND parent_lane_id = ? AND retired_at IS NULL LIMIT 1`
      )
      .get(input.focusId, input.laneId) as { id: string } | undefined;
    if (child) {
      throw new FocusWriteError(
        "lane_has_children",
        `lane ${input.laneId} has unretired child ${child.id}; retire children first`
      );
    }

    const open = dbx
      .prepare(
        `SELECT id, kind, title, owner, status, verification, dedupe_key, detail, next_step, blocking, needs
         FROM focus_obligations
         WHERE focus_id = ? AND lane_id = ?
           AND status IN ('open','in_progress','waiting','deferred','blocked')`
      )
      .all(input.focusId, input.laneId) as Array<{
      id: string;
      kind: string;
      title: string;
      owner: string;
      status: string;
      verification: string;
      dedupe_key: string;
      detail: string | null;
      next_step: string | null;
      blocking: number;
      needs: string | null;
    }>;

    const resolvedIds: string[] = [];
    for (const o of open) {
      ops.upsertObligation(input.focusId, {
        id: o.id,
        kind: o.kind as "answer" | "decision" | "action" | "followup" | "check",
        title: o.title,
        owner: o.owner as "human" | "agent" | "external",
        status: "superseded",
        verification: o.verification as "provisional" | "unverified" | "confirmed",
        dedupeKey: o.dedupe_key,
        resolution: "superseded",
        blocking: o.blocking === 1,
        ...(o.detail ? { detail: o.detail } : {}),
        ...(o.next_step ? { nextStep: o.next_step } : {}),
        actorKind: input.actorKind ?? "user",
        sessionId: input.sessionId
      });
      resolvedIds.push(o.id);
    }

    dbx.prepare(`UPDATE focus_lanes SET retired_at = ? WHERE focus_id = ? AND id = ?`).run(
      ops.nowIso,
      input.focusId,
      input.laneId
    );

    const baseline = readBaseline(dbx, input.focusId);
    const ev = ops.appendEvent(input.focusId, {
      type: "lane_retired",
      payload: {
        laneId: input.laneId,
        title: lane.title,
        resolvedIds,
        baseline
      },
      actorKind: input.actorKind ?? "user",
      sessionId: input.sessionId
    });
    return { resolvedIds, eventId: ev.id };
  });
}

export interface RedoFromInput {
  focusId: string;
  laneId: string;
  anchorSeq: number;
  /** exact set(合同 §3.3);可含 extraSupersededIds 合并后的全集 */
  supersededIds: string[];
  actorKind?: "user" | "daemon" | "brain_proposal";
  sessionId?: string;
}

/**
 * 从某步重走:只认 exact set 作废;逐 id 断言属 focus+lane+未结;批量 superseded + redo_from 事件。
 * 建议预选(created_from_event > anchorSeq)由 API 响应给出,不自动入集。
 */
export function redoFromLane(
  db: Db,
  input: RedoFromInput,
  opts: FocusWriteTxOptions = {}
): { supersededIds: string[]; eventId: string; suggestedIds: string[] } {
  return withFocusWriteTx(db, opts, (ops) => {
    const dbx = ops.db;
    ops.getFocus(input.focusId);
    const lane = dbx
      .prepare(`SELECT id, title, retired_at FROM focus_lanes WHERE focus_id = ? AND id = ?`)
      .get(input.focusId, input.laneId) as { id: string; title: string; retired_at: string | null } | undefined;
    if (!lane) throw new FocusWriteError("lane_not_found", `lane ${input.laneId} not found`);
    if (lane.retired_at != null) {
      throw new FocusWriteError("lane_already_retired", `lane ${input.laneId} is retired`);
    }

    // 建议集(仅返回;执行认 exact set)
    const suggested = dbx
      .prepare(
        `SELECT id FROM focus_obligations
         WHERE focus_id = ? AND lane_id = ?
           AND status IN ('open','in_progress','waiting','deferred','blocked')
           AND created_from_event IS NOT NULL AND created_from_event > ?`
      )
      .all(input.focusId, input.laneId, input.anchorSeq) as { id: string }[];
    const suggestedIds = suggested.map((r) => r.id);

    const exact = [...new Set(input.supersededIds)];
    for (const oid of exact) {
      const o = dbx
        .prepare(
          `SELECT id, kind, title, owner, status, verification, dedupe_key, detail, next_step, blocking
           FROM focus_obligations WHERE id = ?`
        )
        .get(oid) as
        | {
            id: string;
            kind: string;
            title: string;
            owner: string;
            status: string;
            verification: string;
            dedupe_key: string;
            detail: string | null;
            next_step: string | null;
            blocking: number;
            lane_id?: string | null;
          }
        | undefined;
      if (!o) throw new FocusWriteError("obligation_not_found", `obligation ${oid} not found`);
      const full = dbx
        .prepare(`SELECT focus_id, lane_id, status FROM focus_obligations WHERE id = ?`)
        .get(oid) as { focus_id: string; lane_id: string | null; status: string };
      if (full.focus_id !== input.focusId || full.lane_id !== input.laneId) {
        throw new FocusWriteError(
          "obligation_lane_mismatch",
          `obligation ${oid} not on focus/lane`
        );
      }
      if (!["open", "in_progress", "waiting", "deferred", "blocked"].includes(full.status)) {
        throw new FocusWriteError("obligation_not_open", `obligation ${oid} status=${full.status}`);
      }
      ops.upsertObligation(input.focusId, {
        id: o.id,
        kind: o.kind as "answer" | "decision" | "action" | "followup" | "check",
        title: o.title,
        owner: o.owner as "human" | "agent" | "external",
        status: "superseded",
        verification: o.verification as "provisional" | "unverified" | "confirmed",
        dedupeKey: o.dedupe_key,
        resolution: "superseded",
        blocking: o.blocking === 1,
        ...(o.detail ? { detail: o.detail } : {}),
        ...(o.next_step ? { nextStep: o.next_step } : {}),
        actorKind: input.actorKind ?? "user",
        sessionId: input.sessionId
      });
    }

    const baseline = readBaseline(dbx, input.focusId);
    const ev = ops.appendEvent(input.focusId, {
      type: "redo_from",
      payload: {
        laneId: input.laneId,
        anchorSeq: input.anchorSeq,
        supersededIds: exact,
        baseline
      },
      actorKind: input.actorKind ?? "user",
      sessionId: input.sessionId
    });
    return { supersededIds: exact, eventId: ev.id, suggestedIds };
  });
}

export function listLanes(db: Db, focusId: string): Array<{
  id: string;
  title: string;
  parentLaneId: string | null;
  createdFromEvent: number;
  retiredAt: string | null;
}> {
  const rows = db
    .prepare(
      `SELECT id, title, parent_lane_id, created_from_event, retired_at
       FROM focus_lanes WHERE focus_id = ? ORDER BY created_from_event, id`
    )
    .all(focusId) as Array<{
    id: string;
    title: string;
    parent_lane_id: string | null;
    created_from_event: number;
    retired_at: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    parentLaneId: r.parent_lane_id,
    createdFromEvent: r.created_from_event,
    retiredAt: r.retired_at
  }));
}
