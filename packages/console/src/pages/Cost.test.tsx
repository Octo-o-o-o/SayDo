import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Cost, aggregateCostWindow, costGroupText } from "./Cost";
import { authoritativeAllTotals } from "../lib/costWindow";
import { costTotalsText } from "../components/ui";

const state = vi.hoisted(() => ({ data: {} as Record<string, unknown>, range: "30d", group: "project", chart: true, drill: null as string | null }));
vi.mock("../lib/useAsync", () => ({ useAsync: () => ({ data: state.data, error: null }) }));
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  return { ...actual, useState: (initial: unknown) => [initial === "30d" ? state.range : initial === "project" ? state.group : initial === false ? state.chart : state.drill, () => {}] };
});
beforeEach(() => { state.range = "30d"; state.group = "project"; state.chart = true; state.drill = null; });
const api = (amount: unknown, currency: unknown = "CNY", known: unknown = 1) => ({ source: "api", amount, currency, known });
const cli = (provenance: unknown, requests: unknown = 2) => ({ source: "subscription", known: 0, amount: null, currency: null, meta_json: JSON.stringify({ provenance, requests }) });
function page(rows: Record<string, unknown>[], byProject: unknown[] = [], total = rows.length) {
  state.data = { entries: rows.map((row, i) => ({ ...row, id: `cst_${i}`, project_id: "prj_a", kind: "llm.dialog", ts: "2099-01-01T00:00:00Z" })),
    byProject, entriesWindow: { limit: 300, returned: rows.length, total, truncated: total > rows.length } };
  return renderToStaticMarkup(<Cost />);
}
function groups(html: string) { return html.slice(html.indexOf("data-cost-groups"), html.indexOf("</table>")); }
function chart(html: string) { return html.slice(html.indexOf("data-cost-chart="), html.indexOf("data-cost-groups")); }

describe("Cost实际summary/chart/group第三态", () => {
  it.each(["project", "kind", "source"])("%s分组沿共享Money/provenance投影", (group) => {
    state.group = group;
    const html = page([cli("subscription")]);
    expect(groups(html)).toContain("订阅额度内(已用 2 次)"); expect(groups(html)).not.toContain("还没有确切数字");
    expect(chart(html)).toContain("订阅额度内(已用 2 次)"); expect(chart(html)).not.toContain("0.0000 CNY");
  });
  it.each(["external_api", "unknown", undefined])("上游%s不自称订阅也不进金额条", (provenance) => {
    const html = page([cli(provenance)]);
    expect(groups(html)).toContain("SayDo 不代付"); expect(groups(html)).not.toContain("订阅额度内");
    expect(chart(html)).toContain("SayDo 不代付"); expect(chart(html)).not.toContain("0.0000");
  });
  it("mixed已知零/CNY/USD/unknown/订阅各自呈现", () => {
    const html = page([api(0), api(2), api(3, "USD"), api(null, null, 0), cli("subscription"), cli("unknown")]);
    expect(groups(html)).toContain("2.00 元 + 3.00 USD"); expect(groups(html)).toContain("1 笔还没有确切数字");
    expect(groups(html)).toContain("已用 2 次"); expect(groups(html)).toContain("SayDo 不代付");
    expect(chart(html)).toContain("2.0000 CNY"); expect(chart(html)).toContain("3.0000 USD");
    expect(chart(html)).not.toContain("5.0000");
  });
  it("非法值不被Number/null转换为合法零；缺requests不猜N", () => {
    const rows = [api(null), api("1"), api(-1), api(Infinity), api(1, "EUR"), cli("subscription", 0)];
    const group = aggregateCostWindow(rows, "project", new Map())[0]!;
    expect(group.knownByCurrency).toEqual({}); expect(group.unknownCount).toBe(5);
    expect(costGroupText(group)).toContain("调用次数不完整"); expect(costGroupText(group)).not.toContain("已用 0 次");
    expect(costTotalsText({ EUR: 1, CNY: Infinity })).toBe("还没有确切数字 + 还没有确切数字");
  });
  it("全部/project仅用全账本Money，不用300窗口补provenance/N", () => {
    state.range = "all";
    const html = page([cli("subscription", 9)], [{ projectId: "prj_a", projectTitle: "A", knownByCurrency: { CNY: 0, USD: 5 }, unknownCount: 8 }], 401);
    const table = groups(html);
    expect(table).toContain("0.00 元 + 5.00 USD"); expect(table).toContain("计费来源与调用次数未汇总");
    expect(table).not.toContain("订阅额度内"); expect(table).not.toContain("已用 9 次"); expect(table).not.toContain("8 笔还没有确切数字");
    expect(html).toContain("401"); expect(html).toContain("8 笔未提供金额");
  });
  it("超过300条全账本项目表明确笔数只属实际窗口，不伪造全账本N", () => {
    state.range = "all";
    const rows = Array.from({ length: 300 }, () => api(1));
    const html = page(rows, [
      { projectId: "prj_a", projectTitle: "A", knownByCurrency: { CNY: 401 }, unknownCount: 0 },
      { projectId: "prj_b", projectTitle: "B", knownByCurrency: { USD: 12 }, unknownCount: 0 }
    ], 413);
    const table = groups(html);
    expect(table).toContain("窗口笔数"); expect(table).not.toContain("<th>笔数</th>");
    expect(table).toContain("401.00 元"); expect(table).toContain(">300</span>");
    expect(table).toContain("12.00 USD"); expect(table).toContain(">0</span>");
    expect(table).not.toContain("已用 0 次"); expect(table).not.toContain("已用 413 次");
    expect(html).toContain("413"); expect(table).toContain("计费来源与调用次数未汇总");
  });
  it("下钻只看真实窗口行，summary仍保持全账本范围", () => {
    state.range = "all"; state.drill = "prj_a";
    const html = page([cli("subscription", 9)], [{ projectId: "prj_a", projectTitle: "A", knownByCurrency: {}, unknownCount: 8 }], 401);
    expect(html.slice(html.indexOf("data-cost-drill-list"))).toContain("订阅额度内(已用 9 次)");
    expect(groups(html)).not.toContain("已用 9 次");
  });
  it("窗口同币种溢出后不展示后续部分金额，所有受影响行保持未知", () => {
    const g = aggregateCostWindow([api(Number.MAX_VALUE), api(Number.MAX_VALUE), api(1)], "project", new Map())[0]!;
    expect(g.knownByCurrency).toEqual({}); expect(g.unknownCount).toBe(3);
    expect(costGroupText(g)).toBe("3 笔还没有确切数字");
  });
  it("全账本汇总Money非法/溢出后不接受后续小计作完整数字", () => {
    expect(authoritativeAllTotals([
      { projectId: "a", projectTitle: null, knownByCurrency: { CNY: Number.MAX_VALUE }, unknownCount: 0 },
      { projectId: "b", projectTitle: null, knownByCurrency: { CNY: Number.MAX_VALUE }, unknownCount: 0 },
      { projectId: "c", projectTitle: null, knownByCurrency: { CNY: 1, EUR: 1 }, unknownCount: 0 }
    ])).toMatchObject({ knownByCurrency: {}, unknownCount: null });
  });
});


it("Cost真实全账本summary/chart/group不借300窗口，billingN与unknown准确分类", () => {
  state.range = "all";
  const html = page(Array.from({ length: 300 }, () => api(1)), [{ projectId: "prj_a", projectTitle: "A", knownByCurrency: { CNY: 401, USD: 0 }, unknownCount: 16,
    billing: { unknownMoneyEntries: 1, subscriptionEntries: 12, subscriptionRequests: 24, upstreamCliEntries: 3 } }], 417);
  expect(groups(html)).toContain("订阅额度内(已用 24 次)"); expect(chart(html)).toContain("订阅额度内(已用 24 次)");
  expect(html.slice(html.indexOf("data-cost-all-ledger"), html.indexOf("data-cost-chart="))).toContain("1 笔还没有确切数字");
  expect(groups(html)).toContain("SayDo 不代付"); expect(html).not.toContain("16 笔未提供金额");
  expect(groups(html)).toContain("1 笔金额未知"); expect(groups(html)).not.toContain("1 笔未提供金额");
  expect(groups(html)).toContain("401.00 元 + 0.00 USD"); expect(groups(html)).toContain(">300</span>");
});

it("Cost各project合法但跨project金额溢出：summary未知量null，项目原量和合法其他币种不丢", () => {
  state.range = "all";
  const billing = { unknownMoneyEntries: 0, subscriptionEntries: 0, subscriptionRequests: null, upstreamCliEntries: 0 };
  const html = page([], [{ projectId: "a", projectTitle: "A", knownByCurrency: { CNY: Number.MAX_VALUE, USD: 0 }, unknownCount: 0, billing },
    { projectId: "b", projectTitle: "B", knownByCurrency: { CNY: Number.MAX_VALUE }, unknownCount: 0, billing }]);
  const summary = html.slice(html.indexOf("data-cost-all-ledger"), html.indexOf("data-cost-chart="));
  expect(summary).toContain("未知金额笔数未提供"); expect(summary).toContain("0.00 USD"); expect(summary).not.toContain("CNY");
  expect(html).not.toContain("已用 0 次");
});
