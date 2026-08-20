// 批次③a:Focus timeline 读模型 + activation 转写懒加载契约。
// a) 事件→item 映射 b) 中断缺尾 endTs=null c) cursor 分页
// d) 转写归属 404 e) 未存转写 available:false f) 响应无 path 泄露

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { newId, type FocusTimelineItem } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import {
  getActivationTranscript,
  getFocusTimeline
} from "../src/api/focusTimeline.js";
import { createFocus } from "../src/focus/registry.js";
import { startActivation, closeActivation } from "../src/focus/activation.js";
import { upsertObligation } from "../src/focus/obligations.js";
import { withFocusWriteTx } from "../src/focus/writeTx.js";

function openFresh(): { db: Db; home: string; projectId: string; sessionId: string; transcriptPath: string } {
  const home = mkdtempSync(join(tmpdir(), "saydo-tl-"));
  const db = openDb(join(home, "saydo.db"));
  const projectId = newId("prj");
  const sessionId = newId("ses");
  const transcriptPath = join(home, "transcripts", `${sessionId}.jsonl`);
  const now = "2026-08-08T10:00:00.000Z";
  db.prepare(
    `INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at)
     VALUES (?, 'tl-test', 'coding', 'active', ?, 'step_confirm', ?, ?)`
  ).run(projectId, JSON.stringify({ kind: "local_folder", path: home, managed: true }), now, now);
  db.prepare(
    `INSERT INTO sessions(id, project_id, state, engine, transcript_path, started_at)
     VALUES (?, ?, 'talking', 'cascade', ?, ?)`
  ).run(sessionId, projectId, transcriptPath, now);
  return { db, home, projectId, sessionId, transcriptPath };
}

function secondSession(db: Db, home: string, projectId: string): { sessionId: string; transcriptPath: string } {
  const sessionId = newId("ses");
  const transcriptPath = join(home, "transcripts", `${sessionId}.jsonl`);
  const now = "2026-08-08T11:00:00.000Z";
  db.prepare(
    `INSERT INTO sessions(id, project_id, state, engine, transcript_path, started_at)
     VALUES (?, ?, 'talking', 'cascade', ?, ?)`
  ).run(sessionId, projectId, transcriptPath, now);
  return { sessionId, transcriptPath };
}

function writeTurns(
  path: string,
  turns: Array<{ turnId: string; speaker: "user" | "ai"; text: string; ts: string }>
): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    turns
      .map((t) =>
        JSON.stringify({
          turnId: t.turnId,
          speaker: t.speaker,
          text: t.text,
          ts: t.ts,
          sentences: [{ sentenceId: "s1", text: t.text, heard: true }],
          engine: "cascade"
        })
      )
      .join("\n") + "\n"
  );
}

describe("focus timeline + activation transcript", () => {
  let db: Db;
  let home: string;
  let projectId: string;
  let sessionId: string;
  let transcriptPath: string;

  beforeEach(() => {
    const fx = openFresh();
    db = fx.db;
    home = fx.home;
    projectId = fx.projectId;
    sessionId = fx.sessionId;
    transcriptPath = fx.transcriptPath;
  });

  afterEach(() => {
    db.close();
  });

  it("a) 事件→item 映射:obligation_opened / artifact_realized / session_segment", () => {
    const { focusId } = createFocus(db, { title: "映射" });
    const act = startActivation(db, {
      focusId,
      sessionId,
      trigger: "user_explicit"
    });
    writeTurns(transcriptPath, [
      {
        turnId: newId("ses"),
        speaker: "user",
        text: "hello",
        ts: "2026-08-08T10:01:00.000Z"
      }
    ]);
    upsertObligation(db, focusId, {
      kind: "action",
      title: "写接口",
      owner: "agent",
      status: "open",
      verification: "confirmed",
      dedupeKey: `${focusId}:action:map1`
    });
    withFocusWriteTx(db, {}, (ops) => {
      const artId = newId("art");
      db.prepare(
        `INSERT INTO focus_artifacts(id, focus_id, kind, role, title, ref_json, created_at)
         VALUES (?,?, 'file','expected',?,?,?)`
      ).run(artId, focusId, "草案", JSON.stringify({}), "2026-08-08T10:02:00.000Z");
      ops.appendEvent(focusId, {
        type: "artifact_realized",
        payload: {
          artifactId: artId,
          title: "草案",
          fromRole: "expected",
          toRole: "deliverable",
          oldRefJson: {},
          newRefJson: { note: "done" }
        },
        actorKind: "daemon"
      });
    });
    closeActivation(db, {
      activationId: act.activationId,
      sessionId,
      focusId
    });

    const out = getFocusTimeline(db, focusId, { limit: 50 });
    expect(out.status).toBe(200);
    const payload = out.payload as { items: FocusTimelineItem[]; nextCursor: number | null };
    expect(payload.nextCursor).toBeNull();

    const kinds = payload.items.map((i) => i.kind);
    expect(kinds).toContain("session_segment");
    expect(kinds).toContain("event");

    const segment = payload.items.find((i) => i.kind === "session_segment");
    expect(segment).toBeDefined();
    if (segment?.kind === "session_segment") {
      expect(segment.sessionRef).toBe(act.activationId);
      expect(segment.endTs).toBeTruthy();
      expect(segment.turnCount).toBe(1);
      expect(segment.transcriptAvailable).toBe(true);
    }

    const ob = payload.items.find(
      (i) => i.kind === "event" && i.eventType === "obligation_opened"
    );
    expect(ob).toBeDefined();
    if (ob?.kind === "event") {
      expect(ob.summary).toContain("写接口");
      expect(ob.refs.obligationId).toBeTruthy();
    }

    const art = payload.items.find(
      (i) => i.kind === "event" && i.eventType === "artifact_realized"
    );
    expect(art).toBeDefined();
    if (art?.kind === "event") {
      expect(art.summary).toContain("草案");
      expect(art.refs.artifactId).toBeTruthy();
    }

    // activation_closed 不单独成 event 项
    expect(
      payload.items.some((i) => i.kind === "event" && i.eventType === "activation_closed")
    ).toBe(false);
    expect(
      payload.items.some((i) => i.kind === "event" && i.eventType === "activation_started")
    ).toBe(false);
  });

  it("b) 中断缺尾段 endTs=null(无 activation_closed)", () => {
    const { focusId } = createFocus(db, { title: "缺尾" });
    const act = startActivation(db, {
      focusId,
      sessionId,
      trigger: "user_explicit"
    });
    // 故意不 close

    const out = getFocusTimeline(db, focusId);
    expect(out.status).toBe(200);
    const items = (out.payload as { items: FocusTimelineItem[] }).items;
    const segment = items.find(
      (i) => i.kind === "session_segment" && i.sessionRef === act.activationId
    );
    expect(segment).toBeDefined();
    if (segment?.kind === "session_segment") {
      expect(segment.endTs).toBeNull();
      expect(segment.startTs).toBeTruthy();
    }
  });

  it("c) cursor 分页:>limit 条无重无漏", () => {
    const { focusId } = createFocus(db, { title: "分页" });
    // createFocus 已有 created 事件;再造多条 obligation_opened
    for (let i = 0; i < 12; i++) {
      upsertObligation(db, focusId, {
        kind: "followup",
        title: `ob-${i}`,
        owner: "human",
        status: "open",
        verification: "confirmed",
        needs: "input",
        dedupeKey: `${focusId}:followup:page-${i}`
      });
    }

    const total = (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM focus_events
           WHERE focus_id = ? AND type != 'activation_closed'`
        )
        .get(focusId) as { c: number }
    ).c;
    expect(total).toBeGreaterThan(10);

    const pageSize = 5;
    const seen = new Set<number>();
    let cursor: number | null = null;
    let pages = 0;
    for (;;) {
      const out = getFocusTimeline(db, focusId, { cursor, limit: pageSize });
      expect(out.status).toBe(200);
      const payload = out.payload as { items: FocusTimelineItem[]; nextCursor: number | null };
      for (const it of payload.items) {
        expect(seen.has(it.seq)).toBe(false);
        seen.add(it.seq);
      }
      // 页内倒序
      for (let i = 1; i < payload.items.length; i++) {
        expect(payload.items[i - 1]!.seq).toBeGreaterThan(payload.items[i]!.seq);
      }
      pages += 1;
      if (payload.nextCursor === null) break;
      cursor = payload.nextCursor;
      expect(pages).toBeLessThan(20); // 防死循环
    }
    expect(seen.size).toBe(total);
    expect(pages).toBeGreaterThan(1);
  });

  it("d) 转写归属校验:aid 不属 fid → 404", () => {
    const { focusId: f1 } = createFocus(db, { title: "F1" });
    const { focusId: f2 } = createFocus(db, { title: "F2" });
    const a1 = startActivation(db, {
      focusId: f1,
      sessionId,
      trigger: "user_explicit"
    });
    const s2 = secondSession(db, home, projectId);
    const a2 = startActivation(db, {
      focusId: f2,
      sessionId: s2.sessionId,
      trigger: "user_explicit"
    });

    // a2 属于 f2,用 f1 查 → 404
    const wrong = getActivationTranscript(db, f1, a2.activationId);
    expect(wrong.status).toBe(404);

    // 不存在的 aid
    const missing = getActivationTranscript(db, f1, newId("fac"));
    expect(missing.status).toBe(404);

    // 正确归属
    writeTurns(transcriptPath, [
      {
        turnId: newId("ses"),
        speaker: "user",
        text: "ok",
        ts: "2026-08-08T10:05:00.000Z"
      }
    ]);
    const ok = getActivationTranscript(db, f1, a1.activationId);
    expect(ok.status).toBe(200);
    const body = ok.payload as { available: boolean; turns?: unknown[] };
    expect(body.available).toBe(true);
    expect(body.turns?.length).toBe(1);
  });

  it("e) 未存转写 → available:false reason not_stored", () => {
    const { focusId } = createFocus(db, { title: "未存" });
    const act = startActivation(db, {
      focusId,
      sessionId,
      trigger: "user_explicit"
    });
    // 不写 transcript 文件

    const out = getActivationTranscript(db, focusId, act.activationId);
    expect(out.status).toBe(200);
    expect(out.payload).toEqual({ available: false, reason: "not_stored" });

    const tl = getFocusTimeline(db, focusId);
    const segment = (tl.payload as { items: FocusTimelineItem[] }).items.find(
      (i) => i.kind === "session_segment"
    );
    expect(segment?.kind === "session_segment" && segment.transcriptAvailable).toBe(false);
    if (segment?.kind === "session_segment") {
      expect(segment.turnCount).toBe(0);
    }
  });

  it("f) 响应体无 transcript_path 与绝对路径字符串", () => {
    const { focusId } = createFocus(db, { title: "脱敏" });
    const act = startActivation(db, {
      focusId,
      sessionId,
      trigger: "user_explicit"
    });
    writeTurns(transcriptPath, [
      {
        turnId: newId("ses"),
        speaker: "ai",
        text: "plain reply without paths",
        ts: "2026-08-08T10:06:00.000Z"
      }
    ]);
    closeActivation(db, { activationId: act.activationId, sessionId, focusId });

    const tl = getFocusTimeline(db, focusId);
    const tr = getActivationTranscript(db, focusId, act.activationId);
    const blob = JSON.stringify({ timeline: tl.payload, transcript: tr.payload });

    expect(blob.includes("transcript_path")).toBe(false);
    expect(blob.includes("transcriptPath")).toBe(false);
    // 绝对路径:本机 temp / 测试 home
    expect(blob.includes(home)).toBe(false);
    expect(blob.includes(transcriptPath)).toBe(false);
    // 常见绝对路径前缀(macOS/Linux)
    expect(/"(?:\/Users\/|\/var\/|\/tmp\/|\/home\/)/.test(blob)).toBe(false);
  });

  it("focus 不存在 → timeline 404", () => {
    const out = getFocusTimeline(db, newId("foc"));
    expect(out.status).toBe(404);
  });
});
