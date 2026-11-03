/**
 * Runtime message protocol between the background, content scripts and the
 * popup. Every message crossing a context boundary is
 * validated with `parseMessage` before use: a content script runs next to a
 * hostile page, so nothing is trusted by shape alone.
 */
import { parseTabStatus } from '../storage/tab-status';
import type { TabStatus } from '../storage/tab-status';

/** Longest selection accepted as context (about 10,000 words). */
export const MAX_SELECTION_CHARS = 60_000;

export type ReadbackMessage =
  /** background → tab: Alt+Shift+J */
  | { type: 'next-slip' }
  /** background → tab: Alt+Shift+L */
  | { type: 'open-ledger' }
  /** background → tab: "Use as Readback context" with the selected text */
  | { type: 'use-selection'; text: string }
  /** background → tab: drop the selection context */
  | { type: 'clear-selection' }
  /** popup → tab: slip wording for the status rows (kept out of storage) */
  | { type: 'get-slips' }
  /** content → background: status for the popup (counts only) */
  | { type: 'tab-status'; status: TabStatus };

export type MessageType = ReadbackMessage['type'];

export interface SlipSummary {
  found: string;
  expected: string;
  message: string;
}

/** Replies, keyed by request type. */
export interface MessageReplies {
  'get-slips': { slips: SlipSummary[] };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Validates an incoming message. Returns undefined for anything malformed. */
export function parseMessage(raw: unknown): ReadbackMessage | undefined {
  if (!isRecord(raw) || typeof raw.type !== 'string') return undefined;
  switch (raw.type) {
    case 'next-slip':
    case 'open-ledger':
    case 'clear-selection':
    case 'get-slips':
      return { type: raw.type };
    case 'use-selection': {
      if (typeof raw.text !== 'string') return undefined;
      const text = raw.text.trim();
      if (!text) return undefined;
      return { type: 'use-selection', text: text.slice(0, MAX_SELECTION_CHARS) };
    }
    case 'tab-status': {
      const status = parseTabStatus(raw.status);
      return status ? { type: 'tab-status', status } : undefined;
    }
    default:
      return undefined;
  }
}

/** Validates a get-slips reply (popup side). */
export function parseSlips(raw: unknown): SlipSummary[] {
  if (!isRecord(raw) || !Array.isArray(raw.slips)) return [];
  return raw.slips
    .filter(
      (s): s is SlipSummary =>
        isRecord(s) &&
        typeof s.found === 'string' &&
        typeof s.expected === 'string' &&
        typeof s.message === 'string',
    )
    .slice(0, 50)
    .map((s) => ({
      found: s.found.slice(0, 80),
      expected: s.expected.slice(0, 80),
      message: s.message.slice(0, 200),
    }));
}
