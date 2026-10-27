/**
 * Textarea mirror (SPEC F4): highlights cannot reach into a `<textarea>`, so
 * an invisible clone of its box and font metrics is drawn in Readback's own
 * shadow root, with transparent text and the squiggle as a `text-decoration`
 * on each slip. The textarea itself is never touched.
 *
 * `mirrorSegments` is the pure model (testable without layout); `createTextareaMirror`
 * renders it and answers client-rect queries for hit-testing.
 */
import type { RectLike } from '../../dom/geometry';
import type { Span } from '../../engine/types';

export interface MirrorSegment {
  text: string;
  start: number;
  end: number;
  /** Flag id when this segment is a slip. */
  slipId?: string;
}

export interface MirrorSlip extends Span {
  id: string;
}

/**
 * Splits `text` into plain and slip segments that cover it exactly. Slips are
 * clamped to the text, sorted, and any slip overlapping an earlier one is
 * dropped (two squiggles on the same characters cannot both be drawn).
 */
export function mirrorSegments(text: string, slips: readonly MirrorSlip[]): MirrorSegment[] {
  const sorted = [...slips]
    .map((s) => ({ ...s, start: Math.max(0, s.start), end: Math.min(text.length, s.end) }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const out: MirrorSegment[] = [];
  let at = 0;
  for (const s of sorted) {
    if (s.start < at) continue;
    if (s.start > at) out.push({ text: text.slice(at, s.start), start: at, end: s.start });
    out.push({ text: text.slice(s.start, s.end), start: s.start, end: s.end, slipId: s.id });
    at = s.end;
  }
  if (at < text.length) out.push({ text: text.slice(at), start: at, end: text.length });
  return out;
}

/** Computed properties that decide where a glyph lands inside a textarea. */
export const MIRROR_STYLE_PROPS = [
  'box-sizing',
  'direction',
  'font-family',
  'font-feature-settings',
  'font-kerning',
  'font-size',
  'font-stretch',
  'font-style',
  'font-variant',
  'font-weight',
  'letter-spacing',
  'line-height',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'tab-size',
  'text-align',
  'text-indent',
  'text-transform',
  'word-spacing',
] as const;

export interface TextareaMirror {
  readonly element: HTMLElement;
  /** Re-renders for the textarea's current value and the given slips. */
  update(slips: readonly MirrorSlip[]): void;
  /** Client rects of a slip's text (empty when the slip is not drawn). */
  rectsFor(id: string): RectLike[];
  /** Re-reads size, position and scroll from the textarea. */
  sync(): void;
  destroy(): void;
}

export const SLIP_CLASS = 'rb-mirror-slip';

export function createTextareaMirror(
  textarea: HTMLTextAreaElement,
  host: ParentNode,
): TextareaMirror {
  const doc = textarea.ownerDocument;
  const view = doc.defaultView;
  const element = doc.createElement('div');
  element.setAttribute('aria-hidden', 'true');
  element.dataset.readbackMirror = '';
  const slipEls = new Map<string, HTMLElement>();

  const sync = (): void => {
    const style = view?.getComputedStyle(textarea);
    if (style) {
      for (const prop of MIRROR_STYLE_PROPS) {
        element.style.setProperty(prop, style.getPropertyValue(prop));
      }
    }
    const rect = textarea.getBoundingClientRect();
    element.style.position = 'fixed';
    element.style.left = `${rect.left}px`;
    element.style.top = `${rect.top}px`;
    element.style.width = `${rect.width}px`;
    element.style.height = `${rect.height}px`;
    element.style.overflow = 'hidden';
    element.style.whiteSpace = 'pre-wrap';
    element.style.overflowWrap = 'break-word';
    element.style.pointerEvents = 'none';
    element.style.color = 'transparent';
    element.style.borderStyle = 'solid';
    element.style.borderColor = 'transparent';
    element.scrollTop = textarea.scrollTop;
    element.scrollLeft = textarea.scrollLeft;
  };

  const update = (slips: readonly MirrorSlip[]): void => {
    const segments = mirrorSegments(textarea.value, slips);
    slipEls.clear();
    const nodes = segments.map((seg) => {
      if (seg.slipId === undefined) return doc.createTextNode(seg.text);
      const span = doc.createElement('span');
      span.className = SLIP_CLASS;
      span.dataset.slip = seg.slipId;
      span.textContent = seg.text;
      slipEls.set(seg.slipId, span);
      return span;
    });
    element.replaceChildren(...nodes);
    // A trailing newline needs a visible line box, as in a real textarea.
    if (textarea.value.endsWith('\n')) element.append(doc.createTextNode(' '));
    sync();
  };

  host.appendChild(element);
  sync();

  return {
    element,
    update,
    rectsFor(id) {
      const el = slipEls.get(id);
      if (!el) return [];
      return Array.from(el.getClientRects()).map((r) => ({
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
      }));
    },
    sync,
    destroy() {
      element.remove();
      slipEls.clear();
    },
  };
}
