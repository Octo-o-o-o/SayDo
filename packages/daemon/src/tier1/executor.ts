// Tier1 生产执行器(执行器批;计划 4.1 收口 + 09 §6.1/§9 + 04 §5.4 + HANDOFF §4 铁律)。
// 职责:认领 queued∧route=tier1 -> tier1_runs reserve(CAS)-> worktree 供给(凭据剥离 +
// setup --ignore-scripts)-> 起 cursor-agent(-p --force,worktree .cursor/hooks.json 回连审批 socket)
// -> 事件流消费(canary/熔断/observedModel)-> settle(verify 白名单冻结重校 -> Tier1SettleProof ->
// ready_for_review -> outbox)/ 失败与取消同链 -> §12-7 恢复。
// 安全承重(违反即 bug):
// - 门完整性:每条 shell 命令必经 gate(canary:tool_call 无对应门请求 ⇒ 立即终止,任务 failed);
// - 版本 pin:锁定二进制绝对路径 + 启动/首认领前版本断言(versionAsserted 闩,一次即可;cursor-agent
//   自更新只改 symlink,versions/<pinned>/ 下的副本即锁定副本——2026-07-25 本机实证 spike 后已自更新过一次);
// - fail-closed:无 verify 登记不 settle(转 blocked 叫人);verify 内容漂移 = Plan Delta 转 blocked;
//   observedModel 缺失/族不符 = 该 run 作废(09 §11 规则 2 cursor 严格档);
// - 同仓串行:同 project 一活跃 run;跨仓并行(P0 单执行器进程内)。

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createInterface, type Interface } from "node:readline";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  newId,
  textDigest,
  tier1SettleProofSchema,
  verifyPackageDigest,
  writingSettleProofSchema,
  writingSettleStructuralViolations,
  type AcceptanceCheck,
  type Adapter,
  type Tier1CancelProof,
  type Tier1SettleProof,
  type WritingSettleProof
} from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import type { Logger } from "../obs/logger.js";
import type { CallbackEngine } from "../callback/engine.js";
import { buildCursorHooksJson } from "./adapter.js";
import {
  execAgentFileSync,
  runtimeChildOwnerIdentity,
  runtimeClearTimeout,
  runtimeCloseDeadlineMs,
  runtimeDrainDeadlineMs,
  runtimeKillGraceMs,
  runtimeNow,
  runtimeProcessGroupState,
  runtimeSetTimeout,
  shouldIgnoreTerminatingPipeError,
  spawnRuntimeChild
} from "../runtimeChildRegistry.js";
import {
  confirmTier1RunNativeSession,
  insertTier1Run,
  nextAttempt,
  overwriteTier1RunNativeSession,
  setTier1RunNativeSession,
  transitionTask,
  transitionTier1Run,
  type Tier1RunRow
} from "../storage/dao/tasks.js";
import { readTaskMessages, settleCancel } from "./operations.js";
import { getPackage } from "../storage/dao/packages.js";
import { decideCommand, type GateDecision } from "./gate.js";
import { commandToEffect, matchesFrozenVerify } from "./cmdEffect.js";
import { fileToolToEffect, resolveFileToolPath } from "./fileToolEffect.js";
import { computeRisk, type EffectDescriptor, type RiskLevel } from "../policy/engine.js";
import { freezeVerify, precheckVerify, planDeltaCallback, verifyRunnerArgv, type FrozenVerify } from "./verifyFreeze.js";
import { readProjectExecConfig, type ProjectExecConfig } from "./projectConfig.js";
import { loadProjectConfig } from "../config/project.js";
import { bindLedgerRef, getActiveBindingForTask, tier1LedgerRef } from "../focus/binding.js";

/** C5:claim 事务内回填 ledgerRef(无 binding 则静默跳过) */
function bindLedgerRefIfPresent(db: Db, taskId: string, nowIso: string): void {
  if (!getActiveBindingForTask(db, taskId)) return;
  bindLedgerRef(db, taskId, tier1LedgerRef(taskId), { nowIso });
}
import type { ArtifactStore } from "../artifacts/store.js";
import { effectiveDevModelForAdapter, getProjectOverrides } from "../config/projectOverrides.js";
import { assertExactVersion } from "./validateConfig.js";
import { gatePaths, writeDataSurfaceAtomic, writeGateScriptAtomic, type GatePaths } from "./gateScript.js";
import { cursorBackend, isCursorShellToolCall } from "./backends/cursor.js";
import { CLAUDE_CLOSED_TOOLS, claudeBackend, claudeEnvOverrides } from "./backends/claude.js";
import type { Tier1Backend, Tier1Event } from "./backends/types.js";
import { classifyClaudeRunOutcome, isRateRejectStatus } from "./claudeOutcome.js";
import { recordTier1SubscriptionRun } from "../cost/ledger.js";
import { enqueueRateLimited } from "../providers/byoa/retryQueue.js";
import { checkRunAdapterConsistency } from "./resolveAdapter.js";
import { verifyClaudeIdentity } from "./claudeIdentity.js";
import { familyFromModelName } from "../config/family.js";
import type { RuntimeApprovalFlow } from "./approvalFlow.js";
import type { GateWireRequest, GateWireResponse } from "./gateServer.js";
import { hostKind, processBirthFromHandle, withHomeOwnerBoundary, writeDurableJson, type OwnerImmutableIdentity } from "@saydo/platform";
import { verifiedProjectWorkspace } from "../storage/dao/projects.js";
import { strippedAgentEnv } from "./agentEnv.js";
export { AGENT_ENV_ALLOWLIST, strippedAgentEnv } from "./agentEnv.js";
import {
  RESTART_RECOVERABLE_STATES,
  readOwnedAgentProcessStart,
  reapOwnedTier1Agent,
  releaseAgentOwnershipAfterDurable,
  isTier1RestartRecoverable,
  tier1RecoveryPrerequisite,
  type AgentOwnershipRecord,
  type OrphanAgentReapOutcome,
  type RestartCandidate
} from "./restartPolicy.js";
import { classifyActiveWork } from "./activeWorkClassifier.js";
import { readRegularWritingFile, readWritingTreeBlob } from "./writingArtifact.js";
import {
  ProcessGroupLifecycleError,
  appendLifecycleFailure,
  asProcessGroupLifecycleError,
  combineLifecycleFailureList,
  combinePipeBusinessFailures,
  contaminateSharedLifecycle,
  inspectUntrustedPipeFailure,
  isProcessGroupLifecycleError,
  invocationBusinessFailure,
  projectTrustedKillFailure,
  projectUnknownFailure,
  safeFailureText,
  settleWithLeaseRelease,
  type PipeFailureRecord
} from "../processGroupLifecycle.js";
import { raceWithMonotonicDeadline, TIER1_EMERGENCY_CLEANUP_DEADLINE_MS } from "../independentDeadline.js";

function latchSignalFailure(current: Error | undefined, err: unknown): Error {
  const typed = appendLifecycleFailure(undefined, err);
  contaminateSharedLifecycle(typed);
  return appendLifecycleFailure(current, typed);
}

function finalizeInvocationWait<T>(opts: {
  settled: boolean;
  markSettled: () => void;
  signalFailure: Error | undefined;
  business: Error | undefined;
  unreaped: ProcessGroupLifecycleError | undefined;
  resolved: T;
  resolve: (value: T) => void;
  reject: (err: Error) => void;
}): void {
  if (opts.settled) return;
  opts.markSettled();
  const lifecycleParts: unknown[] = [];
  if (opts.signalFailure) lifecycleParts.push(opts.signalFailure);
  if (opts.unreaped) lifecycleParts.push(opts.unreaped);
  if (lifecycleParts.length === 0) {
    opts.resolve(opts.resolved);
    return;
  }
  const parts = opts.business ? [opts.business, ...lifecycleParts] : lifecycleParts;
  opts.reject(combineLifecycleFailureList(parts));
}

const FILE_WRITE_TOOLS = new Set(["Write", "Edit", "NotebookEdit"]);

function fileReceiptCommand(tool: string, path: string, cwd: string): string {
  const resolved = resolveFileToolPath(path, cwd);
  const abs = "abs" in resolved ? resolved.abs : path;
  return `${tool} ${abs}`;
}

function wireReceiptCommand(req: GateWireRequest): string {
  if (!("kind" in req) || req.kind === "command") return req.command;
  if (req.kind === "file_write") return fileReceiptCommand(req.tool, req.path, req.cwd);
  return fileReceiptCommand("Read", req.path, req.cwd);
}

// ---------- 可注入进程层(测试 fake;真实现走 nodeSpawn) ----------

export type AgentTerminationCause = "exit" | "pipe_failed";

export interface AgentWaitResult {
  exitCode: number;
  terminationCause?: AgentTerminationCause;
}

export interface AgentProcessHandle {
  pid: number;
  /** 真实 detached agent 必须落 durable ownership；测试 fake 可省略。 */
  ownershipRequired?: boolean;
  /** wrapper 的不可复用 command token（ps 截断时作 identity 回退）。 */
  commandToken?: string;
  generation?: string;
  jobName?: string;
  processHandle?: unknown;
  /** 子进程已由 OS 接受；恢复 marker 至少等到这个边界后才可清。 */
  started?: Promise<void>;
  /** durable owner 原子发布后才允许 stream result 主动结束常驻 agent。 */
  ownershipEstablished?: () => void;
  /** NDJSON stdout 逐行回调(实现方保证行序);返回 exit 承诺 */
  onLine(cb: (line: string) => void): void;
  kill(): void;
  wait(): Promise<AgentWaitResult>;
  /** 有界 stderr 尾(≤64KB);测试 fake 可不实现 */
  stderrTail?(): string;
}

export interface AgentSpawner {
  /** 版本串(execFile <binary> --version);抛错 = 二进制不可用 */
  version(binary: string): string;
  spawn(i: {
    binary: string;
    model: string;
    prompt: string;
    cwd: string;
    env: Record<string, string>;
    runId: string;
    resumeChatId?: string;
    settingsJson?: string;
    sessionId?: string;
    maxTurns?: number;
  }): AgentProcessHandle;
}

/**
 * verify 执行 env(W5a 3.1-②;tier1-conformance §4 [warn] 清偿):比 agent env 更窄——
 * verify 跑的是 agent 可影响的仓内代码,不得继承真实 HOME(~/.ssh、~/.aws 等文件系统凭据面
 * 经 $HOME/~ 展开不可达)。HOME 指向任务专用空目录(每 run 一个,只建不删,破坏性动作零)。
 * 定向透传 COREPACK_HOME(pnpm 是 corepack shim,发行版缓存面非凭据面;不透传会触发重新下载
 * 或直接失败);未显式配置时指向真实 HOME 下缺省缓存路径——这是一条只读缓存目录,不开
 * 凭据可达性。诚实边界:绝对路径直读(/Users/<u>/.ssh)与出网仍不可挡,完整隔离 = P1
 * 容器/sandbox(与 config 冻结同族登记)。
 */
export const VERIFY_ENV_ALLOWLIST = ["PATH", "LANG", "LC_ALL", "LC_CTYPE", "TERM", "TMPDIR", "TEMP", "TMP", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC"] as const;

export function verifyEnv(source: NodeJS.ProcessEnv, isolatedHome: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of VERIFY_ENV_ALLOWLIST) {
    const v = source[k];
    if (v !== undefined) out[k] = v;
  }
  out.HOME = isolatedHome;
  if (process.platform === "win32") {
    out.USERPROFILE = isolatedHome;
    out.HOMEDRIVE = isolatedHome.slice(0, 2);
    out.HOMEPATH = isolatedHome.slice(2) || "\\";
    out.APPDATA = join(isolatedHome, "AppData", "Roaming");
    out.LOCALAPPDATA = join(isolatedHome, "AppData", "Local");
  }
  const realHome = source.HOME ?? source.USERPROFILE;
  const corepackHome = source.COREPACK_HOME ?? (realHome ? join(realHome, ".cache", "node", "corepack") : undefined);
  if (corepackHome !== undefined) out.COREPACK_HOME = corepackHome;
  return out;
}

/** stdout error 会被 readline.Interface 再 emit 一次；同一 identity 只诊断/收口一次。 */
export function bindAgentStdioPipeErrors(opts: {
  stdout: NodeJS.ReadableStream;
  stderr: NodeJS.ReadableStream;
  rl: Interface;
  isTerminating: () => boolean;
  onDiagnostic: (stream: "stdout" | "stderr", err: { code?: string; message: string }) => void;
  onPipeFailure: () => void;
}): void {
  const seen = new WeakSet<object>();
  const handle = (stream: "stdout" | "stderr", err: unknown): void => {
    try {
      const inspection = inspectUntrustedPipeFailure(err);
      if (seen.has(inspection.projected)) return;
      seen.add(inspection.projected);
      if (shouldIgnoreTerminatingPipeError(inspection.trustedCode, opts.isTerminating())) return;
      opts.onDiagnostic(stream, {
        code: inspection.diagnostic.code,
        message: inspection.diagnostic.message
      });
      opts.onPipeFailure();
    } catch {
      opts.onDiagnostic(stream, { code: "unknown", message: "pipe error" });
      opts.onPipeFailure();
    }
  };
  opts.stdout.on("error", (err: unknown) => handle("stdout", err));
  opts.stderr.on("error", (err: unknown) => handle("stderr", err));
  opts.rl.on("error", (err: unknown) => handle("stdout", err));
}

export function realAgentSpawner(backend: Tier1Backend = cursorBackend()): AgentSpawner {
  return {
    version(binary) {
      return execAgentFileSync(binary, ["--version"], { encoding: "utf8", timeout: 10_000 });
    },
    spawn(i) {
      // argv 由 backend 提供(cursor:`-p --force --trust --output-format stream-json`)
      const args = backend.buildArgv({
        model: i.model,
        prompt: i.prompt,
        ...(i.resumeChatId ? { resumeKey: i.resumeChatId } : {}),
        ...(i.sessionId ? { sessionId: i.sessionId } : {}),
        ...(i.settingsJson ? { settingsJson: i.settingsJson } : {}),
        ...(i.maxTurns !== undefined ? { maxTurns: i.maxTurns } : {})
      });
      const spawned = spawnRuntimeChild(i.binary, args, {
        cwd: i.cwd,
        env: i.env,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
        runId: i.runId
      }, "tier1:agent");
      const { child, lease: childLease } = spawned;
      const signalCaptured = spawned.signal;
      if (!signalCaptured) {
        throw new ProcessGroupLifecycleError("runtime job identity missing");
      }
      child.stdin.end();
      const rl = createInterface({ input: child.stdout });
      const lineCbs: ((line: string) => void)[] = [];
      const pendingLines: string[] = [];
      let settled = false;
      let finishing = false;
      let ownershipEstablished = false;
      let pendingResultExitCode: number | null = null;
      let escalationTimer: NodeJS.Timeout | undefined;
      let waitExitTimer: NodeJS.Timeout | undefined;
      const STDERR_CAP = 64 * 1024;
      let stderrAcc = "";
      let resolveExit!: (v: AgentWaitResult) => void;
      let rejectExit!: (err: Error) => void;
      const exitP = new Promise<AgentWaitResult>((r, reject) => {
        resolveExit = r;
        rejectExit = reject;
      });
      const started = new Promise<void>((resolveStarted, rejectStarted) => {
        child.once("spawn", () => void childLease.establish().then(resolveStarted, rejectStarted));
        child.once("error", rejectStarted);
      });
      let childExited = false;
      let childClosed = false;
      let childExitCode: number | null = null;
      let pipeFailure = false;
      const pipeRecords: PipeFailureRecord[] = [];
      let signalFailure: Error | undefined;
      let drainDeadlineAt: number | undefined;
      let closeDeadlineAt: number | undefined;
      let drainTimer: NodeJS.Timeout | undefined;
      const signalTree = (signal: NodeJS.Signals): void => {
        try {
          signalCaptured(signal);
        } catch (err) {
          signalFailure = latchSignalFailure(signalFailure, projectTrustedKillFailure(signal, err, "primary"));
        }
      };
      const hardKill = (): void => signalTree("SIGKILL");
      const isTerminating = (): boolean =>
        childExited ||
        pendingResultExitCode !== null ||
        finishing ||
        settled ||
        escalationTimer !== undefined ||
        waitExitTimer !== undefined;
      const knownBusiness = (): Error | undefined => {
        if (pipeRecords.length > 0) return combinePipeBusinessFailures(pipeRecords);
        return invocationBusinessFailure({
          exitCode: childExitCode ?? 1,
          terminationCause: "exit",
          knownExit: childExitCode !== null || pendingResultExitCode !== null || finishing
        });
      };
      const finishWait = (unreaped?: ProcessGroupLifecycleError): void => {
        const resolved: AgentWaitResult = {
          exitCode: pipeFailure ? 1 : (childExitCode ?? 1),
          ...(pipeFailure ? { terminationCause: "pipe_failed" as const } : { terminationCause: "exit" as const })
        };
        finalizeInvocationWait({
          settled,
          markSettled: () => {
            settled = true;
            runtimeClearTimeout(escalationTimer);
            runtimeClearTimeout(waitExitTimer);
            runtimeClearTimeout(drainTimer);
          },
          signalFailure,
          business: knownBusiness(),
          unreaped,
          resolved,
          resolve: resolveExit,
          reject: rejectExit
        });
      };
      const failLifecycle = (state: ReturnType<typeof runtimeProcessGroupState>): void => {
        finishWait(new ProcessGroupLifecycleError(
          state === "unknown"
            ? `agent process group ${String(child.pid)} state unknown`
            : `agent process group ${String(child.pid)} did not exit`
        ));
      };
      const trySettle = (): void => {
        if (settled) return;
        const state = child.pid ? runtimeProcessGroupState(child.pid) : "gone";
        if (childClosed && state === "gone") {
          finishWait();
          return;
        }
        if (!childClosed && closeDeadlineAt !== undefined && runtimeNow() >= closeDeadlineAt) {
          hardKill();
          drainDeadlineAt ??= runtimeNow() + runtimeDrainDeadlineMs();
          failLifecycle(state);
          return;
        }
        if (drainDeadlineAt !== undefined && runtimeNow() >= drainDeadlineAt) {
          hardKill();
          failLifecycle(state);
          return;
        }
        runtimeClearTimeout(drainTimer);
        drainTimer = runtimeSetTimeout(trySettle, 10);
      };
      const armDrainDeadline = (): void => {
        drainDeadlineAt ??= runtimeNow() + runtimeDrainDeadlineMs();
        trySettle();
      };
      const armWaitExitThenKill = (): void => {
        if (waitExitTimer || settled || finishing) return;
        waitExitTimer = runtimeSetTimeout(() => {
          if (settled) return;
          signalTree("SIGTERM");
          if (!escalationTimer) {
            escalationTimer = runtimeSetTimeout(() => {
              if (settled) return;
              hardKill();
              armDrainDeadline();
            }, runtimeKillGraceMs());
          }
        }, runtimeKillGraceMs());
      };
      const beginFinish = (exitCode: number): void => {
        if (settled || finishing) return;
        finishing = true;
        childExitCode ??= exitCode;
        runtimeClearTimeout(escalationTimer);
        runtimeClearTimeout(waitExitTimer);
        hardKill();
        armDrainDeadline();
      };
      const requestKill = (): void => {
        if (settled || finishing || escalationTimer) return;
        closeDeadlineAt ??= runtimeNow() + runtimeCloseDeadlineMs();
        signalTree("SIGTERM");
        escalationTimer = runtimeSetTimeout(() => {
          if (settled) return;
          hardKill();
          armDrainDeadline();
        }, runtimeKillGraceMs());
      };
      bindAgentStdioPipeErrors({
        stdout: child.stdout,
        stderr: child.stderr,
        rl,
        isTerminating,
        onDiagnostic: (stream, err) => {
          stderrAcc = `${stderrAcc}\n${stream} error:${err.code ?? "unknown"}:${err.message}`.slice(-STDERR_CAP);
          pipeRecords.push({ stream, code: err.code ?? "unknown" });
        },
        onPipeFailure: () => {
          pipeFailure = true;
          if (!isTerminating()) requestKill();
        }
      });
      rl.on("line", (l) => {
        if (lineCbs.length === 0) pendingLines.push(l);
        else for (const cb of lineCbs) cb(l);
        // result 事件 = 权威完成信号(stream-json 下进程可能不自退)
        if (backend.isTerminalResult(l)) {
          const parsed = backend.parseLine(l);
          const resultEv = parsed.find((e) => e.kind === "result");
          const resultExitCode = resultEv && resultEv.isError !== true ? 0 : 1;
          if (backend.finishPolicy === "kill_on_result") {
            if (ownershipEstablished) beginFinish(resultExitCode);
            else pendingResultExitCode = resultExitCode;
          } else {
            pendingResultExitCode = resultExitCode;
            if (ownershipEstablished) armWaitExitThenKill();
          }
        }
      });
      child.stderr.on("data", (chunk: Buffer | string) => {
        const s = typeof chunk === "string" ? chunk : chunk.toString("utf8");
        stderrAcc = (stderrAcc + s).slice(-STDERR_CAP);
      });
      child.on("exit", (code, signal) => {
        childExited = true;
        childExitCode ??= code ?? (signal ? 143 : 1);
        closeDeadlineAt ??= runtimeNow() + runtimeCloseDeadlineMs();
        armDrainDeadline();
      });
      child.on("close", () => {
        childClosed = true;
        trySettle();
      });
      child.on("error", () => beginFinish(127));
      const waited = settleWithLeaseRelease(exitP, () => childLease.release(), (value) => {
        if (pipeRecords.length > 0) return combinePipeBusinessFailures(pipeRecords);
        return invocationBusinessFailure({
          exitCode: value.exitCode,
          ...(value.terminationCause ? { terminationCause: value.terminationCause } : {}),
          knownExit: true
        });
      });
      void waited.catch(() => undefined);
      const captured = typeof spawned.generation === "object" ? spawned.generation : undefined;
      return {
        pid: child.pid ?? -1,
        ownershipRequired: true,
        commandToken: spawned.commandToken,
        ...(captured?.id ? { generation: captured.id } : {}),
        ...(captured?.jobName ? { jobName: captured.jobName } : {}),
        ...(captured?.processHandle !== undefined ? { processHandle: captured.processHandle } : {}),
        started,
        ownershipEstablished() {
          ownershipEstablished = true;
          if (pendingResultExitCode === null) return;
          if (backend.finishPolicy === "kill_on_result") {
            beginFinish(pendingResultExitCode);
          } else {
            armWaitExitThenKill();
          }
        },
        onLine(cb) {
          lineCbs.push(cb);
          for (const line of pendingLines.splice(0)) cb(line);
        },
        kill() {
          requestKill();
        },
        wait: () => waited,
        stderrTail: () => stderrAcc
      };
    }
  };
}

// ---------- 执行器 ----------

export interface ExecutorConfig {
  saydoHome: string;
  /** 锁定二进制绝对路径(versions/<pinned>/cursor-agent;裸名 PATH 解析不满足 pin 红线) */
  lockedBinary: string;
  /** 版本 pin 串(启动断言 actual.includes(pinned)) */
  pinnedVersion: string;
  model: string;
  adapter: Adapter;
  gateScriptPath: string;
  /** gate 活动入口期望内容(POSIX=gate.sh, win32=gate-cursor.mjs) */
  gateScriptExpected: string;
  /** win32 环回绑定文件;POSIX 不设 */
  gateBindPath?: string;
  gateBindExpected?: string;
  /** gate-claude.sh 路径;与 gate.sh 同目录,drift guard 两脚本集合(缺省不检=仅 cursor 既有测试) */
  gateClaudeScriptPath?: string;
  /** gate-claude.sh 期望内容;任一脚本不符 ⇒ 既有 fail-closed */
  gateClaudeScriptExpected?: string;
  /** claude `--max-turns`(缺省 200);cursor 忽略 */
  claudeMaxTurns?: number;
  hooksTimeoutSec?: number;
  verifyTimeoutMs?: number;
  protectedBranches?: readonly string[];
  receiptTimeoutSec?: () => number;
}

export interface ExecutorDeps {
  db: Db;
  audit: AuditSink;
  log: Logger;
  callbacks: CallbackEngine;
  approvals: RuntimeApprovalFlow;
  spawner: AgentSpawner;
  /** 缺省 cursor backend;W5.4-a B1-a 抽出,B1-b 再接 claude */
  backend?: Tier1Backend;
  cfg: ExecutorConfig;
  /** 产物库(W4 3.2 writing:成稿落 type="article" artifact,WritingSettleProof 绑其 id/version) */
  artifacts?: ArtifactStore;
  now?: () => Date;
  recoverAbort?: AbortSignal;
  onRecoverEntered?: () => void;
  onRecoverAttempt?: () => void;
  recoverHold?: Promise<void>;
  afterProvision?: () => void | Promise<void>;
}

interface FailureFinalizationIntent {
  kind: "failure";
  exitEvidence: string;
  taskState: "failed" | "blocked";
  spokenReason?: string;
  recordedAt: string;
  eventLine: number;
  observedModel?: string;
  observedModels?: string[];
  resultEvent?: Extract<Tier1Event, { kind: "result" }>;
}

interface ReviewFinalizationIntent {
  kind: "review";
  recordedAt: string;
  eventLine: number;
  observedModel: string;
  observedModels: string[];
  /** 成功终态的原始 result；新 marker 必写，旧 marker 恢复时从 eventLine 以内的 durable event 补回。 */
  resultEvent?: Extract<Tier1Event, { kind: "result" }>;
  /** writing settle 在产物落库前先固定引用，终态事务重试只复用同一份 article。 */
  writingArtifact?: {
    articleArtifactId: string;
    articleVersion: number;
    articlePath: string;
    articleDigest: string;
    treeSha: string;
  };
}

type PendingFinalizationIntent = FailureFinalizationIntent | ReviewFinalizationIntent;

function parsePendingFinalization(raw: unknown): PendingFinalizationIntent | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string" || raw.length === 0) throw new Error("finalize_pending_json must be a non-empty JSON string");
  const value = JSON.parse(raw) as Record<string, unknown>;
  if (typeof value !== "object" || value === null) {
    throw new Error("invalid finalize_pending_json");
  }
  const validCommon =
    typeof value["recordedAt"] === "string" &&
    value["recordedAt"].length > 0 &&
    (value["eventLine"] === undefined ||
      (typeof value["eventLine"] === "number" && Number.isSafeInteger(value["eventLine"]) && value["eventLine"] >= 0));
  if (!validCommon) throw new Error("invalid finalize_pending_json");
  if (value["kind"] === "review") {
    if (
      typeof value["observedModel"] !== "string" ||
      value["observedModel"].length === 0 ||
      !Array.isArray(value["observedModels"]) ||
      value["observedModels"].some((model) => typeof model !== "string" || model.length === 0) ||
      (value["resultEvent"] !== undefined &&
        (typeof value["resultEvent"] !== "object" || value["resultEvent"] === null ||
          (value["resultEvent"] as Record<string, unknown>)["kind"] !== "result")) ||
      (value["writingArtifact"] !== undefined &&
        (typeof value["writingArtifact"] !== "object" || value["writingArtifact"] === null ||
          typeof (value["writingArtifact"] as Record<string, unknown>)["articleArtifactId"] !== "string" ||
          !Number.isSafeInteger((value["writingArtifact"] as Record<string, unknown>)["articleVersion"]) ||
          (value["writingArtifact"] as Record<string, unknown>)["articleVersion"] !== 1 ||
          typeof (value["writingArtifact"] as Record<string, unknown>)["articlePath"] !== "string" ||
          typeof (value["writingArtifact"] as Record<string, unknown>)["articleDigest"] !== "string" ||
          typeof (value["writingArtifact"] as Record<string, unknown>)["treeSha"] !== "string"))
    ) {
      throw new Error("invalid finalize_pending_json");
    }
    return {
      kind: "review",
      recordedAt: value["recordedAt"] as string,
      eventLine: (value["eventLine"] as number | undefined) ?? 0,
      observedModel: value["observedModel"],
      observedModels: [...new Set(value["observedModels"] as string[])],
      ...(value["resultEvent"] !== undefined
        ? { resultEvent: value["resultEvent"] as Extract<Tier1Event, { kind: "result" }> }
        : {}),
      ...(value["writingArtifact"] !== undefined
        ? {
            writingArtifact: value["writingArtifact"] as NonNullable<ReviewFinalizationIntent["writingArtifact"]>
          }
        : {})
    };
  }
  // kind 缺失是 v5 旧 failure marker；恢复时按 failure 兼容读取。
  if (
    value["kind"] !== undefined &&
    value["kind"] !== "failure"
  ) {
    throw new Error("invalid finalize_pending_json");
  }
  if (
    typeof value["exitEvidence"] !== "string" ||
    value["exitEvidence"].length === 0 ||
    (value["taskState"] !== "failed" && value["taskState"] !== "blocked") ||
    (value["spokenReason"] !== undefined && typeof value["spokenReason"] !== "string") ||
    (value["observedModel"] !== undefined && typeof value["observedModel"] !== "string") ||
    (value["observedModels"] !== undefined &&
      (!Array.isArray(value["observedModels"]) ||
        value["observedModels"].some((model) => typeof model !== "string" || model.length === 0))) ||
    (value["resultEvent"] !== undefined &&
      (typeof value["resultEvent"] !== "object" || value["resultEvent"] === null ||
        (value["resultEvent"] as Record<string, unknown>)["kind"] !== "result"))
  ) {
    throw new Error("invalid finalize_pending_json");
  }
  return {
    kind: "failure",
    exitEvidence: value["exitEvidence"],
    taskState: value["taskState"],
    recordedAt: value["recordedAt"] as string,
    eventLine: (value["eventLine"] as number | undefined) ?? 0,
    ...(value["observedModel"] !== undefined ? { observedModel: value["observedModel"] as string } : {}),
    ...(value["observedModels"] !== undefined
      ? { observedModels: [...new Set(value["observedModels"] as string[])] }
      : {}),
    ...(value["resultEvent"] !== undefined
      ? { resultEvent: value["resultEvent"] as Extract<Tier1Event, { kind: "result" }> }
      : {}),
    ...(value["spokenReason"] !== undefined ? { spokenReason: value["spokenReason"] } : {})
  };
}

function eventLineFromCursor(raw: unknown): number {
  if (typeof raw !== "string") return 0;
  const matched = raw.match(/:line:(\d+)$/);
  if (!matched) return 0;
  const line = Number(matched[1]);
  return Number.isSafeInteger(line) ? line : 0;
}

interface ActiveRun {
  /** 本 run 创建时的 durable adapter；恢复漂移收口不得把旧 usage 记到新后端名下。 */
  adapter: "cursor" | "claude_code";
  runId: string;
  taskId: string;
  projectId: string;
  attempt: number;
  worktree: string;
  repoPath: string;
  taskTitle: string;
  packageDigest: string;
  packageRevision: number;
  dispatchTurnRef: string | null;
  budget: { walltimeActiveMin: number; maxTurns: number; maxCost: number };
  frozen: FrozenVerify[];
  registry: ProjectExecConfig["registry"];
  /** writing 窄版成稿文件相对路径(09 §6.1a;runAttempt 时从 project.toml 读入) */
  articlePath: string;
  /** 保护分支面(W1.3 项目层生产加载):全局 cfg ∪ project.toml [git].protected;
   *  消费经 contracts effectiveProtectedBranches 再并 ["main","master"] 缺省(只增不减) */
  protectedBranches: readonly string[];
  /** canary 计数对账(门完整性):shell tool_call started 事件数不得超过 gate 请求数。
   *  事件时序不保证 started 后于 hook 触发(流式 UI 事件可先发),故不做逐条 seq 配对——
   *  运行中"计数差连续两 tick(≤30s)存在"才 trip(容忍在途),进程退出后结算点硬检零容忍。 */
  shellStarted: number;
  canarySuspect: boolean;
  gateSeq: number;
  toolCalls: number;
  /** planned restart 前已经消耗的活跃墙钟，重启后继续累计。 */
  budgetActiveMs: number;
  startedMs: number;
  /** 审批/停靠期停表(三熔断律:活跃墙钟不含等人时间) */
  approvalWaitMs: number;
  approvalWaitingSince: number | null;
  /** 当前重叠等待深度;approvalWaitingSince 取并集窗口起点 */
  approvalWaitDepth: number;
  /** 同一 run 未决 S2:第二张直接 deny,不插播 */
  s2Pending: boolean;
  /** unknown/parse_error 行计数(进审计,执行档不作废) */
  unknownEventCount: number;
  /** events.jsonl 追加失败即停 agent；只允许已成功持久化的行推进 cursor/状态机。 */
  eventPersistenceError: string | null;
  eventLine: number;
  observedModel: string | null;
  resultText: string;
  terminalResultReceived: boolean;
  proc: AgentProcessHandle | null;
  completion: Promise<void> | null;
  /** prepareShutdown 已持久化 restart marker;进程退出不得进入失败结算。 */
  restartPending: boolean;
  /** 本轮 prepare 写入的 shutdown epoch；新代 marker 优先于旧 resume 清理。 */
  restartEpoch: number;
  /** 从 durable restart marker 恢复;只有新 agent 已 spawn 后才清 marker。 */
  resumeRestartMarker: boolean;
  /** 恢复开始时观察到的 marker epoch；仅可清同代或更旧 marker。 */
  resumeMarkerEpoch: number;
  expectedSessionIdentity: string | null;
  isResume: boolean;
  resumeSessionConfirmed: boolean;
  resumeSessionError: string | null;
  observedModels: Set<string>;
  gatedToolResults: number;
  toolUseById: Map<string, string>;
  rateLimitEvents: Array<{ status?: string; resetsAt?: number; rateLimitType?: string }>;
  resultEvent: Extract<Tier1Event, { kind: "result" }> | null;
  gateDenyCount: number;
  stderrTail: string;
  authViolation: boolean;
  resumeNotFoundRetryUsed: boolean;
  agentOwnershipEstablished: boolean;
  capturedAgentOwner?: OwnerImmutableIdentity;
  nativeResumeAudited: boolean;
  /** 进程组已明确 ESRCH；未验证前禁止写 processExited proof。 */
  processGroupVerifiedExited: boolean;
  terminationCause: AgentTerminationCause | null;
  /** 认领 barrier：owner+session 或 terminal/unrecoverable 后 resolve。 */
  claimReady: (() => void) | null;
  claimPromise: Promise<void> | null;
  /** W5a 3.5 本 run 生效模型 */
  model: string;
  /** 终局原因(canary/熔断/取消先到先得,settle 按此分链) */
  abort: { kind: "canary" | "budget" | "cancel" | "steer_resume"; detail: string } | null;
  /** 本 run 的 .cursor/hooks.json;provision 后才设,digest 补偿用 */
  hooksJsonPath: string | null;
  /** 终态事务写失败后的 durable 重试意图镜像;存在时保留 active 且拒绝新认领。 */
  pendingFinalization?: PendingFinalizationIntent;
}

function streamRuntimeFields(): Pick<
  ActiveRun,
  | "expectedSessionIdentity"
  | "isResume"
  | "observedModels"
  | "gatedToolResults"
  | "toolUseById"
  | "rateLimitEvents"
  | "resultEvent"
  | "gateDenyCount"
  | "stderrTail"
  | "authViolation"
  | "resumeNotFoundRetryUsed"
  | "eventPersistenceError"
> {
  return {
    expectedSessionIdentity: null,
    isResume: false,
    observedModels: new Set<string>(),
    gatedToolResults: 0,
    toolUseById: new Map<string, string>(),
    rateLimitEvents: [],
    resultEvent: null,
    gateDenyCount: 0,
    stderrTail: "",
    authViolation: false,
    resumeNotFoundRetryUsed: false,
    eventPersistenceError: null
  };
}

const binaryIdentityErrors = new WeakSet<object>();
const binaryIdentitySnapshots = new WeakMap<object, { code: string; text: string }>();

/** spawn 前二进制身份核验不通过(09 §11:不符 ⇒ binary_identity_mismatch 不认领) */
export class Tier1BinaryIdentityError extends Error {
  constructor(
    readonly code: string,
    detail: string
  ) {
    const text = `binary_identity_mismatch:${code} ${detail}`;
    super(text);
    this.name = "Tier1BinaryIdentityError";
    binaryIdentityErrors.add(this);
    binaryIdentitySnapshots.set(this, { code, text });
    try {
      Object.defineProperties(this, {
        code: { value: code, writable: false, configurable: false, enumerable: true },
        message: { value: text, writable: false, configurable: false, enumerable: false },
        name: { value: "Tier1BinaryIdentityError", writable: false, configurable: false, enumerable: false }
      });
      Object.freeze(this);
    } catch {
      // 冻结失败仍以私有快照为准。
    }
  }
}

export function isTier1BinaryIdentityError(err: unknown): err is Tier1BinaryIdentityError {
  return typeof err === "object" && err !== null && binaryIdentityErrors.has(err);
}

export async function publishAgentOwnerUnderHomeLock(home: string, ownerPath: string, record: unknown): Promise<void> {
  await withHomeOwnerBoundary(home, () => {
    const dirFsync = writeDurableJson(ownerPath, record);
    if (dirFsync !== "synced" && dirFsync !== "unsupported") {
      throw new Error("agent owner dir fsync result invalid");
    }
  });
}

/** 只读构造时私有快照；不读可变公开字段，不调用 getter。 */
export function brandedBinaryIdentityFailureText(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const snap = binaryIdentitySnapshots.get(err);
  return snap?.text;
}

const costLedgerErrors = new WeakSet<object>();
const reviewTransactionErrors = new WeakSet<object>();

/** 成本行是终态事务的一部分；写失败保留原 review/failure marker，等待同一 run 幂等重试。 */
class Tier1CostLedgerError extends Error {
  constructor(
    readonly runId: string,
    _cause: unknown
  ) {
    super(`tier1 cost ledger write failed:${runId}:unknown`);
    this.name = "Tier1CostLedgerError";
    costLedgerErrors.add(this);
  }
}

/** review settle 的原子终态事务失败；marker 保持 review，下一 tick 原样重试。 */
class Tier1ReviewTransactionError extends Error {
  constructor(
    readonly runId: string,
    readonly stage: "cost" | "terminal",
    _cause: unknown
  ) {
    super(`tier1 review transaction failed:${runId}:${stage}`);
    this.name = "Tier1ReviewTransactionError";
    reviewTransactionErrors.add(this);
  }
}

function isCostLedgerError(err: unknown): err is Tier1CostLedgerError {
  return typeof err === "object" && err !== null && costLedgerErrors.has(err);
}

function isReviewTransactionError(err: unknown): err is Tier1ReviewTransactionError {
  return typeof err === "object" && err !== null && reviewTransactionErrors.has(err);
}

/** catch 分类：内部品牌，不对 unknown 做 instanceof。 */
export function classifyTier1ReviewTransactionCatch(err: unknown): "cost" | "terminal" {
  return isCostLedgerError(err) ? "cost" : "terminal";
}

export function classifyTier1ReviewSettlementCatch(err: unknown): "cost" | "terminal" | "settlement" {
  return isReviewTransactionError(err) ? err.stage : "settlement";
}

export function tier1CostLedgerFailure(runId: string, cause: unknown): Error {
  return new Tier1CostLedgerError(runId, cause);
}

export function tier1ReviewTransactionFailure(
  runId: string,
  stage: "cost" | "terminal",
  cause: unknown
): Error {
  return new Tier1ReviewTransactionError(runId, stage, cause);
}

const ACTIVE_RUN_STATES = "('reserved','running','step_paused','cancel_requested')";

export class Tier1Executor {
  private readonly d: ExecutorDeps;
  private readonly backend: Tier1Backend;
  private readonly now: () => Date;
  private readonly active = new Map<string, ActiveRun>(); // runId -> ActiveRun
  private readonly reviewSettlements = new Map<string, Promise<void>>();
  private versionAsserted = false;
  private acceptingWork = true;
  /** 每次 prepareShutdown 递增；写入 marker 与 markRestartResumed 代际守卫。 */
  private shutdownEpoch = 0;
  /** 进程组未 ESRCH 时污染 lifecycle；prepare/stopped 必须 fatal。 */
  private lifecycleContaminated: ProcessGroupLifecycleError | null = null;

  constructor(deps: ExecutorDeps) {
    this.d = deps;
    this.backend = deps.backend ?? cursorBackend();
    this.now = deps.now ?? (() => new Date());
  }

  /** 供 daemon 在发送 stopped 前查询；非 null 时必须 fatal。 */
  lifecycleContamination(): ProcessGroupLifecycleError | null {
    return this.lifecycleContaminated;
  }

  private contaminateLifecycle(err: unknown): ProcessGroupLifecycleError {
    const typed = asProcessGroupLifecycleError(err);
    this.lifecycleContaminated ??= typed;
    contaminateSharedLifecycle(typed);
    this.d.audit.record({
      actor: "daemon",
      action: "tier1.process_group_lifecycle_contaminated",
      meta: { message: safeFailureText(this.lifecycleContaminated, 200) }
    });
    return this.lifecycleContaminated;
  }

  private resolveClaim(run: ActiveRun): void {
    const ready = run.claimReady;
    run.claimReady = null;
    ready?.();
  }

  // ---------- 版本 pin(红线:锁定副本 + 启动断言;升级走重跑门禁仪式) ----------

  assertVersion(): void {
    // W2 阶段0-②(Codex 20 B2):精确相等替换 includes()——子串包含会放过 "<pinned>-dirty" 类漂移
    assertExactVersion(this.d.spawner.version(this.d.cfg.lockedBinary), this.d.cfg.pinnedVersion);
    this.versionAsserted = true;
  }

  // ---------- gate 决策链(gateServer handler;fail-closed) ----------

  private expectedHooksJson(): string {
    return buildCursorHooksJson(this.d.cfg.gateScriptPath, this.d.cfg.hooksTimeoutSec ?? 120);
  }

  private gateIntegritySurfaces(): { path: string; expected: string }[] {
    const out: { path: string; expected: string }[] = [
      { path: this.d.cfg.gateScriptPath, expected: this.d.cfg.gateScriptExpected }
    ];
    const claudeScriptPath = this.d.cfg.gateClaudeScriptPath;
    const claudeScriptExpected = this.d.cfg.gateClaudeScriptExpected;
    if (claudeScriptPath && claudeScriptExpected !== undefined) {
      out.push({ path: claudeScriptPath, expected: claudeScriptExpected });
    }
    const bindPath = this.d.cfg.gateBindPath;
    const bindExpected = this.d.cfg.gateBindExpected;
    if (bindPath && bindExpected !== undefined) {
      out.push({ path: bindPath, expected: bindExpected });
    }
    const hooksExpected = this.expectedHooksJson();
    for (const run of this.active.values()) {
      if (run.hooksJsonPath) out.push({ path: run.hooksJsonPath, expected: hooksExpected });
    }
    return out;
  }

  /**
   * W2 阶段0-①(Codex 20 A1;Codex 88 扩活动入口):每收 gate 请求重读当前 backend 实际入口
   * 以及 hooks.json / gate-bind.json。任一漂移 ⇒ 审计 + 终止全部活跃 run + 自愈重写 + 本请求 deny。
   */
  /**
   * 自愈未收口锁存(评审 92 C-1):win32 上 `restrictOwnerOnly` 可能抛(ACL 收紧或 readback 失败),
   * 此时 rename 已完成、内容已正确 ⇒ 下一次 drift guard 只比内容就会判"无漂移"放行,
   * 而那个文件的 owner-only DACL 其实没恢复。锁存后持续 fail-closed,直到某次自愈整体成功。
   */
  private gateSelfHealPending = new Set<string>();

  private gateScriptDriftGuard(): boolean {
    const surfaces = this.gateIntegritySurfaces();
    const drifted: { path: string; expected: string; actual: string | null }[] = [];
    for (const surface of surfaces) {
      let actual: string | null;
      try {
        actual = readFileSync(surface.path, "utf8");
      } catch {
        actual = null; // 读不出(被删/权限)同样按漂移处置,fail-closed
      }
      if (actual !== surface.expected) drifted.push({ ...surface, actual });
    }
    // 上轮自愈没收口的面:即便内容已对也必须继续按漂移处置(ACL 未恢复)
    if (drifted.length === 0 && this.gateSelfHealPending.size > 0) {
      for (const surface of surfaces) {
        if (this.gateSelfHealPending.has(surface.path)) {
          drifted.push({ ...surface, actual: surface.expected });
        }
      }
    }
    if (drifted.length === 0) return false;
    for (const d of drifted) {
      this.d.audit.record({
        actor: "daemon",
        action: "tier1.gate_script_drift",
        meta: {
          expectedDigest: textDigest(d.expected),
          actualDigest: d.actual === null ? "unreadable" : textDigest(d.actual),
          activeRuns: this.active.size,
          script: basename(d.path),
          path: d.path.slice(-120)
        }
      });
    }
    for (const run of this.active.values()) {
      if (run.abort) continue;
      run.abort = { kind: "canary", detail: "gate_script_drift" };
      run.proc?.kill();
    }
    for (const surface of drifted) {
      try {
        // 自愈重写(与启动时 ensureGateScript 同语义;原子 tmp+rename)。
        // 评审 90 C-1:只有门脚本本体走 writeGateScriptAtomic(它固定 chmod 0755);
        // hooks.json / gate-bind.json 是 JSON 数据面,用 0600 原子写,别把数据文件改成可执行。
        const isScript =
          surface.path === this.d.cfg.gateScriptPath || surface.path === this.d.cfg.gateClaudeScriptPath;
        if (isScript) {
          writeGateScriptAtomic(surface.path, surface.expected);
        } else {
          writeDataSurfaceAtomic(surface.path, surface.expected);
        }
        this.gateSelfHealPending.delete(surface.path);
      } catch (err) {
        // 评审 92 C-1:失败必须锁存。rename 可能已成功而 ACL 收紧失败,
        // 只比内容的下一轮会误判"已无漂移"并放行一个 DACL 没恢复的门文件。
        this.gateSelfHealPending.add(surface.path);
        this.d.audit.record({
          actor: "daemon",
          action: "tier1.gate_self_heal_failed",
          meta: { script: basename(surface.path), path: surface.path.slice(-120), error: safeFailureText(err, 160) }
        });
        this.d.log.error("gate integrity self-heal failed", {
          path: surface.path.slice(-120),
          error: safeFailureText(err, 160)
        });
      }
    }
    return true;
  }

  async handleGateRequest(req: GateWireRequest): Promise<GateWireResponse> {
    if (this.gateScriptDriftGuard()) {
      return { permission: "deny", agent_message: "SayDo gate: gate script integrity check failed (fail-closed)" };
    }
    const run = this.findRunByCwd(req.cwd);
    if (!run) {
      this.d.audit.record({
        actor: "daemon",
        action: "tier1.gate_unmatched_deny",
        meta: { cwd: req.cwd.slice(0, 120), commandDigest: textDigest(wireReceiptCommand(req)) }
      });
      return { permission: "deny", agent_message: "SayDo gate: no active run matches this worktree (fail-closed)" };
    }
    if (this.effectEligibilityDenial(run) !== null) {
      return { permission: "deny", agent_message: "SayDo gate: durable run state no longer permits effects" };
    }
    if ("kind" in req && req.kind === "file_write") return this.handleFileWriteGate(run, req);
    if ("kind" in req && req.kind === "file_read") return this.handleFileReadGate(run, req);
    const command = "command" in req ? req.command : "";
    return this.handleCommandGate(run, command, "kind" in req && req.kind === "command" ? "command" : undefined);
  }

  /** 每次 effect 放行前都现读 durable 状态；异步审批返回后必须再次调用，不能复用等待前快照。 */
  private effectEligibilityDenial(run: ActiveRun): string | null {
    const task = this.d.db.prepare("SELECT status FROM tasks WHERE id=?").get(run.taskId) as { status: string } | undefined;
    const durable = this.d.db
      .prepare("SELECT state, finalize_pending_json, restart_pending_at FROM tier1_runs WHERE id=?")
      .get(run.runId) as
      | { state: string; finalize_pending_json: string | null; restart_pending_at: string | null }
      | undefined;
    let reason: string | null = null;
    if (!task || !durable) reason = "durable_target_missing";
    else if (task.status === "cancel_requested" || task.status === "cancel_settled") {
      run.abort = { kind: "cancel", detail: "durable cancel observed by gate" };
      reason = `task_${task.status}`;
    } else if (durable.state === "cancel_requested") {
      run.abort = { kind: "steer_resume", detail: "durable steer observed by gate" };
      reason = "run_cancel_requested";
    } else if (task.status !== "running") reason = `task_${task.status}`;
    else if (!["reserved", "running", "step_paused"].includes(durable.state)) reason = `run_${durable.state}`;
    else if (durable.finalize_pending_json !== null || run.pendingFinalization) reason = "finalization_pending";
    else if (durable.restart_pending_at !== null || run.restartPending) {
      run.restartPending = true;
      reason = "restart_pending";
    } else if (run.abort) reason = `abort_${run.abort.kind}`;
    if (reason !== null) run.proc?.kill();
    return reason;
  }

  private beginApprovalWait(run: ActiveRun): void {
    run.approvalWaitDepth += 1;
    if (run.approvalWaitingSince === null) run.approvalWaitingSince = Date.now();
  }

  private endApprovalWait(run: ActiveRun): void {
    run.approvalWaitDepth = Math.max(0, run.approvalWaitDepth - 1);
    if (run.approvalWaitDepth === 0 && run.approvalWaitingSince !== null) {
      run.approvalWaitMs += Date.now() - run.approvalWaitingSince;
      run.approvalWaitingSince = null;
    }
  }

  private riskOf(effect: EffectDescriptor, run: ActiveRun): RiskLevel {
    try {
      return computeRisk(effect, { protectedBranches: run.protectedBranches }).level;
    } catch {
      return "S3";
    }
  }

  private denyConcurrentS2(
    run: ActiveRun,
    seq: number,
    command: string,
    effect: EffectDescriptor,
    extra?: { tool?: string; kind?: string }
  ): GateWireResponse {
    this.d.audit.record({
      actor: "daemon",
      action: "tier1.gate_decision",
      meta: {
        taskId: run.taskId,
        runId: run.runId,
        seq,
        risk: "S2",
        permission: "deny",
        effectKind: effect.kind,
        commandDigest: textDigest(command),
        reason: "concurrent_s2",
        ...(extra?.kind ? { kind: extra.kind } : {}),
        ...(extra?.tool ? { tool: extra.tool } : {})
      }
    });
    return { permission: "deny", agent_message: "SayDo gate: 等待审批结果后再试" };
  }

  private async decideForRun(
    run: ActiveRun,
    seq: number,
    command: string,
    effect: EffectDescriptor
  ): Promise<GateDecision> {
    return decideCommand(
      { taskId: run.taskId, seq, command, effect },
      {
        registry: run.registry,
        protectedBranches: run.protectedBranches,
        stepConfirm: (gateReq, risk) =>
          this.d.approvals.request({
            taskId: run.taskId,
            runId: run.runId,
            seq: gateReq.seq,
            command: gateReq.command,
            effect: gateReq.effect,
            risk,
            taskTitle: run.taskTitle,
            packageDigest: run.packageDigest,
            dispatchTurnRef: run.dispatchTurnRef
          }),
        approvalTimeoutMs: ((this.d.cfg.receiptTimeoutSec?.() ?? 45) + 5) * 1000
      }
    );
  }

  private async handleCommandGate(
    run: ActiveRun,
    command: string,
    wireKind?: "command"
  ): Promise<GateWireResponse> {
    const seq = ++run.gateSeq;
    const effect = matchesFrozenVerify(command, run.frozen.map((f) => f.argv))
      ? ({ kind: "run_registered_verify" } as const)
      : commandToEffect(command);
    const risk = this.riskOf(effect, run);
    if (risk === "S2" && run.s2Pending) {
      run.gateDenyCount++;
    return this.denyConcurrentS2(run, seq, command, effect, wireKind ? { kind: wireKind } : undefined);
    }
    if (risk === "S2") run.s2Pending = true;
    this.beginApprovalWait(run);
    let decision: GateDecision;
    try {
      decision = await this.decideForRun(run, seq, command, effect);
    } finally {
      if (risk === "S2") run.s2Pending = false;
      this.endApprovalWait(run);
    }
    const revoked = decision.permission === "allow" ? this.effectEligibilityDenial(run) : null;
    if (revoked !== null) {
      run.gateDenyCount++;
      this.d.audit.record({
        actor: "daemon",
        action: "tier1.gate_decision",
        meta: {
          taskId: run.taskId,
          runId: run.runId,
          seq,
          risk: decision.risk,
          permission: "deny",
          effectKind: effect.kind,
          commandDigest: textDigest(command),
          reason: `approval_revoked:${revoked}`,
          ...(wireKind ? { kind: wireKind } : {})
        }
      });
      return { permission: "deny", agent_message: "SayDo gate: approval expired because the durable run state changed" };
    }
    this.d.audit.record({
      actor: "daemon",
      action: "tier1.gate_decision",
      meta: {
        taskId: run.taskId,
        runId: run.runId,
        seq,
        risk: decision.risk,
        permission: decision.permission,
        effectKind: effect.kind,
        commandDigest: textDigest(command),
        ...(wireKind ? { kind: wireKind } : {})
      }
    });
    if (decision.permission === "allow") return { permission: "allow" };
    run.gateDenyCount++;
    const suggestion = this.d.approvals.consumeEditSuggestion(run.taskId, seq);
    if (suggestion) {
      return {
        permission: "deny",
        agent_message: `SayDo gate: 用户修改了这条命令并预批了修改版;请改用(原样执行):${suggestion}`
      };
    }
    return { permission: "deny", agent_message: `SayDo gate denied (${decision.risk}): ${decision.reason}` };
  }

  private async handleFileWriteGate(
    run: ActiveRun,
    req: Extract<GateWireRequest, { kind: "file_write" }>
  ): Promise<GateWireResponse> {
    const command = fileReceiptCommand(req.tool, req.path, req.cwd);
    if (!FILE_WRITE_TOOLS.has(req.tool)) {
      const seq = ++run.gateSeq;
      run.gateDenyCount++;
      this.d.audit.record({
        actor: "daemon",
        action: "tier1.gate_decision",
        meta: {
          taskId: run.taskId,
          runId: run.runId,
          seq,
          risk: "S3",
          permission: "deny",
          effectKind: "delete_data",
          commandDigest: textDigest(command),
          kind: "file_write",
          tool: req.tool
        }
      });
      return { permission: "deny", agent_message: "SayDo gate denied (S3): tool not on write face (fail-closed)" };
    }
    const effect = fileToolToEffect(req.tool, req.path, req.cwd, run.worktree);
    if (effect.kind !== "write_worktree") {
      const seq = ++run.gateSeq;
      run.gateDenyCount++;
      this.d.audit.record({
        actor: "daemon",
        action: "tier1.gate_decision",
        meta: {
          taskId: run.taskId,
          runId: run.runId,
          seq,
          risk: "S3",
          permission: "deny",
          effectKind: effect.kind,
          commandDigest: textDigest(command),
          kind: "file_write",
          tool: req.tool
        }
      });
      return { permission: "deny", agent_message: "SayDo gate denied (S3): write outside worktree or unresolvable" };
    }
    if (effect.touchesSensitiveData) {
      const resolved = resolveFileToolPath(req.path, req.cwd);
      const abs = "abs" in resolved ? resolved.abs : req.path;
      effect.target = basename(abs.replace(/\\/g, "/"));
    }
    const risk = this.riskOf(effect, run);
    const seq = ++run.gateSeq;
    if (risk === "S2" && run.s2Pending) {
      run.gateDenyCount++;
      return this.denyConcurrentS2(run, seq, command, effect, { kind: "file_write", tool: req.tool });
    }
    if (risk === "S2") run.s2Pending = true;
    this.beginApprovalWait(run);
    let decision: GateDecision;
    try {
      decision = await this.decideForRun(run, seq, command, effect);
    } finally {
      if (risk === "S2") run.s2Pending = false;
      this.endApprovalWait(run);
    }
    const revoked = decision.permission === "allow" ? this.effectEligibilityDenial(run) : null;
    if (revoked !== null) {
      run.gateDenyCount++;
      this.d.audit.record({
        actor: "daemon",
        action: "tier1.gate_decision",
        meta: {
          taskId: run.taskId,
          runId: run.runId,
          seq,
          risk: decision.risk,
          permission: "deny",
          effectKind: effect.kind,
          commandDigest: textDigest(command),
          reason: `approval_revoked:${revoked}`,
          kind: "file_write",
          tool: req.tool
        }
      });
      return { permission: "deny", agent_message: "SayDo gate: approval expired because the durable run state changed" };
    }
    this.d.audit.record({
      actor: "daemon",
      action: "tier1.gate_decision",
      meta: {
        taskId: run.taskId,
        runId: run.runId,
        seq,
        risk: decision.risk,
        permission: decision.permission,
        effectKind: effect.kind,
        commandDigest: textDigest(command),
        kind: "file_write",
        tool: req.tool
      }
    });
    if (decision.permission === "allow") return { permission: "allow" };
    run.gateDenyCount++;
    return { permission: "deny", agent_message: `SayDo gate denied (${decision.risk}): ${decision.reason}` };
  }

  private handleFileReadGate(
    run: ActiveRun,
    req: Extract<GateWireRequest, { kind: "file_read" }>
  ): GateWireResponse {
    const command = fileReceiptCommand("Read", req.path, req.cwd);
    const effect = fileToolToEffect("Read", req.path, req.cwd, run.worktree);
    const seq = ++run.gateSeq;
    if (effect.kind === "read") {
      this.d.audit.record({
        actor: "daemon",
        action: "tier1.gate_decision",
        meta: {
          taskId: run.taskId,
          runId: run.runId,
          seq,
          risk: "S0",
          permission: "no_decision",
          effectKind: "read",
          commandDigest: textDigest(command),
          kind: "file_read",
          tool: "Read"
        }
      });
      return { permission: "no_decision" };
    }
    run.gateDenyCount++;
    this.d.audit.record({
      actor: "daemon",
      action: "tier1.gate_decision",
      meta: {
        taskId: run.taskId,
        runId: run.runId,
        seq,
        risk: "S3",
        permission: "deny",
        effectKind: effect.kind,
        commandDigest: textDigest(command),
        kind: "file_read",
        tool: "Read"
      }
    });
    return { permission: "deny", agent_message: "SayDo gate denied (S3): read outside worktree (fail-closed)" };
  }

  /** cwd 匹配 run 的 worktree(含子目录);两侧 realpath 规范化——macOS /var↔/private/var
   *  symlink 会让 hook 上报的 cwd(内核规范化)与 mkdtemp 的 worktree 字面量不等,不规范化则
   *  gate 对所有 shell fail-closed deny(连 S0 都拦,是安全过严 bug 非漏洞) */
  private canon(p: string): string {
    try {
      return realpathSync(p);
    } catch {
      return p;
    }
  }

  private findRunByCwd(cwd: string): ActiveRun | null {
    const norm = this.canon(cwd);
    for (const run of this.active.values()) {
      const wt = this.canon(run.worktree);
      if (norm === wt || norm.startsWith(wt + sep)) return run;
    }
    return null;
  }

  // ---------- 主循环(index.ts 15s 定时器调用) ----------

  tick(): void {
    try {
      if (this.lifecycleContaminated) return;
      this.reapCancellations();
      this.retryPendingFinalizations();
      this.checkCanaries();
      this.enforceBudgets();
      if (this.acceptingWork && !this.hasPendingFinalization()) this.claimNext();
    } catch (err) {
      this.d.log.error("tier1 executor tick failed", { error: safeFailureText(err, 200) });
    }
  }

  private hasPendingFinalization(): boolean {
    return [...this.active.values()].some((run) => run.pendingFinalization !== undefined);
  }

  private retryPendingFinalizations(): void {
    for (const run of [...this.active.values()]) {
      const pending = run.pendingFinalization;
      if (!pending || run.proc) continue;
      if (this.settleCancellationPriority(run)) continue;
      if (pending.kind === "review") {
        void this.settlePendingReview(run);
      } else {
        this.finalizeFailure(run, pending.exitEvidence, pending.taskState, pending.spokenReason);
      }
    }
  }

  /** canary 巡检(门完整性):shell started 计数 > gate 请求计数,连续两 tick 存在 ⇒ 门被绕过,立即终止 */
  private checkCanaries(): void {
    for (const run of this.active.values()) {
      if (run.abort || run.restartPending || run.pendingFinalization) continue;
      if (this.backend.canaryLeft !== "shell_started") {
        if (run.gatedToolResults > run.gateSeq) {
          if (run.canarySuspect) {
            this.tripCanary(run, `tool_result=${run.gatedToolResults} > gate_requests=${run.gateSeq} (两tick确认)`);
          } else {
            run.canarySuspect = true;
          }
        } else {
          run.canarySuspect = false;
        }
        continue;
      }
      if (run.shellStarted > run.gateSeq) {
        if (run.canarySuspect) {
          this.tripCanary(run, `shell_started=${run.shellStarted} > gate_requests=${run.gateSeq} (两tick确认)`);
        } else {
          run.canarySuspect = true;
        }
      } else {
        run.canarySuspect = false;
      }
    }
  }

  private tripCanary(run: ActiveRun, detail: string): void {
    run.abort = { kind: "canary", detail };
    this.d.audit.record({
      actor: "daemon",
      action: "tier1.canary_tripped",
      meta: { taskId: run.taskId, runId: run.runId, detail }
    });
    run.proc?.kill();
  }

  /** 用户取消(cancelTask 已把 task/run 置 cancel_requested):终止进程,settle 走 exit 收尾。
   *  W5a 3.4:run 级 cancel_requested 而任务非 cancel_requested = steerTask 的 cancel_resume
   *  (运行中改需求):同样杀进程,但结算走 run 级(任务保持 running,认领循环带新指令重起)。 */
  private reapCancellations(): void {
    for (const run of this.active.values()) {
      if (run.restartPending) continue;
      const row = this.d.db.prepare("SELECT status FROM tasks WHERE id=?").get(run.taskId) as { status: string } | undefined;
      if (row?.status === "cancel_requested" || row?.status === "cancel_settled" || run.abort?.kind === "cancel") {
        run.abort = { kind: "cancel", detail: row?.status === "cancel_settled" ? "recover settled cancel" : "user cancel" };
        if (run.proc) run.proc.kill();
        else this.settleCancelledRun(run);
        continue;
      }
      const runRow = this.d.db.prepare("SELECT state FROM tier1_runs WHERE id=?").get(run.runId) as { state: string } | undefined;
      if (runRow?.state === "cancel_requested") {
        run.abort = { kind: "steer_resume", detail: "steer cancel_resume" };
        if (run.proc) run.proc.kill();
        else this.settleSteerResumeRun(run);
      }
    }
  }

  private activeBudgetMs(run: ActiveRun): number {
    const waiting = run.approvalWaitingSince !== null ? Date.now() - run.approvalWaitingSince : 0;
    return run.budgetActiveMs + Date.now() - run.startedMs - run.approvalWaitMs - waiting;
  }

  private checkpointBudget(run: ActiveRun): void {
    run.budgetActiveMs = Math.max(0, Math.round(this.activeBudgetMs(run)));
    run.startedMs = Date.now();
    run.approvalWaitMs = 0;
    run.approvalWaitingSince = null;
    run.approvalWaitDepth = 0;
    this.d.db
      .prepare("UPDATE tier1_runs SET budget_active_ms=?, budget_tool_calls=?, updated_at=? WHERE id=?")
      .run(run.budgetActiveMs, run.toolCalls, this.now().toISOString(), run.runId);
  }

  /** 周期巡检、prepare 和 settle 共用一个预算快照，避免退出窗口吞掉临界事实。 */
  private refreshBudgetAbort(run: ActiveRun): void {
    if (run.abort) return;
    const activeMs = this.activeBudgetMs(run);
    if (activeMs > run.budget.walltimeActiveMin * 60_000) {
      this.tripBudget(run, `walltime_active:${Math.round(activeMs / 1000)}s>${run.budget.walltimeActiveMin}min`);
      return;
    }
    if (run.toolCalls > run.budget.maxTurns) {
      this.tripBudget(run, `turns:${run.toolCalls}>${run.budget.maxTurns}`);
      return;
    }
    const spent = (
      this.d.db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM cost_entries WHERE task_id=? AND source='api'").get(run.taskId) as {
        s: number;
      }
    ).s;
    if (spent > run.budget.maxCost) this.tripBudget(run, `cost:${spent}>${run.budget.maxCost}`);
  }

  /** 三熔断(04 §5.4 不变量,任何档位不放宽):活跃墙钟(审批期停表)/ 回合 / 成本 */
  private enforceBudgets(): void {
    for (const run of this.active.values()) {
      if (run.abort || run.restartPending || run.pendingFinalization) continue;
      this.refreshBudgetAbort(run);
    }
  }

  private tripBudget(run: ActiveRun, detail: string): void {
    run.abort = { kind: "budget", detail };
    this.d.audit.record({
      actor: "daemon",
      action: "tier1.budget_tripped",
      meta: { taskId: run.taskId, runId: run.runId, detail }
    });
    run.proc?.kill();
  }

  /**
   * 认领(每 tick 至多一个,防风暴;同仓 projectId 串行):
   * - status=queued(初派发 / failed 重派发 retryTask);
   * - status=running 且无活跃 run(返工 request_changes / blocked 应答注入后的续跑——
   *   09 §9 attempt 规则:这些场景 = INSERT 新行 attempt+1;claim 事务里 task 转态与 run 插入
   *   原子,不存在"正认领中被误捞"窗口)。
   */
  private claimNext(): void {
    if (this.lifecycleContaminated) return;
    const row = this.d.db
      .prepare(
        `SELECT t.id, t.project_id, t.title, t.status, t.package_digest, t.package_rev, t.budget_json,
                p.workspace_json
         FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
         WHERE t.route='tier1'
           AND (t.status='queued'
                OR (t.status='running' AND NOT EXISTS (
                      SELECT 1 FROM tier1_runs r0 WHERE r0.task_id = t.id AND r0.state IN ${ACTIVE_RUN_STATES})))
           AND NOT EXISTS (
             SELECT 1 FROM tier1_runs r JOIN tasks t2 ON r.task_id = t2.id
             WHERE t2.project_id = t.project_id AND r.state IN ${ACTIVE_RUN_STATES})
         ORDER BY t.updated_at LIMIT 1`
      )
      .get() as
      | {
          id: string;
          project_id: string;
          title: string;
          status: string;
          package_digest: string | null;
          package_rev: number | null;
          budget_json: string;
          workspace_json: string | null;
        }
      | undefined;
    if (!row) return;

    if (!this.versionAsserted) this.assertVersion(); // 首认领前断言(失败抛给 tick 兜层,不认领)

    let repoPath: string | null = null;
    try {
      repoPath = verifiedProjectWorkspace(this.d.db, row.project_id);
    } catch {
      this.d.audit.record({
        actor: "daemon",
        action: "tier1.workspace_identity_rejected",
        meta: { taskId: row.id, projectId: row.project_id }
      });
    }
    const nowIso = this.now().toISOString();
    if (!repoPath || !existsSync(join(repoPath, ".git"))) {
      // 项目无可执行工作区:认领即 blocked 叫人(不产生 run——无从供给 worktree)
      try {
        const tx = this.d.db.transaction(() => {
          if (row.status === "queued") transitionTask(this.d.db, row.id, "running", "L", { now: nowIso });
          transitionTask(this.d.db, row.id, "blocked", "L", { now: nowIso });
          const enq = this.enqueueBlocked(
            row.id,
            row.package_rev ?? 1,
            "no-workspace:unavailable",
            "项目没配可执行的 git 工作区"
          );
          this.d.audit.record({
            actor: "daemon",
            action: "tier1.blocked",
            meta: {
              taskId: row.id,
              projectId: row.project_id,
              exitEvidence: "no-workspace:unavailable",
              enqueued: enq.enqueued
            }
          });
        });
        tx();
      } catch (err) {
        this.d.log.error("claim degrade to blocked failed", { taskId: row.id, error: safeFailureText(err, 160) });
        try {
          this.d.audit.record({
            actor: "daemon",
            action: "tier1.claim_block_transaction_failed",
            meta: { taskId: row.id, projectId: row.project_id, error: safeFailureText(err, 120) }
          });
        } catch {
          // 审计存储自身不可写时只留日志,不得再次改变任务状态。
        }
        return;
      }
      return;
    }

    const attempt = nextAttempt(this.d.db, row.id);
    const runId = newId("run");
    const worktree = join(repoPath, ".saydo", "worktrees", row.id);
    const tx = this.d.db.transaction(() => {
      // CAS:并发认领先提交者胜;返工/应答注入续跑时任务已在 running(U 边已走),不重复转态
      if (row.status === "queued") transitionTask(this.d.db, row.id, "running", "L", { now: nowIso });
      insertTier1Run(this.d.db, {
        id: runId,
        taskId: row.id,
        attempt,
        adapter: this.d.cfg.adapter as Tier1RunRow["adapter"],
        cwd: worktree,
        worktreePath: worktree,
        state: "reserved",
        createdAt: nowIso,
        updatedAt: nowIso
      });
      this.d.db
        .prepare("UPDATE tasks SET adapter=?, cwd=?, updated_at=? WHERE id=?")
        .run(this.d.cfg.adapter, worktree, nowIso, row.id); // Tier1 恢复钥匙(09 §6.1 adapter/cwd)
      // C5:有 ActionExecutionBinding 时同事务回填 ledgerRef → bound
      try {
        // 动态 import 避免 executor↔focus 循环;实现上静态 import 更清晰——见文件顶 import
        bindLedgerRefIfPresent(this.d.db, row.id, nowIso);
      } catch (err) {
        // binding 缺失=正常(无 Focus 包);其它错误上抛让认领事务回滚
        if (!safeFailureText(err).includes("no_binding")) throw err;
      }
    });
    try {
      tx();
    } catch (err) {
      this.d.log.warn("claim race lost", { taskId: row.id, error: safeFailureText(err, 120) });
      return;
    }
    this.d.audit.record({
      actor: "daemon",
      action: "tier1.claim",
      meta: { taskId: row.id, runId, attempt, adapter: this.d.cfg.adapter }
    });

    const active: ActiveRun = {
      adapter: this.backend.adapter,
      runId,
      taskId: row.id,
      projectId: row.project_id,
      attempt,
      worktree,
      repoPath,
      taskTitle: row.title,
      packageDigest: row.package_digest ?? "",
      packageRevision: row.package_rev ?? 1,
      dispatchTurnRef: this.lookupDispatchTurnRef(row.package_digest),
      budget: JSON.parse(row.budget_json) as ActiveRun["budget"],
      frozen: [],
      registry: { packageScripts: [], justfileTasks: [] },
      articlePath: "article.md",
      protectedBranches: this.d.cfg.protectedBranches ?? [],
      shellStarted: 0,
      canarySuspect: false,
      gateSeq: 0,
      toolCalls: 0,
      budgetActiveMs: 0,
      startedMs: Date.now(),
      approvalWaitMs: 0,
      approvalWaitingSince: null,
      approvalWaitDepth: 0,
      s2Pending: false,
      unknownEventCount: 0,
      eventLine: 0,
      observedModel: null,
      resultText: "",
      terminalResultReceived: false,
      proc: null,
      completion: null,
      restartPending: false,
      restartEpoch: 0,
      resumeRestartMarker: false,
      resumeMarkerEpoch: 0,
      ...streamRuntimeFields(),
      resumeSessionConfirmed: false,
      resumeSessionError: null,
      agentOwnershipEstablished: false,
      nativeResumeAudited: false,
      processGroupVerifiedExited: false,
      terminationCause: null,
      claimReady: null,
      claimPromise: null,
      abort: null,
      model: this.resolveRunModel(row.project_id, runId),
      hooksJsonPath: null
    };
    this.active.set(runId, active);
    active.completion = this.runAttempt(active).catch((err: unknown) => {
      if (active.restartPending) return;
      if (isProcessGroupLifecycleError(err)) {
        this.contaminateLifecycle(err);
        this.d.log.error("tier1 runAttempt crashed", { runId, error: safeFailureText(err) });
        this.resolveClaim(active);
        return;
      }
      const text = safeFailureText(err);
      this.d.log.error("tier1 runAttempt crashed", { runId, error: text });
      this.finalizeFailure(active, `executor_crash:${text.slice(0, 120)}`, "failed");
    });
  }

  /** W5a 3.5 开发档生效模型:project_settings 覆盖 > cfg.model(受控表,非 project.toml——09 §11 白名单不放宽)。
   *  C2b:按生效 adapter 匹配,mismatch 忽略覆盖并审计。 */
  private resolveRunModel(projectId: string, runId: string): string {
    try {
      const eff = effectiveDevModelForAdapter(
        this.d.cfg.model,
        getProjectOverrides(this.d.db, projectId),
        this.d.cfg.adapter
      );
      if (eff.ignored) {
        this.d.audit.record({
          actor: "daemon",
          action: "tier1.model_override_ignored_adapter_mismatch",
          meta: {
            projectId,
            runId,
            overrideAgent: eff.ignored.overrideAgent,
            effectiveAdapter: eff.ignored.effectiveAdapter
          }
        });
      } else if (eff.source === "project") {
        this.d.audit.record({
          actor: "daemon",
          action: "tier1.model_override_applied",
          meta: { projectId, runId, model: eff.model }
        });
      }
      return eff.model;
    } catch {
      return this.d.cfg.model; // 覆盖读取异常回全局(fail-safe;写路径有校验)
    }
  }

  /** turn_ref 溯源:该任务 dispatch 收据的确认轮(09 §9 runtime_effect CHECK 的合法承载) */
  private lookupDispatchTurnRef(packageDigest: string | null): string | null {
    if (!packageDigest) return null;
    const row = this.d.db
      .prepare(
        "SELECT turn_ref FROM approvals WHERE kind='dispatch_package' AND ref_digest=? AND outcome='consumed' ORDER BY issued_at DESC LIMIT 1"
      )
      .get(packageDigest) as { turn_ref: string | null } | undefined;
    return row?.turn_ref ?? null;
  }

  // ---------- 单次执行(供给 -> spawn -> 事件 -> settle) ----------

  private runDir(runId: string): string {
    const dir = join(this.d.cfg.saydoHome, "tier1", "runs", runId);
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  /** setup/verify/worktree 也作为受监管进程组运行；prepare 可中断并等待整组消失。 */
  private async runManagedCommand(
    run: ActiveRun,
    argv: string[],
    options: { cwd: string; env?: Record<string, string>; timeoutMs: number; captureStdout?: boolean }
  ): Promise<{ exitCode: number; stdoutTail: string }> {
    const spawned = spawnRuntimeChild(argv[0] as string, argv.slice(1), {
      cwd: options.cwd,
      ...(options.env ? { env: options.env } : {}),
      stdin: "ignore",
      stdout: options.captureStdout ? "pipe" : "ignore",
      stderr: "ignore",
      registryHome: this.d.cfg.saydoHome,
      runId: randomUUID()
    }, `tier1:${run.runId}:managed`);
    const { child, lease: childLease } = spawned;
    const signalCaptured = spawned.signal;
    if (!signalCaptured) {
      throw new ProcessGroupLifecycleError("runtime job identity missing");
    }
    child.stdin.end();
    let stdoutTail = "";
    if (options.captureStdout) {
      child.stdout.on("data", (chunk: Buffer) => {
        stdoutTail = (stdoutTail + chunk.toString("utf8")).slice(-2_000);
      });
    }
    let finishRequested = false;
    let settled = false;
    let childExited = false;
    let childClosed = false;
    let exitCode = 1;
    let pipeFailure = false;
    const pipeRecords: PipeFailureRecord[] = [];
    let timedOut = false;
    let signalFailure: Error | undefined;
    let escalationTimer: NodeJS.Timeout | undefined;
    let drainDeadlineAt: number | undefined;
    let closeDeadlineAt: number | undefined;
    let drainTimer: NodeJS.Timeout | undefined;
    let resolveWait!: (value: { exitCode: number }) => void;
    let rejectWait!: (err: Error) => void;
    const wait = new Promise<{ exitCode: number }>((resolveResult, rejectResult) => {
      resolveWait = resolveResult;
      rejectWait = rejectResult;
    });
    const started = new Promise<void>((resolveStarted, rejectStarted) => {
      child.once("spawn", resolveStarted);
      child.once("error", rejectStarted);
    });
    const signalTree = (signal: NodeJS.Signals): void => {
      try {
        signalCaptured(signal);
      } catch (err) {
        signalFailure = latchSignalFailure(signalFailure, projectTrustedKillFailure(signal, err, "primary"));
      }
    };
    const isTerminating = (): boolean =>
      childExited || finishRequested || settled || escalationTimer !== undefined;
    const knownBusiness = (): Error | undefined => {
      if (timedOut) {
        return invocationBusinessFailure({
          exitCode: 1,
          timedOut: true,
          knownExit: childExited || finishRequested
        });
      }
      if (pipeRecords.length > 0) return combinePipeBusinessFailures(pipeRecords);
      return invocationBusinessFailure({
        exitCode,
        terminationCause: "exit",
        knownExit: childExited || finishRequested
      });
    };
    const finishWait = (unreaped?: ProcessGroupLifecycleError): void => {
      const resolved = { exitCode: pipeFailure || timedOut ? 1 : exitCode };
      finalizeInvocationWait({
        settled,
        markSettled: () => {
          settled = true;
          runtimeClearTimeout(escalationTimer);
          runtimeClearTimeout(drainTimer);
        },
        signalFailure,
        business: knownBusiness(),
        unreaped,
        resolved,
        resolve: resolveWait,
        reject: rejectWait
      });
    };
    const failLifecycle = (state: ReturnType<typeof runtimeProcessGroupState>): void => {
      const err = new ProcessGroupLifecycleError(
        state === "unknown"
          ? `managed process group ${String(child.pid)} state unknown`
          : `managed process group ${String(child.pid)} did not exit`
      );
      finishWait(err);
    };
    const trySettle = (): void => {
      if (settled) return;
      const state = child.pid ? runtimeProcessGroupState(child.pid) : "gone";
      if (childClosed && state === "gone") {
        finishWait();
        return;
      }
      if (!childClosed && closeDeadlineAt !== undefined && runtimeNow() >= closeDeadlineAt) {
        signalTree("SIGKILL");
        drainDeadlineAt ??= runtimeNow() + runtimeDrainDeadlineMs();
        failLifecycle(state);
        return;
      }
      if (drainDeadlineAt !== undefined && runtimeNow() >= drainDeadlineAt) {
        signalTree("SIGKILL");
        failLifecycle(state);
        return;
      }
      runtimeClearTimeout(drainTimer);
      drainTimer = runtimeSetTimeout(trySettle, 10);
    };
    const armDrainDeadline = (): void => {
      drainDeadlineAt ??= runtimeNow() + runtimeDrainDeadlineMs();
      trySettle();
    };
    const beginFinish = (code: number): void => {
      if (finishRequested || settled) return;
      finishRequested = true;
      exitCode = code;
      runtimeClearTimeout(escalationTimer);
      signalTree("SIGKILL");
      armDrainDeadline();
    };
    child.once("exit", (code, signal) => {
      childExited = true;
      exitCode = code ?? (signal ? 143 : 1);
      closeDeadlineAt ??= runtimeNow() + runtimeCloseDeadlineMs();
      armDrainDeadline();
    });
    child.once("close", () => {
      childClosed = true;
      trySettle();
    });
    child.once("error", () => beginFinish(127));
    const seenManagedPipe = new WeakSet<object>();
    const handleManagedPipe = (stream: "stdout" | "stderr", err: unknown): void => {
      try {
        const inspection = inspectUntrustedPipeFailure(err);
        if (shouldIgnoreTerminatingPipeError(inspection.trustedCode, isTerminating())) return;
        if (seenManagedPipe.has(inspection.projected)) return;
        seenManagedPipe.add(inspection.projected);
        this.d.log.error(`managed command ${stream} error`, {
          taskId: run.taskId,
          runId: run.runId,
          argv0: argv[0] ?? "",
          code: inspection.diagnostic.code
        });
        pipeFailure = true;
        pipeRecords.push({ stream, code: inspection.diagnostic.code });
        if (!isTerminating()) beginFinish(1);
      } catch {
        pipeFailure = true;
        pipeRecords.push({ stream, code: "unknown" });
        if (!isTerminating()) beginFinish(1);
      }
    };
    child.stdout.on("error", (err: unknown) => handleManagedPipe("stdout", err));
    child.stderr.on("error", (err: unknown) => handleManagedPipe("stderr", err));
    const handle: AgentProcessHandle = {
      pid: child.pid ?? -1,
      started,
      onLine() {},
      kill() {
        if (settled || finishRequested || escalationTimer) return;
        closeDeadlineAt ??= runtimeNow() + runtimeCloseDeadlineMs();
        signalTree("SIGTERM");
        escalationTimer = runtimeSetTimeout(() => {
          if (settled) return;
          signalTree("SIGKILL");
          armDrainDeadline();
        }, runtimeKillGraceMs());
      },
      wait: () => wait
    };
    run.proc = handle;
    const timeout = runtimeSetTimeout(() => {
      timedOut = true;
      handle.kill();
    }, options.timeoutMs);
    try {
      const managed = settleWithLeaseRelease((async () => {
        try {
          await started;
          await childLease.establish();
          const result = await wait;
          return { ...result, stdoutTail, ...(timedOut ? { timedOut: true } : {}) };
        } catch (err) {
          handle.kill();
          await wait.catch(() => undefined);
          throw err;
        }
      })(), () => childLease.release(), (value) => {
        if (value.timedOut === true) {
          return invocationBusinessFailure({
            exitCode: 1,
            timedOut: true,
            knownExit: true
          });
        }
        if (pipeRecords.length > 0) return combinePipeBusinessFailures(pipeRecords);
        return invocationBusinessFailure({
          exitCode: value.exitCode,
          terminationCause: "exit",
          knownExit: true
        });
      });
      void managed.catch(() => undefined);
      return await managed;
    } finally {
      runtimeClearTimeout(timeout);
      runtimeClearTimeout(escalationTimer);
      runtimeClearTimeout(drainTimer);
      if (run.proc === handle) run.proc = null;
    }
  }

  /** 项目层全量配置消费(W1.3 生产加载,09 §11 白名单):拒收留痕 + [git].protected 并集进 run。
   *  坏文件抛出由调用方统一转 blocked(与 readProjectExecConfig 同错误面)。 */
  private applyProjectFullConfig(run: ActiveRun): void {
    const full = loadProjectConfig(run.repoPath);
    if (full.rejectedKeys.length > 0) {
      this.d.audit.record({
        actor: "daemon",
        action: "project_config.rejected_keys",
        meta: { taskId: run.taskId, runId: run.runId, keys: full.rejectedKeys.join(",") }
      });
      this.d.log.warn("project.toml 白名单外键拒收(09 §11:仓库随附输入不可信)", {
        taskId: run.taskId,
        keys: full.rejectedKeys
      });
    }
    run.protectedBranches = [...(this.d.cfg.protectedBranches ?? []), ...full.gitProtected];
  }

  private async runAttempt(run: ActiveRun, opts: { resume?: boolean; reservedRecover?: boolean } = {}): Promise<void> {
    const d = this.d;
    if (run.restartPending) {
      this.resolveClaim(run);
      return;
    }
    // 1) 项目执行配置(verify 白名单/setup)+ 全量白名单加载(W1.3;project.toml 坏 = blocked 叫人,fail-closed)
    let pcfg: ProjectExecConfig;
    try {
      pcfg = readProjectExecConfig(run.repoPath);
      this.applyProjectFullConfig(run);
    } catch (err) {
      this.finalizeFailure(run, `project_toml_invalid:${safeFailureText(err, 100)}`, "blocked", "项目配置文件解析不了,需要你看一眼 .saydo/project.toml");
      return;
    }
    run.registry = pcfg.registry;
    run.articlePath = pcfg.writingArticlePath; // W4 3.2 writing:成稿文件相对路径(settle barrier ① 用)

    // 2) verify 冻结(认领时点 = agent 起动前,主仓正文即冻结基准;执行前在 worktree 重校)
    try {
      run.frozen = pcfg.verifyRefs.map((ref) => freezeVerify(run.repoPath, ref, pcfg.registry));
    } catch (err) {
      this.finalizeFailure(run, `verify_freeze_failed:${safeFailureText(err, 100)}`, "blocked", "验证命令冻结失败,登记项和仓库现状对不上");
      return;
    }
    writeFileSync(join(this.runDir(run.runId), "frozen-verify.json"), JSON.stringify(run.frozen, null, 2));

    // 3) worktree 供给(幂等:恢复/返工复用同 task worktree)+ 审批钩子 + setup
    try {
      await this.provisionWorktree(run);
      if (run.restartPending) return;
      if (pcfg.setupArgv) {
        const setup = await this.runManagedCommand(run, pcfg.setupArgv, {
          cwd: run.worktree,
          env: strippedAgentEnv(process.env),
          timeoutMs: 300_000
        });
        if (run.restartPending) return;
        if (setup.exitCode !== 0) throw new Error(`setup exit ${setup.exitCode}`);
      } else if (pcfg.rejectedSetupReason) {
        d.audit.record({ actor: "daemon", action: "tier1.setup_rejected", meta: { taskId: run.taskId, reason: pcfg.rejectedSetupReason } });
      }
    } catch (err) {
      if (isProcessGroupLifecycleError(err)) throw this.contaminateLifecycle(err);
      if (run.restartPending) throw err;
      this.finalizeFailure(run, `provision_failed:${safeFailureText(err, 100)}`, "blocked", "工作区供给失败(worktree/依赖安装)");
      return;
    }
    if (run.restartPending) return;

    // 4) reserve -> running
    try {
      transitionTier1Run(d.db, run.runId, "running", this.now().toISOString());
    } catch {
      // 已被并发取消(reserved -> cancel_requested):走取消收尾
      run.abort = run.abort ?? { kind: "cancel", detail: "cancelled before start" };
      this.settleCancelledRun(run);
      return;
    }
    if (this.settleCancellationPriority(run)) return;
    if (run.restartPending) return;

    // 5) spawn(prompt = 任务卡 + task_messages 消费口 + 执行约定)
    const prompt = this.buildPrompt(run, opts.resume === true);
    const keys = this.resolveSpawnSession(run, { reservedRecover: opts.reservedRecover === true, allowQueuedDelta: opts.reservedRecover !== true });
    let proc: AgentProcessHandle;
    try {
      this.discardUnqualifiedTerminalResult(run);
      proc = this.spawnAgent(run, prompt, keys.resumeChatId, keys.sessionId);
    } catch (err) {
      if (isTier1BinaryIdentityError(err)) {
        this.finalizeBinaryIdentityFailure(run, err);
        return;
      }
      throw projectUnknownFailure(err);
    }
    run.proc = proc;
    const eventsPath = join(this.runDir(run.runId), "events.jsonl");
    proc.onLine((line) => this.consumeEventLine(run, line, eventsPath));
    await this.establishAgentOwnership(run, proc);
    run.agentOwnershipEstablished = true;
    this.markRestartResumed(run);
    this.resolveClaim(run);
    try {
      const waited = await proc.wait();
      this.captureProcTail(run, proc);
      run.proc = null;
      run.processGroupVerifiedExited = true;
      run.terminationCause = waited.terminationCause ?? "exit";
      try {
        await this.settleAttempt(run, waited.exitCode);
      } finally {
        await this.clearAgentOwnershipAfterDurable(run);
      }
    } catch (err) {
      run.proc = null;
      if (isProcessGroupLifecycleError(err)) {
        this.contaminateLifecycle(err);
        throw err;
      }
      throw err;
    }
  }

  private async provisionWorktree(run: ActiveRun): Promise<void> {
    if (!existsSync(join(run.worktree, ".git"))) {
      const provision = await this.runManagedCommand(
        run,
        ["git", "worktree", "add", "-b", `saydo/${run.taskId}`, run.worktree, "HEAD"],
        {
          cwd: run.repoPath,
          timeoutMs: 300_000
        }
      );
      if (run.restartPending) return;
      if (provision.exitCode !== 0) throw new Error(`git worktree exit ${provision.exitCode}`);
    }
    const hooked = this.provisionBackendHooks(run.worktree);
    // hooks.json 只有 cursor 后端落在 worktree 内;claude 的门脚本在 ~/.saydo/tier1/,
    // 由 cfg.gateClaudeScriptPath/Expected 覆盖漂移面,不重复登记(否则期望值比错对象恒漂移)
    run.hooksJsonPath = this.backend.adapter === "cursor" ? (hooked.filesWritten[0] ?? null) : null;
  }

  /**
   * 门脚本路径单源:供给侧(backend.provisionHooks)与漂移基准侧(cfg.gateScript*)必须同源,
   * 否则 hooks.json 里写的入口与 drift guard 比对的期望值可以分叉,变成"恒漂移"或"漏比对"。
   * 目录/sock/bind/secret 仍由 gatePaths 按 saydoHome 推导。
   */
  private gatePathBundle(): GatePaths {
    const p = gatePaths(this.d.cfg.saydoHome);
    return {
      ...p,
      scriptPath: this.d.cfg.gateScriptPath,
      ...(this.d.cfg.gateClaudeScriptPath ? { claudeScriptPath: this.d.cfg.gateClaudeScriptPath } : {})
    };
  }

  private provisionBackendHooks(cwd: string): { extraArgs: string[]; filesWritten: string[] } {
    return this.backend.provisionHooks(cwd, this.gatePathBundle(), this.d.cfg.hooksTimeoutSec ?? 120);
  }

  /**
   * 09 §11 claude_code 承载段:身份登记「启动与**每次 spawn 前**核验」。
   * digest 重算走 checkBinaryIdentity 的 mtime/size 缓存(D12 取舍),常态零额外哈希。
   * 不符 ⇒ 抛 Tier1BinaryIdentityError,由认领链结算成 blocked `binary_identity_mismatch`,不起进程。
   */
  /** spawn 前身份核验失败的统一结算:不起进程、blocked 叫人(09 §11「不符 ⇒ 不认领」) */
  private finalizeBinaryIdentityFailure(run: ActiveRun, err: unknown): void {
    const text = brandedBinaryIdentityFailureText(err) ?? "binary_identity_mismatch";
    this.finalizeFailure(
      run,
      text.slice(0, 160),
      "blocked",
      "执行器二进制和登记的身份对不上,先重跑一次 Tier1 自检再继续"
    );
  }

  private assertClaudeBinaryIdentity(): void {
    if (this.backend.adapter !== "claude_code") return;
    const v = verifyClaudeIdentity(this.d.cfg.saydoHome, this.d.cfg.lockedBinary);
    if (!v.ok) throw new Tier1BinaryIdentityError(v.code, v.detail);
  }

  private spawnAgent(run: ActiveRun, prompt: string, resumeChatId?: string, sessionId?: string): AgentProcessHandle {
    this.assertClaudeBinaryIdentity();
    const hooked = this.provisionBackendHooks(run.worktree);
    const env = strippedAgentEnv(process.env);
    if (this.backend.adapter === "claude_code") Object.assign(env, claudeEnvOverrides);
    const settingsIdx = hooked.extraArgs.indexOf("--settings");
    const settingsJson = settingsIdx >= 0 ? hooked.extraArgs[settingsIdx + 1] : undefined;
    return this.d.spawner.spawn({
      binary: this.d.cfg.lockedBinary,
      model: run.model,
      prompt,
      cwd: run.worktree,
      env,
      runId: run.runId,
      ...(resumeChatId ? { resumeChatId } : {}),
      ...(sessionId ? { sessionId } : {}),
      ...(settingsJson ? { settingsJson } : {}),
      ...(this.backend.adapter === "claude_code" ? { maxTurns: this.d.cfg.claudeMaxTurns ?? 200 } : {})
    });
  }

  private captureProcTail(run: ActiveRun, proc: AgentProcessHandle): void {
    try {
      run.stderrTail = proc.stderrTail?.() ?? run.stderrTail;
    } catch {
      // stderr 尾可选
    }
  }

  private bindClaudeFirstSession(run: ActiveRun): string {
    const sessionId = randomUUID();
    overwriteTier1RunNativeSession(this.d.db, run.runId, sessionId, this.now().toISOString());
    run.expectedSessionIdentity = sessionId;
    run.isResume = false;
    return sessionId;
  }

  private lookupQueuedDeltaResume(run: ActiveRun): { sid: string | null; reason: string } {
    const prev = this.d.db
      .prepare(
        `SELECT adapter, native_session_id AS sid, cwd, native_session_confirmed AS confirmed
         FROM tier1_runs WHERE task_id=? AND id!=? ORDER BY attempt DESC LIMIT 1`
      )
      .get(run.taskId, run.runId) as
      | { adapter: string; sid: string | null; cwd: string; confirmed: number }
      | undefined;
    if (!prev) return { sid: null, reason: "no_previous" };
    if (prev.adapter !== this.d.cfg.adapter) return { sid: null, reason: "adapter_mismatch" };
    if (!prev.sid) return { sid: null, reason: "native_session_absent" };
    if (this.canon(prev.cwd) !== this.canon(run.worktree)) return { sid: null, reason: "cwd_mismatch" };
    if (prev.confirmed !== 1) return { sid: null, reason: "not_confirmed" };
    return { sid: prev.sid, reason: "exact" };
  }

  private resolveSpawnSession(
    run: ActiveRun,
    opts: { reservedRecover: boolean; allowQueuedDelta: boolean }
  ): { resumeChatId?: string; sessionId?: string } {
    if (this.backend.adapter !== "claude_code") return {};
    if (!opts.reservedRecover && opts.allowQueuedDelta) {
      const prev = this.lookupQueuedDeltaResume(run);
      if (prev.sid) {
        run.expectedSessionIdentity = prev.sid;
        run.isResume = true;
        return { resumeChatId: prev.sid };
      }
      if (prev.reason !== "no_previous") {
        this.d.audit.record({
          actor: "daemon",
          action: `tier1.resume_skipped_${prev.reason}`,
          meta: {
            runId: run.runId,
            taskId: run.taskId,
            reason: prev.reason,
            expectedSessionIdentity: null,
            isResume: false
          }
        });
      }
    }
    return { sessionId: this.bindClaudeFirstSession(run) };
  }

  private buildPrompt(run: ActiveRun, isResume: boolean): string {
    const task = this.d.db.prepare("SELECT spec_markdown FROM tasks WHERE id=?").get(run.taskId) as { spec_markdown: string };
    const messages = readTaskMessages(this.d.db, run.taskId, run.attempt);
    const parts: string[] = [
      "你是 SayDo 派出的执行 agent,在专属 git worktree 内完成下述任务。",
      "",
      task.spec_markdown
    ];
    if (messages.length > 0) {
      parts.push("", "## 补充指示(用户返工/重试意见,优先级高于上文)");
      for (const m of messages) parts.push(`- [${m.kind}] ${m.body}`);
    }
    if (isResume) {
      const diffStat = this.safeGit(run.worktree, ["diff", "--stat", "HEAD"]).slice(0, 2000);
      parts.push("", "## 恢复上下文(上次会话中断)", "工作区已有改动摘要:", "```", diffStat || "(无改动)", "```", "从当前状态继续,不要重做已完成的部分。");
    }
    const protectedAgentDirectory = this.backend.adapter === "claude_code" ? ".claude/" : ".cursor/";
    parts.push(
      "",
      "## 执行约定",
      "- 只在当前工作目录内改动;不要 git push;改动不需要你合并——完成后系统会独立跑验证并交人验收。",
      `- 不要改动 ${protectedAgentDirectory} 目录、验证脚本(package.json scripts / justfile 中已登记的验证项)。`,
      "- 结束时用一段话总结:做了什么、改了哪些文件、有什么没做。"
    );
    // W4 3.2 writing:成稿落盘约定(barrier ① 断言该路径存在于提交树 + 非空)
    if (this.projectTypeOf(run.projectId) === "writing") {
      parts.push(
        "",
        "## 写作交付约定(重要)",
        `- 成稿写到工作目录下的 \`${run.articlePath}\`(Markdown);系统按这个路径核验成稿,写到别处等于没交付。`,
        "- 按计划里的大纲逐节成稿,每节都要有实质内容(不要留空节)。",
        "- 只写文章正文与参考文献,不跑测试;验收是人逐节评审,不是自动测试。"
      );
    }
    return parts.join("\n");
  }

  private consumeEventLine(run: ActiveRun, line: string, eventsPath: string): void {
    if (run.eventPersistenceError !== null) return;
    try {
      appendFileSync(eventsPath, line + "\n");
    } catch (err) {
      run.eventPersistenceError = safeFailureText(err, 160);
      this.d.log.error("tier1 event persistence failed", {
        taskId: run.taskId,
        runId: run.runId,
        eventLine: run.eventLine + 1,
        error: run.eventPersistenceError
      });
      try {
        this.d.audit.record({
          actor: "daemon",
          action: "tier1.event_persistence_failed",
          meta: { taskId: run.taskId, runId: run.runId, nextEventLine: run.eventLine + 1 }
        });
      } catch {
        // 事件文件与审计库同时不可写时仍以进程终止 fail-closed，不伪造 cursor。
      }
      run.proc?.kill();
      return;
    }
    run.eventLine++;
    let sessionHandled = false;
    for (const ev of this.backend.parseLine(line)) {
      if (ev.kind === "init") {
        // 09 §11:apiKeySource !== "none" 即终止。claude 的 system/init 恒带该键(fixture 2.1.220 实证),
        // 缺失/空串/非字符串都是形状漂移,按 fail-closed 同样终止——只对 claude_code 严格,
        // cursor 的事件流本就不产生 init。
        const claudeStrict = this.backend.adapter === "claude_code";
        const apiKeySourceBad = claudeStrict
          ? ev.apiKeySource !== "none"
          : typeof ev.apiKeySource === "string" && ev.apiKeySource !== "none";
        if (apiKeySourceBad) {
          run.authViolation = true;
          run.proc?.kill();
        }
        if (ev.model) {
          run.observedModels.add(ev.model);
          run.observedModel = ev.model;
        }
        this.applySessionIdentity(run, ev.session_id, false);
        sessionHandled = true;
        continue;
      }
      if (ev.kind === "observed_model" && ev.observedModel) {
        run.observedModels.add(ev.observedModel);
        if (this.backend.adapter !== "claude_code") {
          run.observedModel = ev.observedModel;
        }
        // W1.4(0.0(a) --resume 清账):cursor system.init 同行带 session_id(chatId)——落 tier1_runs
        // native_session_id 列(§12-7 恢复钥匙 canonical 落位,recovery/reconciler 按列判 resumable;
        // 实测锚 e2e/poc/tier1-live-executor events.jsonl 首行)。claude 身份只认 init;
        // assistant 行也带 session_id,不得当对账(否则 S2 等待期多 tool_use 会误 mismatch)。
        if (!sessionHandled && this.backend.adapter !== "claude_code") {
          try {
            const sid = (JSON.parse(line) as { session_id?: string }).session_id;
            this.applySessionIdentity(run, sid, false);
          } catch {
            this.applySessionIdentity(run, undefined, true);
          }
        }
        continue;
      }
      if (ev.kind === "rate_limit") {
        run.rateLimitEvents.push({
          ...(ev.status !== undefined ? { status: ev.status } : {}),
          ...(ev.resetsAt !== undefined ? { resetsAt: ev.resetsAt } : {}),
          ...(ev.rateLimitType !== undefined ? { rateLimitType: ev.rateLimitType } : {})
        });
        continue;
      }
      if (ev.kind === "result") {
        run.resultText = ev.text ?? "";
        run.terminalResultReceived = true;
        run.resultEvent = ev;
        continue;
      }
      if (ev.kind === "tool_started") {
        run.toolCalls++; // 回合熔断按 started 计(started/completed 成对,双计会虚高一倍)
        this.d.db
          .prepare("UPDATE tier1_runs SET budget_tool_calls=?, updated_at=? WHERE id=?")
          .run(run.toolCalls, this.now().toISOString(), run.runId);
        if (ev.toolUseId) run.toolUseById.set(ev.toolUseId, ev.tool);
        if (this.backend.canaryLeft === "shell_started" && isCursorShellToolCall(line)) run.shellStarted++;
        continue;
      }
      if (ev.kind === "tool_result") {
        if (this.backend.canaryLeft === "tool_result" && ev.toolUseId) {
          const tool = run.toolUseById.get(ev.toolUseId);
          if (tool && CLAUDE_CLOSED_TOOLS.has(tool)) run.gatedToolResults++;
        }
        continue;
      }
      if (ev.kind === "unknown") {
        run.unknownEventCount++;
        this.d.audit.record({
          actor: "daemon",
          action: "tier1.event_parse_unknown",
          meta: { taskId: run.taskId, runId: run.runId, count: run.unknownEventCount, line: run.eventLine }
        });
        continue;
      }
    }
  }

  private applySessionIdentity(run: ActiveRun, sid: string | undefined, parseFailed: boolean): void {
    if (parseFailed) {
      if (run.expectedSessionIdentity !== null) {
        run.resumeSessionError = "native_session_invalid";
        run.proc?.kill();
      }
      return;
    }
    if (run.expectedSessionIdentity !== null) {
      if (sid === run.expectedSessionIdentity) {
        const first = !run.resumeSessionConfirmed;
        run.resumeSessionConfirmed = true;
        if (this.backend.adapter === "claude_code") {
          // queued_delta 续跑 attempt 插入时 native_session_id 为 NULL;confirm 有
          // IS NOT NULL 守卫,必须先覆写继承的 SID 再确认,durable 行才能落到四元组。
          const nowIso = this.now().toISOString();
          if (run.isResume) overwriteTier1RunNativeSession(this.d.db, run.runId, sid, nowIso);
          confirmTier1RunNativeSession(this.d.db, run.runId, nowIso);
          if (first && !run.isResume) {
            this.d.audit.record({
              actor: "daemon",
              action: "tier1.session_identity_confirmed",
              meta: {
                taskId: run.taskId,
                runId: run.runId,
                expectedSessionIdentity: sid,
                isResume: false
              }
            });
          }
        }
        if (run.isResume) this.acceptNativeResume(run, sid);
      } else {
        run.resumeSessionError = sid ? `native_session_mismatch:${sid}` : "native_session_missing";
        if (this.backend.adapter === "claude_code") {
          this.d.audit.record({
            actor: "daemon",
            action: "tier1.session_identity_mismatch",
            meta: {
              taskId: run.taskId,
              runId: run.runId,
              expectedSessionIdentity: run.expectedSessionIdentity,
              observed: sid ?? null,
              isResume: run.isResume
            }
          });
        }
        run.proc?.kill();
      }
    } else if (sid) {
      setTier1RunNativeSession(this.d.db, run.runId, sid, this.now().toISOString());
    }
  }

  // ---------- settle(09 §6.3 barrier:proof 齐备才写 outbox) ----------

  /**
   * 退出竞态下以 durable 任务/run 状态补齐内存 abort。用户取消优先于 steer；
   * 其它安全/预算 abort 已在内存中时不覆盖。
   */
  private refreshTerminalAbort(run: ActiveRun): void {
    if (run.abort) return;
    const row = this.d.db
      .prepare(
        `SELECT t.status AS task_status, r.state AS run_state
         FROM tier1_runs r JOIN tasks t ON t.id=r.task_id WHERE r.id=?`
      )
      .get(run.runId) as { task_status: string; run_state: string } | undefined;
    if (row?.task_status === "cancel_requested") {
      run.abort = { kind: "cancel", detail: "durable task cancel_requested" };
      this.d.db
        .prepare(
          "UPDATE tier1_runs SET state='cancel_requested', updated_at=? WHERE id=? AND state IN ('reserved','running','step_paused')"
        )
        .run(this.now().toISOString(), run.runId);
    } else if (row?.run_state === "cancel_requested") {
      run.abort = { kind: "steer_resume", detail: "durable run cancel_requested" };
    }
  }

  private async settleAttempt(run: ActiveRun, exitCode: number): Promise<void> {
    const d = this.d;
    try {
      this.refreshTerminalAbort(run);
      this.refreshBudgetAbort(run);
      // 结算点 canary 硬检(零容忍:进程已退,事件与门请求都已到齐,计数差 = 确证绕门)
      if (!run.abort && run.shellStarted > run.gateSeq) {
        run.abort = { kind: "canary", detail: `settle check: shell_started=${run.shellStarted} > gate_requests=${run.gateSeq}` };
        d.audit.record({
          actor: "daemon",
          action: "tier1.canary_tripped",
          meta: { taskId: run.taskId, runId: run.runId, detail: run.abort.detail }
        });
      }
      if (!run.abort && this.backend.canaryLeft === "tool_result" && run.gatedToolResults > run.gateSeq) {
        run.abort = {
          kind: "canary",
          detail: `settle check: tool_result=${run.gatedToolResults} > gate_requests=${run.gateSeq}`
        };
        d.audit.record({
          actor: "daemon",
          action: "tier1.canary_tripped",
          meta: { taskId: run.taskId, runId: run.runId, detail: run.abort.detail }
        });
      }
      if (run.abort?.kind === "cancel") {
        this.settleCancelledRun(run);
        return;
      }
      if (run.abort?.kind === "steer_resume") {
        this.settleSteerResumeRun(run);
        return;
      }
      if (run.eventPersistenceError !== null) {
        this.finalizeFailure(
          run,
          `event_persistence_failed:${run.eventPersistenceError}`,
          "failed",
          "执行事件无法可靠留痕,这轮作废"
        );
        return;
      }
      if (run.abort?.kind === "canary") {
        // 门被绕过:安全事件,任务 failed(§6.1 any->failed (L)),run 作废
        this.finalizeFailure(run, `gate_canary:${run.abort.detail}`, "failed", "执行被安全门叫停:有命令绕过了审批门,这轮作废");
        return;
      }
      if (run.abort?.kind === "budget") {
        this.finalizeFailure(run, `budget:${run.abort.detail}`, "blocked", "预算熔断停了,要继续得你来处置");
        return;
      }
      if (run.terminationCause === "pipe_failed") {
        this.finalizeFailure(run, "stdio_pipe_failed", "failed", "执行输出管道断了,这轮作废");
        return;
      }
      if (this.backend.adapter === "claude_code" && !run.restartPending) {
        if (run.authViolation) {
          this.finalizeFailure(run, "subscription_auth_violation", "failed", "执行流报了非订阅登录态,这轮作废");
          return;
        }
        if (run.resumeSessionError) {
          this.finalizeFailure(
            run,
            run.resumeSessionError.startsWith("native_session_mismatch")
              ? "native_session_mismatch"
              : run.resumeSessionError,
            "failed",
            "原生会话身份对不上,这轮作废"
          );
          return;
        }
        this.auditClaudeCanaryReconciling(run);
        const disp = this.claudeDisposition(run, exitCode);
        if (disp.action === "blocked") {
          if (disp.reason === "subscription_rate_limited") this.enqueueTier1RateLimit(run);
          this.finalizeFailure(
            run,
            disp.reason,
            "blocked",
            disp.reason === "subscription_rate_limited"
              ? "订阅额度到限,等重置后再跑"
              : "Claude 登录已失效,请在终端跑 claude 并 /login"
          );
          return;
        }
        if (disp.action === "failed") {
          this.finalizeFailure(run, disp.reason, "failed", `执行没跑完(${disp.reason})`);
          return;
        }
        if (disp.action === "cancel") {
          this.settleCancelledRun(run);
          return;
        }
        if (run.expectedSessionIdentity !== null && !run.resumeSessionConfirmed) {
          this.finalizeFailure(run, "native_session_confirmation_missing", "failed", "原生会话身份没有确认,这轮作废");
          return;
        }
        if (run.observedModels.size === 0 || !run.observedModel) {
          this.finalizeFailure(run, "observed_model_missing", "failed", "执行流里没有模型观测,这轮结果作废");
          return;
        }
        const bad = [...run.observedModels].find((m) => familyFromModelName(m) !== "claude");
        if (bad) {
          this.finalizeFailure(
            run,
            `observed_model_family_mismatch:${bad}`,
            "failed",
            "执行模型族与配置不符,这轮结果作废"
          );
          return;
        }
      }
      // B3: terminal result 必须先于 restart suspension；已有合法终局不得借 marker 跳过 settle。
      if (!(run.terminalResultReceived && exitCode === 0 && !run.abort) && run.restartPending) {
        this.checkpointBudget(run);
        d.audit.record({
          actor: "daemon",
          action: "tier1.restart_suspended",
          meta: { taskId: run.taskId, runId: run.runId, attempt: run.attempt, epoch: run.restartEpoch }
        });
        return;
      }
      if (exitCode !== 0) {
        this.finalizeFailure(run, `agent_exit:${exitCode}`, "failed", `agent 进程非零退出(${exitCode})`);
        return;
      }
      if (!run.terminalResultReceived) {
        this.finalizeFailure(run, "agent_result_missing", "failed", "执行流没有合法成功终态,这轮结果作废");
        return;
      }
      // observedModel 严格档(09 §11 规则 2:cursor 缺失即作废;族校验防谎报)
      if (!run.observedModel) {
        this.finalizeFailure(run, "observed_model_missing", "failed", "执行流里没有模型观测,这轮结果作废");
        return;
      }
      const expectedFamily = familyFromModelName(run.model); // W5a 3.5:族校验对生效模型
      const observedFamily = familyFromModelName(run.observedModel);
      if (expectedFamily !== null && observedFamily !== null && expectedFamily !== observedFamily) {
        // 同族切换(fable -> opus 类)按 spike 律吞掉;跨族才作废
        this.finalizeFailure(run, `observed_model_family_mismatch:${run.observedModel}`, "failed", "执行模型族与配置不符,这轮结果作废");
        return;
      }
      const requested: ReviewFinalizationIntent = {
        kind: "review",
        recordedAt: this.now().toISOString(),
        eventLine: run.eventLine,
        observedModel: run.observedModel,
        observedModels: [...run.observedModels],
        resultEvent: run.resultEvent!
      };
      run.pendingFinalization = requested;
      const durable = this.ensurePendingFinalization(run, requested);
      run.pendingFinalization = durable;
      if (durable.kind === "failure") {
        this.finalizeFailure(run, durable.exitEvidence, durable.taskState, durable.spokenReason);
        return;
      }
      // review intent 与 restart marker 的清除在同一写入中完成；此后崩溃恢复只重跑 verify/settle，绝不 spawn agent。
      run.restartPending = false;
      run.resumeRestartMarker = false;
      await this.settlePendingReview(run);
    } finally {
      // 评审 91 A-5 同族防御:settleCoding/settleWriting 若抛出,原来只 delete 不 resolve,
      // 认领链同样挂住。resolveClaim 幂等(先清 claimReady 再调),正常路径已 resolve 过的不受影响。
      this.resolveClaim(run);
      const state = (this.d.db.prepare("SELECT state FROM tier1_runs WHERE id=?").get(run.runId) as { state: string } | undefined)?.state;
      if (!state || !["reserved", "running", "step_paused", "cancel_requested"].includes(state)) this.active.delete(run.runId);
    }
  }

  /** 已观察到合法成功终态后的唯一恢复路径：只做 verify/snapshot/settle，不再运行 agent。 */
  private settlePendingReview(run: ActiveRun): Promise<void> {
    const inFlight = this.reviewSettlements.get(run.runId);
    if (inFlight) return inFlight;
    const settlement = (async () => {
      try {
        const pending = run.pendingFinalization;
        if (!pending || pending.kind !== "review") throw new Error(`review finalize intent missing:${run.runId}`);
        if (this.reviewSettlementInterrupted(run)) return;
        if (!run.resultEvent) {
          this.finalizeFailure(
            run,
            "review_result_event_missing",
            "blocked",
            "成功终态的原始结果事件无法恢复,不能伪造用量或交付证明"
          );
          return;
        }
        // 09 §6.1a:按 project.type 白名单分叉——coding 走 verify gate;writing 走内容评审 gate(verify 可空)。
        const projectType = this.projectTypeOf(run.projectId);
        if (projectType === "writing") {
          await this.settleWriting(run);
        } else if (projectType === "coding") {
          await this.settleCoding(run);
        } else {
          this.finalizeFailure(
            run,
            `project_type_unexecutable:${projectType ?? "missing"}`,
            "blocked",
            "这个项目的类型没有执行合同(或类型读不到),需要你在屏幕上看一眼项目状态"
          );
        }
      } catch (err) {
        this.d.log.error("tier1 review settlement failed", { runId: run.runId, error: safeFailureText(err, 200) });
        if (this.settleCancellationPriority(run)) return;
        try {
          this.d.audit.record({
            actor: "daemon",
            action: "tier1.finalize_transaction_failed",
            meta: {
              taskId: run.taskId,
              runId: run.runId,
              wanted: "ready_for_review",
              stage: classifyTier1ReviewSettlementCatch(err)
            }
          });
        } catch {
          // 审计存储也不可用时，durable review marker 仍保留并阻断新认领。
        }
        return;
      } finally {
        this.resolveClaim(run);
        const state = (this.d.db.prepare("SELECT state FROM tier1_runs WHERE id=?").get(run.runId) as { state: string } | undefined)?.state;
        if (!state || !["reserved", "running", "step_paused", "cancel_requested"].includes(state)) {
          this.active.delete(run.runId);
        }
      }
    })().finally(() => {
      if (this.reviewSettlements.get(run.runId) === settlement) this.reviewSettlements.delete(run.runId);
    });
    this.reviewSettlements.set(run.runId, settlement);
    return settlement;
  }

  /** writing 成稿路径安全读取(恢复链;project.toml 坏回缺省不炸) */
  private safeArticlePath(repoPath: string): string {
    try {
      return readProjectExecConfig(repoPath).writingArticlePath;
    } catch {
      return "article.md";
    }
  }

  /** project.type 现读(settle 分叉键;缺失 ⇒ null,调用方 fail-closed——不按 coding 兜底,owner 裁决 (a) 案 2026-07-28) */
  private projectTypeOf(projectId: string): string | null {
    const row = this.d.db.prepare("SELECT type FROM projects WHERE id=?").get(projectId) as { type: string } | undefined;
    return row?.type ?? null;
  }

  /** coding settle(verify gate;09 §6.1 既有链) */
  private async settleCoding(run: ActiveRun): Promise<void> {
    if (this.reviewSettlementInterrupted(run)) return;
    // verify(G3):无登记 = 不可 settle(fail-closed 叫人);冻结重校不符 = Plan Delta
    if (run.frozen.length === 0) {
      this.finalizeFailure(run, "no_verify_registered", "blocked", "这个仓没登记验证命令(.saydo/project.toml [[verify.entries]]),我不能替你判定完成——补登记后重试");
      return;
    }
    const verifyResults: { templateRef: string; exitCode: number; stdoutTail: string }[] = [];
    for (const frozen of run.frozen) {
      if (this.reviewSettlementInterrupted(run)) return;
      const pre = precheckVerify(run.worktree, frozen);
      if (!pre.ok) {
        if (pre.kind === "content_drift") {
          const delta = planDeltaCallback(pre);
          this.finalizeFailure(run, `plan_delta:${frozen.templateRef}`, "blocked", delta.reason);
        } else {
          this.finalizeFailure(run, `verify_read_error:${pre.message}`, "blocked", "验证脚本读不出来,需要你看一眼");
        }
        return;
      }
      const vr = await this.execVerify(run, verifyRunnerArgv(pre.argv));
      if (this.reviewSettlementInterrupted(run)) return;
      verifyResults.push({ templateRef: frozen.templateRef, ...vr });
      if (vr.exitCode !== 0) {
        writeFileSync(join(this.runDir(run.runId), "verify.json"), JSON.stringify(verifyResults, null, 2));
        this.finalizeFailure(run, `verify_failed:${frozen.templateRef}:exit${vr.exitCode}`, "failed", `验证没过(${frozen.templateRef})`);
        return;
      }
    }
    if (this.reviewSettlementInterrupted(run)) return;
    const verifyPayload = JSON.stringify(verifyResults, null, 2);
    writeFileSync(join(this.runDir(run.runId), "verify.json"), verifyPayload);

    const snap = await this.snapshotTree(run);
    if (this.reviewSettlementInterrupted(run)) return;
    if (!snap.ok) return;
    const treeSha = snap.treeSha;

    const nowIso = this.now().toISOString();
    const body = this.packageBodyOf(run);
    if (!body) {
      this.finalizeFailure(run, "package_body_unavailable", "blocked", "读不到决策包正文,无法逐条对账验收标准");
      return;
    }
    // verify 模板与 acceptance 目前没有显式一一绑定合同。即使所有冻结 verify 都通过，
    // 也不能把每条 criterion 伪投影成 pass；先固化为 manual/unknown，交给验收者逐条判断。
    const acceptanceChecks: AcceptanceCheck[] = body.acceptance.map((criterion) => ({
      criterion,
      status: "unknown",
      source: "manual"
    }));
    const proof: Tier1SettleProof = tier1SettleProofSchema.parse({
      kind: "tier1",
      taskId: run.taskId,
      runId: run.runId,
      attempt: run.attempt,
      packageRevision: run.packageRevision,
      treeSha,
      tier1VerifyDigest: textDigest(verifyPayload),
      acceptanceChecks,
      transcriptCursor: `events:${run.runId}:line:${run.eventLine}`,
      settledAt: nowIso
    } satisfies Tier1SettleProof);

    if (this.reviewSettlementInterrupted(run)) return;
    this.commitSettle(run, treeSha, proof, `verify:${textDigest(verifyPayload)}`);
  }

  /**
   * writing settle(09 §6.1a writingSettleBarrier):verify = 内容评审 gate(可空,不因 no_verify 阻塞);
   * 若配了内容型 verify(markdownlint/死链等)则跑,fail ⇒ 不 settle;
   * 成稿对账(①)+ 节 exact-set(②)+ 验收对账(③)机械断言,缺一转 blocked/failed 不 settle。
   */
  private async settleWriting(run: ActiveRun): Promise<void> {
    const d = this.d;
    if (this.reviewSettlementInterrupted(run)) return;
    if (!d.artifacts) {
      this.finalizeFailure(run, "artifact_store_unavailable", "blocked", "产物库未接线,writing 成稿无法落库(实施配置问题)");
      return;
    }
    // verify 可空:配了才跑(内容型 lint;source="verify" 验收项据此);无登记 = 内容评审 gate,不阻塞
    const verifyResults: { templateRef: string; exitCode: number; stdoutTail: string }[] = [];
    for (const frozen of run.frozen) {
      if (this.reviewSettlementInterrupted(run)) return;
      const pre = precheckVerify(run.worktree, frozen);
      if (!pre.ok) {
        if (pre.kind === "content_drift") {
          this.finalizeFailure(run, `plan_delta:${frozen.templateRef}`, "blocked", planDeltaCallback(pre).reason);
        } else {
          this.finalizeFailure(run, `verify_read_error:${pre.message}`, "blocked", "内容检查脚本读不出来,需要你看一眼");
        }
        return;
      }
      const vr = await this.execVerify(run, verifyRunnerArgv(pre.argv));
      if (this.reviewSettlementInterrupted(run)) return;
      verifyResults.push({ templateRef: frozen.templateRef, ...vr });
    }
    if (this.reviewSettlementInterrupted(run)) return;
    if (verifyResults.length > 0) writeFileSync(join(this.runDir(run.runId), "verify.json"), JSON.stringify(verifyResults, null, 2));
    // 内容 lint fail ⇒ 不 settle(09 §6.1a barrier ③ 后半句;w4-readback B-3 回修):
    // 与 coding verify 红同构走 failed(settled_failed + trigger=failed 回叫,retryTask 重派发链修稿再来);
    // verify 结果 → AcceptanceCheck 的绑定映射(模板 ↔ criterion)canonical 留白,不自定——结果落 verify.json 与败因,验收项保持 manual
    const redVerify = verifyResults.find((v) => v.exitCode !== 0);
    if (redVerify) {
      this.finalizeFailure(
        run,
        `writing_verify_failed:${redVerify.templateRef}:exit=${redVerify.exitCode}`,
        "failed",
        "内容检查没过,这稿先不交——修完再跑"
      );
      return;
    }

    if (this.reviewSettlementInterrupted(run)) return;
    // 成稿对账 ①(daemon IO 面):worktree 路径必须是圈内常规文件；内容以后续 prospective tree blob 为权威。
    const articleAbs = resolve(run.worktree, run.articlePath);
    const articleRel = relative(run.worktree, articleAbs);
    if (articleRel === "" || articleRel === ".." || articleRel.startsWith(`..${sep}`) || isAbsolute(articleRel)) {
      this.finalizeFailure(run, `article_path_outside_worktree:${run.articlePath}`, "blocked", "成稿路径越出了任务工作区,已拒绝读取");
      return;
    }
    try {
      readRegularWritingFile(articleAbs, "worktree 成稿");
    } catch (err) {
      this.finalizeFailure(
        run,
        `article_invalid:${safeFailureText(err, 100)}`,
        "blocked",
        `成稿文件缺失、不是常规文件或不是规范 UTF-8(${run.articlePath})`
      );
      return;
    }

    const snap = await this.snapshotTree(run);
    if (this.reviewSettlementInterrupted(run)) return;
    if (!snap.ok) return;
    const treeSha = snap.treeSha;

    // ① 续:artifact 必须从不可变 tree 的常规 blob 原始字节生成，不能信 snapshot 前的 worktree 字符串。
    let treeArticle: ReturnType<typeof readWritingTreeBlob>;
    try {
      if (this.reviewSettlementInterrupted(run)) return;
      treeArticle = readWritingTreeBlob(run.worktree, treeSha, run.articlePath);
    } catch (err) {
      this.finalizeFailure(run, `article_tree_invalid:${safeFailureText(err, 100)}`, "blocked", "提交树里的成稿不是可批准的常规 UTF-8 文件");
      return;
    }
    if (treeArticle.text.trim() === "") {
      this.finalizeFailure(run, "article_empty", "blocked", "成稿是空的,不能判定完成");
      return;
    }
    const articleDigest = treeArticle.digest;

    // 先固定 durable 引用，再 exact-replay 落 article；终态事务重试不制造新 artifact/version。
    if (this.reviewSettlementInterrupted(run)) return;
    const articleIntent = this.ensureWritingArtifactIntent(run, {
      articlePath: run.articlePath,
      articleDigest,
      treeSha
    });
    if (this.reviewSettlementInterrupted(run)) return;
    const article = d.artifacts.writeOnce({
      artifactId: articleIntent.articleArtifactId,
      version: 1,
      projectId: run.projectId,
      type: "article",
      content: treeArticle.text,
      tags: ["writing-article", `task:${run.taskId}`],
      source: "agent_output"
    });

    // ② 节 exact-set + ③ 验收对账:从包 plan/acceptance 构造 sectionCoverage/acceptanceChecks
    const body = this.packageBodyOf(run);
    if (!body) {
      this.finalizeFailure(run, "package_body_unavailable", "blocked", "读不到决策包正文(plan/验收),无法逐节对账");
      return;
    }
    const aiSeqs = body.plan.filter((s) => s.owner === "ai").map((s) => String(s.seq));
    // direct 档全稿一次:所有 ai 步 seq 落 drafted(step_confirm 逐节停靠的进度载荷用 empty,最终 settle 同样全稿)
    const sectionCoverage = aiSeqs.map((id) => ({ outlineSectionId: id, status: "drafted" as const }));
    // 验收项:settle 时 manual 恒 unknown(人评终局在 approve);内容 lint 能绑则 verify+pass
    const acceptanceChecks: AcceptanceCheck[] = body.acceptance.map((criterion) => ({
      criterion,
      status: "unknown" as const,
      source: "manual" as const
    }));

    const nowIso = this.now().toISOString();
    const proof: WritingSettleProof = writingSettleProofSchema.parse({
      kind: "writing",
      taskId: run.taskId,
      runId: run.runId,
      attempt: run.attempt,
      packageRevision: run.packageRevision,
      treeSha,
      articleArtifactId: article.id,
      articleVersion: article.version,
      articlePath: run.articlePath,
      articleDigest,
      sectionCoverage,
      acceptanceChecks,
      transcriptCursor: `events:${run.runId}:line:${run.eventLine}`,
      settledAt: nowIso
    } satisfies WritingSettleProof);

    // 结构断言(②③;settle 门:全 drafted + manual 恒 unknown)——缺一不 settle
    const violations = writingSettleStructuralViolations(
      proof,
      { plan: body.plan, acceptance: body.acceptance },
      { requireAllDrafted: true, manualMustBeUnknown: true }
    );
    if (violations.length > 0) {
      this.finalizeFailure(run, `writing_barrier:${violations[0]}`, "blocked", `成稿对账没过:${violations.slice(0, 2).join(";")}`);
      return;
    }

    if (this.reviewSettlementInterrupted(run)) return;
    this.commitSettle(run, treeSha, proof, `article:${articleDigest}`);
  }

  /** 快照树(prospectiveTree;排除 .cursor——审批钩子是 daemon 注入物,不属交付内容) */
  private async snapshotTree(run: ActiveRun): Promise<{ ok: true; treeSha: string } | { ok: false }> {
    try {
      if (this.reviewSettlementInterrupted(run)) return { ok: false };
      const add = await this.runManagedCommand(run, ["git", "add", "-A", "--", ".", ":(exclude).cursor"], {
        cwd: run.worktree,
        timeoutMs: 120_000
      });
      if (this.reviewSettlementInterrupted(run)) return { ok: false };
      if (add.exitCode !== 0) throw new Error(`git add exit ${add.exitCode}`);
      const writeTree = await this.runManagedCommand(run, ["git", "write-tree"], {
        cwd: run.worktree,
        timeoutMs: 30_000,
        captureStdout: true
      });
      if (this.reviewSettlementInterrupted(run)) return { ok: false };
      const treeSha = writeTree.stdoutTail.trim();
      if (writeTree.exitCode !== 0 || !/^[0-9a-f]{40,64}$/.test(treeSha)) {
        throw new Error(`git write-tree exit ${writeTree.exitCode}`);
      }
      return { ok: true, treeSha };
    } catch (err) {
      if (isProcessGroupLifecycleError(err)) throw this.contaminateLifecycle(err);
      if (run.restartPending) throw err;
      this.finalizeFailure(run, `tree_snapshot_failed:${safeFailureText(err, 100)}`, "failed", "工作区快照失败");
      return { ok: false };
    }
  }

  /** 决策包正文(plan/acceptance;settle barrier 对账源) */
  private packageBodyOf(run: ActiveRun): { plan: { seq: number; owner: "ai" | "human" }[]; acceptance: string[] } | null {
    const row = this.d.db
      .prepare("SELECT project_id, package_id, package_rev, package_digest FROM tasks WHERE id=?")
      .get(run.taskId) as { project_id: string; package_id: string; package_rev: number; package_digest: string } | undefined;
    if (!row) return null;
    try {
      if (row.project_id !== run.projectId || row.package_rev !== run.packageRevision || row.package_digest !== run.packageDigest) return null;
      const pkg = getPackage(this.d.db, row.package_id, row.package_rev);
      if (!pkg || pkg.projectId !== row.project_id || pkg.digest !== row.package_digest || verifyPackageDigest(pkg) !== null) return null;
      return { plan: pkg.plan, acceptance: pkg.acceptance };
    } catch {
      return null;
    }
  }

  /** settle 收口(run 终态 + task 转态 + 回叫入队;coding/writing 共用,09 §6.3 barrier) */
  private commitSettle(run: ActiveRun, treeSha: string, proof: Tier1SettleProof | WritingSettleProof, artifactCheck: string): void {
    const d = this.d;
    const nowIso = this.now().toISOString();
    // 回叫 settleProof 走 Tier1SettleProof 形(callback 契约现形);writing proof 用最小形投影
    const callbackProof: Tier1SettleProof =
      "kind" in proof && proof.kind === "writing"
        ? {
            kind: "tier1",
            taskId: proof.taskId,
            runId: proof.runId,
            attempt: proof.attempt,
            packageRevision: proof.packageRevision,
            treeSha: proof.treeSha,
            tier1VerifyDigest: proof.articleDigest,
            acceptanceChecks: proof.acceptanceChecks,
            transcriptCursor: proof.transcriptCursor,
            settledAt: proof.settledAt
          }
        : (proof as Tier1SettleProof);
    // §6.3 settle barrier:run proof、task 状态、durable outbox、终态审计同一事务；
    // 任一写入失败整体回滚，外层 crash handler 再结算仍为 running 的 run/task。
    const tx = d.db.transaction(() => {
      const markerRow = d.db
        .prepare("SELECT finalize_pending_json FROM tier1_runs WHERE id=?")
        .get(run.runId) as { finalize_pending_json: string | null } | undefined;
      const marker = parsePendingFinalization(markerRow?.finalize_pending_json);
      if (!marker || marker.kind !== "review") {
        throw new Error("review finalize intent missing or changed");
      }
      const inMemory = run.pendingFinalization;
      if (
        !inMemory ||
        inMemory.kind !== "review" ||
        marker.recordedAt !== inMemory.recordedAt ||
        marker.eventLine !== inMemory.eventLine ||
        marker.observedModel !== inMemory.observedModel ||
        JSON.stringify(marker.observedModels) !== JSON.stringify(inMemory.observedModels) ||
        JSON.stringify(marker.resultEvent ?? null) !== JSON.stringify(inMemory.resultEvent ?? null) ||
        JSON.stringify(marker.writingArtifact ?? null) !== JSON.stringify(inMemory.writingArtifact ?? null)
      ) {
        throw new Error("review finalize intent changed concurrently");
      }
      transitionTier1Run(d.db, run.runId, "settled_review", nowIso, {
        treeSha,
        eventCursor: proof.transcriptCursor,
        settleProofJson: JSON.stringify(proof)
      });
      transitionTask(d.db, run.taskId, "ready_for_review", "L", { now: nowIso });
      const enq = d.callbacks.enqueue({
        taskId: run.taskId,
        trigger: "ready_for_review",
        packageRevision: run.packageRevision,
        occurrenceKey: String(run.attempt),
        settleProof: callbackProof,
        projectionCursor: proof.transcriptCursor,
        artifactChecks: [artifactCheck]
      });
      if (enq.entryId === "") {
        throw new Error(`ready_for_review 回叫未持久化:${enq.reason ?? "unknown"}`);
      }
      d.audit.record({
        actor: "daemon",
        action: "tier1.settled_review",
        meta: {
          taskId: run.taskId,
          runId: run.runId,
          attempt: run.attempt,
          treeSha,
          enqueued: enq.enqueued,
          ...this.observedModelAuditMeta(run)
        }
      });
      this.recordRunCost(run);
      const cleared = d.db
        .prepare(
          `UPDATE tier1_runs
           SET finalize_pending_json=NULL, restart_pending_at=NULL, restart_reason=NULL, updated_at=?
           WHERE id=? AND finalize_pending_json IS NOT NULL`
        )
        .run(nowIso, run.runId);
      if (cleared.changes !== 1) throw new Error("review finalize marker clear race");
    });
    try {
      tx();
    } catch (err) {
      throw new Tier1ReviewTransactionError(
        run.runId,
        classifyTier1ReviewTransactionCatch(err),
        err
      );
    }
    delete run.pendingFinalization;
    run.restartPending = false;
    run.resumeRestartMarker = false;
  }

  private async execVerify(run: ActiveRun, argv: string[]): Promise<{ exitCode: number; stdoutTail: string }> {
    // 3.1-②:verify 专用隔离 env——HOME 指向任务专用空目录(只建不删),真实 HOME 不进 env
    const isolatedHome = join(this.runDir(run.runId), "verify-home");
    mkdirSync(isolatedHome, { recursive: true });
    try {
      return await this.runManagedCommand(run, argv, {
        cwd: run.worktree,
        env: verifyEnv(process.env, isolatedHome),
        timeoutMs: this.d.cfg.verifyTimeoutMs ?? 600_000,
        captureStdout: true
      });
    } catch (err) {
      if (isProcessGroupLifecycleError(err)) throw this.contaminateLifecycle(err);
      if (run.restartPending) throw err;
      return { exitCode: 1, stdoutTail: safeFailureText(err, 2_000) };
    }
  }

  /** 用户取消/steer 与失败收口竞态时,显式用户动作优先；进程未退出只发终止信号，退出后再落 proof。 */
  private settleCancellationPriority(run: ActiveRun): boolean {
    const task = this.d.db.prepare("SELECT status FROM tasks WHERE id=?").get(run.taskId) as { status: string } | undefined;
    const runRow = this.d.db.prepare("SELECT state FROM tier1_runs WHERE id=?").get(run.runId) as { state: string } | undefined;
    if (task?.status === "cancel_requested" || task?.status === "cancel_settled") {
      run.abort = { kind: "cancel", detail: "user cancel superseded pending finalization" };
      if (run.proc) run.proc.kill();
      else this.settleCancelledRun(run);
      return true;
    }
    if (task?.status === "running" && runRow?.state === "cancel_requested") {
      run.abort = { kind: "steer_resume", detail: "steer superseded pending finalization" };
      if (run.proc) run.proc.kill();
      else this.settleSteerResumeRun(run);
      return true;
    }
    return false;
  }

  /** review intent 只允许在 durable cancel/steer/restart 均未出现时继续产生 verify/snapshot/artifact 副作用。 */
  private reviewSettlementInterrupted(run: ActiveRun): boolean {
    if (this.settleCancellationPriority(run)) return true;
    const row = this.d.db
      .prepare("SELECT restart_pending_at FROM tier1_runs WHERE id=?")
      .get(run.runId) as { restart_pending_at: string | null } | undefined;
    if (run.restartPending || row?.restart_pending_at) {
      run.restartPending = true;
      run.proc?.kill();
      return true;
    }
    return false;
  }

  /** marker 先于终态事务独立持久化；review 可被后续 verify/snapshot 的真实失败原子替换。 */
  private ensurePendingFinalization(run: ActiveRun, requested: PendingFinalizationIntent): PendingFinalizationIntent {
    const existingRow = this.d.db
      .prepare("SELECT state, finalize_pending_json FROM tier1_runs WHERE id=?")
      .get(run.runId) as { state: string; finalize_pending_json: string | null } | undefined;
    if (!existingRow) throw new Error(`tier1 run not found:${run.runId}`);
    const existing = parsePendingFinalization(existingRow.finalize_pending_json);
    if (existing) {
      if (requested.kind === "failure" && existing.kind === "review") {
        const replaced = this.d.db
          .prepare(
            `UPDATE tier1_runs SET finalize_pending_json=?, updated_at=?
             WHERE id=? AND finalize_pending_json=? AND state IN ('reserved','running','step_paused')`
          )
          .run(JSON.stringify(requested), requested.recordedAt, run.runId, existingRow.finalize_pending_json);
        if (replaced.changes === 1) return requested;
      } else {
        if (existing.kind === "review") {
          this.d.db
            .prepare("UPDATE tier1_runs SET restart_pending_at=NULL, restart_reason=NULL, updated_at=? WHERE id=?")
            .run(existing.recordedAt, run.runId);
        }
        return existing;
      }
    }
    const written = this.d.db
      .prepare(
        requested.kind === "review"
          ? `UPDATE tier1_runs
             SET finalize_pending_json=?, restart_pending_at=NULL, restart_reason=NULL, updated_at=?
             WHERE id=? AND finalize_pending_json IS NULL AND state IN ('reserved','running','step_paused')`
          : `UPDATE tier1_runs SET finalize_pending_json=?, updated_at=?
             WHERE id=? AND finalize_pending_json IS NULL AND state IN ('reserved','running','step_paused')`
      )
      .run(JSON.stringify(requested), requested.recordedAt, run.runId);
    if (written.changes === 1) return requested;
    const raced = this.d.db
      .prepare("SELECT finalize_pending_json FROM tier1_runs WHERE id=?")
      .get(run.runId) as { finalize_pending_json: string | null } | undefined;
    const durable = parsePendingFinalization(raced?.finalize_pending_json);
    if (durable) {
      if (requested.kind === "failure" && durable.kind === "review") {
        const replaced = this.d.db
          .prepare(
            `UPDATE tier1_runs SET finalize_pending_json=?, updated_at=?
             WHERE id=? AND finalize_pending_json=? AND state IN ('reserved','running','step_paused')`
          )
          .run(JSON.stringify(requested), requested.recordedAt, run.runId, raced?.finalize_pending_json);
        if (replaced.changes === 1) return requested;
      } else {
        return durable;
      }
    }
    throw new Error(`finalize marker race:${run.runId}`);
  }

  /** writing 产物引用先写进 durable review marker；重试必须复用同一 id/version。 */
  private ensureWritingArtifactIntent(
    run: ActiveRun,
    expected: Omit<NonNullable<ReviewFinalizationIntent["writingArtifact"]>, "articleArtifactId" | "articleVersion">
  ): NonNullable<ReviewFinalizationIntent["writingArtifact"]> {
    const row = this.d.db
      .prepare("SELECT finalize_pending_json FROM tier1_runs WHERE id=?")
      .get(run.runId) as { finalize_pending_json: string | null } | undefined;
    const marker = parsePendingFinalization(row?.finalize_pending_json);
    if (!marker || marker.kind !== "review") throw new Error(`writing review marker missing:${run.runId}`);
    if (marker.writingArtifact) {
      if (
        marker.writingArtifact.articlePath !== expected.articlePath ||
        marker.writingArtifact.articleDigest !== expected.articleDigest ||
        marker.writingArtifact.treeSha !== expected.treeSha
      ) {
        throw new Error(`writing artifact intent drift:${run.runId}`);
      }
      run.pendingFinalization = marker;
      return marker.writingArtifact;
    }
    const writingArtifact: NonNullable<ReviewFinalizationIntent["writingArtifact"]> = {
      articleArtifactId: newId("art"),
      articleVersion: 1,
      ...expected
    };
    const updatedMarker: ReviewFinalizationIntent = { ...marker, writingArtifact };
    const updated = this.d.db
      .prepare("UPDATE tier1_runs SET finalize_pending_json=?, updated_at=? WHERE id=? AND finalize_pending_json=?")
      .run(JSON.stringify(updatedMarker), this.now().toISOString(), run.runId, row?.finalize_pending_json);
    if (updated.changes === 1) {
      run.pendingFinalization = updatedMarker;
      return writingArtifact;
    }
    const raced = parsePendingFinalization(
      (this.d.db.prepare("SELECT finalize_pending_json FROM tier1_runs WHERE id=?").get(run.runId) as
        | { finalize_pending_json: string | null }
        | undefined)?.finalize_pending_json
    );
    if (
      raced?.kind === "review" &&
      raced.writingArtifact?.articlePath === expected.articlePath &&
      raced.writingArtifact.articleDigest === expected.articleDigest &&
      raced.writingArtifact.treeSha === expected.treeSha
    ) {
      run.pendingFinalization = raced;
      return raced.writingArtifact;
    }
    throw new Error(`writing artifact intent race:${run.runId}`);
  }

  /** 失败/阻塞收尾:durable intent -> run settled_failed + task failed/blocked + 最小 proof 回叫(09 §9;缺一不叫) */
  private finalizeFailure(run: ActiveRun, exitEvidence: string, taskState: "failed" | "blocked", spokenReason?: string): void {
    const d = this.d;
    const nowIso = this.now().toISOString();
    const currentState = (d.db.prepare("SELECT state FROM tier1_runs WHERE id=?").get(run.runId) as
      | { state: string }
      | undefined)?.state;
    // agent owner 存在却未证实 ESRCH 时不得先写任何终态；否则 daemon 在提交后崩溃会遗留仍可产生副作用的孤儿进程。
    if (run.agentOwnershipEstablished && !run.processGroupVerifiedExited) {
      this.contaminateLifecycle(new ProcessGroupLifecycleError(`${currentState ?? "missing"} finalize without ESRCH:${run.runId}`));
      this.resolveClaim(run);
      return;
    }

    if (this.settleCancellationPriority(run)) return;
    let intent: FailureFinalizationIntent = run.pendingFinalization?.kind === "failure" ? run.pendingFinalization : {
      kind: "failure",
      exitEvidence,
      taskState,
      recordedAt: nowIso,
      eventLine: run.eventLine,
      ...(run.observedModel ? { observedModel: run.observedModel } : {}),
      ...(run.observedModels.size > 0 ? { observedModels: [...run.observedModels] } : {}),
      ...(run.resultEvent ? { resultEvent: run.resultEvent } : {}),
      ...(spokenReason !== undefined ? { spokenReason } : {})
    };
    run.pendingFinalization = intent;
    try {
      const durable = this.ensurePendingFinalization(run, intent);
      if (durable.kind !== "failure") throw new Error("failure finalize intent was not persisted");
      intent = durable;
      run.pendingFinalization = durable;
    } catch (err) {
      if (this.settleCancellationPriority(run)) return;
      d.log.error("finalizeFailure marker write failed", { runId: run.runId, error: safeFailureText(err, 160) });
      try {
        d.audit.record({
          actor: "daemon",
          action: "tier1.finalize_transaction_failed",
          meta: { taskId: run.taskId, runId: run.runId, wanted: intent.taskState, stage: "marker", error: safeFailureText(err, 120) }
        });
      } catch {
        // DB/audit 均不可写时保留内存闩并拒绝新认领；不得伪造已持久化。
      }
      this.resolveClaim(run);
      return;
    }

    const clearRestartMarker = run.restartPending || run.resumeRestartMarker;
    try {
      const tx = d.db.transaction(() => {
        const curRun = d.db
          .prepare("SELECT state, finalize_pending_json FROM tier1_runs WHERE id=?")
          .get(run.runId) as { state: string; finalize_pending_json: string | null } | undefined;
        const curTask = d.db.prepare("SELECT status FROM tasks WHERE id=?").get(run.taskId) as { status: string } | undefined;
        if (!curRun || !curTask) throw new Error("finalize target missing");
        if (curTask.status !== "running") throw new Error(`finalize task left running:${curTask.status}`);
        if (!(["reserved", "running", "step_paused"] as const).includes(curRun.state as never)) {
          throw new Error(`finalize run left failure chain:${curRun.state}`);
        }
        const durable = parsePendingFinalization(curRun.finalize_pending_json);
        if (
          !durable ||
          durable.kind !== "failure" ||
          durable.exitEvidence !== intent.exitEvidence ||
          durable.taskState !== intent.taskState ||
          durable.spokenReason !== intent.spokenReason ||
          durable.recordedAt !== intent.recordedAt ||
          durable.eventLine !== intent.eventLine ||
          durable.observedModel !== intent.observedModel ||
          JSON.stringify(durable.observedModels ?? []) !== JSON.stringify(intent.observedModels ?? []) ||
          JSON.stringify(durable.resultEvent ?? null) !== JSON.stringify(intent.resultEvent ?? null)
        ) {
          throw new Error("finalize intent changed concurrently");
        }
        if (clearRestartMarker) {
          d.db
            .prepare("UPDATE tier1_runs SET restart_pending_at=NULL, restart_reason=NULL, updated_at=? WHERE id=?")
            .run(nowIso, run.runId);
        }
        const cur = curRun.state;
        if (cur === "reserved") {
          // reserved 无 -> settled_failed 直边:经取消链落终态(供给失败/起动前异常)
          transitionTier1Run(d.db, run.runId, "cancel_requested", nowIso);
          transitionTier1Run(d.db, run.runId, "cancel_settled", nowIso, {
            cancelProofJson: JSON.stringify({
              taskId: run.taskId,
              runId: run.runId,
              processExited: true,
              worktreeLockReleased: true,
              lastEventId: `pre-start:${exitEvidence.slice(0, 60)}`,
              settledAt: nowIso
            } satisfies Tier1CancelProof)
          });
        } else if (cur === "running" || cur === "step_paused") {
          transitionTier1Run(d.db, run.runId, "settled_failed", nowIso, {
            eventCursor: `events:${run.runId}:line:${run.eventLine}`
          });
        }
        transitionTask(d.db, run.taskId, intent.taskState, "L", { now: nowIso });
        const enq = this.enqueueBlocked(
          run.taskId,
          run.packageRevision,
          intent.exitEvidence,
          intent.spokenReason,
          intent.taskState,
          run
        );
        d.audit.record({
          actor: "daemon",
          action: intent.taskState === "failed" ? "tier1.failed" : "tier1.blocked",
          meta: {
            taskId: run.taskId,
            runId: run.runId,
            exitEvidence: intent.exitEvidence.slice(0, 160),
            enqueued: enq.enqueued,
            ...this.observedModelAuditMeta(run)
          }
        });
        // 没有任何持久化事件的 pre-start 失败不冒充一次订阅调用；其余终态与记账同事务。
        if (run.eventLine > 0) this.recordRunCost(run);
        const cleared = d.db
          .prepare("UPDATE tier1_runs SET finalize_pending_json=NULL, updated_at=? WHERE id=? AND finalize_pending_json IS NOT NULL")
          .run(nowIso, run.runId);
        if (cleared.changes !== 1) throw new Error("finalize marker clear race");
      });
      tx();
    } catch (err) {
      if (this.settleCancellationPriority(run)) return;
      d.log.error("finalizeFailure transaction failed", { runId: run.runId, error: safeFailureText(err, 160) });
      try {
        d.audit.record({
          actor: "daemon",
          action: "tier1.finalize_transaction_failed",
          meta: {
            taskId: run.taskId,
            runId: run.runId,
            wanted: intent.taskState,
            stage: "terminal",
            error: safeFailureText(err, 120)
          }
        });
      } catch {
        // 审计存储自身不可写时只留日志,不得用半提交状态补偿。
      }
      this.resolveClaim(run);
      return;
    }
    delete run.pendingFinalization;
    if (clearRestartMarker) {
      run.restartPending = false;
      run.resumeRestartMarker = false;
    }
    this.resolveClaim(run);
    this.active.delete(run.runId);
  }

  private enqueueBlocked(
    taskId: string,
    packageRevision: number,
    exitEvidence: string,
    _spokenReason?: string,
    trigger: "failed" | "blocked" = "blocked",
    run?: ActiveRun
  ): { entryId: string; enqueued: boolean; reason?: string } {
    const result = this.d.callbacks.enqueue({
      taskId,
      trigger,
      packageRevision,
      occurrenceKey: trigger === "failed" ? String(run?.attempt ?? 1) : exitEvidence.slice(0, 80), // 09 §6.3:failed=attempt / blocked=事件锚
      minimalProof: {
        exitEvidence: exitEvidence.slice(0, 200),
        transcriptCursor: run ? `events:${run.runId}:line:${run.eventLine}` : `task:${taskId}@${this.now().toISOString()}`
      },
      projectionCursor: `local:${this.now().toISOString()}`,
      artifactChecks: []
    });
    if (!result.enqueued && result.reason !== "dedupe active-unique") {
      throw new Error(`blocked/failed callback enqueue rejected:${result.reason ?? "unknown"}`);
    }
    return result;
  }

  /** 用户取消链收尾:进程已退,Tier1CancelProof -> cancel_settled(operations.settleCancel 单源) */
  private settleCancelledRun(run: ActiveRun): void {
    const nowIso = this.now().toISOString();
    if (run.agentOwnershipEstablished && !run.processGroupVerifiedExited) {
      this.contaminateLifecycle(
        new ProcessGroupLifecycleError(`cancel settle without ESRCH:${run.runId}`)
      );
      this.resolveClaim(run);
      return;
    }
    const proof: Tier1CancelProof = {
      taskId: run.taskId,
      runId: run.runId,
      processExited: true,
      worktreeLockReleased: true,
      lastEventId: `events:${run.runId}:line:${run.eventLine}`,
      settledAt: nowIso
    };
    try {
      const tx = this.d.db.transaction(() => {
        settleCancel(this.d.db, this.d.audit, proof, nowIso);
        if (run.eventLine > 0) this.recordRunCost(run);
      });
      tx();
    } catch (err) {
      this.d.log.error("settleCancel failed", { runId: run.runId, error: safeFailureText(err, 160) });
      this.resolveClaim(run);
      return;
    }
    delete run.pendingFinalization;
    this.resolveClaim(run);
    this.active.delete(run.runId);
  }

  /**
   * W5a 3.4 cancel_resume 结算(run 级;09 §13 词表):proof 齐备落 run cancel_settled,
   * **任务保持 running**(与用户取消的任务级结算判然有别)——worktree 保留(按 taskId
   * 确定性路径,provisionWorktree 幂等复用),下个 tick 认领循环按"running 无活跃 run"
   * 捡起,新 attempt 经 readTaskMessages 注入 steer 指令(新 spec 编译进下次 run)。
   * 竞态守卫(批末 review B,2026-07-27):steer 杀进程与 settle 之间用户对同一任务发起取消
   * (task→cancel_requested)⇒ 改走 task 级结算,否则任务永久卡 cancel_requested(run 级
   * 只结算 run,不回读 task)——用户取消优先级高于 steer 重跑。
   */
  private settleSteerResumeRun(run: ActiveRun): void {
    const taskStatus = (this.d.db.prepare("SELECT status FROM tasks WHERE id=?").get(run.taskId) as { status: string } | undefined)?.status;
    if (taskStatus === "cancel_requested") {
      this.settleCancelledRun(run); // 用户取消抢先:落 task 级 cancel_settled,不留 steer 重跑
      return;
    }
    const nowIso = this.now().toISOString();
    if (run.agentOwnershipEstablished && !run.processGroupVerifiedExited) {
      this.contaminateLifecycle(
        new ProcessGroupLifecycleError(`steer settle without ESRCH:${run.runId}`)
      );
      this.resolveClaim(run);
      return;
    }
    const proof: Tier1CancelProof = {
      taskId: run.taskId,
      runId: run.runId,
      processExited: true,
      worktreeLockReleased: true,
      lastEventId: `events:${run.runId}:line:${run.eventLine}`,
      settledAt: nowIso
    };
    try {
      const tx = this.d.db.transaction(() => {
        const currentTask = this.d.db.prepare("SELECT status FROM tasks WHERE id=?").get(run.taskId) as { status: string } | undefined;
        if (currentTask?.status !== "running") throw new Error(`steer task left running:${currentTask?.status ?? "missing"}`);
        transitionTier1Run(this.d.db, run.runId, "cancel_settled", nowIso, { cancelProofJson: JSON.stringify(proof) });
        this.d.db
          .prepare(
            "UPDATE tier1_runs SET finalize_pending_json=NULL, restart_pending_at=NULL, restart_reason=NULL, updated_at=? WHERE id=?"
          )
          .run(nowIso, run.runId);
        this.d.audit.record({
          actor: "daemon",
          action: "tier1.steer_resume_settled",
          meta: { taskId: run.taskId, runId: run.runId, attempt: run.attempt, lastEventId: proof.lastEventId }
        });
        if (run.eventLine > 0) this.recordRunCost(run);
      });
      tx();
    } catch (err) {
      const latestTask = (this.d.db.prepare("SELECT status FROM tasks WHERE id=?").get(run.taskId) as { status: string } | undefined)?.status;
      if (latestTask === "cancel_requested") {
        this.settleCancelledRun(run);
        return;
      }
      this.d.log.error("settleSteerResume failed", { runId: run.runId, error: safeFailureText(err, 160) });
      this.resolveClaim(run);
      return;
    }
    delete run.pendingFinalization;
    this.resolveClaim(run);
    this.active.delete(run.runId);
  }

  // ---------- §12-7 恢复(daemon 重启:按 (adapter,nativeSessionId,cwd) 恢复或降级新会话) ----------

  async recover(): Promise<void> {
    const abort = this.d.recoverAbort;
    const throwIfAborted = (): void => {
      if (abort?.aborted) throw new ProcessGroupLifecycleError("runtime recover aborted");
    };
    if (abort?.aborted) return;
    this.d.onRecoverEntered?.();
    try {
      await withHomeOwnerBoundary(this.d.cfg.saydoHome, async () => {
        throwIfAborted();
        if (!this.d.recoverHold) return;
        if (!abort) {
          await this.d.recoverHold;
          throwIfAborted();
          return;
        }
        await Promise.race([
          this.d.recoverHold,
          new Promise<void>((resolve) => {
            if (abort.aborted) {
              resolve();
              return;
            }
            abort.addEventListener("abort", () => resolve(), { once: true });
          })
        ]);
        throwIfAborted();
      }, abort ? { signal: abort } : {});
      throwIfAborted();
      this.d.onRecoverAttempt?.();
      throwIfAborted();
    } catch (err) {
      if (abort?.aborted) return;
      throw err;
    }
    let rows = this.d.db
      .prepare(`SELECT * FROM tier1_runs WHERE state IN ${ACTIVE_RUN_STATES}`)
      .all() as Record<string, unknown>[];
    // 两阶段恢复：先对全部 durable 行完成 ownership 回收与 JSON/工作区预检；任何一行
    // fail-closed 时都尚未 spawn，避免后行异常把前行新进程杀成 failed。
    const reapOutcomes = new Map<string, OrphanAgentReapOutcome>();
    for (const raw of rows) {
      try {
        const runId = raw["id"] as string;
        reapOutcomes.set(runId, await this.killOrphanAgent(runId));
        throwIfAborted();
      } catch (err) {
        if (abort?.aborted) return;
        // 旧组未 ESRCH：污染 lifecycle 并阻断 ready（A1/A3）。
        throw this.contaminateLifecycle(err);
      }
    }
    // reap 可能等待数秒；期间 cancel/steer 会改 durable 状态。之后必须重读，旧快照不得决定 spawn。
    rows = this.d.db
      .prepare(`SELECT * FROM tier1_runs WHERE state IN ${ACTIVE_RUN_STATES}`)
      .all() as Record<string, unknown>[];

    type RecoverTask = {
      id: string;
      project_id: string;
      title: string;
      status: string;
      package_digest: string | null;
      package_rev: number | null;
      budget_json: string;
      workspace_json: string | null;
    };
    type RecoverPreflight = {
      raw: Record<string, unknown>;
      runId: string;
      taskId: string;
      state: string;
      task: RecoverTask | undefined;
      repoPath: string | null;
      budget: ActiveRun["budget"] | null;
      pendingFinalization: PendingFinalizationIntent | null;
    };
    const preflight: RecoverPreflight[] = [];
    for (const raw of rows) {
      const runId = raw["id"] as string;
      const taskId = raw["task_id"] as string;
      const state = raw["state"] as string;
      const task = this.d.db
        .prepare(
          `SELECT t.id, t.project_id, t.title, t.status, t.package_digest, t.package_rev, t.budget_json, p.workspace_json
           FROM tasks t LEFT JOIN projects p ON p.id=t.project_id WHERE t.id=?`
        )
        .get(taskId) as RecoverTask | undefined;
      let pendingFinalization = parsePendingFinalization(raw["finalize_pending_json"]);
      const nowIso = this.now().toISOString();
      const recordedAdapter =
        raw["adapter"] === "claude_code" ? "claude_code" : raw["adapter"] === "cursor" ? "cursor" : null;
      const recoveryBackend =
        recordedAdapter === "claude_code" ? claudeBackend() : recordedAdapter === "cursor" ? cursorBackend() : this.backend;
      if (!pendingFinalization && state !== "cancel_requested" && task?.status === "running") {
        const snapshot = this.durableEventSnapshot(runId, raw["event_cursor"], undefined, recoveryBackend);
        const consistency = checkRunAdapterConsistency(String(raw["adapter"] ?? ""), this.backend.adapter);
        if (!consistency.consistent) {
          const intent = this.failureIntentFromSnapshot(snapshot, {
            exitEvidence: `adapter_mismatch:${consistency.rowAdapter}->${consistency.effectiveAdapter}`,
            taskState: "blocked",
            spokenReason: "执行后端已切换,这轮不能接续,需要你看一眼",
            recordedAt: nowIso
          });
          if (!this.tryPersistFailureIntent(runId, raw, intent)) {
            throw new Error(`adapter mismatch marker race:${runId}`);
          }
          pendingFinalization = intent;
        } else if (snapshot.resultEvent && !(reapOutcomes.get(runId) === "already_exited" && raw["restart_pending_at"] === null)) {
          const intent = this.failureIntentFromSnapshot(snapshot, {
            exitEvidence: "stale_terminal_result_without_finalization",
            taskState: "failed",
            spokenReason: "上一轮结果没有可靠收口,这轮不能接着跑,需要你看一眼",
            recordedAt: nowIso
          });
          if (!this.tryPersistFailureIntent(runId, raw, intent)) {
            pendingFinalization = parsePendingFinalization(raw["finalize_pending_json"]);
            if (!pendingFinalization) throw new Error(`stale result marker race:${runId}`);
          } else {
            pendingFinalization = intent;
            this.d.audit.record({
              actor: "daemon",
              action: "tier1.recover_stale_terminal_result",
              meta: { taskId, runId, eventLine: snapshot.eventLine }
            });
          }
        } else if (reapOutcomes.get(runId) === "already_exited" && raw["restart_pending_at"] === null) {
          const intent = this.failureIntentFromSnapshot(snapshot, {
            exitEvidence: "daemon_crash_after_agent_exit",
            taskState: "failed",
            recordedAt: nowIso
          });
          if (this.tryPersistFailureIntent(runId, raw, intent)) {
            pendingFinalization = intent;
            this.d.audit.record({
              actor: "daemon",
              action: "tier1.recover_agent_exited_unsettled",
              meta: { taskId, runId, eventLine: snapshot.eventLine }
            });
          }
        }
      }
      if (pendingFinalization && raw["restart_pending_at"]) {
        this.clearRestartMarkerForFinalization(runId, nowIso);
        raw["restart_pending_at"] = null;
        raw["restart_reason"] = null;
      }
      let repoPath: string | null = null;
      let budget: ActiveRun["budget"] | null = null;
      if ((pendingFinalization || state === "cancel_requested") && task) {
        // 旧进程组已在第一阶段确认 ESRCH；收口路径不依赖工作区仍存在，也绝不重新 spawn。
        repoPath = String(raw["cwd"] ?? raw["worktree_path"] ?? "");
        budget = JSON.parse(task.budget_json) as ActiveRun["budget"];
      } else if (task) {
        repoPath = tier1RecoveryPrerequisite(this.d.db, {
          run_id: runId,
          task_id: taskId,
          project_id: task.project_id,
          state,
          worktree_path: raw["worktree_path"] as string
        });
        if (task.status === "running" && repoPath) {
          budget = JSON.parse(task.budget_json) as ActiveRun["budget"];
        }
      }
      preflight.push({ raw, runId, taskId, state, task, repoPath, budget, pendingFinalization });
    }

    const runnable: Array<{ active: ActiveRun; wasReserved: boolean; settleOnly: boolean }> = [];
    for (const item of preflight) {
      const { raw, runId, taskId, state, task, repoPath, budget, pendingFinalization: preflightPending } = item;
      if (reapOutcomes.get(runId) === "identity_changed") {
        this.d.audit.record({
          actor: "daemon",
          action: "tier1.recover_owner_identity_changed",
          meta: { runId, taskId }
        });
        continue;
      }
      let pendingFinalization = preflightPending;
      const nowIso = this.now().toISOString();
      const recordedAdapter = raw["adapter"] === "claude_code" ? "claude_code" : raw["adapter"] === "cursor" ? "cursor" : null;
      const recoveryBackend = recordedAdapter === "claude_code" ? claudeBackend() : recordedAdapter === "cursor" ? cursorBackend() : this.backend;
      if (pendingFinalization?.kind === "review" && !pendingFinalization.resultEvent) {
        const rawMarker = raw["finalize_pending_json"] as string;
        const snapshot = this.durableEventSnapshot(
          runId,
          raw["event_cursor"],
          pendingFinalization.eventLine > 0 ? pendingFinalization.eventLine : undefined,
          recoveryBackend
        );
        if (snapshot.resultEvent) {
          const repaired: ReviewFinalizationIntent = {
            ...pendingFinalization,
            eventLine: pendingFinalization.eventLine > 0 ? pendingFinalization.eventLine : snapshot.eventLine,
            resultEvent: snapshot.resultEvent
          };
          const updated = this.d.db
            .prepare("UPDATE tier1_runs SET finalize_pending_json=?, updated_at=? WHERE id=? AND finalize_pending_json=?")
            .run(JSON.stringify(repaired), nowIso, runId, rawMarker);
          if (updated.changes !== 1) throw new Error(`review result recovery race:${runId}`);
          raw["finalize_pending_json"] = JSON.stringify(repaired);
          pendingFinalization = repaired;
        }
      }
      const recoverySnapshot = this.durableEventSnapshot(
        runId,
        raw["event_cursor"],
        pendingFinalization ? pendingFinalization.eventLine : undefined,
        recoveryBackend
      );
      const settlesAfterRecovery =
        !!task &&
        !!repoPath &&
        !!budget &&
        (pendingFinalization !== null || state === "cancel_requested") &&
        (task.status === "running" || task.status === "cancel_requested" || task.status === "cancel_settled");
      if (!settlesAfterRecovery && (!task || task.status !== "running" || !repoPath || !budget)) {
        // code-review B2:活跃 run 但 task 非 running(数据不一致)——不能 continue 泄漏
        // (每次重启重新捞到、无谓拉起、状态永不收敛)。清旧孤儿 + run 落终态(经取消链,
        // 不动已终结的 task)。task 缺失/无 workspace 同样终结 run。
        try {
          this.d.db
            .prepare("UPDATE tier1_runs SET restart_pending_at=NULL, restart_reason=NULL, updated_at=? WHERE id=?")
            .run(nowIso, runId);
          if (state === "running" || state === "step_paused" || state === "reserved") {
            transitionTier1Run(this.d.db, runId, "cancel_requested", nowIso);
          }
          if (state === "running" || state === "step_paused" || state === "reserved" || state === "cancel_requested") {
            transitionTier1Run(this.d.db, runId, "cancel_settled", nowIso, {
              cancelProofJson: JSON.stringify({
                taskId,
                runId,
                processExited: true,
                worktreeLockReleased: true,
                lastEventId: `recovered-inconsistent:${state}`,
                settledAt: nowIso
              } satisfies Tier1CancelProof)
            });
            this.d.db
              .prepare(
                "UPDATE tier1_runs SET finalize_pending_json=NULL, restart_pending_at=NULL, restart_reason=NULL, updated_at=? WHERE id=?"
              )
              .run(nowIso, runId);
          }
        } catch (err) {
          this.d.log.error("recover reap inconsistent run failed", { runId, error: safeFailureText(err, 160) });
        }
        this.d.audit.record({
          actor: "daemon",
          action: "tier1.recover_reaped_inconsistent",
          meta: { runId, taskId, taskStatus: task?.status ?? "missing", runState: state }
        });
        continue;
      }
      // P0 恢复策略 = 降级"摘要+diff 注入新会话"(同 run 行续用;resume --resume <chatId> 属加分项,
      // chatId 采集待 e2e 实测事件流后接——诚实登记,不假装已恢复原会话)
      const active: ActiveRun = {
        adapter: recordedAdapter ?? this.backend.adapter,
        runId,
        taskId,
        projectId: task.project_id,
        attempt: raw["attempt"] as number,
        worktree: raw["worktree_path"] as string,
        repoPath,
        taskTitle: task.title,
        packageDigest: task.package_digest ?? "",
        packageRevision: task.package_rev ?? 1,
        dispatchTurnRef: this.lookupDispatchTurnRef(task.package_digest),
        budget,
        frozen: pendingFinalization?.kind === "review" ? this.loadFrozen(runId) : settlesAfterRecovery ? [] : this.loadFrozen(runId),
        registry: { packageScripts: [], justfileTasks: [] },
        articlePath: this.safeArticlePath(repoPath),
        protectedBranches: this.d.cfg.protectedBranches ?? [],
        shellStarted: 0,
        canarySuspect: false,
        gateSeq: 0,
        toolCalls: Number(raw["budget_tool_calls"] ?? 0),
        budgetActiveMs: Number(raw["budget_active_ms"] ?? 0),
        startedMs: Date.now(),
        approvalWaitMs: 0,
        approvalWaitingSince: null,
        approvalWaitDepth: 0,
        s2Pending: false,
        unknownEventCount: 0,
        eventLine: Math.max(pendingFinalization?.eventLine ?? 0, recoverySnapshot.eventLine),
        observedModel: pendingFinalization?.observedModel ?? recoverySnapshot.observedModel,
        resultText: "",
        terminalResultReceived: Boolean(
          settlesAfterRecovery &&
            (pendingFinalization?.kind === "review" ||
              pendingFinalization?.resultEvent !== undefined ||
              recoverySnapshot.resultEvent !== null)
        ),
        proc: null,
        completion: null,
        restartPending: false,
        restartEpoch: 0,
        resumeRestartMarker: raw["restart_pending_at"] !== null && raw["restart_pending_at"] !== undefined,
        resumeMarkerEpoch: this.shutdownEpoch,
        ...streamRuntimeFields(),
        resumeSessionConfirmed: false,
        resumeSessionError: null,
        agentOwnershipEstablished: settlesAfterRecovery && state !== "reserved",
        nativeResumeAudited: false,
        processGroupVerifiedExited: settlesAfterRecovery,
        terminationCause: null,
        claimReady: null,
        claimPromise: null,
        abort:
          state === "cancel_requested" || task.status === "cancel_requested" || task.status === "cancel_settled"
            ? { kind: task.status === "running" ? "steer_resume" : "cancel", detail: "durable recovery settlement" }
            : null,
        model: this.resolveRunModel(task.project_id, runId),
        hooksJsonPath: null,
        ...(pendingFinalization ? { pendingFinalization } : {})
      };
      active.observedModels = new Set(
        pendingFinalization
          ? pendingFinalization.kind === "review"
            ? pendingFinalization.observedModels
            : pendingFinalization.observedModels ?? recoverySnapshot.observedModels
          : recoverySnapshot.observedModels
      );
      active.resultEvent = settlesAfterRecovery
        ? (pendingFinalization?.resultEvent ?? recoverySnapshot.resultEvent)
        : null;
      let resolveClaim!: () => void;
      active.claimPromise = new Promise<void>((resolve) => { resolveClaim = resolve; });
      active.claimReady = resolveClaim;
      runnable.push({ active, wasReserved: state === "reserved", settleOnly: settlesAfterRecovery });
    }

    if (abort?.aborted) return;
    for (const { active } of runnable) this.active.set(active.runId, active);
    for (const { active, wasReserved, settleOnly } of runnable) {
      if (abort?.aborted) return;
      const { runId } = active;
      if (settleOnly) {
        if (active.abort?.kind === "cancel") this.settleCancelledRun(active);
        else if (active.abort?.kind === "steer_resume") this.settleSteerResumeRun(active);
        else if (active.pendingFinalization?.kind === "failure") {
          const pending = active.pendingFinalization;
          this.finalizeFailure(active, pending.exitEvidence, pending.taskState, pending.spokenReason);
        } else if (active.pendingFinalization?.kind === "review") {
          await this.settlePendingReview(active);
        }
        continue;
      }
      active.completion = this.recoverAttempt(active, wasReserved).catch((err: unknown) => {
        this.resolveClaim(active);
        if (active.restartPending) return;
        if (isProcessGroupLifecycleError(err)) {
          this.contaminateLifecycle(err);
          this.d.log.error("tier1 recover crashed", { runId, error: safeFailureText(err, 200) });
          return;
        }
        const text = safeFailureText(err, 200);
        this.d.log.error("tier1 recover crashed", { runId, error: text });
        this.finalizeFailure(active, `recover_crash:${text.slice(0, 120)}`, "failed");
      });
    }
    // A3: recover 返回认领 barrier——每条非终态 run 完成 owner/session 或 terminal 分类。
    await Promise.all(runnable.map(({ active }) => active.claimPromise ?? Promise.resolve()));
    if (abort?.aborted) return;
    if (this.lifecycleContaminated) throw this.lifecycleContaminated;
  }

  private async recoverAttempt(run: ActiveRun, wasReserved: boolean): Promise<void> {
    if (this.d.recoverAbort?.aborted) {
      this.resolveClaim(run);
      return;
    }
    // recover() 已在登记本轮 active/spawn 前等待旧进程组 ESRCH，防同 worktree 双 agent。
    if (run.restartPending) {
      this.resolveClaim(run);
      return;
    }
    // reserved:供给可能半程,重走 runAttempt 全链(幂等);running:同 run 注入新会话续跑
    if (wasReserved) {
      await this.runAttempt(run, { reservedRecover: true });
      this.resolveClaim(run);
      return;
    }
    const d = this.d;
    let pcfg: ProjectExecConfig;
    try {
      pcfg = readProjectExecConfig(run.repoPath);
      this.applyProjectFullConfig(run); // 恢复链同样消费项目层保护面(不消费则恢复 run 丢 [git].protected = 安全回退)
    } catch (err) {
      this.finalizeFailure(run, `project_toml_invalid:${safeFailureText(err, 100)}`, "blocked");
      return;
    }
    run.registry = pcfg.registry;
    if (run.frozen.length === 0) {
      // 冻结产物丢失(runDir 被清):按认领时点语义无法重建(agent 可能已改脚本)——fail-closed 重冻自主仓
      try {
        run.frozen = pcfg.verifyRefs.map((ref) => freezeVerify(run.repoPath, ref, pcfg.registry));
        d.audit.record({ actor: "daemon", action: "tier1.recover_refroze_verify", meta: { runId: run.runId } });
      } catch (err) {
        this.finalizeFailure(run, `verify_freeze_failed:${safeFailureText(err, 100)}`, "blocked");
        return;
      }
    }
    try {
      await this.provisionWorktree(run); // 幂等(worktree 已存在只补 hooks.json)
      await this.d.afterProvision?.();
      if (this.d.recoverAbort?.aborted) {
        this.resolveClaim(run);
        return;
      }
    } catch (err) {
      if (isProcessGroupLifecycleError(err)) {
        this.resolveClaim(run);
        throw this.contaminateLifecycle(err);
      }
      if (run.restartPending) {
        this.resolveClaim(run);
        throw err;
      }
      this.finalizeFailure(run, `provision_failed:${safeFailureText(err, 100)}`, "blocked");
      return;
    }
    if (run.restartPending) {
      this.resolveClaim(run);
      return;
    }
    if (this.settleCancellationPriority(run)) return;
    const prompt = this.buildPrompt(run, true);
    // W1.4(0.0(a) 清账):有恢复钥匙走 --resume <chatId> 精确恢复原会话(§12-7 (adapter,
    // nativeSessionId,cwd));无钥匙降级"摘要+diff 注入新会话"(旧行为)。resume prompt 仍带
    // 摘要注入:原会话有历史时冗余无害,chatId 失效被 agent 当新会话时是唯一上下文(双保险)。
    const nativeKey = this.readNativeResumeKey(run);
    const nativeSessionId = nativeKey.nativeSessionId;
    // B3: graceful prior-running marker 仅 exact native key 可恢复；无钥匙不得冒充 resumed。
    if (run.resumeRestartMarker && nativeSessionId === null) {
      this.finalizeFailure(
        run,
        `graceful_resume_requires_native_session:${nativeKey.reason}`,
        "failed",
        "优雅停机恢复需要精确会话钥匙,这轮不能自动续跑"
      );
      return;
    }
    let resumeChatId: string | undefined;
    let sessionId: string | undefined;
    if (nativeSessionId !== null) {
      run.expectedSessionIdentity = nativeSessionId;
      run.isResume = true;
      resumeChatId = nativeSessionId;
    } else {
      this.d.audit.record({
        actor: "daemon",
        action: "tier1.recover_degraded_new_session",
        meta: {
          runId: run.runId,
          taskId: run.taskId,
          attempt: run.attempt,
          reason: nativeKey.reason,
          expectedSessionIdentity: null,
          isResume: false
        }
      });
      run.nativeResumeAudited = true;
      run.isResume = false;
      if (this.backend.adapter === "claude_code") {
        sessionId = this.bindClaudeFirstSession(run);
      } else {
        run.expectedSessionIdentity = null;
      }
    }
    let proc: AgentProcessHandle;
    try {
      this.discardUnqualifiedTerminalResult(run);
      proc = this.spawnAgent(run, prompt, resumeChatId, sessionId);
    } catch (err) {
      if (isTier1BinaryIdentityError(err)) {
        this.finalizeBinaryIdentityFailure(run, err);
        return;
      }
      throw projectUnknownFailure(err);
    }
    run.proc = proc;
    const eventsPath = join(this.runDir(run.runId), "events.jsonl");
    proc.onLine((line) => this.consumeEventLine(run, line, eventsPath));
    await this.establishAgentOwnership(run, proc);
    run.agentOwnershipEstablished = true;
    if (nativeSessionId === null) {
      this.markRestartResumed(run);
      this.resolveClaim(run);
    } else {
      // 等 system.init 确认 exact session，或新 prepare 挂起 / 终局 abort。
      const claimStartedAt = runtimeNow();
      const claimDeadlineAt = claimStartedAt + 30_000;
      while (
        !run.resumeSessionConfirmed &&
        !run.resumeSessionError &&
        !run.restartPending &&
        !run.abort
      ) {
        const now = runtimeNow();
        if (now >= claimDeadlineAt || now < claimStartedAt) break;
        await new Promise((resolve) => {
          runtimeSetTimeout(() => resolve(undefined), 10);
        });
      }
      // A2: proc.wait 前先尊重新的 shutdown suspension。
      if (run.restartPending) {
        this.resolveClaim(run);
      } else if (run.resumeSessionConfirmed) {
        this.acceptNativeResume(run, nativeSessionId);
        this.resolveClaim(run);
      } else if (run.abort) {
        this.resolveClaim(run);
      } else {
        try { proc.kill(); } catch { /* wait 收口 */ }
        try {
          await proc.wait();
          run.processGroupVerifiedExited = true;
        } catch (err) {
          if (isProcessGroupLifecycleError(err)) throw this.contaminateLifecycle(err);
        }
        run.proc = null;
        this.finalizeFailure(
          run,
          run.resumeSessionError ?? "native_session_confirmation_missing",
          "failed",
          "恢复进程没有确认原生会话身份,这轮结果作废"
        );
        await this.clearAgentOwnershipAfterDurable(run);
        return;
      }
    }
    try {
      const waited = await proc.wait();
      this.captureProcTail(run, proc);
      run.proc = null;
      run.processGroupVerifiedExited = true;
      run.terminationCause = waited.terminationCause ?? "exit";
      // A2: wait 返回后再次优先处理新 suspension / abort，再看 session。
      if (run.restartPending || run.abort) {
        try {
          await this.settleAttempt(run, waited.exitCode);
        } finally {
          await this.clearAgentOwnershipAfterDurable(run);
        }
        return;
      }
      if (nativeSessionId !== null && !run.resumeSessionConfirmed) {
        this.finalizeFailure(
          run,
          run.resumeSessionError ?? "native_session_confirmation_missing",
          "failed",
          "恢复进程没有确认原生会话身份,这轮结果作废"
        );
        await this.clearAgentOwnershipAfterDurable(run);
        return;
      }
      if (await this.retryResumeNotFoundOnce(run, waited, eventsPath)) return;
      try {
        await this.settleAttempt(run, waited.exitCode);
      } finally {
        await this.clearAgentOwnershipAfterDurable(run);
      }
    } catch (err) {
      run.proc = null;
      if (isProcessGroupLifecycleError(err)) throw this.contaminateLifecycle(err);
      throw err;
    }
  }

  private loadFrozen(runId: string): FrozenVerify[] {
    try {
      return JSON.parse(readFileSync(join(this.d.cfg.saydoHome, "tier1", "runs", runId, "frozen-verify.json"), "utf8")) as FrozenVerify[];
    } catch {
      return [];
    }
  }

  private async clearAgentOwnership(run: ActiveRun): Promise<void> {
    const cleared = await this.clearAgentOwnershipAfterDurable(run);
    if (!cleared) {
      await releaseAgentOwnershipAfterDurable(this.d.cfg.saydoHome, run.runId, run.capturedAgentOwner, undefined);
      delete run.capturedAgentOwner;
    }
  }

  /** ownership 只能在 marker/restart/终态至少一个已 durable 后清除，避免退出后崩溃被恢复为二次 spawn。 */
  private async clearAgentOwnershipAfterDurable(run: ActiveRun): Promise<boolean> {
    const row = this.d.db
      .prepare("SELECT state, finalize_pending_json, restart_pending_at FROM tier1_runs WHERE id=?")
      .get(run.runId) as
      | { state: string; finalize_pending_json: string | null; restart_pending_at: string | null }
      | undefined;
    const cleared = await releaseAgentOwnershipAfterDurable(
      this.d.cfg.saydoHome,
      run.runId,
      run.capturedAgentOwner,
      row
    );
    if (cleared) delete run.capturedAgentOwner;
    return cleared;
  }

  private markRestartResumed(run: ActiveRun): void {
    if (!run.resumeRestartMarker) return;
    // A2: 新一代 prepare 已挂 restartPending 时拒绝清 marker。
    if (run.restartPending && run.restartEpoch > run.resumeMarkerEpoch) {
      this.d.audit.record({
        actor: "daemon",
        action: "tier1.restart_resume_refused_newer_epoch",
        meta: {
          runId: run.runId,
          taskId: run.taskId,
          resumeEpoch: run.resumeMarkerEpoch,
          pendingEpoch: run.restartEpoch
        }
      });
      return;
    }
    const row = this.d.db
      .prepare("SELECT restart_pending_at AS pending FROM tier1_runs WHERE id=?")
      .get(run.runId) as { pending: string | null } | undefined;
    // 内存未置 restartPending 但 DB 已被更新一代 prepare 写过：同样拒绝。
    if (run.restartPending) return;
    if (!row?.pending && !run.resumeRestartMarker) return;
    const nowIso = this.now().toISOString();
    const cleared = this.d.db
      .prepare(
        `UPDATE tier1_runs SET restart_pending_at=NULL, restart_reason=NULL, updated_at=?
         WHERE id=? AND (restart_pending_at IS NOT NULL)`
      )
      .run(nowIso, run.runId);
    if (cleared.changes === 0 && run.restartPending) return;
    run.resumeRestartMarker = false;
    this.d.audit.record({
      actor: "daemon",
      action: "tier1.restart_resumed",
      meta: { runId: run.runId, taskId: run.taskId, attempt: run.attempt, epoch: run.resumeMarkerEpoch }
    });
  }

  private safeGit(cwd: string, args: string[]): string {
    try {
      return execFileSync("git", args, { cwd, encoding: "utf8", timeout: 10_000 });
    } catch {
      return "";
    }
  }

  /** spawn 返回 PID 后先同步落 legacy 锚；started 后再原子发布完整 ownership。 */
  private async establishAgentOwnership(run: ActiveRun, proc: AgentProcessHandle): Promise<void> {
    const runDir = this.runDir(run.runId);
    try {
      await withHomeOwnerBoundary(this.d.cfg.saydoHome, () => {
        writeFileSync(join(runDir, "agent.pid"), String(proc.pid), { mode: 0o600 });
      });
      await proc.started;
      if (proc.ownershipRequired !== true) {
        // 注入式测试/内存 spawner 没有可由 OS 复核的进程身份，不能把占位 PID 留成 durable 假锚。
        rmSync(join(runDir, "agent.pid"), { force: true });
        return;
      }
      const startedAt = runtimeNow();
      const deadline = startedAt + 2_000;
      let processStart: string | null = null;
      while (processStart === null) {
        const t = runtimeNow();
        if (t >= deadline || t < startedAt) break;
        processStart = hostKind() === "win32"
          ? (proc.processHandle !== undefined
            ? processBirthFromHandle(proc.processHandle, proc.pid)
            : null)
          : (readOwnedAgentProcessStart(proc.pid, process.execPath, proc.commandToken) ??
            readOwnedAgentProcessStart(proc.pid, this.d.cfg.lockedBinary, proc.commandToken));
        if (processStart === null) {
          await new Promise((resolve) => {
            runtimeSetTimeout(() => resolve(undefined), 20);
          });
        }
      }
      if (processStart === null && run.terminalResultReceived) {
        await proc.wait();
        return;
      }
      if (!processStart) throw new Error("agent process ownership identity unavailable");
      const ownerPath = join(runDir, "agent-owner.json");
      const jobName = proc.jobName;
      const generation = proc.generation;
      const commandToken = proc.commandToken;
      if (!jobName || !generation || !commandToken) {
        throw new Error("agent process ownership identity unavailable");
      }
      const identity = runtimeChildOwnerIdentity();
      const record: AgentOwnershipRecord = {
        version: 1,
        runId: run.runId,
        pid: proc.pid,
        binary: this.d.cfg.lockedBinary,
        worktree: run.worktree,
        processStart,
        kind: "tier1:agent",
        jobName,
        commandToken,
        generation,
        ownerPid: identity.ownerPid,
        ownerInstanceId: identity.ownerInstanceId
      };
      await publishAgentOwnerUnderHomeLock(this.d.cfg.saydoHome, ownerPath, record);
      run.capturedAgentOwner = {
        version: 1,
        pid: record.pid,
        processStart: record.processStart,
        ownerPid: record.ownerPid,
        ownerInstanceId: record.ownerInstanceId,
        runId: record.runId,
        jobName: record.jobName,
        binary: record.binary,
        kind: record.kind,
        commandToken: record.commandToken,
        generation: record.generation
      };
      proc.ownershipEstablished?.();
    } catch (err) {
      try {
        proc.kill();
      } catch {
        // proc.wait 是最终收口判据。
      }
      try {
        await proc.wait();
      } catch (waitErr) {
        if (isProcessGroupLifecycleError(waitErr)) throw this.contaminateLifecycle(waitErr);
      }
      throw err;
    }
  }

  /** 只在 durable (adapter,nativeSessionId,cwd) 与本轮 spawn 三元组规范化等值时原生 resume。
   *  claude 另要求 native_session_confirmed=1(四元组);cursor 仍三元组,不看确认位。 */
  private readNativeResumeKey(run: ActiveRun): { nativeSessionId: string | null; reason: string } {
    const row = this.d.db
      .prepare(
        "SELECT adapter, native_session_id AS sid, cwd, native_session_confirmed AS confirmed FROM tier1_runs WHERE id = ?"
      )
      .get(run.runId) as { adapter: string; sid: string | null; cwd: string; confirmed: number } | undefined;
    if (!row?.sid) return { nativeSessionId: null, reason: "native_session_absent" };
    if (row.adapter !== this.d.cfg.adapter) return { nativeSessionId: null, reason: "adapter_mismatch" };
    if (this.canon(row.cwd) !== this.canon(run.worktree)) return { nativeSessionId: null, reason: "cwd_mismatch" };
    if (this.backend.adapter === "claude_code" && row.confirmed !== 1) {
      return { nativeSessionId: null, reason: "not_confirmed" };
    }
    return { nativeSessionId: row.sid, reason: "exact" };
  }

  private acceptNativeResume(run: ActiveRun, nativeSessionId: string): void {
    if (!run.isResume) return;
    if (!run.agentOwnershipEstablished || !run.resumeSessionConfirmed) return;
    this.markRestartResumed(run);
    if (run.nativeResumeAudited) return;
    run.nativeResumeAudited = true;
    this.d.audit.record({
      actor: "daemon",
      action: "tier1.recover_resume_native",
      meta: {
        runId: run.runId,
        taskId: run.taskId,
        nativeSessionId,
        expectedSessionIdentity: run.expectedSessionIdentity,
        isResume: true
      }
    });
  }

  private observedModelAuditMeta(run: ActiveRun): Record<string, unknown> {
    let familyOk = false;
    if (run.adapter === "claude_code") {
      familyOk =
        run.observedModels.size > 0 && [...run.observedModels].every((m) => familyFromModelName(m) === "claude");
    } else if (run.observedModel) {
      const expectedFamily = familyFromModelName(run.model);
      const observedFamily = familyFromModelName(run.observedModel);
      familyOk = expectedFamily === null || observedFamily === null || expectedFamily === observedFamily;
    }
    return {
      observedModel: run.observedModel,
      observedModelSource: "stream",
      observedModelExempted: false,
      observedModelFamilyOk: familyOk
    };
  }

  private recordRunCost(run: ActiveRun): void {
    const usageRaw = run.resultEvent?.usage;
    const usage =
      usageRaw && typeof usageRaw === "object" && !Array.isArray(usageRaw)
        ? (usageRaw as {
            input_tokens?: number;
            output_tokens?: number;
            cache_read_input_tokens?: number;
            cache_creation_input_tokens?: number;
          })
        : undefined;
    try {
      recordTier1SubscriptionRun(
        this.d.db,
        {
          taskId: run.taskId,
          runId: run.runId,
          adapter: run.adapter,
          model: run.observedModel ?? run.model,
          ...(usage ? { usage } : {}),
          ...(run.resultEvent?.modelUsage !== undefined ? { modelUsage: run.resultEvent.modelUsage } : {}),
          ...(run.resultEvent?.numTurns !== undefined ? { numTurns: run.resultEvent.numTurns } : {}),
          ...(run.resultEvent?.totalCostUsd !== undefined
            ? { totalCostUsdEstimate: run.resultEvent.totalCostUsd }
            : {}),
          usageUnavailable: usage === undefined,
          projectId: run.projectId
        },
        this.now
      );
    } catch (err) {
      throw new Tier1CostLedgerError(run.runId, err);
    }
  }

  private claudeDisposition(run: ActiveRun, exitCode: number): ReturnType<typeof classifyClaudeRunOutcome> {
    const disp = classifyClaudeRunOutcome(
      run.resultEvent ?? undefined,
      run.rateLimitEvents,
      run.stderrTail,
      exitCode,
      run.abort
    );
    // 评审 90 B-6:与 claudeOutcome 同源的整词判定,不再各写一份裸子串正则
    const rateReject = run.rateLimitEvents.some(
      (e) => typeof e.status === "string" && isRateRejectStatus(e.status)
    );
    if (rateReject && disp.action !== "blocked") {
      return { action: "blocked", reason: "subscription_rate_limited" };
    }
    return disp;
  }

  private auditClaudeCanaryReconciling(run: ActiveRun): void {
    const denials = Array.isArray(run.resultEvent?.permissionDenials)
      ? run.resultEvent.permissionDenials.length
      : 0;
    this.d.audit.record({
      actor: "daemon",
      action: "tier1.canary_reconciling",
      meta: {
        taskId: run.taskId,
        runId: run.runId,
        gateSeq: run.gateSeq,
        gateDenyCount: run.gateDenyCount,
        permissionDenials: denials,
        reconcilingOk: denials >= run.gateDenyCount
      }
    });
  }

  private enqueueTier1RateLimit(run: ActiveRun): void {
    const resetsAt = [...run.rateLimitEvents].reverse().find((e) => e.resetsAt !== undefined)?.resetsAt;
    const resetsAtMs = resetsAt === undefined ? undefined : resetsAt < 1e12 ? resetsAt * 1000 : resetsAt;
    const notBeforeMs = resetsAtMs !== undefined ? Math.max(0, resetsAtMs - Date.now()) : 0;
    enqueueRateLimited(this.d.db, this.d.audit, {
      slot: "tier1",
      kind: "tier1_run",
      payload: { taskId: run.taskId, runId: run.runId },
      reason: "subscription_rate_limited",
      notBeforeMs
    });
  }

  /** resume_not_found:清 ownership 后新会话只重试一次。已重试或非 resume 则交给 settle。 */
  private async retryResumeNotFoundOnce(run: ActiveRun, waited: AgentWaitResult, eventsPath: string): Promise<boolean> {
    if (waited.terminationCause === "pipe_failed") return false;
    if (this.backend.adapter !== "claude_code" || !run.isResume || run.resumeNotFoundRetryUsed) return false;
    const disp = this.claudeDisposition(run, waited.exitCode);
    if (!(disp.action === "failed" && disp.reason === "resume_not_found")) return false;
    run.resumeNotFoundRetryUsed = true;
    this.d.audit.record({
      actor: "daemon",
      action: "tier1.recover_resume_failed",
      meta: {
        runId: run.runId,
        taskId: run.taskId,
        expectedSessionIdentity: run.expectedSessionIdentity,
        isResume: true
      }
    });
    await this.clearAgentOwnership(run);
    run.resultEvent = null;
    run.terminalResultReceived = false;
    run.rateLimitEvents = [];
    run.observedModel = null;
    run.observedModels = new Set();
    run.resumeSessionConfirmed = false;
    run.resumeSessionError = null;
    run.gatedToolResults = 0;
    run.toolUseById = new Map();
    run.authViolation = false;
    const sessionId = this.bindClaudeFirstSession(run);
    const prompt = this.buildPrompt(run, true);
    let proc: AgentProcessHandle;
    try {
      proc = this.spawnAgent(run, prompt, undefined, sessionId);
    } catch (err) {
      if (isTier1BinaryIdentityError(err)) {
        this.finalizeBinaryIdentityFailure(run, err);
        return true;
      }
      throw projectUnknownFailure(err);
    }
    run.proc = proc;
    proc.onLine((line) => this.consumeEventLine(run, line, eventsPath));
    await this.establishAgentOwnership(run, proc);
    run.agentOwnershipEstablished = true;
    this.markRestartResumed(run);
    this.resolveClaim(run);
    const retried = await proc.wait();
    this.captureProcTail(run, proc);
    run.proc = null;
    run.processGroupVerifiedExited = true;
    run.terminationCause = retried.terminationCause ?? "exit";
    try {
      await this.settleAttempt(run, retried.exitCode);
    } finally {
      await this.clearAgentOwnershipAfterDurable(run);
    }
    return true;
  }

  /** 清旧孤儿 agent 进程组(recover 前;ESRCH=已死,忽略) */
  private durableEventSnapshot(
    runId: string,
    eventCursor: unknown,
    maxEventLine?: number,
    parserBackend: Tier1Backend = this.backend
  ): {
    eventLine: number;
    observedModel: string | null;
    observedModels: string[];
    resultEvent: Extract<Tier1Event, { kind: "result" }> | null;
  } {
    let eventFileLine = 0;
    let observedModel: string | null = null;
    const observedModels = new Set<string>();
    let resultEvent: Extract<Tier1Event, { kind: "result" }> | null = null;
    try {
      const text = readFileSync(join(this.runDir(runId), "events.jsonl"), "utf8");
      const lines = text === "" ? [] : text.split("\n").filter((line) => line.length > 0);
      const selected = maxEventLine === undefined ? lines : lines.slice(0, maxEventLine);
      eventFileLine = selected.length;
      for (const line of selected) {
        for (const event of parserBackend.parseLine(line)) {
          if (event.kind === "init" && event.model) {
            observedModels.add(event.model);
            observedModel = event.model;
          } else if (event.kind === "observed_model" && event.observedModel) {
            observedModels.add(event.observedModel);
            if (parserBackend.adapter !== "claude_code") observedModel = event.observedModel;
          } else if (event.kind === "result") {
            resultEvent = event;
          }
        }
      }
    } catch {
      // 无事件文件时只能使用已经落库的 cursor；两者都没有即诚实记 0。
    }
    return {
      eventLine:
        maxEventLine === undefined
          ? Math.max(eventFileLine, eventLineFromCursor(eventCursor))
          : Math.min(maxEventLine, Math.max(eventFileLine, eventLineFromCursor(eventCursor))),
      observedModel,
      observedModels: [...observedModels],
      resultEvent
    };
  }

  private async killOrphanAgent(runId: string): Promise<OrphanAgentReapOutcome> {
    const row = this.d.db
      .prepare(
        `SELECT tier1_runs.task_id, tier1_runs.worktree_path, tier1_runs.state, tasks.project_id
         FROM tier1_runs JOIN tasks ON tasks.id=tier1_runs.task_id WHERE tier1_runs.id=?`
      )
      .get(runId) as
      | { task_id: string; worktree_path: string; state: string; project_id: string }
      | undefined;
    if (!row) return "absent";
    return reapOwnedTier1Agent(
      this.d.cfg.saydoHome,
      {
        run_id: runId,
        task_id: row.task_id,
        project_id: row.project_id,
        state: row.state,
        worktree_path: row.worktree_path
      },
      this.d.audit
    );
  }

  /** 已有 durable finalization 时清 restart marker，避免 settle-only 被 restart 永久打断。 */
  private clearRestartMarkerForFinalization(runId: string, nowIso: string): void {
    this.d.db
      .prepare(
        `UPDATE tier1_runs SET restart_pending_at=NULL, restart_reason=NULL, updated_at=?
         WHERE id=? AND finalize_pending_json IS NOT NULL`
      )
      .run(nowIso, runId);
  }

  private tryPersistFailureIntent(
    runId: string,
    raw: Record<string, unknown>,
    intent: FailureFinalizationIntent
  ): boolean {
    const written = this.d.db
      .prepare(
        `UPDATE tier1_runs SET finalize_pending_json=?, updated_at=?
         WHERE id=? AND finalize_pending_json IS NULL AND state IN ('reserved','running','step_paused')
           AND EXISTS (SELECT 1 FROM tasks WHERE tasks.id=tier1_runs.task_id AND tasks.status='running')`
      )
      .run(JSON.stringify(intent), intent.recordedAt, runId);
    if (written.changes !== 1) return false;
    raw["finalize_pending_json"] = JSON.stringify(intent);
    return true;
  }

  private failureIntentFromSnapshot(
    snapshot: ReturnType<Tier1Executor["durableEventSnapshot"]>,
    fields: {
      exitEvidence: string;
      taskState: "failed" | "blocked";
      spokenReason?: string;
      recordedAt: string;
    }
  ): FailureFinalizationIntent {
    return {
      kind: "failure",
      exitEvidence: fields.exitEvidence,
      taskState: fields.taskState,
      recordedAt: fields.recordedAt,
      eventLine: snapshot.eventLine,
      ...(fields.spokenReason !== undefined ? { spokenReason: fields.spokenReason } : {}),
      ...(snapshot.observedModel ? { observedModel: snapshot.observedModel } : {}),
      ...(snapshot.observedModels.length > 0 ? { observedModels: snapshot.observedModels } : {}),
      ...(snapshot.resultEvent ? { resultEvent: snapshot.resultEvent } : {})
    };
  }

  /** spawn 前切断旧进程终态，避免新进程借旧 result/usage 进入 review。 */
  private discardUnqualifiedTerminalResult(run: ActiveRun): void {
    if (run.pendingFinalization) return;
    run.resultEvent = null;
    run.terminalResultReceived = false;
    run.resultText = "";
  }

  /**
   * 可恢复退出:先 durable 标记全部尚未进入其它终局链的 active run,再停进程组。
   * proc.wait() 与执行协程共享同一 promise;settleAttempt 见 restartPending 后只释放内存态。
   */
  recoverableCount(): number {
    return classifyActiveWork(this.d.db, 0, {
      isAborted: (runId) => Boolean(this.active.get(runId)?.abort),
      requireNativeForGracefulRunning: true
    }).recoverableTier1;
  }

  async prepareShutdown(reason: string): Promise<{ recoverableTier1: number; abortedUnrecoverable: number }> {
    this.acceptingWork = false;
    await Promise.resolve();
    this.shutdownEpoch += 1;
    const epoch = this.shutdownEpoch;
    const draining = [...this.active.values()];
    const marked = new Set<string>();
    const nowIso = this.now().toISOString();
    const mark = this.d.db.transaction(() => {
      for (const run of draining) {
        this.refreshTerminalAbort(run);
        this.refreshBudgetAbort(run);
        if (run.abort) continue;
        const durable = this.d.db
          .prepare(
            `SELECT r.state AS state, t.status AS task_status, r.native_session_id AS native_session_id,
                    r.finalize_pending_json AS finalize_pending_json
             FROM tier1_runs r JOIN tasks t ON t.id=r.task_id WHERE r.id=?`
          )
          .get(run.runId) as
          | {
              state: string;
              task_status: string;
              native_session_id: string | null;
              finalize_pending_json: string | null;
            }
          | undefined;
        if (run.pendingFinalization || durable?.finalize_pending_json) {
          // 已有 durable finalization：只中断 verify/snapshot/agent，不得再写 restart marker。
          run.restartPending = true;
          run.restartEpoch = Math.max(run.restartEpoch, epoch);
          continue;
        }
        if (run.restartPending) {
          run.restartEpoch = Math.max(run.restartEpoch, epoch);
          marked.add(run.runId);
          continue;
        }
        const candidate: RestartCandidate | null = durable?.task_status === "running"
          ? {
              run_id: run.runId,
              task_id: run.taskId,
              project_id: run.projectId,
              state: durable.state,
              worktree_path: run.worktree
            }
          : null;
        if (!candidate || !durable || !isTier1RestartRecoverable(this.d.db, candidate)) continue;
        // B3: graceful prior-running 仅 exact native key 可挂 recoverable marker；reserved 可无钥匙。
        if (durable.state !== "reserved" && !durable.native_session_id) continue;
        this.checkpointBudget(run);
        const result = this.d.db
          .prepare(
            `UPDATE tier1_runs
             SET restart_pending_at=?, restart_reason=?, updated_at=?
             WHERE id=? AND state IN ${RESTART_RECOVERABLE_STATES}
               AND finalize_pending_json IS NULL
               AND EXISTS (
                 SELECT 1 FROM tasks
                 WHERE tasks.id=tier1_runs.task_id AND tasks.status='running'
               )`
          )
          .run(nowIso, reason.slice(0, 80), nowIso, run.runId);
        if (result.changes === 0) continue;
        run.restartPending = true;
        run.restartEpoch = epoch;
        marked.add(run.runId);
        this.d.audit.record({
          actor: "daemon",
          action: "tier1.restart_pending",
          meta: {
            taskId: run.taskId,
            runId: run.runId,
            attempt: run.attempt,
            reason: reason.slice(0, 80),
            epoch,
            hasNativeSession: Boolean(durable?.native_session_id)
          }
        });
      }
    });
    mark();
    const completions: Promise<unknown>[] = [];
    const processDrains: Promise<unknown>[] = [];
    for (const run of draining) {
      if (run.proc) {
        const proc = run.proc;
        try {
          proc.kill();
        } catch {
          // wait/外层超时负责暴露未收口,不能把 kill 尝试失败冒充 stopped。
        }
        processDrains.push(
          proc.wait().then((result) => {
            run.processGroupVerifiedExited = true;
            return result;
          }).catch((err) => {
            if (isProcessGroupLifecycleError(err)) throw this.contaminateLifecycle(err);
            throw err;
          })
        );
      }
      if (run.completion) completions.push(run.completion);
      else this.active.delete(run.runId);
    }
    const completionResults = await Promise.allSettled(completions);
    const drainResults = await Promise.allSettled(processDrains);
    for (const result of [...completionResults, ...drainResults]) {
      if (result.status === "rejected" && isProcessGroupLifecycleError(result.reason)) {
        throw this.contaminateLifecycle(result.reason);
      }
    }
    if (this.lifecycleContaminated) throw this.lifecycleContaminated;
    const clearedAt = this.now().toISOString();
    for (const run of draining) {
      const row = this.d.db
        .prepare("SELECT finalize_pending_json FROM tier1_runs WHERE id=?")
        .get(run.runId) as { finalize_pending_json: string | null } | undefined;
      if (!row?.finalize_pending_json) continue;
      this.clearRestartMarkerForFinalization(run.runId, clearedAt);
      run.restartPending = false;
      run.resumeRestartMarker = false;
    }
    const classified = classifyActiveWork(this.d.db, 0, {
      isAborted: (runId) => Boolean(this.active.get(runId)?.abort),
      requireNativeForGracefulRunning: true
    });
    for (const runId of marked) {
      const row = this.d.db
        .prepare(
          `SELECT r.restart_pending_at AS pending, r.state AS state, r.worktree_path AS worktree_path,
                  r.task_id AS task_id, t.project_id AS project_id, t.status AS task_status,
                  r.native_session_id AS native_session_id
           FROM tier1_runs r JOIN tasks t ON t.id=r.task_id
           WHERE r.id=?`
        )
        .get(runId) as
        | {
            pending: string | null;
            state: string;
            worktree_path: string;
            task_id: string;
            project_id: string;
            task_status: string;
            native_session_id: string | null;
          }
        | undefined;
      const candidate: RestartCandidate | null = row?.task_status === "running"
        ? {
            run_id: runId,
            task_id: row.task_id,
            project_id: row.project_id,
            state: row.state,
            worktree_path: row.worktree_path
          }
        : null;
      const recoverable = Boolean(
        row?.pending &&
        candidate &&
        isTier1RestartRecoverable(this.d.db, candidate) &&
        (row.state === "reserved" || row.native_session_id)
      );
      if (!recoverable && row?.pending) {
        // 保留 marker 供审计，但 recoverable 计数走 classifier；无 native 的 running 在 recover 时 fail-closed。
      }
    }
    return {
      recoverableTier1: classified.recoverableTier1,
      abortedUnrecoverable: classified.abortedUnrecoverable
    };
  }

  /** 非可恢复紧急停止:杀并等待全部在途 run;仅供 fatal 路径。 */
  async emergencyShutdown(): Promise<void> {
    this.acceptingWork = false;
    const draining = [...this.active.values()];
    const completions: Promise<unknown>[] = [];
    const processDrains: Promise<unknown>[] = [];
    for (const run of draining) {
      const proc = run.proc;
      try {
        proc?.kill();
      } catch {
        // 尽力
      }
      if (proc) processDrains.push(proc.wait());
      if (run.completion) completions.push(run.completion);
      else this.active.delete(run.runId);
    }
    await raceWithMonotonicDeadline(
      Promise.all([...completions, ...processDrains]),
      "tier1-emergency-shutdown",
      TIER1_EMERGENCY_CLEANUP_DEADLINE_MS
    );
  }

  /** 旧调用兼容；正常退出必须走 prepareShutdown。 */
  shutdown(): void {
    void this.emergencyShutdown().catch(() => undefined);
  }

  /** 观测(测试/console 用) */
  activeRunCount(): number {
    return this.active.size;
  }
}
