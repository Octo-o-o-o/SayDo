// 双向审计回归:真实浏览器与页面,读口为固定 fixture;不作为真实模型/设备验收。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const runtime = JSON.parse(readFileSync(join(import.meta.dirname, ".runtime.json"), "utf8")) as { token: string };
const focus = { id: "foc_audit", title: "审计回归事项", lifecycle: "active", currentRevision: 1 };

async function open(page: Page, hash: string) {
  await page.addInitScript(() => localStorage.setItem("saydo.setup.peeked", "1"));
  await page.goto(`/?token=${runtime.token}#${hash}`);
}

test("看板与列表保留待验收任务和完整义务,任务可打开", async ({ page }, info) => {
  await page.route("**/api/focuses**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/focuses") return route.fulfill({ json: [focus] });
    if (path === `/api/focuses/${focus.id}`) return route.fulfill({ json: {
      focus, lanes: [], events: [], repos: [], artifacts: [],
      obligations: [
        { id: "fob_a", title: "Agent 在做的安排", owner: "agent", status: "in_progress" },
        { id: "fob_e", title: "等合作方确认", owner: "external", status: "waiting" },
        { id: "fob_s", title: "已收尾的安排", owner: "human", status: "resolved" }
      ],
      tasks: [{ id: "tsk_audit", title: "需要验收的任务", status: "ready_for_review" }]
    } });
    await route.continue();
  });
  await page.route("**/api/attention", (route) => route.fulfill({ json: { items: [] } }));
  await page.route("**/api/tasks/tsk_audit", (route) => route.fulfill({ status: 404, json: { code: "not_found", message: "fixture 只核对打开目标" } }));
  await open(page, "/board");
  await page.getByRole("button", { name: "看板", exact: true }).click();
  const board = page.locator('[data-board-mode="kanban"]');
  await expect(board.locator('[data-kanban-task="tsk_audit"]')).toHaveText("需要验收的任务");
  await expect(board).toContainText("1 件在进行");
  await expect(board).toContainText("等合作方确认");
  await expect(board).toContainText("1 件已收尾");
  await page.screenshot({ path: info.outputPath("board-kanban.png"), fullPage: true });
  await board.locator('[data-kanban-task="tsk_audit"]').click();
  await expect(page).toHaveURL(/#\/review\/tsk_audit$/);
  await expect(page.getByText("验收面加载失败")).toBeVisible();
  await open(page, "/board");
  await page.getByRole("button", { name: "列表", exact: true }).click();
  await expect(page.locator('[data-board-list-row="foc_audit"]')).toContainText("等你 1");
});

for (const mobile of [false, true]) {
  test(`${mobile ? "移动只读" : "桌面"}安排使用 API 的前置标题`, async ({ page }, info) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/api/obligations**", (route) => route.fulfill({ json: [
      { id: "fob_t", focusId: focus.id, focusTitle: focus.title, title: "待任务交付", owner: "human", status: "waiting", kind: "action", blocking: true,
        waitingOnTaskId: "tsk_private", waitingOnTaskTitle: "对账报告", waitingTaskCondition: "delivered", waitingOnObligationId: null, waitingOnObligationTitle: null },
      { id: "fob_o", focusId: focus.id, focusTitle: focus.title, title: "待前置安排", owner: "external", status: "waiting", kind: "action", blocking: false,
        waitingOnTaskId: null, waitingOnTaskTitle: null, waitingOnObligationId: "fob_private", waitingOnObligationTitle: "材料确认" }
    ] }));
    await open(page, mobile ? "/m/arrangements" : "/arrangements");
    const area = page.locator(mobile ? '[data-mobile-page="arrangements"]' : '[data-page="arrangements"]');
    await expect(area).toContainText("等任务「对账报告」");
    await expect(area).toContainText("等「材料确认」");
    await expect(area).not.toContainText("tsk_private");
    await expect(area).not.toContainText("fob_private");
    await page.screenshot({ path: info.outputPath("arrangements.png"), fullPage: true });
  });
}


test("输入法确认 Enter 保留草稿，普通 Enter 才发送", async ({ page }) => {
  const sent: string[] = [];
  page.on("websocket", (socket) => socket.on("framesent", (event) => {
    if (typeof event.payload !== "string") return;
    try {
      const frame = JSON.parse(event.payload);
      if (frame.t === "turn.text") sent.push(frame.text);
    } catch { /* 本用例只观察 JSON 文本帧。 */ }
  }));
  await open(page, "/p/prj_01F1XT0RE0A000000000000000/chat");
  const input = page.locator("[data-text-input]");
  await input.fill("输入法确认测试");
  await expect(page.locator("[data-text-send]")).toBeEnabled();
  for (const event of [{ key: "Enter", isComposing: true }, { key: "Enter", keyCode: 229 }]) {
    await input.dispatchEvent("keydown", event);
    await expect(input).toHaveValue("输入法确认测试");
    expect(sent).toEqual([]);
  }
  await input.press("Enter");
  await expect.poll(() => sent).toEqual(["输入法确认测试"]);
});


test("项目记忆可进入最近记忆，未关联记忆可见且不提供批准按钮", async ({ page }, info) => {
  await page.route("**/api/projects/*/memory", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/memory/recent", (route) => route.fulfill({ json: [
    { id: "mem_audit", tier: "M1", trust: "user_stated", claim: "未关联项目的记忆内容" },
    { id: "mem_candidate", tier: "M2", trust: "candidate", claim: "只读候选记忆" }
  ] }));
  await open(page, "/p/prj_01F1XT0RE0A000000000000000/memory");
  await page.getByRole("link", { name: "查看最近记忆(含未关联项目)" }).click();
  await expect(page).toHaveURL(/#\/memory$/);
  const memory = page.locator('[data-page="memory"]');
  await expect(memory).toContainText("未关联项目的记忆内容");
  await expect(memory).toContainText("只读候选记忆");
  await expect(memory.locator("[data-candidate-actions]")).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("recent-memory.png"), fullPage: true });
});

test("桌面可回看最近会话，刷新后仍可读且与当前输入分开", async ({ page }, info) => {
  let reads = 0;
  await page.route("**/api/sessions/recent-transcript?limit=40", (route) => {
    reads += 1;
    return route.fulfill({ json: { sessionId: "ses_prior", projectId: "prj_prior", turns: [
      { speaker: "user", turnId: "trn_prior", text: "上次说的三件事" },
      { speaker: "ai", turnId: "trn_reply", text: "先把要点记下来" }
    ] } });
  });
  await open(page, "/chat");
  const area = page.locator("[data-recent-conversation]");
  await expect(area).not.toContainText("上次说的三件事");
  await area.getByRole("button", { name: "查看最近对话" }).click();
  await expect(area).toContainText("上次说的三件事");
  await expect(area).toContainText("不会自动加入当前对话");
  await expect(page.locator("[data-text-input]")).toHaveValue("");
  await page.reload();
  await area.getByRole("button", { name: "查看最近对话" }).click();
  await expect(area).toContainText("先把要点记下来");
  expect(reads).toBe(2);
  await page.screenshot({ path: info.outputPath("recent-conversation.png"), fullPage: true });
  await area.getByRole("button", { name: "收起最近对话" }).click();
  await page.route("**/api/sessions/recent-transcript?limit=40", (route) => route.fulfill({ status: 500, json: { error: "fixture" } }));
  await area.getByRole("button", { name: "查看最近对话" }).click();
  await expect(area.getByRole("alert")).toContainText("读取失败");
  await expect(area).not.toContainText("上次说的三件事");
});


test("验收引用缺少成功回执时保持 unknown 并拦通过", async ({ page }) => {
  await page.route("**/api/tasks/tsk_audit_evidence", (route) => route.fulfill({ json: {
    task: { id: "tsk_audit_evidence", title: "缺证回归", status: "ready_for_review", project_type: "coding" },
    package: { acceptance: ["缺回执", "新失败原因"] }, runs: [],
    acceptanceChecks: [
      { criterion: "缺回执", source: "verify", status: "pass", evidenceRef: "verify:missing" },
      { criterion: "新失败原因", source: "verify", status: "pass", evidenceRef: "verify:new" }
    ],
    acceptanceEvidence: [{ evidenceRef: "verify:new", ok: false, reason: "new_failure_reason" }]
  } }));
  await open(page, "/review/tsk_audit_evidence");
  await expect(page.locator('[data-acceptance-status="unknown"]')).toHaveCount(2);
  await expect(page.getByRole("button", { name: "通过", exact: true })).toBeDisabled();
  await expect(page.locator('[data-review-evidence-block="bound_invalid"]')).toBeVisible();
});

test("writing 人工裁决不跨 attempt 继承", async ({ page }) => {
  let attempt = 1;
  await page.route("**/api/tasks/tsk_audit_writing", (route) => route.fulfill({ json: {
    task: { id: "tsk_audit_writing", title: "人工裁决回归", status: "ready_for_review", project_type: "writing" },
    package: { acceptance: ["人工检查"] }, writingProof: { acceptanceChecks: [] },
    runs: [{ id: `run_${attempt}`, attempt, state: "settled_review" }],
    acceptanceChecks: [{ criterion: "人工检查", source: "manual", status: "unknown" }]
  } }));
  await open(page, "/review/tsk_audit_writing");
  await expect(page.getByRole("button", { name: /^通过/ })).toBeDisabled();
  await page.getByRole("button", { name: "这条行", exact: true }).click();
  await expect(page.getByRole("button", { name: "通过", exact: true })).toBeEnabled();
  attempt = 2;
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.getByText("第 2 次尝试", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^通过/ })).toBeDisabled();
  await expect(page.locator('[data-acceptance-status="unknown"]')).toHaveCount(1);
});
