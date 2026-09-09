// 生产 hook 的浏览器探针；API 全部由合成 fixture 截获，不连接 daemon。
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const consoleRequire = createRequire(new URL("../../packages/console/package.json", import.meta.url));
const { createServer } = await import(pathToFileURL(consoleRequire.resolve("vite")).href);
const { chromium } = require("@playwright/test");
const html = `<html><body><div id="root"></div><script type="module">
import React from "react";
import { createRoot } from "react-dom/client";
import { useBoardPageData } from "/src/hooks/redesign/useBoardPageData.ts";
function Probe() {
  const state = useBoardPageData();
  return React.createElement("div", null,
    React.createElement("button", { id: "reload", onClick: state.reload }, "刷新探针"),
    React.createElement("pre", { id: "state" }, JSON.stringify({
      loading: state.loading, error: state.error,
      titles: state.view?.groups.map(g => g.focus.title) ?? []
    })));
}
createRoot(document.getElementById("root")).render(React.createElement(Probe));
</script></body></html>`;
const server = await createServer({
  configFile: false,
  root: fileURLToPath(new URL("../../packages/console", import.meta.url)),
  cacheDir: fileURLToPath(new URL("../../node_modules/.astra-gap-vite", import.meta.url)),
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0 },
  plugins: [{ name: "astra-evidence-only", configureServer(s) {
    s.middlewares.use(async (req, res, next) => {
      if (req.url !== "/__astra_probe__.html") return next();
      res.setHeader("Content-Type", "text/html");
      res.end(await s.transformIndexHtml("/__astra_probe__.html", html));
    });
  }}]
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  let generation = 1;
  let failedDetail = null;
  const requests = [];
  const rows = () => Array.from({ length: 20 }, (_, i) => ({
    id: `synthetic-focus-${i}`, title: `focus-${i}-generation-${generation}`,
    lifecycle: "active", currentRevision: generation
  }));
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    if (path === "/api/focuses") return route.fulfill({ json: rows() });
    if (path === "/api/attention") return route.fulfill({ json: { items: [] } });
    const row = rows().find(r => path === `/api/focuses/${r.id}`);
    if (!row) return route.abort();
    if (row.id === failedDetail) return route.fulfill({ status: 400, json: { code: "synthetic_unavailable", message: "synthetic failure" } });
    return route.fulfill({ json: { focus: row, revisions: [], repos: [], obligations: [], lanes: [], events: [], artifacts: [] } });
  });
  const address = server.httpServer.address();
  await page.goto(`http://127.0.0.1:${address.port}/__astra_probe__.html`);
  await page.waitForFunction(() => {
    const el = document.querySelector("#state");
    return el && JSON.parse(el.textContent).loading === false;
  });
  const state = async () => JSON.parse(await page.locator("#state").textContent());
  assert.deepEqual(errors, []);
  const initial = await state();
  assert.equal(initial.titles.length, 20);
  const initialRequests = requests.length;
  assert.equal(initialRequests, 22);
  generation = 2;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForTimeout(2000);
  const afterExternalChange = await state();
  assert.equal(requests.length, initialRequests);
  assert.ok(afterExternalChange.titles.every(t => t.endsWith("generation-1")));
  failedDetail = "synthetic-focus-3";
  await page.locator("#reload").click();
  await page.waitForFunction(() => {
    const s = JSON.parse(document.querySelector("#state").textContent);
    return !s.loading && s.titles.some(t => t.endsWith("generation-2"));
  });
  const partial = await state();
  assert.equal(partial.titles.length, 19);
  assert.equal(partial.error, null);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({
    browser: "headless Chromium", scope: "production hook + synthetic API only",
    initialFocuses: 20, initialRequests, observationMs: 2000,
    automaticRefreshRequests: requests.length - initialRequests - 22,
    retainedOldGeneration: afterExternalChange.titles.every(t => t.endsWith("generation-1")),
    afterOneDetailFailure: { visibleFocuses: partial.titles.length, pageError: partial.error }
  }, null, 2));
} finally {
  if (browser) await browser.close();
  await server.close();
}
