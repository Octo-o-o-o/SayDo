// 审批中心(#/approvals;全项目聚合,每卡必带项目/任务上下文 04 §5.2;审批卡 11 §5.4:
// 恒定结构 效果->上下文->参数->digest 尾码->操作;超时/终局置灰不可再点=收据单次消费视觉)。
// 执行器批任务②:pending 的 runtime_effect 张(执行中 S2 上浮)可点批准/拒绝——
// gate 侧钩子在等这张收据,超时按档终局(fail-closed deny);S3 永远不在此出现(词表环+DDL 双拒)。

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { EmptyState, ErrorCard, PaperCard, Mono, SectionTitle } from "../components/ui";
import { RiskBadge } from "../components/StatusChip";

const TERMINAL = new Set(["consumed", "rejected", "timeout_rejected", "timeout_parked", "superseded_by_edit", "voided_by_conflict", "expired"]);

export function Approvals() {
  const [bump, setBump] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error } = useAsync(() => api.approvals(), [bump]);
  const decide = (aid: string, decision: "accept" | "reject"): void => {
    setActionError(null);
    api
      .decideApproval(aid, decision)
      .then(() => setBump((n) => n + 1))
      .catch((e: Error) => setActionError(e.message));
  };
  // W5a 3.3 第四动作:修改后批准(09 §3 edit,仅屏幕仅 S2)——当前命令拒 + 修改版单次预批
  const editApprove = (aid: string, originalCommand: string): void => {
    setActionError(null);
    const edited = window.prompt("修改这条命令后批准(agent 会收到修改版并原样重试;只批这一次):", originalCommand);
    if (edited === null || !edited.trim()) return;
    api
      .editApproval(aid, edited.trim())
      .then(() => setBump((n) => n + 1))
      .catch((e: Error) => setActionError(e.message));
  };
  if (error) return <ErrorCard message="审批加载失败" detail={error} />;
  const rows = data ?? [];
  return (
    <div data-page="approvals">
      <SectionTitle>审批中心</SectionTitle>
      {actionError ? <ErrorCard message="审批操作失败" detail={actionError} /> : null}
      {rows.length === 0 ? (
        <PaperCard>
          <EmptyState icon={ShieldCheck} text="没有待批的事" />
        </PaperCard>
      ) : (
        <div className="flex flex-col gap-[var(--space-3)]" data-approval-list>
          {rows.map((a) => {
            const done = TERMINAL.has(String(a["outcome"]));
            const decidable = !done && String(a["kind"]) === "runtime_effect" && String(a["outcome"]) === "pending";
            return (
              <div key={String(a["id"])} style={{ opacity: done ? 0.55 : 1 }}>
                <PaperCard>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-[10px]">
                      <RiskBadge risk={String(a["risk"])} />
                      <span style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>
                        {String(a["effect"] ?? a["kind"])}
                      </span>
                    </div>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{String(a["outcome"])}</span>
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                    {String(a["project_title"] ?? "无项目")} · {String(a["task_title"] ?? "无任务")}
                  </p>
                  <p style={{ margin: "6px 0 0" }}>
                    <Mono>
                      {String(a["decided_via"])} · {String(a["auth_strength"])} · {String(a["issued_at"]).slice(0, 19)}
                    </Mono>
                  </p>
                  {typeof a["pending_command"] === "string" ? (
                    <p style={{ margin: "6px 0 0", fontSize: "var(--text-sm)" }} data-pending-command>
                      <Mono>{String(a["pending_command"])}</Mono>
                    </p>
                  ) : null}
                  {decidable ? (
                    <div className="flex items-center gap-[var(--space-3)]" style={{ marginTop: 10 }} data-approval-actions>
                      <button style={approveBtn} data-action="approval-accept" onClick={() => decide(String(a["id"]), "accept")}>
                        批准执行
                      </button>
                      {String(a["risk"]) === "S2" && typeof a["pending_command"] === "string" ? (
                        <button
                          style={approveBtn}
                          data-action="approval-edit"
                          onClick={() => editApprove(String(a["id"]), String(a["pending_command"]))}
                        >
                          修改后批准
                        </button>
                      ) : null}
                      <button style={rejectBtn} data-action="approval-reject" onClick={() => decide(String(a["id"]), "reject")}>
                        拒绝
                      </button>
                    </div>
                  ) : null}
                </PaperCard>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const approveBtn: React.CSSProperties = {
  height: 36,
  padding: "0 16px",
  borderRadius: "var(--radius-xs)",
  border: "1px solid var(--line)",
  background: "var(--surface-control)",
  color: "var(--text-primary)",
  fontSize: "var(--text-sm)",
  cursor: "pointer"
};

const rejectBtn: React.CSSProperties = {
  height: 36,
  padding: "0 16px",
  borderRadius: "var(--radius-xs)",
  border: "1px solid var(--color-error)",
  background: "transparent",
  color: "var(--color-error)",
  fontSize: "var(--text-sm)",
  cursor: "pointer"
};
