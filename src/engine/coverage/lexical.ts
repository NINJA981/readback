import { digitTerms } from '../asks/extract';
import type { ExtractedAsk } from '../asks/extract';
import { splitSentences } from '../text/sentences';
import { fold, stem, words } from '../text/tokens';
import type { AskEvidence, Span } from '../types';

/** Share of an ask's key terms the draft must contain to count as "looks answered". */
export const LEXICAL_THRESHOLD = 0.5;

const ANSWER_CUE_RE =
  /^(?:yes|yep|yeah|yup|no|nope|sure|absolutely|definitely|of course|confirmed|done|will do|sounds good|works for me|happy to|that works|perfect|great|ok|okay|i can|we can|i will|i'll|we'll)\b/i;

interface DraftSentenceTerms extends Span {
  terms: Set<string>;
  cue: boolean;
}

/** Pre-computed draft terms, built once per check and shared by every ask. */
export interface DraftTerms {
  all: Set<string>;
  sentences: DraftSentenceTerms[];
}

export function draftTerms(draft: string): DraftTerms {
  const all = new Set<string>();
  const sentences: DraftSentenceTerms[] = [];
  for (const s of splitSentences(draft)) {
    // Quoted ask lines from "Answer inline" are the thread's words, not evidence.
    if (/^>/.test(s.text)) continue;
    const terms = new Set<string>(digitTerms(s.text));
    for (const w of words(s.text)) terms.add(stem(fold(w.text)));
    for (const t of terms) all.add(t);
    sentences.push({ start: s.start, end: s.end, terms, cue: ANSWER_CUE_RE.test(s.text) });
  }
  return { all, sentences };
}

/**
 * Deterministic coverage evidence (SPEC F7): the draft contains at least half
 * of the ask's key terms, or a sentence opens with a yes/no answer cue and
 * contains at least one key term.
 */
export function lexicalEvidence(ask: ExtractedAsk, draft: DraftTerms): AskEvidence | undefined {
  if (ask.keyTerms.length === 0 || draft.sentences.length === 0) return undefined;
  const hits = ask.keyTerms.filter((t) => draft.all.has(t)).length;
  const score = hits / ask.keyTerms.length;

  let best: DraftSentenceTerms | undefined;
  let bestHits = 0;
  for (const s of draft.sentences) {
    const h = ask.keyTerms.filter((t) => s.terms.has(t)).length;
    if (h > bestHits) {
      bestHits = h;
      best = s;
    }
  }
  if (score >= LEXICAL_THRESHOLD && best) {
    return { kind: 'lexical', draftSpan: { start: best.start, end: best.end }, score };
  }
  const cued = draft.sentences.find((s) => s.cue && ask.keyTerms.some((t) => s.terms.has(t)));
  if (cued) return { kind: 'lexical', draftSpan: { start: cued.start, end: cued.end }, score };
  return undefined;
}
