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

  it("fixture 含 memory 卡", () => {
    expect(confirmCardFixtures.some((f) => f.data.kind === "memory")).toBe(true);
  });
});
