// ProgressAlignCard(demo progressHtml):期待 vs 现实主动对账(对齐是 AI 的义务,不是用户的查询——11 §0.1-4)。
// 数据由 props 传入;不发明置信度数字,只有账上事实(标准 X/Y、产物 X/Y、预算 已花/熔断、下一步在谁)。

import { Flag } from "lucide-react";
import { card, ProgressTrack } from "./shared";
import type { ExpectationView } from "./types";

export function ProgressAlignCard({ expectation, nextStepText, pkgSteps }: {
  expectation?: ExpectationView;
  /** 下一步在谁手里(一句话,账本推导,不写臆测) */
  nextStepText?: string;
  /** 决策包步进(可选,有包时展示) */
  pkgSteps?: { done: number; total: number };
}) {
  const rows: { label: string; pct: number; text: string; warn?: boolean }[] = [];
  if (expectation) {
    const passCount = expectation.acceptance.filter(a => a.state === "pass_verify").length;
    rows.push({
      label: "验收标准",
      pct: expectation.acceptance.length ? (passCount / expectation.acceptance.length) * 100 : 0,
      text: `${passCount}/${expectation.acceptance.length} 过`
    });
    rows.push({
      label: "预期产物",
      pct: expectation.artifacts.expected ? (expectation.artifacts.delivered / expectation.artifacts.expected) * 100 : 0,
      text: `${expectation.artifacts.delivered}/${expectation.artifacts.expected} 已产出`
    });
    rows.push({
      label: "预算",
      pct: expectation.budget.max ? (expectation.budget.spent / expectation.budget.max) * 100 : 0,
      text: `¥${expectation.budget.spent} / ¥${expectation.budget.max}`,
      warn: expectation.budget.max > 0 && expectation.budget.spent / expectation.budget.max >= 0.8
    });
  }
  if (pkgSteps) {
    rows.push({
      label: "决策包",
      pct: pkgSteps.total ? (pkgSteps.done / pkgSteps.total) * 100 : 0,
      text: `${pkgSteps.done}/${pkgSteps.total} 步`
    });
  }
  return (
    <div style={card} data-progress-align>
      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
        <Flag size={14} aria-hidden />
        <strong>期待 vs 现实</strong>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
          我主动对账,你不用找{expectation ? ` · 期待 r${expectation.revision}` : ""}
        </span>
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", fontSize: "var(--text-sm)", marginTop: 6 }}>
          <span style={{ flex: "none", width: 60 }}>{r.label}</span>
          <span style={{ flex: 1 }}><ProgressTrack pct={r.pct} warn={r.warn} /></span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--text-faint)", flex: "none" }}>{r.text}</span>
        </div>
      ))}
      {nextStepText ? (
        <div style={{ fontSize: "var(--text-sm)", marginTop: 8 }}>{nextStepText}</div>
      ) : null}
    </div>
  );
}
