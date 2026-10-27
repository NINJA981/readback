import { describe, expect, it, vi } from 'vitest';
import {
  MAX_EMBED_CHARS,
  MAX_SELECTION_CHARS,
  parseMessage,
  parseSlips,
} from '../../../src/messaging/protocol';
import { createWebArea } from '../../../src/platform/web-storage';
import type { StorageEventLike, WebStorageLike } from '../../../src/platform/web-storage';
import { createMemoryArea } from '../../../src/storage/area';
import type { StorageChange } from '../../../src/storage/area';
import {
  IGNORE_KEY,
  SETTINGS_KEY,
  isReadbackKey,
  tabKeyOf,
  threadKeyOf,
} from '../../../src/storage/keys';
import { MAX_THREADS, createReadbackStorage } from '../../../src/storage/repository';
import { isStale, parseTabStatus, STALE_STATUS_MS } from '../../../src/storage/tab-status';
import type { TabStatus } from '../../../src/storage/tab-status';
import { DEFAULT_SETTINGS } from '../../../src/state/settings';

const KEY = 'c'.repeat(64);
const ID = 'd'.repeat(16);

const make = () => {
  const local = createMemoryArea();
  const session = createMemoryArea();
  let t = 1;
  const storage = createReadbackStorage({ local, session, now: () => t++ });
  return { local, session, storage };
};

describe('memory area', () => {
  it('round-trips JSON, rejects non-serialisable values and notifies watchers', async () => {
    const area = createMemoryArea({ a: 1 });
    const seen: StorageChange[][] = [];
    const off = area.watch?.((c) => seen.push(c));
    await area.set('b', { x: [1] });
    await area.remove(['a', 'missing']);
    expect(await area.get('b')).toEqual({ x: [1] });
    expect(await area.get('a')).toBeUndefined();
    expect(await area.keys()).toEqual(['b']);
    await expect(area.set('c', undefined)).rejects.toThrow(TypeError);
    off?.();
    await area.set('d', 1);
    expect(seen).toEqual([
      [{ key: 'b', newValue: { x: [1] } }],
      [{ key: 'a', newValue: undefined }],
    ]);
  });
});

describe('Readback storage', () => {
  it('returns defaults for an empty store and for corrupt data', async () => {
    const { local, storage } = make();
    expect(await storage.getSettings()).toEqual(DEFAULT_SETTINGS);
    await local.set(SETTINGS_KEY, { guards: 'nope', theme: 3 });
    await local.set(IGNORE_KEY, 42);
    expect(await storage.getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(await storage.getIgnore()).toEqual({ names: [], numbers: [] });
  });

  it('serialises quick read-modify-write updates so none is lost', async () => {
    const { storage } = make();
    await Promise.all([
      storage.updateIgnore((l) => ({ ...l, names: [...l.names, 'Kathryn'] })),
      storage.updateIgnore((l) => ({ ...l, names: [...l.names, 'Sean'] })),
      storage.updateIgnore((l) => ({ ...l, numbers: [...l.numbers, '1250'] })),
    ]);
    expect(await storage.getIgnore()).toEqual({ names: ['Kathryn', 'Sean'], numbers: ['1250'] });
  });

  it('validates what it writes', async () => {
    const { local, storage } = make();
    await storage.updateSettings((s) => ({ ...s, theme: 'bogus' as never }));
    expect((await storage.getSettings()).theme).toBe('system');
    await storage.setIgnore({ names: ['ok', '999'], numbers: ['abc', '12'] });
    expect(await local.get(IGNORE_KEY)).toEqual({ names: ['ok'], numbers: ['12'] });
  });

  it('notifies settings watchers with parsed values', async () => {
    const { storage } = make();
    const seen = vi.fn();
    const off = storage.watchSettings(seen);
    await storage.updateSettings((s) => ({ ...s, enabled: false }));
    off();
    await storage.updateSettings((s) => ({ ...s, enabled: true }));
    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen.mock.calls[0]?.[0]).toMatchObject({ enabled: false });
  });

  it('keeps thread state in session storage as hashed ids only (SPEC 8)', async () => {
    const { local, session, storage } = make();
    await storage.dispatchThread(KEY, { type: 'dismiss-ask', id: ID });
    await storage.dispatchThread(KEY, { type: 'ignore-flag', id: ID });
    expect(await local.keys()).toEqual([]);
    expect(await session.get(threadKeyOf(KEY))).toMatchObject({
      dismissedAsks: [ID],
      ignoredFlags: [ID],
    });
    expect(JSON.stringify(session.dump())).not.toMatch(/[^0-9a-f":,[\]{}\w]/);
    await storage.dispatchThread(KEY, { type: 'reset' });
    expect(await session.keys()).toEqual([]);
  });

  it('refuses thread keys that are not SHA-256 digests', async () => {
    const { session, storage } = make();
    await storage.dispatchThread('Re: your deposit', { type: 'dismiss-ask', id: ID });
    expect(await session.keys()).toEqual([]);
    expect(await storage.getThreadState('Re: your deposit')).toMatchObject({ dismissedAsks: [] });
  });

  it('prunes the oldest thread states beyond the cap', async () => {
    const { session, storage } = make();
    for (let i = 0; i < MAX_THREADS + 5; i += 1) {
      await storage.dispatchThread(i.toString(16).padStart(64, '0'), {
        type: 'dismiss-ask',
        id: ID,
      });
    }
    const keys = await session.keys();
    expect(keys).toHaveLength(MAX_THREADS);
    expect(keys).not.toContain(threadKeyOf('0'.padStart(64, '0')));
  });

  it('stores tab status as counts and enums, and clears it', async () => {
    const { storage } = make();
    const status: TabStatus = {
      state: 'reading',
      asks: 3,
      open: 1,
      slips: 2,
      contextWords: 0,
      failedChecks: [],
      updatedAt: 5,
    };
    await storage.setTabStatus(7, status);
    expect(await storage.getTabStatus(7)).toEqual(status);
    await storage.setTabStatus(8, { ...status, state: 'nonsense' as never });
    expect(await storage.getTabStatus(8)).toBeUndefined();
    await storage.clearTabStatus(7);
    expect(await storage.getTabStatus(7)).toBeUndefined();
  });

  it('reports an inventory of counts and clears only its own keys (AC-10.3)', async () => {
    const { local, session, storage } = make();
    await local.set('other-extension-key', 1);
    await session.set('other', 2);
    await storage.updateSettings((s) => s);
    await storage.setIgnore({ names: ['Kath'], numbers: ['1250'] });
    await storage.dispatchThread(KEY, { type: 'dismiss-ask', id: ID });
    await storage.setTabStatus(1, {
      state: 'idle',
      asks: 0,
      open: 0,
      slips: 0,
      contextWords: 0,
      failedChecks: [],
      updatedAt: 1,
    });
    expect(await storage.inventory()).toEqual({
      settings: true,
      ignoredNames: 1,
      ignoredNumbers: 1,
      threads: 1,
      tabs: 1,
    });
    await storage.clearAll();
    expect(await local.keys()).toEqual(['other-extension-key']);
    expect(await session.keys()).toEqual(['other']);
    expect(await storage.inventory()).toEqual({
      settings: false,
      ignoredNames: 0,
      ignoredNumbers: 0,
      threads: 0,
      tabs: 0,
    });
  });

  it('knows which keys are its own', () => {
    expect(isReadbackKey(SETTINGS_KEY)).toBe(true);
    expect(isReadbackKey(threadKeyOf(KEY))).toBe(true);
    expect(isReadbackKey(tabKeyOf(3))).toBe(true);
    expect(isReadbackKey('anything-else')).toBe(false);
  });
});

describe('tab status', () => {
  it('sanitises counts, check ids and timestamps', () => {
    const s = parseTabStatus({
      state: 'layout-unrecognised',
      asks: -1,
      open: 2.5,
      slips: 2,
      contextWords: 'x',
      failedChecks: [
        'thread',
        'Contains Message Text!',
        5,
        ...Array.from({ length: 30 }, () => 'body'),
      ],
      updatedAt: Infinity,
    });
    expect(s).toMatchObject({ asks: 0, open: 0, slips: 2, contextWords: 0, updatedAt: 0 });
    expect(s?.failedChecks).toHaveLength(20);
    expect(s?.failedChecks[0]).toBe('thread');
    expect(s?.failedChecks).not.toContain('Contains Message Text!');
    expect(parseTabStatus(null)).toBeUndefined();
    expect(parseTabStatus([])).toBeUndefined();
  });

  it('goes stale after two seconds', () => {
    const s = parseTabStatus({ state: 'idle', updatedAt: 1000 })!;
    expect(isStale(s, 1000 + STALE_STATUS_MS)).toBe(false);
    expect(isStale(s, 1001 + STALE_STATUS_MS)).toBe(true);
  });
});

describe('message protocol', () => {
  it('accepts well-formed messages and rejects the rest', () => {
    expect(parseMessage({ type: 'next-slip' })).toEqual({ type: 'next-slip' });
    expect(parseMessage({ type: 'get-slips', extra: 1 })).toEqual({ type: 'get-slips' });
    for (const bad of [null, 'next-slip', [], {}, { type: 5 }, { type: 'format-disk' }]) {
      expect(parseMessage(bad)).toBeUndefined();
    }
  });

  it('trims and caps a selection, and rejects empty ones', () => {
    expect(parseMessage({ type: 'use-selection', text: '  hello there you  ' })).toEqual({
      type: 'use-selection',
      text: 'hello there you',
    });
    expect(parseMessage({ type: 'use-selection', text: '   ' })).toBeUndefined();
    expect(parseMessage({ type: 'use-selection', text: 5 })).toBeUndefined();
    const long = parseMessage({
      type: 'use-selection',
      text: 'a'.repeat(MAX_SELECTION_CHARS + 50),
    });
    expect(long?.type === 'use-selection' && long.text.length).toBe(MAX_SELECTION_CHARS);
  });

  it('validates embed requests and tab statuses', () => {
    expect(parseMessage({ type: 'embed', texts: [] })).toBeUndefined();
    expect(parseMessage({ type: 'embed', texts: ['a', 2] })).toBeUndefined();
    expect(
      parseMessage({ type: 'embed', texts: Array.from({ length: 65 }, () => 'a') }),
    ).toBeUndefined();
    const ok = parseMessage({ type: 'embed', texts: ['x'.repeat(MAX_EMBED_CHARS + 1)] });
    expect(ok?.type === 'embed' && ok.texts[0]?.length).toBe(MAX_EMBED_CHARS);
    expect(
      parseMessage({ type: 'tab-status', status: { state: 'idle', updatedAt: 3 } }),
    ).toMatchObject({
      type: 'tab-status',
      status: { state: 'idle' },
    });
    expect(parseMessage({ type: 'tab-status', status: { state: 'x' } })).toBeUndefined();
  });

  it('parses slip replies defensively', () => {
    expect(parseSlips(null)).toEqual([]);
    expect(parseSlips({ slips: 'no' })).toEqual([]);
    const out = parseSlips({
      slips: [{ found: 'a'.repeat(200), expected: 'b', message: 'c' }, { found: 1 }, 'x'],
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.found).toHaveLength(80);
  });
});

describe('web storage area', () => {
  const fake = (): WebStorageLike & { data: Map<string, string> } => {
    const data = new Map<string, string>();
    return {
      data,
      get length() {
        return data.size;
      },
      key: (i) => [...data.keys()][i] ?? null,
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    };
  };

  it('namespaces keys and never touches other apps on the same origin', async () => {
    const store = fake();
    store.data.set('theirs', '1');
    const area = createWebArea(store);
    await area.set('settings', { a: 1 });
    expect(await area.get('settings')).toEqual({ a: 1 });
    expect(store.data.has('readback:settings')).toBe(true);
    expect(await area.keys()).toEqual(['settings']);
    await area.remove('settings');
    expect(store.data.has('theirs')).toBe(true);
    expect(await area.get('settings')).toBeUndefined();
  });

  it('survives corrupt JSON, quota errors and an unavailable store', async () => {
    const store = fake();
    store.data.set('readback:bad', '{oops');
    const area = createWebArea(store);
    expect(await area.get('bad')).toBeUndefined();
    store.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    await expect(area.set('x', 1)).rejects.toThrow('QuotaExceededError');
    await expect(area.set('x', undefined)).rejects.toThrow(TypeError);

    const broken = createWebArea({
      get length(): number {
        throw new Error('SecurityError');
      },
      key: () => null,
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => undefined,
      removeItem: () => {
        throw new Error('SecurityError');
      },
    });
    expect(await broken.get('a')).toBeUndefined();
    expect(await broken.keys()).toEqual([]);
    await expect(broken.remove('a')).resolves.toBeUndefined();
  });

  it('forwards cross-tab storage events for its own keys only', async () => {
    const store = fake();
    const listeners = new Set<(e: StorageEventLike) => void>();
    const area = createWebArea(store, {
      events: {
        addEventListener: (_t, l) => void listeners.add(l),
        removeEventListener: (_t, l) => void listeners.delete(l),
      },
    });
    const seen: StorageChange[][] = [];
    const off = area.watch?.((c) => seen.push(c));
    const fire = (e: StorageEventLike) => listeners.forEach((l) => l(e));
    fire({ key: 'readback:settings', newValue: '{"a":2}', storageArea: store });
    fire({ key: 'other', newValue: '1', storageArea: store });
    fire({ key: 'readback:settings', newValue: '1', storageArea: {} });
    expect(seen).toEqual([[{ key: 'settings', newValue: { a: 2 } }]]);
    off?.();
    expect(listeners.size).toBe(0);
    expect(createWebArea(store).watch).toBeUndefined();
  });
});
