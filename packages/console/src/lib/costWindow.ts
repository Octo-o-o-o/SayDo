export type CostEntriesWindow = {
  limit: number;
  returned: number;
  total: number;
  truncated: boolean;
};

export type CostByProject = {
  projectId: string | null;
  projectTitle: string | null;
  knownByCurrency: Record<string, number>;
  unknownCount: number;
};

/** 「全部」合计只认 byProject 全账本聚合,不得把 300 窗 entries 再加总冒充。 */
export function authoritativeAllTotals(byProject: CostByProject[]): {
  knownByCurrency: Record<string, number>;
  unknownCount: number;
  projectCount: number;
} {
  const knownByCurrency: Record<string, number> = {};
  let unknownCount = 0;
  for (const p of byProject) {
    for (const [cur, amt] of Object.entries(p.knownByCurrency ?? {})) {
      knownByCurrency[cur] = (knownByCurrency[cur] ?? 0) + Number(amt);
    }
    unknownCount += Number(p.unknownCount ?? 0);
  }
  return { knownByCurrency, unknownCount, projectCount: byProject.length };
}

export function normalizeEntriesWindow(
  raw: CostEntriesWindow | undefined,
  entriesLength: number
): CostEntriesWindow {
  const limit = raw?.limit ?? 300;
  const returned = raw?.returned ?? entriesLength;
  const total = raw?.total ?? entriesLength;
  return {
    limit,
    returned,
    total,
    truncated: raw?.truncated ?? total > limit
  };
}

export function costWindowLabel(window: CostEntriesWindow): string {
  return window.truncated
    ? `明细窗口 最近 ${window.returned}/${window.total} 笔(上限 ${window.limit})`
    : `明细窗口 ${window.returned} 笔(上限 ${window.limit})`;
}

export function costExportFilename(opts: { group: string; window: CostEntriesWindow; now?: number }): string {
  const stamp = opts.now ?? Date.now();
  return `saydo-costs-${opts.group}-window-${opts.window.returned}-of-${opts.window.total}-${stamp}.csv`;
}

export function costExportHeader(window: CostEntriesWindow): string {
  return `# ${costWindowLabel(window)}`;
}
