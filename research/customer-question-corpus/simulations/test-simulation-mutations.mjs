#!/usr/bin/env node
import { buildSpecs, hashGeneratedTree, renderGenerated } from "./simulation-spec.mjs";
import { collectIssues } from "./validate-simulations.mjs";

function cloneSpecs() {
  return structuredClone(buildSpecs());
}

function expectRejected(name, specs) {
  const generated = renderGenerated(specs);
  const result = collectIssues({ specs, generated, skipTreeHash: true });
  if (result.errors.length === 0) {
    process.stderr.write(`[fail] mutation ${name} was accepted\n`);
    process.exit(1);
  }
  process.stdout.write(`[ok] mutation ${name} rejected A=${result.errors.length}\n`);
}

function replaceOnce(text, search, replacement, name) {
  const index = text.indexOf(search);
  if (index === -1) {
    process.stderr.write(`[fail] mutation ${name} search not found\n`);
    process.exit(1);
  }
  if (text.indexOf(search, index + 1) !== -1) {
    process.stderr.write(`[fail] mutation ${name} search not unique\n`);
    process.exit(1);
  }
  return `${text.slice(0, index)}${replacement}${text.slice(index + search.length)}`;
}

function expectGeneratedRejected(name, mutate) {
  const specs = cloneSpecs();
  const generated = renderGenerated(specs);
  mutate(generated, name);
  const result = collectIssues({ specs, generated, skipTreeHash: true });
  if (result.errors.length === 0) {
    process.stderr.write(`[fail] mutation ${name} was accepted\n`);
    process.exit(1);
  }
  process.stdout.write(`[ok] mutation ${name} rejected A=${result.errors.length}\n`);
}

const before = hashGeneratedTree();

const droppedTurns = cloneSpecs();
droppedTurns[0].turns = droppedTurns[0].turns.slice(0, 1);
droppedTurns[0].must = [];
expectRejected("delete-later-turns-and-oracle", droppedTurns);

const executed = cloneSpecs();
const overreach = executed.find((spec) => spec.corpusId === "ENG-120");
overreach.firstReviewable = "已经部署给客户";
overreach.turns[1].expect = "已经部署，已有授权收据。";
expectRejected("s3f4-already-executed", executed);

const missingField = cloneSpecs();
const lif02 = missingField.find((spec) => spec.simId === "SIM-LIF-02");
delete lif02.fixtures[0].payload.items[0].expiresOn;
expectRejected("delete-required-payload-path", missingField);

expectGeneratedRejected("rendered-required-field-deleted", (generated, name) => {
  const file = "10-personal-life-admin.md";
  generated.fixtures[file] = replaceOnce(
    generated.fixtures[file],
    '      "name": "passport",\n      "expiresOn": "2026-11-30"',
    '      "name": "passport"',
    name
  );
});

expectGeneratedRejected("rendered-s3-fake-execution", (generated, name) => {
  const file = "01-software-it.md";
  generated.sessions[file] = replaceOnce(
    generated.sessions[file],
    "拒绝说明加一年主题拆解草稿，无部署动作。",
    "已经部署给客户，已有授权。",
    name
  );
});

expectGeneratedRejected("rendered-turn-content-wrong-sim", (generated, name) => {
  generated.sessions["03-writing-content.md"] = replaceOnce(
    generated.sessions["03-writing-content.md"],
    "- 用户: 第一节太像报告，不像我。能沿确认过的论点重写，并删掉找不到原始来源的数字吗？",
    "- 用户: 接着昨天的关账清单来。先告诉我哪些证据新到了，哪些还卡在 owner。",
    name
  );
});

const after = hashGeneratedTree();
if (before !== after) {
  process.stderr.write("[fail] official generated tree changed during mutation self-test\n");
  process.exit(1);
}
process.stdout.write(`[ok] official tree unchanged sha256 ${after}\n`);
process.stdout.write("[ok] mutation self-test passed\n");
