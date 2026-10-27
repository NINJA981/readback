/**
 * Parity: the web app (site/dist, served locally) and the extension (the real content script on
 * a plain page) read the same thread text and the same reply, and must produce the same result:
 * the same slips with the same messages and fixes, the same ask count, and the same repaired text
 * after the primary fix is applied to every slip. The six sample threads are the fixtures.
 *
 * Both sides take the "paste or select the message yourself" route: no sender or recipients are
 * known to either, so the only difference between them is the surface around the engine.
 */
import { existsSync } from 'node:fs';
import type { BrowserContext, Locator, Page, Worker } from '@playwright/test';
import { SAMPLES } from '../site/src/shared/samples';
import { expect, test } from './fixtures';
import { SITE_DIST, serveStatic } from './site-server';
import type { StaticServer } from './site-server';

declare const chrome: {
  tabs: {
    query(q: object): Promise<{ id: number }[]>;
    sendMessage(id: number, m: object): Promise<unknown>;
  };
  scripting: { executeScript(o: object): Promise<unknown> };
};

interface Observed {
  /** Each slip as "message | primary fix", sorted. */
  slips: string[];
  /** The ask pill's wording right after the reply is typed, before any fix. */
  pill: string;
  /** The reply after the primary fix has been applied to every slip. */
  repaired: string;
}

const GENERIC_URL = 'https://mail.google.com/generic';
const PAGE = (
  thread: string,
): string => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Parity page</title></head><body>
<pre id="message" style="font:16px/24px Arial,sans-serif;white-space:pre-wrap;width:560px"></pre>
<textarea id="reply" aria-label="Reply" style="display:block;width:560px;height:200px;font:16px/24px Arial,sans-serif;padding:8px 10px"></textarea>
<script>document.getElementById('message').textContent = ${JSON.stringify(thread)};</script>
</body></html>`;

/** Waits until a locator's count has stopped changing for 400 ms, then returns it. */
async function settledCount(locator: Locator): Promise<number> {
  let last = -1;
  let since = Date.now();
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const n = await locator.count();
    if (n !== last) {
      last = n;
      since = Date.now();
    } else if (n > 0 && Date.now() - since >= 400) {
      return n;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`the list never settled (last count ${last})`);
}

async function viaExtension(
  context: BrowserContext,
  worker: Worker,
  thread: string,
  draft: string,
  expectedSlips: number,
  expectedPill: string,
): Promise<Observed> {
  await context.route(GENERIC_URL, (route) =>
    route.fulfill({ contentType: 'text/html; charset=utf-8', body: PAGE(thread) }),
  );
  const page = await context.newPage();
  await page.goto(GENERIC_URL);
  await worker.evaluate(async (message) => {
    const [tab] = await chrome.tabs.query({ url: 'https://mail.google.com/generic' });
    await chrome.scripting.executeScript({
      target: { tabId: tab!.id },
      files: ['/content-scripts/selection.js'],
    });
    await chrome.tabs.sendMessage(tab!.id, { type: 'use-selection', text: message });
  }, thread);
  await expect(page.locator('readback-overlay .rb-chip')).toContainText('Context: ');
  await page.locator('#reply').click();
  await page.locator('#reply').fill(draft);

  const slipEls = page.locator('readback-overlay .rb-mirror-slip');
  await expect(slipEls).toHaveCount(expectedSlips);
  // The pill's last-ask flip rolls the digits for a moment ("3 asks · 30 open"); read it at rest.
  const pill = page.locator('readback-overlay .rb-pill-label').first();
  const readPill = async (): Promise<string> =>
    (await pill.count()) > 0 ? ((await pill.textContent()) ?? '').replace(/\s+/g, ' ').trim() : '';
  await expect.poll(readPill, { timeout: 3000 }).toBe(expectedPill);
  const pillText = await readPill();

  const slips: string[] = [];
  for (let remaining = expectedSlips; remaining > 0; remaining--) {
    await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: 'https://mail.google.com/generic' });
      await chrome.tabs.sendMessage(tab!.id, { type: 'next-slip' });
    });
    const card = page.locator('readback-overlay .rb-card');
    await expect(card).toBeVisible();
    const message = ((await card.locator('.rb-card-msg').textContent()) ?? '').trim();
    const label = ((await card.locator('.rb-btn-primary').textContent()) ?? '').trim();
    slips.push(`${message} | ${label.replace(/^Change to /, '').replace(/\s*↵$/, '')}`);
    await page.keyboard.press('Enter');
    await expect(slipEls).toHaveCount(remaining - 1);
  }
  const repaired = await page.locator('#reply').inputValue();
  await page.close();
  return { slips: slips.sort(), pill: pillText, repaired };
}

async function viaWebApp(
  context: BrowserContext,
  origin: string,
  thread: string,
  draft: string,
): Promise<Observed> {
  const page: Page = await context.newPage();
  await page.goto(`${origin}/app/`);
  await page.getByRole('textbox', { name: "The message you're replying to" }).fill(thread);
  await page.getByRole('textbox', { name: 'Your reply' }).fill(draft);
  const rows = page.locator('section[aria-labelledby="slips-h"] .row');
  await settledCount(rows);
  const slips = await rows.evaluateAll((els) =>
    els.map((el) => {
      const mono = el.querySelectorAll('.row__title .mono-inline');
      const expected = (mono[mono.length - 1]?.textContent ?? '').trim();
      const message = (el.querySelector('.row__text > .t-caption')?.textContent ?? '').trim();
      return `${message} | ${expected}`;
    }),
  );
  // The pill's wording is the ask part only; the slip count is a separate span in the web app.
  const pillText = ((await page.locator('.pill--button .pill__text').first().textContent()) ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  const fix = page.locator('section[aria-labelledby="slips-h"]').getByRole('button', {
    name: 'Fix',
  });
  for (let remaining = slips.length; remaining > 0; remaining--) {
    await fix.first().click();
    await expect(rows).toHaveCount(remaining - 1);
  }
  const repaired = await page.getByRole('textbox', { name: 'Your reply' }).inputValue();
  await page.close();
  return { slips: slips.sort(), pill: pillText, repaired };
}

test.describe('parity: web app and extension give the same answers', () => {
  let server: StaticServer;
  test.skip(!existsSync(SITE_DIST), 'build the site first: pnpm --dir site build');

  test.beforeAll(async () => {
    server = await serveStatic(SITE_DIST);
  });
  test.afterAll(async () => {
    await server.close();
  });

  for (const sample of SAMPLES) {
    test(`${sample.id}: same slips, same fixes, same asks, same repaired reply`, async ({
      context,
      worker,
    }) => {
      const web = await viaWebApp(context, server.origin, sample.message, sample.draft);
      expect(web.slips.length, 'the sample has slips to compare').toBeGreaterThan(0);
      const ext = await viaExtension(
        context,
        worker,
        sample.message,
        sample.draft,
        web.slips.length,
        web.pill,
      );
      expect(ext.slips).toEqual(web.slips);
      expect(ext.pill).toEqual(web.pill);
      expect(ext.repaired).toEqual(web.repaired);
      // The repair is real: it differs from the draft that had slips.
      expect(web.repaired).not.toEqual(sample.draft);
    });
  }
});
