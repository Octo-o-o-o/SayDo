// DAO:artifacts / context_snapshots / cost_entries / readiness_assessments / events_cursor
// + SQLite 审计 sink(E3 主 sink,0.3 起替换 0.1 的文件形态)。

import type { Artifact } from "@saydo/contracts";
import { artifactSchema, newId } from "@saydo/contracts";
import type { AuditEvent, AuditSink } from "../../obs/audit.js";
import type { Db } from "../db.js";

export function insertArtifact(db: Db, a: Artifact): void {
  artifactSchema.parse(a);
  db.prepare(
    `INSERT INTO artifacts(id, version, project_id, type, path, digest, supersedes_json, tags_json, source, created_at)
     VALUES (@id, @version, @projectId, @type, @path, @digest, @supersedesJson, @tagsJson, @source, @createdAt)`
  ).run({
    id: a.id,
    version: a.version,
    projectId: a.projectId,
    type: a.type,
    path: a.path,
    digest: a.digest,
    supersedesJson: a.supersedes ? JSON.stringify(a.supersedes) : null,
    tagsJson: JSON.stringify(a.tags),
    source: a.source,
    createdAt: a.createdAt
  });
}

export function getArtifact(db: Db, id: string, version: number): Artifact | null {
  const row = db.prepare("SELECT * FROM artifacts WHERE id = ? AND version = ?").get(id, version) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  return artifactSchema.parse({
    id: row["id"],
    projectId: row["project_id"],
    version: row["version"],
    type: row["type"],
    path: row["path"],
    digest: row["digest"],
    ...(row["supersedes_json"] ? { supersedes: JSON.parse(row["supersedes_json"] as string) } : {}),
    tags: JSON.parse(row["tags_json"] as string),
    source: row["source"],
    createdAt: row["created_at"]
  });
}

// M1/A-6 拆表(2026-07-25):内容表幂等 upsert + 使用记录表——委托 dao/snapshots.ts 单实现(不再双写)。
export { recordContextSnapshotUse as insertContextSnapshot, getContextSnapshot } from "./snapshots.js";

export interface CostEntry {
  id: string;
  ts: string;
  projectId?: string | undefined;
  taskId?: string | undefined;
  sessionId?: string | undefined;
  kind: string;
  amount?: number | undefined;
  currency?: string | undefined;
  known: 0 | 1;
  source: "api" | "subscription";
  meta?: Record<string, unknown> | undefined;
}

export function insertCostEntry(db: Db, e: CostEntry): void {
  db.prepare(
    `INSERT INTO cost_entries(id, ts, project_id, task_id, session_id, kind, amount, currency, known, source, meta_json)
     VALUES (@id, @ts, @projectId, @taskId, @sessionId, @kind, @amount, @currency, @known, @source, @metaJson)`
  ).run({
    id: e.id,
    ts: e.ts,
    projectId: e.projectId ?? null,
    taskId: e.taskId ?? null,
    sessionId: e.sessionId ?? null,
    kind: e.kind,
    amount: e.amount ?? null,
    currency: e.currency ?? null,
    known: e.known,
    source: e.source,
    metaJson: e.meta ? JSON.stringify(e.meta) : null
  });
}

/** SQLite 审计 sink(E3;审计不可变,只 INSERT 无 UPDATE/DELETE 路径) */
export function createSqliteAuditSink(db: Db, now: () => Date = () => new Date()): AuditSink {
  const stmt = db.prepare(
    "INSERT INTO audit_log(id, ts, actor, action, ref_digest, meta_json) VALUES (@id, @ts, @actor, @action, @refDigest, @metaJson)"
  );
  return {
    record(event: AuditEvent) {
      const id = newId("aud");
      stmt.run({
        id,
        ts: now().toISOString(),
        actor: event.actor,
        action: event.action,
        refDigest: event.refDigest ?? null,
        metaJson: event.meta ? JSON.stringify(event.meta) : null
      });
      return { id };
    }
  };
}
