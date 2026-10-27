import { lineAt } from '../text/tokens';
import type { NumberKind, Span } from '../types';

/** A number found in a text, thread or draft. */
export interface NumberMention extends Span {
  /** Exactly as written, including currency symbol or `#`. */
  text: string;
  kind: NumberKind;
  /** Integer digits as written (leading zeros kept). */
  intDigits: string;
  /** Fraction digits as written ("" when none). */
  fracDigits: string;
  /** Canonical comparison string: integer digits + fraction digits unless the fraction is all zeros. */
  digits: string;
  /** Normalised currency code ("USD", "EUR", "GBP", …) or singular unit word; "" for IDs. */
  unit: string;
  /** Upper-cased letter prefix for alphanumeric IDs ("INV" in "INV-20931"). */
  prefix: string;
  /** Lower-case keyword before an ID ("order", "invoice"), used for citation labels. */
  label: string;
  line: string;
}

const CURRENCY: Record<string, string> = {
  $: 'USD',
  us$: 'USD',
  usd: 'USD',
  dollars: 'USD',
  dollar: 'USD',
  bucks: 'USD',
  c$: 'CAD',
  cad: 'CAD',
  a$: 'AUD',
  aud: 'AUD',
  '€': 'EUR',
  eur: 'EUR',
  euros: 'EUR',
  euro: 'EUR',
  '£': 'GBP',
  gbp: 'GBP',
  pounds: 'GBP',
  '¥': 'JPY',
  jpy: 'JPY',
  '₹': 'INR',
  inr: 'INR',
  rs: 'INR',
  chf: 'CHF',
};

const UNITS: Record<string, string> = {
  night: 'night',
  nights: 'night',
  day: 'day',
  days: 'day',
  week: 'week',
  weeks: 'week',
  month: 'month',
  months: 'month',
  hour: 'hour',
  hours: 'hour',
  hrs: 'hour',
  hr: 'hour',
  minute: 'minute',
  minutes: 'minute',
  mins: 'minute',
  people: 'person',
  persons: 'person',
  guests: 'guest',
  guest: 'guest',
  kids: 'child',
  children: 'child',
  students: 'student',
  tickets: 'ticket',
  ticket: 'ticket',
  items: 'item',
  units: 'unit',
  pieces: 'piece',
  pcs: 'piece',
  boxes: 'box',
  copies: 'copy',
  pages: 'page',
  seats: 'seat',
  rooms: 'room',
  kg: 'kg',
  lbs: 'lb',
  lb: 'lb',
  km: 'km',
  miles: 'mile',
  mi: 'mile',
  'sq ft': 'sqft',
  sqft: 'sqft',
  '%': 'percent',
  percent: 'percent',
};

/** No-break and narrow no-break spaces, used as thousands separators in many locales. */
const NBSP = String.fromCharCode(0xa0, 0x202f);
const NUM = String.raw`\d{1,3}(?:[,.${NBSP}]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
const CUR_PREFIX = String.raw`US\$|C\$|A\$|\$|£|€|¥|₹|(?:USD|EUR|GBP|CAD|AUD|INR|CHF|Rs\.?)\s?`;
const CUR_SUFFIX = String.raw`\s?(?:€|£|\$|USD|EUR|GBP|CAD|AUD|INR|CHF|dollars?|euros?|pounds|bucks)`;
const UNIT_SUFFIX = String.raw`\s?(?:%|(?:nights?|days?|weeks?|months?|hours?|hrs?|minutes?|mins|people|persons|guests?|kids|children|students|tickets?|items|units|pieces|pcs|boxes|copies|pages|seats|rooms|kg|lbs?|km|miles|mi|sq ?ft|sqft|percent)\b)`;

const ID_KEYWORD = String.raw`(order|invoice|inv|booking|reservation|ref(?:erence)?|tracking|account|acct|confirmation|case|ticket|po|policy|claim|member|customer|application|receipt|job|unit|room|flight|transaction)`;

const ID_KEYWORD_RE = new RegExp(
  // The keyword must be followed by a separator, so "INV-20931" is read as an
  // alphanumeric ID with prefix INV, not keyword "inv" + "-20931".
  String.raw`\b${ID_KEYWORD}(?=[\s:#])\s*(?:no\.?|number|num|id|code)?\s*(?:is|was|:)?\s*#?\s*([A-Z]{0,5}-?\d[\dA-Z-]{2,}\d|\d{3,})\b`,
  'gi',
);
const HASH_ID_RE = /#\s?(\d{3,}[\dA-Z-]*)\b/g;
const ALNUM_ID_RE = /\b([A-Z]{2,5})-?(\d{3,})\b/g;
const PHONE_RE =
  /(?<![\d-])(?:\+\d{1,3}[\s.-]?)?(?:\(\d{3}\)\s?|\d{3}[\s.-])\d{3}[\s.-]\d{4}(?![\d-])/g;
const LONG_DIGITS_RE = /(?<![\d.,$£€¥₹#-])\d{5,}(?![\d.,]?\d)/g;
const CUR_PREFIX_RE = new RegExp(String.raw`(?<![\p{L}\d])(${CUR_PREFIX})(${NUM})(?![\d])`, 'giu');
const CUR_SUFFIX_RE = new RegExp(
  String.raw`(?<![\p{L}\d.,])(${NUM})(${CUR_SUFFIX})(?![\p{L}])`,
  'giu',
);
const UNIT_RE = new RegExp(String.raw`(?<![\p{L}\d.,$£€])(${NUM})(${UNIT_SUFFIX})`, 'giu');

/** Splits a written number into integer and fraction digits, reading the decimal separator. */
export function parseNumber(written: string): { intDigits: string; fracDigits: string } {
  const s = written.replace(new RegExp(`[${NBSP} ]`, 'g'), '');
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let decimalAt = -1;
  if (lastDot !== -1 && lastComma !== -1) {
    decimalAt = Math.max(lastDot, lastComma);
  } else {
    const sep = lastDot !== -1 ? lastDot : lastComma;
    if (sep !== -1) {
      const after = s.length - sep - 1;
      const sepChar = s.charAt(sep);
      const count = s.split(sepChar).length - 1;
      // One separator followed by 1–2 digits is a decimal point.
      if (count === 1 && after > 0 && after <= 2) decimalAt = sep;
    }
  }
  if (decimalAt === -1) return { intDigits: s.replace(/\D/g, ''), fracDigits: '' };
  return {
    intDigits: s.slice(0, decimalAt).replace(/\D/g, ''),
    fracDigits: s.slice(decimalAt + 1).replace(/\D/g, ''),
  };
}

function canonical(intDigits: string, fracDigits: string): string {
  return /^0*$/.test(fracDigits) ? intDigits : intDigits + fracDigits;
}

function overlaps(spans: Span[], start: number, end: number): boolean {
  return spans.some((s) => start < s.end && end > s.start);
}

/**
 * Finds amounts (currency or unit) and IDs (keyword, `#`, alphanumeric,
 * phone-style, 5+ bare digits). Bare numbers without currency, unit or ID
 * context are ignored on purpose: years, times and counts would only add noise.
 */
export function extractNumbers(text: string): NumberMention[] {
  const out: NumberMention[] = [];
  const taken: Span[] = [];
  const add = (m: Omit<NumberMention, 'line'>): void => {
    if (overlaps(taken, m.start, m.end)) return;
    taken.push({ start: m.start, end: m.end });
    out.push({ ...m, line: lineAt(text, m.start) });
  };

  for (const m of text.matchAll(ID_KEYWORD_RE)) {
    const raw = m[2] ?? '';
    const label = (m[1] ?? '').toLowerCase();
    const idStart = m.index + m[0].lastIndexOf(raw);
    const hashAt = text.lastIndexOf('#', idStart);
    const start = hashAt !== -1 && hashAt >= idStart - 2 ? hashAt : idStart;
    const prefix = /^([A-Za-z]+)/.exec(raw)?.[1]?.toUpperCase() ?? '';
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 3) continue;
    add({
      start,
      end: idStart + raw.length,
      text: text.slice(start, idStart + raw.length),
      kind: 'id',
      intDigits: digits,
      fracDigits: '',
      digits,
      unit: '',
      prefix,
      label,
    });
  }
  for (const m of text.matchAll(HASH_ID_RE)) {
    const digits = (m[1] ?? '').replace(/\D/g, '');
    add({
      start: m.index,
      end: m.index + m[0].length,
      text: m[0],
      kind: 'id',
      intDigits: digits,
      fracDigits: '',
      digits,
      unit: '',
      prefix: '',
      label: '',
    });
  }
  for (const m of text.matchAll(ALNUM_ID_RE)) {
    const digits = m[2] ?? '';
    add({
      start: m.index,
      end: m.index + m[0].length,
      text: m[0],
      kind: 'id',
      intDigits: digits,
      fracDigits: '',
      digits,
      unit: '',
      prefix: (m[1] ?? '').toUpperCase(),
      label: '',
    });
  }
  for (const m of text.matchAll(PHONE_RE)) {
    const digits = m[0].replace(/\D/g, '');
    add({
      start: m.index,
      end: m.index + m[0].length,
      text: m[0],
      kind: 'id',
      intDigits: digits,
      fracDigits: '',
      digits,
      unit: '',
      prefix: '',
      label: 'phone',
    });
  }
  for (const m of text.matchAll(CUR_PREFIX_RE)) {
    const { intDigits, fracDigits } = parseNumber(m[2] ?? '');
    const unit = CURRENCY[(m[1] ?? '').trim().replace(/\.$/, '').toLowerCase()] ?? '';
    add({
      start: m.index,
      end: m.index + m[0].length,
      text: m[0],
      kind: 'amount',
      intDigits,
      fracDigits,
      digits: canonical(intDigits, fracDigits),
      unit,
      prefix: '',
      label: '',
    });
  }
  for (const m of text.matchAll(CUR_SUFFIX_RE)) {
    const { intDigits, fracDigits } = parseNumber(m[1] ?? '');
    const unit = CURRENCY[(m[2] ?? '').trim().toLowerCase()] ?? '';
    add({
      start: m.index,
      end: m.index + m[0].length,
      text: m[0],
      kind: 'amount',
      intDigits,
      fracDigits,
      digits: canonical(intDigits, fracDigits),
      unit,
      prefix: '',
      label: '',
    });
  }
  for (const m of text.matchAll(UNIT_RE)) {
    const { intDigits, fracDigits } = parseNumber(m[1] ?? '');
    const unitWord = (m[2] ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    add({
      start: m.index,
      end: m.index + m[0].length,
      text: m[0],
      kind: 'amount',
      intDigits,
      fracDigits,
      digits: canonical(intDigits, fracDigits),
      unit: UNITS[unitWord] ?? unitWord,
      prefix: '',
      label: '',
    });
  }
  for (const m of text.matchAll(LONG_DIGITS_RE)) {
    add({
      start: m.index,
      end: m.index + m[0].length,
      text: m[0],
      kind: 'id',
      intDigits: m[0],
      fracDigits: '',
      digits: m[0],
      unit: '',
      prefix: '',
      label: '',
    });
  }
  return out.sort((a, b) => a.start - b.start);
}
