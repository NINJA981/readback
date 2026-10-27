/** Installability and the service worker (SPEC AC-W.7, AC-W.8), on both viewports. */
import { expect, test } from '@playwright/test';

interface Manifest {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  icons: { src: string; sizes: string; type: string; purpose?: string }[];
}

/** A PNG's pixel size from its IHDR chunk: enough to check icon files without a decoder. */
function pngSize(bytes: Buffer): { width: number; height: number } {
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('not a PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test.describe('PWA', () => {
  test('AC-W.8: the manifest meets the install criteria and every icon is a real PNG of its declared size', async ({
    page,
    request,
  }) => {
    await page.goto('/app/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    const manifestUrl = new URL(href ?? '', page.url());
    const res = await request.get(manifestUrl.href);
    expect(res.status()).toBe(200);
    const m = (await res.json()) as Manifest;
    expect(m.name).toBeTruthy();
    expect(m.short_name).toBeTruthy();
    expect(m.display).toBe('standalone');
    // start_url is inside scope, and the scope is the app route.
    const start = new URL(m.start_url, manifestUrl);
    const scope = new URL(m.scope, manifestUrl);
    expect(start.pathname.startsWith(scope.pathname)).toBe(true);
    expect(scope.pathname).toBe('/app/');
    expect(m.icons.some((i) => i.sizes === '192x192')).toBe(true);
    for (const purpose of ['any', 'maskable']) {
      expect(m.icons.some((i) => i.sizes === '512x512' && (i.purpose ?? 'any') === purpose)).toBe(
        true,
      );
    }
    for (const icon of m.icons) {
      const r = await request.get(new URL(icon.src, manifestUrl).href);
      expect(r.status(), icon.src).toBe(200);
      expect(r.headers()['content-type']).toContain('image/png');
      const [w, h] = icon.sizes.split('x').map(Number);
      expect(pngSize(await r.body()), icon.src).toEqual({ width: w, height: h });
    }
    await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute('content', /#/);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  });

  test('the service worker registers in scope, activates, takes control and fills one cache', async ({
    page,
  }) => {
    await page.goto('/app/');
    // `ready` resolves once a worker is active, which can be a tick before it reports 'activated'.
    const reg = await page.evaluate(async () => {
      const r = await navigator.serviceWorker.ready;
      const w = r.active;
      if (w && w.state !== 'activated') {
        await new Promise<void>((done) => {
          w.addEventListener('statechange', () => {
            if (w.state === 'activated') done();
          });
        });
      }
      return { scope: r.scope, state: w?.state, script: w?.scriptURL };
    });
    expect(reg.scope).toMatch(/\/app\/$/);
    expect(reg.state).toBe('activated');
    expect(reg.script).toMatch(/\/app\/sw\.js$/);
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    const caches = await page.evaluate(async () => {
      const names = await window.caches.keys();
      const sizes: Record<string, number> = {};
      for (const n of names) sizes[n] = (await (await window.caches.open(n)).keys()).length;
      return sizes;
    });
    const names = Object.keys(caches);
    expect(names).toHaveLength(1);
    expect(names[0]).toMatch(/^readback-app-/);
    expect(caches[names[0] as string]).toBeGreaterThan(8);
  });
});
