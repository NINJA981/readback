/**
 * Readback data model (SPEC §7). Pure data: no DOM references, nothing that
 * cannot be structured-cloned across extension messaging.
 */

export type Source = 'gmail' | 'selection' | 'playground';

/** UTF-16 offsets, end exclusive. */
export interface Span {
  start: number;
  end: number;
}

export type PersonRole = 'sender' | 'to' | 'cc';

export interface Person {
  /** Display name only. */
  name: string;
  /** Local part of the email address (before the @), never the full address. */
  emailLocal?: string;
  role: PersonRole;
}

export type NameSource = 'signature' | 'from' | 'to' | 'cc' | 'greeting' | 'body';

/**
 * A token harvested from the thread, with the line it came from so the guard
 * card can cite it. `span` is relative to the text named by `field`.
 */
export interface TokenRef {
  text: string;
  source: string;
  span: Span;
  /** The cited snippet: the full line the token was found on. */
  line: string;
}

export interface NameRef extends TokenRef {
  source: NameSource;
}

export type NumberKind = 'amount' | 'id';

export interface NumberRef extends TokenRef {
  source: 'body' | 'signature';
  kind: NumberKind;
  /** Canonical digit string used for comparison (integer digits + non-zero fraction). */
  digits: string;
  /** Normalised currency code or unit word, e.g. "USD", "EUR", "nights". Empty for IDs. */
  unit: string;
  /** Letter prefix for alphanumeric IDs (`INV` in `INV-20931`), upper-cased. */
  prefix: string;
  /** Integer digits as written. Amounts only compare when these lengths match. */
  intDigits: string;
  /** Fraction digits as written ("" when none). */
  fracDigits: string;
  /** Lower-case keyword written before an ID ("order", "invoice"); "" when none. */
  label: string;
}

export interface DateRef extends TokenRef {
  source: 'body' | 'signature';
  /** Weekday as written, 0 = Sunday. Undefined when no weekday was written. */
  weekday?: number;
  /** Day of month as written. */
  day: number;
  /** 1-12; written or inferred from the reference date. */
  month: number;
  year: number;
  monthStated: boolean;
}

export interface Harvest {
  names: NameRef[];
  numbers: NumberRef[];
  dates: DateRef[];
}

export interface ThreadContext {
  source: Source;
  /** SHA-256 (hex) of source + thread id or selection text. Never the raw id. */
  threadKey: string;
  /** ISO date of the latest incoming message; the date guard's reference date. */
  sentAt?: string;
  /** Quotes, signature and forwarded content stripped. */
  latestMessage: string;
  signatureBlock?: string;
  sender?: Person;
  recipients: Person[];
  /** True when the incoming message was a forward (asks are taken from the note only). */
  forwarded: boolean;
  harvested: Harvest;
}

/** Flattened editor text. The adapter maps offsets back to DOM positions. */
export interface Draft {
  text: string;
  version: number;
}

export type AskState = 'open' | 'looks-answered' | 'answered' | 'dismissed';

export interface AskEvidence {
  kind: 'lexical' | 'model' | 'inline-slot' | 'user';
  draftSpan?: Span;
  score?: number;
}

export interface Ask {
  /** hash(threadKey + normalised ask text) */
  id: string;
  text: string;
  /** In latestMessage. */
  span: Span;
  keyTerms: string[];
  state: AskState;
  evidence?: AskEvidence;
}

export type Guard = 'name' | 'number' | 'date';

export type FlagRule =
  | 'variant'
  | 'edit-distance'
  | 'transposition'
  | 'substitution'
  | 'weekday-mismatch'
  | 'thread-near-miss';

export interface Fix {
  label: string;
  replacement: string;
}

export interface Flag {
  /** hash(threadKey + guard + draft token + cited token) */
  id: string;
  guard: Guard;
  draftSpan: Span;
  found: string;
  /** The thread value (or the calendar-correct value for weekday mismatches). */
  expected: string;
  rule: FlagRule;
  /** One line in the reader's terms, e.g. "Signs as Kathryn". */
  message: string;
  citation: TokenRef;
  /** One or two fixes; the first is primary. */
  fixes: Fix[];
}

export interface CheckResult {
  asks: Ask[];
  flags: Flag[];
  truncatedAsks: number;
  ms: number;
}

export interface GuardToggles {
  name: boolean;
  number: boolean;
  date: boolean;
  asks: boolean;
}

export interface Settings {
  enabled: boolean;
  /** Origins where Readback is switched off. */
  disabledSites: string[];
  guards: GuardToggles;
  model: { enabled: boolean; threshold: number };
  theme: 'system' | 'light' | 'dark';
}

/** Global "never flag X": only words the user chose. */
export interface IgnoreList {
  names: string[];
  numbers: string[];
}

/** Per-thread state, kept in session storage under `t:<threadKey>`. Hashed ids only. */
export interface ThreadState {
  dismissedAsks: string[];
  confirmedAsks: string[];
  ignoredFlags: string[];
  updatedAt: number;
}
