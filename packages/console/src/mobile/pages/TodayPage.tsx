import { cacheCard, attentionRef } from "../cardResolver";
import { MobileHeader, MobileNotice } from "../MobileChrome";
import type { AttentionColor, AttentionItem } from "../types";

const GROUPS: Array<{ color: AttentionColor; label: string; sub: string }> = [
  { color: "orange", label: "等你拍板", sub: "需要你" },
  { color: "blue", label: "你的动作", sub: "你来做" },
  { color: "green", label: "AI 在做", sub: "我来做" },
  { color: "gray", label: "等外部", sub: "外部球权" }
];

export function MobileTodayPage({ items, error }: { items: AttentionItem[] | null; error: string | null }) {
  const open = (item: AttentionItem) => {
    cacheCard(item);
    const ref = attentionRef(item);
    location.hash = `/m/card/${ref.kind}/${encodeURIComponent(ref.entityId)}`;
  };
  return (
    <div data-mobile-page="today">
      <MobileHeader title="今天" crumb="同一本账 · 球权一眼看清" />
      {error ? <MobileNotice tone="error">今天页读取失败：{error}</MobileNotice> : null}
      <div className="m-ballbar" aria-label="球权计数">
        {GROUPS.map((group) => (
          <div className={`m-ball m-${group.color}`} key={group.color}>
            <strong>{items?.filter((item) => item.color === group.color).length ?? 0}</strong>
            <span>{group.label}</span>
          </div>
        ))}
      </div>
      {items === null ? <MobileNotice>正在翻今天的账</MobileNotice> : null}
      {items?.length === 0 ? <MobileNotice>今天没有挂在收件箱里的事。</MobileNotice> : null}
      {GROUPS.map((group) => {
        const grouped = items?.filter((item) => item.color === group.color) ?? [];
        if (grouped.length === 0) return null;
        return (
          <section className={`m-group m-group-${group.color}`} key={group.color}>
            <div className="m-group-title">
              <span>{group.label}</span><small>{grouped.length} · {group.sub}</small>
            </div>
            {grouped.map((item) => (
              <button className={`m-ledger-card m-${item.color}`} type="button" key={item.id} onClick={() => open(item)}>
                <span className="m-meta">{item.focusTitle ?? "未归属 Focus"} · {formatWhen(item.updatedAt)}</span>
                <strong>{item.title}</strong>
                <span>{item.needs ? `需要：${item.needs}` : item.sourceKind ?? "账本条目"}</span>
              </button>
            ))}
          </section>
        );
      })}
    </div>
  );
}

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
