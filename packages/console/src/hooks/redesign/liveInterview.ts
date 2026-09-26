// 09 §15.2:采访身份 = sessionId + 原 turnId + 问题原文。投影还要本页 focus
// 与已提交 focus-anchor 的 requestId 代次一致。只从 live assistant 转写投影。
// HTTP 不是采访权威;readiness/dispatch 确认卡不是采访。无印章的旧句不投影。

import type { InterviewAnchorCommit, InterviewRoundLease } from "../../voice/interviewAnchor";

export type LiveInterviewSpoken = {
  text: string;
  turnId?: string;
  sentenceId?: string;
  seq?: number;
  interviewFocusId?: string;
  interviewAnchorRequestId?: string;
  interviewAnchorGeneration?: number;
};

export type LiveInterviewCard = {
  kind?: string;
  text?: string;
} | null;

export type ProjectedInterview = {
  question: string;
  options: string[];
  recommended?: string;
  sessionId: string;
  turnId: string;
  focusId: string;
  anchorRequestId: string;
  anchorGeneration: number;
};

const CONFIRM_KIND = new Set(["dispatch", "runtime_effect", "readiness", "memory"]);
const STATUS_OR_CONFIRM = /要不要开始|拍板|确认这些|执行和检查|这些事实对不对|先记进记忆|记下了/;

export function isInterviewQuestion(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (!/[?？]/.test(t)) return false;
  if (STATUS_OR_CONFIRM.test(t)) return false;
  return true;
}

export function extractInterviewOptions(text: string): string[] {
  const numbered = [...text.matchAll(/(?:^|\n)\s*(?:\d+[.)、]|[A-Da-d][.)、])\s*([^\n]+)/g)].map((m) =>
    (m[1] ?? "").replace(/[。．.]+$/, "").trim()
  ).filter(Boolean);
  if (numbered.length >= 2) return numbered.slice(0, 5);
  const quoted = [...text.matchAll(/「([^」]{1,40})」/g)].map((m) => (m[1] ?? "").trim()).filter(Boolean);
  if (quoted.length >= 2) return quoted.slice(0, 5);
  return [];
}

function extractRecommended(text: string, options: string[]): string | undefined {
  for (const option of options) {
    const idx = text.indexOf(option);
    if (idx < 0) continue;
    const around = text.slice(Math.max(0, idx - 8), idx + option.length + 8);
    if (/建议|推荐/.test(around)) return option;
  }
  return undefined;
}

function lastSpoken(spoken: readonly LiveInterviewSpoken[]): LiveInterviewSpoken | undefined {
  if (spoken.length === 0) return undefined;
  return spoken.reduce((best, cur) => {
    const b = best.seq ?? -1;
    const c = cur.seq ?? -1;
    return c >= b ? cur : best;
  });
}

function ownedByCommit(
  row: LiveInterviewSpoken,
  committed: InterviewAnchorCommit,
  rounds: readonly InterviewRoundLease[]
): boolean {
  if (!row.turnId) return false;
  const lease = rounds.find((item) => item.turnId === row.turnId);
  if (!lease) return false;
  return (
    lease.focusId === committed.focusId &&
    lease.requestId === committed.requestId &&
    lease.generation === committed.generation &&
    row.interviewFocusId === lease.focusId &&
    row.interviewAnchorRequestId === lease.requestId &&
    row.interviewAnchorGeneration === lease.generation
  );
}

export function projectLiveInterview(input: {
  pageFocusId: string;
  sessionOwned: boolean;
  sessionId?: string | null;
  spoken: readonly LiveInterviewSpoken[];
  rounds?: readonly InterviewRoundLease[];
  confirmCard?: LiveInterviewCard;
  committed?: InterviewAnchorCommit | null;
}): ProjectedInterview | undefined {
  if (!input.sessionOwned || !input.sessionId || !input.pageFocusId) return undefined;
  const committed = input.committed ?? null;
  if (!committed || committed.sessionId !== input.sessionId || committed.focusId !== input.pageFocusId) {
    return undefined;
  }
  if (input.confirmCard?.kind && CONFIRM_KIND.has(input.confirmCard.kind)) return undefined;
  const rounds = input.rounds ?? [];
  const last = lastSpoken(input.spoken.filter((row) => ownedByCommit(row, committed, rounds)));
  if (!last?.text || !last.turnId || !isInterviewQuestion(last.text)) return undefined;
  const options = extractInterviewOptions(last.text);
  const recommended = extractRecommended(last.text, options);
  return {
    question: last.text.trim(),
    options,
    ...(recommended ? { recommended } : {}),
    sessionId: input.sessionId,
    turnId: last.turnId,
    focusId: committed.focusId,
    anchorRequestId: committed.requestId,
    anchorGeneration: committed.generation
  };
}
