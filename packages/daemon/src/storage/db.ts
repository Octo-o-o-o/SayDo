// SQLite 打开与迁移(schema_migrations;计划 0.3)。
// PRAGMA:WAL + foreign_keys ON(09 DDL 声明的 REFERENCES 需显式开启才生效)。

import Database from "better-sqlite3";
import { MIGRATIONS } from "./ddl.js";

export type Db = Database.Database;

export function openDb(path: string): Db {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  // FULL:买断断电/OS 崩溃窗口——"先落盘后发送"的两阶段写依赖提交即持久(评审 B8;单用户本地写入量小,代价可忽略)
  db.pragma("synchronous = FULL");
  migrate(db);
  return db;
}

function migrate(db: Db): void {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL);");
  const applied = new Set(
    (db.prepare("SELECT version FROM schema_migrations").all() as { version: number }[]).map((r) => r.version)
  );
  const pending = MIGRATIONS.filter((m) => !applied.has(m.version));
  if (pending.length === 0) return;
  // SQLite 官方 alter-table 十二步框架化(RA-closeout code-review A-1/B-4,2026-07-28):
  // 父表重建迁移(v10 projects / v12 s3_challenges)在 foreign_keys=ON 下 DROP 会给每条引用行累计
  // deferred 违规计数,RENAME 不复原,COMMIT 必炸——带数据老库升级即砖。合规做法 = 重建期间
  // **连接级关闭 FK(必须在事务外)**,每个迁移事务内 apply 后跑 `PRAGMA foreign_key_check` 全库校验
  // (悬空引用即抛 ⇒ 事务回滚库不坏,完整性不降级),全部完成后 finally 恢复 ON。
  db.pragma("foreign_keys = OFF");
  try {
    for (const m of pending) {
      const run = db.transaction(() => {
        // v5 起支持代码迁移(W2 场次① A1:老库补列需 PRAGMA 探测容错,纯 SQL 表达不了)
        if ("apply" in m) m.apply(db);
        else db.exec(m.sql);
        const violations = db.pragma("foreign_key_check") as unknown[];
        if (violations.length > 0) {
          throw new Error(`migration v${m.version} foreign_key_check failed: ${JSON.stringify(violations).slice(0, 300)}`);
        }
        db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(
          m.version,
          new Date().toISOString()
        );
      });
      run();
    }
  } finally {
    db.pragma("foreign_keys = ON");
  }
}
