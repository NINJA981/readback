/**
 * `StorageArea` over `browser.storage.local` / `.session`. This file and the
 * entrypoints are the only code that imports `wxt/browser`; everything under
 * `src/core` stays free of extension APIs so the web app can reuse it.
 */
import { browser } from 'wxt/browser';
import type { StorageArea, StorageChange } from '../storage/area';

type AreaName = 'local' | 'session';

export function createExtensionArea(name: AreaName): StorageArea {
  const area = browser.storage[name];
  return {
    async get(key) {
      const found: Record<string, unknown> = await area.get(key);
      return found[key];
    },
    async set(key, value) {
      await area.set({ [key]: value });
    },
    async remove(keys) {
      await area.remove(keys);
    },
    async keys() {
      const all: Record<string, unknown> = await area.get(null);
      return Object.keys(all);
    },
    watch(listener) {
      const onChanged = (
        changes: Record<string, { newValue?: unknown }>,
        areaName: string,
      ): void => {
        if (areaName !== name) return;
        const list: StorageChange[] = Object.entries(changes).map(([key, c]) => ({
          key,
          newValue: c.newValue,
        }));
        listener(list);
      };
      browser.storage.onChanged.addListener(onChanged);
      return () => {
        browser.storage.onChanged.removeListener(onChanged);
      };
    },
  };
}

/**
 * Lets content scripts read `storage.session` (Chrome keeps it background-only
 * by default). Called once from the background; harmless where unsupported.
 */
export async function allowSessionInContentScripts(): Promise<void> {
  try {
    await browser.storage.session.setAccessLevel({
      accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS',
    });
  } catch {
    // Firefox and older Chromium: content scripts already can, or storage.session is unavailable.
  }
}
