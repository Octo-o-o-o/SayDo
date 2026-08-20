// M0 热词(计划 2.4;09 §13 addHotword;04 §1:M0 用户档案含术语热词,顺带提升 ASR 准确率)。
// 误听纠正(10 #9"收到,是 {纠正词}。我把它加进热词了")=> M0 记忆(user_stated,承载 = 记忆账本,
// 无独立表;遗忘/纠正走账本通用路径)。claim 用机械可解析前缀格式:`热词:{term}->{canonical}`。
// ASR 偏置接线:biasTerms() 输出 provider 无关词表——消费点 = pipeline sauc 请求组装
// (07 D4 热词偏置;ASR key 解锁后 1.2 补完时映射具体请求字段)与 B1 topicTerms("会话累积热词",09 §5)。

import type { MemoryEvent } from "@saydo/contracts";
import type { MemoryLedger } from "./ledger.js";

const PREFIX = "热词:";
const SEP = "->";

export interface Hotword {
  term: string;
  canonical: string;
}

export class HotwordStore {
  private readonly ledger: MemoryLedger;

  constructor(ledger: MemoryLedger) {
    this.ledger = ledger;
  }

  /** 误听纠正写入(user_stated:用户亲口纠正;M0 跨项目,不挂 projectId) */
  add(term: string, canonical: string, sourceRef: string): MemoryEvent {
    const t = term.trim();
    const c = canonical.trim();
    if (t === "" || c === "") throw new Error("hotword term/canonical must be non-empty");
    if (t.includes(SEP) || c.includes(SEP)) throw new Error(`hotword must not contain "${SEP}"`);
    if (/[\r\n]/.test(t) || /[\r\n]/.test(c)) throw new Error("hotword must be single-line");
    return this.ledger.add({
      tier: "M0",
      claim: `${PREFIX}${t}${SEP}${c}`,
      source: { kind: "user_utterance", ref: sourceRef },
      requestedTrust: "user_stated"
    });
  }

  /** 当前生效热词(账本投影派生;forget/invalidate 即消失) */
  list(now?: string): Hotword[] {
    const out: Hotword[] = [];
    for (const m of this.ledger.project(now)) {
      if (m.tier !== "M0" || !m.claim.startsWith(PREFIX)) continue;
      const body = m.claim.slice(PREFIX.length);
      const i = body.indexOf(SEP);
      if (i <= 0) continue;
      out.push({ term: body.slice(0, i), canonical: body.slice(i + SEP.length) });
    }
    return out;
  }

  /**
   * ASR 偏置词表(provider 无关):canonical ∪ term ∪ 附加种子(如 B3 warmup seedTerms),
   * 去重字典序(确定性——进 topicTerms 会入 pack 签名域)。
   */
  biasTerms(extraSeeds: string[] = [], now?: string): string[] {
    const set = new Set<string>();
    for (const h of this.list(now)) {
      set.add(h.term);
      set.add(h.canonical);
    }
    for (const s of extraSeeds) {
      const t = s.trim();
      if (t !== "") set.add(t);
    }
    return [...set].sort();
  }
}
