// 产物库(#/p/:id/artifacts;modules/b B4)。
// W5a 3.6 控制面:时间线(按 id 分组,version/supersedes 链)+ 相邻版本 diff + 子集导出(JSON bundle)。
// sqlite-vec 语义检索不做(PLAN-2 §6-7 挂检索 miss 证据)。

import { useState } from "react";
import { Package } from "lucide-react";
import { api, type Row } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { EmptyState, ErrorCard, PaperCard, Mono, SectionTitle } from "../components/ui";

interface DiffState {
  artifactId: string;
  from: number;
  to: number;
  truncated: boolean;
  lines: { kind: "same" | "add" | "del"; text: string }[];
}

export function Artifacts({ projectId }: { projectId: string }) {
  const { data, error } = useAsync(() => api.artifacts(projectId), [projectId]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [diff, setDiff] = useState<DiffState | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  if (error) return <ErrorCard message="产物加载失败" detail={error} />;
  const arts = data ?? [];

  // 时间线分组:同 id 的版本聚为一组,版本降序(最新在上;supersedes 链即相邻版本关系)
  const groups = new Map<string, Row[]>();
  for (const a of arts) {
    const id = String(a["id"]);
    const g = groups.get(id) ?? [];
    g.push(a);
    groups.set(id, g);
  }
  for (const g of groups.values()) g.sort((x, y) => Number(y["version"]) - Number(x["version"]));

  const keyOf = (a: Row): string => `${String(a["id"])}:${String(a["version"])}`;
  const toggle = (k: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const showDiff = (artifactId: string, from: number, to: number): void => {
    setMsg(null);
    void api
      .artifactDiff(artifactId, from, to)
      .then((r) => setDiff({ artifactId, from, to, truncated: Boolean(r["truncated"]), lines: (r["lines"] ?? []) as DiffState["lines"] }))
      .catch((e: Error) => setMsg(`diff 失败:${e.message}`));
  };

  const exportSelected = (): void => {
    setMsg(null);
    void api
      .exportArtifacts(projectId, [...selected])
      .then((bundle) => {
        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `saydo-artifacts-${projectId.slice(-6)}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setMsg(`已导出 ${String((bundle as { count?: number }).count ?? selected.size)} 项`);
      })
      .catch((e: Error) => setMsg(`导出失败:${e.message}`));
  };

  return (
    <div data-page="artifacts">
      <div className="flex items-center justify-between">
        <SectionTitle>产物库</SectionTitle>
        <button
          data-action="export-artifacts"
          disabled={selected.size === 0}
          style={{
            height: 32,
            padding: "0 14px",
            borderRadius: "var(--radius-xs)",
            border: "1px solid var(--line)",
            background: "var(--surface-control)",
            color: "var(--text-primary)",
            fontSize: "var(--text-sm)",
            cursor: selected.size === 0 ? "not-allowed" : "pointer",
            opacity: selected.size === 0 ? "var(--disabled-opacity)" : 1
          }}
          onClick={exportSelected}
        >
          导出选中({selected.size})
        </button>
      </div>
      {msg ? (
        <p data-artifacts-msg style={{ margin: "0 0 10px", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
          {msg}
        </p>
      ) : null}
      {groups.size === 0 ? (
        <PaperCard>
          <EmptyState icon={Package} text="还没有产物;决策包/方案/报告会归档到这里" />
        </PaperCard>
      ) : (
        <div className="flex flex-col gap-[var(--space-3)]" data-artifact-groups>
          {[...groups.entries()].map(([id, versions]) => {
            const latest = versions[0] as Row;
            return (
              <PaperCard key={id}>
                <div className="flex items-center justify-between" data-artifact-group={id}>
                  <div className="flex items-center gap-[10px]">
                    <span style={{ fontWeight: 600, fontSize: "var(--text-base)" }}>
                      {String(latest["type"]) === "demo" ? "小样" : String(latest["type"])}
                    </span>
                    <Mono>{id.slice(-8)}</Mono>
                  </div>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                    最新 v{String(latest["version"])} · 共 {versions.length} 版
                  </span>
                </div>
                {/* 时间线:版本降序;supersedes 链 = 相邻行关系 */}
                <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none" }} data-version-timeline>
                  {versions.map((v, idx) => {
                    const ver = Number(v["version"]);
                    const prev = versions[idx + 1]; // 时间线上更早的一版
                    return (
                      <li
                        key={keyOf(v)}
                        className="flex items-center gap-[10px]"
                        style={{ padding: "6px 0", borderTop: idx > 0 ? "1px solid var(--line)" : "none", fontSize: "var(--text-sm)" }}
                        data-version-row={ver}
                      >
                        <input
                          type="checkbox"
                          aria-label={`选中 v${ver}`}
                          data-export-check={keyOf(v)}
                          checked={selected.has(keyOf(v))}
                          onChange={() => toggle(keyOf(v))}
                        />
                        <Mono>v{ver}</Mono>
                        <span style={{ color: "var(--text-faint)", fontSize: "var(--text-xs)" }}>
                          {v["supersedes_json"] ? `接替 v${String((JSON.parse(String(v["supersedes_json"])) as { version?: number }).version ?? "?")}` : "初版"}
                        </span>
                        <Mono>{String(v["digest"] ?? "").slice(-10)}</Mono>
                        <span style={{ color: "var(--text-faint)", fontSize: "var(--text-xs)" }}>{String(v["created_at"]).slice(0, 10)}</span>
                        {prev ? (
                          <button
                            data-action="artifact-diff"
                            data-diff-pair={`${Number(prev["version"])}-${ver}`}
                            style={{
                              height: 26,
                              padding: "0 10px",
                              borderRadius: "var(--radius-xs)",
                              border: "1px solid var(--line)",
                              background: "transparent",
                              color: "var(--text-primary)",
                              fontSize: "var(--text-xs)",
                              cursor: "pointer",
                              marginLeft: "auto"
                            }}
                            onClick={() => showDiff(id, Number(prev["version"]), ver)}
                          >
                            对比 v{Number(prev["version"])} → v{ver}
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </PaperCard>
            );
          })}
        </div>
      )}
      {/* diff 面板(11 §2.6 语义色:add=success/del=error;mono) */}
      {diff ? (
        <PaperCard>
          <div className="flex items-center justify-between">
            <SectionTitle>
              diff:v{diff.from} → v{diff.to}
            </SectionTitle>
            <button
              data-action="close-diff"
              style={{ height: 26, padding: "0 10px", borderRadius: "var(--radius-xs)", border: "1px solid var(--line)", background: "transparent", color: "var(--text-muted)", fontSize: "var(--text-xs)", cursor: "pointer" }}
              onClick={() => setDiff(null)}
            >
              关闭
            </button>
          </div>
          {diff.truncated ? (
            <p style={{ margin: "6px 0", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>文件过大,降级为整文件替换视图(不假装精确行对齐)</p>
          ) : null}
          <pre data-diff-panel style={{ margin: "8px 0 0", padding: 12, borderRadius: "var(--radius-sm)", border: "1px solid var(--line)", overflow: "auto", maxHeight: 420, fontSize: "var(--text-xs)", lineHeight: 1.6 }}>
            {diff.lines.map((l, i) => (
              <div
                key={i}
                data-diff-line={l.kind}
                style={{
                  color: l.kind === "add" ? "var(--color-success)" : l.kind === "del" ? "var(--color-error)" : "var(--text-muted)",
                  whiteSpace: "pre-wrap"
                }}
              >
                {l.kind === "add" ? "+ " : l.kind === "del" ? "- " : "  "}
                {l.text}
              </div>
            ))}
          </pre>
        </PaperCard>
      ) : null}
    </div>
  );
}
