// Focus 域 zod schema + event payload 判别 + digest。

import { describe, expect, it } from "vitest";
import {
  focusSchema,
  focusObligationSchema,
  focusActivationSchema,
  focusEventPayloadByType,
  parseFocusEventPayload,
  rpFactSchema,
  actionExecutionBindingSchema,
  computeObligationsDigest,
  computeResumePacketDigest,
  newId,
  FOCUS_EVENT_PAYLOAD_SCHEMA_VERSION
} from "../src/index.js";

const FOC = newId("foc");
const SES = newId("ses");
const TSK = newId("tsk");
const FEV = newId("fev");
const FOB = newId("fob");
const now = "2026-08-04T00:00:00.000Z";

describe("Focus schema", () => {
  it("focus 合法", () => {
    expect(
      focusSchema.safeParse({
        id: FOC,
        title: "SayDo Focus 改造",
        lifecycle: "active",
        semanticAuthority: "saydo",
        authorityEpoch: 0,
        currentRevision: 1,
        createdAt: now,
        updatedAt: now
      }).success
    ).toBe(true);
  });

  it("obligation resolved 缺 resolutionEventId 拒", () => {
    const base = {
      id: FOB,
      focusId: FOC,
      kind: "action" as const,
      title: "做 X",
      owner: "agent" as const,
      status: "resolved" as const,
      verification: "confirmed" as const,
      blocking: false,
      dedupeKey: `${FOC}:action:x`,
      resolution: "done" as const,
      createdAt: now,
      updatedAt: now
    };
    expect(focusObligationSchema.safeParse(base).success).toBe(false);
    expect(focusObligationSchema.safeParse({ ...base, resolutionEventId: FEV }).success).toBe(true);
  });

  it("unverified + resolved(done) 拒", () => {
    expect(
      focusObligationSchema.safeParse({
        id: FOB,
        focusId: FOC,
        kind: "action",
        title: "x",
        owner: "agent",
        status: "resolved",
        verification: "unverified",
        blocking: false,
        dedupeKey: "k",
        resolutionEventId: FEV,
        resolution: "done",
        createdAt: now,
        updatedAt: now
      }).success
    ).toBe(false);
  });

  it("waiting 缺 waitingOn 拒", () => {
    expect(
      focusObligationSchema.safeParse({
        id: FOB,
        focusId: FOC,
        kind: "followup",
        title: "等回复",
        owner: "human",
        status: "waiting",
        verification: "confirmed",
        blocking: true,
        dedupeKey: "k",
        createdAt: now,
        updatedAt: now
      }).success
    ).toBe(false);
  });

  it("activation closed 条件", () => {
    const base = {
      id: newId("fac"),
      focusId: FOC,
      sessionId: SES,
      anchorRevision: 1,
      inputFocusRevision: 0,
      resumeSource: "cold" as const,
      trigger: "user_explicit" as const,
      status: "closed" as const,
      startedAt: now
    };
    expect(focusActivationSchema.safeParse(base).success).toBe(false);
    expect(
      focusActivationSchema.safeParse({ ...base, closedAt: now, outputFocusRevision: 1 }).success
    ).toBe(true);
  });

  it("event payload 判别 schema v1", () => {
    for (const [type, schema] of Object.entries(focusEventPayloadByType)) {
      // 各类型至少能 parse 带 version 的最小样例或拒缺 version
      const empty = schema.safeParse({});
      expect(empty.success).toBe(false);
      void type;
    }
    const created = parseFocusEventPayload("created", {
      payloadSchemaVersion: FOCUS_EVENT_PAYLOAD_SCHEMA_VERSION,
      title: "t"
    });
    expect(created.title).toBe("t");
  });

  it("rpFact actionable 需 asOf", () => {
    expect(
      rpFactSchema.safeParse({
        factId: "f1",
        layer: "actionable",
        text: "下一步",
        sourceRefs: [{ kind: "obligation", ref: FOB }],
        origin: "deterministic"
      }).success
    ).toBe(false);
  });

  it("binding bound 需 ledgerRef", () => {
    const base = {
      id: newId("aeb"),
      focusId: FOC,
      taskId: TSK,
      focusRevisionAtAuthorization: 1,
      selectedAuthority: "tier1" as const,
      phase: "bound" as const,
      authorizedByEventId: FEV,
      createdAt: now,
      updatedAt: now
    };
    expect(actionExecutionBindingSchema.safeParse(base).success).toBe(false);
    expect(
      actionExecutionBindingSchema.safeParse({
        ...base,
        authoritativeLedgerRef: `tier1:task:${TSK}`
      }).success
    ).toBe(true);
  });

  it("obligationsDigest 稳定排序", () => {
    const a = computeObligationsDigest([
      { id: "b", status: "open", verification: "confirmed", owner: "human", kind: "answer", dedupeKey: "1" },
      { id: "a", status: "open", verification: "confirmed", owner: "agent", kind: "action", dedupeKey: "2" }
    ]);
    const b = computeObligationsDigest([
      { id: "a", status: "open", verification: "confirmed", owner: "agent", kind: "action", dedupeKey: "2" },
      { id: "b", status: "open", verification: "confirmed", owner: "human", kind: "answer", dedupeKey: "1" }
    ]);
    expect(a).toBe(b);
    expect(a.startsWith("sha256:")).toBe(true);
  });

  it("resume packet digest 重算", () => {
    const packet = {
      focusId: FOC,
      revision: 1,
      baseline: { revision: 1, eventHighWatermark: 2, obligationsDigest: computeObligationsDigest([]) },
      compiledFrom: { eventSeqRange: [1, 2] as [number, number], transcriptRefs: [] },
      compilerVersion: "1",
      rendererVersion: "1",
      inputDigest: computeObligationsDigest([]),
      factsJson: "[]",
      obligationsSnapshotJson: "[]"
    };
    const d = computeResumePacketDigest(packet);
    expect(computeResumePacketDigest(packet)).toBe(d);
  });
});
