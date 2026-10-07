import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskCard } from "../../components/redesign/TaskCard";
import { RiskBadge } from "../../components/StatusChip";
import { buildFocusWorkLookups } from "./focusWorkLookups";
import { mapTaskRowToView, mapTaskViewFromDetail, type FocusDetailPayload } from "./mappers";

const task = { id: "tsk_risk", title: "真实任务", status: "running", viewStatus: "running", attempt: 1 };
function render(raw: Record<string, unknown>) {
  return renderToStaticMarkup(<TaskCard task={mapTaskViewFromDetail(raw, "foc_risk")} />);
}
describe("任务风险读口诚实展示", () => {
  it.each([undefined, null, "", "S9", 1, { risk: "S1" }])("缺失/null/非法等级 %j 不冒充 S1", (risk) => {
    const raw = risk === undefined ? task : { ...task, risk };
    expect(mapTaskViewFromDetail(raw, "foc_risk").riskLevel).toBeNull();
    const html = render(raw);
    expect(html).toContain("风险等级未知");
    expect(html).not.toMatch(/>S[0-3]</);
  });
  it.each(["S0", "S1", "S2", "S3"])("明确合法读口 %s 保留", (risk) => {
    for (const raw of [{ ...task, risk }, { ...task, riskLevel: risk }]) {
      expect(mapTaskViewFromDetail(raw, "foc_risk").riskLevel).toBe(risk);
      expect(render(raw)).toContain(`>${risk}<`);
    }
  });
  it("绑定 row 没有风险不降级，合法 row 读口不丢", () => {
    expect(mapTaskRowToView(task, "foc_risk").riskLevel).toBeNull();
    expect(mapTaskRowToView({ ...task, riskLevel: "S2" }, "foc_risk").riskLevel).toBe("S2");
  });
  it("Focus 正常详情未知风险与缺详情早退都保留真实绑定", () => {
    const focus: FocusDetailPayload = { focus: { id: "foc_risk", title: "工作", lifecycle: "active", currentRevision: 1, direction: null }, tasks: [task], packages: [], obligations: [], lanes: [], events: [], repos: [], artifacts: [] };
    const complete = buildFocusWorkLookups({ focusId: "foc_risk", detail: focus, taskDetails: [{ task, package: null, runs: [] }], attention: [], sessionOwned: false });
    expect(complete.tasks).toHaveLength(1);
    expect(renderToStaticMarkup(<TaskCard task={complete.tasks[0]!} />)).toContain("风险等级未知");
    const missing = buildFocusWorkLookups({ focusId: "foc_risk", detail: focus, taskDetails: [null], attention: [], sessionOwned: false });
    const html = renderToStaticMarkup(<TaskCard task={missing.tasks[0]!} />);
    expect(html).toContain("任务详情未加载");
    expect(html).not.toContain("风险等级未知");
    expect(html).not.toContain("用本机认证批准合并");
  });
  it("直接徽章非法值仍为未知，合法 S3 的认证按钮独立保留", () => {
    expect(renderToStaticMarkup(<RiskBadge risk="invalid" />)).toContain("风险等级未知");
    const html = render({ ...task, status: "review_approved_waiting_merge", viewStatus: "review_approved_waiting_merge" });
    expect(html).toContain("风险等级未知");
    expect(html).toContain("用本机认证批准合并");
    expect(html).toContain("S3 不可逆");
  });
});
