#!/usr/bin/env node
// 排产现势指针:PLAN-2 顶部 schedule-pointer 块为唯一可写源;HANDOFF 生成块由 --render 投影。
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(here, "..");
const PLAN_REL = "docs/plan/IMPLEMENTATION-PLAN-2.md";
const HANDOFF_REL = "HANDOFF.md";
const SCRIPT_REL = "scripts/schedule-pointer.mjs";
const BEGIN = "<!-- schedule-pointer:begin -->";
const END = "<!-- schedule-pointer:end -->";
const POINTER_KEYS = Object.freeze([
  "schema_version",
  "revision",
  "active",
  "next",
  "last_closed",
  "evidence_ref",
  "updated_at"
]);
const BATCH_ID_RE = /^(PROC-\d+|PG-\d+[A-Z]?)$/;
/** 有限附加批 ID:只接受这两个唯一插批 ID(AS-01-AS-02 2026-09-06;GAP-02-consolidation 2026-09-09),不是任意 AS/GAP 编号。 */
const EXTRA_BATCH_IDS = Object.freeze(["AS-01-AS-02", "GAP-02-consolidation"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PLAN2_CHAIN_ARROW = "PROC-01 → PG-01B → AS-01-AS-02 → GAP-02-consolidation → PG-02 → PG-03 → PG-04 → PG-05 → PG-06 → owner-stop";
const PLAN2_CHAIN_ASSERT = "PLAN2_chain == PROC-01>PG-01B>AS-01-AS-02>GAP-02-consolidation>PG-02>PG-03>PG-04>PG-05>PG-06>owner-stop";
const OID_RE = /\b[0-9a-f]{40}\b/i;
const SHORT_OID_RE = /^[0-9a-f]{7,40}$/i;

function fail(message, code = 1) {
  process.stderr.write(`[fail] ${message}\n`);
  process.exit(code);
}

function usage() {
  fail("用法:node scripts/schedule-pointer.mjs --check | --render | --self-test", 2);
}

function readText(rel) {
  const path = join(REPO_ROOT, rel);
  if (!existsSync(path)) fail(`${rel} 不存在`);
  return readFileSync(path, "utf8");
}

function countToken(text, token) {
  let count = 0;
  let from = 0;
  while (from <= text.length) {
    const index = text.indexOf(token, from);
    if (index === -1) break;
    count += 1;
    from = index + token.length;
  }
  return count;
}

function extractFence(text, label) {
  const begins = countToken(text, BEGIN);
  const ends = countToken(text, END);
  if (begins !== 1 || ends !== 1) {
    throw new Error(`${label} 必须恰好一对 schedule-pointer 围栏,实际 begin=${begins} end=${ends}`);
  }
  const start = text.indexOf(BEGIN);
  const stop = text.indexOf(END);
  if (stop < start + BEGIN.length) {
    throw new Error(`${label} schedule-pointer 围栏顺序无效`);
  }
  return {
    inner: text.slice(start + BEGIN.length, stop),
    start,
    stop
  };
}

function parseFields(inner, label) {
  if (OID_RE.test(inner)) {
    throw new Error(`${label} 指针块不得含提交 OID`);
  }
  const fields = {};
  for (const rawLine of inner.split(/\n/)) {
    const line = rawLine.trim();
    if (line === "") continue;
    const match = /^([a-z_]+)=(.+)$/.exec(line);
    if (!match) {
      throw new Error(`${label} 无法解析指针行:${line}`);
    }
    const key = match[1];
    const value = match[2].trim();
    if (!POINTER_KEYS.includes(key)) {
      throw new Error(`${label} 含未知字段 ${key}`);
    }
    if (Object.hasOwn(fields, key)) {
      throw new Error(`${label} 字段重复:${key}`);
    }
    if (value === "") {
      throw new Error(`${label} 字段为空:${key}`);
    }
    if (SHORT_OID_RE.test(value)) {
      throw new Error(`${label} ${key} 不得为提交 OID`);
    }
    fields[key] = value;
  }
  for (const key of POINTER_KEYS) {
    if (!Object.hasOwn(fields, key)) {
      throw new Error(`${label} 缺少字段 ${key}`);
    }
  }
  if (Object.keys(fields).length !== POINTER_KEYS.length) {
    throw new Error(`${label} 字段数不匹配`);
  }
  return fields;
}

function parseRevision(raw, label) {
  if (!/^[1-9][0-9]*$/.test(raw)) {
    throw new Error(`${label} revision 必须是正整数,实际 ${raw}`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} revision 超出范围`);
  }
  return value;
}

function parseBatchId(raw, label, field) {
  if (!BATCH_ID_RE.test(raw) && !EXTRA_BATCH_IDS.includes(raw)) {
    throw new Error(`${label} ${field} 不是合法批 id:${raw}`);
  }
  return raw;
}

function validateFields(fields, label) {
  if (fields.schema_version !== "1") {
    throw new Error(`${label} schema_version 必须为 1`);
  }
  parseRevision(fields.revision, label);
  if (fields.active !== "none") parseBatchId(fields.active, label, "active");
  if (fields.next !== "none" && fields.next !== "owner-stop") {
    parseBatchId(fields.next, label, "next");
  }
  parseBatchId(fields.last_closed, label, "last_closed");
  if (fields.evidence_ref.startsWith("/") || fields.evidence_ref.includes("\\") || fields.evidence_ref.includes("..")) {
    throw new Error(`${label} evidence_ref 必须是仓内相对路径`);
  }
  if (!DATE_RE.test(fields.updated_at)) {
    throw new Error(`${label} updated_at 必须是 YYYY-MM-DD`);
  }
  const activeOn = fields.active !== "none";
  const nextOn = fields.next !== "none";
  if (activeOn && nextOn) {
    throw new Error(`${label} active 与 next 不得同时非空`);
  }
  if (!activeOn && !nextOn) {
    throw new Error(`${label} active=none 时 next 必填`);
  }
}

function serialize(fields) {
  return `${POINTER_KEYS.map((key) => `${key}=${fields[key]}`).join("\n")}\n`;
}

function gitShowMainPlan() {
  const result = spawnSync("git", ["show", `main:${PLAN_REL}`], {
    cwd: REPO_ROOT,
    encoding: "utf8"
  });
  if (result.status === 0) return result.stdout;
  const err = `${result.stderr ?? ""}${result.stdout ?? ""}`;
  if (/pathspec .* did not match|does not exist in|exists on disk, but not in|bad revision 'main'/i.test(err)) {
    return null;
  }
  throw new Error(`git show main:${PLAN_REL} 失败`);
}

function readMainRevision() {
  const text = gitShowMainPlan();
  if (text === null || !text.includes(BEGIN)) return 0;
  try {
    const fence = extractFence(text, "main PLAN-2");
    const fields = parseFields(fence.inner, "main PLAN-2");
    return parseRevision(fields.revision, "main PLAN-2");
  } catch (error) {
    if (String(error.message).includes("必须恰好一对")) return 0;
    throw error;
  }
}

function checkCardStatus(planText, fields) {
  const headingRe = /^###\s+(\S+)\s+·[^\n]*/gm;
  const cards = [...planText.matchAll(headingRe)].map((match) => ({
    id: match[1],
    title: match[0]
  }));
  if (cards.length === 0) {
    throw new Error("PLAN-2 未找到批卡标题");
  }
  for (const card of cards) {
    const closed = card.title.includes("状态:已收口");
    if (closed && card.id === fields.active) {
      throw new Error(`active=${fields.active} 与批卡「状态:已收口」矛盾`);
    }
    if (closed && card.id === fields.next) {
      throw new Error(`next=${fields.next} 与批卡「状态:已收口」矛盾`);
    }
  }
  const closedCards = cards.filter((card) => card.id === fields.last_closed);
  if (closedCards.length === 0) {
    throw new Error(`last_closed=${fields.last_closed} 在 PLAN-2 无批卡`);
  }
  for (const card of closedCards) {
    if (card.title.includes("未开工")) {
      throw new Error(`last_closed=${fields.last_closed} 不得为未开工`);
    }
    if (!card.title.includes("状态:已收口")) {
      throw new Error(`last_closed=${fields.last_closed} 须为已收口`);
    }
  }
  if (fields.active !== "none") {
    if (!cards.some((card) => card.id === fields.active)) {
      throw new Error(`active=${fields.active} 在 PLAN-2 无批卡`);
    }
  }
  if (fields.next !== "none" && fields.next !== "owner-stop") {
    if (!cards.some((card) => card.id === fields.next)) {
      throw new Error(`next=${fields.next} 在 PLAN-2 无批卡`);
    }
  }
}

function loadPlanPointer(planText) {
  const chainAt = planText.indexOf("### 唯一串行链");
  const fence = extractFence(planText, "PLAN-2");
  if (chainAt !== -1 && fence.start > chainAt) {
    throw new Error("PLAN-2 schedule-pointer 块必须位于「当前唯一排产链」节顶部");
  }
  const fields = parseFields(fence.inner, "PLAN-2");
  validateFields(fields, "PLAN-2");
  return fields;
}

function check() {
  const planText = readText(PLAN_REL);
  const handoffText = readText(HANDOFF_REL);
  const planFields = loadPlanPointer(planText);
  const handoffFence = extractFence(handoffText, "HANDOFF");
  const handoffFields = parseFields(handoffFence.inner, "HANDOFF");
  validateFields(handoffFields, "HANDOFF");
  for (const key of POINTER_KEYS) {
    if (planFields[key] !== handoffFields[key]) {
      throw new Error(`HANDOFF 与 PLAN-2 字段不一致:${key}`);
    }
  }
  const mainRevision = readMainRevision();
  const revision = parseRevision(planFields.revision, "PLAN-2");
  if (revision < mainRevision) {
    throw new Error(`revision 回退:候选 ${revision} < main ${mainRevision}`);
  }
  checkCardStatus(planText, planFields);
  if (!planText.includes(PLAN2_CHAIN_ARROW)) {
    throw new Error("PLAN-2 唯一串行链与冻结全等串不一致");
  }
  if (!planText.includes(PLAN2_CHAIN_ASSERT)) {
    throw new Error("PLAN-2 链断言与冻结全等串不一致");
  }
  const evidencePath = join(REPO_ROOT, planFields.evidence_ref);
  if (!existsSync(evidencePath)) {
    throw new Error(`evidence_ref 不存在:${planFields.evidence_ref}`);
  }
  process.stdout.write(
    `[ok] schedule-pointer check active=${planFields.active} next=${planFields.next} last_closed=${planFields.last_closed} revision=${planFields.revision}\n`
  );
}

function render() {
  const planText = readText(PLAN_REL);
  const planFields = loadPlanPointer(planText);
  const handoffText = readText(HANDOFF_REL);
  const fence = extractFence(handoffText, "HANDOFF");
  const next = `${handoffText.slice(0, fence.start + BEGIN.length)}\n${serialize(planFields)}${handoffText.slice(fence.stop)}`;
  writeFileSync(join(REPO_ROOT, HANDOFF_REL), next);
  process.stdout.write("[ok] schedule-pointer render HANDOFF.md\n");
}

function runCheckAt(worktree) {
  const script = join(worktree, SCRIPT_REL);
  const result = spawnSync(process.execPath, [script, "--check"], {
    cwd: worktree,
    encoding: "utf8"
  });
  return {
    status: result.status === null ? 1 : result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

function restoreWorktreeFiles(worktree, planText, handoffText, scriptPath) {
  writeFileSync(join(worktree, PLAN_REL), planText);
  writeFileSync(join(worktree, HANDOFF_REL), handoffText);
  copyFileSync(scriptPath, join(worktree, SCRIPT_REL));
}

function mutateHandoffMismatch(handoffText, planFields) {
  const nextActive = planFields.active === "PROC-01" ? "PG-01B" : "PROC-01";
  const mutated = handoffText.replace(new RegExp(`^active=${planFields.active}$`, "m"), `active=${nextActive}`);
  if (mutated === handoffText) {
    throw new Error("self-test 未能改坏 HANDOFF 生成块");
  }
  return mutated;
}

function withRevision(text, revision) {
  const mutated = text.replace(/^revision=[1-9][0-9]*$/m, `revision=${revision}`);
  if (!new RegExp(`^revision=${revision}$`, "m").test(mutated)) {
    throw new Error(`self-test 未能把 revision 写成 ${revision}`);
  }
  return mutated;
}

function gitIsolated(repo, args) {
  return execFileSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function runRevisionRollbackCase(worktree, planText, handoffText, scriptPath) {
  const repo = join(worktree, "rev-rollback");
  mkdirSync(join(repo, "docs/plan"), { recursive: true });
  mkdirSync(join(repo, "scripts"), { recursive: true });
  mkdirSync(join(repo, "e2e/evidence"), { recursive: true });
  writeFileSync(join(repo, PLAN_REL), withRevision(planText, 2));
  writeFileSync(join(repo, HANDOFF_REL), withRevision(handoffText, 2));
  copyFileSync(scriptPath, join(repo, SCRIPT_REL));
  writeFileSync(join(repo, "e2e/evidence/project-gap-pg-01a.md"), "self-test fixture\n");
  gitIsolated(repo, ["init", "-q", "-b", "main"]);
  gitIsolated(repo, ["config", "user.email", "test@example.invalid"]);
  gitIsolated(repo, ["config", "user.name", "test"]);
  gitIsolated(repo, [
    "add",
    "-f",
    PLAN_REL,
    HANDOFF_REL,
    SCRIPT_REL,
    "e2e/evidence/project-gap-pg-01a.md"
  ]);
  gitIsolated(repo, ["commit", "-q", "-m", "baseline revision 2"]);
  writeFileSync(join(repo, PLAN_REL), withRevision(planText, 1));
  writeFileSync(join(repo, HANDOFF_REL), withRevision(handoffText, 1));
  const result = runCheckAt(repo);
  const output = `${result.stdout}${result.stderr}`;
  if (result.status === 0) {
    throw new Error("self-test 坏例应非零:revision 回退");
  }
  if (!output.includes("revision 回退")) {
    throw new Error("self-test 拒绝原因不是 revision 回退");
  }
  return result;
}

function mutateActiveAndNext(text, planFields) {
  if (planFields.next !== "none") {
    const mutated = text.replace(new RegExp(`^active=${planFields.active}$`, "m"), "active=PROC-01");
    if (mutated === text) throw new Error("self-test 未能把 active 与 next 同时置为非空");
    return mutated;
  }
  const mutated = text.replace(/^next=none$/m, "next=PG-01B");
  if (mutated === text) {
    throw new Error("self-test 未能把 active 与 next 同时置为非空");
  }
  return mutated;
}

function mutateDropAsFromChain(planText) {
  const mutated = planText.replace(PLAN2_CHAIN_ARROW, "PROC-01 → PG-01B → GAP-02-consolidation → PG-02 → PG-03 → PG-04 → PG-05 → PG-06 → owner-stop");
  if (mutated === planText) {
    throw new Error("self-test 未能从唯一串行链去掉 AS-01-AS-02");
  }
  return mutated;
}

function mutateIllegalExtraBatchId(text, planFields) {
  const mutated = text.replace(new RegExp(`^active=${planFields.active}$`, "m"), "active=AS-03");
  if (mutated === text) {
    throw new Error("self-test 未能把 active 改成非法 AS-03");
  }
  return mutated;
}

function mutateClosedCardUnstarted(planText, lastClosed) {
  const prefix = `### ${lastClosed} `;
  const lines = planText.split("\n");
  let found = false;
  const next = lines.map((line) => {
    if (!found && line.startsWith(prefix) && line.includes("状态:已收口")) {
      found = true;
      return line.replace("状态:已收口", "状态:未开工");
    }
    return line;
  });
  if (!found) {
    throw new Error(`self-test 找不到 ${lastClosed} 已收口标题`);
  }
  return next.join("\n");
}

function selfTest() {
  const planText = readText(PLAN_REL);
  const handoffText = readText(HANDOFF_REL);
  const planFields = loadPlanPointer(planText);
  const parent = mkdtempSync(join(tmpdir(), "saydo-sched-ptr-"));
  const worktree = join(parent, "wt");
  let added = false;
  let failed = null;
  const results = [];
  try {
    execFileSync("git", ["worktree", "add", "--detach", worktree, "HEAD"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    added = true;
    restoreWorktreeFiles(worktree, planText, handoffText, join(REPO_ROOT, SCRIPT_REL));
    const baseline = runCheckAt(worktree);
    if (baseline.status !== 0) {
      throw new Error("self-test 基线 --check 应为 0");
    }

    const cases = [
      {
        name: "HANDOFF 生成块改坏",
        apply() {
          writeFileSync(join(worktree, HANDOFF_REL), mutateHandoffMismatch(handoffText, planFields));
        }
      },
      {
        name: "revision 回退",
        run() {
          return runRevisionRollbackCase(worktree, planText, handoffText, join(REPO_ROOT, SCRIPT_REL));
        }
      },
      {
        name: "active 与 next 同时非空",
        apply() {
          writeFileSync(join(worktree, PLAN_REL), mutateActiveAndNext(planText, planFields));
          writeFileSync(join(worktree, HANDOFF_REL), mutateActiveAndNext(handoffText, planFields));
        }
      },
      {
        name: "已收口批卡状态行改成未开工",
        apply() {
          writeFileSync(join(worktree, PLAN_REL), mutateClosedCardUnstarted(planText, planFields.last_closed));
        }
      },
      {
        name: "非法附加批 id AS-03",
        apply() {
          writeFileSync(join(worktree, PLAN_REL), mutateIllegalExtraBatchId(planText, planFields));
          writeFileSync(join(worktree, HANDOFF_REL), mutateIllegalExtraBatchId(handoffText, planFields));
        }
      },
      {
        name: "唯一串行链去掉 AS-01-AS-02",
        apply() {
          writeFileSync(join(worktree, PLAN_REL), mutateDropAsFromChain(planText));
        }
      }
    ];

    for (const item of cases) {
      restoreWorktreeFiles(worktree, planText, handoffText, join(REPO_ROOT, SCRIPT_REL));
      const result = item.run
        ? item.run()
        : (item.apply(), runCheckAt(worktree));
      results.push({ name: item.name, status: result.status });
      if (result.status === 0) {
        throw new Error(`self-test 坏例应非零:${item.name}`);
      }
      process.stdout.write(`[ok] self-test ${item.name} exit=${result.status}\n`);
    }
  } catch (error) {
    failed = error;
  } finally {
    if (added) {
      try {
        execFileSync("git", ["worktree", "remove", "--force", worktree], {
          cwd: REPO_ROOT,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"]
        });
      } catch {
        try {
          execFileSync("git", ["worktree", "prune"], {
            cwd: REPO_ROOT,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"]
          });
        } catch {
          // 仍尝试删除临时目录。
        }
      }
    }
    rmSync(parent, { recursive: true, force: true });
  }
  if (failed) {
    fail(failed.message ?? String(failed));
  }
  if (results.length !== 6) {
    fail("self-test 未跑满六个坏例");
  }
  process.stdout.write("[ok] schedule-pointer self-test\n");
}

const mode = process.argv[2];
if (process.argv.length !== 3) usage();

try {
  if (mode === "--check") check();
  else if (mode === "--render") render();
  else if (mode === "--self-test") selfTest();
  else usage();
} catch (error) {
  fail(error.message ?? String(error));
}
