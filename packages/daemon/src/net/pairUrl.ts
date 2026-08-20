// W2 阶段 B · 手机首次配对 URL(一次性注入 capability token)。
// 语义:token 经此 URL 打开一次后由 console 存 localStorage(lib/api.ts capToken),
// 之后 ntfy 深链只带路由不带 token(IMPL-5 §2-B)。此 URL 含 token,只在受信通道
// (owner 本人手机)一次性使用,不进通知、不落库。
// 用法:just t2-pair(打印 URL,手机浏览器打开)。

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readT2Config } from "./t2.js";
import { saydoStateRoot, validateStateRoot } from "../projects/workspace.js";

const SAYDO_HOME = saydoStateRoot();
validateStateRoot(SAYDO_HOME);
const PORT = Number(process.env["SAYDO_DAEMON_PORT"] ?? 47100);

const t2 = readT2Config(join(SAYDO_HOME, "config.toml"));
if (t2.rejectedReason) {
  console.error(`[fail] ${t2.rejectedReason}`);
  process.exit(1);
}
if (t2.tailnetHosts.length === 0) {
  console.error('[fail] 未配置 [t2].tailnet_hosts(~/.saydo/config.toml);先配 tailnet 主机名再配对');
  process.exit(1);
}
let token: string;
try {
  token = readFileSync(join(SAYDO_HOME, ".cap-token"), "utf8").trim();
} catch {
  console.error("[fail] 读不到 ~/.saydo/.cap-token(daemon 首次启动会生成)");
  process.exit(1);
}
const host = t2.tailnetHosts[0] as string;
console.log("手机浏览器打开以下 URL 一次(token 会存进手机本地会话,之后通知深链不再带 token):");
console.log(`http://${host}:${PORT}/?token=${encodeURIComponent(token)}`);
