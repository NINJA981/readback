import * as chrono from 'chrono-node';
import { describe, expect, it } from 'vitest';
import {
  extractDates,
  inferMonth,
  parseTimestamp,
  referenceDate,
  weekdayOf,
} from '../../../src/engine/harvest/dates';
import { harvestNames, startsSentence } from '../../../src/engine/harvest/names';
import { extractNumbers, parseNumber } from '../../../src/engine/harvest/numbers';

const REF = referenceDate('2026-11-02', new Date());

describe('AC-3.5 chrono-node 2.10.3 spike (recorded in ADR-0002)', () => {
  const ref = new Date(2026, 10, 2, 12);

  it('reads only the weekday from "Thursday the 10th" (day is implied, not certain)', () => {
    const [r, ...rest] = chrono.en.parse('Thursday the 10th', ref);
    expect(rest).toHaveLength(0);
    expect(r?.text).toBe('Thursday');
    expect(r?.start.isCertain('weekday')).toBe(true);
    expect(r?.start.get('weekday')).toBe(4);
    expect(r?.start.isCertain('day')).toBe(false);
  });

  it('keeps a written weekday and day certain without adjusting the day when a month is present', () => {
    const [r] = chrono.en.parse('Thu 10 Nov', ref);
    expect(r?.start.get('weekday')).toBe(4);
    expect(r?.start.isCertain('weekday')).toBe(true);
    expect(r?.start.get('day')).toBe(10);
    expect(r?.start.isCertain('day')).toBe(true);
    // The resolved date follows the day, not the weekday: Tue 10 Nov 2026.
    expect(r?.start.date().getDay()).toBe(2);
  });

  it('so the engine parses "weekday the Nth" itself', () => {
    const [d] = extractDates('Thursday the 10th', REF);
    expect(d).toMatchObject({ weekday: 4, day: 10, month: 11, year: 2026, monthStated: false });
  });
});

describe('extractDates', () => {
  it.each([
    ['Thursday the 12th', { weekday: 4, day: 12, month: 11 }],
    ['Thu 12th', { weekday: 4, day: 12, month: 11 }],
    ['Friday the 13', { weekday: 5, day: 13, month: 11 }],
    ['Thu 10 Nov', { weekday: 4, day: 10, month: 11, monthStated: true }],
    ['Thursday, November 12', { weekday: 4, day: 12, month: 11, monthStated: true }],
    ['on 12 November', { day: 12, month: 11, monthStated: true }],
  ])('%s', (text, expected) => {
    const [d] = extractDates(text, REF);
    expect(d).toMatchObject(expected);
    expect(text.slice(d?.start, d?.end)).toBe(d?.text);
  });

  it.each([
    'next Friday',
    'Friday 13 people came',
    'see you Thursday',
    'I sat the 3rd exam',
    '11/12',
    'Friday 3pm',
    'on the 10th',
  ])('ignores %j', (text) => {
    expect(
      extractDates(text, REF).filter((d) => d.weekday !== undefined && !d.monthStated),
    ).toHaveLength(0);
    expect(extractDates(text, REF).filter((d) => /^\d/.test(d.text))).toHaveLength(0);
  });

  it('infers the month of a bare day from the reference date', () => {
    expect(inferMonth(10, REF)).toEqual({ month: 11, year: 2026 });
    // The 1st is more than a week before the 2nd? No: still November.
    expect(inferMonth(1, REF)).toEqual({ month: 11, year: 2026 });
    const late = referenceDate('2026-12-28', new Date());
    expect(inferMonth(3, late)).toEqual({ month: 1, year: 2027 });
    // February has no 30th: roll to March.
    expect(inferMonth(30, referenceDate('2027-02-10', new Date()))).toEqual({
      month: 3,
      year: 2027,
    });
  });

  it('computes weekdays on the real calendar', () => {
    expect(weekdayOf(2026, 11, 12)).toBe(4);
    expect(weekdayOf(2026, 11, 10)).toBe(2);
    expect(weekdayOf(2026, 11, 23)).toBe(1);
  });

  it('reads the reference date without time-zone drift', () => {
    expect(referenceDate('2026-11-02T23:30:00-08:00', new Date()).toISOString()).toBe(
      '2026-11-02T12:00:00.000Z',
    );
    expect(referenceDate(undefined, new Date(2026, 9, 20, 23, 59)).toISOString()).toBe(
      '2026-10-20T12:00:00.000Z',
    );
  });

  it('parses Gmail timestamps to ISO dates', () => {
    expect(parseTimestamp('Mon, Nov 2, 2026, 9:14 AM')).toBe('2026-11-02');
    expect(parseTimestamp('2 Nov 2026, 09:14')).toBe('2026-11-02');
    expect(parseTimestamp('yesterday-ish')).toBeUndefined();
  });
});

describe('extractNumbers', () => {
  it('parses decimal separators in both conventions', () => {
    expect(parseNumber('1,250')).toEqual({ intDigits: '1250', fracDigits: '' });
    expect(parseNumber('1,250.50')).toEqual({ intDigits: '1250', fracDigits: '50' });
    expect(parseNumber('1.250,00')).toEqual({ intDigits: '1250', fracDigits: '00' });
    expect(parseNumber('12,5')).toEqual({ intDigits: '12', fracDigits: '5' });
    expect(parseNumber('1.250')).toEqual({ intDigits: '1250', fracDigits: '' });
    expect(parseNumber('1 250,00'.replace(' ', String.fromCharCode(0xa0)))).toEqual({
      intDigits: '1250',
      fracDigits: '00',
    });
  });

  it('finds amounts with currency before or after, and unit amounts', () => {
    const found = extractNumbers(
      'Pay $1,250.00 or 1.250,00 € or £980 or 1250 USD for 14 nights at 20%.',
    );
    expect(found.map((n) => [n.text, n.kind, n.digits, n.unit])).toEqual([
      ['$1,250.00', 'amount', '1250', 'USD'],
      ['1.250,00 €', 'amount', '1250', 'EUR'],
      ['£980', 'amount', '980', 'GBP'],
      ['1250 USD', 'amount', '1250', 'USD'],
      ['14 nights', 'amount', '14', 'night'],
      ['20%', 'amount', '20', 'percent'],
    ]);
  });

  it('finds IDs: keyword, #, alphanumeric, phone and long digits', () => {
    const found = extractNumbers(
      'Order #48213, invoice INV-20931, booking ref: BK77120, call 415-555-0142, tracking 1Z999 and 90210.',
    );
    expect(found.map((n) => [n.text, n.kind, n.digits, n.prefix, n.label])).toEqual([
      ['#48213', 'id', '48213', '', 'order'],
      ['INV-20931', 'id', '20931', 'INV', 'invoice'],
      ['BK77120', 'id', '77120', 'BK', 'ref'],
      ['415-555-0142', 'id', '4155550142', '', 'phone'],
      ['1Z999', 'id', '1999', '', 'tracking'],
      ['90210', 'id', '90210', '', ''],
    ]);
  });

  it('ignores bare years, times, ordinals and small counts', () => {
    expect(extractNumbers('In 2026 at 10:30 on the 12th, 3 kids and 4 dogs')).toHaveLength(1);
    expect(extractNumbers('In 2026 at 10:30 on the 12th')).toHaveLength(0);
  });
});

describe('harvestNames', () => {
  it('collects signature, sender, recipients, greeting and body names with citations', () => {
    const names = harvestNames({
      latestMessage: 'Hi Sam,\n\nMarisol will bring the keys.',
      signatureBlock: 'Thanks,\nKathryn Moss',
      sender: { name: 'Moss, Kathryn', role: 'sender' },
      recipients: [
        { name: 'Sam Ortiz', role: 'to' },
        { name: 'Lee Park', role: 'cc' },
      ],
    });
    const by = (src: string) => names.filter((n) => n.source === src).map((n) => n.text);
    expect(by('signature')).toEqual(['Kathryn', 'Moss']);
    expect(by('from')).toEqual(['Kathryn', 'Moss']);
    expect(by('to')).toEqual(['Sam', 'Ortiz']);
    expect(by('cc')).toEqual(['Lee', 'Park']);
    expect(by('greeting')).toEqual(['Sam']);
    expect(names.find((n) => n.source === 'from')?.line).toBe('From: Kathryn Moss');
    // "Marisol" starts a sentence, so it is not a body name (but the guard still knows it).
    expect(by('body')).toEqual([]);
  });

  it('takes capitalised non-initial body tokens, skipping common words and acronyms', () => {
    const names = harvestNames({
      latestMessage: 'I spoke with Marisol and the HOA on Monday about the Larchmont lease.',
      recipients: [],
    });
    expect(names.map((n) => n.text)).toEqual(['Marisol', 'Larchmont']);
  });

  it('knows sentence starts', () => {
    const t = 'Done. Kathryn will call.\nMarisol too';
    expect(startsSentence(t, t.indexOf('Kathryn'))).toBe(true);
    expect(startsSentence(t, t.indexOf('Marisol'))).toBe(true);
    expect(startsSentence(t, t.indexOf('call'))).toBe(false);
  });
});
