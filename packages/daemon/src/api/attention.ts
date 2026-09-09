// GET /api/attention —— 合同 §5.2 四色 attention read model。
// 语义逐字对照 v0.3.2 OPEN_SET/id 命名空间/排序/unknown 橙尾 + v0.3.3 停机过滤/
// binding 条件照实/blocked 分支/task↔obligation 去重/pending json_each 去重。
// v25+: attention_acks 账本(与 callback_outbox.acked_at 分账);仅 calm(绿/灰)可 ack,
// GET 过滤=当前色 green/gray 且有 ack 记录;橙/蓝升级后无视历史 ack 必重现。

import {
  isConfirmKind,
  OPEN_SET,
  type AttentionColor,
  type AttentionItem,
  type FocusObligationNeeds
} from "@saydo/contracts";
import type { Db } from "../storage/db.js";

const LIVE_LIFECYCLES = "('active','captured','dormant')";
const OPEN_SET_SQL = OPEN_SET.map((s) => `'${s}'`).join(",");
const COLOR_RANK: Record<AttentionColor, number> = { orange: 0, blue: 1, green: 2, gray: 3 };
const CALM_COLORS: ReadonlySet<AttentionColor> = new Set(["green", "gray"]);

/** active binding 条件(合同 §5.2 / A-新3):phase authorized|bound + 未被 supersede */
const ACTIVE_BINDING =
  "ab.phase IN ('authorized','bound') AND ab.superseded_by_binding_id IS NULL";

function ensureAttentionIndex(db: Db): void {
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_obligations_attention ON focus_obligations(owner, status, needs, updated_at)`
  );
}

/** 从 pending payload 精确提取被引用的 obligation id(json_each,不做 LIKE) */
function pendingReferencedObligationIds(db: Db): Set<string> {
  const rows = db
    .prepare(
      `SELECT DISTINCT je.value AS oid
       FROM pending_confirmations pc, json_each(pc.payload_json) je
       WHERE je.key = 'obligationId'
         AND typeof(je.value) = 'text'
         AND length(je.value) > 0`
    )
    .all() as { oid: string }[];
  return new Set(rows.map((r) => r.oid));
}

/** 当前进入 attention 的 task id 集合(用于排除 mapped obligation) */
function attentionTaskIds(db: Db): Set<string> {
  const rows = db
    .prepare(
      `SELECT t.id
       FROM tasks t
       JOIN action_execution_bindings ab ON ab.task_id = t.id AND ${ACTIVE_BINDING}
       JOIN focuses f ON f.id = ab.focus_id AND f.lifecycle IN ${LIVE_LIFECYCLES}
       WHERE t.status IN ('ready_for_review','queued','running','confirmed')`
    )
    .all() as { id: string }[];
  return new Set(rows.map((r) => r.id));
}

function isMappedToAttentionTask(
  o: { action_ref: string | null; dedupe_key: string },
  taskIds: Set<string>
): boolean {
  if (o.action_ref && taskIds.has(o.action_ref)) return true;
  // dedupeKey = focusId:action:task:{taskId}:attempt:N
  const m = /:task:([^:]+):attempt:/.exec(o.dedupe_key);
  if (m && taskIds.has(m[1] as string)) return true;
  return false;
}

/** 生成全量 attention 条目(未套 ack 过滤);供 GET 与 ack 校验共用。 */
export function computeAttentionItems(db: Db): AttentionItem[] {
  ensureAttentionIndex(db);
  const nowIso = new Date().toISOString();
  const referencedObs = pendingReferencedObligationIds(db);
  const taskIdsInAttention = attentionTaskIds(db);
  const items: AttentionItem[] = [];
  const seen = new Set<string>();

  const push = (it: AttentionItem): void => {
    if (seen.has(it.id)) return;
    seen.add(it.id);
    items.push(it);
  };

  // ---- orange: pending_confirmations(focus_id NULL 不滤;有 focus 则 lifecycle 滤) ----
  {
    const rows = db
      .prepare(
        `SELECT pc.receipt_id, pc.kind, pc.prompt_text, pc.presented_at, pc.expires_at, pc.session_id, pc.focus_id,
                f.title AS focus_title, f.lifecycle
         FROM pending_confirmations pc
         LEFT JOIN focuses f ON f.id = pc.focus_id
         WHERE pc.expires_at >= ?`
      )
      .all(nowIso) as Array<{
      receipt_id: string;
      kind: string;
      prompt_text: string;
      presented_at: string;
      expires_at: string;
      session_id: string;
      focus_id: string | null;
      focus_title: string | null;
      lifecycle: string | null;
    }>;
    for (const r of rows) {
      if (r.focus_id !== null) {
        if (!r.lifecycle || !["active", "captured", "dormant"].includes(r.lifecycle)) continue;
      }
      push({
        id: `conf:${r.receipt_id}`,
        color: "orange",
        title: r.prompt_text,
        focusId: r.focus_id,
        focusTitle: r.focus_title,
        action: "open_confirm",
        updatedAt: r.presented_at,
        sessionId: r.session_id,
        expiresAt: r.expires_at,
        sourceKind: "confirmation",
        refId: r.receipt_id,
        // kind 与 CONFIRM_KINDS 同源;表外值不投(strict schema),呈现层按未知 kind 回落
        ...(isConfirmKind(r.kind) ? { confirmKind: r.kind } : {})
      });
    }
  }

  // ---- orange: tasks ready_for_review via active binding ----
  {
    const rows = db
      .prepare(
        `SELECT t.id, t.title, t.updated_at, t.project_id, ab.focus_id, f.title AS focus_title
         FROM tasks t
         JOIN action_execution_bindings ab ON ab.task_id = t.id AND ${ACTIVE_BINDING}
         JOIN focuses f ON f.id = ab.focus_id AND f.lifecycle IN ${LIVE_LIFECYCLES}
         WHERE t.status = 'ready_for_review'`
      )
      .all() as Array<{
      id: string;
      title: string;
      updated_at: string;
      project_id: string;
      focus_id: string;
      focus_title: string;
    }>;
    for (const r of rows) {
      push({
        id: `task:${r.id}`,
        color: "orange",
        title: r.title,
        focusId: r.focus_id,
        focusTitle: r.focus_title,
        action: "open_task_modal",
        updatedAt: r.updated_at,
        projectId: r.project_id,
        sourceKind: "task",
        refId: r.id
      });
    }
  }

  // ---- orange: human OPEN_SET needs IN (decision,input,unknown) ----
  {
    const rows = db
      .prepare(
        `SELECT o.id, o.title, o.updated_at, o.needs, o.focus_id, o.action_ref, o.dedupe_key,
                o.lane_id, f.title AS focus_title
         FROM focus_obligations o
         JOIN focuses f ON f.id = o.focus_id AND f.lifecycle IN ${LIVE_LIFECYCLES}
         WHERE o.owner = 'human'
           AND o.status IN (${OPEN_SET_SQL})
           AND o.needs IN ('decision','input','unknown')`
      )
      .all() as Array<{
      id: string;
      title: string;
      updated_at: string;
      needs: FocusObligationNeeds | null;
      focus_id: string;
      action_ref: string | null;
      dedupe_key: string;
      lane_id: string | null;
      focus_title: string;
    }>;
    for (const r of rows) {
      if (referencedObs.has(r.id)) continue;
      if (isMappedToAttentionTask(r, taskIdsInAttention)) continue;
      const title = r.needs === "unknown" ? `${r.title} · 待归类` : r.title;
      push({
        id: `ob:${r.id}`,
        color: "orange",
        title,
        focusId: r.focus_id,
        focusTitle: r.focus_title,
        action: "open_task_modal",
        updatedAt: r.updated_at,
        needs: r.needs,
        laneId: r.lane_id,
        sourceKind: "obligation",
        refId: r.id
      });
    }
  }

  // ---- orange: blocked 任意 owner(合同 §5.2 增补;title 前缀) ----
  {
    const rows = db
      .prepare(
        `SELECT o.id, o.title, o.updated_at, o.focus_id, o.action_ref, o.dedupe_key,
                o.lane_id, f.title AS focus_title
         FROM focus_obligations o
         JOIN focuses f ON f.id = o.focus_id AND f.lifecycle IN ${LIVE_LIFECYCLES}
         WHERE o.status = 'blocked'`
      )
      .all() as Array<{
      id: string;
      title: string;
      updated_at: string;
      focus_id: string;
      action_ref: string | null;
      dedupe_key: string;
      lane_id: string | null;
      focus_title: string;
    }>;
    for (const r of rows) {
      if (referencedObs.has(r.id)) continue;
      if (isMappedToAttentionTask(r, taskIdsInAttention)) continue;
      const prefixed = r.title.startsWith("前置已终止:") ? r.title : `前置已终止:${r.title}`;
      push({
        id: `ob:${r.id}`,
        color: "orange",
        title: prefixed,
        focusId: r.focus_id,
        focusTitle: r.focus_title,
        action: "open_task_modal",
        updatedAt: r.updated_at,
        laneId: r.lane_id,
        sourceKind: "obligation",
        refId: r.id
      });
    }
  }

  // ---- blue: human open|in_progress needs=action ----
  {
    const rows = db
      .prepare(
        `SELECT o.id, o.title, o.updated_at, o.focus_id, o.action_ref, o.dedupe_key,
                o.lane_id, f.title AS focus_title
         FROM focus_obligations o
         JOIN focuses f ON f.id = o.focus_id AND f.lifecycle IN ${LIVE_LIFECYCLES}
         WHERE o.owner = 'human'
           AND o.status IN ('open','in_progress')
           AND o.needs = 'action'`
      )
      .all() as Array<{
      id: string;
      title: string;
      updated_at: string;
      focus_id: string;
      action_ref: string | null;
      dedupe_key: string;
      lane_id: string | null;
      focus_title: string;
    }>;
    for (const r of rows) {
      if (referencedObs.has(r.id)) continue;
      if (isMappedToAttentionTask(r, taskIdsInAttention)) continue;
      push({
        id: `ob:${r.id}`,
        color: "blue",
        title: r.title,
        focusId: r.focus_id,
        focusTitle: r.focus_title,
        action: "open_task_modal",
        updatedAt: r.updated_at,
        needs: "action",
        laneId: r.lane_id,
        sourceKind: "obligation",
        refId: r.id
      });
    }
  }

  // ---- green: tasks queued|running|confirmed via binding ----
  {
    const rows = db
      .prepare(
        `SELECT t.id, t.title, t.updated_at, t.project_id, ab.focus_id, f.title AS focus_title
         FROM tasks t
         JOIN action_execution_bindings ab ON ab.task_id = t.id AND ${ACTIVE_BINDING}
         JOIN focuses f ON f.id = ab.focus_id AND f.lifecycle IN ${LIVE_LIFECYCLES}
         WHERE t.status IN ('queued','running','confirmed')`
      )
      .all() as Array<{
      id: string;
      title: string;
      updated_at: string;
      project_id: string;
      focus_id: string;
      focus_title: string;
    }>;
    for (const r of rows) {
      push({
        id: `task:${r.id}`,
        color: "green",
        title: r.title,
        focusId: r.focus_id,
        focusTitle: r.focus_title,
        action: "open_task_modal",
        updatedAt: r.updated_at,
        projectId: r.project_id,
        sourceKind: "task",
        refId: r.id
      });
    }
  }

  // ---- green: agent OPEN_SET ----
  {
    const rows = db
      .prepare(
        `SELECT o.id, o.title, o.updated_at, o.focus_id, o.action_ref, o.dedupe_key,
                o.lane_id, f.title AS focus_title
         FROM focus_obligations o
         JOIN focuses f ON f.id = o.focus_id AND f.lifecycle IN ${LIVE_LIFECYCLES}
         WHERE o.owner = 'agent'
           AND o.status IN (${OPEN_SET_SQL})`
      )
      .all() as Array<{
      id: string;
      title: string;
      updated_at: string;
      focus_id: string;
      action_ref: string | null;
      dedupe_key: string;
      lane_id: string | null;
      focus_title: string;
    }>;
    for (const r of rows) {
      if (referencedObs.has(r.id)) continue;
      if (isMappedToAttentionTask(r, taskIdsInAttention)) continue;
      push({
        id: `ob:${r.id}`,
        color: "green",
        title: r.title,
        focusId: r.focus_id,
        focusTitle: r.focus_title,
        action: "open_task_modal",
        updatedAt: r.updated_at,
        laneId: r.lane_id,
        sourceKind: "obligation",
        refId: r.id
      });
    }
  }

  // ---- gray: external OPEN_SET ----
  {
    const rows = db
      .prepare(
        `SELECT o.id, o.title, o.updated_at, o.focus_id, o.action_ref, o.dedupe_key,
                o.lane_id, f.title AS focus_title
         FROM focus_obligations o
         JOIN focuses f ON f.id = o.focus_id AND f.lifecycle IN ${LIVE_LIFECYCLES}
         WHERE o.owner = 'external'
           AND o.status IN (${OPEN_SET_SQL})`
      )
      .all() as Array<{
      id: string;
      title: string;
      updated_at: string;
      focus_id: string;
      action_ref: string | null;
      dedupe_key: string;
      lane_id: string | null;
      focus_title: string;
    }>;
    for (const r of rows) {
      if (referencedObs.has(r.id)) continue;
      if (isMappedToAttentionTask(r, taskIdsInAttention)) continue;
      push({
        id: `ob:${r.id}`,
        color: "gray",
        title: r.title,
        focusId: r.focus_id,
        focusTitle: r.focus_title,
        action: "open_focus",
        updatedAt: r.updated_at,
        laneId: r.lane_id,
        sourceKind: "obligation",
        refId: r.id
      });
    }
  }

  // 排序=色序(orange→blue→green→gray);橙区内 unknown 尾标排尾;同组时间倒序
  items.sort((a, b) => {
    const cr = COLOR_RANK[a.color] - COLOR_RANK[b.color];
    if (cr !== 0) return cr;
    if (a.color === "orange") {
      const aUnk = a.needs === "unknown" || a.title.endsWith("· 待归类") ? 1 : 0;
      const bUnk = b.needs === "unknown" || b.title.endsWith("· 待归类") ? 1 : 0;
      if (aUnk !== bUnk) return aUnk - bUnk;
    }
    return a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0;
  });

  return items;
}

function loadAckMap(db: Db, itemIds: string[]): Map<string, string> {
  const map = new Map<string, string>();
  if (itemIds.length === 0) return map;
  const placeholders = itemIds.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT item_id, acked_at FROM attention_acks WHERE item_id IN (${placeholders})`)
    .all(...itemIds) as Array<{ item_id: string; acked_at: string }>;
  for (const r of rows) map.set(r.item_id, r.acked_at);
  return map;
}

/**
 * GET /api/attention —— 补 ackedAt;过滤规则:
 * 仅当前颜色为 green/gray 且存在 ack 记录的条目被过滤;
 * 橙/蓝无论是否有历史 ack 必须返回(颜色升级自动重现)。
 */
export function getAttention(db: Db): { items: AttentionItem[] } {
  const raw = computeAttentionItems(db);
  const acks = loadAckMap(
    db,
    raw.map((i) => i.id)
  );
  const items: AttentionItem[] = [];
  for (const it of raw) {
    const ackedAt = acks.get(it.id);
    if (ackedAt && CALM_COLORS.has(it.color)) continue;
    items.push(ackedAt ? { ...it, ackedAt } : it);
  }
  return { items };
}

export type AckAttentionResult =
  | { ok: true }
  | { ok: false; code: "not_calm" | "not_found" };

/**
 * 对 attention 条目写 ack。重新执行生成查询找当前颜色:
 * 仅 green/gray 接受并 upsert acked_at;橙/蓝返回 not_calm;不在集合中返回 not_found。
 */
export function ackAttention(db: Db, itemId: string): AckAttentionResult {
  const id = itemId.trim();
  if (!id) return { ok: false, code: "not_found" };

  const items = computeAttentionItems(db);
  const hit = items.find((i) => i.id === id);
  if (!hit) return { ok: false, code: "not_found" };
  if (!CALM_COLORS.has(hit.color)) return { ok: false, code: "not_calm" };

  const nowIso = new Date().toISOString();
  db.prepare(
    `INSERT INTO attention_acks(item_id, acked_at) VALUES (?, ?)
     ON CONFLICT(item_id) DO UPDATE SET acked_at = excluded.acked_at`
  ).run(id, nowIso);
  return { ok: true };
}

/** HTTP 层:POST /api/attention/:id/ack —— 对 path 段做 decodeURIComponent(含 conf:/ob:/task:)。 */
export function ackAttentionApi(
  db: Db,
  rawPathId: string
): { status: number; payload: { ok: true } | { error: "not_calm" } | { error: "not_found" } } {
  let itemId: string;
  try {
    itemId = decodeURIComponent(rawPathId);
  } catch {
    return { status: 404, payload: { error: "not_found" } };
  }
  const r = ackAttention(db, itemId);
  if (r.ok) return { status: 200, payload: { ok: true } };
  if (r.code === "not_calm") return { status: 409, payload: { error: "not_calm" } };
  return { status: 404, payload: { error: "not_found" } };
}
