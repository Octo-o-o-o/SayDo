// redesign 组件库共享原语:卡片/区块/列表行/进度条/徽章/stage-tag/kv 行。
// 全走 tokens.css 变量,禁写死色值(11 §3;与 ui.tsx/StatusChip 同约定)。

import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export const card: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-card)",
  padding: "var(--space-4) var(--space-5)"
};

export function Chip({ tone, icon: Icon, children, filled, dashed }: {
  tone: "muted" | "info" | "warning" | "error" | "success" | "ink" | "ink-wash";
  icon?: LucideIcon;
  children: ReactNode;
  filled?: boolean;
  dashed?: boolean;
}) {
  const color = tone === "muted" ? "var(--text-muted)"
    : tone === "info" ? "var(--color-info)"
    : tone === "warning" ? "var(--color-warning)"
    : tone === "error" ? "var(--color-error)"
    : tone === "success" ? "var(--color-success)"
    : "var(--active-ink)";
  const isFilled = filled || tone === "ink";
  return (
    <span
      className="inline-flex items-center gap-[6px] whitespace-nowrap"
      style={{
        fontSize: "var(--text-xs)",
        lineHeight: 1,
        padding: "4px 10px",
        borderRadius: "var(--radius-pill)",
        color: isFilled ? "var(--active-ink-fg)" : color,
        background: isFilled ? "var(--active-ink)" : tone === "ink-wash" ? "var(--active-ink-wash)" : "transparent",
        border: `${dashed ? "1px dashed" : "1px solid"} ${isFilled ? "var(--active-ink)" : tone === "ink-wash" ? "var(--active-ink-border)" : color}`,
        whiteSpace: "nowrap"
      }}
    >
      {Icon ? <Icon size={12} aria-hidden /> : null}
      {children}
    </span>
  );
}

export function StageTag({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontFamily: "var(--font-mono)",
        padding: "1px 5px",
        borderRadius: "var(--radius-2xs)",
        background: "var(--surface-ink-wash)",
        color: "var(--text-faint)",
        border: "1px dashed var(--line-soft)",
        verticalAlign: "1px",
        whiteSpace: "nowrap"
      }}
    >
      {children}
    </span>
  );
}

export function Mono({ children, faint }: { children: ReactNode; faint?: boolean }) {
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.92em", color: faint ? "var(--text-faint)" : undefined }}>
      {children}
    </span>
  );
}

export function RailSection({ title, icon: Icon, count, warn, children }: {
  title: string;
  icon: LucideIcon;
  count?: number | string;
  warn?: string | null;
  children: ReactNode;
}) {
  return (
    <div style={{ ...card, padding: "var(--space-3) var(--space-4)", ...(warn ? { border: "1px solid var(--color-warning)" } : {}) }}>
      <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6, marginBottom: "var(--space-2)" }}>
        <Icon size={13} aria-hidden /> {title}
        {count !== undefined ? <span style={{ fontFamily: "var(--font-mono)", fontWeight: 400, color: "var(--text-faint)", fontSize: 11 }}>{count}</span> : null}
        {warn ? <Chip tone="warning" icon={undefined}>{warn}</Chip> : null}
      </div>
      {children}
    </div>
  );
}

export function RailItem({ icon: Icon, title, sub, right, onClick, warning }: {
  icon?: LucideIcon;
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  warning?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", gap: "var(--space-2)", alignItems: "flex-start", width: "100%", textAlign: "left",
        padding: "7px 8px", borderRadius: "var(--radius-xs)", fontSize: "var(--text-sm)", lineHeight: 1.5,
        background: "none", border: "none", cursor: onClick ? "pointer" : "default",
        color: warning ? "var(--color-error)" : undefined
      }}
    >
      {Icon ? <Icon size={12} aria-hidden style={{ flex: "none", marginTop: 3 }} /> : null}
      <span style={{ flex: 1, minWidth: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {title}
        {sub ? <span style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--text-faint)", marginTop: 1 }}>{sub}</span> : null}
      </span>
      {right}
    </button>
  );
}

export function ProgressTrack({ pct, warn }: { pct: number; warn?: boolean }) {
  return (
    <span style={{ display: "block", height: 6, borderRadius: "var(--radius-2xs)", background: "var(--surface-ink-wash)", overflow: "hidden", marginTop: 4 }}>
      <i style={{ display: "block", height: "100%", borderRadius: "var(--radius-2xs)", width: `${Math.min(100, Math.max(0, pct))}%`, background: warn ? "var(--color-warning)" : "var(--active-ink)" }} />
    </span>
  );
}

export function KV({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "var(--space-2)", fontSize: "var(--text-sm)", padding: "5px 0", borderBottom: "1px dashed var(--line)" }}>
      <span style={{ width: 88, flex: "none", color: "var(--text-muted)", fontSize: "var(--text-xs)", paddingTop: 2 }}>{k}</span>
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
    </div>
  );
}

export function Dot({ color, breathing }: { color: string; breathing?: boolean }) {
  return (
    <span
      className={breathing ? "saydo-breathing" : undefined}
      style={{ width: 7, height: 7, borderRadius: "50%", flex: "none", background: color, display: "inline-block" }}
    />
  );
}

export function ActionRow({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
      {children}
    </div>
  );
}

/* ---------- 按钮族(内联样式,禁 class 依赖) ---------- */
export function Btn({ children, onClick, disabled, title, icon: Icon, variant, type = "button", style }: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  icon?: LucideIcon;
  variant?: "default" | "primary" | "seal" | "ink-outline" | "danger-outline" | "s3";
  type?: "button" | "submit";
  style?: CSSProperties;
}) {
  const base: CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6,
    fontSize: "var(--text-sm)", lineHeight: 1.4, padding: "7px 14px",
    borderRadius: "var(--radius-xs)", border: "1px solid var(--line)",
    background: "var(--surface-control)", color: "var(--text-secondary)", cursor: "pointer"
  };
  if (variant === "primary") Object.assign(base, { background: "var(--active-ink)", border: "1px solid var(--active-ink)", color: "var(--active-ink-fg)", fontWeight: 500 });
  // 盖章(11 §2.7 品牌朱):承诺型/终局动作——签收据、拍板、验收通过、放行、办结
  if (variant === "seal") Object.assign(base, { background: "var(--brand-seal)", border: "1px solid var(--brand-seal-border)", color: "var(--brand-seal-fg)", fontWeight: 500 });
  if (variant === "ink-outline") Object.assign(base, { background: "var(--active-ink-wash)", border: "1px solid var(--active-ink-border)", color: "var(--active-ink)" });
  if (variant === "danger-outline") Object.assign(base, { border: "1px solid var(--color-error)", color: "var(--color-error)" });
  if (variant === "s3") Object.assign(base, { border: "1.5px solid var(--color-error)", color: "var(--color-error)", background: "transparent", padding: "10px 18px", fontWeight: 500 });
  if (disabled) Object.assign(base, { opacity: "var(--disabled-opacity)", cursor: "not-allowed" });
  return (
    <button type={type} onClick={disabled ? undefined : onClick} title={title} style={{ ...base, ...style }} disabled={disabled}>
      {Icon ? <Icon size={13} aria-hidden /> : null}
      {children}
    </button>
  );
}
