// 真实入口补齐:Focus 安排/期待、pendingAnchor 续接、Records 线标题、TaskModal 状态边界、桌面/窄屏可达性。
// 与 console.spec.ts / redesign-refresh.spec.ts 共用 global-setup daemon(47188)。本文件不单独起服务。

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page, type Route, type WebSocket } from "@playwright/test";

const ROOT = join(import.meta.dirname, "..", "..");
const SHOT = join(
  process.env.HOME ?? "",
  ".codex",
  "tasks",
  "saydo-handoff-20260912",
  "evidence",
  "repair11-browser"
);
const FOC = "foc_01F1XT0RE0F0CVS00000000001";
const FOB = "fob_01F1XT0RE0F0CVS00000000001";
const PRJ = "prj_01F1XT0RE0A000000000000000";
const TSK_READY = "tsk_01F1XT0RE0TSKRDE0000000001";
const TSK_RUN = "tsk_01F1XT0RE0TSKRVN0000000000";
const TSK_DONE = "tsk_01F1XT0RE0TSKD0N0000000000";

const runtime = JSON.parse(readFileSync(join(ROOT, "e2e", "console", ".runtime.json"), "utf8")) as { token: string };
const token = runtime.token;

test.beforeAll(() => {
  mkdirSync(SHOT, { recursive: true });
});

test.afterEach(async ({ page }) => {
  await page.goto("about:blank").catch(() => undefined);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

async function open(page: Page, hash: string): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("saydo.setup.peeked", "1"));
  await page.goto(`/?token=${token}#${hash}`);
  await page.waitForLoadState("networkidle");
}

function seedPending(page: Page, payload: { focusId: string; title?: string; laneTitle?: string; draft?: string }): Promise<void> {
  return page.addInitScript((raw) => {
    sessionStorage.setItem("saydo.chat.pendingAnchor", raw);
  }, JSON.stringify(payload));
}

function attachAnchorTrace(page: Page, label: string): () => void {
  const events: Array<Record<string, unknown>> = [];
  const note = (row: Record<string, unknown>) => {
    events.push({ at: Date.now(), ...row });
  };
  const watch = (ws: WebSocket) => {
    ws.on("framesent", (frame) => {
      const payload = String(frame.payload);
      if (/hello|anchor|voice\.|turn\.text|peerId|daemonEpoch/.test(payload)) {
        note({ dir: "ws-out", payload: payload.slice(0, 800) });
      }
    });
    ws.on("framereceived", (frame) => {
      const payload = String(frame.payload);
      if (/hello|anchor|voice\.|turn\.text|peerId|daemonEpoch/.test(payload)) {
        note({ dir: "ws-in", payload: payload.slice(0, 800) });
      }
    });
  };
  page.on("websocket", watch);
  page.on("request", (req) => {
    if (req.method() === "POST" && req.url().includes("/focus-anchor")) {
      note({ dir: "http-out", url: new URL(req.url()).pathname, body: req.postDataJSON() });
    }
  });
  page.on("response", (res) => {
    if (res.request().method() === "POST" && res.url().includes("/focus-anchor")) {
      note({ dir: "http-in", status: res.status(), url: new URL(res.url()).pathname });
    }
  });
  return () => {
    writeFileSync(join(SHOT, `${label}-ws-http.json`), `${JSON.stringify(events, null, 2)}\n`);
  };
}

async function waitAnchorReady(page: Page): Promise<void> {
  await expect(page.locator("[data-anchor-phase]")).toHaveAttribute("data-anchor-phase", "ready", { timeout: 15_000 });
}

test("Focus 安排打开真实 TaskModal;缺失节点不空滚", async ({ page }) => {
  test.setTimeout(60_000);
  const focusRes = await page.request.get(`/api/focuses/${FOC}`, { headers: { "x-saydo-token": token } });
  expect(focusRes.ok()).toBe(true);
  const focusJson = (await focusRes.json()) as { artifacts?: Array<Record<string, unknown>> };
  focusJson.artifacts = [
    ...(focusJson.artifacts ?? []),
    { id: "art_ghost_locate", kind: "file", role: "reference", title: "没有时间线锚点的产物" }
  ];
  await page.route(`**/api/focuses/${FOC}`, async (route: Route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", json: focusJson });
  });

  await open(page, `/focus/${FOC}`);
  await expect(page.locator("[data-page=redesign-focus]")).toBeVisible({ timeout: 10_000 });
  // DAILY-01:右栏改按需页签;安排/产物在「上下文」页签
  await page.locator("[data-focus-tab-btn=context]").click();
  const railOb = page.locator(`[data-rail-item=obligation][data-rail-id="${FOB}"]`);
  await expect(railOb).toBeVisible();
  await expect(railOb).toHaveAttribute("aria-label", "打开安排:整理观察表行");
  await railOb.click();
  const modal = page.locator("[data-component=task-modal]");
  await expect(modal).toBeVisible();
  await expect(modal).toHaveAttribute("data-task-modal-load", /ready|loading/);
  await expect(modal.getByRole("heading", { name: "整理观察表行" })).toBeVisible();
  await expect(modal).not.toHaveAttribute("data-task-modal-status", "running");
  await page.screenshot({ path: join(SHOT, "focus-obligation-modal-1440.png"), fullPage: true });
  await modal.getByRole("button", { name: "关闭" }).click();
  await expect(modal).toHaveCount(0);

  const ghost = page.locator('[data-rail-item=artifact][data-rail-id="art_ghost_locate"]');
  await expect(ghost).toBeVisible();
  await ghost.click();
  await expect(page.locator("[data-toast]")).toContainText("暂时看不到对应位置");
  await expect(page.locator('[data-locate="artifact:art_ghost_locate"]')).toHaveCount(0);
});

test("期待沟通只带 Focus 草稿进对话,不自动发送", async ({ page }) => {
  test.setTimeout(60_000);
  const posts: { path: string; body: unknown }[] = [];
  page.on("request", (req) => {
    if (req.method() !== "POST") return;
    const u = new URL(req.url());
    if (u.pathname.includes("/focus-anchor")) {
      posts.push({ path: u.pathname, body: req.postDataJSON() });
    }
  });

  await open(page, `/focus/${FOC}`);
  await expect(page.locator("[data-page=redesign-focus]")).toBeVisible({ timeout: 10_000 });
  // DAILY-01:期待组在「上下文」页签
  await page.locator("[data-focus-tab-btn=context]").click();
  await page.locator("[data-focus-expect]").click();
  await expect(page.locator("[data-page=chat]")).toBeVisible({ timeout: 10_000 });
  const input = page.locator("[data-text-input]");
  await expect(input).toHaveValue(/整理 D2 观察表素材/);
  await expect(input).toHaveValue(/我期待一个新的产物/);
  await expect(input).not.toHaveValue(/exp[_-]|expectationId/);
  await expect.poll(() => posts.length, { timeout: 8_000 }).toBeGreaterThan(0);
  expect(posts[0]?.path).toMatch(new RegExp(`/api/sessions/ses_[A-Z0-9]+/focus-anchor$`));
  expect(posts[0]?.body).toMatchObject({ focusId: FOC });
  const expectBody = posts[0]?.body as { requestId?: string };
  if (typeof expectBody.requestId === "string") {
    expect(expectBody.requestId).toMatch(/^evt_/);
  }
  expect(JSON.stringify(posts[0]?.body)).not.toContain("voicePeerId");
  await expect(page.locator("[data-transcript] [data-who=user]")).toHaveCount(0);
  await waitAnchorReady(page);
  await page.screenshot({ path: join(SHOT, "expect-draft-chat.png"), fullPage: true });
});

test("pendingAnchor 失败可重试并保留草稿;普通对话不受阻", async ({ page }) => {
  test.setTimeout(60_000);
  const flushTrace = attachAnchorTrace(page, "pending-anchor-retry");
  let failOnce = true;
  await page.route("**/api/sessions/*/focus-anchor", async (route: Route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    if (failOnce) {
      failOnce = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, code: "unavailable", message: "测试注入续接失败" })
      });
      return;
    }
    await route.continue();
  });

  const draft = "关于「整理 D2 观察表素材」:我期待一个新的产物——线下草稿";
  await seedPending(page, { focusId: FOC, title: "整理 D2 观察表素材", draft });
  await open(page, "/chat-new");
  await expect(page.locator("[data-page=chat]")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("[data-text-input]")).toHaveValue(draft);
  await expect(page.locator("[data-anchor-phase]")).toHaveAttribute("data-anchor-phase", "failed");
  await expect(page.locator("[data-text-send]")).toBeDisabled();
  await expect(page.locator("[data-transcript] [data-who=user]")).toHaveCount(0);
  await page.screenshot({ path: join(SHOT, "anchor-failed-keeps-draft.png"), fullPage: true });

  const edited = "失败期间改过的新草稿,不要回滚";
  await page.locator("[data-text-input]").fill(edited);
  await page.locator("[data-anchor-retry]").click();
  await expect(page.locator("[data-anchor-phase]")).toHaveAttribute("data-anchor-phase", "ready", { timeout: 8_000 });
  await expect(page.locator("[data-text-input]")).toHaveValue(edited);
  await expect(page.locator("[data-text-send]")).toBeEnabled();
  flushTrace();

  const offline = await page.context().newPage();
  await offline.addInitScript(() => localStorage.setItem("saydo.setup.peeked", "1"));
  await offline.addInitScript((raw) => {
    sessionStorage.setItem("saydo.chat.pendingAnchor", raw);
  }, JSON.stringify({ focusId: FOC, title: "整理 D2 观察表素材", draft: "离线草稿还在" }));
  await offline.route("**/api/sessions/*/focus-anchor", (route) => route.abort("internetdisconnected"));
  await offline.goto(`/?token=${token}#/chat-new`);
  await expect(offline.locator("[data-text-input]")).toHaveValue("离线草稿还在", { timeout: 10_000 });
  await expect(offline.locator("[data-anchor-phase]")).toHaveAttribute("data-anchor-phase", "failed");
  await expect(offline.locator("[data-text-send]")).toBeDisabled();
  await offline.close();

  const plain = await page.context().newPage();
  await plain.addInitScript(() => localStorage.setItem("saydo.setup.peeked", "1"));
  await plain.goto(`/?token=${token}#/chat-new`);
  await expect(plain.locator("[data-page=chat]")).toBeVisible({ timeout: 10_000 });
  await expect(plain.locator("[data-anchor-phase]")).toHaveCount(0);
  await plain.locator("[data-text-input]").fill("普通一句");
  await expect(plain.locator("[data-text-send]")).toBeEnabled();
  await plain.close();
});

test("免手自动断轮在主题未接上时被采集门挡住", async ({ page }) => {
  test.setTimeout(60_000);
  await page.route("**/api/sessions/*/focus-anchor", async (route: Route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, code: "unavailable", message: "测试注入续接失败" })
    });
  });
  await seedPending(page, { focusId: FOC, title: "整理 D2 观察表素材", draft: "免手应先停着" });
  await open(page, "/chat-new");
  await expect(page.locator("[data-page=chat]")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("[data-anchor-phase]")).toHaveAttribute("data-anchor-phase", "failed");
  await expect(page.locator("[data-input-region]")).toHaveAttribute("data-themed-voice-hold", "1");
  await expect(page.locator("[data-voice-mode-toggle]")).toBeDisabled();
  await expect(page.locator("[data-text-send]")).toBeDisabled();
  await page.unroute("**/api/sessions/*/focus-anchor");
  await page.locator("[data-anchor-retry]").click();
  await waitAnchorReady(page);
});

test("延迟 Focus A 切到 B 后,迟到 A 不能盖住新 focus", async ({ page }) => {
  test.setTimeout(60_000);
  const flushTrace = attachAnchorTrace(page, "delay-focus-a-to-b");
  const created = await page.request.post("/api/focuses", {
    headers: { "x-saydo-token": token, "content-type": "application/json" },
    data: { title: "主题B" }
  });
  expect(created.ok()).toBe(true);
  const createdJson = (await created.json()) as { id?: string };
  const FOC_B = createdJson.id;
  expect(FOC_B).toMatch(/^foc_/);

  const posts: Array<{ focusId?: string; requestId?: string; path: string; status: number; ok?: boolean }> = [];
  let releaseA: (() => void) | null = null;
  const gateA = new Promise<void>((resolve) => {
    releaseA = resolve;
  });
  await page.route("**/api/sessions/*/focus-anchor", async (route: Route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    const body = route.request().postDataJSON() as { focusId?: string; requestId?: string };
    const row: { focusId?: string; requestId?: string; path: string; status: number; ok?: boolean } = {
      focusId: body.focusId,
      requestId: body.requestId,
      path: new URL(route.request().url()).pathname,
      status: 0
    };
    posts.push(row);
    if (body.focusId === FOC) {
      await gateA;
    }
    const response = await route.fetch();
    const payload = (await response.json().catch(() => ({}))) as { ok?: boolean };
    row.status = response.status();
    if (typeof payload.ok === "boolean") row.ok = payload.ok;
    await route.fulfill({ response });
  });

  await seedPending(page, { focusId: FOC, title: "主题A", draft: "A草稿还在" });
  await page.addInitScript(() => localStorage.setItem("saydo.setup.peeked", "1"));
  // A 的 POST 被闸住,不能等 networkidle,否则 open() 会一直挂到超时。
  await page.goto(`/?token=${token}#/chat-new`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-page=chat]")).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => posts.length, { timeout: 8_000 }).toBeGreaterThan(0);
  await expect(page.locator("[data-text-input]")).toHaveValue("A草稿还在");
  const sessionId = posts[0]?.path.match(/\/api\/sessions\/(ses_[A-Z0-9]+)\//)?.[1];
  expect(sessionId).toBeTruthy();

  await page.evaluate((raw) => {
    sessionStorage.setItem("saydo.chat.pendingAnchor", raw);
    location.hash = "#/today";
  }, JSON.stringify({ focusId: FOC_B, title: "主题B", draft: "B续接草稿" }));
  await expect(page.locator("[data-page=today]")).toBeVisible({ timeout: 10_000 });
  await page.evaluate(() => {
    location.hash = "#/chat-new";
  });
  await expect(page.locator("[data-page=chat]")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("[data-text-input]")).toHaveValue("B续接草稿");
  // B 必须排在在途 A 之后;先等 B 进 pending 再放行 A,才能证明迟到 A 不能插到最后一笔。
  await expect(page.locator("[data-anchor-phase]")).toHaveAttribute("data-anchor-phase", "pending");
  expect(posts.some((p) => p.focusId === FOC_B)).toBe(false);

  releaseA?.();
  await expect.poll(() => posts.some((p) => p.focusId === FOC_B), { timeout: 8_000 }).toBe(true);
  await expect.poll(() => posts.at(-1)?.focusId, { timeout: 8_000 }).toBe(FOC_B);
  const lastOk = [...posts].reverse().find((p) => p.status === 200 && p.ok === true);
  expect(lastOk?.focusId).toBe(FOC_B);
  await expect(page.locator("[data-anchor-phase]")).toHaveAttribute("data-anchor-phase", "ready");
  await expect(page.locator("[data-text-input]")).toHaveValue("B续接草稿");
  await expect(page.locator("[data-text-send]")).toBeEnabled();

  const bSessions = await page.request.get(`/api/focuses/${FOC_B}/sessions`, {
    headers: { "x-saydo-token": token }
  });
  expect(bSessions.ok()).toBe(true);
  const bJson = (await bSessions.json()) as { sessions?: Array<{ id: string }> };
  expect(bJson.sessions?.some((row) => row.id === sessionId)).toBe(true);
  const aSessions = await page.request.get(`/api/focuses/${FOC}/sessions`, {
    headers: { "x-saydo-token": token }
  });
  expect(aSessions.ok()).toBe(true);
  const aJson = (await aSessions.json()) as { sessions?: Array<{ id: string }> };
  expect(aJson.sessions?.some((row) => row.id === sessionId)).toBe(false);
  flushTrace();
});

test("Records 续接用真实线标题,不用 laneId", async ({ page }) => {
  test.setTimeout(60_000);
  const flushTrace = attachAnchorTrace(page, "records-continue");
  const posts: unknown[] = [];
  page.on("request", (req) => {
    if (req.method() === "POST" && new URL(req.url()).pathname.includes("/focus-anchor")) {
      posts.push(req.postDataJSON());
    }
  });
  await open(page, `/records/${FOC}`);
  await expect(page.locator("[data-page=redesign-records]")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "主线" }).first()).toBeVisible();
  // DAILY-01:续推按钮 = 该行「在此线续推」(lane_op continue,无独立 data 钩子)
  await page
    .locator('[data-lane-expand="__main__"]')
    .locator("xpath=..")
    .getByRole("button", { name: "在此线续推" })
    .click();
  await expect(page.locator("[data-page=chat]")).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => posts.length, { timeout: 8_000 }).toBeGreaterThan(0);
  expect(posts[0]).toMatchObject({ focusId: FOC, laneTitle: "主线" });
  expect(String((posts[0] as { requestId?: string }).requestId ?? "")).toMatch(/^evt_/);
  expect(JSON.stringify(posts[0])).not.toContain("__main__");
  expect(JSON.stringify(posts[0])).not.toContain("voicePeerId");
  await waitAnchorReady(page);
  await page.screenshot({ path: join(SHOT, "records-continue-main-lane.png"), fullPage: true });
  flushTrace();
});

test("任务详情与 TaskModal 状态/动作边界;请求认嵌套 task", async ({ page }) => {
  test.setTimeout(60_000);
  const readyRes = await page.request.get(`/api/tasks/${TSK_READY}`, { headers: { "x-saydo-token": token } });
  expect(readyRes.ok()).toBe(true);
  const readyJson = (await readyRes.json()) as { task?: { id: string; status: string; title: string } };
  expect(readyJson.task).toMatchObject({
    id: TSK_READY,
    status: "ready_for_review",
    title: "隔离验收报表"
  });

  await open(page, `/p/${PRJ}/task/${TSK_RUN}`);
  await expect(page.locator("[data-page=task-detail]")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("[data-status=running]").first()).toBeVisible();
  await expect(page.locator("[data-action=cancel]")).toBeVisible();
  await expect(page.locator("[data-action=approve]")).toHaveCount(0);

  await open(page, `/p/${PRJ}/task/${TSK_DONE}`);
  await expect(page.locator("[data-page=task-detail]")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("[data-status=task_done]").first()).toBeVisible();
  await expect(page.locator("[data-action=cancel]")).toHaveCount(0);
  await expect(page.locator("[data-action=approve]")).toHaveCount(0);

  await open(page, `/p/${PRJ}/task/${TSK_READY}`);
  await expect(page.locator("[data-page=task-detail]")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("[data-status=ready_for_review]").first()).toContainText("等你验收");
  await expect(page.getByRole("button", { name: "验收通过" })).toBeVisible();
  await expect(page.locator("[data-action=cancel]")).toBeVisible();
  await expect(page.getByText("交付了")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "验收通过" })).not.toHaveAttribute("data-action", "request-manual-merge");

  // 看板生产路径不一定挂这些任务卡;今天页注入 attention 只保证入口,弹窗仍 GET 真实 /api/tasks/:id。
  const attnRes = await page.request.get("/api/attention", { headers: { "x-saydo-token": token } });
  expect(attnRes.ok()).toBe(true);
  const attnJson = (await attnRes.json()) as { items: Array<Record<string, unknown>> };
  attnJson.items = [
    ...(attnJson.items ?? []),
    {
      id: `task:${TSK_RUN}`,
      color: "green",
      title: "分页性能优化",
      focusId: FOC,
      focusTitle: "整理 D2 观察表素材",
      action: "open_task_modal",
      updatedAt: "2026-07-25T02:00:00.000Z",
      sourceKind: "task",
      refId: TSK_RUN,
      projectId: PRJ
    },
    {
      id: `task:${TSK_DONE}`,
      color: "gray",
      title: "修复日期时区显示",
      focusId: FOC,
      focusTitle: "整理 D2 观察表素材",
      action: "open_task_modal",
      updatedAt: "2026-07-25T02:00:00.000Z",
      sourceKind: "task",
      refId: TSK_DONE,
      projectId: PRJ
    }
  ];
  await page.route("**/api/attention", async (route: Route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", json: attnJson });
  });

  await open(page, "/today");
  await expect(page.locator("[data-page=today]")).toBeVisible({ timeout: 10_000 });
  await page.locator(`[data-attention-id="task:${TSK_RUN}"]`).click();
  const runModal = page.locator("[data-component=task-modal]");
  await expect(runModal).toBeVisible();
  await expect(runModal).toHaveAttribute("data-task-modal-load", /ready|loading/);
  await expect(runModal).toHaveAttribute("data-task-modal-status", "running");
  await expect(runModal.getByRole("button", { name: "叫停" })).toBeVisible();
  await expect(runModal.locator("[data-task-detail-link]")).toBeVisible();
  await page.screenshot({ path: join(SHOT, "task-modal-running.png"), fullPage: true });
  await runModal.getByRole("button", { name: "关闭" }).click();
  await expect(runModal).toHaveCount(0);

  await page.locator(`[data-attention-id="task:${TSK_DONE}"]`).click();
  const doneModal = page.locator("[data-component=task-modal]");
  await expect(doneModal).toBeVisible();
  await expect(doneModal).toHaveAttribute("data-task-modal-status", "task_done");
  await expect(doneModal.getByRole("button", { name: "叫停" })).toHaveCount(0);
  await expect(doneModal.getByText("叫停、重试或合并请到任务详情")).toBeVisible();
  await doneModal.getByRole("button", { name: "关闭" }).click();
  await expect(doneModal).toHaveCount(0);
  await page.unroute("**/api/attention");
});

test("TaskModal 关闭后迟到重试会清掉 nonce", async ({ page }) => {
  test.setTimeout(60_000);
  let failFirst = true;
  let releaseRetry: (() => void) | null = null;
  const gateRetry = new Promise<void>((resolve) => {
    releaseRetry = resolve;
  });
  const deletes: string[] = [];
  await page.route("**/api/session/*/task-context", async (route: Route) => {
    const method = route.request().method();
    if (method === "DELETE") {
      deletes.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, cleared: true })
      });
      return;
    }
    if (method !== "POST") {
      await route.continue();
      return;
    }
    if (failFirst) {
      failFirst = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, code: "unavailable", message: "测试注入上下文失败" })
      });
      return;
    }
    await gateRetry;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, nonce: "nonce_late_retry" })
    });
  });

  const attnRes = await page.request.get("/api/attention", { headers: { "x-saydo-token": token } });
  expect(attnRes.ok()).toBe(true);
  const attnJson = (await attnRes.json()) as { items: Array<Record<string, unknown>> };
  attnJson.items = [
    ...(attnJson.items ?? []),
    {
      id: `task:${TSK_RUN}`,
      color: "green",
      title: "分页性能优化",
      focusId: FOC,
      focusTitle: "整理 D2 观察表素材",
      action: "open_task_modal",
      updatedAt: "2026-07-25T02:00:00.000Z",
      sourceKind: "task",
      refId: TSK_RUN,
      projectId: PRJ
    }
  ];
  await page.route("**/api/attention", async (route: Route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", json: attnJson });
  });

  await open(page, "/today");
  await expect(page.locator("[data-page=today]")).toBeVisible({ timeout: 10_000 });
  await page.locator(`[data-attention-id="task:${TSK_RUN}"]`).click();
  const modal = page.locator("[data-component=task-modal]");
  await expect(modal).toBeVisible();
  await expect(modal.locator("[data-task-context-retry]")).toBeVisible({ timeout: 8_000 });
  await modal.locator("[data-task-context-retry]").click();
  await modal.getByRole("button", { name: "关闭" }).click();
  await expect(modal).toHaveCount(0);
  releaseRetry?.();
  await expect.poll(() => deletes.length, { timeout: 8_000 }).toBeGreaterThan(0);
});

test("桌面上下文页签与 390 MobileApp 都能打开真实安排", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, `/focus/${FOC}`);
  await expect(page.locator("[data-page=redesign-focus]")).toBeVisible({ timeout: 10_000 });
  // DAILY-01:右栏改按需页签;桌面安排在「上下文」页签
  await page.locator("[data-focus-tab-btn=context]").click();
  await expect(page.locator(`[data-rail-item=obligation][data-rail-id="${FOB}"]`)).toBeVisible();
  await page.screenshot({ path: join(SHOT, "focus-desktop-1440.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, `/focus/${FOC}`);
  await expect(page.locator("[data-mobile-page=focus]")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("[data-page=redesign-focus]")).toHaveCount(0);
  await expect(page.locator("[data-rail-item=obligation]")).toHaveCount(0);
  await expect(page.locator("[data-mobile-page=focus]")).toContainText("整理 D2 观察表素材");
  await page.locator('[data-mobile-lane="_main"]').click();
  await expect(page.locator("[data-mobile-page=lane]")).toBeVisible();
  await expect(page.locator(`[data-mobile-obligation="${FOB}"]`)).toBeVisible();
  await expect(page.locator(`[data-mobile-obligation="${FOB}"]`)).toHaveAttribute("aria-label", "打开安排:整理观察表行");
  await page.screenshot({ path: join(SHOT, "focus-mobile-390.png"), fullPage: true });
  await page.locator(`[data-mobile-obligation="${FOB}"]`).click();
  await expect(page.locator("[data-mobile-page=card]")).toBeVisible();
  await expect(page.getByRole("heading", { name: "整理观察表行" })).toBeVisible();
  await expect(page.locator('[data-mobile-ob-resolve="done"]')).toBeVisible();
  await expect(page.locator('[data-mobile-ob-resolve="abandoned"]')).toBeVisible();
  await page.screenshot({ path: join(SHOT, "focus-mobile-390-obligation.png"), fullPage: true });
});
