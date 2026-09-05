// DecisionPackageCard(demo pkgHtml 六节):做出来什么样/做不做/每步谁做/验收标准/成本熔断/预授权(所闻即所签)。
// 「怎么跑」现役仅逐步确认;直达验收档 designed/deferred,旧 direct 值 fail-closed 不可拍板。

import { AlertTriangle, Check, Flag, Package, Shield, X } from "lucide-react";
import { ActionRow, Btn, card, Mono, StageTag } from "./shared";
import type { DecisionPackageView } from "./types";
import { PackageDemoPreview } from "./DemoFrame";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: "var(--space-4)" }}>
      <div style={{ fontSize: "var(--text-md)", fontWeight: 600, display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>{title}</div>
      {children}
    </div>
  );
}

export function DecisionPackageCard({ pkg, onAction }: {
  pkg: DecisionPackageView;
  /** approve 现役仅 step_confirm;旧 selectedMode=direct_to_review fail-closed;revise/expect 回调 */
  onAction?: (action: "select_mode" | "approve" | "revise" | "edit_expectation", payload?: string) => void;
}) {
  const approved = pkg.status === "approved";
  const blockedDirect = pkg.selectedMode === "direct_to_review";
  const canApprove = !approved && !blockedDirect;
  return (
    <div style={card} data-decision-package={pkg.id}>
      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
        <Package size={15} aria-hidden />
        <strong>决策包 · 给你拍板</strong>
        <Mono faint>r{pkg.revision}</Mono>
        {approved ? (
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-success)", display: "inline-flex", gap: 4, alignItems: "center" }}>
            <Check size={12} aria-hidden /> 已批准
          </span>
        ) : (
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-warning)", display: "inline-flex", gap: 4, alignItems: "center" }}>
            <AlertTriangle size={12} aria-hidden /> 待拍板{pkg.expiresInH ? ` · ${pkg.expiresInH} 小时内有效` : ""}
          </span>
        )}
      </div>

      <Section title="做出来什么样">
        <div style={{ fontSize: "var(--text-sm)" }}>{pkg.outcomePreview}</div>
        {pkg.demoRef && pkg.projectId ? <PackageDemoPreview demoRef={pkg.demoRef} projectId={pkg.projectId} /> : null}
      </Section>

      <Section title="做 / 不做">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 5, fontSize: "var(--text-sm)" }}>
            {pkg.inScope.map((s, i) => <li key={i} style={{ display: "flex", gap: 8 }}><Check size={12} aria-hidden style={{ color: "var(--color-success)", flex: "none", marginTop: 4 }} /><span>{s}</span></li>)}
          </ul>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 5, fontSize: "var(--text-sm)" }}>
            {pkg.outOfScope.map((s, i) => <li key={i} style={{ display: "flex", gap: 8 }}><X size={12} aria-hidden style={{ color: "var(--color-error)", flex: "none", marginTop: 4 }} /><span>{s}</span></li>)}
          </ul>
        </div>
      </Section>

      <Section title="计划(每步标了谁做)">
        {pkg.plan.map((s) => (
          <div key={s.seq} style={{ display: "flex", gap: "var(--space-3)", padding: "8px 0", borderBottom: "1px dashed var(--line)", fontSize: "var(--text-sm)" }}>
            <Mono faint>{s.seq}</Mono>
            <span
              style={{
                fontSize: 10, fontFamily: "var(--font-mono)", padding: "1px 6px", borderRadius: "var(--radius-2xs)",
                flex: "none", height: "fit-content",
                background: s.owner === "ai" ? "var(--active-ink-wash)" : "var(--surface-ink-wash)",
                color: s.owner === "ai" ? "var(--active-ink)" : "var(--color-warning)",
                border: s.owner === "ai" ? "none" : "1px solid var(--color-warning)"
              }}
            >
              {s.owner === "ai" ? "我来做" : "需要你"}
            </span>
            <span>{s.step}</span>
          </div>
        ))}
      </Section>

      <Section title="验收标准">
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 5, fontSize: "var(--text-sm)" }}>
          {pkg.acceptance.map((s, i) => <li key={i} style={{ display: "flex", gap: 8 }}><Flag size={12} aria-hidden style={{ flex: "none", marginTop: 4, color: "var(--text-muted)" }} /><span>{s}</span></li>)}
        </ul>
      </Section>

      <Section title="成本与风险">
        <div style={{ fontSize: "var(--text-sm)" }}>
          预计 <Mono>{pkg.cost.expected !== undefined ? `¥${pkg.cost.expected}` : "还没有确切数字"}</Mono>,熔断上限 <Mono>¥{pkg.cost.max}</Mono>(到顶必停)
        </div>
        <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 5, fontSize: "var(--text-sm)" }}>
          {pkg.risks.map((s, i) => <li key={i} style={{ display: "flex", gap: 8 }}><AlertTriangle size={12} aria-hidden style={{ color: "var(--text-faint)", flex: "none", marginTop: 4 }} /><span>{s}</span></li>)}
        </ul>
      </Section>

      {pkg.preauthorizedEffects.length ? (
        <Section title="预授权请求(所闻即所签)">
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 5, fontSize: "var(--text-sm)" }}>
            {pkg.preauthorizedEffects.map((e, i) => (
              <li key={i} style={{ display: "flex", gap: 8 }}>
                <Shield size={12} aria-hidden style={{ color: "var(--text-faint)", flex: "none", marginTop: 4 }} />
                <span>「{e.spokenForm}」 · {e.ttlHours} 小时内有效</span>
              </li>
            ))}
          </ul>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", marginTop: 4 }}>
            预授权随包签署;超过 3 项会强制屏幕同显。你可以只批准包、不签预授权。<StageTag>S2</StageTag>
          </div>
        </Section>
      ) : null}

      {!approved && (
        <Section title="怎么跑?">
          {blockedDirect ? (
            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-warning)", marginTop: "var(--space-3)" }}>
              这份包带着直达验收档,本期 designed/deferred,不能从这里拍板。现役只按逐步确认执行。
            </div>
          ) : (
            <div style={{ fontSize: "var(--text-sm)", marginTop: "var(--space-3)" }}>
              按逐步确认执行(每步问你)。直达验收档 designed/deferred,不在现役入口。
            </div>
          )}
          <ActionRow>
            <Btn variant="seal" disabled={!canApprove} onClick={() => onAction?.("approve")}>拍板,开始</Btn>
            <Btn onClick={() => onAction?.("edit_expectation")}>改期待</Btn>
            <Btn onClick={() => onAction?.("revise")}>还要改改</Btn>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>不置可否就按「每步问你」处理</span>
          </ActionRow>
        </Section>
      )}
    </div>
  );
}
