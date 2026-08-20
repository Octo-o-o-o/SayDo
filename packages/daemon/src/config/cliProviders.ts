// 已接线 CLI provider 词表与 name↔provider 映射(09 §11;闭合点单源,避免 union 分叉)。
// kimi_cli / opencode_cli 保持 inventory_only,不在此列。

import { isWiredCliProvider, WIRED_CLI_PROVIDERS, type WiredCliProvider } from "@saydo/contracts";

export { isWiredCliProvider, WIRED_CLI_PROVIDERS };
export type { WiredCliProvider };

const PROVIDER_TO_CLI = {
  cursor_cli: "cursor-agent",
  codex_cli: "codex",
  claude_cli: "claude",
  grok_cli: "grok",
  gemini_cli: "gemini",
  qwen_cli: "qwen",
  copilot_cli: "copilot"
} as const satisfies Record<WiredCliProvider, string>;

export function cliNameForProvider(provider: string): (typeof PROVIDER_TO_CLI)[WiredCliProvider] | undefined {
  if (!isWiredCliProvider(provider)) return undefined;
  return PROVIDER_TO_CLI[provider];
}

/** 配置期 family 不得走 verified_binary_default 的传输型 / 非固定族 CLI */
export function allowsVerifiedBinaryDefault(provider: string): boolean {
  return provider === "codex_cli" || provider === "claude_cli";
}

/** 新家(须隔离 HOME);老 4 家不在本批改 runner HOME。
 * cursor 不在此列:P6b 实测凭据在 Keychain,无法安全注入隔离 HOME 并自证登录态,硬上会把 self-test 打成未登录。 */
export function requiresIsolatedHome(provider: string): boolean {
  return provider === "gemini_cli" || provider === "qwen_cli" || provider === "copilot_cli";
}
