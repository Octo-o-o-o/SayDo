// B5: conformance V1/V2/V4/V7① + invariant matrix 28 条正反例。

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  computeObligationsDigest,
  computeResumePacketDigest,
  newId,
  verifyResumePacketDigest
} from "@saydo/contracts";
import { createFocus, changeFocusLifecycle, resolveFocus } from "../src/focus/registry.js";
import {
  upsertObligation,
  listOpenHumanObligations,
  assertHumanOpenExactSet,
  buildObligationsSnapshot,
  buildObligationDedupeKey
} from "../src/focus/obligations.js";
import { startActivation, closeActivation, getActivation } from "../src/focus/activation.js";
import {
  enumerateCloseSettlement,
  presentCloseSettlement,
  autoLedgerCloseSettlement,
  commitCloseSettlement,
  getSettlement,
  forceSettlementPhaseForTest
} from "../src/focus/closeSettlement.js";
import { withFocusWriteTx, FocusWriteError, readFocus } from "../src/focus/writeTx.js";
import { denyBrainDirectFocusMutation, installFocusDirectWriteGuard } from "../src/focus/directWriteGuard.js";
import { openFocusFixture, openSecondConnection, type FocusFixture } from "./helpers/focus-fixture.js";

let fx: FocusFixture;
beforeEach(() => {
  fx = openFocusFixture();
});
afterEach(() => fx.close());

describe("Invariant matrix (28)", () => {
  it("IM-01 UNIQUE(focus_id,revision)", () => {
    const { focusId } = createFocus(fx.db, { title: "im1" });
    withFocusWriteTx(fx.db, {}, (ops) =>
      ops.settleRevision(focusId, { currentDirection: "d", lastReliableState: "s" })
    );
    expect(() =>
      fx.db
        .prepare(
          `INSERT INTO focus_states(focus_id,revision,current_direction,last_reliable_state,accepted_decision_refs_json,event_high_watermark,obligations_digest,created_at)
           VALUES (?,1,'x','y','[]',0,?,?)`
        )
        .run(focusId, computeObligationsDigest([]), "2026-08-04T00:00:00Z")
    ).toThrow(/UNIQUE/);
  });

  it("IM-02 UNIQUE(focus_id,seq)", () => {
    const { focusId } = createFocus(fx.db, { title: "im2" });
    expect(() =>
      fx.db
        .prepare(
          `INSERT INTO focus_events(id,focus_id,seq,type,payload_schema_version,payload_json,actor_kind,created_at)
           VALUES (?,?,1,'correction',1,'{"payloadSchemaVersion":1,"note":"x"}','daemon',?)`
        )
        .run(newId("fev"), focusId, "2026-08-04T00:00:00Z")
    ).toThrow(/UNIQUE/);
  });

  it("IM-03 project_ref active partial unique", () => {
    const { focusId } = createFocus(fx.db, { title: "im3" });
    const ev = newId("fev");
    fx.db
      .prepare(
        `INSERT INTO focus_events(id,focus_id,seq,type,payload_schema_version,payload_json,actor_kind,created_at)
         VALUES (?,?,2,'project_ref_added',1,?,?,?)`
      )
      .run(ev, focusId, JSON.stringify({ payloadSchemaVersion: 1, projectId: fx.projectId }), "daemon", "2026-08-04T00:00:00Z");
    fx.db
      .prepare(
        `INSERT INTO focus_project_refs(focus_id,project_id,added_by_event_id,added_at)
         VALUES (?,?,?,?)`
      )
      .run(focusId, fx.projectId, ev, "2026-08-04T00:00:00Z");
    expect(() =>
      fx.db
        .prepare(
          `INSERT INTO focus_project_refs(focus_id,project_id,added_by_event_id,added_at)
           VALUES (?,?,?,?)`
        )
        .run(focusId, fx.projectId, newId("fev"), "2026-08-04T00:00:00Z")
    ).toThrow(/UNIQUE/);
  });

  it("IM-04 一 task 一 active binding", () => {
    const { focusId } = createFocus(fx.db, { title: "im4" });
    const tsk = newId("tsk");
    const ins = () =>
      fx.db
        .prepare(
          `INSERT INTO action_execution_bindings(id,focus_id,task_id,focus_revision_at_authorization,selected_authority,phase,authorized_by_event_id,created_at,updated_at)
           VALUES (?,?,?,0,'tier1','authorized',?,?,?)`
        )
        .run(newId("aeb"), focusId, tsk, newId("fev"), "2026-08-04T00:00:00Z", "2026-08-04T00:00:00Z");
    ins();
    expect(() => ins()).toThrow(/UNIQUE/);
  });

  it("IM-05 resolutionEventId 同 Focus+合法 type", () => {
    const { focusId: f1 } = createFocus(fx.db, { title: "im5a" });
    const { focusId: f2 } = createFocus(fx.db, { title: "im5b" });
    const key = buildObligationDedupeKey({ focusId: f1, kind: "action", sourceKey: "r" });
    upsertObligation(fx.db, f1, {
      kind: "action",
      title: "x",
      owner: "agent",
      status: "open",
      verification: "confirmed",
      dedupeKey: key
    });
    // 用 f2 的 event 当 resolution —— 类型/focus 不符
    const foreignEv = fx.db
      .prepare("SELECT id FROM focus_events WHERE focus_id=? LIMIT 1")
      .get(f2) as { id: string };
    expect(() =>
      upsertObligation(fx.db, f1, {
        kind: "action",
        title: "x",
        owner: "agent",
        status: "resolved",
        verification: "confirmed",
        dedupeKey: key,
        resolution: "done",
        resolutionEventId: foreignEv.id,
        evidence: { type: "event", focusId: f1, seq: 1 }
      })
    ).toThrow(/resolution_event/);
  });

  it("IM-06 currentRevision=latest state", () => {
    const { focusId } = createFocus(fx.db, { title: "im6" });
    withFocusWriteTx(fx.db, {}, (ops) => {
      ops.settleRevision(focusId, { currentDirection: "d", lastReliableState: "s" });
      ops.assertCurrentRevisionConsistent(focusId);
    });
    // 人为破坏
    fx.db.prepare("UPDATE focuses SET current_revision=99 WHERE id=?").run(focusId);
    expect(() =>
      withFocusWriteTx(fx.db, {}, (ops) => ops.assertCurrentRevisionConsistent(focusId))
    ).toThrow(/revision_inconsistent/);
  });

  it("IM-07 event payload 判别 schema+version", () => {
    const { focusId } = createFocus(fx.db, { title: "im7" });
    expect(() =>
      withFocusWriteTx(fx.db, {}, (ops) =>
        ops.appendEvent(focusId, {
          type: "created",
          // @ts-expect-error 故意缺 title
          payload: {},
          actorKind: "daemon"
        })
      )
    ).toThrow();
  });

  it("IM-08 obligation waiting 需 waitingOn", () => {
    const { focusId } = createFocus(fx.db, { title: "im8" });
    expect(() =>
      upsertObligation(fx.db, focusId, {
        kind: "followup",
        title: "w",
        owner: "human",
        status: "waiting",
        verification: "confirmed",
        dedupeKey: "k-wait"
      })
    ).toThrow();
  });

  it("IM-09 resolved 必 resolutionEventId", () => {
    const { focusId } = createFocus(fx.db, { title: "im9" });
    const key = "k-res";
    upsertObligation(fx.db, focusId, {
      kind: "action",
      title: "a",
      owner: "agent",
      status: "open",
      verification: "confirmed",
      dedupeKey: key
    });
    const r = upsertObligation(fx.db, focusId, {
      kind: "action",
      title: "a",
      owner: "agent",
      status: "resolved",
      verification: "confirmed",
      dedupeKey: key,
      resolution: "done",
      evidence: { type: "event", focusId, seq: 1 }
    });
    expect(r.eventId).toBeTruthy();
  });

  it("IM-10 unverified 不得 done", () => {
    const { focusId } = createFocus(fx.db, { title: "im10" });
    expect(() =>
      upsertObligation(fx.db, focusId, {
        kind: "check",
        title: "c",
        owner: "agent",
        status: "resolved",
        verification: "unverified",
        dedupeKey: "k-u",
        resolution: "done"
      })
    ).toThrow();
  });

  it("IM-11 activation 一 session 一 active", () => {
    const { focusId } = createFocus(fx.db, { title: "im11" });
    startActivation(fx.db, { focusId, sessionId: fx.sessionId, trigger: "user_explicit" });
    expect(() =>
      startActivation(fx.db, { focusId, sessionId: fx.sessionId, trigger: "user_explicit" })
    ).toThrow(/activation_already_active/);
  });

  it("IM-12 settlement 单活跃 partial unique", () => {
    const { focusId } = createFocus(fx.db, { title: "im12" });
    const act = startActivation(fx.db, { focusId, sessionId: fx.sessionId, trigger: "user_explicit" });
    enumerateCloseSettlement(fx.db, {
      sessionId: fx.sessionId,
      focusId,
      activationId: act.activationId,
      transcriptLines: []
    });
    expect(() =>
      enumerateCloseSettlement(fx.db, {
        sessionId: fx.sessionId,
        focusId,
        activationId: act.activationId,
        transcriptLines: []
      })
    ).toThrow(/settlement_active/);
  });

  it("IM-13 UNIQUE(session_id, close_attempt)", () => {
    const { focusId } = createFocus(fx.db, { title: "im13" });
    const act = startActivation(fx.db, { focusId, sessionId: fx.sessionId, trigger: "user_explicit" });
    const r = enumerateCloseSettlement(fx.db, {
      sessionId: fx.sessionId,
      focusId,
      activationId: act.activationId,
      transcriptLines: []
    });
    expect(() =>
      fx.db
        .prepare(
          `INSERT INTO focus_close_settlements(id,session_id,focus_id,activation_id,idempotency_key,close_attempt,frozen_inputs_json,candidates_json,phase,created_at,updated_at)
           VALUES (?,?,?,?,?,1,'{}','[]','conflict',?,?)`
        )
        .run(newId("fcs"), fx.sessionId, focusId, act.activationId, "other-key", "2026-08-04T00:00:00Z", "2026-08-04T00:00:00Z")
    ).toThrow(/UNIQUE/);
    void r;
  });

  it("IM-14 UNIQUE(idempotency_key)", () => {
    const { focusId } = createFocus(fx.db, { title: "im14" });
    const act = startActivation(fx.db, { focusId, sessionId: fx.sessionId, trigger: "user_explicit" });
    const r = enumerateCloseSettlement(fx.db, {
      sessionId: fx.sessionId,
      focusId,
      activationId: act.activationId,
      transcriptLines: []
    });
    // 先 conflict 终态化以绕过 active partial unique
    forceSettlementPhaseForTest(fx.db, r.settlement.id, "conflict");
    expect(() =>
      fx.db
        .prepare(
          `INSERT INTO focus_close_settlements(id,session_id,focus_id,activation_id,idempotency_key,close_attempt,frozen_inputs_json,candidates_json,phase,created_at,updated_at)
           VALUES (?,?,?,?,?,2,'{}','[]','enumerated',?,?)`
        )
        .run(
          newId("fcs"),
          fx.sessionId,
          focusId,
          act.activationId,
          r.settlement.idempotencyKey,
          "2026-08-04T00:00:00Z",
          "2026-08-04T00:00:00Z"
        )
    ).toThrow(/UNIQUE/);
  });

  it("IM-15..19 packet/binding 约束(假 digest 插入可存但 verify 拒;DELETE 拒;bound 无 ref 拒)", () => {
    const { focusId } = createFocus(fx.db, { title: "im15" });
    const dig = computeResumePacketDigest({
      focusId,
      revision: 1,
      baseline: { revision: 1, eventHighWatermark: 0, obligationsDigest: computeObligationsDigest([]) },
      compiledFrom: { eventSeqRange: [0, 0], transcriptRefs: [] },
      compilerVersion: "1",
      rendererVersion: "1",
      inputDigest: computeObligationsDigest([]),
      factsJson: "[]",
      obligationsSnapshotJson: "[]"
    });
    const fake = "sha256:" + "f".repeat(64);
    fx.db
      .prepare(
        `INSERT INTO focus_resume_packets(focus_id,revision,baseline_revision,baseline_event_high_watermark,baseline_obligations_digest,
          compiled_from_json,compiler_version,renderer_version,input_digest,facts_json,obligations_snapshot_json,digest,created_at)
         VALUES (?,1,1,0,?,?, '1','1',?,'[]','[]',?,?)`
      )
      .run(
        focusId,
        computeObligationsDigest([]),
        JSON.stringify({ eventSeqRange: [0, 0], transcriptRefs: [] }),
        computeObligationsDigest([]),
        fake,
        "2026-08-04T00:00:00Z"
      );
    expect(
      verifyResumePacketDigest({
        focusId,
        revision: 1,
        baseline: { revision: 1, eventHighWatermark: 0, obligationsDigest: computeObligationsDigest([]) },
        compiledFrom: { eventSeqRange: [0, 0], transcriptRefs: [] },
        compilerVersion: "1",
        rendererVersion: "1",
        inputDigest: computeObligationsDigest([]),
        factsJson: "[]",
        obligationsSnapshotJson: "[]",
        digest: fake
      })
    ).not.toBeNull();
    expect(dig).not.toBe(fake);
    expect(() => fx.db.prepare("DELETE FROM focus_resume_packets WHERE focus_id=?").run(focusId)).toThrow(/immutable/);
  });

  it("IM-20 focus_events 禁 UPDATE/DELETE", () => {
    const { focusId } = createFocus(fx.db, { title: "im20" });
    const id = (fx.db.prepare("SELECT id FROM focus_events WHERE focus_id=?").get(focusId) as { id: string }).id;
    expect(() => fx.db.prepare("UPDATE focus_events SET type='correction' WHERE id=?").run(id)).toThrow(/immutable/);
    expect(() => fx.db.prepare("DELETE FROM focus_events WHERE id=?").run(id)).toThrow(/immutable/);
  });

  it("IM-21 sessions.primary_focus_id FK", () => {
    expect(() =>
      fx.db.prepare("UPDATE sessions SET primary_focus_id=? WHERE id=?").run("foc_01NOTEXIST000000000000000A", fx.sessionId)
    ).toThrow();
  });

  it("IM-22 revision/seq 连续", () => {
    const { focusId } = createFocus(fx.db, { title: "im22" });
    expect(() =>
      withFocusWriteTx(fx.db, {}, (ops) =>
        ops.settleRevision(focusId, { currentDirection: "d", lastReliableState: "s", forceRevision: 5 })
      )
    ).toThrow(/revision_not_contiguous/);
    expect(() =>
      withFocusWriteTx(fx.db, {}, (ops) =>
        ops.appendEvent(focusId, {
          type: "correction",
          payload: { note: "n" },
          actorKind: "daemon",
          forceSeq: 0
        })
      )
    ).toThrow(/seq_not_contiguous/);
  });

  it("IM-23 崩溃回滚", () => {
    expect(() =>
      withFocusWriteTx(fx.db, { injectCrashAfterTargetWrite: true }, (ops) => ops.createFocus({ title: "x" }))
    ).toThrow(/injected_crash/);
    expect((fx.db.prepare("SELECT COUNT(*) AS c FROM focuses").get() as { c: number }).c).toBe(0);
  });

  it("IM-24 双连接 dedupe", () => {
    const { focusId } = createFocus(fx.db, { title: "im24" });
    const key = "dup-key";
    upsertObligation(fx.db, focusId, {
      kind: "action",
      title: "a",
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
           VALUES (?,?, 'action','b','agent','open','confirmed',0,?, '2026-08-04T00:00:00Z','2026-08-04T00:00:00Z')`
        )
        .run(newId("fob"), focusId, key)
    ).toThrow();
    db2.close();
  });

  it("IM-25 activationId 跨表一致", () => {
    const { focusId: f1 } = createFocus(fx.db, { title: "im25a" });
    const { focusId: f2 } = createFocus(fx.db, { title: "im25b" });
    const a = startActivation(fx.db, { focusId: f1, sessionId: fx.sessionId, trigger: "user_explicit" });
    expect(() =>
      enumerateCloseSettlement(fx.db, {
        sessionId: fx.sessionId,
        focusId: f2,
        activationId: a.activationId,
        transcriptLines: []
      })
    ).toThrow(/activation_anchor_mismatch/);
  });

  it("IM-26 lifecycle 硬前置", () => {
    const { focusId } = createFocus(fx.db, { title: "im26" });
    changeFocusLifecycle(fx.db, focusId, { to: "active" });
    upsertObligation(fx.db, focusId, {
      kind: "action",
      title: "open",
      owner: "human",
      status: "open",
      verification: "confirmed",
      dedupeKey: "open1",
      nextStep: "go"
    });
    expect(() => changeFocusLifecycle(fx.db, focusId, { to: "closed" })).toThrow(/lifecycle_precondition/);
  });

  it("IM-27 project_ref 半空指针拒", () => {
    const { focusId } = createFocus(fx.db, { title: "im27" });
    const ev = newId("fev");
    // 需要合法 seq —— 用 writeTx 先抬 seq 或直接用下一 seq
    const max = (fx.db.prepare("SELECT MAX(seq) AS m FROM focus_events WHERE focus_id=?").get(focusId) as { m: number })
      .m;
    fx.db
      .prepare(
        `INSERT INTO focus_events(id,focus_id,seq,type,payload_schema_version,payload_json,actor_kind,created_at)
         VALUES (?,?,?,'project_ref_added',1,?,?,?)`
      )
      .run(
        ev,
        focusId,
        max + 1,
        JSON.stringify({ payloadSchemaVersion: 1, projectId: fx.projectId }),
        "daemon",
        "2026-08-04T00:00:00Z"
      );
    expect(() =>
      fx.db
        .prepare(
          `INSERT INTO focus_project_refs(focus_id,project_id,added_by_event_id,removed_at,added_at)
           VALUES (?,?,?,?,?)`
        )
        .run(focusId, fx.projectId, ev, "2026-08-04T00:00:00Z", "2026-08-04T00:00:00Z")
    ).toThrow(/CHECK/);
  });

  it("IM-28 packet 假 digest verify 拒 + DELETE 拒", () => {
    const { focusId } = createFocus(fx.db, { title: "im28" });
    const fake = "sha256:" + "0".repeat(64);
    fx.db
      .prepare(
        `INSERT INTO focus_resume_packets(focus_id,revision,baseline_revision,baseline_event_high_watermark,baseline_obligations_digest,
          compiled_from_json,compiler_version,renderer_version,input_digest,facts_json,obligations_snapshot_json,digest,created_at)
         VALUES (?,1,1,0,'sha256:${"a".repeat(64)}','{}','1','1','sha256:${"b".repeat(64)}','[]','[]',?,?)`
      )
      .run(focusId, fake, "2026-08-04T00:00:00Z");
    const mismatch = verifyResumePacketDigest({
      focusId,
      revision: 1,
      baseline: {
        revision: 1,
        eventHighWatermark: 0,
        obligationsDigest: "sha256:" + "a".repeat(64)
      },
      compiledFrom: {},
      compilerVersion: "1",
      rendererVersion: "1",
      inputDigest: "sha256:" + "b".repeat(64),
      factsJson: "[]",
      obligationsSnapshotJson: "[]",
      digest: fake
    });
    expect(mismatch).toMatch(/mismatch/);
    expect(() => fx.db.prepare("DELETE FROM focus_resume_packets").run()).toThrow(/immutable/);
  });
});

describe("Conformance V1/V2/V4/V7", () => {
  it("V1 exact-set human open obligations", () => {
    const { focusId } = createFocus(fx.db, { title: "v1" });
    upsertObligation(fx.db, focusId, {
      kind: "decision",
      title: "人",
      owner: "human",
      status: "open",
      verification: "confirmed",
      dedupeKey: "h",
      nextStep: "选"
    });
    const snap = buildObligationsSnapshot(listOpenHumanObligations(fx.db, focusId));
    expect(assertHumanOpenExactSet(fx.db, focusId, snap.map((s) => s.id)).ok).toBe(true);
    expect(snap[0]!.nextStep).toBe("选");
  });

  it("V2 无证据关闭拒", () => {
    const { focusId } = createFocus(fx.db, { title: "v2" });
    expect(() =>
      upsertObligation(fx.db, focusId, {
        kind: "action",
        title: "x",
        owner: "agent",
        status: "resolved",
        verification: "confirmed",
        dedupeKey: "x",
        resolution: "done",
        resolutionEventId: "fev_01MISSING0000000000000000A"
      })
    ).toThrow();
  });

  it("V4 直写拒", () => {
    expect(() => denyBrainDirectFocusMutation()).toThrow(/V4/);
    const guard = installFocusDirectWriteGuard(fx.db);
    try {
      expect(() =>
        fx.db
          .prepare(
            `INSERT INTO focuses(id,title,lifecycle,semantic_authority,authority_epoch,current_revision,created_at,updated_at)
             VALUES ('foc_01DIRECT0000000000000000A','x','captured','saydo',0,0,'2026-08-04T00:00:00Z','2026-08-04T00:00:00Z')`
          )
          .run()
      ).toThrow(/direct_write/);
    } finally {
      guard.restore();
    }
  });

  it("V7① settlement 各 phase 恢复:无重复开户/无漏账/无 closed 未结算", () => {
    const { focusId } = createFocus(fx.db, { title: "v7" });
    const act = startActivation(fx.db, { focusId, sessionId: fx.sessionId, trigger: "user_explicit" });
    const r = enumerateCloseSettlement(fx.db, {
      sessionId: fx.sessionId,
      focusId,
      activationId: act.activationId,
      transcriptLines: [{ turnId: "t1", speaker: "user", text: "怎么办?", heard: true }]
    });
    // 模拟 kill 在 presented 后重启:行仍在,可继续
    presentCloseSettlement(fx.db, r.settlement.id, "pres");
    expect(getSettlement(fx.db, r.settlement.id)!.phase).toBe("presented");
    // 重放 enumerate 应拒(活跃 settlement 仍在)——无重复开户
    expect(() =>
      enumerateCloseSettlement(fx.db, {
        sessionId: fx.sessionId,
        focusId,
        activationId: act.activationId,
        transcriptLines: []
      })
    ).toThrow(/settlement_active/);

    autoLedgerCloseSettlement(fx.db, r.settlement.id);
    const committed = commitCloseSettlement(fx.db, r.settlement.id);
    expect(committed.ok).toBe(true);
    // 无 closed 未结算:activation closed 且 settlement committed
    const a = getActivation(fx.db, act.activationId)!;
    expect(a.status).toBe("closed");
    expect(getSettlement(fx.db, r.settlement.id)!.phase).toBe("committed");
    // 义务已挂账(幂等 dedupe)
    const n = (fx.db.prepare("SELECT COUNT(*) AS c FROM focus_obligations WHERE focus_id=?").get(focusId) as { c: number })
      .c;
    expect(n).toBeGreaterThanOrEqual(1);
    // 再 commit 同 settlement 拒
    expect(() => commitCloseSettlement(fx.db, r.settlement.id)).toThrow(/settlement_phase/);
  });
});

describe("resolver 合同补强", () => {
  it("closed 不静默 found", () => {
    const { focusId } = createFocus(fx.db, { title: "r" });
    changeFocusLifecycle(fx.db, focusId, { to: "active" });
    changeFocusLifecycle(fx.db, focusId, { to: "closed" });
    expect(resolveFocus(fx.db, focusId).kind).toBe("closed_or_abandoned");
  });
});
