// 接线批任务④(HANDOFF §2-9-④):停靠老化调度——
// 30s 步界 paused->blocked (T) + parked 字段落值 + blocked 回叫;72h 老化 parkedDeadline 到期
// -> cancel_requested(park_expired)-> 无活跃 run 即时 settled + package 回落 draft + 回叫 #35;
// transitionTask CAS(T/U 竞态先提交者胜,Codex 14 #2);幂等(重复扫描不重复动作)。

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { computePackageDigest, newId, type DecisionPackage } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { insertProject } from "../src/storage/dao/projects.js";
import { managedProjectPath } from "../src/projects/workspace.js";
import { insertPackage } from "../src/storage/dao/packages.js";
import { insertTask, transitionTask } from "../src/storage/dao/tasks.js";
import { DecisionPackageFactory } from "../src/packages/factory.js";
import { ArtifactStore } from "../src/artifacts/store.js";
import { CallbackEngine } from "../src/callback/engine.js";
import { runParkSweep, STEP_BOUNDARY_TIMEOUT_MS } from "../src/live/scheduler.js";
import type { AuditSink } from "../src/obs/audit.js";

const T0 = "2026-07-25T12:00:00.000Z";
const PRJ = "prj_01PARK0000000000000000000A";

let db: Db;
let audit: AuditSink;
let factory: DecisionPackageFactory;
let callbacks: CallbackEngine;

function sweepAt(iso: string, hours = 72): ReturnType<typeof runParkSweep> {
  return runParkSweep({
    db,
    audit,
    factory,
    callbacks,
    parkAgingHours: () => hours,
    now: () => new Date(iso)
  });
}

function mkPkg(): DecisionPackage {
  const body = {
    id: newId("pkg"),
    revision: 1,
    projectId: PRJ,
    outcomePreview: "导出按钮可用",
    inScope: ["导出"],
    outOfScope: [],
    assumptions: [],
    acceptance: ["按钮出现"],
    plan: [{ seq: 1, step: "实现", owner: "ai" as const }],
    cost: { expected: { known: false }, p95: { known: false }, max: 20, currency: "CNY" as const },
    risks: [],
    mode: "step_confirm" as const,
    preauthorizedEffects: [],
    effectPolicyVersion: "e2/0.1.0"
  };
  return { ...body, digest: computePackageDigest(body), status: "approved", expiresAt: "2026-08-01T00:00:00.000Z", createdAt: T0 };
}

function seedTask(id: string, status: string, pkg: DecisionPackage, updatedAt = T0): void {
  insertTask(
    db,
    {
      id,
      projectId: PRJ,
      packageRef: { packageId: pkg.id, revision: pkg.revision, digest: pkg.digest },
      title: "任务",
      specMarkdown: "spec",
      route: "tier1",
      adapter: "cursor",
      status: "confirmed",
      budget: { walltimeActiveMin: 45, maxTurns: 50, maxCost: 20 },
      updatedAt
    },
    updatedAt
  );
  if (status !== "confirmed") db.prepare("UPDATE tasks SET status=?, updated_at=? WHERE id=?").run(status, updatedAt, id);
}

beforeEach(() => {
  db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-park-")), "saydo.db"));
  audit = createSqliteAuditSink(db);
  factory = new DecisionPackageFactory({ db, artifacts: new ArtifactStore({ db, saydoDir: mkdtempSync(join(tmpdir(), "saydo-art-")) }), audit, now: () => new Date(T0) });
  callbacks = new CallbackEngine({ db, audit, now: () => new Date(T0) });
  insertProject(db, {
    id: PRJ,
    title: "p",
    type: "coding",
    status: "active",
    workspace: { kind: "local_folder", path: managedProjectPath(PRJ), managed: true },
    executionModeDefault: "step_confirm",
    createdAt: T0,
    updatedAt: T0
  });
});

describe("30s 步界转停靠(09 §6.1 paused->blocked (T);04 §5.4 先落 blocked 再叫人)", () => {
  it("超 30s:blocked + parked 字段落值(72h deadline)+ blocked 回叫入队;未超时不动", () => {
    const pkg = mkPkg();
    insertPackage(db, pkg);
    const TSK = "tsk_01PARK0000000000000000000A";
    seedTask(TSK, "paused_step_boundary", pkg, T0);

    // 未超 30s:不动
    const early = sweepAt(new Date(Date.parse(T0) + STEP_BOUNDARY_TIMEOUT_MS - 1000).toISOString());
    expect(early.steppedToBlocked).toEqual([]);

    // 超 30s:blocked + parked 字段 + 回叫
    const at = new Date(Date.parse(T0) + STEP_BOUNDARY_TIMEOUT_MS + 1000).toISOString();
    const r = sweepAt(at);
    expect(r.steppedToBlocked).toEqual([TSK]);
    const row = db.prepare("SELECT status, parked_at, parked_deadline FROM tasks WHERE id=?").get(TSK) as {
      status: string;
      parked_at: string;
      parked_deadline: string;
    };
    expect(row.status).toBe("blocked");
    expect(row.parked_at).toBe(at);
    expect(Date.parse(row.parked_deadline) - Date.parse(at)).toBe(72 * 3_600_000);
    const outbox = db.prepare("SELECT trigger, occurrence_key FROM callback_outbox WHERE task_id=?").get(TSK) as {
      trigger: string;
      occurrence_key: string;
    };
    expect(outbox.trigger).toBe("blocked");
    expect(outbox.occurrence_key).toContain("step_timeout:");
    // 幂等:再扫不重复(状态已非 paused;outbox 活跃唯一)
    expect(sweepAt(at).steppedToBlocked).toEqual([]);
  });

  it("T/U 竞态(CAS):用户先应答(paused->running)则定时器败,不覆盖", () => {
    const pkg = mkPkg();
    insertPackage(db, pkg);
    const TSK = "tsk_01PARK0000000000000000000B";
    seedTask(TSK, "paused_step_boundary", pkg, T0);
    // 用户在定时器读到旧状态后、写入前应答:直接推进 running(U 先提交)
    transitionTask(db, TSK, "running", "U", { now: T0 });
    const r = sweepAt(new Date(Date.parse(T0) + 60_000).toISOString());
    expect(r.steppedToBlocked).toEqual([]); // CAS 保护:paused 集合里已无此任务
    expect((db.prepare("SELECT status FROM tasks WHERE id=?").get(TSK) as { status: string }).status).toBe("running");
  });
});

describe("72h 停靠老化(09 §6.1 T 边;10 #35)", () => {
  it("parkedDeadline 到期:cancel_requested(park_expired)-> 无活跃 run 即时 settled + package 回落 draft(revision+1)+ 回叫", () => {
    const pkg = mkPkg();
    insertPackage(db, pkg);
    const TSK = "tsk_01PARK0000000000000000000C";
    seedTask(TSK, "ready_for_review", pkg, T0);
    db.prepare("UPDATE tasks SET parked_at=?, parked_deadline=? WHERE id=?").run(T0, "2026-07-28T12:00:00.000Z", TSK);

    // 未到期不动
    expect(sweepAt("2026-07-27T00:00:00.000Z").expired).toEqual([]);

    const r = sweepAt("2026-07-28T12:00:01.000Z");
    expect(r.expired).toEqual([TSK]);
    const row = db.prepare("SELECT status, cancel_reason, parked_deadline FROM tasks WHERE id=?").get(TSK) as {
      status: string;
      cancel_reason: string;
      parked_deadline: string | null;
    };
    expect(row).toEqual({ status: "cancel_settled", cancel_reason: "park_expired", parked_deadline: null });
    // package 回落 draft:revision+1 status=draft("内容转成草稿,想重启随时说")
    const rev2 = db.prepare("SELECT status FROM decision_packages WHERE id=? AND revision=2").get(pkg.id) as { status: string };
    expect(rev2.status).toBe("draft");
    // 回叫 #35 入队(trigger=parked_expired,occurrenceKey=taskId——09 §6.3)
    const outbox = db.prepare("SELECT trigger, occurrence_key, state FROM callback_outbox WHERE task_id=?").get(TSK) as {
      trigger: string;
      occurrence_key: string;
      state: string;
    };
    expect(outbox).toEqual({ trigger: "parked_expired", occurrence_key: TSK, state: "pending" });
    // 幂等:再扫不重复老化、不重复 revise
    expect(sweepAt("2026-07-28T13:00:00.000Z").expired).toEqual([]);
    const revs = (db.prepare("SELECT COUNT(*) AS c FROM decision_packages WHERE id=?").get(pkg.id) as { c: number }).c;
    expect(revs).toBe(2);
  });

  it("收据超时终局(Codex 16 5.3;09 §3):未决 pending 过期 -> timeout_parked(step_confirm 档);accept 未消费过期 -> expired", () => {
    const pkg = mkPkg();
    insertPackage(db, pkg);
    // 未决收据(decision NULL)+ 已 accept 收据,各一张,均已过期
    db.prepare(
      `INSERT INTO approvals(id, kind, ref_digest, effect, turn_ref, risk, decided_via, auth_strength, nonce, outcome, issued_at, expires_at)
       VALUES ('apr_01PARK00000000000000000RCP', 'dispatch_package', ?, 'x', 'ses_01PARK0000000000000000000E', 'S1', 'voice', 'voice_weak', 'n-park-1', 'pending', ?, '2026-07-25T12:00:45.000Z')`
    ).run(pkg.digest, T0);
    db.prepare(
      `INSERT INTO approvals(id, kind, ref_digest, effect, turn_ref, risk, decided_via, auth_strength, decision, nonce, outcome, issued_at, expires_at, decided_at)
       VALUES ('apr_01PARK00000000000000000ACC', 'dispatch_package', ?, 'x', 'ses_01PARK0000000000000000000F', 'S1', 'voice', 'voice_weak', 'accept', 'n-park-2', 'pending', ?, '2026-07-25T12:00:45.000Z', ?)`
    ).run(pkg.digest, T0, T0);

    sweepAt("2026-07-25T12:01:00.000Z");
    const undecided = db.prepare("SELECT outcome FROM approvals WHERE id='apr_01PARK00000000000000000RCP'").get() as { outcome: string };
    expect(undecided.outcome).toBe("timeout_parked"); // step_confirm 档(包 mode)
    const accepted = db.prepare("SELECT outcome FROM approvals WHERE id='apr_01PARK00000000000000000ACC'").get() as { outcome: string };
    expect(accepted.outcome).toBe("expired"); // accept 未消费越过 expiresAt = expired 唯一语义
    // 幂等:再扫不炸(已终局跳过)
    sweepAt("2026-07-25T12:02:00.000Z");
  });

  it("有活跃 run 的 blocked 老化:cancel_requested 停住等 Tier1CancelProof(不伪 settled)", () => {
    const pkg = mkPkg();
    insertPackage(db, pkg);
    const TSK = "tsk_01PARK0000000000000000000D";
    seedTask(TSK, "blocked", pkg, T0);
    db.prepare("UPDATE tasks SET parked_at=?, parked_deadline=? WHERE id=?").run(T0, "2026-07-28T12:00:00.000Z", TSK);
    db.prepare(
      `INSERT INTO tier1_runs(id, task_id, attempt, adapter, cwd, worktree_path, state, created_at, updated_at)
       VALUES ('run_01PARK0000000000000000000D', ?, 1, 'cursor', '/tmp/wt', '/tmp/wt', 'running', ?, ?)`
    ).run(TSK, T0, T0);

    const r = sweepAt("2026-07-28T12:00:01.000Z");
    expect(r.expired).toEqual([TSK]);
    expect((db.prepare("SELECT status FROM tasks WHERE id=?").get(TSK) as { status: string }).status).toBe("cancel_requested");
  });
});
