// useFocusPageData:Focus 对话页数据 hook(接线合同 README FocusPageView)。
// 数据源:GET /api/focuses/:id + /timeline + /api/focuses 列表(openByOwner) + transcript 懒加载。
// VIEW-01:失效来源=本页动作 reload + 主 WS 事件 + 回前台 + 有界兜底;同刻单在途、卸载/切 focus abort、
// 晚到响应丢弃——全部由 pageSession 承载,本 hook 只是 React 薄包装(纯会话可无 DOM 单测)。
// 后台刷新按 seq 合并进已翻出的时间线。

import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "../../lib/api";
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
  type DaemonTimelineItem,
  type FocusDetailPayload,
  type FocusListRow,
  type TranscriptResponse
} from "./mappers";
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
  signal: AbortSignal
): Promise<FocusLoadResult> {
  const [detail, timelineRes, list] = await Promise.all([
    apiGet<FocusDetailPayload>(`/api/focuses/${encodeURIComponent(focusId)}`, signal),
    apiGet<{ items: DaemonTimelineItem[]; nextCursor: number | null }>(
      `/api/focuses/${encodeURIComponent(focusId)}/timeline?limit=${TIMELINE_LIMIT}`,
      signal
    ),
    apiGet<FocusListRow[]>("/api/focuses", signal).catch(() => [] as FocusListRow[])
  ]);
  if (!detail?.focus) throw new Error("Focus 不存在");

  const listRow = list.find((r) => r.id === focusId) ?? null;
  const focus = mapFocusView(detail, listRow);
  const obligations = detail.obligations.map((o) => mapObligationView(o, focusId));
  const artifacts = detail.artifacts.map((a) => mapArtifactView(a, focusId));
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

  // lookups:P0 从 detail 义务/产物建表;任务/包无 focus 侧列表 API 时诚实缺 key
  // OPEN QUESTION:任务按 focus 列表 API 未暴露,rail.tasks / lookups.tasks 暂空
  // (timeline 当前仅 event|session_segment,无 kind:task 成员)
  const obLookup = Object.fromEntries(obligations.map((o) => [o.id, o]));

  const view: FocusPageView = {
    focus,
    timeline,
    rail: {
      obligations,
      tasks: [],
      artifacts,
      projects: detail.repos.map((r) => ({
        id: r.projectId,
        title: r.projectId,
        path: r.note ?? ""
      })),
      // OPEN QUESTION:focus 级记忆列表 API 未暴露;P0 空数组=不渲染该组
      memories: []
    },
    expectations,
    // interview:P0 恒 undefined(活跃采访归 live 通道,不接)
    interview: undefined,
    lookups: {
      obligations: obLookup
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

/** 纯会话:Focus 页数据序列(供 hook 与单测共用) */
export function createFocusPageSession(
  focusId: string,
  currentSessionId: string | null | undefined,
  callbacks: PageSessionCallbacks<FocusLoadResult>,
  refresh?: PageSessionRefresh
): PageSession {
  return createPageSession<FocusLoadResult>({
    load: (signal) => loadFocus(focusId, currentSessionId, signal),
    callbacks,
    ...(refresh ? { refresh } : {})
  });
}

export function useFocusPageData(focusId: string, currentSessionId?: string | null): FocusPageDataState {
  const [view, setView] = useState<FocusPageView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const timelineRef = useRef<TimelineItem[]>([]);
  // L2:当前会话的 activationRef 集合(活跃段「进行中」判定;loadOlder 合并时同口径复用)
  const liveRefsRef = useRef<ReadonlySet<string>>(new Set());
  const focusIdRef = useRef(focusId);
  focusIdRef.current = focusId;
  const sessionRef = useRef<PageSession | null>(null);
  const hasViewRef = useRef(false);
  // 用户已向上翻页:后台刷新只合并首页,不回退游标
  const pagedRef = useRef(false);

  useEffect(() => {
    hasViewRef.current = false;
    pagedRef.current = false;
    setLoading(true);
    setError(null);
    setView(null);
    timelineRef.current = [];
    setNextCursor(null);

    const session = createFocusPageSession(focusId, currentSessionId, {
      onResult: (res) => {
        liveRefsRef.current = res.liveRefs;
        const merged = hasViewRef.current
          ? mergeBySeq(timelineRef.current, res.view.timeline, res.liveRefs)
          : res.view.timeline;
        timelineRef.current = merged;
        hasViewRef.current = true;
        setView({ ...res.view, timeline: merged });
        if (!pagedRef.current) setNextCursor(res.nextCursor);
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
  }, [focusId, currentSessionId]);

  const reload = useCallback(() => sessionRef.current?.run(), []);

  const loadOlder = useCallback(async () => {
    if (nextCursor == null) return;
    const fid = focusIdRef.current;
    try {
      const res = await apiGet<{ items: DaemonTimelineItem[]; nextCursor: number | null }>(
        `/api/focuses/${encodeURIComponent(fid)}/timeline?limit=${TIMELINE_LIMIT}&cursor=${nextCursor}`
      );
      if (focusIdRef.current !== fid) return;
      const older = (res.items ?? []).map(mapDaemonTimelineItem);
      const merged = mergeBySeq(timelineRef.current, older, liveRefsRef.current);
      timelineRef.current = merged;
      pagedRef.current = true;
      setNextCursor(res.nextCursor ?? null);
      setView((prev) => (prev ? { ...prev, timeline: merged } : prev));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [nextCursor]);

  const onExpandSegment = useCallback(async (sessionRef: string): Promise<string[] | null> => {
    const fid = focusIdRef.current;
    try {
      const res = await apiGet<TranscriptResponse>(
        `/api/focuses/${encodeURIComponent(fid)}/activations/${encodeURIComponent(sessionRef)}/transcript`
      );
      return mapTranscriptLines(res);
    } catch {
      return null;
    }
  }, []);

  return {
    view,
    loading,
    error,
    reload,
    loadOlder,
    hasOlder: nextCursor != null,
    onExpandSegment
  };
}
