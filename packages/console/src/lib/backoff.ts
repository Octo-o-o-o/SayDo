// 指数退避(桌面 HTTP 重试与移动重连共用一份实现)。
//
// 原本只长在 mobile/reconnect.ts 里;桌面接 retryable 重试时若另写一套,两处参数迟早漂移,
// 故提到 lib 共享,mobile 侧按原名 re-export 保持既有调用点与测试不变。

export const BACKOFF_BASE_MS = 500;
export const BACKOFF_CAP_MS = 30_000;

/** 第 attempt 次失败后的等待(attempt 从 0 起);次数不封顶,间隔封顶 30s。 */
export function nextBackoffDelayMs(attempt: number): number {
  const n = Number.isFinite(attempt) ? Math.max(0, Math.floor(attempt)) : 0;
  // 避免 2**大数溢出为 Infinity
  const exp = Math.min(n, 16);
  return Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** exp);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
