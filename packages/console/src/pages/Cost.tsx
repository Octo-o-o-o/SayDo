// 成本账本(#/cost;DAILY-01:时段筛选 + 分组(项目/类别/来源)+ 下钻 + CSV 导出)。
// unknown 纪律:known=0 的金额永不写 0,组聚合只加 known 金额,未知笔数单列(11 §2.6)。

import { useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import { api, type Row } from "../lib/api";
import {
  authoritativeAllTotals,
  costExportFilename,
  costExportHeader,
  costWindowLabel,
  normalizeEntriesWindow
} from "../lib/costWindow";
import { useAsync } from "../lib/useAsync";
import { costTotalsText, EmptyState, ErrorCard, PaperCard, Mono, SectionTitle, CostText } from "../components/ui";

type RangeKey = "7d" | "30d" | "all";
type GroupKey = "project" | "kind" | "source";

const RANGE_LABEL: Record<RangeKey, string> = { "7d": "近 7 天", "30d": "近 30 天", all: "全部" };
const GROUP_LABEL: Record<GroupKey, string> = { project: "按项目", kind: "按类别", source: "按来源" };

const pickBtn = (active: boolean): React.CSSProperties => ({
  height: 30,
  padding: "0 14px",
  borderRadius: "var(--radius-xs)",
  border: "1px solid var(--line)",
  background: active ? "var(--selected-wash)" : "transparent",
  color: active ? "var(--active-ink)" : "var(--text-secondary)",
  fontSize: "var(--text-xs)",
  cursor: "pointer"
});

function inRange(ts: unknown, range: RangeKey): boolean {
  if (range === "all") return true;
  const t = Date.parse(String(ts ?? ""));
  if (Number.isNaN(t)) return true; // 无时间戳的行不丢——归到「全部」口径外会被静默漏账
  const days = range === "7d" ? 7 : 30;
  return t >= Date.now() - days * 24 * 3600 * 1000;
}

function groupKeyOf(row: Row, group: GroupKey): string {
  if (group === "project") return String(row["project_id"] ?? "(无项目)");
  if (group === "kind") return String(row["kind"] ?? "(未知类别)");
  return String(row["source"] ?? "(未知来源)");
}

interface GroupAgg {
  key: string;
  title?: string;
  knownByCurrency: Record<string, number>;
  unknownCount: number;
  rows: Row[];
}

function aggregate(entries: Row[], group: GroupKey, projectTitleById: Map<string, string>): GroupAgg[] {
  const m = new Map<string, GroupAgg>();
  for (const e of entries) {
    const key = groupKeyOf(e, group);
    const agg = m.get(key) ?? { key, knownByCurrency: {}, unknownCount: 0, rows: [] };
    if (e["known"] === 1) {
      const cur = String(e["currency"] ?? "");
      const amt = Number(e["amount"] ?? 0);
      if (cur) agg.knownByCurrency[cur] = (agg.knownByCurrency[cur] ?? 0) + amt;
    } else {
      agg.unknownCount += 1;
    }
    agg.rows.push(e);
    m.set(key, agg);
  }
  return [...m.values()].map((g) => ({
    ...g,
    title: group === "project" && g.key !== "(无项目)" ? projectTitleById.get(g.key) ?? g.key : g.key
  }));
}

function exportCsv(
  entries: Row[],
  group: GroupKey,
  window: ReturnType<typeof normalizeEntriesWindow>
): void {
  const head = "ts,project_id,task_id,kind,source,known,amount,currency";
  const lines = entries.map((e) =>
    [e["ts"], e["project_id"], e["task_id"], e["kind"], e["source"], e["known"], e["amount"], e["currency"]]
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
      .join(",")
  );
  const blob = new Blob([[costExportHeader(window), head, ...lines].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = costExportFilename({ group, window });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function Cost() {
  const { data, error } = useAsync(() => api.costs(), []);
  const [range, setRange] = useState<RangeKey>("30d");
  const [group, setGroup] = useState<GroupKey>("project");
  const [drill, setDrill] = useState<string | null>(null);
  // DAILY-01 R12:图表按需打开——不常驻一屏假指标;多币种分组按币种各画一条
  const [chart, setChart] = useState(false);

  const projectTitleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of data?.byProject ?? []) {
      if (p.projectId) m.set(String(p.projectId), String(p.projectTitle ?? p.projectId));
    }
    return m;
  }, [data]);

  const entriesWindow = useMemo(
    () => normalizeEntriesWindow(data?.entriesWindow, data?.entries?.length ?? 0),
    [data]
  );
  const allTotals = useMemo(
    () =>
      authoritativeAllTotals(
        (data?.byProject ?? []).map((p) => ({
          projectId: (p["projectId"] as string | null) ?? null,
          projectTitle: (p["projectTitle"] as string | null) ?? null,
          knownByCurrency: (p["knownByCurrency"] as Record<string, number>) ?? {},
          unknownCount: Number(p["unknownCount"] ?? 0)
        }))
      ),
    [data]
  );
  const filtered = useMemo(
    () => (data?.entries ?? []).filter((e) => inRange(e["ts"], range)),
    [data, range]
  );
  const groups = useMemo(() => {
    if (range === "all" && group === "project") {
      return (data?.byProject ?? []).map((p) => {
        const pid = p["projectId"] == null || p["projectId"] === "" ? null : String(p["projectId"]);
        return {
          key: pid ?? "(无项目)",
          title: String(p["projectTitle"] ?? pid ?? "(无项目)"),
          knownByCurrency: (p["knownByCurrency"] as Record<string, number>) ?? {},
          unknownCount: Number(p["unknownCount"] ?? 0),
          rows: filtered.filter((e) => String(e["project_id"] ?? "") === String(pid ?? ""))
        };
      });
    }
    return aggregate(filtered, group, projectTitleById);
  }, [data, filtered, group, projectTitleById, range]);
  const drillRows = useMemo(
    () => (drill === null ? [] : groups.find((g) => g.key === drill)?.rows ?? []),
    [groups, drill]
  );
  const chartMax = useMemo(() => {
    let m = 0;
    for (const g of groups) for (const v of Object.values(g.knownByCurrency)) m = Math.max(m, v);
    return m;
  }, [groups]);

  if (error) return <ErrorCard message="成本加载失败" detail={error} />;

  return (
    <div className="flex flex-col gap-[var(--space-4)]" data-page="cost">
      <SectionTitle>成本</SectionTitle>
      <div className="flex items-center gap-[8px]" style={{ flexWrap: "wrap" }} data-cost-controls>
        {(["7d", "30d", "all"] as const).map((r) => (
          <button key={r} style={pickBtn(range === r)} data-cost-range={r} onClick={() => { setRange(r); setDrill(null); }}>
            {RANGE_LABEL[r]}
          </button>
        ))}
        <span style={{ width: 8 }} />
        {(["project", "kind", "source"] as const).map((g) => (
          <button key={g} style={pickBtn(group === g)} data-cost-group={g} onClick={() => { setGroup(g); setDrill(null); }}>
            {GROUP_LABEL[g]}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button style={pickBtn(chart)} data-cost-chart-toggle onClick={() => setChart((v) => !v)}>
          图表
        </button>
        <button
          style={pickBtn(false)}
          data-action="cost-export"
          disabled={filtered.length === 0}
          onClick={() => exportCsv(drill ? drillRows : filtered, group, entriesWindow)}
        >
          导出 CSV{drill ? `(下钻 ${drillRows.length} 笔)` : `(窗口 ${entriesWindow.returned} 笔)`}
        </button>
      </div>
      <div data-cost-window style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
        {costWindowLabel(entriesWindow)}
        {range === "all" ? (
          <span data-cost-all-ledger>
            {" "}
            · 全部合计按全账本 {allTotals.projectCount} 个项目
            {Object.keys(allTotals.knownByCurrency).length
              ? ` · ${costTotalsText(allTotals.knownByCurrency)}`
              : ""}
            {allTotals.unknownCount ? ` · ${allTotals.unknownCount} 笔未知` : ""}
          </span>
        ) : (
          <span> · 近 {range === "7d" ? "7" : "30"} 天筛选只作用于窗口明细,不是全账本期间合计</span>
        )}
      </div>

      {chart && groups.length > 0 ? (
        <PaperCard>
          <div className="flex flex-col" data-cost-chart>
            {groups.map((g) => (
              <div key={g.key} style={{ padding: "6px 0" }}>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginBottom: 3 }}>
                  {g.title ?? g.key}
                  {g.unknownCount ? <span style={{ color: "var(--text-faint)" }}> · {g.unknownCount} 笔未知</span> : null}
                </div>
                {Object.entries(g.knownByCurrency).map(([cur, amt]) => (
                  <div key={cur} className="flex items-center gap-[8px]" style={{ marginBottom: 2 }}>
                    <div
                      style={{
                        height: 10,
                        width: `${chartMax > 0 ? Math.max(2, (amt / chartMax) * 100) : 0}%`,
                        background: "var(--active-ink)",
                        borderRadius: 3,
                        flex: "none"
                      }}
                    />
                    <Mono>{amt.toFixed(4)} {cur}</Mono>
                  </div>
                ))}
                {Object.keys(g.knownByCurrency).length === 0 ? (
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>没有确切数字</div>
                ) : null}
              </div>
            ))}
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", marginTop: 6 }}>
              条长=组内已知金额占本页最大值;未知金额不进条、不写 0。
            </div>
          </div>
        </PaperCard>
      ) : null}

      <PaperCard>
        {groups.length === 0 ? (
          <EmptyState icon={Wallet} text="这个时段还没有记账;跑起来我记账" />
        ) : (
          <table style={{ width: "100%", fontSize: "var(--text-sm)", borderCollapse: "collapse" }} data-cost-groups>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: "var(--text-xs)" }}>
                <th style={{ paddingBottom: 8 }}>{GROUP_LABEL[group].slice(1)}</th>
                <th>已知花费</th>
                <th>未知项</th>
                <th>笔数</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const totals = costTotalsText(g.knownByCurrency);
                return (
                  <tr key={g.key} style={{ height: 40, borderTop: "1px solid var(--line)" }} data-cost-group-row={g.key}>
                    <td>{g.title ?? g.key}</td>
                    <td>
                      {totals === "还没有确切数字" ? (
                        <span style={{ color: "var(--text-muted)" }}>{totals}</span>
                      ) : (
                        <Mono>{totals}</Mono>
                      )}
                    </td>
                    <td><Mono>{g.unknownCount} 笔</Mono></td>
                    <td><Mono>{g.rows.length}</Mono></td>
                    <td>
                      <button
                        style={{ ...pickBtn(drill === g.key), height: 24, padding: "0 10px" }}
                        data-cost-drill={g.key}
                        onClick={() => setDrill(drill === g.key ? null : g.key)}
                      >
                        {drill === g.key ? "收起" : "下钻"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </PaperCard>

      {drill !== null ? (
        <PaperCard>
          <SectionTitle>下钻:{groups.find((g) => g.key === drill)?.title ?? drill}({drillRows.length} 笔)</SectionTitle>
          <div className="flex flex-col" data-cost-drill-list>
            {drillRows.map((c) => (
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
      ) : filtered.length > 0 ? (
        <PaperCard>
          <SectionTitle>明细(最近 {Math.min(filtered.length, 50)})</SectionTitle>
          <div className="flex flex-col" data-cost-entries>
            {filtered.slice(0, 50).map((c) => (
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
