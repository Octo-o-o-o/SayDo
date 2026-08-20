// ~/.saydo/.env 读写合并(first-run onboarding secret 写口)。
// 纪律:同名替换、其余行原样保留;权限 0600;value 永不进日志/audit。

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** secret 写口 name 白名单(与 templates/saydo.env.example 核心键 + pipeline 实际读取键对齐) */
export const SECRET_NAME_WHITELIST = [
  "OPENROUTER_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "DEEPSEEK_API_KEY", // 单家直连(09 §11 [providers.api.deepseek] 已有样例);一键上手路径的唯一必填 key
  "DOUBAO_TTS_API_KEY",
  "VOLC_APP_ID",
  "VOLC_ACCESS_TOKEN"
] as const;
export type SecretName = (typeof SECRET_NAME_WHITELIST)[number];

export function isSecretName(name: string): name is SecretName {
  return (SECRET_NAME_WHITELIST as readonly string[]).includes(name);
}

/** probe 回显布尔的密钥名(pipeline 实际读 + 对话常用) */
export const PROBE_SECRET_NAMES = [
  "OPENROUTER_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "DEEPSEEK_API_KEY",
  "DOUBAO_TTS_API_KEY",
  "VOLC_APP_ID",
  "VOLC_ACCESS_TOKEN"
] as const;

/**
 * 解析 .env 文本为键值表(与 daemon readSaydoEnv / pipeline read_env_key 口径一致:
 * 行尾空白+# 注释剥离;引号剥除)。
 */
export function parseEnvText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const eq = t.indexOf("=");
    const k = t.slice(0, eq).trim();
    const raw = t.slice(eq + 1);
    const v = raw.split(/\s+#/)[0]?.trim().replace(/^["']|["']$/g, "") ?? "";
    if (k) out[k] = v;
  }
  return out;
}

/** 读活动 .env 与可选 .env.pending 合并视图(pending 覆盖同名;布尔存在性) */
export function readEnvMerged(saydoHome: string, preferPending: boolean): {
  values: Record<string, string>;
  source: "pending" | "active" | "none";
  activePath: string;
  pendingPath: string;
} {
  const activePath = join(saydoHome, ".env");
  const pendingPath = join(saydoHome, ".env.pending");
  const activeExists = existsSync(activePath);
  const pendingExists = existsSync(pendingPath);
  let values: Record<string, string> = {};
  let source: "pending" | "active" | "none" = "none";
  if (activeExists) {
    values = parseEnvText(readFileSync(activePath, "utf8"));
    source = "active";
  }
  if (preferPending && pendingExists) {
    values = { ...values, ...parseEnvText(readFileSync(pendingPath, "utf8")) };
    source = "pending";
  }
  return { values, source: pendingExists && preferPending ? "pending" : source, activePath, pendingPath };
}

/** 密钥是否存在且非空(布尔,永不回显值) */
export function secretPresent(values: Record<string, string | undefined>, name: string): boolean {
  const v = values[name];
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * 基于现有 .env 文本合并同名替换,其余行(含注释/空行)原样保留;
 * 若 name 原不存在则追加一行。返回新全文。
 */
export function mergeEnvText(existingText: string | null, name: string, value: string): string {
  const lines = existingText === null || existingText === "" ? [] : existingText.split("\n");
  // 去掉末尾因 split 产生的空元素若原文以 \n 结尾会有;保留结构:逐行处理
  let replaced = false;
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) {
      out.push(line);
      continue;
    }
    const eq = t.indexOf("=");
    const k = t.slice(0, eq).trim();
    if (k === name) {
      out.push(`${name}=${value}`);
      replaced = true;
    } else {
      out.push(line);
    }
  }
  if (!replaced) {
    // 追加前若最后一行非空且原文不以换行结束,仍 push 新行
    if (out.length > 0 && out[out.length - 1] !== "") {
      // keep as is
    }
    out.push(`${name}=${value}`);
  }
  // 统一以单换行收尾
  let text = out.join("\n");
  if (!text.endsWith("\n")) text += "\n";
  return text;
}

/** 文件 mode 低 9 位(测 0600) */
export function fileModeBits(path: string): number {
  return statSync(path).mode & 0o777;
}
