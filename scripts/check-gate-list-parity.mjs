#!/usr/bin/env node
// 只比较 check-active-claims 与 check-public-tree-privacy 两个候选门的命令名集合。
// flag 白名单只允许本地/hosted 的 --ref 参数形态与 hosted --allow-missing-probes。
// PG-02 gate registry 落地后删除。不做 mutation 自测。
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(here, "..");
const CANDIDATE_NAMES = Object.freeze([
  "node scripts/check-active-claims.mjs",
  "node scripts/check-public-tree-privacy.mjs"
]);
const LOCAL_PRIVACY_FLAGS = Object.freeze(["--ref", "$(git rev-parse HEAD)"]);
const HOSTED_PRIVACY_FLAGS = Object.freeze(["--ref", "$GITHUB_SHA", "--allow-missing-probes"]);

function fail(message, code = 1) {
  process.stderr.write(`[fail] ${message}\n`);
  process.exit(code);
}

function readRel(rel) {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

function splitTopLevelAnd(cmd) {
  const parts = [];
  let buf = "";
  let quote = null;
  for (let i = 0; i < cmd.length; i += 1) {
    const ch = cmd[i];
    if (quote) {
      if (ch === quote) quote = null;
      buf += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === "&" && cmd[i + 1] === "&") {
      if (buf.trim()) parts.push(buf.trim());
      buf = "";
      i += 1;
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

function tokenize(cmd) {
  const tokens = [];
  const re = /"([^"]*)"|'([^']*)'|\$\([^)]+\)|\S+/g;
  let match;
  while ((match = re.exec(cmd))) {
    if (match[1] !== undefined) tokens.push(match[1]);
    else if (match[2] !== undefined) tokens.push(match[2]);
    else tokens.push(match[0]);
  }
  return tokens;
}

function isTrackedCommand(cmd) {
  return (
    cmd.startsWith("node scripts/") || cmd.startsWith("bash scripts/") || cmd.startsWith("pnpm")
  );
}

function parseInvocation(cmd) {
  const tokens = tokenize(cmd);
  if (tokens.length === 0) return null;
  if (tokens[0] === "node" && tokens[1] && tokens[1].startsWith("scripts/")) {
    return { name: `node ${tokens[1]}`, flags: tokens.slice(2) };
  }
  if (tokens[0] === "bash" && tokens[1] && tokens[1].startsWith("scripts/")) {
    return { name: `bash ${tokens[1]}`, flags: tokens.slice(2) };
  }
  if (tokens[0] === "pnpm") {
    let nameEnd = tokens.length;
    for (let i = 1; i < tokens.length; i += 1) {
      if (tokens[i].startsWith("-")) {
        nameEnd = i;
        break;
      }
    }
    return { name: tokens.slice(0, nameEnd).join(" "), flags: tokens.slice(nameEnd) };
  }
  return null;
}

function collectTracked(commands) {
  const found = [];
  for (const raw of commands) {
    for (const piece of splitTopLevelAnd(raw)) {
      if (!isTrackedCommand(piece)) continue;
      const parsed = parseInvocation(piece);
      if (parsed) found.push(parsed);
    }
  }
  return found;
}

function justRecipeCommands(text, recipe) {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line === `${recipe}:`);
  if (start < 0) throw new Error(`justfile 缺少配方 ${recipe}`);
  const body = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) break;
    body.push(line.trim());
  }
  if (body.length === 0) throw new Error(`justfile ${recipe} 为空`);
  return body;
}

function packageScriptCommands(text, scriptName) {
  const json = JSON.parse(text);
  const script = json?.scripts?.[scriptName];
  if (typeof script !== "string" || script.trim() === "") {
    throw new Error(`package.json 缺少 scripts.${scriptName}`);
  }
  return splitTopLevelAnd(script);
}

function yamlJobBlock(text, jobName) {
  const start = text.search(new RegExp(`^  ${jobName}:\\s*$`, "m"));
  if (start < 0) throw new Error(`YAML 缺少 job ${jobName}`);
  const after = text.slice(start + text.slice(start).indexOf("\n") + 1);
  const next = after.search(/^  [A-Za-z0-9_-]+:/m);
  return after.slice(0, next === -1 ? after.length : next);
}

function yamlRunBodies(jobBlock) {
  const lines = jobBlock.split("\n");
  const bodies = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = /^(\s+)(?:-\s+)?run:\s*(.*)$/.exec(lines[i]);
    if (!match) continue;
    const indent = match[1].length;
    let body = match[2];
    if (body === "|" || body === "|-" || body === ">" || body === ">-") {
      const parts = [];
      while (i + 1 < lines.length) {
        const next = lines[i + 1];
        if (next.trim() === "") {
          i += 1;
          continue;
        }
        const nextIndent = (/^ */.exec(next) || [""])[0].length;
        if (nextIndent <= indent) break;
        i += 1;
        parts.push(next.slice(nextIndent));
      }
      body = parts.join("\n");
    }
    for (const line of body.split("\n")) {
      if (line.trim()) bodies.push(line.trim());
    }
  }
  return bodies;
}

function sameFlags(actual, expected) {
  return actual.length === expected.length && actual.every((flag, i) => flag === expected[i]);
}

function candidateMap(parsed, label) {
  const map = new Map();
  for (const item of parsed) {
    if (!CANDIDATE_NAMES.includes(item.name)) continue;
    if (map.has(item.name)) {
      throw new Error(`${label} 候选门重复:${item.name}`);
    }
    map.set(item.name, item.flags);
  }
  for (const name of CANDIDATE_NAMES) {
    if (!map.has(name)) {
      throw new Error(`${label} 缺少候选门 ${name}`);
    }
  }
  return map;
}

const sources = [
  {
    label: "justfile ci-node",
    kind: "local",
    parsed: collectTracked(justRecipeCommands(readRel("justfile"), "ci-node"))
  },
  {
    label: "package.json ci:node",
    kind: "local",
    parsed: collectTracked(packageScriptCommands(readRel("package.json"), "ci:node"))
  },
  {
    label: "ci.yml node",
    kind: "hosted",
    parsed: collectTracked(yamlRunBodies(yamlJobBlock(readRel(".github/workflows/ci.yml"), "node")))
  },
  {
    label: "release.yml quality-node",
    kind: "hosted",
    parsed: collectTracked(
      yamlRunBodies(yamlJobBlock(readRel(".github/workflows/release.yml"), "quality-node"))
    )
  }
];

const maps = sources.map((source) => ({
  ...source,
  map: candidateMap(source.parsed, source.label)
}));
const expected = CANDIDATE_NAMES.join("\n");
for (const source of maps) {
  const names = [...source.map.keys()].sort().join("\n");
  if (names !== [...CANDIDATE_NAMES].sort().join("\n")) {
    fail(`${source.label} 候选命令名集合不等`);
  }
  const claimsFlags = source.map.get("node scripts/check-active-claims.mjs");
  if (claimsFlags.length > 0) {
    fail(`${source.label} check-active-claims 不得带 flag`);
  }
  const privacyFlags = source.map.get("node scripts/check-public-tree-privacy.mjs");
  const extra = privacyFlags.filter(
    (flag, i, arr) =>
      flag !== "--allow-missing-probes" && flag !== "--ref" && (i === 0 || arr[i - 1] !== "--ref")
  );
  if (extra.length > 0) {
    fail(`${source.label} 隐私扫描含未白名单 flag:${extra.join(" ")}`);
  }
  const expectedFlags = source.kind === "local" ? LOCAL_PRIVACY_FLAGS : HOSTED_PRIVACY_FLAGS;
  if (!sameFlags(privacyFlags, expectedFlags)) {
    fail(`${source.label} 隐私扫描 flag 形态不正确`);
  }
}

process.stdout.write(`[ok] gate-list-parity ${expected.replaceAll("\n", " ; ")}\n`);
