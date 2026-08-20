// context_snapshots DAO(09 §9;M1/A-6 拆表 2026-07-25):
// 内容表(pack_digest PK,幂等 upsert——同 digest 二次落盘不报错、审计不断链)+
// context_snapshot_uses 使用记录表(哪个会话何时用了哪个 pack;重建 digest 一致验收在此)。
// 拆表解决"PK=pack_digest 与重建 digest 一致验收冲突"(裸 INSERT 报错=恢复失败,OR REPLACE=审计断链)。

import type { ContextSnapshot } from "@saydo/contracts";
import { contextSnapshotSchema } from "@saydo/contracts";
import type { Db } from "../db.js";

/** 落盘一次快照使用:内容表幂等 upsert(同 digest 不重复)+ 使用记录追加一行(rebuild 标重建首轮) */
export function recordContextSnapshotUse(
  db: Db,
  snap: ContextSnapshot,
  usedAt: string,
  opts: { rebuild?: boolean } = {}
): void {
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT OR IGNORE INTO context_snapshots(pack_digest, compiler_version, body_json, created_at)
       VALUES (?, ?, ?, ?)`
    ).run(snap.packDigest, snap.compilerVersion, JSON.stringify(snap), usedAt);
    // 使用记录不去重(评审 B6:同毫秒重用也各记一行,审计计数如实)
    db.prepare(
      `INSERT INTO context_snapshot_uses(session_id, pack_digest, used_at, rebuild)
       VALUES (?, ?, ?, ?)`
    ).run(snap.sessionId, snap.packDigest, usedAt, opts.rebuild ? 1 : 0);
  });
  tx();
}

export function getContextSnapshot(db: Db, packDigest: string): ContextSnapshot | undefined {
  const row = db.prepare("SELECT body_json FROM context_snapshots WHERE pack_digest = ?").get(packDigest) as
    | { body_json: string }
    | undefined;
  if (!row) return undefined;
  return contextSnapshotSchema.parse(JSON.parse(row.body_json));
}

/** 该会话用过的 pack 列表(审计:重建 digest 一致 = 同会话多行同 pack_digest) */
export function listSnapshotUses(db: Db, sessionId: string): { packDigest: string; usedAt: string; rebuild: boolean }[] {
  const rows = db
    .prepare("SELECT pack_digest, used_at, rebuild FROM context_snapshot_uses WHERE session_id = ? ORDER BY used_at")
    .all(sessionId) as { pack_digest: string; used_at: string; rebuild: number }[];
  return rows.map((r) => ({ packDigest: r.pack_digest, usedAt: r.used_at, rebuild: r.rebuild === 1 }));
}
