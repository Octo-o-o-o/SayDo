// daemon 快照器(09 §4.1;3.2):不可变源快照捕获,evaluator 只收摘录、不自由浏览文件。
// TOCTOU 捕获纪律:文件源 O_NOFOLLOW 打开(symlink 拒),fstat 前后校验未变,一次读取同时得
// digest 与正文;临时文件 + fsync + 原子 rename 落 bodyPath;最后插 DB 行(先正文后行——
// 崩溃孤儿 = 有正文无行,scanOrphans 确定性清理)。
// P0 支持:repo_file(git blob,天然不可变)/ user_edit(本地文件)/ user_utterance(转写行)。
// web/artifact 显式 unsupported(fail-closed:critical claim 以其为源 ⇒ snapshot_missing ⇒ unknown 阻塞;
// artifact 随 3.3 B4 落地补,web 的 SSRF 边界随真实消费出现补)。

import { execFileSync } from "node:child_process";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { newId, textDigest, type SourceRef, type SourceSnapshot } from "@saydo/contracts";
import { fsyncFile, hostKind } from "@saydo/platform";
import type { Db } from "../storage/db.js";
import { insertSourceSnapshot } from "../storage/dao/sourceSnapshots.js";

export const SNAPSHOTTER_VERSION = "snapshotter/0.1.0";

export interface SnapshotterDeps {
  db: Db;
  /** <workspace>/.saydo */
  saydoDir: string;
  /** 项目工作区(repo_file 的 git 与 live 读取根) */
  workspace: string;
  now?: () => Date;
}

export class UnsupportedSourceError extends Error {
  constructor(kind: string) {
    super(`snapshot capture unsupported for source.kind=${kind} (fail-closed: verification will block)`);
  }
}

export class Snapshotter {
  private readonly deps: Required<Omit<SnapshotterDeps, "now">> & { now: () => Date };

  constructor(deps: SnapshotterDeps) {
    this.deps = { ...deps, now: deps.now ?? (() => new Date()) };
  }

  private snapshotsDir(): string {
    return join(this.deps.saydoDir, "snapshots");
  }

  /** 捕获不可变快照(§4.1 捕获纪律);返回落库后的 SourceSnapshot */
  capture(source: SourceRef): SourceSnapshot {
    switch (source.kind) {
      case "repo_file":
        return this.captureGitBlob(source);
      case "user_edit": {
        // ref = "<path>@<ts>":lastIndexOf 与 repo_file 一致(评审 B-8:防文件名含 @ 误裁)
        const at = source.ref.lastIndexOf("@");
        return this.captureLocalFile(source, at > 0 ? source.ref.slice(0, at) : source.ref);
      }
      case "user_utterance":
        return this.captureTranscriptTurn(source);
      default:
        throw new UnsupportedSourceError(source.kind);
    }
  }

  /** repo_file:ref = "<path>@<commit>";git blob 天然不可变,免二次校验 */
  private captureGitBlob(source: SourceRef): SourceSnapshot {
    const at = source.ref.lastIndexOf("@");
    if (at <= 0) throw new Error(`repo_file ref must be "<path>@<commit>", got ${source.ref}`);
    const path = source.ref.slice(0, at);
    const commit = source.ref.slice(at + 1);
    // 评审 B-8:commit 白名单(hex oid,非空)——空 commit 会读可变 index、"-"前缀进 option 面;
    // 不可变定位语义要求解析后的 oid,分支名不收
    if (!/^[0-9a-f]{7,40}$/i.test(commit)) {
      throw new Error(`repo_file commit must be a hex oid (immutable locator), got "${commit}"`);
    }
    const body = execFileSync("git", ["cat-file", "-p", "--end-of-options", `${commit}:${path}`], {
      cwd: this.deps.workspace,
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024
    });
    return this.publish(source, body, `git:${commit}:${path}`, join(this.deps.workspace, path));
  }

  /** 本地文件:O_NOFOLLOW 打开(symlink 拒,ELOOP),fstat 前后校验(读中被换文件 ⇒ 捕获失败不产快照) */
  private captureLocalFile(source: SourceRef, path: string): SourceSnapshot {
    const abs = isAbsolute(path) ? path : join(this.deps.workspace, path);
    // 评审 B-4:workspace 边界断言(realpath 全路径解析,挡 ../ 穿越与目录级 symlink 外逃——
    // 否则被注入的 Brain 构造 ref 即可把 ~/.ssh 等吸入快照并经深评 prompt 外传)
    const rootReal = realpathSync(this.deps.workspace);
    let parentReal: string;
    try {
      parentReal = realpathSync(join(abs, ".."));
    } catch (err) {
      throw new Error(`capture path unresolvable: ${abs} (${String(err).slice(0, 80)})`);
    }
    const relParent = relative(rootReal, parentReal);
    if (relParent.startsWith("..") || isAbsolute(relParent)) {
      throw new Error(`capture path escapes workspace: ${abs}`);
    }
    if (hostKind() === "win32") {
      const st = lstatSync(abs);
      if (st.isSymbolicLink()) throw new Error(`capture refuses symlink: ${abs}`);
    }
    const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
    const fd = openSync(abs, constants.O_RDONLY | noFollow);
    try {
      const before = fstatSync(fd);
      if (before.size > 4 * 1024 * 1024) throw new Error(`capture file too large: ${before.size}B (limit 4MB)`);
      const buf = Buffer.alloc(before.size);
      let off = 0;
      while (off < before.size) {
        const n = readSync(fd, buf, off, before.size - off, off);
        if (n === 0) break;
        off += n;
      }
      const after = fstatSync(fd);
      if (after.ino !== before.ino || after.size !== before.size || after.mtimeMs !== before.mtimeMs) {
        throw new Error(`TOCTOU: file changed during capture: ${abs}`);
      }
      const body = buf.subarray(0, off).toString("utf8");
      return this.publish(source, body, `${realpathSync(abs)}@${this.deps.now().toISOString()}`, abs);
    } finally {
      closeSync(fd);
    }
  }

  /** user_utterance:ref = 裸 turnId(09 §4 SourceRef 口径,ULID 全局唯一);从 sessions/<id>.jsonl
   *  找该 turn 行(转写是持久源),产出 snapshotLocator="transcript:<sessionId>#<turnId>"(09 §4.1)。
   *  W1.8 口径统一(Codex 18 A-2):locator 形态误写进 ref 处方化拒收,不静默兼容双形态。 */
  private captureTranscriptTurn(source: SourceRef): SourceSnapshot {
    if (source.ref.startsWith("transcript:")) {
      throw new Error(
        `user_utterance ref must be a bare turnId (09 §4), got snapshotLocator-shaped "${source.ref}" — ` +
          `"transcript:<sessionId>#<turnId>" is the snapshot output locator (09 §4.1), not the input ref`
      );
    }
    const sessionsDir = join(this.deps.saydoDir, "sessions");
    let hit: { sessionId: string; line: string } | undefined;
    for (const f of readdirSync(sessionsDir).sort()) {
      if (!f.endsWith(".jsonl")) continue;
      for (const line of readFileSync(join(sessionsDir, f), "utf8").split("\n")) {
        if (line.includes(`"${source.ref}"`)) {
          hit = { sessionId: f.replace(/\.jsonl$/, ""), line };
          break;
        }
      }
      if (hit) break;
    }
    if (!hit) throw new Error(`transcript turn not found: ${source.ref}`);
    const turn = JSON.parse(hit.line) as { turnId: string; text: string };
    if (turn.turnId !== source.ref) throw new Error(`transcript turn mismatch: ${source.ref}`);
    return this.publish(
      source,
      turn.text,
      `transcript:${hit.sessionId}#${source.ref}`,
      join(sessionsDir, `${hit.sessionId}.jsonl`)
    );
  }

  /** 落盘纪律:临时文件 -> fsync -> 原子 rename -> 插 DB 行(先正文后行) */
  private publish(source: SourceRef, body: string, snapshotLocator: string, liveLocator: string): SourceSnapshot {
    const id = newId("snp");
    mkdirSync(this.snapshotsDir(), { recursive: true });
    const bodyPath = join(this.snapshotsDir(), id);
    const tmp = `${bodyPath}.tmp`;
    writeFileSync(tmp, body);
    fsyncFile(tmp);
    renameSync(tmp, bodyPath);
    const snap: SourceSnapshot = {
      id,
      source,
      snapshotLocator,
      liveLocator,
      contentDigest: textDigest(body),
      encoding: "utf-8",
      bodyPath,
      capturedAt: this.deps.now().toISOString(),
      resolver: { name: "daemon-snapshotter", version: SNAPSHOTTER_VERSION }
    };
    insertSourceSnapshot(this.deps.db, snap);
    return snap;
  }

  /** 崩溃孤儿清理(有正文无 DB 行 ⇒ 删;确定性,§4.1 捕获纪律) */
  scanOrphans(): number {
    const dir = this.snapshotsDir();
    let removed = 0;
    let files: string[];
    try {
      files = readdirSync(dir);
    } catch {
      return 0;
    }
    for (const f of files) {
      if (f.endsWith(".tmp")) {
        rmSync(join(dir, f), { force: true });
        removed += 1;
        continue;
      }
      const row = this.deps.db.prepare("SELECT 1 FROM source_snapshots WHERE id = ?").get(f);
      if (!row) {
        rmSync(join(dir, f), { force: true });
        removed += 1;
      }
    }
    return removed;
  }
}
