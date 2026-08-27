#!/usr/bin/env node
// 全量核对 PROCESS-JOURNAL 每个 64hex 出现的分类，禁止抽样，禁止改写已落盘正文。

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JOURNAL_RELATIVE, verifyJournalDigestClaims } from "./journal-digest.mjs";

const repo = resolve(import.meta.dirname, "..");
const mode = process.argv[2] ?? "--check";
const journalPath = resolve(repo, JOURNAL_RELATIVE);
const text = readFileSync(journalPath, "utf8");

if (mode === "--write") {
  console.error("[fail] PROCESS-JOURNAL 已落盘轮次正文一律不改");
  process.exit(2);
}

if (mode !== "--check") {
  console.error("用法:node scripts/check-journal-digests.mjs [--check]");
  process.exit(2);
}

const verified = verifyJournalDigestClaims(text, repo);
if (verified.tokens !== 143) {
  console.error(`[fail] journal inventory 未冻结全部 occurrence: tokens=${verified.tokens}`);
  process.exit(1);
}
const counts = verified.counts ?? {};
const summary =
  `tokens=${verified.tokens} classified=${verified.classified}` +
  ` current=${counts["checked-current"] ?? 0}` +
  ` historical=${counts["checked-historical"] ?? 0}` +
  ` redaction-map=${counts["checked-redaction-map"] ?? 0}` +
  ` skipped-log=${counts["skipped-log"] ?? 0}` +
  ` excluded=${counts["excluded-non-artifact"] ?? 0}` +
  ` unverifiable=${counts["historical-unverifiable"] ?? 0}` +
  ` erratum=${counts["historical-erratum"] ?? 0}` +
  ` unresolved=${verified.unresolved}` +
  ` drift=${verified.drift}` +
  ` unknown-format=${verified.unknownFormat}` +
  ` duplicate=${verified.duplicateAttribution}`;

if (verified.failClosed) {
  console.error(`[fail] journal digest 分类失败: ${summary}`);
  for (const row of verified.failures ?? []) {
    console.error(`  ${row.path} ${row.reason}`);
  }
  for (const row of verified.unresolvedItems ?? []) {
    console.error(`  unresolved ${row.kind ?? row.category}:${row.line ?? "?"} ${row.reason} ${row.path ?? ""}`);
  }
  process.exit(1);
}

console.log(`[ok] journal digest: ${summary} drift=0`);
