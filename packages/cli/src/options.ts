import { homedir, userInfo } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

export interface CliOptions {
  command: "up" | "status" | "open" | "doctor";
  home: string;
  port: number;
  openBrowser: boolean;
  /** 仅 doctor:输出机器可读 JSON 而非中文文本。 */
  json?: boolean;
}

function resolveOsHome(): string {
  const fromHomedir = homedir().trim();
  if (fromHomedir !== "" && isAbsolute(fromHomedir)) return fromHomedir;
  try {
    const fromUser = userInfo().homedir?.trim() ?? "";
    if (fromUser !== "" && isAbsolute(fromUser)) return fromUser;
  } catch {
    // userInfo 在某些环境不可用。
  }
  throw new Error("OS home unavailable:无法解析用户主目录(请设置 HOME 或 --home)");
}

export function resolveSaydoHome(explicit: string | undefined, envHome: string | undefined): string {
  const selected = explicit ?? (envHome?.trim() ? envHome : undefined) ?? join(resolveOsHome(), ".saydo");
  if (selected.trim() === "") throw new Error("--home 不能为空");
  if (!isAbsolute(selected)) throw new Error("SAYDO_HOME 必须是绝对路径");
  return resolve(selected);
}

export function parseCliOptions(argv: readonly string[], env: NodeJS.ProcessEnv = process.env): CliOptions {
  const command = argv[0];
  if (command !== "up" && command !== "status" && command !== "open" && command !== "doctor") {
    throw new Error("用法:saydo <up|status|open|doctor> [--home PATH] [--port PORT] [--no-open] [--json]");
  }
  let explicitHome: string | undefined;
  let rawPort: string | undefined;
  let noOpen = false;
  let json = false;
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--no-open") {
      if (noOpen) throw new Error("参数重复:--no-open");
      noOpen = true;
      continue;
    }
    if (arg === "--json") {
      if (command !== "doctor") throw new Error("参数仅 doctor 支持:--json");
      if (json) throw new Error("参数重复:--json");
      json = true;
      continue;
    }
    if (arg === "--home" || arg === "--port") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} 缺少值`);
      if (arg === "--home") {
        if (explicitHome !== undefined) throw new Error("参数重复:--home");
        explicitHome = value;
      } else {
        if (rawPort !== undefined) throw new Error("参数重复:--port");
        rawPort = value;
      }
      index += 1;
      continue;
    }
    throw new Error(`未知参数:${arg}`);
  }
  if (explicitHome !== undefined && explicitHome.trim() === "") throw new Error("--home 不能为空");
  const home = resolveSaydoHome(explicitHome, env["SAYDO_HOME"]);
  const selectedPort = rawPort ?? "47100";
  const port = Number(selectedPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error(`端口非法:${selectedPort}`);
  return { command, home, port, openBrowser: !noOpen, ...(command === "doctor" ? { json } : {}) };
}
