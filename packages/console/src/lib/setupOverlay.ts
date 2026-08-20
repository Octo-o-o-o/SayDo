import type { WizardSlot } from "./setupApi";

export type FusionOverlay =
  | { type: "none" }
  | { type: "model"; slot: WizardSlot }
  | { type: "house"; slot: WizardSlot };

export const FUSION_OVERLAY_NONE: FusionOverlay = { type: "none" };

/** 打开任一浮层即替换当前浮层,同刻至多一个。 */
export function openFusionOverlay(
  _current: FusionOverlay,
  next: Exclude<FusionOverlay, { type: "none" }>
): FusionOverlay {
  return next;
}

export function closeFusionOverlay(): FusionOverlay {
  return FUSION_OVERLAY_NONE;
}

export function overlayModelSlot(overlay: FusionOverlay): WizardSlot | null {
  return overlay.type === "model" ? overlay.slot : null;
}

export function overlayHouseSlot(overlay: FusionOverlay): WizardSlot | null {
  return overlay.type === "house" ? overlay.slot : null;
}

export function setModelOverlay(open: boolean, slot: WizardSlot): FusionOverlay {
  return open ? { type: "model", slot } : FUSION_OVERLAY_NONE;
}

/** 点击是否落在浮层或其触发器外(点外关闭)。 */
export function isOutsideFusionOverlay(target: EventTarget | null, roots: Array<Element | null>): boolean {
  if (!(target instanceof Node)) return true;
  return roots.every((root) => root == null || !root.contains(target));
}
