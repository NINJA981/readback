/**
 * The web app's core flows at both viewports (phone: 375 x 812 touch; desktop: 1440 x 900).
 * Covers SPEC AC-W.1 to W.4, W.6, W.7, W.9, W.10 on the real production build, plus the
 * privacy claims the page makes about itself: nothing leaves the page, nothing goes in the URL.
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { ORIGIN, SLIPS, distFileFor, isPhone, press, watchNetwork } from './helpers';

const PRIVACY = 'Runs entirely in your browser. Nothing is uploaded.';

const THREAD = [
  'Hi Sam,',
  '',
  'Can you confirm the $2,480 retainer and send the signed agreement back by Friday?',
  '',
  'Thanks,',
  'Priya Raman',
].join('\n');
const REPLY = 'Hi Pria, the $2,840 retainer is confirmed.';

const thread = (page: Page): Locator =>
  page.getByRole('textbox', { name: "The message you're replying to" });
const reply = (page: Page): Locator => page.getByRole('textbox', { name: 'Your reply' });
const slipRows = (page: Page): Locator => page.locator(`${SLIPS} .row`);
const firstFix = (page: Page): Locator =>
  page.locator(SLIPS).getByRole('button', { name: 'Fix' }).first();

/** Writes to the system clipboard and pastes it into a field with the keyboard shortcut. */
async function paste(page: Page, field: Locator, text: string): Promise<void> {
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await field.focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('ControlOrMeta+V');
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
});

test.describe('web app flows', () => {
  test('AC-W.1: the empty state shows the h1, the privacy line and a sample button, nothing else filled', async ({
    page,
  }) => {
    await page.goto('/app/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Try Readback in your browser',
    );
    await expect(page.getByText(PRIVACY).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try a sample' })).toBeVisible();
    await expect(thread(page)).toHaveValue('');
    await expect(reply(page)).toHaveValue('');
    await expect(slipRows(page)).toHaveCount(0);
  });

  test('AC-W.2: sample flow. The two slips are flagged and each Fix repairs the reply', async ({
    page,
  }) => {
    await page.goto('/app/');
    await press(page.getByRole('button', { name: 'Try a sample' }));
    await expect(slipRows(page)).toHaveCount(2);
    await expect(page.locator(SLIPS)).toContainText('Catherine');
    await expect(page.locator(SLIPS)).toContainText('$1,520');
    // The ask pill counts the three asks and the two slips. The asks only look answered (the
    // reply's wording matches them), so the pill says so instead of "covered" (AC-W.15).
    await expect(
      page.getByRole('button', { name: /3 of 3 asks look answered, not confirmed, 2 slips/ }),
    ).toBeVisible();

    await press(firstFix(page));
    await expect(reply(page)).toHaveValue(/Hi Kathryn,/);
    await expect(slipRows(page)).toHaveCount(1);
    await press(firstFix(page));
    await expect(reply(page)).toHaveValue(/The \$1,250 deposit is confirmed/);
    await expect(page.getByTestId('no-slips')).toBeVisible();
    await expect(page.locator('.success-line')).toContainText('No slips against this thread.');
  });

  test('paste flow: a thread and a reply pasted from the clipboard are checked live', async ({
    page,
  }) => {
    await page.goto('/app/');
    await paste(page, thread(page), THREAD);
    await expect(thread(page)).toHaveValue(THREAD);
    // The thread alone: asks and names are read, nothing is flagged.
    await expect(page.locator('#thread-meta')).toContainText('2 asks');
    await expect(slipRows(page)).toHaveCount(0);

    await paste(page, reply(page), REPLY);
    await expect(reply(page)).toHaveValue(REPLY);
    await expect(slipRows(page)).toHaveCount(2);
    await expect(page.locator(SLIPS)).toContainText('Pria');
    await expect(page.locator(SLIPS)).toContainText('$2,840');

    await press(firstFix(page));
    await press(firstFix(page));
    await expect(reply(page)).toHaveValue('Hi Priya, the $2,480 retainer is confirmed.');
    await expect(page.getByTestId('no-slips')).toBeVisible();
  });

  test('paste flow: replacing the thread re-checks the same reply', async ({ page }) => {
    await page.goto('/app/?sample=deposit');
    await expect(slipRows(page)).toHaveCount(2);
    await reply(page).fill('Hi Bob,');
    await expect(page.getByTestId('no-slips')).toBeVisible();
    await reply(page).fill('Hi Catherine,');
    await expect(slipRows(page)).toHaveCount(1);
    await paste(page, thread(page), 'Hi Sam,\n\nThanks, Catherine');
    await expect(thread(page)).toHaveValue('Hi Sam,\n\nThanks, Catherine');
    await expect(page.getByTestId('no-slips')).toBeVisible();
  });

  test('asks: confirm and undo flip the pill between open and covered, dismiss removes the ask', async ({
    page,
  }) => {
    await page.goto('/app/');
    await thread(page).fill(
      ['Hi Sam,', '', 'Can you confirm the $2,480 retainer?', '', 'Thanks,', 'Priya Raman'].join(
        '\n',
      ),
    );
    await reply(page).fill('Hi Priya, thanks.');
    const pill = page.locator('.pill--button');
    await expect(pill).toHaveAttribute('data-tone', 'open');
    await expect(pill).toContainText('1 ask · 1 open');
    await press(page.getByRole('button', { name: /^Confirm answered: / }));
    await expect(pill).toHaveAttribute('data-tone', 'covered');
    await expect(pill).toContainText('All covered');
    await press(page.getByRole('button', { name: /^Undo confirm: / }));
    await expect(pill).toHaveAttribute('data-tone', 'open');
    await press(page.getByRole('button', { name: /^Dismiss: / }));
    await expect(pill).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Confirm answered: / })).toHaveCount(0);
  });

  test('AC-W.4: a reply with no thread asks for the thread and flags nothing', async ({ page }) => {
    await page.goto('/app/');
    await reply(page).fill('Hi Catherine, the $1,520 deposit');
    await expect(page.getByText('Add the thread above')).toBeVisible();
    await expect(slipRows(page)).toHaveCount(0);
  });

  test('AC-W.13: the command palette opens, filters, runs a command and says when nothing matches', async ({
    page,
  }) => {
    await page.goto('/app/');
    await press(page.getByRole('button', { name: 'Try a sample' }));
    await expect(slipRows(page)).toHaveCount(2);
    if (isPhone()) await press(page.getByRole('button', { name: 'Commands' }));
    else await page.keyboard.press('ControlOrMeta+K');
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    await expect(palette).toBeVisible();
    const input = palette.getByRole('combobox', { name: 'Type a command' });
    await expect(input).toBeFocused();
    for (const label of ['Clear thread', 'Clear reply', 'Next slip', 'Open ledger']) {
      await expect(palette.getByRole('option', { name: label, exact: true })).toBeVisible();
    }
    await expect(palette.getByRole('option', { name: /^Load sample: / })).toHaveCount(6);
    await expect(palette.getByRole('option', { name: 'Export result as JSON' })).toBeVisible();
    await input.fill('xyz');
    await expect(palette).toContainText('No command matches “xyz”.');
    await input.fill('names guard');
    await page.keyboard.press('Enter');
    await expect(palette).toBeHidden();
    await expect(slipRows(page)).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Names', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  test('AC-W.14: the header guard toggles switch a guard off and on live', async ({ page }) => {
    await page.goto('/app/');
    await press(page.getByRole('button', { name: 'Try a sample' }));
    await expect(slipRows(page)).toHaveCount(2);
    const checks = page.getByRole('group', { name: 'Checks' });
    const names = checks.getByRole('button', { name: 'Names', exact: true });
    const numbers = checks.getByRole('button', { name: 'Numbers', exact: true });
    await expect(names).toHaveAttribute('aria-pressed', 'true');
    await press(names);
    await expect(names).toHaveAttribute('aria-pressed', 'false');
    await expect(slipRows(page)).toHaveCount(1);
    await expect(page.locator(SLIPS)).not.toContainText('Catherine');
    await press(numbers);
    await expect(page.getByTestId('no-slips')).toBeVisible();
    await press(names);
    await press(numbers);
    await expect(slipRows(page)).toHaveCount(2);
  });

  test('AC-W.15: an ask that only looks answered is never shown as covered', async ({ page }) => {
    await page.goto('/app/');
    await thread(page).fill(
      ['Hi Sam,', '', 'Can you confirm the $2,480 retainer?', '', 'Thanks,', 'Priya Raman'].join(
        '\n',
      ),
    );
    await reply(page).fill('Hi Priya, yes, I confirm the $2,480 retainer.');
    const pill = page.locator('.pill--button');
    await expect(pill).toContainText('1 looks answered');
    await expect(pill).toHaveAttribute('data-tone', 'open');
    await expect(pill.locator('.pill__ring[data-dotted]')).toHaveCount(1);
    await expect(pill).not.toContainText('All covered');
    await expect(page.locator('#ledger')).not.toContainText('Everything asked is covered.');
    await press(page.getByRole('button', { name: /^Confirm answered: / }));
    await expect(pill).toHaveAttribute('data-tone', 'covered');
    await expect(page.locator('#ledger')).toContainText('Everything asked is covered.');
  });

  test('a thread over 50,000 characters says so and waits instead of guessing', async ({
    page,
  }) => {
    await page.goto('/app/');
    await thread(page).fill('a '.repeat(25_001));
    await expect(
      page.getByRole('alert').filter({ hasText: 'longer than Readback reads' }),
    ).toBeVisible();
    await reply(page).fill('Hi Catherine');
    await expect(page.getByText('Waiting for a shorter thread before checking.')).toBeVisible();
    await expect(slipRows(page)).toHaveCount(0);
  });

  test('AC-9.4: typed and pasted text stays out of the URL, and survives a reload in this tab only', async ({
    page,
  }) => {
    await page.goto('/app/');
    await paste(page, thread(page), THREAD);
    await paste(page, reply(page), REPLY);
    await expect(slipRows(page)).toHaveCount(2);
    expect(decodeURIComponent(page.url())).not.toMatch(/Priya|retainer|2,480|2,840/);
    expect(new URL(page.url()).search).toBe('');
    expect(new URL(page.url()).hash).toBe('');
    await page.reload();
    await expect(reply(page)).toHaveValue(REPLY);
    await expect(slipRows(page)).toHaveCount(2);
    const persisted = await page.evaluate(() => ({
      local: JSON.stringify(Object.entries(localStorage)),
      session: JSON.stringify(Object.entries(sessionStorage)),
    }));
    // The ignore list and settings may live in localStorage; the text must not.
    expect(persisted.local).not.toMatch(/Priya|retainer/);
    expect(persisted.session).toContain('retainer');
  });

  test('AC-W.10: with reduced motion Fix applies the correction at once', async ({ browser }) => {
    const ctx = await browser.newContext({ ...test.info().project.use, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/app/?sample=deposit');
    await press(firstFix(page));
    await expect(reply(page)).toHaveValue(/Hi Kathryn,/);
    await ctx.close();
  });

  test('AC-W.9: no horizontal scroll, and every control stays inside the viewport', async ({
    page,
  }) => {
    await page.goto('/app/?sample=deposit');
    await expect(slipRows(page)).toHaveCount(2);
    const { overflow, outside } = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const outside: string[] = [];
      const sel = 'button, a[href], textarea, select';
      for (const el of document.querySelectorAll<HTMLElement>(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || el.closest('.sr-only')) continue;
        if (r.left < -0.5 || r.right > vw + 0.5) {
          const label = el.textContent.trim().slice(0, 24);
          outside.push(`${el.tagName} "${label}" ${Math.round(r.left)}..${Math.round(r.right)}`);
        }
      }
      return { overflow: document.documentElement.scrollWidth - vw, outside };
    });
    expect(overflow).toBeLessThanOrEqual(0);
    expect(outside).toEqual([]);
    if (isPhone()) {
      // Phone: the pill jumps to the asks list, which is then on screen.
      await press(page.getByRole('button', { name: /Show the list/ }));
      await expect(page.locator('section[aria-labelledby="asks-h"]')).toBeInViewport();
    }
  });
});

test.describe('network and offline', () => {
  test('AC-W.6 and AC-9.3: a whole session makes only plain GETs of files that exist in dist/, and the page counts 0 late requests', async ({
    page,
    context,
  }) => {
    const net = watchNetwork(context);
    await page.goto('/app/');
    await paste(page, thread(page), THREAD);
    await paste(page, reply(page), REPLY);
    await expect(slipRows(page)).toHaveCount(2);
    await press(firstFix(page));
    await press(page.getByRole('button', { name: 'Settings' }));
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(slipRows(page)).toHaveCount(1);
    await page.waitForTimeout(500);
    expect(net.requests.length).toBeGreaterThan(5);
    expect(net.offenders()).toEqual([]);
    await expect(page.getByTestId('late-requests')).toContainText(
      '0 requests since the app loaded',
    );
  });

  test('AC-W.6: the browser refuses fetch, XHR and WebSocket connections', async ({ page }) => {
    await page.goto('/app/');
    const result = await page.evaluate(async () => {
      const out: Record<string, boolean> = {};
      const refused = async (name: string, fn: () => Promise<unknown>): Promise<void> => {
        try {
          await fn();
          out[name] = false;
        } catch {
          out[name] = true;
        }
      };
      await refused('fetch', () => fetch('https://example.com/x'));
      await refused('fetch-same-origin', () => fetch('/app/'));
      await refused(
        'xhr',
        () =>
          new Promise((resolve, reject) => {
            const x = new XMLHttpRequest();
            x.open('GET', 'https://example.com/x');
            x.onload = resolve;
            x.onerror = () => {
              reject(new Error('blocked'));
            };
            x.send();
          }),
      );
      await refused(
        'websocket',
        () =>
          new Promise((resolve, reject) => {
            const ws = new WebSocket('wss://example.com/x');
            ws.onopen = resolve;
            ws.onerror = () => {
              reject(new Error('blocked'));
            };
          }),
      );
      return out;
    });
    expect(result).toEqual({
      fetch: true,
      'fetch-same-origin': true,
      xhr: true,
      websocket: true,
    });
  });

  test('AC-W.7: after one visit the app reloads offline, loads the checker and flags the slips', async ({
    page,
    context,
  }) => {
    await page.goto('/app/');
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    const failed: string[] = [];
    page.on('requestfailed', (r) => failed.push(r.url()));
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Try Readback');
    await press(page.getByRole('button', { name: 'Try a sample' }));
    await expect(slipRows(page)).toHaveCount(2);
    await press(firstFix(page));
    await expect(reply(page)).toHaveValue(/Hi Kathryn,/);
    await paste(page, reply(page), 'Hi Catherine');
    await expect(slipRows(page)).toHaveCount(1);
    expect(failed).toEqual([]);
    await context.setOffline(false);
  });

  test('every file the service worker precaches exists in dist/ and is served', async ({
    page,
    request,
  }) => {
    await page.goto('/app/');
    const sw = await (await request.get('/app/sw.js')).text();
    const list = /const PRECACHE = (\[[\s\S]*?\]);/.exec(sw)?.[1] ?? '[]';
    const precache = JSON.parse(list) as string[];
    expect(precache.length).toBeGreaterThan(8);
    for (const rel of precache) {
      const url = new URL(rel, `${ORIGIN}/app/`).href;
      expect(distFileFor(url), `${rel} is in dist/`).toBeTruthy();
      const res = await request.get(url);
      expect(res.status(), rel).toBe(200);
    }
  });
});
