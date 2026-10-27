// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { applyFixToField, applyFixToRange } from '../../../src/dom/apply-fix';
import {
  CARD_OFFSET,
  VIEWPORT_INSET,
  effectiveBackground,
  hitTest,
  parseRgb,
  placeCard,
  relativeLuminance,
  themeForBackground,
} from '../../../src/dom/geometry';
import { HIGHLIGHT_NAMES, createHighlightPainter } from '../../../src/dom/highlights';
import { buildTextIndex, elementText } from '../../../src/dom/text-index';

function el(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.append(root);
  return root;
}

describe('TextIndex flattening', () => {
  it('turns blocks and <br> into newlines, once per boundary', () => {
    const root = el('<div>Hi Catherine,</div><div><br></div><div>Thanks</div>');
    expect(buildTextIndex(root).text).toBe('Hi Catherine,\n\nThanks');
    expect(buildTextIndex(el('<p>one</p><p>two<br>three</p>')).text).toBe('one\ntwo\nthree');
  });

  it('ignores HTML source formatting between blocks and skips script, style and images', () => {
    const root = el('<div>a</div>\n   <div>b</div><style>.x{}</style><script>1</script>');
    const image = document.createElement('img');
    image.alt = 'decorative';
    root.append(image);
    expect(elementText(root)).toBe('a\nb');
  });

  it('keeps offsets 1:1 with node data (NBSP and tabs become spaces of the same length)', () => {
    const root = el('<div>a b\tc</div>');
    const index = buildTextIndex(root);
    expect(index.text).toBe('a b c');
    expect(index.text).toHaveLength(root.textContent.length);
  });

  it('leaves out excluded subtrees such as quoted history', () => {
    const root = el('<div>new text</div><div class="gmail_quote">old $950</div>');
    expect(buildTextIndex(root, { exclude: (e) => e.classList.contains('gmail_quote') }).text).toBe(
      'new text',
    );
  });
});

describe('TextIndex offset <-> DOM round trips', () => {
  const cases: [string, string][] = [
    ['plain', '<div>Hi Catherine, thanks</div>'],
    ['nested spans', '<div>Hi <span>Cath<b>er</b>ine</span>, <i>thanks</i></div>'],
    ['br and blocks', '<div>Hi Catherine,</div><div><br></div><div>The $1,520 deposit</div>'],
    ['emoji (surrogate pairs)', '<div>Hi 😀 Catherine 👩‍👩‍👧 and Kathryn</div>'],
    ['RTL names', '<div dir="rtl">שלום קתרין, thanks</div>'],
    ['accents', '<div>Zoë Brontë-O’Brien wrote</div>'],
  ];

  it.each(cases)('%s: every span maps to a Range with the same text', (_name, html) => {
    const root = el(html);
    const index = buildTextIndex(root);
    // Every word-ish span in the flattened text.
    for (const m of index.text.matchAll(/[^\s]+/gu)) {
      const span = { start: m.index, end: m.index + m[0].length };
      const range = index.toRange(span);
      expect(range, `range for ${JSON.stringify(m[0])}`).toBeDefined();
      expect(range?.toString()).toBe(m[0]);
    }
  });

  it.each(cases)(
    '%s: fromPosition(toPosition(n)) is the identity for every offset',
    (_name, html) => {
      const root = el(html);
      const index = buildTextIndex(root);
      for (let n = 0; n <= index.text.length; n += 1) {
        const pos = index.toPosition(n);
        expect(pos, `position ${n}`).toBeDefined();
        if (!pos) continue;
        const back = index.fromPosition(pos.node, pos.offset);
        // A newline has no text node: it maps to the start of the next text.
        if (index.text[n] === '\n' || index.text[n - 1] === '\n') continue;
        expect(back, `offset ${n} in ${html}`).toBe(n);
      }
    },
  );

  it('maps a span that crosses an element boundary', () => {
    const root = el('<div>Hi <b>Cath</b>erine</div>');
    const index = buildTextIndex(root);
    const start = index.text.indexOf('Catherine');
    expect(index.toRange({ start, end: start + 'Catherine'.length })?.toString()).toBe('Catherine');
  });

  it('answers undefined for out-of-range offsets, positions outside the editor and inverted spans', () => {
    const root = el('<div>abc</div>');
    const outside = el('<div>zzz</div>');
    const index = buildTextIndex(root);
    expect(index.toPosition(-1)).toBeUndefined();
    expect(index.toPosition(99)).toBeUndefined();
    expect(index.toRange({ start: 2, end: 1 })).toBeUndefined();
    expect(index.fromPosition(outside, 0)).toBeUndefined();
    expect(index.fromPosition(outside.firstChild!, 0)).toBeUndefined();
  });

  it('handles an empty editor', () => {
    const root = el('<div><br></div>');
    const index = buildTextIndex(root);
    expect(index.text).toBe('\n');
    expect(buildTextIndex(el('')).toPosition(0)).toEqual({
      node: expect.anything() as Node,
      offset: 0,
    });
  });

  it('maps a caret placed on an element (not a text node) to the following text', () => {
    const root = el('<div>one</div><div>two</div>');
    const index = buildTextIndex(root);
    expect(index.fromPosition(root, 1)).toBe(index.text.indexOf('two'));
    expect(index.fromPosition(root, 2)).toBe(index.text.length);
  });
});

describe('highlight painter', () => {
  const ranges = (n: number): Range[] => Array.from({ length: n }, () => document.createRange());

  it('registers the slip set and the active slip separately, and clears them', () => {
    const registry = new Map<string, unknown>();
    const painter = createHighlightPainter({
      registry: { set: (n, h) => registry.set(n, h), delete: (n) => registry.delete(n) },
      create: (r) => ({ ranges: r }),
    });
    const [a, b, c] = ranges(3) as [Range, Range, Range];
    painter.paint([a, b, c], b, 'light');
    expect([...registry.keys()].sort()).toEqual(
      [HIGHLIGHT_NAMES.light.slip, HIGHLIGHT_NAMES.light.active].sort(),
    );
    expect(registry.get(HIGHLIGHT_NAMES.light.slip)).toEqual({ ranges: [a, c] });
    expect(registry.get(HIGHLIGHT_NAMES.light.active)).toEqual({ ranges: [b] });
    // Switching theme replaces, never stacks.
    painter.paint([a], undefined, 'dark');
    expect([...registry.keys()]).toEqual([HIGHLIGHT_NAMES.dark.slip]);
    painter.clear();
    expect(registry.size).toBe(0);
  });

  it('is a safe no-op when the Highlight API is missing', () => {
    const painter = createHighlightPainter(undefined);
    expect(painter.supported).toBe(false);
    expect(() => {
      painter.paint(ranges(1));
      painter.clear();
    }).not.toThrow();
  });
});

describe('apply fix', () => {
  const makeDoc = (
    exec: (cmd: string, ui?: boolean, value?: string) => boolean,
    supported = true,
  ) => {
    const selection = { removeAllRanges: vi.fn(), addRange: vi.fn() };
    return {
      selection,
      doc: {
        execCommand: vi.fn(exec),
        queryCommandSupported: () => supported,
        getSelection: () => selection,
      } as unknown as Document,
    };
  };
  const rangeOf = (text: string): Range => {
    const root = el(`<div>${text}</div>`);
    const r = document.createRange();
    r.selectNodeContents(root);
    return r;
  };

  it('selects the range and inserts through execCommand', async () => {
    const { doc, selection } = makeDoc(() => true);
    const out = await applyFixToRange({ doc, range: rangeOf('Catherine'), replacement: 'Kathryn' });
    expect(out).toBe('inserted');
    expect(selection.addRange).toHaveBeenCalledOnce();
    expect(doc.execCommand).toHaveBeenCalledWith('insertText', false, 'Kathryn');
  });

  it('falls back to the clipboard when the host refuses, and says failed with no clipboard', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    const refuse = makeDoc(() => false);
    expect(
      await applyFixToRange({
        doc: refuse.doc,
        range: rangeOf('x'),
        replacement: 'y',
        clipboard: { writeText },
      }),
    ).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('y');
    expect(await applyFixToRange({ doc: refuse.doc, range: rangeOf('x'), replacement: 'y' })).toBe(
      'failed',
    );
    const unsupported = makeDoc(() => true, false);
    expect(
      await applyFixToRange({ doc: unsupported.doc, range: rangeOf('x'), replacement: 'y' }),
    ).toBe('failed');
    const throwing = makeDoc(() => {
      throw new Error('boom');
    });
    expect(
      await applyFixToRange({ doc: throwing.doc, range: rangeOf('x'), replacement: 'y' }),
    ).toBe('failed');
    const failingClipboard = { writeText: () => Promise.reject(new Error('denied')) };
    expect(
      await applyFixToRange({
        doc: refuse.doc,
        range: rangeOf('x'),
        replacement: 'y',
        clipboard: failingClipboard,
      }),
    ).toBe('failed');
  });

  it('replaces a span in a textarea and only reports success when the value changed', async () => {
    const field = document.createElement('textarea');
    field.value = 'Hi Catherine, thanks';
    document.body.append(field);
    const ok = {
      execCommand: (cmd: string, _ui: boolean, v: string) => {
        if (cmd !== 'insertText') return false;
        field.value =
          field.value.slice(0, field.selectionStart) + v + field.value.slice(field.selectionEnd);
        return true;
      },
      queryCommandSupported: () => true,
    } as unknown as Document;
    expect(
      await applyFixToField({ doc: ok, field, start: 3, end: 12, replacement: 'Kathryn' }),
    ).toBe('inserted');
    expect(field.value).toBe('Hi Kathryn, thanks');

    const noop = {
      execCommand: () => true,
      queryCommandSupported: () => true,
    } as unknown as Document;
    const writeText = vi.fn(() => Promise.resolve());
    expect(
      await applyFixToField({
        doc: noop,
        field,
        start: 3,
        end: 10,
        replacement: 'X',
        clipboard: { writeText },
      }),
    ).toBe('copied');
    expect(await applyFixToField({ doc: noop, field, start: 5, end: 99, replacement: 'X' })).toBe(
      'failed',
    );
    expect(await applyFixToField({ doc: noop, field, start: 6, end: 2, replacement: 'X' })).toBe(
      'failed',
    );
  });
});

describe('geometry', () => {
  const rect = (left: number, top: number, w = 60, h = 18) => ({
    left,
    top,
    right: left + w,
    bottom: top + h,
  });

  it('hit-tests with a small slop and returns the first slip', () => {
    const slips = [
      { id: 'a', rects: [rect(10, 10)] },
      { id: 'b', rects: [rect(100, 10), rect(10, 40)] },
    ];
    expect(hitTest(slips, 20, 15)).toBe('a');
    expect(hitTest(slips, 9, 15)).toBe('a');
    expect(hitTest(slips, 7, 15)).toBeUndefined();
    expect(hitTest(slips, 20, 45)).toBe('b');
    expect(hitTest([], 1, 1)).toBeUndefined();
  });

  it('places the card below the slip, flips above when there is under 220px, and stays inside the viewport', () => {
    const viewport = { width: 1000, height: 800 };
    const size = { width: 320, height: 160 };
    const below = placeCard(rect(100, 100), size, viewport);
    expect(below).toEqual({ left: 100, top: 118 + CARD_OFFSET, side: 'below' });
    const above = placeCard(rect(100, 700), size, viewport);
    expect(above.side).toBe('above');
    expect(above.top).toBe(700 - CARD_OFFSET - size.height);
    const edge = placeCard(rect(900, 100), size, viewport);
    expect(edge.left).toBe(1000 - VIEWPORT_INSET - 320);
    const tiny = placeCard(rect(0, 0), size, { width: 200, height: 100 });
    expect(tiny.left).toBe(VIEWPORT_INSET);
    expect(tiny.top).toBeGreaterThanOrEqual(VIEWPORT_INSET);
  });

  it('keeps the card below when there is more room below than above', () => {
    expect(
      placeCard(rect(10, 20), { width: 320, height: 160 }, { width: 800, height: 300 }).side,
    ).toBe('below');
  });

  it('parses computed colours and picks the highlight set from host luminance', () => {
    expect(parseRgb('rgb(32, 33, 36)')).toEqual({ r: 32, g: 33, b: 36, a: 1 });
    expect(parseRgb('rgba(0, 0, 0, 0.25)')).toEqual({ r: 0, g: 0, b: 0, a: 0.25 });
    expect(parseRgb('rgb(0 0 0 / 50%)')).toEqual({ r: 0, g: 0, b: 0, a: 0.5 });
    expect(parseRgb('oklch(0.2 0 0)')).toBeUndefined();
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(themeForBackground('rgb(255, 255, 255)')).toBe('light');
    expect(themeForBackground('rgb(32, 33, 36)')).toBe('dark');
    expect(themeForBackground('rgba(0, 0, 0, 0)')).toBe('light');
    expect(themeForBackground('transparent')).toBe('light');
  });

  it('walks up to the first opaque background', () => {
    const outer = el(
      '<div style="background: rgb(32, 33, 36)"><div style="background: transparent"><span>x</span></div></div>',
    );
    const span = outer.querySelector('span');
    expect(themeForBackground(effectiveBackground(span))).toBe('dark');
    expect(effectiveBackground(null)).toBe('rgb(255, 255, 255)');
  });
});
