// 成本账本(#/cost;按项目分组下钻;unknown 纪律:显示"还没有确切数字",禁 0/禁空,11 §2.6)。

import { Wallet } from "lucide-react";
import { api } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { costTotalsText, EmptyState, ErrorCard, PaperCard, Mono, SectionTitle, CostText } from "../components/ui";

export function Cost() {
  const { data, error } = useAsync(() => api.costs(), []);
  if (error) return <ErrorCard message="成本加载失败" detail={error} />;
  const byProject = data?.byProject ?? [];
  const entries = data?.entries ?? [];
  return (
    <div className="flex flex-col gap-[var(--space-4)]" data-page="cost">
      <SectionTitle>成本</SectionTitle>
      <PaperCard>
        {byProject.length === 0 ? (
          <EmptyState icon={Wallet} text="还没有记账;跑起来我记账" />
        ) : (
          <table style={{ width: "100%", fontSize: "var(--text-sm)", borderCollapse: "collapse" }} data-cost-by-project>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: "var(--text-xs)" }}>
                <th style={{ paddingBottom: 8 }}>项目</th>
                <th>已知花费</th>
                <th>未知项</th>
              </tr>
            </thead>
            <tbody>
              {byProject.map((p, i) => {
                const totals = costTotalsText((p["knownByCurrency"] as Record<string, number>) ?? {});
                return (
                  <tr key={i} style={{ height: 40, borderTop: "1px solid var(--line)" }}>
                    <td>{String(p["projectTitle"] ?? "(无项目)")}</td>
                    <td>
                      {totals === "还没有确切数字" ? (
                        <span style={{ color: "var(--text-muted)" }}>{totals}</span>
                      ) : (
                        <Mono>{totals}</Mono>
                      )}
                    </td>
                    <td>
                      <Mono>{String(p["unknownCount"])} 笔</Mono>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </PaperCard>
      {entries.length > 0 ? (
        <PaperCard>
          <SectionTitle>明细(最近 300)</SectionTitle>
          <div className="flex flex-col" data-cost-entries>
            {entries.slice(0, 50).map((c) => (
              <div key={String(c["id"])} className="flex items-center justify-between" style={{ padding: "8px 0", borderTop: "1px solid var(--line)", fontSize: "var(--text-sm)" }}>
                <Mono>{String(c["kind"])}</Mono>
                <span className="flex items-center gap-[12px]">
                  <CostText known={c["known"] === 1} amount={(c["amount"] as number) ?? null} source={String(c["source"] ?? "")} currency={(c["currency"] as string) ?? null} />
                  <Mono>{String(c["ts"] ?? "").slice(5, 16)}</Mono>
                </span>
              </div>
            ))}
          </div>
        </PaperCard>
      ) : null}
    </div>
  );
}
