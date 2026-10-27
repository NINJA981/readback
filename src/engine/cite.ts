/**
 * The single source of Readback's slip copy (SPEC F1–F3). Messages cite the
 * thread in the reader's terms and never use a generic "spelling" label.
 *
 * Gender: the spec's sample copy reads "She signs Kathryn", but the engine
 * cannot know the sender's pronouns, so signature citations use the neutral
 * "Signs as Kathryn" (ADR-0002).
 */
import { MONTH_NAMES, WEEKDAY_NAMES } from './text/lexicon';
import type { FlagRule, NameRef, NumberRef, TokenRef } from './types';

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function weekdayName(weekday: number): string {
  return WEEKDAY_NAMES[((weekday % 7) + 7) % 7] ?? '';
}

/** "Thursday the 12th" */
export function weekdayDay(weekday: number, day: number): string {
  return `${weekdayName(weekday)} the ${ordinal(day)}`;
}

export function nameMessage(target: NameRef): string {
  switch (target.source) {
    case 'signature':
      return `Signs as ${target.text}`;
    case 'from':
    case 'to':
    case 'cc':
      return target.line;
    case 'greeting':
    case 'body':
      return `Thread says ${target.text}`;
  }
}

export function numberMessage(ref: NumberRef, rule: FlagRule): string {
  const tail = rule === 'transposition' ? 'Digits swapped?' : 'One digit differs.';
  if (ref.kind === 'id' && ref.label && ref.label !== 'phone') {
    const label = ref.label.charAt(0).toUpperCase() + ref.label.slice(1);
    return `${label} ${ref.text} in the thread. ${tail}`;
  }
  return `Thread says ${ref.text}. ${tail}`;
}

export function weekdayMismatchMessage(day: number, actualWeekday: number): string {
  return `The ${ordinal(day)} is a ${weekdayName(actualWeekday)}.`;
}

export function threadDateMessage(weekday: number, day: number): string {
  return `Thread says ${weekdayDay(weekday, day)}.`;
}

/**
 * Caption under the citation block: where the cited token came from.
 * `sentAt` is the incoming message's ISO date.
 */
export function citationSource(citation: TokenRef, sentAt?: string): string {
  switch (citation.source) {
    case 'signature':
      return 'From the signature';
    case 'from':
      return 'From the sender';
    case 'to':
      return 'From the To field';
    case 'cc':
      return 'From the Cc field';
    case 'calendar':
      return 'From the calendar';
    default: {
      const m = sentAt ? /^(\d{4})-(\d{2})-(\d{2})/.exec(sentAt) : null;
      if (!m) return 'From the message';
      const month = MONTH_NAMES[Number(m[2]) - 1]?.slice(0, 3) ?? '';
      return `From the message, ${Number(m[3])} ${month}`;
    }
  }
}
