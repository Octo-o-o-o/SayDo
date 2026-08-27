#!/usr/bin/env node
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  DOMAIN_FILES,
  buildSpecs,
  hashGeneratedTree,
  renderCoverage,
  renderFixtures,
  renderSession,
  simulationsRoot
} from "./simulation-spec.mjs";

const root = simulationsRoot();
const sessionsDir = join(root, "sessions");
const fixturesDir = join(root, "fixtures");
const coveragePath = join(root, "02-coverage.md");

const specs = buildSpecs();
const byDomain = new Map();
for (const spec of specs) {
  const list = byDomain.get(spec.source.domain) || [];
  list.push(spec);
  byDomain.set(spec.source.domain, list);
}

rmSync(sessionsDir, { recursive: true, force: true });
rmSync(fixturesDir, { recursive: true, force: true });
mkdirSync(sessionsDir, { recursive: true });
mkdirSync(fixturesDir, { recursive: true });

for (const [domain, meta] of Object.entries(DOMAIN_FILES)) {
  const list = byDomain.get(domain) || [];
  writeFileSync(join(sessionsDir, meta.file), list.map(renderSession).join("\n"), "utf8");
  writeFileSync(join(fixturesDir, meta.file), renderFixtures(domain, list), "utf8");
}
writeFileSync(coveragePath, renderCoverage(specs), "utf8");

const digest = hashGeneratedTree();
process.stdout.write(`[ok] rebuilt ${specs.length} sessions; tree sha256 ${digest}\n`);
