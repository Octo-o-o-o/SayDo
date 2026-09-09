// GAP-02 2.4(VOBS-01):延迟观测准确性——P50/P90 同判、少样本/非法时间戳 undeterminable、pending 容量与 TTL、
// 取消/超时/缺段/重复/迟到进分母、按 origin 分布。合成 fixture,不依赖真实供应方。
import { describe, expect, it } from "vitest";
import { LATENCY_SLO, LatencyCollector, decompose, traceIsValid, type LatencyTrace } from "../src/obs/latency.js";

const t = (turnId: string, v: number[], origin?: LatencyTrace["origin"]): LatencyTrace => ({
  turnId,
  vadEndMs: v[0]!,
  asrFinalMs: v[1]!,
  llmFirstTokenMs: v[2]!,
  ttsFirstByteMs: v[3]!,
  playoutStartMs: v[4]!,
  ...(origin ? { origin } : {})
});
const good = (i: number, origin?: LatencyTrace["origin"]) => t(`t${i}`, [0, 300, 700, 900, 1000 + i * 10], origin);

describe("decompose:SLO 三态", () => {
  it("样本 >=20 且 P50<=1500 且 P90<=2500 才 pass;passPublish 与 status 一致", () => {
    const rep = decompose(Array.from({ length: 20 }, (_, i) => good(i)));
    expect(rep.n).toBe(20);
    expect(rep.slo.status).toBe("pass");
    expect(rep.slo.passPublish).toBe(true);
    expect(rep.slo.publishCeilingP90Ms).toBe(2500);
    expect(rep.slo.minSamples).toBe(LATENCY_SLO.minSamples);
    expect(rep.clock).toBe("daemon_arrival");
    expect(rep.segmentNotes.llmMs).toContain("近似");
    expect(rep.segmentNotes.ttsMs).toContain("近似");
  });

  it("P50 达标但 P90 超 2500 ⇒ fail(旧实现只看 P50 会误判 pass)", () => {
    const traces = Array.from({ length: 20 }, (_, i) => (i >= 16 ? t(`s${i}`, [0, 300, 700, 900, 3000]) : good(i)));
    const rep = decompose(traces);
    expect(rep.totalP50).toBeLessThanOrEqual(1500);
    expect(rep.totalP90).toBeGreaterThan(2500);
    expect(rep.slo.status).toBe("fail");
    expect(rep.slo.passPublish).toBe(false);
  });

  it("样本 <20 ⇒ undeterminable,不给 pass", () => {
    const rep = decompose(Array.from({ length: 19 }, (_, i) => good(i)));
    expect(rep.slo.status).toBe("undeterminable");
    expect(rep.slo.passPublish).toBe(false);
    expect(rep.slo.internalStatus).toBe("undeterminable");
  });

  it("非有限/逆序时间戳排除在分布外并计 invalid;剩余不足 20 ⇒ undeterminable", () => {
    const traces = Array.from({ length: 20 }, (_, i) => good(i));
    traces[0] = t("bad-nan", [0, NaN, 700, 900, 1000]);
    traces[1] = t("bad-rev", [0, 300, 200, 900, 1000]);
    traces[2] = t("bad-inf", [0, 300, 700, Infinity, 1000]);
    expect(traceIsValid(traces[0]!)).toBe(false);
    expect(traceIsValid(traces[1]!)).toBe(false);
    const rep = decompose(traces);
    expect(rep.invalid).toBe(3);
    expect(rep.n).toBe(17);
    expect(rep.slo.status).toBe("undeterminable");
  });

  it("按 origin 分别出分布:ptt 与 tool 不混一个分布", () => {
    const traces = [
      ...Array.from({ length: 20 }, (_, i) => good(i, "ptt")),
      ...Array.from({ length: 5 }, (_, i) => t(`tool${i}`, [0, 300, 4000, 4200, 4300], "tool"))
    ];
    const rep = decompose(traces);
    expect(rep.byOrigin.ptt?.status).toBe("pass");
    expect(rep.byOrigin.ptt?.n).toBe(20);
    expect(rep.byOrigin.tool?.n).toBe(5);
    expect(rep.byOrigin.tool?.status).toBe("undeterminable");
    expect(rep.byOrigin.tool?.totalP50).toBe(4300);
    // 总体 P90 被工具轮拉高 ⇒ 总体 fail,但 ptt 自身 pass(这就是不混分布的意义)
    expect(rep.slo.status).toBe("fail");
  });
});

describe("LatencyCollector:pending 生命周期", () => {
  const stages = ["vad_end", "asr_final", "llm_first_token", "tts_first_byte", "playout_start"] as const;

  it("五段齐 ⇒ completed;重复段保留首个并计 duplicate;结算后的迟到事件计 late 且不复活", () => {
    const c = new LatencyCollector();
    let at = 0;
    for (const s of stages.slice(0, 4)) c.record("a", s, (at += 100));
    c.record("a", "asr_final", 999); // 重复
    const done = c.record("a", "playout_start", (at += 100));
    expect(done?.asrFinalMs).toBe(200); // 保留首个
    expect(c.countsSnapshot()).toMatchObject({ started: 1, completed: 1, duplicate: 1, late: 0 });
    expect(c.record("a", "vad_end", 5000)).toBeNull();
    expect(c.countsSnapshot().late).toBe(1);
    expect(c.pendingSize()).toBe(0);
  });

  it("取消(barge-in)结算为 cancelled;之后的段计 late", () => {
    const c = new LatencyCollector();
    c.start("b", "hands_free", 0);
    c.record("b", "vad_end", 10);
    expect(c.settle("b", "cancelled")).toBe(true);
    expect(c.settle("b", "cancelled")).toBe(false);
    c.record("b", "asr_final", 20);
    expect(c.countsSnapshot()).toMatchObject({ started: 1, cancelled: 1, late: 1, completed: 0 });
  });

  it("TTL:未出声轮超 120s 清扫为 timeout;已出声缺段轮宽限 5s 后为 missing_segment", () => {
    const c = new LatencyCollector({ pendingTtlMs: 120_000, endedGraceMs: 5_000 });
    c.record("stuck", "vad_end", 0);
    c.start("text-turn", "text", 0);
    c.record("text-turn", "llm_first_token", 100);
    c.record("text-turn", "tts_first_byte", 200);
    c.record("text-turn", "playout_start", 300); // 文本轮没有 vad_end/asr_final
    expect(c.sweep(4_000)).toEqual({ timeout: 0, missingSegment: 0 });
    expect(c.sweep(5_400)).toEqual({ timeout: 0, missingSegment: 1 });
    expect(c.sweep(119_000)).toEqual({ timeout: 0, missingSegment: 0 });
    expect(c.sweep(120_000)).toEqual({ timeout: 1, missingSegment: 0 });
    expect(c.countsSnapshot()).toMatchObject({ started: 2, timeout: 1, missing_segment: 1, completed: 0 });
    expect(c.pendingSize()).toBe(0);
    // 结算后迟到段不复活
    c.record("stuck", "asr_final", 130_000);
    expect(c.countsSnapshot().late).toBe(1);
  });

  it("pending 固定容量:满 500 后新轮计 overflow 并丢弃,已在 pending 的轮照常推进", () => {
    const c = new LatencyCollector({ maxPending: 500 });
    for (let i = 0; i < 500; i++) c.record(`p${i}`, "vad_end", i);
    expect(c.pendingSize()).toBe(500);
    expect(c.record("p-extra", "vad_end", 600)).toBeNull();
    expect(c.countsSnapshot().overflow).toBe(1);
    expect(c.pendingSize()).toBe(500);
    let at = 1000;
    for (const s of stages.slice(1)) c.record("p0", s, (at += 10));
    expect(c.countsSnapshot().completed).toBe(1);
    expect(c.pendingSize()).toBe(499);
  });

  it("逆序时间戳的完整轮计 invalid,不进分布;report 携带分母与 pending", () => {
    const c = new LatencyCollector();
    c.record("r", "vad_end", 100);
    c.record("r", "asr_final", 50); // 逆序
    c.record("r", "llm_first_token", 200);
    c.record("r", "tts_first_byte", 300);
    expect(c.record("r", "playout_start", 400)).toBeNull();
    const rep = c.report();
    expect(rep.invalid).toBe(1);
    expect(rep.n).toBe(0);
    expect(rep.slo.status).toBe("undeterminable");
    expect(rep.counts).toMatchObject({ started: 1, invalid: 1, completed: 0 });
    expect(rep.pending).toBe(0);
  });

  it("origin:start 登记后不被 unknown 覆盖;llm 到达时可收窄为 tool", () => {
    const c = new LatencyCollector();
    c.start("o", "ptt", 0);
    c.record("o", "vad_end", 10);
    c.record("o", "asr_final", 20);
    c.record("o", "llm_first_token", 30, "tool");
    c.record("o", "tts_first_byte", 40);
    const done = c.record("o", "playout_start", 50);
    expect(done?.origin).toBe("tool");
    c.start("q", "text", 0);
    c.record("q", "llm_first_token", 5, "unknown");
    // 仍是 text(unknown 不覆盖已知)
    c.record("q", "vad_end", 1);
    c.record("q", "asr_final", 2);
    c.record("q", "tts_first_byte", 6);
    expect(c.record("q", "playout_start", 7)?.origin).toBe("text");
  });

  it("旧构造签名 new LatencyCollector(500) 仍可用(completed 上界)", () => {
    const c = new LatencyCollector(2);
    for (let i = 0; i < 3; i++) {
      let at = i * 1000;
      for (const s of stages) c.record(`k${i}`, s, (at += 10));
    }
    expect(c.traces()).toHaveLength(2);
    expect(c.countsSnapshot().completed).toBe(3);
  });
});
