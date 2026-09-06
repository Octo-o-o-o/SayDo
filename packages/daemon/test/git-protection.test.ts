import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KNOWLEDGE_PRIVACY_LIMITS } from "@saydo/contracts";
import { ensureGitProtection, guardPrivateLeaf } from "../src/memory/gitProtection.js";

function gitRepo(): { dir: string; git: (args: string[]) => string } {
  const dir = mkdtempSync(join(tmpdir(), "saydo-gp-"));
  const git = (args: string[]) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  git(["init", "-q"]);
  git(["config", "user.email", "t@t"]);
  git(["config", "user.name", "t"]);
  writeFileSync(join(dir, "README.md"), "x\n");
  git(["add", "README.md"]);
  git(["commit", "-q", "-m", "init"]);
  return { dir, git };
}

function countingGit(logFile: string, realGit: string): string {
  const bin = mkdtempSync(join(tmpdir(), "saydo-gitbin-"));
  const script = join(bin, "git");
  writeFileSync(
    script,
    `#!/bin/sh\nprintf '%s\\n' "$*" >> "${logFile}"\nexec "${realGit}" "$@"\n`
  );
  chmodSync(script, 0o755);
  return bin;
}

describe("Git 私有 write set 保护", () => {
  it("非 Git => not_git", () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-nogit-"));
    expect(ensureGitProtection(dir).status).toBe("not_git");
    expect(existsSync(join(dir, ".saydo", ".gitignore"))).toBe(false);
  });

  it("根 .gitignore 已含 .saydo/ => protected 且不写文件", () => {
    const { dir } = gitRepo();
    writeFileSync(join(dir, ".gitignore"), ".saydo/\n");
    execFileSync("git", ["add", ".gitignore"], { cwd: dir, stdio: "ignore" });
    execFileSync("git", ["commit", "-q", "-m", "ignore"], { cwd: dir, stdio: "ignore" });
    const r = ensureGitProtection(dir);
    expect(r.status).toBe("protected");
    expect(existsSync(join(dir, ".saydo", ".gitignore"))).toBe(false);
  });

  it("无 ignore => 创建 .saydo/.gitignore 并复核 protected", () => {
    const { dir } = gitRepo();
    const r = ensureGitProtection(dir);
    expect(r.status).toBe("protected");
    const ignore = join(dir, ".saydo", ".gitignore");
    expect(existsSync(ignore)).toBe(true);
    const text = readFileSync(ignore, "utf8");
    expect(text).toContain("/foundation/");
    expect(text).toContain("/knowledge/");
    const check = execFileSync("git", ["-C", dir, "check-ignore", "-v", "--", ".saydo/foundation/"], {
      encoding: "utf8"
    });
    expect(check.length).toBeGreaterThan(0);
  });

  it("已存在但不覆盖的 .saydo/.gitignore => 不改字节且 insufficient", () => {
    const { dir } = gitRepo();
    mkdirSync(join(dir, ".saydo"), { recursive: true });
    const ignore = join(dir, ".saydo", ".gitignore");
    const original = "# user keep\n";
    writeFileSync(ignore, original);
    const r = ensureGitProtection(dir);
    expect(r.status).toBe("insufficient");
    expect(readFileSync(ignore, "utf8")).toBe(original);
  });

  it("已 git add 的 .saydo/foundation/core.md => insufficient 且文件仍在、未 untrack", () => {
    const { dir, git } = gitRepo();
    mkdirSync(join(dir, ".saydo", "foundation"), { recursive: true });
    const core = join(dir, ".saydo", "foundation", "core.md");
    writeFileSync(core, "tracked\n");
    git(["add", "-f", ".saydo/foundation/core.md"]);
    git(["commit", "-q", "-m", "track foundation"]);
    const r = ensureGitProtection(dir);
    expect(r.status).toBe("insufficient");
    expect(existsSync(core)).toBe(true);
    expect(readFileSync(core, "utf8")).toBe("tracked\n");
    const tracked = git(["ls-files", "-z", "--", ".saydo/foundation/"]);
    expect(tracked.includes("core.md")).toBe(true);
  });

  it("worktree 的 .git 文件可正常查询", () => {
    const { dir, git } = gitRepo();
    writeFileSync(join(dir, ".gitignore"), ".saydo/\n");
    git(["add", ".gitignore"]);
    git(["commit", "-q", "-m", "ignore"]);
    const wt = join(mkdtempSync(join(tmpdir(), "saydo-wt-")), "wt");
    git(["worktree", "add", "-q", wt, "-b", "wt-as02"]);
    const r = ensureGitProtection(wt);
    expect(r.status).toBe("protected");
  });

  it(".saydo 为指向根外的 symlink => outside_root", () => {
    const { dir } = gitRepo();
    const outside = mkdtempSync(join(tmpdir(), "saydo-out-"));
    symlinkSync(outside, join(dir, ".saydo"));
    const r = ensureGitProtection(dir);
    expect(r.status).toBe("outside_root");
  });

  it("PATH 前置假 git 非 not-a-repo 失败 => query_failed", () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-qfail-"));
    const bin = mkdtempSync(join(tmpdir(), "saydo-fakegit-"));
    writeFileSync(join(bin, "git"), "#!/bin/sh\necho fatal: exploded >&2\nexit 128\n");
    chmodSync(join(bin, "git"), 0o755);
    const prev = process.env["PATH"] ?? "";
    process.env["PATH"] = `${bin}:${prev}`;
    try {
      expect(ensureGitProtection(dir).status).toBe("query_failed");
    } finally {
      process.env["PATH"] = prev;
    }
  });

  it("PATH 前置假 git 超时 => query_failed", { timeout: 25_000 }, () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-timeout-"));
    const bin = mkdtempSync(join(tmpdir(), "saydo-slowgit-"));
    writeFileSync(join(bin, "git"), "#!/bin/sh\nsleep 30\nexit 0\n");
    chmodSync(join(bin, "git"), 0o755);
    const prev = process.env["PATH"] ?? "";
    process.env["PATH"] = `${bin}:${prev}`;
    try {
      expect(ensureGitProtection(dir).status).toBe("query_failed");
    } finally {
      process.env["PATH"] = prev;
    }
  });

  it("查询次数不超过 5", () => {
    const { dir } = gitRepo();
    const logFile = join(mkdtempSync(join(tmpdir(), "saydo-glog-")), "calls.log");
    const realGit = execFileSync("which", ["git"], { encoding: "utf8" }).trim();
    const bin = countingGit(logFile, realGit);
    const prev = process.env["PATH"] ?? "";
    process.env["PATH"] = `${bin}:${prev}`;
    try {
      ensureGitProtection(dir);
    } finally {
      process.env["PATH"] = prev;
    }
    const lines = existsSync(logFile) ? readFileSync(logFile, "utf8").split("\n").filter((l) => l.length > 0) : [];
    expect(lines.length).toBeLessThanOrEqual(KNOWLEDGE_PRIVACY_LIMITS.gitProtectionQueryMaxPerBoundary);
    expect(lines.length).toBeGreaterThan(0);
  });

  it("guardPrivateLeaf:根外 symlink => outside_root 且不改目标", () => {
    const { dir } = gitRepo();
    const outsideDir = mkdtempSync(join(tmpdir(), "saydo-leaf-out-"));
    const outside = join(outsideDir, "victim.md");
    writeFileSync(outside, "KEEP-OUT\n");
    mkdirSync(join(dir, ".saydo", "knowledge"), { recursive: true });
    const leaf = join(dir, ".saydo", "knowledge", "m1-notes.md");
    symlinkSync(outside, leaf);
    const r = guardPrivateLeaf(dir, ".saydo/knowledge/m1-notes.md");
    expect(r.status).toBe("outside_root");
    expect(r.relativeTarget).toBe(".saydo/knowledge/m1-notes.md");
    expect(readFileSync(outside, "utf8")).toBe("KEEP-OUT\n");
    expect(lstatSync(leaf).isSymbolicLink()).toBe(true);
  });

  it("guardPrivateLeaf:指向根内 README 的 symlink => write_failed 且不改 README", () => {
    const { dir } = gitRepo();
    const readme = join(dir, "README.md");
    const before = readFileSync(readme, "utf8");
    mkdirSync(join(dir, ".saydo", "knowledge"), { recursive: true });
    const leaf = join(dir, ".saydo", "knowledge", "m1-notes.md");
    symlinkSync(readme, leaf);
    const r = guardPrivateLeaf(dir, ".saydo/knowledge/m1-notes.md");
    expect(r.status).toBe("write_failed");
    expect(r.relativeTarget).toBe(".saydo/knowledge/m1-notes.md");
    expect(readFileSync(readme, "utf8")).toBe(before);
    expect(lstatSync(leaf).isSymbolicLink()).toBe(true);
  });

  it("guardPrivateLeaf:常规文件或不存在 => protected", () => {
    const { dir } = gitRepo();
    mkdirSync(join(dir, ".saydo", "knowledge"), { recursive: true });
    expect(guardPrivateLeaf(dir, ".saydo/knowledge/m1-notes.md").status).toBe("protected");
    writeFileSync(join(dir, ".saydo", "knowledge", "m1-notes.md"), "notes\n");
    expect(guardPrivateLeaf(dir, ".saydo/knowledge/m1-notes.md").status).toBe("protected");
  });
});
