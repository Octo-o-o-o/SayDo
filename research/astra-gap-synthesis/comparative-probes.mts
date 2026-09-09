import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pipelineMsgSchema } from "../../packages/contracts/src/types/pipeline.ts";
import { parseCliOptions } from "../../packages/cli/src/options.ts";
import { LatencyCollector } from "../../packages/daemon/src/obs/latency.ts";

// 只调用纯解析器与内存收集器；不启动 daemon，不读取用户配置，不调用供应方。
const commands = ["up", "status", "open"].map((command) =>
  parseCliOptions([command, "--home", resolve("research/astra-gap-synthesis/unused-state")], {}).command
);
assert.deepEqual(commands, ["up", "status", "open"]);

const message = pipelineMsgSchema.safeParse({ t: "state.changed", kind: "task", id: "synthetic", revision: 1 });
assert.equal(message.success, false);

const collector = new LatencyCollector();
for (let i = 0; i < 20; i++) {
  const total = i < 16 ? 1000 : 10000;
  const values = [0, 100, 200, 300, total];
  const stages = ["vad_end", "asr_final", "llm_first_token", "tts_first_byte", "playout_start"] as const;
  stages.forEach((stage, index) => collector.record(`synthetic-${i}`, stage, values[index]!));
}
const report = collector.report();
assert.equal(report.totalP50, 1000);
assert.equal(report.totalP90, 10000);
assert.equal(report.slo.passPublish, true);

const daemon = readFileSync("packages/daemon/src/index.ts", "utf8");
const hub = readFileSync("packages/daemon/src/voice/hub.ts", "utf8");
const layout = readFileSync("packages/console/src/shell/Layout.tsx", "utf8");
const staticWiring = {
  collectorInstantiated: daemon.includes("const latencyCollector = new LatencyCollector()"),
  llmHookRegistered: daemon.includes('onLlmArrived: (turnId, atMs) => void latencyCollector.record(turnId, "llm_first_token", atMs)'),
  stageHookRegistered: daemon.includes("onLatencyStage: (msg) =>"),
  diagnosticReadPath: daemon.includes('pathname === "/dev/latency-report"'),
  existingUiEvents: hub.includes('"confirm.card" | "confirm.countdown" | "confirm.resolved" | "focus.entity"'),
  sidebarEntityInvalidation: layout.includes("[latestEntityId, loadSide]")
};
assert.ok(Object.values(staticWiring).every(Boolean));
console.log(JSON.stringify({
  scope: "pure-functions-and-source-presence-only",
  cliCommands: commands,
  proposedStateChangedAcceptedByCurrentSchema: message.success,
  syntheticLatency: { n: report.n, p50: report.totalP50, p90: report.totalP90, passPublish: report.slo.passPublish },
  staticWiring
}, null, 2));
