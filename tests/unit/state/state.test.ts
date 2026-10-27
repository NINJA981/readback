import { describe, expect, it, vi } from 'vitest';
import { createContext } from '../../../src/engine/index';
import type { Flag } from '../../../src/engine/types';
import { diffFlags, hasChanges, nextFlag, previousFlag } from '../../../src/state/flags-diff';
import {
  EMPTY_IGNORE,
  addIgnored,
  isIgnored,
  parseIgnoreList,
  removeIgnored,
} from '../../../src/state/ignore';
import { createComposeSession } from '../../../src/state/session';
import {
  DEFAULT_SETTINGS,
  enabledGuardCount,
  isSiteEnabled,
  parseSettings,
  setGuard,
  setModel,
  setSiteEnabled,
  toOrigin,
} from '../../../src/state/settings';
import { createStore } from '../../../src/state/store';
import {
  fixedLabel,
  ledgerHeader,
  overflowLabel,
  pillModel,
  slipSummary,
} from '../../../src/state/summary';
import {
  MAX_IDS,
  emptyThreadState,
  isEmptyThreadState,
  parseThreadState,
  reduceThreadState,
} from '../../../src/state/thread-state';
import { DEPOSIT_DRAFT_CLEAN, DEPOSIT_DRAFT_SLIPS, DEPOSIT_INPUT } from '../../fixtures/samples';

const TODAY = new Date(2026, 10, 2, 12);
const ctx = () => createContext(DEPOSIT_INPUT, TODAY);

const flag = (id: string, start: number, end = start + 3, guard: Flag['guard'] = 'name'): Flag => ({
  id,
  guard,
  draftSpan: { start, end },
  found: 'x',
  expected: 'y',
  rule: 'variant',
  message: 'm',
  citation: { text: 'y', source: 'signature', span: { start: 0, end: 1 }, line: 'y' },
  fixes: [{ label: 'y', replacement: 'y' }],
});

describe('settings', () => {
  it('parses junk to the defaults without throwing', () => {
    for (const junk of [undefined, null, 5, 'x', [], { guards: 7, model: [] }]) {
      expect(parseSettings(junk)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('keeps valid values, drops invalid ones and clamps the model threshold', () => {
    const s = parseSettings({
      enabled: false,
      disabledSites: [
        'https://Mail.Google.com/mail/u/0',
        'not a url',
        7,
        'https://mail.google.com',
      ],
      guards: { name: false, number: 'yes' },
      model: { enabled: true, threshold: 5 },
      theme: 'dark',
    });
    expect(s.enabled).toBe(false);
    expect(s.disabledSites).toEqual(['https://mail.google.com']);
    expect(s.guards).toEqual({ name: false, number: true, date: true, asks: true });
    expect(s.model).toEqual({ enabled: true, threshold: 0.95 });
    expect(s.theme).toBe('dark');
    expect(parseSettings({ theme: 'neon' }).theme).toBe('system');
  });

  it('toggles guards, sites and the model without mutating', () => {
    const base = { ...DEFAULT_SETTINGS, guards: { ...DEFAULT_SETTINGS.guards } };
    const off = setGuard(base, 'date', false);
    expect(off.guards.date).toBe(false);
    expect(base.guards.date).toBe(true);
    expect(enabledGuardCount(off)).toBe(3);

    const site = setSiteEnabled(base, 'https://mail.google.com/mail', false);
    expect(isSiteEnabled(site, 'https://mail.google.com/mail/u/1')).toBe(false);
    expect(isSiteEnabled(site, 'https://example.com')).toBe(true);
    expect(
      isSiteEnabled(
        setSiteEnabled(site, 'https://mail.google.com', true),
        'https://mail.google.com',
      ),
    ).toBe(true);
    expect(setSiteEnabled(base, 'garbage', false)).toBe(base);
    expect(isSiteEnabled({ ...base, enabled: false }, 'https://example.com')).toBe(false);
    expect(setModel(base, { threshold: 0.01 }).model.threshold).toBe(0.3);
    expect(toOrigin('ftp://x')).toBeUndefined();
  });
});

describe('ignore list', () => {
  it('adds, dedupes (case, accents, digits) and removes', () => {
    let list = addIgnored(EMPTY_IGNORE, 'names', 'Catherine');
    expect(addIgnored(list, 'names', ' catherine ')).toBe(list);
    expect(isIgnored(list, 'names', 'CATHERINE')).toBe(true);
    list = addIgnored(list, 'numbers', '$1,520');
    expect(isIgnored(list, 'numbers', '1520')).toBe(true);
    expect(removeIgnored(list, 'names', 'catherine').names).toEqual([]);
    expect(removeIgnored(list, 'names', 'nobody')).toBe(list);
  });

  it('rejects invalid entries and cleans junk from storage', () => {
    expect(addIgnored(EMPTY_IGNORE, 'names', '12345')).toBe(EMPTY_IGNORE);
    expect(addIgnored(EMPTY_IGNORE, 'numbers', 'abc')).toBe(EMPTY_IGNORE);
    expect(addIgnored(EMPTY_IGNORE, 'names', 'x'.repeat(65))).toBe(EMPTY_IGNORE);
    expect(parseIgnoreList({ names: ['Kath', 'kath', 4, ''], numbers: 'no' })).toEqual({
      names: ['Kath'],
      numbers: [],
    });
    expect(parseIgnoreList(null)).toEqual({ names: [], numbers: [] });
  });
});

describe('thread state', () => {
  const A = 'a'.repeat(16);
  const B = 'b'.repeat(16);

  it('dismiss and confirm are exclusive; restore and unconfirm undo them', () => {
    let s = emptyThreadState();
    s = reduceThreadState(s, { type: 'dismiss-ask', id: A }, 10);
    s = reduceThreadState(s, { type: 'confirm-ask', id: A }, 11);
    expect(s).toMatchObject({ dismissedAsks: [], confirmedAsks: [A], updatedAt: 11 });
    s = reduceThreadState(s, { type: 'dismiss-ask', id: A }, 12);
    expect(s).toMatchObject({ dismissedAsks: [A], confirmedAsks: [] });
    s = reduceThreadState(s, { type: 'restore-ask', id: A }, 13);
    s = reduceThreadState(s, { type: 'ignore-flag', id: B }, 14);
    expect(s.ignoredFlags).toEqual([B]);
    expect(reduceThreadState(s, { type: 'unignore-flag', id: B }, 15).ignoredFlags).toEqual([]);
    expect(isEmptyThreadState(reduceThreadState(s, { type: 'reset' }, 16))).toBe(true);
  });

  it('ignores ids that are not hashes so message text can never be stored (SPEC 8)', () => {
    const s = emptyThreadState();
    expect(reduceThreadState(s, { type: 'dismiss-ask', id: 'Please send the lease' }, 1)).toBe(s);
    expect(parseThreadState({ dismissedAsks: ['hello world', A], ignoredFlags: 5 })).toMatchObject({
      dismissedAsks: [A],
      ignoredFlags: [],
    });
  });

  it('caps the id lists', () => {
    let s = emptyThreadState();
    for (let i = 0; i < MAX_IDS + 20; i += 1) {
      s = reduceThreadState(s, { type: 'ignore-flag', id: i.toString(16).padStart(16, '0') }, i);
    }
    expect(s.ignoredFlags).toHaveLength(MAX_IDS);
  });
});

describe('store', () => {
  it('notifies once per change, skips identical values and tolerates unsubscribes during notify', () => {
    const store = createStore({ n: 0 });
    const a = vi.fn();
    const unsubB = vi.fn();
    const off = store.subscribe(() => {
      a();
      off();
    });
    const b = store.subscribe(unsubB);
    const snapshot = store.getSnapshot();
    store.setState(snapshot);
    expect(a).not.toHaveBeenCalled();
    store.setState((s) => ({ n: s.n + 1 }));
    store.setState({ n: 5 });
    expect(a).toHaveBeenCalledTimes(1);
    expect(unsubB).toHaveBeenCalledTimes(2);
    b();
    store.setState({ n: 6 });
    expect(unsubB).toHaveBeenCalledTimes(2);
  });
});

describe('flags diff and navigation', () => {
  it('classifies added, removed, moved and unchanged', () => {
    const a = flag('a', 0);
    const b = flag('b', 10);
    const c = flag('c', 20);
    const diff = diffFlags([a, b], [a, flag('b', 12), c]);
    expect(diff.unchanged).toEqual([a]);
    expect(diff.moved.map((f) => f.id)).toEqual(['b']);
    expect(diff.added.map((f) => f.id)).toEqual(['c']);
    expect(diffFlags([a, b], [a]).removed.map((f) => f.id)).toEqual(['b']);
    expect(hasChanges(diffFlags([a], [a]))).toBe(false);
    expect(hasChanges(diff)).toBe(true);
  });

  it('nextFlag wraps and previousFlag wraps', () => {
    const flags = [flag('c', 30), flag('a', 0), flag('b', 10)];
    expect(nextFlag(flags, 5)?.id).toBe('b');
    expect(nextFlag(flags, 99)?.id).toBe('a');
    expect(nextFlag(flags, 0, 'c')?.id).toBe('a');
    expect(nextFlag([], 0)).toBeUndefined();
    expect(previousFlag(flags, 'a')?.id).toBe('c');
    expect(previousFlag(flags, 'zzz')?.id).toBe('c');
    expect(previousFlag([], 'a')).toBeUndefined();
  });
});

describe('summary view models', () => {
  const ask = (state: 'open' | 'answered' | 'looks-answered' | 'dismissed') => ({
    id: 'x',
    text: 't',
    span: { start: 0, end: 1 },
    keyTerms: [],
    state,
  });

  it('is hidden with nothing to show', () => {
    expect(pillModel({ asks: [], flags: [] })).toMatchObject({ tone: 'hidden', label: '' });
  });

  it('says "3 asks · 1 open", then "All covered" (looks-answered and answered both count)', () => {
    const open = pillModel({
      asks: [ask('open'), ask('answered'), ask('looks-answered')],
      flags: [],
    });
    expect(open).toMatchObject({
      tone: 'open',
      total: 3,
      open: 1,
      covered: 2,
      label: '3 asks · 1 open',
    });
    const done = pillModel({ asks: [ask('answered'), ask('looks-answered')], flags: [] });
    expect(done).toMatchObject({ tone: 'covered', label: 'All covered' });
    expect(done.announcement).toBe('All 2 asks covered.');
  });

  it('drops dismissed asks from the count and counts slips', () => {
    const p = pillModel({ asks: [ask('dismissed'), ask('open')], flags: [flag('a', 0)] });
    expect(p).toMatchObject({ total: 1, label: '1 ask · 1 open', slips: 1, slipLabel: '1 slip' });
    expect(pillModel({ asks: [], flags: [flag('a', 0), flag('b', 5)] })).toMatchObject({
      tone: 'open',
      label: '',
      slipLabel: '2 slips',
    });
  });

  it('formats the fixed confirmation, overflow, ledger header and slip row', () => {
    expect(fixedLabel('Kathryn')).toBe('Fixed: Kathryn · Undo Ctrl+Z');
    expect(overflowLabel(2)).toBe('+2 more not shown');
    expect(overflowLabel(0)).toBe('');
    expect(ledgerHeader({ asks: [] })).toBe('No asks in the last message.');
    expect(ledgerHeader({ asks: [ask('answered')] })).toBe('Everything asked is covered.');
    expect(ledgerHeader({ asks: [ask('open')] })).toBe('');
    expect(slipSummary([])).toBe('');
    const f = { ...flag('a', 0), found: 'Catherine', expected: 'Kathryn' };
    expect(slipSummary([f])).toBe('1 slip: "Catherine" → Kathryn');
    expect(slipSummary([f, flag('b', 4)])).toBe('2 slips: "Catherine" → Kathryn, and 1 more');
  });
});

describe('compose session', () => {
  const make = (extra: Partial<Parameters<typeof createComposeSession>[0]> = {}) =>
    createComposeSession({ context: ctx(), today: TODAY, ...extra });

  it('starts with the three asks open and no flags', () => {
    const s = make().getSnapshot();
    expect(s.result.asks).toHaveLength(3);
    expect(s.pill.label).toBe('3 asks · 3 open');
    expect(s.result.flags).toHaveLength(0);
  });

  it('plays the signature moment: two slips, then clean and all covered (SPEC 11)', () => {
    const session = make();
    const seen = vi.fn();
    session.subscribe(seen);
    const slips = session.setDraft(DEPOSIT_DRAFT_SLIPS);
    expect(slips.result.flags.map((f) => f.found)).toEqual(['Catherine', '$1,520']);
    expect(session.setDraft(DEPOSIT_DRAFT_SLIPS)).toBe(session.getSnapshot());
    expect(seen).toHaveBeenCalledTimes(1);
    const clean = session.setDraft(DEPOSIT_DRAFT_CLEAN);
    expect(clean.result.flags).toHaveLength(0);
    expect(clean.pill).toMatchObject({ tone: 'covered', label: 'All covered' });
  });

  it('dismissing an ask updates the count at once and persists through the effect (AC-6.6)', () => {
    const saveThreadState = vi.fn();
    const session = make({ effects: { saveThreadState } });
    const [first] = session.getSnapshot().result.asks;
    session.dispatch({ type: 'dismiss-ask', id: first!.id });
    expect(session.getSnapshot().pill.label).toBe('2 asks · 2 open');
    expect(saveThreadState).toHaveBeenCalledWith(
      session.getSnapshot().context.threadKey,
      expect.objectContaining({ dismissedAsks: [first!.id] }),
    );
    // A no-op action does not save again.
    session.dispatch({ type: 'dismiss-ask', id: first!.id });
    expect(saveThreadState).toHaveBeenCalledTimes(1);
  });

  it('confirming a looks-answered ask is user evidence (AC-7.2)', () => {
    const session = make();
    session.setDraft('The $1,250 deposit is confirmed.');
    const deposit = session.getSnapshot().result.asks.find((a) => a.text.includes('deposit'))!;
    expect(deposit.state).toBe('looks-answered');
    session.dispatch({ type: 'confirm-ask', id: deposit.id });
    const after = session.getSnapshot().result.asks.find((a) => a.id === deposit.id)!;
    expect(after).toMatchObject({ state: 'answered', evidence: { kind: 'user' } });
  });

  it('ignoring a flag for this thread removes it', () => {
    const session = make();
    const { result } = session.setDraft('Hi Catherine,');
    const f = result.flags[0]!;
    session.dispatch({ type: 'ignore-flag', id: f.id });
    expect(session.getSnapshot().result.flags).toHaveLength(0);
  });

  it('"Never flag" adds the word globally (AC-1.5) but not for dates', () => {
    const saveIgnore = vi.fn();
    const session = make({ effects: { saveIgnore } });
    const f = session.setDraft('Hi Catherine,').result.flags[0]!;
    session.neverFlag(f);
    expect(session.getSnapshot().ignore.names).toEqual(['Catherine']);
    expect(session.getSnapshot().result.flags).toHaveLength(0);
    expect(saveIgnore).toHaveBeenCalledTimes(1);
    session.neverFlag(f);
    expect(saveIgnore).toHaveBeenCalledTimes(1);
    session.neverFlag(flag('d', 0, 5, 'date'));
    expect(saveIgnore).toHaveBeenCalledTimes(1);
  });

  it('turning a guard off, or Readback off, clears its flags immediately (AC-10.2)', () => {
    const session = make();
    session.setDraft(DEPOSIT_DRAFT_SLIPS);
    session.setSettings(setGuard(DEFAULT_SETTINGS, 'name', false));
    expect(session.getSnapshot().result.flags.map((f) => f.guard)).toEqual(['number']);
    session.setSettings({ ...DEFAULT_SETTINGS, enabled: false });
    expect(session.getSnapshot().result).toMatchObject({ flags: [], asks: [] });
    expect(session.getSnapshot().pill.tone).toBe('hidden');
  });

  it('a failing effect never breaks the compose box', async () => {
    const session = make({
      effects: {
        saveThreadState: () => {
          throw new Error('quota');
        },
        saveIgnore: () => Promise.reject(new Error('quota')),
      },
    });
    const [first] = session.getSnapshot().result.asks;
    expect(() => {
      session.dispatch({ type: 'dismiss-ask', id: first!.id });
      session.neverFlag(session.setDraft('Hi Catherine,').result.flags[0]!);
    }).not.toThrow();
    await Promise.resolve();
  });

  it('shows "Fixed: Kathryn" for 6 s, then drops it', () => {
    let t = 1000;
    const session = make({ now: () => t });
    session.markFixed('Kathryn');
    expect(session.getSnapshot().fixed).toEqual({ replacement: 'Kathryn', until: 7000 });
    expect(session.expireFixed()).toBe(false);
    t = 7001;
    expect(session.expireFixed()).toBe(true);
    expect(session.getSnapshot().fixed).toBeUndefined();
    expect(session.expireFixed()).toBe(false);
  });
});
