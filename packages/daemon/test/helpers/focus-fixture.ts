// Focus 测试夹具:临时库 + 最小 project/session。

import Database from "better-sqlite3";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newId } from "@saydo/contracts";
import { openDb, type Db } from "../../src/storage/db.js";

export interface FocusFixture {
  home: string;
  dbPath: string;
  db: Db;
  projectId: string;
  sessionId: string;
  close: () => void;
}

export function openFocusFixture(): FocusFixture {
  const home = mkdtempSync(join(tmpdir(), "saydo-focus-"));
  const dbPath = join(home, "saydo.db");
  const db = openDb(dbPath);
  const projectId = newId("prj");
  const sessionId = newId("ses");
  const now = "2026-08-04T00:00:00.000Z";
  db.prepare(
    `INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at)
     VALUES (?, 'focus-test', 'coding', 'active', ?, 'step_confirm', ?, ?)`
  ).run(projectId, JSON.stringify({ kind: "local_folder", path: home, managed: true }), now, now);
  db.prepare(
    `INSERT INTO sessions(id, project_id, state, engine, transcript_path, started_at)
     VALUES (?, ?, 'talking', 'cascade', ?, ?)`
  ).run(sessionId, projectId, join(home, "transcript.jsonl"), now);
  return {
    home,
    dbPath,
    db,
    projectId,
    sessionId,
    close: () => {
      db.close();
    }
  };
}

/** 第二连接(并发/双连接重放测试) */
export function openSecondConnection(dbPath: string): Db {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db as unknown as Db;
}
