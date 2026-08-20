// redesign 页面统一出口(纯呈现拼装;数据全走 view-model props,接线由并行施工线做——HANDOFF-2)。
export type { PageNavTarget } from "./nav";
export { FocusPage, type FocusPageView, type FocusPageAction } from "./FocusPage";
export { ReviewPage, type ReviewPageView } from "./ReviewPage";
export { BoardPage, type BoardPageView, type BoardPageAction } from "./BoardPage";
export { RecordsPage, type RecordsPageView } from "./RecordsPage";
