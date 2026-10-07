// coding 验收呈现与批准按钮共用:无引用的人工/自报 unknown 仍待 owner 判断。
// 已经写上 evidenceRef 但解析失败,不得再当成未绑定的待判项。

export type AcceptanceEvidenceRow = {
  evidenceRef: string;
  ok: boolean;
  reason?: string;
};

export function judgeAcceptanceCheck(
  check: { source: string; status: string; evidenceRef?: string } | undefined,
  resolved: { ok: boolean; reason?: string } | undefined
): { status: "pass" | "fail" | "unknown"; boundInvalid: boolean } {
  if (!check) return { status: "unknown", boundInvalid: false };
  const legal = check.source === "verify" || check.source === "agent_claim" || check.source === "manual";
  if (!legal) return { status: "unknown", boundInvalid: false };
  const ref = typeof check.evidenceRef === "string" ? check.evidenceRef.trim() : "";
  if (ref && resolved?.ok !== true) return { status: "unknown", boundInvalid: true };
  if ((check.status === "pass" || check.status === "fail") && ref) {
    return { status: check.status, boundInvalid: false };
  }
  return { status: "unknown", boundInvalid: false };
}

/** 当前执行冲突是全局门，不随空验收集或无引用的人工项消失。 */
export function latestAcceptanceRunConflicts(
  runs: readonly { attempt?: unknown; evidence_conflict?: unknown }[]
): boolean {
  const latest = runs.reduce((max, run) => Math.max(max, Number(run.attempt) || 0), 0);
  return runs.some(run => (Number(run.attempt) || 0) === latest && run.evidence_conflict === true);
}

export function acceptanceApprovalBlocked(
  checks: Array<{ source: string; status: string; evidenceRef?: string; criterion?: string }>,
  evidence: readonly AcceptanceEvidenceRow[],
  runs: readonly { attempt?: unknown; evidence_conflict?: unknown }[] = []
): boolean {
  if (latestAcceptanceRunConflicts(runs)) return true;
  return checks.some((check) => {
    const ref = check.evidenceRef?.trim() ?? "";
    if (!ref) return false;
    const row = evidence.find((item) => item.evidenceRef === check.evidenceRef || item.evidenceRef === ref);
    return judgeAcceptanceCheck(check, row).boundInvalid;
  });
}
