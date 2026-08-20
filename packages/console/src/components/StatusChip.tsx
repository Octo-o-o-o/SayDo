// StatusChip:11 §2.6 状态语义层的单一来源组件——状态→颜色→图标→文案四联映射,全站唯一。
// 输入 TaskView 呈现态(持久态 ∪ 派生态),内部查表;禁止页面各自拼装(11 §5.2)。

import {
  Ban,
  Check,
  CircleAlert,
  CircleHelp,
  CirclePause,
  Clock,
  Flag,
  GitMerge,
  GitPullRequestClosed,
  History,
  LoaderCircle,
  Shield,
  ShieldAlert,
  X,
  type LucideIcon
} from "lucide-react";

type Tone = "muted" | "info" | "warning" | "error" | "success" | "ink" | "ink-wash";

interface ChipSpec {
  label: string; // 用户语(10 状态词纪律)
  tone: Tone;
  icon: LucideIcon;
  breathing?: boolean; // 呼吸点(reduced-motion 降静态)
  filled?: boolean; // ink 填充(ready_for_review 全站最高优先级)
  wash?: boolean; // 语义色淡底(§2.6 parked = 琥珀描边 + wash)
}

const CHIP_TABLE: Record<string, ChipSpec> = {
  queued: { label: "排队中", tone: "muted", icon: Clock },
  confirmed: { label: "收到,准备开工", tone: "muted", icon: Clock },
  running: { label: "执行中", tone: "info", icon: LoaderCircle, breathing: true },
  paused_step_boundary: { label: "等你确认这一步", tone: "warning", icon: CirclePause },
  blocked: { label: "需要你", tone: "warning", icon: CircleHelp },
  waiting_confirmation: { label: "等你拍板", tone: "warning", icon: CircleAlert },
  ready_for_review: { label: "等你验收", tone: "ink", icon: Flag, filled: true },
  review_approved_waiting_merge: { label: "已批准·待合并", tone: "ink-wash", icon: GitMerge },
  merging: { label: "合并中", tone: "info", icon: GitMerge, breathing: true },
  merge_failed: { label: "合并冲突/失败", tone: "error", icon: GitPullRequestClosed },
  task_done: { label: "已交付", tone: "success", icon: Check },
  failed: { label: "失败了", tone: "error", icon: X },
  cancel_requested: { label: "正在停", tone: "muted", icon: Ban, breathing: true },
  cancel_settled: { label: "停了,这轮作废", tone: "muted", icon: Ban },
  superseded: { label: "已被新版本替代", tone: "muted", icon: History },
  parked: { label: "停靠等你", tone: "warning", icon: CirclePause, wash: true }
};

const TONE_COLOR: Record<Tone, string> = {
  muted: "var(--text-muted)",
  info: "var(--color-info)",
  warning: "var(--color-warning)",
  error: "var(--color-error)",
  success: "var(--color-success)",
  ink: "var(--active-ink)",
  "ink-wash": "var(--active-ink)"
};

/** 语义色淡底(与 TONE_COLOR 同键;muted/ink 系无 wash) */
const TONE_WASH: Partial<Record<Tone, string>> = {
  info: "var(--active-ink-wash)",
  warning: "var(--color-warning-wash)",
  error: "var(--color-error-wash)",
  success: "var(--color-success-wash)"
};

export function StatusChip({ status, deadline }: { status: string; deadline?: string | null }) {
  const spec = CHIP_TABLE[status] ?? { label: status, tone: "muted" as Tone, icon: CircleHelp };
  const Icon = spec.icon;
  const color = TONE_COLOR[spec.tone];
  const filled = spec.filled === true;
  return (
    <span
      data-status={status}
      className="inline-flex items-center gap-[6px] whitespace-nowrap"
      style={{
        fontSize: "var(--text-xs)",
        lineHeight: 1,
        padding: "4px 10px",
        borderRadius: "var(--radius-pill)",
        color: filled ? "var(--active-ink-fg)" : color,
        background: filled
          ? "var(--active-ink)"
          : spec.tone === "ink-wash"
            ? "var(--active-ink-wash)"
            : spec.wash
              ? (TONE_WASH[spec.tone] ?? "transparent")
              : "transparent",
        border: `1px solid ${filled ? "var(--active-ink)" : spec.tone === "ink-wash" ? "var(--active-ink-border)" : color}`
      }}
    >
      <Icon size={12} className={spec.breathing ? "saydo-breathing" : undefined} aria-hidden />
      {spec.label}
      {status === "parked" && deadline ? (
        <span style={{ fontFamily: "var(--font-mono)", opacity: 0.8 }}>{deadline.slice(5, 10)}止</span>
      ) : null}
    </span>
  );
}

/** 风险徽章(§2.6 其余语义:S0/S1 muted 不着色,S2 warning 描边 + shield,S3 error 填充 + shield-alert) */
export function RiskBadge({ risk }: { risk: string }) {
  const style: Record<string, { color: string; bg: string; border: string; icon?: LucideIcon }> = {
    S2: { color: "var(--color-warning)", bg: "transparent", border: "var(--color-warning)", icon: Shield },
    S3: { color: "var(--fg-on-fill)", bg: "var(--color-error)", border: "var(--color-error)", icon: ShieldAlert }
  };
  const s = style[risk] ?? { color: "var(--text-muted)", bg: "transparent", border: "transparent" };
  const Icon = s.icon;
  return (
    <span
      style={{
        fontSize: "var(--text-xs)",
        fontFamily: "var(--font-mono)",
        height: 20,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "0 8px",
        borderRadius: "var(--radius-2xs)",
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.border}`
      }}
    >
      {Icon ? <Icon size={12} aria-hidden /> : null}
      {risk}
    </span>
  );
}

/** 路由徽章(tier1/hopper -> T1/HP,mono muted,仅任务详情显示) */
export function RouteBadge({ route }: { route: string }) {
  return (
    <span
      style={{
        fontSize: "var(--text-xs)",
        fontFamily: "var(--font-mono)",
        color: "var(--text-muted)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-2xs)",
        padding: "1px 6px"
      }}
    >
      {route === "tier1" ? "T1" : "HP"}
    </span>
  );
}
