/**
 * axe-core over every popup, options and overlay state in the screenshot gallery, in both themes
 * (SPEC AC-G.3). The live pages only reach a few states (idle popup, empty options); the gallery
 * renders all of them with the real components, which is where QA round 1 found its violations.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { axeBuilder, violationsOf } from './axe';
import { serveStatic } from './site-server';
import type { StaticServer } from './site-server';

const ROOT = resolve(import.meta.dirname, '..');
const GALLERY = resolve(ROOT, '.gallery');

/** Page-level rules that a component fragment rendered alone cannot satisfy (no <main>, no h1). */
const FRAGMENT_RULES = ['region', 'landmark-one-main', 'page-has-heading-one'];

let server: StaticServer;

test.beforeAll(async () => {
  execFileSync(
    process.execPath,
    [
      resolve(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'),
      'build',
      '-c',
      'gallery/vite.config.ts',
    ],
    { cwd: ROOT, stdio: 'ignore' },
  );
  server = await serveStatic(GALLERY);
});

test.afterAll(async () => {
  await server.close();
});

for (const theme of ['light', 'dark'] as const) {
  test(`every gallery scene has no WCAG A/AA violations, ${theme} theme`, async ({ browser }) => {
    test.setTimeout(240_000);
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      colorScheme: theme,
    });
    const page = await context.newPage();
    await page.goto(`${server.origin}/?scene=index&theme=${theme}`);
    const scenes = await page
      .locator('a[href*="scene="]')
      .evaluateAll((links) =>
        links.map((a) => new URL((a as HTMLAnchorElement).href).searchParams.get('scene') ?? ''),
      );
    expect(scenes.length).toBeGreaterThanOrEqual(25);

    const failures: string[] = [];
    for (const scene of scenes) {
      await page.goto(`${server.origin}/?scene=${scene}&theme=${theme}`);
      await page.evaluate(() => document.fonts.ready);
      // Cards and the pill fade in; axe reads colours at rest.
      await page.waitForTimeout(450);
      for (const v of await violationsOf(axeBuilder(page, FRAGMENT_RULES)))
        failures.push(`${scene}: ${v}`);
    }
    await context.close();
    expect(failures).toEqual([]);
  });
}

test('the axe configuration really flags a label-in-name mismatch (guards the gate itself)', async ({
  page,
}) => {
  await page.setContent(
    '<main><h1>t</h1><button aria-label="Open the ask ledger">3 asks · 1 open</button></main>',
  );
  const found = await violationsOf(axeBuilder(page));
  expect(found.join('\n')).toContain('label-content-name-mismatch');
});
