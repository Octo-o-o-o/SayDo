// S2 回叫 sweep:分级选路 / DND 只推不响 / L0 应答窗升 L1。内存 DB + 桩,禁真 spawn / 真 fetch。

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { OutboxTrigger, Tier1SettleProof } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { CallbackEngine } from "../src/callback/engine.js";
import { arbitrate } from "../src/callback/arbitration.js";
import { renderNtfyMessage, type NtfyMessage } from "../src/callback/ntfy.js";
import { pickConsolePeerForTask, runCallbackSweep, type SweepDeps, type SweepReport } from "../src/callback/sweep.js";
import { getOutboxEntry } from "../src/storage/dao/outbox.js";
import type { AuditSink } from "../src/obs/audit.js";

const PRJ = "prj_01AAAAAAAAAAAAAAAAAAAAAAAA";
const TSK = "tsk_01AAAAAAAAAAAAAAAAAAAAAAAA";
const TSK2 = "tsk_01BBBBBBBBBBBBBBBBBBBBBBBB";
const SES = "ses_01AAAAAAAAAAAAAAAAAAAAAAAA";
const SES2 = "ses_01BBBBBBBBBBBBBBBBBBBBBBBB";

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
const auditEvents: { action: string; meta?: Record<string, unknown> }[] = [];
const audit: AuditSink = {
  record: (e) => {
    auditEvents.push({ action: e.action, ...(e.meta !== undefined ? { meta: e.meta } : {}) });
    return { id: "aud_x" };
  }
};

function seedProject(): void {
  const t0 = "2026-07-25T09:00:00.000Z";
  db.prepare(
    `INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at)
     VALUES (?, '报表系统', 'coding', 'active', '{}', 'stepwise', ?, ?)`
  ).run(PRJ, t0, t0);
}

function seedTask(id: string, title: string): void {
  const t0 = "2026-07-25T09:00:00.000Z";
  db.prepare(
    `INSERT INTO tasks(id, project_id, title, spec_markdown, route, status, adapter, budget_json, created_at, updated_at)
     VALUES (?, ?, ?, '# t', 'tier1', 'ready_for_review', 'cursor', '{}', ?, ?)`
  ).run(id, PRJ, title, t0, t0);
}

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

interface Harness {
  deps: SweepDeps;
  sayCalls: { sessionId: string; text: string; origin: string }[];
  desktopCalls: { title: string; body: string }[];
  ntfyCalls: NtfyMessage[];
  warnMsgs: string[];
  consoleSayCalls: { sessionId: string; text: string }[];
}

function harness(over: {
  peer?: string | null | ((taskId: string) => string | null);
  ttsHealthy?: boolean;
  voiceBusy?: boolean | ((sessionId: string) => boolean);
  desktopOk?: boolean | ((n: number) => boolean);
  ntfyOk?: boolean | ((n: number) => boolean);
  ntfyEnabled?: boolean;
  inDnd?: boolean;
  windowEnd?: string | null;
  sayOk?: boolean;
}): Harness {
  const sayCalls: Harness["sayCalls"] = [];
  const desktopCalls: Harness["desktopCalls"] = [];
  const ntfyCalls: NtfyMessage[] = [];
  const warnMsgs: string[] = [];
  const consoleSayCalls: Harness["consoleSayCalls"] = [];
  let desktopN = 0;
  let ntfyN = 0;
  const deps: SweepDeps = {
    db,
    engine,
    arbitrate,
    voice: {
      consolePeerForTask: (taskId) => {
        const p = over.peer;
        if (typeof p === "function") return p(taskId);
        return p === undefined ? SES : p;
      },
      ttsHealthy: () => over.ttsHealthy !== false,
      voiceBusy: (sessionId) => {
        const v = over.voiceBusy;
        if (typeof v === "function") return v(sessionId);
        return v === true;
      },
      say: async (sessionId, text, origin) => {
        sayCalls.push({ sessionId, text, origin });
        return over.sayOk !== false;
      },
      consoleSay: (sessionId, text) => {
        consoleSayCalls.push({ sessionId, text });
        return true;
      }
    },
    desktop: {
      notify: async (i) => {
        desktopCalls.push(i);
        desktopN += 1;
        const ok = over.desktopOk;
        return typeof ok === "function" ? ok(desktopN) : ok !== false;
      }
    },
    ntfy: {
      enabled: over.ntfyEnabled !== false,
      post: async (msg) => {
        ntfyCalls.push(msg);
        ntfyN += 1;
        const ok = over.ntfyOk;
        return typeof ok === "function" ? ok(ntfyN) : ok !== false;
      },
      render: (d, entry) => renderNtfyMessage(d, entry, { consoleBase: "http://127.0.0.1:47100" })
    },
    dnd: {
      inWindow: () => over.inDnd === true,
      windowEnd: () => over.windowEnd ?? "2026-07-25T16:00:00.000Z"
    },
    log: {
      info: () => undefined,
      warn: (msg) => {
        warnMsgs.push(msg);
      },
      error: () => undefined
    },
    audit,
    l1FailWarned: new Set()
  };
  return { deps, sayCalls, desktopCalls, ntfyCalls, warnMsgs, consoleSayCalls };
}

async function sweep(h: Harness): Promise<SweepReport> {
  return runCallbackSweep(h.deps, new Date(nowMs));
}

beforeEach(() => {
  db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-cb-sw-")), "saydo.db"));
  nowMs = Date.parse("2026-07-25T10:00:00.000Z");
  engine = new CallbackEngine({ db, audit, now: () => new Date(nowMs) });
  auditEvents.length = 0;
  seedProject();
  seedTask(TSK, "导出功能");
});

describe("L0 语音选路", () => {
  it("L0 条件满足 ⇒ say 一次 + notified(escalation 0)", async () => {
    const id = enqueue(TSK, "blocked", "e1");
    const h = harness({ peer: SES, ttsHealthy: true, voiceBusy: false });
    const r = await sweep(h);
    expect(r.voiceSent).toBe(1);
    expect(h.sayCalls).toHaveLength(1);
    expect(h.sayCalls[0]?.text).toContain("卡住");
    expect(h.sayCalls[0]?.origin).toBe("callback");
    expect(h.desktopCalls).toHaveLength(0);
    expect(h.ntfyCalls).toHaveLength(0);
    const entry = getOutboxEntry(db, id);
    expect(entry?.state).toBe("notified");
    expect(entry?.escalationLevel).toBe(0);
    expect(auditEvents.some((e) => e.action === "callback.voice_sent")).toBe(true);
  });

  it("无 peer ⇒ 直接 L1 两通道", async () => {
    const id = enqueue(TSK, "blocked", "e1");
    const h = harness({ peer: null });
    const r = await sweep(h);
    expect(r.voiceSent).toBe(0);
    expect(h.sayCalls).toHaveLength(0);
    expect(h.desktopCalls).toHaveLength(1);
    expect(h.ntfyCalls).toHaveLength(1);
    expect(h.desktopCalls[0]?.title).toBe("SayDo · 报表系统");
    const entry = getOutboxEntry(db, id);
    expect(entry?.state).toBe("notified");
    expect(entry?.escalationLevel).toBe(1);
  });

  it("TTS 不健康 ⇒ L1,并给 console 文字气泡", async () => {
    const id = enqueue(TSK, "blocked", "e1");
    const h = harness({ peer: SES, ttsHealthy: false });
    const r = await sweep(h);
    expect(r.voiceSent).toBe(0);
    expect(r.consoleSay).toBe(1);
    expect(h.consoleSayCalls).toHaveLength(1);
    expect(h.desktopCalls).toHaveLength(1);
    expect(h.ntfyCalls).toHaveLength(1);
    expect(getOutboxEntry(db, id)?.escalationLevel).toBe(1);
  });

  it("同 session busy:头一条 queue,同 session 其余 L1", async () => {
    seedTask(TSK2, "验收任务");
    const blk = enqueue(TSK, "blocked", "e1");
    const ready = enqueue(TSK2, "ready_for_review", "1");
    const h = harness({ peer: SES, ttsHealthy: true, voiceBusy: true });
    const r = await sweep(h);
    expect(r.queued).toBe(1);
    expect(h.sayCalls).toHaveLength(0);
    expect(getOutboxEntry(db, blk)?.state).toBe("pending");
    expect(getOutboxEntry(db, ready)?.state).toBe("notified");
    expect(getOutboxEntry(db, ready)?.escalationLevel).toBe(1);
    expect(h.desktopCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("head session busy 时另一空闲 session 仍 L0,不降 L1", async () => {
    seedTask(TSK2, "验收任务");
    const blk = enqueue(TSK, "blocked", "e1");
    const ready = enqueue(TSK2, "ready_for_review", "1");
    const h = harness({
      peer: (taskId) => (taskId === TSK ? SES : SES2),
      ttsHealthy: true,
      voiceBusy: (sessionId) => sessionId === SES
    });
    const r = await sweep(h);
    expect(r.queued).toBe(1);
    expect(r.voiceSent).toBe(1);
    expect(h.sayCalls).toHaveLength(1);
    expect(h.sayCalls[0]?.sessionId).toBe(SES2);
    expect(getOutboxEntry(db, blk)?.state).toBe("pending");
    expect(getOutboxEntry(db, ready)?.state).toBe("notified");
    expect(getOutboxEntry(db, ready)?.escalationLevel).toBe(0);
    expect(h.desktopCalls).toHaveLength(0);
  });

  it("voiceBusy 结束后仍 L0(生产判据是在途用户轮,不是 currentUserTurn)", async () => {
    const id = enqueue(TSK, "blocked", "e1");
    const h = harness({ peer: SES, ttsHealthy: true, voiceBusy: false });
    const r = await sweep(h);
    expect(r.voiceSent).toBe(1);
    expect(getOutboxEntry(db, id)?.state).toBe("notified");
    expect(getOutboxEntry(db, id)?.escalationLevel).toBe(0);
  });

  it("优先级 blocked 先于 ready_for_review", async () => {
    seedTask(TSK2, "验收任务");
    const ready = enqueue(TSK2, "ready_for_review", "1");
    const blk = enqueue(TSK, "blocked", "e1");
    const h = harness({ peer: SES, ttsHealthy: true, voiceBusy: false });
    await sweep(h);
    expect(h.sayCalls).toHaveLength(1);
    expect(h.sayCalls[0]?.text).toContain("卡住");
    expect(getOutboxEntry(db, blk)?.state).toBe("notified");
    expect(getOutboxEntry(db, ready)?.state).toBe("pending");
  });
});

describe("L0 应答窗与 L1", () => {
  it("L0 30s 未 ack ⇒ 升 L1(状态保持 notified,escalation=1)", async () => {
    const id = enqueue(TSK, "blocked", "e1");
    const h = harness({ peer: SES, ttsHealthy: true, voiceBusy: false });
    await sweep(h);
    expect(getOutboxEntry(db, id)?.escalationLevel).toBe(0);
    nowMs += 31_000;
    const h2 = harness({ peer: SES, ttsHealthy: true, voiceBusy: false });
    await sweep(h2);
    const entry = getOutboxEntry(db, id);
    expect(entry?.state).toBe("notified");
    expect(entry?.escalationLevel).toBe(1);
    expect(h2.desktopCalls).toHaveLength(1);
    expect(h2.ntfyCalls).toHaveLength(1);
    expect(h2.sayCalls).toHaveLength(0);
  });

  it("桌面失败 ntfy 成功 ⇒ notified", async () => {
    const id = enqueue(TSK, "blocked", "e1");
    const h = harness({ peer: null, desktopOk: false, ntfyOk: true });
    await sweep(h);
    expect(getOutboxEntry(db, id)?.state).toBe("notified");
    expect(getOutboxEntry(db, id)?.escalationLevel).toBe(1);
  });

  it("两者都失败 ⇒ 仍 pending + 单次告警", async () => {
    const id = enqueue(TSK, "blocked", "e1");
    const h = harness({ peer: null, desktopOk: false, ntfyOk: false });
    const r1 = await sweep(h);
    expect(r1.alerts).toBe(1);
    expect(getOutboxEntry(db, id)?.state).toBe("pending");
    const r2 = await sweep(h);
    expect(r2.alerts).toBe(0);
    expect(h.warnMsgs).toHaveLength(1);
  });

  it("requeued ⇒ L1 重投", async () => {
    const id = enqueue(TSK, "blocked", "e1");
    db.prepare("UPDATE callback_outbox SET state='requeued', updated_at=? WHERE id=?").run(
      new Date(nowMs).toISOString(),
      id
    );
    const h = harness({ peer: SES, ttsHealthy: true });
    await sweep(h);
    expect(h.sayCalls).toHaveLength(0);
    expect(h.desktopCalls).toHaveLength(1);
    expect(h.ntfyCalls).toHaveLength(1);
    const entry = getOutboxEntry(db, id);
    expect(entry?.state).toBe("notified");
    expect(entry?.escalationLevel).toBe(1);
  });

  it("escalation 不超过 1", async () => {
    const id = enqueue(TSK, "blocked", "e1");
    const h = harness({ peer: null });
    await sweep(h);
    expect(getOutboxEntry(db, id)?.escalationLevel).toBe(1);
    nowMs += 31_000;
    await sweep(h);
    expect(getOutboxEntry(db, id)?.escalationLevel).toBe(1);
    expect(getOutboxEntry(db, id)?.state).toBe("notified");
  });
});

describe("DND 只推不响", () => {
  it("DND ⇒ 仅 ntfy 低优先级一次 + snooze,再次 sweep 不重复发", async () => {
    const id = enqueue(TSK, "blocked", "e1");
    const h = harness({
      peer: SES,
      inDnd: true,
      windowEnd: "2026-07-25T16:00:00.000Z"
    });
    const r1 = await sweep(h);
    expect(r1.ntfySent).toBe(1);
    expect(r1.snoozed).toBe(1);
    expect(h.sayCalls).toHaveLength(0);
    expect(h.desktopCalls).toHaveLength(0);
    expect(h.ntfyCalls[0]?.priority).toBe(2);
    expect(h.ntfyCalls[0]?.body).toContain("免打扰时段");
    expect(getOutboxEntry(db, id)?.state).toBe("pending");
    expect(getOutboxEntry(db, id)?.snoozedUntil).toBe("2026-07-25T16:00:00.000Z");
    const r2 = await sweep(h);
    expect(r2.ntfySent).toBe(0);
    expect(h.ntfyCalls).toHaveLength(1);
  });

  it("DND 对 requeued 与 pending 同一套低优先级 ntfy + snooze", async () => {
    const pendingId = enqueue(TSK, "blocked", "e1");
    seedTask(TSK2, "验收任务");
    const rqId = enqueue(TSK2, "ready_for_review", "1");
    db.prepare("UPDATE callback_outbox SET state='requeued', updated_at=? WHERE id=?").run(
      new Date(nowMs).toISOString(),
      rqId
    );
    const h = harness({ peer: SES, inDnd: true, windowEnd: "2026-07-25T16:00:00.000Z" });
    const r = await sweep(h);
    expect(r.ntfySent).toBe(2);
    expect(r.snoozed).toBe(2);
    expect(h.desktopCalls).toHaveLength(0);
    expect(getOutboxEntry(db, pendingId)?.state).toBe("pending");
    expect(getOutboxEntry(db, rqId)?.state).toBe("requeued");
  });

  it("DND 结束 ⇒ 正常链", async () => {
    const id = enqueue(TSK, "blocked", "e1");
    const flag = { inDnd: true };
    const h = harness({ peer: null, inDnd: true, windowEnd: "2026-07-25T10:30:00.000Z" });
    h.deps.dnd.inWindow = () => flag.inDnd;
    await sweep(h);
    expect(getOutboxEntry(db, id)?.state).toBe("pending");
    flag.inDnd = false;
    nowMs = Date.parse("2026-07-25T10:31:00.000Z");
    const r2 = await sweep(h);
    expect(r2.l1Notified).toBe(1);
    expect(getOutboxEntry(db, id)?.state).toBe("notified");
    expect(h.desktopCalls.length).toBeGreaterThanOrEqual(1);
  });
});

describe("console peer 选路", () => {
  it("talking 优先于旧会话,再按 started_at 新到旧", () => {
    const picked = pickConsolePeerForTask(
      [
        { id: "ses_old", state: "suspended", started_at: "2026-07-25T12:00:00.000Z" },
        { id: "ses_talk", state: "talking", started_at: "2026-07-25T09:00:00.000Z" },
        { id: "ses_talk2", state: "talking", started_at: "2026-07-25T11:00:00.000Z" }
      ],
      (id) => id !== "ses_missing"
    );
    expect(picked).toBe("ses_talk2");
  });
});
