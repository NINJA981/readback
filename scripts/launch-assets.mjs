/* eslint-disable no-console -- a CLI script that reports what it wrote */
/* global chrome -- read inside the extension's service worker */
/**
 * Captures the launch assets into docs/launch/ from the real builds:
 *
 *   pnpm build && pnpm --dir site build && node scripts/launch-assets.mjs
 *
 *  - store-1-name.png, store-2-number.png, store-3-ledger.png: 1280 x 800, the
 *    production extension on "Postwick", a fictional mail client page built from
 *    the synthetic fixture (scripts/launch/mail-client.mjs). Also @2x copies.
 *  - app-phone.png: the web app (/app/?sample=deposit) at 390 x 844.
 *  - social-preview.png: 1280 x 640 for the repository card, built around store-1.
 *  - readback-demo.gif: the type, squiggle, card and fix loop, recorded from the
 *    same extension build.
 *
 * One browser at a time; every context is closed before the next starts.
 * Needs ffmpeg on PATH for the 1x downscale and the GIF.
 */
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { dressAsPostwick } from './launch/mail-client.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'docs', 'launch');
const EXTENSION = join(ROOT, '.output', 'chrome-mv3');
const SITE = join(ROOT, 'site', 'dist');
const FONTS = join(ROOT, 'site', 'src', 'fonts');
const EDITOR = 'div[g_editable="true"]';
const MAIL_URL = 'https://mail.google.com/mail/u/0/#inbox/18c4a1f2b3d4e5f6';

if (!existsSync(join(EXTENSION, 'manifest.json'))) throw new Error('Run pnpm build first.');
if (!existsSync(join(SITE, 'index.html'))) throw new Error('Run pnpm --dir site build first.');
await mkdir(OUT, { recursive: true });
const work = await mkdtemp(join(tmpdir(), 'readback-launch-'));

const ffmpeg = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
const fixture = await readFile(
  join(ROOT, 'tests', 'fixtures', 'gmail', 'inline-reply.html'),
  'utf8',
);
const mailPage = dressAsPostwick(fixture);

// ---------- a static server for the built site, the fonts and the social card ----------
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};
const mounts = [
  ['/_fonts/', FONTS],
  ['/_out/', OUT],
  ['/_work/', work],
  ['/', SITE],
];
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  const [prefix, dir] = mounts.find(([p]) => path.startsWith(p));
  let file = normalize(join(dir, path.slice(prefix.length)));
  if (!file.startsWith(dir)) return res.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const origin = `http://127.0.0.1:${server.address().port}`;

// ---------- the extension on Postwick ----------
async function launch(options = {}) {
  const userData = await mkdtemp(join(tmpdir(), 'readback-launch-profile-'));
  const context = await chromium.launchPersistentContext(userData, {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
    ...options,
  });
  const [worker] = context.serviceWorkers().length
    ? context.serviceWorkers()
    : [await context.waitForEvent('serviceworker')];
  await worker.evaluate(async () => {
    const settings = (await chrome.storage.local.get('settings')).settings ?? {};
    await chrome.storage.local.set({ settings: { ...settings, theme: 'light' } });
  });
  await context.route('https://mail.google.com/**', (route) =>
    route.fulfill({ contentType: 'text/html; charset=utf-8', body: mailPage }),
  );
  const close = async () => {
    await context.close();
    await rm(userData, { recursive: true, force: true });
  };
  return { context, worker, close };
}

const sendToTab = (worker, type) =>
  worker.evaluate(async (t) => {
    const [tab] = await chrome.tabs.query({ url: 'https://mail.google.com/*' });
    await chrome.tabs.sendMessage(tab.id, { type: t });
  }, type);

async function slipPoint(page, text) {
  return page.evaluate((wanted) => {
    for (const name of CSS.highlights.keys()) {
      for (const range of CSS.highlights.get(name)) {
        if (range.toString() === wanted) {
          const r = range.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }
      }
    }
    throw new Error(`no slip "${wanted}"`);
  }, text);
}

async function hover(page, text) {
  const p = await slipPoint(page, text);
  await page.mouse.move(p.x - 40, p.y + 30, { steps: 4 });
  await page.mouse.move(p.x, p.y, { steps: 6 });
  await page.waitForTimeout(900);
}

const REPLY = [
  'Hi Catherine,',
  '',
  "The $1,520 deposit is confirmed, and I'll drop the keys off on Thursday the 10th.",
];

async function openReply(context, delay = 0) {
  const page = await context.newPage();
  await page.goto(MAIL_URL);
  await page.locator(EDITOR).click();
  await page.keyboard.press('Control+Home');
  for (const [i, line] of REPLY.entries()) {
    if (i > 0) await page.keyboard.press('Enter');
    await page.keyboard.type(line, { delay });
  }
  await page.waitForTimeout(500);
  return page;
}

/** Writes name@2x.png from the page and name.png (exactly 1280 x 800) from it. */
async function still(page, name) {
  const big = join(OUT, `${name}@2x.png`);
  await page.screenshot({ path: big });
  ffmpeg(['-i', big, '-vf', 'scale=1280:800:flags=lanczos', join(OUT, `${name}.png`)]);
  console.log('wrote', name);
}

{
  const ext = await launch({ deviceScaleFactor: 2 });
  let page = await openReply(ext.context);
  await hover(page, 'Catherine');
  await still(page, 'store-1-name');
  await page.mouse.move(5, 5);
  await page.waitForTimeout(400);
  await hover(page, '$1,520');
  await still(page, 'store-2-number');
  await page.close();

  page = await openReply(ext.context);
  await sendToTab(ext.worker, 'open-ledger');
  await page.waitForTimeout(700);
  await still(page, 'store-3-ledger');
  await page.close();
  await ext.close();
}

// ---------- the demo GIF: type, squiggle, card, fix ----------
{
  const videoDir = join(work, 'video');
  const ext = await launch({
    deviceScaleFactor: 1,
    recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
  });
  // The persistent context opens with one page; record that one.
  const page = ext.context.pages()[0] ?? (await ext.context.newPage());
  await page.goto(MAIL_URL);
  await page.waitForTimeout(600);
  await page.locator(EDITOR).click();
  await page.keyboard.press('Control+Home');
  await page.keyboard.type('Hi Catherine,', { delay: 70 });
  await page.waitForTimeout(500);
  await hover(page, 'Catherine');
  await page.waitForTimeout(1400);
  await sendToTab(ext.worker, 'next-slip'); // what Alt+Shift+J does: focus the fix
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1800);
  const video = await page.video().path();
  await page.close();
  await ext.close();
  const palette = join(work, 'palette.png');
  // Crop to the thread and the compose, 960 px wide, 12 fps.
  const filters = 'crop=1000:620:240:60,fps=12,scale=960:-1:flags=lanczos';
  ffmpeg(['-i', video, '-vf', `${filters},palettegen=stats_mode=diff`, palette]);
  ffmpeg([
    '-i',
    video,
    '-i',
    palette,
    '-lavfi',
    `${filters}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4`,
    join(OUT, 'readback-demo.gif'),
  ]);
  console.log('wrote readback-demo.gif');
}

// ---------- the web app on a phone, and the social card ----------
{
  const browser = await chromium.launch({ channel: 'chromium' });
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'light',
  });
  const app = await phone.newPage();
  await app.goto(`${origin}/app/?sample=deposit`);
  await app.waitForTimeout(1200);
  // Start the frame at the reply, where the slips are.
  await app.getByRole('heading', { name: 'Your reply' }).evaluate((h) => {
    window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 16);
  });
  await app.waitForTimeout(300);
  await app.screenshot({ path: join(OUT, 'app-phone.png') });
  console.log('wrote app-phone');
  await phone.close();

  await writeFile(join(work, 'social.html'), socialCard(), 'utf8');
  const card = await browser.newContext({ viewport: { width: 1280, height: 640 } });
  const social = await card.newPage();
  await social.goto(`${origin}/_work/social.html`);
  await social.evaluate(() => document.fonts.ready);
  await social.waitForTimeout(300);
  await social.screenshot({ path: join(OUT, 'social-preview.png') });
  console.log('wrote social-preview');
  await card.close();
  await browser.close();
}

server.close();
await rm(work, { recursive: true, force: true });

function socialCard() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Hubot; src: url(/_fonts/hubot-sans.woff2) format("woff2"); font-weight: 200 900; font-stretch: 75% 125%; }
@font-face { font-family: Mona; src: url(/_fonts/mona-sans.woff2) format("woff2"); font-weight: 200 900; font-stretch: 75% 125%; }
* { box-sizing: border-box; }
body { margin: 0; width: 1280px; height: 640px; overflow: hidden; background: #0b0f13; color: #e7eaee;
  font-family: Mona, system-ui, sans-serif; display: grid; grid-template-columns: 520px 1fr; }
.copy { padding: 72px 0 64px 72px; display: flex; flex-direction: column; }
.name { font: 650 22px/1 Hubot; font-stretch: 110%; color: #d9a767; letter-spacing: 0.01em; }
h1 { margin: 36px 0 0; font: 700 52px/1.04 Hubot; font-stretch: 108%; letter-spacing: -0.025em; }
p { margin: 24px 0 0; font-size: 21px; line-height: 1.45; color: #a6afbb; max-width: 400px; }
.foot { margin-top: auto; font-size: 17px; color: #7d8794; }
.shot { position: relative; overflow: hidden; }
.shot img { position: absolute; left: 24px; top: 72px; width: 1100px; border-radius: 14px;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.08), 0 24px 60px rgba(0,0,0,0.5); }
</style></head><body>
<div class="copy">
  <div class="name">Readback</div>
  <h1>Spellcheck that has read the thread.</h1>
  <p>Flags the name, amount or date in your reply that nearly matches the message you're answering.</p>
  <div class="foot">Open source browser extension. Runs on your device.</div>
</div>
<div class="shot"><img src="/_out/store-1-name@2x.png" alt=""></div>
</body></html>`;
}
