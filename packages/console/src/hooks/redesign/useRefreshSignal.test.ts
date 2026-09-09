// VIEW-01 失效来源单测:WS 失效事件 / visibilitychange 回前台 / 有界兜底刷新(后台暂停)/ 卸载零残留。
// 仓内无 DOM 测试环境:用 EventTarget 假 window/document 驱动纯安装函数(hook 只是薄包装)。

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DATA_INVALIDATE_EVENT, dispatchDataInvalidate } from "../../lib/dataInvalidate";
import { BOUNDED_REFRESH_MS, installRefreshSignal, type RefreshReason } from "./useRefreshSignal";

class FakeDoc extends EventTarget {
  visibilityState: "visible" | "hidden" = "visible";
}

function setup(intervalMs?: number) {
  const win = new EventTarget();
  const doc = new FakeDoc();
  const calls: RefreshReason[] = [];
  const dispose = installRefreshSignal((reason) => calls.push(reason), {
    targets: { win, doc },
    ...(intervalMs !== undefined ? { intervalMs } : {})
  });
  return { win, doc, calls, dispose };
}

describe("installRefreshSignal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("WS 失效事件(focus.entity / confirm.resolved / 重连)各触发一次重取", () => {
    const s = setup();
    dispatchDataInvalidate("focus.entity", s.win);
    dispatchDataInvalidate("confirm.resolved", s.win);
    dispatchDataInvalidate("ws.reconnect", s.win);
    expect(s.calls).toEqual(["invalidate", "invalidate", "invalidate"]);
    s.dispose();
  });

  it("visibilitychange 回前台触发一次重取;转后台不触发", () => {
    const s = setup();
    s.doc.visibilityState = "hidden";
    s.doc.dispatchEvent(new Event("visibilitychange"));
    expect(s.calls).toEqual([]);
    s.doc.visibilityState = "visible";
    s.doc.dispatchEvent(new Event("visibilitychange"));
    expect(s.calls).toEqual(["visibility"]);
    s.dispose();
  });

  it("兜底刷新上限 60 s,后台标签页暂停,回前台恢复", () => {
    expect(BOUNDED_REFRESH_MS).toBeLessThanOrEqual(60_000);
    const s = setup();
    vi.advanceTimersByTime(BOUNDED_REFRESH_MS);
    expect(s.calls).toEqual(["interval"]);
    s.doc.visibilityState = "hidden";
    s.doc.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(BOUNDED_REFRESH_MS * 3);
    expect(s.calls).toEqual(["interval"]);
    s.doc.visibilityState = "visible";
    s.doc.dispatchEvent(new Event("visibilitychange"));
    expect(s.calls).toEqual(["interval", "visibility"]);
    vi.advanceTimersByTime(BOUNDED_REFRESH_MS);
    expect(s.calls).toEqual(["interval", "visibility", "interval"]);
    s.dispose();
  });

  it("反复安装/卸载后无残留定时器与监听", () => {
    for (let i = 0; i < 3; i++) {
      const s = setup(1_000);
      s.dispose();
      expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(5_000);
      s.win.dispatchEvent(new CustomEvent(DATA_INVALIDATE_EVENT, { detail: { source: "focus.entity" } }));
      s.doc.dispatchEvent(new Event("visibilitychange"));
      expect(s.calls).toEqual([]);
    }
  });
});
