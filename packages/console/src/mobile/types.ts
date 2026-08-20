import type {
  AttentionColor as ContractAttentionColor,
  AttentionItem as ContractAttentionItem,
  FocusFourStateCounts,
  MobileFocusDetail,
  MobileFocusListItem,
  MobileObligation as ContractMobileObligation
} from "@saydo/contracts";

export type AttentionColor = ContractAttentionColor;
export type CardKind = "confirmation" | "obligation" | "task" | "expectation" | "memory_candidate";
export type AttentionItem = ContractAttentionItem;
export type FocusRow = MobileFocusListItem;
export type FourStateCounts = FocusFourStateCounts;
export type MobileObligation = ContractMobileObligation;
export type FocusDetailPayload = MobileFocusDetail;

/** M1 本地导航适配引用；带 revision/digest 的 durable CardRef 属 M2 daemon 端点。 */
export interface MobileCardRef {
  kind: CardKind;
  entityId: string;
  focusId?: string;
  laneId?: string;
}
