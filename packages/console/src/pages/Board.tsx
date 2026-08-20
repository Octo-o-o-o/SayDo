// 看板主页(#/board,批 2):空间条 + 今天需要你 + 按 lifecycle 分组卡流 + 新建 Focus 双通道。
// 视觉对齐仓根 design-ref / Demo v5;样式走 console CSS 变量体系。

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronDown, LayoutGrid, Pencil, Plus, X } from "lucide-react";
import { apiGet, apiPost } from "../lib/api";
import { navigate } from "../lib/router";
import { EmptyState, ErrorCard, PaperCard, SectionTitle } from "../components/ui";
import { TaskModal, type TaskModalTarget } from "../components/TaskModal";

// 球权四色:全站唯一来源是语义 token(与 AttentionItemCard/Chat/FocusDetail 同口径)
const BALL = {
  orange: "var(--color-warning)",
  blue: "var(--active-ink)",
  green: "var(--color-success)",
  gray: "var(--text-faint)"
} as const;

interface SpaceRow {
  id: string;
  title: string;
  focusCount: number;
}

interface FocusRow {
  id: string;
  title: string;
  lifecycle: string;
  currentRevision: number;
  openObligationCount: number;
  updatedAt: string;
  spaceId: string | null;
  direction: string | null;
}

interface AttentionItem {
  id: string;
  color: "orange" | "blue" | "green" | "gray";
  title: string;
  focusId: string | null;
  focusTitle: string | null;
  action: "open_confirm" | "open_task_modal" | "open_focus";
  updatedAt: string;
  sessionId?: string;
  projectId?: string;
  needs?: string | null;
  sourceKind?: "confirmation" | "obligation" | "task";
  refId?: string;
  laneId?: string | null;
}

interface ArtifactRow {
  id: string;
  role: string;
  title: string;
}

function lifecycleLabel(lc: string): string {
  switch (lc) {
    case "active":
      return "进行中";
    case "captured":
      return "刚建";
    case "dormant":
      return "睡眠 · 等外部";
    case "closed":
      return "已收官";
    case "archived":
      return "归档";
    case "abandoned":
      return "已放弃";
    default:
      return lc;
  }
}

function actionLabel(a: AttentionItem["action"]): string {
  if (a === "open_confirm") return "去确认";
  if (a === "open_task_modal") return "去处理";
  return "看详情";
}

function defaultFocusTitle(): string {
  const d = new Date();
  return `未命名 Focus·${d.getMonth() + 1}/${d.getDate()}`;
}

const btnPrimary: CSSProperties = {
  background: "var(--active-ink)",
  color: "var(--active-ink-fg)",
  border: "none",
  borderRadius: "var(--radius-xs)",
  height: 36,
  padding: "0 16px",
  fontSize: "var(--text-sm)",
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6
};

const btnGhost: CSSProperties = {
  background: "transparent",
  color: "var(--text-secondary)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-xs)",
  height: 32,
  padding: "0 12px",
  fontSize: "var(--text-sm)",
  cursor: "pointer"
};

export function Board() {
  const [spaces, setSpaces] = useState<SpaceRow[]>([]);
  const [focuses, setFocuses] = useState<FocusRow[]>([]);
  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const [artifactsByFocus, setArtifactsByFocus] = useState<Record<string, ArtifactRow[]>>({});
  const [spaceFilter, setSpaceFilter] = useState<string | "all">("all");
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [taskModal, setTaskModal] = useState<TaskModalTarget | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const [sp, fo, at] = await Promise.all([
        apiGet<{ spaces: SpaceRow[] }>("/api/spaces"),
        apiGet<FocusRow[]>("/api/focuses"),
        apiGet<{ items: AttentionItem[] }>("/api/attention")
      ]);
      setSpaces(sp.spaces ?? []);
      setFocuses(fo ?? []);
      setAttention(at.items ?? []);
      setError(null);

      // 收官卡产物:并行拉 closed 的 artifacts
      const closed = (fo ?? []).filter((f) => f.lifecycle === "closed");
      if (closed.length > 0) {
        const pairs = await Promise.all(
          closed.map(async (f) => {
            try {
              const r = await apiGet<{ artifacts: ArtifactRow[] }>(
                `/api/focuses/${encodeURIComponent(f.id)}/artifacts`
              );
              return [f.id, r.artifacts ?? []] as const;
            } catch {
              return [f.id, [] as ArtifactRow[]] as const;
            }
          })
        );
        const map: Record<string, ArtifactRow[]> = {};
        for (const [id, arts] of pairs) map[id] = arts;
        setArtifactsByFocus(map);
      }
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
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const filtered = useMemo(() => {
    if (spaceFilter === "all") return focuses;
    return focuses.filter((f) => f.spaceId === spaceFilter);
  }, [focuses, spaceFilter]);

  const activeList = filtered.filter((f) => f.lifecycle === "active" || f.lifecycle === "captured");
  const dormantList = filtered.filter((f) => f.lifecycle === "dormant");
  const closedList = filtered.filter((f) => f.lifecycle === "closed");
  const archivedList = filtered.filter((f) => f.lifecycle === "archived");

  // 今天需要你:只橙+蓝
  const needYou = attention.filter((i) => i.color === "orange" || i.color === "blue");

  const currentSpaceName =
    spaceFilter === "all" ? "全部" : (spaces.find((s) => s.id === spaceFilter)?.title ?? "全部");

  const ballLine = (focusId: string): { text: string; calm: boolean } => {
    const mine = attention.filter((i) => i.focusId === focusId);
    const orange = mine.find((i) => i.color === "orange");
    if (orange) return { text: `下一步需要你:${orange.title}`, calm: false };
    const blue = mine.find((i) => i.color === "blue");
    if (blue) return { text: `等你启动:${blue.title}`, calm: false };
    return { text: "不需要你,推进中", calm: true };
  };

  const grayFirst = (focusId: string): string | null => {
    const g = attention.find((i) => i.focusId === focusId && i.color === "gray");
    return g?.title ?? null;
  };

  const onAttentionClick = (it: AttentionItem) => {
    if (it.action === "open_focus" && it.focusId) {
      navigate(`/focus/${encodeURIComponent(it.focusId)}`);
      return;
    }
    if (it.sourceKind === "confirmation" || it.action === "open_confirm") {
      setTaskModal({
        kind: "confirmation",
        receiptId: it.refId ?? it.id.replace(/^conf:/, ""),
        title: it.title,
        sessionId: it.sessionId,
        focusId: it.focusId
      });
      return;
    }
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
    setTaskModal({
      kind: "obligation",
      id: it.refId ?? it.id.replace(/^ob:/, ""),
      title: it.title,
      needs: it.needs,
      focusId: it.focusId
    });
  };

  const createSpace = async () => {
    const title = window.prompt("新空间名称");
    if (!title?.trim()) return;
    await apiPost("/api/spaces", { title: title.trim() });
    setMenuOpen(false);
    await load();
  };

  const renameSpace = async (id: string, cur: string) => {
    const title = window.prompt("重命名空间", cur);
    if (!title?.trim() || title.trim() === cur) return;
    await apiPost(`/api/spaces/${encodeURIComponent(id)}/rename`, { title: title.trim() });
    await load();
  };

  const deleteSpace = async (id: string) => {
    if (!window.confirm("空间删除后,里面的 Focus 移回「全部」,不会删 Focus")) return;
    await apiPost(`/api/spaces/${encodeURIComponent(id)}/delete`, {});
    if (spaceFilter === id) setSpaceFilter("all");
    setMenuOpen(false);
    await load();
  };

  const reopen = async (id: string) => {
    await apiPost(`/api/focuses/${encodeURIComponent(id)}/reopen`, {});
    await load();
  };

  if (error) return <ErrorCard message="加载看板失败" detail={error} />;

  return (
    <div data-page="board" className="flex flex-col gap-[var(--space-4)]">
      {/* 空间条 */}
      <div className="flex items-center gap-[12px]" data-space-bar>
        <div ref={menuRef} style={{ position: "relative" }}>
          <button
            type="button"
            data-space-current
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              ...btnGhost,
              height: 36,
              fontWeight: 600,
              color: "var(--text-primary)",
              background: "var(--surface-control)"
            }}
          >
            {currentSpaceName}
            <ChevronDown size={14} aria-hidden />
          </button>
          {menuOpen ? (
            <div
              data-space-menu
              style={{
                position: "absolute",
                top: 40,
                left: 0,
                zIndex: 20,
                minWidth: 220,
                background: "var(--surface-raised)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-sm)",
                boxShadow: "var(--shadow-card)",
                padding: 6,
              }}
            >
              <SpaceMenuItem
                label="全部"
                count={focuses.length}
                active={spaceFilter === "all"}
                onClick={() => {
                  setSpaceFilter("all");
                  setMenuOpen(false);
                }}
              />
              {spaces.map((s) => (
                <SpaceMenuItem
                  key={s.id}
                  label={s.title}
                  count={s.focusCount}
                  active={spaceFilter === s.id}
                  onClick={() => {
                    setSpaceFilter(s.id);
                    setMenuOpen(false);
                  }}
                  onRename={() => void renameSpace(s.id, s.title)}
                  onDelete={() => void deleteSpace(s.id)}
                />
              ))}
              <button
                type="button"
                onClick={() => void createSpace()}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  background: "transparent",
                  color: "var(--active-ink)",
                  fontSize: "var(--text-sm)",
                  fontWeight: 600,
                  padding: "8px 10px",
                  cursor: "pointer",
                  borderRadius: "var(--radius-xs)"
                }}
              >
                + 新空间
              </button>
            </div>
          ) : null}
        </div>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", flex: 1 }}>
          空间=Focus 的分组;「全部」看全局
        </span>
        <button type="button" data-new-focus style={btnPrimary} onClick={() => setNewOpen(true)}>
          <Plus size={16} aria-hidden />
          新 Focus
        </button>
      </div>

      {/* 今天需要你 */}
      <PaperCard>
        <div className="flex items-baseline gap-[10px]" style={{ marginBottom: "var(--space-3)" }}>
          <SectionTitle>今天需要你</SectionTitle>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
            跨所有 Focus 聚合 · 只列要你出手的
          </span>
        </div>
        {needYou.length === 0 ? (
          <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-muted)" }} data-need-empty>
            今天不需要你,都在推进中
          </p>
        ) : (
          <div className="flex flex-col gap-[8px]" data-need-list>
            {needYou.map((it) => (
              <button
                key={it.id}
                type="button"
                data-attention-id={it.id}
                onClick={() => onAttentionClick(it)}
                className="flex items-center gap-[10px]"
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--surface-control)",
                  padding: "10px 12px",
                  cursor: "pointer",
                  textAlign: "left",
                  color: "var(--text-primary)",
                  width: "100%"
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "var(--radius-pill)",
                    background: BALL[it.color],
                    flexShrink: 0
                  }}
                />
                <span style={{ fontSize: "var(--text-sm)", fontWeight: 500, flex: 1 }}>{it.title}</span>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", whiteSpace: "nowrap" }}>
                  {it.focusTitle ?? "—"}
                </span>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--active-ink)", whiteSpace: "nowrap" }}>
                  {actionLabel(it.action)}
                </span>
              </button>
            ))}
          </div>
        )}
      </PaperCard>

      {/* 进行中 */}
      {activeList.length > 0 ? (
        <section data-group="active">
          <GroupTitle>进行中</GroupTitle>
          <div className="flex flex-col gap-[var(--space-3)]">
            {activeList.map((f) => {
              const ball = ballLine(f.id);
              return (
                <a
                  key={f.id}
                  href={`#/focus/${f.id}`}
                  className="no-underline"
                  style={{ color: "inherit" }}
                  data-focus-card={f.id}
                >
                  <PaperCard>
                    <div className="flex items-center gap-[10px]" style={{ marginBottom: 6 }}>
                      <h3 style={{ margin: 0, fontSize: "var(--text-md)", fontWeight: 600 }}>{f.title}</h3>
                      <LifecycleBadge lifecycle={f.lifecycle} />
                      <span style={{ marginLeft: "auto", fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
                        账上 {f.openObligationCount} 件事
                      </span>
                    </div>
                    {f.direction ? (
                      <p style={{ margin: "0 0 10px", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                        {f.direction}
                      </p>
                    ) : (
                      <p style={{ margin: "0 0 10px", fontSize: "var(--text-sm)", color: "var(--text-faint)" }}>
                        方向未定
                      </p>
                    )}
                    <div
                      style={{
                        borderTop: "1px dashed var(--line)",
                        paddingTop: 8,
                        fontSize: "var(--text-sm)",
                        color: ball.calm ? "var(--text-faint)" : "var(--text-secondary)"
                      }}
                    >
                      {ball.text}
                    </div>
                  </PaperCard>
                </a>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* 等外部 */}
      {dormantList.length > 0 ? (
        <section data-group="dormant">
          <GroupTitle>等外部</GroupTitle>
          <div className="flex flex-col gap-[var(--space-2)]">
            {dormantList.map((f) => (
              <a
                key={f.id}
                href={`#/focus/${f.id}`}
                className="no-underline"
                style={{ color: "inherit" }}
                data-focus-card={f.id}
              >
                <PaperCard>
                  <div className="flex items-center gap-[10px]">
                    <h3 style={{ margin: 0, fontSize: "var(--text-md)", fontWeight: 600 }}>{f.title}</h3>
                    <LifecycleBadge lifecycle={f.lifecycle} />
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                    {grayFirst(f.id) ? `等什么:${grayFirst(f.id)}` : "有信我叫你"}
                  </p>
                </PaperCard>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {/* 已收官 */}
      {closedList.length > 0 ? (
        <section data-group="closed">
          <GroupTitle>已收官 · 看产物</GroupTitle>
          <div className="flex flex-col gap-[var(--space-2)]">
            {closedList.map((f) => {
              const arts = (artifactsByFocus[f.id] ?? []).filter(
                (a) => a.role === "deliverable" || a.role === "expected"
              );
              return (
                <div key={f.id} data-focus-card={f.id}>
                  <PaperCard>
                    <div className="flex items-center gap-[10px]" style={{ marginBottom: 8 }}>
                      <h3 style={{ margin: 0, fontSize: "var(--text-md)", fontWeight: 600 }}>{f.title}</h3>
                      <LifecycleBadge lifecycle={f.lifecycle} />
                    </div>
                    <div className="flex flex-wrap gap-[6px]" style={{ marginBottom: 10 }}>
                      {arts.length === 0 ? (
                        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-faint)" }}>未登记产物</span>
                      ) : (
                        arts.map((a) => (
                          <span
                            key={a.id}
                            style={{
                              fontSize: "var(--text-xs)",
                              color: "var(--text-secondary)",
                              background: "var(--surface-control)",
                              border: "1px solid var(--line)",
                              borderRadius: "var(--radius-pill)",
                              padding: "2px 10px"
                            }}
                          >
                            {a.title}
                          </span>
                        ))
                      )}
                    </div>
                    <button
                      type="button"
                      style={btnGhost}
                      onClick={() => alert("续开批3接入")}
                    >
                      以此为底,续开新一轮
                    </button>
                  </PaperCard>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* 归档(无项不渲染) */}
      {archivedList.length > 0 ? (
        <section data-group="archived">
          <GroupTitle>归档</GroupTitle>
          <div className="flex flex-col gap-[6px]">
            {archivedList.map((f) => (
              <div
                key={f.id}
                data-focus-card={f.id}
                className="flex items-center gap-[12px]"
                style={{
                  padding: "8px 12px",
                  borderRadius: "var(--radius-xs)",
                  border: "1px solid transparent",
                  fontSize: "var(--text-sm)",
                  color: "var(--text-muted)"
                }}
              >
                <span style={{ color: "var(--text-secondary)", flex: 1 }}>{f.title}</span>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
                  归档于 {f.updatedAt.slice(0, 10)}
                </span>
                <button type="button" style={btnGhost} onClick={() => void reopen(f.id)}>
                  重新打开
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {filtered.length === 0 ? (
        <PaperCard>
          <EmptyState icon={LayoutGrid} text="还没有 Focus,点右上角新建,或从空白开聊" />
        </PaperCard>
      ) : null}

      {newOpen ? (
        <NewFocusModal
          spaces={spaces}
          onClose={() => setNewOpen(false)}
          onCreated={async () => {
            setNewOpen(false);
            await load();
          }}
        />
      ) : null}

      {taskModal ? (
        <TaskModal target={taskModal} onClose={() => setTaskModal(null)} onDone={() => void load()} />
      ) : null}
    </div>
  );
}

function GroupTitle({ children }: { children: string }) {
  return (
    <h2
      style={{
        fontSize: "var(--text-sm)",
        fontWeight: 600,
        color: "var(--text-faint)",
        margin: "8px 2px 10px"
      }}
    >
      {children}
    </h2>
  );
}

function LifecycleBadge({ lifecycle }: { lifecycle: string }) {
  const muted = lifecycle === "dormant" || lifecycle === "closed" || lifecycle === "archived";
  return (
    <span
      style={{
        fontSize: "var(--text-xs)",
        padding: "1px 8px",
        borderRadius: "var(--radius-pill)",
        background: muted ? "var(--surface-control)" : "var(--active-ink-wash)",
        color: muted ? "var(--text-muted)" : "var(--active-ink)",
        border: "1px solid var(--line)"
      }}
    >
      {lifecycleLabel(lifecycle)}
    </span>
  );
}

function SpaceMenuItem({
  label,
  count,
  active,
  onClick,
  onRename,
  onDelete
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className="flex items-center gap-[6px]"
      style={{
        borderRadius: "var(--radius-xs)",
        background: active ? "var(--selected-wash)" : "transparent",
        padding: "4px 6px"
      }}
      onMouseEnter={(e) => {
        const ops = e.currentTarget.querySelector<HTMLElement>("[data-ops]");
        if (ops) ops.style.opacity = "1";
      }}
      onMouseLeave={(e) => {
        const ops = e.currentTarget.querySelector<HTMLElement>("[data-ops]");
        if (ops) ops.style.opacity = "0";
      }}
    >
      <button
        type="button"
        onClick={onClick}
        style={{
          flex: 1,
          textAlign: "left",
          border: "none",
          background: "transparent",
          color: active ? "var(--active-ink)" : "var(--text-primary)",
          fontSize: "var(--text-sm)",
          padding: "4px 4px",
          cursor: "pointer"
        }}
      >
        {label}{" "}
        <span style={{ color: "var(--text-faint)", fontSize: "var(--text-xs)" }}>{count}</span>
      </button>
      {onRename || onDelete ? (
        <span data-ops className="flex items-center gap-[2px]" style={{ opacity: 0, transition: "opacity 120ms" }}>
          {onRename ? (
            <button
              type="button"
              title="重命名"
              onClick={(e) => {
                e.stopPropagation();
                onRename();
              }}
              style={{ border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", padding: 2 }}
            >
              <Pencil size={12} aria-hidden />
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              title="删除"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              style={{ border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", padding: 2 }}
            >
              <X size={12} aria-hidden />
            </button>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

function NewFocusModal({
  spaces,
  onClose,
  onCreated
}: {
  spaces: SpaceRow[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [direction, setDirection] = useState("");
  const [spaceId, setSpaceId] = useState<string>("");
  const [projectPath, setProjectPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const body: { title: string; direction?: string; spaceId?: string | null } = {
        title: title.trim() || defaultFocusTitle()
      };
      if (direction.trim()) body.direction = direction.trim();
      body.spaceId = spaceId ? spaceId : null;
      await apiPost("/api/focuses", body);
      // 关联项目路径本批只存不校验——建后若填了路径不处理
      // TODO(批 3+):POST 后若 projectPath 非空,写 focus_project_refs / 校验 workspace
      void projectPath;
      await onCreated();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const field: CSSProperties = {
    width: "100%",
    height: 34,
    padding: "0 10px",
    borderRadius: "var(--radius-xs)",
    border: "1px solid var(--line)",
    background: "var(--surface-control)",
    color: "var(--text-primary)",
    fontSize: "var(--text-sm)"
  };

  return (
    <div
      data-new-focus-modal
      role="dialog"
      aria-modal
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        background: "var(--scrim)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(640px, 100%)",
          background: "var(--surface-raised)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-card)",
          padding: "var(--space-5)",
        }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: 600 }}>新 Focus</h2>
          <button type="button" onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text-muted)" }}>
            <X size={18} aria-hidden />
          </button>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16
          }}
        >
          <div>
            <h3 style={{ margin: "0 0 10px", fontSize: "var(--text-sm)", fontWeight: 600 }}>填好再建</h3>
            <label style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", display: "block", marginBottom: 4 }}>
              名字
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={defaultFocusTitle()}
              style={{ ...field, marginBottom: 10 }}
            />
            <label style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", display: "block", marginBottom: 4 }}>
              一句话方向(可空)
            </label>
            <input
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              placeholder="比如:把 HN 分发跑通"
              style={{ ...field, marginBottom: 10 }}
            />
            <label style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", display: "block", marginBottom: 4 }}>
              归哪个空间
            </label>
            <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)} style={{ ...field, marginBottom: 10 }}>
              <option value="">暂不归</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <label style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", display: "block", marginBottom: 4 }}>
              关联项目路径(可空)
            </label>
            <input
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              placeholder="~/work/my-app"
              style={{ ...field, marginBottom: 12 }}
            />
            {err ? (
              <p style={{ margin: "0 0 8px", fontSize: "var(--text-xs)", color: "var(--color-error)" }}>{err}</p>
            ) : null}
            <button type="button" disabled={busy} onClick={() => void submit()} style={{ ...btnPrimary, width: "100%", justifyContent: "center" }}>
              {busy ? "创建中…" : "创建"}
            </button>
          </div>
          <div>
            <h3 style={{ margin: "0 0 10px", fontSize: "var(--text-sm)", fontWeight: 600 }}>从空白开始</h3>
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate("/chat");
              }}
              style={{
                width: "100%",
                border: "1px dashed var(--active-ink)",
                background: "var(--active-ink-wash)",
                color: "var(--active-ink)",
                borderRadius: "var(--radius-xs)",
                padding: "18px 12px",
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                cursor: "pointer",
                textAlign: "center"
              }}
            >
              直接开聊
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 400, marginTop: 6 }}>
                说着说着成形,AI 提议立 Focus 经确认
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
