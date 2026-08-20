import type { DesktopSummaryV1 } from "@saydo/contracts";
import type { Db } from "../storage/db.js";
import type { SaydoConfig } from "../config/types.js";
import { inDndWindow } from "../recovery/reconciler.js";
import { getAttention } from "./attention.js";
import { classifyActiveWork } from "../tier1/activeWorkClassifier.js";

export function getDesktopSummary(
  db: Db,
  config: SaydoConfig | null,
  byoaUnrecoverableCalls: number,
  nowHm = new Date().toTimeString().slice(0, 5),
  recoverableTier1Override?: number
): DesktopSummaryV1 {
  // B5: summary 与 prepare/recover/stopped 同源 classifier。
  const classified = classifyActiveWork(db, byoaUnrecoverableCalls, {
    requireNativeForGracefulRunning: true
  });
  const recoverableTier1 = recoverableTier1Override ?? classified.recoverableTier1;
  const unrecoverableCalls = classified.unrecoverableTier1 + byoaUnrecoverableCalls;
  const attention = { orange: 0, blue: 0, green: 0, gray: 0 };
  for (const item of getAttention(db).items) attention[item.color] += 1;
  const rawWindow = (config?.dnd as Record<string, unknown> | undefined)?.["window"];
  const window = typeof rawWindow === "string" && rawWindow !== "" ? rawWindow : null;
  return {
    version: 1,
    activeWork: {
      total: recoverableTier1 + unrecoverableCalls,
      recoverableTier1,
      unrecoverableCalls
    },
    dnd: {
      enabled: window !== null,
      active: window !== null && inDndWindow(nowHm, window),
      window
    },
    attention
  };
}
