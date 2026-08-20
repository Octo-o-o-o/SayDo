// 接线批任务①(HANDOFF §2-9-①):LiveVoiceSessions——开口即建 draft、转写落盘 sessions/<id>.jsonl、
// unheard 过滤(被打断句及其后未播句不入 Brain 对话史;转写 heard=false 如实标注)、空闲挂起/重建。

import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openDb, type Db } from "../src/storage/db.js";
import { SessionManager } from "../src/session/manager.js";
import { LiveVoiceSessions } from "../src/live/voiceSessions.js";
import type { AuditSink } from "../src/obs/audit.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";

const nullAudit: AuditSink = { record: () => ({ id: "aud_x" }) };
const SES = "ses_01W1RE0000000000000000000A";

let home: string;
let db: Db;
let live: LiveVoiceSessions;
let suspended: string[];

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "saydo-live-"));
  db = openDb(join(home, "saydo.db"));
  suspended = [];
  const mgr = new SessionManager({ db, audit: nullAudit, storeTranscript: true });
  live = new LiveVoiceSessions({
    db,
    audit: nullAudit,
    sessions: mgr,
    saydoHome: home,
    idleSuspendSec: 0, // 定时器禁用,挂起用显式 suspend() 驱动(测试确定性)
    onSuspend: (id) => suspended.push(id)
  });
});

describe("开口即建 + 转写落盘(09 §1;HANDOFF §2-9-①)", () => {
  it("未知 sessionId 首轮:建 draft 项目 + session(talking)+ 转写落 ~/.saydo/sessions/<id>.jsonl", () => {
    const r = live.ensureSession(SES);
    expect(r.created).toBe(true);
    expect(r.session.state).toBe("talking");
    live.onUserTurn(SES, "ses_01W1RE0000000000000000000B", "我想给博客加个 RSS 输出");
    expect(existsSync(join(home, "sessions", `${SES}.jsonl`))).toBe(true);
    // draft 项目已建(type=pending, status=draft)
    const prj = db.prepare("SELECT type, status FROM projects").get() as { type: string; status: string };
    expect(prj).toEqual({ type: "pending", status: "draft" });
    // 二次 ensure 幂等(不重复建)
    const r2 = live.ensureSession(SES);
    expect(r2.created).toBe(false);
    expect((db.prepare("SELECT COUNT(*) AS c FROM sessions").get() as { c: number }).c).toBe(1);
  });

  it("first-run 开场白在转写、当前 history 与挂起重建后都保留 onboarding origin", () => {
    live.ensureSession(SES);
    live.onAiSentences(SES, [{ sentenceId: "onboarding-1", text: "固定开场白" }], {
      origin: "onboarding",
      touchIdle: false
    });
    live.settlePendingAi(SES);

    expect(live.historyOf(SES)).toEqual([{ speaker: "ai", text: "固定开场白", origin: "onboarding" }]);
    const transcriptPath = join(home, "sessions", `${SES}.jsonl`);
    expect(JSON.parse(readFileSync(transcriptPath, "utf8").trim())).toMatchObject({
      speaker: "ai",
      text: "固定开场白",
      origin: "onboarding"
    });
    const turns = new SessionManager({ db, audit: nullAudit }).readTurns(SES);
    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({ speaker: "ai", text: "固定开场白", origin: "onboarding" });

    live.suspend(SES, "explicit");
    expect(live.ensureSession(SES).rebuilt).toBe(true);
    expect(live.historyOf(SES)).toEqual([{ speaker: "ai", text: "固定开场白", origin: "onboarding" }]);

    // 保持 DB state=talking，彻底重开 SQLite/manager/live，模拟 daemon 崩溃/进程重启；
    // 新进程不能依赖 graceful suspend 才恢复 durable history。
    db.close();
    db = openDb(join(home, "saydo.db"));
    const afterRestart = new LiveVoiceSessions({
      db,
      audit: nullAudit,
      sessions: new SessionManager({ db, audit: nullAudit, storeTranscript: true }),
      saydoHome: home,
      idleSuspendSec: 0
    });
    expect(afterRestart.ensureSession(SES).rebuilt).toBe(true);
    expect(afterRestart.historyOf(SES)).toEqual([
      { speaker: "ai", text: "固定开场白", origin: "onboarding" }
    ]);
  });
});

describe("unheard 过滤(09 §10;被打断句不入 Brain 对话史)", () => {
  it("barge-in:截断句及其后句 heard=false 落盘;对话史只含已听句", () => {
    live.ensureSession(SES);
    live.onUserTurn(SES, "ses_01W1RE0000000000000000000C", "讲讲计划");
    live.onAiSentences(SES, [
      { sentenceId: "s-t1-0", text: "第一步是读配置。" },
      { sentenceId: "s-t1-1", text: "第二步是改代码。" },
      { sentenceId: "s-t1-2", text: "第三步是跑测试。" }
    ]);
    // 播到第二句被打断:s-t1-1 截断,s-t1-2 排队未播
    live.onBargeIn(SES, "s-t1-1");
    // 下一用户轮触发结算
    live.onUserTurn(SES, "ses_01W1RE0000000000000000000D", "等等,不对");

    const mgr = new SessionManager({ db, audit: nullAudit });
    const turns = mgr.readTurns(SES);
    expect(turns).toHaveLength(3); // user / ai / user
    const ai = turns[1]!;
    expect(ai.speaker).toBe("ai");
    expect(ai.sentences.map((s) => s.heard)).toEqual([true, false, false]);

    // Brain 对话史:AI 轮只含已听句(unheard 不进对话事实)
    const history = live.historyOf(SES);
    const aiTurn = history.find((h) => h.speaker === "ai");
    expect(aiTurn?.text).toBe("第一步是读配置。");
    expect(aiTurn?.text).not.toContain("第二步");
  });

  it("无打断:全部句 heard=true 且全部进对话史", () => {
    live.ensureSession(SES);
    live.onUserTurn(SES, "ses_01W1RE0000000000000000000E", "说吧");
    live.onAiSentences(SES, [
      { sentenceId: "s-t2-0", text: "好。" },
      { sentenceId: "s-t2-1", text: "开始了。" }
    ]);
    live.onUserTurn(SES, "ses_01W1RE0000000000000000000F", "继续");
    const history = live.historyOf(SES);
    expect(history.find((h) => h.speaker === "ai")?.text).toBe("好。开始了。");
  });

  it("晚到 barge-in(句不在 pending)忽略,不炸", () => {
    live.ensureSession(SES);
    live.onBargeIn(SES, "s-ghost-0");
    expect(live.historyOf(SES)).toEqual([]);
  });
});

describe("通用项目归属问题 durable 状态", () => {
  it("先落 durable audit 再允许 enqueue，进程重建后仍判定已经问过", () => {
    const audit = createSqliteAuditSink(db);
    const first = new LiveVoiceSessions({
      db,
      audit,
      sessions: new SessionManager({ db, audit }),
      saydoHome: home,
      idleSuspendSec: 0
    });
    first.ensureSession(SES);
    expect(first.reserveProjectAnchorQuestion(SES)).toBe(true);
    first.settleProjectAnchorQuestion(SES, true);

    const rebuilt = new LiveVoiceSessions({
      db,
      audit,
      sessions: new SessionManager({ db, audit }),
      saydoHome: home,
      idleSuspendSec: 0
    });
    expect(rebuilt.hasAskedProjectAnchorQuestion(SES)).toBe(true);
  });

  it("audit 失败时不把内存状态误标为已问", () => {
    live.ensureSession(SES);
    const failingAudit: AuditSink = {
      record() {
        throw new Error("audit unavailable");
      }
    };
    const isolated = new LiveVoiceSessions({
      db,
      audit: failingAudit,
      sessions: new SessionManager({ db, audit: nullAudit }),
      saydoHome: home,
      idleSuspendSec: 0
    });
    expect(() => isolated.reserveProjectAnchorQuestion(SES)).toThrow("audit unavailable");
    expect(isolated.hasAskedProjectAnchorQuestion(SES)).toBe(false);
  });

  it("重启遇到孤立 reserved 时保守阻断重复问，明确 enqueue_failed 才开放重试", () => {
    const audit = createSqliteAuditSink(db);
    const first = new LiveVoiceSessions({
      db,
      audit,
      sessions: new SessionManager({ db, audit }),
      saydoHome: home,
      idleSuspendSec: 0
    });
    first.ensureSession(SES);
    expect(first.reserveProjectAnchorQuestion(SES)).toBe(true);

    const afterCrash = new LiveVoiceSessions({
      db,
      audit,
      sessions: new SessionManager({ db, audit }),
      saydoHome: home,
      idleSuspendSec: 0
    });
    expect(afterCrash.hasAskedProjectAnchorQuestion(SES)).toBe(true);

    first.settleProjectAnchorQuestion(SES, false);
    const afterKnownFailure = new LiveVoiceSessions({
      db,
      audit,
      sessions: new SessionManager({ db, audit }),
      saydoHome: home,
      idleSuspendSec: 0
    });
    expect(afterKnownFailure.hasAskedProjectAnchorQuestion(SES)).toBe(false);
  });
});

describe("空闲挂起 + 重建(session_idle_suspend_sec;10 §3-4)", () => {
  it("prepareShutdown 清理 idle timer，并把 pending/迟到 AI 句保守持久化为 unheard", () => {
    vi.useFakeTimers();
    try {
      const managed = new LiveVoiceSessions({
        db,
        audit: nullAudit,
        sessions: new SessionManager({ db, audit: nullAudit }),
        saydoHome: home,
        idleSuspendSec: 1,
        onSuspend: (id) => suspended.push(id)
      });
      managed.ensureSession(SES);
      managed.onUserTurn(SES, "ses_01W1RE0000000000000000000K", "先别收场");
      managed.onAiSentences(SES, [{ sentenceId: "s-pending", text: "可能已经播出" }]);
      expect(managed.hasIdleTimer(SES)).toBe(true);
      managed.prepareShutdown();
      expect(managed.hasIdleTimer(SES)).toBe(false);
      managed.onAiSentences(SES, [{ sentenceId: "s-shutdown", text: "正在退出" }]);
      expect(managed.hasIdleTimer(SES)).toBe(false);
      vi.advanceTimersByTime(2_000);
      expect(suspended).toEqual([]);
      const turns = new SessionManager({ db, audit: nullAudit }).readTurns(SES);
      expect(turns.filter((turn) => turn.speaker === "ai").map((turn) => turn.sentences)).toEqual([
        [{ sentenceId: "s-pending", text: "可能已经播出", heard: false }],
        [{ sentenceId: "s-shutdown", text: "正在退出", heard: false }]
      ]);

      const afterRestart = new LiveVoiceSessions({
        db,
        audit: nullAudit,
        sessions: new SessionManager({ db, audit: nullAudit, storeTranscript: true }),
        saydoHome: home,
        idleSuspendSec: 0
      });
      expect(afterRestart.ensureSession(SES).rebuilt).toBe(true);
      expect(afterRestart.historyOf(SES)).toEqual([{ speaker: "user", text: "先别收场" }]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("挂起结算 pending AI 轮 + onSuspend 回调;重建 history 从转写读回且 unheard 句不回填", () => {
    live.ensureSession(SES);
    live.onUserTurn(SES, "ses_01W1RE0000000000000000000G", "先这样");
    live.onAiSentences(SES, [
      { sentenceId: "s-t3-0", text: "好,我挂起了。" },
      { sentenceId: "s-t3-1", text: "有事叫我。" }
    ]);
    live.onBargeIn(SES, "s-t3-1"); // 第二句被打断
    live.suspend(SES);
    expect(suspended).toEqual([SES]);
    const s = db.prepare("SELECT state FROM sessions WHERE id=?").get(SES) as { state: string };
    expect(s.state).toBe("suspended");

    // 重建:history 读回,heard=false 的"有事叫我"不回填
    const r = live.ensureSession(SES);
    expect(r.rebuilt).toBe(true);
    expect(r.session.state).toBe("talking");
    const history = live.historyOf(SES);
    expect(history.map((h) => h.text)).toEqual(["先这样", "好,我挂起了。"]);
  });

  it("重复 suspend 幂等(非 talking 态不动)", () => {
    live.ensureSession(SES);
    live.suspend(SES);
    live.suspend(SES);
    expect(suspended).toEqual([SES]);
  });
});

describe("G6 分别同意(store_transcript=false;gate0-checklist G6 行验收锚)", () => {
  it("store_transcript=false:轮内照常但转写不落盘;重建 history 如实降级为空", () => {
    const mgr = new SessionManager({ db, audit: nullAudit, storeTranscript: false });
    const noStore = new LiveVoiceSessions({
      db,
      audit: nullAudit,
      sessions: mgr,
      saydoHome: home,
      idleSuspendSec: 0
    });
    const sid = "ses_01W1RE0000000000000000000H";
    noStore.ensureSession(sid);
    const turnId = "ses_01W1RE0000000000000000000J";
    noStore.onUserTurn(sid, turnId, "不要留记录");
    expect(noStore.findUserTurn(sid, turnId)).toEqual({ text: "不要留记录" });
    noStore.onAiSentences(sid, [{ sentenceId: "s-t4-0", text: "好。" }]);
    expect(existsSync(join(home, "sessions", `${sid}.jsonl`))).toBe(false);
    // 会话内 history 照常(轮内流程不降级)
    expect(noStore.historyOf(sid).length).toBe(1);
    noStore.suspend(sid);
    const r = noStore.ensureSession(sid);
    expect(r.rebuilt).toBe(true);
    expect(noStore.historyOf(sid)).toEqual([]); // 用户主动弃权 => 重建降级(G6 同意权优先)
  });
});
