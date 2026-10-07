// 共享 UI 原语(11 §3 卡片即单位/§5.9 空态;禁写死色值,全走 token)。

import { costEntryText } from "../lib/costDisplay";

import type { LucideIcon } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type PaperCardProps = ComponentPropsWithoutRef<"div"> & { strong?: boolean };

export function PaperCard({ children, strong, className, style, ...props }: PaperCardProps) {
  return (
    <div
      {...props}
      className={className}
      style={{
        background: strong ? "var(--surface-raised)" : "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-card)",
        padding: "var(--space-4)",
        ...style
      }}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 style={{ fontSize: "var(--text-md)", fontWeight: 600, margin: "0 0 var(--space-3)", color: "var(--text-primary)" }}>
      {children}
    </h2>
  );
}

/** 空态(11 §5.9):24px muted 图标 + 一句话 + 一个动作;不放插画 */
export function EmptyState({ icon: Icon, text, action }: { icon: LucideIcon; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-[var(--space-3)] py-[var(--space-6)]" data-empty-state>
      <Icon size={24} color="var(--text-muted)" aria-hidden />
      <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>{text}</p>
      {action}
    </div>
  );
}

/**
 * 错误卡(11 §5.9:人话一句 + 原始错误折叠)。
 * hint=能照做的下一步(不确定就别给);action=恢复动作按钮。
 */
export function ErrorCard({
  message,
  detail,
  hint,
  action
}: {
  message: string;
  detail?: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div
      data-error-card
      style={{
        border: "1px solid var(--color-error)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
        color: "var(--text-primary)"
      }}
    >
      <p style={{ margin: 0, fontSize: "var(--text-sm)" }}>{message}</p>
      {hint ? (
        <p data-error-hint style={{ margin: "6px 0 0", fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
          {hint}
        </p>
      ) : null}
      {action ? <div style={{ marginTop: "var(--space-3)" }}>{action}</div> : null}
      {detail ? (
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", cursor: "pointer" }}>原始错误</summary>
          <pre style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", whiteSpace: "pre-wrap" }}>{detail}</pre>
        </details>
      ) : null}
    </div>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)" }}>{children}</span>;
}

/** 成本显示纪律(11 §2.6):unknown 显示"还没有确切数字",禁 0/禁空;币种如实(CNY=元,USD 原样,不折算) */
export function CostText({ known, amount, source, currency, metaJson }: { known: boolean; amount: number | null; source?: string; currency?: string | null; metaJson?: unknown }) {
  return <span>{costEntryText({ known, amount, source, currency, meta_json: metaJson })}</span>;
}

/** 分币种合计显示(空 = 还没有确切数字) */
export function costTotalsText(knownByCurrency: Record<string, number>): string {
  const parts = Object.entries(knownByCurrency).map(([c, v]) => costEntryText({ source: "api", known: true, amount: v, currency: c }));
  return parts.length === 0 ? "还没有确切数字" : parts.join(" + ");
}
