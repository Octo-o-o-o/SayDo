// 新家 CLI 隔离 HOME:空 mkdtemp + 只注入笼配置与登录凭据副本(禁止 hooks/MCP/extensions)。

import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { CageProvider } from "./cage.js";

export const GEMINI_DENY_POLICY = `# SayDo cage:deny all tools and MCP (admin tier)
[[rule]]
toolName = "*"
mcpName = "*"
decision = "deny"
priority = 999
denyMessage = "SayDo cage denies all tools"
`;

export const QWEN_EXCLUDED_TOOLS = [
  "run_shell_command",
  "write_file",
  "read_file",
  "list_directory",
  "glob",
  "grep_search",
  "search_file_content",
  "replace",
  "edit",
  "web_fetch",
  "web_search",
  "google_web_search",
  "save_memory",
  "write_todos",
  "read_many_files"
] as const;

export interface IsolatedHome {
  home: string;
  xdgConfig: string;
  xdgData: string;
  xdgState: string;
  xdgCache: string;
  policyFile?: string;
  authType?: string;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

function copyIfFile(from: string, to: string): void {
  if (!existsSync(from)) return;
  try {
    copyFileSync(from, to);
  } catch {
    // 凭据不可读则该次调用按未登录失败,不把路径错误扩散。
  }
}

function extractQwenAuth(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const src = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (src["security"] && typeof src["security"] === "object" && !Array.isArray(src["security"])) {
    const security = src["security"] as Record<string, unknown>;
    if (security["auth"] && typeof security["auth"] === "object" && !Array.isArray(security["auth"])) {
      out["security"] = { auth: security["auth"] };
    }
  }
  const env =
    src["env"] && typeof src["env"] === "object" && !Array.isArray(src["env"])
      ? { ...(src["env"] as Record<string, unknown>) }
      : {};
  const meta =
    src["providerMetadata"] && typeof src["providerMetadata"] === "object" && !Array.isArray(src["providerMetadata"])
      ? (src["providerMetadata"] as Record<string, unknown>)
      : undefined;
  const deepseek = meta && typeof meta["deepseek"] === "object" && meta["deepseek"] !== null
    ? (meta["deepseek"] as Record<string, unknown>)
    : undefined;
  if (typeof deepseek?.["baseUrl"] === "string" && env["OPENAI_BASE_URL"] === undefined) {
    env["OPENAI_BASE_URL"] = deepseek["baseUrl"];
  }
  if (typeof env["DEEPSEEK_API_KEY"] === "string" && env["OPENAI_API_KEY"] === undefined) {
    env["OPENAI_API_KEY"] = env["DEEPSEEK_API_KEY"];
  }
  if (Object.keys(env).length > 0) out["env"] = env;
  if (src["modelProviders"] && typeof src["modelProviders"] === "object") out["modelProviders"] = src["modelProviders"];
  if (meta) out["providerMetadata"] = meta;
  return out;
}

/** 为新家构造隔离 HOME;realHome 仅用于拷贝登录凭据,默认 os.homedir()。 */
export function prepareIsolatedHome(provider: CageProvider, realHome = homedir()): IsolatedHome {
  const home = mkdtempSync(join(tmpdir(), "saydo-byoa-home-"));
  const xdgConfig = join(home, ".config");
  const xdgData = join(home, ".local", "share");
  const xdgState = join(home, ".local", "state");
  const xdgCache = join(home, ".cache");
  for (const dir of [xdgConfig, xdgData, xdgState, xdgCache]) mkdirSync(dir, { recursive: true });

  if (provider === "gemini_cli") {
    const geminiDir = join(home, ".gemini");
    const policyDir = join(geminiDir, "policies");
    mkdirSync(policyDir, { recursive: true });
    const policyFile = join(policyDir, "saydo-deny.toml");
    writeFileSync(policyFile, GEMINI_DENY_POLICY, { encoding: "utf8", mode: 0o600 });
    writeJson(join(geminiDir, "settings.json"), {
      security: { auth: { selectedType: "oauth-personal" } }
    });
    const src = join(realHome, ".gemini");
    copyIfFile(join(src, "oauth_creds.json"), join(geminiDir, "oauth_creds.json"));
    copyIfFile(join(src, "google_accounts.json"), join(geminiDir, "google_accounts.json"));
    return { home, xdgConfig, xdgData, xdgState, xdgCache, policyFile };
  }

  if (provider === "qwen_cli") {
    const qwenDir = join(home, ".qwen");
    mkdirSync(qwenDir, { recursive: true });
    let auth: Record<string, unknown> = {};
    const userSettings = join(realHome, ".qwen", "settings.json");
    if (existsSync(userSettings)) {
      try {
        auth = extractQwenAuth(JSON.parse(readFileSync(userSettings, "utf8")));
      } catch {
        auth = {};
      }
    }
    writeJson(join(qwenDir, "settings.json"), {
      model: { maxToolCalls: 0 },
      tools: { exclude: [...QWEN_EXCLUDED_TOOLS] },
      ...auth
    });
    const selected =
      auth["security"] && typeof auth["security"] === "object"
        ? ((auth["security"] as Record<string, unknown>)["auth"] as Record<string, unknown> | undefined)
        : undefined;
    const authType = typeof selected?.["selectedType"] === "string" ? selected["selectedType"] : undefined;
    return { home, xdgConfig, xdgData, xdgState, xdgCache, ...(authType ? { authType } : {}) };
  }

  if (provider === "copilot_cli") {
    const copilotDir = join(home, ".copilot");
    mkdirSync(copilotDir, { recursive: true });
    writeJson(join(copilotDir, "settings.json"), { version: 1 });
    return { home, xdgConfig, xdgData, xdgState, xdgCache };
  }

  return { home, xdgConfig, xdgData, xdgState, xdgCache };
}

export function isolatedHomeEnv(iso: IsolatedHome): Record<string, string> {
  return {
    HOME: iso.home,
    XDG_CONFIG_HOME: iso.xdgConfig,
    XDG_DATA_HOME: iso.xdgData,
    XDG_STATE_HOME: iso.xdgState,
    XDG_CACHE_HOME: iso.xdgCache
  };
}

/** 从隔离 HOME 的 qwen settings.env 抽出 endpoint 所需变量,不记日志。 */
export function isolatedProviderSecrets(iso: IsolatedHome): Record<string, string> {
  const settingsPath = join(iso.home, ".qwen", "settings.json");
  if (!existsSync(settingsPath)) return {};
  try {
    const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as { env?: Record<string, unknown> };
    const env = settings.env ?? {};
    const out: Record<string, string> = {};
    for (const key of ["OPENAI_API_KEY", "OPENAI_BASE_URL", "GEMINI_API_KEY", "GOOGLE_API_KEY"]) {
      if (typeof env[key] === "string" && env[key]) out[key] = env[key];
    }
    return out;
  } catch {
    return {};
  }
}
