// redesign 组件库共享视图模型(handoff §3 props 数据合同)。
// 与 daemon 真实形状一致;FocusObligation 直接 import 自 @saydo/contracts(权威源)。
// 规则:呈现层不自创字段;派生只读字段(producedBy/realizedAt)只用于展示。

import type { FocusObligation } from "@saydo/contracts";

export type { FocusObligation };

/* ---------- attention(handoff §3 原文) ---------- */
export type AttentionColor = "orange" | "blue" | "green" | "gray";
export interface AttentionItem {
  id: string;
  color: AttentionColor;
  title: string;
  focusId: string | null;
  focusTitle: string | null;
  action: "open_confirm" | "open_task_modal" | "open_focus";
  updatedAt: string;
  sessionId?: string;
  projectId?: string;
  needs?: string | null;
  laneId?: string | null;
  sourceKind?: "confirmation" | "obligation" | "task";
  refId?: string;
  /** T1 并行字段;后端未合入时容错 */
  ackedAt?: string;
}

/* ---------- 任务呈现(handoff §3:消费 viewStatus,16 态) ---------- */
export type ViewStatus =
  | "queued" | "confirmed" | "running" | "paused_step_boundary" | "blocked"
  | "waiting_confirmation" | "ready_for_review" | "review_approved_waiting_merge"
  | "merging" | "merge_failed" | "task_done" | "failed"
  | "cancel_requested" | "cancel_settled" | "superseded" | "parked";

export type RiskLevel = "S0" | "S1" | "S2" | "S3";

export interface TaskView {
  id: string;
  focusId: string;
  title: string;
  route: "tier1" | "hopper";
  adapter?: string;
  viewStatus: ViewStatus;
  attempt: number;
  riskLevel: RiskLevel;
  /** 已发生时长(分钟);执行任务只说已发生,不预估剩余 */
  elapsedMin: number;
  budget: { walltimeActiveMin: number; maxTurns: number; maxCost: number };
  /** Money 纪律:known=false 永不显示 0,显示「还没有确切数字」 */
  spent: { known: boolean; value?: number };
  lastEvent: string;
  projectTitle?: string;
  parkedDeadline?: string | null;
  /** HP 专属:执行中的 DecisionRequest 文案(待裁决门) */
  hpDecision?: string;
}

/* ---------- Focus 基础 ---------- */
export type FocusLifecycle = "captured" | "active" | "dormant" | "closed" | "abandoned" | "archived";

export interface FocusView {
  id: string;
  title: string;
  lifecycle: FocusLifecycle;
  currentRevision: number;
  direction: string;
  /** 文字形态球权(只作文字描述,永不渲染为数字角标——handoff §4.4) */
  openByOwner: { human: number; agent: number; external: number };
  projectRefs?: string[];
}

/* ---------- 义务视图(对齐 FocusObligation 的呈现子集) ---------- */
export type ObligationStatus = FocusObligation["status"];
export type ObligationOwner = FocusObligation["owner"];
export type ObligationNeeds = "decision" | "input" | "action" | "unknown";

export interface ObligationView {
  id: string;
  focusId: string;
  title: string;
  owner: ObligationOwner;
  status: ObligationStatus;
  needs?: ObligationNeeds;
  blocking?: boolean;
  waitingOn?: string;
  waitingOnObligationId?: string;
  dueOrTrigger?: string;
  deferReason?: string;
  laneId?: string;
  actionRef?: string;
}

/* ---------- 产物(handoff §3:role expected→deliverable;producedBy/realizedAt 只读派生) ---------- */
export type ArtifactRole = "expected" | "deliverable" | "input" | "reference";
export interface ArtifactView {
  id: string;
  focusId: string;
  version: number;
  kind: "file" | "git_commit" | "url" | "text";
  role: ArtifactRole;
  title: string;
  projectTitle?: string;
  digest?: string;
  taskRef?: string;
  obRef?: string;
  superseded?: boolean;
  producedBy?: string;
  realizedAt?: string;
  createdAt: string;
}

/* ---------- 确认卡(handoff §3 真实枚举;无独立 memory 类型) ---------- */
export type ConfirmKind =
  | "focus_anchor" | "focus_obligation" | "focus_obligation_resolve"
  | "focus_create_anchor" | "focus_revision" | "focus_lane_split"
  | "dispatch" | "runtime_effect" | "readiness";

export interface ConfirmCardData {
  receiptId: string;
  kind: ConfirmKind;
  /** 锁定档原文重放(keys 逐行,与 TTS 同文) */
  keys: string[];
  /** 倒计时由容器传入;组件不做真实定时器(handoff §2 不做项) */
  secondsLeft?: number | null;
  resolved?: "accepted" | "rejected" | "expired" | null;
}

/* ---------- TimelineItem(P0:无 confirm 历史成员、无逐轮 turn 成员——handoff §3) ---------- */
export type TimelineItem =
  | { seq: number; ts: string; kind: "note"; text: string }
  | { seq: number; ts: string; kind: "event"; eventType: string; text: string }
  | { seq: number; ts: string; kind: "session_segment"; sessionRef: string; turnCount: number; startTs: string; endTs: string | null; transcriptAvailable: boolean; /** L2:当前活跃会话段(前端判定:endTs=null 且归属本会话)⇒ 显示「进行中」而非「中断」 */ live?: boolean }
  | { seq: number; ts: string; kind: "task"; taskRef: string }
  | { seq: number; ts: string; kind: "entity"; title: string; sub: string; artifactRef?: string }
  | { seq: number; ts: string; kind: "pkg"; packageRef: string }
  | { seq: number; ts: string; kind: "progress"; expectationRef?: string }
  | { seq: number; ts: string; kind: "standby"; obligationRef: string };

/* ---------- 决策包 ---------- */
export interface DecisionPackageView {
  id: string;
  revision: number;
  status: "draft" | "proposed" | "approved" | "expired" | "superseded";
  outcomePreview: string;
  inScope: string[];
  outOfScope: string[];
  acceptance: string[];
  plan: { seq: number; step: string; owner: "ai" | "human" }[];
  cost: { expected?: number; max: number; currency: "CNY" | "USD" };
  risks: string[];
  preauthorizedEffects: { effect: string; spokenForm: string; ttlHours: number }[];
  expiresInH?: number;
  /** AI 推荐只占徽章不占预选位(handoff §4.5/拍板纪律) */
  recommendedMode?: "step_confirm" | "direct_to_review";
  selectedMode?: "step_confirm" | "direct_to_review" | null;
  /** 决策包所属项目(看小样读口归属断言) */
  projectId?: string;
  /** assemble/revise 同轮生成的 Demo 小样;无则不渲染「看小样」 */
  demoRef?: { artifactId: string; version: number };
}

/* ---------- 验收面 ---------- */
export type AcceptanceSource = "verify" | "agent_claim" | "manual";
export type AcceptanceStatus = "pass" | "fail" | "unknown";
export interface AcceptanceItem {
  criterion: string;
  status: AcceptanceStatus;
  source: AcceptanceSource;
  section?: string;
  evidence?: { kind: "log" | "diff" | "article" | "note"; body: string };
}
export interface ReviewTaskContext {
  task: TaskView;
  packageRefText: string;
  acceptance: AcceptanceItem[];
  decisions: { what: string; why: string; overridable: true }[];
  runs: { attempt: number; result: string }[];
  writing?: boolean;
  s3?: boolean;
  explain?: { one_liner: string; walkthrough: string; decisions: string };
  manualVerdicts?: Record<number, "pass" | "fail">;
}

/* ---------- 看板 ---------- */
export interface BoardColumn {
  key: "queued" | "active" | "needsYou" | "settled";
  label: string;
}
export interface BoardLaneGroupData {
  focus: FocusView;
  lanes: { id: string; title: string }[];
  tasksByLane: Record<string, TaskView[]>;
  obligationsByLane: Record<string, ObligationView[]>;
  needCount: number;
  collapsed?: boolean;
}

/* ---------- 弹窗族 props ---------- */
export interface ApprovalView {
  id: string;
  title: string;
  riskLevel: RiskLevel;
  decidedVia: "voice" | "screen" | "push" | "preauthorized";
  focusTitle: string;
  taskTitle?: string;
  effect?: string;
  target?: string;
  downstream?: string[];
  expiry?: string;
}

/* ---------- 期待(OPEN QUESTION:demo v2.1 增量,未在交接清单——见 ExpectationGroup.tsx 头注) ---------- */
export type ExpectationItemState = "pass_verify" | "pass_claim" | "untested" | "at_risk" | "adjusted";
export interface ExpectationView {
  revision: number;
  direction: string;
  acceptance: { text: string; state: ExpectationItemState; note?: string }[];
  artifacts: { expected: number; delivered: number };
  budget: { spent: number; max: number; currency: "CNY" | "USD" };
}
