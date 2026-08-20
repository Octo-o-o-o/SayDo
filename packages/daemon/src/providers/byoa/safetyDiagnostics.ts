// safetyStop 触发行脱敏与截断(v3.8):CLI stdout 非用户密钥,原样可记;
// 仍替换已知 secret 环境值与常见 key 形态,避免日志/自检文案带出 token。

import { SECRET_NAME_WHITELIST } from "../../config/envFile.js";

export const SAFETY_STOP_LOG_BYTES = 500;
export const SAFETY_STOP_SNIPPET_CHARS = 120;

const SECRET_KEY_RE = /(?:API[_-]?KEY|ACCESS_TOKEN|TOKEN|SECRET|PASSWORD|AUTHORIZATION|BEARER)/i;

export function collectSecretEnvValues(
  ...envs: Array<Record<string, string | undefined> | undefined>
): string[] {
  const values = new Set<string>();
  for (const env of envs) {
    if (!env) continue;
    for (const [key, value] of Object.entries(env)) {
      if (!value || value.length < 8) continue;
      if (SECRET_KEY_RE.test(key) || (SECRET_NAME_WHITELIST as readonly string[]).includes(key)) {
        values.add(value);
      }
    }
  }
  return [...values].sort((a, b) => b.length - a.length);
}

export function sanitizeCliStdoutLine(line: string, secretValues: readonly string[] = []): string {
  let out = line;
  for (const value of secretValues) {
    if (value.length >= 8) out = out.split(value).join("[redacted]");
  }
  return out
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9]{8,}/g, "[redacted]")
    .replace(/key[=:]\s*["']?[^"'\s]+/gi, "key=[redacted]");
}

export function truncateUtf8Bytes(text: string, maxBytes: number): string {
  if (maxBytes <= 0) return "";
  if (Buffer.byteLength(text) <= maxBytes) return text;
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (Buffer.byteLength(text.slice(0, mid)) <= maxBytes) low = mid;
    else high = mid - 1;
  }
  const end = low > 0 && /[\uD800-\uDBFF]/.test(text[low - 1]!) ? low - 1 : low;
  return text.slice(0, end);
}

export function triggerContentSnippet(
  line: string,
  secretValues: readonly string[] = [],
  maxChars = SAFETY_STOP_SNIPPET_CHARS
): string {
  const sanitized = sanitizeCliStdoutLine(line, secretValues);
  return sanitized.length <= maxChars ? sanitized : sanitized.slice(0, maxChars);
}

export function withTriggerContent(
  message: string,
  line: string | undefined,
  secretValues: readonly string[] = []
): string {
  if (!line?.trim()) return message;
  return `${message}(触发内容:${triggerContentSnippet(line, secretValues)})`;
}

export function safetyStopLogLine(line: string, secretValues: readonly string[] = []): string {
  return truncateUtf8Bytes(sanitizeCliStdoutLine(line, secretValues), SAFETY_STOP_LOG_BYTES);
}
