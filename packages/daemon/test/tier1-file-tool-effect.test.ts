import { chmodSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeRisk } from "../src/policy/engine.js";
import { fileToolToEffect, resolveFileToolPath, SENSITIVE_FILE_BASENAME_RE } from "../src/tier1/fileToolEffect.js";

function wt(): string {
  const dir = mkdtempSync(join(tmpdir(), "saydo-fte-"));
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src", "a.ts"), "x");
  return dir;
}

describe("fileToolToEffect", () => {
  it("圈内写 / 圈外写 / 圈内读 / 圈外读", () => {
    const cwd = wt();
    expect(fileToolToEffect("Write", join(cwd, "src/a.ts"), cwd).kind).toBe("write_worktree");
    expect(fileToolToEffect("Write", "/tmp/out.txt", cwd)).toEqual({
      kind: "delete_data",
      target: "write-outside-worktree"
    });
    expect(fileToolToEffect("Read", join(cwd, "src/a.ts"), cwd).kind).toBe("read");
    expect(fileToolToEffect("Read", "/etc/hosts", cwd)).toEqual({
      kind: "delete_data",
      target: "read-outside-worktree"
    });
    expect(computeRisk(fileToolToEffect("Read", "/etc/hosts", cwd), {}).level).toBe("S3");
  });

  it(".. 逃逸与相对路径相对 cwd", () => {
    const cwd = wt();
    // 圈内含 .. 的路径一律保守拒(agent 应改用规范路径);path.join 会词法折叠,测试用字面量保留 ..
    expect(fileToolToEffect("Write", `${cwd}/src/../src/a.ts`, cwd)).toEqual({
      kind: "delete_data",
      target: "write-outside-worktree",
      reason: "dotdot"
    });
    expect(fileToolToEffect("Write", "../outside.txt", cwd)).toEqual({
      kind: "delete_data",
      target: "write-outside-worktree",
      reason: "dotdot"
    });
    expect(fileToolToEffect("Write", "src/new.ts", cwd).kind).toBe("write_worktree");
  });

  it(".. 穿过 live symlink 不得词法折叠成圈内写", () => {
    const cwd = wt();
    symlinkSync(".", join(cwd, "link"));
    expect(fileToolToEffect("Write", `${cwd}/link/../leaked.txt`, cwd)).toEqual({
      kind: "delete_data",
      target: "write-outside-worktree",
      reason: "dotdot"
    });
    expect(fileToolToEffect("Write", "link/../leaked.txt", cwd).reason).toBe("dotdot");
    expect(computeRisk(fileToolToEffect("Write", "link/../leaked.txt", cwd), {}).level).toBe("S3");
    const outside = mkdtempSync(join(tmpdir(), "saydo-fte-out2-"));
    symlinkSync(outside, join(cwd, "outlink"));
    expect(fileToolToEffect("Write", `${cwd}/outlink/../x`, cwd)).toEqual({
      kind: "delete_data",
      target: "write-outside-worktree",
      reason: "dotdot"
    });
  });

  it("新文件圈内 / 新文件圈外 / 普通缺失目录(圈内)", () => {
    const cwd = wt();
    expect(fileToolToEffect("Write", join(cwd, "src/brand-new.ts"), cwd).kind).toBe("write_worktree");
    expect(fileToolToEffect("Write", "/no/such/dir/x.txt", cwd).kind).toBe("delete_data");
    expect(fileToolToEffect("Write", join(cwd, "missing-dir/x.ts"), cwd).kind).toBe("write_worktree");
  });

  it("真 symlink 逃逸:指向圈外后再 Write", () => {
    const cwd = wt();
    const outside = mkdtempSync(join(tmpdir(), "saydo-fte-out-"));
    symlinkSync(outside, join(cwd, "link"));
    expect(fileToolToEffect("Write", join(cwd, "link/leaked.txt"), cwd)).toEqual({
      kind: "delete_data",
      target: "write-outside-worktree"
    });
  });

  it("悬空 symlink 基名不得当普通后缀拼接", () => {
    const cwd = wt();
    symlinkSync("/no/such/outside", join(cwd, "broken"));
    expect(fileToolToEffect("Write", join(cwd, "broken/leaked.txt"), cwd)).toEqual({
      kind: "delete_data",
      target: "write-outside-worktree",
      reason: "dangling_symlink"
    });
    expect(computeRisk(fileToolToEffect("Write", join(cwd, "broken/leaked.txt"), cwd), {}).level).toBe("S3");
  });

  it("悬空链指向父目录存在但文件不存在的目标", () => {
    const cwd = wt();
    const missing = join(mkdtempSync(join(tmpdir(), "saydo-fte-miss-")), "no-such-file");
    symlinkSync(missing, join(cwd, "to-missing"));
    expect(fileToolToEffect("Write", join(cwd, "to-missing"), cwd)).toEqual({
      kind: "delete_data",
      target: "write-outside-worktree",
      reason: "dangling_symlink"
    });
  });

  it("~ 与 $HOME 展开到 homedir 而非丢掉前缀;盘符 unresolvable", () => {
    const cwd = wt();
    const bashrc = resolveFileToolPath("~/.bashrc", cwd);
    expect("abs" in bashrc).toBe(true);
    if ("abs" in bashrc) {
      expect(bashrc.abs).toBe(join(homedir(), ".bashrc"));
      expect(bashrc.abs).not.toBe("/.bashrc");
    }
    const zshrc = resolveFileToolPath("$HOME/.zshrc", cwd);
    expect("abs" in zshrc).toBe(true);
    if ("abs" in zshrc) {
      expect(zshrc.abs).toBe(join(homedir(), ".zshrc"));
    }
    expect(fileToolToEffect("Write", "~/.bashrc", cwd).kind).toBe("delete_data");
    expect(fileToolToEffect("Write", "$HOME/.zshrc", cwd).kind).toBe("delete_data");
    expect(fileToolToEffect("Write", "C:\\\\Windows\\\\x", cwd).kind).toBe("delete_data");
  });

  it("worktree 为 / 或空 ⇒ 拒(unresolvable/S3);用 relative 而非 startsWith", () => {
    expect(fileToolToEffect("Write", "/etc/passwd", "/")).toEqual({
      kind: "delete_data",
      target: "unresolvable"
    });
    expect(fileToolToEffect("Write", "/etc/passwd", "")).toEqual({
      kind: "delete_data",
      target: "unresolvable"
    });
    expect(computeRisk(fileToolToEffect("Write", "/etc/passwd", "/"), {}).level).toBe("S3");
    const cwd = wt();
    const sibling = `${cwd}-evil`;
    mkdirSync(sibling);
    writeFileSync(join(sibling, "x.ts"), "x");
    expect(fileToolToEffect("Write", join(sibling, "x.ts"), cwd).kind).toBe("delete_data");
  });

  it("大小写:圈内 tokens.css 不敏感; .env / .envrc / .env.local / id_ed25519 敏感", () => {
    const cwd = wt();
    writeFileSync(join(cwd, "tokens.css"), "x");
    expect(SENSITIVE_FILE_BASENAME_RE.test(join(cwd, "tokens.css").replace(/\\/g, "/"))).toBe(false);
    expect(fileToolToEffect("Write", join(cwd, "tokens.css"), cwd).touchesSensitiveData).toBeUndefined();
    expect(fileToolToEffect("Write", join(cwd, ".env"), cwd).touchesSensitiveData).toBe(true);
    expect(fileToolToEffect("Write", join(cwd, ".envrc"), cwd).touchesSensitiveData).toBe(true);
    expect(fileToolToEffect("Write", join(cwd, ".env.local"), cwd).touchesSensitiveData).toBe(true);
    expect(fileToolToEffect("Write", join(cwd, "id_ed25519"), cwd).touchesSensitiveData).toBe(true);
    expect(fileToolToEffect("Read", join(cwd, ".env"), cwd).touchesSensitiveData).toBe(true);
  });

  it("路径非字符串 / 空 / $VAR 判不出", () => {
    const cwd = wt();
    expect(fileToolToEffect("Write", 1, cwd).target).toBe("unresolvable");
    expect(fileToolToEffect("Write", null, cwd).target).toBe("unresolvable");
    expect(fileToolToEffect("Write", "", cwd).target).toBe("unresolvable");
    expect(fileToolToEffect("Write", "$VAR/x", cwd).target).toBe("unresolvable");
    expect(fileToolToEffect("Read", "$VAR/x", cwd).target).toBe("read-outside-worktree");
    expect(computeRisk(fileToolToEffect("Read", "$VAR/x", cwd), {}).level).toBe("S3");
  });

  it("chmod 后仍能判圈内(真实文件)", () => {
    const cwd = wt();
    chmodSync(join(cwd, "src/a.ts"), 0o644);
    expect(fileToolToEffect("Edit", join(cwd, "src/a.ts"), cwd).kind).toBe("write_worktree");
    expect(fileToolToEffect("NotebookEdit", join(cwd, "src/a.ts"), cwd).kind).toBe("write_worktree");
  });

  it("表驱动 ≥36", () => {
    const cwd = wt();
    writeFileSync(join(cwd, "id_rsa"), "x");
    writeFileSync(join(cwd, ".npmrc"), "x");
    const rows: Array<{ tool: string; path: unknown; kind: string; sensitive?: boolean; target?: string }> = [
      { tool: "Write", path: join(cwd, "src/a.ts"), kind: "write_worktree" },
      { tool: "Write", path: "src/a.ts", kind: "write_worktree" },
      { tool: "Write", path: join(cwd, "src/new-file.ts"), kind: "write_worktree" },
      { tool: "Write", path: `${cwd}/src/../src/a.ts`, kind: "delete_data", target: "write-outside-worktree" },
      { tool: "Edit", path: join(cwd, "src/a.ts"), kind: "write_worktree" },
      { tool: "NotebookEdit", path: join(cwd, "src/a.ts"), kind: "write_worktree" },
      { tool: "Read", path: join(cwd, "src/a.ts"), kind: "read" },
      { tool: "Read", path: "src/a.ts", kind: "read" },
      { tool: "Write", path: "/tmp/x", kind: "delete_data", target: "write-outside-worktree" },
      { tool: "Write", path: "/etc/passwd", kind: "delete_data", target: "write-outside-worktree" },
      { tool: "Write", path: "../x", kind: "delete_data" },
      { tool: "Write", path: "~/.bashrc", kind: "delete_data" },
      { tool: "Write", path: "$HOME/.zshrc", kind: "delete_data" },
      { tool: "Write", path: "C:\\Windows\\x", kind: "delete_data" },
      { tool: "Read", path: "/etc/hosts", kind: "delete_data", target: "read-outside-worktree" },
      { tool: "Read", path: "~/.ssh/config", kind: "delete_data", target: "read-outside-worktree" },
      { tool: "Read", path: "$VAR/x", kind: "delete_data", target: "read-outside-worktree" },
      { tool: "Write", path: "", kind: "delete_data", target: "unresolvable" },
      { tool: "Write", path: "$VAR/x", kind: "delete_data", target: "unresolvable" },
      { tool: "Write", path: 42, kind: "delete_data", target: "unresolvable" },
      { tool: "Write", path: join(cwd, ".env"), kind: "write_worktree", sensitive: true },
      { tool: "Write", path: join(cwd, ".env.local"), kind: "write_worktree", sensitive: true },
      { tool: "Write", path: join(cwd, ".envrc"), kind: "write_worktree", sensitive: true },
      { tool: "Write", path: join(cwd, "id_rsa"), kind: "write_worktree", sensitive: true },
      { tool: "Write", path: join(cwd, "id_ed25519"), kind: "write_worktree", sensitive: true },
      { tool: "Write", path: join(cwd, ".npmrc"), kind: "write_worktree", sensitive: true },
      { tool: "Write", path: join(cwd, ".netrc"), kind: "write_worktree", sensitive: true },
      { tool: "Write", path: join(cwd, "secrets.pem"), kind: "write_worktree", sensitive: true },
      { tool: "Write", path: join(cwd, "server.key"), kind: "write_worktree", sensitive: true },
      { tool: "Write", path: join(cwd, "credentials.json"), kind: "write_worktree", sensitive: true },
      { tool: "Write", path: join(cwd, "tokens.css"), kind: "write_worktree" },
      { tool: "Read", path: join(cwd, ".env"), kind: "read", sensitive: true },
      { tool: "Write", path: join(cwd, "SRC/A.TS"), kind: "write_worktree" },
      { tool: "Write", path: "/no/such/abs/file.txt", kind: "delete_data" },
      { tool: "Write", path: join(cwd, "missing/nested/x.ts"), kind: "write_worktree" },
      { tool: "Read", path: "/tmp/x", kind: "delete_data", target: "read-outside-worktree" },
      { tool: "Write", path: join(cwd, "src/a.ts") + "/", kind: "write_worktree" },
      { tool: "Edit", path: join(cwd, ".env"), kind: "write_worktree", sensitive: true }
    ];
    expect(rows.length).toBeGreaterThanOrEqual(36);
    for (const row of rows) {
      const d = fileToolToEffect(row.tool, row.path, cwd);
      expect(d.kind, `${row.tool} ${String(row.path)}`).toBe(row.kind);
      if (row.target) expect(d.target, String(row.path)).toBe(row.target);
      if (row.sensitive) expect(d.touchesSensitiveData, String(row.path)).toBe(true);
      if (row.kind === "write_worktree" && !row.sensitive) expect(d.touchesSensitiveData).toBeUndefined();
    }
  });
});

describe("圈根与解析基分离(评审 90 B-4)", () => {
  it("hook cwd 在 worktree 子目录时,改 worktree 根下的文件仍算圈内", () => {
    const root = mkdtempSync(join(tmpdir(), "saydo-wt-"));
    const sub = join(root, "sub");
    mkdirSync(sub, { recursive: true });
    writeFileSync(join(root, "README.md"), "x");
    // 旧行为:cwd 既当解析基又当圈根 ⇒ /wt/README.md 相对 /wt/sub 在圈外,被误拒
    expect(fileToolToEffect("Write", join(root, "README.md"), sub).kind).not.toBe("write_worktree");
    // 新行为:解析基仍是 cwd,圈根显式传 worktree
    expect(fileToolToEffect("Write", join(root, "README.md"), sub, root).kind).toBe("write_worktree");
    expect(fileToolToEffect("Read", join(root, "README.md"), sub, root).kind).toBe("read");
    rmSync(root, { recursive: true, force: true });
  });

  it("圈根之外仍然圈外(分离不放宽边界)", () => {
    const root = mkdtempSync(join(tmpdir(), "saydo-wt-"));
    const outside = mkdtempSync(join(tmpdir(), "saydo-out-"));
    writeFileSync(join(outside, "a.txt"), "x");
    expect(fileToolToEffect("Write", join(outside, "a.txt"), root, root).kind).not.toBe("write_worktree");
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });
});
