import { existsSync } from "node:fs";
import { dirname } from "node:path";
import type { StdioLink } from "./link.js";
import { parseCodexCliVersion, readCodexVersion, spawnAppServer, type VersionText } from "./processControl.js";
import { APP_SERVER_ARGV, PINNED_CODEX_CLI_VERSION } from "./provenance.js";
import { redactText, userAgentVersions } from "./protocol.js";
import { openRealSession } from "./session.js";

export interface HandshakeReport {
  ok: boolean;
  modelExperiment: false;
  reason: string;
  pinnedVersion: string;
  cliVersionOk: boolean;
  spawned: boolean;
  initializeAcked: boolean;
  initializedSent: boolean;
  userAgentRedacted: string | null;
  platformFamily: string | null;
  platformOs: string | null;
  codexHomePresent: boolean;
  child: { exitCode: number | null; signal: NodeJS.Signals | null; sigkill: boolean } | null;
}

export interface SpawnSpec {
  bin: string;
  argv: readonly string[];
  cwd: string;
}

export interface SpawnedLink {
  link: StdioLink;
  pid: number;
  cleanup(): void;
}

export async function runHandshake(opts: {
  intentLogPath: string;
  bin?: string;
  timeoutMs?: number;
  termMs?: number;
  versionImpl?: (bin: string) => VersionText;
  spawnImpl?: (spec: SpawnSpec) => SpawnedLink;
}): Promise<HandshakeReport> {
  const bin = opts.bin ?? "codex";
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const termMs = opts.termMs ?? 2_000;
  const report: HandshakeReport = {
    ok: false,
    modelExperiment: false,
    reason: "not_started",
    pinnedVersion: PINNED_CODEX_CLI_VERSION,
    cliVersionOk: false,
    spawned: false,
    initializeAcked: false,
    initializedSent: false,
    userAgentRedacted: null,
    platformFamily: null,
    platformOs: null,
    codexHomePresent: false,
    child: null
  };
  if (!existsSync(dirname(opts.intentLogPath))) {
    return { ...report, reason: "intent_log_dir_missing" };
  }
  const version = parseCodexCliVersion(opts.versionImpl ? opts.versionImpl(bin) : readCodexVersion(bin, timeoutMs));
  if (!version.ok) return { ...report, reason: version.reason };
  report.cliVersionOk = true;
  const spawned = opts.spawnImpl ? opts.spawnImpl({ bin, argv: APP_SERVER_ARGV, cwd: "" }) : null;
  const real = spawned ? null : spawnAppServer(bin);
  const link = spawned?.link ?? real?.link;
  if (!link) return { ...report, reason: "spawn_failed" };
  report.spawned = true;
  const session = openRealSession({
    link,
    intentLogPath: opts.intentLogPath,
    runId: "handshake",
    permit: null,
    requestTimeoutMs: timeoutMs,
    termMs
  });
  try {
    const init = await session.initialize();
    if (init.status === "acked" && init.value) {
      const versions = userAgentVersions(init.value.userAgent);
      report.initializeAcked = true;
      report.initializedSent = session.snapshot().phase === "ready";
      report.userAgentRedacted = redactText(init.value.userAgent);
      report.platformFamily = init.value.platformFamily;
      report.platformOs = init.value.platformOs;
      report.codexHomePresent = init.value.codexHomePresent;
      const cliVersion = versions.length === 1 ? versions[0] : null;
      if (cliVersion !== PINNED_CODEX_CLI_VERSION) {
        report.reason = "user_agent_version_mismatch";
      } else if (!report.initializedSent) {
        report.reason = "initialized_not_sent";
      } else {
        report.ok = true;
        report.reason = "ok";
      }
    } else {
      report.reason = init.reason;
    }
  } catch (error) {
    report.reason = error instanceof Error ? error.name : "handshake_threw";
  } finally {
    const child = await session.shutdown();
    report.child = child;
    if (report.ok && child?.sigkill) {
      report.ok = false;
      report.reason = "child_sigkill";
    } else if (report.ok && child && child.exitCode !== null && child.exitCode !== 0 && child.signal === null) {
      report.ok = false;
      report.reason = "child_exit";
    }
    spawned?.cleanup();
    real?.cleanup();
  }
  return report;
}
