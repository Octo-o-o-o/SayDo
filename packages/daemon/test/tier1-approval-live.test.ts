// 执行器批任务②:S2 审批 live 上浮全链——
// gate S2 -> RuntimeApprovalFlow 签 runtime_effect 收据(#19 播报,词表环 tryPresent)
// -> 用户词表 accept/reject(dialog 确认轮,不经 Brain)/ barge-in 作废重播 / 超时按档终局
// -> gate promise 放行/拒;console 决策口(screen)与 approveAction 工具同链。
// harness 同 live-wiring:库层装配 rig,不经 VoiceHub/HTTP。

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NativeReplyOrigin } from "@saydo/contracts";
import { openDb, type Db } from "../src/storage/db.js";
import { createSqliteAuditSink } from "../src/storage/dao/misc.js";
import { SessionManager } from "../src/session/manager.js";
import { LiveVoiceSessions } from "../src/live/voiceSessions.js";
import { LiveDialog } from "../src/live/dialog.js";
import { ConfirmationLoop } from "../src/live/confirm.js";
import { RuntimeApprovalFlow, describeEffectForSpeech } from "../src/tier1/approvalFlow.js";
import { runParkSweep } from "../src/live/scheduler.js";
import { DecisionPackageFactory } from "../src/packages/factory.js";
import { ArtifactStore } from "../src/artifacts/store.js";
import { CallbackEngine } from "../src/callback/engine.js";
import { createLogger } from "../src/obs/logger.js";
import type { AuditSink } from "../src/obs/audit.js";

const SES = "ses_01APRV00000000000000000000";
const TURN = (n: number): string => `ses_01APRVTVRN0000000000000${String(n).padStart(3, "0")}`;
const PKG_DIGEST = `sha256:${"b".repeat(64)}`;
const DISPATCH_TURN = "ses_01APRVDT000000000000000001";

let db: Db;
let audit: AuditSink;
let confirm: ConfirmationLoop;
let flow: RuntimeApprovalFlow;
let dialog: LiveDialog;
let spoken: {
  sentenceId: string;
  text: string;
  nativeContext?: { turnId: string; origin: NativeReplyOrigin };
}[];
let voiceActive: boolean;

function requestS2(overrides: Partial<Parameters<RuntimeApprovalFlow["request"]>[0]> = {}): Promise<boolean> {
  return flow.request({
    taskId: "tsk_01APRV00000000000000000000",
    runId: "run_01APRV00000000000000000000",
    seq: 1,
    command: "pnpm add lodash",
    effect: { kind: "install_dependency", target: "lodash" },
    risk: "S2",
    taskTitle: "修导出按钮",
    packageDigest: PKG_DIGEST,
    dispatchTurnRef: DISPATCH_TURN,
    ...overrides
  });
}

beforeEach(() => {
  const home = mkdtempSync(join(tmpdir(), "saydo-aprv-"));
  db = openDb(join(home, "saydo.db"));
  audit = createSqliteAuditSink(db);
  const log = createLogger({ dir: join(home, "logs"), name: "test" });
  const sessions = new LiveVoiceSessions({
    db,
    audit,
    sessions: new SessionManager({ db, audit, storeTranscript: true }),
    saydoHome: home,
    idleSuspendSec: 0
  });
  spoken = [];
  voiceActive = true;
  const say = (
    _sid: string,
    sentenceId: string,
    text: string,
    nativeContext?: { turnId: string; origin: NativeReplyOrigin }
  ): boolean => {
    spoken.push({ sentenceId, text, ...(nativeContext ? { nativeContext } : {}) });
    return true;
  };
  confirm = new ConfirmationLoop();
  flow = new RuntimeApprovalFlow({
    db,
    audit,
    confirm,
    say,
    activeVoiceSession: () => (voiceActive ? SES : null),
    receiptTimeoutSec: () => 2
  });
  dialog = new LiveDialog({
    db,
    audit,
    sessions,
    dialogProvider: null, // 确认轮不进对话环;非确认轮走 nocfg 降级句,不影响本测
    say,
    log,
    confirm,
    runtimeApprovals: flow
  });
});

describe("S2 上浮语音链(10 #19 + 词表环)", () => {
  it("M1 confirm.decision 必须同时命中卡原 sessionId 与 receiptId", async () => {
    const gate = requestS2();
    const receiptId = confirm.pending(SES)?.receiptId;
    expect(receiptId).toBeTruthy();

    dialog.applyConfirmDecision("ses_01APRVOTHER000000000000000", receiptId as string, "accept");
    expect(confirm.pending(SES)?.receiptId).toBe(receiptId);
    dialog.applyConfirmDecision(SES, "apr_wrong_receipt", "accept");
    expect(confirm.pending(SES)?.receiptId).toBe(receiptId);

    dialog.applyConfirmDecision(SES, receiptId as string, "accept");
    await expect(gate).resolves.toBe(true);
    expect(confirm.pending(SES)).toBeUndefined();
  });

  it("M1 mobile_lan 不得释放 S2 runtime gate", async () => {
    const gate = requestS2();
    const receiptId = confirm.pending(SES)?.receiptId as string;
    expect(dialog.applyConfirmDecision(SES, receiptId, "accept", "mobile_lan")).toBe("untrusted_runtime");
    expect(confirm.pending(SES)?.receiptId).toBe(receiptId);
    expect((db.prepare("SELECT outcome FROM approvals WHERE id=?").get(receiptId) as { outcome: string }).outcome).toBe("pending");
    flow.decide(receiptId, "reject", { via: "screen" });
    await expect(gate).resolves.toBe(false);
  });

  it("M1 confirm.decision withdraw 只撤当前卡，gate 与 receipt 留给桌面裁决", async () => {
    const gate = requestS2();
    const receiptId = confirm.pending(SES)?.receiptId;
    expect(receiptId).toBeTruthy();
    expect(dialog.applyConfirmDecision(SES, receiptId as string, "withdraw", "mobile_lan")).toBe("applied");
    expect(confirm.pending(SES)).toBeUndefined();
    expect((db.prepare("SELECT outcome FROM approvals WHERE id=?").get(receiptId) as { outcome: string }).outcome).toBe("pending");
    let settled = false;
    void gate.finally(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(flow.decide(receiptId as string, "accept", { via: "screen" })).toEqual({ ok: true });
    await expect(gate).resolves.toBe(true);
    expect((db.prepare("SELECT outcome FROM approvals WHERE id=?").get(receiptId) as { outcome: string }).outcome).toBe("consumed");
  });

  it("播报含动作与关键约束;词表 accept ⇒ 收据 consumed + gate promise=true", async () => {
    const p = requestS2();
    // 播报:#19 形态(任务 + 动作 + 词表尾)
    expect(spoken).toHaveLength(1);
    const line = (spoken[0] as { text: string }).text;
    expect(line).toContain("修导出按钮");
    expect(line).toContain("装 lodash 这些依赖");
    expect(line).toContain("对吗");
    expect(spoken[0]?.nativeContext).toEqual({ turnId: DISPATCH_TURN, origin: "confirmation" });
    // 收据:runtime_effect + 父包 + 拍板轮 turn_ref + voice 通道
    const receipt = db.prepare("SELECT kind, parent_package_digest, turn_ref, decided_via, risk, outcome FROM approvals").get() as Record<string, unknown>;
    expect(receipt).toEqual({
      kind: "runtime_effect",
      parent_package_digest: PKG_DIGEST,
      turn_ref: DISPATCH_TURN,
      decided_via: "voice",
      risk: "S2",
      outcome: "pending"
    });
    await dialog.onAsrFinal(SES, TURN(1), "可以");
    await expect(p).resolves.toBe(true);
    const after = db.prepare("SELECT outcome, decision FROM approvals").get() as { outcome: string; decision: string };
    expect(after).toEqual({ outcome: "consumed", decision: "accept" }); // 放行即消费(单次,律④)
    expect((spoken[1] as { text: string }).text).toContain("放行");
  });

  it("词表 reject ⇒ gate promise=false;收据 rejected", async () => {
    const p = requestS2();
    await dialog.onAsrFinal(SES, TURN(2), "不要");
    await expect(p).resolves.toBe(false);
    const after = db.prepare("SELECT outcome FROM approvals").get() as { outcome: string };
    expect(after.outcome).toBe("rejected");
  });

  it("barge-in 作废 ⇒ 裸肯定不消费,原文重播后才可裁决(A8)", async () => {
    const p = requestS2();
    const firstSentence = (spoken[0] as { sentenceId: string }).sentenceId;
    dialog.onBargeIn(SES, firstSentence); // 播报被打断
    await dialog.onAsrFinal(SES, TURN(3), "好"); // 裸肯定:不消费,重播
    expect((db.prepare("SELECT outcome FROM approvals").get() as { outcome: string }).outcome).toBe("pending");
    expect(spoken.length).toBeGreaterThanOrEqual(2); // 重播原文
    expect((spoken[spoken.length - 1] as { text: string }).text).toContain("装 lodash");
    expect(spoken[spoken.length - 1]?.nativeContext).toEqual({ turnId: TURN(3), origin: "confirmation" });
    await dialog.onAsrFinal(SES, TURN(4), "可以"); // 重播后可裁决
    await expect(p).resolves.toBe(true);
  });

  it("超时:gate promise=false(fail-closed);15s sweep 把收据按档终局 timeout_parked", async () => {
    vi.useFakeTimers();
    try {
      const p = requestS2();
      vi.advanceTimersByTime(4100); // receiptTimeout 2s + 2s 缓冲
      await expect(p).resolves.toBe(false);
      // sweep(scheduler 既有第 3 段)按档终局:step_confirm ⇒ timeout_parked
      const home2 = mkdtempSync(join(tmpdir(), "saydo-aprv2-"));
      runParkSweep({
        db,
        audit,
        factory: new DecisionPackageFactory({ db, artifacts: new ArtifactStore({ db, saydoDir: home2 }), audit, now: () => new Date() }),
        callbacks: new CallbackEngine({ db, audit }),
        parkAgingHours: () => 72
      });
      const after = db.prepare("SELECT outcome FROM approvals").get() as { outcome: string };
      expect(after.outcome).toBe("timeout_parked");
    } finally {
      vi.useRealTimers();
    }
  });

  it("prepareShutdown 立即拒绝并终局所有在途 S2,且之后拒收新请求", async () => {
    const gate = requestS2();
    const receipt = db.prepare("SELECT id FROM approvals").get() as { id: string };
    expect(flow.pendingCount()).toBe(1);
    expect(flow.prepareShutdown()).toEqual({ denied: 1 });
    await expect(gate).resolves.toBe(false);
    expect(flow.pendingCount()).toBe(0);
    expect((db.prepare("SELECT outcome FROM approvals WHERE id=?").get(receipt.id) as { outcome: string }).outcome)
      .toBe("timeout_parked");
    await expect(requestS2({ seq: 2 })).resolves.toBe(false);
    expect((db.prepare("SELECT COUNT(*) AS c FROM approvals").get() as { c: number }).c).toBe(1);
    expect(
      (db.prepare("SELECT COUNT(*) AS c FROM audit_log WHERE action='tier1.approval_shutdown_deny'").get() as { c: number }).c
    ).toBe(2);
  });

  it("无拍板轮 turn_ref ⇒ 签不出收据,直接 deny(不硬造溯源锚)", async () => {
    const p = requestS2({ dispatchTurnRef: null });
    await expect(p).resolves.toBe(false);
    expect((db.prepare("SELECT COUNT(*) AS c FROM approvals").get() as { c: number }).c).toBe(0);
    const aud = db.prepare("SELECT COUNT(*) AS c FROM audit_log WHERE action='tier1.approval_unissuable'").get() as { c: number };
    expect(aud.c).toBe(1);
  });

  it("无语音会话 ⇒ screen 张(不播报);console decide(screen)放行", async () => {
    voiceActive = false;
    const p = requestS2();
    expect(spoken).toHaveLength(0);
    const receipt = db.prepare("SELECT id, decided_via, auth_strength FROM approvals").get() as { id: string; decided_via: string; auth_strength: string };
    expect(receipt.decided_via).toBe("screen");
    expect(receipt.auth_strength).toBe("screen_authenticated");
    const r = flow.decide(receipt.id, "accept", { via: "screen" });
    expect(r.ok).toBe(true);
    await expect(p).resolves.toBe(true);
  });

  it("session 正忙(已有 dispatch pending)⇒ 不插播,收据留屏幕卡(audit to_screen)", async () => {
    confirm.present(SES, {
      receiptId: "apr_01APRVDSP00000000000000001",
      sentenceId: "s-x",
      promptText: "要开工了……对吗?",
      payload: { kind: "dispatch", packageId: "pkg_01APRV00000000000000000001", revision: 1, mode: "step_confirm" }
    });
    const p = requestS2();
    expect(spoken).toHaveLength(0); // 不插播
    const aud = db.prepare("SELECT COUNT(*) AS c FROM audit_log WHERE action='approval.to_screen'").get() as { c: number };
    expect(aud.c).toBe(1);
    // dispatch pending 不受影响;S2 张仍可从屏幕裁决
    const receipt = db.prepare("SELECT id FROM approvals WHERE kind='runtime_effect'").get() as { id: string };
    flow.decide(receipt.id, "reject", { via: "screen" });
    await expect(p).resolves.toBe(false);
  });

  it("重复裁决:第二次 decide 拒(收据已终局),不双放行", async () => {
    const p = requestS2();
    const receipt = db.prepare("SELECT id FROM approvals").get() as { id: string };
    expect(flow.decide(receipt.id, "accept", { via: "screen" }).ok).toBe(true);
    await expect(p).resolves.toBe(true);
    expect(flow.decide(receipt.id, "accept", { via: "screen" }).ok).toBe(false);
  });
});

describe("describeEffectForSpeech(#19 槽位;命令截断经 redactor)", () => {
  it("install 带包名;push 带分支;未知命令读原文截断", () => {
    expect(describeEffectForSpeech({ kind: "install_dependency", target: "lodash,axios" }, "pnpm add lodash axios")).toBe(
      "装 lodash,axios 这些依赖"
    );
    expect(describeEffectForSpeech({ kind: "push_branch", target: "feature/x" }, "git push origin feature/x")).toBe(
      "推到 feature/x 分支"
    );
    expect(describeEffectForSpeech({ kind: "install_dependency", target: "(lockfile)" }, "pnpm install")).toContain("执行:");
    expect(
      describeEffectForSpeech({ kind: "write_worktree", touchesSensitiveData: true, target: ".env" }, "Write /wt/.env")
    ).toBe("改敏感文件 .env");
  });
});

describe("W5a 3.3 edit 第四动作(09 §3 骨架;§12-3 用例补齐)", () => {
  it("主锚:edit ⇒ 旧张 superseded_by_edit(decision=edit)+ 新张(新 nonce/新 refDigest,decision=accept 等消费)+ gate promise=false + 修改建议单次可取;audit 链完整", async () => {
    voiceActive = false;
    const p = requestS2({ command: "rm -rf build && pnpm install" });
    const old = db.prepare("SELECT id, nonce, ref_digest FROM approvals").get() as { id: string; nonce: string; ref_digest: string };
    expect(flow.pendingCommand(old.id)).toBe("rm -rf build && pnpm install"); // 编辑底稿(内存)

    const r = flow.edit(old.id, "pnpm install", { via: "screen" });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error();
    await expect(p).resolves.toBe(false); // 当前命令拒

    const oldAfter = db.prepare("SELECT outcome, decision FROM approvals WHERE id=?").get(old.id) as Record<string, unknown>;
    expect(oldAfter).toEqual({ outcome: "superseded_by_edit", decision: "edit" });
    const neu = db.prepare("SELECT nonce, ref_digest, outcome, decision, decided_via, auth_strength, risk FROM approvals WHERE id=?").get(r.newReceiptId) as Record<string, unknown>;
    expect(neu["nonce"]).not.toBe(old.nonce); // 新 nonce
    expect(neu["ref_digest"]).not.toBe(old.ref_digest); // 新 refDigest
    expect(neu["outcome"]).toBe("pending");
    expect(neu["decision"]).toBe("accept"); // 修改后批准:签发即裁决,等消费
    expect(neu["decided_via"]).toBe("screen");
    expect(neu["auth_strength"]).toBe("screen_authenticated");

    // 修改建议:gate deny 回执一次性取走(executor handleGateRequest 消费)
    expect(flow.consumeEditSuggestion("tsk_01APRV00000000000000000000", 1)).toBe("pnpm install");
    expect(flow.consumeEditSuggestion("tsk_01APRV00000000000000000000", 1)).toBeNull();

    // audit 链:user_edit 转换 + approval_edit 关联
    const auditRows = db.prepare("SELECT action FROM audit_log ORDER BY ts").all() as { action: string }[];
    expect(auditRows.map((a) => a.action)).toContain("tier1.approval_edit");
  });

  it("单次消费:agent 按建议重试 ⇒ 命中预批直接放行(消费,不再上浮);同命令第二次 ⇒ 照常新上浮", async () => {
    voiceActive = false;
    const p1 = requestS2({ command: "rm -rf build && pnpm install" });
    const old = db.prepare("SELECT id FROM approvals").get() as { id: string };
    const edited = flow.edit(old.id, "pnpm install", { via: "screen" });
    if (!edited.ok) throw new Error();
    await expect(p1).resolves.toBe(false);

    // agent 重试编辑后命令:命中预批,立即 true,零新收据零播报
    const before = (db.prepare("SELECT COUNT(*) AS c FROM approvals").get() as { c: number }).c;
    const p2 = requestS2({ command: "pnpm install", seq: 2 });
    await expect(p2).resolves.toBe(true);
    expect((db.prepare("SELECT COUNT(*) AS c FROM approvals").get() as { c: number }).c).toBe(before); // 不签新张
    const consumed = db.prepare("SELECT outcome FROM approvals WHERE id=?").get(edited.newReceiptId) as { outcome: string };
    expect(consumed.outcome).toBe("consumed");

    // 同命令第三次:预批已消费 ⇒ 照常上浮(单次消费,禁便车)
    const p3 = requestS2({ command: "pnpm install", seq: 3 });
    const pendingNew = db.prepare("SELECT id FROM approvals WHERE outcome='pending'").get() as { id: string };
    flow.decide(pendingNew.id, "reject", { via: "screen" });
    await expect(p3).resolves.toBe(false);
  });

  it("edit 编辑成 S3 级命令 ⇒ 拒(不给 S3 预批面),旧张保持 pending 可照常裁决", async () => {
    voiceActive = false;
    const p = requestS2();
    const old = db.prepare("SELECT id FROM approvals").get() as { id: string };
    const r = flow.edit(old.id, "git push --force origin main", { via: "screen" });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error();
    expect(r.reason).toContain("S3");
    expect((db.prepare("SELECT outcome FROM approvals WHERE id=?").get(old.id) as { outcome: string }).outcome).toBe("pending");
    flow.decide(old.id, "reject", { via: "screen" });
    await expect(p).resolves.toBe(false);
  });

  it("已裁决/已终局收据 edit 拒;空命令拒;预批过期不命中(fail-closed 上浮)", async () => {
    voiceActive = false;
    vi.useFakeTimers();
    try {
      const p1 = requestS2();
      const old = db.prepare("SELECT id FROM approvals").get() as { id: string };
      expect(flow.edit(old.id, "  ", { via: "screen" }).ok).toBe(false); // 空命令
      flow.decide(old.id, "accept", { via: "screen" });
      await expect(p1).resolves.toBe(true);
      expect(flow.edit(old.id, "pnpm install", { via: "screen" }).ok).toBe(false); // 已终局

      // 预批过期:签一张 edit 新张(2s 窗)后推 3s,agent 才重试 ⇒ 不命中,照常上浮
      const p2 = requestS2({ command: "rm -rf build", seq: 5 });
      const old2 = db.prepare("SELECT id FROM approvals WHERE outcome='pending'").get() as { id: string };
      const edited = flow.edit(old2.id, "pnpm run clean", { via: "screen" });
      if (!edited.ok) throw new Error();
      await expect(p2).resolves.toBe(false);
      vi.advanceTimersByTime(3000);
      const p3 = requestS2({ command: "pnpm run clean", seq: 6 });
      const pendingNew = db
        .prepare("SELECT id FROM approvals WHERE outcome='pending' AND decision IS NULL")
        .get() as { id: string } | undefined;
      expect(pendingNew).toBeTruthy(); // 未命中过期预批 ⇒ 新上浮张
      flow.decide((pendingNew as { id: string }).id, "reject", { via: "screen" });
      await expect(p3).resolves.toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("RA-closeout · tailnet 配对屏幕批对表(09 §3 push 行;Codex 21 B4 尾项)", () => {
  it("tailnet decide S2 accept ⇒ 收据行如实落 push/paired_device_pin(不再固定 screen);gate 照常放行", async () => {
    voiceActive = false;
    const p = requestS2({ command: "pnpm install" });
    const row = db.prepare("SELECT id FROM approvals WHERE outcome='pending'").get() as { id: string };
    const r = flow.decide(row.id, "accept", { via: "tailnet" });
    expect(r.ok).toBe(true);
    await expect(p).resolves.toBe(true);
    const after = db.prepare("SELECT decided_via, auth_strength, outcome FROM approvals WHERE id=?").get(row.id) as Record<string, unknown>;
    expect(after["decided_via"]).toBe("push");
    expect(after["auth_strength"]).toBe("paired_device_pin");
    expect(after["outcome"]).toBe("consumed"); // accept 即消费(单次)
  });
});
