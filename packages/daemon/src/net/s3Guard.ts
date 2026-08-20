// assertS3LocalAndBound(09 §3.3 共享守卫,S3 面统一;R-A 补完 2026-07-27,Codex 21 A2):
// 四个 S3 工具及其 HTTP 承载 endpoint 在任何业务逻辑前执行同一守卫,四断言缺一即 403 + 审计:
//   ① socket peer = loopback(以连接对端地址为准;Host/Origin 头不单独作数——头可伪造,
//      identity.ts 的 Host 推导仅在 peer 断言通过后参与);
//   ② Origin 精确 = http://localhost:<port>(S3 面只服务浏览器,无 Origin 的 CLI 式请求一律拒);
//   ③ 来源面 via="local"(tailnet 白名单命中即拒,W2 403 既有);
//   ④ rpId = daemon 常量 "localhost"(不读请求)。
// S3 收据只能由 verifyS3Assertion 产生:通用审批 endpoint 对 risk='S3' 行一律拒(index.ts 接线);
// 四工具不进 Brain tool manifest(语音面无 S3 触发点,10 §4 S3 纪律的机械承载)。

import { S3_RP_ID } from "@saydo/contracts";

export interface S3GuardInput {
  /** 连接对端地址(req.socket.remoteAddress;可信,不可伪造) */
  socketRemoteAddress: string | undefined;
  origin: string | undefined;
  via: "local" | "tailnet" | undefined;
  port: number;
}

export type S3GuardVerdict =
  | { ok: true; rpId: typeof S3_RP_ID; expectedOrigin: string }
  | { ok: false; code: "s3_peer_not_loopback" | "s3_origin_rejected" | "s3_requires_trusted_terminal"; reason: string };

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

export function assertS3LocalAndBound(i: S3GuardInput): S3GuardVerdict {
  // ① socket peer = loopback(Host 自报 localhost 但对端非环回 ⇒ 拒;§12-13 反例)
  if (!i.socketRemoteAddress || !LOOPBACK.has(i.socketRemoteAddress)) {
    return {
      ok: false,
      code: "s3_peer_not_loopback",
      reason: `S3 面只接受环回连接(peer=${i.socketRemoteAddress ?? "<none>"})`
    };
  }
  // ② Origin 精确 = http://localhost:<port>(无 Origin 的 CLI 式请求一律拒;127.0.0.1 origin 也拒——
  //    rpId=localhost 与其不匹配,页面壳层已归一重定向)
  const expectedOrigin = `http://${S3_RP_ID}:${i.port}`;
  if (i.origin === undefined) {
    return { ok: false, code: "s3_origin_rejected", reason: "S3 面只服务浏览器,请求缺 Origin 头" };
  }
  if (i.origin.toLowerCase() !== expectedOrigin) {
    return { ok: false, code: "s3_origin_rejected", reason: `Origin 须精确为 ${expectedOrigin}(got ${i.origin})` };
  }
  // ③ via="local"(tailnet 白名单命中即拒)
  if (i.via !== "local") {
    return {
      ok: false,
      code: "s3_requires_trusted_terminal",
      reason: "S3 操作只在本机受信终端完成——回到桌面屏幕操作;手机端可以看任务、批 S2。"
    };
  }
  // ④ rpId = daemon 常量(不读请求)
  return { ok: true, rpId: S3_RP_ID, expectedOrigin };
}
