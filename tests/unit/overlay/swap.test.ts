import { cubicBezier as motionCubicBezier, spring } from 'motion';
import { describe, expect, it } from 'vitest';
import {
  ARRIVE_DELAY_MS,
  MORPH_MS,
  ROLL_MS,
  cubicBezier,
  springProgress,
  swapDuration,
  swapFrame,
} from '../../../src/overlay/swap/frame';
import type { SwapGeometry } from '../../../src/overlay/swap/frame';
import { canRoll, commonGlyphs, planSwap } from '../../../src/overlay/swap/plan';

const roles = (plan: ReturnType<typeof planSwap>, role: string): string[] =>
  plan.glyphs.filter((g) => g.role === role).map((g) => g.char);

describe('swap-back plan (DESIGN.md signature moment)', () => {
  it('Catherine to Kathryn: a, t, h, r, n slide; C, e, i, e leave; K and y arrive', () => {
    const plan = planSwap('Catherine', 'Kathryn', 'name');
    expect(plan.kind).toBe('morph');
    expect(roles(plan, 'shared')).toEqual(['a', 't', 'h', 'r', 'n']);
    expect(roles(plan, 'leaving').sort()).toEqual(['C', 'e', 'e', 'i']);
    expect(roles(plan, 'arriving').sort()).toEqual(['K', 'y']);
  });

  it('every glyph of both words is accounted for exactly once', () => {
    const plan = planSwap('Catherine', 'Kathryn', 'name');
    const fromSeen = plan.glyphs.flatMap((g) => (g.fromIndex === undefined ? [] : [g.fromIndex]));
    const toSeen = plan.glyphs.flatMap((g) => (g.toIndex === undefined ? [] : [g.toIndex]));
    expect(fromSeen.sort((a, b) => a - b)).toEqual([...Array(9).keys()]);
    expect(toSeen.sort((a, b) => a - b)).toEqual([...Array(7).keys()]);
  });

  it('$1,520 to $1,250 rolls only the two changed digits, in their own columns', () => {
    const plan = planSwap('$1,520', '$1,250', 'number');
    expect(plan.kind).toBe('roll');
    expect(roles(plan, 'still')).toEqual(['$', '1', ',', '0']);
    expect(roles(plan, 'roll-out')).toEqual(['5', '2']);
    expect(roles(plan, 'roll-in')).toEqual(['2', '5']);
    // 5 to 2 shrinks and 2 to 5 grows: the net change is zero, so the roll defaults to up.
    expect(plan.direction).toBe(1);
  });

  it('a digit that only grows rolls up; one that only shrinks rolls down', () => {
    expect(planSwap('48213', '48218', 'number').direction).toBe(1);
    expect(planSwap('48218', '48213', 'number').direction).toBe(-1);
  });

  it('numbers of different length, and non-number guards, morph instead of rolling', () => {
    expect(canRoll('$1,520', '$1,250')).toBe(true);
    expect(canRoll('$999', '$1,000')).toBe(false);
    expect(planSwap('$999', '$1,000', 'number').kind).toBe('morph');
    expect(planSwap('Thursday the 10th', 'Thursday the 12th', 'date').kind).toBe('morph');
  });

  it('commonGlyphs is a longest common subsequence', () => {
    expect(commonGlyphs('abcde', 'ace').map(([i]) => i)).toEqual([0, 2, 4]);
    expect(commonGlyphs('abc', 'xyz')).toEqual([]);
  });
});

describe('swap-back timeline is a pure function of time', () => {
  const plan = planSwap('Catherine', 'Kathryn', 'name');
  const geometry: SwapGeometry = {
    fromX: [0, 8, 14, 20, 28, 34, 40, 44, 50],
    toX: [0, 9, 15, 22, 28, 35, 42],
    height: 18,
  };
  const frame = (t: number) => swapFrame(plan, geometry, t);
  const byRole = (t: number, role: string) =>
    frame(t).filter((_, i) => plan.glyphs[i]?.role === role);

  it('frame 0 shows the old word untouched', () => {
    frame(0).forEach((f, i) => {
      expect(f.x).toBeCloseTo(0, 5);
      // Arriving letters wait 3px below their place, invisible, until 80 ms.
      expect(f.y).toBeCloseTo(plan.glyphs[i]?.role === 'arriving' ? 3 : 0, 5);
    });
    expect(byRole(0, 'leaving').every((f) => f.opacity === 1 && f.blur === 0)).toBe(true);
    expect(byRole(0, 'arriving').every((f) => f.opacity === 0)).toBe(true);
  });

  it('is deterministic: the same time gives the same frame', () => {
    expect(frame(137)).toEqual(frame(137));
  });

  it('leaving letters are gone and blurred by 100 ms; arriving ones start at 80 ms and land by 230 ms', () => {
    expect(
      byRole(100, 'leaving').every((f) => f.opacity === 0 && Math.abs(f.blur - 2) < 1e-6),
    ).toBe(true);
    expect(byRole(ARRIVE_DELAY_MS, 'arriving').every((f) => f.opacity === 0)).toBe(true);
    expect(
      byRole(ARRIVE_DELAY_MS + 150, 'arriving').every(
        (f) => f.opacity === 1 && f.blur === 0 && f.y === 0,
      ),
    ).toBe(true);
  });

  it('shared letters have moved to within a pixel of their new x at the end of the morph', () => {
    const frames = frame(MORPH_MS);
    plan.glyphs.forEach((g, i) => {
      if (g.role !== 'shared') return;
      const target = (geometry.toX[g.toIndex ?? 0] ?? 0) - (geometry.fromX[g.fromIndex ?? 0] ?? 0);
      expect(Math.abs((frames[i]?.x ?? 99) - target)).toBeLessThan(0.1);
    });
  });

  it('digit roll: old digit leaves by one line height, new one arrives from the opposite side', () => {
    const roll = planSwap('$1,520', '$1,250', 'number');
    const geo: SwapGeometry = {
      fromX: [0, 8, 14, 16, 24, 32],
      toX: [0, 8, 14, 16, 24, 32],
      height: 18,
    };
    const start = swapFrame(roll, geo, 0);
    const end = swapFrame(roll, geo, ROLL_MS);
    const out = roll.glyphs.findIndex((g) => g.role === 'roll-out');
    const inn = roll.glyphs.findIndex((g) => g.role === 'roll-in');
    expect(start[out]?.y).toBeCloseTo(0, 5);
    expect(start[inn]?.y).toBe(18);
    expect(end[out]?.y).toBe(-18);
    expect(end[inn]?.y).toBeCloseTo(0, 5);
    // The unchanged glyphs never move.
    const mid = swapFrame(roll, geo, 120);
    roll.glyphs.forEach((g, i) => {
      if (g.role === 'still') expect(mid[i]).toEqual({ x: 0, y: 0, opacity: 1, blur: 0 });
    });
  });

  it('durations are DESIGN.md: 280 ms morph, 240 ms roll', () => {
    expect(swapDuration({ kind: 'morph' })).toBe(280);
    expect(swapDuration({ kind: 'roll' })).toBe(240);
  });
});

describe('the in-house curves match Motion', () => {
  it('springProgress equals Motion spring({ visualDuration: .18, bounce: 0 }) at every 10 ms', () => {
    const generator = spring({ keyframes: [0, 1], visualDuration: 0.18, bounce: 0 });
    for (let t = 0; t <= 400; t += 10) {
      expect(Math.abs(springProgress(t) - generator.next(t).value)).toBeLessThan(0.006);
    }
  });

  it('cubicBezier matches Motion for --ease-out and --ease-in-out', () => {
    const curves: [number, number, number, number][] = [
      [0.23, 1, 0.32, 1],
      [0.77, 0, 0.175, 1],
    ];
    for (const [a, b, c, d] of curves) {
      const ours = cubicBezier(a, b, c, d);
      const theirs = motionCubicBezier(a, b, c, d);
      for (let x = 0; x <= 1; x += 0.05) expect(Math.abs(ours(x) - theirs(x))).toBeLessThan(0.002);
    }
  });
});
