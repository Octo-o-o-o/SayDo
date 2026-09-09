// 首响 SLO 分段实测(计划 M3/A-1;03 §3 SLO P50<=1.5s 且 P90<=2.5s 的实测落点)。
// 五段时间戳(同一时钟毫秒,同一 turn 内可减):
//   vad_end(用户说完)-> asr_final(转写终版)-> llm_first_token(Brain 首 token)
//   -> tts_first_byte(合成首字节)-> playout_start(开始出声)。
// 入 WS 事件与 JSONL 日志;Phase 1 出口注入语料 >=20 条出 P50/P90 分段分解表(EOU 等待单列)。
// 内标 P50<1.0s、发布上限 P50 1.5s 且 P90 2.5s。
//
// GAP-02 2.4(VOBS-01)口径如实声明:
// - 时钟 = daemon 收到事件的时刻(跨进程单调钟原点不同,对端 atMs 不可减;localhost WS 传输 <1ms);
// - `llm_first_token` 实为对话档 provider 响应到达时刻(非流式时是整段响应),`tts_first_byte` 实为 pipeline 上报的
//   整句合成完成/首块可播的近似——两者都是「响应/整句合成完成的近似」,不是真首 token / 首字节;WS 词表不改
//   (要改先回 09 §10/§16),只在报告字段 `segmentNotes` 里写明;
// - 判定同时看 P50 与 P90,样本 <20 或含非有限/逆序时间戳给 undeterminable,不给 pass;
// - pending 有容量与 TTL,取消/超时/缺段轮进分母,重复与迟到事件不复活已结算轮;按 origin 分别出分布。

export interface LatencyTrace {
  turnId: string;
  vadEndMs: number;
  asrFinalMs: number;
  llmFirstTokenMs: number;
  ttsFirstByteMs: number;
  playoutStartMs: number;
  /** 轮次来源(文本轮 / PTT / 免手 / 控制轮 / 工具轮 / 未知);同一分布只放同 origin */
  origin?: LatencyOrigin;
}

export interface SegmentBreakdown {
  /** EOU 等待(vad_end -> asr_final;codex 03 指常吃 300-800ms,单列) */
  eouWaitMs: number;
  /** ASR 尾延迟已并入 EOU(转写终版即 asr_final);此处 asr->llm = Brain 首 token 前处理 */
  asrToLlmMs: number;
  /** LLM 首 token(asr_final -> llm_first_token;实为响应到达近似) */
  llmMs: number;
  /** TTS 首字节(llm_first_token -> tts_first_byte;实为整句合成完成近似) */
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

export type LatencyOrigin = "text" | "ptt" | "hands_free" | "control" | "tool" | "unknown";
export const LATENCY_ORIGINS: readonly LatencyOrigin[] = ["text", "ptt", "hands_free", "control", "tool", "unknown"];

/** SLO 判定三态:pass 只在样本充足且 P50/P90 同时达标;样本不足或时间戳非法 = undeterminable(不是 pass) */
export type SloStatus = "pass" | "fail" | "undeterminable";

export const LATENCY_SLO = {
  publishCeilingP50Ms: 1500,
  publishCeilingP90Ms: 2500,
  internalTargetP50Ms: 1000,
  minSamples: 20
} as const;

/** 五段时间戳是否有限且单调不减(逆序/NaN/Infinity 一律非法) */
export function traceIsValid(t: LatencyTrace): boolean {
  const seq = [t.vadEndMs, t.asrFinalMs, t.llmFirstTokenMs, t.ttsFirstByteMs, t.playoutStartMs];
  if (!seq.every((v) => Number.isFinite(v))) return false;
  for (let i = 1; i < seq.length; i++) if ((seq[i] as number) < (seq[i - 1] as number)) return false;
  return true;
}

export interface OriginSummary {
  n: number;
  invalid: number;
  totalP50: number;
  totalP90: number;
  status: SloStatus;
}

export interface LatencyCounts {
  /** 见过的轮(start 或首个 stage) */
  started: number;
  /** 五段齐且时间戳合法 */
  completed: number;
  /** 五段齐但非有限/逆序,排除在分布外 */
  invalid: number;
  /** 打断/中止(barge-in 等)显式结算 */
  cancelled: number;
  /** 未出声且超过 TTL */
  timeout: number;
  /** 已出声(playout_start)但缺段,宽限期后结算 */
  missing_segment: number;
  /** pending 满时被拒的新轮 */
  overflow: number;
  /** 同轮同段重复事件(保留首个) */
  duplicate: number;
  /** 已结算轮的迟到事件 */
  late: number;
}

export interface DecompositionReport {
  /** 进入分布的合法 completed 数 */
  n: number;
  rows: DecompositionRow[];
  /** SLO 判定:P50<=1500 且 P90<=2500 且 n>=20 才 pass;内标 P50<1000 */
  totalP50: number;
  totalP90: number;
  slo: {
    publishCeilingP50Ms: 1500;
    publishCeilingP90Ms: 2500;
    internalTargetP50Ms: 1000;
    minSamples: 20;
    status: SloStatus;
    internalStatus: SloStatus;
    /** = status === "pass"(兼容旧字段;undeterminable 时为 false) */
    passPublish: boolean;
    passInternal: boolean;
  };
  /** 分布外样本(非有限/逆序时间戳) */
  invalid: number;
  clock: "daemon_arrival";
  /** 字段名如实注记:llm_first_token / tts_first_byte 都是「响应/整句合成完成」的近似 */
  segmentNotes: Record<"llmMs" | "ttsMs" | "clock", string>;
  byOrigin: Partial<Record<LatencyOrigin, OriginSummary>>;
}

export const LATENCY_SEGMENT_NOTES: DecompositionReport["segmentNotes"] = {
  llmMs: "llm_first_token = 对话档 provider 响应到达时刻的近似(非流式时为整段响应),不是真首 token",
  ttsMs: "tts_first_byte = pipeline 上报整句合成完成/首块可播的近似,不是真首字节",
  clock: "全部时间戳取 daemon 收到事件的时刻(跨进程代理),对端 atMs 不参与计算"
};

export type LatencyStage = "vad_end" | "asr_final" | "llm_first_token" | "tts_first_byte" | "playout_start";

const STAGE_FIELD: Record<LatencyStage, keyof Omit<LatencyTrace, "turnId" | "origin">> = {
  vad_end: "vadEndMs",
  asr_final: "asrFinalMs",
  llm_first_token: "llmFirstTokenMs",
  tts_first_byte: "ttsFirstByteMs",
  playout_start: "playoutStartMs"
};
const STAGES = Object.keys(STAGE_FIELD) as LatencyStage[];

function sloStatus(n: number, p50: number, p90: number, ceilP50: number, ceilP90: number | undefined): SloStatus {
  if (n < LATENCY_SLO.minSamples || !Number.isFinite(p50) || !Number.isFinite(p90)) return "undeterminable";
  if (p50 <= ceilP50 && (ceilP90 === undefined || p90 <= ceilP90)) return "pass";
  return "fail";
}

interface PendingTurn {
  stages: Partial<Record<LatencyStage, number>>;
  origin: LatencyOrigin;
  firstAtMs: number;
  /** playout_start 到达时刻(已出声);之后仍缺段则宽限期后按 missing_segment 结算 */
  endedAtMs?: number;
}

export interface LatencyCollectorOptions {
  /** completed 环形上界 */
  maxTraces?: number;
  /** pending 容量;满则新轮记 overflow 并丢弃 */
  maxPending?: number;
  /** 未出声轮的 TTL(ms,按事件 atMs 同一时钟计) */
  pendingTtlMs?: number;
  /** 已出声但缺段的宽限(ms):等异构 socket 的迟到段 */
  endedGraceMs?: number;
  /** 已结算 turnId 的记忆上界(用于拒绝迟到/重复事件) */
  maxSettled?: number;
}

/** 五段时间戳收集器(WS latency.stage 事件 -> 完整 trace;llm_first_token 由 daemon 自记) */
export class LatencyCollector {
  private readonly partial = new Map<string, PendingTurn>();
  private readonly completed: LatencyTrace[] = [];
  private readonly settled = new Set<string>();
  private readonly maxTraces: number;
  private readonly maxPending: number;
  private readonly pendingTtlMs: number;
  private readonly endedGraceMs: number;
  private readonly maxSettled: number;
  private readonly counts: LatencyCounts = {
    started: 0,
    completed: 0,
    invalid: 0,
    cancelled: 0,
    timeout: 0,
    missing_segment: 0,
    overflow: 0,
    duplicate: 0,
    late: 0
  };

  constructor(opts: LatencyCollectorOptions | number = {}) {
    const o = typeof opts === "number" ? { maxTraces: opts } : opts;
    this.maxTraces = o.maxTraces ?? 500;
    this.maxPending = o.maxPending ?? 500;
    this.pendingTtlMs = o.pendingTtlMs ?? 120_000;
    this.endedGraceMs = o.endedGraceMs ?? 5_000;
    this.maxSettled = o.maxSettled ?? 2000;
  }

  private rememberSettled(turnId: string): void {
    this.settled.add(turnId);
    if (this.settled.size > this.maxSettled) {
      const first = this.settled.values().next().value;
      if (first !== undefined) this.settled.delete(first);
    }
  }

  private ensurePending(turnId: string, atMs: number, origin: LatencyOrigin | undefined): PendingTurn | null {
    const existing = this.partial.get(turnId);
    if (existing) {
      // 工具轮/控制轮在 llm 到达时才知道,允许把 origin 收窄一次;不把已知 origin 改回 unknown
      if (origin && origin !== "unknown" && (existing.origin === "unknown" || origin === "tool")) existing.origin = origin;
      return existing;
    }
    if (this.settled.has(turnId)) {
      this.counts.late += 1;
      return null;
    }
    if (this.partial.size >= this.maxPending) {
      this.counts.overflow += 1;
      return null;
    }
    const p: PendingTurn = { stages: {}, origin: origin ?? "unknown", firstAtMs: atMs };
    this.partial.set(turnId, p);
    this.counts.started += 1;
    return p;
  }

  /** 显式登记一轮的来源(asr.final / turn.text 到达时);之后的 stage 事件沿用该 origin */
  start(turnId: string, origin: LatencyOrigin, atMs: number): void {
    this.ensurePending(turnId, atMs, origin);
  }

  /** 记一段;五段齐且合法 ⇒ 完整 trace 归档并返回(否则 null)。重复段保留首个;已结算轮的事件计 late */
  record(turnId: string, stage: LatencyStage, atMs: number, origin?: LatencyOrigin): LatencyTrace | null {
    const p = this.ensurePending(turnId, atMs, origin);
    if (!p) return null;
    if (p.stages[stage] !== undefined) {
      this.counts.duplicate += 1;
      return null;
    }
    p.stages[stage] = atMs;
    if (stage === "playout_start") p.endedAtMs = atMs;
    if (!STAGES.every((s) => p.stages[s] !== undefined)) return null;
    const trace: LatencyTrace = {
      turnId,
      vadEndMs: p.stages.vad_end as number,
      asrFinalMs: p.stages.asr_final as number,
      llmFirstTokenMs: p.stages.llm_first_token as number,
      ttsFirstByteMs: p.stages.tts_first_byte as number,
      playoutStartMs: p.stages.playout_start as number,
      origin: p.origin
    };
    this.partial.delete(turnId);
    this.rememberSettled(turnId);
    if (!traceIsValid(trace)) {
      this.counts.invalid += 1;
      return null;
    }
    this.counts.completed += 1;
    this.completed.push(trace);
    if (this.completed.length > this.maxTraces) this.completed.shift();
    return trace;
  }

  /** 打断/中止:该轮从 pending 结算为 cancelled;未知轮不计 */
  settle(turnId: string, outcome: "cancelled"): boolean {
    const p = this.partial.get(turnId);
    if (!p) return false;
    this.partial.delete(turnId);
    this.rememberSettled(turnId);
    this.counts[outcome] += 1;
    return true;
  }

  /** TTL / 宽限期清扫(调用方定时驱动;nowMs 与事件 atMs 同一时钟) */
  sweep(nowMs: number): { timeout: number; missingSegment: number } {
    let timeout = 0;
    let missingSegment = 0;
    for (const [turnId, p] of this.partial) {
      if (p.endedAtMs !== undefined && nowMs - p.endedAtMs >= this.endedGraceMs) {
        this.partial.delete(turnId);
        this.rememberSettled(turnId);
        this.counts.missing_segment += 1;
        missingSegment += 1;
      } else if (p.endedAtMs === undefined && nowMs - p.firstAtMs >= this.pendingTtlMs) {
        this.partial.delete(turnId);
        this.rememberSettled(turnId);
        this.counts.timeout += 1;
        timeout += 1;
      }
    }
    return { timeout, missingSegment };
  }

  traces(): readonly LatencyTrace[] {
    return this.completed;
  }

  pendingSize(): number {
    return this.partial.size;
  }

  countsSnapshot(): LatencyCounts {
    return { ...this.counts };
  }

  /** 当前分解表(>=20 条才有统计意义;不足如实给 undeterminable) */
  report(): DecompositionReport & { counts: LatencyCounts; pending: number } {
    return { ...decompose([...this.completed], this.counts.invalid), counts: this.countsSnapshot(), pending: this.partial.size };
  }
}

function rowsOf(traces: LatencyTrace[]): DecompositionRow[] {
  const segs: (keyof SegmentBreakdown)[] = ["eouWaitMs", "asrToLlmMs", "llmMs", "ttsMs", "playoutMs", "totalMs"];
  const bds = traces.map(breakdown);
  return segs.map((segment) => {
    const sorted = bds.map((b) => b[segment]).sort((a, b) => a - b);
    return { segment, p50: percentile(sorted, 50), p90: percentile(sorted, 90) };
  });
}

/** P50/P90 分段分解表(Phase 1 出口;EOU 等待单列)。非法 trace(非有限/逆序)排除在分布外并计入 invalid */
export function decompose(traces: LatencyTrace[], extraInvalid = 0): DecompositionReport {
  const valid = traces.filter(traceIsValid);
  const invalid = traces.length - valid.length + extraInvalid;
  const rows = rowsOf(valid);
  const totalRow = rows.find((r) => r.segment === "totalMs") as DecompositionRow;
  const status = sloStatus(valid.length, totalRow.p50, totalRow.p90, LATENCY_SLO.publishCeilingP50Ms, LATENCY_SLO.publishCeilingP90Ms);
  const internalStatus = sloStatus(valid.length, totalRow.p50, totalRow.p90, LATENCY_SLO.internalTargetP50Ms, undefined);
  const byOrigin: Partial<Record<LatencyOrigin, OriginSummary>> = {};
  for (const origin of LATENCY_ORIGINS) {
    const own = valid.filter((t) => (t.origin ?? "unknown") === origin);
    const ownInvalid = traces.filter((t) => (t.origin ?? "unknown") === origin && !traceIsValid(t)).length;
    if (own.length === 0 && ownInvalid === 0) continue;
    const total = rowsOf(own).find((r) => r.segment === "totalMs") as DecompositionRow;
    byOrigin[origin] = {
      n: own.length,
      invalid: ownInvalid,
      totalP50: total.p50,
      totalP90: total.p90,
      status: sloStatus(own.length, total.p50, total.p90, LATENCY_SLO.publishCeilingP50Ms, LATENCY_SLO.publishCeilingP90Ms)
    };
  }
  return {
    n: valid.length,
    rows,
    totalP50: totalRow.p50,
    totalP90: totalRow.p90,
    slo: {
      publishCeilingP50Ms: 1500,
      publishCeilingP90Ms: 2500,
      internalTargetP50Ms: 1000,
      minSamples: 20,
      status,
      internalStatus,
      passPublish: status === "pass",
      passInternal: internalStatus === "pass"
    },
    invalid,
    clock: "daemon_arrival",
    segmentNotes: LATENCY_SEGMENT_NOTES,
    byOrigin
  };
}
