// review10-B1:Focus A 的 live 采访留在 spoken,导航 B 把同一 session 重新锚定。
// 事件顺序走 reduceInterviewAnchor;tts/screen_text 与 useVoiceChannel 共用 applySpokenFromWire。
// 点击走 deliverInterviewPick,与 FocusPageRoute 的 interview_pick 同一入口。
import { describe, expect, it, vi } from "vitest";
import { gateChatSend, readPendingAnchor, writePendingAnchor } from "../../lib/pendingAnchor";
import {
  emptyInterviewTrack,
  reduceInterviewAnchor,
  type InterviewTrack
} from "../../voice/interviewAnchor";
import { projectLiveInterview } from "./liveInterview";
import { deliverInterviewPick } from "../../pages/redesign/focusEntryActions";

const SES = "ses_same";
const FOC_A = "foc_A";
const FOC_B = "foc_B";
const REQ_A = "evt_anchor_A";
const REQ_A2 = "evt_anchor_A2";
const REQ_B = "evt_anchor_B";
const TURN_A = "turn-from-focus-A";
const Q_A = "A 项目受众是谁？";

function project(state: InterviewTrack, pageFocusId: string) {
  return projectLiveInterview({
    pageFocusId,
    sessionOwned: true,
    sessionId: SES,
    spoken: state.spoken,
    rounds: state.rounds,
    committed: state.anchor.committed
  });
}

function click(
  state: InterviewTrack,
  held: { question?: string; turnId?: string; focusId?: string; anchorRequestId?: string; anchorGeneration?: number } | undefined,
  pageFocusId: string,
  option: string,
  sendText: (text: string) => Promise<boolean>
) {
  return deliverInterviewPick(
    {
      option,
      question: held?.question,
      sessionOwned: true,
      sessionId: SES,
      pageFocusId,
      turnId: held?.turnId,
      focusId: held?.focusId,
      anchorRequestId: held?.anchorRequestId,
      anchorGeneration: held?.anchorGeneration,
      committed: state.anchor.committed,
      spoken: state.spoken,
      rounds: state.rounds
    },
    sendText
  );
}

describe("review10-B1 采访锚定归属", () => {
  it("A 到 B:在途和失败不投影到 B,改锚后旧卡点击拒绝,B 的新问题可发,旧句仍留在 spoken", async () => {
    let state = emptyInterviewTrack();
    state = reduceInterviewAnchor(state, { type: "commit", sessionId: SES, focusId: FOC_A, requestId: REQ_A });
    state = reduceInterviewAnchor(state, { type: "round_open", turnId: TURN_A });
    state = reduceInterviewAnchor(state, {
      type: "tts",
      sentenceId: `s-${TURN_A}-0`,
      text: Q_A,
      seq: 1,
      turnId: TURN_A
    });
    const cardA = project(state, FOC_A);
    expect(cardA).toMatchObject({
      question: Q_A,
      turnId: TURN_A,
      focusId: FOC_A,
      anchorRequestId: REQ_A,
      anchorGeneration: 1
    });
    expect(project(state, FOC_B)).toBeUndefined();

    state = reduceInterviewAnchor(state, { type: "begin", sessionId: SES, focusId: FOC_B, requestId: REQ_B });
    expect(state.anchor.phase).toBe("pending");
    expect(state.anchor.committed?.focusId).toBe(FOC_A);
    expect(project(state, FOC_B)).toBeUndefined();
    expect(project(state, FOC_A)?.turnId).toBe(TURN_A);
    const pendingSend = vi.fn(async () => true);
    expect((await click(state, cardA, FOC_B, "商业受众", pendingSend)).kind).toBe("blocked");
    expect(pendingSend).not.toHaveBeenCalled();

    state = reduceInterviewAnchor(state, { type: "fail", sessionId: SES, focusId: FOC_B, requestId: REQ_B });
    expect(state.anchor.phase).toBe("failed");
    expect(state.anchor.committed).toMatchObject({ focusId: FOC_A, requestId: REQ_A, generation: 1 });
    expect(project(state, FOC_B)).toBeUndefined();
    expect(state.spoken.map((row) => row.text)).toEqual([Q_A]);

    state = reduceInterviewAnchor(state, { type: "begin", sessionId: SES, focusId: FOC_B, requestId: REQ_B });
    state = reduceInterviewAnchor(state, { type: "commit", sessionId: SES, focusId: FOC_B, requestId: REQ_B });
    expect(state.anchor.committed).toMatchObject({ focusId: FOC_B, requestId: REQ_B, generation: 2 });
    expect(project(state, FOC_B)).toBeUndefined();
    expect(project(state, FOC_A)).toBeUndefined();
    expect(state.spoken.map((row) => row.interviewFocusId)).toEqual([FOC_A]);
    const switched = vi.fn(async () => true);
    expect((await click(state, cardA, FOC_B, "商业受众", switched)).kind).toBe("blocked");
    expect(switched).not.toHaveBeenCalled();

    const turnB = "turn-from-focus-B";
    const questionB = "B 项目要先改哪一节？";
    state = reduceInterviewAnchor(state, { type: "round_open", turnId: turnB });
    state = reduceInterviewAnchor(state, {
      type: "tts",
      sentenceId: `s-${turnB}-0`,
      text: questionB,
      seq: 2,
      turnId: turnB
    });
    const cardB = project(state, FOC_B);
    expect(cardB).toMatchObject({ question: questionB, turnId: turnB, focusId: FOC_B, anchorGeneration: 2 });
    expect(project(state, FOC_A)).toBeUndefined();
    const sendB = vi.fn(async () => true);
    const sent = await click(state, cardB, FOC_B, "安装一节", sendB);
    expect(sent.kind).toBe("sent");
    expect(sendB).toHaveBeenCalledWith("「B 项目要先改哪一节？」我选:安装一节");
    expect(state.spoken.map((row) => row.text)).toEqual([Q_A, questionB]);
  });

  it("同 Focus 重复提交不换代;新问题替换旧卡;换 requestId 后只有新问题可发", async () => {
    let state = emptyInterviewTrack();
    state = reduceInterviewAnchor(state, { type: "commit", sessionId: SES, focusId: FOC_A, requestId: REQ_A });
    state = reduceInterviewAnchor(state, { type: "round_open", turnId: "trn_q1" });
    state = reduceInterviewAnchor(state, {
      type: "tts",
      sentenceId: "s-trn_q1-0",
      text: "第一问是受众吗？",
      seq: 1,
      turnId: "trn_q1"
    });
    const first = project(state, FOC_A);
    state = reduceInterviewAnchor(state, { type: "commit", sessionId: SES, focusId: FOC_A, requestId: REQ_A });
    expect(state.anchor.committed?.generation).toBe(1);
    expect(project(state, FOC_A)?.turnId).toBe("trn_q1");
    const repeatSend = vi.fn(async () => true);
    expect((await click(state, first, FOC_A, "是", repeatSend)).kind).toBe("sent");

    state = reduceInterviewAnchor(state, { type: "round_open", turnId: "trn_q2" });
    state = reduceInterviewAnchor(state, {
      type: "tts",
      sentenceId: "s-trn_q2-0",
      text: "第二问改标题吗？",
      seq: 2,
      turnId: "trn_q2"
    });
    const second = project(state, FOC_A);
    expect(second?.turnId).toBe("trn_q2");
    const staleFirst = vi.fn(async () => true);
    expect((await click(state, first, FOC_A, "是", staleFirst)).kind).toBe("blocked");
    expect(staleFirst).not.toHaveBeenCalled();
    const sendSecond = vi.fn(async () => true);
    expect((await click(state, second, FOC_A, "改", sendSecond)).kind).toBe("sent");

    state = reduceInterviewAnchor(state, {
      type: "screen_text",
      turnId: "trn_q2",
      text: "第二问改成副标题吗？",
      seq: 3
    });
    expect(state.spoken.find((row) => row.turnId === "trn_q2")).toMatchObject({
      interviewFocusId: FOC_A,
      interviewAnchorRequestId: REQ_A,
      interviewAnchorGeneration: 1,
      text: "第二问改成副标题吗？"
    });
    const updated = project(state, FOC_A);
    expect(updated?.question).toBe("第二问改成副标题吗？");
    const oldWording = vi.fn(async () => true);
    expect((await click(state, second, FOC_A, "改", oldWording)).kind).toBe("blocked");
    expect(oldWording).not.toHaveBeenCalled();
    const sendUpdated = vi.fn(async () => true);
    expect((await click(state, updated, FOC_A, "改", sendUpdated)).kind).toBe("sent");

    state = reduceInterviewAnchor(state, { type: "commit", sessionId: SES, focusId: FOC_A, requestId: REQ_A2 });
    expect(state.anchor.committed?.generation).toBe(2);
    expect(project(state, FOC_A)).toBeUndefined();
    const afterNewIntent = vi.fn(async () => true);
    expect((await click(state, updated, FOC_A, "改", afterNewIntent)).kind).toBe("blocked");
    expect(afterNewIntent).not.toHaveBeenCalled();
    expect(state.spoken.some((row) => row.text === "第二问改成副标题吗？")).toBe(true);

    state = reduceInterviewAnchor(state, { type: "round_open", turnId: "trn_q3" });
    state = reduceInterviewAnchor(state, {
      type: "tts",
      sentenceId: "s-trn_q3-0",
      text: "第三问只改 README 吗？",
      seq: 4,
      turnId: "trn_q3"
    });
    const third = project(state, FOC_A);
    expect(third).toMatchObject({ turnId: "trn_q3", anchorRequestId: REQ_A2, anchorGeneration: 2 });
    const sendThird = vi.fn(async () => true);
    expect((await click(state, third, FOC_A, "只改 README", sendThird)).kind).toBe("sent");
  });

  it("后到的别的 Focus 句子不会盖掉印章,也没有时间戳可用来认领", () => {
    let state = emptyInterviewTrack();
    state = reduceInterviewAnchor(state, { type: "commit", sessionId: SES, focusId: FOC_A, requestId: REQ_A });
    state = reduceInterviewAnchor(state, { type: "round_open", turnId: TURN_A });
    state = reduceInterviewAnchor(state, {
      type: "tts",
      sentenceId: `s-${TURN_A}-0`,
      text: Q_A,
      seq: 1,
      turnId: TURN_A
    });
    state = reduceInterviewAnchor(state, { type: "commit", sessionId: SES, focusId: FOC_B, requestId: REQ_B });
    state = reduceInterviewAnchor(state, {
      type: "screen_text",
      turnId: TURN_A,
      text: "A 项目受众改口了吗？",
      seq: 9
    });
    expect(state.spoken.find((row) => row.turnId === TURN_A)?.interviewFocusId).toBe(FOC_A);
    expect(project(state, FOC_B)).toBeUndefined();
    state = reduceInterviewAnchor(state, { type: "round_open", turnId: "trn_b" });
    state = reduceInterviewAnchor(state, {
      type: "tts",
      sentenceId: "s-trn_b-0",
      text: "B 的范围含安装节吗？",
      seq: 2,
      turnId: "trn_b"
    });
    expect(project(state, FOC_B)?.turnId).toBe("trn_b");
    expect(project(state, FOC_A)).toBeUndefined();
  });

  it("A 请求在途、尚无 TTS 时改锚到 B,迟到首包不得盖上 B", async () => {
    let state = emptyInterviewTrack();
    state = reduceInterviewAnchor(state, { type: "commit", sessionId: SES, focusId: FOC_A, requestId: REQ_A });
    state = reduceInterviewAnchor(state, { type: "round_open", turnId: TURN_A });
    state = reduceInterviewAnchor(state, { type: "commit", sessionId: SES, focusId: FOC_B, requestId: REQ_B });
    state = reduceInterviewAnchor(state, {
      type: "screen_text",
      turnId: TURN_A,
      text: Q_A,
      seq: 1
    });
    expect(state.spoken.find((row) => row.turnId === TURN_A)).toMatchObject({
      interviewFocusId: FOC_A,
      interviewAnchorRequestId: REQ_A,
      interviewAnchorGeneration: 1
    });
    expect(state.spoken.find((row) => row.turnId === TURN_A)?.interviewFocusId).not.toBe(FOC_B);
    expect(project(state, FOC_B)).toBeUndefined();
    const send = vi.fn(async () => true);
    const late = await click(
      state,
      {
        question: Q_A,
        turnId: TURN_A,
        focusId: FOC_B,
        anchorRequestId: REQ_B,
        anchorGeneration: state.anchor.committed?.generation
      },
      FOC_B,
      "商业受众",
      send
    );
    expect(late.kind).toBe("blocked");
    expect(send).not.toHaveBeenCalled();
  });

  it("错误自盖的 B 印章不能把仍属于 A 的轮发出去", async () => {
    const send = vi.fn(async () => true);
    const result = await deliverInterviewPick(
      {
        option: "商业受众",
        question: Q_A,
        sessionOwned: true,
        sessionId: SES,
        pageFocusId: FOC_B,
        turnId: TURN_A,
        focusId: FOC_B,
        anchorRequestId: REQ_B,
        anchorGeneration: 2,
        committed: { sessionId: SES, focusId: FOC_B, requestId: REQ_B, generation: 2 },
        spoken: [
          {
            text: Q_A,
            turnId: TURN_A,
            seq: 1,
            interviewFocusId: FOC_B,
            interviewAnchorRequestId: REQ_B,
            interviewAnchorGeneration: 2
          }
        ],
        rounds: [{ turnId: TURN_A, focusId: FOC_A, requestId: REQ_A, generation: 1 }]
      },
      send
    );
    expect(result.kind).toBe("blocked");
    expect(send).not.toHaveBeenCalled();
  });

  it("无印章的旧句即使 session 已归属当前页也不投影", () => {
    expect(
      projectLiveInterview({
        pageFocusId: FOC_B,
        sessionOwned: true,
        sessionId: SES,
        committed: { sessionId: SES, focusId: FOC_B, requestId: REQ_B, generation: 2 },
        spoken: [{ text: Q_A, turnId: TURN_A, seq: 1 }]
      })
    ).toBeUndefined();
  });

  it("采访拒绝不清草稿;锚定未完成不发草稿,接上后原文发到当前会话", async () => {
    const draft = "保留的草稿";
    const pending: PendingAnchor = {
      focusId: FOC_B,
      draft,
      requestId: REQ_B
    };
    const storage = {
      value: "",
      getItem: () => storage.value,
      setItem: (_key: string, value: string) => {
        storage.value = value;
      },
      removeItem: () => {
        storage.value = "";
      }
    };
    writePendingAnchor(storage, pending);
    const sendText = vi.fn(async () => true);
    const blocked = await deliverInterviewPick(
      {
        option: "商业受众",
        question: Q_A,
        sessionOwned: true,
        sessionId: SES,
        pageFocusId: FOC_B,
        turnId: TURN_A,
        focusId: FOC_A,
        anchorRequestId: REQ_A,
        anchorGeneration: 1,
        committed: { sessionId: SES, focusId: FOC_B, requestId: REQ_B, generation: 2 },
        spoken: []
      },
      sendText
    );
    expect(blocked.kind).toBe("blocked");
    expect(readPendingAnchor(storage)?.draft).toBe(draft);
    const held = await gateChatSend({
      pending,
      phase: "pending",
      sessionId: SES,
      anchoredSessionId: null,
      text: draft,
      sendText
    });
    expect(held).toMatchObject({ sent: false, keepDraft: true });
    expect(sendText).not.toHaveBeenCalled();
    const sent = await gateChatSend({
      pending,
      phase: "ready",
      sessionId: SES,
      anchoredSessionId: SES,
      text: draft,
      sendText
    });
    expect(sent).toEqual({ sent: true, keepDraft: false });
    expect(sendText).toHaveBeenCalledWith(draft);
    expect(readPendingAnchor(storage)?.draft).toBe(draft);
  });
});

type PendingAnchor = {
  focusId: string;
  draft: string;
  requestId: string;
};
