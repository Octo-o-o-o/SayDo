// Dashboard(#/,08 §6):开始区 + 「待你处理」聚合条(ready_for_review > 审批 > blocked > 回叫未读)
// + 项目卡网格(项目列表页取消,并入此处)。空态 = Hero 态。

import { Folder, Inbox, Mic } from "lucide-react";
import type { Overview } from "../lib/api";
import { EmptyState, PaperCard, SectionTitle } from "../components/ui";
import { StatusChip } from "../components/StatusChip";

export function Dashboard({ overview }: { overview: Overview }) {
  const { projects, pending } = overview;
  const hasPending =
    pending.readyForReview.length > 0 || pending.approvals > 0 || pending.blocked.length > 0 || pending.unreadCallbacks > 0;

  return (
    <div className="flex flex-col gap-[var(--space-5)]" data-page="dashboard">
      {/* 开始区 */}
      <PaperCard strong>
        <div className="flex items-center justify-between">
          <div>
            <h1 style={{ margin: 0, fontSize: "var(--text-xl)", fontWeight: 700 }}>开始</h1>
            <p style={{ margin: "4px 0 0", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
              开始新对话,或选择项目继续。
            </p>
          </div>
          <a
            // C1:恒进无锚定新对话(此前:空项目态死链 "#/";有项目时劫持到第一个项目)
            href="#/chat"
            data-new-chat
            className="flex items-center gap-[8px] no-underline"
            style={{
              background: "var(--active-ink)",
              color: "var(--active-ink-fg)",
              borderRadius: "var(--radius-xs)",
              height: 36,
              padding: "0 16px",
              fontSize: "var(--text-sm)",
              display: "inline-flex",
              alignItems: "center"
            }}
          >
            <Mic size={16} aria-hidden />
            开始新对话
          </a>
        </div>
      </PaperCard>

      {/* 待你处理聚合条(恒定位置;空态不庆祝) */}
      <PaperCard>
        <SectionTitle>待你处理</SectionTitle>
        {!hasPending ? (
          <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-faint)" }} data-pending-empty>
            没有需要你的事
          </p>
        ) : (
          <div className="flex flex-col gap-[var(--space-2)]" data-pending-list>
            {pending.readyForReview.map((t) => (
              <a
                key={t.id}
                href={`#/p/${t.projectId}/task/${t.id}`}
                className="flex items-center justify-between no-underline"
                style={{ color: "var(--text-primary)", fontSize: "var(--text-sm)", padding: "6px 0" }}
              >
                <span>{t.title}</span>
                <StatusChip status={t.viewStatus} deadline={t.parkedDeadline} />
              </a>
            ))}
            {pending.blocked.map((t) => (
              <a
                key={t.id}
                href={`#/p/${t.projectId}/task/${t.id}`}
                className="flex items-center justify-between no-underline"
                style={{ color: "var(--text-primary)", fontSize: "var(--text-sm)", padding: "6px 0" }}
              >
                <span>{t.title}</span>
                <StatusChip status={t.viewStatus} deadline={t.parkedDeadline} />
              </a>
            ))}
            {pending.approvals > 0 ? (
              <a href="#/approvals" style={{ fontSize: "var(--text-sm)", color: "var(--color-warning)" }}>
                {pending.approvals} 个审批等你拍板
              </a>
            ) : null}
            {pending.unreadCallbacks > 0 ? (
              <a href="#/notify" style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                {pending.unreadCallbacks} 条回叫未读
              </a>
            ) : null}
          </div>
        )}
      </PaperCard>

      {/* 项目卡网格 */}
      <div>
        <SectionTitle>项目</SectionTitle>
        {projects.length === 0 ? (
          <PaperCard>
            <EmptyState icon={Inbox} text="还没有项目——开口即建:开始对话说出你的想法" />
          </PaperCard>
        ) : (
          <div className="grid grid-cols-1 gap-[var(--space-4)] md:grid-cols-2 xl:grid-cols-3" data-project-grid>
            {projects.map((p) => (
              <a key={p.id} href={`#/p/${p.id}/tasks`} className="no-underline" style={{ color: "inherit" }}>
                <PaperCard>
                  <div className="flex items-center gap-[8px]">
                    <Folder size={16} color="var(--text-muted)" aria-hidden />
                    <span style={{ fontWeight: 600, fontSize: "var(--text-base)" }}>{p.title}</span>
                    {p.status === "draft" ? (
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>草稿</span>
                    ) : null}
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {Object.entries(p.taskCounts)
                      .map(([k, v]) => `${k}:${v}`)
                      .join("  ") || "无任务"}
                  </p>
                </PaperCard>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
