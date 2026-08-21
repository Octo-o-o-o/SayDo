// 场次① live 阻断回修：当前用户轮显式路径 -> daemon 只读核验 -> ConfirmationLoop
// -> accept 原子采用 workspace / 并回既有项目。Brain 不接收也不回传路径。

import { basename, isAbsolute, relative, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { jcsDigest, newId, type ProjectType } from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import type { MemoryLedger } from "../memory/ledger.js";
import { getProject, getSession, verifiedProjectWorkspace } from "../storage/dao/projects.js";
import { reanchorDraft } from "./lifecycle.js";
import {
  canonicalizeWorkspace,
  revalidateWorkspaceIdentity,
  WorkspacePolicyError,
  type WorkspaceIdentity
} from "./workspace.js";

const PROJECT_TYPES = new Set<Exclude<ProjectType, "pending">>([
  "coding",
  "writing",
  "planning",
  "research",
  "marketing",
  "general"
]);
const PATH_TERMINATORS = /[\s，。！？；,!?;]/u;

export interface SessionProjectEvent {
  eventId: string;
  sessionId: string;
  projectId: string;
  projectRevision: number;
  reason: "draft_created" | "workspace_adopted" | "draft_reanchored" | "migration_snapshot";
  createdAt: string;
}

interface CandidateBase {
  kind: "project_anchor";
  proposalId: string;
  nonce: string;
  expiresAt: string;
  sessionId: string;
  draftId: string;
  proposalTurnId: string;
  proposalRevision: number;
  canonicalPath: string;
  canonicalPathDigest: string;
  dev: string;
  ino: string;
}

export type ProjectAnchorCandidate =
  | (CandidateBase & {
      branch: "adopt_workspace";
      title: string;
      type: Exclude<ProjectType, "pending">;
    })
  | (CandidateBase & {
      branch: "reanchor_existing";
      targetId: string;
    });

export type ProjectAnchorProposal =
  | { ok: true; candidate: ProjectAnchorCandidate; promptText: string }
  | { ok: false; code: string; message: string };

function isStrictDescendant(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function overlaps(a: string, b: string): boolean {
  return a === b || isStrictDescendant(a, b) || isStrictDescendant(b, a);
}

function isWordApostrophe(text: string, index: number): boolean {
  if (text[index] !== "'") return false;
  const word = /[\p{L}\p{N}]/u;
  return word.test(text[index - 1] ?? "") && word.test(text[index + 1] ?? "");
}

function closingQuoteIndex(text: string, quote: string, start: number): number {
  for (let i = start; i < text.length; i++) {
    if (text[i] === quote && (quote !== "'" || !isWordApostrophe(text, i))) return i;
  }
  return -1;
}

function isDriveAbsAt(text: string, index: number): boolean {
  if (index + 2 >= text.length) return false;
  const letter = text[index];
  if (!letter || !/[A-Za-z]/u.test(letter)) return false;
  if (text[index + 1] !== ":") return false;
  const slash = text[index + 2];
  if (slash !== "/" && slash !== "\\") return false;
  const next = text[index + 3];
  if (next === "/" || next === "\\") return false;
  if (index > 0 && /[A-Za-z0-9]/u.test(text[index - 1] as string)) return false;
  return true;
}

function isPathStartAt(text: string, index: number): boolean {
  return text.startsWith("/", index) || text.startsWith("~/", index) || isDriveAbsAt(text, index);
}

function rejectForbiddenPathForms(normalized: string): void {
  if (/(?:file|https?|ftp):\/\//iu.test(normalized)) {
    throw new WorkspacePolicyError("workspace_path_form", "不接受 URI scheme 路径");
  }
  if (normalized.includes("\\\\?\\") || /(?:^|[\s"'`])\\\\[A-Za-z0-9._-]+\\/u.test(normalized)) {
    throw new WorkspacePolicyError("workspace_path_form", "不接受 UNC 或扩展路径");
  }
  if (/~(?!\/)[^/\s，。！？；,!?;]+[/\\]/u.test(normalized)) {
    throw new WorkspacePolicyError("workspace_path_form", "不接受 ~user/ 路径");
  }
}

function pathSpans(text: string): string[] {
  const normalized = text.normalize("NFC");
  rejectForbiddenPathForms(normalized);
  const spans: { start: number; end: number; value: string }[] = [];
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i] as string;
    if (['"', "'", "`"].includes(char) && !isWordApostrophe(normalized, i)) {
      const end = closingQuoteIndex(normalized, char, i + 1);
      const opensPath = isPathStartAt(normalized, i + 1);
      if (end < 0) {
        if (opensPath) throw new WorkspacePolicyError("workspace_path_form", "路径引号必须闭合");
        continue;
      }
      const value = normalized.slice(i + 1, end);
      if (!opensPath || !isPathStartAt(value, 0)) {
        i = end;
        continue;
      }
      spans.push({ start: i, end: end + 1, value });
      i = end;
      continue;
    }
    const tilde = normalized.startsWith("~/", i);
    const drive = isDriveAbsAt(normalized, i);
    if (!tilde && char !== "/" && !drive) continue;
    let end = i + (tilde ? 2 : drive ? 3 : 1);
    while (
      end < normalized.length &&
      !PATH_TERMINATORS.test(normalized[end] as string)
    ) {
      end += 1;
    }
    let value = normalized.slice(i, end);
    if (value.length > 1) value = value.replace(/\/+$/u, "");
    spans.push({ start: i, end, value });
    i = end - 1;
  }
  return spans.sort((a, b) => a.start - b.start).map((span) => span.value);
}

/** 只判断当前轮是否含路径字面量；不展开、不回传路径，供 daemon 路由闸使用。 */
export function hasExplicitWorkspacePathLiteral(text: string): boolean {
  try {
    return pathSpans(text).length > 0;
  } catch (err) {
    return err instanceof WorkspacePolicyError;
  }
}

export type ProjectAnchorTurnClassification =
  | { kind: "explicit_path" }
  | { kind: "name_only"; match: { id: string; title: string } }
  | {
      kind: "other";
      reason:
        | "workspace_path_ambiguous"
        | "workspace_path_not_anchor"
        | "project_name_missing"
        | "project_name_ambiguous"
        | "project_reference_has_payload";
    };

function isPositiveWorkspaceAnchorTurn(text: string, paths: string[]): boolean {
  if (paths.length !== 1) return false;
  const normalized = text.normalize("NFC").toLowerCase();
  // 非法 URI 形态继续交给 handler 返回 workspace_path_form，不降格成普通对话。
  if (normalized.includes("file://") || /(?:https?|ftp):\/\//iu.test(normalized)) return true;
  const path = paths[0]?.normalize("NFC").toLowerCase() ?? "";
  const first = normalized.indexOf(path);
  if (first < 0 || normalized.indexOf(path, first + path.length) >= 0) return false;
  const residual = `${normalized.slice(0, first)}${normalized.slice(first + path.length)}`.replaceAll(
    /[\p{White_Space}\p{Punctuation}]+/gu,
    ""
  );
  if (residual === "") return true;
  const polite = "(?:嗯|好|好的|请|麻烦|我想|我要|就|就是)?";
  const anchor =
    "(?:(?:项目|工作区|路径|本地路径|项目路径)?(?:在|是|为)(?:继续|接着)?|(?:挂到|挂在|接到|切到|回到)(?:继续|接着)?|(?:在)?(?:这个|该)?(?:项目)?(?:上)?(?:继续|接着)|(?:继续|接着)(?:在)?(?:这个|该)?(?:项目)?)";
  return new RegExp(`^${polite}${anchor}$`, "u").test(residual);
}

export function classifyProjectAnchorTurn(
  text: string,
  projects: { id: string; title: string }[]
): ProjectAnchorTurnClassification {
  let paths: string[];
  try {
    paths = pathSpans(text);
  } catch {
    // 畸形但明确的路径仍交给 proposeProjectAnchor 返回具体格式错误，不进入名称解析。
    return { kind: "explicit_path" };
  }
  if (paths.length > 1) return { kind: "other", reason: "workspace_path_ambiguous" };
  if (paths.length === 1) {
    return isPositiveWorkspaceAnchorTurn(text, paths)
      ? { kind: "explicit_path" }
      : { kind: "other", reason: "workspace_path_not_anchor" };
  }
  const normalized = text.normalize("NFC").toLowerCase();
  const matches = projects.filter((project) => {
    const title = project.title.normalize("NFC").toLowerCase();
    return title !== "" && normalized.includes(title);
  });
  if (matches.length === 0) return { kind: "other", reason: "project_name_missing" };
  if (matches.length > 1) return { kind: "other", reason: "project_name_ambiguous" };

  const match = matches[0] as { id: string; title: string };
  const normalizedTitle = match.title.normalize("NFC").toLowerCase();
  const first = normalized.indexOf(normalizedTitle);
  if (normalized.indexOf(normalizedTitle, first + normalizedTitle.length) >= 0) {
    return { kind: "other", reason: "project_reference_has_payload" };
  }
  const residual = `${normalized.slice(0, first)}${normalized.slice(first + normalizedTitle.length)}`.replaceAll(
    /[\p{White_Space}\p{Punctuation}]+/gu,
    ""
  );
  const prefix = "(?:嗯|好|好的|请|麻烦|我想|我要|就)?";
  const intent =
    "(?:在(?:这个|该)?(?:项目)?上(?:继续|接着)?|(?:继续|接着)(?:这个|该)?(?:项目)?|(?:回到|切到)(?:这个|该)?(?:项目)?(?:继续|接着)?)";
  if (residual === "" || new RegExp(`^${prefix}(?:${intent})?$`, "u").test(residual)) {
    return { kind: "name_only", match };
  }
  return { kind: "other", reason: "project_reference_has_payload" };
}

function liveExternalWorkspaces(db: Db, excludeProjectId: string): { id: string; path: string; status: string }[] {
  return db
    .prepare(
      `SELECT id, canonical_workspace_path AS path, status
         FROM projects
        WHERE id != ? AND status != 'archived' AND canonical_workspace_path IS NOT NULL`
    )
    .all(excludeProjectId) as { id: string; path: string; status: string }[];
}

function findExact(rows: { id: string; path: string; status: string }[], path: string) {
  return rows.filter((row) => row.path === path);
}

function assertNoOverlap(rows: { id: string; path: string }[], path: string, allowExactId?: string): void {
  const conflict = rows.find((row) => overlaps(row.path, path) && !(row.path === path && row.id === allowExactId));
  if (conflict) throw new Error(`workspace 与现役项目 ${conflict.id} 重叠`);
}

export function proposeProjectAnchor(input: {
  db: Db;
  sessionId: string;
  turnId: string;
  userText: string;
  type?: string;
  now: Date;
}): ProjectAnchorProposal {
  const session = getSession(input.db, input.sessionId);
  if (!session) return { ok: false, code: "session_not_found", message: "当前会话不存在" };
  if (session.projectRevision > 0) {
    return { ok: false, code: "anchor_already_resolved", message: "当前会话已经锚定项目，不能再次走 draft 归属确认" };
  }
  const draft = getProject(input.db, session.projectId);
  if (!draft || draft.status !== "draft" || draft.reanchoredTo) {
    return { ok: false, code: "anchor_requires_draft", message: "项目归属确认只接受当前未并回的 draft" };
  }
  const turnClass = classifyProjectAnchorTurn(input.userText, []);
  if (turnClass.kind !== "explicit_path") {
    return {
      ok: false,
      code:
        turnClass.kind === "other" && turnClass.reason === "workspace_path_ambiguous"
          ? "workspace_path_ambiguous"
          : "workspace_path_not_anchor",
      message:
        turnClass.kind === "other" && turnClass.reason === "workspace_path_ambiguous"
          ? "当前用户轮包含多个路径，不能确定项目归属"
          : "当前用户轮中的路径不是单纯、正向的项目归属表达"
    };
  }

  let rawSpans: string[];
  try {
    rawSpans = pathSpans(input.userText);
  } catch (err) {
    return {
      ok: false,
      code: err instanceof WorkspacePolicyError ? err.code : "invalid_workspace_path",
      message: err instanceof Error ? err.message : "路径格式无效"
    };
  }
  const canonical = new Map<string, WorkspaceIdentity>();
  try {
    for (const raw of rawSpans) {
      const item = canonicalizeWorkspace(raw);
      canonical.set(`${item.dev}:${item.ino}`, item);
    }
  } catch (err) {
    return { ok: false, code: "invalid_workspace_path", message: String(err instanceof Error ? err.message : err) };
  }
  if (canonical.size !== 1) {
    return {
      ok: false,
      code: canonical.size === 0 ? "workspace_path_missing" : "workspace_path_ambiguous",
      message: canonical.size === 0 ? "当前这句话里没有可核验的本地路径" : "当前这句话里有多个不同目录"
    };
  }
  const workspace = [...canonical.values()][0] as WorkspaceIdentity;
  const rows = liveExternalWorkspaces(input.db, draft.id);
  const exact = findExact(rows, workspace.path);
  if (exact.length > 1) return { ok: false, code: "workspace_registry_conflict", message: "该目录对应多个现役项目" };
  try {
    assertNoOverlap(rows, workspace.path, exact[0]?.id);
  } catch (err) {
    return { ok: false, code: "workspace_overlap", message: String(err instanceof Error ? err.message : err) };
  }

  const base = {
    kind: "project_anchor" as const,
    proposalId: newId("anc"),
    nonce: randomUUID(),
    expiresAt: new Date(input.now.getTime() + 120_000).toISOString(),
    sessionId: input.sessionId,
    draftId: draft.id,
    proposalTurnId: input.turnId,
    proposalRevision: session.projectRevision,
    canonicalPath: workspace.path,
    canonicalPathDigest: jcsDigest({ canonicalPath: workspace.path }),
    dev: workspace.dev,
    ino: workspace.ino
  };
  if (exact.length === 1) {
    const target = getProject(input.db, exact[0]!.id);
    if (!target || target.status !== "active") {
      return { ok: false, code: "workspace_target_not_active", message: "该目录对应的项目不是 active" };
    }
    try {
      if (verifiedProjectWorkspace(input.db, target.id) !== workspace.path) {
        return { ok: false, code: "workspace_target_identity_changed", message: "已有项目的目录登记已漂移" };
      }
    } catch {
      return { ok: false, code: "workspace_target_identity_changed", message: "已有项目的目录登记已漂移" };
    }
    return {
      ok: true,
      candidate: { ...base, branch: "reanchor_existing", targetId: target.id },
      promptText: "我找到这个已有项目了,把刚才的对话挂过去,对吗?"
    };
  }

  const effectiveType =
    draft.type === "pending"
      ? PROJECT_TYPES.has(input.type as Exclude<ProjectType, "pending">)
        ? (input.type as Exclude<ProjectType, "pending">)
        : null
      : draft.type;
  if (!effectiveType) return { ok: false, code: "project_type_required", message: "未登记目录需要先给出项目类型" };
  if (draft.type !== "pending" && input.type !== undefined && input.type !== draft.type) {
    return { ok: false, code: "project_type_immutable", message: `当前 draft 已定型为 ${draft.type},不能改成 ${input.type}` };
  }
  return {
    ok: true,
    candidate: {
      ...base,
      branch: "adopt_workspace",
      title: basename(workspace.path).normalize("NFC"),
      type: effectiveType
    },
    promptText: `我找到这个本地项目,按 ${effectiveType} 项目登记并把刚才的对话挂过去,对吗?`
  };
}

function revalidateCandidate(candidate: ProjectAnchorCandidate, now: Date): void {
  if (now.getTime() > Date.parse(candidate.expiresAt)) throw new Error("项目归属确认已过期");
  revalidateWorkspaceIdentity({ path: candidate.canonicalPath, dev: candidate.dev, ino: candidate.ino });
}

export function acceptProjectAnchor(input: {
  db: Db;
  ledger: MemoryLedger;
  audit: AuditSink;
  candidate: ProjectAnchorCandidate;
  sessionId: string;
  now: Date;
}): SessionProjectEvent {
  const { candidate } = input;
  if (candidate.sessionId !== input.sessionId) throw new Error("项目归属确认与当前会话不符");
  const nowIso = input.now.toISOString();
  const tx = input.db.transaction(() => {
    // BEGIN IMMEDIATE 已取得 write lock 后再验 filesystem identity，缩到最小 TOCTOU 窗口。
    revalidateCandidate(candidate, input.now);
    const session = getSession(input.db, input.sessionId);
    if (
      !session ||
      session.projectId !== candidate.draftId ||
      session.projectRevision !== candidate.proposalRevision
    ) {
      throw new Error("项目归属确认已过期或会话锚已变化");
    }
    const draft = getProject(input.db, candidate.draftId);
    if (!draft || draft.status !== "draft" || draft.reanchoredTo) throw new Error("draft 状态已变化");

    const rows = liveExternalWorkspaces(input.db, draft.id);
    const exact = findExact(rows, candidate.canonicalPath);
    assertNoOverlap(
      rows,
      candidate.canonicalPath,
      candidate.branch === "reanchor_existing" ? candidate.targetId : undefined
    );
    let projectId: string;
    let reason: SessionProjectEvent["reason"];
    if (candidate.branch === "adopt_workspace") {
      if (exact.length !== 0) throw new Error("目录登记状态已变化,请重新确认");
      if (draft.type !== "pending" && draft.type !== candidate.type) {
        throw new Error("draft type 已变化,请重新确认");
      }
      const updated = input.db
        .prepare(
          `UPDATE projects
              SET title=?, type=?, workspace_json=?, canonical_workspace_path=?, workspace_dev=?, workspace_ino=?, updated_at=?
            WHERE id=? AND status='draft' AND (type='pending' OR type=?)`
        )
        .run(
          candidate.title,
          candidate.type,
          JSON.stringify({ kind: "local_folder", path: candidate.canonicalPath, managed: false }),
          candidate.canonicalPath,
          candidate.dev,
          candidate.ino,
          nowIso,
          candidate.draftId,
          candidate.type
        );
      if (updated.changes !== 1) throw new Error("draft type 已变化,请重新确认");
      projectId = candidate.draftId;
      reason = "workspace_adopted";
    } else {
      if (exact.length !== 1 || exact[0]!.id !== candidate.targetId) {
        throw new Error("目录对应项目已变化,请重新确认");
      }
      if (verifiedProjectWorkspace(input.db, candidate.targetId) !== candidate.canonicalPath) {
        throw new Error("已有项目目录 identity 已变化,请重新确认");
      }
      reanchorDraft(
        input.db,
        input.ledger,
        input.audit,
        { draftId: candidate.draftId, targetId: candidate.targetId },
        nowIso
      );
      projectId = candidate.targetId;
      reason = "draft_reanchored";
    }
    const projectRevision = session.projectRevision + 1;
    input.db
      .prepare("UPDATE sessions SET project_id=?, project_revision=?, context_digest=NULL WHERE id=?")
      .run(projectId, projectRevision, input.sessionId);
    const event: SessionProjectEvent = {
      eventId: newId("evt"),
      sessionId: input.sessionId,
      projectId,
      projectRevision,
      reason,
      createdAt: nowIso
    };
    input.db
      .prepare(
        `INSERT INTO session_project_events(id, session_id, project_id, project_revision, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(event.eventId, event.sessionId, event.projectId, event.projectRevision, event.reason, event.createdAt);
    input.audit.record({
      actor: "owner",
      action: `project.anchor.${reason}`,
      refDigest: candidate.canonicalPathDigest,
      meta: {
        sessionId: input.sessionId,
        draftId: candidate.draftId,
        projectId,
        proposalId: candidate.proposalId,
        projectRevision
      }
    });
    return event;
  });
  return tx.immediate();
}

export function latestSessionProjectEvent(db: Db, sessionId: string): SessionProjectEvent | null {
  const row = db
    .prepare(
      `SELECT id, session_id, project_id, project_revision, reason, created_at
         FROM session_project_events WHERE session_id=? ORDER BY project_revision DESC LIMIT 1`
    )
    .get(sessionId) as
    | {
        id: string;
        session_id: string;
        project_id: string;
        project_revision: number;
        reason: SessionProjectEvent["reason"];
        created_at: string;
      }
    | undefined;
  return row
    ? {
        eventId: row.id,
        sessionId: row.session_id,
        projectId: row.project_id,
        projectRevision: row.project_revision,
        reason: row.reason,
        createdAt: row.created_at
      }
    : null;
}

export type AnchorRebuildKind = "readiness" | "pack";

export function anchorRebuildState(
  db: Db,
  sessionId: string
): {
  projectId: string;
  projectRevision: number;
  readinessRevision: number;
  packRevision: number;
} | null {
  const row = db
    .prepare(
      `SELECT project_id, project_revision, anchor_readiness_revision, anchor_pack_revision
         FROM sessions WHERE id=?`
    )
    .get(sessionId) as
    | {
        project_id: string;
        project_revision: number;
        anchor_readiness_revision: number;
        anchor_pack_revision: number;
      }
    | undefined;
  return row
    ? {
        projectId: row.project_id,
        projectRevision: row.project_revision,
        readinessRevision: row.anchor_readiness_revision,
        packRevision: row.anchor_pack_revision
      }
    : null;
}

export function markAnchorRebuilt(input: {
  db: Db;
  sessionId: string;
  projectId: string;
  projectRevision: number;
  kind: AnchorRebuildKind;
}): boolean {
  const column = input.kind === "readiness" ? "anchor_readiness_revision" : "anchor_pack_revision";
  const result = input.db
    .prepare(
      `UPDATE sessions SET ${column}=?
        WHERE id=? AND project_id=? AND project_revision=? AND ${column} < ?`
    )
    .run(input.projectRevision, input.sessionId, input.projectId, input.projectRevision, input.projectRevision);
  if (result.changes > 0) return true;
  const state = anchorRebuildState(input.db, input.sessionId);
  return (
    state?.projectId === input.projectId &&
    state.projectRevision === input.projectRevision &&
    (input.kind === "readiness" ? state.readinessRevision : state.packRevision) === input.projectRevision
  );
}

export function isAnchorRebuilt(state: NonNullable<ReturnType<typeof anchorRebuildState>>): boolean {
  return state.readinessRevision === state.projectRevision && state.packRevision === state.projectRevision;
}

export function recordInitialSessionProjectEvent(
  db: Db,
  sessionId: string,
  projectId: string,
  createdAt: string
): SessionProjectEvent {
  const event: SessionProjectEvent = {
    eventId: newId("evt"),
    sessionId,
    projectId,
    projectRevision: 0,
    reason: "draft_created",
    createdAt
  };
  db.prepare(
    `INSERT INTO session_project_events(id, session_id, project_id, project_revision, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(event.eventId, event.sessionId, event.projectId, event.projectRevision, event.reason, event.createdAt);
  return event;
}
