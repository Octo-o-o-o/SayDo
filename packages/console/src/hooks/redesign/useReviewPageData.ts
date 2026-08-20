// useReviewPageData:验收面 hook。复用 TaskDetail 同源 GET /api/tasks/:id,不改 TaskDetail.tsx 行为。

import { useCallback, useEffect, useState } from "react";
import { api, apiGet } from "../../lib/api";
import type { ReviewPageView } from "../../pages/redesign/ReviewPage";
import {
  mapReviewContext,
  type AttentionItemRow,
  type FocusListRow,
  type TaskDetailPayload
} from "./mappers";

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
async function resolveFocusForTask(taskId: string): Promise<{ focusId: string; focusTitle?: string }> {
  try {
    const at = await apiGet<{ items: AttentionItemRow[] }>("/api/attention");
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

export function useReviewPageData(taskId: string): ReviewPageDataState {
  const [view, setView] = useState<ReviewPageView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setView(null);

    void (async () => {
      try {
        const [data, focusHint, list] = await Promise.all([
          api.taskDetail(taskId) as Promise<TaskDetailPayload | null>,
          resolveFocusForTask(taskId),
          apiGet<FocusListRow[]>("/api/focuses").catch(() => [] as FocusListRow[])
        ]);
        if (!alive) return;
        if (!data?.task) {
          setError("任务不存在");
          setLoading(false);
          return;
        }
        const focusId = focusHint.focusId;
        let focusTitle = focusHint.focusTitle;
        if (focusId && !focusTitle) {
          focusTitle = list.find((f) => f.id === focusId)?.title;
        }
        const ctx = mapReviewContext(data, focusId);
        setView({ ctx, focusTitle });
        setLoading(false);
      } catch (e: unknown) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [taskId, tick]);

  return { view, loading, error, reload };
}
