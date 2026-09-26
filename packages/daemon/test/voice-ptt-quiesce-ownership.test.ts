// PTT 在途切档后再锚定:daemon 只按真实到达顺序记账。
// final 先于成功 ACK 才保留转写;提前 ACK 仍拒绝并丢弃。不走纯函数替身。

import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import { newId, VOICE_QUIESCE_TIMEOUT_MS } from "@saydo/contracts";
import { VoiceHub, VOICE_WS_PROTOCOL_VERSION } from "../src/voice/hub.js";
import { VoiceBarrier, type VoiceBarrierSink } from "../src/voice/voiceBarrier.js";
import type { Logger } from "../src/obs/logger.js";

const silentLog: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => silentLog
};

const SES = newId("ses");
const OLD_FOCUS = newId("foc");
const NEW_FOCUS = newId("foc");
const RUNTIME_IDENTITY = {
  sourceRevision: "1234567890abcdef1234567890abcdef12345678",
  buildId: "ptt-quiesce-ownership",
  protocolVersion: "1.0.0"
};

type HelloAck = { t: string; daemonEpoch: string };

let server: Server;
let hub: VoiceHub;
let port: number;

function installEvents(extra: Parameters<VoiceHub["setEvents"]>[0] = {}): void {
  hub.setEvents({
    verifyUpgrade: () => ({ ok: true, via: "local" }),
    onSourceFocusId: () => OLD_FOCUS,
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

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 30));
}

function absent(
  ws: WebSocket,
  predicate: (m: Record<string, unknown>) => boolean
): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      ws.off("message", handler);
      resolve(null);
    }, 80);
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

async function roundTripMode(pipeline: WebSocket, consoleWs: WebSocket): Promise<void> {
  const toHf = nextJson(pipeline, (m) => m["t"] === "voice.mode" && m["mode"] === "hands_free", "切到 HF");
  consoleWs.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "hands_free" }));
  await toHf;
  const toPtt = nextJson(pipeline, (m) => m["t"] === "voice.mode" && m["mode"] === "ptt", "切回 PTT");
  consoleWs.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt" }));
  await toPtt;
}

async function registerPtt(pipeline: WebSocket, consoleWs: WebSocket, captureId: string): Promise<void> {
  const forwarded = nextJson(
    pipeline,
    (m) => m["t"] === "turn.done_speaking" && m["captureId"] === captureId,
    "done_speaking"
  );
  consoleWs.send(
    JSON.stringify({ t: "turn.done_speaking", sessionId: SES, captureId, captureIntent: "send" })
  );
  await forwarded;
}

function pttFinal(captureId: string, text: string, outcome: "ok" | "failed"): Record<string, unknown> {
  return {
    t: "asr.final",
    sessionId: SES,
    turnId: newId("ses"),
    text,
    captureMode: "ptt",
    captureId,
    recognitionOutcome: outcome
  };
}

describe("Hub 接收切档后的 PTT 排空", () => {
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

  it("final 先于 ACK 时保留转写、不进 Brain,写锚后 rearm", async () => {
    const brains: string[] = [];
    const settled: Array<number | undefined> = [];
    installEvents({
      onAsrFinal: (msg) => {
        if (msg.t === "asr.final") brains.push(msg.text);
      },
      onSpeechSettled: (info) => {
        settled.push(info.speechGen);
      }
    });
    const pipeline = await connect("pipeline");
    const { ws, ack } = await connect("console");
    const cap = newId("evt");
    const requestId = newId("evt");
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt" }));
    await registerPtt(pipeline.ws, ws, cap);
    await roundTripMode(pipeline.ws, ws);
    const quiesce = nextJson(pipeline.ws, (m) => m["t"] === "voice.quiesce" && m["requestId"] === requestId, "quiesce");
    ws.send(
      JSON.stringify({
        t: "voice.anchor_prepare",
        sessionId: SES,
        requestId,
        focusId: NEW_FOCUS,
        daemonEpoch: ack.daemonEpoch
      })
    );
    const q = await quiesce;
    expect(q["epoch"]).toBe(1);
    expect(hub.barrier.captureGateClosed).toBe(true);
    expect(hub.barrier.registryEntries(SES).find((row) => row.captureId === cap)?.consumed).toBe(false);

    const transcript = nextJson(ws, (m) => m["t"] === "voice.quiesced_transcript", "保留转写");
    const prepared = nextJson(ws, (m) => m["status"] === "prepared" && m["requestId"] === requestId, "prepared");
    pipeline.ws.send(JSON.stringify(pttFinal(cap, "PTT old text", "ok")));
    pipeline.ws.send(
      JSON.stringify({
        t: "voice.quiesced",
        sessionId: SES,
        requestId,
        epoch: 1,
        classified: true
      })
    );
    const saved = await transcript;
    const status = await prepared;
    expect(saved).toMatchObject({
      text: "PTT old text",
      captureMode: "ptt",
      captureId: cap,
      captureIntent: "send",
      sourceFocusId: OLD_FOCUS,
      requestId
    });
    expect(saved["sourceFocusId"]).not.toBe(NEW_FOCUS);
    expect(status).toMatchObject({ status: "prepared", requestId });
    expect(status["emptyRound"]).toBeUndefined();
    expect(brains).toEqual([]);
    expect(settled).toEqual([0]);
    expect(hub.barrier.ledgerEntries(SES).find((item) => item.captureId === cap)?.state).toBe("confirmed");
    expect(hub.barrier.registryEntries(SES).find((row) => row.captureId === cap)).toMatchObject({
      consumed: true,
      discarded: false
    });

    pipeline.ws.send(
      JSON.stringify({
        t: "voice.quiesced",
        sessionId: SES,
        requestId,
        epoch: 1,
        classified: true
      })
    );
    const dup = await absent(ws, (m) => m["t"] === "voice.quiesced_transcript" && m["text"] === "PTT old text");
    expect(dup).toBeNull();
    expect(hub.barrier.recordFor(SES, requestId)?.state).toBe("prepared");

    const http = hub.barrier.applyHttp({
      sessionId: SES,
      body: { focusId: NEW_FOCUS, requestId },
      write: () => ({ already: false })
    });
    expect(http.status).toBe(200);
    expect(http.payload).toMatchObject({ ok: true, focusId: NEW_FOCUS, voiceBoundaryId: requestId });
    const rearmed = nextJson(ws, (m) => m["status"] === "rearmed" && m["requestId"] === requestId, "rearm");
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt", quiesceRequestId: requestId }));
    expect(await rearmed).toMatchObject({ status: "rearmed" });
    expect(hub.barrier.captureGateClosed).toBe(false);

    const cap2 = newId("evt");
    await registerPtt(pipeline.ws, ws, cap2);
    const broadcast = nextJson(ws, (m) => m["t"] === "asr.final" && m["captureId"] === cap2, "新轮广播");
    pipeline.ws.send(JSON.stringify(pttFinal(cap2, "rearm 后进 Brain", "ok")));
    await broadcast;
    expect(brains).toEqual(["rearm 后进 Brain"]);
    expect(hub.barrier.ledgerEntries(SES).find((item) => item.captureId === cap2)?.state).toBe("confirmed");
    pipeline.ws.close();
    ws.close();
  });

  it("提前 ACK 仍拒绝锚定并丢弃迟到转写", async () => {
    const brains: string[] = [];
    installEvents({
      onAsrFinal: (msg) => {
        if (msg.t === "asr.final") brains.push(msg.text);
      }
    });
    const pipeline = await connect("pipeline");
    const { ws, ack } = await connect("console");
    const cap = newId("evt");
    const requestId = newId("evt");
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt" }));
    await registerPtt(pipeline.ws, ws, cap);
    await roundTripMode(pipeline.ws, ws);
    const quiesce = nextJson(pipeline.ws, (m) => m["t"] === "voice.quiesce", "quiesce");
    const rejected = nextJson(ws, (m) => m["requestId"] === requestId, "拒绝");
    ws.send(
      JSON.stringify({
        t: "voice.anchor_prepare",
        sessionId: SES,
        requestId,
        focusId: NEW_FOCUS,
        daemonEpoch: ack.daemonEpoch
      })
    );
    await quiesce;
    pipeline.ws.send(
      JSON.stringify({
        t: "voice.quiesced",
        sessionId: SES,
        requestId,
        epoch: 1,
        classified: true,
        emptyRound: "unusable"
      })
    );
    expect(await rejected).toMatchObject({ status: "rejected", code: "voice_quiesce_unsupported" });
    expect(hub.barrier.registryEntries(SES).find((row) => row.captureId === cap)).toMatchObject({
      consumed: true,
      discarded: true
    });
    pipeline.ws.send(JSON.stringify(pttFinal(cap, "PTT old text", "ok")));
    const leaked = absent(ws, (m) => m["t"] === "voice.quiesced_transcript");
    expect(await leaked).toBeNull();
    expect(brains).toEqual([]);
    expect(hub.barrier.ledgerEntries(SES).find((item) => item.captureId === cap)?.state).not.toBe("confirmed");
    expect(hub.barrier.recordFor(SES, requestId)?.state).toBe("failed");
    pipeline.ws.close();
    ws.close();
  });

  it("空成功不移交、失败不进 Brain,账本按终态分开", async () => {
    const brains: string[] = [];
    installEvents({
      onAsrFinal: (msg) => {
        if (msg.t === "asr.final") brains.push(msg.text);
      }
    });
    const pipeline = await connect("pipeline");
    const { ws, ack } = await connect("console");
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt" }));

    const capEmpty = newId("evt");
    const emptyId = newId("evt");
    await registerPtt(pipeline.ws, ws, capEmpty);
    await roundTripMode(pipeline.ws, ws);
    const emptyQuiesce = nextJson(pipeline.ws, (m) => m["requestId"] === emptyId, "空轮 quiesce");
    const emptyPrepared = nextJson(ws, (m) => m["requestId"] === emptyId && m["status"] === "prepared", "空轮 prepared");
    const emptyLeak = absent(ws, (m) => m["t"] === "voice.quiesced_transcript");
    ws.send(
      JSON.stringify({
        t: "voice.anchor_prepare",
        sessionId: SES,
        requestId: emptyId,
        focusId: NEW_FOCUS,
        daemonEpoch: ack.daemonEpoch
      })
    );
    await emptyQuiesce;
    pipeline.ws.send(JSON.stringify(pttFinal(capEmpty, "", "ok")));
    pipeline.ws.send(
      JSON.stringify({ t: "voice.quiesced", sessionId: SES, requestId: emptyId, epoch: 1, classified: true })
    );
    const emptyStatus = await emptyPrepared;
    expect(emptyStatus["emptyRound"]).toBeUndefined();
    expect(await emptyLeak).toBeNull();
    expect(hub.barrier.ledgerEntries(SES).find((item) => item.captureId === capEmpty)?.state).toBe("confirmed");
    expect(brains).toEqual([]);

    const http = hub.barrier.applyHttp({
      sessionId: SES,
      body: { focusId: NEW_FOCUS, requestId: emptyId },
      write: () => ({ already: false })
    });
    expect(http.status).toBe(200);
    const rearmed = nextJson(ws, (m) => m["status"] === "rearmed", "空轮 rearm");
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt", quiesceRequestId: emptyId }));
    await rearmed;

    const capFail = newId("evt");
    const failId = newId("evt");
    await registerPtt(pipeline.ws, ws, capFail);
    const failQuiesce = nextJson(pipeline.ws, (m) => m["requestId"] === failId, "失败 quiesce");
    const failStatus = nextJson(ws, (m) => m["requestId"] === failId, "失败状态");
    ws.send(
      JSON.stringify({
        t: "voice.anchor_prepare",
        sessionId: SES,
        requestId: failId,
        focusId: NEW_FOCUS,
        daemonEpoch: ack.daemonEpoch
      })
    );
    await failQuiesce;
    pipeline.ws.send(JSON.stringify(pttFinal(capFail, "", "failed")));
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
    expect(await failStatus).toMatchObject({ status: "rejected", code: "voice_recognition_failed" });
    expect(hub.barrier.ledgerEntries(SES).find((item) => item.captureId === capFail)?.state).toBe("unknown");
    expect(hub.barrier.registryEntries(SES).find((row) => row.captureId === capFail)).toMatchObject({
      consumed: true,
      discarded: false
    });
    expect(brains).toEqual([]);
    pipeline.ws.close();
    ws.close();
  });

  it("旧 epoch 与别的 sid 不消费本轮;退役 HF 的 unknown 仍要 discard", async () => {
    const brains: string[] = [];
    installEvents({
      onAsrFinal: (msg) => {
        if (msg.t === "asr.final") brains.push(msg.text);
      }
    });
    const pipeline = await connect("pipeline");
    const { ws, ack } = await connect("console");
    const cap = newId("evt");
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt" }));
    await registerPtt(pipeline.ws, ws, cap);
    const other = newId("ses");
    pipeline.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: other,
        turnId: newId("ses"),
        text: "别的会话",
        captureMode: "ptt",
        captureId: cap,
        recognitionOutcome: "ok"
      })
    );
    await settle();
    const stillPending = nextJson(pipeline.ws, (m) => m["t"] === "voice.mode" && m["mode"] === "hands_free", "切档确认未消费");
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "hands_free" }));
    await stillPending;
    expect(hub.barrier.registryEntries(SES).find((row) => row.captureId === cap)?.consumed).toBe(false);
    expect(brains).toEqual([]);

    pipeline.ws.close();
    await once(pipeline.ws, "close");
    await settle();
    expect(hub.barrier.ledgerEntries(SES).find((item) => item.captureId === cap)?.state).toBe("unknown");
    const revived = await connect("pipeline");
    revived.ws.send(JSON.stringify(pttFinal(cap, "旧 epoch 不得补成功", "ok")));
    await settle();
    expect(brains).toEqual([]);
    expect(hub.barrier.ledgerEntries(SES).find((item) => item.captureId === cap)?.state).toBe("unknown");
    const unknown = nextJson(ws, (m) => m["code"] === "voice_audio_unknown", "未知世代");
    const observeId = newId("evt");
    ws.send(
      JSON.stringify({
        t: "voice.anchor_prepare",
        sessionId: SES,
        requestId: observeId,
        focusId: NEW_FOCUS,
        daemonEpoch: ack.daemonEpoch
      })
    );
    await unknown;
    expect(brains).toEqual([]);
    expect(hub.barrier.ledgerEntries(SES).find((item) => item.captureId === cap)?.state).toBe("unknown");

    const discardId = newId("evt");
    const prepared = nextJson(ws, (m) => m["requestId"] === discardId && m["status"] === "prepared", "放弃后 prepared");
    ws.send(
      JSON.stringify({
        t: "voice.anchor_prepare",
        sessionId: SES,
        requestId: discardId,
        focusId: NEW_FOCUS,
        daemonEpoch: ack.daemonEpoch,
        discardUnknownEpochs: [1]
      })
    );
    expect(await prepared).toMatchObject({ status: "prepared" });
    expect(hub.barrier.registryEntries(SES).find((row) => row.captureId === cap)).toMatchObject({
      consumed: true,
      discarded: true
    });
    expect(hub.barrier.ledgerEntries(SES).find((item) => item.captureId === cap)?.state).toBe("discarded");
    expect(brains).toEqual([]);
    revived.ws.close();
    ws.close();
  });

  it("退役 HF 保持 unknown;未 discard 不收 PTT,discard 后迟到 final 不进 Brain", async () => {
    const brains: string[] = [];
    installEvents({
      onAsrFinal: (msg) => {
        if (msg.t === "asr.final") brains.push(msg.text);
      }
    });
    const pipeline = await connect("pipeline");
    const { ws, ack } = await connect("console");
    const toHf = nextJson(pipeline.ws, (m) => m["mode"] === "hands_free", "进入 HF");
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "hands_free" }));
    await toHf;
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
    expect(hub.barrier.ledgerEntries(SES).find((item) => item.hfRoundId === round)?.state).toBe("unconfirmed");
    const cap = newId("evt");
    await registerPtt(pipeline.ws, ws, cap);
    const retired = nextJson(pipeline.ws, (m) => m["mode"] === "ptt", "切回 PTT 退役 HF");
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt" }));
    await retired;
    expect(hub.barrier.ledgerEntries(SES).find((item) => item.hfRoundId === round)?.state).toBe("unknown");
    expect(hub.barrier.registryEntries(SES).find((row) => row.captureId === cap)?.consumed).toBe(false);

    const observeId = newId("evt");
    const unknown = nextJson(ws, (m) => m["code"] === "voice_audio_unknown" && m["requestId"] === observeId, "未知世代");
    ws.send(
      JSON.stringify({
        t: "voice.anchor_prepare",
        sessionId: SES,
        requestId: observeId,
        focusId: NEW_FOCUS,
        daemonEpoch: ack.daemonEpoch
      })
    );
    await unknown;
    expect(hub.barrier.recordFor(SES, observeId)).toBeUndefined();
    expect(hub.barrier.registryEntries(SES).find((row) => row.captureId === cap)?.consumed).toBe(false);
    expect(brains).toEqual([]);

    const discardId = newId("evt");
    const quiesce = nextJson(pipeline.ws, (m) => m["requestId"] === discardId, "discard quiesce");
    const prepared = nextJson(ws, (m) => m["requestId"] === discardId && m["status"] === "prepared", "discard prepared");
    ws.send(
      JSON.stringify({
        t: "voice.anchor_prepare",
        sessionId: SES,
        requestId: discardId,
        focusId: NEW_FOCUS,
        daemonEpoch: ack.daemonEpoch,
        discardUnknownEpochs: [1]
      })
    );
    await quiesce;
    expect(hub.barrier.ledgerEntries(SES).find((item) => item.hfRoundId === round)?.state).toBe("discarded");
    expect(hub.barrier.registryEntries(SES).find((row) => row.captureId === cap)).toMatchObject({
      consumed: true,
      discarded: true
    });
    pipeline.ws.send(JSON.stringify(pttFinal(cap, "放弃后不得保存", "ok")));
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
    expect(await prepared).toMatchObject({ status: "prepared" });
    const leaked = absent(ws, (m) => m["t"] === "voice.quiesced_transcript");
    expect(await leaked).toBeNull();
    expect(brains).toEqual([]);
    expect(hub.barrier.registryEntries(SES).find((row) => row.captureId === cap)).toMatchObject({
      consumed: true,
      discarded: true
    });
    pipeline.ws.close();
    ws.close();
  });
});

describe("quiesce 超时不把在途 PTT 收成成功", () => {
  it("120s 无 ACK 把 pending 标 discarded,迟到 final 不进 Brain", () => {
    vi.useFakeTimers();
    try {
      const sent: Array<Record<string, unknown>> = [];
      const sink: VoiceBarrierSink = {
        now: () => Date.now(),
        sendToPeer: (_peer, msg) => {
          sent.push(msg as Record<string, unknown>);
        },
        sendToLocalSession: (_sid, msg) => {
          sent.push(msg as Record<string, unknown>);
        },
        sendToPipeline: () => true,
        isPeerOpen: () => true,
        peerVia: () => "local",
        registerSession: () => {},
        closeCaptureGate: () => {},
        openCaptureGate: () => {},
        prewriteLastVoiceModePtt: () => {},
        hasPipelinePeer: () => true,
        currentPipelineIdentity: () => RUNTIME_IDENTITY,
        getSourceFocusId: () => OLD_FOCUS,
        audit: () => {}
      };
      const daemonEpoch = newId("evt");
      const barrier = new VoiceBarrier(sink, daemonEpoch);
      barrier.setPipelineEpoch(1);
      const sessionId = newId("ses");
      const captureId = newId("evt");
      const registered = barrier.registerDoneSpeaking({
        t: "turn.done_speaking",
        sessionId,
        captureId,
        captureIntent: "send"
      });
      expect(registered.forward?.captureId).toBe(captureId);
      const requestId = newId("evt");
      const peer = newId("evt");
      barrier.handlePrepare(
        {
          t: "voice.anchor_prepare",
          sessionId,
          requestId,
          focusId: NEW_FOCUS,
          daemonEpoch
        },
        peer
      );
      expect(barrier.recordFor(sessionId, requestId)?.state).toBe("preparing");
      vi.advanceTimersByTime(VOICE_QUIESCE_TIMEOUT_MS);
      expect(barrier.recordFor(sessionId, requestId)?.state).toBe("failed");
      expect(sent.some((msg) => msg["code"] === "voice_quiesce_timeout")).toBe(true);
      expect(barrier.registryEntries(sessionId).find((row) => row.captureId === captureId)).toMatchObject({
        consumed: true,
        discarded: true
      });
      expect(barrier.ledgerEntries(sessionId).find((item) => item.captureId === captureId)?.state).toBe("unknown");
      const decision = barrier.consumeAsrFinal({
        t: "asr.final",
        sessionId,
        turnId: newId("ses"),
        text: "超时后不得保存",
        captureMode: "ptt",
        captureId,
        recognitionOutcome: "ok"
      });
      expect(decision.brain).toBe(false);
      expect(barrier.ledgerEntries(sessionId).find((item) => item.captureId === captureId)?.state).toBe("unknown");
      expect(sent.some((msg) => msg["t"] === "voice.quiesced_transcript")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
