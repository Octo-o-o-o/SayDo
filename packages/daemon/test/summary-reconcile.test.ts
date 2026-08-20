// 4.3 验收:摘要数字=规则统计(禁编造/未知不写 0);kill 重启恢复/降级;preflight;电源断言引用计数。

import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { TaskCard } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { Summarizer, renderOneLiner } from "../src/summary/summarizer.js";
import { reconcileOnStartup, deliveryPreflight, inDndWindow } from "../src/recovery/reconciler.js";
import { PowerAssertion, type PowerSpawner } from "../src/recovery/power.js";
import { insertProject } from "../src/storage/dao/projects.js";
import { managedProjectPath } from "../src/projects/workspace.js";
import { insertTask, insertTier1Run, type Tier1RunRow } from "../src/storage/dao/tasks.js";
import type { AuditSink } from "../src/obs/audit.js";

const nullAudit: AuditSink = { record: () => ({ id: "aud_x" }) };
const NOW = () => new Date("2026-07-25T00:00:00.000Z");

describe("C6 摘要器(数字纪律:规则统计,未知不写 0)", () => {
  const s = new Summarizer({ now: NOW });

  it("coding_done one_liner 来自统计;测试未知标 unknown 不写 0", () => {
    expect(renderOneLiner({ outcome: "review", filesChanged: 5, tests: { passed: 12, total: 12 } })).toBe(
      "改了 5 个文件,测试 12/12"
    );
    expect(renderOneLiner({ outcome: "review", filesChanged: 3, tests: { passed: 4, total: 5 }, unverifiedCount: 2 })).toBe(
      "改了 3 个文件,测试 4/5,2 项未验证"
    );
    // 测试未知:标"测试未知",不是 0/0
    expect(renderOneLiner({ outcome: "review", filesChanged: 1 })).toContain("测试未知");
    expect(renderOneLiner({ outcome: "review", filesChanged: 1 })).not.toContain("0/0");
  });

  it("判别联合:blocked/failed/unknown 各模板,不套成功句式", () => {
    expect(s.summarize({ outcome: "blocked", blockedReason: "需要补数据库连接串" }).kind).toBe("blocked");
    expect(s.summarize({ outcome: "blocked", blockedReason: "x" }).oneLiner).toContain("卡住了");
    expect(s.summarize({ outcome: "failed", failedCategory: "环境问题" }).kind).toBe("failed");
    expect(s.summarize({ outcome: "unknown" }).kind).toBe("unknown");
    expect(s.summarize({ outcome: "unknown" }).oneLiner).toContain("未知");
  });

  it("decisions[] P0 落库不进 one_liner;缓存按 evidenceDigest(同证据不重算,asOf 稳定)", () => {
    const stats = {
      outcome: "review" as const,
      filesChanged: 2,
      tests: { passed: 3, total: 3 },
      decisions: [{ what: "用 papaparse", why: "成熟稳定", overridable: true as const }]
    };
    const a = s.summarize(stats);
    const b = s.summarize({ ...stats });
    expect(a.asOf).toBe(b.asOf); // 缓存命中,asOf 不变
    expect(a.decisions).toHaveLength(1);
    expect(a.oneLiner).not.toContain("papaparse"); // decisions 不进 one_liner
  });

  it("walkthrough 数字纪律:叙事出现规则外文件数 ⇒ 报警并回退规则 one_liner", () => {
    const s2 = new Summarizer({ now: NOW, narrate: () => "改了 99 个文件,天衣无缝" });
    const r = s2.walkthrough({ outcome: "review", tests: { passed: 1, total: 1 } }); // filesChanged unknown
    expect(r.warning).toBeDefined();
    expect(r.text).toContain("文件数未知"); // 回退规则层
  });
});

describe("C7 启动对账(kill 重启恢复/降级)", () => {
  let db: Db;
  const PRJ = "prj_01AAAAAAAAAAAAAAAAAAAAAAAA";

  beforeEach(() => {
    db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-recon-")), "saydo.db"));
    insertProject(db, {
      id: PRJ,
      title: "p",
      type: "coding",
      status: "active",
      workspace: { kind: "local_folder", path: managedProjectPath(PRJ), managed: true },
      executionModeDefault: "step_confirm",
      createdAt: "2026-07-20T00:00:00.000Z",
      updatedAt: "2026-07-20T00:00:00.000Z"
    });
  });

  function seedRun(id: string, taskId: string, opts: { nativeSessionId?: string; worktreeExists: boolean }): void {
    const task: TaskCard = {
      id: taskId,
      projectId: PRJ,
      packageRef: { packageId: "pkg_01AAAAAAAAAAAAAAAAAAAAAAAA", revision: 1, digest: "sha256:" + "0".repeat(64) },
      title: "t",
      specMarkdown: "s",
      route: "tier1",
      adapter: "cursor",
      status: "running",
      budget: { walltimeActiveMin: 45, maxTurns: 50, maxCost: 20 },
      updatedAt: "2026-07-24T00:00:00.000Z"
    };
    insertTask(db, task, "2026-07-24T00:00:00.000Z");
    const wt = opts.worktreeExists ? mkdtempSync(join(tmpdir(), "saydo-wt-")) : "/tmp/saydo-gone-" + id;
    const run: Tier1RunRow = {
      id,
      taskId: task.id,
      attempt: 1,
      adapter: "cursor",
      cwd: wt,
      worktreePath: wt,
      state: "running",
      createdAt: "2026-07-24T00:00:00.000Z",
      updatedAt: "2026-07-24T00:00:00.000Z",
      ...(opts.nativeSessionId ? { nativeSessionId: opts.nativeSessionId } : {})
    };
    insertTier1Run(db, run);
  }

  it("有 nativeSessionId + worktree 在 ⇒ resumable;缺钥匙/worktree 丢 ⇒ 降级新会话", () => {
    seedRun("run_01AAAAAAAAAAAAAAAAAAAAAAAA", "tsk_01AAAAAAAAAAAAAAAAAAAAAAAA", { nativeSessionId: "cursor-sess-1", worktreeExists: true });
    seedRun("run_01BBBBBBBBBBBBBBBBBBBBBBBB", "tsk_01BBBBBBBBBBBBBBBBBBBBBBBB", { worktreeExists: true }); // 无 nativeSessionId
    seedRun("run_01CCCCCCCCCCCCCCCCCCCCCCCC", "tsk_01CCCCCCCCCCCCCCCCCCCCCCCC", { nativeSessionId: "cursor-sess-3", worktreeExists: false }); // worktree 丢

    const r = reconcileOnStartup(db, nullAudit);
    expect(r.interruptedRuns).toBe(3);
    const byId = new Map(r.recoveries.map((x) => [x.runId, x]));
    expect(byId.get("run_01AAAAAAAAAAAAAAAAAAAAAAAA")?.action).toBe("resumable");
    expect(byId.get("run_01BBBBBBBBBBBBBBBBBBBBBBBB")?.action).toBe("degrade_new_session");
    expect(byId.get("run_01CCCCCCCCCCCCCCCCCCCCCCCC")?.action).toBe("degrade_new_session");
  });
});

describe("C7 preflight + DND", () => {
  it("通道不可达 ⇒ 拒;DND 窗口内 ⇒ 拒(延到窗口末);正常 ⇒ 放行", () => {
    expect(deliveryPreflight({ nowHm: "10:00", channelReachable: false }).ok).toBe(false);
    expect(deliveryPreflight({ nowHm: "23:30", dndWindow: "23:00-08:00", channelReachable: true }).ok).toBe(false);
    expect(deliveryPreflight({ nowHm: "10:00", dndWindow: "23:00-08:00", channelReachable: true }).ok).toBe(true);
  });

  it("inDndWindow 跨午夜", () => {
    expect(inDndWindow("23:30", "23:00-08:00")).toBe(true);
    expect(inDndWindow("02:00", "23:00-08:00")).toBe(true);
    expect(inDndWindow("12:00", "23:00-08:00")).toBe(false);
    expect(inDndWindow("08:00", "23:00-08:00")).toBe(false); // 窗口末不含
  });
});

describe("电源断言(引用计数)", () => {
  it("首个 acquire 启动 caffeinate,清零 release 才 kill", () => {
    let started = 0;
    let killed = 0;
    const spawner: PowerSpawner = { start: () => (started++, { kill: () => void killed++ }) };
    const pa = new PowerAssertion(spawner);
    pa.acquire();
    pa.acquire();
    expect(started).toBe(1); // 只启一次
    expect(pa.active).toBe(true);
    pa.release();
    expect(killed).toBe(0); // 还有 1 ref
    pa.release();
    expect(killed).toBe(1); // 清零才 kill
    expect(pa.active).toBe(false);
  });

  it("不可用环境(spawner 返回 null)⇒ no-op 不炸", () => {
    const pa = new PowerAssertion({ start: () => null });
    expect(() => {
      pa.acquire();
      pa.release();
    }).not.toThrow();
  });
});
