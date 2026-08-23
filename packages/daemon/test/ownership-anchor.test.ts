// POSIX 收口走 kill(-pid) 作用于整组,身份锚必须挡住「不是组长」与「不是我们启动的那个命令」。
// win32 由具名 Job 承担同一职责,本文件的 POSIX 例在该平台 skip。
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hostKind } from "@saydo/platform";
import { readOwnedAgentProcessStart } from "../src/tier1/restartPolicy.js";
import {
  assertNoCmdShellMetachars,
  CMD_SHELL_METACHARS,
  resolveRuntimeInvocation,
  runtimeInvocationIdentityTarget
} from "../src/runtimeChildRegistry.js";

const spawned = new Set<number>();
function reap(): void {
  for (const pid of spawned) {
    try { process.kill(pid, "SIGKILL"); } catch { /* 已退出 */ }
  }
  spawned.clear();
}

describe("readOwnedAgentProcessStart 身份锚(A4)", () => {
  it("组长 + 命令行匹配:给出 birth", async () => {
    if (hostKind() === "win32") return;
    const leader = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      detached: true,
      stdio: "ignore"
    });
    await once(leader, "spawn");
    const pid = leader.pid as number;
    spawned.add(pid);
    try {
      expect(readOwnedAgentProcessStart(pid, process.execPath)).toBeTruthy();
    } finally {
      reap();
    }
  });

  it("非组长:即使进程活着也返回 null(不得让 kill(-pid) 落到别人的组上)", async () => {
    if (hostKind() === "win32") return;
    const member = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      detached: false,
      stdio: "ignore"
    });
    await once(member, "spawn");
    const pid = member.pid as number;
    try {
      expect(readOwnedAgentProcessStart(pid, process.execPath)).toBeNull();
    } finally {
      try { member.kill("SIGKILL"); } catch { /* 已退出 */ }
    }
  });

  it("命令行不含期望 binary / commandToken:返回 null", async () => {
    if (hostKind() === "win32") return;
    const leader = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      detached: true,
      stdio: "ignore"
    });
    await once(leader, "spawn");
    const pid = leader.pid as number;
    spawned.add(pid);
    try {
      expect(readOwnedAgentProcessStart(pid, "/nonexistent/other-binary")).toBeNull();
      expect(readOwnedAgentProcessStart(pid, process.execPath, "saydo-child-not-present")).toBeNull();
    } finally {
      reap();
    }
  });

  it("已死 pid 返回 null", () => {
    if (hostKind() === "win32") return;
    expect(readOwnedAgentProcessStart(2_147_483_600, process.execPath)).toBeNull();
  });
});

describe("cmd/bat 参数门(Node 对 Windows shell 是零转义 join)", () => {
  it("干净参数放行", () => {
    expect(() => assertNoCmdShellMetachars(["C:\\bin\\pnpm.cmd", "--ignore-workspace", "run", "test"]))
      .not.toThrow();
  });

  it("命令拼接/重定向/变量展开一律拒绝", () => {
    for (const evil of ["a&calc", "a|b", "a>out", "a<in", "a^b", 'a"b', "%PATH%", "!v!", "a(b)", "a\r\nb"]) {
      expect(() => assertNoCmdShellMetachars(["pnpm.cmd", evil])).toThrow(/fail-closed/u);
    }
  });

  it("元字符表覆盖 cmd 的全部语法字符", () => {
    for (const ch of ["&", "|", "<", ">", "^", '"', "%", "!", "(", ")", "\r", "\n"]) {
      expect(CMD_SHELL_METACHARS.test(ch)).toBe(true);
    }
    for (const ch of ["a", "-", "_", "/", "\\", ":", ".", " ", "="]) {
      expect(CMD_SHELL_METACHARS.test(ch)).toBe(false);
    }
  });

  it("npm node shim 改写为 node.exe 直跑，多行 prompt/settings 原样保留", () => {
    const root = mkdtempSync(join(tmpdir(), "saydo-cmd-shim-"));
    const binDir = join(root, "bin");
    const scriptDir = join(root, "node_modules", "@anthropic-ai", "claude-code");
    mkdirSync(binDir, { recursive: true });
    mkdirSync(scriptDir, { recursive: true });
    const script = join(scriptDir, "cli.js");
    const shim = join(binDir, "claude.cmd");
    writeFileSync(script, "process.exit(0);\n");
    writeFileSync(
      shim,
      '@ECHO off\r\nGOTO start\r\n:find_dp0\r\nSET dp0=%~dp0\r\nEXIT /b\r\n:start\r\nSETLOCAL\r\nCALL :find_dp0\r\n\r\nIF EXIST "%dp0%\\node.exe" (\r\n  SET "_prog=%dp0%\\node.exe"\r\n) ELSE (\r\n  SET "_prog=node"\r\n  SET PATHEXT=%PATHEXT:;.JS;=;%\r\n)\r\n\r\nendLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\..\\node_modules\\@anthropic-ai\\claude-code\\cli.js" %*\r\n'
    );
    const args = ["--settings", '{"hooks":{"PreToolUse":[]}}', "第一行\n第二行"];
    expect(resolveRuntimeInvocation(shim, args, "win32")).toEqual({
      file: process.execPath,
      args: [realpathSync(script), ...args]
    });
    expect(runtimeInvocationIdentityTarget(shim, "win32")).toBe(realpathSync(script));
  });

  it("cmd-shim 9.0.2 / npm 12 当前模板改写为 node.exe，并钉住唯一 JS 入口", () => {
    const root = mkdtempSync(join(tmpdir(), "saydo-cmd-shim-current-"));
    const binDir = join(root, "bin");
    const scriptDir = join(root, "node_modules", "@anthropic-ai", "claude-code");
    mkdirSync(binDir, { recursive: true });
    mkdirSync(scriptDir, { recursive: true });
    const script = join(scriptDir, "cli.js");
    const shim = join(binDir, "claude.cmd");
    writeFileSync(script, "process.exit(0);\n");
    writeFileSync(
      shim,
      '@ECHO off\r\nGOTO start\r\n:find_dp0\r\nSET dp0=%~dp0\r\nEXIT /b\r\n:start\r\nSETLOCAL\r\nCALL :find_dp0\r\n\r\nIF EXIST "%dp0%\\node.exe" (\r\n  SET "_prog=%dp0%\\node.exe"\r\n) ELSE (\r\n  SET "_prog=node"\r\n)\r\n\r\nendLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & set PATHEXT=%PATHEXT:;.JS;=;% & "%_prog%"  "%dp0%\\..\\node_modules\\@anthropic-ai\\claude-code\\cli.js" %*\r\n'
    );
    expect(resolveRuntimeInvocation(shim, ["--version"], "win32")).toEqual({
      file: process.execPath,
      args: [realpathSync(script), "--version"]
    });
    expect(runtimeInvocationIdentityTarget(shim, "win32")).toBe(realpathSync(script));
  });

  it("不能证明为 npm node shim 的 cmd/bat 一律拒绝", () => {
    const root = mkdtempSync(join(tmpdir(), "saydo-cmd-reject-"));
    const shim = join(root, "claude.cmd");
    writeFileSync(shim, "@echo off\r\ncalc.exe %*\r\n");
    expect(() => resolveRuntimeInvocation(shim, ["hello"], "win32")).toThrow(/仅支持可证明/u);
  });

  it("npm 模板中夹带额外命令时不得只抽取最后一行放行", () => {
    const root = mkdtempSync(join(tmpdir(), "saydo-cmd-extra-command-"));
    const shim = join(root, "saydo.cmd");
    const script = join(root, "cli.mjs");
    writeFileSync(script, "process.exit(0);\n");
    writeFileSync(
      shim,
      '@ECHO off\r\nGOTO start\r\n:find_dp0\r\nSET dp0=%~dp0\r\nEXIT /b\r\n:start\r\nSETLOCAL\r\nCALL :find_dp0\r\ncalc.exe\r\n\r\nIF EXIST "%dp0%\\node.exe" (\r\n  SET "_prog=%dp0%\\node.exe"\r\n) ELSE (\r\n  SET "_prog=node"\r\n  SET PATHEXT=%PATHEXT:;.JS;=;%\r\n)\r\n\r\nendLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\cli.mjs" %*\r\n'
    );
    expect(() => resolveRuntimeInvocation(shim, ["hello"], "win32")).toThrow(/仅支持可证明/u);
  });
});
