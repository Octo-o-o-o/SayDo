// 浏览器真实Focus生产hook与TaskCard；固定HTTP读口语料，不代Provider/native验收。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
const runtime = JSON.parse(readFileSync(join(import.meta.dirname, ".runtime.json"), "utf8")) as { token: string };
const FOC = "foc_cost_browser", TSK = "tsk_cost_browser";
for (const unavailable of [false, true]) {
  test(`Focus成本${unavailable ? "详情失败保未知" : "成功详情真实传递"}`, async ({ page }, info) => {
    let taskReads = 0;
    const focus = { id: FOC, title: "成本来源回归", lifecycle: "active", currentRevision: 1 };
    await page.route("**/api/focuses**", async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/focuses") return route.fulfill({ json: [focus] });
      if (path === `/api/focuses/${FOC}`) return route.fulfill({ json: { focus, tasks: [{ id: TSK, title: "成本任务", status: "running" }], obligations: [], lanes: [], events: [], repos: [], artifacts: [], packages: [] } });
      if (path === `/api/focuses/${FOC}/timeline`) return route.fulfill({ json: { items: [], nextCursor: null } });
      if (path === `/api/focuses/${FOC}/sessions`) return route.fulfill({ json: { sessions: [] } });
      await route.continue();
    });
    await page.route("**/api/attention", route => route.fulfill({ json: { items: [] } }));
    await page.route(`**/api/tasks/${TSK}`, route => {
      taskReads++;
      if (unavailable) return route.fulfill({ status: 500, json: { code: "server_error", message: "详情不可用" } });
      return route.fulfill({ json: { task: { id: TSK, title: "成本任务", status: "running", elapsedActiveMs: 0 }, package: null, runs: [], costs: [
        { source: "api", known: 1, amount: 0, currency: "USD" },
        { source: "api", known: 1, amount: 3, currency: "CNY" },
        { source: "api", known: 0, amount: null },
        { source: "subscription", known: 0, meta_json: JSON.stringify({ provenance: "subscription", requests: 4 }) },
        { source: "subscription", known: 0, meta_json: JSON.stringify({ provenance: "external_api", requests: 9 }) }
      ] } });
    });
    await page.addInitScript(() => localStorage.setItem("saydo.setup.peeked", "1"));
    await page.goto(`/?token=${runtime.token}#/focus/${FOC}`);
    const card = page.locator(`[data-task-card="${TSK}"]`);
    await expect(card).toBeVisible(); expect(taskReads).toBeGreaterThan(0);
    if (unavailable) {
      await expect(card).toContainText("任务详情未加载"); await expect(card).not.toContainText("已用 4 次");
    } else {
      await expect(card).toContainText("0.00 USD + 3.00 元");
      await expect(card).toContainText("1 笔还没有确切数字");
      await expect(card).toContainText("订阅额度内(已用 4 次)");
      await expect(card).toContainText("SayDo 不代付");
      await expect(card).not.toContainText("已用 13 次");
    }
    await page.screenshot({ path: info.outputPath("focus-costs.png"), fullPage: true });
  });
}
