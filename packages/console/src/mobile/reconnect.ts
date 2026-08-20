/** 移动端断连重连：指数退避（次数不封顶，间隔封顶 30s）+ 前台/原生 resume 立即重连。 */

// 退避算法已提到 lib/backoff.ts 与桌面 HTTP 重试共用（免得两处参数漂移）；
// 这里按原名 re-export，既有调用点与测试不动。
export {
  BACKOFF_BASE_MS as RECONNECT_BASE_MS,
  BACKOFF_CAP_MS as RECONNECT_DELAY_CAP_MS,
  nextBackoffDelayMs as nextReconnectDelayMs
} from "../lib/backoff";

/** WebView / 页面内统一重连请求事件（iOS onResume 与手动按钮共用）。 */
export const MOBILE_RECONNECT_EVENT = "saydo:reconnect-request";
/** iOS 壳 scenePhase.active 注入，语义同回前台。 */
export const NATIVE_RESUME_EVENT = "saydo:native-resume";

function browserWindow(): Window {
  return globalThis as unknown as Window;
}

export function requestMobileReconnect(): void {
  browserWindow().dispatchEvent(new Event(MOBILE_RECONNECT_EVENT));
}

/**
 * 原生 resume / 手动请求 → 派给 VoiceChannel 单一 owner。
 * visibility 不再在此监听,避免与 useVoiceChannel 双拆健康 OPEN。
 */
export function installMobileForegroundReconnect(onReconnect: () => void): () => void {
  const win = browserWindow();
  const fire = () => {
    onReconnect();
  };
  win.addEventListener(NATIVE_RESUME_EVENT, fire);
  win.addEventListener(MOBILE_RECONNECT_EVENT, fire);
  return () => {
    win.removeEventListener(NATIVE_RESUME_EVENT, fire);
    win.removeEventListener(MOBILE_RECONNECT_EVENT, fire);
  };
}
