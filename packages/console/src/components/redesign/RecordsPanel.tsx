// RecordsPanel(demo renderRecords):工程航迹面——支线航迹(lanes×事件序)/依赖链/会话段/事件流/操作区。
// 「记录」不是用户天天看的地方;操作全部回调(归档/放弃/重开/fork/线操作/解除依赖/redo preview);
// closed 只能 fork;归档/放弃理由必填(由容器弹表单,组件只发回调)。
// DAILY-01:依赖链换共享 DependencyPanel(义务级+任务级,可加可解);支线补 恢复线/新建支线;
// 从此步重走 = 两步 preview→confirm 弹窗(容器承载);四个分区改为页签(航迹/依赖/会话段/事件);
// 支线行可展开看该线事件详情(事件级「从此步重走」把 seq 作为锚点上抛)。

import { useState } from "react";
import { ChevronDown, ChevronRight, History, Plus } from "lucide-react";
import { ActionRow, Btn, card } from "./shared";
import { DependencyCard, type DependencyAddRequest, type FocusTaskRef } from "./DependencyPanel";
import { SessionSegmentCard } from "./TimelineNote";
import type { FocusView, ObligationView } from "./types";

export type RecordsAction =
  | { type: "archive" } | { type: "abandon" } | { type: "reopen" } | { type: "fork" }
  | { type: "lane_op"; op: "retire" | "unretire" | "redo" | "continue"; laneId: string; anchorSeq?: number }
  | { type: "lane_create" }
  | { type: "dependency_undo"; obligationId: string }
  | { type: "dependency_add"; req: DependencyAddRequest }
  | { type: "redo_preview" } | { type: "back" };

export interface RecordsEvent {
  seq: number;
  type: string;
  text: string;
  laneId?: string;
}

function LaneDotline({ events, current }: { events: number; current?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      {Array.from({ length: events }).map((_, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
          {i > 0 ? <i style={{ width: 16, height: 1.5, background: "var(--line-soft)", flex: "none" }} /> : null}
          <i style={{ width: 8, height: 8, borderRadius: "50%", background: i === events - 1 && current ? "var(--color-warning)" : "var(--active-ink)", flex: "none" }} />
        </span>
      ))}
    </span>
  );
}

/**
 * 航迹网格(设计 33_branch_history):全局事件轴 × 支线占位格。
 * 每个格子 = 一个事件序位;事件落在所属支线的行上,点选看详情;
 * −/+ 缩放只改格宽(展示层,不动数据);occupied 之外的格子是空位。
 */
function TrajectoryGrid({
  lanes,
  events,
  selectedSeq,
  onSelect
}: {
  lanes: { id: string; title: string; retired?: boolean }[];
  events: RecordsEvent[];
  selectedSeq: number | null;
  onSelect: (seq: number | null) => void;
}) {
  const [scale, setScale] = useState(1);
  const step = Math.max(14, Math.round(26 * scale));
  const sorted = events.slice().sort((a, b) => a.seq - b.seq);
  const laneOf = (e: RecordsEvent) => e.laneId ?? "__main__";
  return (
    <div data-trajectory-grid>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: "var(--space-2)", flexWrap: "wrap" }}>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>事件序 · {sorted.length}</span>
        <span style={{ flex: 1 }} />
        <Btn aria-label="缩小航迹" onClick={() => setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)))}>−</Btn>
        <span style={{ fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{Math.round(scale * 100)}%</span>
        <Btn aria-label="放大航迹" onClick={() => setScale((s) => Math.min(2.5, +(s + 0.25).toFixed(2)))}>+</Btn>
      </div>
      <div style={{ overflowX: "auto" }} tabIndex={0} aria-label="可横向滚动的支线航迹">
        <div style={{ minWidth: 110 + sorted.length * step }}>
          <div style={{ display: "grid", gridTemplateColumns: `104px repeat(${sorted.length}, ${step}px)`, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "var(--text-faint)" }}>支线</span>
            {sorted.map((e) => (
              <span key={`ax${e.seq}`} style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-faint)", textAlign: "center" }}>
                {e.seq}
              </span>
            ))}
          </div>
          {lanes.map((l) => (
            <div
              key={l.id}
              data-trajectory-row={l.id}
              style={{ display: "grid", gridTemplateColumns: `104px repeat(${sorted.length}, ${step}px)`, alignItems: "center", borderTop: "1px dotted var(--line-soft)", padding: "3px 0" }}
            >
              <span style={{ fontSize: 10, color: l.retired ? "var(--text-faint)" : "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {l.title}
              </span>
              {sorted.map((e) => {
                const mine = laneOf(e) === l.id;
                return (
                  <span key={e.seq} style={{ display: "grid", placeItems: "center", height: 14 }}>
                    {mine ? (
                      <button
                        type="button"
                        data-trajectory-dot={e.seq}
                        aria-label={`#${e.seq} ${e.type}`}
                        aria-pressed={selectedSeq === e.seq}
                        onClick={() => onSelect(selectedSeq === e.seq ? null : e.seq)}
                        style={{
                          width: 9, height: 9, borderRadius: "50%", padding: 0, cursor: "pointer",
                          border: selectedSeq === e.seq ? "2px solid var(--color-warning)" : "none",
                          background: selectedSeq === e.seq ? "var(--color-warning)" : "var(--active-ink)"
                        }}
                      />
                    ) : null}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type RecordsTab = "lanes" | "deps" | "segments" | "events";
const RECORDS_TABS: { key: RecordsTab; label: string }[] = [
  { key: "lanes", label: "支线航迹" },
  { key: "deps", label: "依赖" },
  { key: "segments", label: "会话段" },
  { key: "events", label: "事件流" }
];

const recTabBtn = (active: boolean): React.CSSProperties => ({
  padding: "6px 14px",
  borderRadius: "var(--radius-xs)",
  border: "1px solid var(--line)",
  background: active ? "var(--selected-wash)" : "transparent",
  color: active ? "var(--active-ink)" : "var(--text-secondary)",
  fontSize: "var(--text-xs)",
  cursor: "pointer"
});

export function RecordsPanel({ focus, lanes, dependencies, obligations, tasks, segments, events, onAction, onExpandSegment }: {
  focus: FocusView;
  lanes: { id: string; title: string; eventCount: number; retired?: boolean }[];
  /** 依赖边列表(等待中);解除依赖走 dependency_undo */
  dependencies: ObligationView[];
  /** DAILY-01:本 Focus 全部义务(依赖候选集) */
  obligations: ObligationView[];
  /** DAILY-01:本 Focus 绑定任务(任务级前置候选集) */
  tasks: FocusTaskRef[];
  segments: { sessionRef: string; label: string; turnCount: number; closed: boolean; transcriptAvailable: boolean; live?: boolean }[];
  events: RecordsEvent[];
  onAction?: (action: RecordsAction) => void;
  onExpandSegment?: (sessionRef: string) => Promise<string[] | null> | string[] | null;
}) {
  const canArchive = ["active", "captured", "dormant"].includes(focus.lifecycle);
  const canAbandon = ["active", "dormant", "archived"].includes(focus.lifecycle);
  const canReopen = focus.lifecycle === "archived";
  const canFork = focus.lifecycle === "closed" || focus.lifecycle === "abandoned" || focus.lifecycle === "archived";
  const emit = (a: RecordsAction) => onAction?.(a);
  const [tab, setTab] = useState<RecordsTab>("lanes");
  const [openLane, setOpenLane] = useState<string | null>(null);
  const [selSeq, setSelSeq] = useState<number | null>(null);
  const selEvent = selSeq === null ? null : events.find((e) => e.seq === selSeq) ?? null;

  const laneEvents = (laneId: string) =>
    events
      .filter((e) => (laneId === "__main__" ? !e.laneId : e.laneId === laneId))
      .slice()
      .sort((a, b) => a.seq - b.seq);

  return (
    <div data-records-panel={focus.id}>
      <div style={{ marginBottom: "var(--space-3)" }}>
        <Btn icon={ChevronRight} onClick={() => emit({ type: "back" })}>回到对话</Btn>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: "var(--text-xl)", fontWeight: 600 }}>记录 · {focus.title}</span>
        {canArchive ? <Btn onClick={() => emit({ type: "archive" })}>归档(封存可重开)</Btn> : null}
        {canAbandon ? <Btn onClick={() => emit({ type: "abandon" })}>放弃(主动中止)</Btn> : null}
        {canReopen ? <Btn variant="ink-outline" onClick={() => emit({ type: "reopen" })}>重开</Btn> : null}
        {canFork ? <Btn variant="primary" icon={Plus} onClick={() => emit({ type: "fork" })}>fork 一件新的</Btn> : null}
      </div>
      <div style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", marginBottom: "var(--space-4)" }}>
        工程航迹、事件流与版本在这里。这是「记录」,不是你要天天看的地方。归档/放弃要填理由;closed 只能 fork 新 Focus;有在途任务的 Focus 不能归档。
      </div>

      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-4)" }} data-records-tabs>
        {RECORDS_TABS.map((t) => (
          <button key={t.key} type="button" style={recTabBtn(tab === t.key)} data-records-tab={t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "lanes" ? (
        <div style={{ ...card, marginBottom: "var(--space-4)" }} data-records-pane="lanes">
          <div style={{ fontSize: "var(--text-md)", fontWeight: 600, marginBottom: "var(--space-2)", display: "flex", gap: 8, alignItems: "center" }}>
            支线航迹(lanes × 事件序)
            <span style={{ flex: 1 }} />
            <Btn icon={Plus} onClick={() => emit({ type: "lane_create" })}>新建支线</Btn>
          </div>
          <TrajectoryGrid lanes={lanes} events={events} selectedSeq={selSeq} onSelect={setSelSeq} />
          {selEvent ? (
            <div
              data-trajectory-detail={selEvent.seq}
              style={{ margin: "var(--space-2) 0 var(--space-3)", padding: "var(--space-2) var(--space-3)", border: "1px solid var(--line)", borderRadius: "var(--radius-xs)", background: "var(--surface-soft)", fontSize: "var(--text-xs)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
            >
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}>#{selEvent.seq} {selEvent.type}</span>
              <span style={{ flex: 1, minWidth: 200, color: "var(--text-secondary)" }}>{selEvent.text}</span>
              {(selEvent.laneId ?? "__main__") !== "__main__" ? (
                <Btn onClick={() => emit({ type: "lane_op", op: "redo", laneId: selEvent.laneId as string, anchorSeq: selEvent.seq })}>从此步重走</Btn>
              ) : null}
            </div>
          ) : null}
          {lanes.map((l) => {
            const evs = laneEvents(l.id);
            const open = openLane === l.id;
            return (
              <div key={l.id} style={{ borderBottom: "1px dashed var(--line)", padding: "7px 0" }}>
                <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    data-lane-expand={l.id}
                    onClick={() => setOpenLane(open ? null : l.id)}
                    style={{
                      fontSize: "var(--text-xs)", color: l.retired ? "var(--text-faint)" : "var(--text-muted)",
                      width: 96, flex: "none", textAlign: "left", background: "none", border: "none",
                      padding: 0, cursor: "pointer", font: "inherit",
                      display: "inline-flex", alignItems: "center", gap: 4
                    }}
                    aria-expanded={open}
                  >
                    {open ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />}
                    {l.title}{l.retired ? "(已收)" : ""}
                  </button>
                  <LaneDotline events={l.eventCount} current={!l.retired} />
                  <span style={{ flex: 1 }} />
                  {l.id !== "__main__" ? (
                    l.retired ? (
                      <Btn onClick={() => emit({ type: "lane_op", op: "unretire", laneId: l.id })}>恢复线</Btn>
                    ) : (
                      <Btn onClick={() => emit({ type: "lane_op", op: "retire", laneId: l.id })}>收起线</Btn>
                    )
                  ) : null}
                  {l.id !== "__main__" ? (
                    <Btn onClick={() => emit({ type: "lane_op", op: "redo", laneId: l.id })}>从此步重走</Btn>
                  ) : null}
                  <Btn onClick={() => emit({ type: "lane_op", op: "continue", laneId: l.id })}>在此线续推</Btn>
                </div>
                {open ? (
                  <div style={{ margin: "var(--space-2) 0 var(--space-2) 104px", fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)" }} data-lane-events={l.id}>
                    {evs.length === 0 ? (
                      <div style={{ color: "var(--text-faint)" }}>这条线还没有记账事件。</div>
                    ) : (
                      evs.map((e) => (
                        <div key={e.seq} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "3px 0", borderBottom: "1px dotted var(--line-soft)" }}>
                          <span style={{ color: "var(--text-faint)", flex: "none" }}>#{e.seq}</span>
                          <span style={{ color: "var(--text-muted)", flex: "none" }}>{e.type}</span>
                          <span style={{ flex: 1, minWidth: 0, color: "var(--text-secondary)" }}>{e.text}</span>
                          {l.id !== "__main__" ? (
                            <Btn onClick={() => emit({ type: "lane_op", op: "redo", laneId: l.id, anchorSeq: e.seq })}>从此步</Btn>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", marginTop: "var(--space-2)" }}>
            圆点=事件,橙点=当前水位;点支线名展开事件详情(范围快照随 redo_from 事件 baseline 落账)。重走不改历史字节:锚点前事件原样保留。
          </div>
        </div>
      ) : null}

      {tab === "deps" ? (
        <div data-records-pane="deps">
          <DependencyCard
            obligations={obligations.length ? obligations : dependencies}
            tasks={tasks}
            onAdd={onAction ? (req) => emit({ type: "dependency_add", req }) : undefined}
            onUndo={onAction ? (obligationId) => emit({ type: "dependency_undo", obligationId }) : undefined}
          />
        </div>
      ) : null}

      {tab === "segments" ? (
        <div style={{ ...card, marginBottom: "var(--space-4)" }} data-records-pane="segments">
          <div style={{ fontSize: "var(--text-md)", fontWeight: 600, marginBottom: "var(--space-2)" }}>会话段(历史=段+展开,当前会话=逐轮)</div>
          {segments.length ? segments.map(s => (
            <div key={s.sessionRef} style={{ marginBottom: "var(--space-2)" }}>
              <SessionSegmentCard
                sessionRef={s.sessionRef}
                turnCount={s.turnCount}
                startTs={s.label}
                endTs={s.closed ? "已收场" : null}
                transcriptAvailable={s.transcriptAvailable}
                live={s.live}
                onExpand={onExpandSegment ? () => onExpandSegment(s.sessionRef) : undefined}
              />
            </div>
          )) : <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>还没有会话段。</div>}
        </div>
      ) : null}

      {tab === "events" ? (
        <div style={card} data-records-pane="events">
          <div style={{ fontSize: "var(--text-md)", fontWeight: 600, marginBottom: "var(--space-2)" }}>事件流(FocusEvent,append-only)</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", lineHeight: 1.7, background: "var(--code-block-bg)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", padding: "var(--space-3)", overflowX: "auto", whiteSpace: "pre" }}>
            {events.map(e => `#${e.seq}  ${e.type.padEnd(20)}${e.text}`).join("\n")}
          </div>
          <ActionRow>
            <Btn icon={History} onClick={() => emit({ type: "redo_preview" })}>从某步重走(preview)</Btn>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>redo-from 走两步 preview → confirm(exact set 语义)</span>
          </ActionRow>
        </div>
      ) : null}
    </div>
  );
}
