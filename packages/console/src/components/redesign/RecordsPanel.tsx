// RecordsPanel(demo renderRecords):工程航迹面——支线航迹(lanes×事件序)/依赖链/会话段/事件流/操作区。
// 「记录」不是用户天天看的地方;操作全部回调(归档/放弃/重开/fork/线操作/解除依赖/redo preview);
// closed 只能 fork;归档/放弃理由必填(由容器弹表单,组件只发回调)。

import { ChevronRight, History, Plus } from "lucide-react";
import { ActionRow, Btn, card, StageTag } from "./shared";
import { SessionSegmentCard } from "./TimelineNote";
import type { FocusView, ObligationView } from "./types";

export type RecordsAction =
  | { type: "archive" } | { type: "abandon" } | { type: "reopen" } | { type: "fork" }
  | { type: "lane_op"; op: "retire" | "redo" | "continue"; laneId: string }
  | { type: "dependency_undo"; obligationId: string }
  | { type: "redo_preview" } | { type: "back" };

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

export function RecordsPanel({ focus, lanes, dependencies, segments, events, onAction, onExpandSegment }: {
  focus: FocusView;
  lanes: { id: string; title: string; eventCount: number; retired?: boolean }[];
  dependencies: ObligationView[];
  segments: { sessionRef: string; label: string; turnCount: number; closed: boolean; transcriptAvailable: boolean; live?: boolean }[];
  events: { seq: number; type: string; text: string }[];
  onAction?: (action: RecordsAction) => void;
  onExpandSegment?: (sessionRef: string) => Promise<string[] | null> | string[] | null;
}) {
  const canArchive = ["active", "captured", "dormant"].includes(focus.lifecycle);
  const canAbandon = ["active", "dormant", "archived"].includes(focus.lifecycle);
  const canReopen = focus.lifecycle === "archived";
  const canFork = focus.lifecycle === "closed";
  const emit = (a: RecordsAction) => onAction?.(a);
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
        工程航迹、事件流与版本在这里。这是「记录」,不是你要天天看的地方。归档/放弃要填理由;closed 只能 fork 新 Focus。
      </div>

      <div style={{ ...card, marginBottom: "var(--space-4)" }}>
        <div style={{ fontSize: "var(--text-md)", fontWeight: 600, marginBottom: "var(--space-2)", display: "flex", gap: 8, alignItems: "center" }}>
          支线航迹(lanes × 事件序)<StageTag>P0.5</StageTag>
        </div>
        {lanes.map((l) => (
          <div key={l.id} style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", padding: "7px 0", borderBottom: "1px dashed var(--line)" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", width: 96, flex: "none" }}>{l.title}</span>
            <LaneDotline events={l.eventCount} current={!l.retired} />
            <span style={{ flex: 1 }} />
            <Btn onClick={() => emit({ type: "lane_op", op: "retire", laneId: l.id })}>收起线</Btn>
            <Btn onClick={() => emit({ type: "lane_op", op: "redo", laneId: l.id })}>从此步重走</Btn>
            <Btn onClick={() => emit({ type: "lane_op", op: "continue", laneId: l.id })}>在此线续推</Btn>
          </div>
        ))}
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", marginTop: "var(--space-2)" }}>
          圆点=事件,橙点=当前水位;线菜单横纵双向可用(含「整线重来」)。
        </div>
      </div>

      <div style={{ ...card, marginBottom: "var(--space-4)" }}>
        <div style={{ fontSize: "var(--text-md)", fontWeight: 600, marginBottom: "var(--space-2)" }}>依赖链(一件事醒了,另一件才醒)</div>
        {dependencies.length ? dependencies.map(o => (
          <div key={o.id} style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", padding: "var(--space-3) 0", borderBottom: "1px dashed var(--line)", fontSize: "var(--text-sm)" }}>
            <span style={{ flex: 1 }}>「{o.title}」等「{o.waitingOn ?? "?"}」</span>
            <Btn onClick={() => emit({ type: "dependency_undo", obligationId: o.id })}>解除依赖</Btn>
          </div>
        )) : (
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>暂无依赖。dependency_set / woken / blocked 事件落账,无环校验。</div>
        )}
      </div>

      <div style={{ ...card, marginBottom: "var(--space-4)" }}>
        <div style={{ fontSize: "var(--text-md)", fontWeight: 600, marginBottom: "var(--space-2)" }}>会话段(历史=段+展开,当前会话=逐轮)</div>
        {segments.length ? segments.map(s => (
          <div key={s.sessionRef} style={{ marginBottom: "var(--space-2)" }}>
            <SessionSegmentCard
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

      <div style={card}>
        <div style={{ fontSize: "var(--text-md)", fontWeight: 600, marginBottom: "var(--space-2)" }}>事件流(FocusEvent,append-only)</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", lineHeight: 1.7, background: "var(--code-block-bg)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", padding: "var(--space-3)", overflowX: "auto", whiteSpace: "pre" }}>
          {events.map(e => `#${e.seq}  ${e.type.padEnd(20)}${e.text}`).join("\n")}
        </div>
        <ActionRow>
          <Btn icon={History} onClick={() => emit({ type: "redo_preview" })}>从某步重走(preview)</Btn>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>redo-from 走两步 preview → confirm(exact set 语义)</span>
        </ActionRow>
      </div>
    </div>
  );
}
