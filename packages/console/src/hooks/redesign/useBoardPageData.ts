// useBoardPageData:全景看板 hook。
// 数据源:focuses 列表 + 各 focus detail(lanes/obligations) + attention(组头徽章橙+蓝计数,单源)。
// 任务以 focus detail.tasks 为真账,attention 只补缺并标待核实。
// VIEW-01:detail 单条失败保留该事(占位错误 + 重试);失效来源=本页动作 reload + 主 WS 事件 +
// 回前台 + 有界兜底;同刻单在途、卸载 abort、晚到响应丢弃——由 pageSession 承载。
// GAP-02 残项 2.2:占位「重试」= retryDetail(focusId) 只重拉该 Focus 的 detail(不重拉列表/attention),
// 失败仍保留占位;首屏尚未成功时退回整页重拉。仍是 N+2 扇出,聚合读口归 VIEW-02。

import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "../../lib/api";
import type { BoardPageView } from "../../pages/redesign/BoardPage";
import type { BoardLaneGroupData, ObligationView, TaskView } from "../../components/redesign/types";
import {
  countNeedYouByFocus,
  mapFocusRowView,
  mapFocusView,
  mapObligationView,
  mapTaskRowToView,
  type AttentionItemRow,
  type FocusDetailPayload,
  type FocusListRow
} from "./mappers";
import { createPageSession, type PageSession, type PageSessionCallbacks, type PageSessionRefresh } from "./pageSession";

const BOARD_LIFECYCLES = new Set(["active", "captured", "dormant"]);
const MAIN_LANE = { id: "__main__", title: "主线" };

export interface BoardPageDataState {
  view: BoardPageView | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** 单 Focus 定向重试:只重拉该 detail;失败仍保留占位 */
  retryDetail: (focusId: string) => void;
}

/** 单个 Focus 的 detail 拉取结果:失败时 detail=null 且 error 为人话 */
export interface BoardDetailResult {
  id: string;
  detail: FocusDetailPayload | null;
  error: string | null;
}

function mainLaneId(lanes: FocusDetailPayload["lanes"]): string {
  if (lanes.length === 0) return MAIN_LANE.id;
  // 无 parent 的优先,否则第一条
  const root = lanes.find((l) => !l.parentLaneId) ?? lanes[0]!;
  return root.id;
}

/** 纯拼装:列表 + attention + 各 detail 结果 → 看板视图(detail 失败的事仍在板上) */
export function assembleBoardView(
  list: FocusListRow[],
  attention: AttentionItemRow[],
  details: readonly BoardDetailResult[]
): BoardPageView {
  const needByFocus = countNeedYouByFocus(attention);
  const boardFocuses = list.filter((f) => BOARD_LIFECYCLES.has(f.lifecycle));
  const detailMap = new Map(details.map((d) => [d.id, d] as const));

  // DAILY-01:detail.tasks = 真实绑定任务(action_execution_bindings);attention 任务项只补缺,
  // 且仍按颜色近似标「待核实」——有了真账就不再拿近似顶替,也不再标待核实。
  const realTaskIds = new Set<string>();
  for (const d of details) {
    for (const t of d.detail?.tasks ?? []) realTaskIds.add(t.id);
  }
  const approxStatusTaskIds: string[] = [];
  const approxByFocus = new Map<string, TaskView[]>();
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
    if (it.color === "green") tv.viewStatus = "running";
    else if (it.color === "orange") tv.viewStatus = "ready_for_review";
    else if (it.color === "blue") tv.viewStatus = "queued";
    const arr = approxByFocus.get(it.focusId) ?? [];
    if (!arr.some((t) => t.id === tv.id)) {
      arr.push(tv);
      if (!realTaskIds.has(tv.id)) approxStatusTaskIds.push(tv.id);
    }
    approxByFocus.set(it.focusId, arr);
  }

  const groups: BoardLaneGroupData[] = [];
  const detailErrors: Record<string, string> = {};
  for (const row of boardFocuses) {
    const result = detailMap.get(row.id);
    const detail = result?.detail?.focus ? result.detail : null;
    if (!detail) {
      // detail 没拉下来:保留该事(列表行拼 FocusView),义务留空,attention 任务照挂主线
      detailErrors[row.id] = result?.error ?? "详情未返回";
    }

    const focus = detail ? mapFocusView(detail, row) : mapFocusRowView(row);
    const lanesRaw = detail?.lanes ?? [];
    const lanes = lanesRaw.length > 0 ? lanesRaw.map((l) => ({ id: l.id, title: l.title })) : [MAIN_LANE];
    const defaultLane = mainLaneId(lanesRaw.length ? lanesRaw : [MAIN_LANE]);

    const obligations = (detail?.obligations ?? []).map((o) => mapObligationView(o, row.id));
    const obligationsByLane: Record<string, ObligationView[]> = {};
    for (const lane of lanes) obligationsByLane[lane.id] = [];
    for (const ob of obligations) {
      // 保留完整义务供三态投影,各列在呈现层筛选。
      const lid = ob.laneId && obligationsByLane[ob.laneId] !== undefined ? ob.laneId : defaultLane;
      (obligationsByLane[lid] ??= []).push(ob);
    }

    // 真实任务(detail.tasks)按 laneId 落线;attention 近似项补未覆盖的,仍挂主线并标待核实
    const realTasks = (detail?.tasks ?? []).map((t) =>
      mapTaskRowToView({ id: t.id, title: t.title, status: t.status }, row.id)
    );
    const realIds = new Set(realTasks.map((t) => t.id));
    const approxOnly = (approxByFocus.get(row.id) ?? []).filter((t) => !realIds.has(t.id));
    const laneOfTask = new Map((detail?.tasks ?? []).map((t) => [t.id, t.laneId ?? null]));
    const tasksByLane: Record<string, TaskView[]> = {};
    for (const lane of lanes) tasksByLane[lane.id] = [];
    for (const t of realTasks) {
      const lid = laneOfTask.get(t.id);
      const target = lid && tasksByLane[lid] !== undefined ? lid : defaultLane;
      (tasksByLane[target] ??= []).push(t);
    }
    for (const t of approxOnly) {
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

  return { groups, detailErrors, approxStatusTaskIds };
}

/** 单 Focus detail 拉取:失败不抛(保留该事 + 人话错误);调用方 abort 时才抛 */
async function fetchBoardDetail(id: string, signal: AbortSignal): Promise<BoardDetailResult> {
  try {
    const detail = await apiGet<FocusDetailPayload>(`/api/focuses/${encodeURIComponent(id)}`, signal);
    return { id, detail, error: null };
  } catch (e: unknown) {
    if (signal.aborted) throw e;
    return { id, detail: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface BoardLoadResult {
  list: FocusListRow[];
  attention: AttentionItemRow[];
  details: BoardDetailResult[];
}

async function loadBoard(signal: AbortSignal): Promise<BoardLoadResult> {
  const [list, at] = await Promise.all([
    apiGet<FocusListRow[]>("/api/focuses", signal),
    apiGet<{ items: AttentionItemRow[] }>("/api/attention", signal)
  ]);
  const attention = at.items ?? [];
  const boardFocuses = (list ?? []).filter((f) => BOARD_LIFECYCLES.has(f.lifecycle));
  // 并行拉详情(规模受 focuses 列表 LIMIT 200 约束;P0 可接受);单条失败不拖垮整板
  const details = await Promise.all(boardFocuses.map((f) => fetchBoardDetail(f.id, signal)));
  return { list: list ?? [], attention, details };
}

export interface BoardPageSession extends PageSession {
  retryDetail(focusId: string): void;
}

/** 纯会话:看板数据序列 + 单 Focus 定向重试(供 hook 与单测共用) */
export function createBoardPageSession(
  callbacks: PageSessionCallbacks<BoardPageView>,
  refresh?: PageSessionRefresh
): BoardPageSession {
  let raw: { list: FocusListRow[]; attention: AttentionItemRow[]; details: Map<string, BoardDetailResult> } | null = null;
  const retries = new Map<string, { controller: AbortController; gen: number }>();
  const appliedGen = new Map<string, number>();
  let seq = 0;
  let latestFullGen = 0;
  let disposed = false;
  const emit = () => {
    if (!raw) return;
    callbacks.onResult(assembleBoardView(raw.list, raw.attention, [...raw.details.values()]));
  };
  const dropRetry = (focusId: string): void => {
    const rec = retries.get(focusId);
    if (!rec) return;
    rec.controller.abort();
    retries.delete(focusId);
  };
  const session = createPageSession<{ data: BoardLoadResult; gen: number }>({
    load: async (signal) => {
      const g = ++seq;
      latestFullGen = g;
      for (const [id, rec] of [...retries]) {
        if (rec.gen < g) dropRetry(id);
      }
      const data = await loadBoard(signal);
      return { data, gen: g };
    },
    callbacks: {
      onResult: ({ data, gen }) => {
        if (disposed) return;
        const prev = raw;
        const ids = new Set(data.details.map((d) => d.id));
        const nextDetails = new Map<string, BoardDetailResult>();
        for (const d of data.details) {
          const inflight = retries.get(d.id)?.gen ?? 0;
          const applied = appliedGen.get(d.id) ?? 0;
          if ((inflight > gen || applied > gen) && prev?.details.has(d.id)) {
            nextDetails.set(d.id, prev.details.get(d.id)!);
          } else {
            nextDetails.set(d.id, d);
            appliedGen.set(d.id, gen);
          }
        }
        for (const [id] of [...retries]) {
          if (!ids.has(id)) dropRetry(id);
        }
        for (const id of [...appliedGen.keys()]) {
          if (!ids.has(id)) appliedGen.delete(id);
        }
        raw = { list: data.list, attention: data.attention, details: nextDetails };
        emit();
      },
      onError: callbacks.onError
    },
    ...(refresh ? { refresh } : {})
  });
  return {
    run: () => session.run(),
    inFlight: () => session.inFlight(),
    dispose: () => {
      disposed = true;
      for (const rec of retries.values()) rec.controller.abort();
      retries.clear();
      session.dispose();
    },
    retryDetail: (focusId) => {
      if (disposed) return;
      // 首屏还没成功过:没有可局部替换的底,退回整页重拉
      if (!raw) {
        session.run();
        return;
      }
      retries.get(focusId)?.controller.abort();
      const g = ++seq;
      const controller = new AbortController();
      retries.set(focusId, { controller, gen: g });
      fetchBoardDetail(focusId, controller.signal).then(
        (result) => {
          if (disposed || controller.signal.aborted || retries.get(focusId)?.gen !== g || !raw) return;
          if (latestFullGen > g) return;
          if (!raw.list.some((f) => f.id === focusId && BOARD_LIFECYCLES.has(f.lifecycle))) {
            retries.delete(focusId);
            return;
          }
          retries.delete(focusId);
          appliedGen.set(focusId, g);
          raw.details.set(focusId, result);
          emit();
        },
        () => {
          // 仅 abort 会走到这里(dispose / 被更新的重试取代 / 更新的全页):丢弃
        }
      );
    }
  };
}

export function useBoardPageData(): BoardPageDataState {
  const [view, setView] = useState<BoardPageView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<BoardPageSession | null>(null);
  const hasViewRef = useRef(false);

  useEffect(() => {
    const session = createBoardPageSession({
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
    sessionRef.current = session;
    session.run();
    return () => {
      session.dispose();
      sessionRef.current = null;
    };
  }, []);

  const reload = useCallback(() => sessionRef.current?.run(), []);
  const retryDetail = useCallback((focusId: string) => sessionRef.current?.retryDetail(focusId), []);

  return { view, loading, error, reload, retryDetail };
}
