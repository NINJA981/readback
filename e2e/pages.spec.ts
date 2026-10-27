import AxeBuilder from '@axe-core/playwright';
import { expect, isLocalRequest, readLocal, readSession, test, writeLocal } from './fixtures';

for (const scheme of ['dark', 'light'] as const) {
  test.describe(`extension pages, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test(`popup renders without scrolling at 360x480 and has no a11y violations (AC-10.1, AC-G.3)`, async ({
      context,
      extensionId,
      requests,
    }) => {
      const page = await context.newPage();
      await page.setViewportSize({ width: 360, height: 480 });
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      await expect(page.getByRole('status')).toHaveText('Not a reply page');
      await expect(page.getByRole('switch', { name: 'Names' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      const overflow = await page.evaluate(() => ({
        v: document.documentElement.scrollHeight - document.documentElement.clientHeight,
        h: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      expect(overflow).toEqual({ v: 0, h: 0 });
      const results = await new AxeBuilder({ page }).analyze();
      expect(
        results.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
        ),
      ).toEqual([]);
      expect(requests.urls.filter((u) => !isLocalRequest(u))).toEqual([]);
    });

    test('options has no a11y violations', async ({ context, extensionId }) => {
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/options.html`);
      await expect(page.getByRole('heading', { level: 1, name: 'Readback options' })).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(
        results.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
        ),
      ).toEqual([]);
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
  // The mono face is for cited evidence; the options page shows none until an ignored word exists.
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain(
    'Mona Sans Variable',
  );
});

test('AC-10.3: a guard switch persists, and Clear all empties Readback storage', async ({
  context,
  extensionId,
  worker,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);

  await page.getByRole('switch', { name: /^Dates/ }).click();
  await expect
    .poll(async () => (await readLocal(worker)).settings)
    .toMatchObject({
      guards: { date: false, name: true },
    });

  await page.getByRole('radio', { name: 'dark' }).click();
  await expect
    .poll(async () => (await readLocal(worker)).settings)
    .toMatchObject({ theme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.getByRole('button', { name: 'Clear all' }).click();
  await page.getByRole('button', { name: 'Clear everything' }).click();
  await expect.poll(async () => Object.keys(await readLocal(worker))).toEqual([]);
  expect(
    Object.keys(await readSession(worker)).filter(
      (k) => k.startsWith('t:') || k.startsWith('tab:'),
    ),
  ).toEqual([]);
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
  // The popup reads the active tab; with the page open in the same window it is the Gmail tab
  // only when the popup is not itself the active tab, so drive the setting through the switch
  // on the options page equivalent: toggle via storage and confirm the page honours it.
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByRole('switch', { name: 'Names' })).toBeVisible();
  await writeLocal(worker, { settings: { disabledSites: ['https://mail.google.com'] } });
  const gmail = context.pages().find((p) => p.url().startsWith('https://mail.google.com'))!;
  await gmail.locator('div[g_editable="true"]').click();
  await gmail.keyboard.type('Hi Catherine,');
  await gmail.waitForTimeout(500);
  expect(await gmail.evaluate(() => CSS.highlights.has('readback-slip'))).toBe(false);
});
