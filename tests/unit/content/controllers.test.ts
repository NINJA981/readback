// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findComposeEditors } from '../../../src/adapters/gmail/compose';
import { startGmailController } from '../../../src/content/gmail-controller';
import type { GmailController } from '../../../src/content/gmail-controller';
import { createSelectionController } from '../../../src/content/selection-controller';
import type { SelectionController } from '../../../src/content/selection-controller';
import { statusFrom } from '../../../src/content/status';
import { createHighlightPainter } from '../../../src/dom/highlights';
import { createComposeSession } from '../../../src/state/session';
import { DEFAULT_SETTINGS, setGuard, setSiteEnabled } from '../../../src/state/settings';
import { statusLine } from '../../../src/state/status-text';
import { createMemoryArea } from '../../../src/storage/area';
import { createReadbackStorage } from '../../../src/storage/repository';
import type { TabStatus } from '../../../src/storage/tab-status';
import { createContext } from '../../../src/engine/index';
import { DEPOSIT_INPUT, DEPOSIT_MESSAGE } from '../../fixtures/samples';

const GMAIL = join(import.meta.dirname, '..', '..', 'fixtures', 'gmail');

function load(name: string): void {
  document.open();
  document.write(readFileSync(join(GMAIL, `${name}.html`), 'utf8'));
  document.close();
}

function setup() {
  const local = createMemoryArea();
  const session = createMemoryArea();
  const storage = createReadbackStorage({ local, session });
  const registry = new Map<string, { ranges: Range[] }>();
  const painter = createHighlightPainter({
    registry: {
      set: (n, h) => registry.set(n, h as { ranges: Range[] }),
      delete: (n) => registry.delete(n),
    },
    create: (ranges) => ({ ranges }),
  });
  const reports: TabStatus[] = [];
  return {
    local,
    session,
    storage,
    registry,
    painter,
    reports,
    report: (s: TabStatus) => reports.push(s),
  };
}

const tick = async (n = 6): Promise<void> => {
  for (let i = 0; i < n; i += 1) await new Promise((r) => setTimeout(r, 0));
};

const type = (editor: HTMLElement, html: string): void => {
  editor.innerHTML = html;
  editor.dispatchEvent(new Event('input', { bubbles: true }));
};

let gmail: GmailController | undefined;
let selection: SelectionController | undefined;
afterEach(() => {
  gmail?.stop();
  selection?.stop();
  gmail = undefined;
  selection = undefined;
});

describe('Gmail controller', () => {
  it('binds the reply compose, paints slips on input and reports counts only', async () => {
    load('inline-reply');
    const t = setup();
    gmail = await startGmailController({
      doc: document,
      storage: t.storage,
      report: t.report,
      painter: t.painter,
      schedule: (run) => void queueMicrotask(run),
    });
    await tick();
    const editor = findComposeEditors(document)[0]!;
    type(
      editor,
      '<div>Hi Catherine,</div><div><br></div><div>The $1,520 deposit is confirmed.</div>',
    );

    const painted = t.registry.get('readback-slip')?.ranges.map((r) => r.toString());
    expect(painted).toEqual(['Catherine', '$1,520']);
    const last = t.reports.at(-1)!;
    expect(last).toMatchObject({ state: 'reading', asks: 3, slips: 2 });
    // Counts and enums only: nothing from the mail in the status.
    expect(JSON.stringify(last)).not.toMatch(/Kathryn|Catherine|deposit|1,250/);
    // Nothing inside Gmail's compose: the one overlay host sits on <html>, outside the editor.
    expect(editor.outerHTML).not.toMatch(/readback/i);
    expect(editor.querySelector('readback-overlay')).toBeNull();
    expect(document.querySelectorAll('readback-overlay')).toHaveLength(1);
    expect(document.querySelector('readback-overlay')?.parentElement).toBe(
      document.documentElement,
    );
  });

  it('adds nothing at all to the page while there is nothing to draw', async () => {
    load('inline-reply');
    const t = setup();
    // Asks off: no pill, and a draft with no slips has nothing to show either.
    await t.storage.updateSettings(() => setGuard(DEFAULT_SETTINGS, 'asks', false));
    gmail = await startGmailController({
      doc: document,
      storage: t.storage,
      report: t.report,
      painter: t.painter,
      schedule: (run) => void queueMicrotask(run),
    });
    await tick();
    const editor = findComposeEditors(document)[0]!;
    type(editor, '<div>Thanks</div>');
    expect(document.querySelector('readback-overlay')).toBeNull();
  });

  it('stays silent and reports the failed check when the layout is not recognised (AC-8.2)', async () => {
    load('renamed-classes');
    const t = setup();
    gmail = await startGmailController({
      doc: document,
      storage: t.storage,
      report: t.report,
      painter: t.painter,
      schedule: (run) => void queueMicrotask(run),
    });
    await tick();
    expect(t.reports.at(-1)).toMatchObject({
      state: 'layout-unrecognised',
      failedChecks: ['thread'],
    });
    expect(gmail.session()).toBeUndefined();
    type(findComposeEditors(document)[0]!, '<div>Hi Catherine, $1,520</div>');
    expect(t.registry.size).toBe(0);
    expect(statusLine(t.reports.at(-1)).tone).toBe('problem');
  });

  it('ignores a new message and reports idle', async () => {
    load('new-message');
    const t = setup();
    gmail = await startGmailController({
      doc: document,
      storage: t.storage,
      report: t.report,
      painter: t.painter,
      schedule: (r) => void queueMicrotask(r),
    });
    await tick();
    expect(gmail.session()).toBeUndefined();
    expect(t.registry.size).toBe(0);
  });

  it('honours a site switched off, and turns back on when it is switched on', async () => {
    load('inline-reply');
    const t = setup();
    await t.storage.updateSettings((s) => setSiteEnabled(s, document.location.origin, false));
    gmail = await startGmailController({
      doc: document,
      storage: t.storage,
      report: t.report,
      painter: t.painter,
      schedule: (r) => void queueMicrotask(r),
    });
    await tick();
    expect(t.reports.at(-1)?.state).toBe('site-off');
    expect(gmail.session()).toBeUndefined();
    await t.storage.updateSettings((s) => setSiteEnabled(s, document.location.origin, true));
    await tick();
    expect(gmail.session()).toBeDefined();
  });

  it('applies a guard toggle from settings to the open compose at once (AC-10.2)', async () => {
    load('inline-reply');
    const t = setup();
    gmail = await startGmailController({
      doc: document,
      storage: t.storage,
      report: t.report,
      painter: t.painter,
      schedule: (r) => void queueMicrotask(r),
    });
    await tick();
    const editor = findComposeEditors(document)[0]!;
    type(editor, '<div>Hi Catherine, the $1,520 deposit</div>');
    expect(t.registry.get('readback-slip')?.ranges).toHaveLength(2);
    await t.storage.updateSettings((s) => ({ ...s, guards: { ...s.guards, name: false } }));
    expect(t.registry.get('readback-slip')?.ranges.map((r) => r.toString())).toEqual(['$1,520']);
  });

  it('persists a dismissed ask for this reply in session storage as hashed ids (AC-6.6)', async () => {
    load('inline-reply');
    const t = setup();
    gmail = await startGmailController({
      doc: document,
      storage: t.storage,
      report: t.report,
      painter: t.painter,
      schedule: (r) => void queueMicrotask(r),
    });
    await tick();
    const live = gmail.session()!;
    const [first] = live.getSnapshot().result.asks;
    live.dispatch({ type: 'dismiss-ask', id: first!.id });
    await tick();
    const stored = t.session.dump();
    const key = Object.keys(stored).find((k) => k.startsWith('t:'));
    expect(key).toBeDefined();
    expect(JSON.stringify(stored)).not.toMatch(/deposit|Kathryn/);
    expect(live.getSnapshot().pill.label).toBe('2 asks · 2 open');
  });

  it('cleans up: stop() removes the highlights and leaves the DOM alone', async () => {
    load('inline-reply');
    const t = setup();
    gmail = await startGmailController({
      doc: document,
      storage: t.storage,
      report: t.report,
      painter: t.painter,
      schedule: (r) => void queueMicrotask(r),
    });
    await tick();
    type(findComposeEditors(document)[0]!, '<div>Hi Catherine,</div>');
    expect(t.registry.size).toBe(1);
    gmail.stop();
    expect(t.registry.size).toBe(0);
  });
});

describe('selection controller (AC-8.3)', () => {
  it('uses a selection as context, flags the next textarea, and clears', async () => {
    document.body.innerHTML = '<textarea id="reply"></textarea>';
    const t = setup();
    selection = createSelectionController({
      doc: document,
      storage: t.storage,
      report: t.report,
      painter: t.painter,
    });
    expect(await selection.useSelection('ok thanks')).toBe(false);
    expect(await selection.useSelection(DEPOSIT_MESSAGE)).toBe(true);
    expect(t.reports.at(-1)).toMatchObject({ state: 'selection-context' });
    expect(t.reports.at(-1)!.contextWords).toBeGreaterThan(20);

    const area = document.getElementById('reply') as HTMLTextAreaElement;
    area.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await tick();
    expect(selection.session()).toBeDefined();
    area.value = 'Hi Catherine, the $1,520 deposit';
    area.dispatchEvent(new Event('input', { bubbles: true }));
    const flags = selection.session()!.getSnapshot().result.flags;
    expect(flags.map((f) => f.found)).toEqual(['Catherine', '$1,520']);

    // The textarea mirror lives in Readback's own host, and the textarea is untouched.
    const host = document.querySelector('readback-overlay');
    expect(host).not.toBeNull();
    expect(area.value).toBe('Hi Catherine, the $1,520 deposit');
    expect(document.body.querySelectorAll('[data-readback-mirror]')).toHaveLength(0);

    selection.clear();
    expect(selection.session()).toBeUndefined();
    expect(t.reports.at(-1)?.state).toBe('idle');
  });

  it('checks a contenteditable with highlights and ignores read-only fields', async () => {
    document.body.innerHTML =
      '<div id="ce" contenteditable="true"></div><textarea id="ro" readonly></textarea>';
    const t = setup();
    selection = createSelectionController({
      doc: document,
      storage: t.storage,
      report: t.report,
      painter: t.painter,
    });
    await selection.useSelection(DEPOSIT_MESSAGE);
    document.getElementById('ro')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await tick();
    expect(selection.session()).toBeUndefined();

    const ce = document.getElementById('ce')!;
    ce.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await tick();
    ce.textContent = 'Hi Catherine,';
    ce.dispatchEvent(new Event('input', { bubbles: true }));
    expect(t.registry.get('readback-slip')?.ranges.map((r) => r.toString())).toEqual(['Catherine']);
  });

  it('two quick focusins attach once: the later field wins and the first is not left bound', async () => {
    document.body.innerHTML =
      '<div id="a" contenteditable="true"></div><div id="b" contenteditable="true"></div>';
    const t = setup();
    selection = createSelectionController({
      doc: document,
      storage: t.storage,
      report: t.report,
      painter: t.painter,
    });
    await selection.useSelection(DEPOSIT_MESSAGE);
    const a = document.getElementById('a')!;
    const b = document.getElementById('b')!;
    a.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    a.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    b.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await tick();
    a.textContent = 'Hi Catherine,';
    a.dispatchEvent(new Event('input', { bubbles: true }));
    expect(t.registry.get('readback-slip')?.ranges ?? []).toHaveLength(0);
    b.textContent = 'Hi Catherine,';
    b.dispatchEvent(new Event('input', { bubbles: true }));
    expect(t.registry.get('readback-slip')?.ranges.map((r) => r.toString())).toEqual(['Catherine']);
  });

  it('navigation (hashchange) drops the context', async () => {
    document.body.innerHTML = '<textarea id="reply"></textarea>';
    const t = setup();
    selection = createSelectionController({
      doc: document,
      storage: t.storage,
      report: t.report,
      painter: t.painter,
    });
    await selection.useSelection(DEPOSIT_MESSAGE);
    window.dispatchEvent(new Event('hashchange'));
    expect(t.reports.at(-1)?.state).toBe('idle');
    document.getElementById('reply')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await tick();
    expect(selection.session()).toBeUndefined();
  });
});

describe('status mapping', () => {
  it('turns a snapshot into counts and an enum, and the words match the popup copy', () => {
    const session = createComposeSession({
      context: createContext(DEPOSIT_INPUT, new Date(2026, 10, 2)),
      today: new Date(2026, 10, 2),
    });
    session.setDraft('Hi Catherine,');
    const status = statusFrom(session.getSnapshot());
    expect(status).toEqual({
      state: 'reading',
      asks: 3,
      open: 3,
      unconfirmed: 0,
      slips: 1,
      contextWords: 0,
      failedChecks: [],
    });
    expect(statusLine({ ...status, updatedAt: 1 })).toEqual({
      text: 'Reading this reply: 3 asks, 1 slip',
      tone: 'active',
    });
    expect(statusLine({ ...status, asks: 0, slips: 0, updatedAt: 1 }).text).toBe(
      'Reading this reply: no asks, no slips',
    );
    expect(statusLine(undefined).text).toBe('Not a reply page');
    expect(
      statusLine({ ...status, state: 'selection-context', contextWords: 84, updatedAt: 1 }).text,
    ).toBe('Context: 84 words from this page');
    expect(statusLine({ ...status, state: 'layout-unrecognised', updatedAt: 1 }).text).toContain(
      'layout wasn’t recognised',
    );
    expect(statusLine({ ...status, state: 'site-off', updatedAt: 1 }).text).toBe(
      'Readback is off for this site',
    );
    session.dispatch({ type: 'dismiss-ask', id: session.getSnapshot().result.asks[0]!.id });
    expect(statusFrom(session.getSnapshot())).toMatchObject({ asks: 2, open: 2 });
  });
});

describe('Gmail controller: quiet on a busy page, and the right compose', () => {
  it('sends a status only when it changes, however often the page mutates', async () => {
    load('new-message');
    const t = setup();
    gmail = await startGmailController({
      doc: document,
      storage: t.storage,
      report: t.report,
      painter: t.painter,
      schedule: (r) => void queueMicrotask(r),
    });
    await tick();
    // Gmail re-renders all the time; each mutation queues a scan.
    for (let i = 0; i < 20; i += 1) {
      document.body.append(document.createElement('div'));
      await tick(2);
    }
    expect(t.reports.map((r) => r.state)).toEqual(['idle']);
  });

  it('binds the reply even when a new-message compose comes first in the page', async () => {
    const fresh = readFileSync(join(GMAIL, 'new-message.html'), 'utf8');
    const dialog = /<div role="dialog"[\s\S]*?<\/div>\s*<\/div>/.exec(fresh)?.[0] ?? '';
    expect(dialog).toContain('g_editable');
    load('inline-reply');
    document.body.insertAdjacentHTML('afterbegin', dialog);
    const t = setup();
    gmail = await startGmailController({
      doc: document,
      storage: t.storage,
      report: t.report,
      painter: t.painter,
      schedule: (r) => void queueMicrotask(r),
    });
    await tick();
    const editors = findComposeEditors(document);
    expect(editors.length).toBe(2);
    expect(gmail.session()).toBeDefined();
    type(editors[1]!, '<div>Hi Catherine,</div>');
    expect(t.registry.get('readback-slip')?.ranges.map((r) => r.toString())).toEqual(['Catherine']);
  });
});
