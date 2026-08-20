// 4.5 验收:steer 三态 / Tier1 取消全链(cancelProof 齐备 + 晚到事件转历史)/ reviewTask 三态
// (expectedAttempt 防串)/ 人工合并 MergeProof(treeSha 匹配才 task_done)/ retryTask /
// E2E 故事一(逐步确认版全链:决策包 -> 收据 -> run -> review approve -> 人工合并 -> task_done)。

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  computePackageDigest,
  type DecisionPackage,
  type MergeProof,
  type TaskCard,
  type Tier1CancelProof
} from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import type { Tier1RunRow } from "../src/storage/dao/tasks.js";
import {
  steerApplied,
  steerTask,
  requestCancel,
  settleCancel,
  isLateEventHistory,
  reviewTask,
  requestManualMerge,
  verifyAndCompleteMerge,
  retryTask,
  readTaskMessages
} from "../src/tier1/operations.js";
import { issueDispatchReceipt, applyReceiptEvent, approvePackageWithReceipt } from "../src/approvals/issue.js";
import { insertProject } from "../src/storage/dao/projects.js";
import { managedProjectPath } from "../src/projects/workspace.js";
import { insertPackage } from "../src/storage/dao/packages.js";
import { insertTask, insertTier1Run } from "../src/storage/dao/tasks.js";
import type { AuditSink } from "../src/obs/audit.js";

const nullAudit: AuditSink = { record: () => ({ id: "aud_x" }) };
const TS = () => new Date("2026-07-25T12:00:00.000Z");
const NOW = "2026-07-25T12:00:00.000Z";
const PRJ = "prj_01AAAAAAAAAAAAAAAAAAAAAAAA";
const TASK = "tsk_01AAAAAAAAAAAAAAAAAAAAAAAA";

let db: Db;

function seedProject(): void {
  insertProject(db, {
    id: PRJ,
    title: "报表",
    type: "coding",
    status: "active",
    workspace: { kind: "local_folder", path: managedProjectPath(PRJ), managed: true },
    executionModeDefault: "step_confirm",
    createdAt: NOW,
    updatedAt: NOW
  });
}

function mkPkg(): DecisionPackage {
  const body = {
    id: "pkg_01AAAAAAAAAAAAAAAAAAAAAAAA",
    revision: 1,
    projectId: PRJ,
    outcomePreview: "导出按钮可用",
    inScope: ["导出"],
    outOfScope: [],
    assumptions: [],
    acceptance: ["Excel 能打开"],
    plan: [{ seq: 1, step: "实现", owner: "ai" as const }],
    cost: { expected: { known: false }, p95: { known: false }, max: 20, currency: "CNY" as const },
    risks: [],
    mode: "step_confirm" as const,
    preauthorizedEffects: [],
    effectPolicyVersion: "e2/0.1.0"
  };
  return { ...body, digest: computePackageDigest(body), status: "approved", expiresAt: "2026-08-01T00:00:00.000Z", createdAt: NOW };
}

function seedTask(status: TaskCard["status"]): void {
  const pkg = mkPkg();
  const task: TaskCard = {
    id: TASK,
    projectId: PRJ,
    packageRef: { packageId: pkg.id, revision: 1, digest: pkg.digest },
    title: "导出功能",
    specMarkdown: "spec",
    route: "tier1",
    adapter: "cursor",
    status: "confirmed",
    budget: { walltimeActiveMin: 45, maxTurns: 50, maxCost: 20 },
    updatedAt: NOW
  };
  insertTask(db, task, NOW);
  if (status !== "confirmed") db.prepare("UPDATE tasks SET status=? WHERE id=?").run(status, TASK);
}

function seedRun(attempt: number, state: Tier1RunRow["state"], treeSha = "tree-good"): void {
  const run: Tier1RunRow = {
    id: `run_01AAAAAAAAAAAAAAAAAAAAAAA${attempt}`,
    taskId: TASK,
    attempt,
    adapter: "cursor",
    cwd: "/tmp/wt",
    worktreePath: "/tmp/wt",
    state,
    nativeSessionId: "sess-1",
    treeSha,
    // settled_review 的契约语义 = Tier1SettleProof 齐备(09 §9);approve 的 evidenceDigest 从此自取
    ...(state === "settled_review"
      ? {
          settleProofJson: JSON.stringify({
            taskId: TASK,
            runId: `run_01AAAAAAAAAAAAAAAAAAAAAAA${attempt}`,
            attempt,
            packageRevision: 1,
            treeSha,
            tier1VerifyDigest: `sha256:${"e".repeat(64)}`,
            transcriptCursor: "cursor-1",
            settledAt: NOW
          })
        }
      : {}),
    createdAt: NOW,
    updatedAt: NOW
  };
  insertTier1Run(db, run);
}

beforeEach(() => {
  db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-ops-")), "saydo.db"));
  seedProject();
});

describe("steerTask 三态", () => {
  it("W2 阶段0-③(Codex 20 B3):steerApplied 与真实能力绑定——当前无后端实现流中注入,恒 queued_delta(不谎报 live)", () => {
    expect(steerApplied("claude_code")).toBe("queued_delta");
    expect(steerApplied("cursor")).toBe("queued_delta");
    expect(steerApplied("codex")).toBe("queued_delta");
  });

  it("W5a 3.4:running ∧ 有活跃 run ⇒ cancel_resume(run 级 cancel_requested,任务保持 running;指令落下次 attempt)", () => {
    seedTask("running");
    seedRun(1, "running");
    const r = steerTask(db, nullAudit, { taskId: TASK, instruction: "别用 axios,换 fetch" }, NOW);
    expect(r.applied).toBe("cancel_resume");
    const run = db.prepare("SELECT state FROM tier1_runs WHERE task_id=?").get(TASK) as { state: string };
    expect(run.state).toBe("cancel_requested"); // run 级
    const task = db.prepare("SELECT status FROM tasks WHERE id=?").get(TASK) as { status: string };
    expect(task.status).toBe("running"); // 任务不动(与用户取消判然有别)
    const msg = db.prepare("SELECT kind, attempt, body FROM task_messages WHERE task_id=?").get(TASK) as Record<string, unknown>;
    expect(msg).toMatchObject({ kind: "steer", attempt: 2, body: "别用 axios,换 fetch" });
  });

  it("W5a 3.4:queued/无活跃 run ⇒ queued_delta(既有语义不变)", () => {
    seedTask("queued");
    const r = steerTask(db, nullAudit, { taskId: TASK, instruction: "顺便更新 README" }, NOW);
    expect(r.applied).toBe("queued_delta");
    expect((db.prepare("SELECT COUNT(*) AS c FROM tier1_runs WHERE state='cancel_requested'").get() as { c: number }).c).toBe(0);
  });

  it("W5a 3.4:route=hopper ⇒ 按 capabilities steer 分级诚实拒(none;不落 task_messages——桥不消费,排队即谎报)", () => {
    seedTask("running");
    db.prepare("UPDATE tasks SET route='hopper', adapter=NULL, package_id=NULL, package_rev=NULL WHERE id=?").run(TASK);
    expect(() => steerTask(db, nullAudit, { taskId: TASK, instruction: "改需求" }, NOW)).toThrow(/不支持运行中改需求/);
    expect((db.prepare("SELECT COUNT(*) AS c FROM task_messages").get() as { c: number }).c).toBe(0);
    // 能力升级(runtime)时:注入 getter 断言判定翻转(消费面就位,能力出现自动改判)
    expect(() =>
      steerTask(db, nullAudit, { taskId: TASK, instruction: "改需求" }, NOW, { hopperSteerLevel: () => "runtime" })
    ).toThrow(/能力升级已到/);
  });
});

describe("Tier1 取消全链", () => {
  it("cancelProof 齐备才 settled;晚到事件转历史不回叫", () => {
    seedTask("running");
    seedRun(1, "running");
    expect(requestCancel(db, nullAudit, TASK, NOW).state).toBe("cancel_requested");

    const incomplete = { taskId: TASK, runId: "run-1", processExited: true, worktreeLockReleased: false, lastEventId: "e-9", settledAt: NOW } as unknown as Tier1CancelProof;
    expect(() => settleCancel(db, nullAudit, incomplete, NOW)).toThrow(/incomplete/);

    const proof: Tier1CancelProof = { taskId: TASK, runId: "run-1", processExited: true, worktreeLockReleased: true, lastEventId: "e-9", settledAt: NOW };
    expect(settleCancel(db, nullAudit, proof, NOW).state).toBe("cancel_settled");
    const t = db.prepare("SELECT status FROM tasks WHERE id=?").get(TASK) as { status: string };
    expect(t.status).toBe("cancel_settled");

    // 晚到事件:eventId <= lastEventId ⇒ 历史(不回叫)
    expect(isLateEventHistory("e-9", "e-5")).toBe(true);
    expect(isLateEventHistory("e-9", "e-9")).toBe(true);
    // 评审 B2 回归:变长数字 id 不被字典序误判("e-10" 是 e-9 之后的新事件,不是历史)
    expect(isLateEventHistory("e-9", "e-10")).toBe(false);
    expect(isLateEventHistory("e-10", "e-9")).toBe(true);
    expect(isLateEventHistory("e-9", "f-1")).toBe(false); // 新事件
  });

  it("非活跃态不可取消", () => {
    seedTask("task_done");
    expect(() => requestCancel(db, nullAudit, TASK, NOW)).toThrow(/cannot cancel/);
  });
});

describe("reviewTask 三态 + expectedAttempt", () => {
  it("approve → waiting_merge(evidenceDigest 库内自取,缺 settle proof 拒——fail-closed)", () => {
    seedTask("ready_for_review");
    // 无 settle proof 的 run:approve 拒(evidenceDigest 不可外部注入,库内取不到即拒)
    insertTier1Run(db, {
      id: "run_01AAAAAAAAAAAAAAAAAAAAAAA9",
      taskId: TASK,
      attempt: 1,
      adapter: "cursor",
      cwd: "/tmp/wt",
      worktreePath: "/tmp/wt",
      state: "settled_review",
      treeSha: "tree-good",
      createdAt: NOW,
      updatedAt: NOW
    });
    expect(() => reviewTask(db, nullAudit, { taskId: TASK, verdict: "approve", expectedAttempt: 1 }, NOW)).toThrow(/settle proof/);
    expect(() => reviewTask(db, nullAudit, { taskId: TASK, verdict: "approve", expectedAttempt: 9 }, NOW)).toThrow(/expectedAttempt/);
    // 补上 settle proof 后 approve 通过,audit 绑定的 evidenceDigest = proof.tier1VerifyDigest
    db.prepare("UPDATE tier1_runs SET settle_proof_json=? WHERE id='run_01AAAAAAAAAAAAAAAAAAAAAAA9'").run(
      JSON.stringify({
        taskId: TASK,
        runId: "run_01AAAAAAAAAAAAAAAAAAAAAAA9",
        attempt: 1,
        packageRevision: 1,
        treeSha: "tree-good",
        tier1VerifyDigest: `sha256:${"e".repeat(64)}`,
        transcriptCursor: "cursor-1",
        settledAt: NOW
      })
    );
    const events: { action: string; meta?: Record<string, unknown> | undefined }[] = [];
    const capturing: AuditSink = {
      record: (e) => {
        events.push({ action: e.action, meta: e.meta });
        return { id: "aud_cap" };
      }
    };
    const r = reviewTask(db, capturing, { taskId: TASK, verdict: "approve", expectedAttempt: 1 }, NOW);
    expect(r.state).toBe("review_approved_waiting_merge");
    const ev = events.find((e) => e.action === "task.review_approve");
    expect(ev?.meta?.["evidenceDigest"]).toBe(`sha256:${"e".repeat(64)}`);
  });

  it("request_changes:同 task 新 attempt,这轮不作废(回 running)", () => {
    seedTask("ready_for_review");
    seedRun(1, "settled_review");
    const r = reviewTask(db, nullAudit, { taskId: TASK, verdict: "request_changes", expectedAttempt: 1, comments: "改验收口径" }, NOW);
    expect(r.state).toBe("running");
    expect(r.attempt).toBe(2);
  });

  it("reject → 取消链(§6.1 边表无 failed 边;作废这轮,worktree 留存)", () => {
    seedTask("ready_for_review");
    seedRun(1, "settled_review");
    expect(reviewTask(db, nullAudit, { taskId: TASK, verdict: "reject", expectedAttempt: 1 }, NOW).state).toBe("cancel_requested");
    const t = db.prepare("SELECT status, cancel_reason FROM tasks WHERE id=?").get(TASK) as { status: string; cancel_reason: string };
    expect(t).toMatchObject({ status: "cancel_requested", cancel_reason: "user_cancel" });
  });

  it("审计纪律:comments 只落 digest 不落原文(impl-readback C2;E3 纪律 + v2 不可变触发器使原文永不可清)", () => {
    seedTask("ready_for_review");
    seedRun(1, "settled_review");
    const events: { action: string; meta?: Record<string, unknown> | undefined }[] = [];
    const capturing: AuditSink = {
      record: (e) => {
        events.push({ action: e.action, meta: e.meta });
        return { id: "aud_cap" };
      }
    };
    reviewTask(db, capturing, { taskId: TASK, verdict: "request_changes", expectedAttempt: 1, comments: "改验收口径,第三条重测" }, NOW);
    const ev = events.find((e) => e.action === "task.request_changes");
    expect(ev).toBeDefined();
    expect(String(ev!.meta!["commentsDigest"])).toMatch(/^sha256:/);
    expect(ev!.meta).not.toHaveProperty("comments");
  });
});

describe("人工合并 MergeProof(对账基准=批准时落库值,评审 A1)", () => {
  it("proof 自洽但与库值不符 ⇒ 拒(自证不算证);与库值匹配 ⇒ task_done", () => {
    // 走真实批准链:approve 时从 run.tree_sha 落库 approved_tree_sha
    seedTask("ready_for_review");
    seedRun(1, "settled_review", "tree-good");
    reviewTask(db, nullAudit, { taskId: TASK, verdict: "approve", expectedAttempt: 1 }, NOW);
    expect(requestManualMerge(db, nullAudit, TASK).handoffUrl).toContain(TASK);

    // A1 回归:伪造 proof(内部两字段一致 = 旧实现会放行)但 ≠ 库值 ⇒ 拒
    const forged: MergeProof = { taskId: TASK, mergeCommit: "c1", treeSha: "tree-evil", approvedProspectiveTreeSha: "tree-evil" };
    const r1 = verifyAndCompleteMerge(db, nullAudit, forged, NOW);
    expect(r1.done).toBe(false);
    expect(r1.reason).toContain("批准时落库");
    expect((db.prepare("SELECT status FROM tasks WHERE id=?").get(TASK) as { status: string }).status).toBe("review_approved_waiting_merge");

    const good: MergeProof = { taskId: TASK, mergeCommit: "c1", treeSha: "tree-good", approvedProspectiveTreeSha: "tree-good" };
    expect(verifyAndCompleteMerge(db, nullAudit, good, NOW).done).toBe(true);
    expect((db.prepare("SELECT status FROM tasks WHERE id=?").get(TASK) as { status: string }).status).toBe("task_done");
  });

  it("批准未落树基准(直接置态绕过 approve)⇒ 拒推进(fail-closed)", () => {
    seedTask("review_approved_waiting_merge"); // 未经 approve,approved_tree_sha 为空
    const p: MergeProof = { taskId: TASK, mergeCommit: "c1", treeSha: "t", approvedProspectiveTreeSha: "t" };
    const r = verifyAndCompleteMerge(db, nullAudit, p, NOW);
    expect(r.done).toBe(false);
    expect(r.reason).toContain("approved_tree_sha");
  });
});

describe("retryTask(重派发语义;09 §6.1 failed→queued (U) 边 + §13 语义注,2026-07-25)", () => {
  it("blocked → running(应答注入,一答一 run)新 attempt;终态拒", () => {
    seedTask("blocked");
    seedRun(1, "settled_failed");
    expect(retryTask(db, nullAudit, TASK, NOW, "补上连接串").attempt).toBe(2);
    expect((db.prepare("SELECT status FROM tasks WHERE id=?").get(TASK) as { status: string }).status).toBe("running");
    db.prepare("UPDATE tasks SET status='task_done' WHERE id=?").run(TASK);
    expect(() => retryTask(db, nullAudit, TASK, NOW)).toThrow(/failed\/blocked/);
  });

  it("failed → queued(重派发,不直进 running);旧 run 终态不动、证据不串线;audit 记 digest,原文落 task_messages", () => {
    seedTask("failed");
    seedRun(1, "settled_failed");
    const actions: { action: string; meta?: Record<string, unknown> }[] = [];
    const audit: AuditSink = {
      record: (e) => {
        actions.push({ action: e.action, ...(e.meta ? { meta: e.meta } : {}) });
        return { id: "aud_x" };
      }
    };
    const r = retryTask(db, audit, TASK, NOW, "换个思路再来一次");
    expect(r.attempt).toBe(2); // attempt+1 预告;新 run 行由派发认领时 INSERT(重过派发前置)
    const task = db.prepare("SELECT status, parked_at FROM tasks WHERE id=?").get(TASK) as { status: string; parked_at: string | null };
    expect(task.status).toBe("queued"); // 回队列,不绕同仓串行
    expect(task.parked_at).toBeNull();
    // 旧 run 终态不动(证据不串线)
    const run = db.prepare("SELECT state FROM tier1_runs WHERE task_id=? AND attempt=1").get(TASK) as { state: string };
    expect(run.state).toBe("settled_failed");
    // audit:敏感纪律——message 只落 digest,原文不进不可变审计
    const retryAudit = actions.find((a) => a.action === "task.retry");
    expect(retryAudit?.meta?.["to"]).toBe("queued");
    expect(String(retryAudit?.meta?.["messageDigest"])).toMatch(/^sha256:/);
    expect(JSON.stringify(retryAudit)).not.toContain("换个思路");
    // Codex 16 3.2 回修:原文 durable 落 task_messages(执行器认领 attempt 2 时读编译上下文)
    expect(readTaskMessages(db, TASK, 2)).toEqual([{ kind: "retry", body: "换个思路再来一次" }]);
  });

  it("failed 重派发前置:存在活跃 run 拒(证据不串线的机械前提,Codex 16 3.3)", () => {
    seedTask("failed");
    seedRun(1, "running"); // 数据异常:failed 任务却有活跃 run
    expect(() => retryTask(db, nullAudit, TASK, NOW)).toThrow(/active run/);
  });

  it("failed 离开时 trigger=failed 活跃回叫条目 superseded(09 §6.1 边注;其他 trigger 不动)", () => {
    seedTask("failed");
    db.prepare(
      `INSERT INTO callback_outbox(id, task_id, trigger, occurrence_key, dedupe_key, state, escalation, created_at, updated_at)
       VALUES ('ntf_01AAAAAAAAAAAAAAAAAAAAAAAA', ?, 'failed', '1', 'k1', 'notified', 0, ?, ?)`
    ).run(TASK, NOW, NOW);
    retryTask(db, nullAudit, TASK, NOW);
    const row = db.prepare("SELECT state, resolution FROM callback_outbox WHERE id='ntf_01AAAAAAAAAAAAAAAAAAAAAAAA'").get() as {
      state: string;
      resolution: string;
    };
    expect(row).toEqual({ state: "resolved", resolution: "superseded" });
  });

  it("blocked 应答注入时 trigger=blocked 活跃条目 superseded(impl-readback 回收批 2 B3;防重叫已答复的问题)", () => {
    seedTask("blocked");
    seedRun(1, "running");
    db.prepare(
      `INSERT INTO callback_outbox(id, task_id, trigger, occurrence_key, dedupe_key, state, escalation, created_at, updated_at)
       VALUES ('ntf_01BBBBBBBBBBBBBBBBBBBBBBBB', ?, 'blocked', 'q1', 'kb1', 'notified', 0, ?, ?)`
    ).run(TASK, NOW, NOW);
    retryTask(db, nullAudit, TASK, NOW, "答案:用发生时间");
    expect((db.prepare("SELECT status FROM tasks WHERE id=?").get(TASK) as { status: string }).status).toBe("running");
    const row = db.prepare("SELECT state, resolution FROM callback_outbox WHERE id='ntf_01BBBBBBBBBBBBBBBBBBBBBBBB'").get() as {
      state: string;
      resolution: string;
    };
    expect(row).toEqual({ state: "resolved", resolution: "superseded" });
  });
});

describe("E2E 故事一(Tier1 逐步确认版全链)", () => {
  it("决策包 -> 语音收据 accept+consume -> 包 approved -> run ready_for_review -> reviewTask approve -> 人工合并 MergeProof -> task_done", () => {
    const pkg: DecisionPackage = { ...mkPkg(), status: "proposed" };
    insertPackage(db, pkg);
    seedTask("confirmed");

    // 1) 语音拍板:签发 dispatch 收据(voice_weak)-> accept -> consume -> 包 approved
    const receipt = issueDispatchReceipt(db, nullAudit, { pkg, decidedVia: "voice", authStrength: "voice_weak", turnRef: "ses_01BBBBBBBBBBBBBBBBBBBBBBBB", taskId: TASK }, TS);
    applyReceiptEvent(db, nullAudit, receipt.id, { kind: "user_accept" }, TS);
    applyReceiptEvent(db, nullAudit, receipt.id, { kind: "consume" }, TS);
    approvePackageWithReceipt(db, nullAudit, pkg, receipt.id);
    expect((db.prepare("SELECT status FROM decision_packages WHERE id=? AND revision=1").get(pkg.id) as { status: string }).status).toBe("approved");

    // 2) 执行:run 起(reserved->running)-> settled_review;task -> ready_for_review
    seedRun(1, "settled_review");
    db.prepare("UPDATE tasks SET status='running' WHERE id=?").run(TASK);
    db.prepare("UPDATE tasks SET status='ready_for_review' WHERE id=?").run(TASK);

    // 3) 验收 approve(绑 evidenceDigest)-> waiting_merge
    const rev = reviewTask(db, nullAudit, { taskId: TASK, verdict: "approve", expectedAttempt: 1 }, NOW);
    expect(rev.state).toBe("review_approved_waiting_merge");

    // 4) 人工合并:handoff + MergeProof(treeSha 与批准落库值匹配)-> task_done
    requestManualMerge(db, nullAudit, TASK);
    const merged = verifyAndCompleteMerge(
      db,
      nullAudit,
      { taskId: TASK, mergeCommit: "merge-abc", treeSha: "tree-good", approvedProspectiveTreeSha: "tree-good" },
      NOW
    );
    expect(merged.done).toBe(true);
    expect((db.prepare("SELECT status FROM tasks WHERE id=?").get(TASK) as { status: string }).status).toBe("task_done");
  });
});
