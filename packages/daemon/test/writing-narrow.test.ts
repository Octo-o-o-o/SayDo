// §12-12 类型门禁 + §12-14 writing settle barrier(09 §6.1a;W4 3.2 验收锚)。
// 全链:executor writing settle(真 git worktree + 真文件)→ writingSettleBarrier ②③ →
// reviewTask writing approve(barrier ④ 逐条裁决)+ explainResult content_done。

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { newId, textDigest, writingSettleStructuralViolations, type AcceptanceCheck } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { insertProject } from "../src/storage/dao/projects.js";
import { canonicalizeWorkspace, managedProjectPath } from "../src/projects/workspace.js";
import { assertProjectTypeEnabled } from "../src/tier1/typeGate.js";
import { reviewTask } from "../src/tier1/operations.js";
import { explainResult } from "../src/summary/explain.js";
import { enabledProjectTypes } from "../src/config/types.js";
import { parseConfigText } from "../src/config/load.js";

let home: string;
let db: Db;
let audit: ReturnType<typeof createSqliteAuditSink>;
const CODING = newId("prj");
const WRITING = newId("prj");
const clock = new Date("2026-07-27T12:00:00.000Z");
const OWNER_TEST_ROOT = mkdtempSync(join(process.cwd(), ".saydo-writing-narrow-"));

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "saydo-writing-"));
  db = openDb(join(home, "saydo.db"));
  audit = createSqliteAuditSink(db);
  for (const [id, type] of [
    [CODING, "coding"],
    [WRITING, "writing"]
  ] as const) {
    insertProject(db, {
      id,
      title: type,
      type,
      status: "active",
      workspace: { kind: "local_folder", path: managedProjectPath(id), managed: true },
      executionModeDefault: "step_confirm",
      createdAt: clock.toISOString(),
      updatedAt: clock.toISOString()
    });
  }
});

afterAll(() => {
  rmSync(OWNER_TEST_ROOT, { recursive: true, force: true });
});

describe("§12-12 项目类型门禁(09 §13/§11)", () => {
  it("缺省 ['coding']:writing 项目 proposeStart/dispatch 拒(project_type_not_enabled)", () => {
    const r = assertProjectTypeEnabled(db, WRITING, ["coding"], "propose");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("project_type_not_enabled");
    expect(assertProjectTypeEnabled(db, WRITING, ["coding"], "dispatch").ok).toBe(false);
    // coding 项目照过
    expect(assertProjectTypeEnabled(db, CODING, ["coding"], "propose").ok).toBe(true);
    expect(assertProjectTypeEnabled(db, CODING, ["coding"], "dispatch").ok).toBe(true);
  });

  it("翻值 ['coding','writing'] 后:writing 项目通过(开值 = 独立收口动作)", () => {
    expect(assertProjectTypeEnabled(db, WRITING, ["coding", "writing"], "propose").ok).toBe(true);
    expect(assertProjectTypeEnabled(db, WRITING, ["coding", "writing"], "dispatch").ok).toBe(true);
  });

  it("pending 生命周期(owner 裁决 (a) 案 2026-07-28):propose 放行(首包可出),拍板/派发拒(project_pending_promotion)", () => {
    const draft = newId("prj");
    insertProject(db, {
      id: draft,
      title: "草稿",
      type: "pending",
      status: "draft",
      workspace: { kind: "local_folder", path: managedProjectPath(draft), managed: true },
      executionModeDefault: "step_confirm",
      createdAt: clock.toISOString(),
      updatedAt: clock.toISOString()
    });
    expect(assertProjectTypeEnabled(db, draft, ["coding"], "propose").ok).toBe(true);
    const d = assertProjectTypeEnabled(db, draft, ["coding"], "dispatch");
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.code).toBe("project_pending_promotion");
  });

  const MODELS = "[models]\ndialog='api:x'\nthinking='api:y'\ncheap='api:z'\nevaluator='api:w'\n";

  it("缺省配置 fixture 断言 writing ∉ effective 集(开值已回收,§11)", () => {
    const cfg = parseConfigText(MODELS);
    expect(enabledProjectTypes(cfg)).toEqual(["coding"]);
    expect(enabledProjectTypes(cfg).includes("writing")).toBe(false);
  });

  it("enabled_project_types 项目层不可覆盖(全局键;09 §11)——mergeConfig 剥离", async () => {
    const { mergeConfig } = await import("../src/config/load.js");
    const global = parseConfigText(`${MODELS}[params]\nenabled_project_types=['coding','writing']\n`);
    const merged = mergeConfig(global, { params: { enabled_project_types: ["coding"] } as never });
    expect(merged.rejectedKeys).toContain("params.enabled_project_types");
    // 全局值保留(项目层企图收窄被剥)
    expect(enabledProjectTypes(merged.config)).toEqual(["coding", "writing"]);
  });
});

describe("§12-14 writing settle barrier 结构断言(09 §6.1a ②③)", () => {
  const plan = [
    { seq: 1, step: "引言", owner: "ai" as const },
    { seq: 2, step: "正文", owner: "ai" as const },
    { seq: 3, step: "人工补素材", owner: "human" as const }
  ];
  const acceptance = ["核心论点覆盖", "读者匹配"];
  const goodCoverage = [
    { outlineSectionId: "1", status: "drafted" as const },
    { outlineSectionId: "2", status: "drafted" as const }
  ];
  const goodChecks: AcceptanceCheck[] = acceptance.map((criterion) => ({ criterion, status: "unknown" as const, source: "manual" as const }));

  it("空稿/漏节/幽灵节/重复节 exact-set 拒(节 = ai 步 seq)", () => {
    const ctx = { plan, acceptance };
    // 漏节(缺 seq 2)
    expect(
      writingSettleStructuralViolations({ sectionCoverage: [goodCoverage[0]!], acceptanceChecks: goodChecks }, ctx, { requireAllDrafted: true }).some((v) => v.includes("漏节"))
    ).toBe(true);
    // 幽灵节(seq 3 是 human,不该出现)
    expect(
      writingSettleStructuralViolations(
        { sectionCoverage: [...goodCoverage, { outlineSectionId: "3", status: "drafted" }], acceptanceChecks: goodChecks },
        ctx,
        { requireAllDrafted: true }
      ).some((v) => v.includes("幽灵节"))
    ).toBe(true);
    // 重复节
    expect(
      writingSettleStructuralViolations(
        { sectionCoverage: [...goodCoverage, { outlineSectionId: "1", status: "drafted" }], acceptanceChecks: goodChecks },
        ctx,
        { requireAllDrafted: true }
      ).some((v) => v.includes("重复"))
    ).toBe(true);
  });

  it("sectionCoverage 含 empty 进 ready_for_review 拒(settle 门 requireAllDrafted)", () => {
    const v = writingSettleStructuralViolations(
      { sectionCoverage: [goodCoverage[0]!, { outlineSectionId: "2", status: "empty" }], acceptanceChecks: goodChecks },
      { plan, acceptance },
      { requireAllDrafted: true }
    );
    expect(v.some((x) => x.includes("未成稿"))).toBe(true);
  });

  it("manual 项 agent 自填 pass 拒(settle 时 manual 恒 unknown)", () => {
    const cheated: AcceptanceCheck[] = [
      { criterion: "核心论点覆盖", status: "pass", source: "manual" },
      { criterion: "读者匹配", status: "unknown", source: "manual" }
    ];
    const v = writingSettleStructuralViolations({ sectionCoverage: goodCoverage, acceptanceChecks: cheated }, { plan, acceptance }, {
      requireAllDrafted: true,
      manualMustBeUnknown: true
    });
    expect(v.some((x) => x.includes("manual 验收项恒 unknown"))).toBe(true);
  });

  it("verify 项 fail 仍 settle 拒;agent_claim 作终局拒", () => {
    const withVerifyFail: AcceptanceCheck[] = [
      { criterion: "核心论点覆盖", status: "fail", source: "verify", evidenceRef: "lint:x" },
      { criterion: "读者匹配", status: "unknown", source: "manual" }
    ];
    expect(
      writingSettleStructuralViolations({ sectionCoverage: goodCoverage, acceptanceChecks: withVerifyFail }, { plan, acceptance }, { requireAllDrafted: true }).some((v) => v.includes("verify 验收项须绑"))
    ).toBe(true);
    const withAgentClaim: AcceptanceCheck[] = [
      { criterion: "核心论点覆盖", status: "pass", source: "agent_claim" },
      { criterion: "读者匹配", status: "unknown", source: "manual" }
    ];
    expect(
      writingSettleStructuralViolations({ sectionCoverage: goodCoverage, acceptanceChecks: withAgentClaim }, { plan, acceptance }, { requireAllDrafted: true }).some((v) => v.includes("agent_claim"))
    ).toBe(true);
  });

  it("全绿正例:结构断言无违规(exact-set + 全 drafted + manual unknown)", () => {
    expect(writingSettleStructuralViolations({ sectionCoverage: goodCoverage, acceptanceChecks: goodChecks }, { plan, acceptance }, { requireAllDrafted: true, manualMustBeUnknown: true })).toEqual([]);
  });
});

// ---- writing 全链 e2e(真 git worktree + 真文件;executor settle → reviewTask approve) ----
import { Tier1Executor, realAgentSpawner, type AgentProcessHandle, type AgentSpawner } from "../src/tier1/executor.js";
import { ArtifactStore } from "../src/artifacts/store.js";
import { RuntimeApprovalFlow } from "../src/tier1/approvalFlow.js";
import { CallbackEngine } from "../src/callback/engine.js";
import { createLogger } from "../src/obs/logger.js";
import { insertPackage } from "../src/storage/dao/packages.js";
import { computePackageDigest } from "@saydo/contracts";
import { approveMerge, executeMergeSegment, issueS3Challenge, registerWebauthn, verifyS3Assertion } from "../src/tier1/s3Tools.js";
import { FakeAuthenticator } from "./helpers/fakeWebauthn.js";

const ORIGIN = "http://localhost:47100";
const RP = "localhost";

function fakeWritingSpawner(articleBody: string, articlePath = "article.md"): AgentSpawner {
  return {
    version: () => "2026.07.23-e383d2b",
    spawn(i): AgentProcessHandle {
      // fake agent:写成稿到 worktree(cwd 由 executor 先建);cb 注册后 setTimeout 触发行 + 退出
      writeFileSync(join(i.cwd, articlePath), articleBody);
      const lines = [
        JSON.stringify({ type: "system", subtype: "init", model: i.model, session_id: "chat_x" }),
        JSON.stringify({ type: "result", subtype: "success", result: "写完了引言和正文两节。" })
      ];
      const cbs: ((line: string) => void)[] = [];
      let resolveExit!: (v: { exitCode: number }) => void;
      const exitP = new Promise<{ exitCode: number }>((r) => (resolveExit = r));
      setTimeout(() => {
        for (const l of lines) for (const cb of cbs) cb(l);
        resolveExit({ exitCode: 0 });
      }, 5);
      return {
        pid: 4242,
        onLine: (fn) => cbs.push(fn),
        kill: () => resolveExit({ exitCode: 143 }),
        wait: () => exitP
      };
    }
  };
}

async function waitStatus(taskId: string, status: string): Promise<void> {
  const { vi } = await import("vitest");
  await vi.waitFor(
    () => {
      const row = db.prepare("SELECT status FROM tasks WHERE id=?").get(taskId) as { status: string };
      expect(row.status).toBe(status);
    },
    { timeout: 15_000, interval: 30 }
  );
}

function seedGitRepo(): string {
  const repo = mkdtempSync(join(OWNER_TEST_ROOT, "repo-"));
  const git = (args: string[]): string => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
  git(["init", "-q", "-b", "main"]);
  git(["config", "user.email", "t@t"]);
  git(["config", "user.name", "t"]);
  writeFileSync(join(repo, "README.md"), "octoblog\n");
  git(["add", "-A"]);
  git(["commit", "-q", "-m", "base"]);
  return repo;
}

function seedWritingTaskAndPackage(
  repo: string,
  projectId = WRITING
): { taskId: string; pkgDigest: string } {
  const plan = [
    { seq: 1, step: "写引言", owner: "ai" as const },
    { seq: 2, step: "写正文", owner: "ai" as const }
  ];
  const acceptance = ["核心论点覆盖", "结构完整"];
  const unsigned = {
    id: newId("pkg"),
    revision: 1,
    projectId,
    outcomePreview: "一篇关于章鱼的科普短文",
    inScope: ["引言", "正文"],
    outOfScope: [],
    assumptions: [],
    acceptance,
    plan,
    cost: { expected: { known: false }, p95: { known: false }, max: 20, currency: "CNY" as const },
    risks: [],
    mode: "step_confirm" as const,
    preauthorizedEffects: [],
    effectPolicyVersion: "e2/0.1.0"
  };
  const digest = computePackageDigest(unsigned);
  insertPackage(db, { ...unsigned, digest, status: "approved", expiresAt: clock.toISOString(), createdAt: clock.toISOString() });
  // 项目 workspace 指向真 git repo(claimNext 读 project.workspace_json.path 供给 worktree)
  const identity = canonicalizeWorkspace(repo);
  db.prepare(
    `UPDATE projects
        SET workspace_json=?, canonical_workspace_path=?, workspace_dev=?, workspace_ino=?
      WHERE id=?`
  ).run(
    JSON.stringify({ kind: "local_folder", path: identity.path, managed: false }),
    identity.path,
    identity.dev,
    identity.ino,
    projectId
  );
  const taskId = newId("tsk");
  db.prepare(
    `INSERT INTO tasks(id, project_id, package_id, package_rev, package_digest, title, spec_markdown, route, status, adapter, cwd, budget_json, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, '章鱼科普', '# 章鱼科普', 'tier1', 'queued', 'cursor', ?, '{"walltimeActiveMin":45,"maxTurns":40,"maxCost":20}', ?, ?)`
  ).run(taskId, projectId, unsigned.id, digest, join(repo, ".saydo", "worktrees", taskId), clock.toISOString(), clock.toISOString());
  return { taskId, pkgDigest: digest };
}

function buildExecutor(repo: string): Tier1Executor {
  const gateDir = mkdtempSync(join(tmpdir(), "saydo-writing-gate-"));
  mkdirSync(gateDir, { recursive: true });
  const gp = join(gateDir, "gate.sh");
  writeFileSync(gp, "#!/bin/sh\nexit 0\n");
  return new Tier1Executor({
    db,
    audit,
    log: createLogger({ dir: join(home, "logs"), name: "w-exec" }),
    callbacks: new CallbackEngine({ db, audit }),
    approvals: new RuntimeApprovalFlow({ db, audit, confirm: null, say: null, activeVoiceSession: () => null }),
    spawner: fakeWritingSpawner("# 引言\n章鱼很聪明。\n\n# 正文\n它有三颗心脏。\n"),
    artifacts: new ArtifactStore({ db, saydoDir: home }),
    cfg: {
      saydoHome: home,
      lockedBinary: "/bin/true",
      pinnedVersion: "2026.07.23-e383d2b",
      model: "cursor-fast",
      adapter: "cursor",
      gateScriptPath: gp,
      gateScriptExpected: "#!/bin/sh\nexit 0\n"
    },
    now: () => clock
  });
}

describe("§12-14 内容 lint gate(09 §6.1a barrier ③ 后半句;w4-readback B-3 回修)", () => {
  function seedGitRepoWithVerify(exitCode: number): string {
    const repo = seedGitRepo();
    writeFileSync(
      join(repo, "package.json"),
      JSON.stringify({ name: "octoblog", version: "1.0.0", scripts: { lint: `node -e "process.exit(${exitCode})"` } }, null, 2)
    );
    mkdirSync(join(repo, ".saydo"), { recursive: true });
    writeFileSync(join(repo, ".saydo", "project.toml"), '[[verify.entries]]\nname = "content-lint"\nsource = "package_script"\nref = "lint"\n');
    execFileSync("git", ["add", "-A"], { cwd: repo });
    execFileSync("git", ["commit", "-q", "-m", "verify"], { cwd: repo });
    return repo;
  }

  it("内容 lint fail ⇒ 不 settle:verify exit 1 ⇒ task failed + settled_failed + trigger=failed(与 coding verify 红同构,retryTask 重派发链)", async () => {
    const repo = seedGitRepoWithVerify(1);
    const { taskId } = seedWritingTaskAndPackage(repo);
    const exec = buildExecutor(repo);
    exec.tick();
    await waitStatus(taskId, "failed");
    const run = db.prepare("SELECT state FROM tier1_runs WHERE task_id=?").get(taskId) as { state: string };
    expect(run.state).toBe("settled_failed");
    const ob = db.prepare("SELECT trigger, settle_json FROM callback_outbox WHERE task_id=?").get(taskId) as { trigger: string; settle_json: string };
    expect(ob.trigger).toBe("failed");
    expect(JSON.parse(ob.settle_json).minimalProof.exitEvidence).toContain("writing_verify_failed:package_script:lint");
  });

  it("内容 lint 绿 ⇒ 正常 settle(配置了 verify 且 exit 0 不拦,barrier ①②③ 照常)", async () => {
    const repo = seedGitRepoWithVerify(0);
    const { taskId } = seedWritingTaskAndPackage(repo);
    const exec = buildExecutor(repo);
    exec.tick();
    await waitStatus(taskId, "ready_for_review");
    const run = db.prepare("SELECT state, settle_proof_json FROM tier1_runs WHERE task_id=?").get(taskId) as { state: string; settle_proof_json: string };
    expect(run.state).toBe("settled_review");
    expect((JSON.parse(run.settle_proof_json) as { kind: string }).kind).toBe("writing");
  });

  it("executor 白名单分叉:无执行合同类型(pending)settle ⇒ fail-closed blocked,不按 coding 兜底(owner 裁决 (a) 案防御纵深)", async () => {
    const repo = seedGitRepo();
    const pendingProject = newId("prj");
    insertProject(db, {
      id: pendingProject,
      title: "异常 pending 任务",
      type: "pending",
      status: "draft",
      workspace: { kind: "local_folder", path: managedProjectPath(pendingProject), managed: true },
      executionModeDefault: "step_confirm",
      createdAt: clock.toISOString(),
      updatedAt: clock.toISOString()
    });
    // 模拟绕过正常 typeGate 的历史/损坏任务，但不破坏“非 pending type 不可回退”的新数据库不变量。
    const { taskId } = seedWritingTaskAndPackage(repo, pendingProject);
    const exec = buildExecutor(repo);
    exec.tick();
    await waitStatus(taskId, "blocked");
    const ob = db.prepare("SELECT trigger, settle_json FROM callback_outbox WHERE task_id=?").get(taskId) as { trigger: string; settle_json: string };
    expect(ob.trigger).toBe("blocked");
    expect(JSON.parse(ob.settle_json).minimalProof.exitEvidence).toContain("project_type_unexecutable:pending");
  });
});

describe("§12-14 writing 全链 e2e(真 git;settle → approve → content_done)", () => {
  it("成稿 → writing settle(WritingSettleProof)→ ready_for_review;verify 可空不阻塞(no_verify 不 blocked)", async () => {
    const repo = seedGitRepo();
    const { taskId } = seedWritingTaskAndPackage(repo);
    const exec = buildExecutor(repo);
    exec.tick(); // 认领 + 执行 + settle(fire-and-forget)
    await waitStatus(taskId, "ready_for_review"); // writing 无 verify 登记也 settle(内容评审 gate)
    const run = db.prepare("SELECT settle_proof_json FROM tier1_runs WHERE task_id=? ORDER BY attempt DESC LIMIT 1").get(taskId) as {
      settle_proof_json: string;
    };
    const proof = JSON.parse(run.settle_proof_json) as { kind: string; sectionCoverage: unknown[]; acceptanceChecks: { source: string; status: string }[] };
    expect(proof.kind).toBe("writing");
    expect(proof.sectionCoverage).toHaveLength(2); // 两个 ai 步
    expect(proof.acceptanceChecks.every((c) => c.source === "manual" && c.status === "unknown")).toBe(true); // settle 时 manual 恒 unknown
    // article artifact 落库(barrier ①)
    const art = db.prepare("SELECT type FROM artifacts WHERE project_id=?").get(WRITING) as { type: string } | undefined;
    expect(art?.type).toBe("article");
  });

  it("approve 未逐条裁决拒;逐条 pass 后 → review_approved_waiting_merge;explainResult=content_done", async () => {
    const repo = seedGitRepo();
    const { taskId } = seedWritingTaskAndPackage(repo);
    const exec = buildExecutor(repo);
    exec.tick();
    await waitStatus(taskId, "ready_for_review");
    // 未带 acceptanceVerdicts ⇒ 拒(11 §5.5:manual 项未逐条裁决)
    expect(() => reviewTask(db, audit, { taskId, verdict: "approve", expectedAttempt: 1 }, clock.toISOString())).toThrow(/未逐条裁决/);
    // 逐条 pass ⇒ 通过
    const r = reviewTask(
      db,
      audit,
      {
        taskId,
        verdict: "approve",
        expectedAttempt: 1,
        acceptanceVerdicts: [
          { criterion: "核心论点覆盖", status: "pass" },
          { criterion: "结构完整", status: "pass" }
        ]
      },
      clock.toISOString()
    );
    expect(r.state).toBe("review_approved_waiting_merge");
    // content_done 判别 + one_liner 内容型模板
    const ex = await explainResult({ db, audit, drafter: null, runsDir: join(home, "tier1", "runs"), now: () => clock }, { taskId, level: "one_liner" });
    expect("kind" in ex && ex.kind).toBe("content_done");
    expect("text" in ex && ex.text).toMatch(/成稿 2\/2 节/);
  });

  it("approve 逐条含 fail ⇒ 拒(不能带病批准;回 request_changes/作废语义)", async () => {
    const repo = seedGitRepo();
    const { taskId } = seedWritingTaskAndPackage(repo);
    const exec = buildExecutor(repo);
    exec.tick();
    await waitStatus(taskId, "ready_for_review");
    expect(() =>
      reviewTask(
        db,
        audit,
        {
          taskId,
          verdict: "approve",
          expectedAttempt: 1,
          acceptanceVerdicts: [
            { criterion: "核心论点覆盖", status: "fail" },
            { criterion: "结构完整", status: "pass" }
          ]
        },
        clock.toISOString()
      )
    ).toThrow(/未通过/);
  });

  it("W4 3.5 writing 全链闭合(聊→写→成稿→逐节验收→S3 合并→定稿;fake agent + fake Touch ID)", async () => {
    const repo = seedGitRepo();
    const { taskId } = seedWritingTaskAndPackage(repo);
    const exec = buildExecutor(repo);
    exec.tick();
    await waitStatus(taskId, "ready_for_review");
    // 逐节验收(manual 逐条 pass)→ review_approved_waiting_merge(writing evidenceDigest=H(JCS(proof)))
    const r = reviewTask(
      db,
      audit,
      {
        taskId,
        verdict: "approve",
        expectedAttempt: 1,
        acceptanceVerdicts: [
          { criterion: "核心论点覆盖", status: "pass" },
          { criterion: "结构完整", status: "pass" }
        ]
      },
      clock.toISOString()
    );
    expect(r.state).toBe("review_approved_waiting_merge");
    // S3 合并链(writing 合并 = 文章并回主分支,与 coding 同构):挑战→Touch ID 断言→收据→approveMerge→执行段
    const auth = new FakeAuthenticator();
    const deps = { db, audit, now: () => clock };
    const reg = issueS3Challenge(deps, { action: "register" });
    registerWebauthn(deps, { challengeId: reg.challengeId, attestation: auth.attest(reg.challenge, ORIGIN, RP) }, { origin: ORIGIN });
    const ch = issueS3Challenge(deps, { action: "merge", taskId });
    const receipt = verifyS3Assertion(deps, { challengeId: ch.challengeId, assertion: auth.assert(ch.challenge, ORIGIN, RP) }, { origin: ORIGIN });
    expect(receipt.riskLevel).toBe("S3");
    expect(approveMerge(deps, { taskId, s3ReceiptId: receipt.id }).state).toBe("merging");
    const seg = executeMergeSegment({ db, audit, runsDir: join(home, "tier1", "runs"), now: () => clock }, taskId);
    expect(seg.state).toBe("task_done"); // 定稿:文章并回主分支
    // 主仓 HEAD tree == 成稿树(article.md 落主分支)
    const headTree = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { cwd: repo, encoding: "utf8" }).trim();
    const inMain = execFileSync("git", ["ls-tree", "-r", "--name-only", headTree], { cwd: repo, encoding: "utf8" });
    expect(inMain).toContain("article.md");
  });

  it("空稿拒 settle(barrier ①):agent 没写成稿 ⇒ blocked 不 settle", async () => {
    const repo = seedGitRepo();
    const { taskId } = seedWritingTaskAndPackage(repo);
    const gateDir = mkdtempSync(join(tmpdir(), "saydo-writing-gate2-"));
    const gp = join(gateDir, "gate.sh");
    writeFileSync(gp, "#!/bin/sh\nexit 0\n");
    const exec = new Tier1Executor({
      db,
      audit,
      log: createLogger({ dir: join(home, "logs"), name: "w-exec2" }),
      callbacks: new CallbackEngine({ db, audit }),
      approvals: new RuntimeApprovalFlow({ db, audit, confirm: null, say: null, activeVoiceSession: () => null }),
      spawner: fakeWritingSpawner("   \n  \n"), // 空白稿
      artifacts: new ArtifactStore({ db, saydoDir: home }),
      cfg: {
        saydoHome: home,
        lockedBinary: "/bin/true",
        pinnedVersion: "2026.07.23-e383d2b",
        model: "cursor-fast",
        adapter: "cursor",
        gateScriptPath: gp,
        gateScriptExpected: "#!/bin/sh\nexit 0\n"
      },
      now: () => clock
    });
    exec.tick();
    await waitStatus(taskId, "blocked"); // 空稿 ⇒ barrier ① 拒,转 blocked 叫人
    expect(existsSync(join(home, "tier1"))).toBe(true);
  });
});
