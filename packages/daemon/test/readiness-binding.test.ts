// A3-armed 反例全集(09 §12-15 扩;方案 research/2026-07-28-a3-armed-design.md v1.2 §4;
// Codex 23 B-7)。覆盖:来源完整性四闸 / 确认升格三态 / 证据版本与撤销全枚举 / knowledge 轴
// generation / armed 防御(未注入 gap_critical、无 ready-dims-空路径)/ 重启重建一致。
// 线性化(issue→forget→dispatch 拦)e2e 在 live-wiring 文件(全链剧本设施在那侧)。

import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  READINESS_CHECKLISTS,
  newId,
  readinessEvidenceDigest,
  type ProjectType,
  type ReadinessEvidenceDetail
} from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { MemoryLedger } from "../src/memory/ledger.js";
import { HotwordStore } from "../src/memory/hotwords.js";
import { LiveVoiceSessions } from "../src/live/voiceSessions.js";
import { SessionManager } from "../src/session/manager.js";
import { ConfirmationLoop } from "../src/live/confirm.js";
import { ToolRegistry } from "../src/brain/registry.js";
import { registerLiveTools } from "../src/brain/liveTools.js";
import { BrainTools } from "../src/brain/tools.js";
import { DecisionPackageFactory } from "../src/packages/factory.js";
import { ArtifactStore } from "../src/artifacts/store.js";
import { claimDigestOf, confirmBindings, evidenceFor, listCandidates, renderReadinessChecklist } from "../src/evaluator/readinessBinding.js";
import { assessReadinessSkeleton } from "../src/evaluator/readinessGate.js";
import { insertProject } from "../src/storage/dao/projects.js";
import { managedProjectPath } from "../src/projects/workspace.js";

const PRJ = "prj_01RB0000000000000000000000";
const SES = "ses_01RB0000000000000000000000";

interface Rig {
  db: Db;
  audit: ReturnType<typeof createSqliteAuditSink>;
  ledger: MemoryLedger;
  sessions: LiveVoiceSessions;
  registry: ToolRegistry;
  say: { sentenceId: string; text: string }[];
  confirm: ConfirmationLoop;
  home: string;
  gen: { v: number };
  evidence: (projectId: string) => ReadinessEvidenceDetail;
}

function buildRig(projectType = "coding"): Rig {
  const home = mkdtempSync(join(tmpdir(), "saydo-rbind-"));
  mkdirSync(join(home, "sessions"), { recursive: true });
  const db = openDb(join(home, "saydo.db"));
  const audit = createSqliteAuditSink(db);
  const ledger = new MemoryLedger({ db, audit });
  const sessions = new LiveVoiceSessions({
    db,
    audit,
    sessions: new SessionManager({ db, audit, storeTranscript: true }),
    saydoHome: home,
    idleSuspendSec: 0
  });
  insertProject(db, {
    id: PRJ,
    title: "绑定反例",
    type: projectType as ProjectType,
    status: "active",
    workspace: { kind: "local_folder", path: managedProjectPath(PRJ), managed: true },
    executionModeDefault: "step_confirm",
    createdAt: "2026-07-28T09:00:00.000Z",
    updatedAt: "2026-07-28T09:00:00.000Z"
  });
  db.prepare(
    `INSERT INTO sessions(id, project_id, state, engine, transcript_path, started_at)
     VALUES (?, ?, 'talking', 'cascade', ?, '2026-07-28T09:00:00.000Z')`
  ).run(SES, PRJ, join(home, "sessions", `${SES}.jsonl`));
  const gen = { v: 0 };
  const evidence = (projectId: string): ReadinessEvidenceDetail =>
    evidenceFor({ db, ledger, foundationGenerationOf: () => gen.v }, projectId);
  const say: { sentenceId: string; text: string }[] = [];
  const confirm = new ConfirmationLoop();
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
    say: (_sid, sentenceId, text) => {
      say.push({ sentenceId, text });
      return true;
    },
    // fake 结构化起草(proposeStart 消费;draftPackageSchema 六字段)
    drafter: {
      kind: "api",
      model: "fake-drafter",
      async chat() {
        return {
          ok: true,
          text: JSON.stringify({
            outcomePreview: "导出功能可用",
            inScope: ["导出模块"],
            outOfScope: [],
            acceptance: ["能导出 CSV"],
            plan: [{ seq: 1, step: "实现导出", owner: "ai" }],
            risks: []
          }),
          requestedModel: "fake-drafter",
          observedModel: "fake-drafter",
          observedModelSource: "stream",
          observedModelExempted: false,
          usage: undefined
        };
      }
    },
    gate0: () => ({ enabled: true, bypass: false }),
    devAdapter: () => "cursor",
    taskMaxDefault: () => 20,
    enabledProjectTypes: () => ["coding", "writing"],
    readinessEvidence: (_sid, projectId) => evidence(projectId)
  });
  return { db, audit, ledger, sessions, registry, say, confirm, home, gen, evidence };
}

/** 落一轮用户转写(remember 四闸②的锚)并返回 turnId */
function userTurn(rig: Rig, text: string): string {
  const turnId = newId("ses");
  rig.sessions.onUserTurn(SES, turnId, text);
  return turnId;
}

async function remember(rig: Rig, turnId: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  return (await rig.registry.dispatch("remember", JSON.stringify({ tier: "M2", trust: "user_stated", ...args }), {
    sessionId: SES,
    turnId
  })) as Record<string, unknown>;
}

/** 完整确认链:confirmReadiness 工具(present)→ confirm 环 accepted → confirmBindings 升格 */
async function confirmAll(rig: Rig): Promise<void> {
  const turnId = userTurn(rig, "对");
  const r = (await rig.registry.dispatch("confirmReadiness", "{}", { sessionId: SES, turnId })) as Record<string, unknown>;
  expect(r["presented"]).toBeDefined();
  expect(r["control"]).toBe("await_user");
  const pending = rig.confirm.pending(SES);
  expect(pending?.payload.kind).toBe("readiness");
  const pl = pending!.payload as Extract<NonNullable<typeof pending>["payload"], { kind: "readiness" }>;
  confirmBindings(
    { db: rig.db, audit: rig.audit, snapshotter: null, foundationGenerationOf: () => rig.gen.v },
    { sessionId: SES, turnId, projectId: pl.projectId, receiptId: pending!.receiptId, candidates: pl.candidates }
  );
  rig.confirm.withdraw(SES, pending!.receiptId);
}

describe("§12-15 来源完整性四闸(remember 带 readinessKey)", () => {
  let rig: Rig;
  beforeEach(() => {
    rig = buildRig();
  });

  it("闸①词表:词表外 key 拒;类型不符(coding 项目带 writing key)拒", async () => {
    const t = userTurn(rig, "目标是导出报表");
    const bad = await remember(rig, t, { claim: "目标:导出报表", readinessKey: "not_a_key" });
    expect(bad["code"]).toBe("readiness_key_invalid");
    const wrongType = await remember(rig, t, { claim: "论点", readinessKey: "core_thesis" });
    expect(wrongType["code"]).toBe("readiness_key_invalid");
    const ok = await remember(rig, t, { claim: "目标:导出报表", readinessKey: "goal" });
    expect(ok["memId"]).toMatch(/^mem_/);
  });

  it("pending 项目:pending 词表内 key(rough_goal)通过;coding key 拒", async () => {
    const prig = buildRig("pending");
    const t = userTurn(prig, "想做个导出工具");
    const ok = await remember(prig, t, { claim: "粗目标:导出工具", readinessKey: "rough_goal" });
    expect(ok["memId"]).toMatch(/^mem_/);
    const bad = await remember(prig, t, { claim: "目标", readinessKey: "goal" });
    expect(bad["code"]).toBe("readiness_key_invalid");
  });

  it("闸②转写锚:turnId 无用户转写 ⇒ 拒(store_transcript 弃权/伪造轮同语义)", async () => {
    const r = await remember(rig, newId("ses"), { claim: "目标", readinessKey: "goal" });
    expect(r["code"]).toBe("readiness_key_turn_missing");
  });

  it("闸③信任:带 key 的 remember 传 user_approved 拒(升格只能由确认环产生)", async () => {
    const t = userTurn(rig, "目标是导出报表");
    const r = await remember(rig, t, { claim: "目标", trust: "user_approved", readinessKey: "goal" });
    expect(r["code"]).toBe("readiness_key_trust");
  });

  it("闸④项目:Brain 自报 projectId 被忽略(取会话锚定项目)+ audit 落转写 digest", async () => {
    const t = userTurn(rig, "目标是导出报表");
    const r = await remember(rig, t, { claim: "目标:导出报表", readinessKey: "goal", projectId: "prj_01FAKE0000000000000000000X" });
    const mem = rig.db.prepare("SELECT project_id, readiness_key FROM memory_events WHERE id=?").get(String(r["memId"])) as {
      project_id: string;
      readiness_key: string;
    };
    expect(mem).toEqual({ project_id: PRJ, readiness_key: "goal" });
    const aud = rig.db
      .prepare("SELECT meta_json FROM audit_log WHERE action='memory.readiness_key_bound'")
      .all() as { meta_json: string }[];
    expect(aud).toHaveLength(1);
    const meta = JSON.parse(aud[0]!.meta_json) as Record<string, unknown>;
    expect(meta["turnTextDigest"]).toBeDefined();
    expect(String(meta["projectId"])).toBe(PRJ);
  });
});

describe("§12-15 确认升格三态(candidate 不算覆盖;人在环唯一升格路径)", () => {
  let rig: Rig;
  beforeEach(() => {
    rig = buildRig();
  });

  async function candidateAllCritical(): Promise<void> {
    for (const d of (READINESS_CHECKLISTS.coding ?? []).filter((x) => x.critical)) {
      const t = userTurn(rig, `关于 ${d.label} 我说了`);
      const r = await remember(rig, t, { claim: `${d.label}:已说`, readinessKey: d.key });
      expect(r["memId"]).toBeDefined();
    }
  }

  it("critical 全 candidate(记了没确认)⇒ covered 空 ⇒ 骨架仍 gap_critical", async () => {
    await candidateAllCritical();
    expect(rig.evidence(PRJ).covered).toEqual([]);
    const r = assessReadinessSkeleton(
      { db: rig.db, audit: rig.audit, evidenceProvider: (_s, p) => rig.evidence(p) },
      { sessionId: SES, projectId: PRJ, type: "coding" }
    );
    expect(r.verdict).toBe("gap_critical");
  });

  it("复述确认升格 ⇒ confirmed=verified ⇒ 建议态(非 critical 留空)⇒ isReadinessBlocking=false;渲染锁定形态", async () => {
    await candidateAllCritical();
    const cands = listCandidates({ db: rig.db, ledger: rig.ledger }, PRJ, "coding");
    const text = renderReadinessChecklist(cands);
    expect(text).toContain("我跟你确认几点");
    expect(text).toContain("——都对吗?");
    await confirmAll(rig);
    const cov = rig.evidence(PRJ).covered.sort();
    expect(cov).toEqual(["acceptance", "codebase_understood", "goal", "scope"]);
    const r = assessReadinessSkeleton(
      { db: rig.db, audit: rig.audit, evidenceProvider: (_s, p) => rig.evidence(p) },
      { sessionId: SES, projectId: PRJ, type: "coding" }
    );
    expect(r.verdict).toBe("gap_requirement"); // constraints(非 critical)unknown = 建议态,不阻塞
  });

  it("用户否认 ⇒ 环作废零升格(rejected 分支不落绑定)", async () => {
    await candidateAllCritical();
    const turnId = userTurn(rig, "不对");
    await rig.registry.dispatch("confirmReadiness", "{}", { sessionId: SES, turnId });
    const outcome = rig.confirm.consumeReply(SES, "不对,论点错了", "s-replay");
    expect(outcome.kind).toBe("rejected");
    expect((rig.db.prepare("SELECT COUNT(*) AS c FROM readiness_bindings").get() as { c: number }).c).toBe(0);
    expect(rig.evidence(PRJ).covered).toEqual([]);
  });

  it("同 key 再确认 ⇒ 旧绑定自动 superseded(机械,不靠 prompt)", async () => {
    await candidateAllCritical();
    await confirmAll(rig);
    const t = userTurn(rig, "目标改成搜索功能");
    await remember(rig, t, { claim: "目标:搜索功能", readinessKey: "goal" });
    await confirmAll(rig);
    const rows = rig.db
      .prepare("SELECT superseded_at IS NULL AS active FROM readiness_bindings WHERE key='goal' ORDER BY bound_at, id")
      .all() as { active: number }[];
    expect(rows).toHaveLength(2);
    expect(rows[0]!.active).toBe(0);
    expect(rows[1]!.active).toBe(1);
  });

  it("confirm_busy:有别的确认在等 ⇒ confirmReadiness 拒(单 pending 不变量)", async () => {
    await candidateAllCritical();
    const t1 = userTurn(rig, "第一次");
    await rig.registry.dispatch("confirmReadiness", "{}", { sessionId: SES, turnId: t1 });
    const t2 = userTurn(rig, "再来一次");
    const r = (await rig.registry.dispatch("confirmReadiness", "{}", { sessionId: SES, turnId: t2 })) as Record<string, unknown>;
    expect(r["code"]).toBe("confirm_busy");
  });

  it("零候选 ⇒ confirmReadiness 拒 no_candidates(先采访再确认)", async () => {
    const t = userTurn(rig, "开始吧");
    const r = (await rig.registry.dispatch("confirmReadiness", "{}", { sessionId: SES, turnId: t })) as Record<string, unknown>;
    expect(r["code"]).toBe("no_candidates");
  });
});

describe("§12-15 证据版本与撤销全枚举", () => {
  let rig: Rig;
  beforeEach(async () => {
    rig = buildRig();
    for (const d of (READINESS_CHECKLISTS.coding ?? []).filter((x) => x.critical)) {
      const t = userTurn(rig, `${d.label} 已说明`);
      await remember(rig, t, { claim: `${d.label}:v1`, readinessKey: d.key });
    }
    await confirmAll(rig);
  });

  it("forget(marked)⇒ 底层 claim 非现役 ⇒ key 回 unknown(撤销传导);evidenceDigest 变", async () => {
    const before = readinessEvidenceDigest(rig.evidence(PRJ).bindings);
    const mem = rig.db.prepare("SELECT mem_id FROM readiness_bindings WHERE key='goal' AND superseded_at IS NULL").get() as {
      mem_id: string;
    };
    rig.ledger.invalidate("forget_soft", [mem.mem_id], "用户要求忘掉", "M2", PRJ);
    const ev = rig.evidence(PRJ);
    expect(ev.covered).not.toContain("goal");
    expect(readinessEvidenceDigest(ev.bindings)).not.toBe(before);
  });

  it("invalidate 同语义(不只 forget);supersede(correct 链)同语义;expiry 同语义", async () => {
    const memGoal = (rig.db.prepare("SELECT mem_id FROM readiness_bindings WHERE key='goal' AND superseded_at IS NULL").get() as { mem_id: string })
      .mem_id;
    rig.ledger.invalidate("invalidate", [memGoal], "过时", "M2", PRJ);
    expect(rig.evidence(PRJ).covered).not.toContain("goal");
    // supersede:scope 的 claim 被新 claim 取代(旧退场 ⇒ 绑定非现役)
    const memScope = (rig.db.prepare("SELECT mem_id FROM readiness_bindings WHERE key='scope' AND superseded_at IS NULL").get() as { mem_id: string })
      .mem_id;
    const t = userTurn(rig, "范围换了");
    rig.ledger.add({
      tier: "M2",
      projectId: PRJ,
      claim: "范围:v2",
      source: { kind: "user_utterance", ref: t },
      requestedTrust: "user_stated",
      supersedes: memScope
    });
    expect(rig.evidence(PRJ).covered).not.toContain("scope");
    // expiry:acceptance 的 claim 到期
    const memAcc = (rig.db.prepare("SELECT mem_id FROM readiness_bindings WHERE key='acceptance' AND superseded_at IS NULL").get() as { mem_id: string })
      .mem_id;
    rig.db.prepare("UPDATE memory_events SET expires_at='2000-01-01T00:00:00.000Z' WHERE id=?").run(memAcc);
    expect(rig.evidence(PRJ).covered).not.toContain("acceptance");
  });

  it("同 key 换证(forget A + add B + 再确认)⇒ claimDigest/evidenceDigest 变(A-2 最小绕过链封死)", async () => {
    const before = rig.evidence(PRJ);
    const beforeGoal = before.bindings.find((b) => b.key === "goal")!;
    const memA = (rig.db.prepare("SELECT mem_id FROM readiness_bindings WHERE key='goal' AND superseded_at IS NULL").get() as { mem_id: string })
      .mem_id;
    rig.ledger.invalidate("forget_soft", [memA], "换目标", "M2", PRJ);
    const t = userTurn(rig, "目标改成搜索");
    await remember(rig, t, { claim: "目标:搜索(v2)", readinessKey: "goal" });
    await confirmAll(rig);
    const after = rig.evidence(PRJ);
    expect(after.covered).toContain("goal"); // 前后 covered 集相同……
    const afterGoal = after.bindings.find((b) => b.key === "goal")!;
    expect(afterGoal.claimDigest).not.toBe(beforeGoal.claimDigest); // ……但证据版本必变
    expect(readinessEvidenceDigest(after.bindings)).not.toBe(readinessEvidenceDigest(before.bindings));
    expect(afterGoal.claimDigest).toBe(claimDigestOf("目标:搜索(v2)"));
  });

  it("knowledge 轴 foundation 换代 ⇒ 绑定失效回 unknown;requirement 轴不动", async () => {
    expect(rig.evidence(PRJ).covered).toContain("codebase_understood");
    rig.gen.v = 1; // 奠基换代
    const ev = rig.evidence(PRJ);
    expect(ev.covered).not.toContain("codebase_understood"); // knowledge 轴失效
    expect(ev.covered).toContain("goal"); // requirement 轴不随换代失效
  });

  it("hard-forget 联动清绑定行(review A-1):tombstone 后 readiness_bindings 行为零、covered 回落", () => {
    const mem = (rig.db.prepare("SELECT mem_id FROM readiness_bindings WHERE key='goal' AND superseded_at IS NULL").get() as { mem_id: string })
      .mem_id;
    rig.ledger.forgetHard({
      targets: [mem],
      targetDigests: [claimDigestOf("目标:v1")],
      stores: ["fts", "projection", "summary"],
      tier: "M2",
      projectId: PRJ,
      execute: { fts: () => void 0, projection: () => void 0, summary: () => void 0, backup: () => void 0 }
    });
    const left = (rig.db.prepare("SELECT COUNT(*) AS c FROM readiness_bindings WHERE mem_id=?").get(mem) as { c: number }).c;
    expect(left).toBe(0); // 绑定元数据(claim_digest/turn 锚)不留
    expect(rig.evidence(PRJ).covered).not.toContain("goal");
  });

  it("重启重建:新 ledger 实例(同 db 重放)covered/evidenceDigest 一致", async () => {
    const before = rig.evidence(PRJ);
    const ledger2 = new MemoryLedger({ db: rig.db, audit: rig.audit });
    const after = evidenceFor({ db: rig.db, ledger: ledger2, foundationGenerationOf: () => rig.gen.v }, PRJ);
    expect(after.covered.sort()).toEqual([...before.covered].sort());
    expect(readinessEvidenceDigest(after.bindings)).toBe(readinessEvidenceDigest(before.bindings));
  });
});

describe("§12-15 撤销线性化(Codex 23 A-3;工具链直调)", () => {
  let rig: Rig;

  /** createTask → proposeStart 全链(fake drafter),返回 packageId/revision */
  async function propose(rig2: Rig): Promise<{ packageId: string; revision: number }> {
    const t1 = userTurn(rig2, "帮我做导出功能");
    const created = (await rig2.registry.dispatch("createTask", JSON.stringify({ rawPoints: ["导出功能", "验收:能导出 CSV"] }), {
      sessionId: SES,
      turnId: t1
    })) as Record<string, unknown>;
    expect(created["taskDraftId"]).toBeDefined();
    const proposed = (await rig2.registry.dispatch("proposeStart", JSON.stringify({ taskDraftId: created["taskDraftId"] }), {
      sessionId: SES,
      turnId: t1
    })) as Record<string, unknown>;
    return { packageId: String(proposed["packageId"]), revision: Number(proposed["revision"]) };
  }

  async function coverCritical(rig2: Rig): Promise<void> {
    for (const d of (READINESS_CHECKLISTS.coding ?? []).filter((x) => x.critical)) {
      const t = userTurn(rig2, `${d.label} 已说明`);
      await remember(rig2, t, { claim: `${d.label}:v1`, readinessKey: d.key });
    }
    await confirmAll(rig2);
  }

  beforeEach(async () => {
    rig = buildRig();
    await coverCritical(rig);
  });

  it("issue 预检过 → forget → 用户确认 → dispatch 事务拦 readiness_stale + 收据 voided_by_conflict 终态不可补发 + 零 task", async () => {
    const { packageId, revision } = await propose(rig);
    const t2 = userTurn(rig, "开始吧");
    const issued = (await rig.registry.dispatch(
      "issueDispatchReceipt",
      JSON.stringify({ packageId, revision, decidedVia: "voice", authStrength: "voice_weak" }),
      { sessionId: SES, turnId: t2 }
    )) as Record<string, unknown>;
    expect(issued["receiptId"]).toBeDefined(); // 预检时点证据未变,签发成功
    const receiptId = String(issued["receiptId"]);
    // 窗口内 forget(另一会话/屏幕操作同语义)
    const mem = (rig.db.prepare("SELECT mem_id FROM readiness_bindings WHERE key='goal' AND superseded_at IS NULL").get() as { mem_id: string })
      .mem_id;
    rig.ledger.invalidate("forget_soft", [mem], "目标作废", "M2", PRJ);
    // 用户确认 → accept → dispatch:事务权威点拦截
    const outcome = rig.confirm.consumeReply(SES, "可以", "s-replay");
    expect(outcome.kind).toBe("accepted");
    const { applyReceiptEvent, dispatchApprovedPackage } = await import("../src/brain/liveTools.js").then(async (m) => ({
      dispatchApprovedPackage: m.dispatchApprovedPackage,
      applyReceiptEvent: (await import("../src/approvals/issue.js")).applyReceiptEvent
    }));
    applyReceiptEvent(rig.db, rig.audit, receiptId, { kind: "user_accept" }, () => new Date());
    expect(() =>
      dispatchApprovedPackage(
        {
          db: rig.db,
          audit: rig.audit,
          gate0: () => ({ enabled: true, bypass: false }),
          devAdapter: () => "cursor",
          enabledProjectTypes: () => ["coding", "writing"],
          readinessEvidence: (_s, p) => rig.evidence(p)
        },
        { packageId, revision, mode: "step_confirm", receiptId }
      )
    ).toThrowError(/readiness_stale\(evidence_changed\)/u);
    // 收据终态 voided_by_conflict(不可补发);零 task;audit 有账
    const r = rig.db.prepare("SELECT outcome FROM approvals WHERE id=?").get(receiptId) as { outcome: string };
    expect(r.outcome).toBe("voided_by_conflict");
    expect((rig.db.prepare("SELECT COUNT(*) AS c FROM tasks").get() as { c: number }).c).toBe(0);
    const acts = (rig.db.prepare("SELECT action FROM audit_log WHERE action='dispatch.readiness_stale'").all() as { action: string }[]).length;
    expect(acts).toBe(1);
    // 补发被拒:收据终态,applyReceiptEvent 任何事件都 rejected
    expect(() => applyReceiptEvent(rig.db, rig.audit, receiptId, { kind: "user_accept" }, () => new Date())).toThrowError(/terminal/u);
  });

  it("propose → 拍板间新增覆盖(unknown→verified)⇒ issue 预检拒 readiness_stale(双向漂移;10 #43)", async () => {
    const { packageId, revision } = await propose(rig);
    // 新增覆盖非 critical 项(constraints)
    const t = userTurn(rig, "约束:只动 export 目录");
    await remember(rig, t, { claim: "约束:只动 export 目录", readinessKey: "constraints" });
    await confirmAll(rig);
    const t2 = userTurn(rig, "开始吧");
    const issued = (await rig.registry.dispatch(
      "issueDispatchReceipt",
      JSON.stringify({ packageId, revision, decidedVia: "voice", authStrength: "voice_weak" }),
      { sessionId: SES, turnId: t2 }
    )) as Record<string, unknown>;
    expect(issued["code"]).toBe("readiness_stale");
  });

  it("pending 包带 pending-checklist ref;promote 后拍板 readiness_stale(checklist_changed)⇒ 重组包(A-4 选项②闭环)", async () => {
    const prig = buildRig("pending");
    prig.db.prepare("UPDATE projects SET status='draft' WHERE id=?").run(PRJ); // pending 项目 = draft 态(promote 前置)
    // cover pending 最小清单(type_intent + rough_goal)
    for (const d of READINESS_CHECKLISTS.pending ?? []) {
      const t = userTurn(prig, `${d.label}:说明了`);
      await remember(prig, t, { claim: `${d.label}:v1`, readinessKey: d.key });
    }
    await confirmAll(prig);
    const { packageId, revision } = await propose(prig); // pending 首提案照常出(owner (a) 案),带版本化 ref
    const pkgRow = prig.db.prepare("SELECT body_json FROM decision_packages WHERE id=? AND revision=?").get(packageId, revision) as {
      body_json: string;
    };
    const body = JSON.parse(pkgRow.body_json) as { readinessRef?: { checklistDigest: string } };
    expect(body.readinessRef?.checklistDigest).toBeDefined(); // "proposed 起 ref 必填"无例外
    // promote 转正 ⇒ 清单换代
    const tp = userTurn(prig, "就按编码项目来");
    const promoted = (await prig.registry.dispatch("promoteProject", JSON.stringify({ projectId: PRJ, title: "导出工具", type: "coding" }), {
      sessionId: SES,
      turnId: tp
    })) as Record<string, unknown>;
    expect(promoted["ok"]).toBe(true);
    const t2 = userTurn(prig, "开始吧");
    const issued = (await prig.registry.dispatch(
      "issueDispatchReceipt",
      JSON.stringify({ packageId, revision, decidedVia: "voice", authStrength: "voice_weak" }),
      { sessionId: SES, turnId: t2 }
    )) as Record<string, unknown>;
    expect(issued["code"]).toBe("readiness_stale"); // checklist_changed ⇒ 按新类型清单重新采访重组包
  });
});

describe("§12-15 走查补齐(M2-M4:promote 锚定/forget 通路/自救提示)", () => {
  let rig: Rig;
  beforeEach(() => {
    rig = buildRig();
  });

  it("M2:promoteProject 传非会话锚定项目 ⇒ promote_project_mismatch 拒(四闸④同精神)", async () => {
    const t = userTurn(rig, "转正吧");
    const r = (await rig.registry.dispatch(
      "promoteProject",
      JSON.stringify({ projectId: "prj_01FAKE0000000000000000000X", title: "别的项目", type: "coding" }),
      { sessionId: SES, turnId: t }
    )) as Record<string, unknown>;
    expect(r["code"]).toBe("promote_project_mismatch");
  });

  it("M3:forget 工具(live 通路)——marked + affected 报失效绑定 + covered 回落 + 审计", async () => {
    const t = userTurn(rig, "目标是导出报表");
    const added = await remember(rig, t, { claim: "目标:导出报表", readinessKey: "goal" });
    await confirmAll(rig);
    expect(rig.evidence(PRJ).covered).toContain("goal");
    const t2 = userTurn(rig, "那条目标忘了吧");
    const r = (await rig.registry.dispatch("forget", JSON.stringify({ memId: added["memId"] }), {
      sessionId: SES,
      turnId: t2
    })) as Record<string, unknown>;
    expect(r["state"]).toBe("marked");
    expect((r["affected"] as string[]).length).toBe(1); // 该绑定被点名
    expect(rig.evidence(PRJ).covered).not.toContain("goal"); // 撤销传导
    const bad = (await rig.registry.dispatch("forget", JSON.stringify({ memId: "mem_01X00000000000000000000000" }), {
      sessionId: SES,
      turnId: t2
    })) as Record<string, unknown>;
    expect(bad["code"]).toBe("mem_not_found");
  });

  it("M4:候选未确认时 propose 拒绝消息含 confirmReadiness 自救提示;零候选时指向采访", async () => {
    // 有候选未确认
    const t = userTurn(rig, "目标是导出报表");
    await remember(rig, t, { claim: "目标:导出报表", readinessKey: "goal" });
    const created = (await rig.registry.dispatch("createTask", JSON.stringify({ rawPoints: ["导出", "验收:CSV"] }), {
      sessionId: SES,
      turnId: t
    })) as Record<string, unknown>;
    const denied = (await rig.registry.dispatch("proposeStart", JSON.stringify({ taskDraftId: created["taskDraftId"] }), {
      sessionId: SES,
      turnId: t
    })) as Record<string, unknown>;
    expect(denied["code"]).toBe("readiness_gap_critical");
    expect(String(denied["message"])).toContain("confirmReadiness");
    // 零候选(新 rig)指向采访
    const rig2 = buildRig();
    const t2 = userTurn(rig2, "直接开始");
    const created2 = (await rig2.registry.dispatch("createTask", JSON.stringify({ rawPoints: ["要点", "验收:x"] }), {
      sessionId: SES,
      turnId: t2
    })) as Record<string, unknown>;
    const denied2 = (await rig2.registry.dispatch("proposeStart", JSON.stringify({ taskDraftId: created2["taskDraftId"] }), {
      sessionId: SES,
      turnId: t2
    })) as Record<string, unknown>;
    expect(String(denied2["message"])).toContain("remember");
  });
});

describe("§12-15 armed 防御(Codex 22 ②④)", () => {
  it("provider 未注入(错误组装)⇒ 况② gap_critical 落行——null 旁路不存在", () => {
    const rig = buildRig();
    const r = assessReadinessSkeleton(
      { db: rig.db, audit: rig.audit }, // 不注入 evidenceProvider
      { sessionId: SES, projectId: PRJ, type: "coding" }
    );
    expect(r.verdict).toBe("gap_critical");
    expect(r.blockingCriticals.join(" ")).toContain("not armed");
    const row = rig.db.prepare("SELECT verdict FROM readiness_assessments WHERE id=?").get(r.ref.assessmentId) as { verdict: string };
    expect(row.verdict).toBe("gap_critical");
  });

  it("assessReadiness 工具:零覆盖 ⇒ gap_critical(旧 ready,dims:[] 空回退路径已删)", async () => {
    const rig = buildRig();
    const t = userTurn(rig, "开始吧");
    const r = (await rig.registry.dispatch("assessReadiness", "{}", { sessionId: SES, turnId: t })) as Record<string, unknown>;
    expect(r["verdict"]).toBe("gap_critical");
    expect((r["dims"] as unknown[]).length).toBeGreaterThan(0); // dims 恒骨架全量,绝非空数组
  });
});
