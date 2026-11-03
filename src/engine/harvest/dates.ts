import * as chrono from 'chrono-node';
import { WEEKDAYS } from '../text/lexicon';
import { lineAt } from '../text/tokens';
import type { Span } from '../types';

/** A date with an explicit day number found in a text. */
export interface DateMention extends Span {
  text: string;
  /** Weekday as written (0 = Sunday); undefined when none was written. */
  weekday?: number;
  day: number;
  /** 1–12 */
  month: number;
  year: number;
  monthStated: boolean;
  line: string;
}

const WEEKDAY_WORD = String.raw`(Sunday|Sun|Monday|Mon|Tuesday|Tues|Tue|Wednesday|Wed|Thursday|Thurs|Thur|Thu|Friday|Fri|Saturday|Sat)\.?`;
const MONTH_WORD = String.raw`(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b`;

/**
 * "Thursday the 10th", "Thu 10th", "Friday the 13": weekday + day without a
 * month. chrono-node 2.10.3 reads only the weekday from these (AC-3.5 spike),
 * so the engine parses them itself. A bare "Friday 13" without "the" or an
 * ordinal suffix is ignored ("Friday 13 people").
 */
const WEEKDAY_DAY_RE = new RegExp(
  String.raw`\b${WEEKDAY_WORD},?\s+(?:the\s+(\d{1,2})(?:st|nd|rd|th)?|(\d{1,2})(?:st|nd|rd|th))\b(?!\s*(?:of\s+)?${MONTH_WORD})(?!\s*(?:am|pm|AM|PM|a\.m|p\.m|:|h\b|o'clock))`,
  'g',
);

/** Numeric-only dates (11/12, 12.11.2026) are ambiguous between locales; never used. */
const NUMERIC_DATE_RE = /^\s*\d{1,4}[/.-]\d{1,2}(?:[/.-]\d{1,4})?\s*$/;

export function weekdayOf(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Day-of-epoch for date arithmetic without time zones. */
export function epochDay(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

/**
 * Month/year for a day number written without a month: the first occurrence
 * of that day on or after one week before the reference date.
 */
export function inferMonth(day: number, ref: Date): { month: number; year: number } {
  let year = ref.getUTCFullYear();
  let month = ref.getUTCMonth() + 1;
  const floor = epochDay(year, month, ref.getUTCDate()) - 7;
  for (let i = 0; i < 3; i++) {
    if (day <= daysInMonth(year, month) && epochDay(year, month, day) >= floor)
      return { month, year };
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return { month, year };
}

/**
 * Reference date (UTC noon of a calendar day) from an ISO date or date-time
 * string. The calendar date is read from the string itself so time zones never
 * shift it; falls back to `fallback`'s local calendar date.
 */
export function referenceDate(iso: string | undefined, fallback: Date): Date {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return new Date(Date.UTC(fallback.getFullYear(), fallback.getMonth(), fallback.getDate(), 12));
}

const DAY_MS = 86_400_000;

/**
 * The year of a date written without one. chrono's forwardDate pushes a day
 * that has passed into next year, which is right for "see you on 6 October"
 * and wrong for "thanks for Tuesday, October 6" a month later. So: among last,
 * this and next year, take the one closest to the reference date, and when a
 * weekday is written, the closest one within six months whose weekday agrees.
 */
function likeliestYear(
  day: number,
  month: number,
  parsed: number,
  weekday: number | undefined,
  ref: Date,
): number {
  const candidates = [parsed - 1, parsed, parsed + 1]
    .map((y) => ({ y, at: Date.UTC(y, month - 1, day, 12) }))
    .map((c) => ({ ...c, away: Math.abs(c.at - ref.getTime()) }))
    .sort((a, b) => a.away - b.away);
  if (weekday !== undefined) {
    const agreeing = candidates.find(
      (c) => c.away <= 183 * DAY_MS && new Date(c.at).getUTCDay() === weekday,
    );
    if (agreeing) return agreeing.y;
  }
  return candidates[0]?.y ?? parsed;
}

export function extractDates(text: string, ref: Date): DateMention[] {
  const out: DateMention[] = [];
  const localRef = new Date(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate(), 12);

  for (const r of chrono.en.parse(text, localRef, { forwardDate: true })) {
    const s = r.start;
    if (!s.isCertain('day') || !s.isCertain('month')) continue;
    if (NUMERIC_DATE_RE.test(r.text)) continue;
    const day = s.get('day');
    const month = s.get('month');
    const parsedYear = s.get('year');
    if (day === null || month === null || parsedYear === null) continue;
    const weekday = s.isCertain('weekday') ? (s.get('weekday') ?? undefined) : undefined;
    const year = s.isCertain('year')
      ? parsedYear
      : likeliestYear(day, month, parsedYear, weekday, ref);
    out.push({
      start: r.index,
      end: r.index + r.text.length,
      text: r.text,
      ...(weekday === undefined ? {} : { weekday }),
      day,
      month,
      year,
      monthStated: true,
      line: lineAt(text, r.index),
    });
  }

  for (const m of text.matchAll(WEEKDAY_DAY_RE)) {
    const start = m.index;
    const end = start + m[0].length;
    if (out.some((d) => start < d.end && end > d.start)) continue;
    const day = Number(m[2] ?? m[3]);
    if (!(day >= 1 && day <= 31)) continue;
    const weekday = WEEKDAYS[(m[1] ?? '').toLowerCase()];
    if (weekday === undefined) continue;
    const { month, year } = inferMonth(day, ref);
    out.push({
      start,
      end,
      text: m[0],
      weekday,
      day,
      month,
      year,
      monthStated: false,
      line: lineAt(text, start),
    });
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Parses a Gmail-style timestamp ("Mon, Nov 2, 2026, 9:14 AM") to an ISO date (YYYY-MM-DD). */
export function parseTimestamp(text: string): string | undefined {
  // Gmail timestamps are absolute; never resolve relative words like "yesterday".
  if (!/\d/.test(text)) return undefined;
  const r = chrono.en.parse(text)[0];
  if (!r?.start.isCertain('day') || !r.start.isCertain('month')) return undefined;
  const y = r.start.get('year');
  const mo = r.start.get('month');
  const d = r.start.get('day');
  if (y === null || mo === null || d === null) return undefined;
  return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
