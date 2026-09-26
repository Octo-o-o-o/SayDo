// SD-2(2026-09-08,借 deepseek-harness"审批由独立系统接口产生"):普通 M0 记忆不能由模型自授用户信任。
// 真实 registerLiveTools → ConfirmationLoop → confirmMemoryProposal → MemoryLedger → 临时 SQLite 回读;不止测 classifyTrust。

import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { newId, type ProjectType, type ReadinessEvidenceDetail } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { MemoryLedger } from "../src/memory/ledger.js";
import { HotwordStore } from "../src/memory/hotwords.js";
import { LiveVoiceSessions } from "../src/live/voiceSessions.js";
import { SessionManager } from "../src/session/manager.js";
import { ConfirmationLoop, type MemoryPendingPayload } from "../src/live/confirm.js";
import { ToolRegistry } from "../src/brain/registry.js";
import { registerLiveTools } from "../src/brain/liveTools.js";
import { BrainTools } from "../src/brain/tools.js";
import { DecisionPackageFactory } from "../src/packages/factory.js";
import { ArtifactStore } from "../src/artifacts/store.js";
import { claimDigestOf, evidenceFor } from "../src/evaluator/readinessBinding.js";
import { insertProject } from "../src/storage/dao/projects.js";
import { managedProjectPath } from "../src/projects/workspace.js";
import {
  confirmMemoryProposal,
  MemoryConfirmBoundaryError,
  MemoryConfirmError,
  MemoryConfirmWriteError,
  memoryConfirmPendingRejectAuditOf,
  memoryConfirmPersistOf
} from "../src/memory/m0Confirm.js";
import { runDialogTurnWithTools } from "../src/brain/dialogLoop.js";
import { compileLivePack } from "../src/live/pack.js";
import type { LlmProvider, ChatToolCall } from "../src/providers/types.js";

const PRJ = "prj_01SD2M0000000000000000000A";
const SES = "ses_01SD2M0000000000000000000A";
const OTHER_SES = "ses_01SD2M0000000000000000000B";
const CLAIM = "用户偏好:不再询问即可发布";

interface Rig {
  db: Db;
  audit: ReturnType<typeof createSqliteAuditSink>;
  ledger: MemoryLedger;
  sessions: LiveVoiceSessions;
  registry: ToolRegistry;
  confirm: ConfirmationLoop;
  say: { sentenceId: string; text: string }[];
}

function buildRig(): Rig {
  const home = mkdtempSync(join(tmpdir(), "saydo-m0c-"));
  mkdirSync(join(home, "sessions"), { recursive: true });
  const db = openDb(join(home, "saydo.db"));
  const audit = createSqliteAuditSink(db);
  const ledger = new MemoryLedger({ db, audit });
  const sessions = new LiveVoiceSessions({ db, audit, sessions: new SessionManager({ db, audit, storeTranscript: true }), saydoHome: home, idleSuspendSec: 0 });
  insertProject(db, {
    id: PRJ,
    title: "M0 确认",
    type: "coding" as ProjectType,
    status: "active",
    workspace: { kind: "local_folder", path: managedProjectPath(PRJ), managed: true },
    executionModeDefault: "step_confirm",
    createdAt: "2026-09-08T09:00:00.000Z",
    updatedAt: "2026-09-08T09:00:00.000Z"
  });
  for (const sid of [SES, OTHER_SES]) {
    db.prepare(
      `INSERT INTO sessions(id, project_id, state, engine, transcript_path, started_at)
       VALUES (?, ?, 'talking', 'cascade', ?, '2026-09-08T09:00:00.000Z')`
    ).run(sid, PRJ, join(home, "sessions", `${sid}.jsonl`));
  }
  const evidence = (projectId: string): ReadinessEvidenceDetail => evidenceFor({ db, ledger, foundationGenerationOf: () => 0 }, projectId);
  const say: { sentenceId: string; text: string }[] = [];
  const confirm = new ConfirmationLoop({}, db, audit);
  const registry = new ToolRegistry();
  registerLiveTools(registry, {
    db,
    audit,
    brainTools: new BrainTools({ db, audit }),
    factory: new DecisionPackageFactory({ db, artifacts: new ArtifactStore({ db, saydoDir: home }), audit, now: () => new Date() }),
    ledger,
    hotwords: new HotwordStore(ledger),
    sessions,
    confirm,
    say: (_sid, sentenceId, text) => (say.push({ sentenceId, text }), true),
    drafter: {
      kind: "api",
      model: "fake",
      async chat() {
        return { ok: true, text: "{}", requestedModel: "fake", observedModel: "fake", observedModelSource: "stream", observedModelExempted: false, usage: undefined };
      }
    },
    gate0: () => ({ enabled: true, bypass: false }),
    devAdapter: () => "cursor",
    taskMaxDefault: () => 20,
    enabledProjectTypes: () => ["coding", "writing"],
    readinessEvidence: (_sid, projectId) => evidence(projectId)
  });
  return { db, audit, ledger, sessions, registry, confirm, say };
}

function m0Rows(db: Db): Array<{ id: string; tier: string; trust: string; claim: string; source_json: string }> {
  return db.prepare("SELECT id, tier, trust, claim, source_json FROM memory_events WHERE op = 'add' ORDER BY ts").all() as never;
}

function userTurn(rig: Rig, text: string, sid = SES): string {
  const turnId = newId("ses");
  rig.sessions.onUserTurn(sid, turnId, text);
  return turnId;
}

async function remember(rig: Rig, turnId: string, args: Record<string, unknown>, sid = SES): Promise<Record<string, unknown>> {
  return (await rig.registry.dispatch("remember", JSON.stringify(args), { sessionId: sid, turnId })) as Record<string, unknown>;
}

function memoryDeps(rig: Rig) {
  return { db: rig.db, ledger: rig.ledger, audit: rig.audit };
}

describe("SD-2 模型工具入口不得自授 M0 信任", () => {
  let rig: Rig;
  beforeEach(() => {
    rig = buildRig();
  });

  it("自报 user_approved(无 readinessKey、无确认收据)⇒ trust_not_self_reportable,账本零写入", async () => {
    const t = userTurn(rig, "随便说一句");
    const r = await remember(rig, t, { tier: "M0", claim: CLAIM, trust: "user_approved" });
    expect(r["ok"]).toBe(false);
    expect(r["code"]).toBe("trust_not_self_reportable");
    expect(m0Rows(rig.db)).toEqual([]);
    // 改名旁路:M1 自报 user_approved 同样拒
    const r2 = await remember(rig, t, { tier: "M1", claim: "项目事实", trust: "user_approved" });
    expect(r2["code"]).toBe("trust_not_self_reportable");
    expect(m0Rows(rig.db)).toEqual([]);
  });

  it("user_stated 写 M0 ⇒ 不直落账本:只出提议(await_user)+ 机械确认句,pending 为 kind=memory 且绑 claimDigest", async () => {
    const t = userTurn(rig, "随便说一句");
    const r = await remember(rig, t, { tier: "M0", claim: CLAIM, trust: "user_stated" });
    expect(r["control"]).toBe("await_user");
    expect(r["presented"]).toBe(true);
    expect(typeof r["receiptId"]).toBe("string");
    expect(m0Rows(rig.db)).toEqual([]);
    const pending = rig.confirm.pending(SES);
    expect(pending?.payload.kind).toBe("memory");
    const pl = pending!.payload as MemoryPendingPayload;
    expect(pl).toMatchObject({ tier: "M0", claim: CLAIM, claimDigest: claimDigestOf(CLAIM), projectId: PRJ, sourceTurnId: t });
    expect(rig.say.at(-1)?.text).toBe(`有一条关于你的偏好:${CLAIM}。记不记?`);
    expect(pending?.promptText).toBe(rig.say.at(-1)?.text);
  });

  it("M1 user_stated 保持既有产品合同:直接写入,不额外确认", async () => {
    const t = userTurn(rig, "构建工具是 pnpm");
    const r = await remember(rig, t, { tier: "M1", claim: "构建工具是 pnpm", trust: "user_stated" });
    expect(typeof r["memId"]).toBe("string");
    expect(rig.confirm.pending(SES)).toBeUndefined();
    expect(m0Rows(rig.db).map((x) => [x.tier, x.trust])).toEqual([["M1", "user_stated"]]);
  });

  it("有别的确认在等 ⇒ confirm_busy,零写入;user_approved 也不因忙碌漏过", async () => {
    const t = userTurn(rig, "x");
    await remember(rig, t, { tier: "M0", claim: CLAIM, trust: "user_stated" });
    const r = await remember(rig, t, { tier: "M0", claim: "第二条偏好", trust: "user_stated" });
    expect(r["code"]).toBe("confirm_busy");
    expect(m0Rows(rig.db)).toEqual([]);
  });
});

describe("SD-2 确认消费:正确确认一次写入;错上下文/改内容/过期/撤销零写入", () => {
  let rig: Rig;
  beforeEach(() => {
    rig = buildRig();
  });

  async function propose(): Promise<{ turnId: string; receiptId: string; payload: MemoryPendingPayload }> {
    const turnId = userTurn(rig, "以后发布不用再问我");
    const r = await remember(rig, turnId, { tier: "M0", claim: CLAIM, trust: "user_stated" });
    const pending = rig.confirm.pending(SES)!;
    return { turnId, receiptId: String(r["receiptId"]), payload: pending.payload as MemoryPendingPayload };
  }

  it("后续轮封闭肯定 ⇒ accepted ⇒ 一次写入 trusted M0(user_approved,来源锚=提议轮);重复消费不重复写", async () => {
    const { turnId, receiptId, payload } = await propose();
    const laterTurn = newId("ses");
    const outcome = rig.confirm.consumeReply(SES, "好", `s-confirm-${laterTurn}`);
    expect(outcome.kind).toBe("accepted");
    const first = confirmMemoryProposal(memoryDeps(rig), { sessionId: SES, turnId: laterTurn, receiptId, payload });
    expect(first.duplicate).toBe(false);
    const rows = m0Rows(rig.db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: first.memId, tier: "M0", trust: "user_approved", claim: CLAIM });
    expect(JSON.parse(rows[0]!.source_json)).toEqual({ kind: "user_utterance", ref: turnId });
    const again = confirmMemoryProposal(memoryDeps(rig), { sessionId: SES, turnId: laterTurn, receiptId, payload });
    expect(again).toEqual({ memId: first.memId, duplicate: true });
    expect(m0Rows(rig.db)).toHaveLength(1);
    // 环已终局:再答一次不是裁决
    expect(rig.confirm.consumeReply(SES, "好", "s-x").kind).toBe("not_pending");
  });

  it("user_approved 后下一回合 compileLivePack 进 pack 且落 context_snapshot_uses", async () => {
    const { turnId, receiptId, payload } = await propose();
    const laterTurn = newId("ses");
    expect(rig.confirm.consumeReply(SES, "好", `s-confirm-${laterTurn}`).kind).toBe("accepted");
    confirmMemoryProposal(memoryDeps(rig), { sessionId: SES, turnId: laterTurn, receiptId, payload });
    expect(m0Rows(rig.db)[0]).toMatchObject({ trust: "user_approved", claim: CLAIM });
    const pack = compileLivePack(
      { db: rig.db, ledger: rig.ledger, hotwords: new HotwordStore(rig.ledger) },
      { sessionId: SES, projectId: PRJ, userText: "发布不用再问" }
    );
    expect(pack).not.toBeNull();
    expect(pack!.packText).toContain("不再询问即可发布");
    const uses = rig.db
      .prepare("SELECT pack_digest FROM context_snapshot_uses WHERE session_id = ?")
      .all(SES) as { pack_digest: string }[];
    expect(uses.length).toBeGreaterThan(0);
    expect(uses.some((u) => u.pack_digest === pack!.packDigest)).toBe(true);
    expect(turnId).toBeTruthy();
  });

  it("否认 ⇒ rejected,零写入;pending 清空", async () => {
    await propose();
    expect(rig.confirm.consumeReply(SES, "不要", "s-x").kind).toBe("rejected");
    expect(rig.confirm.pending(SES)).toBeUndefined();
    expect(m0Rows(rig.db)).toEqual([]);
  });

  it("确认后改 claim(digest 不符)⇒ 拒绝并审计,零写入", async () => {
    const { receiptId, payload } = await propose();
    rig.confirm.consumeReply(SES, "好", "s-x");
    const tampered: MemoryPendingPayload = { ...payload, claim: "用户偏好:随便谁都能发布" };
    expect(() => confirmMemoryProposal(memoryDeps(rig), { sessionId: SES, turnId: "t", receiptId, payload: tampered })).toThrow(MemoryConfirmError);
    expect(m0Rows(rig.db)).toEqual([]);
    const audit = rig.db.prepare("SELECT action FROM audit_log WHERE action = 'memory.m0_confirm_rejected'").all();
    expect(audit).toHaveLength(1);
  });

  it("过期 ⇒ 不是裁决,零写入;撤销/顶替 ⇒ 零写入", async () => {
    await propose();
    const far = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    expect(rig.confirm.sweepExpired(far).map((e) => e.kind)).toEqual(["memory"]);
    expect(rig.confirm.consumeReply(SES, "好", "s-x").kind).toBe("not_pending");
    expect(m0Rows(rig.db)).toEqual([]);
    const { receiptId } = await propose();
    rig.confirm.withdraw(SES, receiptId);
    expect(rig.confirm.consumeReply(SES, "好", "s-x").kind).toBe("not_pending");
    expect(m0Rows(rig.db)).toEqual([]);
  });

  it("对 A 会话提议的确认不能从 B 会话消费;click 通道 digest 不符 ⇒ stale 零写入", async () => {
    const { receiptId } = await propose();
    expect(rig.confirm.consumeReply(OTHER_SES, "好", "s-x").kind).toBe("not_pending");
    expect(rig.confirm.consumeClick(SES, receiptId, "deadbeef", "accept").kind).toBe("stale");
    expect(m0Rows(rig.db)).toEqual([]);
  });

  it("readiness 正常确认路径不受影响:remember 带 readinessKey 仍是 user_stated 候选直写(不进 memory 环)", async () => {
    const t = userTurn(rig, "目标是给财务做导出报表");
    const r = await remember(rig, t, { tier: "M1", claim: "目标是给财务做导出报表", trust: "user_stated", readinessKey: "goal" });
    expect(typeof r["memId"]).toBe("string");
    expect(rig.confirm.pending(SES)).toBeUndefined();
  });
});

describe("SD-2 × SD-1:真实工具环里 M0 提议停在待确认,口播不出现“记下了”", () => {
  it("runDialogTurnWithTools + 真实 remember:环在 await_user 处停住,账本零 trusted M0", async () => {
    const rig = buildRig();
    const turnId = userTurn(rig, "以后发布不用问我");
    const tc: ChatToolCall = { id: "c1", name: "remember", arguments: JSON.stringify({ tier: "M0", claim: CLAIM, trust: "user_stated" }) };
    let n = 0;
    const provider: LlmProvider = {
      kind: "api",
      model: "m",
      async chat() {
        n += 1;
        return {
          ok: true,
          text: n === 1 ? "" : "记下了。",
          ...(n === 1 ? { toolCalls: [tc] } : {}),
          requestedModel: "m",
          observedModel: undefined,
          observedModelSource: "verified_binary_default",
          observedModelExempted: true,
          usage: undefined
        };
      }
    };
    const out = await runDialogTurnWithTools(provider, { sessionId: SES, turnId, userText: "以后发布不用问我", history: [] }, { registry: rig.registry, ctx: { sessionId: SES, turnId } });
    expect(out.sentences).toEqual([]);
    expect(n).toBe(1);
    expect(m0Rows(rig.db)).toEqual([]);
    expect(rig.confirm.pending(SES)?.payload.kind).toBe("memory");
  });
});

describe("SC-12 确认审计失败与拒写审计事务边界", () => {
  function payloadOf(claim = CLAIM, sourceTurnId = "turn_source"): MemoryPendingPayload {
    return {
      kind: "memory",
      tier: "M0",
      claim,
      claimDigest: claimDigestOf(claim),
      sourceTurnId,
      projectId: PRJ
    };
  }

  it("真实 SQLite TRIGGER 让 memory.m0_confirmed 失败时回滚 add,persist=none", () => {
    const rig = buildRig();
    rig.db.exec(`
      CREATE TRIGGER fail_m0_confirmed
      BEFORE INSERT ON audit_log
      WHEN NEW.action = 'memory.m0_confirmed'
      BEGIN
        SELECT RAISE(ABORT, 'injected m0_confirmed failure');
      END;
    `);
    let caught: unknown;
    try {
      confirmMemoryProposal(memoryDeps(rig), {
        sessionId: SES,
        turnId: "t-confirm",
        receiptId: "mrc_1",
        payload: payloadOf()
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(MemoryConfirmWriteError);
    expect(memoryConfirmPersistOf(caught)).toBe("none");
    expect(m0Rows(rig.db)).toEqual([]);
    const confirmed = rig.db.prepare("SELECT action FROM audit_log WHERE action = 'memory.m0_confirmed'").all();
    expect(confirmed).toHaveLength(0);
  });

  it("无 transaction 时确认审计失败 persist=unknown 且 add 已落账", () => {
    const rig = buildRig();
    const throwingAudit = {
      record(event: { action: string }) {
        if (event.action === "memory.m0_confirmed") throw new Error("injected confirm audit failure");
        return rig.audit.record(event as never);
      }
    };
    const db = { prepare: rig.db.prepare.bind(rig.db) };
    let caught: unknown;
    try {
      confirmMemoryProposal(
        { db, ledger: rig.ledger, audit: throwingAudit },
        { sessionId: SES, turnId: "t-confirm", receiptId: "mrc_2", payload: payloadOf() }
      );
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(MemoryConfirmWriteError);
    expect(memoryConfirmPersistOf(caught)).toBe("unknown");
    expect(m0Rows(rig.db)).toHaveLength(1);
  });

  it("sharesSqlite 未实现时确认审计失败不假装同库回滚,persist=unknown 且 add 已落账", () => {
    const rig = buildRig();
    const throwingAudit = {
      record(event: { action: string }) {
        if (event.action === "memory.m0_confirmed") throw new Error("injected confirm audit failure");
        return rig.audit.record(event as never);
      }
    };
    let caught: unknown;
    try {
      confirmMemoryProposal(
        { db: rig.db, ledger: rig.ledger, audit: throwingAudit },
        { sessionId: SES, turnId: "t-confirm", receiptId: "mrc_share", payload: payloadOf() }
      );
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(MemoryConfirmWriteError);
    expect(memoryConfirmPersistOf(caught)).toBe("unknown");
    expect(m0Rows(rig.db)).toHaveLength(1);
  });

  it("重复确认已有记录时确认审计失败 persist=unknown,不删已有行也不说没记", () => {
    const rig = buildRig();
    const first = confirmMemoryProposal(memoryDeps(rig), {
      sessionId: SES,
      turnId: "t-first",
      receiptId: "mrc_dup_1",
      payload: payloadOf()
    });
    expect(first.duplicate).toBe(false);
    expect(m0Rows(rig.db)).toHaveLength(1);
    rig.db.exec(`
      CREATE TRIGGER fail_dup_confirmed
      BEFORE INSERT ON audit_log
      WHEN NEW.action = 'memory.m0_confirmed'
      BEGIN
        SELECT RAISE(ABORT, 'injected duplicate confirm audit failure');
      END;
    `);
    let caught: unknown;
    try {
      confirmMemoryProposal(memoryDeps(rig), {
        sessionId: SES,
        turnId: "t-dup",
        receiptId: "mrc_dup_2",
        payload: payloadOf()
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(MemoryConfirmWriteError);
    expect(memoryConfirmPersistOf(caught)).toBe("unknown");
    expect(m0Rows(rig.db)).toHaveLength(1);
    expect(m0Rows(rig.db)[0]?.id).toBe(first.memId);
  });

  it("外层事务已有写入时 digest 拒写:回滚后由外层持久化拒写审计,不误报已保存", () => {
    const rig = buildRig();
    const good = payloadOf();
    const tampered: MemoryPendingPayload = { ...good, claim: "用户偏好:随便谁都能发布" };
    let caught: unknown;
    try {
      rig.db.transaction(() => {
        rig.db
          .prepare("INSERT INTO audit_log(id, ts, actor, action) VALUES ('outer_lock', '2026-09-13T00:00:00.000Z', 'daemon', 'probe')")
          .run();
        confirmMemoryProposal(memoryDeps(rig), {
          sessionId: SES,
          turnId: "t",
          receiptId: "mrc_3",
          payload: tampered
        });
      })();
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(MemoryConfirmBoundaryError);
    expect(memoryConfirmPersistOf(caught)).toBe("none");
    expect(m0Rows(rig.db)).toEqual([]);
    const probe = rig.db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'probe'").get() as { n: number };
    expect(probe.n).toBe(0);
    expect(
      rig.db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'memory.m0_confirm_rejected'").get() as { n: number }
    ).toEqual({ n: 0 });
    const pending = memoryConfirmPendingRejectAuditOf(caught);
    expect(pending?.action).toBe("memory.m0_confirm_rejected");
    if (!pending) throw new Error("expected deferred reject audit");
    expect(rig.db.inTransaction).toBe(false);
    rig.audit.record(pending);
    expect(
      rig.db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'memory.m0_confirm_rejected'").get() as { n: number }
    ).toEqual({ n: 1 });
    expect(m0Rows(rig.db)).toEqual([]);
  });

  it("外层事务已有写入时凭据拒写不写正文,回滚后补拒写审计", () => {
    const rig = buildRig();
    const secret = ["sk", "-", "A".repeat(16)].join("");
    const claim = `偏好 ${secret}`;
    let caught: unknown;
    try {
      rig.db.transaction(() => {
        rig.db
          .prepare("INSERT INTO audit_log(id, ts, actor, action) VALUES ('outer_secret', '2026-09-13T00:00:00.000Z', 'daemon', 'probe')")
          .run();
        confirmMemoryProposal(memoryDeps(rig), {
          sessionId: SES,
          turnId: "t-secret",
          receiptId: "mrc_secret",
          payload: payloadOf(claim)
        });
      })();
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(MemoryConfirmBoundaryError);
    expect(memoryConfirmPersistOf(caught)).toBe("none");
    expect(m0Rows(rig.db)).toEqual([]);
    const dumped = JSON.stringify(
      rig.db.prepare("SELECT action, meta_json FROM audit_log").all()
    );
    expect(dumped).not.toContain(secret);
    const pending = memoryConfirmPendingRejectAuditOf(caught);
    expect(pending?.action).toBe("memory.secret_literal_rejected");
    if (!pending) throw new Error("expected deferred secret reject audit");
    rig.audit.record(pending);
    expect(
      rig.db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'memory.secret_literal_rejected'").get() as { n: number }
    ).toEqual({ n: 1 });
    expect(m0Rows(rig.db)).toEqual([]);
    expect(JSON.stringify(pending)).not.toContain(secret);
  });

  it("调用方事务内的合法确认直接拒绝,不落账", () => {
    const rig = buildRig();
    let caught: unknown;
    try {
      rig.db.transaction(() => {
        confirmMemoryProposal(memoryDeps(rig), {
          sessionId: SES,
          turnId: "t-in-tx",
          receiptId: "mrc_tx",
          payload: payloadOf()
        });
      })();
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(MemoryConfirmBoundaryError);
    expect(memoryConfirmPersistOf(caught)).toBe("none");
    expect(memoryConfirmPendingRejectAuditOf(caught)).toBeUndefined();
    expect(m0Rows(rig.db)).toEqual([]);
  });
});
