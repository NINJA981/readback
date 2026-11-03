// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  MIN_CONTEXT_WORDS,
  contextChipLabel,
  editableHostOf,
  editableKindOf,
  selectionContextInput,
  wordCount,
} from '../../../src/adapters/generic/selection';
import {
  MIRROR_STYLE_PROPS,
  SLIP_CLASS,
  createTextareaMirror,
  mirrorSegments,
} from '../../../src/adapters/generic/textarea-mirror';
import { createContentEditableTarget, createTextareaTarget } from '../../../src/adapters/target';
import { check, createContext } from '../../../src/engine/index';
import { MAX_SELECTION_CHARS } from '../../../src/messaging/protocol';
import { DEPOSIT_MESSAGE } from '../../fixtures/samples';

describe('selection context (AC-8.3)', () => {
  it('turns a selection into an engine input and flags the next draft against it', () => {
    const input = selectionContextInput(DEPOSIT_MESSAGE);
    expect(input).toMatchObject({ source: 'selection', recipients: [] });
    const ctx = createContext(input!, new Date(2026, 10, 2));
    const result = check(
      ctx,
      { text: 'Hi Catherine, the $1,520 deposit is fine.', version: 1 },
      { today: new Date(2026, 10, 2) },
    );
    expect(result.flags.map((f) => f.guard).sort()).toEqual(['name', 'number']);
    expect(result.asks.length).toBeGreaterThan(0);
  });

  it('rejects selections too short to be a message and caps long ones', () => {
    expect(selectionContextInput('ok thanks')).toBeUndefined();
    expect(selectionContextInput('   ')).toBeUndefined();
    expect(wordCount('a b  c\nd')).toBe(4);
    expect(MIN_CONTEXT_WORDS).toBe(3);
    const long = selectionContextInput(`hello there friend ${'x'.repeat(MAX_SELECTION_CHARS * 2)}`);
    expect(long?.message).toHaveLength(MAX_SELECTION_CHARS);
  });

  it('keys the thread by the selection, so a different selection is a different context', () => {
    const a = createContext(selectionContextInput('Please confirm the $1,250 deposit today')!);
    const b = createContext(selectionContextInput('Please confirm the $1,520 deposit today')!);
    expect(a.threadKey).not.toBe(b.threadKey);
  });

  it('words the chip as in DESIGN.md', () => {
    expect(contextChipLabel(84)).toBe('Context: 84 words from this page');
    expect(contextChipLabel(1)).toBe('Context: 1 word from this page');
  });
});

describe('editable detection', () => {
  const make = (html: string): Element => {
    const root = document.createElement('div');
    root.innerHTML = html;
    document.body.append(root);
    return root.firstElementChild!;
  };

  it('accepts textarea and contenteditable; rejects inputs, read-only and disabled fields', () => {
    expect(editableKindOf(make('<textarea></textarea>'))).toBe('textarea');
    expect(editableKindOf(make('<textarea readonly></textarea>'))).toBeUndefined();
    expect(editableKindOf(make('<textarea disabled></textarea>'))).toBeUndefined();
    expect(editableKindOf(make('<input type="text">'))).toBeUndefined();
    expect(editableKindOf(make('<input type="password">'))).toBeUndefined();
    expect(editableKindOf(make('<div contenteditable="true"></div>'))).toBe('contenteditable');
    expect(editableKindOf(make('<div contenteditable></div>'))).toBe('contenteditable');
    expect(editableKindOf(make('<div contenteditable="false"></div>'))).toBeUndefined();
    expect(
      editableKindOf(make('<div contenteditable="true" aria-readonly="true"></div>')),
    ).toBeUndefined();
    expect(editableKindOf(make('<div></div>'))).toBeUndefined();
    expect(editableKindOf(null)).toBeUndefined();
  });

  it('finds the contenteditable host from a nested focus target', () => {
    const host = make('<div contenteditable="true"><p><b id="inner">x</b></p></div>');
    expect(editableHostOf(host.querySelector('#inner'))).toBe(host);
    expect(editableHostOf(make('<p>no</p>'))).toBeUndefined();
  });
});

describe('mirror segments', () => {
  it('covers the text exactly with plain and slip segments', () => {
    const text = 'Hi Catherine, the $1,520 deposit';
    const segs = mirrorSegments(text, [
      { id: 'n', start: 3, end: 12 },
      { id: 'm', start: 18, end: 24 },
    ]);
    expect(segs.map((s) => s.text).join('')).toBe(text);
    expect(segs.filter((s) => s.slipId).map((s) => s.text)).toEqual(['Catherine', '$1,520']);
    expect(segs.every((s, i) => i === 0 || segs[i - 1]!.end === s.start)).toBe(true);
  });

  it('sorts, clamps, drops overlaps and empty spans', () => {
    const text = 'abcdefghij';
    const segs = mirrorSegments(text, [
      { id: 'late', start: 6, end: 99 },
      { id: 'early', start: 1, end: 4 },
      { id: 'overlap', start: 3, end: 8 },
      { id: 'empty', start: 5, end: 5 },
      { id: 'neg', start: -5, end: 0 },
    ]);
    expect(segs.filter((s) => s.slipId).map((s) => s.slipId)).toEqual(['early', 'late']);
    expect(segs.map((s) => s.text).join('')).toBe(text);
    expect(mirrorSegments('', [{ id: 'x', start: 0, end: 1 }])).toEqual([]);
  });
});

describe('textarea mirror (AC-4.3 structure; pixel overlap is an e2e check)', () => {
  const setup = (value: string) => {
    const field = document.createElement('textarea');
    field.style.fontFamily = 'monospace';
    field.style.fontSize = '14px';
    field.value = value;
    document.body.append(field);
    const host = document.createElement('div');
    document.body.append(host);
    return { field, host, mirror: createTextareaMirror(field, host) };
  };

  it('mirrors the value, wraps slips in spans and never edits the textarea', () => {
    const { field, mirror } = setup('Hi Catherine,\nthe $1,520 deposit');
    mirror.update([{ id: 'n', start: 3, end: 12 }]);
    expect(mirror.element.textContent).toBe(field.value);
    const slip = mirror.element.querySelector(`.${SLIP_CLASS}`);
    expect(slip?.textContent).toBe('Catherine');
    expect((slip as HTMLElement).dataset.slip).toBe('n');
    expect(field.value).toBe('Hi Catherine,\nthe $1,520 deposit');
    expect(mirror.element.getAttribute('aria-hidden')).toBe('true');
    expect(mirror.element.style.pointerEvents).toBe('none');
    expect(mirror.element.style.color).toBe('transparent');
  });

  it('copies the font metrics that decide glyph placement', () => {
    const { mirror } = setup('x');
    mirror.update([]);
    expect(MIRROR_STYLE_PROPS).toContain('font-family');
    expect(MIRROR_STYLE_PROPS).toContain('letter-spacing');
    expect(mirror.element.style.getPropertyValue('font-size')).toBe('14px');
  });

  it('re-renders on update, reports rects for drawn slips only, and removes itself', () => {
    const { field, host, mirror } = setup('Hi Catherine');
    mirror.update([{ id: 'n', start: 3, end: 12 }]);
    expect(mirror.rectsFor('n')).toBeInstanceOf(Array);
    expect(mirror.rectsFor('missing')).toEqual([]);
    field.value = 'Hi Kathryn';
    mirror.update([]);
    expect(mirror.element.querySelector(`.${SLIP_CLASS}`)).toBeNull();
    expect(mirror.rectsFor('n')).toEqual([]);
    mirror.destroy();
    expect(host.contains(mirror.element)).toBe(false);
  });

  it('keeps a trailing newline visible as a real line box', () => {
    const { mirror } = setup('line one\n');
    mirror.update([]);
    expect(mirror.element.textContent).toBe('line one\n ');
  });
});

describe('draft targets', () => {
  it('contenteditable target reads the flattened text and maps spans to ranges', () => {
    const root = document.createElement('div');
    root.setAttribute('contenteditable', 'true');
    root.innerHTML = '<div>Hi Catherine,</div><div>Thanks</div>';
    document.body.append(root);
    const target = createContentEditableTarget(root);
    expect(target.read()).toBe('Hi Catherine,\nThanks');
    expect(target.kind).toBe('contenteditable');
    expect(target.rangeFor({ start: 3, end: 12 })?.toString()).toBe('Catherine');
    expect(target.rectsFor({ start: 3, end: 12 })).toBeInstanceOf(Array);
    expect(target.rangeFor({ start: 9, end: 2 })).toBeUndefined();
    expect(target.caret()).toBeUndefined();
  });

  it('contenteditable target honours the exclusion (quoted history is not the draft)', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div>mine</div><blockquote>theirs $950</blockquote>';
    const target = createContentEditableTarget(root, {
      exclude: (e) => e.tagName === 'BLOCKQUOTE',
    });
    expect(target.read()).toBe('mine');
  });

  it('textarea target reads the value, has no range and fixes through the field', async () => {
    const field = document.createElement('textarea');
    field.value = 'Hi Catherine';
    document.body.append(field);
    const target = createTextareaTarget(field, () => [{ left: 1, top: 2, right: 3, bottom: 4 }]);
    expect(target.read()).toBe('Hi Catherine');
    expect(target.rangeFor({ start: 3, end: 12 })).toBeUndefined();
    expect(target.rectsFor({ start: 3, end: 12 })).toHaveLength(1);
    expect(target.caret()).toBeUndefined();
    // happy-dom has no execCommand: the fix reports failure instead of throwing.
    await expect(target.fix({ start: 3, end: 12 }, 'Kathryn')).resolves.toMatch(
      /failed|copied|inserted/,
    );
  });

  it('refuses a fix when the text under the span is no longer the flagged word', async () => {
    const field = document.createElement('textarea');
    field.value = 'Hi Catherine';
    document.body.append(field);
    const target = createTextareaTarget(field, () => []);
    expect(target.read()).toBe('Hi Catherine');
    // An edit with no input event: the engine still thinks "Catherine" sits at 3..12.
    field.value = 'Dear Mr Catherine';
    await expect(target.fix({ start: 3, end: 12 }, 'Kathryn')).resolves.toBe('failed');
    expect(field.value).toBe('Dear Mr Catherine');

    const root = document.createElement('div');
    root.contentEditable = 'true';
    root.textContent = 'Hi Catherine';
    document.body.append(root);
    const ce = createContentEditableTarget(root);
    expect(ce.read()).toBe('Hi Catherine');
    (root.firstChild as Text).data = 'Dear Mr Catherine';
    await expect(ce.fix({ start: 3, end: 12 }, 'Kathryn')).resolves.toBe('failed');
    expect(root.textContent).toBe('Dear Mr Catherine');
    root.replaceChildren(document.createTextNode('Hi Catherine'));
    await expect(ce.fix({ start: 3, end: 12 }, 'Kathryn')).resolves.toBe('failed');
  });

  it('accepts a fix over a span with a no-break space (pasted dates and amounts)', async () => {
    const root = document.createElement('div');
    root.contentEditable = 'true';
    root.textContent = 'See you Thursday the 10th.';
    document.body.append(root);
    const ce = createContentEditableTarget(root);
    const text = ce.read();
    const start = text.indexOf('Thursday');
    const end = start + 'Thursday the 10th'.length;
    expect(text.slice(start, end)).toBe('Thursday the 10th');
    const written: string[] = [];
    // happy-dom has no execCommand, so a fix that passes the stale-text guard ends up copied.
    await expect(
      ce.fix({ start, end }, 'Thursday the 12th', {
        writeText: async (t) => {
          written.push(t);
        },
      }),
    ).resolves.toBe('copied');
    expect(written).toEqual(['Thursday the 12th']);
  });
});

describe('caret placement', () => {
  it('puts a collapsed caret at an offset in a contenteditable and a textarea', () => {
    const root = document.createElement('div');
    root.contentEditable = 'true';
    root.innerHTML = '<div>Hi Kathryn,</div><div>The deposit is confirmed.</div>';
    document.body.append(root);
    const ce = createContentEditableTarget(root);
    ce.read();
    root.focus();
    ce.placeCaret(16);
    expect(ce.caret()).toBe(16);

    const field = document.createElement('textarea');
    field.value = 'Hi Kathryn, the deposit is confirmed.';
    document.body.append(field);
    const ta = createTextareaTarget(field, () => []);
    ta.read();
    field.focus();
    ta.placeCaret(20);
    expect(ta.caret()).toBe(20);
    ta.placeCaret(500);
    expect(ta.caret()).toBe(field.value.length);
  });
});
