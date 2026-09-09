// VIEW-01 页面加载序列器单测:请求去重(在途合并成一次补拉)/ 卸载 abort / 晚到旧响应不覆盖。

import { describe, expect, it, vi } from "vitest";
import { createPageLoader } from "./pageLoader";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup() {
  const pending: Deferred<string>[] = [];
  const signals: AbortSignal[] = [];
  const onResult = vi.fn<(r: string) => void>();
  const onError = vi.fn<(e: unknown) => void>();
  const loader = createPageLoader<string>({
    load: (signal) => {
      signals.push(signal);
      const d = deferred<string>();
      pending.push(d);
      return d.promise;
    },
    onResult,
    onError
  });
  return { loader, pending, signals, onResult, onError };
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe("createPageLoader", () => {
  it("在途时重复 run 只合并成一次补拉,不并发发起", async () => {
    const s = setup();
    s.loader.run();
    s.loader.run();
    s.loader.run();
    expect(s.pending).toHaveLength(1);
    s.pending[0]!.resolve("v1");
    await tick();
    expect(s.onResult).toHaveBeenCalledWith("v1");
    // 在途期间收到的失效信号 → 完成后补拉一次(保证最终一致)
    expect(s.pending).toHaveLength(2);
    s.pending[1]!.resolve("v2");
    await tick();
    expect(s.onResult).toHaveBeenLastCalledWith("v2");
    expect(s.pending).toHaveLength(2);
    expect(s.loader.inFlight()).toBe(false);
  });

  it("dispose 时 abort 在途请求,晚到的响应被丢弃", async () => {
    const s = setup();
    s.loader.run();
    expect(s.signals[0]!.aborted).toBe(false);
    s.loader.dispose();
    expect(s.signals[0]!.aborted).toBe(true);
    s.pending[0]!.resolve("late");
    await tick();
    expect(s.onResult).not.toHaveBeenCalled();
    // dispose 后 run 为 no-op
    s.loader.run();
    expect(s.pending).toHaveLength(1);
  });

  it("失败进 onError;dispose 后失败也不再回调", async () => {
    const s = setup();
    s.loader.run();
    s.pending[0]!.reject(new Error("500"));
    await tick();
    expect(s.onError).toHaveBeenCalledTimes(1);
    s.loader.run();
    s.loader.dispose();
    s.pending[1]!.reject(new Error("late"));
    await tick();
    expect(s.onError).toHaveBeenCalledTimes(1);
  });

  it("动作成功后 reload(run)真实发起新请求", async () => {
    const s = setup();
    s.loader.run();
    s.pending[0]!.resolve("first");
    await tick();
    s.loader.run();
    expect(s.pending).toHaveLength(2);
    s.loader.dispose();
  });
});
