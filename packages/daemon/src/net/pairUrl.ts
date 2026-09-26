// W2 阶段 B · 手机首次配对 URL。PG-01B:远程业务 fail-closed,不再打印含 token 的业务 URL。
// 保留状态根与 T2 配置校验,不读 .cap-token,不输出凭据。

import { join } from "node:path";
import { readT2Config } from "./t2.js";
import { saydoStateRoot, validateStateRoot } from "../projects/workspace.js";

const SAYDO_HOME = saydoStateRoot();
validateStateRoot(SAYDO_HOME);

const t2 = readT2Config(join(SAYDO_HOME, "config.toml"));
if (t2.rejectedReason) {
  console.error(`[fail] ${t2.rejectedReason}`);
  process.exit(1);
}
console.error("[fail] 远程业务入口已关闭。手机和远程浏览器不能读写业务数据,请在本机浏览器打开控制台。");
process.exit(1);
