// S3 屏幕审批卡四工具(09 §3.3/§13,W4 3.1;签名/事务语义逐字照抄):
//   issueS3Challenge / registerWebauthn / verifyS3Assertion / approveMerge(+ merge 执行段)。
// 红线(09 §3.3):四工具不进 Brain tool manifest(语音面无 S3 触发点);全部 HTTP 承载 endpoint
// 前置 assertS3LocalAndBound(net/s3Guard.ts);S3 收据只能由 verifyS3Assertion 产生;
// review_approved_waiting_merge → merging 唯一入口 = approveMerge(canTransitionTask receipt-gated)。

import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  bytesDigest,
  canTransitionTask,
  isS3MergeReceipt,
  isWritingSettleProof,
  jcsDigest,
  newId,
  s3MergeReceiptSchema,
  textDigest,
  tier1SettleProofSchema,
  writingSettleProofSchema,
  S3_RP_ID,
  type ApprovalReceipt,
  type S3Challenge,
  type S3MergeReceipt
} from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import { getApproval, insertApproval } from "../storage/dao/approvals.js";
import { verifiedProjectWorkspace } from "../storage/dao/projects.js";
import {
  consumeS3ChallengeCas,
  getActiveCredential,
  getS3Challenge,
  insertS3Challenge,
  insertWebauthnCredential,
  touchCredentialOnAssert
} from "../storage/dao/webauthn.js";
import { verifyWebauthnAssertion, verifyWebauthnAttestation } from "./webauthn/verify.js";
import { verifyEnv } from "./executor.js";
import type { FrozenVerify } from "./verifyFreeze.js";

/** 挑战短窗(09 §3.3:缺省 issuedAt + 120s;过期即废,重新发起);S3 收据同窗 */
export const S3_CHALLENGE_TTL_MS = 120_000;

export class S3ToolError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export interface S3Deps {
  db: Db;
  audit: AuditSink;
  now?: () => Date;
  /** 注册成功语音播报(TOFU 缓解 + 同步凭据诚实句;无活跃语音会话时静默) */
  say?: (text: string) => void;
}

// ---------- evidenceDigest 单源(库内自取,与 reviewTask approve 同一取法) ----------

/**
 * approve 落账 evidenceDigest 的重导出(09 §13:coding = Tier1SettleProof.tier1VerifyDigest;
 * writing = H(JCS(WritingSettleProof)),与 operations.approveWritingTask 同源);库内自取拒外部注入。
 */
export function evidenceDigestOfRun(run: { settle_proof_json: string | null }): string {
  if (!run.settle_proof_json) throw new S3ToolError("no_settle_proof", "当前 attempt 无 settle proof(无可绑定的批准证据)");
  const raw: unknown = JSON.parse(run.settle_proof_json);
  if (isWritingSettleProof(raw)) return jcsDigest(writingSettleProofSchema.parse(raw));
  return tier1SettleProofSchema.parse(raw).tier1VerifyDigest;
}

interface CurrentRunRow {
  id: string;
  attempt: number;
  state: string;
  tree_sha: string | null;
  settle_proof_json: string | null;
  worktree_path: string;
}

/** 当前 attempt 的 settled_review run(merge 挑战/收据/执行段的共同证据源) */
function currentSettledRun(db: Db, taskId: string): CurrentRunRow {
  const run = db
    .prepare(
      `SELECT id, attempt, state, tree_sha, settle_proof_json, worktree_path FROM tier1_runs
       WHERE task_id=? ORDER BY attempt DESC LIMIT 1`
    )
    .get(taskId) as CurrentRunRow | undefined;
  if (!run) throw new S3ToolError("no_run", `task ${taskId} 无执行记录`);
  if (run.state !== "settled_review") {
    throw new S3ToolError("run_not_settled", `当前 attempt run 状态 ${run.state}(须 settled_review)`);
  }
  if (!run.tree_sha) throw new S3ToolError("no_tree", "run 缺 tree_sha(无可批准的树)");
  return run;
}

// ---------- issueS3Challenge(09 §13:绑定对象全部 daemon 库内自取、拒外部注入) ----------

/** 入参 schema(strictObject:携带 rpId/refDigest 等外部注入一律 schema 层拒,§12-13 反例) */
export const issueS3ChallengeInputSchema = z.union([
  z.strictObject({ action: z.literal("merge"), taskId: z.string().min(1) }),
  z.strictObject({ action: z.literal("register") })
]);
export type IssueS3ChallengeInput = z.infer<typeof issueS3ChallengeInputSchema>;

export function issueS3Challenge(
  deps: S3Deps,
  input: IssueS3ChallengeInput,
  ctx: { sessionId?: string } = {}
): { challengeId: string; challenge: string; expiresAt: string } {
  const parsed = issueS3ChallengeInputSchema.parse(input);
  const now = (deps.now ?? (() => new Date()))();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + S3_CHALLENGE_TTL_MS).toISOString();
  const challengeBytes = randomBytes(32); // CSPRNG ≥32 字节
  const challenge = challengeBytes.toString("base64url");

  const row: S3Challenge = (() => {
    if (parsed.action === "register") {
      // bootstrap 一次性:仅当无 active 凭据才可签发注册挑战(换凭据 = 显式 revoke 后重走)
      if (getActiveCredential(deps.db)) {
        throw new S3ToolError("credential_exists", "已有活跃本机认证凭据;换凭据须先显式撤销旧凭据再重新注册");
      }
      // 可审计 owner intent 强制非空(RA-closeout,Codex 22 A2 残余):console 会话优先;
      // 无会话上下文时 daemon 生成一次性 bootstrap intent 并落审计行(§9 CHECK 双重承载)
      const bootstrapIntentId = ctx.sessionId ? undefined : newId("s3i");
      if (bootstrapIntentId) {
        deps.audit.record({ actor: "daemon", action: "s3.bootstrap_intent", meta: { bootstrapIntentId, at: nowIso } });
      }
      return {
        id: newId("s3c"),
        challenge,
        action: "register" as const,
        refDigest: textDigest(`s3-register-bootstrap:${nowIso}:${challenge}`), // daemon 生成 bootstrap intent digest
        ...(ctx.sessionId ? { sessionId: ctx.sessionId } : {}),
        ...(bootstrapIntentId ? { bootstrapIntentId } : {}),
        expiresAt,
        createdAt: nowIso
      };
    }
    // merge:事务外先读断言(签发本身单 INSERT,原子)——refDigest/prospectiveTreeSha/projectId 全库内自取
    const task = deps.db
      .prepare("SELECT status, route, project_id, package_rev FROM tasks WHERE id=?")
      .get(parsed.taskId) as { status: string; route: string; project_id: string; package_rev: number } | undefined;
    if (!task) throw new S3ToolError("not_found", `task not found: ${parsed.taskId}`);
    if (task.route !== "tier1") {
      // Hopper 路径恒人工交接(09 §3.3 红线③;§14-A9 未裁决)
      throw new S3ToolError("route_not_tier1", "Hopper 路径任务的合并走人工交接,不经 S3 卡(保守缺省)");
    }
    if (task.status !== "review_approved_waiting_merge") {
      throw new S3ToolError("not_awaiting_merge", `任务未处于待合并态(${task.status});先验收通过`);
    }
    const run = currentSettledRun(deps.db, parsed.taskId);
    return {
      id: newId("s3c"),
      challenge,
      action: "merge" as const,
      refDigest: evidenceDigestOfRun(run), // = approve 落账 evidenceDigest(库内自取)
      prospectiveTreeSha: run.tree_sha as string,
      taskId: parsed.taskId,
      projectId: task.project_id,
      // 签发时点固化(RA-closeout,Codex 22 A2 残余):verify 时与当前 run/task 交叉断言,换代即废
      attempt: run.attempt as number,
      packageRevision: task.package_rev,
      ...(ctx.sessionId ? { sessionId: ctx.sessionId } : {}),
      expiresAt,
      createdAt: nowIso
    };
  })();

  insertS3Challenge(deps.db, row);
  deps.audit.record({
    actor: "daemon",
    action: "s3.challenge_issued",
    meta: { challengeId: row.id, s3Action: row.action, ...(row.taskId ? { taskId: row.taskId } : {}) }
  });
  return { challengeId: row.id, challenge, expiresAt };
}

// ---------- registerWebauthn(注册链;绝不签 ApprovalReceipt) ----------

export const registerWebauthnInputSchema = z.strictObject({
  challengeId: z.string().min(1),
  attestation: z.string().min(1) // JSON{ clientDataJSON, attestationObject }(base64url 字段)
});

const attestationPayloadSchema = z.strictObject({
  clientDataJSON: z.string().min(1),
  attestationObject: z.string().min(1)
});

export function registerWebauthn(
  deps: S3Deps,
  input: { challengeId: string; attestation: string },
  ctx: { origin: string }
): { credentialId: string } {
  const parsed = registerWebauthnInputSchema.parse(input);
  const now = (deps.now ?? (() => new Date()))();
  const nowIso = now.toISOString();
  const ch = getS3Challenge(deps.db, parsed.challengeId);
  if (!ch) throw new S3ToolError("challenge_not_found", `challenge not found: ${parsed.challengeId}`);
  if (ch.action !== "register") throw new S3ToolError("wrong_action", `challenge action=${ch.action}(须 register)`);
  if (ch.consumedAt) throw new S3ToolError("challenge_consumed", "挑战已消费(单次;重新发起注册)");
  if (ch.expiresAt <= nowIso) throw new S3ToolError("challenge_expired", "挑战已过期(120s 窗;重新发起注册)");
  if (getActiveCredential(deps.db)) {
    throw new S3ToolError("credential_exists", "已有活跃本机认证凭据(bootstrap 一次性)");
  }
  let payload: z.infer<typeof attestationPayloadSchema>;
  try {
    payload = attestationPayloadSchema.parse(JSON.parse(parsed.attestation));
  } catch {
    throw new S3ToolError("bad_attestation", "attestation 载荷不是合法 JSON{clientDataJSON, attestationObject}");
  }
  const verdict = verifyWebauthnAttestation({
    clientDataJson: Buffer.from(payload.clientDataJSON, "base64url"),
    attestationObject: Buffer.from(payload.attestationObject, "base64url"),
    expectedChallenge: ch.challenge,
    expectedOrigin: ctx.origin,
    expectedRpId: S3_RP_ID
  });
  if (!verdict.ok) {
    deps.audit.record({
      actor: "daemon",
      action: "s3.register_failed",
      meta: { challengeId: ch.id, reason: verdict.reason.slice(0, 160) }
    });
    throw new S3ToolError("s3_register_failed", `注册断言校验失败:${verdict.reason}`);
  }
  const credRowId = newId("cred");
  const tx = deps.db.transaction(() => {
    if (!consumeS3ChallengeCas(deps.db, ch.id, nowIso)) {
      throw new S3ToolError("challenge_consumed", "挑战消费竞态(已被消费/已过期)");
    }
    // 注册成功只落 credentials + 审计 + 播报,绝不签 ApprovalReceipt(注册断言 ≠ runtime 批准,09 §3.3)
    insertWebauthnCredential(deps.db, {
      id: credRowId,
      credentialId: verdict.credentialId,
      publicKeyCose: verdict.publicKeyCose,
      signCount: verdict.signCount,
      principal: "owner",
      rpId: S3_RP_ID,
      backupEligible: verdict.backupEligible, // BE/BS 落账(同步凭据诚实条款 ①)
      backupState: verdict.backupState,
      status: "active",
      createdAt: nowIso
    });
    deps.audit.record({
      actor: "owner",
      action: "s3.credential_registered",
      meta: {
        credentialRowId: credRowId,
        challengeId: ch.id,
        backupEligible: verdict.backupEligible,
        backupState: verdict.backupState,
        signCount: verdict.signCount
      }
    });
  });
  tx();
  // TOFU 首注册窗口缓解 + 同步凭据诚实条款 ②(不宣称"密钥永不离开本机")
  deps.say?.("已在此设备注册本机认证凭据。用于本机认证的 passkey 可能经系统账号同步到你的其他设备;批准动作本身只能在这台电脑完成。");
  return { credentialId: verdict.credentialId };
}

// ---------- verifyS3Assertion(签发链:同一事务签 S3MergeReceipt,原子防重放) ----------

export const verifyS3AssertionInputSchema = z.strictObject({
  challengeId: z.string().min(1),
  assertion: z.string().min(1) // JSON{ credentialId, clientDataJSON, authenticatorData, signature }
});

const assertionPayloadSchema = z.strictObject({
  credentialId: z.string().min(1),
  clientDataJSON: z.string().min(1),
  authenticatorData: z.string().min(1),
  signature: z.string().min(1)
});

export function verifyS3Assertion(
  deps: S3Deps,
  input: { challengeId: string; assertion: string },
  ctx: { origin: string }
): S3MergeReceipt {
  const parsed = verifyS3AssertionInputSchema.parse(input);
  const now = (deps.now ?? (() => new Date()))();
  const nowIso = now.toISOString();
  const fail = (code: string, reason: string): never => {
    deps.audit.record({
      actor: "daemon",
      action: "s3.assertion_failed",
      meta: { challengeId: parsed.challengeId, code, reason: reason.slice(0, 160) }
    });
    throw new S3ToolError(code === "s3_auth_failed" ? "s3_auth_failed" : code, reason);
  };

  const ch = getS3Challenge(deps.db, parsed.challengeId);
  if (!ch) return fail("challenge_not_found", `challenge not found: ${parsed.challengeId}`);
  // register 挑战由 registerWebauthn 消费、不经此(09 §13)
  if (ch.action !== "merge") return fail("wrong_action", `challenge action=${ch.action}(verifyS3Assertion 只收 merge)`);
  if (ch.consumedAt) return fail("challenge_consumed", "挑战已消费(单次消费,防重放)");
  if (ch.expiresAt <= nowIso) return fail("challenge_expired", "挑战已过期(120s 窗;重新发起)");

  const cred = getActiveCredential(deps.db);
  if (!cred) return fail("no_credential", "无活跃本机认证凭据(先注册,或走人工合并降级)");

  let payload: z.infer<typeof assertionPayloadSchema>;
  try {
    payload = assertionPayloadSchema.parse(JSON.parse(parsed.assertion));
  } catch {
    return fail("bad_assertion", "assertion 载荷不是合法 JSON 形");
  }
  if (payload.credentialId !== cred.credentialId) {
    return fail("s3_auth_failed", "assertion credentialId 与活跃凭据不符");
  }
  const verdict = verifyWebauthnAssertion({
    publicKeyCose: cred.publicKeyCose,
    storedSignCount: cred.signCount,
    clientDataJson: Buffer.from(payload.clientDataJSON, "base64url"),
    authenticatorData: Buffer.from(payload.authenticatorData, "base64url"),
    signature: Buffer.from(payload.signature, "base64url"),
    expectedChallenge: ch.challenge,
    expectedOrigin: ctx.origin,
    expectedRpId: S3_RP_ID
  });
  if (!verdict.ok) return fail("s3_auth_failed", verdict.reason);

  // 收据绑定域全部库内自取(Codex 21 A2):任务/包/run 现读并与挑战签发时点交叉断言
  const taskId = ch.taskId as string;
  const task = deps.db
    .prepare("SELECT status, route, package_digest, package_rev FROM tasks WHERE id=?")
    .get(taskId) as { status: string; route: string; package_digest: string; package_rev: number } | undefined;
  if (!task) return fail("not_found", `task not found: ${taskId}`);
  if (task.status !== "review_approved_waiting_merge" || task.route !== "tier1") {
    return fail("not_awaiting_merge", `任务状态漂移(${task.status});挑战作废,重新发起`);
  }
  const run = currentSettledRun(deps.db, taskId);
  if (run.tree_sha !== ch.prospectiveTreeSha) {
    return fail("tree_drift", "run 树与挑战签发时点不符(状态漂移;重新发起)");
  }
  // 挑战固化域交叉断言(RA-closeout,Codex 22 A2 残余):签发后 run 换代/包换版 ⇒ 挑战作废
  if (ch.attempt !== run.attempt) {
    return fail("attempt_drift", "run attempt 与挑战签发时点不符(换代;重新发起)");
  }
  if (ch.packageRevision !== task.package_rev) {
    return fail("revision_drift", "包 revision 与挑战签发时点不符(换版;重新发起)");
  }
  const evidenceDigest = evidenceDigestOfRun(run);
  if (evidenceDigest !== ch.refDigest) {
    return fail("evidence_drift", "evidenceDigest 与挑战签发时点不符(状态漂移;重新发起)");
  }

  const receipt: ApprovalReceipt = {
    id: newId("apr"),
    kind: "runtime_effect",
    refDigest: ch.refDigest, // = review evidence digest(09 §3.3 签发链)
    parentPackageDigest: task.package_digest, // 任务所属决策包 digest
    taskId,
    ...(ch.sessionId ? { sessionId: ch.sessionId } : {}),
    // turnRef: null 合法(§9 已放宽:screen runtime_effect 无当前语音轮)
    riskLevel: "S3",
    principal: "owner",
    decidedVia: "screen",
    authStrength: "os_biometric",
    decision: "accept", // 本机认证批准即裁决;outcome=pending 等 approveMerge 单次消费
    nonce: randomBytes(16).toString("base64url"),
    issuedAt: nowIso,
    expiresAt: new Date(now.getTime() + S3_CHALLENGE_TTL_MS).toISOString(),
    outcome: "pending",
    s3: {
      challengeId: ch.id,
      credentialId: cred.credentialId,
      assertionDigest: bytesDigest(Buffer.from(parsed.assertion, "utf8")), // 验签 provenance(审计可回放)
      attempt: run.attempt,
      packageRevision: task.package_rev,
      prospectiveTreeSha: run.tree_sha as string
    }
  };

  // 同一 SQLite 事务:签收据 + 置 challenge.consumedAt + 更新 signCount(崩溃在中间不留半状态,原子防重放)
  const tx = deps.db.transaction(() => {
    if (!consumeS3ChallengeCas(deps.db, ch.id, nowIso)) {
      throw new S3ToolError("challenge_consumed", "挑战消费竞态(已被消费/已过期)");
    }
    insertApproval(deps.db, receipt);
    touchCredentialOnAssert(
      deps.db,
      cred.id,
      { signCount: verdict.newSignCount, backupEligible: verdict.backupEligible, backupState: verdict.backupState },
      nowIso
    );
    deps.audit.record({
      actor: "owner",
      action: "s3.receipt_issued",
      meta: {
        receiptId: receipt.id,
        challengeId: ch.id,
        taskId,
        attempt: run.attempt,
        cloneNote: verdict.cloneNote, // "clone_check_unavailable" = 平台 passkey 恒 0 分支的诚实记账
        backupEligible: verdict.backupEligible,
        backupState: verdict.backupState
      }
    });
  });
  tx();
  return s3MergeReceiptSchema.parse(receipt);
}

// ---------- approveMerge(五步事务合同,09 §13 逐字;TOCTOU/CAS 闭合) ----------

export const approveMergeInputSchema = z.strictObject({
  taskId: z.string().min(1),
  s3ReceiptId: z.string().min(1)
});

export function approveMerge(deps: S3Deps, input: { taskId: string; s3ReceiptId: string }): { state: "merging" } {
  const parsed = approveMergeInputSchema.parse(input);
  const now = (deps.now ?? (() => new Date()))();
  const nowIso = now.toISOString();
  // 事务合同:以下断言在同一 SQLite 事务内执行,任一不过 ⇒ 整体回滚(收据不消费、状态不动)+ 审计,
  // 可重签新挑战重来;全过才返回 merging。
  const tx = deps.db.transaction(() => {
    // ① 判别:s3ReceiptId 满足 S3MergeReceipt 形(s3 域非空)∧ 经 s3.challengeId 取挑战行 action='merge'
    //    ——generic screen 收据 / S2 收据 / register 链一律拒(code:"not_s3_merge_receipt")
    const receipt = getApproval(deps.db, parsed.s3ReceiptId);
    if (!receipt) throw new S3ToolError("not_found", `receipt not found: ${parsed.s3ReceiptId}`);
    if (!isS3MergeReceipt(receipt)) {
      throw new S3ToolError("not_s3_merge_receipt", "收据不构成 S3MergeReceipt(generic/S2/register 链一律拒)");
    }
    const ch = getS3Challenge(deps.db, receipt.s3.challengeId);
    if (!ch || ch.action !== "merge") {
      throw new S3ToolError("not_s3_merge_receipt", "收据挑战链不是 merge 动作");
    }
    // consumedAt 一致性复验(RA-closeout,Codex 22 A1-B):合法收据的挑战必已被 verifyS3Assertion 同事务消费——
    // 未消费挑战配已签收据 = provenance 异常(raw-DB 直插形态),拒;留痕由外层 s3.approve_merge_rejected 审计承载(事务外不回滚)
    if (!ch.consumedAt) {
      throw new S3ToolError("not_s3_merge_receipt", "收据挑战链未消费(provenance 异常),拒绝合并");
    }
    // ② 收据消费 CAS(合同逐字):changes≠1 ⇒ 拒(已消费/过期/并发双消费恰一成功)
    const consume = deps.db
      .prepare("UPDATE approvals SET outcome='consumed', consumed_at=? WHERE id=? AND outcome='pending' AND expires_at > ?")
      .run(nowIso, parsed.s3ReceiptId, nowIso);
    if (consume.changes !== 1) {
      throw new S3ToolError("receipt_not_consumable", "收据不可消费(已消费/已过期/并发竞争失败)");
    }
    // ③ 任务转移 CAS:不读后写;Hopper 路径恒不经此(route='tier1' 在 WHERE 内);
    //    状态机层 receipt-gated 谓词(canTransitionTask,09 §3.3 红线①)先断言
    if (!canTransitionTask("review_approved_waiting_merge", "merging", "L", { consumedS3ReceiptId: parsed.s3ReceiptId })) {
      throw new S3ToolError("transition_rejected", "状态机拒绝 merging 转移(receipt-gate)");
    }
    const move = deps.db
      .prepare("UPDATE tasks SET status='merging', updated_at=? WHERE id=? AND status='review_approved_waiting_merge' AND route='tier1'")
      .run(nowIso, parsed.taskId);
    if (move.changes !== 1) {
      throw new S3ToolError("not_awaiting_merge", "任务不在待合并态(或非 tier1 路径),整体回滚");
    }
    // ④ 全匹配:receipt.taskId=i.taskId ∧ s3.attempt=approve 落账 attempt ∧ s3.packageRevision=tasks.package_rev
    //    ∧ receipt.refDigest=approve 落账 evidenceDigest ∧ s3.prospectiveTreeSha=该 attempt tier1_runs.tree_sha
    if (receipt.taskId !== parsed.taskId) throw new S3ToolError("receipt_task_mismatch", "收据不属于该任务");
    const task = deps.db.prepare("SELECT package_rev FROM tasks WHERE id=?").get(parsed.taskId) as { package_rev: number };
    const run = currentSettledRun(deps.db, parsed.taskId);
    if (receipt.s3.attempt !== run.attempt) throw new S3ToolError("receipt_attempt_mismatch", "收据 attempt 与当前不符");
    if (receipt.s3.packageRevision !== task.package_rev) {
      throw new S3ToolError("receipt_revision_mismatch", "收据 packageRevision 与任务不符");
    }
    if (receipt.refDigest !== evidenceDigestOfRun(run)) {
      throw new S3ToolError("receipt_evidence_mismatch", "收据 refDigest 与 approve 落账 evidenceDigest 不符");
    }
    if (receipt.s3.prospectiveTreeSha !== run.tree_sha) {
      throw new S3ToolError("receipt_tree_mismatch", "收据 prospectiveTreeSha 与 run tree_sha 不符");
    }
    deps.audit.record({
      actor: "daemon",
      action: "s3.merge_approved",
      meta: { taskId: parsed.taskId, receiptId: parsed.s3ReceiptId, attempt: run.attempt, prospectiveTreeSha: run.tree_sha }
    });
  });
  try {
    tx();
  } catch (err) {
    deps.audit.record({
      actor: "daemon",
      action: "s3.approve_merge_rejected",
      meta: {
        taskId: parsed.taskId,
        receiptId: parsed.s3ReceiptId,
        code: err instanceof S3ToolError ? err.code : "error",
        reason: String(err instanceof Error ? err.message : err).slice(0, 160)
      }
    });
    throw err;
  }
  // ⑤ merge 执行段(rebase + 冻结 verify + treeSha 断言)在进入 merging 后进行(executeMergeSegment),
  //    失败走 merge_failed——收据已消费不复活,重批 = 重走 issueS3Challenge。
  return { state: "merging" };
}

// ---------- merge 执行段(09 §3.3 合并链:进入 merging 后执行;冲突 ⇒ merge_failed) ----------

export interface MergeSegmentDeps {
  db: Db;
  audit: AuditSink;
  /** ~/.saydo/tier1/runs(冻结 verify 读 runDir/<runId>/frozen-verify.json) */
  runsDir: string;
  verifyTimeoutMs?: number;
  now?: () => Date;
}

function safeGit(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", timeout: 30_000 }).trim();
}

/**
 * merge 执行段(merging → task_done / merge_failed,P 触发):
 *   a. worktree 现树 == 收据 prospectiveTreeSha 断言(树漂移拒——与 settle 同法 add -A + write-tree);
 *   b. 冻结 verify 重跑(frozen-verify.json 的 argv 原样,隔离 env;fail ⇒ merge_failed);
 *   c. 主仓未动断言(merge-base == 主仓 HEAD ⇒ 快进安全;主仓有新提交 = 冲突常态 ⇒ merge_failed 转人工);
 *   d. commit-tree + merge --ff-only(主仓工作区须干净;treeSha 精确落 HEAD);
 *   e. HEAD tree == prospectiveTreeSha ⇒ task_done。
 * 幂等:主仓 HEAD tree 已 == prospectiveTreeSha(崩溃重放/重复调用)⇒ 直接 task_done。
 */
export function executeMergeSegment(deps: MergeSegmentDeps, taskId: string): { state: "task_done" | "merge_failed"; reason?: string } {
  const nowIso = (deps.now ?? (() => new Date()))().toISOString();
  const failMerge = (reason: string): { state: "merge_failed"; reason: string } => {
    const upd = deps.db
      .prepare("UPDATE tasks SET status='merge_failed', updated_at=? WHERE id=? AND status='merging'")
      .run(nowIso, taskId);
    deps.audit.record({
      actor: "daemon",
      action: "s3.merge_failed",
      meta: { taskId, reason: reason.slice(0, 200), transitioned: upd.changes === 1 }
    });
    return { state: "merge_failed", reason };
  };
  const task = deps.db
    .prepare("SELECT t.status, t.project_id FROM tasks t WHERE t.id=?")
    .get(taskId) as { status: string; project_id: string } | undefined;
  if (!task) throw new S3ToolError("not_found", `task not found: ${taskId}`);
  if (task.status !== "merging") throw new S3ToolError("not_merging", `merge 执行段要求 merging,got ${task.status}`);
  let repoPath: string | null = null;
  try {
    repoPath = verifiedProjectWorkspace(deps.db, task.project_id);
  } catch {
    return failMerge("项目工作区 identity 已变化,无法执行合并");
  }
  if (!repoPath || !existsSync(join(repoPath, ".git"))) return failMerge("项目工作区缺失,无法执行合并");

  // 收据(已消费的 S3 收据 = 本次合并授权;取该任务最近一张已消费 S3 收据的 prospectiveTreeSha)
  const receiptRow = deps.db
    .prepare(
      `SELECT prospective_tree_sha FROM approvals WHERE task_id=? AND risk='S3' AND outcome='consumed'
       ORDER BY consumed_at DESC LIMIT 1`
    )
    .get(taskId) as { prospective_tree_sha: string | null } | undefined;
  const prospectiveTree = receiptRow?.prospective_tree_sha;
  if (!prospectiveTree) return failMerge("无已消费的 S3 收据(数据异常,不可自发合并)");

  try {
    // 幂等短路:主仓 HEAD tree 已是预期树(崩溃重放/重复调用)
    if (safeGit(repoPath, ["rev-parse", "HEAD^{tree}"]) === prospectiveTree) {
      const done = deps.db.prepare("UPDATE tasks SET status='task_done', updated_at=? WHERE id=? AND status='merging'").run(nowIso, taskId);
      if (done.changes === 1) {
        deps.audit.record({ actor: "daemon", action: "task.done", meta: { taskId, via: "s3_merge_replay", treeSha: prospectiveTree } });
      }
      return { state: "task_done" };
    }

    const run = deps.db
      .prepare("SELECT id, worktree_path FROM tier1_runs WHERE task_id=? AND state='settled_review' ORDER BY attempt DESC LIMIT 1")
      .get(taskId) as { id: string; worktree_path: string } | undefined;
    if (!run || !existsSync(run.worktree_path)) return failMerge("settled run/worktree 缺失,无法执行合并");

    // a. worktree 现树断言(与 executor settle 同法;.cursor 目录排除)
    execFileSync("git", ["add", "-A", "--", ".", ":(exclude).cursor"], { cwd: run.worktree_path, stdio: "ignore" });
    const currentTree = safeGit(run.worktree_path, ["write-tree"]);
    if (currentTree !== prospectiveTree) {
      return failMerge(`worktree 树漂移(现 ${currentTree.slice(0, 12)} != 批准 ${prospectiveTree.slice(0, 12)});重走验收`);
    }

    // b. 冻结 verify 重跑(09 §3.3 合并链"重跑 verify(冻结 argv/digest)")
    const frozenPath = join(deps.runsDir, run.id, "frozen-verify.json");
    if (!existsSync(frozenPath)) return failMerge("冻结 verify 清单缺失(fail-closed,不盲合)");
    const frozen = JSON.parse(readFileSync(frozenPath, "utf8")) as FrozenVerify[];
    for (const f of frozen) {
      const isolatedHome = join(deps.runsDir, run.id, "merge-verify-home");
      mkdirSync(isolatedHome, { recursive: true });
      try {
        execFileSync(f.argv[0] as string, f.argv.slice(1), {
          cwd: run.worktree_path,
          env: verifyEnv(process.env, isolatedHome),
          timeout: deps.verifyTimeoutMs ?? 600_000,
          encoding: "utf8",
          maxBuffer: 16 * 1024 * 1024
        });
      } catch (err) {
        return failMerge(`合并前 verify 未过(${f.templateRef}):${String(err).slice(0, 120)}`);
      }
    }

    // c. 主仓未动断言(快进安全;主仓新提交 = 冲突常态 ⇒ 转人工,09 §6.1 merge_failed 边)
    const repoHead = safeGit(repoPath, ["rev-parse", "HEAD"]);
    const worktreeHead = safeGit(run.worktree_path, ["rev-parse", "HEAD"]);
    const mergeBase = safeGit(repoPath, ["merge-base", repoHead, worktreeHead]);
    if (mergeBase !== repoHead) {
      return failMerge("主仓在批准后有新提交(非快进);解冲突或人工转 PR");
    }
    // 主仓 tracked 面须干净(merge --ff-only 会动工作区文件);untracked 不挡——
    // worktree 本身就在 <repo>/.saydo/ 下(恒 untracked),真正的路径冲突由 git merge 自身拒
    const dirtyTracked = safeGit(repoPath, ["status", "--porcelain"])
      .split("\n")
      .filter((l) => l !== "" && !l.startsWith("??"));
    if (dirtyTracked.length > 0) {
      return failMerge(`主仓有未提交改动(${dirtyTracked.length} 处),不能自动合并(收拾后经人工合并核验)`);
    }

    // d. commit-tree(树 = 批准快照;parent = 主仓 HEAD)+ ff-only 合并
    const mergeCommit = safeGit(repoPath, ["commit-tree", prospectiveTree, "-p", repoHead, "-m", `saydo: merge ${taskId} (S3 approved)`]);
    execFileSync("git", ["merge", "--ff-only", mergeCommit], { cwd: repoPath, stdio: "ignore", timeout: 30_000 });

    // e. HEAD tree 断言(treeSha 与收据 refDigest 的 prospectiveTree 断言匹配 → task_done)
    const headTree = safeGit(repoPath, ["rev-parse", "HEAD^{tree}"]);
    if (headTree !== prospectiveTree) {
      return failMerge(`合并后 HEAD tree 不符(${headTree.slice(0, 12)});需人工核查`);
    }
    const done = deps.db.prepare("UPDATE tasks SET status='task_done', updated_at=? WHERE id=? AND status='merging'").run(nowIso, taskId);
    if (done.changes !== 1) return failMerge("task_done 转移竞态(状态被并发改动)");
    deps.audit.record({
      actor: "daemon",
      action: "task.done",
      meta: { taskId, via: "s3_merge", mergeCommit, treeSha: prospectiveTree }
    });
    return { state: "task_done" };
  } catch (err) {
    return failMerge(`merge 执行异常:${String(err instanceof Error ? err.message : err).slice(0, 160)}`);
  }
}

/** daemon 重启恢复:merging 态任务重放执行段(幂等——已合并走短路 task_done,未合并重试或落 merge_failed) */
export function recoverMergingTasks(deps: MergeSegmentDeps): { taskId: string; state: string }[] {
  const rows = deps.db.prepare("SELECT id FROM tasks WHERE status='merging'").all() as { id: string }[];
  const out: { taskId: string; state: string }[] = [];
  for (const r of rows) {
    try {
      const res = executeMergeSegment(deps, r.id);
      out.push({ taskId: r.id, state: res.state });
    } catch (err) {
      out.push({ taskId: r.id, state: `error:${String(err).slice(0, 80)}` });
    }
  }
  return out;
}
