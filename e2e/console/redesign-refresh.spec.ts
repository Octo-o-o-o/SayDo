// VIEW-01 定向用例:redesign 看板的局部失败与失效刷新(与 console.spec.ts 共用 global-setup 起的 daemon)。
// ① 某 Focus detail 5xx:该事仍在板上(组数不减)+ 占位错误 + 重试后恢复;
// ② 回前台(visibilitychange → visible)触发一次重取(以该 Focus 的 detail 请求计数,侧栏不拉 detail 故不串扰)。

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const ROOT = join(import.meta.dirname, "..", "..");
const FOC = "foc_01F1XT0RE0F0CVS00000000001";
const BOARD_LIFECYCLES = new Set(["active", "captured", "dormant"]);

const runtime = JSON.parse(readFileSync(join(ROOT, "e2e", "console", ".runtime.json"), "utf8")) as { token: string };
const token = runtime.token;

async function open(page: Page, hash: string): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("saydo.setup.peeked", "1"));
  await page.goto(`/?token=${token}#${hash}`);
  await page.waitForLoadState("networkidle");
}

async function boardFocusIds(page: Page): Promise<string[]> {
  const res = await page.request.get("/api/focuses", { headers: { "x-saydo-token": token } });
  expect(res.ok()).toBe(true);
  const rows = (await res.json()) as { id: string; lifecycle: string }[];
  return rows.filter((r) => BOARD_LIFECYCLES.has(r.lifecycle)).map((r) => r.id);
}

test("VIEW-01 看板:某 Focus detail 5xx 时该事仍在板上,占位错误可重试", async ({ page }) => {
  test.setTimeout(60_000);
  const ids = await boardFocusIds(page);
  expect(ids).toContain(FOC);

  const detailUrl = `**/api/focuses/${FOC}`;
  await page.route(detailUrl, (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, code: "server_error", message: "测试注入的 500", retryable: false })
    })
  );
  await open(page, "/board");
  await expect(page.locator("[data-page=redesign-board]")).toBeVisible({ timeout: 10_000 });
  // 组数 = 列表里可上板的 Focus 数:detail 失败的那件没有凭空消失
  await expect(page.locator("[data-board-lane-group]")).toHaveCount(ids.length);
  await expect(page.locator(`[data-board-lane-group="${FOC}"]`)).toBeVisible();
  const placeholder = page.locator(`[data-board-detail-error="${FOC}"]`);
  await expect(placeholder).toBeVisible({ timeout: 15_000 }); // apiGet 对 5xx 会退避重试两次
  await expect(placeholder).toContainText("测试注入的 500");

  // 解除注入后点「重试」:占位消失,该组仍在
  await page.unroute(detailUrl);
  await page.locator(`[data-board-detail-retry="${FOC}"]`).click();
  await expect(placeholder).toHaveCount(0, { timeout: 10_000 });
  await expect(page.locator(`[data-board-lane-group="${FOC}"]`)).toBeVisible();
  await expect(page.locator("[data-board-lane-group]")).toHaveCount(ids.length);
});

test("VIEW-01 看板:回前台触发一次重取", async ({ page }) => {
  await open(page, "/board");
  await expect(page.locator(`[data-board-lane-group="${FOC}"]`)).toBeVisible({ timeout: 10_000 });

  let detailRequests = 0;
  page.on("request", (req) => {
    if (new URL(req.url()).pathname === `/api/focuses/${FOC}`) detailRequests += 1;
  });
  await page.waitForTimeout(500);
  const before = detailRequests;

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  // 至少一次重取;WS 若恰在此刻重连会再合并一次补拉,故不断言精确等于 1(精确计数在单测覆盖)
  await expect.poll(() => detailRequests, { timeout: 5_000 }).toBeGreaterThanOrEqual(before + 1);
  await expect(page.locator(`[data-board-lane-group="${FOC}"]`)).toBeVisible();
});

test("VIEW-01 看板:占位「重试」只重拉该 Focus 的 detail,不重拉列表与 attention", async ({ page }) => {
  test.setTimeout(60_000);
  const detailUrl = `**/api/focuses/${FOC}`;
  await page.route(detailUrl, (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, code: "server_error", message: "测试注入的 500", retryable: false })
    })
  );
  await open(page, "/board");
  const placeholder = page.locator(`[data-board-detail-error="${FOC}"]`);
  await expect(placeholder).toBeVisible({ timeout: 15_000 });

  const counts = { list: 0, attention: 0, detail: 0 };
  page.on("request", (req) => {
    const p = new URL(req.url()).pathname;
    if (p === "/api/focuses") counts.list += 1;
    else if (p === "/api/attention") counts.attention += 1;
    else if (p === `/api/focuses/${FOC}`) counts.detail += 1;
  });
  await page.unroute(detailUrl);
  const before = { ...counts };
  await page.locator(`[data-board-detail-retry="${FOC}"]`).click();
  await expect(placeholder).toHaveCount(0, { timeout: 10_000 });
  // 定向重试:只多了该 detail 的请求;列表/attention 计数不变(GAP-02 残项 2.2)
  expect(counts.detail).toBeGreaterThanOrEqual(before.detail + 1);
  expect(counts.list).toBe(before.list);
  expect(counts.attention).toBe(before.attention);
  await expect(page.locator(`[data-board-lane-group="${FOC}"]`)).toBeVisible();
});
