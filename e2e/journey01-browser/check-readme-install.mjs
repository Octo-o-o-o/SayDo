#!/usr/bin/env node
// 本地 fixture 验收脚本:README 必须同时保留 npm install 并出现 pnpm install。
// 打印原始 README 与检查结果,退出码 0 仅当两项都成立。不是云服务。

import { existsSync, readFileSync } from "node:fs";

const readme = existsSync("README.md") ? readFileSync("README.md", "utf8") : "";
// pnpm install 含有子串 npm install,必须按词边界区分,避免删掉 npm 仍被判保留。
const hasNpm = /(?:^|[^A-Za-z])npm install/.test(readme);
const hasPnpm = /(?:^|[^A-Za-z])pnpm install/.test(readme);
process.stdout.write("--- README.md ---\n");
process.stdout.write(readme.endsWith("\n") ? readme : `${readme}\n`);
process.stdout.write("--- checks ---\n");
process.stdout.write(hasNpm ? "[ok] npm install retained\n" : "[fail] npm install missing\n");
process.stdout.write(hasPnpm ? "[ok] pnpm install present\n" : "[fail] pnpm install missing\n");
process.exit(hasNpm && hasPnpm ? 0 : 1);
