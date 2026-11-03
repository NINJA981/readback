/**
 * TextIndex: flattens an editor's DOM to the plain text the engine checks,
 * and maps engine offsets back to DOM positions (ADR-0001 §Content script 5).
 *
 * Rules, chosen to match how a contenteditable renders:
 * - Text nodes contribute their data. Tabs, CR/LF and no-break spaces become
 *   plain spaces of the same length, so offsets stay 1:1 with node data.
 * - Whitespace-only text nodes that contain a line break are HTML source
 *   formatting between blocks and contribute nothing.
 * - `<br>` contributes "\n". Entering or leaving a block element contributes
 *   one "\n" if the text so far does not already end with one.
 * - Subtrees matched by `exclude` (quoted history) contribute nothing.
 *
 * No extension APIs: the web playground uses the same index.
 */
import type { Span } from '../engine/types';

const BLOCK_TAGS = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'DD',
  'DIV',
  'DL',
  'DT',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'FORM',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HR',
  'LI',
  'MAIN',
  'NAV',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'TBODY',
  'TD',
  'TH',
  'THEAD',
  'TR',
  'UL',
]);
const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'TEMPLATE',
  'NOSCRIPT',
  'IMG',
  'SVG',
  'svg',
  'BUTTON',
]);

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

interface Segment {
  start: number;
  end: number;
  /** Text node for content; null for a synthetic newline. */
  node: Text | null;
}

export interface DomPosition {
  node: Node;
  offset: number;
}

export interface TextIndex {
  readonly text: string;
  /** DOM position for an offset. `bias` picks the side at node boundaries. */
  toPosition(offset: number, bias?: 'forward' | 'backward'): DomPosition | undefined;
  /** A live DOM Range for a span, or undefined if it cannot be mapped. */
  toRange(span: Span): Range | undefined;
  /** Text offset for a DOM position (e.g. the caret), or undefined if outside. */
  fromPosition(node: Node, offset: number): number | undefined;
}

export interface TextIndexOptions {
  /** Subtrees to leave out of the text (e.g. `.gmail_quote`). */
  exclude?: (el: Element) => boolean;
}

/** Tabs, CR/LF and no-break spaces as the index stores them: plain spaces of the same length. */
export const normaliseText = (data: string): string => data.replace(/[\t\r\n\u00a0\u202f]/g, ' ');
const normalise = normaliseText;
const isFormatting = (data: string): boolean => /^[ \t\r\n]*$/.test(data) && /[\r\n]/.test(data);

export function buildTextIndex(root: Element, options: TextIndexOptions = {}): TextIndex {
  const segments: Segment[] = [];
  let text = '';
  let pendingBreak = false;

  const emit = (chunk: string, node: Text | null): void => {
    if (pendingBreak) {
      pendingBreak = false;
      if (text.length > 0 && !text.endsWith('\n')) {
        segments.push({ start: text.length, end: text.length + 1, node: null });
        text += '\n';
      }
    }
    segments.push({ start: text.length, end: text.length + chunk.length, node });
    text += chunk;
  };

  const walk = (node: Node): void => {
    if (node.nodeType === TEXT_NODE) {
      const data = (node as Text).data;
      if (data.length === 0 || isFormatting(data)) return;
      emit(normalise(data), node as Text);
      return;
    }
    if (node.nodeType !== ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName.toUpperCase();
    if (SKIP_TAGS.has(tag)) return;
    if (el !== root && options.exclude?.(el)) return;
    if (tag === 'BR') {
      emit('\n', null);
      return;
    }
    const block = el !== root && BLOCK_TAGS.has(tag);
    if (block) pendingBreak = true;
    for (let child = el.firstChild; child; child = child.nextSibling) walk(child);
    if (block) pendingBreak = true;
  };
  walk(root);

  const textSegments = segments.filter((s): s is Segment & { node: Text } => s.node !== null);

  const toPosition = (
    offset: number,
    bias: 'forward' | 'backward' = 'forward',
  ): DomPosition | undefined => {
    if (offset < 0 || offset > text.length) return undefined;
    if (textSegments.length === 0) return { node: root, offset: 0 };
    // Inside a text node (strictly): unambiguous.
    for (const s of textSegments) {
      if (offset > s.start && offset < s.end) return { node: s.node, offset: offset - s.start };
    }
    const startsHere = textSegments.find((s) => s.start === offset && s.end > s.start);
    const endsHere = [...textSegments].reverse().find((s) => s.end === offset && s.end > s.start);
    const atStart = (s: Segment & { node: Text }): DomPosition => ({ node: s.node, offset: 0 });
    const atEnd = (s: Segment & { node: Text }): DomPosition => ({
      node: s.node,
      offset: s.node.data.length,
    });
    if (bias === 'forward') {
      if (startsHere) return atStart(startsHere);
      if (endsHere) return atEnd(endsHere);
      const after = textSegments.find((s) => s.start >= offset);
      if (after) return atStart(after);
      const last = textSegments[textSegments.length - 1];
      return last ? atEnd(last) : undefined;
    }
    if (endsHere) return atEnd(endsHere);
    if (startsHere) return atStart(startsHere);
    const before = [...textSegments].reverse().find((s) => s.end <= offset);
    if (before) return atEnd(before);
    const first = textSegments[0];
    return first ? atStart(first) : undefined;
  };

  const toRange = (span: Span): Range | undefined => {
    if (span.start > span.end) return undefined;
    const start = toPosition(span.start, 'forward');
    const end = toPosition(span.end, 'backward');
    if (!start || !end) return undefined;
    const doc = root.ownerDocument;
    const range = doc.createRange();
    try {
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
    } catch {
      return undefined;
    }
    return range;
  };

  const fromPosition = (node: Node, offset: number): number | undefined => {
    if (node.nodeType === TEXT_NODE) {
      const seg = textSegments.find((s) => s.node === node);
      if (!seg) return undefined;
      return seg.start + Math.max(0, Math.min(offset, seg.end - seg.start));
    }
    if (node !== root && !root.contains(node)) return undefined;
    const children = node.childNodes;
    if (offset < children.length) {
      const child = children[offset];
      if (!child) return undefined;
      const within = textSegments.find((s) => child === s.node || child.contains(s.node));
      if (within) return within.start;
      // Child has no text (e.g. a <br>): the next text after it.
      const after = textSegments.find(
        (s) => (child.compareDocumentPosition(s.node) & 4) /* FOLLOWING */ !== 0,
      );
      return after ? after.start : text.length;
    }
    const inside = textSegments.filter((s) => node === s.node || node.contains(s.node));
    const last = inside[inside.length - 1];
    if (last) return last.end;
    const before = [...textSegments]
      .reverse()
      .find((s) => (node.compareDocumentPosition(s.node) & 2) /* PRECEDING */ !== 0);
    return before ? before.end : 0;
  };

  return { text, toPosition, toRange, fromPosition };
}

/** Plain text of an element with the TextIndex rules (for read-only message bodies). */
export function elementText(root: Element, options: TextIndexOptions = {}): string {
  return buildTextIndex(root, options).text;
}
