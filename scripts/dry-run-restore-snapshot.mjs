#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { cpSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function fail(message) {
  process.stderr.write(`[fail] ${message}\n`);
  process.exit(1);
}

if (process.argv.length !== 3) fail("用法:node scripts/dry-run-restore-snapshot.mjs <snapshotDir>");

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const snapshotDir = resolve(process.argv[2]);
execFileSync(process.execPath, [join(scriptDir, "verify-snapshot.mjs"), snapshotDir], {
  stdio: "inherit"
});

const require = createRequire(join(repoRoot, "packages", "daemon", "package.json"));
const Database = require("better-sqlite3");
const manifest = JSON.parse(readFileSync(join(snapshotDir, "snapshot-manifest.json"), "utf8"));
// 必须在 owner home 子树内（workspace 政策）；沙箱常禁写 $HOME 根目录，改落 repo 下临时区。
const dryRunRoot = mkdtempSync(join(repoRoot, ".tmp-saydo-restore-"));
let retainDryRunRoot = false;
process.on("exit", (code) => {
  if (code !== 0 && !retainDryRunRoot) rmSync(dryRunRoot, { recursive: true, force: true });
});
const saydoHome = join(dryRunRoot, "saydo-home");
const workspacesRoot = join(dryRunRoot, "workspaces");
const managedWorkspacesRoot = join(saydoHome, "projects");
mkdirSync(saydoHome, { recursive: true });
mkdirSync(workspacesRoot);
mkdirSync(managedWorkspacesRoot);

function entryFor(role, projectId) {
  const matches = manifest.entries.filter(
    (entry) => entry.role === role && (projectId === undefined || entry.projectId === projectId)
  );
  if (matches.length !== 1) fail(`恢复角色数量非法:${role}:${projectId ?? "global"}`);
  return matches[0];
}

function copyEntry(entry, destination) {
  const source = join(snapshotDir, entry.destination);
  cpSync(source, destination, { recursive: true, verbatimSymlinks: true });
}

function isolatedProjectWorkspace(root, projectId) {
  if (!/^prj_[0-9A-HJKMNP-TV-Z]{26}$/u.test(projectId)) {
    fail(`active 项目 id 非法:${projectId}`);
  }
  const resolvedRoot = resolve(root);
  const workspace = resolve(resolvedRoot, projectId);
  if (dirname(workspace) !== resolvedRoot) fail(`active 项目路径逃逸:${projectId}`);
  return workspace;
}

copyEntry(entryFor("sqlite"), join(saydoHome, "saydo.db"));
copyEntry(entryFor("global_sessions"), join(saydoHome, "sessions"));
for (const entry of manifest.entries.filter((candidate) => candidate.role === "profile")) {
  copyEntry(entry, join(saydoHome, basename(entry.destination)));
}

const restoredDb = new Database(join(saydoHome, "saydo.db"), { fileMustExist: true });
let activeProjects;
try {
  if (restoredDb.pragma("quick_check", { simple: true }) !== "ok") fail("恢复后 SQLite quick_check 失败");
  activeProjects = restoredDb
    .prepare("SELECT id, workspace_json FROM projects WHERE status='active' ORDER BY id")
    .all()
    .map((row) => {
      const workspaceBinding = JSON.parse(row.workspace_json);
      if (workspaceBinding.kind !== "local_folder") fail(`active 项目不是本地 workspace:${row.id}`);
      const external = workspaceBinding.managed === false;
      const workspace = isolatedProjectWorkspace(
        external ? workspacesRoot : managedWorkspacesRoot,
        row.id
      );
      mkdirSync(workspace, { recursive: true });
      const rewrittenBinding = JSON.stringify({ ...workspaceBinding, path: workspace });
      if (external) {
        const stat = lstatSync(workspace, { bigint: true });
        restoredDb
          .prepare(
            `UPDATE projects
             SET workspace_json=?, canonical_workspace_path=?, workspace_dev=?, workspace_ino=?
             WHERE id=?`
          )
          .run(rewrittenBinding, workspace, String(stat.dev), String(stat.ino), row.id);
      } else {
        restoredDb
          .prepare(
            `UPDATE projects
             SET workspace_json=?, canonical_workspace_path=NULL, workspace_dev=NULL, workspace_ino=NULL
             WHERE id=?`
          )
          .run(rewrittenBinding, row.id);
      }
      return { projectId: row.id, workspace };
    });
  const rewriteTranscript = restoredDb.prepare("UPDATE sessions SET transcript_path=? WHERE id=?");
  for (const row of restoredDb
    .prepare("SELECT id, transcript_path FROM sessions ORDER BY id")
    .all()) {
    rewriteTranscript.run(join(saydoHome, "sessions", basename(row.transcript_path)), row.id);
  }
} finally {
  restoredDb.close();
}

for (const { projectId, workspace } of activeProjects) {
  const saydoDir = join(workspace, ".saydo");
  mkdirSync(saydoDir, { recursive: true });
  copyEntry(entryFor("project_foundation", projectId), join(saydoDir, "foundation"));
  copyEntry(entryFor("project_knowledge", projectId), join(saydoDir, "knowledge"));
  const sessionEntry = manifest.entries.find(
    (entry) => entry.role === "project_sessions" && entry.projectId === projectId
  );
  if (sessionEntry) copyEntry(sessionEntry, join(saydoDir, "sessions"));

  const pointer = JSON.parse(readFileSync(join(saydoDir, "foundation", "current.json"), "utf8"));
  const foundationManifest = JSON.parse(
    readFileSync(join(saydoDir, "foundation", pointer.manifest), "utf8")
  );
  const knowledgeCurrent = join(saydoDir, "knowledge", "current");
  if (
    foundationManifest.generation !== pointer.generation ||
    !lstatSync(knowledgeCurrent).isSymbolicLink() ||
    readlinkSync(knowledgeCurrent) !== `gen-${pointer.generation}`
  ) {
    fail(`恢复后 foundation/knowledge generation 不一致:${projectId}`);
  }
}

const tsxCli = join(repoRoot, "packages", "daemon", "node_modules", "tsx", "dist", "cli.mjs");
const consumerProbe = `
  import { readFileSync } from "node:fs";
  import { join } from "node:path";
  import { FoundationBuilder } from "./packages/daemon/src/memory/foundation.ts";
  import { SessionManager } from "./packages/daemon/src/session/manager.ts";
  import { verifiedProjectWorkspace } from "./packages/daemon/src/storage/dao/projects.ts";
  import { openDb } from "./packages/daemon/src/storage/db.ts";
  const projects = ${JSON.stringify(activeProjects)};
  const db = openDb(${JSON.stringify(join(saydoHome, "saydo.db"))});
  try {
    for (const project of projects) {
      const verifiedWorkspace = verifiedProjectWorkspace(db, project.projectId);
      if (verifiedWorkspace !== project.workspace) {
        throw new Error("workspace 生产消费入口恢复探针失败:" + project.projectId);
      }
      const builder = new FoundationBuilder({ workspace: verifiedWorkspace });
      const generation = builder.currentGeneration();
      const manifest = builder.currentManifest();
      if (!manifest || manifest.status !== "complete" || manifest.generation !== generation) {
        throw new Error("FoundationBuilder 恢复探针失败:" + project.projectId);
      }
      readFileSync(join(verifiedWorkspace, ".saydo", "knowledge", "current", "core.md"), "utf8");
    }
    const manager = new SessionManager({ db, audit: { record() {} }, storeTranscript: true });
    const sessions = db.prepare("SELECT id, transcript_path FROM sessions ORDER BY id").all();
    for (const session of sessions) {
      if (!session.transcript_path.startsWith(${JSON.stringify(join(saydoHome, "sessions"))})) {
        throw new Error("SessionManager transcript 仍指向隔离根外:" + session.id);
      }
      manager.readTurns(session.id);
    }
  } finally {
    db.close();
  }
`;
execFileSync(process.execPath, [tsxCli, "-e", consumerProbe], {
  cwd: repoRoot,
  env: { ...process.env, SAYDO_HOME: saydoHome },
  stdio: "inherit"
});

retainDryRunRoot = true;
process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      dryRunRoot,
      saydoHome,
      projects: activeProjects
    },
    null,
    2
  )}\n`
);
