// 真 SQLite：无验收引用也必须拒绝当前 run 终态冲突，不把人工 unknown 本身当错误。
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { computePackageDigest, newId } from "@saydo/contracts";
import { seedConsoleFixture } from "../src/api/fixture.js";
import { getTaskDetail } from "../src/api/console.js";
import { handleTaskAction } from "../src/api/actions.js";
import { openDb, type Db } from "../src/storage/db.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { getPackage } from "../src/storage/dao/packages.js";
const TASK="tsk_01F1XT0RE0TSKRDY0000000000";
const RUN="run_01F1XT0RE0A000000000000000";
const NOW="2026-10-03T14:00:00.000Z";
const fixtures: {db:Db;root:string}[]=[];
afterEach(()=>{for(const {db,root} of fixtures.splice(0)){db.close();rmSync(root,{recursive:true,force:true});}});
function seed(source:"manual"|"agent_claim"|"empty",terminal:"conflict"|"duplicate"|"mismatch"|"single"|"missing"){
 const root=mkdtempSync(join(tmpdir(),"saydo-terminal-"));const db=openDb(join(root,"saydo.db"));fixtures.push({db,root});
 seedConsoleFixture(db,{artifactsDir:join(root,"artifacts")});
 const row=db.prepare("SELECT settle_proof_json FROM tier1_runs WHERE id=?").get(RUN) as {settle_proof_json:string};
 const proof=JSON.parse(row.settle_proof_json);proof.treeSha="a".repeat(40);const runId=newId("run");proof.runId=runId;proof.attempt=2;
 proof.acceptanceChecks=source==="empty"?[]:proof.acceptanceChecks.map((c:{criterion:string})=>({criterion:c.criterion,source,status:"unknown"}));
 if(source==="empty"){
  const t=db.prepare("SELECT package_id,package_rev FROM tasks WHERE id=?").get(TASK) as {package_id:string;package_rev:number};
  const pkg=getPackage(db,t.package_id,t.package_rev)!;const digest=computePackageDigest({...pkg,acceptance:[]});
  const raw=db.prepare("SELECT body_json FROM decision_packages WHERE id=? AND revision=?").get(t.package_id,t.package_rev) as {body_json:string};
  const body=JSON.parse(raw.body_json);body.acceptance=[];
  db.prepare("UPDATE decision_packages SET body_json=?,digest=? WHERE id=? AND revision=?").run(JSON.stringify(body),digest,t.package_id,t.package_rev);
  db.prepare("UPDATE tasks SET package_digest=? WHERE id=?").run(digest,TASK);
 }
 db.prepare("INSERT INTO tier1_runs(id,task_id,attempt,adapter,cwd,worktree_path,tree_sha,state,settle_proof_json,created_at,updated_at) VALUES (?,?,2,'cursor','.','.',?,'settled_review',?,?,?)").run(runId,TASK,proof.treeSha,JSON.stringify(proof),NOW,NOW);
 const add=(action:string,id=runId)=>db.prepare("INSERT INTO audit_log(id,ts,actor,action,meta_json) VALUES (?,?,'daemon',?,?)").run(newId("aud"),NOW,action,JSON.stringify({taskId:TASK,runId:id}));
 if(terminal!=="missing")add(terminal==="mismatch"?"tier1.failed":"tier1.settled_review");
 if(terminal==="conflict")add("tier1.failed");if(terminal==="duplicate")add("tier1.settled_review");
 return {db,proof,runId,add,audit:createSqliteAuditSink(db)};
}
function snapshot(db:Db){
 const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as {name:string}[];
 return Object.fromEntries(tables.map(({name})=>[name,db.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'"').all()]));
}
describe("批准独立核对当前 run 终态",()=>{
 for(const source of ["manual","agent_claim","empty"] as const){
  it.each(["conflict","duplicate","mismatch"] as const)(`${source} 无ref的 %s 必须409且全表不变`,terminal=>{
   const {db,audit,runId}=seed(source,terminal);const before=snapshot(db);
   const detail=getTaskDetail(db,TASK)!;const response=handleTaskAction(db,audit,TASK,"review",{verdict:"approve",expectedAttempt:2},NOW);
   console.log(JSON.stringify({source,terminal,response:response.status,statusAfter:(db.prepare("SELECT status FROM tasks WHERE id=?").get(TASK) as {status:string}).status,conflict:(detail["runs"] as {id:string;evidence_conflict:boolean}[]).find(r=>r.id===runId)!.evidence_conflict}));
   expect(response.status).toBe(409);expect(snapshot(db)).toEqual(before);
  });
  it.each(["single","missing"] as const)(`${source} 合法 %s 终态仍可人工批准`,terminal=>{
   const {db,audit}=seed(source,terminal);expect(handleTaskAction(db,audit,TASK,"review",{verdict:"approve",expectedAttempt:2},NOW).status).toBe(200);
  });
 }
 it("较旧run的冲突不污染合法新run",()=>{
  const {db,audit,proof,add}=seed("manual","conflict");const next=newId("run");const nextProof={...proof,attempt:3,runId:next};
  db.prepare("INSERT INTO tier1_runs(id,task_id,attempt,adapter,cwd,worktree_path,tree_sha,state,settle_proof_json,created_at,updated_at) VALUES (?,?,3,'cursor','.','.',?,'settled_review',?,?,?)").run(next,TASK,nextProof.treeSha,JSON.stringify(nextProof),NOW,NOW);
  add("tier1.settled_review",next);expect(handleTaskAction(db,audit,TASK,"review",{verdict:"approve",expectedAttempt:3},NOW).status).toBe(200);
 });
});
