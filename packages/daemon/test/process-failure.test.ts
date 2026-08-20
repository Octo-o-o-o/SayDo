import { describe, expect, it } from "vitest";
import { isCliSubscriptionRateLimit } from "../src/providers/byoa/billing.js";
import { explainByoaVoidReason, explainCliProcessFailure } from "../src/providers/byoa/processFailure.js";

const CURSOR_USAGE_FIXTURE =
  "ActionRequiredError: You've hit your usage limit. Add a payment method or wait until it resets on 9/12/2026.";

describe("explainCliProcessFailure", () => {
  it("把 cursor ActionRequiredError 用量上限解析成人话并抽出重置日", () => {
    const explained = explainCliProcessFailure("cursor_cli", {
      exitCode: 1,
      stderrTail: CURSOR_USAGE_FIXTURE
    });
    expect(explained.kind).toBe("usage_limit");
    expect(explained.code).toBe("subscription_rate_limited");
    expect(explained.message).toBe("Cursor 本月用量已到上限,9/12 重置——换一家或去 Cursor 设置 Spend Limit");
    expect(
      isCliSubscriptionRateLimit("cursor_cli", { stderrTail: CURSOR_USAGE_FIXTURE, lines: [], exitCode: 1 })
    ).toBe(true);
  });

  it("认证类错误给人话,不吞成退出码", () => {
    const explained = explainCliProcessFailure("claude_cli", {
      exitCode: 1,
      stderrTail: "Error: authentication failed, please log in"
    });
    expect(explained.kind).toBe("auth");
    expect(explained.code).toBe("auth_required");
    expect(explained.message).toContain("登录");
  });

  it("auth 与 rate limit 混写不升格为认证失效,保留退出码和尾行", () => {
    const explained = explainCliProcessFailure("codex_cli", {
      exitCode: 7,
      stderrTail: "authentication failed: login rate limit reached"
    });
    expect(explained.kind).toBe("unknown");
    expect(explained.code).toBe("process_exit");
    expect(explained.message).toBe("CLI 进程退出码 7: authentication failed: login rate limit reached");
  });

  it("未知错误保留退出码和 stderr 尾行", () => {
    const explained = explainCliProcessFailure("codex_cli", {
      exitCode: 1,
      stderrTail: "debug: starting\nboom: unexpected parser crash"
    });
    expect(explained.kind).toBe("unknown");
    expect(explained.code).toBe("process_exit");
    expect(explained.message).toBe("CLI 进程退出码 1: boom: unexpected parser crash");
  });
});

describe("explainByoaVoidReason", () => {
  it("tripwire 与 unknown_event 分因,不再共用安全终止", () => {
    expect(explainByoaVoidReason("tripwire", "safety_stop")).toBe("CLI 尝试调用工具,已终止");
    expect(explainByoaVoidReason("unknown_event", "safety_stop")).toBe(
      "CLI 输出了无法识别的内容,这次结果作废(保守处理)"
    );
    expect(explainByoaVoidReason("tripwire", "consume")).toBe("CLI 尝试调用工具,已终止");
    expect(explainByoaVoidReason("unknown_event", "consume")).toBe(
      "CLI 输出了无法识别的内容,这次结果作废(保守处理)"
    );
    expect(explainByoaVoidReason("cli_error", "consume")).toBe("CLI 返回错误终态(通常是用量受限或拒答)");
  });

  it("family_mismatch 分因并带上观测模型", () => {
    expect(explainByoaVoidReason("family_mismatch", "safety_stop", "Cursor Grok 4.6 High Fast")).toBe(
      "CLI 实际运行的模型与配置家族不符(观测到 Cursor Grok 4.6 High Fast)"
    );
    expect(explainByoaVoidReason("family_mismatch", "consume", "Composer 2.5 Fast")).toBe(
      "CLI 实际运行的模型与配置家族不符(观测到 Composer 2.5 Fast)"
    );
    expect(explainByoaVoidReason("family_mismatch", "safety_stop")).toBe(
      "CLI 实际运行的模型与配置家族不符"
    );
  });

  it("其余作废原因保留原 safety_stop / consume 兜底句", () => {
    expect(explainByoaVoidReason("parse_error", "safety_stop")).toBe("CLI 流式输出触发安全终止");
    expect(explainByoaVoidReason("observed_model_missing", "consume")).toBe("CLI 输出未通过安全校验");
  });
});
