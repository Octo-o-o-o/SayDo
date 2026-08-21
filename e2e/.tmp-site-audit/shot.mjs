import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8901';
const OUT = process.env.OUT_DIR || path.resolve('../.tmp/site-audit/shots');

const pages = [
  ['home-zh', '/'],
  ['docs-zh', '/docs/'],
  ['privacy-zh', '/privacy/'],
  ['support-zh', '/support/'],
  ['terms-zh', '/terms/'],
  ['home-en', '/en/'],
  ['docs-en', '/en/docs/'],
  ['privacy-en', '/en/privacy/'],
  ['support-en', '/en/support/'],
  ['terms-en', '/en/terms/'],
];

const viewports = [
  ['desktop', { width: 1440, height: 900 }],
  ['mobile', { width: 390, height: 844 }],
];

const themes = ['light', 'dark'];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
for (const [vname, vsize] of viewports) {
  for (const theme of themes) {
    const ctx = await browser.newContext({
      viewport: vsize,
      deviceScaleFactor: 2,
      colorScheme: theme,
    });
    await ctx.addInitScript((t) => {
      try { localStorage.setItem('saydo.theme', t); } catch (e) {}
    }, theme);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
    for (const [pname, p] of pages) {
      await page.goto(BASE + p, { waitUntil: 'networkidle' });
      // 让滚动入场元素全部显现,保证整页截图完整
      await page.addStyleTag({ content: '[data-reveal]{opacity:1!important;transform:none!important}' });
      await page.waitForTimeout(300);
      const file = path.join(OUT, `${pname}-${vname}-${theme}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log('shot', file);
    }
    await ctx.close();
  }
}
await browser.close();
console.log('done');
