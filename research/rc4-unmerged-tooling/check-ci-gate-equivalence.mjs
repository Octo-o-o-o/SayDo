#!/usr/bin/env node
// 本地 just ci / package.json ci:node / GitHub ci.yml / release.yml 的发布边界必须同集且为真实 invocation。
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { verifyCiGateEquivalence } from "./ci-gate-manifest.mjs";

const repo = resolve(import.meta.dirname, "..");
const result = verifyCiGateEquivalence({
  justfile: readFileSync(resolve(repo, "justfile"), "utf8"),
  packageJson: JSON.parse(readFileSync(resolve(repo, "package.json"), "utf8")),
  ciYml: readFileSync(resolve(repo, ".github/workflows/ci.yml"), "utf8"),
  releaseYml: readFileSync(resolve(repo, ".github/workflows/release.yml"), "utf8")
});
if (!result.ok) {
  console.error(`[fail] ci gate equivalence missing ${result.failures.length}`);
  for (const row of result.failures) console.error(`  ${row}`);
  process.exit(1);
}
console.log(
  `[ok] ci gate equivalence required=${result.counts.required} just=${result.counts.just} pkg=${result.counts.pkg} ci=${result.counts.ci} release=${result.counts.release}`
);
