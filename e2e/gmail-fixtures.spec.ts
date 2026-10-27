/**
 * AC-8.1 in a real browser. tests/unit/adapters/gmail.test.ts proves the adapter reads each Gmail
 * fixture into the exact sender, signature and recipients of its `.expected.json`. This runs the
 * real content script on the same fixtures and checks what that reading makes visible: the sender
 * from the expected JSON is the name the guard cites, the message in the expected JSON is the one
 * the ask pill counts, and a fixture the JSON calls "not-a-reply" draws nothing.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page, Worker } from '@playwright/test';
import { expect, highlightTexts, test } from './fixtures';

const FIXTURES = resolve(import.meta.dirname, '..', 'tests', 'fixtures', 'gmail');
const EDITOR = 'div[g_editable="true"]';

interface Expected {
  status: 'ready' | 'not-a-reply';
  sender?: { name: string };
  message?: string;
  kind?: 'reply' | 'forward';
  hostTheme?: 'dark';
}
const expectedFor = (name: string): Expected =>
  JSON.parse(readFileSync(resolve(FIXTURES, `${name}.expected.json`), 'utf8')) as Expected;

declare const chrome: {
  tabs: {
    query(q: object): Promise<{ id: number }[]>;
    sendMessage(id: number, m: object): Promise<unknown>;
  };
};

async function nextSlip(worker: Worker): Promise<void> {
  await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: 'https://mail.google.com/*' });
    await chrome.tabs.sendMessage(tab!.id, { type: 'next-slip' });
  });
}

async function typeAtTop(page: Page, text: string): Promise<void> {
  await page.locator(EDITOR).click();
  // Above the user's own signature, as the caret sits in Gmail.
  await page.keyboard.press('Control+Home');
  await page.keyboard.type(text);
}

const READY = [
  'inline-reply',
  'popout-reply',
  'forward',
  'theme-light',
  'theme-dark',
  'quoted-history',
  'long-signature',
  'own-last',
] as const;

test.describe('AC-8.1: each Gmail fixture is read as its expected JSON says', () => {
  for (const name of READY) {
    test(name, async ({ openGmail, worker }) => {
      const expected = expectedFor(name);
      expect(expected.status).toBe('ready');
      const senderFirst = (expected.sender?.name ?? '').split(' ')[0] ?? '';
      expect(senderFirst).not.toBe('');

      const page = await openGmail(name);
      await typeAtTop(page, 'Hi Catherine,');
      const highlight = expected.hostTheme === 'dark' ? 'readback-slip-dark' : 'readback-slip';
      await expect.poll(() => highlightTexts(page, highlight)).toEqual(['Catherine']);

      // The sender in the JSON is the name the card cites.
      await nextSlip(worker);
      await expect(page.locator('readback-overlay .rb-card-msg')).toHaveText(
        `Signs as ${senderFirst}`,
      );
      await page.keyboard.press('Escape');

      // The message in the JSON is the one the pill counts asks in: the hero message has three.
      const asks = (expected.message ?? '').includes('confirm the $1,250 deposit') ? 3 : 0;
      await expect(page.locator('readback-overlay .rb-pill-label').first()).toContainText(
        `${asks} asks · ${asks} open`,
      );
    });
  }

  test('new-message: the JSON says not-a-reply, so nothing is drawn and no overlay is added', async ({
    openGmail,
  }) => {
    expect(expectedFor('new-message').status).toBe('not-a-reply');
    const page = await openGmail('new-message');
    await typeAtTop(page, 'Hi Catherine, the $1,520 deposit');
    await page.waitForTimeout(600);
    expect(await highlightTexts(page, 'readback-slip')).toEqual([]);
    expect(await highlightTexts(page, 'readback-slip-dark')).toEqual([]);
    await expect(page.locator('readback-overlay')).toHaveCount(0);
  });
});
