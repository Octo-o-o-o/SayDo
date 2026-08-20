// BoardLaneGroup(demo renderBoard 单组):泳道=Focus 分组容器,多支线拆子泳道;
// 4 列(队列/进行中/需要你/已收尾);格子折叠(CELL_CAP 4);组折叠(组头点击);
// 卡片点击回调;列定义由容器,卡片渲染复用 TaskCard 的 chip 语义但精简为看板卡。

import { useState } from "react";
import { ChevronDown, ChevronRight, Folder, Layers, User } from "lucide-react";
import { Mono } from "./shared";
import { StatusChip, RiskBadge } from "../StatusChip";
import type { BoardLaneGroupData, ObligationView, TaskView, ViewStatus } from "./types";

const CELL_CAP = 4;

export function boardColumnOf(vs: ViewStatus): 0 | 1 | 2 | 3 {
  if (["queued", "confirmed"].includes(vs)) return 0;
  if (["running", "merging"].includes(vs)) return 1;
  if (["paused_step_boundary", "blocked", "waiting_confirmation", "ready_for_review", "review_approved_waiting_merge", "merge_failed", "failed", "parked"].includes(vs)) return 2;
  return 3;
}

const COL_LABELS = ["队列 / 收到", "进行中", "需要你", "已收尾"];

function BoardCard({ task, onOpen }: { task: TaskView; onOpen?: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        padding: "8px 10px", borderRadius: "var(--radius-sm)",
        border: "1px solid var(--line)", background: "var(--surface-raised)",
        fontSize: "var(--text-xs)", cursor: onOpen ? "pointer" : "default", textAlign: "left", width: "100%"
      }}
      data-board-task={task.id}
    >
      <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, lineHeight: 1.4, marginBottom: 4 }}>{task.title}</div>
      <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
        <StatusChip status={task.viewStatus} deadline={task.parkedDeadline} />
        <RiskBadge risk={task.riskLevel} />
      </div>
      <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
        {task.projectTitle ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)", padding: "1px 6px", borderRadius: "var(--radius-2xs)", border: "1px solid var(--line)", color: "var(--text-secondary)", background: "var(--surface-ink-wash)" }}>
            <Folder size={10} aria-hidden /> {task.projectTitle}
          </span>
        ) : null}
        <Mono faint>{task.route === "hopper" ? "HP" : "T1"}</Mono>
      </div>
    </button>
  );
}

function ObBoardCard({ ob, onOpen }: { ob: ObligationView; onOpen?: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        padding: "8px 10px", borderRadius: "var(--radius-sm)",
        border: "1px solid var(--line)", background: "var(--surface-raised)",
        fontSize: "var(--text-xs)", cursor: onOpen ? "pointer" : "default", textAlign: "left", width: "100%"
      }}
      data-board-ob={ob.id}
    >
      <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, lineHeight: 1.4, marginBottom: 4 }}>{ob.title}</div>
      <span
        style={{
          display: "inline-flex", alignItems: "center", gap: 4, fontSize: "var(--text-xs)",
          padding: "2px 8px", borderRadius: "var(--radius-pill)",
          color: "var(--color-warning)", border: "1px solid var(--color-warning)"
        }}
      >
        <User size={11} aria-hidden />
        {ob.needs === "decision" ? "等你拍板" : ob.needs === "input" ? "等你补充" : ob.needs === "action" ? "等你的动作" : "待归类"}
      </span>
    </button>
  );
}

export function BoardLaneGroup({ data, collapsed, onToggleCollapse, onOpenTask, onOpenObligation, onOpenFocus }: {
  data: BoardLaneGroupData;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenTask?: (task: TaskView) => void;
  onOpenObligation?: (ob: ObligationView) => void;
  onOpenFocus?: () => void;
}) {
  const [expandedCells, setExpandedCells] = useState<Record<string, boolean>>({});
  const multi = data.lanes.length > 1;
  const colCount = [0, 1, 2, 3] as const;

  const cell = (laneId: string, ci: number) => {
    const tasks = (data.tasksByLane[laneId] ?? []).filter(t => boardColumnOf(t.viewStatus) === ci);
    const obs = ci === 2 ? (data.obligationsByLane[laneId] ?? []) : [];
    const cards = [
      ...tasks.map(t => <BoardCard key={t.id} task={t} onOpen={onOpenTask ? () => onOpenTask(t) : undefined} />),
      ...obs.map(o => <ObBoardCard key={o.id} ob={o} onOpen={onOpenObligation ? () => onOpenObligation(o) : undefined} />)
    ];
    const key = `${laneId}:${ci}`;
    const expanded = expandedCells[key];
    const shown = expanded ? cards : cards.slice(0, CELL_CAP);
    const more = cards.length - shown.length;
    return (
      <div
        key={ci}
        style={{
          minHeight: 52, padding: 4, borderRadius: "var(--radius-md)",
          background: "var(--surface-ink-wash)", display: "flex", flexDirection: "column", gap: 6
        }}
      >
        {shown}
        {more > 0 ? (
          <button
            type="button"
            onClick={() => setExpandedCells(prev => ({ ...prev, [key]: true }))}
            style={{ fontSize: "var(--text-xs)", color: "var(--active-ink)", padding: "5px 8px", textAlign: "left", borderRadius: "var(--radius-xs)", background: "none", border: "none", cursor: "pointer" }}
          >
            + {more} 张,展开
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface-soft)",
        marginBottom: "var(--space-4)",
        minWidth: 980
      }}
      data-board-lane-group={data.focus.id}
    >
      <button
        type="button"
        onClick={onToggleCollapse ?? onOpenFocus}
        style={{
          display: "flex", alignItems: "center", gap: "var(--space-3)",
          padding: "10px 14px", width: "100%", cursor: "pointer", userSelect: "none",
          background: "none", border: "none", textAlign: "left"
        }}
        data-board-group-head={data.focus.id}
      >
        <strong>{data.focus.title}</strong>
        <Mono faint>{{ active: "进行中", captured: "刚记下", dormant: "休眠中", closed: "已收官", abandoned: "已放弃", archived: "已归档" }[data.focus.lifecycle]}</Mono>
        {multi ? (
          <span style={{ fontSize: "var(--text-xs)", color: "var(--active-ink)", display: "inline-flex", gap: 4, alignItems: "center" }}>
            <Layers size={11} aria-hidden /> {data.lanes.length} 条支线
          </span>
        ) : null}
        <span style={{ flex: 1 }} />
        {data.needCount ? (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1, padding: "3px 7px", borderRadius: "var(--radius-pill)", background: "var(--color-warning)", color: "var(--active-ink-fg)" }}>
            {data.needCount}
          </span>
        ) : (
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>没有需要你的</span>
        )}
        {collapsed ? <ChevronRight size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
      </button>
      {collapsed ? null : data.lanes.map(lane => (
        <div key={lane.id} style={{ display: "grid", gridTemplateColumns: "140px repeat(4, minmax(190px, 1fr))", gap: 8, padding: "0 8px 8px" }}>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", padding: "8px 6px", display: "flex", gap: 4, alignItems: "center" }}>
            {multi ? <Layers size={10} aria-hidden /> : null} {lane.title}
          </div>
          {colCount.map(ci => cell(lane.id, ci))}
        </div>
      ))}
    </div>
  );
}

export function BoardColsHeader() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px repeat(4, minmax(190px, 1fr))", gap: 8, marginBottom: "var(--space-2)", minWidth: 980 }}>
      <div />
      {COL_LABELS.map((c, i) => (
        <div key={c} style={{ fontSize: "var(--text-xs)", color: i === 2 ? "var(--color-warning)" : "var(--text-muted)", fontWeight: i === 2 ? 600 : 400, padding: "6px 8px" }}>
          {c}
        </div>
      ))}
    </div>
  );
}
