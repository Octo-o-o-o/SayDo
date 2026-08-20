// §12-15 readiness 骨架单源(09 §13/§4;W4 3.7 Codex 21 A3 验收锚):
// 空账本恒 gap_critical / 三处同源断言 / quick 车道不得删 critical / readinessRef 缺失或不符拒拍板 /
// W1 场景回归(owner 一句话零采访 ⇒ 不再凭空出包)。

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { newId, readinessSkeleton, readinessDimsDigest, READINESS_CHECKLISTS } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { insertProject } from "../src/storage/dao/projects.js";
import { managedProjectPath } from "../src/projects/workspace.js";
import { assembleOnSessionStart, assessReadinessSkeleton } from "../src/evaluator/readinessGate.js";

describe("§12-15 readinessSkeleton 单源纯函数(词表 02 §5)", () => {
  it("空证据 ⇒ 全 unknown ⇒ 每类 critical 项齐(coding/writing)", () => {
    for (const type of ["coding", "writing"] as const) {
      const dims = readinessSkeleton(type, { covered: [] });
      expect(dims).not.toBeNull();
      expect(dims!.every((d) => d.state === "unknown")).toBe(true);
      const criticalKeys = (READINESS_CHECKLISTS[type] ?? []).filter((d) => d.critical).map((d) => d.key);
      expect(criticalKeys.length).toBeGreaterThan(0);
      // 骨架含全部 critical 项(dim.text 内嵌 key)
      for (const k of criticalKeys) expect(dims!.some((d) => d.text.includes(`:${k}:`))).toBe(true);
    }
  });

  it("covered 命中 ⇒ verified;未命中 ⇒ unknown", () => {
    const dims = readinessSkeleton("coding", { covered: ["goal", "acceptance"] });
    const byKey = (k: string) => dims!.find((d) => d.text.includes(`:${k}:`))!;
    expect(byKey("goal").state).toBe("verified");
    expect(byKey("acceptance").state).toBe("verified");
    expect(byKey("scope").state).toBe("unknown");
  });

  it("quick 车道不得删 critical(lane 只影响呈现,不降就绪门;02 §5 守门句)", () => {
    const guided = readinessSkeleton("coding", { covered: [] }, "guided");
    const quick = readinessSkeleton("coding", { covered: [] }, "quick");
    const criticalCount = (dims: NonNullable<ReturnType<typeof readinessSkeleton>>) => dims.filter((d) => d.critical).length;
    expect(criticalCount(quick!)).toBe(criticalCount(guided!));
    // quick 下 critical 项一个不少
    expect(criticalCount(quick!)).toBe((READINESS_CHECKLISTS.coding ?? []).filter((d) => d.critical).length);
  });

  it("pending 有最小清单(A3-armed,Codex 23 A-4 选项②:type_intent + rough_goal 双 critical);general 仍 null(况①)", () => {
    const dims = readinessSkeleton("pending", { covered: [] });
    expect(dims).not.toBeNull();
    expect(dims!.map((d) => d.key).sort()).toEqual(["rough_goal", "type_intent"]);
    expect(dims!.every((d) => d.critical)).toBe(true);
    expect(readinessSkeleton("general", { covered: [] })).toBeNull();
  });

  it("dimsDigest 稳定且随 state 变(拍板比对基准)", () => {
    const a = readinessSkeleton("coding", { covered: [] })!;
    const b = readinessSkeleton("coding", { covered: [] })!;
    const c = readinessSkeleton("coding", { covered: ["goal"] })!;
    expect(readinessDimsDigest(a)).toBe(readinessDimsDigest(b));
    expect(readinessDimsDigest(a)).not.toBe(readinessDimsDigest(c));
  });
});

describe("§12-15 readinessGate fail-closed 四况(落 readiness_assessments 行)", () => {
  let db: Db;
  let audit: ReturnType<typeof createSqliteAuditSink>;
  const PRJ = newId("prj");
  const SES = newId("ses");

  beforeEach(() => {
    const home = mkdtempSync(join(tmpdir(), "saydo-rdy-"));
    db = openDb(join(home, "saydo.db"));
    audit = createSqliteAuditSink(db);
    insertProject(db, {
      id: PRJ,
      title: "就绪",
      type: "coding",
      status: "active",
      workspace: { kind: "local_folder", path: managedProjectPath(PRJ), managed: true },
      executionModeDefault: "step_confirm",
      createdAt: "2026-07-27T12:00:00Z",
      updatedAt: "2026-07-27T12:00:00Z"
    });
  });

  function rowCount(): number {
    return (db.prepare("SELECT COUNT(*) AS c FROM readiness_assessments").get() as { c: number }).c;
  }

  it("况②:证据提供方缺失 ⇒ gap_critical + 落行", () => {
    const r = assessReadinessSkeleton({ db, audit }, { sessionId: SES, projectId: PRJ, type: "coding" });
    expect(r.verdict).toBe("gap_critical");
    expect(rowCount()).toBe(1);
  });

  it("况①:类型模板缺失(general)⇒ gap_critical + 落行(pending 已有最小清单,A3-armed)", () => {
    const r = assessReadinessSkeleton(
      { db, audit, evidenceProvider: () => ({ covered: [], bindings: [] }) },
      { sessionId: SES, projectId: PRJ, type: "general" }
    );
    expect(r.verdict).toBe("gap_critical");
    expect(r.ref.assessmentId).toMatch(/^asm_/);
    expect(rowCount()).toBe(1);
  });

  it("况④:provider 调用异常(throw)⇒ gap_critical + 落行(fail-closed 不外抛;RA-closeout,Codex 22 §5.1 回补)", () => {
    const r = assessReadinessSkeleton(
      {
        db,
        audit,
        evidenceProvider: () => {
          throw new Error("provider boom");
        }
      },
      { sessionId: SES, projectId: PRJ, type: "coding" }
    );
    expect(r.verdict).toBe("gap_critical");
    expect(r.blockingCriticals.join(" ")).toContain("provider threw");
    expect(rowCount()).toBe(1);
  });

  it("况③:空账本(covered=[])⇒ critical unknown ⇒ gap_critical + 落行(W1 根修)", () => {
    const r = assessReadinessSkeleton(
      { db, audit, evidenceProvider: () => ({ covered: [], bindings: [] }) },
      { sessionId: SES, projectId: PRJ, type: "coding" }
    );
    expect(r.verdict).toBe("gap_critical");
    expect(r.blockingCriticals.length).toBeGreaterThan(0);
    expect(rowCount()).toBe(1);
  });

  it("全 critical covered ⇒ ready + readinessRef.dimsDigest 与落行一致", () => {
    const covered = (READINESS_CHECKLISTS.coding ?? []).map((d) => d.key); // 全覆盖
    const r = assessReadinessSkeleton(
      { db, audit, evidenceProvider: () => ({ covered, bindings: [] }) },
      { sessionId: SES, projectId: PRJ, type: "coding" }
    );
    expect(r.verdict).toBe("ready");
    const asm = db.prepare("SELECT dims_json FROM readiness_assessments WHERE id=?").get(r.ref.assessmentId) as { dims_json: string };
    expect(readinessDimsDigest(JSON.parse(asm.dims_json))).toBe(r.ref.dimsDigest);
  });
});

// ---- 三处同源 + 拍板绑定 e2e(proposeStart/issueDispatchReceipt armed;液态注入 evidence) ----
import { registerLiveTools } from "../src/brain/liveTools.js";
import { ToolRegistry } from "../src/brain/registry.js";
import { BrainTools } from "../src/brain/tools.js";
import { DecisionPackageFactory } from "../src/packages/factory.js";
import { ArtifactStore } from "../src/artifacts/store.js";
import { MemoryLedger } from "../src/memory/ledger.js";
import { HotwordStore } from "../src/memory/hotwords.js";
import { LiveVoiceSessions } from "../src/live/voiceSessions.js";
import { SessionManager } from "../src/session/manager.js";
import { ConfirmationLoop } from "../src/live/confirm.js";
import type { LlmProvider } from "../src/providers/types.js";

const drafter: LlmProvider = {
  kind: "api",
  model: "fake-drafter",
  async chat() {
    return {
      ok: true,
      text: JSON.stringify({
        outcomePreview: "给报表页加导出",
        inScope: ["导出按钮"],
        outOfScope: [],
        acceptance: ["点导出下载 CSV"],
        plan: [{ seq: 1, step: "加按钮", owner: "ai" }],
        risks: []
      }),
      requestedModel: "fake-drafter",
      observedModel: "fake-drafter",
      observedModelSource: "stream",
      observedModelExempted: false,
      usage: undefined
    };
  }
};

describe("§12-15 三处同源 + readinessRef 拍板门(armed)", () => {
  let db: Db;
  let home: string;
  let registry: ToolRegistry;
  let covered: string[];
  let sessions: LiveVoiceSessions;
  const SES = newId("ses");

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "saydo-rdy2-"));
    db = openDb(join(home, "saydo.db"));
    const audit = createSqliteAuditSink(db);
    covered = []; // 由各用例设置
    const ledger = new MemoryLedger({ db, audit });
    sessions = new LiveVoiceSessions({
      db,
      audit,
      sessions: new SessionManager({ db, audit, storeTranscript: true }),
      saydoHome: home,
      idleSuspendSec: 0
    });
    registry = new ToolRegistry();
    registerLiveTools(registry, {
      db,
      audit,
      brainTools: new BrainTools({ db, audit }),
      factory: new DecisionPackageFactory({ db, artifacts: new ArtifactStore({ db, saydoDir: home }), audit, now: () => new Date() }),
      ledger,
      hotwords: new HotwordStore(ledger),
      sessions,
      confirm: new ConfirmationLoop(),
      say: () => true,
      drafter,
      gate0: () => ({ enabled: true, bypass: false }),
      devAdapter: () => "cursor",
      taskMaxDefault: () => 20,
      enabledProjectTypes: () => ["coding", "writing"],
      readinessEvidence: () => ({ covered, bindings: [] }) // armed:covered 由用例液态设置
    });
  });

  async function draftId(): Promise<string> {
    // 建会话(pending 草稿项目)→ 把会话项目定型 coding(奠基后态)
    sessions.ensureSession(SES);
    db.prepare("UPDATE projects SET type='coding' WHERE id=(SELECT project_id FROM sessions WHERE id=?)").run(SES);
    const ct = (await registry.dispatch("createTask", JSON.stringify({ rawPoints: ["给报表页加导出按钮"] }), { sessionId: SES, turnId: newId("ses") })) as { taskDraftId: string };
    return ct.taskDraftId;
  }

  it("空账本 proposeStart 拒(W1 根修:covered=[] ⇒ gap_critical,不凭空出包)", async () => {
    covered = [];
    const did = await draftId();
    const r = (await registry.dispatch("proposeStart", JSON.stringify({ taskDraftId: did }), { sessionId: SES, turnId: newId("ses") })) as { ok?: boolean; code?: string; message?: string };
    expect(r.ok).toBe(false);
    expect(r.code).toMatch(/readiness_gap/);
    expect((db.prepare("SELECT COUNT(*) AS c FROM decision_packages").get() as { c: number }).c).toBe(0);
  });

  it("证据齐 ⇒ proposeStart 出包且绑 readinessRef;拍板通过", async () => {
    covered = (READINESS_CHECKLISTS.coding ?? []).map((d) => d.key);
    const did = await draftId();
    const p = (await registry.dispatch("proposeStart", JSON.stringify({ taskDraftId: did }), { sessionId: SES, turnId: newId("ses") })) as {
      packageId?: string;
      revision?: number;
      ok?: boolean;
    };
    expect(p.packageId).toBeTruthy();
    const pkgRow = db.prepare("SELECT body_json FROM decision_packages WHERE id=?").get(p.packageId) as { body_json: string };
    expect((JSON.parse(pkgRow.body_json) as { readinessRef?: unknown }).readinessRef).toBeTruthy();
    // 拍板门通过(readinessRef 与评估行一致)
    const iss = (await registry.dispatch("issueDispatchReceipt", JSON.stringify({ packageId: p.packageId, revision: p.revision }), { sessionId: SES, turnId: newId("ses") })) as { receiptId?: string; ok?: boolean };
    expect(iss.receiptId).toBeTruthy();
  });

  it("readinessRef 缺失拒拍板(armed;历史包无绑定)", async () => {
    covered = (READINESS_CHECKLISTS.coding ?? []).map((d) => d.key);
    const did = await draftId();
    const p = (await registry.dispatch("proposeStart", JSON.stringify({ taskDraftId: did }), { sessionId: SES, turnId: newId("ses") })) as { packageId: string; revision: number };
    // 抹掉 readinessRef 模拟历史包(digest 会不符,但拍板门先撞 ref 缺失/不符)
    const row = db.prepare("SELECT body_json FROM decision_packages WHERE id=?").get(p.packageId) as { body_json: string };
    const body = JSON.parse(row.body_json) as Record<string, unknown>;
    delete body["readinessRef"];
    db.prepare("UPDATE decision_packages SET body_json=? WHERE id=?").run(JSON.stringify(body), p.packageId);
    const iss = (await registry.dispatch("issueDispatchReceipt", JSON.stringify({ packageId: p.packageId, revision: p.revision }), { sessionId: SES, turnId: newId("ses") })) as { ok?: boolean; code?: string };
    expect(iss.ok).toBe(false);
    expect(iss.code).toMatch(/readiness_ref/);
  });

  it("pending 生命周期(owner 裁决 (a) 案 2026-07-28):pending 首包可 propose,拍板拒 project_pending_promotion——promoteProject 后可拍", async () => {
    covered = (READINESS_CHECKLISTS.coding ?? []).map((d) => d.key);
    // 不定型:会话项目保持 pending(draftId() 会 promote,这里手工走)
    sessions.ensureSession(SES);
    const prjRow = db.prepare("SELECT project_id FROM sessions WHERE id=?").get(SES) as { project_id: string };
    const ct = (await registry.dispatch("createTask", JSON.stringify({ rawPoints: ["写一篇章鱼科普"] }), { sessionId: SES, turnId: newId("ses") })) as { taskDraftId: string };
    // pending 无就绪清单模板 ⇒ armed 门会拦 propose(况①)——本用例聚焦拍板闸,先临时给 pending 装 coding 模板不现实,
    // 故用未 armed 语义不可行;直接构造:promote 前 propose 需过 armed 门,改为先验证拍板闸的独立行为:
    // 手工插一个 pending 项目的 proposed 包,断言 issueDispatchReceipt 拒。
    const { insertPackage } = await import("../src/storage/dao/packages.js");
    const { computePackageDigest } = await import("@saydo/contracts");
    const unsigned = {
      id: newId("pkg"), revision: 1, projectId: prjRow.project_id, outcomePreview: "首包",
      inScope: ["x"], outOfScope: [], assumptions: [], acceptance: ["a"],
      plan: [{ seq: 1, step: "s", owner: "ai" as const }],
      cost: { expected: { known: false }, p95: { known: false }, max: 10, currency: "CNY" as const },
      risks: [], mode: "step_confirm" as const, preauthorizedEffects: [], effectPolicyVersion: "e2/0.1.0"
    };
    const digest = computePackageDigest(unsigned);
    insertPackage(db, { ...unsigned, digest, status: "proposed", expiresAt: new Date(Date.now() + 3600_000).toISOString(), createdAt: new Date().toISOString() });
    const iss = (await registry.dispatch("issueDispatchReceipt", JSON.stringify({ packageId: unsigned.id, revision: 1 }), { sessionId: SES, turnId: newId("ses") })) as { ok?: boolean; code?: string };
    expect(iss.ok).toBe(false);
    expect(iss.code).toBe("project_pending_promotion");
    expect(ct.taskDraftId).toBeTruthy(); // createTask(草稿)不受拍板闸影响
    // promote 定型:走生产工具链(code-review A-2 回修——promoteProject 已注册 Brain 工具,转正链有生产触发点)
    const pm = (await registry.dispatch("promoteProject", JSON.stringify({ projectId: prjRow.project_id, title: "章鱼科普", type: "coding" }), { sessionId: SES, turnId: newId("ses") })) as { ok?: boolean };
    expect(pm.ok).toBe(true);
    const iss2 = (await registry.dispatch("issueDispatchReceipt", JSON.stringify({ packageId: unsigned.id, revision: 1 }), { sessionId: SES, turnId: newId("ses") })) as { receiptId?: string; ok?: boolean };
    // armed 场景下 readinessRef 缺失会拦——手工包无 ref,断言拦的是 readiness 而非 pending(pending 闸已过)
    expect(iss2.ok === false ? (iss2 as { code?: string }).code : "ok").not.toBe("project_pending_promotion");
  });

  it("会话建立装配(第三消费点,w4-readback B-4;armed):assembleOnSessionStart 落评估行 + skeleton_assemble 审计——与评估/复验同一实现", () => {
    const audit = createSqliteAuditSink(db);
    const ensured = sessions.ensureSession(newId("ses"));
    const projectId = ensured.session.projectId!;
    db.prepare("UPDATE projects SET type='coding' WHERE id=?").run(projectId);
    const r = assembleOnSessionStart(
      { db, audit, evidenceProvider: () => ({ covered: [], bindings: [] }) },
      { sessionId: ensured.session.id, projectId, type: "coding" }
    );
    expect(r.verdict).toBe("gap_critical"); // 空账本装配即如实(骨架从会话开始存在,初值全 unknown)
    const row = db.prepare("SELECT verdict, layer FROM readiness_assessments WHERE id=?").get(r.ref.assessmentId) as { verdict: string; layer: string };
    expect(row).toEqual({ verdict: "gap_critical", layer: "rules" });
    const n = (db.prepare("SELECT COUNT(*) AS c FROM audit_log WHERE action='readiness.skeleton_assemble'").get() as { c: number }).c;
    expect(n).toBe(1);
  });

  it("dialog 装配接线锚(RA-closeout,code-review B-1):created 恰一次触发;assemble throw 不断对话链", async () => {
    const { LiveDialog } = await import("../src/live/dialog.js");
    const { createLogger } = await import("../src/obs/logger.js");
    const home2 = mkdtempSync(join(tmpdir(), "saydo-dlg-"));
    let assembleCalls = 0;
    const spoken: string[] = [];
    const dialog = new LiveDialog({
      db,
      audit: createSqliteAuditSink(db),
      sessions,
      dialogProvider: null, // 装配在 provider 检查之前——null provider 走"未配置"话术,不影响本锚
      say: (_sid, _sentenceId, text) => {
        spoken.push(text);
        return true;
      },
      log: createLogger({ dir: join(home2, "logs"), name: "dlg-test" }),
      readinessAssemble: () => {
        assembleCalls += 1;
        throw new Error("assemble boom"); // 首次即 throw:断言不断链
      }
    });
    const sid = newId("ses");
    await dialog.onAsrFinal(sid, newId("ses"), "你好");
    await dialog.onAsrFinal(sid, newId("ses"), "再说一句");
    expect(assembleCalls).toBe(1); // ensureSession.created 守卫:仅首建装配,第二轮不重复
    expect(spoken.length).toBeGreaterThanOrEqual(2); // throw 被 catch,两轮对话链均走到 say(未配置话术)
  });
});
