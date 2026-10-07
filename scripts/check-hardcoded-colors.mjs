#!/usr/bin/env node
// 写死色值按需检查(docs/11-ui-spec.md §2.7)。使用 Node 扫描。
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);

const SCAN_DIR = "packages/console/src";
const ALLOW_RE = /(^|[/\\])tokens\.css$/;
const FUNC_RE = /(?<![-\w])(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color)\s*\(/;
const HEX_RE = /#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z_-])/;
const NAMED =
  "white|black|red|green|blue|yellow|orange|purple|pink|brown|gray|grey|silver|gold|cyan|magenta|lime|navy|teal|olive|maroon|aqua|fuchsia|beige|ivory|coral|salmon|tan|violet|indigo|khaki|crimson|orchid|plum|azure|wheat|linen|snow|mint";
const NAMED_RE = new RegExp(
  `(?:^|[;{])\\s*(?:-webkit-)?(?:color|background|background-color|border|border-color|border-top|border-right|border-bottom|border-left|border-top-color|border-right-color|border-bottom-color|border-left-color|outline|outline-color|fill|stroke|box-shadow|text-shadow|caret-color|accent-color|text-decoration-color)\\s*:[^;{}]*(?<![-\\w#])(?:${NAMED})(?![-\\w])`
);

function fail(msg, code = 2) {
  process.stderr.write(`[fail] color gate: ${msg}\n`);
  process.exit(code);
}

function walkSource(dir, acc = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walkSource(p, acc);
    else if (/\.(css|ts|tsx)$/.test(ent.name) && !/\.test\.|\.fixture\./.test(ent.name)) acc.push(p);
  }
  return acc;
}

function collectFiles(argv) {
  if (argv.length > 0) {
    const files = [];
    for (const file of argv) {
      try {
        if (!statSync(file).isFile()) fail(`unreadable or missing file: ${file}`);
        readFileSync(file);
      } catch {
        fail(`unreadable or missing file: ${file}`);
      }
      files.push(file);
    }
    return files;
  }
  if (!existsSync(SCAN_DIR) || !statSync(SCAN_DIR).isDirectory()) fail(`scan dir missing: ${SCAN_DIR}`);
  return walkSource(SCAN_DIR).sort();
}

function nodeHits(re, files) {
  const hits = [];
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      if (re.test(lines[i])) hits.push(`${relative(ROOT, file).replaceAll("\\", "/")}:${i + 1}:${lines[i]}`);
      re.lastIndex = 0;
    }
  }
  return hits;
}

const files = collectFiles(process.argv.slice(2));
const output = [];

function scan(re, cssOnly) {
  const targets = files.filter((file) => {
    if (ALLOW_RE.test(file.replaceAll("\\", "/"))) return false;
    if (cssOnly && !file.endsWith(".css")) return false;
    return true;
  });
  output.push(...nodeHits(re, targets));
}

scan(HEX_RE, false);
scan(FUNC_RE, false);
scan(NAMED_RE, true);

if (output.length > 0) {
  process.stdout.write("[fail] color gate: found hardcoded colors (use tokens from styles/tokens.css):\n");
  process.stdout.write(`${output.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write("[ok] color gate: clean\n");
