// live 工具集(接线批任务②/③;09 §13 工具契约的 function-call 装配):
// createTask/proposeStart/getDecisionPackage/issueDispatchReceipt/confirmAndDispatch(拍板链)
// + getStatus/openOnScreen + cancelTask/reviewTask/retryTask/requestManualMerge(tier1 操作面)
// + remember/addHotword/suspendSession + assessReadiness(P0 规则层)。
// 纪律:
// - dispatch 收据的语音确认词表匹配在 daemon 状态机侧(ConfirmationLoop,10 §2.5)——Brain 只发起
//   issueDispatchReceipt,确认句由 daemon 锁定档播出,accept 裁决不经 Brain;
// - turnRef/source 等溯源锚 daemon 自取(ctx.turnId),不信 Brain 报(防伪造);
// - Gate 0 未关拒 dispatch,无 bypass 分支(铁律);
// - 错误统一 {ok:false,code,message,retryable} 直接回模型。

import { z } from "zod";
import {
  newId,
  obligationResolveEvidenceSchema,
  type Adapter,
  type DecisionPackage,
  type NativeReplyOrigin,
  type ObligationResolveEvidence,
  type ReadinessEvidenceDetail
} from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import type { LlmProvider } from "../providers/types.js";
import type { Family } from "../config/family.js";
import type { ToolRegistry } from "./registry.js";
import type { BrainTools } from "./tools.js";
import { DecisionPackageFactory, assertProposable } from "../packages/factory.js";
import { getPackage, isProposedExpired, transitionToProposed } from "../storage/dao/packages.js";
import { getApproval } from "../storage/dao/approvals.js";
import { getProject, getSession, verifiedProjectWorkspace } from "../storage/dao/projects.js";
import { readRepoFile, listRepoDir } from "./repoRead.js";
import { insertTask, transitionTask } from "../storage/dao/tasks.js";
import { issueDispatchReceipt, applyReceiptEvent, approvePackageWithReceipt } from "../approvals/issue.js";
import { buildConfirmPrompt } from "../approvals/confirmVocab.js";
import { cancelWithAutoSettle, reviewTask, retryTask, requestManualMerge, steerTask } from "../tier1/operations.js";
import { assertProjectTypeEnabled } from "../tier1/typeGate.js";
import { promoteProject as promoteProjectLifecycle } from "../projects/lifecycle.js";
import {
  classifyProjectAnchorTurn,
  hasExplicitWorkspacePathLiteral,
  proposeProjectAnchor
} from "../projects/anchor.js";
import {
  getFocusAuthSnapshot,
  assertFocusAuthSnapshotCas,
  createAuthorizedBinding
} from "../focus/binding.js";
import { listFocusToolSpecs, type FocusStage } from "../focus/stage.js";
import { SESSION_END_INTENT_RE } from "./instructions.js";
import { resolveFocus, listFocusCandidatesByTitle } from "../focus/registry.js";
import { buildObligationDedupeKey, listOpenObligations } from "../focus/obligations.js";
import { ensureActiveActivationForSession, switchAnchorActivation } from "../focus/activation.js";
import { createFocus as createFocusRegistry } from "../focus/registry.js";
import { upsertObligation as upsertObligationDirect } from "../focus/obligations.js";
import { recordUndo } from "../focus/undo.js";
import { maxFocusEventSeq, openObligationsDigest } from "../focus/baseline.js";
import {
  listExpectationsForDispatch,
  projectPackageExpectationsOnOps
} from "../focus/expectations.js";
import { withFocusWriteTx } from "../focus/writeTx.js";
import {
  colorForOwner,
  emitFocusEntitySafe,
  ownerSub,
  resolutionSub
} from "../focus/entityFeed.js";
import { assembleOnSessionStart, assessReadinessSkeleton, type ReadinessGateResult } from "../evaluator/readinessGate.js";
import {
  READINESS_CHECKLISTS,
  checklistDigestOf,
  isReadinessBlocking,
  readinessDimsDigest,
  readinessEvidenceDigest,
  readinessKeysOf,
  readinessSkeleton,
  type ProjectType,
  type ReadinessRef,
  type ReadinessVerdict
} from "@saydo/contracts";
import { claimDigestOf, listCandidates, renderReadinessChecklist } from "../evaluator/readinessBinding.js";
import { getMemoryEvent } from "../storage/dao/memory.js";
import type { RuntimeApprovalFlow } from "../tier1/approvalFlow.js";
import type { MemoryLedger } from "../memory/ledger.js";
import type { HotwordStore } from "../memory/hotwords.js";
import type { LiveVoiceSessions } from "../live/voiceSessions.js";
import type { ConfirmationLoop } from "../live/confirm.js";
import { redactForSpeech } from "../voice/redactor.js";
import { assessDeep, evidenceDigestOf, type DeepAssessInput, type DeepReviewGovernor } from "../evaluator/readiness.js";
import { explainResult } from "../summary/explain.js";
import { effectiveBudget, getProjectOverrides } from "../config/projectOverrides.js";
import type { Claim } from "@saydo/contracts";
import type { VoiceDelivery } from "../voice/hub.js";

export interface LiveToolsDeps {
  /** 双速直通:取当前用户轮原文(判定 user-explicit) */
  currentTurnText?: (sessionId: string, turnId: string) => string;
  /** 双速直通:AI 提议确认的 5 秒倒计时(到点自动 accept);由 dialog 组装侧注入 */
  scheduleAutoAccept?: (sessionId: string, receiptId: string, ms: number) => void;
  /**
   * 批 4:账本写入成功后推 console「这次聊出来的东西」卡。
   * 只在写入成功路径调用;发射失败由 emitFocusEntitySafe 吞掉。
   */
  emitFocusEntity?: import("../focus/entityFeed.js").FocusEntityEmitter;
  db: Db;
  audit: AuditSink;
  brainTools: BrainTools;
  factory: DecisionPackageFactory;
  ledger: MemoryLedger;
  hotwords: HotwordStore;
  sessions: LiveVoiceSessions;
  confirm: ConfirmationLoop;
  /** 锁定档播报出口(确认句/派发结果;调用方 = LiveDialog.say 同源,内部同步 onAiSentences) */
  say: (
    sessionId: string,
    sentenceId: string,
    text: string,
    nativeContext?: { turnId: string; origin: NativeReplyOrigin }
  ) => boolean;
  /** 结构化起草(cheap 档 api;09 §13 createTask 注:语音模型不写契约)——缺失时 proposeStart 如实拒 */
  drafter: LlmProvider | null;
  /** T18a:活动 CLI self-test 登记可在 daemon 运行中变化,每次工具调用按现势重解。 */
  drafterFor?: () => LlmProvider | null;
  gate0: () => { enabled: boolean; bypass: boolean };
  devAdapter: () => Adapter;
  taskMaxDefault: () => number;
  /** 类型能力门(09 §11 enabled_project_types;W4)——proposeStart/confirmAndDispatch fail-closed 前置 */
  enabledProjectTypes: () => string[];
  /** D1 生命周期门:prepareShutdown 翻为 false 后禁止产生新的 durable dispatch。 */
  acceptingDispatch?: () => boolean;
  /** proposed 包 TTL(09 §2 注 ④;Codex 21 A6;缺省 24h)——propose 写 expires_at、dispatch/approve 双闸 */
  proposedTtlHours?: () => number;
  /**
   * readinessSkeleton 证据提供方(Codex 21 A3;A3-armed 2026-07-28 定稿:= readinessBinding.evidenceFor
   * 闭包——covered = 现役 confirmed 绑定 key 集,含 bindings 明细供 evidenceDigest 版本锚)。
   * 提供 = armed:proposeStart 硬门(fail-closed 四况 + readinessRef 绑定);生产组装 required
   * (index.ts fail-fast),低层 optional 仅供防御测试(Codex 23 B-6)。
   */
  readinessEvidence?: (sessionId: string, projectId: string) => ReadinessEvidenceDetail | null;
  /** 热词变更钩子(addHotword 后推送 pipeline 偏置词表) */
  onHotwordsChanged?: () => void;
  /** 执行中 S2 审批裁决承接(approveAction 工具;执行器批) */
  runtimeApprovals?: RuntimeApprovalFlow | null;
  /** tier1 run 产物目录(<saydoHome>/tier1/runs;explainResult 的 events/verify 读取面,W5a 3.2) */
  runsDir?: string;
  /** W2 迟到评审 A1 回收:tailnet console 在连探测(hub)——语音工具环 S3 集合动作在
   *  tailnet 面在连时一律拒(与 HTTP actions 层同一红线;P0 保守口径宁误拒,见 hub 注) */
  tailnetConsolePresent?: () => boolean;
  /**
   * Focus stage(C3/C5):缺省 0=不注册 Focus 工具;≥1 注册 proposeFocus*。
   */
  focusStage?: FocusStage | (() => FocusStage);
  /**
   * 深评触发装配(W1.4;09 §13 分层执行 + §11 规则 6 调用律;readiness.ts 库层)。
   * dims 生产者:P0 live 的 claim/证据构造语义 canonical 留白(evidence bindings 上游随
   * dogfood/R 轮定)——生产装配传恒空 dims(零触发零成本,诚实登记),测试注入 dims 验触发全链。
   * dims 非空 ∧ governor.admit 通过才触发;gap_critical ⇒ proposeStart fail-closed 拒。
   */
  readiness?: {
    evaluator: LlmProvider;
    expectedFamily?: Family;
    governor: DeepReviewGovernor;
    dims: (sessionId: string) => { dims: Claim[]; verifications: DeepAssessInput["verifications"] };
    saydoDir: string;
  } | null;
  /** 与 drafterFor 同律；复用 governor，provider/expectedFamily 按现势重解。 */
  readinessFor?: () => LiveToolsDeps["readiness"];
  now?: () => Date;
  /** S1:proposeStart 同轮上屏;via=local 才投(实现侧 sendScreenText 已过滤) */
  sendScreenText?: (sessionId: string, turnId: string, text: string) => VoiceDelivery;
  /** 本地 console 在连(等价 hub.hasLocalConsolePeerForSession) */
  hasConsolePeerForSession?: (sessionId: string) => boolean;
}

const screenCredits = new Map<string, VoiceDelivery>();

function creditKey(sessionId: string, turnId: string): string {
  return `${sessionId}\0${turnId}`;
}

function addDelivery(a: VoiceDelivery, b: VoiceDelivery): VoiceDelivery {
  return {
    attempted: a.attempted + b.attempted,
    succeeded: a.succeeded + b.succeeded,
    failed: a.failed + b.failed
  };
}

/** 工具阶段上屏记到本轮 turn,dialog 话术门 take 后累加(不占用本轮 turnId 的 ④e 通道) */
export function creditScreenDelivery(sessionId: string, turnId: string, delivery: VoiceDelivery): void {
  const k = creditKey(sessionId, turnId);
  const prev = screenCredits.get(k) ?? { attempted: 0, succeeded: 0, failed: 0 };
  screenCredits.set(k, addDelivery(prev, delivery));
}

export function takeScreenCredit(sessionId: string, turnId: string): VoiceDelivery {
  const k = creditKey(sessionId, turnId);
  const v = screenCredits.get(k) ?? { attempted: 0, succeeded: 0, failed: 0 };
  screenCredits.delete(k);
  return v;
}

/** 测试用:避免用例串扰 */
export function resetScreenCredits(): void {
  screenCredits.clear();
}

/**
 * 深评触发管道(W1.4;09 §13 分层 + §11 规则 6)。三态(code-review A1 回修):
 * - not_armed:未装配/dims 空(生产现状恒空)——规则层照常;
 * - evaluated:新评估或 governor 缓存裁决(duplicate 返回缓存 verdict 照常裁决——"同证据不重评"
 *   是成本控制,不是"重试即放行";评估成功才 commit 烧键,抛错可重试);
 * - throttled:cap/cooldown 拒且无缓存——执行门侧 fail-closed 拒(不能当放行)。
 */
async function maybeDeepAssess(
  deps: LiveToolsDeps,
  sessionId: string,
  trigger: "maybe_ready" | "propose_start",
  assertCurrent?: () => void,
  signal?: AbortSignal
): Promise<
  | { kind: "not_armed" }
  | { kind: "evaluated"; verdict: string; blockingCriticals: string[]; assessmentId: string }
  | { kind: "throttled"; reason: string }
> {
  const r = deps.readinessFor ? deps.readinessFor() : deps.readiness;
  if (!r) return { kind: "not_armed" };
  const { dims, verifications } = r.dims(sessionId);
  if (dims.length === 0) return { kind: "not_armed" };
  const now = deps.now ?? ((): Date => new Date());
  const digest = evidenceDigestOf(dims, verifications);
  const admit = r.governor.admit(sessionId, digest, now().getTime(), trigger);
  if (!admit.ok) {
    if (admit.cached) {
      return {
        kind: "evaluated",
        verdict: admit.cached.verdict,
        blockingCriticals: admit.cached.blockingCriticals,
        assessmentId: admit.cached.assessmentId
      };
    }
    return { kind: "throttled", reason: admit.reason };
  }
  const deep = await assessDeep({
    sessionId,
    dims,
    verifications,
    llm: r.evaluator,
    ...(r.expectedFamily ? { expectedFamily: r.expectedFamily } : {}),
    db: deps.db,
    saydoDir: r.saydoDir,
    audit: deps.audit,
    now,
    ...(assertCurrent ? { assertCurrent } : {}),
    ...(signal ? { signal } : {})
  });
  assertCurrent?.();
  // 评估成功才烧键(assessDeep 抛错直接向上传播——registry 折叠 tool_failed,键未烧可重试)
  r.governor.commit(sessionId, digest, trigger, now().getTime(), {
    verdict: deep.verdict,
    blockingCriticals: deep.blockingCriticals,
    assessmentId: deep.assessmentId
  });
  return {
    kind: "evaluated",
    verdict: deep.verdict,
    blockingCriticals: deep.blockingCriticals,
    assessmentId: deep.assessmentId
  };
}

/**
 * readinessSkeleton 门(Codex 21 A3;三处同源 = assessReadiness/proposeStart/会话建立 复用本函数)。
 * armed(readinessEvidence 提供)才跑硬门;未 armed 回 null(生产现状不改 propose 行为,证据绑定 canonical 留白)。
 */
function skeletonGate(deps: LiveToolsDeps, sessionId: string, projectId: string): ReadinessGateResult {
  // A3-armed 段3(Codex 22 ②④):null 旁路已删——未注入 evidence = 错误组装,走况② gap_critical
  // 落行(fail-closed,不 fail-open;生产 composition root 恒注入,此路径仅防御)
  const prow = deps.db.prepare("SELECT type FROM projects WHERE id=?").get(projectId) as { type: string } | undefined;
  const srow = deps.db.prepare("SELECT lane FROM sessions WHERE id=?").get(sessionId) as { lane: string | null } | undefined;
  const type = (prow?.type ?? "pending") as ProjectType;
  const lane = (srow?.lane ?? undefined) as "quick" | "guided" | "explore" | undefined;
  return assessReadinessSkeleton(
    {
      db: deps.db,
      audit: deps.audit,
      ...(deps.readinessEvidence ? { evidenceProvider: deps.readinessEvidence } : {}),
      ...(deps.now ? { now: deps.now } : {})
    },
    { sessionId, projectId, type, ...(lane ? { lane } : {}) }
  );
}

/**
 * 就绪现势复核(A3-armed;09 §13 covered 块,Codex 23 A-2/A-3):从当前类型完整清单 + 现读证据
 * 重算三 digest 与包内 readinessRef 比对——同 key 换证/forget/新增覆盖/清单演化/类型变更任一漂移
 * ⇒ stale。消费点 = issueDispatchReceipt(预检,尽早反馈)+ dispatchApprovedPackage(权威,
 * 与收据消费/包 approve/task 创建同一同步调用栈——better-sqlite3 无 await 间隙,窗口已闭)。
 */
export function readinessCurrentCheck(
  deps: Pick<LiveToolsDeps, "db" | "readinessEvidence">,
  pkg: DecisionPackage
): { ok: true } | { ok: false; reason: "evidence_changed" | "checklist_changed" | "type_changed" | "provider_error"; message: string } {
  if (!deps.readinessEvidence) return { ok: true }; // 未 armed(防御测试态)不复核
  const ref = pkg.readinessRef;
  if (!ref) return { ok: false, reason: "evidence_changed", message: "包缺 readinessRef(armed 前旧包)——重新提议" };
  const prow = deps.db.prepare("SELECT type FROM projects WHERE id=?").get(pkg.projectId) as { type: string } | undefined;
  const type = (prow?.type ?? "pending") as ProjectType;
  const checklistNow = checklistDigestOf(type) ?? "none";
  if (checklistNow !== ref.checklistDigest) {
    // reason 分辨(review C-1):ref 指纹若命中**别的类型**清单 ⇒ type_changed(promote 转正);
    // 否则 checklist_changed(清单演化)。两者处方同 = 按新清单重新采访重组包(§12-15 反例 10)
    const wasOtherType = (Object.keys(READINESS_CHECKLISTS) as ProjectType[]).some(
      (t) => t !== type && checklistDigestOf(t) === ref.checklistDigest
    );
    return {
      ok: false,
      reason: wasOtherType ? "type_changed" : "checklist_changed",
      message: `就绪清单已变(当前类型 ${type}),原提议作废——重新采访重组包`
    };
  }
  let evidence: ReadinessEvidenceDetail;
  try {
    evidence = deps.readinessEvidence("", pkg.projectId) ?? { covered: [], bindings: [] };
  } catch (err) {
    return { ok: false, reason: "provider_error", message: `就绪证据读取失败(${String(err).slice(0, 60)}),fail-closed 不放行` };
  }
  if (readinessEvidenceDigest(evidence.bindings) !== ref.evidenceDigest) {
    return { ok: false, reason: "evidence_changed", message: "就绪证据已变(撤销/换证/新增覆盖),原提议作废——重新提议" };
  }
  // 冗余防线:重生成骨架比对 dims 指纹(evidence/checklist 双 digest 理论上已覆盖;不一致即实现 bug 也拒)
  const dims = readinessSkeleton(type, evidence);
  if (dims !== null && readinessDimsDigest(dims) !== ref.dimsDigest) {
    return { ok: false, reason: "evidence_changed", message: "就绪骨架状态与包绑定不符,原提议作废——重新提议" };
  }
  return { ok: true };
}

/** proposeStart 起草输出合同(严格 JSON;越界/解析失败 fail-closed 拒组包) */
export const draftPackageSchema = z.strictObject({
  outcomePreview: z.string().min(1),
  inScope: z.array(z.string()).min(1),
  outOfScope: z.array(z.string()),
  acceptance: z.array(z.string().min(1)).min(1),
  plan: z.array(z.strictObject({ seq: z.number().int().positive(), step: z.string().min(1), owner: z.enum(["ai", "human"]) })).min(1),
  risks: z.array(z.string())
});

export const DRAFT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["outcomePreview", "inScope", "outOfScope", "acceptance", "plan", "risks"],
  properties: {
    outcomePreview: { type: "string", minLength: 1 },
    inScope: { type: "array", minItems: 1, items: { type: "string" } },
    outOfScope: { type: "array", items: { type: "string" } },
    acceptance: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
    plan: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["seq", "step", "owner"],
        properties: {
          seq: { type: "integer", minimum: 1 },
          step: { type: "string", minLength: 1 },
          owner: { type: "string", enum: ["ai", "human"] }
        }
      }
    },
    risks: { type: "array", items: { type: "string" } }
  }
} as const;

function toolError(code: string, message: string, retryable = false): { ok: false; code: string; message: string; retryable: boolean } {
  return { ok: false, code, message, retryable };
}

/** PG-01B:现役可调用 dispatch mode 仅 step_confirm;direct 保留 schema,调用 fail-closed。 */
export const ACTIVE_DISPATCH_MODE = "step_confirm" as const;

export function parseActiveDispatchMode(
  raw: unknown
): { ok: true; mode: "step_confirm" } | { ok: false; code: "direct_mode_not_wired"; message: string } {
  if (raw === ACTIVE_DISPATCH_MODE) return { ok: true, mode: ACTIVE_DISPATCH_MODE };
  return {
    ok: false,
    code: "direct_mode_not_wired",
    message: "直达验收档 designed/deferred,现役拍板仅逐步确认;旧 direct 值 fail-closed,不能拍板"
  };
}

/**
 * confirmAndDispatch 的执行体(09 §13):词表环 accept 后与 Brain 工具面共用同一实现。
 * 前置:Gate 0 已关(enabled 且非 bypass)、收据 decision=accept 且 outcome=pending(§3:accept 后等消费)。
 * 动作:consume 收据 -> 包 approved -> 建 TaskCard(confirmed)-> 入队(queued;同仓串行由执行器认领时把守)。
 */
export function dispatchApprovedPackage(
  deps: Pick<
    LiveToolsDeps,
    "db" | "audit" | "gate0" | "devAdapter" | "now" | "enabledProjectTypes" | "readinessEvidence" | "emitFocusEntity"
    | "acceptingDispatch"
  >,
  i: { packageId: string; revision: number; mode: "direct_to_review" | "step_confirm"; receiptId: string }
): { taskId: string; dispatchId: string } {
  const now = deps.now ?? (() => new Date());
  const nowIso = now().toISOString();
  if (deps.acceptingDispatch?.() === false) {
    throw new Error("daemon_draining:daemon 正在退出,不再接受新 dispatch");
  }
  const gate = deps.gate0();
  if (gate.enabled !== true || gate.bypass === true) {
    throw new Error("Gate 0 未关(enabled!=true 或 bypass=true),拒绝 dispatch——无 bypass 分支");
  }
  const receipt = getApproval(deps.db, i.receiptId);
  if (!receipt) throw new Error(`receipt not found: ${i.receiptId}`);
  if (receipt.decision !== "accept" || receipt.outcome !== "pending") {
    throw new Error(`dispatch requires accepted pending receipt, got decision=${receipt.decision ?? "none"} outcome=${receipt.outcome}`);
  }
  // 时效复验(接线批 code-review A1 回修;09 §3:accept 未消费越过 expiresAt = expired 终态,
  // 人回来一律签发新收据——否则悬挂的 accept+pending 张(如 Gate 0 拒后残留)可被补发消费)
  if (Date.parse(nowIso) > Date.parse(receipt.expiresAt)) {
    applyReceiptEvent(deps.db, deps.audit, i.receiptId, { kind: "expire" }, now);
    throw new Error("receipt expired(accept 未在时效内消费,按 09 §3 转 expired;要开工请重新确认)");
  }
  const pkg = getPackage(deps.db, i.packageId, i.revision);
  if (!pkg) throw new Error(`package not found: ${i.packageId} rev ${i.revision}`);
  if (receipt.refDigest !== pkg.digest) throw new Error("receipt refDigest does not match package digest(revision 漂移拒 dispatch)");
  const activeMode = parseActiveDispatchMode(i.mode);
  if (!activeMode.ok) throw new Error(`${activeMode.code}:${activeMode.message}`);
  if (pkg.mode !== ACTIVE_DISPATCH_MODE) {
    throw new Error("direct_mode_not_wired:直达验收档 designed/deferred,旧包 mode=direct_to_review fail-closed,不能拍板");
  }
  if (pkg.mode !== i.mode) throw new Error(`mode mismatch: package=${pkg.mode} requested=${i.mode}`);
  // A6 dispatch 闸(双闸之二):proposed TTL 到期不可 dispatch(receipt 在期不豁免;§12-1)——
  // proposed→approved 前的最后关卡;approve 已过则包已非 proposed,此处对 approved 包不拦(拍板即消费入队)
  if (pkg.status === "proposed" && isProposedExpired(deps.db, pkg.id, pkg.revision, nowIso)) {
    throw new Error("package_expired(proposed TTL 到期,重新提议)");
  }
  // 类型门禁(09 §13:confirmAndDispatch 前置;拍板到派发间若类型被禁同样 fail-closed 拒)
  const typeGate = assertProjectTypeEnabled(deps.db, pkg.projectId, deps.enabledProjectTypes(), "dispatch");
  if (!typeGate.ok) throw new Error(typeGate.message);
  // A3-armed 权威现势复核(Codex 23 A-3;批末 review B-1 收紧):复核放进下方消费事务的
  // 同一 SQLite 锁窗(与收据消费/包 approve/task 创建真原子——第二进程写库也无复核后-消费前缝);
  // 失败路径独立小事务置收据终态 voided_by_conflict(evidence-change 原因入 audit,不可补发)。
  // armed 前旧包(ref 缺失)同拒。

  // Codex 16 5.5 回修:consume/包 approved/建任务/入队/审计同一 SQLite 事务——
  // 中途崩溃不留"收据已消费但没有任务"(确认后 durable 状态不半程)
  const taskId = newId("tsk");
  const dispatchId = newId("dsp");
  // W5a 3.5:执行预算(墙钟/回合)= 项目覆盖 > 缺省;maxCost 恒随包(拍板口播过的数字不在派发点漂移)
  const execBudget = effectiveBudget(
    { maxCost: pkg.cost.max, walltimeActiveMin: 45, maxTurns: 80 },
    getProjectOverrides(deps.db, pkg.projectId)
  );
  // C5:读取签发时冻结的 Focus 授权快照(null = binding 不建,task 照旧)
  const focusSnap = getFocusAuthSnapshot(deps.db, i.receiptId);

  const tx = deps.db.transaction(() => {
    if (deps.readinessEvidence) {
      const current = readinessCurrentCheck(deps, pkg);
      if (!current.ok) throw new ReadinessStaleError(current.reason, current.message);
    }
    // C5 CAS:快照非 null 时 anchor/revision/epoch 未漂移才同事务写 binding
    if (focusSnap) {
      assertFocusAuthSnapshotCas(deps.db, focusSnap);
    }
    applyReceiptEvent(deps.db, deps.audit, i.receiptId, { kind: "consume" }, now);
    approvePackageWithReceipt(deps.db, deps.audit, pkg, i.receiptId);
    insertTask(
      deps.db,
      {
        id: taskId,
        projectId: pkg.projectId,
        packageRef: { packageId: pkg.id, revision: pkg.revision, digest: pkg.digest },
        title: pkg.outcomePreview.slice(0, 80),
        specMarkdown: renderSpec(pkg),
        route: "tier1", // P0.5 前 route 恒 tier1(09 §13 confirmAndDispatch 注)
        status: "confirmed",
        adapter: deps.devAdapter(),
        budget: { walltimeActiveMin: execBudget.walltimeActiveMin, maxTurns: execBudget.maxTurns, maxCost: pkg.cost.max },
        updatedAt: nowIso
      },
      nowIso
    );
    transitionTask(deps.db, taskId, "queued", "L", { now: nowIso });
    if (focusSnap) {
      createAuthorizedBinding(deps.db, {
        focusId: focusSnap.focusId,
        taskId,
        focusRevisionAtAuthorization: focusSnap.focusRevision,
        selectedAuthority: "tier1",
        mode: i.mode,
        ...(receipt.sessionId ? { sessionId: receipt.sessionId } : {})
      }, nowIso);
      // ④d:包批准投影 acceptance/budget 期待行(同消费事务;存量不回填)
      withFocusWriteTx(deps.db, {}, (ops) => {
        projectPackageExpectationsOnOps(ops, focusSnap.focusId, pkg);
      });
      // dispatch 编译过滤:只读 active(+ current applies_from);pending_ack 不进
      void listExpectationsForDispatch(deps.db, focusSnap.focusId, { includeNextDispatch: false });
    }
    deps.audit.record({
      actor: "daemon",
      action: "task.dispatch",
      meta: {
        taskId,
        dispatchId,
        packageId: pkg.id,
        revision: pkg.revision,
        receiptId: i.receiptId,
        mode: i.mode,
        focusBinding: focusSnap ? { focusId: focusSnap.focusId } : null
      }
    });
  });
  try {
    tx();
  } catch (err) {
    if (err instanceof ReadinessStaleError) {
      // 失败路径(消费事务已回滚):收据终态化独立持久(小事务)——终态不可补发 + audit 有账
      applyReceiptEvent(deps.db, deps.audit, i.receiptId, { kind: "conflict_voided" }, now);
      deps.audit.record({
        actor: "daemon",
        action: "dispatch.readiness_stale",
        meta: { packageId: pkg.id, revision: pkg.revision, receiptId: i.receiptId, reason: err.reason }
      });
      throw new Error(`readiness_stale(${err.reason}):${err.staleMessage}`);
    }
    throw err;
  }
  // 批 4:派活写入成功后长卡(确认消费与 confirmAndDispatch 直通共用本收口;失败不影响派发)
  if (receipt.sessionId) {
    emitFocusEntitySafe(deps.emitFocusEntity, null, receipt.sessionId, {
      kind: "派活",
      title: pkg.outcomePreview.slice(0, 80) || "任务",
      sub: "已排进队列 · 到验收点叫你",
      color: "green"
    });
  }
  return { taskId, dispatchId };
}

/** dispatch 事务内现势复核失败(review B-1):事务回滚后由 catch 侧做收据终态化 */
class ReadinessStaleError extends Error {
  constructor(
    readonly reason: string,
    readonly staleMessage: string
  ) {
    super(`readiness_stale(${reason})`);
  }
}

function renderSpec(pkg: DecisionPackage): string {
  return [
    `# ${pkg.outcomePreview}`,
    "",
    "## 范围",
    ...pkg.inScope.map((s) => `- ${s}`),
    ...(pkg.outOfScope.length > 0 ? ["", "## 不做", ...pkg.outOfScope.map((s) => `- ${s}`)] : []),
    "",
    "## 验收标准",
    ...pkg.acceptance.map((a) => `- ${a}`)
  ].join("\n");
}

/** 注册全套 live 工具(specs 供 function-call 装配;handler 全部 daemon 侧执行) */
export function registerLiveTools(reg: ToolRegistry, deps: LiveToolsDeps): void {
  const now = deps.now ?? (() => new Date());

  reg.register(
    {
      name: "resolveProject",
      description:
        "当前用户这句话只点名已有项目、没有明确本地路径时调用。daemon 只读当前用户轮并机械引导补充路径；绝不签发项目候选或确认。",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {}
      }
    },
    async (args, ctx) => {
      if (
        typeof args !== "object" ||
        args === null ||
        Array.isArray(args) ||
        Object.keys(args as Record<string, unknown>).length > 0
      ) {
        return toolError("invalid_arguments", "resolveProject 不接受参数");
      }
      const userTurn = deps.sessions.findUserTurn(ctx.sessionId, ctx.turnId);
      if (!userTurn) return toolError("anchor_turn_missing", "当前用户轮不存在或未被听到");
      if (hasExplicitWorkspacePathLiteral(userTurn.text)) {
        return toolError("workspace_path_present", "当前轮已经含本地路径，应改用 proposeProjectAnchor");
      }
      const session = getSession(deps.db, ctx.sessionId);
      if (!session) return toolError("session_not_found", "当前会话不存在");
      const currentProject = getProject(deps.db, session.projectId);
      if (!currentProject) return toolError("project_not_found", "当前会话项目不存在");
      if (session.projectRevision > 0 || currentProject.status !== "draft") {
        return toolError("anchor_already_resolved", "当前会话已经锚定项目，不再进入项目归属引导");
      }
      const rows = deps.db
        .prepare(
          `SELECT id, title FROM projects
            WHERE id != ? AND status != 'archived' AND trim(title) != ''`
        )
        .all(session.projectId) as { id: string; title: string }[];
      const classified = classifyProjectAnchorTurn(userTurn.text, rows);
      if (classified.kind !== "name_only") {
        const messages = {
          workspace_path_present: "当前轮已经含本地路径，应改用 proposeProjectAnchor",
          workspace_path_ambiguous: "当前轮同时包含多个本地路径，不能判断项目归属",
          workspace_path_not_anchor: "当前轮中的路径不是单纯、正向的项目归属表达",
          project_name_missing: "当前轮没有点名可识别的现役项目",
          project_name_ambiguous: "当前轮同时匹配多个现役项目",
          project_reference_has_payload: "当前轮仍含需求内容，不是单纯的项目归属指代"
        } as const;
        const code = classified.kind === "explicit_path" ? "workspace_path_present" : classified.reason;
        return toolError(code, messages[code]);
      }
      const match = classified.match.id;
      const confidence = 0.9;
      const sentenceId = `s-resolve-project-${ctx.turnId}`;
      const promptText = "我听到你想接着已有项目。请直接说它的本地路径。";
      if (!deps.say(ctx.sessionId, sentenceId, promptText, { turnId: ctx.turnId, origin: "assistant_reply" })) {
        return toolError("tts_unavailable", "项目路径引导没有进入在线语音管线");
      }
      deps.audit.record({
        actor: "daemon",
        action: "project.resolve.guided",
        meta: { sessionId: ctx.sessionId, turnId: ctx.turnId, confidence, matched: match !== undefined }
      });
      return {
        ok: true,
        ...(match !== undefined ? { match } : {}),
        confidence,
        suggestPathOrScreen: true,
        control: "await_user"
      };
    }
  );

  reg.register(
    {
      name: "proposeProjectAnchor",
      description:
        "当前用户这句话明确说出绝对路径或 ~/ 路径时，提议把当前 draft 登记到该本地工作区；路径由 daemon 从当前用户轮提取，禁止在参数中传路径。已有项目 exact path 会提议并回；调用本身零项目写入。",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: ["coding", "writing", "planning", "research", "marketing", "general"] }
        }
      }
    },
    async (args, ctx) => {
      const userTurn = deps.sessions.findUserTurn(ctx.sessionId, ctx.turnId);
      if (!userTurn) return toolError("anchor_turn_missing", "当前用户轮不存在或未被听到");
      const rawType = (args as Record<string, unknown> | null)?.["type"];
      const proposal = proposeProjectAnchor({
        db: deps.db,
        sessionId: ctx.sessionId,
        turnId: ctx.turnId,
        userText: userTurn.text,
        ...(typeof rawType === "string" ? { type: rawType } : {}),
        now: now()
      });
      if (!proposal.ok) return toolError(proposal.code, proposal.message);
      const candidate = proposal.candidate;
      if (deps.confirm.pending(ctx.sessionId)) {
        return toolError("confirmation_busy", "当前会话还有另一项确认，项目归属候选未覆盖它");
      }
      deps.audit.record({
        actor: "brain",
        action: "project.anchor.proposed",
        refDigest: candidate.canonicalPathDigest,
        meta: {
          sessionId: ctx.sessionId,
          draftId: candidate.draftId,
          proposalId: candidate.proposalId,
          branch: candidate.branch,
          proposalRevision: candidate.proposalRevision
        }
      });
      const enqueued = deps.say(ctx.sessionId, `s-anchor-${ctx.turnId}`, proposal.promptText, {
        turnId: ctx.turnId,
        origin: "confirmation"
      });
      if (enqueued === false) return toolError("tts_unavailable", "确认句没有呈现到在线语音或本会话控制台，候选未登记");
      const presented = deps.confirm.tryPresent(ctx.sessionId, {
        receiptId: candidate.proposalId,
        sentenceId: `s-anchor-${ctx.turnId}`,
        promptText: proposal.promptText,
        payload: candidate
      });
      if (!presented) return toolError("confirmation_busy", "当前会话确认状态发生竞争，项目归属候选未登记");
      return {
        ok: true,
        presented: true,
        control: "await_user",
        presentationId: candidate.proposalId,
        proposalId: candidate.proposalId
      };
    }
  );

  reg.register(
    {
      name: "promoteProject",
      description:
        "把未定型(pending)的草稿项目转正为具体类型(奠基完成或首个决策包后;用户说'开始写/开始做'即定型)——pending 项目首包可出但不可拍板派发,转正后才能拍板(09 §13)。projectId 可省略=当前会话的项目(推荐省略;草稿项目自带系统管理的存放位置,用户说'你来安排/我不懂路径'时直接转正,不要再问路径)",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["title", "type"],
        properties: {
          projectId: { type: "string" },
          title: { type: "string", description: "项目名(用户口述或从对话归纳)" },
          type: { type: "string", enum: ["coding", "writing", "planning", "research", "marketing", "general"] }
        }
      }
    },
    async (args, ctx) => {
      // RA-closeout(owner 裁决 (a) 案 2026-07-28;code-review A-2):转正链生产触发点——
      // 此前 promoteProject 生产零调用点,pending 项目"首包可出、永远不可拍"死锁
      const a = (args ?? {}) as Record<string, unknown>;
      const t = String(a["type"] ?? "");
      if (!["coding", "writing", "planning", "research", "marketing", "general"].includes(t)) {
        return toolError("invalid_type", `项目类型词表外:${t}`);
      }
      // N9 根修(8/6 轨 A):模型看不见会话 projectId,必填=必猜必错(mismatch 死锁链第一环)。
      // projectId 缺省=会话锚定项目(daemon 自取,恒安全);显式传且不符仍拒(原防御保留)
      const sesForPromote = deps.sessions.ensureSession(ctx.sessionId);
      const sessionProjectId = sesForPromote.session.projectId;
      if (!sessionProjectId) return toolError("promote_project_mismatch", "会话没有锚定项目");
      const givenPid = String(a["projectId"] ?? "");
      if (givenPid && givenPid !== sessionProjectId) {
        return toolError("promote_project_mismatch", "只能转正当前会话锚定的项目(projectId 与会话不符,可省略不传)");
      }
      a["projectId"] = sessionProjectId;
      try {
        const p = promoteProjectLifecycle(
          deps.db,
          deps.audit,
          { projectId: String(a["projectId"] ?? ""), title: String(a["title"] ?? ""), type: t as Exclude<ProjectType, "pending"> },
          (deps.now ?? (() => new Date()))().toISOString()
        );
        // A3-armed(Codex 23 B-1):promote = session↔project 绑定语义变更(清单从 pending 换新类型)⇒
        // 立即重装配落新类型评估行(armed 时);失败不阻断转正(装配幂等,下轮 assess 兜底)
        if (deps.readinessEvidence) {
          try {
            assembleOnSessionStart(
              { db: deps.db, audit: deps.audit, evidenceProvider: deps.readinessEvidence, ...(deps.now ? { now: deps.now } : {}) },
              { sessionId: ctx.sessionId, projectId: p.id, type: p.type }
            );
          } catch {
            /* 装配失败不断转正链(audit 已有 promote 行;下轮评估兜底) */
          }
        }
        return { ok: true, projectId: p.id, type: p.type };
      } catch (err) {
        return toolError("promote_failed", String(err instanceof Error ? err.message : err).slice(0, 160));
      }
    }
  );

  reg.register(
    {
      name: "createTask",
      description: "把用户口述的任务要点交给系统起草任务卡草稿;返回草稿 id 和复述稿(逐点向用户口头确认)",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["rawPoints"],
        properties: { rawPoints: { type: "array", items: { type: "string" }, description: "对话原话要点(目标/范围/验收)" } }
      }
    },
    async (args, ctx) => {
      const a = (args ?? {}) as Record<string, unknown>;
      return deps.brainTools.createTask(
        { sessionId: ctx.sessionId, rawPoints: a["rawPoints"] },
        ctx.assertCurrent,
        ctx.signal
      );
    }
  );

  reg.register(
    {
      name: "proposeStart",
      description: "就绪后消费任务草稿组装决策包(成果预览/范围/验收/计划/封顶/小样);返回包 id、digest、demoRef 与 demoPresented",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["taskDraftId"],
        properties: { taskDraftId: { type: "string" } }
      }
    },
    async (args, ctx) => {
      const a = (args ?? {}) as Record<string, unknown>;
      const draft = deps.brainTools.getDraft(String(a["taskDraftId"] ?? ""));
      if (!draft) return toolError("draft_not_found", "task draft not found (先 createTask)");
      const drafter = deps.drafterFor ? deps.drafterFor() : deps.drafter;
      if (!drafter) {
        return toolError("drafter_unavailable", "结构化起草模型未配置(cheap 档),组不了包——屏幕设置里配好再来");
      }
      // 类型门禁(09 §13:proposeStart 前置 project.type ∈ enabled_project_types;fail-closed,§12-12)
      const sessForGate = getSession(deps.db, ctx.sessionId);
      if (sessForGate) {
        const gate = assertProjectTypeEnabled(deps.db, sessForGate.projectId, deps.enabledProjectTypes(), "propose");
        if (!gate.ok) return toolError(gate.code, gate.message);
      }
      // readinessSkeleton 硬门(Codex 21 A3;armed 时):fail-closed 四况恒 gap_critical ⇒ 拒组包
      // (W1 根修:空账本 ⇒ 全 unknown ⇒ gap_critical,不凭空出包);通过则出 readinessRef 绑定进包。
      // 门拒绝集 = isReadinessBlocking(A3-armed,Codex 23 B-4):gap_critical 拒;
      // gap_knowledge/gap_requirement 为建议态放行(非 critical 缺口,10 #42 播报不阻塞)。
      let readinessRef: ReadinessRef | undefined;
      if (sessForGate) {
        const sk = skeletonGate(deps, ctx.sessionId, sessForGate.projectId);
        if (isReadinessBlocking(sk.verdict)) {
          // M4(走查补齐):拒绝消息给 Brain 自救路径——有候选未确认 ⇒ 指向 confirmReadiness;
          // 零候选 ⇒ 指向采访(remember 带 readinessKey)。防模型收到拒绝后原地重试打转。
          const prowType = deps.db.prepare("SELECT type FROM projects WHERE id=?").get(sessForGate.projectId) as
            | { type: ProjectType }
            | undefined;
          const pendingCandidates = prowType ? listCandidates({ db: deps.db, ledger: deps.ledger }, sessForGate.projectId, prowType.type) : [];
          const hint =
            pendingCandidates.length > 0
              ? `有 ${pendingCandidates.length} 项记了还没跟用户核对(${pendingCandidates.map((c) => c.label).slice(0, 3).join("/")})——先调 confirmReadiness 复述确认`
              : "先采访:用户亲口给出就绪项后用 remember 带 readinessKey 记录,再 confirmReadiness 确认";
          return toolError(
            `readiness_${sk.verdict}`,
            `就绪评估未通过(${sk.verdict}${sk.blockingCriticals.length > 0 ? `:${sk.blockingCriticals.slice(0, 3).join(";")}` : ""})——${hint}`
          );
        }
        readinessRef = sk.ref;
      }
      // W1.4 深评门:proposeStart 前触发异族深评(09 §13;"评估未通过不得提议开始"的机械强制,
      // 不靠 Brain 自觉)。dims 恒空(生产现状)不触发;blocking verdict 一律拒——含 duplicate 重试
      // (返回缓存裁决照拒,不是放行)与 throttled(cap/cooldown 无缓存,fail-closed 拒;A1 回修)
      const deep = await maybeDeepAssess(deps, ctx.sessionId, "propose_start", ctx.assertCurrent, ctx.signal);
      ctx.assertCurrent?.();
      if (deep.kind === "evaluated" && isReadinessBlocking(deep.verdict as ReadinessVerdict)) {
        return toolError(
          `readiness_${deep.verdict}`,
          `就绪评估未通过(${deep.verdict}${deep.blockingCriticals.length > 0 ? `:${deep.blockingCriticals.slice(0, 3).join(";")}` : ""})——补上证据或说清缺口再提议`
        );
      }
      if (deep.kind === "throttled") {
        return toolError(
          "readiness_throttled",
          `就绪深评暂不可用(${deep.reason}:调用律上限或冷却中)——没有通过的评估就不能提议开始,稍后再试或挂起会话`
        );
      }
      const session = getSession(deps.db, ctx.sessionId);
      if (!session) return toolError("session_not_found", "session not found");
      const r = await drafter.chat(
        {
          messages: [
            {
              role: "system",
              content:
                "你是决策包起草器。把任务要点整理成结构化 JSON:outcomePreview(一句话成果)/inScope/outOfScope/acceptance(每条可测)/plan(seq+step+owner,owner 取 ai 或 human)/risks。只输出 JSON。"
            },
            { role: "user", content: draft.rawPoints.map((p, i) => `${i + 1}. ${p}`).join("\n") }
          ],
          temperature: 0,
          jsonSchema: DRAFT_JSON_SCHEMA as unknown as Record<string, unknown>
        },
        ctx.signal
      );
      ctx.assertCurrent?.();
      if (!r.ok) return toolError(`draft_${r.code}`, r.message, r.retryable);
      let body: z.infer<typeof draftPackageSchema>;
      try {
        body = draftPackageSchema.parse(JSON.parse(r.text));
      } catch (err) {
        return toolError("draft_invalid", `起草输出不合合同:${String(err).slice(0, 160)}`);
      }
      // W5a 3.5:包成本上限 = 项目覆盖 > 全局缺省(受控表;组包时点生效,拍板口播的即生效值)
      const maxCost = effectiveBudget(
        { maxCost: deps.taskMaxDefault(), walltimeActiveMin: 45, maxTurns: 80 },
        getProjectOverrides(deps.db, session.projectId)
      ).maxCost;
      const { pkg } = deps.factory.assemble({
        projectId: session.projectId,
        outcomePreview: body.outcomePreview,
        inScope: body.inScope,
        outOfScope: body.outOfScope,
        assumptions: [],
        acceptance: body.acceptance,
        plan: body.plan,
        cost: { expected: { known: false }, p95: { known: false }, max: maxCost, currency: "CNY" },
        risks: body.risks,
        mode: "step_confirm", // PG-01B:现役仅逐步确认;直达档 designed/deferred,不在语音拍板询问
        preauthorizedEffects: [],
        effectPolicyVersion: "e2/0.1.0",
        ...(readinessRef ? { readinessRef } : {}) // Codex 21 A3:就绪绑定进包(§0.1 签名域)
      });
      assertProposable(pkg);
      // A6:转 proposed = CAS 关旧活跃 proposed(supersede)+ 写不可变 proposed_at + expires_at(=now+TTL)
      transitionToProposed(deps.db, {
        id: pkg.id,
        revision: pkg.revision,
        projectId: pkg.projectId,
        nowIso: now().toISOString(),
        ttlHours: deps.proposedTtlHours?.() ?? 24
      });
      let demoPresented = false;
      const localOnline = deps.hasConsolePeerForSession?.(ctx.sessionId) ?? false;
      if (pkg.demoRef && localOnline && deps.sendScreenText) {
        const preview = pkg.outcomePreview.slice(0, 40);
        const demoTurnId = newId("ses");
        const delivery = deps.sendScreenText(ctx.sessionId, demoTurnId, `决策包小样已放到屏幕：${preview}`);
        demoPresented = delivery.succeeded >= 1;
        creditScreenDelivery(ctx.sessionId, ctx.turnId, delivery);
      }
      return {
        packageId: pkg.id,
        revision: pkg.revision,
        digest: pkg.digest,
        ...(pkg.demoRef ? { demoRef: pkg.demoRef } : {}),
        demoPresented
      };
    }
  );

  reg.register(
    {
      name: "getDecisionPackage",
      description: "读取决策包全文(口播成果预览/计划/成本/风险用;槽位禁止自造数字)",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["packageId", "revision"],
        properties: { packageId: { type: "string" }, revision: { type: "integer" } }
      }
    },
    (args) => {
      const a = (args ?? {}) as Record<string, unknown>;
      const pkg = getPackage(deps.db, String(a["packageId"] ?? ""), Number(a["revision"] ?? 0));
      return pkg ?? toolError("package_not_found", "decision package not found");
    }
  );

  reg.register(
    {
      name: "issueDispatchReceipt",
      description:
        "用户口头同意开工后签发派发收据;系统会自动播出锁定档确认句并等用户用封闭肯定词答复——你本轮不要再重复确认内容",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["packageId", "revision"],
        properties: { packageId: { type: "string" }, revision: { type: "integer" } }
      }
    },
    (args, ctx) => {
      const a = (args ?? {}) as Record<string, unknown>;
      const pkg = getPackage(deps.db, String(a["packageId"] ?? ""), Number(a["revision"] ?? 0));
      if (!pkg) return toolError("package_not_found", "decision package not found");
      if (pkg.status !== "proposed") return toolError("package_not_proposed", `package status=${pkg.status},只有 proposed 可拍板`);
      // pending 拍板闸(owner 裁决 (a) 案 2026-07-28,09 §13):pending 首包可出不可拍——先 promoteProject 定型
      const pendingGate = assertProjectTypeEnabled(deps.db, pkg.projectId, deps.enabledProjectTypes(), "dispatch");
      if (!pendingGate.ok) return toolError(pendingGate.code, pendingGate.message);
      // A6 approve 闸:proposed TTL 到期不可拍板(receipt 在期不豁免——包过期是硬事实,§12-1)
      if (isProposedExpired(deps.db, pkg.id, pkg.revision, (deps.now ?? (() => new Date()))().toISOString())) {
        return toolError("package_expired", "这个提议放太久过期了(proposed TTL),要开工重新提议一次");
      }
      // readinessRef 拍板门(Codex 21 A3;A3-armed 双检升级,Codex 23 A-2/A-3):
      // 检① 评估行完整性——缺失/dims 或双 digest 对不上/verdict blocking 拒;
      // 检② 就绪现势预检(尽早反馈;权威点在 dispatchApprovedPackage 事务)——漂移拒 readiness_stale。
      if (deps.readinessEvidence) {
        if (!pkg.readinessRef) return toolError("readiness_ref_missing", "决策包缺就绪绑定,不能拍板(readinessRef 缺失)");
        const asm = deps.db
          .prepare("SELECT dims_json, verdict, checklist_digest, evidence_digest FROM readiness_assessments WHERE id=?")
          .get(pkg.readinessRef.assessmentId) as
          | { dims_json: string; verdict: string; checklist_digest: string | null; evidence_digest: string | null }
          | undefined;
        if (!asm) return toolError("readiness_ref_stale", "就绪评估行不存在,重新评估再拍板");
        let dimsDigestNow = "";
        try {
          dimsDigestNow = readinessDimsDigest(JSON.parse(asm.dims_json) as never);
        } catch {
          dimsDigestNow = "";
        }
        if (
          dimsDigestNow !== pkg.readinessRef.dimsDigest ||
          asm.checklist_digest !== pkg.readinessRef.checklistDigest ||
          asm.evidence_digest !== pkg.readinessRef.evidenceDigest ||
          isReadinessBlocking(asm.verdict as ReadinessVerdict)
        ) {
          return toolError("readiness_ref_mismatch", "就绪绑定与评估行不符(漂移或未通过),不能拍板");
        }
        const current = readinessCurrentCheck(deps, pkg);
        if (!current.ok) return toolError("readiness_stale", current.message);
      }
      // P0 防御(Codex 16 5.2):直达档确认必须逐条念 grant spokenForm(10 #12 renderGrantChecklist),
      // 本环节确认句只复述成果+封顶——直达包在此签发会让用户未闻清单即授权出圈操作,fail-closed 拒
      if (pkg.mode === "direct_to_review" || pkg.preauthorizedEffects.length > 0) {
        return toolError(
          "direct_mode_not_wired",
          "直达验收档 designed/deferred,本批未开放;现役只能使用逐步确认,旧 direct 包不能拍板"
        );
      }
      // turnRef daemon 自取当前轮(§9 DDL CHECK:voice 裁决缺 turn_ref 非法;不信 Brain 报)
      if (deps.confirm.pending(ctx.sessionId)) {
        return toolError("confirmation_busy", "当前会话还有另一项确认，先裁决后再签发派发收据");
      }
      const receipt = issueDispatchReceipt(
        deps.db,
        deps.audit,
        { pkg, decidedVia: "voice", authStrength: "voice_weak", sessionId: ctx.sessionId, turnRef: ctx.turnId },
        now
      );
      // 锁定档确认句(10 §2.5 确认文法:复述关键参数;由 daemon 播出,Brain 不得变体)
      const spoken = redactForSpeech(`要开工了:${pkg.outcomePreview},封顶 ${pkg.cost.max} 元`).text;
      const promptText = buildConfirmPrompt(spoken);
      const sentenceId = `s-confirm-${receipt.id}`;
      const enqueued = deps.say(ctx.sessionId, sentenceId, promptText, {
        turnId: ctx.turnId,
        origin: "confirmation"
      });
      if (enqueued === false) {
        return toolError("tts_unavailable", "派发确认句没有呈现到在线语音或本会话控制台，收据留在屏幕审批");
      }
      const presented = deps.confirm.tryPresent(ctx.sessionId, {
        receiptId: receipt.id,
        sentenceId,
        promptText,
        payload: { kind: "dispatch", packageId: pkg.id, revision: pkg.revision, mode: pkg.mode }
      });
      if (!presented) return toolError("confirmation_busy", "派发收据已签发，但语音确认改走屏幕审批");
      return { receiptId: receipt.id, confirmationPresented: true };
    }
  );

  reg.register(
    {
      name: "confirmAndDispatch",
      description: "收据经用户词表确认(decision=accept)后派发任务;通常系统在确认环自动完成,仅补发场景使用",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["packageId", "revision", "mode", "receiptId"],
        properties: {
          packageId: { type: "string" },
          revision: { type: "integer" },
          mode: { type: "string", enum: ["step_confirm"] },
          receiptId: { type: "string" }
        }
      }
    },
    (args) => {
      const a = (args ?? {}) as Record<string, unknown>;
      const mode = parseActiveDispatchMode(a["mode"]);
      if (!mode.ok) return toolError(mode.code, mode.message);
      return dispatchApprovedPackage(deps, {
        packageId: String(a["packageId"] ?? ""),
        revision: Number(a["revision"] ?? 0),
        mode: mode.mode,
        receiptId: String(a["receiptId"] ?? "")
      });
    }
  );

  reg.register(
    {
      name: "getStatus",
      description: "查任务状态(单个或全部);返回 TaskView 列表",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: { taskId: { type: "string" } }
      }
    },
    (args) => deps.brainTools.getStatus(args ?? {})
  );

  reg.register(
    {
      name: "openOnScreen",
      description:
        "把 diff/日志/PR/文件放到屏幕上;what=file 且给 ref(仓内相对路径,可带 :行号)时直接打开编辑器,其余是本地 review 链接",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["taskId", "what"],
        properties: {
          taskId: { type: "string" },
          what: { type: "string", enum: ["diff", "log", "pr", "file"] },
          ref: { type: "string" }
        }
      }
    },
    (args) => deps.brainTools.openOnScreen(args ?? {})
  );

  reg.register(
    {
      name: "explainResult",
      description:
        "讲解任务结果:one_liner=一句话;walkthrough=简短走读;decisions=agent 自主决策清单(每条含理由,可推翻)",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["taskId", "level"],
        properties: {
          taskId: { type: "string" },
          level: { type: "string", enum: ["one_liner", "walkthrough", "decisions"] }
        }
      }
    },
    (args, ctx) =>
      explainResult(
        {
          db: deps.db,
          audit: deps.audit,
          drafter: deps.drafterFor ? deps.drafterFor() : deps.drafter,
          runsDir: deps.runsDir ?? "",
          ...(ctx.signal ? { signal: ctx.signal } : {}),
          ...(deps.now ? { now: deps.now } : {})
        },
        args ?? {}
      )
  );

  reg.register(
    {
      name: "cancelTask",
      description: "取消任务(cancel_requested;执行侧确认后 settled;无活跃执行即时停)",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["taskId"],
        properties: { taskId: { type: "string" } }
      }
    },
    (args) => {
      const a = (args ?? {}) as Record<string, unknown>;
      return cancelWithAutoSettle(deps.db, deps.audit, String(a["taskId"] ?? ""), now().toISOString());
    }
  );

  reg.register(
    {
      name: "reviewTask",
      description:
        "验收裁决:approve=批准待合并;request_changes=提修改(这轮不作废,同任务新 attempt);reject=作废这轮(走取消链)。expectedAttempt 用 getStatus 的 attempt",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["taskId", "verdict", "expectedAttempt"],
        properties: {
          taskId: { type: "string" },
          verdict: { type: "string", enum: ["approve", "request_changes", "reject"] },
          expectedAttempt: { type: "integer" },
          comments: { type: "string" }
        }
      }
    },
    (args) => {
      const a = (args ?? {}) as Record<string, unknown>;
      return reviewTask(
        deps.db,
        deps.audit,
        {
          taskId: String(a["taskId"] ?? ""),
          verdict: a["verdict"] as "approve" | "request_changes" | "reject",
          expectedAttempt: Number(a["expectedAttempt"] ?? 0),
          ...(typeof a["comments"] === "string" ? { comments: a["comments"] } : {})
        },
        now().toISOString()
      );
    }
  );

  reg.register(
    {
      name: "retryTask",
      description: "失败任务重新排队(重派发)或回答被卡住任务的问题(message=答复);不直接重启执行",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["taskId"],
        properties: { taskId: { type: "string" }, message: { type: "string" } }
      }
    },
    (args) => {
      const a = (args ?? {}) as Record<string, unknown>;
      return retryTask(
        deps.db,
        deps.audit,
        String(a["taskId"] ?? ""),
        now().toISOString(),
        typeof a["message"] === "string" ? a["message"] : undefined
      );
    }
  );

  reg.register(
    {
      name: "steerTask",
      description:
        "给任务改需求/追加指示。运行中的任务会停掉当前执行轮、保留已改文件、带新指示重跑(cancel_resume);排队/等验收的任务排队生效(queued_delta,下次执行轮带入)。要彻底作废用 cancelTask",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["taskId", "instruction"],
        properties: { taskId: { type: "string" }, instruction: { type: "string" } }
      }
    },
    (args) => {
      const a = (args ?? {}) as Record<string, unknown>;
      return steerTask(
        deps.db,
        deps.audit,
        { taskId: String(a["taskId"] ?? ""), instruction: String(a["instruction"] ?? "") },
        now().toISOString()
      );
    }
  );

  reg.register(
    {
      name: "approveAction",
      description:
        "对执行中上浮的 S2 审批做显式裁决(仅 S2;须带播报呈现锚)。正常路径是语音词表答复或屏幕审批页;本工具只服务已知 approvalId 的显式裁决",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["approvalId", "decision", "presentationId", "heardNonce"],
        properties: {
          approvalId: { type: "string" },
          decision: { type: "string", enum: ["accept", "reject"] },
          presentationId: { type: "string" },
          heardNonce: { type: "string" }
        }
      }
    },
    (args, ctx) => {
      const a = (args ?? {}) as Record<string, unknown>;
      const flow = deps.runtimeApprovals;
      if (!flow) return toolError("approvals_not_wired", "执行审批环未装配");
      const approvalId = String(a["approvalId"] ?? "");
      const decision = a["decision"];
      if (decision !== "accept" && decision !== "reject") return toolError("invalid_decision", "decision 只接受 accept/reject");
      // presentation 对账(09 §14-A2 P0 最小形态 + A8):presentationId=当前 pending 播报句 id,
      // heardNonce=P0 以收据 id 承载(完整 nonce/digest 随 P0.5-A);pending 不在/被 barge-in 作废/锚不符一律拒——
      // Brain 无法伪造它没听到的呈现(nonce 失配即拒,A2/A8)
      const pending = deps.confirm.pending(ctx.sessionId);
      if (!pending || pending.payload.kind !== "runtime_effect" || pending.receiptId !== approvalId) {
        return toolError("no_matching_presentation", "没有对应的待裁决审批呈现(用语音词表答复,或屏幕审批页)");
      }
      if (pending.sentenceId !== String(a["presentationId"] ?? "") || String(a["heardNonce"] ?? "") !== pending.receiptId) {
        return toolError("presentation_mismatch", "呈现锚不符(可能已被打断作废),重新听一遍播报再裁决");
      }
      const gate = deps.confirm.presentations.canConsumeByBareYes(ctx.sessionId, pending.receiptId);
      if (!gate.ok) return toolError("presentation_invalidated", "播报被打断作废,须重播后再裁决(A8)");
      const r = flow.decide(approvalId, decision, { via: "voice", sessionId: ctx.sessionId, turnId: ctx.turnId });
      if (!r.ok) return toolError("decide_failed", r.reason ?? "收据已终局");
      deps.confirm.withdraw(ctx.sessionId, approvalId);
      return { ok: true, decision };
    }
  );

  reg.register(
    {
      name: "requestManualMerge",
      description: "批准后请求人工合并交接(S3 无语音路径;导航用户去受信终端合并)",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["taskId"],
        properties: { taskId: { type: "string" } }
      }
    },
    (args) => {
      // W2 迟到评审 A1 回收:S3 合并链动作与 HTTP via 门同一红线——tailnet console 在连即拒
      // (语音输入无法逐帧绑定终端,P0 保守:宁误拒,话术引导回桌面;审计留痕)
      if (deps.tailnetConsolePresent?.()) {
        deps.audit.record({ actor: "owner", action: "t2.s3_action_rejected", meta: { attempted: "requestManualMerge", via: "tailnet_voice" } });
        return toolError("s3_requires_trusted_terminal", "合并属于 S3 操作,手机连着的时候语音不放行——回到桌面屏幕完成。");
      }
      const a = (args ?? {}) as Record<string, unknown>;
      return requestManualMerge(deps.db, deps.audit, String(a["taskId"] ?? ""));
    }
  );

  reg.register(
    {
      name: "remember",
      description:
        "记一条用户亲述/确认的事实(偏好类必须先问过用户记不记);来源锚系统自取当前对话轮。" +
        "用户亲口给出某就绪清单项时带 readinessKey(候选绑定,之后经 confirmReadiness 复述确认才算覆盖;绝不给用户没说过的内容标 key)",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["tier", "claim", "trust"],
        properties: {
          projectId: { type: "string" },
          tier: { type: "string", enum: ["M0", "M1", "M2", "M3"] },
          claim: { type: "string" },
          trust: { type: "string", enum: ["user_stated", "user_approved"] },
          readinessKey: { type: "string" }
        }
      }
    },
    (args, ctx) => {
      const a = (args ?? {}) as Record<string, unknown>;
      const trust = a["trust"];
      if (trust !== "user_stated" && trust !== "user_approved") {
        return toolError("invalid_trust", "remember 只接受 user_stated/user_approved(09 §13)");
      }
      const readinessKey = typeof a["readinessKey"] === "string" && a["readinessKey"] !== "" ? a["readinessKey"] : undefined;
      let projectId = typeof a["projectId"] === "string" ? (a["projectId"] as string) : undefined;
      let boundTurnText: string | undefined;
      if (readinessKey !== undefined) {
        // A3-armed 来源完整性四闸(09 §13 covered 块;fail-closed,违任一拒整次 remember)——
        // 注意命名纪律:这是完整性闸不是人背书证明,candidate 不算覆盖(升格 = confirmReadiness 确认环)
        // 闸③:候选一律 user_stated(user_approved 只能由确认环产生,Brain 不可自报)
        if (trust !== "user_stated") {
          return toolError("readiness_key_trust", "就绪候选只能 user_stated——确认升格由复述确认环产生,不是 remember 参数(09 §13)");
        }
        // 闸④:projectId 由会话锚定项目自取(忽略 Brain 自报——防跨项目污染/失配)
        const ses = deps.sessions.ensureSession(ctx.sessionId);
        const sesProject = ses.session.projectId;
        if (!sesProject) return toolError("readiness_key_no_project", "会话没锚定项目,就绪绑定记不了");
        projectId = sesProject;
        // 闸①:key ∈ 会话项目类型的清单词表(词表外/类型不符拒;pending 用 pending 最小清单)
        const row = deps.db.prepare("SELECT type FROM projects WHERE id = ?").get(projectId) as { type: ProjectType } | undefined;
        const keys = row ? readinessKeysOf(row.type) : null;
        if (!keys || !keys.includes(readinessKey)) {
          return toolError("readiness_key_invalid", `「${readinessKey}」不在当前项目类型的就绪清单里,不能标注(09 §13 四闸)`);
        }
        // 闸②:当前轮存在可回读的用户转写(speaker=user ∧ heard;锚可回读是绑定前提)
        const turn = deps.sessions.findUserTurn(ctx.sessionId, ctx.turnId);
        if (!turn) return toolError("readiness_key_turn_missing", "当前轮没有可回读的用户转写,就绪候选记不了(09 §13 四闸)");
        boundTurnText = turn.text;
      }
      const ev = deps.ledger.add({
        tier: a["tier"] as "M0" | "M1" | "M2" | "M3",
        ...(projectId !== undefined ? { projectId } : {}),
        claim: String(a["claim"] ?? ""),
        // source daemon 自取(溯源锚 = 当前转写轮;不信 Brain 报——防伪造 SourceRef)。
        // ref 形状 = 裸 turnId(09 §4 SourceRef 现文;W1.8 统一)——"transcript:<sid>#<tid>" 是
        // §4.1 snapshotLocator(快照器捕获时产出),写进 ref 会让快照回读永 miss(Codex 18 A-2)
        source: { kind: "user_utterance", ref: ctx.turnId },
        requestedTrust: trust,
        ...(readinessKey !== undefined ? { readinessKey } : {})
      });
      if (readinessKey !== undefined && boundTurnText !== undefined) {
        // 审计带该轮转写 digest(Codex 23 A-2 增强:抽查回读可机械化;正文不入 audit——隐私纪律)
        deps.audit.record({
          actor: "daemon",
          action: "memory.readiness_key_bound",
          meta: { memId: ev.id, key: readinessKey, projectId, sessionId: ctx.sessionId, turnId: ctx.turnId, turnTextDigest: claimDigestOf(boundTurnText) }
        });
      }
      return { memId: ev.id };
    }
  );

  reg.register(
    {
      name: "forget",
      description:
        "用户亲口说'这条忘了/别记了/作废'时调用:两阶段遗忘的第一步(标记失效,投影即刻退场;彻底清除走屏幕)。" +
        "该事实若支撑就绪项,对应就绪覆盖同步失效(已出的提议会作废重提)",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["memId"],
        properties: { memId: { type: "string" } }
      }
    },
    (args, ctx) => {
      // A3-armed 走查补齐(M3):09 §13 forget 合同的 live 接线——此前语音面"改口"只能同 key 重说,
      // "撤回"无机械通路;绑定撤销传导(covered 回落/已 proposed 包 stale)由现役判定自然承接。
      const a = (args ?? {}) as Record<string, unknown>;
      const memId = String(a["memId"] ?? "");
      const ev = getMemoryEvent(deps.db, memId);
      if (!ev || (ev.op !== "add" && ev.op !== "correct")) {
        return toolError("mem_not_found", "没找到这条记忆(或它不是可遗忘的事实条目)");
      }
      // affected = 因此失效的现役就绪绑定(用户可听到哪些就绪项被撤销)
      const affected = (
        deps.db
          .prepare("SELECT id, key FROM readiness_bindings WHERE mem_id = ? AND superseded_at IS NULL")
          .all(memId) as { id: string; key: string }[]
      ).map((b) => b.id);
      deps.ledger.invalidate("forget_soft", [memId], "user requested forget (voice)", ev.tier, ev.projectId);
      deps.audit.record({
        actor: "owner",
        action: "memory.forget_marked",
        meta: { memId, sessionId: ctx.sessionId, turnId: ctx.turnId, affectedBindings: affected }
      });
      return { state: "marked", affected };
    }
  );

  reg.register(
    {
      name: "confirmReadiness",
      description:
        "就绪复述确认环(09 §13/10 #41):把已记录的就绪候选逐条复述给用户核对——用户确认后才算覆盖。" +
        "采访把该问的问完、remember 都记了之后调用;复述文本由系统机械生成,不要自己复述",
      parameters: { type: "object", additionalProperties: false, properties: {} }
    },
    (_args, ctx) => {
      const ses = deps.sessions.ensureSession(ctx.sessionId);
      const projectId = ses.session.projectId;
      if (!projectId) return toolError("no_project", "会话没锚定项目,没法确认就绪项");
      const row = deps.db.prepare("SELECT type FROM projects WHERE id = ?").get(projectId) as { type: ProjectType } | undefined;
      if (!row) return toolError("no_project", "项目不存在");
      const candidates = listCandidates({ db: deps.db, ledger: deps.ledger }, projectId, row.type);
      if (candidates.length === 0) {
        return toolError("no_candidates", "没有待确认的就绪项——先采访、用 remember 带 readinessKey 记录,再发起确认");
      }
      const prompt = renderReadinessChecklist(candidates);
      const receiptId = newId("rrc");
      const sentenceId = `s-readiness-${ctx.turnId}`;
      // 单 pending 不变量(10 §2.5):有别的确认在等 ⇒ 拒(一次只裁决一件事)
      if (deps.confirm.pending(ctx.sessionId)) {
        return toolError("confirm_busy", "现在有别的确认在等用户答复,先裁决那件再发起就绪确认");
      }
      deps.audit.record({
        actor: "daemon",
        action: "readiness.confirm_presented",
        meta: { sessionId: ctx.sessionId, turnId: ctx.turnId, projectId, receiptId, keys: candidates.map((c) => c.key) }
      });
      const enqueued = deps.say(ctx.sessionId, sentenceId, prompt, {
        turnId: ctx.turnId,
        origin: "confirmation"
      });
      if (enqueued === false) return toolError("tts_unavailable", "就绪确认句没有呈现到在线语音或本会话控制台");
      const ok = deps.confirm.tryPresent(ctx.sessionId, {
        receiptId,
        sentenceId,
        promptText: prompt,
        payload: { kind: "readiness", projectId, candidates }
      });
      if (!ok) return toolError("confirm_busy", "确认状态发生竞争,本轮未登记就绪确认");
      return {
        presented: candidates.map((c) => ({ key: c.key, label: c.label, claim: c.claim })),
        control: "await_user"
      };
    }
  );

  reg.register(
    {
      name: "addHotword",
      description: "误听纠正写 M0 热词(下轮识别偏置生效);term=误听词,canonical=正确词",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["term", "canonical"],
        properties: { term: { type: "string" }, canonical: { type: "string" } }
      }
    },
    (args, ctx) => {
      const a = (args ?? {}) as Record<string, unknown>;
      // sourceRef 进 SourceRef.ref:裸 turnId(09 §4;W1.8 与 remember 同口径)
      deps.hotwords.add(String(a["term"] ?? ""), String(a["canonical"] ?? ""), ctx.turnId);
      deps.onHotwordsChanged?.();
      return { ok: true };
    }
  );

  // 当前轮用户原文(suspendSession 词法门与下方双速直通 isUserExplicit 共用)
  const turnTextOf = (sessionId: string, turnId: string): string =>
    deps.currentTurnText ? deps.currentTurnText(sessionId, turnId) : "";

  // F26(义骁拍板方案 A):锚定项目内只读——workspace 解析共用;每轮预算防上下文爆炸
  const repoReadBudget = new Map<string, number>();
  const REPO_READS_PER_TURN = 8;
  const workspaceOf = (sessionId: string): { ok: true; ws: string } | { ok: false; err: ReturnType<typeof toolError> } => {
    const sess = getSession(deps.db, sessionId);
    if (!sess?.projectId) return { ok: false, err: toolError("no_project", "当前会话未锚定项目;请用户给出项目路径先锚定") };
    const ws = verifiedProjectWorkspace(deps.db, sess.projectId);
    if (!ws) return { ok: false, err: toolError("no_workspace", "该项目没有已核验的本地 workspace 路径,读不了文件") };
    return { ok: true, ws };
  };
  const takeRepoBudget = (turnId: string): boolean => {
    if (repoReadBudget.size > 500) repoReadBudget.clear();
    const used = repoReadBudget.get(turnId) ?? 0;
    if (used >= REPO_READS_PER_TURN) return false;
    repoReadBudget.set(turnId, used + 1);
    return true;
  };

  reg.register(
    {
      name: "listProjectDir",
      description:
        "列出锚定项目 workspace 内某目录(只读;path 为仓内相对路径,空=根)。用于了解项目结构;.git/node_modules 等恒过滤。",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: { path: { type: "string" } }
      }
    },
    (args, ctx) => {
      const w = workspaceOf(ctx.sessionId);
      if (!w.ok) return w.err;
      if (!takeRepoBudget(ctx.turnId)) return toolError("read_budget_exhausted", "本轮读取次数已用完;先基于已读内容回答,需要更多下一轮再读");
      const rel = String((args as Record<string, unknown> | null)?.["path"] ?? "");
      const r = listRepoDir(w.ws, rel);
      deps.audit.record({
        actor: "daemon",
        action: "tool.listProjectDir",
        meta: { sessionId: ctx.sessionId, path: rel.slice(0, 200), ok: r.ok }
      });
      if (!r.ok) return toolError(r.code, r.message);
      return r;
    }
  );

  reg.register(
    {
      name: "readProjectFile",
      description:
        "读取锚定项目 workspace 内单个文件(只读;path 为仓内相对路径)。回答项目相关问题前优先读 README/入口文件,再按需深入;超 400 行/16KB 会截断,细节多时用 openOnScreen 给用户看。敏感文件(.env/密钥)恒拒。",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["path"],
        properties: { path: { type: "string" } }
      }
    },
    (args, ctx) => {
      const w = workspaceOf(ctx.sessionId);
      if (!w.ok) return w.err;
      if (!takeRepoBudget(ctx.turnId)) return toolError("read_budget_exhausted", "本轮读取次数已用完;先基于已读内容回答,需要更多下一轮再读");
      const rel = String((args as Record<string, unknown> | null)?.["path"] ?? "");
      if (!rel) return toolError("path_required", "path required");
      const r = readRepoFile(w.ws, rel);
      deps.audit.record({
        actor: "daemon",
        action: "tool.readProjectFile",
        meta: { sessionId: ctx.sessionId, path: rel.slice(0, 200), ok: r.ok, ...(r.ok ? { bytes: r.totalBytes, truncated: r.truncated } : {}) }
      });
      if (!r.ok) return toolError(r.code, r.message);
      return r;
    }
  );

  reg.register(
    {
      name: "suspendSession",
      description:
        "仅当用户本人明确表达结束意图(先到这里/先这样/过会儿再说/收工)时挂起会话(收尾语系统播)。锚定完成、记账/销账完成、任务派发完成、工具返回 done:true 都不是结束信号——完成动作后继续对话等用户下一句,绝不自发收场。",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["reason"],
        properties: { reason: { type: "string" } }
      }
    },
    (args, ctx) => {
      // F24 词法门(2026-08-04 任务3 dogfood 抓出:直通锚定后 Brain 把"锚完"当"办完"自发收场挂起)——
      // 当前轮用户原文无结束意图词即拒,机械兜底 instructions 约束(结束词表与 dialog 撤下环单源);
      // 全句短肯定应答放行:承接 Brain 自己问出的"先到这里吗?"确认轮(F05 肯定词统一时收编本地词表)
      const suspendTurnText = turnTextOf(ctx.sessionId, ctx.turnId);
      const isShortAssent = /^(好的?|对|是的?|嗯+|可以|行)[。.!!~]?$/.test(suspendTurnText.trim());
      if (!SESSION_END_INTENT_RE.test(suspendTurnText) && !isShortAssent) {
        return toolError(
          "no_end_intent",
          "本轮用户没有明确表达结束意图,不挂起。继续对话等用户下一句;若你判断用户确想结束,先问一句确认(如'今天先到这里吗?')"
        );
      }
      // C1:显式挂起走 beforeSuspend 门(stage≥1 收场在转态前)
      deps.sessions.suspend(ctx.sessionId, "explicit");
      deps.audit.record({
        actor: "daemon",
        action: "tool.suspendSession",
        meta: { sessionId: ctx.sessionId, reason: String((args as Record<string, unknown> | null)?.["reason"] ?? "") }
      });
      return { ok: true };
    }
  );

  reg.register(
    {
      name: "assessReadiness",
      description: "每轮末调用:就绪评估(独立于你;评估未通过不得提议开始)。P0 规则层",
      parameters: { type: "object", additionalProperties: false, properties: {} }
    },
    async (_args, ctx) => {
      // readinessSkeleton 单源(Codex 21 A3;A3-armed 段3):与 proposeStart 同一 skeletonGate——
      // 消费点同源(mock 任一处 ⇒ 测试红);骨架 rules 层出双维缺口分诊,fail-closed 四况恒 gap_critical。
      // 旧"未 armed 回落 + ready,dims:[] 空回退"路径已删(Codex 22 ④):未注入 = 况② gap_critical。
      const sess = getSession(deps.db, ctx.sessionId);
      if (!sess) return toolError("session_not_found", "session not found");
      const sk = skeletonGate(deps, ctx.sessionId, sess.projectId);
      // 分层执行(04 §2.2):骨架非 blocking(可能就绪)才触发异族深评抽查(W1.4 管道;调用律 §11 规则 6)
      if (!isReadinessBlocking(sk.verdict)) {
        const deep = await maybeDeepAssess(deps, ctx.sessionId, "maybe_ready", ctx.assertCurrent, ctx.signal);
        ctx.assertCurrent?.();
        if (deep.kind === "evaluated") {
          return { verdict: deep.verdict, dims: sk.dims, blockingCriticals: deep.blockingCriticals, layer: "deep" };
        }
      }
      return { verdict: sk.verdict, dims: sk.dims, blockingCriticals: sk.blockingCriticals, layer: "rules" };
    }
  );

  // C3:stage≥1 才注册 Focus proposal 工具(stage 0 五项基线 diff 为空)
  const stage: FocusStage =
    typeof deps.focusStage === "function" ? deps.focusStage() : (deps.focusStage ?? 0);
  // 双速直通(义骁 2026-08-04 拍板):用户主动明确指令零确认直通(撤销兜底);AI 提议走 5 秒倒计时确认环
  const isUserExplicit = (tool: "anchor" | "create" | "obligation" | "resolve", turnText: string): boolean => {
    if (!turnText) return false;
    if (tool === "anchor") return /锚定|锚到|锚回|切到.*[Ff]ocus|关注点/.test(turnText);
    if (tool === "create") return /(新建|立一个|开一个|建一个).{0,12}([Ff]ocus|关注点)|([Ff]ocus|关注点).{0,8}(新建|立|开)/.test(turnText);
    if (tool === "obligation") return /记(一笔|上|在).{0,16}(账|义务)|挂(一笔|上).{0,10}(账|义务)|(是你|你)欠我/.test(turnText);
    if (tool === "resolve") return /销账|做完了|完成了|办完了|清账/.test(turnText);
    return false;
  };
  const COUNTDOWN_MS = 5000;
  // F25(义骁产品裁决):倒计时确认语音只念提议核心,操作说明不念——按钮/倒计时在 console 确认卡;
  // 此前双层拼接(countdown 说明 + buildConfirmPrompt 等待式尾巴)自相矛盾又冗长
  const countdownPrompt = (core: string): string => `我提议:${core}。`;
  /** ④c remainingIntent 工具参数(六确认发起工具共用;Brain 未填时不保证 W-2) */
  const remainingIntentProp = {
    remainingIntent: {
      type: "string",
      description: "用户本轮还提了但你尚未处理的诉求,一句话"
    }
  } as const;
  const pickRemainingIntent = (
    a: Record<string, unknown>,
    turnId: string
  ): { remainingIntent?: string; remainingIntentSourceTurnId?: string } => {
    const t = typeof a["remainingIntent"] === "string" ? a["remainingIntent"].trim() : "";
    if (!t) return {};
    return { remainingIntent: t, remainingIntentSourceTurnId: turnId };
  };
  if (listFocusToolSpecs(stage).length > 0) {
    reg.register(
      {
        name: "proposeFocusAnchor",
        description:
          "提议将当前会话锚定到某个 Focus;系统会走确认环,你不得直接写 Focus 状态。可用 focusId 或 titleQuery(多候选列出让用户选)。",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            focusId: { type: "string" },
            titleQuery: { type: "string" },
            ...remainingIntentProp
          }
        }
      },
      (args, ctx) => {
        const a = (args ?? {}) as Record<string, unknown>;
        const focusIdArg = String(a["focusId"] ?? "");
        const titleQuery = String(a["titleQuery"] ?? "");
        let focusId = focusIdArg;
        let title = "";
        if (focusId) {
          const r = resolveFocus(deps.db, focusId);
          if (r.kind === "not_found") return toolError("focus_not_found", "Focus 不存在");
          if (r.kind === "closed_or_abandoned") return toolError("focus_terminal", "Focus 已关闭或放弃");
          if (r.kind === "authority_mismatch") return toolError("authority_mismatch", "Focus 权威不匹配");
          title = r.focus.title;
        } else if (titleQuery) {
          const cands = listFocusCandidatesByTitle(deps.db, titleQuery);
          if (cands.length === 0) {
            // F02:零候选不再死路——提议"新建并锚定"(经确认环,消费端 createFocus+startActivation)
            const turnTextC = turnTextOf(ctx.sessionId, ctx.turnId);
            if (isUserExplicit("create", turnTextC) || isUserExplicit("anchor", turnTextC)) {
              const created = createFocusRegistry(deps.db, { title: titleQuery, actorKind: "user", sessionId: ctx.sessionId });
              const sw = switchAnchorActivation(deps.db, ctx.sessionId, created.focusId, "user_explicit");
              recordUndo(ctx.sessionId, { kind: "create_anchor", focusId: created.focusId, title: titleQuery, prevFocusId: sw.prevFocusId, at: Date.now() });
              deps.say(
                ctx.sessionId,
                `s-focus-create-direct-${ctx.turnId}`,
                `已新建 Focus「${titleQuery}」并把会话锚上去了(focus:${created.focusId})。说"撤销"可撤回。`,
                { turnId: ctx.turnId, origin: "system" }
              );
              emitFocusEntitySafe(deps.emitFocusEntity, null, ctx.sessionId, {
                kind: "接上",
                title: titleQuery,
                sub: "新建 Focus 并接上",
                color: "act"
              });
              // F27:水位随返回值给 Brain——新建恒 fresh,配合 delta 摸底条款先要背景
              return { ok: true, focusId: created.focusId, done: true, revision: 0, openObligations: 0, focusFresh: true };
            }
            const sess0 = getSession(deps.db, ctx.sessionId);
            if (!sess0) return toolError("session_not_found", "session not found");
            const anchorRow0 = deps.db
              .prepare("SELECT focus_anchor_revision FROM sessions WHERE id = ?")
              .get(ctx.sessionId) as { focus_anchor_revision: number } | undefined;
            if (deps.confirm.pending(ctx.sessionId)) {
              return toolError("confirmation_busy", "当前会话还有另一项确认");
            }
            const receiptId0 = newId("apr");
            const prompt0 = countdownPrompt(`新建 Focus「${titleQuery}」,把这场对话接上去`);
            const sid0 = `s-focus-create-${receiptId0}`;
            if (deps.say(ctx.sessionId, sid0, prompt0, { turnId: ctx.turnId, origin: "confirmation" }) === false) {
              return toolError("tts_unavailable", "确认句未呈现到在线语音或本会话控制台");
            }
            const p0 = deps.confirm.tryPresent(ctx.sessionId, {
              receiptId: receiptId0,
              sentenceId: sid0,
              promptText: prompt0,
              payload: {
                kind: "focus_create_anchor",
                title: titleQuery,
                expectedAnchorRevision: anchorRow0?.focus_anchor_revision ?? 0
              },
              ...pickRemainingIntent(a, ctx.turnId)
            });
            if (!p0) return toolError("confirmation_busy", "语音确认改走屏幕");
            deps.scheduleAutoAccept?.(ctx.sessionId, receiptId0, COUNTDOWN_MS);
            return { ok: true, receiptId: receiptId0, proposedCreateTitle: titleQuery, confirmationPresented: true, control: "await_user" };
          }
          if (cands.length > 1) {
            return {
              ok: false,
              code: "focus_ambiguous",
              message: "多个候选,请用户选择或转 console",
              retryable: false,
              candidates: cands
            };
          }
          focusId = cands[0]!.id;
          title = cands[0]!.title;
        } else {
          return toolError("focus_args", "需要 focusId 或 titleQuery");
        }
        const turnTextA = turnTextOf(ctx.sessionId, ctx.turnId);
        if (isUserExplicit("anchor", turnTextA)) {
          // 双速直通:用户明确锚定指令零确认执行,撤销兜底
          const sw = switchAnchorActivation(deps.db, ctx.sessionId, focusId, "user_explicit");
          recordUndo(ctx.sessionId, { kind: "anchor", focusId, prevFocusId: sw.prevFocusId, at: Date.now() });
          deps.say(
            ctx.sessionId,
            `s-focus-anchor-direct-${ctx.turnId}`,
            sw.already ? `本来就锚在「${title}」上。` : `已锚定到「${title}」(focus:${focusId})。说"撤销"可撤回。`,
            { turnId: ctx.turnId, origin: "system" }
          );
          if (!sw.already) {
            emitFocusEntitySafe(deps.emitFocusEntity, null, ctx.sessionId, {
              kind: "接上",
              title,
              sub: "会话接到 Focus",
              color: "act"
            });
          }
          // F27:水位随返回值给 Brain(fresh=零 revision 零义务,delta 摸底条款生效)
          const rAfter = resolveFocus(deps.db, focusId);
          const obsAfter = listOpenObligations(deps.db, focusId);
          const rev = rAfter.kind === "found" ? rAfter.focus.currentRevision : 0;
          return {
            ok: true,
            focusId,
            done: true,
            revision: rev,
            openObligations: obsAfter.length,
            focusFresh: rev === 0 && obsAfter.length === 0
          };
        }
        const sess = getSession(deps.db, ctx.sessionId);
        if (!sess) return toolError("session_not_found", "session not found");
        const anchorRow = deps.db
          .prepare("SELECT focus_anchor_revision FROM sessions WHERE id = ?")
          .get(ctx.sessionId) as { focus_anchor_revision: number } | undefined;
        const expectedAnchorRevision = anchorRow?.focus_anchor_revision ?? 0;
        if (deps.confirm.pending(ctx.sessionId)) {
          return toolError("confirmation_busy", "当前会话还有另一项确认");
        }
        const receiptId = newId("apr");
        const promptText = countdownPrompt(`把这场对话接到「${title}」上`);
        const sentenceId = `s-focus-anchor-${receiptId}`;
        const enqueued = deps.say(ctx.sessionId, sentenceId, promptText, {
          turnId: ctx.turnId,
          origin: "confirmation"
        });
        if (enqueued === false) return toolError("tts_unavailable", "确认句未呈现到在线语音或本会话控制台");
        const presented = deps.confirm.tryPresent(ctx.sessionId, {
          receiptId,
          sentenceId,
          promptText,
          payload: {
            kind: "focus_anchor",
            focusId,
            expectedAnchorRevision,
            title,
            trigger: "user_explicit"
          },
          ...pickRemainingIntent(a, ctx.turnId)
        });
        if (!presented) return toolError("confirmation_busy", "语音确认改走屏幕");
        deps.scheduleAutoAccept?.(ctx.sessionId, receiptId, COUNTDOWN_MS);
        return { ok: true, receiptId, focusId, confirmationPresented: true, control: "await_user" };
      }
    );

    reg.register(
      {
        name: "proposeObligationResolve",
        description:
          "用户说某笔义务完成/不需要了时调用本工具销账(经确认环)。不要用 proposeFocusRevision 的叙事文本代替销账——账本以本工具为准。owner=agent 且 resolution=done 时必须提供 evidence(artifact/task/event 三选一)。",
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["titleQuery"],
          properties: {
            titleQuery: { type: "string" },
            resolution: { type: "string", enum: ["done", "abandoned", "no_longer_applicable"] },
            evidence: {
              type: "object",
              description:
                "④e A7:agent 义务 done 时必填。{type:'artifact',id,version,digest?} | {type:'task',id,attempt} | {type:'event',focusId,seq}",
              properties: {
                type: { type: "string", enum: ["artifact", "task", "event"] },
                id: { type: "string" },
                version: { type: "number" },
                digest: { type: "string" },
                attempt: { type: "number" },
                focusId: { type: "string" },
                seq: { type: "number" }
              }
            },
            ...remainingIntentProp
          }
        }
      },
      (args, ctx) => {
        const a = (args ?? {}) as Record<string, unknown>;
        const sess = deps.db
          .prepare("SELECT primary_focus_id FROM sessions WHERE id = ?")
          .get(ctx.sessionId) as { primary_focus_id: string | null } | undefined;
        const focusId = sess?.primary_focus_id ?? "";
        if (!focusId) return toolError("focus_args", "当前会话未锚定 Focus");
        ensureActiveActivationForSession(deps.db, ctx.sessionId, focusId);
        const tq = String(a["titleQuery"] ?? "");
        if (!tq) return toolError("focus_args", "需要 titleQuery");
        const open = listOpenObligations(deps.db, focusId).filter((o) => o.title.includes(tq));
        if (open.length === 0) return toolError("obligation_not_found", `账上没有匹配「${tq}」的事`);
        if (open.length > 1)
          return toolError("obligation_ambiguous", "多笔匹配:" + open.map((o) => o.title).join(" / "));
        const ob = open[0]!;
        const resolution = (String(a["resolution"] ?? "done") || "done") as "done" | "abandoned" | "no_longer_applicable";
        if (ob.verification === "unverified" && resolution === "done")
          return toolError("verification_required", "该义务标记为 unverified,不能直接判 done;先核验或改用 abandoned/no_longer_applicable");
        // ④e A7:解析 evidence(写门最终裁决;工具层先做缺省提示)
        const rawEv = a["evidence"];
        let evidence: ObligationResolveEvidence | undefined;
        if (rawEv && typeof rawEv === "object") {
          try {
            evidence = obligationResolveEvidenceSchema.parse(rawEv);
          } catch {
            return toolError("evidence_invalid", "evidence 结构不合法(须 artifact|task|event 判别联合)");
          }
        }
        if (ob.owner === "agent" && resolution === "done" && !evidence) {
          return toolError(
            "evidence_required",
            "归你办的义务要先交付再销账:提供 evidence(artifact/task/event),或改用 abandoned/no_longer_applicable"
          );
        }
        const turnTextR = turnTextOf(ctx.sessionId, ctx.turnId);
        const resWord = resolution === "done" ? "完成" : resolution === "abandoned" ? "放弃" : "不再适用";
        if (isUserExplicit("resolve", turnTextR)) {
          try {
            upsertObligationDirect(deps.db, focusId, {
              kind: ob.kind, title: ob.title, owner: ob.owner, status: "resolved",
              verification: ob.verification, dedupeKey: ob.dedupeKey, resolution,
              actorKind: "user", sessionId: ctx.sessionId,
              ...(evidence ? { evidence } : {})
            });
          } catch (e) {
            const code = e instanceof Error && "code" in e ? String((e as { code: string }).code) : "resolve_failed";
            const msg = e instanceof Error ? e.message : String(e);
            return toolError(code, msg.slice(0, 160));
          }
          recordUndo(ctx.sessionId, { kind: "obligation_resolve", focusId, dedupeKey: ob.dedupeKey, obKind: ob.kind, title: ob.title, owner: ob.owner, at: Date.now() });
          deps.say(
            ctx.sessionId,
            `s-focus-obres-direct-${ctx.turnId}`,
            `「${ob.title}」按「${resWord}」办结了。说"撤销"可撤回。`,
            { turnId: ctx.turnId, origin: "system" }
          );
          emitFocusEntitySafe(deps.emitFocusEntity, null, ctx.sessionId, {
            kind: "办结",
            title: ob.title,
            sub: resolutionSub(resolution),
            color: "act"
          });
          return { ok: true, focusId, obligationId: ob.id, done: true };
        }
        if (deps.confirm.pending(ctx.sessionId)) {
          return toolError("confirmation_busy", "当前会话还有另一项确认");
        }
        const receiptId = newId("apr");
        const promptText = countdownPrompt(`把「${ob.title}」按「${resWord}」办结`);
        const sentenceId = `s-focus-obres-${receiptId}`;
        if (deps.say(ctx.sessionId, sentenceId, promptText, { turnId: ctx.turnId, origin: "confirmation" }) === false) {
          return toolError("tts_unavailable", "确认句未呈现到在线语音或本会话控制台");
        }
        const presented = deps.confirm.tryPresent(ctx.sessionId, {
          receiptId,
          sentenceId,
          promptText,
          payload: {
            kind: "focus_obligation_resolve",
            focusId,
            obligationId: ob.id,
            obligationTitle: ob.title,
            obKind: ob.kind,
            obOwner: ob.owner,
            obVerification: ob.verification,
            obDedupeKey: ob.dedupeKey,
            resolution,
            ...(evidence ? { evidence } : {})
          },
          ...pickRemainingIntent(a, ctx.turnId)
        });
        if (!presented) return toolError("confirmation_busy", "语音确认改走屏幕");
        deps.scheduleAutoAccept?.(ctx.sessionId, receiptId, COUNTDOWN_MS);
        return { ok: true, receiptId, obligationId: ob.id, confirmationPresented: true, control: "await_user" };
      }
    );
    reg.register(
      {
        name: "getFocusStatus",
        description: "读取 Focus 当前状态:lifecycle/revision/未结义务清单。回答用户\"什么状态/欠什么\"前必须先调用本工具,并以返回的 statusText 为准转述,不得凭对话记忆编造。",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: { focusId: { type: "string" }, titleQuery: { type: "string" } }
        }
      },
      (args, ctx) => {
        const a = (args ?? {}) as Record<string, unknown>;
        let focusId = String(a["focusId"] ?? "");
        if (!focusId) {
          const sess = deps.db
            .prepare("SELECT primary_focus_id FROM sessions WHERE id = ?")
            .get(ctx.sessionId) as { primary_focus_id: string | null } | undefined;
          focusId = sess?.primary_focus_id ?? "";
        }
        if (!focusId) {
          const tq = String(a["titleQuery"] ?? "");
          if (tq) {
            const cands = listFocusCandidatesByTitle(deps.db, tq);
            if (cands.length === 1) focusId = cands[0]!.id;
            else if (cands.length > 1)
              return toolError("focus_ambiguous", "titleQuery 多候选:" + cands.map((c) => c.title).join(" / "));
          }
        }
        if (!focusId) return toolError("focus_args", "当前会话未锚定 Focus,且未给出 focusId/titleQuery");
        const r = resolveFocus(deps.db, focusId);
        if (r.kind !== "found") return toolError("focus_unavailable", `focus resolve=${r.kind}`);
        const obs = listOpenObligations(deps.db, focusId);
        const fmt = obs.map((o, i) =>
          `${i + 1}) [${o.owner === "human" ? "你的" : o.owner === "agent" ? "我的" : "外部"}] ${o.title}` +
          (o.nextStep ? `(下一步:${o.nextStep})` : "") + `[${o.status}/${o.verification}]`
        );
        const statusText =
          `Focus「${r.focus.title}」:${r.focus.lifecycle},revision ${r.focus.currentRevision};` +
          (obs.length === 0 ? "账上没有挂着的事。" : `账上还有 ${obs.length} 件事:` + fmt.join(";"));
        return {
          ok: true,
          focus: { id: r.focus.id, title: r.focus.title, lifecycle: r.focus.lifecycle, revision: r.focus.currentRevision },
          openObligations: obs.map((o) => ({
            id: o.id, kind: o.kind, owner: o.owner, status: o.status,
            verification: o.verification, title: o.title, nextStep: o.nextStep ?? null, blocking: o.blocking
          })),
          statusText
        };
      }
    );
    reg.register(
      {
        name: "proposeObligation",
        description:
          "提议在当前/指定 Focus 上开一条或多条义务;经确认环后写入。用户说'记下来/记一条/别忘了 X'等显式记账请求时必须当轮调用(不受采访/就绪门约束,随时可用);也用于把对话中达成的决定、约束、待办落账。多条用 obligations 数组(同卡全有或全无)。用户指明了归哪条线就带 laneTitle;说'排在 X 之后'就带 waitingOnTitle;内容是已定死/已做出的决定(约束/结论)则 alreadyDecided=true(记档即结,不再要用户拍板);待办/行动的认领('我来/你来')绝不是已决,不许带此参数。",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            focusId: { type: "string" },
            titleQuery: { type: "string" },
            kind: { type: "string", enum: ["answer", "decision", "action", "followup", "check"] },
            title: { type: "string" },
            detail: { type: "string" },
            owner: { type: "string", enum: ["human", "agent", "external"] },
            nextStep: { type: "string" },
            sourceKey: { type: "string" },
            needs: {
              type: "string",
              enum: ["decision", "input", "action"],
              description: "这件事需要用户什么:decision=拍板选择,input=给信息,action=用户亲自去做"
            },
            laneTitle: {
              type: "string",
              description: "归入哪条线(线标题,模糊匹配;当前 Focus 已有线且用户点名/语义明确归属时必带)"
            },
            waitingOnTitle: {
              type: "string",
              description: "排在哪件事之后(前置义务标题,模糊匹配;'X 完成了才做'语义时必带)"
            },
            alreadyDecided: {
              type: "boolean",
              description: "内容是用户已定死/已做出的决定 ⇒ true:记档后立即按完成销账,不进「今天需要你」,绝不再要用户拍板"
            },
            obligations: {
              type: "array",
              description: "批量落账:多条义务一卡确认,同事务全有或全无",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["kind", "title", "owner"],
                properties: {
                  kind: { type: "string", enum: ["answer", "decision", "action", "followup", "check"] },
                  title: { type: "string" },
                  detail: { type: "string" },
                  owner: { type: "string", enum: ["human", "agent", "external"] },
                  nextStep: { type: "string" },
                  sourceKey: { type: "string" },
                  needs: { type: "string", enum: ["decision", "input", "action"] },
                  laneTitle: { type: "string" },
                  waitingOnTitle: { type: "string" },
                  alreadyDecided: { type: "boolean" }
                }
              }
            },
            ...remainingIntentProp
          }
        }
      },
      (args, ctx) => {
        const a = (args ?? {}) as Record<string, unknown>;
        // E2 热修:focusId 或 titleQuery 二选一(anchor 确认结果未回流 Brain,只有标题时也要能记账)
        let focusId = String(a["focusId"] ?? "");
        if (!focusId) {
          const tq = String(a["titleQuery"] ?? "");
          if (tq) {
            const cands = listFocusCandidatesByTitle(deps.db, tq);
            if (cands.length === 0) return toolError("focus_unavailable", `titleQuery 无匹配:${tq}`);
            if (cands.length > 1)
              return toolError("focus_ambiguous", `titleQuery 多候选(${cands.length}),请给 focusId:` + cands.map((c) => c.title).join(" / "));
            focusId = cands[0]!.id;
          } else {
            // M3(8/6 走查:模型每次记账连撞两次墙才蒙对)——与 proposeLaneSplit 同款兜底:缺省=会话锚定 Focus
            const sessRow = deps.db
              .prepare("SELECT primary_focus_id FROM sessions WHERE id = ?")
              .get(ctx.sessionId) as { primary_focus_id: string | null } | undefined;
            focusId = sessRow?.primary_focus_id ?? "";
            if (!focusId)
              return toolError(
                "focus_args",
                "会话还没接上任何 Focus——本轮先调 proposeFocusAnchor(title=这摊事的名字,如「爸妈来访准备」)建一个接上,然后立刻重试本次操作;绝不放弃、绝不改用 remember"
              );
          }
        }
        const r = resolveFocus(deps.db, focusId);
        if (r.kind !== "found") return toolError("focus_unavailable", `focus resolve=${r.kind}`);
        // E2 热修:收场关闭 activation 后恢复对话的自愈重建(死循环根修之一)
        ensureActiveActivationForSession(deps.db, ctx.sessionId, focusId);

        type RawOb = Record<string, unknown>;
        const rawBatch = Array.isArray(a["obligations"]) ? (a["obligations"] as RawOb[]) : null;
        const rawItems: RawOb[] =
          rawBatch && rawBatch.length > 0
            ? rawBatch
            : [
                {
                  kind: a["kind"],
                  title: a["title"],
                  detail: a["detail"],
                  owner: a["owner"],
                  nextStep: a["nextStep"],
                  sourceKey: a["sourceKey"],
                  needs: a["needs"],
                  laneTitle: a["laneTitle"],
                  waitingOnTitle: a["waitingOnTitle"],
                  alreadyDecided: a["alreadyDecided"]
                }
              ];

        const resolveLaneId = (laneTitleQ: string): { ok: true; laneId?: string } | { ok: false; error: ReturnType<typeof toolError> } => {
          if (!laneTitleQ) return { ok: true };
          const lanesAll = deps.db
            .prepare("SELECT id, title FROM focus_lanes WHERE focus_id = ? AND retired_at IS NULL")
            .all(focusId) as Array<{ id: string; title: string }>;
          const hits = lanesAll.filter((l) => l.title.includes(laneTitleQ) || laneTitleQ.includes(l.title));
          if (hits.length === 1) return { ok: true, laneId: hits[0]!.id };
          return {
            ok: false,
            error: toolError(
              "lane_title",
              hits.length === 0
                ? `「${laneTitleQ}」无匹配线;现有线:${lanesAll.map((l) => l.title).join(" / ") || "(无)"}`
                : `「${laneTitleQ}」命中 ${hits.length} 条线,请说全名`
            )
          };
        };
        const resolveWait = (
          waitTitleQ: string
        ):
          | { ok: true; waitingOnObligationId?: string; waitingOnText?: string }
          | { ok: false; error: ReturnType<typeof toolError> } => {
          if (!waitTitleQ) return { ok: true };
          const obsOpen = deps.db
            .prepare(
              "SELECT id, title FROM focus_obligations WHERE focus_id = ? AND status IN ('open','in_progress','waiting','deferred','blocked')"
            )
            .all(focusId) as Array<{ id: string; title: string }>;
          const hits = obsOpen.filter((o) => o.title.includes(waitTitleQ) || waitTitleQ.includes(o.title));
          if (hits.length === 1)
            return { ok: true, waitingOnObligationId: hits[0]!.id, waitingOnText: hits[0]!.title };
          return {
            ok: false,
            error: toolError(
              "waiting_on_title",
              hits.length === 0 ? `「${waitTitleQ}」无匹配的未结义务` : `「${waitTitleQ}」命中 ${hits.length} 条,请说全名`
            )
          };
        };

        const built: Array<{
          kind: "answer" | "decision" | "action" | "followup" | "check";
          title: string;
          detail?: string;
          owner: "human" | "agent" | "external";
          dedupeKey: string;
          nextStep?: string;
          needs?: "decision" | "input" | "action";
          laneId?: string;
          waitingOnObligationId?: string;
          waitingOn?: string;
          alreadyDecided?: boolean;
          verification: "confirmed";
        }> = [];
        const seenDedupe = new Set<string>();
        for (let i = 0; i < rawItems.length; i++) {
          const it = rawItems[i]!;
          const kind = String(it["kind"] ?? "action") as "answer" | "decision" | "action" | "followup" | "check";
          const title = String(it["title"] ?? "");
          if (!title) return toolError("title_required", `title required (item ${i})`);
          if (/我提议|记下了|已记下|记档了|说"撤销"|说“撤销”/.test(title) || title.length > 80) {
            return toolError(
              "title_looks_like_speech",
              "title 像播报话术或过长——把事项本身作为 title 重调(如「企业版报价单」,不带'我提议/记下了'字样,80 字内)"
            );
          }
          const owner = String(it["owner"] ?? "human") as "human" | "agent" | "external";
          const needsRaw = it["needs"];
          const needs =
            needsRaw === "decision" || needsRaw === "input" || needsRaw === "action"
              ? (needsRaw as "decision" | "input" | "action")
              : undefined;
          const sourceKey = String(it["sourceKey"] ?? `${ctx.turnId}:${i}`);
          const dedupeKey = buildObligationDedupeKey({ focusId, kind, sourceKey });
          if (seenDedupe.has(dedupeKey))
            return toolError("obligation_dedupe_conflict", `batch 内 dedupeKey 重复:${dedupeKey}`);
          seenDedupe.add(dedupeKey);
          const laneR = resolveLaneId(String(it["laneTitle"] ?? "").trim());
          if (!laneR.ok) return laneR.error;
          const waitR = resolveWait(String(it["waitingOnTitle"] ?? "").trim());
          if (!waitR.ok) return waitR.error;
          const alreadyDecided = it["alreadyDecided"] === true && (kind === "decision" || kind === "answer");
          built.push({
            kind,
            title,
            ...(it["detail"] ? { detail: String(it["detail"]) } : {}),
            owner,
            dedupeKey,
            ...(it["nextStep"] ? { nextStep: String(it["nextStep"]) } : {}),
            ...(needs && !alreadyDecided ? { needs } : {}),
            ...(laneR.laneId ? { laneId: laneR.laneId } : {}),
            ...(waitR.waitingOnObligationId
              ? {
                  waitingOnObligationId: waitR.waitingOnObligationId,
                  ...(waitR.waitingOnText ? { waitingOn: waitR.waitingOnText } : {})
                }
              : {}),
            ...(alreadyDecided ? { alreadyDecided: true } : {}),
            verification: "confirmed"
          });
        }
        if (built.length === 0) return toolError("title_required", "title required");

        const turnTextO = turnTextOf(ctx.sessionId, ctx.turnId);
        // 直通仅单条+显式词表;批量一律走确认环
        if (built.length === 1 && isUserExplicit("obligation", turnTextO)) {
          const ob = built[0]!;
          upsertObligationDirect(deps.db, focusId, {
            kind: ob.kind,
            title: ob.title,
            owner: ob.owner,
            verification: "confirmed",
            dedupeKey: ob.dedupeKey,
            ...(ob.alreadyDecided
              ? { status: "resolved" as const, resolution: "done" as const }
              : ob.waitingOnObligationId
                ? {
                    status: "waiting" as const,
                    waitingOnObligationId: ob.waitingOnObligationId,
                    ...(ob.waitingOn ? { waitingOn: ob.waitingOn } : {})
                  }
                : { status: "open" as const }),
            ...(ob.laneId ? { laneId: ob.laneId } : {}),
            ...(ob.detail ? { detail: ob.detail } : {}),
            ...(ob.nextStep ? { nextStep: ob.nextStep } : {}),
            ...(ob.needs && !ob.alreadyDecided ? { needs: ob.needs } : {}),
            actorKind: "user",
            sessionId: ctx.sessionId
          });
          recordUndo(ctx.sessionId, {
            kind: "obligation_open",
            focusId,
            dedupeKey: ob.dedupeKey,
            obKind: ob.kind,
            title: ob.title,
            owner: ob.owner,
            verification: "confirmed",
            at: Date.now()
          });
          const spokenO = ob.alreadyDecided
            ? `已定的事,记档了:「${ob.title}」——不用你再动。说"撤销"可撤回。`
            : ob.waitingOn
              ? `「${ob.title}」记下了,排在「${ob.waitingOn}」之后——那边落定这边自动开跑。说"撤销"可撤回。`
              : `「${ob.title}」记下了(${ob.owner === "agent" ? "我来办" : ob.owner === "human" ? "归你" : "等外部"})。说"撤销"可撤回。`;
          deps.say(
            ctx.sessionId,
            `s-focus-ob-direct-${ctx.turnId}-${ob.dedupeKey.slice(-6)}`,
            spokenO,
            { turnId: ctx.turnId, origin: "system" }
          );
          emitFocusEntitySafe(deps.emitFocusEntity, null, ctx.sessionId, {
            kind: "记下一件事",
            title: ob.title,
            sub: ob.alreadyDecided
              ? "已定档"
              : ob.waitingOn
                ? `排队等「${ob.waitingOn}」`
                : ownerSub(ob.owner, ob.nextStep),
            color: ob.alreadyDecided ? "gray" : colorForOwner(ob.owner, ob.needs)
          });
          return { ok: true, focusId, dedupeKey: ob.dedupeKey, done: true };
        }
        if (deps.confirm.pending(ctx.sessionId)) {
          return toolError("confirmation_busy", "当前会话还有另一项确认");
        }
        const receiptId = newId("apr");
        const titles = built.map((o) => o.title).join("、");
        const promptText =
          built.length > 1
            ? countdownPrompt(`记下 ${built.length} 条:「${titles}」`)
            : countdownPrompt(
                `记下「${built[0]!.title}」(${built[0]!.owner === "agent" ? "我来办" : built[0]!.owner === "human" ? "归你" : "等外部"})`
              );
        const sentenceId = `s-focus-ob-${receiptId}`;
        const enqueued = deps.say(ctx.sessionId, sentenceId, promptText, {
          turnId: ctx.turnId,
          origin: "confirmation"
        });
        if (enqueued === false) return toolError("tts_unavailable", "确认句未呈现到在线语音或本会话控制台");
        const payload =
          built.length > 1
            ? { kind: "focus_obligation" as const, focusId, obligations: built }
            : { kind: "focus_obligation" as const, focusId, obligation: built[0]! };
        const presented = deps.confirm.tryPresent(ctx.sessionId, {
          receiptId,
          sentenceId,
          promptText,
          payload,
          ...pickRemainingIntent(a, ctx.turnId)
        });
        if (!presented) return toolError("confirmation_busy", "语音确认改走屏幕");
        deps.scheduleAutoAccept?.(ctx.sessionId, receiptId, COUNTDOWN_MS);
        return {
          ok: true,
          receiptId,
          dedupeKey: built.length === 1 ? built[0]!.dedupeKey : built.map((o) => o.dedupeKey),
          confirmationPresented: true,
          control: "await_user"
        };
      }
    );

    reg.register(
      {
        name: "proposeFocusRevision",
        description:
          "提议更新 Focus 的方向(一句话目标);经确认环后写入。方向=用户想去哪的一句话,不是义务清单、不是状态汇总、不是拆线记录——那些各有各的账,别塞进方向。仅当用户明确说'方向改成…/目标更新为…'时调用。",
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["focusId", "currentDirection", "lastReliableState"],
          properties: {
            focusId: { type: "string" },
            currentDirection: { type: "string" },
            lastReliableState: { type: "string" },
            nextActivationTrigger: { type: "string" },
            ...remainingIntentProp
          }
        }
      },
      (args, ctx) => {
        const a = (args ?? {}) as Record<string, unknown>;
        // E2 热修:focusId 或 titleQuery 二选一(anchor 确认结果未回流 Brain,只有标题时也要能记账)
        let focusId = String(a["focusId"] ?? "");
        if (!focusId) {
          const tq = String(a["titleQuery"] ?? "");
          if (tq) {
            const cands = listFocusCandidatesByTitle(deps.db, tq);
            if (cands.length === 0) return toolError("focus_unavailable", `titleQuery 无匹配:${tq}`);
            if (cands.length > 1)
              return toolError("focus_ambiguous", `titleQuery 多候选(${cands.length}),请给 focusId:` + cands.map((c) => c.title).join(" / "));
            focusId = cands[0]!.id;
          } else {
            // M3(8/6 走查:模型每次记账连撞两次墙才蒙对)——与 proposeLaneSplit 同款兜底:缺省=会话锚定 Focus
            const sessRow = deps.db
              .prepare("SELECT primary_focus_id FROM sessions WHERE id = ?")
              .get(ctx.sessionId) as { primary_focus_id: string | null } | undefined;
            focusId = sessRow?.primary_focus_id ?? "";
            if (!focusId)
              return toolError(
                "focus_args",
                "会话还没接上任何 Focus——本轮先调 proposeFocusAnchor(title=这摊事的名字,如「爸妈来访准备」)建一个接上,然后立刻重试本次操作;绝不放弃、绝不改用 remember"
              );
          }
        }
        const r = resolveFocus(deps.db, focusId);
        if (r.kind !== "found") return toolError("focus_unavailable", `focus resolve=${r.kind}`);
        // E2 热修:收场关闭 activation 后恢复对话的自愈重建(死循环根修之一)
        ensureActiveActivationForSession(deps.db, ctx.sessionId, focusId);
        if (deps.confirm.pending(ctx.sessionId)) {
          return toolError("confirmation_busy", "当前会话还有另一项确认");
        }
        const currentDirection = String(a["currentDirection"] ?? "");
        const lastReliableState = String(a["lastReliableState"] ?? "");
        const receiptId = newId("apr");
        const promptText = buildConfirmPrompt(`确认把焦点状态更新为: ${currentDirection.slice(0, 80)}?`);
        const sentenceId = `s-focus-rev-${receiptId}`;
        const enqueued = deps.say(ctx.sessionId, sentenceId, promptText, {
          turnId: ctx.turnId,
          origin: "confirmation"
        });
        if (enqueued === false) return toolError("tts_unavailable", "确认句未呈现到在线语音或本会话控制台");
        const presented = deps.confirm.tryPresent(ctx.sessionId, {
          receiptId,
          sentenceId,
          promptText,
          payload: {
            kind: "focus_revision",
            focusId,
            currentDirection,
            lastReliableState,
            ...(a["nextActivationTrigger"]
              ? { nextActivationTrigger: String(a["nextActivationTrigger"]) }
              : {})
          },
          ...pickRemainingIntent(a, ctx.turnId)
        });
        if (!presented) return toolError("confirmation_busy", "语音确认改走屏幕");
        return { ok: true, receiptId, confirmationPresented: true, control: "await_user" };
      }
    );

    reg.register(
      {
        name: "proposeLaneSplit",
        description:
          "提议把当前 Focus 的工作拆成多条并行线(lane);经倒计时确认后写入。用户说'拆成两条线/两摊事分开管/各记各的账'等分线请求时必须当轮调用,不要只口头答应。每条线给标题;归线的义务用 obligationTitles(标题,推荐)或 obligationIds;focusId 可省略(默认当前锚定的 Focus)。",
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["lanes"],
          properties: {
            focusId: { type: "string" },
            lanes: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["title"],
                properties: {
                  title: { type: "string" },
                  parentLaneId: { type: ["string", "null"] },
                  obligationIds: { type: "array", items: { type: "string" } },
                  obligationTitles: {
                    type: "array",
                    items: { type: "string" },
                    description: "按义务标题归线(模糊包含匹配,多候选或无匹配会报错让你澄清)"
                  }
                }
              }
            },
            ...remainingIntentProp
          }
        }
      },
      (args, ctx) => {
        const a = (args ?? {}) as Record<string, unknown>;
        // J10:focusId 可省略,默认当前会话锚定的 Focus(模型手里常没有 id,必填=放弃调用的直接诱因)
        let focusId = String(a["focusId"] ?? "");
        if (!focusId) {
          const sess = deps.db
            .prepare("SELECT primary_focus_id FROM sessions WHERE id = ?")
            .get(ctx.sessionId) as { primary_focus_id: string | null } | undefined;
          focusId = sess?.primary_focus_id ?? "";
          if (!focusId) return toolError("focus_args", "当前会话没锚定 Focus,请先接上或给 focusId");
        }
        const r = resolveFocus(deps.db, focusId);
        if (r.kind !== "found") return toolError("focus_unavailable", `focus resolve=${r.kind}`);
        ensureActiveActivationForSession(deps.db, ctx.sessionId, focusId);
        const rawLanes = Array.isArray(a["lanes"]) ? (a["lanes"] as unknown[]) : [];
        if (rawLanes.length === 0) return toolError("lane_split_empty", "lanes 不能为空");
        // J10:obligationTitles 标题归线(模糊包含;无匹配/多候选报错让模型澄清)
        const openObs = deps.db
          .prepare(
            "SELECT id, title FROM focus_obligations WHERE focus_id = ? AND status IN ('open','in_progress','waiting','deferred','blocked')"
          )
          .all(focusId) as Array<{ id: string; title: string }>;
        const titleErrors: string[] = [];
        const resolveTitles = (wanted: string[]): string[] =>
          wanted.flatMap((w) => {
            const q = w.trim();
            if (!q) return [];
            const hits = openObs.filter((o) => o.title.includes(q) || q.includes(o.title));
            if (hits.length === 1) return [hits[0]!.id];
            titleErrors.push(
              hits.length === 0 ? `「${q}」无匹配义务` : `「${q}」命中 ${hits.length} 条(${hits.map((h) => h.title).join(" / ")})`
            );
            return [];
          });
        const lanes = rawLanes.map((item) => {
          const L = (item ?? {}) as Record<string, unknown>;
          const title = String(L["title"] ?? "").trim();
          const parentRaw = L["parentLaneId"];
          const parentLaneId =
            parentRaw === null || parentRaw === undefined || parentRaw === ""
              ? null
              : String(parentRaw);
          const fromIds = Array.isArray(L["obligationIds"])
            ? (L["obligationIds"] as unknown[]).map((x) => String(x))
            : [];
          const fromTitles = Array.isArray(L["obligationTitles"])
            ? resolveTitles((L["obligationTitles"] as unknown[]).map((x) => String(x)))
            : [];
          return { title, parentLaneId, obligationIds: [...new Set([...fromIds, ...fromTitles])] };
        });
        if (titleErrors.length > 0)
          return toolError("lane_obligation_titles", `义务标题解析失败:${titleErrors.join(";")}`);
        if (lanes.some((l) => !l.title)) return toolError("lane_title_required", "每条线需要 title");
        if (deps.confirm.pending(ctx.sessionId)) {
          return toolError("confirmation_busy", "当前会话还有另一项确认");
        }
        // present 时算 baseline(focus_ 前缀自动带基线,确认消费 stale 判定通用)
        const focusRow = deps.db
          .prepare("SELECT current_revision FROM focuses WHERE id = ?")
          .get(focusId) as { current_revision: number };
        const eventHWM = maxFocusEventSeq(deps.db, focusId);
        const obligationsDigest = openObligationsDigest(deps.db, focusId);
        const baseline = {
          focusRevision: focusRow.current_revision,
          eventHWM,
          obligationsDigest
        };
        const receiptId = newId("apr");
        const titles = lanes.map((l) => l.title).join("、");
        const promptText = countdownPrompt(`拆出线:${titles}`);
        const sentenceId = `s-focus-lane-${receiptId}`;
        if (deps.say(ctx.sessionId, sentenceId, promptText, { turnId: ctx.turnId, origin: "confirmation" }) === false) {
          return toolError("tts_unavailable", "确认句未呈现到在线语音或本会话控制台");
        }
        const presented = deps.confirm.tryPresent(ctx.sessionId, {
          receiptId,
          sentenceId,
          promptText,
          payload: {
            kind: "focus_lane_split",
            focusId,
            lanes,
            baseline
          },
          ...pickRemainingIntent(a, ctx.turnId)
        });
        if (!presented) return toolError("confirmation_busy", "语音确认改走屏幕");
        deps.scheduleAutoAccept?.(ctx.sessionId, receiptId, COUNTDOWN_MS);
        return { ok: true, receiptId, confirmationPresented: true, control: "await_user" };
      }
    );

    reg.register(
      {
        name: "proposeExpectationAck",
        description:
          "控制轮 expectation_adjusted 后调用:复述期待调整影响并发起 expectation_ack 确认卡。用户确认后 CAS 生效;拒绝则 pending_ack 作废。",
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["focusId", "expectationId", "fromRevision", "toRevision", "summary"],
          properties: {
            focusId: { type: "string" },
            expectationId: { type: "string" },
            fromRevision: { type: "number" },
            toRevision: { type: "number" },
            summary: { type: "string", description: "复述影响的一句话(进确认卡与 TTS)" },
            ...remainingIntentProp
          }
        }
      },
      (args, ctx) => {
        const a = (args ?? {}) as Record<string, unknown>;
        const focusId = String(a["focusId"] ?? "");
        const expectationId = String(a["expectationId"] ?? "");
        const fromRevision = Number(a["fromRevision"] ?? 0);
        const toRevision = Number(a["toRevision"] ?? 0);
        const summary = String(a["summary"] ?? "").trim();
        if (!focusId || !expectationId || !summary) {
          return toolError("invalid_arguments", "focusId/expectationId/summary required");
        }
        if (!Number.isFinite(fromRevision) || !Number.isFinite(toRevision) || toRevision < 1) {
          return toolError("invalid_arguments", "fromRevision/toRevision invalid");
        }
        const r = resolveFocus(deps.db, focusId);
        if (r.kind !== "found") return toolError("focus_unavailable", `focus resolve=${r.kind}`);
        const exp = deps.db
          .prepare(
            `SELECT id, status, revision, text FROM focus_expectations WHERE id = ? AND focus_id = ?`
          )
          .get(expectationId, focusId) as
          | { id: string; status: string; revision: number; text: string }
          | undefined;
        if (!exp) return toolError("expectation_not_found", `expectation ${expectationId} not found`);
        if (exp.status !== "pending_ack") {
          return toolError("not_pending_ack", `expectation status=${exp.status}`);
        }
        if (exp.revision !== toRevision) {
          return toolError(
            "revision_mismatch",
            `expectation revision=${exp.revision} != toRevision=${toRevision}`
          );
        }
        if (deps.confirm.pending(ctx.sessionId)) {
          return toolError("confirmation_busy", "当前会话还有另一项确认");
        }
        const receiptId = newId("apr");
        const promptText = buildConfirmPrompt(`确认调整期待:${summary.slice(0, 80)}?`);
        const sentenceId = `s-exp-ack-${receiptId}`;
        if (deps.say(ctx.sessionId, sentenceId, promptText, { turnId: ctx.turnId, origin: "confirmation" }) === false) {
          return toolError("tts_unavailable", "确认句未呈现到在线语音或本会话控制台");
        }
        const presented = deps.confirm.tryPresent(ctx.sessionId, {
          receiptId,
          sentenceId,
          promptText,
          payload: {
            kind: "expectation_ack",
            focusId,
            expectationId,
            fromRevision,
            toRevision,
            summary
          },
          ...pickRemainingIntent(a, ctx.turnId)
        });
        if (!presented) return toolError("confirmation_busy", "语音确认改走屏幕");
        deps.scheduleAutoAccept?.(ctx.sessionId, receiptId, COUNTDOWN_MS);
        return {
          ok: true,
          receiptId,
          expectationId,
          confirmationPresented: true,
          control: "await_user"
        };
      }
    );
  }
}
