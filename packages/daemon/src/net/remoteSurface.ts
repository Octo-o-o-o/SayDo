// PG-01B:main/recovery/voice 共用的远程业务面 fail-closed 守卫。
// recovery 是 composition root,不是 IdentityVia;本模块只消费 IdentityVia。

import type { IdentityVia } from "./identity.js";

export const REMOTE_VIAS = ["tailnet", "mobile_lan"] as const;
export type RemoteVia = (typeof REMOTE_VIAS)[number];

export const REMOTE_BUSINESS_FORBIDDEN = {
  code: "remote_business_forbidden",
  message: "远程面不开放业务 API"
} as const;

export const REMOTE_VOICE_WS_FORBIDDEN = {
  code: "remote_voice_ws_forbidden",
  message: "远程面不开放语音业务连接"
} as const;

const HEALTH_OR_READINESS = new Set(["/health", "/readyz"]);

export function isRemoteVia(via: IdentityVia | undefined): via is RemoteVia {
  return via === "tailnet" || via === "mobile_lan";
}

export function isHealthOrReadinessPath(pathname: string): boolean {
  return HEALTH_OR_READINESS.has(pathname);
}

export type RemoteSurfaceDecision =
  | { allow: true }
  | { allow: false; code: string; message: string };

/** HTTP:远程 via 的 /api/** 与 /dev/** 一律拒;health/readiness 与静态壳不走此函数。 */
export function remoteHttpBusinessDecision(input: {
  via: IdentityVia | undefined;
  pathname: string;
}): RemoteSurfaceDecision {
  if (!isRemoteVia(input.via)) return { allow: true };
  if (isHealthOrReadinessPath(input.pathname)) return { allow: true };
  if (
    input.pathname.startsWith("/api/") ||
    input.pathname.startsWith("/dev/") ||
    input.pathname.startsWith("/ws/")
  ) {
    return { allow: false, code: REMOTE_BUSINESS_FORBIDDEN.code, message: REMOTE_BUSINESS_FORBIDDEN.message };
  }
  return { allow: true };
}

/** WS:远程 via 的业务连接一律拒。pipeline 同机,不得带远程 via。 */
export function remoteVoiceWsDecision(via: IdentityVia | undefined): RemoteSurfaceDecision {
  if (!isRemoteVia(via)) return { allow: true };
  return { allow: false, code: REMOTE_VOICE_WS_FORBIDDEN.code, message: REMOTE_VOICE_WS_FORBIDDEN.message };
}
