// 4.4 验收:§12-5(settle 缺一不叫/dedupe 活跃唯一/取消冻结)+ DND 补叫 + resolution-timeout 重升级 +
// 输出仲裁(优先级/不叠音/麦占用降级)+ 重建接通第一句=原因。

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { Tier1SettleProof } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { CallbackEngine, isSettleComplete } from "../src/callback/engine.js";
import { arbitrate, reconnectFirstLine, type PendingCallback } from "../src/callback/arbitration.js";
import { getOutboxEntry } from "../src/storage/dao/outbox.js";
import type { AuditSink } from "../src/obs/audit.js";

const nullAudit: AuditSink = { record: () => ({ id: "aud_x" }) };
const TASK = "tsk_01AAAAAAAAAAAAAAAAAAAAAAAA";

const proof = (over?: Partial<Tier1SettleProof>): Tier1SettleProof => ({
  kind: "tier1",
  taskId: TASK,
  runId: "run-1",
  attempt: 1,
  packageRevision: 1,
  treeSha: "abc123",
  tier1VerifyDigest: "sha256:" + "1".repeat(64),
  acceptanceChecks: [],
  transcriptCursor: "c-100",
  settledAt: "2026-07-25T00:00:00.000Z",
  ...over
});

let db: Db;
let engine: CallbackEngine;
const NOW = () => new Date("2026-07-25T10:00:00.000Z");

beforeEach(() => {
  db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-cb-")), "saydo.db"));
  engine = new CallbackEngine({ db, audit: nullAudit, now: NOW });
});

describe("settle 缺一不叫(§12-5)", () => {
  it("ready_for_review:proof 齐备才入队;缺字段不叫", () => {
    expect(isSettleComplete(proof())).toBe(true);
    expect(isSettleComplete(proof({ treeSha: "" }))).toBe(false);
    expect(isSettleComplete(undefined)).toBe(false);

    const bad = engine.enqueue({
      taskId: TASK,
      trigger: "ready_for_review",
      packageRevision: 1,
      occurrenceKey: "1",
      settleProof: proof({ tier1VerifyDigest: "" }),
      projectionCursor: "c-100",
      artifactChecks: ["ac1"]
    });
    expect(bad.enqueued).toBe(false);
    expect(bad.reason).toContain("四项缺一");

    const ok = engine.enqueue({
      taskId: TASK,
      trigger: "ready_for_review",
      packageRevision: 1,
      occurrenceKey: "1",
      settleProof: proof(),
      projectionCursor: "c-100",
      artifactChecks: ["ac1"]
    });
    expect(ok.enqueued).toBe(true);
  });

  it("blocked/failed 须带最小 proof(09 §9 缺一不叫,Codex 16 6.2);approval_request 不需", () => {
    // 反例:blocked 缺最小 proof => 拒
    const bare = engine.enqueue({ taskId: TASK, trigger: "blocked", packageRevision: 1, occurrenceKey: "evt-0", projectionCursor: "c", artifactChecks: [] });
    expect(bare.enqueued).toBe(false);
    expect(bare.reason).toContain("最小 proof");
    // 正例:带 questionId + transcriptCursor => 入队,且结构化持久化
    const r = engine.enqueue({ taskId: TASK, trigger: "blocked", packageRevision: 1, occurrenceKey: "evt-1", minimalProof: { questionId: "q-1", transcriptCursor: "cur-1" }, projectionCursor: "c", artifactChecks: [] });
    expect(r.enqueued).toBe(true);
    expect((getOutboxEntry(db, r.entryId)?.settleProof as { minimalProof?: unknown }).minimalProof).toEqual({ questionId: "q-1", transcriptCursor: "cur-1" });
    // approval_request 不需最小 proof
    const a = engine.enqueue({ taskId: TASK, trigger: "approval_request", packageRevision: 1, occurrenceKey: "apr-1", projectionCursor: "c", artifactChecks: [] });
    expect(a.enqueued).toBe(true);
  });
});

describe("dedupe 活跃唯一 + 取消冻结 + 升级", () => {
  it("同 dedupeKey 活跃唯一(重启只叫一次);不同 occurrenceKey 可再入队", () => {
    const a = engine.enqueue({ taskId: TASK, trigger: "blocked", packageRevision: 1, occurrenceKey: "evt-1", minimalProof: { questionId: "q-evt-1", transcriptCursor: "cur-x" }, projectionCursor: "c", artifactChecks: [] });
    expect(a.enqueued).toBe(true);
    const dup = engine.enqueue({ taskId: TASK, trigger: "blocked", packageRevision: 1, occurrenceKey: "evt-1", minimalProof: { questionId: "q-evt-1", transcriptCursor: "cur-x" }, projectionCursor: "c", artifactChecks: [] });
    expect(dup.enqueued).toBe(false); // 活跃唯一冲突
    const diff = engine.enqueue({ taskId: TASK, trigger: "blocked", packageRevision: 1, occurrenceKey: "evt-2", minimalProof: { questionId: "q-evt-2", transcriptCursor: "cur-x" }, projectionCursor: "c", artifactChecks: [] });
    expect(diff.enqueued).toBe(true); // 不同 occurrenceKey
  });

  it("outbox 非 dedupe 写失败必须上抛,不能伪装成幂等命中", () => {
    db.exec(`CREATE TRIGGER callback_outbox_injected_failure
      BEFORE INSERT ON callback_outbox BEGIN
        SELECT RAISE(ABORT, 'injected non-dedupe write failure');
      END`);
    try {
      expect(() =>
        engine.enqueue({
          taskId: TASK,
          trigger: "blocked",
          packageRevision: 1,
          occurrenceKey: "evt-write-failure",
          minimalProof: { questionId: "q-write-failure", transcriptCursor: "cur-x" },
          projectionCursor: "c",
          artifactChecks: []
        })
      ).toThrow("injected non-dedupe write failure");
    } finally {
      db.exec("DROP TRIGGER callback_outbox_injected_failure");
    }
  });

  it("取消冻结:task 活跃条目 superseded", () => {
    engine.enqueue({ taskId: TASK, trigger: "blocked", packageRevision: 1, occurrenceKey: "evt-1", minimalProof: { questionId: "q-evt-1", transcriptCursor: "cur-x" }, projectionCursor: "c", artifactChecks: [] });
    const frozen = engine.freezeForTask(TASK);
    expect(frozen).toBe(1);
  });

  it("DND snooze 保持 pending;离线不 snooze;resolution-timeout 只到 requeued", () => {
    const { entryId } = engine.enqueue({ taskId: TASK, trigger: "blocked", packageRevision: 1, occurrenceKey: "e", minimalProof: { questionId: "q-e", transcriptCursor: "cur-x" }, projectionCursor: "c", artifactChecks: [] });
    // DND 选路在 sweep;engine 只写 snooze 状态
    engine.snooze(entryId, "2026-07-26T08:00:00.000Z");
    expect(getOutboxEntry(db, entryId)?.state).toBe("pending");
    expect(getOutboxEntry(db, entryId)?.snoozedUntil).toBe("2026-07-26T08:00:00.000Z");
    const offline = engine.attemptNotify(entryId, { nowHm: "10:00", channelReachable: false });
    expect(offline.delivered).toBe(false);
    expect(offline.snoozed).toBe(false);
    const ok = engine.attemptNotify(entryId, { nowHm: "10:00", channelReachable: true });
    expect(ok.delivered).toBe(true);
    engine.ack(entryId);
    const esc = engine.escalateIfStale(entryId, "2026-07-25T09:29:00.000Z"); // now=10:00,距 31min
    expect(esc.escalated).toBe(true);
    expect(esc.toLevel).toBe(1);
    expect(getOutboxEntry(db, entryId)?.state).toBe("requeued");
    expect(getOutboxEntry(db, entryId)?.escalationLevel).toBe(0);
    const fresh = engine.enqueue({ taskId: TASK, trigger: "failed", packageRevision: 1, occurrenceKey: "e2", minimalProof: { questionId: "q-e2", transcriptCursor: "cur-x" }, projectionCursor: "c", artifactChecks: [] });
    engine.attemptNotify(fresh.entryId, { nowHm: "10:00", channelReachable: true });
    engine.ack(fresh.entryId);
    expect(engine.escalateIfStale(fresh.entryId, "2026-07-25T09:50:00.000Z").escalated).toBe(false); // 10min < 30
  });
});

describe("输出仲裁(02 §5:优先级/不叠音/麦占用降级)", () => {
  const pend: PendingCallback[] = [
    { entryId: "done", trigger: "ready_for_review", createdAt: "2026-07-25T09:00:00Z" },
    { entryId: "blk", trigger: "blocked", createdAt: "2026-07-25T09:05:00Z" },
    { entryId: "fail", trigger: "failed", createdAt: "2026-07-25T09:03:00Z" }
  ];

  it("优先级:卡住等人 > 失败 > 待审批 > 完成", () => {
    const r = arbitrate(pend, { voiceBusy: false, micHeldByMeeting: false });
    expect(r.action).toBe("speak");
    if (r.action === "speak") expect(r.entryId).toBe("blk"); // blocked 最高
  });

  it("语音忙 ⇒ 排队不插播;麦占用 ⇒ 最高优先级降级通知", () => {
    expect(arbitrate(pend, { voiceBusy: true, micHeldByMeeting: false }).action).toBe("queue");
    const dg = arbitrate(pend, { voiceBusy: false, micHeldByMeeting: true });
    expect(dg.action).toBe("downgrade_notify");
    if (dg.action === "downgrade_notify") expect(dg.entryId).toBe("blk");
  });

  it("重建接通第一句 = 原因(不同 trigger)", () => {
    expect(reconnectFirstLine("blocked", "导出功能")).toContain("卡住");
    expect(reconnectFirstLine("ready_for_review", "导出功能")).toContain("验收");
    expect(reconnectFirstLine("failed", "导出功能")).toContain("失败");
  });
});
