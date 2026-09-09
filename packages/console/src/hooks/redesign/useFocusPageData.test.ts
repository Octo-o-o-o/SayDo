// VIEW-01 Focus 页会话(GAP-02 残项 2.2):WS 失效事件触发重取 + dispose 后无残留。无 DOM,驱动纯会话。

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchDataInvalidate } from "../../lib/dataInvalidate";
import { createFocusPageSession } from "./useFocusPageData";
import { fakeTargets, flush, installFetchStub, useSessionFakeTimers } from "./sessionTestKit";
import { BOUNDED_REFRESH_MS } from "./useRefreshSignal";

const FOC = "foc_01AAAAAAAAAAAAAAAAAAAAAAAA";

function routes() {
  return installFetchStub({
    [`/api/focuses/${FOC}`]: () => ({
      focus: { id: FOC, title: "周报", lifecycle: "active", currentRevision: 1, direction: "先写三段" },
      obligations: [{ id: "ob_1", title: "找数据", owner: "human", status: "open", needs: "action" }],
      lanes: [],
      events: [],
      repos: [],
      artifacts: []
    }),
    [`/api/focuses/${FOC}/timeline`]: () => ({ items: [], nextCursor: null }),
    "/api/focuses": () => [{ id: FOC, title: "周报", lifecycle: "active", currentRevision: 1 }]
  });
}

describe("createFocusPageSession", () => {
  beforeEach(() => useSessionFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("首屏成功后 WS 失效事件触发一次重取", async () => {
    const stub = routes();
    const t = fakeTargets();
    const results: string[] = [];
    const session = createFocusPageSession(FOC, null, { onResult: (r) => results.push(r.view.focus.id), onError: () => {} }, { targets: t });
    session.run();
    await flush();
    expect(results).toEqual([FOC]);
    expect(stub.count(`/api/focuses/${FOC}/timeline`)).toBe(1);
    dispatchDataInvalidate("focus.entity", t.win);
    await flush();
    expect(stub.count(`/api/focuses/${FOC}/timeline`)).toBe(2);
    expect(results).toEqual([FOC, FOC]);
    session.dispose();
  });

  it("dispose 后无残留:不再重取、晚到响应不回调", async () => {
    const stub = routes();
    const t = fakeTargets();
    const results: unknown[] = [];
    const session = createFocusPageSession(FOC, null, { onResult: (r) => results.push(r), onError: () => {} }, { targets: t });
    session.run();
    session.dispose();
    await flush();
    expect(results).toEqual([]);
    const after = stub.calls.length;
    dispatchDataInvalidate("confirm.resolved", t.win);
    t.doc.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(BOUNDED_REFRESH_MS * 2);
    session.run();
    await flush();
    expect(stub.calls.length).toBe(after);
    expect(results).toEqual([]);
  });
});
