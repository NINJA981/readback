import { useSyncExternalStore } from 'react';
import { extensionStorage } from '../platform/runtime-storage';
import { EMPTY_IGNORE } from '../state/ignore';
import { DEFAULT_SETTINGS } from '../state/settings';
import type { Store } from '../state/store';
import type { IgnoreList, Settings } from '../engine/types';
import { createLiveStore } from './live-store';
import type { Live } from './live-store';

let settings: Store<Live<Settings>> | undefined;
let ignore: Store<Live<IgnoreList>> | undefined;

function settingsStore(): Store<Live<Settings>> {
  const storage = extensionStorage();
  settings ??= createLiveStore<Settings>(
    DEFAULT_SETTINGS,
    () => storage.getSettings(),
    (l) => storage.watchSettings(l),
  );
  return settings;
}

function ignoreStore(): Store<Live<IgnoreList>> {
  const storage = extensionStorage();
  ignore ??= createLiveStore<IgnoreList>(
    EMPTY_IGNORE,
    () => storage.getIgnore(),
    (l) => storage.watchIgnore(l),
  );
  return ignore;
}

function useLive<T>(store: Store<Live<T>>): Live<T> {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

export const useSettings = (): Live<Settings> => useLive(settingsStore());
export const useIgnore = (): Live<IgnoreList> => useLive(ignoreStore());

/** Writes go through the storage layer, which validates them; the watcher updates the store. */
export const updateSettings = (fn: (s: Settings) => Settings): Promise<Settings> =>
  extensionStorage().updateSettings(fn);
export const updateIgnore = (fn: (l: IgnoreList) => IgnoreList): Promise<IgnoreList> =>
  extensionStorage().updateIgnore(fn);
