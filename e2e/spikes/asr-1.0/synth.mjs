// 1.0 步骤一:TTS 合成种子语料(60 条;前 40 常速、后 20 提速 25%)+ 首包延迟统计(D5 调参顺做)。
// 用法:node synth.mjs(读 ~/.saydo/.env 的 DOUBAO_TTS_API_KEY;产物 audio/<id>.mp3 + synth-report.json)

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CORPUS } from "./corpus.mjs";
import { synthesize } from "./doubao-tts.mjs";

const DIR = dirname(fileURLToPath(import.meta.url));
const AUDIO = join(DIR, "audio");
mkdirSync(AUDIO, { recursive: true });

function envKey(name) {
  const envText = readFileSync(join(homedir(), ".saydo", ".env"), "utf8");
  const m = envText.match(new RegExp(`^${name}=(.+)$`, "m"));
  if (!m) throw new Error(`missing ${name} in ~/.saydo/.env`);
  // 截掉行尾注释与空白(.env 行形如 KEY=value   # 注释)
  return m[1].split("#")[0].trim();
}

const apiKey = envKey("DOUBAO_TTS_API_KEY");
const latencies = [];
const results = [];

for (const [i, cue] of CORPUS.entries()) {
  const speechRate = i < 40 ? 0 : 25; // 变速档:后 20 条提速(计划 1.0:变速/变噪)
  try {
    const { audio, firstPacketMs } = await synthesize(cue.text, { apiKey, speechRate });
    writeFileSync(join(AUDIO, `${cue.id}.mp3`), audio);
    latencies.push(firstPacketMs);
    results.push({ id: cue.id, bytes: audio.length, firstPacketMs, speechRate });
    process.stderr.write(`[ok] ${cue.id} ${audio.length}B first=${firstPacketMs}ms rate=${speechRate}\n`);
  } catch (err) {
    results.push({ id: cue.id, error: String(err) });
    process.stderr.write(`[fail] ${cue.id}: ${err}\n`);
  }
}

latencies.sort((a, b) => a - b);
const p = (q) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * q))] ?? -1;
const summary = {
  total: CORPUS.length,
  ok: results.filter((r) => !r.error).length,
  firstPacket: { p50: p(0.5), p90: p(0.9), max: latencies[latencies.length - 1] ?? -1 }
};
writeFileSync(join(DIR, "synth-report.json"), JSON.stringify({ summary, results }, null, 2));
process.stderr.write(`\nsummary ${JSON.stringify(summary)}\nSYNTH_DONE\n`);
