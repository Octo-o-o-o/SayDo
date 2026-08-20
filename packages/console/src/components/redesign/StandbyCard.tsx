// StandbyCard(demo standbyHtml):sparse agent 待命——在等什么/叫醒条件/到期兜底全写账上(11 §0.1-5 有账的沉默)。
// 虚线边;唤醒后由容器换数据(dependency_woken),组件只按 props 呈现。

import { Check, Hourglass } from "lucide-react";
import { ActionRow, Btn, card } from "./shared";

export function StandbyCard({ waitingText, wakeCondition, woken, wokenText, onAction }: {
  /** 在等什么(一句) */
  waitingText: string;
  /** 叫醒条件(一句,含到期兜底) */
  wakeCondition: string;
  /** 已唤醒(dependency_woken 后容器传入) */
  woken?: boolean;
  wokenText?: string;
  /** 演示/测试用唤醒按钮回调;真实环境由事件驱动,不传则不渲染按钮 */
  onAction?: (action: "simulate_wake") => void;
}) {
  if (woken) {
    return (
      <div style={{ ...card, border: "1px solid var(--color-success)" }} data-standby="woken">
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", color: "var(--color-success)" }}>
          <Check size={13} aria-hidden />
          <strong>等到了,已醒</strong>
        </div>
        <div style={{ fontSize: "var(--text-sm)", marginTop: 6 }}>{wokenText ?? "前置已了结,后续安排自动醒(dependency_woken)。"}</div>
      </div>
    );
  }
  return (
    <div style={{ ...card, border: "1px dashed var(--text-faint)", background: "transparent" }} data-standby="waiting">
      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
        <Hourglass size={14} aria-hidden />
        <strong>我在待命</strong>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>sparse agent:没有活就 standby,叫醒条件写在账上</span>
      </div>
      <div style={{ fontSize: "var(--text-sm)", marginTop: 6 }}>
        在等:{waitingText}<span style={{ color: "var(--text-muted)" }}>叫醒条件:{wakeCondition}</span>
      </div>
      {onAction ? (
        <ActionRow>
          <Btn variant="ink-outline" onClick={() => onAction("simulate_wake")}>模拟:等到了</Btn>
        </ActionRow>
      ) : null}
    </div>
  );
}
