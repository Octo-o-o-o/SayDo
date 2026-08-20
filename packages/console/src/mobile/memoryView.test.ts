import { describe, expect, it } from "vitest";
import {
  collectMemoryProjectIds,
  formatMemoryTime,
  memoryRowView,
  memorySourceLabel,
  memoryTimeFromId
} from "./memoryView";

describe("记忆库移动呈现", () => {
  it("来源人话与 project id 收集", () => {
    expect(memorySourceLabel("user_utterance")).toBe("你说过");
    expect(memorySourceLabel("repo_file")).toBe("仓库");
    expect(
      collectMemoryProjectIds([{ projectRefs: ["prj_a", "prj_b"] }, { projectRefs: ["prj_a"] }], ["prj_c", null])
    ).toEqual(["prj_a", "prj_b", "prj_c"]);
  });

  it("ULID 时间与行视图", () => {
    // 01ARZ3NDEK = 2016-07-30 附近(固定样例)
    const id = "mem_01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const d = memoryTimeFromId(id);
    expect(d).toBeInstanceOf(Date);
    expect(d!.getUTCFullYear()).toBe(2016);
    const view = memoryRowView(
      {
        id,
        tier: "M1",
        claim: "导出用 CSV",
        trust: "user_stated",
        source: { kind: "user_utterance" }
      },
      new Date("2026-08-12T00:00:00.000Z")
    );
    expect(view.title).toBe("导出用 CSV");
    expect(view.source).toBe("你说过");
    expect(view.time).toMatch(/^2016-07-\d{2}$|天前|小时前/);
    expect(formatMemoryTime("mem_bad", new Date())).toBe("时间未知");
    // id 非 ULID 时用 ts 字段兜底
    expect(formatMemoryTime("mem_bad", new Date("2026-08-12T00:00:30.000Z"), "2026-08-12T00:00:00.000Z")).toBe(
      "刚刚"
    );
    const m2View = memoryRowView(
      {
        id: "not-a-ulid",
        tier: "M2",
        claim: "全局随口记",
        trust: "user_stated",
        source: { kind: "user_utterance" },
        ts: "2026-08-12T00:00:00.000Z"
      },
      new Date("2026-08-12T00:00:30.000Z")
    );
    expect(m2View.time).toBe("刚刚");
    expect(m2View.tier).toBe("M2");
  });
});
