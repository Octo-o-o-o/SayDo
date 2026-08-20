import { MobileHeader, MobileNotice } from "../MobileChrome";
import type { FocusRow } from "../types";

const STATES = [
  ["queued", "队列"],
  ["running", "进行中"],
  ["needsYou", "需要你"],
  ["settled", "已收尾"]
] as const;

export function MobileThingsPage({ rows, error }: { rows: FocusRow[] | null; error: string | null }) {
  return (
    <div data-mobile-page="things">
      <MobileHeader title="事" crumb="Focus · 逐层翻账" back="/m" />
      {error ? <MobileNotice tone="error">Focus 读取失败：{error}</MobileNotice> : null}
      {rows === null ? <MobileNotice>正在翻 Focus 账</MobileNotice> : null}
      {rows?.length === 0 ? <MobileNotice>还没有持续关注的事，可以先去开口聊。</MobileNotice> : null}
      <div className="m-focus-list">
        {rows?.map((focus) => (
          <a className="m-focus-card" href={`#/m/focus/${encodeURIComponent(focus.id)}`} key={focus.id}>
            <div className="m-focus-head">
              <span className="m-monogram">{focus.title.slice(0, 1)}</span>
              <div><strong>{focus.title}</strong><small>{focus.direction ?? lifecycleLabel(focus.lifecycle)}</small></div>
              {focus.fourState.needsYou > 0 ? <em>球在你这 {focus.fourState.needsYou}</em> : null}
            </div>
            <div className="m-four-grid">
              {STATES.map(([key, label]) => (
                <span className={`m-state-${key}`} key={key}><b>{focus.fourState[key]}</b><small>{label}</small></span>
              ))}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function lifecycleLabel(value: string): string {
  return ({ active: "持续中", captured: "刚立账", dormant: "睡眠等外部", closed: "已收官" } as Record<string, string>)[value] ?? value;
}
