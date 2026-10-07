import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TaskCard } from "../../components/redesign/TaskCard";
import { ReviewPanel } from "../../components/redesign/ReviewPanel";
import { mapReviewContext, mapTaskRowToView, mapTaskViewFromDetail } from "./mappers";
import type { ReviewTaskContext } from "../../components/redesign/types";

const base = { id: "tsk_elapsed", title: "真实任务", status: "ready_for_review", attempt: 1,
  created_at: "2020-01-01T00:00:00Z", updated_at: "2020-01-02T00:00:00Z" };
function review(task: ReviewTaskContext["task"]): ReviewTaskContext {
  return { task, taskStatus: "ready_for_review", packageRefText: "无决策包 digest", acceptance: [], decisions: [], runs: [] };
}
function renderBoth(raw: Record<string, unknown>) {
  const task = mapTaskViewFromDetail(raw, "foc_elapsed");
  return [renderToStaticMarkup(<TaskCard task={task} />), renderToStaticMarkup(<ReviewPanel ctx={review(task)} />)];
}

describe("任务活跃计时的生产投影", () => {
  it.each([undefined, null, "120000", -1, NaN, Infinity, -Infinity, 0.5, 120000.5, Number.MAX_SAFE_INTEGER + 1, Number.MAX_VALUE, {}, true])("缺失或非法计时 %j 不借日期或零冒充", (elapsedActiveMs) => {
    const raw = { ...base, elapsedActiveMs };
    expect(mapTaskViewFromDetail(raw, "foc_elapsed").elapsedMin).toBeNull();
    expect(mapTaskRowToView({ ...base, elapsedActiveMs }, "foc_elapsed").elapsedMin).toBeNull();
    for (const html of renderBoth(raw)) {
      expect(html).toContain("执行耗时未知");
      expect(html).not.toContain("已跑 0 分钟");
      expect(html).not.toMatch(/已跑 \d+ 分钟/);
      expect(html).not.toContain("NaN"); expect(html).not.toContain("Infinity");
    }
  });
  it.each([[0, 0], [120000, 2], [150000, 3]])("合法活跃毫秒 %i 在两组件与row保持 %i 分钟", (elapsedActiveMs, minutes) => {
    const raw = { ...base, elapsedActiveMs };
    expect(mapTaskViewFromDetail(raw, "foc_elapsed").elapsedMin).toBe(minutes);
    expect(mapTaskRowToView({ ...base, elapsedActiveMs }, "foc_elapsed").elapsedMin).toBe(minutes);
    for (const html of renderBoth(raw)) {
      expect(html).toContain(`已跑 ${minutes} 分钟`);
      expect(html).not.toContain("执行耗时未知");
    }
  });
  it("实际详情形状没有活跃字段时，验收mapper保留未知，不从runs或时间戳拼计时", () => {
    const ctx = mapReviewContext({ task: base, package: null,
      runs: [{ attempt: 1, state: "settled_review", started_at: "2020-01-01", settled_at: "2020-01-02" }] }, "foc_elapsed");
    expect(ctx.task.elapsedMin).toBeNull();
    expect(renderToStaticMarkup(<ReviewPanel ctx={ctx} />)).toContain("执行耗时未知");
  });
  it("停靠和等待状态不会因墙钟推进增大已核活跃耗时", () => {
    for (const status of ["blocked", "paused_step_boundary", "ready_for_review"]) {
      const task = mapTaskViewFromDetail({ ...base, status, elapsedActiveMs: 120000 }, "foc_elapsed");
      expect(task.elapsedMin).toBe(2);
    }
  });
});
