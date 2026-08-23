import { constants } from "node:fs";
import { access, realpath, stat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

export interface ResolveExecutableOptions {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
}

function envValue(env: NodeJS.ProcessEnv, name: string, caseInsensitive: boolean): string | undefined {
  if (!caseInsensitive) return env[name];
  const key = Object.keys(env).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  return key ? env[key] : undefined;
}

function namesForPlatform(bin: string, platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string[] {
  if (platform !== "win32" || /\.[^\\/]+$/u.test(bin)) return [bin];
  const pathExt = envValue(env, "PATHEXT", true) ?? ".COM;.EXE;.BAT;.CMD";
  const extensions = pathExt
    .split(";")
    .map((value) => value.trim())
    .filter((value) => /^\.[A-Za-z0-9]+$/u.test(value))
    .flatMap((value) => [value, value.toLowerCase()]);
  // Windows 的裸命令解析先按 PATHEXT 尝试后缀。npm 同目录通常同时生成
  // extensionless POSIX shim、.cmd 与 .ps1；若先试裸文件，会在 Windows 误选
  // 不能直接执行的 POSIX shim，而不是 PATHEXT 指定的 .cmd。
  return [...new Set([...extensions.map((extension) => `${bin}${extension}`), bin])];
}

/** 不依赖外部 which/where 的跨平台 PATH 解析；Windows 同时遵守 Path/PATHEXT。 */
export async function resolveExecutable(
  bin: string,
  options: ResolveExecutableOptions = {}
): Promise<string | undefined> {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const direct = isAbsolute(bin) || /[\\/]/u.test(bin);
  const pathValue = envValue(env, "PATH", platform === "win32") ?? "";
  const directories = direct
    ? [""]
    : pathValue.split(platform === "win32" ? ";" : ":").filter((value) => value.length > 0);
  const names = namesForPlatform(bin, platform, env);
  for (const directory of directories) {
    for (const name of names) {
      const candidate = direct ? resolve(name) : resolve(directory, name);
      try {
        if (!(await stat(candidate)).isFile()) continue;
        if (platform !== "win32") await access(candidate, constants.X_OK);
        return await realpath(candidate);
      } catch {
        // 继续检查下一个 PATH/PATHEXT 候选。
      }
    }
  }
  return undefined;
}
