// VIEW-01 数据失效信号:复用既有主 WS(useVoiceChannel)收到的账本变化事件,经 window 事件广播给
// redesign 页面 hook;与 WS_RECONNECT_REQUEST_EVENT 同一形态,不新建第二条 WS、不引入全局 store。

export const DATA_INVALIDATE_EVENT = "saydo:data-invalidate";

export type DataInvalidateSource = "focus.entity" | "confirm.resolved" | "ws.reconnect";

export function dispatchDataInvalidate(source: DataInvalidateSource, target: EventTarget = window): void {
  target.dispatchEvent(new CustomEvent(DATA_INVALIDATE_EVENT, { detail: { source } }));
}
