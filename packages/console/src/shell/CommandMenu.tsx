// ⌘K 命令菜单(DAILY-01 R13):全局直达——页面跳转 + 正在持续的事。
// 只读导航:不承载写动作;结构编辑仍在各自页面。Esc 关,Enter 跳。

import { useEffect, useMemo, useRef, useState } from "react";
import { navigate } from "../lib/router";

interface Cmd {
  id: string;
  label: string;
  hint?: string;
  hash: string;
}

const PAGE_CMDS: Cmd[] = [
  { id: "today", label: "今天", hint: "收件箱", hash: "/today" },
  { id: "chat", label: "开口聊", hint: "新对话", hash: "/chat-new" },
  { id: "board", label: "泳道", hint: "看板三态", hash: "/board" },
  { id: "focuses", label: "正在持续的事", hint: "事项列表", hash: "/focuses" },
  { id: "arrangements", label: "安排", hint: "跨事义务清单", hash: "/arrangements" },
  { id: "archive", label: "归档", hint: "已归档的事", hash: "/archive" },
  { id: "approvals", label: "审批", hint: "待拍板", hash: "/approvals" },
  { id: "notify", label: "通知", hint: "回叫与提醒", hash: "/notify" },
  { id: "cost", label: "成本", hint: "用量账本", hash: "/cost" },
  { id: "settings", label: "设置", hint: "全局", hash: "/settings" }
];

export function CommandMenu({
  open,
  onClose,
  focuses
}: {
  open: boolean;
  onClose: () => void;
  /** 正在持续的事(侧栏同一数据);命令菜单把它们作为跳转候选 */
  focuses: { id: string; title: string }[];
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setSel(0);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  const items = useMemo<Cmd[]>(() => {
    const focusCmds: Cmd[] = focuses.flatMap((f) => [
      {
        id: `focus:${f.id}`,
        label: f.title,
        hint: "这件事",
        hash: `/focus/${encodeURIComponent(f.id)}`
      },
      // 事内按需页签/记录深链——搜「依赖」「记录」可直接落到对应视图
      {
        id: `deps:${f.id}`,
        label: `${f.title} · 依赖`,
        hint: "依赖页签",
        hash: `/focus/${encodeURIComponent(f.id)}?tab=deps`
      },
      {
        id: `records:${f.id}`,
        label: `${f.title} · 记录`,
        hint: "航迹与事件",
        hash: `/records/${encodeURIComponent(f.id)}`
      }
    ]);
    const all = [...PAGE_CMDS, ...focusCmds];
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((c) => c.label.toLowerCase().includes(needle) || c.id.toLowerCase().includes(needle));
  }, [q, focuses]);

  useEffect(() => {
    setSel(0);
  }, [q]);

  if (!open) return null;

  const go = (c: Cmd) => {
    navigate(c.hash);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-label="命令菜单"
      data-command-menu
      style={{
        position: "fixed", inset: 0, zIndex: 90,
        background: "var(--scrim)", display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "15vh"
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(560px, 92vw)", background: "var(--bg-app)", border: "1px solid var(--line)",
          borderRadius: "var(--radius-sm)", boxShadow: "var(--shadow-modal)", overflow: "hidden"
        }}
      >
        <input
          ref={inputRef}
          aria-label="搜索命令或事"
          placeholder="跳到…(页面 / 正在持续的事)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, items.length - 1)); return; }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); return; }
            if (e.key === "Enter" && items[sel]) { e.preventDefault(); go(items[sel]); }
          }}
          style={{
            width: "100%", padding: "12px 14px", fontSize: "var(--text-sm)",
            border: 0, borderBottom: "1px solid var(--line)", outline: "none",
            background: "transparent", color: "var(--text-primary)"
          }}
        />
        <div style={{ maxHeight: 320, overflowY: "auto" }} data-command-list>
          {items.length === 0 ? (
            <div style={{ padding: "14px", fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>没有匹配的命令</div>
          ) : (
            items.map((c, i) => (
              <button
                key={c.id}
                type="button"
                data-command-item={c.id}
                onMouseEnter={() => setSel(i)}
                onClick={() => go(c)}
                style={{
                  display: "flex", width: "100%", alignItems: "center", gap: 10,
                  padding: "9px 14px", border: 0, textAlign: "left", cursor: "pointer",
                  background: i === sel ? "var(--selected-wash)" : "transparent",
                  color: i === sel ? "var(--active-ink)" : "var(--text-primary)",
                  fontSize: "var(--text-sm)"
                }}
              >
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</span>
                {c.hint ? <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", flexShrink: 0 }}>{c.hint}</span> : null}
              </button>
            ))
          )}
        </div>
        <div style={{ padding: "6px 14px", fontSize: "var(--text-xs)", color: "var(--text-faint)", borderTop: "1px solid var(--line)" }}>
          ↑↓ 选择 · Enter 跳转 · Esc 关闭
        </div>
      </div>
    </div>
  );
}
