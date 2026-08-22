#!/usr/bin/env node
// 生成软著程序鉴别材料 HTML:packages/daemon + packages/console 源码
// 前 30 页 + 后 30 页,每页 50 行非空,页眉带软件名+版本+页码。
// 用法: node scripts/gen-copyright-docs.mjs

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "artifacts", "release", "copyright");
const SOFTWARE_NAME = "说到事务管理软件";
const VERSION = "V1.0";
const LINES_PER_PAGE = 50;
const PAGES_HEAD = 30;
const PAGES_TAIL = 30;
const PREFIXES = ["packages/daemon/", "packages/console/"];
const EXCLUDE = /(\.test\.|\.spec\.|__tests__|fixtures?\/|\.d\.ts$|dist\/|node_modules\/)/;

function listTracked() {
  const raw = execSync("git ls-files", { cwd: ROOT, encoding: "utf8" });
  return raw
    .split("\n")
    .filter(Boolean)
    .filter((f) => PREFIXES.some((p) => f.startsWith(p)))
    .filter((f) => /\.(ts|tsx|js|mjs|css)$/.test(f))
    .filter((f) => !EXCLUDE.test(f))
    .sort();
}

function gatherLines() {
  const lines = [];
  for (const file of listTracked()) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    lines.push(`/* ==== ${file} ==== */`);
    for (const line of fs.readFileSync(full, "utf8").split("\n")) {
      if (line.trim().length === 0) continue;
      lines.push(line.replace(/\t/g, "  "));
    }
  }
  return lines;
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderPages(lines, startPageNo) {
  let html = "";
  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
    const pageNo = startPageNo + Math.floor(i / LINES_PER_PAGE);
    const chunk = lines.slice(i, i + LINES_PER_PAGE);
    html += `<div class="page"><div class="header"><span>${SOFTWARE_NAME} ${VERSION}</span><span>第 ${pageNo} 页</span></div><pre>${esc(chunk.join("\n"))}</pre></div>\n`;
  }
  return html;
}

const all = gatherLines();
const totalPages = Math.ceil(all.length / LINES_PER_PAGE);
const headLines = all.slice(0, PAGES_HEAD * LINES_PER_PAGE);
const tailLines = all.slice(-PAGES_TAIL * LINES_PER_PAGE);
const tailStart = Math.max(1, totalPages - PAGES_TAIL + 1);

fs.mkdirSync(OUT_DIR, { recursive: true });
const style = `<style>
  @page { size: A4; margin: 8mm; }
  body { margin: 0; font-family: "SF Mono", Menlo, Consolas, monospace; }
  .page { width: 194mm; height: 277mm; overflow: hidden; margin: 0 auto; padding: 6mm 8mm; box-sizing: border-box; break-after: page; page-break-after: always; }
  .header { display: flex; justify-content: space-between; font-size: 9pt; border-bottom: 1px solid #999; padding-bottom: 2mm; margin-bottom: 2mm; font-family: "Songti SC", SimSun, serif; }
  pre { font-size: 7pt; line-height: 1.22; margin: 0; white-space: pre-wrap; word-break: break-all; }
</style>`;

const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>${SOFTWARE_NAME} ${VERSION} 源程序</title>${style}</head><body>
${renderPages(headLines, 1)}
<div class="page"><div class="header"><span>${SOFTWARE_NAME} ${VERSION}</span><span>（前 ${PAGES_HEAD} 页 / 后 ${PAGES_TAIL} 页 分隔页）</span></div><p style="font-family:serif;text-align:center;margin-top:100mm">—— 以下为源程序后 ${PAGES_TAIL} 页（总第 ${tailStart} 页起） ——</p></div>
${renderPages(tailLines, tailStart)}
</body></html>`;

const outFile = path.join(OUT_DIR, "source-code-60pages.html");
fs.writeFileSync(outFile, html);
console.log(`[ok] lines=${all.length} totalPages=${totalPages} wrote=${outFile}`);
