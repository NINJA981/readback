import {
  threadDateMessage,
  weekdayDay,
  weekdayMismatchMessage,
  weekdayName,
  ordinal,
} from '../cite';
import { shortId } from '../hash';
import { epochDay, extractDates, weekdayOf } from '../harvest/dates';
import type { DateMention } from '../harvest/dates';
import { MONTH_NAMES } from '../text/lexicon';
import type { DateRef, Fix, Flag, TokenRef } from '../types';

const WEEKDAY_TOKEN_RE =
  /\b(Sunday|Sun|Monday|Mon|Tuesday|Tues|Tue|Wednesday|Wed|Thursday|Thurs|Thur|Thu|Friday|Fri|Saturday|Sat)\b/;
const DAY_TOKEN_RE = /\b(\d{1,2})(st|nd|rd|th)?\b/;

/**
 * Rewrites a written date with a new weekday and day, keeping the writer's
 * style: abbreviated weekdays stay abbreviated, ordinal suffixes are recomputed
 * only when one was written.
 */
export function restyleDate(written: string, weekday: number, day: number): string {
  let out = written.replace(WEEKDAY_TOKEN_RE, (word) =>
    word.length <= 5 ? weekdayName(weekday).slice(0, 3) : weekdayName(weekday),
  );
  out = out.replace(DAY_TOKEN_RE, (_m, _num: string, suffix: string | undefined) =>
    suffix ? ordinal(day) : String(day),
  );
  return out;
}

export interface DateGuardInput {
  threadKey: string;
  draft: string;
  /** Reference date (UTC noon) for inferring months in the draft. */
  ref: Date;
  dates: DateRef[];
}

/**
 * Date guard (SPEC F3). A draft date fires only when its written weekday
 * disagrees with the calendar. If the thread proposed a date with the same
 * weekday or the same day number within ±7 days, the flag cites the thread
 * (`thread-near-miss`) and offers both fixes; otherwise it cites the calendar
 * (`weekday-mismatch`). Calendar-consistent dates never fire, so a genuinely
 * different proposal ("Monday the 23rd") stays silent (ADR-0002).
 */
export function dateGuard(input: DateGuardInput): Flag[] {
  const flags: Flag[] = [];
  const threadDates = input.dates.filter(
    (t) => t.weekday !== undefined && weekdayOf(t.year, t.month, t.day) === t.weekday,
  );

  for (const d of extractDates(input.draft, input.ref)) {
    if (d.weekday === undefined) continue;
    const actual = weekdayOf(d.year, d.month, d.day);
    if (actual === d.weekday) continue;

    const keepNumber = restyleDate(d.text, actual, d.day);
    const near = nearestThreadDate(d, threadDates);

    if (near && near.weekday !== undefined) {
      const sameMonthStyle = !d.monthStated || near.month === d.month;
      const threadFix = sameMonthStyle ? restyleDate(d.text, near.weekday, near.day) : near.text;
      const fixes: Fix[] = [{ label: weekdayDay(near.weekday, near.day), replacement: threadFix }];
      if (keepNumber !== threadFix) {
        fixes.push({ label: weekdayDay(actual, d.day), replacement: keepNumber });
      }
      flags.push({
        id: shortId(input.threadKey, 'date', d.text, near.text),
        guard: 'date',
        draftSpan: { start: d.start, end: d.end },
        found: d.text,
        expected: near.text,
        rule: 'thread-near-miss',
        message: threadDateMessage(near.weekday, near.day),
        citation: near,
        fixes,
      });
      continue;
    }

    const citation: TokenRef = {
      text: weekdayDay(actual, d.day),
      source: 'calendar',
      span: { start: 0, end: 0 },
      line: `${weekdayName(actual)}, ${d.day} ${monthName(d.month)} ${d.year}`,
    };
    flags.push({
      id: shortId(input.threadKey, 'date', d.text, `${d.year}-${d.month}-${d.day}`),
      guard: 'date',
      draftSpan: { start: d.start, end: d.end },
      found: d.text,
      expected: citation.text,
      rule: 'weekday-mismatch',
      message: weekdayMismatchMessage(d.day, actual),
      citation,
      fixes: [{ label: citation.text, replacement: keepNumber }],
    });
  }
  return flags;
}

function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? '';
}

/** The thread date sharing the draft's weekday or day number, closest in time, within ±7 days. */
function nearestThreadDate(d: DateMention, threadDates: DateRef[]): DateRef | undefined {
  // Compare against the date the writer most likely meant: the written day number.
  const draftDay = epochDay(d.year, d.month, d.day);
  let best: { ref: DateRef; score: number } | undefined;
  for (const t of threadDates) {
    const sameWeekday = t.weekday === d.weekday;
    const sameDay = t.day === d.day;
    if (!sameWeekday && !sameDay) continue;
    const distance = Math.abs(epochDay(t.year, t.month, t.day) - draftDay);
    if (distance > 7) continue;
    // Same weekday beats same day number; then closer wins.
    const score = (sameWeekday ? 0 : 100) + distance;
    if (!best || score < best.score) best = { ref: t, score };
  }
  return best?.ref;
}
