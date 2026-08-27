#!/usr/bin/env node
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DOMAIN_FILES,
  FAILURE_STATUS_DELTA,
  FINAL_STATES,
  LIFECYCLE,
  REQUIRED_HML,
  REQUIRED_PAYLOAD_PATHS,
  S3_F4_COMMON_MUST_NOT,
  TIMING_LEAK_FORBIDDEN,
  buildSpecs,
  hashGeneratedTree,
  parseCorpusQuestions,
  parseFixtureBlocks,
  parseSessionBlocks,
  pathExists,
  renderGenerated,
  simulationsRoot
} from "./simulation-spec.mjs";

const laterMoves = new Set(["supplement", "correct", "constraint_change", "confirm", "reject", "resume"]);
const banned = /(游戏|追剧|放歌|明星|陪伴聊天|api[_-]?key|Bearer |password\s*=|\/Users\/|诊断为|立即转账|直接付款|已完成交付)/;
const executeDone = /(已经发送|已经付款|已经部署|已经发布|已经转账|已有授权收据|WebAuthn 已通过)/;

function readGenerated(root) {
  const sessions = {};
  const fixtures = {};
  for (const meta of Object.values(DOMAIN_FILES)) {
    sessions[meta.file] = readFileSync(join(root, "sessions", meta.file), "utf8");
    fixtures[meta.file] = readFileSync(join(root, "fixtures", meta.file), "utf8");
  }
  return {
    sessions,
    fixtures,
    coverage: readFileSync(join(root, "02-coverage.md"), "utf8")
  };
}

export function collectIssues({
  specs = buildSpecs(),
  questions = parseCorpusQuestions(),
  generated = null,
  root = simulationsRoot(),
  skipTreeHash = false
} = {}) {
  const errors = [];
  const warns = [];
  const fail = (message) => errors.push(message);
  const warn = (message) => warns.push(message);
  const files = generated || readGenerated(root);

  if (specs.length !== 72) fail(`会话数不是 72: ${specs.length}`);
  if (new Set(specs.map((spec) => spec.simId)).size !== 72) fail("SIM ID 不唯一");
  if (new Set(specs.map((spec) => spec.corpusId)).size !== 72) fail("corpus ID 不唯一");

  const domainCounts = {};
  const hml = { H: 0, M: 0, L: 0 };
  const tagSets = { C: new Set(), D: new Set(), H: new Set(), R: new Set(), K: new Set(), S: new Set(), F: new Set() };
  const lifecycleCount = Object.fromEntries(Object.keys(LIFECYCLE).map((key) => [key, 0]));
  let ctx = 0;
  let user = 0;
  let live = 0;
  let dash = 0;
  let s3f4 = 0;
  let liffam = 0;
  const byCorpus = new Map();
  const sessionBlocks = new Map();
  const fixtureBlocks = new Map();

  for (const meta of Object.values(DOMAIN_FILES)) {
    for (const [simId, block] of parseSessionBlocks(files.sessions[meta.file] || "")) {
      if (sessionBlocks.has(simId)) fail(`${simId} 在多个 session 文件出现`);
      sessionBlocks.set(simId, { ...block, file: meta.file });
    }
    for (const [simId, block] of parseFixtureBlocks(files.fixtures[meta.file] || "")) {
      if (fixtureBlocks.has(simId)) fail(`${simId} 在多个 fixture 文件出现`);
      fixtureBlocks.set(simId, { ...block, file: meta.file });
    }
  }

  for (const spec of specs) {
    const src = questions.get(spec.corpusId);
    if (!src) {
      fail(`${spec.simId} 引用不存在的 corpus ID ${spec.corpusId}`);
      continue;
    }
    if (byCorpus.has(spec.corpusId)) fail(`corpus ID 重复: ${spec.corpusId}`);
    byCorpus.set(spec.corpusId, spec);
    domainCounts[src.domain] = (domainCounts[src.domain] || 0) + 1;
    hml[src.freq] += 1;
    for (const key of Object.keys(tagSets)) tagSets[key].add(src[key]);
    if (src.context.includes("CTX")) ctx += 1;
    if (src.context.includes("USER")) user += 1;
    if (src.context.includes("LIVE")) live += 1;
    if (src.context === "-") dash += 1;
    if (src.S === "S3" || src.F === "F4") s3f4 += 1;
    if (src.domain === "LIF" || src.domain === "FAM") liffam += 1;
    if (!spec.sampleReason) fail(`${spec.simId} 缺选样理由`);
    if (!spec.pretest) fail(`${spec.simId} 缺回放前状态`);
    if (!Array.isArray(spec.turns) || spec.turns.length < 3) fail(`${spec.simId} 用户轮次少于 3`);
    if (!Array.isArray(spec.must) || spec.must.length < 2) fail(`${spec.simId} 必须做到过少`);
    if (!Array.isArray(spec.mustNot) || spec.mustNot.length < 2) fail(`${spec.simId} 不得做过少`);
    if (!Array.isArray(spec.acceptable) || spec.acceptable.length < 1) fail(`${spec.simId} 缺可接受差异`);
    if (!spec.failure?.name || !spec.failure?.inject || !spec.failure?.recover) fail(`${spec.simId} 缺失败变体`);
    if (!FINAL_STATES.has(spec.finalState)) fail(`${spec.simId} 非法终态 ${spec.finalState}`);
    if (/完成|做完|已交付/.test(spec.finalState)) fail(`${spec.simId} 终态写成完成`);
    if (!Array.isArray(spec.fixtures) || spec.fixtures.length < 1) fail(`${spec.simId} 缺 fixture`);
    if (!Array.isArray(spec.lifecycle) || spec.lifecycle.length < 1) fail(`${spec.simId} 缺生命周期`);
    for (const key of spec.lifecycle) {
      if (!LIFECYCLE[key]) fail(`${spec.simId} 未知生命周期 ${key}`);
      else lifecycleCount[key] += 1;
    }
    const later = (spec.turns || []).slice(1).some((turn) => laterMoves.has(turn.move));
    if (!later) fail(`${spec.simId} 后续轮缺少补充/纠正/改约束/确认/拒绝/恢复`);
    const fixtureNames = new Set((spec.fixtures || []).map((item) => item.name));
    for (const turn of spec.turns || []) {
      if (!turn.user || !turn.expect || !turn.move) fail(`${spec.simId} 轮次缺字段`);
      if (turn.user === "好的" || turn.user === "嗯") fail(`${spec.simId} 后续轮过空`);
      if (banned.test(turn.user) || banned.test(turn.expect)) fail(`${spec.simId} 命中安全禁词`);
      for (const name of turn.fixtures || []) {
        if (!fixtureNames.has(name)) fail(`${spec.simId} 引用不存在的 fixture ${name}`);
      }
    }
    const expectedLocatorPrefix = `sim://${spec.simId}/`;
    let noTool = 0;
    for (const item of spec.fixtures || []) {
      if (item.locator !== `${expectedLocatorPrefix}${item.name}`) {
        fail(`${spec.simId} locator 不是 sim://SIM-ID/event-name: ${item.locator}`);
      }
      const allowedStatus = new Set(["ok", "empty", "stale", "conflict", "permission_denied", "partial", "no_tool"]);
      if (!allowedStatus.has(item.status)) fail(`${spec.simId} 非法 fixture 状态 ${item.status}`);
      if (item.status === "no_tool") {
        noTool += 1;
        if (!item.reason) fail(`${spec.simId} no_tool 缺理由`);
      } else if (!item.payload || typeof item.payload !== "object") {
        fail(`${spec.simId} ${item.name} 缺 payload`);
      } else {
        const payloadText = JSON.stringify(item.payload);
        if (banned.test(payloadText) || /@gmail\.|secret-|BEGIN PRIVATE/.test(payloadText)) {
          fail(`${spec.simId} payload 含不可分发数据`);
        }
        if (Object.keys(item.payload).length < 3) warn(`${spec.simId} ${item.name} payload 仍可更丰富`);
      }
      if (item.locator.startsWith("https://") || item.locator.startsWith("http://")) {
        fail(`${spec.simId} locator 不能是真实 URL`);
      }
    }
    if (src.K === "K0" && noTool < 1) fail(`${spec.simId} 是 K0 但未登记 no_tool`);
    if (src.K !== "K0" && noTool === spec.fixtures.length) fail(`${spec.simId} 非 K0 却只有 no_tool`);
    if (src.context.includes("CTX")) {
      const match = src.context.match(/CTX-\d+/);
      if (match && spec.pretest.ctx !== match[0]) fail(`${spec.simId} pretest.ctx 与源上下文不一致`);
      if (!Array.isArray(spec.pretest.ctxFacts) || spec.pretest.ctxFacts.length < 1) {
        fail(`${spec.simId} 未列出 CTX 可引用事实`);
      }
      if (spec.pretest.ctxFacts.some((fact) => /用户刚刚说|现场登录后发现/.test(fact))) {
        fail(`${spec.simId} 把 USER/LIVE 输入写成了 CTX 事实`);
      }
    } else if (spec.pretest.ctx) {
      fail(`${spec.simId} 源记录无 CTX 却注入了 ${spec.pretest.ctx}`);
    }
    if (src.F === "F4" && !spec.lifecycle.includes("overreach")) fail(`${spec.simId} F4 未标越权生命周期`);
    if (src.S === "S3" || src.F === "F4") {
      if (!spec.mustNot.includes(S3_F4_COMMON_MUST_NOT)) {
        fail(`${spec.simId} S3/F4 缺通用禁令`);
      }
      if (executeDone.test(JSON.stringify(spec))) fail(`${spec.simId} S3/F4 伪造了外部消费或授权收据`);
    }
    if (spec.finalState === "ready_for_review" && /完成|交付了/.test(spec.firstReviewable)) {
      fail(`${spec.simId} 把 ready_for_review 写成完成`);
    }
    const uniqueMoves = new Set((spec.turns || []).map((turn) => turn.move));
    if (uniqueMoves.size === 1) warn(`${spec.simId} 轮次类型单一，自然度可能偏书面`);

    const required = REQUIRED_PAYLOAD_PATHS[spec.simId];
    if (required) {
      for (const [eventName, paths] of Object.entries(required)) {
        const item = spec.fixtures.find((event) => event.name === eventName);
        if (!item) {
          fail(`${spec.simId} 缺必需事件 ${eventName}`);
          continue;
        }
        for (const path of paths) {
          if (!pathExists(item.payload || {}, path)) {
            fail(`${spec.simId} ${eventName} 缺必需路径 ${path}`);
          }
        }
      }
    }

    const sessionBlock = sessionBlocks.get(spec.simId);
    if (!sessionBlock) fail(`${spec.simId} 生成会话块缺失`);
    else {
      if (sessionBlock.corpusId !== spec.corpusId) {
        fail(`${spec.simId} 生成块 corpus 错位: ${sessionBlock.corpusId}`);
      }
      if (sessionBlock.file !== DOMAIN_FILES[src.domain].file) {
        fail(`${spec.simId} 写入了错误领域文件 ${sessionBlock.file}`);
      }
      if (sessionBlock.turns !== spec.turns.length) {
        fail(`${spec.simId} 生成轮次数 ${sessionBlock.turns} 与 spec ${spec.turns.length} 不一致`);
      }
      if (!sessionBlock.hasOracle) fail(`${spec.simId} 生成块缺 oracle`);
      if (!sessionBlock.hasFailure) fail(`${spec.simId} 生成块缺失败变体`);
      if (sessionBlock.final !== spec.finalState) fail(`${spec.simId} 生成终态错位`);
      if (!sessionBlock.body.includes(src.question)) fail(`${spec.simId} 源问题未写入本块`);
      if (!sessionBlock.body.includes(`- 频率: ${src.freq}`)) fail(`${spec.simId} 频率未写入本块`);
      if (!sessionBlock.body.includes(`- 档位: ${src.tags}`)) fail(`${spec.simId} 档位未写入本块`);
      if (!sessionBlock.body.includes(`- 工具: ${src.tools}`)) fail(`${spec.simId} 工具未写入本块`);
      if (!sessionBlock.body.includes(`- 上下文: ${src.context}`)) fail(`${spec.simId} 上下文未写入本块`);
      if (!sessionBlock.body.includes(`- 能力/边界: ${src.capability}`)) fail(`${spec.simId} 能力标签未写入本块`);
      if ((src.S === "S3" || src.F === "F4") && !sessionBlock.mustNot.includes(S3_F4_COMMON_MUST_NOT)) {
        fail(`${spec.simId} 生成会话未呈现 S3/F4 通用禁令`);
      }
    }

    const fixtureBlock = fixtureBlocks.get(spec.simId);
    if (!fixtureBlock) fail(`${spec.simId} 生成 fixture 块缺失`);
    else {
      if (fixtureBlock.file !== DOMAIN_FILES[src.domain].file) {
        fail(`${spec.simId} fixture 写入了错误领域文件 ${fixtureBlock.file}`);
      }
      for (const item of spec.fixtures) {
        const rendered = fixtureBlock.events.find((event) => event.name === item.name);
        if (!rendered) fail(`${spec.simId} fixture 块缺事件 ${item.name}`);
        else if (rendered.locator !== item.locator) fail(`${item.locator} 未落入本 SIM fixture 块`);
      }
    }
  }

  for (const rule of TIMING_LEAK_FORBIDDEN) {
    const spec = specs.find((item) => item.simId === rule.simId);
    if (!spec) {
      fail(`时序回归缺会话 ${rule.simId}`);
      continue;
    }
    const event = spec.fixtures.find((item) => item.name === rule.event);
    if (!event) {
      fail(`${rule.simId} 时序回归缺事件 ${rule.event}`);
      continue;
    }
    const payloadText = JSON.stringify(event.payload || {});
    for (const needle of rule.needles) {
      if (payloadText.includes(needle)) {
        fail(`${rule.simId} ${rule.event} 基线泄漏 USER 值: ${needle}`);
      }
    }
  }

  for (const [simId, delta] of Object.entries(FAILURE_STATUS_DELTA)) {
    const spec = specs.find((item) => item.simId === simId);
    if (!spec) {
      fail(`失败变体回归缺会话 ${simId}`);
      continue;
    }
    const event = spec.fixtures.find((item) => item.name === delta.event);
    if (!event) fail(`${simId} 缺失败变体事件 ${delta.event}`);
    else if (event.status !== delta.from) fail(`${simId} 基线状态不是 ${delta.from}: ${event.status}`);
    if (!spec.failure.inject.includes(delta.to)) fail(`${simId} 失败注入未改为 ${delta.to}`);
    if (delta.from === delta.to) fail(`${simId} 失败变体与基线状态相同`);
  }

  if (Object.keys(DOMAIN_FILES).length !== 12) fail("领域表不是 12 个");
  for (const [domain, meta] of Object.entries(DOMAIN_FILES)) {
    if ((domainCounts[domain] || 0) !== 6) fail(`${domain} 不是 6 个会话`);
    if (!skipTreeHash) {
      try {
        statSync(join(root, "sessions", meta.file));
        statSync(join(root, "fixtures", meta.file));
      } catch {
        fail(`缺生成文件 ${meta.file}`);
      }
    }
  }

  if (hml.H !== REQUIRED_HML.H || hml.M !== REQUIRED_HML.M || hml.L !== REQUIRED_HML.L) {
    fail(`H/M/L 不是 ${REQUIRED_HML.H}/${REQUIRED_HML.M}/${REQUIRED_HML.L}: ${hml.H}/${hml.M}/${hml.L}`);
  }
  for (const [dim, expected] of Object.entries({
    C: ["C1", "C2", "C3", "C4", "C5"],
    D: ["D0", "D1", "D2", "D3", "D4"],
    H: ["H0", "H1", "H2", "H3", "H4"],
    R: ["R1", "R2", "R3", "R4"],
    K: ["K0", "K1", "K2", "K3", "K4"],
    S: ["S0", "S1", "S2", "S3"],
    F: ["F1", "F2", "F3", "F4"]
  })) {
    for (const value of expected) {
      if (!tagSets[dim].has(value)) fail(`缺少标签 ${value}`);
    }
  }
  if (ctx < 18) fail(`CTX 会话不足 18: ${ctx}`);
  if (user < 18) fail(`USER 会话不足 18: ${user}`);
  if (live < 24) fail(`LIVE 会话不足 24: ${live}`);
  if (dash < 1) fail("缺少自包含 - 样本");
  if (s3f4 < 12) fail(`S3/F4 不足 12: ${s3f4}`);
  if (liffam < 8) fail(`LIF/FAM 不足 8: ${liffam}`);
  for (const [key, meta] of Object.entries(LIFECYCLE)) {
    if (lifecycleCount[key] < meta.min) fail(`${meta.label} 不足 ${meta.min}: ${lifecycleCount[key]}`);
  }

  if (!files.coverage.includes("72 个会话是代表性回放，不是使用日志")) fail("02-coverage.md 未声明不是使用日志");
  if (!files.coverage.includes(`H/M/L: ${hml.H}/${hml.M}/${hml.L}`)) fail("02-coverage.md H/M/L 与源统计不一致");
  for (const spec of specs) {
    if (!files.coverage.includes(`| ${spec.simId} | ${spec.corpusId} |`)) fail(`02-coverage.md 缺 ${spec.simId}`);
  }
  if (sessionBlocks.size !== 72) fail(`解析到的会话块不是 72: ${sessionBlocks.size}`);
  if (fixtureBlocks.size !== 72) fail(`解析到的 fixture 块不是 72: ${fixtureBlocks.size}`);

  const expectedGenerated = renderGenerated(specs);
  for (const meta of Object.values(DOMAIN_FILES)) {
    if (files.sessions[meta.file] !== expectedGenerated.sessions[meta.file]) {
      fail(`sessions/${meta.file} 生成物字节漂移`);
    }
    if (files.fixtures[meta.file] !== expectedGenerated.fixtures[meta.file]) {
      fail(`fixtures/${meta.file} 生成物字节漂移`);
    }
  }
  if (files.coverage !== expectedGenerated.coverage) {
    fail("02-coverage.md 生成物字节漂移");
  }

  const digest = skipTreeHash ? null : hashGeneratedTree(root);
  return { errors, warns, hml, ctx, user, live, dash, s3f4, liffam, lifecycleCount, tagSets, digest };
}

function printReport(result) {
  const { hml, ctx, user, live, dash, s3f4, liffam, lifecycleCount, tagSets, digest, errors, warns } = result;
  process.stdout.write(`sessions=72 domains=12 H/M/L=${hml.H}/${hml.M}/${hml.L}\n`);
  process.stdout.write(`CTX=${ctx} USER=${user} LIVE=${live} dash=${dash} S3orF4=${s3f4} LIF/FAM=${liffam}\n`);
  process.stdout.write(`lifecycle ${Object.entries(lifecycleCount).map(([key, count]) => `${key}=${count}`).join(" ")}\n`);
  process.stdout.write(`tags C=${[...tagSets.C].sort().join(",")} D=${[...tagSets.D].sort().join(",")} H=${[...tagSets.H].sort().join(",")} R=${[...tagSets.R].sort().join(",")} K=${[...tagSets.K].sort().join(",")} S=${[...tagSets.S].sort().join(",")} F=${[...tagSets.F].sort().join(",")}\n`);
  if (digest) process.stdout.write(`tree_sha256=${digest}\n`);
  process.stdout.write(`A=${errors.length} warn=${warns.length}\n`);
  for (const message of warns) process.stdout.write(`[warn] ${message}\n`);
  if (errors.length) {
    for (const message of errors) process.stderr.write(`[fail] ${message}\n`);
    return 1;
  }
  process.stdout.write("[ok] A-level checks passed\n");
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = collectIssues();
  process.exit(printReport(result));
}
