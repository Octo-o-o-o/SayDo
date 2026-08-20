// C7 Focus 只读列表页

import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";
import { PaperCard, EmptyState, ErrorCard } from "../components/ui";
import { Crosshair } from "lucide-react";

interface FocusRow {
  id: string;
  title: string;
  lifecycle: string;
  currentRevision: number;
  semanticAuthority: string;
  openObligationCount: number;
  updatedAt: string;
}

export function Focuses() {
  const [rows, setRows] = useState<FocusRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<FocusRow[]>("/api/focuses")
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <ErrorCard message="加载 Focus 列表失败" detail={error} />;
  if (!rows) return null;
  if (rows.length === 0) {
    return (
      <div data-page="focuses">
        <PaperCard>
          <EmptyState icon={Crosshair} text="还没有 Focus" />
        </PaperCard>
      </div>
    );
  }

  return (
    <div data-page="focuses" className="flex flex-col gap-[var(--space-4)]">
      <h1 style={{ fontSize: "var(--text-lg)", fontWeight: 600 }}>Focus</h1>
      <div className="flex flex-col gap-[var(--space-2)]" data-focus-list>
        {rows.map((r) => (
          <a
            key={r.id}
            href={`#/focus/${r.id}`}
            data-focus-id={r.id}
            className="no-underline"
            style={{ color: "inherit" }}
          >
            <PaperCard>
              <div className="flex items-center justify-between gap-[12px]">
                <div>
                  <div style={{ fontWeight: 600 }}>{r.title}</div>
                  <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                    {r.lifecycle} · r{r.currentRevision} · 未结义务 {r.openObligationCount}
                  </div>
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>{r.semanticAuthority}</div>
              </div>
            </PaperCard>
          </a>
        ))}
      </div>
    </div>
  );
}
