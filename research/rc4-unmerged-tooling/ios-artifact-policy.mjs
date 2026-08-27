#!/usr/bin/env node
// iOS 真机产物政策:扫描 Git tracked apps/ios 普通文件,禁止账户/team/固定设备 id/本机路径。
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { countPublicPrivacyHits, privacyHitsFromBytes } from "./public-text-redaction.mjs";

const IOS_PREFIX = "apps/ios/";
const ALLOWED_DEVICE_ID = "00000000-0000-0000-0000-000000000000";
const TEAM_ASSIGN_RE = /(?<![A-Z_])(?:DEVELOPMENT_TEAM|DevelopmentTeam)\s*[:=]\s*["']?[A-Z0-9]{10}\b/;
const DEVICE_ID_RE = /\b[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}\b/g;
const HOME_RE = /(?:^|[\s"'=])(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)/;
const BIN_EXT_RE = /\.(png|jpg|jpeg|gif|webp|pdf|ico|icns)$/i;

function gitZ(repo, args) {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" }).split("\0").filter(Boolean);
}

export function listIosTrackedPaths(repo) {
  return gitZ(repo, ["ls-files", "-z", "--", "apps/ios"]).filter((path) => path === "apps/ios" || path.startsWith(IOS_PREFIX));
}

export function scanIosTrackedTree(repo) {
  const paths = listIosTrackedPaths(repo);
  if (paths.length === 0) {
    return { ok: false, failures: ["ios-tracked-empty"], files: [] };
  }
  const failures = [];
  const files = [];
  for (const path of paths) {
    const absolute = resolve(repo, path);
    let stat;
    try {
      stat = lstatSync(absolute);
    } catch {
      failures.push("ios-tracked-missing");
      continue;
    }
    if (stat.isSymbolicLink()) {
      failures.push("ios-tracked-symlink");
      continue;
    }
    if (!stat.isFile()) {
      failures.push("ios-tracked-non-regular");
      continue;
    }
    files.push(path);
    const buffer = readFileSync(absolute);
    const text = buffer.toString("utf8");
    if (TEAM_ASSIGN_RE.test(text)) failures.push("ios-team-literal");
    const ids = text.match(DEVICE_ID_RE) ?? [];
    if (ids.some((id) => id !== ALLOWED_DEVICE_ID)) failures.push("ios-device-id-literal");
    if (text.includes("<account>")) failures.push("ios-account-placeholder");
    if (HOME_RE.test(text)) failures.push("ios-home-path");
    const hits = BIN_EXT_RE.test(path)
      ? privacyHitsFromBytes(buffer, { binary: true })
      : countPublicPrivacyHits(text);
    if (Object.keys(hits).length > 0) failures.push("ios-privacy-hit");
  }
  return { ok: failures.length === 0, failures: [...new Set(failures)], files };
}

const here = dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const scanned = scanIosTrackedTree(join(here, ".."));
  if (!scanned.ok) {
    process.stderr.write(`[fail] ios artifact policy ${scanned.failures.join(",")}\n`);
    process.exit(1);
  }
  process.stdout.write(`[ok] ios artifact policy files=${scanned.files.length}\n`);
}
