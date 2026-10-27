import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, expect, test as base } from '@playwright/test';
import type { BrowserContext, Page, Worker } from '@playwright/test';

const EXTENSION = resolve(import.meta.dirname, '..', '.output', 'chrome-mv3');
const GMAIL_FIXTURES = resolve(import.meta.dirname, '..', 'tests', 'fixtures', 'gmail');

/** Every network request the browser made, so the privacy gate can inspect them. */
export interface RequestLog {
  urls: string[];
}

interface Fixtures {
  context: BrowserContext;
  extensionId: string;
  worker: Worker;
  requests: RequestLog;
  /** Opens a Gmail fixture on its real match pattern, served from disk. */
  openGmail: (name: string) => Promise<Page>;
}

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const userDataDir = await mkdtemp(join(tmpdir(), 'readback-e2e-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: true,
      args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
    });
    await use(context);
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  },
  worker: [
    async ({ context }, use) => {
      const [existing] = context.serviceWorkers();
      await use(existing ?? (await context.waitForEvent('serviceworker')));
    },
    { auto: true },
  ],
  extensionId: async ({ worker }, use) => {
    await use(new URL(worker.url()).host);
  },
  requests: [
    async ({ context }, use) => {
      const log: RequestLog = { urls: [] };
      context.on('request', (r) => log.urls.push(r.url()));
      await use(log);
      // AC-G.2, suite-wide: whatever a test did, nothing it touched left this machine.
      expect(
        log.urls.filter((u) => !isLocalRequest(u)),
        'requests that left this machine',
      ).toEqual([]);
    },
    { auto: true },
  ],
  openGmail: async ({ context }, use) => {
    await use(async (name) => {
      const html = await readFile(join(GMAIL_FIXTURES, `${name}.html`), 'utf8');
      await context.route('https://mail.google.com/**', (route) =>
        route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }),
      );
      const page = await context.newPage();
      await page.goto('https://mail.google.com/mail/u/0/#inbox/18c4a1f2b3d4e5f6');
      return page;
    });
  },
});

export { expect };

/** The slice of the extension API the tests read inside the service worker. */
interface ChromeStorageArea {
  get: (keys: null) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
}
declare const chrome: { storage: { session: ChromeStorageArea; local: ChromeStorageArea } };

/** Writes to chrome.storage.local the way the options page would. */
export function writeLocal(worker: Worker, items: Record<string, unknown>): Promise<void> {
  return worker.evaluate((data) => chrome.storage.local.set(data), items);
}

/** Chrome's storage.session as the extension sees it. */
export function readSession(worker: Worker): Promise<Record<string, unknown>> {
  return worker.evaluate(() => chrome.storage.session.get(null));
}

export function readLocal(worker: Worker): Promise<Record<string, unknown>> {
  return worker.evaluate(() => chrome.storage.local.get(null));
}

/** Text of every range registered under a highlight name, in the page. */
export function highlightTexts(page: Page, name: string): Promise<string[]> {
  return page.evaluate(
    (n) =>
      [...(CSS.highlights.get(n) ?? [])].map((r) =>
        (r as unknown as { toString(): string }).toString(),
      ),
    name,
  );
}

/** True for URLs that stay on this machine (the privacy gate, SPEC AC-G.2). */
export function isLocalRequest(url: string): boolean {
  if (/^(?:chrome-extension|moz-extension|data|blob|about|chrome):/.test(url)) return true;
  // The Gmail fixture origin is fulfilled from disk by the test, never contacted.
  if (url.startsWith('https://mail.google.com/')) return true;
  // The parity test serves the built site from a loopback server it started itself.
  return /^http:\/\/(?:127\.0\.0\.1|localhost)[:/]/.test(url);
}
