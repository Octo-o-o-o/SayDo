// DAO:projects / sessions(docs/09 §1 <-> §9)。

import type { Project, Session } from "@saydo/contracts";
import { projectSchema, sessionSchema } from "@saydo/contracts";
import type { Db } from "../db.js";
import {
  assertNoProjectWorkspaceOverlap,
  canonicalizeWorkspace,
  revalidateWorkspaceIdentity,
  validateManagedWorkspace,
  WorkspacePolicyError
} from "../../projects/workspace.js";

export function insertProject(db: Db, p: Project): void {
  const managedPath =
    p.status !== "archived" && p.workspace.kind === "local_folder" && p.workspace.managed
      ? validateManagedWorkspace(p.id, p.workspace.path)
      : null;
  const externalIdentity =
    p.status !== "archived" && p.workspace.kind === "local_folder" && !p.workspace.managed
      ? canonicalizeWorkspace(p.workspace.path)
      : null;
  if (externalIdentity) {
    const existing = db
      .prepare(
        `SELECT id, canonical_workspace_path AS path
           FROM projects
          WHERE status != 'archived' AND canonical_workspace_path IS NOT NULL`
      )
      .all() as Array<{ id: string; path: string }>;
    assertNoProjectWorkspaceOverlap(externalIdentity.path, existing);
  }
  const workspace =
    externalIdentity && p.workspace.kind === "local_folder"
      ? { ...p.workspace, path: externalIdentity.path }
      : managedPath && p.workspace.kind === "local_folder"
        ? { ...p.workspace, path: managedPath }
        : p.workspace;
  db.prepare(
    `INSERT INTO projects(id, title, type, status, reanchored_to, workspace_json, canonical_workspace_path,
       workspace_dev, workspace_ino, hopper_project_id, exec_mode_default, created_at, updated_at)
     VALUES (@id, @title, @type, @status, @reanchoredTo, @workspaceJson, @canonicalWorkspacePath,
       @workspaceDev, @workspaceIno, @hopperProjectId, @execModeDefault, @createdAt, @updatedAt)`
  ).run({
    id: p.id,
    title: p.title,
    type: p.type,
    status: p.status,
    reanchoredTo: p.reanchoredTo ?? null,
    workspaceJson: JSON.stringify(workspace),
    canonicalWorkspacePath: externalIdentity?.path ?? null,
    workspaceDev: externalIdentity?.dev ?? null,
    workspaceIno: externalIdentity?.ino ?? null,
    hopperProjectId: p.hopperProjectId ?? null,
    execModeDefault: p.executionModeDefault,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt
  });
}

/** external workspace 的唯一受信消费入口：列/JSON 必须同形，filesystem identity 必须未漂移。 */
export function verifiedProjectWorkspace(db: Db, projectId: string): string | null {
  const row = db
    .prepare(
      "SELECT status, workspace_json, canonical_workspace_path, workspace_dev, workspace_ino FROM projects WHERE id=?"
    )
    .get(projectId) as
    | {
        status: string;
        workspace_json: string;
        canonical_workspace_path: string | null;
        workspace_dev: string | null;
        workspace_ino: string | null;
      }
    | undefined;
  if (!row) return null;
  const workspace = JSON.parse(row.workspace_json) as { kind?: string; path?: string; managed?: boolean };
  if (
    typeof workspace.path !== "string" ||
    (workspace.kind !== undefined && workspace.kind !== "local_folder")
  ) {
    return null;
  }
  if (row.status === "archived") return workspace.path;
  if (workspace.managed !== false) return validateManagedWorkspace(projectId, workspace.path);
  if (
    !row.canonical_workspace_path ||
    !row.workspace_dev ||
    !row.workspace_ino ||
    workspace.path !== row.canonical_workspace_path
  ) {
    throw new WorkspacePolicyError("workspace_registry_incomplete", "external workspace registry incomplete");
  }
  return revalidateWorkspaceIdentity({
    path: row.canonical_workspace_path,
    dev: row.workspace_dev,
    ino: row.workspace_ino
  }).path;
}

/** 转正(2.4 lifecycle):draft -> active,title/type 定型 */
export function promoteProjectRow(db: Db, p: { id: string; title: string; type: string; updatedAt: string }): void {
  db.prepare("UPDATE projects SET title = ?, type = ?, status = 'active', updated_at = ? WHERE id = ?").run(
    p.title,
    p.type,
    p.updatedAt,
    p.id
  );
}

/** 并回归档(2.4 lifecycle):draft -> archived + reanchoredTo 指针 */
export function archiveReanchoredRow(db: Db, p: { id: string; reanchoredTo: string; updatedAt: string }): void {
  db.prepare("UPDATE projects SET status = 'archived', reanchored_to = ?, updated_at = ? WHERE id = ?").run(
    p.reanchoredTo,
    p.updatedAt,
    p.id
  );
}

export function getProject(db: Db, id: string): Project | null {
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return projectSchema.parse({
    id: row["id"],
    title: row["title"],
    type: row["type"],
    status: row["status"],
    ...(row["reanchored_to"] ? { reanchoredTo: row["reanchored_to"] } : {}),
    workspace: JSON.parse(row["workspace_json"] as string),
    ...(row["hopper_project_id"] ? { hopperProjectId: row["hopper_project_id"] } : {}),
    executionModeDefault: row["exec_mode_default"],
    createdAt: row["created_at"],
    updatedAt: row["updated_at"]
  });
}

export function insertSession(db: Db, s: Session): void {
  db.prepare(
    `INSERT INTO sessions(id, project_id, project_revision, state, engine, transcript_path, context_digest, started_at, ended_at, lane)
     VALUES (@id, @projectId, @projectRevision, @state, @engine, @transcriptPath, @contextDigest, @startedAt, @endedAt, @lane)`
  ).run({
    id: s.id,
    projectId: s.projectId,
    projectRevision: s.projectRevision,
    state: s.state,
    engine: s.engine,
    transcriptPath: s.transcriptPath,
    contextDigest: s.contextSnapshotDigest ?? null,
    startedAt: s.startedAt,
    endedAt: s.endedAt ?? null,
    lane: s.lane ?? null // 价值证据轨埋点(05;未知先 NULL,dogfood 期由 Quick 直通判定/采访路径回填)
  });
}

export function getSession(db: Db, id: string): Session | null {
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return sessionSchema.parse({
    id: row["id"],
    projectId: row["project_id"],
    projectRevision: row["project_revision"],
    state: row["state"],
    engine: row["engine"],
    transcriptPath: row["transcript_path"],
    ...(row["context_digest"] ? { contextSnapshotDigest: row["context_digest"] } : {}),
    startedAt: row["started_at"],
    ...(row["ended_at"] ? { endedAt: row["ended_at"] } : {})
  });
}
