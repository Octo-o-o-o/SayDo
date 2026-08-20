// GET /api/sessions/recent-transcript —— 最近会话转写尾 N 轮(移动回放用)。
// 读法对齐 firstRun.ts:142:按 sessions.transcript_path 逐行 JSON.parse,坏行跳过不伪造。

import { existsSync, readFileSync } from "node:fs";
import type { Db } from "../storage/db.js";

export type RecentTranscriptTurn = {
  speaker: string;
  text: string;
  origin?: string;
  turnId?: string;
  ts?: string;
};

export type RecentTranscriptPayload = {
  sessionId: string | null;
  projectId: string | null;
  turns: RecentTranscriptTurn[];
};

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 200;

export function parseRecentTranscriptLimit(raw: string | null): number {
  if (raw === null || raw === "") return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  const floor = Math.floor(n);
  if (floor < 1) return 1;
  if (floor > MAX_LIMIT) return MAX_LIMIT;
  return floor;
}

/** talking 优先,否则 started_at 最新;投影 speaker/text/origin(+turnId/ts 供前端去重)。 */
export function getRecentTranscript(db: Db, limit = DEFAULT_LIMIT): RecentTranscriptPayload {
  const capped = parseRecentTranscriptLimit(String(limit));
  const row = db
    .prepare(
      `SELECT id, project_id, transcript_path
       FROM sessions
       ORDER BY CASE WHEN state = 'talking' THEN 0 ELSE 1 END, started_at DESC
       LIMIT 1`
    )
    .get() as { id: string; project_id: string; transcript_path: string } | undefined;

  if (!row) return { sessionId: null, projectId: null, turns: [] };

  const turns: RecentTranscriptTurn[] = [];
  if (existsSync(row.transcript_path)) {
    try {
      for (const line of readFileSync(row.transcript_path, "utf8").split("\n")) {
        if (!line.trim()) continue;
        try {
          const turn = JSON.parse(line) as {
            speaker?: unknown;
            text?: unknown;
            origin?: unknown;
            turnId?: unknown;
            ts?: unknown;
          };
          if (typeof turn.speaker !== "string" || typeof turn.text !== "string") continue;
          const item: RecentTranscriptTurn = { speaker: turn.speaker, text: turn.text };
          if (typeof turn.origin === "string") item.origin = turn.origin;
          if (typeof turn.turnId === "string") item.turnId = turn.turnId;
          if (typeof turn.ts === "string") item.ts = turn.ts;
          turns.push(item);
        } catch {
          // 坏行跳过,不伪造
        }
      }
    } catch {
      // 转写不可读:如实空列表
    }
  }

  return {
    sessionId: row.id,
    projectId: row.project_id,
    turns: turns.slice(-capped)
  };
}
