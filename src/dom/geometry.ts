/**
 * Geometry helpers for the overlay: hover hit-testing against a slip's client
 * rects (highlights receive no events, ADR-0001 §Content script 8) and card
 * placement (DESIGN.md §Layout: below the slip, flip above with < 220px,
 * 6px offset, 8px viewport insets). Pure functions over plain rects.
 */

export interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface SlipRects {
  id: string;
  rects: readonly RectLike[];
}

/** The slip under the pointer, allowing `slop` px around each rect. */
export function hitTest(
  slips: readonly SlipRects[],
  x: number,
  y: number,
  slop = 2,
): string | undefined {
  for (const s of slips) {
    for (const r of s.rects) {
      if (x >= r.left - slop && x <= r.right + slop && y >= r.top - slop && y <= r.bottom + slop) {
        return s.id;
      }
    }
  }
  return undefined;
}

export const CARD_OFFSET = 6;
export const VIEWPORT_INSET = 8;
export const FLIP_THRESHOLD = 220;

export interface Placement {
  left: number;
  top: number;
  side: 'below' | 'above';
}

/** Where to put a card of `width × height` for an anchor rect inside a viewport. */
export function placeCard(
  anchor: RectLike,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): Placement {
  const spaceBelow = viewport.height - anchor.bottom;
  const side: Placement['side'] =
    spaceBelow < FLIP_THRESHOLD && anchor.top > spaceBelow ? 'above' : 'below';
  const rawTop =
    side === 'below' ? anchor.bottom + CARD_OFFSET : anchor.top - CARD_OFFSET - size.height;
  const maxLeft = viewport.width - VIEWPORT_INSET - size.width;
  const maxTop = viewport.height - VIEWPORT_INSET - size.height;
  return {
    left: Math.max(VIEWPORT_INSET, Math.min(anchor.left, maxLeft)),
    top: Math.max(VIEWPORT_INSET, Math.min(rawTop, maxTop)),
    side,
  };
}

/**
 * Parses a computed CSS colour (`rgb()`/`rgba()`, as `getComputedStyle`
 * returns) to 0–255 channels plus alpha. Undefined for anything else.
 */
export function parseRgb(
  color: string,
): { r: number; g: number; b: number; a: number } | undefined {
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(
    color.trim(),
  );
  if (!m) return undefined;
  const alphaRaw = m[4];
  const a =
    alphaRaw === undefined
      ? 1
      : alphaRaw.endsWith('%')
        ? Number(alphaRaw.slice(0, -1)) / 100
        : Number(alphaRaw);
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a };
}

/** WCAG relative luminance of an sRGB colour. */
export function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Light or dark highlight set for a host background (ADR-0001 §Content script
 * 7: Gmail's theme is independent of `prefers-color-scheme`). Transparent or
 * unreadable colours fall back to light.
 */
export function themeForBackground(color: string): 'light' | 'dark' {
  const c = parseRgb(color);
  if (!c || c.a < 0.5) return 'light';
  return relativeLuminance(c) < 0.2 ? 'dark' : 'light';
}

/** The first non-transparent background colour from `el` up to the root. */
export function effectiveBackground(el: Element | null): string {
  for (let node = el; node; node = node.parentElement) {
    const view = node.ownerDocument.defaultView;
    if (!view) break;
    const bg = view.getComputedStyle(node).backgroundColor;
    const c = parseRgb(bg);
    if (c && c.a >= 0.5) return bg;
  }
  return 'rgb(255, 255, 255)';
}
