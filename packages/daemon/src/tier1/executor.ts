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
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { join, sep } from "node:path";
import {
  newId,
  textDigest,
  tier1SettleProofSchema,
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
import { runtimeChildJobName, runtimeChildOwnerIdentity, runtimeProcessGroupState, signalRuntimeChildTree, spawnRuntimeChild, execAgentFileSync } from "../runtimeChildRegistry.js";
import { insertTier1Run, nextAttempt, setTier1RunNativeSession, transitionTask, transitionTier1Run, type Tier1RunRow } from "../storage/dao/tasks.js";
import { readTaskMessages, settleCancel } from "./operations.js";
import { decideCommand, type GateDecision } from "./gate.js";
import { commandToEffect, matchesFrozenVerify } from "./cmdEffect.js";
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
import { effectiveDevModel, getProjectOverrides } from "../config/projectOverrides.js";
import { assertExactVersion } from "./validateConfig.js";
import { writeGateScriptAtomic } from "./gateScript.js";
import { buildCursorHooksJson } from "./adapter.js";
import { cursorBackend, isCursorShellToolCall } from "./backends/cursor.js";
import type { Tier1Backend } from "./backends/types.js";
import { familyFromModelName } from "../config/family.js";
import type { RuntimeApprovalFlow } from "./approvalFlow.js";
import type { GateWireRequest, GateWireResponse } from "./gateServer.js";
import { hostKind, processBirth } from "@saydo/platform";
import { verifiedProjectWorkspace } from "../storage/dao/projects.js";
import {
  RESTART_RECOVERABLE_STATES,
  readOwnedAgentProcessStart,
  reapOwnedTier1Agent,
  isTier1RestartRecoverable,
  tier1RecoveryPrerequisite,
  type AgentOwnershipRecord,
  type RestartCandidate
} from "./restartPolicy.js";
import { classifyActiveWork } from "./activeWorkClassifier.js";
import {
  ProcessGroupLifecycleError,
  asProcessGroupLifecycleError,
  isProcessGroupLifecycleError
} from "../processGroupLifecycle.js";

// ---------- 可注入进程层(测试 fake;真实现走 nodeSpawn) ----------

export interface AgentProcessHandle {
  pid: number;
  /** 真实 detached agent 必须落 durable ownership；测试 fake 可省略。 */
  ownershipRequired?: boolean;
  /** wrapper 的不可复用 command token（ps 截断时作 identity 回退）。 */
  commandToken?: string;
  /** 子进程已由 OS 接受；恢复 marker 至少等到这个边界后才可清。 */
  started?: Promise<void>;
  /** durable owner 原子发布后才允许 stream result 主动结束常驻 agent。 */
  ownershipEstablished?: () => void;
  /** NDJSON stdout 逐行回调(实现方保证行序);返回 exit 承诺 */
  onLine(cb: (line: string) => void): void;
  kill(): void;
  wait(): Promise<{ exitCode: number }>;
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
    resumeChatId?: string;
    settingsJson?: string;
    sessionId?: string;
    maxTurns?: number;
  }): AgentProcessHandle;
}

/** 凭据剥离 env 白名单(G4:agent 环境不带任何 key/token;登录态走 HOME 下 cursor 自身存储) */
export const AGENT_ENV_ALLOWLIST = [
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TERM",
  "TMPDIR",
  "TEMP",
  "TMP",
  "USERPROFILE",
  "USERNAME",
  "HOMEDRIVE",
  "HOMEPATH",
  "APPDATA",
  "LOCALAPPDATA",
  "PATHEXT",
  "SYSTEMROOT",
  "WINDIR",
  "COMSPEC"
] as const;

export function strippedAgentEnv(source: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of AGENT_ENV_ALLOWLIST) {
    const v = source[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
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
        stderr: "pipe"
      }, "tier1:agent");
      const { child, lease: childLease } = spawned;
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
      let resolveExit!: (v: { exitCode: number }) => void;
      let rejectExit!: (err: Error) => void;
      const exitP = new Promise<{ exitCode: number }>((r, reject) => {
        resolveExit = r;
        rejectExit = reject;
      });
      const started = new Promise<void>((resolveStarted, rejectStarted) => {
        child.once("spawn", () => void childLease.establish().then(resolveStarted, rejectStarted));
        child.once("error", rejectStarted);
      });
      const hardKill = (): void => {
        try {
          if (child.pid) signalRuntimeChildTree(child.pid, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
      };
      const armWaitExitThenKill = (): void => {
        if (waitExitTimer || settled || finishing) return;
        waitExitTimer = setTimeout(() => {
          if (settled || finishing) return;
          try {
            if (child.pid) signalRuntimeChildTree(child.pid, "SIGTERM");
          } catch {
            child.kill("SIGTERM");
          }
          if (!escalationTimer) {
            escalationTimer = setTimeout(() => {
              if (!settled && !finishing) hardKill();
            }, 5_000);
            escalationTimer.unref();
          }
        }, 5_000);
        waitExitTimer.unref();
      };
      const finish = (exitCode: number): void => {
        if (settled || finishing) return;
        finishing = true;
        if (escalationTimer) clearTimeout(escalationTimer);
        if (waitExitTimer) clearTimeout(waitExitTimer);
        hardKill(); // stream-json 模式 cursor-agent 发完 result 常不自退,主动收(释放进程组)
        const deadline = Date.now() + 5_000;
        const drain = (): void => {
          const state = child.pid ? runtimeProcessGroupState(child.pid) : "gone";
          if (state === "gone") {
            settled = true;
            resolveExit({ exitCode });
            return;
          }
          if (Date.now() >= deadline) {
            settled = true;
            rejectExit(new ProcessGroupLifecycleError(
              state === "unknown"
                ? `agent process group ${String(child.pid)} state unknown`
                : `agent process group ${String(child.pid)} did not exit`
            ));
            return;
          }
          setTimeout(drain, 10);
        };
        drain();
      };
      rl.on("line", (l) => {
        if (lineCbs.length === 0) pendingLines.push(l);
        else for (const cb of lineCbs) cb(l);
        // result 事件 = 权威完成信号(stream-json 下进程可能不自退)
        if (backend.isTerminalResult(l)) {
          const parsed = backend.parseLine(l);
          const resultEv = parsed.find((e) => e.kind === "result");
          const resultExitCode = resultEv && resultEv.isError !== true ? 0 : 1;
          if (backend.finishPolicy === "kill_on_result") {
            if (ownershipEstablished) finish(resultExitCode);
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
      child.on("exit", (code) => finish(code ?? 1));
      child.on("error", () => finish(127));
      exitP.finally(() => childLease.release()).catch(() => undefined);
      return {
        pid: child.pid ?? -1,
        ownershipRequired: true,
        commandToken: spawned.commandToken,
        started,
        ownershipEstablished() {
          ownershipEstablished = true;
          if (pendingResultExitCode === null) return;
          if (backend.finishPolicy === "kill_on_result") {
            finish(pendingResultExitCode);
          } else {
            armWaitExitThenKill();
          }
        },
        onLine(cb) {
          lineCbs.push(cb);
          for (const line of pendingLines.splice(0)) cb(line);
        },
        kill() {
          if (settled || finishing || escalationTimer) return;
          try {
            if (child.pid) signalRuntimeChildTree(child.pid, "SIGTERM");
          } catch {
            child.kill("SIGTERM");
          }
          escalationTimer = setTimeout(() => {
            if (!settled && !finishing) hardKill();
          }, 5000);
          escalationTimer.unref();
        },
        wait: () => exitP,
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
}

interface ActiveRun {
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
  expectedResumeSessionId: string | null;
  resumeSessionConfirmed: boolean;
  resumeSessionError: string | null;
  agentOwnershipEstablished: boolean;
  nativeResumeAudited: boolean;
  /** 进程组已明确 ESRCH；未验证前禁止写 processExited proof。 */
  processGroupVerifiedExited: boolean;
  /** 认领 barrier：owner+session 或 terminal/unrecoverable 后 resolve。 */
  claimReady: (() => void) | null;
  claimPromise: Promise<void> | null;
  /** W5a 3.5 本 run 生效模型 */
  model: string;
  /** 终局原因(canary/熔断/取消先到先得,settle 按此分链) */
  abort: { kind: "canary" | "budget" | "cancel" | "steer_resume"; detail: string } | null;
  /** 本 run 的 .cursor/hooks.json;provision 后才设,digest 补偿用 */
  hooksJsonPath: string | null;
}

const ACTIVE_RUN_STATES = "('reserved','running','step_paused','cancel_requested')";

export class Tier1Executor {
  private readonly d: ExecutorDeps;
  private readonly backend: Tier1Backend;
  private readonly now: () => Date;
  private readonly active = new Map<string, ActiveRun>(); // runId -> ActiveRun
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
    const contamination = asProcessGroupLifecycleError(err);
    this.lifecycleContaminated ??= contamination;
    this.d.audit.record({
      actor: "daemon",
      action: "tier1.process_group_lifecycle_contaminated",
      meta: { message: contamination.message.slice(0, 200) }
    });
    return contamination;
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
  private gateScriptDriftGuard(): boolean {
    const surfaces = this.gateIntegritySurfaces();
    const drifted: { path: string; expected: string; actual: string | null }[] = [];
    for (const surface of surfaces) {
      let actual: string | null;
      try {
        actual = readFileSync(surface.path, "utf8");
      } catch {
        actual = null;
      }
      if (actual !== surface.expected) drifted.push({ ...surface, actual });
    }
    if (drifted.length === 0) return false;
    const first = drifted[0]!;
    this.d.audit.record({
      actor: "daemon",
      action: "tier1.gate_script_drift",
      meta: {
        expectedDigest: textDigest(first.expected),
        actualDigest: first.actual === null ? "unreadable" : textDigest(first.actual),
        surfaces: drifted.map((d) => d.path.slice(-120)),
        activeRuns: this.active.size
      }
    });
    for (const run of this.active.values()) {
      if (run.abort) continue;
      run.abort = { kind: "canary", detail: "gate_script_drift" };
      run.proc?.kill();
    }
    for (const surface of drifted) {
      try {
        writeGateScriptAtomic(surface.path, surface.expected);
      } catch (err) {
        this.d.log.error("gate integrity self-heal failed", {
          path: surface.path.slice(-120),
          error: String(err).slice(0, 160)
        });
      }
    }
    return true;
  }

  async handleGateRequest(req: GateWireRequest): Promise<GateWireResponse> {
    if (this.gateScriptDriftGuard()) {
      return { permission: "deny", agent_message: "SayDo gate: gate script integrity check failed (fail-closed)" };
    }
    if (req.kind && req.kind !== "command") {
      return { permission: "deny", agent_message: "SayDo gate: unknown kind (fail-closed)" };
    }
    if (!req.command) {
      return { permission: "deny", agent_message: "SayDo gate: missing command (fail-closed)" };
    }
    const run = this.findRunByCwd(req.cwd);
    if (!run) {
      this.d.audit.record({
        actor: "daemon",
        action: "tier1.gate_unmatched_deny",
        meta: { cwd: req.cwd.slice(0, 120), commandDigest: textDigest(req.command) }
      });
      return { permission: "deny", agent_message: "SayDo gate: no active run matches this worktree (fail-closed)" };
    }
    if (run.abort) {
      return { permission: "deny", agent_message: `SayDo gate: run is terminating (${run.abort.kind})` };
    }
    if (run.restartPending) {
      return { permission: "deny", agent_message: "SayDo gate: daemon is preparing to restart" };
    }
    const seq = ++run.gateSeq; // gateSeq 即门请求计数(canary 对账的左边);每条命令独立(律④)
    const effect = matchesFrozenVerify(req.command, run.frozen.map((f) => f.argv))
      ? ({ kind: "run_registered_verify" } as const)
      : commandToEffect(req.command);

    run.approvalWaitingSince = Date.now(); // S0/S1 即时返回,计时归零误差可忽略;S2 挂起期停表
    let decision: GateDecision;
    try {
      decision = await decideCommand(
        { taskId: run.taskId, seq, command: req.command, effect },
        {
          registry: run.registry,
          // run 级保护面(W1.3):全局 ∪ 项目 [git].protected;engine 内再并 main/master 缺省
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
          // 收据窗(45s)+ 缓冲由 approvalFlow 主导终局;这里的 race 上限只兜底
          approvalTimeoutMs: ((this.d.cfg.receiptTimeoutSec?.() ?? 45) + 5) * 1000
        }
      );
    } finally {
      if (run.approvalWaitingSince !== null) {
        run.approvalWaitMs += Date.now() - run.approvalWaitingSince;
        run.approvalWaitingSince = null;
      }
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
        commandDigest: textDigest(req.command)
      }
    });
    if (decision.permission === "allow") return { permission: "allow" };
    // W5a 3.3:edit 第四动作的 deny 回执——owner"修改后批准"时把编辑后命令带给 agent,
    // agent 按建议原样重试即命中单次预批收据(approvalFlow.request 消费点)
    const suggestion = this.d.approvals.consumeEditSuggestion(run.taskId, seq);
    if (suggestion) {
      return {
        permission: "deny",
        agent_message: `SayDo gate: 用户修改了这条命令并预批了修改版;请改用(原样执行):${suggestion}`
      };
    }
    return { permission: "deny", agent_message: `SayDo gate denied (${decision.risk}): ${decision.reason}` };
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
      this.reapCancellations();
      this.checkCanaries();
      this.enforceBudgets();
      if (this.acceptingWork) this.claimNext();
    } catch (err) {
      this.d.log.error("tier1 executor tick failed", { error: String(err).slice(0, 200) });
    }
  }

  /** canary 巡检(门完整性):shell started 计数 > gate 请求计数,连续两 tick 存在 ⇒ 门被绕过,立即终止 */
  private checkCanaries(): void {
    for (const run of this.active.values()) {
      if (run.abort || run.restartPending) continue;
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
      if (run.abort || run.restartPending) continue;
      const row = this.d.db.prepare("SELECT status FROM tasks WHERE id=?").get(run.taskId) as { status: string } | undefined;
      if (row?.status === "cancel_requested") {
        run.abort = { kind: "cancel", detail: "user cancel" };
        run.proc?.kill();
        continue;
      }
      const runRow = this.d.db.prepare("SELECT state FROM tier1_runs WHERE id=?").get(run.runId) as { state: string } | undefined;
      if (runRow?.state === "cancel_requested") {
        run.abort = { kind: "steer_resume", detail: "steer cancel_resume" };
        run.proc?.kill();
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
      if (run.abort || run.restartPending) continue;
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
        if (row.status === "queued") transitionTask(this.d.db, row.id, "running", "L", { now: nowIso });
        transitionTask(this.d.db, row.id, "blocked", "L", { now: this.now().toISOString() });
      } catch (err) {
        this.d.log.error("claim degrade to blocked failed", { taskId: row.id, error: String(err).slice(0, 160) });
        return;
      }
      this.enqueueBlocked(row.id, row.package_rev ?? 1, "no-workspace:unavailable", "项目没配可执行的 git 工作区");
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
        if (!String(err).includes("no_binding")) throw err;
      }
    });
    try {
      tx();
    } catch (err) {
      this.d.log.warn("claim race lost", { taskId: row.id, error: String(err).slice(0, 120) });
      return;
    }
    this.d.audit.record({
      actor: "daemon",
      action: "tier1.claim",
      meta: { taskId: row.id, runId, attempt, adapter: this.d.cfg.adapter }
    });

    const active: ActiveRun = {
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
      expectedResumeSessionId: null,
      resumeSessionConfirmed: false,
      resumeSessionError: null,
      agentOwnershipEstablished: false,
      nativeResumeAudited: false,
      processGroupVerifiedExited: false,
      claimReady: null,
      claimPromise: null,
      abort: null,
      model: this.resolveRunModel(row.project_id, runId),
      hooksJsonPath: null
    };
    this.active.set(runId, active);
    active.completion = this.runAttempt(active).catch((err) => {
      this.d.log.error("tier1 runAttempt crashed", { runId, error: String(err).slice(0, 200) });
      if (active.restartPending) return;
      if (isProcessGroupLifecycleError(err)) {
        this.contaminateLifecycle(err);
        this.resolveClaim(active);
        return;
      }
      this.finalizeFailure(active, `executor_crash:${String(err).slice(0, 120)}`, "failed");
    });
  }

  /** W5a 3.5 开发档生效模型:project_settings 覆盖 > cfg.model(受控表,非 project.toml——09 §11 白名单不放宽) */
  private resolveRunModel(projectId: string, runId: string): string {
    try {
      const eff = effectiveDevModel(this.d.cfg.model, getProjectOverrides(this.d.db, projectId));
      if (eff.source === "project") {
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
      registryHome: this.d.cfg.saydoHome
    }, `tier1:${run.runId}:managed`);
    const { child, lease: childLease } = spawned;
    child.stdin.end();
    let stdoutTail = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdoutTail = (stdoutTail + chunk.toString("utf8")).slice(-2_000);
    });
    let finishRequested = false;
    let settled = false;
    let exitCode = 1;
    let escalationTimer: NodeJS.Timeout | undefined;
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
        if (child.pid) signalRuntimeChildTree(child.pid, signal);
      } catch {
        // 后续 group probe 给出权威结果。
      }
    };
    const finishAfterDrain = (code: number): void => {
      if (finishRequested || settled) return;
      finishRequested = true;
      exitCode = code;
      if (escalationTimer) clearTimeout(escalationTimer);
      signalTree("SIGKILL");
      const deadline = Date.now() + 5_000;
      const poll = (): void => {
        const state = child.pid ? runtimeProcessGroupState(child.pid) : "gone";
        if (state === "gone") {
          settled = true;
          resolveWait({ exitCode });
          return;
        }
        if (Date.now() >= deadline) {
          settled = true;
          rejectWait(new ProcessGroupLifecycleError(
            state === "unknown"
              ? `managed process group ${String(child.pid)} state unknown`
              : `managed process group ${String(child.pid)} did not exit`
          ));
          return;
        }
        setTimeout(poll, 10);
      };
      poll();
    };
    child.once("exit", (code, signal) => finishAfterDrain(code ?? (signal ? 143 : 1)));
    child.once("error", () => finishAfterDrain(127));
    const handle: AgentProcessHandle = {
      pid: child.pid ?? -1,
      started,
      onLine() {},
      kill() {
        if (settled || finishRequested || escalationTimer) return;
        signalTree("SIGTERM");
        escalationTimer = setTimeout(() => {
          if (!settled && !finishRequested) signalTree("SIGKILL");
        }, 5_000);
        escalationTimer.unref();
      },
      wait: () => wait
    };
    run.proc = handle;
    const timeout = setTimeout(() => handle.kill(), options.timeoutMs);
    try {
      await started;
      await childLease.establish();
      const result = await wait;
      return { ...result, stdoutTail };
    } catch (err) {
      handle.kill();
      await wait.catch(() => undefined);
      throw err;
    } finally {
      clearTimeout(timeout);
      if (escalationTimer) clearTimeout(escalationTimer);
      childLease.release();
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

  private async runAttempt(run: ActiveRun, opts: { resume?: boolean } = {}): Promise<void> {
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
      this.finalizeFailure(run, `project_toml_invalid:${String(err).slice(0, 100)}`, "blocked", "项目配置文件解析不了,需要你看一眼 .saydo/project.toml");
      return;
    }
    run.registry = pcfg.registry;
    run.articlePath = pcfg.writingArticlePath; // W4 3.2 writing:成稿文件相对路径(settle barrier ① 用)

    // 2) verify 冻结(认领时点 = agent 起动前,主仓正文即冻结基准;执行前在 worktree 重校)
    try {
      run.frozen = pcfg.verifyRefs.map((ref) => freezeVerify(run.repoPath, ref, pcfg.registry));
    } catch (err) {
      this.finalizeFailure(run, `verify_freeze_failed:${String(err).slice(0, 100)}`, "blocked", "验证命令冻结失败,登记项和仓库现状对不上");
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
      if (run.restartPending) throw err;
      this.finalizeFailure(run, `provision_failed:${String(err).slice(0, 100)}`, "blocked", "工作区供给失败(worktree/依赖安装)");
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
    if (run.restartPending) return;

    // 5) spawn(prompt = 任务卡 + task_messages 消费口 + 执行约定)
    const prompt = this.buildPrompt(run, opts.resume === true);
    const proc = d.spawner.spawn({
      binary: d.cfg.lockedBinary,
      model: run.model, // W5a 3.5:项目覆盖生效模型
      prompt,
      cwd: run.worktree,
      env: strippedAgentEnv(process.env)
    });
    run.proc = proc;
    const eventsPath = join(this.runDir(run.runId), "events.jsonl");
    proc.onLine((line) => this.consumeEventLine(run, line, eventsPath));
    await this.establishAgentOwnership(run, proc);
    run.agentOwnershipEstablished = true;
    this.markRestartResumed(run);
    this.resolveClaim(run);
    try {
      const { exitCode } = await proc.wait();
      run.proc = null;
      run.processGroupVerifiedExited = true;
      this.clearAgentOwnership(run);
      await this.settleAttempt(run, exitCode);
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
    const cursorDir = join(run.worktree, ".cursor");
    mkdirSync(cursorDir, { recursive: true });
    const hooksJsonPath = join(cursorDir, "hooks.json");
    writeFileSync(hooksJsonPath, this.expectedHooksJson());
    run.hooksJsonPath = hooksJsonPath;
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
    parts.push(
      "",
      "## 执行约定",
      "- 只在当前工作目录内改动;不要 git push;改动不需要你合并——完成后系统会独立跑验证并交人验收。",
      "- 不要改动 .cursor/ 目录、验证脚本(package.json scripts / justfile 中已登记的验证项)。",
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
    run.eventLine++;
    try {
      appendFileSync(eventsPath, line + "\n");
    } catch {
      // 事件留痕失败不阻断执行(transcriptCursor 仍按行号推进)
    }
    for (const ev of this.backend.parseLine(line)) {
    if (ev.kind === "observed_model" && ev.observedModel) {
      run.observedModel = ev.observedModel;
      // W1.4(0.0(a) --resume 清账):system.init 同行带 session_id(chatId)——落 tier1_runs
      // native_session_id 列(§12-7 恢复钥匙 canonical 落位,recovery/reconciler 按列判 resumable;
      // 实测锚 e2e/poc/tier1-live-executor events.jsonl 首行)
      try {
        const sid = (JSON.parse(line) as { session_id?: string }).session_id;
        if (run.expectedResumeSessionId !== null) {
          if (sid === run.expectedResumeSessionId) {
            run.resumeSessionConfirmed = true;
            this.acceptNativeResume(run, sid);
          } else {
            run.resumeSessionError = sid
              ? `native_session_mismatch:${sid}`
              : "native_session_missing";
            run.proc?.kill();
          }
        } else if (sid) {
          setTier1RunNativeSession(this.d.db, run.runId, sid, this.now().toISOString());
        }
      } catch {
        if (run.expectedResumeSessionId !== null) {
          run.resumeSessionError = "native_session_invalid";
          run.proc?.kill();
        }
      }
      continue;
    }
    if (ev.kind === "result") {
      run.resultText = ev.text ?? "";
      run.terminalResultReceived = true;
      continue;
    }
    if (ev.kind === "tool_started") {
      run.toolCalls++; // 回合熔断按 started 计(started/completed 成对,双计会虚高一倍)
      this.d.db
        .prepare("UPDATE tier1_runs SET budget_tool_calls=?, updated_at=? WHERE id=?")
        .run(run.toolCalls, this.now().toISOString(), run.runId);
      if (this.backend.canaryLeft === "shell_started" && isCursorShellToolCall(line)) run.shellStarted++;
      continue;
    }
    // 执行档对 unknown/parse_error 记数不作废(评估档 §12-9 的作废语义不适用:执行档事件面宽,
    // 安全承载在 gate+canary 而非事件解析;spike 律:吞模型切换/重连提示)
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

  private clearRestartMarker(run: ActiveRun): void {
    if (!run.restartPending && !run.resumeRestartMarker) return;
    this.d.db
      .prepare("UPDATE tier1_runs SET restart_pending_at=NULL, restart_reason=NULL, updated_at=? WHERE id=?")
      .run(this.now().toISOString(), run.runId);
    run.restartPending = false;
    run.resumeRestartMarker = false;
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
      if (run.abort) this.clearRestartMarker(run);
      if (run.abort?.kind === "cancel") {
        this.settleCancelledRun(run);
        return;
      }
      if (run.abort?.kind === "steer_resume") {
        this.settleSteerResumeRun(run);
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
      // B3: terminal result 必须先于 restart suspension；已有合法终局不得借 marker 跳过 settle。
      if (run.terminalResultReceived && exitCode === 0 && !run.abort) {
        this.clearRestartMarker(run);
      } else if (run.restartPending) {
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

      // 09 §6.1a:按 project.type 白名单分叉——coding 走 verify gate;writing 走内容评审 gate(verify 可空);
      // 其余(读不到/pending/无执行合同类型)⇒ fail-closed blocked,不按 coding 兜底(owner 裁决 (a) 案 2026-07-28;
      // 正常派发链 typeGate 已拦 pending 与未启用类型,此为防御纵深)
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
    } finally {
      this.active.delete(run.runId);
    }
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
    // verify(G3):无登记 = 不可 settle(fail-closed 叫人);冻结重校不符 = Plan Delta
    if (run.frozen.length === 0) {
      this.finalizeFailure(run, "no_verify_registered", "blocked", "这个仓没登记验证命令(.saydo/project.toml [[verify.entries]]),我不能替你判定完成——补登记后重试");
      return;
    }
    const verifyResults: { templateRef: string; exitCode: number; stdoutTail: string }[] = [];
    for (const frozen of run.frozen) {
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
      if (run.restartPending) return;
      verifyResults.push({ templateRef: frozen.templateRef, ...vr });
      if (vr.exitCode !== 0) {
        writeFileSync(join(this.runDir(run.runId), "verify.json"), JSON.stringify(verifyResults, null, 2));
        this.finalizeFailure(run, `verify_failed:${frozen.templateRef}:exit${vr.exitCode}`, "failed", `验证没过(${frozen.templateRef})`);
        return;
      }
    }
    const verifyPayload = JSON.stringify(verifyResults, null, 2);
    writeFileSync(join(this.runDir(run.runId), "verify.json"), verifyPayload);

    const snap = await this.snapshotTree(run);
    if (run.restartPending) return;
    if (!snap.ok) return;
    const treeSha = snap.treeSha;

    const nowIso = this.now().toISOString();
    const proof: Tier1SettleProof = tier1SettleProofSchema.parse({
      taskId: run.taskId,
      runId: run.runId,
      attempt: run.attempt,
      packageRevision: run.packageRevision,
      treeSha,
      tier1VerifyDigest: textDigest(verifyPayload),
      transcriptCursor: `events:${run.runId}:line:${run.eventLine}`,
      settledAt: nowIso
    } satisfies Tier1SettleProof);

    this.commitSettle(run, treeSha, proof, `verify:${textDigest(verifyPayload)}`);
  }

  /**
   * writing settle(09 §6.1a writingSettleBarrier):verify = 内容评审 gate(可空,不因 no_verify 阻塞);
   * 若配了内容型 verify(markdownlint/死链等)则跑,fail ⇒ 不 settle;
   * 成稿对账(①)+ 节 exact-set(②)+ 验收对账(③)机械断言,缺一转 blocked/failed 不 settle。
   */
  private async settleWriting(run: ActiveRun): Promise<void> {
    const d = this.d;
    if (!d.artifacts) {
      this.finalizeFailure(run, "artifact_store_unavailable", "blocked", "产物库未接线,writing 成稿无法落库(实施配置问题)");
      return;
    }
    // verify 可空:配了才跑(内容型 lint;source="verify" 验收项据此);无登记 = 内容评审 gate,不阻塞
    const verifyResults: { templateRef: string; exitCode: number; stdoutTail: string }[] = [];
    for (const frozen of run.frozen) {
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
      if (run.restartPending) return;
      verifyResults.push({ templateRef: frozen.templateRef, ...vr });
    }
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

    // 成稿对账 ①(daemon IO 面):worktree 现读文章文件存在 + 非空
    const articleAbs = join(run.worktree, run.articlePath);
    if (!existsSync(articleAbs)) {
      this.finalizeFailure(run, `article_missing:${run.articlePath}`, "blocked", `没找到成稿文件(${run.articlePath})——agent 没写出来或路径不对`);
      return;
    }
    const articleBytes = readFileSync(articleAbs, "utf8");
    if (articleBytes.trim() === "") {
      this.finalizeFailure(run, "article_empty", "blocked", "成稿是空的,不能判定完成");
      return;
    }
    const articleDigest = textDigest(articleBytes);

    const snap = await this.snapshotTree(run);
    if (run.restartPending) return;
    if (!snap.ok) return;
    const treeSha = snap.treeSha;

    // ① 续:该路径存在于 treeSha 树内；也走可中断进程组，避免子进程挂死 daemon。
    try {
      const inTree = await this.runManagedCommand(run, ["git", "cat-file", "-e", `${treeSha}:${run.articlePath}`], {
        cwd: run.worktree,
        timeoutMs: 30_000
      });
      if (run.restartPending) return;
      if (inTree.exitCode !== 0) {
        this.finalizeFailure(run, `article_not_in_tree:${run.articlePath}`, "blocked", "成稿文件不在提交树内(可能被 .gitignore 挡)");
        return;
      }
    } catch (err) {
      if (run.restartPending) throw err;
      this.finalizeFailure(run, `ls_tree_failed:${String(err).slice(0, 80)}`, "failed", "读提交树失败");
      return;
    }

    // 落 article artifact(barrier ① 要求"articleArtifactId/version 行存在")
    const article = d.artifacts.write({
      projectId: run.projectId,
      type: "article",
      content: articleBytes,
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

    this.commitSettle(run, treeSha, proof, `article:${articleDigest}`);
  }

  /** 快照树(prospectiveTree;排除 .cursor——审批钩子是 daemon 注入物,不属交付内容) */
  private async snapshotTree(run: ActiveRun): Promise<{ ok: true; treeSha: string } | { ok: false }> {
    try {
      const add = await this.runManagedCommand(run, ["git", "add", "-A", "--", ".", ":(exclude).cursor"], {
        cwd: run.worktree,
        timeoutMs: 120_000
      });
      if (run.restartPending) return { ok: false };
      if (add.exitCode !== 0) throw new Error(`git add exit ${add.exitCode}`);
      const writeTree = await this.runManagedCommand(run, ["git", "write-tree"], {
        cwd: run.worktree,
        timeoutMs: 30_000,
        captureStdout: true
      });
      if (run.restartPending) return { ok: false };
      const treeSha = writeTree.stdoutTail.trim();
      if (writeTree.exitCode !== 0 || !/^[0-9a-f]{40,64}$/.test(treeSha)) {
        throw new Error(`git write-tree exit ${writeTree.exitCode}`);
      }
      return { ok: true, treeSha };
    } catch (err) {
      if (run.restartPending) throw err;
      this.finalizeFailure(run, `tree_snapshot_failed:${String(err).slice(0, 100)}`, "failed", "工作区快照失败");
      return { ok: false };
    }
  }

  /** 决策包正文(plan/acceptance;settle barrier 对账源) */
  private packageBodyOf(run: ActiveRun): { plan: { seq: number; owner: "ai" | "human" }[]; acceptance: string[] } | null {
    const row = this.d.db
      .prepare("SELECT body_json FROM decision_packages WHERE digest=? LIMIT 1")
      .get(run.packageDigest) as { body_json: string } | undefined;
    if (!row) return null;
    try {
      const body = JSON.parse(row.body_json) as { plan?: { seq: number; owner: "ai" | "human" }[]; acceptance?: string[] };
      return { plan: body.plan ?? [], acceptance: body.acceptance ?? [] };
    } catch {
      return null;
    }
  }

  /** settle 收口(run 终态 + task 转态 + 回叫入队;coding/writing 共用,09 §6.3 barrier) */
  private commitSettle(run: ActiveRun, treeSha: string, proof: Tier1SettleProof | WritingSettleProof, artifactCheck: string): void {
    const d = this.d;
    const nowIso = this.now().toISOString();
    transitionTier1Run(d.db, run.runId, "settled_review", nowIso, {
      treeSha,
      eventCursor: proof.transcriptCursor,
      settleProofJson: JSON.stringify(proof)
    });
    transitionTask(d.db, run.taskId, "ready_for_review", "L", { now: nowIso });
    // 回叫 settleProof 走 Tier1SettleProof 形(callback 契约现形);writing proof 用最小形投影
    const callbackProof: Tier1SettleProof =
      "kind" in proof && proof.kind === "writing"
        ? {
            taskId: proof.taskId,
            runId: proof.runId,
            attempt: proof.attempt,
            packageRevision: proof.packageRevision,
            treeSha: proof.treeSha,
            tier1VerifyDigest: proof.articleDigest,
            transcriptCursor: proof.transcriptCursor,
            settledAt: proof.settledAt
          }
        : (proof as Tier1SettleProof);
    const enq = d.callbacks.enqueue({
      taskId: run.taskId,
      trigger: "ready_for_review",
      packageRevision: run.packageRevision,
      occurrenceKey: String(run.attempt),
      settleProof: callbackProof,
      projectionCursor: proof.transcriptCursor,
      artifactChecks: [artifactCheck]
    });
    d.audit.record({
      actor: "daemon",
      action: "tier1.settled_review",
      meta: { taskId: run.taskId, runId: run.runId, attempt: run.attempt, treeSha, enqueued: enq.enqueued }
    });
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
      if (run.restartPending) throw err;
      return { exitCode: 1, stdoutTail: String(err).slice(-2_000) };
    }
  }

  /** 失败/阻塞收尾:run settled_failed + task failed/blocked + 最小 proof 回叫(09 §9;缺一不叫) */
  private finalizeFailure(run: ActiveRun, exitEvidence: string, taskState: "failed" | "blocked", spokenReason?: string): void {
    const d = this.d;
    const nowIso = this.now().toISOString();
    this.clearRestartMarker(run);
    try {
      const cur = (d.db.prepare("SELECT state FROM tier1_runs WHERE id=?").get(run.runId) as { state: string } | undefined)?.state;
      if (cur === "reserved") {
        // reserved 无 -> settled_failed 直边:经取消链落终态(供给失败/起动前异常)
        // A1: 未验证 ESRCH 时 processExited 不得写 true；有 owner 未 ESRCH 则污染 lifecycle。
        if (run.agentOwnershipEstablished && !run.processGroupVerifiedExited) {
          this.contaminateLifecycle(
            new ProcessGroupLifecycleError(`reserved finalize without ESRCH:${run.runId}`)
          );
          this.resolveClaim(run);
          return;
        }
        // Tier1CancelProof.processExited 合同为字面 true；仅在无 owner 或已 ESRCH 时写 proof。
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
    } catch (err) {
      d.log.error("finalizeFailure run transition failed", { runId: run.runId, error: String(err).slice(0, 160) });
    }
    try {
      transitionTask(d.db, run.taskId, taskState, "L", { now: nowIso });
    } catch (err) {
      // 任务已被并发转走(如用户取消):如实留审计,不强写
      d.audit.record({
        actor: "daemon",
        action: "tier1.finalize_task_transition_skipped",
        meta: { taskId: run.taskId, wanted: taskState, error: String(err).slice(0, 120) }
      });
      this.active.delete(run.runId);
      return;
    }
    this.enqueueBlocked(run.taskId, run.packageRevision, exitEvidence, spokenReason, taskState, run);
    d.audit.record({
      actor: "daemon",
      action: taskState === "failed" ? "tier1.settled_failed" : "tier1.blocked",
      meta: { taskId: run.taskId, runId: run.runId, exitEvidence: exitEvidence.slice(0, 160) }
    });
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
  ): void {
    this.d.callbacks.enqueue({
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
      settleCancel(this.d.db, this.d.audit, proof, nowIso);
    } catch (err) {
      this.d.log.error("settleCancel failed", { runId: run.runId, error: String(err).slice(0, 160) });
    }
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
      transitionTier1Run(this.d.db, run.runId, "cancel_settled", nowIso, { cancelProofJson: JSON.stringify(proof) });
      this.d.audit.record({
        actor: "daemon",
        action: "tier1.steer_resume_settled",
        meta: { taskId: run.taskId, runId: run.runId, attempt: run.attempt, lastEventId: proof.lastEventId }
      });
    } catch (err) {
      this.d.log.error("settleSteerResume failed", { runId: run.runId, error: String(err).slice(0, 160) });
    }
    this.resolveClaim(run);
    this.active.delete(run.runId);
  }

  // ---------- §12-7 恢复(daemon 重启:按 (adapter,nativeSessionId,cwd) 恢复或降级新会话) ----------

  async recover(): Promise<void> {
    const rows = this.d.db
      .prepare(`SELECT * FROM tier1_runs WHERE state IN ${ACTIVE_RUN_STATES}`)
      .all() as Record<string, unknown>[];
    // 两阶段恢复：先对全部 durable 行完成 ownership 回收与 JSON/工作区预检；任何一行
    // fail-closed 时都尚未 spawn，避免后行异常把前行新进程杀成 failed。
    for (const raw of rows) {
      try {
        await this.killOrphanAgent(raw["id"] as string);
      } catch (err) {
        // 旧组未 ESRCH：污染 lifecycle 并阻断 ready（A1/A3）。
        throw this.contaminateLifecycle(err);
      }
    }

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
      let repoPath: string | null = null;
      let budget: ActiveRun["budget"] | null = null;
      if (state !== "cancel_requested" && task) {
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
      preflight.push({ raw, runId, taskId, state, task, repoPath, budget });
    }

    const runnable: Array<{ active: ActiveRun; wasReserved: boolean }> = [];
    for (const item of preflight) {
      const { raw, runId, taskId, state, task, repoPath, budget } = item;
      const nowIso = this.now().toISOString();
      if (state === "cancel_requested") {
        // 取消中重启:进程必死,补 proof 结算
        const proof: Tier1CancelProof = {
          taskId,
          runId,
          processExited: true,
          worktreeLockReleased: true,
          lastEventId: (raw["event_cursor"] as string | null) ?? "recovered:unknown",
          settledAt: nowIso
        };
        const taskRow = this.d.db.prepare("SELECT status FROM tasks WHERE id=?").get(taskId) as { status: string } | undefined;
        try {
          this.d.db
            .prepare("UPDATE tier1_runs SET restart_pending_at=NULL, restart_reason=NULL, updated_at=? WHERE id=?")
            .run(nowIso, runId);
          if (taskRow?.status === "cancel_requested") {
            settleCancel(this.d.db, this.d.audit, proof, nowIso);
          } else {
            // W5a 3.4:steer cancel_resume 中重启(任务仍 running)——run 级结算,任务留给认领循环
            transitionTier1Run(this.d.db, runId, "cancel_settled", nowIso, { cancelProofJson: JSON.stringify(proof) });
            this.d.audit.record({
              actor: "daemon",
              action: "tier1.steer_resume_settled",
              meta: { taskId, runId, recovered: true }
            });
          }
        } catch (err) {
          this.d.log.error("recover cancel settle failed", { runId, error: String(err).slice(0, 160) });
        }
        continue;
      }
      if (!task || task.status !== "running" || !repoPath || !budget) {
        // code-review B2:活跃 run 但 task 非 running(数据不一致)——不能 continue 泄漏
        // (每次重启重新捞到、无谓拉起、状态永不收敛)。清旧孤儿 + run 落终态(经取消链,
        // 不动已终结的 task)。task 缺失/无 workspace 同样终结 run。
        try {
          this.d.db
            .prepare("UPDATE tier1_runs SET restart_pending_at=NULL, restart_reason=NULL, updated_at=? WHERE id=?")
            .run(nowIso, runId);
          if (state === "running" || state === "step_paused" || state === "reserved") {
            transitionTier1Run(this.d.db, runId, "cancel_requested", nowIso);
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
          }
        } catch (err) {
          this.d.log.error("recover reap inconsistent run failed", { runId, error: String(err).slice(0, 160) });
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
        frozen: this.loadFrozen(runId),
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
        eventLine: 0,
        observedModel: null,
        resultText: "",
        terminalResultReceived: false,
        proc: null,
        completion: null,
        restartPending: false,
        restartEpoch: 0,
        resumeRestartMarker: raw["restart_pending_at"] !== null && raw["restart_pending_at"] !== undefined,
        resumeMarkerEpoch: this.shutdownEpoch,
        expectedResumeSessionId: null,
        resumeSessionConfirmed: false,
        resumeSessionError: null,
        agentOwnershipEstablished: false,
        nativeResumeAudited: false,
        processGroupVerifiedExited: false,
        claimReady: null,
        claimPromise: null,
        abort: null,
        model: this.resolveRunModel(task.project_id, runId),
        hooksJsonPath: null
      };
      let resolveClaim!: () => void;
      active.claimPromise = new Promise<void>((resolve) => { resolveClaim = resolve; });
      active.claimReady = resolveClaim;
      runnable.push({ active, wasReserved: state === "reserved" });
    }

    for (const { active } of runnable) this.active.set(active.runId, active);
    for (const { active, wasReserved } of runnable) {
      const { runId } = active;
      active.completion = this.recoverAttempt(active, wasReserved).catch((err) => {
        this.d.log.error("tier1 recover crashed", { runId, error: String(err).slice(0, 200) });
        this.resolveClaim(active);
        if (active.restartPending) return;
        if (isProcessGroupLifecycleError(err)) {
          this.contaminateLifecycle(err);
          return;
        }
        this.finalizeFailure(active, `recover_crash:${String(err).slice(0, 120)}`, "failed");
      });
    }
    // A3: recover 返回认领 barrier——每条非终态 run 完成 owner/session 或 terminal 分类。
    await Promise.all(runnable.map(({ active }) => active.claimPromise ?? Promise.resolve()));
    if (this.lifecycleContaminated) throw this.lifecycleContaminated;
  }

  private async recoverAttempt(run: ActiveRun, wasReserved: boolean): Promise<void> {
    // recover() 已在登记本轮 active/spawn 前等待旧进程组 ESRCH，防同 worktree 双 agent。
    if (run.restartPending) {
      this.resolveClaim(run);
      return;
    }
    // reserved:供给可能半程,重走 runAttempt 全链(幂等);running:同 run 注入新会话续跑
    if (wasReserved) {
      await this.runAttempt(run);
      this.resolveClaim(run);
      return;
    }
    const d = this.d;
    let pcfg: ProjectExecConfig;
    try {
      pcfg = readProjectExecConfig(run.repoPath);
      this.applyProjectFullConfig(run); // 恢复链同样消费项目层保护面(不消费则恢复 run 丢 [git].protected = 安全回退)
    } catch (err) {
      this.finalizeFailure(run, `project_toml_invalid:${String(err).slice(0, 100)}`, "blocked");
      return;
    }
    run.registry = pcfg.registry;
    if (run.frozen.length === 0) {
      // 冻结产物丢失(runDir 被清):按认领时点语义无法重建(agent 可能已改脚本)——fail-closed 重冻自主仓
      try {
        run.frozen = pcfg.verifyRefs.map((ref) => freezeVerify(run.repoPath, ref, pcfg.registry));
        d.audit.record({ actor: "daemon", action: "tier1.recover_refroze_verify", meta: { runId: run.runId } });
      } catch (err) {
        this.finalizeFailure(run, `verify_freeze_failed:${String(err).slice(0, 100)}`, "blocked");
        return;
      }
    }
    try {
      await this.provisionWorktree(run); // 幂等(worktree 已存在只补 hooks.json)
    } catch (err) {
      if (run.restartPending) {
        this.resolveClaim(run);
        throw err;
      }
      this.finalizeFailure(run, `provision_failed:${String(err).slice(0, 100)}`, "blocked");
      return;
    }
    if (run.restartPending) {
      this.resolveClaim(run);
      return;
    }
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
    run.expectedResumeSessionId = nativeSessionId;
    if (nativeSessionId === null) {
      this.d.audit.record({
        actor: "daemon",
        action: "tier1.recover_degraded_new_session",
        meta: { runId: run.runId, taskId: run.taskId, attempt: run.attempt, reason: nativeKey.reason }
      });
      run.nativeResumeAudited = true;
    }
    const proc = d.spawner.spawn({
      binary: d.cfg.lockedBinary,
      model: run.model, // W5a 3.5:恢复链同用生效模型
      prompt,
      cwd: run.worktree,
      env: strippedAgentEnv(process.env),
      ...(nativeSessionId ? { resumeChatId: nativeSessionId } : {})
    });
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
      const claimDeadline = Date.now() + 30_000;
      while (
        !run.resumeSessionConfirmed &&
        !run.resumeSessionError &&
        !run.restartPending &&
        !run.abort &&
        Date.now() < claimDeadline
      ) {
        await new Promise((resolve) => setTimeout(resolve, 10));
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
        this.finalizeFailure(
          run,
          run.resumeSessionError ?? "native_session_confirmation_missing",
          "failed",
          "恢复进程没有确认原生会话身份,这轮结果作废"
        );
        try { proc.kill(); } catch { /* wait 收口 */ }
        try {
          await proc.wait();
          run.processGroupVerifiedExited = true;
        } catch (err) {
          if (isProcessGroupLifecycleError(err)) throw this.contaminateLifecycle(err);
        }
        run.proc = null;
        this.clearAgentOwnership(run);
        return;
      }
    }
    try {
      const { exitCode } = await proc.wait();
      run.proc = null;
      run.processGroupVerifiedExited = true;
      this.clearAgentOwnership(run);
      // A2: wait 返回后再次优先处理新 suspension / abort，再看 session。
      if (run.restartPending || run.abort) {
        await this.settleAttempt(run, exitCode);
        return;
      }
      if (nativeSessionId !== null && !run.resumeSessionConfirmed) {
        this.finalizeFailure(
          run,
          run.resumeSessionError ?? "native_session_confirmation_missing",
          "failed",
          "恢复进程没有确认原生会话身份,这轮结果作废"
        );
        return;
      }
      await this.settleAttempt(run, exitCode);
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

  private clearAgentOwnership(run: ActiveRun): void {
    const runDir = this.runDir(run.runId);
    rmSync(join(runDir, "agent.pid"), { force: true });
    rmSync(join(runDir, "agent-owner.json"), { force: true });
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
      writeFileSync(join(runDir, "agent.pid"), String(proc.pid), { mode: 0o600 });
      await proc.started;
      if (proc.ownershipRequired !== true) return;
      const deadline = Date.now() + 2_000;
      let processStart: string | null = null;
      while (processStart === null && Date.now() < deadline) {
        processStart = hostKind() === "win32"
          ? processBirth(proc.pid)
          : (readOwnedAgentProcessStart(proc.pid, process.execPath, proc.commandToken) ??
            readOwnedAgentProcessStart(proc.pid, this.d.cfg.lockedBinary, proc.commandToken));
        if (processStart === null) await new Promise((resolve) => setTimeout(resolve, 20));
      }
      if (processStart === null && run.terminalResultReceived) {
        await proc.wait();
        return;
      }
      if (!processStart) throw new Error("agent process ownership identity unavailable");
      const ownerPath = join(runDir, "agent-owner.json");
      const temporary = `${ownerPath}.${process.pid}.tmp`;
      const jobName = runtimeChildJobName(proc.pid);
      try {
        writeFileSync(
          temporary,
          JSON.stringify({
            version: 1,
            runId: run.runId,
            pid: proc.pid,
            binary: this.d.cfg.lockedBinary,
            worktree: run.worktree,
            processStart,
            ...(jobName ? { jobName } : {}),
            ...runtimeChildOwnerIdentity()
          } satisfies AgentOwnershipRecord),
          { mode: 0o600 }
        );
        renameSync(temporary, ownerPath);
        proc.ownershipEstablished?.();
      } finally {
        rmSync(temporary, { force: true });
      }
    } catch (err) {
      try {
        proc.kill();
      } catch {
        // proc.wait 是最终收口判据。
      }
      await proc.wait().catch(() => undefined);
      throw err;
    }
  }

  /** 只在 durable (adapter,nativeSessionId,cwd) 与本轮 spawn 三元组规范化等值时原生 resume。 */
  private readNativeResumeKey(run: ActiveRun): { nativeSessionId: string | null; reason: string } {
    const row = this.d.db
      .prepare("SELECT adapter, native_session_id AS sid, cwd FROM tier1_runs WHERE id = ?")
      .get(run.runId) as { adapter: string; sid: string | null; cwd: string } | undefined;
    if (!row?.sid) return { nativeSessionId: null, reason: "native_session_absent" };
    if (row.adapter !== this.d.cfg.adapter) return { nativeSessionId: null, reason: "adapter_mismatch" };
    if (this.canon(row.cwd) !== this.canon(run.worktree)) return { nativeSessionId: null, reason: "cwd_mismatch" };
    return { nativeSessionId: row.sid, reason: "exact" };
  }

  private acceptNativeResume(run: ActiveRun, nativeSessionId: string): void {
    if (!run.agentOwnershipEstablished || !run.resumeSessionConfirmed) return;
    this.markRestartResumed(run);
    if (run.nativeResumeAudited) return;
    run.nativeResumeAudited = true;
    this.d.audit.record({
      actor: "daemon",
      action: "tier1.recover_resume_native",
      meta: { runId: run.runId, taskId: run.taskId, nativeSessionId }
    });
  }

  /** 清旧孤儿 agent 进程组(recover 前;ESRCH=已死,忽略) */
  private async killOrphanAgent(runId: string): Promise<void> {
    const row = this.d.db
      .prepare(
        `SELECT tier1_runs.task_id, tier1_runs.worktree_path, tier1_runs.state, tasks.project_id
         FROM tier1_runs JOIN tasks ON tasks.id=tier1_runs.task_id WHERE tier1_runs.id=?`
      )
      .get(runId) as
      | { task_id: string; worktree_path: string; state: string; project_id: string }
      | undefined;
    if (!row) return;
    await reapOwnedTier1Agent(
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
        if (run.restartPending) {
          run.restartEpoch = Math.max(run.restartEpoch, epoch);
          marked.add(run.runId);
          continue;
        }
        const durable = this.d.db
          .prepare(
            `SELECT r.state AS state, t.status AS task_status, r.native_session_id AS native_session_id
             FROM tier1_runs r JOIN tasks t ON t.id=r.task_id WHERE r.id=?`
          )
          .get(run.runId) as { state: string; task_status: string; native_session_id: string | null } | undefined;
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
    await Promise.all(completions);
    await Promise.all(processDrains);
  }

  /** 旧调用兼容；正常退出必须走 prepareShutdown。 */
  shutdown(): void {
    void this.emergencyShutdown();
  }

  /** 观测(测试/console 用) */
  activeRunCount(): number {
    return this.active.size;
  }
}
