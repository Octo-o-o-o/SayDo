#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DR1_STATES,
  DR2_STATES,
  DR3_STATES,
  GENERATED_AT,
  ISSUE_CODE_IDS,
  ISSUE_CODES,
  PERTURBATIONS,
  PRIORITIES,
  THEORETICAL,
  buildDryRun,
  defaultCorpusRoot,
  firstByteDiff,
  hashCorpusSourceTree,
  sha256Bytes
} from "./dry-run-model.mjs";
import { RESULT_NAME, SOLUTION_NAME, renderResult, renderSolution } from "./dry-run-render.mjs";

const FORBIDDEN = [
  { re: /语音可放行/u, message: "不得写 S3 语音可放行" },
  { re: /允许语音批准/u, message: "不得写允许语音批准" },
  { re: /ready_for_review.{0,20}已经交付/u, message: "不得把 ready_for_review 写成已经交付" },
  { re: /已经交付了/u, message: "不得把执行状态写成已经交付" },
  { re: /本轮已调用真实/u, message: "不得宣称调用了真实工具" },
  { re: /真实工具已经跑通/u, message: "不得把静态判定写成真实执行" },
  { re: /原始目标可直接执行/u, message: "不得把 F3/F4 写成原始目标可直接执行" }
];

export function extractBlock(text, name) {
  const begin = `<!-- corpus:${name}:begin -->`;
  const end = `<!-- corpus:${name}:end -->`;
  const start = text.indexOf(begin);
  const stop = text.indexOf(end);
  if (start < 0 || stop < 0 || stop <= start) return null;
  return text.slice(start + begin.length, stop);
}

export function parseMeta(text) {
  const match = text.match(/<!-- corpus:dry-run-meta\r?\n([\s\S]*?)-->/u);
  if (!match) return null;
  const meta = {};
  for (const line of match[1].split(/\r?\n/u)) {
    const item = line.match(/^([a-z0-9_]+):\s+(\S+)\s*$/u);
    if (item) meta[item[1]] = item[2];
  }
  return meta;
}

export function parseIdList(block) {
  if (!block) return [];
  return [...block.matchAll(/^- `([A-Z]{3}-\d{3})`$/gmu)].map((match) => match[1]);
}

export function parseResultRows(text) {
  const block = extractBlock(text, "dry-run-rows");
  if (block == null) return { error: "缺少 dry-run-rows 标记", rows: [] };
  const rows = [];
  const seen = new Set();
  for (const line of block.split("\n")) {
    if (!/^\| [A-Z]{3}-\d{3} \|/u.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length !== 12) {
      return { error: `${cells[0] ?? "unknown"} 逐题表不是 12 列`, rows };
    }
    const [id, domain, fs, context, dr1, dr2, perturbation, dr3, priority, issueCodes, theoretical, evidenceStatus] = cells;
    if (seen.has(id)) return { error: `逐题表重复 ID ${id}`, rows };
    seen.add(id);
    rows.push({
      id, domain, fs, context, dr1, dr2, perturbation, dr3, priority, issueCodes, theoretical, evidenceStatus, line
    });
  }
  return { error: null, rows };
}

function bump(map, key) {
  map[key] = (map[key] ?? 0) + 1;
}

function countFromRows(rows, field, keys) {
  const map = Object.fromEntries(keys.map((key) => [key, 0]));
  for (const row of rows) bump(map, row[field]);
  return map;
}

function sectionHasFields(text, heading, fields) {
  const start = text.indexOf(heading);
  if (start < 0) return { ok: false, missing: fields.slice() };
  const next = text.indexOf("\n## ", start + heading.length);
  const body = next < 0 ? text.slice(start) : text.slice(start, next);
  const missing = fields.filter((field) => !body.includes(`\`${field}\``) && !body.includes(`| \`${field}\``) && !body.includes(`| ${field} |`));
  return { ok: missing.length === 0, missing, body };
}

export function collectDryRunIssues({
  corpusRoot = defaultCorpusRoot(),
  resultText = null,
  solutionText = null,
  expectedSourceTree = null,
  model = null
} = {}) {
  const errors = [];
  const warns = [];
  const fail = (message) => errors.push(message);
  const dryRunDir = join(corpusRoot, "dry-runs");
  const result = resultText ?? readFileSync(join(dryRunDir, RESULT_NAME), "utf8");
  const solution = solutionText ?? readFileSync(join(dryRunDir, SOLUTION_NAME), "utf8");
  const sourceTree = hashCorpusSourceTree(corpusRoot);
  const judged = model ?? buildDryRun(corpusRoot);

  const renderedResult = renderResult(judged);
  const renderedSolution = renderSolution(judged);
  const resultDiff = firstByteDiff(renderedResult, result);
  if (resultDiff) {
    fail(`result 与 renderer 字节不一致 offset=${resultDiff.offset} left=${JSON.stringify(resultDiff.left)} right=${JSON.stringify(resultDiff.right)}`);
  }
  const solutionDiff = firstByteDiff(renderedSolution, solution);
  if (solutionDiff) {
    fail(`solution 与 renderer 字节不一致 offset=${solutionDiff.offset} left=${JSON.stringify(solutionDiff.left)} right=${JSON.stringify(solutionDiff.right)}`);
  }

  if (expectedSourceTree && expectedSourceTree !== sourceTree) {
    fail(`主语料源树与生成前不一致 ${expectedSourceTree} -> ${sourceTree}`);
  }
  if (judged.sourceTreeSha256 !== sourceTree) fail("模型记录的源树摘要与当前源树不一致");
  if (judged.judgments.length !== 600) fail(`判定条数不是 600: ${judged.judgments.length}`);
  if (new Set(judged.judgments.map((row) => row.id)).size !== 600) fail("判定 ID 不唯一");

  const meta = parseMeta(result);
  const solutionMeta = parseMeta(solution);
  if (!meta) fail("result 缺少 meta 注释");
  if (!solutionMeta) fail("solution 缺少 meta 注释");
  if (meta?.generated_at !== GENERATED_AT) fail(`result 生成日期不是 ${GENERATED_AT}`);
  if (solutionMeta?.generated_at !== GENERATED_AT) fail(`solution 生成日期不是 ${GENERATED_AT}`);
  if (meta?.source_tree_sha256 !== sourceTree) fail("result 源树摘要与当前源树不一致");
  if (solutionMeta?.source_tree_sha256 !== sourceTree) fail("solution 源树摘要与当前源树不一致");
  if (meta?.authority_sha256 !== judged.authoritySha256) fail("result 权威输入摘要与模型不一致");
  if (solutionMeta?.authority_sha256 !== judged.authoritySha256) fail("solution 权威输入摘要与模型不一致");

  if (!/静态判定/u.test(result) || !/未调用真实模型/u.test(result)) {
    fail("result 未声明静态、未调用真实工具的边界");
  }
  if (!/ready_for_review` 不等于交付/u.test(result) && !/ready_for_review 不等于交付/u.test(result)) {
    fail("result 未声明 ready_for_review 不等于交付");
  }
  if (!/S3 语音不得放行/u.test(result)) fail("result 未声明 S3 语音不得放行");
  if (!/禁止语音批准/u.test(solution)) fail("solution 未声明禁止语音批准");
  if (!/非 merge effect 当前仍不签发/u.test(solution)) fail("solution 未声明非 merge effect 不签发");
  if (!/generic fallback/u.test(solution)) fail("solution 未声明禁止 generic fallback 冒充闭合");
  if (!/本会话不执行/u.test(solution) && !/本会话只产出静态/u.test(solution)) {
    fail("solution 未声明本会话不执行真实运行");
  }
  if (!/从“该题是否属于 72 个 simulation”改为/u.test(result) && !/改为“该 simulation 是否证明了本行/u.test(result)) {
    fail("result 未声明 replay 判据已改为逐题扰动证据");
  }

  for (const doc of [result, solution]) {
    for (const item of FORBIDDEN) {
      if (item.re.test(doc)) fail(item.message);
    }
  }

  const parsed = parseResultRows(result);
  if (parsed.error) fail(parsed.error);
  const rows = parsed.rows;
  if (rows.length !== 600) fail(`逐题表不是 600 行: ${rows.length}`);

  for (let index = 0; index < Math.max(rows.length, judged.judgments.length); index += 1) {
    const parsedRow = rows[index];
    const expected = judged.judgments[index];
    if (!parsedRow || !expected) {
      fail(`逐题表与判定顺序在第 ${index + 1} 行错位`);
      continue;
    }
    if (parsedRow.id !== expected.id) fail(`第 ${index + 1} 行 ID ${parsedRow.id} 应为 ${expected.id}`);
    if (parsedRow.domain !== expected.domain) fail(`${expected.id} 领域字段错配`);
    if (parsedRow.fs !== `${expected.F}/${expected.S}`) fail(`${expected.id} F/S 字段错配`);
    if (parsedRow.context !== expected.context) fail(`${expected.id} 上下文字段错配`);
    if (parsedRow.dr1 !== expected.dr1) fail(`${expected.id} DR1 错配`);
    if (parsedRow.dr2 !== expected.dr2) fail(`${expected.id} DR2 错配`);
    if (parsedRow.perturbation !== expected.perturbation) fail(`${expected.id} 扰动错配`);
    if (parsedRow.dr3 !== expected.dr3) fail(`${expected.id} DR3 错配`);
    if (parsedRow.priority !== expected.priority) fail(`${expected.id} 优先级错配`);
    if (parsedRow.issueCodes !== expected.issueCodeText) fail(`${expected.id} issue code 错配`);
    if (parsedRow.theoretical !== expected.theoretical) fail(`${expected.id} 理论结论错配`);
    if (parsedRow.evidenceStatus !== expected.evidenceStatus) fail(`${expected.id} 扰动证据错配`);
    if (!DR1_STATES.includes(parsedRow.dr1)) fail(`${expected.id} DR1 非法`);
    if (!DR2_STATES.includes(parsedRow.dr2)) fail(`${expected.id} DR2 非法`);
    if (!DR3_STATES.includes(parsedRow.dr3)) fail(`${expected.id} DR3 非法`);
    if (!PRIORITIES.includes(parsedRow.priority)) fail(`${expected.id} 优先级非法`);
    if (!PERTURBATIONS[parsedRow.perturbation]) fail(`${expected.id} 扰动非法`);
    if (!Object.values(THEORETICAL).includes(parsedRow.theoretical)) fail(`${expected.id} 理论结论非法`);
    if (!["PROVEN", "NO_EVIDENCE", "NOT_IN_SIM"].includes(parsedRow.evidenceStatus)) {
      fail(`${expected.id} 扰动证据非法`);
    }
    if ((expected.F === "F3" || expected.F === "F4") && parsedRow.dr2 === "EXECUTABLE") {
      fail(`${expected.id} 把 F3/F4 写成原始目标可直接执行`);
    }
    const codes = parsedRow.issueCodes === "-" ? [] : parsedRow.issueCodes.split(",");
    for (const code of codes) {
      if (!ISSUE_CODES[code]) fail(`${expected.id} 未知 issue code ${code}`);
    }
  }

  const parsedDr1 = countFromRows(rows, "dr1", DR1_STATES);
  const parsedPriority = countFromRows(rows, "priority", PRIORITIES);
  for (const key of DR1_STATES) {
    if (parsedDr1[key] !== judged.summary.DR1[key]) {
      fail(`逐题表 DR1.${key}=${parsedDr1[key]} 与汇总 ${judged.summary.DR1[key]} 不一致`);
    }
  }
  for (const key of PRIORITIES) {
    if (parsedPriority[key] !== judged.summary.priority[key]) {
      fail(`逐题表 priority.${key}=${parsedPriority[key]} 与汇总 ${judged.summary.priority[key]} 不一致`);
    }
  }

  const fCount = { F1: 0, F2: 0, F3: 0, F4: 0 };
  for (const row of rows) bump(fCount, row.fs.slice(0, 2));
  for (const key of ["F1", "F2", "F3", "F4"]) {
    if (fCount[key] !== judged.summary.F[key]) fail(`逐题表 ${key}=${fCount[key]} 与汇总不一致`);
  }

  const evidenceCount = countFromRows(rows, "evidenceStatus", ["PROVEN", "NO_EVIDENCE", "NOT_IN_SIM"]);
  for (const key of ["PROVEN", "NO_EVIDENCE", "NOT_IN_SIM"]) {
    if (evidenceCount[key] !== judged.summary.evidence[key]) {
      fail(`逐题表证据 ${key}=${evidenceCount[key]} 与汇总不一致`);
    }
  }

  const p0 = parseIdList(extractBlock(result, "dry-run-p0"));
  const p1 = parseIdList(extractBlock(result, "dry-run-p1"));
  const noEvidence = parseIdList(extractBlock(result, "dry-run-no-evidence"));
  if (p0.join(",") !== judged.summary.p0Ids.join(",")) fail("P0 清单与判定不全等或顺序错配");
  if (p1.join(",") !== judged.summary.p1Ids.join(",")) fail("P1 清单与判定不全等或顺序错配");
  if (noEvidence.join(",") !== judged.summary.noEvidenceIds.join(",")) fail("NO_EVIDENCE 清单与判定不全等");
  const goList = parseIdList(result.split("### 当前冷启动可直接 GO")[1]?.split("### ")[0] ?? "");
  const f4List = parseIdList(result.split("### 原始目标必须拒绝/收缩（F4）")[1]?.split("### ")[0] ?? "");
  const replayList = parseIdList(result.split("### 所选扰动已被 simulation 证明（replay）")[1]?.split("## ")[0] ?? "");
  if (goList.join(",") !== judged.summary.goIds.join(",")) fail("GO 清单与判定不全等");
  if (f4List.join(",") !== judged.summary.f4Ids.join(",")) fail("F4 清单与判定不全等");
  if (replayList.join(",") !== judged.summary.replayIds.join(",")) fail("replay 清单与判定不全等");

  const ctxAssigned = judged.judgments.filter((row) => row.issueCodes.includes("DR-CTX-AUTHORITY-STALE")).map((row) => row.id);
  const ctxSource = judged.judgments.filter((row) => row.contextTokens.some((token) => token.startsWith("CTX-"))).map((row) => row.id);
  if (ctxAssigned.join(",") !== ctxSource.join(",") || ctxSource.length !== 172) {
    fail(`CTX 赋码集合不是 172 或与源记录不全等: ${ctxAssigned.length}/${ctxSource.length}`);
  }

  const p0Body = extractBlock(solution, "dry-run-p0-body") ?? "";
  for (const id of p0) {
    if (!p0Body.includes(`### \`${id}\``)) fail(`solution 缺少 P0 逐题节 ${id}`);
  }
  const p1Body = extractBlock(solution, "dry-run-p1-body") ?? "";
  for (const id of p1) {
    if (!p1Body.includes(`| ${id} |`)) fail(`solution P1 正文未覆盖 ${id}`);
  }

  const usedCodes = new Set();
  for (const row of judged.judgments) for (const code of row.issueCodes) usedCodes.add(code);
  for (const code of ISSUE_CODE_IDS) {
    if (!solution.includes(`### \`${code}\``)) fail(`solution 缺少 issue code 模板 ${code}`);
    const item = ISSUE_CODES[code];
    if (!solution.includes(item.acceptance)) fail(`solution ${code} 缺少验收门原文`);
    if (!solution.includes(item.degrade)) fail(`solution ${code} 缺少安全降级原文`);
    for (const field of item.minFields) {
      if (!solution.includes(`\`${field}\``)) fail(`solution ${code} 缺少最小字段 ${field}`);
    }
  }

  const ctxSection = sectionHasFields(solution, "## 16. CTX authority/staleness 合同", ISSUE_CODES["DR-CTX-AUTHORITY-STALE"].minFields);
  if (!ctxSection.ok) fail(`CTX 模板缺少字段: ${ctxSection.missing.join(",")}`);
  const longSection = sectionHasFields(solution, "## 9. D4/H4/R4 checkpoint、租约、暂停恢复、停止条件", ISSUE_CODES["DR-LONG-RUN-CHECKPOINT"].minFields);
  if (!longSection.ok) fail(`long 模板缺少字段: ${longSection.missing.join(",")}`);
  const multiSection = sectionHasFields(solution, "## 10. K3/K4 单工具失败和 partial result", ISSUE_CODES["DR-MULTITOOL-RECOVERY"].minFields);
  if (!multiSection.ok) fail(`multi 模板缺少字段: ${multiSection.missing.join(",")}`);

  for (const mismatch of judged.baselineMismatches) fail(`与冻结基线不一致: ${mismatch}`);
  if (!/不得放置真实 token/u.test(solution)) fail("connector 模板不得遗漏禁止真实 token");
  if (!/F3 只验 plan\/handoff/u.test(solution)) fail("分批方案未限制 F3 只验 plan/handoff");
  if (!/F4 只验拒绝/u.test(solution)) fail("分批方案未限制 F4 只验拒绝");
  if (!/S3 不做真实 effect/u.test(solution)) fail("分批方案未限制 S3 不做真实 effect");
  if (!result.includes(`sha256:${sourceTree}`)) fail("result 未记录主语料源树摘要");
  if (!result.includes(`sha256:${judged.authoritySha256}`)) fail("result 未记录权威输入摘要");

  return {
    errors,
    warns,
    sourceTreeSha256: sourceTree,
    authoritySha256: judged.authoritySha256,
    resultSha256: sha256Bytes(result),
    solutionSha256: sha256Bytes(solution),
    rowCount: rows.length,
    p0Count: p0.length,
    p1Count: p1.length,
    usedIssueCodes: [...usedCodes].sort(),
    evidence: judged.summary.evidence
  };
}

function main() {
  const issues = collectDryRunIssues();
  for (const message of issues.warns) process.stdout.write(`[warn] ${message}\n`);
  if (issues.errors.length) {
    process.stderr.write(issues.errors.map((item) => `[fail] ${item}\n`).join(""));
    process.exitCode = 1;
    return;
  }
  process.stdout.write([
    `[ok] three-pass dry run validated`,
    `source_tree_sha256=${issues.sourceTreeSha256}`,
    `authority_sha256=${issues.authoritySha256}`,
    `result_sha256=${issues.resultSha256}`,
    `solution_sha256=${issues.solutionSha256}`,
    `rows=${issues.rowCount}`,
    `P0=${issues.p0Count}`,
    `P1=${issues.p1Count}`,
    `evidence PROVEN=${issues.evidence.PROVEN} NO_EVIDENCE=${issues.evidence.NO_EVIDENCE} NOT_IN_SIM=${issues.evidence.NOT_IN_SIM}`,
    `issue_codes=${issues.usedIssueCodes.join(",")}`
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
