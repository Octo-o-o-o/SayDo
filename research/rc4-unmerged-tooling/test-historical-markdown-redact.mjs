#!/usr/bin/env node
// 历史 prompt/report 最小脱敏变换自测:只读 fixed-point,不得写目标仓。
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  HISTORICAL_DESTINATION_MAP,
  applyControlledRevision,
  bodyWithoutDestinations,
  decodeFileLocalPath,
  extractMarkdownDestinations,
  isHistoricalMarkdownPath,
  isHomeShapedDestination,
  rewritePrivacyDestination,
  transformHistoricalMarkdown
} from "./historical-markdown-redact.mjs";
import { countPublicPrivacyHits } from "./public-text-redaction.mjs";
import { gitBlobId } from "./git-blob-id.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inventory = JSON.parse(readFileSync(resolve(repo, "scripts/historical-markdown-inventory.json"), "utf8"));
let pass = 0;
let fail = 0;

function assert(label, ok) {
  if (ok) {
    process.stdout.write(`[ok] ${label}\n`);
    pass += 1;
  } else {
    process.stdout.write(`[fail] ${label}\n`);
    fail += 1;
  }
}

function gitZ(args) {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" }).split("\0").filter(Boolean);
}

const baseHead = inventory.baseHead;
assert("inventory baseHead is 40-hex", typeof baseHead === "string" && /^[0-9a-f]{40}$/.test(baseHead));
let baseIsAncestor = false;
try {
  execFileSync("git", ["merge-base", "--is-ancestor", baseHead, "HEAD"], { cwd: repo, stdio: "ignore" });
  baseIsAncestor = true;
} catch {
  baseIsAncestor = false;
}
assert("inventory baseHead is ancestor of HEAD", baseIsAncestor);

function gitShow(rev, path) {
  return execFileSync("git", ["show", `${rev}:${path}`], { cwd: repo, encoding: "utf8" });
}

function existsAtRev(rev, path) {
  const listed = execFileSync("git", ["ls-tree", "--name-only", "-z", rev, "--", path], { cwd: repo, encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
  return listed.includes(path);
}

function destMultiset(text) {
  return extractMarkdownDestinations(text).slice().sort();
}

function sameMultiset(a, b) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function sha256Of(text) {
  return createHash("sha256").update(text).digest("hex");
}

function workingMode(path) {
  return (lstatSync(path).mode & 0o111) !== 0 ? "100755" : "100644";
}

function expectedFromBase(baseText, rel) {
  const generic = transformHistoricalMarkdown(baseText, rel, repo);
  const revision = (inventory.controlledRevisions ?? []).find((row) => row.path === rel);
  if (!revision) return { expected: generic, revision: null, generic };
  if (sha256Of(generic) !== revision.beforeSha256 || Buffer.byteLength(generic) !== revision.beforeBytes) {
    throw new Error(`controlled revision before digest mismatch:${rel}`);
  }
  const expected = applyControlledRevision(generic, revision);
  if (
    sha256Of(expected) !== revision.afterSha256 ||
    Buffer.byteLength(expected) !== revision.afterBytes ||
    gitBlobId(Buffer.from(expected)) !== revision.afterGitBlob ||
    revision.mode !== "100644" && revision.mode !== "100755"
  ) {
    throw new Error(`controlled revision after digest mismatch:${rel}`);
  }
  return { expected, revision, generic };
}

const tracked = gitZ(["ls-files", "-z", "prompts", "research/codex-findings"]).filter(isHistoricalMarkdownPath);
const untracked = gitZ(["ls-files", "-z", "--others", "--exclude-standard", "prompts", "research/codex-findings"]).filter(
  isHistoricalMarkdownPath
);
const corpus = [...new Set([...tracked, ...untracked])].sort();
const newVsBase = tracked.filter((rel) => !existsAtRev(baseHead, rel));
assert("historical markdown corpus is non-empty", corpus.length > 0);
assert(
  "corpus includes untracked or post-base candidate markdown",
  untracked.length >= 1 || newVsBase.length >= 1
);

function posixHome(user, rest) {
  return ["", "Users", user].join("/") + rest;
}
const sample = `[x](${posixHome("alice", "/WorkSpace/SayDo/docs/09-data-contracts.md:3")})`;
const sampleOut = transformHistoricalMarkdown(sample, "research/codex-findings/x.md", repo);
assert(
  "in-repo absolute dest becomes existing relative",
  sampleOut.includes("](../../docs/09-data-contracts.md:3)") && !sampleOut.includes(posixHome("alice", ""))
);
const externalSample = transformHistoricalMarkdown(
  `[y](${posixHome("alice", "/WorkSpace/OctoAgent/docs/a.md:1")})`,
  "research/codex-findings/x.md",
  repo
);
assert(
  "out-of-repo dest becomes explicit external",
  externalSample.includes("](file://~/WorkSpace/OctoAgent/docs/a.md:1)") &&
    extractMarkdownDestinations(externalSample).length === 1
);
const brokenRelative = "[old](../voice-coding-framework.Cursor2.md) and [ok](../../docs/09-data-contracts.md)";
assert(
  "generic transformer keeps broken relative dest byte-for-byte",
  transformHistoricalMarkdown(brokenRelative, "research/codex-findings/not-04.md", repo) === brokenRelative
);

const fileUriMac = `[z](file://${posixHome("alice", "/WorkSpace/OctoAgent/a.md")})`;
const fileUriLinux = `[z](file://${["", "home", "alice", "secret.md"].join("/")})`;
const fileUriWin = `[z](file:///${["C:", "Users", "alice", "secret.md"].join("/")})`;
const encoded = `[z](file://${posixHome("Jane%20Doe", "/WorkSpace/OctoAgent/a.md")})`;
assert(
  "file uri mac home is decoded then redacted",
  !Object.keys(countPublicPrivacyHits(transformHistoricalMarkdown(fileUriMac, "research/codex-findings/x.md", repo))).length
);
assert(
  "file uri linux home is decoded then redacted",
  !Object.keys(countPublicPrivacyHits(transformHistoricalMarkdown(fileUriLinux, "research/codex-findings/x.md", repo))).length
);
assert(
  "file uri windows home is decoded then redacted",
  !Object.keys(countPublicPrivacyHits(transformHistoricalMarkdown(fileUriWin, "research/codex-findings/x.md", repo))).length
);
assert(
  "percent-encoded file uri is decoded",
  decodeFileLocalPath(`file://${posixHome("Jane%20Doe", "/src")}`).includes("Jane Doe")
);
assert(
  "encoded file uri has no leftover privacy hit",
  !Object.keys(countPublicPrivacyHits(transformHistoricalMarkdown(encoded, "research/codex-findings/x.md", repo))).length
);

const dirty = mkdtempSync(join(tmpdir(), "saydo-hist-md-"));
const dirtyRel = "research/codex-findings/dirty.md";
writeFileSync(join(dirty, "dirty.md"), `[x](${posixHome("alice", "/WorkSpace/OctoAgent/x.md")})\n`);
const beforeDirty = readFileSync(join(dirty, "dirty.md"));
const dirtyOut = transformHistoricalMarkdown(beforeDirty.toString("utf8"), dirtyRel, repo);
assert("dirty candidate transform is not identity", dirtyOut !== beforeDirty.toString("utf8"));
assert("dirty candidate file was not written", readFileSync(join(dirty, "dirty.md")).equals(beforeDirty));
rmSync(dirty, { recursive: true, force: true });

assert("inventory schemaVersion is 2", inventory.schemaVersion === 2);
assert("inventory corpus is frozen exact set", Array.isArray(inventory.corpus) && sameMultiset([...inventory.corpus].sort(), corpus));
const revisionPaths = (inventory.controlledRevisions ?? []).map((row) => row.path);
assert(
  "controlled revisions are unique corpus paths",
  new Set(revisionPaths).size === revisionPaths.length && revisionPaths.every((path) => corpus.includes(path))
);

const expectedChanged = new Set(inventory.changedFromHead);
const actualChanged = [];
let workingMismatch = 0;
let identityFail = 0;
let destDrift = 0;
let privacyHits = 0;
let mappedMissing = 0;
let bytesMismatch = 0;
let bodyMismatch = 0;
let destMismatch = 0;
let revisionModeMismatch = 0;
const usedRevisions = new Set();

for (const rel of corpus) {
  const working = readFileSync(resolve(repo, rel), "utf8");
  const atBase = existsAtRev(baseHead, rel);
  if (atBase) {
    const base = gitShow(baseHead, rel);
    const transformed = transformHistoricalMarkdown(base, rel, repo);
    if (transformed !== base) actualChanged.push(rel);
    const { expected, revision } = expectedFromBase(base, rel);
    if (revision) {
      usedRevisions.add(rel);
      if (workingMode(resolve(repo, rel)) !== revision.mode) revisionModeMismatch += 1;
    }
    if (working !== expected) bytesMismatch += 1;
    if (bodyWithoutDestinations(working) !== bodyWithoutDestinations(expected)) bodyMismatch += 1;
    if (!sameMultiset(destMultiset(working), destMultiset(expected))) destMismatch += 1;
    if (transformHistoricalMarkdown(working, rel, repo) !== working) workingMismatch += 1;
    const beforeDests = extractMarkdownDestinations(base);
    const afterDests = extractMarkdownDestinations(transformed);
    const mapped = HISTORICAL_DESTINATION_MAP[rel] ?? {};
    const expectedAfter = beforeDests.map((dest) => {
      if (mapped[dest] != null) return mapped[dest];
      if (isHomeShapedDestination(dest)) return rewritePrivacyDestination(dest, rel, repo);
      return dest;
    });
    if (afterDests.length !== beforeDests.length || !sameMultiset([...expectedAfter].sort(), [...afterDests].sort())) {
      destDrift += 1;
    }
    for (const [from, to] of Object.entries(mapped)) {
      if (!afterDests.includes(to) || !existsSync(resolve(repo, dirname(rel), to.split("#")[0].split("?")[0]))) {
        mappedMissing += 1;
      }
      void from;
    }
  } else {
    const transformed = transformHistoricalMarkdown(working, rel, repo);
    if (transformed !== working) identityFail += 1;
    if (working !== transformed) bytesMismatch += 1;
    if (bodyWithoutDestinations(working) !== bodyWithoutDestinations(transformed)) bodyMismatch += 1;
    if (!sameMultiset(destMultiset(working), destMultiset(transformed))) destMismatch += 1;
  }
  if (Object.keys(countPublicPrivacyHits(working)).length > 0) privacyHits += 1;
}

const extra = actualChanged.filter((path) => !expectedChanged.has(path));
const missing = [...expectedChanged].filter((path) => !actualChanged.includes(path));
assert("inventory changedFromHead matches transform(base)", extra.length === 0 && missing.length === 0);
assert("working tree is transform fixed-point", workingMismatch === 0);
assert("untracked historical files are transform identity", identityFail === 0);
assert("generic destination multiset and count are preserved", destDrift === 0);
assert("explicit destination map targets exist", mappedMissing === 0);
assert(
  "current bytes match generic transform plus controlled revisions",
  bytesMismatch === 0 && bodyMismatch === 0 && destMismatch === 0 && revisionModeMismatch === 0
);
assert("every controlled revision is consumed", usedRevisions.size === revisionPaths.length);
assert(
  `historical corpus closed ${corpus.length}/${corpus.length}`,
  bytesMismatch === 0 && corpus.length === inventory.corpus.length
);
const missingMapRoot = mkdtempSync(join(tmpdir(), "saydo-hist-map-"));
let mapMissingThrew = false;
try {
  transformHistoricalMarkdown(
    "[old](../voice-coding-framework.Cursor2.md)",
    "research/codex-findings/04-interaction-product.md",
    missingMapRoot
  );
} catch (error) {
  mapMissingThrew = /historical destination map target missing/.test(
    error instanceof Error ? error.message : String(error)
  );
}
rmSync(missingMapRoot, { recursive: true, force: true });
assert("explicit destination map missing target fail-closed", mapMissingThrew);
const revised24 = "research/codex-findings/24-repo-merge-migration-review.md";
const expected24 = expectedFromBase(gitShow(baseHead, revised24), revised24).expected;
const extraDeleted = expected24.replace("[AGENTS.md:88](../../AGENTS.md#L88)", "AGENTS.md:88");
assert(
  "extra dest deletion without catalog mismatches bytes and dest multiset",
  extraDeleted !== expected24 &&
    !sameMultiset(destMultiset(extraDeleted), destMultiset(expected24)) &&
    bodyWithoutDestinations(extraDeleted) !== bodyWithoutDestinations(expected24)
);
let fromSpanThrew = false;
try {
  applyControlledRevision(expected24, { from: "no-such-span", to: "x" });
} catch (error) {
  fromSpanThrew = /from-span count/.test(error instanceof Error ? error.message : String(error));
}
assert("controlled revision requires exact one from-span", fromSpanThrew);
assert("working historical files have no privacy hits", privacyHits === 0);
assert("read-only gate reports changed=0 at fixed point", workingMismatch === 0 && identityFail === 0);
assert(
  "self-test source has no privacy hits",
  Object.keys(countPublicPrivacyHits(readFileSync(fileURLToPath(import.meta.url), "utf8"))).length === 0
);

process.stdout.write(
  `historical-markdown-redact self-test: pass=${pass} fail=${fail} corpus=${corpus.length} changed=0\n`
);
process.exit(fail === 0 ? 0 : 1);
