#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(here, "..");

export const CORPUS_UNRESOLVED_MARKER =
  "现役 986 个 LIVE source 对象是 unresolved requirement，不是 connector readiness。";

export const REQUIRED_ROOTS = Object.freeze([
  "AGENTS.md",
  "README.md",
  "deploy/saydo-octoooo-com/docs/index.html",
  "deploy/saydo-octoooo-com/en/docs/index.html",
  "deploy/saydo-octoooo-com/en/index.html",
  "deploy/saydo-octoooo-com/en/privacy/index.html",
  "deploy/saydo-octoooo-com/en/support/index.html",
  "deploy/saydo-octoooo-com/en/terms/index.html",
  "deploy/saydo-octoooo-com/index.html",
  "deploy/saydo-octoooo-com/install.ps1",
  "deploy/saydo-octoooo-com/install.sh",
  "deploy/saydo-octoooo-com/privacy/index.html",
  "deploy/saydo-octoooo-com/support/index.html",
  "deploy/saydo-octoooo-com/terms/index.html",
  "docs/06-references.md",
  "docs/11-ui-spec.md",
  "docs/release/2026-08-13-app-materials.md",
  "docs/release/metadata.json",
  "docs/release/v0.1.0-rc.12.md",
  "docs/site/style-demos/11-hybrid.html",
  "justfile",
  "packages/console/src/components/SetupGate.tsx",
  "packages/console/src/components/SetupWizard.tsx",
  "packages/console/src/components/SupplyPicker.tsx",
  "packages/console/src/lib/resourcePlans.ts",
  "packages/console/src/lib/setupApi.ts",
  "packages/console/src/pages/Chat.tsx",
  "packages/console/src/pages/GlobalSettings.tsx",
  "packages/console/src/voice/useVoiceChannel.ts",
  "research/customer-question-corpus/README.md",
  "templates/saydo.config.dev.example.toml",
  "templates/saydo.config.example.toml",
  "templates/saydo.env.example"
]);

const CANONICAL_DEFINITION_ROOTS = new Set(["docs/06-references.md", "docs/11-ui-spec.md"]);

export const CLAIM_SCAN_ROOTS = Object.freeze(
  REQUIRED_ROOTS.filter((rel) => !CANONICAL_DEFINITION_ROOTS.has(rel))
);

export const FORBIDDEN_CLAIM_PATTERNS = Object.freeze([
  { id: "local-ci-equivalent", re: /本地 CI 等效|CI 等效判定/u },
  {
    id: "zero-extra-cost",
    re: /无需额外付费|零额外费用|订阅内零成本|额度内零额外|订阅调用不产生费用|不产生费用|不产生「元」|zero extra cost|No extra fees|cost nothing|zero cost within subscription|produce no "yuan"|produce no yuan/iu
  },
  { id: "full-cli-support", re: /全面支持任意\s*CLI|任意 CLI 都可用|任一 CLI 都可用|all CLIs are supported/u },
  {
    id: "any-openai-compat",
    re: /任意\s*兼容\s*OpenAI|任意\s*OpenAI\s*兼容|任一\s*OpenAI\s*兼容|Any\s+OpenAI-compatible|any\s+OpenAI-compatible/iu
  },
  {
    id: "fixed-seconds",
    re: /秒级返回|秒级实时|通常秒级|sub-second returns|sub-second,|For sub-second dialog|Sub-second returns|API 秒回/iu
  },
  {
    id: "data-never-leaves",
    re: /数据不出这台电脑|数据不出你的设备|数据完全在你手里|数据只在你的设备和局域网|保存在你自己的设备上|数据保存在你自己的设备上|数据全部留在本机|数据 100% 本机|Data never leaves your devices|data never leaves your devices|all data stays on your devices|stay on your own devices|stays on your own devices|stay on your devices|stays on your devices|stored on your own devices|stored on your devices|100% on-device|不上传任何用户数据/iu
  },
  {
    id: "logged-in-implies-ready",
    re: /任一已登录 CLI 即可零 key|已登录 CLI 可零 key 开聊|即可零 key 开聊|any logged-in CLI on the machine means|means zero-key chatting|已登录的本机 CLI 可以零 key|已登录哪家用哪家|It can use a CLI already signed in|走你本机已登录的|sessions already signed in|already signed in on your computer|already signed in on your machine|用你本机已登录的 CLI|Use CLIs already logged in on your machine|也可用已登录 CLI 订阅|一个你已登录的 AI CLI|one AI CLI you're logged into|一个已登录的 AI CLI|one logged-in AI CLI/iu
  },
  {
    id: "subscription-implies-ready",
    re: /已订阅哪家用哪家|Whichever you subscribe to, it uses|零 API key、走你的订阅额度|zero API keys, billed to your subscription quota|不需要 key\(走 CLI 订阅\)|need no key \(they use CLI subscriptions\)/iu
  },
  {
    id: "all-on-own-device",
    re: /全部保存在你自己的设备|默认在你自己的设备上工作|works on your own machines/iu
  },
  {
    id: "on-device-speech",
    re: /音频仅在本机处理|仅在本机处理,\s*不上传|processed on-device/iu
  },
  { id: "browser-voice-free", re: /浏览器系统语音免费|browser system voice is free/iu },
  {
    id: "subscription-login-as-supply",
    re: /推理槽位可用.{0,160}订阅登录态|can use the\s+subscription login/iu
  },
  {
    id: "login-implies-quota",
    re: /登录态,费用以服务商为准;账本显示「订阅额度内」|existing Codex \/ Claude \/ Cursor \/ Grok \/ Gemini \/ Qwen \/ Copilot login; vendor billing applies; the ledger shows "within subscription quota"/iu
  },
  { id: "instant-faster", re: /立即变快/u },
  { id: "ordinary-user-ready", re: /普通用户无需克隆|普通用户已开箱/u },
  { id: "live-connector-ready", re: /表示 connector 已接通|connector 已实现/u }
]);

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripMarkup(text) {
  return decodeEntities(
    text
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ");
}

function stripMarkdown(text) {
  return text.replace(/\*\*/g, "").replace(/__/g, "");
}

function claimSurfaces(text) {
  return [text, stripMarkup(text), stripMarkup(stripMarkdown(text))];
}

export function checkActiveClaims(root = REPO_ROOT) {
  const errors = [];
  for (const rel of REQUIRED_ROOTS) {
    const absolute = join(root, rel);
    if (!existsSync(absolute)) errors.push(`missing required root:${rel}`);
  }
  for (const rel of CLAIM_SCAN_ROOTS) {
    const absolute = join(root, rel);
    if (!existsSync(absolute)) continue;
    const text = readFileSync(absolute, "utf8");
    const hits = new Set();
    for (const surface of claimSurfaces(text)) {
      for (const pattern of FORBIDDEN_CLAIM_PATTERNS) {
        if (pattern.re.test(surface)) hits.add(`${rel}:${pattern.id}`);
      }
    }
    errors.push(...hits);
  }
  const corpusReadmePath = join(root, "research/customer-question-corpus/README.md");
  if (existsSync(corpusReadmePath)) {
    const corpusReadme = readFileSync(corpusReadmePath, "utf8");
    if (!corpusReadme.includes(CORPUS_UNRESOLVED_MARKER)) {
      errors.push("corpus README missing unresolved-requirement marker");
    }
  }
  return errors;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  const errors = checkActiveClaims();
  if (errors.length > 0) {
    process.stderr.write(`[fail] active claims ${errors.length}\n`);
    for (const error of errors) process.stderr.write(`- ${error}\n`);
    process.exit(1);
  }
  process.stdout.write(`[ok] active claims roots=${REQUIRED_ROOTS.length}\n`);
}
