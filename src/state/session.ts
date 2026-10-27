/**
 * Compose session: the state machine behind one reply box. It owns the
 * thread context, the latest draft and check result, and the user's choices
 * (dismiss, confirm, ignore). It knows nothing about the DOM, extension APIs
 * or storage: hosts inject persistence through `effects`, and render from
 * `getSnapshot()` (React: `useSyncExternalStore`).
 *
 * The Gmail content script, the generic selection adapter and the web
 * playground all drive the same session, so their behaviour cannot drift.
 */
import { check } from '../engine/index';
import type {
  CheckResult,
  Flag,
  IgnoreList,
  Settings,
  ThreadContext,
  ThreadState,
} from '../engine/types';
import { addIgnored } from './ignore';
import { DEFAULT_SETTINGS } from './settings';
import { FIXED_CONFIRMATION_MS, pillModel } from './summary';
import type { PillModel } from './summary';
import { createStore } from './store';
import { emptyThreadState, reduceThreadState } from './thread-state';
import type { ThreadAction } from './thread-state';
import { EMPTY_IGNORE } from './ignore';

export interface SessionSnapshot {
  context: ThreadContext;
  draft: string;
  version: number;
  result: CheckResult;
  pill: PillModel;
  settings: Settings;
  ignore: IgnoreList;
  threadState: ThreadState;
  /** Transient "Fixed: Kathryn · Undo Ctrl+Z", with its expiry time. */
  fixed?: { replacement: string; until: number };
}

/** Persistence hooks. Failures are swallowed: Readback fails silent (ADR-0001). */
export interface SessionEffects {
  saveThreadState?(threadKey: string, state: ThreadState): Promise<void> | void;
  saveIgnore?(list: IgnoreList): Promise<void> | void;
}

export interface SessionOptions {
  context: ThreadContext;
  settings?: Settings;
  ignore?: IgnoreList;
  threadState?: ThreadState;
  effects?: SessionEffects;
  /** Clock for `updatedAt` and the fixed-confirmation expiry. */
  now?: () => number;
  /** Fallback reference date for the date guard when the context has no sent date. */
  today?: Date;
}

export interface ComposeSession {
  getSnapshot(): SessionSnapshot;
  subscribe(listener: () => void): () => void;
  /** Runs the engine on new draft text. Same text twice is a no-op. */
  setDraft(text: string): SessionSnapshot;
  setSettings(settings: Settings): void;
  setIgnore(list: IgnoreList): void;
  setThreadState(state: ThreadState): void;
  dispatch(action: ThreadAction): void;
  /** "Never flag 'Catherine'": adds the flag's draft token to the global list. */
  neverFlag(flag: Flag): void;
  /** Records a successful fix for the pill's confirmation text. */
  markFixed(replacement: string): void;
  /** Drops the fixed confirmation once it has expired; returns true if it changed. */
  expireFixed(): boolean;
}

const EMPTY_RESULT: CheckResult = { asks: [], flags: [], truncatedAsks: 0, ms: 0 };

function swallow(run: () => Promise<void> | void): void {
  try {
    const p = run();
    if (p) p.catch(() => undefined);
  } catch {
    // Storage failures never break the compose box.
  }
}

export function createComposeSession(options: SessionOptions): ComposeSession {
  const now = options.now ?? (() => Date.now());
  const effects = options.effects ?? {};
  const today = options.today;

  const run = (
    context: ThreadContext,
    draft: string,
    version: number,
    settings: Settings,
    ignore: IgnoreList,
    threadState: ThreadState,
  ): CheckResult => {
    if (!settings.enabled) return EMPTY_RESULT;
    return check(
      context,
      { text: draft, version },
      { guards: settings.guards, ignore, threadState, ...(today ? { today } : {}) },
    );
  };

  const settings = options.settings ?? { ...DEFAULT_SETTINGS };
  const ignore = options.ignore ?? EMPTY_IGNORE;
  const threadState = options.threadState ?? emptyThreadState();
  const initial = run(options.context, '', 0, settings, ignore, threadState);
  const store = createStore<SessionSnapshot>({
    context: options.context,
    draft: '',
    version: 0,
    result: initial,
    pill: pillModel(initial),
    settings,
    ignore,
    threadState,
  });

  /** Re-runs the engine with the current draft after any input changed. */
  const recheck = (
    patch: Partial<Pick<SessionSnapshot, 'settings' | 'ignore' | 'threadState'>>,
  ): void => {
    store.setState((s) => {
      const next = { ...s, ...patch };
      const result = run(
        next.context,
        next.draft,
        next.version,
        next.settings,
        next.ignore,
        next.threadState,
      );
      return { ...next, result, pill: pillModel(result) };
    });
  };

  return {
    getSnapshot: () => store.getSnapshot(),
    subscribe: (listener) => store.subscribe(listener),
    setDraft(text) {
      const s = store.getSnapshot();
      if (text === s.draft) return s;
      const version = s.version + 1;
      const result = run(s.context, text, version, s.settings, s.ignore, s.threadState);
      store.setState({ ...s, draft: text, version, result, pill: pillModel(result) });
      return store.getSnapshot();
    },
    setSettings(next) {
      recheck({ settings: next });
    },
    setIgnore(next) {
      recheck({ ignore: next });
    },
    setThreadState(next) {
      recheck({ threadState: next });
    },
    dispatch(action) {
      const s = store.getSnapshot();
      const next = reduceThreadState(s.threadState, action, now());
      if (next === s.threadState) return;
      recheck({ threadState: next });
      const key = s.context.threadKey;
      swallow(() => effects.saveThreadState?.(key, next));
    },
    neverFlag(flag) {
      const s = store.getSnapshot();
      const kind = flag.guard === 'number' ? 'numbers' : 'names';
      // Dates are not ignorable globally; the per-thread Ignore covers them.
      if (flag.guard === 'date') return;
      const next = addIgnored(s.ignore, kind, flag.found);
      if (next === s.ignore) return;
      recheck({ ignore: next });
      swallow(() => effects.saveIgnore?.(next));
    },
    markFixed(replacement) {
      store.setState((s) => ({
        ...s,
        fixed: { replacement, until: now() + FIXED_CONFIRMATION_MS },
      }));
    },
    expireFixed() {
      const s = store.getSnapshot();
      if (!s.fixed || s.fixed.until > now()) return false;
      const rest = { ...s };
      delete rest.fixed;
      store.setState(rest);
      return true;
    },
  };
}
