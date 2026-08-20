// S3 屏幕审批卡 HTTP 承载(09 §3.3/§13,W4 3.1):四工具 + 状态查询。
// 纪律:每个端点在任何业务逻辑前执行 assertS3LocalAndBound(四断言缺一即 403 + 审计);
// 四工具不进 Brain tool manifest(brain/liveTools.ts 不注册,语音面无 S3 触发点);
// 错误统一 { ok:false, code, message, retryable }。

import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import { assertS3LocalAndBound, type S3GuardInput } from "../net/s3Guard.js";
import { getActiveCredential } from "../storage/dao/webauthn.js";
import {
  approveMerge,
  executeMergeSegment,
  issueS3Challenge,
  registerWebauthn,
  verifyS3Assertion,
  S3ToolError,
  type MergeSegmentDeps,
  type S3Deps
} from "../tier1/s3Tools.js";

export interface S3RouteResponse {
  status: number;
  payload: unknown;
}

export interface S3RouteDeps {
  db: Db;
  audit: AuditSink;
  runsDir: string;
  now?: () => Date;
  say?: (text: string) => void;
  /** merge 执行段调度(缺省 setImmediate;测试注入同步跑) */
  scheduleMergeSegment?: (run: () => void) => void;
}

function err(status: number, code: string, message: string): S3RouteResponse {
  return { status, payload: { ok: false, code, message, retryable: false } };
}

function toolErr(e: unknown): S3RouteResponse {
  if (e instanceof S3ToolError) {
    const status = e.code === "not_found" || e.code === "challenge_not_found" ? 404 : 409;
    return err(status, e.code, e.message.slice(0, 300));
  }
  return err(409, "s3_error", String(e instanceof Error ? e.message : e).slice(0, 300));
}

/**
 * S3 路由(index.ts 接线;返回 undefined = 非 S3 路由;全端点 POST——Origin 断言需要):
 *   POST /api/s3/challenge      { action:"merge", taskId } | { action:"register" }
 *   POST /api/s3/register       { challengeId, attestation }
 *   POST /api/s3/verify         { challengeId, assertion } -> { receiptId }
 *   POST /api/s3/status         -> { registered, credentialId?, rpId }
 *   POST /api/tasks/:id/approve-merge { s3ReceiptId } -> { state:"merging" }(执行段异步随后)
 */
export function handleS3Route(
  deps: S3RouteDeps,
  req: { method: string; pathname: string; body: unknown; guard: S3GuardInput; sessionId?: string }
): S3RouteResponse | undefined {
  const mApprove = /^\/api\/tasks\/([^/]+)\/approve-merge$/.exec(req.pathname);
  const isS3Face = req.pathname.startsWith("/api/s3/") || mApprove !== null;
  if (!isS3Face) return undefined;

  // 共享守卫先行(四断言缺一即 403 + 审计;任何业务逻辑前)
  const guard = assertS3LocalAndBound(req.guard);
  if (!guard.ok) {
    deps.audit.record({
      actor: "daemon",
      action: "s3.guard_rejected",
      meta: { path: req.pathname, code: guard.code, reason: guard.reason.slice(0, 160), peer: req.guard.socketRemoteAddress ?? "" }
    });
    return err(403, guard.code, guard.reason);
  }

  const toolDeps: S3Deps = {
    db: deps.db,
    audit: deps.audit,
    ...(deps.now ? { now: deps.now } : {}),
    ...(deps.say ? { say: deps.say } : {})
  };

  try {
    // 全部 S3 端点(含 status 查询)一律 POST:浏览器同源 GET fetch 不带 Origin 头,
    // 守卫 ②(Origin 精确断言)对 GET 无法成立——POST 恒带 Origin,四断言全端点统一
    if (req.method !== "POST") return err(405, "method_not_allowed", "S3 面只接受 POST(Origin 断言需要)");
    if (req.pathname === "/api/s3/status") {
      const cred = getActiveCredential(deps.db);
      return {
        status: 200,
        payload: {
          ok: true,
          registered: cred !== null,
          ...(cred ? { credentialId: cred.credentialId, backupEligible: cred.backupEligible ?? null, backupState: cred.backupState ?? null } : {}),
          rpId: guard.rpId
        }
      };
    }
    const body = (req.body ?? {}) as Record<string, unknown>;

    if (req.pathname === "/api/s3/challenge") {
      const out = issueS3Challenge(toolDeps, body as never, { ...(req.sessionId ? { sessionId: req.sessionId } : {}) });
      // navigator.credentials 需要 allowCredentials(merge)——响应附加活跃凭据 id 与 rpId(不改变合同签名)
      const cred = getActiveCredential(deps.db);
      return {
        status: 200,
        payload: { ok: true, ...out, rpId: guard.rpId, ...(cred ? { allowCredentialId: cred.credentialId } : {}) }
      };
    }
    if (req.pathname === "/api/s3/register") {
      const out = registerWebauthn(
        toolDeps,
        body as { challengeId: string; attestation: string },
        { origin: guard.expectedOrigin }
      );
      return { status: 200, payload: { ok: true, ...out } };
    }
    if (req.pathname === "/api/s3/verify") {
      const receipt = verifyS3Assertion(
        toolDeps,
        body as { challengeId: string; assertion: string },
        { origin: guard.expectedOrigin }
      );
      return { status: 200, payload: { ok: true, receiptId: receipt.id, expiresAt: receipt.expiresAt } };
    }
    if (mApprove) {
      const taskId = mApprove[1] as string;
      const out = approveMerge(toolDeps, { taskId, s3ReceiptId: String(body["s3ReceiptId"] ?? "") });
      // ⑤ merge 执行段在进入 merging 后进行(异步;verify 重跑可能分钟级,不挂 HTTP)
      const segDeps: MergeSegmentDeps = {
        db: deps.db,
        audit: deps.audit,
        runsDir: deps.runsDir,
        ...(deps.now ? { now: deps.now } : {})
      };
      const schedule = deps.scheduleMergeSegment ?? ((run) => setImmediate(run));
      schedule(() => {
        try {
          executeMergeSegment(segDeps, taskId);
        } catch (e) {
          deps.audit.record({
            actor: "daemon",
            action: "s3.merge_segment_error",
            meta: { taskId, error: String(e instanceof Error ? e.message : e).slice(0, 200) }
          });
        }
      });
      return { status: 200, payload: { ok: true, ...out } };
    }
    return err(404, "not_found", `unknown s3 route: ${req.pathname}`);
  } catch (e) {
    return toolErr(e);
  }
}
