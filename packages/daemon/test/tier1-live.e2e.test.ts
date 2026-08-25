// 执行器批任务⑤:真 cursor-agent 端到端(本批完成判定核心)——门控 SAYDO_LIVE_E2E=1 手动跑
// (CI 默认跳过:外部 LLM 调用有延迟/耗订阅额度/不确定性,不进确定性双矩阵)。
// 全链:seed queued -> executor 认领 -> worktree 供给 + 真 gate socket -> spawn 真 cursor-agent
// (-p --force stream-json)-> agent 改文件(+可选 shell 过 gate)-> verify(真跑 package.json test)
// -> Tier1SettleProof(真实 git write-tree)-> ready_for_review -> reviewTask approve -> 人工合并
// -> task_done。检查点①遵守:PoC 独立临时仓,绝不碰 dogfood 真仓。
// 手动跑:SAYDO_LIVE_E2E=1 pnpm --filter @saydo/daemon exec vitest run test/tier1-live.e2e.test.ts

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { newId, tier1SettleProofSchema } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { insertProject } from "../src/storage/dao/projects.js";
import { insertTask } from "../src/storage/dao/tasks.js";
import { CallbackEngine } from "../src/callback/engine.js";
import { requestManualMerge, reviewTask, verifyAndCompleteMerge } from "../src/tier1/operations.js";
import { Tier1Executor, realAgentSpawner } from "../src/tier1/executor.js";
import { RuntimeApprovalFlow } from "../src/tier1/approvalFlow.js";
import { buildActiveGateScript, ensureGateScript } from "../src/tier1/gateScript.js";
import { startTier1Gate } from "../src/tier1/gateServer.js";
import { createLogger } from "../src/obs/logger.js";
import type { Server } from "node:http";

const LIVE = process.env["SAYDO_LIVE_E2E"] === "1";
const PINNED = process.env["SAYDO_CURSOR_PINNED"] ?? "2026.07.23-e383d2b";
const BIN = process.env["SAYDO_CURSOR_BIN"] ?? join(homedir(), ".local/share/cursor-agent/versions", PINNED, "cursor-agent");
const MODEL = process.env["SAYDO_CURSOR_MODEL"] ?? "sonnet-4.5";
const PRJ = "prj_01VE2E0000000000000000000A";

let servers: Server[] = [];
const repos = new Set<string>();
afterEach(() => {
  for (const s of servers) s.close();
  servers = [];
  for (const repo of repos) rmSync(repo, { recursive: true, force: true });
  repos.clear();
});

function makePocRepo(): string {
  const dir = mkdtempSync(join(process.cwd(), ".saydo-poc-repo-"));
  repos.add(dir);
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "poc@saydo.local"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "saydo-poc"], { cwd: dir });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "poc", version: "1.0.0", scripts: { test: 'node -e "process.exit(0)"' } }, null, 2));
  mkdirSync(join(dir, ".saydo"));
  writeFileSync(join(dir, ".saydo", "project.toml"), '[[verify.entries]]\nname = "test"\nsource = "package_script"\nref = "test"\n');
  writeFileSync(join(dir, "README.md"), "# PoC 测试仓(SayDo Tier1 live e2e;非 dogfood)\n");
  execFileSync("git", ["add", "-A"], { cwd: dir });
  execFileSync("git", ["commit", "-qm", "init"], { cwd: dir });
  return dir;
}

describe.skipIf(!LIVE)("真 cursor-agent 端到端(SAYDO_LIVE_E2E)", () => {
  it(
    "认领 -> 真 agent 改文件 -> verify -> settle -> ready_for_review -> approve -> 人工合并 -> task_done",
    async () => {
      expect(existsSync(BIN), `锁定二进制不存在:${BIN}(设 SAYDO_CURSOR_BIN 覆盖)`).toBe(true);
      const saydoHome = mkdtempSync(join(tmpdir(), "saydo-live-home-"));
      const db: Db = openDb(join(saydoHome, "saydo.db"));
      const audit = createSqliteAuditSink(db);
      const log = createLogger({ dir: join(saydoHome, "logs"), name: "live-e2e" });
      const callbacks = new CallbackEngine({ db, audit });
      const repo = makePocRepo();
      insertProject(db, {
        id: PRJ,
        title: "PoC 测试仓",
        type: "coding",
        status: "active",
        workspace: { kind: "local_folder", path: repo, managed: false },
        executionModeDefault: "step_confirm",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const gp = ensureGateScript(saydoHome);
      const executor = new Tier1Executor({
        db,
        audit,
        log,
        callbacks,
        approvals: new RuntimeApprovalFlow({ db, audit, confirm: null, say: null, activeVoiceSession: () => null }),
        spawner: realAgentSpawner(),
        cfg: {
          saydoHome,
          lockedBinary: BIN,
          pinnedVersion: PINNED,
          model: MODEL,
          adapter: "cursor",
          gateScriptPath: gp.scriptPath,
          gateScriptExpected: buildActiveGateScript(gp),
          hooksTimeoutSec: 120,
          verifyTimeoutMs: 120_000
        }
      });
      servers.push(await startTier1Gate(saydoHome, gp.sockPath, (req) => executor.handleGateRequest(req)));

      const TSK = "tsk_01VE2E0000000000000000000A";
      const t0 = new Date().toISOString();
      insertTask(
        db,
        {
          id: TSK,
          projectId: PRJ,
          packageRef: { packageId: newId("pkg"), revision: 1, digest: `sha256:${"d".repeat(64)}` },
          title: "加一个问候文件",
          specMarkdown:
            "# 任务\n只做两件事,做完回复 done,不要执行其它命令:\n" +
            "1. 在当前目录创建文件 `GREETING.txt`,内容就一行:`hello from saydo tier1`;\n" +
            "2. 用 shell 执行 `ls -la` 看一下当前目录,确认文件在。\n",
          route: "tier1",
          adapter: "cursor",
          status: "confirmed",
          budget: { walltimeActiveMin: 20, maxTurns: 40, maxCost: 20 },
          updatedAt: t0
        },
        t0
      );
      db.prepare("UPDATE tasks SET status='queued', updated_at=? WHERE id=?").run(t0, TSK);

      executor.assertVersion();
      executor.tick();

      await vi.waitFor(
        () => {
          const st = (db.prepare("SELECT status FROM tasks WHERE id=?").get(TSK) as { status: string }).status;
          if (st === "failed" || st === "blocked") {
            const ob = db.prepare("SELECT settle_json FROM callback_outbox WHERE task_id=?").get(TSK) as { settle_json?: string } | undefined;
            throw new Error(`agent 全链未到 ready_for_review,落 ${st}:${ob?.settle_json ?? "(no proof)"}`);
          }
          expect(st).toBe("ready_for_review");
        },
        { timeout: 300_000, interval: 1000 }
      );

      const run = db.prepare("SELECT id, tree_sha, settle_proof_json, attempt FROM tier1_runs WHERE task_id=?").get(TSK) as {
        id: string;
        tree_sha: string;
        settle_proof_json: string;
        attempt: number;
      };
      const proof = tier1SettleProofSchema.parse(JSON.parse(run.settle_proof_json));
      expect(proof.treeSha).toMatch(/^[0-9a-f]{40}$/);
      // agent 真的改了文件:GREETING.txt 在 settle 快照树内
      const treeList = execFileSync("git", ["ls-tree", "-r", "--name-only", run.tree_sha], { cwd: repo, encoding: "utf8" });
      expect(treeList).toContain("GREETING.txt");
      // worktree 里文件内容如实
      const wt = join(repo, ".saydo", "worktrees", TSK, "GREETING.txt");
      expect(existsSync(wt)).toBe(true);
      log.info("live agent produced GREETING", { content: readFileSync(wt, "utf8").trim().slice(0, 80) });

      // gate 若被触发(agent 跑了 shell)则有决策审计;不硬断言(agent 可能用内置编辑工具改文件)
      const gateDecisions = db.prepare("SELECT COUNT(*) AS c FROM audit_log WHERE action='tier1.gate_decision'").get() as { c: number };
      log.info("live gate decisions", { count: gateDecisions.c });

      // 验收 approve -> 人工合并 -> task_done
      reviewTask(db, audit, { taskId: TSK, verdict: "approve", expectedAttempt: run.attempt }, new Date().toISOString());
      const approvedTree = (db.prepare("SELECT approved_tree_sha FROM tasks WHERE id=?").get(TSK) as { approved_tree_sha: string }).approved_tree_sha;
      requestManualMerge(db, audit, TSK);
      const parent = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
      const mergeCommit = execFileSync("git", ["commit-tree", approvedTree, "-p", parent, "-m", "manual merge"], { cwd: repo, encoding: "utf8" }).trim();
      execFileSync("git", ["update-ref", "refs/heads/main", mergeCommit], { cwd: repo });
      const done = verifyAndCompleteMerge(db, audit, { taskId: TSK, mergeCommit, treeSha: approvedTree, approvedProspectiveTreeSha: approvedTree }, new Date().toISOString());
      expect(done.done).toBe(true);
      expect((db.prepare("SELECT status FROM tasks WHERE id=?").get(TSK) as { status: string }).status).toBe("task_done");
    },
    360_000
  );

  it(
    "W1.4/0.0(a) setup/push 钩子覆盖:真 agent 发 install(S2 上浮->屏幕批准->放行)与 push 保护分支(S3 deny)",
    async () => {
      expect(existsSync(BIN), `锁定二进制不存在:${BIN}`).toBe(true);
      const saydoHome = mkdtempSync(join(tmpdir(), "saydo-live-home2-"));
      const db: Db = openDb(join(saydoHome, "saydo.db"));
      const audit = createSqliteAuditSink(db);
      const log = createLogger({ dir: join(saydoHome, "logs"), name: "live-e2e-hooks" });
      const callbacks = new CallbackEngine({ db, audit });
      const repo = makePocRepo();
      insertProject(db, {
        id: PRJ,
        title: "PoC 测试仓",
        type: "coding",
        status: "active",
        workspace: { kind: "local_folder", path: repo, managed: false },
        executionModeDefault: "step_confirm",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      const gp = ensureGateScript(saydoHome);
      const approvals = new RuntimeApprovalFlow({ db, audit, confirm: null, say: null, activeVoiceSession: () => null, receiptTimeoutSec: () => 90 });
      const executor = new Tier1Executor({
        db,
        audit,
        log,
        callbacks,
        approvals,
        spawner: realAgentSpawner(),
        cfg: {
          saydoHome,
          lockedBinary: BIN,
          pinnedVersion: PINNED,
          model: MODEL,
          adapter: "cursor",
          gateScriptPath: gp.scriptPath,
          gateScriptExpected: buildActiveGateScript(gp),
          hooksTimeoutSec: 120,
          verifyTimeoutMs: 120_000,
          receiptTimeoutSec: () => 90
        }
      });
      servers.push(await startTier1Gate(saydoHome, gp.sockPath, (req) => executor.handleGateRequest(req)));

      // 屏幕批准模拟:轮询 pending 的 runtime_effect 收据,一律 accept(S2 面;S3 无路径可放,gate 直拒)
      const approver = setInterval(() => {
        const rows = db
          .prepare("SELECT id FROM approvals WHERE kind='runtime_effect' AND outcome='pending'")
          .all() as { id: string }[];
        for (const r of rows) approvals.decide(r.id, "accept", { via: "screen" });
      }, 1000);

      try {
        const TSK = "tsk_01VE2E0000000000000000000B";
        const t0 = new Date().toISOString();
        insertTask(
          db,
          {
            id: TSK,
            projectId: PRJ,
            packageRef: { packageId: newId("pkg"), revision: 1, digest: `sha256:${"e".repeat(64)}` },
            title: "多步任务:装依赖并尝试推送",
            specMarkdown:
              "# 任务\n按顺序做,做完回复 done:\n" +
              "1. 用 shell 执行 `pnpm install --prefer-offline`(本仓无依赖,应当很快);\n" +
              "2. 用 shell 执行 `git push origin main`——**如果这条命令被审批系统拒绝,如实说明被拒绝,绝对不要重试或想别的办法绕过**;\n" +
              "3. 在当前目录创建文件 `DONE.txt`,内容一行:`done`。\n",
            route: "tier1",
            adapter: "cursor",
            status: "confirmed",
            budget: { walltimeActiveMin: 20, maxTurns: 40, maxCost: 20 },
            updatedAt: t0
          },
          t0
        );
        db.prepare("UPDATE tasks SET status='queued', updated_at=? WHERE id=?").run(t0, TSK);
        // S2 收据签发前提:任务有 dispatch 拍板轮(turn_ref 溯源锚;取不到 = fail-closed deny——
        // 首跑实测正是被这条纪律拦下)。种一条已消费的 dispatch_package 收据(与生产派单链同型)。
        db.prepare(
          `INSERT INTO approvals(id, kind, ref_digest, task_id, turn_ref, risk, principal, decided_via,
             auth_strength, decision, nonce, outcome, issued_at, expires_at, decided_at, consumed_at)
           VALUES (?, 'dispatch_package', ?, ?, ?, 'S1', 'owner', 'voice', 'voice_weak',
             'accept', ?, 'consumed', ?, ?, ?, ?)`
        ).run(
          "apr_01VE2E00000000000000000LIV",
          `sha256:${"e".repeat(64)}`,
          TSK,
          "trn_01VE2E0000000000000000000T",
          "nonce-live-w14-hooks",
          t0,
          t0,
          t0,
          t0
        );
        executor.assertVersion();
        executor.tick();

        await vi.waitFor(
          () => {
            const st = (db.prepare("SELECT status FROM tasks WHERE id=?").get(TSK) as { status: string }).status;
            if (st === "failed" || st === "blocked") {
              const ob = db.prepare("SELECT settle_json FROM callback_outbox WHERE task_id=?").get(TSK) as { settle_json?: string } | undefined;
              throw new Error(`全链未到 ready_for_review,落 ${st}:${ob?.settle_json ?? "(no proof)"}`);
            }
            expect(st).toBe("ready_for_review");
          },
          { timeout: 300_000, interval: 1000 }
        );

        // 0.0(a) 取证:install 命令经门(S2 收据 accept 后放行);push 保护分支经门被 deny(S3)
        const decisions = db
          .prepare("SELECT meta_json FROM audit_log WHERE action='tier1.gate_decision' ORDER BY id")
          .all() as { meta_json: string }[];
        const metas = decisions.map((d) => JSON.parse(d.meta_json) as { risk: string; permission: string; effectKind: string });
        log.info("live gate decisions detail", { metas: JSON.stringify(metas) });
        expect(metas.some((m) => m.effectKind === "install_dependency" && m.permission === "allow")).toBe(true);
        expect(metas.some((m) => m.effectKind === "push_branch" && m.permission === "deny" && m.risk === "S3")).toBe(true);
        // S2 收据消费在案(runtime_effect accept -> consumed)
        const consumed = db
          .prepare("SELECT COUNT(*) AS c FROM approvals WHERE kind='runtime_effect' AND outcome='consumed'")
          .get() as { c: number };
        expect(consumed.c).toBeGreaterThan(0);
      } finally {
        clearInterval(approver);
      }
    },
    360_000
  );

  it(
    "W1.4/0.0(a) --resume 续会话外部事实:spawner 双跑同 chatId,cursor-agent 续原会话(session_id 同一)",
    async () => {
      // 说明:recover 消费链(native-session.txt 采集 -> spawn 带 resumeChatId)已有确定性单元锚
      // (tier1-executor.test W1.4 用例);本测试补 0.0(a) 的外部事实——cursor-agent 真的接受
      // --resume <chatId> 并续同一原生会话。伪造 daemon 崩溃在进程内做不干净(executor 会自行结算),
      // 外部事实 + 单元锚合起来闭合 0.0(a) 验收句,不假装跑了全链崩溃恢复。
      expect(existsSync(BIN), `锁定二进制不存在:${BIN}`).toBe(true);
      const work = mkdtempSync(join(tmpdir(), "saydo-live-resume-"));
      const spawner = realAgentSpawner();
      const collect = async (input: { prompt: string; resumeChatId?: string }): Promise<string[]> => {
        const lines: string[] = [];
        const proc = spawner.spawn({
          runId: "test-run",
          binary: BIN,
          model: MODEL,
          prompt: input.prompt,
          cwd: work,
          env: { PATH: process.env["PATH"] ?? "", HOME: process.env["HOME"] ?? "", TERM: "xterm" },
          ...(input.resumeChatId ? { resumeChatId: input.resumeChatId } : {})
        });
        proc.onLine((l) => lines.push(l));
        await proc.wait();
        return lines;
      };
      const sessionIdOf = (lines: string[]): string => {
        for (const l of lines) {
          if (!l.includes('"init"')) continue;
          const sid = (JSON.parse(l) as { session_id?: string }).session_id;
          if (sid) return sid;
        }
        return "";
      };

      const first = await collect({ prompt: "记住暗号:蓝鲸吞月。只回复 ok,不要执行任何命令。" });
      const chatId = sessionIdOf(first);
      expect(chatId).not.toBe("");

      const second = await collect({ prompt: "刚才我告诉你的暗号是什么?直接回复暗号原文,不要执行任何命令。", resumeChatId: chatId });
      const sid2 = sessionIdOf(second);
      // --resume 生效的机械证据:同一原生会话 id
      expect(sid2).toBe(chatId);
      // 语义证据(软):续会话能取回上文暗号(在 result/assistant 文本里)
      const allText = second.join("\n");
      expect(allText).toContain("蓝鲸吞月");
    },
    240_000
  );
});
