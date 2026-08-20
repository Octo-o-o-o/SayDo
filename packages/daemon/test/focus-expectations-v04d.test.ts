// Focus v0.4 ④d Expectation aggregate 契约测试
// a 三投影点初始化 + logical_key 稳定
// b 包 revision 迁移(同文本迁移/新文本新键/旧行 superseded)
// c 多 acceptance 跨 revision 键唯一
// d adjust→pending_ack、二次 adjust 409
// e ack 四合一原子(中途断→保卡零半态)
// f dismissed 保留 pending_ack、rejected supersede、withdraw 写口
// g CAS 竞态失败保卡
// h pending_ack 不进 dispatch 编译、next_dispatch 过滤
// i 原子化后 artifact create 行为不变

import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  computePackageDigest,
  newId,
  type DecisionPackage
} from "@saydo/contracts";
import { createFocusArtifact } from "../src/api/artifacts.js";
import {
  adjustExpectationApi,
  withdrawExpectationApi
} from "../src/api/expectations.js";
import {
  acceptanceLogicalKey,
  adjustExpectationOnOps,
  assignTextOrdinals,
  listExpectationsForDispatch,
  packageLineageRootDigest,
  projectPackageExpectationsOnOps,
  settleExpectationAckOnOps,
  textHash16,
  withdrawExpectationOnOps
} from "../src/focus/expectations.js";
import { FocusWriteError, withFocusWriteTx } from "../src/focus/writeTx.js";
import {
  ConfirmationLoop,
  type PendingPayload
} from "../src/live/confirm.js";
import { openDb, type Db } from "../src/storage/db.js";
import { insertPackage } from "../src/storage/dao/packages.js";

const NOW = "2026-08-09T12:00:00.000Z";

function seedProjectSession(db: Db): { projectId: string; sessionId: string; home: string } {
  const home = mkdtempSync(join(tmpdir(), "saydo-exp-"));
  const projectId = newId("prj");
  const sessionId = newId("ses");
  db.prepare(
    `INSERT INTO projects(id,title,type,status,workspace_json,exec_mode_default,created_at,updated_at)
     VALUES (?,?, 'coding','active',?,'step_confirm',?,?)`
  ).run(projectId, "p", JSON.stringify({ kind: "local_folder", path: home, managed: true }), NOW, NOW);
  db.prepare(
    `INSERT INTO sessions(id,project_id,state,engine,transcript_path,started_at)
     VALUES (?,?, 'talking','live',?,?)`
  ).run(sessionId, projectId, join(home, "t.jsonl"), NOW);
  return { projectId, sessionId, home };
}

function seedFocus(db: Db, title = "F"): string {
  const id = newId("foc");
  db.prepare(
    `INSERT INTO focuses(id,title,lifecycle,semantic_authority,authority_epoch,current_revision,created_at,updated_at)
     VALUES (?,?, 'active','saydo',0,0,?,?)`
  ).run(id, title, NOW, NOW);
  // 首事件 created 供 seq 链
  withFocusWriteTx(db, { now: () => new Date(NOW) }, (ops) => {
    ops.appendEvent(id, {
      type: "created",
      payload: { title },
      actorKind: "user"
    });
  });
  return id;
}

function makePkg(
  projectId: string,
  opts: {
    id?: string;
    revision?: number;
    acceptance?: string[];
    max?: number;
    supersedes?: { packageId: string; revision: number };
    digest?: string;
  } = {}
): DecisionPackage {
  const id = opts.id ?? newId("pkg");
  const revision = opts.revision ?? 1;
  const acceptance = opts.acceptance ?? ["可测验收 A", "可测验收 B"];
  const body = {
    id,
    revision,
    ...(opts.supersedes ? { supersedes: opts.supersedes } : {}),
    projectId,
    outcomePreview: "成果预览",
    inScope: ["范围"],
    outOfScope: [],
    assumptions: [],
    acceptance,
    plan: [{ seq: 1, step: "做", owner: "ai" as const }],
    cost: {
      expected: { known: true as const, value: 1, currency: "CNY" as const, asOf: NOW },
      p95: { known: false as const },
      max: opts.max ?? 10,
      currency: "CNY" as const
    },
    risks: [],
    mode: "step_confirm" as const,
    preauthorizedEffects: [],
    effectPolicyVersion: "v1",
    status: "approved" as const,
    createdAt: NOW
  };
  const digest = opts.digest ?? computePackageDigest(body);
  return { ...body, digest };
}

function auditSink() {
  return { record: () => ({ id: "aud_test" }) };
}

let db: Db;
let projectId: string;
let sessionId: string;
let focusId: string;

beforeEach(() => {
  const home = mkdtempSync(join(tmpdir(), "saydo-expdb-"));
  db = openDb(join(home, "saydo.db"));
  const seeded = seedProjectSession(db);
  projectId = seeded.projectId;
  sessionId = seeded.sessionId;
  focusId = seedFocus(db);
});

describe("④d a) 三投影点初始化 + logical_key 稳定", () => {
  it("dispatch 包投影 acceptance+budget;artifact expected;obligation due", () => {
    const pkg = makePkg(projectId, { acceptance: ["标准甲", "标准乙"], max: 42 });
    insertPackage(db, pkg);

    withFocusWriteTx(db, { now: () => new Date(NOW) }, (ops) => {
      projectPackageExpectationsOnOps(ops, focusId, pkg);
    });

    const rows = db
      .prepare(`SELECT kind, text, status, logical_key FROM focus_expectations WHERE focus_id=? ORDER BY kind, text`)
      .all(focusId) as Array<{ kind: string; text: string; status: string; logical_key: string }>;
    expect(rows.filter((r) => r.kind === "acceptance").length).toBe(2);
    expect(rows.find((r) => r.kind === "budget")?.text).toContain("42");
    expect(rows.every((r) => r.status === "active")).toBe(true);

    // logical_key 稳定:同输入再算一致
    const root = packageLineageRootDigest(db, pkg);
    const ords = assignTextOrdinals(pkg.acceptance);
    const k0 = acceptanceLogicalKey(focusId, root, ords[0]!.text, ords[0]!.ordinal);
    expect(rows.find((r) => r.text === "标准甲")?.logical_key).toBe(k0);

    // artifact expected 投影
    const art = createFocusArtifact(
      db,
      auditSink(),
      focusId,
      { kind: "file", role: "expected", title: "产出报告", ref: {} },
      NOW
    );
    expect(art.status).toBe(200);
    const artId = (art.payload as { id: string }).id;
    const artExp = db
      .prepare(`SELECT * FROM focus_expectations WHERE focus_id=? AND kind='artifact' AND status='active'`)
      .get(focusId) as { text: string; source_ref_json: string } | undefined;
    expect(artExp?.text).toBe("产出报告");
    expect(JSON.parse(artExp!.source_ref_json).artifactId).toBe(artId);

    // due 投影
    withFocusWriteTx(db, { now: () => new Date(NOW) }, (ops) => {
      ops.upsertObligation(focusId, {
        kind: "action",
        title: "跟进回执",
        owner: "human",
        status: "open",
        verification: "confirmed",
        needs: "action",
        dedupeKey: `${focusId}:action:follow`,
        dueOrTrigger: "周五前",
        actorKind: "user"
      });
    });
    const due = db
      .prepare(`SELECT text, status FROM focus_expectations WHERE focus_id=? AND kind='due'`)
      .get(focusId) as { text: string; status: string };
    expect(due).toEqual({ text: "周五前", status: "active" });
  });
});

describe("④d b/c) 包 revision 迁移 + 多 acceptance 键唯一", () => {
  it("同文本迁移升 revision;新文本新键;未匹配旧行 superseded;同文本多条序次消歧", () => {
    const pkgId = newId("pkg");
    const pkg1 = makePkg(projectId, {
      id: pkgId,
      revision: 1,
      acceptance: ["同一标准", "同一标准", "独有旧"]
    });
    insertPackage(db, pkg1);
    withFocusWriteTx(db, { now: () => new Date(NOW) }, (ops) => {
      projectPackageExpectationsOnOps(ops, focusId, pkg1);
    });
    const after1 = db
      .prepare(
        `SELECT id, text, status, revision, logical_key FROM focus_expectations
         WHERE focus_id=? AND kind='acceptance' ORDER BY text, revision`
      )
      .all(focusId) as Array<{ id: string; text: string; status: string; revision: number; logical_key: string }>;
    expect(after1.filter((r) => r.status === "active").length).toBe(3);
    // 同文本两条不同 logical_key(序次 1/2)
    const sameTextKeys = after1.filter((r) => r.text === "同一标准").map((r) => r.logical_key);
    expect(new Set(sameTextKeys).size).toBe(2);

    const pkg2 = makePkg(projectId, {
      id: pkgId,
      revision: 2,
      acceptance: ["同一标准", "同一标准", "全新标准"],
      supersedes: { packageId: pkgId, revision: 1 }
    });
    insertPackage(db, pkg2);
    withFocusWriteTx(db, { now: () => new Date(NOW) }, (ops) => {
      projectPackageExpectationsOnOps(ops, focusId, pkg2);
    });

    const all = db
      .prepare(
        `SELECT text, status, revision, logical_key FROM focus_expectations
         WHERE focus_id=? AND kind='acceptance' ORDER BY logical_key, revision`
      )
      .all(focusId) as Array<{ text: string; status: string; revision: number; logical_key: string }>;

    // 独有旧 → superseded
    expect(all.filter((r) => r.text === "独有旧" && r.status === "superseded").length).toBe(1);
    // 同文本两条仍 active,revision>=2
    const sameActive = all.filter((r) => r.text === "同一标准" && r.status === "active");
    expect(sameActive.length).toBe(2);
    expect(sameActive.every((r) => r.revision >= 2)).toBe(true);
    // 全新标准 active
    expect(all.some((r) => r.text === "全新标准" && r.status === "active")).toBe(true);
    // 跨 revision 无重复 active key
    const activeKeys = all.filter((r) => r.status === "active").map((r) => r.logical_key);
    expect(new Set(activeKeys).size).toBe(activeKeys.length);
  });
});

describe("④d d) adjust→pending_ack、二次 409", () => {
  it("adjust 落 pending_ack;二次 adjust 409;旧 active 保留", () => {
    const pkg = makePkg(projectId, { acceptance: ["原验收"] });
    insertPackage(db, pkg);
    withFocusWriteTx(db, { now: () => new Date(NOW) }, (ops) => {
      projectPackageExpectationsOnOps(ops, focusId, pkg);
    });
    const active = db
      .prepare(`SELECT id FROM focus_expectations WHERE focus_id=? AND kind='acceptance' AND status='active'`)
      .get(focusId) as { id: string };

    const r1 = adjustExpectationApi(db, auditSink(), focusId, active.id, { text: "改后的验收" });
    expect(r1.status).toBe(200);
    const payload = r1.payload as { expectationId: string; status: string };
    expect(payload.status).toBe("pending_ack");

    // 旧 active 仍在
    const stillActive = db
      .prepare(`SELECT id, status FROM focus_expectations WHERE id=?`)
      .get(active.id) as { status: string };
    expect(stillActive.status).toBe("active");

    // 二次 adjust 409
    const r2 = adjustExpectationApi(db, auditSink(), focusId, active.id, { text: "再改一次" });
    expect(r2.status).toBe(409);
    expect((r2.payload as { code: string }).code).toBe("pending_ack_exists");
  });
});

describe("④d e/g) ack 四合一 + CAS 失败保卡", () => {
  it("accepted 四合一:pending_ack→active、旧 active→superseded、事件+ledger+pending 清", () => {
    const pkg = makePkg(projectId, { acceptance: ["待调"] });
    insertPackage(db, pkg);
    withFocusWriteTx(db, { now: () => new Date(NOW) }, (ops) => {
      projectPackageExpectationsOnOps(ops, focusId, pkg);
    });
    const active = db
      .prepare(`SELECT id, revision FROM focus_expectations WHERE focus_id=? AND status='active' AND kind='acceptance'`)
      .get(focusId) as { id: string; revision: number };

    const adj = withFocusWriteTx(db, { now: () => new Date(NOW) }, (ops) =>
      adjustExpectationOnOps(ops, focusId, active.id, { text: "调后" }, { actorKind: "user", sessionId })
    );

    const loop = new ConfirmationLoop({}, db);
    const receiptId = newId("apr");
    const payload: PendingPayload = {
      kind: "expectation_ack",
      focusId,
      expectationId: adj.expectationId,
      fromRevision: adj.fromRevision,
      toRevision: adj.toRevision,
      summary: "调后"
    };
    loop.present(sessionId, {
      receiptId,
      sentenceId: "s1",
      promptText: "确认调整?",
      payload
    });
    // 预占
    const outcome = loop.consumeClick(sessionId, receiptId, loop.pending(sessionId)!.digest, "accept");
    expect(outcome.kind).toBe("accepted");

    withFocusWriteTx(db, { now: () => new Date(NOW) }, (ops) => {
      settleExpectationAckOnOps(ops, {
        focusId,
        expectationId: adj.expectationId,
        fromRevision: adj.fromRevision,
        toRevision: adj.toRevision,
        outcome: "accepted",
        receiptRef: receiptId,
        sessionId
      });
      loop.commitConsume(sessionId, receiptId);
    });
    loop.finalizeAccepted(sessionId, receiptId, "click");

    const newActive = db
      .prepare(`SELECT status, text FROM focus_expectations WHERE id=?`)
      .get(adj.expectationId) as { status: string; text: string };
    expect(newActive).toEqual({ status: "active", text: "调后" });
    const old = db.prepare(`SELECT status FROM focus_expectations WHERE id=?`).get(active.id) as {
      status: string;
    };
    expect(old.status).toBe("superseded");
    expect(loop.pending(sessionId)).toBeUndefined();
    const ledger = db
      .prepare(`SELECT outcome FROM confirmation_ledger WHERE receipt_id=?`)
      .get(receiptId) as { outcome: string };
    expect(ledger.outcome).toBe("accepted");
    const settledEv = db
      .prepare(`SELECT type FROM focus_events WHERE focus_id=? AND type='expectation_ack_settled'`)
      .all(focusId) as unknown[];
    expect(settledEv.length).toBe(1);
  });

  it("CAS 失败释放预占保卡:pending 行仍在、pending_ack 仍 pending_ack", () => {
    const pkg = makePkg(projectId, { acceptance: ["竞态"] });
    insertPackage(db, pkg);
    withFocusWriteTx(db, { now: () => new Date(NOW) }, (ops) => {
      projectPackageExpectationsOnOps(ops, focusId, pkg);
    });
    const active = db
      .prepare(`SELECT id FROM focus_expectations WHERE focus_id=? AND status='active' AND kind='acceptance'`)
      .get(focusId) as { id: string };
    const adj = withFocusWriteTx(db, { now: () => new Date(NOW) }, (ops) =>
      adjustExpectationOnOps(ops, focusId, active.id, { text: "竞态后" }, { actorKind: "user" })
    );

    const loop = new ConfirmationLoop({}, db);
    const receiptId = newId("apr");
    loop.present(sessionId, {
      receiptId,
      sentenceId: "s-cas",
      promptText: "确认?",
      payload: {
        kind: "expectation_ack",
        focusId,
        expectationId: adj.expectationId,
        fromRevision: adj.fromRevision,
        toRevision: adj.toRevision,
        summary: "竞态后"
      }
    });
    loop.consumeClick(sessionId, receiptId, loop.pending(sessionId)!.digest, "accept");

    // 人为改 revision 制造 CAS 失败
    db.prepare(`UPDATE focus_expectations SET revision = revision + 10 WHERE id = ?`).run(adj.expectationId);

    let failed = false;
    try {
      withFocusWriteTx(db, { now: () => new Date(NOW) }, (ops) => {
        settleExpectationAckOnOps(ops, {
          focusId,
          expectationId: adj.expectationId,
          fromRevision: adj.fromRevision,
          toRevision: adj.toRevision,
          outcome: "accepted",
          receiptRef: receiptId,
          sessionId
        });
        loop.commitConsume(sessionId, receiptId);
      });
    } catch (e) {
      failed = true;
      expect(e).toBeInstanceOf(FocusWriteError);
      expect((e as FocusWriteError).code).toBe("cas_failed");
      loop.releaseHold(sessionId);
    }
    expect(failed).toBe(true);
    // 保卡:pending 仍在
    expect(loop.pending(sessionId)?.receiptId).toBe(receiptId);
    const row = db.prepare(`SELECT status FROM focus_expectations WHERE id=?`).get(adj.expectationId) as {
      status: string;
    };
    // revision 被我们抬了但 status 应仍 pending_ack(事务回滚)
    expect(row.status).toBe("pending_ack");
  });
});

describe("④d f) dismissed 保留 / rejected supersede / withdraw", () => {
  it("dismissed 保留 pending_ack;rejected 转 superseded;withdraw 写口", () => {
    const pkg = makePkg(projectId, { acceptance: ["态测"] });
    insertPackage(db, pkg);
    withFocusWriteTx(db, { now: () => new Date(NOW) }, (ops) => {
      projectPackageExpectationsOnOps(ops, focusId, pkg);
    });
    const active = db
      .prepare(`SELECT id FROM focus_expectations WHERE focus_id=? AND status='active' AND kind='acceptance'`)
      .get(focusId) as { id: string };

    // dismissed
    const adj1 = withFocusWriteTx(db, { now: () => new Date(NOW) }, (ops) =>
      adjustExpectationOnOps(ops, focusId, active.id, { text: "dismiss 测" }, { actorKind: "user" })
    );
    const loop = new ConfirmationLoop({}, db);
    const rDismiss = newId("apr");
    loop.present(sessionId, {
      receiptId: rDismiss,
      sentenceId: "sd",
      promptText: "?",
      payload: {
        kind: "expectation_ack",
        focusId,
        expectationId: adj1.expectationId,
        fromRevision: adj1.fromRevision,
        toRevision: adj1.toRevision,
        summary: "dismiss 测"
      }
    });
    loop.dismiss(sessionId);
    const afterDismiss = db
      .prepare(`SELECT status FROM focus_expectations WHERE id=?`)
      .get(adj1.expectationId) as { status: string };
    expect(afterDismiss.status).toBe("pending_ack");

    // withdraw 清 pending_ack
    const w = withdrawExpectationApi(db, auditSink(), focusId, adj1.expectationId);
    expect(w.status).toBe(200);
    expect(
      (db.prepare(`SELECT status FROM focus_expectations WHERE id=?`).get(adj1.expectationId) as { status: string })
        .status
    ).toBe("superseded");

    // rejected
    const adj2 = withFocusWriteTx(db, { now: () => new Date(NOW) }, (ops) =>
      adjustExpectationOnOps(ops, focusId, active.id, { text: "reject 测" }, { actorKind: "user" })
    );
    const rRej = newId("apr");
    loop.present(sessionId, {
      receiptId: rRej,
      sentenceId: "sr",
      promptText: "?",
      payload: {
        kind: "expectation_ack",
        focusId,
        expectationId: adj2.expectationId,
        fromRevision: adj2.fromRevision,
        toRevision: adj2.toRevision,
        summary: "reject 测"
      }
    });
    loop.consumeClick(sessionId, rRej, loop.pending(sessionId)!.digest, "reject");
    expect(
      (db.prepare(`SELECT status FROM focus_expectations WHERE id=?`).get(adj2.expectationId) as { status: string })
        .status
    ).toBe("superseded");
  });
});

describe("④d h) dispatch 编译过滤", () => {
  it("pending_ack 不进编译;next_dispatch 默认排除", () => {
    const pkg = makePkg(projectId, { acceptance: ["编译测"] });
    insertPackage(db, pkg);
    withFocusWriteTx(db, { now: () => new Date(NOW) }, (ops) => {
      projectPackageExpectationsOnOps(ops, focusId, pkg);
    });
    const active = db
      .prepare(`SELECT id FROM focus_expectations WHERE focus_id=? AND status='active' AND kind='acceptance'`)
      .get(focusId) as { id: string };

    // 模拟已有绑定 + 终态任务 → adjust 得 next_dispatch
    const taskId = newId("tsk");
    db.prepare(
      `INSERT INTO tasks(id,project_id,package_id,package_rev,package_digest,title,spec_markdown,route,status,adapter,budget_json,updated_at,created_at)
       VALUES (?,?,?,?,?,?,'# s','tier1','task_done','claude_code',?,?,?)`
    ).run(
      taskId,
      projectId,
      pkg.id,
      1,
      pkg.digest,
      "t",
      JSON.stringify({ walltimeActiveMin: 1, maxTurns: 1, maxCost: 1 }),
      NOW,
      NOW
    );
    const bindId = newId("aeb");
    const fev = db
      .prepare(`SELECT id FROM focus_events WHERE focus_id=? ORDER BY seq LIMIT 1`)
      .get(focusId) as { id: string };
    db.prepare(
      `INSERT INTO action_execution_bindings(
        id, focus_id, task_id, focus_revision_at_authorization, selected_authority, phase,
        authorized_by_event_id, created_at, updated_at
      ) VALUES (?,?,?,?, 'tier1','authorized',?,?,?)`
    ).run(bindId, focusId, taskId, 0, fev.id, NOW, NOW);

    const adj = withFocusWriteTx(db, { now: () => new Date(NOW) }, (ops) =>
      adjustExpectationOnOps(ops, focusId, active.id, { text: "next 版" }, { actorKind: "user" })
    );
    expect(adj.appliesFrom).toBe("next_dispatch");

    const forDispatch = listExpectationsForDispatch(db, focusId, { includeNextDispatch: false });
    // 只有旧 active;pending_ack 不在
    expect(forDispatch.every((e) => e.status === "active")).toBe(true);
    expect(forDispatch.some((e) => e.id === adj.expectationId)).toBe(false);
    expect(forDispatch.some((e) => e.text === "编译测")).toBe(true);

    // 先 ack 让 next_dispatch 行变 active,仍默认不进
    withFocusWriteTx(db, { now: () => new Date(NOW) }, (ops) => {
      settleExpectationAckOnOps(ops, {
        focusId,
        expectationId: adj.expectationId,
        fromRevision: adj.fromRevision,
        toRevision: adj.toRevision,
        outcome: "accepted"
      });
    });
    const afterAck = listExpectationsForDispatch(db, focusId, { includeNextDispatch: false });
    expect(afterAck.some((e) => e.id === adj.expectationId)).toBe(false);
    const withNext = listExpectationsForDispatch(db, focusId, { includeNextDispatch: true });
    expect(withNext.some((e) => e.id === adj.expectationId && e.text === "next 版")).toBe(true);
  });
});

describe("④d i) 原子化 artifact create 行为不变", () => {
  it("create expected:行+事件同事务;失败无半态;成功可 list", () => {
    const r = createFocusArtifact(
      db,
      auditSink(),
      focusId,
      { kind: "text", role: "expected", title: "原子测", ref: {} },
      NOW
    );
    expect(r.status).toBe(200);
    const id = (r.payload as { id: string; ok: boolean }).id;
    const art = db.prepare(`SELECT role, title FROM focus_artifacts WHERE id=?`).get(id) as {
      role: string;
      title: string;
    };
    expect(art).toEqual({ role: "expected", title: "原子测" });
    const ev = db
      .prepare(`SELECT type, payload_json FROM focus_events WHERE focus_id=? AND type='artifact_linked'`)
      .all(focusId) as Array<{ payload_json: string }>;
    expect(ev.some((e) => JSON.parse(e.payload_json).artifactId === id)).toBe(true);

    // 注入崩溃:目标写后事件前炸 → 零半态
    const beforeCount = (
      db.prepare(`SELECT COUNT(*) AS c FROM focus_artifacts WHERE focus_id=?`).get(focusId) as { c: number }
    ).c;
    expect(() =>
      withFocusWriteTx(db, { now: () => new Date(NOW), injectCrashAfterTargetWrite: true }, (ops) => {
        ops.linkArtifact(focusId, {
          kind: "file",
          role: "expected",
          title: "应回滚",
          refJson: "{}",
          actorKind: "user"
        });
      })
    ).toThrow(/injected_crash/);
    const afterCount = (
      db.prepare(`SELECT COUNT(*) AS c FROM focus_artifacts WHERE focus_id=?`).get(focusId) as { c: number }
    ).c;
    expect(afterCount).toBe(beforeCount);
  });
});

describe("④d helpers", () => {
  it("textHash16 与 logical_key 确定性", () => {
    expect(textHash16("hello")).toBe(createHash("sha256").update("hello", "utf8").digest("hex").slice(0, 16));
    const a = acceptanceLogicalKey(focusId, "digestroot", "t", 1);
    const b = acceptanceLogicalKey(focusId, "digestroot", "t", 1);
    const c = acceptanceLogicalKey(focusId, "digestroot", "t", 2);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
