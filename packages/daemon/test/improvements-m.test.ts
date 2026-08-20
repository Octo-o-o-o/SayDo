// 外部评审 M 批代码项验收:M2 OpenRouter 钉路由 / M3 五段延迟分解 / M5 否定即时落账 / M10 TTS 漂移哨兵。

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDb } from "../src/storage/db.js";
import { createOpenAICompatProvider } from "../src/providers/openaiCompat.js";
import { breakdown, decompose, percentile, type LatencyTrace } from "../src/obs/latency.js";
import { detectNegationRevision, captureNegation } from "../src/memory/negation.js";
import { MemoryLedger } from "../src/memory/ledger.js";
import { detectDrift, type SentinelBaseline, type SentinelSample } from "../src/voice/driftSentinel.js";
import type { AuditSink } from "../src/obs/audit.js";

const nullAudit: AuditSink = { record: () => ({ id: "aud_x" }) };

describe("M2 OpenRouter 钉路由", () => {
  it("providerPinning ⇒ 请求 body 带 provider.order + allow_fallbacks=false;回显 routedProvider + cached tokens", async () => {
    let captured: Record<string, unknown> = {};
    const fakeFetch = (async (_url: string, init: { body: string }) => {
      captured = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          model: "openai/gpt-5.6-sol",
          provider: "openai",
          choices: [{ message: { content: "hi" } }],
          usage: { prompt_tokens: 100, completion_tokens: 20, prompt_tokens_details: { cached_tokens: 80 } }
        })
      };
    }) as unknown as typeof fetch;
    const p = createOpenAICompatProvider({
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "k",
      model: "openai/gpt-5.6-sol",
      fetchImpl: fakeFetch,
      providerPinning: { order: ["openai"], allowFallbacks: false }
    });
    const r = await p.chat({ messages: [{ role: "user", content: "x" }] });
    expect((captured["provider"] as { order: string[]; allow_fallbacks: boolean })).toEqual({ order: ["openai"], allow_fallbacks: false });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.routedProvider).toBe("openai");
      expect(r.usage?.cachedPromptTokens).toBe(80);
    }
  });

  it("无 providerPinning ⇒ body 不带 provider(单家直连)", async () => {
    let captured: Record<string, unknown> = {};
    const fakeFetch = (async (_url: string, init: { body: string }) => {
      captured = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => ({ model: "m", choices: [{ message: { content: "y" } }] }) };
    }) as unknown as typeof fetch;
    const p = createOpenAICompatProvider({ baseUrl: "https://api.deepseek.com/v1", apiKey: "k", model: "m", fetchImpl: fakeFetch });
    await p.chat({ messages: [{ role: "user", content: "x" }] });
    expect(captured["provider"]).toBeUndefined();
  });
});

describe("M3 五段延迟分解", () => {
  const t = (turnId: string, v: number[]): LatencyTrace => ({
    turnId,
    vadEndMs: v[0]!,
    asrFinalMs: v[1]!,
    llmFirstTokenMs: v[2]!,
    ttsFirstByteMs: v[3]!,
    playoutStartMs: v[4]!
  });

  it("分段:EOU 等待单列;total=vad_end->playout_start", () => {
    const b = breakdown(t("a", [0, 400, 900, 1100, 1200]));
    expect(b.eouWaitMs).toBe(400); // EOU 等待单列
    expect(b.llmMs).toBe(500);
    expect(b.ttsMs).toBe(200);
    expect(b.playoutMs).toBe(100);
    expect(b.totalMs).toBe(1200);
  });

  it("P50/P90 分解表 + SLO 判定(内标 1.0s / 发布上限 1.5s)", () => {
    const traces = Array.from({ length: 20 }, (_, i) => t(`t${i}`, [0, 300 + i * 10, 700 + i * 20, 900 + i * 20, 1000 + i * 20]));
    const rep = decompose(traces);
    expect(rep.n).toBe(20);
    const total = rep.rows.find((r) => r.segment === "totalMs")!;
    expect(total.p90).toBeGreaterThanOrEqual(total.p50);
    expect(rep.slo.passPublish).toBe(rep.totalP50 <= 1500);
    expect(percentile([1, 2, 3, 4], 50)).toBe(2);
  });
});

describe("M5 否定/修订即时落账本", () => {
  it("检出否定/修订;疑问句不落;修订优先", () => {
    expect(detectNegationRevision("不要用 papaparse")?.kind).toBe("negation");
    expect(detectNegationRevision("导出格式改成 Excel")?.kind).toBe("revision");
    expect(detectNegationRevision("要不要用 CSV 吗?")).toBeNull(); // 疑问句
    expect(detectNegationRevision("就正常做")).toBeNull();
  });

  it("captureNegation 落 user_stated 账本(不被预算挤);无检出不写", () => {
    const db = openDb(join(mkdtempSync(join(tmpdir(), "saydo-neg-")), "saydo.db"));
    const ledger = new MemoryLedger({ db, audit: nullAudit, now: () => new Date("2026-07-25T00:00:00Z") });
    const ev = captureNegation(ledger, { utterance: "别用全局变量,改成依赖注入", turnRef: "ses_01AAAAAAAAAAAAAAAAAAAAAAAA" });
    expect(ev).not.toBeNull();
    if (ev && ev.op === "add") expect(ev.trust).toBe("user_stated");
    expect(captureNegation(ledger, { utterance: "继续", turnRef: "ses_01AAAAAAAAAAAAAAAAAAAAAAAA" })).toBeNull();
  });
});

describe("M10 TTS 漂移哨兵", () => {
  const baseSample = (text: string): SentinelSample => ({
    text,
    durationMs: 2000,
    loudnessEnvelope: [0.1, 0.5, 0.8, 0.6, 0.3],
    asrRoundtrip: text
  });
  const baseline: SentinelBaseline = { capturedAt: "2026-07-20", samples: [baseSample("句子一"), baseSample("句子二")] };

  it("无漂移 ⇒ 空;时长超阈值 / ASR 回转不一致 ⇒ finding", () => {
    expect(detectDrift(baseline, [baseSample("句子一")])).toEqual([]);
    const durDrift = detectDrift(baseline, [{ ...baseSample("句子一"), durationMs: 2600 }]); // +30% > 15%
    expect(durDrift.some((f) => f.kind === "duration")).toBe(true);
    const asrDrift = detectDrift(baseline, [{ ...baseSample("句子一"), asrRoundtrip: "句子壹(漂移)" }]);
    expect(asrDrift.some((f) => f.kind === "asr_roundtrip")).toBe(true);
  });

  it("响度包络形状漂移 ⇒ finding", () => {
    const envDrift = detectDrift(baseline, [{ ...baseSample("句子一"), loudnessEnvelope: [0.9, 0.1, 0.1, 0.1, 0.9] }]);
    expect(envDrift.some((f) => f.kind === "envelope")).toBe(true);
  });
});
