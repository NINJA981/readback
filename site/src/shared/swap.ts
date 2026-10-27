/**
 * The swap-back (DESIGN.md "Signature moment"): when a fix is applied, the
 * wrong word morphs into the right one in place.
 *
 *  - Letters (M3): letters the two words share slide to their new x on a
 *    critically damped spring, 180 ms; leaving letters fade out with blur 0 to
 *    2 px over 100 ms; arriving letters fade in from blur 2 px and y +3 px over
 *    150 ms, starting at 80 ms. Total 280 ms.
 *  - Digits (M5): when both strings are the same length and contain digits,
 *    each changed glyph rolls vertically in its own masked column, in the
 *    direction of change, 240 ms. Unchanged glyphs stay still.
 *
 * Everything is a pure function of progress `p` (0..1), never of wall-clock
 * time, so the landing page can render any frame (`?demo=signature&t=<ms>`)
 * exactly. `playGhost` drives `p` from rAF for live use and is cancelled by
 * `destroy()`, so a keystroke interrupts it at once; the real text underneath is
 * already correct from frame 0 and the ghost only covers it.
 */

export const SWAP_MS = 280;
export const ROLL_MS = 240;

export interface GhostOptions {
  /** Positioned ancestor the ghost is appended to. */
  container: HTMLElement;
  /** Element whose computed font the ghost copies (the editor). */
  host: HTMLElement;
  /** Where the word sits, in `container` coordinates (px). */
  rect: { left: number; top: number; width: number; height: number };
  from: string;
  to: string;
  /** Solid colour that hides the real text while the ghost plays. */
  background: string;
}

export interface Ghost {
  readonly duration: number;
  /** Renders the ghost at progress 0..1. */
  set(p: number): void;
  destroy(): void;
}

/** Longest common subsequence of two strings as matched index pairs. */
export function alignChars(a: string, b: string): [number, number][] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      const row = dp[i] as number[];
      row[j] =
        a[i] === b[j]
          ? ((dp[i + 1] as number[])[j + 1] as number) + 1
          : Math.max((dp[i + 1] as number[])[j] as number, row[j + 1] as number);
    }
  }
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
    } else if (((dp[i + 1] as number[])[j] as number) >= ((dp[i] as number[])[j + 1] as number)) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return pairs;
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** Critically damped spring settle, 0 at x=0 and 1 at x=1 (SPRING.snappy, bounce 0). */
export function spring(x: number): number {
  const k = 8;
  const raw = (v: number): number => 1 - (1 + k * v) * Math.exp(-k * v);
  return raw(clamp01(x)) / raw(1);
}

/** A CSS cubic-bezier easing function, solved numerically. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const bez = (t: number, a: number, b: number): number =>
    3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
  return (x) => {
    const target = clamp01(x);
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i += 1) {
      const mid = (lo + hi) / 2;
      if (bez(mid, x1, x2) < target) lo = mid;
      else hi = mid;
    }
    return bez((lo + hi) / 2, y1, y2);
  };
}

/** --ease-out: cubic-bezier(0.23, 1, 0.32, 1) */
export const easeOut = cubicBezier(0.23, 1, 0.32, 1);
/** --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1) */
export const easeInOut = cubicBezier(0.77, 0, 0.175, 1);

/** x offset (px) of every character of `text` when set in `host`'s font. */
function measure(container: HTMLElement, host: HTMLElement, text: string): number[] {
  const doc = container.ownerDocument;
  const probe = doc.createElement('span');
  const cs = doc.defaultView?.getComputedStyle(host);
  probe.style.cssText =
    'position:absolute;left:0;top:0;visibility:hidden;white-space:pre;pointer-events:none;';
  if (cs) {
    probe.style.font = cs.font;
    probe.style.fontFamily = cs.fontFamily;
    probe.style.fontSize = cs.fontSize;
    probe.style.fontWeight = cs.fontWeight;
    probe.style.fontStretch = cs.fontStretch;
    probe.style.letterSpacing = cs.letterSpacing;
    probe.style.fontFeatureSettings = cs.fontFeatureSettings;
    probe.style.fontVariantNumeric = cs.fontVariantNumeric;
  }
  probe.textContent = text;
  container.appendChild(probe);
  const node = probe.firstChild;
  const origin = probe.getBoundingClientRect().left;
  const xs: number[] = [];
  if (node) {
    const range = doc.createRange();
    for (let i = 0; i <= text.length; i += 1) {
      if (i < text.length) {
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        xs.push(range.getBoundingClientRect().left - origin);
      } else {
        xs.push(probe.getBoundingClientRect().width);
      }
    }
  }
  probe.remove();
  return xs;
}

const isRoll = (from: string, to: string): boolean =>
  from.length === to.length && /\d/.test(from) && /\d/.test(to);

/** Builds a ghost over a word. Returns `undefined` when it cannot be measured. */
export function createGhost(opts: GhostOptions): Ghost | undefined {
  const { container, host, rect, from, to } = opts;
  if (from === to || rect.width <= 0 || rect.height <= 0) return undefined;
  const doc = container.ownerDocument;
  const cs = doc.defaultView?.getComputedStyle(host);
  if (!cs) return undefined;

  const fromX = measure(container, host, from);
  const toX = measure(container, host, to);
  if (fromX.length === 0 || toX.length === 0) return undefined;
  const toW = toX[to.length] as number;

  const root = doc.createElement('span');
  root.setAttribute('aria-hidden', 'true');
  root.dataset.readbackGhost = '';
  root.style.cssText = `position:absolute;z-index:3;left:${rect.left}px;top:${rect.top}px;height:${rect.height}px;width:${toW}px;pointer-events:none;white-space:pre;overflow:visible;background:${opts.background};`;
  root.style.font = cs.font;
  root.style.fontFamily = cs.fontFamily;
  root.style.fontSize = cs.fontSize;
  root.style.fontWeight = cs.fontWeight;
  root.style.fontStretch = cs.fontStretch;
  root.style.letterSpacing = cs.letterSpacing;
  root.style.fontVariantNumeric = cs.fontVariantNumeric;
  root.style.lineHeight = `${rect.height}px`;
  root.style.color = cs.color;

  const glyph = (ch: string, x: number, mask = false): HTMLSpanElement => {
    const s = doc.createElement('span');
    s.textContent = ch;
    s.style.cssText = `position:absolute;top:0;left:${x}px;height:${rect.height}px;will-change:transform,opacity;`;
    if (mask) s.style.willChange = 'transform';
    return s;
  };

  type Update = (p: number) => void;
  const updates: Update[] = [];
  let duration = SWAP_MS;

  if (isRoll(from, to)) {
    duration = ROLL_MS;
    const widthAt = (xs: number[], i: number): number => (xs[i + 1] ?? 0) - (xs[i] ?? 0);
    for (let i = 0; i < to.length; i += 1) {
      const a = from[i] as string;
      const b = to[i] as string;
      const x = toX[i] as number;
      if (a === b) {
        root.appendChild(glyph(b, x));
        continue;
      }
      const column = doc.createElement('span');
      column.style.cssText = `position:absolute;top:0;left:${x}px;width:${Math.max(widthAt(toX, i), widthAt(fromX, i))}px;height:${rect.height}px;overflow:hidden;`;
      const oldG = glyph(a, 0);
      const newG = glyph(b, 0);
      column.append(oldG, newG);
      root.appendChild(column);
      const dir = b > a ? 1 : -1;
      updates.push((p) => {
        const e = easeOut(clamp01(p));
        oldG.style.transform = `translateY(${-dir * e * 100}%)`;
        newG.style.transform = `translateY(${dir * (1 - e) * 100}%)`;
      });
    }
  } else {
    const pairs = alignChars(from, to);
    const matchedFrom = new Map(pairs);
    const matchedTo = new Set(pairs.map(([, j]) => j));
    for (let i = 0; i < from.length; i += 1) {
      const ch = from[i] as string;
      const el = glyph(ch, fromX[i] as number);
      root.appendChild(el);
      const j = matchedFrom.get(i);
      if (j === undefined) {
        updates.push((p) => {
          const t = clamp01((p * SWAP_MS) / 100);
          el.style.opacity = String(1 - t);
          el.style.filter = t === 0 ? '' : `blur(${(t * 2).toFixed(2)}px)`;
        });
      } else {
        const dx = (toX[j] as number) - (fromX[i] as number);
        updates.push((p) => {
          el.style.transform = `translateX(${(dx * spring((p * SWAP_MS) / 180)).toFixed(3)}px)`;
        });
      }
    }
    for (let j = 0; j < to.length; j += 1) {
      if (matchedTo.has(j)) continue;
      const el = glyph(to[j] as string, toX[j] as number);
      root.appendChild(el);
      updates.push((p) => {
        const t = clamp01((p * SWAP_MS - 80) / 150);
        const e = easeOut(t);
        el.style.opacity = String(e);
        el.style.filter = t >= 1 ? '' : `blur(${((1 - t) * 2).toFixed(2)}px)`;
        el.style.transform = `translateY(${((1 - e) * 3).toFixed(2)}px)`;
      });
    }
  }

  container.appendChild(root);
  const set = (p: number): void => {
    for (const u of updates) u(p);
  };
  set(0);
  return {
    duration,
    set,
    destroy() {
      root.remove();
    },
  };
}

/**
 * Plays a ghost with rAF and removes it at the end. Returns a cancel function
 * (call it on any keystroke). Under `prefers-reduced-motion` the caller should
 * not create a ghost at all.
 */
export function playGhost(ghost: Ghost, onDone?: () => void): () => void {
  let frame = 0;
  let cancelled = false;
  const start = performance.now();
  const tick = (now: number): void => {
    if (cancelled) return;
    const p = clamp01((now - start) / ghost.duration);
    ghost.set(p);
    if (p >= 1) {
      ghost.destroy();
      onDone?.();
      return;
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => {
    cancelled = true;
    cancelAnimationFrame(frame);
    ghost.destroy();
  };
}
