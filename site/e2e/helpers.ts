import { existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { BrowserContext, Locator, Page, Request } from '@playwright/test';
import { test } from '@playwright/test';

export const DIST = resolve(import.meta.dirname, '..', 'dist');
export const ORIGIN = 'http://localhost:4173';

/** A tap on the phone project (real touch events), a click on the desktop one. */
export async function press(target: Locator): Promise<void> {
  if (test.info().project.use.hasTouch) await target.tap();
  else await target.click();
}

export const isPhone = (): boolean => test.info().project.use.hasTouch === true;

/** The file under `dist/` a same-origin URL maps to, or undefined when there is none. */
export function distFileFor(url: string): string | undefined {
  const { pathname } = new URL(url);
  const rel = decodeURIComponent(pathname).replace(/^\/+/, '');
  const path = join(DIST, rel);
  if (!path.startsWith(DIST)) return undefined;
  if (existsSync(path) && statSync(path).isDirectory()) {
    const index = join(path, 'index.html');
    return existsSync(index) ? index : undefined;
  }
  return existsSync(path) ? path : undefined;
}

export interface NetworkLog {
  requests: Request[];
  websockets: string[];
  /** Everything that is not a plain GET of a file that exists in dist/. */
  offenders(): string[];
}

/** Records every request the context makes, including the service worker's, and its websockets. */
export function watchNetwork(context: BrowserContext): NetworkLog {
  const requests: Request[] = [];
  const websockets: string[] = [];
  context.on('request', (r) => requests.push(r));
  const hook = (page: Page): void => {
    page.on('websocket', (ws) => websockets.push(ws.url()));
  };
  context.pages().forEach(hook);
  context.on('page', hook);
  return {
    requests,
    websockets,
    offenders() {
      const out: string[] = [];
      for (const r of requests) {
        const url = r.url();
        if (url.startsWith('data:') || url.startsWith('blob:')) continue;
        if (new URL(url).origin !== ORIGIN) out.push(`foreign origin: ${r.method()} ${url}`);
        else if (r.method() !== 'GET') out.push(`not a GET: ${r.method()} ${url}`);
        else if (r.postData()) out.push(`has a body: ${url}`);
        else if (!distFileFor(url)) out.push(`not a static file in dist/: ${url}`);
      }
      for (const ws of websockets) out.push(`websocket: ${ws}`);
      return out;
    },
  };
}

export const SLIPS = 'section[aria-labelledby="slips-h"]';

/** Forces the site theme before the page's own inline script reads it. */
export async function forceTheme(context: BrowserContext, theme: 'light' | 'dark'): Promise<void> {
  await context.addInitScript((t) => {
    try {
      localStorage.setItem('readback:settings', JSON.stringify({ theme: t }));
    } catch {
      // Storage blocked: the test then runs in the emulated colour scheme only.
    }
  }, theme);
}
