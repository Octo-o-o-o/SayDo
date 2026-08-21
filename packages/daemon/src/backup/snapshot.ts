// 定时快照备份(计划 0.1;docs/09 §4 备份例外的物理载体):
// - 对象:~/.saydo/saydo.db(走 SQLite 在线备份,含 WAL 未 checkpoint 事务,不撕裂)
//         + 各 workspace 的 .saydo/{foundation,knowledge,sessions} + ~/.saydo/profile.md(普通文件拷贝);
// - 快照是不可变整体文件副本:hard-forget 不逐条清备份,靠保留期到期整份删除闭合
//   (backup_retention_days,缺省 30;话术如实告知 docs/10 #38);
// - 快照目录命名 = ISO 时间戳(文件系统安全形态),过期判定按目录名解析。

import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import Database from "better-sqlite3";
import type { Db } from "../storage/db.js";
import { verifiedProjectWorkspace } from "../storage/dao/projects.js";

export interface SnapshotSource {
  path: string;
  role:
    | "profile"
    | "global_sessions"
    | "project_foundation"
    | "project_knowledge"
    | "project_sessions"
    | "path";
  required?: boolean;
  projectId?: string;
}

export interface SnapshotOptions {
  /** 备份根目录(缺省 ~/.saydo/backups) */
  backupRoot: string;
  /** 要快照的路径列表(文件或目录;不存在的跳过并记录)。SQLite 库勿放这里,走 sqlite 参数 */
  sources: (string | SnapshotSource)[];
  /** SQLite 在线备份完成后，以副本中的项目表解析同一备份点的 workspace 源。 */
  resolveSources?: (stagingDir: string) => (string | SnapshotSource)[];
  /** 生产入口声明必须出现的基础恢复角色；required 路径角色会自动并入 manifest。 */
  requiredRoles?: string[];
  /** 当前隐私策略对 session JSONL 的承诺；privacy_disabled 允许 SQLite session 无转写文件。 */
  transcriptPersistence?: "required" | "privacy_disabled";
  /** 仅供竞态测试:SQLite 副本完成后、解析 workspace 前执行。 */
  afterSqliteBackup?: () => void;
  /** SQLite 库走在线备份 API(含 WAL 未 checkpoint 事务、不撕裂;评审 A1) */
  sqlite?: { db: Db; destName: string }[];
  retentionDays: number;
  now?: () => Date;
}

export interface SnapshotResult {
  snapshotDir: string;
  copied: string[];
  skipped: string[];
  pruned: string[];
}

interface SnapshotManifestEntry {
  kind: "sqlite" | "path";
  role: string;
  projectId?: string;
  source: string;
  destination: string;
  sha256: string;
  bytes: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
export const SNAPSHOT_DIGEST_ALGORITHM = "saydo-tree-sha256-v1";

function stampFor(d: Date): string {
  // 20260724T123456Z 形态:可排序、可解析、无冒号
  return d.toISOString().replaceAll(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function parseStamp(name: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(name);
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
}

function fingerprint(path: string): { sha256: string; bytes: number } {
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
  throw new Error(`不支持的备份源类型:${path}`);
}

function validateProductionSnapshot(
  snapshotDir: string,
  entries: SnapshotManifestEntry[],
  requiredRoles: Set<string>,
  manifestPresent: boolean,
  transcriptPersistence: "required" | "privacy_disabled"
): void {
  if (![...["sqlite", "global_sessions"]].every((role) => requiredRoles.has(role))) {
    throw new Error("生产快照未声明基础恢复角色");
  }
  const supportedRoles = new Set([
    "sqlite",
    "profile",
    "global_sessions",
    "project_foundation",
    "project_knowledge",
    "project_sessions"
  ]);
  if (entries.some((entry) => !supportedRoles.has(entry.role))) {
    throw new Error("生产快照含不支持的恢复角色");
  }
  const expectedChildren = new Set([
    ...entries.map((entry) => entry.destination),
    ...(manifestPresent ? ["snapshot-manifest.json"] : [])
  ]);
  if (readdirSync(snapshotDir).some((name) => !expectedChildren.has(name))) {
    throw new Error("生产快照含 manifest 外额外条目");
  }
  const sqliteEntries = entries.filter((entry) => entry.role === "sqlite");
  const globalSessions = entries.filter((entry) => entry.role === "global_sessions");
  const profiles = entries.filter((entry) => entry.role === "profile");
  if (sqliteEntries.length !== 1 || globalSessions.length !== 1 || profiles.length > 1) {
    throw new Error("生产快照基础角色数量非法");
  }
  const sessionsDir = join(snapshotDir, globalSessions[0]!.destination);
  if (!statSync(sessionsDir).isDirectory()) throw new Error("全局 sessions 不是目录");
  const snapshotDb = new Database(join(snapshotDir, sqliteEntries[0]!.destination), {
    readonly: true,
    fileMustExist: true
  });
  let activeProjectIds: Set<string>;
  let transcriptFiles: Set<string>;
  try {
    if (snapshotDb.pragma("quick_check", { simple: true }) !== "ok") {
      throw new Error("SQLite 快照 quick_check 失败");
    }
    activeProjectIds = new Set(
      (
        snapshotDb
          .prepare("SELECT id FROM projects WHERE status='active' ORDER BY id")
          .all() as { id: string }[]
      ).map((row) => row.id)
    );
    const transcriptRows = snapshotDb.prepare("SELECT transcript_path FROM sessions ORDER BY id").all() as {
      transcript_path: string;
    }[];
    transcriptFiles = new Set(
      transcriptRows.map((row) => {
        const name = basename(row.transcript_path);
        const lastSeg = row.transcript_path.replaceAll("\\", "/").split("/").at(-1);
        if (name !== lastSeg || !name.endsWith(".jsonl")) {
          throw new Error("session transcript_path 非法");
        }
        return name;
      })
    );
    if (transcriptFiles.size !== transcriptRows.length) {
      throw new Error("多个 session 复用同一 transcript_path");
    }
  } finally {
    snapshotDb.close();
  }
  const sessionChildren = readdirSync(sessionsDir);
  if (sessionChildren.some((name) => !lstatSync(join(sessionsDir, name)).isFile())) {
    throw new Error("全局 sessions 含非文件条目");
  }
  const actualTranscriptFiles = new Set(sessionChildren);
  if ([...actualTranscriptFiles].some((name) => !transcriptFiles.has(name))) {
    throw new Error("全局 JSONL 存在无 SQLite session 对应的文件");
  }
  if (
    transcriptPersistence === "required" &&
    (transcriptFiles.size !== actualTranscriptFiles.size ||
      [...transcriptFiles].some((name) => !actualTranscriptFiles.has(name)))
  ) {
    throw new Error("store_transcript=true 时 SQLite session 缺少 JSONL");
  }
  const projectEntries = entries.filter((entry) =>
    ["project_foundation", "project_knowledge", "project_sessions"].includes(entry.role)
  );
  if (
    projectEntries.some(
      (entry) => !entry.projectId || !activeProjectIds.has(entry.projectId)
    )
  ) {
    throw new Error("生产快照含非 active 项目恢复角色");
  }
  for (const projectId of activeProjectIds) {
    const foundations = entries.filter(
      (entry) => entry.role === "project_foundation" && entry.projectId === projectId
    );
    const knowledgeEntries = entries.filter(
      (entry) => entry.role === "project_knowledge" && entry.projectId === projectId
    );
    const projectSessions = entries.filter(
      (entry) => entry.role === "project_sessions" && entry.projectId === projectId
    );
    if (foundations.length !== 1 || knowledgeEntries.length !== 1 || projectSessions.length > 1) {
      throw new Error(`active 项目恢复角色数量非法:${projectId}`);
    }
    const foundationDir = join(snapshotDir, foundations[0]!.destination);
    const foundationPointerPath = join(foundationDir, "current.json");
    if (
      !lstatSync(foundationDir).isDirectory() ||
      !lstatSync(foundationPointerPath).isFile()
    ) {
      throw new Error(`foundation pointer 不是快照内 regular file:${projectId}`);
    }
    const pointer = JSON.parse(readFileSync(foundationPointerPath, "utf8")) as {
      generation?: number;
      manifest?: string;
    };
    if (
      !Number.isInteger(pointer.generation) ||
      (pointer.generation ?? 0) < 1 ||
      typeof pointer.manifest !== "string" ||
      basename(pointer.manifest) !== pointer.manifest
    ) {
      throw new Error(`foundation current.json 非法:${projectId}`);
    }
    const foundationManifestPath = join(foundationDir, pointer.manifest);
    if (!lstatSync(foundationManifestPath).isFile()) {
      throw new Error(`foundation manifest 不是快照内 regular file:${projectId}`);
    }
    const foundationManifest = JSON.parse(readFileSync(foundationManifestPath, "utf8")) as {
      generation?: number;
      status?: string;
    };
    if (
      foundationManifest.generation !== pointer.generation ||
      foundationManifest.status !== "complete"
    ) {
      throw new Error(`foundation generation 非 complete:${projectId}`);
    }
    const knowledgeDir = join(snapshotDir, knowledgeEntries[0]!.destination);
    const knowledgeCurrent = join(knowledgeDir, "current");
    const knowledgeGeneration = join(knowledgeDir, `gen-${pointer.generation}`);
    if (
      !existsSync(knowledgeCurrent) ||
      !lstatSync(knowledgeCurrent).isSymbolicLink() ||
      readlinkSync(knowledgeCurrent) !== `gen-${pointer.generation}` ||
      !lstatSync(knowledgeGeneration).isDirectory() ||
      ["core.md", "inventory.md", "build-test-run.md", "conventions.md"].some(
        (name) => !lstatSync(join(knowledgeGeneration, name)).isFile()
      )
    ) {
      throw new Error(`knowledge generation 不可消费:${projectId}`);
    }
  }
}

export async function runSnapshotBackup(opts: SnapshotOptions): Promise<SnapshotResult> {
  if (!Number.isFinite(opts.retentionDays) || opts.retentionDays <= 0) {
    throw new Error("retentionDays 必须是大于 0 的有限数");
  }
  const now = (opts.now ?? (() => new Date()))();
  const snapshotDir = join(opts.backupRoot, stampFor(now));
  const stagingDir = `${snapshotDir}.partial`;
  mkdirSync(opts.backupRoot, { recursive: true });
  const copied: string[] = [];
  const skipped: string[] = [];
  const entries: SnapshotManifestEntry[] = [];
  let backupError: unknown;
  let stagingCreated = false;

  try {
    if (existsSync(snapshotDir) || existsSync(stagingDir)) {
      throw new Error(`快照目录已存在:${snapshotDir}`);
    }
    mkdirSync(stagingDir);
    stagingCreated = true;
    // SQLite 在线备份(better-sqlite3 backup API;串行,库通常只有一个)
    for (const s of opts.sqlite ?? []) {
      const dest = join(stagingDir, s.destName);
      await s.db.backup(dest);
      // backup() 会继承 WAL journal_mode，并可能在副本旁留下空 wal/shm。发布前将副本
      // 规范化为单文件恢复点，再以同一连接做 quick_check。
      const copiedDb = new Database(dest);
      try {
        copiedDb.pragma("journal_mode = DELETE");
        const quickCheck = copiedDb.pragma("quick_check", { simple: true });
        if (quickCheck !== "ok") throw new Error(`SQLite 快照 quick_check 失败:${s.destName}`);
      } finally {
        copiedDb.close();
      }
      rmSync(`${dest}-wal`, { force: true });
      rmSync(`${dest}-shm`, { force: true });
      const copiedFingerprint = fingerprint(dest);
      copied.push(`sqlite:${s.destName}`);
      entries.push({
        kind: "sqlite",
        role: "sqlite",
        source: s.destName,
        destination: s.destName,
        sha256: copiedFingerprint.sha256,
        bytes: copiedFingerprint.bytes
      });
    }

    opts.afterSqliteBackup?.();
    const resolvedSources = opts.resolveSources?.(stagingDir) ?? [];
    const seen = new Map<string, number>();
    const requiredRoles = new Set(opts.requiredRoles ?? []);
    for (const input of [...opts.sources, ...resolvedSources]) {
      const source: SnapshotSource =
        typeof input === "string" ? { path: input, role: "path" } : input;
      if (source.required) requiredRoles.add(source.role);
      if (!existsSync(source.path)) {
        if (source.required) throw new Error(`必需备份源不存在:${source.path}`);
        skipped.push(source.path);
        continue;
      }
      const realSource = realpathSync(source.path);
      const sourceFingerprint = fingerprint(realSource);
      // basename 冲突时追加序号,防不同 workspace 的同名目录互相覆盖
      const base = basename(source.path);
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      const destName = n === 0 ? base : `${base}.${n}`;
      const dest = join(stagingDir, destName);
      cpSync(realSource, dest, { recursive: true, verbatimSymlinks: true });
      const copiedFingerprint = fingerprint(dest);
      if (
        sourceFingerprint.sha256 !== copiedFingerprint.sha256 ||
        sourceFingerprint.bytes !== copiedFingerprint.bytes
      ) {
        throw new Error(`备份副本校验失败:${realSource}`);
      }
      copied.push(realSource);
      entries.push({
        kind: "path",
        role: source.role,
        ...(source.projectId ? { projectId: source.projectId } : {}),
        source: realSource,
        destination: destName,
        sha256: copiedFingerprint.sha256,
        bytes: copiedFingerprint.bytes
      });
    }
    const presentRoles = new Set(entries.map((entry) => entry.role));
    for (const requiredRole of requiredRoles) {
      if (!presentRoles.has(requiredRole)) throw new Error(`生产快照缺少必需角色:${requiredRole}`);
    }
    if (requiredRoles.has("sqlite") || requiredRoles.has("global_sessions")) {
      validateProductionSnapshot(
        stagingDir,
        entries,
        requiredRoles,
        false,
        opts.transcriptPersistence ?? "required"
      );
    }

    writeFileSync(
      join(stagingDir, "snapshot-manifest.json"),
      `${JSON.stringify(
        {
          schemaVersion: 2,
          digestAlgorithm: SNAPSHOT_DIGEST_ALGORITHM,
          createdAt: now.toISOString(),
          completed: true,
          transcriptPersistence: opts.transcriptPersistence ?? "required",
          requiredRoles: [...requiredRoles].sort(),
          entries,
          skipped
        },
        null,
        2
      )}\n`
    );
    renameSync(stagingDir, snapshotDir);
  } catch (error) {
    if (stagingCreated) rmSync(stagingDir, { recursive: true, force: true });
    backupError = error;
  }

  let pruned: string[];
  try {
    // 与快照发布解耦:即使本轮复制失败，也治理过期完整快照和崩溃遗留 partial。
    pruned = reconcileSnapshotRetention(opts.backupRoot, opts.retentionDays, now);
  } catch (retentionError) {
    if (backupError !== undefined) {
      throw new AggregateError([backupError, retentionError], "快照与保留期治理均失败");
    }
    throw retentionError;
  }
  if (backupError !== undefined) throw backupError;

  return { snapshotDir, copied, skipped, pruned };
}

/** 每轮独立治理保留期；崩溃遗留 partial 与同时间戳完整快照采用同一截止规则。 */
export function reconcileSnapshotRetention(
  backupRoot: string,
  retentionDays: number,
  now = new Date()
): string[] {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    throw new Error("retentionDays 必须是大于 0 的有限数");
  }
  mkdirSync(backupRoot, { recursive: true });
  const cutoff = now.getTime() - retentionDays * DAY_MS;
  const pruned: string[] = [];
  for (const entry of readdirSync(backupRoot).sort()) {
    const full = join(backupRoot, entry);
    if (!lstatSync(full).isDirectory()) continue;
    const stamp = entry.endsWith(".partial") ? entry.slice(0, -".partial".length) : entry;
    const ts = parseStamp(stamp);
    if (ts && ts.getTime() < cutoff) {
      rmSync(full, { recursive: true, force: true });
      pruned.push(entry);
    }
  }
  return pruned;
}

/** 生产备份纳入所有 active 本地项目；无 path 的 pending/draft 项目不构成可备份 workspace。 */
export function activeWorkspaceSources(db: Db): SnapshotSource[] {
  const rows = db.prepare("SELECT id, workspace_json FROM projects WHERE status='active' ORDER BY id").all() as {
    id: string;
    workspace_json: string;
  }[];
  const sources: SnapshotSource[] = [];
  for (const row of rows) {
    const workspace = JSON.parse(row.workspace_json) as { kind?: string };
    if (workspace.kind !== "local_folder") {
      throw new Error(`active 项目 workspace 暂不支持备份:${row.id}`);
    }
    const verified = verifiedProjectWorkspace(db, row.id);
    if (!verified) {
      throw new Error(`active 项目 workspace 缺少路径:${row.id}`);
    }
    if (!isAbsolute(verified)) throw new Error(`active 项目 workspace 不是绝对路径:${row.id}`);
    const workspacePath = realpathSync(resolve(verified));
    if (!statSync(workspacePath).isDirectory()) throw new Error(`active 项目 workspace 不是目录:${row.id}`);
    sources.push({
      path: join(workspacePath, ".saydo", "foundation"),
      role: "project_foundation",
      required: true,
      projectId: row.id
    });
    sources.push({
      path: join(workspacePath, ".saydo", "knowledge"),
      role: "project_knowledge",
      required: true,
      projectId: row.id
    });
    sources.push({
      path: join(workspacePath, ".saydo", "sessions"),
      role: "project_sessions",
      projectId: row.id
    });
  }
  return sources;
}

/** 手工与定时生产调用共用的全局源；workspace 必须从 SQLite 副本解析。 */
export function productionBaseSources(saydoHome: string): SnapshotSource[] {
  return [
    { path: join(saydoHome, "profile.md"), role: "profile" },
    { path: join(saydoHome, "sessions"), role: "global_sessions", required: true }
  ];
}

/** 从本轮在线备份得到的 SQLite 副本解析 active workspace，保证数据库与文件源同一备份点。 */
export function productionWorkspaceSourcesFromSnapshot(
  stagingDir: string,
  destName = "saydo.db"
): SnapshotSource[] {
  const snapshotDbPath = join(stagingDir, destName);
  if (!existsSync(snapshotDbPath)) throw new Error(`生产快照缺少 SQLite 副本:${snapshotDbPath}`);
  const snapshotDb = new Database(snapshotDbPath, { readonly: true, fileMustExist: true });
  try {
    return activeWorkspaceSources(snapshotDb as unknown as Db);
  } finally {
    snapshotDb.close();
  }
}

/** 启动补跑判定:只认含 completed v2 manifest 的最终目录。 */
export function isSnapshotBackupDue(
  backupRoot: string,
  intervalMs = DAY_MS,
  now = new Date()
): boolean {
  if (!existsSync(backupRoot)) return true;
  let latest = Number.NEGATIVE_INFINITY;
  for (const entry of readdirSync(backupRoot)) {
    const ts = parseStamp(entry);
    if (!ts) continue;
    try {
      const snapshotDir = join(backupRoot, entry);
      const manifest = JSON.parse(readFileSync(join(snapshotDir, "snapshot-manifest.json"), "utf8")) as {
        schemaVersion?: number;
        digestAlgorithm?: string;
        completed?: boolean;
        requiredRoles?: string[];
        entries?: SnapshotManifestEntry[];
        transcriptPersistence?: "required" | "privacy_disabled";
      };
      if (
        manifest.schemaVersion !== 2 ||
        manifest.digestAlgorithm !== SNAPSHOT_DIGEST_ALGORITHM ||
        manifest.completed !== true ||
        !Array.isArray(manifest.requiredRoles) ||
        !Array.isArray(manifest.entries) ||
        (manifest.transcriptPersistence !== undefined &&
          !["required", "privacy_disabled"].includes(manifest.transcriptPersistence)) ||
        !["sqlite", "global_sessions"].every((role) => manifest.requiredRoles?.includes(role))
      ) {
        continue;
      }
      const destinations = new Set<string>();
      let valid = true;
      for (const manifestEntry of manifest.entries) {
        if (
          typeof manifestEntry.destination !== "string" ||
          basename(manifestEntry.destination) !== manifestEntry.destination ||
          destinations.has(manifestEntry.destination)
        ) {
          valid = false;
          break;
        }
        destinations.add(manifestEntry.destination);
        const destination = join(snapshotDir, manifestEntry.destination);
        if (!existsSync(destination) || lstatSync(destination).isSymbolicLink()) {
          valid = false;
          break;
        }
        const actual = fingerprint(destination);
        if (actual.sha256 !== manifestEntry.sha256 || actual.bytes !== manifestEntry.bytes) {
          valid = false;
          break;
        }
      }
      const roles = new Set(manifest.entries.map((manifestEntry) => manifestEntry.role));
      if (!valid || !manifest.requiredRoles.every((role) => roles.has(role))) continue;
      const sqliteEntries = manifest.entries.filter((manifestEntry) => manifestEntry.role === "sqlite");
      const globalSessions = manifest.entries.filter(
        (manifestEntry) => manifestEntry.role === "global_sessions"
      );
      if (sqliteEntries.length !== 1 || globalSessions.length !== 1) continue;
      const snapshotDb = new Database(join(snapshotDir, sqliteEntries[0]!.destination), {
        readonly: true,
        fileMustExist: true
      });
      let activeProjectIds: Set<string>;
      try {
        if (snapshotDb.pragma("quick_check", { simple: true }) !== "ok") continue;
        activeProjectIds = new Set(
          (
            snapshotDb
              .prepare("SELECT id FROM projects WHERE status='active' ORDER BY id")
              .all() as { id: string }[]
          ).map((row) => row.id)
        );
      } finally {
        snapshotDb.close();
      }
      const projectEntries = manifest.entries.filter((manifestEntry) =>
        ["project_foundation", "project_knowledge", "project_sessions"].includes(
          manifestEntry.role
        )
      );
      if (
        projectEntries.some(
          (manifestEntry) =>
            !manifestEntry.projectId || !activeProjectIds.has(manifestEntry.projectId)
        )
      ) {
        continue;
      }
      for (const projectId of activeProjectIds) {
        const foundations = manifest.entries.filter(
          (manifestEntry) =>
            manifestEntry.role === "project_foundation" &&
            manifestEntry.projectId === projectId
        );
        const knowledgeEntries = manifest.entries.filter(
          (manifestEntry) =>
            manifestEntry.role === "project_knowledge" &&
            manifestEntry.projectId === projectId
        );
        const projectSessions = manifest.entries.filter(
          (manifestEntry) =>
            manifestEntry.role === "project_sessions" &&
            manifestEntry.projectId === projectId
        );
        if (
          foundations.length !== 1 ||
          knowledgeEntries.length !== 1 ||
          projectSessions.length > 1
        ) {
          valid = false;
          break;
        }
        const foundationDir = join(snapshotDir, foundations[0]!.destination);
        const pointer = JSON.parse(
          readFileSync(join(foundationDir, "current.json"), "utf8")
        ) as { generation?: number; manifest?: string };
        if (
          !Number.isInteger(pointer.generation) ||
          typeof pointer.manifest !== "string" ||
          basename(pointer.manifest) !== pointer.manifest
        ) {
          valid = false;
          break;
        }
        const foundationManifest = JSON.parse(
          readFileSync(join(foundationDir, pointer.manifest), "utf8")
        ) as { generation?: number; status?: string };
        const knowledgeDir = join(snapshotDir, knowledgeEntries[0]!.destination);
        const knowledgeCurrent = join(knowledgeDir, "current");
        const knowledgeGeneration = join(knowledgeDir, `gen-${pointer.generation}`);
        if (
          foundationManifest.generation !== pointer.generation ||
          foundationManifest.status !== "complete" ||
          !existsSync(knowledgeCurrent) ||
          !lstatSync(knowledgeCurrent).isSymbolicLink() ||
          readlinkSync(knowledgeCurrent) !== `gen-${pointer.generation}` ||
          !lstatSync(knowledgeGeneration).isDirectory() ||
          !lstatSync(join(knowledgeGeneration, "core.md")).isFile()
        ) {
          valid = false;
          break;
        }
      }
      if (valid) {
        validateProductionSnapshot(
          snapshotDir,
          manifest.entries,
          new Set(manifest.requiredRoles),
          true,
          manifest.transcriptPersistence ?? "required"
        );
        latest = Math.max(latest, ts.getTime());
      }
    } catch {
      // 不完整目录不构成成功备份。
    }
  }
  return now.getTime() - latest >= intervalMs;
}
