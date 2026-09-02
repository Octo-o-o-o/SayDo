#!/usr/bin/env node
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  CLAIM_SCAN_ROOTS,
  CORPUS_UNRESOLVED_MARKER,
  REPO_ROOT,
  REQUIRED_ROOTS,
  checkActiveClaims
} from "./check-active-claims.mjs";

const EXPECTED_ROOTS = Object.freeze([
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

let pass = 0;
let fail = 0;

function record(ok, label, detail = "") {
  if (ok) {
    process.stdout.write(`[ok] ${label}\n`);
    pass += 1;
  } else {
    process.stdout.write(`[fail] ${label}${detail ? `: ${detail}` : ""}\n`);
    fail += 1;
  }
}

record(
  JSON.stringify([...REQUIRED_ROOTS]) === JSON.stringify([...EXPECTED_ROOTS]),
  "independent expected roots match checker manifest",
  JSON.stringify(REQUIRED_ROOTS)
);
record(CLAIM_SCAN_ROOTS.includes("README.md"), "README is a scanned claim root");
record(!CLAIM_SCAN_ROOTS.includes("docs/06-references.md"), "canonical 06 is required but not phrase-scanned");

const liveErrors = checkActiveClaims(REPO_ROOT);
record(liveErrors.length === 0, "live tree has no forbidden public claims", liveErrors.join("; "));

function withTempTree(mutate) {
  const dir = mkdtempSync(join(tmpdir(), "pg01a-claims-"));
  try {
    for (const rel of REQUIRED_ROOTS) {
      const dest = join(dir, rel);
      mkdirSync(dirname(dest), { recursive: true });
      cpSync(join(REPO_ROOT, rel), dest);
    }
    mutate(dir);
    return checkActiveClaims(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const removedRoot = "README.md";
const missingErrors = withTempTree((dir) => {
  rmSync(join(dir, removedRoot));
});
record(
  missingErrors.some((error) => error.includes(`missing required root:${removedRoot}`)),
  "removing a required root is nonzero",
  missingErrors.join("; ")
);

const claimInjections = [
  { id: "zero-extra-cost", needle: "订阅调用不产生费用" },
  { id: "full-cli-support", needle: "全面支持任意 CLI" },
  { id: "any-openai-compat", needle: "任意 <strong>OpenAI 兼容</strong>端点" },
  { id: "fixed-seconds", needle: "sub-second returns" },
  { id: "data-never-leaves", needle: "Data never leaves your devices" },
  { id: "logged-in-implies-ready", needle: "本机有任一已登录 CLI 即可零 key 开聊" },
  { id: "logged-in-implies-ready", needle: "any logged-in CLI on the machine means zero-key chatting" },
  { id: "all-on-own-device", needle: "全部保存在**你自己的设备**" },
  { id: "on-device-speech", needle: "speech recognition are used for push-to-talk input, processed on-device" },
  { id: "browser-voice-free", needle: "浏览器系统语音免费" },
  { id: "instant-faster", needle: "配 API key 立即变快" },
  { id: "logged-in-implies-ready", needle: "已登录的本机 CLI 可以零 key 慢速开聊" },
  { id: "logged-in-implies-ready", needle: "已登录哪家用哪家" },
  { id: "logged-in-implies-ready", needle: "It can use a CLI already signed in" },
  { id: "subscription-implies-ready", needle: "已订阅哪家用哪家" },
  { id: "subscription-implies-ready", needle: "Whichever you subscribe to, it uses" },
  { id: "subscription-implies-ready", needle: "零 API key、走你的订阅额度" },
  { id: "subscription-implies-ready", needle: "zero API keys, billed to your subscription quota" },
  { id: "fixed-seconds", needle: "API 秒回" },
  { id: "data-never-leaves", needle: "不上传任何用户数据" },
  { id: "logged-in-implies-ready", needle: "走你本机已登录的 AI" },
  {
    id: "subscription-login-as-supply",
    needle: "推理槽位可用 Claude Code / Codex / Cursor / Grok / Gemini CLI / Qwen Code / Copilot CLI 的订阅登录态"
  },
  { id: "subscription-login-as-supply", needle: "reasoning slots can use the subscription login of Claude Code" },
  {
    id: "login-implies-quota",
    needle: "走你已有的 Codex / Claude / Cursor / Grok / Gemini / Qwen / Copilot 登录态,费用以服务商为准;账本显示「订阅额度内」"
  },
  {
    id: "login-implies-quota",
    needle:
      'uses your existing Codex / Claude / Cursor / Grok / Gemini / Qwen / Copilot login; vendor billing applies; the ledger shows "within subscription quota"'
  },
  { id: "browser-voice-free", needle: "browser system voice is free" }
];
for (const { id, needle } of claimInjections) {
  const errors = withTempTree((dir) => {
    const readme = join(dir, "README.md");
    writeFileSync(readme, `${readFileSync(readme, "utf8")}\n${needle}\n`);
  });
  record(
    errors.some((error) => error === `README.md:${id}`),
    `independent ${id} injection is nonzero`,
    errors.length ? errors.join("; ") : needle
  );
}

const legalErrors = withTempTree((dir) => {
  const readme = join(dir, "README.md");
  writeFileSync(
    readme,
    `${readFileSync(readme, "utf8")}\n对话每轮约 15-25 秒。conditional preview。零 key 不等于免费。外发范围以当前配置为准。费用以服务商为准。已接线并通过调用验证。登录不等于可调用或免费。不从登录推断订阅额度。说到不收费,系统或浏览器厂商可能收费。已接线并通过调用验证的 CLI 可作为条件供给。探测为订阅登录态;费用以服务商账单为准。开发者不收集。不向开发者上传。不保证秒回。\n`
  );
});
record(
  legalErrors.length === 0,
  "typical CLI observation and conditional copy stay allowed",
  legalErrors.join("; ")
);

const liveConnectorErrors = withTempTree((dir) => {
  const readme = join(dir, "research/customer-question-corpus/README.md");
  const text = readFileSync(readme, "utf8").replace(
    CORPUS_UNRESOLVED_MARKER,
    "现役 986 个 LIVE source 对象表示 connector 已接通。"
  );
  writeFileSync(readme, text);
});
record(
  liveConnectorErrors.some((error) => error.includes("live-connector-ready") || error.includes("missing unresolved")),
  "changing deferred connector claim to LIVE is nonzero",
  liveConnectorErrors.join("; ")
);

if (fail > 0) {
  process.stderr.write(`[fail] active-claim mutations ${fail} failed / ${pass} passed\n`);
  process.exit(1);
}
process.stdout.write(`[ok] active-claim mutations ${pass} passed\n`);
