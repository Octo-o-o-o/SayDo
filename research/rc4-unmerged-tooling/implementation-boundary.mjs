#!/usr/bin/env node
// 实施边界证据：internal-history 与 public-snapshot 双模式。公开模式不得从内部协议失败回落。

import { existsSync, lstatSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import {
  AVAILABILITY_HTML_PATHS,
  AVAILABILITY_TRANSITION_IDENTITY,
  gitBlobId,
  isCanonicalAvailabilityAfter,
  isCanonicalAvailabilityBefore,
  isExactAvailabilityText
} from "./availability-transition.mjs";

export { AVAILABILITY_HTML_PATHS };

export const IMPLEMENTATION_BOUNDARY_RELATIVE = "research/week-audit/2026-08-24-implementation-boundary.json";
export const IMPLEMENTATION_BOUNDARY_SCHEMA_VERSION = 1;
export const PUBLIC_FILTER_VERSION = "public-exclude-v1";

export const LEDGER_JSON = "research/week-audit/2026-08-22-ledger.json";
export const INTEGRITY_JSON = "research/week-audit/2026-08-22-bundle-integrity.json";
export const SEMANTIC_JSON = "research/week-audit/2026-08-22-semantic-review.json";
export const PUBLICATION_JSON = "research/week-audit/2026-08-23-publication-manifest.json";

const SHA_RE = /^[0-9a-f]{40}$/;
const ALLOWED_KEYS = new Set(["schemaVersion", "purpose", "implementationBoundary", "rule"]);
const ROOT_DOCUMENTS = new Set(["README.md", "HANDOFF.md", "SECURITY.md", "AGENTS.md", "LICENSE", "NOTICE"]);
const EVIDENCE_PREFIXES = ["docs/", "research/", "history/", "prompts/", "e2e/evidence/"];
const EVIDENCE_EXTS = new Set([".md", ".json", ".txt", ".jsonl"]);
const FORBIDDEN_EXTS = new Set([".mjs", ".js", ".cjs", ".ts", ".tsx", ".sh", ".bash", ".html", ".htm", ".css", ".svg", ".wasm", ".py", ".ps1"]);
const SNAPSHOT_SUBJECT_RE = /^snapshot: (\d{4}-\d{2}-\d{2}) from internal ([0-9a-f]{40})$/;
const AVAILABILITY_SET = new Set(AVAILABILITY_HTML_PATHS);
const REGULAR_FILE_MODES = new Set(["100644", "100755"]);
const OBJECT_TYPES = new Set(["commit", "blob", "tree", "tag"]);

export function isAllowedEvidencePath(path) {
  const value = String(path ?? "");
  if (value === "" || value.includes("\\")) return false;
  if (AVAILABILITY_SET.has(value)) return false;
  if (ROOT_DOCUMENTS.has(value)) return true;
  if (!EVIDENCE_PREFIXES.some((prefix) => value.startsWith(prefix))) return false;
  const lower = value.toLowerCase();
  const ext = extname(lower);
  if (FORBIDDEN_EXTS.has(ext)) return false;
  if (lower.endsWith(".fable.md") || EVIDENCE_EXTS.has(ext)) return true;
  return false;
}

export function parseImplementationBoundaryDocument(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text));
  } catch {
    throw new Error("实施边界证据 JSON 非法");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("实施边界证据 JSON 非法");
  }
  if (Object.keys(parsed).some((key) => !ALLOWED_KEYS.has(key))) {
    throw new Error("实施边界证据含非法字段");
  }
  if (parsed.schemaVersion !== IMPLEMENTATION_BOUNDARY_SCHEMA_VERSION) {
    throw new Error("实施边界证据 schemaVersion 非法");
  }
  if (typeof parsed.purpose !== "string" || parsed.purpose.trim() === "") {
    throw new Error("实施边界证据缺 purpose");
  }
  if (typeof parsed.rule !== "string" || parsed.rule.trim() === "") {
    throw new Error("实施边界证据缺 rule");
  }
  const sha = String(parsed.implementationBoundary ?? "").toLowerCase();
  if (!SHA_RE.test(sha)) {
    throw new Error("实施边界 SHA 非法");
  }
  return {
    schemaVersion: IMPLEMENTATION_BOUNDARY_SCHEMA_VERSION,
    purpose: parsed.purpose,
    rule: parsed.rule,
    implementationBoundary: sha
  };
}

function gitInvoke(git, args, options) {
  if (typeof git !== "function") {
    throw new Error("git 调用器非法");
  }
  return options == null ? git(args) : git(args, options);
}

function gitRequired(git, args, message, options) {
  try {
    return gitInvoke(git, args, options);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${message}:${detail}`);
  }
}

function readCommitPathBlob(git, sha, path) {
  const raw = gitRequired(git, ["ls-tree", "-z", sha, "--", path], "无法读取 availability 树条目");
  const entry = parseHeadTreeEntry(raw, path);
  if (!REGULAR_FILE_MODES.has(entry.mode)) {
    throw new Error("availability 文件必须是常规文件");
  }
  const bytesRaw = gitRequired(git, ["cat-file", "blob", entry.blob], "无法读取 availability blob");
  const bytes = Buffer.isBuffer(bytesRaw) ? bytesRaw : Buffer.from(String(bytesRaw), "utf8");
  const computed = gitBlobId(bytes);
  if (computed !== entry.blob) {
    throw new Error("availability git blob 身份不匹配");
  }
  return { mode: entry.mode, blob: entry.blob, computedBlob: computed, bytes, text: bytes.toString("utf8") };
}

export function isAvailabilityTransitionCommit(git, sha) {
  const parents = parentsOf(git, sha);
  if (parents.length !== 1) return false;
  const paths = commitPaths(git, sha);
  if (paths.length !== AVAILABILITY_HTML_PATHS.length) return false;
  if (AVAILABILITY_HTML_PATHS.some((path) => !paths.includes(path))) return false;
  if (paths.some((path) => !AVAILABILITY_HTML_PATHS.includes(path))) return false;
  try {
    for (const path of AVAILABILITY_HTML_PATHS) {
      const frozen = AVAILABILITY_TRANSITION_IDENTITY[path];
      if (!frozen) return false;
      const parent = readCommitPathBlob(git, parents[0], path);
      const child = readCommitPathBlob(git, sha, path);
      if (parent.mode !== frozen.mode || child.mode !== frozen.mode || parent.mode !== child.mode) return false;
      if (parent.computedBlob !== frozen.before.gitBlob || parent.blob !== frozen.before.gitBlob) return false;
      if (child.computedBlob !== frozen.after.gitBlob || child.blob !== frozen.after.gitBlob) return false;
      if (parent.bytes.length !== frozen.before.bytes || child.bytes.length !== frozen.after.bytes) return false;
      if (!isCanonicalAvailabilityBefore(parent.text, path)) return false;
      if (!isCanonicalAvailabilityAfter(child.text, path)) return false;
      if (!isExactAvailabilityText(parent.text, child.text, path)) return false;
    }
  } catch {
    return false;
  }
  return true;
}

export function leakedImplementationAfterBoundary(endSha, gitText, head = "HEAD") {
  const after = gitRequired(gitText, ["rev-list", `${endSha}..${head}`], `无法枚举边界之后的提交:${endSha}..${head}`)
    .split("\n")
    .filter(Boolean);
  const leaked = [];
  let availabilityCommits = 0;
  for (const sha of after) {
    const paths = commitPaths(gitText, sha);
    const html = paths.filter((path) => AVAILABILITY_SET.has(path));
    const other = paths.filter((path) => !isAllowedEvidencePath(path) && !AVAILABILITY_SET.has(path));
    if (other.length > 0) {
      leaked.push(sha);
      continue;
    }
    if (html.length > 0) {
      availabilityCommits += 1;
      if (availabilityCommits > 1 || !isAvailabilityTransitionCommit(gitText, sha)) {
        leaked.push(sha);
      }
    }
  }
  return leaked;
}

function parentsOf(git, sha) {
  const parts = gitRequired(git, ["rev-list", "--parents", "-n", "1", sha], `无法读取提交父提交:${sha}`)
    .trim()
    .split(/\s+/);
  return parts.slice(1);
}

export function commitPaths(git, sha) {
  const classified = classifyGitObject(git, sha);
  if (classified.kind !== "commit") {
    throw new Error(`无法枚举非提交对象的路径:${sha}`);
  }
  const parents = parentsOf(git, sha);
  const comparisons =
    parents.length === 0
      ? [["--root", sha]]
      : parents.map((parent) => [parent, sha]);
  const paths = new Set();
  for (const spec of comparisons) {
    const raw = gitRequired(
      git,
      ["diff-tree", "--no-commit-id", "--name-only", "--no-renames", "-r", "-z", ...spec],
      `无法枚举提交路径:${sha}`
    );
    for (const path of String(raw).split("\0").filter(Boolean)) paths.add(path);
  }
  return [...paths];
}

function commitsTouchingPath(git, path, head) {
  const raw = git(["log", "--full-history", "--pretty=format:%H", head, "--", path]);
  return String(raw)
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean);
}

function readCommitMessage(git, sha) {
  const subject = git(["log", "-1", "--format=%s", sha]).replace(/\n$/, "");
  const body = git(["log", "-1", "--format=%b", sha]).replace(/\n$/, "");
  return { subject, body };
}

function uniqueLabeledLine(body, label) {
  const lines = String(body)
    .split(/\r?\n/)
    .map((line) => line.trimEnd());
  const prefix = `${label}: `;
  const matches = lines.filter((line) => line.startsWith(prefix));
  if (matches.length !== 1) return null;
  return matches[0].slice(prefix.length).trim();
}

export function parseGitBatchCheckOutput(sha, stdout) {
  const expected = String(sha ?? "").toLowerCase();
  if (!SHA_RE.test(expected)) {
    throw new Error("实施边界 SHA 非法");
  }
  if (typeof stdout !== "string") {
    throw new Error("实施边界对象类型输出非法");
  }
  if (stdout.includes("\r") || stdout.includes("\0")) {
    throw new Error("实施边界对象类型输出畸形");
  }
  if (stdout === "" || stdout === "\n") {
    throw new Error("实施边界对象类型输出为空");
  }
  if (!stdout.endsWith("\n")) {
    throw new Error("实施边界对象类型输出畸形");
  }
  const lines = stdout.slice(0, -1).split("\n");
  if (lines.length !== 1) {
    throw new Error("实施边界对象类型输出含糊");
  }
  const line = lines[0];
  if (line === `${expected} missing`) {
    return { kind: "missing", sha: expected };
  }
  const match = /^([0-9a-f]{40}) (commit|blob|tree|tag) (0|[1-9][0-9]*)$/.exec(line);
  if (!match || match[1] !== expected || !OBJECT_TYPES.has(match[2])) {
    throw new Error("实施边界对象类型输出畸形");
  }
  return { kind: match[2], sha: expected, size: Number(match[3]) };
}

export function classifyGitObject(git, sha) {
  const expected = String(sha ?? "").toLowerCase();
  if (!SHA_RE.test(expected)) {
    throw new Error("实施边界 SHA 非法");
  }
  let stdout;
  try {
    stdout = gitInvoke(git, ["cat-file", "--batch-check"], { input: `${expected}\n` });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`无法判定实施边界对象类型:${detail}`);
  }
  return parseGitBatchCheckOutput(expected, typeof stdout === "string" ? stdout : String(stdout ?? ""));
}

export function identifyPublicSnapshot(git, sha) {
  const parents = parentsOf(git, sha);
  if (parents.length > 1) return null;
  const { subject, body } = readCommitMessage(git, sha);
  const subjectMatch = SNAPSHOT_SUBJECT_RE.exec(subject);
  if (!subjectMatch) return null;
  const publicTree = uniqueLabeledLine(body, "public-tree");
  const filterVersion = uniqueLabeledLine(body, "filter-version");
  if (!SHA_RE.test(publicTree ?? "") || filterVersion !== PUBLIC_FILTER_VERSION) return null;
  const actualTree = git(["rev-parse", `${sha}^{tree}`]).trim();
  if (actualTree !== publicTree) return null;
  return {
    sha: sha.toLowerCase(),
    internalSourceSha: subjectMatch[2],
    date: subjectMatch[1],
    publicTree: actualTree,
    filterVersion,
    parents
  };
}

function splitNulRecords(raw, message) {
  const text = String(raw ?? "");
  if (text === "") return [];
  if (!text.endsWith("\0")) {
    throw new Error(message);
  }
  return text.slice(0, -1).split("\0");
}

function parseIndexStage(raw, relativePath) {
  const records = splitNulRecords(raw, "实施边界证据 index 输出畸形");
  if (records.length === 0) {
    throw new Error("实施边界证据 index entry 缺失");
  }
  if (records.length !== 1) {
    throw new Error("实施边界证据 index 含多个 stage");
  }
  const line = records[0];
  const tab = line.indexOf("\t");
  if (tab < 0) {
    throw new Error("实施边界证据 index 输出畸形");
  }
  const path = line.slice(tab + 1);
  if (path !== relativePath) {
    throw new Error("实施边界证据 index 路径不一致");
  }
  const match = /^([0-7]{6}) ([0-9a-f]{40}) ([0-3])$/.exec(line.slice(0, tab));
  if (!match) {
    throw new Error("实施边界证据 index 输出畸形");
  }
  const stage = Number(match[3]);
  if (stage !== 0) {
    throw new Error("实施边界证据 index stage 必须为 0");
  }
  return { mode: match[1], blob: match[2], stage };
}

function parseHeadTreeEntry(raw, relativePath) {
  const records = splitNulRecords(raw, "实施边界证据 HEAD 输出畸形");
  if (records.length === 0) {
    throw new Error(`实施边界证据尚未以一次性提交入库:${relativePath}`);
  }
  if (records.length !== 1) {
    throw new Error("实施边界证据 HEAD 输出含糊");
  }
  const line = records[0];
  const tab = line.indexOf("\t");
  if (tab < 0) {
    throw new Error("实施边界证据 HEAD 输出畸形");
  }
  const path = line.slice(tab + 1);
  if (path !== relativePath) {
    throw new Error("实施边界证据 HEAD 路径不一致");
  }
  const match = /^([0-7]{6}) blob ([0-9a-f]{40})$/.exec(line.slice(0, tab));
  if (!match) {
    throw new Error("实施边界证据必须是常规文件");
  }
  return { mode: match[1], blob: match[2] };
}

function assertNoSymlinkEscape(repo, relativePath) {
  const parts = String(relativePath)
    .split("/")
    .filter(Boolean);
  let current = repo;
  for (const part of parts) {
    current = join(current, part);
    let stat;
    try {
      stat = lstatSync(current);
    } catch {
      throw new Error(
        `缺少实施边界证据文件:${relativePath}。代码提交落地后须由独立证据提交引入该文件，JSON 只记录代码提交 SHA，不得自引用，且该路径只能出现一次。`
      );
    }
    if (stat.isSymbolicLink()) {
      throw new Error("实施边界证据必须是常规文件");
    }
  }
  const workingPath = resolve(repo, relativePath);
  let finalStat;
  try {
    finalStat = lstatSync(workingPath);
  } catch {
    throw new Error(
      `缺少实施边界证据文件:${relativePath}。代码提交落地后须由独立证据提交引入该文件，JSON 只记录代码提交 SHA，不得自引用，且该路径只能出现一次。`
    );
  }
  if (finalStat.isSymbolicLink() || !finalStat.isFile()) {
    throw new Error("实施边界证据必须是常规文件");
  }
}

function assertBoundaryFileAlignment(git, repo, relativePath, head) {
  assertNoSymlinkEscape(repo, relativePath);
  const indexRaw = gitRequired(git, ["ls-files", "--stage", "-z", "--", relativePath], "无法读取实施边界证据 index");
  const index = parseIndexStage(indexRaw, relativePath);
  const headRaw = gitRequired(git, ["ls-tree", "-z", head, "--", relativePath], "无法读取实施边界证据 HEAD");
  const headEntry = parseHeadTreeEntry(headRaw, relativePath);
  if (!REGULAR_FILE_MODES.has(index.mode) || !REGULAR_FILE_MODES.has(headEntry.mode)) {
    throw new Error("实施边界证据必须是常规文件");
  }
  if (index.mode !== headEntry.mode) {
    throw new Error("工作树/index/HEAD 实施边界证据 mode 不一致");
  }
  const workingBlob = gitRequired(git, ["hash-object", "--", relativePath], "无法读取实施边界证据工作树").trim();
  if (!SHA_RE.test(workingBlob) || workingBlob !== index.blob || workingBlob !== headEntry.blob) {
    throw new Error("工作树/index/HEAD 实施边界证据 blob 不一致");
  }
  return workingBlob;
}

function readRequiredJson(repo, relativePath) {
  const absolute = resolve(repo, relativePath);
  if (!existsSync(absolute)) {
    throw new Error(`公开快照缺账本文件:${relativePath}`);
  }
  try {
    return JSON.parse(readFileSync(absolute, "utf8"));
  } catch {
    throw new Error(`公开快照账本 JSON 非法:${relativePath}`);
  }
}

function recordedBoundariesFromLedgers(repo) {
  const ledger = readRequiredJson(repo, LEDGER_JSON);
  const integrity = readRequiredJson(repo, INTEGRITY_JSON);
  const semantic = readRequiredJson(repo, SEMANTIC_JSON);
  const publication = readRequiredJson(repo, PUBLICATION_JSON);
  const values = [
    ledger?.generatedFrom?.remediationEnd,
    integrity?.generatedFrom?.remediationEnd,
    integrity?.workingTreeSnapshot?.implementationBoundary,
    semantic?.generatedFrom?.remediationEnd,
    publication?.implementationBoundary
  ];
  if (values.some((value) => !SHA_RE.test(String(value ?? "").toLowerCase()))) {
    throw new Error("公开快照账本缺 implementationBoundary");
  }
  const normalized = values.map((value) => String(value).toLowerCase());
  if (new Set(normalized).size !== 1) {
    throw new Error("公开快照账本 implementationBoundary 不一致");
  }
  return normalized[0];
}

function assertOneShotPath(git, relativePath, head) {
  const touching = commitsTouchingPath(git, relativePath, head);
  if (touching.length === 0) {
    throw new Error(`实施边界证据尚未以一次性提交入库:${relativePath}`);
  }
  if (touching.length !== 1) {
    throw new Error(`实施边界证据路径被再次修改:${relativePath}`);
  }
  return touching[0];
}

function assertEvidencePaths(git, sha) {
  const mixed = commitPaths(git, sha).filter((path) => !isAllowedEvidencePath(path));
  if (mixed.length > 0) {
    throw new Error(`实施边界证据提交含实施路径:${mixed.join(",")}`);
  }
}

function requirePublicSnapshot(git, sha, message) {
  const snapshot = identifyPublicSnapshot(git, sha);
  if (!snapshot) {
    throw new Error(message);
  }
  return snapshot;
}

function verifyPublicSnapshotChain(git, baselineSha, head) {
  const headSha = gitRequired(git, ["rev-parse", "--verify", `${head}^{commit}`], `无法解析 HEAD:${head}`)
    .trim()
    .toLowerCase();
  const baseline = requirePublicSnapshot(git, baselineSha, "公开快照边界引入提交不是合法 snapshot");
  try {
    git(["merge-base", "--is-ancestor", baselineSha, headSha]);
  } catch {
    throw new Error("公开快照 HEAD 不包含边界引入提交");
  }
  const after = gitRequired(
    git,
    ["rev-list", "--reverse", `${baselineSha}..${headSha}`],
    `无法枚举公开快照链:${baselineSha}..${headSha}`
  )
    .split("\n")
    .map((row) => row.trim().toLowerCase())
    .filter(Boolean);
  let previous = baseline;
  for (const sha of after) {
    const snap = requirePublicSnapshot(git, sha, "公开快照链含非 snapshot 提交");
    if (snap.parents.length !== 1) {
      throw new Error("公开快照链提交必须恰好一个 parent");
    }
    if (snap.parents[0].toLowerCase() !== previous.sha) {
      throw new Error("公开快照 parent 未衔接到上一 snapshot");
    }
    const mixed = commitPaths(git, sha).filter((path) => !isAllowedEvidencePath(path) && !AVAILABILITY_SET.has(path));
    const html = commitPaths(git, sha).filter((path) => AVAILABILITY_SET.has(path));
    if (mixed.length > 0 || (html.length > 0 && !isAvailabilityTransitionCommit(git, sha))) {
      throw new Error(`冻结边界之后出现未入账实施提交:${sha}`);
    }
    previous = snap;
  }
  if (after.length === 0) {
    if (headSha !== baseline.sha) {
      throw new Error("公开快照链不完整");
    }
  } else if (after[after.length - 1] !== headSha) {
    throw new Error("公开快照链不完整");
  }
  return { baseline, headSnapshot: previous };
}

function verifyInternalHistory({ git, relativePath, head, document }) {
  const boundary = document.implementationBoundary;
  const evidenceCommit = assertOneShotPath(git, relativePath, head);
  const parents = parentsOf(git, evidenceCommit);
  if (parents.length !== 1) {
    throw new Error("实施边界证据提交必须恰好一个 parent");
  }
  if (parents[0] !== boundary) {
    throw new Error("实施边界证据提交的第一父提交与记录 SHA 不一致");
  }
  assertEvidencePaths(git, evidenceCommit);
  try {
    git(["merge-base", "--is-ancestor", boundary, head]);
  } catch {
    throw new Error("当前 HEAD 不包含审计实施边界");
  }
  const leaked = leakedImplementationAfterBoundary(boundary, git, head);
  if (leaked.length > 0) {
    throw new Error(`冻结边界之后出现未入账实施提交:${leaked.join(",")}`);
  }
  return {
    mode: "internal_history",
    implementationBoundary: boundary,
    leakBaseline: boundary,
    evidenceCommit,
    publicBaselineCommit: null,
    publicSourceSha: null,
    publicTree: null,
    document
  };
}

function verifyPublicSnapshotMode({ git, repo, relativePath, head, document, snapshot }) {
  const boundary = document.implementationBoundary;
  const ledgerBoundary = recordedBoundariesFromLedgers(repo);
  if (ledgerBoundary !== boundary) {
    throw new Error("公开快照账本 implementationBoundary 与边界证据不一致");
  }
  const publicBaselineCommit = assertOneShotPath(git, relativePath, head);
  verifyPublicSnapshotChain(git, publicBaselineCommit, head);
  const leaked = leakedImplementationAfterBoundary(publicBaselineCommit, git, head);
  if (leaked.length > 0) {
    throw new Error(`冻结边界之后出现未入账实施提交:${leaked.join(",")}`);
  }
  return {
    mode: "public_snapshot",
    implementationBoundary: boundary,
    leakBaseline: publicBaselineCommit,
    evidenceCommit: publicBaselineCommit,
    publicBaselineCommit,
    publicSourceSha: snapshot.internalSourceSha,
    publicTree: snapshot.publicTree,
    document
  };
}

export function verifyImplementationBoundaryProtocol({
  repo,
  git,
  relativePath = IMPLEMENTATION_BOUNDARY_RELATIVE,
  head = "HEAD"
}) {
  assertBoundaryFileAlignment(git, repo, relativePath, head);
  const workingPath = resolve(repo, relativePath);
  const document = parseImplementationBoundaryDocument(readFileSync(workingPath, "utf8"));

  const object = classifyGitObject(git, document.implementationBoundary);
  if (object.kind === "commit") {
    return verifyInternalHistory({ git, relativePath, head, document });
  }
  if (object.kind !== "missing") {
    throw new Error(`实施边界 SHA 对象类型非法:${object.kind}`);
  }
  const snapshot = identifyPublicSnapshot(git, head);
  if (!snapshot) {
    throw new Error("实施边界 SHA 在当前仓库不是提交，且当前 HEAD 不是合法公开快照");
  }
  return verifyPublicSnapshotMode({ git, repo, relativePath, head, document, snapshot });
}

export function implementationBoundaryJson(implementationBoundary) {
  return `${JSON.stringify(
    {
      schemaVersion: IMPLEMENTATION_BOUNDARY_SCHEMA_VERSION,
      purpose: "一次性实施边界证据：记录代码提交 SHA，由紧随其后的唯一证据提交引入且永不修改。",
      implementationBoundary,
      rule: "internal-history: introducing commit is a single-parent evidence commit whose parent equals implementationBoundary. public-snapshot: current HEAD is a SayDo snapshot; the unique introducing snapshot is the public leak baseline. The path is committed exactly once; working tree, index and HEAD blobs match; the file is a regular file."
    },
    null,
    2
  )}\n`;
}
