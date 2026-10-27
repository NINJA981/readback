import { parseNumber } from '../harvest/numbers';
import { REQUEST_VERBS, STOP_WORDS } from '../text/lexicon';
import { splitSentences } from '../text/sentences';
import { fold, stem, words } from '../text/tokens';
import type { Span } from '../types';
import { isBoilerplate } from './boilerplate';

export const MAX_ASKS = 5;

export interface ExtractedAsk {
  text: string;
  /** In the message the asks were extracted from. */
  span: Span;
  keyTerms: string[];
}

export interface ExtractResult {
  asks: ExtractedAsk[];
  /** Asks found beyond the cap (shown as "+N more not shown"). */
  truncated: number;
}

/** Direct second-person requests (SPEC F6). */
const REQUEST_RE =
  /\b(?:(?:can|could|would|will|won'?t) you|if you could|would you mind|do you mind|(?:i|we) need you to|(?:i|we)(?:'d| would) (?:appreciate|love) (?:it )?if you|let me know (?:whether|if|when|which|what|how|by|asap|once)|please (?!find\b|see\b|note\b|keep\b|feel\b|don'?t\b|do not\b|ignore\b|disregard\b|enjoy\b|excuse\b|forgive\b)[a-z])/i;

/** Imperatives that need the reply to act: "Send me the signed copy." */
const IMPERATIVE_VERBS = new Set([
  'confirm',
  'send',
  'sign',
  'return',
  'reply',
  'submit',
  'forward',
  'share',
  'upload',
  'pay',
  'review',
  'approve',
  'complete',
  'fill',
  'rsvp',
  'tell',
  'advise',
  'verify',
]);

/** The words that introduce a coordinated list of requested actions. */
const LEAD_RE =
  /^(.*?\b(?:(?:can|could|would|will) you(?: (?:please|also|just))?|if you could(?: (?:please|also))?|would you mind|i need you to|we need you to|please))\s+/i;

// A comma separates only when whitespace follows, so "$1,250" stays whole.
const SEPARATOR_RE =
  /\s*(?:,\s+(?:and\s+|then\s+|or\s+)?|;\s*(?:and\s+)?|\s+and\s+(?:then\s+)?|\s+then\s+)/gi;

const QUESTION_END_RE = /\?["”'’)\]]*\s*(?:\p{Extended_Pictographic}\s*)*$/u;

function firstVerb(segment: string): string {
  const w = words(segment)
    .map((t) => fold(t.text))
    .filter((t) => t !== 'also' && t !== 'please' && t !== 'just' && t !== 'then');
  return w[0] ?? '';
}

function isRequestVerb(word: string): boolean {
  return REQUEST_VERBS.has(word) || REQUEST_VERBS.has(stem(word));
}

/**
 * Splits "can you confirm X, drop off Y, and send Z?" into one span per
 * action, but only when every segment starts with a request verb; otherwise
 * the sentence stays one ask.
 */
export function splitCoordinated(text: string, offset: number): ExtractedAsk[] | undefined {
  const lead = LEAD_RE.exec(text);
  if (!lead) return undefined;
  const bodyStart = lead[0].length;
  const body = text.slice(bodyStart);
  const segments: Span[] = [];
  let cursor = 0;
  for (const m of body.matchAll(SEPARATOR_RE)) {
    segments.push({ start: cursor, end: m.index });
    cursor = m.index + m[0].length;
  }
  segments.push({ start: cursor, end: body.length });
  if (segments.length < 2) return undefined;

  const asks: ExtractedAsk[] = [];
  for (const seg of segments) {
    let s = seg.start;
    let e = seg.end;
    const raw = body.slice(s, e);
    // Trim whitespace and trailing punctuation.
    s += raw.length - raw.trimStart().length;
    while (e > s && /[\s?.!,;:"”'’)]/.test(body.charAt(e - 1))) e--;
    const segText = body.slice(s, e);
    if (!segText || !isRequestVerb(firstVerb(segText))) return undefined;
    asks.push({
      text: segText,
      span: { start: offset + bodyStart + s, end: offset + bodyStart + e },
      keyTerms: keyTerms(segText),
    });
  }
  return asks;
}

const DIGITS_RE = /\d(?:[\d,.]*\d)?/g;

/** Digit strings in a text, canonicalised like the number guard ("$1,250.00" → "1250"). */
export function digitTerms(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(DIGITS_RE)) {
    const { intDigits, fracDigits } = parseNumber(m[0]);
    out.push(/^0*$/.test(fracDigits) ? intDigits : intDigits + fracDigits);
  }
  return out;
}

/** Key terms of an ask: amounts, IDs and day numbers, names, and content-word stems. */
export function keyTerms(text: string): string[] {
  const terms = new Set<string>(digitTerms(text));
  for (const w of words(text)) {
    const f = fold(w.text);
    if (f.length < 3 || STOP_WORDS.has(f) || REQUEST_VERBS.has(f)) continue;
    // "th"/"st" fragments of ordinals never reach here (length < 3).
    terms.add(stem(f));
  }
  return [...terms];
}

function isBulletAt(message: string, start: number): boolean {
  const lineStart = message.lastIndexOf('\n', start - 1) + 1;
  return /^\s*(?:[-*•–]|\d{1,2}[.)])\s+/.test(message.slice(lineStart, start + 1));
}

/**
 * Conservative ask extractor (SPEC F6). Reads only the new content of the
 * latest incoming message. An ask is a sentence ending in `?` or a direct
 * second-person request; boilerplate is dropped; coordinated requests split;
 * the list is capped at five.
 */
export function extractAsks(message: string, max = MAX_ASKS): ExtractResult {
  const found: ExtractedAsk[] = [];
  let leadIn = false;

  for (const s of splitSentences(message)) {
    const bullet = isBulletAt(message, s.start);
    if (!bullet) leadIn = false;
    const folded = fold(s.text);
    if (isBoilerplate(folded)) continue;

    const question = QUESTION_END_RE.test(s.text);
    const request = REQUEST_RE.test(s.text);
    const imperative = IMPERATIVE_VERBS.has(firstVerb(s.text)) && !question;

    if (/:\s*$/.test(s.text) && (request || question)) {
      // "Could you:" followed by a bulleted list: the bullets are the asks.
      leadIn = true;
      continue;
    }
    if (!(question || request || imperative || (leadIn && bullet))) continue;

    const split = splitCoordinated(s.text, s.start);
    if (split) {
      found.push(...split);
      continue;
    }
    found.push({ text: s.text, span: { start: s.start, end: s.end }, keyTerms: keyTerms(s.text) });
  }

  return { asks: found.slice(0, max), truncated: Math.max(0, found.length - max) };
}
