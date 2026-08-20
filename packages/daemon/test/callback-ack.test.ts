// S2 B:ack 端点 / 隐式 L0 ack / 终局 resolve·冻结 / resolution-timeout 重升级 L1。

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { OutboxTrigger, Tier1SettleProof } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { CallbackEngine } from "../src/callback/engine.js";
import { handleOutboxAck, ackL0ForSession } from "../src/callback/ack.js";
import { getOutboxEntry } from "../src/storage/dao/outbox.js";
import { handleTaskAction } from "../src/api/actions.js";
import { seedConsoleFixture } from "../src/api/fixture.js";
import { mobileLanApiAllowed } from "../src/net/mobileLan.js";
import { arbitrate } from "../src/callback/arbitration.js";
import { renderNtfyMessage } from "../src/callback/ntfy.js";
import { runCallbackSweep, type SweepDeps } from "../src/callback/sweep.js";
import type { AuditSink } from "../src/obs/audit.js";

const nullAudit: AuditSink = { record: () => ({ id: "aud_x" }) };
const PRJ = "prj_01AAAAAAAAAAAAAAAAAAAAAAAA";
const TSK = "tsk_01AAAAAAAAAAAAAAAAAAAAAAAA";
const TSK2 = "tsk_01BBBBBBBBBBBBBBBBBBBBBBBB";
const SES = "ses_01AAAAAAAAAAAAAAAAAAAAAAAA";
const RDY = "tsk_01F1XT0RE0TSKRDY0000000000";
const B1K = "tsk_01F1XT0RE0TSKB1K0000000000";
const NOW = "2026-07-25T12:00:00.000Z";

const proof = (taskId: string): Tier1SettleProof => ({
  taskId,
  runId: "run-1",
  attempt: 1,
  packageRevision: 1,
  treeSha: "abc123",
  tier1VerifyDigest: "sha256:" + "1".repeat(64),
  transcriptCursor: "c-100",
  settledAt: "2026-07-25T00:00:00.000Z"
});

let db: Db;
let nowMs: number;
let engine: CallbackEngine;

function enqueue(taskId: string, trigger: OutboxTrigger, occurrenceKey: string): string {
  const r =
    trigger === "ready_for_review"
      ? engine.enqueue({
          taskId,
          trigger,
          packageRevision: 1,
          occurrenceKey,
          settleProof: proof(taskId),
          projectionCursor: "c-100",
          artifactChecks: ["ac1"]
        })
      : engine.enqueue({
          taskId,
          trigger,
          packageRevision: 1,
          occurrenceKey,
          minimalProof: { questionId: `q-${occurrenceKey}`, transcriptCursor: "cur-x" },
          projectionCursor: "c",
          artifactChecks: []
        });
  expect(r.enqueued).toBe(true);
  return r.entryId;
}

beforeEach(() => {
  db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-cb-ack-")), "saydo.db"));
  nowMs = Date.parse("2026-07-25T10:00:00.000Z");
  engine = new CallbackEngine({ db, audit: nullAudit, now: () => new Date(nowMs) });
});

describe("ack 端点", () => {
  it("notified ⇒ 200 acked;mobile_lan 403", () => {
    db.prepare(
      `INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at)
       VALUES (?, 'p', 'coding', 'active', '{}', 'stepwise', ?, ?)`
    ).run(PRJ, NOW, NOW);
    db.prepare(
      `INSERT INTO tasks(id, project_id, title, spec_markdown, route, status, adapter, budget_json, created_at, updated_at)
       VALUES (?, ?, 't', '# t', 'tier1', 'ready_for_review', 'cursor', '{}', ?, ?)`
    ).run(TSK, PRJ, NOW, NOW);
    const id = enqueue(TSK, "blocked", "e1");
    engine.attemptNotify(id, { nowHm: "10:00", channelReachable: true });
    const ok = handleOutboxAck(engine, db, id, "local");
    expect(ok.status).toBe(200);
    expect(ok.payload).toMatchObject({ ok: true, state: "acked" });
    expect(getOutboxEntry(db, id)?.state).toBe("acked");
    const denied = handleOutboxAck(engine, db, id, "mobile_lan");
    expect(denied.status).toBe(403);
    expect(mobileLanApiAllowed("POST", `/api/outbox/${id}/ack`)).toBe(false);
  });
});

describe("隐式 ack 只作用于 L0", () => {
  it("同项目 notified(escalation 0) 才 ack,L1 不动", () => {
    db.prepare(
      `INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at)
       VALUES (?, 'p', 'coding', 'active', '{}', 'stepwise', ?, ?)`
    ).run(PRJ, NOW, NOW);
    db.prepare(
      `INSERT INTO tasks(id, project_id, title, spec_markdown, route, status, adapter, budget_json, created_at, updated_at)
       VALUES (?, ?, 't1', '# t', 'tier1', 'ready_for_review', 'cursor', '{}', ?, ?)`
    ).run(TSK, PRJ, NOW, NOW);
    db.prepare(
      `INSERT INTO tasks(id, project_id, title, spec_markdown, route, status, adapter, budget_json, created_at, updated_at)
       VALUES (?, ?, 't2', '# t', 'tier1', 'blocked', 'cursor', '{}', ?, ?)`
    ).run(TSK2, PRJ, NOW, NOW);
    db.prepare(
      `INSERT INTO sessions(id, project_id, state, engine, transcript_path, started_at)
       VALUES (?, ?, 'talking', 'cascade', '/tmp/t.jsonl', ?)`
    ).run(SES, PRJ, NOW);
    const l0 = enqueue(TSK, "blocked", "e0");
    const l1 = enqueue(TSK2, "blocked", "e1");
    engine.attemptNotify(l0, { nowHm: "10:00", channelReachable: true });
    engine.attemptNotify(l1, { nowHm: "10:00", channelReachable: true, escalationDelta: 1 });
    expect(getOutboxEntry(db, l0)?.escalationLevel).toBe(0);
    expect(getOutboxEntry(db, l1)?.escalationLevel).toBe(1);
    const n = ackL0ForSession(db, engine, SES);
    expect(n).toBe(1);
    expect(getOutboxEntry(db, l0)?.state).toBe("acked");
    expect(getOutboxEntry(db, l1)?.state).toBe("notified");
  });
});

describe("任务终局 resolve/冻结", () => {
  it("approve ⇒ ready_for_review 条目 resolved(superseded)", () => {
    expect(seedConsoleFixture(db).seeded).toBe(true);
    const r = handleTaskAction(db, nullAudit, RDY, "review", { verdict: "approve", expectedAttempt: 1 }, NOW);
    expect(r.status).toBe(200);
    const row = db
      .prepare("SELECT state, resolution FROM callback_outbox WHERE task_id=? AND trigger='ready_for_review'")
      .get(RDY) as { state: string; resolution: string };
    expect(row.state).toBe("resolved");
    expect(row.resolution).toBe("superseded");
  });

  it("cancel ⇒ 冻结全部活跃条目", () => {
    expect(seedConsoleFixture(db).seeded).toBe(true);
    const r = handleTaskAction(db, nullAudit, B1K, "cancel", {}, NOW);
    expect(r.status).toBe(200);
    const row = db
      .prepare("SELECT state, resolution FROM callback_outbox WHERE task_id=?")
      .get(B1K) as { state: string; resolution: string };
    expect(row.state).toBe("resolved");
    expect(row.resolution).toBe("superseded");
  });

  it("request_changes ⇒ ready_for_review 条目 resolved(superseded)", () => {
    expect(seedConsoleFixture(db).seeded).toBe(true);
    const r = handleTaskAction(
      db,
      nullAudit,
      RDY,
      "review",
      { verdict: "request_changes", expectedAttempt: 1, comments: "改表头" },
      NOW
    );
    expect(r.status).toBe(200);
    const row = db
      .prepare("SELECT state, resolution FROM callback_outbox WHERE task_id=? AND trigger='ready_for_review'")
      .get(RDY) as { state: string; resolution: string };
    expect(row.state).toBe("resolved");
    expect(row.resolution).toBe("superseded");
  });

  it("reject ⇒ 冻结活跃条目", () => {
    expect(seedConsoleFixture(db).seeded).toBe(true);
    const r = handleTaskAction(db, nullAudit, RDY, "review", { verdict: "reject", expectedAttempt: 1 }, NOW);
    expect(r.status).toBe(200);
    const row = db
      .prepare("SELECT state, resolution FROM callback_outbox WHERE task_id=?")
      .get(RDY) as { state: string; resolution: string };
    expect(row.state).toBe("resolved");
    expect(row.resolution).toBe("superseded");
  });

  it("retry 消解 blocked ⇒ resolved", () => {
    expect(seedConsoleFixture(db).seeded).toBe(true);
    const r = handleTaskAction(db, nullAudit, B1K, "retry", { message: "用企业微信 webhook" }, NOW);
    expect(r.status).toBe(200);
    const row = db
      .prepare("SELECT state, resolution FROM callback_outbox WHERE task_id=? AND trigger='blocked'")
      .get(B1K) as { state: string; resolution: string };
    expect(row.state).toBe("resolved");
    expect(row.resolution).toBe("superseded");
  });
});

describe("acked 超时 ⇒ requeued ⇒ sweep L1 重投", () => {
  it("resolution-timeout 后 L1 桌面+ntfy", async () => {
    db.prepare(
      `INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at)
       VALUES (?, '报表系统', 'coding', 'active', '{}', 'stepwise', ?, ?)`
    ).run(PRJ, NOW, NOW);
    db.prepare(
      `INSERT INTO tasks(id, project_id, title, spec_markdown, route, status, adapter, budget_json, created_at, updated_at)
       VALUES (?, ?, '导出功能', '# t', 'tier1', 'blocked', 'cursor', '{}', ?, ?)`
    ).run(TSK, PRJ, NOW, NOW);
    const id = enqueue(TSK, "blocked", "e1");
    engine.attemptNotify(id, { nowHm: "10:00", channelReachable: true });
    engine.ack(id);
    nowMs += 31 * 60_000;
    const desktopCalls: { title: string; body: string }[] = [];
    const ntfyCalls: unknown[] = [];
    const deps: SweepDeps = {
      db,
      engine,
      arbitrate,
      voice: {
        consolePeerForTask: () => null,
        ttsHealthy: () => false,
        voiceBusy: () => false,
        say: async () => false,
        consoleSay: () => false
      },
      desktop: {
        notify: async (i) => {
          desktopCalls.push(i);
          return true;
        }
      },
      ntfy: {
        enabled: true,
        post: async (msg) => {
          ntfyCalls.push(msg);
          return true;
        },
        render: (d, entry) => renderNtfyMessage(d, entry, { consoleBase: "http://127.0.0.1:47100" })
      },
      dnd: { inWindow: () => false, windowEnd: () => null },
      log: { info: () => undefined, warn: () => undefined, error: () => undefined },
      audit: nullAudit,
      l1FailWarned: new Set(),
      escalateAcked: () => engine.escalateAckedIfStale()
    };
    await runCallbackSweep(deps, new Date(nowMs));
    expect(desktopCalls).toHaveLength(1);
    expect(ntfyCalls).toHaveLength(1);
    const entry = getOutboxEntry(db, id);
    expect(entry?.state).toBe("notified");
    expect(entry?.escalationLevel).toBe(1);
  });

  it("DND + resolution-timeout:requeued 走低优先级 ntfy,不提前 notified", async () => {
    db.prepare(
      `INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at)
       VALUES (?, '报表系统', 'coding', 'active', '{}', 'stepwise', ?, ?)`
    ).run(PRJ, NOW, NOW);
    db.prepare(
      `INSERT INTO tasks(id, project_id, title, spec_markdown, route, status, adapter, budget_json, created_at, updated_at)
       VALUES (?, ?, '导出功能', '# t', 'tier1', 'blocked', 'cursor', '{}', ?, ?)`
    ).run(TSK, PRJ, NOW, NOW);
    const id = enqueue(TSK, "blocked", "e1");
    engine.attemptNotify(id, { nowHm: "10:00", channelReachable: true });
    engine.ack(id);
    nowMs += 31 * 60_000;
    const ntfyCalls: { priority: number }[] = [];
    const deps: SweepDeps = {
      db,
      engine,
      arbitrate,
      voice: {
        consolePeerForTask: () => null,
        ttsHealthy: () => false,
        voiceBusy: () => false,
        say: async () => false,
        consoleSay: () => false
      },
      desktop: { notify: async () => true },
      ntfy: {
        enabled: true,
        post: async (msg) => {
          ntfyCalls.push({ priority: msg.priority });
          return true;
        },
        render: (d, entry) => renderNtfyMessage(d, entry, { consoleBase: "http://127.0.0.1:47100" })
      },
      dnd: { inWindow: () => true, windowEnd: () => "2026-07-25T16:00:00.000Z" },
      log: { info: () => undefined, warn: () => undefined, error: () => undefined },
      audit: nullAudit,
      l1FailWarned: new Set(),
      escalateAcked: () => engine.escalateAckedIfStale()
    };
    await runCallbackSweep(deps, new Date(nowMs));
    expect(ntfyCalls).toHaveLength(1);
    expect(ntfyCalls[0]?.priority).toBe(2);
    expect(getOutboxEntry(db, id)?.state).toBe("requeued");
  });

  it("超时后 L1 双失败仍保持 requeued 可重投", async () => {
    db.prepare(
      `INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at)
       VALUES (?, '报表系统', 'coding', 'active', '{}', 'stepwise', ?, ?)`
    ).run(PRJ, NOW, NOW);
    db.prepare(
      `INSERT INTO tasks(id, project_id, title, spec_markdown, route, status, adapter, budget_json, created_at, updated_at)
       VALUES (?, ?, '导出功能', '# t', 'tier1', 'blocked', 'cursor', '{}', ?, ?)`
    ).run(TSK, PRJ, NOW, NOW);
    const id = enqueue(TSK, "blocked", "e1");
    engine.attemptNotify(id, { nowHm: "10:00", channelReachable: true });
    engine.ack(id);
    nowMs += 31 * 60_000;
    const deps: SweepDeps = {
      db,
      engine,
      arbitrate,
      voice: {
        consolePeerForTask: () => null,
        ttsHealthy: () => false,
        voiceBusy: () => false,
        say: async () => false,
        consoleSay: () => false
      },
      desktop: { notify: async () => false },
      ntfy: {
        enabled: true,
        post: async () => false,
        render: (d, entry) => renderNtfyMessage(d, entry, { consoleBase: "http://127.0.0.1:47100" })
      },
      dnd: { inWindow: () => false, windowEnd: () => null },
      log: { info: () => undefined, warn: () => undefined, error: () => undefined },
      audit: nullAudit,
      l1FailWarned: new Set(),
      escalateAcked: () => engine.escalateAckedIfStale()
    };
    await runCallbackSweep(deps, new Date(nowMs));
    expect(getOutboxEntry(db, id)?.state).toBe("requeued");
    deps.desktop.notify = async () => true;
    deps.ntfy.post = async () => true;
    await runCallbackSweep(deps, new Date(nowMs));
    expect(getOutboxEntry(db, id)?.state).toBe("notified");
    expect(getOutboxEntry(db, id)?.escalationLevel).toBe(1);
  });

  it("ack 两次超时:sweep/engine 路径 escalation 仍为 1(DAO 仍允许升到 2)", async () => {
    db.prepare(
      `INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at)
       VALUES (?, 'p', 'coding', 'active', '{}', 'stepwise', ?, ?)`
    ).run(PRJ, NOW, NOW);
    db.prepare(
      `INSERT INTO tasks(id, project_id, title, spec_markdown, route, status, adapter, budget_json, created_at, updated_at)
       VALUES (?, ?, 't', '# t', 'tier1', 'blocked', 'cursor', '{}', ?, ?)`
    ).run(TSK, PRJ, NOW, NOW);
    const id = enqueue(TSK, "blocked", "e1");
    engine.attemptNotify(id, { nowHm: "10:00", channelReachable: true });
    engine.ack(id);
    const makeDeps = (): SweepDeps => ({
      db,
      engine,
      arbitrate,
      voice: {
        consolePeerForTask: () => null,
        ttsHealthy: () => false,
        voiceBusy: () => false,
        say: async () => false,
        consoleSay: () => false
      },
      desktop: { notify: async () => true },
      ntfy: {
        enabled: true,
        post: async () => true,
        render: (d, entry) => renderNtfyMessage(d, entry, { consoleBase: "http://127.0.0.1:47100" })
      },
      dnd: { inWindow: () => false, windowEnd: () => null },
      log: { info: () => undefined, warn: () => undefined, error: () => undefined },
      audit: nullAudit,
      l1FailWarned: new Set(),
      escalateAcked: () => engine.escalateAckedIfStale()
    });
    nowMs += 31 * 60_000;
    await runCallbackSweep(makeDeps(), new Date(nowMs));
    expect(getOutboxEntry(db, id)?.escalationLevel).toBe(1);
    engine.ack(id);
    nowMs += 31 * 60_000;
    await runCallbackSweep(makeDeps(), new Date(nowMs));
    expect(getOutboxEntry(db, id)?.state).toBe("notified");
    expect(getOutboxEntry(db, id)?.escalationLevel).toBe(1);
  });
});
