import { mkdirSync, mkdtempSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDb } from "../src/storage/db.js";
import { classifyActiveWork } from "../src/tier1/activeWorkClassifier.js";

const tempDirs = new Set<string>();
afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.clear();
});

describe("B5 active work classifier", () => {
  it("同源分类 recoverable Tier1 / active-unrecoverable Tier1 / BYOA", () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-classifier-"));
    tempDirs.add(home);
    const worktree = join(home, "worktree");
    mkdirSync(join(worktree, ".git"), { recursive: true });
    const repo = realpathSync(mkdtempSync(join(realpathSync(process.cwd()), ".saydo-classifier-repo-")));
    tempDirs.add(repo);
    const now = "2026-08-12T00:00:00.000Z";
    const identity = statSync(repo, { bigint: true });
    const db = openDb(join(home, "saydo.db"));
    db.prepare(
      `INSERT INTO projects(id,title,type,status,workspace_json,canonical_workspace_path,workspace_dev,workspace_ino,exec_mode_default,created_at,updated_at)
       VALUES ('prj_c','p','coding','active',?,?,?,?, 'step_confirm',?,?)`
    ).run(JSON.stringify({ kind: "local_folder", path: repo, managed: false }), repo, String(identity.dev), String(identity.ino), now, now);
    db.prepare(
      `INSERT INTO tasks(id,project_id,title,spec_markdown,route,status,adapter,budget_json,created_at,updated_at)
       VALUES ('tsk_ok','prj_c','t','# t','tier1','running','cursor','{}',?,?)`
    ).run(now, now);
    db.prepare(
      `INSERT INTO tier1_runs(id,task_id,attempt,adapter,cwd,worktree_path,state,native_session_id,created_at,updated_at)
       VALUES ('run_ok','tsk_ok',1,'cursor',?,?, 'running','chat-1',?,?)`
    ).run(worktree, worktree, now, now);
    db.prepare(
      `INSERT INTO tasks(id,project_id,title,spec_markdown,route,status,adapter,budget_json,created_at,updated_at)
       VALUES ('tsk_bad','prj_c','t','# t','tier1','running','cursor','{}',?,?)`
    ).run(now, now);
    db.prepare(
      `INSERT INTO tier1_runs(id,task_id,attempt,adapter,cwd,worktree_path,state,created_at,updated_at)
       VALUES ('run_bad','tsk_bad',1,'cursor','/missing','/missing','running',?,?)`
    ).run(now, now);

    const classified = classifyActiveWork(db, 2, { requireNativeForGracefulRunning: true });
    expect(classified).toEqual({
      recoverableTier1: 1,
      unrecoverableTier1: 1,
      byoa: 2,
      abortedUnrecoverable: 3,
      total: 4
    });
    db.close();
  });

  it("graceful marker 缺 native session 的 prior-running 不算可恢复", () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-classifier-native-"));
    tempDirs.add(home);
    const worktree = join(home, "worktree");
    mkdirSync(join(worktree, ".git"), { recursive: true });
    const repo = realpathSync(mkdtempSync(join(realpathSync(process.cwd()), ".saydo-classifier-native-repo-")));
    tempDirs.add(repo);
    writeFileSync(join(repo, "README"), "x");
    const now = "2026-08-12T00:00:00.000Z";
    const identity = statSync(repo, { bigint: true });
    const db = openDb(join(home, "saydo.db"));
    db.prepare(
      `INSERT INTO projects(id,title,type,status,workspace_json,canonical_workspace_path,workspace_dev,workspace_ino,exec_mode_default,created_at,updated_at)
       VALUES ('prj_n','p','coding','active',?,?,?,?, 'step_confirm',?,?)`
    ).run(JSON.stringify({ kind: "local_folder", path: repo, managed: false }), repo, String(identity.dev), String(identity.ino), now, now);
    db.prepare(
      `INSERT INTO tasks(id,project_id,title,spec_markdown,route,status,adapter,budget_json,created_at,updated_at)
       VALUES ('tsk_n','prj_n','t','# t','tier1','running','cursor','{}',?,?)`
    ).run(now, now);
    db.prepare(
      `INSERT INTO tier1_runs(id,task_id,attempt,adapter,cwd,worktree_path,state,restart_pending_at,created_at,updated_at)
       VALUES ('run_n','tsk_n',1,'cursor',?,?, 'running',?,?,?)`
    ).run(worktree, worktree, now, now, now);

    const classified = classifyActiveWork(db, 0, { requireNativeForGracefulRunning: true });
    expect(classified.recoverableTier1).toBe(0);
    expect(classified.unrecoverableTier1).toBe(1);
    db.close();
  });
});
