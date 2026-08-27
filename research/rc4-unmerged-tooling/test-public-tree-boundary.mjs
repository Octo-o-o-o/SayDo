#!/usr/bin/env node
// 公开树三视图(HEAD/index/working) kind/content/mode 一致性自测。
import { chmodSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  assertPublicTreeThreeViewConsistency,
  gitWorkingRegularMode
} from "./check-public-tree-privacy.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const SCANNER = join(here, "check-public-tree-privacy.mjs");
const DIR = mkdtempSync(join(tmpdir(), "saydo-public-tree-boundary-"));
let pass = 0;
let fail = 0;

function git(args, cwd) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr || r.stdout}`);
  return r;
}

function scan(repo, args = ["--fs", "--allow-missing-probes"]) {
  return spawnSync(process.execPath, [SCANNER, ...args], { cwd: repo, encoding: "utf8" });
}

function outputOf(r) {
  return `${r.stdout ?? ""}${r.stderr ?? ""}`;
}

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

function initRepo(root) {
  mkdirSync(root, { recursive: true });
  git(["init", "-q"], root);
  git(["config", "user.email", "test@example.invalid"], root);
  git(["config", "user.name", "test"], root);
  git(["config", "core.fileMode", "true"], root);
}

try {
  const repo = join(DIR, "mode");
  initRepo(repo);
  mkdirSync(join(repo, "keep"), { recursive: true });
  writeFileSync(join(repo, "keep/plain.txt"), "ok\n");
  writeFileSync(join(repo, "keep/exec.sh"), "#!/bin/sh\nexit 0\n");
  chmodSync(join(repo, "keep/plain.txt"), 0o644);
  chmodSync(join(repo, "keep/exec.sh"), 0o755);
  git(["add", "."], repo);
  git(["commit", "-q", "-m", "seed"], repo);

  assert(
    "legal 100644 working mode",
    gitWorkingRegularMode({ isSymbolicLink: () => false, isFile: () => true, mode: 0o100644 }) === "100644"
  );
  assert(
    "legal 100755 working mode",
    gitWorkingRegularMode({ isSymbolicLink: () => false, isFile: () => true, mode: 0o100755 }) === "100755"
  );
  assert("consistent modes pass", (() => {
    assertPublicTreeThreeViewConsistency(repo, { requireContent: true });
    return true;
  })());
  const cleanScan = scan(repo);
  assert("scanner accepts consistent modes", cleanScan.status === 0 && outputOf(cleanScan).includes("hits=0"));

  chmodSync(join(repo, "keep/plain.txt"), 0o755);
  expectThrow(
    "0644 to 0755 mode drift is rejected",
    () => assertPublicTreeThreeViewConsistency(repo, { requireContent: false }),
    /mode 不一致/
  );
  const up = scan(repo);
  assert("scanner rejects 0644 to 0755", up.status !== 0 && /mode 不一致/.test(outputOf(up)));
  chmodSync(join(repo, "keep/plain.txt"), 0o644);

  chmodSync(join(repo, "keep/exec.sh"), 0o644);
  expectThrow(
    "0755 to 0644 mode drift is rejected",
    () => assertPublicTreeThreeViewConsistency(repo, { requireContent: false }),
    /mode 不一致/
  );
  const down = scan(repo);
  assert("scanner rejects 0755 to 0644", down.status !== 0 && /mode 不一致/.test(outputOf(down)));
  chmodSync(join(repo, "keep/exec.sh"), 0o755);

  writeFileSync(join(repo, "keep/plain.txt"), "ok\n");
  chmodSync(join(repo, "keep/plain.txt"), 0o755);
  expectThrow(
    "content-unchanged mode drift is rejected",
    () => assertPublicTreeThreeViewConsistency(repo, { requireContent: true }),
    /mode 不一致/
  );
  chmodSync(join(repo, "keep/plain.txt"), 0o644);

  writeFileSync(join(repo, "keep/plain.txt"), "changed-working\n");
  expectThrow(
    "working content drift is rejected",
    () => assertPublicTreeThreeViewConsistency(repo, { requireContent: true }),
    /content 不一致/
  );
  const workingDrift = scan(repo);
  assert("scanner rejects working content drift", workingDrift.status !== 0 && /content 不一致/.test(outputOf(workingDrift)));
  writeFileSync(join(repo, "keep/plain.txt"), "ok\n");

  const indexBlob = spawnSync("git", ["hash-object", "-w", "--stdin"], {
    cwd: repo,
    encoding: "utf8",
    input: "index-only\n"
  });
  assert("index blob created", indexBlob.status === 0);
  spawnSync(
    "git",
    ["update-index", "--cacheinfo", "100644", indexBlob.stdout.trim(), "keep/plain.txt"],
    { cwd: repo, encoding: "utf8" }
  );
  expectThrow(
    "index vs HEAD content drift is rejected",
    () => assertPublicTreeThreeViewConsistency(repo, { requireContent: true }),
    /content 不一致/
  );
  git(["checkout", "-q", "--", "keep/plain.txt"], repo);
  git(["add", "keep/plain.txt"], repo);

  writeFileSync(join(repo, "keep/plain.txt"), "both\n");
  chmodSync(join(repo, "keep/plain.txt"), 0o755);
  expectThrow(
    "content and mode drift is rejected",
    () => assertPublicTreeThreeViewConsistency(repo, { requireContent: true }),
    /mode 不一致|content 不一致/
  );
  chmodSync(join(repo, "keep/plain.txt"), 0o644);
  writeFileSync(join(repo, "keep/plain.txt"), "ok\n");
  git(["add", "keep/plain.txt"], repo);

  const linkRepo = join(DIR, "link");
  initRepo(linkRepo);
  writeFileSync(join(linkRepo, "keep.txt"), "ok\n");
  git(["add", "."], linkRepo);
  git(["commit", "-q", "-m", "seed"], linkRepo);
  rmSync(join(linkRepo, "keep.txt"));
  symlinkSync("missing", join(linkRepo, "keep.txt"));
  expectThrow(
    "working symlink is rejected",
    () => assertPublicTreeThreeViewConsistency(linkRepo, { requireContent: false }),
    /符号链接/
  );
  const linkScan = scan(linkRepo);
  assert("scanner rejects working symlink", linkScan.status !== 0);

  const stageRepo = join(DIR, "stage");
  initRepo(stageRepo);
  writeFileSync(join(stageRepo, "keep.txt"), "ok\n");
  git(["add", "."], stageRepo);
  git(["commit", "-q", "-m", "seed"], stageRepo);
  const blob = git(["rev-parse", "HEAD:keep.txt"], stageRepo).stdout.trim();
  const info = spawnSync("git", ["update-index", "--index-info"], {
    cwd: stageRepo,
    encoding: "utf8",
    input: `100644 ${blob} 1\tkeep.txt\n100644 ${blob} 2\tkeep.txt\n100644 ${blob} 3\tkeep.txt\n`
  });
  assert("stage conflict index-info applied", info.status === 0);
  expectThrow(
    "index stage conflict is rejected",
    () => assertPublicTreeThreeViewConsistency(stageRepo, { requireContent: false }),
    /stage 冲突/
  );
  const stageScan = scan(stageRepo);
  assert("scanner rejects stage conflict", stageScan.status !== 0);

  const untrackedRepo = join(DIR, "untracked");
  initRepo(untrackedRepo);
  writeFileSync(join(untrackedRepo, "keep.txt"), "ok\n");
  git(["add", "."], untrackedRepo);
  git(["commit", "-q", "-m", "seed"], untrackedRepo);
  const secretName = "alice-home.txt";
  writeFileSync(join(untrackedRepo, secretName), "clean untracked\n");
  expectThrow(
    "clean untracked is rejected",
    () => assertPublicTreeThreeViewConsistency(untrackedRepo, { requireContent: true }),
    /^untracked:[0-9a-f]{32}$/
  );
  const untrackedScan = scan(untrackedRepo);
  const untrackedOut = outputOf(untrackedScan);
  assert("scanner rejects clean untracked", untrackedScan.status === 2 && /untracked:[0-9a-f]{32}/.test(untrackedOut));
  assert("untracked error hides filename", !untrackedOut.includes(secretName) && !untrackedOut.includes("alice"));

  const indexOnly = join(DIR, "index-only");
  initRepo(indexOnly);
  writeFileSync(join(indexOnly, "keep.txt"), "ok\n");
  git(["add", "."], indexOnly);
  git(["commit", "-q", "-m", "seed"], indexOnly);
  writeFileSync(join(indexOnly, "only-index.txt"), "index\n");
  git(["add", "only-index.txt"], indexOnly);
  expectThrow(
    "index-only path is rejected",
    () => assertPublicTreeThreeViewConsistency(indexOnly, { requireContent: true }),
    /HEAD 缺路径:[0-9a-f]{32}/
  );
  const indexOnlyScan = scan(indexOnly);
  assert("scanner rejects index-only", indexOnlyScan.status !== 0 && !outputOf(indexOnlyScan).includes("only-index.txt"));

  const workingOnly = join(DIR, "working-only");
  initRepo(workingOnly);
  writeFileSync(join(workingOnly, "keep.txt"), "ok\n");
  git(["add", "."], workingOnly);
  git(["commit", "-q", "-m", "seed"], workingOnly);
  writeFileSync(join(workingOnly, "only-working.txt"), "working\n");
  expectThrow(
    "working-only untracked is rejected",
    () => assertPublicTreeThreeViewConsistency(workingOnly, { requireContent: true }),
    /^untracked:[0-9a-f]{32}$/
  );
  const workingOnlyScan = scan(workingOnly);
  assert(
    "scanner rejects working-only",
    workingOnlyScan.status === 2 && !outputOf(workingOnlyScan).includes("only-working.txt")
  );

  const cleanCommitted = join(DIR, "clean-committed");
  initRepo(cleanCommitted);
  writeFileSync(join(cleanCommitted, "keep.txt"), "ok\n");
  git(["add", "."], cleanCommitted);
  git(["commit", "-q", "-m", "seed"], cleanCommitted);
  const cleanCommittedScan = scan(cleanCommitted);
  assert(
    "clean committed tree scan is green",
    cleanCommittedScan.status === 0 && outputOf(cleanCommittedScan).includes("hits=0")
  );

  process.stdout.write(`public-tree-boundary self-test: pass=${pass} fail=${fail}\n`);
  process.exit(fail === 0 ? 0 : 1);
} finally {
  rmSync(DIR, { recursive: true, force: true });
}
