// VIEW-01 看板拼装纯函数单测:某 Focus detail 5xx 时该事仍在看板(占位错误 + 重试),
// attention 投影的任务不丢;颜色近似出来的任务状态标为待核实。

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assembleBoardView, createBoardPageSession } from "./useBoardPageData";
import { fakeTargets, flush, installFetchStub, useSessionFakeTimers } from "./sessionTestKit";
import type { AttentionItemRow, FocusDetailPayload, FocusListRow } from "./mappers";

const rows: FocusListRow[] = [
  { id: "foc_ok", title: "正常的事", lifecycle: "active", currentRevision: 2 },
  { id: "foc_bad", title: "详情拉不下来的事", lifecycle: "captured", currentRevision: 1, direction: "先看一眼" },
  { id: "foc_closed", title: "已收官不上板", lifecycle: "closed", currentRevision: 3 }
];

const okDetail: FocusDetailPayload = {
  focus: { id: "foc_ok", title: "正常的事", lifecycle: "active", currentRevision: 2, direction: null },
  obligations: [{ id: "ob_1", title: "回一封邮件", owner: "human", status: "open", needs: "action" }],
  lanes: [],
  events: [],
  repos: [],
  artifacts: []
};

const attention: AttentionItemRow[] = [
  { id: "task:tsk_1", color: "green", title: "跑中的任务", focusId: "foc_bad", sourceKind: "task", refId: "tsk_1" },
  { id: "ob:ob_1", color: "orange", title: "回一封邮件", focusId: "foc_ok", sourceKind: "obligation", refId: "ob_1" }
];

describe("assembleBoardView", () => {
  it("detail 失败的 Focus 保留在看板并带占位错误,visibleFocuses 不减", () => {
    const view = assembleBoardView(rows, attention, [
      { id: "foc_ok", detail: okDetail, error: null },
      { id: "foc_bad", detail: null, error: "500 服务端错误" }
    ]);
    expect(view.groups.map((g) => g.focus.id)).toEqual(["foc_ok", "foc_bad"]);
    expect(view.detailErrors).toEqual({ foc_bad: "500 服务端错误" });
    const bad = view.groups[1]!;
    expect(bad.focus.title).toBe("详情拉不下来的事");
    expect(bad.focus.lifecycle).toBe("captured");
    expect(bad.focus.direction).toBe("先看一眼");
    expect(bad.lanes).toEqual([{ id: "__main__", title: "主线" }]);
    // attention 投影的任务仍挂在该事上,不因 detail 失败凭空消失
    expect(bad.tasksByLane["__main__"]?.map((t) => t.id)).toEqual(["tsk_1"]);
    expect(bad.obligationsByLane["__main__"]).toEqual([]);
  });

  it("正常 Focus 的义务与需要你计数不受影响", () => {
    const view = assembleBoardView(rows, attention, [
      { id: "foc_ok", detail: okDetail, error: null },
      { id: "foc_bad", detail: null, error: "boom" }
    ]);
    const ok = view.groups[0]!;
    expect(ok.obligationsByLane["__main__"]?.map((o) => o.id)).toEqual(["ob_1"]);
    expect(view.detailErrors?.["foc_ok"]).toBeUndefined();
  });

  it("按 attention 颜色近似出的任务状态一律标记待核实", () => {
    const view = assembleBoardView(rows, attention, [
      { id: "foc_ok", detail: okDetail, error: null },
      { id: "foc_bad", detail: null, error: "boom" }
    ]);
    expect(view.approxStatusTaskIds).toEqual(["tsk_1"]);
    expect(view.groups[1]!.tasksByLane["__main__"]?.[0]?.viewStatus).toBe("running");
  });
});

describe("createBoardPageSession.retryDetail(GAP-02 残项 2.2)", () => {
  beforeEach(() => useSessionFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function routes() {
    return installFetchStub({
      "/api/focuses": () => rows,
      "/api/attention": () => ({ items: attention }),
      "/api/focuses/foc_ok": () => okDetail,
      "/api/focuses/foc_bad": () => ({
        focus: { id: "foc_bad", title: "详情拉不下来的事", lifecycle: "captured", currentRevision: 1, direction: "先看一眼" },
        obligations: [{ id: "ob_2", title: "补上的义务", owner: "human", status: "open", needs: "action" }],
        lanes: [],
        events: [],
        repos: [],
        artifacts: []
      })
    });
  }

  it("定向重试只重拉该 Focus 的 detail,不重拉列表/attention/其它 detail;成功后占位消失", async () => {
    const stub = routes();
    stub.fail("/api/focuses/foc_bad", "500 服务端错误");
    const t = fakeTargets();
    const views: ReturnType<typeof assembleBoardView>[] = [];
    const session = createBoardPageSession({ onResult: (v) => views.push(v), onError: () => {} }, { targets: t });
    session.run();
    await flush();
    expect(views.at(-1)?.detailErrors).toEqual({ foc_bad: "500 服务端错误" });
    const before = { list: stub.count("/api/focuses"), at: stub.count("/api/attention"), ok: stub.count("/api/focuses/foc_ok"), bad: stub.count("/api/focuses/foc_bad") };

    stub.restore("/api/focuses/foc_bad");
    session.retryDetail("foc_bad");
    await flush();
    expect(stub.count("/api/focuses")).toBe(before.list);
    expect(stub.count("/api/attention")).toBe(before.at);
    expect(stub.count("/api/focuses/foc_ok")).toBe(before.ok);
    expect(stub.count("/api/focuses/foc_bad")).toBe(before.bad + 1);
    const view = views.at(-1)!;
    expect(view.detailErrors).toEqual({});
    expect(view.groups.map((g) => g.focus.id)).toEqual(["foc_ok", "foc_bad"]);
    expect(view.groups[1]!.obligationsByLane["__main__"]?.map((o) => o.id)).toEqual(["ob_2"]);
    session.dispose();
  });

  it("定向重试再失败:该事仍在板上,占位错误保留(更新为最新人话)", async () => {
    const stub = routes();
    stub.fail("/api/focuses/foc_bad", "第一次 500");
    const t = fakeTargets();
    const views: ReturnType<typeof assembleBoardView>[] = [];
    const session = createBoardPageSession({ onResult: (v) => views.push(v), onError: () => {} }, { targets: t });
    session.run();
    await flush();
    stub.fail("/api/focuses/foc_bad", "第二次 503");
    session.retryDetail("foc_bad");
    await flush();
    const view = views.at(-1)!;
    expect(view.groups.map((g) => g.focus.id)).toEqual(["foc_ok", "foc_bad"]);
    expect(view.detailErrors?.["foc_bad"]).toContain("第二次 503");
    session.dispose();
  });

  it("dispose 后 retryDetail 不发请求、不回调", async () => {
    const stub = routes();
    const t = fakeTargets();
    const views: unknown[] = [];
    const session = createBoardPageSession({ onResult: (v) => views.push(v), onError: () => {} }, { targets: t });
    session.run();
    await flush();
    const n = views.length;
    const calls = stub.calls.length;
    session.dispose();
    session.retryDetail("foc_bad");
    await flush();
    expect(stub.calls.length).toBe(calls);
    expect(views.length).toBe(n);
  });
});
