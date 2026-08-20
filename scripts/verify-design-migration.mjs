#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

const [command, sourceArg, targetArg, manifestArg] = process.argv.slice(2);
if (!["write", "check"].includes(command) || !sourceArg || !targetArg || !manifestArg) {
  console.error("用法:verify-design-migration.mjs <write|check> <source-dir> <target-dir> <manifest-file>");
  process.exit(2);
}

const sourceRoot = resolve(sourceArg);
const targetRoot = resolve(targetArg);
const manifestFile = resolve(manifestArg);
const mappings = [];

const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const normalized = (path) => path.replaceAll("\\", "/");
const mode = (stat) => (stat.mode & 0o7777).toString(8).padStart(4, "0");

const add = (source, target, sourceOnDisk = source) => {
  mappings.push({
    source: normalized(source),
    target: normalized(target),
    sourceOnDisk: normalized(sourceOnDisk)
  });
};

const walk = (rootRelative, filter = () => true) => {
  const root = join(sourceRoot, rootRelative);
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "en"))) {
      const absolute = join(dir, entry.name);
      const source = normalized(relative(sourceRoot, absolute));
      if (entry.isDirectory()) {
        visit(absolute);
      } else if (entry.isFile() && filter(source)) {
        add(source, source);
      }
    }
  };
  visit(root);
};

walk("docs", (path) => path !== "docs/.DS_Store" && !path.startsWith("docs/adr/"));
add("docs/adr/ADR-001-execution-layer.md", "docs/adr/design/ADR-001-execution-layer.md");
for (const dir of ["demo", "templates", "history", "prompts", "assets"]) {
  walk(dir, (path) => basename(path) !== ".DS_Store");
}
walk(
  "research",
  (path) =>
    basename(path) !== ".DS_Store" &&
    !path.endsWith(".log") &&
    !path.split("/").includes("node_modules")
);

for (const entry of readdirSync(sourceRoot, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  if (
    /^IMPLEMENTATION-PLAN.*\.md$/.test(entry.name) ||
    /^IMPL-PROMPT.*\.md$/.test(entry.name) ||
    entry.name === "REPO-MERGE-PROPOSAL.md"
  ) {
    add(entry.name, `docs/plan/${entry.name}`);
  }
}

add("saydo-review-readback.cursor.md", "history/reviews/saydo-review-readback.cursor.md");
add("saydo-value-gaps-review.cursor.md", "history/reviews/saydo-value-gaps-review.cursor.md");
add("archive/README.md", "history/legacy-archive/README.md");
add(
  "archive/voice-agent-orchestrator.cursor.md",
  "history/legacy-archive/voice-agent-orchestrator.cursor.md"
);
add(
  "README.md",
  "docs/plan/migration/voice-coding-README.prearchive.md",
  existsSync(join(sourceRoot, "README.prearchive.md")) ? "README.prearchive.md" : "README.md"
);
add(
  "AGENTS.md",
  "docs/plan/migration/voice-coding-AGENTS.prearchive.md",
  existsSync(join(sourceRoot, "AGENTS.prearchive.md")) ? "AGENTS.prearchive.md" : "AGENTS.md"
);

mappings.sort((a, b) => a.source.localeCompare(b.source, "en"));
const rows = [
  "source_sha256\tsource_bytes\tsource_mode\ttarget_sha256\ttarget_bytes\ttarget_mode\tcontent_mode\tsource_path\tsource_on_disk_path\ttarget_path"
];

for (const mapping of mappings) {
  const source = join(sourceRoot, mapping.sourceOnDisk);
  const target = join(targetRoot, mapping.target);
  const sourceStat = lstatSync(source);
  const targetStat = lstatSync(target);
  if (!sourceStat.isFile() || !targetStat.isFile()) {
    throw new Error(`迁移映射不是普通文件:${mapping.source} -> ${mapping.target}`);
  }
  const sourceSha = sha256(source);
  const targetSha = sha256(target);
  rows.push(
    [
      sourceSha,
      sourceStat.size,
      mode(sourceStat),
      targetSha,
      targetStat.size,
      mode(targetStat),
      sourceSha === targetSha ? "byte-identical" : "transformed",
      mapping.source,
      mapping.sourceOnDisk,
      mapping.target
    ].join("\t")
  );
}

const content = `${rows.join("\n")}\n`;
if (command === "write") {
  writeFileSync(manifestFile, content);
  console.log(`[ok] migration manifest: ${mappings.length} mappings -> ${manifestFile}`);
  process.exit(0);
}

if (readFileSync(manifestFile, "utf8") !== content) {
  console.error("[fail] migration manifest differs from current source/target");
  process.exit(1);
}

console.log(`[ok] migration mapping verified: ${mappings.length} files`);
