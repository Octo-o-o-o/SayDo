// DAO:approvals(docs/09 §3 <-> §9;合法组合矩阵由 DDL CHECK + 写入前 zod 双层把守)。
// W4(09 §3.3):s3 判别域六列(S3MergeReceipt 承载;非 S3 行恒 NULL,双向 CHECK 库层强制)。

import type { ApprovalReceipt } from "@saydo/contracts";
import { approvalReceiptSchema } from "@saydo/contracts";
import type { Db } from "../db.js";

export function insertApproval(db: Db, r: ApprovalReceipt): void {
  approvalReceiptSchema.parse(r); // 写入校验层(矩阵违规在此报人话;DDL CHECK 是最后防线)
  db.prepare(
    `INSERT INTO approvals(id, kind, ref_digest, parent_package_digest, effect, grant_digest, task_id, session_id, turn_ref,
       risk, principal, decided_via, auth_strength, decision, nonce, outcome, issued_at, expires_at, decided_at, consumed_at,
       s3_challenge_id, credential_id, assertion_digest, attempt, package_revision, prospective_tree_sha)
     VALUES (@id, @kind, @refDigest, @parentPackageDigest, @effect, @grantDigest, @taskId, @sessionId, @turnRef,
       @risk, @principal, @decidedVia, @authStrength, @decision, @nonce, @outcome, @issuedAt, @expiresAt, @decidedAt, @consumedAt,
       @s3ChallengeId, @s3CredentialId, @s3AssertionDigest, @s3Attempt, @s3PackageRevision, @s3ProspectiveTreeSha)`
  ).run({
    id: r.id,
    kind: r.kind,
    refDigest: r.refDigest,
    parentPackageDigest: r.parentPackageDigest ?? null,
    effect: r.effectGrantRef?.effect ?? null,
    grantDigest: r.effectGrantRef?.grantDigest ?? null,
    taskId: r.taskId ?? null,
    sessionId: r.sessionId ?? null,
    turnRef: r.turnRef ?? null,
    risk: r.riskLevel,
    principal: r.principal,
    decidedVia: r.decidedVia,
    authStrength: r.authStrength,
    decision: r.decision ?? null,
    nonce: r.nonce,
    outcome: r.outcome,
    issuedAt: r.issuedAt,
    expiresAt: r.expiresAt,
    decidedAt: r.decidedAt ?? null,
    consumedAt: r.consumedAt ?? null,
    s3ChallengeId: r.s3?.challengeId ?? null,
    s3CredentialId: r.s3?.credentialId ?? null,
    s3AssertionDigest: r.s3?.assertionDigest ?? null,
    s3Attempt: r.s3?.attempt ?? null,
    s3PackageRevision: r.s3?.packageRevision ?? null,
    s3ProspectiveTreeSha: r.s3?.prospectiveTreeSha ?? null
  });
}

export function getApproval(db: Db, id: string): ApprovalReceipt | null {
  const row = db.prepare("SELECT * FROM approvals WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return approvalReceiptSchema.parse({
    id: row["id"],
    kind: row["kind"],
    refDigest: row["ref_digest"],
    ...(row["parent_package_digest"] ? { parentPackageDigest: row["parent_package_digest"] } : {}),
    ...(row["effect"] && row["grant_digest"]
      ? { effectGrantRef: { effect: row["effect"], grantDigest: row["grant_digest"] } }
      : {}),
    ...(row["task_id"] ? { taskId: row["task_id"] } : {}),
    ...(row["session_id"] ? { sessionId: row["session_id"] } : {}),
    ...(row["turn_ref"] ? { turnRef: row["turn_ref"] } : {}),
    riskLevel: row["risk"],
    principal: row["principal"],
    decidedVia: row["decided_via"],
    authStrength: row["auth_strength"],
    ...(row["decision"] ? { decision: row["decision"] } : {}),
    nonce: row["nonce"],
    issuedAt: row["issued_at"],
    expiresAt: row["expires_at"],
    ...(row["decided_at"] ? { decidedAt: row["decided_at"] } : {}),
    outcome: row["outcome"],
    ...(row["consumed_at"] ? { consumedAt: row["consumed_at"] } : {}),
    ...(row["s3_challenge_id"]
      ? {
          s3: {
            challengeId: row["s3_challenge_id"],
            credentialId: row["credential_id"],
            assertionDigest: row["assertion_digest"],
            attempt: row["attempt"],
            packageRevision: row["package_revision"],
            prospectiveTreeSha: row["prospective_tree_sha"]
          }
        }
      : {})
  }) as ApprovalReceipt;
}
