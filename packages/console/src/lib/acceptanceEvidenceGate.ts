// coding 验收呈现与批准按钮共用:无引用的人工/自报 unknown 仍待 owner 判断。
// 已经写上 evidenceRef 但解析失败,不得再当成未绑定的待判项。

export type AcceptanceEvidenceRow = {
  evidenceRef: string;
  ok: boolean;
  reason?: string;
};

const RESOLUTION_FAILURES = new Set([
  "not_found",
  "digest_mismatch",
  "cross_run",
  "unauthorized",
  "invalid_ref",
  "missing_ref"
]);

export function judgeAcceptanceCheck(
  check: { source: string; status: string; evidenceRef?: string } | undefined,
  resolved: { ok: boolean; reason?: string } | undefined
): { status: "pass" | "fail" | "unknown"; boundInvalid: boolean } {
  if (!check) return { status: "unknown", boundInvalid: false };
  const legal = check.source === "verify" || check.source === "agent_claim" || check.source === "manual";
  if (!legal) return { status: "unknown", boundInvalid: false };
  const ref = typeof check.evidenceRef === "string" ? check.evidenceRef.trim() : "";
  const humanPending = (check.source === "manual" || check.source === "agent_claim") && check.status === "unknown";
  const resolutionFailed =
    resolved !== undefined &&
    resolved.ok !== true &&
    (resolved.reason === undefined || RESOLUTION_FAILURES.has(resolved.reason));
  if (humanPending && !ref) return { status: "unknown", boundInvalid: false };
  if (humanPending && resolutionFailed) return { status: "unknown", boundInvalid: true };
  if (humanPending) return { status: "unknown", boundInvalid: false };
  if (resolutionFailed && (check.status === "pass" || check.status === "fail")) {
    return { status: "fail", boundInvalid: true };
  }
  if (check.status === "unknown") return { status: "unknown", boundInvalid: false };
  if ((check.status === "pass" || check.status === "fail") && ref) {
    return { status: check.status, boundInvalid: false };
  }
  return { status: "unknown", boundInvalid: false };
}

export function acceptanceApprovalBlocked(
  checks: Array<{ source: string; status: string; evidenceRef?: string; criterion?: string }>,
  evidence: readonly AcceptanceEvidenceRow[]
): boolean {
  return checks.some((check) => {
    const ref = check.evidenceRef?.trim() ?? "";
    if (!ref) return false;
    const row = evidence.find((item) => item.evidenceRef === check.evidenceRef || item.evidenceRef === ref);
    return judgeAcceptanceCheck(check, row).boundInvalid;
  });
}
