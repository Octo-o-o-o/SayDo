// useRecordsPageData:记录页 hook。
// 数据源:getFocusDetail(lanes/events/obligations)+ timeline 的 session_segment 项。

import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../../lib/api";
import type { RecordsPageView } from "../../pages/redesign/RecordsPage";
import {
  mapActivationSessions,
  mapDaemonTimelineItem,
  mapFocusView,
  mapObligationView,
  mapRecordEvents,
  mapRecordSegments,
  mapTranscriptLines,
  markLiveSegments,
  type DaemonTimelineItem,
  type FocusDetailPayload,
  type FocusListRow,
  type TranscriptResponse
} from "./mappers";

export interface RecordsPageDataState {
  view: RecordsPageView | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  onExpandSegment: (sessionRef: string) => Promise<string[] | null>;
}

export function useRecordsPageData(focusId: string, currentSessionId?: string | null): RecordsPageDataState {
  const [view, setView] = useState<RecordsPageView | null>(null);
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
        const [detail, timelineRes, list] = await Promise.all([
          apiGet<FocusDetailPayload>(`/api/focuses/${encodeURIComponent(focusId)}`),
          apiGet<{ items: DaemonTimelineItem[]; nextCursor: number | null }>(
            // 记录页会话段:首屏多拉一点;翻页归后续
            `/api/focuses/${encodeURIComponent(focusId)}/timeline?limit=200`
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
        // L2:当前会话名下的 activation 集合 ⇒ endTs=null 段标 live(与 Focus 页同口径)
        const liveRefs = new Set<string>();
        if (currentSessionId) {
          for (const [aid, sid] of mapActivationSessions(detail.events ?? [])) {
            if (sid === currentSessionId) liveRefs.add(aid);
          }
        }
        const timeline = markLiveSegments((timelineRes.items ?? []).map(mapDaemonTimelineItem), liveRefs);

        // lanes:eventCount = 归属该线的 events 数(无 laneId 记主线)
        const lanesRaw = detail.lanes ?? [];
        const events = detail.events ?? [];
        const countByLane = new Map<string, number>();
        let mainCount = 0;
        for (const ev of events) {
          const lid = typeof ev.payload?.["laneId"] === "string" ? (ev.payload["laneId"] as string) : null;
          if (lid) countByLane.set(lid, (countByLane.get(lid) ?? 0) + 1);
          else mainCount += 1;
        }
        const lanes =
          lanesRaw.length > 0
            ? lanesRaw.map((l) => ({
                id: l.id,
                title: l.title,
                eventCount: countByLane.get(l.id) ?? 0,
                retired: l.retiredAt != null
              }))
            : [{ id: "__main__", title: "主线", eventCount: mainCount || events.length }];

        // 依赖:waiting 且挂了 waitingOnObligationId
        const dependencies = detail.obligations
          .filter((o) => o.status === "waiting" && (o.waitingOnObligationId || o.waitingOn))
          .map((o) => mapObligationView(o, focusId));

        const segments = mapRecordSegments(timeline);
        const recordEvents = mapRecordEvents(events).slice().sort((a, b) => b.seq - a.seq);

        setView({
          focus,
          lanes,
          dependencies,
          segments,
          events: recordEvents
        });
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

  const onExpandSegment = useCallback(
    async (sessionRef: string): Promise<string[] | null> => {
      try {
        const res = await apiGet<TranscriptResponse>(
          `/api/focuses/${encodeURIComponent(focusId)}/activations/${encodeURIComponent(sessionRef)}/transcript`
        );
        return mapTranscriptLines(res);
      } catch {
        return null;
      }
    },
    [focusId]
  );

  return { view, loading, error, reload, onExpandSegment };
}
