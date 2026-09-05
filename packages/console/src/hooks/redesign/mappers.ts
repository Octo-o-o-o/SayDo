// redesign 四页数据映射纯函数(可单测;无 React 依赖)。
// 合同:packages/console/src/pages/redesign/README.md + components/redesign/types.ts。

import type {
  ArtifactRole,
  ArtifactView,
  ExpectationView,
  FocusLifecycle,
  FocusView,
  ObligationNeeds,
  ObligationOwner,
  ObligationStatus,
  ObligationView,
  RiskLevel,
  TaskView,
  TimelineItem,
  ViewStatus,
  AcceptanceItem,
  AcceptanceSource,
  AcceptanceStatus,
  ReviewTaskContext
} from "../../components/redesign/types";

/* ---------- daemon 载荷形状(宽松只读;页面/hook 不依赖 daemon 包) ---------- */

export interface FocusListRow {
  id: string;
  title: string;
  lifecycle: string;
  currentRevision: number;
  openByOwner?: { human: number; agent: number; external: number };
  projectRefs?: string[];
  direction?: string | null;
  updatedAt?: string;
  spaceId?: string | null;
}

export interface FocusDetailPayload {
  focus: {
    id: string;
    title: string;
    lifecycle: string;
    currentRevision: number;
    direction: string | null;
    openObligationCount?: number;
    spaceId?: string | null;
    updatedAt?: string;
  };
  obligations: Array<{
    id: string;
    title: string;
    owner: string;
    status: string;
    blocking?: boolean;
    needs?: string | null;
    laneId?: string | null;
    waitingOn?: string | null;
    waitingOnObligationId?: string | null;
    actionRef?: string | null;
    nextStep?: string | null;
    detail?: string | null;
  }>;
  lanes: Array<{
    id: string;
    title: string;
    parentLaneId?: string | null;
    createdFromEvent?: number;
    retiredAt?: string | null;
  }>;
  events: Array<{
    id?: string;
    seq: number;
    type: string;
    payload?: Record<string, unknown>;
    createdAt?: string;
    /** daemon getFocusDetail 实发字段(L2 用:activation_started 的归属会话兜底) */
    sessionId?: string | null;
  }>;
  repos: Array<{ projectId: string; note?: string | null }>;
  artifacts: Array<{
    id: string;
    kind: string;
    role: string;
    title: string;
    ref?: unknown;
  }>;
}

export type DaemonTimelineItem =
  | {
      seq: number;
      ts: string;
      kind: "session_segment";
      sessionRef: string;
      startTs: string;
      endTs: string | null;
      turnCount: number;
      transcriptAvailable: boolean;
    }
  | {
      seq: number;
      ts: string;
      kind: "event";
      eventType: string;
      summary: string;
      refs?: Record<string, unknown>;
    };

export interface AttentionItemRow {
  id: string;
  color: "orange" | "blue" | "green" | "gray";
  title: string;
  focusId: string | null;
  focusTitle?: string | null;
  action?: string;
  updatedAt?: string;
  sourceKind?: "confirmation" | "obligation" | "task";
  refId?: string;
  projectId?: string;
  sessionId?: string;
  needs?: string | null;
  laneId?: string | null;
  ackedAt?: string;
}

export type TranscriptResponse =
  | { available: true; turns: Array<{ turnId: string; speaker: string; text: string; ts: string }> }
  | { available: false; reason?: string };

const LIFECYCLES = new Set<FocusLifecycle>([
  "captured",
  "active",
  "dormant",
  "closed",
  "abandoned",
  "archived"
]);

const VIEW_STATUSES = new Set<ViewStatus>([
  "queued",
  "confirmed",
  "running",
  "paused_step_boundary",
  "blocked",
  "waiting_confirmation",
  "ready_for_review",
  "review_approved_waiting_merge",
  "merging",
  "merge_failed",
  "task_done",
  "failed",
  "cancel_requested",
  "cancel_settled",
  "superseded",
  "parked"
]);

const OPEN_OB_STATUS = new Set(["open", "in_progress", "waiting", "deferred", "blocked"]);

function asLifecycle(s: string): FocusLifecycle {
  return LIFECYCLES.has(s as FocusLifecycle) ? (s as FocusLifecycle) : "active";
}

function asViewStatus(s: string): ViewStatus {
  return VIEW_STATUSES.has(s as ViewStatus) ? (s as ViewStatus) : "queued";
}

function asOwner(s: string): ObligationOwner {
  if (s === "human" || s === "agent" || s === "external") return s;
  return "agent";
}

function asObStatus(s: string): ObligationStatus {
  return s as ObligationStatus;
}

function asNeeds(s: string | null | undefined): ObligationNeeds | undefined {
  if (s === "decision" || s === "input" || s === "action" || s === "unknown") return s;
  return undefined;
}

function asArtifactRole(s: string): ArtifactRole {
  if (s === "expected" || s === "deliverable" || s === "input" || s === "reference") return s;
  return "reference";
}

function asArtifactKind(s: string): ArtifactView["kind"] {
  if (s === "file" || s === "git_commit" || s === "url" || s === "text") return s;
  return "file";
}

/** 从 obligations 派生球权(列表 API 缺 openByOwner 时的兜底;与 daemon OPEN_SET 对齐) */
export function openByOwnerFromObligations(
  obligations: FocusDetailPayload["obligations"]
): { human: number; agent: number; external: number } {
  const out = { human: 0, agent: 0, external: 0 };
  for (const o of obligations) {
    if (!OPEN_OB_STATUS.has(o.status)) continue;
    if (o.owner === "human") out.human += 1;
    else if (o.owner === "agent") out.agent += 1;
    else if (o.owner === "external") out.external += 1;
  }
  return out;
}

export function mapFocusView(
  detail: FocusDetailPayload,
  listRow?: FocusListRow | null
): FocusView {
  const f = detail.focus;
  return {
    id: f.id,
    title: f.title,
    lifecycle: asLifecycle(f.lifecycle),
    currentRevision: f.currentRevision,
    direction: f.direction ?? listRow?.direction ?? "",
    openByOwner:
      listRow?.openByOwner ?? openByOwnerFromObligations(detail.obligations),
    projectRefs: listRow?.projectRefs ?? detail.repos.map((r) => r.projectId)
  };
}

export function mapObligationView(o: FocusDetailPayload["obligations"][number], focusId: string): ObligationView {
  return {
    id: o.id,
    focusId,
    title: o.title,
    owner: asOwner(o.owner),
    status: asObStatus(o.status),
    needs: asNeeds(o.needs),
    blocking: o.blocking,
    waitingOn: o.waitingOn ?? undefined,
    waitingOnObligationId: o.waitingOnObligationId ?? undefined,
    laneId: o.laneId ?? undefined,
    actionRef: o.actionRef ?? undefined,
    dueOrTrigger: o.nextStep ?? undefined
  };
}

export function mapArtifactView(
  a: FocusDetailPayload["artifacts"][number],
  focusId: string
): ArtifactView {
  return {
    id: a.id,
    focusId,
    version: 1,
    kind: asArtifactKind(a.kind),
    role: asArtifactRole(a.role),
    title: a.title,
    createdAt: ""
  };
}

/**
 * P0 期待派生:仅 role:'expected' 的 artifacts → ExpectationView.
 * 漂移/调整归 v0.4;acceptance 条目前均为 untested(无 verify 证据时不伪造 pass)。
 * 无 expected 产物时返回 undefined(页面不渲染期待组)。
 */
export function deriveExpectations(
  artifacts: FocusDetailPayload["artifacts"],
  opts: { revision: number; direction: string }
): ExpectationView[] | undefined {
  const expected = artifacts.filter((a) => a.role === "expected");
  if (expected.length === 0) return undefined;
  const deliveredCount = artifacts.filter((a) => a.role === "deliverable").length;
  return [
    {
      revision: opts.revision,
      direction: opts.direction || "（方向尚未写入）",
      acceptance: expected.map((a) => ({
        text: a.title,
        state: "untested" as const
      })),
      artifacts: { expected: expected.length, delivered: deliveredCount },
      budget: { known: false }
    }
  ];
}

/* ---------- L3(2026-08-09):会话段时间戳本地化 ---------- */

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * session_segment 起讫时间:daemon ISO 原文 →「今天 15:02 – 17:40」式(跨天带日期)。
 * 口径与全站既有惯例一致(Chat formatEntityTime / AttentionItemCard formatAttnTime):
 * start 当天 →「今天 HH:MM」,否则「M/D HH:MM」;end 与 start 同日 →「HH:MM」,跨天 →「M/D HH:MM」。
 * 解析失败的串原样透传(诚实兜底,不伪造);endTs=null 保持 null(收场/中断语义在呈现层)。
 */
export function localizeSegmentTs(startRaw: string, endRaw: string | null): { startTs: string; endTs: string | null } {
  const start = new Date(startRaw);
  if (Number.isNaN(start.getTime())) return { startTs: startRaw, endTs: endRaw };
  const hm = (d: Date): string => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const dayHm = (d: Date): string => `${d.getMonth() + 1}/${d.getDate()} ${hm(d)}`;
  const startTs = sameDay(start, new Date()) ? `今天 ${hm(start)}` : dayHm(start);
  if (endRaw === null) return { startTs, endTs: null };
  const end = new Date(endRaw);
  if (Number.isNaN(end.getTime())) return { startTs, endTs: endRaw };
  return { startTs, endTs: sameDay(start, end) ? hm(end) : dayHm(end) };
}

/** daemon timeline 项 → 呈现 TimelineItem(event.summary→text;session_segment 起讫时间本地化;其余原样) */
export function mapDaemonTimelineItem(item: DaemonTimelineItem): TimelineItem {
  if (item.kind === "session_segment") {
    const { startTs, endTs } = localizeSegmentTs(item.startTs, item.endTs);
    return {
      seq: item.seq,
      ts: item.ts,
      kind: "session_segment",
      sessionRef: item.sessionRef,
      turnCount: item.turnCount,
      startTs,
      endTs,
      transcriptAvailable: item.transcriptAvailable
    };
  }
  return {
    seq: item.seq,
    ts: item.ts,
    kind: "event",
    eventType: item.eventType,
    text: item.summary
  };
}

/**
 * 时间线翻页合并:API 倒序(新→旧);呈现按 seq 升序(旧→新)。
 * 更早页 prepend 后按 seq 去重合并,不丢不重。
 */
export function mergeTimelineAsc(existingAsc: TimelineItem[], olderPageDesc: TimelineItem[]): TimelineItem[] {
  const bySeq = new Map<number, TimelineItem>();
  for (const it of existingAsc) bySeq.set(it.seq, it);
  for (const it of olderPageDesc) bySeq.set(it.seq, it);
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}

/** 将一页 daemon 倒序 items 映射并翻成升序 */
export function mapTimelinePage(items: DaemonTimelineItem[]): TimelineItem[] {
  return items.map(mapDaemonTimelineItem).sort((a, b) => a.seq - b.seq);
}

/* ---------- L2(2026-08-09):活跃会话段「进行中」判定 ---------- */

/**
 * detail.events → activationId→sessionId 映射。
 * timeline 的 session_segment.sessionRef = activationId(fac_*;daemon 投影不带 sessionId),
 * 归属会话只能从 activation_started 事件读回:payload.sessionId 优先,顶层 sessionId 兜底。
 */
export function mapActivationSessions(events: FocusDetailPayload["events"]): Map<string, string> {
  const m = new Map<string, string>();
  for (const e of events) {
    if (e.type !== "activation_started") continue;
    const aid = typeof e.payload?.["activationId"] === "string" ? (e.payload["activationId"] as string) : null;
    const sid =
      typeof e.payload?.["sessionId"] === "string"
        ? (e.payload["sessionId"] as string)
        : typeof e.sessionId === "string"
          ? e.sessionId
          : null;
    if (aid && sid) m.set(aid, sid);
  }
  return m;
}

/**
 * 标记当前活跃会话段:endTs=null 且 activation 归属 currentSessionId ⇒ live=true(呈现「进行中」)。
 * 其余(已收场 / 归属别的会话 / 无映射)不动——非活跃 endTs=null 仍显示「中断」。
 */
export function markLiveSegments(items: TimelineItem[], liveActivationRefs: ReadonlySet<string>): TimelineItem[] {
  if (liveActivationRefs.size === 0) return items;
  return items.map((it) =>
    it.kind === "session_segment" && it.endTs === null && liveActivationRefs.has(it.sessionRef)
      ? { ...it, live: true }
      : it
  );
}

/**
 * 组头徽章:attention 按 focusId 分组,只计橙+蓝(单源纪律,与 Layout/Today 一致)。
 * 返回 Map<focusId, count>。
 */
export function countNeedYouByFocus(items: AttentionItemRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of items) {
    if ((a.color === "orange" || a.color === "blue") && a.focusId) {
      m.set(a.focusId, (m.get(a.focusId) ?? 0) + 1);
    }
  }
  return m;
}

/**
 * transcript API 投影:available:false → null;available:true → 人话行数组。
 * 组件 onExpandSegment 约定 null = 读不到/未存。
 */
export function mapTranscriptLines(resp: TranscriptResponse | null | undefined): string[] | null {
  if (!resp || resp.available === false) return null;
  return resp.turns.map((t) => {
    const who = t.speaker === "user" ? "你" : "AI";
    return `${who}: ${t.text}`;
  });
}

/* ---------- Review:taskDetail → ReviewTaskContext ---------- */

export interface TaskDetailPayload {
  task: Record<string, unknown>;
  package: Record<string, unknown> | null;
  runs: Record<string, unknown>[];
  approvals?: Record<string, unknown>[];
  costs?: Record<string, unknown>[];
  decisions?: Record<string, unknown>[];
  acceptanceChecks?: Array<{ criterion: string; source: string; status: string; evidenceRef?: string }>;
  writingProof?: {
    acceptanceChecks?: Array<{ criterion: string; source: string; status: string; evidenceRef?: string }>;
  } | null;
}

function elapsedMinFrom(updatedAt: unknown, createdAt: unknown): number {
  const raw = (typeof updatedAt === "string" && updatedAt) || (typeof createdAt === "string" && createdAt) || null;
  if (!raw) return 0;
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.round((Date.now() - t) / 60_000));
}

function mapTaskViewFromDetail(task: Record<string, unknown>, focusId: string): TaskView {
  const budgetRaw = task["budget_json"] ?? task["budget"];
  let budget = { walltimeActiveMin: 0, maxTurns: 0, maxCost: 0 };
  if (budgetRaw && typeof budgetRaw === "object") {
    const b = budgetRaw as Record<string, unknown>;
    budget = {
      walltimeActiveMin: Number(b["walltimeActiveMin"] ?? 0),
      maxTurns: Number(b["maxTurns"] ?? 0),
      maxCost: Number(b["maxCost"] ?? 0)
    };
  } else if (typeof budgetRaw === "string") {
    try {
      const b = JSON.parse(budgetRaw) as Record<string, unknown>;
      budget = {
        walltimeActiveMin: Number(b["walltimeActiveMin"] ?? 0),
        maxTurns: Number(b["maxTurns"] ?? 0),
        maxCost: Number(b["maxCost"] ?? 0)
      };
    } catch {
      /* keep default */
    }
  }
  const route = String(task["route"] ?? "tier1") === "hopper" ? "hopper" : "tier1";
  const riskRaw = String(task["risk"] ?? task["riskLevel"] ?? "S1");
  const riskLevel = (["S0", "S1", "S2", "S3"].includes(riskRaw) ? riskRaw : "S1") as RiskLevel;
  return {
    id: String(task["id"] ?? ""),
    focusId,
    title: String(task["title"] ?? ""),
    route,
    adapter: task["adapter"] != null ? String(task["adapter"]) : undefined,
    viewStatus: asViewStatus(String(task["viewStatus"] ?? task["status"] ?? "queued")),
    attempt: Number(task["attempt"] ?? 0),
    riskLevel,
    elapsedMin: elapsedMinFrom(task["updated_at"] ?? task["updatedAt"], task["created_at"] ?? task["createdAt"]),
    budget,
    spent: { known: false },
    lastEvent: String(task["status"] ?? ""),
    parkedDeadline: (task["parked_deadline"] as string | null | undefined) ?? (task["parkedDeadline"] as string | null | undefined) ?? null
  };
}

/**
 * 将 TaskDetail API 载荷映射为 ReviewTaskContext。
 * focusId 由接线层注入(任务详情本身不带 focus;无绑定则空串,返回条文案走缺省)。
 */
export function mapReviewContext(data: TaskDetailPayload, focusId = ""): ReviewTaskContext {
  const task = data.task ?? {};
  const pkg = data.package;
  const writingProof = data.writingProof ?? null;
  const isWriting = String(task["project_type"] ?? "") === "writing" && writingProof !== null;

  const acceptanceRaw = (pkg?.["acceptance"] as Array<string | { text?: string; criterion?: string }> | undefined) ?? [];
  const checks = data.acceptanceChecks ?? [];
  const checksByCriterion = new Map<string, typeof checks>();
  for (const check of checks) {
    const rows = checksByCriterion.get(check.criterion) ?? [];
    rows.push(check);
    checksByCriterion.set(check.criterion, rows);
  }

  const acceptance: AcceptanceItem[] = acceptanceRaw.map((a) => {
    const criterion = typeof a === "string" ? a : a.text ?? a.criterion ?? JSON.stringify(a);
    const matches = checksByCriterion.get(criterion) ?? [];
    const check = matches.length === 1 ? matches[0] : undefined;
    let source: AcceptanceSource = "verify";
    if (check?.source === "manual") source = "manual";
    else if (check?.source === "agent_claim") source = "agent_claim";
    else if (isWriting) source = "manual";

    let statusAc: AcceptanceStatus = "unknown";
    const legalSource = check?.source === "verify" || check?.source === "agent_claim" || check?.source === "manual";
    if (check?.status === "unknown" && legalSource) statusAc = "unknown";
    else if (
      (check?.status === "pass" || check?.status === "fail") &&
      legalSource &&
      typeof check.evidenceRef === "string" &&
      check.evidenceRef.trim() !== ""
    ) {
      statusAc = check.status;
    }

    return { criterion, status: statusAc, source };
  });

  const decisions = (data.decisions ?? []).map((d) => ({
    what: String((d as Record<string, unknown>)["what"] ?? ""),
    why: String((d as Record<string, unknown>)["why"] ?? ""),
    overridable: true as const
  }));

  const runs = (data.runs ?? []).map((r) => ({
    attempt: Number((r as Record<string, unknown>)["attempt"] ?? 0),
    result: String((r as Record<string, unknown>)["state"] ?? "")
  }));

  // costs → spent
  const costs = data.costs ?? [];
  let spentKnown = false;
  let spentValue = 0;
  for (const c of costs) {
    const row = c as Record<string, unknown>;
    if (row["known"] === 1 || row["known"] === true) {
      spentKnown = true;
      spentValue += Number(row["amount"] ?? 0);
    }
  }
  const tv = mapTaskViewFromDetail(task, focusId);
  if (spentKnown) tv.spent = { known: true, value: spentValue };

  // package digest 末 12 作 packageRefText
  const digest = String(task["package_digest"] ?? pkg?.["digest"] ?? "");
  const packageRefText = digest ? `digest ${digest.slice(-12)}` : "无决策包 digest";

  return {
    task: tv,
    packageRefText,
    acceptance,
    decisions,
    runs,
    writing: isWriting || undefined,
    s3: String(task["risk"] ?? "") === "S3" || undefined
  };
}

/** 最小 TaskView(看板/右栏;缺字段用安全缺省,不伪造进度) */
export function mapTaskRowToView(
  row: {
    id: string;
    title: string;
    route?: string;
    viewStatus?: string;
    status?: string;
    attempt?: number;
    budget?: { walltimeActiveMin: number; maxTurns: number; maxCost: number } | null;
    parkedDeadline?: string | null;
    projectId?: string;
    projectTitle?: string;
  },
  focusId: string
): TaskView {
  const budget = row.budget ?? { walltimeActiveMin: 0, maxTurns: 0, maxCost: 0 };
  return {
    id: row.id,
    focusId,
    title: row.title,
    route: row.route === "hopper" ? "hopper" : "tier1",
    viewStatus: asViewStatus(String(row.viewStatus ?? row.status ?? "queued")),
    attempt: row.attempt ?? 0,
    riskLevel: "S1",
    elapsedMin: 0,
    budget,
    spent: { known: false },
    lastEvent: String(row.viewStatus ?? row.status ?? ""),
    projectTitle: row.projectTitle,
    parkedDeadline: row.parkedDeadline ?? null
  };
}

/** 记录页事件:detail.events → {seq,type,text}(人话优先 payload 摘要,否则 type) */
export function mapRecordEvents(
  events: FocusDetailPayload["events"]
): Array<{ seq: number; type: string; text: string }> {
  return events.map((e) => {
    const p = e.payload ?? {};
    let text = e.type;
    if (typeof p["title"] === "string" && p["title"]) text = `${e.type}: ${p["title"]}`;
    else if (typeof p["note"] === "string" && p["note"]) text = String(p["note"]);
    return { seq: e.seq, type: e.type, text };
  });
}

/** session_segment → RecordsPage segments 形状(live 透传:L2 活跃段「进行中」) */
export function mapRecordSegments(
  timeline: TimelineItem[]
): Array<{ sessionRef: string; label: string; turnCount: number; closed: boolean; transcriptAvailable: boolean; live?: boolean }> {
  return timeline
    .filter((t): t is Extract<TimelineItem, { kind: "session_segment" }> => t.kind === "session_segment")
    .map((s) => {
      const start = s.startTs;
      const end = s.endTs;
      const range = end ? `${start} – ${end}` : start;
      return {
        sessionRef: s.sessionRef,
        label: range, // OPEN Q3 清理:组件端已拼「一次会话 ·」前缀,此处只传时间段防重复
        turnCount: s.turnCount,
        closed: s.endTs != null,
        transcriptAvailable: s.transcriptAvailable,
        ...(s.live === true ? { live: true } : {})
      };
    });
}
