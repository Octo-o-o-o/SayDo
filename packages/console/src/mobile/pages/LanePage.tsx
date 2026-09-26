import { useState } from "react";
import { cacheCard } from "../cardResolver";
import { obligationLaneState, type LaneState } from "../laneState";
import { MobileHeader, MobileNotice } from "../MobileChrome";
import type { AttentionItem, FocusDetailPayload, MobileObligation } from "../types";

const SECTIONS: Array<{ state: LaneState; label: string }> = [
  { state: "needsYou", label: "需要你" },
  { state: "running", label: "进行中" },
  { state: "queued", label: "队列" },
  { state: "settled", label: "已收尾" }
];

type LaneTab = "work" | "trail" | "deps";

const TAB_LABEL: Record<LaneTab, string> = { work: "工作", trail: "航迹", deps: "依赖" };

const DEP_EVENT_LABEL: Record<string, string> = {
  created: "立下这件事",
  revision_settled: "方向更新",
  lane_created: "新开支线",
  lane_split: "拆出泳道",
  lane_restored: "恢复支线",
  lane_retired: "收起泳道",
  obligation_opened: "记下一件事",
  obligation_resolved: "办结一件事",
  obligation_deferred: "推迟一件事",
  obligation_waiting_on_task: "设任务依赖",
  obligation_waiting_on: "设依赖",
  obligation_unblocked: "依赖放行",
  obligation_blocked: "依赖卡住",
  dependency_task_set: "设任务依赖",
  dependency_task_woken: "任务依赖放行",
  dependency_task_blocked: "任务依赖卡住",
  dependency_set: "设依赖",
  dependency_woken: "依赖放行",
  dependency_blocked: "依赖卡住",
  lifecycle_changed: "生命周期变化",
  focus_forked: "分叉",
  artifact_linked: "登记产物",
  artifact_realized: "产物交付"
};

function eventText(type: string, payload: Record<string, unknown>): string {
  if (typeof payload["title"] === "string") return `${DEP_EVENT_LABEL[type] ?? type}「${payload["title"]}」`;
  if (type === "revision_settled" && payload["revision"] !== undefined) return `方向更新到 r${String(payload["revision"])}`;
  return DEP_EVENT_LABEL[type] ?? type;
}

/** 义务前置文案:任务级(带条件)/ 义务级(带标题)/ 自由文本三级兜底 */
function waitingText(o: MobileObligation, byId: Map<string, string>): string | null {
  if (o.waitingOnTaskId) {
    const cond = o.waitingTaskCondition === "delivered" ? "已交付" : "验收通过";
    return `等任务 ${o.waitingOnTaskId.slice(-8)} ${cond}`;
  }
  if (o.waitingOnObligationId) {
    return `等「${byId.get(o.waitingOnObligationId) ?? o.waitingOnObligationId}」`;
  }
  return o.waitingOn;
}

export function MobileLanePage({
  data,
  laneId,
  error
}: {
  data: FocusDetailPayload | null;
  laneId: string;
  error: string | null;
}) {
  const [tab, setTab] = useState<LaneTab>("work");
  if (error) return <><MobileHeader title="泳道" crumb="读取失败" back={data ? `/m/focus/${data.focus.id}` : "/m/things"} /><MobileNotice tone="error">{error}</MobileNotice></>;
  if (!data) return <><MobileHeader title="泳道" crumb="正在翻账" back="/m/things" /><MobileNotice>正在读取四状态</MobileNotice></>;
  const lane = laneId === "_main" ? { id: "_main", title: "主线" } : data.lanes.find((item) => item.id === laneId);
  if (!lane) return <><MobileHeader title="泳道不存在" crumb={data.focus.title} back={`/m/focus/${data.focus.id}`} /><MobileNotice>这条泳道已不在当前 Focus 中。</MobileNotice></>;
  const obligations = data.obligations.filter((item) => laneId === "_main" ? item.laneId === null : item.laneId === laneId);
  const open = (obligation: MobileObligation) => {
    const item: AttentionItem = {
      id: `ob:${obligation.id}`,
      color: colorForState(obligationLaneState(obligation)),
      title: obligation.title,
      focusId: data.focus.id,
      focusTitle: data.focus.title,
      action: "open_task_modal",
      updatedAt: data.focus.updatedAt,
      laneId: obligation.laneId,
      sourceKind: "obligation",
      refId: obligation.id
    };
    cacheCard(item);
    location.hash = `/m/card/obligation/${encodeURIComponent(obligation.id)}`;
  };

  const titleById = new Map(data.obligations.map((o) => [o.id, o.title] as const));
  const laneObIds = new Set(obligations.map((o) => o.id));
  // 航迹:归线优先 payload.laneId;其次 obligationId 属于本线;主线收无归线事件
  const laneEvents = [...data.events].reverse().filter((e) => {
    const p = e.payload as Record<string, unknown>;
    const pLane = typeof p["laneId"] === "string" ? p["laneId"] : null;
    const pOb = typeof p["obligationId"] === "string" ? p["obligationId"] : null;
    if (laneId === "_main") return pLane === null && (pOb === null || laneObIds.has(pOb));
    return pLane === laneId || (pOb !== null && laneObIds.has(pOb));
  });
  const deps = obligations.filter((o) => o.waitingOnTaskId || o.waitingOnObligationId || o.waitingOn);

  return (
    <div data-mobile-page="lane">
      <MobileHeader title={lane.title} crumb={`事 · ${data.focus.title}`} back={`/m/focus/${encodeURIComponent(data.focus.id)}`} />
      {/* DAILY-01:支线三视图(工作/航迹/依赖)——结构编辑仍归桌面 */}
      <nav className="m-lane-tabs" data-lane-tabs>
        {(["work", "trail", "deps"] as const).map((t) => (
          <button key={t} type="button" className={tab === t ? "is-active" : ""} data-lane-tab={t} onClick={() => setTab(t)}>
            {TAB_LABEL[t]}
          </button>
        ))}
      </nav>

      {tab === "work" ? SECTIONS.map((section) => {
        const rows = obligations.filter((item) => obligationLaneState(item) === section.state);
        return (
          <section className={`m-lane-section m-lane-${section.state}`} key={section.state}>
            <h2>{section.label} <small>{rows.length}</small></h2>
            {rows.map((item) => (
              <button
                type="button"
                className="m-ledger-card"
                key={item.id}
                data-mobile-obligation={item.id}
                aria-label={`打开安排:${item.title}`}
                onClick={() => open(item)}
              >
                <span className="m-meta">{item.owner} · {item.kind}</span>
                <strong>{item.title}</strong>
                <span>{item.nextStep ?? item.waitingOn ?? item.detail ?? statusLabel(item.status)}</span>
              </button>
            ))}
            {rows.length === 0 ? <p className="m-empty-row">本组为空</p> : null}
          </section>
        );
      }) : null}

      {tab === "trail" ? (
        <section className="m-section m-trail" data-lane-trail>
          <h2>这条线的航迹 <small>只增不改</small></h2>
          {laneEvents.length === 0 ? <p className="m-empty-row">这条线还没有记账事件</p> : null}
          {laneEvents.slice(0, 30).map((event) => (
            <article key={event.id}>
              <time>{formatEventTime(event.createdAt)}</time>
              <strong>{eventText(event.type, event.payload)}</strong>
              <small>账#{event.seq} · {event.actorKind}</small>
            </article>
          ))}
        </section>
      ) : null}

      {tab === "deps" ? (
        <section className="m-section" data-lane-deps>
          <h2>依赖 <small>只读;增减在桌面</small></h2>
          {deps.length === 0 ? <p className="m-empty-row">这条线没有等待依赖</p> : null}
          {deps.map((o) => (
            <div className="m-ledger-card" key={o.id} data-lane-dep={o.id}>
              <span className="m-meta">{o.owner} · {statusLabel(o.status)}</span>
              <strong>{o.title}</strong>
              <span>{waitingText(o, titleById) ?? "等待中"}</span>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function colorForState(state: LaneState): AttentionItem["color"] {
  return ({ needsYou: "orange", running: "green", queued: "gray", settled: "gray" } as const)[state];
}

function statusLabel(status: MobileObligation["status"]): string {
  return ({ open: "排队", in_progress: "进行中", waiting: "等待", deferred: "搁置", blocked: "需要你", resolved: "已收尾", superseded: "已被替代" } as const)[status];
}

function formatEventTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
