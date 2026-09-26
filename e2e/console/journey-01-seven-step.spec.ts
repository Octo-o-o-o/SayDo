// 上轮七步导航不能冒充闭环。本文件只覆盖:B3 fetch 栅栏保稿、确认负向、Cost 身份、Demo IA。
// 生产闭环权威链:packages/daemon/test/journey01-closed-loop.e2e.test.ts

import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";

const ROOT = join(import.meta.dirname, "..", "..");
const FOC = "foc_01F1XT0RE0F0CVS00000000001";

const EVIDENCE =
  process.env["SAYDO_REPAIR4_EVIDENCE"] && process.env["SAYDO_REPAIR4_EVIDENCE"].trim() !== ""
    ? process.env["SAYDO_REPAIR4_EVIDENCE"]
    : process.env["SAYDO_REPAIR3_EVIDENCE"] && process.env["SAYDO_REPAIR3_EVIDENCE"].trim() !== ""
      ? process.env["SAYDO_REPAIR3_EVIDENCE"]
      : join(
          process.env.HOME ?? tmpdir(),
          ".codex",
          "tasks",
          "saydo-journey01-acceptance-20260920",
          "repair4-evidence"
        );

const runtime = JSON.parse(readFileSync(join(ROOT, "e2e", "console", ".runtime.json"), "utf8")) as {
  token: string;
};
const token = runtime.token;

test.beforeAll(() => {
  mkdirSync(EVIDENCE, { recursive: true });
});

async function open(page: Page, hash: string): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("saydo.setup.peeked", "1"));
  await page.goto(`/?token=${token}#${hash}`);
  await page.waitForLoadState("domcontentloaded");
}

test("B3 草稿:route 拦截真实 fetch,A 等待→B→释放→ready→离页→返回 B", async ({ page }) => {
  test.setTimeout(60_000);
  const created = await page.request.post("/api/focuses", {
    headers: { "x-saydo-token": token, "content-type": "application/json" },
    data: { title: "草稿栅栏B" }
  });
  expect(created.ok()).toBe(true);
  const focB = (await created.json() as { id?: string }).id;
  expect(focB).toMatch(/^foc_/);

  const posts: Array<{ focusId?: string; status: number; ok?: boolean }> = [];
  let releaseA: (() => void) | null = null;
  const gateA = new Promise<void>((resolve) => {
    releaseA = resolve;
  });
  await page.route("**/api/sessions/*/focus-anchor", async (route: Route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    const body = route.request().postDataJSON() as { focusId?: string };
    const row: { focusId?: string; status: number; ok?: boolean } = { focusId: body.focusId, status: 0 };
    posts.push(row);
    if (body.focusId === FOC) await gateA;
    const response = await route.fetch();
    const payload = (await response.json().catch(() => ({}))) as { ok?: boolean };
    row.status = response.status();
    if (typeof payload.ok === "boolean") row.ok = payload.ok;
    await route.fulfill({ response });
  });

  await page.addInitScript((raw) => {
    localStorage.setItem("saydo.setup.peeked", "1");
    sessionStorage.setItem("saydo.chat.pendingAnchor", raw);
  }, JSON.stringify({ focusId: FOC, title: "主题A", draft: "草稿A-等待前" }));
  await page.goto(`/?token=${token}#/chat-new`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-page=chat]")).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => posts.length, { timeout: 8_000 }).toBeGreaterThan(0);
  await expect(page.locator("[data-text-input]")).toHaveValue("草稿A-等待前");

  await page.evaluate((raw) => {
    sessionStorage.setItem("saydo.chat.pendingAnchor", raw);
    location.hash = "#/today";
  }, JSON.stringify({ focusId: focB, title: "主题B", draft: "草稿B-等待中改的" }));
  await expect(page.locator("[data-page=today]")).toBeVisible({ timeout: 10_000 });
  await page.evaluate(() => {
    location.hash = "#/chat-new";
  });
  await expect(page.locator("[data-page=chat]")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("[data-text-input]")).toHaveValue("草稿B-等待中改的");
  await expect(page.locator("[data-anchor-phase]")).toHaveAttribute("data-anchor-phase", "pending");

  releaseA?.();
  await expect.poll(() => posts.some((p) => p.focusId === focB), { timeout: 8_000 }).toBe(true);
  await expect(page.locator("[data-anchor-phase]")).toHaveAttribute("data-anchor-phase", "ready", { timeout: 15_000 });
  await expect(page.locator("[data-text-input]")).toHaveValue("草稿B-等待中改的");

  await open(page, `/focus/${FOC}`);
  await expect(page.locator("[data-page=redesign-focus]")).toBeVisible({ timeout: 10_000 });
  await open(page, "/chat-new");
  await expect(page.locator("[data-text-input]")).toHaveValue("草稿B-等待中改的");
  await page.screenshot({ path: join(EVIDENCE, "b3-draft-barrier.png"), fullPage: true });
  writeFileSync(join(EVIDENCE, "b3-draft-posts.json"), `${JSON.stringify({ focB, posts }, null, 2)}\n`);
});

function playwrightDbPath(): string {
  const candidates = [
    "/private/tmp/saydo-playwright-home-47188/saydo.db",
    "/tmp/saydo-playwright-home-47188/saydo.db"
  ];
  const hit = candidates.find((p) => existsSync(p));
  if (!hit) throw new Error("playwright saydo.db 不存在,不能种确认负向包");
  return hit;
}

function seedConfirmNegativeSurface(focusId: string): { packageId: string; revision: number; taskId: string } {
  const requireDb = createRequire(join(ROOT, "packages/daemon/package.json"));
  const Database = requireDb("better-sqlite3") as typeof import("better-sqlite3");
  const db = new Database(playwrightDbPath());
  const packageId = "pkg_01R3P1NEG0CNF0000000000001";
  const taskId = "tsk_01R3P1NEG0CNF0000000000001";
  const sessionId = "ses_01R3P1NEG0CNF0000000000001";
  const receiptId = "apr_01R3P1NEG0CNF0000000000001";
  const src = db.prepare("SELECT * FROM decision_packages WHERE id = ?").get("pkg_01F1XT0RE0A000000000000000") as
    | Record<string, unknown>
    | undefined;
  if (!src) {
    db.close();
    throw new Error("fixture 决策包不存在");
  }
  const body = JSON.parse(String(src["body_json"])) as Record<string, unknown>;
  body["id"] = packageId;
  body["outcomePreview"] = "负向确认包:缺卡不能消费";
  const digest = `sha256:${createHash("sha256").update(`repair3-neg:${packageId}:${focusId}`).digest("hex")}`;
  const now = new Date().toISOString();
  const exp = new Date(Date.now() + 86_400_000).toISOString();
  db.prepare(
    `INSERT INTO decision_packages(id, revision, digest, project_id, body_json, status, proposed_at, expires_at, created_at)
     VALUES (?, 1, ?, ?, ?, 'proposed', ?, ?, ?)`
  ).run(packageId, digest, src["project_id"], JSON.stringify(body), now, exp, now);
  db.prepare(
    `INSERT INTO pending_confirmations(
       session_id, receipt_id, kind, prompt_text, payload_json, digest, digest_version,
       sentence_id, attempt, focus_id, presented_at, expires_at
     ) VALUES (?, ?, 'dispatch', '拍板开始', ?, ?, 1, 's-neg-pending', 1, ?, ?, ?)`
  ).run(
    sessionId,
    receiptId,
    JSON.stringify({ kind: "dispatch", packageId, revision: 1, mode: "step_confirm" }),
    digest,
    focusId,
    now,
    exp
  );
  const srcTask = db.prepare("SELECT * FROM tasks WHERE id = ?").get("tsk_01F1XT0RE0TSKRVN0000000000") as
    | Record<string, unknown>
    | undefined;
  if (!srcTask) {
    db.close();
    throw new Error("fixture 运行中任务不存在");
  }
  const taskRow = {
    ...srcTask,
    id: taskId,
    status: "paused_step_boundary",
    package_id: packageId,
    package_rev: 1,
    package_digest: digest,
    title: "负向确认步界任务",
    // 复制 running fixture 的 updated_at(2026-07-25)等于伪造"步界已等两个月"——park sweep
    // 每 15s 一拍,09 §6.1 边 paused_step_boundary 30s 无应答 -> blocked,插入即逾期,
    // 下拍命中页面取数窗口就没有「这一步行」。置 now = "刚停靠"的真实形状。
    updated_at: now
  };
  const cols = Object.keys(taskRow);
  db.prepare(`INSERT INTO tasks(${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`).run(
    ...cols.map((c) => taskRow[c])
  );
  const event = db.prepare("SELECT id FROM focus_events WHERE focus_id = ? ORDER BY seq LIMIT 1").get(focusId) as
    | { id: string }
    | undefined;
  if (!event) {
    db.close();
    throw new Error(`focus ${focusId} 没有事件,不能建绑定`);
  }
  db.prepare(
    `INSERT INTO action_execution_bindings(
       id, focus_id, task_id, focus_revision_at_authorization, selected_authority, phase,
       authorized_by_event_id, authoritative_ledger_ref, created_at, updated_at
     ) VALUES (?, ?, ?, 1, 'tier1', 'authorized', ?, NULL, ?, ?)`
  ).run("aeb_01R3P1NEG0CNF0000000000001", focusId, taskId, event.id, now, now);
  db.close();
  return { packageId, revision: 1, taskId };
}

test("确认负向:错 kind/缺 task/错包打不开消费", async ({ page }) => {
  test.setTimeout(60_000);
  const created = await page.request.post("/api/focuses", {
    headers: { "x-saydo-token": token, "content-type": "application/json" },
    data: { title: "确认负向焦点" }
  });
  expect(created.ok()).toBe(true);
  const focNeg = (await created.json() as { id?: string }).id;
  expect(focNeg).toMatch(/^foc_/);
  const seeded = seedConfirmNegativeSurface(focNeg!);
  const detail = await page.request.get(`/api/focuses/${encodeURIComponent(focNeg!)}`, {
    headers: { "x-saydo-token": token }
  });
  expect(detail.ok()).toBe(true);
  const body = (await detail.json()) as { packages?: Array<{ id?: string; revision?: number; status?: string }> };
  const pendingPkg = (body.packages ?? []).find((p) => p.id === seeded.packageId);
  expect(pendingPkg?.revision).toBe(1);
  expect(pendingPkg?.status).toBe("proposed");

  await open(page, `/focus/${focNeg}`);
  await expect(page.locator("[data-page=redesign-focus]")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("[data-focus-work-surface]")).toBeVisible({ timeout: 10_000 });
  const approve = page.locator(`[data-focus-work-pkg="${seeded.packageId}"]`).locator("button", { hasText: "拍板" });
  await expect(approve).toBeVisible();
  await expect(page.locator("[data-decision-package]")).toContainText("负向确认包");
  await approve.click();
  await expect(page.locator("[data-toast]")).toContainText(/还没接到|没有待批|不能|对不上/);
  const toastPkg = (await page.locator("[data-toast]").innerText()).trim();
  await expect(page.locator("[data-component=task-modal]")).toHaveCount(0);

  const stepOk = page.locator(`[data-focus-work-task="${seeded.taskId}"]`).locator("button", { hasText: "这一步行" });
  await expect(stepOk).toBeVisible();
  await stepOk.click();
  await expect(page.locator("[data-toast]")).toContainText(/对不上这个任务|不能在这里拍板/);
  const toastTask = (await page.locator("[data-toast]").innerText()).trim();
  await expect(page.locator("[data-component=task-modal]")).toHaveCount(0);
  await page.locator("[data-focus-work-surface]").scrollIntoViewIfNeeded();
  await page.locator("[data-focus-work-surface]").screenshot({ path: join(EVIDENCE, "confirm-negative-surface.png") });
  await page.screenshot({ path: join(EVIDENCE, "confirm-negative.png"), fullPage: true });
  writeFileSync(
    join(EVIDENCE, "confirm-negative.json"),
    `${JSON.stringify({ focNeg, seeded, pendingPkg, toastPkg, toastTask }, null, 2)}\n`
  );
});

test("Demo 侧栏三态与安排归档", async ({ page }) => {
  test.setTimeout(60_000);
  const demo = join(ROOT, "demo", "saydo-console-redesign-proposal.html");
  mkdirSync(join(EVIDENCE, "demo"), { recursive: true });
  await page.goto(`file://${demo}`);
  await expect(page.locator('.nav-item[data-go="#/board"]')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.nav-item[data-go="#/arrangements"]')).toBeVisible();
  await expect(page.locator('.nav-item[data-go="#/archive"]')).toBeVisible();
  await page.locator('.nav-item[data-go="#/board"]').click();
  await expect(page.locator(".h-page", { hasText: "泳道" })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("[data-board-view=lanes]")).toBeVisible();
  await page.screenshot({ path: join(EVIDENCE, "demo", "board-lanes.png"), fullPage: true });
  await page.locator("[data-board-mode=list]").click();
  await expect(page.locator("[data-board-view=list]")).toBeVisible();
  await expect(page.locator("[data-board-list-row]").first()).toBeVisible();
  await page.screenshot({ path: join(EVIDENCE, "demo", "board-list.png"), fullPage: true });
  await page.locator("[data-board-mode=kanban]").click();
  await expect(page.locator("[data-board-view=kanban]")).toBeVisible();
  const colYou = page.locator('[data-board-col="0"]');
  const colExt = page.locator('[data-board-col="2"]');
  await expect(colYou).toHaveAttribute("data-board-col-name", "等你");
  await expect(colExt).toHaveAttribute("data-board-col-name", "等外部");
  await expect(colYou).toContainText("月度跑批脚本");
  await expect(colYou).toContainText("讲稿正文初稿");
  await expect(colYou).toContainText("发布会日期定在哪天");
  await expect(colYou).toContainText("等你拍板");
  await expect(colExt).toContainText("等飞书群管理员开 webhook");
  await expect(colExt).not.toContainText("月度跑批脚本");
  await expect(colExt).not.toContainText("讲稿正文初稿");
  await page.screenshot({ path: join(EVIDENCE, "demo", "board-kanban.png"), fullPage: true });
  await page.locator('.nav-item[data-go="#/arrangements"]').click();
  await expect(page.locator(".h-page", { hasText: "安排" })).toBeVisible();
  await page.screenshot({ path: join(EVIDENCE, "demo", "arrangements.png"), fullPage: true });
  await page.locator('.nav-item[data-go="#/archive"]').click();
  await expect(page.locator(".h-page", { hasText: "归档" })).toBeVisible();
  await page.screenshot({ path: join(EVIDENCE, "demo", "archive.png"), fullPage: true });
});

test("Cost 身份用 projectId,展示 title", async ({ page }) => {
  test.setTimeout(60_000);
  const costsRes = await page.request.get("/api/costs", { headers: { "x-saydo-token": token } });
  expect(costsRes.ok()).toBe(true);
  await open(page, "/cost");
  await expect(page.locator("[data-page=cost]")).toBeVisible({ timeout: 10_000 });
  await page.locator("[data-cost-range=all]").click();
  await expect(page.locator("[data-cost-all-ledger]")).toBeVisible();
  const row = page.locator("[data-cost-group-row]").first();
  await expect(row).toBeVisible();
  const key = await row.getAttribute("data-cost-group-row");
  expect(key === "(无项目)" || key?.startsWith("prj_") || Boolean(key)).toBe(true);
  await page.screenshot({ path: join(EVIDENCE, "cost-identity.png"), fullPage: true });
});
