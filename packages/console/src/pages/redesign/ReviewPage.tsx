// ReviewPage(HANDOFF-2 §2,demo renderReview):验收面整页化——返回条 + 任务头卡 + ReviewPanel。
// 纯呈现:ReviewPanel 已含返回条/头卡/左标准右证据/讲三层/裁决区;页面只做版心包装与回调映射。
// back_to_focus 映射为 onNavigate({page:"focus"}),其余 ReviewAction 原样透传给接线线。

import { ReviewPanel } from "../../components/redesign";
import type { ReviewAction, ReviewTaskContext } from "../../components/redesign";
import type { PageNavTarget } from "./nav";

/* ---------- 对接合同(字段语义见同目录 README.md) ---------- */
export interface ReviewPageView {
  /** 验收上下文:任务+验收标准+证据+判断+尝试记录+讲给我听(形状=组件库 ReviewTaskContext) */
  ctx: ReviewTaskContext;
  /** 所属 Focus 标题(返回条文案「回到『X』」);缺省时返回条用通用文案 */
  focusTitle?: string;
}

export function ReviewPage({ view, onNavigate, onAction }: {
  view: ReviewPageView;
  onNavigate?: (target: PageNavTarget) => void;
  onAction?: (action: ReviewAction) => void;
}) {
  const handle = (a: ReviewAction) => {
    if (a.type === "back_to_focus") {
      onNavigate?.({ page: "focus", focusId: view.ctx.task.focusId });
      return;
    }
    onAction?.(a);
  };
  return (
    <div data-page="redesign-review" style={{ maxWidth: 1180, margin: "0 auto" }}>
      <ReviewPanel
        ctx={view.ctx}
        backLabel={view.focusTitle ? `回到「${view.focusTitle}」` : undefined}
        onAction={handle}
      />
    </div>
  );
}
