// 确认环批 1 合同测试:DB-authoritative + digest + 三通道 + 懒过期 + 重启恢复 + stale。

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { newId } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import {
  ConfirmationLoop,
  computeConfirmDigest,
  CONFIRM_DIGEST_VERSION,
  type PendingPayload
} from "../src/live/confirm.js";

function seedSession(db: Db): string {
  const home = mkdtempSync(join(tmpdir(), "saydo-conf-"));
  const now = new Date().toISOString();
  const projectId = newId("prj");
  const sessionId = newId("ses");
  db.prepare(
    `INSERT INTO projects(id,title,type,status,workspace_json,exec_mode_default,created_at,updated_at)
     VALUES (?,?, 'coding','active',?,'step_confirm',?,?)`
  ).run(projectId, "p", JSON.stringify({ kind: "local_folder", path: home, managed: true }), now, now);
  db.prepare(
    `INSERT INTO sessions(id,project_id,state,engine,transcript_path,started_at)
     VALUES (?,?, 'talking','live',?,?)`
  ).run(sessionId, projectId, join(home, "t.jsonl"), now);
  return sessionId;
}

function seedFocus(db: Db, title = "F"): string {
  const now = new Date().toISOString();
  const id = newId("foc");
  db.prepare(
    `INSERT INTO focuses(id,title,lifecycle,semantic_authority,authority_epoch,current_revision,created_at,updated_at)
     VALUES (?,?, 'active','saydo',0,0,?,?)`
  ).run(id, title, now, now);
  return id;
}

function focusPayload(focusId: string): PendingPayload {
  return {
    kind: "focus_obligation",
    focusId,
    obligation: {
      kind: "action",
      title: "写测",
      owner: "human",
      dedupeKey: `${focusId}:action:t1`,
      verification: "confirmed"
    }
  };
}

describe("ConfirmationLoop v20 合同", () => {
  let db: Db;
  let sessionId: string;
  let focusId: string;
  let audits: Array<{ action: string; meta?: Record<string, unknown> }>;

  beforeEach(() => {
    const home = mkdtempSync(join(tmpdir(), "saydo-conf-db-"));
    db = openDb(join(home, "saydo.db"));
    sessionId = seedSession(db);
    focusId = seedFocus(db);
    audits = [];
  });

  it("present 落库失败不呈现(mock db 抛)", () => {
    const presented: string[] = [];
    const boomDb = {
      prepare: () => {
        throw new Error("insert fail");
      },
      transaction: (fn: () => unknown) => fn
    };
    const loop = new ConfirmationLoop(
      { onPresent: (_s, p) => presented.push(p.receiptId) },
      boomDb as never
    );
    const ok = loop.tryPresent(sessionId, {
      receiptId: newId("apr"),
      sentenceId: "s1",
      promptText: "记下?",
      payload: focusPayload(focusId)
    });
    expect(ok).toBe(false);
    expect(presented).toHaveLength(0);
    expect(loop.pending(sessionId)).toBeUndefined();
  });

  it("单次消费三通道竞争:仅一胜(click accept 预占后 voice/auto 不抢)", () => {
    const loop = new ConfirmationLoop(
      {},
      db,
      { record: (e) => { audits.push(e); return { id: "a" }; } }
    );
    const receiptId = newId("apr");
    loop.present(sessionId, {
      receiptId,
      sentenceId: "s1",
      promptText: "记下?",
      payload: focusPayload(focusId)
    });
    const row = db.prepare("SELECT receipt_id FROM pending_confirmations WHERE session_id=?").get(sessionId) as
      | { receipt_id: string }
      | undefined;
    expect(row?.receipt_id).toBe(receiptId);

    const dig = loop.pending(sessionId)!.digest;
    const o1 = loop.consumeClick(sessionId, receiptId, dig, "accept");
    expect(o1.kind).toBe("accepted");
    // 预占后第二通道:词表 accept 返回同 receipt 的 accepted(幂等)或 not_pending
    const o2 = loop.consumeReply(sessionId, "可以", "s-r");
    // holding 同 receipt → 幂等 accepted;随后 commitConsume 一次
    expect(o2.kind === "accepted" || o2.kind === "not_pending").toBe(true);
    loop.commitConsume(sessionId, receiptId);
    expect(() => loop.commitConsume(sessionId, receiptId)).toThrow(/CAS failed/);
    loop.finalizeAccepted(sessionId, receiptId, "click");
    expect(loop.pending(sessionId)).toBeUndefined();
    const left = db.prepare("SELECT COUNT(*) AS c FROM pending_confirmations").get() as { c: number };
    expect(left.c).toBe(0);
  });

  it("懒过期:expires_at 已过则 expired 终局返回 not_pending", () => {
    const loop = new ConfirmationLoop({}, db, {
      record: (e) => {
        audits.push(e);
        return { id: "a" };
      }
    });
    const receiptId = newId("apr");
    const past = new Date(Date.now() - 60_000).toISOString();
    loop.present(sessionId, {
      receiptId,
      sentenceId: "s1",
      promptText: "?",
      payload: focusPayload(focusId),
      presentedAt: past,
      expiresAt: past
    });
    const o = loop.consumeReply(sessionId, "好", "s-r");
    expect(o.kind).toBe("not_pending");
    expect(loop.pending(sessionId)).toBeUndefined();
    expect(audits.some((a) => a.action === "confirm.expired" || a.action === "confirm.consumed")).toBe(true);
  });

  it("重启恢复重发卡:未过期行 rebuild + onPresent", () => {
    const loop1 = new ConfirmationLoop({}, db);
    const receiptId = newId("apr");
    loop1.present(sessionId, {
      receiptId,
      sentenceId: "s-old",
      promptText: "恢复我",
      payload: focusPayload(focusId)
    });
    // 模拟进程重启:新 loop + restore
    const cards: string[] = [];
    const loop2 = new ConfirmationLoop(
      { onPresent: (_s, p) => cards.push(p.receiptId) },
      db,
      { record: (e) => { audits.push(e); return { id: "a" }; } }
    );
    const r = loop2.restoreFromDb();
    expect(r.restored).toBe(1);
    expect(r.expired).toBe(0);
    expect(cards).toEqual([receiptId]);
    expect(loop2.pending(sessionId)?.receiptId).toBe(receiptId);
    expect(loop2.pending(sessionId)?.promptText).toBe("恢复我");
    expect(audits.some((a) => a.action === "confirm.restored")).toBe(true);
  });

  it("digest 基线漂移 stale:义务集合变化后 accept 作废", () => {
    const loop = new ConfirmationLoop({}, db, {
      record: (e) => {
        audits.push(e);
        return { id: "a" };
      }
    });
    const receiptId = newId("apr");
    loop.present(sessionId, {
      receiptId,
      sentenceId: "s1",
      promptText: "记下?",
      payload: focusPayload(focusId)
    });
    // 漂移:直接插一条未结义务,改变 obligationsDigest
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO focus_obligations(
        id, focus_id, kind, title, owner, status, verification, blocking, dedupe_key, created_at, updated_at
      ) VALUES (?,?, 'action','x','agent','open','confirmed',0,?, ?,?)`
    ).run(newId("fob"), focusId, `${focusId}:action:drift`, now, now);

    const dig = loop.pending(sessionId)!.digest;
    const o = loop.consumeClick(sessionId, receiptId, dig, "accept");
    expect(o.kind).toBe("stale");
    expect(loop.pending(sessionId)).toBeUndefined();
    expect(audits.some((a) => a.action === "confirm.consumed" && a.meta?.["outcome"] === "stale")).toBe(true);
  });

  it("computeConfirmDigest 稳定:同输入同输出", () => {
    const p = focusPayload(focusId);
    const a = computeConfirmDigest("focus_obligation", p, "txt", "base");
    const b = computeConfirmDigest("focus_obligation", p, "txt", "base");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(CONFIRM_DIGEST_VERSION).toBe(1);
  });
});
