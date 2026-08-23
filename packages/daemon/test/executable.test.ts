import { chmodSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveExecutable } from "../src/config/executable.js";

describe("resolveExecutable", () => {
  it("POSIX 只命中 PATH 中可执行文件", async () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-exec-posix-"));
    const bin = join(dir, "agent");
    writeFileSync(bin, "#!/bin/sh\nexit 0\n");
    chmodSync(bin, 0o755);
    await expect(resolveExecutable("agent", { platform: "darwin", env: { PATH: dir } })).resolves.toBe(realpathSync(bin));
  });

  it("win32 无 which 时按 Path/PATHEXT 命中 exe", async () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-exec-win-exe-"));
    const bin = join(dir, "agent.exe");
    writeFileSync(bin, "fixture");
    await expect(
      resolveExecutable("agent", { platform: "win32", env: { Path: dir, PATHEXT: ".EXE;.CMD" } })
    ).resolves.toBe(realpathSync(bin));
  });

  it("win32 无 which 时按 PATHEXT 命中 cmd", async () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-exec-win-cmd-"));
    const bin = join(dir, "agent.cmd");
    writeFileSync(bin, "@exit /b 0\r\n");
    await expect(
      resolveExecutable("agent", { platform: "win32", env: { PATH: dir, PATHEXT: ".CMD;.EXE" } })
    ).resolves.toBe(realpathSync(bin));
  });

  it("win32 npm 三件套按 PATHEXT 选 .cmd，不误选 extensionless POSIX shim 或 .ps1", async () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-exec-win-npm-shims-"));
    const bare = join(dir, "claude");
    const cmd = join(dir, "claude.cmd");
    const ps1 = join(dir, "claude.ps1");
    writeFileSync(bare, "#!/bin/sh\nexit 0\n");
    writeFileSync(cmd, "@exit /b 0\r\n");
    writeFileSync(ps1, "exit 0\r\n");
    await expect(
      resolveExecutable("claude", { platform: "win32", env: { Path: dir, PATHEXT: ".COM;.EXE;.BAT;.CMD" } })
    ).resolves.toBe(realpathSync(cmd));
  });
});
