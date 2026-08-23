import { chromium } from 'playwright';
import { dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const docsUrl = pathToFileURL(resolve(repo, 'deploy/saydo-octoooo-com/en/docs/index.html')).href;
const browser = await chromium.launch();
for (const theme of ['dark','light']) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: theme });
  await page.goto(docsUrl);
  await page.waitForTimeout(800);
  const info = await page.evaluate(() => {
    const de = document.documentElement;
    const s16 = document.querySelector('#s16');
    const appendix = document.querySelector('#appendix');
    const footer = document.querySelector('footer');
    const r = s16.getBoundingClientRect();
    const wide = [];
    document.querySelectorAll('*').forEach(el => {
      const b = el.getBoundingClientRect();
      if (b.width > 391 && !['HTML','BODY'].includes(el.tagName)) wide.push(el.tagName + '.' + String(el.className).slice(0,40) + ' w=' + Math.round(b.width));
    });
    return {
      theme: document.documentElement.dataset.theme || getComputedStyle(document.body).backgroundColor,
      scrollH: de.scrollHeight, scrollW: de.scrollWidth, clientW: de.clientWidth,
      s16top: Math.round(r.top + scrollY), appendixExists: !!appendix, footerExists: !!footer,
      wideEls: wide.slice(0,10), wideCount: wide.length,
    };
  });
  console.log(theme, JSON.stringify(info, null, 1));
  await page.close();
}
await browser.close();
