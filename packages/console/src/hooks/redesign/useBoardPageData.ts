// useBoardPageData:全景看板 hook。
// 数据源:focuses 列表 + 各 focus detail(lanes/obligations) + attention(组头徽章橙+蓝计数,单源)。
// 任务:P0 从 attention 的 task 项投影到对应 focus 泳道(无 focus 任务列表 API)。
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

  // attention task 项 → TaskView(按 focus 分组);viewStatus 只是按提醒颜色近似,一律记为待核实
  const tasksByFocus = new Map<string, TaskView[]>();
  const approxStatusTaskIds: string[] = [];
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
    if (!arr.some((t) => t.id === tv.id)) {
      arr.push(tv);
      approxStatusTaskIds.push(tv.id);
    }
    tasksByFocus.set(it.focusId, arr);
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
  const retries = new Map<string, AbortController>();
  let disposed = false;
  const emit = () => {
    if (!raw) return;
    callbacks.onResult(assembleBoardView(raw.list, raw.attention, [...raw.details.values()]));
  };
  const session = createPageSession<BoardLoadResult>({
    load: loadBoard,
    callbacks: {
      onResult: (res) => {
        raw = { list: res.list, attention: res.attention, details: new Map(res.details.map((d) => [d.id, d])) };
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
      for (const c of retries.values()) c.abort();
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
      retries.get(focusId)?.abort();
      const controller = new AbortController();
      retries.set(focusId, controller);
      fetchBoardDetail(focusId, controller.signal).then(
        (result) => {
          if (disposed || controller.signal.aborted || retries.get(focusId) !== controller || !raw) return;
          retries.delete(focusId);
          raw.details.set(focusId, result);
          emit();
        },
        () => {
          // 仅 abort 会走到这里(dispose / 被更新的重试取代):丢弃
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
