/**
 * Plain-text message splitting: separates the new content of an incoming
 * message from quoted history, the signature and forwarded content.
 *
 * The Gmail adapter already separates `.gmail_quote` and `.gmail_signature` in
 * the DOM; this module is the fallback for the generic selection adapter, the
 * playground, and for anything the DOM pass missed.
 */

export interface SplitMessage {
  /** New content only. */
  body: string;
  /** Sign-off and signature lines, if any. */
  signature: string;
  /** True when the message carried forwarded content. */
  forwarded: boolean;
}

const QUOTE_HEADER_RE =
  /^\s*(?:On\s[^\n]{4,200}?(?:\n[^\n]{0,120})?\bwrote:|Le\s[^\n]{4,160}\sa\sécrit\s?:|Am\s[^\n]{4,160}\sschrieb[^\n]*:)\s*$/m;
const OUTLOOK_HEADER_RE =
  /^\s*-{2,}\s*Original Message\s*-{2,}\s*$|^\s*From:\s.+\n\s*(?:Sent|Date):\s.+$/im;
const FORWARD_RE =
  /^\s*(?:-{3,}\s*Forwarded message\s*-{3,}|Begin forwarded message:|-{3,}\s*Original Message\s*-{3,}\s*\n\s*From:.*\n(?:.*\n)?\s*Subject:\s*(?:Fwd?|FW):)/im;
const SIG_DELIMITER_RE = /^-- ?$/m;

/** Sign-off phrases (matched case-insensitively at line start). */
const SIGN_OFFS = [
  'thanks so much',
  'thanks again',
  'thanks very much',
  'thanks',
  'thank you so much',
  'thank you',
  'many thanks',
  'thx',
  'ta',
  'cheers',
  'best wishes',
  'best regards',
  'best',
  'all the best',
  'kind regards',
  'warm regards',
  'warmly',
  'regards',
  'sincerely',
  'yours truly',
  'yours sincerely',
  'yours',
  'talk soon',
  'speak soon',
  'take care',
];

const caseless = (phrase: string): string =>
  phrase
    .replace(/\p{L}/gu, (ch) => `[${ch.toUpperCase()}${ch.toLowerCase()}]`)
    .replace(/ /g, '\\s+');

/**
 * A sign-off line, optionally followed by a name on the same line
 * ("Thanks, Kathryn"). The keyword is case-insensitive; the name must be
 * capitalised (no `i` flag, which would make `\p{Lu}` match lower case).
 */
export const SIGN_OFF_RE = new RegExp(
  String.raw`^\s*(?:${SIGN_OFFS.map(caseless).join('|')})(?![\p{L}])[,.!]?(?:\s*[,–—-]?\s*(\p{Lu}[\p{L}'’-]+(?:\s+\p{Lu}[\p{L}'’-]+)?))?\s*[.!]?\s*$`,
  'u',
);

export function splitMessage(raw: string): SplitMessage {
  let text = raw.replace(/\r\n?/g, '\n');
  let forwarded = false;

  const fwd = FORWARD_RE.exec(text);
  if (fwd) {
    forwarded = true;
    text = text.slice(0, fwd.index);
  }

  const quote = QUOTE_HEADER_RE.exec(text);
  if (quote) text = text.slice(0, quote.index);
  const outlook = OUTLOOK_HEADER_RE.exec(text);
  if (outlook) text = text.slice(0, outlook.index);

  // Drop any remaining `>` quoted lines.
  text = text
    .split('\n')
    .filter((line) => !/^\s*>/.test(line))
    .join('\n');

  let signature = '';
  const delimiter = SIG_DELIMITER_RE.exec(text);
  if (delimiter) {
    signature = text.slice(delimiter.index + delimiter[0].length).trim();
    text = text.slice(0, delimiter.index);
  }

  const signOffIndex = findSignOff(text);
  if (signOffIndex !== -1) {
    const tail = text.slice(signOffIndex).trim();
    signature = signature ? `${tail}\n${signature}` : tail;
    text = text.slice(0, signOffIndex);
  }

  return { body: text.replace(/\s+$/, ''), signature, forwarded };
}

/**
 * Index of the sign-off line, searched only in the last 8 non-empty lines so a
 * "Thanks!" in the first paragraph is never mistaken for the signature.
 */
export function findSignOff(text: string): number {
  const lines = text.split('\n');
  const starts: number[] = [];
  let pos = 0;
  for (const line of lines) {
    starts.push(pos);
    pos += line.length + 1;
  }
  let seen = 0;
  for (let i = lines.length - 1; i >= 0 && seen < 8; i--) {
    const line = lines[i] ?? '';
    if (line.trim() === '') continue;
    seen++;
    // The bottom-most short sign-off line wins.
    if (line.length <= 40 && SIGN_OFF_RE.test(line)) return starts[i] ?? -1;
  }
  return -1;
}

/** The name written on or right after the sign-off line, if any. */
export function signOffName(
  signature: string,
): { name: string; line: string; index: number } | undefined {
  const lines = signature.split('\n');
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const m = SIGN_OFF_RE.exec(line);
    if (m) {
      if (m[1]) {
        return { name: m[1], line: line.trim(), index: offset + line.indexOf(m[1]) };
      }
      // Name on the next non-empty line.
      let nextOffset = offset + line.length + 1;
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j] ?? '';
        if (next.trim() === '') {
          nextOffset += next.length + 1;
          continue;
        }
        const nm = /^\s*(\p{Lu}[\p{L}'’-]+(?:\s+\p{Lu}[\p{L}'’.-]*){0,3})\s*$/u.exec(next);
        if (nm?.[1])
          return { name: nm[1], line: next.trim(), index: nextOffset + next.indexOf(nm[1]) };
        return undefined;
      }
      return undefined;
    }
    offset += line.length + 1;
  }
  // No sign-off word: a bare first line that looks like a name ("Kathryn Moss").
  const first = lines[0] ?? '';
  const bare = /^\s*(\p{Lu}[\p{L}'’-]+(?:\s+\p{Lu}[\p{L}'’.-]*){0,3})\s*$/u.exec(first);
  if (bare?.[1]) return { name: bare[1], line: first.trim(), index: first.indexOf(bare[1]) };
  return undefined;
}
