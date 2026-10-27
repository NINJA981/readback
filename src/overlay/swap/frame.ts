/**
 * Swap-back timeline (DESIGN.md "Signature moment"), as a pure function of
 * time. Everything the ghost shows at `t` ms is computed here, never read from
 * a clock, so the playground can render any frame exactly (SPEC AC-5.4, AC-9.2)
 * and the live player just feeds it elapsed time.
 *
 * Timings are the DESIGN.md table:
 *   morph  280 ms total. Shared letters ride SPRING.snappy (visualDuration .18,
 *          bounce 0). Leaving letters fade and blur 0 to 2px over 100 ms.
 *          Arriving letters start at 80 ms and take 150 ms (blur 2px to 0,
 *          y +3px to 0).
 *   roll   240 ms, --ease-out, changed digits only.
 */
import type { SwapGlyph, SwapPlan } from './plan';

export const MORPH_MS = 280;
export const ROLL_MS = 240;
export const LEAVE_MS = 100;
export const ARRIVE_DELAY_MS = 80;
export const ARRIVE_MS = 150;
export const BLUR_PX = 2;
export const ARRIVE_RISE_PX = 3;
/** DESIGN.md SPRING.snappy */
export const SPRING_SNAPPY = { visualDuration: 0.18, bounce: 0 } as const;

/**
 * SPRING.snappy (visualDuration .18, bounce 0) is a critically damped spring,
 * x(t) = 1 - (1 + wt) e^(-wt). w = 29.09 rad/s is fitted to Motion's own
 * `spring()` generator for those options (tests/unit/overlay/swap-frame.test.ts
 * compares the two at every 10 ms), so the choreography is Motion's curve
 * without shipping Motion's runtime inside every Gmail tab.
 */
const SPRING_OMEGA = 29.09;

/** Spring progress 0 to 1 at `ms`. */
export function springProgress(ms: number): number {
  if (ms <= 0) return 0;
  const wt = (SPRING_OMEGA * ms) / 1000;
  return 1 - (1 + wt) * Math.exp(-wt);
}

/** cubic-bezier(x1, y1, x2, y2) easing, solved by Newton with a bisection fallback. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const ax = 3 * x1 - 3 * x2 + 1;
  const bx = 3 * x2 - 6 * x1;
  const cx = 3 * x1;
  const ay = 3 * y1 - 3 * y2 + 1;
  const by = 3 * y2 - 6 * y1;
  const cy = 3 * y1;
  const sampleX = (t: number): number => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number): number => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number): number => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i += 1) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-6) return sampleY(t);
      const d = slopeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    while (lo < hi) {
      const v = sampleX(t);
      if (Math.abs(v - x) < 1e-6) break;
      if (x > v) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
      if (hi - lo < 1e-7) break;
    }
    return sampleY(t);
  };
}

/** `--ease-out` from tokens.css. */
const easeOut = cubicBezier(0.23, 1, 0.32, 1);

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

export const swapDuration = (plan: Pick<SwapPlan, 'kind'>): number =>
  plan.kind === 'roll' ? ROLL_MS : MORPH_MS;

/** Where each glyph starts (`fromX`) and ends (`toX`), px from the word's left edge. */
export interface SwapGeometry {
  fromX: readonly number[];
  toX: readonly number[];
  /** Line box height: how far a rolling digit travels. */
  height: number;
}

export interface GlyphFrame {
  /** Offset from the glyph's resting place at `restX`. */
  x: number;
  y: number;
  opacity: number;
  blur: number;
}

/** Where a glyph is laid out before any transform: its x in `from`, else in `to`. */
export function restX(glyph: SwapGlyph, geometry: SwapGeometry): number {
  if (glyph.fromIndex !== undefined) return geometry.fromX[glyph.fromIndex] ?? 0;
  return geometry.toX[glyph.toIndex ?? 0] ?? 0;
}

export function glyphFrame(
  plan: SwapPlan,
  glyph: SwapGlyph,
  geometry: SwapGeometry,
  t: number,
): GlyphFrame {
  switch (glyph.role) {
    case 'still':
      return { x: 0, y: 0, opacity: 1, blur: 0 };
    case 'shared': {
      const from = geometry.fromX[glyph.fromIndex ?? 0] ?? 0;
      const to = geometry.toX[glyph.toIndex ?? 0] ?? 0;
      return { x: (to - from) * springProgress(t), y: 0, opacity: 1, blur: 0 };
    }
    case 'leaving': {
      const p = easeOut(clamp01(t / LEAVE_MS));
      return { x: 0, y: 0, opacity: 1 - p, blur: BLUR_PX * p };
    }
    case 'arriving': {
      const p = easeOut(clamp01((t - ARRIVE_DELAY_MS) / ARRIVE_MS));
      return { x: 0, y: ARRIVE_RISE_PX * (1 - p), opacity: p, blur: BLUR_PX * (1 - p) };
    }
    case 'roll-out': {
      const p = easeOut(clamp01(t / ROLL_MS));
      return { x: 0, y: -plan.direction * geometry.height * p, opacity: 1, blur: 0 };
    }
    case 'roll-in': {
      const p = easeOut(clamp01(t / ROLL_MS));
      return { x: 0, y: plan.direction * geometry.height * (1 - p), opacity: 1, blur: 0 };
    }
  }
}

/** All glyph frames at `t`, in `plan.glyphs` order. */
export function swapFrame(plan: SwapPlan, geometry: SwapGeometry, t: number): GlyphFrame[] {
  return plan.glyphs.map((g) => glyphFrame(plan, g, geometry, t));
}
