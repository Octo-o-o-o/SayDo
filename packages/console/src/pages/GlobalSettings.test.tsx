import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EvaluatorSafetyCard, shouldShowEvaluatorSafety } from "./GlobalSettings";
import { VOICE_SETTINGS_COPY } from "../voice/systemVoice";

describe("评估器安全确认人话区", () => {
  it("两 ack 均未设时整区不显示", () => {
    expect(shouldShowEvaluatorSafety({ evaluator_isolation: false, evaluator_same_family: false })).toBe(false);
    expect(shouldShowEvaluatorSafety(null)).toBe(false);
    const html = renderToStaticMarkup(
      <EvaluatorSafetyCard
        acks={{ evaluator_isolation: false, evaluator_same_family: false }}
        hints={[]}
        onRevoke={() => {}}
      />
    );
    expect(html).toBe("");
  });

  it("任一 ack 已设时显示人话、现值与撤销确认", () => {
    const html = renderToStaticMarkup(
      <EvaluatorSafetyCard
        acks={{ evaluator_isolation: true, evaluator_same_family: false }}
        hints={[]}
        onRevoke={() => {}}
      />
    );
    expect(shouldShowEvaluatorSafety({ evaluator_isolation: true, evaluator_same_family: false })).toBe(true);
    expect(html).toContain("评估器安全确认");
    expect(html).toContain("配置时你确认过两件事");
    expect(html).toContain("已确认");
    expect(html).toContain("未确认");
    expect(html).toContain("撤销确认");
    expect(html).toContain("title=\"撤销后,评估器会改走独立 API,需要重新配置\"");
    expect(html).toContain("技术详情");
    expect(html).toContain("evaluator_isolation_ack = true");
    expect(html).toContain("evaluator_same_family_ack = false");
    expect(html).not.toContain("存量评估豁免字段");
  });

  it("设置页语音节文案按系统级转化漏斗改写", () => {
    expect(VOICE_SETTINGS_COPY).toBe("没配也能说:先用系统语音;配 VOLC 后自动切换云端(更准)");
  });
});
