// Focus 批 1.5:v21 focus_events rebuild + needs 回填;v22 focuses lifecycle 六值 rebuild。
// fixture 停在 v20 态(有 type CHECK / 五值 lifecycle)+ 种子数据 → openDb 追赶到 v22 断言。

import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { focusEventTypeSchema, focusLifecycleSchema } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { MIGRATIONS } from "../src/storage/ddl.js";

const ALL_EVENT_TYPES = [
  "created",
  "activation_started",
  "activation_closed",
  "revision_settled",
  "obligation_opened",
  "obligation_status_changed",
  "obligation_resolved",
  "lifecycle_changed",
  "project_ref_added",
  "project_ref_removed",
  "packet_frozen",
  "packet_confirmed",
  "binding_authorized",
  "binding_ledger_bound",
  "authority_transfer",
  "close_settlement",
  "correction"
] as const;

const FOCUS_ID = "foc_01FOCUSREBUILD00000000000A";
const NOW = "2026-08-05T00:00:00.000Z";

let dbPath: string;

beforeEach(() => {
  const home = mkdtempSync(join(tmpdir(), "saydo-focus-rebuild-"));
  dbPath = join(home, "saydo.db");
});

/** 仅应用 migrations ≤ maxVersion(连接级 FK OFF,与 openDb.migrate 同纪律) */
function migrateUpTo(raw: Database.Database, maxVersion: number): void {
  raw.pragma("journal_mode = WAL");
  raw.pragma("foreign_keys = OFF");
  raw.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL);"
  );
  const applied = new Set(
    (raw.prepare("SELECT version FROM schema_migrations").all() as { version: number }[]).map((r) => r.version)
  );
  const pending = MIGRATIONS.filter((m) => m.version <= maxVersion && !applied.has(m.version));
  for (const m of pending) {
    const run = raw.transaction(() => {
      if ("apply" in m) m.apply(raw as never);
      else raw.exec(m.sql);
      const violations = raw.pragma("foreign_key_check") as unknown[];
      if (violations.length > 0) {
        throw new Error(`migrateUpTo v${m.version} fk_check: ${JSON.stringify(violations).slice(0, 200)}`);
      }
      raw.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(m.version, NOW);
    });
    run();
  }
  raw.pragma("foreign_keys = ON");
}

function eventsChecksum(db: Database.Database | Db): string {
  const rows = db
    .prepare(
      `SELECT focus_id, seq, type, payload_json FROM focus_events ORDER BY focus_id ASC, seq ASC`
    )
    .all() as { focus_id: string; seq: number; type: string; payload_json: string }[];
  const h = createHash("sha256");
  for (const r of rows) {
    h.update(r.focus_id);
    h.update("\0");
    h.update(String(r.seq));
    h.update("\0");
    h.update(r.type);
    h.update("\0");
    h.update(r.payload_json);
    h.update("\n");
  }
  return h.digest("hex");
}

function focusesChecksum(db: Database.Database | Db): string {
  const rows = db
    .prepare(
      `SELECT id, title, lifecycle, semantic_authority, authority_epoch, current_revision,
              created_at, updated_at, space_id, forked_from
         FROM focuses ORDER BY id ASC`
    )
    .all() as Record<string, string | number | null>[];
  const h = createHash("sha256");
  for (const r of rows) {
    h.update(
      [
        r.id,
        r.title,
        r.lifecycle,
        r.semantic_authority,
        String(r.authority_epoch),
        String(r.current_revision),
        r.created_at,
        r.updated_at,
        r.space_id ?? "",
        r.forked_from ?? ""
      ].join("\0")
    );
    h.update("\n");
  }
  return h.digest("hex");
}

/** 建 v20 库并播种:全 type 事件 + 若干 needs NULL obligations + 一个 focus */
function buildV20Fixture(): {
  eventCount: number;
  eventChecksum: string;
  focusChecksum: string;
  focusCount: number;
} {
  const raw = new Database(dbPath);
  migrateUpTo(raw, 20);

  // 确认 v20 形态:有 type CHECK、lifecycle 无 archived
  const feSql = (raw.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='focus_events'").get() as {
    sql: string;
  }).sql;
  expect(feSql).toMatch(/CHECK\s*\(\s*type\s+IN/i);
  const focSql = (raw.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='focuses'").get() as {
    sql: string;
  }).sql;
  expect(focSql).not.toContain("'archived'");

  raw
    .prepare(
      `INSERT INTO focuses(id, title, lifecycle, semantic_authority, authority_epoch, current_revision, created_at, updated_at)
       VALUES (?, 'rebuild fixture', 'active', 'saydo', 0, 0, ?, ?)`
    )
    .run(FOCUS_ID, NOW, NOW);

  let seq = 0;
  for (const type of ALL_EVENT_TYPES) {
    seq += 1;
    const id = `fev_01FOCUSREBUILD${String(seq).padStart(12, "0")}A`;
    raw
      .prepare(
        `INSERT INTO focus_events(id, focus_id, seq, type, payload_schema_version, payload_json, actor_kind, created_at)
         VALUES (?, ?, ?, ?, 1, ?, 'daemon', ?)`
      )
      .run(id, FOCUS_ID, seq, type, JSON.stringify({ payloadSchemaVersion: 1, fixture: type }), NOW);
  }

  // obligations:needs 回填矩阵
  const obl = (
    id: string,
    kind: string,
    owner: string,
    status: string,
    needs: string | null,
    dedupe: string
  ) => {
    raw
      .prepare(
        `INSERT INTO focus_obligations(
           id, focus_id, kind, title, owner, status, verification, blocking, dedupe_key,
           needs, resolution_event_id, resolution, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, 'confirmed', 0, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        FOCUS_ID,
        kind,
        `t-${kind}`,
        owner,
        status,
        dedupe,
        needs,
        status === "resolved" ? `fev_01FOCUSREBUILD${String(1).padStart(12, "0")}A` : null,
        status === "resolved" ? "done" : null,
        NOW,
        NOW
      );
  };

  obl("fob_01FOCUSREBUILDDEC000000000A", "decision", "human", "open", null, `${FOCUS_ID}:decision:d1`);
  obl("fob_01FOCUSREBUILDANS000000000A", "answer", "human", "open", null, `${FOCUS_ID}:answer:a1`);
  obl("fob_01FOCUSREBUILDACT000000000A", "action", "human", "open", null, `${FOCUS_ID}:action:x1`);
  obl("fob_01FOCUSREBUILDFUP000000000A", "followup", "human", "open", null, `${FOCUS_ID}:followup:f1`);
  obl("fob_01FOCUSREBUILDCHK000000000A", "check", "human", "open", null, `${FOCUS_ID}:check:c1`);
  obl("fob_01FOCUSREBUILDAGT000000000A", "action", "agent", "open", null, `${FOCUS_ID}:action:agent1`);
  obl("fob_01FOCUSREBUILDRES000000000A", "decision", "human", "resolved", null, `${FOCUS_ID}:decision:done`);
  // 已有 needs 不得被覆盖
  obl("fob_01FOCUSREBUILDEXP000000000A", "action", "human", "open", "action", `${FOCUS_ID}:action:keep`);

  const eventCount = (raw.prepare("SELECT COUNT(*) AS c FROM focus_events").get() as { c: number }).c;
  const focusCount = (raw.prepare("SELECT COUNT(*) AS c FROM focuses").get() as { c: number }).c;
  const eventChecksum = eventsChecksum(raw);
  const focusChecksum = focusesChecksum(raw);
  expect(eventCount).toBe(ALL_EVENT_TYPES.length);
  expect((raw.prepare("SELECT MAX(version) AS v FROM schema_migrations").get() as { v: number }).v).toBe(20);
  raw.close();
  return { eventCount, eventChecksum, focusChecksum, focusCount };
}

describe("v21/v22 controlled rebuild", () => {
  it("v20 fixture → 迁移:行数/内容不变、UNIQUE、新 type 可插、needs 回填、immutable、fk 零行", () => {
    const before = buildV20Fixture();
    const db = openDb(dbPath);

    expect((db.prepare("SELECT MAX(version) AS v FROM schema_migrations").get() as { v: number }).v).toBe(
      MIGRATIONS[MIGRATIONS.length - 1]!.version
    );
    expect((db.prepare("SELECT COUNT(*) AS c FROM focus_events").get() as { c: number }).c).toBe(before.eventCount);
    expect(eventsChecksum(db)).toBe(before.eventChecksum);
    expect((db.prepare("SELECT COUNT(*) AS c FROM focuses").get() as { c: number }).c).toBe(before.focusCount);
    expect(focusesChecksum(db)).toBe(before.focusChecksum);

    // 无 type CHECK
    const feSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='focus_events'").get() as {
      sql: string;
    }).sql;
    expect(feSql).not.toMatch(/CHECK\s*\(\s*type\s+IN/i);
    expect(feSql).toMatch(/UNIQUE\s*\(\s*focus_id\s*,\s*seq\s*\)/i);

    // 新事件类型字符串可插入(库层不再拒);批 3 起 zod 枚举含 lane_split
    expect(() =>
      db
        .prepare(
          `INSERT INTO focus_events(id, focus_id, seq, type, payload_schema_version, payload_json, actor_kind, created_at)
           VALUES ('fev_01FOCUSREBUILDLANE000000A', ?, ?, 'lane_split', 1, '{}', 'daemon', ?)`
        )
        .run(FOCUS_ID, before.eventCount + 1, NOW)
    ).not.toThrow();
    expect(focusEventTypeSchema.safeParse("lane_split").success).toBe(true);

    // UNIQUE(focus_id, seq) 生效
    expect(() =>
      db
        .prepare(
          `INSERT INTO focus_events(id, focus_id, seq, type, payload_schema_version, payload_json, actor_kind, created_at)
           VALUES ('fev_01FOCUSREBUILDDUPE000000A', ?, 1, 'created', 1, '{}', 'daemon', ?)`
        )
        .run(FOCUS_ID, NOW)
    ).toThrow(/UNIQUE/);

    // needs 回填
    const needsOf = (id: string) =>
      (db.prepare("SELECT needs FROM focus_obligations WHERE id=?").get(id) as { needs: string | null }).needs;
    expect(needsOf("fob_01FOCUSREBUILDDEC000000000A")).toBe("decision");
    expect(needsOf("fob_01FOCUSREBUILDANS000000000A")).toBe("input");
    expect(needsOf("fob_01FOCUSREBUILDACT000000000A")).toBe("unknown");
    expect(needsOf("fob_01FOCUSREBUILDFUP000000000A")).toBe("unknown");
    expect(needsOf("fob_01FOCUSREBUILDCHK000000000A")).toBe("unknown");
    expect(needsOf("fob_01FOCUSREBUILDAGT000000000A")).toBeNull();
    expect(needsOf("fob_01FOCUSREBUILDRES000000000A")).toBeNull();
    expect(needsOf("fob_01FOCUSREBUILDEXP000000000A")).toBe("action");

    // immutable triggers
    const anyId = (
      db.prepare("SELECT id FROM focus_events WHERE focus_id=? AND seq=1").get(FOCUS_ID) as { id: string }
    ).id;
    expect(() => db.prepare("UPDATE focus_events SET type='correction' WHERE id=?").run(anyId)).toThrow(/immutable/);
    expect(() => db.prepare("DELETE FROM focus_events WHERE id=?").run(anyId)).toThrow(/immutable/);

    // foreign_key_check 零行
    const violations = db.prepare("PRAGMA foreign_key_check").all() as unknown[];
    expect(violations).toEqual([]);

    // 触发器/索引登记
    const triggers = (
      db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='focus_events' ORDER BY name").all() as {
        name: string;
      }[]
    ).map((r) => r.name);
    expect(triggers).toEqual(["focus_events_no_delete", "focus_events_no_update"]);
    const indexes = (
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='focuses' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
        .all() as { name: string }[]
    ).map((r) => r.name);
    expect(indexes).toEqual(expect.arrayContaining(["idx_focuses_forked_from", "idx_focuses_space_lifecycle"]));

    db.close();
  });

  it("v22:lifecycle=archived 可写;bogus 被 zod 拒;库层 CHECK 仍拦非法值", () => {
    buildV20Fixture();
    const db = openDb(dbPath);

    const focSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='focuses'").get() as {
      sql: string;
    }).sql;
    expect(focSql).toContain("'archived'");
    expect(focSql).toMatch(
      /lifecycle\s+IN\s*\(\s*'captured'\s*,\s*'active'\s*,\s*'dormant'\s*,\s*'closed'\s*,\s*'abandoned'\s*,\s*'archived'\s*\)/
    );

    expect(() =>
      db.prepare("UPDATE focuses SET lifecycle='archived' WHERE id=?").run(FOCUS_ID)
    ).not.toThrow();
    expect(
      (db.prepare("SELECT lifecycle FROM focuses WHERE id=?").get(FOCUS_ID) as { lifecycle: string }).lifecycle
    ).toBe("archived");

    // zod 层
    expect(focusLifecycleSchema.safeParse("archived").success).toBe(true);
    expect(focusLifecycleSchema.safeParse("bogus").success).toBe(false);

    // 库层 CHECK 仍拒 bogus(六值封闭,与 type 去 CHECK 不同)
    expect(() => db.prepare("UPDATE focuses SET lifecycle='bogus' WHERE id=?").run(FOCUS_ID)).toThrow(/CHECK/);

    db.close();
  });

  it("幂等:openDb 两遍不再重复记 schema_migrations;版本门挡再执行", () => {
    buildV20Fixture();
    const db1 = openDb(dbPath);
    const v1 = (db1.prepare("SELECT COUNT(*) AS c FROM schema_migrations WHERE version IN (21,22)").get() as {
      c: number;
    }).c;
    expect(v1).toBe(2);
    db1.close();

    const db2 = openDb(dbPath);
    const v2 = (db2.prepare("SELECT COUNT(*) AS c FROM schema_migrations WHERE version IN (21,22)").get() as {
      c: number;
    }).c;
    expect(v2).toBe(2);
    expect((db2.prepare("SELECT MAX(version) AS v FROM schema_migrations").get() as { v: number }).v).toBe(
      MIGRATIONS[MIGRATIONS.length - 1]!.version
    );
    // 形状稳定
    const feSql = (db2.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='focus_events'").get() as {
      sql: string;
    }).sql;
    expect(feSql).not.toMatch(/CHECK\s*\(\s*type\s+IN/i);
    db2.close();
  });
});
