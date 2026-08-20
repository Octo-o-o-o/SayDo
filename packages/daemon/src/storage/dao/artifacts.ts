// artifacts DAO(09 §8/§9:PRIMARY KEY(id, version);version+supersedes 链是方案演进史真相)。
// 写入主体 = daemon 内部(A6 计划落盘/C6 摘要),不经 Brain 工具(modules/b B4)。

import type { Artifact } from "@saydo/contracts";
import { artifactSchema } from "@saydo/contracts";
import type { Db } from "../db.js";

export function insertArtifact(db: Db, a: Artifact): void {
  artifactSchema.parse(a);
  if (a.supersedes) {
    const prev = db
      .prepare("SELECT 1 FROM artifacts WHERE id = ? AND version = ?")
      .get(a.supersedes.artifactId, a.supersedes.version);
    if (!prev) {
      throw new Error(`supersedes target not found: ${a.supersedes.artifactId} v${a.supersedes.version}`);
    }
  }
  db.prepare(
    `INSERT INTO artifacts(id, version, project_id, type, path, digest, supersedes_json, tags_json, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    a.id,
    a.version,
    a.projectId,
    a.type,
    a.path,
    a.digest,
    a.supersedes ? JSON.stringify(a.supersedes) : null,
    JSON.stringify(a.tags),
    a.source,
    a.createdAt
  );
}

export function getArtifact(db: Db, id: string, version: number): Artifact | undefined {
  const row = db.prepare("SELECT * FROM artifacts WHERE id = ? AND version = ?").get(id, version) as
    | Record<string, unknown>
    | undefined;
  if (!row) return undefined;
  return rowToArtifact(row);
}

export function latestArtifactVersion(db: Db, id: string): number {
  const row = db.prepare("SELECT MAX(version) AS v FROM artifacts WHERE id = ?").get(id) as { v: number | null };
  return row.v ?? 0;
}

/** 版本链(演进史):沿 supersedes 从给定版本回溯到根(含自身,新到旧) */
export function artifactLineage(db: Db, id: string, version: number): Artifact[] {
  const chain: Artifact[] = [];
  let cur = getArtifact(db, id, version);
  while (cur) {
    chain.push(cur);
    if (!cur.supersedes) break;
    cur = getArtifact(db, cur.supersedes.artifactId, cur.supersedes.version);
  }
  return chain;
}

function rowToArtifact(row: Record<string, unknown>): Artifact {
  return artifactSchema.parse({
    id: row["id"],
    version: row["version"],
    projectId: row["project_id"],
    type: row["type"],
    path: row["path"],
    digest: row["digest"],
    ...(row["supersedes_json"] ? { supersedes: JSON.parse(row["supersedes_json"] as string) } : {}),
    tags: JSON.parse(row["tags_json"] as string),
    source: row["source"],
    createdAt: row["created_at"]
  });
}
