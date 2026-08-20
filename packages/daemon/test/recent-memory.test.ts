import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getRecentMemory, parseRecentMemoryLimit } from "../src/api/recentMemory.js";
import { MemoryLedger } from "../src/memory/ledger.js";
import { openDb } from "../src/storage/db.js";
import type { AuditSink } from "../src/obs/audit.js";

const nullAudit: AuditSink = { record: () => ({ id: "aud_x" }) };

describe("GET /api/memory/recent 投影", () => {
  it("limit 夹紧 1..100,缺省 30", () => {
    expect(parseRecentMemoryLimit(null)).toBe(30);
    expect(parseRecentMemoryLimit("")).toBe(30);
    expect(parseRecentMemoryLimit("0")).toBe(1);
    expect(parseRecentMemoryLimit("999")).toBe(100);
    expect(parseRecentMemoryLimit("12.8")).toBe(12);
  });

  it("含 M2 空 project 行,按 ts 倒序,字段对齐 getProjectMemory + ts", () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-rmem-"));
    const db = openDb(join(dir, "saydo.db"));
    const PRJ = "prj_01F1XT0RE0A0000000000000RM";
    const ledger = new MemoryLedger({
      db,
      audit: nullAudit,
      now: () => new Date("2026-08-01T00:00:00.000Z")
    });
    const m2 = ledger.add({
      tier: "M2",
      claim: "随口记的全局备忘",
      source: { kind: "user_utterance", ref: "trn_m2" }
    });
    expect(m2.projectId).toBeUndefined();

    const ledger2 = new MemoryLedger({
      db,
      audit: nullAudit,
      now: () => new Date("2026-08-02T00:00:00.000Z")
    });
    db.prepare(
      `INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at)
       VALUES (?, 'p', 'coding', 'active', '{}', 'stepwise', ?, ?)`
    ).run(PRJ, "2026-08-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z");
    const m1 = ledger2.add({
      tier: "M1",
      projectId: PRJ,
      claim: "项目结论",
      source: { kind: "user_utterance", ref: "trn_m1" },
      requestedTrust: "user_stated"
    });

    const rows = getRecentMemory(db, nullAudit, 30);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0]).toMatchObject({
      id: m1.id,
      tier: "M1",
      claim: "项目结论",
      ts: "2026-08-02T00:00:00.000Z"
    });
    expect(rows[0]).toHaveProperty("source");
    expect(rows[0]).not.toHaveProperty("projectId");
    const global = rows.find((r) => r["id"] === m2.id);
    expect(global).toMatchObject({
      tier: "M2",
      claim: "随口记的全局备忘",
      ts: "2026-08-01T00:00:00.000Z"
    });

    const one = getRecentMemory(db, nullAudit, 1);
    expect(one).toHaveLength(1);
    expect(one[0]!["id"]).toBe(m1.id);
  });

  it("空库如实空列表", () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-rmem-empty-"));
    const db = openDb(join(dir, "saydo.db"));
    expect(getRecentMemory(db, nullAudit, 10)).toEqual([]);
  });
});
