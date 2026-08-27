#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { buildSpecs } from "../simulations/simulation-spec.mjs";
import {
  EVIDENCE_MAP,
  resolveAnchor,
  buildEvidenceMap,
  parseCorpusRecordsForEvidence
} from "./perturbation-evidence.mjs";
import { runIndependentOracle } from "./independent-oracle.mjs";
import {
  buildDryRun,
  defaultCorpusRoot,
  hashAuthorityInputs,
  hashCorpusSourceTree,
  listAuthorityRelativePaths
} from "./dry-run-model.mjs";
import { collectDryRunIssues } from "./validate-three-pass-dry-run.mjs";
import { renderResult, renderSolution } from "./dry-run-render.mjs";

function replaceOnce(text, search, replacement, name) {
  const index = text.indexOf(search);
  if (index === -1) throw new Error(`mutation ${name} 未命中: ${search.slice(0, 80)}`);
  if (text.indexOf(search, index + 1) !== -1) throw new Error(`mutation ${name} 命中不唯一`);
  return `${text.slice(0, index)}${replacement}${text.slice(index + search.length)}`;
}

function expectRejected(name, mutate) {
  const root = defaultCorpusRoot();
  const model = buildDryRun(root);
  let resultText = renderResult(model);
  let solutionText = renderSolution(model);
  const mutated = mutate({ resultText, solutionText, model });
  const issues = collectDryRunIssues({
    corpusRoot: root,
    resultText: mutated.resultText ?? resultText,
    solutionText: mutated.solutionText ?? solutionText,
    model
  });
  if (issues.errors.length === 0) {
    process.stderr.write(`[fail] mutation ${name} was accepted\n`);
    process.exit(1);
  }
  process.stdout.write(`[ok] mutation ${name} rejected A=${issues.errors.length}\n`);
}

function mutateRowCell(resultText, name, cellIndex, value) {
  const line = resultText.split("\n").find((item) => item.startsWith("| ENG-002 |"));
  if (!line) throw new Error(`mutation ${name} 找不到 ENG-002 行`);
  const cells = line.split("|");
  cells[cellIndex] = ` ${value} `;
  return replaceOnce(resultText, line, cells.join("|"), name);
}

function rowFieldMutations() {
  const fields = [
    ["row-ID", 1, "ENG-XXX"],
    ["row-domain", 2, "PRJ"],
    ["row-FS", 3, "F2/S0"],
    ["row-context", 4, "USER"],
    ["row-DR1", 5, "WAIT_USER"],
    ["row-DR2", 6, "PLAN_OR_HANDOFF_ONLY"],
    ["row-perturbation", 7, "F4_OVERREACH"],
    ["row-DR3", 8, "UNPROVEN_P0"],
    ["row-priority", 9, "P0"],
    ["row-issue", 10, "DR-F4-RESCOPE"],
    ["row-theoretical", 11, "计划或交接"],
    ["row-evidence", 12, "PROVEN"]
  ];
  for (const [name, index, value] of fields) {
    expectRejected(name, ({ resultText }) => ({
      resultText: mutateRowCell(resultText, name, index, value)
    }));
  }
}

const sourceBefore = hashCorpusSourceTree();
rowFieldMutations();

expectRejected("summary-F1", ({ resultText }) => ({
  resultText: replaceOnce(resultText, "| F1 | 46 |", "| F1 | 45 |", "summary-F1")
}));
expectRejected("summary-LIVE", ({ resultText }) => ({
  resultText: replaceOnce(resultText, "LIVE 逐对象合同：465 条", "LIVE 逐对象合同：464 条", "summary-LIVE")
}));
expectRejected("summary-DR3", ({ resultText, model }) => ({
  resultText: replaceOnce(
    resultText,
    `| REPLAY_PASS | ${model.summary.DR3.REPLAY_PASS} |`,
    `| REPLAY_PASS | ${model.summary.DR3.REPLAY_PASS - 1} |`,
    "summary-DR3"
  )
}));
expectRejected("summary-issue", ({ resultText, model }) => ({
  resultText: replaceOnce(
    resultText,
    `| DR-CTX-AUTHORITY-STALE | ${model.summary.issueCodes["DR-CTX-AUTHORITY-STALE"]} |`,
    `| DR-CTX-AUTHORITY-STALE | ${model.summary.issueCodes["DR-CTX-AUTHORITY-STALE"] - 1} |`,
    "summary-issue"
  )
}));
expectRejected("summary-domain", ({ resultText }) => ({
  resultText: replaceOnce(resultText, "| ENG | 软件工程与 IT | 120 |", "| ENG | 软件工程与 IT | 119 |", "summary-domain")
}));

expectRejected("list-GO", ({ resultText }) => ({
  resultText: replaceOnce(resultText, "- `ENG-002`\n", "- `ENG-999`\n", "list-GO")
}));
expectRejected("list-F4", ({ resultText }) => ({
  resultText: resultText.replace("- `ENG-120`\n", "")
}));
expectRejected("list-replay", ({ resultText }) => {
  const block = resultText.split("### 所选扰动已被 simulation 证明（replay）")[1].split("## ")[0];
  const first = block.match(/- `([A-Z]{3}-\d{3})`/);
  return { resultText: replaceOnce(resultText, `- \`${first[1]}\`\n`, "", "list-replay") };
});
expectRejected("list-P0", ({ resultText }) => {
  const block = resultText.split("<!-- corpus:dry-run-p0:begin -->")[1];
  const first = block.match(/- `([A-Z]{3}-\d{3})`/);
  return { resultText: replaceOnce(resultText, `- \`${first[1]}\`\n`, "", "list-P0") };
});
expectRejected("list-P1", ({ resultText }) => {
  const block = resultText.split("<!-- corpus:dry-run-p1:begin -->")[1];
  const first = block.match(/- `([A-Z]{3}-\d{3})`/);
  return { resultText: replaceOnce(resultText, `- \`${first[1]}\`\n`, "", "list-P1") };
});

expectRejected("p0-generic", ({ solutionText }) => ({
  solutionText: solutionText.replace(
    /<!-- corpus:dry-run-p0-body:begin -->[\s\S]*<!-- corpus:dry-run-p0-body:end -->/u,
    "<!-- corpus:dry-run-p0-body:begin -->\n通用占位\n<!-- corpus:dry-run-p0-body:end -->"
  )
}));

expectRejected("p1-delete-row", ({ solutionText }) => {
  const block = solutionText.split("<!-- corpus:dry-run-p1-body:begin -->")[1];
  const line = block.split("\n").find((item) => /^\| [A-Z]{3}-\d{3} \|/u.test(item));
  return { solutionText: replaceOnce(solutionText, `${line}\n`, "", "p1-delete-row") };
});

expectRejected("delete-issue-heading", ({ solutionText }) => ({
  solutionText: replaceOnce(solutionText, "### `DR-USER-INPUT` USER 输入包缺失", "### `DR-USER-INPUT-X` USER 输入包缺失", "delete-issue-heading")
}));

expectRejected("ctx-missing-code", ({ resultText }) => {
  const line = resultText.split("\n").find((item) => item.includes("DR-CTX-AUTHORITY-STALE") && /^\| [A-Z]{3}-\d{3} \|/u.test(item));
  return { resultText: replaceOnce(resultText, line, line.replace("DR-CTX-AUTHORITY-STALE,", "").replace(",DR-CTX-AUTHORITY-STALE", "").replace("DR-CTX-AUTHORITY-STALE", "DR-F2-CONDITIONAL"), "ctx-missing-code") };
});

expectRejected("ctx-delete-valid-until", ({ solutionText }) => ({
  solutionText: replaceOnce(solutionText, "| `valid_until` |", "| `valid_until_x` |", "ctx-delete-valid-until")
}));
expectRejected("long-delete-idempotency", ({ solutionText }) => ({
  solutionText: replaceOnce(solutionText, "| `idempotency_keys` |", "| `idempotency_keys_x` |", "long-delete-idempotency")
}));
expectRejected("multi-delete-dag", ({ solutionText }) => ({
  solutionText: replaceOnce(solutionText, "| `tool_dependency_dag` |", "| `tool_dependency_dag_x` |", "multi-delete-dag")
}));
expectRejected("multi-delete-reconcile", ({ solutionText }) => ({
  solutionText: replaceOnce(solutionText, "| `manual_reconcile_status` |", "| `manual_reconcile_status_x` |", "multi-delete-reconcile")
}));

const specs = buildSpecs();
const covered = EVIDENCE_MAP.find((item) => item.covered_perturbations.includes("LIVE_PERMISSION_DENIED"));
if (!covered) {
  process.stderr.write("[fail] 找不到 LIVE_PERMISSION_DENIED 证据条目\n");
  process.exit(1);
}
const spec = specs.find((item) => item.simId === covered.sim_id);
const mutatedSpec = structuredClone(spec);
mutatedSpec.failure.inject = mutatedSpec.failure.inject.replace("permission_denied", "empty");
let injectRejected = false;
for (const perturbationId of covered.covered_perturbations) {
  for (const anchor of covered.evidence_refs[perturbationId] ?? []) {
    try {
      resolveAnchor(mutatedSpec, anchor);
    } catch {
      injectRejected = true;
    }
  }
}
if (!injectRejected) {
  mutatedSpec.failure.recover = "占位恢复";
  for (const perturbationId of covered.covered_perturbations) {
    for (const anchor of covered.evidence_refs[perturbationId] ?? []) {
      try {
        resolveAnchor(mutatedSpec, anchor);
      } catch {
        injectRejected = true;
      }
    }
  }
}
if (!injectRejected) {
  process.stderr.write("[fail] mutation spec-inject-mismatch was accepted\n");
  process.exit(1);
}
process.stdout.write("[ok] mutation spec-inject-mismatch rejected A=1\n");

{
  const allSpecs = buildSpecs();
  const allRecords = parseCorpusRecordsForEvidence();
  const loosened = buildEvidenceMap(allSpecs, allRecords, {
    livePermissionNeedles: ["permission_denied", "empty"]
  });
  const looseOutcome = await runIndependentOracle({ evidenceMapForCrossCheck: loosened });
  if (looseOutcome.errors.length === 0) {
    process.stderr.write("[fail] mutation evidence-loosen-live-empty was accepted\n");
    process.exit(1);
  }
  process.stdout.write(`[ok] mutation evidence-loosen-live-empty rejected A=${looseOutcome.errors.length}\n`);

  const tightened = buildEvidenceMap(allSpecs, allRecords, {
    longRunRequireLifecycle: true
  });
  const tightOutcome = await runIndependentOracle({ evidenceMapForCrossCheck: tightened });
  if (tightOutcome.errors.length === 0) {
    process.stderr.write("[fail] mutation evidence-tighten-long-lifecycle was accepted\n");
    process.exit(1);
  }
  process.stdout.write(`[ok] mutation evidence-tighten-long-lifecycle rejected A=${tightOutcome.errors.length}\n`);
}

const root = defaultCorpusRoot();
const baselineHash = hashAuthorityInputs(root);
const overlay = new Map();
const rel = listAuthorityRelativePaths(root).find((item) => item.endsWith("00-能力边界.md"));
const original = readFileSync(join(resolve(root, "../.."), rel), "utf8");
overlay.set(rel, `${original}\n# mutation\n`);
const mutatedHash = hashAuthorityInputs(root, { overlay });
if (mutatedHash === baselineHash) {
  process.stderr.write("[fail] mutation authority-overlay-hash was accepted\n");
  process.exit(1);
}
process.stdout.write("[ok] mutation authority-overlay-hash rejected A=1\n");

const docsRel = listAuthorityRelativePaths(root).find((item) => item.endsWith("10-voice-ux-spec.md"));
const docsOverlay = new Map([[docsRel, `${readFileSync(join(resolve(root, "../.."), docsRel), "utf8")}\n# x\n`]]);
if (hashAuthorityInputs(root, { overlay: docsOverlay }) === baselineHash) {
  process.stderr.write("[fail] mutation authority-docs-hash was accepted\n");
  process.exit(1);
}
process.stdout.write("[ok] mutation authority-docs-hash rejected A=1\n");

const simRel = listAuthorityRelativePaths(root).find((item) => item.endsWith("simulation-spec.mjs"));
const simOverlay = new Map([[simRel, `${readFileSync(join(resolve(root, "../.."), simRel), "utf8")}\n`]]);
if (hashAuthorityInputs(root, { overlay: simOverlay }) === baselineHash) {
  process.stderr.write("[fail] mutation authority-sim-hash was accepted\n");
  process.exit(1);
}
process.stdout.write("[ok] mutation authority-sim-hash rejected A=1\n");

const sourceAfter = hashCorpusSourceTree();
if (sourceBefore !== sourceAfter) {
  process.stderr.write("[fail] mutation runner changed source tree\n");
  process.exit(1);
}

const oracle = spawnSync(process.execPath, [join(import.meta.dirname, "independent-oracle.mjs")], {
  encoding: "utf8"
});
if (oracle.status === 0) {
  process.stdout.write("[ok] mutation independent-oracle still green on official tree\n");
} else {
  process.stderr.write("[fail] independent-oracle failed on official tree during mutation self-test\n");
  process.stderr.write(oracle.stderr || oracle.stdout || "");
  process.exit(1);
}

process.stdout.write(`[ok] official tree unchanged sha256 ${sourceAfter}\n`);
process.stdout.write("[ok] mutation self-test passed\n");
