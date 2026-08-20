// 5.3 golden 覆盖矩阵(10 §6):文本注入级 >=20 条,覆盖 §2 全部 P0 场景含逆风
// (Gate 0 拒绝/预算不足/merge 失败/撤回/不置可否/熔断);断言 = 模板要素 + 状态词零违规。

import { describe, expect, it } from "vitest";
import { checkGolden, COVERAGE_GOLDEN, M6_GOLDEN, P05_GOLDEN, PHASE1_GOLDEN, SESSION1_GOLDEN, W4_GOLDEN } from "../src/brain/golden.js";

const ALL = [...PHASE1_GOLDEN, ...M6_GOLDEN, ...COVERAGE_GOLDEN, ...P05_GOLDEN, ...SESSION1_GOLDEN, ...W4_GOLDEN];

describe("golden 覆盖矩阵(5.3)", () => {
  it("总量 >=20 条(10 §6 P0 文本注入级)", () => {
    expect(ALL.length).toBeGreaterThanOrEqual(20);
  });

  it("全部用例通过(模板要素 + 状态词红线)", () => {
    for (const c of ALL) {
      const r = checkGolden(c);
      expect(r.reasons, `${c.id} ${c.scene}`).toEqual([]);
    }
  });

  it("逆风场景齐:Gate0 拒绝/预算不足/熔断/merge 失败/撤回/不置可否", () => {
    const scenes = ALL.map((c) => c.scene).join("|");
    for (const kw of ["Gate 0", "预算不足", "熔断", "merge 失败", "撤回", "不置可否"]) {
      expect(scenes, kw).toContain(kw);
    }
  });

  it("场景号覆盖清单(§2 P0 行;#7 停用注记/#12+#39 P0.5/#22/#25 P0.5 路径二除外)", () => {
    const ids = new Set(ALL.map((c) => c.scene.split(" ")[0]));
    // §2.1-2.4 的 P0 文本注入可覆盖行(音频级行为类——#42 等待触发/打断——归音频烟测)
    const expected = ["#1", "#2", "#3", "#4", "#5", "#6", "#8", "#9", "#10", "#11", "#13", "#14", "#15", "#16", "#17", "#18", "#19", "#20", "#21", "#23", "#24", "#26", "#27", "#28", "#29", "#29b", "#30", "#31", "#32", "#33", "#34", "#35", "#38", "#40"];
    for (const e of expected) {
      expect([...ids].some((s) => s === e || s?.startsWith(e)), e).toBe(true);
    }
  });

  it("零 emoji(11 §12:话术资产不带 pictographic)", () => {
    for (const c of ALL) {
      expect(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(c.utterance), c.id).toBe(false);
    }
  });

  it("W4 3.3:writing/S3 卡场景扩位(content_done 完成 + S3 #20 卡片 P1 + writing 回叫)", () => {
    const scenes = W4_GOLDEN.map((c) => c.scene).join("|");
    expect(scenes).toContain("content_done");
    expect(scenes).toContain("S3 导航·P1 卡片版");
    for (const c of W4_GOLDEN) expect(checkGolden(c).reasons, c.id).toEqual([]);
  });
});
