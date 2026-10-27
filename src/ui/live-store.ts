/**
 * A store that mirrors a storage value: loaded once, then kept current by the
 * storage watcher (so the popup and options reflect changes made elsewhere,
 * for example by the Gmail content script). React reads it with
 * `useSyncExternalStore`, so there is no effect-driven state copy.
 */
import { createStore } from '../state/store';
import type { Store } from '../state/store';

export interface Live<T> {
  loaded: boolean;
  value: T;
}

export function createLiveStore<T>(
  initial: T,
  load: () => Promise<T>,
  watch: (listener: (value: T) => void) => () => void,
): Store<Live<T>> {
  const store = createStore<Live<T>>({ loaded: false, value: initial });
  watch((value) => {
    store.setState({ loaded: true, value });
  });
  load().then(
    (value) => {
      store.setState({ loaded: true, value });
    },
    () => {
      // Storage unreadable: keep the defaults, and let the page render.
      store.setState((s) => ({ ...s, loaded: true }));
    },
  );
  return store;
}
