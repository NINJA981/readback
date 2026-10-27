/**
 * The global "Never flag X" list (SPEC §7 `IgnoreList`). It holds only words
 * the user chose, never message text. Names compare folded (case and accents
 * ignored); numbers compare on their digits, the same way the guard does.
 */
import { digitTerms } from '../engine/asks/extract';
import { fold } from '../engine/text/tokens';
import type { IgnoreList } from '../engine/types';

/** Upper bound so a runaway script cannot grow storage without limit. */
export const MAX_IGNORED = 500;
/** Longest single entry accepted (a name or a number as written). */
export const MAX_ENTRY_LENGTH = 64;

export const EMPTY_IGNORE: Readonly<IgnoreList> = Object.freeze({ names: [], numbers: [] });

export type IgnoreKind = keyof IgnoreList;

const clean = (s: string): string => s.replace(/\s+/g, ' ').trim();

function keyOf(kind: IgnoreKind, entry: string): string {
  return kind === 'names' ? fold(entry) : digitTerms(entry).join(' ');
}

function validEntry(kind: IgnoreKind, entry: string): boolean {
  if (!entry || entry.length > MAX_ENTRY_LENGTH) return false;
  return kind === 'names' ? /\p{L}/u.test(entry) : /\d/.test(entry);
}

function parseList(kind: IgnoreKind, v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of v) {
    if (typeof raw !== 'string') continue;
    const entry = clean(raw);
    if (!validEntry(kind, entry)) continue;
    const key = keyOf(kind, entry);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
    if (out.length >= MAX_IGNORED) break;
  }
  return out;
}

/** Reads the ignore list from untrusted storage data. Never throws. */
export function parseIgnoreList(raw: unknown): IgnoreList {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  return { names: parseList('names', r.names), numbers: parseList('numbers', r.numbers) };
}

export function isIgnored(list: IgnoreList, kind: IgnoreKind, entry: string): boolean {
  const key = keyOf(kind, clean(entry));
  return list[kind].some((e) => keyOf(kind, e) === key);
}

/** Adds an entry, keeping the user's spelling. No-op for duplicates or invalid input. */
export function addIgnored(list: IgnoreList, kind: IgnoreKind, entry: string): IgnoreList {
  const value = clean(entry);
  if (!validEntry(kind, value) || isIgnored(list, kind, value)) return list;
  if (list[kind].length >= MAX_IGNORED) return list;
  return { ...list, [kind]: [...list[kind], value] };
}

export function removeIgnored(list: IgnoreList, kind: IgnoreKind, entry: string): IgnoreList {
  const key = keyOf(kind, clean(entry));
  const next = list[kind].filter((e) => keyOf(kind, e) !== key);
  return next.length === list[kind].length ? list : { ...list, [kind]: next };
}
