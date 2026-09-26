import { describe, expect, it } from "vitest";
import {
  authoritativeAllTotals,
  costExportFilename,
  costExportHeader,
  costWindowLabel,
  normalizeEntriesWindow
} from "./costWindow";

describe("authoritativeAllTotals", () => {
  it("全部合计只加总 byProject 全账本,不读 entries 窗口", () => {
    const totals = authoritativeAllTotals([
      { projectId: "prj_a", projectTitle: "A", knownByCurrency: { CNY: 10, USD: 2 }, unknownCount: 1 },
      { projectId: "prj_b", projectTitle: "B", knownByCurrency: { CNY: 5 }, unknownCount: 3 }
    ]);
    expect(totals).toEqual({
      knownByCurrency: { CNY: 15, USD: 2 },
      unknownCount: 4,
      projectCount: 2
    });
  });
});

describe("entries 300 窗口", () => {
  it("缺字段时按 entries 长度兜底,超限标 truncated", () => {
    expect(normalizeEntriesWindow(undefined, 12)).toEqual({
      limit: 300,
      returned: 12,
      total: 12,
      truncated: false
    });
    expect(
      normalizeEntriesWindow({ limit: 300, returned: 300, total: 401, truncated: true }, 300)
    ).toMatchObject({ truncated: true, total: 401, returned: 300 });
  });

  it("文案与导出文件名标窗口", () => {
    const window = { limit: 300, returned: 300, total: 401, truncated: true };
    expect(costWindowLabel(window)).toContain("300/401");
    expect(costWindowLabel(window)).toContain("上限 300");
    expect(costExportHeader(window)).toContain("明细窗口");
    expect(costExportFilename({ group: "project", window, now: 1 })).toBe(
      "saydo-costs-project-window-300-of-401-1.csv"
    );
  });
});
