#!/usr/bin/env node
// 文档链接门禁自测:目标不存在但被 Git ignore 仍 fail-closed,不得把 ignore 当存在豁免。
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const CHECKER = join(here, "check-doc-links.mjs");
const dir = mkdtempSync(join(tmpdir(), "saydo-doc-links-"));
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

function git(args, cwd) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  return result;
}

const checkerSource = readFileSync(CHECKER, "utf8");
assert("production checker does not consult check-ignore", !checkerSource.includes("check-ignore"));
assert("production checker uses existsSync", checkerSource.includes("existsSync(absolute)"));

try {
  const repo = join(dir, "repo");
  mkdirSync(join(repo, "scripts"), { recursive: true });
  mkdirSync(join(repo, "docs"), { recursive: true });
  mkdirSync(join(repo, "research/codex-findings"), { recursive: true });
  mkdirSync(join(repo, "ignored-secret"), { recursive: true });
  git(["init", "-q"], repo);
  git(["config", "user.email", "test@example.invalid"], repo);
  git(["config", "user.name", "test"], repo);
  writeFileSync(join(repo, ".gitignore"), "ignored-secret/\n");
  writeFileSync(join(repo, "docs/note.md"), "ok\n");
  writeFileSync(
    join(repo, "research/codex-findings/hostile.md"),
    "[missing ignored](../../ignored-secret/missing-core.md)\n[ok existing](../../docs/note.md)\n"
  );
  copyFileSync(CHECKER, join(repo, "scripts/check-doc-links.mjs"));
  git(["add", "docs", "research", "scripts", ".gitignore"], repo);
  git(["commit", "-q", "-m", "seed"], repo);

  const missingRel = "ignored-secret/missing-core.md";
  const ignore = spawnSync("git", ["check-ignore", "-q", "--", missingRel], { cwd: repo, encoding: "utf8" });
  assert("missing dest matches gitignore", ignore.status === 0);
  assert("ignored dest does not exist", !existsSync(join(repo, missingRel)));

  const hostile = spawnSync(process.execPath, ["scripts/check-doc-links.mjs"], { cwd: repo, encoding: "utf8" });
  const hostileOut = `${hostile.stdout ?? ""}${hostile.stderr ?? ""}`;
  assert("ignored missing dest fail-closed", hostile.status === 1);
  assert(
    "hostile reports the missing dest",
    /ignored-secret\/missing-core\.md/.test(hostileOut) && /相对链接失效/.test(hostileOut)
  );
  assert("hostile does not treat ignore as existence", !/broken=0/.test(hostileOut));

  writeFileSync(join(repo, "research/codex-findings/hostile.md"), "[ok existing](../../docs/note.md)\n");
  const clean = spawnSync(process.execPath, ["scripts/check-doc-links.mjs"], { cwd: repo, encoding: "utf8" });
  const cleanOut = `${clean.stdout ?? ""}${clean.stderr ?? ""}`;
  assert("existing dest passes", clean.status === 0 && /broken=0/.test(cleanOut));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

process.stdout.write(`doc-links self-test: pass=${pass} fail=${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
