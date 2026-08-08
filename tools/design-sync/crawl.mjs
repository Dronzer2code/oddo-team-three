// Pulls the reference design apart: screenshots, computed type/colour tokens and
// every asset the page actually loads. Output lands in ./out.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const ORIGIN = process.env.TARGET ?? 'https://rido-template.framer.website';
const OUT = path.resolve('out');
const SHOTS = path.join(OUT, 'shots');
const ASSETS = path.join(OUT, 'assets');

await fs.mkdir(SHOTS, { recursive: true });
await fs.mkdir(ASSETS, { recursive: true });

const resources = new Map(); // url -> {type, bytes}

async function saveResource(response) {
  const url = response.url();
  const ct = response.headers()['content-type'] ?? '';
  const isFont = /font|\.woff2?|\.ttf|\.otf/.test(ct + url);
  const isImg = /^image\//.test(ct) || /\.(png|jpe?g|webp|avif|svg)(\?|$)/.test(url);
  if (!isFont && !isImg) return;
  if (resources.has(url)) return;
  let body;
  try {
    body = await response.body();
  } catch {
    return;
  }
  const kind = isFont ? 'fonts' : 'images';
  const clean = url.split('?')[0];
  let name = path.basename(clean) || 'asset';
  if (!path.extname(name)) {
    const ext = (ct.split('/')[1] ?? 'bin').split(';')[0];
    name = `${name}.${ext}`;
  }
  const dir = path.join(ASSETS, kind);
  await fs.mkdir(dir, { recursive: true });
  let target = path.join(dir, name);
  let n = 1;
  while (await fs.stat(target).then(() => true).catch(() => false)) {
    const parsed = path.parse(name);
    target = path.join(dir, `${parsed.name}-${n++}${parsed.ext}`);
  }
  await fs.writeFile(target, body);
  resources.set(url, { kind, file: path.relative(OUT, target), bytes: body.length, contentType: ct });
}

const EXTRACT = () => {
  const uniq = (arr) => [...new Set(arr)];
  const nodes = [...document.querySelectorAll('body *')].slice(0, 6000);

  const typeSamples = new Map();
  const colorCount = new Map();
  const bgCount = new Map();
  const radii = new Map();
  const shadows = new Map();
  const bump = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);

  for (const el of nodes) {
    const cs = getComputedStyle(el);
    const text = (el.textContent ?? '').trim();
    const hasOwnText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (hasOwnText && text) {
      const key = [cs.fontFamily, cs.fontSize, cs.fontWeight, cs.lineHeight, cs.letterSpacing, cs.textTransform].join(' | ');
      if (!typeSamples.has(key)) typeSamples.set(key, { key, count: 0, sample: text.slice(0, 70), tag: el.tagName });
      typeSamples.get(key).count++;
      bump(colorCount, cs.color);
    }
    if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') bump(bgCount, cs.backgroundColor);
    if (cs.backgroundImage && cs.backgroundImage !== 'none') bump(bgCount, `IMAGE:${cs.backgroundImage.slice(0, 120)}`);
    if (cs.borderRadius && cs.borderRadius !== '0px') bump(radii, cs.borderRadius);
    if (cs.boxShadow && cs.boxShadow !== 'none') bump(shadows, cs.boxShadow);
  }

  const sorted = (map) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => ({ value: k, count: v }));

  const fontFaces = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of rules ?? []) {
      if (rule.constructor.name === 'CSSFontFaceRule' || rule.cssText?.startsWith('@font-face')) {
        fontFaces.push(rule.cssText);
      }
    }
  }

  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((el) => {
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName,
      text: el.textContent.trim().slice(0, 120),
      font: cs.fontFamily,
      size: cs.fontSize,
      weight: cs.fontWeight,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
      color: cs.color,
    };
  });

  const buttons = [...document.querySelectorAll('a,button')]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.height > 24 && r.width > 40 && el.textContent.trim();
    })
    .slice(0, 40)
    .map((el) => {
      const cs = getComputedStyle(el);
      return {
        text: el.textContent.trim().slice(0, 40),
        bg: cs.backgroundColor,
        color: cs.color,
        radius: cs.borderRadius,
        border: cs.border,
        padding: cs.padding,
        font: `${cs.fontSize}/${cs.fontWeight} ${cs.fontFamily}`,
        letterSpacing: cs.letterSpacing,
      };
    });

  const svgs = [...document.querySelectorAll('svg')].slice(0, 60).map((el) => el.outerHTML.slice(0, 1200));

  const images = [...document.querySelectorAll('img')].map((el) => ({
    src: el.currentSrc || el.src,
    alt: el.alt,
    w: el.naturalWidth,
    h: el.naturalHeight,
    className: el.className,
  }));

  const sections = [...document.querySelectorAll('body > div > div > *, section')].slice(0, 40).map((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName,
      id: el.id,
      height: Math.round(r.height),
      bg: cs.backgroundColor,
      padding: cs.padding,
      text: el.textContent.trim().slice(0, 260).replace(/\s+/g, ' '),
    };
  });

  return {
    title: document.title,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    bodyFont: getComputedStyle(document.body).fontFamily,
    rootVars: (() => {
      const out = {};
      for (const sheet of document.styleSheets) {
        let rules;
        try { rules = sheet.cssRules; } catch { continue; }
        for (const rule of rules ?? []) {
          if (rule.selectorText === ':root' || rule.selectorText === 'html' || rule.selectorText === 'body') {
            for (const prop of rule.style ?? []) if (prop.startsWith('--')) out[prop] = rule.style.getPropertyValue(prop).trim();
          }
        }
      }
      return out;
    })(),
    fontFaces: uniq(fontFaces),
    type: [...typeSamples.values()].sort((a, b) => b.count - a.count).slice(0, 40),
    textColors: sorted(colorCount),
    backgrounds: sorted(bgCount),
    radii: sorted(radii),
    shadows: sorted(shadows),
    headings,
    buttons,
    svgs,
    images,
    sections,
    links: uniq([...document.querySelectorAll('a[href]')].map((a) => a.href)),
    fullText: document.body.innerText,
  };
};

async function settle(page) {
  await page.waitForTimeout(1800);
  // Framer lazy-mounts on scroll; walk the page then return to the top.
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 220));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 600));
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
});
context.on('response', (r) => saveResource(r).catch(() => {}));

const page = await context.newPage();
const report = {};
const visited = new Set();
const queue = ['/'];

while (queue.length) {
  const route = queue.shift();
  if (visited.has(route)) continue;
  visited.add(route);
  const url = new URL(route, ORIGIN).href;
  console.log('→', url);
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  } catch {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    } catch (err) {
      console.log('  failed:', err.message);
      continue;
    }
  }
  await settle(page);
  const data = await page.evaluate(EXTRACT);
  const slug = route === '/' ? 'home' : route.replace(/^\/|\/$/g, '').replace(/\//g, '-');
  await page.screenshot({ path: path.join(SHOTS, `${slug}-desktop-full.png`), fullPage: true });
  await page.screenshot({ path: path.join(SHOTS, `${slug}-desktop-hero.png`) });
  report[route] = data;

  for (const link of data.links) {
    try {
      const u = new URL(link);
      if (u.origin !== ORIGIN) continue;
      const p = u.pathname;
      if (/\.(png|jpe?g|svg|pdf|webp)$/i.test(p)) continue;
      if (!visited.has(p) && !queue.includes(p) && visited.size + queue.length < 14) queue.push(p);
    } catch {}
  }
}

// Mobile pass on the home page only — enough to read the responsive intent.
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(ORIGIN, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
await settle(page);
await page.screenshot({ path: path.join(SHOTS, 'home-mobile-full.png'), fullPage: true });

await browser.close();

await fs.writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
await fs.writeFile(
  path.join(OUT, 'resources.json'),
  JSON.stringify([...resources.entries()].map(([url, meta]) => ({ url, ...meta })), null, 2),
);
console.log(`\nRoutes: ${Object.keys(report).join(', ')}`);
console.log(`Assets saved: ${resources.size}`);
