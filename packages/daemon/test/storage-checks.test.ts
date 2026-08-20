// 0.3 验收:非法直写被 DDL CHECK/UNIQUE/NOT NULL 拒(绕过 DAO 的原始 SQL 层反例)。
// 覆盖:S3 非 screen / voice 缺 turn_ref / push+S3 / forget_hard 缺 generation / 空 payload tombstone /
//       route×adapter / subscription 记账形状 / outbox 活跃唯一(dedupe NOT NULL)/ nonce UNIQUE。

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../src/storage/db.js";

let db: Db;
beforeEach(() => {
  db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-ck-")), "saydo.db"));
});

function insertApprovalRaw(over: Record<string, unknown> = {}): void {
  const row = {
    id: "apr_" + Math.random().toString(36).slice(2),
    kind: "dispatch_package",
    ref_digest: "sha256:" + "a".repeat(64),
    risk: "S2",
    decided_via: "voice",
    auth_strength: "voice_weak",
    turn_ref: "trn_1",
    nonce: "n-" + Math.random().toString(36).slice(2),
    issued_at: "2026-07-24T00:00:00Z",
    expires_at: "2026-07-24T00:01:00Z",
    ...over
  };
  db.prepare(
    `INSERT INTO approvals(id, kind, ref_digest, risk, decided_via, auth_strength, turn_ref, nonce, issued_at, expires_at,
      parent_package_digest)
     VALUES (@id, @kind, @ref_digest, @risk, @decided_via, @auth_strength, @turn_ref, @nonce, @issued_at, @expires_at,
      @parent_package_digest)`
  ).run({ parent_package_digest: null, ...row });
}

/** W4(09 §3.3):合法 S3 行必须带 s3 判别域六列 + 前置挑战行(FK);本 helper 造全形状 */
function insertS3Legal(db2: Db, over: Record<string, unknown> = {}): void {
  const chId = "s3c_" + Math.random().toString(36).slice(2);
  db2.prepare(
    `INSERT INTO s3_challenges(id, challenge, action, ref_digest, prospective_tree_sha, task_id, project_id, attempt, package_revision, expires_at, consumed_at, created_at)
     VALUES (?, ?, 'merge', ?, ?, 'tsk_ck1', 'prj_ck1', 1, 1, '2026-07-24T00:02:00Z', '2026-07-24T00:00:30Z', '2026-07-24T00:00:00Z')`
  ).run(chId, "ch-" + Math.random().toString(36).slice(2), "sha256:" + "a".repeat(64), "f".repeat(40));
  db2.prepare(
    `INSERT INTO approvals(id, kind, ref_digest, risk, decided_via, auth_strength, turn_ref, nonce, issued_at, expires_at,
       parent_package_digest, task_id, s3_challenge_id, credential_id, assertion_digest, attempt, package_revision, prospective_tree_sha)
     VALUES (@id, @kind, @ref_digest, @risk, @decided_via, @auth_strength, @turn_ref, @nonce, @issued_at, @expires_at,
       @parent_package_digest, @task_id, @s3_challenge_id, @credential_id, @assertion_digest, @attempt, @package_revision, @prospective_tree_sha)`
  ).run({
    id: "apr_" + Math.random().toString(36).slice(2),
    kind: "runtime_effect",
    ref_digest: "sha256:" + "a".repeat(64),
    risk: "S3",
    decided_via: "screen",
    auth_strength: "os_biometric",
    turn_ref: null,
    nonce: "n-" + Math.random().toString(36).slice(2),
    issued_at: "2026-07-24T00:00:00Z",
    expires_at: "2026-07-24T00:02:00Z",
    parent_package_digest: "sha256:" + "b".repeat(64),
    task_id: "tsk_ck1",
    s3_challenge_id: chId,
    credential_id: "cred-b64u",
    assertion_digest: "sha256:" + "c".repeat(64),
    attempt: 1,
    package_revision: 1,
    prospective_tree_sha: "f".repeat(40),
    ...over
  });
}

describe("approvals CHECK(09 §9 合法组合矩阵)", () => {
  it("S3 非 screen 拒(voice/push 皆拒)", () => {
    expect(() => insertApprovalRaw({ risk: "S3" })).toThrow(/CHECK/);
    expect(() =>
      insertApprovalRaw({ risk: "S3", decided_via: "push", auth_strength: "paired_device_pin" })
    ).toThrow(/CHECK/);
  });

  it("W4(09 §3.3 双向 CHECK):generic screen 行标 S3(缺 s3 六列)DDL 拒;全形状合法;非 S3 蹭挑战 id 拒", () => {
    // 旧"裸 S3+screen"行(v9 前合法)现被判别域 CHECK 拒——generic screen 收据 DDL 层即非法(Codex 21 A1)
    expect(() =>
      insertApprovalRaw({ risk: "S3", decided_via: "screen", auth_strength: "screen_authenticated", turn_ref: null })
    ).toThrow(/CHECK/);
    // 全形状合法(runtime_effect + os_biometric + 六列 + 挑战行 FK;turn_ref NULL 合法 = §9 放宽)
    insertS3Legal(db);
    // 缺任一判别列拒(抽查三列)
    expect(() => insertS3Legal(db, { credential_id: null })).toThrow(/CHECK/);
    expect(() => insertS3Legal(db, { prospective_tree_sha: null })).toThrow(/CHECK/);
    expect(() => insertS3Legal(db, { attempt: null })).toThrow(/CHECK/);
    // 非 S3 行蹭 s3_challenge_id 拒(双向 CHECK 反向)
    expect(() =>
      insertS3Legal(db, { risk: "S2", auth_strength: "screen_authenticated" })
    ).toThrow(/CHECK/);
  });

  it("W4(09 §9 UNIQUE):同一挑战二次签收据拒(一挑战至多一收据,防双签)", () => {
    const chId = "s3c_dup000000000000000000000001";
    db.prepare(
      `INSERT INTO s3_challenges(id, challenge, action, ref_digest, prospective_tree_sha, task_id, project_id, attempt, package_revision, expires_at, consumed_at, created_at)
       VALUES (?, 'ch-dup', 'merge', ?, ?, 'tsk_ck1', 'prj_ck1', 1, 1, '2026-07-24T00:02:00Z', NULL, '2026-07-24T00:00:00Z')`
    ).run(chId, "sha256:" + "a".repeat(64), "f".repeat(40));
    insertS3Legal(db, { s3_challenge_id: chId });
    expect(() => insertS3Legal(db, { s3_challenge_id: chId })).toThrow(/UNIQUE/);
  });

  it("W4(09 §9 s3_challenges CHECK):merge 挑战缺 task/tree 绑定拒;register 挑战带 taskId 拒", () => {
    const ins = (over: Record<string, unknown>): void => {
      db.prepare(
        `INSERT INTO s3_challenges(id, challenge, action, ref_digest, prospective_tree_sha, task_id, project_id, attempt, package_revision, session_id, expires_at, created_at)
         VALUES (@id, @challenge, @action, @ref_digest, @prospective_tree_sha, @task_id, @project_id, @attempt, @package_revision, @session_id, '2026-07-24T00:02:00Z', '2026-07-24T00:00:00Z')`
      ).run({
        id: "s3c_" + Math.random().toString(36).slice(2),
        challenge: "ch-" + Math.random().toString(36).slice(2),
        action: "merge",
        ref_digest: "sha256:" + "a".repeat(64),
        prospective_tree_sha: "f".repeat(40),
        task_id: "tsk_ck1",
        project_id: "prj_ck1",
        attempt: 1,
        package_revision: 1,
        session_id: "ses_ck1",
        ...over
      });
    };
    expect(() => ins({ task_id: null })).toThrow(/CHECK/); // merge 缺 task 绑定
    expect(() => ins({ prospective_tree_sha: null })).toThrow(/CHECK/); // merge 缺 tree 绑定
    expect(() => ins({ action: "register", prospective_tree_sha: null })).toThrow(/CHECK/); // register 带 taskId
    ins({ action: "register", task_id: null, project_id: null, prospective_tree_sha: null }); // register 合法形(v12:project 必空 + session 已带)
    expect(() => ins({ action: "register", task_id: null, prospective_tree_sha: null })).toThrow(/CHECK/); // register 带 project 拒(v12)
    expect(() => ins({ action: "register", task_id: null, project_id: null, prospective_tree_sha: null, session_id: null })).toThrow(/CHECK/); // register 无 session/intent 拒(v12)
    expect(() => ins({ action: "bless" })).toThrow(/CHECK/); // 词表外
  });

  it("W4(09 §9 webauthn_credentials):单活跃凭据部分唯一索引;BE/BS 词表;status 词表", () => {
    const insCred = (over: Record<string, unknown> = {}): void => {
      db.prepare(
        `INSERT INTO webauthn_credentials(id, credential_id, public_key_cose, sign_count, principal, rp_id, backup_eligible, backup_state, status, created_at)
         VALUES (@id, @credential_id, @public_key_cose, 0, 'owner', 'localhost', @backup_eligible, @backup_state, @status, '2026-07-24T00:00:00Z')`
      ).run({
        id: "cred_" + Math.random().toString(36).slice(2),
        credential_id: "cid-" + Math.random().toString(36).slice(2),
        public_key_cose: "cose-b64u",
        backup_eligible: 1,
        backup_state: 1,
        status: "active",
        ...over
      });
    };
    insCred();
    expect(() => insCred()).toThrow(/UNIQUE/); // 第二条 active 拒(bootstrap 一次性的 DDL 机械承载)
    insCred({ status: "revoked" }); // revoked 行不占活跃索引
    expect(() => insCred({ status: "dormant" })).toThrow(/CHECK/);
    expect(() => insCred({ status: "revoked", backup_eligible: 2 })).toThrow(/CHECK/);
  });

  it("voice 裁决缺 turn_ref 拒(SOL 反例 voice_dispatch_null_turn_ref)", () => {
    expect(() => insertApprovalRaw({ turn_ref: null })).toThrow(/CHECK/);
  });

  it("voice 非 voice_weak 拒;push 非 paired_device_pin 拒", () => {
    expect(() => insertApprovalRaw({ auth_strength: "screen_authenticated" })).toThrow(/CHECK/);
    expect(() => insertApprovalRaw({ decided_via: "push", auth_strength: "voice_weak" })).toThrow(/CHECK/);
  });

  it("preauthorized 必须 runtime_effect + 父包 digest;缺任一拒", () => {
    expect(() =>
      insertApprovalRaw({ decided_via: "preauthorized", auth_strength: "voice_weak", turn_ref: null })
    ).toThrow(/CHECK/);
    insertApprovalRaw({
      kind: "runtime_effect",
      decided_via: "preauthorized",
      auth_strength: "voice_weak",
      turn_ref: null,
      parent_package_digest: "sha256:" + "b".repeat(64)
    });
  });

  it("W4(09 §3.3 turn_ref 放宽):voice runtime_effect 缺 turn_ref 仍拒;screen runtime_effect 缺 turn_ref 合法", () => {
    // voice 行强制不变(一切语音裁决须绑转写轮)
    expect(() =>
      insertApprovalRaw({ kind: "runtime_effect", turn_ref: null, parent_package_digest: "sha256:" + "b".repeat(64) })
    ).toThrow(/CHECK/);
    // 旧 "runtime_effect 非预授权须绑 turn_ref" CHECK 已删(additive 放宽):screen 行 turn_ref NULL 合法
    insertApprovalRaw({
      kind: "runtime_effect",
      decided_via: "screen",
      auth_strength: "screen_authenticated",
      turn_ref: null,
      parent_package_digest: "sha256:" + "b".repeat(64)
    });
  });

  it("nonce UNIQUE:重复 nonce 拒", () => {
    insertApprovalRaw({ nonce: "same-nonce" });
    expect(() => insertApprovalRaw({ nonce: "same-nonce" })).toThrow(/UNIQUE/);
  });

  it("screen 弱认证拒(09 §3 矩阵机械化补强,评审 B1)", () => {
    expect(() =>
      insertApprovalRaw({ risk: "S2", decided_via: "screen", auth_strength: "voice_weak", turn_ref: null })
    ).toThrow(/CHECK/);
  });

  it("runtime_effect 缺父包 digest 拒(即使 decided_via=voice)", () => {
    expect(() => insertApprovalRaw({ kind: "runtime_effect", parent_package_digest: null })).toThrow(/CHECK/);
  });

  it("decided_via / auth_strength 词表外拒(未知值不得绕过条件式 CHECK)", () => {
    expect(() => insertApprovalRaw({ decided_via: "telepathy" })).toThrow(/CHECK/);
    expect(() => insertApprovalRaw({ auth_strength: "pinky_promise" })).toThrow(/CHECK/);
  });
});

describe("memory_events CHECK(09 §9)", () => {
  const base = {
    id: "mem_x1",
    ts: "2026-07-24T00:00:00Z",
    tier: "M1"
  };
  it("forget_hard 缺 generation 拒", () => {
    expect(() =>
      db
        .prepare("INSERT INTO memory_events(id, ts, op, tier, payload_json) VALUES (@id, @ts, 'forget_hard', @tier, '{\"targets\":[\"mem_1\"]}')")
        .run(base)
    ).toThrow(/CHECK/);
  });
  it("遗忘/失效空 payload 拒(''/'{}'/null 三态全拒)", () => {
    for (const payload of [null, "", "{}", "null"]) {
      expect(() =>
        db
          .prepare("INSERT INTO memory_events(id, ts, op, tier, payload_json, generation) VALUES (@id, @ts, 'forget_hard', @tier, @p, 1)")
          .run({ ...base, p: payload })
      ).toThrow(/CHECK/);
      expect(() =>
        db
          .prepare("INSERT INTO memory_events(id, ts, op, tier, payload_json) VALUES (@id, @ts, 'invalidate', @tier, @p)")
          .run({ ...base, p: payload })
      ).toThrow(/CHECK/);
    }
  });
  it("op 枚举外拒", () => {
    expect(() =>
      db.prepare("INSERT INTO memory_events(id, ts, op, tier) VALUES ('mem_x2', '2026-07-24T00:00:00Z', 'purge', 'M1')").run()
    ).toThrow(/CHECK/);
  });
});

describe("tasks CHECK(route×adapter 判别)", () => {
  beforeEach(() => {
    db.prepare(
      `INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at)
       VALUES ('prj_1', 't', 'coding', 'active', '{}', 'step_confirm', 't0', 't0')`
    ).run();
  });
  const baseTask = {
    id: "tsk_1",
    project_id: "prj_1",
    title: "t",
    spec_markdown: "s",
    budget_json: "{}",
    created_at: "t0",
    updated_at: "t0"
  };
  function insertTaskRaw(route: string, adapter: string | null): void {
    db.prepare(
      `INSERT INTO tasks(id, project_id, title, spec_markdown, route, status, adapter, budget_json, created_at, updated_at)
       VALUES (@id, @project_id, @title, @spec_markdown, @route, 'confirmed', @adapter, @budget_json, @created_at, @updated_at)`
    ).run({ ...baseTask, route, adapter });
  }
  it("tier1 缺 adapter 拒;hopper 带 adapter 拒;词表外拒", () => {
    expect(() => insertTaskRaw("tier1", null)).toThrow(/CHECK/);
    expect(() => insertTaskRaw("hopper", "cursor")).toThrow(/CHECK/);
    expect(() => insertTaskRaw("tier1", "gemini")).toThrow(/CHECK/);
    insertTaskRaw("tier1", "cursor"); // 正例
  });
  it("外键:project 不存在拒", () => {
    expect(() =>
      db
        .prepare(
          `INSERT INTO tasks(id, project_id, title, spec_markdown, route, status, adapter, budget_json, created_at, updated_at)
           VALUES ('tsk_2', 'prj_missing', 't', 's', 'tier1', 'confirmed', 'cursor', '{}', 't0', 't0')`
        )
        .run()
    ).toThrow(/FOREIGN KEY/);
  });
});

describe("cost_entries CHECK(订阅行恒 known=0/amount=NULL,复评 B2)", () => {
  function insertCost(over: Record<string, unknown>): void {
    db.prepare(
      `INSERT INTO cost_entries(id, ts, kind, amount, currency, known, source)
       VALUES (@id, 't0', 'llm', @amount, @currency, @known, @source)`
    ).run({ id: "c" + Math.random().toString(36).slice(2), amount: null, currency: null, ...over });
  }
  it("subscription + known=1 拒;subscription + amount 非空拒", () => {
    expect(() => insertCost({ known: 1, source: "subscription" })).toThrow(/CHECK/);
    expect(() => insertCost({ known: 0, source: "subscription", amount: 3 })).toThrow(/CHECK/);
    insertCost({ known: 0, source: "subscription" }); // 正例
    insertCost({ known: 1, source: "api", amount: 3, currency: "CNY" }); // 正例
  });
  it("source 词表外拒;known 非 0/1 拒", () => {
    expect(() => insertCost({ known: 0, source: "free" })).toThrow(/CHECK/);
    expect(() => insertCost({ known: 2, source: "api" })).toThrow(/CHECK/);
  });
});

describe("callback_outbox 活跃唯一(部分索引)+ dedupe NOT NULL", () => {
  function insertOutboxRaw(over: Record<string, unknown> = {}): void {
    db.prepare(
      `INSERT INTO callback_outbox(id, task_id, trigger, occurrence_key, dedupe_key, state, created_at, updated_at)
       VALUES (@id, 'tsk_1', 'ready_for_review', '1', @dedupe_key, @state, 't0', 't0')`
    ).run({ id: "ntf_" + Math.random().toString(36).slice(2), dedupe_key: "k1", state: "pending", ...over });
  }
  it("dedupe_key NULL 拒(NOT NULL;SOL 反例 active_null_dedupe)", () => {
    expect(() => insertOutboxRaw({ dedupe_key: null })).toThrow(/NOT NULL/);
  });
  it("同 dedupeKey 活跃唯一;历史(resolved)可重复", () => {
    insertOutboxRaw({ state: "pending" });
    expect(() => insertOutboxRaw({ state: "notified" })).toThrow(/UNIQUE/);
    insertOutboxRaw({ state: "resolved" }); // 历史行不占活跃索引
    insertOutboxRaw({ state: "resolved" });
  });

  it("escalation 封顶 2:第三次 requeue 升级不毒化回读(评审 B2)", async () => {
    const { insertOutboxEntry, transitionOutbox, getOutboxEntry } = await import("../src/storage/dao/outbox.js");
    const e = {
      id: "ntf_01JD9WYX0000000000000000AA",
      taskId: "tsk_01JD9WYX0000000000000000AB",
      trigger: "blocked" as const,
      occurrenceKey: "q1",
      dedupeKey: "t:blocked:1:q1",
      settleProof: { projectionCursor: "c", artifactChecks: [] },
      state: "pending" as const,
      escalationLevel: 0 as const,
      createdAt: "2026-07-24T00:00:00Z",
      updatedAt: "2026-07-24T00:00:00Z"
    };
    insertOutboxEntry(db, e);
    // 三个升级周期:notified->acked->requeued->notified(+1)x3
    let ts = 0;
    const t = () => `2026-07-24T00:00:${String(++ts).padStart(2, "0")}Z`;
    for (let i = 0; i < 3; i++) {
      transitionOutbox(db, e.id, "notified", t(), { escalationDelta: i === 0 ? 0 : 1 });
      transitionOutbox(db, e.id, "acked", t());
      transitionOutbox(db, e.id, "requeued", t());
    }
    transitionOutbox(db, e.id, "notified", t(), { escalationDelta: 1 }); // 第 4 次升级,应封顶 2
    const back = getOutboxEntry(db, e.id);
    expect(back?.escalationLevel).toBe(2);
  });
});

describe("audit_log 不可变(E3;v2 触发器,收口对账 #1)", () => {
  function insertAudit(id: string): void {
    db.prepare("INSERT INTO audit_log(id, ts, actor, action) VALUES (?, 't0', 'daemon', 'test.action')").run(id);
  }
  it("UPDATE 被触发器拒", () => {
    insertAudit("aud_1");
    expect(() => db.prepare("UPDATE audit_log SET action='tampered' WHERE id='aud_1'").run()).toThrow(/immutable/);
  });
  it("DELETE 被触发器拒;INSERT 照常", () => {
    insertAudit("aud_2");
    expect(() => db.prepare("DELETE FROM audit_log WHERE id='aud_2'").run()).toThrow(/immutable/);
    insertAudit("aud_3"); // append-only:新增不受影响
    const n = db.prepare("SELECT COUNT(*) AS n FROM audit_log").get() as { n: number };
    expect(n.n).toBe(2);
  });
  it("既有库补跑 v2 迁移后同样强制(schema_migrations 增量应用)", async () => {
    // 模拟旧库:只应用 v1(手工建 schema_migrations 并标 v1),再 openDb 走增量迁移
    const { mkdtempSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const Database = (await import("better-sqlite3")).default;
    const { DDL_V1 } = await import("../src/storage/ddl.js");
    const p = join(mkdtempSync(join(tmpdir(), "saydo-mig-")), "old.db");
    const legacy = new Database(p);
    legacy.exec("CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL);");
    legacy.exec(DDL_V1);
    legacy.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (1, 't0')").run();
    legacy.prepare("INSERT INTO audit_log(id, ts, actor, action) VALUES ('aud_old', 't0', 'daemon', 'pre.v2')").run();
    legacy.exec("UPDATE audit_log SET action='mutable-before-v2' WHERE id='aud_old'"); // v1 时代可改(现状如实)
    legacy.close();
    const upgraded = openDb(p);
    const ver = upgraded.prepare("SELECT MAX(version) AS v FROM schema_migrations").get() as { v: number };
    const { MIGRATIONS } = await import("../src/storage/ddl.js");
    // 断言追到 MIGRATIONS 尾项(此前硬编码 4,v5 落地即红——A1 教训:测试别把"最新版本号"写死)
    expect(ver.v).toBe(MIGRATIONS[MIGRATIONS.length - 1]!.version);
    expect(() => upgraded.prepare("DELETE FROM audit_log WHERE id='aud_old'").run()).toThrow(/immutable/);
    // v3:task_messages 表可用(retry/返工原文 durable 落点);v4:kind 词表 + steer(重建迁移保数据)
    expect(upgraded.prepare("SELECT COUNT(*) AS c FROM task_messages").get()).toEqual({ c: 0 });
    expect(() =>
      upgraded
        .prepare("INSERT INTO task_messages(id, task_id, attempt, kind, body, created_at) VALUES ('cmd_s1', 'tsk_none', 1, 'steer', 'b', 't0')")
        .run()
    ).toThrow(/FOREIGN KEY/); // steer 词表已放行(报的是外键而非 CHECK)
    expect(() =>
      upgraded
        .prepare("INSERT INTO task_messages(id, task_id, attempt, kind, body, created_at) VALUES ('cmd_s2', 'tsk_none', 1, 'bogus', 'b', 't0')")
        .run()
    ).toThrow(/CHECK/); // 词表外仍拒
    upgraded.close();
  });
});

describe("tier1_runs CHECK", () => {
  it("state/adapter 词表外拒", () => {
    db.prepare(
      `INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at)
       VALUES ('prj_2', 't', 'coding', 'active', '{}', 'step_confirm', 't0', 't0')`
    ).run();
    db.prepare(
      `INSERT INTO tasks(id, project_id, title, spec_markdown, route, status, adapter, budget_json, created_at, updated_at)
       VALUES ('tsk_9', 'prj_2', 't', 's', 'tier1', 'confirmed', 'cursor', '{}', 't0', 't0')`
    ).run();
    const ins = (state: string, adapter: string) =>
      db
        .prepare(
          `INSERT INTO tier1_runs(id, task_id, attempt, adapter, cwd, worktree_path, state, created_at, updated_at)
           VALUES (@id, 'tsk_9', 1, @adapter, '/w', '/w', @state, 't0', 't0')`
        )
        .run({ id: "r" + Math.random().toString(36).slice(2), state, adapter });
    expect(() => ins("done", "cursor")).toThrow(/CHECK/);
    expect(() => ins("running", "gemini")).toThrow(/CHECK/);
    ins("running", "cursor");
  });
});
