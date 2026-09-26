#!/usr/bin/env node
// 本地 FileWriting 形态 cursor-agent 替身。不是 cursor-agent 云服务或付费 CLI。
// 协议对齐生产 adapter:--version 精确 pin;spawn 后在 cwd 写 README 并吐 stream-json init/result。

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const PINNED = "1.0.0-pinned";

if (process.argv.includes("--version")) {
  process.stdout.write(`${PINNED}\n`);
  process.exit(0);
}

const readme = join(process.cwd(), "README.md");
mkdirSync(dirname(readme), { recursive: true });
writeFileSync(readme, "# 安装\n\nnpm install\n\n```\npnpm install\n```\n");

process.stdout.write(`${JSON.stringify({ type: "system", subtype: "init", model: "fable-5-max" })}\n`);
process.stdout.write(
  `${JSON.stringify({ type: "result", subtype: "success", result: "README 安装一节保留 npm 并补了 pnpm 示例" })}\n`
);
process.exit(0);
