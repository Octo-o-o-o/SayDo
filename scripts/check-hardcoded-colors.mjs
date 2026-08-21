#!/usr/bin/env node
// 写死色值 CI 门禁(docs/11-ui-spec.md §2.7)。优先 spawn rg;无 rg 时 Node 扫。
import { spawnSync } from "node:child_process";
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

function rgHits(pattern, files) {
  if (files.length === 0) return { hits: [], failed: false, missing: false };
  const hits = [];
  const chunkSize = 80;
  for (let i = 0; i < files.length; i += chunkSize) {
    const chunk = files.slice(i, i + chunkSize);
    const r = spawnSync("rg", ["-nP", pattern, "--no-heading", "--with-filename", "--", ...chunk], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      cwd: ROOT
    });
    if (r.error && r.error.code === "ENOENT") return { hits: [], failed: false, missing: true };
    if (r.status === 0 && r.stdout) hits.push(...r.stdout.trimEnd().split("\n").filter(Boolean));
    else if (r.status === 1) continue;
    else if (r.status > 1) return { hits: [], failed: true, missing: false };
  }
  return { hits, failed: false, missing: false };
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

function scan(pattern, re, cssOnly) {
  const targets = files.filter((file) => {
    if (ALLOW_RE.test(file.replaceAll("\\", "/"))) return false;
    if (cssOnly && !file.endsWith(".css")) return false;
    return true;
  });
  const rg = rgHits(pattern, targets);
  if (rg.failed || rg.missing) output.push(...nodeHits(re, targets));
  else output.push(...rg.hits);
}

scan("#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z_-])", HEX_RE, false);
scan("(?<![\\-\\w])(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color)\\s*\\(", FUNC_RE, false);
scan(
  `(?:^|[;{])\\s*(?:-webkit-)?(?:color|background|background-color|border|border-color|border-top|border-right|border-bottom|border-left|border-top-color|border-right-color|border-bottom-color|border-left-color|outline|outline-color|fill|stroke|box-shadow|text-shadow|caret-color|accent-color|text-decoration-color)\\s*:[^;{}]*(?<![-\\w#])(?:${NAMED})(?![-\\w])`,
  NAMED_RE,
  true
);

if (output.length > 0) {
  process.stdout.write("[fail] color gate: found hardcoded colors (use tokens from styles/tokens.css):\n");
  process.stdout.write(`${output.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write("[ok] color gate: clean\n");
