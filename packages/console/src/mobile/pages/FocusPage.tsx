import { MobileHeader, MobileNotice } from "../MobileChrome";
import { countLaneStates } from "../laneState";
import type { FocusDetailPayload } from "../types";

const EVENT_LABEL: Record<string, string> = {
  created: "立下这件事",
  revision_settled: "方向更新",
  lane_split: "拆出泳道",
  lane_retired: "收起泳道",
  obligation_opened: "记下一件事",
  obligation_resolved: "办结一件事",
  lifecycle_changed: "生命周期变化",
  artifact_linked: "登记产物",
  artifact_realized: "产物交付"
};

const STATE_LABELS = [
  ["needsYou", "需要你"],
  ["running", "进行中"],
  ["queued", "队列"],
  ["settled", "已收尾"]
] as const;

export function MobileFocusPage({ data, error }: { data: FocusDetailPayload | null; error: string | null }) {
  if (error) return <><MobileHeader title="Focus" crumb="详情读取失败" back="/m/things" /><MobileNotice tone="error">{error}</MobileNotice></>;
  if (!data) return <><MobileHeader title="Focus" crumb="正在翻账" back="/m/things" /><MobileNotice>正在读取方向与泳道</MobileNotice></>;
  const lanes = [
    ...(data.obligations.some((item) => item.laneId === null) ? [{ id: "_main", title: "主线", retiredAt: null }] : []),
    ...data.lanes.filter((lane) => lane.retiredAt === null)
  ];
  return (
    <div data-mobile-page="focus">
      <MobileHeader title={data.focus.title} crumb={`事 · r${data.focus.currentRevision}`} back="/m/things" />
      <section className="m-direction">
        <span>方向 · 一句话</span>
        <strong>{data.focus.direction ? `「${data.focus.direction}」` : "还没有可读的方向"}</strong>
        <small>{data.focus.semanticAuthority} · 账本只读投影</small>
      </section>
      <section className="m-section">
        <h2>泳道 <small>{lanes.length}</small></h2>
        {lanes.map((lane) => {
          const obligations = data.obligations.filter((item) => lane.id === "_main" ? item.laneId === null : item.laneId === lane.id);
          const counts = countLaneStates(obligations);
          return (
            <a className="m-lane-card" href={`#/m/lane/${encodeURIComponent(data.focus.id)}/${encodeURIComponent(lane.id)}`} key={lane.id}>
              <strong>{lane.title}</strong>
              <div>{STATE_LABELS.filter(([key]) => counts[key] > 0).map(([key, label]) => <span className={`m-chip m-chip-${key}`} key={key}>{label} {counts[key]}</span>)}</div>
            </a>
          );
        })}
        {lanes.length === 0 ? <MobileNotice>这件事还没有泳道条目。</MobileNotice> : null}
      </section>
      <section className="m-section m-trail">
        <h2>最近轨迹 <small>只增不改</small></h2>
        {[...data.events].reverse().slice(0, 8).map((event) => (
          <article key={event.id}>
            <time>{formatEventTime(event.createdAt)}</time>
            <strong>{eventText(event.type, event.payload)}</strong>
            <small>账#{event.seq} · {event.actorKind}</small>
          </article>
        ))}
      </section>
    </div>
  );
}

function formatEventTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function eventText(type: string, payload: Record<string, unknown>): string {
  if (typeof payload["title"] === "string") return `${EVENT_LABEL[type] ?? type}「${payload["title"]}」`;
  if (type === "revision_settled" && payload["revision"] !== undefined) return `方向更新到 r${String(payload["revision"])}`;
  return EVENT_LABEL[type] ?? type;
}
