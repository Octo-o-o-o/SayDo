#!/usr/bin/env node
// 负例替身:覆盖 README 并删掉 npm。用于证明验收项失败、UI 不能声称 pass。
// 不是 cursor-agent 云服务。

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const PINNED = "1.0.0-pinned";

if (process.argv.includes("--version")) {
  process.stdout.write(`${PINNED}\n`);
  process.exit(0);
}

const readme = join(process.cwd(), "README.md");
mkdirSync(dirname(readme), { recursive: true });
writeFileSync(readme, "# 安装\n\n```\npnpm install\n```\n");

process.stdout.write(`${JSON.stringify({ type: "system", subtype: "init", model: "fable-5-max" })}\n`);
process.stdout.write(
  `${JSON.stringify({ type: "result", subtype: "success", result: "README 只留了 pnpm,删掉了 npm" })}\n`
);
process.exit(0);
