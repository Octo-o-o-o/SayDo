import { describe, expect, test } from "vitest";
import { newId, PERSONAL_CONTEXT_PROTOCOL, personalContextEffectDigest, personalContextEffectSchema, personalContextStatusQuerySchema, personalContextStatusSchema } from "../src/index.js";
const uuid = "7de98b2a-4f8b-4c66-a7e1-57a52a9cb15a";
const boundary = { installationId: uuid, nodeId: uuid, connectionId: uuid, connectionEpoch: 1, authorityEpoch: 1, vaultGeneration: 1, restrictionSequence: 0 };
function effect() {
  const unsigned = { protocol: PERSONAL_CONTEXT_PROTOCOL, operationId: uuid, boundary, link: { spaceId: "unified", caseId: uuid, caseRevision: 1, controlGeneration: 1, hardConstraintsRevision: 1, focusId: newId("foc"), focusRevision: 1, focusAuthorityEpoch: 0, focusAnchorRevision: 1, sessionId: newId("ses") }, expiresAt: 10000, method: "compile/request" as const, payload: { contextId: uuid, purpose: "answer", processorId: "saydo", recipientId: "explicit-agent", maxBytes: 4096 } };
  return { ...unsigned, payloadDigest: personalContextEffectDigest(unsigned) };
}
describe("personal-context v1 严格合同", () => {
  test("UPGRADE.T08.050 资料请求只绑定精确包，未知字段与隐含全库读取拒绝", () => {
    const value = effect();
    expect(personalContextEffectSchema.parse(value)).toEqual(value);
    const initialFocus = { ...value, link: { ...value.link, focusRevision: 0 } };
    initialFocus.payloadDigest = personalContextEffectDigest(initialFocus);
    expect(personalContextEffectSchema.safeParse(initialFocus).success).toBe(true);
    expect(personalContextEffectSchema.safeParse({ ...value, owner: true }).success).toBe(false);
    expect(personalContextEffectSchema.safeParse({ ...value, payload: { ...value.payload, all: true } }).success).toBe(false);
  });
  test("UPGRADE.T08.051 效果摘要同时绑定主体、方法、要求代次和期限", () => {
    const value = effect();
    for (const changed of [
      { ...value, boundary: { ...boundary, connectionEpoch: 2 } },
      { ...value, link: { ...value.link, controlGeneration: 2 } },
      { ...value, expiresAt: 10001 },
      { ...value, method: "request/respond" },
    ]) expect(personalContextEffectSchema.safeParse(changed).success).toBe(false);
  });
  test("UPGRADE.T08.052 unknown 对账不能携带效果正文或无回执宣称已应用", () => {
    const value = effect();
    const query = { protocol: PERSONAL_CONTEXT_PROTOCOL, method: "operation/status", operationId: uuid, boundary, originalMethod: value.method, payloadDigest: value.payloadDigest };
    expect(personalContextStatusQuerySchema.safeParse(query).success).toBe(true);
    expect(personalContextStatusQuerySchema.safeParse({ ...query, payload: value.payload }).success).toBe(false);
    expect(personalContextStatusSchema.safeParse({ operationId: uuid, payloadDigest: value.payloadDigest, state: "applied", sourceReceiptDigest: null }).success).toBe(false);
    expect(personalContextStatusSchema.safeParse({ operationId: uuid, payloadDigest: value.payloadDigest, state: "unknown", sourceReceiptDigest: null }).success).toBe(true);
  });
  test("UPGRADE.T08.053 代表主体必须保留独立授权而不能夹带 owner 字段", () => {
    const initial = effect();
    const value = { ...initial, method: "request/respond", payload: { receiptId: newId("apr"), requestRevision: 1, requestDigest: initial.payloadDigest, requestKind: "dispatch", decision: "reject", actor: { kind: "representative", mandateId: uuid, mandateRevision: 1 } } };
    value.payloadDigest = personalContextEffectDigest(value);
    expect(personalContextEffectSchema.safeParse(value).success).toBe(true);
    const forged = { ...value, payload: { ...value.payload, actor: { ...value.payload.actor, principal: "owner" } } };
    forged.payloadDigest = personalContextEffectDigest(forged);
    expect(personalContextEffectSchema.safeParse(forged).success).toBe(false);
  });
});
