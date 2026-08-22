// 执行器批任务⑤:故事一执行器驱动全闭环(真 git 仓 + 真 verify + fake agent 真实改文件)——
// 认领 -> worktree 供给 -> agent 改文件 -> verify(真跑 package.json test)-> Tier1SettleProof ->
// ready_for_review -> 回叫入队 -> reviewTask approve(库内自取 treeSha)-> 人工合并(真 git commit-tree)
// -> verify-merge treeSha 匹配 -> task_done。审计链贯通 + 状态词纪律。
// 与 story-acceptance(纯注入 x3)的区别:本文件由**真实执行器 tick 驱动**,proof/treeSha 是真实
// git write-tree 产出(不是手填 "tree-r1"),合并对账走真实 git 对象——执行器批的完成判定 fake-agent 层。

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { newId } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { insertProject } from "../src/storage/dao/projects.js";
import { insertTask } from "../src/storage/dao/tasks.js";
import { CallbackEngine } from "../src/callback/engine.js";
import { requestManualMerge, reviewTask, verifyAndCompleteMerge } from "../src/tier1/operations.js";
import { reconnectFirstLine } from "../src/callback/arbitration.js";
import { checkStatusWords } from "../src/brain/golden.js";
import { Tier1Executor, type AgentProcessHandle, type AgentSpawner } from "../src/tier1/executor.js";
import { buildActiveGateScript, ensureGateScript } from "../src/tier1/gateScript.js";
import { RuntimeApprovalFlow } from "../src/tier1/approvalFlow.js";
import type { AuditSink } from "../src/obs/audit.js";
import type { Logger } from "../src/obs/logger.js";

const PRJ = "prj_01STRY0000000000000000000A";
const OWNER_TEST_ROOT = mkdtempSync(join(process.cwd(), ".saydo-tier1-story-"));
const fakeLog = { info() {}, warn() {}, error() {}, child() { return fakeLog; } } as unknown as Logger;

const EV = {
  init: JSON.stringify({ type: "system", subtype: "init", model: "fable-5-max" }),
  result: JSON.stringify({ type: "result", subtype: "success", result: "改完导出模块" })
};

/** fake agent:spawn 时真实往 worktree 写文件(模拟改代码);再吐事件 + exit 0 */
class FileWritingSpawner implements AgentSpawner {
  files: Record<string, string>;
  constructor(files: Record<string, string>) {
    this.files = files;
  }
  version(): string {
    return "1.0.0-pinned"; // W2 阶段0-②:assertVersion 精确相等
  }
  spawn(i: { cwd: string }): AgentProcessHandle {
    for (const [rel, content] of Object.entries(this.files)) {
      const abs = join(i.cwd, rel);
      mkdirSync(join(abs, ".."), { recursive: true });
      writeFileSync(abs, content);
    }
    const cbs: ((l: string) => void)[] = [];
    const exitP = new Promise<{ exitCode: number }>((resolve) => {
      setTimeout(() => {
        for (const l of [EV.init, EV.result]) for (const cb of cbs) cb(l);
        resolve({ exitCode: 0 });
      }, 5);
    });
    return { pid: 1, onLine: (cb) => cbs.push(cb), kill: () => void 0, wait: () => exitP };
  }
}

let db: Db;
let audit: AuditSink;
let callbacks: CallbackEngine;
let repo: string;
let saydoHome: string;

function makeRepo(): string {
  const dir = mkdtempSync(join(OWNER_TEST_ROOT, "repo-"));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "t@t.local"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "t"], { cwd: dir });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "fx", version: "1.0.0", scripts: { test: 'node -e "process.exit(0)"' } }));
  mkdirSync(join(dir, ".saydo"));
  writeFileSync(join(dir, ".saydo", "project.toml"), '[[verify.entries]]\nname = "test"\nsource = "package_script"\nref = "test"\n');
  writeFileSync(join(dir, "README.md"), "fixture\n");
  execFileSync("git", ["add", "-A"], { cwd: dir });
  execFileSync("git", ["commit", "-qm", "init"], { cwd: dir });
  return dir;
}

function makeExecutor(spawner: AgentSpawner): Tier1Executor {
  const gp = ensureGateScript(saydoHome); // A1:真写 gate.sh,expected 与落盘一致
  return new Tier1Executor({
    db,
    audit,
    log: fakeLog,
    callbacks,
    approvals: new RuntimeApprovalFlow({ db, audit, confirm: null, say: null, activeVoiceSession: () => null }),
    spawner,
    cfg: {
      saydoHome,
      lockedBinary: "/fake/versions/1.0.0-pinned/cursor-agent",
      pinnedVersion: "1.0.0-pinned",
      model: "fable-5-max",
      adapter: "cursor",
      gateScriptPath: gp.scriptPath,
      gateScriptExpected: buildActiveGateScript(gp),
      verifyTimeoutMs: 30_000
    }
  });
}

function seedQueued(taskId: string): void {
  const t0 = new Date().toISOString();
  insertTask(
    db,
    {
      id: taskId,
      projectId: PRJ,
      packageRef: { packageId: newId("pkg"), revision: 1, digest: `sha256:${"c".repeat(64)}` },
      title: "报表页导出 CSV",
      specMarkdown: "# 报表页导出 CSV\n实现导出按钮。",
      route: "tier1",
      adapter: "cursor",
      status: "confirmed",
      budget: { walltimeActiveMin: 45, maxTurns: 80, maxCost: 20 },
      updatedAt: t0
    },
    t0
  );
  db.prepare("UPDATE tasks SET status='queued', updated_at=? WHERE id=?").run(t0, taskId);
}

/** 人工合并模拟(受信终端把 worktree 成果树合并进主仓):commit-tree 精确产出 == approved tree */
function manualMerge(repoPath: string, treeSha: string): string {
  const parent = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoPath, encoding: "utf8" }).trim();
  const commit = execFileSync("git", ["commit-tree", treeSha, "-p", parent, "-m", "manual merge"], {
    cwd: repoPath,
    encoding: "utf8"
  }).trim();
  execFileSync("git", ["update-ref", "refs/heads/main", commit], { cwd: repoPath });
  return commit;
}

async function waitStatus(taskId: string, status: string): Promise<void> {
  await vi.waitFor(
    () => expect((db.prepare("SELECT status FROM tasks WHERE id=?").get(taskId) as { status: string }).status).toBe(status),
    { timeout: 15_000, interval: 50 }
  );
}

beforeEach(() => {
  saydoHome = mkdtempSync(join(tmpdir(), "saydo-story-home-"));
  db = openDb(join(saydoHome, "saydo.db"));
  audit = createSqliteAuditSink(db);
  callbacks = new CallbackEngine({ db, audit });
  repo = makeRepo();
  insertProject(db, {
    id: PRJ,
    title: "报表系统",
    type: "coding",
    status: "active",
    workspace: { kind: "local_folder", path: repo, managed: false },
    executionModeDefault: "step_confirm",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
});

afterAll(() => {
  rmSync(OWNER_TEST_ROOT, { recursive: true, force: true });
});

describe("故事一执行器驱动全闭环(01 §5;真 git/真 verify/fake agent 真改文件)", () => {
  it("认领->改文件->verify->settle->回叫->approve->人工合并->task_done;treeSha 真实对账", async () => {
    const TSK = "tsk_01STRY0000000000000000000A";
    seedQueued(TSK);
    const executor = makeExecutor(new FileWritingSpawner({ "src/export.ts": "export const exportCsv = () => 'csv';\n" }));

    // 认领 + 执行 + settle
    executor.tick();
    await waitStatus(TSK, "ready_for_review");

    // settle proof:treeSha 是真实 git write-tree(非手填),含 agent 写的文件,排除 .cursor
    const run = db.prepare("SELECT id, tree_sha, settle_proof_json, attempt FROM tier1_runs WHERE task_id=?").get(TSK) as {
      id: string;
      tree_sha: string;
      settle_proof_json: string;
      attempt: number;
    };
    expect(run.tree_sha).toMatch(/^[0-9a-f]{40}$/);
    // worktree 里确实有 agent 写的文件在树内(git cat-file 验)
    const treeList = execFileSync("git", ["ls-tree", "-r", "--name-only", run.tree_sha], { cwd: repo, encoding: "utf8" });
    expect(treeList).toContain("src/export.ts");
    expect(treeList).not.toContain(".cursor"); // 审批钩子不入交付树

    // 回叫入队 + 状态词纪律(10 #29)
    const ob = db.prepare("SELECT trigger, settle_json FROM callback_outbox WHERE task_id=?").get(TSK) as { trigger: string; settle_json: string };
    expect(ob.trigger).toBe("ready_for_review");
    const first = reconnectFirstLine("ready_for_review", "报表页导出 CSV");
    expect(first).toContain("等你验收");
    expect(checkStatusWords(first).ok).toBe(true);

    // 验收 approve(evidenceDigest/treeSha 库内自取)-> review_approved_waiting_merge
    const rv = reviewTask(db, audit, { taskId: TSK, verdict: "approve", expectedAttempt: run.attempt }, new Date().toISOString());
    expect(rv.state).toBe("review_approved_waiting_merge");
    const approvedTree = (db.prepare("SELECT approved_tree_sha FROM tasks WHERE id=?").get(TSK) as { approved_tree_sha: string }).approved_tree_sha;
    expect(approvedTree).toBe(run.tree_sha); // 批准落库 = 真实 settle treeSha

    // 人工合并(受信终端;真 git commit-tree 产出恰为 approved tree)-> verify-merge -> task_done
    requestManualMerge(db, audit, TSK);
    const mergeCommit = manualMerge(repo, approvedTree);
    const done = verifyAndCompleteMerge(
      db,
      audit,
      { taskId: TSK, mergeCommit, treeSha: approvedTree, approvedProspectiveTreeSha: approvedTree },
      new Date().toISOString()
    );
    expect(done.done).toBe(true);
    expect((db.prepare("SELECT status FROM tasks WHERE id=?").get(TSK) as { status: string }).status).toBe("task_done");

    // 审计链贯通(G5):认领/settle/批准/合并全落
    const actions = new Set((db.prepare("SELECT DISTINCT action FROM audit_log").all() as { action: string }[]).map((r) => r.action));
    for (const a of ["tier1.claim", "tier1.settled_review", "task.review_approve", "task.request_manual_merge", "task.done"]) {
      expect(actions.has(a), a).toBe(true);
    }
  });

  it("合并对账防篡改:主仓 HEAD tree 与批准 treeSha 不符 ⇒ verify-merge 拒推进(防已回滚显示完成)", async () => {
    const TSK = "tsk_01STRY0000000000000000000B";
    seedQueued(TSK);
    const executor = makeExecutor(new FileWritingSpawner({ "src/x.ts": "export const x = 1;\n" }));
    executor.tick();
    await waitStatus(TSK, "ready_for_review");
    const run = db.prepare("SELECT tree_sha, attempt FROM tier1_runs WHERE task_id=?").get(TSK) as { tree_sha: string; attempt: number };
    reviewTask(db, audit, { taskId: TSK, verdict: "approve", expectedAttempt: run.attempt }, new Date().toISOString());
    // 主仓 HEAD 未合并(tree 仍是 init tree,≠ 批准 tree)⇒ 拒
    const headTree = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { cwd: repo, encoding: "utf8" }).trim();
    const r = verifyAndCompleteMerge(
      db,
      audit,
      { taskId: TSK, mergeCommit: "deadbeef", treeSha: headTree, approvedProspectiveTreeSha: run.tree_sha },
      new Date().toISOString()
    );
    expect(r.done).toBe(false);
    expect((db.prepare("SELECT status FROM tasks WHERE id=?").get(TSK) as { status: string }).status).toBe("review_approved_waiting_merge");
  });
});
