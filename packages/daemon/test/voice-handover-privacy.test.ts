import { createServer } from "node:http";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { newId, type PipelineMsg } from "@saydo/contracts";
import { VoiceHub } from "../src/voice/hub.js";
import { createLogger } from "../src/obs/logger.js";

async function fixture(run: (hub: VoiceHub, logs: { human: string[]; dir: string; flush: () => Promise<void> }) => Promise<void>) {
  const dir = mkdtempSync(join(tmpdir(), "saydo-hub-private-test-"));
  const human: string[] = [];
  const logger = createLogger({ name: "hub-test", dir, stderrWrite: (line) => { human.push(line); } });
  const hub = new VoiceHub(createServer(), logger);
  try { await run(hub, { human, dir, flush: () => logger.flush() }); }
  finally { await hub.close(); rmSync(dir, { recursive: true, force: true }); }
}

function peer(id: string, sid?: string) {
  return { peerId: id, helloDone: true, role: "console", via: "local", sessionIds: new Set(sid ? [sid] : []),
    ws: { readyState: WebSocket.OPEN as number, send: () => {}, close: () => {} } };
}

describe("真实中枢函数的旧稿 ACK 与日志边界", () => {
  it("未登记 local peer 不能借 ACK 先登记并删除旧稿；合法接收者幂等确认", async () => {
    await fixture(async (hub) => {
      const sid = newId("ses"), requestId = newId("evt"), turnId = newId("ses");
      const good = peer(newId("evt"), sid), bad = peer(newId("evt"));
      const internal = hub as unknown as { peers: Set<unknown>; routeJson: (p: unknown, b: Buffer) => void };
      internal.peers.add(good); internal.peers.add(bad);
      const handover = (hub.barrier as unknown as { handover: Map<string, PipelineMsg> }).handover;
      const key = `${sid}:${requestId}:${turnId}`;
      handover.set(key, { t: "voice.quiesced_transcript", sessionId: sid, requestId, turnId, text: "旧稿", captureMode: "hands_free" });
      const ack = Buffer.from(JSON.stringify({ t: "voice.quiesced_transcript_ack", sessionId: sid, requestId, turnId }));
      internal.routeJson(bad, ack);
      expect(bad.sessionIds.size).toBe(0); expect(handover.has(key)).toBe(true);
      internal.routeJson(good, Buffer.from(JSON.stringify({ t: "voice.quiesced_transcript_ack", sessionId: newId("ses"), requestId, turnId })));
      expect(handover.has(key)).toBe(true);
      hub.barrier.ackHandover({ t: "voice.quiesced_transcript_ack", sessionId: sid, requestId, turnId }, bad.peerId);
      expect(handover.has(key)).toBe(true);
      good.ws.readyState = WebSocket.CLOSED;
      hub.barrier.ackHandover({ t: "voice.quiesced_transcript_ack", sessionId: sid, requestId, turnId }, good.peerId);
      expect(handover.has(key)).toBe(true); good.ws.readyState = WebSocket.OPEN;
      good.via = "mobile_lan";
      hub.barrier.ackHandover({ t: "voice.quiesced_transcript_ack", sessionId: sid, requestId, turnId }, good.peerId);
      expect(handover.has(key)).toBe(true); good.via = "local";
      internal.routeJson(good, ack); expect(handover.has(key)).toBe(false);
      internal.routeJson(good, ack); expect(handover.size).toBe(0);
    });
  });

  it("JSON 解析错误在真实 stderr 和 JSONL 出口只保摘要", async () => {
    await fixture(async (hub, logs) => {
      const bad = peer(newId("evt"));
      const internal = hub as unknown as { routeJson: (p: unknown, b: Buffer) => void };
      const canary = "SYNTHETIC_RAW_KEY_09";
      internal.routeJson(bad, Buffer.from(canary));
      await logs.flush();
      const machine = readdirSync(logs.dir).filter((name) => name.endsWith(".jsonl")).map((name) => readFileSync(join(logs.dir, name), "utf8")).join("");
      expect(logs.human.join(" ")).not.toContain(canary); expect(machine).not.toContain(canary);
      expect(machine).toContain("errorDigest"); expect(machine).toContain("SyntaxError");
    });
  });
});
