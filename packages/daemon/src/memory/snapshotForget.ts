// 遗忘传播:源快照 + 评估记录明文段(09 §4.1 hard-forget 闭合;Phase 3 评审 A-1/A-3 回修)。
// 删序纪律(A-3):links 是唯一枚举键,必须最后删——
//   ① 枚举应清快照;② 对"排除本批引用后零引用"的快照先 rm 正文(幂等);③ 同一事务内删行 + 删本批 links。
//   崩溃于任意相位,重放按 targets 重枚举均收敛(正文 rm 幂等、行/links 删除幂等)。
// 评估记录覆写(A-1):按 tombstone targetDigests(= claim 的 textDigest)定位
//   readiness_assessments 的 dims_json/blocking_criticals_json/source_verifications_json 对应明文段
//   覆写 [forgotten],并删除 prompt_body_path 文件(prompt 含 claim 全文,无法部分覆写——遗忘优先于 replay,如实)。

import { existsSync, rmSync } from "node:fs";
import { textDigest, type Claim, type ClaimSourceVerification } from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import {
  countLinksBySnapshot,
  deleteLinksByMemoryEvents,
  deleteSourceSnapshotRow,
  getSourceSnapshot,
  snapshotIdsByMemoryEvents
} from "../storage/dao/sourceSnapshots.js";

function countLinksExcludingEvents(db: Db, snapshotId: string, excludeEventIds: string[]): number {
  if (excludeEventIds.length === 0) return countLinksBySnapshot(db, snapshotId);
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM claim_snapshot_links WHERE snapshot_id = ?
       AND memory_event_id NOT IN (${excludeEventIds.map(() => "?").join(",")})`
    )
    .get(snapshotId, ...excludeEventIds) as { c: number };
  return row.c;
}

export function makeSnapshotForgetStore(db: Db): (targetIds: string[], targetDigests?: string[]) => void {
  return (targetIds: string[], targetDigests: string[] = []) => {
    // ① 枚举(links 未删,崩溃重放仍可枚举)
    const snapshotIds = snapshotIdsByMemoryEvents(db, targetIds);
    const orphaned = snapshotIds.filter((sid) => countLinksExcludingEvents(db, sid, targetIds) === 0);
    // ② 先删正文(幂等;此刻 links/行还在,任意相位崩溃后重放可收敛)
    for (const sid of orphaned) {
      const snap = getSourceSnapshot(db, sid);
      if (snap && existsSync(snap.bodyPath)) rmSync(snap.bodyPath, { force: true });
    }
    // ③ 事务内删行 + 删本批 links(最后删枚举键)
    db.transaction(() => {
      for (const sid of orphaned) deleteSourceSnapshotRow(db, sid);
      deleteLinksByMemoryEvents(db, targetIds);
    })();
    // ④ 评估记录明文段覆写(A-1;targetDigests = tombstone 的 claim textDigest 集)
    if (targetDigests.length > 0) redactAssessments(db, new Set(targetDigests));
  };
}

/** 按 claimDigest 覆写 readiness_assessments 内明文段 + 删 prompt 正文文件(幂等) */
function redactAssessments(db: Db, digests: Set<string>): void {
  const rows = db
    .prepare("SELECT id, dims_json, blocking_criticals_json, source_verifications_json, prompt_body_path FROM readiness_assessments")
    .all() as {
    id: string;
    dims_json: string | null;
    blocking_criticals_json: string | null;
    source_verifications_json: string | null;
    prompt_body_path: string | null;
  }[];
  const upd = db.prepare(
    "UPDATE readiness_assessments SET dims_json = ?, blocking_criticals_json = ?, source_verifications_json = ? WHERE id = ?"
  );
  for (const row of rows) {
    let touched = false;

    let dims: Claim[] = [];
    if (row.dims_json) {
      dims = (JSON.parse(row.dims_json) as Claim[]).map((c) => {
        if (digests.has(textDigest(c.text))) {
          touched = true;
          return { ...c, text: "[forgotten]", source: { kind: "import" as const, ref: "[forgotten]" } };
        }
        return c;
      });
    }

    let blocking: string[] = [];
    if (row.blocking_criticals_json) {
      blocking = (JSON.parse(row.blocking_criticals_json) as string[]).map((t) => {
        if (digests.has(textDigest(t))) {
          touched = true;
          return "[forgotten]";
        }
        return t;
      });
    }

    let verifications: (ClaimSourceVerification & { sourceKind?: string })[] = [];
    if (row.source_verifications_json) {
      verifications = (JSON.parse(row.source_verifications_json) as (ClaimSourceVerification & { sourceKind?: string })[]).map(
        (v) => {
          if (digests.has(v.claimDigest) && v.excerpt) {
            touched = true;
            return { ...v, excerpt: { ...v.excerpt, text: "[forgotten]" } };
          }
          return v;
        }
      );
    }

    if (!touched) continue;
    upd.run(
      row.dims_json ? JSON.stringify(dims) : null,
      row.blocking_criticals_json ? JSON.stringify(blocking) : null,
      row.source_verifications_json ? JSON.stringify(verifications) : null,
      row.id
    );
    // prompt 正文含 claim 全文,无法部分覆写(digest 会断)——删除文件,prompt_digest 保留作审计痕
    if (row.prompt_body_path) rmSync(row.prompt_body_path, { force: true });
  }
}
