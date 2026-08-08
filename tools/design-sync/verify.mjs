// Drives our own applications in Chromium: walks a route list, captures
// viewport-height slices and a mobile pass, and reports console errors,
// failed requests and horizontal overflow. Usage:
//   BASE=http://localhost:5173 ROUTES=/ NAME=web node verify.mjs
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const NAME = process.env.NAME ?? 'app';
// Routes may be given with or without a leading slash (some shells rewrite it).
const ROUTES = (process.env.ROUTES ?? '/').split(',').map((r) => '/' + r.replace(/^\/+/, ''));
const LOGIN = process.env.LOGIN; // email:password, submitted on the first route
const OUT = path.resolve('out', 'ours', NAME);
await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const problems = [];
page.on('console', (message) => {
  if (message.type() === 'error') problems.push(`console: ${message.text().slice(0, 220)}`);
});
page.on('pageerror', (error) => problems.push(`pageerror: ${error.message.slice(0, 220)}`));
page.on('requestfailed', (request) => {
  const failure = request.failure()?.errorText ?? 'failed';
  problems.push(`request: ${failure} ${request.url().slice(0, 160)}`);
});
page.on('response', (response) => {
  if (response.status() >= 400) problems.push(`http ${response.status()}: ${response.url().slice(0, 160)}`);
});

async function settle() {
  await page.waitForTimeout(700);
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 130));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 350));
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

async function capture(slug) {
  const height = await page.evaluate(() => document.body.scrollHeight);
  const slices = Math.min(Math.ceil(height / 880), 14);
  for (let i = 0; i < slices; i++) {
    await page.screenshot({
      path: path.join(OUT, `${slug}-${String(i).padStart(2, '0')}.png`),
      fullPage: true,
      clip: { x: 0, y: i * 880, width: 1440, height: Math.min(880, height - i * 880) },
    });
  }
  // Anything wider than the viewport means the page scrolls sideways.
  const overflow = await page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth <= docWidth + 1) return null;
    const culprits = [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > docWidth + 2)
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`);
    return { scrollWidth: document.documentElement.scrollWidth, docWidth, culprits };
  });
  if (overflow) problems.push(`overflow ${slug}: ${JSON.stringify(overflow)}`);
  return slices;
}

if (LOGIN) {
  const [email, password] = LOGIN.split(':');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
  await settle();
  await capture('login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
}

for (const route of ROUTES) {
  const slug = route === '/' ? 'home' : route.replace(/^\/|\/$/g, '').replace(/[\/?=&]/g, '-');
  process.stdout.write(`→ ${route} `);
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await settle();
  const slices = await capture(slug);
  console.log(`(${slices} slices)`);
}

// Mobile pass on the first route.
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}${ROUTES[0]}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
await settle();
await page.screenshot({ path: path.join(OUT, 'mobile.png'), fullPage: true });
const mobileOverflow = await page.evaluate(() => {
  const docWidth = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth <= docWidth + 1) return null;
  const culprits = [...document.querySelectorAll('body *')]
    .filter((el) => el.getBoundingClientRect().right > docWidth + 2)
    .slice(0, 8)
    .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 44)}`);
  return { scrollWidth: document.documentElement.scrollWidth, culprits };
});
if (mobileOverflow) problems.push(`overflow mobile@390: ${JSON.stringify(mobileOverflow)}`);

await browser.close();

// Framer's own analytics beacons are not our problem; everything else is.
const real = problems.filter((p) => !/framer|events\.framer|favicon/i.test(p));
console.log(`\n${NAME}: ${real.length ? `${real.length} problem(s)` : 'clean'}`);
for (const problem of [...new Set(real)].slice(0, 40)) console.log('  !', problem);
