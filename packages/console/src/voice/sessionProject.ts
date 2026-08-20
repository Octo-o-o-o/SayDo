import type { PipelineMsg } from "@saydo/contracts";

export type SessionProjectMessage = Extract<PipelineMsg, { t: "session.project" }>;
export type SessionProjectReason = SessionProjectMessage["reason"];

export interface SessionProjectState {
  projectId: string;
  projectRevision: number;
  reason: SessionProjectReason;
}

export function reduceSessionProject(
  current: SessionProjectState | null,
  message: SessionProjectMessage,
  sessionId: string
): SessionProjectState | null {
  if (message.sessionId !== sessionId) return current;
  const { projectRevision, projectId, reason } = message;
  if (current && projectRevision <= current.projectRevision) return current;
  return { projectId, projectRevision, reason };
}

export function sessionProjectRoute(event: SessionProjectState): string {
  return `/p/${event.projectId}/chat`;
}
