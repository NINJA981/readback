/* eslint-disable no-console -- command-line script, output is the point */
/**
 * Screenshot helper for design QA.
 *   node scripts/shot.mjs <url> <out.png> [--w 1440] [--h 900] [--scheme dark|light]
 *        [--full] [--reduce] [--wait 1500] [--sel "#stage"] [--dpr 1] [--eval "js"]
 */
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const url = args[0];
const out = args[1];
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext({
  viewport: { width: Number(opt('w', 1440)), height: Number(opt('h', 900)) },
  colorScheme: opt('scheme', 'dark'),
  reducedMotion: flag('reduce') ? 'reduce' : 'no-preference',
  deviceScaleFactor: Number(opt('dpr', 1)),
  hasTouch: flag('touch'),
  isMobile: flag('mobile'),
});
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(Number(opt('wait', 1500)));
const ev = opt('eval', '');
if (ev) {
  const r = await page.evaluate(ev);
  if (r !== undefined) console.log('eval:', JSON.stringify(r));
  await page.waitForTimeout(Number(opt('after', 300)));
}
const sel = opt('sel', '');
if (sel) await page.locator(sel).screenshot({ path: out });
else await page.screenshot({ path: out, fullPage: flag('full') });
for (const l of logs) console.log(l);
await browser.close();
