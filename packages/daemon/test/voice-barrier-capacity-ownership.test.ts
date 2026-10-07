import { describe, expect, it } from "vitest";
import { newId, type PipelineMsg } from "@saydo/contracts";
import { VoiceBarrier, type VoiceBarrierSink } from "../src/voice/voiceBarrier.js";

function fixture() {
  const messages: PipelineMsg[] = [];
  const sink: VoiceBarrierSink = {
    now: () => 1, sendToPeer: (_peer, msg) => { messages.push(msg); },
    sendToLocalSession: (_sid, msg) => { messages.push(msg); }, sendToPipeline: () => true,
    isPeerOpen: () => true, peerVia: () => "local", registerSession: () => {},
    closeCaptureGate: () => {}, openCaptureGate: () => {}, prewriteLastVoiceModePtt: () => {},
    hasPipelinePeer: () => true, currentPipelineIdentity: () => undefined,
    getSourceFocusId: () => undefined, audit: () => {}
  };
  const barrier = new VoiceBarrier(sink); barrier.setPipelineEpoch(1);
  const peer = newId("evt"), sid = newId("ses");
  const submit = (sessionId = sid, turnId = newId("ses")) => ({
    turnId, result: barrier.beginTurnText({ t: "turn.text", sessionId, turnId,
      text: "容量测试", typed: true, receiptAction: "submit", daemonEpoch: barrier.daemonEpoch }, peer)
  });
  return { barrier, peer, sid, messages, submit };
}

describe("回执容量及旧 HF 归属", () => {
  it("另一 sid 已决项不能为本 sid 的 32 个 pending 腾出额度", () => {
    const f = fixture(); const other = newId("ses"); const old = f.submit(other);
    f.barrier.completeTurnAccepted(other, old.turnId);
    const pending = Array.from({ length: 32 }, () => f.submit());
    expect(pending.every((row) => row.result.kind === "execute")).toBe(true);
    expect(f.submit().result).toMatchObject({ kind: "result", result: { code: "turn_receipt_capacity" } });
    for (const row of pending) expect(f.submit(f.sid, row.turnId).result.kind).toBe("drop");
  });

  it("全局 256 个 pending 不淘汰；本 sid 已决可替换后继续受 32 限制", () => {
    const f = fixture();
    for (let i = 0; i < 8; i++) {
      const sid = newId("ses");
      for (let j = 0; j < 32; j++) expect(f.submit(sid).result.kind).toBe("execute");
    }
    expect(f.submit().result).toMatchObject({ kind: "result", result: { code: "turn_receipt_capacity" } });
    const g = fixture();
    for (let i = 0; i < 32; i++) { const row = g.submit(); g.barrier.completeTurnAccepted(g.sid, row.turnId); }
    expect(g.submit().result.kind).toBe("execute");
    const cache = (g.barrier as unknown as { receipts: Map<string, unknown> }).receipts;
    expect(cache.size).toBe(32);
  });

  it("关门反馈优先但 512 个新 turnId 不造无限已决缓存", () => {
    const f = fixture(); f.barrier.handlePrepare({ t: "voice.anchor_prepare", sessionId: f.sid, requestId: newId("evt"), focusId: newId("foc"), daemonEpoch: f.barrier.daemonEpoch }, f.peer);
    for (let i = 0; i < 512; i++) {
      expect(f.submit().result).toMatchObject({ kind: "result", result: { code: "voice_anchor_pending" } });
    }
    const cache = (f.barrier as unknown as { receipts: Map<string, unknown> }).receipts;
    expect(cache.size).toBeLessThanOrEqual(32);
    const g = fixture();
    for (let i = 0; i < 12; i++) {
      const sid = newId("ses"); g.barrier.handlePrepare({ t: "voice.anchor_prepare", sessionId: sid, requestId: newId("evt"), focusId: newId("foc"), daemonEpoch: g.barrier.daemonEpoch }, g.peer);
      for (let j = 0; j < 40; j++) g.submit(sid);
    }
    expect((g.barrier as unknown as { receipts: Map<string, unknown> }).receipts.size).toBeLessThanOrEqual(256);
  });

  it("只有 PTT 在途时 orphan legacy HF final 不移交旧稿", () => {
    const f = fixture(); const captureId = newId("evt"), requestId = newId("evt");
    const registration = f.barrier.registerDoneSpeaking({ t: "turn.done_speaking", sessionId: f.sid, captureId, captureIntent: "edit", holdForConfirm: true });
    expect(registration).toEqual({ forward: { t: "turn.done_speaking", sessionId: f.sid, captureId }, legacyHold: false });
    f.barrier.handlePrepare({ t: "voice.anchor_prepare", sessionId: f.sid, requestId,
      focusId: newId("foc"), daemonEpoch: f.barrier.daemonEpoch }, f.peer);
    expect(f.barrier.legacyHttpAllowed(f.sid)).toBe(false);
    expect(f.submit().result).toMatchObject({ kind: "result", result: { code: "voice_anchor_pending" } });
    f.barrier.consumeAsrFinal({ t: "asr.final", sessionId: f.sid, turnId: newId("ses"),
      captureMode: "hands_free", recognitionOutcome: "ok", text: "没有拥有者的旧稿" });
    f.barrier.consumeAsrFinal({ t: "asr.final", sessionId: f.sid, turnId: newId("ses"),
      captureMode: "ptt", captureId, recognitionOutcome: "ok", text: "" });
    f.barrier.handleQuiesced({ t: "voice.quiesced", sessionId: f.sid, requestId, epoch: 1, classified: true }, undefined);
    expect(f.messages.some((msg) => msg.t === "voice.anchor_status" && msg.status === "prepared")).toBe(true);
    expect(f.messages.filter((msg) => msg.t === "voice.quiesced_transcript")).toEqual([]);
  });
});
