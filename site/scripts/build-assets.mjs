/* eslint-disable no-console -- command-line script, output is the point */
/**
 * Renders the site's raster assets from the real thing:
 *   - hero posters (public/posters/hero-{wide,narrow}-{dark,light}.avif): the
 *     live hero frozen at t=4600 (`?demo=signature&t=4600&capture=1`), the card
 *     open and the readback line drawn. Each must stay under 80 KB (bible 11.3).
 *   - PWA icons, apple-touch-icon and the 1200x630 Open Graph card.
 *
 *   pnpm build && pnpm preview   (in another shell, port 4173)
 *   node scripts/build-assets.mjs [--posters] [--icons] [--og]
 *
 * Needs Playwright Chromium and ffmpeg (libaom-av1) on PATH.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const pub = join(root, 'public');
const BASE = process.env.SITE_URL ?? 'http://localhost:4173';
const want = (f) => process.argv.length === 2 || process.argv.includes(`--${f}`);

mkdirSync(join(pub, 'posters'), { recursive: true });
mkdirSync(join(pub, 'app', 'icons'), { recursive: true });

const tmp = join(root, 'node_modules', '.cache-assets');
mkdirSync(tmp, { recursive: true });

function avif(png, out, crf) {
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-i',
      png,
      '-c:v',
      'libaom-av1',
      '-crf',
      String(crf),
      '-b:v',
      '0',
      '-still-picture',
      '1',
      '-cpu-used',
      '4',
      out,
    ],
    { stdio: 'inherit' },
  );
  return statSync(out).size;
}

const browser = await chromium.launch({ channel: 'chromium' });

if (want('posters')) {
  const jobs = [
    { name: 'wide', w: 680, h: 560, vw: 1440, vh: 900, tier: 2 },
    { name: 'narrow', w: 343, h: 512, vw: 375, vh: 812, tier: 1 },
  ];
  for (const scheme of ['dark', 'light']) {
    for (const j of jobs) {
      const ctx = await browser.newContext({
        viewport: { width: j.vw, height: j.vh },
        colorScheme: scheme,
        deviceScaleFactor: 2,
      });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/?demo=signature&t=4600&capture=1&tier=${j.tier}`, {
        waitUntil: 'load',
      });
      await page.waitForFunction(() => window.__rbReady === true, null, { timeout: 15000 });
      await page.evaluate((w) => {
        const s = document.getElementById('stage');
        s.style.width = `${w}px`;
        s.style.maxWidth = 'none';
      }, j.w);
      await page.waitForTimeout(600);
      await page.evaluate(() => window.__rb.frame(4600));
      await page.waitForTimeout(300);
      const png = join(tmp, `poster-${j.name}-${scheme}.png`);
      await page.locator('#stage').screenshot({ path: png });
      let crf = 34;
      let out = join(pub, 'posters', `hero-${j.name}-${scheme}.avif`);
      let size = avif(png, out, crf);
      while (size > 80 * 1024 && crf < 50) {
        crf += 3;
        size = avif(png, out, crf);
      }
      console.log(`poster ${j.name}-${scheme}: ${(size / 1024).toFixed(1)} KB (crf ${crf})`);
      await ctx.close();
    }
  }
}

const font = (name) => readFileSync(join(root, 'src', 'fonts', `${name}.woff2`)).toString('base64');
const GLYPH = (stroke, dot) =>
  `<path d="M17 45H34a8 8 0 0 0 8-8V21" fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round"/><circle cx="17" cy="45" r="4.5" fill="${dot}"/><circle cx="42" cy="21" r="4.5" fill="${dot}"/>`;

async function render(html, w, h, out, transparent = false) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out, omitBackground: transparent });
  await page.close();
}

if (want('icons')) {
  const BRASS = '#d9a767';
  const BG = '#0b0f13';
  const svgDoc = (inner, bg, scale = 1) =>
    `<!doctype html><body style="margin:0;background:${bg}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%" style="display:block"><g transform="translate(${32 - 32 * scale} ${32 - 32 * scale}) scale(${scale})">${inner}</g></svg></body>`;
  // "any": rounded slate square, glyph filling it.
  const anyIcon = (size) =>
    `<!doctype html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}"><rect width="64" height="64" rx="14" fill="${BG}"/>${GLYPH(BRASS, BRASS)}</svg></body>`;
  await render(anyIcon(192), 192, 192, join(pub, 'app', 'icons', 'icon-192.png'), true);
  await render(anyIcon(512), 512, 512, join(pub, 'app', 'icons', 'icon-512.png'), true);
  // Maskable: full bleed, glyph inside the central 80% safe zone.
  const maskBg = `<rect width="64" height="64" fill="${BG}"/>`;
  await render(
    svgDoc(maskBg + `<g transform="translate(6.4 6.4) scale(.8)">${GLYPH(BRASS, BRASS)}</g>`, BG),
    512,
    512,
    join(pub, 'app', 'icons', 'maskable-512.png'),
  );
  // Monochrome: one colour on transparent, for themed icons.
  await render(
    `<!doctype html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="512" height="512"><g transform="translate(6.4 6.4) scale(.8)">${GLYPH('#000', '#000')}</g></svg></body>`,
    512,
    512,
    join(pub, 'app', 'icons', 'monochrome-512.png'),
    true,
  );
  // Apple touch icon: opaque, no transparency, no baked rounding (iOS rounds it).
  await render(
    svgDoc(maskBg + `<g transform="translate(4 4) scale(.875)">${GLYPH(BRASS, BRASS)}</g>`, BG),
    180,
    180,
    join(pub, 'apple-touch-icon.png'),
  );
  console.log('icons written');
}

if (want('og')) {
  const html = `<!doctype html><html><head><style>
@font-face{font-family:'Hubot';src:url(data:font/woff2;base64,${font('hubot-sans')}) format('woff2');font-weight:550 700;font-stretch:104% 112%}
@font-face{font-family:'Mona';src:url(data:font/woff2;base64,${font('mona-sans')}) format('woff2');font-weight:400 650}
@font-face{font-family:'Geist';src:url(data:font/woff2;base64,${font('geist-mono')}) format('woff2');font-weight:400 600}
body{margin:0;width:1200px;height:630px;background:radial-gradient(60% 70% at 78% 70%,color-mix(in oklch,oklch(0.76 0.1 72) 7%,transparent),transparent 70%),oklch(0.165 0.01 250);color:oklch(0.94 0.006 250);font-family:Mona;position:relative;overflow:hidden}
h1{position:absolute;left:72px;top:84px;margin:0;width:1080px;font-family:Hubot;font-weight:650;font-size:112px;line-height:.92;letter-spacing:-.035em;font-variation-settings:'wdth' 112}
p{position:absolute;left:72px;top:352px;margin:0;width:640px;font-size:28px;line-height:1.4;font-weight:420;color:oklch(0.8 0.012 250);letter-spacing:-.01em}
.mark{position:absolute;left:72px;bottom:56px;font-size:22px;font-weight:600;display:flex;align-items:center;gap:14px}
.card{position:absolute;right:72px;bottom:72px;width:380px;padding:18px 20px;border-radius:10px;background:oklch(0.235 0.013 250);box-shadow:0 0 0 1px oklch(0.285 0.013 250),0 24px 48px -12px oklch(0 0 0/.6)}
.card b{font-size:26px;font-weight:550;letter-spacing:-.01em;display:block}
.cite{margin-top:12px;padding:10px 12px;border-radius:6px;background:oklch(0.2 0.012 250);font-family:Geist;font-size:20px;color:oklch(0.8 0.012 250)}
.cite u{text-decoration-color:oklch(0.76 0.1 72);text-underline-offset:4px;color:oklch(0.94 0.006 250)}
</style></head><body>
<h1>Spellcheck that read the thread.</h1>
<p>Underlines the name, amount or date in your reply that nearly matches the message you're answering. On your device. Open source.</p>
<div class="mark"><svg width="36" height="36" viewBox="0 0 64 64">${GLYPH('#d9a767', '#d9a767')}</svg>Readback</div>
<div class="card"><b>Signs as Kathryn</b><div class="cite"><u>Kathryn</u></div></div>
</body></html>`;
  await render(html, 1200, 630, join(pub, 'og.png'));
  console.log('og.png written');
}

await browser.close();
writeFileSync(join(tmp, '.stamp'), String(Date.now()));
