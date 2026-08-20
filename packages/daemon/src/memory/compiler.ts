// B1 上下文编译器(计划 2.2;modules/b B1;合同 = 09 §5 五规则)。
// 纯函数式:输入 = 账本投影 + 预算 + topicTerms ⇒ 同输入(签名域)同 digest(可缓存/可审计/可复现)。
// 规则:① 来源优先级 user_stated > user_approved > auto_low_impact > candidate(只读标注) > third_party(默认排除);
//      ② 否定/撤销不复活(project() 已滤,本层对 expiresAt 再守一遍并记 excluded);
//      ③ taint 按 tier 过滤(M0 永不含 taint;M0 只收 user_stated/user_approved——04 §1.4);
//      ④ 超预算按 critical > 事件 ts 序(ULID 时间前缀,新先;P0 无时间衰减) > FTS 分截断并记 excluded;
//      ⑤ 同输入同 digest(computePackDigest,签名域 09 §0.1)。

import type { ContextSnapshot, Tier, Trust } from "@saydo/contracts";
import { computePackDigest, contextSnapshotSchema, jcsDigest } from "@saydo/contracts";
import type { ProjectedMemory } from "./ledger.js";

/** 含 FTS 分词器版本(09 §5:分词器变更 ⇒ compilerVersion 变更 ⇒ digest 变);0.2.0 = 预算改首超截断(评审 B-2) */
// M7:含 FTS 分词器 + 渲染模板 + token 计数器版本(任一变 ⇒ digest 变);0.3.0=装配序恒定/驱逐纪律
export const COMPILER_VERSION = "b1/0.3.0+fts:trigram+render:1+tok:1";

/** 规则⑥ 段位映射:M0/M1=稳定前缀段(dict 序渲染),M2/M3=易变段(后置,不进公共前缀) */
const SEGMENT_OF: Record<Tier, "stable" | "topical"> = { M0: "stable", M1: "stable", M2: "topical", M3: "topical" };

/** 09 §5 P0 缺省预算(可配置 ⇒ 入签名域) */
export const DEFAULT_BUDGETS = { M0: 200, M1: 1200, M2: 800, M3: 800 } as const;

const TRUST_RANK: Record<Trust, number> = {
  user_stated: 0,
  user_approved: 1,
  auto_low_impact: 2,
  candidate: 3,
  third_party: 4
};

const TIERS: readonly Tier[] = ["M0", "M1", "M2", "M3"];

/** 编译输入事实 = 账本投影 + 可选检索附加信号(critical 由调用方标,ftsScore 由 B5 给) */
export type CompileFact = ProjectedMemory & { critical?: boolean; ftsScore?: number };

export interface CompileInput {
  sessionId: string;
  projectId: string;
  facts: CompileFact[];
  /** 当轮 asr.final 分词 ∪ 会话累积热词(本层做规范化:去空/去重/字典序) */
  topicTerms: string[];
  memoryGeneration: number;
  /** freshness 基准(UTC Z 形态,与写入侧归一化口径一致——评审 B-3);编译器自身守规则②,不依赖上游已滤 */
  now: string;
  budgets?: { M0: number; M1: number; M2: number; M3: number };
  repoHead?: string;
  dirtyDigest?: string;
  /** M7:上轮 pack digest(复用前缀时入签名保纯函数性;首轮空) */
  parentPackDigest?: string;
  /** M3 形态(③-5):近 K 轮 verbatim 的 fact id 集(不在此集的 M3 fact 标 gist) */
  verbatimM3Ids?: ReadonlySet<string>;
}

/**
 * token 粗估(P0 内规,确定性纯函数;估算法变更随 COMPILER_VERSION 升版):
 * CJK 每字 ≈1 token,其余每 4 字符 ≈1 token。
 */
export function estimateTokens(text: string): number {
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    if (/[\u3400-\u9fff\uf900-\ufaff]/.test(ch)) cjk += 1;
    else other += 1;
  }
  return cjk + Math.ceil(other / 4);
}

/** 装配排序:规则①优先级 → 规则④截断序(critical > ts 新先 > FTS 分 > id 终 tie-break) */
function assemblyOrder(a: CompileFact, b: CompileFact): number {
  const trustDiff = TRUST_RANK[a.trust] - TRUST_RANK[b.trust];
  if (trustDiff !== 0) return trustDiff;
  const critDiff = (b.critical ? 1 : 0) - (a.critical ? 1 : 0);
  if (critDiff !== 0) return critDiff;
  // 取 id 前 14 字符比较(prefix 4 + ULID 时间段 10):降序 = 新事实优先(同毫秒并列时含首位随机段,
  // 仅影响并列项选择序、确定性不破——评审 C2 注释勘误)
  const tsA = a.id.slice(0, 14);
  const tsB = b.id.slice(0, 14);
  if (tsA !== tsB) return tsA < tsB ? 1 : -1;
  const ftsDiff = (b.ftsScore ?? 0) - (a.ftsScore ?? 0);
  if (ftsDiff !== 0) return ftsDiff;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function compileContext(input: CompileInput): ContextSnapshot {
  const budgets = input.budgets ?? { ...DEFAULT_BUDGETS };
  const topicTerms = [...new Set(input.topicTerms.map((t) => t.trim()).filter((t) => t.length > 0))].sort();
  const excluded: { ref: string; reason: string }[] = [];

  // 规则①/②/③:资格过滤
  const eligible: CompileFact[] = [];
  for (const f of input.facts) {
    if (f.trust === "third_party") {
      excluded.push({ ref: f.id, reason: "third_party" });
      continue;
    }
    if (f.expiresAt && f.expiresAt <= input.now) {
      excluded.push({ ref: f.id, reason: "expired" });
      continue;
    }
    if (f.tier === "M0" && f.trust !== "user_stated" && f.trust !== "user_approved") {
      excluded.push({ ref: f.id, reason: "m0_gate_trust" });
      continue;
    }
    if (f.tier === "M0" && f.taint && f.taint.length > 0) {
      excluded.push({ ref: f.id, reason: "m0_gate_taint" });
      continue;
    }
    eligible.push(f);
  }

  // 规则④(截断:决定"选谁")+ 规则⑥(装配序:决定"渲染顺序"):
  //   选谁 = assemblyOrder(critical > ts 新先);渲染序 = 稳定段 refs 按 id 字典序(FTS 分只决定入选、不决定顺序),
  //   易变段(M2/M3)后置。选谁与渲染序正交(评审关注点:规则⑥不与规则④冲突)。
  // 规则⑦(驱逐纪律):已入选切片仅因预算截断(critical/ts 挤占)被逐,不因 FTS 分数波动重排——
  //   assemblyOrder 无分数抖动项(ftsScore 仅末位 tie-break),稳定段渲染再按 id 定序,双重保稳定前缀。
  const slices: {
    tier: Tier;
    refs: string[];
    tokens: number;
    segment: "stable" | "topical";
    form?: "verbatim" | "gist";
    prefixDigest?: string;
  }[] = [];
  let prefixAccum: string[] = []; // 稳定段累积 refs(计 prefixDigest)
  for (const tier of TIERS) {
    const pool = eligible.filter((f) => f.tier === tier).sort(assemblyOrder);
    const selected: string[] = [];
    let used = 0;
    for (let i = 0; i < pool.length; i++) {
      const f = pool[i] as CompileFact;
      const cost = estimateTokens(f.claim);
      if (used + cost > budgets[tier]) {
        for (const rest of pool.slice(i)) excluded.push({ ref: rest.id, reason: `budget_${tier}` });
        break;
      }
      selected.push(f.id);
      used += cost;
    }
    if (selected.length === 0) continue;
    const segment = SEGMENT_OF[tier];
    // 规则⑥:稳定段渲染序 = id 字典序(相邻编译公共前缀最大化);易变段保入选(相关度)序
    const refs = segment === "stable" ? [...selected].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)) : selected;
    const slice: (typeof slices)[number] = { tier, refs, tokens: used, segment };
    if (tier === "M3") {
      // M3 形态:近 K 轮 verbatim,其余 gist(P0:verbatimM3Ids 未给则全 verbatim)
      const allVerbatim = !input.verbatimM3Ids || refs.every((r) => input.verbatimM3Ids?.has(r));
      slice.form = allVerbatim ? "verbatim" : "gist";
    }
    if (segment === "stable") {
      prefixAccum = [...prefixAccum, ...refs];
      slice.prefixDigest = jcsDigest(prefixAccum); // 累积前缀 digest(重建后断言前缀复用率)
    }
    slices.push(slice);
  }

  // excluded 确定性排序(输入顺序无关;码元比较,不用 localeCompare——ICU 环境相关,评审 C-1)
  excluded.sort((a, b) =>
    a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0
  );

  const body = {
    compilerVersion: COMPILER_VERSION,
    ...(input.parentPackDigest !== undefined ? { parentPackDigest: input.parentPackDigest } : {}),
    memoryGeneration: input.memoryGeneration,
    ...(input.repoHead !== undefined ? { repoHead: input.repoHead } : {}),
    ...(input.dirtyDigest !== undefined ? { dirtyDigest: input.dirtyDigest } : {}),
    topicTerms,
    budgets,
    slices,
    excluded
  };
  const snapshot: ContextSnapshot = {
    packDigest: computePackDigest(body),
    sessionId: input.sessionId,
    projectId: input.projectId,
    ...body
  };
  return contextSnapshotSchema.parse(snapshot);
}

/**
 * Pack 渲染(A3 prompt 注入用;不入签名域——refs + 账本即可确定性重建):
 * candidate 前缀"[候选未确认]"(规则①只读标注),taint 带"[taint:...]"标注(规则③)。
 */
export function renderPackText(snap: ContextSnapshot, factsById: Map<string, CompileFact>): string {
  const lines: string[] = [];
  for (const slice of snap.slices) {
    lines.push(`## ${slice.tier}`);
    for (const ref of slice.refs) {
      const f = factsById.get(ref);
      if (!f) continue;
      const marks = [
        f.trust === "candidate" ? "[候选未确认] " : "",
        f.taint && f.taint.length > 0 ? `[taint:${f.taint.join(",")}] ` : ""
      ].join("");
      lines.push(`- ${marks}${f.claim}`);
    }
  }
  return lines.join("\n");
}
