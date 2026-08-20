// Focus DDL v16/v17 迁移 + v4-era 回归。

import Database from "better-sqlite3";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../src/storage/db.js";
import { MIGRATIONS } from "../src/storage/ddl.js";

const FIXTURE = join(import.meta.dirname, "fixtures", "schema-v4-era.sql");

const FOCUS_TABLES = [
  "focuses",
  "focus_project_refs",
  "focus_states",
  "focus_events",
  "focus_obligations",
  "focus_activations",
  "focus_close_settlements",
  "focus_shadow_projections",
  "focus_compare_records",
  "focus_resume_packets",
  "action_execution_bindings"
] as const;

function columns(db: Db, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((r) => r.name);
}

function tableExists(db: Db, name: string): boolean {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);
}

let dbPath: string;

beforeEach(() => {
  const home = mkdtempSync(join(tmpdir(), "saydo-focus-mig-"));
  dbPath = join(home, "saydo.db");
});

describe("Focus DDL v16/v17/v18/v19/v20/v21/v22/v23/v24", () => {
  it("全新库 openDb 后 Focus 表齐 + sessions 两列 + migrations 尾项=最新", () => {
    const db = openDb(dbPath);
    for (const t of FOCUS_TABLES) {
      expect(tableExists(db, t), t).toBe(true);
    }
    expect(tableExists(db, "focus_auth_snapshots")).toBe(true);
    expect(tableExists(db, "pending_confirmations")).toBe(true);
    expect(tableExists(db, "focus_artifacts")).toBe(true);
    expect(tableExists(db, "focus_spaces")).toBe(true);
    expect(tableExists(db, "session_task_context")).toBe(true);
    expect(tableExists(db, "focus_lanes")).toBe(true);
    expect(columns(db, "focus_obligations")).toContain("lane_id");
    expect(columns(db, "focus_obligations")).toContain("waiting_on_obligation_id");
    const cols = columns(db, "sessions");
    expect(cols).toContain("primary_focus_id");
    expect(cols).toContain("focus_anchor_revision");
    expect(columns(db, "focuses")).toContain("space_id");
    expect(columns(db, "focuses")).toContain("forked_from");
    expect(columns(db, "focus_obligations")).toContain("needs");
    const latest = MIGRATIONS[MIGRATIONS.length - 1]!.version;
    expect(latest).toBeGreaterThanOrEqual(24);
    expect((db.prepare("SELECT MAX(version) AS v FROM schema_migrations").get() as { v: number }).v).toBe(latest);
    // v21:无 type CHECK;v22:lifecycle 含 archived;v23:lanes;v24:artifacts FK
    const feSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='focus_events'").get() as {
      sql: string;
    }).sql;
    expect(feSql).not.toMatch(/CHECK\s*\(\s*type\s+IN/i);
    const focSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='focuses'").get() as {
      sql: string;
    }).sql;
    expect(focSql).toContain("'archived'");
    db.close();
  });

  it("v4-era 老库追赶到最新:Focus 表齐,sessions 两列,幂等再 open", () => {
    const raw = new Database(dbPath);
    raw.exec(readFileSync(FIXTURE, "utf8"));
    const now = "2026-07-25T00:00:00.000Z";
    for (const v of [1, 2, 3, 4]) raw.prepare("INSERT INTO schema_migrations VALUES (?, ?)").run(v, now);
    raw.close();

    const db = openDb(dbPath);
    for (const t of FOCUS_TABLES) {
      expect(tableExists(db, t), t).toBe(true);
    }
    expect(columns(db, "sessions")).toContain("primary_focus_id");
    expect(columns(db, "sessions")).toContain("focus_anchor_revision");
    expect(tableExists(db, "pending_confirmations")).toBe(true);
    expect((db.prepare("SELECT MAX(version) AS v FROM schema_migrations").get() as { v: number }).v).toBe(
      MIGRATIONS[MIGRATIONS.length - 1]!.version
    );
    db.close();

    const db2 = openDb(dbPath);
    expect((db2.prepare("SELECT COUNT(*) AS c FROM schema_migrations WHERE version=16").get() as { c: number }).c).toBe(1);
    expect((db2.prepare("SELECT COUNT(*) AS c FROM schema_migrations WHERE version=17").get() as { c: number }).c).toBe(1);
    expect((db2.prepare("SELECT COUNT(*) AS c FROM schema_migrations WHERE version=19").get() as { c: number }).c).toBe(1);
    expect((db2.prepare("SELECT COUNT(*) AS c FROM schema_migrations WHERE version=20").get() as { c: number }).c).toBe(1);
    expect((db2.prepare("SELECT COUNT(*) AS c FROM schema_migrations WHERE version=21").get() as { c: number }).c).toBe(1);
    expect((db2.prepare("SELECT COUNT(*) AS c FROM schema_migrations WHERE version=22").get() as { c: number }).c).toBe(1);
    db2.close();
  });

  it("v19→v20 additive:pending/artifacts/spaces/task_context/needs/space_id/forked_from", () => {
    // 先建到 v19 再 open 触发 v20
    const raw = new Database(dbPath);
    raw.exec(readFileSync(FIXTURE, "utf8"));
    const now = "2026-07-25T00:00:00.000Z";
    for (const v of [1, 2, 3, 4]) raw.prepare("INSERT INTO schema_migrations VALUES (?, ?)").run(v, now);
    raw.close();
    const db = openDb(dbPath);
    // 模拟已到 v19:删 v20 标记后手动只验证列(open 已应用 v20)
    const pcCols = columns(db, "pending_confirmations");
    for (const c of [
      "session_id",
      "receipt_id",
      "kind",
      "prompt_text",
      "payload_json",
      "digest",
      "digest_version",
      "sentence_id",
      "attempt",
      "focus_id",
      "presented_at",
      "expires_at"
    ]) {
      expect(pcCols).toContain(c);
    }
    const artCols = columns(db, "focus_artifacts");
    for (const c of ["id", "focus_id", "kind", "role", "title", "ref_json", "copied_from_artifact_id", "created_from_event", "created_at"]) {
      expect(artCols).toContain(c);
    }
    expect(columns(db, "session_task_context")).toEqual(
      expect.arrayContaining(["session_id", "ref_kind", "ref_id", "nonce", "set_at"])
    );
    db.close();
  });

  it("focus_events 禁 UPDATE/DELETE", () => {
    const db = openDb(dbPath);
    // 最小 focus 行后插 event
    const now = "2026-08-04T00:00:00.000Z";
    db.prepare(
      `INSERT INTO focuses(id,title,lifecycle,semantic_authority,authority_epoch,current_revision,created_at,updated_at)
       VALUES ('foc_01FOCUSMIGTEST00000000000A','t','captured','saydo',0,0,?,?)`
    ).run(now, now);
    db.prepare(
      `INSERT INTO focus_events(id,focus_id,seq,type,payload_schema_version,payload_json,actor_kind,created_at)
       VALUES ('fev_01FOCUSMIGEVENT0000000000A','foc_01FOCUSMIGTEST00000000000A',1,'created',1,'{"payloadSchemaVersion":1,"title":"t"}','daemon',?)`
    ).run(now);
    expect(() =>
      db.prepare("UPDATE focus_events SET type='correction' WHERE id='fev_01FOCUSMIGEVENT0000000000A'").run()
    ).toThrow(/immutable/);
    expect(() =>
      db.prepare("DELETE FROM focus_events WHERE id='fev_01FOCUSMIGEVENT0000000000A'").run()
    ).toThrow(/immutable/);
    db.close();
  });

  it("UNIQUE(focus_id,dedupe_key) / activation 单 active / settlement 活跃 partial unique", () => {
    const db = openDb(dbPath);
    const now = "2026-08-04T00:00:00.000Z";
    const home = mkdtempSync(join(tmpdir(), "saydo-focus-cons-"));
    db.prepare(
      `INSERT INTO projects(id,title,type,status,workspace_json,exec_mode_default,created_at,updated_at)
       VALUES ('prj_01FOCUSMIG000000000000000A','p','coding','active',?,'step_confirm',?,?)`
    ).run(JSON.stringify({ kind: "local_folder", path: home, managed: true }), now, now);
    db.prepare(
      `INSERT INTO sessions(id,project_id,state,engine,transcript_path,started_at)
       VALUES ('ses_01FOCUSMIG000000000000000A','prj_01FOCUSMIG000000000000000A','talking','live',?,?)`
    ).run(join(home, "t.jsonl"), now);
    db.prepare(
      `INSERT INTO focuses(id,title,lifecycle,semantic_authority,authority_epoch,current_revision,created_at,updated_at)
       VALUES ('foc_01FOCUSMIG000000000000000A','t','active','saydo',0,0,?,?)`
    ).run(now, now);

    const insObl = () =>
      db.prepare(
        `INSERT INTO focus_obligations(id,focus_id,kind,title,owner,status,verification,blocking,dedupe_key,created_at,updated_at)
         VALUES (?,?, 'action','x','agent','open','confirmed',0,'foc:action:k',?,?)`
      );
    insObl().run("fob_01FOCUSMIGAAA0000000000000A", "foc_01FOCUSMIG000000000000000A", now, now);
    expect(() =>
      insObl().run("fob_01FOCUSMIGBBB0000000000000A", "foc_01FOCUSMIG000000000000000A", now, now)
    ).toThrow(/UNIQUE/);

    db.prepare(
      `INSERT INTO focus_activations(id,focus_id,session_id,anchor_revision,input_focus_revision,resume_source,trigger,status,started_at)
       VALUES ('fac_01FOCUSMIGAAA0000000000000A','foc_01FOCUSMIG000000000000000A','ses_01FOCUSMIG000000000000000A',1,0,'cold','user_explicit','active',?)`
    ).run(now);
    expect(() =>
      db.prepare(
        `INSERT INTO focus_activations(id,focus_id,session_id,anchor_revision,input_focus_revision,resume_source,trigger,status,started_at)
         VALUES ('fac_01FOCUSMIGBBB0000000000000A','foc_01FOCUSMIG000000000000000A','ses_01FOCUSMIG000000000000000A',2,0,'cold','user_explicit','active',?)`
      ).run(now)
    ).toThrow(/UNIQUE/);

    db.prepare(
      `INSERT INTO focus_close_settlements(id,session_id,focus_id,activation_id,idempotency_key,close_attempt,frozen_inputs_json,candidates_json,phase,created_at,updated_at)
       VALUES ('fcs_01FOCUSMIGAAA0000000000000A','ses_01FOCUSMIG000000000000000A','foc_01FOCUSMIG000000000000000A','fac_01FOCUSMIGAAA0000000000000A','ses:1',1,'{}','[]','enumerated',?,?)`
    ).run(now, now);
    expect(() =>
      db.prepare(
        `INSERT INTO focus_close_settlements(id,session_id,focus_id,activation_id,idempotency_key,close_attempt,frozen_inputs_json,candidates_json,phase,created_at,updated_at)
         VALUES ('fcs_01FOCUSMIGBBB0000000000000A','ses_01FOCUSMIG000000000000000A','foc_01FOCUSMIG000000000000000A','fac_01FOCUSMIGAAA0000000000000A','ses:2',2,'{}','[]','presented',?,?)`
      ).run(now, now)
    ).toThrow(/UNIQUE/);

    db.close();
  });

  it("focus_resume_packets 禁 UPDATE/DELETE;binding bound 缺 ledger 拒", () => {
    const db = openDb(dbPath);
    const now = "2026-08-04T00:00:00.000Z";
    db.prepare(
      `INSERT INTO focuses(id,title,lifecycle,semantic_authority,authority_epoch,current_revision,created_at,updated_at)
       VALUES ('foc_01FOCUSPKTMIG000000000000A','t','active','saydo',0,1,?,?)`
    ).run(now, now);
    db.prepare(
      `INSERT INTO focus_resume_packets(focus_id,revision,baseline_revision,baseline_event_high_watermark,baseline_obligations_digest,
        compiled_from_json,compiler_version,renderer_version,input_digest,facts_json,obligations_snapshot_json,digest,created_at)
       VALUES ('foc_01FOCUSPKTMIG000000000000A',1,1,0,'sha256:${"a".repeat(64)}','{}','1','1','sha256:${"b".repeat(64)}','[]','[]','sha256:${"c".repeat(64)}',?)`
    ).run(now);
    expect(() =>
      db.prepare("UPDATE focus_resume_packets SET digest='x' WHERE focus_id='foc_01FOCUSPKTMIG000000000000A'").run()
    ).toThrow(/immutable/);
    expect(() =>
      db.prepare("DELETE FROM focus_resume_packets WHERE focus_id='foc_01FOCUSPKTMIG000000000000A'").run()
    ).toThrow(/immutable/);

    expect(() =>
      db.prepare(
        `INSERT INTO action_execution_bindings(id,focus_id,task_id,focus_revision_at_authorization,selected_authority,phase,authorized_by_event_id,created_at,updated_at)
         VALUES ('aeb_01FOCUSMIG000000000000000A','foc_01FOCUSPKTMIG000000000000A','tsk_01FOCUSMIG000000000000000A',1,'tier1','bound','fev_01FOCUSMIG000000000000000A',?,?)`
      ).run(now, now)
    ).toThrow(/CHECK/);
    db.close();
  });
});
