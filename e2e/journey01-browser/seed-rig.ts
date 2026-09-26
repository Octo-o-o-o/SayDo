// 用生产 DAO 给临时 SQLite 种最小合法项目/会话/Focus。
// 不预置 critical readiness claim,不调用 confirmBindings。
// 就绪事实/绑定/包须由 scripted 采访经生产 remember+confirmReadiness+createTask 产生。
// 标注:本脚本只做 fixture 初始化,不复制 HTTP/WS 业务实现。
// B4 原根因(采访前植入就绪)保留在本包证据关联里,不在此清零。

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openDb } from "../../packages/daemon/src/storage/db.js";
import { createSqliteAuditSink } from "../../packages/daemon/src/storage/dao/misc.js";
import { insertProject, insertSession } from "../../packages/daemon/src/storage/dao/projects.js";
import { createFocus } from "../../packages/daemon/src/focus/registry.js";
import { HOME, PROJECT_ID, SESSION_ID, WORKSPACE } from "./constants.js";

function main(): void {
  const home = process.env["SAYDO_HOME"] ?? HOME;
  const workspace = process.env["JOURNEY_WORKSPACE"] ?? WORKSPACE;
  mkdirSync(join(home, "sessions"), { recursive: true, mode: 0o700 });
  const db = openDb(join(home, "saydo.db"));
  const audit = createSqliteAuditSink(db);
  const now = "2026-09-22T08:00:00.000Z";
  insertProject(db, {
    id: PROJECT_ID,
    title: "闭环项目",
    type: "coding",
    status: "active",
    workspace: { kind: "local_folder", path: workspace, managed: false },
    executionModeDefault: "step_confirm",
    createdAt: now,
    updatedAt: now
  });
  const { focusId } = createFocus(db, { title: "journey01 浏览器闭环", actorKind: "user" });
  insertSession(db, {
    id: SESSION_ID,
    projectId: PROJECT_ID,
    projectRevision: 0,
    state: "talking",
    engine: "cascade",
    transcriptPath: join(home, "sessions", `${SESSION_ID}.jsonl`),
    startedAt: now
  });
  // 最小会话↔Focus 环境锚,不是就绪事实。无此列 collectFocusPackages 找不到 pending 包。
  db.prepare("UPDATE sessions SET primary_focus_id = ? WHERE id = ?").run(focusId, SESSION_ID);
  void audit;
  writeFileSync(join(home, "seed-ids.json"), `${JSON.stringify({ sessionId: SESSION_ID, projectId: PROJECT_ID, focusId }, null, 2)}\n`);
  db.close();
  process.stdout.write(`${focusId}\n`);
}

main();
