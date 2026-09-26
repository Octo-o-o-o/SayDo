// review-5 B1/B2:按生产消息序走 Hub → barrier → dialog,不改测试顺序、不加产品 sleep。
// 序列:pipeline vad.speech:start → console barge-in → (可选 end) → HF done → classified final。

import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { newId } from "@saydo/contracts";
import { VoiceHub, VOICE_WS_PROTOCOL_VERSION } from "../src/voice/hub.js";
import { LiveDialog } from "../src/live/dialog.js";
import { ConfirmationLoop } from "../src/live/confirm.js";
import { LiveVoiceSessions } from "../src/live/voiceSessions.js";
import { SessionManager } from "../src/session/manager.js";
import { openFocusFixture, type FocusFixture } from "./helpers/focus-fixture.js";
import type { Logger } from "../src/obs/logger.js";
import type { ChatMessage, LlmProvider } from "../src/providers/types.js";
import type { AuditSink } from "../src/obs/audit.js";

const silentLog: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => silentLog
};

const RUNTIME_IDENTITY = {
  sourceRevision: "1234567890abcdef1234567890abcdef12345678",
  buildId: "hf-round-production",
  protocolVersion: "1.0.0"
};

let server: Server;
let hub: VoiceHub;
let port: number;
let fx: FocusFixture;
let dialog: LiveDialog;
let messages: ChatMessage[][];
let brainTexts: string[];
let settled: Array<{ sessionId: string; speechGen?: number }>;
let releaseChat: (() => void) | undefined;

function connect(role: "pipeline" | "console"): Promise<{ ws: WebSocket; ack: { daemonEpoch: string } }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/voice`);
    ws.on("open", () =>
      ws.send(
        JSON.stringify({
          v: VOICE_WS_PROTOCOL_VERSION,
          role,
          ...(role === "pipeline" ? { identity: RUNTIME_IDENTITY } : {})
        })
      )
    );
    const onAck = (d: unknown, isBinary: boolean) => {
      if (isBinary) return;
      try {
        const m = JSON.parse(String(d)) as { t: string; daemonEpoch: string };
        if (m.t === "hello.ack") {
          ws.off("message", onAck);
          resolve({ ws, ack: m });
        }
      } catch {
        // 非 JSON
      }
    };
    ws.on("message", onAck);
    ws.on("close", (code) => reject(new Error(`closed ${code}`)));
    ws.on("error", reject);
  });
}

function waitPeerMsg(
  ws: WebSocket,
  pred: (msg: Record<string, unknown>) => boolean,
  label: string,
  timeoutMs = 1200
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off("message", onMsg);
      reject(new Error(label));
    }, timeoutMs);
    const onMsg = (d: unknown, isBinary: boolean) => {
      if (isBinary) return;
      try {
        const msg = JSON.parse(String(d)) as Record<string, unknown>;
        if (pred(msg)) {
          clearTimeout(timer);
          ws.off("message", onMsg);
          resolve(msg);
        }
      } catch {
        // 非 JSON
      }
    };
    ws.on("message", onMsg);
  });
}

async function waitUntil(pred: () => boolean, label: string, timeoutMs = 1200): Promise<void> {
  const started = Date.now();
  while (!pred()) {
    if (Date.now() - started > timeoutMs) throw new Error(label);
    await new Promise((resolve) => setImmediate(resolve));
  }
}

beforeEach(async () => {
  fx = openFocusFixture();
  messages = [];
  brainTexts = [];
  settled = [];
  releaseChat = undefined;
  const gate = new Promise<void>((res) => {
    releaseChat = res;
  });
  let chats = 0;
  const provider: LlmProvider = {
    kind: "api",
    model: "hf-round-production",
    async chat(req) {
      chats += 1;
      messages.push(req.messages.map((m) => ({ ...m })));
      if (chats === 1) await gate;
      return {
        ok: true,
        text: "续办已恢复。",
        requestedModel: "hf-round-production",
        observedModel: "hf-round-production",
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
  dialog = new LiveDialog({
    db: fx.db,
    audit,
    sessions: live,
    dialogProvider: provider,
    say: () => true,
    log: silentLog,
    confirm
  });
  live.ensureSession(fx.sessionId);

  server = createServer();
  hub = new VoiceHub(server, silentLog);
  hub.setEvents({
    verifyUpgrade: () => ({ ok: true, via: "local" }),
    onBargeIn: (msg, speechGen) => {
      dialog.onBargeIn(msg.sessionId, msg.truncatedSentenceId, speechGen);
    },
    onSpeechSettled: (info) => {
      settled.push(
        info.speechGen === undefined
          ? { sessionId: info.sessionId }
          : { sessionId: info.sessionId, speechGen: info.speechGen }
      );
      dialog.settlePendingSpeech(info.sessionId, info.speechGen);
    },
    onAsrFinal: (msg, speechGen) => {
      if (msg.t !== "asr.final") return;
      brainTexts.push(msg.text);
      void dialog.onAsrFinal(msg.sessionId, msg.turnId, msg.text, speechGen);
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const addr = server.address();
  if (typeof addr === "object" && addr) port = addr.port;
});

afterEach(async () => {
  await hub.close();
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  fx.close();
});

describe("生产 HF 轮次:VAD start → console barge-in → Hub/barrier/dialog", () => {
  it("X3 旧轮非空 final 后到,不进新 barge-in 的 Brain,也不清新 speechPending", async () => {
    const pipeline = await connect("pipeline");
    const consolePeer = await connect("console");
    consolePeer.ws.send(JSON.stringify({ t: "voice.mode", sessionId: fx.sessionId, mode: "hands_free" }));
    const round = newId("evt");
    const seg = newId("evt");
    const sawStart = waitPeerMsg(
      consolePeer.ws,
      (m) => m.t === "vad.speech" && m.phase === "start" && m.hfSegmentId === seg,
      "console 未收到带句段身份的 start"
    );
    pipeline.ws.send(
      JSON.stringify({
        t: "vad.speech",
        sessionId: fx.sessionId,
        phase: "start",
        hfSegmentId: seg,
        hfRoundId: round,
        recordSeq: 1
      })
    );
    await sawStart;
    pipeline.ws.send(
      JSON.stringify({
        t: "vad.speech",
        sessionId: fx.sessionId,
        phase: "end",
        hfSegmentId: seg,
        hfRoundId: round,
        recordSeq: 1
      })
    );
    dialog.injectControlTurn(fx.sessionId, { kind: "confirmation_settled", receiptRef: newId("apr") });
    await waitUntil(() => messages.length === 1, "控制轮未启动");
    const sawBarge = waitPeerMsg(pipeline.ws, (m) => m.t === "barge_in", "pipeline 未收到 barge-in");
    consolePeer.ws.send(
      JSON.stringify({ t: "barge_in", sessionId: fx.sessionId, atMs: 4, truncatedSentenceId: "s-late" })
    );
    await sawBarge;
    releaseChat?.();
    pipeline.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: fx.sessionId,
        turnId: newId("ses"),
        text: "旧轮还在说",
        captureMode: "hands_free",
        recognitionOutcome: "ok",
        hfRoundId: round,
        hfSegmentIds: [seg],
        recordSeqFirst: 1,
        recordSeqLast: 1
      })
    );
    await waitUntil(() => settled.length > 0 || brainTexts.length > 0, "旧 final 没有被 Hub 处理");
    await new Promise((resolve) => setImmediate(resolve));
    expect(brainTexts).toEqual([]);
    expect(messages).toHaveLength(1);
    expect(settled.some((row) => row.speechGen === 0)).toBe(true);
    pipeline.ws.close();
    consolePeer.ws.close();
  });

  it("B1 当前管线序(start 后无 end):HF 说完非空 final 进 Brain", async () => {
    const pipeline = await connect("pipeline");
    const consolePeer = await connect("console");
    consolePeer.ws.send(JSON.stringify({ t: "voice.mode", sessionId: fx.sessionId, mode: "hands_free" }));
    const sawStart = waitPeerMsg(
      consolePeer.ws,
      (m) => m.t === "vad.speech" && m.phase === "start",
      "console 未收到 vad start"
    );
    pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: fx.sessionId, phase: "start" }));
    await sawStart;
    const sawBarge = waitPeerMsg(pipeline.ws, (m) => m.t === "barge_in", "pipeline 未收到 barge-in");
    consolePeer.ws.send(
      JSON.stringify({
        t: "barge_in",
        sessionId: fx.sessionId,
        atMs: 1,
        truncatedSentenceId: "s-tts"
      })
    );
    await sawBarge;
    const sawDone = waitPeerMsg(
      pipeline.ws,
      (m) => m.t === "turn.done_speaking" && m.captureId === undefined,
      "pipeline 未收到 HF done"
    );
    consolePeer.ws.send(
      JSON.stringify({ t: "turn.done_speaking", sessionId: fx.sessionId, captureMode: "hands_free" })
    );
    await sawDone;
    pipeline.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: fx.sessionId,
        turnId: newId("ses"),
        text: "把这条写进决策包",
        captureMode: "hands_free",
        recognitionOutcome: "ok"
      })
    );
    await waitUntil(() => brainTexts.includes("把这条写进决策包"), "B1 非空 final 未进 Brain");
    pipeline.ws.close();
    consolePeer.ws.close();
  });

  it("B1 管线补 end 后再 final:非空仍进 Brain", async () => {
    const pipeline = await connect("pipeline");
    const consolePeer = await connect("console");
    consolePeer.ws.send(JSON.stringify({ t: "voice.mode", sessionId: fx.sessionId, mode: "hands_free" }));
    const sawStart = waitPeerMsg(
      consolePeer.ws,
      (m) => m.t === "vad.speech" && m.phase === "start",
      "console 未收到 vad start"
    );
    pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: fx.sessionId, phase: "start" }));
    await sawStart;
    const sawBarge = waitPeerMsg(pipeline.ws, (m) => m.t === "barge_in", "pipeline 未收到 barge-in");
    consolePeer.ws.send(
      JSON.stringify({ t: "barge_in", sessionId: fx.sessionId, atMs: 2, truncatedSentenceId: "s-tts2" })
    );
    await sawBarge;
    const sawDone = waitPeerMsg(
      pipeline.ws,
      (m) => m.t === "turn.done_speaking" && m.captureId === undefined,
      "pipeline 未收到 HF done"
    );
    consolePeer.ws.send(
      JSON.stringify({ t: "turn.done_speaking", sessionId: fx.sessionId, captureMode: "hands_free" })
    );
    await sawDone;
    pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: fx.sessionId, phase: "end" }));
    pipeline.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: fx.sessionId,
        turnId: newId("ses"),
        text: "补了 end 的指令",
        captureMode: "hands_free",
        recognitionOutcome: "ok"
      })
    );
    await waitUntil(() => brainTexts.includes("补了 end 的指令"), "补 end 后非空未进 Brain");
    pipeline.ws.close();
    consolePeer.ws.close();
  });

  it("B2 真实序 start→barge-in→自然 end→空 final 恢复控制续办", async () => {
    const pipeline = await connect("pipeline");
    const consolePeer = await connect("console");
    consolePeer.ws.send(JSON.stringify({ t: "voice.mode", sessionId: fx.sessionId, mode: "hands_free" }));
    dialog.injectControlTurn(fx.sessionId, { kind: "confirmation_settled", receiptRef: newId("apr") });
    await waitUntil(() => messages.length === 1, "控制轮未启动");
    const sawStart = waitPeerMsg(
      consolePeer.ws,
      (m) => m.t === "vad.speech" && m.phase === "start",
      "console 未收到 vad start"
    );
    pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: fx.sessionId, phase: "start" }));
    await sawStart;
    const sawBarge = waitPeerMsg(pipeline.ws, (m) => m.t === "barge_in", "pipeline 未收到 barge-in");
    consolePeer.ws.send(
      JSON.stringify({ t: "barge_in", sessionId: fx.sessionId, atMs: 3, truncatedSentenceId: "s-cut" })
    );
    await sawBarge;
    releaseChat?.();
    pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: fx.sessionId, phase: "end" }));
    const sawDone = waitPeerMsg(
      pipeline.ws,
      (m) => m.t === "turn.done_speaking" && m.captureId === undefined,
      "pipeline 未收到 HF done"
    );
    consolePeer.ws.send(
      JSON.stringify({ t: "turn.done_speaking", sessionId: fx.sessionId, captureMode: "hands_free" })
    );
    await sawDone;
    pipeline.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: fx.sessionId,
        turnId: newId("ses"),
        text: "",
        captureMode: "hands_free",
        recognitionOutcome: "ok"
      })
    );
    await waitUntil(() => messages.length > 1, "B2 空 final 未解除 speechPending");
    expect(brainTexts).toEqual([]);
    expect(settled.some((row) => row.speechGen === 1)).toBe(true);
    pipeline.ws.close();
    consolePeer.ws.close();
  });

  it("自然结束非空 final 进 Brain;取消 PTT 不得被后续 HF 吃掉", async () => {
    const pipeline = await connect("pipeline");
    const consolePeer = await connect("console");
    consolePeer.ws.send(JSON.stringify({ t: "voice.mode", sessionId: fx.sessionId, mode: "hands_free" }));
    const sawFirstStart = waitPeerMsg(
      consolePeer.ws,
      (m) => m.t === "vad.speech" && m.phase === "start",
      "console 未收到首轮 start"
    );
    pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: fx.sessionId, phase: "start" }));
    await sawFirstStart;
    pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: fx.sessionId, phase: "end" }));
    pipeline.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: fx.sessionId,
        turnId: newId("ses"),
        text: "自然结束一句",
        captureMode: "hands_free",
        recognitionOutcome: "ok"
      })
    );
    await waitUntil(() => brainTexts.includes("自然结束一句"), "自然结束未进 Brain");

    const captureId = newId("evt");
    consolePeer.ws.send(JSON.stringify({ t: "voice.mode", sessionId: fx.sessionId, mode: "ptt" }));
    const sawPttDone = waitPeerMsg(
      pipeline.ws,
      (m) => m.t === "turn.done_speaking" && m.captureId === captureId,
      "pipeline 未收到 PTT done"
    );
    consolePeer.ws.send(
      JSON.stringify({
        t: "turn.done_speaking",
        sessionId: fx.sessionId,
        captureId,
        captureIntent: "cancel",
        holdForConfirm: true
      })
    );
    await sawPttDone;
    const sawHfStart = waitPeerMsg(
      consolePeer.ws,
      (m) => m.t === "vad.speech" && m.phase === "start",
      "console 未收到后到 HF start"
    );
    pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: fx.sessionId, phase: "start" }));
    await sawHfStart;
    const sawHfDone = waitPeerMsg(
      pipeline.ws,
      (m) => m.t === "turn.done_speaking" && m.captureId === undefined,
      "pipeline 未收到后到 HF done"
    );
    consolePeer.ws.send(
      JSON.stringify({ t: "turn.done_speaking", sessionId: fx.sessionId, captureMode: "hands_free" })
    );
    await sawHfDone;
    pipeline.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: fx.sessionId,
        turnId: newId("ses"),
        text: "后到的免手",
        captureMode: "hands_free",
        recognitionOutcome: "ok"
      })
    );
    await waitUntil(() => brainTexts.includes("后到的免手"), "后到 HF 未进 Brain");
    pipeline.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: fx.sessionId,
        turnId: newId("ses"),
        text: "取消原文不得进 Brain",
        captureMode: "ptt",
        captureId,
        recognitionOutcome: "ok"
      })
    );
    await waitUntil(
      () => settled.some((row) => row.sessionId === fx.sessionId),
      "PTT 取消未走 settle"
    );
    expect(brainTexts).toEqual(["自然结束一句", "后到的免手"]);
    pipeline.ws.close();
    consolePeer.ws.close();
  });

  it("先发后到:新 barge-in 之后迟到旧世代空 final 不得恢复控制续办", async () => {
    const pipeline = await connect("pipeline");
    const consolePeer = await connect("console");
    consolePeer.ws.send(JSON.stringify({ t: "voice.mode", sessionId: fx.sessionId, mode: "hands_free" }));
    dialog.injectControlTurn(fx.sessionId, { kind: "confirmation_settled", receiptRef: newId("apr") });
    await waitUntil(() => messages.length === 1, "控制轮未启动");
    pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: fx.sessionId, phase: "start" }));
    pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: fx.sessionId, phase: "end" }));
    consolePeer.ws.send(
      JSON.stringify({ t: "barge_in", sessionId: fx.sessionId, atMs: 4, truncatedSentenceId: "s-1" })
    );
    const sawSecond = waitPeerMsg(
      consolePeer.ws,
      (m) => m.t === "vad.speech" && m.phase === "start",
      "console 未收到第二轮 start"
    );
    pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: fx.sessionId, phase: "start" }));
    await sawSecond;
    consolePeer.ws.send(
      JSON.stringify({ t: "barge_in", sessionId: fx.sessionId, atMs: 5, truncatedSentenceId: "s-2" })
    );
    releaseChat?.();
    pipeline.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: fx.sessionId,
        turnId: newId("ses"),
        text: "",
        captureMode: "hands_free",
        recognitionOutcome: "ok"
      })
    );
    await waitUntil(() => settled.length >= 1, "迟到空 final 未到 settle 钩");
    expect(messages).toHaveLength(1);
    expect(brainTexts).toEqual([]);
    pipeline.ws.close();
    consolePeer.ws.close();
  });
});
