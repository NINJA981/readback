/**
 * A key-value storage area: the only storage surface the rest of Readback
 * sees. The extension backs it with `browser.storage.local` / `.session`
 * (src/platform/extension-storage.ts); the web app with `localStorage` /
 * `sessionStorage` (src/platform/web-storage.ts); tests with memory.
 *
 * Values must be JSON-serialisable. Reads return `unknown` on purpose: every
 * caller parses what comes back.
 */
export interface StorageChange {
  key: string;
  newValue: unknown;
}

export interface StorageArea {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
  /** All keys currently stored in this area (including other apps' on shared origins). */
  keys(): Promise<string[]>;
  /** Subscribes to changes made by any context (other tabs, the popup). */
  watch?(listener: (changes: StorageChange[]) => void): () => void;
}

/** In-memory area for tests and for hosts with no persistent storage. */
export function createMemoryArea(seed: Record<string, unknown> = {}): StorageArea & {
  dump(): Record<string, unknown>;
} {
  const data = new Map<string, string>(
    Object.entries(seed).map(([k, v]) => [k, JSON.stringify(v)]),
  );
  const listeners = new Set<(changes: StorageChange[]) => void>();
  const emit = (changes: StorageChange[]): void => {
    if (changes.length === 0) return;
    for (const l of [...listeners]) l(changes);
  };
  return {
    get(key) {
      const raw = data.get(key);
      return Promise.resolve(raw === undefined ? undefined : (JSON.parse(raw) as unknown));
    },
    set(key, value) {
      // Round-trip through JSON so tests catch non-serialisable values early.
      const raw = JSON.stringify(value) as string | undefined;
      if (raw === undefined) return Promise.reject(new TypeError('Value is not JSON-serialisable'));
      data.set(key, raw);
      emit([{ key, newValue: JSON.parse(raw) as unknown }]);
      return Promise.resolve();
    },
    remove(keys) {
      const list = typeof keys === 'string' ? [keys] : keys;
      const changes: StorageChange[] = [];
      for (const k of list) if (data.delete(k)) changes.push({ key: k, newValue: undefined });
      emit(changes);
      return Promise.resolve();
    },
    keys() {
      return Promise.resolve([...data.keys()]);
    },
    watch(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dump() {
      return Object.fromEntries([...data].map(([k, v]) => [k, JSON.parse(v) as unknown]));
    },
  };
}
