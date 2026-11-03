import { fold } from '../text/tokens';
import type { Span } from '../types';

/**
 * "Answer inline" (SPEC F7): the ledger inserts `> ask` and an empty line at
 * the caret. The text to insert is defined here so the detector and the
 * inserter can never drift apart.
 */
export function inlineSlotText(askText: string): string {
  return `> ${askText.replace(/\s+/g, ' ').trim()}\n\n`;
}

const norm = (s: string): string =>
  fold(s)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/**
 * Finds a filled inline slot for an ask: a `> ask` line followed by at least
 * one non-empty, non-quoted line. Returns the span of the answer line.
 */
export function filledInlineSlot(draft: string, askText: string): Span | undefined {
  const target = norm(askText);
  if (!target) return undefined;
  const lines = draft.split('\n');
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (/^\s*>/.test(line) && norm(line.replace(/^\s*>\s?/, '')) === target) {
      let o = offset + line.length + 1;
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j] ?? '';
        if (/^\s*>/.test(next)) break;
        if (next.trim()) return { start: o, end: o + next.length };
        o += next.length + 1;
      }
    }
    offset += line.length + 1;
  }
  return undefined;
}
