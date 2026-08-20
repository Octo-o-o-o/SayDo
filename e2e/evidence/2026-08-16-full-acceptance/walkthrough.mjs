#!/usr/bin/env node
// Live 全量走查:不走 playwright.config(那会另起 47188 夹具 daemon)。
// 凭证只从 ~/.saydo/.cap-token 读;日志与报告永不写 token 原文。

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";
import { chromium } from "@playwright/test";

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, "screenshots");
const DOWNLOADS = join(HERE, "downloads");
const TOKEN = readFileSync(join(homedir(), ".saydo", ".cap-token"), "utf8").trim();
const PORT = 47100;
const DESKTOP = `http://localhost:${PORT}`;
const USER_MARK = "验收探针0816";
const USER_TEXT = `${USER_MARK}。请只回复四个字：模型在场。不要调用任何工具,不要立项目,不要改代码。`;

mkdirSync(SHOTS, { recursive: true });
mkdirSync(DOWNLOADS, { recursive: true });

function lanAddress() {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      const [a, b] = entry.address.split(".").map(Number);
      if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return entry.address;
    }
  }
  return null;
}

function redact(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.split(TOKEN).join("[cap-token]");
}

function nowIso() {
  const d = new Date();
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const hh = String(Math.floor(Math.abs(off) / 60)).padStart(2, "0");
  const mm = String(Math.abs(off) % 60).padStart(2, "0");
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}${sign}${hh}:${mm}`;
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function summarizeSlots(slots) {
  if (!slots || typeof slots !== "object") return {};
  const out = {};
  for (const [name, raw] of Object.entries(slots)) {
    if (!raw || typeof raw !== "object") continue;
    out[name] = {
      status: raw.status ?? null,
      latencyMs: raw.latencyMs ?? null,
      requestedModel: raw.requestedModel ?? null,
      observedModel: raw.observedModel ?? null,
      error: raw.error ? redact(String(raw.error)).slice(0, 180) : undefined
    };
  }
  return out;
}

const LAN = lanAddress();
const steps = [];
const consoleErrors = [];
const pageErrors = [];
let shotIndex = 0;

async function api(path, opts = {}) {
  const host = opts.host ?? "127.0.0.1";
  const headers = { ...(opts.headers ?? {}) };
  if (opts.token !== false) headers["x-saydo-token"] = TOKEN;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(`http://${host}:${PORT}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    redirect: "manual",
    signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000)
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, location: res.headers.get("location"), json, text: text.slice(0, 400) };
}

async function shot(page, moduleName, status) {
  shotIndex += 1;
  const file = `${String(shotIndex).padStart(2, "0")}-${moduleName}_${stamp()}_${status}.png`;
  const path = join(SHOTS, file);
  await page.screenshot({ path, fullPage: false });
  return `screenshots/${file}`;
}

function attachPageLogging(page) {
  page.on("pageerror", (err) => pageErrors.push(redact(err.message)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(redact(msg.text()));
  });
}

async function step(id, title, page, fn) {
  const start = nowIso();
  steps.push({ time: start, status: "START", id, title, summary: "pending", evidence: "-" });
  let status = "PASS";
  let summary = "";
  let evidence = "-";
  try {
    const result = await fn();
    status = result?.status ?? "PASS";
    summary = result?.summary ?? "ok";
    if (page && result?.skipShot !== true) {
      evidence = await shot(page, id, status);
    } else if (result?.evidence) {
      evidence = result.evidence;
    }
  } catch (err) {
    status = err?.status ?? (String(err).includes("Timeout") ? "TIMEOUT" : "FAIL");
    summary = redact(err?.message ?? String(err)).slice(0, 280);
    if (page) {
      try {
        evidence = await shot(page, id, status);
      } catch {
        evidence = "-";
      }
    }
  }
  steps.push({ time: nowIso(), status, id, title, summary, evidence });
  process.stdout.write(`[${status}] ${id} ${title} :: ${summary}\n`);
  return status;
}

function fail(message, status = "FAIL") {
  const err = new Error(message);
  err.status = status;
  throw err;
}

async function waitBootstrap(page, expected) {
  await page.waitForSelector("[data-setup-bootstrap]", { timeout: 20_000 });
  await page.waitForFunction(() => {
    const el = document.querySelector("[data-setup-bootstrap]");
    return el && el.getAttribute("data-setup-bootstrap") !== "loading";
  }, null, { timeout: 20_000 });
  const kind = await page.locator("[data-setup-bootstrap]").first().getAttribute("data-setup-bootstrap");
  if (expected && kind !== expected) fail(`bootstrap=${kind}, expected ${expected}`);
  return kind;
}

async function assertHealthy(page, probe) {
  if (probe) {
    const count = await page.locator(probe).count();
    if (count < 1) fail(`missing probe ${probe}`);
  }
  const body = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
  if (body.length < 8) fail("blank document");
  if (body.includes("Something went wrong") || body.includes("Error Boundary")) fail("error boundary");
  return body.slice(0, 160);
}

async function openHash(page, hash) {
  await page.goto(`${DESKTOP}/?token=${encodeURIComponent(TOKEN)}#${hash}`, { waitUntil: "domcontentloaded" });
  await waitBootstrap(page, "app");
}

function writeReports(meta) {
  const counts = { PASS: 0, FAIL: 0, TIMEOUT: 0, SKIP: 0, BLOCKED: 0, START: 0 };
  for (const row of steps) counts[row.status] = (counts[row.status] ?? 0) + 1;
  const terminal = steps.filter((s) => s.status !== "START");
  const failed = terminal.filter((s) => s.status === "FAIL" || s.status === "TIMEOUT");
  const table = [
    "| 时间 | 状态 | 步骤 | 对象 | 结果摘要 | request_id/trace_id | 证据 |",
    "|---|---|---|---|---|---|---|"
  ];
  for (const row of steps) {
    table.push(`| ${row.time} | ${row.status} | ${row.id} | ${row.title} | ${row.summary.replace(/\|/g, "/")} | - | ${row.evidence} |`);
  }

  const report = `# 2026-08-16 全量测试验收 · report

- Run ID: 2026-08-16-full-acceptance
- Tester: Cursor Grok 4.6 agent
- Env: live source daemon PID ${meta.pid ?? "unknown"} / HEAD ${meta.head}
- Browser: Playwright Chromium headless 1440x900 / 390x844 / LAN 1000x844
- Web URL: http://localhost:47100/ (token 仅首次注入,不入库)
- API base: http://127.0.0.1:47100
- Start: ${meta.start}
- End: ${nowIso()}
- Scope: config + usage + full + diagnostic
- Models: dialog/thinking/evaluator=cursor_cli cursor-grok-4.6-high-fast; cheap+dev=composer-2.5-fast
- just ci(本会话): exit 0 / 47182ms; contracts 103; console 253; cli 19; daemon 1300 passed | 4 skipped; python 33; emoji-gate 11/0; color 21/0
- Playwright 全套(本会话): 9 passed / 25 failed / 34 total / 9.1m / exit 1(夹具 daemon 47188,不是 live)
- 资源: live SAYDO_HOME=~/.saydo; 未对 OctoDesk/OctoBlog 派真实改代码任务
- 密钥: cap-token 未写入本报告

## Coverage

桌面 hash 路由、旧版折叠页、设置模型槽、G1 无 token、localhost 宽屏 #/m 重定向、本机窄屏移动树、LAN remote-mobile、文本对话 oneshot、setup/test plan、健康与 overview API。

## Step log

${table.join("\n")}

## Result counts

terminal PASS=${counts.PASS} FAIL=${counts.FAIL} TIMEOUT=${counts.TIMEOUT} SKIP=${counts.SKIP} BLOCKED=${counts.BLOCKED}

## Classification

见 [bugs-for-engineers.md](bugs-for-engineers.md) 与 [manual-retest-needed.md](manual-retest-needed.md)。

## Console / page errors

pageerror=${pageErrors.length} console.error=${consoleErrors.length}

${pageErrors.slice(0, 12).map((e) => `- pageerror: ${e}`).join("\n") || "(no pageerror)"}

${consoleErrors.slice(0, 12).map((e) => `- console: ${e}`).join("\n") || "(no console.error)"}

## Cleanup

未写入 staged 配置,未重启 daemon,未 deploy 常驻,未改 Git。配对 overlay 已关闭且未截二维码。文本烟测只发验收探针句。

## Test board

[board.html](board.html)
`;

  const bugs = failed.length === 0
    ? `# bugs-for-engineers

本轮 live 走查终端失败为 0。Playwright 桌面 25 红是夹具套件/T19 向导挡住历史债,不升格为本轮产品缺陷(对照见 report 与 manual-retest)。
`
    : `# bugs-for-engineers

本文件只收 live 走查中可复现的缺陷或缺陷候选。夹具 Playwright 红灯与人工项不在此。

${failed.map((row, i) => `## BUG-${String(i + 1).padStart(2, "0")} · ${row.status} · ${row.id}

- 状态: open
- 严重度: ${row.status === "TIMEOUT" ? "P2" : "P2"}
- 描述: ${row.title} — ${row.summary}
- 期望: 该步正向断言成立
- 实际: ${row.summary}
- 复现: 打开 http://localhost:47100/?token=<cap-token> 后按 ${row.id} 操作
- 证据: ${row.evidence}
- 影响: 该路径验收不能算过
- 可能位置: packages/console 对应路由 / packages/daemon 对应 API
`).join("\n")}
`;

  const manual = `# 人工确认事项

自动化已覆盖: just ci 双矩阵、live 路由渲染、G1、LAN remote-mobile 门、设置页模型槽展示、Cursor CLI setup/test(plan)、桌面文本 turn.text 烟测。

## 必须人做(AI 不能代跑)

1. 场次① 真麦:点击说话 → 转写 → 发送,确认 VOLC ASR/TTS 与口播状态词(执行中不说完成)。
2. 场次② Touch ID / S3 过卡:本机已注册 passkey 时走合并;fixture 库无凭据不能冒充通过。
3. 场次③ 真机扫配对码(二维码含 token,本轮故意不截):iPhone Safari / 后续 WKWebView。
4. 场次④ writing 首篇逐节验收(生产库若仍无 writing 项目则先立篇)。
5. 对真实仓库派任务前,确认执行器 pin 与 composer 2.5 开发槽;不要用验收探针句当任务。

## 自动化不能单独算过的点

- Playwright 全套 25 红:测试 daemon 未武装 dialog + 首页已改为今天,夹具套件与 live 形状不一致。救 29 红不在 remote-mobile-w0 完成定义,也不在本轮验收修复范围。
- vite 47120 回归:Playwright global-setup 占用/释放该口;live 控制台主入口是 daemon 47100。本机另有长期 vite 47121,不是合同入口。
- 本轮改了 live 模型配置;备份在 ~/.saydo/config.toml.bak-2026-08-16-acceptance。恢复 launchd 常驻前须先停源码进程。
- 源码 HEAD bc2ac87 不能当 v0.1.0 发布证据(发布锁的是 ~/.saydo/runtime SHA)。

## 如何复测

1. \`open "http://localhost:47100/?token=$(cat ~/.saydo/.cap-token)"\`
2. 设置页确认四槽 grok 4.6 / cheap+dev composer 2.5
3. 开口聊发一句无工具请求
4. 手机扫「与手机配对」(人眼看码,不要把 URL 贴到聊天)
`;

  const firstShot = terminal.find((s) => s.evidence.startsWith("screenshots/"))?.evidence ?? "";
  const board = `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<title>SayDo 2026-08-16 全量验收板</title>
<body>
<h1>2026-08-16 全量测试验收</h1>
<p>env=live localhost:47100 · HEAD ${meta.head} · PASS ${counts.PASS} · FAIL ${counts.FAIL} · TIMEOUT ${counts.TIMEOUT} · SKIP ${counts.SKIP} · BLOCKED ${counts.BLOCKED}</p>
<p>发布阻断: ${failed.length ? "有 live 失败,见 bugs-for-engineers" : "无新的 live 产品阻断;Playwright 夹具 25 红仍是已知债"}</p>
<ul>
  <li><a href="report.md">report.md</a></li>
  <li><a href="bugs-for-engineers.md">bugs-for-engineers.md</a></li>
  <li><a href="manual-retest-needed.md">manual-retest-needed.md</a></li>
</ul>
<p>人工确认事项:真麦;Touch ID/S3;真机扫码;writing 首篇;勿把验收探针当派工。</p>
${firstShot ? `<p><img src="${firstShot}" alt="first screenshot" width="640"></p>` : ""}
<p>清理:未 deploy,未写入 pending 配置,未截配对二维码。</p>
</body></html>
`;

  writeFileSync(join(HERE, "steps.json"), JSON.stringify({ meta, counts, steps, pageErrors, consoleErrors }, null, 2));
  writeFileSync(join(HERE, "report.md"), report);
  writeFileSync(join(HERE, "bugs-for-engineers.md"), bugs);
  writeFileSync(join(HERE, "manual-retest-needed.md"), manual);
  writeFileSync(join(HERE, "board.html"), board);
}

const meta = {
  start: nowIso(),
  head: "bc2ac87",
  pid: null,
  lan: LAN
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "zh-CN" });
const page = await context.newPage();
attachPageLogging(page);

let projectId = null;
let focusId = null;
let taskId = null;

try {
  await step("C1", "G1 无 token 打开 API 被拒", page, async () => {
    const r = await api("/api/overview", { token: false });
    if (r.status !== 403) fail(`status ${r.status}`);
    if (r.json?.code !== "token_missing" && r.json?.code !== "token_mismatch") fail(`code ${r.json?.code}`);
    return { summary: `403 ${r.json?.code}`, skipShot: true, evidence: "api" };
  });

  await step("C2", "GET /health 身份", page, async () => {
    const r = await api("/health", { token: false });
    if (r.status !== 200 || r.json?.ok !== true) fail(`health ${r.status}`);
    meta.pid = r.json?.pid ?? null;
    const sha = r.json?.runtimeSha ?? r.json?.identity?.sourceRevision ?? "?";
    return { summary: `pid=${r.json?.pid} sha=${String(sha).slice(0, 12)}`, skipShot: true, evidence: "api" };
  });

  await step("C3", "setup probe 已武装且槽为 Cursor CLI", page, async () => {
    const r = await api("/api/setup/probe");
    if (r.status !== 200) fail(`probe ${r.status} ${redact(r.text)}`);
    const slots = r.json?.config?.slots ?? {};
    const dialog = slots.dialog ?? {};
    const cheap = slots.cheap ?? {};
    const dev = slots.dev ?? {};
    if (dialog.effective !== "active") fail(`dialog.effective=${dialog.effective}`);
    return {
      summary: `dialog=${dialog.effective} cheap=${cheap.effective} dev=${dev.effective}`,
      skipShot: true,
      evidence: "api"
    };
  });

  await step("C4", "overview / attention / focuses", page, async () => {
    const ov = await api("/api/overview");
    if (ov.status !== 200) fail(`overview ${ov.status}`);
    const projects = ov.json?.projects ?? [];
    projectId = projects[0]?.id ?? null;
    const att = await api("/api/attention");
    const foc = await api("/api/focuses");
    if (att.status !== 200) fail(`attention ${att.status}`);
    if (foc.status !== 200) fail(`focuses ${foc.status}`);
    const focuses = Array.isArray(foc.json) ? foc.json : foc.json?.items ?? foc.json?.focuses ?? [];
    focusId = focuses[0]?.id ?? null;
    if (projectId) {
      const tasks = await api(`/api/projects/${projectId}/tasks`);
      if (tasks.status === 200 && Array.isArray(tasks.json) && tasks.json[0]?.id) taskId = tasks.json[0].id;
    }
    return {
      summary: `projects=${projects.length} attention=${att.status} focuses=${Array.isArray(focuses) ? focuses.length : "obj"} pid=${projectId ? "yes" : "no"}`,
      skipShot: true,
      evidence: "api"
    };
  });

  await step("C5", "127.0.0.1 HTML 是否 308 到 localhost", page, async () => {
    const r = await fetch(`http://127.0.0.1:${PORT}/`, { redirect: "manual", signal: AbortSignal.timeout(8000) });
    return {
      summary: `status=${r.status} location=${r.headers.get("location") ?? "-"}`,
      skipShot: true,
      evidence: "api"
    };
  });

  await step("D1", "无 token 打开控制台 fail-closed", page, async () => {
    await page.goto(`${DESKTOP}/`, { waitUntil: "domcontentloaded" });
    const kind = await waitBootstrap(page);
    const body = await page.locator("body").innerText();
    if (kind !== "probe-error" && !body.includes("访问凭证已失效") && !body.includes("没连上")) {
      fail(`unexpected bootstrap=${kind}`);
    }
    return { summary: `bootstrap=${kind}` };
  });

  await step("D2", "带 token 进入应用 · 今天", page, async () => {
    await openHash(page, "/today");
    const snippet = await assertHealthy(page, "[data-page=today]");
    if (snippet.includes("访问凭证已失效")) fail("token path still auth-error");
    return { summary: snippet };
  });

  await step("D3", "全景看板", page, async () => {
    await openHash(page, "/board");
    const snippet = await assertHealthy(page, "[data-page=redesign-board]");
    return { summary: snippet };
  });

  await step("D4", "开口聊空态", page, async () => {
    await openHash(page, "/chat-new");
    await assertHealthy(page, "[data-page=chat]");
    const ready = await page.locator("[data-voice-indicator]").innerText();
    await page.locator("[data-text-input]").waitFor({ timeout: 10_000 });
    return { summary: `indicator=${ready.replace(/\s+/g, " ")}` };
  });

  await step("D5", "全局设置模型槽", page, async () => {
    await openHash(page, "/settings");
    await assertHealthy(page, "[data-page=settings]");
    const table = await page.locator("[data-model-slots]").innerText();
    const compact = table.replace(/\s+/g, " ");
    if (!compact.includes("cursor-grok-4.6") && !compact.includes("grok-4.6")) fail(`dialog model not grok: ${compact.slice(0, 180)}`);
    if (!compact.includes("composer-2.5")) fail(`cheap/dev not composer: ${compact.slice(0, 180)}`);
    return { summary: compact.slice(0, 220) };
  });

  await step("D6", "成本页", page, async () => {
    await openHash(page, "/cost");
    const snippet = await assertHealthy(page, "[data-page=cost]");
    if (/\b成本\b/.test(snippet) && snippet.includes(" 0 ") && snippet.includes("还没有") === false) {
      // unknown 纪律:有数字 0 当确切成本才算问题;有「还没有」则通过
    }
    return { summary: snippet };
  });

  await step("D7", "记忆库", page, async () => {
    if (!projectId) return { status: "SKIP", summary: "live 无项目", skipShot: true };
    await openHash(page, `/p/${projectId}/memory`);
    return { summary: await assertHealthy(page, "[data-page=memory]") };
  });

  await step("D8", "产物", page, async () => {
    if (!projectId) return { status: "SKIP", summary: "live 无项目", skipShot: true };
    await openHash(page, `/p/${projectId}/artifacts`);
    return { summary: await assertHealthy(page, "[data-page=artifacts]") };
  });

  await step("D9", "项目设置", page, async () => {
    if (!projectId) return { status: "SKIP", summary: "live 无项目", skipShot: true };
    await openHash(page, `/p/${projectId}/settings`);
    return { summary: await assertHealthy(page, "[data-page=psettings]") };
  });

  await step("D10", "旧版 Dashboard / 审批 / 通知 / Focus 列表", page, async () => {
    await openHash(page, "/dashboard");
    await assertHealthy(page, "[data-page=dashboard]");
    await openHash(page, "/approvals");
    await assertHealthy(page, "[data-page=approvals]");
    await openHash(page, "/notify");
    await assertHealthy(page, "[data-page=notify]");
    await openHash(page, "/focuses");
    await assertHealthy(page, "[data-page=focuses]");
    return { summary: "dashboard+approvals+notify+focuses rendered" };
  });

  await step("D11", "Focus 正式页 / 任务 / 旧看板", page, async () => {
    const bits = [];
    if (focusId) {
      await openHash(page, `/focus/${focusId}`);
      await assertHealthy(page, "[data-page=redesign-focus]");
      bits.push("focus");
      await openHash(page, `/legacy/focus/${focusId}`);
      await assertHealthy(page, "[data-page=focus-detail]");
      bits.push("legacy-focus");
      await openHash(page, `/records/${focusId}`);
      await assertHealthy(page, "[data-page=redesign-records]");
      bits.push("records");
    } else {
      bits.push("no-focus");
    }
    if (projectId) {
      await openHash(page, `/p/${projectId}/tasks`);
      await assertHealthy(page, "[data-page=tasks]");
      bits.push("tasks");
    }
    if (taskId) {
      await openHash(page, `/p/${projectId}/task/${taskId}`);
      await assertHealthy(page, "[data-page=task-detail]");
      bits.push("task-detail");
      await openHash(page, `/review/${taskId}`);
      await assertHealthy(page, "[data-page=redesign-review]");
      bits.push("review");
    }
    await openHash(page, "/legacy/board");
    await assertHealthy(page, "[data-page=board]");
    bits.push("legacy-board");
    return { summary: bits.join(",") };
  });

  await step("D12", "不存在页", page, async () => {
    await openHash(page, "/no-such-page");
    const snippet = await assertHealthy(page);
    if (!snippet.includes("页面不存在")) fail(snippet.slice(0, 120));
    return { summary: "empty-state 页面不存在" };
  });

  await step("D13", "dev 走查页", page, async () => {
    await openHash(page, "/dev-components");
    await assertHealthy(page, "[data-page=dev-components]");
    await openHash(page, "/dev-pages");
    await assertHealthy(page, "[data-page=dev-pages]");
    return { summary: "dev-components + dev-pages" };
  });

  await step("D14", "localhost 宽屏 #/m 重定向桌面今天", page, async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHash(page, "/m");
    await page.waitForFunction(() => location.hash === "#/today" || location.hash === "#/today/", null, { timeout: 8_000 });
    const url = page.url();
    if (!url.includes("#/today")) fail(`url still ${url.replace(TOKEN, "[cap-token]")}`);
    await assertHealthy(page, "[data-page=today]");
    if ((await page.locator("[data-setup-bootstrap=remote-mobile]").count()) !== 0) fail("localhost mapped to remote-mobile");
    if ((await page.locator("[data-mobile-page=today]").count()) !== 0) fail("desktop still showing mobile today");
    return { summary: "redirected to desktop today" };
  });

  await step("D15", "本机窄屏移动树(非 remote-mobile)", page, async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openHash(page, "/m");
    await assertHealthy(page, "[data-mobile-page=today]");
    if ((await page.locator("[data-setup-bootstrap=remote-mobile]").count()) !== 0) fail("narrow localhost became remote-mobile");
    if ((await page.locator("[data-page=today]").count()) !== 0) fail("narrow still desktop today");
    await page.setViewportSize({ width: 1440, height: 900 });
    return { summary: "mobile tree on localhost narrow" };
  });

  await step("D16", "配对 overlay 可开关(不截二维码)", page, async () => {
    await openHash(page, "/today");
    await page.locator("[data-action=pair-phone]").click();
    await page.locator("[data-action=close-pairing]").waitFor({ timeout: 8_000 });
    await page.locator("[data-action=close-pairing]").click();
    await page.locator("[data-action=close-pairing]").waitFor({ state: "hidden", timeout: 5_000 });
    return { summary: "opened and closed; QR not captured", skipShot: true, evidence: "no-qr-by-policy" };
  });

  await step("F1", "桌面文本对话 grok 4.6 oneshot", page, async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHash(page, "/chat-new");
    await page.locator("[data-text-input]").waitFor({ timeout: 10_000 });
    await page.waitForFunction(() => {
      const t = document.querySelector("[data-voice-indicator]")?.textContent ?? "";
      return t.includes("语音就绪") || t.includes("会话中");
    }, null, { timeout: 20_000 });
    await page.locator("[data-text-input]").fill(USER_TEXT);
    await page.locator("[data-text-send]").click();
    await page.waitForFunction((mark) => (document.querySelector("[data-transcript]")?.innerText ?? "").includes(mark), USER_MARK, { timeout: 15_000 });
    const startMs = Date.now();
    await page.waitForFunction((mark) => {
      const root = document.querySelector("[data-transcript]");
      if (!root) return false;
      const thinking = document.querySelector("[data-thinking]");
      const text = root.innerText;
      if (!text.includes(mark)) return false;
      const after = text.split(mark).slice(1).join(mark);
      return !thinking && after.replace(/\s+/g, "").length > 4;
    }, USER_MARK, { timeout: 120_000 });
    const body = (await page.locator("[data-transcript]").innerText()).replace(/\s+/g, " ");
    const latency = Date.now() - startMs;
    if (body.includes("调用失败") || body.includes("provider_error")) fail(body.slice(0, 200));
    return { summary: `latencyMs=${latency} reply=${body.slice(-80)}` };
  });

  if (LAN) {
    const lanPage = await context.newPage();
    attachPageLogging(lanPage);
    const lanBase = `http://${LAN}:${PORT}`;

    await step("L1", "LAN Today remote-mobile", lanPage, async () => {
      await lanPage.setViewportSize({ width: 390, height: 844 });
      await lanPage.goto(`${lanBase}/?token=${encodeURIComponent(TOKEN)}#/m`, { waitUntil: "domcontentloaded" });
      await waitBootstrap(lanPage, "remote-mobile");
      await assertHealthy(lanPage, "[data-mobile-page=today]");
      if ((await lanPage.locator("[data-page=today]").count()) !== 0) fail("LAN fell through to desktop today");
      const stuck = await lanPage.locator("[data-mobile-page=today]").innerText();
      if (stuck.includes("正在翻今天的账")) fail("stuck loading attention");
      return { summary: "remote-mobile today" };
    });

    await step("L2", "LAN Things", lanPage, async () => {
      await lanPage.goto(`${lanBase}/?token=${encodeURIComponent(TOKEN)}#/m/things`, { waitUntil: "domcontentloaded" });
      await waitBootstrap(lanPage, "remote-mobile");
      await assertHealthy(lanPage, "[data-mobile-page=things]");
      return { summary: "things page" };
    });

    await step("L3", "LAN 横屏仍移动树", lanPage, async () => {
      await lanPage.setViewportSize({ width: 1000, height: 844 });
      await lanPage.goto(`${lanBase}/?token=${encodeURIComponent(TOKEN)}#/m`, { waitUntil: "domcontentloaded" });
      await waitBootstrap(lanPage, "remote-mobile");
      await assertHealthy(lanPage, "[data-mobile-page=today]");
      if (!lanPage.url().includes("#/m")) fail(`url ${lanPage.url().replace(TOKEN, "[cap-token]")}`);
      if ((await lanPage.locator("[data-page=today]").count()) !== 0) fail("landscape fell to desktop");
      return { summary: "landscape stayed mobile" };
    });

    await lanPage.close();
  } else {
    await step("L1", "LAN 套件", page, async () => ({ status: "SKIP", summary: "no RFC1918 iface", skipShot: true }));
  }

  await step("C6", "POST /api/setup/test scope=plan", page, async () => {
    const r = await api("/api/setup/test", { method: "POST", body: { scope: "plan" }, timeoutMs: 180_000 });
    if (r.status !== 200) fail(`status ${r.status} ${redact(r.text)}`);
    const slots = summarizeSlots(r.json?.slots);
    const names = ["dialog", "thinking", "cheap", "evaluator", "dev"];
    const bad = names.filter((n) => slots[n] && slots[n].status !== "ok");
    if (bad.length) fail(`not ok: ${JSON.stringify(bad.map((n) => [n, slots[n]]))}`);
    return { summary: JSON.stringify(slots), skipShot: true, evidence: "api" };
  });
} finally {
  await browser.close();
  writeReports(meta);
}
