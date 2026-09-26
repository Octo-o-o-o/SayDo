import { useCallback, useEffect, useRef, useState } from "react";
import { loadMobileFocus, loadMobileFocuses, loadMobileObligations, loadMobileToday } from "./data";
import type { AttentionItem, FocusDetailPayload, FocusRow } from "./types";

interface MobileResource<T> {
  data: T | null;
  error: string | null;
  reload: () => Promise<void>;
}

export function useMobileResource<T>(loader: () => Promise<T>, pollMs = 30_000): MobileResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const genRef = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(async () => {
    const gen = genRef.current;
    try {
      const next = await loaderRef.current();
      if (gen !== genRef.current) return;
      setData(next);
      setError(null);
    } catch (caught) {
      if (gen !== genRef.current) return;
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, []);

  useEffect(() => {
    const gen = ++genRef.current;
    const controller = new AbortController();
    setData(null);
    setError(null);
    void (async () => {
      try {
        const next = await loader();
        if (controller.signal.aborted || gen !== genRef.current) return;
        setData(next);
        setError(null);
      } catch (caught) {
        if (controller.signal.aborted || gen !== genRef.current) return;
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    })();
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const next = await loader();
          if (controller.signal.aborted || gen !== genRef.current) return;
          setData(next);
          setError(null);
        } catch (caught) {
          if (controller.signal.aborted || gen !== genRef.current) return;
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      })();
    }, pollMs);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      if (genRef.current === gen) genRef.current += 1;
    };
  }, [loader, pollMs]);

  return { data, error, reload };
}

export function useMobileAttention(): MobileResource<AttentionItem[]> {
  const loader = useCallback(async () => (await loadMobileToday()).items ?? [], []);
  return useMobileResource(loader);
}

export function useMobileFocuses(): MobileResource<FocusRow[]> {
  return useMobileResource(loadMobileFocuses);
}

export function useMobileFocus(focusId: string | null): MobileResource<FocusDetailPayload | null> {
  const loader = useCallback(() => (focusId ? loadMobileFocus(focusId) : Promise.resolve(null)), [focusId]);
  return useMobileResource(loader);
}

/** DAILY-01:跨 Focus 义务(移动安排页;行形状宽松,页面端按字段消费) */
export function useMobileObligations(): MobileResource<Record<string, unknown>[]> {
  const loader = useCallback(async () => (await loadMobileObligations()) as Record<string, unknown>[], []);
  return useMobileResource(loader);
}
