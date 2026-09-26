import { describe, expect, it } from "vitest";
import { ApiError } from "./apiError";
import {
  CANCELABLE_TASK_STATUSES,
  canSendConfirmationInput,
  canSendTaskContextText,
  confirmCardMatches,
  isMissingSessionError,
  isMissingTaskError,
  parseTaskDetailPayload,
  shouldApplyTaskContext,
  taskActionsAllowed,
  taskContextFailCopy,
  taskDetailHref,
  taskModalTargetKey,
  taskStatusLabel
} from "./taskModalView";

describe("parseTaskDetailPayload", () => {
  it("只认 getTaskDetail 的 task 包,不把整包当任务行", () => {
    expect(
      parseTaskDetailPayload({
        task: {
          id: "tsk_1",
          title: "报表导出 CSV",
          status: "ready_for_review",
          viewStatus: "ready_for_review",
          project_id: "prj_1"
        },
        runs: []
      })
    ).toEqual({
      id: "tsk_1",
      title: "报表导出 CSV",
      status: "ready_for_review",
      viewStatus: "ready_for_review",
      projectId: "prj_1"
    });
  });

  it("缺 task.id 或 null 载荷视为不存在,不回落进行中", () => {
    expect(parseTaskDetailPayload(null)).toBeNull();
    expect(parseTaskDetailPayload({ runs: [] })).toBeNull();
    expect(parseTaskDetailPayload({ task: { title: "无 id" } })).toBeNull();
  });
});

describe("taskActionsAllowed", () => {
  it("与任务详情同一取消集合", () => {
    expect([...CANCELABLE_TASK_STATUSES]).toEqual([
      "confirmed",
      "queued",
      "running",
      "blocked",
      "paused_step_boundary",
      "ready_for_review"
    ]);
    expect(taskActionsAllowed("running")).toEqual({ cancel: true, steer: true });
    expect(taskActionsAllowed("ready_for_review")).toEqual({ cancel: true, steer: false });
  });

  it("终态不默认叫停/steer", () => {
    for (const s of ["task_done", "cancel_settled", "superseded"]) {
      expect(taskActionsAllowed(s)).toEqual({ cancel: false, steer: false });
    }
    expect(taskActionsAllowed("failed")).toEqual({ cancel: false, steer: false });
    expect(taskActionsAllowed("merging")).toEqual({ cancel: false, steer: false });
    expect(taskActionsAllowed("")).toEqual({ cancel: false, steer: false });
  });
});

describe("confirmCardMatches", () => {
  it("只操作同一 receiptId,不碰无关确认卡", () => {
    expect(confirmCardMatches({ receiptId: "rcpt_a" }, "rcpt_a")).toBe(true);
    expect(confirmCardMatches({ receiptId: "rcpt_b" }, "rcpt_a")).toBe(false);
    expect(confirmCardMatches(null, "rcpt_a")).toBe(false);
  });

  it("dispatch 卡必须同 packageId/revision/digest,其它包打不开", () => {
    const card = {
      receiptId: "rcpt_a",
      kind: "dispatch",
      packageId: "pkg_1",
      revision: 2,
      digest: "dig_a"
    };
    expect(confirmCardMatches(card, "rcpt_a", { kind: "dispatch", packageId: "pkg_1", revision: 2, digest: "dig_a" })).toBe(
      true
    );
    expect(confirmCardMatches(card, "rcpt_a", { kind: "dispatch", packageId: "pkg_other", revision: 2 })).toBe(false);
    expect(confirmCardMatches(card, "rcpt_a", { kind: "dispatch", packageId: "pkg_1", revision: 1 })).toBe(false);
    expect(confirmCardMatches({ ...card, digest: "dig_b" }, "rcpt_a", { packageId: "pkg_1", revision: 2, digest: "dig_a" })).toBe(
      false
    );
  });

  it("实体带 taskId 时卡缺 taskId 必须拒,且 kind 必须匹配", () => {
    const card = {
      receiptId: "rcpt_rt",
      kind: "runtime_effect",
      taskId: "tsk_1",
      digest: "dig_rt"
    };
    expect(
      confirmCardMatches(card, "rcpt_rt", { kind: "runtime_effect", taskId: "tsk_1", digest: "dig_rt" })
    ).toBe(true);
    expect(confirmCardMatches({ receiptId: "rcpt_rt", kind: "runtime_effect" }, "rcpt_rt", { taskId: "tsk_1" })).toBe(
      false
    );
    expect(confirmCardMatches({ ...card, taskId: "tsk_other" }, "rcpt_rt", { taskId: "tsk_1" })).toBe(false);
    expect(confirmCardMatches(card, "rcpt_rt", { kind: "memory", taskId: "tsk_1" })).toBe(false);
    expect(
      confirmCardMatches({ receiptId: "rcpt_rt", kind: "readiness", taskId: "tsk_1" }, "rcpt_rt", {
        kind: "runtime_effect",
        taskId: "tsk_1"
      })
    ).toBe(false);
  });
});

describe("canSendConfirmationInput", () => {
  it("错卡或错 session 的文本决定也不能发", () => {
    expect(
      canSendConfirmationInput({
        card: { receiptId: "rcpt_b" },
        targetReceiptId: "rcpt_a",
        targetSessionId: "ses_1",
        liveSessionId: "ses_1",
        text: "不要"
      })
    ).toBe(false);
    expect(
      canSendConfirmationInput({
        card: { receiptId: "rcpt_a" },
        targetReceiptId: "rcpt_a",
        targetSessionId: "ses_old",
        liveSessionId: "ses_new",
        text: "不要"
      })
    ).toBe(false);
    expect(
      canSendConfirmationInput({
        card: { receiptId: "rcpt_a" },
        targetReceiptId: "rcpt_a",
        targetSessionId: "ses_1",
        liveSessionId: "ses_1",
        text: "不要"
      })
    ).toBe(true);
  });
});

describe("canSendTaskContextText / 详情入口", () => {
  it("没有 nonce 或空文案不能发;nonce 必须绑当前 session", () => {
    expect(canSendTaskContextText({ nonce: null, text: "hi" })).toBe(false);
    expect(canSendTaskContextText({ nonce: "n1", text: "  " })).toBe(false);
    expect(canSendTaskContextText({ nonce: "n1", text: "hi" })).toBe(true);
    expect(canSendTaskContextText({ nonce: "n1", text: "hi", nonceSessionId: "ses_old", liveSessionId: "ses_new" })).toBe(
      false
    );
    expect(canSendTaskContextText({ nonce: "n1", text: "hi", nonceSessionId: "ses_1", liveSessionId: "ses_1" })).toBe(
      true
    );
  });

  it("验收态走 review,其余走项目任务详情", () => {
    expect(taskDetailHref({ id: "tsk_1", projectId: "prj_1", viewStatus: "ready_for_review" })).toBe(
      "#/review/tsk_1"
    );
    expect(taskDetailHref({ id: "tsk_1", projectId: "prj_1", viewStatus: "running" })).toBe(
      "#/p/prj_1/task/tsk_1"
    );
    expect(taskDetailHref({ id: "tsk_1", viewStatus: "running" })).toBe("#/review/tsk_1");
  });
});

describe("taskStatusLabel", () => {
  it("加载/失败/不存在不冒充进行中", () => {
    expect(taskStatusLabel("running", "loading")).toBe("正在加载");
    expect(taskStatusLabel(undefined, "missing")).toBe("不存在");
    expect(taskStatusLabel(undefined, "failed")).toBe("加载失败");
    expect(taskStatusLabel(undefined, "ready")).toBe("状态未知");
    expect(taskStatusLabel("running", "ready")).toBe("running");
  });
});

describe("task context 身份绑定", () => {
  it("只把结果应用到同一 target + 当前 session", () => {
    expect(taskModalTargetKey({ kind: "obligation", id: "fob_1" })).toBe("obligation:fob_1");
    expect(
      shouldApplyTaskContext({
        requestTargetKey: "obligation:a",
        liveTargetKey: "obligation:b",
        requestSessionId: "ses_1",
        liveSessionId: "ses_1"
      })
    ).toBe(false);
    expect(
      shouldApplyTaskContext({
        requestTargetKey: "obligation:a",
        liveTargetKey: "obligation:a",
        requestSessionId: "ses_old",
        liveSessionId: "ses_new"
      })
    ).toBe(false);
    expect(
      shouldApplyTaskContext({
        requestTargetKey: "obligation:a",
        liveTargetKey: "obligation:a",
        requestSessionId: "ses_1",
        liveSessionId: "ses_1"
      })
    ).toBe(true);
  });

  it("上下文失败用人话,不把 session 404 写成整页失败", () => {
    expect(isMissingSessionError(new ApiError("session missing", { kind: "client", retryable: false, code: "session_not_found" }))).toBe(
      true
    );
    expect(taskContextFailCopy(new ApiError("session x not found", { kind: "client", retryable: false, code: "session_not_found" }))).toContain(
      "详情可以先看"
    );
    expect(taskContextFailCopy(new ApiError("session x not found", { kind: "client", retryable: false, code: "session_not_found" }))).not.toMatch(
      /REST|404|session_not_found/
    );
  });
});

describe("isMissingTaskError", () => {
  it("404/not_found/空 JSON 当不存在", () => {
    expect(isMissingTaskError(new ApiError("没这个任务", { kind: "client", retryable: false, code: "not_found" }))).toBe(
      true
    );
    expect(isMissingTaskError(new ApiError("这个请求没被接受", { kind: "client", retryable: false, status: 404 }))).toBe(
      true
    );
    expect(isMissingTaskError(new Error("服务返回了看不懂的内容"))).toBe(true);
    expect(isMissingTaskError(new ApiError("连不上 SayDo 服务", { kind: "network", retryable: true }))).toBe(false);
  });
});
