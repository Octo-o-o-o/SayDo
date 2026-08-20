// W2 阶段 B · T2 薄版配置(05 §4 提前批 #2:Tailscale 组网 + 手机浏览器 console + ntfy 深链)。
// 红线(IMPL-5 §2-B):tailnet 主机进 Host/Origin 白名单必须显式枚举,禁通配——
// 含 "*" / 空串 / 带 scheme·路径·端口的项一律 fail-closed:整个 tailnet 面不开(不是丢弃单项,
// 防"部分生效"造成的白名单心智错位),原因落日志与审计由调用方承载。

import { existsSync } from "node:fs";
import { loadConfigFile } from "../config/load.js";

export interface T2Config {
  /** 合法枚举(host[:无端口] 纯主机名/IP);空 = tailnet 面关闭 */
  tailnetHosts: readonly string[];
  /** daemon 绑定地址(缺省 127.0.0.1) */
  listen: string;
  /** fail-closed 原因(配置存在但非法时;tailnetHosts 必为空) */
  rejectedReason?: string;
}

const HOST_RE = /^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/;

export function parseT2Config(raw: { tailnet_hosts?: string[] | undefined; listen?: string | undefined } | undefined): T2Config {
  const listen = raw?.listen ?? "127.0.0.1";
  const hosts = raw?.tailnet_hosts ?? [];
  if (hosts.length === 0) return { tailnetHosts: [], listen };
  for (const h of hosts) {
    if (typeof h !== "string" || h.trim() === "" || h.includes("*") || !HOST_RE.test(h)) {
      return {
        tailnetHosts: [],
        listen,
        rejectedReason: `tailnet_hosts 含非法项 "${String(h).slice(0, 60)}"(须为纯主机名/IP 显式枚举,禁通配/scheme/端口)——tailnet 面整体不开(fail-closed)`
      };
    }
  }
  return { tailnetHosts: [...hosts], listen };
}

export function readT2Config(configPath: string): T2Config {
  try {
    const cfg = loadConfigFile(configPath);
    return parseT2Config(cfg.t2 as { tailnet_hosts?: string[]; listen?: string } | undefined);
  } catch {
    // config 缺失 = 首启合法(静默缺省);存在但解析炸 = 带 reason(迟到评审 C2:与 invalid-hosts
    // 路径可观测性对齐——都 fail-closed,留痕不静默)
    if (existsSync(configPath)) {
      return { tailnetHosts: [], listen: "127.0.0.1", rejectedReason: "config.toml 存在但解析失败——tailnet 面不开(fail-closed),本机面照常" };
    }
    return { tailnetHosts: [], listen: "127.0.0.1" };
  }
}
