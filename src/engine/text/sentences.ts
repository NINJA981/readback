import type { Span } from '../types';

export interface Sentence extends Span {
  text: string;
}

const ABBREVIATIONS = new Set([
  'mr',
  'mrs',
  'ms',
  'dr',
  'prof',
  'st',
  'sr',
  'jr',
  'vs',
  'etc',
  'e.g',
  'i.e',
  'a.m',
  'p.m',
  'approx',
  'no',
  'inc',
  'ltd',
  'co',
  'jan',
  'feb',
  'mar',
  'apr',
  'jun',
  'jul',
  'aug',
  'sep',
  'sept',
  'oct',
  'nov',
  'dec',
  'mon',
  'tue',
  'tues',
  'wed',
  'thu',
  'thur',
  'thurs',
  'fri',
  'sat',
  'sun',
]);

const BULLET_RE = /^\s*(?:[-*•–]|\d{1,2}[.)])\s+/;

/**
 * Splits text into sentences with UTF-16 spans. Newlines always end a sentence
 * when the line is a list item, or when a blank line follows; otherwise a
 * soft-wrapped line continues. Terminal punctuation ends a sentence unless it
 * closes a known abbreviation or sits inside a number (`$1,250.00`).
 */
export function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  let start = 0;

  const push = (end: number): void => {
    let s = start;
    let e = end;
    while (s < e && /\s/.test(text.charAt(s))) s++;
    while (e > s && /\s/.test(text.charAt(e - 1))) e--;
    // Strip a leading list bullet from the sentence but keep spans exact.
    const bullet = BULLET_RE.exec(text.slice(s, e));
    if (bullet) s += bullet[0].length;
    if (e > s) out.push({ text: text.slice(s, e), start: s, end: e });
    start = end;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (ch === '\n') {
      const lineStart = text.lastIndexOf('\n', i - 1) + 1;
      const line = text.slice(lineStart, i);
      const next = text.slice(
        i + 1,
        text.indexOf('\n', i + 1) === -1 ? text.length : text.indexOf('\n', i + 1),
      );
      const hardBreak =
        line.trim() === '' ||
        next.trim() === '' ||
        BULLET_RE.test(line) ||
        BULLET_RE.test(next) ||
        /[.?!:;)]\s*$/.test(line) ||
        /^\s*[\p{Lu}\d"“'‘(]/u.test(next);
      if (hardBreak) push(i + 1);
      continue;
    }
    if (ch === '.' || ch === '?' || ch === '!' || ch === '…') {
      // Absorb runs like "?!" or "..." and closing quotes/brackets.
      let j = i + 1;
      while (j < text.length && /[.?!…"”'’)\]]/.test(text.charAt(j))) j++;
      const after = text.charAt(j);
      if (j < text.length && !/\s/.test(after)) {
        i = j - 1;
        continue;
      }
      if (ch === '.' && isAbbreviation(text, i)) continue;
      push(j);
      i = j - 1;
    }
  }
  push(text.length);
  return out;
}

function isAbbreviation(text: string, dotIndex: number): boolean {
  const before = /([\p{L}.]+)$/u.exec(text.slice(Math.max(0, dotIndex - 8), dotIndex));
  if (!before) return false;
  // "the 1st." ends a sentence: an abbreviation never follows a digit directly.
  const wordStart = dotIndex - (before[1] ?? '').length;
  if (/\d/.test(text.charAt(wordStart - 1))) return false;
  const word = (before[1] ?? '').toLowerCase();
  if (ABBREVIATIONS.has(word)) return true;
  // Single capital initial: "J. Smith".
  return /^\p{Lu}$/u.test(before[1] ?? '');
}
