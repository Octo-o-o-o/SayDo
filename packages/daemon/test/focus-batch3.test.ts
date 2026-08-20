// Focus 批 3:v23/v24 rebuild + activation 硬门 + 唤醒矩阵 + lane split 消费 + baseline stale。

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { focusEventTypeSchema, newId } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { createFocus } from "../src/focus/registry.js";
import { upsertObligation } from "../src/focus/obligations.js";
import {
  ensureActiveActivationForSession,
  startActivation,
  switchAnchorActivation
} from "../src/focus/activation.js";
import { changeFocusLifecycle } from "../src/focus/registry.js";
import { FocusWriteError, withFocusWriteTx } from "../src/focus/writeTx.js";
import { consumeLaneSplit, redoFromLane, retireLane } from "../src/focus/lanes.js";
import { setObligationWaitingOn } from "../src/focus/dependency.js";
import { openObligationsDigest, maxFocusEventSeq } from "../src/focus/baseline.js";
import { MIGRATIONS } from "../src/storage/ddl.js";

function openFresh(): Db {
  const home = mkdtempSync(join(tmpdir(), "saydo-b3-"));
  return openDb(join(home, "saydo.db"));
}

function seedSession(db: Db, sessionId: string): void {
  // sessions 需要 project 锚;用最小 draft project
  const prj = newId("prj");
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at)
     VALUES (?,?, 'coding', 'active', '{}', 'step_confirm', ?, ?)`
  ).run(prj, "t", now, now);
  db.prepare(
    `INSERT INTO sessions(id, project_id, state, engine, transcript_path, started_at)
     VALUES (?, ?, 'talking', 'live', '/tmp/t.jsonl', ?)`
  ).run(sessionId, prj, new Date().toISOString());
}

describe("批 3 contracts 事件枚举", () => {
  it("新事件类型在 zod 枚举内", () => {
    for (const t of [
      "lane_split",
      "lane_retired",
      "redo_from",
      "dependency_set",
      "dependency_woken",
      "dependency_blocked",
      "artifact_realized"
    ]) {
      expect(focusEventTypeSchema.safeParse(t).success).toBe(true);
    }
  });
});

describe("v23/v24 rebuild", () => {
  it("openDb 追到 v24;focus_lanes 表 + obligations 新列 + artifacts 复合 FK", () => {
    const db = openFresh();
    const ver = (db.prepare("SELECT MAX(version) AS v FROM schema_migrations").get() as { v: number }).v;
    expect(ver).toBe(MIGRATIONS[MIGRATIONS.length - 1]!.version);
    expect(ver).toBeGreaterThanOrEqual(24);

    const lanes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='focus_lanes'")
      .get() as { name: string } | undefined;
    expect(lanes?.name).toBe("focus_lanes");

    const obSql = (
      db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='focus_obligations'").get() as {
        sql: string;
      }
    ).sql;
    expect(obSql).toMatch(/lane_id/i);
    expect(obSql).toMatch(/created_from_event/i);
    expect(obSql).toMatch(/waiting_on_obligation_id/i);

    const artSql = (
      db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='focus_artifacts'").get() as {
        sql: string;
      }
    ).sql;
    expect(artSql).toMatch(/FOREIGN KEY\s*\(\s*focus_id\s*,\s*created_from_event\s*\)/i);

    // 索引
    const idx = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='index' AND name IN ('idx_obligations_lane','idx_obligations_waiting')`
      )
      .all() as { name: string }[];
    expect(idx.map((i) => i.name).sort()).toEqual(["idx_obligations_lane", "idx_obligations_waiting"]);
  });

  it("v23 回填 created_from_event:obligation_opened 按 dedupeKey 匹配", () => {
    const db = openFresh();
    const { focusId } = createFocus(db, { title: "回填测", actorKind: "user" });
    const r = upsertObligation(db, focusId, {
      kind: "action",
      title: "A",
      owner: "human",
      status: "open",
      verification: "confirmed",
      dedupeKey: `${focusId}:action:a1`,
      needs: "action",
      actorKind: "user"
    });
    const row = db
      .prepare("SELECT created_from_event FROM focus_obligations WHERE id = ?")
      .get(r.obligationId) as { created_from_event: number | null };
    // 新写入路径:opened 事件后回填
    expect(row.created_from_event).not.toBeNull();
    expect(row.created_from_event).toBeGreaterThan(0);
  });
});

describe("生命周期合同修订(W2/W3,§8.2→§8.3)", () => {
  let db: Db;
  beforeEach(() => {
    db = openFresh();
  });

  it("W2:captured → archived 合法(刚建的空 Focus 可中途放下)", () => {
    const { focusId } = createFocus(db, { title: "刚建即归档", actorKind: "user" });
    const r = changeFocusLifecycle(db, focusId, { to: "archived", reason: "先放一放", actorKind: "user" });
    expect(r.eventId).toBeTruthy();
    const f = db.prepare("SELECT lifecycle FROM focuses WHERE id = ?").get(focusId) as { lifecycle: string };
    expect(f.lifecycle).toBe("archived");
  });

  it("W3:archived → active(reopen)后方向文本不被系统覆写(J14 联动)", () => {
    const { focusId } = createFocus(db, { title: "方向保留测", actorKind: "user" });
    withFocusWriteTx(db, {}, (ops) =>
      ops.settleRevision(focusId, {
        currentDirection: "把 HN 分发跑通",
        lastReliableState: "用户设定方向",
        actorKind: "user"
      })
    );
    changeFocusLifecycle(db, focusId, { to: "archived", reason: "先放一放", actorKind: "user" });
    changeFocusLifecycle(db, focusId, { to: "active", reason: "reopen", actorKind: "user" });
    const s = db
      .prepare("SELECT current_direction FROM focus_states WHERE focus_id = ? ORDER BY revision DESC LIMIT 1")
      .get(focusId) as { current_direction: string };
    expect(s.current_direction).toBe("把 HN 分发跑通");
  });
});

describe("activation 硬门(A-3)", () => {
  let db: Db;
  beforeEach(() => {
    db = openFresh();
  });

  it("archived focus 上 startActivation / ensure 均拒;reopen 后可 activation", () => {
    const { focusId } = createFocus(db, { title: "归档测", actorKind: "user" });
    // create 后 lifecycle=captured;先激活再归档
    const sid = newId("ses");
    seedSession(db, sid);
    startActivation(db, { focusId, sessionId: sid, trigger: "user_explicit" });
    changeFocusLifecycle(db, focusId, { to: "archived", reason: "pause", actorKind: "user" });

    const sid2 = newId("ses");
    seedSession(db, sid2);
    expect(() =>
      startActivation(db, { focusId, sessionId: sid2, trigger: "user_explicit" })
    ).toThrow(/focus_not_active/);

    // ensure:先把 session 锚到 archived focus
    db.prepare("UPDATE sessions SET primary_focus_id = ?, focus_anchor_revision = 1 WHERE id = ?").run(
      focusId,
      sid2
    );
    expect(() => ensureActiveActivationForSession(db, sid2, focusId)).toThrow(/focus_not_active/);

    changeFocusLifecycle(db, focusId, { to: "active", reason: "reopen", actorKind: "user" });
    const r = startActivation(db, { focusId, sessionId: sid2, trigger: "reopen" });
    expect(r.activationId).toMatch(/^fac_/);
  });

  it("switchAnchor 目标 archived 时零副作用(旧 activation 仍 active)", () => {
    const a = createFocus(db, { title: "A", actorKind: "user" });
    const b = createFocus(db, { title: "B", actorKind: "user" });
    const sid = newId("ses");
    seedSession(db, sid);
    startActivation(db, { focusId: a.focusId, sessionId: sid, trigger: "user_explicit" });
    // B:captured→active→archived
    const sidB = newId("ses");
    seedSession(db, sidB);
    startActivation(db, { focusId: b.focusId, sessionId: sidB, trigger: "user_explicit" });
    // close B's activation then archive
    const actB = db
      .prepare("SELECT id FROM focus_activations WHERE session_id=? AND status='active'")
      .get(sidB) as { id: string };
    withFocusWriteTx(db, {}, (ops) => {
      ops.db
        .prepare(`UPDATE focus_activations SET status='closed', closed_at=?, output_focus_revision=1 WHERE id=?`)
        .run(ops.nowIso, actB.id);
    });
    changeFocusLifecycle(db, b.focusId, { to: "archived", reason: "x", actorKind: "user" });

    const before = db
      .prepare("SELECT id, focus_id, status FROM focus_activations WHERE session_id=? AND status='active'")
      .get(sid) as { id: string; focus_id: string; status: string };
    const anchorBefore = db
      .prepare("SELECT primary_focus_id, focus_anchor_revision FROM sessions WHERE id=?")
      .get(sid) as { primary_focus_id: string; focus_anchor_revision: number };

    expect(() => switchAnchorActivation(db, sid, b.focusId, "user_explicit")).toThrow(/focus_not_active/);

    const after = db
      .prepare("SELECT id, focus_id, status FROM focus_activations WHERE session_id=? AND status='active'")
      .get(sid) as { id: string; focus_id: string; status: string };
    const anchorAfter = db
      .prepare("SELECT primary_focus_id, focus_anchor_revision FROM sessions WHERE id=?")
      .get(sid) as { primary_focus_id: string; focus_anchor_revision: number };
    expect(after.id).toBe(before.id);
    expect(after.focus_id).toBe(a.focusId);
    expect(anchorAfter.primary_focus_id).toBe(anchorBefore.primary_focus_id);
    expect(anchorAfter.focus_anchor_revision).toBe(anchorBefore.focus_anchor_revision);
  });
});

describe("唤醒矩阵", () => {
  let db: Db;
  let focusId: string;
  beforeEach(() => {
    db = openFresh();
    focusId = createFocus(db, { title: "依赖", actorKind: "user" }).focusId;
  });

  it("done 唤醒清两列;abandoned 转 blocked 不改 needs;终态行不被改;幂等", () => {
    const pre = upsertObligation(db, focusId, {
      kind: "action",
      title: "前置",
      owner: "agent",
      status: "open",
      verification: "confirmed",
      dedupeKey: `${focusId}:action:pre`,
      actorKind: "user"
    });
    const dep = upsertObligation(db, focusId, {
      kind: "action",
      title: "后置",
      owner: "human",
      status: "open",
      verification: "confirmed",
      dedupeKey: `${focusId}:action:dep`,
      needs: "action",
      actorKind: "user"
    });
    setObligationWaitingOn(db, { obligationId: dep.obligationId, preId: pre.obligationId });
    const waiting = db
      .prepare("SELECT status, waiting_on, waiting_on_obligation_id, needs FROM focus_obligations WHERE id=?")
      .get(dep.obligationId) as {
      status: string;
      waiting_on: string;
      waiting_on_obligation_id: string;
      needs: string | null;
    };
    expect(waiting.status).toBe("waiting");
    expect(waiting.waiting_on).toBe("前置");
    expect(waiting.waiting_on_obligation_id).toBe(pre.obligationId);
    expect(waiting.needs).toBe("action");

    // done → open + 清两列
    upsertObligation(db, focusId, {
      kind: "action",
      title: "前置",
      owner: "agent",
      status: "resolved",
      verification: "confirmed",
      dedupeKey: `${focusId}:action:pre`,
      resolution: "done",
      evidence: { type: "event", focusId, seq: 1 },
      actorKind: "user"
    });
    const woken = db
      .prepare("SELECT status, waiting_on, waiting_on_obligation_id, needs FROM focus_obligations WHERE id=?")
      .get(dep.obligationId) as {
      status: string;
      waiting_on: string | null;
      waiting_on_obligation_id: string | null;
      needs: string | null;
    };
    expect(woken.status).toBe("open");
    expect(woken.waiting_on).toBeNull();
    expect(woken.waiting_on_obligation_id).toBeNull();
    expect(woken.needs).toBe("action");

    const wokenEv = db
      .prepare("SELECT COUNT(*) AS c FROM focus_events WHERE focus_id=? AND type='dependency_woken'")
      .get(focusId) as { c: number };
    expect(wokenEv.c).toBe(1);

    // 幂等:再 resolve 同 pre 不改已 open 的 dep
    upsertObligation(db, focusId, {
      kind: "action",
      title: "前置",
      owner: "agent",
      status: "resolved",
      verification: "confirmed",
      dedupeKey: `${focusId}:action:pre`,
      resolution: "done",
      evidence: { type: "event", focusId, seq: 1 },
      actorKind: "user"
    });
    const still = db
      .prepare("SELECT status FROM focus_obligations WHERE id=?")
      .get(dep.obligationId) as { status: string };
    expect(still.status).toBe("open");
  });

  it("abandoned 前置 → dep blocked 保留两列 不改 needs", () => {
    const pre = upsertObligation(db, focusId, {
      kind: "action",
      title: "前置B",
      owner: "agent",
      status: "open",
      verification: "confirmed",
      dedupeKey: `${focusId}:action:preb`,
      actorKind: "user"
    });
    const dep = upsertObligation(db, focusId, {
      kind: "action",
      title: "后置B",
      owner: "human",
      status: "open",
      verification: "confirmed",
      dedupeKey: `${focusId}:action:depb`,
      needs: "decision",
      actorKind: "user"
    });
    setObligationWaitingOn(db, { obligationId: dep.obligationId, preId: pre.obligationId });
    upsertObligation(db, focusId, {
      kind: "action",
      title: "前置B",
      owner: "agent",
      status: "resolved",
      verification: "confirmed",
      dedupeKey: `${focusId}:action:preb`,
      resolution: "abandoned",
      actorKind: "user"
    });
    const blocked = db
      .prepare("SELECT status, waiting_on, waiting_on_obligation_id, needs FROM focus_obligations WHERE id=?")
      .get(dep.obligationId) as {
      status: string;
      waiting_on: string | null;
      waiting_on_obligation_id: string | null;
      needs: string | null;
    };
    expect(blocked.status).toBe("blocked");
    expect(blocked.waiting_on).toBe("前置B");
    expect(blocked.waiting_on_obligation_id).toBe(pre.obligationId);
    expect(blocked.needs).toBe("decision");
  });

  it("环检测拒 dependency_cycle", () => {
    const a = upsertObligation(db, focusId, {
      kind: "action",
      title: "A",
      owner: "agent",
      status: "open",
      verification: "confirmed",
      dedupeKey: `${focusId}:action:ca`,
      actorKind: "user"
    });
    const b = upsertObligation(db, focusId, {
      kind: "action",
      title: "B",
      owner: "agent",
      status: "open",
      verification: "confirmed",
      dedupeKey: `${focusId}:action:cb`,
      actorKind: "user"
    });
    setObligationWaitingOn(db, { obligationId: b.obligationId, preId: a.obligationId });
    expect(() =>
      setObligationWaitingOn(db, { obligationId: a.obligationId, preId: b.obligationId })
    ).toThrow(/dependency_cycle/);
  });
});

describe("lane split / retire / parent 未 retired", () => {
  let db: Db;
  let focusId: string;
  beforeEach(() => {
    db = openFresh();
    focusId = createFocus(db, { title: "线", actorKind: "user" }).focusId;
  });

  it("split 消费建线+归义务;baseline 漂移 stale;parent retired 拒", () => {
    const o1 = upsertObligation(db, focusId, {
      kind: "action",
      title: "事1",
      owner: "human",
      status: "open",
      verification: "confirmed",
      dedupeKey: `${focusId}:action:o1`,
      needs: "action",
      actorKind: "user"
    });
    const o2 = upsertObligation(db, focusId, {
      kind: "action",
      title: "事2",
      owner: "human",
      status: "open",
      verification: "confirmed",
      dedupeKey: `${focusId}:action:o2`,
      needs: "action",
      actorKind: "user"
    });

    const baseline = {
      focusRevision: (db.prepare("SELECT current_revision FROM focuses WHERE id=?").get(focusId) as {
        current_revision: number;
      }).current_revision,
      eventHWM: maxFocusEventSeq(db, focusId),
      obligationsDigest: openObligationsDigest(db, focusId)
    };

    const r = consumeLaneSplit(db, {
      focusId,
      lanes: [
        { title: "定价", parentLaneId: null, obligationIds: [o1.obligationId] },
        { title: "文案", parentLaneId: null, obligationIds: [o2.obligationId] }
      ],
      baseline,
      actorKind: "user"
    });
    expect(r.laneIds).toHaveLength(2);
    const l1 = db
      .prepare("SELECT lane_id FROM focus_obligations WHERE id=?")
      .get(o1.obligationId) as { lane_id: string };
    expect(l1.lane_id).toBe(r.laneIds[0]);

    // stale baseline
    expect(() =>
      consumeLaneSplit(db, {
        focusId,
        lanes: [{ title: "再拆", parentLaneId: null, obligationIds: [] }],
        baseline, // 旧
        actorKind: "user"
      })
    ).toThrow(FocusWriteError);

    // parent retired 拒
    const parentId = r.laneIds[0]!;
    retireLane(db, { focusId, laneId: parentId, actorKind: "user" });
    const base2 = {
      focusRevision: (db.prepare("SELECT current_revision FROM focuses WHERE id=?").get(focusId) as {
        current_revision: number;
      }).current_revision,
      eventHWM: maxFocusEventSeq(db, focusId),
      obligationsDigest: openObligationsDigest(db, focusId)
    };
    expect(() =>
      consumeLaneSplit(db, {
        focusId,
        lanes: [{ title: "子", parentLaneId: parentId, obligationIds: [] }],
        baseline: base2,
        actorKind: "user"
      })
    ).toThrow(/lane_parent_retired/);
  });

  it("lane 建子线断言 parent 不存在拒", () => {
    const baseline = {
      focusRevision: 0,
      eventHWM: maxFocusEventSeq(db, focusId),
      obligationsDigest: openObligationsDigest(db, focusId)
    };
    expect(() =>
      consumeLaneSplit(db, {
        focusId,
        lanes: [{ title: "孤", parentLaneId: "lan_01HXXXXXXXXXXXXXXXXXXXXXX", obligationIds: [] }],
        baseline,
        actorKind: "user"
      })
    ).toThrow(/lane_parent_missing|invalid id|lane_parent/);
  });
});
