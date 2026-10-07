import { describe, expect, it } from "vitest";
import { buildFocusWorkLookups, dispatchCardMatchesPackage, sessionOwnedByFocus } from "./focusWorkLookups";
import type { AttentionItemRow, FocusDetailPayload, TaskDetailPayload } from "./mappers";

const FOC = "foc_01WORKLOOKUP0000000000001";
const SID = "ses_01WORKLOOKUP0000000000001";
const PKG = "pkg_01WORKLOOKUP0000000000001";
const TSK = "tsk_01WORKLOOKUP0000000000001";

const emptyDetail = (packages: FocusDetailPayload["packages"] = []): FocusDetailPayload =>
  ({
    focus: { id: FOC, title: "周报", lifecycle: "active", currentRevision: 1, direction: "先写三段" },
    obligations: [],
    lanes: [],
    events: [],
    repos: [],
    artifacts: [],
    tasks: [],
    packages
  }) as FocusDetailPayload;

describe("sessionOwnedByFocus", () => {
  it("只有当前 sid 属于本 focus 会话才算接上", () => {
    expect(sessionOwnedByFocus(SID, [{ id: SID }])).toBe(true);
    expect(sessionOwnedByFocus(SID, [{ id: "ses_other" }])).toBe(false);
    expect(sessionOwnedByFocus(null, [{ id: SID }])).toBe(false);
  });
});

describe("buildFocusWorkLookups", () => {
  it("任务详情包与无任务 pending 包都能进 lookup,不依赖已执行任务", () => {
    const taskDetail: TaskDetailPayload = {
      task: { id: TSK, title: "导出", status: "queued", package_id: PKG, package_rev: 2, project_id: "prj_x" },
      package: { id: PKG, revision: 2, status: "approved", outcomePreview: "任务上的包" },
      runs: []
    };
    const focusDetail = emptyDetail([{ id: "pkg_pending", revision: 1, status: "proposed", outcomePreview: "待批包" }]);
    focusDetail.tasks = [{ id: TSK, title: "导出", status: "queued" }];
    const work = buildFocusWorkLookups({
      focusId: FOC,
      detail: focusDetail,
      taskDetails: [taskDetail],
      attention: [],
      liveCard: {
        receiptId: "rcpt_1",
        kind: "dispatch",
        packageId: "pkg_live",
        revision: 3,
        digest: "dig_live",
        text: "现场卡"
      },
      sessionOwned: true
    });
    expect(work.taskLookup[TSK]?.id).toBe(TSK);
    expect(work.packageLookup[PKG]?.revision).toBe(2);
    expect(work.packageLookup["pkg_pending"]?.outcomePreview).toBe("待批包");
    expect(work.packageLookup["pkg_live"]?.revision).toBe(3);
    expect(work.packageLookup["pkg_live@3"]?.outcomePreview).toBe("现场卡");
  });

  it("attention 仅在同 receipt 的 dispatch 卡上补包,其它卡不灌", () => {
    const attention: AttentionItemRow[] = [
      {
        id: "att_other",
        color: "orange",
        title: "别人的卡",
        focusId: FOC,
        confirmKind: "dispatch",
        refId: "rcpt_other"
      }
    ];
    const work = buildFocusWorkLookups({
      focusId: FOC,
      detail: emptyDetail(),
      taskDetails: [],
      attention,
      liveCard: {
        receiptId: "rcpt_mine",
        kind: "dispatch",
        packageId: "pkg_mine",
        revision: 1,
        digest: "dig"
      },
      sessionOwned: true
    });
    expect(work.packageLookup["pkg_mine"]).toBeDefined();
    expect(Object.values(work.packageLookup).some((p) => p.outcomePreview === "别人的卡")).toBe(false);
  });

  it("sessionOwned false 不把 live dispatch 卡灌进本 focus lookup", () => {
    const work = buildFocusWorkLookups({
      focusId: FOC,
      detail: emptyDetail(),
      taskDetails: [],
      attention: [],
      liveCard: {
        receiptId: "rcpt_foreign",
        kind: "dispatch",
        packageId: "pkg_foreign",
        revision: 1,
        digest: "dig",
        text: "别人的会话"
      },
      sessionOwned: false
    });
    expect(work.packageLookup["pkg_foreign"]).toBeUndefined();
  });
});

describe("dispatchCardMatchesPackage", () => {
  it("必须同 kind/packageId/revision 且有 receipt 与 digest", () => {
    const card = {
      receiptId: "rcpt_a",
      kind: "dispatch" as const,
      packageId: PKG,
      revision: 2,
      digest: "dig_a"
    };
    expect(dispatchCardMatchesPackage(card, { id: PKG, revision: 2 })).toBe(true);
    expect(dispatchCardMatchesPackage({ ...card, packageId: "pkg_other" }, { id: PKG, revision: 2 })).toBe(false);
    expect(dispatchCardMatchesPackage({ ...card, revision: 1 }, { id: PKG, revision: 2 })).toBe(false);
    expect(dispatchCardMatchesPackage({ ...card, digest: undefined }, { id: PKG, revision: 2 })).toBe(false);
    expect(dispatchCardMatchesPackage({ ...card, kind: "memory" }, { id: PKG, revision: 2 })).toBe(false);
  });
});


describe("Focus 同 revision 权威包状态", () => {
  function focus() {
    const d = emptyDetail([{ id: PKG, revision: 2, status: "approved", outcomePreview: "已拍板包" }]);
    d.tasks = [{ id: TSK, title: "绑定任务", status: "ready_for_review" }];
    return d;
  }
  function detail(revision = 2, taskId = TSK): TaskDetailPayload {
    return { task: { id: taskId, title: "绑定任务", status: "ready_for_review", package_id: PKG, package_rev: revision }, package: { id: PKG, revision, outcomePreview: "canonical body 不存 status" }, runs: [] };
  }
  function work(taskDetails: Array<TaskDetailPayload | null>) {
    return buildFocusWorkLookups({ focusId: FOC, detail: focus(), taskDetails, attention: [], sessionOwned: false });
  }
  it("正常详情 canonical body 缺 status 不覆写同 revision 的 approved", () => {
    const x = work([detail()]);
    expect(x.packageLookup[`${PKG}@2`]?.status).toBe("approved");
    expect(x.packageLookup[PKG]?.status).toBe("approved");
  });
  it("详情失败保留 Focus 包与已拍板状态", () => {
    expect(work([null]).packageLookup[`${PKG}@2`]?.status).toBe("approved");
  });
  it("不同 revision 不借旧状态", () => {
    const x = work([detail(3)]);
    expect(x.packageLookup[`${PKG}@2`]?.status).toBe("approved");
    expect(x.packageLookup[`${PKG}@3`]).toBeUndefined();
    expect(x.packageLookup[PKG]?.revision).toBe(2);
  });
  it("没有同 revision 权威状态的 canonical body 不新造 proposed 包", () => {
    const d = focus();
    d.packages = [];
    const x = buildFocusWorkLookups({ focusId: FOC, detail: d, taskDetails: [detail()], attention: [], sessionOwned: false });
    expect(x.packageLookup[PKG]).toBeUndefined();
    expect(x.packageLookup[`${PKG}@2`]).toBeUndefined();
  });
  it("外部任务详情不灌入本 Focus 包状态", () => {
    expect(work([detail(2, "tsk_foreign")]).packageLookup[`${PKG}@2`]?.status).toBe("approved");
  });
});
