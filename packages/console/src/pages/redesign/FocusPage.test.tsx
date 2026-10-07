import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FocusPage } from "./FocusPage";
import { focusPageActive } from "./FocusPage.fixture";
import { makeTask, makeObligation } from "../../components/redesign/fixtureBase";

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


describe("FocusPage 主线与支线的只读完整性", () => {
  const cases = [
    { name: "仅主线", lanes: [], main: true, branch: false },
    { name: "主支混合", lanes: [{ id: "lan_branch", title: "具名支线" }], main: true, branch: true },
    { name: "仅支线", lanes: [{ id: "lan_branch", title: "具名支线" }], main: false, branch: true },
    { name: "真实空", lanes: [], main: false, branch: false },
    { name: "已收支线与主线并存", lanes: [{ id: "lan_branch", title: "具名支线", retired: true }], main: true, branch: true }
  ];
  for (const c of cases) {
    it(c.name + "不丢未归支线的任务与义务", () => {
      const obligations = [
        ...(c.main ? [makeObligation({ id: "ob_main", title: "主线真实义务", laneId: undefined })] : []),
        ...(c.branch ? [makeObligation({ id: "ob_branch", title: "支线真实义务", laneId: "lan_branch" })] : [])
      ];
      const focusTasks = [
        ...(c.main ? [{ id: "tsk_main", title: "主线真实任务", status: "queued", laneId: null }] : []),
        ...(c.branch ? [{ id: "tsk_branch", title: "支线真实任务", status: "queued", laneId: "lan_branch" }] : [])
      ];
      const view = { ...focusPageActive, lanes: c.lanes, focusTasks, rail: { ...focusPageActive.rail, obligations } };
      const html = renderToStaticMarkup(<FocusPage view={view} initialTab="lanes" />);
      expect(html).toContain('data-focus-lane="__main__"');
      expect(html.includes('data-focus-lane-ob="ob_main"')).toBe(c.main);
      expect(html.includes('data-focus-lane-task="tsk_main"')).toBe(c.main);
      expect(html.includes('data-focus-lane-ob="ob_branch"')).toBe(c.branch);
      expect(html.includes('data-focus-lane-task="tsk_branch"')).toBe(c.branch);
      if (c.lanes.some((lane) => "retired" in lane)) expect(html).toContain("具名支线(已收)");
      if (!c.main && !c.branch) expect(html).toContain("这条线还没有挂任务或义务");
    });
  }
});
