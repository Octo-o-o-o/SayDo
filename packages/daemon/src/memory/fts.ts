// memory_fts 投影同步(09 §4:普通 FTS5 表,删除用标准 SQL DELETE;非 external-content)。
// FTS 是派生投影(可从账本全量重建):插入记 rowid,forget_hard 按 mem_id 映射删除。
// mem_id<->rowid 双向映射维护在内存(重建时重建),不改 09 §9 DDL(memory_fts 只有 claim 列)。

import type { Db } from "../storage/db.js";
import type { ProjectedMemory } from "./ledger.js";

export interface FtsHit {
  memId: string;
  claim: string;
  /** bm25 原始分(越小越相关;FTS5 rank 同义)。B5 转相关度信号给 B1 时取负。 */
  score: number;
}

export class MemoryFts {
  private readonly db: Db;
  private readonly rowidOf = new Map<string, number>(); // mem_id -> fts rowid
  private readonly memIdOf = new Map<number, string>(); // fts rowid -> mem_id

  constructor(db: Db) {
    this.db = db;
  }

  /** 全量重建 FTS(从投影;投影可全量重放再生的一环) */
  rebuild(memories: ProjectedMemory[]): void {
    this.db.prepare("DELETE FROM memory_fts").run();
    this.rowidOf.clear();
    this.memIdOf.clear();
    const stmt = this.db.prepare("INSERT INTO memory_fts(claim) VALUES (?)");
    for (const m of memories) {
      const info = stmt.run(m.claim);
      const rowid = Number(info.lastInsertRowid);
      this.rowidOf.set(m.id, rowid);
      this.memIdOf.set(rowid, m.id);
    }
  }

  insert(memId: string, claim: string): void {
    const info = this.db.prepare("INSERT INTO memory_fts(claim) VALUES (?)").run(claim);
    const rowid = Number(info.lastInsertRowid);
    this.rowidOf.set(memId, rowid);
    this.memIdOf.set(rowid, memId);
  }

  /** forget_hard 清除(标准 DELETE WHERE rowid;幂等——目标不存在则无操作) */
  deleteByIds(memIds: string[]): number {
    let deleted = 0;
    const stmt = this.db.prepare("DELETE FROM memory_fts WHERE rowid = ?");
    for (const id of memIds) {
      const rowid = this.rowidOf.get(id);
      if (rowid === undefined) continue; // 幂等:已删/不存在
      const r = stmt.run(rowid);
      deleted += r.changes;
      this.rowidOf.delete(id);
      this.memIdOf.delete(rowid);
    }
    return deleted;
  }

  /** BM25 检索(B5 消费;MATCH 语法组装与转义在 retrieval 层) */
  search(matchQuery: string, limit = 20): FtsHit[] {
    const rows = this.db
      .prepare(
        "SELECT rowid, claim, bm25(memory_fts) AS score FROM memory_fts WHERE memory_fts MATCH ? ORDER BY score LIMIT ?"
      )
      .all(matchQuery, limit) as { rowid: number; claim: string; score: number }[];
    const hits: FtsHit[] = [];
    for (const r of rows) {
      const memId = this.memIdOf.get(r.rowid);
      if (memId === undefined) continue; // 映射外的孤行(理论不发生):不回给上层
      hits.push({ memId, claim: r.claim, score: r.score });
    }
    return hits;
  }

  count(): number {
    return (this.db.prepare("SELECT COUNT(*) AS c FROM memory_fts").get() as { c: number }).c;
  }
}
