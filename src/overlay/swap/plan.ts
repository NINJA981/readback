/**
 * Swap-back plan (DESIGN.md "Signature moment"): which glyphs of the old text
 * stay, leave or arrive when a fix replaces `from` with `to`. Pure, so the
 * extension and the web playground derive the same choreography.
 *
 * - Letters and mixed text use the M3 morph: glyphs the two words share (the
 *   longest common subsequence) slide to their new x, the rest blur out or in.
 * - Numbers of equal length use the M5 roll: only the changed digits roll
 *   vertically in their column; every other glyph stays put.
 */

export type GlyphRole = 'shared' | 'leaving' | 'arriving' | 'still' | 'roll-out' | 'roll-in';

export interface SwapGlyph {
  role: GlyphRole;
  char: string;
  /** Index into `from` (shared, leaving, still, roll-out). */
  fromIndex?: number;
  /** Index into `to` (shared, arriving, still, roll-in). */
  toIndex?: number;
}

export interface SwapPlan {
  kind: 'morph' | 'roll';
  from: string;
  to: string;
  glyphs: SwapGlyph[];
  /** Roll direction: 1 when the digits grow (old rolls up), -1 when they shrink. */
  direction: 1 | -1;
}

/** Longest-common-subsequence pairs `[fromIndex, toIndex]`, in order. */
export function commonGlyphs(from: string, to: string): [number, number][] {
  const a = Array.from(from);
  const b = Array.from(to);
  const cols = b.length + 1;
  const table = new Uint16Array((a.length + 1) * cols);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      const down = table[(i + 1) * cols + j] ?? 0;
      const right = table[i * cols + j + 1] ?? 0;
      table[i * cols + j] =
        a[i] === b[j] ? (table[(i + 1) * cols + j + 1] ?? 0) + 1 : Math.max(down, right);
    }
  }
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
    } else if ((table[(i + 1) * cols + j] ?? 0) >= (table[i * cols + j + 1] ?? 0)) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return pairs;
}

const isDigit = (c: string): boolean => c >= '0' && c <= '9';

/** A number fix that keeps its length and format rolls; anything else morphs. */
export function canRoll(from: string, to: string): boolean {
  const a = Array.from(from);
  const b = Array.from(to);
  if (a.length !== b.length || from === to) return false;
  return a.every((c, i) => c === b[i] || (isDigit(c) && isDigit(b[i] ?? '')));
}

export function planSwap(from: string, to: string, guard: 'name' | 'number' | 'date'): SwapPlan {
  const a = Array.from(from);
  const b = Array.from(to);
  if (guard === 'number' && canRoll(from, to)) {
    const glyphs: SwapGlyph[] = [];
    let grew = 0;
    a.forEach((c, i) => {
      const next = b[i] ?? '';
      if (c === next) {
        glyphs.push({ role: 'still', char: c, fromIndex: i, toIndex: i });
        return;
      }
      grew += Number(next) - Number(c);
      glyphs.push({ role: 'roll-out', char: c, fromIndex: i });
      glyphs.push({ role: 'roll-in', char: next, toIndex: i });
    });
    return { kind: 'roll', from, to, glyphs, direction: grew >= 0 ? 1 : -1 };
  }

  const pairs = commonGlyphs(from, to);
  const keptFrom = new Set(pairs.map(([i]) => i));
  const keptTo = new Set(pairs.map(([, j]) => j));
  const glyphs: SwapGlyph[] = [];
  pairs.forEach(([i, j]) => {
    glyphs.push({ role: 'shared', char: a[i] ?? '', fromIndex: i, toIndex: j });
  });
  a.forEach((c, i) => {
    if (!keptFrom.has(i)) glyphs.push({ role: 'leaving', char: c, fromIndex: i });
  });
  b.forEach((c, j) => {
    if (!keptTo.has(j)) glyphs.push({ role: 'arriving', char: c, toIndex: j });
  });
  return { kind: 'morph', from, to, glyphs, direction: 1 };
}
