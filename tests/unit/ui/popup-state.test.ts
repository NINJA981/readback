import { describe, expect, it } from 'vitest';
import { diagnostics, hostOf, isMailUrl, popupScreen } from '../../../src/state/popup-state';
import type { TabStatus } from '../../../src/storage/tab-status';

const status = (patch: Partial<TabStatus>): TabStatus => ({
  state: 'reading',
  asks: 3,
  open: 1,
  slips: 1,
  contextWords: 0,
  failedChecks: [],
  updatedAt: 0,
  ...patch,
});

const GMAIL = 'https://mail.google.com/mail/u/0/#inbox';

describe('popup screen choice', () => {
  it('maps each tab state to its screen', () => {
    expect(popupScreen(status({}), true, GMAIL)).toBe('reading');
    expect(popupScreen(status({ state: 'selection-context' }), true, 'https://example.com/')).toBe(
      'selection',
    );
    expect(popupScreen(status({ state: 'layout-unrecognised' }), true, GMAIL)).toBe('layout-error');
    expect(popupScreen(status({ state: 'site-off' }), true, GMAIL)).toBe('off');
  });

  it('a site switched off wins over whatever the tab last reported', () => {
    expect(popupScreen(status({}), false, GMAIL)).toBe('off');
  });

  it('no report means a plain page, or a mail page with no reply open', () => {
    expect(popupScreen(undefined, true, 'https://example.com/')).toBe('idle');
    expect(popupScreen(undefined, true, GMAIL)).toBe('idle-mail');
    expect(popupScreen(status({ state: 'idle' }), true, GMAIL)).toBe('idle-mail');
    expect(popupScreen(undefined, true, undefined)).toBe('idle');
  });

  it('knows mail hosts and only reports web hosts', () => {
    expect(isMailUrl(GMAIL)).toBe(true);
    expect(isMailUrl('https://example.com')).toBe(false);
    expect(isMailUrl('not a url')).toBe(false);
    expect(hostOf(GMAIL)).toBe('mail.google.com');
    expect(hostOf('chrome://extensions')).toBeUndefined();
    expect(hostOf('chrome-extension://abc/popup.html')).toBeUndefined();
  });
});

describe('diagnostics text', () => {
  it('contains self-test ids and the state, and says it holds no mail text', () => {
    const text = diagnostics(
      status({ state: 'layout-unrecognised', failedChecks: ['thread', 'editor'] }),
      '0.1.0',
    );
    expect(text).toContain('Readback 0.1.0');
    expect(text).toContain('state: layout-unrecognised');
    expect(text).toContain('failed checks: thread, editor');
    expect(text).toContain('No mail text is included.');
  });

  it('handles a tab that never reported', () => {
    expect(diagnostics(undefined, '0.1.0')).toContain('state: no report');
  });
});
