// W5a 3.2 验收锚:explainResult(09 §13)三层 + decisions 落库口播/上屏一致。
// - decisions:events.jsonl 机械抽文本 -> 廉价档惰性提炼 -> 落 tier1_runs.decisions_json(v6);
//   第二次调用不再调模型(读库);console getTaskDetail 读同一份(一致性锚)。
// - 诚实降级:无执行记录/无提炼模型 => 空 decisions + 如实话术;模型输出不合形 => ok:false 可重试。

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { computePackageDigest, type DecisionPackage, type TaskCard } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { insertProject } from "../src/storage/dao/projects.js";
import { managedProjectPath } from "../src/projects/workspace.js";
import { insertTask, insertTier1Run, type Tier1RunRow } from "../src/storage/dao/tasks.js";
import { explainResult, explainKindOf, renderDecisionsSpoken, extractAgentNarrative } from "../src/summary/explain.js";
import { getTaskDetail } from "../src/api/console.js";
import type { AuditSink } from "../src/obs/audit.js";
import type { LlmProvider } from "../src/providers/types.js";

const nullAudit: AuditSink = { record: () => ({ id: "aud_x" }) };
const NOW = "2026-07-27T12:00:00.000Z";
const PRJ = "prj_01AAAAAAAAAAAAAAAAAAAAAAAA";
const TASK = "tsk_01AAAAAAAAAAAAAAAAAAAAAAAA";
const RUN = "run_01AAAAAAAAAAAAAAAAAAAAAAA1";

let db: Db;
let runsDir: string;

function seed(status: string): void {
  insertProject(db, {
    id: PRJ,
    title: "报表",
    type: "coding",
    status: "active",
    workspace: { kind: "local_folder", path: managedProjectPath(PRJ), managed: true },
    executionModeDefault: "step_confirm",
    createdAt: NOW,
    updatedAt: NOW
  });
  const body = {
    id: "pkg_01AAAAAAAAAAAAAAAAAAAAAAAA",
    revision: 1,
    projectId: PRJ,
    outcomePreview: "导出按钮可用",
    inScope: ["导出"],
    outOfScope: [],
    assumptions: [],
    acceptance: ["Excel 能打开"],
    plan: [{ seq: 1, step: "实现", owner: "ai" as const }],
    cost: { expected: { known: false }, p95: { known: false }, max: 20, currency: "CNY" as const },
    risks: [],
    mode: "step_confirm" as const,
    preauthorizedEffects: [],
    effectPolicyVersion: "e2/0.1.0"
  };
  const pkg: DecisionPackage = {
    ...body,
    digest: computePackageDigest(body),
    status: "approved",
    expiresAt: "2026-08-01T00:00:00.000Z",
    createdAt: NOW
  };
  const task: TaskCard = {
    id: TASK,
    projectId: PRJ,
    packageRef: { packageId: pkg.id, revision: 1, digest: pkg.digest },
    title: "导出功能",
    specMarkdown: "spec",
    route: "tier1",
    adapter: "cursor",
    status: "confirmed",
    budget: { walltimeActiveMin: 45, maxTurns: 50, maxCost: 20 },
    updatedAt: NOW
  };
  insertTask(db, task, NOW);
  db.prepare("UPDATE tasks SET status=? WHERE id=?").run(status, TASK);
}

function seedRun(): void {
  const run: Tier1RunRow = {
    id: RUN,
    taskId: TASK,
    attempt: 1,
    adapter: "cursor",
    cwd: "/tmp/wt",
    worktreePath: "/tmp/wt",
    state: "settled_review",
    nativeSessionId: "sess-1",
    treeSha: "tree-good",
    createdAt: NOW,
    updatedAt: NOW
  };
  insertTier1Run(db, run);
}

function writeEvents(lines: string[]): void {
  mkdirSync(join(runsDir, RUN), { recursive: true });
  writeFileSync(join(runsDir, RUN, "events.jsonl"), lines.join("\n") + "\n");
}

function fakeDrafter(responses: string[]): LlmProvider & { calls: number } {
  const p = {
    kind: "api" as const,
    model: "cheap-1",
    calls: 0,
    async chat() {
      p.calls += 1;
      const text = responses[Math.min(p.calls - 1, responses.length - 1)] as string;
      return {
        ok: true as const,
        text,
        requestedModel: "cheap-1",
        observedModel: "cheap-1",
        observedModelSource: "stream" as const,
        observedModelExempted: false,
        usage: undefined
      };
    }
  };
  return p;
}

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), "saydo-explain-"));
  db = openDb(join(dir, "saydo.db"));
  runsDir = join(dir, "runs");
  mkdirSync(runsDir, { recursive: true });
});

describe("explainResult level=decisions(10 §5 第三层)", () => {
  const agentEvents = [
    JSON.stringify({ type: "system", subtype: "init", model: "fable" }),
    JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "我把导出格式定为 xlsx 而不是 csv,因为要保留样式。" }] } }),
    JSON.stringify({ type: "result", subtype: "success", result: "改完了,测试都过了。顺手把日期格式统一成 ISO,避免时区歧义。" })
  ];

  it("主锚:惰性提炼 -> 落库 -> 二次调用零模型调用 -> console 详情读同一份(口播/上屏一致)", async () => {
    seed("ready_for_review");
    seedRun();
    writeEvents(agentEvents);
    const drafter = fakeDrafter([
      JSON.stringify([
        { what: "导出用 xlsx 格式", why: "要保留样式,csv 存不住" },
        { what: "日期统一 ISO 格式", why: "避免时区歧义" }
      ])
    ]);
    const deps = { db, audit: nullAudit, drafter, runsDir, now: () => new Date(NOW) };

    const r1 = await explainResult(deps, { taskId: TASK, level: "decisions" });
    expect("ok" in (r1 as object) && (r1 as { ok?: boolean }).ok === false).toBe(false);
    const p1 = r1 as { kind: string; text: string; decisions: { what: string }[] };
    expect(p1.kind).toBe("coding_done");
    expect(p1.decisions).toHaveLength(2);
    expect(p1.text).toContain("xlsx");
    expect(p1.text).toContain("可以推翻");
    expect(drafter.calls).toBe(1);

    // 落库断言(v6 列)
    const row = db.prepare("SELECT decisions_json FROM tier1_runs WHERE id=?").get(RUN) as { decisions_json: string };
    expect(JSON.parse(row.decisions_json)).toHaveLength(2);

    // 二次调用:读库,不再调模型
    const r2 = await explainResult(deps, { taskId: TASK, level: "decisions" });
    expect((r2 as { decisions: unknown[] }).decisions).toHaveLength(2);
    expect(drafter.calls).toBe(1);

    // 上屏一致:console 任务详情读同一份落库数据
    const detail = getTaskDetail(db, TASK);
    expect(detail?.["decisions"]).toEqual(JSON.parse(row.decisions_json));
  });

  it("提炼上限:模型给 7 条只落 5 条(10 §5 <=5;overridable 机械恒 true)", async () => {
    seed("ready_for_review");
    seedRun();
    writeEvents(agentEvents);
    const seven = Array.from({ length: 7 }, (_, i) => ({ what: `决策${i + 1}`, why: `理由${i + 1}` }));
    const drafter = fakeDrafter([JSON.stringify(seven)]);
    const r = await explainResult({ db, audit: nullAudit, drafter, runsDir }, { taskId: TASK, level: "decisions" });
    const p = r as { decisions: { overridable: boolean }[] };
    expect(p.decisions).toHaveLength(5);
    expect(p.decisions.every((d) => d.overridable === true)).toBe(true);
  });

  it("诚实降级:无 drafter => 空 decisions + 如实话术;无执行记录 => 如实;模型输出不合形 => ok:false 可重试且不落库", async () => {
    seed("ready_for_review");
    seedRun();
    // 无事件文件
    const r0 = await explainResult({ db, audit: nullAudit, drafter: null, runsDir }, { taskId: TASK, level: "decisions" });
    expect((r0 as { text: string }).text).toContain("没有可提炼");

    writeEvents(agentEvents);
    const r1 = await explainResult({ db, audit: nullAudit, drafter: null, runsDir }, { taskId: TASK, level: "decisions" });
    expect((r1 as { text: string }).text).toContain("提炼模型未配置");
    expect((r1 as { decisions: unknown[] }).decisions).toEqual([]);

    const bad = fakeDrafter(["这不是 JSON"]);
    const r2 = await explainResult({ db, audit: nullAudit, drafter: bad, runsDir }, { taskId: TASK, level: "decisions" });
    expect((r2 as { ok: boolean; retryable: boolean }).ok).toBe(false);
    expect((r2 as { retryable: boolean }).retryable).toBe(true);
    const row = db.prepare("SELECT decisions_json FROM tier1_runs WHERE id=?").get(RUN) as { decisions_json: string | null };
    expect(row.decisions_json).toBeNull();
  });

  it("无本地 run(Hopper 路径)=> 如实指向报告页,不编", async () => {
    seed("ready_for_review");
    const r = await explainResult({ db, audit: nullAudit, drafter: null, runsDir }, { taskId: TASK, level: "decisions" });
    expect((r as { text: string }).text).toContain("Hopper");
  });
});

describe("explainResult 其余两层与 kind 映射", () => {
  it("one_liner:verify.json 模板绿灯计数进 tests 槽;walkthrough 机械扩写", async () => {
    seed("ready_for_review");
    seedRun();
    mkdirSync(join(runsDir, RUN), { recursive: true });
    writeFileSync(
      join(runsDir, RUN, "verify.json"),
      JSON.stringify([
        { templateRef: "package_script:test", exitCode: 0 },
        { templateRef: "justfile:ci", exitCode: 0 }
      ])
    );
    const r1 = await explainResult({ db, audit: nullAudit, drafter: null, runsDir }, { taskId: TASK, level: "one_liner" });
    expect((r1 as { text: string }).text).toContain("测试 2/2");
    expect((r1 as { text: string }).text).toContain("文件数未知"); // 无机械来源如实 unknown,禁写 0
    const r2 = await explainResult({ db, audit: nullAudit, drafter: null, runsDir }, { taskId: TASK, level: "walkthrough" });
    expect((r2 as { text: string }).text).toContain("验收标准");
  });

  it("kind 映射:review 族=coding_done / blocked / failed / 其余 unknown;任务不存在 => ok:false", async () => {
    expect(explainKindOf("ready_for_review")).toBe("coding_done");
    expect(explainKindOf("task_done")).toBe("coding_done");
    expect(explainKindOf("blocked")).toBe("blocked");
    expect(explainKindOf("failed")).toBe("failed");
    expect(explainKindOf("running")).toBe("unknown");
    const r = await explainResult({ db, audit: nullAudit, drafter: null, runsDir }, { taskId: "tsk_missing", level: "one_liner" });
    expect((r as { ok: boolean; code: string }).code).toBe("task_not_found");
  });

  it("narrative 抽取:只吃 assistant/result 文本,工具事件与未知行不进;超长截尾", () => {
    mkdirSync(join(runsDir, RUN), { recursive: true });
    writeFileSync(
      join(runsDir, RUN, "events.jsonl"),
      [
        JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "文本A" }] } }),
        JSON.stringify({ type: "tool_call", subtype: "started", tool_call: { name: "shell" } }),
        "not-json-line",
        JSON.stringify({ type: "result", subtype: "success", result: "文本B" })
      ].join("\n")
    );
    const n = extractAgentNarrative(runsDir, RUN);
    expect(n).toContain("文本A");
    expect(n).toContain("文本B");
    expect(n).not.toContain("shell");
    expect(renderDecisionsSpoken([])).toContain("没有记录到");
  });
});
