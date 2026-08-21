#!/usr/bin/env node
// 零 emoji CI 门禁(docs/11-ui-spec.md §12)。优先 spawn rg;无 rg 时 Node 扫文本文件。
import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);

const BIN_RE = /\.(mp3|wav|png|jpg|jpeg|gif|webp|pdf|ico|icns|woff2?)$/i;
const JS_FORBIDDEN = /[\p{Emoji_Presentation}\uFE0F\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const RG_PATTERN = String.raw`[\p{Emoji_Presentation}\x{FE0F}\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}]`;

function fail(msg, code = 2) {
  process.stderr.write(`[fail] emoji gate: ${msg}\n`);
  process.exit(code);
}

function forbiddenCp(cp) {
  return cp === 0xfe0f || (cp >= 0x2600 && cp <= 0x27bf) || (cp >= 0x1f000 && cp <= 0x1faff);
}

function listGitFiles() {
  const r = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    encoding: "buffer",
    cwd: ROOT
  });
  if (r.status !== 0) fail("git ls-files failed");
  return r.stdout
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
}

function collectFiles(argv) {
  if (argv.length > 0) {
    const files = [];
    for (const file of argv) {
      let st;
      try {
        st = statSync(file);
      } catch {
        fail(`unreadable or missing file: ${file}`);
      }
      if (!st.isFile()) fail(`unreadable or missing file: ${file}`);
      try {
        readFileSync(file);
      } catch {
        fail(`unreadable or missing file: ${file}`);
      }
      if (!BIN_RE.test(file)) files.push(file);
    }
    return files;
  }
  return listGitFiles().filter((file) => !BIN_RE.test(file));
}

function scanWithRg(files) {
  const hits = [];
  const chunkSize = 80;
  let usedRg = false;
  for (let i = 0; i < files.length; i += chunkSize) {
    const chunk = files.slice(i, i + chunkSize);
    const r = spawnSync("rg", ["-nP", RG_PATTERN, "--no-heading", "--", ...chunk], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      cwd: ROOT
    });
    if (r.error && r.error.code === "ENOENT") return null;
    usedRg = true;
    if (r.status === 0 && r.stdout) hits.push(r.stdout.trimEnd());
    else if (r.status === 1) continue;
    else if (r.status > 1) return { hits: "", failed: true, status: r.status };
  }
  return usedRg ? { hits: hits.join("\n"), failed: false } : null;
}

function scanWithNode(files) {
  const hits = [];
  for (const file of files) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      fail(`unreadable or missing file: ${file}`);
    }
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      if (JS_FORBIDDEN.test(lines[i])) hits.push(`${file}:${i + 1}`);
    }
  }
  return hits;
}

function scanEncoded(files) {
  const report = [];
  for (const file of files) {
    if (!(file.endsWith(".html") || file.endsWith(".md"))) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      for (const match of line.matchAll(/&#(?:x([0-9a-f]+)|([0-9]+));/gi)) {
        const cp = Number.parseInt(match[1] ?? match[2], match[1] ? 16 : 10);
        if (forbiddenCp(cp)) report.push(`${file}:${index + 1}:${match[0]}`);
      }
      if (!file.endsWith(".html")) continue;
      for (const match of line.matchAll(/\\u(?:\{([0-9a-f]{1,6})\}|([0-9a-f]{4}))/gi)) {
        const cp = Number.parseInt(match[1] ?? match[2], 16);
        if (forbiddenCp(cp)) report.push(`${file}:${index + 1}:${match[0]}`);
      }
      for (const match of line.matchAll(/\\u(d[89ab][0-9a-f]{2})\\u(d[c-f][0-9a-f]{2})/gi)) {
        const high = Number.parseInt(match[1], 16);
        const low = Number.parseInt(match[2], 16);
        const cp = 0x10000 + ((high - 0xd800) << 10) + (low - 0xdc00);
        if (forbiddenCp(cp)) report.push(`${file}:${index + 1}:${match[0]}`);
      }
    }
  }
  return report;
}

const files = collectFiles(process.argv.slice(2));
if (files.length === 0) {
  process.stdout.write("[ok] emoji gate: clean\n");
  process.exit(0);
}

let hits = scanWithNode(files).join("\n");

if (hits) {
  process.stdout.write("[fail] emoji gate: found forbidden pictographic characters:\n");
  process.stdout.write(`${hits}\n`);
  process.exit(1);
}

const encoded = scanEncoded(files);
if (encoded.length > 0) {
  process.stdout.write("[fail] emoji gate: found encoded forbidden pictographic characters:\n");
  process.stdout.write(`${encoded.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write("[ok] emoji gate: clean\n");
