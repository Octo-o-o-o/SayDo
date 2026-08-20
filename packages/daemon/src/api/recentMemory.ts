// GET /api/memory/recent —— 最近记忆投影(含 project_id 为空的 M2 全局条目)。
// 字段对齐 getProjectMemory,额外带 ts 供时间排序/呈现兜底;走账本 project() 不泄漏已失效行。

import type { Db } from "../storage/db.js";
import type { AuditSink } from "../obs/audit.js";
import { MemoryLedger } from "../memory/ledger.js";
import { listMemoryEvents } from "../storage/dao/memory.js";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

export function parseRecentMemoryLimit(raw: string | null): number {
  if (raw === null || raw === "") return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  const floor = Math.floor(n);
  if (floor < 1) return 1;
  if (floor > MAX_LIMIT) return MAX_LIMIT;
  return floor;
}

/** 全部 tier + 全部 project(含 null),按 ts 倒序;行形状对齐 getProjectMemory + ts。 */
export function getRecentMemory(db: Db, audit: AuditSink, limit = DEFAULT_LIMIT): Record<string, unknown>[] {
  const capped = typeof limit === "number" && Number.isFinite(limit) ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit))) : DEFAULT_LIMIT;
  const ledger = new MemoryLedger({ db, audit });
  const active = ledger.project();
  const tsById = new Map<string, string>();
  for (const e of listMemoryEvents(db)) {
    if ((e.op === "add" || e.op === "correct") && typeof e.ts === "string") {
      tsById.set(e.id, e.ts);
    }
  }
  // 行形状 = getProjectMemory 映射 + ts(排序与移动端时间兜底);不附带其它列
  return active
    .map((m) => ({
      id: m.id,
      tier: m.tier,
      claim: m.claim,
      trust: m.trust,
      source: m.source,
      taint: m.taint ?? [],
      expiresAt: m.expiresAt ?? null,
      ts: tsById.get(m.id) ?? null
    }))
    .sort((a, b) => {
      const ta = typeof a.ts === "string" ? a.ts : "";
      const tb = typeof b.ts === "string" ? b.ts : "";
      if (ta !== tb) return tb.localeCompare(ta);
      return String(b.id).localeCompare(String(a.id));
    })
    .slice(0, capped);
}
