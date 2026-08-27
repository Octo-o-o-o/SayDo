// AttentionItemCard(demo .attn-item 四色收件箱条目,11 §5.11 登记组件):
// 左色条(橙/蓝/绿/灰)+标题+Focus 归属+needs 标签;绿/灰(calm)带「知道了」(ack),
// 橙/蓝无 ack(源数据驱动消失);hover 抬升阴影;非 calm 右侧 chevron。
// needs 文案用话术规范口径:等你拍板/等你补充/等你的动作/待归类。

import { Check, ChevronRight, Layers } from "lucide-react";
import type { MouseEvent } from "react";
import type { AttentionColor, AttentionItem } from "./types";

const BAR: Record<AttentionColor, string> = {
  orange: "var(--color-warning)",
  blue: "var(--active-ink)",
  green: "var(--color-success)",
  gray: "var(--text-faint)"
};

const NEEDS_LABEL: Record<string, string> = {
  decision: "等你拍板",
  input: "等你补充",
  action: "等你的动作",
  unknown: "待归类"
};

export function formatAttnTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return sameDay ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

export function AttentionItemCard({ item, calm, onOpen, onAck }: {
  item: AttentionItem;
  calm?: boolean;
  onOpen?: () => void;
  onAck?: (e: MouseEvent) => void;
}) {
  const needsBadge = item.needs ? NEEDS_LABEL[item.needs] ?? item.needs : null;
  return (
    <button
      type="button"
      data-attention-id={item.id}
      data-attn-color={item.color}
      onClick={onOpen}
      className="saydo-attn-item"
      style={{
        display: "flex",
        gap: "var(--space-3)",
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--line)",
        background: "var(--surface-soft)",
        marginBottom: "var(--space-3)",
        cursor: calm ? "default" : "pointer",
        textAlign: "left",
        width: "100%",
        position: "relative",
        color: "var(--text-primary)",
        transition: "box-shadow var(--duration-fast) var(--ease-out)"
      }}
      onMouseEnter={(e) => { if (!calm) e.currentTarget.style.boxShadow = "var(--shadow-card-hover)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
    >
      <span aria-hidden style={{ width: 3, borderRadius: "var(--radius-2xs)", flexShrink: 0, alignSelf: "stretch", background: BAR[item.color] }} />
      <span style={{ flex: 1, minWidth: 0, paddingRight: calm ? 28 : 0, display: "block" }}>
        <span style={{ display: "block", fontWeight: 500, lineHeight: 1.5 }}>{item.title}</span>
        <span style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
          {item.focusTitle ? (
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Layers size={11} aria-hidden />
              {item.focusTitle}
            </span>
          ) : null}
          {needsBadge ? (
            <span
              style={{
                fontSize: "var(--text-xs)",
                fontFamily: "var(--font-mono)",
                padding: "1px 6px",
                borderRadius: "var(--radius-2xs)",
                border: "1px solid var(--line)",
                color: "var(--text-muted)"
              }}
            >
              {needsBadge}
            </span>
          ) : null}
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
            {formatAttnTime(item.updatedAt)}
          </span>
        </span>
      </span>
      {calm && onAck ? (
        <span
          role="button"
          tabIndex={0}
          title="知道了(ack 仅绿/灰;升级变色会无视 ack 重现)"
          data-ack={item.id}
          onClick={onAck}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onAck(e as unknown as MouseEvent);
            }
          }}
          style={{
            position: "absolute", top: 8, right: 8, color: "var(--text-faint)",
            width: 22, height: 22, display: "grid", placeItems: "center", borderRadius: "var(--radius-2xs)", cursor: "pointer"
          }}
        >
          <Check size={12} aria-hidden />
        </span>
      ) : !calm ? (
        <ChevronRight size={14} color="var(--text-faint)" aria-hidden style={{ flexShrink: 0, alignSelf: "center" }} />
      ) : null}
    </button>
  );
}
