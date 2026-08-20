// P0.5-E Demo 生成器验收:plan.seq 互引/验收列表/成本 unknown 纪律/零 emoji/token 同源。

import { describe, expect, it } from "vitest";
import { computePackageDigest, type DecisionPackage } from "@saydo/contracts";
import { renderPackageDemo, renderPackageDemoDraft, type DecisionPackageDraft } from "../src/demo/generator.js";

function mkPkg(): DecisionPackage {
  const body = {
    id: "pkg_01AAAAAAAAAAAAAAAAAAAAAAAA",
    revision: 2,
    projectId: "prj_01AAAAAAAAAAAAAAAAAAAAAAAA",
    outcomePreview: "报表页导出 CSV",
    inScope: ["导出"],
    outOfScope: [],
    assumptions: [],
    acceptance: ["导出按钮可用", "Excel 打开无乱码"],
    plan: [
      { seq: 1, step: "改导出模块", owner: "ai" as const },
      { seq: 2, step: "跑数据库迁移", owner: "human" as const }
    ],
    cost: { expected: { known: false as const }, p95: { known: false as const }, max: 20, currency: "CNY" as const },
    risks: [],
    mode: "step_confirm" as const,
    preauthorizedEffects: [],
    effectPolicyVersion: "e2/0.1.0"
  };
  return { ...body, digest: computePackageDigest(body), status: "proposed", expiresAt: "2026-08-01T00:00:00.000Z", createdAt: "2026-07-25T08:00:00.000Z" };
}

describe("P0.5-E Demo 生成器", () => {
  it("plan.seq 互引(data-seq + 编号圆点);验收逐条;需要你配合的步标注", () => {
    const html = renderPackageDemo(mkPkg());
    expect(html).toContain('data-seq="1"');
    expect(html).toContain('data-seq="2"');
    expect(html).toContain("plan.seq 互引");
    expect(html).toContain("导出按钮可用");
    expect(html).toContain("需要你配合");
  });

  it("成本 unknown 纪律:不显 0,说还没有确切数字 + 封顶", () => {
    const html = renderPackageDemo(mkPkg());
    expect(html).toContain("还没有确切数字");
    expect(html).toContain("封顶 20 元");
    expect(html).not.toMatch(/预计 0 元/);
  });

  it("零 emoji + XSS 转义 + token 同源(Soft Glass 变量)", () => {
    const pkg = mkPkg();
    const evil = { ...pkg, outcomePreview: '<script>alert(1)</script>报表' };
    const html = renderPackageDemo(evil as DecisionPackage);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(html)).toBe(false);
    expect(html).toContain("--glass-border");
    expect(html).toContain("Songti SC"); // display 衬线标题(11 §7 允许)
  });

  it("known:true 时显示真实 value(读 Money.value,不读 amount)", () => {
    const pkg = mkPkg();
    const priced: DecisionPackage = {
      ...pkg,
      cost: {
        expected: { known: true, value: 8.5, currency: "CNY", asOf: "2026-07-25T08:00:00.000Z" },
        p95: { known: true, value: 12, currency: "CNY", asOf: "2026-07-25T08:00:00.000Z" },
        max: 20,
        currency: "CNY"
      }
    };
    const html = renderPackageDemo(priced);
    expect(html).toContain("预计 8.5 元");
    expect(html).toContain("封顶 20 元");
    expect(html).not.toContain("还没有确切数字");
  });

  it("HTML 不含 digest 子串(避免签名循环)", () => {
    const html = renderPackageDemo(mkPkg());
    expect(html.toLowerCase()).not.toContain("digest");
  });

  it("draft 与签名后 pkg 渲染结果相同", () => {
    const pkg = mkPkg();
    const { digest: _digest, ...rest } = pkg;
    const draft: DecisionPackageDraft = rest;
    expect(renderPackageDemoDraft(draft)).toBe(renderPackageDemo(pkg));
  });
});
