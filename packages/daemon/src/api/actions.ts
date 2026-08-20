// D1 控制台动作端点(接线批任务②;HANDOFF §2-9-②):console 写口——POST /api/tasks/:id/<action>,
// G1 身份门内(index.ts 统一校验 capability token + Host/Origin,§12-10 跨站/DNS-rebinding 反例同门)。
// 全部动作调 tier1/operations 库层(状态机 + CAS 单源),错误统一 { ok:false, code, message, retryable }。

import { execFileSync } from "node:child_process";
import { z } from "zod";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import {
  cancelWithAutoSettle,
  reviewTask,
  retryTask,
  requestManualMerge,
  verifyAndCompleteMerge
} from "../tier1/operations.js";
import { verifiedProjectWorkspace } from "../storage/dao/projects.js";

export interface ActionResponse {
  status: number;
  payload: unknown;
}

const reviewBody = z.object({
  verdict: z.enum(["approve", "request_changes", "reject"]),
  expectedAttempt: z.number().int().nonnegative(),
  comments: z.string().optional(),
  // W4 3.2 writing:manual 验收项逐条裁决(09 §6.1a barrier ④;UI 未逐条 ⇒ operations 层拒 approve)
  acceptanceVerdicts: z.array(z.object({ criterion: z.string().min(1), status: z.enum(["pass", "fail"]) })).optional()
});

const retryBody = z.object({ message: z.string().optional() });

export const TASK_ACTIONS = ["review", "cancel", "retry", "request-manual-merge", "verify-merge"] as const;
export type TaskAction = (typeof TASK_ACTIONS)[number];

/** W2 阶段 B 红线(IMPL-5 §2-B):S3 合并链只在受信终端(本机)——手机薄版 = 只读 + S2 屏幕面,
 *  绝不放行 S3;薄版不改 S3 语义(S3 屏幕审批卡属 W4)。 */
export const S3_TRUSTED_TERMINAL_ONLY: ReadonlySet<string> = new Set(["request-manual-merge", "verify-merge"]);

function err(status: number, code: string, message: string, retryable = false): ActionResponse {
  return { status, payload: { ok: false, code, message, retryable } };
}

/**
 * 任务动作路由(纯函数,index.ts 接线;e2e 直测):
 * - review:验收三态(approve 的 evidenceDigest 库内自取,operations 层 fail-closed);
 * - cancel:cancel_requested;无活跃 run 即时 settled(09 §6.1 括注);
 * - retry:重派发(failed→queued)/应答注入(blocked→running);
 * - request-manual-merge:人工合并交接(P0 无 S3 卡;S3 无语音/单击直批路径)。
 */
export function handleTaskAction(
  db: Db,
  audit: AuditSink,
  taskId: string,
  action: string,
  body: unknown,
  nowIso: string,
  opts: { via?: "local" | "tailnet" } = {}
): ActionResponse {
  // 阶段 B:tailnet 来源的 S3 合并链动作拒 + 话术引导回受信终端(10 诚实纪律;审计留痕)
  if (opts.via === "tailnet" && S3_TRUSTED_TERMINAL_ONLY.has(action)) {
    audit.record({
      actor: "owner",
      action: "t2.s3_action_rejected",
      meta: { taskId, attempted: action, via: "tailnet" }
    });
    return err(
      403,
      "s3_requires_trusted_terminal",
      "合并属于 S3 操作,手机上不放行——回到桌面屏幕完成;手机端可以看任务、批执行中的 S2 审批。"
    );
  }
  try {
    switch (action as TaskAction) {
      case "review": {
        const parsed = reviewBody.safeParse(body ?? {});
        if (!parsed.success) return err(400, "invalid_input", parsed.error.message);
        const r = reviewTask(
          db,
          audit,
          {
            taskId,
            verdict: parsed.data.verdict,
            expectedAttempt: parsed.data.expectedAttempt,
            ...(parsed.data.comments !== undefined ? { comments: parsed.data.comments } : {}),
            ...(parsed.data.acceptanceVerdicts !== undefined ? { acceptanceVerdicts: parsed.data.acceptanceVerdicts } : {})
          },
          nowIso
        );
        return { status: 200, payload: { ok: true, ...r } };
      }
      case "cancel": {
        // 09 §6.1:该时点无活跃 run(confirmed/queued/ready_for_review 等)⇒ 即时 settled
        const r = cancelWithAutoSettle(db, audit, taskId, nowIso);
        return { status: 200, payload: { ok: true, ...r } };
      }
      case "retry": {
        const parsed = retryBody.safeParse(body ?? {});
        if (!parsed.success) return err(400, "invalid_input", parsed.error.message);
        const r = retryTask(db, audit, taskId, nowIso, parsed.data.message);
        return { status: 200, payload: { ok: true, ...r } };
      }
      case "request-manual-merge": {
        const r = requestManualMerge(db, audit, taskId);
        return { status: 200, payload: { ok: true, ...r } };
      }
      case "verify-merge": {
        // MergeProof watcher 的按需触发形态(owner 合并后点核验;P0 无常驻 git 观察者):
        // treeSha 从项目主仓 git 现读(不信人工输入),对账基准 = 批准时落库的 approved_tree_sha
        const row = db
          .prepare(
            `SELECT t.approved_tree_sha, t.project_id FROM tasks t WHERE t.id = ?`
          )
          .get(taskId) as { approved_tree_sha: string | null; project_id: string } | undefined;
        if (!row) return err(404, "not_found", `task not found: ${taskId}`);
        let repo: string | null = null;
        try {
          repo = verifiedProjectWorkspace(db, row.project_id);
        } catch {
          return err(409, "workspace_identity_changed", "project workspace identity changed");
        }
        if (!repo) return err(409, "no_workspace", "project workspace path missing (无法观察合并)");
        let treeSha: string;
        let mergeCommit: string;
        try {
          treeSha = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { cwd: repo, encoding: "utf8", timeout: 5000 }).trim();
          mergeCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8", timeout: 5000 }).trim();
        } catch (e) {
          return err(409, "git_observe_failed", `无法读主仓 HEAD:${String(e).slice(0, 120)}`);
        }
        const r = verifyAndCompleteMerge(
          db,
          audit,
          { taskId, mergeCommit, treeSha, approvedProspectiveTreeSha: row.approved_tree_sha ?? "" },
          nowIso
        );
        if (!r.done) return err(409, "merge_not_verified", r.reason ?? "merge proof mismatch");
        return { status: 200, payload: { ok: true, state: "task_done", mergeCommit } };
      }
      default:
        return err(404, "unknown_action", `unknown task action: ${action}`);
    }
  } catch (e) {
    const message = String(e instanceof Error ? e.message : e).slice(0, 300);
    // 状态先决条件不满足(状态机守卫/竞态/证据缺失)= 409;找不到 = 404
    if (message.includes("not found")) return err(404, "not_found", message);
    return err(409, "precondition_failed", message);
  }
}
