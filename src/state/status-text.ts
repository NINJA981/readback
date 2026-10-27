/**
 * The popup's one-line tab status (SPEC F10, DESIGN.md §Popup). Pure, so the
 * wording is tested and the web app can reuse it.
 */
import { contextChipLabel } from '../adapters/generic/selection';
import type { TabStatus } from '../storage/tab-status';

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export const LAYOUT_NOT_RECOGNISED =
  'Gmail’s layout wasn’t recognised. Select the message and use “Use as Readback context”.';

export type StatusTone = 'neutral' | 'active' | 'problem';

export interface StatusLine {
  text: string;
  tone: StatusTone;
}

/**
 * `status` is what the content script last reported for the tab. It reports on
 * every change, so a missing one means no reply is open: "Not a reply page".
 */
export function statusLine(status: TabStatus | undefined): StatusLine {
  if (!status) {
    return { text: 'Not a reply page', tone: 'neutral' };
  }
  switch (status.state) {
    case 'reading': {
      const asks = status.asks === 0 ? 'no asks' : plural(status.asks, 'ask', 'asks');
      const slips = status.slips === 0 ? 'no slips' : plural(status.slips, 'slip', 'slips');
      return { text: `Reading this reply: ${asks}, ${slips}`, tone: 'active' };
    }
    case 'selection-context':
      return { text: contextChipLabel(status.contextWords), tone: 'active' };
    case 'layout-unrecognised':
      return { text: LAYOUT_NOT_RECOGNISED, tone: 'problem' };
    case 'site-off':
      return { text: 'Readback is off for this site', tone: 'neutral' };
    case 'idle':
      return { text: 'Not a reply page', tone: 'neutral' };
  }
}
