// AS-02 私有 write set 的 create-only ignore 与实际保护验证。
// 查询封闭集 GIT_PROTECTION_QUERIES;git -C <workspace> 覆盖 worktree 的 .git 文件。
// 不覆盖用户已有 ignore、不 git rm、不清历史。

import { execFileSync } from "node:child_process";
import {
  accessSync,
  closeSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  unlinkSync,
  writeSync
} from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";
import {
  GIT_PROTECTION_QUERIES,
  gitProtectionResultSchema,
  isSafeRelativeSource,
  KNOWLEDGE_PRIVACY_LIMITS,
  PRIVATE_WRITE_SET,
  type GitProtectionResult
} from "@saydo/contracts";

export const GIT_PROTECTION_INSUFFICIENT_CODE = "git_protection_insufficient" as const;

/** 10 TTS:Git 保护不足。主文案不含绝对路径。 */
export const GIT_PROTECTION_INSUFFICIENT_MESSAGE = "这次私有知识没写进去,Git 还没保护好,屏幕上有做法,我不会替你改仓库";

const IGNORE_RELATIVE = ".saydo/.gitignore";
const SAYDO_DIR = ".saydo";
const SYMLINK_TARGETS = [SAYDO_DIR, ".saydo/foundation", ".saydo/knowledge"] as const;

/** `.saydo/.gitignore` 最小规则:相对该文件目录覆盖 PRIVATE_WRITE_SET。 */
const MINIMAL_IGNORE =
  ["# SayDo private write set (create-only)", "/foundation/", "/knowledge/", ""].join("\n");

export class GitProtectionInsufficientError extends Error {
  readonly code = GIT_PROTECTION_INSUFFICIENT_CODE;
  readonly gitProtection: GitProtectionResult;
  readonly prescription = "fix_git_ignore_or_untrack" as const;

  constructor(result: GitProtectionResult, message = GIT_PROTECTION_INSUFFICIENT_MESSAGE) {
    super(message);
    this.name = "GitProtectionInsufficientError";
    this.gitProtection = gitProtectionResultSchema.parse(result);
  }
}

export function isGitProtectionInsufficientError(err: unknown): err is GitProtectionInsufficientError {
  if (err instanceof GitProtectionInsufficientError) return true;
  if (!(err instanceof Error)) return false;
  return (err as { code?: unknown }).code === GIT_PROTECTION_INSUFFICIENT_CODE;
}

export interface GitProtectionDeps {
  /** 每次即将发起保护查询时调用;用于边界 Git 总数记账。抛错由调用方处理。 */
  noteGitCall?: () => void;
}

interface GitRun {
  status: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  bufferExceeded: boolean;
  notGit: boolean;
}

function posixRelative(rel: string): string {
  return rel.split(sep).join("/");
}

function isInsideWorkspace(workspaceReal: string, targetReal: string): boolean {
  if (targetReal === workspaceReal) return true;
  const rel = relative(workspaceReal, targetReal);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

function symlinkEscapes(workspaceReal: string, abs: string): boolean {
  try {
    if (!existsSync(abs)) return false;
    if (!lstatSync(abs).isSymbolicLink()) return false;
    const real = realpathSync(abs);
    return !isInsideWorkspace(workspaceReal, real);
  } catch {
    return false;
  }
}

function result(status: GitProtectionResult["status"], relativeTarget?: string): GitProtectionResult {
  const parsed = gitProtectionResultSchema.safeParse(
    relativeTarget === undefined ? { status } : { status, relativeTarget }
  );
  if (parsed.success) return parsed.data;
  return gitProtectionResultSchema.parse({ status });
}

function errnoCode(err: unknown): string {
  return typeof (err as { code?: unknown }).code === "string" ? ((err as { code: string }).code) : "";
}

function absoluteFromPosix(workspace: string, posix: string): string {
  return join(workspace, ...posix.split("/"));
}

function noFollowFlag(): number {
  return typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
}

/**
 * 私有 write set 最终叶子写入守卫:lstat,不跟随。
 * 不存在或常规文件 => protected(可写);symlink 且 realpath 逃出 workspace => outside_root;
 * 根内 symlink 或非常规文件 => write_failed。不发起 Git 子进程。
 */
export function guardPrivateLeaf(workspace: string, relativeLeaf: string): GitProtectionResult {
  const posix = posixRelative(relativeLeaf);
  if (!isSafeRelativeSource(posix)) return result("write_failed");

  let workspaceReal: string;
  try {
    workspaceReal = realpathSync(workspace);
  } catch {
    return result("query_failed");
  }

  const abs = absoluteFromPosix(workspace, posix);
  let st: ReturnType<typeof lstatSync>;
  try {
    st = lstatSync(abs);
  } catch (err) {
    if (errnoCode(err) === "ENOENT") return result("protected");
    return result("write_failed", posix);
  }

  if (st.isSymbolicLink()) {
    let targetReal: string;
    try {
      targetReal = realpathSync(abs);
    } catch {
      return result("write_failed", posix);
    }
    if (!isInsideWorkspace(workspaceReal, targetReal)) return result("outside_root", posix);
    return result("write_failed", posix);
  }

  if (!st.isFile()) return result("write_failed", posix);
  return result("protected");
}

function dirWriteMode(): number {
  const write = typeof constants.W_OK === "number" ? constants.W_OK : 2;
  const exec = typeof constants.X_OK === "number" ? constants.X_OK : 1;
  return write | exec;
}

function posixDir(relativeDir: string): string {
  return posixRelative(relativeDir).replace(/\/$/u, "");
}

function ancestorPosix(posix: string): string {
  const idx = posix.lastIndexOf("/");
  return idx <= 0 ? "" : posix.slice(0, idx);
}

/**
 * 私有 write set 目录创建/可写守卫:lstat,不跟随。
 * 不存在则检查最近已存在祖先可写;已存在非目录 / 权限不足 => write_failed;
 * symlink 逃出根 => outside_root;根内目录 symlink => write_failed。
 */
export function guardPrivateDir(workspace: string, relativeDir: string): GitProtectionResult {
  const posix = posixDir(relativeDir);
  if (!isSafeRelativeSource(posix)) return result("write_failed");

  let workspaceReal: string;
  try {
    workspaceReal = realpathSync(workspace);
  } catch {
    return result("query_failed");
  }

  const parts = posix.split("/");
  let abs = workspace;
  let acc = "";
  for (const part of parts) {
    abs = join(abs, part);
    acc = acc === "" ? part : `${acc}/${part}`;
    let st: ReturnType<typeof lstatSync>;
    try {
      st = lstatSync(abs);
    } catch (err) {
      if (errnoCode(err) !== "ENOENT") return result("write_failed", acc);
      const parent = ancestorPosix(acc);
      if (parent === "") {
        try {
          accessSync(workspace, dirWriteMode());
          return result("protected");
        } catch {
          return result("write_failed", acc);
        }
      }
      return guardPrivateDir(workspace, parent);
    }
    if (st.isSymbolicLink()) {
      if (symlinkEscapes(workspaceReal, abs)) return result("outside_root", acc);
      return result("write_failed", acc);
    }
    if (!st.isDirectory()) return result("write_failed", acc);
  }

  try {
    accessSync(abs, dirWriteMode());
  } catch {
    return result("write_failed", posix);
  }
  return result("protected");
}

/** mkdir/copy/rename 等目录写失败映射。symlink 逃出根仍 outside_root。 */
export function mapPrivateDirWriteError(
  workspace: string,
  relativeDir: string,
  err?: unknown
): GitProtectionResult {
  const posix = posixDir(relativeDir);
  const guarded = guardPrivateDir(workspace, posix);
  if (guarded.status !== "protected") return guarded;
  if (err !== undefined && errnoCode(err) === "EEXIST") {
    try {
      const abs = absoluteFromPosix(workspace, posix);
      const st = lstatSync(abs);
      if (st.isSymbolicLink() && symlinkEscapes(realpathSync(workspace), abs)) {
        return result("outside_root", posix);
      }
    } catch {
      // fall through
    }
  }
  return result("write_failed", posix);
}

/**
 * 守卫通过后写入;O_NOFOLLOW 可用时不跟随 symlink。exclusive 为 create-only(O_EXCL / wx)。
 * 失败不删除、不改用户已有目标。
 */
export function writePrivateLeafSync(
  workspace: string,
  relativeLeaf: string,
  contents: string,
  opts: { exclusive?: boolean } = {}
): GitProtectionResult {
  const posix = posixRelative(relativeLeaf);
  const guard = guardPrivateLeaf(workspace, posix);
  if (guard.status !== "protected") return guard;
  const abs = absoluteFromPosix(workspace, posix);
  try {
    const flags =
      constants.O_WRONLY |
      constants.O_CREAT |
      (opts.exclusive ? constants.O_EXCL : constants.O_TRUNC) |
      noFollowFlag();
    const fd = openSync(abs, flags);
    try {
      writeSync(fd, contents, null, "utf8");
    } finally {
      closeSync(fd);
    }
    return result("protected");
  } catch {
    return result("write_failed", posix);
  }
}

/** 删除 path 自身;symlink 只 unlink,不跟随目标。 */
export function removeUnfollowed(path: string): void {
  let st: ReturnType<typeof lstatSync>;
  try {
    st = lstatSync(path);
  } catch (err) {
    if (errnoCode(err) === "ENOENT") return;
    throw err;
  }
  if (st.isSymbolicLink() || !st.isDirectory()) {
    unlinkSync(path);
    return;
  }
  rmSync(path, { recursive: true, force: true });
}

function isTimeoutOrBuffer(err: unknown): { timedOut: boolean; bufferExceeded: boolean } {
  const e = err as { code?: unknown; killed?: unknown; signal?: unknown; message?: unknown };
  const code = typeof e.code === "string" ? e.code : "";
  const message = typeof e.message === "string" ? e.message : String(err);
  const timedOut =
    code === "ETIMEDOUT" || e.killed === true || (typeof e.signal === "string" && e.signal.length > 0);
  const bufferExceeded = code === "ENOBUFS" || code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER" || /maxBuffer/i.test(message);
  return { timedOut, bufferExceeded };
}

function runGit(workspace: string, args: readonly string[]): GitRun {
  try {
    const stdout = execFileSync("git", ["-C", workspace, ...args], {
      encoding: "utf8",
      timeout: KNOWLEDGE_PRIVACY_LIMITS.gitTimeoutMs,
      maxBuffer: KNOWLEDGE_PRIVACY_LIMITS.gitMaxBufferBytes,
      stdio: ["ignore", "pipe", "pipe"]
    });
    return {
      status: 0,
      stdout: typeof stdout === "string" ? stdout : String(stdout),
      stderr: "",
      timedOut: false,
      bufferExceeded: false,
      notGit: false
    };
  } catch (err) {
    const { timedOut, bufferExceeded } = isTimeoutOrBuffer(err);
    const e = err as { status?: unknown; stdout?: unknown; stderr?: unknown; message?: unknown };
    const stderr = typeof e.stderr === "string" ? e.stderr : typeof e.message === "string" ? e.message : String(err);
    const stdout = typeof e.stdout === "string" ? e.stdout : "";
    const status = typeof e.status === "number" ? e.status : 1;
    const notGit = /not a git repository/i.test(stderr);
    return { status, stdout, stderr, timedOut, bufferExceeded, notGit };
  }
}

function trackedFromLsFiles(stdout: string): boolean {
  return stdout.split("\0").some((part) => part.length > 0);
}

function ignorePath(workspace: string): string {
  return join(workspace, IGNORE_RELATIVE);
}

/**
 * 验证(必要时 create-only 写入)私有 write set 的 Git 保护。
 * 查询次数不超过 gitProtectionQueryMaxPerBoundary;不把「团队共享」当豁免。
 */
export function ensureGitProtection(workspace: string, deps: GitProtectionDeps = {}): GitProtectionResult {
  let workspaceReal: string;
  try {
    workspaceReal = realpathSync(workspace);
  } catch {
    return result("query_failed");
  }

  for (const rel of SYMLINK_TARGETS) {
    if (symlinkEscapes(workspaceReal, join(workspace, rel))) {
      return result("outside_root", posixRelative(rel));
    }
  }

  let protectionQueries = 0;
  const query = (args: readonly string[]): GitRun | GitProtectionResult => {
    protectionQueries += 1;
    if (protectionQueries > KNOWLEDGE_PRIVACY_LIMITS.gitProtectionQueryMaxPerBoundary) {
      return result("query_failed");
    }
    deps.noteGitCall?.();
    const run = runGit(workspace, args);
    if (run.timedOut || run.bufferExceeded) return result("query_failed");
    return run;
  };

  const isRun = (value: GitRun | GitProtectionResult): value is GitRun => "stdout" in value;

  let ignoredFoundation = false;
  let ignoredKnowledge = false;
  let trackedTarget: string | undefined;

  for (const args of GIT_PROTECTION_QUERIES) {
    const q = query(args);
    if (!isRun(q)) return q;

    if (args[0] === "rev-parse" && args[1] === "--is-inside-work-tree") {
      if (q.notGit) return result("not_git");
      if (q.status !== 0 || q.stdout.trim() !== "true") return result("query_failed");
      continue;
    }

    if (q.notGit) return result("query_failed");

    if (args[0] === "check-ignore") {
      const target = args[args.length - 1] as string;
      if (q.status === 0) {
        if (target === PRIVATE_WRITE_SET[0]) ignoredFoundation = true;
        if (target === PRIVATE_WRITE_SET[1]) ignoredKnowledge = true;
        continue;
      }
      if (q.status === 1) {
        // 未忽略,不是失败
        continue;
      }
      return result("query_failed");
    }

    if (args[0] === "ls-files") {
      if (q.status !== 0) return result("query_failed");
      if (trackedFromLsFiles(q.stdout)) {
        const target = args[args.length - 1] as string;
        trackedTarget = posixRelative(target.replace(/\/$/u, ""));
      }
      continue;
    }

    return result("query_failed");
  }

  if (trackedTarget !== undefined) {
    return result("insufficient", trackedTarget);
  }

  if (ignoredFoundation && ignoredKnowledge) {
    return result("protected");
  }

  const ignoreFile = ignorePath(workspace);
  const ignoreLeaf = guardPrivateLeaf(workspace, IGNORE_RELATIVE);
  if (ignoreLeaf.status !== "protected") return ignoreLeaf;
  try {
    lstatSync(ignoreFile);
    return result("insufficient", IGNORE_RELATIVE);
  } catch (err) {
    if (errnoCode(err) !== "ENOENT") return result("write_failed", IGNORE_RELATIVE);
  }

  try {
    mkdirSync(join(workspace, SAYDO_DIR), { recursive: true });
    const written = writePrivateLeafSync(workspace, IGNORE_RELATIVE, MINIMAL_IGNORE, { exclusive: true });
    if (written.status !== "protected") return written;
  } catch {
    return result("write_failed", IGNORE_RELATIVE);
  }

  // 创建后复核:读回字节确认最小规则已落盘。不再发起第 6 次 git 查询。
  try {
    const written = readFileSync(ignoreFile, "utf8");
    if (!written.includes("/foundation/") || !written.includes("/knowledge/")) {
      return result("insufficient", IGNORE_RELATIVE);
    }
  } catch {
    return result("write_failed", IGNORE_RELATIVE);
  }

  return result("protected");
}
