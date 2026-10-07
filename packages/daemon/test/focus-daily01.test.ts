// DAILY-01 功能补齐:任务级依赖(set/wake/block/清除)、lane create/unretire、
// fork、defer、archive 在途拦截、waiting-on 任务级分支。

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { focusEventTypeSchema, newId } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { createFocus } from "../src/focus/registry.js";
import { startActivation } from "../src/focus/activation.js";
import { upsertObligation } from "../src/focus/obligations.js";
import { FocusWriteError } from "../src/focus/writeTx.js";
import { createLane, retireLane, unretireLane } from "../src/focus/lanes.js";
import {
  applyTaskDependencyTransition,
  recoverWaitingDependencies,
  setObligationWaitingOn,
  setObligationWaitingOnTask,
  taskSatisfiesCondition
} from "../src/focus/dependency.js";
import { archiveFocusApi, forkFocusApi } from "../src/api/focuses.js";
import { deferObligationApi, setWaitingOnApi } from "../src/api/obligations.js";
import { transitionTask } from "../src/storage/dao/tasks.js";
import { getObligationList } from "../src/api/console.js";
import type { AuditSink } from "../src/obs/audit.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";

const nullAudit: AuditSink = { record: () => ({ id: "aud_x" }) };

function openFresh(): Db {
  const home = mkdtempSync(join(tmpdir(), "saydo-d01-"));
  return openDb(join(home, "saydo.db"));
}

const NOW = new Date().toISOString();

function seedProject(db: Db): string {
  const prj = newId("prj");
  db.prepare(
    `INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at)
     VALUES (?,?, 'coding', 'active', '{}', 'step_confirm', ?, ?)`
  ).run(prj, "t", NOW, NOW);
  return prj;
}

function seedTask(db: Db, projectId: string, status = "queued"): string {
  const id = newId("tsk");
  db.prepare(
    `INSERT INTO tasks(id, project_id, package_id, package_rev, package_digest, title, spec_markdown,
       route, status, adapter, budget_json, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?, 'tier1', ?, 'claude_code', '{}', ?, ?)`
  ).run(id, projectId, newId("pkg"), 1, "dig", "任务" + id.slice(-4), "spec", status, NOW, NOW);
  return id;
}

function bindTask(db: Db, focusId: string, taskId: string, eventId: string): void {
  db.prepare(
    `INSERT INTO action_execution_bindings(id, focus_id, task_id, focus_revision_at_authorization,
       selected_authority, phase, authorized_by_event_id, created_at, updated_at)
     VALUES (?,?,?,0,'tier1','authorized',?,?,?)`
  ).run(newId("aeb"), focusId, taskId, eventId, NOW, NOW);
}

function seedObligation(db: Db, focusId: string, title = "义务"): string {
  const r = upsertObligation(db, focusId, {
    kind: "action",
    title,
    owner: "human",
    status: "open",
    verification: "confirmed",
    dedupeKey: `${focusId}:action:${title}`,
    blocking: false,
    needs: "action",
    actorKind: "user"
  });
  return r.obligationId;
}

function lastEvents(db: Db, focusId: string, type: string): Array<Record<string, unknown>> {
  const rows = db
    .prepare(`SELECT payload_json FROM focus_events WHERE focus_id = ? AND type = ? ORDER BY seq`)
    .all(focusId, type) as Array<{ payload_json: string }>;
  return rows.map((r) => JSON.parse(r.payload_json) as Record<string, unknown>);
}

function obRow(db: Db, id: string): {
  status: string;
  waiting_on_obligation_id: string | null;
  waiting_on_task_id: string | null;
  waiting_task_condition: string | null;
  defer_reason: string | null;
} {
  return db
    .prepare(
      `SELECT status, waiting_on_obligation_id, waiting_on_task_id, waiting_task_condition, defer_reason
       FROM focus_obligations WHERE id = ?`
    )
    .get(id) as never;
}

describe("DAILY-01 contracts 事件枚举", () => {
  it("六个新事件类型在 zod 枚举内", () => {
    for (const t of [
      "dependency_task_set",
      "dependency_task_woken",
      "dependency_task_blocked",
      "lane_created",
      "lane_restored",
      "obligation_deferred"
    ]) {
      expect(focusEventTypeSchema.safeParse(t).success).toBe(true);
    }
  });
  it("条件满足判定:accepted 含后继;delivered 仅 task_done", () => {
    expect(taskSatisfiesCondition("review_approved_waiting_merge", "accepted")).toBe(true);
    expect(taskSatisfiesCondition("task_done", "accepted")).toBe(true);
    expect(taskSatisfiesCondition("ready_for_review", "accepted")).toBe(false);
    expect(taskSatisfiesCondition("task_done", "delivered")).toBe(true);
    expect(taskSatisfiesCondition("review_approved_waiting_merge", "delivered")).toBe(false);
  });
});

describe("任务级依赖", () => {
  it("设任务前置 → waiting + dependency_task_set;条件列落库", () => {
    const db = openFresh();
    const prj = seedProject(db);
    const { focusId } = createFocus(db, { title: "f", actorKind: "user" });
    const ob = seedObligation(db, focusId);
    const task = seedTask(db, prj, "running");
    bindTask(db, focusId, task, newId("fev"));

    const r = setObligationWaitingOnTask(db, {
      obligationId: ob,
      taskId: task,
      condition: "delivered",
      actorKind: "user"
    });
    expect(r.status).toBe("waiting");
    const row = obRow(db, ob);
    expect(row.status).toBe("waiting");
    expect(row.waiting_on_task_id).toBe(task);
    expect(row.waiting_task_condition).toBe("delivered");
    const evs = lastEvents(db, focusId, "dependency_task_set");
    expect(evs.length).toBe(1);
    expect(evs[0]!["condition"]).toBe("delivered");
  });

  it("跨 Focus 任务前置拒 dependency_cross_focus;不存在任务 404", () => {
    const db = openFresh();
    const prj = seedProject(db);
    const a = createFocus(db, { title: "a", actorKind: "user" }).focusId;
    const b = createFocus(db, { title: "b", actorKind: "user" }).focusId;
    const ob = seedObligation(db, a);
    const task = seedTask(db, prj, "running");
    bindTask(db, b, task, newId("fev")); // 绑在别的 focus
    expect(() =>
      setObligationWaitingOnTask(db, { obligationId: ob, taskId: task, condition: "accepted" })
    ).toThrowError(FocusWriteError);
    expect(() =>
      setObligationWaitingOnTask(db, { obligationId: ob, taskId: "nope", condition: "accepted" })
    ).toThrowError(/not found/);
  });

  it("前置已满足 → set+woken 同事务,不留 waiting;已负向终态 → blocked", () => {
    const db = openFresh();
    const prj = seedProject(db);
    const { focusId } = createFocus(db, { title: "f", actorKind: "user" });
    const ob1 = seedObligation(db, focusId, "等验收");
    const ob2 = seedObligation(db, focusId, "等失败");
    const doneTask = seedTask(db, prj, "task_done");
    const failedTask = seedTask(db, prj, "failed");
    bindTask(db, focusId, doneTask, newId("fev"));
    bindTask(db, focusId, failedTask, newId("fev"));

    const r1 = setObligationWaitingOnTask(db, {
      obligationId: ob1, taskId: doneTask, condition: "delivered"
    });
    expect(r1.status).toBe("open");
    expect(obRow(db, ob1).status).toBe("open");
    expect(obRow(db, ob1).waiting_on_task_id).toBeNull();
    expect(lastEvents(db, focusId, "dependency_task_woken").length).toBe(1);

    const r2 = setObligationWaitingOnTask(db, {
      obligationId: ob2, taskId: failedTask, condition: "accepted"
    });
    expect(r2.status).toBe("blocked");
    expect(obRow(db, ob2).status).toBe("blocked");
    expect(obRow(db, ob2).waiting_on_task_id).toBe(failedTask); // 列保留 provenance
    expect(lastEvents(db, focusId, "dependency_task_blocked").length).toBe(1);
  });

  it("任务推进唤醒:accepted 条件在 review_approved_waiting_merge 醒;delivered 仅 task_done 醒", () => {
    const db = openFresh();
    const prj = seedProject(db);
    const { focusId } = createFocus(db, { title: "f", actorKind: "user" });
    const obA = seedObligation(db, focusId, "等验收");
    const obD = seedObligation(db, focusId, "等交付");
    const task = seedTask(db, prj, "running");
    bindTask(db, focusId, task, newId("fev"));
    setObligationWaitingOnTask(db, { obligationId: obA, taskId: task, condition: "accepted" });
    setObligationWaitingOnTask(db, { obligationId: obD, taskId: task, condition: "delivered" });

    // 到达批准态:accepted 醒,delivered 仍 waiting
    const r1 = applyTaskDependencyTransition(db, task, "review_approved_waiting_merge");
    expect(r1.woken).toEqual([obA]);
    expect(obRow(db, obA).status).toBe("open");
    expect(obRow(db, obD).status).toBe("waiting");

    // 交付:delivered 醒
    const r2 = applyTaskDependencyTransition(db, task, "task_done");
    expect(r2.woken).toEqual([obD]);
    expect(obRow(db, obD).status).toBe("open");
    expect(lastEvents(db, focusId, "dependency_task_woken").length).toBe(2);
  });

  it("transitionTask 漏斗:failed 终态阻塞依赖方(同事务,blocked 保留列)", () => {
    const db = openFresh();
    const prj = seedProject(db);
    const { focusId } = createFocus(db, { title: "f", actorKind: "user" });
    const ob = seedObligation(db, focusId);
    const task = seedTask(db, prj, "running");
    bindTask(db, focusId, task, newId("fev"));
    setObligationWaitingOnTask(db, { obligationId: ob, taskId: task, condition: "accepted" });
    expect(obRow(db, ob).status).toBe("waiting");

    // running → failed(L/P 边;S 不在触发表内)
    transitionTask(db, task, "failed", "L", { now: NOW });
    expect(obRow(db, ob).status).toBe("blocked");
    expect(obRow(db, ob).waiting_on_task_id).toBe(task);
    expect(lastEvents(db, focusId, "dependency_task_blocked")[0]!["preStatus"]).toBe("failed");
  });

  it("任务依赖事件写失败时回滚任务状态，重试后只追加一次事件", () => {
    const db = openFresh();
    const prj = seedProject(db);
    const { focusId } = createFocus(db, { title: "f", actorKind: "user" });
    const ob = seedObligation(db, focusId);
    const task = seedTask(db, prj, "running");
    bindTask(db, focusId, task, newId("fev"));
    setObligationWaitingOnTask(db, { obligationId: ob, taskId: task, condition: "accepted" });
    db.exec(`CREATE TRIGGER fail_dependency_event BEFORE INSERT ON focus_events
      WHEN NEW.type = 'dependency_task_blocked'
      BEGIN SELECT RAISE(ABORT, 'dependency event failed'); END`);
    expect(() => transitionTask(db, task, "failed", "L", { now: NOW })).toThrow("dependency event failed");
    expect(db.prepare("SELECT status FROM tasks WHERE id=?").get(task)).toEqual({ status: "running" });
    expect(obRow(db, ob).status).toBe("waiting");
    expect(lastEvents(db, focusId, "dependency_task_blocked")).toHaveLength(0);
    db.exec("DROP TRIGGER fail_dependency_event");
    transitionTask(db, task, "failed", "L", { now: NOW });
    expect(obRow(db, ob).status).toBe("blocked");
    expect(lastEvents(db, focusId, "dependency_task_blocked")).toHaveLength(1);
  });

  it("清除等待(preId=null)同清任务列,waiting→open", () => {
    const db = openFresh();
    const prj = seedProject(db);
    const { focusId } = createFocus(db, { title: "f", actorKind: "user" });
    const ob = seedObligation(db, focusId);
    const task = seedTask(db, prj, "running");
    bindTask(db, focusId, task, newId("fev"));
    setObligationWaitingOnTask(db, { obligationId: ob, taskId: task, condition: "accepted" });
    const r = setObligationWaitingOn(db, { obligationId: ob, preId: null, actorKind: "user" });
    expect(r.status).toBe("open");
    const row = obRow(db, ob);
    expect(row.waiting_on_task_id).toBeNull();
    expect(row.waiting_task_condition).toBeNull();
  });

  it("切换任务/义务前置互斥清列", () => {
    const db = openFresh();
    const prj = seedProject(db);
    const { focusId } = createFocus(db, { title: "f", actorKind: "user" });
    const dep = seedObligation(db, focusId, "依赖方");
    const preOb = seedObligation(db, focusId, "义务前置");
    const task = seedTask(db, prj, "running");
    bindTask(db, focusId, task, newId("fev"));

    setObligationWaitingOn(db, { obligationId: dep, preId: preOb, actorKind: "user" });
    expect(obRow(db, dep).waiting_on_obligation_id).toBe(preOb);
    expect(obRow(db, dep).waiting_on_task_id).toBeNull();

    setObligationWaitingOnTask(db, { obligationId: dep, taskId: task, condition: "accepted" });
    expect(obRow(db, dep).waiting_on_task_id).toBe(task);
    expect(obRow(db, dep).waiting_on_obligation_id).toBeNull();

    setObligationWaitingOn(db, { obligationId: dep, preId: preOb, actorKind: "user" });
    expect(obRow(db, dep).waiting_on_obligation_id).toBe(preOb);
    expect(obRow(db, dep).waiting_on_task_id).toBeNull();
    expect(obRow(db, dep).waiting_task_condition).toBeNull();
  });
});

describe("lane create / unretire", () => {
  it("createLane 建空线 + lane_created 事件;created_from_event=事件 seq", () => {
    const db = openFresh();
    const { focusId } = createFocus(db, { title: "f", actorKind: "user" });
    const r = createLane(db, { focusId, title: "支线A", actorKind: "user" });
    const lane = db
      .prepare(`SELECT title, created_from_event, retired_at FROM focus_lanes WHERE id = ?`)
      .get(r.laneId) as { title: string; created_from_event: number; retired_at: string | null };
    expect(lane.title).toBe("支线A");
    expect(lane.retired_at).toBeNull();
    const ev = lastEvents(db, focusId, "lane_created")[0]!;
    expect(ev["laneId"]).toBe(r.laneId);
  });

  it("unretireLane 恢复收线 + lane_restored 事件;未收线拒 lane_not_retired", () => {
    const db = openFresh();
    const { focusId } = createFocus(db, { title: "f", actorKind: "user" });
    const { laneId } = createLane(db, { focusId, title: "l", actorKind: "user" });
    retireLane(db, { focusId, laneId, actorKind: "user" });
    const r = unretireLane(db, { focusId, laneId, actorKind: "user" });
    expect(r.eventId).toBeTruthy();
    const lane = db
      .prepare(`SELECT retired_at FROM focus_lanes WHERE id = ?`)
      .get(laneId) as { retired_at: string | null };
    expect(lane.retired_at).toBeNull();
    expect(lastEvents(db, focusId, "lane_restored").length).toBe(1);
    expect(() => unretireLane(db, { focusId, laneId, actorKind: "user" })).toThrowError(
      /not retired/
    );
  });
});

describe("fork / defer / archive 守卫", () => {
  it("fork 产新 Focus:forked_from + focus_forked 事件;源不动", () => {
    const db = openFresh();
    const { focusId } = createFocus(db, { title: "原事", actorKind: "user" });
    const r = forkFocusApi(db, createSqliteAuditSink(db), focusId, { direction: "探索另一条路" });
    expect(r.status).toBe(200);
    const p = r.payload as { id: string; forkedFrom: string };
    expect(p.forkedFrom).toBe(focusId);
    const forked = db
      .prepare(`SELECT title, forked_from, lifecycle FROM focuses WHERE id = ?`)
      .get(p.id) as { title: string; forked_from: string; lifecycle: string };
    expect(forked.forked_from).toBe(focusId);
    expect(forked.lifecycle).toBe("captured");
    expect(lastEvents(db, p.id, "focus_forked")[0]!["sourceId"]).toBe(focusId);
    // 源 Focus 无 fork 事件(历史留在原 Focus)
    expect(lastEvents(db, focusId, "focus_forked").length).toBe(0);
  });

  it("defer 义务:理由必填、状态/理由/日期落库 + obligation_deferred 事件;终态拒", () => {
    const db = openFresh();
    const { focusId } = createFocus(db, { title: "f", actorKind: "user" });
    const ob = seedObligation(db, focusId);
    const bad = deferObligationApi(db, createSqliteAuditSink(db), ob, { reason: "  " });
    expect(bad.status).toBe(400);
    const r = deferObligationApi(db, createSqliteAuditSink(db), ob, { reason: "等外部排期", dueOrTrigger: "下周" });
    expect(r.status).toBe(200);
    const row = obRow(db, ob);
    expect(row.status).toBe("deferred");
    expect(row.defer_reason).toBe("等外部排期");
    expect(lastEvents(db, focusId, "obligation_deferred").length).toBe(1);
  });

  it("archive 在途任务拒 focus_has_running_work;任务终态后可归档", () => {
    const db = openFresh();
    const prj = seedProject(db);
    const { focusId } = createFocus(db, { title: "f", actorKind: "user" });
    const task = seedTask(db, prj, "running");
    bindTask(db, focusId, task, newId("fev"));

    const blocked = archiveFocusApi(db, createSqliteAuditSink(db), focusId, { reason: "收起" });
    expect(blocked.status).toBe(409);
    expect((blocked.payload as { code: string }).code).toBe("focus_has_running_work");

    db.prepare(`UPDATE tasks SET status='task_done' WHERE id=?`).run(task);
    const ok = archiveFocusApi(db, createSqliteAuditSink(db), focusId, { reason: "收起" });
    expect(ok.status).toBe(200);
  });
});

describe("GET /api/obligations 读口", () => {
  it("跨 focus 聚合 + waiting=1 过滤 + 前置标题 join", () => {
    const db = openFresh();
    const prj = seedProject(db);
    const a = createFocus(db, { title: "FA", actorKind: "user" }).focusId;
    const b = createFocus(db, { title: "FB", actorKind: "user" }).focusId;
    const obA = seedObligation(db, a, "A的事");
    seedObligation(db, b, "B的事");
    const task = seedTask(db, prj, "running");
    bindTask(db, a, task, newId("fev"));
    setObligationWaitingOnTask(db, { obligationId: obA, taskId: task, condition: "accepted" });

    const all = getObligationList(db, {});
    expect(all.length).toBe(2);
    const waiting = getObligationList(db, { waiting: "1" });
    expect(waiting.length).toBe(1);
    expect(waiting[0]!.waitingOnTaskId).toBe(task);
    expect(waiting[0]!.waitingOnTaskTitle).toContain("任务");
    expect(waiting[0]!.waitingTaskCondition).toBe("accepted");
    const byOwner = getObligationList(db, { owner: "human" });
    expect(byOwner.length).toBe(2);
  });
});

describe("终态义务不得设依赖复活 + 崩溃恢复", () => {
  it("resolved/superseded 设任务或义务依赖拒 obligation_terminal", () => {
    const db = openFresh();
    const prj = seedProject(db);
    const { focusId } = createFocus(db, { title: "f", actorKind: "user" });
    const resolved = seedObligation(db, focusId, "已结");
    const superseded = seedObligation(db, focusId, "已替");
    const pre = seedObligation(db, focusId, "前置");
    const task = seedTask(db, prj, "running");
    bindTask(db, focusId, task, newId("fev"));
    db.prepare(
      "UPDATE focus_obligations SET status='resolved', resolution='done', resolution_event_id=? WHERE id=?"
    ).run(newId("fev"), resolved);
    db.prepare(
      "UPDATE focus_obligations SET status='superseded', resolution='abandoned', resolution_event_id=? WHERE id=?"
    ).run(newId("fev"), superseded);
    expect(() =>
      setObligationWaitingOnTask(db, { obligationId: resolved, taskId: task, condition: "accepted" })
    ).toThrowError(/obligation_terminal/);
    expect(() =>
      setObligationWaitingOn(db, { obligationId: superseded, preId: pre, actorKind: "user" })
    ).toThrowError(/obligation_terminal/);
    expect(obRow(db, resolved).waiting_on_task_id).toBeNull();
    expect(obRow(db, superseded).waiting_on_obligation_id).toBeNull();
  });

  it("故障注入:task_done 后未推进依赖,recoverWaitingDependencies 补唤醒", () => {
    const db = openFresh();
    const prj = seedProject(db);
    const { focusId } = createFocus(db, { title: "f", actorKind: "user" });
    const ob = seedObligation(db, focusId, "等交付");
    const task = seedTask(db, prj, "running");
    bindTask(db, focusId, task, newId("fev"));
    setObligationWaitingOnTask(db, { obligationId: ob, taskId: task, condition: "delivered" });
    expect(obRow(db, ob).status).toBe("waiting");
    db.prepare("UPDATE tasks SET status='task_done', updated_at=? WHERE id=?").run(NOW, task);
    expect(obRow(db, ob).status).toBe("waiting");
    const recovered = recoverWaitingDependencies(db);
    expect(recovered.some((r) => r.obligationId === ob && r.taskId === task)).toBe(true);
    expect(obRow(db, ob).status).toBe("open");
    expect(obRow(db, ob).waiting_on_task_id).toBeNull();
    expect(lastEvents(db, focusId, "dependency_task_woken").length).toBe(1);
  });
});


describe("waiting-on 请求互斥", () => {
  it("preId:null 与 taskId 同传也拒绝,保持原等待和事件不变", () => {
    const db = openFresh();
    const prj = seedProject(db);
    const { focusId } = createFocus(db, { title: "f", actorKind: "user" });
    const ob = seedObligation(db, focusId);
    const task = seedTask(db, prj, "running");
    bindTask(db, focusId, task, newId("fev"));
    setObligationWaitingOnTask(db, { obligationId: ob, taskId: task, condition: "accepted" });
    const before = obRow(db, ob);
    const events = db.prepare("SELECT COUNT(*) AS n FROM focus_events").get();
    for (const preId of [null, newId("fob")]) {
      expect(setWaitingOnApi(db, nullAudit, ob, { preId, taskId: task }).status).toBe(400);
      expect(obRow(db, ob)).toEqual(before);
      expect(db.prepare("SELECT COUNT(*) AS n FROM focus_events").get()).toEqual(events);
    }
    expect(setWaitingOnApi(db, createSqliteAuditSink(db), ob, { preId: null }).status).toBe(200);
    expect(obRow(db, ob).waiting_on_task_id).toBeNull();
    db.close();
  });
});


it.each(["activation_closed", "lifecycle_changed", "audit"])("归档在 %s 失败时保留全部会话段与原生命周期", (failure) => {
  const db = openFresh();
  const projectId = seedProject(db);
  const { focusId } = createFocus(db, { title: "事务归档", actorKind: "user" });
  const sessionId = newId("ses");
  db.prepare("INSERT INTO sessions(id, project_id, state, engine, transcript_path, started_at) VALUES (?, ?, 'talking', 'live', '/tmp/archive-test.jsonl', ?)").run(sessionId, projectId, NOW);
  const { activationId } = startActivation(db, { focusId, sessionId, trigger: "user_explicit" });
  const before = db.prepare("SELECT lifecycle, current_revision FROM focuses WHERE id=?").get(focusId);
  const count = db.prepare("SELECT COUNT(*) AS n FROM focus_events WHERE focus_id=?").get(focusId);
  if (failure !== "audit") db.exec(`CREATE TRIGGER reject_archive_event BEFORE INSERT ON focus_events WHEN NEW.type = '${failure}' BEGIN SELECT RAISE(ABORT, 'archive test failure'); END`);
  const base = createSqliteAuditSink(db);
  const audit: AuditSink = failure === "audit" ? { sharesSqlite: (candidate) => base.sharesSqlite!(candidate), record: () => { throw new Error("archive audit failure"); } } : base;
  const result = archiveFocusApi(db, audit, focusId, { reason: "临时收起" });
  expect(result.status).toBe(409);
  expect(db.prepare("SELECT lifecycle, current_revision FROM focuses WHERE id=?").get(focusId)).toEqual(before);
  expect(db.prepare("SELECT status FROM focus_activations WHERE id=?").get(activationId)).toEqual({ status: "active" });
  expect(db.prepare("SELECT COUNT(*) AS n FROM focus_events WHERE focus_id=?").get(focusId)).toEqual(count);
});
