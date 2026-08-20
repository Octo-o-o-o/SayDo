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
  ComposerHaltBar, DecisionPackageCard, ExpectationGroup, FocusRail, FocusStateCard,
  InterviewCard, ProgressAlignCard, SessionSegmentCard, StandbyCard, TaskCard, TimelineNote,
  card
} from "../../components/redesign";
import type {
  ArtifactView, DecisionPackageView, ExpectationView, FocusView, ObligationView,
  TaskView, TimelineItem
} from "../../components/redesign";
import type { TaskAction } from "../../components/redesign";
import type { PageNavTarget } from "./nav";

/* ---------- 对接合同:接线线按此形状灌数据(字段语义见同目录 README.md) ---------- */
export interface FocusPageView {
  focus: FocusView;
  /** P0 时间线(HANDOFF-1 §3:无 confirm 历史成员、无逐轮 turn 成员) */
  timeline: TimelineItem[];
  /** 右栏四组数据(安排/产物/涉及项目/记住的事) */
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
   * OPEN QUESTION:HANDOFF-2 §2 拼装清单含 Interview 卡,但 HANDOFF-1 §3 的
   * TimelineItem 无 interview 成员(活跃交互卡疑似归 live 通道)。暂放页面级可选字段,
   * 渲染在时间线末尾;归位待交接双方拍板。
   */
  interview?: { question: string; options: string[]; recommended?: string; picked?: string | null } | null;
}

export type FocusPageAction =
  | { type: "task"; taskId: string; action: TaskAction }
  | { type: "pkg"; packageId: string; action: "select_mode" | "approve" | "revise" | "edit_expectation"; payload?: string }
  | { type: "standby"; obligationRef: string; action: "simulate_wake" }
  | { type: "interview_pick"; option: string }
  | { type: "locate"; target: { kind: "obligation" | "task" | "artifact" | "project"; id: string } }
  | { type: "expect" }
  | { type: "expectation_edit"; target: { kind: "direction" | "acceptance" | "artifacts" | "budget"; index?: number } }
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

/** 窄屏横向摘要条:右栏的数字压成一行,只读,不替代操作面 */
function RailSummaryStrip({ view }: { view: FocusPageView }) {
  const obs = view.rail.obligations;
  const human = obs.filter(o => o.owner === "human" && ["open", "blocked"].includes(o.status)).length;
  const agent = obs.filter(o => o.owner === "agent" && ["open", "in_progress"].includes(o.status)).length
    + view.rail.tasks.filter(t => ["running", "queued", "confirmed", "paused_step_boundary", "waiting_confirmation", "merging"].includes(t.viewStatus)).length;
  const external = obs.filter(o => o.owner === "external" && ["waiting", "deferred"].includes(o.status)).length
    + obs.filter(o => o.owner === "agent" && o.status === "waiting").length;
  const exp = view.expectations?.[0];
  const risk = exp ? exp.acceptance.filter(a => a.state === "at_risk").length : 0;
  const items: { text: string; color?: string }[] = [
    { text: `等你 ${human} 件`, color: human ? "var(--color-warning)" : undefined },
    { text: `我在做 ${agent} 件`, color: agent ? "var(--color-success)" : undefined },
    { text: `等外部/待命 ${external} 件` },
    { text: `产物 ${view.rail.artifacts.length} 件` },
    ...(exp ? [{ text: `期待 r${exp.revision}${risk ? ` · ${risk} 处偏差` : " · 对齐中"}`, color: risk ? "var(--color-error)" : undefined }] : [])
  ];
  return (
    <div className="rdp-rail-summary" style={{ gap: "var(--space-2)", overflowX: "auto", padding: "var(--space-2) 0", alignItems: "center" }}>
      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", flex: "none" }}>右栏摘要:</span>
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
  );
}

export function FocusPage({ view, composerSlot, onNavigate, onAction, onExpandSegment }: {
  view: FocusPageView;
  /** 活跃态输入区插槽:语音 composer 由接线线挂载(HANDOFF-2 §2);停机态渲染 ComposerHaltBar */
  composerSlot?: ReactNode;
  onNavigate?: (target: PageNavTarget) => void;
  onAction?: (action: FocusPageAction) => void;
  /** 会话段转写懒加载:接线层按 sessionRef 拉取,页面不 fetch */
  onExpandSegment?: (sessionRef: string) => Promise<string[] | null> | string[] | null;
}) {
  const f = view.focus;
  const lookups = view.lookups ?? {};
  const [compact, setCompact] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

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
          ? <DecisionPackageCard pkg={p} onAction={(a, payload) => onAction?.({ type: "pkg", packageId: p.id, action: a, payload })} />
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
    <div className="rdp-focus-page" data-page="redesign-focus" style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div className="rdp-focus-layout">
        <div className="rdp-convo-col">
          <div ref={sentinelRef} style={{ height: 1 }} aria-hidden />
          <FocusStateCard
            focus={f}
            sticky
            compact={compact}
            onOpenRecords={onNavigate ? () => onNavigate({ page: "records", focusId: f.id }) : undefined}
          />
          <RailSummaryStrip view={view} />
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
            {view.timeline.map(item => <div key={item.seq}>{timelineNode(item)}</div>)}
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
        </div>

        <div className="rdp-focus-rail-full">
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
      </div>

      <style>{`
        .rdp-focus-layout { display: grid; grid-template-columns: minmax(0,1fr) 300px; gap: var(--space-5); align-items: start; }
        .rdp-focus-rail-full { position: sticky; top: 0; max-height: 100vh; overflow-y: auto; padding-bottom: var(--space-5); }
        .rdp-rail-summary { display: none; }
        @media (max-width: 1100px) {
          .rdp-focus-layout { grid-template-columns: 1fr; }
          .rdp-focus-rail-full { display: none; }
          .rdp-rail-summary { display: flex; }
        }
        .rdp-force-narrow .rdp-focus-layout { grid-template-columns: 1fr; }
        .rdp-force-narrow .rdp-focus-rail-full { display: none; }
        .rdp-force-narrow .rdp-rail-summary { display: flex; }
      `}</style>
    </div>
  );
}
