import { apiGet } from "./api";

const RECENT_TRANSCRIPT_ENDPOINT = "/api/sessions/recent-transcript";

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

export async function loadRecentTranscript(limit = 40): Promise<RecentTranscriptPayload> {
  const raw = await apiGet<RecentTranscriptPayload>(
    `${RECENT_TRANSCRIPT_ENDPOINT}?limit=${encodeURIComponent(String(limit))}`
  );
  return {
    sessionId: raw.sessionId ?? null,
    projectId: raw.projectId ?? null,
    turns: Array.isArray(raw.turns) ? raw.turns : []
  };
}
