import type { SessionSnapshot } from '../state/session';
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
    slips: snapshot.result.flags.length,
    contextWords,
    failedChecks: [],
  };
}
