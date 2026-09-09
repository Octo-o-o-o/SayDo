// VIEW-01 页面加载序列器:同刻至多一个在途请求(在途期间的 run 合并成完成后一次补拉,保证最终一致),
// dispose 时 abort 在途请求,晚到的响应/失败一律丢弃。不含 React,便于单测。

export interface PageLoader {
  run(): void;
  dispose(): void;
  inFlight(): boolean;
}

export function createPageLoader<T>(options: {
  load: (signal: AbortSignal) => Promise<T>;
  onResult: (result: T) => void;
  onError: (error: unknown) => void;
}): PageLoader {
  let disposed = false;
  let current: AbortController | null = null;
  let rerun = false;

  const start = () => {
    const controller = new AbortController();
    current = controller;
    options.load(controller.signal).then(
      (result) => settle(controller, () => options.onResult(result)),
      (error: unknown) => settle(controller, () => options.onError(error))
    );
  };

  const settle = (controller: AbortController, deliver: () => void) => {
    if (disposed || controller !== current || controller.signal.aborted) return;
    current = null;
    deliver();
    if (rerun) {
      rerun = false;
      start();
    }
  };

  return {
    run() {
      if (disposed) return;
      if (current) {
        rerun = true;
        return;
      }
      start();
    },
    dispose() {
      disposed = true;
      rerun = false;
      current?.abort();
      current = null;
    },
    inFlight() {
      return current !== null;
    }
  };
}
