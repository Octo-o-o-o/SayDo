// M6 话术增补验收:④封闭肯定词表(P0 安全防线)+ ①承接层/②深评等待 golden + ③变体三档纪律。

import { describe, expect, it } from "vitest";
import { matchConfirmation, decideConfirmation, buildConfirmPrompt, CONFIRM_YES, CONFIRM_NO } from "../src/approvals/confirmVocab.js";
import { checkGolden, checkNoRepeatedOpeners, M6_GOLDEN } from "../src/brain/golden.js";

describe("M6④ 审批确认封闭肯定词表(sauc 无 confidence 的 P0 防线)", () => {
  it("肯定命中 ⇒ accept;否定 ⇒ reject;无关话/空 ⇒ unmatched(默认拒绝)", () => {
    expect(matchConfirmation("好的")).toBe("accept");
    expect(matchConfirmation("可以,去吧")).toBe("accept");
    expect(matchConfirmation("批准")).toBe("accept");
    expect(matchConfirmation("嗯,可以")).toBe("accept"); // 语气引导 + 肯定词
    expect(matchConfirmation("不要")).toBe("reject");
    expect(matchConfirmation("算了")).toBe("reject");
    expect(matchConfirmation("")).toBe("unmatched");
    expect(matchConfirmation("嗯嗯嗯")).toBe("unmatched"); // 模糊应答不算 accept
    expect(matchConfirmation("不")).toBe("reject");
    // 误拒方向(fail-safe:含"不"子串一律 reject——"不错"是肯定但宁可让用户重说)
    expect(matchConfirmation("今天天气不错")).toBe("reject");
    expect(matchConfirmation("我不太好")).toBe("reject");
  });

  it("A1 回归(2026-07-25 评审):肯定词+否定尾/疑问/夹带实义内容——绝不 accept", () => {
    expect(matchConfirmation("确认不了")).toBe("reject"); // 旧逻辑误判 accept
    expect(matchConfirmation("同意不了")).toBe("reject");
    expect(matchConfirmation("通过不了吧")).toBe("reject");
    expect(matchConfirmation("可以吗?")).toBe("unmatched"); // 反问不是批准
    expect(matchConfirmation("行吗")).toBe("unmatched");
    // Codex 16 A2 回归:全角问号收尾必须 unmatched(sauc 实测回全角标点;旧护栏只认 ASCII ? 会误放行)
    expect(matchConfirmation("可以\uFF1F")).toBe("unmatched");
    expect(matchConfirmation("好\uFF1F")).toBe("unmatched");
    expect(matchConfirmation("可以? ")).toBe("unmatched"); // 半角照旧
    expect(matchConfirmation("没必要说好")).toBe("unmatched"); // 夹带实义内容
    expect(matchConfirmation("好几个问题要先问你")).toBe("unmatched");
    expect(matchConfirmation("确认一下参数再说")).toBe("unmatched");
  });

  it("B1 回归(impl-readback 回收批 2):全角感叹号不再误拒——sauc 回全角标点(ADR-101)", () => {
    expect(matchConfirmation("可以!")).toBe("accept"); // 半角(原本就过)
    expect(matchConfirmation("可以！")).toBe("accept"); // 全角 \uFF01(旧 norm 表漏,系统性误拒)
    expect(matchConfirmation("好！")).toBe("accept");
    expect(matchConfirmation("同意！")).toBe("accept");
    expect(matchConfirmation("批准！")).toBe("accept");
    expect(matchConfirmation("可以？")).toBe("unmatched"); // 疑问护栏不受影响
    expect(matchConfirmation("不行！")).toBe("reject"); // 否定优先不受影响
  });

  it("否定优先(fail-safe):同含肯定与否定 ⇒ reject", () => {
    expect(matchConfirmation("好是好,但是不要动数据库")).toBe("reject");
    expect(matchConfirmation("可以吗?不行")).toBe("reject");
  });

  it("unmatched:第一次复读,第二次转屏(不无限复读)", () => {
    expect(decideConfirmation("啊?", 1).action).toBe("reread");
    expect(decideConfirmation("啊?", 2).action).toBe("to_screen");
    expect(decideConfirmation("确认", 2).action).toBe("accept");
  });

  it("确认文法:复述关键参数(spokenForm)+ 引导封闭词", () => {
    const p = buildConfirmPrompt("要在报表项目里改导出模块、跑测试,影响 3 个文件");
    expect(p).toContain("要在报表项目里改导出模块");
    expect(p).toContain('说"好"或"可以"');
  });

  it('词表重叠("行"⊂"不行")由否定优先消解:行=accept / 不行=reject', () => {
    expect(CONFIRM_YES).toContain("行");
    expect(CONFIRM_NO).toContain("不行");
    expect(matchConfirmation("行")).toBe("accept");
    expect(matchConfirmation("不行")).toBe("reject");
  });
});

describe("M6①② golden(承接层/深评等待)", () => {
  it("M6 golden 全部通过(承接要素/等待条目/心跳/插话应答)", () => {
    for (const c of M6_GOLDEN) {
      const r = checkGolden(c);
      expect(r.reasons, c.id).toEqual([]);
    }
  });
});

describe("M6③ 变体三档·自由池纪律", () => {
  it("禁连续两轮同词开头", () => {
    expect(checkNoRepeatedOpeners(["好,这条记下了", "嗯,继续说", "好,还有吗"]).ok).toBe(true);
    const bad = checkNoRepeatedOpeners(["好,这条记下了", "好,继续"]);
    expect(bad.ok).toBe(false);
    expect(bad.violation).toContain("连续两轮同词开头");
  });
});
