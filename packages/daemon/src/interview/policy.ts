// A4 采访策略(计划 3.1;modules/a A4;04 §2.1 采访纪律)。
// 纯机械层:问题选择 = 覆盖扫描 + Impact x Uncertainty 排序;停止策略在代码层强制(不靠 prompt 自觉)。
// "值得问"机械定义(04 §2.1,SOL §9.3):只有会改变 outcome/scope/acceptance/风险授权级/执行路径,
// 或消除一个阻塞 propose 的 critical unknown 的问题才值得问——词表之外的候选从预算删除(埋点 dropped)。
// 选择题优先:2-5 个互斥选项 + 推荐项(04 §2.1;语音场景"说第二个"远易于组织描述)。
// 不做:就绪判定(A5)、问题最终话术(A3 渲染;本层 text 是结构层候选文本)。

import { textDigest, type Claim } from "@saydo/contracts";

/** "值得问"目标字段词表(04 §2.1;同时是无效问题率埋点标签——3.1"问题带目标字段标签") */
export const TARGET_FIELDS = [
  "outcome",
  "scope",
  "acceptance",
  "risk_authorization",
  "execution_path",
  "critical_unknown"
] as const;
export type TargetField = (typeof TARGET_FIELDS)[number];

export interface QuestionCandidate {
  id: string;
  /** 结构层候选文本(A3 渲染最终话术;golden 锚模板要素) */
  text: string;
  /** 选择题优先:2-5 个互斥选项(04 §2.1);开放问可缺省 */
  options?: string[];
  /** 推荐项下标(04 §2.1"+ 推荐项") */
  recommendedIndex?: number;
  targetField: TargetField;
  impact: 1 | 2 | 3;
  uncertainty: 1 | 2 | 3;
}

export interface AskDecision {
  kind: "ask";
  question: QuestionCandidate;
}

export interface StopDecision {
  kind: "stop";
  reason: "budget_exhausted" | "no_worthy_question";
  /** 停止后的过渡语义(modules/a A4 ①:转"以我现在的理解……"摘要 + 就绪判定;A3 渲染) */
  transition: "summarize_then_assess";
}

export type InterviewDecision = AskDecision | StopDecision;

/** 候选结构校验(代码层强制;违规候选 = 构造错误,抛出而非静默容忍) */
export function validateCandidate(q: QuestionCandidate): void {
  if (q.options !== undefined) {
    if (q.options.length < 2 || q.options.length > 5) {
      throw new Error(`question options must be 2-5 mutually exclusive choices, got ${q.options.length}`);
    }
    if (new Set(q.options).size !== q.options.length) throw new Error("question options must be distinct");
    if (q.recommendedIndex !== undefined && (q.recommendedIndex < 0 || q.recommendedIndex >= q.options.length)) {
      throw new Error("recommendedIndex out of range");
    }
  }
  if (!TARGET_FIELDS.includes(q.targetField)) throw new Error(`targetField outside worth-asking vocabulary`);
}

/**
 * 选题(一次一问):预算耗尽必停;"值得问"过滤(已问去重;targetField 词表由类型与 validate 保证);
 * 排序 = Impact x Uncertainty 降序 -> critical_unknown 优先 -> id 字典序(确定性)。
 */
export function selectNext(
  candidates: QuestionCandidate[],
  askedIds: ReadonlySet<string>,
  budget: number
): InterviewDecision {
  if (askedIds.size >= budget) {
    return { kind: "stop", reason: "budget_exhausted", transition: "summarize_then_assess" };
  }
  const pool = candidates.filter((q) => !askedIds.has(q.id));
  for (const q of pool) validateCandidate(q);
  if (pool.length === 0) {
    return { kind: "stop", reason: "no_worthy_question", transition: "summarize_then_assess" };
  }
  pool.sort((a, b) => {
    const scoreDiff = b.impact * b.uncertainty - a.impact * a.uncertainty;
    if (scoreDiff !== 0) return scoreDiff;
    const critDiff = (b.targetField === "critical_unknown" ? 1 : 0) - (a.targetField === "critical_unknown" ? 1 : 0);
    if (critDiff !== 0) return critDiff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return { kind: "ask", question: pool[0] as QuestionCandidate };
}

/**
 * 覆盖扫描(modules/a A4 ②:对证据维度扫缺口,不重复问已有高置信答案):
 * dims 里 state ∈ {unknown, conflicting} 的 claim 产生候选;verified/assumed 不产生。
 * critical ⇒ critical_unknown(3x3 最高优先);非 critical 按 dim 前缀机械映射
 * (knowledge -> execution_path / requirement -> acceptance;映射是实现内规,埋点可校准)。
 */
export function coverageScan(dims: Claim[]): QuestionCandidate[] {
  const out: QuestionCandidate[] = [];
  for (const c of dims) {
    if (c.state !== "unknown" && c.state !== "conflicting") continue;
    // 评审 B-6:id 由 claim 内容派生(位置化 id 在 dims 变序后 askedIds 去重失效——重复问/假 no_worthy)
    const id = `q_dim_${textDigest(c.text).slice(7, 19)}`;
    if (c.critical) {
      out.push({
        id,
        text: `「${stripDim(c.text)}」这点没确认就不能开工,先问清:实际情况是哪种?`,
        targetField: "critical_unknown",
        impact: 3,
        uncertainty: 3
      });
      continue;
    }
    const isKnowledge = c.text.startsWith("knowledge:");
    out.push({
      id,
      text: `关于「${stripDim(c.text)}」我还没把握,确认一下。`,
      targetField: isKnowledge ? "execution_path" : "acceptance",
      impact: 2,
      uncertainty: c.state === "conflicting" ? 3 : 2
    });
  }
  return out;
}

function stripDim(text: string): string {
  const i = text.indexOf(":");
  return i > 0 ? text.slice(i + 1) : text;
}

/**
 * Quick 直通判定(05 §4 P0 保证;3.1):已奠基项目 + 明确即刻指令("就做 X、现在")⇒ 即刻派单,
 * 不因采访姿态阻塞。机械正则,不经模型;疑问句不直通。
 */
export function quickPassthrough(input: { utterance: string; foundationGeneration: number }): boolean {
  if (input.foundationGeneration < 1) return false;
  const u = input.utterance.trim();
  if (/[??]|吗\s*$|呢\s*$/.test(u)) return false;
  const m = /(就做|就干|现在就|直接做|直接干|马上做|立刻做|开干)/.exec(u);
  if (!m) return false;
  // 评审 B-5:否定上下文不直通("别直接做/不要马上做/先别开干"是反向指令,误直通=语义反转派单)
  const before = u.slice(Math.max(0, (m.index ?? 0) - 4), m.index);
  return !/(别|不要|不能|不准|不许|先不|不用)$/.test(before) && !/(先别|暂缓)/.test(u);
}
