// ConfirmCard(demo .confirm-card):按 daemon 真实 kind 枚举分组文案(handoff §3);
// 倒计时值由 props 传入(组件不做真实定时器);超时**不自动「记」**(handoff §4.1);
// 视觉比审批卡降一级(信息确认≠授权确认);语音封闭肯定与屏幕按钮等价。

import { Check, MessageSquare } from "lucide-react";
import { ActionRow, Btn, card, StageTag } from "./shared";
import type { ConfirmCardData, ConfirmKind } from "./types";

/** kind → 分组文案;Record<ConfirmKind,…> 让 contracts 新增 kind 时这里编译失败,不静默漏项 */
const KIND_GROUP: Record<ConfirmKind, string> = {
  focus_anchor: "锚定确认",
  focus_create_anchor: "锚定确认",
  focus_obligation: "义务确认",
  focus_obligation_resolve: "义务确认",
  focus_revision: "修订确认",
  focus_lane_split: "修订确认",
  expectation_ack: "期待确认",
  dispatch: "派发确认",
  runtime_effect: "效果授权",
  readiness: "就绪复述",
  memory: "记忆",
  project_anchor: "项目锚定"
};
/** 运行期仍可能收到表外 kind(旧 daemon / 未来新增):显示通用「确认」,不渲染空前缀 */
const KIND_GROUP_FALLBACK = "确认";

export function confirmKindGroupLabel(kind: string): string {
  return (KIND_GROUP as Record<string, string | undefined>)[kind] ?? KIND_GROUP_FALLBACK;
}

function fmtLeft(sec: number): string {
  const mm = Math.floor(sec / 60).toString().padStart(2, "0");
  const ss = (sec % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export function ConfirmCard({ data, onAction }: {
  data: ConfirmCardData;
  /** accept/reject 由容器决定后果(组件只上报);无 onAction 时纯展示 */
  onAction?: (decision: "accept" | "reject", receiptId: string) => void;
}) {
  const resolved = data.resolved ?? null;
  return (
    <div
      style={{
        ...card,
        border: "1px solid var(--active-ink-border)",
        background: "var(--active-ink-wash)"
      }}
      data-confirm-card={data.receiptId}
    >
      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
        <MessageSquare size={15} aria-hidden />
        <strong>跟你确认几点</strong>
        <span style={{ fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)", padding: "1px 6px", borderRadius: "var(--radius-2xs)", border: "1px solid var(--line)", color: "var(--text-muted)" }}>
          {confirmKindGroupLabel(data.kind)} · 信息确认 · 不是授权
        </span>
        <span style={{ flex: 1 }} />
        {!resolved && typeof data.secondsLeft === "number" ? (
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-warning)", fontSize: "var(--text-sm)" }}>
            {fmtLeft(Math.max(0, data.secondsLeft))}
          </span>
        ) : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "var(--space-3) 0" }}>
        {data.keys.map((k, i) => (
          <div key={i} style={{ display: "flex", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
            <Check size={12} aria-hidden style={{ color: "var(--color-success)", flex: "none", marginTop: 4 }} />
            <span>{k}</span>
          </div>
        ))}
      </div>
      {resolved ? (
        <div style={{ fontSize: "var(--text-xs)", color: resolved === "accepted" ? "var(--color-success)" : "var(--color-error)" }}>
          {resolved === "accepted"
            ? "已记住(你确认过,进 trusted)"
            : resolved === "rejected"
              ? "好的,不记。"
              : "超时没回,这条不记(过期即丢,不假装已采纳)· 想让我下次再确认就说一声"}
        </div>
      ) : (
        <ActionRow>
          {onAction ? <Btn variant="seal" onClick={() => onAction("accept", data.receiptId)}>记</Btn> : null}
          {onAction ? <Btn onClick={() => onAction("reject", data.receiptId)}>不用记</Btn> : null}
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
            倒计时结束这条不记(过期即丢)· 你也可以直接开口回答
          </span>
        </ActionRow>
      )}
      {data.kind === "runtime_effect" ? <div style={{ marginTop: 6 }}><StageTag>S2 效果需单独授权,本卡不替代审批</StageTag></div> : null}
    </div>
  );
}
