import { expect, test } from '@playwright/test';

const PRIVACY = 'Runs entirely in your browser. Nothing is uploaded.';
const SLIPS = 'section[aria-labelledby="slips-h"]';

test.describe('web app (AC-W*)', () => {
  test('empty state offers a sample, the privacy line is visible', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Try Readback in your browser',
    );
    await expect(page.getByText(PRIVACY).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try a sample' })).toBeVisible();
  });

  test('sample thread: guards flag the slips and Fix repairs them', async ({ page }) => {
    await page.goto('/app/');
    await page.getByRole('button', { name: 'Try a sample' }).click();
    const slips = page.locator(SLIPS);
    await expect(slips.locator('.row')).toHaveCount(2);
    await expect(slips).toContainText('Catherine');
    await expect(slips).toContainText('$1,520');
    const reply = page.getByRole('textbox', { name: 'Your reply' });
    await slips.getByRole('button', { name: 'Fix' }).first().click();
    await expect(reply).toHaveValue(/Hi Kathryn,/);
    await slips.getByRole('button', { name: 'Fix' }).first().click();
    await expect(reply).toHaveValue(/\$1,250 deposit/);
    await expect(page.getByTestId('no-slips')).toBeVisible();
    await expect(page.locator('.success-line')).toContainText('No slips');
  });

  test('AC-W.3: typing live, a different person is not flagged and a near-miss is', async ({
    page,
  }) => {
    await page.goto('/app/');
    await page.getByRole('button', { name: 'Try a sample' }).click();
    const reply = page.getByRole('textbox', { name: 'Your reply' });
    await reply.fill('Hi Bob,');
    await expect(page.getByTestId('no-slips')).toBeVisible();
    await reply.fill('Hi Catherine,');
    await expect(page.locator(`${SLIPS} .row`)).toHaveCount(1);
  });

  test('reply without a thread asks for the thread instead of guessing', async ({ page }) => {
    await page.goto('/app/');
    await page.getByRole('textbox', { name: 'Your reply' }).fill('Hi Catherine,');
    await expect(page.getByText('Add the thread above')).toBeVisible();
  });

  test('makes only same-origin static requests', async ({ page }) => {
    const origins = new Set<string>();
    page.on('request', (r) => origins.add(new URL(r.url()).origin));
    await page.goto('/app/');
    await page.getByRole('button', { name: 'Try a sample' }).click();
    await page
      .getByRole('textbox', { name: 'Your reply' })
      .fill('Hi Catherine, the $1,520 deposit');
    await page.waitForTimeout(500);
    expect([...origins]).toEqual(['http://localhost:4173']);
  });

  test('CSP blocks every outgoing connection (connect-src none)', async ({ page }) => {
    await page.goto('/app/');
    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');
    expect(csp).toContain("connect-src 'none'");
    const blocked = await page.evaluate(async () => {
      try {
        await fetch('https://example.com/');
        return false;
      } catch {
        return true;
      }
    });
    expect(blocked).toBe(true);
  });

  test('works fully offline after the first load (service worker)', async ({ page, context }) => {
    await page.goto('/app/');
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.reload();
    await page.getByRole('button', { name: 'Try a sample' }).click();
    await expect(page.locator(`${SLIPS} .row`)).toHaveCount(2);
    await context.setOffline(false);
  });

  test('AC-W.8: manifest is installable', async ({ page, request }) => {
    await page.goto('/app/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    const res = await request.get(new URL(href ?? '', page.url()).href);
    const m = (await res.json()) as {
      display: string;
      icons: { sizes: string; purpose?: string }[];
    };
    expect(m.display).toBe('standalone');
    expect(m.icons.some((i) => i.sizes === '192x192')).toBe(true);
    expect(m.icons.some((i) => i.sizes === '512x512')).toBe(true);
    expect(m.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });

  for (const width of [375, 768, 1440]) {
    test(`AC-W.9: ${width}px, no horizontal scroll, touch targets at least 44px on touch layouts`, async ({
      browser,
    }) => {
      const ctx = await browser.newContext({
        viewport: { width, height: 900 },
        hasTouch: width < 1440,
        isMobile: width < 1440,
      });
      const page = await ctx.newPage();
      await page.goto('/app/?sample=deposit');
      await expect(page.locator(`${SLIPS} .row`)).toHaveCount(2);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      if (width < 1440) {
        const small = await page.evaluate(() => {
          const out: string[] = [];
          const sel = 'button, a[href], select, textarea, input, summary, [role="button"]';
          for (const el of document.querySelectorAll<HTMLElement>(sel)) {
            el.scrollIntoView({ block: 'center' });
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden') continue;
            if (el.closest('.sr-only')) continue;
            // The hit area may be larger than the box (a ::after inset): probe the point
            // 21.5px above and below the centre and count it when the element still owns it.
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            const owns = (x: number, y: number): boolean => {
              const hit = document.elementFromPoint(x, y);
              return !!hit && (hit === el || el.contains(hit));
            };
            const tallEnough = r.height >= 43.5 || (owns(cx, cy - 21) && owns(cx, cy + 21));
            if (!tallEnough || r.width < 43.5) {
              const label = (el.textContent || el.getAttribute('aria-label') || '')
                .trim()
                .slice(0, 30);
              out.push(
                `${el.tagName.toLowerCase()} "${label}" ${Math.round(r.width)}x${Math.round(r.height)}`,
              );
            }
          }
          return out;
        });
        expect(small).toEqual([]);
      }
      await ctx.close();
    });
  }

  test('reduced motion: Fix applies and the reply is repaired', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/app/?sample=deposit');
    await page.locator(SLIPS).getByRole('button', { name: 'Fix' }).first().click();
    await expect(page.getByRole('textbox', { name: 'Your reply' })).toHaveValue(/Hi Kathryn,/);
    await ctx.close();
  });
});
