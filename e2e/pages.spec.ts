import type { Page } from '@playwright/test';
import { axeBuilder, violationsOf } from './axe';
import { expect, isLocalRequest, readLocal, readSession, test, writeLocal } from './fixtures';

async function axeViolations(page: Page): Promise<string[]> {
  return violationsOf(axeBuilder(page));
}

for (const scheme of ['dark', 'light'] as const) {
  test.describe(`extension pages, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test(`popup fits 360x480 without scrolling, paints inside the budget and has no a11y violations (AC-10.1, AC-G.3)`, async ({
      context,
      extensionId,
      requests,
    }) => {
      const page = await context.newPage();
      await page.setViewportSize({ width: 360, height: 480 });
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      await expect(page.getByRole('heading', { level: 1, name: 'Readback' })).toBeVisible();
      await expect(page.getByRole('switch', { name: /^Names/ })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      const overflow = await page.evaluate(() => ({
        v: document.documentElement.scrollHeight - document.documentElement.clientHeight,
        h: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      expect(overflow).toEqual({ v: 0, h: 0 });
      // First paint is machine-noise sensitive (other processes share this CPU), so the budget
      // is read from the quietest of six loads, the same way the engine gate is.
      const paints: number[] = [];
      for (let i = 0; i < 6; i++) {
        await page.reload();
        await expect(page.getByRole('heading', { level: 1, name: 'Readback' })).toBeVisible();
        paints.push(
          await page.evaluate(
            () => performance.getEntriesByName('readback-popup-ready')[0]?.startTime ?? -1,
          ),
        );
      }
      expect(Math.min(...paints)).toBeGreaterThan(0);
      expect(Math.min(...paints)).toBeLessThanOrEqual(100);
      expect(await axeViolations(page)).toEqual([]);
      expect(requests.urls.filter((u) => !isLocalRequest(u))).toEqual([]);
    });

    test('options has no a11y violations and the command palette opens on Ctrl+K', async ({
      context,
      extensionId,
    }) => {
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/options.html`);
      await expect(page.getByRole('heading', { level: 1, name: 'Readback options' })).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);

      await page.keyboard.press('Control+K');
      const palette = page.getByRole('dialog');
      await expect(palette).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(palette).toBeHidden();
    });
  });
}

test('the fonts are self-hosted: Hubot and Mona load from the extension', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  // Faces load on first use; the page's own text (Mona) and its title (Hubot) must pull them in.
  const loaded = (): Promise<string[]> =>
    page.evaluate(() =>
      [...document.fonts]
        .filter((f) => f.status === 'loaded')
        .map((f) => f.family.replaceAll('"', '')),
    );
  await expect.poll(loaded).toContain('Hubot Sans Variable');
  await expect.poll(loaded).toContain('Mona Sans Variable');
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain(
    'Mona Sans Variable',
  );
});

test('AC-10.3: a check persists, and Clear all empties Readback storage, with a working Undo', async ({
  context,
  extensionId,
  worker,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);

  await page.getByRole('switch', { name: /^Dates/ }).click();
  await expect
    .poll(async () => (await readLocal(worker)).settings)
    .toMatchObject({ guards: { date: false, name: true } });

  await page.getByRole('radio', { name: 'dark' }).click();
  await expect
    .poll(async () => (await readLocal(worker)).settings)
    .toMatchObject({ theme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Cleared.' })).toBeVisible();
  await expect.poll(async () => Object.keys(await readLocal(worker))).toEqual([]);
  expect(
    Object.keys(await readSession(worker)).filter(
      (k) => k.startsWith('t:') || k.startsWith('tab:'),
    ),
  ).toEqual([]);

  // Ctrl+Z inside the toast's window puts the settings back.
  await page.keyboard.press('Control+Z');
  await expect
    .poll(async () => (await readLocal(worker)).settings)
    .toMatchObject({ theme: 'dark', guards: { date: false } });
  await expect(page.getByRole('status').filter({ hasText: 'Cleared.' })).toBeHidden();
});

test('the ignored-words list shows what Never flag stored, and Remove takes it out', async ({
  context,
  extensionId,
  worker,
}) => {
  await writeLocal(worker, { ignore: { names: ['Catherine'], numbers: [] } });
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.getByText('Catherine', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove Catherine from ignored words' }).click();
  await expect(page.getByText(/Nothing ignored yet/)).toBeVisible();
  await expect
    .poll(async () => (await readLocal(worker)).ignore)
    .toMatchObject({ names: [], numbers: [] });
});

test('a site switched off in settings is left alone', async ({
  context,
  extensionId,
  worker,
  openGmail,
}) => {
  await openGmail('inline-reply');
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 360, height: 480 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByRole('switch', { name: /^Names/ })).toBeVisible();
  await writeLocal(worker, { settings: { disabledSites: ['https://mail.google.com'] } });
  const gmail = context.pages().find((p) => p.url().startsWith('https://mail.google.com'));
  if (!gmail) throw new Error('the Gmail fixture page is not open');
  await gmail.locator('div[g_editable="true"]').click();
  await gmail.keyboard.type('Hi Catherine,');
  await gmail.waitForTimeout(500);
  expect(await gmail.evaluate(() => CSS.highlights.has('readback-slip'))).toBe(false);
});
