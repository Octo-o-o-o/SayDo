#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  REQUIRED_CI_GATE_COMMANDS,
  parseJustCiNodeCommands,
  parsePackageCiNodeCommands,
  parseWorkflowRunCommands,
  verifyCiGateEquivalence
} from "./ci-gate-manifest.mjs";

const repo = resolve(import.meta.dirname, "..");
let pass = 0;
let fail = 0;

function assert(label, ok) {
  if (ok) {
    process.stdout.write(`[ok] ${label}\n`);
    pass += 1;
  } else {
    process.stdout.write(`[fail] ${label}\n`);
    fail += 1;
  }
}

const justfile = readFileSync(resolve(repo, "justfile"), "utf8");
const packageJson = JSON.parse(readFileSync(resolve(repo, "package.json"), "utf8"));
const ciYml = readFileSync(resolve(repo, ".github/workflows/ci.yml"), "utf8");
const releaseYml = readFileSync(resolve(repo, ".github/workflows/release.yml"), "utf8");
const real = verifyCiGateEquivalence({ justfile, packageJson, ciYml, releaseYml });
assert("production surfaces execute complete gate set", real.ok);
assert(
  "production counts match required",
  real.counts.just === REQUIRED_CI_GATE_COMMANDS.length &&
    real.counts.pkg === REQUIRED_CI_GATE_COMMANDS.length &&
    real.counts.ci === REQUIRED_CI_GATE_COMMANDS.length &&
    real.counts.release === REQUIRED_CI_GATE_COMMANDS.length
);

const commentedJust = justfile.replace(
  /^    node scripts\/test-journal-digests\.mjs$/m,
  "    # node scripts/test-journal-digests.mjs"
);
const commentOnly = verifyCiGateEquivalence({ justfile: commentedJust, packageJson, ciYml, releaseYml });
assert("comment-only justfile command is not active", commentOnly.ok === false && commentOnly.failures.some((row) => row.includes("justfile:node scripts/test-journal-digests.mjs")));

const echoPkg = {
  scripts: {
    "ci:node": String(packageJson.scripts["ci:node"]).replace(
      "node scripts/test-journal-digests.mjs &&",
      "echo node scripts/test-journal-digests.mjs &&"
    )
  }
};
const echoOnly = verifyCiGateEquivalence({ justfile, packageJson: echoPkg, ciYml, releaseYml });
assert("echo-only package command is not active", echoOnly.ok === false && echoOnly.failures.some((row) => row.includes("package.json:node scripts/test-journal-digests.mjs")));

const missingRelease = releaseYml.replace("node scripts/test-journal-digests.mjs\n", "");
const missing = verifyCiGateEquivalence({ justfile, packageJson, ciYml, releaseYml: missingRelease });
assert("missing release gate is reported", missing.ok === false && missing.failures.some((row) => row.includes("release.yml:node scripts/test-journal-digests.mjs")));

const softCi = ciYml.replace(
  "node scripts/test-journal-digests.mjs",
  "node scripts/test-journal-digests.mjs || true"
);
const soft = verifyCiGateEquivalence({ justfile, packageJson, ciYml: softCi, releaseYml });
assert("|| true is not fail-fast", soft.ok === false && soft.failures.some((row) => row.includes("ci.yml:node scripts/test-journal-digests.mjs")));

const dupJust = justfile.replace(
  "    node scripts/test-journal-digests.mjs\n",
  "    node scripts/test-journal-digests.mjs\n    node scripts/test-journal-digests.mjs\n"
);
const dup = verifyCiGateEquivalence({ justfile: dupJust, packageJson, ciYml, releaseYml });
assert("duplicated command is reported", dup.ok === false && dup.failures.some((row) => row.includes("duplicate")));

assert("comment parser ignores hashed just lines", parseJustCiNodeCommands("ci-node:\n    # node scripts/test-journal-digests.mjs\nci-python:\n").length === 0);
assert(
  "package parser ignores echo wrapper",
  !parsePackageCiNodeCommands({ scripts: { "ci:node": "echo node scripts/test-journal-digests.mjs" } }).includes(
    "node scripts/test-journal-digests.mjs"
  )
);
assert(
  "workflow parser ignores commented run",
  !parseWorkflowRunCommands("jobs:\n  node:\n    steps:\n      - run: |\n          # node scripts/test-journal-digests.mjs\n", "node").includes(
    "node scripts/test-journal-digests.mjs"
  )
);

process.stdout.write(`ci-gate-equivalence self-test: pass=${pass} fail=${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
