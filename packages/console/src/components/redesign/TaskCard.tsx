// TaskCard(demo taskCardHtml):16 呈现态全覆盖;状态 chip 用既有 StatusChip 单源(11 §5.11 登记);
// 动作按钮全部 onAction 回调(组件不接线);HP(Hopper 投影)只读说明,不给本地动作。
// 状态词三级:收到/等你验收/已交付;成本 unknown 显示「还没有确切数字」。

import { Check, Flag, Fingerprint, Folder, History, Layers, Zap } from "lucide-react";
import { useState } from "react";
import { StatusChip, RiskBadge } from "../StatusChip";
import { ActionRow, Btn, card, Mono, StageTag } from "./shared";
import type { TaskView } from "./types";

export type TaskAction =
  | { type: "review" } | { type: "answer"; text: string } | { type: "step_ok" } | { type: "step_no" }
  | { type: "billing"; accept: boolean } | { type: "s3_merge" } | { type: "retry" }
  | { type: "merge_conflict" } | { type: "open_focus" } | { type: "explain"; level: "one_liner" | "walkthrough" | "decisions" };

export function TaskCard({ task, onAction, inModal }: {
  task: TaskView;
  onAction?: (action: TaskAction, task: TaskView) => void;
  inModal?: boolean;
}) {
  const isHopper = task.route === "hopper";
  const [answer, setAnswer] = useState("");
  const vs = task.viewStatus;

  const budget = isHopper
    ? `Hopper 执行域 · 熔断 ¥${task.budget.maxCost} · 已花 ${task.spent.known ? `¥${task.spent.value}` : "还没有确切数字"}`
    : `已跑 ${task.elapsedMin} 分钟 / 上限 ${task.budget.walltimeActiveMin} 分钟 · 已花 ${task.spent.known ? `¥${task.spent.value}` : "还没有确切数字"} / 熔断 ¥${task.budget.maxCost}`;

  let actions: React.ReactNode = null;
  if (isHopper) {
    actions = (
      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
        执行状态归 Hopper 账本,这里只投影 · 细节在「记录」与 Hopper Console(工程排障面) <StageTag>P0.5</StageTag>
      </span>
    );
  } else if (vs === "ready_for_review") {
    actions = <Btn variant="primary" icon={Flag} onClick={() => onAction?.({ type: "review" }, task)}>去验收</Btn>;
  } else if (vs === "blocked") {
    actions = (
      <span style={{ display: "flex", gap: "var(--space-2)", flex: 1 }}>
        <input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="直接回答,比如「按商业受众写」"
          style={{ flex: 1, padding: "7px 10px", border: "1px solid var(--line)", borderRadius: "var(--radius-xs)", background: "var(--surface-control)", fontSize: "var(--text-sm)" }}
        />
        <Btn variant="ink-outline" onClick={() => onAction?.({ type: "answer", text: answer || "已回答" }, task)}>回答</Btn>
      </span>
    );
  } else if (vs === "paused_step_boundary") {
    actions = (
      <>
        <Btn variant="seal" icon={Check} onClick={() => onAction?.({ type: "step_ok" }, task)}>这一步行,继续</Btn>
        <Btn onClick={() => onAction?.({ type: "step_no" }, task)}>这步不对,说两句</Btn>
      </>
    );
  } else if (vs === "waiting_confirmation") {
    actions = (
      <>
        <Btn variant="seal" icon={Check} onClick={() => onAction?.({ type: "billing", accept: true }, task)}>拍板:切到 API 计费</Btn>
        <Btn onClick={() => onAction?.({ type: "billing", accept: false }, task)}>不切,停在这</Btn>
      </>
    );
  } else if (vs === "review_approved_waiting_merge") {
    actions = (
      <>
        <Btn variant="s3" icon={Fingerprint} onClick={() => onAction?.({ type: "s3_merge" }, task)}>用本机认证批准合并</Btn>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>S3 不可逆 · 仅这台电脑</span>
      </>
    );
  } else if (vs === "failed") {
    actions = (
      <>
        <Btn variant="ink-outline" icon={History} onClick={() => onAction?.({ type: "retry" }, task)}>重派(重过门禁)</Btn>
        <Btn onClick={() => onAction?.({ type: "open_focus" }, task)}>聊聊怎么修</Btn>
      </>
    );
  } else if (vs === "merge_failed") {
    actions = (
      <>
        <Btn variant="ink-outline" onClick={() => onAction?.({ type: "merge_conflict" }, task)}>看冲突</Btn>
        <Btn onClick={() => onAction?.({ type: "retry" }, task)}>我手改了,重新合并</Btn>
      </>
    );
  } else if (vs === "running") {
    actions = <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>跑到步边界或出事我会叫你</span>;
  } else if (vs === "merging") {
    actions = <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>合并进行中,不用你</span>;
  } else if (vs === "task_done") {
    actions = <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>已交付并合并 · <a onClick={() => onAction?.({ type: "review" }, task)} style={{ color: "var(--active-ink)", cursor: "pointer" }}>回看证据</a></span>;
  } else if (vs === "superseded") {
    actions = <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>被新版本替代,账还留着</span>;
  } else if (vs === "cancel_settled") {
    actions = <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>你叫停的,这轮作废 · 可以同卡重开</span>;
  } else if (vs === "queued" || vs === "confirmed") {
    actions = <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>排在队列里,到点我开工</span>;
  } else if (vs === "parked") {
    actions = (
      <>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
          停靠等你,{task.parkedDeadline ? `${task.parkedDeadline.slice(5, 10)} 前不回我就按老口径继续` : "回了我再走"}
        </span>
        <Btn variant="ink-outline" onClick={() => onAction?.({ type: "open_focus" }, task)}>去回答</Btn>
      </>
    );
  }

  return (
    <div style={card} data-task-card={task.id} data-view-status={vs}>
      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
        <Zap size={14} aria-hidden />
        <strong>{task.title}</strong>
        <StatusChip status={vs} deadline={task.parkedDeadline} />
        <RiskBadge risk={task.riskLevel} />
        <Mono faint>{isHopper ? "HP" : "T1"}</Mono>
        {task.projectTitle ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)", padding: "2px 8px", borderRadius: "var(--radius-2xs)", border: "1px solid var(--line)", color: "var(--text-secondary)", background: "var(--surface-ink-wash)" }}>
            <Folder size={10} aria-hidden /> {task.projectTitle}
          </span>
        ) : null}
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>第 {task.attempt} 次尝试</span>
      </div>
      <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginTop: 6 }}>{task.lastEvent}</div>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", fontFamily: "var(--font-mono)", marginTop: 4 }}>{budget}</div>
      {actions ? <ActionRow>{actions}</ActionRow> : null}
      {inModal ? (
        <ActionRow>
          <Btn icon={Layers} onClick={() => onAction?.({ type: "open_focus" }, task)}>打开所属 Focus</Btn>
        </ActionRow>
      ) : null}
    </div>
  );
}
