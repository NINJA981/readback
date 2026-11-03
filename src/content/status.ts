import type { MessageReplies } from '../messaging/protocol';
import type { ComposeSession, SessionSnapshot } from '../state/session';
import { isCovered } from '../state/summary';
import type { TabStatus } from '../storage/tab-status';

/**
 * The popup's status for a bound compose: counts and an enum only, never any
 * text from the mail (SPEC §8). Dismissed asks are not counted.
 */
export function statusFrom(
  snapshot: SessionSnapshot,
  state: TabStatus['state'] = 'reading',
  contextWords = 0,
): Omit<TabStatus, 'updatedAt'> {
  const visible = snapshot.result.asks.filter((a) => a.state !== 'dismissed');
  return {
    state,
    asks: visible.length,
    open: visible.filter((a) => !isCovered(a)).length,
    unconfirmed: visible.filter((a) => a.state === 'looks-answered').length,
    slips: snapshot.result.flags.length,
    contextWords,
    failedChecks: [],
  };
}

/**
 * Sends a status to the popup only when it differs from the last one sent.
 * The mail page mutates constantly, so the controllers re-derive their status
 * many times a second; each send is a runtime message and a storage write in
 * the background, so an unchanged status is dropped here.
 */
export function createStatusReporter(
  send: (status: TabStatus) => void,
  now: () => number,
): (status: Omit<TabStatus, 'updatedAt'>) => void {
  let last: string | undefined;
  return (status) => {
    const key = JSON.stringify({ ...status, updatedAt: 0 });
    if (key === last) return;
    last = key;
    try {
      send({ ...status, updatedAt: now() });
    } catch {
      // The popup simply shows a stale status.
    }
  };
}

/** The popup's slip rows for a bound compose (wording only; never stored). */
export function slipsReply(session: ComposeSession | undefined): MessageReplies['get-slips'] {
  const flags = session?.getSnapshot().result.flags ?? [];
  return {
    slips: flags.map((f) => ({ found: f.found, expected: f.expected, message: f.message })),
  };
}
