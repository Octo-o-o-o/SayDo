// A3 对话引擎工具路由(计划 1.3b;照抄 09 §13 契约)。
// Brain 只发起、daemon 侧执行;返回即 Brain 全部世界观(03 §1)。错误统一 {ok:false,code,message,retryable}。
// 命名统一 camelCase(§13 注)。P0 Phase 1 实现三个显式 handler(createTask/getStatus/openOnScreen);
// 其余工具(assessReadiness/proposeStart/confirmAndDispatch/审批/取消…)随 Phase 3/4 注册。

import { existsSync } from "node:fs";
import { z } from "zod";
import { newId, taskViewSchema, type TaskView, type ToolError } from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import type { LlmProvider } from "../providers/types.js";
import type { AuditSink } from "../obs/audit.js";
import { verifiedProjectWorkspace } from "../storage/dao/projects.js";

/** macOS 编辑器探测(缺省实现;不读配置——config 键属 canonical 面,本批不加) */
export function detectEditorDarwin(): "cursor" | "vscode" | null {
  if (existsSync("/Applications/Cursor.app")) return "cursor";
  if (existsSync("/Applications/Visual Studio Code.app")) return "vscode";
  return null;
}

export type ToolResult<T> = T | ToolError;

export interface TaskDraft {
  id: string;
  sessionId: string;
  rawPoints: string[];
  recital: string;
}

export interface ToolDeps {
  db: Db;
  audit: AuditSink;
  /** 沉思档(daemon 侧文本模型起草任务卡;09 §13 createTask 语义:语音模型不写契约) */
  thinkingProvider?: LlmProvider;
  /** 按会话锚定项目解析沉思档(项目覆盖 > 全局);未提供时回固定 thinkingProvider。 */
  thinkingProviderFor?: (sessionId: string) => LlmProvider | null;
  /** review URL 基址(openOnScreen P0=本地 review URL) */
  consoleBaseUrl?: string;
  /**
   * 编辑器探测(W5a 3.2:openOnScreen what="file" 编辑器深链——cursor:// 优先,vscode:// 兜底,
   * 都不可用回落本地 review URL;纯实现扩展,09 §13 签名不动)。缺省 = macOS /Applications 探测。
   */
  detectEditor?: () => "cursor" | "vscode" | null;
  /** 深链打开器(编辑器 scheme 专用;缺省 darwin `open <url>`;测试注入 spy)。review URL 不经此(不改既有行为) */
  openUrl?: (url: string) => void;
  now?: () => Date;
}

const createTaskInput = z.object({ sessionId: z.string(), rawPoints: z.array(z.string()).min(1) });
const getStatusInput = z.object({ taskId: z.string().optional() });
const openOnScreenInput = z.object({
  taskId: z.string(),
  what: z.enum(["diff", "log", "pr", "file"]),
  ref: z.string().optional()
});

export class BrainTools {
  private readonly deps: ToolDeps;
  private readonly drafts = new Map<string, TaskDraft>();
  private readonly now: () => Date;

  constructor(deps: ToolDeps) {
    this.deps = deps;
    this.now = deps.now ?? (() => new Date());
  }

  /** taskDraft 供 proposeStart(3.x)消费 */
  getDraft(id: string): TaskDraft | undefined {
    return this.drafts.get(id);
  }

  /** 该会话最新草稿(assessReadiness P0 规则层的机械输入;插入序 = Map 迭代序,取最后) */
  latestDraft(sessionId: string): TaskDraft | undefined {
    let latest: TaskDraft | undefined;
    for (const d of this.drafts.values()) {
      if (d.sessionId === sessionId) latest = d;
    }
    return latest;
  }

  /**
   * createTask(§13):上交对话原话要点;结构化任务卡由 daemon 侧文本模型起草(语音模型结构化输出不可靠)。
   * 返回 taskDraftId + recital(复述稿,Brain 逐点口头确认)。
   */
  async createTask(
    input: unknown,
    assertCurrent: () => void = () => {},
    signal?: AbortSignal
  ): Promise<ToolResult<{ taskDraftId: string; recital: string }>> {
    const parsed = createTaskInput.safeParse(input);
    if (!parsed.success) return { ok: false, code: "invalid_input", message: parsed.error.message, retryable: false };
    const { sessionId, rawPoints } = parsed.data;

    let recital: string;
    const thinkingProvider = this.deps.thinkingProviderFor?.(sessionId) ?? this.deps.thinkingProvider;
    if (thinkingProvider) {
      const r = await thinkingProvider.chat(
        {
          messages: [
            {
              role: "system",
              content:
                "你是任务卡起草助手。把用户零散要点整理成一段简短复述稿(不超过 3 句),供用户逐点口头确认。只输出复述稿,不要解释。"
            },
            { role: "user", content: rawPoints.map((p, i) => `${i + 1}. ${p}`).join("\n") }
          ],
          temperature: 0
        },
        signal
      );
      assertCurrent();
      if (!r.ok) return { ok: false, code: `draft_${r.code}`, message: r.message, retryable: r.retryable };
      recital = r.text.trim();
    } else {
      // 无 provider(测试/降级):机械复述要点
      recital = `我理解要做:${rawPoints.join(";")}。对吗?`;
    }

    assertCurrent();
    const draft: TaskDraft = { id: newId("tsk"), sessionId, rawPoints, recital };
    this.drafts.set(draft.id, draft);
    this.deps.audit.record({ actor: "daemon", action: "tool.createTask", meta: { sessionId, taskDraftId: draft.id } });
    return { taskDraftId: draft.id, recital };
  }

  /** getStatus(§13):TaskView[] 最小字段(§7 用户语词表由投影层给,Phase 4 接真实投影;P0 从 tasks 表投影粗态) */
  getStatus(input: unknown): ToolResult<TaskView[]> {
    const parsed = getStatusInput.safeParse(input);
    if (!parsed.success) return { ok: false, code: "invalid_input", message: parsed.error.message, retryable: false };
    const rows = (
      parsed.data.taskId
        ? this.deps.db.prepare("SELECT * FROM tasks WHERE id = ?").all(parsed.data.taskId)
        : this.deps.db.prepare("SELECT * FROM tasks ORDER BY updated_at DESC LIMIT 50").all()
    ) as Record<string, unknown>[];
    const views = rows.map((row) => {
      const budget = JSON.parse(row["budget_json"] as string) as { maxCost: number };
      return taskViewSchema.parse({
        taskId: row["id"],
        title: row["title"],
        status: String(row["status"]), // Phase 4 起经 §7 投影转用户语;P0 直出机器态
        attempt: 1,
        elapsedActiveMs: 0,
        budget: { max: budget.maxCost },
        lastEventOneLiner: "",
        asOf: this.now().toISOString()
      });
    });
    return views;
  }

  /**
   * openOnScreen(§13):diff/log/pr = 本地 review URL(零外部跳转,05 §4);
   * what="file" + ref(W5a 3.2)= 编辑器深链——cursor://file/<abs>:<line> 优先,vscode:// 兜底,
   * 无编辑器/ref 越界/项目无本地工作区 => 回落 review URL(签名与既有语义不变)。
   */
  openOnScreen(input: unknown): ToolResult<{ url: string }> {
    const parsed = openOnScreenInput.safeParse(input);
    if (!parsed.success) return { ok: false, code: "invalid_input", message: parsed.error.message, retryable: false };
    const base = this.deps.consoleBaseUrl ?? "http://127.0.0.1:47120";
    const { taskId, what, ref } = parsed.data;
    // P0 本地 review URL(hash 路由 08 §7-R8):任务详情页 + 定位片段
    const frag = ref ? `?${what}=${encodeURIComponent(ref)}` : `?view=${what}`;
    const reviewUrl = `${base}/#/p/_/task/${taskId}${frag}`;

    if (what === "file" && ref) {
      const editorUrl = this.editorDeepLink(taskId, ref);
      if (editorUrl !== null) {
        this.deps.audit.record({ actor: "daemon", action: "tool.openOnScreen", meta: { taskId, what, editor: true } });
        this.deps.openUrl?.(editorUrl); // 编辑器 scheme 才动 opener;review URL 保持既有行为
        return { url: editorUrl };
      }
    }
    this.deps.audit.record({ actor: "daemon", action: "tool.openOnScreen", meta: { taskId, what } });
    return { url: reviewUrl };
  }

  /** 编辑器深链构造:ref = "<workspace 相对路径>[:line]";越界/无工作区/无编辑器 => null(回落) */
  private editorDeepLink(taskId: string, ref: string): string | null {
    const detect = this.deps.detectEditor ?? detectEditorDarwin;
    const editor = detect();
    if (editor === null) return null;
    const m = /^(.*?)(?::(\d+))?$/.exec(ref);
    const relPath = m?.[1] ?? "";
    const line = m?.[2];
    // 路径纪律:仅工作区内相对路径(绝对路径/.. 一律回落,不给深链越界面)
    if (!relPath || relPath.startsWith("/") || relPath.startsWith("~") || relPath.split("/").includes("..")) return null;
    const row = this.deps.db.prepare("SELECT project_id FROM tasks WHERE id = ?").get(taskId) as
      | { project_id: string }
      | undefined;
    if (!row) return null;
    let workspacePath: string | null;
    try {
      workspacePath = verifiedProjectWorkspace(this.deps.db, row.project_id);
    } catch {
      return null;
    }
    if (!workspacePath) return null;
    const abs = `${workspacePath.replace(/\/+$/, "")}/${relPath}`;
    const suffix = line ? `:${line}` : "";
    return `${editor}://file${abs.startsWith("/") ? "" : "/"}${abs}${suffix}`;
  }
}
