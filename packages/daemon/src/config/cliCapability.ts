// first-run onboarding:本机 CLI 能力探测(登录态 + 可用模型枚举)。
// 与 setup.ts 的 probeCliOnce(只做 which/--version)互补——那条是"装没装",这条是"能不能用、有哪些模型"。
//
// 目录分两层(2026-08-12):
//   wired          = 已作为 ModelBinding provider 接线(cursor/codex/claude)
//   inventory_only = 仅识别:装没装/版本/尽力登录态,不能选进推理槽
// 能力不齐是实测事实,不做统一假象:
//   cursor-agent: `--list-models` 可真枚举
//   codex/claude: 无列模型接口 ⇒ 本机痕迹 + 手填
//   grok        : `models` 可列 + 同输出含登录态(2026-08-12 本机实测)
//   其余主流    : PATH 探测 + 尽力 auth,模型不臆造
//
// 红线:枚举失败一律如实标 enumerable=false + 人话 note,禁止编造模型名冒充"可用列表"。

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { open as openFile, readFile, readdir as readDirectory, stat as statFile } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join as joinPath } from "node:path";
import { execRuntimeChild } from "../runtimeChildRegistry.js";

/** 探测目录里登记过的本机 agent 名(含仅识别、未接线供给的) */
export type CliName =
  | "cursor-agent"
  | "codex"
  | "claude"
  | "grok"
  | "kimi"
  | "opencode"
  | "pi"
  | "gemini"
  | "aider"
  | "qwen"
  | "copilot"
  | "vibe";

/** 已接线的 ModelBinding provider 词表(与 contracts 对齐;inventory_only 不在此列) */
export type CliProvider =
  | "cursor_cli"
  | "codex_cli"
  | "claude_cli"
  | "grok_cli"
  | "gemini_cli"
  | "qwen_cli"
  | "copilot_cli";

/** logged_in / not_logged_in / not_found / unknown(可执行但登录态查不出,不伪造) */
export type CliAuthStatus = "logged_in" | "not_logged_in" | "not_found" | "unknown";

/**
 * 模型名的来源——决定 UI 怎么标注,也决定用户该多信它:
 *  listed     = CLI 自己列出的完整清单
 *  used       = 从该 CLI 本机会话记录里提取到的、你真用过的(用过必然可用)
 *  configured = 该 CLI 当前配置指定的模型
 *  alias      = 官方 --help 实证的别名
 * 禁止出现第五种"我觉得应该有"的来源。
 */
export type ModelSource = "listed" | "used" | "configured" | "alias";

export type CliAuthStrategy =
  | "cursor_status"
  | "codex_login"
  | "claude_auth"
  | "grok_models"
  | "gemini_oauth"
  | "qwen_settings"
  | "kimi_provider"
  | "opencode_auth"
  | "copilot_login"
  | "best_effort"
  | "none";

export type CliModelStrategy =
  | "cursor_list"
  | "claude_history"
  | "codex_history"
  | "grok_models"
  | "qwen_configured"
  | "opencode_models"
  | "none";

export interface CliCatalogEntry {
  name: CliName;
  /** PATH 上候选二进制,按优先级 */
  bins: readonly string[];
  label: string;
  /** 已接线供给后端;null = 仅识别 */
  provider: CliProvider | null;
  loginHint?: string;
  authStrategy: CliAuthStrategy;
  modelStrategy: CliModelStrategy;
  /**
   * 消歧指纹:--version 与 --help 合并文本须匹配,否则不算本 agent。
   * 短名(pi)尤其需要,避免撞上无关同名二进制。
   */
  versionSignature?: RegExp;
}

export interface CliModelOption {
  id: string;
  label?: string;
  source?: ModelSource;
  /** source=used 时的出现次数(排序用) */
  seen?: number;
}

export interface CliCapability {
  name: CliName;
  /** null = 仅识别,不可作为推理槽 CLI 供给 */
  provider: CliProvider | null;
  label: string;
  found: boolean;
  version?: string;
  path?: string;
  /** 可执行文件内容 SHA-256;只有绝对路径且内容可读时存在。 */
  binaryDigest?: string;
  auth: {
    status: CliAuthStatus;
    /** CLI 原样回显(截断);未登录时含官方提示 */
    detail?: string;
    /** 未就绪时的可粘贴修复行 */
    fixHint?: string;
  };
  /** 该 CLI 能否真枚举模型;false ⇒ models 为候选/空,须手填 */
  enumerable: boolean;
  models: CliModelOption[];
  /** 不可枚举或部分可用时的人话说明 */
  note?: string;
  /** 计费来源(探测采集;只有 subscription 才允许「订阅内零成本」文案) */
  billing?: { provenance: "subscription" | "external_api" | "unknown"; detail?: string };
}

/**
 * 本机 agent 探测目录。
 * wired 三家在前;用户点名的 grok/kimi/opencode/pi 紧随;其余主流收尾。
 * bins 含历史/别名(如 kimi-code),按序 which,先命中先用。
 */
export const CLI_CATALOG: readonly CliCatalogEntry[] = [
  {
    name: "cursor-agent",
    bins: ["cursor-agent"],
    label: "Cursor",
    provider: "cursor_cli",
    loginHint: "cursor-agent login",
    authStrategy: "cursor_status",
    modelStrategy: "cursor_list"
  },
  {
    name: "codex",
    bins: ["codex"],
    label: "Codex",
    provider: "codex_cli",
    loginHint: "codex login",
    authStrategy: "codex_login",
    modelStrategy: "codex_history"
  },
  {
    name: "claude",
    bins: ["claude"],
    label: "Claude",
    provider: "claude_cli",
    loginHint: "claude auth login",
    authStrategy: "claude_auth",
    modelStrategy: "claude_history"
  },
  {
    name: "grok",
    bins: ["grok"],
    label: "Grok",
    provider: "grok_cli",
    loginHint: "grok login",
    authStrategy: "grok_models",
    modelStrategy: "grok_models",
    // 本机实测:grok --version ⇒ "grok 1.0.3 (...)"
    versionSignature: /\bgrok\b/iu
  },
  {
    name: "kimi",
    bins: ["kimi", "kimi-code", "kimi-cli"],
    label: "Kimi",
    provider: null,
    loginHint: "kimi login",
    authStrategy: "kimi_provider",
    // 2026-08-13:仅 --plan/-y,无执行前零工具阻断,保持 inventory_only
    modelStrategy: "none",
    versionSignature: /\bkimi\b/iu
  },
  {
    name: "opencode",
    bins: ["opencode"],
    label: "OpenCode",
    provider: null,
    loginHint: "opencode auth login",
    authStrategy: "opencode_auth",
    // 2026-08-13:plan agent 仍 allow read 与 permission=*,保持 inventory_only
    modelStrategy: "opencode_models",
    versionSignature: /\bopencode\b/iu
  },
  {
    name: "pi",
    bins: ["pi"],
    label: "Pi",
    provider: null,
    loginHint: "pi login",
    authStrategy: "best_effort",
    // 短名易撞车:禁止只靠裸词 "pi"(会命中计算器/脚本);要 agent/harness/pi-mono/pi.dev 等信号
    modelStrategy: "none",
    versionSignature: /(?:pi-mono|pi\.dev|coding\s+agent|agent\s+harness|\bpi\b[^\n]{0,60}\bagent\b|\bagent\b[^\n]{0,60}\bpi\b)/iu
  },
  {
    name: "gemini",
    bins: ["gemini", "gemini-cli", "antigravity"],
    label: "Gemini",
    provider: "gemini_cli",
    loginHint: "在终端运行 gemini 完成 Google 登录(0.46 已无 gemini auth 子命令)",
    authStrategy: "gemini_oauth",
    modelStrategy: "none",
    versionSignature: /\b(?:gemini|antigravity)\b/iu
  },
  {
    name: "aider",
    bins: ["aider"],
    label: "Aider",
    provider: null,
    // aider 无统一登录子命令;装了就算 candidate,auth 标 unknown
    authStrategy: "none",
    modelStrategy: "none",
    versionSignature: /\baider\b/iu
  },
  {
    name: "qwen",
    bins: ["qwen", "qwen-code"],
    label: "Qwen",
    provider: "qwen_cli",
    loginHint: "配置 OpenAI 兼容端点或 OPENAI_API_KEY(0.18 已移除 qwen auth)",
    authStrategy: "qwen_settings",
    modelStrategy: "qwen_configured",
    versionSignature: /\bqwen\b/iu
  },
  {
    name: "copilot",
    bins: ["copilot"],
    label: "Copilot",
    provider: "copilot_cli",
    loginHint: "copilot login",
    authStrategy: "copilot_login",
    modelStrategy: "none",
    versionSignature: /\bcopilot\b/iu
  },
  {
    name: "vibe",
    bins: ["vibe"],
    label: "Vibe",
    provider: null,
    loginHint: "vibe login",
    authStrategy: "best_effort",
    modelStrategy: "none",
    versionSignature: /\bvibe\b/iu
  }
] as const;

export const PROBE_CLI_NAMES: CliName[] = CLI_CATALOG.map((e) => e.name);
/** 已接线、可进推理槽选择的 CLI */
export const WIRED_CLI_NAMES: CliName[] = CLI_CATALOG.filter((e) => e.provider !== null).map((e) => e.name);

export function catalogEntry(name: CliName): CliCatalogEntry {
  const hit = CLI_CATALOG.find((e) => e.name === name);
  if (!hit) throw new Error(`unknown CLI catalog name: ${name}`);
  return hit;
}

export function isCliName(value: string): value is CliName {
  return CLI_CATALOG.some((e) => e.name === value);
}

/** @deprecated 用 catalogEntry(name).provider;保留兼容旧 import */
export const CLI_PROVIDER: Partial<Record<CliName, CliProvider>> = Object.fromEntries(
  CLI_CATALOG.filter((e) => e.provider).map((e) => [e.name, e.provider])
) as Partial<Record<CliName, CliProvider>>;

export const CLI_LOGIN_HINT: Partial<Record<CliName, string>> = Object.fromEntries(
  CLI_CATALOG.filter((e) => e.loginHint).map((e) => [e.name, e.loginHint])
) as Partial<Record<CliName, string>>;

/**
 * claude --help 实证的模型别名(2026-08-10 本机 2.1.153):
 * "Provide an alias for the latest model (e.g. 'sonnet' or 'opus') or a model's full name"。
 * 只收录 help 里真实出现的两个;其余请手填全名——不臆造清单。
 */
export const CLAUDE_ALIAS_CANDIDATES: CliModelOption[] = [
  { id: "sonnet", label: "最新 Sonnet", source: "alias" },
  { id: "opus", label: "最新 Opus", source: "alias" }
];

const INVENTORY_ONLY_NOTE =
  "已识别本机 CLI,但尚未接入为推理槽供给后端;当前不能选进模型配置。已接线供给:cursor/codex/claude/grok/gemini/qwen/copilot。";

/** 单家探测全程硬超时(含 which/auth/models);超时如实降级,禁止假装成功。 */
export const PROBE_CLI_BUDGET_MS = 3500;
/** 轻量重探单家预算:只绕缓存再探,不做模型真实调用。 */
export const REPROBE_CLI_BUDGET_MS = 8000;
/** 画像整体上限 = 单家上限 + 缓冲;多家必须并行,不得串行叠加。 */
export const PROBE_ALL_BUFFER_MS = 500;
export const PROBE_CACHE_TTL_MS = 10 * 60 * 1000;
export const PROBE_TIMEOUT_NOTE = "探测超时(>3.5s),点『测一下』可确认";

interface ProbeCacheRecord {
  name: CliName;
  binaryPath?: string;
  mtimeMs?: number;
  capability: CliCapability;
  expiresAt: number;
}

/** 进程内探测缓存:键等价 (cli name + binaryPath + binary mtime),不落盘。 */
const probeCache = new Map<CliName, ProbeCacheRecord>();

export function clearProbeCliCapabilityCache(): void {
  probeCache.clear();
}

/** confirm 成功后主动刷新该家缓存(只改内存,不启子进程)。 */
export function rememberProbedCliCapability(capability: CliCapability): void {
  const prev = probeCache.get(capability.name);
  probeCache.set(capability.name, {
    name: capability.name,
    ...(capability.path ? { binaryPath: capability.path } : {}),
    ...(prev?.mtimeMs !== undefined ? { mtimeMs: prev.mtimeMs } : {}),
    capability,
    expiresAt: Date.now() + PROBE_CACHE_TTL_MS
  });
}

function isProbeTimeoutError(err: unknown): boolean {
  if (err && typeof err === "object" && (err as { timedOut?: boolean }).timedOut) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /timed out/iu.test(msg);
}

function timeoutError(budgetMs: number): Error & { timedOut: true } {
  return Object.assign(new Error(`Command timed out after ${budgetMs}ms`), { timedOut: true as const });
}

function combineSignals(...signals: Array<AbortSignal | undefined>): AbortSignal | undefined {
  const live = signals.filter((s): s is AbortSignal => s !== undefined);
  if (live.length === 0) return undefined;
  if (live.length === 1) return live[0];
  return AbortSignal.any(live);
}

function appendTimeoutNote(note: string | undefined): string {
  return note ? `${PROBE_TIMEOUT_NOTE} ${note}` : PROBE_TIMEOUT_NOTE;
}

// ---------- 已知模型发现(codex/claude 无列模型接口时的真实数据源) ----------
//
// 只碰模型名,不读会话内容:逐文件只取头部若干字节 + 正则抓 "model":"..."。
// 不 JSON.parse(头部必然截断在半行),不递归全盘扫(首启要快)。

/** 显式排除的伪模型值(claude 会写 <synthetic> 这类占位) */
const MODEL_NAME_REJECT = /^<|>$|^unknown$|^null$/iu;

function plausibleModelName(s: string): boolean {
  if (s.length < 2 || s.length > 80) return false;
  if (MODEL_NAME_REJECT.test(s)) return false;
  return /^[A-Za-z0-9][A-Za-z0-9._\-/:]*$/u.test(s);
}

/** 读文件头部若干字节(会话记录的 model 字段都在开头的 meta / 前几条消息里) */
async function readHead(path: string, bytes: number): Promise<string> {
  const fh = await openFile(path, "r");
  try {
    const buf = Buffer.alloc(bytes);
    const { bytesRead } = await fh.read(buf, 0, bytes, 0);
    return buf.subarray(0, bytesRead).toString("utf8");
  } finally {
    await fh.close();
  }
}

/** 目录下按 mtime 取最近 N 个 .jsonl(不递归到无关深度就返回) */
async function recentJsonl(dir: string, limit: number): Promise<string[]> {
  const out: Array<{ path: string; mtime: number }> = [];
  const walk = async (d: string, depth: number): Promise<void> => {
    if (depth > 5 || out.length > 4000) return;
    let entries: Dirent[];
    try {
      entries = await readDirectory(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = joinPath(d, e.name);
      if (e.isDirectory()) {
        await walk(full, depth + 1);
      } else if (e.isFile() && e.name.endsWith(".jsonl")) {
        try {
          const st = await statFile(full);
          out.push({ path: full, mtime: st.mtimeMs });
        } catch {
          // 读不到就跳过
        }
      }
    }
  };
  await walk(dir, 0);
  out.sort((a, b) => b.mtime - a.mtime);
  return out.slice(0, limit).map((x) => x.path);
}

export interface DiscoverDeps {
  /** 注入用:返回该目录下最近的 jsonl 路径 */
  listFiles?: (dir: string, limit: number) => Promise<string[]>;
  /** 注入用:读文件头 */
  readHead?: (path: string, bytes: number) => Promise<string>;
  homeDir?: string;
  maxFiles?: number;
  headBytes?: number;
}

/** 从会话记录里统计用过的模型名(降序) */
export async function discoverUsedModels(
  sessionDir: string,
  deps: DiscoverDeps = {}
): Promise<Array<{ id: string; seen: number }>> {
  const list = deps.listFiles ?? recentJsonl;
  const head = deps.readHead ?? readHead;
  const maxFiles = deps.maxFiles ?? 60;
  const headBytes = deps.headBytes ?? 64 * 1024;
  const counter = new Map<string, number>();
  let files: string[] = [];
  try {
    files = await list(sessionDir, maxFiles);
  } catch {
    return [];
  }
  // 并行读头:串行扫 60 个文件会把首启拖慢一大截,而这些都是独立的小额读
  const texts = await Promise.all(files.map((f) => head(f, headBytes).catch(() => "")));
  for (const text of texts) {
    for (const m of text.matchAll(/"model(?:_slug)?"\s*:\s*"([^"]{1,80})"/gu)) {
      const id = m[1] as string;
      if (!plausibleModelName(id)) continue;
      counter.set(id, (counter.get(id) ?? 0) + 1);
    }
  }
  return [...counter.entries()]
    .map(([id, seen]) => ({ id, seen }))
    .sort((a, b) => b.seen - a.seen);
}

/** codex:config.toml 的当前 model + [tui.model_availability_nux] 里它见过的 */
export function parseCodexConfigModels(toml: string): {
  configured?: string;
  seen: string[];
} {
  const out: { configured?: string; seen: string[] } = { seen: [] };
  // 顶层 model = "..."(跳过 model_reasoning_effort / model_provider 等)
  const cfg = /^\s*model\s*=\s*"([^"]+)"/mu.exec(toml);
  if (cfg && plausibleModelName(cfg[1] as string)) out.configured = cfg[1] as string;
  // [tui.model_availability_nux] 段内的键即它认得的模型
  const sec = /\[tui\.model_availability_nux\]([\s\S]*?)(?=\n\[|$)/u.exec(toml);
  if (sec) {
    for (const m of (sec[1] as string).matchAll(/^\s*"?([A-Za-z0-9][A-Za-z0-9._\-/:]*)"?\s*=/gmu)) {
      const id = m[1] as string;
      if (plausibleModelName(id)) out.seen.push(id);
    }
  }
  return out;
}

/** 合并多来源候选:先 used(按次数) → configured → alias;同名保留最强来源 */
export function mergeModelOptions(groups: CliModelOption[][]): CliModelOption[] {
  const rank: Record<ModelSource, number> = { listed: 0, used: 1, configured: 2, alias: 3 };
  const best = new Map<string, CliModelOption>();
  for (const g of groups) {
    for (const opt of g) {
      const prev = best.get(opt.id);
      if (!prev) {
        best.set(opt.id, opt);
        continue;
      }
      const a = rank[prev.source ?? "alias"];
      const b = rank[opt.source ?? "alias"];
      if (b < a) {
        const seen = opt.seen ?? prev.seen;
        best.set(opt.id, seen === undefined ? opt : { ...opt, seen });
      }
    }
  }
  return [...best.values()].sort((x, y) => {
    const rx = rank[x.source ?? "alias"];
    const ry = rank[y.source ?? "alias"];
    if (rx !== ry) return rx - ry;
    return (y.seen ?? 0) - (x.seen ?? 0);
  });
}

export type ExecFn = (
  file: string,
  args: string[],
  timeoutMs: number,
  signal?: AbortSignal
) => Promise<{ stdout: string; stderr: string }>;

const defaultExec: ExecFn = async (file, args, timeoutMs, signal) => {
  const r = await execRuntimeChild(file, args, {
    timeout: timeoutMs,
    maxBuffer: 512 * 1024,
    ...(signal ? { signal } : {})
  });
  return { stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
};

/**
 * 解析 cursor-agent 模型列表。
 * 实测形态:标题行 "Available models" + 空行 + 若干 "<id> - <显示名>"。
 * 只认含 " - " 的行;id 不允许空白(防把说明文字当模型)。
 */
export function parseCursorModels(stdout: string): CliModelOption[] {
  const out: CliModelOption[] = [];
  const seen = new Set<string>();
  for (const raw of stdout.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const sep = line.indexOf(" - ");
    if (sep <= 0) continue;
    const id = line.slice(0, sep).trim();
    const label = line.slice(sep + 3).trim();
    // id 必须是单 token(模型名无空格);过滤 "Available models" 之类
    if (!id || /\s/u.test(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(label ? { id, label, source: "listed" } : { id, source: "listed" });
  }
  return out;
}

/**
 * 解析 `grok models` 输出(2026-08-12 本机实测):
 *   You are logged in with grok.com.
 *   Default model: grok-4.5
 *   Available models:
 *     * grok-4.5 (default)
 */
export function parseGrokModels(stdout: string): {
  models: CliModelOption[];
  authHint: CliAuthStatus | null;
  defaultModel?: string;
} {
  const authFromText = classifyAuthOutput(stdout);
  const authHint = authFromText === "unknown" ? null : authFromText;
  const def = /^\s*Default model:\s*([A-Za-z0-9][A-Za-z0-9._\-/:]*)/mu.exec(stdout);
  const defaultModel = def && plausibleModelName(def[1] as string) ? (def[1] as string) : undefined;
  const models: CliModelOption[] = [];
  const seen = new Set<string>();
  for (const raw of stdout.split("\n")) {
    const m = /^\s*\*\s*([A-Za-z0-9][A-Za-z0-9._\-/:]*)(?:\s+\(([^)]*)\))?/u.exec(raw);
    if (!m) continue;
    const id = m[1] as string;
    if (!plausibleModelName(id) || seen.has(id)) continue;
    seen.add(id);
    const tag = (m[2] ?? "").trim();
    const label = tag ? tag : defaultModel === id ? "default" : undefined;
    models.push(label ? { id, label, source: "listed" } : { id, source: "listed" });
  }
  if (models.length === 0 && defaultModel) {
    models.push({ id: defaultModel, label: "default", source: "listed" });
  }
  return { models, authHint, ...(defaultModel ? { defaultModel } : {}) };
}

/** 登录态输出 → 分类。措辞因家而异,只认明确信号,含糊一律 unknown(不伪造 logged_in) */
export function classifyAuthOutput(text: string): CliAuthStatus {
  const t = text.toLowerCase();
  // claude auth status 回的是 JSON:{"loggedIn":true,"authMethod":"claude.ai",...}
  // (2026-08-10 实测;纯文本匹配 "logged in" 认不出驼峰键,会误判 unknown)
  const jsonFlag = /"loggedin"\s*:\s*(true|false)/u.exec(t);
  if (jsonFlag) return jsonFlag[1] === "true" ? "logged_in" : "not_logged_in";
  if (
    /not logged in|no.*credential|please (run )?login|sign in to|unauthenticated|not authenticated|login required|0 credentials|no providers configured/u.test(
      t
    )
  ) {
    return "not_logged_in";
  }
  // grok models: "You are logged in with grok.com."
  // kimi provider list: "source=oauth" / "type=kimi"
  if (
    /you are logged in|logged in|authenticated as|signed in|logged-in|account:|source=oauth|type=kimi/u.test(
      t
    )
  ) {
    return "logged_in";
  }
  return "unknown";
}

export function inferCostProvenance(
  name: CliName,
  auth: CliAuthStatus,
  evidence: { selectedType?: string; authText?: string }
): { provenance: "subscription" | "external_api" | "unknown"; detail?: string } {
  if (name === "gemini") {
    if (evidence.selectedType === "oauth-personal" || auth === "logged_in") {
      return { provenance: "subscription", detail: "gemini oauth-personal" };
    }
    if (evidence.selectedType === "gemini-api-key" || evidence.selectedType === "api-key") {
      return { provenance: "external_api", detail: "gemini api key" };
    }
    return { provenance: "unknown" };
  }
  if (name === "qwen") {
    if (evidence.selectedType === "openai" || evidence.selectedType === "anthropic") {
      return { provenance: "external_api", detail: `qwen auth-type=${evidence.selectedType}` };
    }
    if (evidence.selectedType === "qwen-oauth") {
      return { provenance: "subscription", detail: "qwen-oauth" };
    }
    return { provenance: "unknown" };
  }
  if (name === "copilot") {
    return auth === "logged_in"
      ? { provenance: "subscription", detail: "github copilot" }
      : { provenance: "unknown" };
  }
  if (name === "kimi") {
    const text = evidence.authText ?? "";
    if (/source=oauth/u.test(text)) return { provenance: "subscription", detail: "kimi oauth" };
    if (/source=inline/u.test(text)) return { provenance: "external_api", detail: "kimi inline provider" };
    return { provenance: "unknown" };
  }
  if (name === "opencode") {
    const text = evidence.authText ?? "";
    if (/0 credentials/u.test(text)) return { provenance: "unknown" };
    if (/credentials/u.test(text)) return { provenance: "external_api", detail: "opencode provider credentials" };
    return { provenance: "unknown" };
  }
  if (auth === "logged_in") return { provenance: "subscription" };
  return { provenance: "unknown" };
}

function readJsonObject(path: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function probeGeminiOAuth(home: string): { status: CliAuthStatus; selectedType?: string; detail?: string } {
  const settings = readJsonObject(joinPath(home, ".gemini", "settings.json"));
  const security = settings && typeof settings["security"] === "object" && settings["security"] !== null
    ? (settings["security"] as Record<string, unknown>)
    : undefined;
  const auth = security && typeof security["auth"] === "object" && security["auth"] !== null
    ? (security["auth"] as Record<string, unknown>)
    : undefined;
  const selectedType = typeof auth?.["selectedType"] === "string" ? auth["selectedType"] : undefined;
  const hasOauth = existsSync(joinPath(home, ".gemini", "oauth_creds.json"));
  if (hasOauth && (selectedType === "oauth-personal" || selectedType === undefined)) {
    return { status: "logged_in", ...(selectedType ? { selectedType, detail: selectedType } : { detail: "oauth_creds present" }) };
  }
  if (selectedType === "gemini-api-key" || selectedType === "api-key") {
    return { status: "logged_in", selectedType, detail: selectedType };
  }
  if (!hasOauth && !selectedType) return { status: "not_logged_in", detail: "no gemini oauth" };
  return { status: "unknown", ...(selectedType ? { selectedType, detail: selectedType } : {}) };
}

function probeQwenSettings(home: string): { status: CliAuthStatus; selectedType?: string; model?: string; detail?: string } {
  const settings = readJsonObject(joinPath(home, ".qwen", "settings.json"));
  if (!settings) return { status: "not_logged_in", detail: "no qwen settings" };
  const security = settings["security"] && typeof settings["security"] === "object"
    ? (settings["security"] as Record<string, unknown>)
    : undefined;
  const auth = security && typeof security["auth"] === "object" && security["auth"] !== null
    ? (security["auth"] as Record<string, unknown>)
    : undefined;
  const selectedType = typeof auth?.["selectedType"] === "string" ? auth["selectedType"] : undefined;
  const modelObj = settings["model"] && typeof settings["model"] === "object"
    ? (settings["model"] as Record<string, unknown>)
    : undefined;
  const model = typeof modelObj?.["name"] === "string" ? modelObj["name"] : undefined;
  const env = settings["env"] && typeof settings["env"] === "object" ? (settings["env"] as Record<string, unknown>) : undefined;
  const hasEnvKey = Boolean(env && Object.keys(env).some((k) => /API_KEY|TOKEN/u.test(k)));
  if (selectedType === "openai" || selectedType === "anthropic" || selectedType === "qwen-oauth") {
    return {
      status: hasEnvKey || selectedType === "qwen-oauth" ? "logged_in" : "unknown",
      selectedType,
      ...(model ? { model } : {}),
      detail: selectedType
    };
  }
  if (hasEnvKey) return { status: "logged_in", ...(model ? { model } : {}), detail: "env api key" };
  return { status: "not_logged_in", ...(selectedType ? { selectedType } : {}), ...(model ? { model } : {}) };
}

export function parseOpencodeModels(stdout: string): CliModelOption[] {
  const out: CliModelOption[] = [];
  const seen = new Set<string>();
  for (const raw of stdout.split("\n")) {
    const id = raw.trim();
    if (!id || id.includes(" ") || !plausibleModelName(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, source: "listed" });
  }
  return out;
}

function authArgsForStrategy(strategy: CliAuthStrategy): string[][] {
  if (strategy === "cursor_status") return [["status"]];
  if (strategy === "codex_login") return [["login", "status"]];
  if (strategy === "claude_auth") return [["auth", "status"]];
  if (strategy === "grok_models") return [["models"]];
  if (strategy === "kimi_provider") return [["provider", "list"]];
  if (strategy === "opencode_auth") return [["auth", "list"]];
  if (strategy === "copilot_login") return [["login", "--help"]];
  if (strategy === "best_effort") {
    // 各家子命令不齐:按常见面依次试,明确信号才定性,子命令不存在继续下一条
    return [
      ["auth", "status"],
      ["auth", "list"],
      ["login", "status"],
      ["status"],
      ["whoami"],
      ["models"],
      ["model", "list"],
      ["--list-models"]
    ];
  }
  return [];
}

async function probeAuth(
  strategy: CliAuthStrategy,
  path: string,
  exec: ExecFn,
  timeoutMs: number
): Promise<{ status: CliAuthStatus; detail?: string; raw?: string; timedOut?: boolean }> {
  if (strategy === "none") return { status: "unknown" };
  const attempts = authArgsForStrategy(strategy);
  let lastText = "";
  let lastStatus: CliAuthStatus = "unknown";
  for (const args of attempts) {
    try {
      const r = await exec(path, args, timeoutMs);
      const text = `${r.stdout}${r.stderr}`.trim();
      lastText = text;
      const status = classifyAuthOutput(text);
      lastStatus = status;
      if (status !== "unknown") {
        return { status, ...(text ? { detail: text.slice(0, 200), raw: text } : { raw: text }) };
      }
      // best_effort 继续试下一条;固定策略的 unknown 也返回(不伪造)
      if (strategy !== "best_effort") {
        return { status, ...(text ? { detail: text.slice(0, 200), raw: text } : {}) };
      }
    } catch (err) {
      if (isProbeTimeoutError(err)) {
        // 超时 ≠ 未登录:已确定的结论保留,未完成的部分标 unknown
        return {
          status: lastStatus,
          timedOut: true,
          ...(lastText ? { detail: lastText.slice(0, 200), raw: lastText } : {})
        };
      }
      // 非零退出码常见于"未登录";但也可能是子命令不存在——按输出判,判不出标 unknown
      const e = err as { stdout?: string; stderr?: string; message?: string };
      const text = `${e.stdout ?? ""}${e.stderr ?? ""}${e.message ?? ""}`.trim();
      lastText = text || lastText;
      const status = classifyAuthOutput(text);
      if (status === "logged_in") {
        // 抛错却含 logged_in 字样,不可信 → unknown
        lastStatus = "unknown";
        continue;
      }
      if (status === "not_logged_in") {
        return {
          status: "not_logged_in",
          ...(text ? { detail: text.slice(0, 200), raw: text } : {})
        };
      }
      // 固定策略历史语义:退出非零且无明确信号 ⇒ 按未登录处理(不伪造 logged_in)
      // best_effort 则继续试下一条子命令,避免把"子命令不存在"当未登录
      lastStatus = strategy === "best_effort" ? "unknown" : "not_logged_in";
      if (strategy !== "best_effort") {
        return {
          status: "not_logged_in",
          ...(text ? { detail: text.slice(0, 200), raw: text } : {})
        };
      }
    }
  }
  return {
    status: lastStatus,
    ...(lastText ? { detail: lastText.slice(0, 200), raw: lastText } : {})
  };
}

async function listCursorModels(
  path: string,
  exec: ExecFn,
  timeoutMs: number
): Promise<{ models: CliModelOption[]; note?: string; timedOut?: boolean }> {
  try {
    const r = await exec(path, ["--list-models"], timeoutMs);
    const models = parseCursorModels(r.stdout);
    if (models.length > 0) return { models };
    return { models: [], note: "cursor-agent 返回了模型列表但没解析出条目,可手填模型名" };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const models = parseCursorModels(`${e.stdout ?? ""}\n${e.stderr ?? ""}`);
    if (isProbeTimeoutError(err)) {
      return models.length > 0 ? { models, timedOut: true } : { models, timedOut: true, note: "列模型超时" };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { models, note: `列模型失败(${msg.slice(0, 120)});可手填模型名` };
  }
}

async function listGrokModels(
  path: string,
  exec: ExecFn,
  timeoutMs: number
): Promise<{ models: CliModelOption[]; authHint: CliAuthStatus | null; note?: string; raw?: string; timedOut?: boolean }> {
  try {
    const r = await exec(path, ["models"], timeoutMs);
    const text = `${r.stdout}${r.stderr}`.trim();
    const parsed = parseGrokModels(text);
    if (parsed.models.length > 0) {
      return { models: parsed.models, authHint: parsed.authHint, raw: text };
    }
    return {
      models: [],
      authHint: parsed.authHint,
      note: "grok models 返回了输出但没解析出条目,可手填模型名",
      raw: text
    };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const text = `${e.stdout ?? ""}${e.stderr ?? ""}${e.message ?? ""}`.trim();
    const parsed = text ? parseGrokModels(text) : { models: [] as CliModelOption[], authHint: null };
    if (isProbeTimeoutError(err)) {
      return {
        models: parsed.models,
        authHint: parsed.authHint,
        timedOut: true,
        ...(parsed.models.length === 0 ? { note: "列模型超时" } : {}),
        ...(text ? { raw: text } : {})
      };
    }
    if (parsed.models.length > 0) {
      return { models: parsed.models, authHint: parsed.authHint, raw: text };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return {
      models: [],
      authHint: parsed.authHint ?? classifyAuthOutput(text),
      note: `列模型失败(${msg.slice(0, 120)});可手填模型名`,
      ...(text ? { raw: text } : {})
    };
  }
}

export interface ProbeCliCapabilityDeps {
  exec?: ExecFn;
  signal?: AbortSignal;
  /** which 查路径;测试可注入。多 bin 时会按目录顺序依次调用。 */
  whichFn?: (bin: string) => Promise<{ path?: string; version?: string }>;
  authTimeoutMs?: number;
  listTimeoutMs?: number;
  /** 单家探测硬超时;默认 PROBE_CLI_BUDGET_MS(3500)。 */
  probeTimeoutMs?: number;
  /** 跳过读/写进程内缓存(confirm 刷新走这条)。 */
  bypassCache?: boolean;
  /** 测试注入:读二进制 mtime。 */
  statFn?: (path: string) => Promise<{ mtimeMs: number } | undefined>;
  /** 测试注入:当前时间。 */
  now?: () => number;
  /** 已知模型发现的注入点(测试用;不注入则读真实 HOME) */
  discover?: DiscoverDeps;
  /** 可执行文件 digest 注入点;返回 undefined 即不可登记。 */
  digestFn?: (path: string) => Promise<string | undefined>;
}

async function digestBinary(path: string): Promise<string | undefined> {
  if (!isAbsolute(path)) return undefined;
  try {
    return createHash("sha256").update(await readFile(path)).digest("hex");
  } catch {
    return undefined;
  }
}

async function defaultWhich(
  bin: string,
  exec: ExecFn
): Promise<{ path?: string; version?: string }> {
  try {
    const w = await exec("which", [bin], 3000);
    const path = w.stdout.trim().split("\n")[0]?.trim();
    if (!path) return {};
    try {
      const v = await exec(path, ["--version"], 3000);
      const version = `${v.stdout || v.stderr}`.trim().split("\n")[0]?.slice(0, 120);
      return version ? { path, version } : { path };
    } catch {
      return { path };
    }
  } catch {
    return {};
  }
}

async function collectIdentityText(path: string, exec: ExecFn): Promise<string> {
  const chunks = await Promise.all(
    ([["--version"], ["--help"], ["-h"]] as const).map(async (args) => {
      try {
        const r = await exec(path, [...args], 3000);
        return `${r.stdout}\n${r.stderr}`;
      } catch (err) {
        const e = err as { stdout?: string; stderr?: string; message?: string };
        return `${e.stdout ?? ""}\n${e.stderr ?? ""}\n${e.message ?? ""}`;
      }
    })
  );
  return chunks.join("\n");
}

async function resolveBinary(
  entry: CliCatalogEntry,
  exec: ExecFn,
  whichFn?: ProbeCliCapabilityDeps["whichFn"]
): Promise<{ path?: string; version?: string }> {
  for (const bin of entry.bins) {
    const found = whichFn ? await whichFn(bin) : await defaultWhich(bin, exec);
    if (!found.path) continue;
    if (entry.versionSignature) {
      // --version 已命中指纹就不再跑 --help/-h,省掉慢 CLI 的身份采集
      if (entry.versionSignature.test(found.version ?? "")) return found;
      const identity = `${found.version ?? ""}\n${await collectIdentityText(found.path, exec)}`;
      if (!entry.versionSignature.test(identity)) continue;
    }
    return found;
  }
  return {};
}

function notFoundCapability(entry: CliCatalogEntry): CliCapability {
  const wired = entry.provider !== null;
  return {
    name: entry.name,
    provider: entry.provider,
    label: entry.label,
    found: false,
    auth: {
      status: "not_found",
      fixHint: wired
        ? `未找到 ${entry.bins[0]};安装后重试,或这个槽位改走 API 直连`
        : `未找到 ${entry.bins.join("/")};安装后会显示在资源画像里(当前尚未接入供给后端)`
    },
    enumerable: entry.modelStrategy === "cursor_list" || entry.modelStrategy === "grok_models",
    models: [],
    note: wired ? `本机没有 ${entry.name}` : `本机没有 ${entry.name}(${INVENTORY_ONLY_NOTE})`
  };
}

async function readBinaryMtime(
  path: string,
  statFn?: ProbeCliCapabilityDeps["statFn"]
): Promise<number | undefined> {
  try {
    const st = statFn ? await statFn(path) : await statFile(path);
    return st?.mtimeMs;
  } catch {
    return undefined;
  }
}

async function lookupCachedCapability(
  name: CliName,
  deps: ProbeCliCapabilityDeps
): Promise<CliCapability | undefined> {
  if (deps.bypassCache) return undefined;
  const rec = probeCache.get(name);
  const now = deps.now?.() ?? Date.now();
  if (!rec || rec.expiresAt <= now) return undefined;
  if (!rec.binaryPath) return rec.capability;
  if (rec.mtimeMs === undefined) return rec.capability;
  const mtime = await readBinaryMtime(rec.binaryPath, deps.statFn);
  return mtime === rec.mtimeMs ? rec.capability : undefined;
}

async function storeCachedCapability(
  name: CliName,
  capability: CliCapability,
  deps: ProbeCliCapabilityDeps
): Promise<void> {
  if (deps.bypassCache) return;
  const mtimeMs = capability.path ? await readBinaryMtime(capability.path, deps.statFn) : undefined;
  probeCache.set(name, {
    name,
    ...(capability.path ? { binaryPath: capability.path } : {}),
    ...(mtimeMs !== undefined ? { mtimeMs } : {}),
    capability,
    expiresAt: (deps.now?.() ?? Date.now()) + PROBE_CACHE_TTL_MS
  });
}

function assembleCapability(input: {
  entry: CliCatalogEntry;
  found: { path?: string; version?: string };
  binaryDigest?: string;
  authStatus: CliAuthStatus;
  authDetail?: string;
  models: CliModelOption[];
  enumerable: boolean;
  note?: string;
  selectedType?: string;
  timedOut: boolean;
}): CliCapability {
  const { entry } = input;
  let note = input.note;
  if (entry.provider === null) {
    note = note ? `${note} ${INVENTORY_ONLY_NOTE}` : INVENTORY_ONLY_NOTE;
  }
  if (input.timedOut) note = appendTimeoutNote(note);
  const billing = inferCostProvenance(entry.name, input.authStatus, {
    ...(input.selectedType ? { selectedType: input.selectedType } : {}),
    ...(input.authDetail ? { authText: input.authDetail } : {})
  });
  return {
    name: entry.name,
    provider: entry.provider,
    label: entry.label,
    found: Boolean(input.found.path),
    ...(input.found.version ? { version: input.found.version } : {}),
    ...(input.found.path ? { path: input.found.path } : {}),
    ...(input.binaryDigest ? { binaryDigest: input.binaryDigest } : {}),
    auth: {
      status: input.authStatus,
      ...(input.authDetail ? { detail: input.authDetail } : {}),
      ...(input.authStatus === "not_logged_in" && entry.loginHint
        ? { fixHint: entry.loginHint }
        : input.authStatus === "unknown" && entry.loginHint
          ? { fixHint: `${entry.loginHint} 或点「测一下」用受控一发确认` }
          : {})
    },
    enumerable: input.timedOut && input.enumerable ? false : input.enumerable,
    models: input.models,
    ...(note ? { note } : {}),
    billing
  };
}

async function probeCliCapabilityFresh(
  name: CliName,
  deps: ProbeCliCapabilityDeps
): Promise<CliCapability> {
  const entry = catalogEntry(name);
  const budgetMs = deps.probeTimeoutMs ?? PROBE_CLI_BUDGET_MS;
  const startedAt = deps.now?.() ?? Date.now();
  const deadline = startedAt + budgetMs;
  const budgetAbort = new AbortController();
  const signal = combineSignals(deps.signal, budgetAbort.signal);
  const budgetTimer = setTimeout(() => budgetAbort.abort(), budgetMs);
  budgetTimer.unref();

  const remaining = (): number => Math.max(0, deadline - (deps.now?.() ?? Date.now()));
  const isTimedOut = (): boolean => budgetAbort.signal.aborted || remaining() <= 0 || Boolean(deps.signal?.aborted);

  const userExec: ExecFn =
    deps.exec ?? ((file, args, timeoutMs, sig) => defaultExec(file, args, timeoutMs, combineSignals(signal, sig)));

  const exec: ExecFn = async (file, args, timeoutMs, sig) => {
    if (isTimedOut()) throw timeoutError(budgetMs);
    const cap = Math.max(1, Math.min(timeoutMs, remaining()));
    const combined = combineSignals(signal, sig);
    const work = userExec(file, args, cap, combined);
    let timer: NodeJS.Timeout | undefined;
    const raced = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(timeoutError(budgetMs)), cap);
      timer.unref();
    });
    try {
      return await Promise.race([work, raced]);
    } catch (err) {
      if (isProbeTimeoutError(err)) void work.catch(() => undefined);
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  try {
  const authTimeout = Math.min(deps.authTimeoutMs ?? budgetMs, Math.max(1, remaining()));
  const listTimeout = Math.min(deps.listTimeoutMs ?? budgetMs, Math.max(1, remaining()));

  const found = await resolveBinary(entry, exec, deps.whichFn);
  if (!found.path) {
    if (isTimedOut()) {
      return assembleCapability({
        entry,
        found: {},
        authStatus: "unknown",
        models: [],
        enumerable: false,
        timedOut: true
      });
    }
    return notFoundCapability(entry);
  }

  // cursor: status 与 --list-models 并行;未登录丢弃列表(2026-08-10 实测省 ~1.5s)
  const cursorListPromise =
    entry.modelStrategy === "cursor_list" ? listCursorModels(found.path, exec, listTimeout) : null;
  // grok: models 子命令同时承载登录态与列表,只跑一次
  const grokListPromise =
    entry.modelStrategy === "grok_models" ? listGrokModels(found.path, exec, listTimeout) : null;

  const home = deps.discover?.homeDir ?? homedir();
  let selectedType: string | undefined;
  let configuredModel: string | undefined;
  const auth =
    entry.authStrategy === "grok_models"
      ? { status: "unknown" as CliAuthStatus }
      : entry.authStrategy === "gemini_oauth"
        ? probeGeminiOAuth(home)
        : entry.authStrategy === "qwen_settings"
          ? probeQwenSettings(home)
          : entry.authStrategy === "copilot_login"
            ? process.env["COPILOT_GITHUB_TOKEN"] || process.env["GH_TOKEN"] || process.env["GITHUB_TOKEN"]
              ? { status: "logged_in" as CliAuthStatus, detail: "env token" }
              : { status: "unknown" as CliAuthStatus, detail: "keychain 登录态需「测一下」确认" }
            : await probeAuth(entry.authStrategy, found.path, exec, authTimeout);

  let timedOut = isTimedOut() || Boolean("timedOut" in auth && auth.timedOut);
  const binaryDigest = timedOut ? undefined : await (deps.digestFn ?? digestBinary)(found.path);
  let authStatus = auth.status;
  let authDetail = "detail" in auth ? auth.detail : undefined;
  if ("selectedType" in auth && typeof auth.selectedType === "string") selectedType = auth.selectedType;
  if ("model" in auth && typeof auth.model === "string") configuredModel = auth.model;
  let models: CliModelOption[] = [];
  let enumerable = false;
  let note: string | undefined;

  if (entry.modelStrategy === "cursor_list") {
    enumerable = true;
    if (authStatus === "not_logged_in") {
      models = [];
      note = "登录后才能列出可用模型";
    } else {
      const listed = await (cursorListPromise ?? listCursorModels(found.path, exec, listTimeout));
      models = listed.models;
      if (listed.timedOut) {
        timedOut = true;
        enumerable = false;
      }
      if (listed.note) note = listed.note;
    }
  } else if (entry.modelStrategy === "grok_models") {
    enumerable = true;
    const listed = await (grokListPromise ?? listGrokModels(found.path, exec, listTimeout));
    if (listed.timedOut) timedOut = true;
    if (listed.authHint) authStatus = listed.authHint;
    if (listed.raw) authDetail = listed.raw.slice(0, 200);
    if (authStatus === "not_logged_in") {
      models = [];
      note = "登录后才能列出可用模型";
    } else {
      models = listed.models;
      if (listed.timedOut) enumerable = false;
      if (listed.note) note = listed.note;
    }
  } else if (entry.modelStrategy === "claude_history") {
    const home = deps.discover?.homeDir ?? homedir();
    const used = await discoverUsedModels(joinPath(home, ".claude", "projects"), deps.discover ?? {});
    models = mergeModelOptions([
      used.map((u) => ({ id: u.id, source: "used" as const, seen: u.seen })),
      CLAUDE_ALIAS_CANDIDATES
    ]);
    note =
      used.length > 0
        ? `claude 没有列出全部模型的接口。下面是从本机记录里找到的:你用过的 ${used.length} 个,加上官方别名——不是全集,别的模型直接填就行。`
        : "claude 没有列模型接口;下面两个是官方 --help 实证的别名,也可手填完整模型名";
  } else if (entry.modelStrategy === "codex_history") {
    const home = deps.discover?.homeDir ?? homedir();
    const codexUsed = await discoverUsedModels(joinPath(home, ".codex", "sessions"), deps.discover ?? {});
    let codexCfg: { configured?: string; seen: string[] } = { seen: [] };
    try {
      const readCfg = deps.discover?.readHead ?? readHead;
      codexCfg = parseCodexConfigModels(await readCfg(joinPath(home, ".codex", "config.toml"), 64 * 1024));
    } catch {
      // 没有 config.toml 就只靠会话记录
    }
    models = mergeModelOptions([
      codexUsed.map((u) => ({ id: u.id, source: "used" as const, seen: u.seen })),
      codexCfg.configured ? [{ id: codexCfg.configured, source: "configured" as const }] : [],
      codexCfg.seen.map((id) => ({ id, source: "configured" as const }))
    ]);
    note =
      models.length > 0
        ? `codex 没有列出全部模型的接口。下面是从本机记录里找到的 ${models.length} 个(你用过的 + 当前配置)——不是全集,别的模型直接填就行,留空则用 codex 默认模型。`
        : "codex 没有列模型接口,请手填模型名(留空则用 codex 默认模型),保存后可用自检验证";
  } else if (entry.modelStrategy === "qwen_configured") {
    if (configuredModel && plausibleModelName(configuredModel)) {
      models = [{ id: configuredModel, source: "configured" }];
    }
    note =
      models.length > 0
        ? "qwen 没有列模型接口;下面是当前 settings 里的模型,也可手填。"
        : "qwen 没有列模型接口,请手填模型名(须能解析出 family),保存后可用自检验证";
  } else if (entry.modelStrategy === "opencode_models") {
    enumerable = true;
    try {
      const listed = await exec(found.path, ["models"], listTimeout);
      models = parseOpencodeModels(`${listed.stdout}\n${listed.stderr}`);
      if (models.length === 0) note = "opencode models 有输出但没解析出条目,可手填 provider/model";
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      models = parseOpencodeModels(`${e.stdout ?? ""}\n${e.stderr ?? ""}`);
      if (isProbeTimeoutError(err)) {
        timedOut = true;
        enumerable = false;
        if (models.length === 0) note = "列模型超时";
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        note = `列模型失败(${msg.slice(0, 120)});可手填 provider/model`;
      }
    }
  } else {
    // inventory_only 且无模型策略;assembleCapability 会补 INVENTORY_ONLY_NOTE
    note = undefined;
  }

  timedOut = timedOut || isTimedOut();
  return assembleCapability({
    entry,
    found,
    ...(binaryDigest ? { binaryDigest } : {}),
    authStatus,
    ...(authDetail ? { authDetail } : {}),
    models,
    enumerable,
    ...(note ? { note } : {}),
    ...(selectedType ? { selectedType } : {}),
    timedOut
  });
  } finally {
    clearTimeout(budgetTimer);
  }
}

/** 探一个 CLI 的完整能力(装没装 → 登录态 → 模型列表)。成功结果按 (name+path+mtime) 缓存 10 分钟。 */
export async function probeCliCapability(
  name: CliName,
  deps: ProbeCliCapabilityDeps = {}
): Promise<CliCapability> {
  const cached = await lookupCachedCapability(name, deps);
  if (cached) return cached;
  const capability = await probeCliCapabilityFresh(name, deps);
  await storeCachedCapability(name, capability, deps);
  return capability;
}

/** 解析 reprobe 请求的 names:必须是目录内 CLI 名;去重保序;空数组合法。 */
export function parseReprobeNames(raw: unknown): { ok: true; names: CliName[] } | { ok: false; message: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, message: "names 必须是 CLI 名数组" };
  }
  const names: CliName[] = [];
  const seen = new Set<CliName>();
  for (const item of raw) {
    if (typeof item !== "string" || !isCliName(item)) {
      return { ok: false, message: `未知 CLI 名:${String(item).slice(0, 40)}` };
    }
    if (!seen.has(item)) {
      seen.add(item);
      names.push(item);
    }
  }
  return { ok: true, names };
}

/**
 * 轻量重探:逐家 bypass 读缓存、单家 8s、并行、不发起模型真实调用。
 * 探完写回缓存,让随后的 GET /cli-capability 看到新结果。
 */
export async function reprobeCliCapabilities(
  names: CliName[],
  deps: ProbeCliCapabilityDeps = {}
): Promise<CliCapability[]> {
  return Promise.all(
    names.map(async (name) => {
      const capability = await probeCliCapabilityFresh(name, {
        ...deps,
        probeTimeoutMs: deps.probeTimeoutMs ?? REPROBE_CLI_BUDGET_MS
      });
      await storeCachedCapability(name, capability, { ...deps, bypassCache: false });
      return capability;
    })
  );
}

/** 画像面多家探测必须并行(Promise.all):整体上限=单家 3.5s + 缓冲,禁止串行叠加。 */
export async function probeAllCliCapabilities(
  deps: ProbeCliCapabilityDeps = {}
): Promise<CliCapability[]> {
  const budgetMs = (deps.probeTimeoutMs ?? PROBE_CLI_BUDGET_MS) + PROBE_ALL_BUFFER_MS;
  const overall = new AbortController();
  const timer = setTimeout(() => overall.abort(), budgetMs);
  timer.unref();
  try {
    const combined = combineSignals(deps.signal, overall.signal);
    return await Promise.all(
      PROBE_CLI_NAMES.map((n) =>
        probeCliCapability(n, { ...deps, ...(combined ? { signal: combined } : {}) })
      )
    );
  } finally {
    clearTimeout(timer);
  }
}
