// P0.5-E Demo 生成器(11 §7;02 §5):决策包 -> 自包含 HTML 小样("我做了个小样放屏幕上了",10 #10)。
// 纪律:token 同源(Soft Glass 变量内嵌);允许 display 衬线标题与更宽留白;
// 元素编号与 plan.seq 互引(口播"第 N 步"与画面对得上);零 emoji;成本 unknown 不显 0。

import type { DecisionPackage } from "@saydo/contracts";

/** 未签名草案(HTML 不含 digest,避免签名循环;类型级 Omit,不重定义 schema) */
export type DecisionPackageDraft = Omit<DecisionPackage, "digest">;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatCost(cost: DecisionPackageDraft["cost"]): string {
  const cap = `封顶 ${cost.max} 元`;
  if (!cost.expected.known) return `花费还没有确切数字,${cap}`;
  const value = cost.expected.value;
  return `预计 ${value ?? "?"} 元,${cap}`;
}

export function renderPackageDemoDraft(draft: DecisionPackageDraft): string {
  const cost = formatCost(draft.cost);
  const planRows = draft.plan
    .map(
      (p) => `
      <li class="step" data-seq="${p.seq}">
        <span class="seq">${p.seq}</span>
        <div><p class="step-title">${esc(p.step)}</p><p class="step-owner">${p.owner === "ai" ? "我来做" : "需要你配合"}</p></div>
      </li>`
    )
    .join("");
  const acceptance = draft.acceptance.map((a) => `<li>${esc(a)}</li>`).join("");
  const grants =
    draft.preauthorizedEffects.length > 0
      ? `<section class="card"><h2>出圈的事(要你先确认)</h2><ul>${draft.preauthorizedEffects.map((g) => `<li>${esc(g.spokenForm)}</li>`).join("")}</ul></section>`
      : "";
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SayDo Demo · ${esc(draft.outcomePreview)}</title>
<style>
  /* Soft Glass token 同源(docs/11 §2 快照;Demo 允许衬线标题/宽留白,§7) */
  :root{--bg-app:#edf0f6;--glow-a:rgba(122,156,224,.16);--glow-b:rgba(214,196,170,.14);
    --glass:rgba(255,255,255,.62);--glass-border:rgba(28,36,51,.09);--ink:#2b5fd9;--ink-fg:#fff;
    --text:#1c2433;--text-2:#46536a;--muted:#8792a6;--radius:18px;
    --serif:'Songti SC','Noto Serif SC',serif;--sans:'PingFang SC','Microsoft YaHei',sans-serif;--mono:ui-monospace,'SF Mono',monospace}
  @media(prefers-color-scheme:dark){:root{--bg-app:#12161f;--glass:rgba(26,32,45,.62);--glass-border:rgba(232,236,244,.09);
    --ink:#7aa5f7;--ink-fg:#0f1420;--text:#e8ecf4;--text-2:#a8b2c4;--muted:#6e7a90}}
  *{box-sizing:border-box}body{margin:0;background:var(--bg-app);color:var(--text);font-family:var(--sans);line-height:1.8}
  .atmo{position:fixed;inset:0;z-index:-1;background:radial-gradient(52% 42% at 12% 8%,var(--glow-a),transparent 68%),radial-gradient(46% 40% at 88% 92%,var(--glow-b),transparent 70%)}
  main{max-width:760px;margin:0 auto;padding:72px 24px}
  h1{font-family:var(--serif);font-size:34px;font-weight:700;margin:0 0 8px}
  .lede{color:var(--text-2);margin:0 0 48px;font-size:16px}
  .card{background:var(--glass);border:1px solid var(--glass-border);border-radius:var(--radius);
    padding:24px;margin-bottom:24px;backdrop-filter:blur(18px) saturate(1.4)}
  h2{font-size:16px;margin:0 0 12px}
  ul{margin:0;padding-left:20px}li{margin:6px 0}
  .steps{list-style:none;padding:0;margin:0}
  .step{display:flex;gap:14px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--glass-border)}
  .step:first-child{border-top:none}
  .seq{flex-shrink:0;width:28px;height:28px;border-radius:999px;background:var(--ink);color:var(--ink-fg);
    display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:13px}
  .step-title{margin:2px 0 0;font-weight:600}.step-owner{margin:2px 0 0;font-size:13px;color:var(--muted)}
  .meta{font-family:var(--mono);font-size:12px;color:var(--muted)}
  .cost{font-size:15px;color:var(--text-2)}
</style></head><body>
<div class="atmo"></div>
<main>
  <h1>${esc(draft.outcomePreview)}</h1>
  <p class="lede">这是开工前的小样:做完你会得到什么、分几步、花多少。口播里的"第 N 步"就是下面的编号。</p>
  <section class="card"><h2>分几步(与口播 plan.seq 互引)</h2><ol class="steps">${planRows}</ol></section>
  <section class="card"><h2>验收标准(做完逐条对)</h2><ul>${acceptance}</ul></section>
  ${grants}
  <section class="card"><h2>花费</h2><p class="cost">${esc(cost)}</p></section>
  <p class="meta">package ${esc(draft.id)} · rev ${draft.revision} · 由 SayDo 生成</p>
</main>
</body></html>`;
}

export function renderPackageDemo(pkg: DecisionPackage): string {
  return renderPackageDemoDraft(pkg);
}
