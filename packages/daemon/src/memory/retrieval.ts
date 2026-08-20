// B5 检索(计划 2.2;modules/b B5):FTS5(BM25,trigram 起步) + live rg 组合;provenance/freshness 硬过滤。
// 双源合流:知识库(FTS)答"我们决定过什么"(provenance 随结果带出,溯源问答 10 #37 机械回放),
// 仓库(rg)答"代码现在是什么"(永远 agentic grep 现读,03 §9——不把代码事实收进知识库)。
// 不做:向量检索(sqlite-vec P1 可叠)。

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { SourceRef, Tier, Trust } from "@saydo/contracts";
import type { MemoryFts } from "./fts.js";
import type { ProjectedMemory } from "./ledger.js";

const execFileAsync = promisify(execFile);

export interface KnowledgeHit {
  id: string;
  claim: string;
  tier: Tier;
  trust: Trust;
  /** provenance:溯源问答与口播口径("我们决定过")的机械依据 */
  source: SourceRef;
  /** 相关度(bm25 取负:越大越相关);可作 CompileFact.ftsScore 直传 B1 */
  score: number;
}

export interface RepoHit {
  file: string;
  line: number;
  text: string;
}

export interface RetrieveResult {
  knowledge: KnowledgeHit[];
  repo: RepoHit[];
}

/**
 * FTS5 MATCH 组装:每词双引号短语(内部引号翻倍转义)OR 连接。
 * trigram 对 <3 字符词无法索引(07 D9 已知限制,spike 验证;短词靠 rg 侧兜)。
 */
export function buildMatchQuery(terms: string[]): string {
  return terms
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => `"${t.replaceAll('"', '""')}"`)
    .join(" OR ");
}

export interface LedgerView {
  project(now?: string): ProjectedMemory[];
}

export class Retrieval {
  private readonly fts: MemoryFts;
  private readonly ledger: LedgerView;

  constructor(fts: MemoryFts, ledger: LedgerView) {
    this.fts = fts;
    this.ledger = ledger;
  }

  /**
   * 知识库检索:FTS 命中 → 账本 active 集合校验(freshness 硬过滤:
   * expiresAt/invalidated/forget 命中即滤——project() 即 active 真相,不给 Brain 旧事实)。
   */
  searchKnowledge(terms: string[], opts?: { limit?: number; now?: string }): KnowledgeHit[] {
    const matchQuery = buildMatchQuery(terms);
    if (matchQuery === "") return [];
    const active = new Map(this.ledger.project(opts?.now).map((m) => [m.id, m]));
    const hits: KnowledgeHit[] = [];
    for (const h of this.fts.search(matchQuery, opts?.limit ?? 8)) {
      const fact = active.get(h.memId);
      if (!fact) continue; // FTS 残影(已过期/已删):硬过滤
      hits.push({
        id: fact.id,
        claim: fact.claim,
        tier: fact.tier,
        trust: fact.trust,
        source: fact.source,
        score: -h.score
      });
    }
    return hits;
  }

  /** 仓库现读:rg 固定串检索(exit 1=无匹配是正常空结果;exit 2=真错误) */
  async searchRepo(terms: string[], cwd: string, opts?: { limit?: number }): Promise<RepoHit[]> {
    const cleaned = terms.map((t) => t.trim()).filter((t) => t.length > 0);
    if (cleaned.length === 0) return [];
    const limit = opts?.limit ?? 20;
    const args = ["--fixed-strings", "-n", "--no-heading", "-S", "-m", String(limit)];
    for (const t of cleaned) args.push("-e", t);
    args.push("./");
    try {
      const { stdout } = await execFileAsync("rg", args, { cwd, timeout: 5000, maxBuffer: 1024 * 1024 });
      return parseRgOutput(stdout, limit);
    } catch (err) {
      const e = err as { code?: number; stdout?: string };
      if (e.code === 1) return []; // 无匹配
      throw err;
    }
  }

  /** 双源合流(来源标注给 A3 区分口播口径) */
  async retrieve(terms: string[], cwd?: string, opts?: { limit?: number; now?: string }): Promise<RetrieveResult> {
    const knowledge = this.searchKnowledge(terms, opts);
    const repo = cwd ? await this.searchRepo(terms, cwd, opts) : [];
    return { knowledge, repo };
  }
}

function parseRgOutput(stdout: string, limit: number): RepoHit[] {
  const hits: RepoHit[] = [];
  for (const lineRaw of stdout.split("\n")) {
    if (hits.length >= limit) break;
    const line = lineRaw.trimEnd();
    if (line === "") continue;
    const m = /^(.+?):(\d+):(.*)$/.exec(line);
    if (!m) continue;
    hits.push({ file: m[1] as string, line: Number(m[2]), text: m[3] as string });
  }
  return hits;
}
