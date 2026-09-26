// 09 §10.1.13:逻辑轮按 hfRoundId + 句段集结算。旧 FIFO 不得消费新身份,PTT registry 不被 HF final 消费。

import { describe, expect, it } from "vitest";
import { newId, type PipelineMsg } from "@saydo/contracts";
import { VoiceBarrier, type VoiceBarrierSink } from "../src/voice/voiceBarrier.js";

const SES = newId("ses");
const FOC = newId("foc");
const EPOCH = newId("evt");
const PEER = newId("evt");

function mockSink(statuses: PipelineMsg[] = []): VoiceBarrierSink {
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
      buildId: "hf-round",
      protocolVersion: "1.0.0"
    }),
    getSourceFocusId: () => FOC,
    audit: () => {}
  };
}

function barrier(): VoiceBarrier {
  const created = new VoiceBarrier(mockSink(), EPOCH);
  created.setPipelineEpoch(1);
  return created;
}

function segment(round: string, seq: number): { hfSegmentId: string; hfRoundId: string; recordSeq: number } {
  return { hfSegmentId: newId("evt"), hfRoundId: round, recordSeq: seq };
}

describe("HF 逻辑轮身份", () => {
  it("两段同一轮必须整集终态;只带一段的 final 不结算", () => {
    const box = barrier();
    const round = newId("evt");
    const first = segment(round, 1);
    const second = segment(round, 2);
    box.noteVadSpeech(SES, "start", first);
    box.noteVadSpeech(SES, "end", first);
    box.noteVadSpeech(SES, "start", second);
    box.noteVadSpeech(SES, "end", second);
    const partial = box.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: newId("ses"),
      text: "只有后半",
      captureMode: "hands_free",
      recognitionOutcome: "ok",
      hfRoundId: round,
      hfSegmentIds: [second.hfSegmentId],
      recordSeqFirst: 2,
      recordSeqLast: 2
    });
    expect(partial).toMatchObject({ brain: false, settleSpeech: false });
    expect(box.ledgerEntries(SES).every((item) => item.state === "unconfirmed")).toBe(true);
    const whole = box.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: newId("ses"),
      text: "先保留 npm,然后补 pnpm",
      captureMode: "hands_free",
      recognitionOutcome: "ok",
      hfRoundId: round,
      hfSegmentIds: [first.hfSegmentId, second.hfSegmentId],
      recordSeqFirst: 1,
      recordSeqLast: 2
    });
    expect(whole.brain).toBe(true);
    expect(box.ledgerEntries(SES).every((item) => item.state === "confirmed")).toBe(true);
    const replay = box.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: newId("ses"),
      text: "先保留 npm,然后补 pnpm",
      captureMode: "hands_free",
      recognitionOutcome: "ok",
      hfRoundId: round,
      hfSegmentIds: [first.hfSegmentId, second.hfSegmentId],
      recordSeqFirst: 1,
      recordSeqLast: 2
    });
    expect(replay).toMatchObject({ brain: false, settleSpeech: false });
  });

  it("旧非空 final 只结算旧轮,不把 speechGen 抬到 barge-in 之后", () => {
    const box = barrier();
    const roundA = newId("evt");
    const seg = segment(roundA, 1);
    box.noteVadSpeech(SES, "start", seg);
    box.noteVadSpeech(SES, "end", seg);
    const newer = box.noteBargeIn(SES);
    expect(newer).toBe(1);
    const late = box.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: newId("ses"),
      text: "旧轮非空",
      captureMode: "hands_free",
      recognitionOutcome: "ok",
      hfRoundId: roundA,
      hfSegmentIds: [seg.hfSegmentId],
      recordSeqFirst: 1,
      recordSeqLast: 1
    });
    expect(late.brain).toBe(false);
    expect(late.settleSpeech).toBe(true);
    expect(late.speechGen).toBe(0);
    expect(late.speechGen).not.toBe(newer);
    expect(box.ledgerEntries(SES)[0]?.state).toBe("confirmed");
  });

  it("部分失败是一条 failed 空终态,两段都 unknown,重复 final 不复活", () => {
    const box = barrier();
    const round = newId("evt");
    const first = segment(round, 1);
    const second = segment(round, 2);
    box.noteVadSpeech(SES, "start", first);
    box.noteVadSpeech(SES, "end", first);
    box.noteVadSpeech(SES, "start", second);
    box.noteVadSpeech(SES, "end", second);
    const failed = box.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: newId("ses"),
      text: "",
      captureMode: "hands_free",
      recognitionOutcome: "failed",
      hfRoundId: round,
      hfSegmentIds: [first.hfSegmentId, second.hfSegmentId],
      recordSeqFirst: 1,
      recordSeqLast: 2
    });
    expect(failed).toMatchObject({ brain: false, settleSpeech: true });
    expect(box.ledgerEntries(SES).map((item) => item.state)).toEqual(["unknown", "unknown"]);
    const again = box.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: newId("ses"),
      text: "",
      captureMode: "hands_free",
      recognitionOutcome: "failed",
      hfRoundId: round,
      hfSegmentIds: [first.hfSegmentId, second.hfSegmentId],
      recordSeqFirst: 1,
      recordSeqLast: 2
    });
    expect(again.brain).toBe(false);
    expect(box.ledgerEntries(SES).every((item) => item.state === "unknown")).toBe(true);
  });

  it("半新 FIFO 不消费带 hfRoundId 的项,并让随后 prepare 看到未分类在途", () => {
    const statuses: PipelineMsg[] = [];
    const box = new VoiceBarrier(mockSink(statuses), EPOCH);
    box.setPipelineEpoch(1);
    const round = newId("evt");
    const seg = segment(round, 1);
    box.noteVadSpeech(SES, "start", seg);
    box.noteVadSpeech(SES, "end", seg);
    const semi = box.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: newId("ses"),
      text: "旧客户想抢走",
      captureMode: "hands_free",
      recognitionOutcome: "ok"
    });
    expect(semi).toMatchObject({ brain: false, settleSpeech: false });
    expect(box.ledgerEntries(SES)[0]?.state).toBe("unconfirmed");
    box.handlePrepare(
      {
        t: "voice.anchor_prepare",
        sessionId: SES,
        requestId: newId("evt"),
        focusId: FOC,
        daemonEpoch: box.daemonEpoch
      },
      PEER
    );
    const rejected = [...statuses].reverse().find((item) => item.t === "voice.anchor_status");
    expect(rejected && rejected.t === "voice.anchor_status" && rejected.status === "rejected" && rejected.code).toBe(
      "voice_unclassified_inflight"
    );
  });

  it("HF final 不消费 PTT registry;旧 epoch final 不结算新 epoch", () => {
    const box = barrier();
    const captureId = newId("evt");
    box.registerDoneSpeaking({
      t: "turn.done_speaking",
      sessionId: SES,
      captureId,
      captureIntent: "send"
    });
    const round = newId("evt");
    const seg = segment(round, 1);
    box.noteVadSpeech(SES, "start", seg);
    box.noteVadSpeech(SES, "end", seg);
    box.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: newId("ses"),
      text: "免手一句",
      captureMode: "hands_free",
      recognitionOutcome: "ok",
      hfRoundId: round,
      hfSegmentIds: [seg.hfSegmentId],
      recordSeqFirst: 1,
      recordSeqLast: 1
    });
    expect(box.registryEntries(SES).find((entry) => entry.captureId === captureId)?.consumed).toBe(false);
    box.setPipelineEpoch(2);
    const stale = box.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: newId("ses"),
      text: "旧 epoch",
      captureMode: "hands_free",
      recognitionOutcome: "ok",
      hfRoundId: round,
      hfSegmentIds: [seg.hfSegmentId],
      recordSeqFirst: 1,
      recordSeqLast: 1
    });
    expect(stale).toMatchObject({ brain: false, settleSpeech: false });
  });
});
