// SC-50 / rereview-3 R3-P2-02(2026-09-25):官网移动端汉堡菜单收起态键盘焦点回归。
// 修复前:收起菜单只靠透明度/transform 视觉隐藏,隐藏 .nav-link 仍进 Tab 序;
// 修复后:theme.js 收起态置 inert + aria-expanded=false,Escape 收拢并把焦点
// 还给菜单按钮;断点回到桌面时清 inert/is-open。
// 本用例直接加载 deploy/saydo-octoooo-com 的真实页面标记、site.css 与 theme.js
// (内联进 setContent,DOMContentLoaded 后初始化与生产一致),在移动视口断言:
//   1) 收起:隐藏导航链接不可聚焦(程序 focus 与键盘 Tab 都进不去);
//   2) 展开:焦点能力恢复,Tab 进入导航;
//   3) Escape:再次收拢,焦点回到菜单按钮,链接重新不可聚焦;
//   4) 桌面断点:导航常显可聚焦,inert 被清除。

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const ROOT = join(import.meta.dirname, "..", "..");
const SITE = join(ROOT, "deploy", "saydo-octoooo-com");

// 真实页面 + 真实样式/脚本:外链资源改为内联,保证 setContent 内联脚本执行时序
// 与生产一致(theme.js 挂 DOMContentLoaded,setContent 走 document.write 语义,
// 解析完成后回调照常触发)。
function siteHtml(): string {
  const css = readFileSync(join(SITE, "site.css"), "utf8");
  const js = readFileSync(join(SITE, "theme.js"), "utf8");
  const html = readFileSync(join(SITE, "docs", "index.html"), "utf8");
  return html
    .replace(/<link rel="stylesheet" href="\/site\.css[^"]*"[^>]*>/, () => `<style>${css}</style>`)
    .replace(/<script[^>]*src="\/theme\.js[^"]*"[^>]*><\/script>/, () => `<script>${js}</script>`);
}

async function loadSite(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 844 });
  await page.goto("/?token=site-nav-focus");
  await page.setContent(siteHtml());
  await page.waitForLoadState("domcontentloaded");
}

async function focusNavLink(page: Page, index: number): Promise<boolean> {
  return page.evaluate((i) => {
    const link = document.querySelectorAll<HTMLAnchorElement>("[data-nav] .nav-link")[i];
    link?.focus();
    return document.activeElement === link;
  }, index);
}

async function activeInsideNav(page: Page): Promise<boolean> {
  return page.evaluate(() => Boolean(document.activeElement?.closest("[data-nav]")));
}

test("SC-50 移动端菜单收起态键盘焦点", async ({ page }) => {
  await loadSite(page, 390);
  const nav = page.locator("[data-nav]");
  const toggle = page.locator("[data-menu-toggle]");

  // 收起:aria-expanded=false + inert;程序 focus 与 Tab 都进不了导航
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(nav).toHaveAttribute("inert", "");
  expect(await focusNavLink(page, 0)).toBe(false);
  for (let i = 0; i < 24; i += 1) {
    await page.keyboard.press("Tab");
    expect(await activeInsideNav(page), `Tab 第 ${i + 1} 步进了收起导航`).toBe(false);
  }

  // 展开:inert 移除,链接恢复可聚焦,Tab 可进入导航
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(nav).not.toHaveAttribute("inert", "");
  await expect(nav).toHaveClass(/is-open/);
  expect(await focusNavLink(page, 0)).toBe(true);

  // Escape:收拢 + 焦点还给菜单按钮 + 链接重新不可聚焦
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(nav).toHaveAttribute("inert", "");
  await expect(toggle).toBeFocused();
  expect(await focusNavLink(page, 0)).toBe(false);
});

test("SC-50 断点回桌面:常显导航可聚焦,inert/is-open 清除", async ({ page }) => {
  await loadSite(page, 1280);
  const nav = page.locator("[data-nav]");
  await expect(nav).not.toHaveAttribute("inert", "");
  await expect(nav).not.toHaveClass(/is-open/);
  expect(await focusNavLink(page, 0)).toBe(true);
});
