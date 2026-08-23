// voiced daemon 入口(0.1 最小形态):HTTP /health + JSONL 日志 + 每日快照备份定时器。
// 后续 Phase 逐步挂载:WS(1.2)、存储(0.3)、配置(0.4)、工具面(1.3b)、审批(4.2)…

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { networkInterfaces } from "node:os";
import { spawn as nodeSpawn } from "node:child_process";
import { dirname, join, resolve, sep } from "node:path";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomInt, randomUUID } from "node:crypto";
import { consoleArtifactReady, consoleDistDirectory } from "./runtimeAssets.js";
import { createLogger } from "./obs/logger.js";
import {
  isSnapshotBackupDue,
  productionBaseSources,
  productionWorkspaceSourcesFromSnapshot,
  reconcileSnapshotRetention,
  runSnapshotBackup
} from "./backup/snapshot.js";
import { backupRetentionDays } from "./backup/config.js";
import { openDb } from "./storage/db.js";
import { createSqliteAuditSink } from "./storage/dao/misc.js";
import { VoiceHub } from "./voice/hub.js";
import { recordCliSubscriptionInvocation, recordTtsChars } from "./cost/ledger.js";
import { loadOrCreateCapToken } from "./net/capToken.js";
import { extractToken, verifyIdentity } from "./net/identity.js";
import { daemonListenAddress, mobileLanApiAllowed, mobileLanEnabled } from "./net/mobileLan.js";
import { pairingInfoPayload } from "./net/pairingInfo.js";
import { LatencyCollector } from "./obs/latency.js";
import {
  ArtifactAccessError,
  exportArtifacts,
  getApprovals,
  getArtifactContent,
  getArtifactDiff,
  getCosts,
  getFocusDetail,
  getFocusList,
  getMobileFocusDetail,
  getFocusSessions,
  getOutbox,
  getOverview,
  getProjectArtifacts,
  getProjectMemory,
  getProjectSettings,
  getProjectTasks,
  getTaskDetail
} from "./api/console.js";
import { getFocusStage, focusBrainInstructionDelta } from "./focus/stage.js";
import { renderFocusContextSection } from "./focus/contextSection.js";
import { requestSuspend, type SessionCloseGateDeps } from "./focus/sessionCloseGate.js";
import type { TranscriptLine } from "./focus/closeSettlement.js";
import { handleTaskAction } from "./api/actions.js";
import { handleS3Route } from "./api/s3Routes.js";
import {
  assignFocusSpace,
  createSpace,
  deleteSpace,
  listSpaces,
  renameSpace
} from "./api/spaces.js";
import { createFocusArtifact, listFocusArtifacts, realizeArtifactApi } from "./api/artifacts.js";
import { adjustExpectationApi, withdrawExpectationApi } from "./api/expectations.js";
import { ackAttentionApi, getAttention } from "./api/attention.js";
import { archiveFocusApi, createFocusApi, reopenFocusApi } from "./api/focuses.js";
import { getActivationTranscript, getFocusTimeline } from "./api/focusTimeline.js";
import { redoFromLaneApi, retireLaneApi } from "./api/lanes.js";
import { resolveObligationApi, setWaitingOnApi } from "./api/obligations.js";
import {
  clearAllSessionTaskContexts,
  clearSessionTaskContext,
  setSessionTaskContext,
  TaskContextError
} from "./focus/sessionTaskContext.js";
import { getApproval } from "./storage/dao/approvals.js";
import { recoverMergingTasks } from "./tier1/s3Tools.js";
import { loadConfigFile, paramValue, parseConfigText } from "./config/load.js";
import { assertParamSanity, enabledProjectTypes, PARAM_DEFAULTS } from "./config/types.js";
import { readGate0FromFile, readStartupLiveConfig, sanitizedConfigErrorSummary } from "./config/runtime.js";
import { seedConsoleFixture } from "./api/fixture.js";
import { appendManualEntry, buildValueReport } from "./obs/valueReport.js";
import { resolveApiProvider } from "./providers/resolve.js";
import { SessionManager } from "./session/manager.js";
import { switchAnchorActivation } from "./focus/activation.js";
import { LiveVoiceSessions } from "./live/voiceSessions.js";
import { LiveDialog } from "./live/dialog.js";
import {
  ConfirmationLoop,
  processDowngradeSagas,
  sweepConfirmationLedgerRetention
} from "./live/confirm.js";
import { ToolRegistry } from "./brain/registry.js";
import { registerLiveTools } from "./brain/liveTools.js";
import { BrainTools } from "./brain/tools.js";
import { DecisionPackageFactory } from "./packages/factory.js";
import { ArtifactStore } from "./artifacts/store.js";
import { MemoryLedger } from "./memory/ledger.js";
import { approveCandidate, nominateFromSession, projectM1Notes, rejectCandidate } from "./memory/growth.js";
import { bootstrapProjectFoundation } from "./memory/foundationOps.js";
import { MemoryFts } from "./memory/fts.js";
import { HotwordStore } from "./memory/hotwords.js";
import { FoundationBuilder } from "./memory/foundation.js";
import { Snapshotter } from "./evaluator/snapshotter.js";
import { confirmBindings, evidenceFor, listCandidates, type ReadinessCandidate } from "./evaluator/readinessBinding.js";
import { buildInstructions } from "./brain/instructions.js";
import {
  READINESS_CHECKLISTS,
  supervisorFrameSchema,
  type PrepareShutdownReason,
  type SupervisorFrame,
  type NativeReplyOrigin,
  type ReadinessEvidenceDetail
} from "@saydo/contracts";
import { Retrieval } from "./memory/retrieval.js";
import { CallbackEngine, dndWindowEnd } from "./callback/engine.js";
import { consoleBaseUrl, postNtfy, renderNtfyMessage } from "./callback/ntfy.js";
import { inDndWindow } from "./recovery/reconciler.js";
import { pickConsolePeerForTask, runCallbackSweep } from "./callback/sweep.js";
import { notifyDesktop } from "./callback/desktop.js";
import { arbitrate } from "./callback/arbitration.js";
import { ackL0ForSession, handleOutboxAck } from "./callback/ack.js";
import { readT2Config } from "./net/t2.js";
import { DeepReviewGovernor } from "./evaluator/readiness.js";
import { assembleOnSessionStart } from "./evaluator/readinessGate.js";
import { explainResult } from "./summary/explain.js";
import {
  effectiveModelBinding,
  getProjectOverrides,
  upsertProjectOverrides,
  validateProjectOverrides,
  validateStoredProjectOverrides
} from "./config/projectOverrides.js";
import { sweepRetryQueue } from "./providers/byoa/retryQueue.js";
import { abortAllByoaInvocations, activeByoaInvocationCount } from "./providers/byoa/provider.js";
import { runParkSweep } from "./live/scheduler.js";
import { sweepExpiredProposed } from "./storage/dao/packages.js";
import { buildActiveClaudeGateScript, buildActiveGateScript, ensureGateScript } from "./tier1/gateScript.js";
import { parseGateWireRequest, startGateServer } from "./tier1/gateServer.js";
import { claudeBackend } from "./tier1/backends/claude.js";
import { cursorBackend } from "./tier1/backends/cursor.js";
import { verifyClaudeIdentity } from "./tier1/claudeIdentity.js";
import { RuntimeApprovalFlow } from "./tier1/approvalFlow.js";
import { latestSessionProjectEvent } from "./projects/anchor.js";
import { ensureProjectAnchorProducts } from "./projects/anchorRebuild.js";
import {
  acceptProjectAnchorWithFollowup,
  deliverSessionProjectOrThrow
} from "./projects/anchorCommit.js";
import { compileLivePack } from "./live/pack.js";
import { Tier1Executor, realAgentSpawner } from "./tier1/executor.js";
import { retryTask } from "./tier1/operations.js";
import { markDurableTier1RestartPending } from "./tier1/restartPolicy.js";
import { tier1StartupVerdict } from "./tier1/validateConfig.js";
import { resolveTier1Adapter } from "./tier1/resolveAdapter.js";
import { verifiedProjectWorkspace } from "./storage/dao/projects.js";
import { ensureManagedWorkspaceRoot, ensureStateRoot, stateRootDigest } from "./projects/workspace.js";
import {
  acquireExclusiveLink,
  hostKind,
  listenGateHttp,
  nativeSync,
  processAlive,
  processBirth
} from "@saydo/platform";
import {
  assessRuntimeReadiness,
  pipelineRuntimeJoined,
  type PipelineRuntimeState
} from "./runtimeIdentity.js";
import type { Adapter, ProjectType } from "@saydo/contracts";
import {
  buildSetupProbe,
  confirmCliCapability,
  pendingCliSelfTestGate,
  parseSetupTestRequest,
  runSetupTest,
  writeSetupConfigStaged,
  writeSetupSecretStaged
} from "./api/setup.js";
import { parseReprobeNames, probeAllCliCapabilities, reprobeCliCapabilities } from "./config/cliCapability.js";
import {
  cliRuntimePendingPath,
  loadCliRuntimeRegistry,
  loadCliRuntimeReceiptIndex,
  loadPendingCliRuntimeRegistry,
  promotePendingCliRuntime,
  shouldPromotePendingCliRuntime
} from "./config/cliRuntime.js";
import { bootstrapConfigIfMissing } from "./config/defaultTemplate.js";
import { effectivePromotion, promoteAllPending, rollbackActivationFiles } from "./config/pending.js";
import { evaluatorFamilyContext, validateConfig as validateConfigForPromote } from "./config/validate.js";
import type { Family } from "./config/family.js";
import { readEnvMerged } from "./config/envFile.js";
import {
  resolveDialogProvider as resolveDialogSlot,
  resolveDrafterProvider as resolveDrafterSlot,
  resolveEvaluatorProvider as resolveEvaluatorSlot,
  resolveThinkingProvider as resolveThinkingSlot,
  type CliResolverContext,
  type SubscriptionInvocation
} from "./providers/slotResolvers.js";
import type { LlmProvider } from "./providers/types.js";
import { FirstRunCoordinator, hasLegacyActivity } from "./api/firstRun.js";
import { startRecoveryOnlyServer } from "./api/recoveryOnlyServer.js";
import { RUNTIME_IDENTITY } from "./buildIdentity.js";
import { getDesktopSummary } from "./api/desktop.js";
import { getRecentTranscript, parseRecentTranscriptLimit } from "./api/recentTranscript.js";
import { getRecentMemory, parseRecentMemoryLimit } from "./api/recentMemory.js";
import { configureRuntimeChildRegistry } from "./runtimeChildRegistry.js";
import { runtimeOwnershipProof } from "./runtimeOwnership.js";

if (hostKind() === "win32") nativeSync();
const SAYDO_HOME = ensureStateRoot();
// sessions/ 属 SAYDO_HOME 标准结构(与 projects//backups/ 并列),全新 HOME 也须先在:
// 备份把 global_sessions 列为**必需**源(backup/snapshot.ts),目录不在则每轮定时备份直接失败
// ——2026-08-12 全新部署实测,第一次对话之前一直报"必需备份源不存在"。
// 放在启动时建、而非备份时兜底:备份的 required 校验因此仍能抓到"跑起来之后 sessions 被删"的真故障。
mkdirSync(join(SAYDO_HOME, "sessions"), { recursive: true, mode: 0o700 });
const STARTED_AT = new Date().toISOString();
const BOOT_SUPERVISED = process.env["SAYDO_SUPERVISED"] === "1";
const RUNTIME_INSTANCE_ID = process.env["SAYDO_RUNTIME_INSTANCE_ID"] ?? randomUUID();
const INSTANCE_LOCK_PATH = join(SAYDO_HOME, ".daemon-supervisor.lock");
let instanceLockFd: number | null = null;
function acquireInstanceLock(): void {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const started = processBirth(process.pid);
      if (!started) throw new Error("saydo home lock birth identity unavailable");
      acquireExclusiveLink(INSTANCE_LOCK_PATH, JSON.stringify({
        version: 1,
        pid: process.pid,
        processStart: started,
        startedAt: STARTED_AT,
        instanceId: RUNTIME_INSTANCE_ID
      }));
      instanceLockFd = openSync(INSTANCE_LOCK_PATH, "r");
      return;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      let ownerPid: number | null = null;
      let ownerStart: string | null = null;
      try {
        const owner = JSON.parse(readFileSync(INSTANCE_LOCK_PATH, "utf8")) as { pid?: unknown; processStart?: unknown };
        ownerPid = Number(owner.pid);
        ownerStart = typeof owner.processStart === "string" ? owner.processStart : null;
      } catch {
        // 损坏锁只在没有可验证 live owner 时回收。
      }
      if (!Number.isInteger(ownerPid) || (ownerPid as number) <= 1 || !ownerStart) {
        throw new Error("saydo home supervisor lock ownership unverified");
      }
      const observedStart = processBirth(ownerPid as number);
      if (observedStart === ownerStart) {
        throw new Error(`saydo home already owned by pid ${String(ownerPid)}`);
      }
      if (observedStart !== null) {
        throw new Error("saydo home supervisor lock birth identity mismatch");
      }
      if (processAlive(ownerPid as number)) {
        throw new Error("saydo home supervisor lock birth identity unavailable");
      }
      unlinkSync(INSTANCE_LOCK_PATH);
    }
  }
  throw new Error("unable to acquire saydo home supervisor lock");
}
function releaseInstanceLock(): void {
  if (instanceLockFd === null) return;
  try { closeSync(instanceLockFd); } catch { /* 已关闭 */ }
  instanceLockFd = null;
  try {
    const owner = JSON.parse(readFileSync(INSTANCE_LOCK_PATH, "utf8")) as { pid?: unknown };
    if (owner.pid === process.pid) unlinkSync(INSTANCE_LOCK_PATH);
  } catch {
    // 只删除仍明确属于本进程的锁。
  }
}
acquireInstanceLock();
process.once("exit", releaseInstanceLock);
configureRuntimeChildRegistry(SAYDO_HOME, RUNTIME_INSTANCE_ID);
const PORT = Number(process.env["SAYDO_DAEMON_PORT"] ?? 47100);
const t2Cfg = readT2Config(join(SAYDO_HOME, "config.toml"));
const MOBILE_LAN = mobileLanEnabled(process.env["SAYDO_MOBILE_LAN"]);
const LISTEN_ADDRESS = daemonListenAddress(t2Cfg.listen, MOBILE_LAN);
let bootShutdownReason: PrepareShutdownReason | null = null;
process.on("message", (message: unknown) => {
  const parsed = supervisorFrameSchema.safeParse(message);
  if (parsed.success && parsed.data.t === "prepareShutdown") bootShutdownReason ??= parsed.data.reason;
});
process.on("SIGINT", () => { if (!BOOT_SUPERVISED) bootShutdownReason ??= "cli_sigint"; });
process.on("SIGTERM", () => { if (!BOOT_SUPERVISED) bootShutdownReason ??= "supervisor_stop"; });
if (BOOT_SUPERVISED) process.on("disconnect", () => { bootShutdownReason ??= "supervisor_stop"; });
// B9: bind 后立即提供 starting 探针，避免同 HOME attach 在 DB/migration 窗口误判 unknown_service。
let httpHandlersInstalled = false;
const BOOT_STATE_ROOT_DIGEST = stateRootDigest(SAYDO_HOME);
const server = createServer((req, res) => {
  if (httpHandlersInstalled) return;
  const pathname = (req.url ?? "/").split("?")[0] as string;
  if (pathname === "/health") {
    let token = "";
    try {
      token = process.env["SAYDO_DISABLE_CAP_TOKEN"] === "1" ? "" : loadOrCreateCapToken(SAYDO_HOME);
    } catch {
      token = "";
    }
    const ownershipProof = token
      ? runtimeOwnershipProof({
          nonce: new URL(req.url ?? "/", "http://localhost").searchParams.get("ownershipNonce"),
          token,
          pid: process.pid,
          port: PORT,
          startedAt: STARTED_AT,
          stateRootDigest: BOOT_STATE_ROOT_DIGEST,
          identity: RUNTIME_IDENTITY
        })
      : null;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      service: "saydo-daemon",
      phase: "starting",
      identity: RUNTIME_IDENTITY,
      runtimeSha: RUNTIME_IDENTITY.sourceRevision,
      stateRootDigest: BOOT_STATE_ROOT_DIGEST,
      pid: process.pid,
      startedAt: STARTED_AT,
      instanceId: RUNTIME_INSTANCE_ID,
      ...(ownershipProof ? { ownershipProof } : {}),
      ts: new Date().toISOString()
    }));
    return;
  }
  res.writeHead(503, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: false, code: "starting", message: "daemon starting", retryable: true }));
});
try {
  await new Promise<void>((resolveListen, rejectListen) => {
    const onError = (err: NodeJS.ErrnoException) => {
      server.off("error", onError);
      rejectListen(err);
    };
    server.once("error", onError);
    server.listen(PORT, LISTEN_ADDRESS, () => {
      server.off("error", onError);
      resolveListen();
    });
  });
} catch (err) {
  if (typeof process.send === "function") {
    await new Promise<void>((resolveSend) => {
      process.send?.({
        v: 1,
        t: "fatal",
        code: (err as NodeJS.ErrnoException).code === "EADDRINUSE" ? "port_conflict" : "listen_failed",
        message: String(err).slice(0, 300)
      } satisfies SupervisorFrame, () => resolveSend());
    });
  }
  releaseInstanceLock();
  process.exit(1);
}
const db = openDb(join(SAYDO_HOME, "saydo.db"));
const audit = createSqliteAuditSink(db);
// CLI runtime 只做预检;候选文件全部晋升后才发布 active 登记。
let bootCliRuntimePromoted = 0;
let bootCliRuntimePromotedBindings: Array<{ slot: string; bindingDigest: string; binaryDigest: string }> = [];
let bootCliRuntimePromotionError: string | undefined;
let bootCliRuntimeCleanupError: string | undefined;
let bootActivationRollbackFailed = false;
let bootActivationRolledBack = false;
const hasBootActivation =
  existsSync(join(SAYDO_HOME, "config.toml.pending")) ||
  existsSync(join(SAYDO_HOME, ".env.pending")) ||
  existsSync(cliRuntimePendingPath(SAYDO_HOME));
let bootActivationPreflightError: string | undefined;
let bootCandidateConfig: ReturnType<typeof parseConfigText> | undefined;
let bootPendingActivation: ReturnType<typeof loadPendingCliRuntimeRegistry>["activation"];
let bootPendingReceipts: ReturnType<typeof loadCliRuntimeReceiptIndex> | undefined;
let bootRequiredCliSlots: Array<"dialog" | "thinking" | "cheap" | "evaluator"> = [];
if (hasBootActivation) {
  try {
    const configPath = existsSync(join(SAYDO_HOME, "config.toml.pending"))
      ? join(SAYDO_HOME, "config.toml.pending")
      : join(SAYDO_HOME, "config.toml");
    const cfg = parseConfigText(readFileSync(configPath, "utf8"));
    bootCandidateConfig = cfg;
    const env: Record<string, string | undefined> = {
      ...process.env,
      ...readEnvMerged(SAYDO_HOME, true).values
    };
    const v = validateConfigForPromote({ config: cfg, env });
    if (!v.ok) {
      throw new Error(v.violations.map((x) => x.message).join("; ").slice(0, 300));
    }
    const pendingActivation = loadPendingCliRuntimeRegistry(SAYDO_HOME).activation;
    bootPendingActivation = pendingActivation;
    bootPendingReceipts = loadCliRuntimeReceiptIndex(db, "pending", pendingActivation);
    const cliGate = pendingCliSelfTestGate(
      SAYDO_HOME,
      bootPendingReceipts,
      true
    );
    if (!cliGate.ok) {
      throw new Error(`CLI self-test 尚未通过:${cliGate.missingSlots.join(",")}`);
    }
    bootRequiredCliSlots = (["dialog", "thinking", "cheap", "evaluator"] as const).filter((slot) => {
      const binding = cfg.models[slot];
      return typeof binding !== "string" && binding.provider !== "api";
    });
  } catch (err) {
    bootActivationPreflightError = String(err instanceof Error ? err.message : err).slice(0, 300);
    bootCliRuntimePromotionError = bootActivationPreflightError;
  }
}
// first-run onboarding v4:config/.env 共用 activation preflight,任一失败均不发布另一份。
const bootPromote = promoteAllPending(SAYDO_HOME, {
  validateConfigText: (text) => {
    parseConfigText(text);
  },
  validateActivation: () => {
    if (bootActivationPreflightError) throw new Error(bootActivationPreflightError);
  }
});
if (
  !bootActivationPreflightError &&
  bootCandidateConfig &&
  bootPendingReceipts &&
  existsSync(cliRuntimePendingPath(SAYDO_HOME)) &&
  shouldPromotePendingCliRuntime(SAYDO_HOME, bootPromote)
) {
  try {
    const result = promotePendingCliRuntime(
      SAYDO_HOME,
      {
        dialog: bootCandidateConfig.models.dialog,
        thinking: bootCandidateConfig.models.thinking,
        cheap: bootCandidateConfig.models.cheap,
        evaluator: bootCandidateConfig.models.evaluator
      },
      audit,
      bootPendingReceipts,
      bootPendingActivation
    );
    if (result.promotedBindings.length !== bootRequiredCliSlots.length) {
      throw new Error("CLI runtime activation 未全量发布");
    }
    bootCliRuntimePromoted = result.promoted;
    bootCliRuntimePromotedBindings = result.promotedBindings;
    bootCliRuntimeCleanupError = result.cleanupError;
  } catch (err) {
    const rollback = rollbackActivationFiles(SAYDO_HOME, bootPendingActivation, bootPromote);
    const cause = String(err instanceof Error ? err.message : err).slice(0, 200);
    bootCliRuntimePromotionError = rollback.ok
      ? `${cause},已恢复旧活动文件`
      : `${cause},文件回滚失败:${rollback.error}`;
    bootActivationRollbackFailed = !rollback.ok;
    bootActivationRolledBack = rollback.ok;
  }
}
const bootActivationOutcome = {
  rolledBack: bootActivationRolledBack,
  rollbackFailed: bootActivationRollbackFailed
};
const bootConfigPromoted = effectivePromotion(bootPromote.config, bootActivationOutcome);
const bootEnvPromoted = effectivePromotion(bootPromote.env, bootActivationOutcome);
const STATE_ROOT_DIGEST = stateRootDigest(SAYDO_HOME);
const DAEMON_DIR = join(dirname(fileURLToPath(import.meta.url)), ".."); // src/ 上一层 = packages/daemon
const SUPERVISED = BOOT_SUPERVISED;
const DISTRIBUTED_CONSOLE_READY = consoleArtifactReady(DAEMON_DIR);
const PIPELINE_HEALTH_MAX_AGE_MS = 45_000;
let pipelineRuntimeState: PipelineRuntimeState = {
  connected: false,
  runtimeSha: null,
  protocolVersion: null,
  stateRootDigest: null,
  lastHealthAtMs: 0,
  asr: "down",
  tts: "down"
};
let runtimeDraining = false;
let shutdownPromise: Promise<void> | null = null;
let fatalPromise: Promise<never> | null = null;
let dbClosed = false;
let tier1Executor: Tier1Executor | null = null;
let tier1GateServer: ReturnType<typeof startGateServer> | null = null;
let inactiveTier1Drain: Promise<{ recoverableTier1: number; abortedUnrecoverable?: number }> | null = null;
let startupLifecycleReady = false;
let pendingShutdownReason: PrepareShutdownReason | null = null;
const runtimeIntervals: NodeJS.Timeout[] = [];
const runtimeJobs = new Set<Promise<void>>();
const runtimeJobAbort = new AbortController();
let acceptingRuntimeJobs = true;
let setupRestartRequested = false;
/** B4: 单一 lifecycle intent CAS；signal/fatal 优先于 restart。 */
type LifecycleIntent =
  | { kind: "signal"; reason: PrepareShutdownReason }
  | { kind: "restart"; generation: number }
  | { kind: "fatal"; code: string };
let lifecycleIntent: LifecycleIntent | null = null;

function claimLifecycleIntent(next: LifecycleIntent): boolean {
  if (!lifecycleIntent) {
    lifecycleIntent = next;
    return true;
  }
  if (lifecycleIntent.kind === "fatal") return false;
  if (next.kind === "fatal") {
    lifecycleIntent = next;
    return true;
  }
  if (lifecycleIntent.kind === "signal") return next.kind === "signal" && lifecycleIntent.reason === next.reason;
  if (lifecycleIntent.kind === "restart" && next.kind === "signal") {
    lifecycleIntent = next;
    return true;
  }
  if (lifecycleIntent.kind === "restart" && next.kind === "restart") {
    return lifecycleIntent.generation === next.generation;
  }
  return false;
}

function armShutdownIngress(): void {
  runtimeDraining = true;
  acceptingRuntimeJobs = false;
  try { runtimeJobAbort.abort(); } catch { /* 已 abort */ }
  clearRuntimeIntervals();
}
function scheduleRuntimeInterval(task: () => void, intervalMs: number): void {
  const timer = setInterval(task, intervalMs);
  timer.unref();
  runtimeIntervals.push(timer);
}
function clearRuntimeIntervals(): void {
  for (const timer of runtimeIntervals) clearInterval(timer);
  runtimeIntervals.length = 0;
}
function startRuntimeJob(job: (signal: AbortSignal) => Promise<void>): void {
  if (!acceptingRuntimeJobs) return;
  void trackRuntimeJob(job);
}
function trackRuntimeJob<T>(job: (signal: AbortSignal) => Promise<T>): Promise<T> {
  if (!acceptingRuntimeJobs) return Promise.reject(new Error("runtime is draining"));
  const result = job(runtimeJobAbort.signal);
  const running = result.then(() => undefined, () => undefined).finally(() => runtimeJobs.delete(running));
  runtimeJobs.add(running);
  return result;
}
async function drainRuntimeJobs(): Promise<void> {
  acceptingRuntimeJobs = false;
  runtimeJobAbort.abort();
  await Promise.allSettled([...runtimeJobs]);
}
/** self-restart 协调世代(pipeline 重连上报后可对账) */
let lastRestartGeneration: number | undefined;

const log = createLogger({ dir: join(SAYDO_HOME, "logs"), name: "daemon" });
if (SUPERVISED && typeof process.send !== "function") {
  log.error("supervised daemon missing IPC channel");
  db.close();
  process.exit(1);
}
if (SUPERVISED && !DISTRIBUTED_CONSOLE_READY) {
  log.error("supervised daemon console artifact incomplete");
  await new Promise<void>((resolveSend) => {
    try {
      const send = process.send;
      if (typeof send !== "function") {
        resolveSend();
        return;
      }
      send.call(
        process,
        {
          v: 1,
          t: "fatal",
          code: "distribution_incomplete",
          message: "console artifact 缺 index.html 或 hash asset"
        } satisfies SupervisorFrame,
        () => resolveSend()
      );
    } catch {
      resolveSend();
    }
  });
  db.close();
  process.exit(1);
}
const firstRun = new FirstRunCoordinator(db, SAYDO_HOME, hasLegacyActivity(db));
firstRun.initializeEligibility();

// onboarding v6:空 HOME 首启自举 config.toml(缺省模板;已存在不动)
const bootCfg = bootstrapConfigIfMissing(SAYDO_HOME, audit);
if (bootCfg.wrote) {
  log.info("config.toml bootstrapped from default template", { path: bootCfg.path });
}

const activeConfigValidation = (() => {
  try {
    const config = loadConfigFile(join(SAYDO_HOME, "config.toml"));
    const validation = validateConfigForPromote({
      config,
      env: { ...process.env, ...readEnvMerged(SAYDO_HOME, false).values }
    });
    const violations = [
      ...validation.violations,
      ...validateStoredProjectOverrides(db, config),
      ...(
        bootActivationRollbackFailed ||
        (!bootPromote.config.ok &&
          "stage" in bootPromote.config &&
          bootPromote.config.stage === "activation_rollback_failed")
          ? [{ code: "activation_rollback_failed", message: "候选配置回滚未完成,只开放配置自救面" }]
          : [])
    ];
    try {
      assertParamSanity({ ...PARAM_DEFAULTS, ...(config.params ?? {}) });
    } catch (err) {
      violations.push({
        code: "params_invalid",
        message: `活动 [params] 不合法:${sanitizedConfigErrorSummary(err)}`
      });
    }
    return {
      ...validation,
      ok: violations.length === 0,
      violations,
      ...(violations.length > 0 ? { effective: undefined } : {})
    };
  } catch (err) {
    return {
      ok: false as const,
      violations: [
        {
          code: "active_config_unreadable",
          message: `活动 config.toml 不可读:${sanitizedConfigErrorSummary(err)}`
        }
      ],
      hints: [],
      devMode: false
    };
  }
})();
const RECOVERY_ONLY = !activeConfigValidation.ok;

if (RECOVERY_ONLY) {
  server.removeAllListeners("request");
  httpHandlersInstalled = true;
  startRecoveryOnlyServer({
    saydoHome: SAYDO_HOME,
    daemonDir: DAEMON_DIR,
    port: PORT,
    startedAt: STARTED_AT,
    identity: RUNTIME_IDENTITY,
    stateRootDigest: STATE_ROOT_DIGEST,
    db,
    audit,
    log,
    supervised: SUPERVISED,
    violations: activeConfigValidation.violations,
    preboundServer: server,
    pendingShutdownReason: bootShutdownReason,
    onReleaseLock: releaseInstanceLock
  });
} else {

ensureManagedWorkspaceRoot();

// G1 网络半边(4.1):capability token(落 ~/.saydo/.cap-token,pipeline/console 读同一文件);
// SAYDO_DISABLE_CAP_TOKEN=1 显式关闭(dev)⇒ 空 token,verifyIdentity 因空 expectedToken 拒(不 fail-open)
const CAP_TOKEN = process.env["SAYDO_DISABLE_CAP_TOKEN"] === "1" ? "" : loadOrCreateCapToken(SAYDO_HOME);

// W2 阶段 B(T2 薄版):tailnet 白名单枚举 + 监听地址在开库前冻结并取得端口所有权。
if (t2Cfg.rejectedReason) {
  log.error("t2 tailnet allowlist rejected (fail-closed)", { reason: t2Cfg.rejectedReason });
  audit.record({ actor: "daemon", action: "t2.allowlist_rejected", meta: { reason: t2Cfg.rejectedReason.slice(0, 200) } });
}

function checkIdentity(req: IncomingMessage): {
  ok: boolean;
  code?: string;
  via?: "local" | "tailnet" | "mobile_lan";
} {
  const host = req.headers["host"];
  const origin = req.headers["origin"];
  const referer = req.headers["referer"];
  const secFetchSite = req.headers["sec-fetch-site"];
  const v = verifyIdentity({
    host: Array.isArray(host) ? host[0] : host,
    origin: Array.isArray(origin) ? origin[0] : origin,
    referer: Array.isArray(referer) ? referer[0] : referer,
    secFetchSite: Array.isArray(secFetchSite) ? secFetchSite[0] : secFetchSite,
    peerAddress: req.socket.remoteAddress,
    token: extractToken(req.url, req.headers),
    port: PORT,
    expectedToken: CAP_TOKEN,
    tailnetHosts: t2Cfg.tailnetHosts,
    mobileLan: MOBILE_LAN
  });
  return v.ok ? { ok: true, via: v.via } : { ok: false, code: v.code };
}

server.removeAllListeners("request");
httpHandlersInstalled = true;
server.on("request", (req, res) => {
  // 路径匹配一律用 pathname(带 ?token= 的请求不落 404)
  const pathname = (req.url ?? "/").split("?")[0] as string;
  if (pathname === "/health") {
    const ownershipProof = runtimeOwnershipProof({
      nonce: new URL(req.url ?? "/", "http://localhost").searchParams.get("ownershipNonce"),
      token: CAP_TOKEN,
      pid: process.pid,
      port: PORT,
      startedAt: STARTED_AT,
      stateRootDigest: STATE_ROOT_DIGEST,
      identity: RUNTIME_IDENTITY
    });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        service: "saydo-daemon",
        identity: RUNTIME_IDENTITY,
        runtimeSha: RUNTIME_IDENTITY.sourceRevision,
        stateRootDigest: STATE_ROOT_DIGEST,
        // first-run onboarding v4 ready 握手:console 以 pid 变化判定交接完成
        pid: process.pid,
        startedAt: STARTED_AT,
        ...(ownershipProof ? { ownershipProof } : {}),
        ts: new Date().toISOString()
      })
    );
    return;
  }
  if (pathname === "/readyz") {
    // A3: HTTP ready 不得早于 recover barrier；draining 期间不得宣称 coreReady。
    const lifecycleReady = startupLifecycleReady && !runtimeDraining;
    const readiness = assessRuntimeReadiness(
      {
        daemonIdentity: RUNTIME_IDENTITY,
        daemonStateRootDigest: STATE_ROOT_DIGEST,
        pipeline: pipelineRuntimeState,
        nowMs: Date.now(),
        maxHealthAgeMs: PIPELINE_HEALTH_MAX_AGE_MS,
        coreReady: lifecycleReady && !RECOVERY_ONLY && DISTRIBUTED_CONSOLE_READY
      },
      voiceHub.pipelineAvailable()
    );
    res.writeHead(readiness.coreReady ? 200 : 503, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        ok: readiness.coreReady,
        service: "saydo-runtime",
        identity: RUNTIME_IDENTITY,
        version: readiness.version,
        coreReady: readiness.coreReady,
        voiceReady: readiness.voiceReady,
        voice: readiness.voice,
        startupLifecycleReady,
        runtimeDraining,
        daemonRuntimeSha: RUNTIME_IDENTITY.sourceRevision,
        pipelineRuntimeSha: pipelineRuntimeState.runtimeSha,
        daemonStateRootDigest: STATE_ROOT_DIGEST,
        pipelineStateRootDigest: pipelineRuntimeState.stateRootDigest,
        pipelineConnected: readiness.pipeline.connected,
        pipelineHealthAgeMs: Number.isFinite(readiness.healthAgeMs) ? readiness.healthAgeMs : null,
        asr: readiness.pipeline.asr,
        tts: readiness.pipeline.tts,
        recovery: RECOVERY_ONLY
          ? { active: true, mode: "recovery_only", violations: activeConfigValidation.violations }
          : { active: false, mode: "normal" },
        ts: new Date().toISOString()
      })
    );
    return;
  }
  // dev 注入端点(计划 1.2 注入通道的 HTTP 面)——4.1 起强制身份校验(G1);
  // 2026-07-25 评审 A3 回修:不限方法(旧仅拦 POST,GET /dev/latency-report 绕门);
  // 阶段 B:/dev/* 只留本机面(注入通道不对 tailnet 开,最小面)
  if (pathname.startsWith("/dev/")) {
    const idv = checkIdentity(req);
    if (!idv.ok || idv.via !== "local") {
      res.writeHead(403, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          ok: false,
          code: idv.ok ? "dev_local_only" : (idv.code ?? "identity_rejected"),
          message: idv.ok ? "/dev/* 注入通道仅限本机(tailnet 面不开)" : "G1 identity check failed",
          retryable: false
        })
      );
      return;
    }
  }
  // 冒烟 fixture(5.1/5.2 Playwright;库空才种,身份门在上方 /dev/* 统一校验)
  if (req.method === "POST" && pathname === "/dev/seed-fixture") {
    const out = seedConsoleFixture(db, { artifactsDir: join(SAYDO_HOME, "artifacts") }); // W5a 3.6:真产物文件
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(out));
    return;
  }
  if (req.method === "POST" && (pathname === "/dev/inject" || pathname === "/dev/say")) {
    let body = "";
    let devBytes = 0;
    let devOverflow = false;
    req.on("data", (c: Buffer) => {
      devBytes += c.length; // C-3(回收批 2 复审):/dev 路由同享 1MB 字节上限
      if (devBytes > 1_048_576) {
        if (!devOverflow) {
          devOverflow = true;
          res.writeHead(413, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, code: "payload_too_large", message: "body exceeds 1MB", retryable: false }));
          req.destroy();
        }
        return;
      }
      body += c.toString();
    });
    req.on("end", () => {
      if (devOverflow) return;
      try {
        const json = JSON.parse(body) as Record<string, unknown>;
        if (pathname === "/dev/say") {
          voiceHub.sendTtsSay({
            t: "tts.say",
            sessionId: String(json["sessionId"]),
            sentenceId: String(json["sentenceId"] ?? `s-${Date.now()}`),
            text: String(json["text"]),
            interruptible: true
          });
        } else {
          voiceHub.injectPipelineMsg(json as never);
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, code: "bad_inject", message: String(err).slice(0, 200), retryable: false }));
      }
    });
    return;
  }
  // M3:五段延迟分解表(Phase 1 出口/5.4 总验收出表;GET 只读)
  if (req.method === "GET" && pathname === "/dev/latency-report") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(latencyCollector.report()));
    return;
  }
  // D1 控制台 API(5.1/5.2 只读 + 接线批动作写口;G1 身份门统一把守)
  if ((req.url ?? "").startsWith("/api/")) {
    const idv = checkIdentity(req);
    if (!idv.ok) {
      res.writeHead(403, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, code: idv.code ?? "identity_rejected", message: "G1 identity check failed", retryable: false }));
      return;
    }
    const idvVia = idv.via; // 阶段 B:来源面标注(local=受信终端 / tailnet=手机薄版)
    if (idvVia === "mobile_lan" && !mobileLanApiAllowed(req.method, pathname)) {
      res.writeHead(403, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          ok: false,
          code: "mobile_lan_route_rejected",
          message: "M1 移动 LAN 面未开放此路由",
          retryable: false
        })
      );
      return;
    }
    const recoveryWriteAllowed =
      pathname === "/api/setup/config" ||
      pathname === "/api/setup/secret" ||
      pathname === "/api/setup/test" ||
      pathname === "/api/setup/restart" ||
      pathname === "/api/setup/project-overrides/clear-invalid" ||
      pathname === "/api/setup/cli-capability/confirm" ||
      pathname === "/api/setup/cli-capability/reprobe";
    if (RECOVERY_ONLY && req.method === "POST" && !recoveryWriteAllowed) {
      res.writeHead(503, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          ok: false,
          code: "recovery_only",
          message: "活动模型配置不合法,当前仅开放读取与配置自救;对话和 dispatch 已停用",
          retryable: false
        })
      );
      return;
    }
    // W4 3.1:S3 面(09 §3.3)—— challenge/register/verify/status/approve-merge;
    // assertS3LocalAndBound 四断言在 handleS3Route 内先行(socket peer 可信,不可伪造)
    const s3GuardInput = {
      socketRemoteAddress: req.socket.remoteAddress,
      origin: ((): string | undefined => {
        const o = req.headers["origin"];
        return Array.isArray(o) ? o[0] : o;
      })(),
      via: idvVia === "local" ? ("local" as const) : ("tailnet" as const),
      port: PORT
    };
    const isS3Face = pathname.startsWith("/api/s3/") || /^\/api\/tasks\/[^/]+\/approve-merge$/.test(pathname);
    if (isS3Face) {
      let s3body = "";
      req.on("data", (c: Buffer) => {
        if (s3body.length < 1_048_576) s3body += c.toString();
      });
      req.on("end", () => {
        let parsedBody: unknown = {};
        try {
          parsedBody = s3body.trim() === "" ? {} : (JSON.parse(s3body) as unknown);
        } catch {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, code: "bad_json", message: "request body is not valid json", retryable: false }));
          return;
        }
        const out = handleS3Route(
          {
            db,
            audit,
            runsDir: join(SAYDO_HOME, "tier1", "runs"),
            say: (text) => {
              const row = db.prepare("SELECT id FROM sessions WHERE state='talking' ORDER BY started_at DESC LIMIT 1").get() as
                | { id: string }
                | undefined;
              if (row) say(row.id, `s-s3-${Date.now()}`, text);
            }
          },
          { method: req.method ?? "GET", pathname, body: parsedBody, guard: s3GuardInput }
        );
        if (!out) {
          res.writeHead(404, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, code: "not_found", message: "unknown s3 route", retryable: false }));
          return;
        }
        res.writeHead(out.status, { "content-type": "application/json" });
        res.end(JSON.stringify(out.payload));
      });
      return;
    }
    if (req.method === "GET") {
      try {
        const u = new URL(req.url as string, `http://127.0.0.1:${PORT}`);
        if (u.pathname === "/api/pairing-info") {
          if (idvVia !== "local") {
            res.writeHead(403, { "content-type": "application/json" });
            res.end(
              JSON.stringify({
                ok: false,
                code: "pairing_local_only",
                message: "配对信息仅限本机受信终端",
                retryable: false
              })
            );
            return;
          }
          res.writeHead(200, { "content-type": "application/json" });
          res.end(
            JSON.stringify(
              pairingInfoPayload({
                ifaces: networkInterfaces(),
                port: PORT,
                mobileLanEnabled: MOBILE_LAN
              })
            )
          );
          return;
        }
        // first-run onboarding:setup 四端点仅本机(tailnet 一律 403)
        if (u.pathname === "/api/setup/probe") {
          if (idvVia === "tailnet") {
            res.writeHead(403, { "content-type": "application/json" });
            res.end(
              JSON.stringify({
                ok: false,
                code: "setup_local_only",
                message: "配置向导仅限本机受信终端(tailnet 面不开)",
                retryable: false
              })
            );
            return;
          }
          void trackRuntimeJob(async (signal) => {
            const probe = await buildSetupProbe({
              saydoHome: SAYDO_HOME,
              signal,
              cliRuntimeReceipts: loadCliRuntimeReceiptIndex(db),
              recoveryViolations: RECOVERY_ONLY ? activeConfigValidation.violations : [],
              voice: {
                pipelinePeer: voiceHub.pipelineAvailable(),
                asr: pipelineRuntimeState.asr,
                tts: pipelineRuntimeState.tts
              }
            });
            res.writeHead(200, { "content-type": "application/json" });
            res.end(
              JSON.stringify({
                ...probe,
                bootPromote: {
                  config: bootPromote.config.ok
                    ? { ok: true, promoted: bootConfigPromoted, rolledBack: bootActivationRolledBack }
                    : {
                        ok: false,
                        stage: "stage" in bootPromote.config ? bootPromote.config.stage : "unknown",
                        error: "error" in bootPromote.config ? bootPromote.config.error : undefined
                      },
                  env: bootPromote.env.ok
                    ? { ok: true, promoted: bootEnvPromoted, rolledBack: bootActivationRolledBack }
                    : {
                        ok: false,
                        stage: "stage" in bootPromote.env ? bootPromote.env.stage : "unknown",
                        error: "error" in bootPromote.env ? bootPromote.env.error : undefined
                      }
                }
              })
            );
          }).catch((err) => {
            if (!res.headersSent) res.writeHead(503, { "content-type": "application/json" });
            if (!res.writableEnded) res.end(JSON.stringify({ ok: false, code: "runtime_draining", message: String(err).slice(0, 160) }));
          });
          return;
        }
        // first-run onboarding:本机 CLI 能力(登录态 + 可枚举模型);与 probe 同门禁,仅本机
        if (u.pathname === "/api/setup/cli-capability") {
          if (idvVia === "tailnet") {
            res.writeHead(403, { "content-type": "application/json" });
            res.end(
              JSON.stringify({
                ok: false,
                code: "setup_local_only",
                message: "配置向导仅限本机受信终端(tailnet 面不开)",
                retryable: false
              })
            );
            return;
          }
          void trackRuntimeJob((signal) => probeAllCliCapabilities({ signal }))
            .then((clis) => {
              res.writeHead(200, { "content-type": "application/json" });
              res.end(JSON.stringify({ ok: true, clis }));
            })
            .catch((err: unknown) => {
              res.writeHead(500, { "content-type": "application/json" });
              res.end(
                JSON.stringify({
                  ok: false,
                  code: "cli_probe_failed",
                  message: String(err).slice(0, 200),
                  retryable: true
                })
              );
            });
          return;
        }
        // 批次③a:timeline / transcript 读口(带 HTTP status;本批无 ws timeline_appended)
        const mTimeline = /^\/api\/focuses\/([^/]+)\/timeline$/.exec(u.pathname);
        if (mTimeline) {
          const limitParam = u.searchParams.get("limit");
          const cursorParam = u.searchParams.get("cursor");
          const limit =
            limitParam === null || limitParam === ""
              ? 50
              : Number.isInteger(Number(limitParam))
                ? Number(limitParam)
                : NaN;
          const cursor =
            cursorParam === null || cursorParam === ""
              ? null
              : Number.isInteger(Number(cursorParam))
                ? Number(cursorParam)
                : NaN;
          const out = getFocusTimeline(db, decodeURIComponent(mTimeline[1] as string), {
            cursor: Number.isNaN(cursor) ? -1 : cursor,
            limit: Number.isNaN(limit) ? -1 : limit
          });
          res.writeHead(out.status, { "content-type": "application/json" });
          res.end(JSON.stringify(out.payload));
          return;
        }
        const mTranscript = /^\/api\/focuses\/([^/]+)\/activations\/([^/]+)\/transcript$/.exec(u.pathname);
        if (mTranscript) {
          const out = getActivationTranscript(
            db,
            decodeURIComponent(mTranscript[1] as string),
            decodeURIComponent(mTranscript[2] as string)
          );
          res.writeHead(out.status, { "content-type": "application/json" });
          res.end(JSON.stringify(out.payload));
          return;
        }
        const mArtVer = /^\/api\/artifacts\/([^/]+)\/versions\/([^/]+)$/.exec(u.pathname);
        if (mArtVer) {
          const version = Number(mArtVer[2]);
          const projectId = u.searchParams.get("project") ?? "";
          if (!Number.isInteger(version) || version <= 0) {
            res.writeHead(400, { "content-type": "application/json" });
            res.end(JSON.stringify({ ok: false, code: "bad_version", message: "version 须为正整数", retryable: false }));
            return;
          }
          try {
            const out = getArtifactContent(db, artifactStore, mArtVer[1] as string, version, projectId);
            res.writeHead(200, { "content-type": "application/json" });
            res.end(JSON.stringify(out));
          } catch (err) {
            if (err instanceof ArtifactAccessError) {
              res.writeHead(err.status, { "content-type": "application/json" });
              res.end(JSON.stringify({ ok: false, code: err.code, message: err.message, retryable: false }));
              return;
            }
            throw err;
          }
          return;
        }
        const payload = routeConsoleApi(u, idvVia);
        if (payload === undefined) {
          res.writeHead(404, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, code: "not_found", message: "unknown api route", retryable: false }));
          return;
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(payload));
      } catch (err) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(
          JSON.stringify({ ok: false, code: "api_error", message: publicApiErrorMessage(err), retryable: true })
        );
      }
      return;
    }
    // 动作写口(接线批任务②):POST /api/tasks/:id/<review|cancel|retry|request-manual-merge>
    // + 执行器批(任务②):POST /api/approvals/:id/decide(执行中 S2 审批的屏幕决策口)
    if (req.method === "POST") {
      // first-run onboarding:setup 写口/自检/self-restart(仅本机;tailnet 403)
      if (
        pathname === "/api/setup/config" ||
        pathname === "/api/setup/secret" ||
        pathname === "/api/setup/test" ||
        pathname === "/api/setup/restart" ||
        pathname === "/api/setup/project-overrides/clear-invalid" ||
        pathname === "/api/setup/first-run/query" ||
        pathname === "/api/setup/cli-capability/confirm" ||
        pathname === "/api/setup/cli-capability/reprobe"
      ) {
        if (idvVia === "tailnet" || (idvVia === "mobile_lan" && pathname !== "/api/setup/first-run/query")) {
          res.writeHead(403, { "content-type": "application/json" });
          res.end(
            JSON.stringify({
              ok: false,
              code: "setup_local_only",
              message: "配置向导仅限本机受信终端(tailnet 面不开)",
              retryable: false
            })
          );
          return;
        }
        let sbody = "";
        let sbytes = 0;
        let soverflow = false;
        req.on("data", (c: Buffer) => {
          sbytes += c.length;
          if (sbytes > 65_536) {
            if (!soverflow) {
              soverflow = true;
              res.writeHead(413, { "content-type": "application/json" });
              res.end(JSON.stringify({ ok: false, code: "payload_too_large", message: "body exceeds 64KB", retryable: false }));
              req.destroy();
            }
            return;
          }
          sbody += c.toString();
        });
        req.on("end", () => {
          if (soverflow) return;
          void (async () => {
            try {
              if (pathname === "/api/setup/first-run/query") {
                if (RECOVERY_ONLY) {
                  res.writeHead(503, { "content-type": "application/json" });
                  res.end(
                    JSON.stringify({
                      ok: false,
                      code: "recovery_only",
                      message: "活动模型配置不合法,当前仅开放配置自救;改成全 API 并重启后再进入对话",
                      retryable: false
                    })
                  );
                  return;
                }
                let parsed: unknown = {};
                try {
                  parsed = sbody.trim() === "" ? {} : JSON.parse(sbody);
                } catch {
                  res.writeHead(400, { "content-type": "application/json" });
                  res.end(JSON.stringify({ ok: false, code: "bad_json", message: "request body is not valid json", retryable: false }));
                  return;
                }
                const sessionId = (parsed as Record<string, unknown> | null)?.["sessionId"];
                if (typeof sessionId !== "string" || !/^ses_[0-9A-HJKMNP-TV-Z]{26}$/u.test(sessionId)) {
                  res.writeHead(422, { "content-type": "application/json" });
                  res.end(JSON.stringify({ ok: false, code: "session_id_invalid", message: "sessionId 形状不合法", retryable: false }));
                  return;
                }
                const out = firstRun.query(sessionId, ({ sessionId: sid, turnId, text, alreadyRecorded }) => {
                  if (!alreadyRecorded) {
                    liveSessions.ensureSession(sid);
                    liveSessions.onAiSentences(sid, [{ sentenceId: turnId, text }], {
                      origin: "onboarding",
                      touchIdle: false
                    });
                    liveSessions.settlePendingAi(sid);
                    audit.record({ actor: "daemon", action: "onboarding.first_run_presented", meta: { sessionId: sid, turnId } });
                  }
                  const nativeDelivery = voiceHub.sendNativeReply({
                    sessionId: sid,
                    turnId,
                    sentenceId: turnId,
                    text,
                    origin: "onboarding"
                  });
                  return idvVia !== "mobile_lan" || nativeDelivery.succeeded > 0;
                });
                res.writeHead(200, { "content-type": "application/json" });
                res.end(JSON.stringify({ ok: true, ...out }));
                return;
              }
              if (pathname === "/api/setup/project-overrides/clear-invalid") {
                res.writeHead(409, { "content-type": "application/json" });
                res.end(JSON.stringify({ ok: false, code: "not_in_recovery", message: "当前不在配置自救模式", retryable: false }));
                return;
              }
              if (pathname === "/api/setup/config") {
                let parsed: unknown = {};
                try {
                  parsed = sbody.trim() === "" ? {} : JSON.parse(sbody);
                } catch {
                  res.writeHead(400, { "content-type": "application/json" });
                  res.end(JSON.stringify({ ok: false, code: "bad_json", message: "request body is not valid json", retryable: false }));
                  return;
                }
                const out = writeSetupConfigStaged(SAYDO_HOME, parsed, undefined, (config) =>
                  validateStoredProjectOverrides(db, config)
                );
                if (!out.ok) {
                  res.writeHead(out.status, { "content-type": "application/json" });
                  res.end(
                    JSON.stringify({
                      ok: false,
                      code: out.code,
                      message: out.message,
                      violations: out.violations,
                      retryable: false
                    })
                  );
                  return;
                }
                audit.record({ actor: "owner", action: "setup.config_staged", meta: {} });
                res.writeHead(200, { "content-type": "application/json" });
                res.end(JSON.stringify({ ok: true, restart_required: true }));
                return;
              }
              if (pathname === "/api/setup/secret") {
                let parsed: unknown = {};
                try {
                  parsed = sbody.trim() === "" ? {} : JSON.parse(sbody);
                } catch {
                  res.writeHead(400, { "content-type": "application/json" });
                  res.end(JSON.stringify({ ok: false, code: "bad_json", message: "request body is not valid json", retryable: false }));
                  return;
                }
                // value 永不入日志;writeSetupSecretStaged 内 audit 只记 name
                const out = writeSetupSecretStaged(SAYDO_HOME, parsed, audit);
                if (!out.ok) {
                  res.writeHead(out.status, { "content-type": "application/json" });
                  res.end(JSON.stringify({ ok: false, code: out.code, message: out.message, retryable: false }));
                  return;
                }
                res.writeHead(200, { "content-type": "application/json" });
                res.end(JSON.stringify({ ok: true, name: out.name, restart_required: true }));
                return;
              }
              if (pathname === "/api/setup/test") {
                if (runtimeDraining) {
                  res.writeHead(503, { "content-type": "application/json" });
                  res.end(JSON.stringify({
                    ok: false,
                    code: "daemon_draining",
                    message: "daemon 正在退出,不能发起新的 setup self-test",
                    retryable: true
                  }));
                  return;
                }
                let parsed: unknown = {};
                try {
                  parsed = sbody.trim() === "" ? {} : JSON.parse(sbody);
                } catch {
                  res.writeHead(400, { "content-type": "application/json" });
                  res.end(JSON.stringify({ ok: false, code: "bad_json", message: "request body is not valid json", retryable: false }));
                  return;
                }
                const { scope } = parseSetupTestRequest(parsed);
                const out = await trackRuntimeJob((signal) => runSetupTest({
                  saydoHome: SAYDO_HOME,
                  signal,
                  scope,
                  voice: {
                    pipelinePeer: voiceHub.pipelineAvailable(),
                    asr: pipelineRuntimeState.asr,
                    tts: pipelineRuntimeState.tts
                  },
                  audit,
                  cliRuntimeReceipts: loadCliRuntimeReceiptIndex(db),
                  onSubscriptionInvocation: recordCliInvocation,
                  log
                }));
                // active 配置补做 CLI self-test 后,同进程下一轮必须立即看到新登记。
                dialogProvider = resolveDialogProvider();
                res.writeHead(200, { "content-type": "application/json" });
                res.end(JSON.stringify({ ok: true, ...out }));
                return;
              }
              if (pathname === "/api/setup/cli-capability/reprobe") {
                if (runtimeDraining) {
                  res.writeHead(503, { "content-type": "application/json" });
                  res.end(JSON.stringify({
                    ok: false,
                    code: "daemon_draining",
                    message: "daemon 正在退出,不能发起 CLI 轻量重探",
                    retryable: true
                  }));
                  return;
                }
                let parsed: unknown = {};
                try {
                  parsed = sbody.trim() === "" ? {} : JSON.parse(sbody);
                } catch {
                  res.writeHead(400, { "content-type": "application/json" });
                  res.end(JSON.stringify({ ok: false, code: "bad_json", message: "request body is not valid json", retryable: false }));
                  return;
                }
                const names = parseReprobeNames((parsed as { names?: unknown }).names);
                if (!names.ok) {
                  res.writeHead(400, { "content-type": "application/json" });
                  res.end(JSON.stringify({ ok: false, code: "reprobe_names_invalid", message: names.message, retryable: false }));
                  return;
                }
                const clis = await trackRuntimeJob((signal) => reprobeCliCapabilities(names.names, { signal }));
                res.writeHead(200, { "content-type": "application/json" });
                res.end(JSON.stringify({ ok: true, clis }));
                return;
              }
              if (pathname === "/api/setup/cli-capability/confirm") {
                if (runtimeDraining) {
                  res.writeHead(503, { "content-type": "application/json" });
                  res.end(JSON.stringify({
                    ok: false,
                    code: "daemon_draining",
                    message: "daemon 正在退出,不能发起 CLI 确认一发",
                    retryable: true
                  }));
                  return;
                }
                const parsed = JSON.parse(sbody || "{}") as { name?: unknown };
                const name = typeof parsed.name === "string" ? parsed.name : "";
                const out = await trackRuntimeJob((signal) => confirmCliCapability({ name, signal, audit }));
                res.writeHead(out.ok || out.auth === "not_logged_in" || out.auth === "unknown" ? 200 : 400, {
                  "content-type": "application/json"
                });
                res.end(JSON.stringify(out));
                return;
              }
              // POST /api/setup/restart — v4 三协议
              if (pathname === "/api/setup/restart") {
                if (runtimeDraining || setupRestartRequested || lifecycleIntent) {
                  res.writeHead(503, { "content-type": "application/json" });
                  res.end(JSON.stringify({
                    ok: false,
                    code: "daemon_draining",
                    message: "daemon 已在退出或重启",
                    retryable: true
                  }));
                  return;
                }
                const pendingActivation = loadPendingCliRuntimeRegistry(SAYDO_HOME).activation;
                const cliGate = pendingCliSelfTestGate(
                  SAYDO_HOME,
                  loadCliRuntimeReceiptIndex(db, "pending", pendingActivation)
                );
                if (!cliGate.ok) {
                  res.writeHead(409, { "content-type": "application/json" });
                  res.end(
                    JSON.stringify({
                      ok: false,
                      code: "cli_self_test_required",
                      message: `CLI 槽尚未通过真实 self-test:${cliGate.missingSlots.join(",")}`,
                      retryable: true
                    })
                  );
                  return;
                }
                setupRestartRequested = true;
                const generation = randomInt(1, 2_147_483_647);
                if (!claimLifecycleIntent({ kind: "restart", generation })) {
                  setupRestartRequested = false;
                  res.writeHead(503, { "content-type": "application/json" });
                  res.end(JSON.stringify({
                    ok: false,
                    code: "daemon_draining",
                    message: "daemon lifecycle intent 已被占用",
                    retryable: true
                  }));
                  return;
                }
                lastRestartGeneration = generation;
                // a) 广播 restart_pending → 等 ACK 有界 3s
                let acked: boolean;
                try {
                  ({ acked } = await voiceHub.requestPipelineRestart(generation, 3000));
                } catch (err) {
                  setupRestartRequested = false;
                  throw err;
                }
                if (!acked) {
                  audit.record({
                    actor: "daemon",
                    action: "setup.restart_pipeline_no_ack",
                    meta: { generation }
                  });
                } else {
                  audit.record({
                    actor: "daemon",
                    action: "setup.restart_pipeline_acked",
                    meta: { generation }
                  });
                }
                // 先回响应,再 drain/关 listener/spawn/exit
                res.writeHead(200, { "content-type": "application/json" });
                res.end(JSON.stringify({ ok: true, restarting: true, generation, pipelineAcked: acked }));
                // 下一 tick 执行关停,确保响应 flush
                setImmediate(() => {
                  void performSelfRestart(generation);
                });
                return;
              }
            } catch (err) {
              res.writeHead(500, { "content-type": "application/json" });
              res.end(
                JSON.stringify({
                  ok: false,
                  code: "setup_error",
                  message: String(err instanceof Error ? err.message : err).slice(0, 200),
                  retryable: true
                })
              );
            }
          })();
        });
        return;
      }
      if (RECOVERY_ONLY) {
        res.writeHead(503, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            ok: false,
            code: "recovery_only",
            message: "活动模型配置不合法,当前仅开放读取与配置自救;对话和 dispatch 已停用",
            retryable: false
          })
        );
        return;
      }
      const mApproval = /^\/api\/approvals\/([^/]+)\/decide$/.exec(pathname);
      if (mApproval) {
        let abody = "";
        req.on("data", (c: Buffer) => {
          if (abody.length < 65_536) abody += c.toString();
        });
        req.on("end", () => {
          try {
            const parsed = JSON.parse(abody || "{}") as { decision?: string; editedCommand?: string };
            // W4 3.1(09 §3.3 红线):S3 收据只能由 verifyS3Assertion 产生——通用 decide 端点对
            // risk='S3' 行一律拒(不可复用弱面签强收据;audit 留痕)
            const targetReceipt = getApproval(db, mApproval[1] as string);
            if (targetReceipt?.riskLevel === "S3") {
              audit.record({
                actor: "daemon",
                action: "s3.generic_decide_rejected",
                meta: { receiptId: mApproval[1], attempted: parsed.decision ?? "" }
              });
              res.writeHead(403, { "content-type": "application/json" });
              res.end(
                JSON.stringify({
                  ok: false,
                  code: "s3_requires_webauthn",
                  message: "S3 收据不走通用审批口——只能经 S3 卡本机认证断言链(verifyS3Assertion)产生与消费。",
                  retryable: false
                })
              );
              return;
            }
            // W5a 3.3:第四动作 edit(修改后批准;09 §3 仅屏幕、仅 S2——approvalFlow 内双重断言)
            if (parsed.decision === "edit") {
              // RA-closeout(Codex 21 B4 尾项 2026-07-28):edit 给了改命令权,仅本机受信终端——tailnet 拒 + 引导回桌面
              if (idvVia === "tailnet") {
                res.writeHead(403, { "content-type": "application/json" });
                res.end(JSON.stringify({ ok: false, code: "tailnet_edit_forbidden", message: "修改后批准只能在桌面受信终端操作,请回桌面完成", retryable: false }));
                return;
              }
              if (typeof parsed.editedCommand !== "string" || !parsed.editedCommand.trim()) {
                res.writeHead(400, { "content-type": "application/json" });
                res.end(JSON.stringify({ ok: false, code: "invalid_input", message: "edit 需要 editedCommand", retryable: false }));
                return;
              }
              const r = runtimeApprovals.edit(mApproval[1] as string, parsed.editedCommand, { via: "screen" });
              res.writeHead(r.ok ? 200 : 409, { "content-type": "application/json" });
              res.end(
                JSON.stringify(
                  r.ok
                    ? { ok: true, decision: "edit", newReceiptId: r.newReceiptId }
                    : { ok: false, code: "edit_failed", message: r.reason, retryable: false }
                )
              );
              return;
            }
            if (parsed.decision !== "accept" && parsed.decision !== "reject") {
              res.writeHead(400, { "content-type": "application/json" });
              res.end(JSON.stringify({ ok: false, code: "invalid_input", message: "decision 只接受 accept/reject/edit", retryable: false }));
              return;
            }
            // RA-closeout(09 §3 对表行 2026-07-28):tailnet 配对屏幕批 S2 如实落 push/paired_device_pin(不再固定 screen)
            const r = runtimeApprovals.decide(mApproval[1] as string, parsed.decision, { via: idvVia === "tailnet" ? "tailnet" : "screen" });
            res.writeHead(r.ok ? 200 : 409, { "content-type": "application/json" });
            res.end(JSON.stringify(r.ok ? { ok: true, decision: parsed.decision } : { ok: false, code: "decide_failed", message: r.reason ?? "收据已终局", retryable: false }));
          } catch (err) {
            res.writeHead(400, { "content-type": "application/json" });
            res.end(JSON.stringify({ ok: false, code: "bad_json", message: String(err).slice(0, 160), retryable: false }));
          }
        });
        return;
      }
      // W2 阶段 C:候选批准/拒绝(记忆生长闭环的人批环节;S2 面,tailnet 可批)
      const mMemAct = /^\/api\/memory\/([^/]+)\/(approve|reject)$/.exec(pathname);
      if (mMemAct) {
        req.on("data", () => void 0);
        req.on("end", () => {
          try {
            const candidateId = mMemAct[1] as string;
            const deps = { ledger: memoryLedger, audit };
            const ev = mMemAct[2] === "approve" ? approveCandidate(deps, candidateId) : rejectCandidate(deps, candidateId);
            // 批准后刷新 M1 人可读投影(账本 -> <workspace>/.saydo/knowledge/m1-notes.md)
            if (mMemAct[2] === "approve" && ev.op === "add" && ev.projectId) {
              const workspace = verifiedProjectWorkspace(db, ev.projectId);
              if (workspace) projectM1Notes(memoryLedger, ev.projectId, workspace);
            }
            res.writeHead(200, { "content-type": "application/json" });
            res.end(JSON.stringify({ ok: true, action: mMemAct[2], eventId: ev.id }));
          } catch (err) {
            res.writeHead(409, { "content-type": "application/json" });
            res.end(JSON.stringify({ ok: false, code: "memory_action_failed", message: String(err instanceof Error ? err.message : err).slice(0, 200), retryable: false }));
          }
        });
        return;
      }
      // W5a 3.5:项目级模型/预算覆盖写口(daemon 受控表;仅受信终端——覆盖改的是钱面/模型面,
      // 与奠基同级保守;09 §11 白名单禁 project.toml 承载,本表是唯一合法写点)
      const mOverrides = /^\/api\/projects\/([^/]+)\/settings\/overrides$/.exec(pathname);
      if (mOverrides) {
        let obody = "";
        req.on("data", (c: Buffer) => {
          if (obody.length < 65_536) obody += c.toString();
        });
        req.on("end", () => {
          if (idvVia === "tailnet") {
            res.writeHead(403, { "content-type": "application/json" });
            res.end(JSON.stringify({ ok: false, code: "overrides_require_trusted_terminal", message: "模型/预算覆盖只在受信终端改——回到桌面完成。", retryable: false }));
            return;
          }
          try {
            const projectId = mOverrides[1] as string;
            const exists = db.prepare("SELECT id FROM projects WHERE id=?").get(projectId);
            if (!exists) {
              res.writeHead(404, { "content-type": "application/json" });
              res.end(JSON.stringify({ ok: false, code: "project_not_found", message: `项目不存在:${projectId}`, retryable: false }));
              return;
            }
            const cfg = loadConfigFile(join(SAYDO_HOME, "config.toml"));
            const v = validateProjectOverrides(cfg as never, JSON.parse(obody || "{}"));
            if (!v.ok) {
              res.writeHead(422, { "content-type": "application/json" });
              res.end(JSON.stringify({ ok: false, code: "overrides_rejected", message: v.violations.map((x) => x.message).join(";"), violations: v.violations, retryable: false }));
              return;
            }
            upsertProjectOverrides(db, projectId, v.overrides, new Date().toISOString());
            projectDialogCache.delete(projectId); // 覆盖变更即缓存失效
            audit.record({ actor: "owner", action: "config.project_overrides_saved", meta: { projectId } });
            res.writeHead(200, { "content-type": "application/json" });
            res.end(JSON.stringify({ ok: true, overrides: v.overrides }));
          } catch (err) {
            res.writeHead(400, { "content-type": "application/json" });
            res.end(JSON.stringify({ ok: false, code: "bad_overrides", message: String(err).slice(0, 200), retryable: false }));
          }
        });
        return;
      }
      // W2 阶段 C:项目奠基(首次/重奠基;写仓库文件 => 仅受信终端,tailnet 拒)
      const mFound = /^\/api\/projects\/([^/]+)\/foundation\/bootstrap$/.exec(pathname);
      if (mFound) {
        req.on("data", () => void 0);
        req.on("end", () => {
          if (idvVia === "tailnet") {
            res.writeHead(403, { "content-type": "application/json" });
            res.end(JSON.stringify({ ok: false, code: "foundation_requires_trusted_terminal", message: "奠基会写仓库文件,手机上不放行——回到桌面执行。", retryable: false }));
            return;
          }
          // 第四轮终验 B2 回修:端点兜底 try/catch(daemon 无 uncaughtException 兜底,
          // 裸抛会崩常驻进程打断在场语音会话;与 memory approve 端点同款)
          try {
            const r = bootstrapProjectFoundation(
              { db, ledger: memoryLedger, audit, budgets: foundationBudgets() },
              mFound[1] as string
            );
            res.writeHead(r.ok ? 200 : r.code === "not_found" ? 404 : 409, { "content-type": "application/json" });
            res.end(JSON.stringify(r));
          } catch (err) {
            res.writeHead(409, { "content-type": "application/json" });
            res.end(JSON.stringify({ ok: false, code: "bootstrap_failed", message: String(err instanceof Error ? err.message : err).slice(0, 200), retryable: true }));
          }
        });
        return;
      }
      // W1.5 手工字段写口(05 §4 dogfood 登记表两字段:自报分钟 + 自发选择率;G1 token 门内)
      if (pathname === "/api/value-report/manual") {
        let mbody = "";
        req.on("data", (c: Buffer) => {
          if (mbody.length < 65_536) mbody += c.toString();
        });
        req.on("end", () => {
          try {
            const parsed = JSON.parse(mbody || "{}") as Record<string, unknown>;
            const entry = appendManualEntry(
              SAYDO_HOME,
              {
                day: String(parsed["day"] ?? ""),
                ...(typeof parsed["minutesSelfReported"] === "number" ? { minutesSelfReported: parsed["minutesSelfReported"] } : {}),
                ...(typeof parsed["opportunitiesSeen"] === "number" ? { opportunitiesSeen: parsed["opportunitiesSeen"] } : {}),
                ...(typeof parsed["opportunitiesUsed"] === "number" ? { opportunitiesUsed: parsed["opportunitiesUsed"] } : {}),
                ...(typeof parsed["note"] === "string" ? { note: parsed["note"] } : {})
              },
              new Date().toISOString()
            );
            res.writeHead(200, { "content-type": "application/json" });
            res.end(JSON.stringify({ ok: true, entry }));
          } catch (err) {
            res.writeHead(400, { "content-type": "application/json" });
            res.end(JSON.stringify({ ok: false, code: "invalid_input", message: String(err).slice(0, 160), retryable: false }));
          }
        });
        return;
      }
      // W5a 3.2:屏幕触发的结果讲解/决策提炼(与语音 explainResult 同一实现与落库——口播/上屏一致)
      const mExplain = /^\/api\/tasks\/([^/]+)\/explain$/.exec(pathname);
      if (mExplain) {
        let ebody = "";
        req.on("data", (c: Buffer) => {
          if (ebody.length < 65_536) ebody += c.toString();
        });
        req.on("end", () => {
          void trackRuntimeJob(async (signal): Promise<void> => {
            try {
              const parsed = JSON.parse(ebody || "{}") as { level?: string };
              const r = await explainResult(
                { db, audit, drafter: resolveDrafterProvider(), runsDir: join(SAYDO_HOME, "tier1", "runs"), signal },
                { taskId: mExplain[1], level: parsed.level ?? "decisions" }
              );
              const failed = typeof r === "object" && r !== null && "ok" in r && r.ok === false;
              res.writeHead(failed ? 409 : 200, { "content-type": "application/json" });
              res.end(JSON.stringify(r));
            } catch (err) {
              res.writeHead(500, { "content-type": "application/json" });
              res.end(JSON.stringify({ ok: false, code: "explain_error", message: String(err).slice(0, 200), retryable: true }));
            }
          }).catch((err) => {
            if (!res.headersSent) res.writeHead(503, { "content-type": "application/json" });
            if (!res.writableEnded) res.end(JSON.stringify({ ok: false, code: "runtime_draining", message: String(err).slice(0, 160) }));
          });
        });
        return;
      }
      const mOutboxAck = /^\/api\/outbox\/([^/]+)\/ack$/.exec(pathname);
      if (mOutboxAck) {
        let obody = "";
        req.on("data", (c: Buffer) => {
          if (obody.length < 4096) obody += c.toString();
        });
        req.on("end", () => {
          const out = handleOutboxAck(
            callbackEngine,
            db,
            decodeURIComponent(mOutboxAck[1] as string),
            idvVia
          );
          res.writeHead(out.status, { "content-type": "application/json" });
          res.end(JSON.stringify(out.payload));
        });
        return;
      }
      // 批 1/2:空间 / 产物 / 会话任务上下文 / Focus 新建·归档·重开 写口(须在 mAction 兜底前)
      const mSpaceRename = /^\/api\/spaces\/([^/]+)\/rename$/.exec(pathname);
      const mSpaceDelete = /^\/api\/spaces\/([^/]+)\/delete$/.exec(pathname);
      const mFocusSpace = /^\/api\/focuses\/([^/]+)\/space$/.exec(pathname);
      const mFocusArt = /^\/api\/focuses\/([^/]+)\/artifacts$/.exec(pathname);
      const mFocusArchive = /^\/api\/focuses\/([^/]+)\/archive$/.exec(pathname);
      const mFocusReopen = /^\/api\/focuses\/([^/]+)\/reopen$/.exec(pathname);
      const mTaskCtx = /^\/api\/session\/([^/]+)\/task-context$/.exec(pathname);
      const mLaneRetire = /^\/api\/focuses\/([^/]+)\/lanes\/([^/]+)\/retire$/.exec(pathname);
      const mLaneRedo = /^\/api\/focuses\/([^/]+)\/lanes\/([^/]+)\/redo-from$/.exec(pathname);
      const mObResolve = /^\/api\/obligations\/([^/]+)\/resolve$/.exec(pathname);
      const mObWaiting = /^\/api\/obligations\/([^/]+)\/waiting-on$/.exec(pathname);
      const mArtRealize = /^\/api\/artifacts\/([^/]+)\/realize$/.exec(pathname);
      const mExpAdjust = /^\/api\/focuses\/([^/]+)\/expectations\/([^/]+)\/adjust$/.exec(pathname);
      const mExpWithdraw = /^\/api\/focuses\/([^/]+)\/expectations\/([^/]+)\/withdraw$/.exec(pathname);
      const mSessAnchor = /^\/api\/sessions\/([^/]+)\/focus-anchor$/.exec(pathname);
      // attention item id 含 conf:/ob:/task: 前缀与冒号,path 段经 encodeURIComponent
      const mAttentionAck = /^\/api\/attention\/([^/]+)\/ack$/.exec(pathname);
      if (
        mSessAnchor ||
        pathname === "/api/spaces" ||
        pathname === "/api/focuses" ||
        mSpaceRename ||
        mSpaceDelete ||
        mFocusSpace ||
        mFocusArt ||
        mFocusArchive ||
        mFocusReopen ||
        mTaskCtx ||
        mLaneRetire ||
        mLaneRedo ||
        mObResolve ||
        mObWaiting ||
        mArtRealize ||
        mExpAdjust ||
        mExpWithdraw ||
        mAttentionAck
      ) {
        let sbody = "";
        req.on("data", (c: Buffer) => {
          if (sbody.length < 65_536) sbody += c.toString();
        });
        req.on("end", () => {
          let parsed: unknown = {};
          try {
            parsed = sbody.trim() === "" ? {} : (JSON.parse(sbody) as unknown);
          } catch {
            res.writeHead(400, { "content-type": "application/json" });
            res.end(JSON.stringify({ ok: false, code: "bad_json", message: "request body is not valid json", retryable: false }));
            return;
          }
          const nowIso = new Date().toISOString();
          let out: { status: number; payload: unknown };
          try {
            if (mSessAnchor) {
              // L6/L5:续推锚定——console「开新对话续推/在此线续推」的真实锚定链
              // (此前按钮只跳对话页不锚定=假按钮;义骁 8/6 提议 lane 级续推)
              const sid = mSessAnchor[1] as string;
              const pb = (parsed ?? {}) as { focusId?: string; laneTitle?: string };
              if (!pb.focusId) {
                out = { status: 400, payload: { ok: false, code: "invalid_input", message: "focusId required", retryable: false } };
              } else {
                liveSessions.ensureSession(sid);
                const sw = switchAnchorActivation(db, sid, pb.focusId, "user_explicit");
                liveSessions.setDefaultLane(sid, pb.laneTitle?.trim() ? pb.laneTitle.trim() : null);
                audit.record({
                  actor: "owner",
                  action: "session.focus_anchor_via_api",
                  meta: { sessionId: sid, focusId: pb.focusId, ...(pb.laneTitle ? { laneTitle: pb.laneTitle } : {}) }
                });
                out = { status: 200, payload: { ok: true, sessionId: sid, focusId: pb.focusId, already: sw.already } };
              }
            } else if (pathname === "/api/spaces") {
              out = createSpace(db, audit, parsed, nowIso);
            } else if (pathname === "/api/focuses") {
              out = createFocusApi(db, audit, parsed, nowIso);
            } else if (mFocusArchive) {
              out = archiveFocusApi(db, audit, mFocusArchive[1] as string, parsed);
            } else if (mFocusReopen) {
              out = reopenFocusApi(db, audit, mFocusReopen[1] as string);
            } else if (mSpaceRename) {
              out = renameSpace(db, audit, mSpaceRename[1] as string, parsed, nowIso);
            } else if (mSpaceDelete) {
              out = deleteSpace(db, audit, mSpaceDelete[1] as string, nowIso);
            } else if (mFocusSpace) {
              out = assignFocusSpace(db, audit, mFocusSpace[1] as string, parsed, nowIso);
            } else if (mFocusArt) {
              out = createFocusArtifact(db, audit, mFocusArt[1] as string, parsed, nowIso);
            } else if (mLaneRetire) {
              out = retireLaneApi(db, audit, mLaneRetire[1] as string, mLaneRetire[2] as string);
            } else if (mLaneRedo) {
              out = redoFromLaneApi(db, audit, mLaneRedo[1] as string, mLaneRedo[2] as string, parsed);
            } else if (mObResolve) {
              out = resolveObligationApi(db, audit, mObResolve[1] as string, parsed);
            } else if (mObWaiting) {
              out = setWaitingOnApi(db, audit, mObWaiting[1] as string, parsed);
            } else if (mArtRealize) {
              out = realizeArtifactApi(db, audit, mArtRealize[1] as string, parsed);
            } else if (mExpAdjust) {
              out = adjustExpectationApi(
                db,
                audit,
                mExpAdjust[1] as string,
                mExpAdjust[2] as string,
                parsed
              );
              // ④d:adjust 成功后触发控制轮(session talking 时 Brain 复述并发起 ack 卡)
              const pl = out.payload as {
                ok?: boolean;
                controlTurnHint?: { kind: "expectation_adjusted"; focusId: string; sessionId: string } | null;
              };
              if (out.status === 200 && pl.ok && pl.controlTurnHint) {
                liveDialogRef?.injectControlTurn(pl.controlTurnHint.sessionId, {
                  kind: "expectation_adjusted",
                  focusId: pl.controlTurnHint.focusId
                });
              }
            } else if (mExpWithdraw) {
              out = withdrawExpectationApi(
                db,
                audit,
                mExpWithdraw[1] as string,
                mExpWithdraw[2] as string,
                parsed
              );
              // 行已 superseded;若 session 仍挂同 expectation 的 ack 卡,清 pending+ledger(不二次 CAS 行)
              const wp = out.payload as {
                ok?: boolean;
                dismissHint?: { sessionId: string; expectationId: string } | null;
              };
              if (out.status === 200 && wp.ok && wp.dismissHint) {
                const sid = wp.dismissHint.sessionId;
                const eid = wp.dismissHint.expectationId;
                const row = db
                  .prepare(
                    `SELECT receipt_id, payload_json FROM pending_confirmations WHERE session_id = ?`
                  )
                  .get(sid) as { receipt_id: string; payload_json: string } | undefined;
                if (row) {
                  try {
                    const pl = JSON.parse(row.payload_json) as {
                      kind?: string;
                      expectationId?: string;
                    };
                    if (pl.kind === "expectation_ack" && pl.expectationId === eid) {
                      const nowIso = new Date().toISOString();
                      const tx = db.transaction(() => {
                        db.prepare(`DELETE FROM pending_confirmations WHERE session_id = ?`).run(sid);
                        db.prepare(
                          `UPDATE confirmation_ledger SET outcome = 'withdrawn', finalized_at = ?
                           WHERE receipt_id = ? AND outcome IS NULL`
                        ).run(nowIso, row.receipt_id);
                      });
                      tx();
                    }
                  } catch {
                    // 清卡失败不反转 withdraw 行态
                  }
                }
              }
            } else if (mAttentionAck) {
              out = ackAttentionApi(db, mAttentionAck[1] as string);
            } else if (mTaskCtx) {
              const b = (parsed ?? {}) as { refKind?: string; refId?: string; nonce?: string };
              if (b.refKind !== "obligation" && b.refKind !== "task") {
                out = { status: 400, payload: { ok: false, code: "invalid_input", message: "refKind must be obligation|task" } };
              } else if (typeof b.refId !== "string" || !b.refId) {
                out = { status: 400, payload: { ok: false, code: "invalid_input", message: "refId required" } };
              } else {
                const ctx = setSessionTaskContext(db, {
                  sessionId: mTaskCtx[1] as string,
                  refKind: b.refKind,
                  refId: b.refId,
                  ...(typeof b.nonce === "string" ? { nonce: b.nonce } : {})
                });
                out = { status: 200, payload: { ok: true, ...ctx } };
              }
            } else {
              out = { status: 404, payload: { ok: false, code: "not_found" } };
            }
          } catch (e) {
            if (e instanceof TaskContextError) {
              out = {
                status: e.code === "session_not_found" || e.code === "target_not_found" ? 404 : 400,
                payload: { ok: false, code: e.code, message: e.message }
              };
            } else {
              out = {
                status: 500,
                payload: { ok: false, code: "internal", message: String(e instanceof Error ? e.message : e).slice(0, 160) }
              };
            }
          }
          res.writeHead(out.status, { "content-type": "application/json" });
          res.end(JSON.stringify(out.payload));
        });
        return;
      }
      const mAction = /^\/api\/tasks\/([^/]+)\/([a-z-]+)$/.exec(pathname);
      if (!mAction) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, code: "not_found", message: "unknown api action", retryable: false }));
        return;
      }
      let body = "";
      let bytes = 0;
      let overflow = false;
      req.on("data", (c: Buffer) => {
        bytes += c.length; // C-2(回收批 2 复审):按网络字节计,不按 UTF-16 码元
        if (bytes > 1_048_576) {
          if (!overflow) {
            overflow = true; // C1:POST body 1MB 上限(token 门内纵深)
            res.writeHead(413, { "content-type": "application/json" });
            res.end(JSON.stringify({ ok: false, code: "payload_too_large", message: "body exceeds 1MB", retryable: false }));
            req.destroy();
          }
          return;
        }
        body += c.toString();
      });
      req.on("end", () => {
        if (overflow) return;
        let parsed: unknown = {};
        try {
          parsed = body.trim() === "" ? {} : (JSON.parse(body) as unknown);
        } catch {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, code: "bad_json", message: "request body is not valid json", retryable: false }));
          return;
        }
        const out = handleTaskAction(db, audit, mAction[1] as string, mAction[2] as string, parsed, new Date().toISOString(), {
          ...(idvVia ? { via: idvVia === "local" ? "local" : "tailnet" } : {}) // 远程来源 S3 合并链动作在 actions 层拒
        });
        res.writeHead(out.status, { "content-type": "application/json" });
        res.end(JSON.stringify(out.payload));
      });
      return;
    }
    // DELETE session task-context(G1 门内)
    if (req.method === "DELETE") {
      const mTaskCtxDel = /^\/api\/session\/([^/]+)\/task-context$/.exec(pathname);
      if (mTaskCtxDel) {
        let body = "";
        req.on("data", (c: Buffer) => {
          if (body.length < 4096) body += c.toString();
        });
        req.on("end", () => {
          let nonce: string | undefined;
          try {
            if (body.trim()) {
              const p = JSON.parse(body) as { nonce?: string };
              if (typeof p.nonce === "string") nonce = p.nonce;
            }
          } catch {
            res.writeHead(400, { "content-type": "application/json" });
            res.end(JSON.stringify({ ok: false, code: "bad_json" }));
            return;
          }
          const ok = clearSessionTaskContext(db, mTaskCtxDel[1] as string, nonce);
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok, cleared: ok }));
        });
        return;
      }
    }
    res.writeHead(405, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, code: "method_not_allowed", message: "unsupported method", retryable: false }));
    return;
  }
  // 控制台静态服务(同源保 G1;packages/console/dist 构建产物)
  if (req.method === "GET" && !((req.url ?? "").startsWith("/ws/"))) {
    // W4 3.1(09 §3.3 部署约束):S3 面须经 http://localhost:<port> 访问——rpId=localhost 与
    // http://127.0.0.1 origin 不匹配会致 credentials.get SecurityError;daemon 对 127.0.0.1 的
    // console 页面/资产 GET 归一 308 重定向到 localhost(API/WS 不经此,fetch 面由 s3Guard 把守)。
    const rawHost = req.headers["host"];
    const hostHeader = (Array.isArray(rawHost) ? rawHost[0] : rawHost)?.toLowerCase();
    if (hostHeader === `127.0.0.1:${PORT}`) {
      res.writeHead(308, { location: `http://localhost:${PORT}${req.url ?? "/"}` });
      res.end();
      return;
    }
    if (serveConsoleStatic(req.url ?? "/", res)) return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: false, code: "not_found", message: "unknown route", retryable: false }));
});

/** 500 人话:去掉本机绝对路径(S1 评审 1 B7) */
function publicApiErrorMessage(err: unknown): string {
  const raw = (err instanceof Error ? err.message : String(err)).slice(0, 200);
  return raw.replace(/\/(?:Users|home|private|var\/folders|tmp|opt)[^\s"']*/g, "[path]");
}

/** 控制台 API 路由(只读投影;/api/* 已过身份门) */
function routeConsoleApi(u: URL, via?: "local" | "tailnet" | "mobile_lan"): unknown {
  const p = u.pathname;
  if (p === "/api/overview") return getOverview(db);
  if (p === "/api/approvals") {
    // W5a 3.3:pending runtime_effect 行附命令原文(edit 编辑底稿;仅内存 pending 有——
    // 重启后 gate 等待已不存在,edit 面自然消失,不落库不进审计原文)
    return getApprovals(db, u.searchParams.get("project") ?? undefined).map((row) => {
      if (row["kind"] === "runtime_effect" && row["outcome"] === "pending") {
        const cmd = runtimeApprovals.pendingCommand(String(row["id"]));
        return cmd !== null ? { ...row, pending_command: cmd } : row;
      }
      return row;
    });
  }
  if (p === "/api/outbox") return getOutbox(db);
  if (p === "/api/costs") return getCosts(db);
  const mTasks = /^\/api\/projects\/([^/]+)\/tasks$/.exec(p);
  if (mTasks) return getProjectTasks(db, mTasks[1] as string);
  const mMem = /^\/api\/projects\/([^/]+)\/memory$/.exec(p);
  if (mMem) return getProjectMemory(db, audit, mMem[1] as string);
  const mArt = /^\/api\/projects\/([^/]+)\/artifacts$/.exec(p);
  if (mArt) return getProjectArtifacts(db, mArt[1] as string);
  // W5a 3.6:产物控制面(diff + 子集导出;时间线由前端按 id 分组渲染)
  const mArtDiff = /^\/api\/artifacts\/([^/]+)\/diff$/.exec(p);
  if (mArtDiff) {
    const from = Number(u.searchParams.get("from"));
    const to = Number(u.searchParams.get("to"));
    if (!Number.isInteger(from) || !Number.isInteger(to) || from <= 0 || to <= 0) {
      throw new Error("diff 需要 from/to 正整数版本号");
    }
    return getArtifactDiff(db, artifactStore, mArtDiff[1] as string, from, to);
  }
  const mArtExport = /^\/api\/projects\/([^/]+)\/artifacts\/export$/.exec(p);
  if (mArtExport) {
    const items = (u.searchParams.get("items") ?? "")
      .split(",")
      .filter(Boolean)
      .map((s) => {
        const [id, v] = s.split(":");
        return { id: id ?? "", version: Number(v) };
      });
    return exportArtifacts(db, artifactStore, mArtExport[1] as string, items, new Date().toISOString());
  }
  const mSet = /^\/api\/projects\/([^/]+)\/settings$/.exec(p);
  if (mSet) return getProjectSettings(db, mSet[1] as string);
  const mTask = /^\/api\/tasks\/([^/]+)$/.exec(p);
  if (mTask) return getTaskDetail(db, mTask[1] as string);
  // C7 Focus 只读页 + 批 2 attention
  if (p === "/api/focuses") return getFocusList(db);
  if (p === "/api/attention") return getAttention(db);
  if (p === "/api/sessions/recent-transcript") {
    return getRecentTranscript(db, parseRecentTranscriptLimit(u.searchParams.get("limit")));
  }
  if (p === "/api/memory/recent") {
    return getRecentMemory(db, audit, parseRecentMemoryLimit(u.searchParams.get("limit")));
  }
  if (p === "/api/desktop/summary") {
    let config = null;
    try {
      config = loadConfigFile(join(SAYDO_HOME, "config.toml"));
    } catch {
      // recovery-only 另有 composition root;正常面读不到配置时 DND 如实 disabled。
    }
    return getDesktopSummary(
      db,
      config,
      activeByoaInvocationCount(),
      undefined,
      tier1Executor?.recoverableCount()
    );
  }
  const mFocusSessions = /^\/api\/focuses\/([^/]+)\/sessions$/.exec(p);
  if (mFocusSessions) {
    const out = getFocusSessions(db, mFocusSessions[1] as string);
    return out ?? { error: "not_found" };
  }
  const mFocus = /^\/api\/focuses\/([^/]+)$/.exec(p);
  if (mFocus) {
    return via === "mobile_lan"
      ? getMobileFocusDetail(db, mFocus[1] as string)
      : getFocusDetail(db, mFocus[1] as string);
  }
  // 批 1:空间列表 / 产物列表
  if (p === "/api/spaces") return listSpaces(db);
  const mFocusArts = /^\/api\/focuses\/([^/]+)\/artifacts$/.exec(p);
  if (mFocusArts) {
    const out = listFocusArtifacts(db, mFocusArts[1] as string);
    return out.payload;
  }
  if (p === "/api/config") return safeConfigView();
  // 价值证据轨周报(05;场次② 起挂;建议性不作门;W1.5 手工字段承载 = ~/.saydo/value-manual.jsonl)
  if (p === "/api/value-report") return buildValueReport(db, new Date().toISOString(), 7, { saydoHome: SAYDO_HOME });
  return undefined;
}

/** 全局设置只读视图(密钥永不出;五槽位模型 + 预算 + DND) */
function safeConfigView(): unknown {
  try {
    const cfg = loadConfigFile(join(SAYDO_HOME, "config.toml"));
    const adapter = resolveTier1Adapter(cfg);
    const reset = db
      .prepare(
        `SELECT not_before FROM subscription_retry_queue
         WHERE slot='tier1' AND state='queued'
         ORDER BY not_before DESC LIMIT 1`
      )
      .get() as { not_before: string } | undefined;
    return {
      models: cfg.models ?? {},
      budget: cfg.budget ?? {},
      dnd: cfg.dnd ?? {},
      voice: cfg.voice ?? {},
      params: { ...PARAM_DEFAULTS, ...(cfg.params ?? {}) },
      gate0: cfg.gate0 ?? { enabled: true, bypass: false },
      tier1: {
        adapter,
        model: adapter === "claude_code" ? (cfg.tier1?.model ?? "opus") : (cfg.models?.dev?.model ?? null),
        pinnedVersion:
          adapter === "claude_code"
            ? (cfg.tier1?.claude_pinned_version ?? null)
            : (cfg.tier1?.cursor_agent_pinned_version ?? null),
        maxTurns: adapter === "claude_code" ? (cfg.tier1?.claude_max_turns ?? 200) : null,
        nextRateLimitResetAt: reset?.not_before ?? null
      }
    };
  } catch {
    return {
      models: {},
      budget: {},
      dnd: {},
      voice: {},
      params: PARAM_DEFAULTS,
      gate0: { enabled: true, bypass: false },
      tier1: null
    };
  }
}

/** 静态文件(console dist;路径穿越防护:resolve 后必须仍在 dist 内)。
 *  静态壳不设 token 门(资产请求不带 ?token,设门即断壳;安全边界在 /api/* 与 WS——数据全在门内);
 *  穿越判定带路径分隔符(评审 A2:裸 startsWith 会放行同级 dist-backup 类目录)。 */
function serveConsoleStatic(urlPath: string, res: ServerResponse): boolean {
  const distDir = consoleDistDirectory(DAEMON_DIR);
  if (!existsSync(distDir)) return false;
  const clean = urlPath.split("?")[0] as string;
  const rel = clean === "/" ? "index.html" : clean.replace(/^\//, "");
  const base = resolve(distDir);
  const abs = resolve(distDir, rel);
  if (abs !== base && !abs.startsWith(base + sep)) return false; // 穿越拒(带分隔符,A2)
  const file = existsSync(abs) ? abs : join(distDir, "index.html"); // SPA 回退(hash 路由下少见)
  if (!existsSync(file)) return false;
  const ext = file.slice(file.lastIndexOf("."));
  const mime: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".woff2": "font/woff2"
  };
  res.writeHead(200, { "content-type": mime[ext] ?? "application/octet-stream" });
  res.end(readFileSync(file));
  return true;
}

// M3 五段延迟收集(latency.stage 事件 -> trace + JSONL 行)
const latencyCollector = new LatencyCollector();

// ---- A3 对话环最小 live 形态(5.4 可日用):asr.final -> 对话档 LLM -> tts.say ----
// ~/.saydo/.env 读取(密钥不进配置文件;只读进本进程解析器,不回写 process.env)
function readSaydoEnv(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = { ...process.env };
  try {
    for (const line of readFileSync(join(SAYDO_HOME, ".env"), "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const [k, ...rest] = t.split("=");
      // 剥行内注释(空白 + #)与引号;密钥值不含空白,凡空白后内容视为注释
      const v = rest.join("=").split(/\s+#/)[0]?.trim().split(/\s+/)[0]?.replace(/^"|"$/g, "") ?? "";
      if (k && v && out[k.trim()] === undefined) out[k.trim()] = v;
    }
  } catch {
    // 无 .env:provider 解析时按缺 key 处方化报错
  }
  return out;
}

function resolveDialogProvider(): LlmProvider | null {
  if (RECOVERY_ONLY) return null;
  try {
    const cfg = loadConfigFile(join(SAYDO_HOME, "config.toml"));
    return resolveDialogSlot(cfg, readSaydoEnv(), log, audit, cliResolverContext()).provider;
  } catch (err) {
    log.warn("dialog provider unresolved (voice replies degraded)", { error: String(err).slice(0, 160) });
    return null;
  }
}
let dialogProvider = resolveDialogProvider();

// ---- 接线批(HANDOFF §2-9-①):SessionManager live 构造(cfg.privacy.store_transcript,G6 验收锚)
//      + LiveVoiceSessions(开口即建/转写落盘/unheard 过滤/空闲挂起)+ LiveDialog 装配 ----
// recovery-only 下配置不可读也必须保 HTTP 自救面；隐私取收紧值，且不启对话/dispatch。
const liveCfg = RECOVERY_ONLY
  ? { storeTranscript: false, idleSuspendSec: PARAM_DEFAULTS.session_idle_suspend_sec }
  : readStartupLiveConfig(join(SAYDO_HOME, "config.toml"));
const sessionManager = new SessionManager({ db, audit, storeTranscript: liveCfg.storeTranscript });
function loadFocusTranscriptLines(sessionId: string): { lines: TranscriptLine[]; storeTranscript: boolean } {
  const storeTranscript = liveCfg.storeTranscript;
  if (!storeTranscript) return { lines: [], storeTranscript: false };
  // F15(E2 eval):孤儿转写防御——库中无该 session 行(如库重建后文件残留)不读文件
  const sessRow = db.prepare("SELECT id FROM sessions WHERE id = ?").get(sessionId);
  if (!sessRow) return { lines: [], storeTranscript: false };
  try {
    const turns = sessionManager.readTurns(sessionId);
    const lines: TranscriptLine[] = turns.map((t) => ({
      turnId: t.turnId,
      speaker: t.speaker === "ai" ? "agent" : t.speaker === "user" ? "user" : "system",
      text: t.text,
      heard: t.sentences?.some((s) => s.heard) ?? true
    }));
    return { lines, storeTranscript: true };
  } catch {
    return { lines: [], storeTranscript: false };
  }
}

const liveSessions = new LiveVoiceSessions({
  db,
  audit,
  sessions: sessionManager,
  saydoHome: SAYDO_HOME,
  idleSuspendSec: liveCfg.idleSuspendSec,
  onProjectChanged: (event) => voiceHub.sendSessionProject(event),
  // C1:stage≥1 收场门——committed 返回 true(勿再直转);其余 false 后由 suspend 直转
  beforeSuspend: (sessionId, reason) => {
    const stage = getFocusStage(loadConfigFile(join(SAYDO_HOME, "config.toml")));
    if (stage === 0) return false;
    // K2 幽灵会话静默:idle 收场且已有更新的 talking 会话(用户已移步/页面已刷新)——
    // 账照落(诚实),口播全免(不往用户正聊着的会话里飘"我先退下了/留到下次")
    const ghost = reason === "idle" && isSupersededSession(sessionId);
    const gateDeps: SessionCloseGateDeps = {
      db,
      audit,
      stage,
      loadTranscript: loadFocusTranscriptLines,
      presentChecklist: (sid, text) => {
        if (ghost) return;
        voiceHub.sendTtsSay({
          t: "tts.say",
          sessionId: sid,
          sentenceId: `s-focus-close-${Date.now()}`,
          text: text.slice(0, 400),
          interruptible: true
        });
      },
      // 批 4:收尾 committed 后推 console 实体卡(voiceHub 晚绑定,回调运行时已就绪)
      emitFocusEntity: (sid, entity) => {
        try {
          voiceHub.sendConsoleEvent({ t: "focus.entity", sessionId: sid, entity });
        } catch (err) {
          log.warn("focus.entity emit failed", { sessionId: sid, error: String(err).slice(0, 120) });
        }
      }
    };
    const result = requestSuspend(gateDeps, sessionId, { idleTimeout: reason === "idle" });
    if (result.kind === "committed") return true;
    // presented/no_active/bypass/error → 调用方仍可 suspend session
    return false;
  },
  // 挂起收尾语(10 §3-4:必含状态);活跃任务在跑时如实告知回叫点
  onSuspend: (sessionId, reason) => {
    liveDialogRef?.retireSession(sessionId);
    // W2 阶段 C:会后提炼(04 §1.3 生长闭环)——从本会话用户轮机械提名候选,只提名、人批准
    // (console 记忆页批准 -> trusted -> M1;memoryLedger 声明在后,回调运行时已初始化)
    try {
      const srow = db.prepare("SELECT project_id FROM sessions WHERE id=?").get(sessionId) as
        | { project_id: string }
        | undefined;
      if (srow) {
        const userTurns = liveSessions.historyOf(sessionId).filter((t) => t.speaker === "user").map((t) => t.text);
        nominateFromSession({ ledger: memoryLedger, audit }, { sessionId, projectId: srow.project_id, userTurns });
      }
    } catch (err) {
      log.warn("session nominate failed (non-blocking)", { sessionId, error: String(err).slice(0, 160) });
    }
    // K2 幽灵会话静默:idle 收场且用户已在更新的会话里——不播"我先退下了"
    if (reason === "idle" && isSupersededSession(sessionId)) return;
    const active = (
      db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE status IN ('queued','running','confirmed')").get() as { c: number }
    ).c;
    voiceHub.sendTtsSay({
      t: "tts.say",
      sessionId,
      sentenceId: `s-suspend-${Date.now()}`,
      text: active > 0 ? "我先退下了,活儿还在跑,到验收点我叫你。" : "我先退下了,叫我随时说话。",
      interruptible: true
    });
  }
});

// K2:幽灵会话判定——存在比它更新的 talking 会话 = 用户已移步(刷新/新开页面),旧会话按幽灵静默收场
function isSupersededSession(sessionId: string): boolean {
  try {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS c FROM sessions s
          WHERE s.state = 'talking' AND s.id != ?
            AND s.started_at > (SELECT started_at FROM sessions WHERE id = ?)`
      )
      .get(sessionId, sessionId) as { c: number };
    return row.c > 0;
  } catch {
    return false;
  }
}

// ---- 接线批(HANDOFF §2-9-②/③):live 工具调用环 + 确认词表环 + Context Pack + 热词偏置 ----
const say = (
  sessionId: string,
  sentenceId: string,
  text: string,
  nativeContext?: { turnId: string; origin: NativeReplyOrigin }
): boolean => {
  const message = { t: "tts.say", sessionId, sentenceId, text, interruptible: true } as const;
  return voiceHub.sendTtsSay(
    message,
    [],
    nativeContext?.origin ?? "system",
    nativeContext?.turnId
  ) || voiceHub.sendConsoleSay(message);
};

// W5a 3.5:对话档按项目覆盖解析(02 §5.1 生效链;受控表 project_settings,写口在 POST overrides)。
// 缓存按 (projectId, binding JSON) 键——覆盖变更即失效重建;解析失败回全局(fail-safe,写口有校验)。
const projectDialogCache = new Map<string, { key: string; provider: NonNullable<ReturnType<typeof resolveApiProvider>> }>();

function recordCliInvocation(
  slot: "dialog" | "thinking" | "cheap" | "evaluator",
  invocation: SubscriptionInvocation
): void {
  recordCliSubscriptionInvocation(db, slot, invocation);
}

function cliResolverContext(): CliResolverContext {
  return {
    registry: loadCliRuntimeRegistry(SAYDO_HOME),
    receipts: loadCliRuntimeReceiptIndex(db),
    onSubscriptionInvocation: recordCliInvocation
  };
}

function dialogProviderFor(_sessionId: string, projectId: string | null): LlmProvider | null {
  if (RECOVERY_ONLY) return null;
  if (!projectId) return dialogProvider;
  try {
    const ov = getProjectOverrides(db, projectId);
    if (!ov?.models?.dialog) return dialogProvider;
    const cfg = loadConfigFile(join(SAYDO_HOME, "config.toml"));
    const eff = effectiveModelBinding(cfg as never, ov, "dialog");
    if (eff.source === "global") return dialogProvider;
    const key = JSON.stringify(eff.binding);
    const hit = projectDialogCache.get(projectId);
    if (hit && hit.key === key) return hit.provider;
    const provider = resolveApiProvider(
      eff.binding as never,
      cfg.providers?.api as never,
      readSaydoEnv(),
      "OPENAI_API_KEY",
      { slot: "dialog", audit }
    );
    projectDialogCache.set(projectId, { key, provider });
    audit.record({ actor: "daemon", action: "config.project_dialog_override_resolved", meta: { projectId } });
    return provider;
  } catch (err) {
    log.warn("project dialog override unresolved (falling back to global)", { projectId, error: String(err).slice(0, 120) });
    return dialogProvider;
  }
}

/** thinking 档:全局 CLI 经 T18a self-test 登记后生效;项目覆盖恒 API;失败回落全局 dialog。 */
const projectThinkingCache = new Map<string, { key: string; provider: NonNullable<ReturnType<typeof resolveApiProvider>> }>();
function thinkingProviderFor(sessionId: string): ReturnType<typeof resolveApiProvider> | null {
  if (RECOVERY_ONLY) return null;
  try {
    const cfg = loadConfigFile(join(SAYDO_HOME, "config.toml"));
    const row = db.prepare("SELECT project_id FROM sessions WHERE id=?").get(sessionId) as
      | { project_id: string }
      | undefined;
    const ov = row ? getProjectOverrides(db, row.project_id) : null;
    const eff = effectiveModelBinding(cfg as never, ov, "thinking");
    if (eff.source === "global") {
      return resolveThinkingSlot(
        cfg,
        readSaydoEnv(),
        dialogProvider,
        log,
        cfg.models.thinking,
        audit,
        cliResolverContext()
      ).provider;
    }
    const key = JSON.stringify(eff.binding);
    const hit = row ? projectThinkingCache.get(row.project_id) : undefined;
    if (hit && hit.key === key) return hit.provider;
    const resolved = resolveThinkingSlot(cfg, readSaydoEnv(), dialogProvider, log, eff.binding, audit);
    if (row && resolved.provider) projectThinkingCache.set(row.project_id, { key, provider: resolved.provider });
    if (row) {
      audit.record({
        actor: "daemon",
        action: "config.project_thinking_override_resolved",
        meta: { projectId: row.project_id, effective: resolved.effective }
      });
    }
    return resolved.provider;
  } catch (err) {
    log.warn("project thinking override unresolved (falling back to global dialog)", {
      sessionId,
      error: String(err).slice(0, 120)
    });
    return dialogProvider;
  }
}

/** cheap 档结构化起草(proposeStart 组包用;解析不出回落 dialog 档并显式告警) */
function resolveDrafterProvider(): ReturnType<typeof resolveApiProvider> | null {
  if (RECOVERY_ONLY) return null;
  try {
    const cfg = loadConfigFile(join(SAYDO_HOME, "config.toml"));
    return resolveDrafterSlot(cfg, readSaydoEnv(), dialogProvider, log, audit, cliResolverContext()).provider;
  } catch (err) {
    log.warn("cheap provider resolution failed; falling back to dialog", { error: String(err).slice(0, 160) });
    return dialogProvider;
  }
}

/** evaluator 档:CLI 双 ack + self-test 登记后武装;API 同族仅显式 same-family ack 后武装。 */
function resolveEvaluatorProvider(): {
  provider: ReturnType<typeof resolveApiProvider> | null;
  expectedFamily?: Family;
} {
  if (RECOVERY_ONLY) return { provider: null };
  try {
    const cfg = loadConfigFile(join(SAYDO_HOME, "config.toml"));
    const env = readSaydoEnv();
    const provider = resolveEvaluatorSlot(cfg, env, log, audit, cliResolverContext()).provider;
    const expectedFamily = evaluatorFamilyContext(cfg, env).evaluator;
    return { provider, ...(expectedFamily ? { expectedFamily } : {}) };
  } catch (err) {
    log.warn("evaluator provider unresolved (deep readiness pipeline not armed)", { error: String(err).slice(0, 160) });
    return { provider: null };
  }
}

function readGate0(): { enabled: boolean; bypass: boolean } {
  // impl-readback 回收批 2(B4):config 损坏 ⇒ enabled:false 拒 dispatch(fail-closed;缺失仍走出厂缺省)
  const g = readGate0FromFile(join(SAYDO_HOME, "config.toml"));
  if (g.failClosedReason) {
    log.warn("gate0 fail-closed", { reason: g.failClosedReason });
    audit.record({ actor: "daemon", action: "gate0.config_unreadable_fail_closed", meta: { reason: g.failClosedReason.slice(0, 160) } });
  }
  return { enabled: g.enabled, bypass: g.bypass };
}

// W5.4-b C1:生效 adapter 判定收拢到 resolveTier1Adapter 单源([models.dev].agent 唯一选择键,
// 缺省 cursor 不变);本函数保留为读盘薄包装(四处消费点零改动,行为对 cursor 恒等)。
function readDevAdapter(): Adapter {
  try {
    const cfg = loadConfigFile(join(SAYDO_HOME, "config.toml"));
    return resolveTier1Adapter(cfg);
  } catch {
    return "cursor";
  }
}

function readTaskMaxDefault(): number {
  try {
    const cfg = loadConfigFile(join(SAYDO_HOME, "config.toml"));
    const v = (cfg.budget as Record<string, unknown> | undefined)?.["task_max_default"];
    return typeof v === "number" && v > 0 ? v : 20;
  } catch {
    return 20;
  }
}

/** 类型能力门(09 §11 enabled_project_types;W4)——config 坏/缺 ⇒ fail-closed 回 ["coding"] */
function readEnabledProjectTypes(): string[] {
  try {
    return enabledProjectTypes(loadConfigFile(join(SAYDO_HOME, "config.toml")));
  } catch {
    return ["coding"];
  }
}

const memoryLedger = new MemoryLedger({ db, audit });

/** 奠基预算([params] foundation_budget_min/tokens;09 §11) */
function foundationBudgets(): { walltimeMs: number; tokens: number } {
  return {
    walltimeMs: paramValueSafe("foundation_budget_min") * 60_000,
    tokens: paramValueSafe("foundation_budget_tokens")
  };
}
const memoryFts = new MemoryFts(db);
const hotwordStore = new HotwordStore(memoryLedger);
const retrieval = new Retrieval(memoryFts, memoryLedger);
const artifactStore = new ArtifactStore({ db, saydoDir: SAYDO_HOME });
const packageFactory = new DecisionPackageFactory({ db, artifacts: artifactStore, audit, now: () => new Date() });
const brainTools = new BrainTools({
  db,
  audit,
  thinkingProviderFor,
  consoleBaseUrl: `http://127.0.0.1:${PORT}`,
  // W5a 3.2:openOnScreen what=file 编辑器深链(cursor:// 优先 vscode:// 兜底,detectEditorDarwin 缺省);
  // opener 只吃编辑器 scheme(darwin `open`),review URL 不经此
  openUrl: (url) => {
    try {
      nodeSpawn("open", [url], { stdio: "ignore", detached: true }).unref();
    } catch (err) {
      log.warn("openUrl failed", { error: String(err).slice(0, 120) });
    }
  }
});
// F25 + 批 1:确认环 DB-authoritative;digest 绑定 confirm.card
// 注意:hooks 闭包引用 voiceHub,present 仅在运行期触发(voiceHub 已创建后)
const confirmLoop = new ConfirmationLoop(
  {
    onPresent: (sessionId, pending) => {
      voiceHub.sendConsoleEvent({
        t: "confirm.card",
        sessionId,
        receiptId: pending.receiptId,
        text: pending.promptText,
        kind: (pending.payload as { kind?: string }).kind ?? "unknown",
        digest: pending.digest,
        digestVersion: pending.digestVersion
      });
    },
    onResolve: (sessionId, receiptId, outcome) => {
      voiceHub.sendConsoleEvent({ t: "confirm.resolved", sessionId, receiptId, outcome });
    }
  },
  db,
  audit
);
// §5.4:重启清 session_task_context(不依赖 voiceHub;立即执行)
if (!RECOVERY_ONLY) {
  const cleared = clearAllSessionTaskContexts(db, audit);
  if (cleared > 0) log.info("session_task_context cleared on boot", { count: cleared });
} else {
  log.warn("session task context recovery disabled in recovery-only mode");
}
// W1.4 清账(执行器批 [warn] seedTerms):奠基 warmup 的 git diff 词元进 ASR 偏置(biasTerms
// extraSeeds 预留位,07 D4/09 §10 词源句)。best-effort 增强:项目坏/非 git 静默跳过;
// 种子限量 50(M0 纠错热词全保,种子只补位——防大 diff 词元稀释偏置)。
function warmupSeedTerms(): string[] {
  const rows = db.prepare("SELECT id FROM projects WHERE status='active'").all() as { id: string }[];
  const seeds = new Set<string>();
  for (const r of rows) {
    try {
      const workspace = verifiedProjectWorkspace(db, r.id);
      if (!workspace) continue;
      for (const t of new FoundationBuilder({ workspace }).warmup().seedTerms) {
        if (seeds.size >= 50) break;
        seeds.add(t);
      }
    } catch (err) {
      log.warn("warmup seedTerms skipped", { code: err instanceof Error ? err.name : "unknown" });
    }
  }
  return [...seeds];
}
const pushHotwords = (): void => voiceHub.sendHotwords(hotwordStore.biasTerms(warmupSeedTerms()));

/** [params] 键安全读取(config 坏时回缺省;非门禁面允许降级) */
function paramValueSafe<K extends keyof typeof PARAM_DEFAULTS>(key: K): number {
  try {
    return paramValue(loadConfigFile(join(SAYDO_HOME, "config.toml")), key);
  } catch {
    return PARAM_DEFAULTS[key];
  }
}

// ---- 执行器批(任务②):执行中 S2 审批协调器(gate 上浮 -> 语音词表环/console 审批卡)----
function receiptTimeoutSec(): number {
  try {
    return paramValue(loadConfigFile(join(SAYDO_HOME, "config.toml")), "receipt_timeout_sec");
  } catch {
    return PARAM_DEFAULTS.receipt_timeout_sec;
  }
}
const runtimeApprovals = new RuntimeApprovalFlow({
  db,
  audit,
  confirm: confirmLoop,
  say: (sessionId, sentenceId, text, nativeContext) => {
    const enqueued = say(sessionId, sentenceId, text, nativeContext);
    if (enqueued) liveSessions.onAiSentences(sessionId, [{ sentenceId, text }]);
    return enqueued;
  },
  activeVoiceSession: () => {
    const row = db.prepare("SELECT id FROM sessions WHERE state='talking' ORDER BY started_at DESC LIMIT 1").get() as
      | { id: string }
      | undefined;
    return row?.id ?? null;
  },
  receiptTimeoutSec
});

// readinessSkeleton 生产恒 armed(A3-armed 2026-07-28 定稿,09 §13 covered 块;Codex 22 ②/Codex 23 A-5):
// covered = 现役 confirmed ReadinessBinding key 集(evidenceFor 现算不缓存)。composition root 层
// required——本组装即注入,无未 armed 分支(回退口径 = fail-closed 维护,无 unarmed 回退);
// 低层 gate 的 optional 仅供防御测试(Codex 23 B-6)。
const foundationGenerationOf = (projectId: string): number => {
  const workspace = verifiedProjectWorkspace(db, projectId);
  if (!workspace) return 0;
  try {
    return new FoundationBuilder({ workspace }).currentGeneration();
  } catch {
    return 0; // 读不到奠基代 ⇒ 0(与"从未奠基"同义;knowledge 绑定按 0 代记,奠基后自然失效重确认)
  }
};
// 快照器(§4.1;就绪绑定只走 user_utterance 分支,workspace 根不参与——传 SAYDO_HOME 占位)
const readinessSnapshotter = new Snapshotter({ db, saydoDir: SAYDO_HOME, workspace: SAYDO_HOME });
const readinessEvidence = (_sessionId: string, projectId: string): ReadinessEvidenceDetail =>
  evidenceFor({ db, ledger: memoryLedger, foundationGenerationOf }, projectId);
const readinessAssemble = (sessionId: string, projectId: string) => {
  const row = db.prepare("SELECT type FROM projects WHERE id=?").get(projectId) as { type: ProjectType } | undefined;
  if (!row) throw new Error("project_not_found");
  return assembleOnSessionStart({ db, audit, evidenceProvider: readinessEvidence }, { sessionId, projectId, type: row.type });
};
// 确认升格事务(confirm 环 kind=readiness accept 后;人在环 = covered 唯一升格路径)
const readinessConfirm = (input: {
  sessionId: string;
  turnId: string;
  projectId: string;
  receiptId: string;
  candidates: ReadinessCandidate[];
}): { bindingIds: string[] } =>
  confirmBindings({ db, audit, snapshotter: readinessSnapshotter, foundationGenerationOf }, input);
// 动态 instructions(§1.8/B3:类型清单三态采访段,每轮现算——promote 后自然刷新)
const readinessInstructions = (sessionId: string, projectId: string | null): string | null => {
  if (!projectId) return null;
  const row = db.prepare("SELECT type FROM projects WHERE id=?").get(projectId) as { type: ProjectType } | undefined;
  if (!row) return null;
  const checklist = READINESS_CHECKLISTS[row.type];
  if (!checklist || checklist.length === 0) return null; // general 等无清单类型:静态 instructions
  const confirmed = new Set(readinessEvidence(sessionId, projectId).covered);
  const candidate = new Set(listCandidates({ db, ledger: memoryLedger }, projectId, row.type).map((c) => c.key));
  return buildInstructions({
    type: row.type,
    items: checklist.map((d) => ({
      key: d.key,
      label: d.label,
      critical: d.critical,
      state: confirmed.has(d.key) ? ("confirmed" as const) : candidate.has(d.key) ? ("candidate" as const) : ("none" as const)
    }))
  });
};

const ensureProjectAnchorReady = (sessionId: string): boolean => {
  return ensureProjectAnchorProducts(
    {
      db,
      assembleReadiness: readinessAssemble,
      readinessEvidence,
      rebuildPack: ({ sessionId: rebuildSessionId, projectId, projectRevision }) => {
        const pack = compileLivePack(
          { db, ledger: memoryLedger, hotwords: hotwordStore, retrieval },
          {
            sessionId: rebuildSessionId,
            projectId,
            userText: "",
            rebuild: true,
            expectedProjectRevision: projectRevision
          }
        );
        return pack !== null;
      },
      warn: (message, fields) => log.warn(message, fields)
    },
    sessionId
  );
};

const toolRegistry = new ToolRegistry();
const evaluatorGovernor = new DeepReviewGovernor({
  maxPerSession: paramValueSafe("evaluator_deep_review_max_per_session"),
  cooldownMs: 60_000
});
const readinessRuntime = (): NonNullable<Parameters<typeof registerLiveTools>[1]["readiness"]> | null => {
  const evaluator = resolveEvaluatorProvider();
  if (!evaluator.provider) return null;
  return {
    evaluator: evaluator.provider,
    ...(evaluator.expectedFamily ? { expectedFamily: evaluator.expectedFamily } : {}),
    governor: evaluatorGovernor,
    dims: () => ({ dims: [], verifications: [] }),
    saydoDir: SAYDO_HOME
  };
};
registerLiveTools(toolRegistry, {
  db,
  audit,
  brainTools,
  factory: packageFactory,
  ledger: memoryLedger,
  hotwords: hotwordStore,
  sessions: liveSessions,
  confirm: confirmLoop,
  say: (sessionId, sentenceId, text, nativeContext) => {
    const enqueued = say(sessionId, sentenceId, text, nativeContext);
    if (enqueued) liveSessions.onAiSentences(sessionId, [{ sentenceId, text }]);
    return enqueued;
  },
  drafter: null,
  drafterFor: resolveDrafterProvider,
  gate0: readGate0,
  devAdapter: readDevAdapter,
  taskMaxDefault: readTaskMaxDefault,
  enabledProjectTypes: readEnabledProjectTypes,
  acceptingDispatch: () => !runtimeDraining,
  proposedTtlHours: () => paramValueSafe("proposed_ttl_hours"),
  readinessEvidence, // A3-armed:生产恒 armed(propose 硬门 + readinessRef 双 digest 绑定)
  onHotwordsChanged: pushHotwords,
  runtimeApprovals,
  runsDir: join(SAYDO_HOME, "tier1", "runs"), // W5a 3.2:explainResult 读 events/verify 产物

  // W2 迟到评审 A1 回收:语音工具环 S3 门(voiceHub 声明在后,回调运行时已初始化——onSuspend 同例)
  tailnetConsolePresent: () => voiceHub.hasTailnetConsole(),
  // S1:proposeStart 同轮上屏(via=local;闭包晚绑定 voiceHub)
  sendScreenText: (sessionId, turnId, text) =>
    voiceHub.sendScreenText({ t: "screen_text", sessionId, turnId, text }),
  hasConsolePeerForSession: (sessionId) => voiceHub.hasLocalConsolePeerForSession(sessionId),
  // W1.4 深评触发装配(09 §13 分层 + §11 规则 6 调用律):管道已接(evaluator 异族档 + governor
  // + proposeStart fail-closed 门)。dims 生产 = 恒空(P0 live 的 claim/证据构造语义 canonical
  // 留白,随 dogfood/R 轮定)——恒空 ⇒ 零触发零成本;语义落定后只需替换 dims 回调。
  readiness: null,
  readinessFor: readinessRuntime,
  // 双速直通组装:当前轮原文(判定 user-explicit)+ 倒计时经 late-binding 转发给 LiveDialog
  currentTurnText: (sid: string, _tid: string) => {
    const turns = liveSessions.historyOf(sid).filter((t) => t.speaker === "user");
    return turns.length > 0 ? turns[turns.length - 1]!.text : "";
  },
  scheduleAutoAccept: (sid: string, rid: string, ms: number) => {
    liveDialogRef?.scheduleAutoAccept(sid, rid, ms);
    // F25:倒计时进度推 console 确认卡
    voiceHub.sendConsoleEvent({ t: "confirm.countdown", sessionId: sid, receiptId: rid, ms });
  },
  // 批 4:直通写入成功后推「这次聊出来的东西」(voiceHub 晚绑定)
  emitFocusEntity: (sid, entity) => {
    try {
      voiceHub.sendConsoleEvent({ t: "focus.entity", sessionId: sid, entity });
    } catch (err) {
      log.warn("focus.entity emit failed", { sessionId: sid, error: String(err).slice(0, 120) });
    }
  },
  focusStage: () => {
    // config.toml 缺失/不可读时回退缺省 stage 0(与 dialog/evaluator provider 的降级行为同构;fresh HOME 不得崩)
    try {
      return getFocusStage(loadConfigFile(join(SAYDO_HOME, "config.toml")));
    } catch {
      return getFocusStage(null);
    }
  }
});

// eslint-disable-next-line prefer-const -- late-binding:构造参数闭包先引用,实例建成后回填
let liveDialogRef: LiveDialog | undefined;
// eslint-disable-next-line prefer-const -- late-binding:liveDialog 构造先捕获,callbackEngine 稍后回填
let callbackEngineRef: CallbackEngine | undefined;
const liveDialog: LiveDialog = new LiveDialog({
  db,
  audit,
  sessions: liveSessions,
  dialogProvider,
  dialogProviderFor, // W5a 3.5:项目覆盖生效链(对话档)
  onUserTurnBegin: (sessionId) => {
    if (!callbackEngineRef) return;
    try {
      ackL0ForSession(db, callbackEngineRef, sessionId);
    } catch (err) {
      log.warn("implicit L0 ack failed", { sessionId, error: String(err).slice(0, 120) });
    }
  },
  onUserMessageAccepted: (sessionId) => {
    try {
      firstRun.noteUserMessage(sessionId);
    } catch (err) {
      log.warn("first-run marker update failed after accepted user turn", {
        sessionId,
        error: String(err).slice(0, 160)
      });
    }
  },
  say,
  // ④e:screen_text 仅 via=local(闭包晚绑定 voiceHub,与 say 同构)
  sendScreenText: (sessionId, turnId, text) =>
    voiceHub.sendScreenText({ t: "screen_text", sessionId, turnId, text }),
  log,
  registry: toolRegistry,
  confirm: confirmLoop,
  // 批 4:派活写入在 dispatchApprovedPackage 收口发射;确认消费各 case 用 emitFocusEntity
  emitFocusEntity: (sid, entity) => {
    try {
      voiceHub.sendConsoleEvent({ t: "focus.entity", sessionId: sid, entity });
    } catch (err) {
      log.warn("focus.entity emit failed", { sessionId: sid, error: String(err).slice(0, 120) });
    }
  },
  dispatchDeps: {
    db,
    audit,
    gate0: readGate0,
    devAdapter: readDevAdapter,
    enabledProjectTypes: readEnabledProjectTypes,
    acceptingDispatch: () => !runtimeDraining,
    readinessEvidence,
    emitFocusEntity: (sid, entity) => {
      try {
        voiceHub.sendConsoleEvent({ t: "focus.entity", sessionId: sid, entity });
      } catch (err) {
        log.warn("focus.entity emit failed", { sessionId: sid, error: String(err).slice(0, 120) });
      }
    }
  },
  runtimeApprovals,
  packDeps: { db, ledger: memoryLedger, hotwords: hotwordStore, retrieval },
  projectAnchorAccept: (sessionId, candidate) =>
    acceptProjectAnchorWithFollowup(
      {
        db,
        ledger: memoryLedger,
        audit,
        deliver: (event) => deliverSessionProjectOrThrow(voiceHub, event),
        rebuild: ensureProjectAnchorReady,
        warn: (message, fields) => log.warn(message, fields)
      },
      sessionId,
      candidate
    ),
  ensureProjectAnchorReady,
  readinessAssemble,
  readinessConfirm,
  readinessInstructions,
  loadFocusTranscript: loadFocusTranscriptLines,
  // F27+接线补:Focus delta(此前从未接线)+[当前 Focus]背景段;stage 0 恒空(基线 diff 为空)
  focusInstructionExtras: (sid: string) => {
    let st: ReturnType<typeof getFocusStage>;
    try {
      st = getFocusStage(loadConfigFile(join(SAYDO_HOME, "config.toml")));
    } catch {
      st = getFocusStage(null);
    }
    if (st === 0) return "";
    return [focusBrainInstructionDelta(st), renderFocusContextSection(db, sid)].filter(Boolean).join("\n\n");
  },
  onLlmArrived: (turnId, atMs) => void latencyCollector.record(turnId, "llm_first_token", atMs),
  configuredProvider: "api:openrouter"
});
liveDialogRef = liveDialog;

// M3 时基统一(评审 B1 回修):pipeline/console/daemon 三进程单调钟原点不同,跨进程 atMs 不可减——
// 一律以 daemon 收到事件的时刻计(localhost WS 传输 <1ms,可接受);playout_start 由该轮首个
// tts.playout 到达派生(console 不需要知道 turnId;sentenceId=s-<turnId>-<i> 由对话环构造)。
const playoutSeen = new Set<string>();
function turnIdOfSentence(sentenceId: string): string | null {
  const m = /^s-(.+)-\d+$/.exec(sentenceId);
  return m ? (m[1] as string) : null;
}

// A1⇄A2 语音中枢(1.2):/ws/voice;C8 记账钩子接线;4.1 起 WS 强制身份校验(G1)
// 手动档"采完不直发"一次性 hold(RA-closeout 修复 2026-07-28,10 §3-7):stopCaptureHold 发
// done_speaking+holdForConfirm ⇒ 记 session 级 flag;下一条 asr.final 消费 flag 不进 Brain
// (转写已由 hub 广播回 console 待确认框;确认发送走 turn.text)。
// 双动作交互回修(2026-07-28,评审 A1 + 实施后 review B-1):flag 按 session **FIFO 计数**
// (Map.set 覆盖会让两面在途旗只剩一面——第二个编辑轮被误喂 Brain);轮次守恒(pipeline 每
// done_speaking 恰好一个 final,可空,且链式串行保序)是主保证,TTL 120s 是 final 真丢失
// (连接断)时防旗滞留误扣下一直发轮的兜底。
const holdForConfirmSessions = new Map<string, number[]>();
const HOLD_FLAG_TTL_MS = 120_000;
const voiceHub: VoiceHub = new VoiceHub(server, log.child({ mod: "voice" }), {
  onTtsChars: (sessionId, chars) => recordTtsChars(db, sessionId, chars),
  onTurnSignal: (msg) => {
    if (RECOVERY_ONLY) return;
    if (msg.t === "turn.done_speaking" && msg.holdForConfirm) {
      const queue = holdForConfirmSessions.get(msg.sessionId) ?? [];
      queue.push(Date.now() + HOLD_FLAG_TTL_MS);
      holdForConfirmSessions.set(msg.sessionId, queue);
    }
  },
  onAsrFinal: (msg) => {
    if (msg.t !== "asr.final") return; // partial 不驱动 Brain(P0 无 partial,ADR-101)
    if (runtimeDraining || !startupLifecycleReady) return; // B6: shutdown/startup 关 ingress
    const holdQueue = holdForConfirmSessions.get(msg.sessionId);
    if (holdQueue !== undefined && holdQueue.length > 0) {
      const expiry = holdQueue.shift() as number;
      if (holdQueue.length === 0) holdForConfirmSessions.delete(msg.sessionId);
      if (Date.now() <= expiry) {
        liveDialog.settlePendingSpeech(msg.sessionId);
        log.info("asr.final held for confirm (manual capture; not fed to Brain)", { sessionId: msg.sessionId, turnId: msg.turnId });
        return;
      }
      log.warn("stale hold flag expired; treating asr.final as direct turn", { sessionId: msg.sessionId });
    }
    // 空 final(轮次守恒的短按/空转写/识别异常轮):不喂 Brain(空文本轮无语义;console 侧
    // 由 intent 队列消费出"没听清"反馈)——hold 旗已在上方消费,不泄漏
    if (msg.text.trim() === "") {
      liveDialog.settlePendingSpeech(msg.sessionId);
      log.info("empty asr.final skipped (turn conservation)", { sessionId: msg.sessionId, turnId: msg.turnId });
      return;
    }
    if (RECOVERY_ONLY) {
      log.warn("dialog turn rejected in recovery-only mode", { sessionId: msg.sessionId, turnId: msg.turnId });
      return;
    }
    void liveDialog.onAsrFinal(msg.sessionId, msg.turnId, msg.text).catch((err) =>
      log.error("dialog loop error", { error: String(err).slice(0, 200) })
    );
  },
  onBargeIn: (msg) => {
    if (!RECOVERY_ONLY) liveDialog.onBargeIn(msg.sessionId, msg.truncatedSentenceId);
  },
  // W4 3.9:console 编辑后文本轮(11 §5.10 纠 ASR 误听)——作用户轮喂对话环(typed provenance;
  // 与语音轮同一 onAsrFinal 入口,Brain 侧无差别处理;转写落盘由 SessionManager 记 typed 轮)
  onConfirmClick: (msg) => {
    if (RECOVERY_ONLY || runtimeDraining || !startupLifecycleReady) return;
    try {
      liveDialog.applyConfirmClick(msg.sessionId, msg.receiptId, msg.digest, msg.decision);
    } catch (err) {
      log.warn("confirm.click failed", { error: String(err).slice(0, 120) });
    }
  },
  onConfirmDecision: (msg, via) => {
    if (RECOVERY_ONLY || runtimeDraining || !startupLifecycleReady) return;
    try {
      const result = liveDialog.applyConfirmDecision(msg.sessionId, msg.receiptId, msg.decision, via ?? "local");
      if (result !== "applied") {
        return {
          t: "confirm.resolved",
          sessionId: msg.sessionId,
          receiptId: msg.receiptId,
          outcome: result === "untrusted_runtime" ? "untrusted_source" : "stale"
        } as const;
      }
    } catch (err) {
      log.warn("confirm.decision failed", { error: String(err).slice(0, 120) });
    }
  },
  onTurnText: (msg) => {
    if (RECOVERY_ONLY || runtimeDraining || !startupLifecycleReady) {
      log.warn("typed dialog turn rejected", {
        sessionId: msg.sessionId,
        turnId: msg.turnId,
        reason: RECOVERY_ONLY ? "recovery_only" : "lifecycle_closed"
      });
      return;
    }
    void liveDialog.onAsrFinal(msg.sessionId, msg.turnId, msg.text).catch((err) =>
      log.error("turn.text dialog error", { error: String(err).slice(0, 200) })
    );
  },
  onVoiceMode: (msg) => {
    const event = latestSessionProjectEvent(db, msg.sessionId);
    if (event) voiceHub.sendSessionProject(event);
    const pending = confirmLoop.pending(msg.sessionId);
    if (pending) {
      voiceHub.sendConsoleEvent({
        t: "confirm.card",
        sessionId: msg.sessionId,
        receiptId: pending.receiptId,
        text: pending.promptText,
        kind: (pending.payload as { kind?: string }).kind ?? "unknown",
        digest: pending.digest,
        digestVersion: pending.digestVersion
      });
    }
  },
  onPipelineJoined: (identity, generation) => {
    pipelineRuntimeState = pipelineRuntimeJoined(identity.sourceRevision, identity.protocolVersion);
    if (typeof generation === "number") {
      log.info("pipeline joined with generation", {
        generation,
        expected: lastRestartGeneration ?? null
      });
    }
    if (!RECOVERY_ONLY) pushHotwords();
  },

  onPipelineLeft: () => {
    pipelineRuntimeState = {
      connected: false,
      runtimeSha: null,
      protocolVersion: null,
      stateRootDigest: null,
      lastHealthAtMs: 0,
      asr: "down",
      tts: "down"
    };
  },
  onHealth: (msg) => {
    pipelineRuntimeState = {
      connected: true,
      runtimeSha: msg.identity.sourceRevision,
      protocolVersion: msg.identity.protocolVersion,
      stateRootDigest: msg.stateRootDigest,
      lastHealthAtMs: Date.now(),
      asr: msg.asr,
      tts: msg.tts
    };
  },
  onLatencyStage: (msg) => {
    // 单时钟:取 daemon 到达时刻,忽略对端 atMs(跨进程原点不可减,B1)
    const trace = latencyCollector.record(msg.turnId, msg.stage, performance.now());
    if (trace) log.info("latency trace complete", { ...trace });
  },
  onPlayout: (msg) => {
    const turnId = turnIdOfSentence(msg.sentenceId);
    if (turnId && !playoutSeen.has(turnId)) {
      playoutSeen.add(turnId);
      if (playoutSeen.size > 500) playoutSeen.clear(); // 简易上界
      const trace = latencyCollector.record(turnId, "playout_start", performance.now());
      if (trace) log.info("latency trace complete", { ...trace });
    }
  },
  verifyUpgrade: (req) => checkIdentity(req),
  // ④e A6:console peer 全部离线 → 取消 idle 收场,防 K2 幽灵收尾
  onConsoleSessionOffline: (sessionId) => {
    try {
      liveSessions.cancelIdle(sessionId);
      log.info("console session offline: idle cancelled", { sessionId });
    } catch (err) {
      log.warn("cancelIdle on console offline failed", {
        sessionId,
        error: String(err).slice(0, 120)
      });
    }
  }
}, RUNTIME_IDENTITY.protocolVersion, STATE_ROOT_DIGEST);

// 合同 §5.1 #3:voiceHub 就绪后恢复未过期 pending 并重发 confirm.card
if (!RECOVERY_ONLY) {
  const restored = confirmLoop.restoreFromDb();
  if (restored.restored > 0 || restored.expired > 0) {
    log.info("confirm restore on boot", restored);
  }
} else {
  log.warn("confirmation recovery disabled in recovery-only mode");
}

function sendSupervisorFrame(frame: SupervisorFrame): void {
  void sendSupervisorFrameAndWait(frame);
}

function sendSupervisorFrameAndWait(frame: SupervisorFrame): Promise<void> {
  if (typeof process.send !== "function") return Promise.resolve();
  return new Promise((resolveSend) => {
    try {
      process.send?.(frame, (err) => {
        if (err) log.warn("supervisor IPC send failed", { t: frame.t, error: String(err).slice(0, 160) });
        resolveSend();
      });
    } catch (err) {
      log.warn("supervisor IPC send failed", { t: frame.t, error: String(err).slice(0, 160) });
      resolveSend();
    }
  });
}

// first-run onboarding v4:self-restart 协调。受监管模式只请求 supervisor 重拉,禁止 detached self-spawn。
function performSelfRestart(generation: number): void {
  // B4: 复核 lifecycle intent；signal/fatal 已抢占则不得再 restart spawn。
  if (lifecycleIntent?.kind === "signal" || lifecycleIntent?.kind === "fatal") {
    log.warn("self-restart skipped: higher-priority lifecycle intent", { generation, intent: lifecycleIntent.kind });
    return;
  }
  if (!claimLifecycleIntent({ kind: "restart", generation })) {
    log.warn("self-restart skipped: lifecycle intent conflict", { generation });
    return;
  }
  log.info("self-restart begin", { generation, pid: process.pid });
  audit.record({ actor: "daemon", action: "setup.self_restart", meta: { generation, pid: process.pid } });
  if (SUPERVISED) {
    if (typeof process.send !== "function") {
      void fatalShutdown("supervisor_ipc_missing", new Error("supervised restart requires IPC"));
      return;
    }
    sendSupervisorFrame({ v: 1, t: "restartRequested", reason: "setup", generation });
    return;
  }
  // 与 signal shutdown 共享单一 drain；完成后仅在 intent 仍为 restart 时释放锁并 spawn。
  if (shutdownPromise) return;
  armShutdownIngress();
  shutdownPromise = drainRuntime("restart")
    .then(async (stats) => {
      if (lifecycleIntent?.kind !== "restart" || lifecycleIntent.generation !== generation) {
        log.warn("self-restart aborted after drain: intent changed", { generation, intent: lifecycleIntent?.kind });
        await sendSupervisorFrameAndWait({ v: 1, t: "stopped", reason: "restart", ...stats });
        process.exit(0);
        return;
      }
      closeDurables();
      // B4: 先释放 HOME lock，再 spawn 新实例，避免锁 handoff 竞态。
      releaseInstanceLock();
      const child = nodeSpawn(process.execPath, [...process.execArgv, ...process.argv.slice(1)], {
        detached: true,
        stdio: "inherit",
        env: { ...process.env },
        cwd: process.cwd()
      });
      child.unref();
      log.info("self-restart spawned", { childPid: child.pid, generation });
      process.exit(0);
    })
    .catch((err) => fatalShutdown("restart_failed", err));
}

// 阶段 B:监听地址可配([t2].listen,缺省 127.0.0.1;非本机绑定时 Host/Origin 白名单 + token 三道门照守)
// bind 只取得端口所有权；领域恢复与进程回收全部成功后才 announce ready。
function announceReady(): void {
    log.info("daemon started", {
      port: PORT,
      listen: LISTEN_ADDRESS,
      mobileLan: MOBILE_LAN,
      tailnetHosts: t2Cfg.tailnetHosts.length,
      home: SAYDO_HOME,
      pid: process.pid,
      startedAt: STARTED_AT,
      capToken: CAP_TOKEN === "" ? "disabled" : "enabled",
      bootPromote: {
        configPromoted: bootConfigPromoted,
        envPromoted: bootEnvPromoted,
        activationRolledBack: bootActivationRolledBack,
        configOk: bootPromote.config.ok,
        envOk: bootPromote.env.ok,
        cliRuntimePromoted: bootCliRuntimePromoted
      },
      recoveryMode: RECOVERY_ONLY ? "recovery_only" : "normal"
    });
    const ready = assessRuntimeReadiness(
      {
        daemonIdentity: RUNTIME_IDENTITY,
        daemonStateRootDigest: STATE_ROOT_DIGEST,
        pipeline: pipelineRuntimeState,
        nowMs: Date.now(),
        maxHealthAgeMs: PIPELINE_HEALTH_MAX_AGE_MS,
        // A3: IPC ready 与 /readyz 同源，依赖 recover barrier 完成。
        coreReady: startupLifecycleReady && !runtimeDraining && !RECOVERY_ONLY && DISTRIBUTED_CONSOLE_READY
      },
      voiceHub.pipelineAvailable()
    );
    sendSupervisorFrame({
      v: 1,
      t: "ready",
      identity: RUNTIME_IDENTITY,
      port: PORT,
      stateRootDigest: STATE_ROOT_DIGEST,
      readiness: {
        version: ready.version,
        coreReady: ready.coreReady,
        voiceReady: ready.voiceReady,
        voice: ready.voice
      }
    });
    if (RECOVERY_ONLY) {
      log.warn("daemon running in recovery-only mode", {
        violations: activeConfigValidation.violations.map((v) => ({ code: v.code, slot: v.slot }))
      });
      audit.record({
        actor: "daemon",
        action: "daemon.recovery_only",
        meta: { violations: activeConfigValidation.violations.map((v) => v.code) }
      });
    }
    // 活动配置的校验提示有日志出口,手工改 config.toml 的人也能看到真实回落。
    // 这里只观测不阻断:手工改过 config.toml 的人也能看到自己选了什么代价。
    try {
      const activeCfg = loadConfigFile(join(SAYDO_HOME, "config.toml"));
      const v = validateConfigForPromote({
        config: activeCfg,
        env: { ...process.env, ...readEnvMerged(SAYDO_HOME, false).values }
      });
      for (const h of v.hints) {
        log.warn("config hint", { code: h.code, slot: h.slot, message: h.message, fix: h.fix });
        // API evaluator 同族确认除日志外还要留审计痕迹。
        if (h.code === "evaluator_same_family_acked") {
          audit.record({
            actor: "owner",
            action: "config.evaluator_independence_waived",
            meta: { code: h.code, slot: h.slot ?? "evaluator", message: h.message }
          });
        }
      }
      // 活动配置违规不在这里拦(晋升口已 fail-closed),但要喊出来
      if (!v.ok) {
        for (const x of v.violations) {
          log.warn("active config violation", { code: x.code, slot: x.slot, message: x.message });
        }
      }
    } catch (err) {
      log.warn("active config not validated", { error: sanitizedConfigErrorSummary(err) });
    }
    audit.record({
      actor: "daemon",
      action: "daemon.start",
      meta: {
        port: PORT,
        listen: t2Cfg.listen,
        pid: process.pid,
        configPromoted: bootConfigPromoted,
        envPromoted: bootEnvPromoted,
        activationRolledBack: bootActivationRolledBack,
        cliRuntimePromoted: bootCliRuntimePromoted
      }
    });
    if (bootCliRuntimePromotionError) {
      log.warn("pending CLI runtime promote failed; active registry unchanged", {
        error: bootCliRuntimePromotionError
      });
      audit.record({
        actor: "daemon",
        action: "setup.promote_cli_runtime_failed",
        meta: { error: bootCliRuntimePromotionError }
      });
    }
    if (bootCliRuntimeCleanupError) {
      log.warn("pending CLI runtime promoted but staged cleanup failed", {
        promoted: bootCliRuntimePromoted,
        error: bootCliRuntimeCleanupError
      });
      audit.record({
        actor: "daemon",
        action: "setup.promote_cli_runtime_cleanup_failed",
        meta: { promoted: bootCliRuntimePromoted, error: bootCliRuntimeCleanupError }
      });
    }
    if (bootCliRuntimePromotedBindings.length > 0) {
      audit.record({
        actor: "daemon",
        action: "setup.cli_runtime_promoted",
        meta: { promoted: bootCliRuntimePromoted, bindings: bootCliRuntimePromotedBindings }
      });
    }
    if (!bootPromote.config.ok) {
      log.warn("pending config promote failed; using previous active config", {
        stage: "stage" in bootPromote.config ? bootPromote.config.stage : "unknown",
        error: "error" in bootPromote.config ? bootPromote.config.error : undefined
      });
      audit.record({
        actor: "daemon",
        action: "setup.promote_config_failed",
        meta: {
          stage: "stage" in bootPromote.config ? bootPromote.config.stage : "unknown",
          error: "error" in bootPromote.config ? String(bootPromote.config.error).slice(0, 200) : undefined
        }
      });
    }
    if (!bootPromote.env.ok) {
      log.warn("pending env promote failed; using previous active .env", {
        stage: "stage" in bootPromote.env ? bootPromote.env.stage : "unknown"
      });
    }
}

process.on("message", (message: unknown) => {
  const parsed = supervisorFrameSchema.safeParse(message);
  if (parsed.success && parsed.data.t === "prepareShutdown") {
    requestDaemonShutdown(parsed.data.reason);
  }
});
if (!SUPERVISED) {
  process.on("SIGINT", () => requestDaemonShutdown("cli_sigint"));
  process.on("SIGTERM", () => requestDaemonShutdown("supervisor_stop"));
}
if (SUPERVISED) process.on("disconnect", () => requestDaemonShutdown("supervisor_stop"));
if (bootShutdownReason) requestDaemonShutdown(bootShutdownReason);

// W4 3.1:merging 态崩溃恢复(重放 merge 执行段——幂等:已合并走短路 task_done,未合并重试/落 merge_failed)
if (!RECOVERY_ONLY && !runtimeDraining) {
  try {
    const recovered = recoverMergingTasks({ db, audit, runsDir: join(SAYDO_HOME, "tier1", "runs") });
    if (recovered.length > 0) log.info("merging recovery", { recovered });
  } catch (err) {
    log.error("merging recovery failed", { error: String(err).slice(0, 200) });
  }
} else {
  log.warn("merging recovery disabled in recovery-only mode");
}

// 每日快照备份:启动先治理过期/partial，并在超过一天未成功时补跑；随后每日重读严格配置。
const DAY_MS = 24 * 60 * 60 * 1000;
const backupRoot = join(SAYDO_HOME, "backups");
let backupRunning = false;
async function runScheduledBackup(force: boolean): Promise<void> {
  if (backupRunning) return;
  backupRunning = true;
  try {
    const retentionDays = backupRetentionDays(SAYDO_HOME);
    const now = new Date();
    const pruned = reconcileSnapshotRetention(backupRoot, retentionDays, now);
    if (!force && !isSnapshotBackupDue(backupRoot, DAY_MS, now)) {
      log.info("scheduled snapshot reconciliation", { pruned: pruned.length, backupDue: false });
      return;
    }
    const r = await runSnapshotBackup({
      backupRoot,
      sources: productionBaseSources(SAYDO_HOME),
      sqlite: [{ db, destName: "saydo.db" }],
      resolveSources: (stagingDir) => productionWorkspaceSourcesFromSnapshot(stagingDir),
      requiredRoles: ["sqlite", "global_sessions"],
      transcriptPersistence: liveCfg.storeTranscript ? "required" : "privacy_disabled",
      retentionDays
    });
    log.info("scheduled snapshot backup", {
      snapshotDir: r.snapshotDir,
      copied: r.copied.length,
      skipped: r.skipped.length,
      pruned: [...new Set([...pruned, ...r.pruned])].length
    });
  } catch (err) {
    log.error("scheduled snapshot backup failed", { error: sanitizedConfigErrorSummary(err) });
  } finally {
    backupRunning = false;
  }
}
if (!RECOVERY_ONLY) {
  startRuntimeJob(() => runScheduledBackup(false));
  scheduleRuntimeInterval(() => startRuntimeJob(() => runScheduledBackup(true)), DAY_MS);
} else {
  log.warn("scheduled snapshot backup disabled in recovery-only mode");
}

// 停靠老化调度(接线批任务④;HANDOFF §2-9-④):30s 步界转停靠 + 72h 老化,每轮重读配置
// (备份定时器同样板:unref + 改配置下一轮生效);15s 周期覆盖 30s 步界精度
const callbackEngine = new CallbackEngine({
  db,
  audit,
  resolutionTimeoutMin: (() => {
    try {
      return paramValue(loadConfigFile(join(SAYDO_HOME, "config.toml")), "callback_resolution_timeout_min");
    } catch {
      return PARAM_DEFAULTS.callback_resolution_timeout_min;
    }
  })()
});
callbackEngineRef = callbackEngine;
function parkAgingHours(): number {
  try {
    return paramValue(loadConfigFile(join(SAYDO_HOME, "config.toml")), "park_aging_hours");
  } catch {
    return PARAM_DEFAULTS.park_aging_hours;
  }
}
if (!RECOVERY_ONLY) scheduleRuntimeInterval(() => {
  try {
    const r = runParkSweep({
      db,
      audit,
      factory: packageFactory,
      callbacks: callbackEngine,
      parkAgingHours,
      // Focus v0.4 ④a:回调注入,scheduler 不直接依赖 ConfirmationLoop 类型
      // ④b:sweep 后紧随降格 saga;另 processDowngradeSagas 每拍独立跑(崩溃窗/重试)
      sweepConfirmExpired: (nowIso) => {
        const expired = confirmLoop.sweepExpired(nowIso);
        if (expired.length > 0) {
          log.info("confirm expired sweep", { count: expired.length, receipts: expired.map((e) => e.receiptId) });
        }
        // 新过期行立刻尝试降格(pending→done/failed)
        const saga = processDowngradeSagas(db, nowIso, audit);
        if (saga.processed > 0) {
          log.info("confirm downgrade saga after sweep", {
            processed: saga.processed,
            done: saga.done,
            failed: saga.failed,
            abandoned: saga.abandoned,
            noop: saga.noop
          });
        }
        // ④c:降格成功且 session 仍活跃 → downgrade_applied 控制轮
        for (const a of saga.applied) {
          liveDialogRef?.notifyDowngradeApplied(a.sessionId, a.receiptId, a.focusId);
        }
      },
      processDowngradeSagas: (nowIso) => {
        const saga = processDowngradeSagas(db, nowIso, audit);
        if (saga.processed > 0) {
          log.info("confirm downgrade saga recovery", {
            processed: saga.processed,
            done: saga.done,
            failed: saga.failed,
            abandoned: saga.abandoned,
            noop: saga.noop
          });
        }
        for (const a of saga.applied) {
          liveDialogRef?.notifyDowngradeApplied(a.sessionId, a.receiptId, a.focusId);
        }
      },
      sweepConfirmationLedger: (nowIso) => {
        const n = sweepConfirmationLedgerRetention(db, nowIso);
        if (n > 0) {
          audit.record({
            actor: "daemon",
            action: "confirm.ledger_retention_sweep",
            meta: { deleted: n, nowIso }
          });
          log.info("confirmation ledger retention sweep", { deleted: n });
        }
      }
    });
    if (r.steppedToBlocked.length > 0 || r.expired.length > 0) {
      log.info("park sweep", { steppedToBlocked: r.steppedToBlocked, expired: r.expired });
    }
    // A6:proposed TTL 到期扫描(幂等;重启重扫收敛)——proposed 放太久 ⇒ expired(§2 注 ④)
    const expiredPkgs = sweepExpiredProposed(db, new Date().toISOString());
    if (expiredPkgs.length > 0) {
      audit.record({ actor: "daemon", action: "package.proposed_expired_sweep", meta: { expired: expiredPkgs } });
      log.info("proposed ttl sweep", { expired: expiredPkgs });
    }
  } catch (err) {
    log.error("park sweep failed", { error: String(err).slice(0, 200) });
  }
}, 15_000);

// Focus v0.4 ④b:启动即扫一次降格 saga(崩溃窗 pending / 到期 failed),不等首拍 15s
// ④c:boot 时 session 通常尚未 talking,notifyDowngradeApplied 会跳过——义务已在账上
if (!RECOVERY_ONLY) try {
  const bootSaga = processDowngradeSagas(db, new Date().toISOString(), audit);
  if (bootSaga.processed > 0) {
    log.info("confirm downgrade saga boot recovery", {
      processed: bootSaga.processed,
      done: bootSaga.done,
      failed: bootSaga.failed,
      abandoned: bootSaga.abandoned,
      noop: bootSaga.noop
    });
  }
  for (const a of bootSaga.applied) {
    liveDialogRef?.notifyDowngradeApplied(a.sessionId, a.receiptId, a.focusId);
  }
} catch (err) {
  log.error("confirm downgrade saga boot failed", { error: String(err).slice(0, 200) });
}

// W5a 3.7:订阅限流 durable 重放 sweep(09 §11-5 清偿)。replayers 按 kind 注册。
// W5.4-b C2b:kind=tier1_run → retryTask(blocked→running)→ 认领循环按四元组 --resume。
const subscriptionReplayers: Record<string, Parameters<typeof sweepRetryQueue>[2][string]> = {
  tier1_run: async (entry) => {
    const payload = entry.payload as { taskId?: unknown } | null;
    const taskId = payload && typeof payload.taskId === "string" ? payload.taskId : "";
    if (!taskId) return { ok: false, rateLimitedAgain: false, message: "missing taskId" };
    try {
      retryTask(db, audit, taskId, new Date().toISOString());
      return { ok: true };
    } catch (err) {
      return { ok: false, rateLimitedAgain: false, message: String(err).slice(0, 160) };
    }
  }
};
if (!RECOVERY_ONLY) scheduleRuntimeInterval(() => {
  startRuntimeJob(async () => {
    await sweepRetryQueue(db, audit, subscriptionReplayers).catch((err) => {
      log.error("subscription retry sweep failed", { error: String(err).slice(0, 200) });
    });
  });
}, 15_000);

// ---- S2:回叫 sweep 分级选路(L0 语音 / L1 桌面+ntfy / DND 只推不响)----
// L0 直发 say() 闭包(不经 dialog 出句管线);origin 合同无 callback 枚举,native.reply 走 system,审计 callback.voice_sent。
// micHeldByMeeting 无数据源恒 false。桌面/ntfy 均注入,测试禁真弹通知/真 POST。
function dndWindowValue(): string | undefined {
  try {
    const w = (loadConfigFile(join(SAYDO_HOME, "config.toml")).dnd as Record<string, unknown> | undefined)?.["window"];
    return typeof w === "string" && w !== "" ? w : undefined;
  } catch {
    return undefined;
  }
}
const ntfyTarget = RECOVERY_ONLY ? null : (() => {
  const env = readSaydoEnv();
  const topic = env["NTFY_TOPIC"];
  const server = env["NTFY_SERVER"] ?? "https://ntfy.sh";
  if (!topic) {
    log.warn("ntfy not configured (NTFY_TOPIC missing): callback L1 push channel off");
    return null;
  }
  return { server, topic };
})();
let callbackSweepBusy = false;
const l1FailWarned = new Set<string>();
const consoleBase = consoleBaseUrl(t2Cfg.tailnetHosts, PORT);
if (!RECOVERY_ONLY) scheduleRuntimeInterval(() => {
  if (callbackSweepBusy) return;
  callbackSweepBusy = true;
  startRuntimeJob(async () => {
    try {
      await runCallbackSweep(
        {
          db,
          engine: callbackEngine,
          arbitrate,
          voice: {
            consolePeerForTask: (taskId) => {
              const rows = db
                .prepare(
                  `SELECT s.id, s.state, s.started_at FROM sessions s
                   JOIN tasks t ON t.project_id = s.project_id WHERE t.id = ?`
                )
                .all(taskId) as { id: string; state: string; started_at: string }[];
              return pickConsolePeerForTask(rows, (id) => voiceHub.hasConsolePeerForSession(id));
            },
            ttsHealthy: () => pipelineRuntimeState.tts === "ok",
            voiceBusy: (sessionId) => {
              const row = db.prepare("SELECT state FROM sessions WHERE id=?").get(sessionId) as
                | { state: string }
                | undefined;
              return row?.state === "talking" && liveDialog.hasUserTurnInFlight(sessionId);
            },
            say: async (sessionId, text, _origin) => {
              const sentenceId = `s-cb-${Date.now()}`;
              // L0 只认 sendTtsSay;文字气泡不算 L0(TTS 不健康走 consoleSay 旁路)
              return voiceHub.sendTtsSay(
                { t: "tts.say", sessionId, sentenceId, text, interruptible: true },
                [],
                "system",
                sentenceId
              );
            },
            consoleSay: (sessionId, text) =>
              voiceHub.sendConsoleSay({
                t: "tts.say",
                sessionId,
                sentenceId: `s-cb-txt-${Date.now()}`,
                text,
                interruptible: true
              })
          },
          desktop: {
            notify: async ({ title, body }) =>
              notifyDesktop(
                (command, args, options) => nodeSpawn(command, [...args], options),
                { title, body }
              )
          },
          ntfy: {
            enabled: ntfyTarget !== null,
            post: async (msg) => (ntfyTarget ? postNtfy(ntfyTarget, msg) : false),
            render: (d, entry) => renderNtfyMessage(d, entry, { consoleBase })
          },
          dnd: {
            inWindow: (now) => {
              const w = dndWindowValue();
              return w ? inDndWindow(now.toTimeString().slice(0, 5), w) : false;
            },
            windowEnd: (now) => {
              const w = dndWindowValue();
              return w ? dndWindowEnd(w, now.toISOString()) : null;
            }
          },
          log,
          audit,
          l1FailWarned,
          escalateAcked: () => callbackEngine.escalateAckedIfStale()
        },
        new Date()
      );
    } catch (err) {
      log.error("callback sweep failed", { error: String(err).slice(0, 200) });
    } finally {
      callbackSweepBusy = false;
    }
  });
}, 15_000);

// ---- 执行器批(任务①):Tier1 生产执行循环 ----
// [tier1] 两键齐备才启用(fail-closed;版本 pin 红线:cursor_agent_bin=锁定副本绝对路径 + 启动断言);
// 缺配置 = 不认领(queued 任务停在队列,处方化日志提示怎么填),不是静默降级。
// W2 阶段0-②/③(Codex 20 B2/B3):启动资格集中裁决 tier1StartupVerdict——绝对路径/文件存在可执行/
// versions/<ver>/ 形态 + 非 cursor 后端配置启动即拒(此前 agent="claude_code" 仍起 cursor 二进制)。
function readTier1Startup(): ReturnType<typeof tier1StartupVerdict> {
  try {
    const cfg = loadConfigFile(join(SAYDO_HOME, "config.toml"));
    const adapter = resolveTier1Adapter(cfg);
    return tier1StartupVerdict({
      cursorAgentBin: cfg.tier1?.cursor_agent_bin,
      pinnedVersion: cfg.tier1?.cursor_agent_pinned_version,
      adapter,
      ...(adapter === "claude_code"
        ? {
            claude: {
              bin: cfg.tier1?.claude_bin,
              pinnedVersion: cfg.tier1?.claude_pinned_version,
              model: cfg.tier1?.model,
              ...(cfg.tier1?.claude_bin
                ? { identity: verifyClaudeIdentity(SAYDO_HOME, cfg.tier1.claude_bin) }
                : {})
            }
          }
        : {})
    });
  } catch {
    return { start: false, code: "not_configured", reason: "config.toml 缺失或不可解析(首启合法;执行器不认领)" };
  }
}
const tier1Startup = readTier1Startup();
if (tier1Startup.start && !RECOVERY_ONLY && !runtimeDraining) {
  const gp = ensureGateScript(SAYDO_HOME);
  const adapter = readDevAdapter();
  const backend = adapter === "claude_code" ? claudeBackend() : cursorBackend();
  let cfgModel = "";
  let claudeMaxTurns: number | undefined;
  try {
    const cfg = loadConfigFile(join(SAYDO_HOME, "config.toml"));
    cfgModel =
      adapter === "claude_code" ? (cfg.tier1?.model ?? "opus") : (cfg.models?.dev?.model ?? "");
    if (adapter === "claude_code") claudeMaxTurns = cfg.tier1?.claude_max_turns ?? 200;
  } catch {
    cfgModel = adapter === "claude_code" ? "opus" : "";
  }
  const executorCfg: {
    saydoHome: string;
    lockedBinary: string;
    pinnedVersion: string;
    model: string;
    adapter: ReturnType<typeof readDevAdapter>;
    gateScriptPath: string;
    gateScriptExpected: string;
    gateClaudeScriptPath: string;
    gateClaudeScriptExpected: string;
    claudeMaxTurns?: number;
    receiptTimeoutSec: typeof receiptTimeoutSec;
    gateBindPath?: string;
    gateBindExpected?: string;
  } = {
    saydoHome: SAYDO_HOME,
    lockedBinary: tier1Startup.bin,
    pinnedVersion: tier1Startup.pinned,
    model: cfgModel,
    adapter,
    gateScriptPath: gp.scriptPath,
    // A1 补偿控制基准(W2 阶段0-①):每 gate 请求重读当前 backend 活动入口与此比对,漂移 ⇒ deny+终止活跃 run
    gateScriptExpected: buildActiveGateScript(gp),
    gateClaudeScriptPath: gp.claudeScriptPath,
    gateClaudeScriptExpected: buildActiveClaudeGateScript(gp),
    ...(claudeMaxTurns !== undefined ? { claudeMaxTurns } : {}),
    receiptTimeoutSec
  };
  if (process.platform === "win32") executorCfg.gateBindPath = gp.bindPath;
  tier1Executor = new Tier1Executor({
    db,
    audit,
    log: log.child({ mod: "tier1" }),
    callbacks: callbackEngine,
    approvals: runtimeApprovals,
    spawner: realAgentSpawner(backend),
    backend,
    artifacts: artifactStore, // W4 3.2 writing:成稿落 article artifact
    cfg: executorCfg
  });
  try {
    tier1Executor.assertVersion(); // 启动断言(精确版本相等;漂移 = 拒起执行器,处方化)
    const armedExecutor = tier1Executor;
    if (process.platform === "win32") {
      const listened = await listenGateHttp(SAYDO_HOME, async (json) =>
        armedExecutor.handleGateRequest(parseGateWireRequest(json))
      );
      // 评审 90 B-1:期望值取平台层返回的可信 bind 对象,不回读刚落盘的 gate-bind.json——
      // 回读会把「落盘后、回读前被替换」的内容当成基线(漂移基线自我投毒)。
      // 序列化形态必须与 writeGateBindAndSecret 逐字一致(JSON.stringify + 换行)。
      executorCfg.gateBindExpected = `${JSON.stringify(listened.bind)}\n`;
      tier1GateServer = listened.server;
    } else {
      tier1GateServer = startGateServer(gp.sockPath, (req) => armedExecutor.handleGateRequest(req));
    }
    await tier1Executor.recover(); // §12-7:先确认旧进程组 ESRCH，再恢复非终态 run
    scheduleRuntimeInterval(() => tier1Executor?.tick(), 15_000);
    log.info("tier1 executor started", { bin: tier1Startup.bin, pinned: tier1Startup.pinned });
  } catch (err) {
    await tier1Executor.emergencyShutdown().catch(() => undefined);
    await closeServer(tier1GateServer).catch(() => undefined);
    tier1GateServer = null;
    tier1Executor = null;
    log.error("tier1 executor disabled: version pin assertion failed", { error: String(err).slice(0, 200) });
    audit.record({ actor: "daemon", action: "tier1.executor_disabled", meta: { reason: String(err).slice(0, 200) } });
  }
} else if (RECOVERY_ONLY) {
  log.warn("tier1 executor disabled in recovery-only mode", {
    violations: activeConfigValidation.violations.map((v) => v.code)
  });
} else if (!tier1Startup.start && tier1Startup.code === "not_configured") {
  log.warn("tier1 executor not configured", { hint: tier1Startup.reason });
} else if (!tier1Startup.start) {
  // 配置存在但校验不过(B2/B3):fail-closed 拒起 + 审计(与"缺配置"区分,便于排障)
  log.error("tier1 executor disabled: config validation failed", { code: tier1Startup.code, reason: tier1Startup.reason });
  audit.record({ actor: "daemon", action: "tier1.executor_disabled", meta: { reason: `${tier1Startup.code}: ${tier1Startup.reason}`.slice(0, 200) } });
}
inactiveTier1Drain = tier1Executor
  ? null
  : markDurableTier1RestartPending(db, audit, SAYDO_HOME, "executor_disabled");
if (inactiveTier1Drain) {
  try {
    await inactiveTier1Drain;
  } catch (err) {
    await fatalShutdown("tier1_reap_failed", err);
  }
}

function closeServer(target: { listening: boolean; close(cb: (err?: Error) => void): void } | null): Promise<void> {
  if (!target?.listening) return Promise.resolve();
  return new Promise<void>((resolveClose, rejectClose) => {
    target.close((err) => (err ? rejectClose(err) : resolveClose()));
  });
}

async function drainRuntime(reason: PrepareShutdownReason): Promise<{
  recoverableTier1: number;
  abortedUnrecoverable: number;
}> {
  armShutdownIngress();
  runtimeApprovals.prepareShutdown();
  liveSessions.prepareShutdown();
  const tier1Drain = tier1Executor?.prepareShutdown(reason) ??
    inactiveTier1Drain ?? markDurableTier1RestartPending(db, audit, SAYDO_HOME, reason);
  const dialogDrain = liveDialog.prepareShutdown();
  const byoaDrain = abortAllByoaInvocations({ permanent: true });
  const voiceDrain = voiceHub.close();
  const jobsDrain = drainRuntimeJobs();
  const httpClosed = closeServer(server);
  server.closeIdleConnections();
  const [tier1, , byoa] = await Promise.all([
    tier1Drain,
    dialogDrain,
    byoaDrain,
    voiceDrain,
    jobsDrain,
    closeServer(tier1GateServer)
  ]);
  server.closeAllConnections();
  await httpClosed;
  // A1: 发送 stopped 前确认本 instance 的 owner 进程组已 ESRCH。
  if (tier1Executor?.lifecycleContamination()) {
    throw tier1Executor.lifecycleContamination();
  }
  const abortedUnrecoverable = (tier1.abortedUnrecoverable ?? 0) + byoa.aborted;
  audit.record({
    actor: "daemon",
    action: "runtime.prepare_shutdown",
    meta: { reason, recoverableTier1: tier1.recoverableTier1, abortedUnrecoverable }
  });
  return { recoverableTier1: tier1.recoverableTier1, abortedUnrecoverable };
}

function closeDurables(): void {
  if (dbClosed) return;
  db.close();
  dbClosed = true;
}

async function waitForCleanupWithin(jobs: Promise<unknown>[], timeoutMs: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      Promise.allSettled(jobs).then(() => undefined),
      new Promise<void>((resolveTimeout) => {
        timer = setTimeout(resolveTimeout, timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fatalShutdown(code: string, error: unknown): Promise<never> {
  if (fatalPromise) return fatalPromise;
  const message = String(error instanceof Error ? error.message : error).slice(0, 500);
  log.error("daemon shutdown failed", { code, message });
  fatalPromise = (async (): Promise<never> => {
    runtimeDraining = true;
    clearRuntimeIntervals();
    acceptingRuntimeJobs = false;
    runtimeApprovals.prepareShutdown();
    liveSessions.prepareShutdown();
    await waitForCleanupWithin([
      tier1Executor?.emergencyShutdown() ?? Promise.resolve(),
      liveDialog.prepareShutdown(),
      abortAllByoaInvocations({ permanent: true }),
      voiceHub.close(),
      drainRuntimeJobs(),
      closeServer(tier1GateServer),
      closeServer(server)
    ], 5_000);
    server.closeAllConnections();
    try {
      closeDurables();
    } catch (closeError) {
      log.error("daemon database close failed", { error: String(closeError).slice(0, 200) });
    }
    await waitForCleanupWithin([
      sendSupervisorFrameAndWait({ v: 1, t: "fatal", code, message })
    ], 500);
    process.exit(1);
  })();
  return fatalPromise;
}

function prepareDaemonShutdown(reason: PrepareShutdownReason): Promise<void> {
  if (shutdownPromise) return shutdownPromise;
  claimLifecycleIntent({ kind: "signal", reason });
  armShutdownIngress();
  log.info("daemon stopping", { reason });
  // B2: 统一硬 deadline 覆盖 drain、DB close、IPC stopped 与退出。
  const deadlineMs = 25_000;
  const deadlineAt = Date.now() + deadlineMs;
  const raceDeadline = <T>(work: Promise<T>, label: string): Promise<T> =>
    Promise.race([
      work,
      new Promise<never>((_, rejectTimeout) => {
        const remain = Math.max(0, deadlineAt - Date.now());
        const timer = setTimeout(
          () => rejectTimeout(new Error(`shutdown deadline exceeded:${label}`)),
          remain
        );
        timer.unref();
      })
    ]);
  shutdownPromise = raceDeadline(drainRuntime(reason), "drain")
    .then(async (stats) => {
      await raceDeadline(Promise.resolve().then(() => closeDurables()), "db_close");
      await raceDeadline(
        sendSupervisorFrameAndWait({ v: 1, t: "stopped", reason, ...stats }),
        "stopped_ipc"
      );
      process.exit(0);
    })
    .catch((err) => fatalShutdown("shutdown_failed", err));
  return shutdownPromise;
}

function requestDaemonShutdown(reason: PrepareShutdownReason): void {
  // B6: 登记 shutdown intent 时立即关闭全部 ingress。
  armShutdownIngress();
  if (!claimLifecycleIntent({ kind: "signal", reason }) && lifecycleIntent?.kind === "fatal") {
    return;
  }
  if (!startupLifecycleReady) {
    pendingShutdownReason ??= reason;
    return;
  }
  void prepareDaemonShutdown(reason);
}

if (pendingShutdownReason) {
  startupLifecycleReady = true;
  await prepareDaemonShutdown(pendingShutdownReason);
} else {
  startupLifecycleReady = true;
  announceReady();
}
}
