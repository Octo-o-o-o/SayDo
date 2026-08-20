// 任务看板(#/p/:id/tasks;08 §6:队列/执行中/等验收/已交付 + 需要你列;11 §5.3 任务卡)。

import { ListTodo } from "lucide-react";
import { api } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { EmptyState, ErrorCard, PaperCard, Mono, SectionTitle } from "../components/ui";
import { StatusChip } from "../components/StatusChip";

const COLUMNS: { title: string; states: string[] }[] = [
  { title: "队列", states: ["confirmed", "queued"] },
  { title: "执行中", states: ["running", "paused_step_boundary", "merging", "cancel_requested"] },
  { title: "需要你", states: ["blocked", "parked", "ready_for_review", "review_approved_waiting_merge", "merge_failed"] },
  { title: "已收尾", states: ["task_done", "failed", "cancel_settled", "superseded"] }
];

export function Tasks({ projectId }: { projectId: string }) {
  const { data, error } = useAsync(() => api.projectTasks(projectId), [projectId]);
  if (error) return <ErrorCard message="任务加载失败" detail={error} />;
  const tasks = data ?? [];

  return (
    <div data-page="tasks">
      <SectionTitle>任务看板</SectionTitle>
      {tasks.length === 0 ? (
        <PaperCard>
          <EmptyState icon={ListTodo} text="这个项目还没有任务;对话里拍板决策包后会出现在这里" />
        </PaperCard>
      ) : (
        <div className="grid grid-cols-1 gap-[var(--space-4)] md:grid-cols-2 xl:grid-cols-4" data-board>
          {COLUMNS.map((col) => {
            const items = tasks.filter((t) => col.states.includes(t.viewStatus));
            return (
              <div key={col.title} className="flex flex-col gap-[var(--space-3)]">
                <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
                  {col.title}({items.length})
                </p>
                {items.map((t) => (
                  <a key={t.id} href={`#/p/${projectId}/task/${t.id}`} className="no-underline" style={{ color: "inherit" }}>
                    <PaperCard>
                      <p style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 600 }}>{t.title}</p>
                      <div className="mt-[8px] flex flex-wrap items-center gap-[8px]">
                        <StatusChip status={t.viewStatus} deadline={t.parkedDeadline} />
                        {t.attempt > 1 ? (
                          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>第 {t.attempt} 次尝试</span>
                        ) : null}
                      </div>
                      {t.budget ? (
                        <p style={{ margin: "8px 0 0" }}>
                          <Mono>
                            预算 {t.budget.maxCost} 元 · {t.budget.walltimeActiveMin} 分钟 · {t.budget.maxTurns} 回合
                          </Mono>
                        </p>
                      ) : null}
                    </PaperCard>
                  </a>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
