import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskCard } from "../../components/redesign/TaskCard";
import { createFocusPageSession } from "./useFocusPageData";
import type { FocusLoadResult } from "./useFocusPageData";
import { fakeTargets, flush, installFetchStub, useSessionFakeTimers } from "./sessionTestKit";
import { mapTaskViewFromDetail } from "./mappers";

const FOC = "foc_costs", TSK = "tsk_costs";
async function productionCard(costs: unknown, fail = false): Promise<string> {
  const stub = installFetchStub({
    [`/api/focuses/${FOC}`]: () => ({ focus: { id: FOC, title: "成本", lifecycle: "active", currentRevision: 1 }, tasks: [{ id: TSK, title: "绑定任务", status: "running" }], obligations: [], lanes: [], events: [], repos: [], artifacts: [], packages: [] }),
    [`/api/focuses/${FOC}/timeline`]: () => ({ items: [], nextCursor: null }),
    "/api/focuses": () => [],
    [`/api/tasks/${TSK}`]: () => ({ task: { id: TSK, title: "绑定任务", status: "running", elapsedActiveMs: 0 }, package: null, runs: [], costs })
  });
  if (fail) stub.fail(`/api/tasks/${TSK}`, "详情不可用");
  let result: FocusLoadResult | undefined;
  const errors: unknown[] = [];
  const session = createFocusPageSession(FOC, null, { onResult: r => { result = r; }, onError: e => errors.push(e) }, { targets: fakeTargets() });
  try {
    session.run(); await flush();
    expect(errors).toEqual([]); expect(stub.count(`/api/tasks/${TSK}`)).toBe(1);
    const looked = result?.view.lookups?.tasks?.[TSK];
    expect(looked).toBeDefined(); expect(result?.view.rail.tasks[0]).toBe(looked);
    return renderToStaticMarkup(<TaskCard task={looked!} />);
  } finally { session.dispose(); }
}
const api = (amount: number, currency = "CNY") => ({ source: "api", known: 1, amount, currency });
const sub = (provenance: string, requests?: unknown) => ({ source: "subscription", known: 1, amount: 0, currency: "CNY", meta_json: JSON.stringify({ provenance, requests }) });
describe("Focus 成功详情成本经生产会话/lookup/mapper到TaskCard", () => {
  beforeEach(useSessionFakeTimers);
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it("API合法零仍显示币种", async () => { expect(await productionCard([api(0, "USD")])).toContain("已知小计 0.00 USD"); });
  it("不同币种分别呈现且保未知小计", async () => {
    const html = await productionCard([api(3), api(2, "USD"), { source: "api", known: 0 }]);
    expect(html).toContain("3.00 元 + 2.00 USD"); expect(html).toContain("1 笔还没有确切数字");
  });
  it("只有provenance合法订阅给真实N", async () => { expect(await productionCard([sub("subscription", 4)])).toContain("订阅额度内(已用 4 次)"); });
  it.each([undefined, 0, -1, 0.5, "2", Number.MAX_SAFE_INTEGER + 1])("订阅非法/缺失N=%s不猜0", async requests => {
    const html = await productionCard([sub("subscription", 2), sub("subscription", requests)]);
    expect(html).toContain("调用次数不完整"); expect(html).not.toContain("已用 2 次"); expect(html).not.toContain("已用 0 次");
  });
  it.each(["external_api", "unknown"])("上游%s不冒订阅", async provenance => {
    const html = await productionCard([sub(provenance, 4)]); expect(html).toContain("SayDo 不代付"); expect(html).not.toContain("订阅额度内");
  });
  it("legacy缺meta也诚实上游", async () => { expect(await productionCard([{ source: "subscription", known: 0 }])).toContain("SayDo 不代付"); });
  it.each([undefined, {}, [null, "invalid", api(-1), api(2, "EUR")]])("缺失/非法成本不变免费", async costs => {
    const html = await productionCard(costs); expect(html).toContain("还没有确切数字"); expect(html).not.toContain("0.00");
  });
  it("详情失败保成员且不给成功成本", async () => {
    const html = await productionCard([api(8)], true); expect(html).toContain("任务详情未加载"); expect(html).not.toContain("8.00");
  });
  it("旧mapper二参数兼容未知", () => { const html = renderToStaticMarkup(<TaskCard task={mapTaskViewFromDetail({ id: TSK, status: "running" }, FOC)} />); expect(html).toContain("还没有确切数字"); });
});
