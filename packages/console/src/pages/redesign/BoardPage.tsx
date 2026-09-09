// BoardPage(HANDOFF-2 §2,demo renderBoard):全景看板——页头 + 列头 + BoardLaneGroup 列表 + 底注。
// 纯呈现:组折叠状态是页面级呈现状态(demo 同语义:休眠默认收起);卡片点击全部回调,
// 开任务/义务弹窗归接线线(onAction),组头跳 Focus 页走 onNavigate。

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

export function BoardPage({ view, onNavigate, onAction, onRetryDetail }: {
  view: BoardPageView;
  onNavigate?: (target: PageNavTarget) => void;
  onAction?: (action: BoardPageAction) => void;
  /** detail 占位错误上的「重试」;接线线接 reload */
  onRetryDetail?: (focusId: string) => void;
}) {
  // 组折叠:初始值取数据 collapsed,缺省休眠收起(demo renderBoard 同规则)
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});
  const approxIds = new Set(view.approxStatusTaskIds ?? []);
  const collapsedOf = (g: BoardLaneGroupData) =>
    collapsedMap[g.focus.id] ?? g.collapsed ?? g.focus.lifecycle === "dormant";

  return (
    <div data-page="redesign-board" style={{ maxWidth: 1360, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)", marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
        <span style={{ fontSize: "var(--text-xl)", fontWeight: 600 }}>全景看板</span>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
          按 Focus 分组,多条支线拆子泳道 · 你只需要看「需要你」那一列 · 格子多了会折叠
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <BoardColsHeader />
        {view.groups.length ? view.groups.map(g => (
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
        )) : (
          <div style={{ padding: "var(--space-5)", textAlign: "center", color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
            没有在看板上的事——活跃、刚记下、休眠的 Focus 才会出现在这里。
          </div>
        )}
      </div>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", marginTop: "var(--space-3)" }}>
        「已收尾」含已交付 / 停了 / 已被替代 · HP = Hopper 执行域投影 · 休眠的事默认收起,点组头展开
      </div>
    </div>
  );
}
