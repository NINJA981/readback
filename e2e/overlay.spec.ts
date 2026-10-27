/**
 * The product UI in a real browser: the real content script on the Gmail
 * fixtures, with the overlay's shadow root open (the e2e build, wxt.config.ts).
 * Covers SPEC AC-5.1 to 5.3, 6.5, 6.6, 8.3 (minus the context-menu click),
 * AC-4.3 and AC-G.4, plus the states DESIGN.md names: host-refused fix, ignore,
 * never-flag, reduced motion.
 */
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { Page, Worker } from '@playwright/test';
import {
  expect,
  highlightTexts,
  isLocalRequest,
  readLocal,
  readSession,
  test,
  writeLocal,
} from './fixtures';

const EDITOR = 'div[g_editable="true"]';
const CARD = 'readback-overlay .rb-card';
const PILL = 'readback-overlay .rb-pill';
const GENERIC = resolve(import.meta.dirname, '..', 'tests', 'fixtures', 'generic', 'page.html');

declare const chrome: {
  tabs: {
    query(q: object): Promise<{ id: number }[]>;
    sendMessage(id: number, m: object): Promise<unknown>;
  };
  scripting: { executeScript(o: object): Promise<unknown> };
};

/** What Alt+Shift+J and Alt+Shift+L do: the background sends these to the tab. */
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

/** Centre of the first highlighted range with this text. */
async function slipPoint(page: Page, text: string): Promise<{ x: number; y: number }> {
  return page.evaluate((wanted) => {
    for (const name of CSS.highlights.keys()) {
      for (const range of CSS.highlights.get(name) as unknown as Iterable<Range>) {
        if (range.toString() === wanted) {
          const r = range.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }
      }
    }
    throw new Error(`no slip "${text}"`);
  }, text);
}

async function hoverSlip(page: Page, text: string): Promise<void> {
  const p = await slipPoint(page, text);
  await page.mouse.move(p.x - 40, p.y);
  await page.mouse.move(p.x, p.y);
}

const shadowActive = (page: Page): Promise<string> =>
  page.evaluate(() =>
    (() => {
      const el = document.querySelector('readback-overlay')?.shadowRoot?.activeElement;
      return el ? el.textContent.trim() || (el.getAttribute('aria-label') ?? el.tagName) : '';
    })(),
  );

const editorText = (page: Page): Promise<string> =>
  page.locator(EDITOR).evaluate((el) => (el as HTMLElement).innerText);

test.describe('guard card, fix and undo', () => {
  test('AC-5.1: hovering a squiggle for 300 ms opens the card with the message and the cited line', async ({
    openGmail,
  }) => {
    const page = await openGmail('inline-reply');
    await typeReply(page, ['Hi Catherine,']);
    await expect.poll(() => highlightTexts(page, 'readback-slip')).toEqual(['Catherine']);
    await hoverSlip(page, 'Catherine');
    await page.waitForTimeout(120);
    await expect(page.locator(CARD)).toHaveCount(0); // not before the dwell
    await expect(page.locator(CARD)).toBeVisible({ timeout: 1500 });
    await expect(page.locator(`${CARD} .rb-card-msg`)).toHaveText('Signs as Kathryn');
    await expect(page.locator(`${CARD} .rb-cite-token`)).toHaveText('Kathryn');
    await expect(page.locator(`${CARD} .rb-cite figcaption`)).toHaveText('From the signature');
    // The active tint is on the hovered slip.
    await expect.poll(() => highlightTexts(page, 'readback-slip-active')).toEqual(['Catherine']);
    // The readback line has been drawn from the message to the cited token.
    expect(await page.locator(`${CARD} .rb-line-path`).getAttribute('d')).toMatch(
      /^M [\d.]+ [\d.]+ V /,
    );
    // The card never edits anything by itself.
    expect(await editorText(page)).toContain('Hi Catherine,');
  });

  test('AC-5.2: the fix changes the text, Ctrl+Z restores it, and the flag follows both', async ({
    openGmail,
  }) => {
    const page = await openGmail('inline-reply');
    await typeReply(page, ['Hi Catherine,', '', 'The $1,520 deposit is confirmed.']);
    await expect.poll(() => highlightTexts(page, 'readback-slip')).toEqual(['Catherine', '$1,520']);
    await hoverSlip(page, 'Catherine');
    await expect(page.locator(CARD)).toBeVisible();
    await page.locator(`${CARD} .rb-btn-primary`).click();

    await expect.poll(() => editorText(page)).toContain('Hi Kathryn,');
    await expect.poll(() => highlightTexts(page, 'readback-slip')).toEqual(['$1,520']);
    await expect(page.locator(CARD)).toHaveCount(0);
    await expect(page.locator(`${PILL} .rb-pill-label`).first()).toHaveText(
      'Fixed: Kathryn · Undo Ctrl+Z',
    );

    await page.keyboard.press('Control+z');
    await expect.poll(() => editorText(page)).toContain('Hi Catherine,');
    await expect.poll(() => highlightTexts(page, 'readback-slip')).toEqual(['Catherine', '$1,520']);
    // The confirmation is withdrawn when the slip comes back.
    await expect(page.locator(`${PILL} .rb-pill-label`).first()).not.toContainText('Fixed');
  });

  test('the swap-back ghost plays over the fixed word, then removes itself; reduced motion skips it', async ({
    openGmail,
  }) => {
    const page = await openGmail('inline-reply');
    await typeReply(page, ['Hi Catherine,']);
    await expect.poll(() => highlightTexts(page, 'readback-slip')).toEqual(['Catherine']);
    await hoverSlip(page, 'Catherine');
    await page.locator(`${CARD} .rb-btn-primary`).click();
    await expect(page.locator('readback-overlay .rb-ghost')).toHaveCount(1, { timeout: 400 });
    // Shared letters a, t, h, r, n plus the leaving and arriving ones are all present.
    expect(await page.locator('readback-overlay .rb-ghost-glyph').count()).toBe(5 + 4 + 2);
    await expect(page.locator('readback-overlay .rb-ghost')).toHaveCount(0, { timeout: 1500 });
    expect(await editorText(page)).toContain('Hi Kathryn,');

    await page.keyboard.press('Control+z');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => highlightTexts(page, 'readback-slip')).toEqual(['Catherine']);
    await hoverSlip(page, 'Catherine');
    await page.locator(`${CARD} .rb-btn-primary`).click();
    await expect.poll(() => editorText(page)).toContain('Hi Kathryn,');
    expect(await page.locator('readback-overlay .rb-ghost').count()).toBe(0);
  });

  test('AC-5.3: keyboard only. Alt+Shift+J opens the card focused on the fix, Esc closes it and the caret returns', async ({
    openGmail,
    worker,
  }) => {
    const page = await openGmail('inline-reply');
    await typeReply(page, ['Hi Catherine,']);
    await expect.poll(() => highlightTexts(page, 'readback-slip')).toEqual(['Catherine']);

    await command(worker, 'next-slip');
    await expect(page.locator(CARD)).toBeVisible();
    await expect(page.locator(CARD)).toHaveAttribute('role', 'dialog');
    await expect.poll(() => shadowActive(page)).toContain('Change to Kathryn');

    // Tab stays inside the card and loops.
    await page.keyboard.press('Tab');
    expect(await shadowActive(page)).toContain('Ignore');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    expect(await shadowActive(page)).toContain('Change to Kathryn');

    await page.keyboard.press('Escape');
    await expect(page.locator(CARD)).toHaveCount(0);
    expect(await page.evaluate(() => document.activeElement?.getAttribute('g_editable'))).toBe(
      'true',
    );
    // The caret sits at the end of the slip it was about.
    const before = await page.evaluate(() => {
      const sel = getSelection()!;
      return (sel.anchorNode?.textContent ?? '').slice(0, sel.anchorOffset);
    });
    expect(before.endsWith('Hi Catherine')).toBe(true);
    // Esc changed nothing.
    expect(await editorText(page)).toContain('Hi Catherine,');

    // Enter applies the primary fix.
    await command(worker, 'next-slip');
    await expect.poll(() => shadowActive(page)).toContain('Change to Kathryn');
    await page.keyboard.press('Enter');
    await expect.poll(() => editorText(page)).toContain('Hi Kathryn,');
    await expect(page.locator(CARD)).toHaveCount(0);
  });

  test('Shift+Enter applies the second fix of a date slip', async ({ openGmail, worker }) => {
    const page = await openGmail('inline-reply');
    await typeReply(page, ['Hi Kathryn,', 'I will drop the keys off Thursday the 10th.']);
    await expect.poll(() => highlightTexts(page, 'readback-slip')).toEqual(['Thursday the 10th']);
    await command(worker, 'next-slip');
    await expect(page.locator(`${CARD} .rb-card-msg`)).toHaveText('Thread says Thursday the 12th.');
    await expect(page.locator(`${CARD} .rb-btn-primary`)).toContainText('Thursday the 12th');
    await expect(page.locator(`${CARD} .rb-btn-secondary`)).toContainText('Tuesday the 10th');
    await page.keyboard.press('Shift+Enter');
    await expect.poll(() => editorText(page)).toContain('Tuesday the 10th');
  });

  test('I ignores the slip for this reply and remembers it for the session, as a hashed id', async ({
    openGmail,
    worker,
  }) => {
    const page = await openGmail('inline-reply');
    await typeReply(page, ['Hi Catherine,']);
    await expect.poll(() => highlightTexts(page, 'readback-slip')).toEqual(['Catherine']);
    await command(worker, 'next-slip');
    await expect(page.locator(CARD)).toBeVisible();
    await page.keyboard.press('i');
    await expect(page.locator(CARD)).toHaveCount(0);
    await expect.poll(() => highlightTexts(page, 'readback-slip')).toEqual([]);
    const entry = Object.entries(await readSession(worker)).find(([k]) => k.startsWith('t:'));
    const state = entry?.[1] as { ignoredFlags: string[] };
    expect(state.ignoredFlags).toHaveLength(1);
    expect(state.ignoredFlags[0]).toMatch(/^[0-9a-f]{16}$/);
    expect(JSON.stringify(await readSession(worker))).not.toContain('Catherine');
  });

  test('Never flag adds the word to the global ignore list', async ({ openGmail, worker }) => {
    const page = await openGmail('inline-reply');
    await typeReply(page, ['Hi Catherine,']);
    await expect.poll(() => highlightTexts(page, 'readback-slip')).toEqual(['Catherine']);
    await hoverSlip(page, 'Catherine');
    await page.locator(`${CARD} button[aria-label="More options"]`).click();
    await page.locator(`${CARD} [role="menuitem"]`).click();
    await expect
      .poll(async () => (await readLocal(worker)).ignore)
      .toMatchObject({ names: ['Catherine'] });
    await expect.poll(() => highlightTexts(page, 'readback-slip')).toEqual([]);
  });

  test('when the host refuses the edit, nothing changes and the card says what to do', async ({
    context,
    openGmail,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: 'https://mail.google.com',
    });
    const page = await openGmail('inline-reply');
    await typeReply(page, ['Hi Catherine,']);
    await expect.poll(() => highlightTexts(page, 'readback-slip')).toEqual(['Catherine']);
    await hoverSlip(page, 'Catherine');
    await expect(page.locator(CARD)).toBeVisible();
    // The content script lives in an isolated world, so overriding execCommand from the page
    // would not reach it. A host that stops accepting edits looks the same to it: make the
    // editor read-only, which is what makes the editor's own input path refuse.
    await page.locator(EDITOR).evaluate((el) => {
      el.setAttribute('contenteditable', 'false');
    });
    await page.locator(`${CARD} .rb-btn-primary`).click();
    await expect(page.locator(`${CARD} .rb-card-notice`)).toHaveText(
      'Couldn’t edit this box. “Kathryn” is copied, so paste it over the word.',
    );
    await expect(page.locator(`${CARD} .rb-btn-primary`)).toContainText('Copy again');
    expect(await editorText(page)).toContain('Hi Catherine,');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Kathryn');
  });
});

test.describe('ask pill and ledger', () => {
  test('AC-6.5: the pill goes from open (brass) to looks answered (brass, dotted) to All covered (success) once confirmed, with no layout shift', async ({
    openGmail,
    worker,
  }) => {
    const page = await openGmail('inline-reply');
    await typeReply(page, ['Hi Kathryn,']);
    const pill = page.locator(`${PILL} .rb-pill-label`).first();
    await expect(pill).toHaveText('3 asks · 3 open');
    await expect(page.locator(PILL)).toHaveAttribute('data-tone', 'open');
    const box = () => page.locator(PILL).boundingBox();
    const before = (await box())!;

    await page.keyboard.press('Enter');
    await page.keyboard.type(
      'The $1,250 deposit is confirmed. I will drop the keys off Thursday the 12th and send the signed lease back.',
    );
    // Every ask looks answered, but a guess is not a fact: brass, a dotted ring, never "All covered".
    await expect(pill).toHaveText('3 look answered', { timeout: 2000 });
    await expect(page.locator(PILL)).toHaveAttribute('data-tone', 'open');
    await expect(page.locator(`${PILL} .rb-ring circle`).first()).toHaveAttribute(
      'stroke-dasharray',
      '2 2',
    );

    // Confirming each ask is what turns the pill green.
    await command(worker, 'open-ledger');
    const confirms = page.locator(
      'readback-overlay .rb-ledger button[aria-label^="Mark as answered"]',
    );
    await expect(confirms).toHaveCount(3);
    for (let i = 0; i < 3; i++) await confirms.first().click();
    await expect(page.locator(PILL)).toHaveAttribute('data-tone', 'covered', { timeout: 2000 });
    await expect(pill).toHaveText('All covered');
    const after = (await box())!;
    // Docked to the bottom-right: the pill did not move or change size.
    expect(Math.round(after.x + after.width)).toBe(Math.round(before.x + before.width));
    expect(after.y).toBe(before.y);
    expect(after.height).toBe(before.height);
    expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(2);
  });

  test('Alt+Shift+L opens the ledger focused; Esc closes it and returns focus to the editor', async ({
    openGmail,
    worker,
  }) => {
    const page = await openGmail('inline-reply');
    await typeReply(page, ['Hi Catherine,']);
    await command(worker, 'open-ledger');
    const ledger = page.locator('readback-overlay .rb-ledger');
    await expect(ledger).toBeVisible();
    await expect(ledger.getByRole('heading', { name: 'Asks' })).toBeVisible();
    await expect(ledger.getByRole('heading', { name: 'Slips' })).toBeVisible();
    await expect(ledger.locator('.rb-row')).toHaveCount(4); // 3 asks and 1 slip
    await expect.poll(() => shadowActive(page)).not.toBe('');
    await page.keyboard.press('Escape');
    await expect(ledger).toHaveCount(0);
    expect(await page.evaluate(() => document.activeElement?.getAttribute('g_editable'))).toBe(
      'true',
    );
  });

  test('AC-6.6: dismissing an ask updates the count at once and persists for the thread', async ({
    openGmail,
    worker,
  }) => {
    const page = await openGmail('inline-reply');
    await typeReply(page, ['Hi Kathryn,']);
    const label = page.locator(`${PILL} .rb-pill-label`).first();
    await expect(label).toHaveText('3 asks · 3 open');
    await command(worker, 'open-ledger');
    await page.locator('readback-overlay .rb-ledger .rb-row').first().hover();
    await page.locator('readback-overlay .rb-ledger button[aria-label^="Dismiss"]').first().click();
    await expect(label).toHaveText('2 asks · 2 open', { timeout: 100 });
    await expect
      .poll(async () => {
        const entry = Object.entries(await readSession(worker)).find(([k]) => k.startsWith('t:'));
        return (entry?.[1] as { dismissedAsks: string[] } | undefined)?.dismissedAsks.length;
      })
      .toBe(1);
    // The ledger offers to bring it back.
    await expect(page.getByText('Restore 1 dismissed')).toBeVisible();
  });

  test('a ledger slip row applies its fix', async ({ openGmail, worker }) => {
    const page = await openGmail('inline-reply');
    await typeReply(page, ['Hi Catherine,']);
    await command(worker, 'open-ledger');
    await page
      .locator('readback-overlay .rb-ledger')
      .getByRole('button', { name: 'Fix: change Catherine to Kathryn' })
      .click();
    await expect.poll(() => editorText(page)).toContain('Hi Kathryn,');
  });
});

test.describe('footprint on the host page', () => {
  test('AC-G.4: one shadow host on <html>, and the page’s styles and the editor’s font are unchanged', async ({
    openGmail,
    requests,
  }) => {
    const page = await openGmail('inline-reply');
    const snapshot = () =>
      page.evaluate(() => ({
        sheets: document.styleSheets.length,
        font: getComputedStyle(document.querySelector('div[g_editable="true"]')!).font,
        headChildren: document.head.children.length,
        bodyChildren: document.body.children.length,
      }));
    await page.waitForTimeout(300);
    const before = await snapshot();
    await typeReply(page, ['Hi Catherine,']);
    await expect(page.locator(PILL)).toBeVisible();
    await hoverSlip(page, 'Catherine');
    await expect(page.locator(CARD)).toBeVisible();
    expect(await snapshot()).toEqual(before);
    expect(await page.locator('readback-overlay').count()).toBe(1);
    expect(
      await page.evaluate(() => document.querySelector('readback-overlay')?.parentElement?.tagName),
    ).toBe('HTML');
    // The overlay's own styles live in the shadow root.
    expect(
      await page.evaluate(
        () =>
          document.querySelector('readback-overlay')?.shadowRoot?.querySelectorAll('style').length,
      ),
    ).toBe(1);
    expect(requests.urls.filter((u) => !isLocalRequest(u))).toEqual([]);
  });

  test('the overlay is in Mona Sans (embedded, no request) and follows the host theme', async ({
    openGmail,
    requests,
  }) => {
    const page = await openGmail('theme-dark');
    await typeReply(page, ['Hi Catherine,']);
    await expect(page.locator(PILL)).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          [...document.fonts]
            .filter((f) => f.status === 'loaded')
            .map((f) => f.family.replaceAll('"', '')),
        ),
      )
      .toContain('Mona Sans Variable');
    expect(await page.locator('readback-overlay').getAttribute('data-theme')).toBe('dark');
    expect(requests.urls.filter((u) => !isLocalRequest(u))).toEqual([]);
  });
});

test.describe('generic adapter on a plain page', () => {
  async function openGenericPage(
    context: import('@playwright/test').BrowserContext,
    worker: Worker,
  ): Promise<Page> {
    const html = await readFile(GENERIC, 'utf8');
    await context.route('https://mail.google.com/generic', (route) =>
      route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }),
    );
    const page = await context.newPage();
    await page.goto('https://mail.google.com/generic');
    // The background does exactly this after the menu click (activeTab); Playwright cannot click
    // a browser context menu, so this drives the same two steps.
    const text = (await page.locator('#message').innerText()).trim();
    await worker.evaluate(
      async ({ message }) => {
        const [tab] = await chrome.tabs.query({ url: 'https://mail.google.com/generic' });
        await chrome.scripting.executeScript({
          target: { tabId: tab!.id },
          files: ['/content-scripts/selection.js'],
        });
        await chrome.tabs.sendMessage(tab!.id, { type: 'use-selection', text: message });
      },
      { message: text },
    );
    return page;
  }

  test('AC-8.3 and AC-4.3: context chip, textarea mirror within 2 px, hover card, Clear', async ({
    context,
    worker,
  }) => {
    const page = await openGenericPage(context, worker);
    const chip = page.locator('readback-overlay .rb-chip');
    await expect(chip).toContainText('Context: ');
    await expect(chip).toContainText('words from this page');

    await page.locator('#reply').click();
    await page.keyboard.type('Hi Catherine, thanks');
    const slip = page.locator('readback-overlay .rb-mirror-slip');
    await expect(slip).toHaveCount(1);

    // AC-4.3: the mirror underline sits where the token is, within 2 px.
    const expected = await page.evaluate(() => {
      const ta = document.querySelector('#reply') as HTMLTextAreaElement;
      const cs = getComputedStyle(ta);
      const ctx = document.createElement('canvas').getContext('2d')!;
      ctx.font = cs.font;
      const r = ta.getBoundingClientRect();
      const left = r.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
      const top = r.top + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop);
      return {
        left: left + ctx.measureText('Hi ').width,
        width: ctx.measureText('Catherine').width,
        top,
        height: parseFloat(cs.lineHeight),
      };
    });
    const box = (await slip.boundingBox())!;
    expect(Math.abs(box.x - expected.left)).toBeLessThanOrEqual(2);
    expect(Math.abs(box.width - expected.width)).toBeLessThanOrEqual(2);
    // The underline spans the glyphs, which sit centred in the 24 px line box.
    expect(
      Math.abs(box.y + box.height / 2 - (expected.top + expected.height / 2)),
    ).toBeLessThanOrEqual(2);

    // Hover opens the same card.
    await page.mouse.move(box.x - 30, box.y + box.height / 2);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator(CARD)).toBeVisible({ timeout: 1500 });
    await expect(page.locator(`${CARD} .rb-card-msg`)).toHaveText('Signs as Kathryn');
    await page.keyboard.press('Escape');

    // Clear drops the context: no squiggle, no chip.
    await chip.getByRole('button', { name: 'Clear' }).click();
    await expect(slip).toHaveCount(0);
    await expect(page.locator('readback-overlay .rb-chip')).toHaveCount(0);
  });

  test('a selection that is too short shows the error chip for four seconds', async ({
    context,
    worker,
  }) => {
    const html = await readFile(GENERIC, 'utf8');
    await context.route('https://mail.google.com/generic', (route) =>
      route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }),
    );
    const page = await context.newPage();
    await page.goto('https://mail.google.com/generic');
    await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: 'https://mail.google.com/generic' });
      await chrome.scripting.executeScript({
        target: { tabId: tab!.id },
        files: ['/content-scripts/selection.js'],
      });
      // The background drops selections it cannot read; a one-word selection reaches the script.
      await chrome.tabs.sendMessage(tab!.id, { type: 'use-selection', text: 'Hi' });
    });
    const chip = page.locator('readback-overlay .rb-chip');
    await expect(chip).toHaveText('No text selected. Select the message first.');
    await expect(chip).toHaveCount(0, { timeout: 6000 });
  });
});

test('writing settings from elsewhere reaches an open reply within 100 ms (AC-10.2 path)', async ({
  openGmail,
  worker,
}) => {
  const page = await openGmail('inline-reply');
  await typeReply(page, ['Hi Catherine,', 'The $1,520 deposit.']);
  await expect.poll(() => highlightTexts(page, 'readback-slip')).toEqual(['Catherine', '$1,520']);
  const started = Date.now();
  await writeLocal(worker, {
    settings: { guards: { name: false, number: true, date: true, asks: true } },
  });
  await expect
    .poll(() => highlightTexts(page, 'readback-slip'), { intervals: [10] })
    .toEqual(['$1,520']);
  expect(Date.now() - started).toBeLessThan(500);
});
