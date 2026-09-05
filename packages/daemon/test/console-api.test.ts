// D1 控制台只读 API 验收(5.1/5.2):fixture 种子 + 各投影(overview/tasks/detail/memory/
// approvals/outbox/costs)与 11 §2.6 派生态(parked)一致。

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { newId } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { seedConsoleFixture } from "../src/api/fixture.js";
import {
  getApprovals,
  getCosts,
  getMobileFocusDetail,
  getOutbox,
  getOverview,
  getProjectArtifacts,
  getProjectMemory,
  getProjectSettings,
  getProjectTasks,
  getTaskDetail
} from "../src/api/console.js";
import { abandonFocusApi, archiveFocusApi, createFocusApi } from "../src/api/focuses.js";
import { changeFocusLifecycle } from "../src/focus/registry.js";
import type { AuditSink } from "../src/obs/audit.js";

const PRJ = "prj_01F1XT0RE0A000000000000000";
const NOW = "2026-09-04T00:00:00.000Z";
const nullAudit: AuditSink = { record: () => ({ id: "aud_x" }) };

describe("console API(fixture 投影)", () => {
  let db: Db;
  beforeAll(() => {
    db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-capi-")), "saydo.db"));
    const r = seedConsoleFixture(db);
    expect(r.seeded).toBe(true);
    // 幂等:非空库拒种
    expect(seedConsoleFixture(db).seeded).toBe(false);
  });

  it("overview:项目卡 + 待处理聚合(ready/blocked/审批/回叫)", () => {
    const o = getOverview(db);
    expect(o.projects).toHaveLength(2);
    expect(o.pending.readyForReview.map((t) => t.title)).toContain("报表导出 CSV");
    expect(o.pending.approvals).toBe(1); // pending 一条
    expect(o.pending.unreadCallbacks).toBe(2); // pending + notified
  });

  it("tasks:派生态 parked(blocked + parked_deadline)不写回持久态", () => {
    const tasks = getProjectTasks(db, PRJ);
    const parked = tasks.find((t) => t.title === "数据库索引重建")!;
    expect(parked.status).toBe("blocked"); // 持久态
    expect(parked.viewStatus).toBe("parked"); // 呈现态
    const ready = tasks.find((t) => t.title === "报表导出 CSV")!;
    expect(ready.viewStatus).toBe("ready_for_review");
    expect(ready.attempt).toBe(1);
  });

  it("task detail:决策包 acceptance + runs + 审批 + 成本齐", () => {
    const clean = getTaskDetail(db, "tsk_01F1XT0RE0TSKRDY0000000000")!;
    const cleanRun = (clean["runs"] as Record<string, unknown>[])[0]!;
    const cleanChecks = clean["acceptanceChecks"] as { criterion: string; status: string; source: string }[];
    expect(cleanChecks).toHaveLength(3);
    expect(cleanChecks.every((check) => check.status === "unknown" && check.source === "manual")).toBe(true);
    expect(cleanRun["observed_model"]).toBe("cursor-grok-4.6-high-fast");
    expect(cleanRun["exit_evidence"]).toBeNull();
    expect(cleanRun["terminal_audit_action"]).toBe("tier1.settled_review");
    expect(cleanRun["evidence_conflict"]).toBe(false);

    // 同一 run 出现互斥终态审计时不拼接字段；显式暴露证据冲突。
    db.prepare("INSERT INTO audit_log(id,ts,actor,action,meta_json) VALUES (?,?,?,?,?)").run(
      "aud_console_exit_evidence",
      "2026-07-25T02:03:00.000Z",
      "daemon",
      "tier1.blocked",
      JSON.stringify({
        taskId: "tsk_01F1XT0RE0TSKRDY0000000000",
        runId: "run_01F1XT0RE0A000000000000000",
        exitEvidence: "subscription_rate_limited"
      })
    );
    db.prepare("INSERT INTO audit_log(id,ts,actor,action,meta_json) VALUES (?,?,?,?,?)").run(
      "aud_console_malformed_meta",
      "2026-07-25T02:04:00.000Z",
      "daemon",
      "tier1.blocked",
      "{malformed"
    );
    const d = getTaskDetail(db, "tsk_01F1XT0RE0TSKRDY0000000000")!;
    const pkg = d["package"] as { acceptance: unknown[] };
    expect(pkg.acceptance).toHaveLength(3);
    const runs = d["runs"] as Record<string, unknown>[];
    expect(runs).toHaveLength(1);
    expect(runs[0]?.["observed_model"]).toBeNull();
    expect(runs[0]?.["exit_evidence"]).toBeNull();
    expect(runs[0]?.["terminal_audit_action"]).toBeNull();
    expect(runs[0]?.["evidence_conflict"]).toBe(true);
    expect((d["acceptanceChecks"] as { status: string }[]).every((check) => check.status === "unknown")).toBe(true);
    expect((d["approvals"] as unknown[]).length).toBe(1);
    expect((d["costs"] as unknown[]).length).toBe(2);
    expect(getTaskDetail(db, "tsk_none")).toBeNull();
  });

  it("memory:M1-M3 投影(排 M0)+ trust 层;approvals 带项目/任务上下文;outbox/costs/settings/artifacts", () => {
    const mem = getProjectMemory(db, nullAudit, PRJ);
    expect(mem.length).toBe(3);
    expect(mem.every((m) => m["tier"] !== "M0")).toBe(true);
    const aps = getApprovals(db);
    expect(aps.length).toBe(3);
    expect(aps.every((a) => a["task_title"] !== undefined)).toBe(true);
    expect(getOutbox(db).length).toBe(2);
    const costs = getCosts(db);
    expect(costs.byProject.length).toBeGreaterThan(0);
    // unknown 纪律:known 合计只含 known=1 行
    const p = costs.byProject.find((x) => x["projectId"] === PRJ)!;
    expect((p["knownByCurrency"] as Record<string, number>)["CNY"]).toBeCloseTo(0.36); // 分币种(Hopper USD 行不混计)
    expect(p["unknownCount"]).toBe(2); // 项目下 unknown = api llm 行 + 订阅行
    expect(getProjectSettings(db, PRJ)?.["title"]).toBe("报表系统");
    expect(getProjectArtifacts(db, PRJ)).toHaveLength(2);
  });

  it("M1 LAN Focus DTO 不返回仓路径、sessionId 或未消费原始 payload", () => {
    const focusId = (db.prepare("SELECT id FROM focuses LIMIT 1").get() as { id: string }).id;
    const seq = (db.prepare("SELECT COALESCE(MAX(seq),0)+1 AS seq FROM focus_events WHERE focus_id=?").get(focusId) as { seq: number }).seq;
    const eventId = newId("fev");
    db.prepare(
      `INSERT INTO focus_events(
         id,focus_id,seq,type,payload_schema_version,payload_json,actor_kind,session_id,turn_ref,created_at
       ) VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).run(
      eventId,
      focusId,
      seq,
      "correction",
      1,
      JSON.stringify({
        title: `修 ${["", "Users", "alice"].join("/")}/private/.env，Bearer sk-mobile-secret-value-123456`,
        revision: `核对 ${["", "Users", "alice"].join("/")}/private/revision.json`,
        path: `${["", "Users", "owner"].join("/")}/private.txt`,
        secret: "hidden"
      }),
      "daemon",
      "ses_private_session",
      null,
      "2026-08-11T12:00:00.000Z"
    );
    const detail = getMobileFocusDetail(db, focusId) as Record<string, unknown>;
    expect(Object.keys(detail).sort()).toEqual(["events", "focus", "lanes", "obligations"]);
    const projected = (detail["events"] as Array<Record<string, unknown>>).find((row) => row["id"] === eventId)!;
    expect(projected["payload"]).toEqual({
      title: "修 某个配置文件，一处凭据",
      revision: "核对 某个配置文件"
    });
    expect(projected).not.toHaveProperty("sessionId");
    expect(JSON.stringify(detail)).not.toContain(`${["", "Users", "owner"].join("/")}/private.txt`);
    expect(JSON.stringify(detail)).not.toContain("sk-mobile-secret-value-123456");
  });
});

describe("PG-01B abandon 独立写口", () => {
  let db: Db;
  const recorded: Array<{ action: string; meta: Record<string, unknown> }> = [];
  const audit: AuditSink = {
    record: (e) => {
      recorded.push({ action: e.action, meta: (e.meta ?? {}) as Record<string, unknown> });
      return { id: "aud_x" };
    }
  };

  beforeAll(() => {
    db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-abandon-")), "saydo.db"));
  });

  it("abandon 写 abandoned 并记独立 audit;不经 archive", () => {
    recorded.length = 0;
    const created = createFocusApi(db, audit, { title: "abandon-active" }, NOW);
    const id = (created.payload as { id: string }).id;
    changeFocusLifecycle(db, id, { to: "active", reason: "activate", actorKind: "user" });
    const out = abandonFocusApi(db, audit, id, { reason: "不再做了" });
    expect(out.status).toBe(200);
    expect(out.payload).toEqual({ ok: true, id, lifecycle: "abandoned" });
    const row = db.prepare("SELECT lifecycle FROM focuses WHERE id=?").get(id) as { lifecycle: string };
    expect(row.lifecycle).toBe("abandoned");
    expect(recorded.some((e) => e.action === "focus.abandoned")).toBe(true);
    expect(recorded.some((e) => e.action === "focus.archived")).toBe(false);
  });

  it("archive 仍写 archived,语义不变", () => {
    recorded.length = 0;
    const created = createFocusApi(db, audit, { title: "archive-keep" }, NOW);
    const id = (created.payload as { id: string }).id;
    const out = archiveFocusApi(db, audit, id, { reason: "先放下" });
    expect(out.status).toBe(200);
    expect(out.payload).toEqual({ ok: true, id, lifecycle: "archived" });
    const row = db.prepare("SELECT lifecycle FROM focuses WHERE id=?").get(id) as { lifecycle: string };
    expect(row.lifecycle).toBe("archived");
    expect(recorded.some((e) => e.action === "focus.archived")).toBe(true);
  });

  it("captured/closed 与缺理由 fail-closed", () => {
    const created = createFocusApi(db, audit, { title: "captured-no-abandon" }, NOW);
    const id = (created.payload as { id: string }).id;
    expect(abandonFocusApi(db, audit, id, { reason: "想放弃" }).status).toBe(409);
    expect(abandonFocusApi(db, audit, id, {}).status).toBe(400);
    const missing = abandonFocusApi(db, audit, "foc_missing", { reason: "x" });
    expect(missing.status).toBe(404);
  });
});
