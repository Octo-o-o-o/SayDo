// ASR 全链冒烟(1.2 补完验收;需 VOLC_APP_ID/VOLC_ACCESS_TOKEN + daemon + pipeline 已起):
// 假 console 连 hub -> 发真实语料 PCM(0x01 帧)-> turn.done_speaking -> 断言 asr.final 返回。
// 用法:先起 daemon 与 pipeline,然后 node e2e/smoke/asr-loop.mjs <16k-mono-wav 路径>
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { WebSocket } from "ws";

const wavPath = process.argv[2] ?? "/tmp/asr-wav/a01.wav";
// G1(4.1):读 cap token 带 ?token= 连 daemon
const tokPath = join(homedir(), ".saydo", ".cap-token");
const tok = existsSync(tokPath) ? readFileSync(tokPath, "utf8").trim() : "";
const ws = new WebSocket(`ws://127.0.0.1:47100/ws/voice${tok ? `?token=${tok}` : ""}`);
const pcm = readFileSync(wavPath).subarray(44); // 剥 RIFF 头(16k mono pcm16le)
const t0 = Date.now();
let done = false;

ws.on("open", () => ws.send(JSON.stringify({ v: 1, role: "console" })));
ws.on("message", (data, isBinary) => {
  if (isBinary) return;
  let msg;
  try { msg = JSON.parse(data.toString()); } catch { return; }
  if (msg.t === "hello.ack") {
    let seq = 0;
    for (let off = 0; off < pcm.length; off += 640) {
      const chunk = pcm.subarray(off, Math.min(off + 640, pcm.length));
      const frame = Buffer.alloc(5 + chunk.length);
      frame[0] = 0x01;
      frame.writeUInt32BE(seq++, 1);
      chunk.copy(frame, 5);
      ws.send(frame);
    }
    ws.send(JSON.stringify({ t: "turn.done_speaking", sessionId: "ses_01JD9WYX00000000000000000A" }));
    console.log(`sent ${seq} frames (${pcm.length}B pcm), waiting asr.final...`);
  }
  if (msg.t === "asr.final") {
    done = true;
    console.log(`ASR_FINAL +${Date.now() - t0}ms turnId=${msg.turnId}`);
    console.log(`TEXT: ${msg.text}`);
    process.exit(0);
  }
});
setTimeout(() => { if (!done) { console.log("TIMEOUT no asr.final"); process.exit(1); } }, 25000);
