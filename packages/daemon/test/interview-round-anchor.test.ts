// 采访模型轮在锚定 CAS 成功后按启动时的锚退役:迟到 screen_text/tts 不得再发出。
// 重复同一 request、锚定失败不退役。回执和已写入的用户轮保留。

import { describe, expect, it } from "vitest";
import { newId } from "@saydo/contracts";
import { LiveDialog } from "../src/live/dialog.js";
import { LiveVoiceSessions } from "../src/live/voiceSessions.js";
import { SessionManager } from "../src/session/manager.js";
import { switchAnchorActivation } from "../src/focus/activation.js";
import { createFocus } from "../src/focus/registry.js";
import { VoiceBarrier, type VoiceBarrierSink } from "../src/voice/voiceBarrier.js";
import { openFocusFixture, type FocusFixture } from "./helpers/focus-fixture.js";
import type { AuditSink } from "../src/obs/audit.js";
import type { Logger } from "../src/obs/logger.js";
import type { ChatResult, LlmProvider } from "../src/providers/types.js";

const nullLog = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child() {
    return this;
  }
} as unknown as Logger;

const audit: AuditSink = { record: () => ({ id: "aud" }) };

function sink(): VoiceBarrierSink {
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
      buildId: "interview-round",
      protocolVersion: "1.0.0"
    }),
    getSourceFocusId: () => undefined,
    audit: () => {}
  };
}

function reply(text: string): ChatResult {
  return {
    ok: true,
    text,
    requestedModel: "interview-round",
    observedModel: "interview-round",
    observedModelSource: "stream",
    observedModelExempted: false,
    usage: { promptTokens: 1, completionTokens: 1 }
  };
}

function appliedNow(barrier: VoiceBarrier, sessionId: string): { focusId: string | null; requestId: string | null } {
  const fn = (barrier as unknown as {
    appliedAnchor?: (id: string) => { focusId: string; requestId: string } | null;
  }).appliedAnchor;
  if (typeof fn !== "function") return { focusId: null, requestId: null };
  return fn.call(barrier, sessionId) ?? { focusId: null, requestId: null };
}

function retireIfAny(dialog: LiveDialog, sessionId: string, focusId: string, requestId: string): void {
  const fn = (dialog as unknown as {
    retireForAnchor?: (id: string, next: { focusId: string; requestId: string }) => void;
  }).retireForAnchor;
  if (typeof fn === "function") fn.call(dialog, sessionId, { focusId, requestId });
}

function harness() {
  const fx = openFocusFixture();
  const barrier = new VoiceBarrier(sink(), newId("evt"));
  barrier.setPipelineEpoch(1);
  const said: string[] = [];
  const screens: string[] = [];
  let release: (() => void) | undefined;
  let markEntered: (() => void) | undefined;
  const entered = new Promise<void>((resolve) => {
    markEntered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const provider: LlmProvider = {
    kind: "api",
    model: "interview-round",
    async chat() {
      markEntered?.();
      await gate;
      return reply("A项目受众是谁？");
    }
  };
  const sm = new SessionManager({ db: fx.db, audit, storeTranscript: true });
  const live = new LiveVoiceSessions({
    db: fx.db,
    audit,
    sessions: sm,
    saydoHome: fx.home,
    idleSuspendSec: 0
  });
  const dialog = new LiveDialog({
    db: fx.db,
    audit,
    sessions: live,
    dialogProvider: provider,
    say: (_sid, _sentenceId, text) => {
      said.push(text);
      return true;
    },
    sendScreenText: (_sid, _turnId, text) => {
      screens.push(text);
      return { attempted: 1, succeeded: 1, failed: 0 };
    },
    log: nullLog,
    currentAnchor: (sessionId) => appliedNow(barrier, sessionId)
  });
  live.ensureSession(fx.sessionId);
  const focusA = createFocus(fx.db, { title: "事项A", sessionId: fx.sessionId }).focusId;
  const focusB = createFocus(fx.db, { title: "事项B", sessionId: fx.sessionId }).focusId;
  const peer = newId("evt");
  return {
    fx,
    barrier,
    dialog,
    live,
    said,
    screens,
    entered,
    release: () => release?.(),
    focusA,
    focusB,
    peer
  };
}

function anchor(
  fx: FocusFixture,
  barrier: VoiceBarrier,
  dialog: LiveDialog,
  focusId: string,
  requestId: string,
  daemonEpoch = barrier.daemonEpoch,
  peer = newId("evt")
): { status: number; state: string | undefined } {
  barrier.handlePrepare(
    {
      t: "voice.anchor_prepare",
      sessionId: fx.sessionId,
      requestId,
      focusId,
      daemonEpoch
    },
    peer
  );
  const prepared = barrier.recordFor(fx.sessionId, requestId);
  if (prepared?.state !== "prepared") {
    return { status: 0, state: prepared?.state };
  }
  const http = barrier.applyHttp({
    sessionId: fx.sessionId,
    body: { focusId, requestId },
    write: () => {
      const sw = switchAnchorActivation(fx.db, fx.sessionId, focusId, "user_explicit");
      retireIfAny(dialog, fx.sessionId, focusId, requestId);
      return { already: sw.already };
    }
  });
  return { status: http.status, state: barrier.recordFor(fx.sessionId, requestId)?.state };
}

describe("采访模型轮归属", () => {
  it("A 请求在途时 HTTP 锚定 B,迟到首包不发 screen_text/tts,用户轮和回执还在", async () => {
    const h = harness();
    const reqA = newId("evt");
    const reqB = newId("evt");
    expect(anchor(h.fx, h.barrier, h.dialog, h.focusA, reqA, h.barrier.daemonEpoch, h.peer).status).toBe(200);
    expect(h.barrier.handleRearm({ t: "voice.mode", sessionId: h.fx.sessionId, mode: "ptt", quiesceRequestId: reqA }, h.peer)).toBe(
      "opened"
    );
    const turnId = newId("ses");
    const running = h.dialog.onAsrFinal(h.fx.sessionId, turnId, "先说一下这个事项");
    await h.entered;
    const receiptTurn = newId("ses");
    const begun = h.barrier.beginTurnText(
      {
        t: "turn.text",
        sessionId: h.fx.sessionId,
        turnId: receiptTurn,
        text: "保留的回执",
        typed: true,
        receiptAction: "submit",
        daemonEpoch: h.barrier.daemonEpoch
      },
      h.peer
    );
    expect(begun.kind).toBe("execute");
    h.barrier.completeTurnAccepted(h.fx.sessionId, receiptTurn);
    expect(anchor(h.fx, h.barrier, h.dialog, h.focusB, reqB, h.barrier.daemonEpoch, h.peer).status).toBe(200);
    h.release();
    await running;
    expect(h.screens).toEqual([]);
    expect(h.said).toEqual([]);
    expect(h.live.historyOf(h.fx.sessionId).some((row) => row.text.includes("先说一下这个事项"))).toBe(true);
    const replay = h.barrier.beginTurnText(
      {
        t: "turn.text",
        sessionId: h.fx.sessionId,
        turnId: receiptTurn,
        text: "保留的回执",
        typed: true,
        receiptAction: "replay",
        daemonEpoch: h.barrier.daemonEpoch
      },
      h.peer
    );
    expect(replay.kind).toBe("result");
    if (replay.kind === "result") expect(replay.result.outcome).toBe("accepted");
    await h.dialog.prepareShutdown();
    h.fx.close();
  });

  it("同 Focus 新 request 退役在途轮;同一 request 重复不退役;失败不退役", async () => {
    const h = harness();
    const reqA = newId("evt");
    expect(anchor(h.fx, h.barrier, h.dialog, h.focusA, reqA, h.barrier.daemonEpoch, h.peer).status).toBe(200);
    expect(h.barrier.handleRearm({ t: "voice.mode", sessionId: h.fx.sessionId, mode: "ptt", quiesceRequestId: reqA }, h.peer)).toBe(
      "opened"
    );
    const first = h.dialog.onAsrFinal(h.fx.sessionId, newId("ses"), "先说一下这个事项");
    await h.entered;
    const reqA2 = newId("evt");
    const again = anchor(h.fx, h.barrier, h.dialog, h.focusA, reqA2, h.barrier.daemonEpoch, h.peer);
    expect(again.status).toBe(200);
    h.release();
    await first;
    expect(h.screens).toEqual([]);
    expect(h.said).toEqual([]);

    const next = harness();
    const req = newId("evt");
    expect(anchor(next.fx, next.barrier, next.dialog, next.focusA, req, next.barrier.daemonEpoch, next.peer).status).toBe(200);
    expect(
      next.barrier.handleRearm({ t: "voice.mode", sessionId: next.fx.sessionId, mode: "ptt", quiesceRequestId: req }, next.peer)
    ).toBe("opened");
    const repeatRun = next.dialog.onAsrFinal(next.fx.sessionId, newId("ses"), "先说一下这个事项");
    await next.entered;
    const repeat = next.barrier.applyHttp({
      sessionId: next.fx.sessionId,
      body: { focusId: next.focusA, requestId: req },
      write: () => {
        throw new Error("同一 request 已 applied,不得再写锚");
      }
    });
    expect(repeat.status).toBe(200);
    expect(repeat.payload).toMatchObject({ already: true });
    next.release();
    await repeatRun;
    expect(next.screens).toEqual(["A项目受众是谁？"]);
    expect(next.said.some((line) => line.includes("A项目受众是谁"))).toBe(true);

    const failed = harness();
    const okReq = newId("evt");
    expect(anchor(failed.fx, failed.barrier, failed.dialog, failed.focusA, okReq, failed.barrier.daemonEpoch, failed.peer).status).toBe(
      200
    );
    expect(
      failed.barrier.handleRearm(
        { t: "voice.mode", sessionId: failed.fx.sessionId, mode: "ptt", quiesceRequestId: okReq },
        failed.peer
      )
    ).toBe("opened");
    const failedRun = failed.dialog.onAsrFinal(failed.fx.sessionId, newId("ses"), "先说一下这个事项");
    await failed.entered;
    const rejected = anchor(failed.fx, failed.barrier, failed.dialog, failed.focusB, newId("evt"), newId("evt"), failed.peer);
    expect(rejected.state).not.toBe("applied");
    failed.release();
    await failedRun;
    expect(failed.screens).toEqual(["A项目受众是谁？"]);
    await Promise.all([h.dialog.prepareShutdown(), next.dialog.prepareShutdown(), failed.dialog.prepareShutdown()]);
    failed.fx.close();
    next.fx.close();
    h.fx.close();
  });
});

describe("daemon 接收切档后的 PTT 终态", () => {
  it("模式切换不吃掉已登记 PTT;旧 speechGen 不清新 speechPending", async () => {
    const fx = openFocusFixture();
    const barrier = new VoiceBarrier(sink(), newId("evt"));
    barrier.setPipelineEpoch(4);
    const sid = fx.sessionId;
    const cap = newId("evt");
    const registered = barrier.registerDoneSpeaking({
      t: "turn.done_speaking",
      sessionId: sid,
      captureId: cap,
      captureIntent: "send"
    });
    expect(registered.forward?.t).toBe("turn.done_speaking");
    barrier.observeForwardedMode(sid, "ptt");
    barrier.observeForwardedMode(sid, "hands_free");
    const gen = barrier.noteBargeIn(sid);
    expect(gen).toBe(1);
    const late = barrier.consumeAsrFinal({
      t: "asr.final",
      sessionId: sid,
      turnId: newId("ses"),
      text: "手动档原文还在",
      captureMode: "ptt",
      captureId: cap,
      recognitionOutcome: "ok"
    });
    expect(late).toMatchObject({ brain: true, settleSpeech: true, speechGen: 0, broadcast: true });
    const sm = new SessionManager({ db: fx.db, audit, storeTranscript: true });
    const live = new LiveVoiceSessions({
      db: fx.db,
      audit,
      sessions: sm,
      saydoHome: fx.home,
      idleSuspendSec: 0
    });
    let chats = 0;
    const provider: LlmProvider = {
      kind: "api",
      model: "ptt-terminal",
      async chat() {
        chats += 1;
        return reply("续办。");
      }
    };
    const dialog = new LiveDialog({
      db: fx.db,
      audit,
      sessions: live,
      dialogProvider: provider,
      say: () => true,
      log: nullLog
    });
    live.ensureSession(sid);
    dialog.onBargeIn(sid, "s-old", gen);
    dialog.injectControlTurn(sid, { kind: "confirmation_settled", receiptRef: newId("apr") });
    void dialog.onAsrFinal(sid, newId("ses"), "手动档原文还在", late.speechGen);
    await Promise.resolve();
    await Promise.resolve();
    expect(dialog.hasUserTurnInFlight(sid)).toBe(false);
    expect(chats).toBe(0);
    dialog.settlePendingSpeech(sid, 0);
    await Promise.resolve();
    expect(chats).toBe(0);
    dialog.settlePendingSpeech(sid, gen);
    await Promise.resolve();
    await Promise.resolve();
    expect(chats).toBe(1);
    const emptyCap = newId("evt");
    barrier.registerDoneSpeaking({
      t: "turn.done_speaking",
      sessionId: sid,
      captureId: emptyCap,
      captureIntent: "send"
    });
    expect(
      barrier.consumeAsrFinal({
        t: "asr.final",
        sessionId: sid,
        turnId: newId("ses"),
        text: "",
        captureMode: "ptt",
        captureId: emptyCap,
        recognitionOutcome: "ok"
      })
    ).toMatchObject({ brain: false, settleSpeech: true });
    const failCap = newId("evt");
    barrier.registerDoneSpeaking({
      t: "turn.done_speaking",
      sessionId: sid,
      captureId: failCap,
      captureIntent: "send"
    });
    expect(
      barrier.consumeAsrFinal({
        t: "asr.final",
        sessionId: sid,
        turnId: newId("ses"),
        text: "",
        captureMode: "ptt",
        captureId: failCap,
        recognitionOutcome: "failed"
      }).brain
    ).toBe(false);
    const cancelCap = newId("evt");
    barrier.registerDoneSpeaking({
      t: "turn.done_speaking",
      sessionId: sid,
      captureId: cancelCap,
      captureIntent: "cancel",
      holdForConfirm: true
    });
    expect(
      barrier.consumeAsrFinal({
        t: "asr.final",
        sessionId: sid,
        turnId: newId("ses"),
        text: "取消原文",
        captureMode: "ptt",
        captureId: cancelCap,
        recognitionOutcome: "ok"
      })
    ).toMatchObject({ brain: false, broadcast: false, settleSpeech: true });
    await dialog.prepareShutdown();
    fx.close();
  });
});
