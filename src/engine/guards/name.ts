import { shortId } from '../hash';
import { nameMessage } from '../cite';
import { NAME_SOURCE_RANK, isNameLike, startsSentence } from '../harvest/names';
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

interface PreparedTarget {
  key: string;
  len: number;
  target: NameRef;
}

interface Prepared {
  known: ReadonlySet<string>;
  targets: readonly PreparedTarget[];
  /** token -> best near-miss (null when none). Pure in (token, names), so it is safe to keep. */
  best: Map<string, Candidate | null>;
}

const BEST_CACHE_MAX = 4000;

/**
 * Everything derived from the thread's names, computed once per names array (the
 * context's harvested list is stable across checks). Without this, every
 * keystroke re-ran an edit distance for each draft word against each name.
 */
const prepared = new WeakMap<readonly NameRef[], Prepared>();

function prepare(names: readonly NameRef[]): Prepared {
  const hit = prepared.get(names);
  if (hit) return hit;
  const known = new Set(names.map((n) => fold(n.text)));
  // Strongest reference per folded name.
  const strongest = new Map<string, NameRef>();
  for (const n of names) {
    const key = fold(n.text);
    const prev = strongest.get(key);
    if (!prev || NAME_SOURCE_RANK[n.source] < NAME_SOURCE_RANK[prev.source]) strongest.set(key, n);
  }
  const targets = [...strongest].map(([key, target]) => ({
    key,
    len: Array.from(key).length,
    target,
  }));
  const made: Prepared = { known, targets, best: new Map() };
  prepared.set(names, made);
  return made;
}

function bestFor(token: string, targets: readonly PreparedTarget[]): Candidate | null {
  let best: Candidate | undefined;
  for (const { key, len, target } of targets) {
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
  return best ?? null;
}

/** Names that are also everyday words, so they prove nothing at the start of a sentence. */
const NAME_WORDS: ReadonlySet<string> = new Set(
  'mark bill pat sue rob art jack frank grant rose penny chase drew gene guy ray sandy summer hope faith joy'.split(
    ' ',
  ),
);

/**
 * True when a token reads as a name being addressed or signed: the rest of its
 * line is empty or starts with a comma, a colon, an exclamation mark or a dash
 * ("Kathyrn, thanks", "Kathyrn!", a sign-off line).
 */
function inAddressPosition(text: string, end: number): boolean {
  const lineEnd = text.indexOf('\n', end);
  const rest = text.slice(end, lineEnd === -1 ? undefined : lineEnd);
  return /^\s*(?:$|[,:!\u2013\u2014-])/.test(rest);
}

/**
 * Name guard (SPEC F1). A capitalised draft token fires only when it is not a
 * thread name itself and is a near-miss of one: edit distance 1 (names ≤ 5
 * letters) or ≤ 2 (≥ 6 letters) with a compatible first letter, or a pair in
 * the variant table. Body-only names are weaker evidence, so they fire only
 * through the variant table or for names of 6+ letters.
 *
 * A capital at the start of a sentence or line is not evidence of a name
 * ("Part two" next to a thread from Pat), so a sentence-initial edit-distance
 * match, or a variant that is also an everyday word (Mark), fires only in
 * address position ("Kathyrn, thanks", a line of its own) or as a possessive.
 */
export function nameGuard(input: NameGuardInput): Flag[] {
  if (input.names.length === 0) return [];

  const { known, targets, best: cache } = prepare(input.names);

  const flags: Flag[] = [];
  for (const w of words(input.draft)) {
    const text = stripPossessive(w.text);
    if (!isNameLike(text)) continue;
    const token = fold(text);
    if (known.has(token) || input.threadWords.has(token) || input.ignored.has(token)) continue;

    let best = cache.get(token);
    if (best === undefined) {
      best = bestFor(token, targets);
      if (cache.size >= BEST_CACHE_MAX) cache.clear();
      cache.set(token, best);
    }
    if (!best) continue;
    const end = w.start + text.length;
    // At the start of a sentence a capital proves nothing, so only a known variant
    // ("John will be there" to Jon) fires there, unless the token is also an everyday
    // word ("Mark the date" to Marc). Address position and possessives always count.
    if (
      startsSentence(input.draft, w.start) &&
      (NAME_WORDS.has(token) || !isVariantPair(token, fold(best.target.text))) &&
      text === w.text &&
      !inAddressPosition(input.draft, end)
    ) {
      continue;
    }

    const expected = best.target.text;
    flags.push({
      id: shortId(input.threadKey, 'name', token, fold(best.target.text)),
      guard: 'name',
      draftSpan: { start: w.start, end },
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
