/**
 * Smoke test for the built site: every page loads, every file it references exists, nothing logs
 * an error, and the root files crawlers and installers look for are served. Runs on the production
 * build behind `vite preview`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, test } from '@playwright/test';
import { DIST, distFileFor } from './helpers';

const PAGES = [
  { path: '/', h1: /Spellcheck that read the thread/ },
  { path: '/app/', h1: /Try Readback in your browser/ },
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

test.describe('site smoke', () => {
  for (const { path, h1 } of PAGES) {
    test(`${path} loads clean: 200, h1, title, description, no console errors, no failed requests`, async ({
      page,
    }) => {
      const problems: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error' || m.type() === 'warning')
          problems.push(`console ${m.type()}: ${m.text()}`);
      });
      page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
      page.on('requestfailed', (r) =>
        problems.push(`failed: ${r.url()} ${r.failure()?.errorText}`),
      );
      page.on('response', (r) => {
        if (r.status() >= 400) problems.push(`${r.status()}: ${r.url()}`);
      });
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(h1);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      expect((await page.title()).length).toBeGreaterThan(8);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{40,}/);
      await expect(page.locator('meta[name="viewport"]')).toHaveCount(1);
      await page.waitForTimeout(800);
      expect(problems).toEqual([]);
    });
  }

  test('the landing page links to the app and the app links back, both resolving', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Try it in your browser, no install' }).click();
    await expect(page).toHaveURL(/\/app\/$/);
    await page.getByRole('link', { name: 'Readback, back to the site' }).click();
    await expect(page).toHaveURL(/localhost:4173\/$/);
  });

  test('every local file the built HTML references exists in dist/', () => {
    const pages = walk(DIST).filter((f) => f.endsWith('.html'));
    expect(pages.length).toBeGreaterThanOrEqual(2);
    const missing: string[] = [];
    for (const file of pages) {
      const html = readFileSync(file, 'utf8');
      const base = new URL(`http://x/${relative(DIST, file).replaceAll('\\', '/')}`);
      for (const m of html.matchAll(/\s(?:src|href)="([^"#]+)"/g)) {
        const ref = m[1] as string;
        if (/^(?:https?:|mailto:|data:|tel:)/.test(ref)) continue;
        const target = new URL(ref, base);
        if (!distFileFor(`http://localhost:4173${target.pathname}`)) {
          missing.push(`${relative(DIST, file)} -> ${ref}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  test('robots.txt, llms.txt, the manifest, the service worker and the share image are served', async ({
    request,
  }) => {
    const wanted: [string, RegExp][] = [
      ['/robots.txt', /text\/plain/],
      ['/llms.txt', /text\/plain/],
      ['/favicon.svg', /image\/svg/],
      ['/og.png', /image\/png/],
      ['/apple-touch-icon.png', /image\/png/],
      ['/app/manifest.webmanifest', /(json|manifest)/],
      ['/app/sw.js', /javascript/],
    ];
    for (const [path, type] of wanted) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      expect(res.headers()['content-type'], path).toMatch(type);
    }
  });

  test('/app without the slash redirects to /app/', async ({ page }) => {
    await page.goto('/app');
    await expect(page).toHaveURL(/\/app\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Try Readback');
  });

  test('the site ships no text a human would call a placeholder', () => {
    const offenders: string[] = [];
    for (const file of walk(DIST).filter((f) => /\.(html|txt|webmanifest)$/.test(f))) {
      const text = readFileSync(file, 'utf8');
      if (/lorem ipsum|TODO|FIXME|coming soon/i.test(text)) offenders.push(relative(DIST, file));
    }
    expect(offenders).toEqual([]);
  });
});
