// B2 接线:真实 VoiceHub dispatch → barrier → onSpeechSettled → dialog,不经 Brain 原文。
// 覆盖:打断后取消 final 恢复控制续办;陈旧 capture 不得解锁新轮。

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
  buildId: "hub-dialog-settle",
  protocolVersion: "1.0.0"
};

let server: Server;
let hub: VoiceHub;
let port: number;
let fx: FocusFixture;
let dialog: LiveDialog;
let messages: ChatMessage[][];
let brainTexts: string[];
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

beforeEach(async () => {
  fx = openFocusFixture();
  messages = [];
  brainTexts = [];
  releaseChat = undefined;
  const gate = new Promise<void>((res) => {
    releaseChat = res;
  });
  let chats = 0;
  const provider: LlmProvider = {
    kind: "api",
    model: "hub-dialog-settle",
    async chat(req) {
      chats += 1;
      messages.push(req.messages.map((m) => ({ ...m })));
      if (chats === 1) await gate;
      return {
        ok: true,
        text: "续办已恢复。",
        requestedModel: "hub-dialog-settle",
        observedModel: "hub-dialog-settle",
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
      dialog.settlePendingSpeech(info.sessionId, info.speechGen);
    },
    onAsrFinal: (msg) => {
      if (msg.t !== "asr.final") return;
      brainTexts.push(msg.text);
      void dialog.onAsrFinal(msg.sessionId, msg.turnId, msg.text);
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

describe("Hub → dialog 非 Brain final 结算", () => {
  it("barge-in 后取消 final 恢复控制续办,原文不进 Brain", async () => {
    const pipeline = await connect("pipeline");
    const consolePeer = await connect("console");
    consolePeer.ws.send(JSON.stringify({ t: "voice.mode", sessionId: fx.sessionId, mode: "ptt" }));
    dialog.injectControlTurn(fx.sessionId, { kind: "confirmation_settled", receiptRef: newId("apr") });
    await new Promise((r) => setTimeout(r, 30));
    expect(messages).toHaveLength(1);

    hub.injectPipelineMsg({
      t: "barge_in",
      sessionId: fx.sessionId,
      atMs: 1,
      truncatedSentenceId: "s-cut"
    });
    releaseChat?.();
    await new Promise((r) => setTimeout(r, 30));
    expect(messages).toHaveLength(1);

    const captureId = newId("evt");
    consolePeer.ws.send(
      JSON.stringify({
        t: "turn.done_speaking",
        sessionId: fx.sessionId,
        captureId,
        captureIntent: "cancel",
        holdForConfirm: true
      })
    );
    await new Promise((r) => setTimeout(r, 20));
    pipeline.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: fx.sessionId,
        turnId: newId("ses"),
        text: "取消录音的完整原文不得喂 Brain",
        captureMode: "ptt",
        captureId,
        recognitionOutcome: "ok"
      })
    );
    await new Promise((r) => setTimeout(r, 60));
    expect(brainTexts).toEqual([]);
    expect(messages.length).toBeGreaterThan(1);
    pipeline.ws.close();
    consolePeer.ws.close();
  });

  it("新 barge-in 后陈旧 cancel 不得解锁;匹配世代才恢复", async () => {
    const pipeline = await connect("pipeline");
    const consolePeer = await connect("console");
    consolePeer.ws.send(JSON.stringify({ t: "voice.mode", sessionId: fx.sessionId, mode: "ptt" }));
    dialog.injectControlTurn(fx.sessionId, { kind: "confirmation_settled", receiptRef: newId("apr") });
    await new Promise((r) => setTimeout(r, 30));
    expect(messages).toHaveLength(1);

    hub.injectPipelineMsg({
      t: "barge_in",
      sessionId: fx.sessionId,
      atMs: 1,
      truncatedSentenceId: "s-1"
    });
    releaseChat?.();
    await new Promise((r) => setTimeout(r, 30));
    expect(messages).toHaveLength(1);
    const staleCap = newId("evt");
    consolePeer.ws.send(
      JSON.stringify({
        t: "turn.done_speaking",
        sessionId: fx.sessionId,
        captureId: staleCap,
        captureIntent: "cancel",
        holdForConfirm: true
      })
    );
    await new Promise((r) => setTimeout(r, 20));
    hub.injectPipelineMsg({
      t: "barge_in",
      sessionId: fx.sessionId,
      atMs: 2,
      truncatedSentenceId: "s-2"
    });
    pipeline.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: fx.sessionId,
        turnId: newId("ses"),
        text: "旧取消",
        captureMode: "ptt",
        captureId: staleCap,
        recognitionOutcome: "ok"
      })
    );
    await new Promise((r) => setTimeout(r, 40));
    expect(messages).toHaveLength(1);
    expect(brainTexts).toEqual([]);

    const freshCap = newId("evt");
    consolePeer.ws.send(
      JSON.stringify({
        t: "turn.done_speaking",
        sessionId: fx.sessionId,
        captureId: freshCap,
        captureIntent: "cancel",
        holdForConfirm: true
      })
    );
    await new Promise((r) => setTimeout(r, 20));
    pipeline.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: fx.sessionId,
        turnId: newId("ses"),
        text: "",
        captureMode: "ptt",
        captureId: freshCap,
        recognitionOutcome: "ok"
      })
    );
    await new Promise((r) => setTimeout(r, 60));
    expect(brainTexts).toEqual([]);
    expect(messages.length).toBeGreaterThan(1);
    pipeline.ws.close();
    consolePeer.ws.close();
  });
});
