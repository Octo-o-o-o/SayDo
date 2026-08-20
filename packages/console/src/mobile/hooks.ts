import { useCallback, useEffect, useState } from "react";
import { loadMobileFocus, loadMobileFocuses, loadMobileToday } from "./data";
import type { AttentionItem, FocusDetailPayload, FocusRow } from "./types";

interface MobileResource<T> {
  data: T | null;
  error: string | null;
  reload: () => Promise<void>;
}

function useMobileResource<T>(loader: () => Promise<T>, pollMs = 30_000): MobileResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      setData(await loader());
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [loader]);
  useEffect(() => {
    void reload();
    const timer = window.setInterval(() => void reload(), pollMs);
    return () => window.clearInterval(timer);
  }, [pollMs, reload]);
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
