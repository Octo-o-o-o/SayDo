// Journey-01 生产闭环:scripted provider + 真实 LiveDialog/ConfirmationLoop + 受控本地执行器。
// 标注:模型=fake-dialog/fake-drafter;执行器=FileWritingSpawner fixture,不是云模型或付费 CLI。
// 不 transitionTask 伪完成,不直接 compileLivePack 冒充下一轮;下一回合经 onAsrFinal 消费 trusted memory。

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync as fsRead, rmSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { textDigest } from "@saydo/contracts";
import { createFocus } from "../src/focus/registry.js";
import { getFocusDetail } from "../src/api/console.js";
import { confirmCardIdentityFromPayload } from "../src/live/confirm.js";
import { reviewTask } from "../src/tier1/operations.js";
import { Tier1Executor, type AgentProcessHandle, type AgentSpawner } from "../src/tier1/executor.js";
import { CallbackEngine } from "../src/callback/engine.js";
import { RuntimeApprovalFlow } from "../src/tier1/approvalFlow.js";
import { buildActiveGateScript, ensureGateScript } from "../src/tier1/gateScript.js";
import { canonicalizeWorkspace } from "../src/projects/workspace.js";
import {
  SES,
  TURN,
  RAC,
  buildRig,
  scriptedProvider,
  lastToolResult,
  coverReadiness,
  insertRacProject,
  type Rig
} from "./live-wiring.e2e.test.js";
import type { ChatMessage } from "../src/providers/types.js";
import type { Logger } from "../src/obs/logger.js";

const EVIDENCE = join(
  process.env.HOME ?? "",
  ".codex",
  "tasks",
  "saydo-journey01-acceptance-20260920",
  "repair4-evidence"
);

const CLAIM = "用户偏好:发布前不用再问我";
const OWNER_TEST_ROOT = mkdtempSync(join(process.cwd(), ".saydo-journey01-ws-"));
const fakeLog = { info() {}, warn() {}, error() {}, child() { return fakeLog; } } as unknown as Logger;

const EV = {
  init: JSON.stringify({ type: "system", subtype: "init", model: "fable-5-max" }),
  result: JSON.stringify({ type: "result", subtype: "success", result: "README 安装一节已补 pnpm 示例" })
};

/** 确定性本地执行器适配:spawn 时真实写文件,再吐事件 + exit 0。不是 cursor-agent/云模型。 */
class FileWritingSpawner implements AgentSpawner {
  constructor(private readonly files: Record<string, string>) {}
  version(): string {
    return "1.0.0-pinned";
  }
  spawn(i: { cwd: string }): AgentProcessHandle {
    for (const [rel, content] of Object.entries(this.files)) {
      const abs = join(i.cwd, rel);
      mkdirSync(join(abs, ".."), { recursive: true });
      writeFileSync(abs, content);
    }
    const cbs: ((l: string) => void)[] = [];
    const exitP = new Promise<{ exitCode: number }>((resolve) => {
      setTimeout(() => {
        for (const l of [EV.init, EV.result]) for (const cb of cbs) cb(l);
        resolve({ exitCode: 0 });
      }, 5);
    });
    return { pid: 1, onLine: (cb) => cbs.push(cb), kill: () => void 0, wait: () => exitP };
  }
}

function journeyScript(): (messages: ChatMessage[], call: number) => {
  ok: true;
  text: string;
  toolCalls?: Array<{ id: string; name: string; arguments: string }>;
  observedModel: string;
  usage: undefined;
} {
  let packageId = "";
  let revision = 0;
  return (messages, call) => {
    const meta = { observedModel: "fake-dialog" as const, usage: undefined };
    if (call === 1) {
      return { ok: true, text: "受众是谁？\n1. 商业\n2. 内部", ...meta };
    }
    if (call === 2) {
      return {
        ok: true,
        text: "",
        toolCalls: [
          {
            id: "c1",
            name: "createTask",
            arguments: JSON.stringify({
              rawPoints: ["README 安装一节补 pnpm 说明", "验收:出现 pnpm install 示例"]
            })
          }
        ],
        ...meta
      };
    }
    if (call === 3) {
      const r = lastToolResult(messages);
      return {
        ok: true,
        text: "",
        toolCalls: [{ id: "c2", name: "proposeStart", arguments: JSON.stringify({ taskDraftId: r["taskDraftId"] }) }],
        ...meta
      };
    }
    if (call === 4) {
      const r = lastToolResult(messages);
      packageId = String(r["packageId"]);
      revision = Number(r["revision"]);
      return {
        ok: true,
        text: "我这边评估过了,可以开始了。做完你会得到:README 安装一节带 pnpm 说明。预计封顶 20 元。",
        ...meta
      };
    }
    if (call === 5) {
      return {
        ok: true,
        text: "",
        toolCalls: [
          { id: "c3", name: "issueDispatchReceipt", arguments: JSON.stringify({ packageId, revision }) }
        ],
        ...meta
      };
    }
    if (call === 6) {
      return { ok: true, text: "收到。", ...meta };
    }
    if (call === 7) {
      return {
        ok: true,
        text: "",
        toolCalls: [
          {
            id: "m0",
            name: "remember",
            arguments: JSON.stringify({ tier: "M0", claim: CLAIM, trust: "user_stated" })
          }
        ],
        ...meta
      };
    }
    if (call === 8) {
      return { ok: true, text: "记下了。", ...meta };
    }
    return { ok: true, text: "按你记住的偏好继续。", ...meta };
  };
}

function makeGitRepo(): string {
  const dir = mkdtempSync(join(OWNER_TEST_ROOT, "repo-"));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "t@t.local"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "t"], { cwd: dir });
  const repoRoot = join(import.meta.dirname, "..", "..", "..");
  const repoPkg = JSON.parse(fsRead(join(repoRoot, "package.json"), "utf8")) as { packageManager?: unknown };
  const packageManager = repoPkg.packageManager;
  if (typeof packageManager !== "string" || !/^pnpm@\d+\.\d+\.\d+$/.test(packageManager)) {
    throw new Error(`journey fixture requires repo packageManager pnpm@x.y.z, got ${String(packageManager)}`);
  }
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({
      name: "journey01",
      version: "1.0.0",
      packageManager,
      scripts: {
        "check-readme": "node ./check-readme-install.mjs"
      }
    })
  );
  writeFileSync(
    join(dir, "check-readme-install.mjs"),
    fsRead(join(repoRoot, "e2e", "journey01-browser", "check-readme-install.mjs"))
  );
  mkdirSync(join(dir, ".saydo"));
  writeFileSync(
    join(dir, ".saydo", "project.toml"),
    '[[verify.entries]]\nname = "check-readme"\nsource = "package_script"\nref = "check-readme"\n'
  );
  writeFileSync(join(dir, "README.md"), "# 安装\n\nnpm install\n");
  execFileSync("git", ["add", "-A"], { cwd: dir });
  execFileSync("git", ["commit", "-qm", "init"], { cwd: dir });
  return dir;
}

function attachUnmanagedWorkspace(r: Rig, repo: string): void {
  const identity = canonicalizeWorkspace(repo);
  r.db
    .prepare(
      `UPDATE projects
          SET workspace_json=?, canonical_workspace_path=?, workspace_dev=?, workspace_ino=?
        WHERE id=?`
    )
    .run(
      JSON.stringify({ kind: "local_folder", path: identity.path, managed: false }),
      identity.path,
      identity.dev,
      identity.ino,
      RAC
    );
}

function makeExecutor(r: Rig): Tier1Executor {
  const gp = ensureGateScript(r.home);
  return new Tier1Executor({
    db: r.db,
    audit: r.audit,
    log: fakeLog,
    callbacks: new CallbackEngine({ db: r.db, audit: r.audit }),
    approvals: new RuntimeApprovalFlow({ db: r.db, audit: r.audit, confirm: null, say: null, activeVoiceSession: () => null }),
    spawner: new FileWritingSpawner({
      "README.md": "# 安装\n\nnpm install\n\n```\npnpm install\n```\n"
    }),
    cfg: {
      saydoHome: r.home,
      lockedBinary: "/fake/versions/1.0.0-pinned/cursor-agent",
      pinnedVersion: "1.0.0-pinned",
      model: "fable-5-max",
      adapter: "cursor",
      gateScriptPath: gp.scriptPath,
      gateScriptExpected: buildActiveGateScript(gp),
      verifyTimeoutMs: 30_000
    }
  });
}

function armJourney(r: Rig, repo: string): string {
  insertRacProject(r, "闭环项目");
  attachUnmanagedWorkspace(r, repo);
  const { focusId } = createFocus(r.db, { title: "journey01 闭环", actorKind: "user" });
  r.db
    .prepare(
      `INSERT INTO sessions(id, project_id, state, engine, transcript_path, started_at)
       VALUES (?, ?, 'talking', 'cascade', ?, '2026-09-20T03:00:00.000Z')`
    )
    .run(SES, RAC, join(r.home, "transcript-j01.jsonl"));
  r.db.prepare("UPDATE sessions SET primary_focus_id = ? WHERE id = ?").run(focusId, SES);
  coverReadiness(r, SES);
  return focusId;
}

afterAll(() => {
  rmSync(OWNER_TEST_ROOT, { recursive: true, force: true });
});

describe("journey-01 生产闭环", () => {
  it(
    "提需求→采访→包→receipt批准→受控执行器真实产物/settle proof→reviewTask approve→下一对话回合消费 trusted memory",
    async () => {
      const seen: ChatMessage[][] = [];
      const script = journeyScript();
      const r = buildRig(
        scriptedProvider((messages, call) => {
          seen.push(messages);
          return script(messages, call);
        })
      );
      const repo = makeGitRepo();
      const focusId = armJourney(r, repo);
      const ids: Record<string, unknown> = {
        sessionId: SES,
        focusId,
        fixture: {
          model: "fake-dialog/fake-drafter",
          executor: "FileWritingSpawner",
          note: "确定性本地适配,不是云模型或付费 CLI 验收"
        },
        not_run: []
      };

      await r.dialog.onAsrFinal(SES, TURN(1), "帮我把 README 的安装一节补个 pnpm 说明");
      expect(r.spoken.some((s) => s.text.includes("受众是谁"))).toBe(true);
      expect(r.spoken.some((s) => /要不要开始|拍板/.test(s.text))).toBe(false);

      await r.dialog.onAsrFinal(SES, TURN(2), "「受众是谁？」我选:商业");
      expect(r.spoken.some((s) => s.text.includes("可以开始了"))).toBe(true);

      await r.dialog.onAsrFinal(SES, TURN(3), "开始吧");
      const pending = r.confirm.pending(SES);
      expect(pending).toBeDefined();
      expect(pending?.payload.kind).toBe("dispatch");
      const identity = confirmCardIdentityFromPayload(pending!.payload);
      expect(identity.packageId).toBeTruthy();
      expect(identity.revision).toBe(1);
      ids.packageId = identity.packageId;
      ids.revision = identity.revision;
      ids.receiptId = pending!.receiptId;
      ids.digest = pending!.digest;

      const detailBefore = getFocusDetail(r.db, focusId);
      expect(detailBefore).toBeTruthy();
      const pendingPkg = (detailBefore?.packages ?? []).find((p) => p["id"] === identity.packageId);
      expect(pendingPkg).toBeTruthy();
      expect(Number(pendingPkg?.["revision"])).toBe(1);
      ids.focusRevision = detailBefore?.focus.currentRevision;

      const missing = r.confirm.consumeClick(SES, "rcpt_missing", pending!.digest, "accept");
      expect(missing.kind).toBe("not_pending");
      expect(r.confirm.pending(SES)?.receiptId).toBe(pending!.receiptId);

      r.dialog.applyConfirmClick(SES, pending!.receiptId, pending!.digest, "accept");
      expect(r.confirm.pending(SES)).toBeUndefined();

      const task = r.db.prepare("SELECT id, status, package_id, package_rev FROM tasks").get() as {
        id: string;
        status: string;
        package_id: string;
        package_rev: number;
      };
      expect(task.status).toBe("queued");
      expect(task.package_id).toBe(identity.packageId);
      expect(task.package_rev).toBe(1);
      ids.taskId = task.id;
      const bound = r.db
        .prepare("SELECT task_id FROM action_execution_bindings WHERE task_id=? AND focus_id=?")
        .get(task.id, focusId) as { task_id: string } | undefined;
      expect(bound?.task_id).toBe(task.id);

      const executor = makeExecutor(r);
      executor.tick();
      await vi.waitFor(
        () =>
          expect(
            (r.db.prepare("SELECT status FROM tasks WHERE id=?").get(task.id) as { status: string }).status
          ).toBe("ready_for_review"),
        { timeout: 20_000, interval: 50 }
      );

      const run = r.db
        .prepare("SELECT id, attempt, state, tree_sha, worktree_path, settle_proof_json FROM tier1_runs WHERE task_id=?")
        .get(task.id) as {
        id: string;
        attempt: number;
        state: string;
        tree_sha: string;
        worktree_path: string;
        settle_proof_json: string;
      };
      expect(run.state).toBe("settled_review");
      expect(run.tree_sha).toMatch(/^[0-9a-f]{40}$/);
      expect(run.settle_proof_json).toBeTruthy();
      const treeList = execFileSync("git", ["ls-tree", "-r", "--name-only", run.tree_sha], {
        cwd: repo,
        encoding: "utf8"
      });
      expect(treeList).toContain("README.md");
      const readme = execFileSync("git", ["cat-file", "-p", `${run.tree_sha}:README.md`], {
        cwd: repo,
        encoding: "utf8"
      });
      expect(readme).toContain("pnpm install");
      expect(readme).toContain("npm install");
      const checkOut = execFileSync("node", [join(repo, "check-readme-install.mjs")], {
        cwd: run.worktree_path,
        encoding: "utf8"
      });
      expect(checkOut).toContain("[ok] npm install retained");
      expect(checkOut).toContain("[ok] pnpm install present");
      const verifyRaw = fsRead(join(r.home, "tier1", "runs", run.id, "verify.json"), "utf8");
      const verifyDigest = textDigest(verifyRaw);
      expect(verifyRaw).toContain("[ok] npm install retained");
      expect(verifyRaw).toContain("[ok] pnpm install present");
      const proof = JSON.parse(run.settle_proof_json) as {
        tier1VerifyDigest: string;
        acceptanceChecks?: Array<{ status: string; source: string; evidenceRef?: string }>;
      };
      expect(proof.tier1VerifyDigest).toBe(verifyDigest);
      expect(
        (proof.acceptanceChecks ?? []).every(
          (c) => c.status === "unknown" && c.source === "manual" && c.evidenceRef === `verify:${verifyDigest}`
        )
      ).toBe(true);
      ids.codingSettleManualUnknown = true;
      ids.runId = run.id;
      ids.treeSha = run.tree_sha;
      ids.settleProofPresent = true;

      const approved = reviewTask(
        r.db,
        r.audit,
        { taskId: task.id, verdict: "approve", expectedAttempt: run.attempt, runsDir: join(r.home, "tier1", "runs") },
        new Date().toISOString()
      );
      expect(approved.state).toBe("review_approved_waiting_merge");
      ids.reviewStatus = approved.state;

      await r.dialog.onAsrFinal(SES, TURN(4), "以后发布前不用再问我");
      const memPending = r.confirm.pending(SES);
      expect(memPending?.payload.kind).toBe("memory");
      ids.memoryReceiptId = memPending?.receiptId;
      ids.memoryDigest = memPending?.digest;
      r.dialog.applyConfirmClick(SES, memPending!.receiptId, memPending!.digest, "accept");
      const mem = r.db
        .prepare("SELECT trust, claim FROM memory_events WHERE op='add' AND tier='M0'")
        .get() as { trust: string; claim: string };
      expect(mem).toEqual({ trust: "user_approved", claim: CLAIM });

      const beforeReuse = seen.length;
      await r.dialog.onAsrFinal(SES, TURN(5), "按记住的偏好继续,发布前不用再问");
      const reuseTurns = seen.slice(beforeReuse);
      expect(reuseTurns.length).toBeGreaterThan(0);
      const packed = reuseTurns.some((turn) =>
        turn.some((m) => m.role === "system" && String(m.content).includes(CLAIM))
      );
      expect(packed).toBe(true);
      ids.nextTurnConsumedClaim = true;

      mkdirSync(EVIDENCE, { recursive: true });
      writeFileSync(join(EVIDENCE, "journey01-closed-loop.json"), `${JSON.stringify(ids, null, 2)}\n`);
    },
    30_000
  );
});
