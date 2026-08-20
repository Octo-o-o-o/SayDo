// DAO:webauthn_credentials / s3_challenges(docs/09 §3.3 <-> §9;W4 v9)。
// 纪律:单活跃凭据由部分唯一索引库层强制(bootstrap 一次性);challenge 单次消费 = CAS 置 consumed_at。

import type { S3Challenge, WebauthnCredential } from "@saydo/contracts";
import { s3ChallengeSchema, webauthnCredentialSchema } from "@saydo/contracts";
import type { Db } from "../db.js";

// ---------- webauthn_credentials ----------

export function insertWebauthnCredential(db: Db, c: WebauthnCredential): void {
  webauthnCredentialSchema.parse(c);
  db.prepare(
    `INSERT INTO webauthn_credentials(id, credential_id, public_key_cose, sign_count, principal, rp_id,
       backup_eligible, backup_state, status, created_at, last_used_at, revoked_at)
     VALUES (@id, @credentialId, @publicKeyCose, @signCount, @principal, @rpId,
       @backupEligible, @backupState, @status, @createdAt, @lastUsedAt, @revokedAt)`
  ).run({
    id: c.id,
    credentialId: c.credentialId,
    publicKeyCose: c.publicKeyCose,
    signCount: c.signCount,
    principal: c.principal,
    rpId: c.rpId,
    backupEligible: c.backupEligible === undefined ? null : c.backupEligible ? 1 : 0,
    backupState: c.backupState === undefined ? null : c.backupState ? 1 : 0,
    status: c.status,
    createdAt: c.createdAt,
    lastUsedAt: c.lastUsedAt ?? null,
    revokedAt: c.revokedAt ?? null
  });
}

function rowToCredential(row: Record<string, unknown>): WebauthnCredential {
  return webauthnCredentialSchema.parse({
    id: row["id"],
    credentialId: row["credential_id"],
    publicKeyCose: row["public_key_cose"],
    signCount: row["sign_count"],
    principal: row["principal"],
    rpId: row["rp_id"],
    ...(row["backup_eligible"] !== null ? { backupEligible: row["backup_eligible"] === 1 } : {}),
    ...(row["backup_state"] !== null ? { backupState: row["backup_state"] === 1 } : {}),
    status: row["status"],
    createdAt: row["created_at"],
    ...(row["last_used_at"] ? { lastUsedAt: row["last_used_at"] } : {}),
    ...(row["revoked_at"] ? { revokedAt: row["revoked_at"] } : {})
  });
}

/** P0 单用户:principal='owner' 的唯一 active 行(库层部分唯一索引保证至多一行) */
export function getActiveCredential(db: Db): WebauthnCredential | null {
  const row = db
    .prepare("SELECT * FROM webauthn_credentials WHERE principal='owner' AND status='active' LIMIT 1")
    .get() as Record<string, unknown> | undefined;
  return row ? rowToCredential(row) : null;
}

/** 断言使用后更新:signCount + last_used_at + 本次断言携带的 BE/BS(诚实条款:每次断言落账) */
export function touchCredentialOnAssert(
  db: Db,
  id: string,
  patch: { signCount: number; backupEligible?: boolean; backupState?: boolean },
  nowIso: string
): void {
  db.prepare(
    `UPDATE webauthn_credentials SET sign_count=@signCount, last_used_at=@now,
       backup_eligible=COALESCE(@be, backup_eligible), backup_state=COALESCE(@bs, backup_state)
     WHERE id=@id`
  ).run({
    id,
    signCount: patch.signCount,
    now: nowIso,
    be: patch.backupEligible === undefined ? null : patch.backupEligible ? 1 : 0,
    bs: patch.backupState === undefined ? null : patch.backupState ? 1 : 0
  });
}

/** owner 显式 revoke(换凭据 = revoke 旧行后重走注册,无静默 rotation) */
export function revokeCredential(db: Db, id: string, nowIso: string): boolean {
  const r = db
    .prepare("UPDATE webauthn_credentials SET status='revoked', revoked_at=? WHERE id=? AND status='active'")
    .run(nowIso, id);
  return r.changes === 1;
}

// ---------- s3_challenges ----------

export function insertS3Challenge(db: Db, c: S3Challenge): void {
  s3ChallengeSchema.parse(c);
  db.prepare(
    `INSERT INTO s3_challenges(id, challenge, action, ref_digest, prospective_tree_sha, task_id, project_id,
       attempt, package_revision, session_id, bootstrap_intent_id, expires_at, consumed_at, created_at)
     VALUES (@id, @challenge, @action, @refDigest, @prospectiveTreeSha, @taskId, @projectId,
       @attempt, @packageRevision, @sessionId, @bootstrapIntentId, @expiresAt, @consumedAt, @createdAt)`
  ).run({
    id: c.id,
    challenge: c.challenge,
    action: c.action,
    refDigest: c.refDigest,
    prospectiveTreeSha: c.prospectiveTreeSha ?? null,
    taskId: c.taskId ?? null,
    projectId: c.projectId ?? null,
    attempt: c.attempt ?? null,
    packageRevision: c.packageRevision ?? null,
    sessionId: c.sessionId ?? null,
    bootstrapIntentId: c.bootstrapIntentId ?? null,
    expiresAt: c.expiresAt,
    consumedAt: c.consumedAt ?? null,
    createdAt: c.createdAt
  });
}

export function getS3Challenge(db: Db, id: string): S3Challenge | null {
  const row = db.prepare("SELECT * FROM s3_challenges WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return s3ChallengeSchema.parse({
    id: row["id"],
    challenge: row["challenge"],
    action: row["action"],
    refDigest: row["ref_digest"],
    ...(row["prospective_tree_sha"] ? { prospectiveTreeSha: row["prospective_tree_sha"] } : {}),
    ...(row["task_id"] ? { taskId: row["task_id"] } : {}),
    ...(row["project_id"] ? { projectId: row["project_id"] } : {}),
    ...(row["attempt"] != null ? { attempt: row["attempt"] } : {}),
    ...(row["package_revision"] != null ? { packageRevision: row["package_revision"] } : {}),
    ...(row["session_id"] ? { sessionId: row["session_id"] } : {}),
    ...(row["bootstrap_intent_id"] ? { bootstrapIntentId: row["bootstrap_intent_id"] } : {}),
    expiresAt: row["expires_at"],
    ...(row["consumed_at"] ? { consumedAt: row["consumed_at"] } : {}),
    createdAt: row["created_at"]
  });
}

/**
 * 单次消费 CAS(09 §3.3 防重放):未消费 ∧ 未过期才置 consumed_at;changes≠1 ⇒ 拒
 * (已消费/过期/并发双消费恰一成功)。调用方在同一事务内执行(签发链原子性)。
 */
export function consumeS3ChallengeCas(db: Db, id: string, nowIso: string): boolean {
  const r = db
    .prepare("UPDATE s3_challenges SET consumed_at=? WHERE id=? AND consumed_at IS NULL AND expires_at > ?")
    .run(nowIso, id, nowIso);
  return r.changes === 1;
}
