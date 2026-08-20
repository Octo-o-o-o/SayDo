import type { AttentionItem, CardKind, MobileCardRef } from "./types";

export type CardAllowedAction = "decide" | "withdraw" | "open" | "open_lane";

export type CardResolution =
  | { state: "live"; ref: MobileCardRef; item: AttentionItem; allowedActions: CardAllowedAction[] }
  | { state: "resolved"; ref: MobileCardRef; allowedActions: CardAllowedAction[] }
  | { state: "expired"; ref: MobileCardRef; expiresAt: string; allowedActions: CardAllowedAction[] }
  | { state: "stale"; ref: MobileCardRef; cached: AttentionItem; allowedActions: CardAllowedAction[] }
  | { state: "missing"; ref: MobileCardRef; allowedActions: [] };

export interface CardSnapshot {
  status?: string;
}

const TERMINAL_STATUSES = new Set(["resolved", "superseded", "task_done", "cancel_settled"]);

export function attentionKind(item: AttentionItem): CardKind {
  if (item.sourceKind) return item.sourceKind;
  if (item.id.startsWith("conf:")) return "confirmation";
  if (item.id.startsWith("ob:")) return "obligation";
  return "task";
}

export function attentionRef(item: AttentionItem): MobileCardRef {
  return {
    kind: attentionKind(item),
    entityId: item.refId ?? item.id.replace(/^[^:]+:/, ""),
    ...(item.focusId ? { focusId: item.focusId } : {}),
    ...(item.laneId ? { laneId: item.laneId } : {})
  };
}

export function resolveCard(input: {
  ref: MobileCardRef;
  attention: readonly AttentionItem[];
  cached?: AttentionItem;
  snapshot?: CardSnapshot;
  nowMs?: number;
}): CardResolution {
  const { ref, cached, snapshot } = input;
  const nowMs = input.nowMs ?? Date.now();
  const laneActions: CardAllowedAction[] = ref.focusId || cached?.focusId ? ["open_lane"] : [];
  if (snapshot?.status && TERMINAL_STATUSES.has(snapshot.status)) {
    return { state: "resolved", ref, allowedActions: laneActions };
  }
  const item = input.attention.find(
    (candidate) => attentionKind(candidate) === ref.kind && attentionRef(candidate).entityId === ref.entityId
  );
  if (item) {
    if (item.expiresAt && Date.parse(item.expiresAt) <= nowMs) {
      return {
        state: "expired",
        ref,
        expiresAt: item.expiresAt,
        allowedActions: item.focusId ? ["open_lane"] : []
      };
    }
    return {
      state: "live",
      ref,
      item,
      allowedActions: ref.kind === "confirmation" ? ["decide", "withdraw"] : ["open"]
    };
  }
  if (cached && snapshot?.status) {
    return { state: "live", ref, item: cached, allowedActions: ["open"] };
  }
  if (cached) {
    if (cached.expiresAt && Date.parse(cached.expiresAt) <= nowMs) {
      return { state: "expired", ref, expiresAt: cached.expiresAt, allowedActions: laneActions };
    }
    return { state: "stale", ref, cached, allowedActions: laneActions };
  }
  return { state: "missing", ref, allowedActions: [] };
}

export function cacheCard(item: AttentionItem): void {
  const ref = attentionRef(item);
  sessionStorage.setItem(`saydo.mobile.card:${ref.kind}:${ref.entityId}`, JSON.stringify(item));
}

export function readCachedCard(ref: MobileCardRef): AttentionItem | undefined {
  const raw = sessionStorage.getItem(`saydo.mobile.card:${ref.kind}:${ref.entityId}`);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as AttentionItem;
  } catch {
    return undefined;
  }
}
