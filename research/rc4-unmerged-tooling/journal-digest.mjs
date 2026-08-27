#!/usr/bin/env node
// PROCESS-JOURNAL 中每个 digest-shaped 64hex 出现必须恰好分类一次。
// 身份是出现位置,不是 hash 去重。已落盘轮次正文一律不改。

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { gitBlobId } from "./git-blob-id.mjs";
import { readRepoRegularFile } from "./safe-regular-file.mjs";

export const JOURNAL_RELATIVE = "history/PROCESS-JOURNAL.md";
export const CATALOG_RELATIVE = "scripts/journal-digest-catalog.json";
export const REDACTION_MANIFEST_RELATIVE = "scripts/journal-redaction-manifest.json";
export const POLICY_SOURCE_RELATIVE = "scripts/public-text-redaction.mjs";

const PATH_BODY =
  "(?:prompts|research|docs|e2e|history|scripts|packages|logs|apps|pipeline)/[-\\w./]+\\.[A-Za-z0-9.]+|(?:HANDOFF|README|SECURITY|AGENTS)\\.md";
const HASH = "([0-9a-f]{64})";
const OPT_HASH = "`?" + HASH + "`?";
const STATS_CORE =
  "(?:([\\d,]+)\\s*行\\s*[/／,，]?\\s*)?([\\d,]+)\\s*(?:bytes)?";
const STATS_HASH =
  "([\\d,]+)\\s*行\\s*[/／,，]?\\s*([\\d,]+)\\s*bytes(?:\\s*(?:[/／,，]\\s*)?(?:SHA-256)?)?\\s*,?\\s*" + OPT_HASH;
const TOKEN_RE = /(?<![0-9a-fA-F])([0-9a-fA-F]{64})(?![0-9a-fA-F])/dg;
const LOWER_HASH_RE = /^[0-9a-f]{64}$/;
const CATEGORIES = Object.freeze([
  "checked-current",
  "checked-historical",
  "checked-redaction-map",
  "skipped-log",
  "excluded-non-artifact",
  "historical-unverifiable",
  "historical-erratum",
  "unresolved"
]);
const FROZEN_CATEGORIES = Object.freeze(CATEGORIES.filter((name) => name !== "unresolved"));
const INVENTORY_KEYS = Object.freeze([
  "offset",
  "line",
  "sha256",
  "category",
  "path",
  "lines",
  "bytes",
  "reason",
  "contextSha256"
]);
const ERRATUM_EXTRA_KEYS = Object.freeze([
  "actualPath",
  "actualLines",
  "actualBytes",
  "actualSha256",
  "commit",
  "gitBlob"
]);
const UNVERIFIABLE_REASONS = Object.freeze([
  "unreachable-intermediate",
  "bare-log-or-unpathed-digest",
  "incomplete-stats"
]);
const ERRATUM_REASONS = Object.freeze(["erratum-line-count"]);
const SKIP_REASONS = Object.freeze(["logs-not-tracked"]);
const EXCLUDED_REASONS = Object.freeze(["release-config", "sourceRevision", "release-build"]);

function defaultGitExec(args, cwd, encoding = "buffer") {
  try {
    const stdout = execFileSync("git", args, {
      cwd,
      encoding,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"]
    });
    return { ok: true, status: 0, stdout, stderr: "", signal: null };
  } catch (error) {
    return {
      ok: false,
      status: Number.isInteger(error?.status) ? error.status : null,
      stdout: error?.stdout ?? (encoding === "utf8" ? "" : Buffer.alloc(0)),
      stderr: error?.stderr ?? "",
      signal: error?.signal ?? null,
      error
    };
  }
}

let gitExecImpl = defaultGitExec;

export function setJournalGitImpl(fn) {
  gitExecImpl = typeof fn === "function" ? fn : defaultGitExec;
}

function classifyGitFailure(result, args) {
  if (result.signal || (result.status == null && result.error)) return "error";
  const status = result.status;
  const cmd = args[0];
  // 只有合同明确的“查询对象不存在”状态可当 missing;stderr 文本不得把 128 降成 missing。
  if (cmd === "ls-files" && args.includes("--error-unmatch") && status === 1) return "missing";
  if (cmd === "check-ignore" && status === 1) return "missing";
  return "error";
}

function gitResult(args, cwd, encoding = "buffer") {
  const raw = gitExecImpl(args, cwd, encoding);
  if (raw.ok) return { kind: "ok", stdout: raw.stdout, status: 0 };
  return {
    kind: classifyGitFailure(raw, args),
    status: raw.status,
    signal: raw.signal,
    stdout: raw.stdout,
    stderr: raw.stderr
  };
}

function git(args, cwd, encoding = "buffer") {
  const result = gitResult(args, cwd, encoding);
  if (result.kind === "ok") return result.stdout;
  const code = result.status ?? result.signal ?? "error";
  const error = new Error(`git ${String(args[0] ?? "query")} 失败:code=${code}`);
  error.gitKind = result.kind;
  throw error;
}

function wcLines(buf) {
  return (buf.toString("utf8").match(/\n/g) || []).length;
}

export function fingerprint(buf) {
  return {
    bytes: buf.length,
    lines: wcLines(buf),
    sha256: createHash("sha256").update(buf).digest("hex")
  };
}

function gitBlobSha1(buf) {
  return gitBlobId(buf);
}

function isReachableCommit(repo, sha) {
  const value = String(sha ?? "").toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(value)) return false;
  const listed = gitResult(["rev-list", "--all"], repo, "utf8");
  if (listed.kind !== "ok") {
    const error = new Error(`git rev-list 失败:code=${listed.status ?? listed.signal ?? "error"}`);
    error.gitKind = "error";
    throw error;
  }
  return String(listed.stdout)
    .split("\n")
    .map((row) => row.trim().toLowerCase())
    .includes(value);
}

function parseCount(value) {
  if (value == null || value === "") return null;
  return Number(String(value).replace(/,/g, ""));
}

function lineAt(text, offset) {
  return text.slice(0, offset).split("\n").length;
}

export function enumerateJournalDigestTokens(text) {
  const tokens = [];
  const copy = new RegExp(TOKEN_RE.source, "dg");
  let match;
  while ((match = copy.exec(text))) {
    const sha = match[1];
    const start = match.indices[1][0];
    tokens.push({
      offset: start,
      end: match.indices[1][1],
      sha256: sha,
      line: lineAt(text, start),
      lowercase: LOWER_HASH_RE.test(sha)
    });
  }
  return tokens;
}

export function normalizeClaimPath(raw) {
  if (raw == null) return { ok: false, reason: "missing-path" };
  const value = String(raw);
  if (value.includes("\0")) return { ok: false, reason: "nul" };
  if (isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value)) return { ok: false, reason: "absolute" };
  if (value.includes("\\")) return { ok: false, reason: "escape" };
  const posix = value.replaceAll("\\", "/");
  const parts = posix.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    return { ok: false, reason: "escape" };
  }
  return { ok: true, path: parts.join("/") };
}

function logsRoot(repo) {
  return resolve(repo, "logs") + sep;
}

export function proveSkippedLog(repo, rawPath) {
  const normalized = normalizeClaimPath(rawPath);
  if (!normalized.ok) return { skip: false, reason: normalized.reason };
  const path = normalized.path;
  if (path === "logs" || path === "logs/") return { skip: false, reason: "bare-logs" };
  if (!path.startsWith("logs/")) return { skip: false, reason: "not-logs" };
  const rest = path.slice("logs/".length);
  if (rest === "" || rest.endsWith("/")) return { skip: false, reason: "bare-logs" };
  const absolute = resolve(repo, path);
  const relativeToLogs = relative(resolve(repo, "logs"), absolute);
  if (
    relativeToLogs === "" ||
    relativeToLogs.startsWith("..") ||
    isAbsolute(relativeToLogs) ||
    !absolute.startsWith(logsRoot(repo))
  ) {
    return { skip: false, reason: "escape" };
  }
  const tracked = gitResult(["ls-files", "--error-unmatch", "--", path], repo, "utf8");
  if (tracked.kind === "error") return { skip: false, reason: "git-error", gitError: true };
  if (tracked.kind === "ok") return { skip: false, reason: "tracked-log", path };
  const ignored = gitResult(["check-ignore", "-q", "--", path], repo, "utf8");
  if (ignored.kind === "error") return { skip: false, reason: "git-error", gitError: true };
  if (ignored.kind !== "ok") return { skip: false, reason: "not-ignored-log", path };
  return { skip: true, path };
}

export function resolveNumberedPath(repoRoot, kind, n) {
  const dir = kind === "prompt" ? "prompts" : kind === "report" ? "research/codex-findings" : null;
  if (!dir || n == null) return null;
  const prefix = `${n}-`;
  let names;
  try {
    names = readdirSync(resolve(repoRoot, dir));
  } catch {
    return null;
  }
  const matches = names.filter((name) => name.startsWith(prefix) && (name.endsWith(".md") || name.endsWith(".html")));
  if (matches.length !== 1) return null;
  return `${dir}/${matches[0]}`;
}

export function resolveDocsShortPath(repoRoot, nn) {
  let names;
  try {
    names = readdirSync(resolve(repoRoot, "docs"));
  } catch {
    return null;
  }
  const matches = names.filter((name) => new RegExp(`^${nn}-.*\\.md$`).test(name));
  if (matches.length !== 1) return null;
  return `docs/${matches[0]}`;
}

function localKindNumber(before, after) {
  if (before && after && before !== after) return { n: null, ambiguous: true };
  return { n: before || after || null, ambiguous: false };
}

function hashGroup(match, index) {
  const indices = match.indices?.[index];
  if (!indices) return null;
  return { start: indices[0], end: indices[1], sha: match[index] };
}

function addBinding(bindings, conflicts, tokenStart, claim) {
  const prev = bindings.get(tokenStart);
  if (!prev) {
    bindings.set(tokenStart, claim);
    return;
  }
  const same =
    prev.path === claim.path &&
    prev.kind === claim.kind &&
    prev.n === claim.n &&
    prev.sha256 === claim.sha256;
  if (!same) conflicts.push({ offset: tokenStart, a: prev, b: claim });
}

function runGlobal(re, text, onMatch) {
  const copy = new RegExp(re.source, re.flags.includes("d") ? re.flags : `${re.flags}d`);
  let match;
  while ((match = copy.exec(text))) onMatch(match);
}

export function extractJournalDigestClaims(text) {
  const bindings = new Map();
  const conflicts = [];
  const unresolved = [];

  const inlineRe = new RegExp(
    "`(" + PATH_BODY + ")`" + "(?:\\s*为)?\\s*" + "(?:([\\d,]+)\\s*行)?\\s*[/／,，]?\\s*" + "([\\d,]+)\\s*bytes\\s*[/／,，]?\\s*" + "(?:SHA-256)?\\s*" + OPT_HASH,
    "gi"
  );
  runGlobal(inlineRe, text, (match) => {
    const hash = hashGroup(match, 4);
    if (!hash) return;
    addBinding(bindings, conflicts, hash.start, {
      index: hash.start,
      spanStart: match.index,
      path: match[1],
      sha256: hash.sha,
      bytes: parseCount(match[3]),
      lines: parseCount(match[2]),
      bytesRaw: match[3],
      linesRaw: match[2] ?? null
    });
  });

  const parenRe = new RegExp(
    "`(" + PATH_BODY + ")`[（(]\\s*(?:([\\d,]+)\\s*行\\s*[/／,，]\\s*)?([\\d,]+)\\s*(?:bytes\\s*)?[/／,，]?\\s*(?:SHA-256\\s*)?" + OPT_HASH,
    "gi"
  );
  runGlobal(parenRe, text, (match) => {
    const hash = hashGroup(match, 4);
    if (!hash) return;
    addBinding(bindings, conflicts, hash.start, {
      index: hash.start,
      spanStart: match.index,
      path: match[1],
      sha256: hash.sha,
      bytes: parseCount(match[3]),
      lines: parseCount(match[2]),
      bytesRaw: match[3],
      linesRaw: match[2] ?? null
    });
  });

  const unquotedRe = new RegExp(
    "(?<![`\\w./])(" + PATH_BODY + ")[（(:：]?\\s*(?:([\\d,]+)\\s*行\\s*[/／,， ]\\s*)?([\\d,]+)\\s*(?:bytes\\s*)?[/／,，]?\\s*(?:SHA-256\\s*)?" + OPT_HASH,
    "gi"
  );
  runGlobal(unquotedRe, text, (match) => {
    const hash = hashGroup(match, 4);
    if (!hash) return;
    addBinding(bindings, conflicts, hash.start, {
      index: hash.start,
      spanStart: match.index,
      path: match[1],
      sha256: hash.sha,
      bytes: parseCount(match[3]),
      lines: parseCount(match[2]),
      bytesRaw: match[3],
      linesRaw: match[2] ?? null
    });
  });

  const compactRe = new RegExp(
    "(" + PATH_BODY + ")\\s*[（(]\\s*(?:([\\d,]+)\\s*行\\s*[/／,， ]\\s*)?([\\d,]+)\\s*(?:bytes\\s*)?[/／,，]\\s*(?:SHA-256\\s*)?" + OPT_HASH,
    "gi"
  );
  runGlobal(compactRe, text, (match) => {
    const hash = hashGroup(match, 4);
    if (!hash) return;
    addBinding(bindings, conflicts, hash.start, {
      index: hash.start,
      spanStart: match.index,
      path: match[1],
      sha256: hash.sha,
      bytes: parseCount(match[3]),
      lines: parseCount(match[2]),
      bytesRaw: match[3],
      linesRaw: match[2] ?? null
    });
  });

  const numberedBlockRe = new RegExp(
    "(?:(?<!\\d)(\\d{1,4})\\s+)?prompt(?:\\s+(\\d{1,4}))?\\s*为\\s*" +
      STATS_HASH +
      "[\\s\\S]{0,220}?(?:(?<!\\d)(\\d{1,4})\\s+)?报告(?:\\s+(\\d{1,4})\\s+为)?(?:为)?\\s*" +
      STATS_HASH,
    "gi"
  );
  runGlobal(numberedBlockRe, text, (match) => {
    const promptNumber = localKindNumber(match[1], match[2]);
    const reportNumber = localKindNumber(match[6], match[7]);
    const promptHash = hashGroup(match, 5);
    const reportHash = hashGroup(match, 10);
    if (promptNumber.ambiguous || reportNumber.ambiguous) {
      if (promptHash) unresolved.push({ index: promptHash.start, sha256: promptHash.sha, reason: "ambiguous-number", kind: "prompt" });
      if (reportHash) unresolved.push({ index: reportHash.start, sha256: reportHash.sha, reason: "ambiguous-number", kind: "report" });
      return;
    }
    if (promptHash && promptNumber.n) {
      addBinding(bindings, conflicts, promptHash.start, {
        index: promptHash.start,
        spanStart: match.index,
        path: null,
        kind: "prompt",
        n: promptNumber.n,
        sha256: promptHash.sha,
        bytes: parseCount(match[4]),
        lines: parseCount(match[3]),
        bytesRaw: match[4],
        linesRaw: match[3]
      });
    }
    if (reportHash && (reportNumber.n || promptNumber.n)) {
      addBinding(bindings, conflicts, reportHash.start, {
        index: reportHash.start,
        spanStart: match.index,
        path: null,
        kind: "report",
        n: reportNumber.n ?? promptNumber.n,
        sha256: reportHash.sha,
        bytes: parseCount(match[9]),
        lines: parseCount(match[8]),
        bytesRaw: match[9],
        linesRaw: match[8]
      });
    }
  });

  const promptNumberedLeadRe = new RegExp(
    "prompt\\s+(\\d{1,4})[^\\n\\d]{0,80}?prompt\\s+" + STATS_HASH,
    "gi"
  );
  runGlobal(promptNumberedLeadRe, text, (match) => {
    const hash = hashGroup(match, 4);
    if (!hash || bindings.has(hash.start)) return;
    addBinding(bindings, conflicts, hash.start, {
      index: hash.start,
      spanStart: match.index,
      path: null,
      kind: "prompt",
      n: match[1],
      sha256: hash.sha,
      bytes: parseCount(match[3]),
      lines: parseCount(match[2]),
      bytesRaw: match[3],
      linesRaw: match[2]
    });
  });

  const adversarialBlockRe = new RegExp(
    "对抗审\\s+(\\d{1,4})\\b[\\s\\S]{0,1500}?prompt\\s*为\\s*" +
      STATS_HASH +
      "[\\s\\S]{0,240}?报告为\\s*" +
      STATS_HASH,
    "gi"
  );
  runGlobal(adversarialBlockRe, text, (match) => {
    const n = match[1];
    const promptHash = hashGroup(match, 4);
    const reportHash = hashGroup(match, 7);
    if (promptHash && !bindings.has(promptHash.start)) {
      addBinding(bindings, conflicts, promptHash.start, {
        index: promptHash.start,
        spanStart: match.index,
        path: null,
        kind: "prompt",
        n,
        sha256: promptHash.sha,
        bytes: parseCount(match[3]),
        lines: parseCount(match[2]),
        bytesRaw: match[3],
        linesRaw: match[2]
      });
    }
    if (reportHash && !bindings.has(reportHash.start)) {
      addBinding(bindings, conflicts, reportHash.start, {
        index: reportHash.start,
        spanStart: match.index,
        path: null,
        kind: "report",
        n,
        sha256: reportHash.sha,
        bytes: parseCount(match[6]),
        lines: parseCount(match[5]),
        bytesRaw: match[6],
        linesRaw: match[5]
      });
    }
  });

  const promptStatsRe = new RegExp("(?:(?<!\\d)(\\d{1,4})\\s+)?prompt\\s+" + STATS_HASH, "gi");
  runGlobal(promptStatsRe, text, (match) => {
    const hash = hashGroup(match, 4);
    if (!hash || bindings.has(hash.start)) return;
    addBinding(bindings, conflicts, hash.start, {
      index: hash.start,
      spanStart: match.index,
      path: null,
      kind: "prompt",
      n: match[1],
      sha256: hash.sha,
      bytes: parseCount(match[3]),
      lines: parseCount(match[2]),
      bytesRaw: match[3],
      linesRaw: match[2]
    });
  });

  const promptOnlyRe = new RegExp("(?:(?<!\\d)(\\d{1,4})\\s+)?prompt(?:\\s+(\\d{1,4}))?\\s*为\\s*" + STATS_HASH, "gi");
  runGlobal(promptOnlyRe, text, (match) => {
    const hash = hashGroup(match, 5);
    if (!hash || bindings.has(hash.start)) return;
    const numbered = localKindNumber(match[1], match[2]);
    if (numbered.ambiguous) {
      unresolved.push({ index: hash.start, sha256: hash.sha, reason: "ambiguous-number", kind: "prompt" });
      return;
    }
    addBinding(bindings, conflicts, hash.start, {
      index: hash.start,
      spanStart: match.index,
      path: null,
      kind: "prompt",
      n: numbered.n,
      sha256: hash.sha,
      bytes: parseCount(match[4]),
      lines: parseCount(match[3]),
      bytesRaw: match[4],
      linesRaw: match[3]
    });
  });

  const reportOnlyRe = new RegExp("(?:(?<!\\d)(\\d{1,4})\\s+)报告(?:为)?\\s*" + STATS_HASH, "gi");
  runGlobal(reportOnlyRe, text, (match) => {
    const hash = hashGroup(match, 4);
    if (!hash || bindings.has(hash.start)) return;
    addBinding(bindings, conflicts, hash.start, {
      index: hash.start,
      spanStart: match.index,
      path: null,
      kind: "report",
      n: match[1],
      sha256: hash.sha,
      bytes: parseCount(match[3]),
      lines: parseCount(match[2]),
      bytesRaw: match[3],
      linesRaw: match[2]
    });
  });

  const reportAsRe = new RegExp("报告\\s+(\\d{1,4})\\s+为\\s*" + STATS_HASH, "gi");
  runGlobal(reportAsRe, text, (match) => {
    const hash = hashGroup(match, 4);
    if (!hash || bindings.has(hash.start)) return;
    addBinding(bindings, conflicts, hash.start, {
      index: hash.start,
      spanStart: match.index,
      path: null,
      kind: "report",
      n: match[1],
      sha256: hash.sha,
      bytes: parseCount(match[3]),
      lines: parseCount(match[2]),
      bytesRaw: match[3],
      linesRaw: match[2]
    });
  });

  const reportBareRe = new RegExp("报告为\\s*" + STATS_HASH, "gi");
  runGlobal(reportBareRe, text, (match) => {
    const hash = hashGroup(match, 3);
    if (!hash || bindings.has(hash.start)) return;
    addBinding(bindings, conflicts, hash.start, {
      index: hash.start,
      spanStart: match.index,
      path: null,
      kind: "report",
      n: null,
      sha256: hash.sha,
      bytes: parseCount(match[2]),
      lines: parseCount(match[1]),
      bytesRaw: match[2],
      linesRaw: match[1]
    });
  });

  const logPathRe = new RegExp("(?:本地忽略|忽略)?日志\\s*`(" + PATH_BODY + ")`\\s*(?:为)?\\s*" + STATS_HASH, "gi");
  runGlobal(logPathRe, text, (match) => {
    const hash = hashGroup(match, 4);
    if (!hash) return;
    addBinding(bindings, conflicts, hash.start, {
      index: hash.start,
      spanStart: match.index,
      path: match[1],
      sha256: hash.sha,
      bytes: parseCount(match[3]),
      lines: parseCount(match[2]),
      bytesRaw: match[3],
      linesRaw: match[2]
    });
  });

  const logBareRe = new RegExp("(?:本地忽略日志|忽略日志)\\s*(?:为)?\\s*" + STATS_HASH, "gi");
  runGlobal(logBareRe, text, (match) => {
    const hash = hashGroup(match, 3);
    if (!hash || bindings.has(hash.start)) return;
    addBinding(bindings, conflicts, hash.start, {
      index: hash.start,
      spanStart: match.index,
      path: "logs/",
      sha256: hash.sha,
      bytes: parseCount(match[2]),
      lines: parseCount(match[1]),
      bytesRaw: match[2],
      linesRaw: match[1],
      nonSkipLog: true
    });
  });

  const numberedDirRe = new RegExp("(prompts|research/codex-findings)/(\\d{1,4})\\s+SHA-256\\s+" + OPT_HASH, "gi");
  runGlobal(numberedDirRe, text, (match) => {
    const hash = hashGroup(match, 3);
    if (!hash) return;
    addBinding(bindings, conflicts, hash.start, {
      index: hash.start,
      spanStart: match.index,
      path: null,
      kind: match[1] === "prompts" ? "prompt" : "report",
      n: match[2],
      sha256: hash.sha,
      bytes: null,
      lines: null
    });
  });

  const docsShortRe = new RegExp("`?docs/(\\d{2})`?(?![-\\w])\\s*=\\s*(?:SHA-256\\s*)?" + OPT_HASH, "gi");
  runGlobal(docsShortRe, text, (match) => {
    const hash = hashGroup(match, 2);
    if (!hash) return;
    addBinding(bindings, conflicts, hash.start, {
      index: hash.start,
      spanStart: match.index,
      path: null,
      kind: "docs-short",
      n: match[1],
      sha256: hash.sha,
      bytes: null,
      lines: null
    });
  });

  const attemptRe = new RegExp(
    "(" + PATH_BODY + ")[\\s\\S]{0,220}?attempt1\\s+" + STATS_CORE + "\\s*[/／,，]?\\s*(?:SHA-256\\s*)?" + OPT_HASH,
    "gi"
  );
  runGlobal(attemptRe, text, (match) => {
    const hash = hashGroup(match, 4);
    if (!hash) return;
    addBinding(bindings, conflicts, hash.start, {
      index: hash.start,
      spanStart: match.index,
      path: match[1],
      sha256: hash.sha,
      bytes: parseCount(match[3]),
      lines: parseCount(match[2]),
      bytesRaw: match[3],
      linesRaw: match[2],
      attempt: "attempt1"
    });
  });

  const bytesOnlyRe = new RegExp(
    "(" + PATH_BODY + ")\\s*[（(:：]\\s*([\\d,]+)\\s*(?:bytes\\s*)?[/／,，]\\s*(?:SHA-256\\s*)?" + OPT_HASH,
    "gi"
  );
  runGlobal(bytesOnlyRe, text, (match) => {
    const hash = hashGroup(match, 3);
    if (!hash) return;
    addBinding(bindings, conflicts, hash.start, {
      index: hash.start,
      spanStart: match.index,
      path: match[1],
      sha256: hash.sha,
      bytes: parseCount(match[2]),
      lines: null,
      bytesRaw: match[2],
      linesRaw: null
    });
  });

  const logParenRe = new RegExp("\\blog\\s*[（(]\\s*([\\d,]+)\\s*bytes\\s*[)）]\\s*(?:SHA-256\\s*)?" + OPT_HASH, "gi");
  runGlobal(logParenRe, text, (match) => {
    const hash = hashGroup(match, 2);
    if (!hash || bindings.has(hash.start)) return;
    addBinding(bindings, conflicts, hash.start, {
      index: hash.start,
      spanStart: match.index,
      path: "logs/",
      sha256: hash.sha,
      bytes: parseCount(match[1]),
      lines: null,
      bytesRaw: match[1],
      linesRaw: null,
      nonSkipLog: true
    });
  });

  const genericLogRe = new RegExp("(?:完整取证)?日志\\s*(?:为)?\\s*" + STATS_HASH, "gi");
  runGlobal(genericLogRe, text, (match) => {
    const hash = hashGroup(match, 3);
    if (!hash || bindings.has(hash.start)) return;
    addBinding(bindings, conflicts, hash.start, {
      index: hash.start,
      spanStart: match.index,
      path: "logs/",
      sha256: hash.sha,
      bytes: parseCount(match[2]),
      lines: parseCount(match[1]),
      bytesRaw: match[2],
      linesRaw: match[1],
      nonSkipLog: true
    });
  });

  const nonArtifactRes = [
    { re: /release[- ]config(?:\s+digest)?\s*[:=]\s*`?([0-9a-f]{64})`?/gi, reason: "release-config" },
    { re: /sourceRevision=`?([0-9a-f]{64})`?/gi, reason: "sourceRevision" },
    { re: /(?:发行物|发布物候选|最终包|源码归档)[\s\S]{0,80}?SHA-256\s*`?([0-9a-f]{64})`?/gi, reason: "release-build" }
  ];
  for (const { re, reason } of nonArtifactRes) {
    runGlobal(re, text, (match) => {
      const hash = hashGroup(match, 1);
      if (!hash || bindings.has(hash.start)) return;
      addBinding(bindings, conflicts, hash.start, {
        index: hash.start,
        spanStart: match.index,
        path: null,
        sha256: hash.sha,
        bytes: null,
        lines: null,
        excluded: reason
      });
    });
  }

  const fallbackPathRe = new RegExp("(`?(?:docs/\\d{2}(?![-\\w])|" + PATH_BODY + ")`?)", "g");
  const tokensForFallback = enumerateJournalDigestTokens(text);
  for (const token of tokensForFallback) {
    if (bindings.has(token.offset) || !token.lowercase) continue;
    const windowStart = Math.max(0, token.offset - 320);
    const window = text.slice(windowStart, token.offset);
    if (/release[- ]config(?:\s+digest)?\s*[:=]\s*`?$/.test(window) || /sourceRevision=`?$/.test(window)) continue;
    const found = [...window.matchAll(new RegExp(fallbackPathRe.source, "g"))];
    const last = found.at(-1);
    if (!last) continue;
    const raw = last[1].replaceAll("`", "");
    const logAt = Math.max(window.lastIndexOf("日志"), window.lastIndexOf("忽略日志"), window.lastIndexOf("streaming log"));
    const pathAt = last.index ?? -1;
    let path = raw;
    let nonSkipLog = false;
    if (/^docs\/\d{2}$/.test(raw)) path = raw;
    if (logAt > pathAt && !raw.startsWith("logs/")) {
      path = "logs/";
      nonSkipLog = true;
    }
    const statsWindow = window.slice(-120);
    const fullStats = /([\d,]+)\s*行[\s\S]{0,24}?([\d,]+)\s*bytes/i.exec(statsWindow);
    const bytesOnly = /([\d,]+)\s*bytes/i.exec(statsWindow);
    addBinding(bindings, conflicts, token.offset, {
      index: token.offset,
      spanStart: windowStart + (last.index ?? 0),
      path,
      sha256: token.sha256,
      bytes: parseCount(fullStats?.[2] ?? bytesOnly?.[1]),
      lines: parseCount(fullStats?.[1]),
      bytesRaw: fullStats?.[2] ?? bytesOnly?.[1] ?? null,
      linesRaw: fullStats?.[1] ?? null,
      nonSkipLog
    });
  }

  const claims = [...bindings.values()].sort((a, b) => a.index - b.index);
  return { claims, unresolved, conflicts };
}

function bindPath(claim, repoRoot) {
  if (claim.path && /^docs\/\d{2}$/.test(claim.path)) {
    return resolveDocsShortPath(repoRoot, claim.path.slice("docs/".length));
  }
  if (claim.path) return claim.path;
  if (claim.kind === "docs-short" && claim.n) return resolveDocsShortPath(repoRoot, claim.n);
  if (claim.kind && claim.n) return resolveNumberedPath(repoRoot, claim.kind, claim.n);
  return null;
}

const histCache = new Map();

function historicalFingerprints(repo, path) {
  const key = `${repo}::${path}`;
  if (histCache.has(key)) return histCache.get(key);
  const log = gitResult(["log", "--all", "--full-history", "--pretty=%H", "--", path], repo, "utf8");
  if (log.kind !== "ok") {
    const error = new Error(`git log 失败:code=${log.status ?? log.signal ?? "error"}`);
    error.gitKind = "error";
    throw error;
  }
  const commits = String(log.stdout).trim().split("\n").filter(Boolean);
  const out = [];
  const seen = new Set();
  for (const commit of commits) {
    const blob = gitResult(["cat-file", "blob", `${commit}:${path}`], repo);
    if (blob.kind === "error") {
      const error = new Error(`git cat-file 失败:code=${blob.status ?? blob.signal ?? "error"}`);
      error.gitKind = "error";
      throw error;
    }
    if (blob.kind === "missing") continue;
    const data = blob.stdout;
    const fp = fingerprint(Buffer.isBuffer(data) ? data : Buffer.from(data));
    if (seen.has(fp.sha256)) continue;
    seen.add(fp.sha256);
    out.push(fp);
  }
  histCache.set(key, out);
  return out;
}

function currentFingerprint(repo, path) {
  try {
    return fingerprint(readRepoRegularFile(repo, path));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (
      msg === "current-file-missing" ||
      /current-file-(symlink|directory|non-regular|open|replaced|size-drift)|current-fd-/.test(msg)
    ) {
      return null;
    }
    throw error;
  }
}

function statsMatch(claim, actual) {
  if (actual.sha256 !== claim.sha256) return false;
  if (claim.bytes == null || claim.lines == null) return false;
  return claim.bytes === actual.bytes && claim.lines === actual.lines;
}

function readReachableBlob(repo, commit, path) {
  const normalized = normalizeClaimPath(path);
  if (!normalized.ok) return null;
  if (!isReachableCommit(repo, commit)) return null;
  const listed = gitResult(["ls-tree", "-z", "--full-tree", String(commit).toLowerCase(), "--", normalized.path], repo, "utf8");
  if (listed.kind === "error") {
    const error = new Error(`git ls-tree 失败:code=${listed.status ?? listed.signal ?? "error"}`);
    error.gitKind = "error";
    throw error;
  }
  if (listed.kind === "missing" || String(listed.stdout ?? "").trim() === "") return null;
  const blob = gitResult(["cat-file", "blob", `${String(commit).toLowerCase()}:${normalized.path}`], repo);
  if (blob.kind === "error") {
    const error = new Error(`git cat-file 失败:code=${blob.status ?? blob.signal ?? "error"}`);
    error.gitKind = "error";
    throw error;
  }
  if (blob.kind === "missing") return null;
  const buf = Buffer.isBuffer(blob.stdout) ? blob.stdout : Buffer.from(blob.stdout);
  const fp = fingerprint(buf);
  return {
    ...fp,
    path: normalized.path,
    commit: String(commit).toLowerCase(),
    gitBlob: gitBlobSha1(buf)
  };
}

function proveUnverifiableReason(claim, token, boundPath, repo) {
  const path = catalogPath(boundPath ?? claim?.path ?? null);
  if (!path) return "bare-log-or-unpathed-digest";
  const hist = historicalFingerprints(repo, path);
  const hashMatch = hist.find((fp) => fp.sha256 === token.sha256);
  const hasExactStats = claim?.lines != null && claim?.bytes != null;
  if (hashMatch) {
    if (!hasExactStats) return "incomplete-stats";
    if (hashMatch.lines === claim.lines && hashMatch.bytes === claim.bytes) return "reachable-exact";
    return "mismatch";
  }
  return "unreachable-intermediate";
}

function proveErratum(item, claim, token, repo) {
  if (item.reason !== "erratum-line-count") return { ok: false, reason: "erratum-reason" };
  if (typeof item.actualPath !== "string" || item.actualPath.length === 0) return { ok: false, reason: "erratum-actual-path" };
  if (!LOWER_HASH_RE.test(item.actualSha256) || !SHA1_RE_LOCAL.test(item.gitBlob) || !SHA1_RE_LOCAL.test(item.commit)) {
    return { ok: false, reason: "erratum-identity" };
  }
  if (!Number.isInteger(item.actualLines) || !Number.isInteger(item.actualBytes)) {
    return { ok: false, reason: "erratum-actual-stats" };
  }
  const actual = readReachableBlob(repo, item.commit, item.actualPath);
  if (!actual) return { ok: false, reason: "erratum-unreachable" };
  if (
    actual.path !== item.actualPath ||
    actual.lines !== item.actualLines ||
    actual.bytes !== item.actualBytes ||
    actual.sha256 !== item.actualSha256 ||
    actual.gitBlob !== item.gitBlob
  ) {
    return { ok: false, reason: "erratum-actual-mismatch" };
  }
  if (item.sha256 !== token.sha256) return { ok: false, reason: "erratum-recorded-hash" };
  if (claim?.sha256 && claim.sha256 !== item.sha256) return { ok: false, reason: "erratum-claim-hash" };
  if (claim?.bytes != null && claim.bytes !== item.bytes) return { ok: false, reason: "erratum-recorded-bytes" };
  if (claim?.lines != null && claim.lines !== item.lines) return { ok: false, reason: "erratum-recorded-lines" };
  if (item.actualSha256 !== item.sha256 || item.actualBytes !== item.bytes) {
    return { ok: false, reason: "erratum-not-line-count" };
  }
  if (item.actualLines === item.lines) return { ok: false, reason: "erratum-lines-same" };
  const recordedPath = catalogPath(item.path);
  if (recordedPath !== actual.path || recordedPath !== item.actualPath) {
    return { ok: false, reason: "erratum-path" };
  }
  return { ok: true, actual };
}

const SHA1_RE_LOCAL = /^[0-9a-f]{40}$/;

export function occurrenceContextSha(text, offset) {
  const before = text.slice(Math.max(0, offset - 96), offset).replace(/\s+/g, " ");
  const after = text.slice(offset + 64, offset + 64 + 32).replace(/\s+/g, " ");
  return createHash("sha256").update(`v1\n${before}\n${after}`).digest("hex");
}

function loadCatalog(repo) {
  const absolute = resolve(repo, CATALOG_RELATIVE);
  if (!existsSync(absolute)) return null;
  const parsed = JSON.parse(readFileSync(absolute, "utf8"));
  if (!parsed || (parsed.schemaVersion !== 1 && parsed.schemaVersion !== 2)) {
    throw new Error("journal digest catalog schema 非法");
  }
  return parsed;
}

function policyIdentity(repo, catalog) {
  if (!catalog || typeof catalog !== "object") {
    throw new Error("redaction catalog 缺失");
  }
  const source = catalog.policy?.source;
  if (source !== POLICY_SOURCE_RELATIVE) {
    throw new Error("redaction policy 路径非法");
  }
  if (!LOWER_HASH_RE.test(String(catalog.policy?.sha256 ?? ""))) {
    throw new Error("redaction policy 身份缺失");
  }
  const absolute = resolve(repo, source);
  if (!existsSync(absolute) || !statSync(absolute).isFile()) {
    throw new Error("redaction policy 源不存在");
  }
  const policyFp = fingerprint(readFileSync(absolute));
  if (catalog.policy.sha256 !== policyFp.sha256) {
    throw new Error("redaction policy 身份不匹配");
  }
  if (!Number.isInteger(catalog.policy.bytes) || catalog.policy.bytes !== policyFp.bytes) {
    throw new Error("redaction policy 身份不匹配");
  }
  const manifestPath = catalog.redactionManifest?.path;
  if (manifestPath !== REDACTION_MANIFEST_RELATIVE) {
    throw new Error("redaction manifest 路径非法");
  }
  if (!LOWER_HASH_RE.test(String(catalog.redactionManifest?.sha256 ?? ""))) {
    throw new Error("redaction manifest 身份缺失");
  }
  const manifestAbs = resolve(repo, manifestPath);
  if (!existsSync(manifestAbs) || !statSync(manifestAbs).isFile()) {
    throw new Error("redaction manifest 不存在");
  }
  const manifestFp = fingerprint(readFileSync(manifestAbs));
  if (catalog.redactionManifest.sha256 !== manifestFp.sha256) {
    throw new Error("redaction manifest 身份不匹配");
  }
  if (!Number.isInteger(catalog.redactionManifest.bytes) || catalog.redactionManifest.bytes !== manifestFp.bytes) {
    throw new Error("redaction manifest 身份不匹配");
  }
  return {
    source,
    sha256: policyFp.sha256,
    bytes: policyFp.bytes,
    manifest: manifestPath,
    manifestSha: manifestFp.sha256,
    manifestBytes: manifestFp.bytes
  };
}

function integerOrNull(value) {
  return value == null ? null : Number.isInteger(value) ? value : false;
}

function validateInventoryItem(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw new Error("journal inventory 键非法");
  }
  const keys = Object.keys(item);
  const required = item.category === "historical-erratum" ? [...INVENTORY_KEYS, ...ERRATUM_EXTRA_KEYS] : INVENTORY_KEYS;
  if (keys.length !== required.length || keys.some((key) => !required.includes(key))) {
    throw new Error("journal inventory 键非法");
  }
  if (!Number.isInteger(item.offset) || item.offset < 0) {
    throw new Error("journal inventory offset 非法");
  }
  if (!Number.isInteger(item.line) || item.line < 1) {
    throw new Error("journal inventory line 非法");
  }
  if (!LOWER_HASH_RE.test(item.sha256) || !LOWER_HASH_RE.test(item.contextSha256)) {
    throw new Error("journal inventory digest 非法");
  }
  if (!FROZEN_CATEGORIES.includes(item.category)) {
    throw new Error("journal inventory 类别非法");
  }
  if (item.path != null && (typeof item.path !== "string" || item.path.length === 0)) {
    throw new Error("journal inventory path 非法");
  }
  const lines = integerOrNull(item.lines);
  const bytes = integerOrNull(item.bytes);
  if (lines === false || bytes === false) {
    throw new Error("journal inventory stats 非法");
  }
  if (item.reason != null && (typeof item.reason !== "string" || item.reason.length === 0)) {
    throw new Error("journal inventory reason 非法");
  }
  if (item.category.startsWith("checked-")) {
    if (item.path == null || item.lines == null || item.bytes == null || item.reason != null) {
      throw new Error("journal inventory checked 字段非法");
    }
  } else if (item.category === "skipped-log") {
    if (item.path == null || !SKIP_REASONS.includes(item.reason)) {
      throw new Error("journal inventory skipped 字段非法");
    }
  } else if (item.category === "excluded-non-artifact") {
    if (!EXCLUDED_REASONS.includes(item.reason)) {
      throw new Error("journal inventory excluded 字段非法");
    }
  } else if (item.category === "historical-unverifiable") {
    if (!UNVERIFIABLE_REASONS.includes(item.reason)) {
      throw new Error("journal inventory unverifiable reason 非法");
    }
  } else if (item.category === "historical-erratum") {
    if (!ERRATUM_REASONS.includes(item.reason) || item.path == null || item.lines == null || item.bytes == null) {
      throw new Error("journal inventory erratum 字段非法");
    }
    if (typeof item.actualPath !== "string" || item.actualPath.length === 0) {
      throw new Error("journal inventory erratum 字段非法");
    }
    if (!Number.isInteger(item.actualLines) || !Number.isInteger(item.actualBytes) || !LOWER_HASH_RE.test(item.actualSha256)) {
      throw new Error("journal inventory erratum 字段非法");
    }
    if (!SHA1_RE_LOCAL.test(item.commit) || !SHA1_RE_LOCAL.test(item.gitBlob)) {
      throw new Error("journal inventory erratum 字段非法");
    }
  }
  return item;
}

function validateRedactionEntry(entry, repo, identity) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
  const allowed = new Set([
    "path",
    "originalSha256",
    "originalBytes",
    "originalLines",
    "currentSha256",
    "currentBytes",
    "currentLines",
    "policyPath",
    "policySha256",
    "manifestPath",
    "manifestSha256"
  ]);
  if (Object.keys(entry).some((key) => !allowed.has(key))) return false;
  if (entry.policyPath !== POLICY_SOURCE_RELATIVE || entry.policySha256 !== identity.sha256) return false;
  if (entry.manifestPath !== REDACTION_MANIFEST_RELATIVE || entry.manifestSha256 !== identity.manifestSha) return false;
  const normalized = normalizeClaimPath(entry.path);
  if (!normalized.ok) return false;
  if (!LOWER_HASH_RE.test(entry.originalSha256) || !LOWER_HASH_RE.test(entry.currentSha256)) return false;
  if (![entry.originalBytes, entry.originalLines, entry.currentBytes, entry.currentLines].every((n) => Number.isInteger(n))) {
    return false;
  }
  const current = currentFingerprint(repo, normalized.path);
  if (
    !current ||
    current.sha256 !== entry.currentSha256 ||
    current.bytes !== entry.currentBytes ||
    current.lines !== entry.currentLines
  ) {
    return false;
  }
  const historical = historicalFingerprints(repo, normalized.path);
  return historical.some(
    (fp) => fp.sha256 === entry.originalSha256 && fp.bytes === entry.originalBytes && fp.lines === entry.originalLines
  );
}

function sameNullable(a, b) {
  if (a == null && b == null) return true;
  return a === b;
}

function catalogPath(path) {
  if (!path || path === "logs" || path === "logs/") return null;
  return path;
}

export function classifyJournalDigestOccurrences(text, repoRoot) {
  histCache.clear();
  const tokens = enumerateJournalDigestTokens(text);
  const extracted = extractJournalDigestClaims(text);
  const catalog = loadCatalog(repoRoot);
  const identity = catalog ? policyIdentity(repoRoot, catalog) : null;
  const failures = [];
  if (catalog && !Array.isArray(catalog.redactionMap)) {
    throw new Error("redaction map 非法");
  }
  let redactionMap = [];
  if (identity) {
    for (const entry of catalog.redactionMap) {
      if (!validateRedactionEntry(entry, repoRoot, identity)) {
        failures.push({ path: entry?.path ?? "redaction-map", reason: "redaction-map-invalid" });
        continue;
      }
      redactionMap.push(entry);
    }
    const seenMap = new Set();
    for (const entry of redactionMap) {
      const key = `${entry.path}:${entry.originalSha256}:${entry.currentSha256}`;
      if (seenMap.has(key)) failures.push({ path: entry.path, reason: "redaction-map-duplicate" });
      seenMap.add(key);
    }
  }
  if (catalog && !Array.isArray(catalog.inventory)) {
    throw new Error("journal inventory 缺失");
  }
  const inventory = catalog ? catalog.inventory : null;
  const inventoryByOffset = new Map();
  if (inventory) {
    for (const raw of inventory) {
      const item = validateInventoryItem(raw);
      if (inventoryByOffset.has(item.offset)) throw new Error("journal inventory offset 重复");
      inventoryByOffset.set(item.offset, item);
    }
  }
  const unverifiable = catalog?.historicalUnverifiable ?? [];
  const occurrences = [];
  const skipReasons = [];
  const redactionConsumed = new Map();
  const counts = Object.fromEntries(CATEGORIES.map((name) => [name, 0]));
  let unknownFormat = 0;
  let duplicateAttribution = extracted.conflicts.length;

  const usedInventory = new Set();

  for (const token of tokens) {
    if (!token.lowercase) {
      unknownFormat += 1;
      occurrences.push({
        offset: token.offset,
        line: token.line,
        sha256: token.sha256,
        category: "unresolved",
        reason: "unknown-format"
      });
      counts.unresolved += 1;
      continue;
    }
    const claim = extracted.claims.find((row) => row.index === token.offset) ?? null;
    const preUnresolved = extracted.unresolved.find((row) => row.index === token.offset);
    if (preUnresolved) {
      occurrences.push({
        offset: token.offset,
        line: token.line,
        sha256: token.sha256,
        category: "unresolved",
        reason: preUnresolved.reason,
        kind: preUnresolved.kind
      });
      counts.unresolved += 1;
      continue;
    }

    let category = null;
    let reason = null;
    let path = null;
    let kind = claim?.kind ?? null;

    if (claim?.excluded) {
      category = "excluded-non-artifact";
      reason = claim.excluded;
    } else if (claim) {
      path = bindPath(claim, repoRoot);
      if (claim.path && !/^docs\/\d{2}$/.test(claim.path) && claim.path !== "logs/") {
        const normalized = normalizeClaimPath(claim.path);
        if (!normalized.ok) {
          category = "unresolved";
          reason = normalized.reason;
        } else path = normalized.path;
      }
      if (claim.path === "logs/") {
        path = "logs/";
      }
      if (!category && path) {
        const log = proveSkippedLog(repoRoot, path);
        if (log.gitError) {
          category = "unresolved";
          reason = "git-error";
          failures.push({ path, reason: "git-error" });
        } else if (claim.nonSkipLog || path === "logs" || path === "logs/") {
          reason = "bare-logs";
        } else if (log.skip) {
          category = "skipped-log";
          reason = "logs-not-tracked";
          skipReasons.push({ path, reason: log.reason ?? "logs-not-tracked" });
        } else if (path.startsWith("logs/") && path !== "logs/") {
          category = "unresolved";
          reason = log.reason ?? "log-not-skippable";
        }
      }
      if (!category && path && path !== "logs/" && path !== "logs") {
        const current = currentFingerprint(repoRoot, path);
        const mapped = redactionMap.find(
          (entry) =>
            entry.path === path &&
            (entry.originalSha256 === token.sha256 || entry.currentSha256 === token.sha256)
        );
        const claimHasStats = claim.lines != null && claim.bytes != null;
        if (mapped && claimHasStats) {
          const originalExact =
            token.sha256 === mapped.originalSha256 &&
            claim.lines === mapped.originalLines &&
            claim.bytes === mapped.originalBytes;
          const currentExact =
            token.sha256 === mapped.currentSha256 &&
            current &&
            claim.lines === mapped.currentLines &&
            claim.bytes === mapped.currentBytes &&
            statsMatch({ ...claim, sha256: token.sha256 }, current);
          if (currentExact) {
            category = "checked-current";
          } else if (originalExact) {
            category = "checked-redaction-map";
            redactionConsumed.set(mapped, (redactionConsumed.get(mapped) ?? 0) + 1);
          }
        }
        if (!category && current && statsMatch({ ...claim, sha256: token.sha256 }, current)) {
          category = "checked-current";
        }
        if (!category) {
          const hist = historicalFingerprints(repoRoot, path).find((fp) => statsMatch({ ...claim, sha256: token.sha256 }, fp));
          if (hist) category = "checked-historical";
        }
        if (!category) {
          const samePathHist = historicalFingerprints(repoRoot, path);
          const hashOnPath = (current && current.sha256 === token.sha256) || samePathHist.some((fp) => fp.sha256 === token.sha256);
          if (hashOnPath && claim.lines != null && claim.bytes != null) {
            category = "unresolved";
            reason = "mismatch";
          } else if (hashOnPath) {
            reason = "incomplete-claim";
          }
        }
      } else if (!category && !path) {
        category = "unresolved";
        reason = "unresolved";
      }
    }

    if (["checked-current", "checked-historical", "checked-redaction-map"].includes(category)) {
      if (!path || claim?.lines == null || claim?.bytes == null) {
        category = "unresolved";
        reason = "incomplete-claim";
      }
    }

    if (!category) {
      category = "unresolved";
      reason = reason ?? "unclassified";
    }

    const item = inventory ? inventoryByOffset.get(token.offset) : null;
    const mechanicalCategory = category;
    const mechanicalReason = reason;
    if (inventory) {
      if (!item) {
        category = "unresolved";
        reason = "inventory-missing";
      } else {
        const contextSha = occurrenceContextSha(text, token.offset);
        const claimLines = claim?.lines ?? null;
        const claimBytes = claim?.bytes ?? null;
        const identityOk =
          item.line === token.line &&
          item.sha256 === token.sha256 &&
          item.contextSha256 === contextSha;
        const factsOk =
          sameNullable(item.path ?? null, catalogPath(path)) &&
          sameNullable(item.lines ?? null, claimLines) &&
          sameNullable(item.bytes ?? null, claimBytes);
        if (!identityOk || !factsOk) {
          category = "unresolved";
          reason = "inventory-mismatch";
        } else if (item.category === "historical-erratum" || item.category === "historical-unverifiable") {
          if (mechanicalCategory !== "unresolved") {
            category = "unresolved";
            reason = "inventory-mismatch";
            failures.push({ path: item.path ?? "catalog", reason: "catalog-override" });
          } else if (item.category === "historical-erratum") {
            const claimPath = catalogPath(path ?? claim?.path ?? null);
            if (claimPath !== item.path || item.actualPath !== item.path) {
              category = "unresolved";
              reason = "erratum-path";
              failures.push({ path: item.path ?? "catalog", reason: "erratum-path" });
            } else {
              const proof = proveErratum(item, claim, token, repoRoot);
              if (!proof.ok || mechanicalReason !== "mismatch") {
                category = "unresolved";
                reason = proof.ok ? "inventory-mismatch" : proof.reason;
                failures.push({ path: item.path ?? "catalog", reason });
              } else {
                category = "historical-erratum";
                reason = item.reason;
                usedInventory.add(item.offset);
              }
            }
          } else {
            const proved = proveUnverifiableReason(claim, token, path, repoRoot);
            if (proved !== item.reason || proved === "reachable-exact" || proved === "mismatch") {
              category = "unresolved";
              reason = "unverifiable-reason";
              failures.push({ path: item.path ?? "catalog", reason: "unverifiable-reason" });
            } else {
              category = "historical-unverifiable";
              reason = item.reason;
              usedInventory.add(item.offset);
            }
          }
        } else if (item.category !== mechanicalCategory || !sameNullable(item.reason ?? null, reason ?? null)) {
          category = "unresolved";
          reason = "inventory-mismatch";
        } else {
          usedInventory.add(item.offset);
        }
      }
    } else if (category === "historical-unverifiable" || category === "historical-erratum") {
      const entry = unverifiable.find((row) => row.offset === token.offset && row.sha256 === token.sha256);
      if (entry) usedInventory.add(entry.offset);
    }

    if (!CATEGORIES.includes(category)) {
      category = "unresolved";
      reason = "unknown-category";
    }
    counts[category] += 1;
    occurrences.push({
      offset: token.offset,
      line: token.line,
      sha256: token.sha256,
      category,
      reason,
      path,
      kind
    });
  }

  if (inventory) {
    if (inventory.length !== tokens.length) {
      failures.push({ path: "catalog", reason: "inventory-count" });
    }
    for (const item of inventory) {
      if (!usedInventory.has(item.offset)) {
        failures.push({ path: item.path ?? "catalog", reason: "catalog-stale" });
      }
    }
  }
  for (const entry of redactionMap) {
    const used = redactionConsumed.get(entry) ?? 0;
    if (used === 0) failures.push({ path: entry.path, reason: "redaction-map-unconsumed" });
    if (used > 1) failures.push({ path: entry.path, reason: "redaction-map-duplicate-consume" });
  }
  for (const entry of unverifiable) {
    if (!usedInventory.has(entry.offset)) {
      duplicateAttribution += 1;
      failures.push({ path: entry.path ?? "catalog", reason: "catalog-stale" });
    }
  }

  const classified = occurrences.length;
  const overlap = classified !== tokens.length ? tokens.length - classified : 0;
  return {
    tokens: tokens.length,
    classified,
    unknownFormat,
    duplicateAttribution,
    overlap,
    counts,
    occurrences,
    claims: extracted.claims.length,
    checked:
      counts["checked-current"] + counts["checked-historical"] + counts["checked-redaction-map"],
    skipped: counts["skipped-log"],
    excluded: counts["excluded-non-artifact"],
    unverifiable: counts["historical-unverifiable"],
    unresolved: counts.unresolved,
    unresolvedItems: occurrences.filter((row) => row.category === "unresolved"),
    skipReasons,
    failures,
    conflicts: extracted.conflicts,
    identity
  };
}

export function verifyJournalDigestClaims(text, repoRoot) {
  try {
    const classified = classifyJournalDigestOccurrences(text, repoRoot);
    const drift = classified.occurrences.filter((row) => row.category === "unresolved" && row.reason === "mismatch").length;
    const failClosed =
      classified.unknownFormat > 0 ||
      classified.duplicateAttribution > 0 ||
      classified.overlap !== 0 ||
      classified.tokens !== classified.classified ||
      classified.unresolved > 0 ||
      drift > 0 ||
      classified.failures.length > 0;
    return {
      ...classified,
      drift,
      failClosed
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (error?.gitKind === "error" || /^git /.test(msg)) {
      return {
        tokens: 0,
        classified: 0,
        unknownFormat: 0,
        duplicateAttribution: 0,
        overlap: 0,
        counts: Object.fromEntries(CATEGORIES.map((name) => [name, 0])),
        occurrences: [],
        claims: 0,
        checked: 0,
        skipped: 0,
        excluded: 0,
        unverifiable: 0,
        unresolved: 1,
        unresolvedItems: [{ reason: "git-error" }],
        skipReasons: [],
        failures: [{ path: "git", reason: "git-error" }],
        conflicts: [],
        identity: null,
        drift: 0,
        failClosed: true
      };
    }
    throw error;
  }
}

export { POLICY_SOURCE_RELATIVE as JOURNAL_POLICY_SOURCE };
