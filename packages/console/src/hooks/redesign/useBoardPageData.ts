// useBoardPageData:全景看板 hook。
// 数据源:focuses 列表 + 各 focus detail(lanes/obligations) + attention(组头徽章橙+蓝计数,单源)。
// 任务:P0 从 attention 的 task 项投影到对应 focus 泳道(无 focus 任务列表 API)。

import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../../lib/api";
import type { BoardPageView } from "../../pages/redesign/BoardPage";
import type { BoardLaneGroupData, ObligationView, TaskView } from "../../components/redesign/types";
import {
  countNeedYouByFocus,
  mapFocusView,
  mapObligationView,
  mapTaskRowToView,
  type AttentionItemRow,
  type FocusDetailPayload,
  type FocusListRow
} from "./mappers";

const BOARD_LIFECYCLES = new Set(["active", "captured", "dormant"]);

export interface BoardPageDataState {
  view: BoardPageView | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

function mainLaneId(lanes: FocusDetailPayload["lanes"]): string {
  if (lanes.length === 0) return "__main__";
  // 无 parent 的优先,否则第一条
  const root = lanes.find((l) => !l.parentLaneId) ?? lanes[0]!;
  return root.id;
}

export function useBoardPageData(): BoardPageDataState {
  const [view, setView] = useState<BoardPageView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const [list, at] = await Promise.all([
          apiGet<FocusListRow[]>("/api/focuses"),
          apiGet<{ items: AttentionItemRow[] }>("/api/attention")
        ]);
        if (!alive) return;

        const attention = at.items ?? [];
        const needByFocus = countNeedYouByFocus(attention);
        const boardFocuses = (list ?? []).filter((f) => BOARD_LIFECYCLES.has(f.lifecycle));

        // 并行拉详情(规模受 focuses 列表 LIMIT 200 约束;P0 可接受)
        const details = await Promise.all(
          boardFocuses.map(async (f) => {
            try {
              const d = await apiGet<FocusDetailPayload>(`/api/focuses/${encodeURIComponent(f.id)}`);
              return [f.id, d] as const;
            } catch {
              return [f.id, null] as const;
            }
          })
        );
        if (!alive) return;
        const detailMap = new Map(details);

        // attention task 项 → TaskView(按 focus 分组)
        const tasksByFocus = new Map<string, TaskView[]>();
        for (const it of attention) {
          if (!it.focusId) continue;
          if (!(it.sourceKind === "task" || it.id.startsWith("task:"))) continue;
          const tid = it.refId ?? it.id.replace(/^task:/, "");
          const tv = mapTaskRowToView(
            {
              id: tid,
              title: it.title,
              viewStatus: "ready_for_review",
              projectId: it.projectId
            },
            it.focusId
          );
          // 绿区=进行中任务,用 running 近似;橙 task 常=ready_for_review
          if (it.color === "green") tv.viewStatus = "running";
          else if (it.color === "orange") tv.viewStatus = "ready_for_review";
          else if (it.color === "blue") tv.viewStatus = "queued";
          const arr = tasksByFocus.get(it.focusId) ?? [];
          if (!arr.some((t) => t.id === tv.id)) arr.push(tv);
          tasksByFocus.set(it.focusId, arr);
        }

        const groups: BoardLaneGroupData[] = [];
        for (const row of boardFocuses) {
          const detail = detailMap.get(row.id);
          if (!detail?.focus) continue;

          const focus = mapFocusView(detail, row);
          const lanesRaw = detail.lanes ?? [];
          const lanes =
            lanesRaw.length > 0
              ? lanesRaw.map((l) => ({ id: l.id, title: l.title }))
              : [{ id: "__main__", title: "主线" }];
          const defaultLane = mainLaneId(lanesRaw.length ? lanesRaw : [{ id: "__main__", title: "主线" }]);

          const obligations = detail.obligations.map((o) => mapObligationView(o, row.id));
          const obligationsByLane: Record<string, ObligationView[]> = {};
          for (const lane of lanes) obligationsByLane[lane.id] = [];
          for (const ob of obligations) {
            // 看板「需要你」列主要展示 human 开放义务
            if (ob.owner !== "human") continue;
            if (!["open", "blocked", "waiting", "in_progress"].includes(ob.status)) continue;
            const lid = ob.laneId && obligationsByLane[ob.laneId] !== undefined ? ob.laneId : defaultLane;
            (obligationsByLane[lid] ??= []).push(ob);
          }

          const tasks = tasksByFocus.get(row.id) ?? [];
          const tasksByLane: Record<string, TaskView[]> = {};
          for (const lane of lanes) tasksByLane[lane.id] = [];
          for (const t of tasks) {
            (tasksByLane[defaultLane] ??= []).push(t);
          }

          groups.push({
            focus,
            lanes,
            tasksByLane,
            obligationsByLane,
            needCount: needByFocus.get(row.id) ?? 0,
            collapsed: focus.lifecycle === "dormant"
          });
        }

        setView({ groups });
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
  }, [tick]);

  return { view, loading, error, reload };
}
