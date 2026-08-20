// doubao seed-tts-2.0 v3 双向流式客户端(spike 版;协议移植自 owner repo-demo-recorder
// scripts/add-tts-narration.mjs,07 D5 指定的复用来源;砍掉录屏混音,加首包延迟统计)。

import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";

const MSG_TYPE = { FullClientRequest: 0b0001, FullServerResponse: 0b1001, AudioOnlyServer: 0b1011, Error: 0b1111 };
const FLAG = { NoSeq: 0, PositiveSeq: 0b1, NegativeSeq: 0b11, WithEvent: 0b100 };
const EVENT = {
  StartConnection: 1,
  FinishConnection: 2,
  ConnectionStarted: 50,
  ConnectionFailed: 51,
  ConnectionFinished: 52,
  StartSession: 100,
  FinishSession: 102,
  SessionStarted: 150,
  SessionFinished: 152,
  SessionFailed: 153,
  TaskRequest: 200,
  TTSSentenceStart: 350,
  TTSSentenceEnd: 351,
  TTSResponse: 352
};

const writeInt32 = (v) => { const b = Buffer.alloc(4); b.writeInt32BE(v); return b; };
const writeUInt32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32BE(v); return b; };
const writeString = (v) => { const b = Buffer.from(v || "", "utf8"); return Buffer.concat([writeUInt32(b.length), b]); };
const skipSession = (e) => [EVENT.StartConnection, EVENT.FinishConnection, EVENT.ConnectionStarted, EVENT.ConnectionFailed, EVENT.ConnectionFinished].includes(e);

function encode({ event, sessionId = "", payload = "{}" }) {
  const pb = Buffer.from(payload, "utf8");
  const chunks = [Buffer.from([0x11, (MSG_TYPE.FullClientRequest << 4) | FLAG.WithEvent, 0x10, 0x00]), writeInt32(event)];
  if (!skipSession(event)) chunks.push(writeString(sessionId));
  chunks.push(writeUInt32(pb.length), pb);
  return Buffer.concat(chunks);
}

function decode(data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const headerSize = (buf[0] & 0x0f) * 4;
  const type = buf[1] >> 4;
  const flag = buf[1] & 0x0f;
  let off = headerSize;
  const readInt32 = () => { const v = buf.readInt32BE(off); off += 4; return v; };
  const readUInt32 = () => { const v = buf.readUInt32BE(off); off += 4; return v; };
  const readStr = () => { const n = readUInt32(); const v = buf.subarray(off, off + n).toString("utf8"); off += n; return v; };
  if ([MSG_TYPE.FullClientRequest, MSG_TYPE.FullServerResponse, MSG_TYPE.AudioOnlyServer].includes(type)) {
    if (flag === FLAG.PositiveSeq || flag === FLAG.NegativeSeq) readInt32();
  } else if (type === MSG_TYPE.Error) {
    readUInt32();
  }
  let event = 0;
  if (flag === FLAG.WithEvent) {
    event = readInt32();
    if (!skipSession(event)) readStr();
    if ([EVENT.ConnectionStarted, EVENT.ConnectionFailed, EVENT.ConnectionFinished].includes(event)) readStr();
  }
  const payloadSize = off + 4 <= buf.length ? readUInt32() : 0;
  const payload = payloadSize > 0 ? buf.subarray(off, off + payloadSize) : Buffer.alloc(0);
  return { type, event, payload };
}

/**
 * 合成一句(每句独立连接;返回 mp3 Buffer + 首包延迟)。
 * speechRate:[-50, 100],0=正常。
 */
export async function synthesize(text, { apiKey, resourceId = "seed-tts-2.0", model = "seed-tts-2.0-expressive", voice = "zh_female_jitangmei_uranus_bigtts", sampleRate = 24000, speechRate = 0, endpoint = "wss://openspeech.bytedance.com/api/v3/tts/bidirection" }) {
  const ws = new WebSocket(endpoint, {
    headers: { "X-Api-Key": apiKey, "X-Api-Resource-Id": resourceId, "X-Api-Connect-Id": randomUUID() }
  });
  const queue = [];
  const waiters = [];
  let failed = null;
  ws.on("message", (d) => { const m = decode(d); const w = waiters.shift(); w ? w.resolve(m) : queue.push(m); });
  ws.on("error", (e) => { failed = e; while (waiters.length) waiters.shift().reject(e); });
  ws.on("close", () => { if (!failed) { failed = new Error("ws closed"); while (waiters.length) waiters.shift().reject(failed); } });
  const next = () => (queue.length ? Promise.resolve(queue.shift()) : failed ? Promise.reject(failed) : new Promise((res, rej) => waiters.push({ resolve: res, reject: rej })));
  await new Promise((res, rej) => { ws.once("open", res); ws.once("error", rej); });

  const sessionId = randomUUID();
  try {
    ws.send(encode({ event: EVENT.StartConnection }));
    for (;;) { const m = await next(); if (m.event === EVENT.ConnectionStarted) break; if (m.type === MSG_TYPE.Error || m.event === EVENT.ConnectionFailed) throw new Error("connect failed: " + m.payload.toString()); }
    ws.send(encode({
      event: EVENT.StartSession,
      sessionId,
      payload: JSON.stringify({
        req_params: {
          model,
          speaker: voice,
          audio_params: { format: "mp3", sample_rate: sampleRate, speech_rate: speechRate, enable_subtitle: false },
          additions: JSON.stringify({ disable_markdown_filter: true, explicit_language: "zh-cn" })
        }
      })
    }));
    for (;;) { const m = await next(); if (m.event === EVENT.SessionStarted) break; if (m.type === MSG_TYPE.Error || m.event === EVENT.SessionFailed) throw new Error("session failed: " + m.payload.toString()); }

    const t0 = Date.now();
    ws.send(encode({ event: EVENT.TaskRequest, sessionId, payload: JSON.stringify({ req_params: { text } }) }));
    ws.send(encode({ event: EVENT.FinishSession, sessionId }));

    const chunks = [];
    let firstPacketMs = -1;
    for (;;) {
      const m = await next();
      if (m.type === MSG_TYPE.Error || m.event === EVENT.SessionFailed) throw new Error("tts failed: " + m.payload.toString());
      if (m.event === EVENT.TTSResponse && m.type === MSG_TYPE.AudioOnlyServer) {
        if (firstPacketMs < 0) firstPacketMs = Date.now() - t0;
        chunks.push(m.payload);
      }
      if (m.event === EVENT.SessionFinished) break;
    }
    ws.send(encode({ event: EVENT.FinishConnection }));
    return { audio: Buffer.concat(chunks), firstPacketMs };
  } finally {
    try { ws.close(); } catch { /* noop */ }
  }
}
