/* eslint-disable no-console -- a CLI script that reports what it wrote */
/* global chrome -- read inside the extension's service worker */
/**
 * Captures the product UI into docs/screenshots/.
 *
 *   pnpm build && node scripts/screenshots.mjs [filter]
 *
 * Two sources, both real components:
 *  - the gallery (gallery/): every popup, options and overlay state, light and dark,
 *    including states a live browser cannot easily reach;
 *  - the built extension in Chromium: the real content script on the Gmail
 *    fixtures (hover card, ledger, light and dark hosts) at 375, 768 and 1440 px,
 *    plus the real popup and options pages.
 *
 * `filter` limits output to file names containing it.
 */
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'docs', 'screenshots');
const EXTENSION = join(ROOT, '.output', 'chrome-mv3');
const GALLERY = join(ROOT, '.gallery');
const FIXTURES = join(ROOT, 'tests', 'fixtures', 'gmail');
const filter = process.argv[2] ?? '';
const THEMES = ['light', 'dark'];
const WIDTHS = [375, 768, 1440];

const want = (name) => name.includes(filter);
await mkdir(OUT, { recursive: true });

// ---------- gallery ----------

execFileSync(
  process.execPath,
  [join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '-c', 'gallery/vite.config.ts'],
  { cwd: ROOT, stdio: 'ignore' },
);

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
};
const server = createServer((req, res) => {
  const path = (req.url ?? '/').split('?')[0];
  const file = join(GALLERY, path === '/' ? 'index.html' : path);
  if (!file.startsWith(GALLERY) || !existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ channel: 'chromium' });

async function shoot(page, name, { selector, fullPage = false } = {}) {
  if (!want(name)) return;
  const path = join(OUT, `${name}.png`);
  if (selector) await page.locator(selector).first().screenshot({ path, animations: 'disabled' });
  else await page.screenshot({ path, fullPage, animations: 'disabled' });
  console.log('wrote', name);
}

async function galleryPage(width, height, scene, theme, scale = 2) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    colorScheme: theme,
  });
  const page = await context.newPage();
  await page.goto(`${base}?scene=${scene}&theme=${theme}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  return { page, close: () => context.close() };
}

const popupScenes = [
  'reading',
  'reading-clean',
  'idle',
  'idle-no-playground',
  'idle-mail',
  'layout-error',
  'off',
  'selection',
  'checking',
];
for (const theme of THEMES) {
  for (const s of popupScenes) {
    const name = `popup-${s}-${theme}`;
    if (!want(name)) continue;
    const g = await galleryPage(360, 480, `popup:${s}`, theme);
    await shoot(g.page, name, { selector: 'main' });
    await g.close();
  }
}

const optionScenes = ['default', 'filled'];
const optionStates = [
  'model-off',
  'model-loading',
  'model-loading-bar',
  'model-ready',
  'model-error',
  'cleared',
];
for (const theme of THEMES) {
  for (const width of WIDTHS) {
    for (const s of optionScenes) {
      const name = `options-${s}-${width}-${theme}`;
      if (!want(name)) continue;
      const g = await galleryPage(width, 900, `options:${s}`, theme, 1);
      await shoot(g.page, name, { fullPage: true });
      await g.close();
    }
  }
  for (const s of optionStates) {
    const name = `options-${s}-1440-${theme}`;
    if (!want(name)) continue;
    const g = await galleryPage(1440, 900, `options:${s}`, theme, 1);
    await shoot(g.page, name, { fullPage: true });
    await g.close();
  }
}

const overlayScenes = [
  'pill',
  'card-name',
  'card-number',
  'card-date',
  'card-notice',
  'card-above',
  'ledger',
  'ledger-covered',
  'ledger-empty',
  'ledger-overflow',
  'chip',
];
for (const theme of THEMES) {
  for (const s of overlayScenes) {
    const name = `overlay-${s}-${theme}`;
    if (!want(name)) continue;
    const g = await galleryPage(1280, 900, `overlay:${s}`, theme);
    await shoot(g.page, name, { selector: '.stage' });
    await g.close();
  }
}
await browser.close();
server.close();

// ---------- the real extension ----------

if (!existsSync(join(EXTENSION, 'manifest.json'))) {
  console.log('No built extension at .output/chrome-mv3; skipping the live captures.');
  process.exit(0);
}

const userData = await mkdtemp(join(tmpdir(), 'readback-shots-'));
const context = await chromium.launchPersistentContext(userData, {
  channel: 'chromium',
  headless: true,
  deviceScaleFactor: 2,
  args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
});
const [worker] = context.serviceWorkers().length
  ? context.serviceWorkers()
  : [await context.waitForEvent('serviceworker')];
const extensionId = new URL(worker.url()).host;

async function setTheme(theme) {
  await worker.evaluate(async (t) => {
    const settings = (await chrome.storage.local.get('settings')).settings ?? {};
    await chrome.storage.local.set({ settings: { ...settings, theme: t } });
  }, theme);
}

for (const theme of THEMES) {
  await setTheme(theme);
  for (const width of WIDTHS) {
    const options = await context.newPage();
    await options.setViewportSize({ width, height: 900 });
    await options.emulateMedia({ colorScheme: theme });
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    await options.waitForTimeout(400);
    await shoot(options, `live-options-${width}-${theme}`, { fullPage: true });
    await options.close();
  }
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 360, height: 480 });
  await popup.emulateMedia({ colorScheme: theme });
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.waitForTimeout(400);
  await shoot(popup, `live-popup-${theme}`);
  await popup.close();
}

const EDITOR = 'div[g_editable="true"]';
async function gmail(fixtureName, width, height) {
  const html = await readFile(join(FIXTURES, `${fixtureName}.html`), 'utf8');
  await context.unroute('https://mail.google.com/**').catch(() => undefined);
  await context.route('https://mail.google.com/**', (route) =>
    route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }),
  );
  const page = await context.newPage();
  await page.setViewportSize({ width, height });
  await page.goto('https://mail.google.com/mail/u/0/#inbox/18c4a1f2b3d4e5f6');
  await page.locator(EDITOR).click();
  await page.keyboard.press('Control+Home');
  await page.keyboard.type('Hi Catherine,');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('The $1,520 deposit is confirmed.');
  await page.waitForTimeout(400);
  return page;
}

async function slipCentre(page, index) {
  return page.evaluate((i) => {
    const name = [...CSS.highlights.keys()].find(
      (k) => k.startsWith('readback-slip') && !k.includes('active'),
    );
    const range = [...CSS.highlights.get(name)][i];
    const r = range.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, index);
}

async function sendToTab(type) {
  await worker.evaluate(async (t) => {
    const [tab] = await chrome.tabs.query({ url: 'https://mail.google.com/*' });
    await chrome.tabs.sendMessage(tab.id, { type: t });
  }, type);
}

const sizes = { 375: 700, 768: 800, 1440: 900 };
for (const [fixture, tag] of [
  ['inline-reply', 'light'],
  ['theme-dark', 'dark'],
]) {
  for (const width of WIDTHS) {
    const height = sizes[width];
    // Hover card on the name slip.
    if (want(`gmail-card-${width}-${tag}`)) {
      const page = await gmail(fixture, width, height);
      const c = await slipCentre(page, 0);
      await page.mouse.move(c.x - 20, c.y);
      await page.mouse.move(c.x, c.y);
      await page.waitForTimeout(800);
      await shoot(page, `gmail-card-${width}-${tag}`);
      await page.close();
    }
    // Ledger via the Alt+Shift+L command path.
    if (want(`gmail-ledger-${width}-${tag}`)) {
      const page = await gmail(fixture, width, height);
      await sendToTab('open-ledger');
      await page.waitForTimeout(600);
      await shoot(page, `gmail-ledger-${width}-${tag}`);
      await page.close();
    }
  }
}

await context.close();
await rm(userData, { recursive: true, force: true });
