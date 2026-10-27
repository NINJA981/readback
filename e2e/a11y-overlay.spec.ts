/**
 * axe-core on the overlay that lives inside the page's shadow root (SPEC AC-G.3): the pill, the
 * guard card, the asks ledger and the context chip, on a light host and on a dark host.
 * The e2e build leaves the shadow root open so axe can reach into it.
 */
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { Page, Worker } from '@playwright/test';
import { axeBuilder, violationsOf } from './axe';
import { expect, highlightTexts, test } from './fixtures';

declare const chrome: {
  tabs: {
    query(q: object): Promise<{ id: number }[]>;
    sendMessage(id: number, m: object): Promise<unknown>;
  };
  scripting: { executeScript(o: object): Promise<unknown> };
};

const EDITOR = 'div[g_editable="true"]';
const GENERIC = resolve(import.meta.dirname, '..', 'tests', 'fixtures', 'generic', 'page.html');

async function overlayViolations(page: Page): Promise<string[]> {
  return violationsOf(axeBuilder(page).include('readback-overlay'));
}

async function command(worker: Worker, type: 'next-slip' | 'open-ledger'): Promise<void> {
  await worker.evaluate(async (t) => {
    const [tab] = await chrome.tabs.query({ url: 'https://mail.google.com/*' });
    await chrome.tabs.sendMessage(tab!.id, { type: t });
  }, type);
}

async function typeReply(page: Page, lines: string[]): Promise<void> {
  await page.locator(EDITOR).click();
  await page.keyboard.press('Control+Home');
  for (const [i, line] of lines.entries()) {
    if (i > 0) await page.keyboard.press('Enter');
    await page.keyboard.type(line);
  }
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`overlay on a ${theme} host`, () => {
    test(`pill, guard card and ledger have no a11y violations`, async ({ openGmail, worker }) => {
      const page = await openGmail(`theme-${theme}`);
      await typeReply(page, ['Hi Catherine,', '', 'The $1,520 deposit is confirmed.']);
      const highlight = theme === 'dark' ? 'readback-slip-dark' : 'readback-slip';
      await expect.poll(() => highlightTexts(page, highlight)).toEqual(['Catherine', '$1,520']);
      await expect(page.locator('readback-overlay .rb-pill')).toBeVisible();
      expect(await overlayViolations(page)).toEqual([]);

      await command(worker, 'next-slip');
      await expect(page.locator('readback-overlay .rb-card')).toBeVisible();
      // The card fades and scales in; axe reads colours at rest.
      await page.waitForTimeout(500);
      expect(await overlayViolations(page)).toEqual([]);

      await page.keyboard.press('Escape');
      await expect(page.locator('readback-overlay .rb-card')).toHaveCount(0);
      await command(worker, 'open-ledger');
      await expect(page.locator('readback-overlay .rb-ledger')).toBeVisible();
      await page.waitForTimeout(500);
      expect(await overlayViolations(page)).toEqual([]);
    });
  });
}

test('the context chip and the textarea mirror card on a plain page have no a11y violations', async ({
  context,
  worker,
}) => {
  const html = await readFile(GENERIC, 'utf8');
  await context.route('https://mail.google.com/generic', (route) =>
    route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }),
  );
  const page = await context.newPage();
  await page.goto('https://mail.google.com/generic');
  const text = (await page.locator('#message').innerText()).trim();
  await worker.evaluate(async (message) => {
    const [tab] = await chrome.tabs.query({ url: 'https://mail.google.com/generic' });
    await chrome.scripting.executeScript({
      target: { tabId: tab!.id },
      files: ['/content-scripts/selection.js'],
    });
    await chrome.tabs.sendMessage(tab!.id, { type: 'use-selection', text: message });
  }, text);
  await expect(page.locator('readback-overlay .rb-chip')).toBeVisible();
  await page.locator('#reply').click();
  await page.keyboard.type('Hi Catherine, thanks');
  await expect(page.locator('readback-overlay .rb-mirror-slip')).toHaveCount(1);
  expect(await overlayViolations(page)).toEqual([]);
  await command(worker, 'next-slip');
  await expect(page.locator('readback-overlay .rb-card')).toBeVisible();
  await page.waitForTimeout(500);
  expect(await overlayViolations(page)).toEqual([]);
});
