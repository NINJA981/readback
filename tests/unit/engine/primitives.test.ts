import { describe, expect, it } from 'vitest';
import { osaDistance } from '../../../src/engine/guards/distance';
import {
  VARIANT_GROUPS,
  isVariantPair,
  variantPairCount,
} from '../../../src/engine/guards/variants';
import { sha256Hex, shortId, utf8 } from '../../../src/engine/hash';
import { ordinal, citationSource, weekdayDay } from '../../../src/engine/cite';
import { fold, lineAt, stem, words } from '../../../src/engine/text/tokens';

describe('sha256Hex', () => {
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    [
      'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    ],
    // 1,000 bytes crosses many block boundaries.
    ['a'.repeat(1000), '41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3'],
  ])('matches the FIPS/NIST vector for %#', (input, hex) => {
    expect(sha256Hex(input)).toBe(hex);
  });

  it('hashes UTF-8, not UTF-16', () => {
    expect(Array.from(utf8('é€😀'))).toEqual([
      0xc3, 0xa9, 0xe2, 0x82, 0xac, 0xf0, 0x9f, 0x98, 0x80,
    ]);
    // echo -n "Kathryn Moß" | sha256sum
    expect(sha256Hex('Kathryn Moß')).toHaveLength(64);
  });

  it('shortId is 16 hex chars and separates parts unambiguously', () => {
    expect(shortId('a', 'bc')).toMatch(/^[0-9a-f]{16}$/);
    expect(shortId('a', 'bc')).not.toBe(shortId('ab', 'c'));
  });
});

describe('osaDistance', () => {
  it.each([
    ['kathryn', 'kathryn', 0],
    ['jon', 'john', 1],
    ['john', 'jon', 1],
    ['ca', 'ac', 1],
    ['1250', '1520', 1],
    ['1250', '1052', 2],
    ['catherine', 'kathryn', 4],
    ['', 'abc', 3],
    ['josé', 'jose', 1],
    ['shaun', 'sean', 2],
  ])('%s → %s = %i', (a, b, d) => {
    expect(osaDistance(a, b)).toBe(d);
  });

  it('stops early past max', () => {
    expect(osaDistance('alexander', 'bob', 2)).toBe(3);
    expect(osaDistance('abcdef', 'uvwxyz', 1)).toBe(2);
  });
});

describe('variant table', () => {
  it('is symmetric and pairs only different spellings', () => {
    for (const group of VARIANT_GROUPS) {
      for (const a of group) {
        expect(isVariantPair(a, a)).toBe(false);
        for (const b of group) if (a !== b) expect(isVariantPair(b, a)).toBe(isVariantPair(a, b));
      }
    }
    expect(isVariantPair('catherine', 'kathryn')).toBe(true);
    expect(isVariantPair('kathryn', 'bob')).toBe(false);
  });

  it('holds about 120 pairs of lower-case, unique names', () => {
    expect(variantPairCount()).toBeGreaterThanOrEqual(120);
    const all = VARIANT_GROUPS.flat();
    for (const n of all) expect(n).toBe(fold(n));
    // A name may appear in only one group, so a pair is never ambiguous.
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('text tokens', () => {
  it('reads names with apostrophes, hyphens and accents', () => {
    expect(words("O'Brien and Anne-Marie met José's team").map((w) => w.text)).toEqual([
      "O'Brien",
      'and',
      'Anne-Marie',
      'met',
      "José's",
      'team',
    ]);
  });

  it('folds case, accents and curly apostrophes', () => {
    expect(fold('José O’Brien')).toBe("jose o'brien");
  });

  it('stems inflections for overlap', () => {
    expect(stem('confirmed')).toBe('confirm');
    expect(stem('dropped')).toBe('drop');
    expect(stem('keys')).toBe('key');
    expect(stem('signed')).toBe('sign');
    expect(stem('boxes')).toBe('box');
    expect(stem('parties')).toBe('party');
    expect(stem('sending')).toBe('send');
    expect(stem('class')).toBe('class');
  });

  it('lineAt returns the trimmed line around an index', () => {
    const t = 'first\n  Thanks, Kathryn  \nlast';
    expect(lineAt(t, t.indexOf('Kathryn'))).toBe('Thanks, Kathryn');
  });
});

describe('cite', () => {
  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [13, '13th'],
    [21, '21st'],
    [22, '22nd'],
    [23, '23rd'],
    [31, '31st'],
  ])('ordinal(%i) = %s', (n, s) => {
    expect(ordinal(n)).toBe(s);
  });

  it('formats weekday + day', () => {
    expect(weekdayDay(4, 12)).toBe('Thursday the 12th');
  });

  it('labels citation sources without assuming gender', () => {
    const base = { text: 'x', span: { start: 0, end: 1 }, line: 'x' };
    expect(citationSource({ ...base, source: 'signature' })).toBe('From the signature');
    expect(citationSource({ ...base, source: 'to' })).toBe('From the To field');
    expect(citationSource({ ...base, source: 'cc' })).toBe('From the Cc field');
    expect(citationSource({ ...base, source: 'from' })).toBe('From the sender');
    expect(citationSource({ ...base, source: 'calendar' })).toBe('From the calendar');
    expect(citationSource({ ...base, source: 'body' }, '2026-11-02')).toBe(
      'From the message, 2 Nov',
    );
    expect(citationSource({ ...base, source: 'body' })).toBe('From the message');
  });
});
