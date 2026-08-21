// 只遍历 PATH 找 uv;不调裸名 which(stdout 不可信)。
// 命中条件:PATH 项绝对路径、非常规相对项、join(dir,"uv") 为绝对路径、basename===uv、常规文件、X_OK。
// 返回校验过的 PATH 项本身,不用 realpath 替换(brew 升级后 cellar 路径会失效)。

import { accessSync, constants, statSync } from "node:fs";
import { basename, delimiter, isAbsolute, join } from "node:path";
import { hostKind } from "@saydo/platform";

export function isExistingDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function uvBasenames(): string[] {
  return hostKind() === "win32" ? ["uv.exe", "uv.cmd", "uv"] : ["uv"];
}

export function resolveUvBin(env: NodeJS.ProcessEnv = process.env): string | null {
  const names = uvBasenames();
  for (const dir of (env["PATH"] ?? "").split(delimiter)) {
    if (!dir || dir === ".") continue;
    if (!isAbsolute(dir)) continue;
    for (const name of names) {
      const candidate = join(dir, name);
      if (!isAbsolute(candidate) || !names.includes(basename(candidate))) continue;
      try {
        const st = statSync(candidate);
        if (!st.isFile()) continue;
        if (hostKind() !== "win32") accessSync(candidate, constants.X_OK);
      } catch {
        continue;
      }
      return candidate;
    }
  }
  return null;
}
