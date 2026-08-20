// C1 TaskCardRenderer(P0.5-B;输入=research/hopper-integration-appendix.md §1):
// DecisionPackage -> Hopper 任务卡 markdown。硬约束:
// - 验收段 = 词表标题(固定「## 验收标准」)+ 其下 "-" bullet(一条一断言);
// - 空洞判据(测试通过/完成/ok...)不渲染——SayDo 侧先改写为具体断言,否则拒渲染(防 triage blocked);
// - 末行 dispatch 注释 = 幂等载体(授权变 => 正文 hash 变);
// - frontmatter id 单路径段(ULID 小写化);x_saydo 携 dispatch/package 溯源。

import { buildDispatchComment, type DecisionPackage } from "@saydo/contracts";

/** 空洞判据词表(附录 §1.4;命中即无效 bullet) */
const HOLLOW_RE = /^(?:测试通过|完成|同上|ok|done|没问题|pass(?:ed)?|通过)\s*$/i;

export function isHollowAcceptance(text: string): boolean {
  return HOLLOW_RE.test(text.trim());
}

export interface RenderInput {
  pkg: DecisionPackage;
  dispatchId: string;
  hopperProject: string;
  /** saydo 生成的任务 id(单路径段,ULID 小写化) */
  saydoTaskId: string;
}

export type RenderResult = { ok: true; markdown: string } | { ok: false; reason: string; hollow: string[] };

export function renderTaskCard(i: RenderInput): RenderResult {
  const acceptance = i.pkg.acceptance;
  if (acceptance.length === 0) return { ok: false, reason: "决策包无验收标准(triage 必 blocked),回对话补料", hollow: [] };
  const hollow = acceptance.filter((a) => isHollowAcceptance(a));
  if (hollow.length > 0) {
    return { ok: false, reason: "验收标准含空洞判据,须先改写为具体断言(附录 §1.4)", hollow };
  }
  const fm = [
    "---",
    `id: saydo-${i.saydoTaskId.replace(/^tsk_/, "").toLowerCase()}`,
    `project: ${i.hopperProject}`,
    "runner: auto",
    "x_saydo:",
    `  dispatch_id: ${i.dispatchId}`,
    `  package_id: ${i.pkg.id}`,
    `  package_revision: ${i.pkg.revision}`,
    `  package_digest: "${i.pkg.digest}"`,
    `  mode: ${i.pkg.mode === "direct_to_review" ? "direct_to_review" : "step_confirm"}`,
    "---"
  ].join("\n");
  const body = [
    `# ${i.pkg.outcomePreview}`,
    "",
    "## 背景与目标",
    "",
    i.pkg.outcomePreview,
    "",
    "## 约束",
    "",
    ...i.pkg.outOfScope.map((x) => `- 不做:${x}`),
    ...i.pkg.inScope.map((x) => `- 范围内:${x}`),
    "",
    "## 验收标准", // 词表标题(headings.ts:"验收标准" 在表;固定形态最不易出错)
    "",
    ...acceptance.map((a) => `- ${a}`),
    "",
    buildDispatchComment(i.dispatchId, i.pkg.revision, i.pkg.digest)
  ].join("\n");
  return { ok: true, markdown: `${fm}\n${body}\n` };
}

/** 附录 §1.2 标题行判定(自测用:渲染产物必须命中) */
export function hasAcceptanceHeading(markdown: string): boolean {
  const words = ["验收标准", "完成定义", "acceptance criteria", "acceptance", "definition of done", "success criteria", "done when"];
  const re = new RegExp(`^#{1,6}\\s*(?:${words.join("|")})(?:\\s|$|[:：-])`, "im");
  return re.test(markdown);
}
