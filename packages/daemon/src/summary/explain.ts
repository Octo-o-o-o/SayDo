// explainResult(09 §13;W5a 3.2):三层摘要工具面——one_liner/walkthrough(既有规则层渲染)+
// decisions(10 §5 第三层:每条=决策+理由+可推翻动作,≤5 条)。
// decisions 链:events.jsonl 机械抽文本 -> 廉价档惰性提炼(仅首次;禁编数字由层性质保证——
// decisions 是叙事不含统计数字,数字层仍走规则)-> **落库 tier1_runs.decisions_json**(v6)——
// 口播(本工具)与上屏(console 任务详情)读同一份,落库才一致。
// fail-closed 诚实:无执行记录/无提炼模型 => 空 decisions + 如实话术,不编造。

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { decisionSchema, isWritingSettleProof, writingSettleProofSchema, type Decision, type ExplainKind, type ToolError } from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import type { LlmProvider } from "../providers/types.js";
import { parseCursorLine } from "../providers/byoa/parsers.js";
import { renderOneLiner, type RunStats } from "./summarizer.js";

export interface ExplainDeps {
  db: Db;
  audit: AuditSink;
  /** 廉价档提炼器(缺失 = 如实降级,不编);复用 liveTools drafter 档 */
  drafter: LlmProvider | null;
  /** tier1 run 产物目录基址(<saydoHome>/tier1/runs;events.jsonl/verify.json 所在) */
  runsDir: string;
  now?: () => Date;
  signal?: AbortSignal;
}

export interface ExplainResultPayload {
  kind: ExplainKind;
  text: string;
  asOf: string;
  decisions?: Decision[];
}

const explainInput = z.object({
  taskId: z.string().min(1),
  level: z.enum(["one_liner", "walkthrough", "decisions"])
});

/** task.status + project.type -> ExplainKind(W4:writing 完成态 = content_done,09 §6.1a/§13) */
export function explainKindOf(status: string, projectType?: string): ExplainKind {
  if (["ready_for_review", "review_approved_waiting_merge", "merging", "task_done"].includes(status)) {
    return projectType === "writing" ? "content_done" : "coding_done";
  }
  if (status === "blocked") return "blocked";
  if (status === "failed") return "failed";
  return "unknown";
}

interface RunRow {
  id: string;
  attempt: number;
  decisions_json: string | null;
  settle_proof_json: string | null;
}

function latestRun(db: Db, taskId: string): RunRow | undefined {
  return db
    .prepare("SELECT id, attempt, decisions_json, settle_proof_json FROM tier1_runs WHERE task_id = ? ORDER BY attempt DESC LIMIT 1")
    .get(taskId) as RunRow | undefined;
}

/** content_done one_liner(10 §144:"成稿 {drafted}/{total} 节,{ac_pass}/{ac_total} 项验收待过目") */
function contentOneLiner(run: RunRow | undefined): string | null {
  if (!run?.settle_proof_json) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(run.settle_proof_json);
  } catch {
    return null;
  }
  if (!isWritingSettleProof(raw)) return null;
  const proof = writingSettleProofSchema.parse(raw);
  const drafted = proof.sectionCoverage.filter((s) => s.status === "drafted").length;
  const total = proof.sectionCoverage.length;
  const acPass = proof.acceptanceChecks.filter((c) => c.status === "pass").length;
  const acTotal = proof.acceptanceChecks.length;
  return `成稿 ${drafted}/${total} 节,${acPass}/${acTotal} 项验收待过目`;
}

/** events.jsonl 机械抽取 agent 文本(assistant/result;工具事件与未知行不进提炼输入) */
export function extractAgentNarrative(runsDir: string, runId: string, capChars = 8000): string {
  const p = join(runsDir, runId, "events.jsonl");
  if (!existsSync(p)) return "";
  const parts: string[] = [];
  for (const line of readFileSync(p, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const ev = parseCursorLine(line);
    if ((ev.kind === "text" || ev.kind === "result") && ev.text) parts.push(ev.text);
  }
  const joined = parts.join("\n");
  return joined.length > capChars ? joined.slice(-capChars) : joined;
}

/** 规则层统计(verify.json 模板绿灯计数;文件数无机械来源时如实 unknown,禁写 0) */
function statsFor(db: Db, taskId: string, runsDir: string, run: RunRow | undefined, status: string): RunStats {
  const outcome: RunStats["outcome"] =
    explainKindOf(status) === "coding_done" ? "review" : status === "blocked" ? "blocked" : status === "failed" ? "failed" : "unknown";
  const stats: RunStats = { outcome };
  if (run) {
    const vp = join(runsDir, run.id, "verify.json");
    if (existsSync(vp)) {
      try {
        const entries = JSON.parse(readFileSync(vp, "utf8")) as { exitCode: number }[];
        stats.tests = { passed: entries.filter((e) => e.exitCode === 0).length, total: entries.length };
      } catch {
        // verify.json 损坏 => 保持 unknown,不编
      }
    }
  }
  if (status === "blocked") {
    const row = db.prepare("SELECT cancel_reason FROM tasks WHERE id = ?").get(taskId) as { cancel_reason: string | null } | undefined;
    if (row?.cancel_reason) stats.blockedReason = row.cancel_reason;
  }
  return stats;
}

const distillOutput = z.array(z.object({ what: z.string().min(1), why: z.string().min(1) })).max(20);
const DISTILL_JSON_SCHEMA = {
  type: "array",
  maxItems: 20,
  items: {
    type: "object",
    additionalProperties: false,
    required: ["what", "why"],
    properties: { what: { type: "string", minLength: 1 }, why: { type: "string", minLength: 1 } }
  }
} as const;

/** 廉价档提炼(惰性,仅首次;结果 zod 校验 + 机械截 5 条 + overridable 恒 true) */
async function distillDecisions(drafter: LlmProvider, narrative: string, signal?: AbortSignal): Promise<Decision[] | null> {
  const r = await drafter.chat(
    {
      messages: [
        {
          role: "system",
          content:
            "你从一段编码 agent 的执行自述里提炼它自主拿主意的决策(技术取舍/方案选择/范围裁剪)。每条输出 {\"what\":\"决策\",\"why\":\"理由\"},最多 5 条,没有明确决策就输出 []。只输出 JSON 数组,不要任何解释或代码围栏。"
        },
        { role: "user", content: narrative }
      ],
      temperature: 0,
      jsonSchema: DISTILL_JSON_SCHEMA as unknown as Record<string, unknown>
    },
    signal
  );
  if (!r.ok) return null;
  const cleaned = r.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  const arr = distillOutput.safeParse(parsed);
  if (!arr.success) return null;
  return arr.data.slice(0, 5).map((d) => decisionSchema.parse({ what: d.what, why: d.why, overridable: true }));
}

/** decisions 口播稿(10 §5:决策+理由+可推翻动作;≤5 条由落库层保证) */
export function renderDecisionsSpoken(decisions: Decision[]): string {
  if (decisions.length === 0) return "这轮没有记录到 agent 的自主决策。";
  const lines = decisions.map((d, i) => `第 ${i + 1} 条,${d.what}。理由:${d.why}。这条可以推翻。`);
  return `这轮 agent 自己拿了 ${decisions.length} 个主意:${lines.join(" ")}`;
}

/**
 * explainResult 工具实现(09 §13 签名;liveTools 与 console POST 写口共用——口播/上屏同源)。
 * decisions 层:已落库直接读;未落库且有提炼器 => 惰性提炼 + 落库;否则如实空。
 */
export async function explainResult(deps: ExplainDeps, input: unknown): Promise<ExplainResultPayload | ToolError> {
  const parsed = explainInput.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid_input", message: parsed.error.message, retryable: false };
  const { taskId, level } = parsed.data;
  const task = deps.db
    .prepare("SELECT t.id, t.status, t.route, p.type AS project_type FROM tasks t LEFT JOIN projects p ON p.id=t.project_id WHERE t.id = ?")
    .get(taskId) as { id: string; status: string; route: string; project_type: string | null } | undefined;
  if (!task) return { ok: false, code: "task_not_found", message: `任务不存在:${taskId}`, retryable: false };
  const now = deps.now ?? ((): Date => new Date());
  const kind = explainKindOf(task.status, task.project_type ?? undefined);
  const run = latestRun(deps.db, taskId);
  const stats = statsFor(deps.db, taskId, deps.runsDir, run, task.status);
  // content_done(writing 成稿):one_liner 走内容型模板(10 §144),不套 coding 的文件/测试计数
  const oneLiner = kind === "content_done" ? (contentOneLiner(run) ?? "成稿完成,待你逐节过目") : renderOneLiner(stats);

  if (level === "one_liner") return { kind, text: oneLiner, asOf: now().toISOString() };
  if (level === "walkthrough") {
    // walkthrough 数字仍来自规则层(禁编);叙事扩写留给 drafter 已有链路,此处机械拼接可核数字
    const extra =
      kind === "coding_done"
        ? "建议到任务详情页按验收标准逐条过。"
        : kind === "content_done"
          ? "到任务详情页逐节评审,manual 项要你逐条裁决才算数。"
          : "细节看任务详情页。";
    return { kind, text: `${oneLiner}。${extra}`, asOf: now().toISOString() };
  }

  // level === "decisions"
  if (!run) {
    return { kind, text: "这个任务没有本地执行记录(可能走了 Hopper 路径),决策看它的报告页。", asOf: now().toISOString(), decisions: [] };
  }
  let decisions: Decision[] | null = null;
  if (run.decisions_json !== null) {
    try {
      decisions = z.array(decisionSchema).parse(JSON.parse(run.decisions_json));
    } catch {
      decisions = null; // 落库损坏按未提炼重走(不炸)
    }
  }
  if (decisions === null) {
    const narrative = extractAgentNarrative(deps.runsDir, run.id);
    if (!narrative) {
      return { kind, text: "这轮没有可提炼的执行记录。", asOf: now().toISOString(), decisions: [] };
    }
    if (!deps.drafter) {
      return { kind, text: "决策还没提炼(提炼模型未配置),先看任务详情页的原始记录。", asOf: now().toISOString(), decisions: [] };
    }
    decisions = await distillDecisions(deps.drafter, narrative, deps.signal);
    if (decisions === null) {
      return { ok: false, code: "distill_failed", message: "决策提炼失败(模型输出不合形),稍后可重试", retryable: true };
    }
    deps.db
      .prepare("UPDATE tier1_runs SET decisions_json = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(decisions), now().toISOString(), run.id);
    deps.audit.record({
      actor: "daemon",
      action: "summary.decisions_distilled",
      meta: { taskId, runId: run.id, count: decisions.length }
    });
  }
  return { kind, text: renderDecisionsSpoken(decisions), asOf: now().toISOString(), decisions };
}
