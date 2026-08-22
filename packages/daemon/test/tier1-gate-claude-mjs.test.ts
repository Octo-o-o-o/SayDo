// W5.4-b x W-Win 合并后补:win32 claude 门脚本(gate-claude.mjs)必须与 POSIX gate-claude.sh
// 同分支——Bash/Write/Edit/NotebookEdit/Read 四路 + allow/deny/no_decision 三态 + 圈外预筛。
// 本文件在任意平台跑:只对「生成的脚本正文」做结构断言与 pathOutside 行为断言,不起进程。
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildClaudeGateMjs, buildClaudeGateScript } from "../src/tier1/gateScript.js";

const WIN_BIND = "C:\\Users\\t\\.saydo\\tier1\\gate-bind.json";
const WIN_SECRET = "C:\\Users\\t\\.saydo\\tier1\\gate-secret";
const WIN_LOG = "C:\\Users\\t\\.saydo\\tier1\\gate-fired.log";
const mjs = buildClaudeGateMjs(WIN_BIND, WIN_SECRET, WIN_LOG);
const sh = buildClaudeGateScript("/tmp/x.sock", "/tmp/x.log");

describe("gate-claude.mjs 与 gate-claude.sh 分支对齐(合并回归锚)", () => {
  it("四个工具分支都在,不再只认 Bash", () => {
    for (const tool of ["Bash", "Write", "Edit", "NotebookEdit", "Read"]) {
      expect(mjs).toContain(`"${tool}"`);
      expect(sh).toContain(tool);
    }
  });

  it("三种 wire kind 都会发出", () => {
    for (const kind of ["command", "file_write", "file_read"]) {
      expect(mjs).toContain(`kind: "${kind}"`);
      expect(sh).toContain(`kind:"${kind}"`);
    }
  });

  it("三态齐备:allow / deny / no_decision", () => {
    expect(mjs).toContain('=== "no_decision"');
    expect(mjs).toContain("emitNoDecision");
    expect(sh).toContain("no_decision");
    expect(sh).toContain("emit_nodecision");
  });

  it("越界向量预筛在文件两路都先于 post 执行(圈根无关的那部分)", () => {
    expect(mjs).toContain('emitDeny("path traversal (fail-closed)")');
    expect(sh).toContain('emit_deny "path traversal (fail-closed)"');
  });

  it("两端都不再判「绝对路径是否在 cwd 下」(圈内外归 daemon 单点裁决)", () => {
    // owner 2026-08-22 裁决「现在就真对齐」:脚本手里只有 hook 的 cwd,
    // 而 daemon 允许 cwd 落在 worktree 子目录——拿 cwd 当圈根会误拒圈内文件
    expect(mjs).not.toContain("pathOutside");
    expect(sh).not.toContain("path_outside");
  });

  it("生成的脚本是合法 JS(node --check)", () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-gate-mjs-"));
    const f = join(dir, "gate-claude.mjs");
    writeFileSync(f, mjs);
    expect(() => execFileSync(process.execPath, ["--check", f])).not.toThrow();
  });
});

describe("pathTraversal(从生成脚本里取出来直接跑;两端语义一致)", () => {
  const src = mjs.slice(mjs.indexOf("function pathTraversal"), mjs.indexOf("async function decide"));
  const pathTraversal = new Function(`${src}; return pathTraversal;`)() as (p: string) => boolean;

  it("越界向量一律判 true(与圈根无关)", () => {
    for (const p of [
      "C:\\wt\\..\\other\\a.ts",
      "..",
      "../a.ts",
      "sub/../../a.ts",
      "~\\a.ts",
      "%USERPROFILE%\\a.ts",
      "$HOME/a.ts",
      "${HOME}/a.ts",
      ""
    ]) {
      expect(pathTraversal(p)).toBe(true);
    }
  });

  it("普通路径判 false——包括圈外绝对路径(交给 daemon 裁决)与含连续点的合法文件名", () => {
    for (const p of [
      "C:\\wt\\src\\a.ts",
      "src\\a.ts",
      "C:\\other\\a.ts", // 圈外:脚本不再预拒,daemon 会拒
      "C:\\wt\\foo..bar", // 评审 92 新 C:合法文件名不该被误拒
      "/tmp/wt/foo..bar"
    ]) {
      expect(pathTraversal(p)).toBe(false);
    }
  });
});
