#!/usr/bin/env node
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, symlinkSync, existsSync } from "node:fs";
import { readRepoRegularFile } from "./safe-regular-file.mjs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  enumerateJournalDigestTokens,
  extractJournalDigestClaims,
  fingerprint,
  occurrenceContextSha,
  proveSkippedLog,
  setJournalGitImpl,
  verifyJournalDigestClaims
} from "./journal-digest.mjs";

const dir = mkdtempSync(join(tmpdir(), "saydo-journal-digest-"));
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

function shaOf(text) {
  return createHash("sha256").update(text).digest("hex");
}

function oldContextNumber(text, index) {
  const ctx = text.slice(Math.max(0, index - 500), index);
  return (
    ctx.match(/prompt\s+(\d+)/i)?.[1] ??
    ctx.match(/对抗审\s+(\d+)/)?.[1] ??
    ctx.match(/Codex\s+(\d+)/)?.[1] ??
    ctx.match(/`(?:prompts|research\/codex-findings)\/(\d+)-/)?.[1] ??
    null
  );
}

function oldExtractWouldBind53To54(text) {
  const blockRe =
    /prompt(?:\s+(\d+))?\s*为\s*([\d,]+)\s*行\s*\/\s*([\d,]+)\s*bytes(?:\s*(?:[/／,，]\s*)?(?:SHA-256)?)?\s*`([0-9a-f]{64})`[\s\S]{0,160}?报告(?:为)?\s*([\d,]+)\s*行\s*\/\s*([\d,]+)\s*bytes(?:\s*(?:[/／,，]\s*)?(?:SHA-256)?)?\s*`([0-9a-f]{64})`/gi;
  const bound = [];
  let match;
  while ((match = blockRe.exec(text))) {
    bound.push(match[1] || oldContextNumber(text, match.index));
  }
  return bound;
}

try {
  mkdirSync(join(dir, "research/codex-findings"), { recursive: true });
  mkdirSync(join(dir, "prompts"), { recursive: true });
  mkdirSync(join(dir, "history/reviews"), { recursive: true });
  mkdirSync(join(dir, "logs"), { recursive: true });
  mkdirSync(join(dir, "scripts"), { recursive: true });
  writeFileSync(join(dir, "scripts/public-text-redaction.mjs"), readFileSync("scripts/public-text-redaction.mjs"));
  writeFileSync(join(dir, "scripts/journal-redaction-manifest.json"), readFileSync("scripts/journal-redaction-manifest.json"));
  writeFileSync(join(dir, ".gitignore"), "logs/\n");
  const gitInit = (cwd = dir) => {
    const run = (args, extra = {}) => {
      const r = spawnSync("git", args, { cwd, encoding: "utf8", ...extra });
      if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr || r.stdout}`);
      return r;
    };
    run(["init", "-q"]);
    run(["config", "user.email", "test@example.invalid"]);
    run(["config", "user.name", "test"]);
    return run;
  };
  const git = gitInit();
  const report = join(dir, "research/codex-findings/27-project-status-archive-review.md");
  const prompt = join(dir, "prompts/27-project-status-archive-review.md");
  const reportBody = "title\nsecond line\nthird\n";
  const promptBody = "prompt\nline\n";
  writeFileSync(report, reportBody);
  writeFileSync(prompt, promptBody);
  const reportFp = fingerprint(readFileSync(report));
  const promptFp = fingerprint(readFileSync(prompt));
  const staleReport = shaOf("old-report");
  const stalePrompt = shaOf("old-prompt");
  const staleLog = shaOf("old-log");

  const journal = [
    `# journal`,
    `\`prompts/27-project-status-archive-review.md\` 2 行/7 bytes/SHA-256`,
    `\`${stalePrompt}\`；报告`,
    `\`research/codex-findings/27-project-status-archive-review.md\` 1 行/3 bytes/SHA-256`,
    `\`${staleReport}\``,
    `日志 \`logs/27-project-status-archive-review.log\` 9 行/99 bytes/SHA-256 \`${staleLog}\``,
    `paren \`research/codex-findings/27-project-status-archive-review.md\`(3 / \`${staleReport}\`)`,
    `prompt 27 为 2 行/7 bytes/SHA-256 \`${stalePrompt}\`，报告 1 行/3 bytes/\`${staleReport}\``,
    ""
  ].join("\n");

  const { claims } = extractJournalDigestClaims(journal);
  assert("extracts adjacent prompt and report separately", claims.filter((row) => row.path?.endsWith("27-project-status-archive-review.md") || row.n === "27").length >= 2);
  writeFileSync(join(dir, "logs/27-project-status-archive-review.log"), "log\n");
  git(["add", "prompts", "research", "history", ".gitignore"]);
  git(["commit", "-q", "-m", "seed"]);
  const before = verifyJournalDigestClaims(journal, dir);
  assert("stale in-tree claims fail closed", before.failClosed === true);
  assert("log claim skipped", before.skipped >= 1 && before.skipReasons.some((row) => String(row.path).startsWith("logs/")));
  const realJournal = "history/PROCESS-JOURNAL.md";
  const beforeWrite = fingerprint(readFileSync(realJournal));
  const writeCli = spawnSync(process.execPath, ["scripts/check-journal-digests.mjs", "--write"], { encoding: "utf8" });
  assert("CLI --write exits 2", writeCli.status === 2);
  const afterWrite = fingerprint(readFileSync(realJournal));
  assert(
    "CLI --write leaves journal blob unchanged",
    afterWrite.sha256 === beforeWrite.sha256 && afterWrite.bytes === beforeWrite.bytes
  );
  assert("stale report sha remains in historical journal text", journal.includes(staleReport));

  const prompt53 = "p53\n".repeat(27);
  const report53 = "r53\n".repeat(81);
  const prompt54 = `${"p54\n".repeat(52)}end\n`;
  const report54 = `${"r54\n".repeat(167)}end\n`;
  writeFileSync(join(dir, "prompts/53-t18a-cli-slots-review.md"), prompt53);
  writeFileSync(join(dir, "research/codex-findings/53-t18a-cli-slots-review.md"), report53);
  writeFileSync(join(dir, "prompts/54-t18a-cli-slots-fix-review.md"), prompt54);
  writeFileSync(join(dir, "research/codex-findings/54-t18a-cli-slots-fix-review.md"), report54);
  const fp53p = fingerprint(Buffer.from(prompt53));
  const fp53r = fingerprint(Buffer.from(report53));
  const fp54p = fingerprint(Buffer.from(prompt54));
  const fp54r = fingerprint(Buffer.from(report54));

  const cross = [
    "Codex 54 首审 No-Go 历史快照保留。",
    `53 prompt 为 ${fp54p.lines} 行/${fp54p.bytes} bytes/SHA-256 \`${fp54p.sha256}\`，53 报告为 ${fp54r.lines} 行/${fp54r.bytes} bytes/\`${fp54r.sha256}\`；54 prompt 为 ${fp54p.lines} 行/${fp54p.bytes} bytes/\`${fp54p.sha256}\`，54 报告为 ${fp54r.lines} 行/${fp54r.bytes} bytes/\`${fp54r.sha256}\`；`
  ].join("\n");
  const oldBound = oldExtractWouldBind53To54(cross);
  assert("old lookback would bind 53-shaped block to 54", oldBound[0] === "54" && oldBound[1] === "54");
  const newCross = verifyJournalDigestClaims(cross, dir);
  assert(
    "new parser rejects 53/54 cross-bind using 54 stats",
    newCross.failClosed && newCross.occurrences.filter((row) => String(row.path).includes("53-")).every((row) => row.category === "unresolved")
  );

  const numberedBefore = [
    `53 prompt 为 ${fp53p.lines} 行/${fp53p.bytes} bytes/SHA-256 \`${fp53p.sha256}\`，53 报告为 ${fp53r.lines} 行/${fp53r.bytes} bytes/\`${fp53r.sha256}\`；54 prompt 为 ${fp54p.lines} 行/${fp54p.bytes} bytes/\`${fp54p.sha256}\`，54 报告为 ${fp54r.lines} 行/${fp54r.bytes} bytes/\`${fp54r.sha256}\`；`
  ].join("\n");
  const numbered = extractJournalDigestClaims(numberedBefore);
  const n53 = numbered.claims.filter((row) => row.n === "53");
  const n54 = numbered.claims.filter((row) => row.n === "54");
  assert("numbered-before-kind binds 53 and 54 separately", n53.length === 2 && n54.length === 2);
  assert("53 prompt hash stays on 53", n53.some((row) => row.kind === "prompt" && row.sha256 === fp53p.sha256));
  assert("54 report hash stays on 54", n54.some((row) => row.kind === "report" && row.sha256 === fp54r.sha256));
  const numberedOk = verifyJournalDigestClaims(numberedBefore, dir);
  assert("adjacent 53/54 with correct fields pass", numberedOk.failures.length === 0 && numberedOk.unresolved === 0);

  const sameFields = `53 prompt 为 ${fp53p.lines} 行/${fp53p.bytes} bytes/SHA-256 \`${fp53p.sha256}\`；54 prompt 为 ${fp53p.lines} 行/${fp53p.bytes} bytes/\`${fp53p.sha256}\`；`;
  const sameVerify = verifyJournalDigestClaims(sameFields, dir);
  assert("same fields copied onto 54 still fail 54 file", sameVerify.failClosed && sameVerify.occurrences.some((row) => String(row.path).includes("54-") && row.category === "unresolved"));

  const missingNumber = `prompt 为 ${fp53p.lines} 行/${fp53p.bytes} bytes/SHA-256 \`${fp53p.sha256}\``;
  const missing = verifyJournalDigestClaims(missingNumber, dir);
  assert(
    "number missing does not reverse-lookup current files",
    missing.failClosed && missing.occurrences.every((row) => row.category !== "checked-current")
  );
  const missingUnknown = `prompt 为 3 行/9 bytes/SHA-256 \`${shaOf("no-such-prompt")}\``;
  const missingU = verifyJournalDigestClaims(missingUnknown, dir);
  assert("number missing unknown hash is unresolved not lookback", missingU.unresolved >= 1 && missingU.failClosed);

  const ambiguous = `12 prompt 34 为 ${fp53p.lines} 行/${fp53p.bytes} bytes/SHA-256 \`${fp53p.sha256}\``;
  const amb = extractJournalDigestClaims(ambiguous);
  assert("conflicting numbers are unresolved", amb.unresolved.some((row) => row.reason === "ambiguous-number"));

  const duplicate = `${numberedBefore}\n${numberedBefore}`;
  const dup = verifyJournalDigestClaims(duplicate, dir);
  assert("duplicate identical claims stay drift-free", dup.failures.length === 0 && dup.unresolved === 0);

  const wrongHash = `53 prompt 为 ${fp53p.lines} 行/${fp53p.bytes} bytes/SHA-256 \`${fp54p.sha256}\``;
  const wrong = verifyJournalDigestClaims(wrongHash, dir);
  assert("wrong hash is fail-closed", wrong.failClosed);

  const wrongLines = `53 prompt 为 999 行/${fp53p.bytes} bytes/SHA-256 \`${fp53p.sha256}\``;
  const wrongL = verifyJournalDigestClaims(wrongLines, dir);
  assert(
    "wrong lines is drift",
    wrongL.failClosed && wrongL.occurrences.some((row) => row.reason === "mismatch" || row.category === "unresolved")
  );

  writeFileSync(join(dir, "history/reviews/27-note.md"), "note\n");
  const reviewFp = fingerprint(readFileSync(join(dir, "history/reviews/27-note.md")));
  const unquoted = `prompt:prompts/27-project-status-archive-review.md(${promptFp.lines} 行 / ${promptFp.bytes} bytes / ${promptFp.sha256})；评审:history/reviews/27-note.md(${reviewFp.lines} 行 / ${reviewFp.bytes} bytes / ${reviewFp.sha256})`;
  const unquotedExtract = extractJournalDigestClaims(unquoted);
  assert(
    "unquoted product path claims are not dropped",
    unquotedExtract.claims.some((row) => row.path === "prompts/27-project-status-archive-review.md") &&
      unquotedExtract.claims.some((row) => row.path === "history/reviews/27-note.md")
  );
  const citation = `current docs/09 = SHA-256 \`${fp53p.sha256}\` and release-config=${fp53r.sha256}`;
  const citationClass = verifyJournalDigestClaims(citation, dir);
  assert(
    "release-config citation is excluded-non-artifact",
    citationClass.occurrences.some((row) => row.sha256 === fp53r.sha256 && row.category === "excluded-non-artifact")
  );

  const logBare = `忽略日志 3 行/9 bytes/${staleLog}`;
  const logVerify = verifyJournalDigestClaims(logBare, dir);
  assert("bare log summary is not skipped", logVerify.skipped === 0 && logVerify.failClosed);

  const sameHash = `53 prompt 为 ${fp53p.lines} 行/${fp53p.bytes} bytes/SHA-256 \`${fp53p.sha256}\`，53 报告为 ${fp53p.lines} 行/${fp53p.bytes} bytes/\`${fp53p.sha256}\``;
  const sameOcc = extractJournalDigestClaims(sameHash);
  const promptOcc = sameOcc.claims.filter((row) => row.kind === "prompt");
  const reportOcc = sameOcc.claims.filter((row) => row.kind === "report");
  assert(
    "same hash prompt and report keep distinct offsets",
    promptOcc.length === 1 &&
      reportOcc.length === 1 &&
      promptOcc[0].index !== reportOcc[0].index &&
      promptOcc[0].sha256 === reportOcc[0].sha256
  );

  const traverse = `日志 \`logs/../prompts/53-t18a-cli-slots-review.md\` 1 行/1 bytes/SHA-256 \`${fp53p.sha256}\``;
  const traverseV = verifyJournalDigestClaims(traverse, dir);
  assert(
    "path traversal is not skipped as log",
    traverseV.skipped === 0 && traverseV.failClosed && proveSkippedLog(dir, "logs/../prompts/53-t18a-cli-slots-review.md").skip === false
  );

  mkdirSync(join(dir, "logs"), { recursive: true });
  writeFileSync(join(dir, "logs/tracked.log"), "tracked\n");
  git(["add", "-f", "logs/tracked.log"]);
  git(["commit", "-q", "-m", "tracked-log"]);
  const trackedLog = `日志 \`logs/tracked.log\` 1 行/8 bytes/SHA-256 \`${shaOf("tracked\n")}\``;
  const trackedV = verifyJournalDigestClaims(trackedLog, dir);
  assert("tracked log is not skipped", trackedV.skipped === 0 && trackedV.failClosed);

  writeFileSync(join(dir, "notes.log"), "keep\n");
  writeFileSync(join(dir, "logs/unignored.log"), "x\n");
  const unignored = `日志 \`notes.log\` 1 行/5 bytes/SHA-256 \`${shaOf("keep\n")}\``;
  const unignoredV = verifyJournalDigestClaims(unignored, dir);
  assert("log path outside logs root is not skipped", unignoredV.skipped === 0);

  const dupText = `${numberedBefore}\nraw ${fp53p.sha256} and again ${fp53p.sha256}`;
  const dupTokens = enumerateJournalDigestTokens(dupText);
  const dupClass = verifyJournalDigestClaims(dupText, dir);
  assert(
    "duplicate hash occurrences stay distinct tokens",
    dupTokens.filter((row) => row.sha256 === fp53p.sha256).length >= 3 &&
      dupClass.occurrences.filter((row) => row.sha256 === fp53p.sha256).length >= 3
  );

  const unknownCase = `digest ${fp53p.sha256.toUpperCase()}`;
  const unknownV = verifyJournalDigestClaims(unknownCase, dir);
  assert("uppercase 64hex is unknown-format fail-closed", unknownV.unknownFormat >= 1 && unknownV.failClosed);

  const histRepo = join(dir, "hist");
  mkdirSync(join(histRepo, "prompts"), { recursive: true });
  mkdirSync(join(histRepo, "scripts"), { recursive: true });
  const histGit = gitInit(histRepo);
  writeFileSync(join(histRepo, "prompts/12-old.md"), "old-body\n");
  histGit(["add", "."]);
  histGit(["commit", "-q", "-m", "old"]);
  const oldFp = fingerprint(readFileSync(join(histRepo, "prompts/12-old.md")));
  writeFileSync(join(histRepo, "prompts/12-old.md"), "new-body\n");
  const newFp = fingerprint(readFileSync(join(histRepo, "prompts/12-old.md")));
  const policy = fingerprint(readFileSync(join("scripts/public-text-redaction.mjs")));
  const manifestFp = fingerprint(readFileSync("scripts/journal-redaction-manifest.json"));
  function inventoryFor(text, category, extras = {}) {
    return enumerateJournalDigestTokens(text).map((token) => {
      const item = {
        offset: token.offset,
        line: token.line,
        sha256: token.sha256,
        category,
        path: extras.path ?? null,
        lines: extras.lines ?? null,
        bytes: extras.bytes ?? null,
        reason: extras.reason ?? null,
        contextSha256: occurrenceContextSha(text, token.offset)
      };
      if (category === "historical-erratum") {
        item.actualPath = extras.actualPath;
        item.actualLines = extras.actualLines;
        item.actualBytes = extras.actualBytes;
        item.actualSha256 = extras.actualSha256;
        item.commit = extras.commit;
        item.gitBlob = extras.gitBlob;
      }
      return item;
    });
  }
  function writeCatalog(targetRepo, extra) {
    writeFileSync(
      join(targetRepo, "scripts/journal-digest-catalog.json"),
      `${JSON.stringify(
        {
          schemaVersion: 2,
          policy: {
            id: "public-text-redaction",
            source: "scripts/public-text-redaction.mjs",
            sha256: policy.sha256,
            bytes: policy.bytes
          },
          redactionManifest: {
            path: "scripts/journal-redaction-manifest.json",
            sha256: manifestFp.sha256,
            bytes: manifestFp.bytes
          },
          redactionMap: [],
          inventory: [],
          ...extra
        },
        null,
        2
      )}\n`
    );
  }
  const mapEntry = {
    path: "prompts/12-old.md",
    originalSha256: oldFp.sha256,
    originalBytes: oldFp.bytes,
    originalLines: oldFp.lines,
    currentSha256: newFp.sha256,
    currentBytes: newFp.bytes,
    currentLines: newFp.lines,
    policyPath: "scripts/public-text-redaction.mjs",
    policySha256: policy.sha256,
    manifestPath: "scripts/journal-redaction-manifest.json",
    manifestSha256: manifestFp.sha256
  };
  writeFileSync(join(histRepo, "scripts/public-text-redaction.mjs"), readFileSync(join("scripts/public-text-redaction.mjs")));
  writeFileSync(join(histRepo, "scripts/journal-redaction-manifest.json"), readFileSync("scripts/journal-redaction-manifest.json"));
  const histJournal = `\`prompts/12-old.md\` ${oldFp.lines} 行/${oldFp.bytes} bytes/SHA-256 \`${oldFp.sha256}\``;
  writeCatalog(histRepo, {
    redactionMap: [mapEntry],
    inventory: inventoryFor(histJournal, "checked-redaction-map", {
      path: "prompts/12-old.md",
      lines: oldFp.lines,
      bytes: oldFp.bytes
    })
  });
  const histClass = verifyJournalDigestClaims(histJournal, histRepo);
  assert(
    "redaction-map binds original digest",
    histClass.failClosed === false && histClass.counts["checked-redaction-map"] === 1
  );
  const histOnly = verifyJournalDigestClaims(histJournal, histRepo);
  assert("historical blob still verifiable via map or history", histOnly.checked >= 1);

  const ghost = shaOf("never-committed-intermediate");
  const ghostJournal = `\`prompts/12-old.md\` 1 行/3 bytes/SHA-256 \`${ghost}\``;
  const ghostOffset = ghostJournal.indexOf(ghost);
  const ghostLine = 1;
  writeCatalog(histRepo, {
    inventory: inventoryFor(ghostJournal, "historical-unverifiable", {
      path: "prompts/12-old.md",
      bytes: 3,
      lines: 1,
      reason: "unreachable-intermediate"
    })
  });
  const ghostClass = verifyJournalDigestClaims(ghostJournal, histRepo);
  assert(
    "registered historical-unverifiable is not checked",
    ghostClass.counts["historical-unverifiable"] === 1 && ghostClass.checked === 0 && ghostClass.failClosed === false
  );
  const driftedGhost = `${ghostJournal}\nextra \`${shaOf("new-unregistered")}\``;
  const driftClass = verifyJournalDigestClaims(driftedGhost, histRepo);
  assert("unregistered new digest fail-closed", driftClass.failClosed && driftClass.unresolved >= 1);

  writeCatalog(histRepo, {
    redactionMap: [{ ...mapEntry, extra: true }],
    inventory: inventoryFor(histJournal, "checked-redaction-map", {
      path: "prompts/12-old.md",
      lines: oldFp.lines,
      bytes: oldFp.bytes
    })
  });
  const extraMap = verifyJournalDigestClaims(histJournal, histRepo);
  assert("redaction map extra field is not accepted", extraMap.counts["checked-redaction-map"] === 0 && extraMap.failClosed);

  const missingPolicy = JSON.parse(readFileSync(join(histRepo, "scripts/journal-digest-catalog.json"), "utf8"));
  delete missingPolicy.policy.sha256;
  writeFileSync(join(histRepo, "scripts/journal-digest-catalog.json"), `${JSON.stringify(missingPolicy, null, 2)}\n`);
  let missingPolicyThrew = false;
  try {
    verifyJournalDigestClaims(histJournal, histRepo);
  } catch (error) {
    missingPolicyThrew = /policy 身份缺失|policy 身份不匹配/.test(error instanceof Error ? error.message : String(error));
  }
  assert("missing policySha fails closed", missingPolicyThrew);

  writeCatalog(histRepo, {
    policy: { id: "public-text-redaction", source: "scripts/public-text-redaction.mjs", sha256: shaOf("wrong-policy") },
    redactionMap: [mapEntry],
    inventory: inventoryFor(histJournal, "checked-redaction-map", {
      path: "prompts/12-old.md",
      lines: oldFp.lines,
      bytes: oldFp.bytes
    })
  });
  let wrongPolicyThrew = false;
  try {
    verifyJournalDigestClaims(histJournal, histRepo);
  } catch (error) {
    wrongPolicyThrew = /policy 身份不匹配/.test(error instanceof Error ? error.message : String(error));
  }
  assert("wrong policySha fails closed", wrongPolicyThrew);

  writeCatalog(histRepo, {
    redactionManifest: { path: "scripts/journal-redaction-manifest.json", sha256: shaOf("wrong-manifest") },
    redactionMap: [mapEntry],
    inventory: inventoryFor(histJournal, "checked-redaction-map", {
      path: "prompts/12-old.md",
      lines: oldFp.lines,
      bytes: oldFp.bytes
    })
  });
  let wrongManifestThrew = false;
  try {
    verifyJournalDigestClaims(histJournal, histRepo);
  } catch (error) {
    wrongManifestThrew = /manifest 身份不匹配/.test(error instanceof Error ? error.message : String(error));
  }
  assert("wrong manifest identity fails closed", wrongManifestThrew);

  writeCatalog(histRepo, {
    redactionMap: [{ ...mapEntry, path: "prompts/other.md" }],
    inventory: inventoryFor(histJournal, "checked-redaction-map", {
      path: "prompts/12-old.md",
      lines: oldFp.lines,
      bytes: oldFp.bytes
    })
  });
  const driftedMap = verifyJournalDigestClaims(histJournal, histRepo);
  assert("redaction map path drift is not accepted", driftedMap.counts["checked-redaction-map"] === 0 && driftedMap.failClosed);

  writeCatalog(histRepo, {
    redactionMap: [mapEntry],
    inventory: inventoryFor(histJournal, "checked-redaction-map", {
      path: "prompts/12-old.md",
      lines: oldFp.lines,
      bytes: oldFp.bytes
    })
  });
  const goodMap = verifyJournalDigestClaims(histJournal, histRepo);
  assert("complete redaction-map positive still binds", goodMap.failClosed === false && goodMap.counts["checked-redaction-map"] === 1);

  symlinkSync("12-old.md", join(histRepo, "prompts/12-link.md"));
  let symlinkRejected = false;
  try {
    readRepoRegularFile(histRepo, "prompts/12-link.md");
  } catch (error) {
    symlinkRejected = /symlink/.test(error instanceof Error ? error.message : String(error));
  }
  assert("identical-target symlink is rejected", symlinkRejected);

  symlinkSync("missing-target", join(histRepo, "prompts/12-dangling.md"));
  let danglingRejected = false;
  try {
    readRepoRegularFile(histRepo, "prompts/12-dangling.md");
  } catch (error) {
    danglingRejected = /symlink/.test(error instanceof Error ? error.message : String(error));
  }
  assert("dangling symlink is rejected", danglingRejected);

  mkdirSync(join(histRepo, "prompts/12-dir"));
  let dirRejected = false;
  try {
    readRepoRegularFile(histRepo, "prompts/12-dir");
  } catch (error) {
    dirRejected = /directory/.test(error instanceof Error ? error.message : String(error));
  }
  assert("directory current file is rejected", dirRejected);

  const fifoPath = join(histRepo, "prompts/12-fifo");
  const fifo = spawnSync("mkfifo", [fifoPath], { encoding: "utf8" });
  if (fifo.status === 0 && existsSync(fifoPath)) {
    let fifoRejected = false;
    try {
      readRepoRegularFile(histRepo, "prompts/12-fifo");
    } catch (error) {
      fifoRejected = /non-regular|directory|open/.test(error instanceof Error ? error.message : String(error));
    }
    assert("fifo current file is rejected", fifoRejected);
  } else {
    assert("fifo current file is rejected", true);
  }

  const freezeRepo = join(dir, "freeze");
  mkdirSync(join(freezeRepo, "prompts"), { recursive: true });
  mkdirSync(join(freezeRepo, "scripts"), { recursive: true });
  const freezeGit = gitInit(freezeRepo);
  const freezeBody = "freeze-body\n";
  writeFileSync(join(freezeRepo, "prompts/01-freeze.md"), freezeBody);
  writeFileSync(join(freezeRepo, "scripts/public-text-redaction.mjs"), readFileSync(join("scripts/public-text-redaction.mjs")));
  writeFileSync(join(freezeRepo, "scripts/journal-redaction-manifest.json"), readFileSync("scripts/journal-redaction-manifest.json"));
  freezeGit(["add", "."]);
  freezeGit(["commit", "-q", "-m", "freeze"]);
  const freezeFp = fingerprint(Buffer.from(freezeBody));
  const freezeJournal = `\`prompts/01-freeze.md\` ${freezeFp.lines} 行/${freezeFp.bytes} bytes/SHA-256 \`${freezeFp.sha256}\``;
  writeCatalog(freezeRepo, {
    inventory: inventoryFor(freezeJournal, "checked-current", {
      path: "prompts/01-freeze.md",
      lines: freezeFp.lines,
      bytes: freezeFp.bytes
    })
  });
  const freezeOk = verifyJournalDigestClaims(freezeJournal, freezeRepo);
  assert("frozen current claim passes", freezeOk.failClosed === false && freezeOk.counts["checked-current"] === 1);

  const appended = `${freezeJournal}\nextra \`${shaOf("append-token")}\``;
  const appendClass = verifyJournalDigestClaims(appended, freezeRepo);
  assert("appending occurrence fail-closed", appendClass.failClosed && appendClass.unresolved >= 1);

  const deleted = "no digest here\n";
  const deleteClass = verifyJournalDigestClaims(deleted, freezeRepo);
  assert("deleted occurrence fail-closed", deleteClass.failClosed && deleteClass.failures.some((row) => row.reason === "catalog-stale" || row.reason === "inventory-count"));

  const moved = `lead ${freezeJournal}`;
  const moveClass = verifyJournalDigestClaims(moved, freezeRepo);
  assert("moved occurrence fail-closed", moveClass.failClosed);

  const validExtra = `${freezeJournal}\n\`prompts/01-freeze.md\` ${freezeFp.lines} 行/${freezeFp.bytes} bytes/SHA-256 \`${freezeFp.sha256}\``;
  const validExtraClass = verifyJournalDigestClaims(validExtra, freezeRepo);
  assert("new valid claim without inventory fail-closed", validExtraClass.failClosed);

  const releaseExtra = `${freezeJournal}\nrelease-config=${shaOf("release-config-new")}`;
  const releaseClass = verifyJournalDigestClaims(releaseExtra, freezeRepo);
  assert("new release-config without inventory fail-closed", releaseClass.failClosed);

  const plusOne = `\`prompts/01-freeze.md\` ${freezeFp.lines + 1} 行/${freezeFp.bytes} bytes/SHA-256 \`${freezeFp.sha256}\``;
  writeCatalog(freezeRepo, {
    inventory: inventoryFor(plusOne, "checked-current", {
      path: "prompts/01-freeze.md",
      lines: freezeFp.lines + 1,
      bytes: freezeFp.bytes
    })
  });
  const plusOneClass = verifyJournalDigestClaims(plusOne, freezeRepo);
  assert("plus-one line claim is not checked", plusOneClass.failClosed && plusOneClass.counts["checked-current"] === 0);

  const missingLine = `SHA-256 \`${freezeFp.sha256}\` path prompts/01-freeze.md`;
  writeCatalog(freezeRepo, {
    inventory: inventoryFor(missingLine, "historical-unverifiable", {
      path: "prompts/01-freeze.md",
      reason: "incomplete-stats"
    })
  });
  const missingLineClass = verifyJournalDigestClaims(missingLine, freezeRepo);
  assert(
    "missing line field is not complete checked",
    missingLineClass.counts["checked-current"] === 0 &&
      missingLineClass.counts["checked-historical"] === 0 &&
      (missingLineClass.counts["historical-unverifiable"] === 1 || missingLineClass.failClosed)
  );

  const unvJournal = `\`prompts/01-freeze.md\` 9 行/99 bytes/SHA-256 \`${shaOf("ghost-blob")}\``;
  writeCatalog(freezeRepo, {
    inventory: inventoryFor(unvJournal, "historical-unverifiable", {
      path: "prompts/01-freeze.md",
      lines: 9,
      bytes: 99,
      reason: "unreachable-intermediate"
    })
  });
  const unvOk = verifyJournalDigestClaims(unvJournal, freezeRepo);
  assert("honest unverifiable passes and is not checked", unvOk.failClosed === false && unvOk.counts["historical-unverifiable"] === 1 && unvOk.checked === 0);

  const unvDrift = `\`prompts/01-freeze.md\` 8 行/99 bytes/SHA-256 \`${shaOf("ghost-blob")}\``;
  const unvTokens = enumerateJournalDigestTokens(unvDrift);
  writeCatalog(freezeRepo, {
    inventory: [
      {
        offset: unvTokens[0].offset,
        line: unvTokens[0].line,
        sha256: unvTokens[0].sha256,
        category: "historical-unverifiable",
        path: "prompts/01-freeze.md",
        lines: 9,
        bytes: 99,
        reason: "unreachable-intermediate",
        contextSha256: occurrenceContextSha(unvDrift, unvTokens[0].offset)
      }
    ]
  });
  const unvWidth = verifyJournalDigestClaims(unvDrift, freezeRepo);
  assert("unverifiable same-width stats drift fail-closed", unvWidth.failClosed);

  const unvPath = `\`prompts/01-freeze.md\` 9 行/99 bytes/SHA-256 \`${shaOf("ghost-blob")}\``;
  writeCatalog(freezeRepo, {
    inventory: inventoryFor(unvPath, "historical-unverifiable", {
      path: "prompts/02-other.md",
      lines: 9,
      bytes: 99,
      reason: "unreachable-intermediate"
    })
  });
  const unvPathClass = verifyJournalDigestClaims(unvPath, freezeRepo);
  assert("unverifiable path drift fail-closed", unvPathClass.failClosed);

  const unvNull = `\`prompts/01-freeze.md\` 9 行/99 bytes/SHA-256 \`${shaOf("ghost-blob")}\``;
  writeCatalog(freezeRepo, {
    inventory: inventoryFor(unvNull, "historical-unverifiable", {
      path: null,
      lines: 9,
      bytes: 99,
      reason: "unreachable-intermediate"
    })
  });
  const unvNullClass = verifyJournalDigestClaims(unvNull, freezeRepo);
  assert("unverifiable nullable path drift fail-closed", unvNullClass.failClosed);

  const unvReason = `\`prompts/01-freeze.md\` 9 行/99 bytes/SHA-256 \`${shaOf("ghost-blob")}\``;
  let reasonDriftThrew = false;
  try {
    writeCatalog(freezeRepo, {
      inventory: inventoryFor(unvReason, "historical-unverifiable", {
        path: "prompts/01-freeze.md",
        lines: 9,
        bytes: 99,
        reason: "not-a-frozen-reason"
      })
    });
    verifyJournalDigestClaims(unvReason, freezeRepo);
  } catch (error) {
    reasonDriftThrew = /unverifiable reason 非法/.test(error instanceof Error ? error.message : String(error));
  }
  assert("unverifiable reason drift fail-closed", reasonDriftThrew);

  const ctxJournal = `keep \`prompts/01-freeze.md\` 9 行/99 bytes/SHA-256 \`${shaOf("ghost-blob")}\` tail`;
  const ctxInv = inventoryFor(ctxJournal, "historical-unverifiable", {
    path: "prompts/01-freeze.md",
    lines: 9,
    bytes: 99,
    reason: "unreachable-intermediate"
  });
  ctxInv[0].contextSha256 = shaOf("reordered-context");
  writeCatalog(freezeRepo, { inventory: ctxInv });
  const ctxClass = verifyJournalDigestClaims(ctxJournal, freezeRepo);
  assert("unverifiable context reorder fail-closed", ctxClass.failClosed);

  const shiftJournal = `xx\`prompts/01-freeze.md\` 9 行/99 bytes/SHA-256 \`${shaOf("ghost-blob")}\``;
  const baseShift = inventoryFor(
    `\`prompts/01-freeze.md\` 9 行/99 bytes/SHA-256 \`${shaOf("ghost-blob")}\``,
    "historical-unverifiable",
    { path: "prompts/01-freeze.md", lines: 9, bytes: 99, reason: "unreachable-intermediate" }
  );
  writeCatalog(freezeRepo, { inventory: baseShift });
  const shiftClass = verifyJournalDigestClaims(shiftJournal, freezeRepo);
  assert("unverifiable token shift fail-closed", shiftClass.failClosed);

  const erratumJournal = `\`prompts/01-freeze.md\` ${freezeFp.lines + 1} 行/${freezeFp.bytes} bytes/SHA-256 \`${freezeFp.sha256}\``;
  const freezeCommit = spawnSync("git", ["rev-parse", "HEAD"], { cwd: freezeRepo, encoding: "utf8" }).stdout.trim();
  const freezeBlob = spawnSync("git", ["rev-parse", "HEAD:prompts/01-freeze.md"], { cwd: freezeRepo, encoding: "utf8" }).stdout.trim();
  writeCatalog(freezeRepo, {
    inventory: inventoryFor(erratumJournal, "historical-erratum", {
      path: "prompts/01-freeze.md",
      lines: freezeFp.lines + 1,
      bytes: freezeFp.bytes,
      reason: "erratum-line-count",
      actualPath: "prompts/01-freeze.md",
      actualLines: freezeFp.lines,
      actualBytes: freezeFp.bytes,
      actualSha256: freezeFp.sha256,
      commit: freezeCommit,
      gitBlob: freezeBlob
    })
  });
  const erratumClass = verifyJournalDigestClaims(erratumJournal, freezeRepo);
  assert(
    "explicit erratum is not checked",
    erratumClass.failClosed === false &&
      erratumClass.counts["historical-erratum"] === 1 &&
      erratumClass.checked === 0 &&
      erratumClass.drift === 0
  );

  writeCatalog(freezeRepo, {
    inventory: inventoryFor(erratumJournal, "historical-erratum", {
      path: "prompts/01-freeze.md",
      lines: freezeFp.lines + 1,
      bytes: freezeFp.bytes,
      reason: "erratum-line-count",
      actualPath: "prompts/01-freeze.md",
      actualLines: freezeFp.lines + 9,
      actualBytes: freezeFp.bytes,
      actualSha256: freezeFp.sha256,
      commit: freezeCommit,
      gitBlob: freezeBlob
    })
  });
  const wrongActual = verifyJournalDigestClaims(erratumJournal, freezeRepo);
  assert("wrong erratum actual stats fail-closed", wrongActual.failClosed);

  writeCatalog(freezeRepo, {
    inventory: inventoryFor(erratumJournal, "historical-erratum", {
      path: "prompts/01-freeze.md",
      lines: freezeFp.lines + 1,
      bytes: freezeFp.bytes,
      reason: "erratum-line-count",
      actualPath: "prompts/missing.md",
      actualLines: freezeFp.lines,
      actualBytes: freezeFp.bytes,
      actualSha256: freezeFp.sha256,
      commit: freezeCommit,
      gitBlob: freezeBlob
    })
  });
  const missingBlob = verifyJournalDigestClaims(erratumJournal, freezeRepo);
  assert("nonexistent erratum blob fail-closed", missingBlob.failClosed);

  writeCatalog(freezeRepo, {
    inventory: inventoryFor(freezeJournal, "historical-unverifiable", {
      path: "prompts/01-freeze.md",
      lines: freezeFp.lines,
      bytes: freezeFp.bytes,
      reason: "unreachable-intermediate"
    })
  });
  const reachableAsUnreachable = verifyJournalDigestClaims(freezeJournal, freezeRepo);
  assert("reachable claim cannot be cataloged unreachable", reachableAsUnreachable.failClosed);

  const shaOnlyJournal = `\`prompts/12-old.md\` SHA-256 \`${oldFp.sha256}\``;
  writeCatalog(histRepo, {
    redactionMap: [mapEntry],
    inventory: inventoryFor(shaOnlyJournal, "checked-redaction-map", {
      path: "prompts/12-old.md",
      lines: oldFp.lines,
      bytes: oldFp.bytes
    })
  });
  const shaOnly = verifyJournalDigestClaims(shaOnlyJournal, histRepo);
  assert("sha-only original claim is not checked via map", shaOnly.failClosed && shaOnly.counts["checked-redaction-map"] === 0);

  const currentJournal = `\`prompts/12-old.md\` ${newFp.lines} 行/${newFp.bytes} bytes/SHA-256 \`${newFp.sha256}\``;
  writeCatalog(histRepo, {
    redactionMap: [mapEntry],
    inventory: inventoryFor(currentJournal, "checked-current", {
      path: "prompts/12-old.md",
      lines: newFp.lines,
      bytes: newFp.bytes
    })
  });
  const unconsumedMap = verifyJournalDigestClaims(currentJournal, histRepo);
  assert("unconsumed redaction map entry fail-closed", unconsumedMap.failClosed);

  const noPathJournal = `SHA-256 \`${shaOf("bare-unpathed")}\``;
  writeCatalog(freezeRepo, {
    inventory: inventoryFor(noPathJournal, "historical-unverifiable", {
      path: null,
      reason: "unreachable-intermediate"
    })
  });
  const noPathAsUnreachable = verifyJournalDigestClaims(noPathJournal, freezeRepo);
  assert("missing-path cannot be cataloged unreachable", noPathAsUnreachable.failClosed);

  const swapAbs = join(histRepo, "prompts/12-old.md");
  const originalSwap = readFileSync(swapAbs);
  let swapError = null;
  let swapReturned;
  try {
    swapReturned = readRepoRegularFile(histRepo, "prompts/12-old.md", {
      afterOpen(abs) {
        rmSync(abs);
        writeFileSync(abs, "SUBSTITUTE-BYTES-NOT-ACCEPTABLE\n");
      }
    });
  } catch (error) {
    swapError = error;
  }
  assert(
    "open-after-replace is rejected",
    /current-file-replaced/.test(swapError instanceof Error ? swapError.message : "")
  );
  assert(
    "open-after-replace does not return substitute bytes",
    swapReturned == null && !String(swapReturned ?? "").includes("SUBSTITUTE")
  );
  writeFileSync(swapAbs, originalSwap);

  writeFileSync(join(freezeRepo, "prompts/02-other.md"), freezeBody);
  freezeGit(["add", "prompts/02-other.md"]);
  freezeGit(["commit", "-q", "-m", "same-blob-other-path"]);
  writeCatalog(freezeRepo, {
    inventory: inventoryFor(erratumJournal, "historical-erratum", {
      path: "prompts/01-freeze.md",
      lines: freezeFp.lines + 1,
      bytes: freezeFp.bytes,
      reason: "erratum-line-count",
      actualPath: "prompts/02-other.md",
      actualLines: freezeFp.lines,
      actualBytes: freezeFp.bytes,
      actualSha256: freezeFp.sha256,
      commit: freezeCommit,
      gitBlob: freezeBlob
    })
  });
  const sameBlobDiffPath = verifyJournalDigestClaims(erratumJournal, freezeRepo);
  assert("same-blob different-path erratum fail-closed", sameBlobDiffPath.failClosed);

  const skipJournal = `日志 \`logs/27-project-status-archive-review.log\` 9 行/99 bytes/SHA-256 \`${staleLog}\``;
  writeCatalog(dir, {
    inventory: inventoryFor(skipJournal, "historical-unverifiable", {
      path: "logs/27-project-status-archive-review.log",
      lines: 9,
      bytes: 99,
      reason: "unreachable-intermediate"
    })
  });
  const skipAsUnv = verifyJournalDigestClaims(skipJournal, dir);
  assert("skipped-log cannot be cataloged unverifiable", skipAsUnv.failClosed);

  const excludedJournal = `release-config=${fp53r.sha256}`;
  writeCatalog(dir, {
    inventory: inventoryFor(excludedJournal, "historical-unverifiable", {
      path: null,
      reason: "bare-log-or-unpathed-digest"
    })
  });
  const excludedAsUnv = verifyJournalDigestClaims(excludedJournal, dir);
  assert("excluded-non-artifact cannot be cataloged unverifiable", excludedAsUnv.failClosed);

  function delegateGit(args, cwd, encoding = "buffer") {
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

  const ghost2 = shaOf("git-error-unreach");
  const ghost2Journal = `\`prompts/01-freeze.md\` 1 行/3 bytes/SHA-256 \`${ghost2}\``;
  writeCatalog(freezeRepo, {
    inventory: inventoryFor(ghost2Journal, "historical-unverifiable", {
      path: "prompts/01-freeze.md",
      lines: 1,
      bytes: 3,
      reason: "unreachable-intermediate"
    })
  });
  setJournalGitImpl((args, cwd, encoding) => {
    if (args[0] === "log") {
      return { ok: false, status: 128, stdout: encoding === "utf8" ? "" : Buffer.alloc(0), stderr: "fatal: git exploded", signal: null };
    }
    return delegateGit(args, cwd, encoding);
  });
  const gitLogFail = verifyJournalDigestClaims(ghost2Journal, freezeRepo);
  setJournalGitImpl(null);
  assert("git log exit 128 is not unreachable", gitLogFail.failClosed && gitLogFail.failures.some((row) => row.reason === "git-error"));

  setJournalGitImpl((args, cwd, encoding) => {
    if (args[0] === "ls-files" && args.includes("--error-unmatch")) {
      return { ok: false, status: 128, stdout: encoding === "utf8" ? "" : Buffer.alloc(0), stderr: "fatal: ls-files exploded", signal: null };
    }
    if (args[0] === "check-ignore") {
      return { ok: true, status: 0, stdout: encoding === "utf8" ? "" : Buffer.alloc(0), stderr: "", signal: null };
    }
    return delegateGit(args, cwd, encoding);
  });
  writeCatalog(dir, {
    inventory: inventoryFor(skipJournal, "skipped-log", {
      path: "logs/27-project-status-archive-review.log",
      lines: 9,
      bytes: 99,
      reason: "logs-not-tracked"
    })
  });
  const fakeSkip = verifyJournalDigestClaims(skipJournal, dir);
  setJournalGitImpl(null);
  assert("ls-files 128 is not skipped-log", fakeSkip.failClosed && fakeSkip.skipped === 0);

  setJournalGitImpl((args, cwd, encoding) => {
    if (args[0] === "log") {
      return { ok: false, status: 128, stdout: encoding === "utf8" ? "" : Buffer.alloc(0), stderr: "fatal: bad file", signal: null };
    }
    return delegateGit(args, cwd, encoding);
  });
  const badFileLog = verifyJournalDigestClaims(ghost2Journal, freezeRepo);
  setJournalGitImpl(null);
  assert(
    "git log 128 fatal bad file is git-error",
    badFileLog.failClosed && badFileLog.failures.some((row) => row.reason === "git-error")
  );

  setJournalGitImpl((args, cwd, encoding) => {
    if (args[0] === "ls-files" && args.includes("--error-unmatch")) {
      return { ok: false, status: 128, stdout: encoding === "utf8" ? "" : Buffer.alloc(0), stderr: "fatal: bad file", signal: null };
    }
    if (args[0] === "check-ignore") {
      return { ok: true, status: 0, stdout: encoding === "utf8" ? "" : Buffer.alloc(0), stderr: "", signal: null };
    }
    return delegateGit(args, cwd, encoding);
  });
  writeCatalog(dir, {
    inventory: inventoryFor(skipJournal, "skipped-log", {
      path: "logs/27-project-status-archive-review.log",
      lines: 9,
      bytes: 99,
      reason: "logs-not-tracked"
    })
  });
  const badFileLs = verifyJournalDigestClaims(skipJournal, dir);
  setJournalGitImpl(null);
  assert("ls-files 128 fatal bad file is not skipped", badFileLs.failClosed && badFileLs.skipped === 0);

  setJournalGitImpl((args, cwd, encoding) => {
    if (args[0] === "ls-tree") {
      return { ok: false, status: 128, stdout: encoding === "utf8" ? "" : Buffer.alloc(0), stderr: "fatal: bad file", signal: null };
    }
    return delegateGit(args, cwd, encoding);
  });
  writeCatalog(freezeRepo, {
    inventory: inventoryFor(erratumJournal, "historical-erratum", {
      path: "prompts/01-freeze.md",
      lines: freezeFp.lines + 1,
      bytes: freezeFp.bytes,
      reason: "erratum-line-count",
      actualPath: "prompts/01-freeze.md",
      actualLines: freezeFp.lines,
      actualBytes: freezeFp.bytes,
      actualSha256: freezeFp.sha256,
      commit: freezeCommit,
      gitBlob: freezeBlob
    })
  });
  const badFileTree = verifyJournalDigestClaims(erratumJournal, freezeRepo);
  setJournalGitImpl(null);
  assert("ls-tree 128 fatal bad file is git-error", badFileTree.failClosed && badFileTree.failures.some((row) => row.reason === "git-error"));

  setJournalGitImpl((args, cwd, encoding) => {
    if (args[0] === "cat-file") {
      return { ok: false, status: 128, stdout: encoding === "utf8" ? "" : Buffer.alloc(0), stderr: "fatal: bad file", signal: null };
    }
    return delegateGit(args, cwd, encoding);
  });
  const badFileCat = verifyJournalDigestClaims(erratumJournal, freezeRepo);
  setJournalGitImpl(null);
  assert("cat-file 128 fatal bad file is git-error", badFileCat.failClosed && badFileCat.failures.some((row) => row.reason === "git-error"));

  setJournalGitImpl((args, cwd, encoding) => {
    if (args[0] === "rev-list") {
      return { ok: false, status: 128, stdout: encoding === "utf8" ? "" : Buffer.alloc(0), stderr: "fatal: bad file", signal: null };
    }
    return delegateGit(args, cwd, encoding);
  });
  const badFileRev = verifyJournalDigestClaims(erratumJournal, freezeRepo);
  setJournalGitImpl(null);
  assert("rev-list 128 fatal bad file is git-error", badFileRev.failClosed && badFileRev.failures.some((row) => row.reason === "git-error"));

  writeFileSync(join(freezeRepo, "prompts/01-freeze.md"), "second-body\n");
  freezeGit(["add", "prompts/01-freeze.md"]);
  freezeGit(["commit", "-q", "-m", "second"]);
  writeCatalog(freezeRepo, {
    inventory: inventoryFor(erratumJournal, "historical-erratum", {
      path: "prompts/01-freeze.md",
      lines: freezeFp.lines + 1,
      bytes: freezeFp.bytes,
      reason: "erratum-line-count",
      actualPath: "prompts/01-freeze.md",
      actualLines: freezeFp.lines,
      actualBytes: freezeFp.bytes,
      actualSha256: freezeFp.sha256,
      commit: freezeCommit,
      gitBlob: freezeBlob
    })
  });
  const freezeUrl = pathToFileURL(freezeRepo).href;
  const fullClone = join(dir, "full-clone");
  const cloned = spawnSync("git", ["clone", "-q", "--no-local", freezeUrl, fullClone], { encoding: "utf8" });
  assert("full clone created", cloned.status === 0);
  const fullCount = spawnSync("git", ["rev-list", "--count", "HEAD"], { cwd: fullClone, encoding: "utf8" });
  assert("full clone keeps freeze history", fullCount.status === 0 && Number(fullCount.stdout.trim()) >= 2);
  const fullCommitReachable = spawnSync("git", ["cat-file", "-e", freezeCommit], { cwd: fullClone, encoding: "utf8" });
  const fullBlobReachable = spawnSync("git", ["cat-file", "-e", freezeBlob], { cwd: fullClone, encoding: "utf8" });
  assert("full clone can reach erratum commit", fullCommitReachable.status === 0);
  assert("full clone can reach erratum blob", fullBlobReachable.status === 0);
  writeFileSync(join(fullClone, "scripts/public-text-redaction.mjs"), readFileSync(join("scripts/public-text-redaction.mjs")));
  writeFileSync(join(fullClone, "scripts/journal-redaction-manifest.json"), readFileSync("scripts/journal-redaction-manifest.json"));
  writeCatalog(fullClone, {
    inventory: inventoryFor(erratumJournal, "historical-erratum", {
      path: "prompts/01-freeze.md",
      lines: freezeFp.lines + 1,
      bytes: freezeFp.bytes,
      reason: "erratum-line-count",
      actualPath: "prompts/01-freeze.md",
      actualLines: freezeFp.lines,
      actualBytes: freezeFp.bytes,
      actualSha256: freezeFp.sha256,
      commit: freezeCommit,
      gitBlob: freezeBlob
    })
  });
  const fullClass = verifyJournalDigestClaims(erratumJournal, fullClone);
  assert("full clone erratum is accepted", fullClass.failClosed === false && fullClass.counts["historical-erratum"] === 1);

  const shallowClone = join(dir, "shallow-clone");
  const shallow = spawnSync("git", ["clone", "-q", "--depth", "1", "--no-local", freezeUrl, shallowClone], {
    encoding: "utf8"
  });
  assert("shallow clone created", shallow.status === 0);
  const shallowCount = spawnSync("git", ["rev-list", "--count", "HEAD"], { cwd: shallowClone, encoding: "utf8" });
  assert("shallow clone rev-list count is 1", shallowCount.status === 0 && shallowCount.stdout.trim() === "1");
  const shallowCommitReachable = spawnSync("git", ["cat-file", "-e", freezeCommit], {
    cwd: shallowClone,
    encoding: "utf8"
  });
  const shallowRevList = spawnSync("git", ["rev-list", "--all"], { cwd: shallowClone, encoding: "utf8" });
  const shallowAll = String(shallowRevList.stdout ?? "")
    .split("\n")
    .map((row) => row.trim().toLowerCase())
    .filter(Boolean);
  assert("shallow clone cannot reach erratum commit", shallowCommitReachable.status !== 0);
  assert("shallow clone rev-list excludes erratum commit", !shallowAll.includes(freezeCommit.toLowerCase()));
  writeFileSync(join(shallowClone, "scripts/public-text-redaction.mjs"), readFileSync(join("scripts/public-text-redaction.mjs")));
  writeFileSync(join(shallowClone, "scripts/journal-redaction-manifest.json"), readFileSync("scripts/journal-redaction-manifest.json"));
  writeCatalog(shallowClone, {
    inventory: inventoryFor(erratumJournal, "historical-erratum", {
      path: "prompts/01-freeze.md",
      lines: freezeFp.lines + 1,
      bytes: freezeFp.bytes,
      reason: "erratum-line-count",
      actualPath: "prompts/01-freeze.md",
      actualLines: freezeFp.lines,
      actualBytes: freezeFp.bytes,
      actualSha256: freezeFp.sha256,
      commit: freezeCommit,
      gitBlob: freezeBlob
    })
  });
  assert("shallow clone has policy source", existsSync(join(shallowClone, "scripts/public-text-redaction.mjs")));
  assert("shallow clone has redaction manifest", existsSync(join(shallowClone, "scripts/journal-redaction-manifest.json")));
  assert("shallow clone has digest catalog", existsSync(join(shallowClone, "scripts/journal-digest-catalog.json")));
  const shallowClass = verifyJournalDigestClaims(erratumJournal, shallowClone);
  assert(
    "shallow clone erratum fail-closed because commit is unreachable",
    shallowClass.failClosed &&
      shallowClass.failures.some((row) => row.reason === "erratum-unreachable") &&
      !shallowClass.failures.some((row) => row.reason === "git-error") &&
      !/policy|manifest 身份/.test(JSON.stringify(shallowClass.failures))
  );
} finally {
  setJournalGitImpl(null);
  rmSync(dir, { recursive: true, force: true });
}

process.stdout.write(`journal-digest self-test: pass=${pass} fail=${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
