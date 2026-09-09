// 批 2:GET /api/attention 四色 union 合同(§5.2)。

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { newId, OPEN_SET } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { getAttention } from "../src/api/attention.js";
import { createFocus, changeFocusLifecycle } from "../src/focus/registry.js";
import { upsertObligation } from "../src/focus/obligations.js";
import { withFocusWriteTx } from "../src/focus/writeTx.js";

function seedProject(db: Db): string {
  const home = mkdtempSync(join(tmpdir(), "saydo-att-"));
  const now = new Date().toISOString();
  const projectId = newId("prj");
  db.prepare(
    `INSERT INTO projects(id,title,type,status,workspace_json,exec_mode_default,created_at,updated_at)
     VALUES (?,?, 'coding','active',?,'step_confirm',?,?)`
  ).run(projectId, "p", JSON.stringify({ kind: "local_folder", path: home, managed: true }), now, now);
  return projectId;
}

function seedSession(db: Db, projectId: string): string {
  const now = new Date().toISOString();
  const sessionId = newId("ses");
  db.prepare(
    `INSERT INTO sessions(id,project_id,state,engine,transcript_path,started_at)
     VALUES (?,?, 'talking','live',?,?)`
  ).run(sessionId, projectId, join(tmpdir(), "t.jsonl"), now);
  return sessionId;
}

describe("attention §5.2", () => {
  let db: Db;
  let projectId: string;

  beforeEach(() => {
    const home = mkdtempSync(join(tmpdir(), "saydo-att-db-"));
    db = openDb(join(home, "saydo.db"));
    projectId = seedProject(db);
  });

  it("OPEN_SET 导出含五态", () => {
    expect([...OPEN_SET].sort()).toEqual(
      ["blocked", "deferred", "in_progress", "open", "waiting"].sort()
    );
  });

  it("四色条目:橙确认/橙决策/蓝启动/绿 agent/灰 external + 排序色序", () => {
    const { focusId } = createFocus(db, { title: "推广" });
    changeFocusLifecycle(db, focusId, { to: "active" });

    const sessionId = seedSession(db, projectId);
    const now = new Date().toISOString();
    const exp = new Date(Date.now() + 600_000).toISOString();
    db.prepare(
      `INSERT INTO pending_confirmations(
         session_id, receipt_id, kind, prompt_text, payload_json, digest, digest_version,
         sentence_id, attempt, focus_id, presented_at, expires_at
       ) VALUES (?,?,?,?,?,?,1,?,0,?,?,?)`
    ).run(
      sessionId,
      newId("apr"),
      "focus_obligation",
      "确认开这条线吗",
      JSON.stringify({ kind: "focus_obligation", focusId }),
      "d1",
      "s1",
      focusId,
      now,
      exp
    );

    upsertObligation(db, focusId, {
      kind: "decision",
      title: "选渠道",
      owner: "human",
      status: "open",
      verification: "confirmed",
      dedupeKey: `${focusId}:decision:ch`,
      needs: "decision"
    });
    upsertObligation(db, focusId, {
      kind: "action",
      title: "发邮件",
      owner: "human",
      status: "open",
      verification: "confirmed",
      dedupeKey: `${focusId}:action:mail`,
      needs: "action"
    });
    upsertObligation(db, focusId, {
      kind: "action",
      title: "写草稿",
      owner: "agent",
      status: "in_progress",
      verification: "confirmed",
      dedupeKey: `${focusId}:action:draft`
    });
    upsertObligation(db, focusId, {
      kind: "followup",
      title: "等编辑回信",
      owner: "external",
      status: "waiting",
      verification: "confirmed",
      dedupeKey: `${focusId}:followup:ed`,
      waitingOn: "ed-1"
    });

    const { items } = getAttention(db);
    const colors = items.map((i) => i.color);
    // 色序 orange → blue → green → gray
    const rank = { orange: 0, blue: 1, green: 2, gray: 3 };
    for (let i = 1; i < colors.length; i++) {
      expect(rank[colors[i]!]).toBeGreaterThanOrEqual(rank[colors[i - 1]!]);
    }
    const confirmation = items.find((i) => i.id.startsWith("conf:") && i.color === "orange");
    expect(confirmation).toBeTruthy();
    expect(confirmation?.expiresAt).toBe(exp);
    // GAP-02 残项 2.1:confirmation 条目投影确认环 kind,移动卡据此定按钮文案
    expect(confirmation?.confirmKind).toBe("focus_obligation");
    expect(items.some((i) => i.title === "选渠道" && i.color === "orange")).toBe(true);
    expect(items.some((i) => i.title === "发邮件" && i.color === "blue")).toBe(true);
    expect(items.some((i) => i.title === "写草稿" && i.color === "green")).toBe(true);
    expect(items.some((i) => i.title === "等编辑回信" && i.color === "gray")).toBe(true);
  });

  it("unknown needs 归橙并尾标待归类", () => {
    const { focusId } = createFocus(db, { title: "F" });
    changeFocusLifecycle(db, focusId, { to: "active" });
    upsertObligation(db, focusId, {
      kind: "action",
      title: "含糊事",
      owner: "human",
      status: "open",
      verification: "confirmed",
      dedupeKey: `${focusId}:action:u`,
      needs: "unknown"
    });
    const { items } = getAttention(db);
    const u = items.find((i) => i.needs === "unknown");
    expect(u).toBeTruthy();
    expect(u!.color).toBe("orange");
    expect(u!.title).toContain("待归类");
  });

  it("archived focus 条目不进 attention(停机矩阵)", () => {
    const { focusId } = createFocus(db, { title: "归档了" });
    changeFocusLifecycle(db, focusId, { to: "active" });
    upsertObligation(db, focusId, {
      kind: "decision",
      title: "不该出现",
      owner: "human",
      status: "open",
      verification: "confirmed",
      dedupeKey: `${focusId}:decision:x`,
      needs: "decision"
    });
    changeFocusLifecycle(db, focusId, { to: "archived", reason: "先放放" });
    const { items } = getAttention(db);
    expect(items.every((i) => i.focusId !== focusId)).toBe(true);
  });

  it("reopen 后 attention 重现", () => {
    const { focusId } = createFocus(db, { title: "重开" });
    changeFocusLifecycle(db, focusId, { to: "active" });
    upsertObligation(db, focusId, {
      kind: "decision",
      title: "该出现",
      owner: "human",
      status: "open",
      verification: "confirmed",
      dedupeKey: `${focusId}:decision:y`,
      needs: "decision"
    });
    changeFocusLifecycle(db, focusId, { to: "archived", reason: "暂放" });
    changeFocusLifecycle(db, focusId, { to: "active", reason: "reopen" });
    const { items } = getAttention(db);
    expect(items.some((i) => i.focusId === focusId && i.title === "该出现")).toBe(true);
  });

  it("无 binding 任务不进 attention", () => {
    const now = new Date().toISOString();
    const taskId = newId("tsk");
    db.prepare(
      `INSERT INTO tasks(id,project_id,title,spec_markdown,route,status,adapter,budget_json,created_at,updated_at)
       VALUES (?,?,?,?, 'tier1','ready_for_review','claude_code','{}',?,?)`
    ).run(taskId, projectId, "无绑任务", "s", now, now);
    const { items } = getAttention(db);
    expect(items.some((i) => i.id === `task:${taskId}`)).toBe(false);
  });

  it("pending 引用 obligationId 时义务行让位", () => {
    const { focusId } = createFocus(db, { title: "去重" });
    changeFocusLifecycle(db, focusId, { to: "active" });
    const ob = upsertObligation(db, focusId, {
      kind: "decision",
      title: "被确认引用",
      owner: "human",
      status: "open",
      verification: "confirmed",
      dedupeKey: `${focusId}:decision:ref`,
      needs: "decision"
    });
    const sessionId = seedSession(db, projectId);
    const now = new Date().toISOString();
    const exp = new Date(Date.now() + 600_000).toISOString();
    db.prepare(
      `INSERT INTO pending_confirmations(
         session_id, receipt_id, kind, prompt_text, payload_json, digest, digest_version,
         sentence_id, attempt, focus_id, presented_at, expires_at
       ) VALUES (?,?,?,?,?,?,1,?,0,?,?,?)`
    ).run(
      sessionId,
      newId("apr"),
      "focus_obligation_resolve",
      "办结确认",
      JSON.stringify({
        kind: "focus_obligation_resolve",
        focusId,
        obligationId: ob.obligationId,
        obligationTitle: "被确认引用",
        obKind: "decision",
        obOwner: "human",
        obVerification: "confirmed",
        obDedupeKey: `${focusId}:decision:ref`,
        resolution: "done"
      }),
      "d2",
      "s2",
      focusId,
      now,
      exp
    );
    const { items } = getAttention(db);
    expect(items.some((i) => i.id === `ob:${ob.obligationId}`)).toBe(false);
    expect(items.some((i) => i.id.startsWith("conf:"))).toBe(true);
  });

  it("blocked 任意 owner 进橙且前缀前置已终止", () => {
    const { focusId } = createFocus(db, { title: "阻塞" });
    changeFocusLifecycle(db, focusId, { to: "active" });
    // 先建前置,再 blocked
    const pre = upsertObligation(db, focusId, {
      kind: "action",
      title: "前置",
      owner: "agent",
      status: "open",
      verification: "confirmed",
      dedupeKey: `${focusId}:action:pre`
    });
    withFocusWriteTx(db, {}, (ops) => {
      ops.upsertObligation(focusId, {
        kind: "action",
        title: "后继",
        owner: "agent",
        status: "blocked",
        verification: "confirmed",
        dedupeKey: `${focusId}:action:post`,
        waitingOn: pre.obligationId
      });
    });
    const { items } = getAttention(db);
    const b = items.find((i) => i.title.includes("后继"));
    expect(b).toBeTruthy();
    expect(b!.color).toBe("orange");
    expect(b!.title.startsWith("前置已终止:")).toBe(true);
  });
});
