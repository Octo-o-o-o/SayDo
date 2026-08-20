// docs/09 §11 校验规则 2 / 07 D18 纪律 2:模型家族解析(familyOf)。
// 前缀表(含 vendor 前缀段,供多供应商网关如 OpenRouter);cursor_cli/acp 按模型名前缀
// (先剥一层 cursor- 再解析:cursor-grok-4.6→grok;fable→claude,gpt/luna→gpt,composer→composer)。
// 前缀表解析 null 时再按非字母数字分词走家族词表(显示名「Cursor Grok 4.6 High Fast」→grok)。

export type Family = string; // gpt / claude / gemini / deepseek / grok / composer / qwen / llama / mistral / kimi ...

/** vendor 前缀段(api 网关模型名 openai/…、anthropic/… 等)-> family */
const VENDOR_PREFIX: Record<string, Family> = {
  "openai/": "gpt",
  "anthropic/": "claude",
  "google/": "gemini",
  "deepseek/": "deepseek",
  "x-ai/": "grok",
  "qwen/": "qwen",
  "meta-llama/": "llama",
  "mistralai/": "mistral"
};

/** 裸模型名前缀 -> family(cursor_cli/acp 与无 vendor 前缀的 api 模型) */
const NAME_PREFIX: { prefix: string; family: Family }[] = [
  { prefix: "fable", family: "claude" }, // cursor 词表(09 §11:fable->Claude)
  { prefix: "claude", family: "claude" },
  { prefix: "sonnet", family: "claude" },
  { prefix: "opus", family: "claude" },
  { prefix: "haiku", family: "claude" },
  { prefix: "gpt", family: "gpt" },
  { prefix: "luna", family: "gpt" }, // cursor 词表(09 §11:gpt/luna->GPT);"sol"不入表——gpt-5.6-sol 已被 gpt 命中,裸 sol 会误吞 solar 系(评审 B7)
  { prefix: "o1", family: "gpt" },
  { prefix: "o3", family: "gpt" },
  { prefix: "o4", family: "gpt" },
  { prefix: "gemini", family: "gemini" },
  { prefix: "deepseek", family: "deepseek" },
  { prefix: "grok", family: "grok" },
  { prefix: "composer", family: "composer" }, // Cursor 自研族;不并入 grok/claude
  { prefix: "qwen", family: "qwen" },
  { prefix: "llama", family: "llama" },
  { prefix: "mistral", family: "mistral" },
  { prefix: "kimi", family: "kimi" },
  { prefix: "moonshot", family: "kimi" }
];

/**
 * 从模型名解析 family;解析不出返回 null(调用方决定 fail-closed)。
 * 解析序:① vendor 前缀表(openai/ 等);② vendor 段未知时取 "/" 后的模型段按裸名前缀表解析
 * (例 unknown-gw/claude-x 仍判 claude;误判方向是误拒——异族检查更严,fail-closed);
 * ③ 剥一层 cursor- 供应商前缀(cursor-grok-4.6-high-fast→grok)后再走裸名前缀表;
 * ④ 前缀表仍 null 时按非字母数字分词,用家族词表逐词精确匹配取第一个命中
 * (显示名「Cursor Grok 4.6 High Fast」→grok)。全不中仍 null,不猜。
 */
export function familyFromModelName(model: string): Family | null {
  const lower = model.toLowerCase();
  for (const [prefix, family] of Object.entries(VENDOR_PREFIX)) {
    if (lower.startsWith(prefix)) return family;
  }
  if (lower.includes("/")) {
    const seg = lower.split("/")[1] ?? "";
    return matchNamePrefix(stripCursorVendorPrefix(seg));
  }
  return matchNamePrefix(stripCursorVendorPrefix(lower));
}

/** Cursor --list-models 常带 cursor- 供应商前缀;只剥一层,避免误伤裸名。 */
function stripCursorVendorPrefix(name: string): string {
  return name.startsWith("cursor-") ? name.slice("cursor-".length) : name;
}

/** 词级兜底:显示名空格分隔时前缀表 miss,按词表精确命中。o1/o3/o4 只留前缀表,避免误吞。 */
const FAMILY_WORDS: Record<string, Family> = {
  fable: "claude",
  claude: "claude",
  sonnet: "claude",
  opus: "claude",
  haiku: "claude",
  gpt: "gpt",
  luna: "gpt",
  gemini: "gemini",
  deepseek: "deepseek",
  grok: "grok",
  composer: "composer",
  qwen: "qwen",
  llama: "llama",
  mistral: "mistral",
  kimi: "kimi",
  moonshot: "kimi"
};

function matchNamePrefix(name: string): Family | null {
  if (!name) return null;
  for (const { prefix, family } of NAME_PREFIX) {
    if (name.startsWith(prefix)) return family;
  }
  return matchFamilyWord(name);
}

function matchFamilyWord(name: string): Family | null {
  const tokens = name.split(/[^a-z0-9]+/).filter((token) => token.length > 0);
  for (const token of tokens) {
    const family = FAMILY_WORDS[token];
    if (family) return family;
  }
  return null;
}

/**
 * requested≠observed 且同族:CLI 自动降级(订阅限流常见)的人话说明。
 * 异族由 consume family_mismatch 拒,本函数不代判。
 */
export function sameFamilyCliDowngradeNote(
  requested: string | undefined,
  observed: string | undefined
): string | undefined {
  if (!requested || !observed || requested === observed) return undefined;
  const requestedFamily = familyFromModelName(requested);
  const observedFamily = familyFromModelName(observed);
  if (!requestedFamily || !observedFamily || requestedFamily !== observedFamily) return undefined;
  return `CLI 将 ${requested} 降级为 ${observed}(通常是订阅限流),同族仍生效`;
}

/** 自检通过行说明列:实际 <observed>(<requested> 被 CLI 降级) */
export function sameFamilyCliDowngradeDisplay(
  requested: string | undefined,
  observed: string | undefined
): string | undefined {
  if (!sameFamilyCliDowngradeNote(requested, observed)) return undefined;
  return `实际 ${observed}(${requested} 被 CLI 降级)`;
}
