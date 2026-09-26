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
    const work = buildFocusWorkLookups({
      focusId: FOC,
      detail: emptyDetail([{ id: "pkg_pending", revision: 1, status: "proposed", outcomePreview: "待批包" }]),
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
