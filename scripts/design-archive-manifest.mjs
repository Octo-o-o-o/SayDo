#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  lstatSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  writeFileSync
} from "node:fs";
import { relative, resolve } from "node:path";

const usage = () => {
  console.error(
    "用法:\n" +
      "  design-archive-manifest.mjs write <archive-dir> <manifest-file>\n" +
      "  design-archive-manifest.mjs check <archive-dir> <manifest-file> [allow-path ...]"
  );
  process.exit(2);
};

const [command, archiveArg, manifestArg, ...allowedArgs] = process.argv.slice(2);
if (!command || !archiveArg || !manifestArg) usage();

const archiveDir = resolve(archiveArg);
const manifestFile = resolve(manifestArg);
const allowed = new Set(allowedArgs);

const digest = (value) => createHash("sha256").update(value).digest("hex");
const mode = (stat) => (stat.mode & 0o7777).toString(8).padStart(4, "0");
const records = [];

const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    const absolute = resolve(dir, entry.name);
    const path = relative(archiveDir, absolute).replaceAll("\\", "/");
    const stat = lstatSync(absolute);
    if (stat.isDirectory()) {
      walk(absolute);
    } else if (stat.isSymbolicLink()) {
      const target = readlinkSync(absolute);
      records.push(`${digest(target)}\t${Buffer.byteLength(target)}\tL\t${mode(stat)}\t${path}`);
    } else if (stat.isFile()) {
      records.push(`${digest(readFileSync(absolute))}\t${stat.size}\tF\t${mode(stat)}\t${path}`);
    } else {
      throw new Error(`不支持的文件类型:${absolute}`);
    }
  }
};

walk(archiveDir);
const content = `${records.join("\n")}\n`;

if (command === "write") {
  writeFileSync(manifestFile, content);
  console.log(`[ok] archive manifest: ${records.length} entries -> ${manifestFile}`);
  process.exit(0);
}

if (command !== "check") usage();

const expectedRecords = readFileSync(manifestFile, "utf8")
  .split("\n")
  .filter(Boolean)
  .filter((line) => !allowed.has(line.split("\t", 5)[4]));
const actualRecords = records.filter((line) => !allowed.has(line.split("\t", 5)[4]));
const expected = expectedRecords.join("\n");
const actual = actualRecords.join("\n");

if (expected !== actual) {
  console.error("[fail] archive drift detected");
  process.exit(1);
}

console.log(`[ok] archive unchanged outside allowlist: ${actualRecords.length} entries`);
