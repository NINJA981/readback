/**
 * View models for the overlay: what the guard card, ledger and context chip
 * say, derived from engine data. Pure, so the wording is unit tested and the
 * web playground renders the same words. DESIGN.md owns the copy rules: cite
 * the thread, plain and specific, curly quotes, no generic "spelling" label.
 */
import { citationSource } from '../engine/cite';
import type { Ask, AskState, Flag, Fix, Guard } from '../engine/types';
import { isCovered, ledgerConfirmed, ledgerHeader, overflowLabel } from '../state/summary';
import type { SessionSnapshot } from '../state/session';

const CITATION_WINDOW = 44;

export interface CitationParts {
  before: string;
  token: string;
  after: string;
}

/** Splits the cited line around the matched token, windowed so long lines stay short. */
export function citationParts(line: string, token: string): CitationParts {
  const flat = line.replace(/\s+/g, ' ').trim();
  let at = flat.indexOf(token);
  if (at === -1) at = flat.toLowerCase().indexOf(token.toLowerCase());
  if (at === -1) return { before: truncateEnd(flat, CITATION_WINDOW * 2), token: '', after: '' };
  const end = at + token.length;
  const before = flat.slice(0, at);
  const after = flat.slice(end);
  return {
    before: before.length > CITATION_WINDOW ? `…${wordsFromEnd(before)}` : before,
    token: flat.slice(at, end),
    after: after.length > CITATION_WINDOW ? `${wordsFromStart(after)}…` : after,
  };
}

/** The last `CITATION_WINDOW` characters, starting on a word boundary. */
function wordsFromEnd(text: string): string {
  const cut = text.slice(-CITATION_WINDOW);
  const space = cut.indexOf(' ');
  return space === -1 || space > CITATION_WINDOW / 2 ? cut : cut.slice(space + 1);
}

/** The first `CITATION_WINDOW` characters, ending on a word boundary. */
function wordsFromStart(text: string): string {
  const cut = text.slice(0, CITATION_WINDOW);
  const space = cut.lastIndexOf(' ');
  return space < CITATION_WINDOW / 2 ? cut : cut.slice(0, space);
}

function truncateEnd(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export interface CardModel {
  flagId: string;
  guard: Guard;
  found: string;
  expected: string;
  message: string;
  citation: CitationParts;
  /** Where the cited token came from: "From the signature". */
  source: string;
  fixes: Fix[];
  /** Dates cannot be ignored globally, so the menu entry is hidden for them. */
  canNeverFlag: boolean;
  neverFlagLabel: string;
}

export function cardModel(flag: Flag, sentAt?: string): CardModel {
  return {
    flagId: flag.id,
    guard: flag.guard,
    found: flag.found,
    expected: flag.expected,
    message: flag.message,
    citation: citationParts(flag.citation.line, flag.citation.text),
    source: citationSource(flag.citation, sentAt),
    fixes: flag.fixes,
    canNeverFlag: flag.guard !== 'date',
    neverFlagLabel: `Never flag “${flag.found}”`,
  };
}

/** Shown in the card when the host refused the edit (DESIGN.md "fix unavailable"). */
export function fixNotice(kind: 'copied' | 'failed', replacement: string): string {
  return kind === 'copied'
    ? `Couldn’t edit this box. “${replacement}” is copied, so paste it over the word.`
    : `Couldn’t edit this box. Type “${replacement}” over the word.`;
}

const STATE_LABEL: Record<AskState, string> = {
  open: 'Open',
  'looks-answered': 'Looks answered',
  answered: 'Answered',
  dismissed: 'Dismissed',
};

export interface AskRow {
  id: string;
  text: string;
  state: AskState;
  stateLabel: string;
  covered: boolean;
  canConfirm: boolean;
  canAnswerInline: boolean;
}

export interface SlipRow {
  id: string;
  guard: Guard;
  found: string;
  expected: string;
  message: string;
}

export interface LedgerModel {
  header: string;
  /** True when the header is the success line (every ask confirmed), false for the muted nudge. */
  headerOk: boolean;
  asks: AskRow[];
  slips: SlipRow[];
  overflow: string;
  dismissed: number;
  /** True when there is nothing to list at all. */
  empty: boolean;
  emptyHint: string;
}

const askRow = (ask: Ask): AskRow => ({
  id: ask.id,
  text: ask.text,
  state: ask.state,
  stateLabel: STATE_LABEL[ask.state],
  covered: isCovered(ask),
  canConfirm: ask.state !== 'answered',
  canAnswerInline: ask.state === 'open' || ask.state === 'looks-answered',
});

export function ledgerModel(snapshot: Pick<SessionSnapshot, 'result'>): LedgerModel {
  const { result } = snapshot;
  const visible = result.asks.filter((a) => a.state !== 'dismissed');
  return {
    header: ledgerHeader(result),
    headerOk: ledgerConfirmed(result),
    asks: visible.map(askRow),
    slips: result.flags.map((f) => ({
      id: f.id,
      guard: f.guard,
      found: f.found,
      expected: f.expected,
      message: f.message,
    })),
    overflow: overflowLabel(result.truncatedAsks),
    dismissed: result.asks.length - visible.length,
    empty: visible.length === 0 && result.flags.length === 0,
    emptyHint: 'Readback only lists direct questions and requests.',
  };
}

/** The pill's transient text after a fix; exported next to the other copy for the playground. */
export { fixedLabel } from '../state/summary';

export const CONTEXT_ERROR = 'No text selected. Select the message first.';
export const CONTEXT_ERROR_MS = 4000;
