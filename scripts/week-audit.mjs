#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { writeWeekAuditOutputs } from "./release-file-transaction.mjs";
import { safeExcerpt } from "./public-text-redaction.mjs";
import { isExcludedByExactSet, readPublicExcludeExactSet } from "./check-public-tree-privacy.mjs";
import {
  assertPublicationExactSet,
  privateExcludedIdentity,
  unpublishedIndexedSource
} from "./week-audit-publication.mjs";

const repo = resolve(import.meta.dirname, "..");
const remediationEnd = "b768089585d710255d61a693c2489ccf425f446f"; // 最终实施冻结 SHA；后续证据载体提交因自引用排除。
const config = {
  cutoff: "2026-08-15T00:00:00+08:00",
  refsFrozenAt: "2026-08-22T22:30:44+08:00",
  base: "8a8247a347238b6bf6ad649f1162f1934540eafd",
  rangeEnd: "3fccf4a704ad9a5d8e013baaefb67c66a5737cba",
  remediationEnd,
  markdownOutput: "docs/review/2026-08-22-week-audit-ledger.md",
  jsonOutput: "research/week-audit/2026-08-22-ledger.json",
  semanticOutput: "research/week-audit/2026-08-22-semantic-review.json",
  integrityOutput: "research/week-audit/2026-08-22-bundle-integrity.json",
  refManifest: "research/week-audit/2026-08-22-ref-manifest.json",
  publicationManifest: "research/week-audit/2026-08-23-publication-manifest.json",
  reviewFindingAnchor: "research/week-audit/2026-08-23-review-finding-anchor.json",
  crossLinks: "research/week-audit/2026-08-23-remediation-cross-links.json",
  remediationJsonOutput: "research/week-audit/2026-08-23-remediation-ledger.json",
  remediationMarkdownOutput: "docs/review/2026-08-23-remediation-ledger.md"
};

const mode = process.argv[2];
if (!["--write", "--check", "--check-bundle"].includes(mode)) {
  console.error("用法:node scripts/week-audit.mjs <--write|--check|--check-bundle>");
  process.exit(2);
}

const sha256Text = (value) => createHash("sha256").update(value).digest("hex");
const sameSet = (a, b) =>
  a.length === b.length &&
  new Set(a).size === a.length &&
  [...a].sort().every((value, index) => value === [...b].sort()[index]);
const generatedOutputs = new Set([
  config.markdownOutput,
  config.jsonOutput,
  config.semanticOutput,
  config.integrityOutput,
  config.publicationManifest,
  config.remediationJsonOutput,
  config.remediationMarkdownOutput
]);
// 排除清单从权威源(publish-public-snapshot.sh 的 PUBLIC_EXCLUDE)动态读取，而不是在
// week-audit-publication.mjs 里另存一份常量：两处独立定义迟早漂移，而这份清单决定
// 「哪些路径不进公开树」，一旦与真实发布脚本不一致，审计就会对着错误的集合下结论。
const publicExcludes = readPublicExcludeExactSet();
const isPublicExcluded = (path) => isExcludedByExactSet(path, publicExcludes);

function contentFingerprint(path) {
  const absolute = resolve(repo, path);
  try {
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) {
      const target = readlinkSync(absolute);
      return { kind: "symlink", mode: stat.mode & 0o777, bytes: Buffer.byteLength(target), sha256: sha256Text(`symlink:${target}`) };
    }
    if (stat.isFile()) {
      const content = readFileSync(absolute);
      return { kind: "file", mode: stat.mode & 0o777, bytes: stat.size, sha256: createHash("sha256").update(content).digest("hex") };
    }
    return { kind: "other", mode: stat.mode & 0o777, bytes: stat.size, sha256: null };
  } catch {
    return { kind: "missing", mode: null, bytes: 0, sha256: null };
  }
}

function verifyRecordedSnapshot(integrity) {
  const snapshot = integrity.workingTreeSnapshot;
  const entries = snapshot?.entries;
  if (
    snapshot?.schemaVersion !== 2 ||
    snapshot.implementationBoundary !== config.remediationEnd ||
    !Array.isArray(entries)
  ) {
    throw new Error("账本 bundle 缺稳定 implementationBoundary 工作树快照");
  }
  for (const entry of entries) {
    const actual = contentFingerprint(entry.path);
    if (
      actual.kind !== entry.kind ||
      actual.mode !== entry.mode ||
      actual.bytes !== entry.bytes ||
      actual.sha256 !== entry.sha256
    ) {
      throw new Error(`审计后工作树内容漂移:${entry.path}`);
    }
  }
  const listed = (args) =>
    execFileSync("git", args, {
      cwd: repo,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"]
    })
      .split("\0")
      .filter(Boolean);
  const recorded = new Set(entries.map((entry) => entry.path));
  const dirty = [
    ...listed(["diff", "--name-only", "-z"]),
    ...listed(["diff", "--cached", "--name-only", "-z"])
  ].filter((path) => !generatedOutputs.has(path));
  for (const path of dirty) {
    if (!recorded.has(path)) {
      throw new Error(isPublicExcluded(path) ? "审计后出现未入账工作树路径" : `审计后出现未入账工作树路径:${path}`);
    }
  }
}

function assertionEvidenceRef(assertion) {
  const suffix = assertion.binary || assertion.identityOnly
    ? `blob=${assertion.blob}&bytes=${assertion.bytes}`
    : `side=${assertion.side}&line=${assertion.line}&blob=${assertion.blob}`;
  return `${assertion.path}#commit=${assertion.commit}&${suffix}`;
}

function validateAssertionShape(assertion, key) {
  if (!assertion || typeof assertion !== "object") throw new Error(`语义证据断言非法:${key}`);
  if (!/^[0-9a-f]{40}$/.test(assertion.commit ?? "")) throw new Error(`语义证据 commit 非法:${key}`);
  if (typeof assertion.path !== "string" || assertion.path === "") throw new Error(`语义证据 path 非法:${key}`);
  if (!["document", "implementation", "test"].includes(assertion.category)) {
    throw new Error(`语义证据 category 非法:${key}:${String(assertion.category)}`);
  }
  if (!["commit", "parent"].includes(assertion.side)) throw new Error(`语义证据 side 非法:${key}`);
  if (!/^[0-9a-f]{40}$/.test(assertion.blob ?? "")) throw new Error(`语义证据 blob 非法:${key}`);
  if (!Number.isInteger(assertion.bytes) || assertion.bytes < 0) throw new Error(`语义证据 bytes 非法:${key}`);
  if (!/^[0-9a-f]{64}$/.test(assertion.contentSha256 ?? "")) {
    throw new Error(`语义证据内容摘要非法:${key}`);
  }
  if (
    (assertion.binary !== undefined && assertion.binary !== true) ||
    (assertion.identityOnly !== undefined && assertion.identityOnly !== true) ||
    (assertion.binary === true && assertion.identityOnly === true)
  ) {
    throw new Error(`语义证据身份类型非法:${key}`);
  }
  if (assertion.binary === true || assertion.identityOnly === true) return;
  if (!Number.isInteger(assertion.line) || assertion.line < 1) throw new Error(`语义证据行号非法:${key}`);
  if (typeof assertion.excerpt !== "string" || assertion.excerpt === "") {
    throw new Error(`语义证据摘录非法:${key}`);
  }
  if (assertion.excerptSha256 !== sha256Text(assertion.excerpt)) throw new Error(`语义证据摘录摘要非法:${key}`);
}

function reviewFindingProjection(commitRows, documentRows) {
  return {
    commits: commitRows.map(({ sha, findingIds }) => ({ sha, findingIds })),
    documents: documentRows.map(({ path, findingIds }) => ({ path, findingIds }))
  };
}

function validateSemanticStructure(ledger, semantic) {
  if (semantic.schemaVersion !== 6) throw new Error(`审计证据 schemaVersion 异常:${String(semantic.schemaVersion)}`);
  if (!Array.isArray(semantic.commitDecisions) || !Array.isArray(semantic.documentDecisions)) {
    throw new Error("人工语义裁决缺 commitDecisions/documentDecisions");
  }
  if (
    "humanDecisionDigest" in (semantic.adjudication ?? {}) ||
    "humanDecisionAnchor" in (semantic.adjudication ?? {}) ||
    "humanDecisionAnchor" in (semantic.generatedFrom ?? {})
  ) {
    throw new Error("schema 6 仍携带已废弃的 human decision 来源声明");
  }
  const commitBySha = new Map(ledger.mainCommits.map((row) => [row.sha, row]));
  const documentByPath = new Map(ledger.documents.map((row) => [row.path, row]));
  if (!sameSet([...commitBySha.keys()], semantic.commitDecisions.map((row) => row.sha))) {
    throw new Error("语义复核未精确覆盖 bundle 中全部主线提交");
  }
  if (!sameSet([...documentByPath.keys()], semantic.documentDecisions.map((row) => row.path))) {
    throw new Error("语义复核未精确覆盖 bundle 中全部文档型资产");
  }

  for (const decision of semantic.commitDecisions) {
    const commit = commitBySha.get(decision.sha);
    const key = decision.sha;
    if (!commit) throw new Error(`语义裁决引用未知提交:${key}`);
    if (!Array.isArray(decision.findingIds)) throw new Error(`人工语义裁决缺 findingIds:${key}`);
    if ("decision" in decision || "claim" in decision || "rationale" in decision) {
      throw new Error(`语义裁决仍含已废弃的污染字段:${key}`);
    }
    if (
      decision.evidenceStatus !== "mechanically_evidenced" ||
      decision.remediationLinkStatus !==
        (decision.findingIds.length > 0 ? "linked_to_reported_findings" : "no_manual_disposition_recorded")
    ) {
      throw new Error(`审计记录机械证据/人工边界非法:${key}`);
    }
    if (typeof decision.mechanicalIdentityClaim !== "string" || !decision.mechanicalIdentityClaim.includes(key.slice(0, 7))) {
      throw new Error(`语义裁决缺机械身份描述:${key}`);
    }
    if (typeof decision.mechanicalEvidenceSummary !== "string" || decision.mechanicalEvidenceSummary === "") {
      throw new Error(`语义裁决缺机械证据摘要:${key}`);
    }
    if (!sameSet(decision.documentRefs ?? [], commit.docs)) throw new Error(`语义裁决文档集合漂移:${key}`);
    if (!sameSet(decision.implementationRefs ?? [], commit.implementation)) throw new Error(`语义裁决实现集合漂移:${key}`);
    if (!sameSet(decision.testRefs ?? [], commit.tests)) throw new Error(`语义裁决测试集合漂移:${key}`);
    if (!Array.isArray(decision.changeAssertions) || decision.changeAssertions.length === 0) {
      throw new Error(`人工语义裁决缺冻结差异证据:${key}`);
    }
    const expectedCategories = [
      commit.docs.length > 0 ? "document" : null,
      commit.implementation.length > 0 ? "implementation" : null,
      commit.tests.length > 0 ? "test" : null
    ].filter(Boolean);
    if (!sameSet(decision.changeAssertions.map((row) => row.category), expectedCategories)) {
      throw new Error(`语义裁决未逐类别落证:${key}`);
    }
    for (const assertion of decision.changeAssertions) {
      validateAssertionShape(assertion, key);
      if (assertion.commit !== key) throw new Error(`语义证据提交错配:${key}:${assertion.path}`);
      const allowed = assertion.category === "document"
        ? commit.docs
        : assertion.category === "test"
          ? commit.tests
          : commit.implementation;
      if (!allowed.includes(assertion.path)) throw new Error(`语义证据路径不属于提交类别:${key}:${assertion.path}`);
    }
    const expectedEvidenceRefs = decision.changeAssertions.map(assertionEvidenceRef);
    if (!sameSet(decision.evidenceRefs ?? [], expectedEvidenceRefs)) throw new Error(`语义证据引用集合漂移:${key}`);
  }

  for (const decision of semantic.documentDecisions) {
    const document = documentByPath.get(decision.path);
    const key = decision.path;
    if (!document) throw new Error(`语义裁决引用未知文档:${key}`);
    if (!Array.isArray(decision.findingIds)) throw new Error(`人工语义裁决缺 findingIds:${key}`);
    if ("decision" in decision || "claim" in decision || "rationale" in decision) {
      throw new Error(`语义裁决仍含已废弃的污染字段:${key}`);
    }
    if (
      decision.evidenceStatus !== "mechanically_evidenced" ||
      decision.remediationLinkStatus !==
        (decision.findingIds.length > 0 ? "linked_to_reported_findings" : "no_manual_disposition_recorded")
    ) {
      throw new Error(`审计记录机械证据/人工边界非法:${key}`);
    }
    if (typeof decision.mechanicalIdentityClaim !== "string" || !decision.mechanicalIdentityClaim.includes(key)) {
      throw new Error(`语义裁决缺机械身份描述:${key}`);
    }
    if (typeof decision.mechanicalEvidenceSummary !== "string" || decision.mechanicalEvidenceSummary === "") {
      throw new Error(`语义裁决缺机械证据摘要:${key}`);
    }
    if (!sameSet(decision.commitRefs ?? [], document.commits)) throw new Error(`文档裁决提交集合漂移:${key}`);
    if (!Array.isArray(decision.changeAssertions) || decision.changeAssertions.length !== document.commits.length) {
      throw new Error(`文档裁决未逐提交落证:${key}`);
    }
    if (!sameSet(decision.changeAssertions.map((row) => row.commit), document.commits)) {
      throw new Error(`文档裁决证据提交集合漂移:${key}`);
    }
    for (const assertion of decision.changeAssertions) {
      validateAssertionShape(assertion, `${key}:${assertion.commit}`);
      if (assertion.path !== key || assertion.category !== "document") {
        throw new Error(`文档裁决证据路径或类别错配:${key}:${assertion.commit}`);
      }
    }
    if (!Array.isArray(decision.correlations) || !sameSet(decision.correlations.map((row) => row.commit), document.commits)) {
      throw new Error(`文档裁决 correlations 未精确覆盖提交:${key}`);
    }
    for (const correlation of decision.correlations) {
      const commit = commitBySha.get(correlation.commit);
      if (!commit) throw new Error(`文档裁决 correlation 引用未知提交:${key}:${correlation.commit}`);
      if (!Array.isArray(correlation.implementationRefs) || !Array.isArray(correlation.testRefs)) {
        throw new Error(`文档裁决 correlation 结构非法:${key}:${correlation.commit}`);
      }
      if (correlation.implementationRefs.some((path) => !commit.implementation.includes(path))) {
        throw new Error(`文档裁决 correlation 实现路径错配:${key}:${correlation.commit}`);
      }
      if (correlation.testRefs.some((path) => !commit.tests.includes(path))) {
        throw new Error(`文档裁决 correlation 测试路径错配:${key}:${correlation.commit}`);
      }
    }
    const correlatedImplementation = [...new Set(decision.correlations.flatMap((row) => row.implementationRefs))];
    const correlatedTests = [...new Set(decision.correlations.flatMap((row) => row.testRefs))];
    if (!sameSet(decision.implementationRefs ?? [], correlatedImplementation)) {
      throw new Error(`文档裁决实现聚合集合漂移:${key}`);
    }
    if (!sameSet(decision.testRefs ?? [], correlatedTests)) throw new Error(`文档裁决测试聚合集合漂移:${key}`);
    const expectedEvidenceRefs = decision.changeAssertions.map(assertionEvidenceRef);
    if (!sameSet(decision.evidenceRefs ?? [], expectedEvidenceRefs)) throw new Error(`文档语义证据引用集合漂移:${key}`);
  }

  const reviewFindingDigest = sha256Text(
    JSON.stringify(reviewFindingProjection(semantic.commitDecisions, semantic.documentDecisions))
  );
  const reviewFindingAnchor = JSON.parse(readFileSync(resolve(repo, config.reviewFindingAnchor), "utf8"));
  const nonEmptyCommitLinks = semantic.commitDecisions
    .filter((row) => row.findingIds.length > 0)
    .map(({ sha, findingIds }) => ({ sha, findingIds }));
  const nonEmptyDocumentLinks = semantic.documentDecisions
    .filter((row) => row.findingIds.length > 0)
    .map(({ path, findingIds }) => ({ path, findingIds }));
  if (
    reviewFindingAnchor.schemaVersion !== 1 ||
    reviewFindingAnchor.scope?.mainCommits !== ledger.mainCommits.length ||
    reviewFindingAnchor.scope?.documents !== ledger.documents.length ||
    reviewFindingAnchor.scope?.projection !== "commit:{sha,findingIds};document:{path,findingIds}" ||
    !Array.isArray(reviewFindingAnchor.findingIds) ||
    !sameSet(reviewFindingAnchor.findingIds, (semantic.findings ?? []).map((finding) => finding.id)) ||
    reviewFindingAnchor.projectionSha256 !== reviewFindingDigest ||
    JSON.stringify(reviewFindingAnchor.commitFindingLinks) !== JSON.stringify(nonEmptyCommitLinks) ||
    JSON.stringify(reviewFindingAnchor.documentFindingLinks) !== JSON.stringify(nonEmptyDocumentLinks) ||
    semantic.adjudication?.reviewFindingDigest !== reviewFindingAnchor.projectionSha256 ||
    semantic.adjudication?.reviewFindingAnchor !== config.reviewFindingAnchor
  ) {
    throw new Error("review findingIds 未匹配 refiner 外部预固定 anchor");
  }
  if (typeof semantic.adjudication?.manualBasis !== "string" || semantic.adjudication.manualBasis === "") {
    throw new Error("人工裁决缺明确人工报告来源");
  }
}

function verifyPublicationManifest(manifest) {
  if (
    manifest.schemaVersion !== 2 ||
    manifest.implementationBoundary !== config.remediationEnd ||
    !Array.isArray(manifest.entries) ||
    !Array.isArray(manifest.generatedOutputs) ||
    !sameSet(manifest.publicExcludes ?? [], publicExcludes) ||
    !sameSet(manifest.generatedOutputs, [...generatedOutputs]) ||
    !Number.isInteger(manifest.privateExcludedCount) ||
    manifest.privateExcludedCount < 0 ||
    typeof manifest.privateExcludedDigest !== "string" ||
    !/^[0-9a-f]{64}$/.test(manifest.privateExcludedDigest)
  ) {
    throw new Error("公开发布全树 manifest 结构非法");
  }
  const entryPaths = manifest.entries.map((entry) => entry.path);
  const listed = (args) =>
    execFileSync("git", args, {
      cwd: repo,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"]
    })
      .split("\0")
      .filter(Boolean);
  const actualTracked = listed(["ls-files", "-z"]);
  const actualOthers = listed(["ls-files", "--others", "--exclude-standard", "-z"]);
  assertPublicationExactSet({
    livePaths: { tracked: actualTracked, others: actualOthers },
    entryPaths,
    generatedOutputs,
    publicExcludes,
    privateExcludedCount: manifest.privateExcludedCount,
    privateExcludedDigest: manifest.privateExcludedDigest,
    fingerprint: contentFingerprint
  });
  for (const entry of manifest.entries) {
    const actual = contentFingerprint(entry.path);
    if (
      actual.kind !== entry.kind ||
      actual.mode !== entry.mode ||
      actual.bytes !== entry.bytes ||
      actual.sha256 !== entry.sha256
    ) {
      throw new Error(`公开发布树内容漂移:${entry.path}`);
    }
  }
}

if (mode === "--check-bundle") {
  const read = (path) => readFileSync(resolve(repo, path), "utf8");
  const integrity = JSON.parse(read(config.integrityOutput));
  const ledgerText = read(config.jsonOutput);
  const markdownText = read(config.markdownOutput);
  const semanticText = read(config.semanticOutput);
  const refManifestText = read(config.refManifest);
  const publicationManifestText = read(config.publicationManifest);
  const reviewFindingAnchorText = read(config.reviewFindingAnchor);
  const crossLinksText = read(config.crossLinks);
  const remediationJsonText = read(config.remediationJsonOutput);
  const remediationMarkdownText = read(config.remediationMarkdownOutput);
  const files = {
    [config.jsonOutput]: ledgerText,
    [config.markdownOutput]: markdownText,
    [config.semanticOutput]: semanticText,
    [config.refManifest]: refManifestText,
    [config.publicationManifest]: publicationManifestText,
    [config.reviewFindingAnchor]: reviewFindingAnchorText,
    [config.crossLinks]: crossLinksText,
    [config.remediationJsonOutput]: remediationJsonText,
    [config.remediationMarkdownOutput]: remediationMarkdownText
  };
  for (const [path, content] of Object.entries(files)) {
    if (integrity.files?.[path] !== sha256Text(content)) throw new Error(`账本 bundle 摘要不一致:${path}`);
  }
  verifyRecordedSnapshot(integrity);
  const ledger = JSON.parse(ledgerText);
  const semantic = JSON.parse(semanticText);
  const refManifest = JSON.parse(refManifestText);
  const publicationManifest = JSON.parse(publicationManifestText);
  const remediation = JSON.parse(remediationJsonText);
  if (integrity.schemaVersion !== 6) throw new Error(`账本 bundle schemaVersion 异常:${String(integrity.schemaVersion)}`);
  if (
    refManifest.schemaVersion !== 1 ||
    refManifest.coverageClaim !== "recorded_ref_universe_only" ||
    refManifest.commitTimeCutoff !== ledger.generatedFrom.refsFrozenAt ||
    !Array.isArray(refManifest.refs) ||
    refManifest.refs.length === 0
  ) {
    throw new Error("账本 bundle 的 ref manifest 非法");
  }
  const manifestRefTips = refManifest.refs.map((row) => {
    if (typeof row.ref !== "string" || !/^refs\//.test(row.ref) || !/^[0-9a-f]{40}$/.test(row.tip ?? "")) {
      throw new Error(`账本 bundle 的 ref manifest 行非法:${JSON.stringify(row)}`);
    }
    return `${row.ref}@${row.tip}`;
  });
  if (new Set(manifestRefTips).size !== manifestRefTips.length) throw new Error("账本 bundle 的 ref manifest 含重复行");
  const ledgerRefTips = ledger.frozenRefTips.map((row) => `${row.ref}@${row.tip}`);
  if (!sameSet(manifestRefTips, ledgerRefTips)) throw new Error("账本 bundle 的 ref manifest 与冻结账本不一致");
  verifyPublicationManifest(publicationManifest);
  validateSemanticStructure(ledger, semantic);
  const historyMaterial = JSON.stringify({
    base: ledger.generatedFrom.base,
    rangeEnd: ledger.generatedFrom.rangeEnd,
    frozenRefTips: ledger.frozenRefTips,
    mainCommits: ledger.mainCommits,
    extraRefCommits: ledger.extraRefCommits,
    remediationCommits: remediation.commits
  });
  if (integrity.historyDigest !== sha256Text(historyMaterial)) throw new Error("账本历史物化摘要不一致");
  if (integrity.expectedPublication?.tag !== "v0.1.0-rc.5") throw new Error("账本 bundle 缺预发布 tag 外部锚");
  if (
    remediation.schemaVersion !== 1 ||
    remediation.base !== ledger.generatedFrom.rangeEnd ||
    remediation.rangeEnd !== ledger.generatedFrom.remediationEnd ||
    !Array.isArray(remediation.commits) ||
    !Array.isArray(remediation.documents) ||
    remediation.commits.some(
      (row) =>
        !/^[0-9a-f]{40}$/.test(row.sha ?? "") ||
        !Array.isArray(row.relatedDocumentRefs) ||
        (row.category === "implementation_only" && row.relatedDocumentRefs.length === 0)
    )
  ) {
    throw new Error("remediation 双向账本结构或覆盖非法");
  }
  const remediationCommits = remediation.commits.map((row) => row.sha);
  if (new Set(remediationCommits).size !== remediationCommits.length) throw new Error("remediation 双向账本含重复提交");
  for (const document of remediation.documents) {
    const expected = remediation.commits
      .filter(
        (row) =>
          row.relatedDocumentRefs.includes(document.path) &&
          (row.implementation.length > 0 || row.tests.length > 0)
      )
      .map((row) => row.sha);
    if (!sameSet(document.relatedImplementationCommits, expected)) {
      throw new Error(`remediation 文档反向边漂移:${document.path}`);
    }
  }
  const commitShas = ledger.mainCommits.map((row) => row.sha);
  const reviewedShas = semantic.commitDecisions.map((row) => row.sha);
  const documentPaths = ledger.documents.map((row) => row.path);
  const reviewedPaths = semantic.documentDecisions.map((row) => row.path);
  const knownPaths = new Set([
    ...ledger.mainCommits.flatMap((row) => [...row.docs, ...row.implementation, ...row.tests]),
    ...documentPaths
  ]);
  for (const row of [...semantic.commitDecisions, ...semantic.documentDecisions]) {
    const key = row.sha ?? row.path;
    if ("decision" in row || "claim" in row || "rationale" in row) {
      throw new Error(`语义裁决仍含已废弃的污染字段:${key}`);
    }
    if (
      typeof row.mechanicalIdentityClaim !== "string" ||
      !row.mechanicalIdentityClaim.includes(row.sha ? row.sha.slice(0, 7) : row.path) ||
      typeof row.mechanicalEvidenceSummary !== "string" ||
      row.mechanicalEvidenceSummary === ""
    ) {
      throw new Error(`语义裁决缺逐项机械证据:${key}`);
    }
    if (!Array.isArray(row.evidenceRefs) || row.evidenceRefs.length === 0) {
      throw new Error(`人工语义裁决缺证据引用:${key}`);
    }
    if (!row.evidenceRefs.some((ref) => typeof ref === "string" && ref.includes("#"))) {
      throw new Error(`人工语义裁决缺 SHA/行锚:${key}`);
    }
    const expectedArrays = row.sha
      ? ["documentRefs", "implementationRefs", "testRefs"]
      : ["commitRefs", "implementationRefs", "testRefs"];
    for (const field of expectedArrays) {
      if (!Array.isArray(row[field])) throw new Error(`人工语义裁决缺 ${field}:${row.sha ?? row.path}`);
    }
    const pathRefs = [
      ...row.evidenceRefs,
      ...(row.documentRefs ?? []),
      ...(row.implementationRefs ?? []),
      ...(row.testRefs ?? [])
    ];
    for (const ref of pathRefs) {
      const path = typeof ref === "string" ? ref.split("#")[0] : "";
      if (!path || (!knownPaths.has(path) && !existsSync(resolve(repo, path)))) {
        throw new Error(`人工语义裁决引用不存在:${row.sha ?? row.path}:${String(ref)}`);
      }
    }
    for (const sha of row.commitRefs ?? []) {
      if (!commitShas.includes(sha)) throw new Error(`人工语义裁决 commitRefs 非冻结提交:${row.path}:${String(sha)}`);
    }
  }
  if (!sameSet(commitShas, reviewedShas)) throw new Error("语义复核未精确覆盖 bundle 中全部主线提交");
  if (!sameSet(documentPaths, reviewedPaths)) throw new Error("语义复核未精确覆盖 bundle 中全部文档型资产");
  if (
    ledger.counts.mainCommits !== 115 ||
    ledger.counts.allRefCommits !== 131 ||
    ledger.counts.extraRefCommits !== 16 ||
    ledger.counts.documents !== 219
  ) {
    throw new Error(`bundle 固定覆盖数异常:${JSON.stringify(ledger.counts)}`);
  }
  console.log(
    `[ok] week audit bundle verified without private git objects: commits=${commitShas.length} docs=${documentPaths.length}`
  );
  process.exit(0);
}

const git = (args) =>
  execFileSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"]
  });
const splitLines = (value) => value.split("\n").filter(Boolean);
const splitZ = (value) => value.split("\0").filter(Boolean);
const uniqueSorted = (values) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "en"));
const short = (sha) => sha.slice(0, 7);
const escapeCell = (value) => String(value).replaceAll("|", "\\|").replaceAll("\n", "<br>");
const escapeEvidenceCell = (value) =>
  escapeCell(value)
    .replaceAll("[", "&#91;")
    .replaceAll("]", "&#93;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const listCell = (values, empty = "-") =>
  values.length === 0 ? empty : values.map((value) => `\`${escapeCell(value)}\``).join("<br>");

function dirtyPathMap() {
  const map = new Map();
  const add = (path, state) => {
    if (generatedOutputs.has(path)) return;
    const states = map.get(path) ?? [];
    states.push(state);
    map.set(path, states);
  };
  for (const path of splitZ(git(["diff", "--name-only", "-z"]))) add(path, "unstaged");
  for (const path of splitZ(git(["diff", "--cached", "--name-only", "-z"]))) add(path, "staged");
  return map;
}

function captureWorkingTreeSnapshot() {
  const dirty = dirtyPathMap();
  return {
    schemaVersion: 2,
    implementationBoundary: config.remediationEnd,
    exclusionRule: "七个账本生成物由 files digest/全树 manifest 单独闭环，避免自引用；其余 staged/unstaged 已跟踪文件逐个冻结内容；无关 untracked 不入快照",
    entries: [...dirty.entries()]
      .map(([path, states]) => ({ path, states: uniqueSorted(states), ...contentFingerprint(path) }))
      .sort((a, b) => a.path.localeCompare(b.path, "en"))
  };
}

function capturePublicationManifest() {
  const tracked = splitZ(git(["ls-files", "-z"]));
  const others = splitZ(git(["ls-files", "--others", "--exclude-standard", "-z"]));
  if (unpublishedIndexedSource(others, generatedOutputs).length > 0) {
    throw new Error("应发布源文件未入 index");
  }
  const liveAll = uniqueSorted(tracked).filter((path) => !generatedOutputs.has(path));
  const identity = privateExcludedIdentity(liveAll, contentFingerprint);
  const paths = liveAll.filter((path) => !isPublicExcluded(path));
  return {
    schemaVersion: 2,
    purpose: "冻结 Git index/tracked 公开候选 exact-set 与逐文件内容；七个生成物由 integrity.files 闭环；私有排除集只记 count/digest；无关 untracked 不入公开集",
    implementationBoundary: config.remediationEnd,
    publicExcludes: [...publicExcludes],
    generatedOutputs: [...generatedOutputs].sort((a, b) => a.localeCompare(b, "en")),
    privateExcludedCount: identity.count,
    privateExcludedDigest: identity.digest,
    entries: paths.map((path) => ({ path, ...contentFingerprint(path) }))
  };
}

function verifyNoUnrecordedDirty(integrity) {
  if (integrity.workingTreeSnapshot?.implementationBoundary !== config.remediationEnd) {
    throw new Error("审计实施边界漂移");
  }
  try {
    git(["merge-base", "--is-ancestor", config.remediationEnd, "HEAD"]);
  } catch {
    throw new Error("当前 HEAD 不包含审计实施边界");
  }
  const recorded = new Set((integrity.workingTreeSnapshot?.entries ?? []).map((entry) => entry.path));
  const unexpected = [...dirtyPathMap().keys()].filter((path) => !recorded.has(path));
  if (unexpected.length > 0) throw new Error(`审计后出现未入账工作树路径:${unexpected.join(",")}`);
}

const documentRoots = ["docs/", "research/", "history/", "prompts/", "deploy/", "artifacts/"];
const isDocument = (path) =>
  path.endsWith(".md") ||
  ["LICENSE", "NOTICE"].includes(path) ||
  documentRoots.some((prefix) => path.startsWith(prefix)) ||
  path.startsWith("e2e/evidence/");
const isTest = (path) =>
  /(^|\/)(test|tests|e2e)(\/|$)/.test(path) ||
  /\.(test|spec)\.[cm]?[jt]sx?$/.test(path) ||
  path.startsWith("scripts/test-");
const docKind = (path) => {
  if (path.startsWith("docs/0") || path.startsWith("docs/10-") || path.startsWith("docs/11-")) return "canonical";
  if (path.startsWith("docs/adr/") || path.startsWith("docs/modules/")) return "canonical";
  if (path.startsWith("docs/plan/")) return "plan";
  if (path.startsWith("docs/review/")) return "review";
  if (path.startsWith("deploy/")) return "website";
  if (path.startsWith("e2e/evidence/")) return "evidence";
  if (path.startsWith("prompts/") || path.startsWith("research/codex-findings/")) return "review_input";
  if (path.startsWith("research/") || path.startsWith("history/") || path.startsWith("artifacts/")) return "archive";
  if (["README.md", "HANDOFF.md", "SECURITY.md", "LICENSE", "NOTICE"].includes(path)) return "root_contract";
  return "supporting_doc";
};

const metadataCache = new Map();
const commitMetadata = (sha) => {
  if (!metadataCache.has(sha)) {
    const [fullSha, committedAt, subject, tree] = git([
      "show",
      "-s",
      "--format=%H%x00%cI%x00%s%x00%T",
      sha
    ]).trimEnd().split("\0");
    metadataCache.set(sha, { sha: fullSha, committedAt, subject, tree });
  }
  return metadataCache.get(sha);
};

const changedPaths = (sha) => {
  const parents = splitLines(git(["rev-list", "--parents", "-n", "1", sha]))[0].split(" ").slice(1);
  if (parents.length === 0) return splitZ(git(["ls-tree", "-r", "--name-only", "-z", sha]));
  return splitZ(git(["diff", "--name-only", "-z", parents[0], sha]));
};

try {
  git(["rev-parse", "--verify", `${config.base}^{commit}`]);
  git(["rev-parse", "--verify", `${config.rangeEnd}^{commit}`]);
} catch {
  console.error("[fail] 缺少私有归档历史对象;完整重建只在 SayDo-archive 运行,公开快照请用 --check-bundle");
  process.exit(2);
}

const mainShas = splitLines(git(["rev-list", "--reverse", `${config.base}..${config.rangeEnd}`]));
const mainSet = new Set(mainShas);
const refManifest = JSON.parse(readFileSync(resolve(repo, config.refManifest), "utf8"));
if (
  refManifest.schemaVersion !== 1 ||
  refManifest.coverageClaim !== "recorded_ref_universe_only" ||
  refManifest.commitTimeCutoff !== config.refsFrozenAt ||
  !Array.isArray(refManifest.refs)
) {
  throw new Error("ref manifest schema 或冻结时刻与审计配置不一致");
}
const manifestRefs = refManifest.refs.map((row) => {
  if (typeof row.ref !== "string" || !/^refs\//.test(row.ref) || typeof row.tip !== "string" || !/^[0-9a-f]{40}$/.test(row.tip)) {
    throw new Error(`ref manifest 行非法:${JSON.stringify(row)}`);
  }
  git(["rev-parse", "--verify", `${row.tip}^{commit}`]);
  if (Date.parse(commitMetadata(row.tip).committedAt) > Date.parse(config.refsFrozenAt)) {
    throw new Error(`ref manifest tip 晚于冻结时刻:${row.ref}@${row.tip}`);
  }
  return row;
});
if (new Set(manifestRefs.map((row) => row.ref)).size !== manifestRefs.length) throw new Error("ref manifest 含重复 ref");
const allRecentShas = uniqueSorted(
  manifestRefs
    .flatMap((row) => splitLines(git(["log", row.tip, `--since=${config.cutoff}`, "--format=%H"])))
    .filter((sha) => commitMetadata(sha).committedAt <= config.refsFrozenAt)
);
const recentSet = new Set(allRecentShas);
const frozenRefTips = manifestRefs
  .map(({ ref, tip }) => {
    const recentCommits = splitLines(git(["log", tip, `--since=${config.cutoff}`, "--format=%H"]))
      .filter((sha) => recentSet.has(sha));
    return { ref, tip, recentCommits };
  })
  .filter((row) => row.tip && row.recentCommits.length > 0)
  .sort((a, b) => a.ref.localeCompare(b.ref, "en"));
const extraShas = allRecentShas.filter((sha) => !mainSet.has(sha));
const rangePaths = splitZ(git(["diff", "--name-only", "-z", config.base, config.rangeEnd]));
const documents = rangePaths.filter(isDocument).sort((a, b) => a.localeCompare(b, "en"));
const markdownCount = documents.filter((path) => path.endsWith(".md")).length;

const mainRows = mainShas.map((sha) => {
  const metadata = commitMetadata(sha);
  const paths = uniqueSorted(changedPaths(sha));
  const docs = paths.filter(isDocument);
  const tests = paths.filter((path) => !isDocument(path) && isTest(path));
  const implementation = paths.filter((path) => !isDocument(path) && !isTest(path));
  const category =
    docs.length > 0 && (implementation.length > 0 || tests.length > 0)
      ? "paired"
      : docs.length > 0
        ? "document_only"
        : "implementation_only";
  return { ...metadata, paths, docs, implementation, tests, category };
});

const remediationShas = splitLines(git(["rev-list", "--reverse", `${config.rangeEnd}..${config.remediationEnd}`]));
const remediationSet = new Set(remediationShas);
const crossLinks = JSON.parse(readFileSync(resolve(repo, config.crossLinks), "utf8"));
if (crossLinks.schemaVersion !== 1 || !Array.isArray(crossLinks.links)) {
  throw new Error("remediation cross-links 结构非法");
}
const explicitCrossLinks = new Map();
for (const link of crossLinks.links) {
  if (!remediationSet.has(link.commit) || explicitCrossLinks.has(link.commit)) {
    throw new Error(`remediation cross-link commit 非范围内或重复:${String(link.commit)}`);
  }
  if (
    !Array.isArray(link.relatedDocumentRefs) ||
    link.relatedDocumentRefs.length === 0 ||
    link.relatedDocumentRefs.some((path) => typeof path !== "string" || !isDocument(path) || !existsSync(resolve(repo, path)))
  ) {
    throw new Error(`remediation cross-link 文档引用非法:${link.commit}`);
  }
  explicitCrossLinks.set(link.commit, uniqueSorted(link.relatedDocumentRefs));
}
const remediationRows = remediationShas.map((sha) => {
  const metadata = commitMetadata(sha);
  const paths = uniqueSorted(changedPaths(sha));
  const docs = paths.filter(isDocument);
  const tests = paths.filter((path) => !isDocument(path) && isTest(path));
  const implementation = paths.filter((path) => !isDocument(path) && !isTest(path));
  const category =
    docs.length > 0 && (implementation.length > 0 || tests.length > 0)
      ? "paired"
      : docs.length > 0
        ? "document_only"
        : "implementation_only";
  const relatedDocumentRefs = uniqueSorted([...docs, ...(explicitCrossLinks.get(sha) ?? [])]);
  if (category === "implementation_only" && relatedDocumentRefs.length === 0) {
    throw new Error(`remediation implementation-only 提交缺跨提交文档边:${sha}`);
  }
  return { ...metadata, paths, docs, implementation, tests, category, relatedDocumentRefs };
});
const remediationDocumentPaths = uniqueSorted([
  ...remediationRows.flatMap((row) => row.docs),
  ...remediationRows.flatMap((row) => row.relatedDocumentRefs)
]);
const remediationDocuments = remediationDocumentPaths.map((path) => ({
  path,
  commits: remediationRows.filter((row) => row.docs.includes(path)).map((row) => row.sha),
  relatedImplementationCommits: remediationRows
    .filter((row) => row.relatedDocumentRefs.includes(path) && (row.implementation.length > 0 || row.tests.length > 0))
    .map((row) => row.sha)
}));
const remediationPayload = {
  schemaVersion: 1,
  purpose: "补充主账本冻结点后的全部回修提交，并给 implementation-only 提交建立可机械复验的双向文档边",
  base: config.rangeEnd,
  rangeEnd: config.remediationEnd,
  counts: {
    commits: remediationRows.length,
    changedPaths: splitZ(git(["diff", "--name-only", "-z", config.rangeEnd, config.remediationEnd])).length,
    documents: remediationDocumentPaths.length,
    implementationOnlyCommits: remediationRows.filter((row) => row.category === "implementation_only").length
  },
  commits: remediationRows,
  documents: remediationDocuments
};
const remediationJsonContent = `${JSON.stringify(remediationPayload, null, 2)}\n`;
const remediationMd = [
  "# 最近一周回修双向账本",
  "",
  `- 范围：\`${short(config.rangeEnd)}..${short(config.remediationEnd)}\`。证据载体提交因 SHA 自引用不可能性排除在范围外。`,
  `- 覆盖：${remediationPayload.counts.commits} 个回修提交、${remediationPayload.counts.changedPaths} 个路径、${remediationPayload.counts.documents} 份关联文档。`,
  "",
  "## 提交 -> 文档",
  "",
  "| 提交 | 主题 | 分类 | 同提交文档与跨提交承接文档 | 实现与测试 |",
  "|---|---|---|---|---|",
  ...remediationRows.map(
    (row) =>
      `| \`${short(row.sha)}\` | ${escapeCell(row.subject)} | \`${row.category}\` | ${listCell(row.relatedDocumentRefs)} | ${listCell([...row.implementation, ...row.tests])} |`
  ),
  "",
  "## 文档 -> 提交",
  "",
  "| 文档 | 同提交触及 | 关联实施提交 |",
  "|---|---|---|",
  ...remediationDocuments.map(
    (row) => `| \`${escapeCell(row.path)}\` | ${listCell(row.commits.map(short))} | ${listCell(row.relatedImplementationCommits.map(short))} |`
  ),
  ""
];
const remediationMarkdownContent = remediationMd.join("\n");

const treeToMain = new Map();
for (const row of mainRows) {
  const matches = treeToMain.get(row.tree) ?? [];
  matches.push(row.sha);
  treeToMain.set(row.tree, matches);
}
const resolveDeclaredInternal = (subject) => {
  const match = subject.match(/from internal ([0-9a-f]{7,40})/i);
  if (!match) return undefined;
  try {
    return git(["rev-parse", "--verify", `${match[1]}^{commit}`]).trim();
  } catch {
    return match[1];
  }
};
const verifyPublicSnapshot = (publicSha, internalSha) => {
  const fields = splitZ(git(["diff", "--name-status", "-z", internalSha, publicSha]));
  const changes = [];
  for (let index = 0; index < fields.length; ) {
    const status = fields[index++];
    if (/^[RC]/.test(status)) {
      changes.push({ status, from: fields[index++], path: fields[index++] });
    } else {
      changes.push({ status, path: fields[index++] });
    }
  }
  const allowed = changes.every(
    (change) => change.status === "D" && change.path.startsWith("artifacts/release/copyright/")
  );
  return {
    ok: changes.length === 0 || allowed,
    treeEqual: changes.length === 0,
    filterRule: "只允许公开快照删除 artifacts/release/copyright/ 下的私有登记资产",
    changes
  };
};
const extraRows = extraShas
  .map((sha) => {
    const metadata = commitMetadata(sha);
    const paths = uniqueSorted(changedPaths(sha));
    const treeMatches = treeToMain.get(metadata.tree) ?? [];
    const declaredInternal = resolveDeclaredInternal(metadata.subject);
    const snapshotVerification = declaredInternal
      ? verifyPublicSnapshot(sha, declaredInternal)
      : undefined;
    const relation = declaredInternal
      ? snapshotVerification.ok
        ? "public_snapshot_verified"
        : "requires_manual_trace"
      : treeMatches.length > 0
        ? "tree_equivalent"
        : "requires_manual_trace";
    return {
      ...metadata,
      paths,
      docs: paths.filter(isDocument),
      implementation: paths.filter((path) => !isDocument(path) && !isTest(path)),
      tests: paths.filter((path) => !isDocument(path) && isTest(path)),
      treeMatches,
      declaredInternal,
      snapshotVerification,
      relation
    };
  })
  .sort((a, b) => a.committedAt.localeCompare(b.committedAt) || a.sha.localeCompare(b.sha));

const commitsByDocument = new Map(documents.map((path) => [path, []]));
for (const row of mainRows) {
  for (const path of row.docs) commitsByDocument.get(path)?.push(row);
}
const documentRows = documents.map((path) => {
  const commits = commitsByDocument.get(path) ?? [];
  const implementation = uniqueSorted(commits.flatMap((row) => row.implementation));
  const tests = uniqueSorted(commits.flatMap((row) => row.tests));
  const kind = docKind(path);
  const status =
    implementation.length > 0 || tests.length > 0
      ? "same_commit_evidence"
      : ["archive", "evidence", "review_input", "review"].includes(kind)
        ? "archive_or_evidence"
        : "document_only";
  return {
    path,
    kind,
    commits: commits.map((row) => row.sha),
    implementation,
    tests,
    status
  };
});

const counts = {
  mainCommits: mainRows.length,
  allRefCommits: allRecentShas.length,
  extraRefCommits: extraRows.length,
  changedPaths: rangePaths.length,
  documents: documentRows.length,
  markdown: markdownCount,
  nonMarkdownDocuments: documentRows.length - markdownCount,
  pairedCommits: mainRows.filter((row) => row.category === "paired").length,
  documentOnlyCommits: mainRows.filter((row) => row.category === "document_only").length,
  implementationOnlyCommits: mainRows.filter((row) => row.category === "implementation_only").length
};

const payload = {
  schemaVersion: 2,
  generatedFrom: config,
  frozenRefTips,
  counts,
  classification: {
    document:
      "任意 Markdown；LICENSE/NOTICE；docs、research、history、prompts、deploy、artifacts 与 e2e/evidence 下的变更资产",
    paired:
      "同一提交同时触及文档与实现或测试，仅表示可追溯，不自动代表语义正确",
    snapshot:
      "公开快照须逐条验证同树，或只删除 artifacts/release/copyright/ 私有登记资产；标题声明本身不构成映射证据"
  },
  mainCommits: mainRows,
  extraRefCommits: extraRows,
  documents: documentRows
};
const jsonContent = `${JSON.stringify(payload, null, 2)}\n`;

// 语义裁决是人工评审输入，不由路径/文件类型自动宣告 reviewed；生成器只校验精确覆盖与引用完整性。
const semanticContent = readFileSync(resolve(repo, config.semanticOutput), "utf8");
const semanticReview = JSON.parse(semanticContent);
validateSemanticStructure(payload, semanticReview);

const semanticParentCache = new Map();
const semanticBlobCache = new Map();
const semanticDiffCache = new Map();
const semanticBinaryCache = new Map();
function firstParent(commit) {
  if (!semanticParentCache.has(commit)) {
    const parts = git(["rev-list", "--parents", "-n", "1", commit]).trim().split(/\s+/);
    semanticParentCache.set(commit, parts[1] ?? null);
  }
  return semanticParentCache.get(commit);
}
function readFrozenBlob(ref, path) {
  const key = `${ref}:${path}`;
  if (!semanticBlobCache.has(key)) {
    const blob = git(["rev-parse", key]).trim();
    const content = execFileSync("git", ["cat-file", "blob", blob], {
      cwd: repo,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"]
    });
    semanticBlobCache.set(key, { blob, content });
  }
  return semanticBlobCache.get(key);
}
function changedTextLines(commit, path) {
  const key = `${commit}:${path}`;
  if (semanticDiffCache.has(key)) return semanticDiffCache.get(key);
  const parent = firstParent(commit);
  const args = parent
    ? ["diff", "--no-ext-diff", "--unified=0", parent, commit, "--", path]
    : ["show", "--no-ext-diff", "--format=", "--unified=0", commit, "--", path];
  const lines = git(args).split("\n");
  const changed = [];
  let oldLine = 0;
  let newLine = 0;
  for (const line of lines) {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      const excerpt = safeExcerpt(line.slice(1));
      if (excerpt !== "") changed.push({ side: "commit", line: newLine, excerpt });
      newLine += 1;
      continue;
    }
    if (line.startsWith("-") && !line.startsWith("---")) {
      const excerpt = safeExcerpt(line.slice(1));
      if (excerpt !== "") changed.push({ side: "parent", line: oldLine, excerpt });
      oldLine += 1;
      continue;
    }
    if (line.startsWith(" ")) {
      oldLine += 1;
      newLine += 1;
    }
  }
  semanticDiffCache.set(key, changed);
  return changed;
}
function isBinaryChange(commit, path) {
  const key = `${commit}:${path}`;
  if (semanticBinaryCache.has(key)) return semanticBinaryCache.get(key);
  const parent = firstParent(commit);
  const args = parent
    ? ["diff", "--numstat", parent, commit, "--", path]
    : ["show", "--numstat", "--format=", commit, "--", path];
  const line = git(args).split("\n").find(Boolean);
  const [added, deleted] = line?.split("\t") ?? [];
  const binary = added === "-" && deleted === "-";
  semanticBinaryCache.set(key, binary);
  return binary;
}
function verifySemanticAssertion(assertion) {
  const ref = assertion.side === "commit" ? assertion.commit : firstParent(assertion.commit);
  if (!ref) throw new Error(`语义证据缺父提交:${assertion.commit}:${assertion.path}`);
  const actual = readFrozenBlob(ref, assertion.path);
  if (actual.blob !== assertion.blob) throw new Error(`语义证据 blob 漂移:${assertion.commit}:${assertion.path}`);
  if (actual.content.length !== assertion.bytes) throw new Error(`语义证据 bytes 漂移:${assertion.commit}:${assertion.path}`);
  if (sha256Text(actual.content) !== assertion.contentSha256) {
    throw new Error(`语义证据内容摘要漂移:${assertion.commit}:${assertion.path}`);
  }
  const binary = isBinaryChange(assertion.commit, assertion.path);
  const changed = changedTextLines(assertion.commit, assertion.path);
  if (assertion.binary === true) {
    if (!binary) throw new Error(`语义证据把文本差异误标为 binary:${assertion.commit}:${assertion.path}`);
    return;
  }
  if (assertion.identityOnly === true) {
    if (binary || changed.length > 0) {
      throw new Error(`语义证据把可锚差异降级为 identityOnly:${assertion.commit}:${assertion.path}`);
    }
    return;
  }
  if (binary) throw new Error(`语义证据把二进制误标为文本:${assertion.commit}:${assertion.path}`);
  const lines = actual.content.toString("utf8").split("\n");
  if (assertion.line > lines.length) throw new Error(`语义证据行号越界:${assertion.commit}:${assertion.path}`);
  const excerpt = safeExcerpt(lines[assertion.line - 1] ?? "");
  if (excerpt !== assertion.excerpt || sha256Text(excerpt) !== assertion.excerptSha256) {
    throw new Error(`语义证据行摘录漂移:${assertion.commit}:${assertion.path}:${assertion.line}`);
  }
  if (!changed.some((row) => row.side === assertion.side && row.line === assertion.line && row.excerpt === assertion.excerpt)) {
    throw new Error(`语义证据未命中真实 diff hunk:${assertion.commit}:${assertion.path}:${assertion.line}`);
  }
}
const verifiedAssertions = new Set();
for (const decision of [...semanticReview.commitDecisions, ...semanticReview.documentDecisions]) {
  for (const assertion of decision.changeAssertions) {
    const key = assertionEvidenceRef(assertion);
    if (verifiedAssertions.has(key)) continue;
    verifySemanticAssertion(assertion);
    verifiedAssertions.add(key);
  }
}
const semanticCommitBySha = new Map(semanticReview.commitDecisions.map((row) => [row.sha, row]));
const semanticDocumentByPath = new Map(semanticReview.documentDecisions.map((row) => [row.path, row]));

const md = [];
md.push("# 最近一周全量双向账本(冻结于 2026-08-22)", "");
md.push(
  `- 时间窗：\`${config.cutoff}\` 至已记录 ref 宇宙的提交时间上界 \`${config.refsFrozenAt}\`。`,
  `- 主线范围：\`${short(config.base)}..${short(config.rangeEnd)}\`；本文件由 \`node scripts/week-audit.mjs --write\` 生成。`,
  `- 覆盖：${counts.mainCommits} 个主线提交、${counts.extraRefCommits} 个额外引用提交、${counts.changedPaths} 个变更路径、${counts.documents} 份文档型资产（Markdown ${counts.markdown}，其他 ${counts.nonMarkdownDocuments}）。`,
  "- ref 边界：清单在冻结时刻之后补录，只证明其中列明的 ref tip 可重建；无法排除冻结时已存在、随后删除或强制移动且未留下本地记录的 ref。",
  "- 说明：`paired` 与 `mechanically_evidenced` 只证明可追溯，不等于逐项人工判定正确；人工 findings、修复与真实门禁统一写入同日主报告。",
  "- 公开快照：额外引用里的 snapshot SHA 是 **commit** 对象；可重算的 public tree object digest 是该提交的 `^{tree}`，与快照说明 `public-tree:` 行一致，二者不得混称为同一个对象。",
  ""
);
md.push("## 1. 提交 -> 文档 / 实现 / 测试", "");
md.push("| # | 提交 | 时间 | 主题 | 文档 | 实现 | 测试 | 分类、机械证据与 finding 链接 |", "|---:|---|---|---|---|---|---|---|");
mainRows.forEach((row, index) => {
  const adjudication = semanticCommitBySha.get(row.sha);
  md.push(
    `| ${index + 1} | \`${short(row.sha)}\` | ${escapeCell(row.committedAt)} | ${escapeCell(row.subject)} | ${listCell(row.docs)} | ${listCell(row.implementation)} | ${listCell(row.tests)} | \`${row.category}\` / \`${adjudication.evidenceStatus}\` / finding=${listCell(adjudication.findingIds, "未登记；不等于人工判定正确")}：${escapeEvidenceCell(adjudication.mechanicalEvidenceSummary)} |`
  );
});
md.push("", "## 2. 已记录 ref 宇宙额外提交 -> 主线对应关系", "");
md.push(
  "| # | 提交 | 时间 | 主题 | 关系 | 声明来源 / 同树主线 | 文档 | 实现与测试 |",
  "|---:|---|---|---|---|---|---|---|"
);
extraRows.forEach((row, index) => {
  const matches = uniqueSorted([...(row.declaredInternal ? [row.declaredInternal] : []), ...row.treeMatches]);
  md.push(
    `| ${index + 1} | \`${short(row.sha)}\` | ${escapeCell(row.committedAt)} | ${escapeCell(row.subject)} | \`${row.relation}\` | ${listCell(matches.map(short))} | ${listCell(row.docs)} | ${listCell([...row.implementation, ...row.tests])} |`
  );
});
md.push("", "## 3. 文档 -> 提交 / 实现 / 测试", "");
md.push(
  "| # | 文档型资产 | 类型 | 触及提交 | 同提交实现 | 同提交测试 | 状态、机械证据与 finding 链接 |",
  "|---:|---|---|---|---|---|---|"
);
documentRows.forEach((row, index) => {
  const adjudication = semanticDocumentByPath.get(row.path);
  md.push(
    `| ${index + 1} | \`${escapeCell(row.path)}\` | \`${row.kind}\` | ${listCell(row.commits.map(short))} | ${listCell(row.implementation)} | ${listCell(row.tests)} | \`${row.status}\` / \`${adjudication.evidenceStatus}\` / finding=${listCell(adjudication.findingIds, "未登记；不等于人工判定正确")}：${escapeEvidenceCell(adjudication.mechanicalEvidenceSummary)} |`
  );
});
md.push("");
const markdownContent = md.join("\n");
const publicationManifestContent = `${JSON.stringify(capturePublicationManifest(), null, 2)}\n`;

const integrityContent =
  mode === "--write"
    ? `${JSON.stringify(
        {
          schemaVersion: 6,
          purpose: "公开快照没有私有 archive git objects 时,校验主账本、回修双向账本、机械语义证据及本轮工作树快照",
          generatedFrom: config,
          counts,
          historyDigest: sha256Text(
            JSON.stringify({
              base: config.base,
              rangeEnd: config.rangeEnd,
              frozenRefTips,
              mainCommits: mainRows,
              extraRefCommits: extraRows,
              remediationCommits: remediationRows
            })
          ),
          expectedPublication: {
            repository: "Octo-o-o-o/SayDo",
            tag: "v0.1.0-rc.5",
            rule: "GitHub tag workflow 对本 bundle 运行 --check-bundle 后构成外部不可移动锚"
          },
          files: {
            [config.markdownOutput]: sha256Text(markdownContent),
            [config.jsonOutput]: sha256Text(jsonContent),
            [config.semanticOutput]: sha256Text(semanticContent),
            [config.refManifest]: sha256Text(readFileSync(resolve(repo, config.refManifest), "utf8")),
            [config.publicationManifest]: sha256Text(publicationManifestContent),
            [config.reviewFindingAnchor]: sha256Text(
              readFileSync(resolve(repo, config.reviewFindingAnchor), "utf8")
            ),
            [config.crossLinks]: sha256Text(readFileSync(resolve(repo, config.crossLinks), "utf8")),
            [config.remediationJsonOutput]: sha256Text(remediationJsonContent),
            [config.remediationMarkdownOutput]: sha256Text(remediationMarkdownContent)
          },
          workingTreeSnapshot: captureWorkingTreeSnapshot()
        },
        null,
        2
      )}\n`
    : readFileSync(resolve(repo, config.integrityOutput), "utf8");

const outputs = [
  [config.markdownOutput, markdownContent],
  [config.jsonOutput, jsonContent],
  [config.semanticOutput, semanticContent],
  [config.remediationJsonOutput, remediationJsonContent],
  [config.remediationMarkdownOutput, remediationMarkdownContent],
  [config.publicationManifest, publicationManifestContent],
  [config.integrityOutput, integrityContent]
];

if (mode === "--write") {
  writeWeekAuditOutputs(outputs.map(([path, content]) => [resolve(repo, path), content]));
  console.log(
    `[ok] week audit ledger: main=${counts.mainCommits} all_refs=${counts.allRefCommits} extra=${counts.extraRefCommits} paths=${counts.changedPaths} docs=${counts.documents} markdown=${counts.markdown}`
  );
  process.exit(0);
}

let failed = false;
for (const [path, expected] of outputs) {
  let actual;
  try {
    actual = readFileSync(resolve(repo, path), "utf8");
  } catch {
    console.error(`[fail] 缺少账本输出:${path}`);
    failed = true;
    continue;
  }
  if (actual !== expected) {
    console.error(`[fail] 账本已漂移:${path}`);
    failed = true;
  }
}
try {
  const integrity = JSON.parse(integrityContent);
  if (integrity.files?.[config.markdownOutput] !== sha256Text(markdownContent)) {
    throw new Error(`账本 bundle 摘要不一致:${config.markdownOutput}`);
  }
  if (integrity.files?.[config.jsonOutput] !== sha256Text(jsonContent)) {
    throw new Error(`账本 bundle 摘要不一致:${config.jsonOutput}`);
  }
  if (integrity.files?.[config.semanticOutput] !== sha256Text(semanticContent)) {
    throw new Error(`账本 bundle 摘要不一致:${config.semanticOutput}`);
  }
  if (integrity.files?.[config.publicationManifest] !== sha256Text(publicationManifestContent)) {
    throw new Error(`账本 bundle 摘要不一致:${config.publicationManifest}`);
  }
  const reviewFindingAnchorContent = readFileSync(resolve(repo, config.reviewFindingAnchor), "utf8");
  if (integrity.files?.[config.reviewFindingAnchor] !== sha256Text(reviewFindingAnchorContent)) {
    throw new Error(`账本 bundle 摘要不一致:${config.reviewFindingAnchor}`);
  }
  const crossLinksContent = readFileSync(resolve(repo, config.crossLinks), "utf8");
  if (integrity.files?.[config.crossLinks] !== sha256Text(crossLinksContent)) {
    throw new Error(`账本 bundle 摘要不一致:${config.crossLinks}`);
  }
  if (integrity.files?.[config.remediationJsonOutput] !== sha256Text(remediationJsonContent)) {
    throw new Error(`账本 bundle 摘要不一致:${config.remediationJsonOutput}`);
  }
  if (integrity.files?.[config.remediationMarkdownOutput] !== sha256Text(remediationMarkdownContent)) {
    throw new Error(`账本 bundle 摘要不一致:${config.remediationMarkdownOutput}`);
  }
  verifyRecordedSnapshot(integrity);
  verifyNoUnrecordedDirty(integrity);
} catch (error) {
  console.error(`[fail] ${String(error instanceof Error ? error.message : error)}`);
  failed = true;
}
for (const row of extraRows) {
  if (row.declaredInternal && row.snapshotVerification?.ok !== true) {
    console.error(`[fail] 未验证的公开快照声明:${row.sha} -> ${row.declaredInternal}`);
    failed = true;
  }
}
if (counts.mainCommits !== 115 || counts.allRefCommits !== 131 || counts.extraRefCommits !== 16) {
  console.error(`[fail] 提交覆盖数异常:${JSON.stringify(counts)}`);
  failed = true;
}
if (counts.changedPaths !== 434 || counts.documents !== 219 || counts.markdown !== 154) {
  console.error(`[fail] 文档覆盖数异常:${JSON.stringify(counts)}`);
  failed = true;
}
if (failed) process.exit(1);
console.log(
  `[ok] week audit ledger verified: main=${counts.mainCommits} all_refs=${counts.allRefCommits} extra=${counts.extraRefCommits} paths=${counts.changedPaths} docs=${counts.documents}`
);
