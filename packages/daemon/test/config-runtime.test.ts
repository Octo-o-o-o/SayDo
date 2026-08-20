// impl-readback 回收批 2(B4):"配置不可读 != 配置未写"——损坏朝紧,缺失走缺省。

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readGate0FromFile, readStartupLiveConfig } from "../src/config/runtime.js";

const VALID = `
[models]
dialog = "openrouter/qwen"
thinking = "openrouter/qwen"
cheap = "openrouter/qwen"
evaluator = "openrouter/deepseek"

[privacy]
store_transcript = false

[gate0]
enabled = true
bypass = false
`;

function tmp(name: string, content?: string): string {
  const dir = mkdtempSync(join(tmpdir(), "saydo-cfg-"));
  const p = join(dir, name);
  if (content !== undefined) writeFileSync(p, content);
  return p;
}

describe("配置读取 fail-closed 方向(B4)", () => {
  it("缺失(ENOENT)= 首启合法:startup 走缺省(store_transcript=true 是 canonical 缺省),gate0 出厂缺省", () => {
    const p = join(mkdtempSync(join(tmpdir(), "saydo-cfg-")), "config.toml"); // 不创建文件
    const live = readStartupLiveConfig(p);
    expect(live.storeTranscript).toBe(true);
    const g = readGate0FromFile(p);
    expect(g).toMatchObject({ enabled: true, bypass: false, failClosedReason: null });
  });

  it("存在但解析失败 = 启动拒(与 [params] 非法同律)——防 storeTranscript 静默翻回 true(G6 同意翻转)", () => {
    const p = tmp("config.toml", "[privacy\nstore_transcript = false"); // 坏 TOML
    expect(() => readStartupLiveConfig(p)).toThrow(/解析失败.*拒启动/);
  });

  it("存在但解析失败 = 运行期 Gate 0 fail-closed(enabled:false 拒 dispatch)并给出原因", () => {
    const p = tmp("config.toml", "gate0 = not-a-table ===");
    const g = readGate0FromFile(p);
    expect(g.enabled).toBe(false);
    expect(g.bypass).toBe(false);
    expect(g.failClosedReason).toMatch(/损坏/);
  });

  it("合法配置照常读取(owner 显式 store_transcript=false 不被翻转)", () => {
    const p = tmp("config.toml", VALID);
    expect(readStartupLiveConfig(p).storeTranscript).toBe(false);
    expect(readGate0FromFile(p)).toMatchObject({ enabled: true, bypass: false, failClosedReason: null });
  });
});
