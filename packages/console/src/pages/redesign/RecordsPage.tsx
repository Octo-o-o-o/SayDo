// RecordsPage(HANDOFF-2 §2,demo renderRecords):记录页——返回条 + 生命周期按钮区 + RecordsPanel。
// 纯呈现:RecordsPanel 已含返回条/按钮区/航迹/依赖链/会话段/事件流;页面做窄版心包装与回调映射。
// back 映射为 onNavigate({page:"focus"}),其余 RecordsAction 原样透传(归档/放弃理由表单归接线线)。

import { RecordsPanel } from "../../components/redesign";
import type { FocusView, ObligationView, RecordsAction } from "../../components/redesign";
import type { PageNavTarget } from "./nav";

/* ---------- 对接合同(字段语义见同目录 README.md) ---------- */
export interface RecordsPageView {
  focus: FocusView;
  /** 支线航迹:lanes × 事件序(eventCount 渲染圆点;retired 的线不再亮当前水位) */
  lanes: { id: string; title: string; eventCount: number; retired?: boolean }[];
  /** 依赖链(waiting 态且挂了结构化前置的安排;解除依赖走 onAction) */
  dependencies: ObligationView[];
  /** DAILY-01:本 Focus 全部义务(依赖面板候选集) */
  obligations: ObligationView[];
  /** DAILY-01:本 Focus 绑定任务(任务级前置候选集) */
  tasks: { id: string; title: string; status: string }[];
  /** 历史会话段(label 含「第 N 次会话 · 时间段」;closed=false=中断缺尾;live=当前活跃段显示「进行中」) */
  segments: { sessionRef: string; label: string; turnCount: number; closed: boolean; transcriptAvailable: boolean; live?: boolean }[];
  /** FocusEvent append-only 事件流(laneId 供重走锚点按线过滤) */
  events: { seq: number; type: string; text: string; laneId?: string }[];
}

export function RecordsPage({ view, onNavigate, onAction, onExpandSegment }: {
  view: RecordsPageView;
  onNavigate?: (target: PageNavTarget) => void;
  onAction?: (action: RecordsAction) => void;
  /** 会话段转写懒加载:接线层按 sessionRef 拉取,页面不 fetch */
  onExpandSegment?: (sessionRef: string) => Promise<string[] | null> | string[] | null;
}) {
  const handle = (a: RecordsAction) => {
    if (a.type === "back") {
      onNavigate?.({ page: "focus", focusId: view.focus.id });
      return;
    }
    onAction?.(a);
  };
  return (
    <div data-page="redesign-records" style={{ maxWidth: 860, margin: "0 auto" }}>
      <RecordsPanel
        focus={view.focus}
        lanes={view.lanes}
        dependencies={view.dependencies}
        obligations={view.obligations}
        tasks={view.tasks}
        segments={view.segments}
        events={view.events}
        onAction={handle}
        onExpandSegment={onExpandSegment}
      />
    </div>
  );
}
