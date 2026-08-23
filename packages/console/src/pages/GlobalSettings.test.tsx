import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EvaluatorSafetyCard, shouldShowEvaluatorSafety, tier1ResetText, Tier1ExecutorCard } from "./GlobalSettings";
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

describe("Tier1 开发执行器卡", () => {
  it("未跑物理探针时不从配置伪造登录态或五小时窗", () => {
    const html = renderToStaticMarkup(
      <Tier1ExecutorCard
        config={{ adapter: "claude_code", model: "opus", pinnedVersion: "2.1.220", nextRateLimitResetAt: null }}
        report={null}
        testing={false}
        error={null}
        onTest={() => {}}
      />
    );
    expect(html).toContain("开发执行器");
    expect(html).toContain("claude_code");
    expect(html).toContain("2.1.220");
    expect(html).toContain("未测试");
    expect(html).toContain("没有已知限流记录");
    expect(html).not.toContain("额度充足");
  });

  it("物理探针结果展示真实版本、登录态、失败处方与重启提示", () => {
    const html = renderToStaticMarkup(
      <Tier1ExecutorCard
        config={{ adapter: "claude_code", model: "opus", pinnedVersion: "2.1.220" }}
        report={{
          adapter: "claude_code",
          status: "fail",
          checks: [
            { name: "version", status: "ok", detail: "2.1.220 (Claude Code)" },
            { name: "auth", status: "ok" },
            { name: "hook_socket", status: "fail", error: "审批门不可达" }
          ],
          identityWritten: true,
          restartRequiredToArm: true,
          prescription: "重启服务后才会武装"
        }}
        testing={false}
        error={null}
        onTest={() => {}}
      />
    );
    expect(html).toContain("2.1.220 (Claude Code)");
    expect(html).toContain("已登录");
    expect(html).toContain("检查未通过");
    expect(html).toContain("审批门不可达");
    expect(html).toContain("重启服务后才会武装");
  });

  it("五小时窗只把 durable 时间转为预计重置,坏值不伪造", () => {
    expect(tier1ResetText("not-a-time")).toBe("限流记录时间不可读");
    expect(tier1ResetText(undefined)).toBe("没有已知限流记录");
    expect(tier1ResetText("2026-08-22T12:00:00.000Z")).toContain("预计");
  });
});
