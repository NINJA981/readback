/**
 * The deterministic demo (SPEC F9, AC-9.1, AC-9.2): `?demo=signature&t=<ms>` freezes any frame of
 * the signature moment, the page reports the engine version it runs, and repeated loads at
 * DPR 2 render the same pixels.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const engineVersion = /ENGINE_VERSION = '([^']+)'/.exec(
  readFileSync(resolve(import.meta.dirname, '..', '..', 'src', 'engine', 'index.ts'), 'utf8'),
)?.[1];

// Frames across the demo: typing, the first slip flagged, mid swap-back, resting.
const FRAMES = [900, 2600, 4600, 6200];

// GPU raster and LCD text anti-aliasing flip a few channel values by 1 or 2 from one browser
// context to the next (measured: one run in six differs, max channel delta 2). Software raster
// with grayscale text is the same pixels every time (20 of 20 identical), so the capture, and
// therefore this test, uses it. It is a property of the renderer, not of the page.
test.use({
  launchOptions: { args: ['--disable-gpu', '--disable-lcd-text', '--force-color-profile=srgb'] },
});

test.describe('deterministic demo capture', () => {
  test('AC-9.1: the page runs the extension engine build, asserted through the engine version string', async ({
    page,
  }) => {
    expect(engineVersion).toBeTruthy();
    await page.goto('/?demo=signature&t=4600');
    await page.waitForFunction(() => (window as unknown as { __rbReady?: boolean }).__rbReady);
    const reported = await page.evaluate(
      () => (window as unknown as { __rb: { engineVersion: string } }).__rb.engineVersion,
    );
    expect(reported).toBe(engineVersion);
    // The web app says the same in its settings dialog.
    await page.goto('/app/?sample=deposit');
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('dialog')).toContainText(`Engine ${engineVersion}`);
  });

  test('AC-9.1: the deposit sample renders 3 asks and, with its scripted reply, 2 slips', async ({
    page,
  }) => {
    await page.goto('/app/?sample=deposit');
    await expect(page.locator('#thread-meta')).toContainText('3 asks');
    await expect(page.locator('section[aria-labelledby="slips-h"] .row')).toHaveCount(2);
  });

  for (const t of FRAMES) {
    test(`AC-9.2: frame t=${t} ms renders the same pixels on repeated runs (DPR 2)`, async ({
      browser,
    }) => {
      const shots: Buffer[] = [];
      for (let run = 0; run < 2; run++) {
        const ctx = await browser.newContext({
          viewport: { width: 1440, height: 900 },
          deviceScaleFactor: 2,
          colorScheme: 'dark',
        });
        const page = await ctx.newPage();
        await page.goto(`/?demo=signature&t=${t}`);
        await page.waitForFunction(() => (window as unknown as { __rbReady?: boolean }).__rbReady);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(300);
        shots.push(
          await page
            .locator('#stage')
            .screenshot({ animations: 'disabled', caret: 'hide', scale: 'device' }),
        );
        await ctx.close();
      }
      expect(shots[0]?.length).toBeGreaterThan(5000);
      expect(shots[1]?.equals(shots[0] as Buffer)).toBe(true);
    });
  }

  test('AC-9.2: stepping window.__rb.frame(ms) forward is reproducible, the way a capture run drives it', async ({
    browser,
  }) => {
    const shots: Buffer[] = [];
    for (let run = 0; run < 2; run++) {
      const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
      });
      const page = await ctx.newPage();
      await page.goto('/?demo=signature&t=900');
      await page.waitForFunction(() => (window as unknown as { __rbReady?: boolean }).__rbReady);
      for (const ms of [1200, 2600, 4600]) {
        await page.evaluate((t) => {
          (window as unknown as { __rb: { frame(ms: number): void } }).__rb.frame(t);
        }, ms);
      }
      await page.waitForTimeout(300);
      shots.push(
        await page.locator('#stage').screenshot({ animations: 'disabled', scale: 'device' }),
      );
      await ctx.close();
    }
    expect(shots[1]?.equals(shots[0] as Buffer)).toBe(true);
  });
});
