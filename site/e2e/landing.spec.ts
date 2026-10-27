import { expect, test } from '@playwright/test';

test.describe('landing page (AC-W.11)', () => {
  test('hero: one h1, the no-install link to /app, no canvas', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Spellcheck that read the thread',
    );
    const link = page.getByRole('link', { name: 'Try it in your browser, no install' });
    await expect(link).toBeVisible();
    expect(await link.getAttribute('href')).toMatch(/app\/?$/);
    expect(await page.locator('canvas').count()).toBe(0);
  });

  test('every section is present', async ({ page }) => {
    await page.goto('/');
    for (const re of [
      /how it works/i,
      /no server to send it to/i,
      /add it to your browser/i,
      /open source/i,
    ]) {
      await expect(page.getByRole('heading', { name: re }).first()).toBeAttached();
    }
  });

  test('no third-party requests', async ({ page }) => {
    const origins = new Set<string>();
    page.on('request', (r) => origins.add(new URL(r.url()).origin));
    await page.goto('/');
    await page.waitForTimeout(1000);
    expect([...origins]).toEqual(['http://localhost:4173']);
  });

  test('reduced motion: a Play control exists instead of autoplay', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.getByRole('button', { name: /play|replay/i }).first()).toBeVisible();
    await ctx.close();
  });

  test('no horizontal scroll at 375 px', async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 800 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.waitForTimeout(500);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await ctx.close();
  });
});
