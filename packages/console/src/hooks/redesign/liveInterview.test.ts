import { describe, expect, it } from "vitest";
import type { InterviewAnchorCommit } from "../../voice/interviewAnchor";
import {
  extractInterviewOptions,
  isInterviewQuestion,
  projectLiveInterview,
  type LiveInterviewSpoken
} from "./liveInterview";

const committed: InterviewAnchorCommit = {
  sessionId: "ses_1",
  focusId: "foc_1",
  requestId: "evt_1",
  generation: 1
};

const rounds = [
  { turnId: "trn_1", focusId: "foc_1", requestId: "evt_1", generation: 1 },
  { turnId: "trn_r", focusId: "foc_1", requestId: "evt_1", generation: 1 },
  { turnId: "trn_old", focusId: "foc_1", requestId: "evt_1", generation: 1 },
  { turnId: "trn_q", focusId: "foc_1", requestId: "evt_1", generation: 1 },
  { turnId: "trn_s", focusId: "foc_1", requestId: "evt_1", generation: 1 }
];

function stamped(text: string, turnId: string, seq: number): LiveInterviewSpoken {
  return {
    text,
    turnId,
    seq,
    interviewFocusId: "foc_1",
    interviewAnchorRequestId: "evt_1",
    interviewAnchorGeneration: 1
  };
}

describe("projectLiveInterview", () => {
  it("未归属或无 sid 不投影", () => {
    expect(
      projectLiveInterview({
        pageFocusId: "foc_1",
        sessionOwned: false,
        sessionId: "ses_1",
        committed,
        rounds,
        spoken: [stamped("受众是谁？", "trn_1", 1)]
      })
    ).toBeUndefined();
    expect(
      projectLiveInterview({
        pageFocusId: "foc_1",
        sessionOwned: true,
        sessionId: null,
        committed,
        rounds,
        spoken: [stamped("受众是谁？", "trn_1", 1)]
      })
    ).toBeUndefined();
  });

  it("确认卡在场时不当采访;状态句不当采访", () => {
    expect(
      projectLiveInterview({
        pageFocusId: "foc_1",
        sessionOwned: true,
        sessionId: "ses_1",
        committed,
        rounds,
        spoken: [stamped("这些事实对不对？", "trn_r", 1)],
        confirmCard: { kind: "readiness", text: "这些事实对不对" }
      })
    ).toBeUndefined();
    expect(isInterviewQuestion("执行和检查都跑完了，等你验收？")).toBe(false);
    expect(isInterviewQuestion("要不要开始？")).toBe(false);
    expect(isInterviewQuestion("先记进记忆了")).toBe(false);
  });

  it("同归属问句投影真实 question/sid/turn;无选项不伪造", () => {
    const view = projectLiveInterview({
      pageFocusId: "foc_1",
      sessionOwned: true,
      sessionId: "ses_1",
      committed,
      rounds,
      spoken: [stamped("记下了", "trn_old", 1), stamped("受众是谁？", "trn_q", 2)]
    });
    expect(view).toEqual({
      question: "受众是谁？",
      options: [],
      sessionId: "ses_1",
      turnId: "trn_q",
      focusId: "foc_1",
      anchorRequestId: "evt_1",
      anchorGeneration: 1
    });
  });

  it("只抽取文本里已有的编号/引号选项", () => {
    expect(extractInterviewOptions("受众是谁？\n1. 商业\n2. 内部")).toEqual(["商业", "内部"]);
    expect(extractInterviewOptions("选「商业」还是「内部」？")).toEqual(["商业", "内部"]);
    expect(extractInterviewOptions("受众是谁？随便说。")).toEqual([]);
  });

  it("普通陈述即使很长也不当采访", () => {
    expect(
      projectLiveInterview({
        pageFocusId: "foc_1",
        sessionOwned: true,
        sessionId: "ses_1",
        committed,
        rounds,
        spoken: [stamped("我先把周报三段列出来,等你看方向。", "trn_s", 1)]
      })
    ).toBeUndefined();
  });
});
