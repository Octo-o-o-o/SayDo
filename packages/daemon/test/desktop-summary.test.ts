import { mkdirSync, mkdtempSync, realpathSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getDesktopSummary } from "../src/api/desktop.js";
import type { SaydoConfig } from "../src/config/types.js";
import { openDb } from "../src/storage/db.js";

const tempDirs = new Set<string>();
afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.clear();
});

describe("GET /api/desktop/summary read model", () => {
  it("统计可恢复 Tier1、不可恢复调用、DND 与 attention 四色", () => {
    const home = mkdtempSync(join(tmpdir(), "saydo-desktop-summary-"));
    tempDirs.add(home);
    const db = openDb(join(home, "saydo.db"));
    const worktree = join(home, "worktree");
    mkdirSync(worktree);
    mkdirSync(join(worktree, ".git"));
    const repo = realpathSync(mkdtempSync(join(realpathSync(process.cwd()), ".saydo-summary-repo-")));
    tempDirs.add(repo);
    const now = "2026-08-12T00:00:00.000Z";
    const identity = statSync(repo, { bigint: true });
    db.prepare(
      `INSERT INTO projects(id,title,type,status,workspace_json,canonical_workspace_path,workspace_dev,workspace_ino,exec_mode_default,created_at,updated_at)
       VALUES ('prj_summary','p','coding','active',?,?,?,?, 'step_confirm',?,?)`
    ).run(JSON.stringify({ kind: "local_folder", path: repo, managed: false }), repo, String(identity.dev), String(identity.ino), now, now);
    for (const [taskId, runId, state] of [
      ["tsk_running", "run_running", "running"],
      ["tsk_settled", "run_settled", "settled_review"]
    ] as const) {
      db.prepare(
        `INSERT INTO tasks(id,project_id,title,spec_markdown,route,status,adapter,budget_json,created_at,updated_at)
         VALUES (?,'prj_summary','t','# t','tier1','running','cursor','{}',?,?)`
      ).run(taskId, now, now);
      db.prepare(
        `INSERT INTO tier1_runs(id,task_id,attempt,adapter,cwd,worktree_path,state,created_at,updated_at)
         VALUES (?,?,1,'cursor',?,?,?,?,?)`
      ).run(runId, taskId, worktree, worktree, state, now, now);
    }
    db.prepare(
      `INSERT INTO tasks(id,project_id,title,spec_markdown,route,status,adapter,budget_json,created_at,updated_at)
       VALUES ('tsk_inconsistent','prj_summary','t','# t','tier1','failed','cursor','{}',?,?)`
    ).run(now, now);
    db.prepare(
      `INSERT INTO tier1_runs(id,task_id,attempt,adapter,cwd,worktree_path,state,created_at,updated_at)
       VALUES ('run_inconsistent','tsk_inconsistent',1,'cursor','/tmp/work','/tmp/work','running',?,?)`
    ).run(now, now);
    const config = { dnd: { window: "23:00-08:00" } } as unknown as SaydoConfig;
    // B5: unrecoverableCalls = active-unrecoverable Tier1(1) + BYOA(2)
    expect(getDesktopSummary(db, config, 2, "23:30")).toEqual({
      version: 1,
      activeWork: { total: 4, recoverableTier1: 1, unrecoverableCalls: 3 },
      dnd: { enabled: true, active: true, window: "23:00-08:00" },
      attention: { orange: 0, blue: 0, green: 0, gray: 0 }
    });
    expect(getDesktopSummary(db, config, 2, "23:30", 0).activeWork).toEqual({
      total: 3,
      recoverableTier1: 0,
      unrecoverableCalls: 3
    });
    db.close();
  });
});
