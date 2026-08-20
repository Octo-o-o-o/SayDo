// FocusStateCard(demo .statecard):标题/lifecycle/rN/方向/球权文字。
// 球权只以文字形态出现(handoff §4.4:openByOwner 永不渲染为数字角标)。
// sticky/定位由容器决定,组件只负责内容与不透明底(防滚动裁切,评审 U6)。

import { History } from "lucide-react";
import { Btn, card, Mono } from "./shared";
import type { CSSProperties } from "react";
import type { FocusLifecycle, FocusView } from "./types";

const LIFECYCLE_LABEL: Record<FocusLifecycle, string> = {
  active: "进行中",
  captured: "刚记下",
  dormant: "休眠中",
  closed: "已收官",
  abandoned: "已放弃",
  archived: "已归档"
};

export function FocusStateCard({ focus, onOpenRecords, sticky, compact }: {
  focus: FocusView;
  onOpenRecords?: () => void;
  sticky?: boolean;
  /** 滚动态压缩单行(评审 U6):容器在 statecard 被 sticky 吸住时传入 */
  compact?: boolean;
}) {
  const ob = focus.openByOwner;
  const tagStyle: CSSProperties = focus.lifecycle === "closed"
    ? { color: "var(--color-success)", border: "1px solid var(--color-success)" } : {};
  if (compact) {
    return (
      <div
        style={{
          ...card,
          background: "var(--bg-app)",
          padding: "var(--space-2) var(--space-4)",
          display: "flex",
          gap: "var(--space-3)",
          alignItems: "center",
          ...(sticky ? { position: "sticky", top: 0, zIndex: 5 } : {})
        }}
        data-focus-statecard={focus.id}
        data-compact="true"
      >
        <strong style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{focus.title}</strong>
        <span
          style={{
            fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)", padding: "1px 6px",
            borderRadius: "var(--radius-2xs)", border: "1px solid var(--line)",
            color: "var(--text-muted)", flex: "none", ...tagStyle
          }}
        >
          {LIFECYCLE_LABEL[focus.lifecycle]}
        </span>
        <Mono faint>r{focus.currentRevision}</Mono>
        <span style={{ flex: "none", fontSize: "var(--text-xs)", whiteSpace: "nowrap" }}>
          {ob.human ? <span style={{ color: "var(--color-warning)" }}>你 {ob.human} 件</span> : null}
          {ob.agent ? <span style={{ color: "var(--color-success)" }}>{ob.human ? " · " : ""}我 {ob.agent} 件</span> : null}
          {ob.external ? <span style={{ color: "var(--text-muted)" }}>{ob.human || ob.agent ? " · " : ""}等外部 {ob.external} 件</span> : null}
          {!ob.human && !ob.agent && !ob.external ? <span style={{ color: "var(--text-muted)" }}>没有未结的事</span> : null}
        </span>
        {onOpenRecords ? (
          <Btn icon={History} onClick={onOpenRecords} title="工程航迹、事件流与版本记录">记录</Btn>
        ) : null}
      </div>
    );
  }
  return (
    <div
      style={{
        ...card,
        background: "var(--bg-app)", // sticky 场景不透明,防内容从下穿过(评审 U6)
        padding: "var(--space-3) var(--space-4)",
        display: "flex",
        gap: "var(--space-4)",
        alignItems: "center",
        ...(sticky ? { position: "sticky", top: 0, zIndex: 5 } : {})
      }}
      data-focus-statecard={focus.id}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
          <strong>{focus.title}</strong>
          <span
            style={{
              fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)", padding: "1px 6px",
              borderRadius: "var(--radius-2xs)", border: "1px solid var(--line)",
              color: "var(--text-muted)", ...tagStyle
            }}
          >
            {LIFECYCLE_LABEL[focus.lifecycle]}
          </span>
          <Mono faint>r{focus.currentRevision}</Mono>
        </div>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginTop: 2 }}>{focus.direction}</div>
      </div>
      <div style={{ flex: "none", textAlign: "right", fontSize: "var(--text-xs)" }}>
        {ob.human ? <div style={{ color: "var(--color-warning)" }}>你 {ob.human} 件</div> : null}
        {ob.agent ? <div style={{ color: "var(--color-success)" }}>我 {ob.agent} 件</div> : null}
        {ob.external ? <div style={{ color: "var(--text-muted)" }}>等外部 {ob.external} 件</div> : null}
        {!ob.human && !ob.agent && !ob.external ? <div style={{ color: "var(--text-muted)" }}>没有未结的事</div> : null}
      </div>
      {onOpenRecords ? (
        <Btn icon={History} onClick={onOpenRecords} title="工程航迹、事件流与版本记录">记录</Btn>
      ) : null}
    </div>
  );
}
