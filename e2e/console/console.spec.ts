// D1 控制台冒烟(5.1/5.2):各路由渲染 + fixture 一致 + 切项目不断会话 + 截图基线(亮暗)。
// daemon 由 global-setup 启动(固定 home/47188),console 走 daemon 静态服务(同源,G1 真 token)。

import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const PORT = 47188;
const ROOT = join(import.meta.dirname, "..", "..");
const PRJ = "prj_01F1XT0RE0A000000000000000";
const TSK_READY = "tsk_01F1XT0RE0TSKRDY0000000000";

const runtime = JSON.parse(readFileSync(join(ROOT, "e2e", "console", ".runtime.json"), "utf8")) as {
  token: string;
  lanAddress: string;
  firstRunToken: string;
  firstRunPort: number;
};
const token = runtime.token;

test.beforeAll(() => {
  mkdirSync(join(ROOT, "e2e", "screenshots", "light"), { recursive: true });
  mkdirSync(join(ROOT, "e2e", "screenshots", "dark"), { recursive: true });
});

async function open(page: Page, hash: string): Promise<void> {
  // 应用内页面用例显式复现用户点过「先随便看看」后的 durable 选择;
  // 首启专项用例不用本 helper,继续在 fresh origin 穿真正向导门。
  await page.addInitScript(() => localStorage.setItem("saydo.setup.peeked", "1"));
  await page.goto(`/?token=${token}#${hash}`);
  await page.waitForLoadState("networkidle");
}

async function connectTestPipeline(): Promise<WebSocket> {
  const health = (await fetch(`http://127.0.0.1:${PORT}/health`).then((response) => response.json())) as {
    identity?: { sourceRevision: string; buildId: string; protocolVersion: string };
    stateRootDigest?: string;
  };
  if (!health.identity || !health.stateRootDigest) throw new Error("test pipeline hello needs daemon identity");
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws/voice?token=${token}`);
  await new Promise<void>((resolve, reject) => {
    ws.addEventListener("open", () => resolve(), { once: true });
    ws.addEventListener("error", () => reject(new Error("test pipeline websocket failed to open")), { once: true });
  });
  const ack = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("test pipeline hello timed out")), 3_000);
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as { t?: string };
      if (message.t !== "hello.ack") return;
      clearTimeout(timer);
      resolve();
    });
  });
  ws.send(JSON.stringify({ v: 1, role: "pipeline", identity: health.identity }));
  await ack;
  ws.send(JSON.stringify({
    t: "pipeline.health",
    asr: "ok",
    tts: "ok",
    identity: health.identity,
    stateRootDigest: health.stateRootDigest
  }));
  for (let attempt = 0; attempt < 40; attempt++) {
    const ready = (await fetch(`http://127.0.0.1:${PORT}/readyz`).then((response) => response.json())) as {
      voiceReady?: boolean;
    };
    if (ready.voiceReady === true) return ws;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  ws.close();
  throw new Error("test pipeline did not become voice-ready");
}

// 11 页路由表(08 §6)
const PAGES: { name: string; hash: string; probe: string }[] = [
  { name: "dashboard", hash: "/dashboard", probe: "[data-page=dashboard]" },
  { name: "chat", hash: `/p/${PRJ}/chat`, probe: "[data-page=chat]" },
  { name: "tasks", hash: `/p/${PRJ}/tasks`, probe: "[data-page=tasks]" },
  { name: "task-detail", hash: `/p/${PRJ}/task/${TSK_READY}`, probe: "[data-page=task-detail]" },
  { name: "memory", hash: `/p/${PRJ}/memory`, probe: "[data-page=memory]" },
  { name: "artifacts", hash: `/p/${PRJ}/artifacts`, probe: "[data-page=artifacts]" },
  { name: "psettings", hash: `/p/${PRJ}/settings`, probe: "[data-page=psettings]" },
  { name: "approvals", hash: "/approvals", probe: "[data-page=approvals]" },
  { name: "notify", hash: "/notify", probe: "[data-page=notify]" },
  { name: "cost", hash: "/cost", probe: "[data-page=cost]" },
  { name: "settings", hash: "/settings", probe: "[data-page=settings]" }
];

test("G1:无 token 打开 API 被拒(fail-closed)", async () => {
  const r = await fetch(`http://127.0.0.1:${PORT}/api/overview`);
  expect(r.status).toBe(403);
});

// C7 Focus 只读页(≥2 条:列表渲染 + 详情渲染)
const FOC = "foc_01F1XT0RE0F0CVS00000000001";

test("Focus 列表渲染(lifecycle/revision/未结义务)", async ({ page }) => {
  await open(page, "/focuses");
  await expect(page.locator("[data-page=focuses]")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("[data-focus-list]")).toContainText("整理 D2 观察表素材");
  await expect(page.locator(`[data-focus-id="${FOC}"]`)).toContainText("未结义务");
});

test("Focus 详情正式页渲染(方向/球权/安排)", async ({ page }) => {
  await open(page, `/focus/${FOC}`);
  await expect(page.locator("[data-page=redesign-focus]")).toBeVisible({ timeout: 10_000 });
  const state = page.locator(`[data-focus-statecard="${FOC}"]`);
  await expect(state).toContainText("整理 D2 观察表素材");
  await expect(state).toContainText("整理素材");
  await expect(state).toContainText("你 1 件");
  await expect(page.locator("[data-focus-rail]")).toContainText("整理观察表行");
  await expect(page.locator("[data-focus-rail]")).toContainText("需要你");
});

test("11 路由全部渲染 + fixture 一致 + 截图基线(亮暗)", async ({ page }) => {
  test.setTimeout(180_000);
  for (const p of PAGES) {
    await open(page, p.hash);
    await expect(page.locator(p.probe)).toBeVisible({ timeout: 10_000 });
    for (const theme of ["light", "dark"] as const) {
      await page.evaluate((value) => localStorage.setItem("saydo.theme", value), theme);
      await page.reload({ waitUntil: "networkidle" });
      await expect(page.locator(p.probe)).toBeVisible({ timeout: 10_000 });
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await page.screenshot({ path: join(ROOT, "e2e", "screenshots", theme, `${p.name}.png`), fullPage: true });
    }
  }
});

test("fixture 一致:Dashboard 聚合条与状态词(等你验收/StatusChip 单源)", async ({ page }) => {
  await open(page, "/dashboard");
  await expect(page.locator("[data-pending-list]")).toContainText("报表导出 CSV");
  await expect(page.locator("[data-status=ready_for_review]").first()).toContainText("等你验收");
  await expect(page.locator("[data-project-grid]")).toContainText("报表系统");
});

test("任务看板:派生态 parked 呈现(11 §2.6)", async ({ page }) => {
  await open(page, `/p/${PRJ}/tasks`);
  await expect(page.locator("[data-status=parked]").first()).toContainText("停靠等你");
  await expect(page.locator("[data-board]")).toContainText("第 1 次尝试".replace("第 1 次尝试", "分页性能优化")); // running 卡在板上
});

test("任务详情:AC 三条 + S3 合并按钮是屏幕强认证样式(语音永不渲染 S3 批准)", async ({ page }) => {
  await open(page, `/p/${PRJ}/task/${TSK_READY}`);
  await expect(page.locator("[data-acceptance-list] li")).toHaveCount(3);
  await expect(page.locator("[data-s3-merge]")).toContainText("去屏幕强认证");
  const runRow = page.locator("tr").filter({ has: page.locator("[data-observed-model]") });
  await expect(runRow.locator("[data-observed-model]")).toContainText("cursor-grok-4.6-high-fast");
  await expect(runRow.locator("[data-adapter]")).toContainText("cursor");
});

test("W5.4-b C3 设置页展示 Tier1 六项且未测试不伪造登录与额度", async ({ page }) => {
  await open(page, "/settings");
  const card = page.locator("[data-tier1-settings]");
  await expect(card).toBeVisible();
  await expect(card).toContainText("后端");
  await expect(card).toContainText("模型");
  await expect(card).toContainText("版本");
  await expect(card.locator("[data-tier1-login]")).toContainText("未测试");
  await expect(card.locator("[data-tier1-self-test]")).toContainText("未测试");
  await expect(card.locator("[data-tier1-version]")).toContainText("未测试");
  await expect(card.locator("[data-tier1-pinned-version]")).toBeVisible();
  await expect(card.locator("[data-tier1-window]")).toContainText("没有已知限流记录");
  await expect(card).not.toContainText("额度充足");
});

test("W5a 3.7 紧凑模式(11 §3):顶栏切换 -> data-density=compact + 持久;再切回舒适", async ({ page }) => {
  await open(page, "/");
  await expect(page.locator("html")).not.toHaveAttribute("data-density", "compact");
  await page.locator("[data-density-toggle]").click();
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
  const persisted = await page.evaluate(() => localStorage.getItem("saydo.density"));
  expect(persisted).toBe("compact");
  await page.locator("[data-density-toggle]").click();
  await expect(page.locator("html")).not.toHaveAttribute("data-density", "compact");
});

test("成本页:unknown 纪律(还没有确切数字,禁 0)", async ({ page }) => {
  await open(page, "/cost");
  await expect(page.locator("[data-page=cost]")).toContainText("还没有确切数字");
  const text = await page.locator("[data-cost-by-project]").innerText();
  expect(text).not.toMatch(/0\.00 元/);
});

test("切项目/切导航不断会话(VoiceProvider 恒一次挂载)", async ({ page }) => {
  await open(page, `/p/${PRJ}/chat`);
  await page.locator("[data-nav='/cost']").click();
  await expect(page.locator("[data-page=cost]")).toBeVisible();
  await page.locator("[data-legacy-toggle]").click();
  await page.locator(`[data-nav='/p/${PRJ}/tasks']`).click();
  await expect(page.locator("[data-page=tasks]")).toBeVisible();
  const mounts = await page.evaluate(() => (window as unknown as { __saydoVoiceMounts?: number }).__saydoVoiceMounts);
  expect(mounts).toBe(1);
});

test("M1 窄屏渲染移动树，视口切换不重建 WS Provider，宽屏重定向桌面", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "/m");
  await expect(page.locator("[data-mobile-shell]" )).toBeVisible();
  await expect(page.locator("[data-mobile-page=today]" )).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __saydoVoiceMounts?: number }).__saydoVoiceMounts)).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.locator("[data-mobile-shell]" )).toHaveAttribute("data-dstat", "offline");
  await expect(page.locator(".m-composer input" )).toBeEnabled();
  await expect(page.locator(".m-send" )).toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator("[data-mobile-shell]" )).toHaveAttribute("data-dstat", "online");
  await expect(page.locator(".m-composer input" )).toBeEnabled();

  await page.setViewportSize({ width: 1000, height: 844 });
  await expect(page.locator("[data-page=today]" )).toBeVisible();
  await expect(page).toHaveURL(/#\/today$/);
  expect(await page.evaluate(() => (window as unknown as { __saydoVoiceMounts?: number }).__saydoVoiceMounts)).toBe(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("[data-mobile-page=today]" )).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __saydoVoiceMounts?: number }).__saydoVoiceMounts)).toBe(1);
});

test("M1 M-Chat 呈现既有 first-run 端点开场白", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const firstRunResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/setup/first-run/query"
  );
  await page.goto(
    `http://${runtime.lanAddress}:${runtime.firstRunPort}/?token=${runtime.firstRunToken}#/m/chat`
  );
  await page.waitForLoadState("networkidle");
  expect((await firstRunResponse).status()).toBe(200);
  await expect(page.locator("[data-setup-bootstrap=remote-mobile]")).toHaveCount(1);
  await expect(page.locator("[data-mobile-transcript]" )).toContainText("第一次来?随便说三件你这周要办的事");
});

test("M1 真浏览器经 RFC1918 地址读取 Today，同源 GET 缺 Origin 仍通过浏览器来源门", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const attentionReq = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/attention");
  await page.goto(`http://${runtime.lanAddress}:${PORT}/?token=${token}#/m`);
  await expect(page.locator("[data-mobile-page=today]")).toBeVisible();
  const headers = await (await attentionReq).allHeaders();
  expect(headers["origin"]).toBeUndefined();
  expect(headers["referer"]).toContain(`http://${runtime.lanAddress}:${PORT}/`);
  const site = headers["sec-fetch-site"];
  if (site !== undefined) expect(site).toBe("same-origin");
  await expect(page.locator("[data-setup-bootstrap=remote-mobile]")).toHaveCount(1);
  await expect(page.locator("[data-mobile-page=today]")).not.toContainText("正在翻今天的账");
  await expect(page.locator("[data-mobile-page=today]")).not.toContainText("读取失败");
});

test("M1 LAN Things 直挂移动树", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`http://${runtime.lanAddress}:${PORT}/?token=${token}#/m/things`);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[data-setup-bootstrap=remote-mobile]")).toHaveCount(1);
  await expect(page.locator("[data-mobile-page=things]")).toBeVisible();
  await expect(page.locator("[data-page=today]")).toHaveCount(0);
  await expect(page.locator("[data-mobile-page=things]")).not.toContainText("Focus 读取失败");
});

test("M1 LAN 横屏仍强制移动树,不走桌面 Today", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 844 });
  await page.goto(`http://${runtime.lanAddress}:${PORT}/?token=${token}#/m`);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[data-setup-bootstrap=remote-mobile]")).toHaveCount(1);
  await expect(page.locator("[data-mobile-page=today]")).toBeVisible();
  await expect(page.locator("[data-page=today]")).toHaveCount(0);
  await expect(page).toHaveURL(/#\/m$/);
});

test("M1 文本经既有 dialog 链收到回复，抢先消息不消费 first-run", async ({ page }) => {
  const pipeline = await connectTestPipeline();
  await page.setViewportSize({ width: 390, height: 844 });
  let firstRunQueries = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/setup/first-run/query") firstRunQueries += 1;
  });
  try {
    await page.goto(`http://${runtime.lanAddress}:${PORT}/?token=${token}#/m`);
    await expect(page.locator("[data-mobile-page=today]")).toBeVisible();
    await page.locator(".m-composer input").fill("撤销");
    await page.locator(".m-send").click();
    await expect(page).toHaveURL(/#\/m\/chat$/);
    await expect(page.locator(".m-composer input")).toHaveValue("");
    await expect(page.locator("[data-mobile-transcript]")).toContainText("撤销");
    await expect(page.locator("[data-mobile-transcript]")).toContainText("最近没有可撤销的操作。");
    expect(firstRunQueries).toBe(0);
  } finally {
    pipeline.close();
  }
});

test("M1 WS 写入异常时保留移动草稿", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`http://${runtime.lanAddress}:${PORT}/?token=${token}#/m`);
  await expect(page.locator("[data-mobile-shell]")).toHaveAttribute("data-dstat", "online");
  await page.locator(".m-composer input").fill("不能静默丢掉的草稿");
  await page.evaluate(() => {
    const original = WebSocket.prototype.send;
    WebSocket.prototype.send = function (data) {
      if (typeof data === "string" && data.includes('"t":"turn.text"')) {
        WebSocket.prototype.send = original;
        throw new Error("simulated websocket write failure");
      }
      return original.call(this, data);
    };
  });
  await page.locator(".m-send").click();
  await expect(page).toHaveURL(/#\/m$/);
  await expect(page.locator(".m-composer input")).toHaveValue("不能静默丢掉的草稿");
  await expect(page.locator(".m-toast")).toContainText("还没发出去，草稿给你留着了。");
});

test("M1 WS 首连失败不会永久卡在 connecting", async ({ page }) => {
  await page.routeWebSocket("**/ws/voice*", (ws) => ws.close({ code: 1013, reason: "test unavailable" }));
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "/m");
  await expect(page.locator("[data-mobile-shell]" )).toHaveAttribute("data-dstat", "connecting");
  await expect(page.locator("[data-mobile-shell]" )).toHaveAttribute("data-dstat", "offline", { timeout: 5_000 });
  await expect(page.locator(".m-composer input" )).toBeEnabled();
  await expect(page.locator(".m-send" )).toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator("[data-mobile-shell]" )).toHaveAttribute("data-dstat", "connecting");
  await expect(page.locator("[data-mobile-shell]" )).toHaveAttribute("data-dstat", "offline", { timeout: 5_000 });
});

test("M1 浏览器真实断网后 WS 重连恢复 online，草稿始终可编辑", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "/m");
  await expect(page.locator("[data-mobile-shell]" )).toHaveAttribute("data-dstat", "online");
  await context.setOffline(true);
  await expect(page.locator("[data-mobile-shell]" )).toHaveAttribute("data-dstat", "offline");
  await page.locator(".m-composer input").fill("断网时保留这段草稿");
  await expect(page.locator(".m-composer input")).toHaveValue("断网时保留这段草稿");
  await expect(page.locator(".m-send")).toBeDisabled();
  await context.setOffline(false);
  await expect(page.locator("[data-mobile-shell]" )).toHaveAttribute("data-dstat", "online", { timeout: 10_000 });
  await expect(page.locator(".m-composer input")).toHaveValue("断网时保留这段草稿");
});

test("桌面 fresh origin 通过真实逃生口进入，并在整页重载后保持选择", async ({ page }) => {
  await page.goto(
    `http://localhost:${runtime.firstRunPort}/?token=${runtime.firstRunToken}#/dashboard`
  );
  const peek = page.locator('[data-action="peek-anyway"]');
  await expect(peek).toBeVisible({ timeout: 10_000 });
  await peek.click();
  await expect(page.locator("[data-page=dashboard]")).toBeVisible({ timeout: 10_000 });
  expect(await page.evaluate(() => localStorage.getItem("saydo.setup.peeked"))).toBe("1");
  await page.reload();
  await expect(page.locator("[data-page=dashboard]")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-action="peek-anyway"]')).toHaveCount(0);
});

test("first-run presented 回放在 Chat 卸载、重挂与整页重载后仍可呈现", async ({ page }) => {
  let queries = 0;
  await page.route("**/api/setup/first-run/query", async (route) => {
    queries++;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        state: "presented",
        delivered: true,
        message: "固定首跑开场白",
        turnId: "onboarding-stable-1"
      })
    });
  });

  await open(page, "/chat-new");
  await expect(page.locator("[data-transcript]")).toContainText("固定首跑开场白");
  await page.locator("[data-nav='/today']").click();
  await expect(page.locator("[data-page=today]")).toBeVisible();
  await page.locator("[data-side-action=chat-new]").click();
  await expect(page.locator("[data-transcript]")).toContainText("固定首跑开场白");
  await page.reload();
  await expect(page.locator("[data-transcript]")).toContainText("固定首跑开场白");
  expect(queries).toBeGreaterThanOrEqual(3);
});

test("审批中心:每卡带项目/任务上下文;终局卡置灰(单次消费视觉)", async ({ page }) => {
  await open(page, "/approvals");
  await expect(page.locator("[data-approval-list]")).toContainText("报表系统");
  await expect(page.locator("[data-approval-list]")).toContainText("接入企业微信通知");
});

test("vite dev 入口(47120):同源 proxy 下 API 数据可达(任务⑤ api.ts 端口判定回归)", async ({ page }) => {
  // 旧 bug:api.ts 写死判定 5173(实际 47120),dev 页 API/WS 全打错源;修后恒同源 + vite proxy 转发
  await page.addInitScript(() => localStorage.setItem("saydo.setup.peeked", "1"));
  await page.goto(`http://127.0.0.1:47120/?token=${token}#/dashboard`);
  await expect(page.locator("[data-page=dashboard]")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-project-grid]")).toContainText("报表系统"); // 数据真来自 daemon(47188)
  await expect(page.locator("[data-pending-list]")).toContainText("报表导出 CSV");
});

test("任务详情操作行(任务②写口):approve -> 待合并;S3 合并按钮批准前置灰", async ({ page }) => {
  // fixture 的 ready_for_review 任务:先断言按钮存在且 S3 置灰,点验收通过后状态翻转
  await open(page, `/p/${PRJ}/task/${TSK_READY}`);
  await expect(page.locator("[data-action=approve]")).toBeVisible();
  await expect(page.locator("[data-s3-merge]")).toBeDisabled(); // 未批准不可合并(先验收)
  await page.locator("[data-action=approve]").click();
  await expect(page.locator("[data-status=review_approved_waiting_merge]").first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("[data-s3-merge]")).toBeEnabled(); // 批准后可请求人工合并
});

// ---------- W4 3.1 S3 卡(09 §3.3;11 §5.4/§5.5)——渲染条件/置灰/降级/归一重定向 ----------

test("W4 S3 卡:127.0.0.1 页面 308 归一到 localhost(rpId 绑定的部署约束)", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("saydo.setup.peeked", "1"));
  await page.goto(`http://127.0.0.1:47188/?token=${token}#/`);
  await expect(page.locator("[data-page=today]")).toBeVisible({ timeout: 10_000 });
  expect(new URL(page.url()).hostname).toBe("localhost"); // daemon 308 归一
});

test("W4 S3 卡:未注册 passkey 降级(manual-fallback 模式 + 注册入口 + 诚实注脚;fixture 库无凭据)", async ({ page }) => {
  await open(page, `/p/${PRJ}/task/${TSK_READY}`);
  // fixture 无 webauthn 凭据 ⇒ S3 组件 = 降级模式(去受信终端人工合并),同时给注册入口
  await expect(page.locator("[data-s3-merge]")).toHaveAttribute("data-s3-mode", "manual-fallback");
  await expect(page.locator("[data-s3-merge]")).toContainText("去屏幕强认证");
  await expect(page.locator("[data-s3-register]")).toBeVisible();
  await expect(page.locator("[data-s3-register]")).toContainText("注册本机认证凭据");
  // 诚实注脚(09 §3.3 同步凭据条款 ②,11 §5.4 逐字)
  await expect(page.locator("[data-s3-honesty-note]")).toContainText("批准动作本身只能在这台电脑完成");
});

test("W4 S3 面守卫:无 Origin 的 CLI 式请求被拒(fail-closed;s3Guard ②)", async () => {
  const r = await fetch(`http://127.0.0.1:${PORT}/api/s3/status`, { method: "POST", headers: { "x-saydo-token": token } });
  expect(r.status).toBe(403);
  const body = (await r.json()) as { code: string };
  expect(body.code).toBe("s3_origin_rejected");
});

test("W4 S3 面:浏览器同源 POST(带 Origin)可查注册状态(四断言全过)", async ({ page }) => {
  await open(page, "/approvals");
  // 浏览器 context 内 POST fetch(Origin: http://localhost:47188)⇒ 四断言过,查得 registered=false
  const status = await page.evaluate(async () => {
    const res = await fetch("/api/s3/status", {
      method: "POST",
      headers: { "content-type": "application/json", "x-saydo-token": localStorage.getItem("saydo.capToken") ?? "" },
      body: "{}"
    });
    return { httpStatus: res.status, body: (await res.json()) as { registered?: boolean; rpId?: string } };
  });
  expect(status.httpStatus).toBe(200);
  expect(status.body.registered).toBe(false);
  expect(status.body.rpId).toBe("localhost");
});

// ---------- W4 3.9 对话输入区改版(10 #7/11 §5.10;三态 + 编辑后发送) ----------

test("W4 3.9 输入区:待命三态入口(点击说话 + 打字 + 模式切换)+ 文本回车发送路径", async ({ page }) => {
  await open(page, `/p/${PRJ}/chat`);
  const region = page.locator("[data-input-region]");
  await expect(region).toHaveAttribute("data-input-state", "idle");
  await expect(page.locator("[data-mic-toggle]")).toBeVisible(); // 点击 toggle 采集
  await expect(page.locator("[data-text-input]")).toBeVisible(); // 直接打字
  await expect(page.locator("[data-voice-mode-toggle]")).toBeVisible(); // 三态并列:免手 VAD 切换
  // 文本发送按钮初始置灰,输入后可点
  await expect(page.locator("[data-text-send]")).toBeDisabled();
  await page.locator("[data-text-input]").fill("给报表加导出");
  await expect(page.locator("[data-text-send]")).toBeEnabled();
});

test("W4 3.9 输入区:点击说话 -> 录音中(电平/计时/取消)-> 取消回待命", async ({ page }) => {
  const pipeline = await connectTestPipeline();
  try {
    await open(page, `/p/${PRJ}/chat`);
    await page.locator("[data-mic-toggle]").click();
    const region = page.locator("[data-input-region]");
    await expect(region).toHaveAttribute("data-input-state", "recording");
    await expect(page.locator("[data-rec-timer]")).toBeVisible(); // 计时
    await expect(page.locator("[data-rec-level]")).toBeVisible(); // 电平/波形反馈
    await expect(page.locator("[data-rec-cancel]")).toBeVisible(); // 可取消
    await page.locator("[data-rec-cancel]").click();
    await expect(region).toHaveAttribute("data-input-state", "idle");
  } finally {
    pipeline.close();
  }
});

test("双动作 A·直接发送:录音 -> 发送 -> 对话流语音气泡占位(转写中…)+ 输入区回待命", async ({ page }) => {
  const pipeline = await connectTestPipeline();
  try {
    await open(page, `/p/${PRJ}/chat`);
    await page.locator("[data-mic-toggle]").click();
    await expect(page.locator("[data-input-region]")).toHaveAttribute("data-input-state", "recording");
    await expect(page.locator("[data-rec-send]")).toBeVisible();
    await expect(page.locator("[data-rec-edit]")).toBeVisible(); // 结束时二选一(11 §5.10 双动作)
    await page.locator("[data-rec-send]").click();
    // 已发出语义先行:对话流立刻出现语音占位气泡(转写在途),输入区回待命
    await expect(page.locator("[data-input-region]")).toHaveAttribute("data-input-state", "idle");
    await expect(page.locator('[data-voice-turn="transcribing"]')).toBeVisible();
    await expect(page.locator('[data-voice-turn="transcribing"]')).toContainText("转写中");
  } finally {
    pipeline.close();
  }
});

test("双动作 B·转写编辑:录音 -> 转文字 -> 转写中反馈(绝不静默)-> 可打字", async ({ page }) => {
  const pipeline = await connectTestPipeline();
  try {
    await open(page, `/p/${PRJ}/chat`);
    await page.locator("[data-mic-toggle]").click();
    await expect(page.locator("[data-input-region]")).toHaveAttribute("data-input-state", "recording");
    await page.locator("[data-rec-edit]").click();
    // 转写中态:显式等待反馈(dogfood 问题①根修——没有任何静默等待)
    await expect(page.locator("[data-input-region]")).toHaveAttribute("data-input-state", "transcribing");
    await expect(page.locator("[data-transcribing-hint]")).toContainText("转写中");
    const ta = page.locator("[data-confirm-transcript]");
    await expect(ta).toBeVisible(); // 转写中可先打字(后到转写不覆盖)
    await ta.fill("手打的文本");
    await expect(ta).toHaveValue("手打的文本");
  } finally {
    pipeline.close();
  }
});

// ---------- W5a 3.6 产物库控制面(modules/b B4 P1;验收 = 三交互用例) ----------

test("产物控制面①时间线:按 id 分组,版本降序,supersedes 链呈现(v2 接替 v1)", async ({ page }) => {
  await open(page, `/p/${PRJ}/artifacts`);
  const group = page.locator("[data-artifact-groups] [data-version-timeline]").first();
  await expect(group.locator("[data-version-row]")).toHaveCount(2);
  await expect(group.locator("[data-version-row='2']")).toContainText("接替 v1");
  await expect(group.locator("[data-version-row='1']")).toContainText("初版");
  // 降序:v2 行在 v1 行之前
  const rows = await group.locator("[data-version-row]").all();
  expect(await rows[0]?.getAttribute("data-version-row")).toBe("2");
});

test("产物控制面②diff:点对比 v1->v2 出行级差异(add/del 语义行)", async ({ page }) => {
  await open(page, `/p/${PRJ}/artifacts`);
  await page.locator("[data-action=artifact-diff][data-diff-pair='1-2']").click();
  await expect(page.locator("[data-diff-panel]")).toBeVisible({ timeout: 10_000 });
  // fixture v2 新增"大表分页导出"行 + 改写编码行(fixture.ts 定值)
  await expect(page.locator("[data-diff-line=add]").filter({ hasText: "大表分页导出" })).toBeVisible();
  await expect(page.locator("[data-diff-line=del]").filter({ hasText: "UTF-8" }).first()).toBeVisible();
  await page.locator("[data-action=close-diff]").click();
  await expect(page.locator("[data-diff-panel]")).toHaveCount(0);
});

test("产物控制面③子集导出:勾选两版 -> 导出下载 JSON bundle(内容 + digest 在内)", async ({ page }) => {
  await open(page, `/p/${PRJ}/artifacts`);
  await expect(page.locator("[data-action=export-artifacts]")).toBeDisabled(); // 未选中置灰
  await page.locator("[data-export-check$=':1']").check();
  await page.locator("[data-export-check$=':2']").check();
  const downloadP = page.waitForEvent("download");
  await page.locator("[data-action=export-artifacts]").click();
  const download = await downloadP;
  expect(download.suggestedFilename()).toMatch(/^saydo-artifacts-.*\.json$/);
  const tmp = await download.path();
  const bundle = JSON.parse(readFileSync(tmp as string, "utf8")) as {
    kind: string;
    count: number;
    artifacts: { version: number; content: string; digest: string }[];
  };
  expect(bundle.kind).toBe("saydo-artifact-bundle");
  expect(bundle.count).toBe(2);
  expect(bundle.artifacts.some((a) => a.content.includes("大表分页导出"))).toBe(true);
  expect(bundle.artifacts.every((a) => a.digest.startsWith("sha256:"))).toBe(true);
  await expect(page.locator("[data-artifacts-msg]")).toContainText("已导出 2 项");
});
