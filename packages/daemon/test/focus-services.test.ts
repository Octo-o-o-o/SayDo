// B1–B4 服务层:registry/lifecycle/obligation/activation/closeSettlement。

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  createFocus,
  resolveFocus,
  listFocusCandidatesByTitle,
  changeFocusLifecycle,
  LIFECYCLE_EDGES
} from "../src/focus/registry.js";
import {
  upsertObligation,
  listOpenHumanObligations,
  assertHumanOpenExactSet,
  buildObligationsSnapshot,
  buildObligationDedupeKey,
  getObligationByDedupe
} from "../src/focus/obligations.js";
import { startActivation, closeActivation, getActiveActivationForSession } from "../src/focus/activation.js";
import {
  enumerateCloseSettlement,
  presentCloseSettlement,
  confirmCloseSettlement,
  autoLedgerCloseSettlement,
  commitCloseSettlement,
  reenumerateAfterConflict,
  renderCloseSettlementChecklist,
  getSettlement
} from "../src/focus/closeSettlement.js";
import { withFocusWriteTx, readFocus } from "../src/focus/writeTx.js";
import { denyBrainDirectFocusMutation } from "../src/focus/directWriteGuard.js";
import { openFocusFixture, openSecondConnection, type FocusFixture } from "./helpers/focus-fixture.js";

let fx: FocusFixture;

beforeEach(() => {
  fx = openFocusFixture();
});
afterEach(() => fx.close());

describe("B1 registry+resolver+lifecycle", () => {
  it("resolveFocus 判别:found/not_found/closed_or_abandoned/authority_mismatch", () => {
    expect(resolveFocus(fx.db, "foc_01NOTEXIST000000000000000A").kind).toBe("not_found");
    const { focusId } = createFocus(fx.db, { title: "Alpha" });
    expect(resolveFocus(fx.db, focusId).kind).toBe("found");
    changeFocusLifecycle(fx.db, focusId, { to: "active", actorKind: "user" });
    // active 不能直接 closed? 可以 active→closed 但需无未结义务
    changeFocusLifecycle(fx.db, focusId, { to: "closed", actorKind: "user" });
    expect(resolveFocus(fx.db, focusId).kind).toBe("closed_or_abandoned");
    expect(resolveFocus(fx.db, focusId, { includeTerminal: true }).kind).toBe("found");

    const { focusId: boot } = createFocus(
      fx.db,
      { title: "Boot", semanticAuthority: "external_bootstrap" },
      { writerAuthority: "external_bootstrap" }
    );
    const r = resolveFocus(fx.db, boot, { expectedAuthority: "saydo" });
    expect(r.kind).toBe("authority_mismatch");
  });

  it("title 匹配只产候选:多/零/禁静默", () => {
    createFocus(fx.db, { title: "整理 D2 观察表" });
    createFocus(fx.db, { title: "整理 D2 备份" });
    createFocus(fx.db, { title: "其他事" });
    const multi = listFocusCandidatesByTitle(fx.db, "整理 D2");
    expect(multi.length).toBe(2);
    const zero = listFocusCandidatesByTitle(fx.db, "完全不存在的标题XYZ");
    expect(zero).toEqual([]);
    // 不返回「最活跃一个」——始终是列表
    expect(Array.isArray(multi)).toBe(true);
  });

  it("lifecycle 全边 + 硬前置:带未结义务 close 拒;abandon 逐项 resolved;reopen 升 revision", () => {
    const { focusId } = createFocus(fx.db, { title: "L" });
    // captured→active
    changeFocusLifecycle(fx.db, focusId, { to: "active" });
    expect(readFocus(fx.db, focusId)!.lifecycle).toBe("active");

    upsertObligation(fx.db, focusId, {
      kind: "action",
      title: "open item",
      owner: "human",
      status: "open",
      verification: "confirmed",
      dedupeKey: buildObligationDedupeKey({ focusId, kind: "action", sourceKey: "1" }),
      nextStep: "做"
    });
    expect(() => changeFocusLifecycle(fx.db, focusId, { to: "closed" })).toThrow(/lifecycle_precondition/);

    // abandon 清义务
    changeFocusLifecycle(fx.db, focusId, { to: "abandoned" });
    expect(listOpenHumanObligations(fx.db, focusId)).toHaveLength(0);
    expect(readFocus(fx.db, focusId)!.lifecycle).toBe("abandoned");

    const revBefore = readFocus(fx.db, focusId)!.currentRevision;
    changeFocusLifecycle(fx.db, focusId, { to: "dormant", reason: "reopen" });
    expect(readFocus(fx.db, focusId)!.lifecycle).toBe("dormant");
    expect(readFocus(fx.db, focusId)!.currentRevision).toBeGreaterThan(revBefore);

    // 非法边
    expect(() => changeFocusLifecycle(fx.db, focusId, { to: "captured" })).toThrow(/lifecycle_illegal/);
    // 边表覆盖
    expect(LIFECYCLE_EDGES.length).toBeGreaterThanOrEqual(8);
  });
});

describe("B2 obligation 台账", () => {
  it("dedupeKey 幂等 upsert + resolved 必带 resolution event", () => {
    const { focusId } = createFocus(fx.db, { title: "O" });
    const key = buildObligationDedupeKey({ focusId, kind: "answer", sourceKey: "t1" });
    const a = upsertObligation(fx.db, focusId, {
      kind: "answer",
      title: "Q?",
      owner: "agent",
      status: "open",
      verification: "provisional",
      dedupeKey: key
    });
    const b = upsertObligation(fx.db, focusId, {
      kind: "answer",
      title: "Q? updated",
      owner: "agent",
      status: "in_progress",
      verification: "confirmed",
      dedupeKey: key
    });
    expect(b.obligationId).toBe(a.obligationId);
    expect(getObligationByDedupe(fx.db, focusId, key)!.title).toBe("Q? updated");

    const evSeq = (fx.db.prepare("SELECT seq FROM focus_events WHERE focus_id=? ORDER BY seq LIMIT 1").get(focusId) as { seq: number }).seq;
    const resolved = upsertObligation(fx.db, focusId, {
      kind: "answer",
      title: "Q? updated",
      owner: "agent",
      status: "resolved",
      verification: "confirmed",
      dedupeKey: key,
      resolution: "done",
      evidence: { type: "event", focusId, seq: evSeq }
    });
    const row = getObligationByDedupe(fx.db, focusId, key)!;
    expect(row.resolutionEventId).toBe(resolved.eventId);
    const ev = fx.db.prepare("SELECT type, focus_id FROM focus_events WHERE id=?").get(row.resolutionEventId!) as {
      type: string;
      focus_id: string;
    };
    expect(ev.type).toBe("obligation_resolved");
    expect(ev.focus_id).toBe(focusId);
  });

  it("V2:无证据 resolved 拒;假 resolutionEventId 拒", () => {
    const { focusId } = createFocus(fx.db, { title: "O2" });
    const key = buildObligationDedupeKey({ focusId, kind: "action", sourceKey: "x" });
    upsertObligation(fx.db, focusId, {
      kind: "action",
      title: "x",
      owner: "agent",
      status: "open",
      verification: "confirmed",
      dedupeKey: key
    });
    // 外部提供不存在的 resolutionEventId
    expect(() =>
      upsertObligation(fx.db, focusId, {
        kind: "action",
        title: "x",
        owner: "agent",
        status: "resolved",
        verification: "confirmed",
        dedupeKey: key,
        resolution: "done",
        resolutionEventId: "fev_01FAKE00000000000000000000",
        evidence: { type: "event", focusId, seq: 1 }
      })
    ).toThrow(/resolution_event_missing|resolution_event/);
  });

  it("unverified 不得 resolved(done)", () => {
    const { focusId } = createFocus(fx.db, { title: "O3" });
    const key = buildObligationDedupeKey({ focusId, kind: "check", sourceKey: "u" });
    upsertObligation(fx.db, focusId, {
      kind: "check",
      title: "c",
      owner: "agent",
      status: "open",
      verification: "unverified",
      dedupeKey: key
    });
    expect(() =>
      upsertObligation(fx.db, focusId, {
        kind: "check",
        title: "c",
        owner: "agent",
        status: "resolved",
        verification: "unverified",
        dedupeKey: key,
        resolution: "done"
      })
    ).toThrow();
  });
});

describe("B3 activation", () => {
  it("create + close + anchor CAS + 一 session 一 active", () => {
    const { focusId } = createFocus(fx.db, { title: "Act" });
    const a1 = startActivation(fx.db, {
      focusId,
      sessionId: fx.sessionId,
      trigger: "user_explicit"
    });
    expect(a1.anchorRevision).toBe(1);
    expect(readFocus(fx.db, focusId)!.lifecycle).toBe("active"); // captured→active
    expect(getActiveActivationForSession(fx.db, fx.sessionId)?.id).toBe(a1.activationId);

    expect(() =>
      startActivation(fx.db, { focusId, sessionId: fx.sessionId, trigger: "user_explicit" })
    ).toThrow(/activation_already_active/);

    // CAS 漂移
    expect(() =>
      startActivation(fx.db, {
        focusId,
        sessionId: fx.sessionId,
        trigger: "user_explicit",
        expectedAnchorRevision: 0
      })
    ).toThrow(/anchor_revision_drift|activation_already_active/);

    withFocusWriteTx(fx.db, {}, (ops) =>
      ops.settleRevision(focusId, { currentDirection: "d", lastReliableState: "s" })
    );
    const revAtClose = readFocus(fx.db, focusId)!.currentRevision;
    const closed = closeActivation(fx.db, {
      activationId: a1.activationId,
      sessionId: fx.sessionId,
      focusId
    });
    // startActivation 已因 captured→active 升过 revision;再 settle 后 close 回填现势
    expect(closed.outputFocusRevision).toBe(revAtClose);
    expect(revAtClose).toBeGreaterThanOrEqual(1);
    expect(getActiveActivationForSession(fx.db, fx.sessionId)).toBeNull();
  });

  it("关错 activation 拒(IM-25)", () => {
    const { focusId: f1 } = createFocus(fx.db, { title: "A" });
    const { focusId: f2 } = createFocus(fx.db, { title: "B" });
    const a = startActivation(fx.db, { focusId: f1, sessionId: fx.sessionId, trigger: "user_explicit" });
    expect(() =>
      closeActivation(fx.db, { activationId: a.activationId, sessionId: fx.sessionId, focusId: f2 })
    ).toThrow(/activation_anchor_mismatch/);
  });
});

describe("B4 CloseSettlement", () => {
  function setupActive() {
    const { focusId } = createFocus(fx.db, { title: "Close" });
    const act = startActivation(fx.db, {
      focusId,
      sessionId: fx.sessionId,
      trigger: "user_explicit"
    });
    return { focusId, activationId: act.activationId };
  }

  it("枚举含用户问题+agent 承诺;store_transcript=false 降级", () => {
    const { focusId, activationId } = setupActive();
    const r = enumerateCloseSettlement(fx.db, {
      sessionId: fx.sessionId,
      focusId,
      activationId,
      transcriptLines: [
        { turnId: "t1", speaker: "user", text: "什么时候能好?", heard: true },
        { turnId: "t2", speaker: "agent", text: "我会跟进处理", heard: true }
      ]
    });
    expect(r.candidates.some((c) => c.kind === "unanswered_user_question")).toBe(true);
    expect(r.candidates.some((c) => c.kind === "agent_commitment")).toBe(true);
    expect(r.settlement.phase).toBe("enumerated");
    expect(renderCloseSettlementChecklist(r.candidates)).toContain("收尾清单");

    // 先把活跃 settlement 推到 conflict/committed 才能再开;测试降级用新 session 太重——直接测 enumerateCandidates 路径
    // 关闭当前:auto ledger + commit
    presentCloseSettlement(fx.db, r.settlement.id, "pres-1");
    autoLedgerCloseSettlement(fx.db, r.settlement.id);
    const committed = commitCloseSettlement(fx.db, r.settlement.id);
    expect(committed.ok).toBe(true);

    // 新 activation + 无转写
    const act2 = startActivation(fx.db, { focusId, sessionId: fx.sessionId, trigger: "reopen" });
    const deg = enumerateCloseSettlement(fx.db, {
      sessionId: fx.sessionId,
      focusId,
      activationId: act2.activationId,
      transcriptLines: [],
      storeTranscript: false
    });
    expect(deg.degradedNoTranscript).toBe(true);
    expect(deg.settlement.frozenInputs.transcriptDigest == null).toBe(true);
    expect(renderCloseSettlementChecklist(deg.candidates, { degradedNoTranscript: true })).toContain("转写未存");
  });

  it("confirmed → committed 挂账 + 原子关 activation;conflict 新行", () => {
    const { focusId, activationId } = setupActive();
    const r = enumerateCloseSettlement(fx.db, {
      sessionId: fx.sessionId,
      focusId,
      activationId,
      transcriptLines: [{ turnId: "u1", speaker: "user", text: "为何失败?", heard: true }]
    });
    presentCloseSettlement(fx.db, r.settlement.id, "p1");
    const decisions: Record<string, { disposition: "ledger" }> = {};
    for (const c of r.candidates) decisions[c.candidateId] = { disposition: "ledger" };
    confirmCloseSettlement(fx.db, r.settlement.id, decisions);

    // 人为制造 CAS 漂移:另开义务
    upsertObligation(fx.db, focusId, {
      kind: "followup",
      title: "drift",
      owner: "human",
      status: "open",
      verification: "confirmed",
      dedupeKey: buildObligationDedupeKey({ focusId, kind: "followup", sourceKey: "drift" }),
      nextStep: "x"
    });
    const conflicted = commitCloseSettlement(fx.db, r.settlement.id);
    expect(conflicted.ok).toBe(false);
    expect(getSettlement(fx.db, r.settlement.id)!.phase).toBe("conflict");

    // 新行 closeAttempt+1
    const r2 = reenumerateAfterConflict(fx.db, r.settlement.id, [], true);
    expect(r2.settlement.closeAttempt).toBe(2);
    presentCloseSettlement(fx.db, r2.settlement.id, "p2");
    autoLedgerCloseSettlement(fx.db, r2.settlement.id);
    const ok = commitCloseSettlement(fx.db, r2.settlement.id);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.settlement.phase).toBe("committed");
    }
    expect(getActiveActivationForSession(fx.db, fx.sessionId)).toBeNull();
  });
});

describe("V4 服务层无直写", () => {
  it("Brain 直调 fail-closed", () => {
    expect(() => denyBrainDirectFocusMutation()).toThrow(/V4/);
  });
});

describe("IM-24 双连接并发 dedupe", () => {
  it("UNIQUE(focus_id,dedupe_key) 双连接不重复开户", () => {
    const { focusId } = createFocus(fx.db, { title: "C" });
    const key = buildObligationDedupeKey({ focusId, kind: "action", sourceKey: "same" });
    upsertObligation(fx.db, focusId, {
      kind: "action",
      title: "one",
      owner: "agent",
      status: "open",
      verification: "confirmed",
      dedupeKey: key
    });
    const db2 = openSecondConnection(fx.dbPath);
    expect(() =>
      db2
        .prepare(
          `INSERT INTO focus_obligations(id,focus_id,kind,title,owner,status,verification,blocking,dedupe_key,created_at,updated_at)
           VALUES ('fob_01CONCUR0000000000000000A',?,?, 'action','x','agent','open','confirmed',0,?, '2026-08-04T00:00:00Z','2026-08-04T00:00:00Z')`
        )
        .run(focusId, key)
    ).toThrow();
    db2.close();
  });
});

describe("V1 exact-set", () => {
  it("obligationsSnapshot 与 owner=human 未结 exact-set", () => {
    const { focusId } = createFocus(fx.db, { title: "V1" });
    upsertObligation(fx.db, focusId, {
      kind: "decision",
      title: "人决策",
      owner: "human",
      status: "open",
      verification: "confirmed",
      dedupeKey: buildObligationDedupeKey({ focusId, kind: "decision", sourceKey: "h1" }),
      nextStep: "决定"
    });
    upsertObligation(fx.db, focusId, {
      kind: "action",
      title: "agent 做",
      owner: "agent",
      status: "open",
      verification: "confirmed",
      dedupeKey: buildObligationDedupeKey({ focusId, kind: "action", sourceKey: "a1" })
    });
    const snap = buildObligationsSnapshot(
      listOpenHumanObligations(fx.db, focusId).concat(
        // 故意只取 human
      ),
      { owner: "human", openOnly: true }
    );
    // listOpenHuman already human
    const human = listOpenHumanObligations(fx.db, focusId);
    const snapshot = buildObligationsSnapshot(human);
    expect(snapshot.every((s) => s.owner === "human" && s.nextStep !== undefined || s.owner === "human")).toBe(true);
    const check = assertHumanOpenExactSet(
      fx.db,
      focusId,
      snapshot.map((s) => s.id)
    );
    expect(check.ok).toBe(true);
    expect(assertHumanOpenExactSet(fx.db, focusId, []).ok).toBe(false);
  });
});
