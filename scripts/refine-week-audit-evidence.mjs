#!/usr/bin/env node

// 为已经人工 triage 的周审计裁决补齐逐 SHA / 逐文档的冻结 diff 证据。
// 本脚本不产生 finding、不改变 findingIds；它只把现有人工结论绑定到可由 git 反查的
// blob、行号、摘录摘要及同提交实现/测试路径，避免用文件名或通用模板冒充逐项读回。

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const repo = resolve(import.meta.dirname, "..");
const ledgerPath = resolve(repo, "research/week-audit/2026-08-22-ledger.json");
const semanticPath = resolve(repo, "research/week-audit/2026-08-22-semantic-review.json");
const reviewFindingAnchorPath = resolve(repo, "research/week-audit/2026-08-23-review-finding-anchor.json");
const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
const semantic = JSON.parse(readFileSync(semanticPath, "utf8"));
const reviewFindingAnchor = JSON.parse(readFileSync(reviewFindingAnchorPath, "utf8"));

const git = (args, options = {}) =>
  execFileSync("git", args, {
    cwd: repo,
    maxBuffer: 64 * 1024 * 1024,
    ...options
  });
const gitText = (args) => git(args, { encoding: "utf8" });
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const short = (value) => value.slice(0, 7);
const unique = (values) => [...new Set(values)];
const isTest = (path) =>
  /(^|\/)(test|tests|e2e)(\/|$)/.test(path) ||
  /\.(test|spec)\.[cm]?[jt]sx?$/.test(path) ||
  path.startsWith("scripts/test-");
const documentRoots = ["docs/", "research/", "history/", "prompts/", "deploy/", "artifacts/"];
const isDocument = (path) =>
  path.endsWith(".md") ||
  ["LICENSE", "NOTICE"].includes(path) ||
  documentRoots.some((prefix) => path.startsWith(prefix)) ||
  path.startsWith("e2e/evidence/");
const classify = (path) => (isDocument(path) ? "document" : isTest(path) ? "test" : "implementation");
const parentCache = new Map();

function parentOf(commit) {
  if (!parentCache.has(commit)) {
    const parts = gitText(["rev-list", "--parents", "-n", "1", commit]).trim().split(/\s+/);
    parentCache.set(commit, parts[1] ?? null);
  }
  return parentCache.get(commit);
}

function refHasPath(ref, path) {
  try {
    git(["cat-file", "-e", `${ref}:${path}`], { stdio: ["ignore", "ignore", "ignore"] });
    return true;
  } catch {
    return false;
  }
}

function safeExcerpt(value) {
  const normalized = [...value.replaceAll("\0", "")]
    .map((character) => {
      const codePoint = character.codePointAt(0);
      const forbidden =
        codePoint === 0xfe0f ||
        (codePoint >= 0x2600 && codePoint <= 0x27bf) ||
        (codePoint >= 0x1f000 && codePoint <= 0x1faff) ||
        /\p{Emoji_Presentation}/u.test(character);
      return forbidden ? `[U+${codePoint.toString(16).toUpperCase()}]` : character;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.length > 220 ? `${normalized.slice(0, 217)}...` : normalized;
}

function firstChangedLine(commit, path) {
  const parent = parentOf(commit);
  const diffArgs = parent
    ? ["diff", "--no-ext-diff", "--unified=0", parent, commit, "--", path]
    : ["show", "--no-ext-diff", "--format=", "--unified=0", commit, "--", path];
  const lines = gitText(diffArgs).split("\n");
  let oldLine = 0;
  let newLine = 0;
  let firstDeletion = null;
  for (const line of lines) {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      const excerpt = safeExcerpt(line.slice(1));
      if (excerpt !== "") return { side: "commit", ref: commit, line: newLine, excerpt };
      newLine += 1;
      continue;
    }
    if (line.startsWith("-") && !line.startsWith("---")) {
      const excerpt = safeExcerpt(line.slice(1));
      if (excerpt !== "") firstDeletion ??= { side: "parent", ref: parent, line: oldLine, excerpt };
      oldLine += 1;
      continue;
    }
    if (line.startsWith(" ")) {
      oldLine += 1;
      newLine += 1;
    }
  }
  return firstDeletion;
}

function isBinaryChange(commit, path) {
  const parent = parentOf(commit);
  const args = parent
    ? ["diff", "--numstat", parent, commit, "--", path]
    : ["show", "--numstat", "--format=", commit, "--", path];
  const line = gitText(args).split("\n").find(Boolean);
  if (!line) return false;
  const [added, deleted] = line.split("\t");
  return added === "-" && deleted === "-";
}

function assertionFor(commit, path) {
  const parent = parentOf(commit);
  const commitHasPath = refHasPath(commit, path);
  const fallbackRef = commitHasPath ? commit : parent;
  if (!fallbackRef || !refHasPath(fallbackRef, path)) {
    throw new Error(`无法为 ${short(commit)}:${path} 定位冻结 blob`);
  }
  const changed = firstChangedLine(commit, path);
  const chosenRef = changed?.ref && refHasPath(changed.ref, path) ? changed.ref : fallbackRef;
  const blob = gitText(["rev-parse", `${chosenRef}:${path}`]).trim();
  const bytes = Number(gitText(["cat-file", "-s", blob]).trim());
  const content = git(["cat-file", "blob", blob]);
  const binary = isBinaryChange(commit, path);
  const assertion = {
    commit,
    path,
    category: classify(path),
    side: chosenRef === commit ? "commit" : "parent",
    blob,
    bytes,
    contentSha256: sha256(content)
  };
  if (!binary && changed) {
    const text = content.toString("utf8");
    const textLines = text.split("\n");
    const requestedLine = changed?.line && changed.line > 0 ? changed.line : 1;
    const line = Math.min(requestedLine, Math.max(textLines.length, 1));
    const excerpt = safeExcerpt(textLines[line - 1] ?? changed?.excerpt ?? "");
    return { ...assertion, line, excerpt, excerptSha256: sha256(excerpt) };
  }
  return binary ? { ...assertion, binary: true } : { ...assertion, identityOnly: true };
}

function keywords(...values) {
  return unique(
    values
      .join(" ")
      .toLowerCase()
      .split(/[^a-z0-9\u4e00-\u9fff]+/)
      .filter((value) => value.length >= 2)
  );
}

function rankPaths(paths, context, limit = 2) {
  const words = keywords(context);
  return [...paths]
    .map((path) => {
      const lower = path.toLowerCase();
      const base = lower.split("/").at(-1) ?? lower;
      const score = words.reduce((total, word) => total + (base.includes(word) ? 4 : lower.includes(word) ? 2 : 0), 0);
      return { path, score };
    })
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path, "en"))
    .slice(0, limit)
    .map((row) => row.path);
}

function evidenceRef(assertion) {
  const suffix = assertion.binary || assertion.identityOnly
    ? `blob=${assertion.blob}&bytes=${assertion.bytes}`
    : `side=${assertion.side}&line=${assertion.line}&blob=${assertion.blob}`;
  return `${assertion.path}#commit=${assertion.commit}&${suffix}`;
}

function assertionSummary(assertion) {
  if (assertion.binary || assertion.identityOnly) {
    return `${assertion.path} 的 blob ${assertion.blob.slice(0, 12)}（${assertion.bytes} bytes）`;
  }
  return `${assertion.path} ${assertion.side}:${assertion.line} 的「${assertion.excerpt}」`;
}

function reviewFindingProjection(commitRows, documentRows) {
  return {
    commits: commitRows.map(({ sha, findingIds }) => ({
      sha,
      findingIds
    })),
    documents: documentRows.map(({ path, findingIds }) => ({
      path,
      findingIds
    }))
  };
}

for (const row of [...semantic.commitDecisions, ...semantic.documentDecisions]) {
  const key = row.sha ?? row.path;
  if (
    !Array.isArray(row.findingIds)
  ) {
    throw new Error(`缺失冻结人工裁决字段:${key}`);
  }
}
const reviewFindingDigestBefore = sha256(
  JSON.stringify(reviewFindingProjection(semantic.commitDecisions, semantic.documentDecisions))
);
if (
  reviewFindingAnchor.schemaVersion !== 1 ||
  reviewFindingAnchor.scope?.mainCommits !== ledger.mainCommits.length ||
  reviewFindingAnchor.scope?.documents !== ledger.documents.length ||
  reviewFindingAnchor.projectionSha256 !== reviewFindingDigestBefore
) {
  throw new Error("review findingIds 与 refiner 外部预固定 anchor 不一致");
}

const mainBySha = new Map(ledger.mainCommits.map((row) => [row.sha, row]));
const commitDecisionBySha = new Map(semantic.commitDecisions.map((row) => [row.sha, row]));
const documentDecisionByPath = new Map(semantic.documentDecisions.map((row) => [row.path, row]));

const commitDecisions = ledger.mainCommits.map((commit) => {
  const prior = commitDecisionBySha.get(commit.sha);
  if (!prior) throw new Error(`缺人工 commit 裁决:${commit.sha}`);
  const selectedPaths = [
    ...rankPaths(commit.docs, commit.subject, 1),
    ...rankPaths(commit.implementation, commit.subject, 1),
    ...rankPaths(commit.tests, commit.subject, 1)
  ];
  const changeAssertions = selectedPaths.map((path) => assertionFor(commit.sha, path));
  if (changeAssertions.length === 0) throw new Error(`提交没有可锚差异:${commit.sha}`);
  const categoryProof = [
    commit.docs.length > 0 ? `文档 ${commit.docs.length}` : null,
    commit.implementation.length > 0 ? `实现 ${commit.implementation.length}` : null,
    commit.tests.length > 0 ? `测试 ${commit.tests.length}` : null
  ].filter(Boolean).join("、");
  const {
    decision: _contaminatedDecision,
    claim: _contaminatedClaim,
    rationale: _contaminatedRationale,
    ...reviewFindingLink
  } = prior;
  return {
    ...reviewFindingLink,
    evidenceStatus: "mechanically_evidenced",
    remediationLinkStatus: prior.findingIds.length > 0 ? "linked_to_reported_findings" : "no_manual_disposition_recorded",
    coverage: {
      documents: commit.docs.length,
      implementation: commit.implementation.length,
      tests: commit.tests.length,
      assertedCategories: unique(changeAssertions.map((row) => row.category))
    },
    documentRefs: commit.docs,
    implementationRefs: commit.implementation,
    testRefs: commit.tests,
    changeAssertions,
    evidenceRefs: changeAssertions.map(evidenceRef),
    mechanicalIdentityClaim: `${short(commit.sha)} 的提交主题为「${safeExcerpt(commit.subject)}」；冻结分类为 ${commit.category}，实际触及文档 ${commit.docs.length}、实现 ${commit.implementation.length}、测试 ${commit.tests.length}。`,
    mechanicalEvidenceSummary: `${short(commit.sha)} 的 ${categoryProof} 由 ${changeAssertions.map(assertionSummary).join("；")} 冻结；该字段只描述 diff 身份,不产生逐项正确性裁决。`
  };
});

const documentDecisions = ledger.documents.map((document) => {
  const prior = documentDecisionByPath.get(document.path);
  if (!prior) throw new Error(`缺人工 document 裁决:${document.path}`);
  const changeAssertions = document.commits.map((commit) => assertionFor(commit, document.path));
  const correlations = document.commits.map((sha) => {
    const commit = mainBySha.get(sha);
    if (!commit) throw new Error(`文档引用非主线提交:${document.path}:${sha}`);
    const context = `${document.path} ${commit.subject}`;
    return {
      commit: sha,
      implementationRefs: rankPaths(commit.implementation, context, 2),
      testRefs: rankPaths(commit.tests, context, 2)
    };
  });
  const implementationRefs = unique(correlations.flatMap((row) => row.implementationRefs));
  const testRefs = unique(correlations.flatMap((row) => row.testRefs));
  const last = changeAssertions.at(-1);
  const {
    decision: _contaminatedDecision,
    claim: _contaminatedClaim,
    rationale: _contaminatedRationale,
    ...reviewFindingLink
  } = prior;
  return {
    ...reviewFindingLink,
    evidenceStatus: "mechanically_evidenced",
    remediationLinkStatus: prior.findingIds.length > 0 ? "linked_to_reported_findings" : "no_manual_disposition_recorded",
    commitRefs: document.commits,
    coverage: {
      linkedCommits: document.commits.length,
      changeAssertions: changeAssertions.length,
      correlatedImplementation: implementationRefs.length,
      correlatedTests: testRefs.length
    },
    implementationRefs,
    testRefs,
    correlations,
    changeAssertions,
    evidenceRefs: changeAssertions.map(evidenceRef),
    mechanicalIdentityClaim: `${document.path} 的冻结类型为 ${document.kind}，由 ${document.commits.length} 个主线提交触及；finding 链接与机械身份描述分离。`,
    mechanicalEvidenceSummary: `${document.path} 的 ${document.commits.length} 个触及提交已逐一绑定 blob/行锚（${document.commits.map(short).join("/")}）；末次为 ${short(last.commit)} 的 ${assertionSummary(last)}。correlations 只列同提交候选路径,不构成语义相关性或人工裁决。`
  };
});

const reviewFindingDigestAfter = sha256(
  JSON.stringify(reviewFindingProjection(commitDecisions, documentDecisions))
);
if (reviewFindingDigestAfter !== reviewFindingDigestBefore) {
  throw new Error("证据补强意外改写了冻结 review findingIds");
}
const {
  humanDecisionDigest: _oldHumanDecisionDigest,
  humanDecisionAnchor: _oldHumanDecisionAnchor,
  ...adjudicationBase
} = semantic.adjudication ?? {};
const { humanDecisionAnchor: _oldGeneratedHumanAnchor, ...generatedFromBase } = ledger.generatedFrom;

const output = {
  ...semantic,
  schemaVersion: 6,
  adjudication: {
    ...adjudicationBase,
    reviewedAt: new Date().toISOString(),
    reviewFindingDigest: reviewFindingAnchor.projectionSha256,
    reviewFindingAnchor: "research/week-audit/2026-08-23-review-finding-anchor.json",
    manualBasis: "docs/review/2026-08-23-week-audit-faststart-release.md §3–§5；人工部分仅限该报告明确登记的 F18–F28 finding 及 anchor 中的非空逐项映射。",
    supersedes: "旧 refiner 曾机械生成 decision/claim/rationale；schema 6 将三者全部删除，不再把 334 行 mechanically evidenced 记录宣称为逐项人工正确性裁决。",
    method: "逐 SHA 从真实 diff 读取文档/实现/测试锚，逐文档对每个触及提交记录 blob、bytes、内容 SHA-256、非空真实变更行或二进制/确无非空文本差异的同一性身份。findingIds 仅表示与人工报告 finding 的可追溯链接；空 findingIds 明确不等于人工判定正确。mechanicalIdentityClaim/mechanicalEvidenceSummary 与 correlations 均不宣称语义相关或正确性。脚本不产生 finding 或裁决。"
  },
  generatedFrom: {
    ...generatedFromBase,
    refManifest: "research/week-audit/2026-08-22-ref-manifest.json"
  },
  coverageRule: "commitDecisions/documentDecisions 键集合精确覆盖 115/219，但这里只证明机械证据覆盖；commit assertion 路径必须属于该 SHA，document assertion 的 commit 集必须等于 commitRefs；私有 --check 反查 blob/bytes/内容及真实 diff hunk，公开 --check-bundle 验结构、review finding 映射与 bundle 摘要。",
  commitDecisions,
  documentDecisions
};

writeFileSync(semanticPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`[ok] semantic evidence refined: commits=${commitDecisions.length} documents=${documentDecisions.length}`);
