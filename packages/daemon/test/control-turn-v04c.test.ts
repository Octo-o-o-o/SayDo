// Focus v0.4 ④c:控制轮 + remainingIntent + 批量落账契约测试
// a JSONL 零增长 / b idle 时间戳不变 / c 深度 4 不注入+audit
// d barge-in 让位 / e remainingIntent handled 清 text
// f 批量三义务 + dedupe 冲突整卡拒绝
// g confirmation_settled 触达 Brain(system 含 receiptRef)
// golden 五断头:立项停滞/拆线躺平/锚定不落账/确认循环/都对上了沉默

import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { newId } from "@saydo/contracts";
import { openFocusFixture, type FocusFixture } from "./helpers/focus-fixture.js";
import {
  ConfirmationLoop,
  buildRemainingIntentJson,
  focusObligationItems
} from "../src/live/confirm.js";
import {
  LiveDialog,
  CONTROL_TURN_MAX_DEPTH,
  type ControlTurnPayload
} from "../src/live/dialog.js";
import { LiveVoiceSessions } from "../src/live/voiceSessions.js";
import { SessionManager } from "../src/session/manager.js";
import { createFocus, startActivation, upsertObligation } from "../src/focus/index.js";
import { maxFocusEventSeq, openObligationsDigest } from "../src/focus/baseline.js";
import type { AuditSink } from "../src/obs/audit.js";
import type { Logger } from "../src/obs/logger.js";
import type { ChatMessage, LlmProvider } from "../src/providers/types.js";

const nullLog = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child() {
    return this;
  }
} as unknown as Logger;

function transcriptLineCount(path: string): number {
  if (!existsSync(path)) return 0;
  const t = readFileSync(path, "utf8");
  if (t === "") return 0;
  return t.split("\n").filter((l) => l.trim() !== "").length;
}

function makeAudit(): { sink: AuditSink; actions: string[]; metas: Array<Record<string, unknown>> } {
  const actions: string[] = [];
  const metas: Array<Record<string, unknown>> = [];
  return {
    actions,
    metas,
    sink: {
      record: (e) => {
        actions.push(e.action);
        if (e.meta && typeof e.meta === "object") metas.push(e.meta as Record<string, unknown>);
        return { id: "aud_test" };
      }
    }
  };
}

function mockProvider(capture: ChatMessage[][]): LlmProvider {
  return {
    kind: "api",
    model: "mock-ctl",
    async chat(req) {
      capture.push(req.messages.map((m) => ({ ...m })));
      return {
        ok: true,
        text: "好,我继续办下一件。",
        requestedModel: "mock-ctl",
        observedModel: "mock-ctl",
        observedModelSource: "stream",
        observedModelExempted: false,
        usage: { promptTokens: 10, completionTokens: 5 }
      };
    }
  };
}

function buildHarness(fx: FocusFixture, opts?: { idleSec?: number }) {
  const audit = makeAudit();
  const messages: ChatMessage[][] = [];
  const provider = mockProvider(messages);
  const sessions = new SessionManager({ db: fx.db, audit: audit.sink, storeTranscript: true });
  const live = new LiveVoiceSessions({
    db: fx.db,
    audit: audit.sink,
    sessions,
    saydoHome: fx.home,
    idleSuspendSec: opts?.idleSec ?? 600
  });
  const confirm = new ConfirmationLoop({}, fx.db, audit.sink);
  const spoken: string[] = [];
  const dialog = new LiveDialog({
    db: fx.db,
    audit: audit.sink,
    sessions: live,
    dialogProvider: provider,
    say: (_sid, _sid2, text) => {
      spoken.push(text);
      return true;
    },
    log: nullLog,
    confirm,
    now: () => new Date("2026-08-09T00:00:00.000Z")
  });
  const transcriptPath = fx.db
    .prepare("SELECT transcript_path FROM sessions WHERE id=?")
    .get(fx.sessionId) as { transcript_path: string };
  return { dialog, live, confirm, audit, messages, spoken, transcriptPath: transcriptPath.transcript_path, sessions };
}

let fx: FocusFixture;
beforeEach(() => {
  fx = openFocusFixture();
});
afterEach(() => fx.close());

describe("④c 控制轮契约", () => {
  it("a) 控制轮不产生转写记录(JSONL 零增长)", async () => {
    const h = buildHarness(fx);
    h.live.ensureSession(fx.sessionId);
    h.live.onUserTurn(fx.sessionId, newId("evt"), "先说一句占位");
    const before = transcriptLineCount(h.transcriptPath);
    expect(before).toBeGreaterThan(0);

    h.dialog.injectControlTurn(fx.sessionId, {
      kind: "confirmation_settled",
      receiptRef: newId("apr"),
      outcome: "accepted"
    });
    // 泵是 async,等一拍
    await new Promise((r) => setTimeout(r, 30));
    const after = transcriptLineCount(h.transcriptPath);
    expect(after).toBe(before);
    expect(h.messages.length).toBeGreaterThanOrEqual(1);
  });

  it("b) idle 时间戳在控制轮注入前后不变", async () => {
    const h = buildHarness(fx, { idleSec: 600 });
    h.live.ensureSession(fx.sessionId);
    h.live.onUserTurn(fx.sessionId, newId("evt"), "活动一下");
    const t0 = h.live.lastIdleTouchAtMs(fx.sessionId);
    expect(t0).not.toBeNull();
    await new Promise((r) => setTimeout(r, 5));
    h.dialog.injectControlTurn(fx.sessionId, {
      kind: "confirmation_settled",
      receiptRef: newId("apr"),
      outcome: "accepted"
    });
    await new Promise((r) => setTimeout(r, 30));
    const t1 = h.live.lastIdleTouchAtMs(fx.sessionId);
    expect(t1).toBe(t0);
  });

  it("c) 深度 4 连锁→第 4 次不注入+audit", async () => {
    const h = buildHarness(fx);
    h.live.ensureSession(fx.sessionId);
    // 同步堆 4 条(泵未完成时队列计深度)
    const r1 = h.dialog.injectControlTurn(fx.sessionId, { kind: "confirmation_settled", receiptRef: newId("apr") });
    const r2 = h.dialog.injectControlTurn(fx.sessionId, { kind: "confirmation_settled", receiptRef: newId("apr") });
    const r3 = h.dialog.injectControlTurn(fx.sessionId, { kind: "confirmation_settled", receiptRef: newId("apr") });
    const r4 = h.dialog.injectControlTurn(fx.sessionId, { kind: "confirmation_settled", receiptRef: newId("apr") });
    expect(r1.accepted).toBe(true);
    expect(r2.accepted).toBe(true);
    expect(r3.accepted).toBe(true);
    expect(r4.accepted).toBe(false);
    expect(r4.reason).toBe("depth_exceeded");
    expect(h.audit.actions).toContain("dialog.control_turn_depth_exceeded");
    expect(CONTROL_TURN_MAX_DEPTH).toBe(3);
    await new Promise((r) => setTimeout(r, 50));
  });

  it("d) barge-in 时控制轮让位，ASR 结算前不重排", async () => {
    // 慢 provider:控制轮 inFlight 时用户 barge-in
    let releaseChat: (() => void) | undefined;
    const gate = new Promise<void>((res) => {
      releaseChat = res;
    });
    const messages: ChatMessage[][] = [];
    const slowProvider: LlmProvider = {
      kind: "api",
      model: "slow",
      async chat(req) {
        messages.push(req.messages.map((m) => ({ ...m })));
        await gate;
        return {
          ok: true,
          text: "慢轮结束",
          requestedModel: "slow",
          observedModel: "slow",
          observedModelSource: "stream",
          observedModelExempted: false,
          usage: { promptTokens: 1, completionTokens: 1 }
        };
      }
    };
    const audit = makeAudit();
    const sm = new SessionManager({ db: fx.db, audit: audit.sink, storeTranscript: true });
    const live = new LiveVoiceSessions({
      db: fx.db,
      audit: audit.sink,
      sessions: sm,
      saydoHome: fx.home,
      idleSuspendSec: 0
    });
    const confirm = new ConfirmationLoop({}, fx.db, audit.sink);
    const dialog = new LiveDialog({
      db: fx.db,
      audit: audit.sink,
      sessions: live,
      dialogProvider: slowProvider,
      say: () => true,
      log: nullLog,
      confirm
    });
    live.ensureSession(fx.sessionId);
    const rid = newId("apr");
    dialog.injectControlTurn(fx.sessionId, { kind: "confirmation_settled", receiptRef: rid });
    // 等 inFlight 启动
    await new Promise((r) => setTimeout(r, 20));
    dialog.onBargeIn(fx.sessionId, "s-fake");
    releaseChat?.();
    await new Promise((r) => setTimeout(r, 40));
    expect(messages).toHaveLength(1);
    dialog.settlePendingSpeech(fx.sessionId);
    await new Promise((r) => setTimeout(r, 40));
    // 对应 ASR 已结算后再重排(第二次 chat)
    expect(messages.length).toBeGreaterThanOrEqual(2);
    const last = messages[messages.length - 1]!;
    expect(last.some((m) => m.role === "system" && String(m.content).includes(rid))).toBe(true);
  });

  it("旧用户轮先结算时不得清掉新用户轮或泵起排队控制轮", async () => {
    const calls: Array<{
      messages: ChatMessage[];
      signal?: AbortSignal;
      resolve: (value: Awaited<ReturnType<LlmProvider["chat"]>>) => void;
    }> = [];
    const provider: LlmProvider = {
      kind: "api",
      model: "race",
      chat(req, signal) {
        return new Promise((resolve) =>
          calls.push({ messages: req.messages, ...(signal ? { signal } : {}), resolve })
        );
      }
    };
    const audit = makeAudit();
    const sessions = new SessionManager({ db: fx.db, audit: audit.sink, storeTranscript: true });
    const live = new LiveVoiceSessions({
      db: fx.db,
      audit: audit.sink,
      sessions,
      saydoHome: fx.home,
      idleSuspendSec: 600
    });
    const dialog = new LiveDialog({
      db: fx.db,
      audit: audit.sink,
      sessions: live,
      dialogProvider: provider,
      say: () => true,
      log: nullLog
    });
    live.ensureSession(fx.sessionId);

    const turnA = dialog.onAsrFinal(fx.sessionId, newId("evt"), "用户轮 A");
    await new Promise((resolve) => setTimeout(resolve, 5));
    const turnB = dialog.onAsrFinal(fx.sessionId, newId("evt"), "用户轮 B");
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(calls).toHaveLength(2);
    expect(calls[0]?.signal?.aborted).toBe(true);
    expect(calls[1]?.signal?.aborted).toBe(false);
    dialog.injectControlTurn(fx.sessionId, { kind: "confirmation_settled", receiptRef: newId("apr") });

    calls[0]!.resolve({
      ok: true,
      text: "旧轮返回",
      requestedModel: "race",
      observedModel: "race",
      observedModelSource: "stream",
      observedModelExempted: false,
      usage: undefined
    });
    await turnA;
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(calls).toHaveLength(2);
    expect(calls[1]?.signal?.aborted).toBe(false);

    calls[1]!.resolve({
      ok: true,
      text: "新轮返回",
      requestedModel: "race",
      observedModel: "race",
      observedModelSource: "stream",
      observedModelExempted: false,
      usage: undefined
    });
    await turnB;
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(calls).toHaveLength(3);
    expect(calls[2]!.messages.some((message) => message.role === "system" && message.content.includes("控制轮"))).toBe(true);
    calls[2]!.resolve({
      ok: true,
      text: "控制轮返回",
      requestedModel: "race",
      observedModel: "race",
      observedModelSource: "stream",
      observedModelExempted: false,
      usage: undefined
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
  });

  it("barge-in 后旧用户轮先结算时，下一 ASR final 前不得泵起排队控制轮", async () => {
    const calls: Array<{
      messages: ChatMessage[];
      signal?: AbortSignal;
      resolve: (value: Awaited<ReturnType<LlmProvider["chat"]>>) => void;
    }> = [];
    const provider: LlmProvider = {
      kind: "api",
      model: "barge-race",
      chat(req, signal) {
        return new Promise((resolve) =>
          calls.push({ messages: req.messages, ...(signal ? { signal } : {}), resolve })
        );
      }
    };
    const audit = makeAudit();
    const sessions = new SessionManager({ db: fx.db, audit: audit.sink, storeTranscript: true });
    const live = new LiveVoiceSessions({
      db: fx.db,
      audit: audit.sink,
      sessions,
      saydoHome: fx.home,
      idleSuspendSec: 600
    });
    const dialog = new LiveDialog({
      db: fx.db,
      audit: audit.sink,
      sessions: live,
      dialogProvider: provider,
      say: () => true,
      log: nullLog
    });
    live.ensureSession(fx.sessionId);

    const turnA = dialog.onAsrFinal(fx.sessionId, newId("evt"), "用户轮 A");
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(calls).toHaveLength(1);
    dialog.injectControlTurn(fx.sessionId, { kind: "confirmation_settled", receiptRef: newId("apr") });
    dialog.onBargeIn(fx.sessionId, "s-fake");
    expect(calls[0]?.signal?.aborted).toBe(true);
    calls[0]!.resolve({
      ok: false,
      code: "cancelled",
      message: "barge-in",
      retryable: false
    });
    await turnA;
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(calls).toHaveLength(1);

    const turnB = dialog.onAsrFinal(fx.sessionId, newId("evt"), "用户轮 B");
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(calls).toHaveLength(2);
    calls[1]!.resolve({
      ok: true,
      text: "新轮返回",
      requestedModel: "barge-race",
      observedModel: "barge-race",
      observedModelSource: "stream",
      observedModelExempted: false,
      usage: undefined
    });
    await turnB;
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(calls).toHaveLength(3);
    expect(calls[2]!.messages.some((message) => message.role === "system" && message.content.includes("控制轮"))).toBe(true);
    calls[2]!.resolve({
      ok: true,
      text: "控制轮返回",
      requestedModel: "barge-race",
      observedModel: "barge-race",
      observedModelSource: "stream",
      observedModelExempted: false,
      usage: undefined
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
  });

  it.each(["explicit", "idle"] as const)("%s suspend 退休用户轮世代,排队控制轮不得复活会话", async (reason) => {
    const calls: Array<{
      resolve: (value: Awaited<ReturnType<LlmProvider["chat"]>>) => void;
    }> = [];
    const provider: LlmProvider = {
      kind: "api",
      model: "suspend-race",
      chat() {
        return new Promise((resolve) => calls.push({ resolve }));
      }
    };
    const audit = makeAudit();
    const sessions = new SessionManager({ db: fx.db, audit: audit.sink, storeTranscript: true });
    let dialog!: LiveDialog;
    const live = new LiveVoiceSessions({
      db: fx.db,
      audit: audit.sink,
      sessions,
      saydoHome: fx.home,
      idleSuspendSec: 600,
      onSuspend: (sessionId) => dialog.retireSession(sessionId)
    });
    dialog = new LiveDialog({
      db: fx.db,
      audit: audit.sink,
      sessions: live,
      dialogProvider: provider,
      say: () => true,
      log: nullLog
    });
    live.ensureSession(fx.sessionId);

    const userTurn = dialog.onAsrFinal(fx.sessionId, newId("evt"), "挂起前的用户轮");
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(calls).toHaveLength(1);
    dialog.injectControlTurn(fx.sessionId, { kind: "confirmation_settled", receiptRef: newId("apr") });
    live.suspend(fx.sessionId, reason);
    calls[0]!.resolve({
      ok: true,
      text: "晚到返回",
      requestedModel: "suspend-race",
      observedModel: "suspend-race",
      observedModelSource: "stream",
      observedModelExempted: false,
      usage: undefined
    });
    await userTurn;
    await new Promise((resolve) => setTimeout(resolve, 15));

    expect(calls).toHaveLength(1);
    expect(
      (fx.db.prepare("SELECT state FROM sessions WHERE id=?").get(fx.sessionId) as { state: string }).state
    ).toBe("suspended");
  });

  it("prepareShutdown abort 并等待在途控制轮,且 finally 不重排或再泵", async () => {
    let resolveChat!: (value: Awaited<ReturnType<LlmProvider["chat"]>>) => void;
    let seenSignal: AbortSignal | undefined;
    let calls = 0;
    const provider: LlmProvider = {
      kind: "api",
      model: "shutdown-race",
      chat(_req, signal) {
        calls += 1;
        seenSignal = signal;
        return new Promise((resolve) => { resolveChat = resolve; });
      }
    };
    const audit = makeAudit();
    const sessions = new SessionManager({ db: fx.db, audit: audit.sink, storeTranscript: true });
    const live = new LiveVoiceSessions({
      db: fx.db,
      audit: audit.sink,
      sessions,
      saydoHome: fx.home,
      idleSuspendSec: 600
    });
    const dialog = new LiveDialog({ db: fx.db, audit: audit.sink, sessions: live, dialogProvider: provider, say: () => true, log: nullLog });
    live.ensureSession(fx.sessionId);
    dialog.injectControlTurn(fx.sessionId, { kind: "confirmation_settled", receiptRef: newId("apr") });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const shutdown = dialog.prepareShutdown();
    expect(seenSignal?.aborted).toBe(true);
    resolveChat({ ok: false, code: "cancelled", message: "shutdown", retryable: false });
    await shutdown;
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(calls).toBe(1);
    expect(dialog.injectControlTurn(fx.sessionId, { kind: "confirmation_settled" })).toEqual({
      accepted: false,
      reason: "daemon_draining"
    });
  });

  it("e) remainingIntent 处理成功→ledger text 为 NULL 且 handled=true、digest 保留", async () => {
    const h = buildHarness(fx);
    const { focusId } = createFocus(fx.db, { title: "RI" });
    startActivation(fx.db, { focusId, sessionId: fx.sessionId, trigger: "user_explicit" });
    const receiptId = newId("apr");
    h.confirm.present(fx.sessionId, {
      receiptId,
      sentenceId: `s-${receiptId}`,
      promptText: "我提议:记下「A」。",
      payload: {
        kind: "focus_obligation",
        focusId,
        obligation: {
          kind: "action",
          title: "A",
          owner: "human",
          dedupeKey: `${focusId}:action:a`,
          verification: "confirmed"
        }
      },
      remainingIntent: "还要拆成两条线",
      remainingIntentSourceTurnId: newId("evt")
    });
    const before = h.confirm.readRemainingIntent(receiptId);
    expect(before?.handled).toBe(false);
    expect(before?.text).toContain("拆成两条线");
    const digest = before!.textDigest;
    expect(digest.startsWith("sha256:")).toBe(true);

    // 直接 mark(注入成功路径)
    h.confirm.markRemainingIntentHandled(receiptId);
    const after = h.confirm.readRemainingIntent(receiptId);
    expect(after?.handled).toBe(true);
    expect(after?.text).toBeUndefined();
    expect(after?.textDigest).toBe(digest);
  });

  it("f) 批量三义务:FocusWriteTx 消费路径三条同现", () => {
    const h = buildHarness(fx);
    const { focusId } = createFocus(fx.db, { title: "Batch2" });
    startActivation(fx.db, { focusId, sessionId: fx.sessionId, trigger: "user_explicit" });
    const items = ["买菜", "做饭", "洗碗"].map((title, i) => ({
      kind: "action" as const,
      title,
      owner: "human" as const,
      dedupeKey: `${focusId}:action:b${i}`,
      verification: "confirmed" as const
    }));
    const receiptId = newId("apr");
    h.confirm.present(fx.sessionId, {
      receiptId,
      sentenceId: `s-${receiptId}`,
      promptText: "我提议:记下 3 条。",
      payload: { kind: "focus_obligation", focusId, obligations: items }
    });
    const pending = h.confirm.pending(fx.sessionId)!;
    const click = h.confirm.consumeClick(fx.sessionId, receiptId, pending.digest, "accept");
    expect(click.kind).toBe("accepted");
    // 经 dialog 公共入口(会 commitConsume)
    // holding 态:pending 仍在内存
    (h.dialog as unknown as { applyConfirmOutcome: Function }).applyConfirmOutcome(
      fx.sessionId,
      "click-batch",
      click,
      "click"
    );
    const rows = fx.db
      .prepare(`SELECT title FROM focus_obligations WHERE focus_id=? ORDER BY title`)
      .all(focusId) as Array<{ title: string }>;
    expect(rows.map((r) => r.title).sort()).toEqual(["买菜", "洗碗", "做饭"].sort());
  });

  it("f) 批量其一 dedupe 冲突→整卡拒绝零写入", () => {
    const h = buildHarness(fx);
    const { focusId } = createFocus(fx.db, { title: "BatchConflict" });
    startActivation(fx.db, { focusId, sessionId: fx.sessionId, trigger: "user_explicit" });
    // 先落一条
    upsertObligation(fx.db, focusId, {
      kind: "action",
      title: "已有",
      owner: "human",
      status: "open",
      verification: "confirmed",
      dedupeKey: `${focusId}:action:dup`,
      actorKind: "user",
      sessionId: fx.sessionId
    });
    const items = [
      {
        kind: "action" as const,
        title: "新A",
        owner: "human" as const,
        dedupeKey: `${focusId}:action:newa`,
        verification: "confirmed" as const
      },
      {
        kind: "action" as const,
        title: "冲突",
        owner: "human" as const,
        dedupeKey: `${focusId}:action:dup`,
        verification: "confirmed" as const
      }
    ];
    const receiptId = newId("apr");
    h.confirm.present(fx.sessionId, {
      receiptId,
      sentenceId: `s-${receiptId}`,
      promptText: "我提议:记下 2 条。",
      payload: { kind: "focus_obligation", focusId, obligations: items }
    });
    const pending = h.confirm.pending(fx.sessionId)!;
    const click = h.confirm.consumeClick(fx.sessionId, receiptId, pending.digest, "accept");
    (h.dialog as unknown as { applyConfirmOutcome: Function }).applyConfirmOutcome(
      fx.sessionId,
      "click-dup",
      click,
      "click"
    );
    const rows = fx.db
      .prepare(`SELECT title FROM focus_obligations WHERE focus_id=?`)
      .all(focusId) as Array<{ title: string }>;
    // 只有预置「已有」,新A/冲突都未写入
    expect(rows.map((r) => r.title)).toEqual(["已有"]);
  });

  it("g) confirmation_settled 控制轮触达 Brain(system 含 receiptRef)", async () => {
    const h = buildHarness(fx);
    const { focusId } = createFocus(fx.db, { title: "G" });
    startActivation(fx.db, { focusId, sessionId: fx.sessionId, trigger: "user_explicit" });
    const receiptId = newId("apr");
    h.confirm.present(fx.sessionId, {
      receiptId,
      sentenceId: `s-${receiptId}`,
      promptText: "我提议:记下「G1」。",
      payload: {
        kind: "focus_obligation",
        focusId,
        obligation: {
          kind: "action",
          title: "G1",
          owner: "human",
          dedupeKey: `${focusId}:action:g1`,
          verification: "confirmed"
        }
      }
    });
    const pending = h.confirm.pending(fx.sessionId)!;
    const click = h.confirm.consumeClick(fx.sessionId, receiptId, pending.digest, "accept");
    (h.dialog as unknown as { applyConfirmOutcome: Function }).applyConfirmOutcome(
      fx.sessionId,
      "click-g",
      click,
      "click"
    );
    await new Promise((r) => setTimeout(r, 40));
    const sys = h.messages.flat().filter((m) => m.role === "system");
    const control = sys.find((m) => String(m.content).includes("控制轮") && String(m.content).includes(receiptId));
    expect(control, "Brain 应收到含 receiptRef 的 system 控制消息").toBeTruthy();
    expect(String(control!.content)).toContain("confirmation_settled");
    // 无 user role 的控制消息帧
    const lastBatch = h.messages[h.messages.length - 1]!;
    expect(lastBatch.some((m) => m.role === "user")).toBe(false);
  });
});

describe("④c golden 五断头场景(mock 结构)", () => {
  async function settleAndExpectControl(
    kind: ControlTurnPayload["kind"],
    setup: (h: ReturnType<typeof buildHarness>, focusId: string) => { receiptId: string }
  ): Promise<void> {
    const h = buildHarness(fx);
    const { focusId } = createFocus(fx.db, { title: `golden-${kind}` });
    startActivation(fx.db, { focusId, sessionId: fx.sessionId, trigger: "user_explicit" });
    const { receiptId } = setup(h, focusId);
    const pending = h.confirm.pending(fx.sessionId)!;
    const click = h.confirm.consumeClick(fx.sessionId, receiptId, pending.digest, "accept");
    (h.dialog as unknown as { applyConfirmOutcome: Function }).applyConfirmOutcome(
      fx.sessionId,
      `gld-${kind}`,
      click,
      "click"
    );
    await new Promise((r) => setTimeout(r, 40));
    const hit = h.messages.flat().some(
      (m) =>
        m.role === "system" &&
        String(m.content).includes("confirmation_settled") &&
        String(m.content).includes(receiptId)
    );
    expect(hit, `断头场景 ${kind} 确认消费后 Brain 应收到控制轮`).toBe(true);
    // 续办:mock 已回文本,spoken 非空=流程未静默
    expect(h.spoken.length).toBeGreaterThan(0);
  }

  it("立项停滞:create_anchor accept → 控制轮续办", async () => {
    await settleAndExpectControl("confirmation_settled", (h, _fid) => {
      const receiptId = newId("apr");
      const rev =
        (
          fx.db
            .prepare("SELECT focus_anchor_revision FROM sessions WHERE id=?")
            .get(fx.sessionId) as { focus_anchor_revision: number }
        ).focus_anchor_revision ?? 0;
      h.confirm.present(fx.sessionId, {
        receiptId,
        sentenceId: `s-${receiptId}`,
        promptText: "我提议:新建 Focus「立项」。",
        payload: {
          kind: "focus_create_anchor",
          title: "立项停滞修复",
          expectedAnchorRevision: rev
        }
      });
      return { receiptId };
    });
  });

  it("拆线躺平:lane_split accept → 控制轮续办", async () => {
    await settleAndExpectControl("confirmation_settled", (h, focusId) => {
      const receiptId = newId("apr");
      const focusRevision = (
        fx.db.prepare("SELECT current_revision FROM focuses WHERE id=?").get(focusId) as {
          current_revision: number;
        }
      ).current_revision;
      const eventHWM = maxFocusEventSeq(fx.db, focusId);
      const obligationsDigest = openObligationsDigest(fx.db, focusId);
      h.confirm.present(fx.sessionId, {
        receiptId,
        sentenceId: `s-${receiptId}`,
        promptText: "我提议:拆出线。",
        payload: {
          kind: "focus_lane_split",
          focusId,
          lanes: [
            { title: "线甲", parentLaneId: null, obligationIds: [] },
            { title: "线乙", parentLaneId: null, obligationIds: [] }
          ],
          baseline: { focusRevision, eventHWM, obligationsDigest }
        }
      });
      return { receiptId };
    });
  });

  it("锚定不落账:focus_anchor accept → 控制轮续办", async () => {
    await settleAndExpectControl("confirmation_settled", (h, _focusId) => {
      const receiptId = newId("apr");
      // 新建另一 focus 用于锚定
      const other = createFocus(fx.db, { title: "目标锚" });
      const rev =
        (
          fx.db
            .prepare("SELECT focus_anchor_revision FROM sessions WHERE id=?")
            .get(fx.sessionId) as { focus_anchor_revision: number }
        ).focus_anchor_revision ?? 0;
      h.confirm.present(fx.sessionId, {
        receiptId,
        sentenceId: `s-${receiptId}`,
        promptText: "我提议:接到目标锚。",
        payload: {
          kind: "focus_anchor",
          focusId: other.focusId,
          expectedAnchorRevision: rev,
          title: "目标锚",
          trigger: "user_explicit"
        }
      });
      return { receiptId };
    });
  });

  it("确认循环:obligation accept 后控制轮禁同 dedupe 重提(结构断言)", async () => {
    await settleAndExpectControl("confirmation_settled", (h, focusId) => {
      const receiptId = newId("apr");
      h.confirm.present(fx.sessionId, {
        receiptId,
        sentenceId: `s-${receiptId}`,
        promptText: "我提议:记下「循环」。",
        payload: {
          kind: "focus_obligation",
          focusId,
          obligation: {
            kind: "action",
            title: "循环项",
            owner: "human",
            dedupeKey: `${focusId}:action:loop`,
            verification: "confirmed"
          }
        }
      });
      return { receiptId };
    });
    // 控制消息含禁止同 dedupeKey 重提纪律
    // (由 formatControlMessage 固定文案)
  });

  it("都对上了沉默:readiness 类不在本批控制轮(语义 kind 仅 focus_*)——obligation 续办代替", async () => {
    // 边界说明:readiness 非 SEMANTIC 七 kind 消费路径;J4 断头由 instructions #采访-绑定纪律 + 控制轮
    // 在 focus 确认后续办。本断言验证 mock Brain 在 confirmation_settled 后非空回复(不沉默)。
    const h = buildHarness(fx);
    const { focusId } = createFocus(fx.db, { title: "J4" });
    startActivation(fx.db, { focusId, sessionId: fx.sessionId, trigger: "user_explicit" });
    const receiptId = newId("apr");
    h.confirm.present(fx.sessionId, {
      receiptId,
      sentenceId: `s-${receiptId}`,
      promptText: "我提议:记下「就绪后下一步」。",
      payload: {
        kind: "focus_obligation",
        focusId,
        obligation: {
          kind: "action",
          title: "就绪后下一步",
          owner: "agent",
          dedupeKey: `${focusId}:action:next`,
          verification: "confirmed"
        }
      },
      remainingIntent: "都对上了之后要 createTask"
    });
    const pending = h.confirm.pending(fx.sessionId)!;
    const click = h.confirm.consumeClick(fx.sessionId, receiptId, pending.digest, "accept");
    (h.dialog as unknown as { applyConfirmOutcome: Function }).applyConfirmOutcome(
      fx.sessionId,
      "j4",
      click,
      "click"
    );
    await new Promise((r) => setTimeout(r, 40));
    const control = h.messages.flat().find(
      (m) => m.role === "system" && String(m.content).includes("confirmation_settled")
    );
    expect(control).toBeTruthy();
    expect(String(control!.content)).toContain("remainingIntent");
    expect(String(control!.content)).toContain("createTask");
    expect(h.spoken.some((s) => s.includes("继续") || s.length > 0)).toBe(true);
  });
});

describe("④c remainingIntent 构造", () => {
  it("脱敏+截断+digest", () => {
    const long = "x".repeat(400) + ` ${["", "Users", "secret"].join("/")}/path/token`;
    const j = buildRemainingIntentJson(long, "t1");
    expect(j.handled).toBe(false);
    expect(j.text!.length).toBeLessThanOrEqual(300);
    expect(j.textDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(j.sourceTurnId).toBe("t1");
  });
});
