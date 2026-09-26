// 侧栏四路读取的合并规则(11 §0 诚实优先):失败保留最近成功数据,首次失败不呈现确定 0。

export const SIDEBAR_READ_UNAVAILABLE = "读取暂不可用";

export type SidebarLane<T> = {
  value: T;
  failed: boolean;
  settled: boolean;
};

export type SidebarRead<T> = { ok: true; value: T } | { ok: false };

export function emptySidebarLane<T>(value: T): SidebarLane<T> {
  return { value, failed: false, settled: false };
}

export function applySidebarRead<T>(prev: SidebarLane<T>, read: SidebarRead<T>): SidebarLane<T> {
  if (read.ok) return { value: read.value, failed: false, settled: true };
  return { value: prev.value, failed: true, settled: prev.settled };
}

export async function readSidebarLane<T>(load: () => Promise<T>): Promise<SidebarRead<T>> {
  try {
    return { ok: true, value: await load() };
  } catch {
    return { ok: false };
  }
}

export const SIDEBAR_LIVE_LIFECYCLES = ["active", "captured", "dormant"] as const;

export function sidebarLiveFocuses<T extends { lifecycle: string }>(rows: readonly T[]): T[] {
  return rows.filter((row) => (SIDEBAR_LIVE_LIFECYCLES as readonly string[]).includes(row.lifecycle));
}

export function sidebarHasReadError(...lanes: Array<Pick<SidebarLane<unknown>, "failed">>): boolean {
  return lanes.some((lane) => lane.failed);
}

export function sidebarVisibleCount(lane: Pick<SidebarLane<unknown>, "failed" | "settled">, count: number): number | undefined {
  if (lane.failed && !lane.settled) return undefined;
  return count;
}

export function sidebarShowEmpty(lane: SidebarLane<{ length: number }>, visibleCount = lane.value.length): boolean {
  return visibleCount === 0 && !(lane.failed && !lane.settled);
}
