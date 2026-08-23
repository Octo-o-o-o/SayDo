// 5.4 P0 总验收:01 §5 故事一 Tier1 版完整闭环 x3 稳定复现(注入通道语义:
// 全链由结构化事件驱动,无键盘交互;S3 合并 = 屏幕强认证收据)。
// 每轮:提案 -> 语音收据(S2 voice)accept+consume -> 包 approved -> 派发 run ->
// settled_review -> ready_for_review 回叫话术 -> reviewTask approve -> 人工合并
// MergeProof -> task_done;审计链贯通(G5)+ 状态词纪律(10)。

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computePackageDigest, newId, type DecisionPackage } from "@saydo/contracts";
import { openDb } from "../src/storage/db.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { insertPackage } from "../src/storage/dao/packages.js";
import { applyReceiptEvent, approvePackageWithReceipt, issueDispatchReceipt } from "../src/approvals/issue.js";
import { requestManualMerge, reviewTask, verifyAndCompleteMerge } from "../src/tier1/operations.js";
import { renderOneLiner } from "../src/summary/summarizer.js";
import { reconnectFirstLine } from "../src/callback/arbitration.js";
import { checkStatusWords } from "../src/brain/golden.js";

const NOW = "2026-07-25T03:00:00.000Z";
const TS = () => new Date(NOW);

function mkPkg(projectId: string): DecisionPackage {
  const body = {
    id: newId("pkg"),
    revision: 1,
    projectId,
    outcomePreview: "报表页导出 CSV 可用",
    inScope: ["导出"],
    outOfScope: ["认证"],
    assumptions: [],
    acceptance: ["导出按钮可用", "CSV 与页面数据一致"],
    plan: [{ seq: 1, step: "改导出模块", owner: "ai" as const }],
    cost: { expected: { known: false }, p95: { known: false }, max: 20, currency: "CNY" as const },
    risks: [],
    mode: "step_confirm" as const,
    preauthorizedEffects: [],
    effectPolicyVersion: "e2/0.1.0"
  };
  return { ...body, digest: computePackageDigest(body), status: "proposed", expiresAt: "2026-08-01T00:00:00.000Z", createdAt: NOW };
}

describe("5.4 故事一 x3 稳定复现", () => {
  it("三轮全链到 task_done,审计链贯通,话术状态词零违规", () => {
    const db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-story-")), "saydo.db"));
    const audit = createSqliteAuditSink(db);
    const projectId = newId("prj");
    db.prepare(
      "INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at) VALUES (?, '报表系统', 'coding', 'active', '{}', 'stepwise', ?, ?)"
    ).run(projectId, NOW, NOW);

    const doneTasks: string[] = [];
    for (let round = 1; round <= 3; round++) {
      const pkg = mkPkg(projectId);
      insertPackage(db, pkg);
      const taskId = newId("tsk");
      db.prepare(
        `INSERT INTO tasks(id, project_id, package_id, package_rev, package_digest, title, spec_markdown, route, status, adapter, cwd, budget_json, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?, 'spec', 'tier1', 'confirmed', 'cursor', '/tmp/wt', '{"walltimeActiveMin":45,"maxTurns":80,"maxCost":20}', ?, ?)`
      ).run(taskId, projectId, pkg.id, pkg.digest, `导出任务第${round}轮`, NOW, NOW);

      // 1) 语音拍板(S2 voice_weak + turnRef;S3 永不走语音)
      const receipt = issueDispatchReceipt(
        db,
        audit,
        { pkg, decidedVia: "voice", authStrength: "voice_weak", turnRef: newId("ses"), taskId },
        TS
      );
      applyReceiptEvent(db, audit, receipt.id, { kind: "user_accept" }, TS);
      applyReceiptEvent(db, audit, receipt.id, { kind: "consume" }, TS);
      approvePackageWithReceipt(db, audit, pkg, receipt.id);

      // 2) 派发执行(注入通道:结构化状态推进,无键盘;settled_review 契约=SettleProof 齐备,09 §9)
      const runId = `run_01STORY${round}0000000000000000000`.slice(0, 30);
      const settleProof = JSON.stringify({
        taskId,
        runId,
        attempt: 1,
        packageRevision: 1,
        treeSha: `tree-r${round}`,
        tier1VerifyDigest: `sha256:${String(round).repeat(64).slice(0, 64)}`,
        acceptanceChecks: pkg.acceptance.map((criterion) => ({ criterion, status: "unknown", source: "manual" })),
        transcriptCursor: "cursor-1",
        settledAt: NOW
      });
      db.prepare(
        `INSERT INTO tier1_runs(id, task_id, attempt, adapter, cwd, worktree_path, tree_sha, state, settle_proof_json, created_at, updated_at)
         VALUES (?, ?, 1, 'cursor', '/tmp/wt', '/tmp/wt', 'tree-r${round}', 'settled_review', ?, ?, ?)`
      ).run(runId, taskId, settleProof, NOW, NOW);
      db.prepare("UPDATE tasks SET status='running', updated_at=? WHERE id=?").run(NOW, taskId);
      db.prepare("UPDATE tasks SET status='ready_for_review', updated_at=? WHERE id=?").run(NOW, taskId);

      // 3) 回叫话术(10 #29):状态词纪律——"执行和检查都跑完了,等你验收",禁"做完了"
      const first = reconnectFirstLine("ready_for_review", `导出任务第${round}轮`);
      expect(first).toContain("等你验收");
      expect(checkStatusWords(first).ok).toBe(true);
      const oneLiner = renderOneLiner({ outcome: "review", filesChanged: 3, tests: { passed: 12, total: 12 } });
      expect(checkStatusWords(oneLiner).ok).toBe(true);

      // 4) 验收 approve -> 人工合并(S3 屏幕侧;treeSha 匹配才 task_done)
      reviewTask(db, audit, { taskId, verdict: "approve", expectedAttempt: 1 }, NOW);
      requestManualMerge(db, audit, taskId);
      const merged = verifyAndCompleteMerge(
        db,
        audit,
        { taskId, mergeCommit: `merge-${round}`, treeSha: `tree-r${round}`, approvedProspectiveTreeSha: `tree-r${round}` },
        NOW
      );
      expect(merged.done).toBe(true);
      doneTasks.push(taskId);
    }

    // 3/3 task_done
    expect(doneTasks).toHaveLength(3);
    const doneCount = (db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE status='task_done'").get() as { c: number }).c;
    expect(doneCount).toBe(3);

    // G5 审计链:三轮的收据签发/状态迁移/包批准/验收/合并全落 audit_log
    const auditRows = db.prepare("SELECT action, COUNT(*) AS c FROM audit_log GROUP BY action").all() as { action: string; c: number }[];
    const byAction = Object.fromEntries(auditRows.map((r) => [r.action, r.c]));
    expect(byAction["approval.issue"]).toBe(3);
    expect(byAction["approval.transition"]).toBe(6); // accept + consume x3
    expect(byAction["package.approve"]).toBe(3);
    expect(byAction["task.review_approve"]).toBe(3);
    expect(byAction["task.done"]).toBe(3);
  });
});
