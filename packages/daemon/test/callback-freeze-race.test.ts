// SC-34:跨 await 冻结/ack 后不得续投未启动渠道,也不得把 resolved/acked 冒写 notified。
// 真实临时 SQLite + 生产 CallbackEngine / runCallbackSweep;渠道是可控假实现,不是真实外呼。

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { OutboxTrigger, Tier1SettleProof } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { CallbackEngine } from "../src/callback/engine.js";
import { handleOutboxAck } from "../src/callback/ack.js";
import { arbitrate } from "../src/callback/arbitration.js";
import { renderNtfyMessage, type NtfyMessage } from "../src/callback/ntfy.js";
import type { EmailMessage } from "../src/callback/email.js";
import { runCallbackSweep, type SweepDeps, type SweepReport } from "../src/callback/sweep.js";
import { getOutboxEntry } from "../src/storage/dao/outbox.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import type { AuditSink } from "../src/obs/audit.js";

const PRJ = "prj_01AAAAAAAAAAAAAAAAAAAAAAAA";
const TSK = "tsk_01AAAAAAAAAAAAAAAAAAAAAAAA";
const TSK2 = "tsk_01BBBBBBBBBBBBBBBBBBBBBBBB";
const SES = "ses_01AAAAAAAAAAAAAAAAAAAAAAAA";

const proof = (taskId: string): Tier1SettleProof => ({
  kind: "tier1",
  taskId,
  runId: "run-1",
  attempt: 1,
  packageRevision: 1,
  treeSha: "abc123",
  tier1VerifyDigest: "sha256:" + "1".repeat(64),
  acceptanceChecks: [],
  transcriptCursor: "c-100",
  settledAt: "2026-07-25T00:00:00.000Z"
});

let tmpDir: string | undefined;
let db: Db | undefined;
let nowMs: number;
let engine: CallbackEngine;
let audit: AuditSink;

function requireDb(): Db {
  if (!db) throw new Error("test db not opened");
  return db;
}

function auditActions(): string[] {
  return (requireDb().prepare("SELECT action FROM audit_log ORDER BY ts, id").all() as { action: string }[]).map(
    (r) => r.action
  );
}

function voiceSentMeta(): { entryId: string; sessionId: string }[] {
  return (
    requireDb()
      .prepare("SELECT meta_json FROM audit_log WHERE action='callback.voice_sent' ORDER BY ts, id")
      .all() as { meta_json: string }[]
  ).map((r) => JSON.parse(r.meta_json) as { entryId: string; sessionId: string });
}

function seedProject(): void {
  const t0 = "2026-07-25T09:00:00.000Z";
  requireDb()
    .prepare(
      `INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at)
     VALUES (?, '报表系统', 'coding', 'active', '{}', 'stepwise', ?, ?)`
    )
    .run(PRJ, t0, t0);
}

function seedTask(id: string, title: string): void {
  const t0 = "2026-07-25T09:00:00.000Z";
  requireDb()
    .prepare(
      `INSERT INTO tasks(id, project_id, title, spec_markdown, route, status, adapter, budget_json, created_at, updated_at)
     VALUES (?, ?, ?, '# t', 'tier1', 'ready_for_review', 'cursor', '{}', ?, ?)`
    )
    .run(id, PRJ, title, t0, t0);
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

function deferred<T = void>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

interface RaceHarness {
  deps: SweepDeps;
  desktopCalls: { title: string; body: string }[];
  ntfyCalls: NtfyMessage[];
  emails: EmailMessage[];
  sayCalls: number;
  infoLogs: { msg: string; fields?: Record<string, unknown> }[];
  desktopStarted: Promise<void>;
  ntfyStarted: Promise<void>;
  sayStarted: Promise<void>;
  releaseDesktop: (ok?: boolean) => void;
  releaseNtfy: (ok?: boolean) => void;
  releaseSay: (ok?: boolean) => void;
}

function raceHarness(over: {
  peer?: string | null;
  ttsHealthy?: boolean;
  inDnd?: boolean;
  holdDesktop?: boolean;
  holdNtfy?: boolean;
  holdSay?: boolean;
  email?: boolean;
}): RaceHarness {
  const desktopCalls: RaceHarness["desktopCalls"] = [];
  const ntfyCalls: NtfyMessage[] = [];
  const emails: EmailMessage[] = [];
  const infoLogs: RaceHarness["infoLogs"] = [];
  let sayCalls = 0;
  const desktopGate = deferred<boolean>();
  const ntfyGate = deferred<boolean>();
  const sayGate = deferred<boolean>();
  const desktopStarted = deferred();
  const ntfyStarted = deferred();
  const sayStarted = deferred();
  let desktopStartedOnce = false;
  let ntfyStartedOnce = false;
  let sayStartedOnce = false;

  const deps: SweepDeps = {
    db: requireDb(),
    engine,
    arbitrate,
    voice: {
      consolePeerForTask: () => (over.peer === undefined ? null : over.peer),
      ttsHealthy: () => over.ttsHealthy === true,
      voiceBusy: () => false,
      say: async () => {
        sayCalls += 1;
        if (!sayStartedOnce) {
          sayStartedOnce = true;
          sayStarted.resolve();
        }
        if (over.holdSay) return sayGate.promise;
        return true;
      },
      consoleSay: () => false
    },
    desktop: {
      notify: async (i) => {
        desktopCalls.push(i);
        if (!desktopStartedOnce) {
          desktopStartedOnce = true;
          desktopStarted.resolve();
        }
        if (over.holdDesktop) return desktopGate.promise;
        return true;
      }
    },
    ntfy: {
      enabled: true,
      post: async (msg) => {
        ntfyCalls.push(msg);
        if (!ntfyStartedOnce) {
          ntfyStartedOnce = true;
          ntfyStarted.resolve();
        }
        if (over.holdNtfy) return ntfyGate.promise;
        return true;
      },
      render: (d, entry) => renderNtfyMessage(d, entry, { consoleBase: "http://127.0.0.1:47100" })
    },
    ...(over.email
      ? {
          email: {
            enabled: true,
            send: async (m: EmailMessage) => {
              emails.push(m);
              return true;
            },
            render: (): EmailMessage => ({
              subject: "fixture",
              text: "fixture",
              click: "http://127.0.0.1:47100/#/p/prj/task/tsk",
              messageId: "<ntf_fixture@example.test>"
            }),
            recordThread: () => undefined
          }
        }
      : {}),
    dnd: {
      inWindow: () => over.inDnd === true,
      windowEnd: () => "2026-07-25T16:00:00.000Z"
    },
    log: {
      info: (msg, fields) => {
        infoLogs.push({ msg, ...(fields !== undefined ? { fields } : {}) });
      },
      warn: () => undefined,
      error: () => undefined
    },
    audit,
    l1FailWarned: new Set()
  };

  return {
    deps,
    desktopCalls,
    ntfyCalls,
    emails,
    sayCalls,
    infoLogs,
    desktopStarted: desktopStarted.promise,
    ntfyStarted: ntfyStarted.promise,
    sayStarted: sayStarted.promise,
    releaseDesktop: (ok = true) => desktopGate.resolve(ok),
    releaseNtfy: (ok = true) => ntfyGate.resolve(ok),
    releaseSay: (ok = true) => sayGate.resolve(ok)
  };
}

function sweep(h: RaceHarness): Promise<SweepReport> {
  return runCallbackSweep(h.deps, new Date(nowMs));
}

beforeEach(() => {
  tmpDir = undefined;
  db = undefined;
  tmpDir = mkdtempSync(join(tmpdir(), "saydo-cb-frz-"));
  nowMs = Date.parse("2026-07-25T10:00:00.000Z");
  db = openDb(join(tmpDir, "saydo.db"));
  audit = createSqliteAuditSink(db, () => new Date(nowMs));
  engine = new CallbackEngine({ db, audit, now: () => new Date(nowMs) });
  seedProject();
  seedTask(TSK, "导出功能");
});

afterEach(() => {
  const dir = tmpDir;
  const conn = db;
  tmpDir = undefined;
  db = undefined;
  try {
    conn?.close();
  } catch {
    // already closed
  }
  if (dir !== undefined) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("L1 异步渠道期间冻结/ack", () => {
  it("desktop.await 期间 freezeForTask:已发桌面保留,不再 ntfy/email,不冒写 notified", async () => {
    const id = enqueue(TSK, "blocked", "e1");
    const h = raceHarness({ holdDesktop: true, email: true });
    const pending = sweep(h);
    await h.desktopStarted;
    expect(engine.freezeForTask(TSK)).toBe(1);
    expect(getOutboxEntry(requireDb(), id)?.state).toBe("resolved");
    h.releaseDesktop(true);
    const r = await pending;
    expect(r.desktopSent).toBe(1);
    expect(r.ntfySent).toBe(0);
    expect(r.emailSent).toBe(0);
    expect(r.l1Notified).toBe(0);
    expect(h.ntfyCalls).toHaveLength(0);
    expect(h.emails).toHaveLength(0);
    const entry = getOutboxEntry(requireDb(), id);
    expect(entry?.state).toBe("resolved");
    expect(entry?.resolution).toBe("superseded");
    expect(entry?.notifiedAt).toBeUndefined();
    const stale = engine.attemptNotify(id, { nowHm: "10:00", channelReachable: true });
    expect(stale.delivered).toBe(false);
    expect(stale.reason).toBe("outbox no longer deliverable");
    expect(getOutboxEntry(requireDb(), id)?.state).toBe("resolved");
  });

  it("L0 应答窗 L1 的 desktop.await 期间 ack:保留 acked,不再 ntfy,不重写 notified", async () => {
    const id = enqueue(TSK, "blocked", "e1");
    const first = raceHarness({ peer: SES, ttsHealthy: true });
    await sweep(first);
    expect(getOutboxEntry(requireDb(), id)?.state).toBe("notified");
    expect(getOutboxEntry(requireDb(), id)?.escalationLevel).toBe(0);
    nowMs += 31_000;
    const h = raceHarness({ peer: SES, ttsHealthy: true, holdDesktop: true });
    const pending = sweep(h);
    await h.desktopStarted;
    const ack = handleOutboxAck(engine, requireDb(), id, "local");
    expect(ack.status).toBe(200);
    expect(ack.payload).toMatchObject({ ok: true, state: "acked" });
    h.releaseDesktop(true);
    const r = await pending;
    expect(r.desktopSent).toBe(1);
    expect(r.ntfySent).toBe(0);
    expect(h.ntfyCalls).toHaveLength(0);
    const entry = getOutboxEntry(requireDb(), id);
    expect(entry?.state).toBe("acked");
    expect(entry?.escalationLevel).toBe(0);
    const rewrite = engine.attemptNotify(id, { nowHm: "10:00", channelReachable: true, escalationDelta: 1 });
    expect(rewrite.delivered).toBe(false);
    expect(getOutboxEntry(requireDb(), id)?.state).toBe("acked");
  });
});

describe("DND / 同扫描后一条 / L0 / 正向", () => {
  it("DND ntfy.await 期间冻结:已发 ntfy 保留,不再 email,不 snooze 冒写", async () => {
    const id = enqueue(TSK, "blocked", "e1");
    const h = raceHarness({ inDnd: true, holdNtfy: true, email: true });
    const pending = sweep(h);
    await h.ntfyStarted;
    expect(engine.freezeForTask(TSK)).toBe(1);
    h.releaseNtfy(true);
    const r = await pending;
    expect(r.ntfySent).toBe(1);
    expect(r.emailSent).toBe(0);
    expect(r.snoozed).toBe(0);
    expect(h.emails).toHaveLength(0);
    expect(getOutboxEntry(requireDb(), id)?.state).toBe("resolved");
    expect(getOutboxEntry(requireDb(), id)?.snoozedUntil).toBeUndefined();
  });

  it("DND 同一扫描先取两条,前一条 ntfy.await 期间冻结后一条:后一条零外呼", async () => {
    seedTask(TSK2, "验收任务");
    const firstId = enqueue(TSK, "blocked", "e1");
    const secondId = enqueue(TSK2, "blocked", "e2");
    const h = raceHarness({ inDnd: true, holdNtfy: true });
    const pending = sweep(h);
    await h.ntfyStarted;
    expect(engine.freezeForTask(TSK2)).toBe(1);
    h.releaseNtfy(true);
    const r = await pending;
    expect(r.ntfySent).toBe(1);
    expect(r.snoozed).toBe(1);
    expect(h.ntfyCalls).toHaveLength(1);
    expect(getOutboxEntry(requireDb(), firstId)?.state).toBe("pending");
    expect(getOutboxEntry(requireDb(), firstId)?.snoozedUntil).toBe("2026-07-25T16:00:00.000Z");
    expect(getOutboxEntry(requireDb(), secondId)?.state).toBe("resolved");
    expect(getOutboxEntry(requireDb(), secondId)?.snoozedUntil).toBeUndefined();
  });

  it("同一扫描先取两条,前一条 desktop.await 期间冻结后一条:后一条零外呼", async () => {
    seedTask(TSK2, "验收任务");
    const firstId = enqueue(TSK, "blocked", "e1");
    const secondId = enqueue(TSK2, "blocked", "e2");
    const h = raceHarness({ holdDesktop: true });
    const pending = sweep(h);
    await h.desktopStarted;
    expect(engine.freezeForTask(TSK2)).toBe(1);
    expect(getOutboxEntry(requireDb(), secondId)?.state).toBe("resolved");
    h.releaseDesktop(true);
    const r = await pending;
    expect(r.desktopSent).toBe(1);
    expect(r.ntfySent).toBe(1);
    expect(h.desktopCalls).toHaveLength(1);
    expect(h.ntfyCalls).toHaveLength(1);
    expect(getOutboxEntry(requireDb(), firstId)?.state).toBe("notified");
    expect(getOutboxEntry(requireDb(), secondId)?.state).toBe("resolved");
    expect(getOutboxEntry(requireDb(), secondId)?.notifiedAt).toBeUndefined();
  });

  it("L0 say.await 期间冻结:已出口语音计数保留,不落 notified,不降 L1", async () => {
    const id = enqueue(TSK, "blocked", "e1");
    const h = raceHarness({ peer: SES, ttsHealthy: true, holdSay: true });
    const pending = sweep(h);
    await h.sayStarted;
    expect(engine.freezeForTask(TSK)).toBe(1);
    h.releaseSay(true);
    const r = await pending;
    expect(r.voiceSent).toBe(1);
    expect(r.desktopSent).toBe(0);
    expect(r.ntfySent).toBe(0);
    expect(r.l1Notified).toBe(0);
    expect(h.desktopCalls).toHaveLength(0);
    expect(h.ntfyCalls).toHaveLength(0);
    expect(getOutboxEntry(requireDb(), id)?.state).toBe("resolved");
    expect(getOutboxEntry(requireDb(), id)?.notifiedAt).toBeUndefined();
    expect(voiceSentMeta()).toEqual([{ entryId: id, sessionId: SES }]);
    expect(auditActions().filter((a) => a === "callback.enqueue")).toHaveLength(1);
    expect(auditActions().filter((a) => a === "callback.freeze")).toHaveLength(1);
    expect(auditActions().filter((a) => a === "callback.voice_sent")).toHaveLength(1);
    expect(auditActions()).toHaveLength(3);
    const freezeMeta = (
      requireDb().prepare("SELECT meta_json FROM audit_log WHERE action='callback.freeze'").all() as {
        meta_json: string;
      }[]
    ).map((r) => JSON.parse(r.meta_json) as { taskId: string; frozen: number });
    expect(freezeMeta).toEqual([{ taskId: TSK, frozen: 1 }]);
    expect(h.infoLogs.filter((l) => l.msg === "callback L0 voice sent")).toEqual([
      { msg: "callback L0 voice sent", fields: { entryId: id, sessionId: SES } }
    ]);
  });

  it("无冻结的普通 L1:桌面+ntfy 后 notified(escalation 1)", async () => {
    const id = enqueue(TSK, "blocked", "e1");
    const h = raceHarness({});
    const r = await sweep(h);
    expect(r.desktopSent).toBe(1);
    expect(r.ntfySent).toBe(1);
    expect(r.l1Notified).toBe(1);
    expect(h.desktopCalls).toHaveLength(1);
    expect(h.ntfyCalls).toHaveLength(1);
    const entry = getOutboxEntry(requireDb(), id);
    expect(entry?.state).toBe("notified");
    expect(entry?.escalationLevel).toBe(1);
  });
});
