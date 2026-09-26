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

  it("loadOlder 成功合并更早时间线,失败保留旧视图", async () => {
    const stub = installFetchStub({
      [`/api/focuses/${FOC}`]: () => ({
        focus: { id: FOC, title: "周报", lifecycle: "active", currentRevision: 1, direction: "先写三段" },
        obligations: [],
        lanes: [],
        events: [],
        repos: [],
        artifacts: []
      }),
      [`/api/focuses/${FOC}/timeline`]: (url) => {
        if (String(url).includes("cursor=")) {
          return { items: [{ seq: 1, ts: "t1", kind: "event", eventType: "created", summary: "更早" }], nextCursor: null };
        }
        return { items: [{ seq: 2, ts: "t2", kind: "event", eventType: "note", summary: "首页" }], nextCursor: 1 };
      },
      "/api/focuses": () => [{ id: FOC, title: "周报", lifecycle: "active", currentRevision: 1 }]
    });
    const t = fakeTargets();
    const results: Array<{ seqs: number[]; cursor: number | null }> = [];
    const errors: unknown[] = [];
    const olderErrors: Array<string | null> = [];
    const session = createFocusPageSession(
      FOC,
      null,
      {
        onResult: (r) => results.push({ seqs: r.view.timeline.map((i) => i.seq), cursor: r.nextCursor }),
        onError: (e) => errors.push(e),
        onOlderError: (m) => olderErrors.push(m)
      },
      { targets: t }
    );
    session.run();
    await flush();
    expect(results.at(-1)).toEqual({ seqs: [2], cursor: 1 });
    stub.fail(`/api/focuses/${FOC}/timeline`, "timeline 5xx");
    await session.loadOlder();
    await flush();
    expect(results.at(-1)).toEqual({ seqs: [2], cursor: 1 });
    expect(errors).toEqual([]);
    expect(olderErrors).toEqual(["timeline 5xx"]);
    stub.restore(`/api/focuses/${FOC}/timeline`);
    await session.loadOlder();
    await flush();
    expect(results.at(-1)).toEqual({ seqs: [1, 2], cursor: null });
    expect(olderErrors.at(-1)).toBeNull();
    expect(errors).toEqual([]);
    const olderInit = stub.inits.find((init, i) => stub.calls[i] === `/api/focuses/${FOC}/timeline` && Boolean(init?.signal));
    expect(olderInit?.signal).toBeTruthy();
    session.dispose();
  });

  it("A→B→A 或卸载后,旧 loadOlder 不得写回新会话", async () => {
    const FOC_B = "foc_02BBBBBBBBBBBBBBBBBBBBBBBB";
    const stub = installFetchStub({
      [`/api/focuses/${FOC}`]: () => ({
        focus: { id: FOC, title: "A", lifecycle: "active", currentRevision: 1, direction: null },
        obligations: [],
        lanes: [],
        events: [],
        repos: [],
        artifacts: []
      }),
      [`/api/focuses/${FOC_B}`]: () => ({
        focus: { id: FOC_B, title: "B", lifecycle: "active", currentRevision: 1, direction: null },
        obligations: [],
        lanes: [],
        events: [],
        repos: [],
        artifacts: []
      }),
      [`/api/focuses/${FOC}/timeline`]: (url) => {
        if (String(url).includes("cursor=")) {
          return { items: [{ seq: 9, ts: "told", kind: "event", eventType: "old", summary: "旧页" }], nextCursor: null };
        }
        return { items: [{ seq: 2, ts: "t2", kind: "event", eventType: "note", summary: "A首页" }], nextCursor: 1 };
      },
      [`/api/focuses/${FOC_B}/timeline`]: () => ({ items: [{ seq: 3, ts: "t3", kind: "event", eventType: "note", summary: "B" }], nextCursor: null }),
      "/api/focuses": () => [
        { id: FOC, title: "A", lifecycle: "active", currentRevision: 1 },
        { id: FOC_B, title: "B", lifecycle: "active", currentRevision: 1 }
      ]
    });
    const t = fakeTargets();
    const a1: string[] = [];
    const b: string[] = [];
    const a2: string[] = [];
    const sessionA = createFocusPageSession(FOC, "ses_a", { onResult: (r) => a1.push(r.view.timeline.map((i) => i.seq).join(",")), onError: () => {} }, { targets: t });
    sessionA.run();
    await flush();
    const hold = stub.holdNext(`/api/focuses/${FOC}/timeline`);
    void sessionA.loadOlder();
    await flush();
    sessionA.dispose();
    const sessionB = createFocusPageSession(FOC_B, "ses_b", { onResult: (r) => b.push(r.view.focus.id), onError: () => {} }, { targets: t });
    sessionB.run();
    await flush();
    sessionB.dispose();
    const sessionA2 = createFocusPageSession(FOC, "ses_a2", { onResult: (r) => a2.push(r.view.timeline.map((i) => i.seq).join(",")), onError: () => {} }, { targets: t });
    sessionA2.run();
    await flush();
    hold.release({ items: [{ seq: 9, ts: "told", kind: "event", eventType: "old", summary: "旧页" }], nextCursor: null });
    await flush();
    expect(a1).toEqual(["2"]);
    expect(b).toEqual([FOC_B]);
    expect(a2.at(-1)).toBe("2");
    expect(a2.join("|")).not.toContain("9");
    sessionA2.dispose();
  });

  it("翻到末页后多次后台刷新不恢复 nextCursor", async () => {
    installFetchStub({
      [`/api/focuses/${FOC}`]: () => ({
        focus: { id: FOC, title: "周报", lifecycle: "active", currentRevision: 1, direction: "先写三段" },
        obligations: [],
        lanes: [],
        events: [],
        repos: [],
        artifacts: []
      }),
      [`/api/focuses/${FOC}/timeline`]: (url) => {
        if (String(url).includes("cursor=")) return { items: [{ seq: 1, ts: "t1", kind: "event", eventType: "created", summary: "更早" }], nextCursor: null };
        return { items: [{ seq: 2, ts: "t2", kind: "event", eventType: "note", summary: "首页" }], nextCursor: 50 };
      },
      "/api/focuses": () => [{ id: FOC, title: "周报", lifecycle: "active", currentRevision: 1 }]
    });
    const t = fakeTargets();
    const cursors: Array<number | null> = [];
    const session = createFocusPageSession(FOC, null, { onResult: (r) => cursors.push(r.nextCursor), onError: () => {} }, { targets: t });
    session.run();
    await flush();
    await session.loadOlder();
    await flush();
    session.run();
    await flush();
    session.run();
    await flush();
    expect(cursors).toEqual([50, null, null, null]);
    session.dispose();
  });

  it("onExpandSegment 按 sessionRef 持有在途,跨项不取消,同项重试才替换", async () => {
    const pathA = `/api/focuses/${FOC}/activations/fac_a/transcript`;
    const pathB = `/api/focuses/${FOC}/activations/fac_b/transcript`;
    const held = installFetchStub({
      [`/api/focuses/${FOC}`]: () => ({
        focus: { id: FOC, title: "周报", lifecycle: "active", currentRevision: 1, direction: "先写三段" },
        obligations: [],
        lanes: [],
        events: [],
        repos: [],
        artifacts: []
      }),
      [`/api/focuses/${FOC}/timeline`]: () => ({ items: [], nextCursor: null }),
      "/api/focuses": () => [{ id: FOC, title: "周报", lifecycle: "active", currentRevision: 1 }],
      [pathA]: () => ({ available: true, turns: [{ turnId: "ta", speaker: "user", text: "A", ts: "2026-09-13T00:00:00.000Z" }] }),
      [pathB]: () => ({ available: true, turns: [{ turnId: "tb", speaker: "user", text: "B", ts: "2026-09-13T00:00:00.000Z" }] })
    });
    const t = fakeTargets();
    const session = createFocusPageSession(FOC, null, { onResult: () => {}, onError: () => {} }, { targets: t });
    session.run();
    await flush();
    const holdA = held.holdNext(pathA);
    const holdB = held.holdNext(pathB);
    const pendingA = session.onExpandSegment("fac_a");
    await flush();
    const pendingB = session.onExpandSegment("fac_b");
    await flush();
    const initA = held.inits.find((init, i) => held.calls[i] === pathA);
    const initB = held.inits.find((init, i) => held.calls[i] === pathB);
    expect(initA?.signal?.aborted).toBe(false);
    expect(initB?.signal?.aborted).toBe(false);
    holdA.release({
      available: true,
      turns: [{ turnId: "ta", speaker: "user", text: "A", ts: "2026-09-13T00:00:00.000Z" }]
    });
    holdB.release({
      available: true,
      turns: [{ turnId: "tb", speaker: "user", text: "B", ts: "2026-09-13T00:00:00.000Z" }]
    });
    expect(await pendingA).toEqual(["你: A"]);
    expect(await pendingB).toEqual(["你: B"]);

    const holdA1 = held.holdNext(pathA);
    const firstRetry = session.onExpandSegment("fac_a");
    await flush();
    const firstInit = held.inits[held.inits.length - 1];
    expect(held.calls[held.calls.length - 1]).toBe(pathA);
    const holdA2 = held.holdNext(pathA);
    const secondRetry = session.onExpandSegment("fac_a");
    await flush();
    expect(firstInit?.signal?.aborted).toBe(true);
    holdA1.release({
      available: true,
      turns: [{ turnId: "old", speaker: "user", text: "旧", ts: "2026-09-13T00:00:00.000Z" }]
    });
    holdA2.release({
      available: true,
      turns: [{ turnId: "new", speaker: "user", text: "新", ts: "2026-09-13T00:00:00.000Z" }]
    });
    expect(await firstRetry).toBeNull();
    expect(await secondRetry).toEqual(["你: 新"]);
    session.dispose();
  });

  it("onExpandSegment 随会话 abort,dispose 后晚到不返回正文", async () => {
    const path = `/api/focuses/${FOC}/activations/fac_1/transcript`;
    const held = installFetchStub({
      [`/api/focuses/${FOC}`]: () => ({
        focus: { id: FOC, title: "周报", lifecycle: "active", currentRevision: 1, direction: "先写三段" },
        obligations: [],
        lanes: [],
        events: [],
        repos: [],
        artifacts: []
      }),
      [`/api/focuses/${FOC}/timeline`]: () => ({ items: [], nextCursor: null }),
      "/api/focuses": () => [{ id: FOC, title: "周报", lifecycle: "active", currentRevision: 1 }],
      [path]: () => ({ available: true, turns: [{ turnId: "t1", speaker: "user", text: "晚到", ts: "2026-09-13T00:00:00.000Z" }] })
    });
    const t = fakeTargets();
    const session = createFocusPageSession(FOC, null, { onResult: () => {}, onError: () => {} }, { targets: t });
    session.run();
    await flush();
    const hold = held.holdNext(path);
    const pending = session.onExpandSegment("fac_1");
    await flush();
    const expInit = held.inits.find((init, i) => held.calls[i] === path);
    expect(expInit?.signal).toBeTruthy();
    session.dispose();
    expect(expInit?.signal?.aborted).toBe(true);
    hold.release({
      available: true,
      turns: [{ turnId: "t1", speaker: "user", text: "晚到", ts: "2026-09-13T00:00:00.000Z" }]
    });
    expect(await pending).toBeNull();
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
