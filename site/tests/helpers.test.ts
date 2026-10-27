import { afterEach, describe, expect, it, vi } from 'vitest';
import { cubicBezier as extBezier, springProgress } from '@/overlay/swap/frame';
import { commonGlyphs } from '@/overlay/swap/plan';
import {
  EMPTY_DRAFT,
  MAX_THREAD_CHARS,
  clearDraftStorage,
  decodeShare,
  encodeShare,
  loadDraft,
  readQuery,
  saveDraft,
  writeQuery,
} from '../src/app/model';
import { locateCitation, snippet } from '../src/shared/snippet';
import { alignChars, cubicBezier, spring } from '../src/shared/swap';

afterEach(() => {
  vi.unstubAllGlobals();
});

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
  removeItem(k: string): void {
    this.data.delete(k);
  }
  dump(): string {
    return JSON.stringify([...this.data]);
  }
}

describe('draft persistence (sessionStorage only)', () => {
  it('round-trips the boxes and clears them when both are empty', () => {
    const store = new MemoryStorage();
    vi.stubGlobal('sessionStorage', store);
    const d = {
      thread: 'Hi Sam',
      reply: 'Hi Sam, ok',
      sender: 'Kathryn',
      sentOn: '2026-11-02',
      sampleId: 'deposit',
    };
    saveDraft(d);
    expect(loadDraft()).toEqual(d);
    saveDraft({ ...d, thread: '', reply: '' });
    expect(loadDraft()).toEqual(EMPTY_DRAFT);
    expect(store.dump()).toBe('[]');
  });

  it('survives a blocked, empty or corrupt store without throwing', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(loadDraft()).toEqual(EMPTY_DRAFT);
    expect(() => {
      saveDraft({ ...EMPTY_DRAFT, thread: 'x' });
      clearDraftStorage();
    }).not.toThrow();
    const corrupt = new MemoryStorage();
    corrupt.setItem('readback:draft', '{not json');
    vi.stubGlobal('sessionStorage', corrupt);
    expect(loadDraft()).toEqual(EMPTY_DRAFT);
  });

  it('clamps stored text and rejects a malformed date or field types', () => {
    const store = new MemoryStorage();
    store.setItem(
      'readback:draft',
      JSON.stringify({
        thread: 'a'.repeat(MAX_THREAD_CHARS + 500),
        reply: 'b'.repeat(MAX_THREAD_CHARS + 500),
        sender: 's'.repeat(500),
        sentOn: '11/02/2026',
        sampleId: 42,
      }),
    );
    vi.stubGlobal('sessionStorage', store);
    const d = loadDraft();
    expect(d.thread).toHaveLength(MAX_THREAD_CHARS + 1);
    expect(d.reply).toHaveLength(MAX_THREAD_CHARS);
    expect(d.sender).toHaveLength(120);
    expect(d.sentOn).toBe('');
    expect(d.sampleId).toBeNull();
  });
});

describe('share link (explicit click only; the text lives in the hash fragment)', () => {
  const location = { origin: 'https://readback.example', pathname: '/app/' };

  it('round-trips unicode text through the fragment, and the link carries no plain text', async () => {
    vi.stubGlobal('location', location);
    const d = {
      thread: 'Hi Sam, café € 1,250 — “quoted”',
      reply: 'Hi Catherine',
      sender: 'Kathryn',
      sentOn: '2026-11-02',
      sampleId: null,
    };
    const link = await encodeShare(d);
    expect(link.startsWith('https://readback.example/app/#t=')).toBe(true);
    expect(link).not.toMatch(/Catherine|Sam|1,250/);
    const back = await decodeShare(link.slice(link.indexOf('#')));
    expect(back).toEqual(d);
  });

  it('refuses anything that is not a #t= fragment, and corrupt payloads', async () => {
    expect(await decodeShare('')).toBeNull();
    expect(await decodeShare('#other=abc')).toBeNull();
    expect(await decodeShare('#t=')).toBeNull();
    expect(await decodeShare('#t=!!!')).toBeNull();
    expect(await decodeShare('#t=AAAA')).toBeNull();
  });
});

describe('query string (sample id and guard toggles only)', () => {
  it('reads the sample and the switched-off guards', () => {
    vi.stubGlobal('location', { search: '?sample=deposit&off=date,number' });
    expect(readQuery()).toEqual({ sample: 'deposit', off: ['date', 'number'] });
    vi.stubGlobal('location', { search: '' });
    expect(readQuery()).toEqual({ sample: null, off: [] });
  });

  it('writes a clean query and never anything else', () => {
    const replaceState = vi.fn();
    vi.stubGlobal('location', { pathname: '/app/' });
    vi.stubGlobal('history', { replaceState });
    writeQuery('deposit', ['date']);
    expect(replaceState).toHaveBeenLastCalledWith(null, '', '/app/?sample=deposit&off=date');
    writeQuery(null, []);
    expect(replaceState).toHaveBeenLastCalledWith(null, '', '/app/');
  });
});

describe('citation snippet', () => {
  it('keeps the token and trims the line around it', () => {
    const line = `${'word '.repeat(30)}the $1,250 deposit${' word'.repeat(30)}`;
    const s = snippet(line, '$1,250');
    expect(s.token).toBe('$1,250');
    expect(s.before.startsWith('…')).toBe(true);
    expect(s.after.endsWith('…')).toBe(true);
    expect(s.before.length).toBeLessThan(45);
    expect(s.after.length).toBeLessThan(45);
  });

  it('returns the whole short line, and a shortened line when the token is missing', () => {
    expect(snippet('Pay $1,250 today', '$1,250')).toEqual({
      before: 'Pay ',
      token: '$1,250',
      after: ' today',
    });
    const none = snippet('x'.repeat(200), 'nope');
    expect(none.token).toBe('');
    expect(none.before.endsWith('…')).toBe(true);
  });

  it('locates a token inside its line in the raw thread', () => {
    const raw = ['Line one has 12.', 'Line two has 12 and 34.'].join('\n');
    const two = raw.indexOf('Line two');
    expect(locateCitation(raw, 'Line two has 12 and 34.', '12')).toEqual({
      start: two + 13,
      end: two + 15,
    });
    // A line that is not in the thread falls back to the first occurrence of the token anywhere.
    expect(locateCitation(raw, 'missing line', '34')).toEqual({
      start: raw.indexOf('34'),
      end: raw.indexOf('34') + 2,
    });
    expect(locateCitation(raw, 'Line one has 12.', 'zzz')).toBeUndefined();
    expect(locateCitation(raw, 'Line one has 12.', '')).toBeUndefined();
  });
});

describe('the landing and web-app swap-back agrees with the extension overlay', () => {
  const pairs: [string, string][] = [
    ['Catherine', 'Kathryn'],
    ['$1,520', '$1,250'],
    ['Thursday the 10th', 'Tuesday the 10th'],
    ['Stephen', 'Steven'],
    ['INV-20913', 'INV-20931'],
    ['', 'x'],
    ['same', 'same'],
  ];

  it('aligns the same shared letters as the extension plan', () => {
    for (const [from, to] of pairs) {
      expect(alignChars(from, to), `${from} to ${to}`).toEqual(commonGlyphs(from, to));
    }
  });

  it('has the same easing curves as the extension', () => {
    const curves: [number, number, number, number][] = [
      [0.23, 1, 0.32, 1],
      [0.77, 0, 0.175, 1],
    ];
    for (const c of curves) {
      const a = cubicBezier(...c);
      const b = extBezier(...c);
      for (let x = 0; x <= 1.0001; x += 0.05) expect(a(x)).toBeCloseTo(b(x), 6);
    }
  });

  it('has the same spring, to a visual tolerance', () => {
    for (let ms = 0; ms <= 280; ms += 20) {
      expect(Math.abs(spring(ms / 280) - springProgress(ms))).toBeLessThan(0.02);
    }
  });
});
