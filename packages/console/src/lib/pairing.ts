// 桌面「与手机配对」:daemon 只给 lanIp/port/开关,token 始终用本机已持有的 capToken。

import { apiGet, capToken } from "./api";

export const PAIRING_LAN_DISABLED_MESSAGE = "服务未开手机访问:启动时加 SAYDO_MOBILE_LAN=1";
export const PAIRING_DOWNLOAD_PLACEHOLDER = "应用上架后开放";
export const PAIRING_NOT_PRIVATE_MESSAGE = "本机局域网地址不是私网,无法生成配对码";
export const PAIRING_REMOTE_CLOSED_MESSAGE =
  "远程业务入口已关闭。手机暂时不能查看或操作业务,请在本机浏览器打开控制台。";

export type PairingInfo = {
  lanIp: string | null;
  port: number;
  mobileLanEnabled: boolean;
};

/** RFC1918 点分 IPv4。二维码只出私网,公网/CGNAT 等先不出码。 */
export function isRfc1918Ipv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  const oct = parts.map((p) => Number(p));
  if (oct.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  if (oct[0] === 10) return true;
  if (oct[0] === 192 && oct[1] === 168) return true;
  if (oct[0] === 172 && oct[1]! >= 16 && oct[1]! <= 31) return true;
  return false;
}

export function isPairingInfo(value: unknown): value is PairingInfo {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    (typeof row["lanIp"] === "string" || row["lanIp"] === null) &&
    typeof row["port"] === "number" &&
    Number.isInteger(row["port"]) &&
    typeof row["mobileLanEnabled"] === "boolean"
  );
}

export function pairingTargetUrl(_info: PairingInfo, _token: string): string | null {
  return null;
}

export function pairingBlockedReason(_info: PairingInfo, _token: string): string | null {
  return PAIRING_REMOTE_CLOSED_MESSAGE;
}

export async function fetchPairingInfo(): Promise<PairingInfo> {
  const raw = await apiGet<unknown>("/api/pairing-info");
  if (!isPairingInfo(raw)) throw new Error("配对信息形状无效");
  return raw;
}

export function currentPairingToken(): string {
  return capToken();
}
