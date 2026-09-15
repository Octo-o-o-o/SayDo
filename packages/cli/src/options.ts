import { homedir, userInfo } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

export const CLI_USAGE = [
  "用法:saydo <up|status|open|doctor|help> [--home PATH] [--port PORT] [--no-open] [--json]",
  "  up       前台启动 daemon + Web 控制台(缺省自动打开浏览器;--no-open 不开,之后用 saydo open)",
  "  status   探活:退出码 0=已连上 / 1=端口空闲 / 2=端口冲突",
  "  open     用带访问凭证的地址打开控制台(需要 daemon 已在运行)",
  "  doctor   只读诊断(--json 机器可读;退出码 0=正常 / 1=有降级 / 2=有故障)",
  "  --home   数据目录(缺省 ~/.saydo,或环境变量 SAYDO_HOME);--port 端口(缺省 47100)"
].join("\n");

export interface CliOptions {
  command: "up" | "status" | "open" | "doctor" | "help";
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
  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    return { command: "help", home: resolveSaydoHome(undefined, env["SAYDO_HOME"]), port: 47100, openBrowser: false };
  }
  if (command !== "up" && command !== "status" && command !== "open" && command !== "doctor") {
    throw new Error(`未知命令:${command}\n${CLI_USAGE}`);
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
