// HF 终态生命周期:legacy failed、显式 discard、HF→PTT→HF。
// 模式切换与 discard 走真实 VoiceHub 消息序,断言 daemon 消费,不只看 pipeline 是否发出。

import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import { newId, VOICE_QUIESCE_TIMEOUT_MS } from "@saydo/contracts";
import { VoiceHub, VOICE_WS_PROTOCOL_VERSION } from "../src/voice/hub.js";
import { LiveDialog } from "../src/live/dialog.js";
import { ConfirmationLoop } from "../src/live/confirm.js";
import { LiveVoiceSessions } from "../src/live/voiceSessions.js";
import { SessionManager } from "../src/session/manager.js";
import { VoiceBarrier, type VoiceBarrierSink } from "../src/voice/voiceBarrier.js";
import { openFocusFixture, type FocusFixture } from "./helpers/focus-fixture.js";
import type { Logger } from "../src/obs/logger.js";
import type { LlmProvider } from "../src/providers/types.js";
import type { AuditSink } from "../src/obs/audit.js";

const silentLog: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => silentLog
};

const SES = newId("ses");
const FOC = newId("foc");
const RUNTIME_IDENTITY = {
  sourceRevision: "1234567890abcdef1234567890abcdef12345678",
  buildId: "hf-terminal-lifecycle",
  protocolVersion: "1.0.0"
};

type HelloAck = { t: string; daemonEpoch: string };

let server: Server;
let hub: VoiceHub;
let port: number;

function installEvents(extra: Parameters<VoiceHub["setEvents"]>[0] = {}): void {
  hub.setEvents({
    verifyUpgrade: () => ({ ok: true, via: "local" }),
    ...extra
  });
}

function connect(role: "pipeline" | "console"): Promise<{ ws: WebSocket; ack: HelloAck }> {
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
        const m = JSON.parse(String(d)) as HelloAck;
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

function nextJson(
  ws: WebSocket,
  predicate: (m: Record<string, unknown>) => boolean,
  label: string
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off("message", handler);
      reject(new Error(label));
    }, 3000);
    const handler = (d: unknown, isBinary: boolean) => {
      if (isBinary) return;
      try {
        const m = JSON.parse(String(d)) as Record<string, unknown>;
        if (predicate(m)) {
          clearTimeout(timer);
          ws.off("message", handler);
          resolve(m);
        }
      } catch {
        // 忽略非 JSON
      }
    };
    ws.on("message", handler);
  });
}

function prepareBody(daemonEpoch: string, requestId: string, sessionId = SES, extra: Record<string, unknown> = {}) {
  return {
    t: "voice.anchor_prepare",
    sessionId,
    requestId,
    focusId: FOC,
    daemonEpoch,
    ...extra
  };
}

async function settle(ms = 30): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function hfStates(sessionId: string): string[] {
  return hub.barrier
    .ledgerEntries(sessionId)
    .filter((item) => item.kind === "hands_free")
    .map((item) => item.state);
}

describe("Hub 上的 HF 终态", () => {
  beforeEach(async () => {
    server = createServer();
    hub = new VoiceHub(server, silentLog);
    installEvents();
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const addr = server.address();
    if (typeof addr === "object" && addr) port = addr.port;
  });

  afterEach(async () => {
    await hub.close();
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  });

  it("legacy failed 直接 unknown,重复不吃下一条,断连不洗白,不碰别的 sid/新轮", async () => {
    const pipeline = await connect("pipeline");
    const { ws } = await connect("console");
    const brains: string[] = [];
    installEvents({
      onAsrFinal: (msg) => {
        if (msg.t === "asr.final") brains.push(msg.text);
      }
    });
    const other = newId("ses");
    pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: other, phase: "start" }));
    pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: other, phase: "end" }));
    pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: SES, phase: "start" }));
    pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: SES, phase: "end" }));
    pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: SES, phase: "start" }));
    pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: SES, phase: "end" }));
    await settle();
    const turn = newId("ses");
    const failed = {
      t: "asr.final",
      sessionId: SES,
      turnId: turn,
      text: "",
      captureMode: "hands_free",
      recognitionOutcome: "failed"
    };
    pipeline.ws.send(JSON.stringify(failed));
    await settle();
    expect(brains).toEqual([]);
    expect(hfStates(SES)).toEqual(["unknown", "unconfirmed"]);
    expect(hfStates(other)).toEqual(["unconfirmed"]);
    pipeline.ws.send(JSON.stringify(failed));
    await settle();
    expect(hfStates(SES)).toEqual(["unknown", "unconfirmed"]);
    expect(brains).toEqual([]);

    const round = newId("evt");
    const seg = newId("evt");
    pipeline.ws.send(
      JSON.stringify({
        t: "vad.speech",
        sessionId: SES,
        phase: "start",
        hfSegmentId: seg,
        hfRoundId: round,
        recordSeq: 1
      })
    );
    pipeline.ws.send(
      JSON.stringify({
        t: "vad.speech",
        sessionId: SES,
        phase: "end",
        hfSegmentId: seg,
        hfRoundId: round,
        recordSeq: 1
      })
    );
    await settle();
    pipeline.ws.send(
      JSON.stringify({
        ...failed,
        turnId: newId("ses")
      })
    );
    await settle();
    expect(hub.barrier.ledgerEntries(SES).find((item) => item.hfRoundId === round)?.state).toBe("unconfirmed");
    expect(hfStates(SES).slice(0, 2)).toEqual(["unknown", "unconfirmed"]);

    pipeline.ws.close();
    await once(pipeline.ws, "close");
    await settle();
    const legacy = hub.barrier.ledgerEntries(SES).filter((item) => item.kind === "hands_free" && item.hfRoundId === undefined);
    expect(legacy[0]?.state).toBe("unknown");
    expect(legacy.some((item) => item.state === "confirmed")).toBe(false);
    expect(hub.barrier.unknownEpochs(SES)).toContain(1);
    ws.close();
  });

  it("preparing 期间的 legacy failed 不被随后的空成功 ACK 洗成 confirmed", async () => {
    const pipeline = await connect("pipeline");
    const { ws, ack } = await connect("console");
    const requestId = newId("evt");
    pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: SES, phase: "start" }));
    pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: SES, phase: "end" }));
    await settle();
    const held = nextJson(ws, (m) => m["requestId"] === requestId, "空成功 ACK 的状态");
    ws.send(JSON.stringify(prepareBody(ack.daemonEpoch, requestId)));
    await nextJson(pipeline.ws, (m) => m["t"] === "voice.quiesce" && m["requestId"] === requestId, "quiesce");
    pipeline.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: SES,
        turnId: newId("ses"),
        text: "",
        captureMode: "hands_free",
        recognitionOutcome: "failed"
      })
    );
    await settle();
    expect(hub.barrier.ledgerEntries(SES).find((item) => item.kind === "hands_free")?.state).toBe("unknown");
    pipeline.ws.send(
      JSON.stringify({
        t: "voice.quiesced",
        sessionId: SES,
        requestId,
        epoch: 1,
        classified: true,
        emptyRound: "empty"
      })
    );
    expect(await held).toMatchObject({ status: "rejected", code: "voice_recognition_failed" });
    expect(hub.barrier.ledgerEntries(SES).find((item) => item.kind === "hands_free")?.state).toBe("unknown");
    expect(hub.barrier.unknownEpochs(SES)).toEqual([1]);
    pipeline.ws.close();
    ws.close();
  });

  it("quiesce 失败后 discard 封闭旧轮,新轮可消费,迟到 final 不广播不进 Brain,别的 sid 不动", async () => {
    const pipeline = await connect("pipeline");
    const { ws, ack } = await connect("console");
    const brains: string[] = [];
    const consoleMsgs: Record<string, unknown>[] = [];
    ws.on("message", (d, isBinary) => {
      if (isBinary) return;
      try {
        consoleMsgs.push(JSON.parse(String(d)) as Record<string, unknown>);
      } catch {
        // 忽略
      }
    });
    installEvents({
      onAsrFinal: (msg) => {
        if (msg.t === "asr.final") brains.push(`${msg.sessionId}:${msg.text}`);
      }
    });
    const other = newId("ses");
    const otherRound = newId("evt");
    const otherSeg = newId("evt");
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "hands_free" }));
    pipeline.ws.send(
      JSON.stringify({
        t: "vad.speech",
        sessionId: other,
        phase: "start",
        hfSegmentId: otherSeg,
        hfRoundId: otherRound,
        recordSeq: 1
      })
    );
    pipeline.ws.send(
      JSON.stringify({
        t: "vad.speech",
        sessionId: other,
        phase: "end",
        hfSegmentId: otherSeg,
        hfRoundId: otherRound,
        recordSeq: 1
      })
    );
    const roundA = newId("evt");
    const segA = newId("evt");
    pipeline.ws.send(
      JSON.stringify({
        t: "vad.speech",
        sessionId: SES,
        phase: "start",
        hfSegmentId: segA,
        hfRoundId: roundA,
        recordSeq: 1
      })
    );
    pipeline.ws.send(
      JSON.stringify({
        t: "vad.speech",
        sessionId: SES,
        phase: "end",
        hfSegmentId: segA,
        hfRoundId: roundA,
        recordSeq: 1
      })
    );
    await settle();
    const failId = newId("evt");
    const failed = nextJson(ws, (m) => m["requestId"] === failId, "quiesce 失败状态");
    ws.send(JSON.stringify(prepareBody(ack.daemonEpoch, failId)));
    await nextJson(pipeline.ws, (m) => m["t"] === "voice.quiesce" && m["requestId"] === failId, "失败 quiesce");
    pipeline.ws.send(
      JSON.stringify({
        t: "voice.quiesced",
        sessionId: SES,
        requestId: failId,
        epoch: 1,
        classified: false,
        code: "voice_recognition_failed"
      })
    );
    expect(await failed).toMatchObject({ status: "rejected", code: "voice_recognition_failed" });
    expect(hub.barrier.ledgerEntries(SES).find((item) => item.hfRoundId === roundA)?.state).toBe("unknown");
    expect(hub.barrier.ledgerEntries(other).find((item) => item.hfRoundId === otherRound)?.state).toBe("unconfirmed");

    const discardId = newId("evt");
    const discarded = nextJson(ws, (m) => m["requestId"] === discardId, "discard 状态");
    ws.send(JSON.stringify(prepareBody(ack.daemonEpoch, discardId, SES, { discardUnknownEpochs: [1] })));
    await nextJson(pipeline.ws, (m) => m["t"] === "voice.quiesce" && m["requestId"] === discardId, "discard quiesce");
    pipeline.ws.send(
      JSON.stringify({
        t: "voice.quiesced",
        sessionId: SES,
        requestId: discardId,
        epoch: 1,
        classified: true,
        emptyRound: "empty"
      })
    );
    expect(await discarded).toMatchObject({ status: "prepared", requestId: discardId });
    expect(hub.barrier.ledgerEntries(SES).find((item) => item.hfRoundId === roundA)?.state).toBe("discarded");
    const replay = nextJson(ws, (m) => m["requestId"] === discardId && m["status"] === "prepared", "discard 重放");
    ws.send(JSON.stringify(prepareBody(ack.daemonEpoch, discardId, SES, { discardUnknownEpochs: [1] })));
    expect(await replay).toMatchObject({ status: "prepared" });
    expect(hub.barrier.applyHttp({
      sessionId: SES,
      body: { focusId: FOC, requestId: discardId },
      write: () => ({ already: false })
    }).status).toBe(200);
    const rearmed = nextJson(ws, (m) => m["status"] === "rearmed" && m["requestId"] === discardId, "rearm");
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt", quiesceRequestId: discardId }));
    expect(await rearmed).toMatchObject({ status: "rearmed" });
    const mic = Buffer.alloc(5);
    mic[0] = 0x01;
    ws.send(mic);
    await settle();
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "hands_free" }));
    const roundB = newId("evt");
    const segB = newId("evt");
    pipeline.ws.send(
      JSON.stringify({
        t: "vad.speech",
        sessionId: SES,
        phase: "start",
        hfSegmentId: segB,
        hfRoundId: roundB,
        recordSeq: 2
      })
    );
    pipeline.ws.send(
      JSON.stringify({
        t: "vad.speech",
        sessionId: SES,
        phase: "end",
        hfSegmentId: segB,
        hfRoundId: roundB,
        recordSeq: 2
      })
    );
    await settle();
    expect(hub.barrier.ledgerEntries(SES).some((item) => item.hfRoundId === roundB && item.state === "unconfirmed")).toBe(true);
    pipeline.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: SES,
        turnId: newId("ses"),
        text: "新轮指令",
        captureMode: "hands_free",
        recognitionOutcome: "ok",
        hfRoundId: roundB,
        hfSegmentIds: [segB],
        recordSeqFirst: 2,
        recordSeqLast: 2
      })
    );
    await settle();
    const late = {
      t: "asr.final",
      sessionId: SES,
      turnId: newId("ses"),
      text: "已放弃的旧轮",
      captureMode: "hands_free",
      recognitionOutcome: "ok",
      hfRoundId: roundA,
      hfSegmentIds: [segA],
      recordSeqFirst: 1,
      recordSeqLast: 1
    };
    pipeline.ws.send(JSON.stringify(late));
    pipeline.ws.send(JSON.stringify(late));
    await settle();
    expect(brains).toEqual([`${SES}:新轮指令`]);
    expect(consoleMsgs.some((item) => item["text"] === "已放弃的旧轮")).toBe(false);
    expect(hub.barrier.ledgerEntries(SES).find((item) => item.hfRoundId === roundA)?.state).toBe("discarded");
    expect(hub.barrier.ledgerEntries(SES).find((item) => item.hfRoundId === roundB)?.state).toBe("confirmed");
    expect(hub.barrier.ledgerEntries(other).find((item) => item.hfRoundId === otherRound)?.state).toBe("unconfirmed");
    pipeline.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: other,
        turnId: newId("ses"),
        text: "旁路会话",
        captureMode: "hands_free",
        recognitionOutcome: "ok",
        hfRoundId: otherRound,
        hfSegmentIds: [otherSeg],
        recordSeqFirst: 1,
        recordSeqLast: 1
      })
    );
    await settle();
    expect(brains).toContain(`${other}:旁路会话`);
    expect(hub.barrier.ledgerEntries(SES).find((item) => item.hfRoundId === roundA)?.state).toBe("discarded");
    pipeline.ws.close();
    ws.close();
  });

  it("HF A 结束且 ASR 在途时切到 PTT 再开 HF B,daemon 消费 B 并隔离迟到的 A", async () => {
    const fx: FocusFixture = openFocusFixture();
    const brains: string[] = [];
    const settled: Array<{ speechGen?: number }> = [];
    const gate = new Promise<void>(() => {});
    const provider: LlmProvider = {
      kind: "api",
      model: "hf-mode-switch",
      async chat(req) {
        void req;
        await gate;
        return {
          ok: true,
          text: "收到。",
          requestedModel: "hf-mode-switch",
          observedModel: "hf-mode-switch",
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
    const dialog = new LiveDialog({
      db: fx.db,
      audit,
      sessions: live,
      dialogProvider: provider,
      say: () => true,
      log: silentLog,
      confirm: new ConfirmationLoop({}, fx.db, audit)
    });
    live.ensureSession(fx.sessionId);
    const speechOf = (): { speechPending: boolean; pendingSpeechGen?: number } | undefined => {
      const map = (dialog as unknown as {
        controlBySession: Map<string, { speechPending: boolean; pendingSpeechGen?: number }>;
      }).controlBySession;
      return map.get(fx.sessionId);
    };
    installEvents({
      onBargeIn: (msg, speechGen) => {
        dialog.onBargeIn(msg.sessionId, msg.truncatedSentenceId, speechGen);
      },
      onSpeechSettled: (info) => {
        settled.push(info.speechGen === undefined ? {} : { speechGen: info.speechGen });
        dialog.settlePendingSpeech(info.sessionId, info.speechGen);
      },
      onAsrFinal: (msg, speechGen) => {
        if (msg.t !== "asr.final") return;
        brains.push(msg.text);
        if (msg.sessionId === fx.sessionId) {
          void dialog.onAsrFinal(msg.sessionId, msg.turnId, msg.text, speechGen);
        }
      }
    });
    try {
      const pipeline = await connect("pipeline");
      const consolePeer = await connect("console");
      const other = newId("ses");
      const otherRound = newId("evt");
      const otherSeg = newId("evt");
      consolePeer.ws.send(JSON.stringify({ t: "voice.mode", sessionId: fx.sessionId, mode: "hands_free" }));
      pipeline.ws.send(
        JSON.stringify({
          t: "vad.speech",
          sessionId: other,
          phase: "start",
          hfSegmentId: otherSeg,
          hfRoundId: otherRound,
          recordSeq: 1
        })
      );
      pipeline.ws.send(
        JSON.stringify({
          t: "vad.speech",
          sessionId: other,
          phase: "end",
          hfSegmentId: otherSeg,
          hfRoundId: otherRound,
          recordSeq: 1
        })
      );
      const roundA = newId("evt");
      const segA = newId("evt");
      pipeline.ws.send(
        JSON.stringify({
          t: "vad.speech",
          sessionId: fx.sessionId,
          phase: "start",
          hfSegmentId: segA,
          hfRoundId: roundA,
          recordSeq: 1
        })
      );
      consolePeer.ws.send(
        JSON.stringify({
          t: "barge_in",
          sessionId: fx.sessionId,
          atMs: 1,
          truncatedSentenceId: `s-${newId("ses")}-1`
        })
      );
      pipeline.ws.send(
        JSON.stringify({
          t: "vad.speech",
          sessionId: fx.sessionId,
          phase: "end",
          hfSegmentId: segA,
          hfRoundId: roundA,
          recordSeq: 1
        })
      );
      await settle();
      expect(speechOf()?.speechPending).toBe(true);
      consolePeer.ws.send(JSON.stringify({ t: "voice.mode", sessionId: fx.sessionId, mode: "ptt" }));
      await settle();
      expect(hub.barrier.ledgerEntries(fx.sessionId).find((item) => item.hfRoundId === roundA)?.state).toBe("unknown");
      expect(speechOf()?.speechPending).toBe(false);
      expect(hub.barrier.ledgerEntries(other).find((item) => item.hfRoundId === otherRound)?.state).toBe("unconfirmed");
      consolePeer.ws.send(JSON.stringify({ t: "voice.mode", sessionId: fx.sessionId, mode: "ptt" }));
      await settle();
      expect(hub.barrier.ledgerEntries(fx.sessionId).find((item) => item.hfRoundId === roundA)?.state).toBe("unknown");
      expect(hub.barrier.ledgerEntries(other).find((item) => item.hfRoundId === otherRound)?.state).toBe("unconfirmed");

      consolePeer.ws.send(JSON.stringify({ t: "voice.mode", sessionId: fx.sessionId, mode: "hands_free" }));
      const roundB = newId("evt");
      const segB = newId("evt");
      pipeline.ws.send(
        JSON.stringify({
          t: "vad.speech",
          sessionId: fx.sessionId,
          phase: "start",
          hfSegmentId: segB,
          hfRoundId: roundB,
          recordSeq: 2
        })
      );
      consolePeer.ws.send(
        JSON.stringify({
          t: "barge_in",
          sessionId: fx.sessionId,
          atMs: 2,
          truncatedSentenceId: `s-${newId("ses")}-2`
        })
      );
      pipeline.ws.send(
        JSON.stringify({
          t: "vad.speech",
          sessionId: fx.sessionId,
          phase: "end",
          hfSegmentId: segB,
          hfRoundId: roundB,
          recordSeq: 2
        })
      );
      await settle();
      expect(hub.barrier.ledgerEntries(fx.sessionId).some((item) => item.hfRoundId === roundB)).toBe(true);
      expect(speechOf()?.speechPending).toBe(true);
      expect(speechOf()?.pendingSpeechGen).toBe(2);
      const late = {
        t: "asr.final",
        sessionId: fx.sessionId,
        turnId: newId("ses"),
        text: "旧轮迟到",
        captureMode: "hands_free",
        recognitionOutcome: "ok",
        hfRoundId: roundA,
        hfSegmentIds: [segA],
        recordSeqFirst: 1,
        recordSeqLast: 1
      };
      const settledBeforeLate = settled.length;
      pipeline.ws.send(JSON.stringify(late));
      pipeline.ws.send(JSON.stringify(late));
      await settle();
      expect(brains).not.toContain("旧轮迟到");
      expect(settled.length).toBe(settledBeforeLate);
      expect(speechOf()?.speechPending).toBe(true);
      expect(speechOf()?.pendingSpeechGen).toBe(2);
      expect(hub.barrier.ledgerEntries(fx.sessionId).find((item) => item.hfRoundId === roundA)?.state).toBe("unknown");
      pipeline.ws.send(
        JSON.stringify({
          t: "asr.final",
          sessionId: fx.sessionId,
          turnId: newId("ses"),
          text: "新轮指令",
          captureMode: "hands_free",
          recognitionOutcome: "ok",
          hfRoundId: roundB,
          hfSegmentIds: [segB],
          recordSeqFirst: 2,
          recordSeqLast: 2
        })
      );
      await settle();
      expect(brains).toEqual(["新轮指令"]);
      expect(hub.barrier.ledgerEntries(fx.sessionId).find((item) => item.hfRoundId === roundB)?.state).toBe("confirmed");
      expect(hub.barrier.ledgerEntries(fx.sessionId).find((item) => item.hfRoundId === roundA)?.state).toBe("unknown");
      expect(hub.barrier.unknownEpochs(fx.sessionId)).toEqual([1]);
      pipeline.ws.close();
      consolePeer.ws.close();
    } finally {
      fx.close();
    }
  });

  it("legacy 成功与空 final 重放不确认下一轮,也不清掉新 speechPending", async () => {
    const fx: FocusFixture = openFocusFixture();
    const brains: Array<{ text: string; speechGen?: number }> = [];
    installEvents({
      onBargeIn: (msg, speechGen) => {
        dialogFor(fx).onBargeIn(msg.sessionId, msg.truncatedSentenceId, speechGen);
      },
      onSpeechSettled: (info) => {
        dialogFor(fx).settlePendingSpeech(info.sessionId, info.speechGen);
      },
      onAsrFinal: (msg, speechGen) => {
        if (msg.t !== "asr.final") return;
        brains.push(speechGen === undefined ? { text: msg.text } : { text: msg.text, speechGen });
        void dialogFor(fx).onAsrFinal(msg.sessionId, msg.turnId, msg.text, speechGen);
      }
    });
    const dialog = dialogFor(fx);
    const speechOf = speechState(dialog, fx.sessionId);
    try {
      const pipeline = await connect("pipeline");
      const consolePeer = await connect("console");
      const seen: string[] = [];
      consolePeer.ws.on("message", (d, isBinary) => {
        if (isBinary) return;
        try {
          const msg = JSON.parse(String(d)) as { t?: string; text?: string };
          if (msg.t === "asr.final" && typeof msg.text === "string") seen.push(msg.text);
        } catch {
          // 非 JSON
        }
      });
      const sid = fx.sessionId;
      pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: sid, phase: "start" }));
      pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: sid, phase: "end" }));
      await settle();
      const turnA = newId("ses");
      const finalA = {
        t: "asr.final",
        sessionId: sid,
        turnId: turnA,
        text: "A的原话",
        captureMode: "hands_free",
        recognitionOutcome: "ok"
      };
      // 真实console接收是本断言的因果前提；30ms定时不能代替WS消息已到达。
      const firstFinalSeen = nextJson(consolePeer.ws, (msg) => msg["t"] === "asr.final" && msg["sessionId"] === sid && msg["turnId"] === turnA && msg["text"] === "A的原话", "console did not receive first final");
      pipeline.ws.send(JSON.stringify(finalA));
      await firstFinalSeen;
      await settle();
      expect(brains).toEqual([{ text: "A的原话", speechGen: 0 }]);
      expect(seen).toEqual(["A的原话"]);
      consolePeer.ws.send(
        JSON.stringify({ t: "barge_in", sessionId: sid, atMs: 1, truncatedSentenceId: `s-${newId("ses")}-1` })
      );
      pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: sid, phase: "start" }));
      pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: sid, phase: "end" }));
      await settle();
      expect(speechOf()?.speechPending).toBe(true);
      const pendingGen = speechOf()?.pendingSpeechGen;
      pipeline.ws.send(JSON.stringify(finalA));
      await settle();
      expect(brains).toEqual([{ text: "A的原话", speechGen: 0 }]);
      expect(seen).toEqual(["A的原话"]);
      expect(speechOf()?.speechPending).toBe(true);
      expect(speechOf()?.pendingSpeechGen).toBe(pendingGen);
      expect(
        hub.barrier.ledgerEntries(sid).filter((item) => item.kind === "hands_free" && item.hfRoundId === undefined).map((item) => item.state)
      ).toEqual(["confirmed", "unconfirmed"]);
      pipeline.ws.send(
        JSON.stringify({
          t: "asr.final",
          sessionId: sid,
          turnId: newId("ses"),
          text: "B的新话",
          captureMode: "hands_free",
          recognitionOutcome: "ok"
        })
      );
      await settle();
      expect(brains.map((item) => item.text)).toEqual(["A的原话", "B的新话"]);
      expect(brains[1]?.speechGen).toBe(pendingGen);
      expect(speechOf()?.speechPending).toBe(false);

      pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: sid, phase: "start" }));
      pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: sid, phase: "end" }));
      await settle();
      const turnEmpty = newId("ses");
      const empty = {
        t: "asr.final",
        sessionId: sid,
        turnId: turnEmpty,
        text: "",
        captureMode: "hands_free",
        recognitionOutcome: "ok"
      };
      pipeline.ws.send(JSON.stringify(empty));
      await settle();
      expect(brains.map((item) => item.text)).toEqual(["A的原话", "B的新话"]);
      consolePeer.ws.send(
        JSON.stringify({ t: "barge_in", sessionId: sid, atMs: 2, truncatedSentenceId: `s-${newId("ses")}-2` })
      );
      pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: sid, phase: "start" }));
      pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: sid, phase: "end" }));
      await settle();
      expect(speechOf()?.speechPending).toBe(true);
      const emptyPending = speechOf()?.pendingSpeechGen;
      pipeline.ws.send(JSON.stringify(empty));
      await settle();
      expect(speechOf()?.speechPending).toBe(true);
      expect(speechOf()?.pendingSpeechGen).toBe(emptyPending);
      expect(brains.map((item) => item.text)).toEqual(["A的原话", "B的新话"]);
      pipeline.ws.close();
      consolePeer.ws.close();
    } finally {
      fx.close();
    }
  });

  it("legacy 成功 final 换 epoch 后重放不确认新轮", async () => {
    const brains: string[] = [];
    installEvents({
      onAsrFinal: (msg) => {
        if (msg.t === "asr.final") brains.push(msg.text);
      }
    });
    const pipeline = await connect("pipeline");
    const { ws } = await connect("console");
    pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: SES, phase: "start" }));
    pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: SES, phase: "end" }));
    await settle();
    const turnA = newId("ses");
    pipeline.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: SES,
        turnId: turnA,
        text: "旧世代A",
        captureMode: "hands_free",
        recognitionOutcome: "ok"
      })
    );
    await settle();
    expect(brains).toEqual(["旧世代A"]);
    pipeline.ws.close();
    await once(pipeline.ws, "close");
    const next = await connect("pipeline");
    next.ws.send(JSON.stringify({ t: "vad.speech", sessionId: SES, phase: "start" }));
    next.ws.send(JSON.stringify({ t: "vad.speech", sessionId: SES, phase: "end" }));
    await settle();
    next.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: SES,
        turnId: turnA,
        text: "旧世代A",
        captureMode: "hands_free",
        recognitionOutcome: "ok"
      })
    );
    await settle();
    expect(brains).toEqual(["旧世代A"]);
    expect(
      hub.barrier.ledgerEntries(SES).filter((item) => item.epoch === 2 && item.kind === "hands_free").map((item) => item.state)
    ).toEqual(["unconfirmed"]);
    next.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: SES,
        turnId: newId("ses"),
        text: "新世代B",
        captureMode: "hands_free",
        recognitionOutcome: "ok"
      })
    );
    await settle();
    expect(brains).toEqual(["旧世代A", "新世代B"]);
    next.ws.close();
    ws.close();
  });

  it("legacy failed 重放仍不吃下一条", async () => {
    const brains: string[] = [];
    installEvents({
      onAsrFinal: (msg) => {
        if (msg.t === "asr.final") brains.push(msg.text);
      }
    });
    const pipeline = await connect("pipeline");
    pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: SES, phase: "start" }));
    pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: SES, phase: "end" }));
    pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: SES, phase: "start" }));
    pipeline.ws.send(JSON.stringify({ t: "vad.speech", sessionId: SES, phase: "end" }));
    await settle();
    const failed = {
      t: "asr.final",
      sessionId: SES,
      turnId: newId("ses"),
      text: "",
      captureMode: "hands_free",
      recognitionOutcome: "failed"
    };
    pipeline.ws.send(JSON.stringify(failed));
    pipeline.ws.send(JSON.stringify(failed));
    await settle();
    expect(brains).toEqual([]);
    expect(
      hub.barrier.ledgerEntries(SES).filter((item) => item.kind === "hands_free" && item.hfRoundId === undefined).map((item) => item.state)
    ).toEqual(["unknown", "unconfirmed"]);
    pipeline.ws.close();
  });

  it("PTT 在途切 HF 再切回后,成功进 Brain 且世代不变;空失败取消断连不洗白", async () => {
    const brains: Array<{ text: string; speechGen?: number }> = [];
    const settled: Array<number | undefined> = [];
    installEvents({
      onAsrFinal: (msg, speechGen) => {
        if (msg.t === "asr.final") brains.push(speechGen === undefined ? { text: msg.text } : { text: msg.text, speechGen });
      },
      onSpeechSettled: (info) => {
        settled.push(info.speechGen);
      }
    });
    const pipeline = await connect("pipeline");
    const { ws } = await connect("console");
    const seen: string[] = [];
    ws.on("message", (d, isBinary) => {
      if (isBinary) return;
      try {
        const msg = JSON.parse(String(d)) as { t?: string; text?: string; captureId?: string };
        if (msg.t === "asr.final") seen.push(`${msg.captureId ?? ""}:${msg.text ?? ""}`);
      } catch {
        // 非 JSON
      }
    });
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt" }));
    const cap = newId("evt");
    ws.send(
      JSON.stringify({ t: "turn.done_speaking", sessionId: SES, captureId: cap, captureIntent: "send" })
    );
    await settle();
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "hands_free" }));
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt" }));
    await settle();
    const success = {
      t: "asr.final",
      sessionId: SES,
      turnId: newId("ses"),
      text: "已发出的原文",
      captureMode: "ptt",
      captureId: cap,
      recognitionOutcome: "ok"
    };
    pipeline.ws.send(JSON.stringify(success));
    await settle();
    expect(brains).toEqual([{ text: "已发出的原文", speechGen: 0 }]);
    expect(seen).toContain(`${cap}:已发出的原文`);
    pipeline.ws.send(JSON.stringify(success));
    await settle();
    expect(brains).toEqual([{ text: "已发出的原文", speechGen: 0 }]);
    expect(hub.barrier.ledgerEntries(SES).find((item) => item.captureId === cap)?.state).toBe("confirmed");

    const capEmpty = newId("evt");
    ws.send(JSON.stringify({ t: "turn.done_speaking", sessionId: SES, captureId: capEmpty, captureIntent: "send" }));
    await settle();
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "hands_free" }));
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt" }));
    pipeline.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: SES,
        turnId: newId("ses"),
        text: "",
        captureMode: "ptt",
        captureId: capEmpty,
        recognitionOutcome: "ok"
      })
    );
    await settle();
    expect(brains.map((item) => item.text)).toEqual(["已发出的原文"]);
    expect(hub.barrier.ledgerEntries(SES).find((item) => item.captureId === capEmpty)?.state).toBe("confirmed");

    const capFail = newId("evt");
    ws.send(JSON.stringify({ t: "turn.done_speaking", sessionId: SES, captureId: capFail, captureIntent: "send" }));
    await settle();
    pipeline.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: SES,
        turnId: newId("ses"),
        text: "",
        captureMode: "ptt",
        captureId: capFail,
        recognitionOutcome: "failed"
      })
    );
    await settle();
    expect(brains.map((item) => item.text)).toEqual(["已发出的原文"]);
    expect(hub.barrier.ledgerEntries(SES).find((item) => item.captureId === capFail)?.state).toBe("unknown");
    expect(seen.some((item) => item.startsWith(`${capFail}:`))).toBe(true);

    const capCancel = newId("evt");
    ws.send(
      JSON.stringify({
        t: "turn.done_speaking",
        sessionId: SES,
        captureId: capCancel,
        captureIntent: "cancel",
        holdForConfirm: true
      })
    );
    await settle();
    pipeline.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: SES,
        turnId: newId("ses"),
        text: "取消原文不得进 Brain",
        captureMode: "ptt",
        captureId: capCancel,
        recognitionOutcome: "ok"
      })
    );
    await settle();
    expect(brains.map((item) => item.text)).toEqual(["已发出的原文"]);
    expect(seen.some((item) => item.includes("取消原文"))).toBe(false);

    const capRearm = newId("evt");
    ws.send(JSON.stringify({ t: "turn.done_speaking", sessionId: SES, captureId: capRearm, captureIntent: "send" }));
    await settle();
    ws.send(
      JSON.stringify({
        t: "voice.mode",
        sessionId: SES,
        mode: "ptt",
        quiesceRequestId: newId("evt")
      })
    );
    await settle();
    pipeline.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: SES,
        turnId: newId("ses"),
        text: "rearm 后仍是这条",
        captureMode: "ptt",
        captureId: capRearm,
        recognitionOutcome: "ok"
      })
    );
    await settle();
    expect(brains.map((item) => item.text)).toEqual(["已发出的原文", "rearm 后仍是这条"]);
    expect(brains[1]?.speechGen).toBe(0);

    const capDrop = newId("evt");
    ws.send(JSON.stringify({ t: "turn.done_speaking", sessionId: SES, captureId: capDrop, captureIntent: "send" }));
    await settle();
    pipeline.ws.close();
    await once(pipeline.ws, "close");
    await settle();
    expect(hub.barrier.ledgerEntries(SES).find((item) => item.captureId === capDrop)?.state).toBe("unknown");
    expect(brains.map((item) => item.text)).toEqual(["已发出的原文", "rearm 后仍是这条"]);
    const revived = await connect("pipeline");
    revived.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: SES,
        turnId: newId("ses"),
        text: "断连后不得补成功",
        captureMode: "ptt",
        captureId: capDrop,
        recognitionOutcome: "ok"
      })
    );
    await settle();
    expect(brains.map((item) => item.text)).toEqual(["已发出的原文", "rearm 后仍是这条"]);
    expect(hub.barrier.ledgerEntries(SES).find((item) => item.captureId === capDrop)?.state).toBe("unknown");
    expect(settled.length).toBeGreaterThan(0);
    revived.ws.close();
    ws.close();
  });
});

const dialogs = new Map<string, LiveDialog>();

function dialogFor(fx: FocusFixture): LiveDialog {
  const existing = dialogs.get(fx.sessionId);
  if (existing) return existing;
  const audit: AuditSink = { record: () => ({ id: "aud" }) };
  const provider: LlmProvider = {
    kind: "api",
    model: "legacy-replay",
    async chat() {
      return {
        ok: true,
        text: "收到。",
        requestedModel: "legacy-replay",
        observedModel: "legacy-replay",
        observedModelSource: "stream",
        observedModelExempted: false,
        usage: { promptTokens: 1, completionTokens: 1 }
      };
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
    say: () => true,
    log: silentLog,
    confirm: new ConfirmationLoop({}, fx.db, audit)
  });
  live.ensureSession(fx.sessionId);
  dialogs.set(fx.sessionId, dialog);
  return dialog;
}

function speechState(dialog: LiveDialog, sessionId: string): () => { speechPending: boolean; pendingSpeechGen?: number } | undefined {
  return () => {
    const map = (dialog as unknown as {
      controlBySession: Map<string, { speechPending: boolean; pendingSpeechGen?: number }>;
    }).controlBySession;
    return map.get(sessionId);
  };
}

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
      buildId: "hf-terminal-lifecycle",
      protocolVersion: "1.0.0"
    }),
    getSourceFocusId: () => FOC,
    audit: () => {}
  };
}

describe("quiesce 超时与 epoch 边界", () => {
  it("超时把本 epoch 未终态 HF 标 unknown 并放开同 sid 新轮,不改另一 epoch", () => {
    vi.useFakeTimers();
    try {
      const barrier = new VoiceBarrier(mockSink(), newId("evt"));
      const peer = newId("evt");
      const sessionId = newId("ses");
      const epoch1 = newId("evt");
      const seg1 = newId("evt");
      barrier.setPipelineEpoch(1);
      barrier.noteVadSpeech(sessionId, "start", { hfSegmentId: seg1, hfRoundId: epoch1, recordSeq: 1 });
      barrier.noteVadSpeech(sessionId, "end", { hfSegmentId: seg1, hfRoundId: epoch1, recordSeq: 1 });
      barrier.setPipelineEpoch(2);
      const epoch2 = newId("evt");
      const seg2 = newId("evt");
      barrier.noteVadSpeech(sessionId, "start", { hfSegmentId: seg2, hfRoundId: epoch2, recordSeq: 1 });
      barrier.noteVadSpeech(sessionId, "end", { hfSegmentId: seg2, hfRoundId: epoch2, recordSeq: 1 });
      const requestId = newId("evt");
      barrier.handlePrepare(
        {
          t: "voice.anchor_prepare",
          sessionId,
          requestId,
          focusId: FOC,
          daemonEpoch: barrier.daemonEpoch
        },
        peer
      );
      vi.advanceTimersByTime(VOICE_QUIESCE_TIMEOUT_MS);
      expect(barrier.recordFor(sessionId, requestId)?.state).toBe("failed");
      expect(barrier.ledgerEntries(sessionId).find((item) => item.epoch === 1)?.state).toBe("unconfirmed");
      expect(barrier.ledgerEntries(sessionId).find((item) => item.hfRoundId === epoch2)?.state).toBe("unknown");
      const nextRound = newId("evt");
      const nextSeg = newId("evt");
      barrier.noteVadSpeech(sessionId, "start", { hfSegmentId: nextSeg, hfRoundId: nextRound, recordSeq: 2 });
      expect(barrier.ledgerEntries(sessionId).some((item) => item.hfRoundId === nextRound)).toBe(true);
      expect(barrier.ledgerEntries(sessionId).find((item) => item.epoch === 1)?.state).toBe("unconfirmed");
      const blocked = newId("evt");
      barrier.setPipelineEpoch(1);
      barrier.noteVadSpeech(sessionId, "start", { hfSegmentId: newId("evt"), hfRoundId: blocked, recordSeq: 2 });
      expect(barrier.ledgerEntries(sessionId).some((item) => item.hfRoundId === blocked)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
