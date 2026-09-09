// VIEW-01 看板拼装纯函数单测:某 Focus detail 5xx 时该事仍在看板(占位错误 + 重试),
// attention 投影的任务不丢;颜色近似出来的任务状态标为待核实。

import { describe, expect, it } from "vitest";
import { assembleBoardView } from "./useBoardPageData";
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
