/**
 * `StorageArea` over the Web Storage API, for the web app and the playground
 * (`localStorage` for settings and the ignore list, `sessionStorage` for the
 * rest). Keys are namespaced so the area never reads or clears other apps'
 * data on a shared origin. Every access is guarded: Safari private mode,
 * blocked site data and quota errors must never break the page.
 */
import type { StorageArea, StorageChange } from '../storage/area';

/** The subset of `Storage` the adapter uses (lets tests pass a fake). */
export interface WebStorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface WebAreaOptions {
  /** Namespace prefix. Default `readback:`. */
  prefix?: string;
  /** Source of cross-tab `storage` events; defaults to `globalThis` when it can listen. */
  events?: {
    addEventListener(type: 'storage', listener: (e: StorageEventLike) => void): void;
    removeEventListener(type: 'storage', listener: (e: StorageEventLike) => void): void;
  };
}

export interface StorageEventLike {
  key: string | null;
  newValue: string | null;
  storageArea: unknown;
}

export function createWebArea(storage: WebStorageLike, options: WebAreaOptions = {}): StorageArea {
  const prefix = options.prefix ?? 'readback:';
  const events = options.events;

  const ownKeys = (): string[] => {
    const out: string[] = [];
    try {
      for (let i = 0; i < storage.length; i += 1) {
        const k = storage.key(i);
        if (k?.startsWith(prefix)) out.push(k.slice(prefix.length));
      }
    } catch {
      // Storage unavailable: behave as empty.
    }
    return out;
  };

  const parse = (raw: string | null): unknown => {
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return undefined;
    }
  };

  return {
    get(key) {
      try {
        return Promise.resolve(parse(storage.getItem(prefix + key)));
      } catch {
        return Promise.resolve(undefined);
      }
    },
    set(key, value) {
      const raw = JSON.stringify(value) as string | undefined;
      if (raw === undefined) return Promise.reject(new TypeError('Value is not JSON-serialisable'));
      try {
        storage.setItem(prefix + key, raw);
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(e instanceof Error ? e : new Error('Storage write failed'));
      }
    },
    remove(keys) {
      const list = typeof keys === 'string' ? [keys] : keys;
      try {
        for (const k of list) storage.removeItem(prefix + k);
      } catch {
        // Nothing to remove if storage is unavailable.
      }
      return Promise.resolve();
    },
    keys: () => Promise.resolve(ownKeys()),
    ...(events
      ? {
          watch(listener: (changes: StorageChange[]) => void) {
            const onStorage = (e: StorageEventLike): void => {
              if (e.storageArea !== storage || !e.key?.startsWith(prefix)) return;
              listener([{ key: e.key.slice(prefix.length), newValue: parse(e.newValue) }]);
            };
            events.addEventListener('storage', onStorage);
            return () => {
              events.removeEventListener('storage', onStorage);
            };
          },
        }
      : {}),
  };
}

/** `localStorage` / `sessionStorage` areas, or in-memory fallbacks if unavailable. */
export function browserWebStorage(kind: 'local' | 'session'): WebStorageLike | undefined {
  try {
    const g = globalThis as { localStorage?: WebStorageLike; sessionStorage?: WebStorageLike };
    const s = kind === 'local' ? g.localStorage : g.sessionStorage;
    if (!s) return undefined;
    // Touching the object can throw SecurityError; probe once.
    if (s.length < 0) return undefined;
    return s;
  } catch {
    return undefined;
  }
}
