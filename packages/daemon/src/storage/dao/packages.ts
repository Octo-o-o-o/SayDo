// DAO:decision_packages(docs/09 §2 <-> §9)。
// 纪律:status 仅表列为准(body_json 内不存 status,防双写);digest 同理只存列,回读时重组。

import type { DecisionPackage, PackageStatus } from "@saydo/contracts";
import { canTransitionPackage, decisionPackageSchema } from "@saydo/contracts";
import type { Db } from "../db.js";

export function insertPackage(db: Db, pkg: DecisionPackage): void {
  // status/digest/expiresAt/createdAt 只存列(单源;body 双写会分叉——评审 B3)。
  // proposed_at 恒 NULL at insert(draft;A6:proposed_at 唯一写点 = 转移事务,禁裸改);
  // 若插入即 proposed(测试/迁移),proposed_at 取 expiresAt|createdAt 兜底满足 CHECK。
  // RA-closeout(Codex 22 §8.3 B 级,2026-07-28):生产路径 factory 恒 draft、进入 proposed 只走
  // transitionToProposed——直插 proposed 属测试/迁移形态,生产出现即异常信号(落审计,不拦——
  // 全面收紧涉及多测试构造重造,登记后续小批;raw-DB writer 不在 threat model)。
  const { status: _status, digest: _digest, expiresAt: _expiresAt, createdAt: _createdAt, ...body } = pkg;
  const proposedAt = pkg.status === "proposed" ? (pkg.expiresAt ?? pkg.createdAt) : null;
  db.prepare(
    `INSERT INTO decision_packages(id, revision, digest, project_id, body_json, status, proposed_at, expires_at, created_at)
     VALUES (@id, @revision, @digest, @projectId, @bodyJson, @status, @proposedAt, @expiresAt, @createdAt)`
  ).run({
    id: pkg.id,
    revision: pkg.revision,
    digest: pkg.digest,
    projectId: pkg.projectId,
    bodyJson: JSON.stringify(body),
    status: pkg.status,
    proposedAt,
    expiresAt: pkg.expiresAt ?? null,
    createdAt: pkg.createdAt
  });
}

export function getPackage(db: Db, id: string, revision: number): DecisionPackage | null {
  const row = db
    .prepare("SELECT * FROM decision_packages WHERE id = ? AND revision = ?")
    .get(id, revision) as Record<string, unknown> | undefined;
  if (!row) return null;
  const body = JSON.parse(row["body_json"] as string) as Record<string, unknown>;
  return decisionPackageSchema.parse({
    ...body,
    digest: row["digest"],
    status: row["status"],
    ...(row["expires_at"] ? { expiresAt: row["expires_at"] } : {}),
    createdAt: row["created_at"]
  });
}

/** 状态推进(09 §2 转换表校验;非法转换抛错)。proposed 目标走 transitionToProposed(带 CAS + 锚) */
export function updatePackageStatus(db: Db, id: string, revision: number, to: PackageStatus): void {
  const row = db
    .prepare("SELECT status FROM decision_packages WHERE id = ? AND revision = ?")
    .get(id, revision) as { status: PackageStatus } | undefined;
  if (!row) throw new Error(`package not found: ${id} rev ${revision}`);
  if (!canTransitionPackage(row.status, to)) {
    throw new Error(`illegal package transition ${row.status} -> ${to}`);
  }
  db.prepare("UPDATE decision_packages SET status = ? WHERE id = ? AND revision = ?").run(to, id, revision);
}

/**
 * 转 proposed(Codex 21 A6;09 §2 注 ④):同事务 CAS 关旧活跃 proposed(supersede)→ 置本包 proposed
 * + proposed_at=now(不可变锚,唯一写点)+ expires_at=now+TTL。防同项目双活跃 proposed(唯一索引兜底)。
 */
export function transitionToProposed(
  db: Db,
  i: { id: string; revision: number; projectId: string; nowIso: string; ttlHours: number }
): void {
  const row = db
    .prepare("SELECT status FROM decision_packages WHERE id = ? AND revision = ?")
    .get(i.id, i.revision) as { status: PackageStatus } | undefined;
  if (!row) throw new Error(`package not found: ${i.id} rev ${i.revision}`);
  if (!canTransitionPackage(row.status, "proposed")) {
    throw new Error(`illegal package transition ${row.status} -> proposed`);
  }
  const expiresAt = new Date(Date.parse(i.nowIso) + i.ttlHours * 3_600_000).toISOString();
  const tx = db.transaction(() => {
    // CAS 关旧:同项目其他活跃 proposed → superseded(含本包旧 revision;唯一索引的机械前置)
    db.prepare(
      "UPDATE decision_packages SET status='superseded' WHERE project_id = ? AND status='proposed' AND NOT (id = ? AND revision = ?)"
    ).run(i.projectId, i.id, i.revision);
    const upd = db
      .prepare(
        "UPDATE decision_packages SET status='proposed', proposed_at=?, expires_at=? WHERE id = ? AND revision = ? AND status = ?"
      )
      .run(i.nowIso, expiresAt, i.id, i.revision, row.status);
    if (upd.changes === 0) throw new Error(`propose race: package ${i.id} left ${row.status} concurrently`);
  });
  tx();
}

/** proposed 是否到期(TTL 硬事实:proposed_at + TTL < now;A6 dispatch/approve 双闸复用) */
export function isProposedExpired(db: Db, id: string, revision: number, nowIso: string): boolean {
  const row = db
    .prepare("SELECT status, proposed_at, expires_at FROM decision_packages WHERE id = ? AND revision = ?")
    .get(id, revision) as { status: string; proposed_at: string | null; expires_at: string | null } | undefined;
  if (!row || row.status !== "proposed") return false;
  if (!row.expires_at) return false;
  return Date.parse(nowIso) > Date.parse(row.expires_at);
}

/** 调度器:扫到期 proposed → expired(幂等:只动仍 proposed 的行;重启重扫收敛) */
export function sweepExpiredProposed(db: Db, nowIso: string): string[] {
  const rows = db
    .prepare("SELECT id, revision FROM decision_packages WHERE status='proposed' AND expires_at IS NOT NULL AND expires_at <= ?")
    .all(nowIso) as { id: string; revision: number }[];
  const expired: string[] = [];
  for (const r of rows) {
    const upd = db
      .prepare("UPDATE decision_packages SET status='expired' WHERE id=? AND revision=? AND status='proposed'")
      .run(r.id, r.revision);
    if (upd.changes === 1) expired.push(`${r.id}@${r.revision}`);
  }
  return expired;
}
