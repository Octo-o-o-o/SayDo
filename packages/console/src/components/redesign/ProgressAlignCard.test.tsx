import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProgressAlignCard } from "./ProgressAlignCard";
import { expectationFixtures } from "./ProgressAlignCard.fixture";

const known = expectationFixtures[0]!.expectation;

function progressWidths(html: string): string[] {
  return [...html.matchAll(/width:([0-9.]+%)/g)].map((m) => m[1]!);
}

describe("ProgressAlignCard 预算轨道", () => {
  it("unknown budget 保留文案且不渲染 0% ProgressTrack", () => {
    const html = renderToStaticMarkup(
      <ProgressAlignCard expectation={{ ...known, budget: { known: false } }} />
    );
    expect(html).toContain("还没有确切数字");
    expect(html).not.toMatch(/width:\s*0%/);
    expect(html).not.toContain("¥0");
    expect(progressWidths(html)).toEqual(["75%", "50%"]);
  });

  it("known budget 仍显示进度轨道", () => {
    const html = renderToStaticMarkup(<ProgressAlignCard expectation={known} />);
    expect(html).toContain("¥14.5 / ¥25");
    expect(html).not.toContain("还没有确切数字");
    const widths = progressWidths(html);
    expect(widths).toHaveLength(3);
    expect(widths[0]).toBe("75%");
    expect(widths[1]).toBe("50%");
    expect(Number.parseFloat(widths[2]!)).toBeCloseTo(58, 5);
  });
});
