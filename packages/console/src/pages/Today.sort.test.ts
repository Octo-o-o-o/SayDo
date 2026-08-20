// 橙区二次排序:ready_for_review > 确认卡 > blocked > 其余义务 > updatedAt 倒序
import { describe, expect, it } from "vitest";
import { sortOrange, type AttentionItem } from "./Today";

function item(partial: Partial<AttentionItem> & Pick<AttentionItem, "id" | "title">): AttentionItem {
  return {
    color: "orange",
    focusId: null,
    focusTitle: null,
    action: "open_task_modal",
    updatedAt: "2026-08-08T10:00:00.000Z",
    ...partial
  };
}

describe("sortOrange", () => {
  it("按 ready_for_review > 确认卡 > blocked > 义务 > 时间倒序", () => {
    const items: AttentionItem[] = [
      item({ id: "ob:1", title: "普通义务", sourceKind: "obligation", updatedAt: "2026-08-08T12:00:00.000Z" }),
      item({ id: "ob:2", title: "前置已终止:依赖", sourceKind: "obligation", updatedAt: "2026-08-08T11:00:00.000Z" }),
      item({
        id: "conf:1",
        title: "确认一下",
        sourceKind: "confirmation",
        action: "open_confirm",
        updatedAt: "2026-08-08T09:00:00.000Z"
      }),
      item({ id: "task:1", title: "验收", sourceKind: "task", updatedAt: "2026-08-08T08:00:00.000Z" }),
      item({ id: "ob:3", title: "更早的义务", sourceKind: "obligation", updatedAt: "2026-08-08T07:00:00.000Z" })
    ];
    const sorted = sortOrange(items).map((i) => i.id);
    expect(sorted).toEqual(["task:1", "conf:1", "ob:2", "ob:1", "ob:3"]);
  });
});
