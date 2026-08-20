#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  realpathSync,
  writeFileSync
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const [command, repoArg, baselineArg, manifestArg] = process.argv.slice(2);
if (!["write", "check"].includes(command) || !repoArg || !baselineArg || !manifestArg) {
  console.error("用法:target-change-manifest.mjs <write|check> <repo-dir> <baseline> <manifest-file>");
  process.exit(2);
}

const repo = resolve(repoArg);
const manifestFile = resolve(manifestArg);
const manifestPath = relative(repo, manifestFile).replaceAll("\\", "/");
const git = (args) =>
  execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const gitBytes = (args) =>
  execFileSync("git", args, { cwd: repo, encoding: null, stdio: ["ignore", "pipe", "pipe"] });
const splitZ = (value) => value.split("\0").filter(Boolean);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const permissions = (stat) => (stat.mode & 0o7777).toString(8).padStart(4, "0");
const statIfPresent = (path) => {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
};
const isIgnored = (path, directory = false) => {
  try {
    execFileSync("git", ["check-ignore", "-q", "--", directory ? `${path}/` : path], {
      cwd: repo,
      stdio: "ignore"
    });
    return true;
  } catch (error) {
    if (error?.status === 1) return false;
    throw error;
  }
};
const specialUntracked = [];
const walkSpecialUntracked = (absoluteDir, relativeDir = "") => {
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    if (relativeDir === "" && entry.name === ".git") continue;
    const path = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
    const absolute = join(absoluteDir, entry.name);
    const stat = lstatSync(absolute);
    if (stat.isDirectory()) {
      if (!isIgnored(path, true)) walkSpecialUntracked(absolute, path);
      continue;
    }
    if (!stat.isFile() && !stat.isSymbolicLink() && !isIgnored(path)) {
      specialUntracked.push(path);
    }
  }
};

const gitRoot = resolve(git(["rev-parse", "--show-toplevel"]).trim());
if (realpathSync(gitRoot) !== realpathSync(repo)) throw new Error(`repo-dir 必须是 Git 根目录:${gitRoot}`);
git(["rev-parse", "--verify", `${baselineArg}^{commit}`]);
const expectedMigrationBranch = "codex/merge-voice-coding-20260729";
const branch = git(["branch", "--show-current"]).trim();
const explicitTestRoot = process.env.SAYDO_MIGRATION_TEST_ROOT
  ? resolve(process.env.SAYDO_MIGRATION_TEST_ROOT)
  : undefined;
if (command === "write" && branch !== expectedMigrationBranch && explicitTestRoot !== repo) {
  throw new Error(`write 必须在迁移专用分支；隔离测试须显式绑定 SAYDO_MIGRATION_TEST_ROOT:${branch || "(detached)"}`);
}
const tracked = splitZ(git(["diff", "--name-only", "-z", baselineArg, "--"]));
const untracked = splitZ(git(["ls-files", "--others", "--exclude-standard", "-z"]));
walkSpecialUntracked(repo);
const paths = [...new Set([...tracked, ...untracked, ...specialUntracked])]
  .filter((path) => path !== manifestPath)
  .sort((a, b) => a.localeCompare(b, "en"));
const rows = [
  "status\tbaseline_sha256\tbaseline_bytes\tbaseline_type\tbaseline_mode\ttarget_sha256\ttarget_bytes\ttarget_type\ttarget_mode\tpath"
];

for (const path of paths) {
  let inBaseline = true;
  try {
    git(["cat-file", "-e", `${baselineArg}:${path}`]);
  } catch {
    inBaseline = false;
  }
  const absolute = resolve(repo, path);
  const targetStat = statIfPresent(absolute);
  const inWorktree = targetStat !== undefined;
  const status = inBaseline ? (inWorktree ? "M" : "D") : "A";
  let baseline = ["-", "-", "-", "-"];
  if (inBaseline) {
    const bytes = gitBytes(["show", `${baselineArg}:${path}`]);
    const tree = git(["ls-tree", baselineArg, "--", path]).trim().split(/\s+/, 3);
    const gitMode = tree[0];
    const type = gitMode === "120000" ? "L" : "F";
    baseline = [sha256(bytes), String(bytes.length), type, gitMode];
  }
  let target = ["-", "-", "-", "-"];
  if (inWorktree) {
    const stat = targetStat;
    const type = stat.isSymbolicLink() ? "L" : stat.isFile() ? "F" : undefined;
    if (!type) throw new Error(`不支持的工作树类型:${path}`);
    const linkTarget = type === "L" ? readlinkSync(absolute) : undefined;
    if (linkTarget !== undefined) {
      const resolvedTarget = resolve(dirname(absolute), linkTarget);
      const targetFromRepo = relative(repo, resolvedTarget);
      if (
        isAbsolute(linkTarget) ||
        targetFromRepo === ".." ||
        targetFromRepo.startsWith(`..${sep}`) ||
        isAbsolute(targetFromRepo)
      ) {
        throw new Error(`工作树 symlink 越出仓根:${path} -> ${linkTarget}`);
      }
    }
    const bytes = type === "L" ? Buffer.from(linkTarget) : readFileSync(absolute);
    target = [sha256(bytes), String(bytes.length), type, permissions(stat)];
  }
  rows.push([status, ...baseline, ...target, path].join("\t"));
}

const content = `${rows.join("\n")}\n`;
if (command === "write") {
  writeFileSync(manifestFile, content);
  console.log(`[ok] target change manifest: ${paths.length} paths -> ${manifestFile}`);
  process.exit(0);
}

if (!existsSync(manifestFile) || readFileSync(manifestFile, "utf8") !== content) {
  console.error("[fail] target change manifest differs from current worktree");
  process.exit(1);
}

console.log(`[ok] target change manifest verified: ${paths.length} paths`);
