import { numberMessage } from '../cite';
import { shortId } from '../hash';
import type { NumberMention } from '../harvest/numbers';
import { extractNumbers } from '../harvest/numbers';
import type { Flag, FlagRule, NumberRef } from '../types';

/**
 * Phrases that frame a number as a deliberate counter-offer. When one sits in
 * the same sentence before the number (or "instead" right after), the guard
 * stays silent.
 */
const COUNTER_OFFER_BEFORE =
  /\b(?:instead of|rather than|how about|what about|could we do|can we do|could you do|can you do|would you take|would you accept|would you do|we can offer|we could offer|i can offer|i could offer|i can do|i could do|best i can do|counter(?:-?offer)?|meet (?:you )?in the middle|settle (?:on|for)|go (?:up|down) to|bump (?:it )?(?:up|down) to|negotiate|propose|offer(?:ing)?)\b/i;
const COUNTER_OFFER_AFTER =
  /^[^.?!\n]{0,40}\b(?:instead|rather|as a counter|if that works|work for you)\b/i;

/** Difference between two equal-length digit strings: one transposition or one substitution. */
export function digitRule(
  thread: string,
  draft: string,
): { rule: Extract<FlagRule, 'transposition' | 'substitution'>; positions: number[] } | undefined {
  if (thread.length !== draft.length || thread === draft) return undefined;
  const diff: number[] = [];
  for (let i = 0; i < thread.length; i++) {
    if (thread.charAt(i) !== draft.charAt(i)) diff.push(i);
    if (diff.length > 2) return undefined;
  }
  const [a, b] = diff;
  if (diff.length === 1 && a !== undefined) return { rule: 'substitution', positions: [a] };
  if (
    diff.length === 2 &&
    a !== undefined &&
    b !== undefined &&
    b - a <= 2 &&
    thread.charAt(a) === draft.charAt(b) &&
    thread.charAt(b) === draft.charAt(a)
  ) {
    return { rule: 'transposition', positions: [a, b] };
  }
  return undefined;
}

/** True when the draft frames the number at `start` as a counter-offer. */
export function inCounterOfferFrame(draft: string, start: number, end: number): boolean {
  const sentenceStart = Math.max(
    draft.lastIndexOf('.', start - 1),
    draft.lastIndexOf('?', start - 1),
    draft.lastIndexOf('!', start - 1),
    draft.lastIndexOf('\n', start - 1),
  );
  const before = draft.slice(sentenceStart + 1, start);
  if (COUNTER_OFFER_BEFORE.test(before)) return true;
  return COUNTER_OFFER_AFTER.test(draft.slice(end));
}

/**
 * Rewrites the digits of `display` so its canonical digits read `target`,
 * keeping the draft's own symbols and separators (`1.520,00 €` → `1.250,00 €`).
 */
export function rewriteDigits(display: string, target: string): string {
  let i = 0;
  let out = '';
  for (const ch of display) {
    if (/\d/.test(ch) && i < target.length) {
      out += target.charAt(i);
      i++;
    } else {
      out += ch;
    }
  }
  return out;
}

export interface NumberGuardInput {
  threadKey: string;
  draft: string;
  numbers: NumberRef[];
  /** Canonical digit strings the user chose to never flag. */
  ignored: ReadonlySet<string>;
}

function sameKind(t: NumberRef, d: NumberMention): boolean {
  if (t.kind !== d.kind) return false;
  if (t.kind === 'amount') {
    return t.unit === d.unit && t.intDigits.length === d.intDigits.length;
  }
  return t.prefix === d.prefix;
}

/**
 * Number guard (SPEC F2). Compares draft amounts and IDs with the thread's on
 * canonical digit strings of the same kind and length. Amounts fire only on a
 * single transposition (a changed digit is usually a counter-offer); IDs also
 * fire on a single substitution.
 */
export function numberGuard(input: NumberGuardInput): Flag[] {
  if (input.numbers.length === 0) return [];
  const verbatim = new Set(input.numbers.map((n) => `${n.kind}:${n.digits}`));
  const anyDigits = new Set(input.numbers.map((n) => n.digits));
  const flags: Flag[] = [];

  for (const d of extractNumbers(input.draft)) {
    if (anyDigits.has(d.digits) || verbatim.has(`${d.kind}:${d.digits}`)) continue;
    if (input.ignored.has(d.digits)) continue;

    let match: { ref: NumberRef; rule: 'transposition' | 'substitution' } | undefined;
    for (const t of input.numbers) {
      if (!sameKind(t, d)) continue;
      const r = digitRule(t.digits, d.digits);
      if (!r) continue;
      if (t.kind === 'amount' && r.rule !== 'transposition') continue;
      // Prefer a transposition over a substitution when both exist.
      if (!match || (match.rule === 'substitution' && r.rule === 'transposition')) {
        match = { ref: t, rule: r.rule };
      }
    }
    if (!match) continue;
    if (d.kind === 'amount' && inCounterOfferFrame(input.draft, d.start, d.end)) continue;

    const replacement = rewriteDigits(d.text, match.ref.digits);
    flags.push({
      id: shortId(input.threadKey, 'number', d.digits, match.ref.digits),
      guard: 'number',
      draftSpan: { start: d.start, end: d.end },
      found: d.text,
      expected: match.ref.text,
      rule: match.rule,
      message: numberMessage(match.ref, match.rule),
      citation: match.ref,
      fixes: [{ label: `Change to ${replacement}`, replacement }],
    });
  }
  return flags;
}
