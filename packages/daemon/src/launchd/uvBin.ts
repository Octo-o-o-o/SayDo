// 只遍历 PATH 找 uv;不调裸名 which(stdout 不可信)。
// 命中条件:PATH 项绝对路径、非常规相对项、join(dir,"uv") 为绝对路径、basename===uv、常规文件、X_OK。
// 返回校验过的 PATH 项本身,不用 realpath 替换(brew 升级后 cellar 路径会失效)。

import { accessSync, constants, statSync } from "node:fs";
import { basename, isAbsolute, join } from "node:path";

export function isExistingDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function resolveUvBin(env: NodeJS.ProcessEnv = process.env): string | null {
  for (const dir of (env["PATH"] ?? "").split(":")) {
    if (!dir || dir === ".") continue;
    if (!isAbsolute(dir)) continue;
    const candidate = join(dir, "uv");
    if (!isAbsolute(candidate) || basename(candidate) !== "uv") continue;
    try {
      const st = statSync(candidate);
      if (!st.isFile()) continue;
      accessSync(candidate, constants.X_OK);
    } catch {
      continue;
    }
    return candidate;
  }
  return null;
}
