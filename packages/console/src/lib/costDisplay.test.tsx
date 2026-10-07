import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { costEntryText, taskCostsText } from "./costDisplay";
import { CostText } from "../components/ui";
import { Cost } from "../pages/Cost";
import { TaskDetail } from "../pages/TaskDetail";
import { mapReviewContext } from "../hooks/redesign/mappers";
import { ReviewPanel } from "../components/redesign/ReviewPanel";
import { TaskCard } from "../components/redesign/TaskCard";
import { HpTaskModal } from "../components/redesign/Modals";

const state = vi.hoisted(() => ({ data: {} as Record<string, unknown> }));
vi.mock("./useAsync", () => ({ useAsync: () => ({ data: state.data, error: null, failure: null, loading: false }) }));
beforeEach(() => vi.stubGlobal("location", { hostname: "localhost" }));
afterEach(() => vi.unstubAllGlobals());
const upstream = "按该 CLI 的上游计费方式，SayDo 不代付";
const sub = (provenance: unknown = "subscription", requests: unknown = 1) => ({ source: "subscription", known: 0, amount: null, currency: null,
  meta_json: JSON.stringify({ provenance, requests }) });
const api = (amount: unknown, currency = "CNY", known: unknown = 1) => ({ source: "api", known, amount, currency });

function pages(row: Record<string, unknown>): string[] {
  state.data = { task: { id: "tsk_cost", title: "真实成本", status: "ready_for_review", route: "tier1", attempt: 1 }, package: null,
    runs: [], costs: [row], entries: [{ ...row, kind: "llm.dialog", ts: "2099-01-01T00:00:00Z" }], byProject: [],
    entriesWindow: { limit: 300, returned: 1, total: 1, truncated: false } };
  return [renderToStaticMarkup(<CostText known={row["known"] === 1} amount={row["amount"] as number | null} source={row["source"] as string}
    currency={row["currency"] as string | null} metaJson={row["meta_json"]} />),
    renderToStaticMarkup(<TaskDetail taskId="tsk_cost" />), renderToStaticMarkup(<Cost />)];
}

describe("生产成本来源文案与三个消费者", () => {
  it.each(["subscription", "external_api", "unknown", undefined])("保留真实provenance %s而非按source猜免费", (provenance) => {
    const row = sub(provenance); if (provenance === undefined) row.meta_json = JSON.stringify({ requests: 1 });
    const expected = provenance === "subscription" ? "订阅额度内(已用 1 次)" : upstream;
    expect(costEntryText(row)).toBe(expected);
    for (const html of pages(row)) { expect(html).toContain(expected); expect(html).not.toContain("¥0");
      if (provenance !== "subscription") expect(html).not.toContain("订阅额度内"); }
  });
  it.each([undefined, null, "broken", "[]", "null"])("legacy或坏meta %j保守上游计费", (meta_json) => {
    expect(costEntryText({ ...sub(), meta_json })).toBe(upstream);
  });
  it.each([undefined, 0, -1, 0.5, "1", Number.MAX_SAFE_INTEGER + 1])("无合法requests %j不造N或零", (requests) => {
    expect(costEntryText({ ...sub(), meta_json: JSON.stringify({ provenance: "subscription", requests }) })).toBe("订阅额度内(调用次数未提供)");
  });
  it.each([undefined, null, "", "EUR", " CNY"])("非法或缺失币种 %j不猜人民币", (currency) => {
    expect(costEntryText({ ...api(1), currency })).toBe("还没有确切数字");
  });
  it("API已知零是已知数，未知null不冒零", () => {
    for (const html of pages(api(0))) expect(html).toContain("0.00 元");
    expect(costEntryText(api(null, "CNY", 0))).toBe("还没有确切数字");
  });
});

describe("任务完整账本只读投影", () => {
  it("无账本文案时Money只按完整合法形状显示，不猜币种", () => {
    const ctx = mapReviewContext({ task: { id: "tsk_money", title: "真实金额", status: "ready_for_review" }, package: null, runs: [] }, "foc_cost");
    delete ctx.task.spentText;
    ctx.task.spent = { known: true, value: 1, currency: "USD" };
    expect(renderToStaticMarkup(<ReviewPanel ctx={ctx} />)).toContain("1.00 USD");
    expect(renderToStaticMarkup(<TaskCard task={ctx.task} />)).toContain("1.00 USD");
    ctx.task.spent = { known: true, value: 1 };
    expect(renderToStaticMarkup(<ReviewPanel ctx={ctx} />)).toContain("还没有确切数字");
  });
  it("订阅调用只加真实requests，known订阅零不进API金额", () => {
    expect(taskCostsText([sub(), sub("subscription", 2)])).toBe("订阅额度内(已用 3 次)");
    expect(taskCostsText([{ ...sub(), known: 1, amount: 0 }])).toBe("订阅额度内(已用 1 次)");
    expect(taskCostsText([sub(), sub("subscription", 0)])).toBe("订阅额度内(调用次数不完整)");
  });
  it("已知小计按币种分开，未知与CLI计费说明保留", () => {
    const rows = [api(2), api(3), api(1, "USD"), api(null, "CNY", 0), sub(), sub("external_api")];
    const text = taskCostsText(rows);
    expect(text).toBe(`已知小计 5.00 元 + 1.00 USD；1 笔还没有确切数字；订阅额度内(已用 1 次)；${upstream}`);
    const ctx = mapReviewContext({ task: { id: "tsk_cost", title: "真实成本", status: "ready_for_review", route: "tier1", attempt: 1 }, package: null, costs: rows, runs: [] }, "foc_cost");
    expect(ctx.task.spentText).toBe(text); expect(ctx.task.spent.known).toBe(false);
    for (const html of [renderToStaticMarkup(<ReviewPanel ctx={ctx} />), renderToStaticMarkup(<TaskCard task={ctx.task} />),
      renderToStaticMarkup(<HpTaskModal task={{ ...ctx.task, route: "hopper" }} focusTitle="工作" inline />)]) {
      expect(html).toContain(text); expect(html).not.toContain("¥6");
    }
  });
  it.each([[], [api(null, "CNY", 0)], [api(NaN)], [api(-1)], [api(Infinity)]].map(rows => ({ rows })))("缺数据或非法金额不显示免费 %j", ({ rows }) => {
    expect(taskCostsText(rows)).toContain("还没有确切数字"); expect(taskCostsText(rows)).not.toContain("0.00");
  });
});
