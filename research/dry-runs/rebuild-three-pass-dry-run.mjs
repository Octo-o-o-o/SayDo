#!/usr/bin/env node
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GENERATED_AT,
  buildDryRun,
  defaultCorpusRoot,
  hashCorpusSourceTree,
  sha256Bytes
} from "./dry-run-model.mjs";
import { RESULT_NAME, SOLUTION_NAME, renderResult, renderSolution } from "./dry-run-render.mjs";
import { collectDryRunIssues } from "./validate-three-pass-dry-run.mjs";

function writeAtomically(dir, name, text) {
  const finalPath = join(dir, name);
  const tmpPath = join(dir, `${name}.building`);
  writeFileSync(tmpPath, text, "utf8");
  renameSync(tmpPath, finalPath);
  return finalPath;
}

function main() {
  const root = defaultCorpusRoot();
  const outDir = import.meta.dirname;
  mkdirSync(outDir, { recursive: true });
  const sourceBefore = hashCorpusSourceTree(root);
  const model = buildDryRun(root);
  if (model.sourceTreeSha256 !== sourceBefore) {
    throw new Error("加载过程中主语料源树摘要变化");
  }
  const resultText = renderResult(model);
  const solutionText = renderSolution(model);
  const issues = collectDryRunIssues({
    corpusRoot: root,
    resultText,
    solutionText,
    expectedSourceTree: sourceBefore,
    model
  });
  if (issues.errors.length) {
    for (const file of [join(outDir, `${RESULT_NAME}.building`), join(outDir, `${SOLUTION_NAME}.building`)]) {
      rmSync(file, { force: true });
    }
    process.stderr.write(issues.errors.map((item) => `[fail] ${item}\n`).join(""));
    process.exitCode = 1;
    return;
  }
  writeAtomically(outDir, RESULT_NAME, resultText);
  writeAtomically(outDir, SOLUTION_NAME, solutionText);
  const sourceAfter = hashCorpusSourceTree(root);
  if (sourceAfter !== sourceBefore) {
    process.stderr.write(`[fail] 生成后主语料源树变化 ${sourceBefore} -> ${sourceAfter}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write([
    `[ok] rebuilt three-pass dry run`,
    `generated_at=${GENERATED_AT}`,
    `source_tree_sha256=${sourceAfter}`,
    `authority_sha256=${model.authoritySha256}`,
    `result_sha256=${sha256Bytes(resultText)}`,
    `solution_sha256=${sha256Bytes(solutionText)}`,
    `total=${model.summary.total}`,
    `F1/F2/F3/F4=${model.summary.F.F1}/${model.summary.F.F2}/${model.summary.F.F3}/${model.summary.F.F4}`,
    `DR1 GO=${model.summary.DR1.GO} WAIT_USER=${model.summary.DR1.WAIT_USER} CONDITIONAL_ROUTE=${model.summary.DR1.CONDITIONAL_ROUTE} WAIT_CONNECTOR=${model.summary.DR1.WAIT_CONNECTOR} WAIT_USER_AND_CONNECTOR=${model.summary.DR1.WAIT_USER_AND_CONNECTOR} PLAN_ONLY=${model.summary.DR1.PLAN_ONLY} RESCOPE=${model.summary.DR1.RESCOPE}`,
    `priority replay=${model.summary.priority.replay} P0=${model.summary.priority.P0} P1=${model.summary.priority.P1} P2=${model.summary.priority.P2} P3=${model.summary.priority.P3}`,
    `evidence PROVEN=${model.summary.evidence.PROVEN} NO_EVIDENCE=${model.summary.evidence.NO_EVIDENCE} NOT_IN_SIM=${model.summary.evidence.NOT_IN_SIM}`
  ].join("\n") + "\n");
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : "";
if (invoked && fileURLToPath(import.meta.url) === invoked) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`[fail] ${error.stack || error.message}\n`);
    process.exitCode = 1;
  }
}
