/**
 * axe-core on every surface of the site (SPEC AC-G.3): the landing page and each state of the
 * web app, in both themes, at the phone and the desktop viewport.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { SLIPS, forceTheme, press } from './helpers';

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.map(
    (v) => `${v.id} (${v.impact ?? '?'}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
}

for (const scheme of ['dark', 'light'] as const) {
  test.describe(`axe, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });
    test.beforeEach(async ({ context }) => {
      await forceTheme(context, scheme);
    });

    test('landing page', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      // Let the signature demo settle so axe reads its resting state, then once more mid-motion.
      await page.waitForTimeout(600);
      expect(await violations(page)).toEqual([]);
      await page.waitForTimeout(4000);
      expect(await violations(page)).toEqual([]);
    });

    test('landing page with reduced motion (Play control)', async ({ browser }) => {
      const ctx = await browser.newContext({
        ...test.info().project.use,
        colorScheme: scheme,
        reducedMotion: 'reduce',
      });
      await forceTheme(ctx, scheme);
      const page = await ctx.newPage();
      await page.goto('/');
      await expect(page.getByRole('button', { name: /play|replay/i }).first()).toBeVisible();
      expect(await violations(page)).toEqual([]);
      await ctx.close();
    });

    test('web app: empty state', async ({ page }) => {
      await page.goto('/app/');
      await expect(page.getByRole('button', { name: 'Try a sample' })).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test('web app: sample loaded, slips and asks listed', async ({ page }) => {
      await page.goto('/app/');
      await press(page.getByRole('button', { name: 'Try a sample' }));
      await expect(page.locator(`${SLIPS} .row`)).toHaveCount(2);
      expect(await violations(page)).toEqual([]);
    });

    test('web app: guard card open on a slip', async ({ page }) => {
      await page.goto('/app/?sample=deposit');
      await expect(page.locator(`${SLIPS} .row`)).toHaveCount(2);
      await press(page.locator(SLIPS).getByRole('button', { name: /Catherine should be/ }));
      await expect(page.getByRole('dialog')).toBeVisible();
      // The sheet fades in; axe must read colours at rest, not mid-transition.
      await page.waitForTimeout(600);
      expect(await violations(page)).toEqual([]);
    });

    test('web app: all slips fixed (success state)', async ({ page }) => {
      await page.goto('/app/?sample=deposit');
      await press(page.locator(SLIPS).getByRole('button', { name: 'Fix' }).first());
      await press(page.locator(SLIPS).getByRole('button', { name: 'Fix' }).first());
      await expect(page.locator('.success-line')).toBeVisible();
      // The swap-back motion is over before the resting state is read.
      await page.waitForTimeout(600);
      expect(await violations(page)).toEqual([]);
    });

    test('web app: thread too long (error state)', async ({ page }) => {
      await page.goto('/app/');
      await page
        .getByRole('textbox', { name: "The message you're replying to" })
        .fill('a '.repeat(25_001));
      await expect(
        page.getByRole('alert').filter({ hasText: 'longer than Readback' }),
      ).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test('web app: settings dialog', async ({ page }) => {
      await page.goto('/app/?sample=deposit');
      await press(page.getByRole('button', { name: 'Settings' }));
      await expect(page.getByRole('dialog')).toBeVisible();
      // The sheet fades in; axe must read colours at rest, not mid-transition.
      await page.waitForTimeout(600);
      expect(await violations(page)).toEqual([]);
    });
  });
}
