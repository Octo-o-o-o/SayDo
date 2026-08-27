#!/usr/bin/env node
// 发布边界命令的结构化解析:只认会真正执行的 invocation,注释/echo/heredoc/|| true 不算。

export const REQUIRED_CI_GATE_COMMANDS = Object.freeze([
  "node scripts/test-public-tree-boundary.mjs",
  "node scripts/test-public-text-redaction.mjs",
  "node scripts/test-public-tree-privacy.mjs",
  "node scripts/test-journal-digests.mjs",
  "node scripts/check-journal-digests.mjs",
  "node scripts/test-historical-markdown-redact.mjs",
  "node scripts/test-week-audit-boundary.mjs",
  "node scripts/test-doc-links.mjs",
  "node scripts/check-doc-links.mjs",
  "node scripts/week-audit.mjs --check-bundle",
  "node scripts/test-ios-artifact-policy.mjs",
  "node scripts/test-release-provenance.mjs"
]);

const ECHO_LIKE = new Set(["echo", "printf", "cat", "true"]);

function stripLineComment(line) {
  const value = String(line);
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle && value[i - 1] !== "\\") inDouble = !inDouble;
    else if (ch === "#" && !inSingle && !inDouble) return value.slice(0, i).trimEnd();
  }
  return value;
}

function splitAndChain(command) {
  const value = stripLineComment(String(command).trim());
  if (value === "") return [];
  return value
    .split(/&&/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function firstToken(command) {
  const match = /^(\S+)/.exec(String(command).trim());
  return match ? match[1] : "";
}

function isFailSoft(command) {
  return /(?:^|[\s;])\|\|\s*(true|:|exit\s+0)(?:\s|;|$)/.test(String(command));
}

export function activeCommandsFromShellLine(line) {
  const trimmed = String(line).trim();
  if (trimmed === "" || trimmed.startsWith("#")) return [];
  const parts = splitAndChain(trimmed);
  const active = [];
  for (const part of parts) {
    if (part.startsWith("#") || isFailSoft(part)) continue;
    const token = firstToken(part);
    if (ECHO_LIKE.has(token)) continue;
    active.push(part);
  }
  return active;
}

function dropHeredocLines(lines) {
  const out = [];
  let terminator = null;
  for (const line of lines) {
    if (terminator != null) {
      if (line.trim() === terminator) terminator = null;
      continue;
    }
    const heredoc = /<<[-]?['"]?([A-Za-z_][A-Za-z0-9_]*)['"]?\s*$/.exec(line);
    if (heredoc) {
      terminator = heredoc[1];
      const prefix = line.slice(0, heredoc.index).trim();
      if (prefix) out.push(prefix);
      continue;
    }
    out.push(line);
  }
  return out;
}

export function parseJustCiNodeCommands(justfile) {
  const lines = String(justfile).split("\n");
  const start = lines.findIndex((line) => /^ci-node:\s*$/.test(line));
  if (start < 0) return [];
  const body = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^[A-Za-z0-9_:-]+:/.test(lines[i])) break;
    body.push(lines[i]);
  }
  const commands = [];
  for (const line of dropHeredocLines(body)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    commands.push(...activeCommandsFromShellLine(trimmed.replace(/^@/, "")));
  }
  return commands;
}

export function parsePackageCiNodeCommands(packageJson) {
  const script = typeof packageJson === "string" ? JSON.parse(packageJson).scripts?.["ci:node"] : packageJson?.scripts?.["ci:node"];
  if (typeof script !== "string" || script.trim() === "") return [];
  const commands = [];
  for (const line of dropHeredocLines(script.split("\n"))) {
    commands.push(...activeCommandsFromShellLine(line));
  }
  return commands;
}

function extractYamlJob(text, jobName) {
  const lines = String(text).split("\n");
  const start = lines.findIndex((line) => line === `  ${jobName}:`);
  if (start < 0) return "";
  const body = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^  [A-Za-z0-9_-]+:\s*$/.test(lines[i])) break;
    body.push(lines[i]);
  }
  return body.join("\n");
}

export function parseWorkflowRunCommands(yamlText, jobName) {
  const job = extractYamlJob(yamlText, jobName);
  if (job === "") return [];
  const lines = job.split("\n");
  const collected = [];
  let inRunBlock = false;
  let runIndent = 0;
  for (const line of lines) {
    const indent = line.match(/^ */)[0].length;
    const trimmed = line.trim();
    if (inRunBlock) {
      if (trimmed === "") continue;
      if (indent > runIndent && !trimmed.startsWith("#")) collected.push(trimmed);
      if (indent > runIndent) continue;
      inRunBlock = false;
    }
    const run = /^(?:-\s+)?run:\s*(.*)$/.exec(trimmed);
    if (!run) continue;
    const rest = run[1];
    if (rest === "|" || rest === "|-" || rest === ">" || rest === ">-" || rest.startsWith("|") || rest.startsWith(">")) {
      inRunBlock = true;
      runIndent = indent;
      continue;
    }
    if (rest) collected.push(rest);
  }
  const commands = [];
  for (const line of dropHeredocLines(collected)) {
    commands.push(...activeCommandsFromShellLine(line));
  }
  return commands;
}

export function jobHasActiveFetchDepthZero(yamlText, jobName) {
  const job = extractYamlJob(yamlText, jobName);
  return job.split("\n").some((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) return false;
    return /^fetch-depth:\s*0$/.test(trimmed);
  });
}

function requiredSequence(commands) {
  return commands.filter((command) => REQUIRED_CI_GATE_COMMANDS.includes(command));
}

export function verifyCommandSurface(label, commands) {
  const missing = [];
  const extraDup = [];
  const sequence = requiredSequence(commands);
  for (const required of REQUIRED_CI_GATE_COMMANDS) {
    const count = commands.filter((command) => command === required).length;
    if (count === 0) missing.push(`${label}:${required}`);
    else if (count !== 1) extraDup.push(`${label}:duplicate:${required}`);
  }
  return { missing, extraDup, sequence };
}

export function verifyCiGateEquivalence({ justfile, packageJson, ciYml, releaseYml }) {
  const justCmds = parseJustCiNodeCommands(justfile);
  const pkgCmds = parsePackageCiNodeCommands(packageJson);
  const ciCmds = parseWorkflowRunCommands(ciYml, "node");
  const releaseCmds = parseWorkflowRunCommands(releaseYml, "quality-node");
  const missing = [];
  const extraDup = [];
  const sequences = {};
  for (const [label, commands] of [
    ["justfile", justCmds],
    ["package.json", pkgCmds],
    ["ci.yml", ciCmds],
    ["release.yml", releaseCmds]
  ]) {
    const result = verifyCommandSurface(label, commands);
    missing.push(...result.missing);
    extraDup.push(...result.extraDup);
    sequences[label] = result.sequence;
  }
  const reference = sequences.justfile.join("\n");
  for (const [label, sequence] of Object.entries(sequences)) {
    if (sequence.join("\n") !== reference) extraDup.push(`${label}:order-mismatch`);
  }
  if (!jobHasActiveFetchDepthZero(ciYml, "node")) missing.push("ci.yml:fetch-depth 0");
  if (!jobHasActiveFetchDepthZero(releaseYml, "quality-node")) missing.push("release.yml:fetch-depth 0");
  const publishJob = extractYamlJob(releaseYml, "publish");
  if (!publishJob.includes("quality-node") || !/needs:\s*\[/.test(publishJob)) {
    missing.push("release.yml:publish needs quality-node");
  }
  const failures = [...missing, ...extraDup];
  return {
    ok: failures.length === 0,
    failures,
    counts: {
      required: REQUIRED_CI_GATE_COMMANDS.length,
      just: sequences.justfile.length,
      pkg: sequences["package.json"].length,
      ci: sequences["ci.yml"].length,
      release: sequences["release.yml"].length
    }
  };
}
