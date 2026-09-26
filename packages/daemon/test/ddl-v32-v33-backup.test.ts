// v32→v33:真实旧库行 + 升级幂等 + 生产 db.backup 恢复/失败边界。不 copy 运行中 WAL,不靠源码字符串断言。

import Database from "better-sqlite3";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { newId } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { MIGRATIONS } from "../src/storage/ddl.js";
import { runSnapshotBackup } from "../src/backup/snapshot.js";

const NOW = "2026-09-20T01:00:00.000Z";
const OB_TITLE = "v32 旧义务行必须活着升级";

function columns(db: Database.Database | Db, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((r) => r.name);
}

function applyThrough(db: Database.Database, maxVersion: number): void {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL);");
  const applied = new Set(
    (db.prepare("SELECT version FROM schema_migrations").all() as { version: number }[]).map((r) => r.version)
  );
  const pending = MIGRATIONS.filter((m) => m.version <= maxVersion && !applied.has(m.version));
  db.pragma("foreign_keys = OFF");
  try {
    for (const m of pending) {
      const run = db.transaction(() => {
        if ("apply" in m) m.apply(db);
        else db.exec(m.sql);
        const violations = db.pragma("foreign_key_check") as unknown[];
        if (violations.length > 0) {
          throw new Error(`migration v${m.version} foreign_key_check failed`);
        }
        db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(m.version, NOW);
      });
      run();
    }
  } finally {
    db.pragma("foreign_keys = ON");
  }
}

function insertV32Obligation(db: Database.Database): { focusId: string; obligationId: string } {
  const focusId = newId("foc");
  const obligationId = newId("fob");
  db.prepare(
    `INSERT INTO focuses(id,title,lifecycle,semantic_authority,authority_epoch,current_revision,created_at,updated_at)
     VALUES (?,?,'active','saydo',0,1,?,?)`
  ).run(focusId, "旧库 Focus", NOW, NOW);
  const cols = columns(db, "focus_obligations");
  expect(cols).not.toContain("waiting_on_task_id");
  expect(cols).not.toContain("waiting_task_condition");
  db.prepare(
    `INSERT INTO focus_obligations(
      id, focus_id, kind, title, detail, owner, status, verification, waiting_on, defer_reason, next_step,
      due_or_trigger, blocking, project_ref, action_ref, source_session_id, source_turn_ref, dedupe_key,
      needs, resolution_event_id, resolution, created_at, updated_at, lane_id, created_from_event, waiting_on_obligation_id
    ) VALUES (?,?, 'action', ?, NULL, 'human', 'open', 'confirmed', NULL, NULL, '核对',
      NULL, 0, NULL, NULL, NULL, NULL, ?, 'action', NULL, NULL, ?, ?, NULL, NULL, NULL)`
  ).run(obligationId, focusId, OB_TITLE, `${focusId}:action:v32`, NOW, NOW);
  return { focusId, obligationId };
}

describe("DDL v32→v33 真实旧行 + backup 恢复", () => {
  it("旧义务行升级后列齐、数据在、再 open 幂等;生产 backup 恢复可读,失败边界不撕源库", async () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-ddl33-"));
    const dbPath = join(home, "saydo.db");
    const raw = new Database(dbPath);
    raw.pragma("journal_mode = WAL");
    applyThrough(raw, 32);
    expect((raw.prepare("SELECT MAX(version) AS v FROM schema_migrations").get() as { v: number }).v).toBe(32);
    const { focusId, obligationId } = insertV32Obligation(raw);
    raw.close();

    const upgraded = openDb(dbPath);
    const cols = columns(upgraded, "focus_obligations");
    expect(cols).toContain("waiting_on_task_id");
    expect(cols).toContain("waiting_task_condition");
    const row = upgraded
      .prepare("SELECT id, title, waiting_on_task_id, waiting_task_condition FROM focus_obligations WHERE id = ?")
      .get(obligationId) as {
      id: string;
      title: string;
      waiting_on_task_id: string | null;
      waiting_task_condition: string | null;
    };
    expect(row.id).toBe(obligationId);
    expect(row.title).toBe(OB_TITLE);
    expect(row.waiting_on_task_id).toBeNull();
    expect(row.waiting_task_condition).toBeNull();
    expect((upgraded.prepare("SELECT MAX(version) AS v FROM schema_migrations").get() as { v: number }).v).toBe(33);
    const v33 = upgraded.prepare("SELECT COUNT(*) AS c FROM schema_migrations WHERE version=33").get() as { c: number };
    expect(v33.c).toBe(1);
    upgraded.close();

    const again = openDb(dbPath);
    expect((again.prepare("SELECT COUNT(*) AS c FROM schema_migrations WHERE version=33").get() as { c: number }).c).toBe(1);
    expect(
      (again.prepare("SELECT title FROM focus_obligations WHERE id = ?").get(obligationId) as { title: string }).title
    ).toBe(OB_TITLE);
    expect((again.prepare("SELECT id FROM focuses WHERE id = ?").get(focusId) as { id: string }).id).toBe(focusId);

    const backupRoot = join(home, "backups");
    const shot = await runSnapshotBackup({
      backupRoot,
      sources: [],
      sqlite: [{ db: again, destName: "saydo.db" }],
      retentionDays: 30,
      now: () => new Date("2026-09-20T02:00:00.000Z")
    });
    expect(existsSync(join(shot.snapshotDir, "saydo.db-wal"))).toBe(false);
    expect(existsSync(join(shot.snapshotDir, "saydo.db-shm"))).toBe(false);
    const restoredPath = join(shot.snapshotDir, "saydo.db");
    const restored = openDb(restoredPath);
    expect(columns(restored, "focus_obligations")).toEqual(expect.arrayContaining(["waiting_on_task_id", "waiting_task_condition"]));
    expect(
      (restored.prepare("SELECT title FROM focus_obligations WHERE id = ?").get(obligationId) as { title: string }).title
    ).toBe(OB_TITLE);
    restored.close();

    await expect(
      runSnapshotBackup({
        backupRoot,
        sources: [],
        sqlite: [{ db: again, destName: "saydo.db" }],
        retentionDays: 30,
        now: () => new Date("2026-09-20T02:00:00.000Z")
      })
    ).rejects.toThrow(/快照目录已存在/);
    expect(
      (again.prepare("SELECT title FROM focus_obligations WHERE id = ?").get(obligationId) as { title: string }).title
    ).toBe(OB_TITLE);
    again.close();
  });
});
