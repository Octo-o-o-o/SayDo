// Context Pack live 传入(接线批任务③;HANDOFF §2-9-③"index.ts 调对话环未传 packText"回修):
// 每轮编译(B1 确定性编译器,memory/compiler.ts)-> renderPackText 注入对话档 system;
// topicTerms = 当轮 asr.final 分词 ∪ 热词偏置词表(09 §5);FTS 命中给 ftsScore(入选信号,不定序);
// 快照落盘 context_snapshots + uses(09 §9 拆表),session.context_digest 同步(重建一致性锚,1.3a)。

import { compileContext, renderPackText, type CompileFact } from "../memory/compiler.js";
import { recordContextSnapshotUse } from "../storage/dao/snapshots.js";
import { FoundationBuilder } from "../memory/foundation.js";
import type { MemoryLedger } from "../memory/ledger.js";
import type { HotwordStore } from "../memory/hotwords.js";
import type { Retrieval } from "../memory/retrieval.js";
import type { Db } from "../storage/db.js";
import { verifiedProjectWorkspace } from "../storage/dao/projects.js";

export interface LivePackDeps {
  db: Db;
  ledger: MemoryLedger;
  hotwords: HotwordStore;
  retrieval?: Retrieval;
  now?: () => Date;
}

/** 当轮分词(P0 机械口径):连续中文段/英文词,长度 >=2,去重(规范化在编译器内做) */
export function tokenizeUtterance(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/[\p{Script=Han}]+|[a-zA-Z][a-zA-Z0-9_-]+/gu)) {
    const t = m[0];
    if (t.length >= 2) out.add(t);
  }
  return [...out];
}

export interface LivePackResult {
  packText: string;
  packDigest: string;
}

/** B 级回修(批末终审):奠基代读失败时的 last-known 下限(per project,进程内)——
 *  防 IO 抖动把 gen 从 L+F 静默倒退到 L(签名域单调不变量,09 §0.1;重启后缓存空 = 诚实未知)。 */
const lastKnownFoundationGen = new Map<string, number>();

/**
 * W2 阶段 C · 记忆代合成(IMPL-5 §3-C 验收:重奠基 ⇒ generation+1 ⇒ 旧 pack 失效重编译):
 * memoryGeneration(09 §0.1 packDigest 签名域)的推进点有两个——forget_hard(09 §4,账本
 * MAX(generation))与重奠基(04 §1.2 原子切换,foundation current.json generation)。两个持久
 * 计数器都只增不减,取和单调递增:任一推进 ⇒ 签名域变 ⇒ 同输入不再复现旧 digest ⇒ 消费侧
 * (§0.1 verifier:失配重编译)必然重编译。读 current.json 每轮一次,cheap。
 */
export function effectiveMemoryGeneration(db: Db, ledger: MemoryLedger, projectId: string): number {
  let foundationGen = lastKnownFoundationGen.get(projectId) ?? 0;
  const workspace = verifiedProjectWorkspace(db, projectId);
  if (workspace) {
    // external workspace 先过 canonical identity 闸，再读取奠基代；不吞 identity 漂移。
    try {
      foundationGen = Math.max(foundationGen, new FoundationBuilder({ workspace }).currentGeneration());
      lastKnownFoundationGen.set(projectId, foundationGen);
    } catch {
      // 奠基指针 IO/JSON 抖动取 last-known，不把已知 generation 静默倒退。
    }
  }
  return ledger.currentGeneration() + foundationGen;
}

/**
 * 每轮编译并落盘;编译异常不阻断对话(pack 缺失 = 对话降级为无记忆注入,如实返回 null)。
 * parentPackDigest:同会话上一轮 digest(session 行 context_digest;前缀缓存红利,09 §5-⑥)。
 */
export function compileLivePack(
  deps: LivePackDeps,
  i: {
    sessionId: string;
    projectId: string;
    userText: string;
    rebuild?: boolean;
    expectedProjectRevision?: number;
  }
): LivePackResult | null {
  const nowIso = (deps.now ?? (() => new Date()))().toISOString();
  const projected = deps.ledger.project(nowIso);
  const facts: CompileFact[] = projected.filter((m) => m.projectId === undefined || m.projectId === i.projectId);
  const topicTerms = [...new Set([...tokenizeUtterance(i.userText), ...deps.hotwords.biasTerms()])];
  // FTS 命中给 ftsScore(规则④末位 tie-break;命不中不排除——预算内全量入选)
  if (deps.retrieval) {
    const scoreById = new Map<string, number>();
    for (const h of deps.retrieval.searchKnowledge(topicTerms, { now: nowIso })) scoreById.set(h.id, h.score);
    for (const f of facts) {
      const s = scoreById.get(f.id);
      if (s !== undefined) f.ftsScore = s;
    }
  }
  const parentRow = deps.db.prepare("SELECT context_digest FROM sessions WHERE id=?").get(i.sessionId) as
    | { context_digest: string | null }
    | undefined;
  const parent = parentRow?.context_digest ?? undefined;
  const snap = compileContext({
    sessionId: i.sessionId,
    projectId: i.projectId,
    facts,
    topicTerms,
    memoryGeneration: effectiveMemoryGeneration(deps.db, deps.ledger, i.projectId),
    now: nowIso,
    ...(parent !== undefined ? { parentPackDigest: parent } : {})
  });
  recordContextSnapshotUse(deps.db, snap, nowIso, { rebuild: i.rebuild ?? false });
  const updated =
    i.expectedProjectRevision === undefined
      ? deps.db.prepare("UPDATE sessions SET context_digest=? WHERE id=?").run(snap.packDigest, i.sessionId)
      : deps.db
          .prepare(
            "UPDATE sessions SET context_digest=? WHERE id=? AND project_id=? AND project_revision=?"
          )
          .run(snap.packDigest, i.sessionId, i.projectId, i.expectedProjectRevision);
  if (updated.changes !== 1) return null;
  const factsById = new Map(facts.map((f) => [f.id, f]));
  return { packText: renderPackText(snap, factsById), packDigest: snap.packDigest };
}
