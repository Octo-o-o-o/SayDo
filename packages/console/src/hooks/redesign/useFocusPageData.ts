// useFocusPageData:Focus 对话页数据 hook(接线合同 README FocusPageView)。
// 数据源:GET /api/focuses/:id + /timeline + /api/focuses 列表(openByOwner) + transcript 懒加载。

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

export function useFocusPageData(focusId: string, currentSessionId?: string | null): FocusPageDataState {
  const [view, setView] = useState<FocusPageView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const timelineRef = useRef<TimelineItem[]>([]);
  // L2:当前会话的 activationRef 集合(活跃段「进行中」判定;loadOlder 合并时同口径复用)
  const liveRefsRef = useRef<ReadonlySet<string>>(new Set());
  const focusIdRef = useRef(focusId);
  focusIdRef.current = focusId;

  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setView(null);
    timelineRef.current = [];
    setNextCursor(null);

    void (async () => {
      try {
        const [detail, timelineRes, list] = await Promise.all([
          apiGet<FocusDetailPayload>(`/api/focuses/${encodeURIComponent(focusId)}`),
          apiGet<{ items: DaemonTimelineItem[]; nextCursor: number | null }>(
            `/api/focuses/${encodeURIComponent(focusId)}/timeline?limit=${TIMELINE_LIMIT}`
          ),
          apiGet<FocusListRow[]>("/api/focuses").catch(() => [] as FocusListRow[])
        ]);

        if (!alive) return;
        if (!detail?.focus) {
          setError("Focus 不存在");
          setLoading(false);
          return;
        }

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
        liveRefsRef.current = liveRefs;
        const timeline = markLiveSegments(
          (timelineRes.items ?? [])
            .map(mapDaemonTimelineItem)
            .sort((a, b) => a.seq - b.seq),
          liveRefs
        );
        timelineRef.current = timeline;

        const expectations = deriveExpectations(detail.artifacts, {
          revision: focus.currentRevision,
          direction: focus.direction
        });

        // lookups:P0 从 detail 义务/产物建表;任务/包无 focus 侧列表 API 时诚实缺 key
        // OPEN QUESTION:任务按 focus 列表 API 未暴露,rail.tasks / lookups.tasks 暂空
        // (timeline 当前仅 event|session_segment,无 kind:task 成员)
        const obLookup = Object.fromEntries(obligations.map((o) => [o.id, o]));

        const pageView: FocusPageView = {
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

        setView(pageView);
        setNextCursor(timelineRes.nextCursor ?? null);
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
  }, [focusId, tick, currentSessionId]);

  const loadOlder = useCallback(async () => {
    if (nextCursor == null) return;
    const fid = focusIdRef.current;
    try {
      const res = await apiGet<{ items: DaemonTimelineItem[]; nextCursor: number | null }>(
        `/api/focuses/${encodeURIComponent(fid)}/timeline?limit=${TIMELINE_LIMIT}&cursor=${nextCursor}`
      );
      const older = (res.items ?? []).map(mapDaemonTimelineItem);
      // 合并:按 seq 去重,升序;live 标记同口径复用(L2)
      const bySeq = new Map<number, TimelineItem>();
      for (const it of timelineRef.current) bySeq.set(it.seq, it);
      for (const it of older) bySeq.set(it.seq, it);
      const merged = markLiveSegments([...bySeq.values()].sort((a, b) => a.seq - b.seq), liveRefsRef.current);
      timelineRef.current = merged;
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
