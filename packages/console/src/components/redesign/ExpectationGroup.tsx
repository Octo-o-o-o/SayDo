// ExpectationGroup 与 ExpectationDriftCard(demo v2.1 期待管理增量)。
// OPEN QUESTION(交接合同 §6):期待管理不在 HANDOFF 组件清单内——它是 demo v2.1
// 由义骁 8/8 点名的核心增量(Focus 和期待管理双主线),本文件按 demo 形状组件化,
// 是否纳入批次,待交接双方拍板。若弃用,删除本文件与其 fixture 即可,零依赖。

import { AlertTriangle, ArrowRight, Check, Clock, Flag, History, Package, Wallet } from "lucide-react";
import { Chip, ProgressTrack, RailItem, RailSection } from "./shared";
import { focusBudgetCopy, type ExpectationItemState, type ExpectationView } from "./types";

const EXP_STATE: Record<ExpectationItemState, { label: string; color: string; icon: typeof Check }> = {
  pass_verify: { label: "机器验过", color: "var(--color-success)", icon: Check },
  pass_claim: { label: "自报", color: "var(--text-faint)", icon: Check },
  untested: { label: "未验", color: "var(--text-faint)", icon: Clock },
  at_risk: { label: "有偏差", color: "var(--color-error)", icon: AlertTriangle },
  adjusted: { label: "已调整", color: "var(--text-faint)", icon: History }
};

export function ExpectationGroup({ expectation, onEdit }: {
  expectation: ExpectationView;
  /** 点击编辑:direction/acceptance(idx)/artifacts/budget;编辑流=用户直改→AI 复述影响→生效(确认环用户发起侧) */
  onEdit?: (target: { kind: "direction" | "acceptance" | "artifacts" | "budget"; index?: number }) => void;
}) {
  const exp = expectation;
  const riskCount = exp.acceptance.filter(a => a.state === "at_risk").length;
  const artPct = exp.artifacts.expected ? (exp.artifacts.delivered / exp.artifacts.expected) * 100 : 0;
  const budPct = exp.budget.known && exp.budget.max ? (exp.budget.spent / exp.budget.max) * 100 : 0;
  return (
    <RailSection
      title="期待"
      icon={Flag}
      count={`r${exp.revision}`}
      warn={riskCount ? `${riskCount} 处偏差` : null}
    >
      {!riskCount ? <div style={{ padding: "0 8px 4px" }}><Chip tone="muted">对齐中</Chip></div> : null}
      <RailItem
        icon={ArrowRight}
        onClick={onEdit ? () => onEdit({ kind: "direction" }) : undefined}
        title={`方向:${exp.direction}`}
        sub="点我可改 · 执行前自由改"
      />
      {exp.acceptance.map((a, i) => {
        const st = EXP_STATE[a.state];
        return (
          <RailItem
            key={i}
            icon={st.icon}
            onClick={onEdit ? () => onEdit({ kind: "acceptance", index: i }) : undefined}
            title={a.text}
            sub={a.note}
            warning={a.state === "at_risk"}
          />
        );
      })}
      <RailItem
        icon={Package}
        onClick={onEdit ? () => onEdit({ kind: "artifacts" }) : undefined}
        title={`预期产物 ${exp.artifacts.delivered}/${exp.artifacts.expected} 已产出`}
        sub={<ProgressTrack pct={artPct} />}
      />
      <RailItem
        icon={Wallet}
        onClick={onEdit ? () => onEdit({ kind: "budget" }) : undefined}
        title={`预算 ${focusBudgetCopy(exp.budget)}`}
        sub={exp.budget.known ? <ProgressTrack pct={budPct} warn={budPct >= 80} /> : undefined}
      />
    </RailSection>
  );
}

/* 偏航提醒:现实不符期待时,监督线主动提醒;三分流=纠实施/调期待/保持观察。
   纠实施=现实偏了,实施线往期待靠;调期待=期待偏了,期待往合理靠(AI 复述影响生效)。 */
export function ExpectationDriftCard({ text, detail, resolved, onAction }: {
  text: string;
  detail?: string;
  resolved?: "fix" | "adjust" | "watch" | null;
  onAction?: (action: "fix" | "adjust" | "watch") => void;
}) {
  if (resolved) {
    const copy = {
      fix: "已按纠实施处理:换方案重跑,期待不变。跑完叫你验收。",
      adjust: "期待已调整并复述生效:我按新期待做,不按旧的。",
      watch: "好,这条期待先挂着观察,到点没解开我来提醒你。"
    }[resolved];
    return (
      <div style={{ border: "1px solid var(--color-success)", borderRadius: "var(--radius-md)", padding: "var(--space-4) var(--space-5)", background: "var(--surface)" }} data-drift-resolved={resolved}>
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", color: "var(--color-success)" }}>
          <Check size={14} aria-hidden />
          <strong>偏差已处理</strong>
        </div>
        <div style={{ fontSize: "var(--text-sm)", marginTop: 6 }}>{copy}</div>
      </div>
    );
  }
  return (
    <div style={{ border: "1px solid var(--color-warning)", borderRadius: "var(--radius-md)", padding: "var(--space-4) var(--space-5)", background: "var(--surface)" }} data-drift-card>
      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
        <AlertTriangle size={15} aria-hidden style={{ color: "var(--color-warning)" }} />
        <strong>期待偏差提醒</strong>
        <span style={{ fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)", padding: "1px 6px", borderRadius: "var(--radius-2xs)", border: "1px solid var(--line)", color: "var(--text-muted)" }}>监督线主动对齐</span>
      </div>
      <div style={{ fontSize: "var(--text-sm)", marginTop: 6 }}>{text}</div>
      {detail ? <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", marginTop: 6 }}>{detail}</div> : null}
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", marginTop: 6 }}>
        三条路都对,取决于是<strong>现实偏了</strong>还是<strong>期待偏了</strong>——纠实施是让实施线往期待靠,调期待是让期待往合理靠:
      </div>
      {onAction ? (
        <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)", flexWrap: "wrap" }}>
          <button type="button" onClick={() => onAction("fix")} style={{ padding: "7px 14px", borderRadius: "var(--radius-xs)", border: "1px solid var(--active-ink-border)", background: "var(--active-ink-wash)", color: "var(--active-ink)", cursor: "pointer", fontSize: "var(--text-sm)" }}>纠实施:换方案重跑</button>
          <button type="button" onClick={() => onAction("adjust")} style={{ padding: "7px 14px", borderRadius: "var(--radius-xs)", border: "1px solid var(--active-ink)", background: "var(--active-ink)", color: "var(--active-ink-fg)", cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: 500 }}>调期待:改这条期待</button>
          <button type="button" onClick={() => onAction("watch")} style={{ padding: "7px 14px", borderRadius: "var(--radius-xs)", border: "1px solid var(--line)", background: "var(--surface-control)", color: "var(--text-secondary)", cursor: "pointer", fontSize: "var(--text-sm)" }}>保持观察</button>
        </div>
      ) : null}
    </div>
  );
}
