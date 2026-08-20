// TTS 漂移哨兵(计划 M10/①-3;防"同 snapshot 服务端漂移"——锁版防不住,OpenAI 社区实证的新风险类,火山同暴露)。
// 固定 3-5 句 golden 文本周期合成(每周/每次发布),比对时长/响度包络/ASR 回转文本一致性,超阈值告警。
// synth/asr 注入化(真实调用在 cron/CI 侧;比对逻辑纯函数可单测)。

export const DRIFT_SENTINEL_TEXTS = [
  "报表页的导出功能执行和检查都跑完了,等你验收。",
  "这单的花费我还没有确切数字,跑起来我记账,到二十元一定停。",
  "第二步跑完了,继续第三步吗?",
  "这个方案被安全闸门拒了,要么改方案要么你亲自处理。"
] as const;

export interface SentinelSample {
  text: string;
  durationMs: number;
  /** 响度包络(RMS 序列,粗粒度分帧;比对形状而非绝对值) */
  loudnessEnvelope: number[];
  /** ASR 回转文本(合成音再识别;一致性 = 归一化相等) */
  asrRoundtrip: string;
}

export interface SentinelBaseline {
  capturedAt: string;
  samples: SentinelSample[];
}

export interface DriftThresholds {
  /** 时长偏移比阈值(缺省 15%) */
  durationRatio: number;
  /** 响度包络相对 L2 距离阈值(缺省 0.25) */
  envelopeDistance: number;
}

export const DEFAULT_DRIFT_THRESHOLDS: DriftThresholds = { durationRatio: 0.15, envelopeDistance: 0.25 };

export interface DriftFinding {
  text: string;
  kind: "duration" | "envelope" | "asr_roundtrip";
  detail: string;
}

function norm(s: string): string {
  return s.replace(/[\s，。,.、?？!！]/g, "");
}

/** 响度包络相对 L2 距离(重采样到同长度后归一化;形状比对) */
function envelopeDistance(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return a.length === b.length ? 0 : 1;
  const ra = resample(a, n);
  const rb = resample(b, n);
  const sa = ra.reduce((x, y) => x + y, 0) || 1;
  const sb = rb.reduce((x, y) => x + y, 0) || 1;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const d = ra[i]! / sa - rb[i]! / sb;
    sum += d * d;
  }
  return Math.sqrt(sum) * Math.sqrt(n);
}

function resample(arr: number[], n: number): number[] {
  if (arr.length === n) return arr;
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor((i * arr.length) / n)] as number);
  return out;
}

/** 比对当前样本与基线,超阈值产 finding(空 = 无漂移) */
export function detectDrift(
  baseline: SentinelBaseline,
  current: SentinelSample[],
  thresholds: DriftThresholds = DEFAULT_DRIFT_THRESHOLDS
): DriftFinding[] {
  const findings: DriftFinding[] = [];
  const baseByText = new Map(baseline.samples.map((s) => [s.text, s]));
  for (const cur of current) {
    const base = baseByText.get(cur.text);
    if (!base) continue;
    const durRatio = Math.abs(cur.durationMs - base.durationMs) / (base.durationMs || 1);
    if (durRatio > thresholds.durationRatio) {
      findings.push({ text: cur.text, kind: "duration", detail: `时长偏移 ${(durRatio * 100).toFixed(1)}% > ${(thresholds.durationRatio * 100).toFixed(0)}%` });
    }
    const envDist = envelopeDistance(base.loudnessEnvelope, cur.loudnessEnvelope);
    if (envDist > thresholds.envelopeDistance) {
      findings.push({ text: cur.text, kind: "envelope", detail: `响度包络距离 ${envDist.toFixed(3)} > ${thresholds.envelopeDistance}` });
    }
    if (norm(cur.asrRoundtrip) !== norm(base.asrRoundtrip)) {
      findings.push({ text: cur.text, kind: "asr_roundtrip", detail: `ASR 回转不一致:"${cur.asrRoundtrip}" vs 基线 "${base.asrRoundtrip}"` });
    }
  }
  return findings;
}
