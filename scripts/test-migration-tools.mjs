#!/usr/bin/env node
// 迁移清单工具最小回归:broken symlink 必须记录为 L。Windows 无 FIFO,该项 skip 并记入证据。
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, unlinkSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "target-change-manifest.mjs");
const DIR = mkdtempSync(join(tmpdir(), "saydo-migration-tools-"));
const REPO = join(DIR, "repo");

function git(args, cwd = REPO) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr}`);
  return r;
}

function nodeWrite(extraEnv = {}) {
  return spawnSync(process.execPath, [SCRIPT, "write", REPO, BASELINE, join(REPO, "target.tsv")], {
    encoding: "utf8",
    env: { ...process.env, ...extraEnv }
  });
}

mkdirSync(REPO);
git(["init", "-q"]);
git(["config", "user.email", "test@example.invalid"]);
git(["config", "user.name", "test"]);
writeFileSync(join(REPO, "tracked"), "baseline\n");
git(["add", "tracked"]);
git(["commit", "-q", "-m", "baseline"]);
const BASELINE = spawnSync("git", ["rev-parse", "HEAD"], { cwd: REPO, encoding: "utf8" }).stdout.trim();

try {
  unlinkSync(join(REPO, "tracked"));
  try {
    symlinkSync("missing-target", join(REPO, "tracked"));
    symlinkSync("another-missing-target", join(REPO, "new-broken"));
  } catch (err) {
    if (process.platform === "win32") {
      process.stdout.write("[ok] migration tools self-test: symlink skipped on this Windows (no privilege)\n");
      process.exit(0);
    }
    throw err;
  }

  const denied = nodeWrite();
  if (denied.status === 0) {
    process.stderr.write("[fail] migration tools self-test: wrong branch write was accepted\n");
    process.exit(1);
  }
  const allowed = nodeWrite({ SAYDO_MIGRATION_TEST_ROOT: REPO });
  if (allowed.status !== 0) {
    process.stderr.write(allowed.stderr);
    process.stderr.write("[fail] migration tools self-test: expected write to succeed\n");
    process.exit(1);
  }
  const check = spawnSync(process.execPath, [SCRIPT, "check", REPO, BASELINE, join(REPO, "target.tsv")], {
    encoding: "utf8"
  });
  if (check.status !== 0) {
    process.stderr.write(check.stderr);
    process.exit(1);
  }
  const tsv = readFileSync(join(REPO, "target.tsv"), "utf8");
  if (!tsv.split("\n").some((line) => line.startsWith("M\t") && line.includes("\tL\t") && line.endsWith("\ttracked"))) {
    process.stderr.write("[fail] migration tools self-test: missing M/L tracked row\n");
    process.exit(1);
  }
  if (!tsv.split("\n").some((line) => line.startsWith("A\t") && line.includes("\tL\t") && line.includes("new-broken"))) {
    process.stderr.write("[fail] migration tools self-test: missing A/L new-broken row\n");
    process.exit(1);
  }

  symlinkSync(join("..", "outside"), join(REPO, "outside-link"));
  const outside = nodeWrite({ SAYDO_MIGRATION_TEST_ROOT: REPO });
  if (outside.status === 0) {
    process.stderr.write("[fail] migration tools self-test: outside symlink was accepted\n");
    process.exit(1);
  }
  unlinkSync(join(REPO, "outside-link"));

  if (process.platform === "win32") {
    process.stdout.write("[ok] migration tools self-test: symlink metadata + boundaries (FIFO skipped on win32)\n");
    process.exit(0);
  }

  spawnSync("mkfifo", [join(REPO, "untracked-pipe")], { encoding: "utf8" });
  const fifo = nodeWrite({ SAYDO_MIGRATION_TEST_ROOT: REPO });
  if (fifo.status === 0) {
    process.stderr.write("[fail] migration tools self-test: untracked FIFO was omitted\n");
    process.exit(1);
  }
  process.stdout.write("[ok] migration tools self-test: symlink metadata + boundaries + FIFO fail-closed\n");
} finally {
  rmSync(DIR, { recursive: true, force: true });
}
