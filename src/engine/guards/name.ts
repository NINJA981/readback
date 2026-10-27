import { shortId } from '../hash';
import { nameMessage } from '../cite';
import { NAME_SOURCE_RANK, isNameLike } from '../harvest/names';
import { fold, stripPossessive, words } from '../text/tokens';
import type { Flag, NameRef } from '../types';
import { osaDistance } from './distance';
import { isVariantPair } from './variants';

/** First letters that sound alike at the start of a name (Catherine/Kathryn, Geoff/Jeff). */
const PHONETIC_FIRST: readonly (readonly string[])[] = [
  ['c', 'k'],
  ['g', 'j'],
  ['f', 'p'],
  ['i', 'y'],
];

function firstLetterOk(a: string, b: string): boolean {
  const x = a.charAt(0);
  const y = b.charAt(0);
  if (x === y) return true;
  return PHONETIC_FIRST.some((pair) => pair.includes(x) && pair.includes(y));
}

interface Candidate {
  target: NameRef;
  rule: 'edit-distance' | 'variant';
  distance: number;
}

export interface NameGuardInput {
  threadKey: string;
  draft: string;
  names: NameRef[];
  /**
   * Every folded word in the thread (message, signature, names). A draft token
   * that appears anywhere in the thread is never flagged: "both spellings
   * appear in the thread" (SPEC F1).
   */
  threadWords: ReadonlySet<string>;
  /** Folded words the user chose to never flag. */
  ignored: ReadonlySet<string>;
}

/**
 * Name guard (SPEC F1). A capitalised draft token fires only when it is not a
 * thread name itself and is a near-miss of one: edit distance 1 (names ≤ 5
 * letters) or ≤ 2 (≥ 6 letters) with a compatible first letter, or a pair in
 * the variant table. Body-only names are weaker evidence, so they fire only
 * through the variant table or for names of 6+ letters.
 */
export function nameGuard(input: NameGuardInput): Flag[] {
  if (input.names.length === 0) return [];

  const known = new Set(input.names.map((n) => fold(n.text)));
  // Strongest reference per folded name.
  const targets = new Map<string, NameRef>();
  for (const n of input.names) {
    const key = fold(n.text);
    const prev = targets.get(key);
    if (!prev || NAME_SOURCE_RANK[n.source] < NAME_SOURCE_RANK[prev.source]) targets.set(key, n);
  }

  const flags: Flag[] = [];
  for (const w of words(input.draft)) {
    const text = stripPossessive(w.text);
    if (!isNameLike(text)) continue;
    const token = fold(text);
    if (known.has(token) || input.threadWords.has(token) || input.ignored.has(token)) continue;

    let best: Candidate | undefined;
    for (const [key, target] of targets) {
      const len = Array.from(key).length;
      const max = len <= 5 ? 1 : 2;
      const strong = target.source !== 'body';
      let candidate: Candidate | undefined;
      if (firstLetterOk(token, key) && (strong || len >= 6)) {
        const d = osaDistance(token, key, max);
        if (d >= 1 && d <= max) candidate = { target, rule: 'edit-distance', distance: d };
      }
      if (!candidate && isVariantPair(token, key)) {
        candidate = { target, rule: 'variant', distance: 3 };
      }
      if (!candidate) continue;
      if (
        !best ||
        candidate.distance < best.distance ||
        (candidate.distance === best.distance &&
          NAME_SOURCE_RANK[candidate.target.source] < NAME_SOURCE_RANK[best.target.source])
      ) {
        best = candidate;
      }
    }
    if (!best) continue;

    const expected = best.target.text;
    flags.push({
      id: shortId(input.threadKey, 'name', token, fold(best.target.text)),
      guard: 'name',
      draftSpan: { start: w.start, end: w.start + text.length },
      found: text,
      expected,
      rule: best.rule,
      message: nameMessage(best.target),
      citation: best.target,
      fixes: [{ label: `Change to ${expected}`, replacement: expected }],
    });
  }
  return flags;
}
