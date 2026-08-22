// W2 场次① A1(2026-07-26 dogfood 首日连环崩回归):v4 时代老库 -> v5 追赶迁移 -> 全链冒烟。
// fixture = test/fixtures/schema-v4-era.sql(phase-0 初版 DDL_V1 + 现行 v2/v3/v4 的机械快照;
// owner 老运行库等价形态)。崩点复现面:dialog loop 崩 sessions.lane / pack compile 崩
// context_snapshot_uses / readiness 落库崩新四列。手术容错:owner 库已被现场裸列手术,
// v5 对已存在列必须跳过不炸。

import Database from "better-sqlite3";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../src/storage/db.js";
import { MIGRATIONS } from "../src/storage/ddl.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { insertProject } from "../src/storage/dao/projects.js";
import { MemoryLedger } from "../src/memory/ledger.js";
import { HotwordStore } from "../src/memory/hotwords.js";
import { compileLivePack } from "../src/live/pack.js";
import { SessionManager } from "../src/session/manager.js";
import { managedProjectPath } from "../src/projects/workspace.js";

const FIXTURE = join(import.meta.dirname, "fixtures", "schema-v4-era.sql");
const PRJ = "prj_01M1GRATE0000000000000000A";
const SES = "ses_01M1GRATE0000000000000000A";

let home: string;
let dbPath: string;

// v14 用例必须用真实 $HOME 下的路径(验证 external workspace 迁移),统一走本 registry 回收。
const homeFixtures = new Set<string>();
function homeFixture(prefix: string): string {
  const path = mkdtempSync(join(process.cwd(), prefix));
  homeFixtures.add(path);
  return path;
}
afterEach(() => {
  for (const path of homeFixtures) rmSync(path, { recursive: true, force: true });
  homeFixtures.clear();
});

/** 建 v4 时代老库(schema 快照 + migrations 1-4 已标) */
function buildV4EraDb(mutate?: (raw: Database.Database) => void): void {
  const raw = new Database(dbPath);
  raw.exec(readFileSync(FIXTURE, "utf8"));
  const now = "2026-07-25T00:00:00.000Z";
  for (const v of [1, 2, 3, 4]) raw.prepare("INSERT INTO schema_migrations VALUES (?, ?)").run(v, now);
  mutate?.(raw);
  raw.close();
}

function columns(db: Db, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((r) => r.name);
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "saydo-mig-"));
  dbPath = join(home, "saydo.db");
});

describe("DDL v5 追赶迁移(A1)", () => {
  it("v4 老库 openDb 后:3 表 + 1 索引 + 6 列齐;migrations 记到 MIGRATIONS 尾项(不写死版本号)", () => {
    buildV4EraDb();
    const db = openDb(dbPath);
    for (const t of ["context_snapshot_uses", "source_snapshots", "claim_snapshot_links"]) {
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(t)).toBeTruthy();
    }
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='snapshot_uses_session'").get()).toBeTruthy();
    expect(columns(db, "sessions")).toContain("lane");
    expect(columns(db, "tasks")).toContain("approved_tree_sha");
    for (const c of ["layer", "prompt_digest", "prompt_body_path", "source_verifications_json"]) {
      expect(columns(db, "readiness_assessments")).toContain(c);
    }
    // v6(W5a 3.2):decisions_json 列老库同样补齐
    expect(columns(db, "tier1_runs")).toContain("decisions_json");
    // v29(D1):可恢复退出 marker 只增列,不扩已有状态机。
    expect(columns(db, "tier1_runs")).toContain("restart_pending_at");
    expect(columns(db, "tier1_runs")).toContain("restart_reason");
    expect(columns(db, "tier1_runs")).toContain("budget_active_ms");
    expect(columns(db, "tier1_runs")).toContain("budget_tool_calls");
    expect(columns(db, "tier1_runs")).toContain("restart_reason");
    // v30(W5.4-b C2b):claude 会话确认位,老库缺省 0
    expect(columns(db, "tier1_runs")).toContain("native_session_confirmed");
    // v7(W5a 3.5):project_settings 受控表老库同样建出
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='project_settings'").get()).toBeTruthy();
    // v8(W5a 3.7):subscription_retry_queue durable 队列老库同样建出
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='subscription_retry_queue'").get()).toBeTruthy();
    // v9(W4 3.1):S3 卡两新表 + approvals 六列 + 单活跃凭据部分唯一索引(表重建迁移)
    for (const t of ["webauthn_credentials", "s3_challenges"]) {
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(t)).toBeTruthy();
    }
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='webauthn_single_active'").get()).toBeTruthy();
    for (const c of ["s3_challenge_id", "credential_id", "assertion_digest", "attempt", "package_revision", "prospective_tree_sha"]) {
      expect(columns(db, "approvals")).toContain(c);
    }
    // v10(W4 3.2):projects CHECK 加 'writing'(表重建)——老库迁移后可插 writing 项目
    expect(() =>
      db
        .prepare(
          "INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at) VALUES ('prj_01M1GRATEWRITE00000000000A','w','writing','active','{}','step_confirm','2026-07-27T00:00:00Z','2026-07-27T00:00:00Z')"
        )
        .run()
    ).not.toThrow();
    // v11(W4 3.8):decision_packages proposed_at 列 + CHECK + 唯一活跃索引(表重建)
    expect(columns(db, "decision_packages")).toContain("proposed_at");
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='pkg_active_proposed'").get()).toBeTruthy();
    expect(() =>
      db
        .prepare(
          `INSERT INTO decision_packages(id, revision, digest, project_id, body_json, status, proposed_at, expires_at, created_at)
           VALUES ('pkg_01M1GRATEPROP0000000000A', 1, 'sha256:${"e".repeat(64)}', 'prj_01M1GRATE0000000000000000A', '{}', 'proposed', NULL, NULL, '2026-07-27T00:00:00Z')`
        )
        .run()
    ).toThrow(/CHECK/); // proposed 缺 proposed_at ⇒ 拒
    const latest = MIGRATIONS[MIGRATIONS.length - 1]!.version;
    expect((db.prepare("SELECT MAX(version) AS v FROM schema_migrations").get() as { v: number }).v).toBe(latest);
    db.close();
  });

  it("手术容错:老库已被裸列手术(owner 现场形态)⇒ v5 探测跳过不炸,其余对象照补", () => {
    buildV4EraDb((raw) => {
      raw.exec("ALTER TABLE sessions ADD COLUMN lane TEXT;"); // 裸类型无 CHECK(手术形态)
      raw.exec("ALTER TABLE tasks ADD COLUMN approved_tree_sha TEXT;");
    });
    const db = openDb(dbPath);
    expect(columns(db, "sessions").filter((c) => c === "lane")).toHaveLength(1); // 不重复加列
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='context_snapshot_uses'").get()).toBeTruthy();
    db.close();
  });

  it("批末 review A-1/B-1:老库同项目双 proposed + generic S3 行 ⇒ v9/v11 迁移收敛不炸", () => {
    // A-1:W4 前 proposeStart 不 supersede,老库同项目双 proposed;B-1:基线 fixture 的 generic S3 行(无判别六列)
    buildV4EraDb((raw) => {
      // 两条同项目 proposed(created_at 不同——保留最新,旧的收敛 superseded)
      raw.prepare(
        "INSERT INTO decision_packages(id, revision, digest, project_id, body_json, status, expires_at, created_at) VALUES (?,?,?,?,?,?,?,?)"
      ).run("pkg_dupA", 1, "sha256:" + "a".repeat(64), PRJ, "{}", "proposed", null, "2026-07-25T01:00:00Z");
      raw.prepare(
        "INSERT INTO decision_packages(id, revision, digest, project_id, body_json, status, expires_at, created_at) VALUES (?,?,?,?,?,?,?,?)"
      ).run("pkg_dupB", 1, "sha256:" + "b".repeat(64), PRJ, "{}", "proposed", null, "2026-07-25T02:00:00Z");
      // generic S3 行(risk='S3' 无判别六列;pre-W4 演示/终局形态)
      raw.prepare(
        `INSERT INTO approvals(id, kind, ref_digest, risk, decided_via, auth_strength, nonce, outcome, issued_at, expires_at)
         VALUES ('apr_genS3', 'dispatch_package', 'sha256:${"c".repeat(64)}', 'S3', 'screen', 'screen_authenticated', 'n-gens3', 'consumed', '2026-07-25T00:00:00Z', '2026-07-25T00:01:00Z')`
      ).run();
    });
    const db = openDb(dbPath); // 全量迁移不抛(A-1 收敛双 proposed + B-1 剔除 generic S3)
    // A-1:同项目至多一活跃 proposed(最新 pkg_dupB 留,旧 pkg_dupA superseded)
    const active = (db.prepare("SELECT COUNT(*) AS c FROM decision_packages WHERE project_id=? AND status='proposed'").get(PRJ) as { c: number }).c;
    expect(active).toBe(1);
    expect((db.prepare("SELECT status FROM decision_packages WHERE id='pkg_dupB'").get() as { status: string }).status).toBe("proposed");
    expect((db.prepare("SELECT status FROM decision_packages WHERE id='pkg_dupA'").get() as { status: string }).status).toBe("superseded");
    // B-1:generic S3 行已剔除(不再存在)
    expect(db.prepare("SELECT id FROM approvals WHERE id='apr_genS3'").get()).toBeUndefined();
    db.close();
  });

  it("幂等:迁移后再次 openDb 不重放不炸(v5 已标)", () => {
    buildV4EraDb();
    openDb(dbPath).close();
    const db = openDb(dbPath);
    expect((db.prepare("SELECT COUNT(*) AS c FROM schema_migrations WHERE version=5").get() as { c: number }).c).toBe(1);
    db.close();
  });

  it("v14:存量 external local workspace 回填 canonical path，并补 session revision/event 表", () => {
    const external = homeFixture(".saydo-mig14-");
    const alias = `${external}-alias`;
    symlinkSync(external, alias);
    homeFixtures.add(alias);
    buildV4EraDb((raw) => {
      raw.prepare(
        `INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at)
         VALUES ('prj_mig14external', '外部项目', 'coding', 'active', ?, 'step_confirm', ?, ?)`
      ).run(JSON.stringify({ kind: "local_folder", path: alias, managed: false }), "2026-07-30T00:00:00Z", "2026-07-30T00:00:00Z");
      raw.prepare(
        `INSERT INTO sessions(id, project_id, state, engine, transcript_path, started_at)
         VALUES ('ses_mig14external', 'prj_mig14external', 'talking', 'cascade', '/tmp/mig14.jsonl', ?)`
      ).run("2026-07-30T00:00:00Z");
    });
    const db = openDb(dbPath);
    const project = db
      .prepare(
        "SELECT workspace_json, canonical_workspace_path AS path, workspace_dev AS dev, workspace_ino AS ino FROM projects WHERE id='prj_mig14external'"
      )
      .get() as { workspace_json: string; path: string; dev: string; ino: string };
    expect(project.path).toBe(external);
    expect(JSON.parse(project.workspace_json)).toEqual({ kind: "local_folder", path: external, managed: false });
    const stat = lstatSync(external, { bigint: true });
    expect(project).toMatchObject({ dev: String(stat.dev), ino: String(stat.ino) });
    expect(columns(db, "sessions")).toContain("project_revision");
    expect(columns(db, "sessions")).toEqual(
      expect.arrayContaining(["anchor_readiness_revision", "anchor_pack_revision"])
    );
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='session_project_events'").get()).toBeTruthy();
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='project_live_workspace_unique'").get()).toBeTruthy();
    expect(
      (db.prepare("SELECT COUNT(*) AS c FROM session_project_events WHERE reason='migration_snapshot'").get() as {
        c: number;
      }).c
    ).toBeGreaterThan(0);
    db.close();
  });

  it("v15:存量库补 type 不可变写闸，pending 只允许首次定型", () => {
    buildV4EraDb((raw) => {
      raw.prepare(
        `INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at)
         VALUES ('prj_mig15fixed', '已定型', 'coding', 'draft', '{}', 'step_confirm', ?, ?),
                ('prj_mig15pending', '待定型', 'pending', 'draft', '{}', 'step_confirm', ?, ?)`
      ).run(
        "2026-07-30T00:00:00Z",
        "2026-07-30T00:00:00Z",
        "2026-07-30T00:00:00Z",
        "2026-07-30T00:00:00Z"
      );
    });
    const db = openDb(dbPath);
    expect(() => db.prepare("UPDATE projects SET type='writing' WHERE id='prj_mig15fixed'").run()).toThrow(
      /project type is immutable/u
    );
    expect(db.prepare("UPDATE projects SET type='writing' WHERE id='prj_mig15pending'").run().changes).toBe(1);
    expect(() => db.prepare("UPDATE projects SET type='research' WHERE id='prj_mig15pending'").run()).toThrow(
      /project type is immutable/u
    );
    db.close();
  });

  it("v14:存量 managed workspace 越出 daemon-owned root 时 fail-closed", () => {
    buildV4EraDb((raw) => {
      raw.prepare(
        `INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at)
         VALUES ('prj_mig14managedbad', '越界受管项目', 'coding', 'active', ?, 'step_confirm', ?, ?)`
      ).run(
        JSON.stringify({ kind: "local_folder", path: home, managed: true }),
        "2026-07-30T00:00:00Z",
        "2026-07-30T00:00:00Z"
      );
    });
    expect(() => openDb(dbPath)).toThrow(/managed workspace rejected: workspace_managed_root/u);
    const raw = new Database(dbPath, { readonly: true });
    expect(raw.prepare("SELECT version FROM schema_migrations WHERE version=14").get()).toBeUndefined();
    raw.close();
  });

  it("v14:存量 exact/父子 workspace 冲突 fail-closed，不记录迁移版本", () => {
    const parent = homeFixture(".saydo-mig14-conflict-");
    const child = join(parent, "child");
    mkdirSync(child);
    buildV4EraDb((raw) => {
      const insert = raw.prepare(
        `INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at)
         VALUES (?, ?, 'coding', 'active', ?, 'step_confirm', ?, ?)`
      );
      insert.run(
        "prj_mig14parent",
        "父目录",
        JSON.stringify({ kind: "local_folder", path: parent, managed: false }),
        "2026-07-30T00:00:00Z",
        "2026-07-30T00:00:00Z"
      );
      insert.run(
        "prj_mig14child",
        "子目录",
        JSON.stringify({ kind: "local_folder", path: child, managed: false }),
        "2026-07-30T00:00:00Z",
        "2026-07-30T00:00:00Z"
      );
    });
    expect(() => openDb(dbPath)).toThrow(/v14 workspace conflict/u);
    const raw = new Database(dbPath, { readonly: true });
    expect(raw.prepare("SELECT version FROM schema_migrations WHERE version=14").get()).toBeUndefined();
    raw.close();
  });

  it("全链冒烟(dogfood 崩点复现面):建 session/插 turn -> pack 编译 -> readiness 落库,全不炸", () => {
    buildV4EraDb();
    const db = openDb(dbPath);
    const audit = createSqliteAuditSink(db);
    insertProject(db, {
      id: PRJ,
      title: "迁移冒烟",
      type: "coding",
      status: "active",
      workspace: { kind: "local_folder", path: managedProjectPath(PRJ), managed: true },
      executionModeDefault: "step_confirm",
      createdAt: "2026-07-26T12:00:00.000Z",
      updatedAt: "2026-07-26T12:00:00.000Z"
    });
    // 崩点 1(sessions.lane):SessionManager 建会话 + 落转写
    const sm = new SessionManager({ db, audit, storeTranscript: true });
    sm.create({ id: SES, projectId: PRJ, transcriptPath: join(home, "s.jsonl") });
    sm.appendTurn(SES, {
      turnId: "trn_01M1GRATE00000000000000001",
      speaker: "user",
      text: "冒烟一句",
      sentences: [{ sentenceId: "s1", text: "冒烟一句", heard: true }],
      engine: "cascade"
    });
    // 崩点 2(context_snapshot_uses):live pack 编译落快照与使用记录
    const ledger = new MemoryLedger({ db, audit });
    ledger.add({ tier: "M1", projectId: PRJ, claim: "冒烟事实", source: { kind: "user_utterance", ref: "trn_x" }, requestedTrust: "user_stated" });
    const pack = compileLivePack({ db, ledger, hotwords: new HotwordStore(ledger) }, { sessionId: SES, projectId: PRJ, userText: "冒烟" });
    expect(pack).not.toBeNull();
    expect((db.prepare("SELECT COUNT(*) AS c FROM context_snapshot_uses WHERE session_id=?").get(SES) as { c: number }).c).toBe(1);
    // 崩点 3(readiness 新四列):rules 行直插
    db.prepare(
      "INSERT INTO readiness_assessments(id, session_id, verdict, dims_json, layer, created_at) VALUES (?,?,?,?,?,?)"
    ).run("rdy_01M1GRATE0000000000000001", SES, "not_ready", "[]", "rules", "2026-07-26T12:00:00.000Z");
    expect((db.prepare("SELECT layer FROM readiness_assessments LIMIT 1").get() as { layer: string }).layer).toBe("rules");
    db.close();
  });

  it("v30:v4 老库升级后 native_session_confirmed 缺省 0 且既有行不损", () => {
    const nowIso = "2026-07-25T00:00:00.000Z";
    buildV4EraDb((raw) => {
      raw.prepare(
        `INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at)
         VALUES ('prj_01M1GRATEV30000000000000', 'v30', 'coding', 'active', ?, 'step_confirm', ?, ?)`
      ).run(
        JSON.stringify({
          kind: "local_folder",
          path: managedProjectPath("prj_01M1GRATEV30000000000000"),
          managed: true
        }),
        nowIso,
        nowIso
      );
      raw.prepare(
        `INSERT INTO tasks(id, project_id, title, spec_markdown, route, status, adapter, cwd, budget_json, created_at, updated_at)
         VALUES ('tsk_01M1GRATEV30000000000000', 'prj_01M1GRATEV30000000000000', 't', 's', 'tier1', 'queued', 'cursor', '/tmp', '{}', ?, ?)`
      ).run(nowIso, nowIso);
      raw.prepare(
        `INSERT INTO tier1_runs(id, task_id, attempt, adapter, native_session_id, cwd, worktree_path, state, created_at, updated_at)
         VALUES ('run_01M1GRATEV30000000000000', 'tsk_01M1GRATEV30000000000000', 1, 'cursor', 'chat-old', '/tmp/wt', '/tmp/wt', 'settled_review', ?, ?)`
      ).run(nowIso, nowIso);
    });
    const db = openDb(dbPath);
    const row = db
      .prepare(
        `SELECT id, adapter, native_session_id AS sid, cwd, state, native_session_confirmed AS confirmed
         FROM tier1_runs WHERE id='run_01M1GRATEV30000000000000'`
      )
      .get() as {
      id: string;
      adapter: string;
      sid: string;
      cwd: string;
      state: string;
      confirmed: number;
    };
    expect(row).toEqual({
      id: "run_01M1GRATEV30000000000000",
      adapter: "cursor",
      sid: "chat-old",
      cwd: "/tmp/wt",
      state: "settled_review",
      confirmed: 0
    });
    expect(() =>
      db.prepare("UPDATE tier1_runs SET native_session_confirmed=2 WHERE id='run_01M1GRATEV30000000000000'").run()
    ).toThrow(/CHECK/i);
    db.close();
  });
});

describe("RA-closeout · 带数据老库父表重建回归(code-review A-1/B-3/B-4:修复前升级即砖)", () => {
  const nowIso = "2026-07-28T09:00:00.000Z";

  it("B-4(v10 路径):v4 老库带 sessions/tasks 引用行 ⇒ openDb 全量迁移不炸,行存活", () => {
    buildV4EraDb((raw) => {
      raw.prepare(
        `INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at)
         VALUES ('prj_01M1GRATEB40000000000000', '老库', 'coding', 'active', ?, 'step_confirm', ?, ?)`
      ).run(
        JSON.stringify({
          kind: "local_folder",
          path: managedProjectPath("prj_01M1GRATEB40000000000000"),
          managed: true
        }),
        nowIso,
        nowIso
      );
      raw.prepare(
        `INSERT INTO sessions(id, project_id, state, engine, transcript_path, started_at)
         VALUES ('ses_01M1GRATEB40000000000000', 'prj_01M1GRATEB40000000000000', 'talking', 'cascade', '/tmp/t.jsonl', ?)`
      ).run(nowIso);
      raw.prepare(
        `INSERT INTO tasks(id, project_id, title, spec_markdown, route, status, adapter, cwd, budget_json, created_at, updated_at)
         VALUES ('tsk_01M1GRATEB40000000000000', 'prj_01M1GRATEB40000000000000', 't', 's', 'tier1', 'queued', 'cursor', '/tmp', '{}', ?, ?)`
      ).run(nowIso, nowIso);
    });
    const db = openDb(dbPath); // 修复前:v10 重建 projects(父表)在 deferred FK 计数下 COMMIT 炸
    expect((db.prepare("SELECT COUNT(*) AS c FROM sessions WHERE id='ses_01M1GRATEB40000000000000'").get() as { c: number }).c).toBe(1);
    expect((db.prepare("SELECT type FROM projects WHERE id='prj_01M1GRATEB40000000000000'").get() as { type: string }).type).toBe("coding");
    db.close();
  });

  it("A-1(v12 路径):v11 库带已消费挑战+引用收据+孤儿挑战 ⇒ openDb 迁 v12 不炸;JOIN 回填真实值;孤儿删除+审计", () => {
    // 构造 v11 形态库:v4 fixture → 手工跑迁移 5..11 → 塞 S3 数据(此时 s3_challenges 无 attempt 列)
    const raw = new Database(dbPath);
    raw.pragma("foreign_keys = OFF");
    raw.exec(readFileSync(FIXTURE, "utf8"));
    for (const v of [1, 2, 3, 4]) raw.prepare("INSERT INTO schema_migrations VALUES (?, ?)").run(v, nowIso);
    for (const m of MIGRATIONS) {
      if (m.version < 5 || m.version > 11) continue;
      if ("apply" in m) m.apply(raw);
      raw.prepare("INSERT INTO schema_migrations VALUES (?, ?)").run(m.version, nowIso);
    }
    // 代码里 v9 函数已升级为 v12 终形状——手工回退为历史 v9-v11 形状(无 attempt/package_revision/bootstrap_intent_id),
    // 模拟"今天之前跑过旧 v9 的库"(v12 迁移的真实输入形态)
    raw.exec(`
DROP TABLE s3_challenges;
CREATE TABLE s3_challenges(id TEXT PRIMARY KEY NOT NULL, challenge TEXT UNIQUE NOT NULL,
  action TEXT NOT NULL, ref_digest TEXT NOT NULL, prospective_tree_sha TEXT,
  task_id TEXT, project_id TEXT, session_id TEXT,
  expires_at TEXT NOT NULL, consumed_at TEXT, created_at TEXT NOT NULL,
  CHECK (action IN ('register','merge','publish','deploy','delete_data','external_send','force_push')),
  CHECK (action != 'merge' OR (task_id IS NOT NULL AND project_id IS NOT NULL AND prospective_tree_sha IS NOT NULL)),
  CHECK (action != 'register' OR (task_id IS NULL AND prospective_tree_sha IS NULL)));
`);
    raw.prepare(
      `INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at)
       VALUES ('prj_01M1GRATEA10000000000000', '老库', 'coding', 'active', ?, 'step_confirm', ?, ?)`
    ).run(
      JSON.stringify({
        kind: "local_folder",
        path: managedProjectPath("prj_01M1GRATEA10000000000000"),
        managed: true
      }),
      nowIso,
      nowIso
    );
    raw.prepare(
      `INSERT INTO tasks(id, project_id, package_rev, title, spec_markdown, route, status, adapter, cwd, budget_json, created_at, updated_at)
       VALUES ('tsk_01M1GRATEA10000000000000', 'prj_01M1GRATEA10000000000000', 3, 't', 's', 'tier1', 'task_done', 'cursor', '/tmp', '{}', ?, ?)`
    ).run(nowIso, nowIso);
    // 已消费 merge 挑战(v11 形状:无 attempt/package_revision 列)+ 引用它的合法 S3 收据(attempt=3/revision=3)
    raw.prepare(
      `INSERT INTO s3_challenges(id, challenge, action, ref_digest, prospective_tree_sha, task_id, project_id, session_id, expires_at, consumed_at, created_at)
       VALUES ('s3c_01M1GRATEA1CONSUMED00000', 'ch-old', 'merge', 'sha256:${"a".repeat(64)}', '${"f".repeat(40)}',
               'tsk_01M1GRATEA10000000000000', 'prj_01M1GRATEA10000000000000', NULL, ?, ?, ?)`
    ).run(nowIso, nowIso, nowIso);
    raw.prepare(
      `INSERT INTO approvals(id, kind, ref_digest, parent_package_digest, task_id, risk, decided_via, auth_strength, nonce, outcome, issued_at, expires_at, consumed_at,
                             s3_challenge_id, credential_id, assertion_digest, attempt, package_revision, prospective_tree_sha)
       VALUES ('apr_01M1GRATEA1RCPT000000000', 'runtime_effect', 'sha256:${"a".repeat(64)}', 'sha256:${"b".repeat(64)}', 'tsk_01M1GRATEA10000000000000', 'S3', 'screen', 'os_biometric', 'n-old', 'consumed', ?, ?, ?,
               's3c_01M1GRATEA1CONSUMED00000', 'cred-old', 'sha256:${"e".repeat(64)}', 3, 3, '${"f".repeat(40)}')`
    ).run(nowIso, nowIso, nowIso);
    // 孤儿:未消费未被收据引用的过期 merge 挑战(删除面)+ 无 session 的历史 register 行(grandfather 面)
    raw.prepare(
      `INSERT INTO s3_challenges(id, challenge, action, ref_digest, prospective_tree_sha, task_id, project_id, session_id, expires_at, consumed_at, created_at)
       VALUES ('s3c_01M1GRATEA1ORPHAN0000000', 'ch-orphan', 'merge', 'sha256:${"a".repeat(64)}', '${"f".repeat(40)}',
               'tsk_01M1GRATEA10000000000000', 'prj_01M1GRATEA10000000000000', NULL, ?, NULL, ?)`
    ).run(nowIso, nowIso);
    raw.prepare(
      `INSERT INTO s3_challenges(id, challenge, action, ref_digest, session_id, expires_at, consumed_at, created_at)
       VALUES ('s3c_01M1GRATEA1REG0000000000', 'ch-reg-old', 'register', 'sha256:${"c".repeat(64)}', NULL, ?, ?, ?)`
    ).run(nowIso, nowIso, nowIso);
    raw.close();

    const db = openDb(dbPath); // 修复前:v12 重建 s3_challenges(被 approvals FK 引用的父表)COMMIT 炸
    const migrated = db.prepare("SELECT attempt, package_revision FROM s3_challenges WHERE id='s3c_01M1GRATEA1CONSUMED00000'").get() as {
      attempt: number;
      package_revision: number;
    };
    expect(migrated).toEqual({ attempt: 3, package_revision: 3 }); // JOIN approvals 回填真实值,不造数
    expect(db.prepare("SELECT id FROM s3_challenges WHERE id='s3c_01M1GRATEA1ORPHAN0000000'").get()).toBeUndefined(); // 孤儿删除
    const reg = db.prepare("SELECT bootstrap_intent_id FROM s3_challenges WHERE id='s3c_01M1GRATEA1REG0000000000'").get() as {
      bootstrap_intent_id: string;
    };
    expect(reg.bootstrap_intent_id).toBe("s3i_00000000000000000000000000"); // grandfather 兜底(idSchema 合法形状)
    const aud = db.prepare("SELECT meta_json FROM audit_log WHERE action='migration.v12_orphan_merge_dropped'").get() as { meta_json: string };
    expect(JSON.parse(aud.meta_json).dropped).toBe(1); // 孤儿删除留痕(B-2)
    db.close();
  });
});
