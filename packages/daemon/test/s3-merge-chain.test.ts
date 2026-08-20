// §12-13 S3 合并链反例集(09 §3.3 契约测试句逐条收编;W4 3.1 验收锚):
// 基础 7 条 + A1 增 10 条 + A2 增 9 条 + 迁移对账 + 崩溃恢复。
// 全部走真实密码学(fake authenticator = 真 P-256 签名),不 mock 验签。

import Database from "better-sqlite3";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { textDigest } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { MIGRATIONS } from "../src/storage/ddl.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { insertProject } from "../src/storage/dao/projects.js";
import { canonicalizeWorkspace, managedProjectPath } from "../src/projects/workspace.js";
import { transitionTask } from "../src/storage/dao/tasks.js";
import { getApproval } from "../src/storage/dao/approvals.js";
import { getS3Challenge } from "../src/storage/dao/webauthn.js";
import { assertS3LocalAndBound } from "../src/net/s3Guard.js";
import { handleS3Route } from "../src/api/s3Routes.js";
import {
  approveMerge,
  executeMergeSegment,
  issueS3Challenge,
  registerWebauthn,
  verifyS3Assertion,
  S3ToolError,
  type S3Deps
} from "../src/tier1/s3Tools.js";
import { RuntimeApprovalFlow } from "../src/tier1/approvalFlow.js";
import { FakeAuthenticator } from "./helpers/fakeWebauthn.js";

const ORIGIN = "http://localhost:47100";
const RP = "localhost";
const PRJ = "prj_01S3CHA1N00000000000000000";
const OWNER_TEST_ROOT = mkdtempSync(join(process.cwd(), ".saydo-s3-merge-"));

let home: string;
let db: Db;
let deps: S3Deps;
let clock: Date;

function now(): Date {
  return clock;
}

function tick(ms: number): void {
  clock = new Date(clock.getTime() + ms);
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "saydo-s3-"));
  db = openDb(join(home, "saydo.db"));
  clock = new Date("2026-07-27T12:00:00.000Z");
  deps = { db, audit: createSqliteAuditSink(db), now };
  insertProject(db, {
    id: PRJ,
    title: "S3 链",
    type: "coding",
    status: "active",
    workspace: { kind: "local_folder", path: managedProjectPath(PRJ), managed: true },
    executionModeDefault: "step_confirm",
    createdAt: clock.toISOString(),
    updatedAt: clock.toISOString()
  });
});

afterAll(() => {
  rmSync(OWNER_TEST_ROOT, { recursive: true, force: true });
});

/** 造 review_approved_waiting_merge 任务 + settled_review run(S3 卡的前置态) */
function seedWaitingMergeTask(over: { route?: string; status?: string; treeSha?: string; suffix?: string } = {}): {
  taskId: string;
  runId: string;
  treeSha: string;
  evidenceDigest: string;
} {
  const sfx = over.suffix ?? "0";
  const taskId = `tsk_01S3CHA1NTASK000000000000${sfx}`;
  const runId = `run_01S3CHA1NRUN0000000000000${sfx}`;
  const treeSha = over.treeSha ?? "a".repeat(40);
  const verifyDigest = textDigest(`verify-payload-${taskId}`);
  const nowIso = clock.toISOString();
  db.prepare(
    `INSERT INTO tasks(id, project_id, package_id, package_rev, package_digest, title, spec_markdown, route, status,
       adapter, cwd, budget_json, created_at, updated_at)
     VALUES (?, ?, 'pkg_01S3CHA1N00000000000000000', 1, ?, 'S3 演练', 'spec', ?, ?, ?, '/tmp/wt', '{"walltimeActiveMin":45,"maxTurns":40,"maxCost":20}', ?, ?)`
  ).run(
    taskId,
    PRJ,
    "sha256:" + "9".repeat(64),
    over.route ?? "tier1",
    over.status ?? "review_approved_waiting_merge",
    over.route === "hopper" ? null : "cursor",
    nowIso,
    nowIso
  );
  const proof = JSON.stringify({
    taskId,
    runId,
    attempt: 1,
    packageRevision: 1,
    treeSha,
    tier1VerifyDigest: verifyDigest,
    transcriptCursor: `events:${runId}:line:1`,
    settledAt: nowIso
  });
  db.prepare(
    `INSERT INTO tier1_runs(id, task_id, attempt, adapter, cwd, worktree_path, tree_sha, state, settle_proof_json, created_at, updated_at)
     VALUES (?, ?, 1, 'cursor', '/tmp/wt', '/tmp/wt', ?, 'settled_review', ?, ?, ?)`
  ).run(runId, taskId, treeSha, proof, nowIso, nowIso);
  return { taskId, runId, treeSha, evidenceDigest: verifyDigest };
}

/** 注册一枚凭据(合法链) */
function register(auth: FakeAuthenticator): void {
  const ch = issueS3Challenge(deps, { action: "register" });
  registerWebauthn(deps, { challengeId: ch.challengeId, attestation: auth.attest(ch.challenge, ORIGIN, RP) }, { origin: ORIGIN });
}

/** 走完整签发链拿一张 S3MergeReceipt */
function issueReceipt(auth: FakeAuthenticator, taskId: string): string {
  const ch = issueS3Challenge(deps, { action: "merge", taskId });
  const receipt = verifyS3Assertion(
    deps,
    { challengeId: ch.challengeId, assertion: auth.assert(ch.challenge, ORIGIN, RP) },
    { origin: ORIGIN }
  );
  return receipt.id;
}

describe("§12-13 基础 7 条", () => {
  it("1 challenge 重放拒:同 challenge 二次断言 ⇒ 拒(单次消费)", () => {
    const auth = new FakeAuthenticator();
    register(auth);
    const t = seedWaitingMergeTask();
    const ch = issueS3Challenge(deps, { action: "merge", taskId: t.taskId });
    const a = auth.assert(ch.challenge, ORIGIN, RP);
    verifyS3Assertion(deps, { challengeId: ch.challengeId, assertion: a }, { origin: ORIGIN });
    expect(() => verifyS3Assertion(deps, { challengeId: ch.challengeId, assertion: a }, { origin: ORIGIN })).toThrow(
      /已消费/
    );
  });

  it("2 signCount 回退拒(received>0 须 > stored;回退 = 可能克隆)", () => {
    const auth = new FakeAuthenticator();
    register(auth);
    const t = seedWaitingMergeTask();
    // 第一次断言 signCount=5(合法:>0 且 > stored=0)
    const ch1 = issueS3Challenge(deps, { action: "merge", taskId: t.taskId });
    verifyS3Assertion(
      deps,
      { challengeId: ch1.challengeId, assertion: auth.assert(ch1.challenge, ORIGIN, RP, { signCount: 5 }) },
      { origin: ORIGIN }
    );
    // 第二次回退到 3 ⇒ 拒
    const ch2 = issueS3Challenge(deps, { action: "merge", taskId: t.taskId });
    expect(() =>
      verifyS3Assertion(
        deps,
        { challengeId: ch2.challengeId, assertion: auth.assert(ch2.challenge, ORIGIN, RP, { signCount: 3 }) },
        { origin: ORIGIN }
      )
    ).toThrow(/signCount regression/);
  });

  it("2b 平台 passkey 恒 0 分支:received=0 ∧ stored=0 ⇒ 跳过克隆检测并诚实记账", () => {
    const auth = new FakeAuthenticator(); // signCount 恒 0
    register(auth);
    const t = seedWaitingMergeTask();
    issueReceipt(auth, t.taskId);
    const note = db
      .prepare("SELECT meta_json FROM audit_log WHERE action='s3.receipt_issued' ORDER BY ts DESC LIMIT 1")
      .get() as { meta_json: string };
    expect(JSON.parse(note.meta_json).cloneNote).toBe("clone_check_unavailable");
  });

  it("3 过期 challenge 拒(120s 窗;过期即废)", () => {
    const auth = new FakeAuthenticator();
    register(auth);
    const t = seedWaitingMergeTask();
    const ch = issueS3Challenge(deps, { action: "merge", taskId: t.taskId });
    tick(121_000);
    expect(() =>
      verifyS3Assertion(deps, { challengeId: ch.challengeId, assertion: auth.assert(ch.challenge, ORIGIN, RP) }, { origin: ORIGIN })
    ).toThrow(/过期/);
  });

  it("4 rpId 不匹配拒(authenticatorData rpIdHash 非 localhost)", () => {
    const auth = new FakeAuthenticator();
    register(auth);
    const t = seedWaitingMergeTask();
    const ch = issueS3Challenge(deps, { action: "merge", taskId: t.taskId });
    expect(() =>
      verifyS3Assertion(
        deps,
        { challengeId: ch.challengeId, assertion: auth.assert(ch.challenge, ORIGIN, "evil.example") },
        { origin: ORIGIN }
      )
    ).toThrow(/s3_auth_failed|rpIdHash/);
  });

  it("5 tailnet 来源发 S3 卡拒(assertS3LocalAndBound ③)", () => {
    const v = assertS3LocalAndBound({ socketRemoteAddress: "127.0.0.1", origin: ORIGIN, via: "tailnet", port: 47100 });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("s3_requires_trusted_terminal");
    // HTTP 承载同语义(handleS3Route 403 + 审计)
    const out = handleS3Route(
      { db, audit: deps.audit, runsDir: join(home, "runs") },
      {
        method: "POST",
        pathname: "/api/s3/challenge",
        body: { action: "register" },
        guard: { socketRemoteAddress: "127.0.0.1", origin: ORIGIN, via: "tailnet", port: 47100 }
      }
    );
    expect(out?.status).toBe(403);
  });

  it("6 无 S3 收据进 merging 拒(DAO 直改被状态机 receipt-gate 拒)", () => {
    const t = seedWaitingMergeTask();
    expect(() => transitionTask(db, t.taskId, "merging", "L", { now: clock.toISOString() })).toThrow(/illegal task transition/);
    const status = (db.prepare("SELECT status FROM tasks WHERE id=?").get(t.taskId) as { status: string }).status;
    expect(status).toBe("review_approved_waiting_merge");
  });

  it("7 merge treeSha 不匹配拒(执行段:worktree 树漂移 ⇒ merge_failed,不落 task_done)", () => {
    // 真 git 仓:repo + worktree,批准后篡改 worktree ⇒ 树漂移
    const g = seedGitTask();
    const auth = new FakeAuthenticator();
    register(auth);
    const rid = issueReceipt(auth, g.taskId);
    approveMerge(deps, { taskId: g.taskId, s3ReceiptId: rid });
    writeFileSync(join(g.worktree, "tampered.txt"), "post-approval tamper\n");
    const res = executeMergeSegment({ db, audit: deps.audit, runsDir: g.runsDir, now }, g.taskId);
    expect(res.state).toBe("merge_failed");
    expect(res.reason).toMatch(/树漂移/);
  });
});

// ---- 真 git 基建(执行段用例:#7 反例 + 全链正例) ----
function seedGitTask(): { taskId: string; repo: string; worktree: string; runsDir: string; treeSha: string } {
  const repo = mkdtempSync(join(OWNER_TEST_ROOT, "repo-"));
  const git = (args: string[], cwd = repo): string => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  git(["init", "-q", "-b", "main"]);
  git(["config", "user.email", "t@t"]);
  git(["config", "user.name", "t"]);
  writeFileSync(join(repo, "a.txt"), "base\n");
  git(["add", "-A"]);
  git(["commit", "-q", "-m", "base"]);
  const taskId = `tsk_01S3CHA1NGIT00000000000000`;
  const worktree = join(repo, ".saydo", "worktrees", taskId);
  mkdirSync(join(repo, ".saydo", "worktrees"), { recursive: true });
  git(["worktree", "add", "-q", "-b", `saydo/${taskId}`, worktree, "HEAD"]);
  writeFileSync(join(worktree, "a.txt"), "base\nagent change\n");
  execFileSync("git", ["add", "-A"], { cwd: worktree });
  const treeSha = git(["write-tree"], worktree);
  // 项目工作区指向真 repo
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
    PRJ
  );
  const t = seedWaitingMergeTask({ treeSha, suffix: "G" });
  db.prepare("UPDATE tier1_runs SET worktree_path=? WHERE task_id=?").run(worktree, t.taskId);
  // 冻结 verify(恒真命令;执行段重跑)
  const runsDir = join(home, "runs");
  mkdirSync(join(runsDir, t.runId), { recursive: true });
  writeFileSync(join(runsDir, t.runId, "frozen-verify.json"), JSON.stringify([{ templateRef: "noop", argv: ["git", "--version"] }]));
  return { taskId: t.taskId, repo, worktree, runsDir, treeSha };
}

describe("§12-13 A1 增(approveMerge 事务合同)", () => {
  it("8 generic screen 收据(无 s3 判别域)调 approveMerge 拒(not_s3_merge_receipt)", () => {
    const t = seedWaitingMergeTask();
    // 造一张合法 S2 screen 收据(insertApproval 走 schema;S3 无 s3 域在 DDL/schema 已双拒,退一档用 S2)
    const rid = "apr_01S3CHA1NGENER000000000000";
    db.prepare(
      `INSERT INTO approvals(id, kind, ref_digest, parent_package_digest, task_id, risk, decided_via, auth_strength,
         decision, nonce, outcome, issued_at, expires_at)
       VALUES (?, 'runtime_effect', ?, ?, ?, 'S2', 'screen', 'screen_authenticated', 'accept', 'n-generic', 'pending', ?, ?)`
    ).run(rid, "sha256:" + "b".repeat(64), "sha256:" + "9".repeat(64), t.taskId, clock.toISOString(), new Date(clock.getTime() + 120_000).toISOString());
    expect(() => approveMerge(deps, { taskId: t.taskId, s3ReceiptId: rid })).toThrow(/not_s3_merge_receipt|不构成/);
  });

  it("9 S2 收据冒充 S3 拒(DDL+工具双层:直插 S3 无六列被 DDL 拒;S2 收据过工具判别拒)", () => {
    // DDL 层(storage-checks 已详测,此处链上复证)
    expect(() =>
      db
        .prepare(
          `INSERT INTO approvals(id, kind, ref_digest, parent_package_digest, task_id, risk, decided_via, auth_strength, nonce, outcome, issued_at, expires_at)
           VALUES ('apr_01S3CHA1NFAKE0000000000000', 'runtime_effect', 'sha256:${"b".repeat(64)}', 'sha256:${"9".repeat(64)}', 'tsk_x', 'S3', 'screen', 'os_biometric', 'n-fake', 'pending', '${clock.toISOString()}', '${clock.toISOString()}')`
        )
        .run()
    ).toThrow(/CHECK/);
  });

  it("10 收据跨 task 拒;attempt/packageRevision 失配拒(全匹配域)", () => {
    const auth = new FakeAuthenticator();
    register(auth);
    const t1 = seedWaitingMergeTask({ suffix: "1" });
    const t2 = seedWaitingMergeTask({ suffix: "2" });
    const rid = issueReceipt(auth, t1.taskId);
    // 跨 task:t1 的收据批 t2
    expect(() => approveMerge(deps, { taskId: t2.taskId, s3ReceiptId: rid })).toThrow(/不属于该任务|receipt_task_mismatch/);
    // 收据未被消费(整体回滚)
    expect(getApproval(db, rid)?.outcome).toBe("pending");
    // packageRevision 失配:签发后包 rev 漂移
    db.prepare("UPDATE tasks SET package_rev=2 WHERE id=?").run(t1.taskId);
    expect(() => approveMerge(deps, { taskId: t1.taskId, s3ReceiptId: rid })).toThrow(/packageRevision|revision/);
    expect(getApproval(db, rid)?.outcome).toBe("pending");
  });

  it("11 prospectiveTreeSha 与 run tree_sha 不符拒", () => {
    const auth = new FakeAuthenticator();
    register(auth);
    const t = seedWaitingMergeTask();
    const rid = issueReceipt(auth, t.taskId);
    db.prepare("UPDATE tier1_runs SET tree_sha=? WHERE task_id=?").run("f".repeat(40), t.taskId);
    expect(() => approveMerge(deps, { taskId: t.taskId, s3ReceiptId: rid })).toThrow(/tree/);
    expect(getApproval(db, rid)?.outcome).toBe("pending"); // 回滚
  });

  it("12 并发双 approveMerge 恰一成功(CAS changes=1;第二张收据不消费)", () => {
    const auth = new FakeAuthenticator();
    register(auth);
    const t = seedWaitingMergeTask();
    const rid1 = issueReceipt(auth, t.taskId);
    const rid2 = issueReceipt(auth, t.taskId); // 两张收据(两次挑战)同时在手
    expect(approveMerge(deps, { taskId: t.taskId, s3ReceiptId: rid1 }).state).toBe("merging");
    expect(() => approveMerge(deps, { taskId: t.taskId, s3ReceiptId: rid2 })).toThrow(/不在待合并态|not_awaiting/);
    expect(getApproval(db, rid1)?.outcome).toBe("consumed");
    expect(getApproval(db, rid2)?.outcome).toBe("pending"); // 任务 CAS 失败 ⇒ 消费回滚
  });

  it("13 已消费收据二次使用拒", () => {
    const auth = new FakeAuthenticator();
    register(auth);
    const t = seedWaitingMergeTask();
    const rid = issueReceipt(auth, t.taskId);
    approveMerge(deps, { taskId: t.taskId, s3ReceiptId: rid });
    // 任务放回待合并态(模拟重批场景),同收据再来 ⇒ 消费 CAS 拒
    db.prepare("UPDATE tasks SET status='review_approved_waiting_merge' WHERE id=?").run(t.taskId);
    expect(() => approveMerge(deps, { taskId: t.taskId, s3ReceiptId: rid })).toThrow(/不可消费/);
  });

  it("14 收据自身过期拒(与 challenge 过期独立)", () => {
    const auth = new FakeAuthenticator();
    register(auth);
    const t = seedWaitingMergeTask();
    const rid = issueReceipt(auth, t.taskId); // 收据 expiresAt = +120s
    tick(121_000);
    expect(() => approveMerge(deps, { taskId: t.taskId, s3ReceiptId: rid })).toThrow(/不可消费/);
    expect(getApproval(db, rid)?.outcome).toBe("pending"); // 未消费(过期由 CAS WHERE 挡)
  });

  it("15 非 review_approved_waiting_merge 态 approveMerge 拒", () => {
    const auth = new FakeAuthenticator();
    register(auth);
    const t = seedWaitingMergeTask();
    const rid = issueReceipt(auth, t.taskId);
    db.prepare("UPDATE tasks SET status='ready_for_review' WHERE id=?").run(t.taskId);
    expect(() => approveMerge(deps, { taskId: t.taskId, s3ReceiptId: rid })).toThrow(/不在待合并态|not_awaiting/);
    expect(getApproval(db, rid)?.outcome).toBe("pending");
  });

  it("16 route=hopper 调 approveMerge 拒(Hopper 路径恒人工交接,红线③)", () => {
    // hopper 任务连挑战都发不出(issueS3Challenge 拒)
    seedWaitingMergeTask({ route: "hopper", suffix: "H" });
    expect(() => issueS3Challenge(deps, { action: "merge", taskId: "tsk_01S3CHA1NTASK000000000000H" })).toThrow(
      /人工交接|route_not_tier1/
    );
    // 就算凭空有收据,任务 CAS 的 route='tier1' 条件也挡(③ WHERE 内)——用 tier1 收据打 hopper 任务复证
    const auth = new FakeAuthenticator();
    register(auth);
    const t = seedWaitingMergeTask({ suffix: "T" });
    const rid = issueReceipt(auth, t.taskId);
    db.prepare("UPDATE tasks SET route='hopper', adapter=NULL WHERE id=?").run(t.taskId);
    expect(() => approveMerge(deps, { taskId: t.taskId, s3ReceiptId: rid })).toThrow(/不在待合并态|not_awaiting/);
  });

  it("17 崩溃注入等价(事务原子):全匹配失败 ⇒ 收据消费与任务转移整体回滚(收据仍 pending·任务仍 waiting)", () => {
    const auth = new FakeAuthenticator();
    register(auth);
    const t = seedWaitingMergeTask();
    const rid = issueReceipt(auth, t.taskId);
    // 在 ②③ 之后的 ④ 全匹配处失败(篡改收据 attempt)⇒ 断言 ②③ 的写全部回滚
    db.prepare("UPDATE approvals SET attempt=99 WHERE id=?").run(rid);
    expect(() => approveMerge(deps, { taskId: t.taskId, s3ReceiptId: rid })).toThrow(/attempt/);
    expect(getApproval(db, rid)?.outcome).toBe("pending");
    expect((db.prepare("SELECT status FROM tasks WHERE id=?").get(t.taskId) as { status: string }).status).toBe(
      "review_approved_waiting_merge"
    );
    expect(getApproval(db, rid)?.consumedAt).toBeUndefined();
  });
});

describe("§12-13 A2 增(注册链/守卫面)", () => {
  it("18 register 链绝不产生 ApprovalReceipt(注册断言 ≠ runtime 批准)", () => {
    const before = (db.prepare("SELECT COUNT(*) AS c FROM approvals").get() as { c: number }).c;
    const auth = new FakeAuthenticator();
    register(auth);
    const after = (db.prepare("SELECT COUNT(*) AS c FROM approvals").get() as { c: number }).c;
    expect(after).toBe(before);
  });

  it("19 已有 active 凭据再发 register 挑战拒(bootstrap 一次性)", () => {
    const auth = new FakeAuthenticator();
    register(auth);
    expect(() => issueS3Challenge(deps, { action: "register" })).toThrow(/已有活跃/);
  });

  it("20/21 挑战 DDL CHECK(merge 缺绑定/register 带绑定)在 schema 层同源拒", () => {
    // zod 层(DDL 层在 storage-checks 已测;schema 同源投影此处断言)
    expect(() =>
      issueS3Challenge(deps, { action: "merge" } as never)
    ).toThrow(); // merge 缺 taskId 直接 schema 拒
  });

  it("22 无 Origin 请求 S3 面拒(CLI 式请求一律拒)", () => {
    const v = assertS3LocalAndBound({ socketRemoteAddress: "127.0.0.1", origin: undefined, via: "local", port: 47100 });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("s3_origin_rejected");
  });

  it("23 Host/Origin 自报 localhost 但 socket peer 非环回拒(peer 可信优先)", () => {
    const v = assertS3LocalAndBound({ socketRemoteAddress: "192.168.1.50", origin: ORIGIN, via: "local", port: 47100 });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("s3_peer_not_loopback");
    // 127.0.0.1 origin 也拒(rpId=localhost 绑定;页面壳层已归一重定向)
    const v2 = assertS3LocalAndBound({ socketRemoteAddress: "127.0.0.1", origin: "http://127.0.0.1:47100", via: "local", port: 47100 });
    expect(v2.ok).toBe(false);
  });

  it("24 通用 decide 端点对 risk=S3 行拒(approvalFlow.decide 下沉断言)", () => {
    const auth = new FakeAuthenticator();
    register(auth);
    const t = seedWaitingMergeTask();
    const rid = issueReceipt(auth, t.taskId);
    const flow = new RuntimeApprovalFlow({
      db,
      audit: deps.audit,
      confirm: null,
      say: null,
      activeVoiceSession: () => null
    });
    const r = flow.decide(rid, "accept", { via: "screen" });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/S3/);
    expect(getApproval(db, rid)?.outcome).toBe("pending"); // 未被通用面动过
  });

  it("25 入参携带 rpId/refDigest 被 schema 拒(strictObject;绑定对象拒外部注入)", () => {
    const t = seedWaitingMergeTask();
    expect(() => issueS3Challenge(deps, { action: "merge", taskId: t.taskId, rpId: "evil" } as never)).toThrow();
    expect(() => issueS3Challenge(deps, { action: "merge", taskId: t.taskId, refDigest: "sha256:" + "0".repeat(64) } as never)).toThrow();
    expect(() => issueS3Challenge(deps, { action: "register", refDigest: "x" } as never)).toThrow();
  });

  it("26 BE/BS 标志必落账(注册与每次断言;同步凭据诚实条款 ①)", () => {
    const auth = new FakeAuthenticator();
    auth.be = true;
    auth.bs = true;
    register(auth);
    const row1 = db.prepare("SELECT backup_eligible, backup_state FROM webauthn_credentials WHERE status='active'").get() as {
      backup_eligible: number;
      backup_state: number;
    };
    expect(row1.backup_eligible).toBe(1);
    expect(row1.backup_state).toBe(1);
    // 断言时 BS 变化 ⇒ 落账更新
    const t = seedWaitingMergeTask();
    const ch = issueS3Challenge(deps, { action: "merge", taskId: t.taskId });
    verifyS3Assertion(
      deps,
      { challengeId: ch.challengeId, assertion: auth.assert(ch.challenge, ORIGIN, RP, { bs: false }) },
      { origin: ORIGIN }
    );
    const row2 = db.prepare("SELECT backup_state FROM webauthn_credentials WHERE status='active'").get() as { backup_state: number };
    expect(row2.backup_state).toBe(0);
  });

  it("附:验签失败拒(错误私钥);UP=0 拒;UV=0 拒(os_biometric 机械支撑)", () => {
    const auth = new FakeAuthenticator();
    register(auth);
    const t = seedWaitingMergeTask();
    const mk = (): { challengeId: string; challenge: string } => issueS3Challenge(deps, { action: "merge", taskId: t.taskId });
    const c1 = mk();
    expect(() =>
      verifyS3Assertion(
        deps,
        { challengeId: c1.challengeId, assertion: auth.assert(c1.challenge, ORIGIN, RP, { signer: auth.wrongKey() }) },
        { origin: ORIGIN }
      )
    ).toThrow(/s3_auth_failed|signature/);
    const c2 = mk();
    expect(() =>
      verifyS3Assertion(deps, { challengeId: c2.challengeId, assertion: auth.assert(c2.challenge, ORIGIN, RP, { up: false }) }, { origin: ORIGIN })
    ).toThrow(/UP/);
    const c3 = mk();
    expect(() =>
      verifyS3Assertion(deps, { challengeId: c3.challengeId, assertion: auth.assert(c3.challenge, ORIGIN, RP, { uv: false }) }, { origin: ORIGIN })
    ).toThrow(/UV/);
  });
});

describe("§12-13 收编补充:迁移对账 + 崩溃恢复 + 全链正例", () => {
  it("v9 表重建迁移:v4-era 老库前后行数/逐行 digest 对账;老 turn_ref 行放宽后仍原样", () => {
    const home2 = mkdtempSync(join(tmpdir(), "saydo-s3mig-"));
    const dbPath = join(home2, "saydo.db");
    const raw = new Database(dbPath);
    raw.exec(readFileSync(join(import.meta.dirname, "fixtures", "schema-v4-era.sql"), "utf8"));
    for (const v of [1, 2, 3, 4]) raw.prepare("INSERT INTO schema_migrations VALUES (?, ?)").run(v, "2026-07-25T00:00:00Z");
    // 老库三行(voice dispatch / voice runtime / screen dispatch)
    const ins = raw.prepare(
      `INSERT INTO approvals(id, kind, ref_digest, parent_package_digest, task_id, turn_ref, risk, decided_via, auth_strength, nonce, outcome, issued_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '2026-07-25T00:00:00Z', '2026-07-25T00:01:00Z')`
    );
    ins.run("apr_mig1", "dispatch_package", "sha256:" + "1".repeat(64), null, null, "trn_1", "S1", "voice", "voice_weak", "n-mig1", "consumed");
    ins.run("apr_mig2", "runtime_effect", "sha256:" + "2".repeat(64), "sha256:" + "3".repeat(64), "tsk_m", "trn_2", "S2", "voice", "voice_weak", "n-mig2", "pending");
    ins.run("apr_mig3", "dispatch_package", "sha256:" + "4".repeat(64), null, null, null, "S2", "screen", "screen_authenticated", "n-mig3", "rejected");
    const digestBefore = raw
      .prepare("SELECT id, kind, ref_digest, risk, decided_via, auth_strength, nonce, outcome FROM approvals ORDER BY id")
      .all();
    raw.close();
    const migrated = openDb(dbPath); // 全量迁移(5-9)
    const rows = migrated.prepare("SELECT COUNT(*) AS c FROM approvals").get() as { c: number };
    expect(rows.c).toBe(3);
    const digestAfter = migrated
      .prepare("SELECT id, kind, ref_digest, risk, decided_via, auth_strength, nonce, outcome FROM approvals ORDER BY id")
      .all();
    expect(textDigest(JSON.stringify(digestAfter))).toBe(textDigest(JSON.stringify(digestBefore)));
    // 六列存在且老行恒 NULL
    const nulls = migrated.prepare("SELECT COUNT(*) AS c FROM approvals WHERE s3_challenge_id IS NULL").get() as { c: number };
    expect(nulls.c).toBe(3);
    // 新表就位
    for (const tb of ["webauthn_credentials", "s3_challenges"]) {
      expect(migrated.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tb)).toBeTruthy();
    }
    // 放宽后:screen runtime_effect turn_ref NULL 可插(老库迁移后的新能力)
    migrated
      .prepare(
        `INSERT INTO approvals(id, kind, ref_digest, parent_package_digest, risk, decided_via, auth_strength, nonce, outcome, issued_at, expires_at)
         VALUES ('apr_mig4', 'runtime_effect', 'sha256:${"5".repeat(64)}', 'sha256:${"6".repeat(64)}', 'S2', 'screen', 'screen_authenticated', 'n-mig4', 'pending', '2026-07-25T00:00:00Z', '2026-07-25T00:01:00Z')`
      )
      .run();
    migrated.close();
  });

  it("崩溃恢复:挑战签发后断电 ⇒ 过期即废,无孤儿收据", () => {
    const auth = new FakeAuthenticator();
    register(auth);
    const t = seedWaitingMergeTask();
    const ch = issueS3Challenge(deps, { action: "merge", taskId: t.taskId });
    // "断电":什么都不做,时间越过窗口(挑战行留在库里,无收据关联)
    tick(150_000);
    expect(() =>
      verifyS3Assertion(deps, { challengeId: ch.challengeId, assertion: auth.assert(ch.challenge, ORIGIN, RP) }, { origin: ORIGIN })
    ).toThrow(/过期/);
    const orphans = db
      .prepare("SELECT COUNT(*) AS c FROM approvals WHERE s3_challenge_id=?")
      .get(ch.challengeId) as { c: number };
    expect(orphans.c).toBe(0);
    expect(getS3Challenge(db, ch.challengeId)?.consumedAt).toBeUndefined();
  });

  it("全链正例:注册 -> 挑战 -> Touch ID 断言 -> S3MergeReceipt -> approveMerge -> 执行段 -> task_done(主仓树精确落地)", () => {
    const g = seedGitTask();
    const auth = new FakeAuthenticator();
    register(auth);
    const rid = issueReceipt(auth, g.taskId);
    const receipt = getApproval(db, rid);
    expect(receipt?.riskLevel).toBe("S3");
    expect(receipt?.authStrength).toBe("os_biometric");
    expect(receipt?.s3?.prospectiveTreeSha).toBe(g.treeSha);
    expect(approveMerge(deps, { taskId: g.taskId, s3ReceiptId: rid }).state).toBe("merging");
    const res = executeMergeSegment({ db, audit: deps.audit, runsDir: g.runsDir, now }, g.taskId);
    expect(res.state).toBe("task_done");
    const headTree = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { cwd: g.repo, encoding: "utf8" }).trim();
    expect(headTree).toBe(g.treeSha);
    expect((db.prepare("SELECT status FROM tasks WHERE id=?").get(g.taskId) as { status: string }).status).toBe("task_done");
    // 执行段幂等(崩溃重放):再跑一次直接短路 task_done
    db.prepare("UPDATE tasks SET status='merging' WHERE id=?").run(g.taskId);
    expect(executeMergeSegment({ db, audit: deps.audit, runsDir: g.runsDir, now }, g.taskId).state).toBe("task_done");
  });

  it("执行段:主仓批准后有新提交(非快进)⇒ merge_failed(冲突常态转人工)", () => {
    const g = seedGitTask();
    const auth = new FakeAuthenticator();
    register(auth);
    const rid = issueReceipt(auth, g.taskId);
    approveMerge(deps, { taskId: g.taskId, s3ReceiptId: rid });
    // 主仓前移
    writeFileSync(join(g.repo, "b.txt"), "mainline move\n");
    execFileSync("git", ["add", "-A"], { cwd: g.repo });
    execFileSync("git", ["commit", "-q", "-m", "mainline"], { cwd: g.repo });
    const res = executeMergeSegment({ db, audit: deps.audit, runsDir: g.runsDir, now }, g.taskId);
    expect(res.state).toBe("merge_failed");
    expect(res.reason).toMatch(/新提交/);
  });

  it("S3ToolError 形状:s3_auth_failed 错误码照 09 §13(verifyS3Assertion 失败词表)", () => {
    const auth = new FakeAuthenticator();
    register(auth);
    const t = seedWaitingMergeTask();
    const ch = issueS3Challenge(deps, { action: "merge", taskId: t.taskId });
    try {
      verifyS3Assertion(
        deps,
        { challengeId: ch.challengeId, assertion: auth.assert(ch.challenge, ORIGIN, RP, { signer: auth.wrongKey() }) },
        { origin: ORIGIN }
      );
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(S3ToolError);
      expect((e as S3ToolError).code).toBe("s3_auth_failed");
    }
  });
});

describe("RA-closeout · A2 残余(Codex 22:挑战目标绑定固化 + register intent + consumedAt 复验)", () => {
  it("attempt_drift:挑战签发后 run 换代(attempt+1)⇒ verify 拒(固化域交叉断言)", () => {
    const auth = new FakeAuthenticator();
    register(auth);
    const { taskId, treeSha } = seedWaitingMergeTask();
    const ch = issueS3Challenge(deps, { action: "merge", taskId });
    // 换代:插 attempt=2 的 settled run(同 tree/同 verify payload ⇒ tree/evidence 断言不触发,attempt 固化断言触发)
    const nowIso = clock.toISOString();
    const proof2 = JSON.stringify({
      taskId, runId: "run_01S3CHA1NRUN0000000000ATT2", attempt: 2, packageRevision: 1, treeSha,
      tier1VerifyDigest: textDigest(`verify-payload-${taskId}`), transcriptCursor: "events:x:line:1", settledAt: nowIso
    });
    db.prepare(
      `INSERT INTO tier1_runs(id, task_id, attempt, adapter, cwd, worktree_path, tree_sha, state, settle_proof_json, created_at, updated_at)
       VALUES ('run_01S3CHA1NRUN0000000000ATT2', ?, 2, 'cursor', '/tmp/wt', '/tmp/wt', ?, 'settled_review', ?, ?, ?)`
    ).run(taskId, treeSha, proof2, nowIso, nowIso);
    try {
      verifyS3Assertion(deps, { challengeId: ch.challengeId, assertion: auth.assert(ch.challenge, ORIGIN, RP) }, { origin: ORIGIN });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(S3ToolError);
      expect((e as S3ToolError).code).toBe("attempt_drift");
    }
  });

  it("revision_drift:挑战签发后包换版(package_rev+1)⇒ verify 拒", () => {
    const auth = new FakeAuthenticator();
    register(auth);
    const { taskId } = seedWaitingMergeTask({ suffix: "R" });
    const ch = issueS3Challenge(deps, { action: "merge", taskId });
    db.prepare("UPDATE tasks SET package_rev=2 WHERE id=?").run(taskId);
    try {
      verifyS3Assertion(deps, { challengeId: ch.challengeId, assertion: auth.assert(ch.challenge, ORIGIN, RP) }, { origin: ORIGIN });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(S3ToolError);
      expect((e as S3ToolError).code).toBe("revision_drift");
    }
  });

  it("merge 挑战签发即固化 attempt/packageRevision(库内自取,行可查)", () => {
    const { taskId } = seedWaitingMergeTask({ suffix: "F" });
    const ch = issueS3Challenge(deps, { action: "merge", taskId });
    const row = db.prepare("SELECT attempt, package_revision FROM s3_challenges WHERE id=?").get(ch.challengeId) as {
      attempt: number;
      package_revision: number;
    };
    expect(row).toEqual({ attempt: 1, package_revision: 1 });
  });

  it("register 无 console 会话 ⇒ daemon 生成 bootstrapIntentId(行非空)+ s3.bootstrap_intent 审计", () => {
    const ch = issueS3Challenge(deps, { action: "register" });
    const row = db.prepare("SELECT session_id, bootstrap_intent_id FROM s3_challenges WHERE id=?").get(ch.challengeId) as {
      session_id: string | null;
      bootstrap_intent_id: string | null;
    };
    expect(row.session_id).toBeNull();
    expect(row.bootstrap_intent_id).toMatch(/^s3i_/u);
    const n = (db.prepare("SELECT COUNT(*) AS c FROM audit_log WHERE action='s3.bootstrap_intent'").get() as { c: number }).c;
    expect(n).toBe(1);
  });

  it("register 挑战带 project_id 被 DDL 拒(v12 CHECK:register 必须 task/project/tree 全空)", () => {
    expect(() =>
      db
        .prepare(
          `INSERT INTO s3_challenges(id, challenge, action, ref_digest, project_id, session_id, expires_at, created_at)
           VALUES ('s3c_01RACLOSEOUTDDL000000000', 'chx', 'register', 'sha256:${"a".repeat(64)}', '${PRJ}', 'ses_x', ?, ?)`
        )
        .run(clock.toISOString(), clock.toISOString())
    ).toThrow(/CHECK/u);
  });

  it("consumedAt 复验(A1-B):收据挑战链未消费 = provenance 异常 ⇒ approveMerge 拒 + 审计", () => {
    const auth = new FakeAuthenticator();
    register(auth);
    const { taskId } = seedWaitingMergeTask({ suffix: "C" });
    const receiptId = issueReceipt(auth, taskId);
    // 模拟 raw-DB 异常形态:挑战 consumed_at 被抹(正常签发链同事务消费,生产不可达)
    const chId = (db.prepare("SELECT s3_challenge_id AS c FROM approvals WHERE id=?").get(receiptId) as { c: string }).c;
    db.prepare("UPDATE s3_challenges SET consumed_at=NULL WHERE id=?").run(chId);
    try {
      approveMerge(deps, { taskId, s3ReceiptId: receiptId });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(S3ToolError);
      expect((e as S3ToolError).code).toBe("not_s3_merge_receipt");
    }
    const n = (
      db.prepare("SELECT COUNT(*) AS c FROM audit_log WHERE action='s3.approve_merge_rejected' AND meta_json LIKE '%not_s3_merge_receipt%'").get() as { c: number }
    ).c;
    expect(n).toBe(1); // 留痕在事务外 catch 审计(不随回滚消失)
  });
});
