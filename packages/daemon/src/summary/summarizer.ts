// C6 摘要器(计划 4.3;modules/c C6;10 §5 摘要输出规格)。
// agent 原始事件流 -> 三层口播摘要:统计走纯规则(实时免费),叙事走廉价档(仅关键节点惰性)。
// 永不把原始事件流给 Brain(03 §2)。数字纪律:文件数来自 git、测试数来自独立 gate、未知标 unknown、附 asOf;
// 叙事模型只做措辞,不得产生规则层没有的数字(不一致以规则为准并报警)。decisions[] P0 只落库不口播。
// 缓存按 evidenceDigest 键(同证据不重算)。

import { jcsDigest, type Decision } from "@saydo/contracts";

export type SummaryKind = "coding_done" | "blocked" | "failed" | "unknown";

export type { Decision }; // W5a 3.2:类型上移 @saydo/contracts(decisionSchema;契约不分叉),此处只转发

/** 规则层统计(全部来自结构化事件/git/gate,禁编造) */
export interface RunStats {
  outcome: "review" | "failed" | "blocked" | "unknown";
  /** git diff --numstat 得出的改动文件数(unknown 时 undefined,不写 0) */
  filesChanged?: number;
  /** 独立 verify gate 结果(unknown 时 undefined) */
  tests?: { passed: number; total: number };
  /** 声明改了但不在验收标准内 / 无法机械验证的项数 */
  unverifiedCount?: number;
  decisions?: Decision[];
  blockedReason?: string;
  failedCategory?: string;
}

export interface Summary {
  kind: SummaryKind;
  oneLiner: string;
  decisions: Decision[];
  asOf: string;
}

const KIND_BY_OUTCOME: Record<RunStats["outcome"], SummaryKind> = {
  review: "coding_done",
  failed: "failed",
  blocked: "blocked",
  unknown: "unknown"
};

/** one_liner(<=40 字):字段全部来自结构化统计,禁编造;未知标 unknown 不写 0 */
export function renderOneLiner(stats: RunStats): string {
  if (stats.outcome === "blocked") return `卡住了:${stats.blockedReason ?? "需要你确认"}`;
  if (stats.outcome === "failed") return `失败了:${stats.failedCategory ?? "未分类"}`;
  if (stats.outcome === "unknown") return "结果未知,需要你看屏幕确认";
  // coding_done
  const files = stats.filesChanged === undefined ? "文件数未知" : `改了 ${stats.filesChanged} 个文件`;
  const tests =
    stats.tests === undefined ? "测试未知" : `测试 ${stats.tests.passed}/${stats.tests.total}`;
  const unverified = stats.unverifiedCount && stats.unverifiedCount > 0 ? `,${stats.unverifiedCount} 项未验证` : "";
  return `${files},${tests}${unverified}`;
}

export interface SummarizeDeps {
  now: () => Date;
  /** 廉价档叙事器(可选;缺省仅规则层 one_liner);不得产生规则外数字(本层不校验数字,叙事器自律 + walkthrough 秒数 gate) */
  narrate?: (stats: RunStats, oneLiner: string) => string;
}

/** 证据指纹(缓存键;同证据不重算) */
export function evidenceDigestOfStats(stats: RunStats): string {
  return jcsDigest({
    o: stats.outcome,
    f: stats.filesChanged ?? null,
    t: stats.tests ?? null,
    u: stats.unverifiedCount ?? null,
    b: stats.blockedReason ?? null,
    fc: stats.failedCategory ?? null,
    d: (stats.decisions ?? []).map((x) => [x.what, x.why])
  });
}

export class Summarizer {
  private readonly deps: SummarizeDeps;
  private readonly cache = new Map<string, Summary>();

  constructor(deps: SummarizeDeps) {
    this.deps = deps;
  }

  /** one_liner 层(规则统计;缓存按 evidenceDigest) */
  summarize(stats: RunStats): Summary {
    const key = evidenceDigestOfStats(stats);
    const hit = this.cache.get(key);
    if (hit) return hit;
    const summary: Summary = {
      kind: KIND_BY_OUTCOME[stats.outcome],
      oneLiner: renderOneLiner(stats),
      decisions: stats.decisions ?? [], // P0 只落库不口播
      asOf: this.deps.now().toISOString()
    };
    this.cache.set(key, summary);
    return summary;
  }

  /** walkthrough 层(廉价档叙事;数字与规则不一致以规则为准并报警) */
  walkthrough(stats: RunStats): { text: string; warning?: string } {
    const oneLiner = renderOneLiner(stats);
    if (!this.deps.narrate) return { text: oneLiner };
    const narrated = this.deps.narrate(stats, oneLiner);
    // 数字纪律:叙事里若出现与统计矛盾的文件数,报警(简单检查:叙事含数字但统计 unknown)
    const warning =
      stats.filesChanged === undefined && /\d+\s*个文件/.test(narrated)
        ? "叙事出现规则层没有的文件数,以规则为准(files unknown)"
        : undefined;
    return warning ? { text: oneLiner, warning } : { text: narrated };
  }
}
