// 归档页(#/archive;DAILY-01 R09):已归档 Focus 清单 + 恢复入口。
// 恢复语义(09 §15.2):reopen 只把 lifecycle 拉回 active,不派发、不续跑、不动任务态。

import { useCallback, useEffect, useState } from "react";
import { Archive } from "lucide-react";
import { apiGet, apiPost } from "../lib/api";
import { EmptyState, ErrorCard, PaperCard, Mono, SectionTitle } from "../components/ui";

interface ArchivedFocus {
  id: string;
  title: string;
  lifecycle: string;
  currentRevision: number;
  updatedAt: string;
  openObligationCount: number;
}

export function ArchivePage() {
  const [rows, setRows] = useState<ArchivedFocus[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<ArchivedFocus[]>("/api/focuses")
      .then((d) => setRows(d.filter((f) => f.lifecycle === "archived" || f.lifecycle === "closed" || f.lifecycle === "abandoned")))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(load, [load]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const reopen = (f: ArchivedFocus) => {
    if (!window.confirm(`恢复「${f.title}」?恢复只把这件事拉回活跃,不会自动派发或续跑任何任务。`)) return;
    void apiPost(`/api/focuses/${encodeURIComponent(f.id)}/reopen`, {}).then(
      () => { setToast("已恢复为活跃;任务不会自动续跑"); load(); },
      (e: unknown) => setToast(String(e instanceof Error ? e.message : e))
    );
  };

  if (error) return <ErrorCard message="归档加载失败" detail={error} />;
  if (!rows) return null;

  return (
    <div className="flex flex-col gap-[var(--space-4)]" data-page="archive">
      <SectionTitle>归档</SectionTitle>
      {toast ? <PaperCard><Mono>{toast}</Mono></PaperCard> : null}
      {rows.length === 0 ? (
        <PaperCard><EmptyState icon={Archive} text="还没有归档的事;归档后在这里找回" /></PaperCard>
      ) : (
        <PaperCard>
          <div className="flex flex-col" data-archive-list>
            {rows.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-[12px]" style={{ padding: "10px 0", borderTop: "1px solid var(--line)", flexWrap: "wrap" }} data-archive-row={f.id}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <a href={`#/focus/${encodeURIComponent(f.id)}`} style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-primary)" }}>{f.title}</a>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>
                    {f.lifecycle} · r{f.currentRevision} · 未结义务 {f.openObligationCount} · {f.updatedAt?.slice(0, 16)}
                  </div>
                </div>
                <div className="flex items-center gap-[6px]" style={{ flexShrink: 0 }}>
                  <a
                    href={`#/records/${encodeURIComponent(f.id)}`}
                    style={{ fontSize: "var(--text-xs)", padding: "4px 10px", borderRadius: "var(--radius-xs)", border: "1px solid var(--line)", color: "var(--text-secondary)", textDecoration: "none" }}
                    data-archive-records={f.id}
                  >
                    看记录
                  </a>
                  {f.lifecycle === "archived" ? (
                    <button
                      type="button"
                      data-archive-reopen={f.id}
                      style={{ fontSize: "var(--text-xs)", padding: "4px 10px", borderRadius: "var(--radius-xs)", border: "1px solid var(--line)", background: "transparent", cursor: "pointer", color: "var(--text-secondary)" }}
                      onClick={() => reopen(f)}
                    >
                      恢复活跃
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </PaperCard>
      )}
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
        归档不删数据:航迹、依赖、产物原样保留。恢复只拉回生命周期,不自动续跑——要继续得在「记录」页明说。
      </div>
    </div>
  );
}
