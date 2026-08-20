// 项目记忆(#/p/:id/memory;M1-M3 活跃投影;trust 层视觉映射 11 §2.6)。
// W2 阶段 C:候选区(会后提炼提名)+ 批准/拒绝操作——只提名、人批准(04 §1.3);
// 批准 -> trusted 进 M1 并刷新 .saydo/knowledge/m1-notes.md 投影。

import { useState } from "react";
import { Database, FlaskConical } from "lucide-react";
import { api } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { EmptyState, ErrorCard, PaperCard, SectionTitle } from "../components/ui";

const TRUST_STYLE: Record<string, { border: string; color: string; flask?: boolean }> = {
  user_stated: { border: "var(--active-ink-border)", color: "var(--active-ink)" },
  user_approved: { border: "var(--color-success)", color: "var(--color-success)" },
  auto_low_impact: { border: "var(--line)", color: "var(--text-muted)" },
  candidate: { border: "var(--line)", color: "var(--text-faint)", flask: true },
  third_party: { border: "var(--line)", color: "var(--text-faint)", flask: true }
};

const candBtn = (danger: boolean): React.CSSProperties => ({
  height: 26,
  padding: "0 10px",
  borderRadius: "var(--radius-xs)",
  border: `1px solid ${danger ? "var(--line)" : "var(--color-success)"}`,
  background: "transparent",
  color: danger ? "var(--text-muted)" : "var(--color-success)",
  fontSize: "var(--text-xs)",
  cursor: "pointer"
});

export function Memory({ projectId }: { projectId: string }) {
  const [bump, setBump] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error } = useAsync(() => api.memory(projectId), [projectId, bump]);
  if (error) return <ErrorCard message="记忆加载失败" detail={error} />;
  const facts = data ?? [];
  const candidates = facts.filter((f) => String(f["trust"]) === "candidate");
  const settled = facts.filter((f) => String(f["trust"]) !== "candidate");
  const act = (id: string, action: "approve" | "reject") => {
    void (action === "approve" ? api.approveMemory(id) : api.rejectMemory(id))
      .then(() => {
        setActionError(null);
        setBump((n) => n + 1);
      })
      .catch((e: Error) => setActionError(e.message));
  };
  const row = (f: Record<string, unknown>, actions: boolean) => {
    const trust = String(f["trust"]);
    const st = TRUST_STYLE[trust] ?? TRUST_STYLE["auto_low_impact"]!;
    return (
      <div key={String(f["id"])} className="flex items-center gap-[10px]" style={{ padding: "10px 0", borderTop: "1px solid var(--line)", fontSize: "var(--text-sm)" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--text-faint)", width: 28 }}>
          {String(f["tier"])}
        </span>
        <span style={{ flex: 1 }}>{String(f["claim"])}</span>
        {actions ? (
          <span className="inline-flex items-center gap-[6px]" data-candidate-actions>
            <button style={candBtn(false)} data-action="memory-approve" onClick={() => act(String(f["id"]), "approve")}>
              记住(转正)
            </button>
            <button style={candBtn(true)} data-action="memory-reject" onClick={() => act(String(f["id"]), "reject")}>
              不记
            </button>
          </span>
        ) : null}
        <span
          className="inline-flex items-center gap-[4px]"
          style={{
            fontSize: "var(--text-xs)",
            color: st.color,
            border: `1px solid ${st.border}`,
            borderRadius: "var(--radius-pill)",
            padding: "2px 8px"
          }}
        >
          {st.flask ? <FlaskConical size={11} aria-hidden /> : null}
          {trust}
        </span>
      </div>
    );
  };
  return (
    <div data-page="memory">
      {candidates.length > 0 ? (
        <>
          <SectionTitle>待你确认的候选(会后提炼,批准才进记忆)</SectionTitle>
          {actionError ? <ErrorCard message="操作失败" detail={actionError} /> : null}
          <PaperCard>
            <div className="flex flex-col" data-candidate-list>
              {candidates.map((f) => row(f, true))}
            </div>
          </PaperCard>
          <div style={{ height: 16 }} />
        </>
      ) : null}
      <SectionTitle>记忆库(M1-M3)</SectionTitle>
      <PaperCard>
        {settled.length === 0 ? (
          <EmptyState icon={Database} text="还没有项目记忆;对话与执行会沉淀到这里" />
        ) : (
          <div className="flex flex-col" data-memory-list>
            {settled.map((f) => row(f, false))}
          </div>
        )}
      </PaperCard>
    </div>
  );
}
