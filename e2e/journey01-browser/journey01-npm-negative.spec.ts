// 反例:fake executor 删掉 npm 只留 pnpm。生产 verify 必须失败,
// 未绑定验收项保持 unknown,真实日志显示失败,任务与通过按钮不得变绿。
// 不直接写数据库证据。scripted LLM + drop-npm 替身,不是云服务。

import "./mode-drop.js";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  assertSeedMatchesRuntime,
  DEMAND,
  EVIDENCE,
  EVIDENCE_ROOT,
  INTERVIEW,
  JOURNEY_MODE,
  JOURNEY_RUN_ID,
  PACKAGE_GO,
  RUNTIME,
  START
} from "./constants.js";

const runtime = JSON.parse(readFileSync(RUNTIME, "utf8")) as {
  token: string;
  sessionId: string;
  projectId: string;
  focusId: string;
  home: string;
};

function apiHeaders(): Record<string, string> {
  return { "x-saydo-token": runtime.token, accept: "application/json" };
}

async function apiJson<T>(page: Page, path: string): Promise<T> {
  const res = await page.request.get(path, { headers: apiHeaders() });
  expect(res.ok(), `${path} ${res.status()}`).toBeTruthy();
  return (await res.json()) as T;
}

function sqlite(sql: string): string {
  return execFileSync("sqlite3", [join(runtime.home, "saydo.db"), sql], { encoding: "utf8" }).trim();
}

async function shot(page: Page, name: string): Promise<string> {
  mkdirSync(join(EVIDENCE, "shots"), { recursive: true });
  const dest = join(EVIDENCE, "shots", `${name}.png`);
  await page.screenshot({ path: dest, fullPage: true });
  return dest;
}

async function openApp(page: Page, hash: string): Promise<void> {
  await page.addInitScript(
    ([sessionId, token]) => {
      localStorage.setItem("saydo.setup.peeked", "1");
      localStorage.setItem("saydo.voice.sessionId", sessionId);
      localStorage.setItem("saydo.capToken", token);
    },
    [runtime.sessionId, runtime.token]
  );
  await page.goto(`/?token=${runtime.token}#${hash}`);
  await page.waitForLoadState("domcontentloaded");
}

async function goHash(page: Page, hash: string): Promise<void> {
  await page.evaluate((h) => {
    window.location.hash = h.startsWith("#") ? h : `#${h}`;
  }, hash);
}

async function sendChat(page: Page, text: string): Promise<void> {
  await expect(page.locator("[data-page=chat]")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-themed-voice-hold]")).toHaveAttribute("data-themed-voice-hold", "0", {
    timeout: 45_000
  });
  const input = page.locator("[data-text-input]");
  await expect(input).toBeEnabled({ timeout: 15_000 });
  await input.fill(text);
  await page.locator("[data-text-send]").click();
}

async function waitAiContains(page: Page, re: RegExp): Promise<void> {
  await expect(page.locator("[data-transcript] [data-who=ai]").filter({ hasText: re })).toBeVisible({
    timeout: 60_000
  });
}

test("删掉 npm 时任务失败,未绑定验收项 unknown 且 UI 不能声称 pass", async ({ page }) => {
  test.setTimeout(240_000);
  assertSeedMatchesRuntime(runtime);
  const seededClaims = sqlite(
    `SELECT COUNT(*) FROM memory_events WHERE readiness_key IN ('goal','acceptance','scope','codebase_understood')`
  );
  expect(Number(seededClaims)).toBe(0);

  await openApp(page, `/focus/${encodeURIComponent(runtime.focusId)}`);
  await expect(page.locator("[data-page=redesign-focus]")).toBeVisible({ timeout: 20_000 });
  await shot(page, "01-focus-entry");
  await page.locator("[data-focus-composer-entry]").click();
  await expect(page.locator("[data-page=chat]")).toBeVisible({ timeout: 20_000 });
  await sendChat(page, DEMAND);
  await waitAiContains(page, /受众是谁/);
  await shot(page, "02-interview-question");
  await sendChat(page, INTERVIEW);
  await expect(page.locator("[data-confirm-card]")).toBeVisible({ timeout: 60_000 });
  await page.locator("[data-confirm-do]").click();
  await waitAiContains(page, /都对上了/);
  await sendChat(page, PACKAGE_GO);
  await waitAiContains(page, /可以开始了/);
  await sendChat(page, START);
  await expect(page.locator("[data-confirm-card]")).toBeVisible({ timeout: 45_000 });
  await page.locator("[data-confirm-do]").click();

  let taskId = "";
  await expect
    .poll(
      async () => {
        const tasks = await apiJson<Array<{ id: string; status: string }>>(
          page,
          `/api/projects/${encodeURIComponent(runtime.projectId)}/tasks`
        );
        const hit = tasks[0];
        if (hit) taskId = hit.id;
        return hit?.status ?? "";
      },
      { timeout: 120_000, intervals: [2_000, 3_000, 5_000] }
    )
    .toBe("failed");
  expect(taskId).toBeTruthy();

  const runRow = sqlite(
    `SELECT id, state, worktree_path FROM tier1_runs WHERE task_id='${taskId}' ORDER BY attempt DESC LIMIT 1`
  );
  const [runId, runState, worktree] = runRow.split("|");
  expect(runState).toBe("settled_failed");
  const readme = readFileSync(join(worktree ?? "", "README.md"), "utf8");
  expect(readme).toContain("pnpm install");
  expect(/(?:^|[^A-Za-z])npm install/.test(readme)).toBe(false);
  const verifyRaw = readFileSync(join(runtime.home, "tier1", "runs", runId ?? "", "verify.json"), "utf8");
  expect(verifyRaw).toContain("[fail] npm install missing");
  expect(verifyRaw).not.toContain("[ok] npm install retained");

  const detail = await apiJson<{
    acceptanceChecks?: Array<{ criterion: string; status: string; evidenceRef?: string }>;
    acceptanceEvidence?: Array<{ ok: boolean; body?: string; evidenceRef: string }>;
  }>(page, `/api/tasks/${encodeURIComponent(taskId)}`);
  const checks = detail.acceptanceChecks ?? [];
  const npmCheck = checks.find((check) => check.criterion === "现有 npm 说明保留");
  expect(npmCheck?.status).toBe("unknown");
  expect(checks.every((check) => check.status !== "pass")).toBe(true);
  const evidence = detail.acceptanceEvidence ?? [];
  expect(evidence.some((row) => row.ok && (row.body ?? "").includes("[fail] npm install missing"))).toBe(true);

  await goHash(page, `/review/${encodeURIComponent(taskId)}`);
  await expect(page.locator(`[data-review-panel="${taskId}"]`)).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-acceptance-status=pass]")).toHaveCount(0);
  const npmItem = page.locator("[data-acceptance-item]", { hasText: "现有 npm 说明保留" });
  await expect(npmItem).toHaveAttribute("data-acceptance-status", "unknown");
  await npmItem.click();
  const shown = page.locator("[data-review-evidence]");
  await expect(shown).toBeVisible();
  const shownText = (await shown.innerText()).trim();
  expect(shownText).toContain("[fail] npm install missing");
  expect(shownText).not.toContain("[ok] npm install retained");
  expect(shownText).not.toContain("验收项:");
  await expect(page.getByRole("button", { name: /^通过$/ })).toBeDisabled();
  await expect(page.getByText("验证没过,这些验收项不能当成通过。")).toBeVisible();
  const after = await apiJson<{ task?: { status?: string } }>(page, `/api/tasks/${encodeURIComponent(taskId)}`);
  expect(after.task?.status).toBe("failed");
  await shot(page, "03-review-fail");

  const shotNames = ["01-focus-entry", "02-interview-question", "03-review-fail"];
  const shots: Record<string, { bytes: number; sha256: string }> = {};
  for (const name of shotNames) {
    const path = join(EVIDENCE, "shots", `${name}.png`);
    expect(existsSync(path), path).toBeTruthy();
    const bytes = readFileSync(path);
    shots[name] = { bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") };
  }
  const identity = {
    journeyRunId: JOURNEY_RUN_ID,
    evidenceRoot: EVIDENCE_ROOT,
    journeyMode: JOURNEY_MODE,
    mode: "drop-npm",
    sessionId: runtime.sessionId,
    projectId: runtime.projectId,
    focusId: runtime.focusId,
    taskId,
    runId,
    runState,
    npmCheck,
    evidenceShowsFail: evidence.some((row) => row.ok && (row.body ?? "").includes("[fail] npm install missing")),
    approveEnabled: false,
    shots
  };
  mkdirSync(EVIDENCE, { recursive: true });
  writeFileSync(join(EVIDENCE, "journey01-browser-identity.json"), `${JSON.stringify(identity, null, 2)}\n`);
});
