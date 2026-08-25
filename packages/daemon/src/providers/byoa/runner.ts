// BYOA 一发一收 spawn 运行器(无 Electron):prompt 走 stdin,持续 drain stdout/stderr。
// 安全底座:wall/idle 双 watchdog、总输出上限、AbortSignal、SIGTERM→3s→SIGKILL、网络失败至多重试一次。

import { randomUUID } from "node:crypto";
import { StringDecoder } from "node:string_decoder";
import type { CageArgv, CageProvider } from "./cage.js";
import {
  ProcessGroupLifecycleError,
  contaminateSharedLifecycle,
  inspectUntrustedPipeFailure,
  isProcessGroupLifecycleError,
  projectTrustedKillFailure,
  resetSharedLifecycleForTests,
  safeFailureText,
  sharedLifecycleContaminationError
} from "../../processGroupLifecycle.js";
import {
  RUNTIME_DRAIN_DEADLINE_MS,
  runtimeClearTimeout,
  runtimeCloseDeadlineMs,
  runtimeNow,
  runtimeProcessGroupState,
  runtimeSetTimeout,
  shouldIgnoreTerminatingPipeError,
  spawnRuntimeChild,
  type SpawnedRuntimeChild
} from "../../runtimeChildRegistry.js";

let byoaLifecycleContamination: ProcessGroupLifecycleError | null = null;

export function getByoaLifecycleContamination(): ProcessGroupLifecycleError | null {
  return byoaLifecycleContamination ?? sharedLifecycleContaminationError();
}

export function contaminateByoaLifecycle(err: unknown): ProcessGroupLifecycleError {
  const contamination = contaminateSharedLifecycle(err);
  byoaLifecycleContamination ??= contamination;
  return contamination;
}

export function resetByoaLifecycleForTests(): void {
  byoaLifecycleContamination = null;
  resetSharedLifecycleForTests();
}

export function assertByoaShutdownAllowsStopped(): void {
  const contamination = getByoaLifecycleContamination();
  if (contamination) throw contamination;
}

export const DEFAULT_WALL_TIMEOUT_MS = 120_000;
export const DEFAULT_IDLE_TIMEOUT_MS = 45_000;
export const DEFAULT_OUTPUT_LIMIT_BYTES = 512 * 1024;
export const DEFAULT_KILL_GRACE_MS = 3_000;

export interface SpawnTurnOptions {
  argv: CageArgv;
  prompt: string;
  signal?: AbortSignal;
  wallTimeoutMs?: number;
  idleTimeoutMs?: number;
  outputLimitBytes?: number;
  killGraceMs?: number;
  networkRetryLimit?: number;
  /** 流式安全裁决；返回原因即立刻 SIGTERM，且该次不得网络重试。 */
  onStdoutLine?: (line: string) => "tripwire" | "unknown_event" | "parse_error" | "family_mismatch" | undefined;
  /** provider 已识别为订阅限流时阻止通用网络重试，保持 fail-fast。 */
  stopNetworkRetry?: (result: SpawnAttemptResult) => boolean;
  /** 额外透传的 env(白名单;spawn env 默认剥离,只透传显式给定的)。 */
  passEnv?: Record<string, string | undefined>;
}

export interface SpawnAttemptResult {
  lines: string[];
  stderrTail: string;
  exitCode: number | null;
  timedOut: boolean;
  timeoutKind?: "wall" | "idle";
  aborted: boolean;
  outputLimitExceeded: boolean;
  spawnError?: string;
  pipeError?: { stream: "stdout" | "stderr" | "stdin"; code: string };
  pipeErrors?: Array<{ stream: "stdout" | "stderr" | "stdin"; code: string }>;
  lifecycleError?: "process_group_not_reaped";
  safetyStop?: "tripwire" | "unknown_event" | "parse_error" | "family_mismatch";
  /** 触发 safetyStop 的 stdout 行原文(截断/脱敏由调用方负责)。 */
  safetyStopLine?: string;
}

export interface SpawnTurnResult extends SpawnAttemptResult {
  attempts: number;
  attemptResults: SpawnAttemptResult[];
}

/** BYOA spawn env 白名单(09 §11-3):基础 PATH + 各 CLI 登录态目录;不透传 SayDo secrets。 */
export function buildSpawnEnv(passEnv: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  const base: NodeJS.ProcessEnv = {};
  for (const k of ["PATH", "USER", "SHELL", "LANG", "LC_ALL", "TMPDIR", "TEMP", "TMP", "USERPROFILE", "USERNAME", "HOMEDRIVE", "HOMEPATH", "APPDATA", "LOCALAPPDATA", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC"]) {
    if (process.env[k]) base[k] = process.env[k];
  }
  // 新家由 passEnv.HOME 覆盖为隔离目录;老家不传则沿用真实 HOME(本批不动)。
  const home = passEnv.HOME ?? process.env.HOME;
  if (home) base.HOME = home;
  for (const k of [
    "XDG_CONFIG_HOME",
    "XDG_DATA_HOME",
    "XDG_STATE_HOME",
    "XDG_CACHE_HOME",
    "CODEX_HOME",
    "CLAUDE_CONFIG_DIR",
    "CURSOR_AGENT_STORE_FILES_DIR",
    "CURSOR_AGENT_STORE_SHARED_PATHS"
  ]) {
    const v = passEnv[k] ?? (k.startsWith("XDG_") ? undefined : process.env[k]);
    if (v) base[k] = v;
  }
  for (const k of [
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
    "OPENAI_API_KEY",
    "OPENAI_BASE_URL",
    "COPILOT_GITHUB_TOKEN",
    "GH_TOKEN",
    "GITHUB_TOKEN"
  ]) {
    if (passEnv[k]) base[k] = passEnv[k];
  }
  return base;
}

function isRetryableNetworkFailure(result: SpawnAttemptResult): boolean {
  if (result.aborted || result.timedOut || result.outputLimitExceeded || result.safetyStop || result.spawnError || result.pipeError || result.lifecycleError) return false;
  if (result.exitCode === 0) return false;
  return /(?:network|connection|econnreset|econnrefused|socket|fetch failed|temporarily unavailable|retrying)/i.test(
    result.stderrTail
  );
}

async function runSpawnAttempt(opts: SpawnTurnOptions): Promise<SpawnAttemptResult> {
  if (opts.signal?.aborted) {
    return {
      lines: [],
      stderrTail: "",
      exitCode: null,
      timedOut: false,
      aborted: true,
      outputLimitExceeded: false
    };
  }

  const wallMs = opts.wallTimeoutMs ?? DEFAULT_WALL_TIMEOUT_MS;
  const idleMs = opts.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
  const outputLimit = opts.outputLimitBytes ?? DEFAULT_OUTPUT_LIMIT_BYTES;
  const killGraceMs = opts.killGraceMs ?? DEFAULT_KILL_GRACE_MS;

  return new Promise((resolve) => {
    const failSpawn = (err: unknown): void => {
      if (isProcessGroupLifecycleError(err)) {
        contaminateByoaLifecycle(err);
        resolve({
          lines: [],
          stderrTail: "",
          exitCode: null,
          timedOut: false,
          aborted: false,
          outputLimitExceeded: false,
          spawnError: safeFailureText(err),
          lifecycleError: "process_group_not_reaped"
        });
        return;
      }
      resolve({
        lines: [],
        stderrTail: "",
        exitCode: null,
        timedOut: false,
        aborted: false,
        outputLimitExceeded: false,
        spawnError: safeFailureText(err)
      });
    };
    let spawned: SpawnedRuntimeChild;
    try {
      spawned = spawnRuntimeChild(opts.argv.bin, opts.argv.args, {
        cwd: opts.argv.cwd,
        env: buildSpawnEnv(opts.passEnv),
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
        runId: randomUUID(),
        ...(opts.signal ? { signal: opts.signal } : {})
      }, "byoa");
    } catch (err) {
      failSpawn(err);
      return;
    }
    const { child, lease: childLease } = spawned;
    const signalCaptured = spawned.signal;
    if (!signalCaptured) {
      failSpawn(new ProcessGroupLifecycleError("runtime job identity missing"));
      return;
    }

    const lines: string[] = [];
    const stdoutDecoder = new StringDecoder("utf8");
    const stderrDecoder = new StringDecoder("utf8");
    let stdoutBuf = "";
    let stderrTail = "";
    let outputBytes = 0;
    let timedOut = false;
    let timeoutKind: "wall" | "idle" | undefined;
    let aborted = false;
    let outputLimitExceeded = false;
    let safetyStop: SpawnAttemptResult["safetyStop"];
    let safetyStopLine: string | undefined;
    let spawnError: string | undefined;
    let pipeError: SpawnAttemptResult["pipeError"];
    const pipeErrors: NonNullable<SpawnAttemptResult["pipeErrors"]> = [];
    const seenPipeProjected = new WeakSet<object>();
    let lifecycleError: SpawnAttemptResult["lifecycleError"];
    let settled = false;
    let stopping = false;
    let exiting = false;
    let wallTimer: NodeJS.Timeout | undefined;
    let wallArmTimer: NodeJS.Timeout | undefined;
    let idleTimer: NodeJS.Timeout | undefined;
    let killTimer: NodeJS.Timeout | undefined;
    let drainTimer: NodeJS.Timeout | undefined;
    let treeKillAt = 0;
    let treeKillSent = false;
    let closeDeadlineAt: number | undefined;

    const clearTimers = (): void => {
      runtimeClearTimeout(wallTimer);
      runtimeClearTimeout(wallArmTimer);
      runtimeClearTimeout(idleTimer);
      runtimeClearTimeout(killTimer);
      runtimeClearTimeout(drainTimer);
    };

    const killProcessTree = (signal: NodeJS.Signals): void => {
      try {
        signalCaptured(signal);
      } catch (err) {
        contaminateByoaLifecycle(projectTrustedKillFailure(signal, err, "primary"));
        lifecycleError = "process_group_not_reaped";
      }
    };

    const requestStop = (): void => {
      if (stopping) return;
      stopping = true;
      closeDeadlineAt ??= runtimeNow() + runtimeCloseDeadlineMs();
      try {
        child.stdin.end();
      } catch {
        // stdin 已关闭。
      }
      killProcessTree("SIGTERM");
      treeKillAt = runtimeNow() + killGraceMs;
      killTimer = runtimeSetTimeout(() => {
        if (settled) return;
        treeKillSent = true;
        killProcessTree("SIGKILL");
        armDrainWatch();
      }, killGraceMs);
    };

    const resetIdleTimer = (): void => {
      if (idleTimer) clearTimeout(idleTimer);
      if (idleMs <= 0 || settled || stopping) return;
      idleTimer = runtimeSetTimeout(() => {
        timedOut = true;
        timeoutKind = "idle";
        requestStop();
      }, idleMs);
    };

    const acceptOutput = (chunk: Buffer): boolean => {
      outputBytes += chunk.byteLength;
      if (outputBytes <= outputLimit) return true;
      outputLimitExceeded = true;
      requestStop();
      return false;
    };

    const onAbort = (): void => {
      aborted = true;
      requestStop();
    };
    opts.signal?.addEventListener("abort", onAbort, { once: true });

    child.stdout.on("data", (chunk: Buffer) => {
      if (safetyStop) return;
      resetIdleTimer();
      if (!acceptOutput(chunk)) return;
      stdoutBuf += stdoutDecoder.write(chunk);
      let nl: number;
      while ((nl = stdoutBuf.indexOf("\n")) >= 0) {
        const line = stdoutBuf.slice(0, nl);
        lines.push(line);
        stdoutBuf = stdoutBuf.slice(nl + 1);
        safetyStop = opts.onStdoutLine?.(line);
        if (safetyStop) {
          safetyStopLine = line;
          requestStop();
          return;
        }
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      resetIdleTimer();
      if (!acceptOutput(chunk)) return;
      stderrTail = (stderrTail + stderrDecoder.write(chunk)).slice(-64 * 1024);
    });
    const handlePipeError = (stream: "stdout" | "stderr" | "stdin", err: unknown): void => {
      try {
        const inspection = inspectUntrustedPipeFailure(err);
        if (shouldIgnoreTerminatingPipeError(inspection.trustedCode, stopping || exiting)) return;
        if (seenPipeProjected.has(inspection.projected)) return;
        seenPipeProjected.add(inspection.projected);
        const record = { stream, code: inspection.diagnostic.code };
        pipeErrors.push(record);
        pipeError ??= record;
        stderrTail = `${stderrTail}\n${stream} pipe failed:${inspection.diagnostic.code}`.slice(-64 * 1024);
        requestStop();
      } catch {
        const record = { stream, code: "unknown" as const };
        pipeErrors.push(record);
        pipeError ??= record;
        stderrTail = `${stderrTail}\n${stream} pipe failed:unknown`.slice(-64 * 1024);
        requestStop();
      }
    };
    child.stdout.on("error", (err: unknown) => handlePipeError("stdout", err));
    child.stderr.on("error", (err: unknown) => handlePipeError("stderr", err));
    child.stdin.on("error", (err: unknown) => handlePipeError("stdin", err));

    const finish = (exitCode: number | null): void => {
      if (settled) return;
      settled = true;
      clearTimers();
      opts.signal?.removeEventListener("abort", onAbort);
      if (!outputLimitExceeded) stdoutBuf += stdoutDecoder.end();
      stderrTail = (stderrTail + stderrDecoder.end()).slice(-64 * 1024);
      if (!outputLimitExceeded && stdoutBuf.trim()) {
        lines.push(stdoutBuf);
        safetyStop ??= opts.onStdoutLine?.(stdoutBuf);
        if (safetyStop && safetyStopLine === undefined) safetyStopLine = stdoutBuf;
      }
      const payload: SpawnAttemptResult = {
        lines,
        stderrTail,
        exitCode,
        timedOut,
        ...(timeoutKind ? { timeoutKind } : {}),
        aborted,
        outputLimitExceeded,
        ...(spawnError ? { spawnError } : {}),
        ...(pipeError ? { pipeError } : {}),
        ...(pipeErrors.length > 0 ? { pipeErrors } : {}),
        ...(lifecycleError ? { lifecycleError } : {}),
        ...(safetyStop ? { safetyStop } : {}),
        ...(safetyStopLine !== undefined ? { safetyStopLine } : {})
      };
      void childLease.release().then(
        () => resolve(payload),
        (err) => {
          contaminateByoaLifecycle(err);
          resolve({
            ...payload,
            exitCode: payload.exitCode === 0 ? 1 : payload.exitCode,
            lifecycleError: "process_group_not_reaped"
          });
        }
      );
    };

    let drainStartedAt = 0;
    let childClosed = false;
    let lastExitCode: number | null = null;
    const finishAfterTreeDrain = (exitCode: number | null): void => {
      lastExitCode = exitCode;
      if (!child.pid) {
        if (childClosed) finish(exitCode);
        return;
      }
      const groupState = runtimeProcessGroupState(child.pid);
      if (!drainStartedAt) drainStartedAt = runtimeNow();
      const expired = runtimeNow() - drainStartedAt >= RUNTIME_DRAIN_DEADLINE_MS;
      if (groupState === "gone" && childClosed) {
        finish(exitCode);
        return;
      }
      if (!childClosed && closeDeadlineAt !== undefined && runtimeNow() >= closeDeadlineAt) {
        killProcessTree("SIGKILL");
        treeKillSent = true;
        lifecycleError = "process_group_not_reaped";
        contaminateByoaLifecycle(new ProcessGroupLifecycleError(
          `byoa child close withheld:${String(child.pid)}`
        ));
        if (groupState === "gone" || expired) {
          finish(exitCode);
          return;
        }
      }
      if (expired) {
        lifecycleError = "process_group_not_reaped";
        contaminateByoaLifecycle(new ProcessGroupLifecycleError(
          groupState === "unknown"
            ? `byoa process group ${String(child.pid)} state unknown`
            : `byoa process group ${String(child.pid)} did not exit`
        ));
        finish(exitCode);
        return;
      }
      if (!treeKillAt) treeKillAt = runtimeNow() + killGraceMs;
      if (!treeKillSent && runtimeNow() >= treeKillAt) {
        treeKillSent = true;
        killProcessTree("SIGKILL");
      }
      drainTimer = runtimeSetTimeout(() => finishAfterTreeDrain(lastExitCode), groupState === "unknown" ? 50 : 10);
    };
    const armDrainWatch = (): void => {
      if (!drainStartedAt) drainStartedAt = runtimeNow();
      finishAfterTreeDrain(lastExitCode);
    };

    child.on("error", (err: unknown) => {
      spawnError = safeFailureText(err);
      if (!child.pid) {
        childClosed = true;
        finish(null);
        return;
      }
      requestStop();
    });
    // direct child 正常/异常退出时也收掉同组后代；否则 stdio=ignore 的孙进程会静默泄漏，
    // 继承 pipe 的孙进程则会让 close 永不抵达。
    child.on("exit", () => {
      exiting = true;
      closeDeadlineAt ??= runtimeNow() + runtimeCloseDeadlineMs();
      if (!stopping) requestStop();
    });
    child.on("close", (code) => {
      childClosed = true;
      finishAfterTreeDrain(code);
    });

    void childLease.establish()
      .then(() => {
        if (opts.signal?.aborted) {
          requestStop();
          return;
        }
        // arbitrary CLI 没有统一 ready frame；给目标进程一个有界启动窗安装信号处理，
        // 业务 walltime 从启动窗后计，避免只杀 wrapper 而目标尚未真正运行。
        wallArmTimer = runtimeSetTimeout(() => {
          wallTimer = runtimeSetTimeout(() => {
            timedOut = true;
            timeoutKind = "wall";
            requestStop();
          }, wallMs);
        }, 500);
        resetIdleTimer();
        try {
          child.stdin.end(opts.prompt);
        } catch (err) {
          spawnError = safeFailureText(err);
          requestStop();
        }
      })
      .catch((err: unknown) => {
        if (isProcessGroupLifecycleError(err)) {
          contaminateByoaLifecycle(err);
          lifecycleError = "process_group_not_reaped";
        } else {
          spawnError = safeFailureText(err);
        }
        requestStop();
      });
  });
}

export async function runSpawnTurn(opts: SpawnTurnOptions): Promise<SpawnTurnResult> {
  const retryLimit = opts.networkRetryLimit ?? 1;
  if (!Number.isInteger(retryLimit) || retryLimit < 0 || retryLimit > 1) {
    throw new Error("networkRetryLimit 只允许 0 或 1");
  }
  let attempt = 0;
  let result: SpawnAttemptResult;
  const attemptResults: SpawnAttemptResult[] = [];
  do {
    attempt++;
    result = await runSpawnAttempt(opts);
    attemptResults.push(result);
  } while (
    attempt <= retryLimit &&
    !opts.signal?.aborted &&
    isRetryableNetworkFailure(result) &&
    !opts.stopNetworkRetry?.(result)
  );
  return { ...result, attempts: attempt, attemptResults };
}

export class ByoaBusyError extends Error {
  readonly code = "busy";
}

interface Waiter {
  provider: CageProvider;
  resolve: (release: () => void) => void;
  reject: (error: Error) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
}

/** 默认 per-CLI=1、全局=2;有界 FIFO 队列，取消时会从队列移除。 */
export class ByoaConcurrencyLimiter {
  private readonly perCliLimit: number;
  private readonly globalLimit: number;
  private readonly maxQueue: number;
  private globalActive = 0;
  private readonly activeByProvider = new Map<CageProvider, number>();
  private readonly queue: Waiter[] = [];

  constructor(options: { perCliLimit?: number; globalLimit?: number; maxQueue?: number } = {}) {
    this.perCliLimit = options.perCliLimit ?? 1;
    this.globalLimit = options.globalLimit ?? 2;
    this.maxQueue = options.maxQueue ?? 32;
    if (!Number.isInteger(this.perCliLimit) || this.perCliLimit <= 0) throw new Error("perCliLimit 必须是正整数");
    if (!Number.isInteger(this.globalLimit) || this.globalLimit <= 0) throw new Error("globalLimit 必须是正整数");
    if (!Number.isInteger(this.maxQueue) || this.maxQueue < 0) throw new Error("maxQueue 必须是非负整数");
  }

  acquire(provider: CageProvider, signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) return Promise.reject(new DOMException("aborted", "AbortError"));
    if (this.canStart(provider) && this.queue.length === 0) return Promise.resolve(this.start(provider));
    if (this.queue.length >= this.maxQueue) return Promise.reject(new ByoaBusyError("BYOA 调用队列已满"));

    return new Promise((resolve, reject) => {
      const waiter: Waiter = { provider, resolve, reject, ...(signal ? { signal } : {}) };
      const onAbort = (): void => {
        const index = this.queue.indexOf(waiter);
        if (index >= 0) this.queue.splice(index, 1);
        reject(new DOMException("aborted", "AbortError"));
        this.drain();
      };
      waiter.onAbort = onAbort;
      signal?.addEventListener("abort", onAbort, { once: true });
      this.queue.push(waiter);
      this.drain();
    });
  }

  snapshot(): { globalActive: number; activeByProvider: Partial<Record<CageProvider, number>>; queued: number } {
    return {
      globalActive: this.globalActive,
      activeByProvider: Object.fromEntries(this.activeByProvider),
      queued: this.queue.length
    };
  }

  private canStart(provider: CageProvider): boolean {
    return this.globalActive < this.globalLimit && (this.activeByProvider.get(provider) ?? 0) < this.perCliLimit;
  }

  private start(provider: CageProvider): () => void {
    this.globalActive++;
    this.activeByProvider.set(provider, (this.activeByProvider.get(provider) ?? 0) + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.globalActive--;
      const next = (this.activeByProvider.get(provider) ?? 1) - 1;
      if (next === 0) this.activeByProvider.delete(provider);
      else this.activeByProvider.set(provider, next);
      this.drain();
    };
  }

  private drain(): void {
    for (let index = 0; index < this.queue.length && this.globalActive < this.globalLimit; ) {
      const waiter = this.queue[index]!;
      if (!this.canStart(waiter.provider)) {
        index++;
        continue;
      }
      this.queue.splice(index, 1);
      waiter.signal?.removeEventListener("abort", waiter.onAbort!);
      waiter.resolve(this.start(waiter.provider));
    }
  }
}

export const defaultByoaConcurrencyLimiter = new ByoaConcurrencyLimiter();
