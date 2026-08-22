#!/usr/bin/env node
// emoji 门禁自测:注入固件必红、文本箭头不误伤。固件用字节构造,不把真 emoji 写进仓库。
import { mkdtempSync, writeFileSync, mkdirSync, chmodSync, rmSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "check-emoji.mjs");
const DIR = mkdtempSync(join(tmpdir(), "saydo-emoji-gate-"));
let pass = 0;
let fail = 0;

function run(args, env = process.env) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: "utf8",
    env,
    cwd: process.cwd()
  });
}

function expectHit(file, label) {
  const r = run([file]);
  if (r.status === 0) {
    process.stdout.write(`[fail] ${label}: expected gate to catch, but it passed\n`);
    fail += 1;
  } else {
    process.stdout.write(`[ok] ${label}: caught as expected\n`);
    pass += 1;
  }
}

function expectClean(file, label) {
  const r = run([file]);
  if (r.status === 0) {
    process.stdout.write(`[ok] ${label}: passed as expected\n`);
    pass += 1;
  } else {
    process.stdout.write(`[fail] ${label}: false positive\n`);
    fail += 1;
  }
}

try {
  writeFileSync(join(DIR, "emoji.txt"), "hello \u{1F600} world\n");
  writeFileSync(join(DIR, "marks.txt"), "status \u2705 \u274C \u26A0\n");
  writeFileSync(join(DIR, "vs16.txt"), "digit 1\uFE0F\u20E3\n");
  writeFileSync(join(DIR, "arrows.txt"), "A\u2192B taskId\u2194runId\n");
  writeFileSync(join(DIR, "emoji.lock"), "locked \u{1F600}\n");

  expectHit(join(DIR, "emoji.txt"), "true emoji");
  expectHit(join(DIR, "marks.txt"), "check/cross/warning marks");
  expectHit(join(DIR, "vs16.txt"), "variation selector");
  expectClean(join(DIR, "arrows.txt"), "text arrows");
  expectHit(join(DIR, "emoji.lock"), "text lockfile");

  const noRg = { ...process.env, PATH: DIR };
  const arrowsNoRg = spawnSync(process.execPath, [SCRIPT, join(DIR, "arrows.txt")], {
    encoding: "utf8",
    env: noRg
  });
  if (arrowsNoRg.status === 0) {
    process.stdout.write("[ok] missing rg: Node fallback still clean for arrows\n");
    pass += 1;
  } else {
    process.stdout.write("[fail] missing rg: Node fallback should keep arrows clean\n");
    fail += 1;
  }

  writeFileSync(join(DIR, "entity.html"), "<p>&#x1F399;</p>\n");
  expectHit(join(DIR, "entity.html"), "encoded HTML entity");
  writeFileSync(join(DIR, "escape.html"), '<script>const icon="\\u2600";</script>\n');
  expectHit(join(DIR, "escape.html"), "encoded HTML script escape");

  const missing = run([join(DIR, "missing.txt")]);
  if (missing.status !== 0) {
    process.stdout.write("[ok] missing file: failed closed as expected\n");
    pass += 1;
  } else {
    process.stdout.write("[fail] missing file: expected gate error, but it passed\n");
    fail += 1;
  }

  if (process.platform !== "win32") {
    const unreadable = join(DIR, "unreadable.txt");
    writeFileSync(unreadable, "plain text\n");
    chmodSync(unreadable, 0);
    const r = run([unreadable]);
    chmodSync(unreadable, 0o600);
    if (r.status !== 0) {
      process.stdout.write("[ok] unreadable file: failed closed as expected\n");
      pass += 1;
    } else {
      process.stdout.write("[fail] unreadable file: expected gate error, but it passed\n");
      fail += 1;
    }
  }

  const repo = join(DIR, "untracked-repo");
  mkdirSync(join(repo, "scripts"), { recursive: true });
  copyFileSync(SCRIPT, join(repo, "scripts", "check-emoji.mjs"));
  spawnSync("git", ["init", "-q"], { cwd: repo });
  writeFileSync(join(repo, "new.md"), "untracked \u{1F600}\n");
  const untracked = spawnSync(process.execPath, [join(repo, "scripts", "check-emoji.mjs")], {
    encoding: "utf8",
    cwd: repo
  });
  if (untracked.status !== 0) {
    process.stdout.write("[ok] untracked default scan: caught as expected\n");
    pass += 1;
  } else {
    process.stdout.write("[fail] untracked default scan: expected gate to catch, but it passed\n");
    fail += 1;
  }

  process.stdout.write(`emoji-gate self-test: pass=${pass} fail=${fail}\n`);
  process.exit(fail === 0 ? 0 : 1);
} finally {
  rmSync(DIR, { recursive: true, force: true });
}
