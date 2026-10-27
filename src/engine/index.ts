/**
 * Readback engine: `createContext` once per compose, `check` on every edit.
 * Pure TypeScript. Depends only on chrono-node. No DOM, no I/O, no network.
 */
import { extractAsks } from './asks/extract';
import type { ExtractResult } from './asks/extract';
import { filledInlineSlot } from './coverage/inline';
import { draftTerms, lexicalEvidence } from './coverage/lexical';
import { dateGuard } from './guards/date';
import { nameGuard } from './guards/name';
import { numberGuard } from './guards/number';
import { shortId, sha256Hex } from './hash';
import { extractDates, referenceDate } from './harvest/dates';
import { harvestNames } from './harvest/names';
import { extractNumbers } from './harvest/numbers';
import type { NumberMention } from './harvest/numbers';
import { splitMessage } from './text/strip';
import { fold, stripPossessive, words } from './text/tokens';
import { digitTerms } from './asks/extract';
import type {
  Ask,
  CheckResult,
  DateRef,
  Draft,
  GuardToggles,
  IgnoreList,
  NumberRef,
  Person,
  Source,
  ThreadContext,
  ThreadState,
} from './types';

export const ENGINE_VERSION = '0.1.0';

export interface ContextInput {
  source: Source;
  /** Gmail thread id, the selection text, or a sample id. Hashed, never stored raw. */
  threadId: string;
  /** ISO date (or date-time) the incoming message was sent. */
  sentAt?: string | undefined;
  /** The latest incoming message as text. May still contain quotes or a signature. */
  message: string;
  /** Signature text when the adapter separated it (e.g. `.gmail_signature`). */
  signatureBlock?: string | undefined;
  sender?: Person | undefined;
  recipients?: Person[] | undefined;
}

function toNumberRef(m: NumberMention, source: NumberRef['source']): NumberRef {
  return {
    text: m.text,
    source,
    span: { start: m.start, end: m.end },
    line: m.line,
    kind: m.kind,
    digits: m.digits,
    unit: m.unit,
    prefix: m.prefix,
    intDigits: m.intDigits,
    fracDigits: m.fracDigits,
    label: m.label,
  };
}

/**
 * Builds the thread context: strips quotes, signature and forwarded content,
 * then harvests names, numbers and dates. `today` is the fallback reference
 * date when the sent date is unknown.
 */
export function createContext(input: ContextInput, today: Date = new Date()): ThreadContext {
  const split = splitMessage(input.message);
  const signatureBlock = [input.signatureBlock?.trim(), split.signature]
    .filter((s): s is string => Boolean(s))
    .join('\n');
  const latestMessage = split.body;
  const recipients = input.recipients ?? [];
  const ref = referenceDate(input.sentAt, today);

  const numbers = [
    ...extractNumbers(latestMessage).map((m) => toNumberRef(m, 'body')),
    ...extractNumbers(signatureBlock).map((m) => toNumberRef(m, 'signature')),
  ];
  const dates: DateRef[] = extractDates(latestMessage, ref).map((d) => ({
    text: d.text,
    source: 'body',
    span: { start: d.start, end: d.end },
    line: d.line,
    ...(d.weekday === undefined ? {} : { weekday: d.weekday }),
    day: d.day,
    month: d.month,
    year: d.year,
    monthStated: d.monthStated,
  }));

  return {
    source: input.source,
    threadKey: sha256Hex(`${input.source}\u001f${input.threadId}`),
    ...(input.sentAt ? { sentAt: input.sentAt } : {}),
    latestMessage,
    ...(signatureBlock ? { signatureBlock } : {}),
    ...(input.sender ? { sender: input.sender } : {}),
    recipients,
    forwarded: split.forwarded,
    harvested: {
      names: harvestNames({ latestMessage, signatureBlock, sender: input.sender, recipients }),
      numbers,
      dates,
    },
  };
}

export const ALL_GUARDS: GuardToggles = { name: true, number: true, date: true, asks: true };

export interface CheckOptions {
  guards?: GuardToggles;
  ignore?: IgnoreList;
  threadState?: ThreadState;
  /** Fallback reference date when the context has no sent date. */
  today?: Date;
}

interface Derived {
  asks: ExtractResult;
  threadWords: Set<string>;
}

// Asks and thread words depend only on the context: derive them once per context object.
const derivedCache = new WeakMap<ThreadContext, Derived>();

function derived(ctx: ThreadContext): Derived {
  let cached = derivedCache.get(ctx);
  if (!cached) {
    const people = [ctx.sender?.name ?? '', ...ctx.recipients.map((r) => r.name)].join(' ');
    const threadWords = new Set(
      words(`${ctx.latestMessage}\n${ctx.signatureBlock ?? ''}\n${people}`).map((w) =>
        fold(stripPossessive(w.text)),
      ),
    );
    cached = { asks: extractAsks(ctx.latestMessage), threadWords };
    derivedCache.set(ctx, cached);
  }
  return cached;
}

function now(): number {
  const perf = (globalThis as { performance?: { now(): number } }).performance;
  return perf ? perf.now() : 0;
}

export const normaliseAskText = (text: string): string =>
  fold(text)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** Runs every enabled guard and the ask ledger against the draft. */
export function check(ctx: ThreadContext, draft: Draft, opts: CheckOptions = {}): CheckResult {
  const t0 = now();
  const guards = opts.guards ?? ALL_GUARDS;
  const state = opts.threadState;
  const ignoredNames = new Set((opts.ignore?.names ?? []).map(fold));
  const ignoredNumbers = new Set((opts.ignore?.numbers ?? []).flatMap(digitTerms));
  const ignoredFlags = new Set(state?.ignoredFlags ?? []);
  const text = draft.text;

  const flags = [
    ...(guards.name
      ? nameGuard({
          threadKey: ctx.threadKey,
          draft: text,
          names: ctx.harvested.names,
          threadWords: derived(ctx).threadWords,
          ignored: ignoredNames,
        })
      : []),
    ...(guards.number
      ? numberGuard({
          threadKey: ctx.threadKey,
          draft: text,
          numbers: ctx.harvested.numbers,
          ignored: ignoredNumbers,
        })
      : []),
    ...(guards.date
      ? dateGuard({
          threadKey: ctx.threadKey,
          draft: text,
          ref: referenceDate(ctx.sentAt, opts.today ?? new Date()),
          dates: ctx.harvested.dates,
        })
      : []),
  ]
    .filter((f) => !ignoredFlags.has(f.id))
    .sort((a, b) => a.draftSpan.start - b.draftSpan.start);

  let asks: Ask[] = [];
  let truncatedAsks = 0;
  if (guards.asks) {
    const extracted = derived(ctx).asks;
    truncatedAsks = extracted.truncated;
    const dismissed = new Set(state?.dismissedAsks ?? []);
    const confirmed = new Set(state?.confirmedAsks ?? []);
    const terms = draftTerms(text);
    asks = extracted.asks.map((a): Ask => {
      const id = shortId(ctx.threadKey, normaliseAskText(a.text));
      const base = { id, text: a.text, span: a.span, keyTerms: a.keyTerms };
      if (dismissed.has(id)) return { ...base, state: 'dismissed' };
      if (confirmed.has(id)) return { ...base, state: 'answered', evidence: { kind: 'user' } };
      const slot = filledInlineSlot(text, a.text);
      if (slot)
        return { ...base, state: 'answered', evidence: { kind: 'inline-slot', draftSpan: slot } };
      const evidence = lexicalEvidence(a, terms);
      if (evidence) return { ...base, state: 'looks-answered', evidence };
      return { ...base, state: 'open' };
    });
  }

  return { asks, flags, truncatedAsks, ms: now() - t0 };
}

export type * from './types';
export { citationSource, ordinal, weekdayDay } from './cite';
export { inlineSlotText } from './coverage/inline';
export { applyModelScores, cosine, similarityMatrix, MODEL_THRESHOLD } from './coverage/model';
export type { EmbedFn } from './coverage/model';
export { parseTimestamp } from './harvest/dates';
export { sha256Hex, shortId } from './hash';
export { splitMessage } from './text/strip';
export { fold } from './text/tokens';
