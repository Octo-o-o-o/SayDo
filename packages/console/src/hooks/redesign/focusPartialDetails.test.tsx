import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildFocusWorkLookups } from "./focusWorkLookups";
import { createFocusPageSession, type FocusLoadResult } from "./useFocusPageData";
import { fakeTargets, flush, installFetchStub, useSessionFakeTimers } from "./sessionTestKit";
import type { FocusDetailPayload, TaskDetailPayload } from "./mappers";
import { TaskCard } from "../../components/redesign/TaskCard";
import { FocusPage } from "../../pages/redesign/FocusPage";

const FOC = "foc_01PARTIAL000000000000001";
const A = "tsk_01PARTIAL000000000000001";
const B = "tsk_01PARTIAL000000000000002";
function base(tasks: NonNullable<FocusDetailPayload["tasks"]> = []): FocusDetailPayload {
  return {
    focus: { id: FOC, title: "有绑定的工作", lifecycle: "active", currentRevision: 1, direction: null },
    tasks, packages: [], obligations: [], lanes: [], events: [], repos: [], artifacts: []
  };
}
function full(id = A): TaskDetailPayload {
  return { task: { id, title: "详情中的任务", status: "ready_for_review", viewStatus: "ready_for_review", attempt: 2, package_id: "pkg_real", package_rev: 3, project_id: "prj_real" }, package: null, runs: [] };
}
function work(detail: FocusDetailPayload, taskDetails: Array<TaskDetailPayload | null>) {
  return buildFocusWorkLookups({ focusId: FOC, detail, taskDetails, attention: [], sessionOwned: false });
}

describe("Focus 绑定任务详情局部缺失", () => {
  beforeEach(() => useSessionFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("一条绑定详情缺失仍保留真实任务，卡片只给读口", () => {
    const x = work(base([{ id: A, title: "绑定的真实标题", status: "review_approved_waiting_merge" }]), [null]);
    expect(x.tasks.map((t) => t.id)).toEqual([A]);
    const task = x.taskLookup[A]!;
    expect(task.title).toBe("绑定的真实标题");
    expect(task.lastEvent).toBe("review_approved_waiting_merge");
    expect(task).toMatchObject({ detailUnavailable: true });
    expect(task.projectId).toBeUndefined(); expect(task.package_id).toBeUndefined(); expect(task.package_rev).toBeUndefined();
    const html = renderToStaticMarkup(<TaskCard task={task} onAction={() => {}} />);
    expect(html).toContain("详情未加载"); expect(html).toContain("重读详情"); expect(html).toContain("查看任务详情");
    for (const unsafe of ["第 0 次尝试", "用本机认证批准合并", "重派", "去验收", "回答", "熔断"]) expect(html).not.toContain(unsafe);
  });

  it("真实空绑定保持空，不以孤立详情伪造任务", () => {
    const x = work(base(), [full()]);
    expect(x.tasks).toEqual([]); expect(x.taskLookup).toEqual({});
  });

  it("完整详情按任务id补齐，部分多任务保持绑定顺序和数量", () => {
    const x = work(base([{ id: A, title: "一", status: "running" }, { id: B, title: "二", status: "queued" }]), [full(B), null]);
    expect(x.tasks.map((t) => t.id)).toEqual([A, B]);
    expect(x.taskLookup[A]).toMatchObject({ detailUnavailable: true, title: "一", lastEvent: "running" });
    expect(x.taskLookup[B]).toMatchObject({ title: "详情中的任务", attempt: 2, package_id: "pkg_real", package_rev: 3, projectId: "prj_real" });
    expect(renderToStaticMarkup(<TaskCard task={x.taskLookup[B]!} />)).toContain("去验收");
  });

  it("异任务详情不能填进本绑定或带入它的包", () => {
    const x = work(base([{ id: A, title: "一", status: "running" }]), [{ ...full(B), package: { id: "pkg_foreign", revision: 1 } }]);
    expect(x.tasks.map((t) => t.id)).toEqual([A]); expect(x.packageLookup.pkg_foreign).toBeUndefined();
    expect(x.taskLookup[A]).toMatchObject({ detailUnavailable: true });
  });

  it("生产loader GET失败保留工作面与上下文任务，重读恢复真实详情", async () => {
    const detail = base([{ id: A, title: "绑定标题", status: "ready_for_review" }, { id: B, title: "另一条", status: "queued" }]);
    const stub = installFetchStub({
      [`/api/focuses/${FOC}`]: () => detail,
      [`/api/focuses/${FOC}/timeline`]: () => ({ items: [], nextCursor: null }),
      [`/api/focuses/${FOC}/sessions`]: () => ({ sessions: [] }),
      "/api/focuses": () => [], "/api/attention": () => ({ items: [] }),
      [`/api/tasks/${A}`]: () => full(A), [`/api/tasks/${B}`]: () => full(B)
    });
    stub.fail(`/api/tasks/${A}`, "合成单条读取失败");
    const results: FocusLoadResult[] = []; const errors: unknown[] = [];
    const session = createFocusPageSession(FOC, null, { onResult: (x) => results.push(x), onError: (x) => errors.push(x) }, { targets: fakeTargets() });
    try {
      session.run(); await flush();
      const v = results.at(-1)!.view;
      expect(errors).toEqual([]); expect(v.rail.tasks.map((t) => t.id)).toEqual([A, B]);
      expect(v.lookups?.tasks?.[A]).toMatchObject({ detailUnavailable: true, title: "绑定标题" });
      const conversation = renderToStaticMarkup(<FocusPage view={v} onAction={() => {}} />);
      const context = renderToStaticMarkup(<FocusPage view={v} initialTab="context" onAction={() => {}} />);
      expect(conversation).toContain(`data-focus-work-task="${A}"`); expect(conversation).toContain("详情未加载");
      expect(context).toContain(A); expect(context).toContain("绑定标题");
      stub.restore(`/api/tasks/${A}`); session.run(); await flush();
      expect(stub.count(`/api/tasks/${A}`)).toBe(2);
      expect(results.at(-1)!.view.lookups?.tasks?.[A]).not.toHaveProperty("detailUnavailable", true);
      expect(results.at(-1)!.view.lookups?.tasks?.[A]?.attempt).toBe(2);
    } finally { session.dispose(); }
  });

  it("生产loader真实空绑定和正常详情控制", async () => {
    let detail = base();
    const stub = installFetchStub({
      [`/api/focuses/${FOC}`]: () => detail,
      [`/api/focuses/${FOC}/timeline`]: () => ({ items: [], nextCursor: null }),
      "/api/focuses": () => [], [`/api/tasks/${A}`]: () => full(A)
    });
    const results: FocusLoadResult[] = [];
    const session = createFocusPageSession(FOC, null, { onResult: (x) => results.push(x), onError: () => {} }, { targets: fakeTargets() });
    try {
      session.run(); await flush(); expect(results.at(-1)!.view.rail.tasks).toEqual([]); expect(stub.count(`/api/tasks/${A}`)).toBe(0);
      detail = base([{ id: A, title: "绑定", status: "ready_for_review" }]); session.run(); await flush();
      expect(results.at(-1)!.view.lookups?.tasks?.[A]?.package_id).toBe("pkg_real");
    } finally { session.dispose(); }
  });
});
