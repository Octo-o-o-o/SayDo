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

export function MobileLanePage({
  data,
  laneId,
  error
}: {
  data: FocusDetailPayload | null;
  laneId: string;
  error: string | null;
}) {
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
  return (
    <div data-mobile-page="lane">
      <MobileHeader title={lane.title} crumb={`事 · ${data.focus.title} · 四状态`} back={`/m/focus/${encodeURIComponent(data.focus.id)}`} />
      {SECTIONS.map((section) => {
        const rows = obligations.filter((item) => obligationLaneState(item) === section.state);
        return (
          <section className={`m-lane-section m-lane-${section.state}`} key={section.state}>
            <h2>{section.label} <small>{rows.length}</small></h2>
            {rows.map((item) => (
              <button type="button" className="m-ledger-card" key={item.id} onClick={() => open(item)}>
                <span className="m-meta">{item.owner} · {item.kind}</span>
                <strong>{item.title}</strong>
                <span>{item.nextStep ?? item.waitingOn ?? item.detail ?? statusLabel(item.status)}</span>
              </button>
            ))}
            {rows.length === 0 ? <p className="m-empty-row">本组为空</p> : null}
          </section>
        );
      })}
    </div>
  );
}

function colorForState(state: LaneState): AttentionItem["color"] {
  return ({ needsYou: "orange", running: "green", queued: "gray", settled: "gray" } as const)[state];
}

function statusLabel(status: MobileObligation["status"]): string {
  return ({ open: "排队", in_progress: "进行中", waiting: "等待", deferred: "搁置", blocked: "需要你", resolved: "已收尾", superseded: "已被替代" } as const)[status];
}
