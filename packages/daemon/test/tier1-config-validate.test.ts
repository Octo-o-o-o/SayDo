// W2 阶段0-②/③(Codex 20 B2/B3;§12-9 正反例):Tier1 配置集中校验 + 启动资格裁决。
// fail-closed 谱:相对路径 / 文件缺失 / 非常规文件 / 不可执行 / 非 versions/<ver>/ 形态 /
// 版本非精确相等 / 非 cursor 后端配置——全部拒;正例:锁定副本形态 + 精确版本。

import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertExactVersion, tier1StartupVerdict, validateTier1Config } from "../src/tier1/validateConfig.js";

/** 构造锁定副本形态:<root>/versions/<ver>/cursor-agent(0o755) */
function makeLockedCopy(ver: string, opts: { executable?: boolean } = {}): string {
  const root = mkdtempSync(join(tmpdir(), "saydo-t1cfg-"));
  const dir = join(root, "versions", ver);
  mkdirSync(dir, { recursive: true });
  const bin = join(dir, "cursor-agent");
  writeFileSync(bin, "#!/bin/bash\necho fake\n");
  chmodSync(bin, opts.executable === false ? 0o644 : 0o755);
  return bin;
}

describe("validateTier1Config(B2 §12-9)", () => {
  it("正例:versions/<ver>/ 下可执行常规文件 ⇒ ok", () => {
    const bin = makeLockedCopy("1.2.3-abc");
    expect(validateTier1Config({ cursorAgentBin: bin, pinnedVersion: "1.2.3-abc" })).toEqual({ ok: true });
  });

  it("反例:相对路径 ⇒ bin_not_absolute(裸名走 PATH 随 symlink 漂移,pin 红线)", () => {
    const v = validateTier1Config({ cursorAgentBin: "cursor-agent", pinnedVersion: "1.2.3" });
    expect(v).toMatchObject({ ok: false, code: "bin_not_absolute" });
  });

  it("反例:文件不存在 ⇒ bin_missing", () => {
    const v = validateTier1Config({ cursorAgentBin: "/nonexistent/versions/1.2.3/cursor-agent", pinnedVersion: "1.2.3" });
    expect(v).toMatchObject({ ok: false, code: "bin_missing" });
  });

  it("反例:是目录不是常规文件 ⇒ bin_not_file", () => {
    const root = mkdtempSync(join(tmpdir(), "saydo-t1cfg-"));
    const dir = join(root, "versions", "1.2.3", "cursor-agent");
    mkdirSync(dir, { recursive: true });
    const v = validateTier1Config({ cursorAgentBin: dir, pinnedVersion: "1.2.3" });
    expect(v).toMatchObject({ ok: false, code: "bin_not_file" });
  });

  it.skipIf(process.platform === "win32")("反例:不可执行 ⇒ bin_not_executable", () => {
    const bin = makeLockedCopy("1.2.3", { executable: false });
    const v = validateTier1Config({ cursorAgentBin: bin, pinnedVersion: "1.2.3" });
    expect(v).toMatchObject({ ok: false, code: "bin_not_executable" });
  });

  it("反例:目录形态不是 versions/<pinned>/ ⇒ bin_not_versions_layout(两型:版本目录名不符 / 无 versions 段)", () => {
    // 版本目录名与 pinned 不符(配了别的版本副本)
    const bin = makeLockedCopy("2.0.0");
    expect(validateTier1Config({ cursorAgentBin: bin, pinnedVersion: "1.2.3" })).toMatchObject({
      ok: false,
      code: "bin_not_versions_layout"
    });
    // 无 versions 段(如 symlink 入口 ~/.local/bin/cursor-agent)
    const root = mkdtempSync(join(tmpdir(), "saydo-t1cfg-"));
    const flat = join(root, "cursor-agent");
    writeFileSync(flat, "#!/bin/bash\n");
    chmodSync(flat, 0o755);
    expect(validateTier1Config({ cursorAgentBin: flat, pinnedVersion: "1.2.3" })).toMatchObject({
      ok: false,
      code: "bin_not_versions_layout"
    });
  });

  it("反例:pinned 空串 ⇒ pinned_version_empty", () => {
    const bin = makeLockedCopy("1.2.3");
    expect(validateTier1Config({ cursorAgentBin: bin, pinnedVersion: " " })).toMatchObject({
      ok: false,
      code: "pinned_version_empty"
    });
  });
});

describe("assertExactVersion(B2-④ 精确相等,替换 includes())", () => {
  it("正例:输出裸版本串(实测 --version 形态)精确相等 ⇒ 通过;带尾换行 trim 后通过", () => {
    expect(() => assertExactVersion("2026.07.23-e383d2b", "2026.07.23-e383d2b")).not.toThrow();
    expect(() => assertExactVersion("2026.07.23-e383d2b\n", "2026.07.23-e383d2b")).not.toThrow();
  });

  it("反例:includes 能过但非精确相等的漂移串 ⇒ 抛(-dirty 后缀 / 前后缀包装)", () => {
    expect(() => assertExactVersion("2026.07.23-e383d2b-dirty", "2026.07.23-e383d2b")).toThrow(/版本漂移/);
    expect(() => assertExactVersion("cursor-agent 2026.07.23-e383d2b", "2026.07.23-e383d2b")).toThrow(/版本漂移/);
  });
});

describe("tier1StartupVerdict(B3 启动资格;含启动断言用例)", () => {
  it("两键缺任一 ⇒ not_configured(与既有 fail-closed 不认领一致)", () => {
    expect(tier1StartupVerdict({ adapter: "cursor" })).toMatchObject({ start: false, code: "not_configured" });
    expect(tier1StartupVerdict({ cursorAgentBin: "/x/versions/1/cursor-agent", adapter: "cursor" })).toMatchObject({
      start: false,
      code: "not_configured"
    });
  });

  it("B3 反例:agent=claude_code / codex 配置 ⇒ unsupported_adapter 拒起(此前仍起 cursor 二进制)", () => {
    const bin = makeLockedCopy("1.2.3");
    for (const adapter of ["claude_code", "codex"]) {
      const v = tier1StartupVerdict({ cursorAgentBin: bin, pinnedVersion: "1.2.3", adapter });
      expect(v).toMatchObject({ start: false, code: "unsupported_adapter" });
      expect(String((v as { reason?: string }).reason)).toContain(adapter);
    }
  });

  it("正例:cursor + 锁定副本齐备 ⇒ start", () => {
    const bin = makeLockedCopy("1.2.3");
    expect(tier1StartupVerdict({ cursorAgentBin: bin, pinnedVersion: "1.2.3", adapter: "cursor" })).toEqual({
      start: true,
      bin,
      pinned: "1.2.3"
    });
  });

  it("B2 反例经 verdict 透传:形态错 ⇒ start=false 且带 B2 code", () => {
    const bin = makeLockedCopy("9.9.9");
    expect(tier1StartupVerdict({ cursorAgentBin: bin, pinnedVersion: "1.2.3", adapter: "cursor" })).toMatchObject({
      start: false,
      code: "bin_not_versions_layout"
    });
  });
});
