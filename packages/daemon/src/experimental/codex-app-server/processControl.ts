import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { StdioLink } from "./link.js";
import { APP_SERVER_ARGV, PINNED_CODEX_CLI_VERSION } from "./provenance.js";

export interface VersionText {
  stdout: string;
  stderr: string;
}

export function parseCodexCliVersion(text: VersionText): { ok: true; version: string } | { ok: false; reason: string } {
  const matches = [...`${text.stdout}\n${text.stderr}`.matchAll(/^codex-cli (\d+\.\d+\.\d+)\s*$/gm)].map((match) => match[1] ?? "");
  const unique = [...new Set(matches.filter((item) => item !== ""))];
  if (unique.length === 0) return { ok: false, reason: "version_missing" };
  if (unique.length !== 1 || unique[0] !== PINNED_CODEX_CLI_VERSION) return { ok: false, reason: "version_mismatch" };
  return { ok: true, version: unique[0] };
}

export function readCodexVersion(bin: string, timeoutMs: number): VersionText {
  const result = spawnSync(bin, ["--version"], {
    encoding: "utf8",
    timeout: timeoutMs,
    windowsHide: true
  });
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

export interface KillTarget {
  pid: number;
  exited(): boolean;
  wait(ms: number): Promise<{ code: number | null; signal: NodeJS.Signals | null } | null>;
}

export async function terminateOwnedProcess(
  target: KillTarget,
  opts: { termMs: number; killMs: number }
): Promise<{ sigkill: boolean; exitCode: number | null; signal: NodeJS.Signals | null }> {
  if (!Number.isInteger(target.pid) || target.pid <= 1 || target.pid === process.pid) {
    throw new Error("refuse_kill_unowned");
  }
  if (target.exited()) {
    const done = await target.wait(1);
    return { sigkill: false, exitCode: done?.code ?? null, signal: done?.signal ?? null };
  }
  signalOwned(target.pid, "SIGTERM");
  const first = await target.wait(opts.termMs);
  if (first) return { sigkill: false, exitCode: first.code, signal: first.signal };
  signalOwned(target.pid, "SIGKILL");
  const second = await target.wait(opts.killMs);
  return { sigkill: true, exitCode: second?.code ?? null, signal: second?.signal ?? null };
}

function destroyQuiet(stream: { destroyed: boolean; destroy: () => void } | null | undefined): void {
  if (!stream || stream.destroyed) return;
  try {
    stream.destroy();
  } catch {
    // 流已经结束
  }
}

function signalOwned(pid: number, signal: NodeJS.Signals): void {
  if (process.platform === "win32") {
    try {
      process.kill(pid, signal);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
    return;
  }
  try {
    process.kill(-pid, signal);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ESRCH") return;
    try {
      process.kill(pid, signal);
    } catch (inner) {
      if ((inner as NodeJS.ErrnoException).code !== "ESRCH") throw inner;
    }
  }
}

export interface SpawnedAppServer {
  link: StdioLink;
  pid: number;
  cwd: string;
  cleanup(): void;
}

export function spawnAppServer(bin: string): SpawnedAppServer {
  const cwd = mkdtempSync(join(tmpdir(), "saydo-codex-as-spike-"));
  const child = spawn(bin, [...APP_SERVER_ARGV], {
    cwd,
    detached: true,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
    env: process.env
  });
  let exited = false;
  let exitCode: number | null = null;
  let exitSignal: NodeJS.Signals | null = null;
  const waiters: Array<(result: { code: number | null; signal: NodeJS.Signals | null }) => void> = [];
  const noteExit = (code: number | null, signal: NodeJS.Signals | null): void => {
    if (exited) return;
    exited = true;
    exitCode = code;
    exitSignal = signal;
    const result = { code, signal };
    for (const waiter of waiters.splice(0)) waiter(result);
  };
  child.on("error", () => {
    noteExit(null, null);
    destroyQuiet(child.stdin);
    destroyQuiet(child.stdout);
    destroyQuiet(child.stderr);
  });
  child.on("exit", (code, signal) => {
    noteExit(code, signal);
  });
  if (!child.pid || !child.stdin || !child.stdout || !child.stderr) {
    rmSync(cwd, { recursive: true, force: true });
    throw new Error("spawn_failed");
  }
  const pid = child.pid;
  const wait = (ms: number) => {
    if (exited) return Promise.resolve({ code: exitCode, signal: exitSignal });
    return new Promise<{ code: number | null; signal: NodeJS.Signals | null } | null>((resolve) => {
      const timer = setTimeout(() => {
        const index = waiters.indexOf(onExit);
        if (index >= 0) waiters.splice(index, 1);
        resolve(exited ? { code: exitCode, signal: exitSignal } : null);
      }, ms);
      const onExit = (result: { code: number | null; signal: NodeJS.Signals | null }) => {
        clearTimeout(timer);
        resolve(result);
      };
      waiters.push(onExit);
    });
  };
  const link: StdioLink = {
    stdin: child.stdin,
    stdout: child.stdout,
    stderr: child.stderr,
    onExit(listener) {
      if (exited) listener(exitCode, exitSignal);
      else waiters.push((result) => listener(result.code, result.signal));
    },
    terminate: (opts) => terminateOwnedProcess({ pid, exited: () => exited, wait }, { termMs: opts.termMs, killMs: opts.termMs })
  };
  return {
    link,
    pid,
    cwd,
    cleanup() {
      rmSync(cwd, { recursive: true, force: true });
    }
  };
}
