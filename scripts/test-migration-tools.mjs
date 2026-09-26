#!/usr/bin/env node
// 迁移清单工具最小回归:broken symlink 必须记录为 L。Windows 无 FIFO,该项 skip 并记入证据。
// 所有退出路径(含 Git 准备与 Windows 提前返回)先清本脚本 mkdtemp 目录,再返回原本判定退出码。
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, unlinkSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "target-change-manifest.mjs");
const ownedDirs = [];

function createOwnedTemp(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  ownedDirs.push(dir);
  return dir;
}

function cleanupOwnedTemps() {
  while (ownedDirs.length > 0) {
    const dir = ownedDirs.pop();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // 只清本脚本 mkdtemp 拥有的目录
    }
  }
}

function selftestWin32() {
  return process.env.SAYDO_SELFTEST_INJECT_WIN32 === "1" || process.platform === "win32";
}

const DIR = createOwnedTemp("saydo-migration-tools-");
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

let BASELINE = "";

function finish(code) {
  cleanupOwnedTemps();
  process.exit(code);
}

function main() {
  try {
    if (process.env.SAYDO_SELFTEST_FORCE_GIT_FAIL === "1") {
      throw new Error("forced git prep fail");
    }
    mkdirSync(REPO);
    git(["init", "-q"]);
    git(["config", "user.email", "test@example.invalid"]);
    git(["config", "user.name", "test"]);
    writeFileSync(join(REPO, "tracked"), "baseline\n");
    git(["add", "tracked"]);
    git(["commit", "-q", "-m", "baseline"]);
    BASELINE = spawnSync("git", ["rev-parse", "HEAD"], { cwd: REPO, encoding: "utf8" }).stdout.trim();

    unlinkSync(join(REPO, "tracked"));
    try {
      if (process.env.SAYDO_SELFTEST_INJECT_SYMLINK_DENY === "1") {
        const err = new Error("EPERM: symlink privilege denied (injected, not a real-machine claim)");
        err.code = "EPERM";
        throw err;
      }
      symlinkSync("missing-target", join(REPO, "tracked"));
      symlinkSync("another-missing-target", join(REPO, "new-broken"));
    } catch (err) {
      if (selftestWin32()) {
        process.stdout.write("[skip] migration tools self-test: symlink skipped (no privilege; injected or host win32, not a real-machine claim)\n");
        finish(0);
      }
      throw err;
    }

    const denied = nodeWrite();
    if (denied.status === 0) {
      process.stderr.write("[fail] migration tools self-test: wrong branch write was accepted\n");
      finish(1);
    }
    const allowed = nodeWrite({ SAYDO_MIGRATION_TEST_ROOT: REPO });
    if (allowed.status !== 0) {
      process.stderr.write(allowed.stderr);
      process.stderr.write("[fail] migration tools self-test: expected write to succeed\n");
      finish(1);
    }
    const check = spawnSync(process.execPath, [SCRIPT, "check", REPO, BASELINE, join(REPO, "target.tsv")], {
      encoding: "utf8"
    });
    if (check.status !== 0) {
      process.stderr.write(check.stderr);
      finish(1);
    }
    const tsv = readFileSync(join(REPO, "target.tsv"), "utf8");
    if (!tsv.split("\n").some((line) => line.startsWith("M\t") && line.includes("\tL\t") && line.endsWith("\ttracked"))) {
      process.stderr.write("[fail] migration tools self-test: missing M/L tracked row\n");
      finish(1);
    }
    if (!tsv.split("\n").some((line) => line.startsWith("A\t") && line.includes("\tL\t") && line.includes("new-broken"))) {
      process.stderr.write("[fail] migration tools self-test: missing A/L new-broken row\n");
      finish(1);
    }

    symlinkSync(join("..", "outside"), join(REPO, "outside-link"));
    const outside = nodeWrite({ SAYDO_MIGRATION_TEST_ROOT: REPO });
    if (outside.status === 0) {
      process.stderr.write("[fail] migration tools self-test: outside symlink was accepted\n");
      finish(1);
    }
    unlinkSync(join(REPO, "outside-link"));

    if (selftestWin32()) {
      process.stdout.write("[ok] migration tools self-test: symlink metadata + boundaries\n");
      process.stdout.write("[skip] FIFO: not exercised on win32 (injected or host, not a real-machine claim)\n");
      if (process.env.SAYDO_SELFTEST_FORCE_FAIL === "1") {
        process.stderr.write("[fail] self-test forced fail for cleanup regression\n");
        finish(1);
      }
      finish(0);
    }

    spawnSync("mkfifo", [join(REPO, "untracked-pipe")], { encoding: "utf8" });
    const fifo = nodeWrite({ SAYDO_MIGRATION_TEST_ROOT: REPO });
    if (fifo.status === 0) {
      process.stderr.write("[fail] migration tools self-test: untracked FIFO was omitted\n");
      finish(1);
    }
    if (process.env.SAYDO_SELFTEST_FORCE_FAIL === "1") {
      process.stderr.write("[fail] self-test forced fail for cleanup regression\n");
      finish(1);
    }
    process.stdout.write("[ok] migration tools self-test: symlink metadata + boundaries + FIFO fail-closed\n");
    finish(0);
  } catch (err) {
    process.stderr.write(`[fail] migration tools self-test crashed: ${err instanceof Error ? err.message : String(err)}\n`);
    finish(1);
  }
}

main();
