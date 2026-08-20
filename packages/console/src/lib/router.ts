// 极简 hash 路由(08 §6;零依赖)。
// 批次②:默认首页 = 今天;#/chat-new 为开口聊 canonical;#/chat 保留解析、App 层重定向。
// 关键语义①:项目切换 = 替换 :id,同名页切换,无法映射的页回退 tasks,全局区不动。

import { useEffect, useState } from "react";

export interface Route {
  page:
    | "today"
    | "board"
    | "dashboard"
    | "chat"
    | "chat-new"
    | "tasks"
    | "task"
    | "memory"
    | "artifacts"
    | "psettings"
    | "approvals"
    | "notify"
    | "cost"
    | "settings"
    | "focuses"
    | "focus"
    | "review"
    | "records"
    | "legacy-board"
    | "legacy-focus"
    | "dev-components"
    | "dev-pages"
    | "notfound";
  projectId?: string;
  taskId?: string;
  focusId?: string;
}

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, "") || "/";
  // 批次②:默认首页 = 今天
  if (h === "/" || h === "") return { page: "today" };
  if (h === "/today") return { page: "today" };
  if (h === "/board") return { page: "board" };
  // 旧版看板(批次③ 正式板切换后保留可达)
  if (h === "/legacy/board") return { page: "legacy-board" };
  // 开口聊 canonical;旧 #/chat 仍解析为 chat,由 App 重定向到 chat-new
  if (h === "/chat-new") return { page: "chat-new" };
  if (h === "/chat") return { page: "chat" };
  if (h === "/dashboard") return { page: "dashboard" };
  if (h === "/approvals") return { page: "approvals" };
  if (h === "/notify") return { page: "notify" };
  if (h === "/cost") return { page: "cost" };
  if (h === "/settings") return { page: "settings" };
  if (h === "/focuses") return { page: "focuses" };
  // dev-only:redesign 组件库走查页(handoff §5;不进生产导航)
  if (h === "/dev-components") return { page: "dev-components" };
  // dev-only:redesign 页面拼装走查页(HANDOFF-2 §2;不进生产导航)
  if (h === "/dev-pages") return { page: "dev-pages" };
  // 正式 redesign 路由(批次③)
  const mReview = /^\/review\/([^/]+)$/.exec(h);
  if (mReview) return { page: "review", taskId: mReview[1] as string };
  const mRecords = /^\/records\/([^/]+)$/.exec(h);
  if (mRecords) return { page: "records", focusId: mRecords[1] as string };
  const mLegacyFocus = /^\/legacy\/focus\/([^/]+)$/.exec(h);
  if (mLegacyFocus) return { page: "legacy-focus", focusId: mLegacyFocus[1] as string };
  const mFocus = /^\/focus\/([^/]+)$/.exec(h);
  if (mFocus) return { page: "focus", focusId: mFocus[1] as string };
  const mTask = /^\/p\/([^/]+)\/task\/([^/]+)$/.exec(h);
  if (mTask) return { page: "task", projectId: mTask[1] as string, taskId: mTask[2] as string };
  const mProj = /^\/p\/([^/]+)\/(chat|tasks|memory|artifacts|settings)$/.exec(h);
  if (mProj) {
    const sub = mProj[2] as string;
    const page = (sub === "settings" ? "psettings" : sub) as Route["page"];
    return { page, projectId: mProj[1] as string };
  }
  return { page: "notfound" };
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export function navigate(hash: string): void {
  location.hash = hash;
}

/** 项目切换:项目区同名页替换 :id;task 详情页无法映射 ⇒ 回退该项目 tasks;全局区不动 */
export function switchProjectHash(current: Route, newProjectId: string): string {
  switch (current.page) {
    case "chat":
    case "chat-new":
      return `/p/${newProjectId}/chat`;
    case "tasks":
    case "task":
      return `/p/${newProjectId}/tasks`;
    case "memory":
      return `/p/${newProjectId}/memory`;
    case "artifacts":
      return `/p/${newProjectId}/artifacts`;
    case "psettings":
      return `/p/${newProjectId}/settings`;
    default:
      return `/p/${newProjectId}/chat`;
  }
}
