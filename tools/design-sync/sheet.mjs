// Contact sheet of every downloaded image so the whole asset set can be reviewed at once.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const dir = path.resolve('out/assets/images');
const files = (await fs.readdir(dir)).sort();
const toUrl = (p) => 'file:///' + p.split(path.sep).join('/');

const css = `<style>
body{background:#fff;font:11px Inter,sans-serif;margin:0;padding:8px;display:grid;grid-template-columns:repeat(6,1fr);gap:6px}
figure{margin:0;border:1px solid #ddd;padding:4px;text-align:center}
img{max-width:100%;height:110px;object-fit:contain;background:#f3f3f3;display:block;margin:0 auto}
figcaption{word-break:break-all;font-size:9px;margin-top:3px}
</style>`;

const html = css + files
  .map((f) => `<figure><img src="${toUrl(path.join(dir, f))}"><figcaption>${f}</figcaption></figure>`)
  .join('');

await fs.writeFile('out/sheet.html', html);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.goto(toUrl(path.resolve('out/sheet.html')));
await page.waitForTimeout(1500);
await page.screenshot({ path: 'out/sheet.png', fullPage: true });
await browser.close();
console.log(`${files.length} assets`);
