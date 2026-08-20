// FocusRail(demo railHtml):右栏四组(安排/产物/涉及项目/记住的事)——只读状态投影,
// 点击回调定位(handoff §4.2 对话-账本双向锚定);条目状态只留 chip,sub 不重复状态文字(§4.2);
// 右栏不做操作面(11 §0.1-1 操作面唯一性:推进操作永远在对话/今天页单点)。

import { Book, ExternalLink, FileText, Flag, Folder, Hourglass, Layers, Package, User, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { Btn, Chip, RailItem, RailSection } from "./shared";
import { StatusChip } from "../StatusChip";
import type { ArtifactView, ObligationView, TaskView } from "./types";

const NEEDS_LABEL: Record<string, string> = {
  decision: "等你拍板",
  input: "等你补充",
  action: "等你的动作",
  unknown: "待归类"
};

const OPEN_SET = ["open", "in_progress", "waiting", "deferred", "blocked"];

function artifactStatusBadge(a: ArtifactView) {
  const base = { fontSize: 10, fontFamily: "var(--font-mono)", padding: "1px 6px", borderRadius: "var(--radius-2xs)", flex: "none", whiteSpace: "nowrap" as const };
  if (a.superseded) return <span style={{ ...base, color: "var(--text-faint)", border: "1px solid var(--text-faint)" }}>已被替代</span>;
  if (a.role === "deliverable") return <span style={{ ...base, color: "var(--color-success)", border: "1px solid var(--color-success)" }}>已产出</span>;
  if (a.role === "expected") {
    const missing = a.obRef !== undefined;
    return <span style={{ ...base, color: "var(--color-warning)", border: "1px dashed var(--color-warning)" }}>{missing ? "缺料,等你" : "待产出"}</span>;
  }
  return <span style={{ ...base, color: "var(--text-muted)", border: "1px solid var(--line)" }}>参考</span>;
}

export function FocusRail({ obligations, tasks, artifacts, projects, memories, onLocate, onExpect, afterArtifacts }: {
  obligations: ObligationView[];
  tasks: TaskView[];
  artifacts: ArtifactView[];
  projects: { id: string; title: string; path: string }[];
  memories: { id: string; tier: string; trust: "user_stated" | "user_approved" | "auto_low_impact"; text: string }[];
  /** 点击定位:容器负责滚动到时间线条目并闪烁(对话-账本双向锚定) */
  onLocate?: (target: { kind: "obligation" | "task" | "artifact" | "project"; id: string }) => void;
  /** 「我期待一个 X」回调(handoff 外 demo v2.1 增量,挂在产物组尾) */
  onExpect?: () => void;
  /** 产物组之后的插槽(HANDOFF-2 §1 拍板:期待组排在这里,由页面传 ExpectationGroup) */
  afterArtifacts?: ReactNode;
}) {
  const open = obligations.filter(o => OPEN_SET.includes(o.status));
  const human = open.filter(o => o.owner === "human" && ["open", "blocked"].includes(o.status));
  const agent = open.filter(o => o.owner === "agent" && ["open", "in_progress"].includes(o.status));
  const agentWaiting = open.filter(o => o.owner === "agent" && o.status === "waiting");
  const external = open.filter(o => o.owner === "external" && ["waiting", "deferred"].includes(o.status));
  const doneCount = obligations.length - open.length;
  const activeTasks = tasks.filter(t => ["running", "queued", "confirmed", "paused_step_boundary", "waiting_confirmation", "merging"].includes(t.viewStatus));

  const obItem = (o: ObligationView) => (
    <RailItem
      key={o.id}
      icon={o.owner === "human" ? User : o.owner === "agent" ? Zap : ExternalLink}
      onClick={onLocate ? () => onLocate({ kind: "obligation", id: o.id }) : undefined}
      title={o.title}
      sub={
        o.status === "waiting" && o.waitingOn
          ? `等 ${o.waitingOn}${o.dueOrTrigger ? ` · ${o.dueOrTrigger}` : ""}`
          : o.status === "deferred" && o.deferReason
            ? `已推迟:${o.deferReason}`
            : o.owner === "human" && o.needs
              ? NEEDS_LABEL[o.needs] ?? undefined
              : undefined
      }
    />
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }} data-focus-rail>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", padding: "0 6px" }}>
        点条目,左侧对话会跳到生成它的那一条
      </div>

      <RailSection title="安排" icon={Layers} count={human.length + agent.length + external.length + agentWaiting.length + activeTasks.length}>
        {human.length ? (
          <>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-warning)", padding: "6px 8px 2px", display: "flex", gap: 6, alignItems: "center" }}>
              <Flag size={11} aria-hidden /> 需要你
            </div>
            {human.map(obItem)}
          </>
        ) : null}
        {activeTasks.length || agent.length ? (
          <>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-success)", padding: "6px 8px 2px", display: "flex", gap: 6, alignItems: "center" }}>
              <Zap size={11} aria-hidden /> 我在做
            </div>
            {activeTasks.map(t => (
              <RailItem
                key={t.id}
                icon={Zap}
                onClick={onLocate ? () => onLocate({ kind: "task", id: t.id }) : undefined}
                title={t.title}
                sub={t.attempt > 1 ? `第 ${t.attempt} 次尝试` : t.route === "hopper" ? "Hopper 执行域" : undefined}
                right={<StatusChip status={t.viewStatus} deadline={t.parkedDeadline} />}
              />
            ))}
            {agent.map(obItem)}
          </>
        ) : null}
        {external.length || agentWaiting.length ? (
          <>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", padding: "6px 8px 2px", display: "flex", gap: 6, alignItems: "center" }}>
              <Hourglass size={11} aria-hidden /> 等外部 / 待命
            </div>
            {external.map(obItem)}
            {agentWaiting.map(obItem)}
          </>
        ) : null}
        {doneCount ? <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", padding: "6px 8px 2px" }}>已了结 {doneCount} 件</div> : null}
        {!human.length && !agent.length && !external.length && !agentWaiting.length && !activeTasks.length ? (
          <div style={{ padding: 12, textAlign: "center", color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>没有未结的安排</div>
        ) : null}
      </RailSection>

      <RailSection title="产物" icon={Package} count={artifacts.length}>
        {artifacts.map(a => (
          <RailItem
            key={a.id}
            icon={FileText}
            onClick={onLocate ? () => onLocate({ kind: "artifact", id: a.id }) : undefined}
            title={a.title}
            sub={`${a.role === "expected" ? "expected" : `v${a.version}`}${a.producedBy ? ` · 由${a.producedBy}产出` : ""}${a.projectTitle ? ` · ${a.projectTitle}` : ""}`}
            right={artifactStatusBadge(a)}
          />
        ))}
        {onExpect ? (
          <div style={{ padding: "4px 8px" }}>
            <Btn onClick={onExpect} icon={Package}>我期待一个 X</Btn>
          </div>
        ) : null}
      </RailSection>

      {afterArtifacts}

      {projects.length ? (
        <RailSection title="涉及项目" icon={Folder} count={projects.length}>
          {projects.map(p => (
            <RailItem
              key={p.id}
              icon={Folder}
              onClick={onLocate ? () => onLocate({ kind: "project", id: p.id }) : undefined}
              title={p.title}
              sub={<span style={{ fontFamily: "var(--font-mono)" }}>{p.path}</span>}
            />
          ))}
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", padding: "4px 8px" }}>Focus 可跨项目;也可以不属于任何项目</div>
        </RailSection>
      ) : null}

      {memories.length ? (
        <RailSection title="记住的事" icon={Book} count={memories.length}>
          {memories.map(x => (
            <div key={x.id} style={{ display: "flex", gap: "var(--space-2)", padding: "7px 8px", fontSize: "var(--text-sm)" }}>
              <Chip
                tone={x.trust === "user_stated" ? "ink" : x.trust === "user_approved" ? "success" : "muted"}
                dashed={x.trust === "auto_low_impact"}
              >
                {x.trust === "user_stated" ? "你说过" : x.trust === "user_approved" ? "你确认过" : "自动"}
              </Chip>
              <span style={{ flex: 1, minWidth: 0 }}>{x.text}</span>
            </div>
          ))}
        </RailSection>
      ) : null}
    </div>
  );
}
