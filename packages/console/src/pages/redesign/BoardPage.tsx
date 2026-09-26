// BoardPage(HANDOFF-2 §2,demo renderBoard;DAILY-01 R01/R02):泳道——页头 + 三态切换 + BoardLaneGroup 列表。
// 三态:泳道(默认,按 Focus 分组拆子泳道)/ 列表(平铺)/ 看板(按「等你/我在做/等外部/已收尾」四列聚合)。
// 纯呈现:组折叠与视图模式是页面级呈现状态;卡片点击全部回调,组头跳 Focus 页走 onNavigate。

import { useState } from "react";
import { BoardColsHeader, BoardLaneGroup } from "../../components/redesign";
import type { BoardLaneGroupData, ObligationView, TaskView } from "../../components/redesign";
import type { PageNavTarget } from "./nav";

/* ---------- 对接合同(字段语义见同目录 README.md) ---------- */
export interface BoardPageView {
  /** 泳道组(每组=一个 Focus 的任务/义务投影,含 lanes 子泳道);空数组=没有活跃的事 */
  groups: BoardLaneGroupData[];
  /** VIEW-01:detail 拉失败的 Focus(focusId → 人话错误);该组仍在 groups 里,只是义务/支线缺席 */
  detailErrors?: Record<string, string>;
  /** VIEW-01:viewStatus 只是按 attention 颜色近似出来的任务 id,卡片上标「待核实」 */
  approxStatusTaskIds?: string[];
}

export type BoardPageAction =
  | { type: "open_task"; task: TaskView }
  | { type: "open_obligation"; obligation: ObligationView };

type BoardMode = "lanes" | "list" | "kanban";

const MODE_LABEL: Record<BoardMode, string> = { lanes: "泳道", list: "列表", kanban: "看板" };

const modeBtn = (active: boolean): React.CSSProperties => ({
  height: 28,
  padding: "0 12px",
  borderRadius: "var(--radius-xs)",
  border: "1px solid var(--line)",
  background: active ? "var(--selected-wash)" : "transparent",
  color: active ? "var(--active-ink)" : "var(--text-secondary)",
  fontSize: "var(--text-xs)",
  cursor: "pointer"
});

const OB_OPEN = new Set(["open", "in_progress", "waiting", "deferred", "blocked"]);
const TASK_RUNNING = new Set(["running", "queued", "confirmed", "paused_step_boundary", "waiting_confirmation", "merging"]);
const TASK_DONE = new Set(["task_done", "cancel_settled", "superseded"]);

/** 看板列:等你(human 开放义务)/ 我在做(agent 义务+在跑任务)/ 等外部 / 已收尾(收尾义务+终态任务) */
function kanbanCols(g: BoardLaneGroupData): { needYou: ObligationView[]; doing: number; external: ObligationView[]; settled: number } {
  const obs = Object.values(g.obligationsByLane).flat();
  const tasks = Object.values(g.tasksByLane).flat();
  return {
    needYou: obs.filter((o) => o.owner === "human" && OB_OPEN.has(o.status)),
    doing: obs.filter((o) => o.owner === "agent" && ["open", "in_progress"].includes(o.status)).length
      + tasks.filter((t) => TASK_RUNNING.has(t.viewStatus)).length,
    external: obs.filter((o) => o.owner === "external" && OB_OPEN.has(o.status)),
    settled: obs.filter((o) => !OB_OPEN.has(o.status)).length + tasks.filter((t) => TASK_DONE.has(t.viewStatus)).length
  };
}

function KanbanBoard({ groups, onNavigate, onAction }: {
  groups: BoardLaneGroupData[];
  onNavigate?: (t: PageNavTarget) => void;
  onAction?: (a: BoardPageAction) => void;
}) {
  const colStyle: React.CSSProperties = {
    flex: "1 1 0", minWidth: 220, display: "flex", flexDirection: "column", gap: "var(--space-2)"
  };
  const headStyle: React.CSSProperties = {
    fontSize: "var(--text-xs)", color: "var(--text-muted)", padding: "0 2px var(--space-1)",
    borderBottom: "1px solid var(--line)"
  };
  const cellStyle: React.CSSProperties = {
    border: "1px solid var(--line)", borderRadius: "var(--radius-xs)",
    padding: "8px 10px", fontSize: "var(--text-xs)", background: "var(--surface-soft)"
  };
  const cols: { title: string; render: (g: BoardLaneGroupData) => React.ReactNode }[] = [
    {
      title: "等你",
      render: (g) => kanbanCols(g).needYou.map((o) => (
        <button key={o.id} type="button" style={{ ...cellStyle, textAlign: "left", cursor: "pointer" }} data-kanban-ob={o.id}
          onClick={() => onAction?.({ type: "open_obligation", obligation: o })}>
          {o.title}
        </button>
      ))
    },
    {
      title: "我在做",
      render: (g) => {
        const n = kanbanCols(g).doing;
        return n ? [<div key="n" style={cellStyle}>{n} 件在进行</div>] : null;
      }
    },
    {
      title: "等外部",
      render: (g) => kanbanCols(g).external.map((o) => (
        <div key={o.id} style={cellStyle} data-kanban-ext={o.id}>{o.title}</div>
      ))
    },
    {
      title: "已收尾",
      render: (g) => {
        const n = kanbanCols(g).settled;
        return n ? [<div key="n" style={{ ...cellStyle, color: "var(--text-faint)" }}>{n} 件已收尾</div>] : null;
      }
    }
  ];
  return (
    <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }} data-board-mode="kanban">
      {cols.map((c) => (
        <div key={c.title} style={colStyle}>
          <div style={headStyle}>{c.title}</div>
          {groups.map((g) => {
            const cells = c.render(g);
            if (!cells || (Array.isArray(cells) && cells.filter(Boolean).length === 0)) return null;
            return (
              <div key={g.focus.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => onNavigate?.({ page: "focus", focusId: g.focus.id })}
                  style={{ fontSize: "var(--text-xs)", fontWeight: 600, textAlign: "left", border: 0, background: "none", cursor: "pointer", color: "var(--text-secondary)", padding: "0 2px" }}
                >
                  {g.focus.title}
                </button>
                {cells}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ListBoard({ groups, view, onNavigate }: {
  groups: BoardLaneGroupData[];
  view: BoardPageView;
  onNavigate?: (t: PageNavTarget) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }} data-board-mode="list">
      {groups.map((g) => {
        const obs = Object.values(g.obligationsByLane).flat();
        const tasks = Object.values(g.tasksByLane).flat();
        const needYou = obs.filter((o) => o.owner === "human" && OB_OPEN.has(o.status)).length;
        return (
          <button
            key={g.focus.id}
            type="button"
            data-board-list-row={g.focus.id}
            onClick={() => onNavigate?.({ page: "focus", focusId: g.focus.id })}
            style={{
              display: "flex", alignItems: "center", gap: "var(--space-3)", textAlign: "left",
              border: "1px solid var(--line)", borderRadius: "var(--radius-xs)",
              padding: "10px 14px", background: "var(--surface-soft)", cursor: "pointer"
            }}
          >
            <span style={{ fontWeight: 500, fontSize: "var(--text-sm)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {g.focus.title}
            </span>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
              {g.focus.lifecycle} · 支线 {g.lanes.length} · 任务 {tasks.length} · 等你 {needYou}
              {g.needCount ? ` · 热点 ${g.needCount}` : ""}
              {view.detailErrors?.[g.focus.id] ? " · 详情未拉到" : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function BoardPage({ view, onNavigate, onAction, onRetryDetail }: {
  view: BoardPageView;
  onNavigate?: (target: PageNavTarget) => void;
  onAction?: (action: BoardPageAction) => void;
  /** detail 占位错误上的「重试」;接线线接 reload */
  onRetryDetail?: (focusId: string) => void;
}) {
  // 组折叠:初始值取数据 collapsed,缺省休眠收起(demo renderBoard 同规则)
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<BoardMode>("lanes");
  const approxIds = new Set(view.approxStatusTaskIds ?? []);
  const collapsedOf = (g: BoardLaneGroupData) =>
    collapsedMap[g.focus.id] ?? g.collapsed ?? g.focus.lifecycle === "dormant";

  return (
    <div data-page="redesign-board" style={{ maxWidth: 1360, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)", marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
        <span style={{ fontSize: "var(--text-xl)", fontWeight: 600 }}>泳道</span>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
          按 Focus 分组,多条支线拆子泳道 · 你只需要看「需要你」那一列
        </span>
        <span style={{ flex: 1 }} />
        {/* DAILY-01 R02:三态切换器——零任务也可切 */}
        <span style={{ display: "flex", gap: 4 }} data-board-modes>
          {(["lanes", "list", "kanban"] as const).map((m) => (
            <button key={m} type="button" style={modeBtn(mode === m)} data-board-mode-btn={m} onClick={() => setMode(m)}>
              {MODE_LABEL[m]}
            </button>
          ))}
        </span>
      </div>
      {view.groups.length === 0 ? (
        <div style={{ padding: "var(--space-5)", textAlign: "center", color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
          没有在泳道上的事——活跃、刚记下、休眠的 Focus 才会出现在这里。
        </div>
      ) : mode === "list" ? (
        <ListBoard groups={view.groups} view={view} onNavigate={onNavigate} />
      ) : mode === "kanban" ? (
        <div style={{ overflowX: "auto" }}>
          <KanbanBoard groups={view.groups} onNavigate={onNavigate} onAction={onAction} />
        </div>
      ) : (
        <div style={{ overflowX: "auto" }} data-board-mode="lanes">
          <BoardColsHeader />
          {view.groups.map(g => (
            <BoardLaneGroup
              key={g.focus.id}
              data={g}
              collapsed={collapsedOf(g)}
              onToggleCollapse={() => setCollapsedMap(prev => ({ ...prev, [g.focus.id]: !collapsedOf(g) }))}
              onOpenTask={onAction ? (task) => onAction({ type: "open_task", task }) : undefined}
              onOpenObligation={onAction ? (ob) => onAction({ type: "open_obligation", obligation: ob }) : undefined}
              onOpenFocus={onNavigate ? () => onNavigate({ page: "focus", focusId: g.focus.id }) : undefined}
              detailError={view.detailErrors?.[g.focus.id]}
              onRetryDetail={onRetryDetail ? () => onRetryDetail(g.focus.id) : undefined}
              approxStatusTaskIds={approxIds}
            />
          ))}
        </div>
      )}
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", marginTop: "var(--space-3)" }}>
        「已收尾」含已交付 / 停了 / 已被替代 · HP = Hopper 执行域投影 · 休眠的事默认收起,点组头展开
      </div>
    </div>
  );
}
