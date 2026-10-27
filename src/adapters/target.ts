/**
 * A draft target: one editable surface (a contenteditable such as Gmail's
 * editor, or a plain textarea) behind one interface, so the session driver,
 * the overlay and the tests never branch on the kind of field. Offsets are
 * the engine's UTF-16 offsets into `read()`.
 */
import { applyFixToField, applyFixToRange } from '../dom/apply-fix';
import type { ClipboardLike, FixOutcome } from '../dom/apply-fix';
import type { RectLike } from '../dom/geometry';
import { buildTextIndex } from '../dom/text-index';
import type { TextIndex, TextIndexOptions } from '../dom/text-index';
import type { Span } from '../engine/types';

export interface DraftTarget {
  readonly kind: 'contenteditable' | 'textarea';
  readonly element: HTMLElement;
  /** Rebuilds the text index and returns the flattened draft text. */
  read(): string;
  /** A live DOM Range for a span of the last `read()`. Undefined for textareas. */
  rangeFor(span: Span): Range | undefined;
  /** Client rects for a span of the last `read()`. */
  rectsFor(span: Span): RectLike[];
  /** Caret offset in the last `read()` text, if the caret is inside the field. */
  caret(): number | undefined;
  /** Replaces a span through the field's own input path (undo-safe). */
  fix(span: Span, replacement: string, clipboard?: ClipboardLike): Promise<FixOutcome>;
}

const toRects = (list: DOMRectList | DOMRect[]): RectLike[] =>
  Array.from(list).map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }));

export function createContentEditableTarget(
  element: HTMLElement,
  options: TextIndexOptions = {},
): DraftTarget {
  let index: TextIndex = buildTextIndex(element, options);
  const doc = element.ownerDocument;
  return {
    kind: 'contenteditable',
    element,
    read() {
      index = buildTextIndex(element, options);
      return index.text;
    },
    rangeFor: (span) => index.toRange(span),
    rectsFor(span) {
      const range = index.toRange(span);
      return range ? toRects(range.getClientRects()) : [];
    },
    caret() {
      const sel = doc.getSelection();
      if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return undefined;
      const range = sel.getRangeAt(0);
      if (!element.contains(range.startContainer)) return undefined;
      return index.fromPosition(range.startContainer, range.startOffset);
    },
    async fix(span, replacement, clipboard) {
      const range = index.toRange(span);
      if (!range) return 'failed';
      return applyFixToRange({
        doc,
        range,
        replacement,
        ...(clipboard ? { clipboard } : {}),
      });
    },
  };
}

/**
 * A textarea target. `rectsForSlip` is supplied by the textarea mirror, because
 * a textarea's text has no DOM ranges; `rectsFor` resolves a span to the slip
 * drawn at it.
 */
export function createTextareaTarget(
  element: HTMLTextAreaElement,
  slipRects: (span: Span) => RectLike[],
): DraftTarget {
  const doc = element.ownerDocument;
  return {
    kind: 'textarea',
    element,
    read: () => element.value,
    rangeFor: () => undefined,
    rectsFor: slipRects,
    caret() {
      if (doc.activeElement !== element) return undefined;
      return element.selectionStart === element.selectionEnd ? element.selectionStart : undefined;
    },
    fix(span, replacement, clipboard) {
      return applyFixToField({
        doc,
        field: element,
        start: span.start,
        end: span.end,
        replacement,
        ...(clipboard ? { clipboard } : {}),
      });
    },
  };
}
