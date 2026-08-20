// Demo 生成器样例输出(P0.5-E 自测/owner 预览):tsx scripts/demo-sample.ts [outPath]
import { writeFileSync } from "node:fs";
import { computePackageDigest, type DecisionPackage } from "@saydo/contracts";
import { renderPackageDemo } from "../src/demo/generator.js";

const body = {
  id: "pkg_01AAAAAAAAAAAAAAAAAAAAAAAA",
  revision: 2,
  projectId: "prj_01AAAAAAAAAAAAAAAAAAAAAAAA",
  outcomePreview: "报表页导出 CSV",
  inScope: ["导出"],
  outOfScope: [],
  assumptions: [],
  acceptance: ["导出按钮可用", "Excel 打开无乱码", "空结果给提示"],
  plan: [
    { seq: 1, step: "改导出模块", owner: "ai" as const },
    { seq: 2, step: "跑数据库迁移", owner: "human" as const },
    { seq: 3, step: "补单元测试", owner: "ai" as const }
  ],
  cost: { expected: { known: false as const }, p95: { known: false as const }, max: 20, currency: "CNY" as const },
  risks: [],
  mode: "step_confirm" as const,
  preauthorizedEffects: [],
  effectPolicyVersion: "e2/0.1.0"
};
const pkg: DecisionPackage = {
  ...body,
  digest: computePackageDigest(body),
  status: "proposed",
  expiresAt: "2026-08-01T00:00:00.000Z",
  createdAt: "2026-07-25T08:00:00.000Z"
};
const out = process.argv[2] ?? "/tmp/saydo-demo.html";
writeFileSync(out, renderPackageDemo(pkg));
console.log(`demo written: ${out}`);
