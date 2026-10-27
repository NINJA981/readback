/**
 * Which popup screen to show (DESIGN.md §Popup). Pure, so the choice is unit
 * tested and the popup view stays a function of its props.
 */
import type { TabStatus } from '../storage/tab-status';

export type PopupScreen =
  /** A reply is open and the adapter recognised the layout. */
  | 'reading'
  /** The generic adapter holds a selection context. */
  | 'selection'
  /** The adapter self-test failed; Readback is staying out of the way. */
  | 'layout-error'
  /** The user switched Readback off for this site. */
  | 'off'
  /** A mail page with no reply open. */
  | 'idle-mail'
  /** Any other page. */
  | 'idle';

const MAIL_HOSTS = new Set(['mail.google.com']);

export function isMailUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return MAIL_HOSTS.has(new URL(url).host);
  } catch {
    return false;
  }
}

export function hostOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const { protocol, host } = new URL(url);
    return protocol === 'http:' || protocol === 'https:' ? host : undefined;
  } catch {
    return undefined;
  }
}

export function popupScreen(
  status: TabStatus | undefined,
  siteOn: boolean,
  url: string | undefined,
): PopupScreen {
  if (!siteOn) return 'off';
  switch (status?.state) {
    case 'reading':
      return 'reading';
    case 'selection-context':
      return 'selection';
    case 'layout-unrecognised':
      return 'layout-error';
    case 'site-off':
      return 'off';
    case 'idle':
    case undefined:
      return isMailUrl(url) ? 'idle-mail' : 'idle';
  }
}

/** Selector self-test ids only, never any text from the page (SPEC F10). */
export function diagnostics(status: TabStatus | undefined, version: string): string {
  const failed = status?.failedChecks.length ? status.failedChecks.join(', ') : 'none';
  return [
    `Readback ${version}`,
    `state: ${status?.state ?? 'no report'}`,
    `failed checks: ${failed}`,
    'No mail text is included.',
  ].join('\n');
}
