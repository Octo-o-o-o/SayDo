import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { newId } from "@saydo/contracts";
import { backupRetentionDays, backupTranscriptPersistence } from "../src/backup/config.js";
import {
  activeWorkspaceSources,
  isSnapshotBackupDue,
  productionBaseSources,
  productionWorkspaceSourcesFromSnapshot,
  reconcileSnapshotRetention,
  runSnapshotBackup
} from "../src/backup/snapshot.js";
import { openDb } from "../src/storage/db.js";
import { canonicalizeWorkspace } from "../src/projects/workspace.js";

const OWNER_TEST_ROOT = mkdtempSync(join(process.cwd(), ".saydo-backup-test-"));

function fixtureDir(prefix: string): string {
  return mkdtempSync(join(OWNER_TEST_ROOT, prefix));
}

async function withSaydoHome<T>(saydoHome: string, action: () => Promise<T>): Promise<T> {
  const previous = process.env["SAYDO_HOME"];
  process.env["SAYDO_HOME"] = saydoHome;
  try {
    return await action();
  } finally {
    if (previous === undefined) delete process.env["SAYDO_HOME"];
    else process.env["SAYDO_HOME"] = previous;
  }
}

function insertExternalProject(
  db: Database.Database,
  id: string,
  title: string,
  path: string
): void {
  const identity = canonicalizeWorkspace(path);
  db.prepare(
    `INSERT INTO projects(id, title, type, status, workspace_json, canonical_workspace_path,
       workspace_dev, workspace_ino, exec_mode_default, created_at, updated_at)
     VALUES (?, ?, 'coding', 'active', ?, ?, ?, ?, 'step_confirm', ?, ?)`
  ).run(
    id,
    title,
    JSON.stringify({ kind: "local_folder", path: identity.path, managed: false }),
    identity.path,
    identity.dev,
    identity.ino,
    "2026-07-29T00:00:00Z",
    "2026-07-29T00:00:00Z"
  );
}

afterAll(() => {
  rmSync(OWNER_TEST_ROOT, { recursive: true, force: true });
});

describe("snapshot backup (0.1 快照 + 保留期)", () => {
  it("复制存在的源、跳过缺失的源、同名源不互相覆盖", async () => {
    const base = fixtureDir("saydo-bk-");
    const txtFile = join(base, "profile.md");
    writeFileSync(txtFile, "profile-bytes");
    const wsA = join(base, "wsA", ".saydo", "knowledge");
    const wsB = join(base, "wsB", ".saydo", "knowledge");
    mkdirSync(wsA, { recursive: true });
    mkdirSync(wsB, { recursive: true });
    writeFileSync(join(wsA, "a.md"), "A");
    writeFileSync(join(wsB, "b.md"), "B");

    const r = await runSnapshotBackup({
      backupRoot: join(base, "backups"),
      sources: [txtFile, join(base, "missing.jsonl"), wsA, wsB],
      retentionDays: 30,
      now: () => new Date("2026-07-24T12:00:00Z")
    });

    expect(r.copied).toHaveLength(3);
    expect(r.skipped).toEqual([join(base, "missing.jsonl")]);
    expect(readFileSync(join(r.snapshotDir, "profile.md"), "utf8")).toBe("profile-bytes");
    expect(existsSync(join(r.snapshotDir, "knowledge", "a.md"))).toBe(true);
    expect(existsSync(join(r.snapshotDir, "knowledge.1", "b.md"))).toBe(true);
  });

  it("SQLite 走在线备份:含 WAL 未 checkpoint 的行,备份可打开(评审 A1)", async () => {
    const base = fixtureDir("saydo-bk3-");
    const db = openDb(join(base, "saydo.db")); // WAL 模式
    db.prepare(
      "INSERT INTO audit_log(id, ts, actor, action) VALUES ('aud_1', '2026-07-24T00:00:00Z', 'daemon', 'wal.test')"
    ).run();
    // 不关库不 checkpoint,直接在线备份
    const r = await runSnapshotBackup({
      backupRoot: join(base, "backups"),
      sources: [],
      sqlite: [{ db, destName: "saydo.db" }],
      retentionDays: 30,
      now: () => new Date("2026-07-24T12:00:00Z")
    });
    expect(r.copied).toContain("sqlite:saydo.db");
    expect(existsSync(join(r.snapshotDir, "saydo.db-wal"))).toBe(false);
    expect(existsSync(join(r.snapshotDir, "saydo.db-shm"))).toBe(false);
    const restored = new Database(join(r.snapshotDir, "saydo.db"), { readonly: true });
    const row = restored.prepare("SELECT action FROM audit_log WHERE id='aud_1'").get() as { action: string };
    expect(row.action).toBe("wal.test"); // WAL 中的行进了备份
    restored.close();
    db.close();
  });

  it("生产源同时恢复 SQLite、全局 session JSONL 与 active 项目 foundation/knowledge", async () => {
    const base = fixtureDir("saydo-bk-prod-");
    const saydoHome = join(base, ".saydo");
    const projectId = newId("prj");
    const projectId2 = newId("prj");
    const managedProjectId = newId("prj");
    const sessionId = newId("ses");
    const workspace = join(base, "project");
    const sessions = join(saydoHome, "sessions");
    const foundation = join(workspace, ".saydo", "foundation");
    const knowledge = join(workspace, ".saydo", "knowledge");
    const workspace2 = join(base, "project2");
    const foundation2 = join(workspace2, ".saydo", "foundation");
    const knowledge2 = join(workspace2, ".saydo", "knowledge");
    const managedWorkspace = join(saydoHome, "projects", managedProjectId);
    const managedFoundation = join(managedWorkspace, ".saydo", "foundation");
    const managedKnowledge = join(managedWorkspace, ".saydo", "knowledge");
    mkdirSync(sessions, { recursive: true });
    mkdirSync(foundation, { recursive: true });
    mkdirSync(knowledge, { recursive: true });
    mkdirSync(foundation2, { recursive: true });
    mkdirSync(knowledge2, { recursive: true });
    mkdirSync(managedFoundation, { recursive: true });
    mkdirSync(managedKnowledge, { recursive: true });
    writeFileSync(
      join(sessions, "turns.jsonl"),
      `${JSON.stringify({
        turnId: newId("ses"),
        ts: "2026-07-29T00:00:01Z",
        speaker: "user",
        text: "恢复演练",
        sentences: [{ sentenceId: "sentence-1", text: "恢复演练", heard: true }],
        engine: "cascade"
      })}\n`
    );
    writeFileSync(
      join(foundation, "current.json"),
      "{\"generation\":1,\"manifest\":\"manifest-gen-1.json\"}\n"
    );
    writeFileSync(join(foundation, "manifest-gen-1.json"), "{\"generation\":1,\"status\":\"complete\"}\n");
    writeFileSync(
      join(foundation2, "current.json"),
      "{\"generation\":2,\"manifest\":\"manifest-gen-2.json\"}\n"
    );
    writeFileSync(join(foundation2, "manifest-gen-2.json"), "{\"generation\":2,\"status\":\"complete\"}\n");
    writeFileSync(
      join(managedFoundation, "current.json"),
      "{\"generation\":3,\"manifest\":\"manifest-gen-3.json\"}\n"
    );
    writeFileSync(
      join(managedFoundation, "manifest-gen-3.json"),
      "{\"generation\":3,\"status\":\"complete\"}\n"
    );
    mkdirSync(join(knowledge, "gen-1"), { recursive: true });
    writeFileSync(join(knowledge, "gen-1", "core.md"), "# knowledge\n");
    writeFileSync(join(knowledge, "gen-1", "inventory.md"), "# inventory\n");
    writeFileSync(join(knowledge, "gen-1", "build-test-run.md"), "# build\n");
    writeFileSync(join(knowledge, "gen-1", "conventions.md"), "# conventions\n");
    symlinkSync("gen-1", join(knowledge, "current"));
    mkdirSync(join(knowledge2, "gen-2"), { recursive: true });
    writeFileSync(join(knowledge2, "gen-2", "core.md"), "# second core\n");
    writeFileSync(join(knowledge2, "gen-2", "inventory.md"), "# inventory\n");
    writeFileSync(join(knowledge2, "gen-2", "build-test-run.md"), "# build\n");
    writeFileSync(join(knowledge2, "gen-2", "conventions.md"), "# conventions\n");
    writeFileSync(join(knowledge2, "gen-2", "notes.md"), "# second\n");
    symlinkSync("gen-2", join(knowledge2, "current"));
    mkdirSync(join(managedKnowledge, "gen-3"), { recursive: true });
    writeFileSync(join(managedKnowledge, "gen-3", "core.md"), "# managed core\n");
    writeFileSync(join(managedKnowledge, "gen-3", "inventory.md"), "# inventory\n");
    writeFileSync(join(managedKnowledge, "gen-3", "build-test-run.md"), "# build\n");
    writeFileSync(join(managedKnowledge, "gen-3", "conventions.md"), "# conventions\n");
    symlinkSync("gen-3", join(managedKnowledge, "current"));

    const db = openDb(join(saydoHome, "saydo.db"));
    insertExternalProject(db, projectId, "backup", workspace);
    insertExternalProject(db, projectId2, "backup2", workspace2);
    db.prepare(
      `INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at)
       VALUES (?, 'managed', 'coding', 'active', ?, 'step_confirm', ?, ?)`
    ).run(
      managedProjectId,
      JSON.stringify({ kind: "local_folder", path: managedWorkspace, managed: true }),
      "2026-07-29T00:00:00Z",
      "2026-07-29T00:00:00Z"
    );
    db.prepare(
      `INSERT INTO sessions(id, project_id, state, engine, transcript_path, started_at)
       VALUES (?, ?, 'talking', 'cascade', ?, ?)`
    ).run(
      sessionId,
      projectId,
      join(sessions, "turns.jsonl"),
      "2026-07-29T00:00:00Z"
    );

    const r = await withSaydoHome(saydoHome, () =>
      runSnapshotBackup({
        backupRoot: join(saydoHome, "backups"),
        sources: productionBaseSources(saydoHome),
        sqlite: [{ db, destName: "saydo.db" }],
        resolveSources: (stagingDir) => productionWorkspaceSourcesFromSnapshot(stagingDir),
        requiredRoles: ["sqlite", "global_sessions"],
        retentionDays: 30,
        now: () => new Date("2026-07-29T12:00:00Z")
      })
    );

    const restored = new Database(join(r.snapshotDir, "saydo.db"), { readonly: true });
    expect(restored.prepare("SELECT title FROM projects WHERE id=?").pluck().get(projectId)).toBe("backup");
    expect(readFileSync(join(r.snapshotDir, "sessions", "turns.jsonl"), "utf8")).toContain(
      "\"text\":\"恢复演练\""
    );
    const manifest = JSON.parse(readFileSync(join(r.snapshotDir, "snapshot-manifest.json"), "utf8")) as {
      completed: boolean;
      digestAlgorithm: string;
      requiredRoles: string[];
      entries: { kind: string; role: string; projectId?: string; source: string; destination: string }[];
    };
    const destinationFor = (role: string, id: string): string => {
      const entry = manifest.entries.find((candidate) => candidate.role === role && candidate.projectId === id);
      if (!entry) throw new Error(`测试快照缺少角色:${role}:${id}`);
      return entry.destination;
    };
    const foundationDestination = destinationFor("project_foundation", projectId);
    const foundationDestination2 = destinationFor("project_foundation", projectId2);
    const knowledgeDestination = destinationFor("project_knowledge", projectId);
    const knowledgeDestination2 = destinationFor("project_knowledge", projectId2);
    expect(JSON.parse(readFileSync(join(r.snapshotDir, foundationDestination, "current.json"), "utf8"))).toEqual({
      generation: 1,
      manifest: "manifest-gen-1.json"
    });
    expect(JSON.parse(readFileSync(join(r.snapshotDir, foundationDestination2, "current.json"), "utf8"))).toEqual({
      generation: 2,
      manifest: "manifest-gen-2.json"
    });
    expect(readFileSync(join(r.snapshotDir, knowledgeDestination, "current", "core.md"), "utf8")).toBe("# knowledge\n");
    expect(readlinkSync(join(r.snapshotDir, knowledgeDestination, "current"))).toBe("gen-1");
    expect(readFileSync(join(r.snapshotDir, knowledgeDestination2, "current", "notes.md"), "utf8")).toBe("# second\n");
    expect(manifest.completed).toBe(true);
    expect(manifest.digestAlgorithm).toBe("saydo-tree-sha256-v1");
    expect(manifest.requiredRoles).toEqual([
      "global_sessions",
      "project_foundation",
      "project_knowledge",
      "sqlite"
    ]);
    expect(manifest.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "sqlite", role: "sqlite", source: "saydo.db", destination: "saydo.db" }),
        expect.objectContaining({
          kind: "path",
          role: "global_sessions",
          source: realpathSync(sessions),
          destination: "sessions"
        }),
        expect.objectContaining({
          kind: "path",
          role: "project_foundation",
          projectId,
          source: realpathSync(foundation),
          destination: foundationDestination
        }),
        expect.objectContaining({
          kind: "path",
          role: "project_knowledge",
          projectId,
          source: realpathSync(knowledge),
          destination: knowledgeDestination
        }),
        expect.objectContaining({
          kind: "path",
          role: "project_knowledge",
          projectId: projectId2,
          source: realpathSync(knowledge2),
          destination: knowledgeDestination2
        })
      ])
    );
    const verifier = resolve(__dirname, "../../../scripts/verify-snapshot.mjs");
    expect(() => execFileSync(process.execPath, [verifier, r.snapshotDir])).not.toThrow();
    const dryRunRestore = resolve(__dirname, "../../../scripts/dry-run-restore-snapshot.mjs");
    const dryRunOutput = execFileSync(process.execPath, [dryRunRestore, r.snapshotDir], {
      encoding: "utf8"
    });
    const dryRunResult = JSON.parse(dryRunOutput.slice(dryRunOutput.indexOf("{"))) as {
      ok: boolean;
      dryRunRoot: string;
      saydoHome: string;
      projects: { projectId: string; workspace: string }[];
    };
    try {
      expect(dryRunResult.ok).toBe(true);
      expect(dryRunResult.projects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ projectId }),
          expect.objectContaining({ projectId: projectId2 }),
          expect.objectContaining({ projectId: managedProjectId })
        ])
      );
      const dryRunDb = new Database(join(dryRunResult.saydoHome, "saydo.db"), {
        readonly: true
      });
      try {
        const rewritten = dryRunDb
          .prepare(
            `SELECT workspace_json, canonical_workspace_path, workspace_dev, workspace_ino
             FROM projects WHERE id=?`
          )
          .get(projectId) as {
            workspace_json: string;
            canonical_workspace_path: string;
            workspace_dev: string;
            workspace_ino: string;
          };
        const binding = JSON.parse(rewritten.workspace_json) as { path: string };
        const stat = lstatSync(binding.path, { bigint: true });
        expect(rewritten.canonical_workspace_path).toBe(binding.path);
        expect(rewritten.workspace_dev).toBe(String(stat.dev));
        expect(rewritten.workspace_ino).toBe(String(stat.ino));
        const managed = dryRunDb
          .prepare(
            `SELECT workspace_json, canonical_workspace_path, workspace_dev, workspace_ino
             FROM projects WHERE id=?`
          )
          .get(managedProjectId) as {
            workspace_json: string;
            canonical_workspace_path: null;
            workspace_dev: null;
            workspace_ino: null;
          };
        expect(JSON.parse(managed.workspace_json)).toEqual({
          kind: "local_folder",
          path: join(dryRunResult.saydoHome, "projects", managedProjectId),
          managed: true
        });
        expect(managed.canonical_workspace_path).toBeNull();
        expect(managed.workspace_dev).toBeNull();
        expect(managed.workspace_ino).toBeNull();
      } finally {
        dryRunDb.close();
      }
    } finally {
      rmSync(dryRunResult.dryRunRoot, { recursive: true, force: true });
    }
    const maliciousSnapshot = join(base, "malicious-snapshot");
    cpSync(r.snapshotDir, maliciousSnapshot, { recursive: true, verbatimSymlinks: true });
    const maliciousProjectId = "../../saydo-restore-path-escape";
    const maliciousDbPath = join(maliciousSnapshot, "saydo.db");
    const maliciousDb = new Database(maliciousDbPath);
    try {
      maliciousDb.pragma("foreign_keys = OFF");
      maliciousDb.prepare("UPDATE projects SET id=? WHERE id=?").run(maliciousProjectId, projectId);
    } finally {
      maliciousDb.close();
    }
    const maliciousManifestPath = join(maliciousSnapshot, "snapshot-manifest.json");
    const maliciousManifest = JSON.parse(readFileSync(maliciousManifestPath, "utf8")) as {
      entries: {
        role: string;
        projectId?: string;
        destination: string;
        sha256: string;
        bytes: number;
      }[];
    };
    for (const entry of maliciousManifest.entries) {
      if (entry.projectId === projectId) entry.projectId = maliciousProjectId;
    }
    const sqliteEntry = maliciousManifest.entries.find((entry) => entry.role === "sqlite");
    if (!sqliteEntry) throw new Error("恶意快照测试缺少 SQLite 角色");
    const maliciousDbBytes = readFileSync(maliciousDbPath);
    sqliteEntry.sha256 = createHash("sha256")
      .update("file\0")
      .update(maliciousDbBytes)
      .digest("hex");
    sqliteEntry.bytes = maliciousDbBytes.byteLength;
    writeFileSync(maliciousManifestPath, `${JSON.stringify(maliciousManifest, null, 2)}\n`);
    const restoreDirsBefore = readdirSync(homedir())
      .filter((name) => name.startsWith(".saydo-restore-"))
      .sort();
    let maliciousError: unknown;
    try {
      execFileSync(process.execPath, [dryRunRestore, maliciousSnapshot], {
        encoding: "utf8",
        stdio: "pipe"
      });
    } catch (error) {
      maliciousError = error;
    }
    expect(maliciousError).toBeDefined();
    expect(String((maliciousError as { stderr?: string }).stderr)).toContain("active 项目 id 非法");
    expect(
      readdirSync(homedir())
        .filter((name) => name.startsWith(".saydo-restore-"))
        .sort()
    ).toEqual(restoreDirsBefore);
    expect(existsSync(join(homedir(), "saydo-restore-path-escape"))).toBe(false);

    const incomplete = join(base, "incomplete-snapshot");
    cpSync(r.snapshotDir, incomplete, { recursive: true, verbatimSymlinks: true });
    const incompleteManifest = JSON.parse(
      readFileSync(join(incomplete, "snapshot-manifest.json"), "utf8")
    ) as { requiredRoles: string[]; entries: { role: string; destination: string }[] };
    for (const entry of incompleteManifest.entries.filter((entry) =>
      ["project_foundation", "project_knowledge"].includes(entry.role)
    )) {
      rmSync(join(incomplete, entry.destination), { recursive: true, force: true });
    }
    incompleteManifest.entries = incompleteManifest.entries.filter(
      (entry) => !["project_foundation", "project_knowledge"].includes(entry.role)
    );
    incompleteManifest.requiredRoles = incompleteManifest.requiredRoles.filter(
      (role) => !["project_foundation", "project_knowledge"].includes(role)
    );
    writeFileSync(
      join(incomplete, "snapshot-manifest.json"),
      `${JSON.stringify(incompleteManifest, null, 2)}\n`
    );
    expect(() => execFileSync(process.execPath, [verifier, incomplete])).toThrow();
    const backupRoot = join(saydoHome, "backups");
    expect(
      isSnapshotBackupDue(
        backupRoot,
        24 * 60 * 60 * 1000,
        new Date("2026-07-29T12:30:00Z")
      )
    ).toBe(false);
    const liveManifestPath = join(r.snapshotDir, "snapshot-manifest.json");
    const liveManifest = JSON.parse(readFileSync(liveManifestPath, "utf8")) as {
      requiredRoles: string[];
      entries: { role: string; destination: string }[];
    };
    for (const entry of liveManifest.entries.filter((entry) =>
      ["project_foundation", "project_knowledge"].includes(entry.role)
    )) {
      rmSync(join(r.snapshotDir, entry.destination), { recursive: true, force: true });
    }
    liveManifest.entries = liveManifest.entries.filter(
      (entry) => !["project_foundation", "project_knowledge"].includes(entry.role)
    );
    liveManifest.requiredRoles = liveManifest.requiredRoles.filter(
      (role) => !["project_foundation", "project_knowledge"].includes(role)
    );
    writeFileSync(liveManifestPath, `${JSON.stringify(liveManifest, null, 2)}\n`);
    expect(
      isSnapshotBackupDue(
        backupRoot,
        24 * 60 * 60 * 1000,
        new Date("2026-07-29T12:30:00Z")
      )
    ).toBe(true);
    rmSync(join(sessions, "turns.jsonl"));
    const privacySnapshot = await withSaydoHome(saydoHome, () =>
      runSnapshotBackup({
        backupRoot: join(saydoHome, "privacy-backups"),
        sources: productionBaseSources(saydoHome),
        sqlite: [{ db, destName: "saydo.db" }],
        resolveSources: (stagingDir) => productionWorkspaceSourcesFromSnapshot(stagingDir),
        requiredRoles: ["sqlite", "global_sessions"],
        transcriptPersistence: "privacy_disabled",
        retentionDays: 30,
        now: () => new Date("2026-07-29T12:01:00Z")
      })
    );
    expect(() => execFileSync(process.execPath, [verifier, privacySnapshot.snapshotDir])).not.toThrow();
    restored.close();
    db.close();
  });

  it("knowledge generation 指向快照外时拒绝发布", async () => {
    const base = fixtureDir("saydo-bk-knowledge-link-");
    const saydoHome = join(base, ".saydo");
    const workspace = join(base, "project");
    const foundation = join(workspace, ".saydo", "foundation");
    const knowledge = join(workspace, ".saydo", "knowledge");
    const externalGeneration = join(base, "external-gen-1");
    mkdirSync(join(saydoHome, "sessions"), { recursive: true });
    mkdirSync(foundation, { recursive: true });
    mkdirSync(knowledge, { recursive: true });
    mkdirSync(externalGeneration);
    writeFileSync(
      join(foundation, "current.json"),
      "{\"generation\":1,\"manifest\":\"manifest-gen-1.json\"}\n"
    );
    writeFileSync(
      join(foundation, "manifest-gen-1.json"),
      "{\"generation\":1,\"status\":\"complete\"}\n"
    );
    for (const name of ["core.md", "inventory.md", "build-test-run.md", "conventions.md"]) {
      writeFileSync(join(externalGeneration, name), `# ${name}\n`);
    }
    symlinkSync(externalGeneration, join(knowledge, "gen-1"));
    symlinkSync("gen-1", join(knowledge, "current"));
    const db = openDb(join(saydoHome, "saydo.db"));
    insertExternalProject(db, "prj_link", "link", workspace);
    const backupRoot = join(saydoHome, "backups");
    await expect(
      runSnapshotBackup({
        backupRoot,
        sources: productionBaseSources(saydoHome),
        sqlite: [{ db, destName: "saydo.db" }],
        resolveSources: (stagingDir) => productionWorkspaceSourcesFromSnapshot(stagingDir),
        requiredRoles: ["sqlite", "global_sessions"],
        retentionDays: 30,
        now: () => new Date("2026-07-29T12:02:00Z")
      })
    ).rejects.toThrow(/knowledge generation 不可消费/);
    expect(existsSync(join(backupRoot, "20260729T120200Z"))).toBe(false);
    db.close();
  });

  it("保留期外的旧快照整份删除(09 §4 备份例外:到期整份消失)", async () => {
    const base = fixtureDir("saydo-bk2-");
    const root = join(base, "backups");
    const oldDir = join(root, "20260601T000000Z");
    mkdirSync(oldDir, { recursive: true });
    writeFileSync(join(oldDir, "stale.db"), "old");
    const keepDir = join(root, "20260720T000000Z");
    mkdirSync(keepDir, { recursive: true });

    const src = join(base, "f.txt");
    writeFileSync(src, "x");
    const r = await runSnapshotBackup({
      backupRoot: root,
      sources: [src],
      retentionDays: 30,
      now: () => new Date("2026-07-24T12:00:00Z")
    });

    expect(r.pruned).toEqual(["20260601T000000Z"]);
    expect(existsSync(oldDir)).toBe(false);
    expect(existsSync(keepDir)).toBe(true);
  });

  it("必需生产源缺失时不发布半成品快照", async () => {
    const base = fixtureDir("saydo-bk-required-");
    const root = join(base, "backups");
    const stamp = "20260729T120000Z";

    await expect(
      runSnapshotBackup({
        backupRoot: root,
        sources: [
          {
            path: join(base, "missing-knowledge"),
            role: "project_knowledge",
            required: true,
            projectId: "prj_missing"
          }
        ],
        retentionDays: 30,
        now: () => new Date("2026-07-29T12:00:00Z")
      })
    ).rejects.toThrow(/必需备份源不存在/);

    expect(existsSync(join(root, stamp))).toBe(false);
    expect(existsSync(join(root, `${stamp}.partial`))).toBe(false);
  });

  it("active 非本地 workspace 不得被静默漏备份", () => {
    const base = fixtureDir("saydo-bk-remote-");
    const db = openDb(join(base, "saydo.db"));
    db.prepare(
      `INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at)
       VALUES (?, ?, 'coding', 'active', ?, 'step_confirm', ?, ?)`
    ).run(
      "prj_remote",
      "remote",
      JSON.stringify({ kind: "remote_repo", path: "", url: "https://example.invalid/repo", managed: false }),
      "2026-07-29T00:00:00Z",
      "2026-07-29T00:00:00Z"
    );

    expect(() => activeWorkspaceSources(db)).toThrow(/暂不支持备份/);
    db.close();
  });

  it.each([-1, 0])("非法保留期 %s 在创建或清理任何快照前拒绝", async (retentionDays) => {
    const base = fixtureDir("saydo-bk-retention-");
    const root = join(base, "backups");
    const oldDir = join(root, "20260601T000000Z");
    mkdirSync(oldDir, { recursive: true });
    writeFileSync(join(oldDir, "keep.db"), "must-stay");

    await expect(
      runSnapshotBackup({
        backupRoot: root,
        sources: [],
        retentionDays,
        now: () => new Date("2026-07-29T12:00:00Z")
      })
    ).rejects.toThrow(/retentionDays 必须是大于 0 的有限数/);

    expect(readFileSync(join(oldDir, "keep.db"), "utf8")).toBe("must-stay");
    expect(readdirSync(root)).toEqual(["20260601T000000Z"]);
  });

  it("本轮复制失败仍治理过期完整快照和 stale partial", async () => {
    const base = fixtureDir("saydo-bk-reconcile-");
    const root = join(base, "backups");
    const oldFinal = join(root, "20260601T000000Z");
    const oldPartial = join(root, "20260602T000000Z.partial");
    const freshPartial = join(root, "20260728T000000Z.partial");
    mkdirSync(oldFinal, { recursive: true });
    mkdirSync(oldPartial, { recursive: true });
    mkdirSync(freshPartial, { recursive: true });

    await expect(
      runSnapshotBackup({
        backupRoot: root,
        sources: [{ path: join(base, "missing"), role: "path", required: true }],
        retentionDays: 30,
        now: () => new Date("2026-07-29T12:00:00Z")
      })
    ).rejects.toThrow(/必需备份源不存在/);

    expect(existsSync(oldFinal)).toBe(false);
    expect(existsSync(oldPartial)).toBe(false);
    expect(existsSync(freshPartial)).toBe(true);
  });

  it("workspace 源从 SQLite 副本解析，不受在线备份后的 live DB 变更影响", async () => {
    const base = fixtureDir("saydo-bk-point-");
    const saydoHome = join(base, ".saydo");
    const workspaceA = join(base, "project-a");
    const workspaceB = join(base, "project-b");
    for (const [index, workspace] of [workspaceA, workspaceB].entries()) {
      const generation = index + 1;
      const foundationDir = join(workspace, ".saydo", "foundation");
      const knowledgeDir = join(workspace, ".saydo", "knowledge");
      const knowledgeGeneration = join(knowledgeDir, `gen-${generation}`);
      mkdirSync(foundationDir, { recursive: true });
      mkdirSync(knowledgeGeneration, { recursive: true });
      writeFileSync(
        join(foundationDir, "current.json"),
        `${JSON.stringify({ generation, manifest: `manifest-gen-${generation}.json` })}\n`
      );
      writeFileSync(
        join(foundationDir, `manifest-gen-${generation}.json`),
        `${JSON.stringify({ generation, status: "complete" })}\n`
      );
      for (const name of ["core.md", "inventory.md", "build-test-run.md", "conventions.md"]) {
        writeFileSync(join(knowledgeGeneration, name), `# ${name}\n`);
      }
      symlinkSync(`gen-${generation}`, join(knowledgeDir, "current"));
    }
    mkdirSync(join(saydoHome, "sessions"), { recursive: true });
    const db = openDb(join(saydoHome, "saydo.db"));
    insertExternalProject(db, "prj_point_a", "point-a", workspaceA);

    const r = await runSnapshotBackup({
      backupRoot: join(saydoHome, "backups"),
      sources: productionBaseSources(saydoHome),
      sqlite: [{ db, destName: "saydo.db" }],
      afterSqliteBackup: () => {
        insertExternalProject(db, "prj_point_b", "point-b", workspaceB);
      },
      resolveSources: (stagingDir) => productionWorkspaceSourcesFromSnapshot(stagingDir),
      requiredRoles: ["sqlite", "global_sessions"],
      retentionDays: 30,
      now: () => new Date("2026-07-29T12:30:00Z")
    });

    const restored = new Database(join(r.snapshotDir, "saydo.db"), { readonly: true });
    expect(restored.prepare("SELECT count(*) FROM projects WHERE status='active'").pluck().get()).toBe(1);
    const manifest = JSON.parse(readFileSync(join(r.snapshotDir, "snapshot-manifest.json"), "utf8")) as {
      entries: { projectId?: string }[];
    };
    expect(manifest.entries.some((entry) => entry.projectId === "prj_point_a")).toBe(true);
    expect(manifest.entries.some((entry) => entry.projectId === "prj_point_b")).toBe(false);
    restored.close();
    db.close();
  });

  it("启动补跑只认摘要和基础角色完整的 completed v2 最终快照", async () => {
    const base = fixtureDir("saydo-bk-due-");
    const root = join(base, "backups");
    mkdirSync(join(root, "20260729T000000Z"), { recursive: true });
    writeFileSync(
      join(root, "20260729T000000Z", "snapshot-manifest.json"),
      "{\"schemaVersion\":2,\"completed\":true}\n"
    );
    expect(isSnapshotBackupDue(root, 24 * 60 * 60 * 1000, new Date("2026-07-29T12:00:00Z"))).toBe(true);

    const saydoHome = join(base, ".saydo");
    mkdirSync(join(saydoHome, "sessions"), { recursive: true });
    const db = openDb(join(saydoHome, "saydo.db"));
    const completed = await runSnapshotBackup({
      backupRoot: root,
      sources: productionBaseSources(saydoHome),
      sqlite: [{ db, destName: "saydo.db" }],
      requiredRoles: ["sqlite", "global_sessions"],
      retentionDays: 30,
      now: () => new Date("2026-07-29T01:00:00Z")
    });
    db.close();
    expect(isSnapshotBackupDue(root, 24 * 60 * 60 * 1000, new Date("2026-07-29T12:00:00Z"))).toBe(false);
    writeFileSync(join(completed.snapshotDir, "saydo.db-wal"), "unexpected");
    expect(isSnapshotBackupDue(root, 24 * 60 * 60 * 1000, new Date("2026-07-29T12:00:00Z"))).toBe(true);
    rmSync(join(completed.snapshotDir, "saydo.db-wal"));
    expect(isSnapshotBackupDue(root, 24 * 60 * 60 * 1000, new Date("2026-07-30T01:00:00Z"))).toBe(true);
    mkdirSync(join(root, "20260730T010000Z.partial"), { recursive: true });
    expect(isSnapshotBackupDue(root, 24 * 60 * 60 * 1000, new Date("2026-07-30T02:00:00Z"))).toBe(true);
  });

  it("独立保留期治理按时间戳清理，不把 fresh partial 当完成快照", () => {
    const base = fixtureDir("saydo-bk-prune-");
    const root = join(base, "backups");
    const outside = join(base, "outside");
    mkdirSync(outside);
    writeFileSync(join(outside, "keep"), "x");
    mkdirSync(join(root, "20260601T000000Z.partial"), { recursive: true });
    mkdirSync(join(root, "20260729T000000Z.partial"), { recursive: true });
    symlinkSync(outside, join(root, "20260602T000000Z"));
    expect(reconcileSnapshotRetention(root, 30, new Date("2026-07-29T12:00:00Z"))).toEqual([
      "20260601T000000Z.partial"
    ]);
    expect(readdirSync(root)).toEqual(["20260602T000000Z", "20260729T000000Z.partial"]);
    expect(readFileSync(join(outside, "keep"), "utf8")).toBe("x");
  });

  it("缺失配置使用默认保留期，已存在但非法的配置拒绝而非静默回退", () => {
    const base = fixtureDir("saydo-bk-config-");
    expect(backupRetentionDays(base)).toBe(30);
    writeFileSync(
      join(base, "config.toml"),
      `[models]
profile = "default"
dialog = "gpt-5.6-sol"
thinking = "gpt-5.6-sol"
cheap = "gpt-5-mini"
evaluator = { provider = "claude_cli", model = "claude-sonnet-5" }
[params]
backup_retention_days = 0
`
    );
    expect(() => backupRetentionDays(base)).toThrow(/backup_retention_days 必须是大于 0/);
    writeFileSync(join(base, "config.toml"), "[params\n");
    expect(() => backupRetentionDays(base)).toThrow();
  });

  it("备份 manifest 的转写策略来自全局隐私配置", () => {
    const base = fixtureDir("saydo-bk-privacy-config-");
    expect(backupTranscriptPersistence(base)).toBe("required");
    writeFileSync(
      join(base, "config.toml"),
      `[models]
profile = "default"
dialog = "gpt-5.6-sol"
thinking = "gpt-5.6-sol"
cheap = "gpt-5-mini"
evaluator = { provider = "claude_cli", model = "claude-sonnet-5" }
[privacy]
store_transcript = false
`
    );
    expect(backupTranscriptPersistence(base)).toBe("privacy_disabled");
  });
});
