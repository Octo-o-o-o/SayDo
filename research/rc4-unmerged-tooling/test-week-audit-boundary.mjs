#!/usr/bin/env node
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import {
  AVAILABILITY_HTML_PATHS,
  IMPLEMENTATION_BOUNDARY_RELATIVE,
  INTEGRITY_JSON,
  LEDGER_JSON,
  PUBLICATION_JSON,
  SEMANTIC_JSON,
  classifyGitObject,
  commitPaths,
  implementationBoundaryJson,
  isAllowedEvidencePath,
  isAvailabilityTransitionCommit,
  leakedImplementationAfterBoundary,
  parseGitBatchCheckOutput,
  parseImplementationBoundaryDocument,
  verifyImplementationBoundaryProtocol
} from "./implementation-boundary.mjs";
import { AVAILABILITY_REPLACEMENTS, applyAvailabilityReplacements } from "./availability-transition.mjs";

const here = dirname(fileURLToPath(import.meta.url));
let pass = 0;
let fail = 0;
const FAKE_INTERNAL = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function assert(label, ok) {
  if (ok) {
    process.stdout.write(`[ok] ${label}\n`);
    pass += 1;
  } else {
    process.stdout.write(`[fail] ${label}\n`);
    fail += 1;
  }
}

function expectThrow(label, fn, pattern) {
  try {
    fn();
    assert(label, false);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(label, pattern.test(message));
  }
}

const weekAuditSource = readFileSync(join(here, "week-audit.mjs"), "utf8");
assert("week-audit does not hardcode remediationEnd sha", !/const remediationEnd = "[0-9a-f]{40}"/.test(weekAuditSource));
assert("week-audit imports boundary helper", weekAuditSource.includes("verifyImplementationBoundaryProtocol"));
assert(
  "week-audit points at unique evidence path",
  weekAuditSource.includes("IMPLEMENTATION_BOUNDARY_RELATIVE") &&
    weekAuditSource.includes("research/week-audit/2026-08-24-implementation-boundary.json")
);
assert("check-bundle still enumerates leaks", weekAuditSource.includes("leakedImplementationAfterBoundary"));
assert(
  "both check modes go through protocol verify",
  weekAuditSource.includes('mode === "--check-bundle"') && weekAuditSource.includes("verifyImplementationBoundaryProtocol")
);

const publishSource = readFileSync(join(here, "publish-public-snapshot.sh"), "utf8");
const auditAt = publishSource.indexOf("scripts/week-audit.mjs --check-bundle");
const privacyAt = publishSource.indexOf("scripts/check-public-tree-privacy.mjs --ref");
const treeAt = publishSource.indexOf("GIT_INDEX_FILE=\"$tmpindex\" git write-tree");
assert("publisher runs check-bundle before privacy and write-tree", auditAt >= 0 && auditAt < privacyAt && privacyAt < treeAt);
assert(
  "publisher check-bundle cannot be skipped",
  publishSource
    .split("\n")
    .some((line) => line.includes("scripts/week-audit.mjs --check-bundle") && !line.trim().startsWith("#") && !/\|\|/.test(line))
);

expectThrow("invalid json fails", () => parseImplementationBoundaryDocument("{"), /JSON 非法/);
expectThrow("non-object json fails", () => parseImplementationBoundaryDocument("[]"), /JSON 非法/);
expectThrow(
  "non-40 sha fails",
  () =>
    parseImplementationBoundaryDocument(
      JSON.stringify({
        schemaVersion: 1,
        purpose: "x",
        implementationBoundary: "abc",
        rule: "y"
      })
    ),
  /SHA 非法/
);

assert("research/evil.mjs is implementation", !isAllowedEvidencePath("research/evil.mjs"));
assert("deploy evil html is implementation", !isAllowedEvidencePath("deploy/saydo-octoooo-com/evil.html"));
assert("artifacts/evil is implementation", !isAllowedEvidencePath("artifacts/evil"));
assert("availability exact page is not generic evidence", !isAllowedEvidencePath(AVAILABILITY_HTML_PATHS[0]));
assert("docs markdown is evidence", isAllowedEvidencePath("docs/review/note.md"));

function gitText(repo) {
  return (args, options = {}) =>
    execFileSync("git", args, {
      cwd: repo,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      ...(options.input != null ? { input: options.input } : { stdio: ["ignore", "pipe", "pipe"] })
    });
}

function gitInput(repo, args, input) {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8", input }).toString();
}

function initRepo(repo) {
  mkdirSync(repo, { recursive: true });
  const run = (args) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
  run(["init", "-q"]);
  run(["config", "user.email", "test@example.invalid"]);
  run(["config", "user.name", "test"]);
  run(["config", "core.autocrlf", "false"]);
  return run;
}

function writeBoundary(repo, sha) {
  const absolute = join(repo, IMPLEMENTATION_BOUNDARY_RELATIVE);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, implementationBoundaryJson(sha));
}

function writeLedgers(repo, sha) {
  mkdirSync(join(repo, "research/week-audit"), { recursive: true });
  const generatedFrom = { remediationEnd: sha };
  writeFileSync(join(repo, LEDGER_JSON), `${JSON.stringify({ generatedFrom }, null, 2)}\n`);
  writeFileSync(
    join(repo, INTEGRITY_JSON),
    `${JSON.stringify({ generatedFrom, workingTreeSnapshot: { implementationBoundary: sha } }, null, 2)}\n`
  );
  writeFileSync(join(repo, SEMANTIC_JSON), `${JSON.stringify({ generatedFrom }, null, 2)}\n`);
  writeFileSync(join(repo, PUBLICATION_JSON), `${JSON.stringify({ implementationBoundary: sha }, null, 2)}\n`);
}

function commitSnapshot(run, fakeInternal) {
  run(["add", "-A"]);
  const tree = run(["write-tree"]);
  run([
    "commit",
    "-q",
    "-m",
    `snapshot: 2026-08-24 from internal ${fakeInternal}`,
    "-m",
    `public-tree: ${tree}\nfilter-version: public-exclude-v1`
  ]);
  return tree;
}

function verify(repo, head = "HEAD") {
  return verifyImplementationBoundaryProtocol({
    repo,
    git: gitText(repo),
    relativePath: IMPLEMENTATION_BOUNDARY_RELATIVE,
    head
  });
}

const root = mkdtempSync(join(tmpdir(), "saydo-boundary-protocol-"));
try {
  const happy = join(root, "happy");
  const runHappy = initRepo(happy);
  mkdirSync(join(happy, "scripts"), { recursive: true });
  writeFileSync(join(happy, "scripts/impl.mjs"), "export default 1;\n");
  runHappy(["add", "scripts/impl.mjs"]);
  runHappy(["commit", "-q", "-m", "code"]);
  const boundary = runHappy(["rev-parse", "HEAD"]);
  writeBoundary(happy, boundary);
  mkdirSync(join(happy, "docs"), { recursive: true });
  writeFileSync(join(happy, "docs/note.md"), "evidence\n");
  runHappy(["add", IMPLEMENTATION_BOUNDARY_RELATIVE, "docs/note.md"]);
  runHappy(["commit", "-q", "-m", "evidence"]);
  const proof = verify(happy);
  assert("synthetic internal happy path", proof.mode === "internal_history" && proof.implementationBoundary === boundary);
  assert("evidence commit is not recorded as implementationBoundary", proof.evidenceCommit !== boundary);

  writeFileSync(join(happy, "research/week-audit/extra.md"), "later docs\n");
  runHappy(["add", "research/week-audit/extra.md"]);
  runHappy(["commit", "-q", "-m", "docs after"]);
  assert("docs-only commit after boundary is accepted", verify(happy).implementationBoundary === boundary);

  const leakRepo = join(root, "leak");
  const runLeak = initRepo(leakRepo);
  mkdirSync(join(leakRepo, "scripts"), { recursive: true });
  writeFileSync(join(leakRepo, "scripts/impl.mjs"), "export default 1;\n");
  runLeak(["add", "scripts/impl.mjs"]);
  runLeak(["commit", "-q", "-m", "code"]);
  const leakBoundary = runLeak(["rev-parse", "HEAD"]);
  writeBoundary(leakRepo, leakBoundary);
  runLeak(["add", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  runLeak(["commit", "-q", "-m", "evidence"]);
  writeFileSync(join(leakRepo, "scripts/more.mjs"), "export default 2;\n");
  runLeak(["add", "scripts/more.mjs"]);
  runLeak(["commit", "-q", "-m", "impl after"]);
  expectThrow("implementation path after boundary is detected", () => verify(leakRepo), /未入账实施提交/);

  const twice = join(root, "twice");
  const runTwice = initRepo(twice);
  mkdirSync(join(twice, "scripts"), { recursive: true });
  writeFileSync(join(twice, "scripts/impl.mjs"), "export default 1;\n");
  runTwice(["add", "scripts/impl.mjs"]);
  runTwice(["commit", "-q", "-m", "code"]);
  const twiceBoundary = runTwice(["rev-parse", "HEAD"]);
  writeBoundary(twice, twiceBoundary);
  runTwice(["add", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  runTwice(["commit", "-q", "-m", "evidence"]);
  const twicePath = join(twice, IMPLEMENTATION_BOUNDARY_RELATIVE);
  const twiceDoc = JSON.parse(readFileSync(twicePath, "utf8"));
  twiceDoc.purpose = `${twiceDoc.purpose} updated`;
  writeFileSync(twicePath, `${JSON.stringify(twiceDoc, null, 2)}\n`);
  runTwice(["add", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  runTwice(["commit", "-q", "-m", "move boundary"]);
  expectThrow("second modification of boundary file fails", () => verify(twice), /被再次修改/);

  const parentMismatch = join(root, "parent");
  const runParent = initRepo(parentMismatch);
  mkdirSync(join(parentMismatch, "scripts"), { recursive: true });
  writeFileSync(join(parentMismatch, "scripts/a.mjs"), "export default 1;\n");
  runParent(["add", "scripts/a.mjs"]);
  runParent(["commit", "-q", "-m", "code-a"]);
  const shaA = runParent(["rev-parse", "HEAD"]);
  writeFileSync(join(parentMismatch, "scripts/b.mjs"), "export default 2;\n");
  runParent(["add", "scripts/b.mjs"]);
  runParent(["commit", "-q", "-m", "code-b"]);
  writeBoundary(parentMismatch, shaA);
  runParent(["add", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  runParent(["commit", "-q", "-m", "evidence on B recording A"]);
  expectThrow("evidence parent mismatch fails", () => verify(parentMismatch), /第一父提交与记录 SHA 不一致/);

  const mixed = join(root, "mixed");
  const runMixed = initRepo(mixed);
  mkdirSync(join(mixed, "scripts"), { recursive: true });
  writeFileSync(join(mixed, "scripts/impl.mjs"), "export default 1;\n");
  runMixed(["add", "scripts/impl.mjs"]);
  runMixed(["commit", "-q", "-m", "code"]);
  const mixedBoundary = runMixed(["rev-parse", "HEAD"]);
  writeBoundary(mixed, mixedBoundary);
  writeFileSync(join(mixed, "package.json"), "{}\n");
  runMixed(["add", IMPLEMENTATION_BOUNDARY_RELATIVE, "package.json"]);
  runMixed(["commit", "-q", "-m", "evidence plus config"]);
  expectThrow("evidence commit mixed with config fails", () => verify(mixed), /含实施路径/);

  const dirty = join(root, "dirty");
  const runDirty = initRepo(dirty);
  mkdirSync(join(dirty, "scripts"), { recursive: true });
  writeFileSync(join(dirty, "scripts/impl.mjs"), "export default 1;\n");
  runDirty(["add", "scripts/impl.mjs"]);
  runDirty(["commit", "-q", "-m", "code"]);
  const dirtyBoundary = runDirty(["rev-parse", "HEAD"]);
  writeBoundary(dirty, dirtyBoundary);
  runDirty(["add", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  runDirty(["commit", "-q", "-m", "evidence"]);
  writeFileSync(
    join(dirty, IMPLEMENTATION_BOUNDARY_RELATIVE),
    `${readFileSync(join(dirty, IMPLEMENTATION_BOUNDARY_RELATIVE), "utf8").trimEnd()}\n\n`
  );
  expectThrow("uncommitted working tree edit fails", () => verify(dirty), /工作树\/index\/HEAD 实施边界证据 blob 不一致/);

  const missing = join(root, "missing");
  const runMissing = initRepo(missing);
  mkdirSync(join(missing, "docs"), { recursive: true });
  writeFileSync(join(missing, "docs/a.md"), "doc\n");
  runMissing(["add", "docs/a.md"]);
  runMissing(["commit", "-q", "-m", "seed"]);
  expectThrow("missing evidence file fails closed", () => verify(missing), /缺少实施边界证据文件/);

  const uncommitted = join(root, "uncommitted");
  const runUncommitted = initRepo(uncommitted);
  mkdirSync(join(uncommitted, "scripts"), { recursive: true });
  writeFileSync(join(uncommitted, "scripts/impl.mjs"), "export default 1;\n");
  runUncommitted(["add", "scripts/impl.mjs"]);
  runUncommitted(["commit", "-q", "-m", "code"]);
  writeBoundary(uncommitted, runUncommitted(["rev-parse", "HEAD"]));
  expectThrow("uncommitted evidence file fails closed", () => verify(uncommitted), /尚未以一次性提交入库|index entry 缺失|index blob 缺失/);

  const badSha = join(root, "badsha");
  const runBadSha = initRepo(badSha);
  mkdirSync(join(badSha, "scripts"), { recursive: true });
  writeFileSync(join(badSha, "scripts/impl.mjs"), "export default 1;\n");
  runBadSha(["add", "scripts/impl.mjs"]);
  runBadSha(["commit", "-q", "-m", "code"]);
  const real = runBadSha(["rev-parse", "HEAD"]);
  writeBoundary(badSha, real);
  runBadSha(["add", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  runBadSha(["commit", "-q", "-m", "evidence"]);
  writeFileSync(join(badSha, IMPLEMENTATION_BOUNDARY_RELATIVE), implementationBoundaryJson(FAKE_INTERNAL));
  runBadSha(["add", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  runBadSha(["commit", "-q", "-m", "rewrite sha"]);
  expectThrow("non-ancestor recorded sha fails closed", () => verify(badSha), /被再次修改|不是提交|不包含审计实施边界|第一父提交/);

  const pub = join(root, "public");
  const runPub = initRepo(pub);
  mkdirSync(join(pub, "scripts"), { recursive: true });
  writeFileSync(join(pub, "scripts/impl.mjs"), "export default 1;\n");
  writeBoundary(pub, FAKE_INTERNAL);
  writeLedgers(pub, FAKE_INTERNAL);
  commitSnapshot(runPub, FAKE_INTERNAL);
  const pubProof = verify(pub);
  assert(
    "synthetic public snapshot happy path",
    pubProof.mode === "public_snapshot" &&
      pubProof.implementationBoundary === FAKE_INTERNAL &&
      pubProof.publicSourceSha === FAKE_INTERNAL &&
      pubProof.publicBaselineCommit === runPub(["rev-parse", "HEAD"])
  );

  mkdirSync(join(pub, "docs"), { recursive: true });
  writeFileSync(join(pub, "docs/later.md"), "docs\n");
  commitSnapshot(runPub, FAKE_INTERNAL);
  assert("public baseline then docs-only snapshot passes", verify(pub).mode === "public_snapshot");

  const pubScript = join(root, "public-script");
  const runPubScript = initRepo(pubScript);
  mkdirSync(join(pubScript, "scripts"), { recursive: true });
  writeFileSync(join(pubScript, "scripts/impl.mjs"), "export default 1;\n");
  writeBoundary(pubScript, FAKE_INTERNAL);
  writeLedgers(pubScript, FAKE_INTERNAL);
  commitSnapshot(runPubScript, FAKE_INTERNAL);
  writeFileSync(join(pubScript, "scripts/impl.mjs"), "export default 2;\n");
  commitSnapshot(runPubScript, FAKE_INTERNAL);
  expectThrow("public baseline then scripts change is rejected", () => verify(pubScript), /未入账实施提交/);

  const pubEvil = join(root, "public-evil");
  const runPubEvil = initRepo(pubEvil);
  mkdirSync(join(pubEvil, "scripts"), { recursive: true });
  writeFileSync(join(pubEvil, "scripts/impl.mjs"), "export default 1;\n");
  writeBoundary(pubEvil, FAKE_INTERNAL);
  writeLedgers(pubEvil, FAKE_INTERNAL);
  commitSnapshot(runPubEvil, FAKE_INTERNAL);
  mkdirSync(join(pubEvil, "deploy/saydo-octoooo-com"), { recursive: true });
  writeFileSync(join(pubEvil, "deploy/saydo-octoooo-com/evil.html"), "<p>x</p>\n");
  commitSnapshot(runPubEvil, FAKE_INTERNAL);
  expectThrow("public baseline then non-exact deploy page is rejected", () => verify(pubEvil), /未入账实施提交/);

  const pubAvail = join(root, "public-avail");
  const runPubAvail = initRepo(pubAvail);
  mkdirSync(join(pubAvail, "scripts"), { recursive: true });
  mkdirSync(join(pubAvail, "deploy/saydo-octoooo-com/docs"), { recursive: true });
  mkdirSync(join(pubAvail, "deploy/saydo-octoooo-com/en/docs"), { recursive: true });
  writeFileSync(join(pubAvail, "scripts/impl.mjs"), "export default 1;\n");
  writeFileSync(join(pubAvail, "deploy/saydo-octoooo-com/index.html"), "<p>old</p>\n");
  writeFileSync(join(pubAvail, "deploy/saydo-octoooo-com/en/index.html"), "<p>old</p>\n");
  writeFileSync(join(pubAvail, "deploy/saydo-octoooo-com/docs/index.html"), "<p>old</p>\n");
  writeFileSync(join(pubAvail, "deploy/saydo-octoooo-com/en/docs/index.html"), "<p>old</p>\n");
  writeBoundary(pubAvail, FAKE_INTERNAL);
  writeLedgers(pubAvail, FAKE_INTERNAL);
  commitSnapshot(runPubAvail, FAKE_INTERNAL);
  writeFileSync(join(pubAvail, "deploy/saydo-octoooo-com/index.html"), "<p>new</p>\n");
  writeFileSync(join(pubAvail, "deploy/saydo-octoooo-com/en/index.html"), "<p>new</p>\n");
  writeFileSync(join(pubAvail, "deploy/saydo-octoooo-com/docs/index.html"), "<p>new</p>\n");
  writeFileSync(join(pubAvail, "deploy/saydo-octoooo-com/en/docs/index.html"), "<p>new</p>\n");
  commitSnapshot(runPubAvail, FAKE_INTERNAL);
  expectThrow("arbitrary html change after public baseline is a leak", () => verify(pubAvail), /未入账实施提交/);

  const notSnap = join(root, "not-snap");
  const runNotSnap = initRepo(notSnap);
  writeBoundary(notSnap, FAKE_INTERNAL);
  writeLedgers(notSnap, FAKE_INTERNAL);
  runNotSnap(["add", "-A"]);
  runNotSnap(["commit", "-q", "-m", "ordinary commit"]);
  expectThrow("non-snapshot HEAD cannot use public fallback", () => verify(notSnap), /不是合法公开快照/);

  const noFallback = join(root, "no-fallback");
  const runNoFallback = initRepo(noFallback);
  mkdirSync(join(noFallback, "scripts"), { recursive: true });
  writeFileSync(join(noFallback, "scripts/impl.mjs"), "export default 1;\n");
  runNoFallback(["add", "scripts/impl.mjs"]);
  runNoFallback(["commit", "-q", "-m", "code-a"]);
  const internalA = runNoFallback(["rev-parse", "HEAD"]);
  writeFileSync(join(noFallback, "scripts/more.mjs"), "export default 2;\n");
  runNoFallback(["add", "scripts/more.mjs"]);
  runNoFallback(["commit", "-q", "-m", "code-b"]);
  writeBoundary(noFallback, internalA);
  writeLedgers(noFallback, internalA);
  commitSnapshot(runNoFallback, internalA);
  expectThrow(
    "internal object present with protocol failure does not public-fallback",
    () => verify(noFallback),
    /第一父提交与记录 SHA 不一致/
  );

  const sym = join(root, "sym");
  const runSym = initRepo(sym);
  mkdirSync(join(sym, "scripts"), { recursive: true });
  mkdirSync(join(sym, "research/week-audit"), { recursive: true });
  writeFileSync(join(sym, "scripts/impl.mjs"), "export default 1;\n");
  runSym(["add", "scripts/impl.mjs"]);
  runSym(["commit", "-q", "-m", "code"]);
  const symBoundary = runSym(["rev-parse", "HEAD"]);
  writeFileSync(join(sym, "research/week-audit/target.json"), implementationBoundaryJson(symBoundary));
  symlinkSync("target.json", join(sym, IMPLEMENTATION_BOUNDARY_RELATIVE));
  runSym(["add", "-A"]);
  runSym(["commit", "-q", "-m", "symlink evidence"]);
  expectThrow("committed boundary symlink is rejected", () => verify(sym), /必须是常规文件/);

  const indexOnly = join(root, "index-only");
  const runIndex = initRepo(indexOnly);
  mkdirSync(join(indexOnly, "scripts"), { recursive: true });
  writeFileSync(join(indexOnly, "scripts/impl.mjs"), "export default 1;\n");
  runIndex(["add", "scripts/impl.mjs"]);
  runIndex(["commit", "-q", "-m", "code"]);
  const indexBoundary = runIndex(["rev-parse", "HEAD"]);
  writeBoundary(indexOnly, indexBoundary);
  runIndex(["add", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  runIndex(["commit", "-q", "-m", "evidence"]);
  const original = readFileSync(join(indexOnly, IMPLEMENTATION_BOUNDARY_RELATIVE), "utf8");
  writeFileSync(join(indexOnly, IMPLEMENTATION_BOUNDARY_RELATIVE), `${original.trimEnd()}\n\n`);
  runIndex(["add", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  writeFileSync(join(indexOnly, IMPLEMENTATION_BOUNDARY_RELATIVE), original);
  expectThrow("index-only boundary drift is rejected", () => verify(indexOnly), /工作树\/index\/HEAD 实施边界证据 blob 不一致/);

  const mergeEv = join(root, "merge-ev");
  const runMerge = initRepo(mergeEv);
  mkdirSync(join(mergeEv, "scripts"), { recursive: true });
  mkdirSync(join(mergeEv, "docs"), { recursive: true });
  writeFileSync(join(mergeEv, "scripts/impl.mjs"), "export default 1;\n");
  runMerge(["add", "scripts/impl.mjs"]);
  runMerge(["commit", "-q", "-m", "code"]);
  const mergeBoundary = runMerge(["rev-parse", "HEAD"]);
  runMerge(["checkout", "-q", "-b", "side"]);
  writeFileSync(join(mergeEv, "docs/side.md"), "side\n");
  runMerge(["add", "docs/side.md"]);
  runMerge(["commit", "-q", "-m", "side docs"]);
  runMerge(["checkout", "-q", "main"]);
  runMerge(["merge", "--no-ff", "--no-commit", "side"]);
  writeBoundary(mergeEv, mergeBoundary);
  runMerge(["add", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  runMerge(["commit", "-q", "-m", "merge evidence"]);
  expectThrow("merge evidence commit is rejected", () => verify(mergeEv), /必须恰好一个 parent/);

  const mergeHist = join(root, "merge-hist");
  const runHist = initRepo(mergeHist);
  mkdirSync(join(mergeHist, "scripts"), { recursive: true });
  mkdirSync(join(mergeHist, "docs"), { recursive: true });
  writeFileSync(join(mergeHist, "scripts/impl.mjs"), "export default 1;\n");
  runHist(["add", "scripts/impl.mjs"]);
  runHist(["commit", "-q", "-m", "code"]);
  const histBoundary = runHist(["rev-parse", "HEAD"]);
  runHist(["checkout", "-q", "-b", "edit"]);
  writeBoundary(mergeHist, histBoundary);
  runHist(["add", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  runHist(["commit", "-q", "-m", "add boundary"]);
  const histDoc = JSON.parse(readFileSync(join(mergeHist, IMPLEMENTATION_BOUNDARY_RELATIVE), "utf8"));
  histDoc.purpose = `${histDoc.purpose} branch`;
  writeFileSync(join(mergeHist, IMPLEMENTATION_BOUNDARY_RELATIVE), `${JSON.stringify(histDoc, null, 2)}\n`);
  runHist(["add", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  runHist(["commit", "-q", "-m", "edit boundary"]);
  runHist(["checkout", "-q", "main"]);
  writeFileSync(join(mergeHist, "docs/main.md"), "main\n");
  runHist(["add", "docs/main.md"]);
  runHist(["commit", "-q", "-m", "main docs"]);
  runHist(["merge", "-q", "--no-ff", "-m", "merge boundary history", "edit"]);
  expectThrow("full-history second boundary modification is rejected", () => verify(mergeHist), /被再次修改|必须恰好一个 parent/);

  const pubDup = join(root, "pub-dup");
  const runDup = initRepo(pubDup);
  writeBoundary(pubDup, FAKE_INTERNAL);
  writeLedgers(pubDup, FAKE_INTERNAL);
  runDup(["add", "-A"]);
  const dupTree = runDup(["write-tree"]);
  runDup([
    "commit",
    "-q",
    "-m",
    `snapshot: 2026-08-24 from internal ${FAKE_INTERNAL}`,
    "-m",
    `public-tree: ${dupTree}\npublic-tree: ${dupTree}\nfilter-version: public-exclude-v1`
  ]);
  expectThrow("duplicate public-tree line is rejected", () => verify(pubDup), /不是合法公开快照/);

  const pubWrongTree = join(root, "pub-wrong-tree");
  const runWrongTree = initRepo(pubWrongTree);
  writeBoundary(pubWrongTree, FAKE_INTERNAL);
  writeLedgers(pubWrongTree, FAKE_INTERNAL);
  runWrongTree(["add", "-A"]);
  runWrongTree([
    "commit",
    "-q",
    "-m",
    `snapshot: 2026-08-24 from internal ${FAKE_INTERNAL}`,
    "-m",
    `public-tree: ${"b".repeat(40)}\nfilter-version: public-exclude-v1`
  ]);
  expectThrow("wrong public-tree sha is rejected", () => verify(pubWrongTree), /不是合法公开快照/);

  const pubFilter = join(root, "pub-filter");
  const runFilter = initRepo(pubFilter);
  writeBoundary(pubFilter, FAKE_INTERNAL);
  writeLedgers(pubFilter, FAKE_INTERNAL);
  runFilter(["add", "-A"]);
  const filterTree = runFilter(["write-tree"]);
  runFilter([
    "commit",
    "-q",
    "-m",
    `snapshot: 2026-08-24 from internal ${FAKE_INTERNAL}`,
    "-m",
    `public-tree: ${filterTree}\nfilter-version: other`
  ]);
  expectThrow("wrong filter-version is rejected", () => verify(pubFilter), /不是合法公开快照/);

  const pubSubject = join(root, "pub-subject");
  const runSubject = initRepo(pubSubject);
  writeBoundary(pubSubject, FAKE_INTERNAL);
  writeLedgers(pubSubject, FAKE_INTERNAL);
  runSubject(["add", "-A"]);
  const subjectTree = runSubject(["write-tree"]);
  runSubject(["commit", "-q", "-m", "not a snapshot", "-m", `public-tree: ${subjectTree}\nfilter-version: public-exclude-v1`]);
  expectThrow("wrong snapshot subject is rejected", () => verify(pubSubject), /不是合法公开快照/);

  const pubManifest = join(root, "pub-manifest");
  const runManifest = initRepo(pubManifest);
  writeBoundary(pubManifest, FAKE_INTERNAL);
  writeLedgers(pubManifest, FAKE_INTERNAL);
  writeFileSync(join(pubManifest, PUBLICATION_JSON), `${JSON.stringify({ implementationBoundary: "b".repeat(40) }, null, 2)}\n`);
  commitSnapshot(runManifest, FAKE_INTERNAL);
  expectThrow("manifest boundary mismatch is rejected", () => verify(pubManifest), /implementationBoundary/);

  const mergeImpl = join(root, "merge-impl");
  const runMergeImpl = initRepo(mergeImpl);
  mkdirSync(join(mergeImpl, "scripts"), { recursive: true });
  mkdirSync(join(mergeImpl, "docs"), { recursive: true });
  writeFileSync(join(mergeImpl, "scripts/impl.mjs"), "export default 1;\n");
  runMergeImpl(["add", "scripts/impl.mjs"]);
  runMergeImpl(["commit", "-q", "-m", "code"]);
  const mergeImplBoundary = runMergeImpl(["rev-parse", "HEAD"]);
  writeBoundary(mergeImpl, mergeImplBoundary);
  runMergeImpl(["add", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  runMergeImpl(["commit", "-q", "-m", "evidence"]);
  runMergeImpl(["checkout", "-q", "-b", "docs-a"]);
  writeFileSync(join(mergeImpl, "docs/a.md"), "a\n");
  runMergeImpl(["add", "docs/a.md"]);
  runMergeImpl(["commit", "-q", "-m", "docs a"]);
  runMergeImpl(["checkout", "-q", "main"]);
  runMergeImpl(["checkout", "-q", "-b", "docs-b"]);
  mkdirSync(join(mergeImpl, "docs"), { recursive: true });
  writeFileSync(join(mergeImpl, "docs/b.md"), "b\n");
  runMergeImpl(["add", "docs/b.md"]);
  runMergeImpl(["commit", "-q", "-m", "docs b"]);
  runMergeImpl(["checkout", "-q", "main"]);
  runMergeImpl(["merge", "-q", "--no-ff", "-m", "docs-only merge", "docs-a"]);
  assert("docs-only merge after boundary is allowed", verify(mergeImpl).mode === "internal_history");
  runMergeImpl(["merge", "--no-ff", "--no-commit", "docs-b"]);
  writeFileSync(join(mergeImpl, "scripts/from-merge.mjs"), "export default 3;\n");
  runMergeImpl(["add", "scripts/from-merge.mjs"]);
  runMergeImpl(["commit", "-q", "-m", "merge adds scripts"]);
  const mergeWithScripts = runMergeImpl(["rev-parse", "HEAD"]);
  const defaultDiff = runMergeImpl(["diff-tree", "--no-commit-id", "--name-only", "-r", mergeWithScripts]);
  const parentUnion = commitPaths(gitText(mergeImpl), mergeWithScripts);
  assert("default merge diff-tree can hide implementation paths", defaultDiff.split("\n").filter(Boolean).length === 0);
  assert(
    "parent-union path enumeration sees scripts from merge resolution",
    parentUnion.includes("scripts/from-merge.mjs")
  );
  expectThrow(
    "merge after boundary that adds scripts is rejected",
    () => verify(mergeImpl),
    /未入账实施提交/
  );

  const octopus = join(root, "octopus");
  const runOctopus = initRepo(octopus);
  mkdirSync(join(octopus, "scripts"), { recursive: true });
  mkdirSync(join(octopus, "docs"), { recursive: true });
  writeFileSync(join(octopus, "scripts/impl.mjs"), "export default 1;\n");
  runOctopus(["add", "scripts/impl.mjs"]);
  runOctopus(["commit", "-q", "-m", "code"]);
  const octopusBoundary = runOctopus(["rev-parse", "HEAD"]);
  writeBoundary(octopus, octopusBoundary);
  runOctopus(["add", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  runOctopus(["commit", "-q", "-m", "evidence"]);
  const octopusBase = runOctopus(["rev-parse", "HEAD"]);
  runOctopus(["checkout", "-q", "-b", "o1"]);
  writeFileSync(join(octopus, "docs/o1.md"), "1\n");
  runOctopus(["add", "docs/o1.md"]);
  runOctopus(["commit", "-q", "-m", "o1"]);
  runOctopus(["checkout", "-q", octopusBase]);
  runOctopus(["checkout", "-q", "-b", "o2"]);
  mkdirSync(join(octopus, "docs"), { recursive: true });
  writeFileSync(join(octopus, "docs/o2.md"), "2\n");
  runOctopus(["add", "docs/o2.md"]);
  runOctopus(["commit", "-q", "-m", "o2"]);
  runOctopus(["checkout", "-q", octopusBase]);
  runOctopus(["merge", "--no-ff", "--no-commit", "o1", "o2"]);
  writeFileSync(join(octopus, "scripts/octopus.mjs"), "export default 4;\n");
  runOctopus(["add", "scripts/octopus.mjs"]);
  runOctopus(["commit", "-q", "-m", "octopus merge adds scripts"]);
  const octopusSha = runOctopus(["rev-parse", "HEAD"]);
  const octopusParents = runOctopus(["rev-list", "--parents", "-n", "1", octopusSha]).split(/\s+/).slice(1);
  assert("octopus merge has three parents", octopusParents.length === 3);
  const octopusPaths = commitPaths(gitText(octopus), octopusSha);
  assert("octopus parent-union includes scripts", octopusPaths.includes("scripts/octopus.mjs"));
  expectThrow("octopus merge after boundary that adds scripts is rejected", () => verify(octopus), /未入账实施提交/);

  expectThrow(
    "git subcommand failure is not treated as no change",
    () =>
      leakedImplementationAfterBoundary(octopusBoundary, (args) => {
        if (args[0] === "diff-tree" || args[0] === "cat-file") throw new Error("boom");
        return gitText(octopus)(args);
      }, "HEAD"),
    /无法枚举提交路径|无法判定对象类型|boom/
  );

  const missingSha = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  assert(
    "batch-check missing is explicit",
    parseGitBatchCheckOutput(missingSha, `${missingSha} missing\n`).kind === "missing"
  );
  expectThrow("batch-check empty output fails closed", () => parseGitBatchCheckOutput(missingSha, ""), /对象类型输出/);
  expectThrow("batch-check extra line fails closed", () => parseGitBatchCheckOutput(missingSha, `${missingSha} missing\nextra\n`), /含糊|畸形/);
  expectThrow(
    "batch-check malformed type fails closed",
    () => parseGitBatchCheckOutput(FAKE_INTERNAL, `${FAKE_INTERNAL} unknown 1\n`),
    /畸形/
  );

  const typeRepo = join(root, "object-types");
  const runType = initRepo(typeRepo);
  mkdirSync(join(typeRepo, "docs"), { recursive: true });
  writeFileSync(join(typeRepo, "docs/seed.md"), "seed\n");
  runType(["add", "docs/seed.md"]);
  const treeSha = runType(["write-tree"]);
  const blobSha = runType(["hash-object", "docs/seed.md"]);
  writeBoundary(typeRepo, blobSha);
  writeLedgers(typeRepo, blobSha);
  commitSnapshot(runType, blobSha);
  expectThrow("boundary pointing at blob does not public-fallback", () => verify(typeRepo), /对象类型非法:blob/);
  assert("real blob classifies as blob", classifyGitObject(gitText(typeRepo), blobSha).kind === "blob");
  assert("real commit classifies as commit", classifyGitObject(gitText(typeRepo), runType(["rev-parse", "HEAD"])).kind === "commit");
  assert("real tree classifies as tree", classifyGitObject(gitText(typeRepo), treeSha).kind === "tree");
  assert("missing sha classifies as missing", classifyGitObject(gitText(typeRepo), FAKE_INTERNAL).kind === "missing");

  const tagRepo = join(root, "object-tag");
  const runTag = initRepo(tagRepo);
  mkdirSync(join(tagRepo, "docs"), { recursive: true });
  writeFileSync(join(tagRepo, "docs/seed.md"), "seed\n");
  runTag(["add", "docs/seed.md"]);
  runTag(["commit", "-q", "-m", "seed"]);
  runTag(["tag", "-a", "v1", "-m", "annotated"]);
  const tagSha = runTag(["rev-parse", "v1"]);
  writeBoundary(tagRepo, tagSha);
  writeLedgers(tagRepo, tagSha);
  commitSnapshot(runTag, tagSha);
  expectThrow("boundary pointing at tag does not public-fallback", () => verify(tagRepo), /对象类型非法:tag/);
  assert("real tag classifies as tag", classifyGitObject(gitText(tagRepo), tagSha).kind === "tag");

  const treeRepo = join(root, "object-tree");
  const runTree = initRepo(treeRepo);
  mkdirSync(join(treeRepo, "docs"), { recursive: true });
  writeFileSync(join(treeRepo, "docs/seed.md"), "seed\n");
  runTree(["add", "docs/seed.md"]);
  const onlyTree = runTree(["write-tree"]);
  writeBoundary(treeRepo, onlyTree);
  writeLedgers(treeRepo, onlyTree);
  commitSnapshot(runTree, onlyTree);
  expectThrow("boundary pointing at tree does not public-fallback", () => verify(treeRepo), /对象类型非法:tree/);

  expectThrow(
    "batch-check spawn failure does not public-fallback",
    () =>
      verifyImplementationBoundaryProtocol({
        repo: pub,
        git: (args, options) => {
          if (args[0] === "cat-file" && args.includes("--batch-check")) {
            const error = new Error("spawn ENOENT");
            error.code = "ENOENT";
            throw error;
          }
          return gitText(pub)(args, options);
        },
        relativePath: IMPLEMENTATION_BOUNDARY_RELATIVE
      }),
    /无法判定实施边界对象类型/
  );
  expectThrow(
    "batch-check nonzero exit does not public-fallback",
    () =>
      verifyImplementationBoundaryProtocol({
        repo: pub,
        git: (args, options) => {
          if (args[0] === "cat-file" && args.includes("--batch-check")) {
            const error = new Error("git cat-file failed");
            error.status = 128;
            throw error;
          }
          return gitText(pub)(args, options);
        },
        relativePath: IMPLEMENTATION_BOUNDARY_RELATIVE
      }),
    /无法判定实施边界对象类型/
  );
  expectThrow(
    "batch-check extra output does not public-fallback",
    () =>
      verifyImplementationBoundaryProtocol({
        repo: pub,
        git: (args, options) => {
          if (args[0] === "cat-file" && args.includes("--batch-check")) {
            return `${FAKE_INTERNAL} missing\n${FAKE_INTERNAL} missing\n`;
          }
          return gitText(pub)(args, options);
        },
        relativePath: IMPLEMENTATION_BOUNDARY_RELATIVE
      }),
    /对象类型输出含糊|对象类型输出畸形/
  );
  expectThrow(
    "stdin-ignoring git adapter does not public-fallback",
    () =>
      verifyImplementationBoundaryProtocol({
        repo: pub,
        git: (args) => gitText(pub)(args),
        relativePath: IMPLEMENTATION_BOUNDARY_RELATIVE
      }),
    /对象类型输出/
  );

  const modeRepo = join(root, "index-mode");
  const runMode = initRepo(modeRepo);
  mkdirSync(join(modeRepo, "scripts"), { recursive: true });
  writeFileSync(join(modeRepo, "scripts/impl.mjs"), "export default 1;\n");
  runMode(["add", "scripts/impl.mjs"]);
  runMode(["commit", "-q", "-m", "code"]);
  const modeBoundary = runMode(["rev-parse", "HEAD"]);
  writeBoundary(modeRepo, modeBoundary);
  runMode(["add", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  runMode(["commit", "-q", "-m", "evidence"]);
  const alignedBlob = runMode(["rev-parse", `HEAD:${IMPLEMENTATION_BOUNDARY_RELATIVE}`]);
  runMode(["update-index", "--cacheinfo", `120000,${alignedBlob},${IMPLEMENTATION_BOUNDARY_RELATIVE}`]);
  expectThrow("index symlink mode with same blob is rejected", () => verify(modeRepo), /必须是常规文件/);

  const stageRepo = join(root, "index-stage");
  const runStage = initRepo(stageRepo);
  mkdirSync(join(stageRepo, "scripts"), { recursive: true });
  writeFileSync(join(stageRepo, "scripts/impl.mjs"), "export default 1;\n");
  runStage(["add", "scripts/impl.mjs"]);
  runStage(["commit", "-q", "-m", "code"]);
  const stageBoundary = runStage(["rev-parse", "HEAD"]);
  writeBoundary(stageRepo, stageBoundary);
  runStage(["add", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  runStage(["commit", "-q", "-m", "evidence"]);
  const stageBlob = runStage(["rev-parse", `HEAD:${IMPLEMENTATION_BOUNDARY_RELATIVE}`]);
  runStage(["rm", "--cached", "-q", "--", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  gitInput(
    stageRepo,
    ["update-index", "-z", "--index-info"],
    `100644 ${stageBlob} 1\t${IMPLEMENTATION_BOUNDARY_RELATIVE}\0`
  );
  expectThrow("nonzero index stage is rejected", () => verify(stageRepo), /stage 必须为 0/);

  const multiRepo = join(root, "index-multi");
  const runMulti = initRepo(multiRepo);
  mkdirSync(join(multiRepo, "scripts"), { recursive: true });
  writeFileSync(join(multiRepo, "scripts/impl.mjs"), "export default 1;\n");
  runMulti(["add", "scripts/impl.mjs"]);
  runMulti(["commit", "-q", "-m", "code"]);
  const multiBoundary = runMulti(["rev-parse", "HEAD"]);
  writeBoundary(multiRepo, multiBoundary);
  runMulti(["add", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  runMulti(["commit", "-q", "-m", "evidence"]);
  const multiBlob = runMulti(["rev-parse", `HEAD:${IMPLEMENTATION_BOUNDARY_RELATIVE}`]);
  runMulti(["rm", "--cached", "-q", "--", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  gitInput(
    multiRepo,
    ["update-index", "-z", "--index-info"],
    `100644 ${multiBlob} 1\t${IMPLEMENTATION_BOUNDARY_RELATIVE}\0` +
      `100644 ${multiBlob} 2\t${IMPLEMENTATION_BOUNDARY_RELATIVE}\0` +
      `100644 ${multiBlob} 3\t${IMPLEMENTATION_BOUNDARY_RELATIVE}\0`
  );
  expectThrow("multi-stage index is rejected", () => verify(multiRepo), /多个 stage/);

  const chmodRepo = join(root, "index-chmod");
  const runChmod = initRepo(chmodRepo);
  mkdirSync(join(chmodRepo, "scripts"), { recursive: true });
  writeFileSync(join(chmodRepo, "scripts/impl.mjs"), "export default 1;\n");
  runChmod(["add", "scripts/impl.mjs"]);
  runChmod(["commit", "-q", "-m", "code"]);
  const chmodBoundary = runChmod(["rev-parse", "HEAD"]);
  writeBoundary(chmodRepo, chmodBoundary);
  runChmod(["add", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  runChmod(["commit", "-q", "-m", "evidence"]);
  runChmod(["update-index", "--chmod=+x", "--", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  expectThrow("index/HEAD mode mismatch is rejected", () => verify(chmodRepo), /mode 不一致/);

  const missIdx = join(root, "index-missing");
  const runMissIdx = initRepo(missIdx);
  mkdirSync(join(missIdx, "scripts"), { recursive: true });
  writeFileSync(join(missIdx, "scripts/impl.mjs"), "export default 1;\n");
  runMissIdx(["add", "scripts/impl.mjs"]);
  runMissIdx(["commit", "-q", "-m", "code"]);
  const missIdxBoundary = runMissIdx(["rev-parse", "HEAD"]);
  writeBoundary(missIdx, missIdxBoundary);
  runMissIdx(["add", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  runMissIdx(["commit", "-q", "-m", "evidence"]);
  runMissIdx(["rm", "--cached", "-q", "--", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  expectThrow("missing index entry is rejected", () => verify(missIdx), /index entry 缺失/);

  const pubChain = join(root, "public-chain");
  const runPubChain = initRepo(pubChain);
  mkdirSync(join(pubChain, "scripts"), { recursive: true });
  writeFileSync(join(pubChain, "scripts/impl.mjs"), "export default 1;\n");
  writeBoundary(pubChain, FAKE_INTERNAL);
  writeLedgers(pubChain, FAKE_INTERNAL);
  commitSnapshot(runPubChain, FAKE_INTERNAL);
  mkdirSync(join(pubChain, "docs"), { recursive: true });
  writeFileSync(join(pubChain, "docs/a.md"), "a\n");
  commitSnapshot(runPubChain, FAKE_INTERNAL);
  writeFileSync(join(pubChain, "docs/b.md"), "b\n");
  commitSnapshot(runPubChain, FAKE_INTERNAL);
  assert("legal multi-generation snapshot chain is accepted", verify(pubChain).mode === "public_snapshot");

  const pubMid = join(root, "public-mid");
  const runPubMid = initRepo(pubMid);
  writeBoundary(pubMid, FAKE_INTERNAL);
  writeLedgers(pubMid, FAKE_INTERNAL);
  commitSnapshot(runPubMid, FAKE_INTERNAL);
  mkdirSync(join(pubMid, "docs"), { recursive: true });
  writeFileSync(join(pubMid, "docs/mid.md"), "ordinary\n");
  runPubMid(["add", "docs/mid.md"]);
  runPubMid(["commit", "-q", "-m", "ordinary evidence"]);
  writeFileSync(join(pubMid, "docs/after.md"), "after\n");
  commitSnapshot(runPubMid, FAKE_INTERNAL);
  expectThrow("ordinary intermediate commit cannot be laundered", () => verify(pubMid), /非 snapshot/);

  const pubMergeSnap = join(root, "public-merge-snap");
  const runPubMergeSnap = initRepo(pubMergeSnap);
  writeBoundary(pubMergeSnap, FAKE_INTERNAL);
  writeLedgers(pubMergeSnap, FAKE_INTERNAL);
  commitSnapshot(runPubMergeSnap, FAKE_INTERNAL);
  runPubMergeSnap(["checkout", "-q", "-b", "side"]);
  mkdirSync(join(pubMergeSnap, "docs"), { recursive: true });
  writeFileSync(join(pubMergeSnap, "docs/side.md"), "side\n");
  commitSnapshot(runPubMergeSnap, FAKE_INTERNAL);
  runPubMergeSnap(["checkout", "-q", "main"]);
  mkdirSync(join(pubMergeSnap, "docs"), { recursive: true });
  writeFileSync(join(pubMergeSnap, "docs/main.md"), "main\n");
  commitSnapshot(runPubMergeSnap, FAKE_INTERNAL);
  runPubMergeSnap(["merge", "-q", "--no-ff", "-m", "merge snapshots", "side"]);
  expectThrow("public merge snapshot chain is rejected", () => verify(pubMergeSnap), /非 snapshot|parent|不是合法公开快照/);

  const pubMeta = join(root, "public-mid-meta");
  const runPubMeta = initRepo(pubMeta);
  writeBoundary(pubMeta, FAKE_INTERNAL);
  writeLedgers(pubMeta, FAKE_INTERNAL);
  commitSnapshot(runPubMeta, FAKE_INTERNAL);
  mkdirSync(join(pubMeta, "docs"), { recursive: true });
  writeFileSync(join(pubMeta, "docs/bad.md"), "bad\n");
  runPubMeta(["add", "-A"]);
  const badTree = runPubMeta(["write-tree"]);
  runPubMeta([
    "commit",
    "-q",
    "-m",
    `snapshot: 2026-08-24 from internal ${FAKE_INTERNAL}`,
    "-m",
    `public-tree: ${badTree}\nfilter-version: other`
  ]);
  writeFileSync(join(pubMeta, "docs/later.md"), "later\n");
  commitSnapshot(runPubMeta, FAKE_INTERNAL);
  expectThrow("intermediate wrong metadata is rejected", () => verify(pubMeta), /非 snapshot/);

  const pubParent = join(root, "public-parent");
  const runPubParent = initRepo(pubParent);
  writeBoundary(pubParent, FAKE_INTERNAL);
  writeLedgers(pubParent, FAKE_INTERNAL);
  commitSnapshot(runPubParent, FAKE_INTERNAL);
  const parentBaseline = runPubParent(["rev-parse", "HEAD"]);
  mkdirSync(join(pubParent, "docs"), { recursive: true });
  writeFileSync(join(pubParent, "docs/skip.md"), "skip\n");
  commitSnapshot(runPubParent, FAKE_INTERNAL);
  const skipped = runPubParent(["rev-parse", "HEAD"]);
  writeFileSync(join(pubParent, "docs/head.md"), "head\n");
  runPubParent(["add", "-A"]);
  const headTree = runPubParent(["write-tree"]);
  const skippedParent = execFileSync(
    "git",
    [
      "commit-tree",
      headTree,
      "-p",
      parentBaseline,
      "-m",
      `snapshot: 2026-08-24 from internal ${FAKE_INTERNAL}`,
      "-m",
      `public-tree: ${headTree}\nfilter-version: public-exclude-v1`
    ],
    { cwd: pubParent, encoding: "utf8" }
  ).trim();
  runPubParent(["reset", "-q", "--hard", "HEAD"]);
  runPubParent(["merge", "-q", "--no-ff", "-m", "join skipped parent", skippedParent]);
  expectThrow("public chain with wrong parent linkage is rejected", () => verify(pubParent), /非 snapshot|parent|不是合法公开快照/);
  assert("skipped snapshot still exists as a real object", /^[0-9a-f]{40}$/.test(skipped));

  const pubDupBase = join(root, "public-dup-base");
  const runDupBase = initRepo(pubDupBase);
  writeBoundary(pubDupBase, FAKE_INTERNAL);
  writeLedgers(pubDupBase, FAKE_INTERNAL);
  commitSnapshot(runDupBase, FAKE_INTERNAL);
  runDupBase(["checkout", "-q", "--orphan", "other"]);
  mkdirSync(join(pubDupBase, "docs"), { recursive: true });
  writeFileSync(join(pubDupBase, "docs/other.md"), "other\n");
  commitSnapshot(runDupBase, FAKE_INTERNAL);
  runDupBase(["checkout", "-q", "main"]);
  runDupBase(["merge", "-q", "--allow-unrelated-histories", "--no-ff", "-m", "merge two baselines", "other"]);
  expectThrow("multiple public baseline candidates are rejected", () => verify(pubDupBase), /被再次修改|非 snapshot|parent|不是合法公开快照/);

  const sourceRepo = resolve(here, "..");
  function writeCandidateHtml(repo) {
    for (const path of AVAILABILITY_HTML_PATHS) {
      mkdirSync(join(repo, dirname(path)), { recursive: true });
      writeFileSync(join(repo, path), readFileSync(join(sourceRepo, path)));
    }
  }

  const avail = join(root, "avail-ok");
  const runAvail = initRepo(avail);
  mkdirSync(join(avail, "scripts"), { recursive: true });
  writeFileSync(join(avail, "scripts/impl.mjs"), "export default 1;\n");
  writeCandidateHtml(avail);
  runAvail(["add", "scripts/impl.mjs", ...AVAILABILITY_HTML_PATHS]);
  runAvail(["commit", "-q", "-m", "code"]);
  const availBoundary = runAvail(["rev-parse", "HEAD"]);
  writeBoundary(avail, availBoundary);
  runAvail(["add", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  runAvail(["commit", "-q", "-m", "evidence"]);
  for (const path of AVAILABILITY_HTML_PATHS) {
    writeFileSync(join(avail, path), applyAvailabilityReplacements(readFileSync(join(avail, path), "utf8"), path));
  }
  runAvail(["add", ...AVAILABILITY_HTML_PATHS]);
  runAvail(["commit", "-q", "-m", "availability"]);
  const availGit = gitText(avail);
  const availHead = runAvail(["rev-parse", "HEAD"]);
  assert("exact availability transition is accepted", isAvailabilityTransitionCommit(availGit, availHead));
  assert(
    "exact availability transition is not an implementation leak",
    leakedImplementationAfterBoundary(availBoundary, availGit, "HEAD").length === 0
  );
  assert("internal history still accepts availability transition", verify(avail).mode === "internal_history");

  const availScript = join(root, "avail-script");
  const runAvailScript = initRepo(availScript);
  mkdirSync(join(availScript, "scripts"), { recursive: true });
  writeFileSync(join(availScript, "scripts/impl.mjs"), "export default 1;\n");
  writeCandidateHtml(availScript);
  runAvailScript(["add", "scripts/impl.mjs", ...AVAILABILITY_HTML_PATHS]);
  runAvailScript(["commit", "-q", "-m", "code"]);
  const scriptBoundary = runAvailScript(["rev-parse", "HEAD"]);
  writeBoundary(availScript, scriptBoundary);
  runAvailScript(["add", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  runAvailScript(["commit", "-q", "-m", "evidence"]);
  for (const path of AVAILABILITY_HTML_PATHS) {
    writeFileSync(
      join(availScript, path),
      `${applyAvailabilityReplacements(readFileSync(join(availScript, path), "utf8"), path)}<script>x</script>`
    );
  }
  runAvailScript(["add", ...AVAILABILITY_HTML_PATHS]);
  runAvailScript(["commit", "-q", "-m", "script"]);
  expectThrow("availability script injection is an implementation leak", () => verify(availScript), /未入账实施提交/);

  const availByte = join(root, "avail-byte");
  const runAvailByte = initRepo(availByte);
  mkdirSync(join(availByte, "scripts"), { recursive: true });
  writeFileSync(join(availByte, "scripts/impl.mjs"), "export default 1;\n");
  writeCandidateHtml(availByte);
  runAvailByte(["add", "scripts/impl.mjs", ...AVAILABILITY_HTML_PATHS]);
  runAvailByte(["commit", "-q", "-m", "code"]);
  const byteBoundary = runAvailByte(["rev-parse", "HEAD"]);
  writeBoundary(availByte, byteBoundary);
  runAvailByte(["add", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  runAvailByte(["commit", "-q", "-m", "evidence"]);
  for (const path of AVAILABILITY_HTML_PATHS) {
    writeFileSync(join(availByte, path), applyAvailabilityReplacements(readFileSync(join(availByte, path), "utf8"), path));
  }
  writeFileSync(
    join(availByte, AVAILABILITY_HTML_PATHS[0]),
    `${readFileSync(join(availByte, AVAILABILITY_HTML_PATHS[0]), "utf8")} `
  );
  runAvailByte(["add", ...AVAILABILITY_HTML_PATHS]);
  runAvailByte(["commit", "-q", "-m", "byte-drift"]);
  expectThrow("availability single-byte drift is an implementation leak", () => verify(availByte), /未入账实施提交/);

  const availMissing = join(root, "avail-missing");
  const runAvailMissing = initRepo(availMissing);
  mkdirSync(join(availMissing, "scripts"), { recursive: true });
  writeFileSync(join(availMissing, "scripts/impl.mjs"), "export default 1;\n");
  writeCandidateHtml(availMissing);
  runAvailMissing(["add", "scripts/impl.mjs", ...AVAILABILITY_HTML_PATHS]);
  runAvailMissing(["commit", "-q", "-m", "code"]);
  const missingBoundary = runAvailMissing(["rev-parse", "HEAD"]);
  writeBoundary(availMissing, missingBoundary);
  runAvailMissing(["add", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  runAvailMissing(["commit", "-q", "-m", "evidence"]);
  const missingPages = AVAILABILITY_HTML_PATHS.slice(0, 3);
  for (const path of missingPages) {
    writeFileSync(join(availMissing, path), applyAvailabilityReplacements(readFileSync(join(availMissing, path), "utf8"), path));
  }
  runAvailMissing(["add", ...missingPages]);
  runAvailMissing(["commit", "-q", "-m", "missing-page"]);
  expectThrow("availability missing page is an implementation leak", () => verify(availMissing), /未入账实施提交/);

  const availDup = join(root, "avail-dup");
  const runAvailDup = initRepo(availDup);
  mkdirSync(join(availDup, "scripts"), { recursive: true });
  writeFileSync(join(availDup, "scripts/impl.mjs"), "export default 1;\n");
  writeCandidateHtml(availDup);
  runAvailDup(["add", "scripts/impl.mjs", ...AVAILABILITY_HTML_PATHS]);
  runAvailDup(["commit", "-q", "-m", "code"]);
  const dupBoundary = runAvailDup(["rev-parse", "HEAD"]);
  writeBoundary(availDup, dupBoundary);
  runAvailDup(["add", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  runAvailDup(["commit", "-q", "-m", "evidence"]);
  for (const path of AVAILABILITY_HTML_PATHS) {
    writeFileSync(join(availDup, path), applyAvailabilityReplacements(readFileSync(join(availDup, path), "utf8"), path));
  }
  runAvailDup(["add", ...AVAILABILITY_HTML_PATHS]);
  runAvailDup(["commit", "-q", "-m", "availability"]);
  for (const path of AVAILABILITY_HTML_PATHS) {
    writeFileSync(join(availDup, path), `${readFileSync(join(availDup, path), "utf8")}\n`);
  }
  runAvailDup(["add", ...AVAILABILITY_HTML_PATHS]);
  runAvailDup(["commit", "-q", "-m", "availability-again"]);
  expectThrow("duplicate availability transition is an implementation leak", () => verify(availDup), /未入账实施提交/);

  const availParentScript = join(root, "avail-parent-script");
  const runAvailParentScript = initRepo(availParentScript);
  mkdirSync(join(availParentScript, "scripts"), { recursive: true });
  writeFileSync(join(availParentScript, "scripts/impl.mjs"), "export default 1;\n");
  writeCandidateHtml(availParentScript);
  for (const path of AVAILABILITY_HTML_PATHS) {
    writeFileSync(join(availParentScript, path), `${readFileSync(join(availParentScript, path), "utf8")}<script>x</script>`);
  }
  runAvailParentScript(["add", "scripts/impl.mjs", ...AVAILABILITY_HTML_PATHS]);
  runAvailParentScript(["commit", "-q", "-m", "code"]);
  const parentScriptBoundary = runAvailParentScript(["rev-parse", "HEAD"]);
  writeBoundary(availParentScript, parentScriptBoundary);
  runAvailParentScript(["add", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  runAvailParentScript(["commit", "-q", "-m", "evidence"]);
  for (const path of AVAILABILITY_HTML_PATHS) {
    writeFileSync(
      join(availParentScript, path),
      applyAvailabilityReplacements(readFileSync(join(availParentScript, path), "utf8"), path)
    );
  }
  runAvailParentScript(["add", ...AVAILABILITY_HTML_PATHS]);
  runAvailParentScript(["commit", "-q", "-m", "availability-from-scripted-parent"]);
  expectThrow(
    "parent script then text replace is an implementation leak",
    () => verify(availParentScript),
    /未入账实施提交/
  );

  const availWrongBefore = join(root, "avail-wrong-before");
  const runAvailWrongBefore = initRepo(availWrongBefore);
  mkdirSync(join(availWrongBefore, "scripts"), { recursive: true });
  writeFileSync(join(availWrongBefore, "scripts/impl.mjs"), "export default 1;\n");
  writeCandidateHtml(availWrongBefore);
  writeFileSync(
    join(availWrongBefore, AVAILABILITY_HTML_PATHS[0]),
    `${readFileSync(join(availWrongBefore, AVAILABILITY_HTML_PATHS[0]), "utf8")} `
  );
  runAvailWrongBefore(["add", "scripts/impl.mjs", ...AVAILABILITY_HTML_PATHS]);
  runAvailWrongBefore(["commit", "-q", "-m", "code"]);
  const wrongBeforeBoundary = runAvailWrongBefore(["rev-parse", "HEAD"]);
  writeBoundary(availWrongBefore, wrongBeforeBoundary);
  runAvailWrongBefore(["add", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  runAvailWrongBefore(["commit", "-q", "-m", "evidence"]);
  for (const path of AVAILABILITY_HTML_PATHS) {
    writeFileSync(
      join(availWrongBefore, path),
      applyAvailabilityReplacements(readFileSync(join(availWrongBefore, path), "utf8"), path)
    );
  }
  runAvailWrongBefore(["add", ...AVAILABILITY_HTML_PATHS]);
  runAvailWrongBefore(["commit", "-q", "-m", "availability-wrong-before"]);
  expectThrow("wrong-before availability is an implementation leak", () => verify(availWrongBefore), /未入账实施提交/);

  const availExtra = join(root, "avail-extra");
  const runAvailExtra = initRepo(availExtra);
  mkdirSync(join(availExtra, "scripts"), { recursive: true });
  mkdirSync(join(availExtra, "docs"), { recursive: true });
  writeFileSync(join(availExtra, "scripts/impl.mjs"), "export default 1;\n");
  writeCandidateHtml(availExtra);
  runAvailExtra(["add", "scripts/impl.mjs", ...AVAILABILITY_HTML_PATHS]);
  runAvailExtra(["commit", "-q", "-m", "code"]);
  const extraBoundary = runAvailExtra(["rev-parse", "HEAD"]);
  writeBoundary(availExtra, extraBoundary);
  runAvailExtra(["add", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  runAvailExtra(["commit", "-q", "-m", "evidence"]);
  for (const path of AVAILABILITY_HTML_PATHS) {
    writeFileSync(join(availExtra, path), applyAvailabilityReplacements(readFileSync(join(availExtra, path), "utf8"), path));
  }
  writeFileSync(join(availExtra, "docs/note.md"), "extra\n");
  runAvailExtra(["add", ...AVAILABILITY_HTML_PATHS, "docs/note.md"]);
  runAvailExtra(["commit", "-q", "-m", "availability-extra-path"]);
  expectThrow("availability extra path is an implementation leak", () => verify(availExtra), /未入账实施提交/);

  const availForge = join(root, "avail-forge");
  const runAvailForge = initRepo(availForge);
  mkdirSync(join(availForge, "scripts"), { recursive: true });
  writeFileSync(join(availForge, "scripts/impl.mjs"), "export default 1;\n");
  writeCandidateHtml(availForge);
  runAvailForge(["add", "scripts/impl.mjs", ...AVAILABILITY_HTML_PATHS]);
  runAvailForge(["commit", "-q", "-m", "code"]);
  const forgeBoundary = runAvailForge(["rev-parse", "HEAD"]);
  writeBoundary(availForge, forgeBoundary);
  runAvailForge(["add", IMPLEMENTATION_BOUNDARY_RELATIVE]);
  runAvailForge(["commit", "-q", "-m", "evidence"]);
  for (const path of AVAILABILITY_HTML_PATHS) {
    writeFileSync(join(availForge, path), applyAvailabilityReplacements(readFileSync(join(availForge, path), "utf8"), path));
  }
  runAvailForge(["add", ...AVAILABILITY_HTML_PATHS]);
  runAvailForge(["commit", "-q", "-m", "availability"]);
  const forgeHead = runAvailForge(["rev-parse", "HEAD"]);
  const realForge = gitText(availForge);
  const fakeBlob = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  let lastRealBlob = null;
  const forgedGit = (args, options) => {
    if (args[0] === "ls-tree") {
      const out = String(realForge(args, options));
      const match = /blob ([0-9a-f]{40})/.exec(out);
      lastRealBlob = match ? match[1] : lastRealBlob;
      return match ? out.replace(match[1], fakeBlob) : out;
    }
    if (args[0] === "cat-file" && args[1] === "blob" && args[2] === fakeBlob && lastRealBlob) {
      return realForge(["cat-file", "blob", lastRealBlob], options);
    }
    return realForge(args, options);
  };
  assert("forged ls-tree blob identity is rejected", isAvailabilityTransitionCommit(forgedGit, forgeHead) === false);
} finally {
  rmSync(root, { recursive: true, force: true });
}

process.stdout.write(`week-audit-boundary self-test: pass=${pass} fail=${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
