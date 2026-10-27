/**
 * The swap-back ghost (DESIGN.md "Swap-back ghost"): a transient element in
 * Readback's shadow root, set in the host editor's own computed font and laid
 * over the fixed range. It plays the morph or roll and removes itself. The real
 * text underneath is already correct from frame 0, so the ghost is decoration
 * and an interrupted or skipped ghost loses nothing.
 *
 * `seek(t)` renders any frame deterministically; the live player only feeds it
 * elapsed time. Only this element animates, never the host's DOM.
 */
import type { RectLike } from '../../dom/geometry';
import { restX, swapDuration, swapFrame } from './frame';
import type { SwapGeometry } from './frame';
import { planSwap } from './plan';
import type { SwapPlan } from './plan';

export interface SwapGhostOptions {
  doc: Document;
  /** Where the ghost is appended (Readback's shadow root). */
  root: ParentNode;
  /** First client rect of the corrected text. */
  rect: RectLike;
  /** Element whose computed font and colour the ghost copies. */
  styleSource: Element;
  from: string;
  to: string;
  guard: 'name' | 'number' | 'date';
  /** Opaque colour sampled from the editor, so the ghost can cover the real text. */
  background: string;
  /** Start playing immediately with requestAnimationFrame. Tests pass false and call seek. */
  autoplay?: boolean;
  onDone?: () => void;
}

export interface SwapGhost {
  readonly plan: SwapPlan;
  readonly duration: number;
  readonly element: HTMLElement;
  /** Renders the frame at `t` ms. */
  seek(t: number): void;
  cancel(): void;
}

const FONT_PROPS = [
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-stretch',
  'font-variation-settings',
  'font-feature-settings',
  'font-variant-numeric',
  'letter-spacing',
  'word-spacing',
  'text-transform',
  'color',
] as const;

/** Per-character left offsets (px from the text's left) and the total width. */
function measure(doc: Document, host: HTMLElement, text: string): { x: number[]; width: number } {
  const probe = doc.createElement('span');
  probe.style.cssText = 'position:absolute;left:0;top:0;white-space:pre;visibility:hidden;';
  probe.textContent = text;
  host.append(probe);
  const base = probe.getBoundingClientRect().left;
  const node = probe.firstChild;
  const x: number[] = [];
  let offset = 0;
  for (const ch of text) {
    if (node) {
      const r = doc.createRange();
      r.setStart(node, offset);
      r.setEnd(node, offset + ch.length);
      x.push(r.getBoundingClientRect().left - base);
    } else {
      x.push(0);
    }
    offset += ch.length;
  }
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return { x, width };
}

export function createSwapGhost(options: SwapGhostOptions): SwapGhost {
  const { doc, root, rect, styleSource, from, to, guard, background } = options;
  const plan = planSwap(from, to, guard);
  const view = doc.defaultView;
  const computed = view?.getComputedStyle(styleSource);

  const height = Math.max(1, rect.bottom - rect.top);
  const el = doc.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.className = 'rb-ghost';
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.top}px`;
  el.style.height = `${height}px`;
  el.style.lineHeight = `${height}px`;
  el.style.background = background;
  if (computed)
    for (const prop of FONT_PROPS) el.style.setProperty(prop, computed.getPropertyValue(prop));
  root.append(el);

  const fromM = measure(doc, el, from);
  const toM = measure(doc, el, to);
  el.style.width = `${Math.max(toM.width, 1)}px`;

  const geometry: SwapGeometry = { fromX: fromM.x, toX: toM.x, height };
  const nodes = plan.glyphs.map((glyph) => {
    const span = doc.createElement('span');
    span.className = 'rb-ghost-glyph';
    span.textContent = glyph.char;
    const left = restX(glyph, geometry);
    if (plan.kind === 'roll') {
      // Each changed digit lives in its own masked column.
      const column = doc.createElement('span');
      column.className = 'rb-ghost-column';
      const index = glyph.fromIndex ?? glyph.toIndex ?? 0;
      const next = (geometry.toX[index + 1] ?? toM.width) - left;
      column.style.left = `${left}px`;
      column.style.width = `${Math.max(next, 1)}px`;
      column.append(span);
      el.append(column);
    } else {
      span.style.left = `${left}px`;
      el.append(span);
    }
    return span;
  });

  const duration = swapDuration(plan);
  const seek = (t: number): void => {
    const frames = swapFrame(plan, geometry, t);
    frames.forEach((f, i) => {
      const node = nodes[i];
      if (!node) return;
      node.style.transform = `translate3d(${f.x}px, ${f.y}px, 0)`;
      node.style.opacity = String(f.opacity);
      node.style.filter = f.blur > 0.01 ? `blur(${f.blur}px)` : '';
    });
  };
  seek(0);

  let handle = 0;
  let finished = false;
  const finish = (): void => {
    if (finished) return;
    finished = true;
    if (handle && view) view.cancelAnimationFrame(handle);
    el.remove();
    options.onDone?.();
  };

  if (options.autoplay !== false && view) {
    let start: number | undefined;
    const step = (now: number): void => {
      start ??= now;
      const t = now - start;
      if (t >= duration) {
        finish();
        return;
      }
      seek(t);
      handle = view.requestAnimationFrame(step);
    };
    handle = view.requestAnimationFrame(step);
  }

  return { plan, duration, element: el, seek, cancel: finish };
}
