import { lstatSync, mkdirSync, mkdtempSync, renameSync, rmSync, statSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { newId, type Project, type Session } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { insertProject, insertSession, getProject, getSession } from "../src/storage/dao/projects.js";
import { createProjectDraft } from "../src/projects/lifecycle.js";
import {
  acceptProjectAnchor,
  anchorRebuildState,
  classifyProjectAnchorTurn,
  latestSessionProjectEvent,
  markAnchorRebuilt,
  proposeProjectAnchor,
  type ProjectAnchorCandidate
} from "../src/projects/anchor.js";
import { MemoryLedger } from "../src/memory/ledger.js";
import { HotwordStore } from "../src/memory/hotwords.js";
import { evidenceFor } from "../src/evaluator/readinessBinding.js";
import { assembleOnSessionStart } from "../src/evaluator/readinessGate.js";
import { compileLivePack } from "../src/live/pack.js";
import { ensureProjectAnchorProducts } from "../src/projects/anchorRebuild.js";
import { acceptProjectAnchorWithFollowup } from "../src/projects/anchorCommit.js";
import { verifiedProjectWorkspace } from "../src/storage/dao/projects.js";
import {
  ensureManagedWorkspaceRoot,
  managedProjectPath,
  validateManagedRoot,
  validateStateRoot,
  validateManagedWorkspace
} from "../src/projects/workspace.js";

const NOW = new Date("2026-07-30T12:00:00.000Z");
const ROOT = join(process.cwd(), ".saydo-anchor-test-");

let db: Db;
let audit: ReturnType<typeof createSqliteAuditSink>;
let ledger: MemoryLedger;
const createdPaths = new Set<string>();

function workspace(): string {
  const path = mkdtempSync(ROOT);
  createdPaths.add(path);
  return path;
}

function createDraftSession(): { draftId: string; sessionId: string } {
  const draft = createProjectDraft(db, audit, NOW.toISOString());
  const session: Session = {
    id: newId("ses"),
    projectId: draft.id,
    projectRevision: 0,
    state: "talking",
    engine: "cascade",
    transcriptPath: join(workspace(), "session.jsonl"),
    startedAt: NOW.toISOString()
  };
  insertSession(db, session);
  return { draftId: draft.id, sessionId: session.id };
}

function activeProject(path: string): Project {
  const project: Project = {
    id: newId("prj"),
    title: basename(path),
    type: "writing",
    status: "active",
    workspace: { kind: "local_folder", path, managed: false },
    executionModeDefault: "step_confirm",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString()
  };
  insertProject(db, project);
  return project;
}

function proposal(sessionId: string, turnId: string, text: string, type?: string) {
  return proposeProjectAnchor({ db, sessionId, turnId, userText: text, ...(type ? { type } : {}), now: NOW });
}

beforeEach(() => {
  ensureManagedWorkspaceRoot();
  db = openDb(join(workspace(), "saydo.db"));
  audit = createSqliteAuditSink(db, () => NOW);
  ledger = new MemoryLedger({ db, audit, now: () => NOW });
});

describe("managed workspace 根信任", () => {
  it("标准根为实体目录且 child 尚未创建时只返回固定路径", () => {
    const projectId = newId("prj");
    expect(validateManagedWorkspace(projectId, managedProjectPath(projectId))).toBe(managedProjectPath(projectId));
  });

  it("项目路径不能借 child symlink 逃逸", () => {
    const projectId = newId("prj");
    const external = workspace();
    const child = managedProjectPath(projectId);
    symlinkSync(external, child, "dir");
    createdPaths.add(child);
    expect(() => validateManagedWorkspace(projectId, child)).toThrow(/受管目录/u);
  });

  it("root 本身为 symlink 时拒绝，即使 child 尚未创建", () => {
    const external = workspace();
    const rootAlias = `${workspace()}-old`;
    symlinkSync(external, rootAlias, "dir");
    createdPaths.add(rootAlias);
    expect(() => validateManagedRoot(rootAlias, rootAlias)).toThrow(/实体目录/u);
  });

  it("root owner 与 daemon uid 不一致时拒绝", () => {
    const root = workspace();
    const uid = statSync(root).uid;
    expect(() => validateManagedRoot(root, root, uid + 1)).toThrow(/owner/u);
  });

  it("SayDo 状态根为 symlink 时拒绝 external 重登记", () => {
    const external = workspace();
    const stateAlias = `${workspace()}-old`;
    symlinkSync(external, stateAlias, "dir");
    createdPaths.add(stateAlias);
    expect(() => validateStateRoot(stateAlias, stateAlias)).toThrow(/实体目录/u);
  });

  it("SayDo 状态根的父目录为 symlink 时也拒绝", () => {
    const external = workspace();
    const stateRoot = join(external, "state");
    mkdirSync(stateRoot);
    const parentAlias = `${workspace()}-alias`;
    rmSync(parentAlias, { recursive: true, force: true });
    symlinkSync(external, parentAlias, "dir");
    createdPaths.add(parentAlias);
    expect(() => validateStateRoot(join(parentAlias, "state"))).toThrow(/路径逃逸/u);
  });
});

afterEach(() => {
  db.close();
  for (const path of createdPaths) {
    rmSync(path, { recursive: true, force: true });
    rmSync(`${path}-old`, { recursive: true, force: true });
  }
  createdPaths.clear();
});

describe("项目归属确认闭环", () => {
  it("name_only 分类拒绝否定、需求载荷和项目名子串", () => {
    const projects = [{ id: "prj_octoblog", title: "OctoBlog" }];
    expect(classifyProjectAnchorTurn("在 OctoBlog 上继续", projects)).toMatchObject({
      kind: "name_only",
      match: { id: "prj_octoblog" }
    });
    expect(classifyProjectAnchorTurn("这不是 OctoBlog，先按新事情继续", projects)).toMatchObject({
      kind: "other",
      reason: "project_reference_has_payload"
    });
    expect(classifyProjectAnchorTurn("给 OctoBlog 加一个 RSS 输出", projects)).toMatchObject({
      kind: "other",
      reason: "project_reference_has_payload"
    });
    expect(classifyProjectAnchorTurn("我在做 OctoBlogger", projects)).toMatchObject({
      kind: "other",
      reason: "project_reference_has_payload"
    });
    expect(classifyProjectAnchorTurn("OctoBlogOctoBlog", projects)).toMatchObject({
      kind: "other",
      reason: "project_reference_has_payload"
    });
    expect(classifyProjectAnchorTurn("继续未知项目", projects)).toMatchObject({
      kind: "other",
      reason: "project_name_missing"
    });
    expect(
      classifyProjectAnchorTurn("在 OctoBlog 上继续", [
        ...projects,
        { id: "prj_blog", title: "Blog" }
      ])
    ).toMatchObject({
      kind: "other",
      reason: "project_name_ambiguous"
    });
  });

  it("显式路径只接受单一、正向的归属表达", () => {
    const path = workspace();
    expect(classifyProjectAnchorTurn(`在 ${path} 继续`, [])).toEqual({ kind: "explicit_path" });
    expect(classifyProjectAnchorTurn(`不要挂到 ${path}，先按新事情继续`, [])).toMatchObject({
      kind: "other",
      reason: "workspace_path_not_anchor"
    });
    expect(classifyProjectAnchorTurn(`比较 ${path} 和新项目，先不要改归属`, [])).toMatchObject({
      kind: "other",
      reason: "workspace_path_not_anchor"
    });
    expect(classifyProjectAnchorTurn(`给 ${path} 加 RSS 输出`, [])).toMatchObject({
      kind: "other",
      reason: "workspace_path_not_anchor"
    });
    expect(classifyProjectAnchorTurn(`先给博客加 RSS 输出，路径是 ${path}`, [])).toMatchObject({
      kind: "other",
      reason: "workspace_path_not_anchor"
    });
    expect(classifyProjectAnchorTurn(`把 RSS feed 接上，路径是 ${path}`, [])).toMatchObject({
      kind: "other",
      reason: "workspace_path_not_anchor"
    });
    expect(classifyProjectAnchorTurn(`无需采用这个目录，路径是 ${path}`, [])).toMatchObject({
      kind: "other",
      reason: "workspace_path_not_anchor"
    });
    expect(classifyProjectAnchorTurn(`${path} ${path}`, [])).toMatchObject({
      kind: "other",
      reason: "workspace_path_ambiguous"
    });
    expect(classifyProjectAnchorTurn(`${path} ${workspace()}`, [])).toMatchObject({
      kind: "other",
      reason: "workspace_path_ambiguous"
    });
  });

  it("handler 对否定、比较、任务载荷路径二次 fail-closed", () => {
    const { sessionId } = createDraftSession();
    const path = workspace();
    for (const text of [
      `不要挂到 ${path}，先按新事情继续`,
      `比较 ${path} 和新项目，先不要改归属`,
      `给 ${path} 加 RSS 输出`,
      `先给博客加 RSS 输出，路径是 ${path}`,
      `把 RSS feed 接上，路径是 ${path}`,
      `无需采用这个目录，路径是 ${path}`
    ]) {
      expect(proposal(sessionId, newId("ses"), text, "writing")).toMatchObject({
        ok: false,
        code: "workspace_path_not_anchor"
      });
    }
  });

  it("projectRevision 已推进后不能再次签发 draft 归属候选", () => {
    const { sessionId } = createDraftSession();
    db.prepare("UPDATE sessions SET project_revision=1 WHERE id=?").run(sessionId);
    expect(proposal(sessionId, newId("ses"), workspace(), "writing")).toMatchObject({
      ok: false,
      code: "anchor_already_resolved"
    });
  });

  it("从当前用户轮的 ~/ 路径形成候选，accept 后同一 draft 采用 workspace 且保持 draft", () => {
    const { draftId, sessionId } = createDraftSession();
    const path = workspace();
    const homeRelative = `~/${path.slice(homedir().length + 1)}`;
    const p = proposal(sessionId, newId("ses"), `在${homeRelative}`, "writing");
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.candidate.branch).toBe("adopt_workspace");
    expect(p.promptText).not.toContain(path);
    expect(p.promptText).not.toContain(basename(path));

    const event = acceptProjectAnchor({ db, ledger, audit, candidate: p.candidate, sessionId, now: NOW });
    expect(event.reason).toBe("workspace_adopted");
    expect(event.projectId).toBe(draftId);
    expect(event.projectRevision).toBe(1);
    const project = getProject(db, draftId);
    expect(project?.status).toBe("draft");
    expect(project?.type).toBe("writing");
    expect(project?.title).toBe(basename(path));
    expect(project?.workspace).toEqual({ kind: "local_folder", path, managed: false });
    expect(getSession(db, sessionId)).toMatchObject({
      projectId: draftId,
      projectRevision: 1
    });
    expect(getSession(db, sessionId)?.contextSnapshotDigest).toBeUndefined();
    expect(latestSessionProjectEvent(db, sessionId)).toMatchObject(event);
    const auditRows = db.prepare("SELECT ref_digest, meta_json FROM audit_log WHERE action='project.anchor.workspace_adopted'").all() as {
      ref_digest: string;
      meta_json: string;
    }[];
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]!.ref_digest).toMatch(/^sha256:/u);
    expect(auditRows[0]!.meta_json).not.toContain(path);
  });

  it("路径 exact match 既有 active 项目时并回，draft 归档且 session 切 target", () => {
    const targetPath = workspace();
    const target = activeProject(targetPath);
    const { draftId, sessionId } = createDraftSession();
    ledger.add({
      tier: "M1",
      projectId: draftId,
      claim: "文章需要 RSS 输出",
      source: { kind: "user_utterance", ref: "turn@rss" },
      requestedTrust: "user_stated"
    });
    const p = proposal(sessionId, newId("ses"), `"${targetPath}"`);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.candidate).toMatchObject({ branch: "reanchor_existing", targetId: target.id });

    const event = acceptProjectAnchor({ db, ledger, audit, candidate: p.candidate, sessionId, now: NOW });
    expect(event).toMatchObject({ projectId: target.id, reason: "draft_reanchored", projectRevision: 1 });
    expect(getProject(db, draftId)).toMatchObject({ status: "archived", reanchoredTo: target.id });
    expect(getSession(db, sessionId)).toMatchObject({ projectId: target.id, projectRevision: 1 });
    expect(ledger.project().some((m) => m.projectId === target.id && m.claim === "文章需要 RSS 输出")).toBe(true);
  });

  it("同轮多个不同目录、父子 workspace 重叠与冷档路径均拒绝且零写入", () => {
    const parent = workspace();
    activeProject(parent);
    const child = join(parent, "child");
    mkdirSync(child);
    expect(() => activeProject(child)).toThrow(/重叠/u);
    const { draftId, sessionId } = createDraftSession();
    const other = workspace();

    expect(proposal(sessionId, newId("ses"), `${child} ${other}`, "writing")).toMatchObject({
      ok: false,
      code: "workspace_path_ambiguous"
    });
    expect(proposal(sessionId, newId("ses"), child, "writing")).toMatchObject({
      ok: false,
      code: "workspace_overlap"
    });
    const archive = join(workspace(), "voice-coding.archive-20260729");
    mkdirSync(archive);
    expect(proposal(sessionId, newId("ses"), archive, "writing")).toMatchObject({
      ok: false,
      code: "invalid_workspace_path"
    });
    expect(getProject(db, draftId)).toMatchObject({ type: "pending", status: "draft" });
    expect(getSession(db, sessionId)).toMatchObject({ projectRevision: 0 });
  });

  it("确认前目录 identity 漂移、旧 revision 与双候选竞争均 fail-closed", () => {
    const { sessionId } = createDraftSession();
    const path = workspace();
    const p = proposal(sessionId, newId("ses"), path, "writing");
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    renameSync(path, `${path}-old`);
    mkdirSync(path);
    expect(() => acceptProjectAnchor({ db, ledger, audit, candidate: p.candidate, sessionId, now: NOW })).toThrow(
      /发生变化/u
    );
    expect(getSession(db, sessionId)?.projectRevision).toBe(0);

    const shared = workspace();
    const a = createDraftSession();
    const b = createDraftSession();
    const pa = proposal(a.sessionId, newId("ses"), shared, "writing");
    const pb = proposal(b.sessionId, newId("ses"), shared, "writing");
    expect(pa.ok && pb.ok).toBe(true);
    if (!pa.ok || !pb.ok) return;
    acceptProjectAnchor({ db, ledger, audit, candidate: pa.candidate, sessionId: a.sessionId, now: NOW });
    expect(() =>
      acceptProjectAnchor({ db, ledger, audit, candidate: pb.candidate, sessionId: b.sessionId, now: NOW })
    ).toThrow(/登记状态已变化|重叠/u);

    const stale = { ...pa.candidate, proposalRevision: 0 } as ProjectAnchorCandidate;
    expect(() => acceptProjectAnchor({ db, ledger, audit, candidate: stale, sessionId: a.sessionId, now: NOW })).toThrow(
      /已过期或会话锚已变化/u
    );
  });

  it("已定型 draft 可纠正 workspace，但 type 不可改；登记不受执行 enabled types 限制", () => {
    const { draftId, sessionId } = createDraftSession();
    db.prepare("UPDATE projects SET type='research' WHERE id=?").run(draftId);
    const path = workspace();
    expect(proposal(sessionId, newId("ses"), path)).toMatchObject({
      ok: true,
      candidate: { branch: "adopt_workspace", type: "research" }
    });
    expect(proposal(sessionId, newId("ses"), path, "writing")).toMatchObject({
      ok: false,
      code: "project_type_immutable"
    });
  });

  it("file:// quoted/unquoted 均拒，external canonical/identity 空值不能绕过写闸", () => {
    const { sessionId } = createDraftSession();
    const path = workspace();
    expect(proposal(sessionId, newId("ses"), `file://${path}`, "writing")).toMatchObject({
      ok: false,
      code: "workspace_path_form"
    });
    expect(proposal(sessionId, newId("ses"), `"file://${path}"`, "writing")).toMatchObject({
      ok: false,
      code: "workspace_path_form"
    });
    expect(proposal(sessionId, newId("ses"), `"${path}`, "writing")).toMatchObject({
      ok: false,
      code: "workspace_path_form"
    });
    expect(proposal(sessionId, newId("ses"), `路径是：file://${path}`, "writing")).toMatchObject({
      ok: false,
      code: "workspace_path_form"
    });
    expect(proposal(sessionId, newId("ses"), `项目叫 "OctoBlog"，路径是 ${path}`, "writing")).toMatchObject({
      ok: false,
      code: "workspace_path_not_anchor"
    });
    expect(proposal(sessionId, newId("ses"), `John's Blog，路径是 ${path}`, "writing")).toMatchObject({
      ok: false,
      code: "workspace_path_not_anchor"
    });
    expect(proposal(sessionId, newId("ses"), `It's at ${path} but isn't ready`, "writing")).toMatchObject({
      ok: false,
      code: "workspace_path_not_anchor"
    });
    expect(proposal(sessionId, newId("ses"), `项目名是 "Octo/Blog"，路径是 ${path}`, "writing")).toMatchObject({
      ok: false,
      code: "workspace_path_not_anchor"
    });
    expect(
      proposal(sessionId, newId("ses"), `参考 "docs/a" 和 'docs/b'，路径是 "${path}"`, "writing")
    ).toMatchObject({ ok: false, code: "workspace_path_not_anchor" });
    expect(proposal(sessionId, newId("ses"), `~someone${path}`, "writing")).toMatchObject({
      ok: false,
      code: "workspace_path_form"
    });
    expect(() =>
      db
        .prepare(
          `INSERT INTO projects(id,title,type,status,workspace_json,exec_mode_default,created_at,updated_at)
           VALUES ('prj_anchor_bypass','绕过','coding','active',?,'step_confirm',?,?)`
        )
        .run(JSON.stringify({ kind: "local_folder", path, managed: false }), NOW.toISOString(), NOW.toISOString())
    ).toThrow(/external workspace registry incomplete/u);
  });

  it("未加引号路径中的词内 ASCII 撇号不截断，也不误锚到已存在的同名前缀目录", () => {
    const parent = workspace();
    const prefix = join(parent, "John");
    const full = join(parent, "John'sBlog");
    mkdirSync(prefix);
    mkdirSync(full);
    activeProject(prefix);
    const { sessionId } = createDraftSession();

    const p = proposal(sessionId, newId("ses"), `在 ${full} 继续`, "writing");
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.candidate).toMatchObject({
      branch: "adopt_workspace",
      canonicalPath: full
    });
  });

  it("未加引号路径末尾的 ASCII 撇号不截短到已登记前缀", () => {
    const parent = workspace();
    const prefix = join(parent, "Writer");
    const full = join(parent, "Writer'");
    mkdirSync(prefix);
    mkdirSync(full);
    activeProject(prefix);
    const { sessionId } = createDraftSession();

    const p = proposal(sessionId, newId("ses"), `在 ${full} 继续`, "writing");
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.candidate).toMatchObject({
      branch: "adopt_workspace",
      canonicalPath: full
    });
  });

  it("候选签发后 draft type 被另一写入定型时，旧候选不能跨型覆盖", () => {
    const { draftId, sessionId } = createDraftSession();
    const path = workspace();
    const p = proposal(sessionId, newId("ses"), path, "writing");
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    db.prepare("UPDATE projects SET type='research' WHERE id=? AND type='pending'").run(draftId);

    expect(() =>
      acceptProjectAnchor({ db, ledger, audit, candidate: p.candidate, sessionId, now: NOW })
    ).toThrow(/type 已变化/u);
    expect(getProject(db, draftId)).toMatchObject({ type: "research", status: "draft" });
    expect(getSession(db, sessionId)).toMatchObject({ projectRevision: 0 });
  });

  it("re-anchor 候选签发后出现后代登记时，accept 在写锁内重验并拒绝", () => {
    const targetPath = workspace();
    const target = activeProject(targetPath);
    const { draftId, sessionId } = createDraftSession();
    const p = proposal(sessionId, newId("ses"), targetPath);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    const child = join(targetPath, "late-child");
    mkdirSync(child);
    const identity = lstatSync(child, { bigint: true });
    db.prepare(
      `INSERT INTO projects(id,title,type,status,workspace_json,canonical_workspace_path,workspace_dev,workspace_ino,
                            exec_mode_default,created_at,updated_at)
       VALUES ('prj_anchor_late_child','迟到子项目','writing','active',?,?,?,?, 'step_confirm',?,?)`
    ).run(
      JSON.stringify({ kind: "local_folder", path: child, managed: false }),
      child,
      String(identity.dev),
      String(identity.ino),
      NOW.toISOString(),
      NOW.toISOString()
    );

    expect(() =>
      acceptProjectAnchor({ db, ledger, audit, candidate: p.candidate, sessionId, now: NOW })
    ).toThrow(/重叠/u);
    expect(getProject(db, draftId)).toMatchObject({ status: "draft" });
    expect(getProject(db, target.id)).toMatchObject({ status: "active" });
    expect(getSession(db, sessionId)).toMatchObject({ projectId: draftId, projectRevision: 0 });
  });

  it("external workspace identity 漂移后执行消费拒绝，不会跟随 retarget symlink", () => {
    const path = workspace();
    const project = activeProject(path);
    const moved = `${path}-old`;
    renameSync(path, moved);
    createdPaths.add(moved);
    const other = workspace();
    symlinkSync(other, path);
    expect(() => verifiedProjectWorkspace(db, project.id)).toThrow(/identity|发生变化/u);
  });

  it("已有项目在提案前发生同路径 identity 漂移时拒绝 re-anchor 且零写入", () => {
    const path = workspace();
    activeProject(path);
    renameSync(path, `${path}-old`);
    mkdirSync(path);
    const { draftId, sessionId } = createDraftSession();

    expect(proposal(sessionId, newId("ses"), path)).toMatchObject({
      ok: false,
      code: "workspace_target_identity_changed"
    });
    expect(getProject(db, draftId)).toMatchObject({ status: "draft" });
    expect(getProject(db, draftId)).not.toHaveProperty("reanchoredTo");
    expect(getSession(db, sessionId)).toMatchObject({ projectId: draftId, projectRevision: 0 });
  });

  it("readiness/Pack revision 独立追平，旧 revision 迟到 job 不能推进新锚", () => {
    const { sessionId } = createDraftSession();
    const path = workspace();
    const p = proposal(sessionId, newId("ses"), path, "writing");
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    const event = acceptProjectAnchor({ db, ledger, audit, candidate: p.candidate, sessionId, now: NOW });
    expect(anchorRebuildState(db, sessionId)).toMatchObject({
      projectRevision: 1,
      readinessRevision: 0,
      packRevision: 0
    });
    expect(markAnchorRebuilt({ db, sessionId, projectId: event.projectId, projectRevision: 1, kind: "readiness" })).toBe(true);
    db.prepare("UPDATE sessions SET project_revision=2 WHERE id=?").run(sessionId);
    expect(markAnchorRebuilt({ db, sessionId, projectId: event.projectId, projectRevision: 1, kind: "pack" })).toBe(false);
    expect(anchorRebuildState(db, sessionId)).toMatchObject({
      projectRevision: 2,
      readinessRevision: 1,
      packRevision: 0
    });
  });

  it("生产同型重建器校验真实 readiness 产物并编译 Pack 后才追平双 revision", () => {
    const { sessionId } = createDraftSession();
    const path = workspace();
    const p = proposal(sessionId, newId("ses"), path, "writing");
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    acceptProjectAnchor({ db, ledger, audit, candidate: p.candidate, sessionId, now: NOW });
    const hotwords = new HotwordStore(ledger);
    const readinessEvidence = (sid: string, projectId: string) =>
      evidenceFor({ db, ledger, foundationGenerationOf: () => 0 }, projectId);

    expect(
      ensureProjectAnchorProducts(
        {
          db,
          assembleReadiness: (sid, projectId) =>
            assembleOnSessionStart(
              { db, audit, evidenceProvider: readinessEvidence },
              { sessionId: sid, projectId, type: "writing" }
            ),
          readinessEvidence,
          rebuildPack: ({ sessionId: sid, projectId, projectRevision }) =>
            compileLivePack(
              { db, ledger, hotwords, now: () => NOW },
              { sessionId: sid, projectId, expectedProjectRevision: projectRevision, userText: "", rebuild: true }
            ) !== null,
          warn: () => undefined
        },
        sessionId
      )
    ).toBe(true);
    expect(anchorRebuildState(db, sessionId)).toMatchObject({
      projectRevision: 1,
      readinessRevision: 1,
      packRevision: 1
    });
  });

  it("durable accept 后投递异常只标 degraded，不会伪装成数据库未改", () => {
    const { draftId, sessionId } = createDraftSession();
    const path = workspace();
    const p = proposal(sessionId, newId("ses"), path, "writing");
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    let rebuildCalls = 0;

    const result = acceptProjectAnchorWithFollowup(
      {
        db,
        ledger,
        audit,
        deliver: () => {
          throw new Error("peer send failed");
        },
        rebuild: () => {
          rebuildCalls += 1;
          return false;
        },
        warn: () => undefined,
        now: () => NOW
      },
      sessionId,
      p.candidate
    );

    expect(result).toMatchObject({ ready: false, postCommitDegraded: true });
    expect(rebuildCalls).toBe(1);
    expect(getProject(db, draftId)).toMatchObject({
      title: basename(path),
      type: "writing",
      workspace: { path, managed: false }
    });
    expect(getSession(db, sessionId)).toMatchObject({ projectId: draftId, projectRevision: 1 });
  });

  it("durable accept 后诊断 warn 自身异常也不能反转提交结果", () => {
    const { draftId, sessionId } = createDraftSession();
    const path = workspace();
    const p = proposal(sessionId, newId("ses"), path, "writing");
    expect(p.ok).toBe(true);
    if (!p.ok) return;

    const result = acceptProjectAnchorWithFollowup(
      {
        db,
        ledger,
        audit,
        deliver: () => {
          throw new Error("delivery failed");
        },
        rebuild: () => {
          throw new Error("rebuild failed");
        },
        warn: () => {
          throw new Error("logger failed");
        },
        now: () => NOW
      },
      sessionId,
      p.candidate
    );

    expect(result).toMatchObject({ ready: false, postCommitDegraded: true });
    expect(getSession(db, sessionId)).toMatchObject({ projectId: draftId, projectRevision: 1 });
  });
});
