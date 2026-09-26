// FocusPage(HANDOFF-2 §2,demo renderFocus/.focus-layout):Focus 对话页静态拼装。
// 构成:statecard(sticky,滚动态压缩单行——评审 U6)+ 时间线卡流 + 右栏 FocusRail
// (含期待组,排在产物组之后——HANDOFF-2 §1 拍板)+ ComposerHaltBar/composerSlot。
// 纯呈现:不 import api/fetch/router;跳转走 onNavigate(PageNavTarget),动作走 onAction。
// 窄屏(<1100px)降级:右栏折叠为 statecard 下方横向摘要条(方案开放问题 4 的 P0 解)。
// 双栏滚动:右栏 sticky + 内部滚动近似 demo 的独立滚动;真正的 main-lock 归壳层/接线线。

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import {
  ComposerHaltBar, DecisionPackageCard, DependencyCard, ExpectationGroup, FocusRail, FocusStateCard,
  InterviewCard, ProgressAlignCard, SessionSegmentCard, StandbyCard, TaskCard, TimelineNote,
  card
} from "../../components/redesign";
import type {
  ArtifactView, DecisionPackageView, DependencyAddRequest, ExpectationView, FocusTaskRef, FocusView, ObligationView,
  TaskView, TimelineItem
} from "../../components/redesign";
import type { TaskAction } from "../../components/redesign";
import type { PageNavTarget } from "./nav";

/* ---------- 对接合同:接线线按此形状灌数据(字段语义见同目录 README.md) ---------- */
export interface FocusPageView {
  focus: FocusView;
  /** P0 时间线(HANDOFF-1 §3:无 confirm 历史成员、无逐轮 turn 成员) */
  timeline: TimelineItem[];
  /** DAILY-01:支线(泳道页签) */
  lanes: { id: string; title: string; retired?: boolean }[];
  /** DAILY-01:本 Focus 绑定任务(泳道/依赖页签数据源) */
  focusTasks: FocusTaskRef[];
  /** 上下文页签数据(安排/产物/涉及项目/记住的事;DAILY-01 起不再常驻右栏) */
  rail: {
    obligations: ObligationView[];
    tasks: TaskView[];
    artifacts: ArtifactView[];
    projects: { id: string; title: string; path: string }[];
    memories: { id: string; tier: string; trust: "user_stated" | "user_approved" | "auto_low_impact"; text: string }[];
  };
  /** 期待组(验收标准+expected artifacts 的派生视图);可选容错——HANDOFF-2 §1 */
  expectations?: ExpectationView[];
  /** 时间线引用查找表;缺 key 时该条目渲染诚实占位,不伪造内容 */
  lookups?: {
    tasks?: Record<string, TaskView>;
    packages?: Record<string, DecisionPackageView>;
    obligations?: Record<string, ObligationView>;
    progress?: Record<string, {
      expectation?: ExpectationView;
      nextStepText?: string;
      pkgSteps?: { done: number; total: number };
    }>;
  };
  /**
   * 拍板(JOURNEY-01):活跃采访卡仅从已归属本 focus、且对得上已提交锚定代次的 live 轮投影。
   * 有 question 即可渲染,options 可空(开放回答),不伪造选项。
   * interview_pick 必须核对 focus / requestId 代次 / 原 turnId 后才发 turn.text。
   */
  interview?: {
    question: string;
    options: string[];
    recommended?: string;
    picked?: string | null;
    sessionId?: string;
    turnId?: string;
    focusId?: string;
    anchorRequestId?: string;
    anchorGeneration?: number;
  } | null;
  /** 当前 voice.sessionId 是否已归属本 focus */
  sessionOwned?: boolean;
}

export type FocusPageAction =
  | { type: "task"; taskId: string; action: TaskAction }
  | { type: "pkg"; packageId: string; revision?: number; action: "select_mode" | "approve" | "revise" | "edit_expectation"; payload?: string }
  | { type: "standby"; obligationRef: string; action: "simulate_wake" }
  | { type: "interview_pick"; option: string }
  | { type: "locate"; target: { kind: "obligation" | "task" | "artifact" | "project"; id: string } }
  | { type: "expect" }
  | { type: "expectation_edit"; target: { kind: "direction" | "acceptance" | "artifacts" | "budget"; index?: number } }
  | { type: "dep_add"; req: DependencyAddRequest }
  | { type: "dep_undo"; obligationId: string }
  | { type: "fork" };

const HALT = ["closed", "abandoned", "archived"];

function MissingRef({ what, refId }: { what: string; refId: string }) {
  return (
    <div style={{ ...card, border: "1px dashed var(--line)" }} data-missing-ref={refId}>
      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
        {what}({refId})的数据没有随页面传入——诚实占位,不伪造内容。
      </span>
    </div>
  );
}

/** 事内摘要条:计数 + 可点开的安排(DAILY-01 右栏改按需页签后常驻;安排按钮走 locate 动作) */
function RailSummaryStrip({ view, onOpenObligation }: {
  view: FocusPageView;
  onOpenObligation?: (id: string) => void;
}) {
  const obs = view.rail.obligations;
  const humanObs = obs.filter(o => o.owner === "human" && ["open", "blocked"].includes(o.status));
  const human = humanObs.length;
  const agent = obs.filter(o => o.owner === "agent" && ["open", "in_progress"].includes(o.status)).length
    + view.focusTasks.filter(t => ["running", "queued", "confirmed", "paused_step_boundary", "waiting_confirmation", "merging"].includes(t.status)).length;
  const external = obs.filter(o => o.owner === "external" && ["waiting", "deferred"].includes(o.status)).length
    + obs.filter(o => o.owner === "agent" && o.status === "waiting").length;
  const deps = obs.filter(o => o.waitingOnObligationId || o.waitingOnTaskId).length;
  const exp = view.expectations?.[0];
  const risk = exp ? exp.acceptance.filter(a => a.state === "at_risk").length : 0;
  const items: { text: string; color?: string }[] = [
    { text: `等你 ${human} 件`, color: human ? "var(--color-warning)" : undefined },
    { text: `我在做 ${agent} 件`, color: agent ? "var(--color-success)" : undefined },
    { text: `等外部/待命 ${external} 件` },
    { text: `产物 ${view.rail.artifacts.length} 件` },
    ...(deps ? [{ text: `依赖 ${deps} 条`, color: "var(--color-info)" }] : []),
    ...(exp ? [{ text: `期待 r${exp.revision}${risk ? ` · ${risk} 处偏差` : " · 对齐中"}`, color: risk ? "var(--color-error)" : undefined }] : [])
  ];
  return (
    <div className="rdp-rail-summary" style={{ flexDirection: "column", gap: "var(--space-2)", padding: "var(--space-2) 0" }}>
      <div style={{ display: "flex", gap: "var(--space-2)", overflowX: "auto", alignItems: "center" }}>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", flex: "none" }}>摘要:</span>
        {items.map((it, i) => (
          <span
            key={i}
            style={{
              flex: "none", fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)",
              padding: "3px 10px", borderRadius: "var(--radius-pill)",
              border: "1px solid var(--line)", color: it.color ?? "var(--text-muted)",
              background: "var(--surface-soft)"
            }}
          >
            {it.text}
          </span>
        ))}
      </div>
      {humanObs.length && onOpenObligation ? (
        <div data-mobile-obligations style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
          {humanObs.map((o) => (
            <button
              key={o.id}
              type="button"
              data-mobile-obligation={o.id}
              aria-label={`打开安排:${o.title}`}
              onClick={() => onOpenObligation(o.id)}
              style={{
                maxWidth: "100%",
                textAlign: "left",
                fontSize: "var(--text-xs)",
                lineHeight: 1.5,
                padding: "6px 10px",
                borderRadius: "var(--radius-xs)",
                border: "1px solid var(--line)",
                background: "var(--surface-raised)",
                color: "var(--text-primary)",
                cursor: "pointer"
              }}
            >
              {o.title}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** DAILY-01:事内按需页签(设计包 R08——上下文不进常驻右栏,想看再点) */
type FocusTab = "convo" | "artifacts" | "lanes" | "deps" | "context";

const FOCUS_TABS: { key: FocusTab; label: string }[] = [
  { key: "convo", label: "对话" },
  { key: "artifacts", label: "产物" },
  { key: "lanes", label: "泳道" },
  { key: "deps", label: "依赖" },
  { key: "context", label: "上下文" }
];

/** 对话页工作面:时间线未引用的任务/待批包仍可见,无任务 pending 包也能拍板对应包。 */
function FocusWorkSurface({ view, onAction }: { view: FocusPageView; onAction?: (action: FocusPageAction) => void }) {
  const timelineTaskIds = new Set(view.timeline.filter((i) => i.kind === "task").map((i) => i.taskRef));
  const timelinePkgIds = new Set(view.timeline.filter((i) => i.kind === "pkg").map((i) => i.packageRef));
  const tasks = view.rail.tasks.filter((t) => t.id && !timelineTaskIds.has(t.id));
  const seen = new Set<string>();
  const packages: DecisionPackageView[] = [];
  for (const [key, pkg] of Object.entries(view.lookups?.packages ?? {})) {
    if (!pkg.id || seen.has(pkg.id) || timelinePkgIds.has(pkg.id) || timelinePkgIds.has(key)) continue;
    seen.add(pkg.id);
    packages.push(pkg);
  }
  if (tasks.length === 0 && packages.length === 0) return null;
  return (
    <div data-focus-work-surface style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {tasks.map((t) => (
        <div key={t.id} data-focus-work-task={t.id}>
          <TaskCard task={t} onAction={(a) => onAction?.({ type: "task", taskId: t.id, action: a })} />
        </div>
      ))}
      {packages.map((p) => (
        <div key={`${p.id}@${p.revision}`} data-focus-work-pkg={p.id} data-focus-work-pkg-rev={p.revision}>
          <DecisionPackageCard
            pkg={p}
            onAction={(a, payload) => onAction?.({ type: "pkg", packageId: p.id, revision: p.revision, action: a, payload })}
          />
        </div>
      ))}
    </div>
  );
}

const tabBtn = (active: boolean): React.CSSProperties => ({
  padding: "7px 14px",
  borderRadius: "var(--radius-xs)",
  border: "1px solid var(--line)",
  background: active ? "var(--selected-wash)" : "transparent",
  color: active ? "var(--active-ink)" : "var(--text-secondary)",
  fontSize: "var(--text-sm)",
  fontWeight: active ? 500 : 400,
  cursor: "pointer"
});

const OB_STATUS_LABEL: Record<string, string> = {
  open: "待办", in_progress: "进行中", waiting: "等待", deferred: "搁置",
  blocked: "卡住", resolved: "已收尾", superseded: "已被替代"
};

/** 泳道页签:支线 × 义务/任务(只读呈现;结构操作在「记录」页) */
function LanesTab({ view }: { view: FocusPageView }) {
  const obs = view.rail.obligations;
  const lanes = view.lanes.length ? view.lanes : [{ id: "__main__", title: "主线" }];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }} data-focus-tab="lanes">
      {lanes.map((lane) => {
        const laneObs = obs.filter((o) => lane.id === "__main__" ? !o.laneId : o.laneId === lane.id);
        const laneTasks = view.focusTasks.filter((t) => t.laneId === lane.id || (lane.id === "__main__" && !t.laneId));
        return (
          <div key={lane.id} style={{ ...card, padding: "var(--space-3) var(--space-4)" }} data-focus-lane={lane.id}>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: 6, color: lane.retired ? "var(--text-faint)" : undefined }}>
              {lane.title}{lane.retired ? "(已收)" : ""}
            </div>
            {laneTasks.length === 0 && laneObs.length === 0 ? (
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>这条线还没有挂任务或义务。</span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {laneTasks.map((t) => (
                  <span key={t.id} style={{ fontSize: "var(--text-xs)" }} data-focus-lane-task={t.id}>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}>任务</span> {t.title}
                    <span style={{ color: "var(--text-faint)" }}> · {t.status}</span>
                  </span>
                ))}
                {laneObs.map((o) => (
                  <span key={o.id} style={{ fontSize: "var(--text-xs)" }} data-focus-lane-ob={o.id}>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}>{o.owner}</span> {o.title}
                    <span style={{ color: "var(--text-faint)" }}> · {OB_STATUS_LABEL[o.status] ?? o.status}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
        支线结构操作(新建/收线/重走)在「记录」页;这里是查看视图。
      </div>
    </div>
  );
}

/** 产物页签:本 Focus 产物清单(版本对比在项目产物库) */
function ArtifactsTab({ view }: { view: FocusPageView }) {
  const arts = view.rail.artifacts;
  if (arts.length === 0) {
    return <div style={{ ...card, fontSize: "var(--text-sm)", color: "var(--text-muted)" }} data-focus-tab="artifacts">这件事还没有产物;产物落地会出现在这里。</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }} data-focus-tab="artifacts">
      {arts.map((a) => (
        <div key={a.id} style={{ ...card, padding: "var(--space-3) var(--space-4)" }} data-focus-artifact={a.id}>
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
            <strong style={{ fontSize: "var(--text-sm)" }}>{a.title}</strong>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
              {a.kind} · {a.role}
            </span>
          </div>
        </div>
      ))}
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
        逐行 diff 与任意选版对比在项目产物库(/p/项目/artifacts)。
      </div>
    </div>
  );
}

export function FocusPage({ view, composerSlot, onNavigate, onAction, onExpandSegment, initialTab }: {
  view: FocusPageView;
  /** 活跃态输入区插槽:语音 composer 由接线线挂载(HANDOFF-2 §2);停机态渲染 ComposerHaltBar */
  composerSlot?: ReactNode;
  onNavigate?: (target: PageNavTarget) => void;
  onAction?: (action: FocusPageAction) => void;
  /** 会话段转写懒加载:接线层按 sessionRef 拉取,页面不 fetch */
  onExpandSegment?: (sessionRef: string) => Promise<string[] | null> | string[] | null;
  /** DAILY-01:页签深链入口(#/focus/:id?tab=deps);非法值回落对话 */
  initialTab?: string;
}) {
  const f = view.focus;
  const lookups = view.lookups ?? {};
  const [compact, setCompact] = useState(false);
  const [tab, setTab] = useState<FocusTab>(
    FOCUS_TABS.some((t) => t.key === initialTab) ? (initialTab as FocusTab) : "convo"
  );
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTab(FOCUS_TABS.some((t) => t.key === initialTab) ? (initialTab as FocusTab) : "convo");
  }, [initialTab]);

  // 滚动态压缩单行(评审 U6):哨兵滚出视口顶 = statecard 被 sticky 吸住
  useEffect(() => {
    const onScroll = () => {
      const el = sentinelRef.current;
      if (!el) return;
      setCompact(el.getBoundingClientRect().top < 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const timelineNode = (item: TimelineItem) => {
    switch (item.kind) {
      case "note":
        return <TimelineNote text={item.text} />;
      case "event":
        return (
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", fontFamily: "var(--font-mono)", padding: "0 var(--space-2)" }}>
            {item.eventType} · {item.text}
          </div>
        );
      case "session_segment":
        return (
          <SessionSegmentCard
            sessionRef={item.sessionRef}
            turnCount={item.turnCount}
            startTs={item.startTs}
            endTs={item.endTs}
            transcriptAvailable={item.transcriptAvailable}
            live={item.live}
            onExpand={onExpandSegment ? () => onExpandSegment(item.sessionRef) : undefined}
          />
        );
      case "task": {
        const t = lookups.tasks?.[item.taskRef];
        return t
          ? <TaskCard task={t} onAction={(a) => onAction?.({ type: "task", taskId: t.id, action: a })} />
          : <MissingRef what="任务" refId={item.taskRef} />;
      }
      case "entity":
        return (
          <div style={{ ...card, borderLeft: "3px solid var(--active-ink)", padding: "var(--space-3) var(--space-4)" }} data-timeline-entity={item.artifactRef}>
            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
              <Sparkles size={14} aria-hidden style={{ color: "var(--active-ink)" }} />
              <strong style={{ fontSize: "var(--text-sm)" }}>{item.title}</strong>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>{item.sub}</span>
            </div>
          </div>
        );
      case "pkg": {
        const p = lookups.packages?.[item.packageRef];
        return p
          ? <DecisionPackageCard pkg={p} onAction={(a, payload) => onAction?.({ type: "pkg", packageId: p.id, revision: p.revision, action: a, payload })} />
          : <MissingRef what="决策包" refId={item.packageRef} />;
      }
      case "progress": {
        const d = item.expectationRef ? lookups.progress?.[item.expectationRef] : undefined;
        return <ProgressAlignCard expectation={d?.expectation} nextStepText={d?.nextStepText} pkgSteps={d?.pkgSteps} />;
      }
      case "standby": {
        const o = lookups.obligations?.[item.obligationRef];
        if (!o) return <MissingRef what="待命安排" refId={item.obligationRef} />;
        const woken = o.status === "resolved";
        return (
          <StandbyCard
            waitingText={o.waitingOn ?? o.title}
            wakeCondition={o.dueOrTrigger ?? "(账上未写到时兜底)"}
            woken={woken}
            wokenText={woken ? `「${o.title}」已了结,后续安排自动醒。` : undefined}
            onAction={onAction ? (a) => onAction({ type: "standby", obligationRef: item.obligationRef, action: a }) : undefined}
          />
        );
      }
    }
  };

  return (
    <div className="rdp-focus-page" data-page="redesign-focus" style={{ maxWidth: 860, margin: "0 auto" }}>
      <div ref={sentinelRef} style={{ height: 1 }} aria-hidden />
      <FocusStateCard
        focus={f}
        sticky
        compact={compact}
        onOpenRecords={onNavigate ? () => onNavigate({ page: "records", focusId: f.id }) : undefined}
      />
      <RailSummaryStrip
        view={view}
        onOpenObligation={onAction ? (id) => onAction({ type: "locate", target: { kind: "obligation", id } }) : undefined}
      />

      {/* DAILY-01:按需页签——对话/产物/泳道/依赖/记录(跳页)/上下文;上下文不再常驻右栏 */}
      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", margin: "var(--space-3) 0 var(--space-4)" }} data-focus-tabs>
        {FOCUS_TABS.map((t) => (
          <button key={t.key} type="button" style={tabBtn(tab === t.key)} data-focus-tab-btn={t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
        <button
          type="button"
          style={tabBtn(false)}
          data-focus-tab-btn="records"
          onClick={() => onNavigate?.({ page: "records", focusId: f.id })}
        >
          记录
        </button>
      </div>

      {tab === "convo" ? (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }} data-focus-tab="convo">
            {view.timeline.map(item => <div key={item.seq}>{timelineNode(item)}</div>)}
            <FocusWorkSurface view={view} onAction={onAction} />
            {view.interview ? (
              <InterviewCard
                question={view.interview.question}
                options={view.interview.options}
                recommended={view.interview.recommended}
                picked={view.interview.picked}
                onPick={onAction ? (o) => onAction({ type: "interview_pick", option: o }) : undefined}
              />
            ) : null}
          </div>
          <div style={{ marginTop: "var(--space-4)" }}>
            {HALT.includes(f.lifecycle) ? (
              <ComposerHaltBar lifecycle={f.lifecycle} onFork={onAction ? () => onAction({ type: "fork" }) : undefined} />
            ) : (
              composerSlot ?? (
                <div style={{ ...card, border: "1px dashed var(--line)", background: "transparent", padding: "var(--space-3) var(--space-4)" }}>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
                    composerSlot 占位:活跃态语音输入区由接线线挂载(HANDOFF-2 §5)
                  </span>
                </div>
              )
            )}
          </div>
        </>
      ) : null}

      {tab === "artifacts" ? <ArtifactsTab view={view} /> : null}
      {tab === "lanes" ? <LanesTab view={view} /> : null}
      {tab === "deps" ? (
        <div data-focus-tab="deps">
          <DependencyCard
            obligations={view.rail.obligations}
            tasks={view.focusTasks}
            onAdd={onAction ? (req) => onAction({ type: "dep_add", req }) : undefined}
            onUndo={onAction ? (obligationId) => onAction({ type: "dep_undo", obligationId }) : undefined}
          />
        </div>
      ) : null}
      {tab === "context" ? (
        <div data-focus-tab="context" style={{ maxWidth: 420 }}>
          <FocusRail
            obligations={view.rail.obligations}
            tasks={view.rail.tasks}
            artifacts={view.rail.artifacts}
            projects={view.rail.projects}
            memories={view.rail.memories}
            onLocate={onAction ? (target) => onAction({ type: "locate", target }) : undefined}
            onExpect={onAction ? () => onAction({ type: "expect" }) : undefined}
            afterArtifacts={view.expectations?.map((e, i) => (
              <ExpectationGroup
                key={i}
                expectation={e}
                onEdit={onAction ? (target) => onAction({ type: "expectation_edit", target }) : undefined}
              />
            ))}
          />
        </div>
      ) : null}
    </div>
  );
}
