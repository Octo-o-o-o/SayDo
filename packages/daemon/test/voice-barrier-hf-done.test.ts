// B1:HF 显式 done 走 additive captureMode,空/非空新 pipeline 分类 final 不遗留 legacy 计数。

import { describe, expect, it } from "vitest";
import { newId, type PipelineMsg } from "@saydo/contracts";
import { VoiceBarrier, type VoiceBarrierSink } from "../src/voice/voiceBarrier.js";

const SES = newId("ses");
const FOC = newId("foc");
const TURN = newId("ses");
const PEER = newId("evt");
const EPOCH = newId("evt");

function mockSink(statuses: PipelineMsg[]): VoiceBarrierSink {
  return {
    now: () => Date.now(),
    sendToPeer: (_peer, msg) => {
      statuses.push(msg);
    },
    sendToLocalSession: () => {},
    sendToPipeline: () => true,
    isPeerOpen: () => true,
    peerVia: () => "local",
    registerSession: () => {},
    closeCaptureGate: () => {},
    openCaptureGate: () => {},
    prewriteLastVoiceModePtt: () => {},
    hasPipelinePeer: () => true,
    currentPipelineIdentity: () => ({
      sourceRevision: "1234567890abcdef1234567890abcdef12345678",
      buildId: "hf-done",
      protocolVersion: "1.0.0"
    }),
    getSourceFocusId: () => FOC,
    audit: () => {}
  };
}

function prepare(barrier: VoiceBarrier, requestId: string): Extract<PipelineMsg, { t: "voice.anchor_status" }> | undefined {
  barrier.handlePrepare(
    {
      t: "voice.anchor_prepare",
      sessionId: SES,
      requestId,
      focusId: FOC,
      daemonEpoch: barrier.daemonEpoch
    },
    PEER
  );
  return undefined;
}

function lastStatus(statuses: PipelineMsg[]): Extract<PipelineMsg, { t: "voice.anchor_status" }> {
  const row = [...statuses].reverse().find((m) => m.t === "voice.anchor_status");
  if (!row || row.t !== "voice.anchor_status") throw new Error("missing anchor_status");
  return row;
}

function statusCode(statuses: PipelineMsg[]): string | undefined {
  const row = lastStatus(statuses);
  return row.status === "rejected" ? row.code : undefined;
}

describe("HF 显式 done additive captureMode", () => {
  it("captureMode=hands_free 不记 legacy,空/非空分类 final 后 prepare 不因 leftover 被拒", () => {
    const statuses: PipelineMsg[] = [];
    const barrier = new VoiceBarrier(mockSink(statuses), EPOCH);
    barrier.setPipelineEpoch(1);

    const hf = barrier.registerDoneSpeaking({
      t: "turn.done_speaking",
      sessionId: SES,
      captureMode: "hands_free"
    });
    expect(hf.legacyHold).toBe(false);
    expect(hf.forward).toEqual({ t: "turn.done_speaking", sessionId: SES });
    barrier.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: TURN,
      text: "",
      captureMode: "hands_free",
      recognitionOutcome: "ok"
    });
    barrier.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: newId("ses"),
      text: "免手一句",
      captureMode: "hands_free",
      recognitionOutcome: "ok"
    });
    prepare(barrier, newId("evt"));
    expect(statusCode(statuses)).not.toBe("voice_unclassified_inflight");
  });

  it("HF done 夹带 captureId/hold 被丢弃且不记 leftover", () => {
    const statuses: PipelineMsg[] = [];
    const barrier = new VoiceBarrier(mockSink(statuses), EPOCH);
    barrier.setPipelineEpoch(1);
    const dropped = barrier.registerDoneSpeaking({
      t: "turn.done_speaking",
      sessionId: SES,
      captureMode: "hands_free",
      captureId: newId("evt"),
      captureIntent: "send"
    });
    expect(dropped).toEqual({ forward: null, legacyHold: false });
    prepare(barrier, newId("evt"));
    expect(statusCode(statuses)).not.toBe("voice_unclassified_inflight");
  });

  it("legacy done 会占 leftover;新 pipeline 分类 final(空或非空)结算后不遗留", () => {
    const statuses: PipelineMsg[] = [];
    const barrier = new VoiceBarrier(mockSink(statuses), EPOCH);
    barrier.setPipelineEpoch(1);

    const legacy = barrier.registerDoneSpeaking({ t: "turn.done_speaking", sessionId: SES });
    expect(legacy.legacyHold).toBe(false);
    prepare(barrier, newId("evt"));
    expect(statusCode(statuses)).toBe("voice_unclassified_inflight");

    barrier.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: TURN,
      text: "",
      captureMode: "hands_free",
      recognitionOutcome: "ok"
    });
    statuses.length = 0;
    prepare(barrier, newId("evt"));
    expect(statusCode(statuses)).not.toBe("voice_unclassified_inflight");

    const again = new VoiceBarrier(mockSink(statuses), EPOCH);
    again.setPipelineEpoch(1);
    again.registerDoneSpeaking({ t: "turn.done_speaking", sessionId: SES });
    again.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: newId("ses"),
      text: "新管线非空",
      captureMode: "hands_free",
      recognitionOutcome: "ok"
    });
    statuses.length = 0;
    again.handlePrepare(
      {
        t: "voice.anchor_prepare",
        sessionId: SES,
        requestId: newId("evt"),
        focusId: FOC,
        daemonEpoch: again.daemonEpoch
      },
      PEER
    );
    expect(statusCode(statuses)).not.toBe("voice_unclassified_inflight");
  });

  it("B1 生产序列:VAD start 后无 end,HF 说完 + 非空分类 final 必须进 Brain", () => {
    const statuses: PipelineMsg[] = [];
    const barrier = new VoiceBarrier(mockSink(statuses), EPOCH);
    barrier.setPipelineEpoch(1);
    barrier.noteVadSpeech(SES, "start");
    const done = barrier.registerDoneSpeaking({
      t: "turn.done_speaking",
      sessionId: SES,
      captureMode: "hands_free"
    });
    expect(done.forward).toEqual({ t: "turn.done_speaking", sessionId: SES });
    const decision = barrier.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: TURN,
      text: "合法非空指令",
      captureMode: "hands_free",
      recognitionOutcome: "ok"
    });
    expect(decision).toMatchObject({ broadcast: true, brain: true, settleSpeech: false });
  });

  it("重复 HF done 不得再把已确认轮喂 Brain", () => {
    const barrier = new VoiceBarrier(mockSink([]), EPOCH);
    barrier.setPipelineEpoch(1);
    barrier.noteVadSpeech(SES, "start");
    barrier.registerDoneSpeaking({ t: "turn.done_speaking", sessionId: SES, captureMode: "hands_free" });
    expect(
      barrier.consumeAsrFinal({
        t: "asr.final",
        sessionId: SES,
        turnId: TURN,
        text: "第一轮",
        captureMode: "hands_free",
        recognitionOutcome: "ok"
      }).brain
    ).toBe(true);
    barrier.registerDoneSpeaking({ t: "turn.done_speaking", sessionId: SES, captureMode: "hands_free" });
    const repeat = barrier.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: newId("ses"),
      text: "重复说完不得再进",
      captureMode: "hands_free",
      recognitionOutcome: "ok"
    });
    expect(repeat.brain).toBe(false);
    expect(repeat.settleSpeech).toBe(false);
  });

  it("旧 epoch 已闭合 HF 项不得被当前 epoch final 确认", () => {
    const barrier = new VoiceBarrier(mockSink([]), EPOCH);
    barrier.setPipelineEpoch(1);
    barrier.noteVadSpeech(SES, "start");
    barrier.noteVadSpeech(SES, "end");
    barrier.setPipelineEpoch(2);
    const late = barrier.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: TURN,
      text: "旧世代迟到",
      captureMode: "hands_free",
      recognitionOutcome: "ok"
    });
    expect(late).toMatchObject({ brain: false, settleSpeech: false });
  });

  it("HF 分类 final 不得消费已登记 PTT captureId", () => {
    const barrier = new VoiceBarrier(mockSink([]), EPOCH);
    barrier.setPipelineEpoch(1);
    const captureId = newId("evt");
    const ptt = barrier.registerDoneSpeaking({
      t: "turn.done_speaking",
      sessionId: SES,
      captureId,
      captureIntent: "send"
    });
    expect(ptt.forward).toBeTruthy();
    barrier.noteVadSpeech(SES, "start");
    barrier.registerDoneSpeaking({ t: "turn.done_speaking", sessionId: SES, captureMode: "hands_free" });
    const hf = barrier.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: TURN,
      text: "免手一句",
      captureMode: "hands_free",
      recognitionOutcome: "ok"
    });
    expect(hf.brain).toBe(true);
    const leftoverPtt = barrier.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: newId("ses"),
      text: "PTT 原文仍应按 captureId 匹配",
      captureMode: "ptt",
      captureId,
      recognitionOutcome: "ok"
    });
    expect(leftoverPtt.brain).toBe(true);
    expect(barrier.registryEntries(SES).find((row) => row.captureId === captureId)?.consumed).toBe(true);
  });
});
