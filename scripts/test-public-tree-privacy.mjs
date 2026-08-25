#!/usr/bin/env node
// 公开树隐私扫描器自测。敏感样本运行时拼接;输出不得包含 fixture 敏感原文。
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { countPublicPrivacyHits } from "./public-text-redaction.mjs";
import { isExcludedByExactSet, readPublicExcludeExactSet } from "./check-public-tree-privacy.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const SCANNER = join(here, "check-public-tree-privacy.mjs");
const HELPER = join(here, "public-text-redaction.mjs");
const DIR = mkdtempSync(join(tmpdir(), "saydo-privacy-gate-"));
let pass = 0;
let fail = 0;

function ipv4(...parts) {
  return parts.join(".");
}
function macHome(user, rest = "") {
  return ["", "Users", user].join("/") + rest;
}
function linuxHome(user, rest = "") {
  return ["", "home", user].join("/") + rest;
}
function winHome(user, rest = "") {
  return ["C:", "Users", user].join("\\") + rest;
}

function git(args, cwd) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed`);
  return r;
}

function scan(repo, args, extra = {}) {
  return spawnSync(process.execPath, [SCANNER, ...args], {
    cwd: repo,
    encoding: "utf8",
    env: extra.env ?? process.env
  });
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

function assertNoLeak(label, text, secrets) {
  const leaked = secrets.some((secret) => secret && String(text).includes(secret));
  assert(`${label}: no secret echo`, !leaked);
}

try {
  const repo = join(DIR, "repo");
  mkdirSync(repo);
  git(["init", "-q"], repo);
  git(["config", "user.email", "test@example.invalid"], repo);
  git(["config", "user.name", "test"], repo);

  const mac = macHome("alice", "/WorkSpace/app");
  const linux = linuxHome("bob", "/src");
  const win = winHome("carol", "\\src");
  const ipA = ipv4(10, 4, 5, 6);
  const ipB = ipv4(192, 168, 9, 9);
  const ipC = ipv4(172, 16, 8, 8);
  const probeToken = ["Acme", "Owner"].join("");

  mkdirSync(join(repo, "keep"), { recursive: true });
  mkdirSync(join(repo, "artifacts/release/copyright"), { recursive: true });
  mkdirSync(join(repo, "artifacts/release/copyright-notes"), { recursive: true });
  mkdirSync(join(repo, "docs"), { recursive: true });

  writeFileSync(join(repo, "keep/mac.txt"), `cwd ${mac}\n`);
  writeFileSync(join(repo, "keep/linux.txt"), `cwd ${linux}\n`);
  writeFileSync(join(repo, "keep/win.txt"), `cwd ${win}\n`);
  writeFileSync(join(repo, "keep/ip.txt"), `lan ${ipA} ${ipB} ${ipC}\n`);
  writeFileSync(join(repo, "keep/probe.txt"), `id ${probeToken.toLowerCase()}\n`);
  writeFileSync(join(repo, "docs/space name.txt"), "clean\n");
  writeFileSync(join(repo, "docs/中文.md"), "clean\n");
  writeFileSync(join(repo, "keep/binary.bin"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0d]));
  writeFileSync(join(repo, "artifacts/release/copyright/secret.txt"), `exclude ${mac}\n`);
  writeFileSync(join(repo, "artifacts/release/copyright-notes/note.md"), `similar ${mac}\n`);
  writeFileSync(join(repo, "clean.md"), "https://github.com/Octo-o-o-o/SayDo 127.0.0.1\n");

  git(["add", "."], repo);
  git(["commit", "-q", "-m", "seed"], repo);
  const sha = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).stdout.trim();

  const excludes = readPublicExcludeExactSet();
  assert("exact-set reads publish script", excludes.includes("artifacts/release/copyright"));
  assert(
    "exact-set does not prefix-match similar paths",
    !isExcludedByExactSet("artifacts/release/copyright-notes/note.md", excludes) &&
      isExcludedByExactSet("artifacts/release/copyright/secret.txt", excludes)
  );

  const probesFile = join(DIR, "probes.txt");
  writeFileSync(probesFile, `${probeToken}\n`);

  const secrets = [mac, linux, win, ipA, ipB, ipC, probeToken, probeToken.toLowerCase()];

  const hit = scan(repo, ["--ref", sha, "--probes-file", probesFile]);
  assert("hit run non-zero", hit.status === 1);
  const hitOut = outputOf(hit);
  assertNoLeak("hit run", hitOut, secrets);
  assert("mac category", hitOut.includes("path=keep/mac.txt") && hitOut.includes("category=home-macos"));
  assert("linux category", hitOut.includes("path=keep/linux.txt") && hitOut.includes("category=home-linux"));
  assert("windows category", hitOut.includes("path=keep/win.txt") && hitOut.includes("category=home-windows"));
  assert("rfc1918 category", hitOut.includes("path=keep/ip.txt") && hitOut.includes("category=rfc1918"));
  assert("private probe case-insensitive", hitOut.includes("path=keep/probe.txt") && hitOut.includes("category=private-probe-"));
  assert("excluded exact-set not reported", !hitOut.includes("artifacts/release/copyright/secret.txt"));
  assert("similar path not excluded", hitOut.includes("path=artifacts/release/copyright-notes/note.md"));
  assert("binary not treated as zero via decode", hitOut.includes("binary="));

  writeFileSync(join(repo, "keep/mac.txt"), "ok\n");
  writeFileSync(join(repo, "keep/linux.txt"), "ok\n");
  writeFileSync(join(repo, "keep/win.txt"), "ok\n");
  writeFileSync(join(repo, "keep/ip.txt"), "ok\n");
  writeFileSync(join(repo, "keep/probe.txt"), "ok\n");
  writeFileSync(join(repo, "artifacts/release/copyright-notes/note.md"), "ok\n");
  git(["add", "."], repo);
  git(["commit", "-q", "-m", "clean"], repo);
  const cleanSha = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).stdout.trim();

  const clean = scan(repo, ["--ref", cleanSha, "--probes-file", probesFile]);
  const cleanOut = outputOf(clean);
  assert("clean ref zero hits", clean.status === 0 && cleanOut.includes("hits=0"));
  assertNoLeak("clean run", cleanOut, secrets);
  assert("space filename scanned", cleanOut.includes("scanned=") && !cleanOut.includes("docs/space name.txt"));
  assert("binary counted", /\bbinary=[1-9]/.test(cleanOut));

  const fsClean = scan(repo, ["--fs", "--probes-file", probesFile]);
  assert("fs clean", fsClean.status === 0);
  assertNoLeak("fs clean", outputOf(fsClean), secrets);

  writeFileSync(join(repo, "docs/space name.txt"), `${mac}\n`);
  const spaceHit = scan(repo, ["--fs", "--allow-missing-probes"]);
  const spaceOut = outputOf(spaceHit);
  assert("space filename hit", spaceHit.status === 1 && spaceOut.includes("path=docs/space name.txt"));
  assertNoLeak("space filename", spaceOut, secrets);
  writeFileSync(join(repo, "docs/space name.txt"), "clean\n");

  const badRef = scan(repo, ["--ref", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "--allow-missing-probes"]);
  assert("git failure non-zero", badRef.status !== 0);
  assertNoLeak("git failure", outputOf(badRef), secrets);

  copyFileSync(SCANNER, join(repo, "scanner-copy.mjs"));
  copyFileSync(HELPER, join(repo, "helper-copy.mjs"));
  git(["add", "scanner-copy.mjs", "helper-copy.mjs"], repo);
  git(["commit", "-q", "-m", "copies"], repo);
  const copySha = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).stdout.trim();
  const self = scan(repo, ["--ref", copySha, "--allow-missing-probes"]);
  const selfOut = outputOf(self);
  assert("scanner copies do not self-hit", self.status === 0 && selfOut.includes("hits=0"));

  assert("scanner source static-clean", Object.keys(countPublicPrivacyHits(readFileSync(SCANNER, "utf8"))).length === 0);
  assert("helper source static-clean", Object.keys(countPublicPrivacyHits(readFileSync(HELPER, "utf8"))).length === 0);
  assert(
    "self-test source static-clean",
    Object.keys(countPublicPrivacyHits(readFileSync(fileURLToPath(import.meta.url), "utf8"))).length === 0
  );

  process.stdout.write(`public-tree-privacy self-test: pass=${pass} fail=${fail}\n`);
  process.exit(fail === 0 ? 0 : 1);
} finally {
  rmSync(DIR, { recursive: true, force: true });
}
