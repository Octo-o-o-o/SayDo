import { existsSync } from "node:fs";
import { dirname } from "node:path";
import type { SpawnedLink, SpawnSpec } from "./handshake.js";
import { parseCodexCliVersion, readCodexVersion, spawnAppServer, type VersionText } from "./processControl.js";
import { issueExperimentPermit, type ExperimentRequest } from "./permit.js";
import { APP_SERVER_ARGV } from "./provenance.js";
import { openRealSession } from "./session.js";

export interface ExperimentReport {
  ok: boolean;
  modelExperiment: boolean;
  reason: string;
  spawned: boolean;
  turnFrameWritten: boolean;
  textChars: number;
}

export async function runControlledExperiment(opts: ExperimentRequest & {
  taskId: string;
  text: string;
  intentLogPath: string;
  bin?: string;
  timeoutMs?: number;
  now?: number;
  versionImpl?: (bin: string) => VersionText;
  spawnImpl?: (spec: SpawnSpec) => SpawnedLink;
}): Promise<ExperimentReport> {
  const injected = opts.spawnImpl !== undefined || opts.versionImpl !== undefined;
  const now = opts.now ?? Date.now();
  const refused: ExperimentReport = {
    ok: false,
    modelExperiment: false,
    reason: "experiment_disabled",
    spawned: false,
    turnFrameWritten: false,
    textChars: opts.text.length
  };
  const permit = issueExperimentPermit(opts, now);
  if (!permit.ok) return { ...refused, reason: permit.reason };
  if (opts.taskId.trim() === "") return { ...refused, reason: "task_required" };
  if (opts.text.length === 0) return { ...refused, reason: "text_required" };
  if (!existsSync(dirname(opts.intentLogPath))) return { ...refused, reason: "intent_log_dir_missing" };
  const bin = opts.bin ?? "codex";
  const version = parseCodexCliVersion(opts.versionImpl ? opts.versionImpl(bin) : readCodexVersion(bin, opts.timeoutMs ?? 10_000));
  if (!version.ok) return { ...refused, reason: version.reason };
  const spawned = opts.spawnImpl ? opts.spawnImpl({ bin, argv: APP_SERVER_ARGV, cwd: "" }) : null;
  const real = spawned ? null : spawnAppServer(bin);
  const link = spawned?.link ?? real?.link;
  if (!link) return { ...refused, reason: "spawn_failed" };
  const session = openRealSession({
    link,
    intentLogPath: opts.intentLogPath,
    runId: "experiment",
    permit: permit.permit,
    requestTimeoutMs: opts.timeoutMs ?? 15_000,
    now: () => (opts.now !== undefined ? opts.now : Date.now())
  });
  const report: ExperimentReport = { ...refused, spawned: true, reason: "started" };
  try {
    const init = await session.initialize();
    if (init.status !== "acked") {
      report.reason = init.reason;
      return report;
    }
    const thread = await session.startThread({ taskId: opts.taskId, model: permit.permit.model });
    if (thread.status !== "acked" || !thread.value) {
      report.reason = thread.reason;
      return report;
    }
    const turn = await session.startTurn({ taskId: opts.taskId, threadId: thread.value.threadId, text: opts.text });
    report.turnFrameWritten = session.snapshot().realTurnFrames > 0;
    report.modelExperiment = !injected && report.turnFrameWritten;
    report.ok = turn.status === "acked";
    report.reason = turn.reason;
    return report;
  } catch {
    report.reason = "experiment_threw";
    return report;
  } finally {
    await session.shutdown();
    spawned?.cleanup();
    real?.cleanup();
  }
}
