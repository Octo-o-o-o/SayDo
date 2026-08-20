// source_snapshots / claim_snapshot_links DAO(09 §4.1/§9)。
// 快照不可变:只 insert 与 delete(遗忘传播),禁 UPDATE。

import type { SourceSnapshot } from "@saydo/contracts";
import { sourceSnapshotSchema } from "@saydo/contracts";
import type { Db } from "../db.js";

export function insertSourceSnapshot(db: Db, s: SourceSnapshot): void {
  sourceSnapshotSchema.parse(s);
  db.prepare(
    `INSERT INTO source_snapshots(id, source_json, snapshot_locator, live_locator, content_digest, body_path, captured_at, resolver_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    s.id,
    JSON.stringify(s.source),
    s.snapshotLocator,
    s.liveLocator,
    s.contentDigest,
    s.bodyPath,
    s.capturedAt,
    s.resolver.version
  );
}

export function getSourceSnapshot(db: Db, id: string): SourceSnapshot | undefined {
  const row = db.prepare("SELECT * FROM source_snapshots WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return undefined;
  return sourceSnapshotSchema.parse({
    id: row["id"],
    source: JSON.parse(row["source_json"] as string),
    snapshotLocator: row["snapshot_locator"],
    liveLocator: row["live_locator"],
    contentDigest: row["content_digest"],
    encoding: "utf-8",
    bodyPath: row["body_path"],
    capturedAt: row["captured_at"],
    resolver: { name: "daemon-snapshotter", version: row["resolver_version"] as string }
  });
}

export function deleteSourceSnapshotRow(db: Db, id: string): void {
  db.prepare("DELETE FROM source_snapshots WHERE id = ?").run(id);
}

export function insertClaimSnapshotLink(
  db: Db,
  link: { projectId?: string; memoryEventId: string; claimDigest: string; snapshotId: string; createdAt: string }
): void {
  db.prepare(
    `INSERT OR IGNORE INTO claim_snapshot_links(project_id, memory_event_id, claim_digest, snapshot_id, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(link.projectId ?? null, link.memoryEventId, link.claimDigest, link.snapshotId, link.createdAt);
}

export function snapshotIdsByMemoryEvents(db: Db, memoryEventIds: string[]): string[] {
  if (memoryEventIds.length === 0) return [];
  const rows = db
    .prepare(
      `SELECT DISTINCT snapshot_id FROM claim_snapshot_links WHERE memory_event_id IN (${memoryEventIds.map(() => "?").join(",")})`
    )
    .all(...memoryEventIds) as { snapshot_id: string }[];
  return rows.map((r) => r.snapshot_id);
}

export function deleteLinksByMemoryEvents(db: Db, memoryEventIds: string[]): void {
  if (memoryEventIds.length === 0) return;
  db.prepare(
    `DELETE FROM claim_snapshot_links WHERE memory_event_id IN (${memoryEventIds.map(() => "?").join(",")})`
  ).run(...memoryEventIds);
}

export function countLinksBySnapshot(db: Db, snapshotId: string): number {
  const row = db.prepare("SELECT COUNT(*) AS c FROM claim_snapshot_links WHERE snapshot_id = ?").get(snapshotId) as {
    c: number;
  };
  return row.c;
}
