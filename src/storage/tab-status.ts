/**
 * Per-tab status the popup reads on open (DESIGN.md §Popup). Counts and an
 * enum only: no names, numbers or any other text from the mail. The popup asks
 * the tab directly when it needs the slip wording.
 */
export type TabState =
  | 'reading' // a reply compose is open and the adapter recognised the layout
  | 'idle' // a supported page with no reply open
  | 'layout-unrecognised' // the adapter self-test failed; Readback stays silent
  | 'site-off' // the user turned Readback off for this site
  | 'selection-context'; // the generic adapter holds a selection context

export const TAB_STATES: readonly TabState[] = [
  'reading',
  'idle',
  'layout-unrecognised',
  'site-off',
  'selection-context',
];

export interface TabStatus {
  state: TabState;
  asks: number;
  open: number;
  slips: number;
  /** Words in the selection context (generic adapter), for the context chip. */
  contextWords: number;
  /** Failed self-test check names (selector ids only, never page text). */
  failedChecks: string[];
  updatedAt: number;
}

const count = (v: unknown): number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 1_000_000 ? v : 0;

const CHECK_ID_RE = /^[a-z][a-z0-9-]{0,40}$/;

/** Reads a tab status from untrusted data; undefined when unusable. */
export function parseTabStatus(raw: unknown): TabStatus | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  const state = TAB_STATES.find((s) => s === r.state);
  if (!state) return undefined;
  const failed = Array.isArray(r.failedChecks)
    ? r.failedChecks.filter((c): c is string => typeof c === 'string' && CHECK_ID_RE.test(c))
    : [];
  return {
    state,
    asks: count(r.asks),
    open: count(r.open),
    slips: count(r.slips),
    contextWords: count(r.contextWords),
    failedChecks: failed.slice(0, 20),
    updatedAt: typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? r.updatedAt : 0,
  };
}

/** The popup shows a skeleton when the cached status is older than this. */
export const STALE_STATUS_MS = 2000;

export const isStale = (status: TabStatus, now: number): boolean =>
  now - status.updatedAt > STALE_STATUS_MS;
