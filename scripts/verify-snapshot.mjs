#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, readlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), "..", "packages", "daemon", "package.json"));
const Database = require("better-sqlite3");

function fail(message) {
  process.stderr.write(`[fail] ${message}\n`);
  process.exit(1);
}

function fingerprint(path) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) {
    const target = readlinkSync(path);
    return {
      sha256: createHash("sha256").update("link\0").update(target).digest("hex"),
      bytes: Buffer.byteLength(target)
    };
  }
  if (stat.isFile()) {
    const bytes = readFileSync(path);
    return {
      sha256: createHash("sha256").update("file\0").update(bytes).digest("hex"),
      bytes: bytes.byteLength
    };
  }
  if (stat.isDirectory()) {
    const hash = createHash("sha256").update("directory\0");
    let bytes = 0;
    for (const name of readdirSync(path).sort()) {
      const child = fingerprint(join(path, name));
      hash.update(name).update("\0").update(child.sha256).update("\0");
      bytes += child.bytes;
    }
    return { sha256: hash.digest("hex"), bytes };
  }
  fail(`不支持的快照条目类型:${path}`);
}

if (process.argv.length !== 3) fail("用法:node scripts/verify-snapshot.mjs <snapshotDir>");
const snapshotDir = resolve(process.argv[2]);
if (basename(snapshotDir).endsWith(".partial")) fail("partial 目录不是完整快照");

let manifest;
try {
  manifest = JSON.parse(readFileSync(join(snapshotDir, "snapshot-manifest.json"), "utf8"));
} catch (error) {
  fail(`manifest 不可读:${String(error)}`);
}
if (manifest.schemaVersion !== 2 || manifest.completed !== true || !Array.isArray(manifest.entries)) {
  fail("manifest 必须是 completed 的 schemaVersion 2");
}
if (manifest.digestAlgorithm !== "saydo-tree-sha256-v1") {
  fail(`不支持的 digestAlgorithm:${String(manifest.digestAlgorithm)}`);
}
if (!Array.isArray(manifest.requiredRoles) || !manifest.requiredRoles.every((role) => typeof role === "string")) {
  fail("manifest requiredRoles 非法");
}
const transcriptPersistence = manifest.transcriptPersistence ?? "required";
if (!["required", "privacy_disabled"].includes(transcriptPersistence)) {
  fail(`manifest transcriptPersistence 非法:${String(transcriptPersistence)}`);
}

const destinations = new Set();
const supportedRoles = new Set([
  "sqlite",
  "profile",
  "global_sessions",
  "project_foundation",
  "project_knowledge",
  "project_sessions"
]);
for (const entry of manifest.entries) {
  if (
    typeof entry.destination !== "string" ||
    basename(entry.destination) !== entry.destination ||
    destinations.has(entry.destination)
  ) {
    fail(`非法或重复 destination:${String(entry.destination)}`);
  }
  if (!supportedRoles.has(entry.role)) fail(`不支持的生产恢复角色:${String(entry.role)}`);
  destinations.add(entry.destination);
  const destinationPath = join(snapshotDir, entry.destination);
  if (lstatSync(destinationPath).isSymbolicLink()) fail(`顶层 destination 不得是 symlink:${entry.destination}`);
  const actual = fingerprint(destinationPath);
  if (actual.sha256 !== entry.sha256 || actual.bytes !== entry.bytes) {
    fail(`摘要或字节数不匹配:${entry.destination}`);
  }
}

const expectedChildren = new Set(["snapshot-manifest.json", ...destinations]);
const unexpected = readdirSync(snapshotDir).filter((name) => !expectedChildren.has(name));
if (unexpected.length > 0) fail(`manifest 外额外条目:${unexpected.join(",")}`);

const roles = new Set(manifest.entries.map((entry) => entry.role));
for (const role of manifest.requiredRoles) {
  if (!roles.has(role)) fail(`缺少生产恢复角色:${role}`);
}
for (const role of ["sqlite", "global_sessions"]) {
  if (!manifest.requiredRoles.includes(role)) fail(`未声明基础必需角色:${role}`);
}

const sqliteEntries = manifest.entries.filter((entry) => entry.role === "sqlite");
if (sqliteEntries.length !== 1 || sqliteEntries[0].kind !== "sqlite") fail("sqlite 角色必须恰好一个 regular file");
const sqlitePath = join(snapshotDir, sqliteEntries[0].destination);
if (!lstatSync(sqlitePath).isFile()) fail("sqlite destination 不是 regular file");
const globalSessions = manifest.entries.filter((entry) => entry.role === "global_sessions");
if (globalSessions.length !== 1 || !lstatSync(join(snapshotDir, globalSessions[0].destination)).isDirectory()) {
  fail("global_sessions 角色必须恰好一个目录");
}
const profiles = manifest.entries.filter((entry) => entry.role === "profile");
if (
  profiles.length > 1 ||
  profiles.some((entry) => !lstatSync(join(snapshotDir, entry.destination)).isFile())
) {
  fail("profile 角色最多一个 regular file");
}

let activeProjectIds;
let transcriptFiles;
const db = new Database(sqlitePath, { readonly: true, fileMustExist: true });
try {
  if (db.pragma("quick_check", { simple: true }) !== "ok") fail("SQLite quick_check 失败");
  activeProjectIds = new Set(
    db
      .prepare("SELECT id FROM projects WHERE status='active' ORDER BY id")
      .all()
      .map((row) => row.id)
  );
  const transcriptRows = db.prepare("SELECT transcript_path FROM sessions ORDER BY id").all();
  transcriptFiles = new Set(transcriptRows.map((row) => basename(row.transcript_path)));
  if (transcriptFiles.size !== transcriptRows.length) fail("多个 session 复用同一 transcript_path");
} finally {
  db.close();
}
const sessionsDir = join(snapshotDir, globalSessions[0].destination);
const sessionChildren = readdirSync(sessionsDir);
if (sessionChildren.some((name) => !lstatSync(join(sessionsDir, name)).isFile())) {
  fail("全局 sessions 含非文件条目");
}
const actualTranscriptFiles = new Set(sessionChildren);
if ([...actualTranscriptFiles].some((name) => !transcriptFiles.has(name))) {
  fail("全局 JSONL 存在无 SQLite session 对应的文件");
}
if (
  transcriptPersistence === "required" &&
  (transcriptFiles.size !== actualTranscriptFiles.size ||
    [...transcriptFiles].some((name) => !actualTranscriptFiles.has(name)))
) {
  fail("store_transcript=true 时 SQLite session 缺少 JSONL");
}

const projectEntries = manifest.entries.filter((entry) =>
  ["project_foundation", "project_knowledge", "project_sessions"].includes(entry.role)
);
for (const entry of projectEntries) {
  if (typeof entry.projectId !== "string" || entry.projectId === "") {
    fail(`${entry.role} 缺少 projectId`);
  }
  if (!activeProjectIds.has(entry.projectId)) fail(`manifest 含非 active 项目:${entry.projectId}`);
}

for (const projectId of activeProjectIds) {
  const foundations = manifest.entries.filter(
    (entry) => entry.role === "project_foundation" && entry.projectId === projectId
  );
  const knowledgeEntries = manifest.entries.filter(
    (entry) => entry.role === "project_knowledge" && entry.projectId === projectId
  );
  const projectSessions = manifest.entries.filter(
    (entry) => entry.role === "project_sessions" && entry.projectId === projectId
  );
  if (foundations.length !== 1 || knowledgeEntries.length !== 1 || projectSessions.length > 1) {
    fail(`active 项目恢复角色数量非法:${projectId}`);
  }
  const foundation = foundations[0];
  const knowledge = knowledgeEntries[0];
  const foundationDir = join(snapshotDir, foundation.destination);
  const foundationPointerPath = join(foundationDir, "current.json");
  if (
    !lstatSync(foundationDir).isDirectory() ||
    !lstatSync(foundationPointerPath).isFile()
  ) {
    fail(`foundation pointer 不是快照内 regular file:${projectId}`);
  }
  let pointer;
  try {
    pointer = JSON.parse(readFileSync(foundationPointerPath, "utf8"));
  } catch (error) {
    fail(`foundation current.json 不可读:${projectId}:${String(error)}`);
  }
  if (
    !Number.isInteger(pointer.generation) ||
    pointer.generation < 1 ||
    typeof pointer.manifest !== "string" ||
    basename(pointer.manifest) !== pointer.manifest
  ) {
    fail(`foundation current.json 非法:${projectId}`);
  }
  let foundationManifest;
  const foundationManifestPath = join(foundationDir, pointer.manifest);
  if (!lstatSync(foundationManifestPath).isFile()) {
    fail(`foundation manifest 不是快照内 regular file:${projectId}`);
  }
  try {
    foundationManifest = JSON.parse(readFileSync(foundationManifestPath, "utf8"));
  } catch (error) {
    fail(`foundation manifest 不可读:${projectId}:${String(error)}`);
  }
  if (
    foundationManifest.generation !== pointer.generation ||
    foundationManifest.status !== "complete"
  ) {
    fail(`foundation generation 不一致:${projectId}`);
  }
  const knowledgeCurrent = join(snapshotDir, knowledge.destination, "current");
  const knowledgeGeneration = join(snapshotDir, knowledge.destination, `gen-${pointer.generation}`);
  if (
    !lstatSync(knowledgeCurrent).isSymbolicLink() ||
    readlinkSync(knowledgeCurrent) !== `gen-${pointer.generation}` ||
    !lstatSync(knowledgeGeneration).isDirectory() ||
    ["core.md", "inventory.md", "build-test-run.md", "conventions.md"].some(
      (name) => !lstatSync(join(knowledgeGeneration, name)).isFile()
    )
  ) {
    fail(`knowledge/current 与 foundation generation 不一致:${projectId}`);
  }
}

process.stdout.write(
  `[ok] snapshot=${snapshotDir} entries=${manifest.entries.length} digests=verified foundation=restorable extras=0\n`
);
