// 验收 evidenceRef 受控解析:不同 ref 不同正文;缺 ref/缺 proof/跨 run 诚实缺证。
// 负例:删 npm 的 README 使检查脚本失败,不得声称 pass。

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { newId, textDigest } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { acceptanceChecksForFailedVerify, collectAcceptanceEvidence, resolveAcceptanceEvidence } from "../src/api/acceptanceEvidence.js";
import { getTaskDetail } from "../src/api/console.js";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const CHECK = join(ROOT, "e2e", "journey01-browser", "check-readme-install.mjs");

function makeDb(): Db {
  return openDb(join(mkdtempSync(join(tmpdir(), "saydo-acc-ev-")), "saydo.db"));
}

function ensureProject(db: Db): void {
  db.prepare(
    `INSERT OR IGNORE INTO projects(id, title, type, status, workspace_json, exec_mode_default, created_at, updated_at)
     VALUES ('prj_x', 'acc-ev', 'coding', 'active', '{"kind":"none"}', 'step_confirm', '2026-09-22T00:00:00.000Z', '2026-09-22T00:00:00.000Z')`
  ).run();
}

function insertRun(db: Db, row: { id: string; taskId: string; treeSha: string }): void {
  ensureProject(db);
  db.prepare(
    `INSERT INTO tasks(id, project_id, title, spec_markdown, route, adapter, status, budget_json, created_at, updated_at)
     VALUES (?, 'prj_x', 't', '# spec', 'tier1', 'cursor', 'ready_for_review', '{"maxCost":20}', '2026-09-22T00:00:00.000Z', '2026-09-22T00:00:00.000Z')`
  ).run(row.taskId);
  db.prepare(
    `INSERT INTO tier1_runs(id, task_id, attempt, adapter, cwd, worktree_path, tree_sha, state, created_at, updated_at)
     VALUES (?, ?, 1, 'cursor', '.', '.', ?, 'settled_review', '2026-09-22T00:00:00.000Z', '2026-09-22T00:00:00.000Z')`
  ).run(row.id, row.taskId, row.treeSha);
}

describe("acceptanceEvidence 受控解析", () => {
  it("不同 verify digest 返回不同正文;digest 不匹配 / 跨 run / 缺文件诚实失败", () => {
    const db = makeDb();
    const home = mkdtempSync(join(tmpdir(), "saydo-acc-runs-"));
    const runA = "run_aaaaaaaaaaaaaaaaaaaaaaaaaa";
    const runB = "run_bbbbbbbbbbbbbbbbbbbbbbbbbb";
    const tree = "a".repeat(40);
    insertRun(db, { id: runA, taskId: "tsk_aaaaaaaaaaaaaaaaaaaaaaaaaa", treeSha: tree });
    insertRun(db, { id: runB, taskId: "tsk_bbbbbbbbbbbbbbbbbbbbbbbbbb", treeSha: tree });
    mkdirSync(join(home, runA), { recursive: true });
    mkdirSync(join(home, runB), { recursive: true });
    const bodyA = JSON.stringify([{ templateRef: "test", exitCode: 0, stdoutTail: "[ok] npm install retained" }], null, 2);
    const bodyB = JSON.stringify([{ templateRef: "test", exitCode: 0, stdoutTail: "[ok] pnpm install present" }], null, 2);
    writeFileSync(join(home, runA, "verify.json"), bodyA);
    writeFileSync(join(home, runB, "verify.json"), bodyB);
    const digestA = textDigest(bodyA);
    const digestB = textDigest(bodyB);
    expect(digestA).not.toBe(digestB);

    const scopeA = { taskId: "tsk_aaaaaaaaaaaaaaaaaaaaaaaaaa", runId: runA, treeSha: tree, runsDir: home };
    const a = resolveAcceptanceEvidence(db, `verify:${digestA}`, scopeA);
    const b = resolveAcceptanceEvidence(db, `verify:${digestB}`, {
      taskId: "tsk_bbbbbbbbbbbbbbbbbbbbbbbbbb",
      runId: runB,
      treeSha: tree,
      runsDir: home
    });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.body).toContain("npm install retained");
      expect(b.body).toContain("pnpm install present");
      expect(a.body).not.toEqual(b.body);
    }

    const mismatch = resolveAcceptanceEvidence(db, `verify:${digestB}`, scopeA);
    expect(mismatch).toEqual({ evidenceRef: `verify:${digestB}`, ok: false, reason: "digest_mismatch" });

    const cross = resolveAcceptanceEvidence(db, `verify:${digestA}`, {
      taskId: "tsk_bbbbbbbbbbbbbbbbbbbbbbbbbb",
      runId: runA,
      treeSha: tree,
      runsDir: home
    });
    expect(cross.ok).toBe(false);
    if (!cross.ok) expect(cross.reason).toBe("cross_run");

    const missingFile = resolveAcceptanceEvidence(db, `verify:${"c".repeat(64)}`, {
      taskId: "tsk_aaaaaaaaaaaaaaaaaaaaaaaaaa",
      runId: runA,
      treeSha: tree,
      runsDir: join(home, "no-such")
    });
    expect(missingFile.ok).toBe(false);

    const collected = collectAcceptanceEvidence(db, ["", `verify:${digestA}`], null);
    expect(collected[0]).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("tree 路径只读本 run 树内常规 blob;越权路径 invalid_ref", () => {
    const db = makeDb();
    const repo = mkdtempSync(join(tmpdir(), "saydo-acc-tree-"));
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: repo });
    execFileSync("git", ["config", "user.email", "t@t.local"], { cwd: repo });
    execFileSync("git", ["config", "user.name", "t"], { cwd: repo });
    writeFileSync(join(repo, "README.md"), "# 安装\n\nnpm install\n\npnpm install\n");
    execFileSync("git", ["add", "-A"], { cwd: repo });
    execFileSync("git", ["commit", "-qm", "init"], { cwd: repo });
    const treeSha = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { cwd: repo, encoding: "utf8" }).trim();
    const runId = "run_cccccccccccccccccccccccccc";
    insertRun(db, { id: runId, taskId: "tsk_cccccccccccccccccccccccccc", treeSha });
    const scope = {
      taskId: "tsk_cccccccccccccccccccccccccc",
      runId,
      treeSha,
      worktreePath: repo
    };
    const ok = resolveAcceptanceEvidence(db, `tree:${treeSha}:README.md`, scope);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.body).toContain("npm install");
      expect(ok.body).toContain("pnpm install");
    }
    const escape = resolveAcceptanceEvidence(db, `tree:${treeSha}:../etc/passwd`, scope);
    expect(escape).toMatchObject({ ok: false, reason: "invalid_ref" });
    const otherTree = resolveAcceptanceEvidence(db, `tree:${"d".repeat(40)}:README.md`, scope);
    expect(otherTree).toMatchObject({ ok: false, reason: "cross_run" });
  });
});

describe("verify 路径与审计裁决", () => {
  it("run 目录或 verify.json 是 symlink 时拒绝,不读到链接目标", () => {
    const db = makeDb();
    const home = mkdtempSync(join(tmpdir(), "saydo-acc-link-"));
    const runA = "run_aaaaaaaaaaaaaaaaaaaaaaaaaa";
    const linked = "run_dddddddddddddddddddddddddd";
    const tree = "a".repeat(40);
    insertRun(db, { id: runA, taskId: "tsk_aaaaaaaaaaaaaaaaaaaaaaaaaa", treeSha: tree });
    insertRun(db, { id: linked, taskId: "tsk_dddddddddddddddddddddddddd", treeSha: tree });
    mkdirSync(join(home, runA), { recursive: true });
    const bodyA = JSON.stringify([{ templateRef: "test", exitCode: 0, stdoutTail: "secret-body" }]);
    writeFileSync(join(home, runA, "verify.json"), bodyA);
    symlinkSync(join(home, runA), join(home, linked));
    const digest = textDigest(bodyA).slice(7);
    const viaDir = resolveAcceptanceEvidence(db, `verify:${digest}`, {
      taskId: "tsk_dddddddddddddddddddddddddd",
      runId: linked,
      treeSha: tree,
      runsDir: home
    });
    expect(viaDir).toMatchObject({ ok: false, reason: "unauthorized" });

    const fileRun = "run_eeeeeeeeeeeeeeeeeeeeeeeeee";
    insertRun(db, { id: fileRun, taskId: "tsk_eeeeeeeeeeeeeeeeeeeeeeeeee", treeSha: tree });
    mkdirSync(join(home, fileRun), { recursive: true });
    symlinkSync(join(home, runA, "verify.json"), join(home, fileRun, "verify.json"));
    const viaFile = resolveAcceptanceEvidence(db, `verify:${digest}`, {
      taskId: "tsk_eeeeeeeeeeeeeeeeeeeeeeeeee",
      runId: fileRun,
      treeSha: tree,
      runsDir: home
    });
    expect(viaFile).toMatchObject({ ok: false, reason: "unauthorized" });
  });

  it("审计引用返回裁决关联字段;只有 action 或没有裁决字段时诚实缺证,不泄漏未列入的原文", () => {
    const db = makeDb();
    const taskId = "tsk_aaaaaaaaaaaaaaaaaaaaaaaaaa";
    const runId = "run_aaaaaaaaaaaaaaaaaaaaaaaaaa";
    const tree = "b".repeat(40);
    insertRun(db, { id: runId, taskId, treeSha: tree });
    const bare = newId("aud");
    const rich = newId("aud");
    db.prepare("INSERT INTO audit_log(id, ts, actor, action, meta_json) VALUES (?, ?, 'owner', 'task.review_approve', ?)").run(
      bare,
      "2026-09-22T00:00:00.000Z",
      JSON.stringify({ taskId, runId, token: "Bearer SUPERSECRETTOKEN" })
    );
    db.prepare("INSERT INTO audit_log(id, ts, actor, action, meta_json) VALUES (?, ?, 'owner', 'task.review_approve', ?)").run(
      rich,
      "2026-09-22T00:00:01.000Z",
      JSON.stringify({
        taskId,
        runId,
        kind: "writing",
        evidenceDigest: `sha256:${"a".repeat(64)}`,
        attempt: 1,
        acceptancePassed: 1,
        verdicts: [{ criterion: "人工走查", status: "pass" }],
        raw: "Bearer SUPERSECRETTOKEN"
      })
    );
    const missing = resolveAcceptanceEvidence(db, `audit:${bare}`, { taskId, runId, treeSha: tree });
    expect(missing).toMatchObject({ ok: false, reason: "not_found" });
    const found = resolveAcceptanceEvidence(db, `audit:${rich}`, { taskId, runId, treeSha: tree });
    expect(found.ok).toBe(true);
    if (found.ok) {
      expect(found.body).toContain("verdict pass 人工走查");
      expect(found.body).toContain(`sha256:${"a".repeat(64)}`);
      expect(found.body).not.toContain("SUPERSECRETTOKEN");
      expect(found.body).not.toBe("action task.review_approve");
    }
  });
});

describe("verify 失败投影", () => {
  it("全绿 verify 不投影;非零退出保留未绑定条目 unknown 并指向真实诊断", () => {
    const green = JSON.stringify([{ templateRef: "check-readme", exitCode: 0, stdoutTail: "[ok] npm install retained\n" }]);
    expect(acceptanceChecksForFailedVerify(["现有 npm 说明保留"], green)).toBeNull();
    const red = JSON.stringify(
      [{ templateRef: "check-readme", exitCode: 1, stdoutTail: "[fail] npm install missing\n[ok] pnpm install present\n" }],
      null,
      2
    );
    const checks = acceptanceChecksForFailedVerify(["安装一节出现 pnpm install 示例", "现有 npm 说明保留"], red);
    expect(checks).toHaveLength(2);
    expect(checks?.every((check) => check.status === "unknown" && check.source === "manual")).toBe(true);
    expect(new Set(checks?.map((check) => check.evidenceRef)).size).toBe(1);
    expect(checks?.[0]?.evidenceRef).toBe(`verify:${textDigest(red)}`);
  });

  it("失败 run 的任务详情展示真实 verify 正文,不把缺文件标成 pass", () => {
    const db = makeDb();
    const home = mkdtempSync(join(tmpdir(), "saydo-acc-fail-"));
    const runId = "run_ffffffffffffffffffffffffff";
    const taskId = "tsk_ffffffffffffffffffffffffff";
    insertRun(db, { id: runId, taskId, treeSha: "" });
    db.prepare("UPDATE tier1_runs SET state='settled_failed', tree_sha=NULL WHERE id=?").run(runId);
    db.prepare("UPDATE tasks SET status='failed', package_id='pkg_fail', package_rev=1 WHERE id=?").run(taskId);
    db.prepare(
      `INSERT INTO decision_packages(id, revision, digest, project_id, body_json, status, proposed_at, expires_at, created_at)
       VALUES ('pkg_fail', 1, ?, 'prj_x', ?, 'draft', NULL, NULL, '2026-09-22T00:00:00.000Z')`
    ).run("sha256:" + "f".repeat(64), JSON.stringify({ acceptance: ["安装一节出现 pnpm install 示例", "现有 npm 说明保留"] }));
    const red = JSON.stringify(
      [
        { templateRef: "test", exitCode: 0, stdoutTail: "[ok] test\n" },
        { templateRef: "check-readme", exitCode: 1, stdoutTail: "[fail] npm install missing\n[ok] pnpm install present\n" }
      ],
      null,
      2
    );
    mkdirSync(join(home, runId), { recursive: true });
    writeFileSync(join(home, runId, "verify.json"), red);

    const detail = getTaskDetail(db, taskId, { runsDir: home });
    const checks = detail?.["acceptanceChecks"] as { criterion: string; status: string; evidenceRef?: string }[];
    expect(checks.map((check) => check.status)).toEqual(["unknown", "unknown"]);
    expect(checks.some((check) => check.status === "pass")).toBe(false);
    const evidence = detail?.["acceptanceEvidence"] as { ok: boolean; body?: string; evidenceRef: string }[];
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.ok).toBe(true);
    expect(evidence[0]?.body).toContain("[fail] npm install missing");
    expect(evidence[0]?.body).toContain("[ok] pnpm install present");
    expect(evidence[0]?.body).not.toContain("本轮 run");

    const other = JSON.stringify([{ templateRef: "check-readme", exitCode: 1, stdoutTail: "[fail] pnpm install missing\n" }], null, 2);
    expect(other).not.toEqual(red);
    const otherRef = `verify:${textDigest(other)}`;
    const mismatch = resolveAcceptanceEvidence(db, otherRef, {
      taskId,
      runId,
      treeSha: "",
      runsDir: home
    });
    expect(mismatch.ok).toBe(false);
  });
});

describe("README 安装验收脚本", () => {
  it("保留 npm 并增加 pnpm 时退出 0", () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-readme-ok-"));
    writeFileSync(join(dir, "README.md"), "# 安装\n\nnpm install\n\n```\npnpm install\n```\n");
    const out = execFileSync("node", [CHECK], { cwd: dir, encoding: "utf8" });
    expect(out).toContain("npm install");
    expect(out).toContain("pnpm install");
    expect(out).toContain("[ok] npm install retained");
    expect(out).toContain("[ok] pnpm install present");
  });

  it("删除 npm 时退出非 0,输出 fail,不得声称 pass", () => {
    const dir = mkdtempSync(join(tmpdir(), "saydo-readme-fail-"));
    writeFileSync(join(dir, "README.md"), "# 安装\n\n```\npnpm install\n```\n");
    let code = 0;
    let out = "";
    try {
      out = execFileSync("node", [CHECK], { cwd: dir, encoding: "utf8" });
    } catch (err) {
      const e = err as { status?: number; stdout?: string };
      code = Number(e.status ?? 1);
      out = String(e.stdout ?? "");
    }
    expect(code).not.toBe(0);
    expect(out).toContain("[fail] npm install missing");
    expect(out).not.toContain("[ok] npm install retained");
    expect(out).not.toMatch(/\bpass\b/i);
  });
});
