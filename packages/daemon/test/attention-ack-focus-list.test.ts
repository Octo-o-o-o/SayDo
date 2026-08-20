// 批次②:attention ack 生命周期 + Focus 列表 openByOwner/projectRefs 投影契约。
// F2:ack 过滤按当前颜色;绿→橙 / 灰→蓝 必重现;橙/蓝拒 ack。

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { newId } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import {
  ackAttention,
  ackAttentionApi,
  getAttention
} from "../src/api/attention.js";
import { getFocusList } from "../src/api/console.js";
import { createFocus, changeFocusLifecycle } from "../src/focus/registry.js";
import { upsertObligation } from "../src/focus/obligations.js";

function openFresh(): Db {
  const home = mkdtempSync(join(tmpdir(), "saydo-ack-"));
  return openDb(join(home, "saydo.db"));
}

function seedProject(db: Db): string {
  const home = mkdtempSync(join(tmpdir(), "saydo-ack-ws-"));
  const now = new Date().toISOString();
  const projectId = newId("prj");
  db.prepare(
    `INSERT INTO projects(id,title,type,status,workspace_json,exec_mode_default,created_at,updated_at)
     VALUES (?,?, 'coding','active',?,'step_confirm',?,?)`
  ).run(projectId, "p", JSON.stringify({ kind: "local_folder", path: home, managed: true }), now, now);
  return projectId;
}

function seedBoundTask(
  db: Db,
  opts: { projectId: string; focusId: string; status: string; title?: string }
): string {
  const now = new Date().toISOString();
  const taskId = newId("tsk");
  db.prepare(
    `INSERT INTO tasks(id,project_id,title,spec_markdown,route,status,adapter,budget_json,created_at,updated_at)
     VALUES (?,?,?,?, 'tier1',?,'claude_code','{}',?,?)`
  ).run(taskId, opts.projectId, opts.title ?? "bound-task", "s", opts.status, now, now);
  db.prepare(
    `INSERT INTO action_execution_bindings(
       id,focus_id,task_id,focus_revision_at_authorization,selected_authority,phase,
       authorized_by_event_id,created_at,updated_at
     ) VALUES (?,?,?,0,'tier1','authorized',?,?,?)`
  ).run(newId("aeb"), opts.focusId, taskId, newId("fev"), now, now);
  return taskId;
}

describe("attention ack + focus list projection", () => {
  let db: Db;
  let projectId: string;

  beforeEach(() => {
    db = openFresh();
    projectId = seedProject(db);
  });

  it("a) green 条目 ack → GET 不含该条", () => {
    const { focusId } = createFocus(db, { title: "绿ack" });
    changeFocusLifecycle(db, focusId, { to: "active" });
    const ob = upsertObligation(db, focusId, {
      kind: "action",
      title: "agent 干活",
      owner: "agent",
      status: "in_progress",
      verification: "confirmed",
      dedupeKey: `${focusId}:action:green1`
    });
    const itemId = `ob:${ob.obligationId}`;
    expect(getAttention(db).items.some((i) => i.id === itemId && i.color === "green")).toBe(true);

    const r = ackAttention(db, itemId);
    expect(r).toEqual({ ok: true });
    expect(getAttention(db).items.some((i) => i.id === itemId)).toBe(false);

    const row = db
      .prepare("SELECT acked_at FROM attention_acks WHERE item_id = ?")
      .get(itemId) as { acked_at: string } | undefined;
    expect(row?.acked_at).toBeTruthy();
  });

  it("b) 同 task 先 green 被 ack,再 ready_for_review(橙) → GET 必含", () => {
    const { focusId } = createFocus(db, { title: "绿转橙" });
    changeFocusLifecycle(db, focusId, { to: "active" });
    const taskId = seedBoundTask(db, {
      projectId,
      focusId,
      status: "running",
      title: "跑中变验收"
    });
    const itemId = `task:${taskId}`;
    expect(getAttention(db).items.find((i) => i.id === itemId)?.color).toBe("green");

    expect(ackAttention(db, itemId)).toEqual({ ok: true });
    expect(getAttention(db).items.some((i) => i.id === itemId)).toBe(false);

    // 直接 SQL 状态迁移:running → ready_for_review(橙)
    db.prepare("UPDATE tasks SET status = 'ready_for_review', updated_at = ? WHERE id = ?").run(
      new Date().toISOString(),
      taskId
    );
    const after = getAttention(db).items.find((i) => i.id === itemId);
    expect(after).toBeTruthy();
    expect(after!.color).toBe("orange");
    // 历史 ack 可附带返回,但不得过滤
    expect(after!.ackedAt).toBeTruthy();
  });

  it("c) 同 obligation 先 gray(external waiting)被 ack,再 human+action+open(蓝) → GET 必含", () => {
    const { focusId } = createFocus(db, { title: "灰转蓝" });
    changeFocusLifecycle(db, focusId, { to: "active" });
    const dedupe = `${focusId}:followup:gray2blue`;
    const ob = upsertObligation(db, focusId, {
      kind: "followup",
      title: "等外部",
      owner: "external",
      status: "waiting",
      verification: "confirmed",
      dedupeKey: dedupe,
      waitingOn: "ext-1"
    });
    const itemId = `ob:${ob.obligationId}`;
    expect(getAttention(db).items.find((i) => i.id === itemId)?.color).toBe("gray");

    expect(ackAttention(db, itemId)).toEqual({ ok: true });
    expect(getAttention(db).items.some((i) => i.id === itemId)).toBe(false);

    // 灰→蓝的真实字段变化是 owner 变 human(+ needs=action + status=open),不是只改 needs
    upsertObligation(db, focusId, {
      id: ob.obligationId,
      kind: "followup",
      title: "等外部",
      owner: "human",
      status: "open",
      verification: "confirmed",
      dedupeKey: dedupe,
      needs: "action"
    });
    const after = getAttention(db).items.find((i) => i.id === itemId);
    expect(after).toBeTruthy();
    expect(after!.color).toBe("blue");
    expect(after!.ackedAt).toBeTruthy();
  });

  it("d) 橙色条目 POST ack → 409,ack 表无写入", () => {
    const { focusId } = createFocus(db, { title: "拒橙" });
    changeFocusLifecycle(db, focusId, { to: "active" });
    const ob = upsertObligation(db, focusId, {
      kind: "decision",
      title: "选方案",
      owner: "human",
      status: "open",
      verification: "confirmed",
      dedupeKey: `${focusId}:decision:orange1`,
      needs: "decision"
    });
    const itemId = `ob:${ob.obligationId}`;
    expect(getAttention(db).items.find((i) => i.id === itemId)?.color).toBe("orange");

    const r = ackAttention(db, itemId);
    expect(r).toEqual({ ok: false, code: "not_calm" });
    const api = ackAttentionApi(db, encodeURIComponent(itemId));
    expect(api.status).toBe(409);
    expect(api.payload).toEqual({ error: "not_calm" });

    const cnt = db
      .prepare("SELECT COUNT(*) AS c FROM attention_acks WHERE item_id = ?")
      .get(itemId) as { c: number };
    expect(cnt.c).toBe(0);
  });

  it("e) openByOwner 只统计 obligation:1 human open + 1 ready_for_review task → human=1", () => {
    const { focusId } = createFocus(db, { title: "openBy" });
    changeFocusLifecycle(db, focusId, { to: "active" });
    upsertObligation(db, focusId, {
      kind: "action",
      title: "人要做",
      owner: "human",
      status: "open",
      verification: "confirmed",
      dedupeKey: `${focusId}:action:human1`,
      needs: "action"
    });
    seedBoundTask(db, {
      projectId,
      focusId,
      status: "ready_for_review",
      title: "待验收任务"
    });

    const list = getFocusList(db);
    const row = list.find((f) => f.id === focusId);
    expect(row).toBeTruthy();
    expect(row!.openByOwner).toEqual({ human: 1, agent: 0, external: 0 });
    expect(row!.openObligationCount).toBe(1);
  });

  it("M1 fourState 单 SQL 聚合四组互斥覆盖 obligation", () => {
    const { focusId } = createFocus(db, { title: "四状态" });
    changeFocusLifecycle(db, focusId, { to: "active" });
    const seeds = [
      { title: "排队", owner: "agent" as const, status: "open" as const, needs: undefined },
      { title: "进行中", owner: "agent" as const, status: "in_progress" as const, needs: undefined },
      { title: "需要你", owner: "human" as const, status: "open" as const, needs: "action" as const },
      { title: "已收尾", owner: "human" as const, status: "resolved" as const, needs: undefined }
    ];
    seeds.forEach((seed, index) =>
      upsertObligation(db, focusId, {
        kind: "action",
        title: seed.title,
        owner: seed.owner,
        status: seed.status,
        verification: "confirmed",
        dedupeKey: `${focusId}:four:${index}`,
        ...(seed.needs ? { needs: seed.needs } : {}),
        ...(seed.status === "resolved" ? { resolution: "done" as const } : {})
      })
    );

    const row = getFocusList(db).find((focus) => focus.id === focusId);
    expect(row?.fourState).toEqual({ queued: 1, running: 1, needsYou: 1, settled: 1 });
    expect(Object.values(row?.fourState ?? {}).reduce((sum, count) => sum + count, 0)).toBe(4);
  });

  it("f) projectRefs 与 focus_project_refs 表内容一致", () => {
    const { focusId } = createFocus(db, { title: "refs" });
    changeFocusLifecycle(db, focusId, { to: "active" });
    const p2 = seedProject(db);
    const now = new Date().toISOString();
    // 需 focus_events 行作 added_by_event_id 引用时可不强制 FK;表定义无 FK 到 events
    const evId = newId("fev");
    db.prepare(
      `INSERT INTO focus_project_refs(focus_id, project_id, added_by_event_id, added_at)
       VALUES (?,?,?,?)`
    ).run(focusId, projectId, evId, now);
    db.prepare(
      `INSERT INTO focus_project_refs(focus_id, project_id, added_by_event_id, added_at)
       VALUES (?,?,?,?)`
    ).run(focusId, p2, newId("fev"), now);
    // removed 不应出现(removed_at 与 removed_by_event_id 必须同有/同无)
    db.prepare(
      `INSERT INTO focus_project_refs(focus_id, project_id, added_by_event_id, removed_by_event_id, removed_at, added_at)
       VALUES (?,?,?,?,?,?)`
    ).run(focusId, seedProject(db), newId("fev"), newId("fev"), now, now);

    const expected = (
      db
        .prepare(
          `SELECT project_id FROM focus_project_refs
           WHERE focus_id = ? AND removed_at IS NULL
           ORDER BY project_id`
        )
        .all(focusId) as Array<{ project_id: string }>
    ).map((r) => r.project_id);

    const row = getFocusList(db).find((f) => f.id === focusId)!;
    expect([...row.projectRefs].sort()).toEqual([...expected].sort());
    expect(row.projectRefs).toHaveLength(2);
  });

  it("g) 路由级:encodeURIComponent(id) 经 ackAttentionApi(decodeURIComponent) 成功", () => {
    const { focusId } = createFocus(db, { title: "路由" });
    changeFocusLifecycle(db, focusId, { to: "active" });
    const ob = upsertObligation(db, focusId, {
      kind: "action",
      title: "绿 agent",
      owner: "agent",
      status: "open",
      verification: "confirmed",
      dedupeKey: `${focusId}:action:route`
    });
    const itemId = `ob:${ob.obligationId}`;
    // 模拟 HTTP path 段: /api/attention/<encodeURIComponent(id)>/ack
    const encoded = encodeURIComponent(itemId);
    expect(encoded).toContain("%3A"); // 冒号被编码
    expect(encoded).not.toBe(itemId);

    const out = ackAttentionApi(db, encoded);
    expect(out.status).toBe(200);
    expect(out.payload).toEqual({ ok: true });
    expect(getAttention(db).items.some((i) => i.id === itemId)).toBe(false);

    // not_found
    const miss = ackAttentionApi(db, encodeURIComponent("ob:does-not-exist"));
    expect(miss.status).toBe(404);
    expect(miss.payload).toEqual({ error: "not_found" });
  });

  it("migration v25:attention_acks 表存在", () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='attention_acks'")
      .get() as { name: string } | undefined;
    expect(row?.name).toBe("attention_acks");
    const cols = db.prepare("PRAGMA table_info(attention_acks)").all() as Array<{ name: string }>;
    expect(cols.map((c) => c.name).sort()).toEqual(["acked_at", "item_id"]);
  });
});
