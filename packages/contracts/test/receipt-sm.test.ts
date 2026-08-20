// §12-3 收据状态机层(单次消费/超时按档/voided 不重试/expired 唯一语义;DDL CHECK 层随 0.3)。

import { describe, expect, it } from "vitest";
import { receiptTransition, type ReceiptSnapshot } from "../src/statemachines/receipt.js";
import { receiptComboViolation } from "../src/types/approval.js";

const pending: ReceiptSnapshot = { outcome: "pending" };

describe("§3 outcome 转换表", () => {
  it("accept 后保持 pending 等消费;消费一次到 consumed;二次消费拒绝(单次消费)", () => {
    const accepted = receiptTransition(pending, { kind: "user_accept" });
    expect(accepted).toMatchObject({ ok: true, next: { outcome: "pending", decision: "accept" } });
    if (!accepted.ok) throw new Error("unreachable");
    const consumed = receiptTransition(accepted.next, { kind: "consume" });
    expect(consumed).toMatchObject({ ok: true, next: { outcome: "consumed" } });
    if (!consumed.ok) throw new Error("unreachable");
    expect(receiptTransition(consumed.next, { kind: "consume" }).ok).toBe(false);
  });

  it("未 accept 直接 consume 拒绝", () => {
    expect(receiptTransition(pending, { kind: "consume" }).ok).toBe(false);
  });

  it("超时按档终局:direct_to_review => timeout_rejected;step_confirm => timeout_parked", () => {
    const t1 = receiptTransition(pending, { kind: "timeout", mode: "direct_to_review" });
    expect(t1).toMatchObject({ ok: true, next: { outcome: "timeout_rejected" } });
    const t2 = receiptTransition(pending, { kind: "timeout", mode: "step_confirm" });
    expect(t2).toMatchObject({ ok: true, next: { outcome: "timeout_parked" } });
  });

  it("timeout_parked 是终态:不接受任何后续转换(人回来签新收据)", () => {
    const parked: ReceiptSnapshot = { outcome: "timeout_parked" };
    expect(receiptTransition(parked, { kind: "user_accept" }).ok).toBe(false);
    expect(receiptTransition(parked, { kind: "consume" }).ok).toBe(false);
  });

  it("voided_by_conflict 终态,不重试", () => {
    const voided = receiptTransition(pending, { kind: "conflict_voided" });
    expect(voided).toMatchObject({ ok: true, next: { outcome: "voided_by_conflict" } });
    if (!voided.ok) throw new Error("unreachable");
    expect(receiptTransition(voided.next, { kind: "user_accept" }).ok).toBe(false);
  });

  it("expired 唯一语义 = decision=accept 未消费越过 expiresAt", () => {
    expect(receiptTransition(pending, { kind: "expire" }).ok).toBe(false); // 未 accept 不 expire
    const accepted = receiptTransition(pending, { kind: "user_accept" });
    if (!accepted.ok) throw new Error("unreachable");
    expect(receiptTransition(accepted.next, { kind: "expire" })).toMatchObject({
      ok: true,
      next: { outcome: "expired" }
    });
  });

  it("已决收据拒绝二次决策", () => {
    const accepted = receiptTransition(pending, { kind: "user_accept" });
    if (!accepted.ok) throw new Error("unreachable");
    expect(receiptTransition(accepted.next, { kind: "user_reject" }).ok).toBe(false);
  });

  it("W5a 3.3(§12-3 edit 作废重签链):user_edit ⇒ superseded_by_edit + decision=edit;终态不接受后续;已决不可 edit", () => {
    const edited = receiptTransition(pending, { kind: "user_edit" });
    expect(edited).toMatchObject({ ok: true, next: { outcome: "superseded_by_edit", decision: "edit" } });
    if (!edited.ok) throw new Error("unreachable");
    // superseded_by_edit 是终态:旧张不复活(新收据另签,新 nonce/新 refDigest——签发层职责)
    expect(receiptTransition(edited.next, { kind: "user_accept" }).ok).toBe(false);
    expect(receiptTransition(edited.next, { kind: "consume" }).ok).toBe(false);
    // 已决(accept)后不可 edit(edit 只对未决 pending)
    const accepted = receiptTransition(pending, { kind: "user_accept" });
    if (!accepted.ok) throw new Error("unreachable");
    expect(receiptTransition(accepted.next, { kind: "user_edit" }).ok).toBe(false);
  });
});

describe("§3 合法组合矩阵(写入校验层)", () => {
  const base = {
    kind: "dispatch_package" as const,
    riskLevel: "S2" as const,
    decidedVia: "voice" as const,
    authStrength: "voice_weak" as const,
    turnRef: "trn_1"
  };

  it("S3 非 screen 拒绝;S3+screen 强认证通过", () => {
    expect(receiptComboViolation({ ...base, riskLevel: "S3" })).not.toBeNull();
    expect(
      receiptComboViolation({
        kind: "dispatch_package",
        riskLevel: "S3",
        decidedVia: "screen",
        authStrength: "screen_authenticated"
      })
    ).toBeNull();
  });

  it("voice 仅 voice_weak 且封顶 S2;voice 必绑 turnRef", () => {
    expect(receiptComboViolation({ ...base, authStrength: "screen_authenticated" })).not.toBeNull();
    expect(receiptComboViolation({ ...base, turnRef: undefined })).not.toBeNull();
    expect(receiptComboViolation(base)).toBeNull();
  });

  it("push 封顶 S2 且须 paired_device_pin", () => {
    expect(
      receiptComboViolation({
        kind: "dispatch_package",
        riskLevel: "S3",
        decidedVia: "push",
        authStrength: "paired_device_pin"
      })
    ).not.toBeNull();
    expect(
      receiptComboViolation({
        kind: "dispatch_package",
        riskLevel: "S2",
        decidedVia: "push",
        authStrength: "paired_device_pin"
      })
    ).toBeNull();
  });

  it("preauthorized 仅 runtime_effect 且须父包 digest,封顶 S2", () => {
    expect(
      receiptComboViolation({
        kind: "dispatch_package",
        riskLevel: "S2",
        decidedVia: "preauthorized",
        authStrength: "voice_weak"
      })
    ).not.toBeNull();
    expect(
      receiptComboViolation({
        kind: "runtime_effect",
        riskLevel: "S2",
        decidedVia: "preauthorized",
        authStrength: "voice_weak",
        parentPackageDigest: "sha256:" + "a".repeat(64)
      })
    ).toBeNull();
  });

  it("非预授权 runtime_effect(语音确认)须绑 turnRef", () => {
    expect(
      receiptComboViolation({
        kind: "runtime_effect",
        riskLevel: "S2",
        decidedVia: "voice",
        authStrength: "voice_weak",
        parentPackageDigest: "sha256:" + "a".repeat(64)
      })
    ).not.toBeNull();
  });

  it("W4(09 §3.3 turn_ref 放宽):screen/push 的 runtime_effect turnRef 允许 NULL(voice 仍强制)", () => {
    expect(
      receiptComboViolation({
        kind: "runtime_effect",
        riskLevel: "S2",
        decidedVia: "screen",
        authStrength: "screen_authenticated",
        parentPackageDigest: "sha256:" + "a".repeat(64)
      })
    ).toBeNull();
    expect(
      receiptComboViolation({
        kind: "runtime_effect",
        riskLevel: "S2",
        decidedVia: "push",
        authStrength: "paired_device_pin",
        parentPackageDigest: "sha256:" + "a".repeat(64)
      })
    ).toBeNull();
  });
});

describe("W4 §3.3 S3MergeReceipt 判别型(schema 层)", () => {
  const ulid = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
  const s3Fields = {
    challengeId: `s3c_${ulid}`,
    credentialId: "Y3JlZC1pZA",
    assertionDigest: "sha256:" + "b".repeat(64),
    attempt: 1,
    packageRevision: 1,
    prospectiveTreeSha: "c".repeat(40)
  };
  const s3Receipt = {
    id: `apr_${ulid}`,
    kind: "runtime_effect" as const,
    refDigest: "sha256:" + "a".repeat(64),
    parentPackageDigest: "sha256:" + "d".repeat(64),
    taskId: `tsk_${ulid}`,
    riskLevel: "S3" as const,
    principal: "owner" as const,
    decidedVia: "screen" as const,
    authStrength: "os_biometric" as const,
    decision: "accept" as const,
    nonce: "n-1",
    issuedAt: "2026-07-27T12:00:00Z",
    expiresAt: "2026-07-27T12:02:00Z",
    outcome: "pending" as const,
    s3: s3Fields
  };

  it("完整 S3MergeReceipt 通过;isS3MergeReceipt 判别为真", async () => {
    const { approvalReceiptSchema, s3MergeReceiptSchema, isS3MergeReceipt } = await import("../src/types/approval.js");
    expect(approvalReceiptSchema.safeParse(s3Receipt).success).toBe(true);
    expect(s3MergeReceiptSchema.safeParse(s3Receipt).success).toBe(true);
    expect(isS3MergeReceipt(approvalReceiptSchema.parse(s3Receipt))).toBe(true);
  });

  it("generic screen 收据(无 s3 判别域)标 S3 ⇒ schema 拒;判别函数为假(Codex 21 A1)", async () => {
    const { approvalReceiptSchema, isS3MergeReceipt } = await import("../src/types/approval.js");
    const { s3: _s3, ...generic } = s3Receipt;
    expect(approvalReceiptSchema.safeParse(generic).success).toBe(false);
    // S2 screen 收据带 s3 域蹭挑战来源 ⇒ 拒(双向 CHECK 的 schema 同源)
    expect(
      approvalReceiptSchema.safeParse({ ...s3Receipt, riskLevel: "S2", authStrength: "screen_authenticated" }).success
    ).toBe(false);
    // S2 收据(合法形)冒充 S3 判别 ⇒ 假
    const s2 = approvalReceiptSchema.parse({
      ...generic,
      riskLevel: "S2",
      authStrength: "screen_authenticated"
    });
    expect(isS3MergeReceipt(s2)).toBe(false);
  });

  it("S3 收据缺 taskId ⇒ 拒(判别型收窄必填)", async () => {
    const { approvalReceiptSchema } = await import("../src/types/approval.js");
    const { taskId: _t, ...noTask } = s3Receipt;
    expect(approvalReceiptSchema.safeParse(noTask).success).toBe(false);
  });

  it("s3.prospectiveTreeSha 只认裸 hex 40(Digest 型互填拒,Codex 21 A2)", async () => {
    const { s3MergeReceiptSchema } = await import("../src/types/approval.js");
    expect(
      s3MergeReceiptSchema.safeParse({
        ...s3Receipt,
        s3: { ...s3Fields, prospectiveTreeSha: "sha256:" + "c".repeat(64) }
      }).success
    ).toBe(false);
  });
});
