import { apiGet } from "../lib/api";
import {
  attentionResponseSchema,
  mobileFocusDetailSchema,
  mobileFocusListItemSchema,
  type MobileFocusDetail
} from "@saydo/contracts";
import type { AttentionItem, FocusDetailPayload, FocusRow } from "./types";

export const MOBILE_ATTENTION_ENDPOINT = "/api/attention";
export const MOBILE_FOCUSES_ENDPOINT = "/api/focuses";
export const MOBILE_RECENT_TRANSCRIPT_ENDPOINT = "/api/sessions/recent-transcript";
export const MOBILE_RECENT_MEMORY_ENDPOINT = "/api/memory/recent";

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

/** 桌面 Memory.tsx 同源只读投影字段子集(+ recent 端点的 ts 兜底)。 */
export type MobileMemoryRow = {
  id: string;
  tier: string;
  claim: string;
  trust: string;
  source: { kind: string; ref?: string };
  expiresAt?: string | null;
  ts?: string | null;
};

export async function loadMobileToday(): Promise<{ items: AttentionItem[] }> {
  return attentionResponseSchema.parse(await apiGet<unknown>(MOBILE_ATTENTION_ENDPOINT));
}

export async function loadMobileFocuses(): Promise<FocusRow[]> {
  return mobileFocusListItemSchema.array().parse(await apiGet<unknown>(MOBILE_FOCUSES_ENDPOINT));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function projectMobileEvent(raw: unknown, obligations?: Array<{ id?: string; laneId?: string }>): unknown {
  const event = asRecord(raw);
  if (!event) return raw;
  const source = asRecord(event["payload"]) ?? {};
  const payload: Record<string, unknown> = {};
  if (typeof source["title"] === "string") payload["title"] = source["title"];
  if (typeof source["revision"] === "number" || typeof source["revision"] === "string") {
    payload["revision"] = source["revision"];
  }
  if (typeof source["obligationId"] === "string") payload["obligationId"] = source["obligationId"];
  else if (typeof source["depId"] === "string") payload["obligationId"] = source["depId"];
  if (typeof source["laneId"] === "string") payload["laneId"] = source["laneId"];
  else if (typeof payload["obligationId"] === "string" && obligations) {
    const ob = obligations.find((o) => o.id === payload["obligationId"]);
    if (ob?.laneId) payload["laneId"] = ob.laneId;
  }
  return {
    id: event["id"],
    seq: event["seq"],
    type: event["type"],
    payload,
    actorKind: event["actorKind"],
    createdAt: event["createdAt"]
  };
}

/** daemon GET /api/focuses/:id 含 events.sessionId 与 repos/artifacts;移动 DTO 只收投影后再校验。 */
export function projectDaemonFocusToMobile(raw: unknown): unknown {
  if (raw === null || raw === undefined) return raw;
  const rec = asRecord(raw);
  if (!rec) return raw;
  return {
    focus: rec["focus"],
    obligations: rec["obligations"],
    lanes: rec["lanes"],
    events: Array.isArray(rec["events"])
      ? rec["events"].map((event) =>
          projectMobileEvent(
            event,
            Array.isArray(rec["obligations"])
              ? (rec["obligations"] as Array<{ id?: string; laneId?: string }>)
              : undefined
          )
        )
      : rec["events"]
  };
}

export function parseMobileFocusDetail(raw: unknown): MobileFocusDetail | null {
  const parsed = mobileFocusDetailSchema.nullable().safeParse(projectDaemonFocusToMobile(raw));
  if (!parsed.success) {
    throw new Error("这件事的账本格式对不上,暂时读不了");
  }
  return parsed.data;
}

export async function loadMobileFocus(focusId: string): Promise<FocusDetailPayload | null> {
  return parseMobileFocusDetail(await apiGet<unknown>(`${MOBILE_FOCUSES_ENDPOINT}/${encodeURIComponent(focusId)}`));
}

/** DAILY-01:跨 Focus 义务清单(移动安排页;桌面同一读口,宽松透传) */
export async function loadMobileObligations(): Promise<unknown[]> {
  const raw = await apiGet<unknown>("/api/obligations");
  return Array.isArray(raw) ? raw : [];
}

export async function loadRecentTranscript(limit = 40): Promise<RecentTranscriptPayload> {
  const raw = await apiGet<RecentTranscriptPayload>(
    `${MOBILE_RECENT_TRANSCRIPT_ENDPOINT}?limit=${encodeURIComponent(String(limit))}`
  );
  return {
    sessionId: raw.sessionId ?? null,
    projectId: raw.projectId ?? null,
    turns: Array.isArray(raw.turns) ? raw.turns : []
  };
}

export function mobileMemoryPath(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/memory`;
}

function parseMemoryRow(row: unknown): MobileMemoryRow | null {
  const r = row as Record<string, unknown>;
  const source = (r["source"] ?? {}) as Record<string, unknown>;
  const id = String(r["id"] ?? "");
  const claim = String(r["claim"] ?? "");
  if (id === "" || claim === "") return null;
  return {
    id,
    tier: String(r["tier"] ?? ""),
    claim,
    trust: String(r["trust"] ?? ""),
    source: {
      kind: String(source["kind"] ?? "import"),
      ...(typeof source["ref"] === "string" ? { ref: source["ref"] } : {})
    },
    expiresAt: (r["expiresAt"] as string | null | undefined) ?? null,
    ts: typeof r["ts"] === "string" ? r["ts"] : null
  };
}

export async function loadProjectMemory(projectId: string): Promise<MobileMemoryRow[]> {
  const raw = await apiGet<unknown[]>(mobileMemoryPath(projectId));
  if (!Array.isArray(raw)) return [];
  return raw.map(parseMemoryRow).filter((row): row is MobileMemoryRow => row !== null);
}

/** 全局最近记忆(含 M2 空 project);一次请求,按服务端 ts 倒序。 */
export async function loadRecentMemories(limit = 30): Promise<MobileMemoryRow[]> {
  const raw = await apiGet<unknown[]>(
    `${MOBILE_RECENT_MEMORY_ENDPOINT}?limit=${encodeURIComponent(String(limit))}`
  );
  if (!Array.isArray(raw)) return [];
  return raw.map(parseMemoryRow).filter((row): row is MobileMemoryRow => row !== null);
}
