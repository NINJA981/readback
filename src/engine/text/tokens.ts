import type { Span } from '../types';

export interface Token extends Span {
  text: string;
}

/** Letters with internal apostrophes or hyphens: `O'Brien`, `Anne-Marie`, `José`. */
const WORD_RE = /[\p{L}\p{M}](?:[\p{L}\p{M}]|['’-](?=[\p{L}\p{M}]))*/gu;

export function words(text: string): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(WORD_RE)) {
    out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/** Lower-case, strip diacritics, unify apostrophes. Used for comparisons only. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[’‘]/g, "'")
    .toLowerCase();
}

export function isCapitalised(word: string): boolean {
  const first = word.charAt(0);
  return first !== first.toLowerCase() && first === first.toUpperCase();
}

/** `Kathryn's` → `Kathryn`. Returns the trimmed text and its length. */
export function stripPossessive(word: string): string {
  return word.replace(/['’]s$/u, '');
}

/** The full line (between newlines) containing `index`. */
export function lineAt(text: string, index: number): string {
  const start = text.lastIndexOf('\n', Math.max(0, index - 1)) + 1;
  const endNl = text.indexOf('\n', index);
  return text.slice(start, endNl === -1 ? text.length : endNl).trim();
}

/**
 * A very light English stemmer for lexical overlap: drops common inflections so
 * `confirmed`, `confirms` and `confirming` all meet `confirm`.
 */
export function stem(word: string): string {
  const w = fold(word);
  if (w.length <= 3) return w;
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('ing') && w.length > 5) return dedouble(w.slice(0, -3));
  if (w.endsWith('ed') && w.length > 4) return dedouble(w.slice(0, -2));
  if (w.endsWith('es') && /(?:ss|sh|ch|x|z)es$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
  return w;
}

function dedouble(w: string): string {
  // "dropped" → "dropp" → "drop"; leave "confirm" alone.
  return /([b-df-hj-np-tv-z])\1$/.test(w) && !/(?:ll|ss|ff|zz)$/.test(w) ? w.slice(0, -1) : w;
}
