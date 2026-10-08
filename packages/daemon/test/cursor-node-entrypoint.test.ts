import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { assertRuntimeChildExactEmpty, configureRuntimeChildRegistry, execAgentFileSync, execRuntimeChild, resolveRuntimeInvocation } from "../src/runtimeChildRegistry.js";
import { cursorNodeEntrypoint } from "../src/tier1/cursorNodeEntrypoint.js";
import { validateTier1Config } from "../src/tier1/validateConfig.js";

const root = mkdtempSync(join(tmpdir(), "saydo-cursor-native-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));
let seq = 0;
function fixture(): { script: string; runtime: string; dir: string } {
  const dir = join(root, String(seq++), "versions", "2026.10.01-e373342");
  mkdirSync(dir, { recursive: true });
  const script = join(dir, "index.js");
  const runtime = join(dir, "node.exe");
  writeFileSync(script, "console.log(JSON.stringify(process.argv.slice(2)))");
  writeFileSync(runtime, "占位运行时");
  return { script, runtime, dir };
}

describe("Cursor Windows 原生 Node 入口", () => {
  it("同目录运行时与原始多行参数保留，不借用宿主 Node 或 shell", () => {
    const f = fixture();
    const args = ["--model", "auto", '第一行\n第二行 & | %PATH% ! x "双引号"'];
    expect(resolveRuntimeInvocation(f.script, args, "win32")).toEqual({ file: f.runtime, args: [f.script, ...args] });
    expect(args).toHaveLength(3);
    expect(resolveRuntimeInvocation(f.script, args, "linux")).toEqual({ file: f.script, args });
  });
  it("运行时缺失、入口或运行时变为目录均拒绝，每次调用重验", () => {
    const f = fixture();
    expect(cursorNodeEntrypoint(f.script).file).toBe(f.runtime);
    rmSync(f.runtime);
    expect(() => resolveRuntimeInvocation(f.script, [], "win32")).toThrow();
    mkdirSync(f.runtime);
    expect(() => cursorNodeEntrypoint(f.script)).toThrow();
    rmSync(f.script);
    mkdirSync(f.script);
    expect(() => cursorNodeEntrypoint(f.script)).toThrow();
  });
  it("版本目录链接拒绝，包括 Windows junction", () => {
    const f = fixture();
    const link = join(root, String(seq++), "versions", "2026.10.01-e373342");
    mkdirSync(join(link, ".."), { recursive: true });
    symlinkSync(f.dir, link, process.platform === "win32" ? "junction" : "dir");
    expect(() => cursorNodeEntrypoint(join(link, "index.js"))).toThrow();
  });
  it("相对或未锁定版本目录入口拒绝，其他常规调用不受影响", () => {
    expect(() => cursorNodeEntrypoint("versions/ver/index.js")).toThrow();
    expect(() => cursorNodeEntrypoint(join(root, "index.js"))).toThrow();
    const file = join(root, "cursor-agent.exe");
    expect(resolveRuntimeInvocation(file, ["--version"], "win32")).toEqual({ file, args: ["--version"] });
  });
  it.skipIf(process.platform !== "win32")("Windows 配置接受版本原生入口，pin 不匹配与脚本包装入口仍拒绝", () => {
    const f = fixture();
    expect(validateTier1Config({ cursorAgentBin: f.script, pinnedVersion: "2026.10.01-e373342" })).toEqual({ ok: true });
    expect(validateTier1Config({ cursorAgentBin: f.script, pinnedVersion: "other" }).ok).toBe(false);
    const wrapper = join(f.dir, "cursor-agent.cmd");
    writeFileSync(wrapper, "@echo off");
    expect(validateTier1Config({ cursorAgentBin: wrapper, pinnedVersion: "2026.10.01-e373342" }).ok).toBe(false);
  });
  it.skipIf(process.platform !== "win32")("真实同步启动入口保留特殊字符与多行参数", () => {
    const f = fixture();
    copyFileSync(process.execPath, f.runtime);
    const args = ['中文\n& | %PATH% ! ^ () "quoted"', "--version"];
    const output = execAgentFileSync(f.script, args, { encoding: "utf8", timeout: 15_000 });
    expect(JSON.parse(output)).toEqual(args);
  });
  it.skipIf(process.platform !== "win32")("真实 Windows Job 执行与收口保留参数并清空归属", async () => {
    const f = fixture();
    copyFileSync(process.execPath, f.runtime);
    configureRuntimeChildRegistry(join(root, "runtime-home"));
    const args = ['第一行\n第二行 & | %PATH% "quoted"'];
    const output = await execRuntimeChild(f.script, args, { timeout: 15_000 });
    expect(JSON.parse(output.stdout)).toEqual(args);
    expect(output.stderr).toBe("");
    expect(() => assertRuntimeChildExactEmpty()).not.toThrow();
  }, 25_000);
});
