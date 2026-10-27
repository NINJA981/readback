/**
 * Typed access to everything Readback stores (SPEC §7, §8), on top of two
 * `StorageArea`s. Every read is parsed (storage is untrusted), every write is
 * validated, and read-modify-write updates on one key are serialised so two
 * quick clicks cannot lose an update.
 *
 * Known limit (accepted, documented in HANDOFF): the serial queue lives in one JS context. The
 * popup, the options page and several Gmail tabs are separate contexts, and `chrome.storage` has
 * no atomic update, so two writes to `settings` or `ignore` from different contexts within the
 * same few milliseconds can still lose one of them (last writer wins). The data is a handful of
 * toggles and ignored words, a lost one is visible and easy to redo, and a cross-context lock
 * would need `navigator.locks` in every context, which is not worth it at this size.
 */
import type { IgnoreList, Settings, ThreadState } from '../engine/types';
import { parseIgnoreList } from '../state/ignore';
import { parseSettings } from '../state/settings';
import {
  emptyThreadState,
  isEmptyThreadState,
  isThreadKey,
  parseThreadState,
  reduceThreadState,
} from '../state/thread-state';
import type { ThreadAction } from '../state/thread-state';
import type { StorageArea } from './area';
import {
  IGNORE_KEY,
  SETTINGS_KEY,
  TAB_PREFIX,
  THREAD_PREFIX,
  isReadbackKey,
  tabKeyOf,
  threadKeyOf,
} from './keys';
import { parseTabStatus } from './tab-status';
import type { TabStatus } from './tab-status';

/** Thread states kept per browser session before the oldest are pruned. */
export const MAX_THREADS = 300;

export interface StorageInventory {
  settings: boolean;
  ignoredNames: number;
  ignoredNumbers: number;
  threads: number;
  tabs: number;
}

export interface ReadbackStorage {
  getSettings(): Promise<Settings>;
  updateSettings(fn: (s: Settings) => Settings): Promise<Settings>;
  watchSettings(listener: (s: Settings) => void): () => void;

  getIgnore(): Promise<IgnoreList>;
  setIgnore(list: IgnoreList): Promise<IgnoreList>;
  updateIgnore(fn: (l: IgnoreList) => IgnoreList): Promise<IgnoreList>;
  watchIgnore(listener: (l: IgnoreList) => void): () => void;

  getThreadState(threadKey: string): Promise<ThreadState>;
  setThreadState(threadKey: string, state: ThreadState): Promise<void>;
  dispatchThread(threadKey: string, action: ThreadAction): Promise<ThreadState>;

  getTabStatus(tabId: number): Promise<TabStatus | undefined>;
  setTabStatus(tabId: number, status: TabStatus): Promise<void>;
  clearTabStatus(tabId: number): Promise<void>;

  /** What is stored, as counts only (the options "Your data" panel). */
  inventory(): Promise<StorageInventory>;
  /** Removes every Readback key from both areas (Options → Clear all). */
  clearAll(): Promise<void>;
}

export interface StorageDeps {
  local: StorageArea;
  session: StorageArea;
  now?: () => number;
}

export function createReadbackStorage({
  local,
  session,
  now = () => Date.now(),
}: StorageDeps): ReadbackStorage {
  const queues = new Map<string, Promise<unknown>>();
  /** Runs `task` after any pending task on the same key. */
  const serial = <T>(key: string, task: () => Promise<T>): Promise<T> => {
    const prev = queues.get(key) ?? Promise.resolve();
    const next = prev.then(task, task);
    const settled = next.catch(() => undefined);
    queues.set(key, settled);
    void settled.then(() => {
      if (queues.get(key) === settled) queues.delete(key);
    });
    return next;
  };

  const getSettings = async (): Promise<Settings> => parseSettings(await local.get(SETTINGS_KEY));
  const getIgnore = async (): Promise<IgnoreList> => parseIgnoreList(await local.get(IGNORE_KEY));

  const getThreadState = async (threadKey: string): Promise<ThreadState> => {
    if (!isThreadKey(threadKey)) return emptyThreadState();
    return parseThreadState(await session.get(threadKeyOf(threadKey)));
  };

  const pruneThreads = async (): Promise<void> => {
    const keys = (await session.keys()).filter((k) => k.startsWith(THREAD_PREFIX));
    if (keys.length <= MAX_THREADS) return;
    const aged = await Promise.all(
      keys.map(async (k) => ({ k, at: parseThreadState(await session.get(k)).updatedAt })),
    );
    aged.sort((a, b) => a.at - b.at);
    await session.remove(aged.slice(0, keys.length - MAX_THREADS).map((a) => a.k));
  };

  const setThreadState = async (threadKey: string, state: ThreadState): Promise<void> => {
    if (!isThreadKey(threadKey)) return;
    const clean = parseThreadState(state);
    if (isEmptyThreadState(clean)) {
      await session.remove(threadKeyOf(threadKey));
      return;
    }
    await session.set(threadKeyOf(threadKey), clean);
    await pruneThreads();
  };

  const watchKey = <T>(
    area: StorageArea,
    key: string,
    parse: (raw: unknown) => T,
    listener: (v: T) => void,
  ) => {
    if (!area.watch) return () => undefined;
    return area.watch((changes) => {
      for (const c of changes) if (c.key === key) listener(parse(c.newValue));
    });
  };

  return {
    getSettings,
    updateSettings: (fn) =>
      serial(SETTINGS_KEY, async () => {
        const next = parseSettings(fn(await getSettings()));
        await local.set(SETTINGS_KEY, next);
        return next;
      }),
    watchSettings: (listener) => watchKey(local, SETTINGS_KEY, parseSettings, listener),

    getIgnore,
    setIgnore: (list) =>
      serial(IGNORE_KEY, async () => {
        const next = parseIgnoreList(list);
        await local.set(IGNORE_KEY, next);
        return next;
      }),
    updateIgnore: (fn) =>
      serial(IGNORE_KEY, async () => {
        const next = parseIgnoreList(fn(await getIgnore()));
        await local.set(IGNORE_KEY, next);
        return next;
      }),
    watchIgnore: (listener) => watchKey(local, IGNORE_KEY, parseIgnoreList, listener),

    getThreadState,
    setThreadState: (threadKey, state) =>
      serial(threadKeyOf(threadKey), () => setThreadState(threadKey, state)),
    dispatchThread: (threadKey, action) =>
      serial(threadKeyOf(threadKey), async () => {
        const next = reduceThreadState(await getThreadState(threadKey), action, now());
        await setThreadState(threadKey, next);
        return next;
      }),

    getTabStatus: async (tabId) => parseTabStatus(await session.get(tabKeyOf(tabId))),
    setTabStatus: async (tabId, status) => {
      const clean = parseTabStatus(status);
      if (clean) await session.set(tabKeyOf(tabId), clean);
    },
    clearTabStatus: (tabId) => session.remove(tabKeyOf(tabId)),

    inventory: async () => {
      const [settingsRaw, ignore, sessionKeys] = await Promise.all([
        local.get(SETTINGS_KEY),
        getIgnore(),
        session.keys(),
      ]);
      return {
        settings: settingsRaw !== undefined,
        ignoredNames: ignore.names.length,
        ignoredNumbers: ignore.numbers.length,
        threads: sessionKeys.filter((k) => k.startsWith(THREAD_PREFIX)).length,
        tabs: sessionKeys.filter((k) => k.startsWith(TAB_PREFIX)).length,
      };
    },
    clearAll: async () => {
      const [l, s] = await Promise.all([local.keys(), session.keys()]);
      await Promise.all([
        local.remove(l.filter(isReadbackKey)),
        session.remove(s.filter(isReadbackKey)),
      ]);
    },
  };
}
