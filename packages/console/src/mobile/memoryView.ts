/** 记忆库移动呈现:来源人话 + ULID 近似时间(与桌面 Memory 同源字段)。 */

import type { MobileMemoryRow } from "./data";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const SOURCE_LABEL: Record<string, string> = {
  user_utterance: "你说过",
  user_edit: "你改过",
  repo_file: "仓库",
  web: "网页",
  artifact: "产物",
  agent_output: "执行结果",
  import: "导入"
};

export function memorySourceLabel(kind: string): string {
  return SOURCE_LABEL[kind] ?? kind;
}

/** 从 mem_<ULID> 解时间;解不出则 null。 */
export function memoryTimeFromId(id: string): Date | null {
  const m = /_([0-9A-HJKMNP-TV-Z]{26})$/iu.exec(id);
  if (!m) return null;
  const timePart = m[1]!.slice(0, 10).toUpperCase();
  let ts = 0;
  for (const ch of timePart) {
    const v = CROCKFORD.indexOf(ch);
    if (v < 0) return null;
    ts = ts * 32 + v;
  }
  if (!Number.isFinite(ts) || ts <= 0) return null;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatMemoryTime(id: string, now = new Date(), tsFallback?: string | null): string {
  const d = memoryTimeFromId(id) ?? (tsFallback ? new Date(tsFallback) : null);
  if (!d || Number.isNaN(d.getTime())) return "时间未知";
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 60_000) return "刚刚";
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} 分钟前`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)} 小时前`;
  if (diffMs < 7 * 86_400_000) return `${Math.floor(diffMs / 86_400_000)} 天前`;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

export function memoryRowView(row: MobileMemoryRow, now = new Date()): {
  title: string;
  time: string;
  source: string;
  tier: string;
} {
  return {
    title: row.claim,
    time: formatMemoryTime(row.id, now, row.ts),
    source: memorySourceLabel(row.source.kind),
    tier: row.tier
  };
}

/** 从 focuses.projectRefs + 可选 seed 收集项目 id。 */
export function collectMemoryProjectIds(
  focuses: readonly { projectRefs?: readonly string[] }[] | null | undefined,
  extra: readonly (string | null | undefined)[] = []
): string[] {
  const ids = new Set<string>();
  for (const f of focuses ?? []) {
    for (const p of f.projectRefs ?? []) {
      if (p) ids.add(p);
    }
  }
  for (const p of extra) {
    if (p) ids.add(p);
  }
  return [...ids];
}
