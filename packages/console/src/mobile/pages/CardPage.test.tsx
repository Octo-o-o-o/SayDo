import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DurableCountdown, MobileConfirmCard } from "./CardPage";
import type { AttentionItem } from "../types";

describe("M-Confirm 三段式", () => {
  it("expiresAt 以 durable 到期锚渲染倒计时", () => {
    const html = renderToStaticMarkup(
      <DurableCountdown expiresAt="2026-08-11T12:01:01.000Z" nowMs={Date.parse("2026-08-11T12:00:00.000Z")} />
    );
    expect(html).toContain('data-expires-at="2026-08-11T12:01:01.000Z"');
    expect(html).toContain("01:01");
    expect(html).toContain("后过期自动搁置");
  });

  it("只渲染做、不要、撤销三个真实动作，长 prompt 副文字用按建议", () => {
    const longTitle = "是否按当前方向继续推进本周交付并同步相关方";
    const item: AttentionItem = {
      id: "conf:apr_mobile",
      color: "orange",
      title: longTitle,
      focusId: null,
      focusTitle: null,
      action: "open_confirm",
      updatedAt: "2026-08-11T12:00:00.000Z",
      expiresAt: "2099-08-11T12:00:00.000Z",
      sessionId: "ses_0123456789ABCDEFGHJKMNPQ",
      refId: "apr_mobile",
      confirmKind: "focus_obligation"
    };
    const html = renderToStaticMarkup(<MobileConfirmCard item={item} back="/m" />);
    expect(html.match(/<button/g)).toHaveLength(3);
    // 主问题已在 h1；「做」副文字为短语，不再塞 prompt 全文
    expect(html).toContain(`<h1>${longTitle}</h1>`);
    expect(html).toContain("<span>按建议</span>");
    expect(html).not.toContain(`<strong>做</strong><span>${longTitle}</span>`);
    expect(html).toContain("不按这个来");
    expect(html).toContain("当我没问过");
    expect(html).not.toContain("泳道捡回");
    expect(html).not.toContain("建议代价");
  });

  it("短标题作「做」副文字摘要且不超过 12 字", () => {
    const item: AttentionItem = {
      id: "conf:apr_short",
      color: "orange",
      title: "继续推进",
      focusId: null,
      focusTitle: null,
      action: "open_confirm",
      updatedAt: "2026-08-11T12:00:00.000Z",
      expiresAt: "2099-08-11T12:00:00.000Z",
      sessionId: "ses_0123456789ABCDEFGHJKMNPQ",
      refId: "apr_short",
      confirmKind: "dispatch"
    };
    const html = renderToStaticMarkup(<MobileConfirmCard item={item} back="/m" />);
    expect(html).toContain("<span>继续推进</span>");
  });

  it("memory kind:按钮记/不用记,标记信息确认不是授权,不说自动执行(GAP-02 残项 2.1)", () => {
    const item: AttentionItem = {
      id: "conf:apr_memory",
      color: "orange",
      title: "记住:这个项目用 pnpm",
      focusId: null,
      focusTitle: null,
      action: "open_confirm",
      updatedAt: "2026-08-11T12:00:00.000Z",
      expiresAt: "2099-08-11T12:00:00.000Z",
      sessionId: "ses_0123456789ABCDEFGHJKMNPQ",
      refId: "apr_memory",
      confirmKind: "memory"
    };
    const html = renderToStaticMarkup(<MobileConfirmCard item={item} back="/m" />);
    expect(html).toContain('data-confirm-kind="memory"');
    expect(html).toContain("记忆 · 信息确认 · 不是授权");
    expect(html).toContain("<strong>记</strong>");
    expect(html).toContain("<strong>不用记</strong>");
    expect(html).not.toContain("<strong>做</strong>");
    expect(html).not.toContain("<strong>不要</strong>");
    expect(html).toContain("不会偷偷记");
    expect(html).not.toContain("不会偷偷执行");
    expect(html.match(/<button/g)).toHaveLength(3);
  });

  it("表外/缺失 kind 回落确认/不,不把未知动作说成自动执行", () => {
    const base: AttentionItem = {
      id: "conf:apr_unknown",
      color: "orange",
      title: "一个新类型的确认",
      focusId: null,
      focusTitle: null,
      action: "open_confirm",
      updatedAt: "2026-08-11T12:00:00.000Z",
      expiresAt: "2099-08-11T12:00:00.000Z",
      sessionId: "ses_0123456789ABCDEFGHJKMNPQ",
      refId: "apr_unknown"
    };
    for (const item of [base, { ...base, confirmKind: "something_new" as AttentionItem["confirmKind"] }]) {
      const html = renderToStaticMarkup(<MobileConfirmCard item={item} back="/m" />);
      expect(html).toContain("<strong>确认</strong>");
      expect(html).toContain("<strong>不</strong>");
      expect(html).not.toContain("<strong>做</strong>");
      expect(html).toContain("不按这个来");
      expect(html).toContain("<strong>撤销</strong>");
    }
  });
});
