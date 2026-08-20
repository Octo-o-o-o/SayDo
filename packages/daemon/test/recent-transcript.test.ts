import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getRecentTranscript, parseRecentTranscriptLimit } from "../src/api/recentTranscript.js";
import { openDb } from "../src/storage/db.js";
import type { Db } from "../src/storage/db.js";

function seedSession(
  db: Db,
  row: { id: string; projectId: string; state: string; startedAt: string; transcriptPath: string }
): void {
  db.prepare(
    `INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at)
     VALUES (?, 'p', 'coding', 'active', '{}', 'stepwise', ?, ?)`
  ).run(row.projectId, row.startedAt, row.startedAt);
  db.prepare(
    `INSERT INTO sessions(id, project_id, project_revision, state, engine, transcript_path, started_at)
     VALUES (?, ?, 0, ?, 'cascade', ?, ?)`
  ).run(row.id, row.projectId, row.state, row.transcriptPath, row.startedAt);
}

describe("GET /api/sessions/recent-transcript 投影", () => {
  it("limit 夹紧 1..200,缺省 40", () => {
    expect(parseRecentTranscriptLimit(null)).toBe(40);
    expect(parseRecentTranscriptLimit("0")).toBe(1);
    expect(parseRecentTranscriptLimit("999")).toBe(200);
    expect(parseRecentTranscriptLimit("12.8")).toBe(12);
  });

  it("talking 优先于更新的 suspended,尾 N 轮含 speaker/text/origin", () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-rt-"));
    const db = openDb(join(dir, "saydo.db"));
    const talkingPath = join(dir, "talking.jsonl");
    const newerPath = join(dir, "newer.jsonl");
    writeFileSync(
      talkingPath,
      [
        JSON.stringify({ turnId: "trn_old", ts: "2026-08-01T00:00:00.000Z", speaker: "user", text: "旧轮", sentences: [], engine: "cascade" }),
        JSON.stringify({
          turnId: "trn_onb",
          ts: "2026-08-01T00:01:00.000Z",
          speaker: "ai",
          text: "开场白",
          origin: "onboarding",
          sentences: [],
          engine: "cascade"
        }),
        JSON.stringify({ turnId: "trn_new", ts: "2026-08-01T00:02:00.000Z", speaker: "user", text: "新轮", sentences: [], engine: "cascade" })
      ].join("\n") + "\n"
    );
    writeFileSync(
      newerPath,
      JSON.stringify({ turnId: "trn_x", ts: "2026-08-11T00:00:00.000Z", speaker: "user", text: "不应选中", sentences: [], engine: "cascade" }) +
        "\n"
    );
    seedSession(db, {
      id: "ses_talking",
      projectId: "prj_rt_1",
      state: "talking",
      startedAt: "2026-08-01T00:00:00.000Z",
      transcriptPath: talkingPath
    });
    seedSession(db, {
      id: "ses_newer",
      projectId: "prj_rt_2",
      state: "suspended",
      startedAt: "2026-08-11T00:00:00.000Z",
      transcriptPath: newerPath
    });

    const full = getRecentTranscript(db, 40);
    expect(full.sessionId).toBe("ses_talking");
    expect(full.projectId).toBe("prj_rt_1");
    expect(full.turns).toHaveLength(3);
    expect(full.turns[1]).toMatchObject({ speaker: "ai", text: "开场白", origin: "onboarding" });

    const tail = getRecentTranscript(db, 1);
    expect(tail.turns).toEqual([expect.objectContaining({ speaker: "user", text: "新轮", turnId: "trn_new" })]);
  });

  it("无会话或文件缺失如实空列表", () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-rt-empty-"));
    const db = openDb(join(dir, "saydo.db"));
    expect(getRecentTranscript(db, 10)).toEqual({ sessionId: null, projectId: null, turns: [] });

    seedSession(db, {
      id: "ses_missing",
      projectId: "prj_rt_m",
      state: "closed",
      startedAt: "2026-08-01T00:00:00.000Z",
      transcriptPath: join(dir, "missing.jsonl")
    });
    expect(getRecentTranscript(db, 10)).toEqual({
      sessionId: "ses_missing",
      projectId: "prj_rt_m",
      turns: []
    });
  });
});
