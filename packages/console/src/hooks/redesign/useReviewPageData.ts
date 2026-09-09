// useReviewPageData:验收面 hook。复用 TaskDetail 同源 GET /api/tasks/:id,不改 TaskDetail.tsx 行为。
// VIEW-01:失效来源=本页动作 reload + 主 WS 事件 + 回前台 + 有界兜底(useRefreshSignal);
// 同刻单在途、卸载/切 task abort、晚到响应丢弃(pageLoader)。

import { useCallback, useEffect, useRef, useState } from "react";
import { api, apiGet } from "../../lib/api";
import type { ReviewPageView } from "../../pages/redesign/ReviewPage";
import {
  mapReviewContext,
  type AttentionItemRow,
  type FocusListRow,
  type TaskDetailPayload
} from "./mappers";
import { createPageLoader, type PageLoader } from "./pageLoader";
import { useRefreshSignal } from "./useRefreshSignal";

export interface ReviewPageDataState {
  view: ReviewPageView | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * 反查 task → focusId:先 attention 的 task 项,再 prioritise 有 focus 的项。
 * OPEN QUESTION:action_execution_bindings 无 console 读口时此为 P0 兜底。
 */
async function resolveFocusForTask(
  taskId: string,
  signal: AbortSignal
): Promise<{ focusId: string; focusTitle?: string }> {
  try {
    const at = await apiGet<{ items: AttentionItemRow[] }>("/api/attention", signal);
    const hit = (at.items ?? []).find(
      (i) =>
        i.focusId &&
        (i.refId === taskId || i.id === `task:${taskId}` || (i.sourceKind === "task" && i.id.includes(taskId)))
    );
    if (hit?.focusId) {
      return { focusId: hit.focusId, focusTitle: hit.focusTitle ?? undefined };
    }
  } catch {
    /* fall through */
  }
  // 次选:列表里无法关联则空串
  void taskId;
  return { focusId: "" };
}

async function loadReview(taskId: string, signal: AbortSignal): Promise<ReviewPageView> {
  const [data, focusHint, list] = await Promise.all([
    api.taskDetail(taskId) as Promise<TaskDetailPayload | null>,
    resolveFocusForTask(taskId, signal),
    apiGet<FocusListRow[]>("/api/focuses", signal).catch(() => [] as FocusListRow[])
  ]);
  if (!data?.task) throw new Error("任务不存在");
  const focusId = focusHint.focusId;
  let focusTitle = focusHint.focusTitle;
  if (focusId && !focusTitle) {
    focusTitle = list.find((f) => f.id === focusId)?.title;
  }
  const ctx = mapReviewContext(data, focusId);
  return { ctx, focusTitle };
}

export function useReviewPageData(taskId: string): ReviewPageDataState {
  const [view, setView] = useState<ReviewPageView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef<PageLoader | null>(null);
  const hasViewRef = useRef(false);

  useEffect(() => {
    hasViewRef.current = false;
    setLoading(true);
    setError(null);
    setView(null);
    const loader = createPageLoader<ReviewPageView>({
      load: (signal) => loadReview(taskId, signal),
      onResult: (next) => {
        hasViewRef.current = true;
        setView(next);
        setError(null);
        setLoading(false);
      },
      onError: (e) => {
        // 后台刷新失败不拆掉已有页面:只有首屏没数据时才升级为整页错误
        if (!hasViewRef.current) setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    });
    loaderRef.current = loader;
    loader.run();
    return () => {
      loader.dispose();
      loaderRef.current = null;
    };
  }, [taskId]);

  useRefreshSignal(() => loaderRef.current?.run());
  const reload = useCallback(() => loaderRef.current?.run(), []);

  return { view, loading, error, reload };
}
