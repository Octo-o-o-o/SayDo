// DAILY-01:移动端只读账页——安排(跨事义务三组)与归档(已归档的事)。
// 结构编辑/收尾/推迟/恢复都归桌面;这里只看账 + 引导。

import { MobileHeader, MobileNotice } from "../MobileChrome";
import type { FocusDetailPayload } from "../types";

interface ObligationListRow {
  id: string;
  focusId: string;
  focusTitle: string;
  owner: string;
  status: string;
  kind: string;
  title: string;
  waitingOnTaskId: string | null;
  waitingOnObligationId: string | null;
  preObligationTitle: string | null;
  preTaskTitle: string | null;
  waitingTaskCondition: string | null;
  deferReason: string | null;
  dueOrTrigger: string | null;
  blocking: number;
}

const GROUPS: Array<{ owner: string; label: string }> = [
  { owner: "human", label: "等你" },
  { owner: "agent", label: "我在做" },
  { owner: "external", label: "等外部" }
];

const STATUS_LABEL: Record<string, string> = {
  open: "排队", in_progress: "进行中", waiting: "等待", deferred: "搁置",
  blocked: "需要你", resolved: "已收尾", superseded: "已被替代"
};

function waitingText(o: ObligationListRow): string | null {
  if (o.waitingOnTaskId) {
    return `等任务「${o.preTaskTitle ?? o.waitingOnTaskId}」${o.waitingTaskCondition === "delivered" ? "已交付" : "验收通过"}`;
  }
  if (o.waitingOnObligationId) return `等「${o.preObligationTitle ?? o.waitingOnObligationId}」`;
  return null;
}

export function MobileArrangementsPage({ rows, error }: { rows: ObligationListRow[] | null; error: string | null }) {
  if (error) return <><MobileHeader title="安排" crumb="读取失败" back="/m/things" /><MobileNotice tone="error">{error}</MobileNotice></>;
  if (!rows) return <><MobileHeader title="安排" crumb="正在翻账" back="/m/things" /><MobileNotice>正在读取安排</MobileNotice></>;
  const open = rows.filter((r) => !["resolved", "superseded"].includes(r.status));
  return (
    <div data-mobile-page="arrangements">
      <MobileHeader title="安排" crumb="跨事义务 · 只读" back="/m/things" />
      {GROUPS.map((g) => {
        const items = open.filter((r) => r.owner === g.owner);
        return (
          <section className="m-section" key={g.owner} data-m-arr={g.owner}>
            <h2>{g.label} <small>{items.length}</small></h2>
            {items.length === 0 ? <p className="m-empty-row">本组为空</p> : null}
            {items.map((o) => (
              <div className="m-ledger-card" key={o.id} data-m-arr-row={o.id}>
                <span className="m-meta">
                  <a href={`#/m/focus/${encodeURIComponent(o.focusId)}`} style={{ color: "inherit" }}>{o.focusTitle}</a>
                  {" · "}{STATUS_LABEL[o.status] ?? o.status}{o.blocking ? " · 挡路" : ""}
                </span>
                <strong>{o.title}</strong>
                <span>
                  {waitingText(o) ?? ""}
                  {o.deferReason ? `搁置:${o.deferReason}` : ""}
                  {o.dueOrTrigger ? ` 唤起:${o.dueOrTrigger}` : ""}
                </span>
              </div>
            ))}
          </section>
        );
      })}
      <p className="m-empty-row">收尾、推迟、改依赖在桌面「安排」页操作。</p>
    </div>
  );
}

interface FocusRowLite {
  id: string;
  title: string;
  lifecycle: string;
  currentRevision: number;
  updatedAt: string;
}

export function MobileArchivePage({ rows, error }: { rows: FocusRowLite[] | null; error: string | null }) {
  if (error) return <><MobileHeader title="归档" crumb="读取失败" back="/m/things" /><MobileNotice tone="error">{error}</MobileNotice></>;
  if (!rows) return <><MobileHeader title="归档" crumb="正在翻账" back="/m/things" /><MobileNotice>正在读取归档</MobileNotice></>;
  const archived = rows.filter((f) => ["archived", "closed", "abandoned"].includes(f.lifecycle));
  return (
    <div data-mobile-page="archive">
      <MobileHeader title="归档" crumb="已收起来的事 · 只读" back="/m/things" />
      <section className="m-section" data-m-archive>
        {archived.length === 0 ? <p className="m-empty-row">还没有归档的事</p> : null}
        {archived.map((f) => (
          <a className="m-ledger-card" href={`#/m/focus/${encodeURIComponent(f.id)}`} key={f.id} data-m-archive-row={f.id} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
            <span className="m-meta">{f.lifecycle} · r{f.currentRevision}</span>
            <strong>{f.title}</strong>
            <span>{f.updatedAt?.slice(0, 10)}</span>
          </a>
        ))}
      </section>
      <p className="m-empty-row">恢复活跃在桌面「归档」页;恢复不自动续跑。</p>
    </div>
  );
}

export type { FocusDetailPayload };
