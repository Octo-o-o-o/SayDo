// GET /api/focuses/:id/timeline + GET /api/focuses/:fid/activations/:aid/transcript
// 批次③a 读模型:focus_events 单源投影(docs/09 §15 / v3 R4 / v4 F5)。
// 本批不做 ws 增量推送(timeline_appended 留接线批后补)。
// 严禁写 live/brain/focus 写路径;只读 storage + session 元数据/转写文件。

import { existsSync, readFileSync } from "node:fs";
import {
  focusEventTypeSchema,
  focusTimelineItemRefsSchema,
  transcriptTurnSchema,
  type FocusEventType,
  type FocusTimelineItem,
  type FocusTimelineItemRefs,
  type FocusTranscriptTurn
} from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import { getSession } from "../storage/dao/projects.js";

export interface ApiResponse {
  status: number;
  payload: unknown;
}

function err(status: number, code: string, message: string, retryable = false): ApiResponse {
  return { status, payload: { ok: false, code, message, retryable } };
}

interface EventRow {
  id: string;
  seq: number;
  type: string;
  payload_json: string;
  session_id: string | null;
  created_at: string;
}

function parsePayload(json: string): Record<string, unknown> {
  try {
    const v = JSON.parse(json) as unknown;
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
    return {};
  } catch {
    return {};
  }
}

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

/** 事件人话一行(P0 统一 summary;前端按 eventType 细分呈现) */
export function summarizeFocusEvent(type: string, payload: Record<string, unknown>): string {
  switch (type) {
    case "created":
      return `创建焦点「${str(payload.title)}」`;
    case "obligation_opened":
      return `开立义务「${str(payload.title)}」`;
    case "obligation_status_changed":
      return `义务状态 ${str(payload.fromStatus)} → ${str(payload.toStatus)}`;
    case "obligation_resolved": {
      const title = str(payload.title) || str(payload.obligationId);
      return `结清义务「${title}」(${str(payload.resolution)})`;
    }
    case "artifact_realized":
      return `产物落地「${str(payload.title)}」`;
    case "artifact_linked":
      return `关联产物「${str(payload.title)}」`;
    case "revision_settled":
      return `修订 r${str(payload.revision)} 落账`;
    case "lifecycle_changed":
      return `生命周期 ${str(payload.from)} → ${str(payload.to)}`;
    case "project_ref_added":
      return `关联项目 ${str(payload.projectId)}`;
    case "project_ref_removed":
      return `移除项目 ${str(payload.projectId)}`;
    case "packet_frozen":
      return `冻结续推包 r${str(payload.revision)}`;
    case "packet_confirmed":
      return `确认续推包 r${str(payload.revision)}`;
    case "binding_authorized":
      return `授权执行绑定 ${str(payload.taskId)}`;
    case "binding_ledger_bound":
      return `绑定账本 ${str(payload.bindingId)}`;
    case "authority_transfer":
      return `权威转移 ${str(payload.fromAuthority)} → ${str(payload.toAuthority)}`;
    case "close_settlement":
      return `收场结算 ${str(payload.phase)}`;
    case "correction":
      return `更正: ${str(payload.note)}`;
    case "lane_split":
      return "拆线";
    case "lane_retired":
      return `收线「${str(payload.title)}」`;
    case "redo_from":
      return `从锚点 seq=${str(payload.anchorSeq)} 重做`;
    case "dependency_set":
      return `设定依赖「${str(payload.depTitle)}」←「${str(payload.preTitle)}」`;
    case "dependency_woken":
      return `依赖唤醒「${str(payload.depTitle)}」`;
    case "dependency_blocked":
      return `依赖阻塞「${str(payload.depTitle)}」`;
    case "focus_forked":
      return `分叉自「${str(payload.sourceTitle)}」`;
    case "activation_started":
      return "会话段开始";
    case "activation_closed":
      return `会话段结束(${str(payload.status) || "closed"})`;
    default:
      return type;
  }
}

const REF_KEYS = [
  "obligationId",
  "artifactId",
  "taskId",
  "bindingId",
  "laneId",
  "projectId",
  "sessionId",
  "activationId",
  "settlementId",
  "revision",
  "sourceId",
  "newId",
  "depId",
  "preId"
] as const;

export function extractTimelineRefs(payload: Record<string, unknown>): FocusTimelineItemRefs {
  const raw: Record<string, unknown> = {};
  for (const k of REF_KEYS) {
    const v = payload[k];
    if (v === undefined) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null) {
      raw[k] = v;
    }
  }
  const parsed = focusTimelineItemRefsSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

/**
 * 读会话转写元数据(只读;不暴露 path)。
 * 文件缺失/不可读 → turnCount=0, transcriptAvailable=false(含 store_transcript=false 从未落盘)。
 * 与 SessionManager.readTurns 同形读口,不改 session/manager。
 */
function readTranscriptMeta(
  db: Db,
  sessionId: string | undefined | null
): { turnCount: number; transcriptAvailable: boolean } {
  if (!sessionId) return { turnCount: 0, transcriptAvailable: false };
  const s = getSession(db, sessionId);
  if (!s) return { turnCount: 0, transcriptAvailable: false };
  try {
    if (!existsSync(s.transcriptPath)) return { turnCount: 0, transcriptAvailable: false };
    const raw = readFileSync(s.transcriptPath, "utf8");
    const lines = raw.split("\n").filter((l) => l.trim());
    // 文件存在即视为已存(可空会话 turnCount=0);缺失才是 not_stored
    return { turnCount: lines.length, transcriptAvailable: true };
  } catch {
    return { turnCount: 0, transcriptAvailable: false };
  }
}

/** 读转写轮次;只投影 {turnId,speaker,text,ts},剥离 path 类字段 */
function readTranscriptTurnsSafe(db: Db, sessionId: string): FocusTranscriptTurn[] | null {
  const s = getSession(db, sessionId);
  if (!s) return null;
  try {
    if (!existsSync(s.transcriptPath)) return null;
    const raw = readFileSync(s.transcriptPath, "utf8");
    const turns: FocusTranscriptTurn[] = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const parsed = transcriptTurnSchema.parse(JSON.parse(line));
        // 显式白名单投影——绝不把 audioSegmentRef.path / transcriptPath 带出
        turns.push({
          turnId: parsed.turnId,
          speaker: parsed.speaker,
          text: parsed.text,
          ts: parsed.ts
        });
      } catch {
        // 坏行跳过,不伪造
      }
    }
    return turns;
  } catch {
    return null;
  }
}

/** focus 下 activation_closed 按 activationId 索引(endTs 合成) */
function loadClosedByActivation(
  db: Db,
  focusId: string
): Map<string, { createdAt: string }> {
  const rows = db
    .prepare(
      `SELECT created_at, payload_json FROM focus_events
       WHERE focus_id = ? AND type = 'activation_closed'`
    )
    .all(focusId) as Array<{ created_at: string; payload_json: string }>;
  const map = new Map<string, { createdAt: string }>();
  for (const r of rows) {
    const p = parsePayload(r.payload_json);
    const aid = typeof p.activationId === "string" ? p.activationId : null;
    if (!aid) continue;
    // 同 activation 多次 closed 取最早(正常应唯一)
    const prev = map.get(aid);
    if (!prev || r.created_at < prev.createdAt) {
      map.set(aid, { createdAt: r.created_at });
    }
  }
  return map;
}

function mapEventToItem(
  row: EventRow,
  closedByActivation: Map<string, { createdAt: string }>,
  db: Db
): FocusTimelineItem {
  const payload = parsePayload(row.payload_json);

  if (row.type === "activation_started") {
    const activationId =
      typeof payload.activationId === "string" ? payload.activationId : row.id;
    const sessionId =
      (typeof payload.sessionId === "string" ? payload.sessionId : null) ?? row.session_id;
    const closed = closedByActivation.get(activationId);
    const meta = readTranscriptMeta(db, sessionId);
    return {
      seq: row.seq,
      ts: row.created_at,
      kind: "session_segment",
      sessionRef: activationId,
      startTs: row.created_at,
      endTs: closed ? closed.createdAt : null,
      turnCount: meta.turnCount,
      transcriptAvailable: meta.transcriptAvailable
    };
  }

  // v21 后库无 type CHECK;zod 为唯一防线。未知 type 仍投影,eventType 强转供前端兜底。
  // OPEN QUESTION:脏 type 是否应过滤为 note 而非冒充 FocusEventType 枚举值。
  const eventTypeParsed = focusEventTypeSchema.safeParse(row.type);
  const eventType = (eventTypeParsed.success ? eventTypeParsed.data : row.type) as FocusEventType;
  const summary = eventTypeParsed.success
    ? summarizeFocusEvent(row.type, payload)
    : `未知事件 ${row.type}`;

  return {
    seq: row.seq,
    ts: row.created_at,
    kind: "event",
    eventType,
    summary,
    refs: extractTimelineRefs(payload)
  };
}

export interface TimelineQuery {
  cursor?: number | null;
  limit?: number;
}

/**
 * GET /api/focuses/:id/timeline?cursor=&limit=
 * - 倒序(最新在前);cursor=seq 水位向更早翻页
 * - activation_closed 不单独成项,并入 started 合成的 session_segment
 * - 默认 limit=50
 */
export function getFocusTimeline(db: Db, focusId: string, query: TimelineQuery = {}): ApiResponse {
  const focus = db.prepare("SELECT id FROM focuses WHERE id = ?").get(focusId);
  if (!focus) return err(404, "not_found", `focus ${focusId} not found`);

  const limitRaw = query.limit;
  const limit =
    limitRaw === undefined || limitRaw === null
      ? 50
      : Number.isInteger(limitRaw) && (limitRaw as number) > 0
        ? Math.min(limitRaw as number, 500)
        : -1;
  if (limit < 0) return err(400, "invalid_input", "limit must be a positive integer");

  const cursor = query.cursor ?? null;
  if (cursor !== null && (!Number.isInteger(cursor) || cursor <= 0)) {
    return err(400, "invalid_input", "cursor must be a positive integer seq");
  }

  // activation_closed 被吸收进 session_segment,主查询排除以免占 limit 位
  const rows =
    cursor === null
      ? (db
          .prepare(
            `SELECT id, seq, type, payload_json, session_id, created_at
             FROM focus_events
             WHERE focus_id = ? AND type != 'activation_closed'
             ORDER BY seq DESC
             LIMIT ?`
          )
          .all(focusId, limit) as EventRow[])
      : (db
          .prepare(
            `SELECT id, seq, type, payload_json, session_id, created_at
             FROM focus_events
             WHERE focus_id = ? AND seq < ? AND type != 'activation_closed'
             ORDER BY seq DESC
             LIMIT ?`
          )
          .all(focusId, cursor, limit) as EventRow[]);

  const closedByActivation = loadClosedByActivation(db, focusId);
  const items = rows.map((r) => mapEventToItem(r, closedByActivation, db));
  const nextCursor = items.length === limit && items.length > 0 ? items[items.length - 1]!.seq : null;

  return {
    status: 200,
    payload: { items, nextCursor }
  };
}

/**
 * GET /api/focuses/:fid/activations/:aid/transcript
 * - 校验 aid 属于 fid(不属/不存在统一 404,不泄露存在性)
 * - 文件缺失或 store_transcript=false → { available:false, reason:'not_stored' }
 * - 响应绝不含 transcript_path 或文件系统路径
 */
export function getActivationTranscript(
  db: Db,
  focusId: string,
  activationId: string
): ApiResponse {
  // 归属校验:focus_id + id 联合;focus 不存在或 aid 不属同一 404
  const act = db
    .prepare(
      `SELECT id, session_id FROM focus_activations
       WHERE id = ? AND focus_id = ?`
    )
    .get(activationId, focusId) as { id: string; session_id: string } | undefined;

  if (!act) {
    return err(404, "not_found", "not found");
  }

  const turns = readTranscriptTurnsSafe(db, act.session_id);
  if (turns === null) {
    return {
      status: 200,
      payload: { available: false as const, reason: "not_stored" as const }
    };
  }

  return {
    status: 200,
    payload: { available: true as const, turns }
  };
}
