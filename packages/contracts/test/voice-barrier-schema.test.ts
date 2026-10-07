import { describe, expect, it } from "vitest";
import { newId } from "../src/ids.js";
import {
  PIPELINE_EPOCH_MAX,
  PIPELINE_EPOCH_MIN,
  asrFinalMsgSchema,
  captureRegistryEntrySchema,
  focusAnchorOkSchema,
  focusAnchorPayloadDigest,
  focusAnchorRequestBodySchema,
  normalizeDiscardUnknownEpochs,
  parseAsrFinal,
  parsePipelineInbound,
  pipelineMsgSchema,
  voiceAnchorStatusSchema,
  voiceHelloAckSchema
} from "../src/index.js";

const SES = newId("ses");
const TURN = newId("ses");
const FOC = newId("foc");
const EVT = newId("evt");
const CAP = newId("evt");
const PEER = newId("evt");
const EPOCH = newId("evt");

describe("AsrFinalMsg 七支与白名单", () => {
  it("旧 final 三字段皆缺仍合法", () => {
    expect(
      asrFinalMsgSchema.safeParse({ t: "asr.final", sessionId: SES, turnId: TURN, text: "旧轮" }).success
    ).toBe(true);
  });

  it("新 HF final 必带 recognitionOutcome ok,禁 captureId", () => {
    expect(
      parseAsrFinal({
        t: "asr.final",
        sessionId: SES,
        turnId: TURN,
        text: "免手一句",
        captureMode: "hands_free",
        recognitionOutcome: "ok",
        leaked: "drop-me"
      })
    ).toEqual({
      t: "asr.final",
      sessionId: SES,
      turnId: TURN,
      text: "免手一句",
      captureMode: "hands_free",
      recognitionOutcome: "ok"
    });
    expect(
      parseAsrFinal({
        t: "asr.final",
        sessionId: SES,
        turnId: TURN,
        text: "x",
        captureMode: "hands_free"
      })
    ).toBeNull();
    expect(
      parseAsrFinal({
        t: "asr.final",
        sessionId: SES,
        turnId: TURN,
        text: "x",
        captureMode: "hands_free",
        recognitionOutcome: "failed"
      })
    ).toBeNull();
    expect(
      parseAsrFinal({
        t: "asr.final",
        sessionId: SES,
        turnId: TURN,
        text: "x",
        captureMode: "hands_free",
        recognitionOutcome: "ok",
        captureId: CAP
      })
    ).toBeNull();
  });

  it("HF 新身份与半新 failed 分流;PTT 夹带身份整消息丢弃", () => {
    const round = newId("evt");
    const segA = newId("evt");
    const segB = newId("evt");
    expect(
      parseAsrFinal({
        t: "asr.final",
        sessionId: SES,
        turnId: TURN,
        text: "",
        captureMode: "hands_free",
        recognitionOutcome: "failed"
      })
    ).toMatchObject({ recognitionOutcome: "failed", text: "" });
    const merged = parseAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: TURN,
      text: "先保留 npm,然后补 pnpm",
      captureMode: "hands_free",
      recognitionOutcome: "ok",
      hfRoundId: round,
      hfSegmentIds: [segA, segB],
      recordSeqFirst: 1,
      recordSeqLast: 2
    });
    expect(merged && "hfSegmentIds" in merged ? merged.hfSegmentIds : []).toEqual([segA, segB]);
    expect(
      parseAsrFinal({
        t: "asr.final",
        sessionId: SES,
        turnId: TURN,
        text: "",
        captureMode: "hands_free",
        recognitionOutcome: "failed",
        hfRoundId: round,
        hfSegmentIds: [segA],
        recordSeqFirst: 1,
        recordSeqLast: 1
      })
    ).toMatchObject({ recognitionOutcome: "failed", hfRoundId: round });
    expect(
      parseAsrFinal({
        t: "asr.final",
        sessionId: SES,
        turnId: TURN,
        text: "x",
        captureMode: "hands_free",
        recognitionOutcome: "ok",
        hfRoundId: round
      })
    ).toBeNull();
    expect(
      parseAsrFinal({
        t: "asr.final",
        sessionId: SES,
        turnId: TURN,
        text: "x",
        captureMode: "ptt",
        captureId: CAP,
        recognitionOutcome: "ok",
        hfRoundId: round,
        hfSegmentIds: [segA],
        recordSeqFirst: 1,
        recordSeqLast: 1
      })
    ).toBeNull();
    expect(
      parsePipelineInbound({
        t: "vad.speech",
        sessionId: SES,
        phase: "start",
        hfRoundId: round
      })
    ).toBeNull();
    expect(
      parsePipelineInbound({
        t: "vad.speech",
        sessionId: SES,
        phase: "start",
        hfSegmentId: segA,
        hfRoundId: round,
        recordSeq: 1
      })
    ).toMatchObject({ hfSegmentId: segA, recordSeq: 1 });
  });

  it("PTT 夹带每种 HF 身份均拒绝,不能在白名单剥离后恢复合法", () => {
    const foreign = {
      hfSegmentId: newId("evt"), hfRoundId: newId("evt"), recordSeq: 1,
      hfSegmentIds: [newId("evt")], recordSeqFirst: 1, recordSeqLast: 1
    };
    for (const [key, value] of Object.entries(foreign)) {
      expect(parseAsrFinal({
        t: "asr.final", sessionId: SES, turnId: TURN, text: "x",
        captureMode: "ptt", captureId: CAP, recognitionOutcome: "ok", [key]: value
      }), key).toBeNull();
    }
  });

  it("PTT failed 必须空文本;非空整消息丢弃", () => {
    expect(
      parseAsrFinal({
        t: "asr.final",
        sessionId: SES,
        turnId: TURN,
        text: "",
        captureMode: "ptt",
        captureId: CAP,
        recognitionOutcome: "failed"
      })
    ).toMatchObject({ recognitionOutcome: "failed", text: "" });
    expect(
      parseAsrFinal({
        t: "asr.final",
        sessionId: SES,
        turnId: TURN,
        text: "残留",
        captureMode: "ptt",
        captureId: CAP,
        recognitionOutcome: "failed"
      })
    ).toBeNull();
  });
});

describe("屏障消息合法/非法", () => {
  it("hello.ack 必须成对 peerId/daemonEpoch,且为 evt_", () => {
    expect(voiceHelloAckSchema.safeParse({ t: "hello.ack", v: 1, peerId: PEER, daemonEpoch: EPOCH }).success).toBe(true);
    expect(voiceHelloAckSchema.safeParse({ t: "hello.ack", v: 1 }).success).toBe(false);
    expect(voiceHelloAckSchema.safeParse({ t: "hello.ack", v: 1, peerId: SES, daemonEpoch: EPOCH }).success).toBe(false);
  });

  it("prepare/status/quiesce/result 形状", () => {
    expect(
      pipelineMsgSchema.safeParse({
        t: "voice.anchor_prepare",
        sessionId: SES,
        requestId: EVT,
        focusId: FOC,
        daemonEpoch: EPOCH,
        discardUnknownEpochs: [1, 3]
      }).success
    ).toBe(true);
    expect(
      pipelineMsgSchema.safeParse({
        t: "voice.anchor_prepare",
        sessionId: SES,
        requestId: EVT,
        focusId: FOC,
        daemonEpoch: EPOCH,
        discardUnknownEpochs: [3, 1]
      }).success
    ).toBe(false);
    expect(
      pipelineMsgSchema.safeParse({
        t: "voice.anchor_status",
        sessionId: SES,
        requestId: EVT,
        status: "rejected",
        code: "voice_audio_unknown",
        retryable: true,
        unknownEpochs: [2]
      }).success
    ).toBe(true);
    expect(
      pipelineMsgSchema.safeParse({
        t: "voice.anchor_status",
        sessionId: SES,
        requestId: EVT,
        status: "rejected",
        code: "voice_audio_unknown",
        retryable: true,
        unknownEpochs: []
      }).success
    ).toBe(false);
    expect(
      pipelineMsgSchema.safeParse({
        t: "voice.quiesced",
        sessionId: SES,
        requestId: EVT,
        epoch: 1,
        classified: false,
        code: "voice_recognition_failed"
      }).success
    ).toBe(true);
    expect(
      pipelineMsgSchema.safeParse({
        t: "voice.quiesced",
        sessionId: SES,
        requestId: EVT,
        epoch: 1,
        classified: false,
        code: "voice_quiesce_unsupported"
      }).success
    ).toBe(false);
    expect(
      pipelineMsgSchema.safeParse({
        t: "turn.text",
        sessionId: SES,
        turnId: TURN,
        text: "hello",
        typed: true,
        receiptAction: "submit"
      }).success
    ).toBe(false);
    expect(
      pipelineMsgSchema.safeParse({
        t: "turn.text",
        sessionId: SES,
        turnId: TURN,
        text: "hello",
        typed: true,
        receiptAction: "submit",
        daemonEpoch: EPOCH
      }).success
    ).toBe(true);
    expect(
      pipelineMsgSchema.safeParse({
        t: "turn.text.result",
        sessionId: SES,
        turnId: TURN,
        outcome: "unknown",
        retryable: false
      }).success
    ).toBe(true);
    expect(
      pipelineMsgSchema.safeParse({
        t: "voice.mode",
        sessionId: SES,
        mode: "ptt",
        quiesceRequestId: EVT
      }).success
    ).toBe(true);
    expect(
      pipelineMsgSchema.safeParse({
        t: "turn.done_speaking",
        sessionId: SES,
        captureMode: "hands_free"
      }).success
    ).toBe(true);
    expect(
      pipelineMsgSchema.safeParse({
        t: "turn.done_speaking",
        sessionId: SES,
        captureMode: "hands_free",
        captureId: CAP
      }).success
    ).toBe(false);
    expect(
      pipelineMsgSchema.safeParse({
        t: "turn.done_speaking",
        sessionId: SES,
        captureMode: "hands_free",
        holdForConfirm: true
      }).success
    ).toBe(false);
    expect(
      pipelineMsgSchema.safeParse({
        t: "confirm.card",
        sessionId: SES,
        receiptId: "rcpt_1",
        text: "拍板",
        kind: "dispatch",
        digest: "dig",
        digestVersion: 1,
        packageId: newId("pkg"),
        revision: 2,
        taskId: newId("tsk")
      }).success
    ).toBe(true);
  });

  it("HTTP 写口 additive requestId;新协议 200 必带 voiceBoundaryRequired true", () => {
    expect(focusAnchorRequestBodySchema.safeParse({ focusId: FOC }).success).toBe(true);
    expect(focusAnchorRequestBodySchema.safeParse({ focusId: FOC, requestId: EVT }).success).toBe(true);
    expect(
      focusAnchorOkSchema.safeParse({
        ok: true,
        sessionId: SES,
        focusId: FOC,
        already: false,
        voiceBoundaryId: EVT,
        voiceBoundaryRequired: true
      }).success
    ).toBe(true);
    expect(
      focusAnchorOkSchema.safeParse({
        ok: true,
        sessionId: SES,
        focusId: FOC,
        already: false,
        voiceBoundaryId: EVT,
        voiceBoundaryRequired: false
      }).success
    ).toBe(false);
  });

  it("payloadDigest 正规化 lane 空串与 discard 升序", () => {
    const a = focusAnchorPayloadDigest({ focusId: FOC, laneTitle: "  主线  ", discardUnknownEpochs: [1, 2] });
    const b = focusAnchorPayloadDigest({ focusId: FOC, laneTitle: "主线", discardUnknownEpochs: [1, 2] });
    const c = focusAnchorPayloadDigest({ focusId: FOC, laneTitle: "" });
    const d = focusAnchorPayloadDigest({ focusId: FOC });
    expect(a).toBe(b);
    expect(c).toBe(d);
    expect(() => normalizeDiscardUnknownEpochs([2, 2])).toThrow("invalid_input");
    expect(normalizeDiscardUnknownEpochs([])).toBeUndefined();
  });

  it("voice.anchor_status voice_audio_unknown 直接 schema 与 pipeline 总入口", () => {
    const unknownOk = {
      t: "voice.anchor_status" as const,
      sessionId: SES,
      requestId: EVT,
      status: "rejected" as const,
      code: "voice_audio_unknown" as const,
      retryable: true as const,
      unknownEpochs: [PIPELINE_EPOCH_MIN, 2, PIPELINE_EPOCH_MAX]
    };
    expect(voiceAnchorStatusSchema.safeParse(unknownOk).success).toBe(true);
    expect(pipelineMsgSchema.safeParse(unknownOk).success).toBe(true);
    expect(parsePipelineInbound(unknownOk)).toMatchObject(unknownOk);

    const missingEpochs = {
      t: "voice.anchor_status",
      sessionId: SES,
      requestId: EVT,
      status: "rejected",
      code: "voice_audio_unknown",
      retryable: true
    };
    expect(voiceAnchorStatusSchema.safeParse(missingEpochs).success).toBe(false);
    expect(pipelineMsgSchema.safeParse(missingEpochs).success).toBe(false);
    expect(parsePipelineInbound(missingEpochs)).toBeNull();

    const missingAndNotRetryable = { ...missingEpochs, retryable: false };
    expect(voiceAnchorStatusSchema.safeParse(missingAndNotRetryable).success).toBe(false);
    expect(pipelineMsgSchema.safeParse(missingAndNotRetryable).success).toBe(false);
    expect(parsePipelineInbound(missingAndNotRetryable)).toBeNull();

    const unsorted = { ...unknownOk, unknownEpochs: [3, 1] };
    expect(voiceAnchorStatusSchema.safeParse(unsorted).success).toBe(false);
    expect(pipelineMsgSchema.safeParse(unsorted).success).toBe(false);
    expect(parsePipelineInbound(unsorted)).toBeNull();

    const duplicate = { ...unknownOk, unknownEpochs: [2, 2] };
    expect(voiceAnchorStatusSchema.safeParse(duplicate).success).toBe(false);
    expect(pipelineMsgSchema.safeParse(duplicate).success).toBe(false);
    expect(parsePipelineInbound(duplicate)).toBeNull();

    const emptyList = { ...unknownOk, unknownEpochs: [] };
    expect(voiceAnchorStatusSchema.safeParse(emptyList).success).toBe(false);
    expect(pipelineMsgSchema.safeParse(emptyList).success).toBe(false);

    const belowMin = { ...unknownOk, unknownEpochs: [0] };
    expect(voiceAnchorStatusSchema.safeParse(belowMin).success).toBe(false);
    expect(pipelineMsgSchema.safeParse(belowMin).success).toBe(false);

    const aboveMax = { ...unknownOk, unknownEpochs: [PIPELINE_EPOCH_MAX + 1] };
    expect(voiceAnchorStatusSchema.safeParse(aboveMax).success).toBe(false);
    expect(pipelineMsgSchema.safeParse(aboveMax).success).toBe(false);

    const otherRetryable = {
      t: "voice.anchor_status",
      sessionId: SES,
      requestId: EVT,
      status: "rejected",
      code: "voice_peer_mismatch",
      retryable: true
    };
    const otherNotRetryable = { ...otherRetryable, code: "unknown", retryable: false };
    expect(voiceAnchorStatusSchema.safeParse(otherRetryable).success).toBe(true);
    expect(pipelineMsgSchema.safeParse(otherRetryable).success).toBe(true);
    expect(voiceAnchorStatusSchema.safeParse(otherNotRetryable).success).toBe(true);
    expect(pipelineMsgSchema.safeParse(otherNotRetryable).success).toBe(true);

    const prepared = { t: "voice.anchor_status", sessionId: SES, requestId: EVT, status: "prepared" };
    const preparedEmpty = { ...prepared, emptyRound: "empty" };
    const rearmed = { t: "voice.anchor_status", sessionId: SES, requestId: EVT, status: "rearmed" };
    expect(voiceAnchorStatusSchema.safeParse(prepared).success).toBe(true);
    expect(pipelineMsgSchema.safeParse(prepared).success).toBe(true);
    expect(voiceAnchorStatusSchema.safeParse(preparedEmpty).success).toBe(true);
    expect(pipelineMsgSchema.safeParse(preparedEmpty).success).toBe(true);
    expect(voiceAnchorStatusSchema.safeParse(rearmed).success).toBe(true);
    expect(pipelineMsgSchema.safeParse(rearmed).success).toBe(true);
  });

  it("CaptureRegistryEntry 合法三态与非法组合", () => {
    const base = { sessionId: SES, captureId: CAP, epoch: PIPELINE_EPOCH_MIN, intent: "send" as const };
    const pending = { ...base, consumed: false as const, discarded: false as const };
    const consumed = { ...base, consumed: true as const, discarded: false as const };
    const tombstone = { ...base, consumed: true as const, discarded: true as const, epoch: PIPELINE_EPOCH_MAX };
    expect(captureRegistryEntrySchema.safeParse(pending).success).toBe(true);
    expect(captureRegistryEntrySchema.safeParse(consumed).success).toBe(true);
    expect(captureRegistryEntrySchema.safeParse(tombstone).success).toBe(true);

    expect(captureRegistryEntrySchema.safeParse({ ...base, consumed: false, discarded: true }).success).toBe(false);
    expect(captureRegistryEntrySchema.safeParse({ captureId: CAP, epoch: 1, intent: "send", consumed: false, discarded: false }).success).toBe(false);
    expect(captureRegistryEntrySchema.safeParse({ ...pending, extra: true }).success).toBe(false);
    expect(captureRegistryEntrySchema.safeParse({ ...pending, epoch: 0 }).success).toBe(false);
    expect(captureRegistryEntrySchema.safeParse({ ...pending, epoch: PIPELINE_EPOCH_MAX + 1 }).success).toBe(false);
    expect(captureRegistryEntrySchema.safeParse({ ...pending, captureId: SES }).success).toBe(false);
    expect(captureRegistryEntrySchema.safeParse({ ...pending, intent: "hold" }).success).toBe(false);
  });

  it("parsePipelineInbound 剥离 asr.final 白名单外字段", () => {
    const msg = parsePipelineInbound({
      t: "asr.final",
      sessionId: SES,
      turnId: TURN,
      text: "ok",
      captureMode: "ptt",
      captureId: CAP,
      recognitionOutcome: "ok",
      holdForConfirm: true
    });
    expect(msg).toMatchObject({ t: "asr.final", captureMode: "ptt", recognitionOutcome: "ok" });
    expect(msg && "holdForConfirm" in msg).toBe(false);
  });
});
