// VIEW-01 失效来源合流(四个 redesign 页 hook 共用):
// ① 主 WS 失效事件(focus.entity / confirm.resolved / 重连)② visibilitychange 回前台
// ③ 有界兜底刷新(上限 60 s,后台标签页暂停)。本页动作成功后的定向 reload 由 hook 自己调 loader.run。
// 纯安装函数与 React 包装分离,便于无 DOM 单测。

import { useEffect, useRef } from "react";
import { DATA_INVALIDATE_EVENT } from "../../lib/dataInvalidate";

export const BOUNDED_REFRESH_MS = 60_000;

export type RefreshReason = "invalidate" | "visibility" | "interval";

export interface RefreshSignalTargets {
  win: EventTarget;
  doc: EventTarget & { visibilityState: string };
}

export function installRefreshSignal(
  onRefresh: (reason: RefreshReason) => void,
  options: { targets?: RefreshSignalTargets; intervalMs?: number } = {}
): () => void {
  const win = options.targets?.win ?? window;
  const doc = options.targets?.doc ?? document;
  const intervalMs = options.intervalMs ?? BOUNDED_REFRESH_MS;
  let timer: ReturnType<typeof setInterval> | null = null;

  const stopInterval = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
  const startInterval = () => {
    stopInterval();
    timer = setInterval(() => onRefresh("interval"), intervalMs);
  };
  const onInvalidate = () => onRefresh("invalidate");
  const onVisibility = () => {
    if (doc.visibilityState !== "visible") {
      stopInterval();
      return;
    }
    onRefresh("visibility");
    startInterval();
  };

  win.addEventListener(DATA_INVALIDATE_EVENT, onInvalidate);
  doc.addEventListener("visibilitychange", onVisibility);
  if (doc.visibilityState === "visible") startInterval();

  return () => {
    win.removeEventListener(DATA_INVALIDATE_EVENT, onInvalidate);
    doc.removeEventListener("visibilitychange", onVisibility);
    stopInterval();
  };
}

/** React 包装:onRefresh 走 ref,避免每次渲染重装监听/定时器。 */
export function useRefreshSignal(onRefresh: (reason: RefreshReason) => void): void {
  const ref = useRef(onRefresh);
  ref.current = onRefresh;
  useEffect(() => installRefreshSignal((reason) => ref.current(reason)), []);
}
