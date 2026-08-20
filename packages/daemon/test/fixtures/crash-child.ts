// §12-7 崩溃注入子进程:做两阶段写的第一阶段后 SIGKILL 自杀(模拟 kill -9)。
// 用法:tsx crash-child.ts <db-path> <scenario>;scenario ∈ binding|command|tier1

import { openDb } from "../../src/storage/db.js";
import { beginDispatchBinding, beginHopperCommand, transitionHopperCommand } from "../../src/storage/dao/dispatch.js";
import { insertTier1Run, transitionTier1Run } from "../../src/storage/dao/tasks.js";

const [dbPath, scenario] = process.argv.slice(2);
if (!dbPath || !scenario) throw new Error("usage: crash-child <db> <scenario>");

const db = openDb(dbPath);
const TS0 = "2026-07-24T00:00:00Z";

if (scenario === "binding") {
  beginDispatchBinding(db, {
    voiceTaskId: "tsk_01JD9WYX0000000000000000AA",
    dispatchId: "dsp_01JD9WYX0000000000000000AB",
    idempotencyKey: "idem-crash-1",
    packageDigest: "sha256:" + "a".repeat(64),
    mode: "step_confirm",
    createdAt: TS0
  });
  // 阶段二(drop + 回填 outcome)之前崩溃
} else if (scenario === "command") {
  beginHopperCommand(db, {
    id: "cmd_01JD9WYX0000000000000000AC",
    taskId: "tsk_01JD9WYX0000000000000000AA",
    op: "cancel",
    idemKey: "idem-crash-cmd-1",
    payloadDigest: "sha256:" + "b".repeat(64),
    createdAt: TS0
  });
  transitionHopperCommand(db, "cmd_01JD9WYX0000000000000000AC", "sent", TS0);
  // confirmed 之前崩溃
} else if (scenario === "tier1") {
  db.prepare(
    `INSERT INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at)
     VALUES ('prj_01JD9WYX0000000000000000AD', 't', 'coding', 'active', '{}', 'step_confirm', @ts, @ts)`
  ).run({ ts: TS0 });
  db.prepare(
    `INSERT INTO tasks(id, project_id, title, spec_markdown, route, status, adapter, native_session_id, cwd, budget_json, created_at, updated_at)
     VALUES ('tsk_01JD9WYX0000000000000000AE', 'prj_01JD9WYX0000000000000000AD', 't', 's', 'tier1', 'running', 'cursor', 'chat-123', '/tmp/wt', '{}', @ts, @ts)`
  ).run({ ts: TS0 });
  insertTier1Run(db, {
    id: "tsk_01JD9WYX0000000000000000AF",
    taskId: "tsk_01JD9WYX0000000000000000AE",
    attempt: 1,
    adapter: "cursor",
    nativeSessionId: "chat-123",
    cwd: "/tmp/wt",
    worktreePath: "/tmp/wt",
    state: "reserved",
    createdAt: TS0,
    updatedAt: TS0
  });
  transitionTier1Run(db, "tsk_01JD9WYX0000000000000000AF", "running", TS0);
  // settle 之前崩溃
} else {
  throw new Error(`unknown scenario: ${scenario}`);
}

// 硬杀自己(等价 kill -9;不给任何清理/回调机会)
process.kill(process.pid, "SIGKILL");
