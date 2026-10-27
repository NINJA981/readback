/**
 * Per-thread state (SPEC §7 `ThreadState`): which asks the user dismissed or
 * confirmed and which flags they ignored for this thread. Values are opaque
 * hashed ids only, never message text (SPEC §8), and the parser drops anything
 * that is not shaped like an id.
 */
import type { ThreadState } from '../engine/types';

/** Ids are the engine's `shortId`: 16 lower-case hex characters. */
const ID_RE = /^[0-9a-f]{16}$/;
/** Thread keys are full SHA-256 hex digests. */
const THREAD_KEY_RE = /^[0-9a-f]{64}$/;
/** Per-list cap; a thread never has more than a handful of asks or flags. */
export const MAX_IDS = 200;

export const isId = (v: unknown): v is string => typeof v === 'string' && ID_RE.test(v);
export const isThreadKey = (v: unknown): v is string =>
  typeof v === 'string' && THREAD_KEY_RE.test(v);

export function emptyThreadState(now = 0): ThreadState {
  return { dismissedAsks: [], confirmedAsks: [], ignoredFlags: [], updatedAt: now };
}

function ids(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter(isId))].slice(0, MAX_IDS);
}

/** Reads a thread state from untrusted storage data. Never throws. */
export function parseThreadState(raw: unknown): ThreadState {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const updatedAt =
    typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? r.updatedAt : 0;
  return {
    dismissedAsks: ids(r.dismissedAsks),
    confirmedAsks: ids(r.confirmedAsks),
    ignoredFlags: ids(r.ignoredFlags),
    updatedAt,
  };
}

export type ThreadAction =
  | { type: 'dismiss-ask'; id: string }
  | { type: 'restore-ask'; id: string }
  | { type: 'confirm-ask'; id: string }
  | { type: 'unconfirm-ask'; id: string }
  | { type: 'ignore-flag'; id: string }
  | { type: 'unignore-flag'; id: string }
  | { type: 'reset' };

const add = (list: string[], id: string): string[] =>
  list.includes(id) ? list : [...list, id].slice(-MAX_IDS);
const drop = (list: string[], id: string): string[] => list.filter((x) => x !== id);

/**
 * Pure reducer. Dismissing and confirming are exclusive: an ask is either
 * answered by the user or set aside, never both. Invalid ids are ignored so a
 * malformed message can never write text into storage.
 */
export function reduceThreadState(
  state: ThreadState,
  action: ThreadAction,
  now: number,
): ThreadState {
  const next = reduce(state, action, now);
  // An action that changes nothing returns the same object, so callers skip the write.
  return sameLists(state, next) ? state : next;
}

const sameList = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);

const sameLists = (a: ThreadState, b: ThreadState): boolean =>
  sameList(a.dismissedAsks, b.dismissedAsks) &&
  sameList(a.confirmedAsks, b.confirmedAsks) &&
  sameList(a.ignoredFlags, b.ignoredFlags);

function reduce(state: ThreadState, action: ThreadAction, now: number): ThreadState {
  if (action.type === 'reset') return emptyThreadState(now);
  if (!isId(action.id)) return state;
  const { id } = action;
  switch (action.type) {
    case 'dismiss-ask':
      return {
        ...state,
        dismissedAsks: add(state.dismissedAsks, id),
        confirmedAsks: drop(state.confirmedAsks, id),
        updatedAt: now,
      };
    case 'restore-ask':
      return { ...state, dismissedAsks: drop(state.dismissedAsks, id), updatedAt: now };
    case 'confirm-ask':
      return {
        ...state,
        confirmedAsks: add(state.confirmedAsks, id),
        dismissedAsks: drop(state.dismissedAsks, id),
        updatedAt: now,
      };
    case 'unconfirm-ask':
      return { ...state, confirmedAsks: drop(state.confirmedAsks, id), updatedAt: now };
    case 'ignore-flag':
      return { ...state, ignoredFlags: add(state.ignoredFlags, id), updatedAt: now };
    case 'unignore-flag':
      return { ...state, ignoredFlags: drop(state.ignoredFlags, id), updatedAt: now };
  }
}

export function isEmptyThreadState(state: ThreadState): boolean {
  return (
    state.dismissedAsks.length === 0 &&
    state.confirmedAsks.length === 0 &&
    state.ignoredFlags.length === 0
  );
}
