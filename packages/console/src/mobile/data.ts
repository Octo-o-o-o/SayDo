import { apiGet } from "../lib/api";
import { attentionResponseSchema, mobileFocusDetailSchema, mobileFocusListItemSchema } from "@saydo/contracts";
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

export async function loadMobileFocus(focusId: string): Promise<FocusDetailPayload | null> {
  return mobileFocusDetailSchema.nullable().parse(
    await apiGet<unknown>(`${MOBILE_FOCUSES_ENDPOINT}/${encodeURIComponent(focusId)}`)
  );
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
