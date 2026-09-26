// 同库浏览器 REST/WS 七步:真实 console 页面对同一临时 SQLite 生产 daemon。
// 不 if(count) 跳过,不 transitionTask,不伪造 settle proof,不只导航截图。
// 标注:scripted LLM + FileWriting cursor-agent 替身,不是云服务验收。
// 采访经生产 remember+confirmReadiness 出就绪事实/绑定/包;不预置 critical claims。
// B4 原根因(B4-missing-production-journey-contract / review6 预置就绪)本包只关联,不清零。

import "./mode-keep.js";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  CLAIM,
  DEMAND,
  EVIDENCE,
  EVIDENCE_ROOT,
  INTERVIEW,
  JOURNEY_MODE,
  JOURNEY_RUN_ID,
  MEMORY,
  PACKAGE_GO,
  REUSE,
  RUNTIME,
  START,
  WORKSPACE,
  assertSeedMatchesRuntime
} from "./constants.js";

const runtime = JSON.parse(readFileSync(RUNTIME, "utf8")) as {
  token: string;
  sessionId: string;
  projectId: string;
  focusId: string;
  home: string;
  workspace: string;
  fixture: { model: string; executor: string; note: string };
};

const CRITICAL_KEYS = ["acceptance", "codebase_understood", "goal", "scope"];

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

/** 与 @saydo/contracts jcsDigest({claim}) 同形,避免 Playwright 绑 contracts 运行时。 */
function claimDigestOf(claim: string): string {
  return "sha256:" + createHash("sha256").update(`{"claim":${JSON.stringify(claim)}}`, "utf8").digest("hex");
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

test("浏览器七步:需求→采访→包→正确 receipt→真实执行/证据→验收→记忆下一轮", async ({ page }) => {
  test.setTimeout(240_000);
  mkdirSync(EVIDENCE, { recursive: true });
  assertSeedMatchesRuntime(runtime);
  const ids: Record<string, unknown> = {
    journeyRunId: JOURNEY_RUN_ID,
    evidenceRoot: EVIDENCE_ROOT,
    journeyMode: JOURNEY_MODE,
    sessionId: runtime.sessionId,
    projectId: runtime.projectId,
    focusId: runtime.focusId,
    fixture: runtime.fixture,
    b4_associated_root_cause: "B4-missing-production-journey-contract",
    b4_associated_review6: "review6-B4-seed-rig-preseeded-readiness",
    b4_cleared: false,
    not_run: []
  };

  const seededClaims = sqlite(
    `SELECT COUNT(*) FROM memory_events WHERE readiness_key IN ('goal','acceptance','scope','codebase_understood')`
  );
  expect(Number(seededClaims)).toBe(0);
  const seededBindings = sqlite(
    `SELECT COUNT(*) FROM readiness_bindings WHERE project_id='${runtime.projectId}'`
  );
  expect(Number(seededBindings)).toBe(0);

  await openApp(page, `/focus/${encodeURIComponent(runtime.focusId)}`);
  await expect(page.locator("[data-page=redesign-focus]")).toBeVisible({ timeout: 20_000 });
  await shot(page, "01-focus-entry");
  await page.locator("[data-focus-composer-entry]").click();

  await expect(page.locator("[data-page=chat]")).toBeVisible({ timeout: 20_000 });
  await sendChat(page, DEMAND);
  await waitAiContains(page, /受众是谁/);
  await expect(page.locator("[data-transcript] [data-who=ai]").filter({ hasText: /要不要开始|拍板/ })).toHaveCount(0);
  ids.stepDemand = true;
  await shot(page, "02-interview-question");

  await sendChat(page, INTERVIEW);
  await expect(page.locator("[data-confirm-card]")).toBeVisible({ timeout: 60_000 });
  const readinessPending = sqlite(
    `SELECT kind FROM pending_confirmations WHERE session_id='${runtime.sessionId}'`
  );
  expect(readinessPending).toContain("readiness");
  await page.locator("[data-confirm-do]").click();
  await waitAiContains(page, /都对上了/);
  await expect(page.locator("[data-confirm-card]")).toHaveCount(0, { timeout: 20_000 });
  const boundKeys = sqlite(
    `SELECT key FROM readiness_bindings WHERE project_id='${runtime.projectId}' AND superseded_at IS NULL ORDER BY key`
  )
    .split("\n")
    .filter(Boolean);
  expect(boundKeys).toEqual(CRITICAL_KEYS);
  ids.stepReadinessBound = true;
  ids.readinessKeys = boundKeys;

  await sendChat(page, PACKAGE_GO);
  await waitAiContains(page, /可以开始了/);
  ids.stepInterview = true;
  await shot(page, "03-ready-to-start");

  await expect
    .poll(
      () => sqlite("SELECT id, revision, status FROM decision_packages LIMIT 1"),
      { timeout: 20_000 }
    )
    .toMatch(/pkg_/);

  await sendChat(page, START);
  const card = page.locator("[data-confirm-card]");
  await expect(card).toBeVisible({ timeout: 45_000 });
  const pendingRow = sqlite(
    `SELECT receipt_id, kind, digest FROM pending_confirmations WHERE session_id='${runtime.sessionId}'`
  );
  expect(pendingRow).toContain("dispatch");
  const [receiptId, kind, digest] = pendingRow.split("|");
  expect(kind).toBe("dispatch");
  expect(receiptId && /^[a-z][a-z0-9]{2,3}_[0-9A-HJKMNP-TV-Z]{26}$/.test(receiptId)).toBeTruthy();
  ids.receiptId = receiptId;
  ids.digest = digest;
  await shot(page, "05-confirm-receipt");

  await goHash(page, `/focus/${encodeURIComponent(runtime.focusId)}`);
  await expect(page.locator("[data-page=redesign-focus]")).toBeVisible({ timeout: 20_000 });
  const pkgCard = page.locator("[data-decision-package]");
  await expect(pkgCard).toBeVisible({ timeout: 20_000 });
  await pkgCard.scrollIntoViewIfNeeded();
  const pkgBox = await pkgCard.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { width: r.width, height: r.height, top: r.top, inView: r.height > 80 && r.width > 200 && r.bottom > 0 && r.top < window.innerHeight };
  });
  expect(pkgBox.inView, `包卡不在视口:${JSON.stringify(pkgBox)}`).toBe(true);
  const packageId = await pkgCard.getAttribute("data-decision-package");
  expect(packageId).toBeTruthy();
  ids.packageId = packageId;

  type FocusPkg = {
    id?: string;
    revision?: number;
    outcomePreview?: string;
    acceptance?: unknown;
  };
  let pendingPkg: FocusPkg | undefined;
  await expect
    .poll(
      async () => {
        const detail = await apiJson<{ focus: { id: string }; packages: FocusPkg[] }>(
          page,
          `/api/focuses/${encodeURIComponent(runtime.focusId)}`
        );
        expect(detail.focus.id).toBe(runtime.focusId);
        pendingPkg = (detail.packages ?? []).find((p) => p.id === packageId);
        return pendingPkg ? String(pendingPkg.outcomePreview ?? "") : "";
      },
      { timeout: 20_000 }
    )
    .not.toMatch(/^\s*$/);
  expect(pendingPkg).toBeTruthy();
  expect(Number(pendingPkg?.revision)).toBe(1);
  const outcomeText = (await pkgCard.locator("[data-pkg-outcome]").innerText()).trim();
  expect(outcomeText.length).toBeGreaterThan(0);
  expect(outcomeText).toBe(String(pendingPkg?.outcomePreview ?? "").trim());
  const accItems = pkgCard.locator("[data-pkg-acceptance-item]");
  await expect(accItems).not.toHaveCount(0);
  const accTexts = (await accItems.allInnerTexts()).map((t) => t.trim()).filter(Boolean);
  const apiAcceptance = Array.isArray(pendingPkg?.acceptance)
    ? pendingPkg.acceptance.map((a) => (typeof a === "string" ? a : String(a))).filter(Boolean)
    : [];
  expect(accTexts).toEqual(apiAcceptance);
  expect(accTexts.some((t) => t.includes("pnpm"))).toBe(true);
  ids.revision = 1;
  ids.packageOutcome = outcomeText;
  ids.packageAcceptance = accTexts;
  ids.stepPackage = true;
  mkdirSync(join(EVIDENCE, "shots"), { recursive: true });
  await pkgCard.screenshot({ path: join(EVIDENCE, "shots", "04-decision-package.png") });

  await goHash(page, "/chat");
  await expect(page.locator("[data-confirm-card]")).toBeVisible({ timeout: 20_000 });
  await page.locator("[data-confirm-do]").click();
  await expect(page.locator("[data-confirm-card]")).toHaveCount(0, { timeout: 20_000 });
  ids.stepReceipt = true;

  let taskId = "";
  await expect
    .poll(
      async () => {
        const tasks = await apiJson<Array<{ id: string; status: string; packageId?: string }>>(
          page,
          `/api/projects/${encodeURIComponent(runtime.projectId)}/tasks`
        );
        const hit = tasks.find((t) => t.status === "ready_for_review") ?? tasks[0];
        if (hit) taskId = hit.id;
        return hit?.status ?? "";
      },
      { timeout: 120_000, intervals: [2_000, 3_000, 5_000] }
    )
    .toBe("ready_for_review");
  expect(taskId).toBeTruthy();
  ids.taskId = taskId;

  const task = await apiJson<{
    task?: { id: string; status: string; packageId?: string; packageRev?: number };
    runs?: Array<{ id: string; attempt: number; state: string; treeSha?: string; settleProofJson?: string }>;
  }>(page, `/api/tasks/${encodeURIComponent(taskId)}`);
  expect(task.task?.id).toBe(taskId);
  expect(task.task?.status).toBe("ready_for_review");
  const runRow = sqlite(
    `SELECT id, attempt, state, tree_sha, length(settle_proof_json) FROM tier1_runs WHERE task_id='${taskId}' ORDER BY attempt DESC LIMIT 1`
  );
  const [runId, attempt, runState, treeSha, proofLen] = runRow.split("|");
  expect(runState).toBe("settled_review");
  expect(treeSha).toMatch(/^[0-9a-f]{40}$/);
  expect(Number(proofLen)).toBeGreaterThan(0);
  const treeList = execFileSync("git", ["ls-tree", "-r", "--name-only", treeSha], {
    cwd: WORKSPACE,
    encoding: "utf8"
  });
  expect(treeList).toContain("README.md");
  const readme = execFileSync("git", ["cat-file", "-p", `${treeSha}:README.md`], {
    cwd: WORKSPACE,
    encoding: "utf8"
  });
  const baseReadme = execFileSync("git", ["show", "HEAD:README.md"], { cwd: WORKSPACE, encoding: "utf8" });
  expect(baseReadme).toContain("npm install");
  expect(baseReadme).not.toContain("pnpm install");
  expect(readme).toContain("npm install");
  expect(readme).toContain("pnpm install");
  const verifyPath = join(runtime.home, "tier1", "runs", runId, "verify.json");
  const verifyRaw = readFileSync(verifyPath, "utf8");
  expect(verifyRaw).toContain("[ok] npm install retained");
  expect(verifyRaw).toContain("[ok] pnpm install present");
  expect(verifyRaw).toContain("npm install");
  expect(verifyRaw).toContain("pnpm install");
  ids.runId = runId;
  ids.treeSha = treeSha;
  ids.attempt = Number(attempt);
  ids.settleProofPresent = true;
  ids.stepExecute = true;
  ids.readmeRetainsNpm = true;
  ids.readmeAddsPnpm = true;

  type TaskEvidence = {
    acceptanceChecks?: Array<{ criterion: string; status: string; source: string; evidenceRef?: string }>;
    acceptanceEvidence?: Array<{ evidenceRef: string; ok: boolean; body?: string; reason?: string }>;
  };
  const evidenced = await apiJson<TaskEvidence>(page, `/api/tasks/${encodeURIComponent(taskId)}`);
  const checks = evidenced.acceptanceChecks ?? [];
  expect(checks.length).toBeGreaterThan(0);
  expect(checks.every((check) => check.status !== "pass")).toBe(true);
  expect(checks.every((check) => Boolean(check.evidenceRef?.trim()))).toBe(true);
  const resolved = evidenced.acceptanceEvidence ?? [];
  expect(resolved.every((row) => row.ok === true && (row.body ?? "").includes("[ok] npm install retained"))).toBe(true);
  expect(resolved.every((row) => (row.body ?? "").includes("[ok] pnpm install present"))).toBe(true);
  expect(resolved.every((row) => !(row.body ?? "").includes("验收项:"))).toBe(true);
  expect(resolved.every((row) => !(row.body ?? "").includes(`本轮 run ${runId}`))).toBe(true);

  await goHash(page, `/review/${encodeURIComponent(taskId)}`);
  await expect(page.locator(`[data-review-panel="${taskId}"]`)).toBeVisible({ timeout: 20_000 });
  const items = page.locator("[data-acceptance-item]");
  await expect(items).toHaveCount(checks.length);
  const seenBodies: string[] = [];
  for (let i = 0; i < checks.length; i++) {
    await items.nth(i).click();
    const criterion = await items.nth(i).getAttribute("data-acceptance-criterion");
    const status = await items.nth(i).getAttribute("data-acceptance-status");
    expect(status).not.toBe("pass");
    const check = checks.find((row) => row.criterion === criterion);
    expect(check?.evidenceRef).toBeTruthy();
    const row = resolved.find((item) => item.evidenceRef === check?.evidenceRef);
    expect(row?.ok).toBe(true);
    const evidence = page.locator("[data-review-evidence]");
    await expect(evidence).toBeVisible();
    const evidenceText = (await evidence.innerText()).trim();
    expect(evidenceText).toContain("[ok] npm install retained");
    expect(evidenceText).toContain("[ok] pnpm install present");
    expect(evidenceText).toContain("npm install");
    expect(evidenceText).toContain("pnpm install");
    expect(evidenceText).not.toContain("验收项:");
    expect(evidenceText).not.toContain(`本轮 run ${runId}`);
    expect(evidenceText).not.toMatch(/有证据/);
    const body = (row?.body ?? "").trim();
    expect(evidenceText).toBe(body);
    seenBodies.push(evidenceText);
  }
  ids.reviewEvidenceBodies = seenBodies;
  const evidence = page.locator("[data-review-evidence]");
  expect(await evidence.getAttribute("data-review-tree-sha")).toBe(treeSha);
  expect(await evidence.getAttribute("data-review-run-id")).toBe(runId);
  const evLink = page.locator("[data-review-evidence-link]");
  await expect(evLink).toBeVisible();
  const href = await evLink.getAttribute("href");
  expect(href).toContain(`/task/${taskId}`);
  ids.reviewEvidenceReadable = true;
  await shot(page, "06-review");

  writeFileSync(verifyPath, `${verifyRaw}\n`);
  await page.reload();
  await goHash(page, `/review/${encodeURIComponent(taskId)}`);
  await expect(page.locator(`[data-review-panel="${taskId}"]`)).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-review-approve-blocked]")).toHaveAttribute("data-review-approve-blocked", "1");
  await expect(page.locator("[data-acceptance-evidence=bound_invalid]").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^通过$/ })).toBeDisabled();
  await expect(page.getByText("引用已经对不上")).toBeVisible();
  const rejected = await page.request.post(`/api/tasks/${encodeURIComponent(taskId)}/review`, {
    headers: { ...apiHeaders(), "content-type": "application/json" },
    data: { verdict: "approve", expectedAttempt: Number(attempt) }
  });
  expect(rejected.ok()).toBeFalsy();
  expect(rejected.status()).toBe(409);
  const still = await apiJson<{ task?: { status?: string } }>(page, `/api/tasks/${encodeURIComponent(taskId)}`);
  expect(still.task?.status).toBe("ready_for_review");
  await goHash(page, `/p/${encodeURIComponent(runtime.projectId)}/task/${encodeURIComponent(taskId)}`);
  await expect(page.locator("[data-page=task-detail]")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-action=approve]")).toBeDisabled();
  await expect(page.locator("[data-acceptance-evidence=bound_invalid]").first()).toBeVisible();
  await shot(page, "06b-review-evidence-invalid");

  writeFileSync(verifyPath, verifyRaw);
  await page.reload();
  await goHash(page, `/review/${encodeURIComponent(taskId)}`);
  await expect(page.locator(`[data-review-panel="${taskId}"]`)).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-review-evidence]")).toBeVisible();
  await expect(page.getByRole("button", { name: /^通过$/ })).toBeEnabled();
  await expect(page.getByText(/第\s*[1-9]\s*次尝试/)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /^通过$/ }).click();
  await expect
    .poll(
      async () => {
        const toast = page.locator("[data-toast]");
        if (await toast.count()) return `toast:${(await toast.innerText()).trim()}`;
        const after = await apiJson<{ task?: { status?: string } }>(page, `/api/tasks/${encodeURIComponent(taskId)}`);
        return after.task?.status ?? "";
      },
      { timeout: 30_000 }
    )
    .toMatch(/review_approved|approved|waiting_merge/);
  ids.reviewStatus = "review_approved_waiting_merge";
  ids.stepReview = true;

  await goHash(page, "/chat");
  await sendChat(page, MEMORY);
  await expect(page.locator("[data-confirm-card]")).toBeVisible({ timeout: 45_000 });
  await shot(page, "07-memory-confirm");
  await page.locator("[data-confirm-do]").click();
  await expect(page.locator("[data-confirm-card]")).toHaveCount(0, { timeout: 20_000 });
  const mem = sqlite("SELECT id, trust, claim FROM memory_events WHERE op='add' AND tier='M0' LIMIT 1");
  expect(mem).toContain("user_approved");
  expect(mem).toContain(CLAIM);
  const memId = mem.split("|")[0] ?? "";
  expect(memId.startsWith("mem_")).toBeTruthy();
  const claimDigest = claimDigestOf(CLAIM);
  expect(claimDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
  ids.memId = memId;
  ids.claimDigest = claimDigest;
  ids.stepMemory = true;

  const usesBefore = Number(
    sqlite(`SELECT COUNT(*) FROM context_snapshot_uses WHERE session_id='${runtime.sessionId}'`)
  );
  const llmLogBefore = existsSync(join(runtime.home, "scripted-llm.jsonl"))
    ? readFileSync(join(runtime.home, "scripted-llm.jsonl"), "utf8")
    : "";
  const beforeLines = llmLogBefore.split("\n").filter(Boolean).length;
  await sendChat(page, REUSE);
  await expect
    .poll(
      () => {
        if (!existsSync(join(runtime.home, "scripted-llm.jsonl"))) return 0;
        return readFileSync(join(runtime.home, "scripted-llm.jsonl"), "utf8").split("\n").filter(Boolean).length;
      },
      { timeout: 45_000 }
    )
    .toBeGreaterThan(beforeLines);
  const llmLog = readFileSync(join(runtime.home, "scripted-llm.jsonl"), "utf8");
  const reuseConsumed = llmLog.split("\n").slice(beforeLines).some((line) => {
    if (!line) return false;
    try {
      const row = JSON.parse(line) as { messages?: Array<{ role?: string; content?: unknown }> };
      return (row.messages ?? []).some((m) => m.role === "system" && String(m.content ?? "").includes(CLAIM));
    } catch {
      return false;
    }
  });
  expect(reuseConsumed).toBe(true);

  let latestPack = "";
  await expect
    .poll(() => {
      const n = Number(sqlite(`SELECT COUNT(*) FROM context_snapshot_uses WHERE session_id='${runtime.sessionId}'`));
      latestPack = sqlite(
        `SELECT pack_digest FROM context_snapshot_uses WHERE session_id='${runtime.sessionId}' ORDER BY used_at DESC, rowid DESC LIMIT 1`
      );
      return n;
    }, { timeout: 20_000 })
    .toBeGreaterThan(usesBefore);
  expect(latestPack.startsWith("sha256:")).toBeTruthy();
  const snapBody = sqlite(`SELECT body_json FROM context_snapshots WHERE pack_digest='${latestPack}'`);
  const snap = JSON.parse(snapBody) as { slices?: Array<{ refs?: string[] }> };
  const refs = (snap.slices ?? []).flatMap((s) => s.refs ?? []);
  expect(refs).toContain(memId);
  const useRow = sqlite(
    `SELECT rowid, session_id, pack_digest, used_at, rebuild FROM context_snapshot_uses WHERE session_id='${runtime.sessionId}' AND pack_digest='${latestPack}' ORDER BY rowid DESC LIMIT 1`
  );
  const [useRowid, useSession, usePack, useAt, useRebuild] = useRow.split("|");
  expect(useSession).toBe(runtime.sessionId);
  expect(usePack).toBe(latestPack);
  const transcriptPath = join(runtime.home, "sessions", `${runtime.sessionId}.jsonl`);
  const transcript = existsSync(transcriptPath) ? readFileSync(transcriptPath, "utf8") : "";
  const turns = transcript
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { turnId?: string; ts?: string; speaker?: string; text?: string });
  const reuseTurn = [...turns].reverse().find((turn) => turn.speaker === "user" && String(turn.text ?? "").includes(REUSE));
  expect(reuseTurn?.turnId).toBeTruthy();
  const reuseLine = llmLog
    .split("\n")
    .slice(beforeLines)
    .findIndex((line) => {
      if (!line) return false;
      try {
        const row = JSON.parse(line) as { messages?: Array<{ role?: string; content?: unknown }> };
        return (row.messages ?? []).some((m) => m.role === "system" && String(m.content ?? "").includes(CLAIM));
      } catch {
        return false;
      }
    });
  expect(reuseLine).toBeGreaterThanOrEqual(0);
  const reuseRequest = JSON.parse(llmLog.split("\n").filter(Boolean).slice(beforeLines)[reuseLine] ?? "{}") as {
    messages?: Array<{ role?: string; content?: unknown }>;
  };
  const systemText = (reuseRequest.messages ?? [])
    .filter((m) => m.role === "system")
    .map((m) => String(m.content ?? ""))
    .join("\n");
  ids.reusePackDigest = latestPack;
  ids.identity = {
    memId,
    claim: CLAIM,
    claimDigest,
    memoryEvent: { id: memId, trust: "user_approved", claim: CLAIM },
    snapshotUse: {
      rowid: Number(useRowid),
      session_id: useSession,
      pack_digest: usePack,
      used_at: useAt,
      rebuild: Number(useRebuild)
    },
    snapshotRefs: refs,
    turn: {
      turnId: reuseTurn?.turnId,
      ts: reuseTurn?.ts,
      speaker: reuseTurn?.speaker,
      text: reuseTurn?.text
    },
    llm: {
      lineOffsetAfterMemory: reuseLine,
      systemContainsClaim: systemText.includes(CLAIM),
      systemContainsMemId: systemText.includes(memId),
      systemContainsClaimDigest: systemText.includes(claimDigest)
    }
  };
  ids.nextTurnConsumedClaim = true;
  ids.nextTurnClaimDigest = claimDigest;
  ids.nextTurnSnapshotUse = true;
  ids.stepReuse = true;
  await shot(page, "08-memory-reuse");

  const sameSid = sqlite(
    `SELECT id, project_id, primary_focus_id FROM sessions WHERE id='${runtime.sessionId}'`
  );
  expect(sameSid).toContain(runtime.sessionId);
  expect(sameSid).toContain(runtime.projectId);
  expect(sameSid).toContain(runtime.focusId);

  writeFileSync(join(EVIDENCE, "journey01-browser-identity.json"), `${JSON.stringify(ids, null, 2)}\n`);
  const shots = [
    "01-focus-entry",
    "02-interview-question",
    "03-ready-to-start",
    "04-decision-package",
    "05-confirm-receipt",
    "06-review",
    "07-memory-confirm",
    "08-memory-reuse"
  ];
  for (const name of shots) {
    const p = join(EVIDENCE, "shots", `${name}.png`);
    expect(existsSync(p), p).toBeTruthy();
    ids[`shot_${name}`] = {
      bytes: readFileSync(p).byteLength,
      sha256: createHash("sha256").update(readFileSync(p)).digest("hex")
    };
  }
  writeFileSync(join(EVIDENCE, "journey01-browser-identity.json"), `${JSON.stringify(ids, null, 2)}\n`);
});
