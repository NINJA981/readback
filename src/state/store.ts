/**
 * A minimal external store: `getSnapshot` + `subscribe`, the exact shape
 * React's `useSyncExternalStore` expects. Snapshots are replaced, never
 * mutated, so identity comparison is enough to skip re-renders.
 */
export interface Store<T> {
  getSnapshot: () => T;
  subscribe: (listener: () => void) => () => void;
  setState: (next: T | ((prev: T) => T)) => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setState(next) {
      const value = typeof next === 'function' ? (next as (prev: T) => T)(state) : next;
      if (Object.is(value, state)) return;
      state = value;
      // Copy so a listener that unsubscribes during notify cannot skip a sibling.
      for (const l of [...listeners]) l();
    },
  };
}
