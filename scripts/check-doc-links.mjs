#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";

const repo = resolve(import.meta.dirname, "..");
const siteRoots = ["deploy/saydo-octoooo-com", "deploy/link-saydo-octoooo-com"];
const gitZ = (args) =>
  execFileSync("git", args, { cwd: repo, encoding: "utf8" }).split("\0").filter(Boolean);

const allFiles = [
  ...new Set([
    ...gitZ(["ls-files", "-z"]),
    ...gitZ(["ls-files", "--others", "--exclude-standard", "-z"])
  ])
];

function isActiveAsset(path) {
  if (["README.md", "HANDOFF.md", "SECURITY.md"].includes(path)) return true;
  if (/^packages\/[^/]+\/README\.md$/.test(path)) return true;
  if (siteRoots.some((root) => path.startsWith(`${root}/`) && path.endsWith(".html"))) return true;
  if (!path.endsWith(".md") || !path.startsWith("docs/")) return false;
  return !path.includes("/archive/") && !path.includes("/migration/");
}

const files = allFiles.filter(isActiveAsset).sort((a, b) => a.localeCompare(b, "en"));
const failures = [];

function maskMarkdownCode(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/`[^`\n]*`/g, (code) => " ".repeat(code.length));
}

function targetPath(sourcePath, rawTarget) {
  let target = rawTarget.trim();
  if (target.startsWith("<") && target.endsWith(">")) target = target.slice(1, -1);
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) return null;
  try {
    target = decodeURIComponent(target);
  } catch {
    // 非法百分号继续进入存在性检查并报错。
  }
  target = target.split("#")[0].split("?")[0];
  if (target === "") return null;
  const sourceAbsolute = resolve(repo, sourcePath);
  let absolute;
  if (target.startsWith("/")) {
    const sourceRoot = siteRoots.find((root) => sourcePath.startsWith(`${root}/`));
    absolute = sourceRoot ? resolve(repo, sourceRoot, `.${target}`) : resolve(repo, `.${target}`);
  } else {
    absolute = resolve(dirname(sourceAbsolute), target);
  }
  if (!existsSync(absolute) && /:\d+$/.test(absolute)) absolute = absolute.replace(/:\d+$/, "");
  return absolute;
}

function checkTarget(sourcePath, target, index, text) {
  const absolute = targetPath(sourcePath, target);
  if (absolute === null || existsSync(absolute)) return;
  const line = text.slice(0, index).split("\n").length;
  failures.push(`${sourcePath}:${line} -> ${target}`);
}

for (const path of files) {
  const original = readFileSync(resolve(repo, path), "utf8");
  const extension = extname(path);
  const text = extension === ".md" ? maskMarkdownCode(original) : original;

  if (extension === ".md") {
    const definitions = new Map();
    for (const match of text.matchAll(/^\s{0,3}\[([^\]\n]+)\]:\s*(<[^>]+>|\S+)/gim)) {
      definitions.set(match[1].trim().toLowerCase(), { target: match[2], index: match.index });
      checkTarget(path, match[2], match.index, text);
    }
    for (const match of text.matchAll(/!?\[[^\]\n]*\]\((<[^>]+>|[^)\s]+)(?:\s+["'][^"']*["'])?\)/g)) {
      checkTarget(path, match[1], match.index, text);
    }
    for (const match of text.matchAll(/!?\[([^\]\n]+)\]\[([^\]\n]*)\]/g)) {
      // 评审/计划表中的相邻证据标签（如 [M][O]）不是 Markdown 引用链接。
      if (/^[A-Z0-9-]{1,4}$/.test(match[1]) && /^[A-Z0-9-]{1,4}$/.test(match[2])) continue;
      const id = (match[2] || match[1]).trim().toLowerCase();
      if (!definitions.has(id)) {
        const line = text.slice(0, match.index).split("\n").length;
        failures.push(`${path}:${line} -> 缺引用定义 [${id}]`);
      }
    }
  }

  // Markdown 可内嵌 HTML；生成站点也用同一检查器。
  for (const match of text.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
    checkTarget(path, match[1], match.index, text);
  }
}

if (failures.length > 0) {
  console.error(`[fail] 活跃文档相对链接失效:${failures.length}`);
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log(`[ok] active document links: files=${files.length} broken=0`);
