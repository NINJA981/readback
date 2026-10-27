/**
 * View models derived from a `CheckResult`: the ask pill, the ledger header
 * and the popup's tab status (DESIGN.md §Ask pill, §Ledger, §Popup). Pure, so
 * the extension overlay, the popup and the web playground all render the same
 * words from the same data.
 */
import type { Ask, CheckResult, Flag } from '../engine/types';

export type PillTone = 'hidden' | 'open' | 'covered';

export interface PillModel {
  tone: PillTone;
  /** Asks shown in the pill (dismissed ones excluded). */
  total: number;
  open: number;
  covered: number;
  slips: number;
  /** "3 asks · 1 open", "All covered", or "" when hidden. */
  label: string;
  /** "1 slip", "2 slips", or "" when there are none. */
  slipLabel: string;
  /** Screen-reader sentence for the `aria-live` region. */
  announcement: string;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export const isCovered = (a: Ask): boolean =>
  a.state === 'answered' || a.state === 'looks-answered';

/**
 * The pill. Dismissed asks drop out of the count. Dotted (looks-answered) and
 * solid (answered) both count as covered (SPEC F7).
 */
export function pillModel(result: Pick<CheckResult, 'asks' | 'flags'>): PillModel {
  const visible = result.asks.filter((a) => a.state !== 'dismissed');
  const covered = visible.filter(isCovered).length;
  const open = visible.length - covered;
  const slips = result.flags.length;
  const slipLabel = slips > 0 ? plural(slips, 'slip', 'slips') : '';

  if (visible.length === 0 && slips === 0) {
    return {
      tone: 'hidden',
      total: 0,
      open: 0,
      covered: 0,
      slips: 0,
      label: '',
      slipLabel: '',
      announcement: '',
    };
  }

  let tone: PillTone;
  let label: string;
  if (visible.length === 0) {
    tone = 'open';
    label = '';
  } else if (open === 0) {
    tone = 'covered';
    label = 'All covered';
  } else {
    tone = 'open';
    label = `${plural(visible.length, 'ask', 'asks')} · ${open} open`;
  }

  const parts: string[] = [];
  if (visible.length > 0) {
    parts.push(
      open === 0
        ? `All ${plural(visible.length, 'ask', 'asks')} covered`
        : `${open} of ${plural(visible.length, 'ask', 'asks')} open`,
    );
  }
  if (slips > 0) parts.push(`${slipLabel} to check`);
  return {
    tone,
    total: visible.length,
    open,
    covered,
    slips,
    label,
    slipLabel,
    announcement: `${parts.join(', ')}.`,
  };
}

/** The transient pill text after a fix (DESIGN.md: shown for 6 s). */
export const FIXED_CONFIRMATION_MS = 6000;
export function fixedLabel(replacement: string): string {
  return `Fixed: ${replacement} · Undo Ctrl+Z`;
}

/** Ledger overflow caption: "+2 more not shown". */
export function overflowLabel(truncated: number): string {
  return truncated > 0 ? `+${truncated} more not shown` : '';
}

/** Ledger header once every visible ask is covered, neutral wording (no pronoun). */
export function ledgerHeader(result: Pick<CheckResult, 'asks'>): string {
  const visible = result.asks.filter((a) => a.state !== 'dismissed');
  if (visible.length === 0) return 'No asks in the last message.';
  return visible.every(isCovered) ? 'Everything asked is covered.' : '';
}

/** Popup slip row: `1 slip: "Catherine" → Kathryn`. Lists the first flag only. */
export function slipSummary(flags: readonly Flag[]): string {
  const [first] = flags;
  if (!first) return '';
  const head = `${plural(flags.length, 'slip', 'slips')}: "${first.found}" → ${first.expected}`;
  return flags.length > 1 ? `${head}, and ${flags.length - 1} more` : head;
}
