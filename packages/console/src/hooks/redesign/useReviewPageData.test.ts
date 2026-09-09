// VIEW-01 验收面会话(GAP-02 残项 2.2):WS 失效事件触发重取 + dispose 后无残留(不再重取、晚到响应不回调)。
// 无 DOM:stub fetch + EventTarget 假 window/document 驱动纯会话 createReviewPageSession(hook 只是薄包装)。

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchDataInvalidate } from "../../lib/dataInvalidate";
import { createReviewPageSession } from "./useReviewPageData";
import { fakeTargets, flush, installFetchStub, useSessionFakeTimers } from "./sessionTestKit";
import { BOUNDED_REFRESH_MS } from "./useRefreshSignal";

const TSK = "tsk_01AAAAAAAAAAAAAAAAAAAAAAAA";

function routes() {
  return installFetchStub({
    [`/api/tasks/${TSK}`]: () => ({
      task: { id: TSK, title: "写周报", status: "ready_for_review", created_at: "2026-09-09T00:00:00.000Z" },
      package: { acceptance: ["有三段"] },
      runs: []
    }),
    "/api/attention": () => ({ items: [{ id: `task:${TSK}`, color: "orange", title: "写周报", focusId: "foc_1", focusTitle: "周报", sourceKind: "task", refId: TSK }] }),
    "/api/focuses": () => [{ id: "foc_1", title: "周报", lifecycle: "active", currentRevision: 1 }]
  });
}

describe("createReviewPageSession", () => {
  beforeEach(() => useSessionFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("首屏成功后 WS 失效事件触发一次重取,视图更新", async () => {
    const stub = routes();
    const t = fakeTargets();
    const results: string[] = [];
    const session = createReviewPageSession(TSK, { onResult: (v) => results.push(v.ctx.task.id), onError: () => {} }, { targets: t });
    session.run();
    await flush();
    expect(results).toEqual([TSK]);
    expect(stub.count(`/api/tasks/${TSK}`)).toBe(1);

    dispatchDataInvalidate("confirm.resolved", t.win);
    await flush();
    expect(stub.count(`/api/tasks/${TSK}`)).toBe(2);
    expect(results).toEqual([TSK, TSK]);
    session.dispose();
  });

  it("dispose 后:失效事件/兜底定时器不再重取,在途晚到响应不回调", async () => {
    const stub = routes();
    const t = fakeTargets();
    const results: unknown[] = [];
    const errors: unknown[] = [];
    const session = createReviewPageSession(TSK, { onResult: (v) => results.push(v), onError: (e) => errors.push(e) }, { targets: t });
    session.run();
    // 在途中卸载
    session.dispose();
    await flush();
    expect(results).toEqual([]);
    expect(errors).toEqual([]);
    const after = stub.calls.length;
    dispatchDataInvalidate("focus.entity", t.win);
    t.doc.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(BOUNDED_REFRESH_MS * 2);
    session.run();
    await flush();
    expect(stub.calls.length).toBe(after);
    expect(results).toEqual([]);
  });
});
