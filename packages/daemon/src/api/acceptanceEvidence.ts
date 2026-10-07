// 验收页 evidenceRef 受控解析:只读本任务本 run 的 verify.json / 树内 blob / 本任务审计。
// 禁止跨 run、任意本机路径、广义文件浏览;缺证诚实返回,不编 run 元数据。

import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { join, sep } from "node:path";
import { acceptanceExactSetViolations, jcsDigest, textDigest, verifyPackageDigest, writingSettleProofSchema, type AcceptanceCheck } from "@saydo/contracts";
import { getPackage } from "../storage/dao/packages.js";
import { hasTier1TerminalConflict } from "../tier1/terminalEvidence.js";
import type { Db } from "../storage/db.js";

const MAX_BODY_CHARS = 16_384;
const MAX_FILE_BYTES = 256 * 1024;

export type AcceptanceEvidenceKind = "log" | "diff";

export type ResolvedAcceptanceEvidence =
  | { evidenceRef: string; ok: true; kind: AcceptanceEvidenceKind; body: string }
  | {
      evidenceRef: string;
      ok: false;
      reason: "missing_ref" | "not_found" | "digest_mismatch" | "cross_run" | "unauthorized" | "invalid_ref";
    };

export interface AcceptanceEvidenceScope {
  taskId: string;
  runId: string;
  treeSha: string;
  worktreePath?: string | null;
  runsDir?: string;
  proofVerifyDigest?: string;
}

const VERIFY_RE = /^verify:(?:sha256:)?([0-9a-f]{64})$/i;
const AUDIT_RE = /^audit:([a-z]{2,4}_[0-9A-HJKMNP-TV-Z]{26})$/;
const TREE_RE = /^tree:([0-9a-f]{40}):(.+)$/;
const DIFF_RE = /^diff:([0-9a-f]{40}):(.+)$/;

function sanitizeEvidenceBody(text: string): string {
  const pk = "PRIV" + "ATE " + "KEY";
  let out = text;
  out = out.replace(new RegExp(`-----BEGIN [A-Z ]*${pk}-----[\\s\\S]*?-----END [A-Z ]*${pk}-----`, "g"), "[redacted]");
  out = out.replace(/\bBearer\s+[A-Za-z0-9._-]{8,}/g, "[redacted]");
  out = out.replace(new RegExp("\\b(?:sk|gho|ghp|ghs|ghr|xoxb|xoxp)[-_][A-Za-z0-9]{16,}\\b", "g"), "[redacted]");
  out = out.replace(new RegExp("\\b(?:A" + "KIA|A" + "SIA)[0-9A-Z]{16}\\b", "g"), "[redacted]");
  out = out.replace(/\benv:[A-Z][A-Z0-9_]*\b/g, "[secret]");
  out = out.replace(/(?:~\/|\/(?:Users|home|var|tmp|etc|opt|private)\/|[A-Za-z]:\\)[^\s，。;；、"']*/g, "[path]");
  return out.length > MAX_BODY_CHARS ? `${out.slice(0, MAX_BODY_CHARS)}\n…` : out;
}

function safeRelPath(raw: string): string | null {
  const p = raw.trim();
  if (!p || p.length > 200) return null;
  if (p.startsWith("/") || p.includes("\\") || p.includes("\0")) return null;
  if (p.split("/").some((part) => part === "" || part === "." || part === ".." || part === ".git")) return null;
  if (!/^[A-Za-z0-9._/-]+$/.test(p)) return null;
  return p;
}

type ScopedRead = { ok: true; text: string } | { ok: false; reason: "not_found" | "unauthorized" };

/** 只沿 root 下的普通路径分量读文件。分量或祖先目录是 symlink、或 realpath 逸出 root,都拒绝。 */
function readScopedRegularFile(root: string, segments: readonly string[]): ScopedRead {
  if (!root || segments.length === 0) return { ok: false, reason: "not_found" };
  let rootReal: string;
  try {
    if (lstatSync(root).isSymbolicLink()) return { ok: false, reason: "unauthorized" };
    rootReal = realpathSync(root);
  } catch {
    return { ok: false, reason: "not_found" };
  }
  let current = rootReal;
  for (const segment of segments) {
    if (
      !segment ||
      segment === "." ||
      segment === ".." ||
      segment.includes("/") ||
      segment.includes("\\") ||
      segment.includes("\0")
    ) {
      return { ok: false, reason: "unauthorized" };
    }
    const next = join(current, segment);
    let st: ReturnType<typeof lstatSync>;
    try {
      st = lstatSync(next);
    } catch {
      return { ok: false, reason: "not_found" };
    }
    if (st.isSymbolicLink()) return { ok: false, reason: "unauthorized" };
    current = next;
  }
  try {
    const st = lstatSync(current);
    if (st.isSymbolicLink()) return { ok: false, reason: "unauthorized" };
    if (!st.isFile()) return { ok: false, reason: "not_found" };
    if (st.size > MAX_FILE_BYTES) return { ok: false, reason: "unauthorized" };
    const real = realpathSync(current);
    const prefix = rootReal.endsWith(sep) ? rootReal : rootReal + sep;
    if (!real.startsWith(prefix)) return { ok: false, reason: "unauthorized" };
    return { ok: true, text: readFileSync(current, "utf8") };
  } catch {
    return { ok: false, reason: "not_found" };
  }
}

/** 只取裁决关联字段。没有这些字段时不把 action 名称当成已解析日志。 */
function auditVerdictLines(meta: Record<string, unknown>): string[] {
  const lines: string[] = [];
  if (meta["kind"] === "writing" || meta["kind"] === "coding") lines.push(`kind ${String(meta["kind"])}`);
  if (typeof meta["acceptancePassed"] === "number" && Number.isInteger(meta["acceptancePassed"]) && meta["acceptancePassed"] >= 0) {
    lines.push(`acceptancePassed ${meta["acceptancePassed"]}`);
  }
  if (typeof meta["evidenceDigest"] === "string" && /^sha256:[0-9a-f]{64}$/.test(meta["evidenceDigest"])) {
    lines.push(`evidenceDigest ${meta["evidenceDigest"]}`);
  }
  if (typeof meta["attempt"] === "number" && Number.isInteger(meta["attempt"]) && meta["attempt"] > 0) {
    lines.push(`attempt ${meta["attempt"]}`);
  }
  if (Array.isArray(meta["verdicts"])) {
    for (const row of meta["verdicts"]) {
      if (!row || typeof row !== "object") continue;
      const criterion = (row as { criterion?: unknown }).criterion;
      const status = (row as { status?: unknown }).status;
      if (typeof criterion !== "string" || criterion.length === 0 || criterion.length > 200) continue;
      if (status !== "pass" && status !== "fail") continue;
      lines.push(`verdict ${status} ${criterion}`);
    }
  }
  if (typeof meta["exitEvidence"] === "string" && meta["exitEvidence"].trim()) {
    lines.push(`exit ${meta["exitEvidence"]}`);
  }
  return lines;
}

function normalizeVerifyDigest(refHex: string, payload: string): boolean {
  const actual = textDigest(payload);
  const want = refHex.toLowerCase();
  return actual === `sha256:${want}` || actual.slice(7) === want;
}

function readTreeBlob(cwd: string, treeSha: string, relPath: string): string | null {
  try {
    const listing = execFileSync("git", ["ls-tree", "-z", treeSha, "--", relPath], {
      cwd,
      encoding: null,
      maxBuffer: 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const nul = listing.indexOf(0);
    if (nul < 0 || nul !== listing.length - 1) return null;
    const tab = listing.indexOf(0x09);
    if (tab < 0 || tab >= nul) return null;
    const meta = listing.subarray(0, tab).toString("ascii");
    const match = /^(100644|100755) blob ([0-9a-f]{40,64})$/u.exec(meta);
    if (!match) return null;
    const pathBytes = listing.subarray(tab + 1, nul);
    if (!pathBytes.equals(Buffer.from(relPath, "utf8"))) return null;
    const bytes = execFileSync("git", ["cat-file", "blob", match[2] as string], {
      cwd,
      encoding: null,
      maxBuffer: MAX_FILE_BYTES + 1,
      stdio: ["ignore", "pipe", "pipe"]
    });
    if (bytes.length > MAX_FILE_BYTES) return null;
    const text = bytes.toString("utf8");
    if (!Buffer.from(text, "utf8").equals(bytes)) return null;
    return text;
  } catch {
    return null;
  }
}

function readTreeDiff(cwd: string, treeSha: string, relPath: string): string | null {
  const after = readTreeBlob(cwd, treeSha, relPath);
  if (after === null) return null;
  let before = "";
  try {
    before = execFileSync("git", ["show", `HEAD:${relPath}`], {
      cwd,
      encoding: "utf8",
      maxBuffer: MAX_FILE_BYTES,
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch {
    before = "";
  }
  return [
    `--- a/${relPath}`,
    `+++ b/${relPath}`,
    "<<< before",
    before.trimEnd(),
    ">>> after",
    after.trimEnd()
  ].join("\n");
}

/** 旧 writing 审计无 runId 时仅凭完整当前 proof/JCS/包/批准态合取恢复绑定。 */
export function isWritingApprovalForRun(
  db: Db,
  row: { actor: string; action: string; meta_json: string },
  scope: AcceptanceEvidenceScope
): boolean {
  try {
    if (row.actor !== "owner" || row.action !== "task.review_approve") return false;
    const meta = JSON.parse(row.meta_json) as Record<string, unknown>;
    if (Object.hasOwn(meta, "runId") && meta["runId"] !== scope.runId) return false;
    const run = db.prepare("SELECT attempt, tree_sha, settle_proof_json FROM tier1_runs WHERE id=? AND task_id=?")
      .get(scope.runId, scope.taskId) as { attempt: number; tree_sha: string; settle_proof_json: string } | undefined;
    const task = db.prepare("SELECT status, project_id, package_id, package_rev, package_digest, approved_tree_sha FROM tasks WHERE id=?")
      .get(scope.taskId) as { status: string; project_id: string; package_id: string; package_rev: number; package_digest: string; approved_tree_sha: string } | undefined;
    if (!run || !task || !["review_approved_waiting_merge", "merging", "task_done"].includes(task.status)) return false;
    const proof = writingSettleProofSchema.parse(JSON.parse(run.settle_proof_json));
    if (proof.taskId !== scope.taskId || proof.runId !== scope.runId || proof.attempt !== run.attempt ||
        proof.treeSha !== scope.treeSha || run.tree_sha !== scope.treeSha || task.approved_tree_sha !== scope.treeSha ||
        proof.packageRevision !== task.package_rev) return false;
    const pkg = getPackage(db, task.package_id, task.package_rev);
    if (!pkg || pkg.projectId !== task.project_id || pkg.digest !== task.package_digest || verifyPackageDigest(pkg) !== null ||
        acceptanceExactSetViolations(proof.acceptanceChecks, pkg.acceptance).length !== 0) return false;
    const manual = proof.acceptanceChecks.filter(check => check.source === "manual");
    if (meta["taskId"] !== scope.taskId || meta["kind"] !== "writing" || meta["evidenceDigest"] !== jcsDigest(proof) ||
        meta["prospectiveTreeSha"] !== scope.treeSha || meta["attempt"] !== run.attempt || meta["acceptancePassed"] !== manual.length ||
        !Array.isArray(meta["verdicts"])) return false;
    const verdicts = meta["verdicts"] as { criterion?: unknown; status?: unknown }[];
    return verdicts.length === manual.length && new Set(verdicts.map(v => v.criterion)).size === manual.length &&
      verdicts.every(v => v.status === "pass" && manual.some(c => c.criterion === v.criterion));
  } catch {
    return false;
  }
}

export function resolveAcceptanceEvidence(
  db: Db,
  ref: string,
  scope: AcceptanceEvidenceScope
): ResolvedAcceptanceEvidence {
  const evidenceRef = ref.trim();
  if (!evidenceRef) return { evidenceRef: ref, ok: false, reason: "missing_ref" };

  const owner = db
    .prepare("SELECT id, task_id, tree_sha, attempt, state FROM tier1_runs WHERE id=? AND task_id=?")
    .get(scope.runId, scope.taskId) as { id: string; task_id: string; tree_sha: string | null; attempt: number; state: string } | undefined;
  if (!owner) return { evidenceRef, ok: false, reason: "cross_run" };
  if ((owner.tree_sha ?? "") !== scope.treeSha) return { evidenceRef, ok: false, reason: "digest_mismatch" };
  if (hasTier1TerminalConflict(db, scope.taskId, scope.runId, owner.state)) {
    return { evidenceRef, ok: false, reason: "cross_run" };
  }

  const verifyHit = VERIFY_RE.exec(evidenceRef);
  if (verifyHit) {
    if (!scope.runsDir) return { evidenceRef, ok: false, reason: "not_found" };
    const scoped = readScopedRegularFile(scope.runsDir, [scope.runId, "verify.json"]);
    if (!scoped.ok) return { evidenceRef, ok: false, reason: scoped.reason };
    const payload = scoped.text;
    if (!normalizeVerifyDigest(verifyHit[1] as string, payload)) {
      return { evidenceRef, ok: false, reason: "digest_mismatch" };
    }
    if (scope.proofVerifyDigest && scope.proofVerifyDigest !== textDigest(payload)) {
      return { evidenceRef, ok: false, reason: "digest_mismatch" };
    }
    return { evidenceRef, ok: true, kind: "log", body: sanitizeEvidenceBody(payload) };
  }

  const auditHit = AUDIT_RE.exec(evidenceRef);
  if (auditHit) {
    const row = db
      .prepare(
        `SELECT actor, action, meta_json FROM audit_log
         WHERE id=? AND json_valid(meta_json) AND json_extract(meta_json, '$.taskId')=?`
      )
      .get(auditHit[1], scope.taskId) as { actor: string; action: string; meta_json: string } | undefined;
    if (!row) return { evidenceRef, ok: false, reason: "not_found" };
    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse(row.meta_json) as Record<string, unknown>;
    } catch {
      return { evidenceRef, ok: false, reason: "not_found" };
    }
    if (Object.hasOwn(meta, "runId")) {
      if (meta["runId"] !== scope.runId) return { evidenceRef, ok: false, reason: "cross_run" };
    } else if (!isWritingApprovalForRun(db, row, scope)) {
      return { evidenceRef, ok: false, reason: "cross_run" };
    }
    if (Object.hasOwn(meta, "attempt") && meta["attempt"] !== owner.attempt) return { evidenceRef, ok: false, reason: "cross_run" };
    if (Object.hasOwn(meta, "prospectiveTreeSha") && meta["prospectiveTreeSha"] !== scope.treeSha) return { evidenceRef, ok: false, reason: "digest_mismatch" };
    const lines = auditVerdictLines(meta);
    if (lines.length === 0) return { evidenceRef, ok: false, reason: "not_found" };
    return { evidenceRef, ok: true, kind: "log", body: sanitizeEvidenceBody(lines.join("\n")) };
  }

  const treeHit = TREE_RE.exec(evidenceRef);
  if (treeHit) {
    const treeSha = treeHit[1] as string;
    const rel = safeRelPath(treeHit[2] as string);
    if (!rel) return { evidenceRef, ok: false, reason: "invalid_ref" };
    if (treeSha !== scope.treeSha) return { evidenceRef, ok: false, reason: "cross_run" };
    if (!scope.worktreePath || !existsSync(scope.worktreePath)) return { evidenceRef, ok: false, reason: "not_found" };
    const body = readTreeBlob(scope.worktreePath, treeSha, rel);
    if (body === null) return { evidenceRef, ok: false, reason: "not_found" };
    return { evidenceRef, ok: true, kind: "log", body: sanitizeEvidenceBody(body) };
  }

  const diffHit = DIFF_RE.exec(evidenceRef);
  if (diffHit) {
    const treeSha = diffHit[1] as string;
    const rel = safeRelPath(diffHit[2] as string);
    if (!rel) return { evidenceRef, ok: false, reason: "invalid_ref" };
    if (treeSha !== scope.treeSha) return { evidenceRef, ok: false, reason: "cross_run" };
    if (!scope.worktreePath || !existsSync(scope.worktreePath)) return { evidenceRef, ok: false, reason: "not_found" };
    const body = readTreeDiff(scope.worktreePath, treeSha, rel);
    if (body === null) return { evidenceRef, ok: false, reason: "not_found" };
    return { evidenceRef, ok: true, kind: "diff", body: sanitizeEvidenceBody(body) };
  }

  return { evidenceRef, ok: false, reason: "invalid_ref" };
}

/** 只读本 run 目录里的 verify.json。runId 不得带路径段。 */
export function readRunVerifyPayload(runsDir: string, runId: string): string | null {
  if (!runsDir || !runId || runId.length > 80) return null;
  if (/[\\/\0]|\.\./u.test(runId)) return null;
  const scoped = readScopedRegularFile(runsDir, [runId, "verify.json"]);
  return scoped.ok ? scoped.text : null;
}

/**
 * verify 门失败不等于每个 criterion 都失败;没有逐条绑定时仍为 manual/unknown。
 * evidenceRef 只提供真实 verify 诊断,不替代逐条裁决。全绿或无法解析则不投影。
 */
export function acceptanceChecksForFailedVerify(
  criteria: readonly string[],
  verifyPayload: string
): AcceptanceCheck[] | null {
  if (criteria.length === 0) return null;
  let rows: unknown;
  try {
    rows = JSON.parse(verifyPayload) as unknown;
  } catch {
    return null;
  }
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const failed = rows.some((row) => {
    if (!row || typeof row !== "object") return false;
    const code = (row as { exitCode?: unknown }).exitCode;
    return typeof code === "number" && Number.isFinite(code) && code !== 0;
  });
  if (!failed) return null;
  const evidenceRef = `verify:${textDigest(verifyPayload)}`;
  return criteria.map((criterion) => ({
    criterion,
    status: "unknown",
    source: "manual",
    evidenceRef
  }));
}

export function collectAcceptanceEvidence(
  db: Db,
  refs: string[],
  scope: AcceptanceEvidenceScope | null
): ResolvedAcceptanceEvidence[] {
  const out: ResolvedAcceptanceEvidence[] = [];
  const seen = new Set<string>();
  for (const raw of refs) {
    const ref = raw.trim();
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    if (!scope) {
      out.push({ evidenceRef: ref, ok: false, reason: "not_found" });
      continue;
    }
    out.push(resolveAcceptanceEvidence(db, ref, scope));
  }
  return out;
}
