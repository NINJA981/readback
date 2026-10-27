/**
 * Storage keys (SPEC §7). Local: settings and the ignore list. Session:
 * per-thread state (`t:<threadKey>`) and per-tab status (`tab:<id>`).
 * Nothing else is ever written.
 */
export const SETTINGS_KEY = 'settings';
export const IGNORE_KEY = 'ignore';
export const THREAD_PREFIX = 't:';
export const TAB_PREFIX = 'tab:';

export const threadKeyOf = (threadKey: string): string => `${THREAD_PREFIX}${threadKey}`;
export const tabKeyOf = (tabId: number): string => `${TAB_PREFIX}${tabId}`;

/** True for any key Readback owns (used by Clear all). */
export function isReadbackKey(key: string): boolean {
  return (
    key === SETTINGS_KEY ||
    key === IGNORE_KEY ||
    key.startsWith(THREAD_PREFIX) ||
    key.startsWith(TAB_PREFIX)
  );
}
