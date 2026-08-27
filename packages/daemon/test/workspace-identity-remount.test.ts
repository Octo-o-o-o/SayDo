// 备份连续失败根因的回归锚(2026-08-22):macOS/APFS 的 st_dev 是挂载期标识,
// 重启或挂载顺序变化后同一卷会拿到不同 dev。硬锚 dev 会把「重挂载」误判成「目录被替换」,
// 导致 verifiedProjectWorkspace -> activeWorkspaceSources -> 定时快照备份连续 workspace_identity_changed。
// 现场取证:生产库登记 dev=16777234 / ino=765311,实际 stat 得 dev=16777231 / ino=765311(ino 未变)。
import { afterAll, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, sep } from "node:path";
import Database from "better-sqlite3";
import { newId, type Session } from "@saydo/contracts";
import { productionWorkspaceSourcesFromSnapshot } from "../src/backup/snapshot.js";
import { canonicalizeWorkspace, ensureManagedWorkspaceRoot, revalidateWorkspaceIdentity, WorkspacePolicyError } from "../src/projects/workspace.js";
import { openDb, type Db } from "../src/storage/db.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { insertProject, insertSession, verifiedProjectWorkspace } from "../src/storage/dao/projects.js";
import { createProjectDraft } from "../src/projects/lifecycle.js";
import { acceptProjectAnchor, proposeProjectAnchor } from "../src/projects/anchor.js";
import { MemoryLedger } from "../src/memory/ledger.js";

// assertAllowedWorkspacePath 要求 workspace 是 owner home 的严格子目录。
// 优先从 homedir 派生,不假定 checkout 落在 home 内。沙箱若禁写 home 根/缓存,
// 仅在 cwd 已是 home 子树时回落,否则显式失败,避免红在无关的策略层。
const created: string[] = [];
function ownerTempRoot(): string {
  const home = realpathSync(homedir());
  for (const parent of [join(home, ".cache"), home]) {
    try {
      mkdirSync(parent, { recursive: true });
      const root = mkdtempSync(join(parent, "saydo-wsid-"));
      created.push(root);
      return root;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "EPERM" && code !== "EACCES") throw err;
    }
  }
  const cwd = realpathSync(process.cwd());
  const rel = relative(home, cwd);
  if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`workspace fixture needs a writable owner-home descendant; home=${home} cwd=${cwd}`);
  }
  const root = mkdtempSync(join(cwd, ".saydo-wsid-"));
  created.push(root);
  return root;
}
function makeWorkspace(): string {
  const dir = join(ownerTempRoot(), "proj");
  mkdirSync(dir);
  return dir;
}
afterAll(() => {
  for (const root of created) rmSync(root, { recursive: true, force: true });
});

describe("revalidateWorkspaceIdentity:dev 漂移不算身份变化", () => {
  it("dev 变、path 与 ino 不变 ⇒ 通过,并返回刷新后的 dev", () => {
    const dir = makeWorkspace();
    const real = canonicalizeWorkspace(dir);
    const stale = { ...real, dev: String(BigInt(real.dev) + 3n) }; // 模拟重挂载后 dev 变号
    const out = revalidateWorkspaceIdentity(stale);
    expect(out.path).toBe(real.path);
    expect(out.ino).toBe(real.ino);
    expect(out.dev).toBe(real.dev); // 返回当前值,不是登记的陈旧值
  });

  it("ino 变 ⇒ 仍判 workspace_identity_changed(目录被换掉的真实信号)", () => {
    const dir = makeWorkspace();
    const real = canonicalizeWorkspace(dir);
    const swapped = { ...real, ino: String(BigInt(real.ino) + 1n) };
    expect(() => revalidateWorkspaceIdentity(swapped)).toThrow(WorkspacePolicyError);
    try {
      revalidateWorkspaceIdentity(swapped);
    } catch (err) {
      expect((err as WorkspacePolicyError).code).toBe("workspace_identity_changed");
    }
  });

  it("路径消失 ⇒ workspace_unavailable(不被本改动吞掉)", () => {
    const dir = makeWorkspace();
    const real = canonicalizeWorkspace(dir);
    rmSync(dir, { recursive: true, force: true });
    try {
      revalidateWorkspaceIdentity(real);
      throw new Error("应当抛错");
    } catch (err) {
      expect((err as WorkspacePolicyError).code).toBe("workspace_unavailable");
    }
  });
});

describe("POSIX dev 漂移后必须刷新登记", () => {
  it("verifiedProjectWorkspace 放行后把 projects.workspace_dev 更新为当前值", () => {
    if (process.platform === "win32") return;
    const root = ownerTempRoot();
    const dir = join(root, "proj");
    mkdirSync(dir);
    const real = canonicalizeWorkspace(dir);
    const db = openDb(join(root, "saydo.db"));
    const projectId = "prj_01WSDEV0000000000000000001";
    insertProject(db, {
      id: projectId,
      title: "漂移",
      type: "coding",
      status: "active",
      workspace: { kind: "local_folder", path: dir, managed: false },
      executionModeDefault: "step_confirm",
      createdAt: "2026-08-22T00:00:00.000Z",
      updatedAt: "2026-08-22T00:00:00.000Z"
    });
    const staleDev = String(BigInt(real.dev) + 3n);
    db.prepare("UPDATE projects SET workspace_dev=? WHERE id=?").run(staleDev, projectId);
    expect(
      (db.prepare("SELECT workspace_dev AS d FROM projects WHERE id=?").get(projectId) as { d: string }).d
    ).toBe(staleDev);
    expect(verifiedProjectWorkspace(db, projectId)).toBe(real.path);
    expect(
      (db.prepare("SELECT workspace_dev AS d FROM projects WHERE id=?").get(projectId) as { d: string }).d
    ).toBe(real.dev);
  });

  it("acceptProjectAnchor 放行后把 workspace_dev 更新为当前值", () => {
    if (process.platform === "win32") return;
    const root = ownerTempRoot();
    const dir = join(root, "proj");
    mkdirSync(dir);
    const real = canonicalizeWorkspace(dir);
    const db = openDb(join(root, "saydo.db"));
    ensureManagedWorkspaceRoot();
    const now = new Date();
    const audit = createSqliteAuditSink(db);
    const ledger = new MemoryLedger({ db, audit, now: () => now });
    const draft = createProjectDraft(db, audit, now.toISOString());
    const sessionId = newId("ses");
    const session: Session = {
      id: sessionId,
      projectId: draft.id,
      projectRevision: 0,
      state: "talking",
      engine: "cascade",
      transcriptPath: join(dir, "session.jsonl"),
      startedAt: now.toISOString()
    };
    insertSession(db, session);
    const homeRelative = `~/${dir.slice(homedir().length + 1)}`;
    const p = proposeProjectAnchor({
      db,
      sessionId,
      turnId: newId("ses"),
      userText: `在${homeRelative}`,
      type: "writing",
      now
    });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    const staleDev = String(BigInt(real.dev) + 3n);
    const stale = { ...p.candidate, dev: staleDev };
    acceptProjectAnchor({ db, ledger, audit, candidate: stale, sessionId, now });
    const row = db.prepare("SELECT workspace_dev AS d FROM projects WHERE id=?").get(draft.id) as { d: string };
    expect(row.d).toBe(real.dev);
    expect(row.d).not.toBe(staleDev);
  });

  it("只读打开时 POSIX dev 漂移不抛错且不刷新登记", () => {
    if (process.platform === "win32") return;
    const root = ownerTempRoot();
    const dir = join(root, "proj");
    mkdirSync(dir);
    const real = canonicalizeWorkspace(dir);
    const dbPath = join(root, "saydo.db");
    const db = openDb(dbPath);
    const projectId = "prj_01WSDEV0000000000000000002";
    insertProject(db, {
      id: projectId,
      title: "漂移只读",
      type: "coding",
      status: "active",
      workspace: { kind: "local_folder", path: dir, managed: false },
      executionModeDefault: "step_confirm",
      createdAt: "2026-08-22T00:00:00.000Z",
      updatedAt: "2026-08-22T00:00:00.000Z"
    });
    const staleDev = String(BigInt(real.dev) + 3n);
    db.prepare("UPDATE projects SET workspace_dev=? WHERE id=?").run(staleDev, projectId);
    db.close();
    const ro = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
      expect(verifiedProjectWorkspace(ro as unknown as Db, projectId)).toBe(real.path);
      expect(
        (ro.prepare("SELECT workspace_dev AS d FROM projects WHERE id=?").get(projectId) as { d: string }).d
      ).toBe(staleDev);
    } finally {
      ro.close();
    }
  });

  it("query_only=ON 时 POSIX dev 漂移不抛错且不刷新登记", () => {
    if (process.platform === "win32") return;
    const root = ownerTempRoot();
    const dir = join(root, "proj");
    mkdirSync(dir);
    const real = canonicalizeWorkspace(dir);
    const db = openDb(join(root, "saydo.db"));
    const projectId = "prj_01WSDEV0000000000000000003";
    insertProject(db, {
      id: projectId,
      title: "漂移 query_only",
      type: "coding",
      status: "active",
      workspace: { kind: "local_folder", path: dir, managed: false },
      executionModeDefault: "step_confirm",
      createdAt: "2026-08-22T00:00:00.000Z",
      updatedAt: "2026-08-22T00:00:00.000Z"
    });
    const staleDev = String(BigInt(real.dev) + 3n);
    db.prepare("UPDATE projects SET workspace_dev=? WHERE id=?").run(staleDev, projectId);
    db.pragma("query_only = ON");
    expect(verifiedProjectWorkspace(db, projectId)).toBe(real.path);
    db.pragma("query_only = OFF");
    expect(
      (db.prepare("SELECT workspace_dev AS d FROM projects WHERE id=?").get(projectId) as { d: string }).d
    ).toBe(staleDev);
    db.close();
  });

  it("query_only=ON 且 safeIntegers 时 POSIX dev 漂移不抛错且不刷新登记", () => {
    if (process.platform === "win32") return;
    const root = ownerTempRoot();
    const dir = join(root, "proj");
    mkdirSync(dir);
    const real = canonicalizeWorkspace(dir);
    const db = openDb(join(root, "saydo.db"));
    const projectId = "prj_01WSDEV0000000000000000005";
    insertProject(db, {
      id: projectId,
      title: "漂移 query_only safeIntegers",
      type: "coding",
      status: "active",
      workspace: { kind: "local_folder", path: dir, managed: false },
      executionModeDefault: "step_confirm",
      createdAt: "2026-08-22T00:00:00.000Z",
      updatedAt: "2026-08-22T00:00:00.000Z"
    });
    const staleDev = String(BigInt(real.dev) + 3n);
    db.prepare("UPDATE projects SET workspace_dev=? WHERE id=?").run(staleDev, projectId);
    db.defaultSafeIntegers(true);
    db.pragma("query_only = ON");
    expect(db.pragma("query_only", { simple: true })).toBe(1n);
    expect(verifiedProjectWorkspace(db, projectId)).toBe(real.path);
    db.pragma("query_only = OFF");
    expect(
      (db.prepare("SELECT workspace_dev AS d FROM projects WHERE id=?").get(projectId) as { d: string }).d
    ).toBe(staleDev);
    db.close();
  });

  it("productionWorkspaceSourcesFromSnapshot 在 stale dev 的只读副本上不失败", async () => {
    if (process.platform === "win32") return;
    const root = ownerTempRoot();
    const dir = join(root, "proj");
    mkdirSync(dir);
    const real = canonicalizeWorkspace(dir);
    const db = openDb(join(root, "saydo.db"));
    const projectId = "prj_01WSDEV0000000000000000004";
    insertProject(db, {
      id: projectId,
      title: "漂移快照",
      type: "coding",
      status: "active",
      workspace: { kind: "local_folder", path: dir, managed: false },
      executionModeDefault: "step_confirm",
      createdAt: "2026-08-22T00:00:00.000Z",
      updatedAt: "2026-08-22T00:00:00.000Z"
    });
    const staleDev = String(BigInt(real.dev) + 3n);
    db.prepare("UPDATE projects SET workspace_dev=? WHERE id=?").run(staleDev, projectId);
    const staging = join(root, "staging");
    mkdirSync(staging);
    await db.backup(join(staging, "saydo.db"));
    const sources = productionWorkspaceSourcesFromSnapshot(staging);
    expect(sources.some((s) => s.projectId === projectId && s.role === "project_foundation")).toBe(true);
    expect(sources.some((s) => s.path.startsWith(real.path))).toBe(true);
    db.close();
  });
});
