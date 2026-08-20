// 弹窗族(handoff 清单第 13 行):Modal 壳 + 审批(含 S2 改后批准 textarea 流)/义务/产物/
// HP 详情+DecisionRequest/S3 说明/tailnet 预览/新 Focus 表单/邮件预览(P1 提案挂 stage-tag,不接真实通道 §4.7)。
// 全部 props 进、回调出;inline 模式供预览页平铺(无遮罩)。

import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import { Check, Fingerprint, Mail, Pencil, Shield, X } from "lucide-react";
import { ActionRow, Btn, card, KV, Mono, StageTag } from "./shared";
import { StatusChip, RiskBadge } from "../StatusChip";
import type { TaskAction } from "./TaskCard";
import type { ApprovalView, ArtifactView, ObligationView, TaskView } from "./types";

export function ModalFrame({ title, icon: Icon, onClose, inline, children, width }: {
  title: ReactNode;
  icon?: typeof Shield;
  onClose?: () => void;
  /** 预览页平铺模式:无遮罩、不占位 */
  inline?: boolean;
  children: ReactNode;
  width?: number;
}) {
  const box = (
    <div style={{ ...card, width: width ?? "min(680px, 92vw)", maxHeight: inline ? undefined : "84vh", overflowY: "auto", padding: "var(--space-5)" }} role="dialog">
      <div style={{ fontSize: "var(--text-md)", fontWeight: 600, display: "flex", gap: 8, alignItems: "center", marginBottom: "var(--space-3)" }}>
        {Icon ? <Icon size={15} aria-hidden /> : null}
        {title}
      </div>
      {children}
      {onClose ? (
        <ActionRow>
          <Btn onClick={onClose}>关上</Btn>
        </ActionRow>
      ) : null}
    </div>
  );
  if (inline) return box;
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 80, background: "var(--scrim)", display: "grid", placeItems: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      {box}
    </div>
  );
}

/* ---------- 审批(含 S2 改后批准) ---------- */
export function ApprovalModal({ approval, onAction, onClose, inline }: {
  approval: ApprovalView;
  onAction?: (action: "accept" | "reject" | "ignore" | "edit_confirm", editedCommand?: string) => void;
  onClose?: () => void;
  inline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [cmd, setCmd] = useState("git push origin demo/redesign-2026-08-07");
  return (
    <ModalFrame title="审批 · 等你拍板" icon={Shield} onClose={onClose} inline={inline}>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center", marginBottom: "var(--space-3)" }}>
        <span>所属:{approval.focusTitle}</span>
        {approval.taskTitle ? <span>任务:{approval.taskTitle}</span> : null}
        <RiskBadge risk={approval.riskLevel} />
        <Mono faint>{approval.decidedVia}</Mono>
      </div>
      <KV k="效果"><Mono>{approval.effect ?? "—"}</Mono></KV>
      <KV k="目标"><Mono>{approval.target ?? "—"}</Mono></KV>
      <KV k="下游">{approval.downstream?.length ? approval.downstream.map(d => <Mono key={d} faint>{d} </Mono>) : "无"}</KV>
      <KV k="时效">{approval.expiry ?? "—"}</KV>
      <div style={{ fontSize: "var(--text-sm)", marginTop: "var(--space-3)" }}>
        口播原文:「{approval.title}」——所闻即所签,播的什么签的就是什么。
      </div>
      <ActionRow>
        <Btn variant="seal" icon={Check} onClick={() => onAction?.("accept")}>批准</Btn>
        {approval.riskLevel === "S2" ? (
          <Btn variant="ink-outline" icon={Pencil} onClick={() => setEditing(true)}>
            改后批准 <StageTag>仅 S2 · 本机</StageTag>
          </Btn>
        ) : null}
        <Btn variant="danger-outline" onClick={() => onAction?.("reject")}>拒绝</Btn>
        <Btn onClick={() => onAction?.("ignore")}>稍后</Btn>
      </ActionRow>
      {editing ? (
        <div style={{ marginTop: "var(--space-3)" }}>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: 4 }}>改成什么样再批(原命令逐字可改)</div>
          <textarea
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            rows={2}
            style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--line)", borderRadius: "var(--radius-xs)", background: "var(--surface-control)", fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)" }}
          />
          <ActionRow>
            <Btn variant="seal" onClick={() => onAction?.("edit_confirm", cmd)}>按我改的签新收据</Btn>
          </ActionRow>
        </div>
      ) : null}
    </ModalFrame>
  );
}

/* ---------- 义务详情 ---------- */
export function ObligationModal({ obligation, focusTitle, onAction, onClose, inline }: {
  obligation: ObligationView;
  focusTitle: string;
  onAction?: (action: "done" | "to_ai" | "later" | "nudge" | "answer", text?: string) => void;
  onClose?: () => void;
  inline?: boolean;
}) {
  const o = obligation;
  const [answer, setAnswer] = useState("");
  const STATUS: Record<ObligationView["status"], string> = {
    open: "待处理", in_progress: "进行中", waiting: "等待中", deferred: "已推迟",
    blocked: "卡住", resolved: "已了结", superseded: "已被替代"
  };
  return (
    <ModalFrame title={o.title} onClose={onClose} inline={inline}>
      <KV k="所属">{focusTitle}</KV>
      <KV k="球在谁那">
        {{ human: "你", agent: "我(AI)", external: "外部" }[o.owner]}
        {o.needs ? ` · ${{ decision: "等你拍板", input: "等你补充", action: "等你的动作", unknown: "待归类" }[o.needs]}` : ""}
      </KV>
      <KV k="状态">{STATUS[o.status]}{o.blocking ? " · 挡着后续" : ""}</KV>
      {o.waitingOn ? <KV k="在等">{o.waitingOn}{o.dueOrTrigger ? ` · ${o.dueOrTrigger}` : ""}</KV> : null}
      {o.deferReason ? <KV k="推迟原因">{o.deferReason}</KV> : null}
      {o.owner === "human" && ["open", "blocked"].includes(o.status) ? (
        <>
          {o.needs === "input" || o.needs === "decision" ? (
            <div style={{ marginTop: "var(--space-3)" }}>
              <input
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="直接回答"
                style={{ width: "100%", padding: "7px 10px", border: "1px solid var(--line)", borderRadius: "var(--radius-xs)", background: "var(--surface-control)", fontSize: "var(--text-sm)" }}
              />
            </div>
          ) : null}
          <ActionRow>
            {o.needs ? <Btn variant="primary" icon={Check} onClick={() => onAction?.("answer", answer || "已回答")}>回答</Btn> : null}
            <Btn variant="primary" icon={Check} onClick={() => onAction?.("done")}>标完成</Btn>
            <Btn onClick={() => onAction?.("to_ai")}>转给我做</Btn>
            <Btn onClick={() => onAction?.("later")}>稍后</Btn>
          </ActionRow>
        </>
      ) : null}
      {o.owner === "external" && o.status === "waiting" ? (
        <ActionRow>
          <Btn icon={Mail} onClick={() => onAction?.("nudge")}>催一下 <StageTag>P1</StageTag></Btn>
        </ActionRow>
      ) : null}
    </ModalFrame>
  );
}

/* ---------- 产物详情 ---------- */
export function ArtifactModal({ artifact, focusTitle, onAction, onClose, inline }: {
  artifact: ArtifactView;
  focusTitle: string;
  onAction?: (action: "realize" | "export" | "open_task") => void;
  onClose?: () => void;
  inline?: boolean;
}) {
  const a = artifact;
  return (
    <ModalFrame title={a.title} onClose={onClose} inline={inline}>
      <KV k="状态">
        {a.superseded ? "已被替代" : a.role === "deliverable" ? "已产出" : a.role === "expected" ? "待产出(expected)" : "参考"}
      </KV>
      <KV k="所属">{focusTitle}{a.projectTitle ? ` · ${a.projectTitle}` : " · 不属于任何项目"}</KV>
      {a.digest ? <KV k="digest"><Mono faint>{a.digest}</Mono></KV> : null}
      {a.producedBy ? <KV k="产出任务">{a.producedBy}</KV> : null}
      {a.realizedAt ? <KV k="产出时间"><Mono faint>{a.realizedAt}</Mono></KV> : null}
      <ActionRow>
        {a.role === "expected" ? <Btn variant="primary" icon={Check} onClick={() => onAction?.("realize")}>标记已产出(realize)</Btn> : null}
        {a.digest ? <Btn onClick={() => onAction?.("export")}>导出 JSON</Btn> : null}
        {a.producedBy ? <Btn onClick={() => onAction?.("open_task")}>看关联任务</Btn> : null}
      </ActionRow>
    </ModalFrame>
  );
}

/* ---------- HP 详情 + DecisionRequest ---------- */
const HP_MAP: Record<string, string> = {
  received: "已接单·分诊中",
  ready: "排队中(唯一可说排队的档)",
  running: "执行中",
  review: "等你验收(settle 已过)",
  merging: "合并中",
  done: "已交付",
  failed: "失败了",
  blocked: "卡住(分诊出口,不说排队)"
};

export function HpTaskModal({ task, focusTitle, onAction, onClose, inline }: {
  task: TaskView;
  focusTitle: string;
  onAction?: (action: TaskAction | { type: "hp_decision"; allow: boolean }) => void;
  onClose?: () => void;
  inline?: boolean;
}) {
  return (
    <ModalFrame title={<>{task.title} <Mono faint>HP</Mono></>} onClose={onClose} inline={inline}>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center", marginBottom: "var(--space-3)" }}>
        <span>所属:{focusTitle}</span>
        <StatusChip status={task.viewStatus} />
        <RiskBadge risk={task.riskLevel} />
      </div>
      <KV k="Hopper 态"><span><Mono>{task.lastEvent.includes("接单") ? "received" : "—"}</Mono> → 投影「{HP_MAP[task.lastEvent.includes("接单") ? "received" : "ready"] ?? "…"}」(09 §7 映射)</span></KV>
      <KV k="账本">执行事实、证据、成本归 Hopper authoritative ledger,这里只投影</KV>
      <KV k="熔断"><Mono>¥{task.budget.maxCost}</Mono> · 已花 {task.spent.known ? `¥${task.spent.value}` : "还没有确切数字"}</KV>
      {task.hpDecision && task.viewStatus === "blocked" ? (
        <>
          <div style={{ fontSize: "var(--text-md)", fontWeight: 600, margin: "var(--space-4) 0 var(--space-2)" }}>
            DecisionRequest · 执行中遇到必须由你裁决的门
          </div>
          <div style={{ fontSize: "var(--text-sm)" }}>{task.hpDecision}</div>
          <ActionRow>
            <Btn variant="seal" onClick={() => onAction?.({ type: "hp_decision", allow: true })}>可以发</Btn>
            <Btn onClick={() => onAction?.({ type: "hp_decision", allow: false })}>不行,换写法</Btn>
          </ActionRow>
        </>
      ) : null}
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", marginTop: "var(--space-3)" }}>
        执行细节与独立验收在 Hopper Console(工程排障面);settlement 回来后这里呈现「等你验收」。SayDo 不另存一份执行真相。
      </div>
    </ModalFrame>
  );
}

/* ---------- S3 说明卡(语音/远程语境永不渲染本卡的批准变体) ---------- */
export function S3InfoModal({ onClose, inline }: { onClose?: () => void; inline?: boolean }) {
  return (
    <ModalFrame title="S3 强认证(演示环境)" icon={Fingerprint} onClose={onClose} inline={inline}>
      <div style={{ fontSize: "var(--text-sm)" }}>
        真实环境这里会唤起系统 Touch ID。S3 = 不可逆外部影响(合并 / 发布 / 删除),只在这台电脑上、由你本人完成;语音与远程永不出现这个按钮。
      </div>
      <div style={{ fontSize: "var(--text-md)", fontWeight: 600, margin: "var(--space-4) 0 var(--space-2)" }}>流程(WebAuthn · rpId=localhost)</div>
      {[
        ["1 challenge", "daemon 签发单次挑战(120 秒),带 prospectiveTreeSha 对账"],
        ["2 Touch ID", "系统弹窗按指纹;同步凭据(BE/BS)会诚实展示,不宣称「密钥不出机」"],
        ["3 verify", "签出 S3MergeReceipt:单次消费、过期即失效、一挑战至多一收据"],
        ["4 approve-merge", "五重事务断言后进入 merging;失败走 merge_failed,不硬并"]
      ].map(([k, v]) => (
        <div key={k} style={{ display: "flex", gap: "var(--space-2)", fontSize: "var(--text-sm)", padding: "6px 0", borderBottom: "1px dashed var(--line)" }}>
          <Mono faint>{k}</Mono><span>{v}</span>
        </div>
      ))}
    </ModalFrame>
  );
}

/* ---------- tailnet 手机薄版预览 ---------- */
export function TailnetPreviewModal({ items, onClose, inline }: {
  items: { id: string; title: string; focusTitle: string }[];
  onClose?: () => void;
  inline?: boolean;
}) {
  return (
    <ModalFrame title="手机薄版(tailnet)长这样" onClose={onClose} inline={inline}>
      <div style={{ display: "flex", gap: "var(--space-5)", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ width: 280, flex: "none", border: "1.5px solid var(--line)", borderRadius: "var(--radius-xl)", padding: 14, background: "var(--surface-soft)" }}>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: 8 }}>今天 · 薄版(只读为主)</div>
          {items.map(a => (
            <div key={a.id} style={{ padding: 10, border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", marginBottom: 8, fontSize: 13 }}>
              {a.title}
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", marginTop: 4 }}>{a.focusTitle}</div>
              <Btn disabled style={{ marginTop: 6, width: "100%", justifyContent: "center" }}>回桌面或语音处理</Btn>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: "var(--text-sm)" }}>薄版的原则是<strong>只能看、不能重授权</strong>:</div>
          <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 5, fontSize: "var(--text-sm)" }}>
            <li style={{ display: "flex", gap: 8 }}><Check size={12} aria-hidden style={{ color: "var(--color-success)", flex: "none", marginTop: 4 }} /><span>看进展、看通知、看成本</span></li>
            <li style={{ display: "flex", gap: 8 }}><Check size={12} aria-hidden style={{ color: "var(--color-success)", flex: "none", marginTop: 4 }} /><span>低风险审批(≤S2)走 push / paired_device_pin</span></li>
            <li style={{ display: "flex", gap: 8 }}><X size={12} aria-hidden style={{ color: "var(--color-error)", flex: "none", marginTop: 4 }} /><span>S3 永不渲染,edit 仅本机屏幕</span></li>
            <li style={{ display: "flex", gap: 8 }}><X size={12} aria-hidden style={{ color: "var(--color-error)", flex: "none", marginTop: 4 }} /><span>不能改项目覆盖、不能删数据</span></li>
          </ul>
        </div>
      </div>
    </ModalFrame>
  );
}

/* ---------- 新 Focus 表单(handoff §4.6:不说「没有建项表单」,说「不必先立项,开口即可」) ---------- */
export function NewFocusModal({ spaces, onAction, onClose, inline }: {
  spaces: { id: string; title: string }[];
  onAction?: (action: "create" | "create_and_chat", data: { title: string; direction: string; spaceId: string }) => void;
  onClose?: () => void;
  inline?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [direction, setDirection] = useState("");
  const [spaceId, setSpaceId] = useState(spaces[0]?.id ?? "");
  const data = { title: title.trim(), direction: direction.trim(), spaceId };
  const field: CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid var(--line)", borderRadius: "var(--radius-xs)", background: "var(--surface-control)", fontSize: "var(--text-sm)" };
  return (
    <ModalFrame title="新 Focus · 立一件持续的事" onClose={onClose} inline={inline}>
      <div style={{ marginBottom: "var(--space-3)" }}>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: 4 }}>叫什么</div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="比如:双十一活动页面" style={field} autoFocus />
      </div>
      <div style={{ marginBottom: "var(--space-3)" }}>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: 4 }}>方向(可选,一句话说清要什么)</div>
        <input value={direction} onChange={(e) => setDirection(e.target.value)} placeholder="比如:11 月 1 日前上线,先出三版设计稿" style={field} />
      </div>
      <div style={{ marginBottom: "var(--space-3)" }}>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: 4 }}>归到哪个空间</div>
        <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)} style={field}>
          {spaces.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
      </div>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
        不必先立项,开口即可——这个表单只是快速立卡的旁路;主路径是开口聊,聊成熟我会问你要不要立成 Focus。Focus 可以不属于任何项目。
      </div>
      <ActionRow>
        <Btn variant="primary" disabled={!data.title} onClick={() => onAction?.("create_and_chat", data)}>创建并开聊</Btn>
        <Btn disabled={!data.title} onClick={() => onAction?.("create", data)}>仅创建</Btn>
        {onClose ? <Btn onClick={onClose}>取消</Btn> : null}
      </ActionRow>
    </ModalFrame>
  );
}

/* ---------- 邮件推送预览(P1 提案,不接任何真实通道——handoff §4.7) ---------- */
export function EmailPreviewModal({ items, onClose, inline }: {
  items: { id: string; title: string }[];
  onClose?: () => void;
  inline?: boolean;
}) {
  return (
    <ModalFrame title={<>邮件推送预览 <StageTag>P1</StageTag> <StageTag>提案</StageTag></>} icon={Mail} onClose={onClose} inline={inline}>
      <div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", overflow: "hidden", fontSize: "var(--text-sm)" }}>
        <div style={{ background: "var(--surface-ink-wash)", padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>发件人 <Mono>saydo@local</Mono> · 每天最多一封,有事才发</div>
          <div style={{ fontWeight: 500, marginTop: 4 }}>【SayDo】{items.length} 件事需要你</div>
        </div>
        <div style={{ padding: 14 }}>
          {items.map((a, i) => (
            <div key={a.id} style={{ marginBottom: 10 }}>
              {i + 1}. {a.title}
              <br />
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>回复「{i + 1}」看详情,回复「{i + 1} 行/不行/已放好」直接处理(仅低风险 S0–S2)</span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid var(--line)", marginTop: "var(--space-3)", paddingTop: "var(--space-3)", fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
            与「今天」页同一账本:在 App 里处理过的事,邮件里自动作废,不会两头催。S3(合并/发布/删除)永不进邮件,只能回本机屏幕。
          </div>
        </div>
      </div>
    </ModalFrame>
  );
}
