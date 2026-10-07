// 09 §10.1 处理链:经真实 VoiceHub WS 驱动 owner/capture/epoch/empty/无 pipeline/replay。

import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import Database from "better-sqlite3";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { newId } from "@saydo/contracts";
import { VoiceHub, VOICE_WS_PROTOCOL_VERSION } from "../src/voice/hub.js";
import type { Logger } from "../src/obs/logger.js";

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
  buildId: "pipeline-barrier",
  protocolVersion: "1.0.0"
};

let server: Server;
let hub: VoiceHub;
let port: number;

function installEvents(extra: Parameters<VoiceHub["setEvents"]>[0] = {}): void {
  hub.setEvents({
    verifyUpgrade: () => ({ ok: true, via: "local" }),
    ...extra
  });
}

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

type HelloAck = { t: string; v: number; peerId: string; daemonEpoch: string };

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
        // 非 JSON 不参与握手
      }
    };
    ws.on("message", onAck);
    ws.on("close", (code) => reject(new Error(`closed ${code}`)));
    ws.on("error", reject);
  });
}

function nextJson(ws: WebSocket, predicate: (m: Record<string, unknown>) => boolean): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off("message", handler);
      reject(new Error("nextJson timeout"));
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

function prepareMsg(daemonEpoch: string, requestId: string, extra: Record<string, unknown> = {}) {
  return {
    t: "voice.anchor_prepare",
    sessionId: SES,
    requestId,
    focusId: FOC,
    daemonEpoch,
    ...extra
  };
}

describe("hello.ack 与角色白名单", () => {
  it("hello.ack 带 peerId/daemonEpoch;pipeline 发 prepare 被丢弃", async () => {
    const pipeline = await connect("pipeline");
    const consolePeer = await connect("console");
    expect(consolePeer.ack.peerId.startsWith("evt_")).toBe(true);
    expect(consolePeer.ack.daemonEpoch.startsWith("evt_")).toBe(true);
    expect(pipeline.ack.daemonEpoch).toBe(consolePeer.ack.daemonEpoch);
    const leaked = nextJson(consolePeer.ws, (m) => m["t"] === "voice.anchor_status");
    pipeline.ws.send(JSON.stringify(prepareMsg(pipeline.ack.daemonEpoch, newId("evt"))));
    const raced = await Promise.race([
      leaked.then((m) => m),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 80))
    ]);
    expect(raced).toBeNull();
    pipeline.ws.close();
    consolePeer.ws.close();
  });
});

describe("无 pipeline 立即 prepared 与 request replay", () => {
  it("空账本无 pipeline 立即 prepared;同 ID 同摘要重放 prepared", async () => {
    const { ws, ack } = await connect("console");
    const requestId = newId("evt");
    const status = nextJson(ws, (m) => m["t"] === "voice.anchor_status" && m["requestId"] === requestId);
    ws.send(JSON.stringify(prepareMsg(ack.daemonEpoch, requestId)));
    const first = await status;
    expect(first).toMatchObject({ status: "prepared", sessionId: SES, requestId });
    expect(hub.barrier.recordFor(SES, requestId)?.state).toBe("prepared");

    const replay = nextJson(ws, (m) => m["t"] === "voice.anchor_status" && m["status"] === "prepared");
    ws.send(JSON.stringify(prepareMsg(ack.daemonEpoch, requestId)));
    const second = await replay;
    expect(second["requestId"]).toBe(requestId);
    ws.close();
  });

  it("无 pipeline 且仍有未确认音频时拒绝,不关门、不建失败记录", async () => {
    const pipeline = await connect("pipeline");
    const { ws, ack } = await connect("console");
    const captureId = newId("evt");
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt" }));
    ws.send(
      JSON.stringify({
        t: "turn.done_speaking",
        sessionId: SES,
        captureId,
        captureIntent: "edit",
        holdForConfirm: true
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    pipeline.ws.close();
    await once(pipeline.ws, "close");
    await new Promise((resolve) => setTimeout(resolve, 20));

    const requestId = newId("evt");
    const status = nextJson(ws, (m) => m["t"] === "voice.anchor_status");
    ws.send(JSON.stringify(prepareMsg(ack.daemonEpoch, requestId)));
    const rejected = await status;
    expect(rejected).toMatchObject({
      status: "rejected",
      code: "voice_audio_unknown",
      retryable: true
    });
    expect(rejected["unknownEpochs"]).toEqual([1]);
    expect(hub.barrier.recordFor(SES, requestId)).toBeUndefined();
    expect(hub.barrier.captureGateClosed).toBe(false);
    ws.close();
  });
});

describe("CaptureRegistry 与 HF/PTT/cancel", () => {
  it("HF final 不消费 PTT FIFO;成功 ACK 时仍 pending 则 unsupported", async () => {
    const pipeline = await connect("pipeline");
    const { ws, ack } = await connect("console");
    const captureId = newId("evt");
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt" }));
    ws.send(
      JSON.stringify({
        t: "turn.done_speaking",
        sessionId: SES,
        captureId,
        captureIntent: "send"
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    pipeline.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: SES,
        turnId: newId("ses"),
        text: "免手旧稿",
        captureMode: "hands_free",
        recognitionOutcome: "ok"
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    const pending = hub.barrier.registryEntries(SES).find((row) => row.captureId === captureId);
    expect(pending?.consumed).toBe(false);

    const requestId = newId("evt");
    const quiesce = nextJson(pipeline.ws, (m) => m["t"] === "voice.quiesce");
    const status = nextJson(ws, (m) => m["t"] === "voice.anchor_status");
    ws.send(JSON.stringify(prepareMsg(ack.daemonEpoch, requestId)));
    const q = await quiesce;
    expect(q["epoch"]).toBe(1);
    pipeline.ws.send(
      JSON.stringify({
        t: "voice.quiesced",
        sessionId: SES,
        requestId,
        epoch: 1,
        classified: true
      })
    );
    const failed = await status;
    expect(failed).toMatchObject({ status: "rejected", code: "voice_quiesce_unsupported" });
    expect(hub.barrier.registryEntries(SES).find((row) => row.captureId === captureId)).toMatchObject({
      consumed: true,
      discarded: true
    });
    pipeline.ws.close();
    ws.close();
  });

  it("cancel 匹配 final 不进 Brain、不广播原文", async () => {
    const pipeline = await connect("pipeline");
    const { ws } = await connect("console");
    const captureId = newId("evt");
    const brain: string[] = [];
    installEvents({
      onAsrFinal: (msg) => {
        if (msg.t === "asr.final") brain.push(msg.text);
      }
    });
    const leaked = nextJson(ws, (m) => m["t"] === "asr.final");
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt" }));
    ws.send(
      JSON.stringify({
        t: "turn.done_speaking",
        sessionId: SES,
        captureId,
        captureIntent: "cancel",
        holdForConfirm: true
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    pipeline.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: SES,
        turnId: newId("ses"),
        text: "不该留下的取消稿",
        captureMode: "ptt",
        captureId,
        recognitionOutcome: "ok"
      })
    );
    const raced = await Promise.race([
      leaked.then((m) => m),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 80))
    ]);
    expect(raced).toBeNull();
    expect(brain).toEqual([]);
    const entry = hub.barrier.registryEntries(SES).find((row) => row.captureId === captureId);
    expect(entry).toMatchObject({ consumed: true, discarded: false });
    pipeline.ws.close();
    ws.close();
  });

  it("显式 discard 后 pending registry 变 tombstone,迟到 final 不进 Brain", async () => {
    const pipeline = await connect("pipeline");
    const { ws, ack } = await connect("console");
    const captureId = newId("evt");
    const brain: string[] = [];
    installEvents({
      onAsrFinal: (msg) => {
        if (msg.t === "asr.final") brain.push(msg.text);
      }
    });
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt" }));
    ws.send(
      JSON.stringify({
        t: "turn.done_speaking",
        sessionId: SES,
        captureId,
        captureIntent: "edit",
        holdForConfirm: true
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    pipeline.ws.close();
    await once(pipeline.ws, "close");
    await new Promise((resolve) => setTimeout(resolve, 20));

    const observeId = newId("evt");
    const unknown = nextJson(ws, (m) => m["code"] === "voice_audio_unknown");
    ws.send(JSON.stringify(prepareMsg(ack.daemonEpoch, observeId)));
    await unknown;

    const discardId = newId("evt");
    const prepared = nextJson(ws, (m) => m["status"] === "prepared");
    ws.send(JSON.stringify(prepareMsg(ack.daemonEpoch, discardId, { discardUnknownEpochs: [1] })));
    await prepared;
    const tomb = hub.barrier.registryEntries(SES).find((row) => row.captureId === captureId);
    expect(tomb).toMatchObject({ consumed: true, discarded: true });

    const pipeline2 = await connect("pipeline");
    pipeline2.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: SES,
        turnId: newId("ses"),
        text: "迟到取消不该进",
        captureMode: "ptt",
        captureId,
        recognitionOutcome: "ok"
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(brain).toEqual([]);
    pipeline2.ws.close();
    ws.close();
  });
});

describe("busy / 未分类 / HTTP / rearm / 回执", () => {
  it("preparing 中第二条 prepare 为 busy;HF 缺 outcome 为 unclassified", async () => {
    const pipeline = await connect("pipeline");
    const { ws, ack } = await connect("console");
    const captureId = newId("evt");
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt" }));
    ws.send(
      JSON.stringify({
        t: "turn.done_speaking",
        sessionId: SES,
        captureId,
        captureIntent: "send"
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    const firstId = newId("evt");
    ws.send(JSON.stringify(prepareMsg(ack.daemonEpoch, firstId)));
    await nextJson(pipeline.ws, (m) => m["t"] === "voice.quiesce");
    const busyId = newId("evt");
    const busy = nextJson(ws, (m) => m["requestId"] === busyId);
    ws.send(JSON.stringify(prepareMsg(ack.daemonEpoch, busyId)));
    expect(await busy).toMatchObject({ status: "rejected", code: "voice_anchor_busy" });
    pipeline.ws.close();
    ws.close();
  });

  it("带 captureMode 缺 recognitionOutcome 的 final 挡住 prepare", async () => {
    const pipeline = await connect("pipeline");
    const { ws, ack } = await connect("console");
    pipeline.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: SES,
        turnId: newId("ses"),
        text: "缺字段",
        captureMode: "hands_free"
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    const requestId = newId("evt");
    const status = nextJson(ws, (m) => m["t"] === "voice.anchor_status");
    ws.send(JSON.stringify(prepareMsg(ack.daemonEpoch, requestId)));
    expect(await status).toMatchObject({ status: "rejected", code: "voice_unclassified_inflight" });
    expect(hub.barrier.recordFor(SES, requestId)).toBeUndefined();
    pipeline.ws.close();
    ws.close();
  });

  it("prepared 后 HTTP 写锚再 matching rearm;普通 mode 在关门期丢弃", async () => {
    const { ws, ack } = await connect("console");
    const requestId = newId("evt");
    const prepared = nextJson(ws, (m) => m["status"] === "prepared");
    ws.send(JSON.stringify(prepareMsg(ack.daemonEpoch, requestId)));
    await prepared;
    expect(hub.barrier.captureGateClosed).toBe(true);
    const http = hub.barrier.applyHttp({
      sessionId: SES,
      body: { focusId: FOC, requestId },
      write: () => ({ already: false })
    });
    expect(http.status).toBe(200);
    expect(http.payload).toMatchObject({
      ok: true,
      voiceBoundaryRequired: true,
      voiceBoundaryId: requestId
    });
    const rearmed = nextJson(ws, (m) => m["status"] === "rearmed");
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "hands_free" }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(hub.barrier.captureGateClosed).toBe(true);
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt", quiesceRequestId: requestId }));
    expect(await rearmed).toMatchObject({ status: "rearmed", requestId });
    expect(hub.barrier.captureGateClosed).toBe(false);
    ws.close();
  });

  it("turn.text accepted 仅在 completeTurnAccepted 之后;跨 epoch 为 unknown", async () => {
    const { ws, ack } = await connect("console");
    const turnOk = newId("ses");
    const turnBad = newId("ses");
    installEvents({
      onTurnText: (msg) => {
        hub.barrier.completeTurnAccepted(msg.sessionId, msg.turnId);
      }
    });
    const accepted = nextJson(ws, (m) => m["t"] === "turn.text.result" && m["turnId"] === turnOk);
    ws.send(
      JSON.stringify({
        t: "turn.text",
        sessionId: SES,
        turnId: turnOk,
        text: "真实接收",
        typed: true,
        receiptAction: "submit",
        daemonEpoch: ack.daemonEpoch
      })
    );
    expect(await accepted).toMatchObject({ outcome: "accepted" });

    const unknown = nextJson(ws, (m) => m["t"] === "turn.text.result" && m["turnId"] === turnBad);
    ws.send(
      JSON.stringify({
        t: "turn.text",
        sessionId: SES,
        turnId: turnBad,
        text: "旧世代",
        typed: true,
        receiptAction: "submit",
        daemonEpoch: newId("evt")
      })
    );
    expect(await unknown).toMatchObject({ outcome: "unknown" });
    ws.close();
  });
});

describe("console 断线与失败门", () => {
  it("console 断线不把 preparing 标 failed,门保持;同 requestId 新 socket 接管后仍可 prepared", async () => {
    const pipeline = await connect("pipeline");
    const first = await connect("console");
    const captureId = newId("evt");
    first.ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt" }));
    first.ws.send(
      JSON.stringify({
        t: "turn.done_speaking",
        sessionId: SES,
        captureId,
        captureIntent: "send"
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    const requestId = newId("evt");
    const quiesce = nextJson(pipeline.ws, (m) => m["t"] === "voice.quiesce");
    first.ws.send(JSON.stringify(prepareMsg(first.ack.daemonEpoch, requestId)));
    await quiesce;
    expect(hub.barrier.recordFor(SES, requestId)?.state).toBe("preparing");
    expect(hub.barrier.captureGateClosed).toBe(true);

    first.ws.close();
    await once(first.ws, "close");
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(hub.barrier.recordFor(SES, requestId)?.state).toBe("preparing");
    expect(hub.barrier.captureGateClosed).toBe(true);

    const second = await connect("console");
    const status = nextJson(second.ws, (m) => m["t"] === "voice.anchor_status" && m["requestId"] === requestId);
    second.ws.send(JSON.stringify(prepareMsg(second.ack.daemonEpoch, requestId)));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(hub.barrier.recordFor(SES, requestId)?.ownerPeerId).toBe(second.ack.peerId);
    pipeline.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: SES,
        turnId: newId("ses"),
        text: "排空旧轮",
        captureMode: "ptt",
        captureId,
        recognitionOutcome: "ok"
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    pipeline.ws.send(
      JSON.stringify({
        t: "voice.quiesced",
        sessionId: SES,
        requestId,
        epoch: 1,
        classified: true
      })
    );
    expect(await status).toMatchObject({ status: "prepared", sessionId: SES, requestId });
    expect(hub.barrier.captureGateClosed).toBe(true);
    pipeline.ws.close();
    second.ws.close();
  });

  it("失败 ACK 后门保持关,新 requestId 才能再观察", async () => {
    const pipeline = await connect("pipeline");
    const { ws, ack } = await connect("console");
    const captureId = newId("evt");
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt" }));
    ws.send(
      JSON.stringify({
        t: "turn.done_speaking",
        sessionId: SES,
        captureId,
        captureIntent: "send"
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    const deadId = newId("evt");
    const failed = nextJson(ws, (m) => m["requestId"] === deadId);
    ws.send(JSON.stringify(prepareMsg(ack.daemonEpoch, deadId)));
    await nextJson(pipeline.ws, (m) => m["t"] === "voice.quiesce");
    pipeline.ws.send(
      JSON.stringify({
        t: "voice.quiesced",
        sessionId: SES,
        requestId: deadId,
        epoch: 1,
        classified: false,
        code: "voice_recognition_failed"
      })
    );
    expect(await failed).toMatchObject({ status: "rejected", code: "voice_recognition_failed" });
    expect(hub.barrier.recordFor(SES, deadId)?.state).toBe("failed");
    expect(hub.barrier.captureGateClosed).toBe(true);

    const replay = nextJson(ws, (m) => m["requestId"] === deadId && m["code"] === "voice_request_dead");
    ws.send(JSON.stringify(prepareMsg(ack.daemonEpoch, deadId)));
    expect(await replay).toMatchObject({ status: "rejected", code: "voice_request_dead" });
    expect(hub.barrier.captureGateClosed).toBe(true);
    pipeline.ws.close();
    ws.close();
  });
});

describe("repair-13 生产边界反例", () => {
  it("failed 后迟到 HF final 不进 Brain,asrBrainGated 仍关", async () => {
    const pipeline = await connect("pipeline");
    const { ws, ack } = await connect("console");
    const brain: string[] = [];
    installEvents({
      onAsrFinal: (msg) => {
        if (msg.t === "asr.final") brain.push(msg.text);
      }
    });
    const captureId = newId("evt");
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt" }));
    ws.send(
      JSON.stringify({
        t: "turn.done_speaking",
        sessionId: SES,
        captureId,
        captureIntent: "send"
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    const deadId = newId("evt");
    const failed = nextJson(ws, (m) => m["requestId"] === deadId);
    ws.send(JSON.stringify(prepareMsg(ack.daemonEpoch, deadId)));
    await nextJson(pipeline.ws, (m) => m["t"] === "voice.quiesce");
    pipeline.ws.send(
      JSON.stringify({
        t: "voice.quiesced",
        sessionId: SES,
        requestId: deadId,
        epoch: 1,
        classified: false,
        code: "voice_recognition_failed"
      })
    );
    expect(await failed).toMatchObject({ status: "rejected", code: "voice_recognition_failed" });
    expect(hub.barrier.recordFor(SES, deadId)?.state).toBe("failed");
    expect(hub.barrier.asrBrainGated(SES)).toBe(true);
    expect(hub.barrier.captureGateClosed).toBe(true);

    pipeline.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: SES,
        turnId: newId("ses"),
        text: "失败后迟到不该进Brain",
        captureMode: "hands_free",
        recognitionOutcome: "ok"
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(brain).toEqual([]);
    expect(hub.barrier.asrBrainGated(SES)).toBe(true);
    pipeline.ws.close();
    ws.close();
  });

  it("discard 成功后同 ID 同 payload 重放仍 prepared,不是 invalid_input", async () => {
    const pipeline = await connect("pipeline");
    const { ws, ack } = await connect("console");
    const captureId = newId("evt");
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt" }));
    ws.send(
      JSON.stringify({
        t: "turn.done_speaking",
        sessionId: SES,
        captureId,
        captureIntent: "edit",
        holdForConfirm: true
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    pipeline.ws.close();
    await once(pipeline.ws, "close");
    await new Promise((resolve) => setTimeout(resolve, 20));

    const observeId = newId("evt");
    const unknown = nextJson(ws, (m) => m["code"] === "voice_audio_unknown");
    ws.send(JSON.stringify(prepareMsg(ack.daemonEpoch, observeId)));
    await unknown;

    const discardId = newId("evt");
    const first = nextJson(ws, (m) => m["requestId"] === discardId);
    ws.send(JSON.stringify(prepareMsg(ack.daemonEpoch, discardId, { discardUnknownEpochs: [1] })));
    expect(await first).toMatchObject({ status: "prepared", requestId: discardId });

    const replay = nextJson(ws, (m) => m["requestId"] === discardId && m["status"] === "prepared");
    ws.send(JSON.stringify(prepareMsg(ack.daemonEpoch, discardId, { discardUnknownEpochs: [1] })));
    expect(await replay).toMatchObject({ status: "prepared", requestId: discardId });
    expect(hub.barrier.recordFor(SES, discardId)?.state).toBe("prepared");
    ws.close();
  });

  it("关门后带 captureId 的 done_speaking 不进 registry", async () => {
    const { ws, ack } = await connect("console");
    const requestId = newId("evt");
    const prepared = nextJson(ws, (m) => m["status"] === "prepared");
    ws.send(JSON.stringify(prepareMsg(ack.daemonEpoch, requestId)));
    await prepared;
    expect(hub.barrier.captureGateClosed).toBe(true);
    expect(hub.barrier.asrBrainGated(SES)).toBe(true);

    const lateCap = newId("evt");
    ws.send(
      JSON.stringify({
        t: "turn.done_speaking",
        sessionId: SES,
        captureId: lateCap,
        captureIntent: "send"
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(hub.barrier.registryEntries(SES).find((row) => row.captureId === lateCap)).toBeUndefined();
    ws.close();
  });

  it("console 发畸形 quiesced / 未分类 asr.final 不改正在 preparing 的请求", async () => {
    const pipeline = await connect("pipeline");
    const { ws, ack } = await connect("console");
    const captureId = newId("evt");
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt" }));
    ws.send(
      JSON.stringify({
        t: "turn.done_speaking",
        sessionId: SES,
        captureId,
        captureIntent: "send"
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: SES,
        turnId: newId("ses"),
        text: "console伪造未分类",
        captureMode: "hands_free"
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 20));

    const requestId = newId("evt");
    const quiesce = nextJson(pipeline.ws, (m) => m["t"] === "voice.quiesce");
    const rejected = nextJson(ws, (m) => m["requestId"] === requestId && m["status"] === "rejected");
    ws.send(JSON.stringify(prepareMsg(ack.daemonEpoch, requestId)));
    const q = await Promise.race([
      quiesce.then((m) => ({ kind: "quiesce" as const, m })),
      rejected.then((m) => ({ kind: "rejected" as const, m }))
    ]);
    expect(q.kind).toBe("quiesce");
    expect(hub.barrier.recordFor(SES, requestId)?.state).toBe("preparing");
    rejected.catch(() => undefined);

    ws.send(
      JSON.stringify({
        t: "voice.quiesced",
        sessionId: SES,
        requestId
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(hub.barrier.recordFor(SES, requestId)?.state).toBe("preparing");
    pipeline.ws.close();
    ws.close();
  });

  it("过期 pipeline 的畸形 ACK 不 fail 正在 preparing 的请求", async () => {
    const pipeline = await connect("pipeline");
    const { ws, ack } = await connect("console");
    const captureId = newId("evt");
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt" }));
    ws.send(
      JSON.stringify({
        t: "turn.done_speaking",
        sessionId: SES,
        captureId,
        captureIntent: "send"
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    const requestId = newId("evt");
    const rejected = nextJson(ws, (m) => m["requestId"] === requestId && m["status"] === "rejected");
    ws.send(JSON.stringify(prepareMsg(ack.daemonEpoch, requestId)));
    await nextJson(pipeline.ws, (m) => m["t"] === "voice.quiesce");
    expect(hub.barrier.recordFor(SES, requestId)?.state).toBe("preparing");

    pipeline.ws.send(
      JSON.stringify({
        t: "pipeline.health",
        asr: "ok",
        tts: "ok",
        identity: {
          sourceRevision: "0".repeat(40),
          buildId: "stale-pipeline",
          protocolVersion: "1.0.0"
        },
        stateRootDigest: "0".repeat(64)
      })
    );
    pipeline.ws.send(
      JSON.stringify({
        t: "voice.quiesced",
        sessionId: SES,
        requestId
      })
    );
    const status = await rejected;
    expect(status["code"]).toBe("voice_quiesce_disconnected");
    expect(status["code"]).not.toBe("voice_quiesce_unsupported");
    pipeline.ws.close();
    ws.close();
  });

  it("retryable reject 后 receiptAction retry 重新走门,屏障解除后可 accepted", async () => {
    const { ws, ack } = await connect("console");
    const requestId = newId("evt");
    const prepared = nextJson(ws, (m) => m["status"] === "prepared");
    ws.send(JSON.stringify(prepareMsg(ack.daemonEpoch, requestId)));
    await prepared;
    expect(hub.barrier.asrBrainGated(SES)).toBe(true);

    const turnId = newId("ses");
    const first = nextJson(ws, (m) => m["t"] === "turn.text.result" && m["turnId"] === turnId);
    ws.send(
      JSON.stringify({
        t: "turn.text",
        sessionId: SES,
        turnId,
        text: "屏障中重试",
        typed: true,
        receiptAction: "submit",
        daemonEpoch: ack.daemonEpoch
      })
    );
    expect(await first).toMatchObject({
      outcome: "rejected",
      code: "voice_anchor_pending",
      retryable: true
    });

    const replaySubmit = nextJson(ws, (m) => m["t"] === "turn.text.result" && m["turnId"] === turnId);
    ws.send(
      JSON.stringify({
        t: "turn.text",
        sessionId: SES,
        turnId,
        text: "屏障中重试",
        typed: true,
        receiptAction: "submit",
        daemonEpoch: ack.daemonEpoch
      })
    );
    expect(await replaySubmit).toMatchObject({
      outcome: "rejected",
      code: "voice_anchor_pending",
      retryable: true
    });

    hub.barrier.applyHttp({
      sessionId: SES,
      body: { focusId: FOC, requestId },
      write: () => ({ already: false })
    });
    const rearmed = nextJson(ws, (m) => m["status"] === "rearmed");
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt", quiesceRequestId: requestId }));
    await rearmed;
    expect(hub.barrier.asrBrainGated(SES)).toBe(false);

    installEvents({
      onTurnText: (msg) => {
        hub.barrier.completeTurnAccepted(msg.sessionId, msg.turnId);
      }
    });
    const retried = nextJson(ws, (m) => m["t"] === "turn.text.result" && m["turnId"] === turnId);
    ws.send(
      JSON.stringify({
        t: "turn.text",
        sessionId: SES,
        turnId,
        text: "屏障中重试",
        typed: true,
        receiptAction: "retry",
        daemonEpoch: ack.daemonEpoch
      })
    );
    expect(await retried).toMatchObject({ outcome: "accepted" });
    ws.close();
  });
});

describe("repair-14 ASR 失败门顺序", () => {
  it("成功周期后新 prepare 失败挡住迟到 ASR;恢复后新音频可进、旧 capture 不可进", async () => {
    const pipeline = await connect("pipeline");
    const { ws, ack } = await connect("console");
    const brain: string[] = [];
    installEvents({
      onAsrFinal: (msg) => {
        if (msg.t === "asr.final") brain.push(msg.text);
      }
    });

    const firstId = newId("evt");
    const firstPrepared = nextJson(ws, (m) => m["requestId"] === firstId && m["status"] === "prepared");
    ws.send(JSON.stringify(prepareMsg(ack.daemonEpoch, firstId)));
    await firstPrepared;
    hub.barrier.applyHttp({
      sessionId: SES,
      body: { focusId: FOC, requestId: firstId },
      write: () => ({ already: false })
    });
    const firstRearmed = nextJson(ws, (m) => m["requestId"] === firstId && m["status"] === "rearmed");
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt", quiesceRequestId: firstId }));
    await firstRearmed;
    expect(hub.barrier.asrBrainGated(SES)).toBe(false);

    const oldCap = newId("evt");
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt" }));
    ws.send(
      JSON.stringify({
        t: "turn.done_speaking",
        sessionId: SES,
        captureId: oldCap,
        captureIntent: "send"
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 20));

    const deadId = newId("evt");
    const failed = nextJson(ws, (m) => m["requestId"] === deadId);
    ws.send(JSON.stringify(prepareMsg(ack.daemonEpoch, deadId)));
    await nextJson(pipeline.ws, (m) => m["t"] === "voice.quiesce");
    pipeline.ws.send(
      JSON.stringify({
        t: "voice.quiesced",
        sessionId: SES,
        requestId: deadId,
        epoch: 1,
        classified: false,
        code: "voice_recognition_failed"
      })
    );
    expect(await failed).toMatchObject({ status: "rejected", code: "voice_recognition_failed" });
    expect(hub.barrier.recordFor(SES, firstId)?.state).toBe("consumed");
    expect(hub.barrier.recordFor(SES, deadId)?.state).toBe("failed");
    expect(hub.barrier.asrBrainGated(SES)).toBe(true);

    pipeline.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: SES,
        turnId: newId("ses"),
        text: "历史recovered后失败不该进Brain",
        captureMode: "hands_free",
        recognitionOutcome: "ok"
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(brain).toEqual([]);
    expect(hub.barrier.asrBrainGated(SES)).toBe(true);

    const observeId = newId("evt");
    const unknown = nextJson(ws, (m) => m["requestId"] === observeId && m["code"] === "voice_audio_unknown");
    ws.send(JSON.stringify(prepareMsg(ack.daemonEpoch, observeId)));
    await unknown;

    const recoverId = newId("evt");
    const recoverQuiesce = nextJson(pipeline.ws, (m) => m["t"] === "voice.quiesce" && m["requestId"] === recoverId);
    const recovered = nextJson(ws, (m) => m["requestId"] === recoverId && m["status"] === "prepared");
    ws.send(JSON.stringify(prepareMsg(ack.daemonEpoch, recoverId, { discardUnknownEpochs: [1] })));
    const rq = await recoverQuiesce;
    pipeline.ws.send(
      JSON.stringify({
        t: "voice.quiesced",
        sessionId: SES,
        requestId: recoverId,
        epoch: rq["epoch"],
        classified: true
      })
    );
    await recovered;
    hub.barrier.applyHttp({
      sessionId: SES,
      body: { focusId: FOC, requestId: recoverId },
      write: () => ({ already: false })
    });
    const recoverRearmed = nextJson(ws, (m) => m["requestId"] === recoverId && m["status"] === "rearmed");
    ws.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt", quiesceRequestId: recoverId }));
    await recoverRearmed;
    expect(hub.barrier.asrBrainGated(SES)).toBe(false);

    pipeline.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: SES,
        turnId: newId("ses"),
        text: "rearm后旧capture迟到",
        captureMode: "ptt",
        captureId: oldCap,
        recognitionOutcome: "ok"
      })
    );
    pipeline.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: SES,
        turnId: newId("ses"),
        text: "rearm后无新inbound的迟到HF",
        captureMode: "hands_free",
        recognitionOutcome: "ok"
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(brain).toEqual([]);

    const newCap = newId("evt");
    ws.send(
      JSON.stringify({
        t: "turn.done_speaking",
        sessionId: SES,
        captureId: newCap,
        captureIntent: "send"
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    pipeline.ws.send(
      JSON.stringify({
        t: "asr.final",
        sessionId: SES,
        turnId: newId("ses"),
        text: "恢复后新音频可进Brain",
        captureMode: "ptt",
        captureId: newCap,
        recognitionOutcome: "ok"
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(brain).toEqual(["恢复后新音频可进Brain"]);
    pipeline.ws.close();
    ws.close();
  });
});

// 真实 WS -> Barrier -> callback -> SQLite audit sink,同时核请求重放不重复审计。
it("voice.anchor_prepare 真实写入 audit_log 且同请求重放不重复", async () => {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE audit_log(id TEXT PRIMARY KEY, ts TEXT, actor TEXT, action TEXT, ref_digest TEXT, meta_json TEXT)");
  const audit = createSqliteAuditSink(db);
  installEvents({ onBarrierAudit: (action, meta) => { audit.record({ actor: "daemon", action, meta }); } });
  const { ws, ack } = await connect("console");
  const requestId = newId("evt");
  try {
    for (let i = 0; i < 2; i++) {
      const status = nextJson(ws, m => m["t"] === "voice.anchor_status" && m["requestId"] === requestId);
      ws.send(JSON.stringify(prepareMsg(ack.daemonEpoch, requestId)));
      await status;
    }
    const rows = db.prepare("SELECT action, meta_json FROM audit_log WHERE action = ?").all("voice.anchor_prepare") as { action: string; meta_json: string }[];
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0]!.meta_json)).toMatchObject({ sessionId: SES, requestId, focusId: FOC });
  } finally {
    ws.close();
    db.close();
  }
});
