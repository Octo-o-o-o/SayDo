// schema 形状测试:MemoryEvent op×payload 判别(§12-10 zod 层)、TaskCard route×adapter、
// PipelineMsg、Money、outbox dedupeKey 口径。

import { describe, expect, it } from "vitest";
import { memoryEventSchema } from "../src/types/memory.js";
import { taskCardSchema } from "../src/types/task.js";
import { pipelineMsgSchema } from "../src/types/pipeline.js";
import { moneySchema } from "../src/types/common.js";
import { buildDedupeKey } from "../src/types/outbox.js";
import { newId } from "../src/ids.js";
import { transcriptTurnSchema } from "../src/types/project.js";
import { focusFourStateCountsSchema } from "../src/types/focus.js";
import {
  attentionResponseSchema,
  confirmResolvedOutcomeSchema,
  mobileFocusDetailSchema,
  mobileFocusListItemSchema
} from "../src/types/mobile.js";

const MEM = newId("mem");
const PRJ = newId("prj");
const TSK = newId("tsk");
const PKG = newId("pkg");
const SES = newId("ses");

describe("TranscriptTurn provenance", () => {
  const turn = {
    turnId: SES,
    ts: "2026-08-11T00:00:00.000Z",
    speaker: "ai",
    text: "固定开场白",
    sentences: [{ sentenceId: "onboarding-1", text: "固定开场白", heard: true }],
    engine: "cascade"
  };

  it("origin 可缺省；onboarding 可持久化；词表外来源拒绝", () => {
    expect(transcriptTurnSchema.safeParse(turn).success).toBe(true);
    expect(transcriptTurnSchema.safeParse({ ...turn, origin: "onboarding" }).success).toBe(true);
    expect(transcriptTurnSchema.safeParse({ ...turn, origin: "internal" }).success).toBe(false);
  });
});

describe("M1 confirm.decision", () => {
  it("必须显式携带卡原 sessionId+receiptId,并只接受三种裁决", () => {
    const base = {
      t: "confirm.decision",
      sessionId: SES,
      receiptId: "apr_mobile_1"
    } as const;
    for (const decision of ["accept", "reject", "withdraw"] as const) {
      expect(pipelineMsgSchema.safeParse({ ...base, decision }).success).toBe(true);
    }
    expect(pipelineMsgSchema.safeParse({ t: "confirm.decision", receiptId: "apr_mobile_1", decision: "accept" }).success).toBe(false);
    expect(pipelineMsgSchema.safeParse({ ...base, decision: "dismiss" }).success).toBe(false);
  });
  it("接受回执按 session+turn 定向，确认 outcome 词表外拒", () => {
    expect(confirmResolvedOutcomeSchema.safeParse("untrusted_source").success).toBe(true);
    expect(confirmResolvedOutcomeSchema.safeParse("typo").success).toBe(false);
  });
});

describe("M1 Focus 四状态投影", () => {
  it("四格只接受非负整数", () => {
    expect(focusFourStateCountsSchema.safeParse({ queued: 1, running: 2, needsYou: 3, settled: 4 }).success).toBe(true);
    expect(focusFourStateCountsSchema.safeParse({ queued: -1, running: 0, needsYou: 0, settled: 0 }).success).toBe(false);
  });
  it("Attention/Focus 移动 DTO 由 contracts 严格校验", () => {
    expect(attentionResponseSchema.safeParse({ items: [] }).success).toBe(true);
    expect(mobileFocusListItemSchema.array().safeParse([]).success).toBe(true);
    expect(mobileFocusDetailSchema.nullable().safeParse(null).success).toBe(true);
    expect(attentionResponseSchema.safeParse({ items: [], leaked: true }).success).toBe(false);
  });
});

describe("MemoryEvent 判别联合(09 §4)", () => {
  it("add 事件合法;缺 claim 拒", () => {
    const ok = memoryEventSchema.safeParse({
      id: MEM,
      ts: "2026-07-24T00:00:00Z",
      op: "add",
      tier: "M1",
      projectId: PRJ,
      claim: "构建用 pnpm",
      source: { kind: "repo_file", ref: "package.json@abc123" },
      trust: "auto_low_impact"
    });
    expect(ok.success).toBe(true);
  });

  it("forget_hard 缺 targets/targetDigests/generation/stores 任一 => 拒(§12-10)", () => {
    const base = {
      id: MEM,
      ts: "2026-07-24T00:00:00Z",
      op: "forget_hard",
      tier: "M1",
      targets: [newId("mem")],
      targetDigests: ["sha256:" + "a".repeat(64)],
      generation: 2,
      stores: ["fts", "projection"]
    };
    expect(memoryEventSchema.safeParse(base).success).toBe(true);
    for (const missing of ["targets", "targetDigests", "generation", "stores"]) {
      const bad: Record<string, unknown> = { ...base };
      delete bad[missing];
      expect(memoryEventSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("invalidate/forget_soft 空 targets 拒(空 payload tombstone 非法,SOL 反例)", () => {
    expect(
      memoryEventSchema.safeParse({
        id: MEM,
        ts: "2026-07-24T00:00:00Z",
        op: "invalidate",
        tier: "M1",
        targets: [],
        reason: "x"
      }).success
    ).toBe(false);
  });
});

describe("TaskCard route×adapter 判别(09 §6.1)", () => {
  const base = {
    id: TSK,
    projectId: PRJ,
    packageRef: { packageId: PKG, revision: 1, digest: "sha256:" + "a".repeat(64) },
    title: "导出 CSV",
    specMarkdown: "spec",
    route: "tier1",
    status: "confirmed",
    budget: { walltimeActiveMin: 45, maxTurns: 50, maxCost: 20 },
    updatedAt: "2026-07-24T00:00:00Z"
  };
  it("route=tier1 必带 adapter", () => {
    expect(taskCardSchema.safeParse(base).success).toBe(false);
    expect(taskCardSchema.safeParse({ ...base, adapter: "cursor" }).success).toBe(true);
  });
  it("route=hopper 恒空 adapter", () => {
    expect(taskCardSchema.safeParse({ ...base, route: "hopper" }).success).toBe(true);
    expect(taskCardSchema.safeParse({ ...base, route: "hopper", adapter: "codex" }).success).toBe(false);
  });
  it("adapter 词表外拒", () => {
    expect(taskCardSchema.safeParse({ ...base, adapter: "gemini" }).success).toBe(false);
  });
});

describe("PipelineMsg(09 §10)", () => {
  it("barge_in 带截断句 id;未知 t 拒", () => {
    expect(
      pipelineMsgSchema.safeParse({ t: "barge_in", sessionId: SES, atMs: 1200, truncatedSentenceId: "s1" }).success
    ).toBe(true);
    expect(pipelineMsgSchema.safeParse({ t: "asr.wat", sessionId: SES }).success).toBe(false);
  });
  it("focus.entity 下行卡(批 4)合法;缺 entity 拒", () => {
    expect(
      pipelineMsgSchema.safeParse({
        t: "focus.entity",
        sessionId: SES,
        entity: {
          id: "ent_1",
          kind: "记下一件事",
          title: "联系 3 个种子客户",
          sub: "你来做",
          color: "blue",
          at: "2026-08-05T00:00:00.000Z"
        }
      }).success
    ).toBe(true);
    expect(pipelineMsgSchema.safeParse({ t: "focus.entity", sessionId: SES }).success).toBe(false);
  });
  it("native.reply 固定携带定向键、脱敏文本与四值 origin", () => {
    const base = {
      t: "native.reply",
      sessionId: SES,
      turnId: SES,
      sentenceId: `s-${SES}-1`,
      text: "回复"
    } as const;
    for (const origin of ["assistant_reply", "system", "confirmation", "onboarding"] as const) {
      expect(pipelineMsgSchema.safeParse({ ...base, origin }).success).toBe(true);
    }
    expect(pipelineMsgSchema.safeParse({ ...base, origin: "tool" }).success).toBe(false);
    expect(pipelineMsgSchema.safeParse({ ...base, origin: "assistant_reply", extra: true }).success).toBe(false);
  });
  it("screen_text / console.heartbeat(④e)合法", () => {
    expect(
      pipelineMsgSchema.safeParse({ t: "screen_text", sessionId: SES, turnId: SES, text: "全文" }).success
    ).toBe(true);
    expect(
      pipelineMsgSchema.safeParse({ t: "console.heartbeat", sessionId: SES, atMs: 1 }).success
    ).toBe(true);
  });
  it("pipeline.restart_pending / restart_ack / health.generation(first-run onboarding v4)", () => {
    expect(pipelineMsgSchema.safeParse({ t: "pipeline.restart_pending", generation: 7 }).success).toBe(true);
    expect(pipelineMsgSchema.safeParse({ t: "pipeline.restart_ack", generation: 7 }).success).toBe(true);
    expect(
      pipelineMsgSchema.safeParse({
        t: "pipeline.health",
        asr: "ok",
        tts: "down",
        identity: {
          sourceRevision: "a".repeat(40),
          buildId: "pipeline-test",
          protocolVersion: "1.0.0"
        },
        stateRootDigest: "b".repeat(64),
        generation: 7
      }).success
    ).toBe(true);
    // generation 可选:旧客户端无该字段仍合法
    expect(
      pipelineMsgSchema.safeParse({
        t: "pipeline.health",
        asr: "ok",
        tts: "ok",
        identity: {
          sourceRevision: "a".repeat(40),
          buildId: "pipeline-test",
          protocolVersion: "1.0.0"
        },
        stateRootDigest: "b".repeat(64)
      }).success
    ).toBe(true);
  });
});

describe("Money(09 §0):known 必有 value+currency", () => {
  it("unknown 合法;known 缺 value 拒", () => {
    expect(moneySchema.safeParse({ known: false }).success).toBe(true);
    expect(moneySchema.safeParse({ known: true, value: 3, currency: "CNY" }).success).toBe(true);
    expect(moneySchema.safeParse({ known: true }).success).toBe(false);
  });
});

describe("outbox dedupeKey 口径(09 §6.3)", () => {
  it("四段 taskId:trigger:packageRevision:occurrenceKey", () => {
    expect(
      buildDedupeKey({ taskId: "tsk_A", trigger: "ready_for_review", packageRevision: 3, occurrenceKey: "1" })
    ).toBe("tsk_A:ready_for_review:3:1");
  });
});
