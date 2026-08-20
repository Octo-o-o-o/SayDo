// 1.3b 验收:工具入出参符合 §13(三工具显式用例)+ 桩 Context Pack。

import { mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { newId, taskViewSchema, type Project, type TaskCard } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { insertProject } from "../src/storage/dao/projects.js";
import { insertTask } from "../src/storage/dao/tasks.js";
import { BrainTools } from "../src/brain/tools.js";
import { stubContextPack } from "../src/brain/contextPack.js";
import { managedProjectPath } from "../src/projects/workspace.js";
import type { LlmProvider } from "../src/providers/types.js";
import type { AuditSink } from "../src/obs/audit.js";

const nullAudit: AuditSink = { record: () => ({ id: "aud_x" }) };
const TS = () => new Date("2026-07-24T00:00:00Z");
const OWNER_TEST_ROOT = mkdtempSync(join(process.cwd(), ".saydo-tools-"));

let db: Db;
let tools: BrainTools;

beforeEach(() => {
  db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-tools-")), "saydo.db"));
  tools = new BrainTools({ db, audit: nullAudit, now: TS });
});

afterAll(() => {
  rmSync(OWNER_TEST_ROOT, { recursive: true, force: true });
});

describe("createTask(§13:daemon 侧起草复述稿)", () => {
  it("无 provider:机械复述 + 返回 taskDraftId,draft 可被 proposeStart 消费", async () => {
    const r = await tools.createTask({ sessionId: newId("ses"), rawPoints: ["加 CSV 导出", "Excel 能打开"] });
    expect("taskDraftId" in r).toBe(true);
    if (!("taskDraftId" in r)) throw new Error();
    expect(r.recital).toContain("CSV 导出");
    expect(tools.getDraft(r.taskDraftId)?.rawPoints).toEqual(["加 CSV 导出", "Excel 能打开"]);
  });

  it("有 thinking provider:用其输出作复述稿", async () => {
    const fake: LlmProvider = {
      kind: "api",
      model: "m",
      chat: async () => ({
        ok: true,
        text: "要做:报表页加 CSV 导出,Excel 可直接打开。对吗?",
        requestedModel: "m",
        observedModel: "m",
        observedModelSource: "stream",
        observedModelExempted: false,
        usage: undefined
      })
    };
    const t = new BrainTools({ db, audit: nullAudit, thinkingProvider: fake, now: TS });
    const r = await t.createTask({ sessionId: newId("ses"), rawPoints: ["x"] });
    if (!("taskDraftId" in r)) throw new Error();
    expect(r.recital).toContain("CSV 导出");
  });

  it("thinkingProviderFor 按 session 消费项目解析结果,优先于全局 provider", async () => {
    const globalProvider: LlmProvider = {
      kind: "api",
      model: "global-thinking",
      chat: async () => ({
        ok: true,
        text: "全局输出",
        requestedModel: "global-thinking",
        observedModel: "global-thinking",
        observedModelSource: "stream",
        observedModelExempted: false,
        usage: undefined
      })
    };
    const projectProvider: LlmProvider = {
      kind: "api",
      model: "project-thinking",
      chat: async () => ({
        ok: true,
        text: "项目覆盖输出",
        requestedModel: "project-thinking",
        observedModel: "project-thinking",
        observedModelSource: "stream",
        observedModelExempted: false,
        usage: undefined
      })
    };
    const resolvedSessions: string[] = [];
    const t = new BrainTools({
      db,
      audit: nullAudit,
      thinkingProvider: globalProvider,
      thinkingProviderFor: (sessionId) => {
        resolvedSessions.push(sessionId);
        return projectProvider;
      }
    });
    const result = await t.createTask({ sessionId: "ses_project", rawPoints: ["x"] });
    expect(result).toMatchObject({ recital: "项目覆盖输出" });
    expect(resolvedSessions).toEqual(["ses_project"]);
  });

  it("provider 失败 => 工具错误(retryable 透传)", async () => {
    const fail: LlmProvider = {
      kind: "api",
      model: "m",
      chat: async () => ({ ok: false, code: "timeout", message: "slow", retryable: true })
    };
    const t = new BrainTools({ db, audit: nullAudit, thinkingProvider: fail });
    const r = await t.createTask({ sessionId: newId("ses"), rawPoints: ["x"] });
    expect(r).toMatchObject({ ok: false, retryable: true });
  });

  it("非法入参 => invalid_input", async () => {
    const r = await tools.createTask({ sessionId: "s" });
    expect(r).toMatchObject({ ok: false, code: "invalid_input" });
  });
});

describe("getStatus(§13:TaskView 最小字段)", () => {
  it("返回符合 taskViewSchema 的视图", () => {
    const projectId = newId("prj");
    const p: Project = {
      id: projectId, title: "t", type: "coding", status: "active",
      workspace: { kind: "local_folder", path: managedProjectPath(projectId), managed: true },
      executionModeDefault: "step_confirm", createdAt: "2026-07-24T00:00:00Z", updatedAt: "2026-07-24T00:00:00Z"
    };
    insertProject(db, p);
    const task: TaskCard = {
      id: newId("tsk"), projectId: p.id,
      packageRef: { packageId: newId("pkg"), revision: 1, digest: "sha256:" + "a".repeat(64) },
      title: "导出 CSV", specMarkdown: "s", route: "tier1", status: "queued", adapter: "cursor",
      budget: { walltimeActiveMin: 45, maxTurns: 50, maxCost: 20 }, updatedAt: "2026-07-24T00:00:00Z"
    };
    insertTask(db, task, "2026-07-24T00:00:00Z");
    const r = tools.getStatus({ taskId: task.id });
    expect(Array.isArray(r)).toBe(true);
    if (!Array.isArray(r)) throw new Error();
    expect(r).toHaveLength(1);
    expect(() => taskViewSchema.parse(r[0])).not.toThrow();
    expect(r[0]!.taskId).toBe(task.id);
    expect(r[0]!.budget.max).toBe(20);
  });

  it("无 taskId 返回全部(空库=[])", () => {
    const r = tools.getStatus({});
    expect(r).toEqual([]);
  });
});

describe("openOnScreen(§13:P0 本地 review URL,零外部跳转)", () => {
  it("生成 console hash 路由 URL(diff/log/pr/file)", () => {
    const r = tools.openOnScreen({ taskId: "tsk_x", what: "diff", ref: "src/a.ts" });
    if (!("url" in r)) throw new Error();
    expect(r.url).toContain("/#/p/_/task/tsk_x");
    expect(r.url).toContain("diff=src%2Fa.ts");
    expect(r.url.startsWith("http://127.0.0.1")).toBe(true); // 本地,零外跳
  });

  it("非法 what => invalid_input", () => {
    const r = tools.openOnScreen({ taskId: "t", what: "database" });
    expect(r).toMatchObject({ ok: false, code: "invalid_input" });
  });
});

describe("openOnScreen 编辑器深链(W5a 3.2;09 §13 签名不动,纯实现扩展)", () => {
  const seedTaskWithWorkspace = (wsPath = OWNER_TEST_ROOT): string => {
    const p: Project = {
      id: newId("prj"), title: "t", type: "coding", status: "active",
      workspace: { kind: "local_folder", path: wsPath, managed: false },
      executionModeDefault: "step_confirm", createdAt: "2026-07-24T00:00:00Z", updatedAt: "2026-07-24T00:00:00Z"
    };
    insertProject(db, p);
    const task: TaskCard = {
      id: newId("tsk"), projectId: p.id,
      packageRef: { packageId: newId("pkg"), revision: 1, digest: "sha256:" + "a".repeat(64) },
      title: "深链", specMarkdown: "s", route: "tier1", status: "queued", adapter: "cursor",
      budget: { walltimeActiveMin: 45, maxTurns: 50, maxCost: 20 }, updatedAt: "2026-07-24T00:00:00Z"
    };
    insertTask(db, task, "2026-07-24T00:00:00Z");
    return task.id;
  };

  it("主锚:cursor 可用 => cursor://file/<abs>:<line>;opener 只吃编辑器 scheme", () => {
    const opened: string[] = [];
    const t = new BrainTools({ db, audit: nullAudit, detectEditor: () => "cursor", openUrl: (u) => opened.push(u), now: TS });
    const tid = seedTaskWithWorkspace();
    const r = t.openOnScreen({ taskId: tid, what: "file", ref: "src/app.ts:42" });
    if (!("url" in r)) throw new Error();
    expect(r.url).toBe(`cursor://file${OWNER_TEST_ROOT}/src/app.ts:42`);
    expect(opened).toEqual([r.url]);
  });

  it("vscode 兜底(无行号形态);无编辑器 => 回落本地 review URL 且不动 opener", () => {
    const opened: string[] = [];
    const tid = seedTaskWithWorkspace();
    const t1 = new BrainTools({ db, audit: nullAudit, detectEditor: () => "vscode", openUrl: (u) => opened.push(u), now: TS });
    const r1 = t1.openOnScreen({ taskId: tid, what: "file", ref: "README.md" });
    if (!("url" in r1)) throw new Error();
    expect(r1.url).toBe(`vscode://file${OWNER_TEST_ROOT}/README.md`);

    const t2 = new BrainTools({ db, audit: nullAudit, detectEditor: () => null, openUrl: (u) => opened.push(u), now: TS });
    const r2 = t2.openOnScreen({ taskId: tid, what: "file", ref: "README.md" });
    if (!("url" in r2)) throw new Error();
    expect(r2.url).toContain("/#/p/_/task/");
    expect(opened).toEqual([`vscode://file${OWNER_TEST_ROOT}/README.md`]); // 回落不 open
  });

  it("路径纪律:绝对路径/../~ 越界 ref 回落 review URL(不给深链越界面);任务无工作区同回落", () => {
    const tid = seedTaskWithWorkspace();
    const t = new BrainTools({ db, audit: nullAudit, detectEditor: () => "cursor", now: TS });
    for (const ref of ["/etc/passwd", "../secrets.txt", "a/../../x.ts", "~/x.ts"]) {
      const r = t.openOnScreen({ taskId: tid, what: "file", ref });
      if (!("url" in r)) throw new Error();
      expect(r.url).toContain("/#/p/_/task/"); // 回落
    }
    // 任务不存在(查不到 workspace)=> 回落
    const r = t.openOnScreen({ taskId: "tsk_ghost", what: "file", ref: "src/a.ts" });
    if (!("url" in r)) throw new Error();
    expect(r.url).toContain("/#/p/_/task/");
  });

  it("diff/log/pr 不走编辑器深链(语义不变)", () => {
    const tid = seedTaskWithWorkspace();
    const opened: string[] = [];
    const t = new BrainTools({ db, audit: nullAudit, detectEditor: () => "cursor", openUrl: (u) => opened.push(u), now: TS });
    for (const what of ["diff", "log", "pr"] as const) {
      const r = t.openOnScreen({ taskId: tid, what, ref: "src/a.ts" });
      if (!("url" in r)) throw new Error();
      expect(r.url).toContain("/#/p/_/task/");
    }
    expect(opened).toEqual([]);
  });
});

describe("桩 Context Pack(1.3b;确定性)", () => {
  it("同输入同 digest;topicTerms 规范化(小写+字典序)", () => {
    const a = stubContextPack({ sessionId: newId("ses"), projectId: newId("prj"), topicTerms: ["CSV", "导出"] });
    const b = stubContextPack({ sessionId: newId("ses"), projectId: newId("prj"), topicTerms: ["导出", "csv"] });
    expect(a.packDigest).toBe(b.packDigest); // sessionId/projectId 不入签名域
    expect(a.topicTerms).toEqual(["csv", "导出"]);
  });
});
