// VIEW-01 页面会话(GAP-02 残项 2.2):pageLoader(同刻单在途 / dispose abort / 晚到丢弃)+ 失效来源
// (主 WS 失效事件 / 回前台 / 有界兜底)合成一个可 run/dispose 的纯对象。不含 React:三页 hook 只做薄包装,
// 单测用 EventTarget 假 window/document + stub fetch 直接驱动这里(仓内无 DOM 测试环境)。

import { createPageLoader } from "./pageLoader";
import { installRefreshSignal, type RefreshSignalTargets } from "./useRefreshSignal";

export interface PageSessionRefresh {
  targets?: RefreshSignalTargets;
  intervalMs?: number;
}

export interface PageSessionCallbacks<T> {
  onResult: (result: T) => void;
  onError: (error: unknown) => void;
}

export interface PageSession {
  /** 触发一次重取;在途期间合并成完成后一次补拉 */
  run(): void;
  /** 卸载:拆监听/定时器 + abort 在途;之后 run 为 no-op,晚到响应不再回调 */
  dispose(): void;
  inFlight(): boolean;
}

export function createPageSession<T>(options: {
  load: (signal: AbortSignal) => Promise<T>;
  callbacks: PageSessionCallbacks<T>;
  refresh?: PageSessionRefresh;
}): PageSession {
  const loader = createPageLoader<T>({
    load: options.load,
    onResult: options.callbacks.onResult,
    onError: options.callbacks.onError
  });
  const stopRefresh = installRefreshSignal(() => loader.run(), options.refresh ?? {});
  return {
    run: () => loader.run(),
    dispose: () => {
      stopRefresh();
      loader.dispose();
    },
    inFlight: () => loader.inFlight()
  };
}
