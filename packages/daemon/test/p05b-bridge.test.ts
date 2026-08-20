// P0.5-B 桥单元验收:capabilities 握手 / C1 渲染 / lint 预检 / 两阶段 dispatch /
// journal 重放 / retry 闸门 / C3 事件消费(半行/损坏/未知)/ RunSettled 复核 / 成本对账 / CAS。

import { mkdtempSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { computePackageDigest, type DecisionPackage } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { assertHandshake, hopperSteerSupport } from "../src/bridge/capabilities.js";
import { hasAcceptanceHeading, isHollowAcceptance, renderTaskCard } from "../src/bridge/taskCard.js";
import { judgeLint } from "../src/bridge/lintPrecheck.js";
import { beginDispatch, completeDispatch, getBinding, pendingDispatches, updateBindingRunId } from "../src/bridge/dispatch.js";
import { markCommand, recordIntent, retryGate, unconfirmedCommands } from "../src/bridge/journal.js";
import { consumeRunSettled, readEventsFrom } from "../src/bridge/events.js";
import { casPreflight, extractLastRunCost, recordTaskRunCost } from "../src/bridge/cost.js";
import type { AuditSink } from "../src/obs/audit.js";

const NOW = "2026-07-25T07:00:00.000Z";
const nullAudit: AuditSink = { record: () => ({ id: "aud_x" }) };

const CAPS_OK = JSON.stringify({
  schema_version: "1",
  package_version: "0.1.0",
  commit: "bdd1e548f9359789497a797eda24398beba68ac5",
  event_types: ["TaskReceived", "RunSettled"],
  task_statuses: ["received", "ready", "draft", "plan_needed", "research", "deferred", "conflict", "blocked", "running", "review", "done", "failed", "rejected", "archived"],
  mutation_commands: ["cancel", "drop"],
  vault: { root: "/tmp/v", vault_id: "vlt_x" },
  capabilities: { settle_event: "runtime", mutation_expects_cas: "runtime", steer: "none" }
});

describe("capabilities 握手(fail-closed)", () => {
  it("正例:commit 匹配 + settle_event=runtime + 14 值齐 => ok", () => {
    const r = assertHandshake(CAPS_OK, { expectedCommit: "bdd1e548f9359789497a797eda24398beba68ac5", requireSettleEvent: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.settleEventEnabled).toBe(true);
      expect(r.casEnabled).toBe(true);
    }
  });

  it("反例:锁定点漂移/缺 RunSettled/缺枚举/不可解析 => 拒", () => {
    expect(assertHandshake(CAPS_OK, { expectedCommit: "deadbeef" }).ok).toBe(false);
    const noSettle = JSON.parse(CAPS_OK) as Record<string, unknown>;
    (noSettle["event_types"] as string[]).splice(1, 1);
    expect(assertHandshake(JSON.stringify(noSettle), { expectedCommit: "bdd1e548f9359789497a797eda24398beba68ac5" }).ok).toBe(false);
    const missEnum = JSON.parse(CAPS_OK) as Record<string, unknown>;
    (missEnum["task_statuses"] as string[]).pop();
    expect(assertHandshake(JSON.stringify(missEnum), { expectedCommit: "bdd1e548f9359789497a797eda24398beba68ac5" }).ok).toBe(false);
    expect(assertHandshake("not-json", { expectedCommit: "x" }).ok).toBe(false);
  });

  it("W5a 3.4 steer 分级消费锚:baseline.2 = none ⇒ 不可 steer;能力升级(runtime)⇒ 自动改判;缺键缺省 none", () => {
    const r = assertHandshake(CAPS_OK, { expectedCommit: "bdd1e548f9359789497a797eda24398beba68ac5" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.steerLevel).toBe("none"); // 锁定二进制实测值
    expect(hopperSteerSupport("none").steerable).toBe(false);
    expect(hopperSteerSupport("none").phrase).toContain("不支持运行中改需求");
    expect(hopperSteerSupport("schema_only").steerable).toBe(false); // schema_only 不是 runtime,不放行
    expect(hopperSteerSupport("runtime").steerable).toBe(true); // 能力出现自动改判(桥消费面随升级批)

    const upgraded = JSON.parse(CAPS_OK) as { capabilities: Record<string, string> };
    upgraded.capabilities["steer"] = "runtime";
    const r2 = assertHandshake(JSON.stringify(upgraded), { expectedCommit: "bdd1e548f9359789497a797eda24398beba68ac5" });
    expect(r2.ok && r2.steerLevel === "runtime").toBe(true);

    const noSteerKey = JSON.parse(CAPS_OK) as { capabilities: Record<string, string> };
    delete noSteerKey.capabilities["steer"];
    const r3 = assertHandshake(JSON.stringify(noSteerKey), { expectedCommit: "bdd1e548f9359789497a797eda24398beba68ac5" });
    expect(r3.ok && r3.steerLevel === "none").toBe(true); // 缺键缺省 none(fail-closed 方向)
  });
});

function mkPkg(acceptance: string[]): DecisionPackage {
  const body = {
    id: "pkg_01AAAAAAAAAAAAAAAAAAAAAAAA",
    revision: 3,
    projectId: "prj_01AAAAAAAAAAAAAAAAAAAAAAAA",
    outcomePreview: "给报表页加 CSV 导出",
    inScope: ["前端与导出 API"],
    outOfScope: ["数据模型"],
    assumptions: [],
    acceptance,
    plan: [{ seq: 1, step: "实现", owner: "ai" as const }],
    cost: { expected: { known: false }, p95: { known: false }, max: 20, currency: "CNY" as const },
    risks: [],
    mode: "direct_to_review" as const,
    preauthorizedEffects: [],
    effectPolicyVersion: "e2/0.1.0"
  };
  return { ...body, digest: computePackageDigest(body), status: "approved", expiresAt: "2026-08-01T00:00:00.000Z", createdAt: NOW };
}

describe("C1 TaskCardRenderer(附录 §1)", () => {
  it("正例:frontmatter + 词表标题 + bullet + 末行 dispatch 注释;标题判定命中", () => {
    const r = renderTaskCard({
      pkg: mkPkg(["报表页出现导出按钮,点击下载 .csv", "新增导出逻辑有单元测试且 npm test 通过"]),
      dispatchId: "dsp_01AAAAAAAAAAAAAAAAAAAAAAAA",
      hopperProject: "my-app",
      saydoTaskId: "tsk_01K0W9AAAAAAAAAAAAAAAAAAAA"
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.markdown).toContain("id: saydo-01k0w9aaaaaaaaaaaaaaaaaaaa"); // ULID 小写化
    expect(r.markdown).toContain("## 验收标准");
    expect(r.markdown).toContain("- 报表页出现导出按钮");
    expect(r.markdown).toContain("<!-- saydo:dispatch dsp_01AAAAAAAAAAAAAAAAAAAAAAAA rev=3 digest=sha256:");
    expect(hasAcceptanceHeading(r.markdown)).toBe(true);
  });

  it("反例:空洞判据拒渲染(附录 §1.4);无验收标准拒渲染", () => {
    expect(isHollowAcceptance("测试通过")).toBe(true);
    expect(isHollowAcceptance("ok")).toBe(true);
    expect(isHollowAcceptance("导出文件首行为表头")).toBe(false);
    const hollow = renderTaskCard({ pkg: mkPkg(["完成", "具体断言"]), dispatchId: "dsp_01AAAAAAAAAAAAAAAAAAAAAAAA", hopperProject: "x", saydoTaskId: "tsk_01AAAAAAAAAAAAAAAAAAAAAAAA" });
    expect(hollow.ok).toBe(false);
    if (!hollow.ok) expect(hollow.hollow).toEqual(["完成"]);
    expect(renderTaskCard({ pkg: mkPkg([]), dispatchId: "dsp_01AAAAAAAAAAAAAAAAAAAAAAAA", hopperProject: "x", saydoTaskId: "tsk_01AAAAAAAAAAAAAAAAAAAAAAAA" }).ok).toBe(false);
  });
});

describe("lint 预检(三处判定;missing_acceptance 是 warning 不进退出码)", () => {
  it("blocking 非空 / classification 非 ready / needs_human 任一命中 => 不 drop", () => {
    expect(judgeLint(JSON.stringify({ blocking: [{ code: "x" }], result: {} })).ok).toBe(false);
    expect(judgeLint(JSON.stringify({ blocking: [], result: { classification: "blocked" } })).ok).toBe(false);
    expect(judgeLint(JSON.stringify({ result: { classification: "ready", execution_decision: "needs_human" } })).ok).toBe(false);
    const ok = judgeLint(JSON.stringify({ blocking: [], result: { classification: "ready", execution_decision: "auto", risk: "medium" } }));
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.risk).toBe("medium");
    expect(judgeLint("bad json").ok).toBe(false); // fail-closed
  });
});

describe("两阶段 dispatch + journal", () => {
  let db: Db;
  beforeEach(() => {
    db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-p05b-")), "saydo.db"));
  });

  it("写序:begin(NULL) -> complete(回填);NULL 行进重放清单;runId 换新留痕", () => {
    const vt = "tsk_01AAAAAAAAAAAAAAAAAAAAAAAA";
    expect(beginDispatch(db, nullAudit, { voiceTaskId: vt, idemKey: "saydo-01x", packageDigest: "sha256:" + "a".repeat(64), mode: "direct_to_review" }, NOW).fresh).toBe(true);
    expect(pendingDispatches(db)).toHaveLength(1);
    // 幂等:重复 begin 不重插
    expect(beginDispatch(db, nullAudit, { voiceTaskId: vt, idemKey: "saydo-01x", packageDigest: "sha256:" + "a".repeat(64), mode: "direct_to_review" }, NOW).fresh).toBe(false);
    completeDispatch(db, nullAudit, vt, {
      dispatchId: "dsp_01AAAAAAAAAAAAAAAAAAAAAAAA",
      hopper: { projectId: "app", taskId: "hop-1", revision: 1, runId: "run-1" },
      outcome: "created"
    });
    expect(pendingDispatches(db)).toHaveLength(0);
    updateBindingRunId(db, nullAudit, vt, "run-2");
    expect(getBinding(db, vt)?.runId).toBe("run-2");
    // 两阶段序破坏:再 complete 抛
    expect(() => completeDispatch(db, nullAudit, vt, { dispatchId: "dsp_01AAAAAAAAAAAAAAAAAAAAAAAB", hopper: { projectId: "a", taskId: "t", revision: 1 }, outcome: "created" })).toThrow();
  });

  it("journal:intent->sent->confirmed;!=confirmed 进重放;retry 闸门(high 转人工/分诊 blocked 走 re-drop)", () => {
    const id = recordIntent(db, nullAudit, { taskId: "tsk_01AAAAAAAAAAAAAAAAAAAAAAAA", op: "cancel", idemKey: "k1", payloadDigest: "sha256:" + "b".repeat(64) }, NOW);
    expect(unconfirmedCommands(db)).toHaveLength(1);
    markCommand(db, id, "sent", NOW);
    expect(unconfirmedCommands(db)[0]?.state).toBe("sent");
    markCommand(db, id, "confirmed", NOW);
    expect(unconfirmedCommands(db)).toHaveLength(0);
    // retry 闸门
    expect(retryGate({ riskHigh: true, triageBlocked: false })).toMatchObject({ allowed: false, route: "manual" });
    expect(retryGate({ riskHigh: false, triageBlocked: true })).toMatchObject({ allowed: false, route: "redrop_unblock" });
    expect(retryGate({ riskHigh: false, triageBlocked: false })).toMatchObject({ allowed: true });
  });
});

describe("C3 事件消费(容错)+ RunSettled 复核", () => {
  it("byte cursor 续读;半行不消费;损坏行跳过计数;未知类型透传;文件收缩检出", () => {
    const p = join(mkdtempSync(join(tmpdir(), "saydo-ev-")), "events.jsonl");
    writeFileSync(p, `{"type":"TaskReceived","task_id":"t1"}\n{"type":"FutureUnknownType","x":1}\nnot-json\n`);
    const r1 = readEventsFrom(p, 0);
    expect(r1.events.map((e) => e.type)).toEqual(["TaskReceived", "FutureUnknownType"]); // 未知类型透传
    expect(r1.corruptLines).toBe(1);
    // 追加半行:不消费
    appendFileSync(p, `{"type":"RunSettled","payload":{"final_status":"rev`);
    const r2 = readEventsFrom(p, r1.newOffset);
    expect(r2.events).toHaveLength(0);
    expect(r2.newOffset).toBe(r1.newOffset);
    // 补全该行:消费
    appendFileSync(p, `iew"}}\n`);
    const r3 = readEventsFrom(p, r2.newOffset);
    expect(r3.events[0]?.type).toBe("RunSettled");
    // 收缩检出
    writeFileSync(p, "");
    expect(readEventsFrom(p, r3.newOffset).fileShrunk).toBe(true);
  });

  it("RunSettled 复核:review 须 evidence+summary;failed/blocked 事件即证据;不一致拒", () => {
    const ev = { type: "RunSettled", payload: { final_status: "review", evidence_digest: "ed-1", summary_path: "s.md" } };
    expect(consumeRunSettled(ev, { reviewEvidenceDigest: "ed-1", summaryExists: true }).ok).toBe(true);
    expect(consumeRunSettled(ev, { reviewEvidenceDigest: "ed-OTHER", summaryExists: true }).ok).toBe(false); // 不当真理
    expect(consumeRunSettled(ev, { reviewEvidenceDigest: "ed-1", summaryExists: false }).ok).toBe(false);
    const failedEv = { type: "RunSettled", payload: { final_status: "failed", recovery: true } };
    expect(consumeRunSettled(failedEv, { projectionStatus: "failed" }).ok).toBe(true); // summary 允许空
    expect(consumeRunSettled(failedEv, { projectionStatus: "review" }).ok).toBe(false); // 投影不一致
    expect(consumeRunSettled({ type: "RunSettled", payload: { final_status: "done" } }, {}).ok).toBe(false); // 词表外
  });
});

describe("成本对账 + CAS 预检", () => {
  it("last_run_cost 真实形状(appendix §3.1):{known,value,currency:USD,as_of};known:false 不编数;币种如实落库", () => {
    const db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-cost2-")), "saydo.db"));
    expect(extractLastRunCost(JSON.stringify({ last_run_cost: { known: false } }))).toEqual({ known: false });
    expect(extractLastRunCost("junk")).toEqual({ known: false });
    // 旧字段名 amount / 缺币种 => 一律 unknown(不猜不编)
    expect(extractLastRunCost(JSON.stringify({ last_run_cost: { known: true, amount: 1.5, currency: "USD" } })).known).toBe(false);
    expect(extractLastRunCost(JSON.stringify({ last_run_cost: { known: true, value: 1.5 } })).known).toBe(false);
    const real = extractLastRunCost(
      JSON.stringify({ last_run_cost: { known: true, value: 0.1234, currency: "USD", as_of: "2026-07-25T02:33:00.000Z" } })
    );
    expect(real).toMatchObject({ known: true, amount: 0.1234, currency: "USD", asOf: "2026-07-25T02:33:00.000Z" });
    recordTaskRunCost(db, { taskId: "tsk_01AAAAAAAAAAAAAAAAAAAAAAAA", runId: "run-1", cost: { known: false } }, NOW);
    recordTaskRunCost(db, { taskId: "tsk_01AAAAAAAAAAAAAAAAAAAAAAAA", runId: "run-2", cost: real }, NOW);
    const rows = db.prepare("SELECT amount, currency, known, meta_json FROM cost_entries ORDER BY known").all() as {
      amount: number | null;
      currency: string | null;
      known: number;
      meta_json: string;
    }[];
    expect(rows[0]).toMatchObject({ amount: null, known: 0 });
    expect(rows[1]).toMatchObject({ amount: 0.1234, currency: "USD", known: 1 }); // USD 如实,不折 CNY
    expect(JSON.parse(rows[1]!.meta_json)).toMatchObject({ as_of: "2026-07-25T02:33:00.000Z" });
  });

  it("CAS:状态变/事件尾前进 => voided_by_conflict(不盲发)", () => {
    expect(casPreflight({ expectStatus: "review" }, { status: "review", lastEventId: "e9" }).ok).toBe(true);
    expect(casPreflight({ expectStatus: "review" }, { status: "failed", lastEventId: "e9" })).toMatchObject({ verdict: "voided_by_conflict" });
    expect(casPreflight({ expectLastEventId: "e9" }, { status: "review", lastEventId: "e10" })).toMatchObject({ verdict: "voided_by_conflict" });
  });
});
