import { describe, expect, it } from "vitest";
import type { LiveInterviewSpoken } from "../../hooks/redesign/liveInterview";
import type { InterviewAnchorCommit, InterviewRoundLease } from "../../voice/interviewAnchor";
import { focusPageActive } from "./FocusPage.fixture";
import {
  expectationChatDraft,
  interviewChatDraft,
  interviewTurnText,
  pkgChatDraft,
  resolveFocusLocate,
  resolveInterviewSend,
  resolvePkgApprove
} from "./focusEntryActions";

const interviewCommit: InterviewAnchorCommit = {
  sessionId: "ses_1",
  focusId: "foc_1",
  requestId: "evt_1",
  generation: 1
};

const interviewRounds: InterviewRoundLease[] = [
  { turnId: "trn_q", focusId: "foc_1", requestId: "evt_1", generation: 1 }
];

const interviewSpoken: LiveInterviewSpoken[] = [
  {
    text: "受众是谁？",
    turnId: "trn_q",
    seq: 1,
    interviewFocusId: "foc_1",
    interviewAnchorRequestId: "evt_1",
    interviewAnchorGeneration: 1
  }
];

describe("resolveFocusLocate", () => {
  it("真实 obligation 打开 TaskModal,带 title/needs/focusId", () => {
    const r = resolveFocusLocate({ kind: "obligation", id: "ob1" }, focusPageActive);
    expect(r).toEqual({
      kind: "open_obligation",
      target: {
        kind: "obligation",
        id: "ob1",
        title: "demo 看完,拍板是否应用到 console",
        needs: "decision",
        focusId: focusPageActive.rail.obligations[0]!.focusId
      }
    });
  });

  it("缺失安排明确提示,不给出 data-locate 滚动", () => {
    const r = resolveFocusLocate({ kind: "obligation", id: "ob_missing" }, focusPageActive);
    expect(r).toEqual({ kind: "missing", message: "找不到这条安排" });
  });

  it("产物/项目只给选择器,由接线层在节点存在时才滚", () => {
    const r = resolveFocusLocate({ kind: "artifact", id: "a1" }, focusPageActive);
    expect(r).toEqual({ kind: "scroll", selector: '[data-locate="artifact:a1"]', label: "artifact a1" });
  });

  it("生产 rail.tasks 为空时不伪造任务入口", () => {
    const empty = { ...focusPageActive, rail: { ...focusPageActive.rail, tasks: [] }, lookups: { ...focusPageActive.lookups, tasks: {} } };
    const r = resolveFocusLocate({ kind: "task", id: "rt1" }, empty);
    expect(r.kind).toBe("no_locate");
  });
});

describe("expectationChatDraft", () => {
  it("只产可编辑草稿,不含 durable expectationId", () => {
    const draft = expectationChatDraft("周报", { type: "expect" });
    expect(draft).toContain("周报");
    expect(draft).toContain("我期待一个新的产物");
    expect(draft).not.toMatch(/exp[_-]/);
    expect(expectationChatDraft("周报", { type: "expectation_edit", target: { kind: "direction" } }, { direction: "先写三段" })).toContain(
      "先写三段"
    );
    expect(
      expectationChatDraft("周报", { type: "expectation_edit", target: { kind: "acceptance", index: 0 } }, {
        acceptance: [{ text: "有目录" }]
      })
    ).toContain("有目录");
  });
});

describe("pkgChatDraft", () => {
  it("页卡动作产可编辑草稿,不在页面直连派发", () => {
    expect(pkgChatDraft("approve", "周报自动化")).toContain("拍板");
    expect(pkgChatDraft("revise", "周报自动化")).toContain("周报自动化");
    expect(pkgChatDraft("edit_expectation")).toContain("期待");
    expect(pkgChatDraft("select_mode", "周报自动化", "step_confirm")).toContain("step_confirm");
  });
});

describe("interviewChatDraft", () => {
  it("选项带上问题上下文进草稿", () => {
    expect(interviewChatDraft("受众是谁", "商业受众")).toBe("「受众是谁」我选:商业受众");
    expect(interviewChatDraft(undefined, "商业受众")).toBe("商业受众");
  });
});

describe("resolvePkgApprove", () => {
  const card = {
    receiptId: "rcpt_ok",
    kind: "dispatch" as const,
    packageId: "pkg_1",
    revision: 2,
    digest: "dig_ok",
    text: "这份包"
  };

  it("同 session/包/修订/digest 才打开确认卡", () => {
    const r = resolvePkgApprove({
      packageId: "pkg_1",
      revision: 2,
      pkg: { id: "pkg_1", revision: 2, outcomePreview: "这份包" },
      card,
      sessionOwned: true,
      sessionId: "ses_1",
      focusId: "foc_1"
    });
    expect(r.kind).toBe("open_confirm");
    if (r.kind === "open_confirm") {
      expect(r.target).toMatchObject({
        kind: "confirmation",
        receiptId: "rcpt_ok",
        sessionId: "ses_1",
        packageId: "pkg_1",
        revision: 2,
        digest: "dig_ok"
      });
    }
  });

  it("其它包/其它修订/未接会话都不能打开或消费", () => {
    expect(
      resolvePkgApprove({
        packageId: "pkg_other",
        revision: 2,
        pkg: { id: "pkg_other", revision: 2 },
        card,
        sessionOwned: true,
        sessionId: "ses_1",
        focusId: "foc_1"
      }).kind
    ).toBe("blocked");
    expect(
      resolvePkgApprove({
        packageId: "pkg_1",
        revision: 1,
        pkg: { id: "pkg_1", revision: 1 },
        card,
        sessionOwned: true,
        sessionId: "ses_1",
        focusId: "foc_1"
      }).kind
    ).toBe("blocked");
    expect(
      resolvePkgApprove({
        packageId: "pkg_1",
        revision: 2,
        pkg: { id: "pkg_1", revision: 2 },
        card,
        sessionOwned: false,
        sessionId: "ses_1",
        focusId: "foc_1"
      }).kind
    ).toBe("blocked");
    expect(
      resolvePkgApprove({
        packageId: "pkg_1",
        revision: 2,
        pkg: { id: "pkg_1", revision: 2 },
        card: null,
        sessionOwned: true,
        sessionId: "ses_1",
        focusId: "foc_1"
      }).kind
    ).toBe("blocked");
  });
});

describe("resolveInterviewSend", () => {
  it("同 sid 真实发送,不把草稿等同答复", () => {
    const r = resolveInterviewSend({
      option: "商业受众",
      question: "受众是谁？",
      sessionOwned: true,
      sessionId: "ses_1",
      pageFocusId: "foc_1",
      turnId: "trn_q",
      focusId: "foc_1",
      anchorRequestId: "evt_1",
      anchorGeneration: 1,
      committed: interviewCommit,
      spoken: interviewSpoken,
      rounds: interviewRounds
    });
    expect(r).toEqual({
      kind: "send",
      sessionId: "ses_1",
      text: interviewTurnText("受众是谁？", "商业受众")
    });
    expect(r.kind === "send" && r.text).toContain("我选:商业受众");
  });

  it("未接会话 blocked,不走草稿发送", () => {
    expect(
      resolveInterviewSend({ option: "商业受众", sessionOwned: false, sessionId: "ses_1" }).kind
    ).toBe("blocked");
    expect(resolveInterviewSend({ option: "商业受众", sessionOwned: true, sessionId: null }).kind).toBe(
      "blocked"
    );
  });

  it("只有当前 session 归属、没有锚定代次时不发", () => {
    expect(
      resolveInterviewSend({
        option: "商业受众",
        question: "受众是谁？",
        sessionOwned: true,
        sessionId: "ses_1",
        pageFocusId: "foc_1"
      }).kind
    ).toBe("blocked");
  });
});
