import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReviewPanel } from "./ReviewPanel";
import type { ReviewTaskContext } from "./types";

const treeSha = "a".repeat(40);

function ctx(evidence: ReviewTaskContext["acceptance"][number]["evidence"]): ReviewTaskContext {
  return {
    task: {
      id: "tsk_1",
      focusId: "foc_1",
      title: "验收",
      route: "tier1",
      viewStatus: "ready_for_review",
      attempt: 1,
      riskLevel: "S1",
      elapsedMin: 1,
      budget: { walltimeActiveMin: 0, maxTurns: 0, maxCost: 20 },
      spent: { known: false },
      lastEvent: "ready_for_review"
    },
    packageRefText: "digest test",
    acceptance: [
      {
        criterion: "安装一节出现 pnpm install 示例",
        status: "unknown",
        source: "manual",
        ...(evidence ? { evidence } : {})
      }
    ],
    decisions: [],
    runs: [{ attempt: 1, result: "settled_review" }]
  };
}

describe("ReviewPanel 证据", () => {
  it("展示可读正文与任务详情链,不写有证据", () => {
    const html = renderToStaticMarkup(
      <ReviewPanel
        ctx={ctx({
          kind: "log",
          body: "[ok] npm install retained\nnpm install\n[ok] pnpm install present\npnpm install\n",
          href: "#/p/prj_1/task/tsk_1",
          hrefLabel: "在任务详情核对这棵树与结算证明",
          treeSha,
          runId: "run_1"
        })}
      />
    );
    expect(html).toContain("data-review-evidence");
    expect(html).toContain("[ok] npm install retained");
    expect(html).toContain("[ok] pnpm install present");
    expect(html).toContain(`data-review-tree-sha="${treeSha}"`);
    expect(html).not.toContain("验收项:");
    expect(html).not.toContain("本轮 run");
    expect(html).toContain("data-review-evidence-link");
    expect(html).toContain("#/p/prj_1/task/tsk_1");
    expect(html).not.toContain("有证据");
    expect(html).not.toContain("没有绑上证据");
  });

  it("已绑定但失效的人工项禁用通过;没有引用的人工项仍可判断", () => {
    const blocked = ctx(undefined);
    blocked.acceptance = [{ ...blocked.acceptance[0]!, evidenceBlock: "bound_invalid" }];
    const html = renderToStaticMarkup(<ReviewPanel ctx={blocked} />);
    expect(html).toContain("data-review-approve-blocked=\"1\"");
    expect(html).toContain("data-acceptance-evidence=\"bound_invalid\"");
    expect(html).toContain("引用对不上");
    expect(html).toContain("disabled=\"\"");
    expect(html).not.toContain("没有绑上证据");
    const open = renderToStaticMarkup(<ReviewPanel ctx={ctx(undefined)} />);
    expect(open).toContain("data-review-approve-blocked=\"0\"");
    expect(open).toContain("没有绑上证据");
    expect(open).not.toContain("disabled=\"\"");
  });

  it("无证据时诚实标注,不编造正文", () => {
    const html = renderToStaticMarkup(<ReviewPanel ctx={ctx(undefined)} />);
    expect(html).toContain("没有绑上证据");
    expect(html).not.toContain("data-review-evidence=");
    expect(html).toContain("data-review-items-pass=\"0\"");
    expect(html).toContain("data-acceptance-status=\"unknown\"");
  });

  it("fail 项不得声称 pass", () => {
    const failed: ReviewTaskContext = {
      ...ctx(undefined),
      acceptance: [{ criterion: "现有 npm 说明保留", status: "fail", source: "verify" }]
    };
    const html = renderToStaticMarkup(<ReviewPanel ctx={failed} />);
    expect(html).toContain("data-acceptance-status=\"fail\"");
    expect(html).toContain("data-review-items-pass=\"0\"");
    expect(html).toContain("验证没过,这些验收项不能当成通过。");
    expect(html).toContain("disabled=\"\"");
    expect(html).not.toContain("data-acceptance-status=\"pass\"");
  });
});

for (const status of ["failed", "running", "cancel_settled"] as const) {
  it(`${status} 任务的 unknown 项不能放开通过按钮`, () => {
    const value = ctx(undefined);
    value.task.viewStatus = status;
    const html = renderToStaticMarkup(<ReviewPanel ctx={value} />);
    expect(html).toContain('data-review-approve-blocked="1"');
    expect(html).toContain('data-acceptance-status="unknown"');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain("执行和检查都跑完了");
  });
}

it.each([["ready_for_review", "0"], ["failed", "1"]])("parked 呈现态按底层 %s 判断验收", (status, blocked) => {
  const value = ctx(undefined);
  value.task.viewStatus = "parked";
  value.taskStatus = status;
  expect(renderToStaticMarkup(<ReviewPanel ctx={value} />)).toContain(`data-review-approve-blocked="${blocked}"`);
});
