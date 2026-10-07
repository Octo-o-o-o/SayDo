import { describe, expect, it } from "vitest";
import {
  authoritativeAllTotals,
  costExportFilename,
  costExportHeader,
  costWindowLabel,
  normalizeEntriesWindow
} from "./costWindow";

describe("authoritativeAllTotals", () => {
  it("全部合计只加总 byProject 全账本,不读 entries 窗口", () => {
    const totals = authoritativeAllTotals([
      { projectId: "prj_a", projectTitle: "A", knownByCurrency: { CNY: 10, USD: 2 }, unknownCount: 1 },
      { projectId: "prj_b", projectTitle: "B", knownByCurrency: { CNY: 5 }, unknownCount: 3 }
    ]);
    expect(totals).toEqual({
      knownByCurrency: { CNY: 15, USD: 2 },
      unknownCount: 4,
      projectCount: 2
    });
  });
});

describe("entries 300 窗口", () => {
  it("缺字段时按 entries 长度兜底,超限标 truncated", () => {
    expect(normalizeEntriesWindow(undefined, 12)).toEqual({
      limit: 300,
      returned: 12,
      total: 12,
      truncated: false
    });
    expect(
      normalizeEntriesWindow({ limit: 300, returned: 300, total: 401, truncated: true }, 300)
    ).toMatchObject({ truncated: true, total: 401, returned: 300 });
  });

  it("文案与导出文件名标窗口", () => {
    const window = { limit: 300, returned: 300, total: 401, truncated: true };
    expect(costWindowLabel(window)).toContain("300/401");
    expect(costWindowLabel(window)).toContain("上限 300");
    expect(costExportHeader(window)).toContain("明细窗口");
    expect(costExportFilename({ group: "project", window, now: 1 })).toBe(
      "saydo-costs-project-window-300-of-401-1.csv"
    );
  });
});


const emptyBilling = { unknownMoneyEntries: 0, subscriptionEntries: 0, subscriptionRequests: null, upstreamCliEntries: 0 };
const project = (id: string, knownByCurrency: Record<string, number>, billing: unknown = emptyBilling) => ({ projectId: id, projectTitle: id, knownByCurrency, unknownCount: 0, billing } as Parameters<typeof authoritativeAllTotals>[0][number]);
describe("完整billing合计与旧server兼容", () => {
  it("跨project同币种overflow整金额及未知笔数null，各project原计数保留", () => {
    const rows = [project("a", { CNY: Number.MAX_VALUE, USD: 0 }), project("b", { CNY: Number.MAX_VALUE, USD: 2 }), project("c", { CNY: 1 })];
    const view = authoritativeAllTotals(rows); expect(view.knownByCurrency).toEqual({ USD: 2 }); expect(view.billing?.unknownMoneyEntries).toBe(null);
    expect(view.unknownCount).toBe(null); expect(rows[0]!.billing?.unknownMoneyEntries).toBe(0);
  });
  it("只完整正N相加，空订阅null不污染合法N，无订阅总Nnull", () => {
    const a = project("a", {}, { ...emptyBilling, subscriptionEntries: 1, subscriptionRequests: 2 });
    expect(authoritativeAllTotals([a, project("b", {})]).billing?.subscriptionRequests).toBe(2);
    expect(authoritativeAllTotals([project("b", {})]).billing?.subscriptionRequests).toBe(null);
    expect(authoritativeAllTotals([a, project("b", {}, { ...emptyBilling, subscriptionEntries: 1 })]).billing?.subscriptionRequests).toBe(null);
  });
  it("各计数unsafe sum与任何null传播null；requests sum也不露局部N", () => {
    const large = project("a", {}, { unknownMoneyEntries: Number.MAX_SAFE_INTEGER, subscriptionEntries: 1, subscriptionRequests: Number.MAX_SAFE_INTEGER, upstreamCliEntries: null });
    const small = project("b", {}, { ...emptyBilling, unknownMoneyEntries: 1, subscriptionEntries: 1, subscriptionRequests: 1 });
    expect(authoritativeAllTotals([large, small]).billing).toEqual({ unknownMoneyEntries: null, subscriptionEntries: 2, subscriptionRequests: null, upstreamCliEntries: null });
  });
  it.each([undefined, null, {}, { ...emptyBilling, extra: 1 }, { ...emptyBilling, upstreamCliEntries: "1" }])("旧server/非法整billing %j不消费局部N", (billing) => {
    expect(authoritativeAllTotals([project("a", {}, { ...emptyBilling, subscriptionEntries: 1, subscriptionRequests: 9 }), { ...project("b", {}), billing: billing as never }]).billing).toBe(undefined);
  });
});
