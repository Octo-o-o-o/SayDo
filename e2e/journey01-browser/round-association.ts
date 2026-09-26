// 同一轮浏览器证据是否闭合:日志里的 focus、seed、identity、run、task 必须是同一次执行。

export interface JourneySeedRecord {
  runId?: string;
  focusId?: string;
  sessionId?: string;
}

export interface JourneyIdentityRecord {
  journeyRunId?: string;
  focusId?: string;
  taskId?: string;
  sessionId?: string;
}

export function focusIdsInLog(text: string): string[] {
  const found = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (/^foc_[0-9A-HJKMNP-TV-Z]{26}$/.test(trimmed)) found.add(trimmed);
  }
  return [...found];
}

export function judgeJourneyAssociation(input: {
  runId: string;
  exitCode: number;
  logText: string;
  seed: JourneySeedRecord | null;
  identity: JourneyIdentityRecord | null;
}): { associated: boolean; reason: string; logFocusIds: string[] } {
  const logFocusIds = focusIdsInLog(input.logText);
  const reasons: string[] = [];
  if (input.exitCode !== 0) reasons.push(`playwright exit ${input.exitCode}`);
  if (!input.seed?.focusId) reasons.push("缺少 seed-focus.json");
  if (!input.identity?.focusId) reasons.push("缺少 identity.focusId");
  if (input.seed?.runId !== input.runId || input.identity?.journeyRunId !== input.runId) {
    reasons.push("runId 与本轮不一致");
  }
  if (!input.identity?.taskId) reasons.push("缺少 taskId");
  if (
    logFocusIds.length !== 1 ||
    logFocusIds[0] !== input.identity?.focusId ||
    input.identity?.focusId !== input.seed?.focusId
  ) {
    reasons.push(
      `focus 不一致 log=${logFocusIds.join(",") || "none"} seed=${input.seed?.focusId ?? "none"} identity=${input.identity?.focusId ?? "none"}`
    );
  }
  if (input.seed?.sessionId && input.identity?.sessionId && input.seed.sessionId !== input.identity.sessionId) {
    reasons.push("sessionId 与 seed 不一致");
  }
  return { associated: reasons.length === 0, reason: reasons.join("; "), logFocusIds };
}
