import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CONFIRM_KINDS } from "@saydo/contracts";
import { ConfirmCard, confirmKindGroupLabel } from "./ConfirmCard";
import { confirmCardFixtures } from "./ConfirmCard.fixture";
import type { ConfirmCardData, ConfirmKind } from "./types";

const BASE: ConfirmCardData = { receiptId: "rc_t", kind: "readiness", keys: ["一条"], secondsLeft: null, resolved: null };

describe("ConfirmCard kind 文案(GAP-02 2.1:与 @saydo/contracts 单源对齐)", () => {
  it("contracts 每个 kind 都有非空分组文案", () => {
    for (const k of CONFIRM_KINDS) {
      expect(confirmKindGroupLabel(k).length).toBeGreaterThan(0);
      expect(confirmKindGroupLabel(k)).not.toBe("确认");
    }
  });

  it("memory kind 渲染「记忆 · 信息确认 · 不是授权」", () => {
    const html = renderToStaticMarkup(<ConfirmCard data={{ ...BASE, kind: "memory", receiptId: "mrc_1" }} />);
    expect(html).toContain("记忆 · 信息确认 · 不是授权");
    expect(html).toContain('data-confirm-card="mrc_1"');
  });

  it("表外 kind 显示通用「确认」前缀,不渲染空前缀", () => {
    const html = renderToStaticMarkup(<ConfirmCard data={{ ...BASE, kind: "something_new" as ConfirmKind }} />);
    expect(html).toContain("确认 · 信息确认 · 不是授权");
    expect(html).not.toContain("> · 信息确认");
  });

  it("ConfirmCard 渲染全部合法 kind:不抛、不漏登记文案", () => {
    const registered: Record<ConfirmKind, string> = {
      focus_anchor: "锚定确认",
      focus_create_anchor: "锚定确认",
      focus_obligation: "义务确认",
      focus_obligation_resolve: "义务确认",
      focus_revision: "修订确认",
      focus_lane_split: "修订确认",
      expectation_ack: "期待确认",
      dispatch: "派发确认",
      runtime_effect: "效果授权",
      readiness: "就绪复述",
      memory: "记忆",
      project_anchor: "项目锚定"
    };
    expect([...CONFIRM_KINDS].sort()).toEqual(Object.keys(registered).sort());
    for (const kind of CONFIRM_KINDS) {
      let html = "";
      expect(() => {
        html = renderToStaticMarkup(
          <ConfirmCard data={{ ...BASE, kind, receiptId: `rc_${kind}`, keys: [`key-${kind}`] }} />
        );
      }).not.toThrow();
      const label = registered[kind];
      expect(confirmKindGroupLabel(kind)).toBe(label);
      expect(html).toContain(`${label} · 信息确认 · 不是授权`);
      expect(html).toContain(`data-confirm-card="rc_${kind}"`);
      expect(html).toContain(`key-${kind}`);
    }
  });

  it("ConfirmCard 渲染原型名与普通未知:不抛、统一「确认」、不是对象/函数", () => {
    for (const kind of ["__proto__", "constructor", "toString", "something_new"]) {
      let html = "";
      expect(() => {
        html = renderToStaticMarkup(
          <ConfirmCard data={{ ...BASE, kind: kind as ConfirmKind, receiptId: `rc_${kind}` }} />
        );
      }).not.toThrow();
      const label = confirmKindGroupLabel(kind);
      expect(typeof label).toBe("string");
      expect(label).toBe("确认");
      expect(html).toContain("确认 · 信息确认 · 不是授权");
      expect(html).not.toContain("[object ");
      expect(html).not.toContain("function ");
      expect(html).not.toContain("> · 信息确认");
    }
  });

  it("fixture 含 memory 卡", () => {
    expect(confirmCardFixtures.some((f) => f.data.kind === "memory")).toBe(true);
  });
});
