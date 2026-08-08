// Re-opens a page and captures it as a stack of viewport-height clips so the
// layout can be read section by section.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const ORIGIN = process.env.TARGET ?? 'https://rido-template.framer.website';
const ROUTE = '/' + (process.env.ROUTE ?? '').replace(/^\/+/, '');
const OUT = path.resolve('out', 'slices', (ROUTE === '/' ? 'home' : ROUTE.replace(/^\/|\/$/g, '').replace(/\//g, '-')));
await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(new URL(ROUTE, ORIGIN).href, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.evaluate(async () => {
  const step = window.innerHeight * 0.8;
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 200));
  }
  window.scrollTo(0, 0);
  await new Promise((r) => setTimeout(r, 500));
});
await page.evaluate(() => document.fonts.ready);
// Hide the Framer badge so it does not sit over the content.
await page.addStyleTag({ content: '#__framer-badge-container,[data-framer-badge]{display:none !important}' });

const height = await page.evaluate(() => document.body.scrollHeight);
const slices = Math.ceil(height / 880);
for (let i = 0; i < slices; i++) {
  await page.screenshot({
    path: path.join(OUT, `${String(i).padStart(2, '0')}.png`),
    fullPage: true,
    clip: { x: 0, y: i * 880, width: 1440, height: Math.min(880, height - i * 880) },
  });
}
await browser.close();
console.log(`${ROUTE}: ${slices} slices, ${height}px tall → ${OUT}`);
