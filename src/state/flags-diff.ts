/**
 * Diffs two flag lists by id so painters (CSS highlights, the textarea
 * mirror) touch only what changed between keystrokes. A flag whose id is the
 * same but whose span moved (text typed before it) counts as `moved`.
 */
import type { Flag } from '../engine/types';

export interface FlagDiff {
  added: Flag[];
  removed: Flag[];
  moved: Flag[];
  unchanged: Flag[];
}

export function diffFlags(prev: readonly Flag[], next: readonly Flag[]): FlagDiff {
  const before = new Map(prev.map((f) => [f.id, f]));
  const after = new Set(next.map((f) => f.id));
  const diff: FlagDiff = { added: [], removed: [], moved: [], unchanged: [] };
  for (const f of next) {
    const old = before.get(f.id);
    if (!old) diff.added.push(f);
    else if (old.draftSpan.start !== f.draftSpan.start || old.draftSpan.end !== f.draftSpan.end)
      diff.moved.push(f);
    else diff.unchanged.push(f);
  }
  for (const f of prev) if (!after.has(f.id)) diff.removed.push(f);
  return diff;
}

export const hasChanges = (d: FlagDiff): boolean =>
  d.added.length > 0 || d.removed.length > 0 || d.moved.length > 0;

/**
 * The next flag at or after `caret` (Alt+Shift+J, "next slip"), wrapping to
 * the first one. Flags are sorted by start offset.
 */
export function nextFlag(
  flags: readonly Flag[],
  caret: number,
  currentId?: string,
): Flag | undefined {
  if (flags.length === 0) return undefined;
  const sorted = [...flags].sort((a, b) => a.draftSpan.start - b.draftSpan.start);
  if (currentId) {
    const i = sorted.findIndex((f) => f.id === currentId);
    if (i !== -1) return sorted[(i + 1) % sorted.length];
  }
  return sorted.find((f) => f.draftSpan.end >= caret) ?? sorted[0];
}

/** Previous flag before `currentId` (K in the playground), wrapping. */
export function previousFlag(flags: readonly Flag[], currentId: string): Flag | undefined {
  if (flags.length === 0) return undefined;
  const sorted = [...flags].sort((a, b) => a.draftSpan.start - b.draftSpan.start);
  const i = sorted.findIndex((f) => f.id === currentId);
  if (i === -1) return sorted[sorted.length - 1];
  return sorted[(i - 1 + sorted.length) % sorted.length];
}
