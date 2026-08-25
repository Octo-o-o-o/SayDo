#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const GITHUB_API_VERSION = "2026-03-10";

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function defaultExecText(file, args) {
  return execFileSync(file, args, {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function ghHeaders() {
  return ["-H", "Accept: application/vnd.github+json", "-H", `X-GitHub-Api-Version: ${GITHUB_API_VERSION}`];
}

export function runId(run) {
  const id = run?.id ?? run?.databaseId;
  invariant(id != null, "workflow run 缺 id");
  return String(id);
}

export function normalizeWorkflowRun(run) {
  invariant(run && typeof run === "object", "workflow run 非法");
  return {
    ...run,
    id: run.id ?? run.databaseId,
    databaseId: run.databaseId ?? run.id,
    head_branch: run.head_branch ?? run.headBranch,
    head_sha: run.head_sha ?? run.headSha,
    run_attempt: run.run_attempt ?? run.runAttempt,
    html_url: run.html_url ?? run.url,
    url: run.url ?? run.html_url
  };
}

export function createGhWorkflowRunPageFetcher({ repo, workflow = "release.yml", execText = defaultExecText }) {
  invariant(typeof repo === "string" && repo.includes("/"), `repo 非法:${String(repo)}`);
  return async function fetchPage(page, perPage = 100) {
    invariant(perPage === 100, "workflow run 分页必须每页 100");
    invariant(Number.isInteger(page) && page >= 1, `page 非法:${page}`);
    const path = `repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/runs?event=push&per_page=100&page=${page}`;
    invariant(!/[?&](head_sha|branch)=/.test(path), "禁止按 SHA 或 branch 过滤 workflow runs");
    const payload = JSON.parse(execText("gh", ["api", ...ghHeaders(), path]));
    invariant(Array.isArray(payload?.workflow_runs), `workflow runs 第 ${page} 页缺 workflow_runs`);
    return payload.workflow_runs;
  };
}

export async function collectPushRuns(fetchPage) {
  invariant(typeof fetchPage === "function", "fetchPage 必须可注入");
  const runs = [];
  const duplicates = [];
  const seen = new Set();
  for (let page = 1; page <= 100; page += 1) {
    const batch = await fetchPage(page, 100);
    invariant(Array.isArray(batch), `workflow run 第 ${page} 页不是数组`);
    if (batch.length === 0) break;
    for (const raw of batch) {
      const run = normalizeWorkflowRun(raw);
      const id = runId(run);
      if (seen.has(id)) duplicates.push(id);
      seen.add(id);
      runs.push(run);
    }
    if (batch.length < 100) break;
    if (page === 100) throw new Error("workflow run 分页超过 100 页，拒绝截断");
  }
  return { runs, duplicates };
}

export function runsForTag(runs, tag) {
  return runs.filter((run) => run.head_branch === tag);
}

export function evaluateTagWorkflowHistory({ runs, duplicates = [], tag, requirement }) {
  invariant(typeof tag === "string" && tag.startsWith("v"), `tag 非法:${String(tag)}`);
  invariant(Array.isArray(runs), "runs 必须是数组");
  if (duplicates.length > 0) {
    throw new Error(`workflow run 跨页重复:${[...new Set(duplicates)].join(",")}`);
  }
  const matched = runsForTag(runs, tag);
  if (requirement.mode === "zero") {
    invariant(matched.length === 0, `tag ${tag} 已有 ${matched.length} 次 release.yml push run，拒绝再推`);
    return { tag, count: 0, run: null };
  }
  if (requirement.mode !== "exactly-one") throw new Error(`未知 uniqueness 需求:${String(requirement.mode)}`);
  if (matched.length === 0) throw new Error(`tag ${tag} 全历史没有 release.yml push run`);
  if (matched.length !== 1) {
    const shas = [...new Set(matched.map((run) => run.head_sha))];
    throw new Error(`tag ${tag} 全历史 run 不是恰好一次:${matched.length} shas=${shas.join(",")}`);
  }
  const run = matched[0];
  const attempt = Number(run.run_attempt);
  invariant(Number.isInteger(attempt), `tag ${tag} run 缺 run_attempt`);
  if (requirement.runId != null && runId(run) !== String(requirement.runId)) {
    throw new Error(`tag ${tag} run id 不是当前/选中 run:${runId(run)} != ${requirement.runId}`);
  }
  if (requirement.headSha != null && run.head_sha !== requirement.headSha) {
    throw new Error(`tag ${tag} run head_sha 不是当前 tag SHA`);
  }
  if (requirement.runAttempt != null && attempt !== Number(requirement.runAttempt)) {
    throw new Error(`tag ${tag} run_attempt=${attempt} 不是要求的 ${requirement.runAttempt}`);
  }
  if (attempt !== 1) throw new Error(`tag ${tag} run_attempt=${attempt}；该 tag 永久不可用`);
  if (requirement.requireCompleted) {
    invariant(run.status === "completed" && run.conclusion === "success", `release workflow 未全绿:${run.status}/${run.conclusion}`);
  }
  return { tag, count: 1, run };
}

export function githubRefPatternMatches(pattern, ref) {
  invariant(typeof pattern === "string" && pattern.length > 0, "ruleset ref pattern 非法");
  invariant(typeof ref === "string" && ref.startsWith("refs/tags/"), `tag ref 非法:${ref}`);
  if (pattern === ref) return true;
  const match = /^refs\/tags\/(v[A-Za-z0-9._-]*)(\*)?$/.exec(pattern);
  invariant(match, `不支持的 tag ruleset pattern:${pattern}`);
  const literal = match[1];
  const wildcard = match[2] === "*";
  const name = ref.slice("refs/tags/".length);
  return wildcard ? name.startsWith(literal) : name === literal;
}

export function evaluateActiveTagRuleset(rulesets, tag) {
  invariant(Array.isArray(rulesets), "rulesets 必须是数组");
  const ref = `refs/tags/${tag}`;
  const matched = [];
  for (const ruleset of rulesets) {
    if (ruleset?.target !== "tag" || ruleset?.enforcement !== "active") continue;
    if (!Array.isArray(ruleset.bypass_actors) || ruleset.bypass_actors.length !== 0) continue;
    const include = ruleset.conditions?.ref_name?.include;
    const exclude = ruleset.conditions?.ref_name?.exclude ?? [];
    if (!Array.isArray(include)) continue;
    for (const pattern of [...include, ...exclude]) githubRefPatternMatches(pattern, ref);
    if (!include.some((pattern) => githubRefPatternMatches(pattern, ref))) continue;
    if (exclude.some((pattern) => githubRefPatternMatches(pattern, ref))) continue;
    const types = new Set((ruleset.rules ?? []).map((rule) => rule.type));
    if (!types.has("deletion") || !types.has("update")) continue;
    matched.push(ruleset);
  }
  invariant(matched.length > 0, `公开仓缺少覆盖 ${tag} 的 active tag ruleset（无 bypass、禁止 delete 与 update）`);
  return matched[0];
}

export function fetchRepoRulesets(repo, execText = defaultExecText) {
  const listed = JSON.parse(execText("gh", ["api", ...ghHeaders(), `repos/${repo}/rulesets?per_page=100`]));
  invariant(Array.isArray(listed), "ruleset 列表非法");
  invariant(listed.length < 100, "ruleset 超过一页，拒绝截断判定");
  return listed.map((row) => {
    invariant(row?.id != null, "ruleset 缺 id");
    return JSON.parse(execText("gh", ["api", ...ghHeaders(), `repos/${repo}/rulesets/${row.id}`]));
  });
}

function launchedAsCli() {
  const self = fileURLToPath(import.meta.url);
  const argv1 = process.argv[1] ? resolve(process.argv[1]) : "";
  return self === argv1;
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0];
  const option = (name) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  if (command === "uniqueness") {
    const repo = option("--repo");
    const tag = option("--tag");
    const workflow = option("--workflow") ?? "release.yml";
    invariant(repo && tag, "用法:node scripts/release-tag-guard.mjs uniqueness --repo <owner/name> --tag <tag> --require-zero|--require-current ...");
    const collected = await collectPushRuns(createGhWorkflowRunPageFetcher({ repo, workflow }));
    if (argv.includes("--require-zero")) {
      evaluateTagWorkflowHistory({ ...collected, tag, requirement: { mode: "zero" } });
      console.log(`[ok] tag ${tag} release.yml 全历史为零`);
      return;
    }
    if (argv.includes("--require-current")) {
      evaluateTagWorkflowHistory({
        ...collected,
        tag,
        requirement: {
          mode: "exactly-one",
          runId: option("--run-id"),
          headSha: option("--head-sha"),
          runAttempt: Number(option("--run-attempt")),
          requireCompleted: false
        }
      });
      console.log(`[ok] tag ${tag} release.yml 全历史恰好当前一次`);
      return;
    }
  }
  if (command === "ruleset") {
    const repo = option("--repo");
    const tag = option("--tag");
    invariant(repo && tag, "用法:node scripts/release-tag-guard.mjs ruleset --repo <owner/name> --tag <tag>");
    evaluateActiveTagRuleset(fetchRepoRulesets(repo), tag);
    console.log(`[ok] tag ${tag} 存在 active tag ruleset`);
    return;
  }
  console.error(
    "用法:node scripts/release-tag-guard.mjs uniqueness --repo <owner/name> --tag <tag> --require-zero|--require-current [--run-id --head-sha --run-attempt] | ruleset --repo <owner/name> --tag <tag>"
  );
  process.exit(2);
}

if (launchedAsCli()) {
  await main();
}
