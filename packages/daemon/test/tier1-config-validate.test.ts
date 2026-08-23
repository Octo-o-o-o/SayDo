// W2 阶段0-②/③(Codex 20 B2/B3;§12-9 正反例):Tier1 配置集中校验 + 启动资格裁决。
// fail-closed 谱:相对路径 / 文件缺失 / 非常规文件 / 不可执行 / 非 versions/<ver>/ 形态 /
// 版本非精确相等 / 非 cursor 后端配置——全部拒;正例:锁定副本形态 + 精确版本。
// W5.4-b C1:verdict 先按生效 adapter 分叉;claude_code 走 claude 分支(四键+族+identity,
// 任一不满足 ⇒ not_configured + 处方化键名);codex 维持 unsupported_adapter。

import { chmodSync, mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertExactVersion, tier1StartupVerdict, validateTier1Config } from "../src/tier1/validateConfig.js";
import type { ClaudeIdentityVerdict } from "../src/tier1/claudeIdentity.js";

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

/** 构造 claude 实体文件形态(claude 无 versions/ 布局要求,单文件即可) */
function makeClaudeBin(opts: { executable?: boolean } = {}): string {
  const root = mkdtempSync(join(tmpdir(), "saydo-t1claude-"));
  const bin = join(root, "claude.exe");
  writeFileSync(bin, "#!/bin/bash\necho fake claude\n");
  chmodSync(bin, opts.executable === false ? 0o644 : 0o755);
  return bin;
}

function identityOk(bin: string): ClaudeIdentityVerdict {
  return {
    ok: true,
    record: {
      binaryPath: bin,
      binaryDigest: "a".repeat(64),
      version: "2.1.220",
      testedAt: "2026-08-21T00:00:00.000Z",
      receipt: {}
    }
  };
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

  // W5.4-b C1 白名单改动(方案 §3.9 点名,IMPL-PROMPT-15 §2 红线 7):
  // 改动 1 = claude_code 从 unsupported_adapter 改为 not_configured + 处方含 claude 键名;
  // 改动 2 = codex 维持 unsupported_adapter(期望不变,仅从合并循环拆出独立断言)。
  it("agent=claude_code 未配四键 ⇒ not_configured + 处方含 claude 键名(W5.4-b 起 claude 是受支持后端)", () => {
    const bin = makeLockedCopy("1.2.3");
    const v = tier1StartupVerdict({ cursorAgentBin: bin, pinnedVersion: "1.2.3", adapter: "claude_code" });
    expect(v).toMatchObject({ start: false, code: "not_configured" });
    const reason = String((v as { reason?: string }).reason);
    expect(reason).toContain("claude_bin");
    expect(reason).toContain("claude_pinned_version");
    expect(reason).toContain("model");
  });

  it("B3 反例:agent=codex 配置 ⇒ unsupported_adapter 拒起(维持;此前仍起 cursor 二进制)", () => {
    const bin = makeLockedCopy("1.2.3");
    const v = tier1StartupVerdict({ cursorAgentBin: bin, pinnedVersion: "1.2.3", adapter: "codex" });
    expect(v).toMatchObject({ start: false, code: "unsupported_adapter" });
    expect(String((v as { reason?: string }).reason)).toContain("codex");
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

describe("tier1StartupVerdict claude 分支(W5.4-b C1;方案 §3.9/§3.7,09 §11 claude_code 承载段)", () => {
  const PINNED = "2.1.220";

  it("claude 键全缺 ⇒ not_configured,处方一次性点名三键", () => {
    const v = tier1StartupVerdict({ adapter: "claude_code" });
    expect(v).toMatchObject({ start: false, code: "not_configured" });
    const reason = String((v as { reason?: string }).reason);
    expect(reason).toContain("claude_bin");
    expect(reason).toContain("claude_pinned_version");
    expect(reason).toContain("model");
  });

  it("部分缺(只配 bin)⇒ not_configured,处方点名缺的两键", () => {
    const bin = makeClaudeBin();
    const v = tier1StartupVerdict({ adapter: "claude_code", claude: { bin } });
    expect(v).toMatchObject({ start: false, code: "not_configured" });
    const reason = String((v as { reason?: string }).reason);
    expect(reason).toContain("claude_pinned_version");
    expect(reason).toContain("model");
    expect(reason).not.toMatch(/缺 [^;]*claude_bin/);
  });

  it("pinned 空串按缺失处理 ⇒ not_configured 点名 claude_pinned_version", () => {
    const bin = makeClaudeBin();
    const v = tier1StartupVerdict({
      adapter: "claude_code",
      claude: { bin, pinnedVersion: "  ", model: "opus" }
    });
    expect(v).toMatchObject({ start: false, code: "not_configured" });
    expect(String((v as { reason?: string }).reason)).toContain("claude_pinned_version");
  });

  it("bin 相对路径 ⇒ not_configured(裸名走 PATH 不满足 pin)", () => {
    const v = tier1StartupVerdict({
      adapter: "claude_code",
      claude: { bin: "claude", pinnedVersion: PINNED, model: "opus", identity: identityOk("claude") }
    });
    expect(v).toMatchObject({ start: false, code: "not_configured" });
    expect(String((v as { reason?: string }).reason)).toContain("绝对路径");
  });

  it("bin 文件不存在 ⇒ not_configured", () => {
    const v = tier1StartupVerdict({
      adapter: "claude_code",
      claude: { bin: "/nonexistent/claude.exe", pinnedVersion: PINNED, model: "opus" }
    });
    expect(v).toMatchObject({ start: false, code: "not_configured" });
    expect(String((v as { reason?: string }).reason)).toContain("不存在");
  });

  it("bin 不可执行 ⇒ not_configured", () => {
    const bin = makeClaudeBin({ executable: false });
    const v = tier1StartupVerdict({
      adapter: "claude_code",
      claude: { bin, pinnedVersion: PINNED, model: "opus" }
    });
    expect(v).toMatchObject({ start: false, code: "not_configured" });
    expect(String((v as { reason?: string }).reason)).toContain("不可执行");
  });

  it("model 非 claude 族(gpt-5.6-sol)⇒ not_configured + 族处方(familyFromModelName 单源判定)", () => {
    const bin = makeClaudeBin();
    const v = tier1StartupVerdict({
      adapter: "claude_code",
      claude: { bin, pinnedVersion: PINNED, model: "gpt-5.6-sol", identity: identityOk(bin) }
    });
    expect(v).toMatchObject({ start: false, code: "not_configured" });
    expect(String((v as { reason?: string }).reason)).toContain("claude 族");
  });

  it("model 别名 opus/sonnet/haiku/fable 与 claude-* 前缀全过族检查(identity 齐备时 start)", () => {
    const bin = makeClaudeBin();
    for (const model of ["opus", "sonnet", "haiku", "fable", "claude-opus-5"]) {
      const v = tier1StartupVerdict({
        adapter: "claude_code",
        claude: { bin, pinnedVersion: PINNED, model, identity: identityOk(bin) }
      });
      expect(v).toEqual({ start: true, bin: realpathSync(bin), pinned: PINNED });
    }
  });

  it("identity 未注入(登记缺失)⇒ not_configured + 自检处方", () => {
    const bin = makeClaudeBin();
    const v = tier1StartupVerdict({
      adapter: "claude_code",
      claude: { bin, pinnedVersion: PINNED, model: "opus" }
    });
    expect(v).toMatchObject({ start: false, code: "not_configured" });
    const reason = String((v as { reason?: string }).reason);
    expect(reason).toContain("identity");
    expect(reason).toContain("scope");
  });

  it("identity 核验不通过(digest 漂移)⇒ not_configured + 透传核验 detail", () => {
    const bin = makeClaudeBin();
    const v = tier1StartupVerdict({
      adapter: "claude_code",
      claude: {
        bin,
        pinnedVersion: PINNED,
        model: "opus",
        identity: { ok: false, code: "digest_mismatch", detail: "claude 二进制 digest 与登记不符(身份漂移)" }
      }
    });
    expect(v).toMatchObject({ start: false, code: "not_configured" });
    expect(String((v as { reason?: string }).reason)).toContain("身份漂移");
  });

  it("全齐 ⇒ start:true 且 bin/pinned 取 claude 键(输出形状与 cursor 分支同构)", () => {
    const bin = makeClaudeBin();
    const v = tier1StartupVerdict({
      adapter: "claude_code",
      claude: { bin, pinnedVersion: PINNED, model: "opus", identity: identityOk(bin) }
    });
    expect(v).toEqual({ start: true, bin: realpathSync(bin), pinned: PINNED });
  });

  it.skipIf(process.platform === "win32")("claude 配置 symlink 解析到实体后启动", () => {
    const bin = makeClaudeBin();
    const alias = `${bin}-current`;
    symlinkSync(bin, alias, "file");
    const v = tier1StartupVerdict({
      adapter: "claude_code",
      claude: { bin: alias, pinnedVersion: PINNED, model: "opus", identity: identityOk(realpathSync(bin)) }
    });
    expect(v).toEqual({ start: true, bin: realpathSync(bin), pinned: PINNED });
  });

  it("分叉纪律:claude 分支不消费 cursor 两键,cursor 分支不消费 claude 键", () => {
    const claudeBin = makeClaudeBin();
    const cursorBin = makeLockedCopy("1.2.3");
    // claude 生效:cursor 两键齐备也不影响 claude 分支裁决
    expect(
      tier1StartupVerdict({
        cursorAgentBin: cursorBin,
        pinnedVersion: "1.2.3",
        adapter: "claude_code",
        claude: { bin: claudeBin, pinnedVersion: PINNED, model: "opus", identity: identityOk(claudeBin) }
      })
    ).toEqual({ start: true, bin: realpathSync(claudeBin), pinned: PINNED });
    // cursor 生效:claude 键齐备也不影响 cursor 分支裁决(形状不变)
    expect(
      tier1StartupVerdict({
        cursorAgentBin: cursorBin,
        pinnedVersion: "1.2.3",
        adapter: "cursor",
        claude: { bin: claudeBin, pinnedVersion: PINNED, model: "opus", identity: identityOk(claudeBin) }
      })
    ).toEqual({ start: true, bin: cursorBin, pinned: "1.2.3" });
  });
});
