// 首响 SLO 分段实测(计划 M3/A-1;03 §3 SLO P50<=1.5s/P90<=2.5s 的第一次实测落点)。
// 五段时间戳(单调时钟毫秒,同一 turn 内可减):
//   vad_end(用户说完)-> asr_final(转写终版)-> llm_first_token(Brain 首 token)
//   -> tts_first_byte(合成首字节)-> playout_start(开始出声)。
// 入 WS 事件与 JSONL 日志;Phase 1 出口注入语料 >=20 条出 P50/P90 分段分解表(EOU 等待单列)。
// 内标 P50<1.0s、发布上限 1.5s。

export interface LatencyTrace {
  turnId: string;
  vadEndMs: number;
  asrFinalMs: number;
  llmFirstTokenMs: number;
  ttsFirstByteMs: number;
  playoutStartMs: number;
}

export interface SegmentBreakdown {
  /** EOU 等待(vad_end -> asr_final;codex 03 指常吃 300-800ms,单列) */
  eouWaitMs: number;
  /** ASR 尾延迟已并入 EOU(转写终版即 asr_final);此处 asr->llm = Brain 首 token 前处理 */
  asrToLlmMs: number;
  /** LLM 首 token(asr_final -> llm_first_token) */
  llmMs: number;
  /** TTS 首字节(llm_first_token -> tts_first_byte) */
  ttsMs: number;
  /** 出声(tts_first_byte -> playout_start) */
  playoutMs: number;
  /** 端到端首响(vad_end -> playout_start) */
  totalMs: number;
}

export function breakdown(t: LatencyTrace): SegmentBreakdown {
  return {
    eouWaitMs: t.asrFinalMs - t.vadEndMs,
    asrToLlmMs: 0, // asr_final 即转写终版;保留段位(P1 若拆流式 ASR 尾延迟再填)
    llmMs: t.llmFirstTokenMs - t.asrFinalMs,
    ttsMs: t.ttsFirstByteMs - t.llmFirstTokenMs,
    playoutMs: t.playoutStartMs - t.ttsFirstByteMs,
    totalMs: t.playoutStartMs - t.vadEndMs
  };
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))] as number;
}

export interface DecompositionRow {
  segment: keyof SegmentBreakdown;
  p50: number;
  p90: number;
}

export interface DecompositionReport {
  n: number;
  rows: DecompositionRow[];
  /** SLO 判定:total P50<=1500 发布上限;内标 P50<1000 */
  totalP50: number;
  totalP90: number;
  slo: { publishCeilingP50Ms: 1500; internalTargetP50Ms: 1000; passPublish: boolean; passInternal: boolean };
}

export type LatencyStage = "vad_end" | "asr_final" | "llm_first_token" | "tts_first_byte" | "playout_start";

const STAGE_FIELD: Record<LatencyStage, keyof Omit<LatencyTrace, "turnId">> = {
  vad_end: "vadEndMs",
  asr_final: "asrFinalMs",
  llm_first_token: "llmFirstTokenMs",
  tts_first_byte: "ttsFirstByteMs",
  playout_start: "playoutStartMs"
};

/** 五段时间戳收集器(WS latency.stage 事件 -> 完整 trace;llm_first_token 由 daemon 自记) */
export class LatencyCollector {
  private readonly partial = new Map<string, Partial<Record<LatencyStage, number>>>();
  private readonly completed: LatencyTrace[] = [];
  private readonly maxTraces: number;

  constructor(maxTraces = 500) {
    this.maxTraces = maxTraces;
  }

  /** 记一段;五段齐 ⇒ 完整 trace 归档并返回(否则 null) */
  record(turnId: string, stage: LatencyStage, atMs: number): LatencyTrace | null {
    const p = this.partial.get(turnId) ?? {};
    p[stage] = atMs;
    this.partial.set(turnId, p);
    const stages = Object.keys(STAGE_FIELD) as LatencyStage[];
    if (!stages.every((s) => p[s] !== undefined)) return null;
    const trace: LatencyTrace = {
      turnId,
      vadEndMs: p.vad_end as number,
      asrFinalMs: p.asr_final as number,
      llmFirstTokenMs: p.llm_first_token as number,
      ttsFirstByteMs: p.tts_first_byte as number,
      playoutStartMs: p.playout_start as number
    };
    this.partial.delete(turnId);
    this.completed.push(trace);
    if (this.completed.length > this.maxTraces) this.completed.shift();
    return trace;
  }

  traces(): readonly LatencyTrace[] {
    return this.completed;
  }

  /** 当前分解表(>=20 条才有统计意义;不足如实返回 n) */
  report(): DecompositionReport {
    return decompose([...this.completed]);
  }
}

/** P50/P90 分段分解表(Phase 1 出口;EOU 等待单列) */
export function decompose(traces: LatencyTrace[]): DecompositionReport {
  const segs: (keyof SegmentBreakdown)[] = ["eouWaitMs", "asrToLlmMs", "llmMs", "ttsMs", "playoutMs", "totalMs"];
  const bds = traces.map(breakdown);
  const rows: DecompositionRow[] = segs.map((segment) => {
    const sorted = bds.map((b) => b[segment]).sort((a, b) => a - b);
    return { segment, p50: percentile(sorted, 50), p90: percentile(sorted, 90) };
  });
  const totalRow = rows.find((r) => r.segment === "totalMs") as DecompositionRow;
  return {
    n: traces.length,
    rows,
    totalP50: totalRow.p50,
    totalP90: totalRow.p90,
    slo: {
      publishCeilingP50Ms: 1500,
      internalTargetP50Ms: 1000,
      passPublish: totalRow.p50 <= 1500,
      passInternal: totalRow.p50 <= 1000
    }
  };
}
