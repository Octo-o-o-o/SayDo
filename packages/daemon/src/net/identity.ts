// G1 网络半边(计划 4.1;05 §4 G1 三合一之网络侧):daemon HTTP/WS 调用方身份。
// daemon 缺省只绑 127.0.0.1;M1 显式 LAN 开关可改绑 0.0.0.0,本层再加三道:
//   ① capability token 校验(1.2 已留参数位,4.1 启用);
//   ② socket peer + Host/浏览器来源白名单(防远端伪装 local 与 DNS-rebinding);
//   ③ 写工具主体绑定(带 token 的调用方才是"owner 主体",匿名请求不得驱动写工具)。
// fail-closed:缺 token / peer 或 Host 不符 / 浏览器来源非同源 ⇒ 拒。

import { timingSafeEqual } from "node:crypto";

/** 允许的 Host 头(127.0.0.1:port / localhost:port + [t2].tailnet_hosts 显式枚举;
 *  IP 字面量不受 DNS-rebinding 影响;tailnet MagicDNS 名由白名单枚举承载,禁通配——IMPL-5 §2-B) */
export type IdentityVia = "local" | "tailnet" | "mobile_lan";

function isPrivateLanHostname(hostname: string): boolean {
  const ipv4 = hostname.split(".").map(Number);
  if (ipv4.length !== 4 || !ipv4.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    return false;
  }
  return (
    ipv4[0] === 10 ||
    (ipv4[0] === 172 && (ipv4[1] as number) >= 16 && (ipv4[1] as number) <= 31) ||
    (ipv4[0] === 192 && ipv4[1] === 168)
  );
}

function mobileLanHostAllowed(host: string, port: number): boolean {
  try {
    const parsed = new URL(`http://${host}`);
    return parsed.port === String(port) && isPrivateLanHostname(parsed.hostname);
  } catch {
    return false;
  }
}

function normalizePeerAddress(address: string | undefined): string {
  return address?.toLowerCase().replace(/^::ffff:/, "") ?? "";
}

function isLoopbackPeer(address: string | undefined): boolean {
  const normalized = normalizePeerAddress(address);
  return normalized === "127.0.0.1" || normalized === "::1";
}

function isTailnetPeer(address: string | undefined): boolean {
  const normalized = normalizePeerAddress(address);
  const ipv4 = normalized.split(".").map(Number);
  if (
    ipv4.length === 4 &&
    ipv4.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
  ) {
    return ipv4[0] === 100 && (ipv4[1] as number) >= 64 && (ipv4[1] as number) <= 127;
  }
  return normalized.startsWith("fd7a:115c:a1e0:");
}

function hostAllowed(
  host: string | undefined,
  port: number,
  tailnetHosts: readonly string[],
  mobileLan: boolean,
  peerAddress: string | undefined
): IdentityVia | null {
  if (!host) return null;
  const norm = host.toLowerCase(); // 域名大小写不敏感(迟到评审 C1:大写 Host 误拒是 fail-closed 方向,归一化提健壮)
  // daemon 缺省仅 listen("127.0.0.1"),不列 [::1](Phase4 评审 C4:列了也连不上,徒增误导)
  if (norm === `127.0.0.1:${port}` || norm === `localhost:${port}`) {
    return isLoopbackPeer(peerAddress) ? "local" : null;
  }
  for (const h of tailnetHosts) {
    if (norm === `${h.toLowerCase()}:${port}`) return isTailnetPeer(peerAddress) ? "tailnet" : null;
  }
  if (mobileLan && mobileLanHostAllowed(norm, port) && isPrivateLanHostname(normalizePeerAddress(peerAddress))) {
    return "mobile_lan";
  }
  return null;
}

/** Origin 白名单:同源本地 + tailnet 枚举同源(浏览器跨站会带外部 Origin,拒之;非浏览器客户端无 Origin 头放行——本地 CLI/pipeline)。
 *  "null" origin(file://、sandboxed iframe)按跨站拒。tailnet 走 http(WireGuard 隧道内已加密;ts.net HTTPS 证书留原生外壳批)。 */
function originAllowed(
  origin: string | undefined,
  referer: string | undefined,
  secFetchSite: string | undefined,
  requestHost: string | undefined,
  port: number,
  tailnetHosts: readonly string[],
  via: IdentityVia
): boolean {
  if (origin === undefined) {
    if (via !== "mobile_lan") return true;
    if (!requestHost || !referer) return false;
    if (secFetchSite !== undefined && secFetchSite.toLowerCase() !== "same-origin") return false;
    try {
      return new URL(referer).origin.toLowerCase() === `http://${requestHost.toLowerCase()}`;
    } catch {
      return false;
    }
  }
  const norm = origin.toLowerCase(); // scheme/host 段大小写不敏感(同 C1 归一化)
  if (via === "local") {
    return norm === `http://127.0.0.1:${port}` || norm === `http://localhost:${port}`;
  }
  if (via === "tailnet") {
    return tailnetHosts.some((host) => norm === `http://${host.toLowerCase()}:${port}`);
  }
  return requestHost !== undefined && norm === `http://${requestHost.toLowerCase()}`;
}

function tokenEqual(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface IdentityCheckInput {
  host: string | undefined;
  origin: string | undefined;
  /** 浏览器同源 GET 通常不发 Origin；此时只接受同 Host Referer，Sec-Fetch-Site 若有须同源。 */
  referer?: string | undefined;
  secFetchSite?: string | undefined;
  /** 连接对端地址(req.socket.remoteAddress)，不可由 Host/Origin 伪造。 */
  peerAddress: string | undefined;
  /** 请求携带的 capability token(?token= 或 header) */
  token: string | undefined;
  port: number;
  /** daemon 配置的 capability token(启动生成;空 ⇒ 未启用校验,仅 dev 明确关闭时) */
  expectedToken: string;
  /** W2 阶段 B:tailnet 主机显式白名单枚举(net/t2.ts 已校验禁通配;缺省空 = tailnet 面关闭) */
  tailnetHosts?: readonly string[];
  /** M1:显式打开 RFC 1918 IPv4 Host 的 LAN 明文临时访问面 */
  mobileLan?: boolean;
}

export type IdentityVerdict =
  | { ok: true; principal: "owner"; via: IdentityVia }
  | { ok: false; code: "host_rejected" | "origin_rejected" | "token_missing" | "token_mismatch"; reason: string };

/** 统一身份校验(HTTP 与 WS 共用;顺序:Host -> Origin -> token,任一不过 fail-closed)。
 *  via 标注来源面(local=受信终端 / tailnet 或 mobile_lan=移动薄版)——S3 面只在 local 放行。 */
export function verifyIdentity(i: IdentityCheckInput): IdentityVerdict {
  const tailnetHosts = i.tailnetHosts ?? [];
  const via = hostAllowed(i.host, i.port, tailnetHosts, i.mobileLan === true, i.peerAddress);
  if (via === null) {
    return { ok: false, code: "host_rejected", reason: `Host not in allowlist: ${i.host ?? "<none>"}` };
  }
  if (!originAllowed(i.origin, i.referer, i.secFetchSite, i.host, i.port, tailnetHosts, via)) {
    return { ok: false, code: "origin_rejected", reason: `Origin not allowed (DNS-rebinding guard): ${i.origin}` };
  }
  if (i.expectedToken === "") {
    return { ok: false, code: "token_missing", reason: "daemon capability token not configured" };
  }
  if (!i.token) return { ok: false, code: "token_missing", reason: "request missing capability token" };
  if (!tokenEqual(i.token, i.expectedToken)) {
    return { ok: false, code: "token_mismatch", reason: "capability token mismatch" };
  }
  return { ok: true, principal: "owner", via };
}

/** 从 URL query 或 header 提取 token(?token= 优先,x-saydo-token 兜底) */
export function extractToken(url: string | undefined, headers: Record<string, string | string[] | undefined>): string | undefined {
  if (url) {
    const q = url.indexOf("?");
    if (q >= 0) {
      const t = new URLSearchParams(url.slice(q + 1)).get("token");
      if (t) return t;
    }
  }
  const h = headers["x-saydo-token"];
  return Array.isArray(h) ? h[0] : h;
}
