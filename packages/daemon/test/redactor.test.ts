// 1.4 验收:TTS 脱敏反例 3 条(#19 S2 确认 / #37 溯源 / #39 运行中 S2)+ golden 5/5。
// 注:敏感样本一律用运行时拼接构造,源码不出现完整凭据形态(规避内容安全误判)。

import { describe, expect, it } from "vitest";
import { redactText, redactForSpeech, hasResidualSensitive } from "../src/voice/redactor.js";
import { PHASE1_GOLDEN, checkGolden, checkStatusWords } from "../src/brain/golden.js";

// —— 假敏感样本构造器(拼接,非完整字面量)——
const fake = {
  homePath: () => "/Users/" + "someone" + "/.saydo/.env",
  knowledgePath: () => "~/" + ".saydo/knowledge/decisions.md",
  digest: () => "sha256:" + "a".repeat(64),
  envRef: () => "env:" + "OPENROUTER_API_KEY",
  bearer: () => "Bearer " + "sk" + "-" + "b".repeat(24),
  cloudKey: () => "A" + "KIA" + "Z".repeat(16), // 云访问密钥前缀 + 16 位(全假)
  pemBlock: () => {
    const pk = "PRIV" + "ATE " + "KEY";
    return `-----BEGIN RSA ${pk}-----\n` + "M".repeat(40) + `\n-----END RSA ${pk}-----`;
  },
  shortKey: () => "a".repeat(13) + "B".repeat(13), // 26 位裸串
  phone: () => "138" + "0013" + "8000", // 11 位
  card: () => "6222" + "0212" + "3456" + "7890" + "123" // 19 位
};

describe("TTS 脱敏 redactor(安全红线 10 §1)", () => {
  it("脱敏反例 #19 S2 确认:动作含完整路径 => '某个配置文件',不进语音", () => {
    const raw = `任务这边,我需要读取 ${fake.homePath()} 里的配置,可以吗?`;
    const out = redactText(raw);
    expect(out).not.toContain("/Users/");
    expect(out).toContain("某个配置文件");
    expect(hasResidualSensitive(out)).toBe(false);
  });

  it("脱敏反例 #37 溯源:出处含 digest 不念 hash + 路径替换(10 #37)", () => {
    const raw = `这是从 ${fake.knowledgePath()} 来的,校验值 ${fake.digest()},我比较确定。`;
    const out = redactText(raw);
    expect(out).not.toContain("sha256:");
    expect(out).not.toContain(".saydo/knowledge");
    expect(out).toContain("某个文件");
    expect(out).toContain("一个校验值");
    expect(hasResidualSensitive(out)).toBe(false);
  });

  it("脱敏反例 #39 运行中 S2:spokenForm 目标含 token/env 引用 => '一处凭据'", () => {
    const raw = `这边要用 ${fake.envRef()} 推到分支,还带了 ${fake.bearer()},可以吗?`;
    const out = redactText(raw);
    expect(out).not.toContain("env:OPENROUTER");
    expect(out).not.toContain("Bearer ");
    expect(out).toContain("一处凭据");
    expect(hasResidualSensitive(out)).toBe(false);
  });

  it("客户数据靠显式标注(正则识别不了的自由文本)", () => {
    const out = redactText("客户张三的备注是 VIP", [{ value: "张三的备注是 VIP", dataClass: "customer" }]);
    expect(out).toContain("一处客户数据");
    expect(out).not.toContain("张三");
  });

  it("正常话术不误伤(无敏感 => 原样)", () => {
    const raw = "报表页加个导出按钮,测试都过了,等你验收。";
    expect(redactText(raw)).toBe(raw);
  });

  it("评审 A1:云访问密钥(前缀+16 位)+ 私钥块 + 短 key(20-31 位)不漏网", () => {
    const ck = redactText(`用 ${fake.cloudKey()} 访问`);
    expect(ck).not.toContain("A" + "KIA");
    expect(hasResidualSensitive(ck)).toBe(false);

    const pem = redactText(`私钥:${fake.pemBlock()}`);
    expect(pem).not.toContain("BEGIN RSA");
    expect(pem).toContain("一处凭据");

    const sk = redactText(`token ${fake.shortKey()}`);
    expect(sk).not.toContain(fake.shortKey());
  });

  it("评审 A2:手机号/银行卡号(纯数字长串)自动脱敏为客户数据", () => {
    expect(redactText(`手机 ${fake.phone()}`)).toContain("一处客户数据");
    expect(redactText(`卡号 ${fake.card()}`)).toContain("一处客户数据");
    expect(redactText(`手机 ${fake.phone()}`)).not.toContain(fake.phone());
  });

  it("评审 B3:~ 不吞时长/金额/端口/年份(仅 ~/ 路径形态)", () => {
    expect(redactText("大概 10~20 分钟")).toBe("大概 10~20 分钟");
    expect(redactText("封顶 20 元,端口 47100,2026 年")).toBe("封顶 20 元,端口 47100,2026 年");
    expect(redactText("配置在 ~/" + ".saydo/config.toml")).toContain("某个配置文件");
  });

  it("统计 redactions 类别计数", () => {
    const r = redactForSpeech(`路径 ${fake.homePath()} 和引用 ${fake.envRef()}`);
    const classes = r.redactions.map((x) => x.cls).sort();
    expect(classes).toContain("path");
    expect(classes).toContain("secret");
  });
});

describe("golden 5/5(模板要素 + 状态词零违规)", () => {
  it("Phase 1 golden 全过", () => {
    const failed = PHASE1_GOLDEN.map((c) => ({ id: c.id, r: checkGolden(c) })).filter((x) => !x.r.ok);
    expect(failed, JSON.stringify(failed)).toHaveLength(0);
    expect(PHASE1_GOLDEN).toHaveLength(5);
  });

  it("状态词校验器:执行语境说'做完了'判违规", () => {
    expect(checkStatusWords("任务做完了").ok).toBe(false);
    expect(checkStatusWords("执行和检查都跑完了,等你验收").ok).toBe(true);
    expect(checkStatusWords("交付了").ok).toBe(true);
  });
});

describe("SayDo 自家 id 豁免(E2 2026-08-04)", () => {
  it("focus 域 id 不被裸长串规则吞掉;相邻真凭据仍脱敏", async () => {
    const { redactForSpeech } = await import("../src/voice/redactor.js");
    const idText = "已锚定(focus:foc_01F1XT0RE0F0CVS00000000001)。";
    expect(redactForSpeech(idText).text).toContain("foc_01F1XT0RE0F0CVS00000000001");
    const mixed = "id foc_01F1XT0RE0F0CVS00000000001 与 Bearer abcdefgh12345678 同句";
    const out = redactForSpeech(mixed).text;
    expect(out).toContain("foc_01F1XT0RE0F0CVS00000000001");
    expect(out).toContain("一处凭据");
    expect(out).not.toContain("Bearer abcdefgh12345678");
  });
});
