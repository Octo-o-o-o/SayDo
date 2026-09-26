// B2:语音结算与是否驱动 Brain 解耦;取消/空/失败/编辑结算已拥有轮,过期 final 不得解锁新轮。

import { describe, expect, it } from "vitest";
import { newId } from "@saydo/contracts";
import { VoiceBarrier, type VoiceBarrierSink } from "../src/voice/voiceBarrier.js";
import { LiveDialog } from "../src/live/dialog.js";
import { ConfirmationLoop } from "../src/live/confirm.js";
import { LiveVoiceSessions } from "../src/live/voiceSessions.js";
import { SessionManager } from "../src/session/manager.js";
import { openFocusFixture } from "./helpers/focus-fixture.js";
import type { AuditSink } from "../src/obs/audit.js";
import type { Logger } from "../src/obs/logger.js";
import type { ChatMessage, LlmProvider } from "../src/providers/types.js";

const SES = newId("ses");
const FOC = newId("foc");
const EPOCH = newId("evt");

function mockSink(): VoiceBarrierSink {
  return {
    now: () => Date.now(),
    sendToPeer: () => {},
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
      buildId: "settle-speech",
      protocolVersion: "1.0.0"
    }),
    getSourceFocusId: () => FOC,
    audit: () => {}
  };
}

function barrierWithEpoch(): VoiceBarrier {
  const barrier = new VoiceBarrier(mockSink(), EPOCH);
  barrier.setPipelineEpoch(1);
  return barrier;
}

function pttCancel(barrier: VoiceBarrier, captureId: string): ReturnType<VoiceBarrier["consumeAsrFinal"]> {
  const registered = barrier.registerDoneSpeaking({
    t: "turn.done_speaking",
    sessionId: SES,
    captureId,
    captureIntent: "cancel",
    holdForConfirm: true
  });
  expect(registered.forward).toBeTruthy();
  return barrier.consumeAsrFinal({
    t: "asr.final",
    sessionId: SES,
    turnId: newId("ses"),
    text: "这段取消原文不得进 Brain",
    captureMode: "ptt",
    captureId,
    recognitionOutcome: "ok"
  });
}

describe("consumeAsrFinal 结算与 Brain 解耦", () => {
  it("PTT 取消/空/失败/编辑:settleSpeech 且 brain=false,不把原文当用户轮", () => {
    const barrier = barrierWithEpoch();
    const capCancel = newId("evt");
    const cancel = pttCancel(barrier, capCancel);
    expect(cancel).toMatchObject({ brain: false, settleSpeech: true, broadcast: false });
    expect(cancel.speechGen).toBe(0);

    const capEmpty = newId("evt");
    barrier.registerDoneSpeaking({
      t: "turn.done_speaking",
      sessionId: SES,
      captureId: capEmpty,
      captureIntent: "send"
    });
    const empty = barrier.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: newId("ses"),
      text: "   ",
      captureMode: "ptt",
      captureId: capEmpty,
      recognitionOutcome: "ok"
    });
    expect(empty).toMatchObject({ brain: false, settleSpeech: true });

    const capFail = newId("evt");
    barrier.registerDoneSpeaking({
      t: "turn.done_speaking",
      sessionId: SES,
      captureId: capFail,
      captureIntent: "send"
    });
    const failed = barrier.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: newId("ses"),
      text: "",
      captureMode: "ptt",
      captureId: capFail,
      recognitionOutcome: "failed"
    });
    expect(failed).toMatchObject({ brain: false, settleSpeech: true });

    const capEdit = newId("evt");
    barrier.registerDoneSpeaking({
      t: "turn.done_speaking",
      sessionId: SES,
      captureId: capEdit,
      captureIntent: "edit",
      holdForConfirm: true
    });
    const edit = barrier.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: newId("ses"),
      text: "编辑稿全文",
      captureMode: "ptt",
      captureId: capEdit,
      recognitionOutcome: "ok"
    });
    expect(edit).toMatchObject({ brain: false, settleSpeech: true });
  });

  it("过期 capture 不得 settle 新一轮", () => {
    const barrier = barrierWithEpoch();
    const staleCap = newId("evt");
    barrier.registerDoneSpeaking({
      t: "turn.done_speaking",
      sessionId: SES,
      captureId: staleCap,
      captureIntent: "cancel",
      holdForConfirm: true
    });
    barrier.noteBargeIn(SES);
    const late = barrier.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: newId("ses"),
      text: "旧轮取消",
      captureMode: "ptt",
      captureId: staleCap,
      recognitionOutcome: "ok"
    });
    expect(late.settleSpeech).toBe(true);
    expect(late.speechGen).toBe(0);
    const freshCap = newId("evt");
    barrier.registerDoneSpeaking({
      t: "turn.done_speaking",
      sessionId: SES,
      captureId: freshCap,
      captureIntent: "cancel",
      holdForConfirm: true
    });
    const fresh = barrier.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: newId("ses"),
      text: "",
      captureMode: "ptt",
      captureId: freshCap,
      recognitionOutcome: "ok"
    });
    expect(fresh.speechGen).toBe(1);
    expect(fresh.speechGen).not.toBe(late.speechGen);
  });

  it("HF 成功 ACK 后剩余已确认,迟到 unmatched 不得 brain/settle", () => {
    const barrier = barrierWithEpoch();
    barrier.noteVadSpeech(SES, "start");
    barrier.noteVadSpeech(SES, "end");
    const first = barrier.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: newId("ses"),
      text: "第一段",
      captureMode: "hands_free",
      recognitionOutcome: "ok"
    });
    expect(first.brain).toBe(true);
    const late = barrier.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: newId("ses"),
      text: "迟到旧段",
      captureMode: "hands_free",
      recognitionOutcome: "ok"
    });
    expect(late.brain).toBe(false);
    expect(late.settleSpeech).toBe(false);
  });

  it("B2 生产序列:VAD start 先于 barge-in,空 final 必须带新世代才能结算", () => {
    const barrier = barrierWithEpoch();
    barrier.noteVadSpeech(SES, "start");
    const pendingGen = barrier.noteBargeIn(SES);
    expect(pendingGen).toBe(1);
    barrier.noteVadSpeech(SES, "end");
    barrier.registerDoneSpeaking({ t: "turn.done_speaking", sessionId: SES, captureMode: "hands_free" });
    const empty = barrier.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: newId("ses"),
      text: "",
      captureMode: "hands_free",
      recognitionOutcome: "ok"
    });
    expect(empty).toMatchObject({ broadcast: true, brain: false, settleSpeech: true, speechGen: 1 });
  });

  it("B2 无自然 end:start 后 barge-in 再 HF done,空 final 仍属同一轮世代", () => {
    const barrier = barrierWithEpoch();
    barrier.noteVadSpeech(SES, "start");
    expect(barrier.noteBargeIn(SES)).toBe(1);
    barrier.registerDoneSpeaking({ t: "turn.done_speaking", sessionId: SES, captureMode: "hands_free" });
    const empty = barrier.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: newId("ses"),
      text: "",
      captureMode: "hands_free",
      recognitionOutcome: "ok"
    });
    expect(empty.settleSpeech).toBe(true);
    expect(empty.speechGen).toBe(1);
  });

  it("EOU 遗留最老项保持旧世代,不得冒充后轮 barge-in 解锁", () => {
    const barrier = barrierWithEpoch();
    barrier.noteVadSpeech(SES, "start");
    barrier.noteVadSpeech(SES, "end");
    barrier.noteVadSpeech(SES, "start");
    const newer = barrier.noteBargeIn(SES);
    expect(newer).toBe(1);
    barrier.noteVadSpeech(SES, "end");
    const leftoverEmpty = barrier.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: newId("ses"),
      text: "",
      captureMode: "hands_free",
      recognitionOutcome: "ok"
    });
    expect(leftoverEmpty.settleSpeech).toBe(true);
    expect(leftoverEmpty.speechGen).toBe(0);
    expect(leftoverEmpty.speechGen).not.toBe(newer);
  });

  it("EOU 两段闭合只确认最老一条,不得一条 final 清空后轮", () => {
    const barrier = barrierWithEpoch();
    barrier.noteVadSpeech(SES, "start");
    barrier.noteVadSpeech(SES, "end");
    barrier.noteVadSpeech(SES, "start");
    barrier.noteVadSpeech(SES, "end");
    const merged = barrier.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: newId("ses"),
      text: "两段合成一句",
      captureMode: "hands_free",
      recognitionOutcome: "ok"
    });
    expect(merged.brain).toBe(true);
    const second = barrier.consumeAsrFinal({
      t: "asr.final",
      sessionId: SES,
      turnId: newId("ses"),
      text: "第二句命令",
      captureMode: "hands_free",
      recognitionOutcome: "ok"
    });
    expect(second.brain).toBe(true);
  });
});

const nullLog = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child() {
    return this;
  }
} as unknown as Logger;

describe("dialog settlePendingSpeech 世代隔离", () => {
  it("陈旧 speechGen 不得清掉新一轮 speechPending", async () => {
    const fx = openFocusFixture();
    const messages: ChatMessage[][] = [];
    let release: (() => void) | undefined;
    const gate = new Promise<void>((res) => {
      release = res;
    });
    const provider: LlmProvider = {
      kind: "api",
      model: "settle-iso",
      async chat(req) {
        messages.push(req.messages.map((m) => ({ ...m })));
        await gate;
        return {
          ok: true,
          text: "续办。",
          requestedModel: "settle-iso",
          observedModel: "settle-iso",
          observedModelSource: "stream",
          observedModelExempted: false,
          usage: { promptTokens: 1, completionTokens: 1 }
        };
      }
    };
    const audit: AuditSink = { record: () => ({ id: "aud" }) };
    const sm = new SessionManager({ db: fx.db, audit, storeTranscript: true });
    const live = new LiveVoiceSessions({
      db: fx.db,
      audit,
      sessions: sm,
      saydoHome: fx.home,
      idleSuspendSec: 0
    });
    const confirm = new ConfirmationLoop({}, fx.db, audit);
    const dialog = new LiveDialog({
      db: fx.db,
      audit,
      sessions: live,
      dialogProvider: provider,
      say: () => true,
      log: nullLog,
      confirm
    });
    live.ensureSession(fx.sessionId);
    dialog.injectControlTurn(fx.sessionId, { kind: "confirmation_settled", receiptRef: newId("apr") });
    await new Promise((r) => setTimeout(r, 20));
    expect(messages).toHaveLength(1);
    dialog.onBargeIn(fx.sessionId, "s-old", 1);
    release?.();
    await new Promise((r) => setTimeout(r, 30));
    expect(messages).toHaveLength(1);
    dialog.settlePendingSpeech(fx.sessionId, 0);
    await new Promise((r) => setTimeout(r, 20));
    expect(messages).toHaveLength(1);
    dialog.onBargeIn(fx.sessionId, "s-new", 2);
    dialog.settlePendingSpeech(fx.sessionId, 1);
    await new Promise((r) => setTimeout(r, 20));
    expect(messages).toHaveLength(1);
    dialog.settlePendingSpeech(fx.sessionId, 2);
    await new Promise((r) => setTimeout(r, 40));
    expect(messages.length).toBeGreaterThan(1);
    fx.close();
  });
});
