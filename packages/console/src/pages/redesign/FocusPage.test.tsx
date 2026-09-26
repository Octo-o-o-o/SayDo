import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FocusPage } from "./FocusPage";
import { focusPageActive } from "./FocusPage.fixture";
import { makeTask } from "../../components/redesign/fixtureBase";

describe("FocusPage 安排可达性", () => {
  it("桌面上下文页签安排带打开标签与真实 id", () => {
    const html = renderToStaticMarkup(<FocusPage view={focusPageActive} initialTab="context" onAction={() => {}} />);
    expect(html).toContain('data-rail-item="obligation"');
    expect(html).toContain('data-rail-id="ob1"');
    expect(html).toContain("打开安排:demo 看完,拍板是否应用到 console");
    expect(html).toContain("data-mobile-obligation");
  });

  it("窄屏摘要条可点开安排,时间线缺引用不伪造", () => {
    const onAction = vi.fn();
    const html = renderToStaticMarkup(
      <div className="rdp-force-narrow">
        <FocusPage view={focusPageActive} onAction={onAction} />
      </div>
    );
    expect(html).toContain('data-mobile-obligation="ob1"');
    expect(html).toContain("data-missing-ref=\"tsk_missing\"");
  });

  it("时间线未引用的任务与无任务 pending 包仍渲染为工作卡", () => {
    const view = {
      ...focusPageActive,
      timeline: focusPageActive.timeline.filter((i) => i.kind !== "pkg" && i.kind !== "task"),
      rail: {
        ...focusPageActive.rail,
        tasks: [makeTask({ id: "tsk_work", title: "未进时间线的任务", viewStatus: "queued" })]
      },
      lookups: {
        ...focusPageActive.lookups,
        packages: {
          pkg_pending: {
            id: "pkg_pending",
            revision: 4,
            status: "proposed" as const,
            outcomePreview: "无任务待批包",
            inScope: [],
            outOfScope: [],
            acceptance: [],
            plan: [],
            cost: { max: 0, currency: "CNY" as const },
            risks: [],
            preauthorizedEffects: []
          }
        }
      }
    };
    const html = renderToStaticMarkup(<FocusPage view={view} onAction={() => {}} />);
    expect(html).toContain("data-focus-work-surface");
    expect(html).toContain('data-focus-work-task="tsk_work"');
    expect(html).toContain('data-focus-work-pkg="pkg_pending"');
    expect(html).toContain('data-focus-work-pkg-rev="4"');
  });

  it("多条会话段各自带展开,不互斥", () => {
    const view = {
      ...focusPageActive,
      timeline: [
        { seq: 1, ts: "t1", kind: "session_segment" as const, sessionRef: "ses_a", turnCount: 2, startTs: "10:00", endTs: "10:10", transcriptAvailable: true },
        { seq: 2, ts: "t2", kind: "session_segment" as const, sessionRef: "ses_b", turnCount: 3, startTs: "11:00", endTs: "11:10", transcriptAvailable: true }
      ]
    };
    const html = renderToStaticMarkup(<FocusPage view={view} onExpandSegment={async () => []} />);
    expect(html.match(/data-session-segment/g)).toHaveLength(2);
    expect(html.match(/展开转写/g)).toHaveLength(2);
  });

  it("initialTab 深链变化会切页签", () => {
    const first = renderToStaticMarkup(<FocusPage view={focusPageActive} initialTab="convo" />);
    expect(first).toContain('data-focus-tab="convo"');
    const second = renderToStaticMarkup(<FocusPage view={focusPageActive} initialTab="context" />);
    expect(second).toContain('data-focus-tab-btn="context"');
  });
});
