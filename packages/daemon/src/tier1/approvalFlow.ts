// 执行中 S2 审批协调器(执行器批任务2;04 §5.1 逐步确认档 + 10 #19 + 09 §3 runtime_effect 收据)。
// 链:gate 收 S2 -> 本模块签 runtime_effect 收据 -> 语音播报(词表环 tryPresent,barge-in 作废复用
// A8 最小 presentation)/ 无语音面走 console 审批卡 -> 用户 accept/reject 或超时 -> 放行 gate promise。
// 纪律:
// - 每条命令一张收据(fail-closed 律④:单次消费,accept 即 consume,禁便车);
// - 超时 = deny(律③;收据由 15s sweep 按档终局 timeout_parked,gate promise 本地到点 resolve(false));
// - turn_ref 溯源 = 该任务 dispatch 收据的确认轮(09 §9 CHECK:非预授权 runtime_effect 须绑转写轮;
//   任务由语音拍板产生,拍板轮是真实对话证据且授权语义连续;取不到 = 签不出收据 = deny,不硬造);
// - voice 张被屏幕点击:P0 单 owner 允许,audit meta 记 actualVia 如实(收据行 decided_via 保持签发通道;
//   presentation/receipt 拆分的完整形态随 09 §14-A2 P0.5-A)。

import { randomUUID } from "node:crypto";
import { newId, textDigest, type ApprovalReceipt, type NativeReplyOrigin } from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import { insertApproval, getApproval } from "../storage/dao/approvals.js";
import { applyReceiptEvent } from "../approvals/issue.js";
import { buildConfirmPrompt } from "../approvals/confirmVocab.js";
import { redactForSpeech } from "../voice/redactor.js";
import { commandToEffect } from "./cmdEffect.js";
import { computeRisk } from "../policy/engine.js";
import type { ConfirmationLoop } from "../live/confirm.js";
import type { EffectDescriptor, RiskLevel } from "../policy/engine.js";

export interface RuntimeApprovalDeps {
  db: Db;
  audit: AuditSink;
  confirm: ConfirmationLoop | null;
  say: ((
    sessionId: string,
    sentenceId: string,
    text: string,
    nativeContext?: { turnId: string; origin: NativeReplyOrigin }
  ) => boolean) | null;
  /** 活跃语音面(有会话在听才走语音播报);null = 走屏幕审批卡 */
  activeVoiceSession: () => string | null;
  receiptTimeoutSec?: () => number;
  now?: () => Date;
}

export interface RuntimeApprovalRequest {
  taskId: string;
  runId: string;
  seq: number;
  command: string;
  effect: EffectDescriptor;
  risk: RiskLevel;
  taskTitle: string;
  /** parent_package_digest(runtime_effect 收据必绑父包,09 §9 CHECK) */
  packageDigest: string;
  /** 拍板轮 turn_ref(溯源锚;null = 签不出收据,fail-closed deny) */
  dispatchTurnRef: string | null;
}

interface PendingGateApproval {
  resolve: (allowed: boolean) => void;
  timer: NodeJS.Timeout;
  taskId: string;
  seq: number;
  sessionId: string | null;
  /** 命令原文(edit 第四动作的编辑底稿;仅内存——审计只记 digest,E3 纪律不变) */
  command: string;
}

/** edit 预批收据的 refDigest(09 §3"新 refDigest":绑定编辑后命令文本,task 域内单义) */
export function editedCommandRefDigest(taskId: string, command: string): string {
  return textDigest(`${taskId}:edited-command:${command}`);
}

/** S2 效果口语描述(10 #19 槽位"动作+关键约束";命令文本先截断再经 redactor) */
export function describeEffectForSpeech(effect: EffectDescriptor, command: string): string {
  const cmd = redactForSpeech(command.replace(/\s+/g, " ").slice(0, 60)).text;
  if (effect.kind === "install_dependency") {
    const t = effect.target ?? "";
    // 只有纯包名列表(逗号分隔,无空格/斜杠)才念"装…依赖";命令原文(未知命令上浮)念"执行:cmd"
    // ——一致性评审 A3:防"装 sudo rm -rf / 这些依赖"式误导播报
    if (t && t !== "(lockfile)" && !t.startsWith("http") && !/[\s/]/.test(t)) {
      return `装 ${t} 这些依赖`;
    }
    return `执行:${cmd}`;
  }
  if (effect.kind === "push_branch") {
    return `推到 ${effect.target ?? "远端"} 分支`;
  }
  if (effect.kind === "write_worktree" && effect.touchesSensitiveData) {
    const base = redactForSpeech((effect.target ?? "敏感文件").replace(/\\/g, "/").split("/").pop() ?? "敏感文件").text;
    return `改敏感文件 ${base}`;
  }
  return `执行:${cmd}`;
}

export class RuntimeApprovalFlow {
  private readonly deps: RuntimeApprovalDeps;
  private readonly pending = new Map<string, PendingGateApproval>();
  private readonly now: () => Date;
  private draining = false;

  constructor(deps: RuntimeApprovalDeps) {
    this.deps = deps;
    this.now = deps.now ?? (() => new Date());
  }

  /** gate stepConfirm 入口:签收据 + 上浮;返回 promise(accept=true;reject/超时/异常=false) */
  request(i: RuntimeApprovalRequest): Promise<boolean> {
    const d = this.deps;
    if (this.draining) {
      d.audit.record({
        actor: "daemon",
        action: "tier1.approval_shutdown_deny",
        meta: { taskId: i.taskId, runId: i.runId, seq: i.seq, reason: "daemon_draining" }
      });
      return Promise.resolve(false);
    }
    // W5a 3.3:edit 预批消费点——命中"修改后批准"的单次收据(refDigest 绑定编辑后命令原文,
    // pending ∧ decision=accept ∧ 未过期)⇒ 消费即放行,不再上浮(单次消费:同命令第二次照常上浮)
    const editedHit = d.db
      .prepare(
        `SELECT id FROM approvals WHERE kind='runtime_effect' AND task_id=? AND ref_digest=?
         AND outcome='pending' AND decision='accept' AND expires_at > ? LIMIT 1`
      )
      .get(i.taskId, editedCommandRefDigest(i.taskId, i.command), this.now().toISOString()) as { id: string } | undefined;
    if (editedHit) {
      try {
        applyReceiptEvent(d.db, d.audit, editedHit.id, { kind: "consume" }, this.now);
        d.audit.record({
          actor: "daemon",
          action: "tier1.approval_edited_consumed",
          meta: { receiptId: editedHit.id, taskId: i.taskId, seq: i.seq, commandDigest: textDigest(i.command) }
        });
        return Promise.resolve(true);
      } catch {
        // 消费竞态/已终局:按未命中走正常上浮(fail-closed 方向)
      }
    }
    if (!i.dispatchTurnRef) {
      d.audit.record({
        actor: "daemon",
        action: "tier1.approval_unissuable",
        meta: { taskId: i.taskId, seq: i.seq, reason: "no dispatch turn_ref on record (fail-closed deny)" }
      });
      return Promise.resolve(false);
    }
    const sessionId = d.activeVoiceSession();
    const issuedAt = this.now();
    const timeoutSec = d.receiptTimeoutSec?.() ?? 45;
    const receipt: ApprovalReceipt = {
      id: newId("apr"),
      kind: "runtime_effect",
      refDigest: textDigest(`${i.runId}:${i.seq}:${i.command}`),
      parentPackageDigest: i.packageDigest,
      taskId: i.taskId,
      ...(sessionId ? { sessionId } : {}),
      turnRef: i.dispatchTurnRef,
      riskLevel: i.risk,
      principal: "owner",
      decidedVia: sessionId ? "voice" : "screen",
      authStrength: sessionId ? "voice_weak" : "screen_authenticated",
      nonce: randomUUID(),
      issuedAt: issuedAt.toISOString(),
      expiresAt: new Date(issuedAt.getTime() + timeoutSec * 1000).toISOString(),
      outcome: "pending"
    };
    try {
      insertApproval(d.db, receipt);
    } catch (err) {
      d.audit.record({
        actor: "daemon",
        action: "tier1.approval_issue_failed",
        meta: { taskId: i.taskId, seq: i.seq, error: String(err).slice(0, 160) }
      });
      return Promise.resolve(false);
    }
    d.audit.record({
      actor: "daemon",
      action: "tier1.approval_request",
      meta: { receiptId: receipt.id, taskId: i.taskId, runId: i.runId, seq: i.seq, risk: i.risk, commandDigest: textDigest(i.command) }
    });

    const promise = new Promise<boolean>((resolve) => {
      // 超时 = deny(fail-closed 律③);+2s 缓冲让 15s sweep 有机会先按档终局收据(timeout_parked),
      // 本地 timer 只兜 gate promise 放行,不与 sweep 争写收据
      const timer = setTimeout(() => {
        const p = this.pending.get(receipt.id);
        if (!p) return;
        this.pending.delete(receipt.id);
        if (p.sessionId) d.confirm?.withdraw(p.sessionId, receipt.id);
        d.audit.record({
          actor: "daemon",
          action: "tier1.approval_timeout_deny",
          meta: { receiptId: receipt.id, taskId: i.taskId, seq: i.seq }
        });
        p.resolve(false);
      }, (timeoutSec + 2) * 1000);
      timer.unref();
      this.pending.set(receipt.id, { resolve, timer, taskId: i.taskId, seq: i.seq, sessionId, command: i.command });
    });

    if (sessionId && d.confirm && d.say) {
      const spoken = describeEffectForSpeech(i.effect, i.command);
      const line = redactForSpeech(`${i.taskTitle}这边,我需要${spoken}`).text;
      const promptText = buildConfirmPrompt(line);
      const sentenceId = `s-rtconfirm-${receipt.id}`;
      if (d.confirm.pending(sessionId)) {
        // 用户正在裁决别的(单 pending 不变量):不插播,收据留屏幕审批卡
        d.audit.record({
          actor: "daemon",
          action: "approval.to_screen",
          meta: { receiptId: receipt.id, reason: "session busy with another pending confirmation" }
        });
      } else {
        const enqueued = d.say(sessionId, sentenceId, promptText, {
          turnId: i.dispatchTurnRef,
          origin: "confirmation"
        });
        const presented =
          enqueued !== false &&
          d.confirm.tryPresent(sessionId, {
            receiptId: receipt.id,
            sentenceId,
            promptText,
            payload: { kind: "runtime_effect" }
          });
        if (!presented) {
          d.audit.record({
            actor: "daemon",
            action: "approval.to_screen",
            meta: { receiptId: receipt.id, reason: "confirmation presentation unavailable" }
          });
        }
      }
    }
    return promise;
  }

  /** 词表环(voice)/console 决策口(screen)/tailnet 手机面(push 对表)共用:落收据 + 放行 gate promise */
  decide(
    receiptId: string,
    decision: "accept" | "reject",
    ctx: { via: "voice" | "screen" | "tailnet"; sessionId?: string; turnId?: string }
  ): { ok: boolean; reason?: string } {
    const d = this.deps;
    // W4(09 §3.3 红线):S3 收据只能由 verifyS3Assertion 产生与经 approveMerge 消费——
    // 通用 decide 面(语音词表环/console 决策口)对 risk='S3' 行一律拒(不可复用弱面签强收据)
    const target = getApproval(d.db, receiptId);
    if (target?.riskLevel === "S3") {
      d.audit.record({
        actor: "daemon",
        action: "s3.generic_decide_rejected",
        meta: { receiptId, attempted: decision, actualVia: ctx.via }
      });
      return { ok: false, reason: "S3 收据不走通用审批口(仅 S3 卡本机认证断言链)" };
    }
    // tailnet 配对屏幕批(RA-closeout 2026-07-28;09 §3 对表行/§11 T2 注):裁决来源 = 已配对主机 + OS 解锁,
    // 收据行如实落 push/paired_device_pin(此前固定 screen 属实施未对齐;S2 封顶由 §3 矩阵 CHECK 机械保证)
    if (ctx.via === "tailnet" && target && target.riskLevel !== ("S3" as string)) {
      d.db
        .prepare("UPDATE approvals SET decided_via='push', auth_strength='paired_device_pin' WHERE id=? AND outcome='pending'")
        .run(receiptId);
    }
    const p = this.pending.get(receiptId);
    try {
      applyReceiptEvent(d.db, d.audit, receiptId, { kind: decision === "accept" ? "user_accept" : "user_reject" }, this.now);
      if (decision === "accept") {
        // 放行即消费(单次;第二条命令不得搭本张便车——fail-closed 律④)
        applyReceiptEvent(d.db, d.audit, receiptId, { kind: "consume" }, this.now);
      }
    } catch (err) {
      // 收据已被 sweep 终局(超时)/重复裁决:gate promise 若还挂着按 deny 收(fail-closed)
      if (p) {
        clearTimeout(p.timer);
        this.pending.delete(receiptId);
        if (p.sessionId) d.confirm?.withdraw(p.sessionId, receiptId);
        p.resolve(false);
      }
      return { ok: false, reason: String(err).slice(0, 120) };
    }
    d.audit.record({
      actor: "owner",
      action: decision === "accept" ? "tier1.approval_accept" : "tier1.approval_reject",
      // actualVia 如实(voice 张被屏幕点时与行内 decided_via 不同,P0 单 owner 允许,见文件头注)
      meta: { receiptId, actualVia: ctx.via, ...(ctx.turnId ? { turnRef: ctx.turnId } : {}) }
    });
    if (p) {
      clearTimeout(p.timer);
      this.pending.delete(receiptId);
      if (p.sessionId) d.confirm?.withdraw(p.sessionId, receiptId);
      p.resolve(decision === "accept");
    }
    return { ok: true };
  }

  /**
   * edit 第四动作(W5a 3.3;09 §3 骨架:pending --edit--> superseded_by_edit + 同步签发新收据)。
   * 语义 = "修改后批准":当前命令 deny(gate 回执带修改建议,agent 可按建议重试),
   * 同步签发编辑后命令的**单次**预批收据(新 nonce/新 refDigest=编辑后命令;decision=accept
   * 等 gate 消费)。仅屏幕(09 §3 decision 注)、仅 S2(S3 收据不存在于本流,双保险仍断言);
   * 编辑后命令风险重估 > S2 ⇒ 拒(不给 S3 预批面)。
   */
  edit(
    receiptId: string,
    editedCommand: string,
    ctx: { via: "screen"; sessionId?: string }
  ): { ok: true; newReceiptId: string } | { ok: false; reason: string } {
    const d = this.deps;
    const trimmed = editedCommand.trim();
    if (!trimmed) return { ok: false, reason: "编辑后的命令为空" };
    const old = getApproval(d.db, receiptId);
    if (!old) return { ok: false, reason: "收据不存在" };
    if (old.kind !== "runtime_effect") return { ok: false, reason: "edit 只适用于执行中 S2 审批" };
    if (old.riskLevel !== "S2") return { ok: false, reason: "edit 只适用于 S2(S3 不适用)" };
    if (old.outcome !== "pending" || old.decision !== undefined) return { ok: false, reason: "收据已终局/已裁决" };
    // 编辑后命令风险重估(保守缺省上下文;gate 消费时还会按 run 全量上下文再评一遍——纵深)
    const editedRisk = computeRisk(commandToEffect(trimmed), {}).level;
    if (editedRisk === "S3") {
      d.audit.record({
        actor: "owner",
        action: "tier1.approval_edit_rejected",
        meta: { receiptId, reason: "edited command maps to S3", editedCommandDigest: textDigest(trimmed) }
      });
      return { ok: false, reason: "修改后的命令是 S3 级(比原命令更危险),不能这样批" };
    }
    const p = this.pending.get(receiptId);
    // 作废旧张(状态机 user_edit 边:superseded_by_edit + decision=edit)
    try {
      applyReceiptEvent(d.db, d.audit, receiptId, { kind: "user_edit" }, this.now);
    } catch (err) {
      return { ok: false, reason: String(err).slice(0, 120) };
    }
    // 同步签发新收据(同一 JS 轮次,无半状态窗口;新 nonce/新 refDigest;decision=accept 等消费)
    const issuedAt = this.now();
    const timeoutSec = d.receiptTimeoutSec?.() ?? 45;
    const newReceipt: ApprovalReceipt = {
      id: newId("apr"),
      kind: "runtime_effect",
      refDigest: editedCommandRefDigest(old.taskId as string, trimmed),
      parentPackageDigest: old.parentPackageDigest as string,
      taskId: old.taskId as string,
      ...(old.sessionId ? { sessionId: old.sessionId } : {}),
      turnRef: old.turnRef as string,
      riskLevel: editedRisk,
      principal: "owner",
      decidedVia: "screen",
      authStrength: "screen_authenticated",
      nonce: randomUUID(),
      issuedAt: issuedAt.toISOString(),
      expiresAt: new Date(issuedAt.getTime() + timeoutSec * 1000).toISOString(),
      outcome: "pending"
    };
    insertApproval(d.db, newReceipt);
    applyReceiptEvent(d.db, d.audit, newReceipt.id, { kind: "user_accept" }, this.now); // 修改后批准:签发即裁决,等 gate 单次消费
    d.audit.record({
      actor: "owner",
      action: "tier1.approval_edit",
      meta: {
        oldReceiptId: receiptId,
        newReceiptId: newReceipt.id,
        actualVia: ctx.via,
        editedCommandDigest: textDigest(trimmed),
        editedRisk
      }
    });
    // 当前命令 deny + 修改建议经 gate 回执带给 agent(agent_message;handleGateRequest 消费)
    if (p) {
      clearTimeout(p.timer);
      this.pending.delete(receiptId);
      if (p.sessionId) d.confirm?.withdraw(p.sessionId, receiptId);
      this.editSuggestions.set(`${p.taskId}:${p.seq}`, trimmed);
      p.resolve(false);
    }
    return { ok: true, newReceiptId: newReceipt.id };
  }

  /** gate deny 回执的修改建议(edit 后一次性取走;无则 null) */
  consumeEditSuggestion(taskId: string, seq: number): string | null {
    const key = `${taskId}:${seq}`;
    const s = this.editSuggestions.get(key);
    if (s === undefined) return null;
    this.editSuggestions.delete(key);
    return s;
  }

  /** pending 收据的命令原文(edit 编辑底稿;仅内存,重启即无——edit 只作用于活着的 gate 等待) */
  pendingCommand(receiptId: string): string | null {
    return this.pending.get(receiptId)?.command ?? null;
  }

  /** 退出前拒收新审批，并把所有在途 gate fail-closed 收口。 */
  prepareShutdown(): { denied: number } {
    this.draining = true;
    const pending = [...this.pending.entries()];
    for (const [receiptId, item] of pending) {
      clearTimeout(item.timer);
      this.pending.delete(receiptId);
      if (item.sessionId) this.deps.confirm?.withdraw(item.sessionId, receiptId);
      try {
        applyReceiptEvent(this.deps.db, this.deps.audit, receiptId, { kind: "timeout", mode: "step_confirm" }, this.now);
      } catch {
        // sweep/用户裁决已先终局时，gate 仍按 deny 收口。
      }
      this.deps.audit.record({
        actor: "daemon",
        action: "tier1.approval_shutdown_deny",
        meta: { receiptId, taskId: item.taskId, seq: item.seq, reason: "daemon_draining" }
      });
      item.resolve(false);
    }
    return { denied: pending.length };
  }

  private readonly editSuggestions = new Map<string, string>();

  /** 活跃待决数(观测/测试用) */
  pendingCount(): number {
    return this.pending.size;
  }
}
