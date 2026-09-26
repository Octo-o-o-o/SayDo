// DependencyPanel(DAILY-01,合同 §15.2):依赖清单(有向边)+ 添加/解除。
// 义务级前置(waiting_on_obligation_id)与任务级前置(waiting_on_task_id+condition)互斥;
// 任务级条件:accepted=验收通过(review_approved_waiting_merge 起),delivered=已交付(task_done)。
// 解除=清除全部等待列,走确认;不派发、不续跑。
// 纯呈现:候选集由接线层灌(同 Focus 未结义务 + 绑定任务),写口动作走回调。

import { useMemo, useState } from "react";
import { GitBranch, Plus } from "lucide-react";
import { ActionRow, Btn, card, Chip, Mono } from "./shared";
import type { ObligationView } from "./types";

export interface FocusTaskRef {
  id: string;
  title: string;
  status: string;
  laneId?: string | null;
}

export type DependencyAddRequest =
  | { obligationId: string; kind: "obligation"; preId: string }
  | { obligationId: string; kind: "task"; taskId: string; condition: "accepted" | "delivered" };

const OPEN_SET = new Set(["open", "in_progress", "waiting", "deferred", "blocked"]);
const TASK_TERMINAL = new Set(["task_done", "failed", "cancel_settled", "superseded"]);

const CONDITION_LABEL: Record<string, string> = {
  accepted: "验收通过",
  delivered: "已交付"
};

/** 等待中的依赖边(waiting/blocked 且挂了结构化前置) */
export function dependencyEdges(obligations: ObligationView[]): ObligationView[] {
  return obligations.filter(
    (o) => o.waitingOnObligationId || o.waitingOnTaskId || (o.status === "waiting" && o.waitingOn)
  );
}

interface DepEdgeView {
  preId: string;
  preLabel: string;
  preKind: "义务" | "任务";
  depId: string;
  depLabel: string;
  blocked: boolean;
}

function edgeViews(obligations: ObligationView[], tasks: FocusTaskRef[]): DepEdgeView[] {
  const byId = new Map(obligations.map((o) => [o.id, o.title] as const));
  const taskById = new Map(tasks.map((t) => [t.id, t.title] as const));
  return dependencyEdges(obligations).map((o) => {
    const preId = o.waitingOnTaskId ?? o.waitingOnObligationId ?? "";
    const preLabel = o.waitingOnTaskId
      ? taskById.get(o.waitingOnTaskId) ?? o.waitingOnTaskId
      : (o.waitingOnObligationId ? byId.get(o.waitingOnObligationId) ?? o.waitingOnObligationId : (o.waitingOn ?? "?"));
    return {
      preId: preId || (o.waitingOn ?? "?"),
      preLabel,
      preKind: o.waitingOnTaskId ? "任务" : "义务",
      depId: o.id,
      depLabel: o.title,
      blocked: o.status === "blocked"
    };
  });
}

/** 有向依赖图(R06):左列前置 → 右列依赖方;节点去重,边带箭头;纯 SVG 无拖拽 */
function DependencyGraph({ edges }: { edges: DepEdgeView[] }) {
  if (edges.length === 0) return null;
  const pres = [...new Map(edges.map((e) => [e.preId, e] as const)).values()];
  const deps = [...new Map(edges.map((e) => [e.depId, e] as const)).values()];
  const rowH = 30;
  const W = 560;
  const nodeW = 190;
  const H = Math.max(pres.length, deps.length) * rowH + 16;
  const preY = new Map(pres.map((e, i) => [e.preId, 8 + i * rowH + rowH / 2] as const));
  const depY = new Map(deps.map((e, i) => [e.depId, 8 + i * rowH + rowH / 2] as const));
  const clip = (s: string) => (s.length > 12 ? `${s.slice(0, 11)}…` : s);
  return (
    <svg
      data-dep-graph
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", maxHeight: 260, display: "block", marginBottom: "var(--space-3)" }}
      role="img"
      aria-label="依赖有向图"
    >
      <defs>
        <marker id="dep-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L8,4 L0,8 z" fill="var(--text-faint)" />
        </marker>
      </defs>
      {edges.map((e) => {
        const y1 = preY.get(e.preId) ?? 0;
        const y2 = depY.get(e.depId) ?? 0;
        return (
          <path
            key={`${e.preId}->${e.depId}`}
            d={`M ${nodeW + 8} ${y1} C ${W / 2} ${y1}, ${W / 2} ${y2}, ${W - nodeW - 8} ${y2}`}
            fill="none"
            stroke={e.blocked ? "var(--color-error)" : "var(--text-faint)"}
            strokeWidth="1.2"
            markerEnd="url(#dep-arrow)"
          />
        );
      })}
      {pres.map((e, i) => {
        const y = 8 + i * rowH;
        return (
          <g key={`pre:${e.preId}`}>
            <rect x={0} y={y} width={nodeW} height={rowH - 6} rx={6} fill="var(--surface-ink-wash)" stroke="var(--line)" />
            <text x={10} y={y + rowH / 2 + 2} fontSize={11} fill="var(--text-secondary)">
              {clip(e.preLabel)}
              <tspan fill="var(--text-faint)" fontSize={9}> · {e.preKind}</tspan>
            </text>
          </g>
        );
      })}
      {deps.map((e, i) => {
        const y = 8 + i * rowH;
        return (
          <g key={`dep:${e.depId}`}>
            <rect
              x={W - nodeW} y={y} width={nodeW} height={rowH - 6} rx={6}
              fill="var(--surface-glass)" stroke={e.blocked ? "var(--color-error)" : "var(--active-ink-border)"}
            />
            <text x={W - nodeW + 10} y={y + rowH / 2 + 2} fontSize={11} fill="var(--text-primary)">
              {clip(e.depLabel)}{e.blocked ? <tspan fill="var(--color-error)" fontSize={9}> · 已停</tspan> : null}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function EdgeRow({ ob, tasks, onUndo }: { ob: ObligationView; tasks: FocusTaskRef[]; onUndo?: (obligationId: string) => void }) {
  const taskPre = ob.waitingOnTaskId
    ? tasks.find((t) => t.id === ob.waitingOnTaskId)
    : undefined;
  const preLabel = ob.waitingOn
    ?? taskPre?.title
    ?? ob.waitingOnTaskId
    ?? ob.waitingOnObligationId
    ?? "?";
  const kindTag = ob.waitingOnTaskId
    ? `任务 · ${CONDITION_LABEL[ob.waitingTaskCondition ?? "accepted"] ?? ob.waitingTaskCondition}`
    : "义务";
  return (
    <div
      data-dep-edge={ob.id}
      style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", padding: "var(--space-3) 0", borderBottom: "1px dashed var(--line)", fontSize: "var(--text-sm)", flexWrap: "wrap" }}
    >
      <span style={{ flex: 1, minWidth: 220 }}>
        「{ob.title}」<Mono faint> 等 </Mono>「{preLabel}」
      </span>
      <Chip tone="ink-wash">{kindTag}</Chip>
      <Chip tone={ob.status === "blocked" ? "error" : "muted"}>
        {ob.status === "blocked" ? "前置已停" : "等待中"}
      </Chip>
      {onUndo ? <Btn onClick={() => onUndo(ob.id)}>解除依赖</Btn> : null}
    </div>
  );
}

export function DependencyPanel({ obligations, tasks, onAdd, onUndo }: {
  /** 本 Focus 全部义务(边渲染 + 候选集都在此取) */
  obligations: ObligationView[];
  /** 本 Focus 绑定任务(任务级前置候选集) */
  tasks: FocusTaskRef[];
  onAdd?: (req: DependencyAddRequest) => void;
  onUndo?: (obligationId: string) => void;
}) {
  const edges = useMemo(() => dependencyEdges(obligations), [obligations]);
  const graphEdges = useMemo(() => edgeViews(obligations, tasks), [obligations, tasks]);
  const [adding, setAdding] = useState(false);
  const [depId, setDepId] = useState("");
  const [preKind, setPreKind] = useState<"obligation" | "task">("obligation");
  const [preId, setPreId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [condition, setCondition] = useState<"accepted" | "delivered">("accepted");

  const depCandidates = obligations.filter((o) => OPEN_SET.has(o.status));
  const preCandidates = obligations.filter((o) => OPEN_SET.has(o.status) && o.id !== depId);
  const taskCandidates = tasks.filter((t) => !TASK_TERMINAL.has(t.status));

  const submit = () => {
    if (!depId) return;
    if (preKind === "obligation" && preId) {
      onAdd?.({ obligationId: depId, kind: "obligation", preId });
    } else if (preKind === "task" && taskId) {
      onAdd?.({ obligationId: depId, kind: "task", taskId, condition });
    } else {
      return;
    }
    setAdding(false);
    setDepId("");
    setPreId("");
    setTaskId("");
    setCondition("accepted");
  };

  const sel: React.CSSProperties = {
    background: "var(--surface-control)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-xs)",
    padding: "6px 8px",
    fontSize: "var(--text-sm)",
    color: "var(--text-primary)",
    maxWidth: 260
  };

  return (
    <div data-dep-panel>
      <DependencyGraph edges={graphEdges} />
      {edges.length ? edges.map((o) => (
        <EdgeRow key={o.id} ob={o} tasks={tasks} onUndo={onUndo} />
      )) : (
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
          暂无依赖。dependency_set / dependency_task_set 与 woken / blocked 事件落账,义务级有环检测。
        </div>
      )}

      {onAdd ? (
        <ActionRow>
          {adding ? (
            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap", width: "100%" }} data-dep-add-form>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>让</span>
              <select aria-label="依赖方义务" style={sel} value={depId} onChange={(e) => setDepId(e.target.value)} data-dep-add-dep>
                <option value="">选义务…</option>
                {depCandidates.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
              </select>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>等</span>
              <select aria-label="前置类型" style={sel} value={preKind} onChange={(e) => setPreKind(e.target.value as "obligation" | "task")} data-dep-add-kind>
                <option value="obligation">义务</option>
                <option value="task">任务</option>
              </select>
              {preKind === "obligation" ? (
                <select aria-label="前置义务" style={sel} value={preId} onChange={(e) => setPreId(e.target.value)} data-dep-add-pre>
                  <option value="">选前置义务…</option>
                  {preCandidates.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
                </select>
              ) : (
                <>
                  <select aria-label="前置任务" style={sel} value={taskId} onChange={(e) => setTaskId(e.target.value)} data-dep-add-task>
                    <option value="">选前置任务…</option>
                    {taskCandidates.map((t) => <option key={t.id} value={t.id}>{t.title}({t.status})</option>)}
                  </select>
                  <select aria-label="唤醒条件" style={sel} value={condition} onChange={(e) => setCondition(e.target.value as "accepted" | "delivered")} data-dep-add-cond>
                    <option value="accepted">验收通过即唤醒</option>
                    <option value="delivered">已交付才唤醒</option>
                  </select>
                </>
              )}
              <Btn variant="primary" onClick={submit} disabled={!depId || (preKind === "obligation" ? !preId : !taskId)}>设定依赖</Btn>
              <Btn onClick={() => setAdding(false)}>取消</Btn>
            </div>
          ) : (
            <Btn icon={Plus} onClick={() => setAdding(true)}>添加依赖</Btn>
          )}
        </ActionRow>
      ) : null}
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", marginTop: "var(--space-2)", display: "flex", gap: 6, alignItems: "center" }}>
        <GitBranch size={11} aria-hidden />
        前置只取同 Focus 的未结义务/绑定任务;任务级条件「验收通过」与「已交付」不可互换。解除依赖不派发不续跑。
      </div>
    </div>
  );
}

/** 依赖卡的整块包装(RecordsPanel / FocusPage 依赖页签共用外壳) */
export function DependencyCard({ obligations, tasks, onAdd, onUndo }: {
  obligations: ObligationView[];
  tasks: FocusTaskRef[];
  onAdd?: (req: DependencyAddRequest) => void;
  onUndo?: (obligationId: string) => void;
}) {
  return (
    <div style={{ ...card, marginBottom: "var(--space-4)" }} data-dep-card>
      <div style={{ fontSize: "var(--text-md)", fontWeight: 600, marginBottom: "var(--space-2)" }}>
        依赖链(一件事醒了,另一件才醒)
      </div>
      <DependencyPanel obligations={obligations} tasks={tasks} onAdd={onAdd} onUndo={onUndo} />
    </div>
  );
}
