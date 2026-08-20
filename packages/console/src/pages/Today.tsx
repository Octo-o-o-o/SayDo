// 今天页(#/today,批次②):四色 attention 双列 + 继续聊 + Hero/空态。
// 视觉照抄 demo/saydo-console-redesign-proposal.html renderToday / .attn-item 四色。

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from "react";
import {
  ChevronRight,
  Flag,
  Hourglass,
  Inbox,
  Loader,
  Mic,
  User
} from "lucide-react";
import { apiGet, apiPost } from "../lib/api";
import { navigate } from "../lib/router";
import { EmptyState, ErrorCard, PaperCard } from "../components/ui";
import { AttentionItemCard } from "../components/redesign/AttentionItemCard";
import { TaskModal, type TaskModalTarget } from "../components/TaskModal";

type AttentionColor = "orange" | "blue" | "green" | "gray";

export interface AttentionItem {
  id: string;
  color: AttentionColor;
  title: string;
  focusId: string | null;
  focusTitle: string | null;
  action: "open_confirm" | "open_task_modal" | "open_focus";
  updatedAt: string;
  sessionId?: string;
  projectId?: string;
  needs?: string | null;
  laneId?: string | null;
  sourceKind?: "confirmation" | "obligation" | "task";
  refId?: string;
  /** T1 并行字段;后端未合入时容错 */
  ackedAt?: string;
}

interface FocusRow {
  id: string;
  title: string;
  lifecycle: string;
  updatedAt: string;
  openObligationCount?: number;
  openByOwner?: { human: number; agent: number; external: number };
  projectRefs?: string[];
}

const ORANGE_CAP = 5;

/** 橙区前端二次排序:ready_for_review > 确认卡 > blocked > 其余义务 > updatedAt 倒序 */
export function sortOrange(items: AttentionItem[]): AttentionItem[] {
  const rank = (it: AttentionItem): number => {
    if (it.sourceKind === "task" || it.id.startsWith("task:")) return 0;
    if (it.sourceKind === "confirmation" || it.action === "open_confirm" || it.id.startsWith("conf:")) return 1;
    if (it.title.startsWith("前置已终止")) return 2;
    if (it.sourceKind === "obligation" || it.id.startsWith("ob:")) return 3;
    return 4;
  };
  return [...items].sort((a, b) => {
    const d = rank(a) - rank(b);
    if (d !== 0) return d;
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  });
}

function openByOwnerText(ob?: { human: number; agent: number; external: number }): string | null {
  if (!ob) return null;
  const parts: string[] = [];
  if (ob.human > 0) parts.push(`你 ${ob.human} 件`);
  if (ob.agent > 0) parts.push(`我 ${ob.agent} 件`);
  if (ob.external > 0) parts.push(`等外部 ${ob.external} 件`);
  return parts.length > 0 ? parts.join(" · ") : "没有未结的事";
}

function lifecycleDot(lifecycle: string, humanOpen: number): string {
  if (humanOpen > 0 && (lifecycle === "active" || lifecycle === "captured")) return "var(--color-warning)";
  if (lifecycle === "active") return "var(--color-success)";
  if (lifecycle === "captured") return "var(--color-info)";
  if (lifecycle === "dormant") return "var(--text-faint)";
  return "var(--text-faint)";
}

const secTitle: CSSProperties = {
  fontSize: "var(--text-md)",
  fontWeight: 600,
  lineHeight: "var(--leading-tight)",
  marginBottom: "var(--space-3)",
  display: "flex",
  alignItems: "center",
  gap: 8
};

export function Today() {
  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const [focuses, setFocuses] = useState<FocusRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [orangeExpanded, setOrangeExpanded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [taskModal, setTaskModal] = useState<TaskModalTarget | null>(null);

  const load = useCallback(async () => {
    try {
      const [at, fo] = await Promise.all([
        apiGet<{ items: AttentionItem[] }>("/api/attention"),
        apiGet<FocusRow[]>("/api/focuses")
      ]);
      setAttention(at.items ?? []);
      setFocuses(fo ?? []);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const orange = useMemo(() => sortOrange(attention.filter((i) => i.color === "orange")), [attention]);
  const blue = useMemo(() => attention.filter((i) => i.color === "blue"), [attention]);
  const green = useMemo(() => attention.filter((i) => i.color === "green"), [attention]);
  const gray = useMemo(() => attention.filter((i) => i.color === "gray"), [attention]);

  const liveFocuses = useMemo(
    () =>
      focuses
        .filter((f) => ["active", "captured", "dormant"].includes(f.lifecycle))
        .slice()
        .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
        .slice(0, 5),
    [focuses]
  );

  const orangeShown = orangeExpanded ? orange : orange.slice(0, ORANGE_CAP);
  const orangeMore = orange.length - orangeShown.length;

  const isHero = attention.length === 0 && focuses.length === 0;
  const isAttnEmpty = attention.length === 0;

  const onItemClick = (it: AttentionItem) => {
    if (it.action === "open_confirm") {
      // 确认卡:跳对话页(有 projectId 则项目对话,否则开口聊)
      if (it.projectId) navigate(`/p/${encodeURIComponent(it.projectId)}/chat`);
      else navigate("/chat-new");
      return;
    }
    if (it.action === "open_focus" && it.focusId) {
      navigate(`/focus/${encodeURIComponent(it.focusId)}`);
      return;
    }
    // open_task_modal
    if (it.sourceKind === "task" || it.id.startsWith("task:")) {
      setTaskModal({
        kind: "task",
        id: it.refId ?? it.id.replace(/^task:/, ""),
        title: it.title,
        projectId: it.projectId,
        focusId: it.focusId
      });
      return;
    }
    if (it.sourceKind === "confirmation" || it.id.startsWith("conf:")) {
      setTaskModal({
        kind: "confirmation",
        receiptId: it.refId ?? it.id.replace(/^conf:/, ""),
        title: it.title,
        sessionId: it.sessionId,
        focusId: it.focusId
      });
      return;
    }
    setTaskModal({
      kind: "obligation",
      id: it.refId ?? it.id.replace(/^ob:/, ""),
      title: it.title,
      needs: it.needs,
      focusId: it.focusId
    });
  };

  const onAck = async (e: MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await apiPost<{ ok: true }>(`/api/attention/${encodeURIComponent(id)}/ack`, {});
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith("409") || msg.includes(" 409 ") || /\b409\b/.test(msg)) {
        setToast("这条还不能「知道了」(非绿/灰或状态已变)");
      } else if (msg.startsWith("404") || msg.includes(" 404 ") || /\b404\b/.test(msg)) {
        setToast("条目已不存在,已刷新");
      } else {
        setToast(msg || "知道了失败");
      }
      await load();
    }
  };

  if (error) return <ErrorCard message="加载今天失败" detail={error} />;

  if (isHero) {
    return (
      <div data-page="today" className="flex flex-col items-center justify-center gap-[var(--space-5)] py-[var(--space-8)]">
        <h1 style={{ margin: 0, fontSize: "var(--text-2xl)", fontWeight: 600, lineHeight: "var(--leading-tight)" }}>
          今天
        </h1>
        <p style={{ margin: 0, fontSize: "var(--text-base)", color: "var(--text-muted)", maxWidth: 420, textAlign: "center" }}>
          还没有要持续关注的事。开口聊,聊成熟了我会问你要不要立起来。
        </p>
        <a
          href="#/chat-new"
          className="no-underline"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "var(--active-ink)",
            color: "var(--active-ink-fg)",
            borderRadius: "var(--radius-xs)",
            padding: "10px 20px",
            fontSize: "var(--text-sm)",
            fontWeight: 500
          }}
        >
          <Mic size={16} aria-hidden />
          开口聊
        </a>
      </div>
    );
  }

  return (
    <div data-page="today" style={{ maxWidth: 1180, margin: "0 auto" }}>
      {toast ? (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
            background: "var(--surface-raised)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-sm)",
            padding: "10px 16px",
            fontSize: "var(--text-sm)",
            color: "var(--text-primary)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          {toast}
        </div>
      ) : null}

      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
        <span style={{ fontSize: "var(--text-xl)", fontWeight: 600, lineHeight: "var(--leading-tight)" }}>今天</span>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
          {orange.length} 件需要你
          {blue.length > 0 ? ` · ${blue.length} 件等你的动作` : ""}
          {` · ${green.length} 件我在做`}
        </span>
      </div>

      <div
        className="today-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr",
          gap: "var(--space-5)",
          alignItems: "start"
        }}
      >
        {/* 左列:橙 + 蓝 */}
        <section>
          <div style={{ ...secTitle, color: "var(--color-warning)" }}>
            <Flag size={14} aria-hidden /> 需要你
          </div>
          {isAttnEmpty || orange.length === 0 ? (
            <p
              data-attn-empty
              style={{ margin: "0 0 var(--space-3)", fontSize: "var(--text-sm)", color: "var(--text-faint)" }}
            >
              没有需要你的事
            </p>
          ) : (
            <>
              {orangeShown.map((it) => (
                <AttentionItemCard key={it.id} item={it} onOpen={() => onItemClick(it)} />
              ))}
              {orangeMore > 0 ? (
                <button
                  type="button"
                  data-orange-expand
                  onClick={() => setOrangeExpanded(true)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--active-ink)",
                    fontSize: "var(--text-sm)",
                    cursor: "pointer",
                    padding: "4px 0",
                    marginBottom: "var(--space-3)"
                  }}
                >
                  还有 {orangeMore} 条,按 验收→审批确认→卡住→挂账义务 排,展开
                </button>
              ) : null}
            </>
          )}

          {blue.length > 0 ? (
            <>
              <div style={{ ...secTitle, marginTop: "var(--space-4)", color: "var(--active-ink)" }}>
                <User size={14} aria-hidden /> 等你的动作
              </div>
              {blue.map((it) => (
                <AttentionItemCard key={it.id} item={it} onOpen={() => onItemClick(it)} />
              ))}
            </>
          ) : null}
        </section>

        {/* 右列:绿 + 灰 + 继续聊 */}
        <section>
          <div style={{ ...secTitle, color: "var(--color-success)" }}>
            <Loader size={14} aria-hidden /> 我在做,你不用管
          </div>
          {green.length === 0 ? (
            <p style={{ margin: "0 0 var(--space-3)", fontSize: "var(--text-sm)", color: "var(--text-faint)" }}>
              手上暂时没有活
            </p>
          ) : (
            green.map((it) => (
              <AttentionItemCard key={it.id} item={it} calm onAck={(e) => void onAck(e, it.id)} onOpen={() => onItemClick(it)} />
            ))
          )}

          <div style={{ ...secTitle, marginTop: "var(--space-4)", color: "var(--text-muted)" }}>
            <Hourglass size={14} aria-hidden /> 等外部(我在待命,到了会叫你)
          </div>
          {gray.length === 0 ? (
            <p style={{ margin: "0 0 var(--space-3)", fontSize: "var(--text-sm)", color: "var(--text-faint)" }}>
              没有等外部的事
            </p>
          ) : (
            gray.map((it) => (
              <AttentionItemCard key={it.id} item={it} calm onAck={(e) => void onAck(e, it.id)} onOpen={() => onItemClick(it)} />
            ))
          )}

          <PaperCard className="mt-[var(--space-4)]">
            <div style={{ ...secTitle, marginBottom: "var(--space-3)" }}>继续聊</div>
            {liveFocuses.length === 0 ? (
              <EmptyState icon={Inbox} text="还没有持续中的事" action={<a href="#/chat-new">开口聊</a>} />
            ) : (
              <div className="flex flex-col gap-[var(--space-2)]" data-focus-quick>
                {liveFocuses.map((f) => {
                  const sub = openByOwnerText(f.openByOwner);
                  const human = f.openByOwner?.human ?? 0;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      data-focus-quick={f.id}
                      onClick={() => navigate(`/focus/${encodeURIComponent(f.id)}`)}
                      className="flex items-center gap-[var(--space-3)]"
                      style={{
                        padding: "10px var(--space-3)",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid transparent",
                        width: "100%",
                        textAlign: "left",
                        background: "transparent",
                        cursor: "pointer",
                        color: "var(--text-primary)"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--hover-wash)";
                        e.currentTarget.style.borderColor = "var(--line)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.borderColor = "transparent";
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "var(--radius-pill)",
                          flexShrink: 0,
                          background: lifecycleDot(f.lifecycle, human)
                        }}
                      />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontSize: "var(--text-sm)"
                          }}
                        >
                          {f.title}
                        </span>
                        {sub !== null ? (
                          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>{sub}</span>
                        ) : null}
                      </span>
                      <ChevronRight size={13} color="var(--text-faint)" aria-hidden />
                    </button>
                  );
                })}
              </div>
            )}
          </PaperCard>
        </section>
      </div>

      {taskModal ? (
        <TaskModal target={taskModal} onClose={() => setTaskModal(null)} onDone={() => void load()} />
      ) : null}

      <style>{`
        @media (max-width: 980px) {
          .today-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
