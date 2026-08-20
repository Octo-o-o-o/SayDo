// 页面级跳转目标判别联合(HANDOFF-2 §2:页面不 import router,跳转全部走 onNavigate 回调)。
// 四个 redesign 页面共用;接线线把它映射到真实 hash 路由。
export type PageNavTarget =
  | { page: "focus"; focusId: string }
  | { page: "records"; focusId: string }
  | { page: "review"; taskId: string }
  | { page: "board" }
  | { page: "today" };
