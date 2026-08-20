// 移动/桌面共用的重连开火规则:单一决策点,避免 MobileApp 与 VoiceChannel 双监听连发。

export const RECONNECT_COALESCE_MS = 400;

export type ReconnectTrigger = "visibility" | "native-resume" | "manual";

export function shouldFireReconnect(input: {
  trigger: ReconnectTrigger;
  wsOpen: boolean;
  nowMs: number;
  lastFiredAtMs: number | null;
  coalesceMs?: number;
}): { fire: boolean; nextLastFiredAtMs: number | null } {
  const windowMs = input.coalesceMs ?? RECONNECT_COALESCE_MS;
  if (input.lastFiredAtMs !== null && input.nowMs - input.lastFiredAtMs < windowMs) {
    return { fire: false, nextLastFiredAtMs: input.lastFiredAtMs };
  }
  if (input.trigger === "visibility" && input.wsOpen) {
    return { fire: false, nextLastFiredAtMs: input.lastFiredAtMs };
  }
  return { fire: true, nextLastFiredAtMs: input.nowMs };
}
