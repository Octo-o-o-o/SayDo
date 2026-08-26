// 1.2 验收:WS 契约测试(hello 版本协商/非法消息拒/路由)+ 注入通道三类事件用例各一。

import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import { newId } from "@saydo/contracts";
import { VoiceHub, VOICE_WS_PROTOCOL_VERSION } from "../src/voice/hub.js";
import type { Logger } from "../src/obs/logger.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../src/storage/db.js";
import { latestSessionProjectEvent, recordInitialSessionProjectEvent } from "../src/projects/anchor.js";
import { deliverSessionProjectOrThrow } from "../src/projects/anchorCommit.js";
import { insertProject } from "../src/storage/dao/projects.js";
import { managedProjectPath } from "../src/projects/workspace.js";
import {
  assessRuntimeIdentity,
  pipelineRuntimeJoined,
  type PipelineRuntimeState
} from "../src/runtimeIdentity.js";

const silentLog: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => silentLog
};

const SES = newId("ses");
const RUNTIME_SHA = "1234567890abcdef1234567890abcdef12345678";
const RUNTIME_IDENTITY = {
  sourceRevision: RUNTIME_SHA,
  buildId: "pipeline-test",
  protocolVersion: "1.0.0"
};

let server: Server;
let hub: VoiceHub;
let port: number;

beforeEach(async () => {
  server = createServer();
  hub = new VoiceHub(server, silentLog);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const addr = server.address();
  if (typeof addr === "object" && addr) port = addr.port;
});

afterEach(async () => {
  await hub.close();
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
});

function connect(
  role: "pipeline" | "console",
  v = VOICE_WS_PROTOCOL_VERSION,
  query = "",
  runtimeIdentity = RUNTIME_IDENTITY
): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/voice${query}`);
    ws.on("open", () =>
      ws.send(JSON.stringify({ v, role, ...(role === "pipeline" ? { identity: runtimeIdentity } : {}) }))
    );
    const onAck = (d: unknown, isBinary: boolean) => {
      if (isBinary) return;
      try {
        const m = JSON.parse(String(d)) as { t?: string };
        if (m.t === "hello.ack") {
          ws.off("message", onAck);
          resolve(ws);
        }
      } catch {
        // 非 JSON(二进制等)不参与握手判定
      }
    };
    ws.on("message", onAck);
    ws.on("close", (code) => reject(new Error(`closed ${code}`)));
    ws.on("error", reject);
  });
}

function nextJson(ws: WebSocket, predicate: (m: Record<string, unknown>) => boolean): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const handler = (d: unknown, isBinary: boolean) => {
      if (isBinary) return;
      try {
        const m = JSON.parse(String(d)) as Record<string, unknown>;
        if (predicate(m)) {
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

function joinedPeer(role: "pipeline" | "console"): { ws: WebSocket } {
  const peers = (hub as unknown as { peers: Set<{ role: string; helloDone: boolean; ws: WebSocket }> }).peers;
  const peer = [...peers].find((item) => item.helloDone && item.role === role);
  if (!peer) throw new Error(`missing ${role} peer`);
  return peer;
}

describe("asr.hotwords(接线批;09 §10 补录:daemon→pipeline 单向)", () => {
  it("sendHotwords 广播到 pipeline peer;pipeline 入场触发 onPipelineJoined(热词首推钩子)", async () => {
    let joined = 0;
    hub.setEvents({ onPipelineJoined: () => (joined += 1) });
    const pipeline = await connect("pipeline");
    expect(joined).toBe(1);
    const got = nextJson(pipeline, (m) => m["t"] === "asr.hotwords");
    hub.sendHotwords(["worktree", "digest"]);
    expect((await got)["words"]).toEqual(["worktree", "digest"]);
    pipeline.close();
  });

  it("peer 直发 asr.hotwords 被角色白名单丢弃(console/pipeline 都不许;仅 daemon 可发)", async () => {
    const evil = await connect("console");
    const pipeline = await connect("pipeline");
    let leaked = false;
    pipeline.on("message", (d, isBinary) => {
      if (!isBinary && String(d).includes("asr.hotwords")) leaked = true;
    });
    // 同连接 FIFO 保序:恶意消息后跟一条该角色合法且会广播回 pipeline 的消息作栅栏
    const evilBarrier = nextJson(pipeline, (m) => m["t"] === "barge_in");
    evil.send(JSON.stringify({ t: "asr.hotwords", words: ["evil-bias"] }));
    evil.send(JSON.stringify({ t: "barge_in", sessionId: SES, atMs: 1, truncatedSentenceId: "s-1" }));
    await evilBarrier;

    const p2Barrier = nextJson(pipeline, (m) => m["t"] === "turn.done_speaking");
    pipeline.send(JSON.stringify({ t: "asr.hotwords", words: ["evil-bias-2"] }));
    pipeline.send(JSON.stringify({ t: "turn.done_speaking", sessionId: SES }));
    await p2Barrier;

    expect(leaked).toBe(false);
    evil.close();
    pipeline.close();
  });
});

describe("WS 契约(09 §10)", () => {
  it("hello v1 握手成功;版本不匹配 fail-closed 拒连(4001)", async () => {
    const ok = await connect("pipeline");
    expect(hub.peerCount("pipeline")).toBe(1);
    ok.close();

    await expect(connect("console", 2)).rejects.toThrow(/closed 4001/);
  });

  it("pipeline 首个 health 通过同 HOME 门前不接纳 ASR，通过后才加入 runtime", async () => {
    await hub.close();
    const digest = "b".repeat(64);
    let joined = 0;
    let asrCount = 0;
    hub = new VoiceHub(server, silentLog, {
      onPipelineJoined: () => { joined += 1; },
      onAsrFinal: () => { asrCount += 1; }
    }, RUNTIME_IDENTITY.protocolVersion, digest);
    const pipeline = await connect("pipeline");
    let receivedBeforeHealth = false;
    pipeline.on("message", (data, isBinary) => {
      if (!isBinary && String(data).includes("asr.hotwords")) receivedBeforeHealth = true;
    });
    pipeline.send(JSON.stringify({ t: "asr.final", sessionId: SES, turnId: newId("ses"), text: "门前消息", confidence: 0.9 }));
    hub.sendHotwords(["must-not-leak-before-health"]);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(hub.pipelineAvailable()).toBe(false);
    expect(joined).toBe(0);
    expect(asrCount).toBe(0);
    expect(receivedBeforeHealth).toBe(false);
    await expect(hub.requestPipelineRestart(1, 10)).resolves.toEqual({ acked: false });

    pipeline.send(JSON.stringify({
      t: "pipeline.health",
      asr: "ok",
      tts: "ok",
      identity: RUNTIME_IDENTITY,
      stateRootDigest: digest
    }));
    await vi.waitFor(() => expect(hub.pipelineAvailable()).toBe(true));
    expect(joined).toBe(1);
    pipeline.send(JSON.stringify({ t: "asr.final", sessionId: SES, turnId: newId("ses"), text: "门后消息", confidence: 0.9 }));
    await vi.waitFor(() => expect(asrCount).toBe(1));
    pipeline.close();
  });

  it("pipeline 首个 health 的 HOME digest 不同立即断开", async () => {
    await hub.close();
    hub = new VoiceHub(server, silentLog, {}, RUNTIME_IDENTITY.protocolVersion, "c".repeat(64));
    const pipeline = await connect("pipeline");
    const closed = once(pipeline, "close");
    pipeline.send(JSON.stringify({
      t: "pipeline.health",
      asr: "ok",
      tts: "ok",
      identity: RUNTIME_IDENTITY,
      stateRootDigest: "d".repeat(64)
    }));
    const [code] = (await closed) as [number, Buffer];
    expect(code).toBe(4001);
    expect(hub.pipelineAvailable()).toBe(false);
  });

  it("pipeline 协议兼容性以构建注入版本为单源,不回退 contracts 常量", async () => {
    await hub.close();
    hub = new VoiceHub(server, silentLog, {}, "2.4.0");
    const compatible = await connect("pipeline", VOICE_WS_PROTOCOL_VERSION, "", {
      ...RUNTIME_IDENTITY,
      protocolVersion: "2.1.0"
    });
    compatible.close();
    await expect(
      connect("pipeline", VOICE_WS_PROTOCOL_VERSION, "", { ...RUNTIME_IDENTITY, protocolVersion: "1.9.0" })
    ).rejects.toThrow(/closed 4001/);
  });

  it("M1 确认事件按 session 定向,confirm.decision 保留 receiptId+sessionId+withdraw", async () => {
    const otherSession = newId("ses");
    const first = await connect("console");
    const second = await connect("console");
    let boundCount = 0;
    const bothBound = new Promise<void>((resolve) => {
      hub.setEvents({
        onVoiceMode: () => {
          boundCount += 1;
          if (boundCount === 2) resolve();
        }
      });
    });
    first.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt" }));
    second.send(JSON.stringify({ t: "voice.mode", sessionId: otherSession, mode: "ptt" }));
    await bothBound;
    const firstBound = nextJson(first, (m) => m["t"] === "confirm.card");
    let leaked = false;
    second.on("message", (data, binary) => {
      if (!binary && String(data).includes('"t":"confirm.card"')) leaked = true;
    });
    hub.sendConsoleEvent({
      t: "confirm.card",
      sessionId: SES,
      receiptId: "apr_mobile_directed",
      text: "按原会话裁决吗",
      kind: "focus_obligation",
      digest: "digest-mobile",
      digestVersion: 1
    });
    await expect(firstBound).resolves.toMatchObject({
      sessionId: SES,
      receiptId: "apr_mobile_directed"
    });

    const decision = new Promise<Record<string, unknown>>((resolve) => {
      hub.setEvents({ onConfirmDecision: (message) => resolve(message) });
    });
    second.send(
      JSON.stringify({
        t: "confirm.decision",
        sessionId: SES,
        receiptId: "apr_mobile_directed",
        decision: "withdraw"
      })
    );
    await expect(decision).resolves.toMatchObject({
      t: "confirm.decision",
      sessionId: SES,
      receiptId: "apr_mobile_directed",
      decision: "withdraw"
    });
    expect(leaked).toBe(false);
    first.close();
    second.close();
  });

  it("M1 非终态裁决结果只回发起 socket，不让同 session 桌面 peer 误清卡", async () => {
    hub.setEvents({
      onConfirmDecision: (message) => ({
        t: "confirm.resolved",
        sessionId: message.sessionId,
        receiptId: message.receiptId,
        outcome: "untrusted_source"
      })
    });
    const mobile = await connect("console");
    const desktop = await connect("console");
    mobile.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt" }));
    desktop.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt" }));

    const leaked: string[] = [];
    desktop.on("message", (data, binary) => {
      if (!binary && String(data).includes('\"t\":\"confirm.resolved\"')) leaked.push(String(data));
    });
    const sourceReply = nextJson(mobile, (message) => message["t"] === "confirm.resolved");
    mobile.send(
      JSON.stringify({
        t: "confirm.decision",
        sessionId: SES,
        receiptId: "apr_untrusted_runtime",
        decision: "accept"
      })
    );
    await expect(sourceReply).resolves.toMatchObject({ outcome: "untrusted_source" });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(leaked).toEqual([]);
    mobile.close();
    desktop.close();
  });

  it("mobile_lan WS 只开放文本、定向裁决、会话登记与心跳", async () => {
    const seen: string[] = [];
    let decisionVia = "";
    hub.setEvents({
      verifyUpgrade: () => ({ ok: true, via: "mobile_lan" }),
      onVoiceMode: () => seen.push("voice.mode"),
      onTurnText: () => seen.push("turn.text"),
      onConfirmDecision: (_message, via) => {
        seen.push("confirm.decision");
        decisionVia = via ?? "";
      },
      onConfirmClick: () => seen.push("confirm.click"),
      onPlayout: () => seen.push("tts.playout")
    });
    const mobile = await connect("console");
    mobile.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt" }));
    mobile.send(JSON.stringify({ t: "turn.text", sessionId: SES, turnId: newId("ses"), text: "继续", typed: true }));
    mobile.send(JSON.stringify({ t: "confirm.decision", sessionId: SES, receiptId: "apr_mobile", decision: "withdraw" }));
    mobile.send(JSON.stringify({ t: "confirm.click", sessionId: SES, receiptId: "apr_mobile", digest: "digest", decision: "accept" }));
    mobile.send(JSON.stringify({ t: "tts.playout", sessionId: SES, sentenceId: "s1", watermarkMs: 10 }));
    mobile.send(Buffer.from([0x01, 0, 0, 0, 1, 7]));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(seen).toEqual(["voice.mode", "turn.text", "confirm.decision"]);
    expect(decisionVia).toBe("mobile_lan");
    mobile.close();
  });

  it("同时只接受一个 pipeline peer，旧 peer 关闭后才允许替换", async () => {
    const first = await connect("pipeline");
    await expect(connect("pipeline")).rejects.toThrow(/closed 4003/);
    expect(hub.peerCount("pipeline")).toBe(1);

    const closed = once(first, "close");
    first.close();
    await closed;
    const replacement = await connect("pipeline");
    expect(hub.peerCount("pipeline")).toBe(1);
    replacement.close();
  });

  it("旧 pipeline 进入 CLOSING 但 close 事件未完成时仍占唯一席位", async () => {
    const first = await connect("pipeline");
    const firstClosed = once(first, "close");
    first.close();
    expect(first.readyState).toBe(WebSocket.CLOSING);

    const rejected: Array<[number, string]> = [];
    const fakePeer = {
      ws: {
        readyState: WebSocket.OPEN,
        send: () => undefined,
        close: (code: number, reason: string) => rejected.push([code, reason])
      } as unknown as WebSocket,
      role: "console",
      helloDone: false
    };
    const privateHub = hub as unknown as {
      peers: Set<typeof fakePeer>;
      handleHello(peer: typeof fakePeer, data: Buffer, isBinary: boolean): void;
    };
    privateHub.peers.add(fakePeer);
    privateHub.handleHello(
      fakePeer,
      Buffer.from(JSON.stringify({ v: 1, role: "pipeline", identity: RUNTIME_IDENTITY })),
      false
    );

    expect(rejected).toEqual([[4003, "pipeline already connected"]]);
    await firstClosed;
  });

  it("非当前 owner 的旧 pipeline 消息不能污染 health", async () => {
    let healthCalls = 0;
    hub.setEvents({ onHealth: () => (healthCalls += 1) });
    const current = await connect("pipeline");
    const stalePeer = {
      ws: { readyState: WebSocket.OPEN } as WebSocket,
      role: "pipeline" as const,
      helloDone: true,
      identity: RUNTIME_IDENTITY
    };
    (
      hub as unknown as {
        routeJson(peer: typeof stalePeer, data: Buffer): void;
      }
    ).routeJson(
      stalePeer,
      Buffer.from(
        JSON.stringify({
          t: "pipeline.health",
          asr: "ok",
          tts: "ok",
          identity: RUNTIME_IDENTITY,
          stateRootDigest: "a".repeat(64)
        })
      )
    );

    expect(healthCalls).toBe(0);
    current.close();
  });

  it("CLOSING owner 仍占席但 JSON、二进制与下行投递全部 fail-closed", () => {
    let asrCalls = 0;
    let consoleSends = 0;
    let pipelineSends = 0;
    hub.setEvents({ onAsrFinal: () => (asrCalls += 1) });
    const pipelinePeer = {
      ws: {
        readyState: WebSocket.CLOSING,
        close: () => undefined,
        send: () => {
          pipelineSends += 1;
        }
      } as unknown as WebSocket,
      role: "pipeline" as const,
      helloDone: true,
      identity: RUNTIME_IDENTITY
    };
    const consolePeer = {
      ws: {
        readyState: WebSocket.OPEN,
        close: () => undefined,
        send: () => {
          consoleSends += 1;
        }
      } as unknown as WebSocket,
      role: "console" as const,
      helloDone: true
    };
    const privateHub = hub as unknown as {
      peers: Set<typeof pipelinePeer | typeof consolePeer>;
      currentPipelinePeer: typeof pipelinePeer;
      routeJson(peer: typeof pipelinePeer, data: Buffer): void;
      routeBinary(peer: typeof pipelinePeer, data: Buffer): void;
    };
    privateHub.peers.add(pipelinePeer);
    privateHub.peers.add(consolePeer);
    privateHub.currentPipelinePeer = pipelinePeer;

    privateHub.routeJson(
      pipelinePeer,
      Buffer.from(
        JSON.stringify({
          t: "asr.final",
          sessionId: SES,
          turnId: newId("ses"),
          text: "stale"
        })
      )
    );
    privateHub.routeBinary(pipelinePeer, Buffer.from([0x02, 0, 0, 0, 1, 1]));
    const ttsAccepted = hub.sendTtsSay({
      t: "tts.say",
      sessionId: SES,
      sentenceId: "s-closing",
      text: "test",
      interruptible: true
    });

    expect(hub.pipelineAvailable()).toBe(false);
    expect(privateHub.currentPipelinePeer).toBe(pipelinePeer);
    expect({ asrCalls, consoleSends, pipelineSends, ttsAccepted }).toEqual({
      asrCalls: 0,
      consoleSends: 0,
      pipelineSends: 0,
      ttsAccepted: false
    });
  });

  it("pipeline hello/health 身份必须自洽,源码 revision 不再与 daemon 比等", async () => {
    await hub.close();
    hub = new VoiceHub(server, silentLog);
    const pipeline = await connect("pipeline");
    const console_ = await connect("console");
    const health = nextJson(console_, (m) => m["t"] === "pipeline.health");
    pipeline.send(
      JSON.stringify({
        t: "pipeline.health",
        asr: "ok",
        tts: "ok",
        identity: RUNTIME_IDENTITY,
        stateRootDigest: "a".repeat(64)
      })
    );
    expect((await health)["identity"]).toEqual(RUNTIME_IDENTITY);
    pipeline.close();
    console_.close();

    await expect(
      new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/voice`);
        ws.on("open", () =>
          ws.send(
            JSON.stringify({
              v: 1,
              role: "pipeline",
              identity: { ...RUNTIME_IDENTITY, protocolVersion: "2.0.0" }
            })
          )
        );
        ws.on("close", (code) => reject(new Error(`closed ${code}`)));
        ws.on("message", resolve);
      })
    ).rejects.toThrow(/closed 4001/);
  });

  it("health 身份不一致时即使 logger 抛错也必须关闭 current owner", async () => {
    await hub.close();
    const throwingLog: Logger = {
      ...silentLog,
      warn: () => {
        throw new Error("logger boom");
      }
    };
    hub = new VoiceHub(server, throwingLog);
    const pipeline = await connect("pipeline");
    const closed = once(pipeline, "close");

    pipeline.send(
      JSON.stringify({
        t: "pipeline.health",
        asr: "ok",
        tts: "ok",
        identity: { ...RUNTIME_IDENTITY, buildId: "other-build" },
        stateRootDigest: "a".repeat(64)
      })
    );

    const [code] = (await closed) as [number, Buffer];
    expect(code).toBe(4001);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(hub.peerCount("pipeline")).toBe(0);
  });

  it("current owner 进入 CLOSING 时立即失效 runtime readiness", async () => {
    await hub.close();
    const digest = "a".repeat(64);
    const nowMs = 1_000;
    let state: PipelineRuntimeState = pipelineRuntimeJoined(RUNTIME_SHA);
    hub = new VoiceHub(server, silentLog, {
      onHealth: (msg) => {
        state = {
          connected: true,
          runtimeSha: msg.identity.sourceRevision,
          protocolVersion: msg.identity.protocolVersion,
          stateRootDigest: msg.stateRootDigest,
          lastHealthAtMs: nowMs,
          asr: msg.asr,
          tts: msg.tts
        };
      },
      onPipelineLeft: () => {
        state = {
          connected: false,
          runtimeSha: null,
          protocolVersion: null,
          stateRootDigest: null,
          lastHealthAtMs: 0,
          asr: "down",
          tts: "down"
        };
      }
    });
    let fakeReadyState: number = WebSocket.OPEN;
    const fakeWs = {
      get readyState() {
        return fakeReadyState;
      },
      send: () => undefined,
      close() {
        fakeReadyState = WebSocket.CLOSING;
      }
    } as unknown as WebSocket;
    const peer = {
      ws: fakeWs,
      role: "pipeline" as const,
      helloDone: true,
      identity: RUNTIME_IDENTITY
    };
    type PeerShape = typeof peer;
    const privateHub = hub as unknown as {
      currentPipelinePeer: PeerShape;
      routeJson(peer: PeerShape, data: Buffer): void;
    };
    privateHub.currentPipelinePeer = peer;
    privateHub.routeJson(
      peer,
      Buffer.from(
        JSON.stringify({
          t: "pipeline.health",
          asr: "ok",
          tts: "ok",
          identity: RUNTIME_IDENTITY,
          stateRootDigest: digest
        })
      )
    );
    expect(
      assessRuntimeIdentity({
        daemonIdentity: RUNTIME_IDENTITY,
        daemonStateRootDigest: digest,
        pipeline: state,
        nowMs,
        maxHealthAgeMs: 45_000,
        coreReady: true
      }).voiceReady
    ).toBe(true);

    fakeReadyState = WebSocket.CLOSING;
    expect(hub.pipelineAvailable()).toBe(false);
    fakeReadyState = WebSocket.OPEN;

    privateHub.routeJson(
      peer,
      Buffer.from(
        JSON.stringify({
          t: "pipeline.health",
          asr: "ok",
          tts: "ok",
          identity: { ...RUNTIME_IDENTITY, buildId: "other-build" },
          stateRootDigest: digest
        })
      )
    );

    expect(fakeWs.readyState).toBe(WebSocket.CLOSING);
    expect(
      assessRuntimeIdentity({
        daemonIdentity: RUNTIME_IDENTITY,
        daemonStateRootDigest: digest,
        pipeline: state,
        nowMs,
        maxHealthAgeMs: 45_000,
        coreReady: true
      }).voiceReady
    ).toBe(false);
  });

  it("内部注入通道不能伪造 pipeline.health", () => {
    expect(() =>
      hub.injectPipelineMsg({
        t: "pipeline.health",
        asr: "ok",
        tts: "ok",
        identity: RUNTIME_IDENTITY,
        stateRootDigest: "a".repeat(64)
      })
    ).toThrow(/真实 pipeline peer/u);
  });

  it("非法 role / 畸形 hello 拒连", async () => {
    await expect(
      new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/voice`);
        ws.on("open", () => ws.send(JSON.stringify({ v: 1, role: "hacker" })));
        ws.on("close", (code) => reject(new Error(`closed ${code}`)));
        ws.on("message", resolve);
      })
    ).rejects.toThrow(/closed 4003/);
  });

  it("schema 非法消息被丢弃(不炸连接);合法消息按角色路由", async () => {
    const pipeline = await connect("pipeline");
    const console_ = await connect("console");

    // 非法消息:未知 t
    pipeline.send(JSON.stringify({ t: "asr.wat", sessionId: SES }));
    // 合法:pipeline 报 asr.final -> console 收到
    const wait = nextJson(console_, (m) => m["t"] === "asr.final");
    pipeline.send(JSON.stringify({ t: "asr.final", sessionId: SES, turnId: newId("ses"), text: "你好", confidence: 0.9 }));
    const got = await wait;
    expect(got["text"]).toBe("你好");

    pipeline.close();
    console_.close();
  });

  it("tts.say 下发两端 + C8 记账钩子(字符数)", async () => {
    const chars: number[] = [];
    hub.setEvents({ onTtsChars: (_sid, n) => chars.push(n) });
    const pipeline = await connect("pipeline");
    const waitP = nextJson(pipeline, (m) => m["t"] === "tts.say");
    expect(
      hub.sendTtsSay({
        t: "tts.say",
        sessionId: SES,
        sentenceId: "s1",
        text: "执行和检查都跑完了",
        interruptible: true
      })
    ).toBe(true);
    const got = await waitP;
    expect(got["sentenceId"]).toBe("s1");
    expect(chars).toEqual([9]);
    pipeline.close();
  });

  it("M2 native.reply 只投同 session mobile_lan，且复用 TTS 脱敏出口", async () => {
    await hub.close();
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    server = createServer();
    hub = new VoiceHub(server, silentLog, {
      verifyUpgrade: (req) => ({
        ok: true,
        via: req.url?.includes("client=mobile") ? "mobile_lan" : "local"
      })
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const addr = server.address();
    if (typeof addr === "object" && addr) port = addr.port;

    const pipeline = await connect("pipeline", VOICE_WS_PROTOCOL_VERSION, "?client=local");
    const mobile = await connect("console", VOICE_WS_PROTOCOL_VERSION, "?client=mobile");
    const otherMobile = await connect("console", VOICE_WS_PROTOCOL_VERSION, "?client=mobile-other");
    const desktop = await connect("console", VOICE_WS_PROTOCOL_VERSION, "?client=local");
    const otherSession = newId("ses");
    let bound = 0;
    const bothBound = new Promise<void>((resolve) => {
      hub.setEvents({
        onVoiceMode: () => {
          bound += 1;
          if (bound === 2) resolve();
        }
      });
    });
    mobile.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt" }));
    otherMobile.send(JSON.stringify({ t: "voice.mode", sessionId: otherSession, mode: "ptt" }));
    await bothBound;

    const leaked: string[] = [];
    otherMobile.on("message", (data, binary) => {
      if (!binary && String(data).includes('"t":"native.reply"')) leaked.push("other-session");
    });
    desktop.on("message", (data, binary) => {
      if (!binary && String(data).includes('"t":"native.reply"')) leaked.push("desktop");
    });
    const reply = nextJson(mobile, (msg) => msg["t"] === "native.reply");
    const pipelineSay = nextJson(pipeline, (msg) => msg["t"] === "tts.say");
    const nativeTurnId = newId("ses");
    expect(
      hub.sendTtsSay(
        {
          t: "tts.say",
          sessionId: SES,
          sentenceId: `s-${SES}-1`,
          text: `路径 ${["", "Users", "alice"].join("/")}/secret.txt；令牌 Bearer abcdefghijkl`,
          interruptible: true
        },
        [],
        "assistant_reply",
        nativeTurnId
      )
    ).toBe(true);
    await pipelineSay;
    expect(await reply).toMatchObject({
      t: "native.reply",
      sessionId: SES,
      turnId: nativeTurnId,
      sentenceId: `s-${SES}-1`,
      origin: "assistant_reply",
      text: "路径 某个文件；令牌 一处凭据"
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(leaked).toEqual([]);

    pipeline.close();
    mobile.close();
    otherMobile.close();
    desktop.close();
  });

  it("M2 mobile_lan 下行白名单拒 ASR 与二进制，只放 native.reply", async () => {
    await hub.close();
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    server = createServer();
    hub = new VoiceHub(server, silentLog, {
      verifyUpgrade: (req) => ({
        ok: true,
        via: req.url?.includes("client=mobile") ? "mobile_lan" : "local"
      })
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const addr = server.address();
    if (typeof addr === "object" && addr) port = addr.port;

    const pipeline = await connect("pipeline", VOICE_WS_PROTOCOL_VERSION, "?client=local");
    const mobile = await connect("console", VOICE_WS_PROTOCOL_VERSION, "?client=mobile");
    const bound = new Promise<void>((resolve) => hub.setEvents({ onVoiceMode: () => resolve() }));
    mobile.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt" }));
    await bound;
    const receivedTypes: string[] = [];
    let binaryCount = 0;
    mobile.on("message", (data, binary) => {
      if (binary) binaryCount += 1;
      else receivedTypes.push(String((JSON.parse(String(data)) as { t?: string }).t));
    });

    hub.injectPipelineMsg({ t: "asr.final", sessionId: SES, turnId: newId("ses"), text: "不得下发" });
    pipeline.send(Buffer.from([0x02, 0, 0, 0, 1, 0]), { binary: true });
    const reply = nextJson(mobile, (msg) => msg["t"] === "native.reply");
    hub.sendNativeReply({
      sessionId: SES,
      turnId: SES,
      sentenceId: "s-allow",
      text: "允许下发",
      origin: "system"
    });
    await reply;
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(receivedTypes).toEqual(["native.reply"]);
    expect(binaryCount).toBe(0);

    pipeline.close();
    mobile.close();
  });

  it("pipeline 不在线时 tts.say 返回 false，调用方不得据此 arm 确认", () => {
    expect(
      hub.sendTtsSay({ t: "tts.say", sessionId: SES, sentenceId: "s-offline", text: "确认吗", interruptible: true })
    ).toBe(false);
  });

  it("pipeline 不在线时可向已连接 console 单独呈现脱敏文本,且不冒充 TTS 成功", async () => {
    const console_ = await connect("console");
    const bound = new Promise<void>((resolve) => hub.setEvents({ onVoiceMode: () => resolve() }));
    console_.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt" }));
    await bound;
    const got = nextJson(console_, (msg) => msg["t"] === "tts.say" && msg["sentenceId"] === "s-text-only");
    expect(
      hub.sendConsoleSay({
        t: "tts.say",
        sessionId: SES,
        sentenceId: "s-text-only",
        text: "文本确认",
        interruptible: true
      })
    ).toBe(true);
    expect((await got)["text"]).toBe("文本确认");
    console_.close();
  });

  it("文本兜底仅向同 session console 呈现,其他会话在线不算成功", async () => {
    const other = await connect("console");
    const otherSession = newId("ses");
    const bound = new Promise<void>((resolve) => hub.setEvents({ onVoiceMode: () => resolve() }));
    other.send(JSON.stringify({ t: "voice.mode", sessionId: otherSession, mode: "ptt" }));
    await bound;
    expect(
      hub.sendConsoleSay({
        t: "tts.say",
        sessionId: SES,
        sentenceId: "s-wrong-session",
        text: "不得泄露",
        interruptible: true
      })
    ).toBe(false);
    other.close();
  });

  it("pipeline 同步 enqueue 抛错时 tts.say 返回 false，不会产生假成功", async () => {
    const pipeline = await connect("pipeline");
    const peer = joinedPeer("pipeline");
    peer.ws.send = (() => {
      throw new Error("enqueue failed");
    }) as typeof peer.ws.send;

    expect(
      hub.sendTtsSay({ t: "tts.say", sessionId: SES, sentenceId: "s-failed", text: "确认吗", interruptible: true })
    ).toBe(false);
    pipeline.close();
  });

  it("pipeline 已 enqueue 后成本钩子异常不反转 tts.say 成功", async () => {
    hub.setEvents({
      onTtsChars: () => {
        throw new Error("cost hook failed");
      }
    });
    const pipeline = await connect("pipeline");
    const got = nextJson(pipeline, (msg) => msg["t"] === "tts.say");

    expect(
      hub.sendTtsSay({ t: "tts.say", sessionId: SES, sentenceId: "s-cost", text: "确认吗", interruptible: true })
    ).toBe(true);
    expect((await got)["sentenceId"]).toBe("s-cost");
    pipeline.close();
  });

  it("生产投递判定通过真实 VoiceHub 把 session.project 交给 console", async () => {
    const console_ = await connect("console");
    const got = nextJson(console_, (msg) => msg["t"] === "session.project");
    const event = {
      eventId: "evt_01W1REE2E00000000000000000",
      sessionId: SES,
      projectId: "prj_01W1REE2E00000000000000000",
      projectRevision: 1,
      reason: "workspace_adopted" as const,
      createdAt: "2026-07-31T00:00:00.000Z"
    };

    expect(() => deliverSessionProjectOrThrow(hub, event)).not.toThrow();
    expect(await got).toMatchObject({
      t: "session.project",
      sessionId: event.sessionId,
      projectId: event.projectId,
      projectRevision: event.projectRevision,
      reason: event.reason
    });
    console_.close();
  });

  it("session.project 发送异常由生产投递判定抛给 post-commit 域", async () => {
    const console_ = await connect("console");
    const peer = joinedPeer("console");
    peer.ws.send = (() => {
      throw new Error("enqueue failed");
    }) as typeof peer.ws.send;

    expect(() =>
      deliverSessionProjectOrThrow(hub, {
        eventId: "evt_01W1REE2E00000000000000000",
        sessionId: SES,
        projectId: "prj_01W1REE2E00000000000000000",
        projectRevision: 1,
        reason: "workspace_adopted",
        createdAt: "2026-07-31T00:00:00.000Z"
      })
    ).toThrow(/session\.project delivery failed/u);
    console_.close();
  });

  it("二进制通道:0x01 上行到 pipeline,0x02 下行到 console", async () => {
    const pipeline = await connect("pipeline");
    const console_ = await connect("console");

    const upWait = new Promise<Buffer>((resolve) => pipeline.on("message", (d, b) => b && resolve(d as Buffer)));
    console_.send(Buffer.concat([Buffer.from([0x01, 0, 0, 0, 1]), Buffer.from("pcm")]), { binary: true });
    const up = await upWait;
    expect(up[0]).toBe(0x01);

    const downWait = new Promise<Buffer>((resolve) => console_.on("message", (d, b) => b && resolve(d as Buffer)));
    pipeline.send(Buffer.concat([Buffer.from([0x02, 0, 0, 0, 1]), Buffer.from("mp3")]), { binary: true });
    const down = await downWait;
    expect(down[0]).toBe(0x02);

    pipeline.close();
    console_.close();
  });
});

describe("测试音频注入通道(计划 1.2:三类事件用例各一)", () => {
  it("注入 asr.final:事件钩子触发 + console 对端收到(与真实对端同路径)", async () => {
    const seen: string[] = [];
    hub.setEvents({ onAsrFinal: (m) => seen.push(m.text) });
    const console_ = await connect("console");
    const wait = nextJson(console_, (m) => m["t"] === "asr.final");
    hub.injectPipelineMsg({ t: "asr.final", sessionId: SES, turnId: newId("ses"), text: "帮我跑测试", confidence: 0.95 });
    await wait;
    expect(seen).toEqual(["帮我跑测试"]);
    console_.close();
  });

  it("注入 tts.playout:watermark 记录可查(unheard 判定基础)", () => {
    hub.injectPipelineMsg({ t: "tts.playout", sessionId: SES, sentenceId: "s7", watermarkMs: 1234 });
    expect(hub.watermarkOf(SES)).toEqual({ sentenceId: "s7", watermarkMs: 1234 });
  });

  it("注入 barge_in:pipeline 对端收到(停止合成),事件钩子触发", async () => {
    const bargeIns: string[] = [];
    hub.setEvents({ onBargeIn: (m) => bargeIns.push(m.truncatedSentenceId) });
    const pipeline = await connect("pipeline");
    const wait = nextJson(pipeline, (m) => m["t"] === "barge_in");
    hub.injectPipelineMsg({ t: "barge_in", sessionId: SES, atMs: 800, truncatedSentenceId: "s7" });
    await wait;
    expect(bargeIns).toEqual(["s7"]);
    pipeline.close();
  });

  it("注入非法消息被 schema 拒(抛错)", () => {
    expect(() => hub.injectPipelineMsg({ t: "asr.final", sessionId: SES } as never)).toThrow();
  });
});

describe("W2 阶段 D:免手档消息(09 §10 additive:voice.mode / vad.speech)", () => {
  it("voice.mode 触发 durable session.project 回放，daemon 事件可推送 revision", async () => {
    const db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-hub-replay-")), "saydo.db"));
    const projectId = "prj_01W1REE2E00000000000000000";
    const now = "2026-07-30T00:00:00.000Z";
    insertProject(db, {
      id: projectId,
      title: "回放",
      type: "pending",
      status: "draft",
      workspace: { kind: "local_folder", path: managedProjectPath(projectId), managed: true },
      executionModeDefault: "step_confirm",
      createdAt: now,
      updatedAt: now
    });
    db.prepare(
      `INSERT INTO sessions(id,project_id,state,engine,transcript_path,started_at)
       VALUES (?, ?, 'talking', 'cascade', '/tmp/replay.jsonl', ?)`
    ).run(SES, projectId, now);
    recordInitialSessionProjectEvent(db, SES, projectId, now);
    hub.setEvents({
      onVoiceMode: (msg) => {
        const event = latestSessionProjectEvent(db, msg.sessionId);
        if (event) hub.sendSessionProject(event);
      }
    });
    const consoleWs = await connect("console");
    const got = nextJson(consoleWs, (m) => m["t"] === "session.project");
    consoleWs.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "ptt" }));
    expect(await got).toMatchObject({
      t: "session.project",
      sessionId: SES,
      projectId,
      projectRevision: 0,
      reason: "draft_created"
    });
    consoleWs.close();
    db.close();
  });

  it("voice.mode:console -> pipeline 转发;vad.speech:pipeline -> console 转发", async () => {
    const consoleWs = await connect("console");
    const pipelineWs = await connect("pipeline");
    const gotMode = nextJson(pipelineWs, (m) => m["t"] === "voice.mode");
    consoleWs.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "hands_free" }));
    expect(await gotMode).toMatchObject({ t: "voice.mode", sessionId: SES, mode: "hands_free" });
    const gotVad = nextJson(consoleWs, (m) => m["t"] === "vad.speech");
    pipelineWs.send(JSON.stringify({ t: "vad.speech", sessionId: SES, phase: "start" }));
    expect(await gotVad).toMatchObject({ t: "vad.speech", sessionId: SES, phase: "start" });
    consoleWs.close();
    pipelineWs.close();
  });

  it("方向白名单:pipeline 发 voice.mode / console 发 vad.speech 被丢弃(角色越权)", async () => {
    const consoleWs = await connect("console");
    const pipelineWs = await connect("pipeline");
    let leaked = false;
    pipelineWs.on("message", (d, isBinary) => {
      if (!isBinary && String(d).includes("voice.mode")) leaked = true;
    });
    consoleWs.on("message", (d, isBinary) => {
      if (!isBinary && String(d).includes("vad.speech")) leaked = true;
    });
    pipelineWs.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "hands_free" }));
    consoleWs.send(JSON.stringify({ t: "vad.speech", sessionId: SES, phase: "start" }));
    await new Promise((r) => setTimeout(r, 150));
    expect(leaked).toBe(false);
    consoleWs.close();
    pipelineWs.close();
  });
});

describe("capture ingress 评审 B-5(2026-08-26):pipeline (re)join 采集模式重放", () => {
  /** 握手前先挂收集器:重放紧跟 hello.ack(可同 tick 到达),connect()+nextJson 会竞态漏收 */
  function connectCollecting(
    role: "pipeline" | "console"
  ): Promise<{ ws: WebSocket; messages: Array<Record<string, unknown>> }> {
    const messages: Array<Record<string, unknown>> = [];
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/voice`);
      ws.on("message", (d, isBinary) => {
        if (isBinary) return;
        try {
          const m = JSON.parse(String(d)) as Record<string, unknown>;
          messages.push(m);
          if (m["t"] === "hello.ack") resolve({ ws, messages });
        } catch {
          // 忽略非 JSON
        }
      });
      ws.on("open", () =>
        ws.send(
          JSON.stringify({ v: VOICE_WS_PROTOCOL_VERSION, role, ...(role === "pipeline" ? { identity: RUNTIME_IDENTITY } : {}) })
        )
      );
      ws.on("close", (code) => reject(new Error(`closed ${code}`)));
      ws.on("error", reject);
    });
  }

  it("console 保持连接、仅 pipeline 重连:join 后收到最近生效 voice.mode 重放(免手档恢复)", async () => {
    const consoleWs = await connect("console");
    const pipeline1 = await connect("pipeline");
    const got1 = nextJson(pipeline1, (m) => m["t"] === "voice.mode");
    consoleWs.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "hands_free" }));
    expect(await got1).toMatchObject({ t: "voice.mode", sessionId: SES, mode: "hands_free" });

    // 仅 pipeline 断开重连;console 不再发任何消息(重连侧 _reset_connection_tasks 已把 _mode 清回 ptt,
    // 无重放则免手 mic 帧全部积压 _mic_buf 且永无 done_speaking 触发 finalize——B-5 哑死形态)
    const closed = once(pipeline1, "close");
    pipeline1.close();
    await closed;
    const { ws: pipeline2, messages } = await connectCollecting("pipeline");
    await vi.waitFor(() =>
      expect(
        messages.some((m) => m["t"] === "voice.mode" && m["mode"] === "hands_free" && m["sessionId"] === SES)
      ).toBe(true)
    );
    consoleWs.close();
    pipeline2.close();
  });

  it("生产形态(HOME 门):重放在首个 health 过门后到达,门前不泄漏", async () => {
    await hub.close();
    const digest = "e".repeat(64);
    let modeSeen = 0;
    hub = new VoiceHub(
      server,
      silentLog,
      { onVoiceMode: () => { modeSeen += 1; } },
      RUNTIME_IDENTITY.protocolVersion,
      digest
    );
    const consoleWs = await connect("console");
    consoleWs.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "hands_free" }));
    await vi.waitFor(() => expect(modeSeen).toBe(1));

    const { ws: pipeline, messages } = await connectCollecting("pipeline");
    await new Promise((r) => setTimeout(r, 50));
    expect(messages.some((m) => m["t"] === "voice.mode")).toBe(false);

    pipeline.send(
      JSON.stringify({ t: "pipeline.health", asr: "ok", tts: "ok", identity: RUNTIME_IDENTITY, stateRootDigest: digest })
    );
    await vi.waitFor(() =>
      expect(
        messages.some((m) => m["t"] === "voice.mode" && m["mode"] === "hands_free" && m["sessionId"] === SES)
      ).toBe(true)
    );
    consoleWs.close();
    pipeline.close();
  });

  it("mobile_lan 的 voice.mode 不留档:pipeline join 无重放(登记消息不得改采集模式)", async () => {
    let modeSeen = 0;
    hub.setEvents({
      verifyUpgrade: () => ({ ok: true, via: "mobile_lan" }),
      onVoiceMode: () => { modeSeen += 1; }
    });
    const mobile = await connect("console");
    mobile.send(JSON.stringify({ t: "voice.mode", sessionId: SES, mode: "hands_free" }));
    await vi.waitFor(() => expect(modeSeen).toBe(1));

    hub.setEvents({}); // 清 verifyUpgrade:pipeline 是 local-only,带 mobile_lan via 会被拒连
    const { ws: pipeline, messages } = await connectCollecting("pipeline");
    await new Promise((r) => setTimeout(r, 50));
    expect(messages.some((m) => m["t"] === "voice.mode")).toBe(false);
    mobile.close();
    pipeline.close();
  });
});

describe("W2 迟到评审 A1 回收:console peer via 标注(语音工具环 S3 门的探测面)", () => {
  it("verifyUpgrade 返回 via=tailnet 的 console 在连 ⇒ hasTailnetConsole()=true;断开归 false", async () => {
    await hub.close();
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    server = createServer();
    hub = new VoiceHub(server, silentLog, { verifyUpgrade: () => ({ ok: true, via: "tailnet" }) });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const addr = server.address();
    if (typeof addr === "object" && addr) port = addr.port;
    expect(hub.hasTailnetConsole()).toBe(false);
    const ws = await connect("console");
    expect(hub.hasTailnetConsole()).toBe(true);
    ws.close();
    await new Promise((r) => setTimeout(r, 100));
    expect(hub.hasTailnetConsole()).toBe(false);
  });

  it("via=local(或未校验)的 console 不触发 tailnet 判定;pipeline peer 不计入", async () => {
    const consoleWs = await connect("console"); // 缺省 hub 无 verifyUpgrade,via undefined
    const pipelineWs = await connect("pipeline");
    expect(hub.hasTailnetConsole()).toBe(false);
    consoleWs.close();
    pipelineWs.close();
  });

  it("第四轮终验 B1:tailnet 来源自称 pipeline 拒连(role 自报不可绕 S3 门/不可注入伪造转写)", async () => {
    await hub.close();
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    server = createServer();
    hub = new VoiceHub(server, silentLog, { verifyUpgrade: () => ({ ok: true, via: "tailnet" }) });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const addr = server.address();
    if (typeof addr === "object" && addr) port = addr.port;
    await expect(connect("pipeline")).rejects.toThrow(/closed 4003/);
    // 同来源 console 照常可连(S2 面);hasTailnetConsole 如实计数
    const consoleWs = await connect("console");
    expect(hub.hasTailnetConsole()).toBe(true);
    expect(hub.peerCount("pipeline")).toBe(0);
    consoleWs.close();
  });

  it("M1 mobile_lan console 计入远程 S3 门,且不得自称 pipeline", async () => {
    await hub.close();
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    server = createServer();
    hub = new VoiceHub(server, silentLog, { verifyUpgrade: () => ({ ok: true, via: "mobile_lan" }) });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const addr = server.address();
    if (typeof addr === "object" && addr) port = addr.port;
    await expect(connect("pipeline")).rejects.toThrow(/closed 4003/);
    const consoleWs = await connect("console");
    expect(hub.hasTailnetConsole()).toBe(true);
    expect(hub.peerCount("pipeline")).toBe(0);
    consoleWs.close();
  });
});

describe("role 消息类型白名单(评审 B8:防伪造)", () => {
  it("console 伪造 asr.final 被丢弃(不驱动 Brain / onAsrFinal 不触发)", async () => {
    const seen: string[] = [];
    hub.setEvents({ onAsrFinal: (m) => seen.push(m.text) });
    const console_ = await connect("console");
    const pipeline = await connect("pipeline");
    // console 发 asr.final(伪造)——应被白名单挡,pipeline 不应收到、onAsrFinal 不触发
    let pipelineGotAsr = false;
    pipeline.on("message", (d, b) => {
      if (b) return;
      try {
        if ((JSON.parse(String(d)) as { t?: string }).t === "asr.final") pipelineGotAsr = true;
      } catch { /* ignore */ }
    });
    console_.send(JSON.stringify({ t: "asr.final", sessionId: SES, turnId: newId("ses"), text: "伪造转写", confidence: 0.9 }));
    await new Promise((r) => setTimeout(r, 150));
    expect(seen).toEqual([]);
    expect(pipelineGotAsr).toBe(false);
    console_.close();
    pipeline.close();
  });

  it("pipeline 发 asr.final 正常放行(合法来源)", async () => {
    const console_ = await connect("console");
    const pipeline = await connect("pipeline");
    const wait = nextJson(console_, (m) => m["t"] === "asr.final");
    pipeline.send(JSON.stringify({ t: "asr.final", sessionId: SES, turnId: newId("ses"), text: "真转写", confidence: 0.9 }));
    expect((await wait)["text"]).toBe("真转写");
    console_.close();
    pipeline.close();
  });

  it("peer 发 tts.say 被丢弃(只许 daemon sendTtsSay;评审 B7)", async () => {
    const pipeline = await connect("pipeline");
    const console_ = await connect("console");
    let consoleGot = false;
    console_.on("message", (d, b) => {
      if (b) return;
      try {
        if ((JSON.parse(String(d)) as { t?: string }).t === "tts.say") consoleGot = true;
      } catch { /* ignore */ }
    });
    // pipeline 伪造 tts.say —— 不在 pipeline 白名单,丢弃
    pipeline.send(JSON.stringify({ t: "tts.say", sessionId: SES, sentenceId: "x", text: "伪造播报", interruptible: true }));
    await new Promise((r) => setTimeout(r, 150));
    expect(consoleGot).toBe(false);
    pipeline.close();
    console_.close();
  });
});

describe("RA-closeout · 手动档 holdForConfirm(10 §3-7 采完不直发;dogfood 修复 2026-07-28)", () => {
  it("console 发 done_speaking+holdForConfirm:pipeline 收到剥离版(照常 finalize);onTurnSignal 收到带标记原文", async () => {
    const signals: unknown[] = [];
    hub.setEvents({ onTurnSignal: (m) => signals.push(m) });
    const pipeline = await connect("pipeline");
    const console_ = await connect("console");
    const pipelineGot: unknown[] = [];
    pipeline.on("message", (d: Buffer) => pipelineGot.push(JSON.parse(d.toString())));
    console_.send(JSON.stringify({ t: "turn.done_speaking", sessionId: SES, holdForConfirm: true }));
    await new Promise((r) => setTimeout(r, 150));
    const fwd = pipelineGot.find((m) => (m as { t: string }).t === "turn.done_speaking") as Record<string, unknown>;
    expect(fwd).toBeTruthy(); // pipeline 收到轮次边界(finalize 依赖)
    expect("holdForConfirm" in fwd).toBe(false); // 标记剥离,python 零感知
    const sig = signals.find((m) => (m as { t: string }).t === "turn.done_speaking") as Record<string, unknown>;
    expect(sig["holdForConfirm"]).toBe(true); // daemon 钩子拿到标记(index.ts 据此挡 Brain)
    pipeline.close();
    console_.close();
  });
});

describe("dogfood 冻结尸检回修(2026-07-28):死链诚实化", () => {
  it("pipeline peer 掉线 ⇒ console 立即收到 health down(不再陈旧 asr=ok)", async () => {
    const pipeline = await connect("pipeline");
    const console_ = await connect("console");
    const consoleGot: Record<string, unknown>[] = [];
    console_.on("message", (d: Buffer) => consoleGot.push(JSON.parse(d.toString()) as Record<string, unknown>));
    pipeline.close();
    await new Promise((r) => setTimeout(r, 200));
    const down = consoleGot.find((m) => m["t"] === "pipeline.health");
    expect(down).toBeTruthy();
    expect(down?.["asr"]).toBe("down");
    console_.close();
  });

  it("mic 上行零 pipeline peer ⇒ 帧被丢且留告警日志(不再静默音频黑洞)", async () => {
    const warns: string[] = [];
    const logCapture: Logger = { ...silentLog, warn: (msg: string) => void warns.push(msg), child: () => logCapture };
    await hub.close();
    hub = new VoiceHub(server, logCapture);
    const console_ = await connect("console");
    const frame = Buffer.alloc(3205);
    frame[0] = 0x01;
    console_.send(frame);
    await new Promise((r) => setTimeout(r, 150));
    expect(warns.some((w) => w.includes("no pipeline peer"))).toBe(true);
    console_.close();
  });
});
