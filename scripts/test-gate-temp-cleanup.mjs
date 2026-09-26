#!/usr/bin/env node
// 门禁自测生命周期回归:实际子进程成功/强制失败退出码正确,且私有 TMPDIR 无本脚本残留。
// Windows 特有分支只注入,不称真机。未执行的 skip 不得记为 [ok]。
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OWNED_PREFIXES = [
  "saydo-color-gate-",
  "saydo-emoji-gate-",
  "saydo-migration-tools-",
  "saydo-privacy-gate-"
];

function leftovers(dir) {
  return readdirSync(dir).filter((name) => OWNED_PREFIXES.some((prefix) => name.startsWith(prefix)));
}

function run(script, extraEnv = {}) {
  const privateTmp = mkdtempSync(join(tmpdir(), "saydo-gate-cleanup-harness-"));
  try {
    const result = spawnSync(process.execPath, [join(ROOT, "scripts", script)], {
      encoding: "utf8",
      cwd: ROOT,
      env: {
        ...process.env,
        TMPDIR: privateTmp,
        TMP: privateTmp,
        TEMP: privateTmp,
        ...extraEnv
      }
    });
    return {
      status: result.status,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      left: leftovers(privateTmp)
    };
  } finally {
    rmSync(privateTmp, { recursive: true, force: true });
  }
}

let pass = 0;
let fail = 0;

function check(cond, label, detail = "") {
  if (cond) {
    process.stdout.write(`[ok] ${label}\n`);
    pass += 1;
  } else {
    process.stdout.write(`[fail] ${label}${detail ? `: ${detail}` : ""}\n`);
    fail += 1;
  }
}

const scripts = [
  "test-color-gate.mjs",
  "test-emoji-gate.mjs",
  "test-migration-tools.mjs",
  "test-public-tree-privacy.mjs"
];
for (const script of scripts) {
  const ok = run(script);
  check(ok.status === 0, `${script} success exit 0`, `exit=${String(ok.status)}`);
  check(ok.left.length === 0, `${script} success no leftover`, ok.left.join(","));

  const forced = run(script, { SAYDO_SELFTEST_FORCE_FAIL: "1" });
  check(forced.status === 1, `${script} forced fail exit 1`, `exit=${String(forced.status)}`);
  check(forced.left.length === 0, `${script} forced fail no leftover`, forced.left.join(","));
}

const gitFail = run("test-migration-tools.mjs", { SAYDO_SELFTEST_FORCE_GIT_FAIL: "1" });
check(gitFail.status === 1, "migration git prep fail exit 1", `exit=${String(gitFail.status)}`);
check(gitFail.left.length === 0, "migration git prep fail no leftover", gitFail.left.join(","));

const privacyGitFail = run("test-public-tree-privacy.mjs", { SAYDO_SELFTEST_FORCE_GIT_FAIL: "1" });
check(privacyGitFail.status === 1, "privacy git prep fail exit 1", `exit=${String(privacyGitFail.status)}`);
check(privacyGitFail.left.length === 0, "privacy git prep fail no leftover", privacyGitFail.left.join(","));

const symlinkSkip = run("test-migration-tools.mjs", {
  SAYDO_SELFTEST_INJECT_WIN32: "1",
  SAYDO_SELFTEST_INJECT_SYMLINK_DENY: "1"
});
check(symlinkSkip.status === 0, "injected symlink skip exit 0", `exit=${String(symlinkSkip.status)}`);
check(/\[skip\].*symlink skipped/u.test(symlinkSkip.stdout), "injected symlink skip uses [skip]");
check(!/\[ok\].*symlink skipped/u.test(symlinkSkip.stdout), "injected symlink skip is not claimed [ok]");
check(symlinkSkip.left.length === 0, "injected symlink skip no leftover", symlinkSkip.left.join(","));

const fifoSkip = run("test-migration-tools.mjs", { SAYDO_SELFTEST_INJECT_WIN32: "1" });
check(fifoSkip.status === 0, "injected win32 FIFO skip exit 0", `exit=${String(fifoSkip.status)}`);
check(/\[skip\].*FIFO/u.test(fifoSkip.stdout), "injected FIFO skip uses [skip]");
check(fifoSkip.left.length === 0, "injected FIFO skip no leftover", fifoSkip.left.join(","));

const unreadSkip = run("test-emoji-gate.mjs", { SAYDO_SELFTEST_INJECT_WIN32: "1" });
check(unreadSkip.status === 0, "injected emoji unreadable skip exit 0", `exit=${String(unreadSkip.status)}`);
check(/\[skip\].*unreadable file/u.test(unreadSkip.stdout), "injected unreadable skip uses [skip]");
check(!/\[ok\] unreadable file/u.test(unreadSkip.stdout), "unrun unreadable test is not claimed [ok]");
check(unreadSkip.left.length === 0, "injected unreadable skip no leftover", unreadSkip.left.join(","));

process.stdout.write(`gate-temp-cleanup: pass=${pass} fail=${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
