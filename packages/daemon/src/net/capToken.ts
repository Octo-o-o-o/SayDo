// capability token 装载(计划 4.1 G1):启动生成一次性 token 落 ~/.saydo/.cap-token(mode 600),
// pipeline/console 读同一文件带 ?token= 连 daemon;daemon 侧 verifyIdentity 比对。
// SAYDO_DISABLE_CAP_TOKEN=1(仅 dev 明确关闭)⇒ 返回空串,verifyIdentity 会因空 expectedToken 拒
// ——即"未配置即拒",不 fail-open。

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { restrictOwnerOnly } from "@saydo/platform";

export function loadOrCreateCapToken(saydoDir: string): string {
  const path = join(saydoDir, ".cap-token");
  if (existsSync(path)) {
    restrictOwnerOnly(path, "file");
    const t = readFileSync(path, "utf8").trim();
    if (t !== "") return t;
  }
  const token = randomBytes(24).toString("base64url");
  writeFileSync(path, token, { mode: 0o600 });
  restrictOwnerOnly(path, "file");
  return token;
}
