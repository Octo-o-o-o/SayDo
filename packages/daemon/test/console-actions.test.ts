// 接线批任务②(HANDOFF §2-9-②):console 动作写口(handleTaskAction)——
// 验收三态 / 取消(无活跃 run 即时 settled)/ retry 重派发 / 人工合并交接 / MergeProof 核验;
// 全部经 tier1/operations 状态机(CAS),错误合同 {ok:false,code,message,retryable}。

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { jcsDigest } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { handleTaskAction } from "../src/api/actions.js";
import { abandonFocusApi, archiveFocusApi, createFocusApi } from "../src/api/focuses.js";
import { seedConsoleFixture } from "../src/api/fixture.js";
import { changeFocusLifecycle } from "../src/focus/registry.js";
import type { AuditEvent, AuditSink } from "../src/obs/audit.js";
import { canonicalizeWorkspace } from "../src/projects/workspace.js";

const nullAudit: AuditSink = { record: () => ({ id: "aud_x" }) };
const NOW = "2026-07-25T12:00:00.000Z";
const RDY = "tsk_01F1XT0RE0TSKRDY0000000000"; // fixture: ready_for_review + settled run(带 settle proof)
const FAI = "tsk_01F1XT0RE0TSKFA10000000000"; // fixture: failed
const B1K = "tsk_01F1XT0RE0TSKB1K0000000000"; // fixture: blocked
const OWNER_TEST_ROOT = mkdtempSync(join(process.cwd(), ".saydo-console-actions-"));

let db: Db;

beforeEach(() => {
  db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-act-")), "saydo.db"));
  const seeded = seedConsoleFixture(db);
  expect(seeded.seeded).toBe(true);
});

afterAll(() => {
  rmSync(OWNER_TEST_ROOT, { recursive: true, force: true });
});

function setFixtureWorkspace(path: string): void {
  const identity = canonicalizeWorkspace(path);
  db.prepare(
    `UPDATE projects
        SET workspace_json=?, canonical_workspace_path=?, workspace_dev=?, workspace_ino=?
      WHERE id='prj_01F1XT0RE0A000000000000000'`
  ).run(
    JSON.stringify({ kind: "local_folder", path: identity.path, managed: false }),
    identity.path,
    identity.dev,
    identity.ino
  );
}

describe("review 三态(11 §5.5 操作行的写口)", () => {
  it("approve:evidenceDigest 库内自取(settle proof)-> review_approved_waiting_merge;审计绑定", () => {
    const events: { action: string; meta?: Record<string, unknown> | undefined }[] = [];
    const audit: AuditSink = { record: (e) => (events.push({ action: e.action, meta: e.meta }), { id: "aud_x" }) };
    const r = handleTaskAction(db, audit, RDY, "review", { verdict: "approve", expectedAttempt: 1 }, NOW);
    expect(r.status).toBe(200);
    expect(r.payload).toMatchObject({ ok: true, state: "review_approved_waiting_merge" });
    const ev = events.find((e) => e.action === "task.review_approve");
    expect(String(ev?.meta?.["evidenceDigest"])).toBe(`sha256:${"f".repeat(64)}`); // fixture settle proof 的 verify digest
  });

  it("request_changes:回 running 新 attempt(这轮不作废,#29b)", () => {
    const r = handleTaskAction(db, nullAudit, RDY, "review", { verdict: "request_changes", expectedAttempt: 1, comments: "改导出表头" }, NOW);
    expect(r.status).toBe(200);
    expect(r.payload).toMatchObject({ ok: true, state: "running", attempt: 2 });
  });

  it("reject:走取消链(cancel_requested;话术 #34 停了这轮作废)", () => {
    const r = handleTaskAction(db, nullAudit, RDY, "review", { verdict: "reject", expectedAttempt: 1 }, NOW);
    expect(r.status).toBe(200);
    expect(r.payload).toMatchObject({ ok: true, state: "cancel_requested" });
  });

  it("expectedAttempt 防串旧 attempt(409);verdict 词表外 400", () => {
    expect(handleTaskAction(db, nullAudit, RDY, "review", { verdict: "approve", expectedAttempt: 7 }, NOW).status).toBe(409);
    expect(handleTaskAction(db, nullAudit, RDY, "review", { verdict: "ship_it", expectedAttempt: 1 }, NOW).status).toBe(400);
  });
});

describe("cancel(09 §6.1:无活跃 run 即时 settled)", () => {
  it("failed 态任务不可取消(409;取消只对可取消态)", () => {
    expect(handleTaskAction(db, nullAudit, FAI, "cancel", {}, NOW).status).toBe(409);
  });

  it("blocked 无活跃 run:cancel_requested 即时转 cancel_settled", () => {
    const r = handleTaskAction(db, nullAudit, B1K, "cancel", {}, NOW);
    expect(r.status).toBe(200);
    expect(r.payload).toMatchObject({ ok: true, state: "cancel_settled" });
    const t = db.prepare("SELECT status, cancel_reason FROM tasks WHERE id=?").get(B1K) as { status: string; cancel_reason: string };
    expect(t).toEqual({ status: "cancel_settled", cancel_reason: "user_cancel" });
  });

  it("有活跃 run(running):停在 cancel_requested 等 Tier1CancelProof", () => {
    const RVN = "tsk_01F1XT0RE0TSKRVN0000000000"; // fixture: running + running run
    const r = handleTaskAction(db, nullAudit, RVN, "cancel", {}, NOW);
    expect(r.status).toBe(200);
    expect(r.payload).toMatchObject({ ok: true, state: "cancel_requested" });
  });
});

describe("retry(重派发;09 §6.1 failed→queued (U))", () => {
  it("failed -> queued(不直进 running);attempt 预告 +1", () => {
    const r = handleTaskAction(db, nullAudit, FAI, "retry", { message: "换 v2 的 API 重试" }, NOW);
    expect(r.status).toBe(200);
    expect(r.payload).toMatchObject({ ok: true, attempt: 1 }); // fixture failed 任务无 run 行,首个 attempt=1
    expect((db.prepare("SELECT status FROM tasks WHERE id=?").get(FAI) as { status: string }).status).toBe("queued");
  });

  it("blocked -> running(应答注入)", () => {
    const r = handleTaskAction(db, nullAudit, B1K, "retry", {}, NOW);
    expect(r.status).toBe(200);
    expect((db.prepare("SELECT status FROM tasks WHERE id=?").get(B1K) as { status: string }).status).toBe("running");
  });

  it("ready_for_review 拒 retry(409:词表外先决条件)", () => {
    expect(handleTaskAction(db, nullAudit, RDY, "retry", {}, NOW).status).toBe(409);
  });
});

describe("request-manual-merge + 未知动作", () => {
  it("approve 后可请求人工合并(handoffUrl);未批准态 409", () => {
    expect(handleTaskAction(db, nullAudit, RDY, "request-manual-merge", {}, NOW).status).toBe(409);
    handleTaskAction(db, nullAudit, RDY, "review", { verdict: "approve", expectedAttempt: 1 }, NOW);
    const r = handleTaskAction(db, nullAudit, RDY, "request-manual-merge", {}, NOW);
    expect(r.status).toBe(200);
    expect((r.payload as { handoffUrl: string }).handoffUrl).toContain(RDY);
  });

  it("未知动作 404;未知任务 404", () => {
    expect(handleTaskAction(db, nullAudit, RDY, "explode", {}, NOW).status).toBe(404);
    expect(handleTaskAction(db, nullAudit, RDY, "abandon", {}, NOW).status).toBe(404);
    expect(handleTaskAction(db, nullAudit, "tsk_01ZZZZZZZZZZZZZZZZZZZZZZZZ", "cancel", {}, NOW).status).toBe(404);
  });
});

describe("verify-merge(MergeProof 核验按需触发形态:git 现读 treeSha 对账批准落库值)", () => {
  function gitRepoWithCommit(): { repo: string; treeSha: string } {
    const repo = mkdtempSync(join(OWNER_TEST_ROOT, "repo-"));
    const git = (...args: string[]): string => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
    git("init", "-q");
    git("config", "user.email", "t@t");
    git("config", "user.name", "t");
    writeFileSync(join(repo, "README.md"), "merged\n");
    git("add", "-A");
    git("commit", "-qm", "merge result");
    return { repo, treeSha: git("rev-parse", "HEAD^{tree}") };
  }

  it("主仓 HEAD tree == 批准落库值 => task_done;不匹配 => 409 拒推进(防已回滚显示完成)", () => {
    const { repo, treeSha } = gitRepoWithCommit();
    setFixtureWorkspace(repo);
    // 批准链:run 行与 settle proof 的 treeSha 同步改成真仓值(approve 交叉核对 proof.treeSha === run.tree_sha)
    const proofRow = db.prepare("SELECT settle_proof_json FROM tier1_runs WHERE id='run_01F1XT0RE0A000000000000000'").get() as {
      settle_proof_json: string;
    };
    const proof = JSON.parse(proofRow.settle_proof_json) as { treeSha: string };
    proof.treeSha = treeSha;
    db.prepare("UPDATE tier1_runs SET tree_sha=?, settle_proof_json=? WHERE id='run_01F1XT0RE0A000000000000000'").run(
      treeSha,
      JSON.stringify(proof)
    );
    handleTaskAction(db, nullAudit, RDY, "review", { verdict: "approve", expectedAttempt: 1 }, NOW);
    handleTaskAction(db, nullAudit, RDY, "request-manual-merge", {}, NOW);

    const ok = handleTaskAction(db, nullAudit, RDY, "verify-merge", {}, NOW);
    expect(ok.status).toBe(200);
    expect(ok.payload).toMatchObject({ ok: true, state: "task_done" });
    expect((db.prepare("SELECT status FROM tasks WHERE id=?").get(RDY) as { status: string }).status).toBe("task_done");
  });

  it("主仓 HEAD tree != 批准落库值(合并了别的东西/已回滚)=> 409,状态不动", () => {
    const { repo } = gitRepoWithCommit();
    setFixtureWorkspace(repo);
    // 批准的是 fixture 原 treeSha(abc123def456),主仓 HEAD tree 是另一个
    handleTaskAction(db, nullAudit, RDY, "review", { verdict: "approve", expectedAttempt: 1 }, NOW);
    const r = handleTaskAction(db, nullAudit, RDY, "verify-merge", {}, NOW);
    expect(r.status).toBe(409);
    expect((r.payload as { code: string }).code).toBe("merge_not_verified");
    expect((db.prepare("SELECT status FROM tasks WHERE id=?").get(RDY) as { status: string }).status).toBe(
      "review_approved_waiting_merge"
    );
  });
});

describe("PG-01B abandon reason 先 trim 再非空", () => {
  it("纯空白 reason 返回 400 且 lifecycle 不变", () => {
    const created = createFocusApi(db, nullAudit, { title: "blank-reason" }, NOW);
    const id = (created.payload as { id: string }).id;
    changeFocusLifecycle(db, id, { to: "active", reason: "activate", actorKind: "user" });
    const before = (db.prepare("SELECT lifecycle FROM focuses WHERE id=?").get(id) as { lifecycle: string }).lifecycle;
    expect(before).toBe("active");
    const out = abandonFocusApi(db, nullAudit, id, { reason: "   " });
    expect(out.status).toBe(400);
    const after = (db.prepare("SELECT lifecycle FROM focuses WHERE id=?").get(id) as { lifecycle: string }).lifecycle;
    expect(after).toBe("active");
  });

  it("非空值写入 abandoned,独立 audit 不落理由原文;archive 原语义不变", () => {
    const recorded: AuditEvent[] = [];
    const audit: AuditSink = {
      record: (e) => {
        recorded.push(e);
        return { id: "aud_x" };
      }
    };
    const created = createFocusApi(db, audit, { title: "trim-reason" }, NOW);
    const id = (created.payload as { id: string }).id;
    changeFocusLifecycle(db, id, { to: "active", reason: "activate", actorKind: "user" });
    const reason = "不再做了";
    const out = abandonFocusApi(db, audit, id, { reason: `  ${reason}  ` });
    expect(out.status).toBe(200);
    expect(out.payload).toEqual({ ok: true, id, lifecycle: "abandoned" });
    const row = db.prepare("SELECT lifecycle FROM focuses WHERE id=?").get(id) as { lifecycle: string };
    expect(row.lifecycle).toBe("abandoned");
    const abandoned = recorded.find((e) => e.action === "focus.abandoned");
    expect(abandoned?.action).toBe("focus.abandoned");
    expect(abandoned?.actor).toBe("owner");
    expect(abandoned?.meta?.["focusId"]).toBe(id);
    expect(typeof abandoned?.meta?.["eventId"]).toBe("string");
    expect(abandoned?.meta?.["closedActivations"]).toBe(0);
    expect(abandoned?.meta).not.toHaveProperty("reason");
    const serialized = JSON.stringify(abandoned);
    expect(serialized).not.toContain(reason);
    expect(abandoned?.refDigest).toBe(jcsDigest(reason));

    const eventId = abandoned?.meta?.["eventId"];
    const lifecycleEvent = db
      .prepare("SELECT type, payload_json FROM focus_events WHERE id = ?")
      .get(eventId) as { type: string; payload_json: string } | undefined;
    expect(lifecycleEvent).toBeDefined();
    if (lifecycleEvent === undefined) {
      throw new Error("expected focus_events row for focus.abandoned eventId");
    }
    expect(lifecycleEvent.type).toBe("lifecycle_changed");
    const payload = JSON.parse(lifecycleEvent.payload_json);
    expect(payload.reason).toBe("不再做了");
    expect(payload.reason).not.toBe("  不再做了  ");
    expect(payload.from).toBe("active");
    expect(payload.to).toBe("abandoned");

    const archivedFocus = createFocusApi(db, audit, { title: "archive-keep" }, NOW);
    const archiveId = (archivedFocus.payload as { id: string }).id;
    const archived = archiveFocusApi(db, audit, archiveId, { reason: "先放下" });
    expect(archived.status).toBe(200);
    expect(archived.payload).toEqual({ ok: true, id: archiveId, lifecycle: "archived" });
    const archivedEvent = recorded.find((e) => e.action === "focus.archived");
    expect(archivedEvent?.meta?.["reason"]).toBe("先放下");
  });
});
