// 真 SQLite 的当前 run 证据边界；数据库种子不是真实 Provider 执行证明。
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { newId, type AcceptanceCheck } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { seedConsoleFixture } from "../src/api/fixture.js";
import { getTaskDetail } from "../src/api/console.js";
import { resolveAcceptanceEvidence } from "../src/api/acceptanceEvidence.js";
import { handleTaskAction } from "../src/api/actions.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";

const TASK = "tsk_01F1XT0RE0TSKRDY0000000000";
const RUN = "run_01F1XT0RE0A000000000000000";
const TREE = "a".repeat(40);
const NOW = "2026-10-03T13:00:00.000Z";
const roots: string[] = [];
const databases: Db[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); for (const root of roots.splice(0)) rmSync(root, {recursive:true,force:true}); });
function seed(meta: Record<string, unknown>) {
  const root = mkdtempSync(join(tmpdir(), "saydo-run-bind-")); roots.push(root);
  const db = openDb(join(root, "saydo.db")); databases.push(db);
  seedConsoleFixture(db, { artifactsDir: join(root,"artifacts") });
  const row = db.prepare("SELECT settle_proof_json FROM tier1_runs WHERE id=?").get(RUN) as {settle_proof_json:string};
  const proof = JSON.parse(row.settle_proof_json);
  proof.treeSha = TREE;
  const audit = createSqliteAuditSink(db);
  const id = newId("aud");
  db.prepare("INSERT INTO audit_log(id,ts,actor,action,meta_json) VALUES (?,?,'owner','task.review_approve',?)").run(id,NOW,JSON.stringify({ taskId:TASK,kind:"coding",attempt:1,evidenceDigest:"sha256:"+"b".repeat(64),verdicts:[{criterion:proof.acceptanceChecks[0].criterion,status:"pass"}],...meta }));
  proof.acceptanceChecks[0] = {...proof.acceptanceChecks[0],status:"pass",evidenceRef:`audit:${id}`};
  db.prepare("UPDATE tier1_runs SET tree_sha=?,settle_proof_json=? WHERE id=?").run(TREE,JSON.stringify(proof),RUN);
  return {db,audit,id,proof};
}

describe("验收引用必须属于当前任务当前 run", () => {
  it.each([
    ["missing",{}], ["empty",{runId:""}], ["other",{runId:newId("run")}], ["old-attempt",{runId:RUN,attempt:2}]
  ])("%s 审计不能保留 pass 或批准", (_name,meta) => {
    const {db,audit,id} = seed(meta);
    const resolved = resolveAcceptanceEvidence(db,`audit:${id}`,{taskId:TASK,runId:RUN,treeSha:TREE});
    const detail = getTaskDetail(db,TASK)!;
    const checks = detail["acceptanceChecks"] as AcceptanceCheck[];

    const before = db.prepare("SELECT status,updated_at,approved_tree_sha FROM tasks WHERE id=?").get(TASK);
    const count = db.prepare("SELECT COUNT(*) c FROM audit_log").get();
    const response = handleTaskAction(db,audit,TASK,"review",{verdict:"approve",expectedAttempt:1},NOW);
    console.log(JSON.stringify({case:_name,resolved:resolved.ok,projected:checks[0]!.status,response:response.status,statusAfter:(db.prepare("SELECT status FROM tasks WHERE id=?").get(TASK) as {status:string}).status}));
    expect(resolved.ok).toBe(false);
    expect(checks[0]!.status).toBe("unknown");
    expect(response.status).toBe(409);
    expect(db.prepare("SELECT status,updated_at,approved_tree_sha FROM tasks WHERE id=?").get(TASK)).toEqual(before);
    expect(db.prepare("SELECT COUNT(*) c FROM audit_log").get()).toEqual(count);
  });
  it("当前同 run 审计可解析，真实批准成功且新审计明确 runId", () => {
    const {db,audit,id} = seed({runId:RUN});
    expect(resolveAcceptanceEvidence(db,`audit:${id}`,{taskId:TASK,runId:RUN,treeSha:TREE}).ok).toBe(true);
    expect((getTaskDetail(db,TASK)!["acceptanceChecks"] as AcceptanceCheck[])[0]!.status).toBe("pass");
    expect(handleTaskAction(db,audit,TASK,"review",{verdict:"approve",expectedAttempt:1},NOW).status).toBe(200);
    const latest = db.prepare("SELECT meta_json FROM audit_log WHERE action='task.review_approve' AND id!=?").get(id) as {meta_json:string};
    expect(JSON.parse(latest.meta_json).runId).toBe(RUN);
  });
  it.each(["taskId","runId","attempt","treeSha","packageRevision"])("当前 coding proof 的 %s 失配不得投影 pass", field => {
    const {db,proof} = seed({runId:RUN});
    proof[field] = field === "attempt" || field === "packageRevision" ? 2 : field === "treeSha" ? "b".repeat(40) : newId(field === "taskId" ? "tsk" : "run");
    db.prepare("UPDATE tier1_runs SET settle_proof_json=? WHERE id=?").run(JSON.stringify(proof),RUN);
    const detail = getTaskDetail(db,TASK)!;
    expect((detail["acceptanceChecks"] as AcceptanceCheck[]).every(c=>c.status==="unknown")).toBe(true);
    expect(detail["writingProof"]).toBeNull();
  });
  it("最新 run 树非法时不借较旧 run 解析审计", () => {
    const {db,audit,proof} = seed({runId:RUN});
    const latest = newId("run"); const next = {...proof,runId:latest,attempt:2,treeSha:"invalid-tree"};
    db.prepare("INSERT INTO tier1_runs(id,task_id,attempt,adapter,cwd,worktree_path,tree_sha,state,settle_proof_json,created_at,updated_at) VALUES (?,?,2,'cursor','.','.','invalid-tree','settled_review',?,?,?)")
      .run(latest,TASK,JSON.stringify(next),NOW,NOW);
    expect((getTaskDetail(db,TASK)!["acceptanceChecks"] as AcceptanceCheck[]).every(c=>c.status==="unknown")).toBe(true);
    expect(handleTaskAction(db,audit,TASK,"review",{verdict:"approve",expectedAttempt:2},NOW).status).toBe(409);
  });
  it("当前 terminal 审计冲突不能借旧 scope 保留 pass 或批准", () => {
    const {db,audit} = seed({runId:RUN});
    db.prepare("INSERT INTO audit_log(id,ts,actor,action,meta_json) VALUES (?,?,'system','tier1.blocked',?)")
      .run(newId("aud"),NOW,JSON.stringify({taskId:TASK,runId:RUN,exitEvidence:"fixture conflict"}));
    expect((getTaskDetail(db,TASK)!["acceptanceChecks"] as AcceptanceCheck[]).every(c=>c.status==="unknown")).toBe(true);
    expect(handleTaskAction(db,audit,TASK,"review",{verdict:"approve",expectedAttempt:1},NOW).status).toBe(409);
  });

});
