// 本机配对信息:只读 en0 IPv4,供桌面控制台生成手机扫码 URL。
// token 不经本模块往返。

import { networkInterfaces, type NetworkInterfaceInfo } from "node:os";

export type PairingInfo = {
  lanIp: string | null;
  port: number;
  mobileLanEnabled: boolean;
};

export function isIpv4Address(entry: NetworkInterfaceInfo): boolean {
  return entry.family === "IPv4" || (entry.family as unknown) === 4;
}

export function lanIpv4FromInterfaces(ifaces: NodeJS.Dict<NetworkInterfaceInfo[]>): string | null {
  const en0 = ifaces["en0"] ?? [];
  for (const entry of en0) {
    if (entry.internal) continue;
    if (isIpv4Address(entry) && entry.address) return entry.address;
  }
  return null;
}

export function pairingInfoPayload(input: {
  ifaces?: NodeJS.Dict<NetworkInterfaceInfo[]>;
  port: number;
  mobileLanEnabled: boolean;
}): PairingInfo {
  return {
    lanIp: lanIpv4FromInterfaces(input.ifaces ?? networkInterfaces()),
    port: input.port,
    mobileLanEnabled: input.mobileLanEnabled
  };
}
