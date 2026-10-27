// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  composeKindOf,
  draftIndexOf,
  findComposeEditors,
} from '../../../src/adapters/gmail/compose';
import { readGmailThread } from '../../../src/adapters/gmail/thread';
import { SELECTORS } from '../../../src/adapters/gmail/selectors';
import { queryAll, queryFirst } from '../../../src/adapters/query';
import { check, createContext } from '../../../src/engine/index';
import { themeForBackground, effectiveBackground } from '../../../src/dom/geometry';

const DIR = join(import.meta.dirname, '..', '..', 'fixtures', 'gmail');

function load(name: string): { doc: Document; expected: Record<string, unknown> } {
  const html = readFileSync(join(DIR, `${name}.html`), 'utf8');
  document.open();
  document.write(html);
  document.close();
  return {
    doc: document,
    expected: JSON.parse(readFileSync(join(DIR, `${name}.expected.json`), 'utf8')) as Record<
      string,
      unknown
    >,
  };
}

const READY = [
  'inline-reply',
  'popout-reply',
  'forward',
  'theme-light',
  'theme-dark',
  'quoted-history',
  'long-signature',
  'own-last',
] as const;

describe('AC-8.1 Gmail adapter extracts sender, signature and recipients per fixture', () => {
  it.each(READY)('%s', (name) => {
    const { doc, expected } = load(name);
    const [editor, ...others] = findComposeEditors(doc);
    expect(others).toHaveLength(0);
    const read = readGmailThread(doc, editor!);
    expect(read.status).toBe('ready');
    if (read.status !== 'ready') return;
    expect(read.selfTest).toEqual({ ok: true, failed: [] });
    expect(read.compose.kind).toBe(expected.kind);
    expect(read.input).toMatchObject({
      source: 'gmail',
      threadId: expected.threadId,
      sentAt: expected.sentAt,
      sender: expected.sender,
      recipients: expected.recipients,
      signatureBlock: expected.signatureBlock,
    });
    expect(read.input.message.trim()).toBe((expected.message as string).trim());
  });

  it("never reads the quoted history or the user's own signature as the incoming message", () => {
    const { doc } = load('quoted-history');
    const read = readGmailThread(doc, findComposeEditors(doc)[0]!);
    if (read.status !== 'ready') throw new Error('expected ready');
    expect(read.input.message).not.toContain('$950');
    expect(read.input.message).not.toContain('Catherine');
  });

  it("skips the user's own last message and reads the one before it", () => {
    const { doc } = load('own-last');
    const read = readGmailThread(doc, findComposeEditors(doc)[0]!);
    if (read.status !== 'ready') throw new Error('expected ready');
    expect(read.input.sender?.name).toBe('Kathryn Moss');
    expect(read.input.message).not.toContain('confirm tomorrow');
  });

  it('keeps the thread id out of the context key (hashed)', () => {
    const { doc } = load('inline-reply');
    const read = readGmailThread(doc, findComposeEditors(doc)[0]!);
    if (read.status !== 'ready') throw new Error('expected ready');
    const ctx = createContext(read.input, new Date(2026, 10, 2));
    expect(ctx.threadKey).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(ctx)).not.toContain(String(read.input.threadId));
  });

  it('feeds the engine: the hero reply yields 3 asks and the two slips', () => {
    const { doc } = load('inline-reply');
    const editor = findComposeEditors(doc)[0]!;
    const read = readGmailThread(doc, editor);
    if (read.status !== 'ready') throw new Error('expected ready');
    const ctx = createContext(read.input, new Date(2026, 10, 2));
    // The user's own signature in the editor is not part of the draft.
    expect(draftIndexOf(editor).text).not.toContain('555-0142');
    const result = check(ctx, {
      text: 'Hi Catherine,\n\nThe $1,520 deposit is confirmed.',
      version: 1,
    });
    expect(result.asks).toHaveLength(3);
    expect(result.flags.map((f) => f.guard).sort()).toEqual(['name', 'number']);
  });
});

describe('compose kinds', () => {
  it('a new message is not a reply and is not an error', () => {
    const { doc, expected } = load('new-message');
    const read = readGmailThread(doc, findComposeEditors(doc)[0]!);
    expect(read.status).toBe(expected.status);
  });

  it('classifies reply, forward and new', () => {
    for (const [name, kind] of [
      ['inline-reply', 'reply'],
      ['popout-reply', 'reply'],
      ['forward', 'forward'],
      ['new-message', 'new'],
    ] as const) {
      const { doc } = load(name);
      const editor = findComposeEditors(doc)[0]!;
      const container = readGmailThread(doc, editor).compose.container;
      expect(composeKindOf(editor, container)).toBe(kind);
    }
  });
});

describe('AC-8.2 renamed classes: the self-test fails and nothing is read', () => {
  it('reports the failed check by id and returns no context', () => {
    const { doc, expected } = load('renamed-classes');
    const editors = findComposeEditors(doc);
    expect(editors).toHaveLength(1);
    const read = readGmailThread(doc, editors[0]!);
    expect(read.status).toBe('layout-unrecognised');
    if (read.status !== 'layout-unrecognised') return;
    expect(read.selfTest.ok).toBe(false);
    expect(read.selfTest.failed).toEqual(expected.failed);
    expect('input' in read).toBe(false);
  });

  it('does not throw on an empty document', () => {
    document.open();
    document.write(
      '<!doctype html><html><body><div contenteditable="true" role="textbox" g_editable="true"></div></body></html>',
    );
    document.close();
    const editor = findComposeEditors(document)[0]!;
    expect(() => readGmailThread(document, editor)).not.toThrow();
  });
});

describe('host theme', () => {
  it.each([
    ['theme-light', 'light'],
    ['theme-dark', 'dark'],
  ] as const)('%s picks the %s highlight set from the editor background', (name, theme) => {
    const { doc } = load(name);
    const editor = findComposeEditors(doc)[0]!;
    expect(themeForBackground(effectiveBackground(editor))).toBe(theme);
  });
});

describe('selector chains', () => {
  it('queryFirst/queryAll fall through broken and empty selectors', () => {
    const { doc } = load('inline-reply');
    expect(queryFirst(doc, ['::bad(', 'div[role="main"]'])).toBeDefined();
    expect(queryAll(doc, ['.nope', 'span.gD[email]'])).toHaveLength(1);
    expect(queryFirst(doc, ['.nope'])).toBeUndefined();
  });

  it('every chain has a fallback (a single selector is a single point of failure)', () => {
    const singles = Object.entries(SELECTORS)
      .filter(([, chain]) => chain.length < 2)
      .map(([id]) => id);
    expect(singles).toEqual([]);
  });
});
