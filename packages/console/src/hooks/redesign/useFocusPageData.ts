// useFocusPageData:Focus 对话页数据 hook(接线合同 README FocusPageView)。
// 数据源:GET /api/focuses/:id + /timeline + /api/focuses 列表(openByOwner) + transcript 懒加载。
// VIEW-01:失效来源=本页动作 reload + 主 WS 事件 + 回前台 + 有界兜底;同刻单在途、卸载/切 focus abort、
// 晚到响应丢弃——全部由 pageSession 承载,本 hook 只是 React 薄包装(纯会话可无 DOM 单测)。
// 后台刷新按 seq 合并进已翻出的时间线。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "../../lib/api";
import { apiErrorMessage } from "../../lib/apiError";
import type { FocusPageView } from "../../pages/redesign/FocusPage";
import type { TimelineItem } from "../../components/redesign/types";
import {
  deriveExpectations,
  mapActivationSessions,
  mapArtifactView,
  mapDaemonTimelineItem,
  mapFocusView,
  mapObligationView,
  mapTranscriptLines,
  markLiveSegments,
  type AttentionItemRow,
  type DaemonTimelineItem,
  type FocusDetailPayload,
  type FocusListRow,
  type TaskDetailPayload,
  type TranscriptResponse
} from "./mappers";
import { buildFocusWorkLookups, sessionOwnedByFocus, type LiveConfirmCard } from "./focusWorkLookups";
import { projectLiveInterview, type LiveInterviewSpoken } from "./liveInterview";
import type { InterviewAnchorCommit, InterviewRoundLease } from "../../voice/interviewAnchor";
import { createPageSession, type PageSession, type PageSessionCallbacks, type PageSessionRefresh } from "./pageSession";

const TIMELINE_LIMIT = 50;

export interface FocusPageDataState {
  view: FocusPageView | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** 向上翻页加载更早时间线;无 nextCursor 时 no-op */
  loadOlder: () => Promise<void>;
  hasOlder: boolean;
  /** 翻页失败且已有视图时的局部错误;不得写入整页 error */
  olderError: string | null;
  /** 会话段转写懒加载(available:false → null) */
  onExpandSegment: (sessionRef: string) => Promise<string[] | null>;
}

export interface FocusLoadResult {
  view: FocusPageView;
  liveRefs: ReadonlySet<string>;
  nextCursor: number | null;
}

async function loadFocus(
  focusId: string,
  currentSessionId: string | null | undefined,
  signal: AbortSignal,
  liveCard?: LiveConfirmCard | null
): Promise<FocusLoadResult> {
  const [detail, timelineRes, list, sessionsRes, attentionRes] = await Promise.all([
    apiGet<FocusDetailPayload>(`/api/focuses/${encodeURIComponent(focusId)}`, signal),
    apiGet<{ items: DaemonTimelineItem[]; nextCursor: number | null }>(
      `/api/focuses/${encodeURIComponent(focusId)}/timeline?limit=${TIMELINE_LIMIT}`,
      signal
    ),
    apiGet<FocusListRow[]>("/api/focuses", signal).catch(() => [] as FocusListRow[]),
    apiGet<{ sessions: Array<{ id: string }> }>(
      `/api/focuses/${encodeURIComponent(focusId)}/sessions`,
      signal
    ).catch(() => ({ sessions: [] })),
    apiGet<{ items: AttentionItemRow[] }>("/api/attention", signal).catch(() => ({ items: [] as AttentionItemRow[] }))
  ]);
  if (!detail?.focus) throw new Error("Focus 不存在");

  const boundTasks = detail.tasks ?? [];
  const taskDetails = await Promise.all(
    boundTasks.map((t) =>
      apiGet<TaskDetailPayload>(`/api/tasks/${encodeURIComponent(t.id)}`, signal).catch(() => null)
    )
  );

  const listRow = list.find((r) => r.id === focusId) ?? null;
  const focus = mapFocusView(detail, listRow);
  const obligations = detail.obligations.map((o) => mapObligationView(o, focusId));
  const artifacts = detail.artifacts.map((a) => mapArtifactView(a, focusId));
  const sessionOwned = sessionOwnedByFocus(currentSessionId, sessionsRes.sessions ?? []);
  const work = buildFocusWorkLookups({
    focusId,
    detail,
    taskDetails,
    attention: attentionRes.items ?? [],
    liveCard,
    sessionOwned
  });
  // L2:当前会话名下的 activation 集合 ⇒ endTs=null 段标 live(「进行中」而非「中断」)
  const liveRefs = new Set<string>();
  if (currentSessionId) {
    for (const [aid, sid] of mapActivationSessions(detail.events ?? [])) {
      if (sid === currentSessionId) liveRefs.add(aid);
    }
  }
  const timeline = markLiveSegments(
    (timelineRes.items ?? [])
      .map(mapDaemonTimelineItem)
      .sort((a, b) => a.seq - b.seq),
    liveRefs
  );

  const expectations = deriveExpectations(detail.artifacts, {
    revision: focus.currentRevision,
    direction: focus.direction
  });

  const obLookup = Object.fromEntries(obligations.map((o) => [o.id, o]));

  const view: FocusPageView = {
    focus,
    timeline,
    lanes: (detail.lanes ?? []).map((l) => ({ id: l.id, title: l.title, retired: l.retiredAt != null })),
    focusTasks: boundTasks.map((t) => ({ id: t.id, title: t.title, status: t.status, laneId: t.laneId ?? null })),
    rail: {
      obligations,
      tasks: work.tasks,
      artifacts,
      projects: detail.repos.map((r) => ({
        id: r.projectId,
        title: r.projectId,
        path: r.note ?? ""
      })),
      memories: []
    },
    expectations,
    sessionOwned,
    interview: projectLiveInterview({
      pageFocusId: focusId,
      sessionOwned,
      sessionId: currentSessionId,
      spoken: [],
      confirmCard: liveCard,
      committed: null
    }),
    lookups: {
      obligations: obLookup,
      tasks: work.taskLookup,
      packages: work.packageLookup
    }
  };
  return { view, liveRefs, nextCursor: timelineRes.nextCursor ?? null };
}

function mergeBySeq(a: readonly TimelineItem[], b: readonly TimelineItem[], liveRefs: ReadonlySet<string>): TimelineItem[] {
  // 合并:按 seq 去重,升序;live 标记同口径复用(L2);后者覆盖前者
  const bySeq = new Map<number, TimelineItem>();
  for (const it of a) bySeq.set(it.seq, it);
  for (const it of b) bySeq.set(it.seq, it);
  return markLiveSegments([...bySeq.values()].sort((x, y) => x.seq - y.seq), liveRefs);
}

export type FocusPageSessionCallbacks = PageSessionCallbacks<FocusLoadResult> & {
  /** 翻页失败且已有视图:局部错误;成功或未翻页时传 null 清掉 */
  onOlderError?: (message: string | null) => void;
};

export interface FocusPageSession extends PageSession {
  loadOlder(): Promise<void>;
  onExpandSegment(sessionRef: string): Promise<string[] | null>;
}

/** 纯会话:Focus 页数据序列 + 翻页/转写(供 hook 与单测共用;世代与 abort 绑在会话上) */
export function createFocusPageSession(
  focusId: string,
  currentSessionId: string | null | undefined,
  callbacks: FocusPageSessionCallbacks,
  refresh?: PageSessionRefresh,
  liveCard?: LiveConfirmCard | null
): FocusPageSession {
  let last: FocusLoadResult | null = null;
  let paged = false;
  let olderGen = 0;
  let olderCtrl: AbortController | null = null;
  const expandCtrls = new Map<string, AbortController>();
  let disposed = false;

  const session = createPageSession<FocusLoadResult>({
    load: (signal) => loadFocus(focusId, currentSessionId, signal, liveCard),
    callbacks: {
      onResult: (res) => {
        if (disposed) return;
        const mergedTimeline = last
          ? mergeBySeq(last.view.timeline, res.view.timeline, res.liveRefs)
          : res.view.timeline;
        // null=已到底,不是缺失;已翻页后保留当前游标(含 null),勿用 ?? 回落到首页 nextCursor
        last = {
          view: { ...res.view, timeline: mergedTimeline },
          liveRefs: res.liveRefs,
          nextCursor: paged && last ? last.nextCursor : res.nextCursor
        };
        callbacks.onResult(last);
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
      olderGen += 1;
      olderCtrl?.abort();
      olderCtrl = null;
      for (const ctrl of expandCtrls.values()) ctrl.abort();
      expandCtrls.clear();
      session.dispose();
    },
    async loadOlder() {
      if (disposed || last == null || last.nextCursor == null) return;
      olderCtrl?.abort();
      const g = ++olderGen;
      const controller = new AbortController();
      olderCtrl = controller;
      try {
        const res = await apiGet<{ items: DaemonTimelineItem[]; nextCursor: number | null }>(
          `/api/focuses/${encodeURIComponent(focusId)}/timeline?limit=${TIMELINE_LIMIT}&cursor=${last.nextCursor}`,
          controller.signal
        );
        if (disposed || g !== olderGen || controller.signal.aborted || !last) return;
        const older = (res.items ?? []).map(mapDaemonTimelineItem);
        const merged = mergeBySeq(last.view.timeline, older, last.liveRefs);
        paged = true;
        last = {
          view: { ...last.view, timeline: merged },
          liveRefs: last.liveRefs,
          nextCursor: res.nextCursor ?? null
        };
        callbacks.onOlderError?.(null);
        callbacks.onResult(last);
      } catch (e: unknown) {
        if (disposed || g !== olderGen || controller.signal.aborted) return;
        // 入口已要求 last!=null;失败不得走整页 onError(会拆已有视图)
        callbacks.onOlderError?.(apiErrorMessage(e));
      }
    },
    async onExpandSegment(sessionRef: string) {
      if (disposed) return null;
      expandCtrls.get(sessionRef)?.abort();
      const controller = new AbortController();
      expandCtrls.set(sessionRef, controller);
      try {
        const res = await apiGet<TranscriptResponse>(
          `/api/focuses/${encodeURIComponent(focusId)}/activations/${encodeURIComponent(sessionRef)}/transcript`,
          controller.signal
        );
        if (disposed || controller.signal.aborted || expandCtrls.get(sessionRef) !== controller) return null;
        return mapTranscriptLines(res);
      } catch {
        return null;
      } finally {
        if (expandCtrls.get(sessionRef) === controller) expandCtrls.delete(sessionRef);
      }
    }
  };
}

export function useFocusPageData(
  focusId: string,
  currentSessionId?: string | null,
  liveCard?: LiveConfirmCard | null,
  liveSpoken?: readonly LiveInterviewSpoken[],
  interviewAnchor?: InterviewAnchorCommit | null,
  interviewRounds?: readonly InterviewRoundLease[]
): FocusPageDataState {
  const [view, setView] = useState<FocusPageView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [olderError, setOlderError] = useState<string | null>(null);
  const sessionRef = useRef<FocusPageSession | null>(null);
  const hasViewRef = useRef(false);

  useEffect(() => {
    hasViewRef.current = false;
    setLoading(true);
    setError(null);
    setView(null);
    setNextCursor(null);
    setOlderError(null);

    const session = createFocusPageSession(
      focusId,
      currentSessionId,
      {
        onResult: (res) => {
          hasViewRef.current = true;
          setView(res.view);
          setNextCursor(res.nextCursor);
          setError(null);
          setLoading(false);
        },
        onError: (e) => {
          // 后台刷新失败不拆掉已有页面:只有首屏没数据时才升级为整页错误
          if (!hasViewRef.current) setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        },
        onOlderError: setOlderError
      },
      undefined,
      liveCard
    );
    sessionRef.current = session;
    session.run();
    return () => {
      session.dispose();
      sessionRef.current = null;
    };
  }, [
    focusId,
    currentSessionId,
    liveCard?.kind,
    liveCard?.packageId,
    liveCard?.revision,
    liveCard?.receiptId,
    liveCard?.text
  ]);

  const reload = useCallback(() => sessionRef.current?.run(), []);
  const loadOlder = useCallback(() => sessionRef.current?.loadOlder() ?? Promise.resolve(), []);
  const onExpandSegment = useCallback(
    (sessionRefName: string) => sessionRef.current?.onExpandSegment(sessionRefName) ?? Promise.resolve(null),
    []
  );

  const viewWithInterview = useMemo(() => {
    if (!view) return view;
    return {
      ...view,
      interview: projectLiveInterview({
        pageFocusId: focusId,
        sessionOwned: view.sessionOwned === true,
        sessionId: currentSessionId,
        spoken: liveSpoken ?? [],
        rounds: interviewRounds ?? [],
        confirmCard: liveCard,
        committed: interviewAnchor ?? null
      })
    };
  }, [view, currentSessionId, liveSpoken, liveCard, focusId, interviewAnchor, interviewRounds]);

  return {
    view: viewWithInterview,
    loading,
    error,
    reload,
    loadOlder,
    hasOlder: nextCursor != null,
    olderError,
    onExpandSegment
  };
}
