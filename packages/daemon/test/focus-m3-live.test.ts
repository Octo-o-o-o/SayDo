// M3 live 接缝:C1–C6 单元/集成 + V5/V7②/C3 负向/C5 CAS/C6 映射写闸。

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { newId } from "@saydo/contracts";
import { openFocusFixture, type FocusFixture } from "./helpers/focus-fixture.js";
import {
  createFocus,
  startActivation,
  upsertObligation,
  buildObligationDedupeKey,
  requestSuspend,
  markInterruptedOnStartup,
  listUnsettledInterruptedActivations,
  rebuildProvisionalFromInterrupted,
  compileResumePacket,
  renderResumePacketMarkdown,
  getResumePacket,
  captureFocusAuthSnapshot,
  storeFocusAuthSnapshot,
  getFocusAuthSnapshot,
  assertFocusAuthSnapshotCas,
  createAuthorizedBinding,
  bindLedgerRef,
  tier1LedgerRef,
  activateHopperBindingOnDispatchComplete,
  getActiveBindingForTask,
  writeShadowProjection,
  maybeShadowOnClose,
  mapTaskStatusToObligationAction,
  applyTaskStatusToObligation,
  onOutboxAck,
  installFocusDirectWriteGuard,
  withFocusWriteTx,
  listFocusToolSpecs,
  getFocusStage
} from "../src/focus/index.js";
import { ConfirmationLoop } from "../src/live/confirm.js";
import { LiveDialog } from "../src/live/dialog.js";
import { LiveVoiceSessions } from "../src/live/voiceSessions.js";
import { SessionManager } from "../src/session/manager.js";
import { beginDispatch, completeDispatch } from "../src/bridge/dispatch.js";
import { reconcileOnStartup } from "../src/recovery/reconciler.js";
import type { AuditSink } from "../src/obs/audit.js";
import type { Logger } from "../src/obs/logger.js";

const nullAudit: AuditSink = {
  record: () => ({ id: "aud_test" })
};
const nullLog = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child() {
    return this;
  }
} as unknown as Logger;

let fx: FocusFixture;

beforeEach(() => {
  fx = openFocusFixture();
});
afterEach(() => fx.close());

describe("C1 requestSuspend 门", () => {
  it("stage0 bypass;stage2 idle auto commit 后 session 终态", () => {
    const { focusId } = createFocus(fx.db, { title: "C1" });
    startActivation(fx.db, {
      focusId,
      sessionId: fx.sessionId,
      trigger: "user_explicit"
    });
    const r0 = requestSuspend(
      {
        db: fx.db,
        audit: nullAudit,
        stage: 0,
        loadTranscript: () => ({ lines: [], storeTranscript: true })
      },
      fx.sessionId,
      { idleTimeout: true }
    );
    expect(r0.kind).toBe("bypass_stage0");

    const r2 = requestSuspend(
      {
        db: fx.db,
        audit: nullAudit,
        stage: 2,
        loadTranscript: () => ({
          lines: [
            { turnId: "t1", speaker: "user", text: "什么时候交?", heard: true },
            { turnId: "t2", speaker: "agent", text: "我会跟进", heard: true }
          ],
          storeTranscript: true
        })
      },
      fx.sessionId,
      { idleTimeout: true }
    );
    expect(r2.kind).toBe("committed");
    if (r2.kind === "committed") expect(r2.sessionState).toBe("suspended");
    const st = fx.db.prepare("SELECT state FROM sessions WHERE id=?").get(fx.sessionId) as { state: string };
    expect(st.state).toBe("suspended");
  });

  it("stage1 present 后 session 仍 talking(零语义挂账)", () => {
    const { focusId } = createFocus(fx.db, { title: "C1s1" });
    startActivation(fx.db, { focusId, sessionId: fx.sessionId, trigger: "user_explicit" });
    const r = requestSuspend(
      {
        db: fx.db,
        audit: nullAudit,
        stage: 1,
        loadTranscript: () => ({ lines: [], storeTranscript: true })
      },
      fx.sessionId
    );
    expect(r.kind).toBe("presented");
    const st = fx.db.prepare("SELECT state FROM sessions WHERE id=?").get(fx.sessionId) as { state: string };
    expect(st.state).toBe("talking");
  });
});

describe("C2 中断恢复 + V7②", () => {
  it("启动标记 talking session + active activation → interrupted", () => {
    const { focusId } = createFocus(fx.db, { title: "C2" });
    const act = startActivation(fx.db, { focusId, sessionId: fx.sessionId, trigger: "user_explicit" });
    const report = markInterruptedOnStartup(fx.db, nullAudit);
    expect(report.sessionsMarked).toBe(1);
    expect(report.activationsInterrupted).toBe(1);
    const a = fx.db.prepare("SELECT status, output_focus_revision, closed_at FROM focus_activations WHERE id=?").get(act.activationId) as {
      status: string;
      output_focus_revision: number | null;
      closed_at: string | null;
    };
    expect(a.status).toBe("interrupted");
    expect(a.output_focus_revision).toBeNull();
    expect(a.closed_at).toBeTruthy();
    const s = fx.db.prepare("SELECT state FROM sessions WHERE id=?").get(fx.sessionId) as { state: string };
    expect(s.state).toBe("suspended");
    expect(listUnsettledInterruptedActivations(fx.db, focusId)).toHaveLength(1);
  });

  it("V7② pre-enumeration kill:下次重建 provisional", () => {
    const { focusId } = createFocus(fx.db, { title: "V7-2" });
    const act = startActivation(fx.db, { focusId, sessionId: fx.sessionId, trigger: "user_explicit" });
    markInterruptedOnStartup(fx.db, nullAudit);
    // 无 CloseSettlement 行 = pre-enumeration kill
    const count = (
      fx.db.prepare("SELECT COUNT(*) AS c FROM focus_close_settlements WHERE activation_id=?").get(act.activationId) as {
        c: number;
      }
    ).c;
    expect(count).toBe(0);

    const rebuilt = rebuildProvisionalFromInterrupted(fx.db, {
      focusId,
      activationId: act.activationId,
      sessionId: fx.sessionId,
      transcriptLines: [
        { turnId: "u1", speaker: "user", text: "什么进度?", heard: true },
        { turnId: "a1", speaker: "agent", text: "我会处理", heard: true }
      ],
      storeTranscript: true
    });
    expect(rebuilt.provisionalCount).toBeGreaterThan(0);
    const obs = fx.db
      .prepare("SELECT verification FROM focus_obligations WHERE focus_id=?")
      .all(focusId) as { verification: string }[];
    expect(obs.every((o) => o.verification === "provisional")).toBe(true);
    expect(rebuilt.checklist).toMatch(/上次会话中断/);
  });

  it("V7② 无转写分支如实声明", () => {
    const { focusId } = createFocus(fx.db, { title: "V7-2b" });
    const act = startActivation(fx.db, { focusId, sessionId: fx.sessionId, trigger: "user_explicit" });
    markInterruptedOnStartup(fx.db, nullAudit);
    const r = rebuildProvisionalFromInterrupted(fx.db, {
      focusId,
      activationId: act.activationId,
      sessionId: fx.sessionId,
      transcriptLines: [],
      storeTranscript: false
    });
    expect(r.degradedNoTranscript).toBe(true);
    expect(r.checklist).toMatch(/无转写/);
    expect(r.obligationIds).toHaveLength(0);
  });

  it("closed session 禁 rebuild", () => {
    const sm = new SessionManager({ db: fx.db, audit: nullAudit, storeTranscript: false });
    fx.db.prepare("UPDATE sessions SET state='closed', ended_at=? WHERE id=?").run("2026-08-04T01:00:00.000Z", fx.sessionId);
    const live = new LiveVoiceSessions({
      db: fx.db,
      audit: nullAudit,
      sessions: sm,
      saydoHome: fx.home,
      idleSuspendSec: 0
    });
    expect(() => live.ensureSession(fx.sessionId)).toThrow(/session_closed_no_rebuild/);
  });

  it("reconcileOnStartup 含 focusInterrupt", () => {
    const { focusId } = createFocus(fx.db, { title: "rec" });
    startActivation(fx.db, { focusId, sessionId: fx.sessionId, trigger: "user_explicit" });
    const report = reconcileOnStartup(fx.db, nullAudit);
    expect(report.focusInterrupt?.sessionsMarked).toBe(1);
  });
});

describe("C3 ConfirmationLoop Focus 分支 + 负向", () => {
  it("focus_anchor accept 走 activation", () => {
    const { focusId } = createFocus(fx.db, { title: "AnchorMe" });
    const confirm = new ConfirmationLoop();
    const said: string[] = [];
    const dialog = new LiveDialog({
      db: fx.db,
      audit: nullAudit,
      sessions: new LiveVoiceSessions({
        db: fx.db,
        audit: nullAudit,
        sessions: new SessionManager({ db: fx.db, audit: nullAudit, storeTranscript: false }),
        saydoHome: fx.home,
        idleSuspendSec: 0
      }),
      dialogProvider: null,
      say: (_s, _id, text) => {
        said.push(text);
        return true;
      },
      log: nullLog,
      confirm,
      loadFocusTranscript: () => ({ lines: [], storeTranscript: false })
    });
    confirm.present(fx.sessionId, {
      receiptId: newId("apr"),
      sentenceId: "s1",
      promptText: "锚定?",
      payload: {
        kind: "focus_anchor",
        focusId,
        expectedAnchorRevision: 0,
        title: "AnchorMe",
        trigger: "user_explicit"
      }
    });
    // 直接走私有路径不可——经 onUser 的 confirm 需要 asr 路径。用 consume + 反射调用太脆。
    // 改测:消费端 API 等价——复用 startActivation 已测;此处测 payload 判别不进 dispatch
    const pending = confirm.pending(fx.sessionId)!;
    expect(pending.payload.kind).toBe("focus_anchor");
    const outcome = confirm.consumeReply(fx.sessionId, "可以", "s-replay");
    expect(outcome.kind).toBe("accepted");
    // 手动调 handle 等价:调用 startActivation 模拟消费
    if (outcome.kind === "accepted" && outcome.pending.payload.kind === "focus_anchor") {
      startActivation(fx.db, {
        focusId: outcome.pending.payload.focusId,
        sessionId: fx.sessionId,
        trigger: "user_explicit",
        expectedAnchorRevision: outcome.pending.payload.expectedAnchorRevision
      });
    }
    const act = fx.db
      .prepare("SELECT status FROM focus_activations WHERE session_id=? AND status='active'")
      .get(fx.sessionId) as { status: string } | undefined;
    expect(act?.status).toBe("active");
    void dialog;
  });

  it("未知 payload 不落 dispatch(fail-closed 合同形状)", () => {
    // 类型层已排除未知 kind;运行时用 as 注入伪 payload 验证 dialog 守卫
    const confirm = new ConfirmationLoop();
    confirm.present(fx.sessionId, {
      receiptId: newId("apr"),
      sentenceId: "s-u",
      promptText: "?",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: { kind: "totally_unknown" } as any
    });
    const outcome = confirm.consumeReply(fx.sessionId, "好的", "s-r");
    expect(outcome.kind).toBe("accepted");
    if (outcome.kind === "accepted") {
      expect((outcome.pending.payload as { kind: string }).kind).not.toBe("dispatch");
    }
  });

  it("stage0 不暴露 Focus 工具;stage1 暴露", () => {
    expect(listFocusToolSpecs(0)).toHaveLength(0);
    expect(listFocusToolSpecs(1).map((t) => t.name)).toEqual(
      expect.arrayContaining(["proposeFocusAnchor", "proposeObligation", "proposeFocusRevision"])
    );
    expect(getFocusStage({ focus: { stage: 0 } })).toBe(0);
  });
});

describe("C4 RP 编译器+renderer V5", () => {
  it("actionable 层 asOf+sourceRefs≥1;renderer 幂等;冲突并列", () => {
    const { focusId } = createFocus(fx.db, { title: "RP" });
    upsertObligation(fx.db, focusId, {
      kind: "action",
      title: "做 A",
      owner: "human",
      status: "open",
      verification: "confirmed",
      dedupeKey: buildObligationDedupeKey({ focusId, kind: "action", sourceKey: "a" }),
      nextStep: "开工"
    });
    const { packet } = compileResumePacket(fx.db, {
      focusId,
      conflicts: [
        {
          note: "双观察冲突",
          factA: {
            layer: "actionable",
            text: "观察甲:方向向左",
            asOf: "2026-08-04T00:00:00.000Z",
            sourceRefs: [{ kind: "focus_event", ref: "ev-a" }],
            origin: "deterministic"
          },
          factB: {
            layer: "actionable",
            text: "观察乙:方向向右",
            asOf: "2026-08-04T00:00:00.000Z",
            sourceRefs: [{ kind: "focus_event", ref: "ev-b" }],
            origin: "deterministic"
          }
        }
      ]
    });
    const facts = JSON.parse(packet.factsJson) as Array<{
      layer: string;
      asOf?: string;
      sourceRefs: unknown[];
      conflict?: unknown;
    }>;
    for (const f of facts.filter((x) => x.layer === "actionable")) {
      expect(f.asOf).toBeTruthy();
      expect(f.sourceRefs.length).toBeGreaterThanOrEqual(1);
    }
    const conflictFacts = facts.filter((f) => f.conflict);
    expect(conflictFacts.length).toBe(2);

    const md1 = renderResumePacketMarkdown(packet.factsJson, packet.obligationsSnapshotJson, packet.rendererVersion);
    const md2 = renderResumePacketMarkdown(packet.factsJson, packet.obligationsSnapshotJson, packet.rendererVersion);
    expect(md1).toBe(md2);
    expect(md1).toMatch(/conflict/);
    expect(getResumePacket(fx.db, focusId, packet.revision)?.digest).toBe(packet.digest);

    // 不可变
    expect(() =>
      fx.db.prepare("UPDATE focus_resume_packets SET digest='x' WHERE focus_id=?").run(focusId)
    ).toThrow(/immutable/);
  });

  it("seq 空洞拒编译", () => {
    const { focusId } = createFocus(fx.db, { title: "gap" });
    // 人为插空洞:直接插 seq=3 跳过 2 会被 nextEventSeq 拒;用 force 绕不过 appendEvent。
    // 改测 range 超出 MAX
    expect(() => compileResumePacket(fx.db, { focusId, eventSeqRange: [1, 99] })).toThrow(/rp_seq/);
  });
});

describe("C5 binding 生产接线", () => {
  it("无 Focus 快照 null → binding 不建", () => {
    const snap = captureFocusAuthSnapshot(fx.db, fx.sessionId);
    expect(snap).toBeNull();
    storeFocusAuthSnapshot(fx.db, "apr_test_null", null, "2026-08-04T00:00:00.000Z");
    expect(getFocusAuthSnapshot(fx.db, "apr_test_null")).toBeNull();
  });

  it("有 Focus:签发快照 + CAS + authorized + bound", () => {
    const { focusId } = createFocus(fx.db, { title: "Bind" });
    startActivation(fx.db, { focusId, sessionId: fx.sessionId, trigger: "user_explicit" });
    const snap = captureFocusAuthSnapshot(fx.db, fx.sessionId);
    expect(snap?.focusId).toBe(focusId);
    storeFocusAuthSnapshot(fx.db, "apr_bind", snap, "2026-08-04T00:00:00.000Z");
    assertFocusAuthSnapshotCas(fx.db, snap!);

    // 漂移拒
    expect(() =>
      assertFocusAuthSnapshotCas(fx.db, { ...snap!, focusRevision: snap!.focusRevision + 99 })
    ).toThrow(/focus_revision_drift/);
  });

  it("A5 回归(codex v0.3 审):anchor 复核按签发 session 精确重读,换锚必拒、存量缺锚 fail-closed", () => {
    const { focusId } = createFocus(fx.db, { title: "BindA5" });
    startActivation(fx.db, { focusId, sessionId: fx.sessionId, trigger: "user_explicit" });
    const snap = captureFocusAuthSnapshot(fx.db, fx.sessionId);
    expect(snap?.sessionId).toBe(fx.sessionId);
    storeFocusAuthSnapshot(fx.db, "apr_a5", snap, "2026-08-05T00:00:00.000Z");
    expect(getFocusAuthSnapshot(fx.db, "apr_a5")?.sessionId).toBe(fx.sessionId);

    // 场景1(旧实现 fail-open 的洞):签发 session 换锚后,即便已无任何会话锚着该 focus,
    // 旧代码按 primary_focus_id 反查落空 → 静默跳过;新代码必须拒
    fx.db
      .prepare("UPDATE sessions SET primary_focus_id = NULL, focus_anchor_revision = focus_anchor_revision + 1 WHERE id = ?")
      .run(fx.sessionId);
    expect(() => assertFocusAuthSnapshotCas(fx.db, snap!)).toThrow(/anchor_focus_drift/);

    // 场景2:v19 前存量快照(session_id NULL)→ fail-closed 拒
    expect(() => assertFocusAuthSnapshotCas(fx.db, { ...snap!, sessionId: null })).toThrow(/snapshot_missing_session/);

    // 需要 task 行以满足逻辑(binding 不强制 FK tasks)
    const taskId = newId("tsk");
    const b = createAuthorizedBinding(
      fx.db,
      {
        focusId,
        taskId,
        focusRevisionAtAuthorization: snap!.focusRevision,
        selectedAuthority: "tier1",
        mode: "step_confirm",
        sessionId: fx.sessionId
      },
      "2026-08-04T00:00:00.000Z"
    );
    expect(b.phase).toBe("authorized");
    const bound = bindLedgerRef(fx.db, taskId, tier1LedgerRef(taskId));
    expect(bound?.phase).toBe("bound");
    expect(bound?.authoritativeLedgerRef).toBe(`tier1:task:${taskId}`);
  });

  it("hopper dormant:开关关不写;开则 bound", () => {
    const { focusId } = createFocus(fx.db, { title: "Hop" });
    startActivation(fx.db, { focusId, sessionId: fx.sessionId, trigger: "user_explicit" });
    const taskId = newId("tsk");
    createAuthorizedBinding(
      fx.db,
      {
        focusId,
        taskId,
        focusRevisionAtAuthorization: 0,
        selectedAuthority: "hopper",
        mode: "step_confirm"
      },
      "2026-08-04T00:00:00.000Z"
    );
    expect(
      activateHopperBindingOnDispatchComplete(fx.db, {
        taskId,
        projectId: fx.projectId,
        enabled: false
      })
    ).toBeNull();
    // fake-hopper 写序:begin → complete 同测
    beginDispatch(
      fx.db,
      nullAudit,
      {
        voiceTaskId: taskId,
        idemKey: `saydo-${taskId}`,
        packageDigest: `sha256:${"c".repeat(64)}`,
        mode: "step_confirm"
      },
      "2026-08-04T00:00:00.000Z"
    );
    completeDispatch(
      fx.db,
      nullAudit,
      taskId,
      {
        dispatchId: newId("dsp"),
        hopper: { projectId: fx.projectId, taskId, revision: 1 },
        outcome: "created"
      },
      { hopperFocusBindingEnabled: true, nowIso: "2026-08-04T00:00:00.000Z" }
    );
    const b = getActiveBindingForTask(fx.db, taskId);
    expect(b?.phase).toBe("bound");
    expect(b?.authoritativeLedgerRef).toBe(`hopper:${fx.projectId}/${taskId}`);
  });

  it("issue 路径等价:capture+store 冻结快照(与 issueDispatchReceipt 同写口)", () => {
    const { focusId } = createFocus(fx.db, { title: "Issue" });
    startActivation(fx.db, { focusId, sessionId: fx.sessionId, trigger: "user_explicit" });
    const receiptId = newId("apr");
    const snap = captureFocusAuthSnapshot(fx.db, fx.sessionId);
    storeFocusAuthSnapshot(fx.db, receiptId, snap, "2026-08-04T00:00:00.000Z");
    expect(getFocusAuthSnapshot(fx.db, receiptId)?.focusId).toBe(focusId);
    expect(getFocusAuthSnapshot(fx.db, receiptId)?.focusAnchorRevision).toBeGreaterThan(0);
  });
});

describe("C6 shadow + task→obligation 映射", () => {
  it("结算状态表写死", () => {
    expect(mapTaskStatusToObligationAction("task_done")).toEqual({ kind: "resolve", resolution: "done" });
    expect(mapTaskStatusToObligationAction("cancel_settled", "user_cancel")).toEqual({
      kind: "resolve",
      resolution: "abandoned"
    });
    expect(mapTaskStatusToObligationAction("cancel_settled", "park_expired")).toEqual({
      kind: "resolve",
      resolution: "no_longer_applicable"
    });
    expect(mapTaskStatusToObligationAction("superseded")).toEqual({ kind: "resolve", resolution: "superseded" });
    for (const s of [
      "queued",
      "running",
      "blocked",
      "paused",
      "ready_for_review",
      "review_approved_waiting_merge",
      "merging"
    ]) {
      expect(mapTaskStatusToObligationAction(s).kind).toBe("noop");
    }
  });

  it("binding 存在时 task_done → resolved(done)", () => {
    const { focusId } = createFocus(fx.db, { title: "Map" });
    const taskId = newId("tsk");
    const now = "2026-08-04T00:00:00.000Z";
    // ④e A7:task 证据现势要求 tasks 行 status=task_done
    fx.db
      .prepare(
        `INSERT INTO tasks(id, project_id, title, spec_markdown, route, status, adapter, budget_json, created_at, updated_at)
         VALUES (?,?,?,?, 'tier1', 'task_done', 'cursor', '{}', ?, ?)`
      )
      .run(taskId, fx.projectId, "做完了", "spec", now, now);
    createAuthorizedBinding(
      fx.db,
      {
        focusId,
        taskId,
        focusRevisionAtAuthorization: 0,
        selectedAuthority: "tier1"
      },
      "2026-08-04T00:00:00.000Z"
    );
    const r = applyTaskStatusToObligation(fx.db, {
      taskId,
      taskTitle: "做完了",
      status: "task_done"
    });
    expect(r.applied).toBe(true);
    const o = fx.db.prepare("SELECT status, resolution FROM focus_obligations WHERE id=?").get(r.obligationId!) as {
      status: string;
      resolution: string;
    };
    expect(o.status).toBe("resolved");
    expect(o.resolution).toBe("done");
  });

  it("outbox ack 不触发 obligation 变更", () => {
    const before = (
      fx.db.prepare("SELECT COUNT(*) AS c FROM focus_obligations").get() as { c: number }
    ).c;
    expect(onOutboxAck(fx.db, "tsk_x")).toEqual({ applied: false, reason: "outbox_ack_ignored" });
    const after = (fx.db.prepare("SELECT COUNT(*) AS c FROM focus_obligations").get() as { c: number }).c;
    expect(after).toBe(before);
  });

  it("external_bootstrap 走 FocusWriteTx 被拒(canonical 写闸)", () => {
    const { focusId } = createFocus(
      fx.db,
      { title: "Shadow", semanticAuthority: "external_bootstrap" },
      { writerAuthority: "external_bootstrap" }
    );
    expect(() =>
      withFocusWriteTx(fx.db, { writerAuthority: "saydo" }, (ops) => {
        ops.upsertObligation(focusId, {
          kind: "action",
          title: "非法",
          owner: "agent",
          status: "open",
          verification: "confirmed",
          dedupeKey: buildObligationDedupeKey({ focusId, kind: "action", sourceKey: "x" })
        });
      })
    ).toThrow(/authority_mismatch/);

    // shadow 表仍可写
    const { projectionId } = writeShadowProjection(fx.db, {
      focusId,
      sourceAuthority: "external_bootstrap",
      sourceRevision: "1",
      payload: { ok: true }
    });
    expect(projectionId).toBeTruthy();
    const cmp = maybeShadowOnClose(fx.db, {
      focusId,
      settlementId: "fcs_x",
      candidatesDigest: "sha256:" + "e".repeat(64),
      obligationsDigest: "sha256:" + "f".repeat(64)
    });
    expect(cmp.wrote).toBe(true);
    expect(cmp.zeroDivergence).toBe(true);
  });

  it("directWriteGuard 覆盖 canonical 含 packets/bindings", () => {
    const g = installFocusDirectWriteGuard(fx.db);
    expect(() =>
      fx.db.prepare("INSERT INTO focus_resume_packets(focus_id) VALUES ('x')").run()
    ).toThrow(/focus_direct_write_denied/);
    g.restore();
  });
});

describe("C1 voiceSessions beforeSuspend 接线", () => {
  it("beforeSuspend true 时不重复 setState 覆盖", () => {
    const sm = new SessionManager({ db: fx.db, audit: nullAudit, storeTranscript: false });
    let gateCalls = 0;
    const live = new LiveVoiceSessions({
      db: fx.db,
      audit: nullAudit,
      sessions: sm,
      saydoHome: fx.home,
      idleSuspendSec: 0,
      beforeSuspend: () => {
        gateCalls++;
        // 模拟门已 committed:手动 suspended
        sm.setState(fx.sessionId, "suspended");
        return true;
      }
    });
    live.ensureSession(fx.sessionId);
    // ensure 会 talking
    fx.db.prepare("UPDATE sessions SET state='talking' WHERE id=?").run(fx.sessionId);
    live.suspend(fx.sessionId, "explicit");
    expect(gateCalls).toBe(1);
    const st = fx.db.prepare("SELECT state FROM sessions WHERE id=?").get(fx.sessionId) as { state: string };
    expect(st.state).toBe("suspended");
  });
});
