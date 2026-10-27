import { COMMON_WORDS } from '../text/lexicon';
import { signOffName } from '../text/strip';
import { fold, isCapitalised, lineAt, stripPossessive, words } from '../text/tokens';
import type { NameRef, NameSource, Person } from '../types';

export interface NameHarvestInput {
  latestMessage: string;
  signatureBlock?: string | undefined;
  sender?: Person | undefined;
  recipients: Person[];
}

/** Source strength: lower is stronger. Used to pick the citation for a name. */
export const NAME_SOURCE_RANK: Record<NameSource, number> = {
  signature: 0,
  from: 1,
  to: 2,
  cc: 3,
  greeting: 4,
  body: 5,
};

const GREETING_RE =
  /^\s*(?:hi|hello|hey|dear|morning|good (?:morning|afternoon|evening)|hiya|greetings)\b[\s,]+(\p{Lu}[\p{L}'’-]+(?:\s+(?:and|&)\s+\p{Lu}[\p{L}'’-]+)?)/iu;

/** True for a token that can be a name: capitalised, ≥ 2 letters, not a common word, not ALL CAPS. */
export function isNameLike(token: string, minLength = 3): boolean {
  if (Array.from(token).length < minLength) return false;
  if (!isCapitalised(token)) return false;
  if (token.length > 1 && token === token.toUpperCase()) return false;
  return !COMMON_WORDS.has(fold(token));
}

function personNames(person: Person, source: NameSource): NameRef[] {
  // "Moss, Kathryn" → "Kathryn Moss"
  const display = /^([^,]+),\s*([^,]+)$/.exec(person.name)
    ? person.name.replace(/^([^,]+),\s*([^,]+)$/, '$2 $1')
    : person.name;
  const label = source === 'from' ? 'From' : source === 'to' ? 'To' : 'Cc';
  return words(display)
    .filter((w) => isNameLike(w.text, 2))
    .map((w) => ({
      text: w.text,
      source,
      span: { start: w.start, end: w.end },
      line: `${label}: ${display}`,
    }));
}

/**
 * Harvests names the thread gives you (SPEC F1): signature, sender, To/Cc
 * chips, the greeting of the incoming message, and capitalised non-initial
 * tokens in the body. Spans are relative to the field the source names:
 * signature → signatureBlock; from/to/cc → the person's display name;
 * greeting/body → latestMessage.
 */
export function harvestNames(input: NameHarvestInput): NameRef[] {
  const out: NameRef[] = [];

  if (input.signatureBlock) {
    const sig = signOffName(input.signatureBlock);
    if (sig) {
      for (const w of words(sig.name)) {
        if (!isNameLike(w.text, 2)) continue;
        out.push({
          text: w.text,
          source: 'signature',
          span: { start: sig.index + w.start, end: sig.index + w.end },
          line: sig.line,
        });
      }
    }
  }

  if (input.sender) out.push(...personNames(input.sender, 'from'));
  for (const r of input.recipients) out.push(...personNames(r, r.role === 'cc' ? 'cc' : 'to'));

  const msg = input.latestMessage;
  const greeting = GREETING_RE.exec(msg);
  let greetingEnd = 0;
  if (greeting?.[1]) {
    const offset = greeting.index + greeting[0].length - greeting[1].length;
    greetingEnd = greeting.index + greeting[0].length;
    for (const w of words(greeting[1])) {
      if (!isNameLike(w.text, 2)) continue;
      out.push({
        text: w.text,
        source: 'greeting',
        span: { start: offset + w.start, end: offset + w.end },
        line: lineAt(msg, offset),
      });
    }
  }

  // Body: capitalised tokens that do not start a sentence.
  for (const w of words(msg)) {
    if (w.start < greetingEnd) continue;
    const text = stripPossessive(w.text);
    if (!isNameLike(text)) continue;
    if (startsSentence(msg, w.start)) continue;
    out.push({
      text,
      source: 'body',
      span: { start: w.start, end: w.start + text.length },
      line: lineAt(msg, w.start),
    });
  }
  return out;
}

/** True when the token at `index` is the first word of a sentence or line. */
export function startsSentence(text: string, index: number): boolean {
  let i = index - 1;
  while (i >= 0 && /[ \t"“'‘(]/.test(text.charAt(i))) i--;
  if (i < 0) return true;
  return /[.?!\n:;…]/.test(text.charAt(i));
}
