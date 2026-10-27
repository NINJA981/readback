/**
 * Paints slips with the CSS Custom Highlight API (ADR-0001 Decision 1): no
 * host DOM is touched, only `CSS.highlights` entries change. The matching
 * `::highlight(readback-slip…)` rules ship in a manifest-declared stylesheet
 * (src/styles/highlights.css), so no <style> node is added to the page.
 */

export type HighlightTheme = 'light' | 'dark';

export const HIGHLIGHT_NAMES = {
  light: { slip: 'readback-slip', active: 'readback-slip-active' },
  dark: { slip: 'readback-slip-dark', active: 'readback-slip-active-dark' },
} as const;

const ALL_NAMES = [
  HIGHLIGHT_NAMES.light.slip,
  HIGHLIGHT_NAMES.light.active,
  HIGHLIGHT_NAMES.dark.slip,
  HIGHLIGHT_NAMES.dark.active,
];

/** The subset of `HighlightRegistry` the painter uses (lets tests pass a Map). */
export interface HighlightRegistryLike {
  set(name: string, highlight: unknown): unknown;
  delete(name: string): boolean;
}

export type HighlightFactory = (ranges: Range[]) => unknown;

export interface HighlightPainter {
  readonly supported: boolean;
  /** Replaces all slip highlights. `active` is the hovered or focused slip. */
  paint(ranges: readonly Range[], active?: Range, theme?: HighlightTheme): void;
  clear(): void;
}

interface HighlightGlobals {
  CSS?: { highlights?: HighlightRegistryLike };
  Highlight?: new (...ranges: Range[]) => unknown;
}

/** The browser's registry and constructor, if the Highlight API exists. */
export function browserHighlightApi():
  { registry: HighlightRegistryLike; create: HighlightFactory } | undefined {
  const g = globalThis as HighlightGlobals;
  const registry = g.CSS?.highlights;
  const Ctor = g.Highlight;
  if (!registry || !Ctor) return undefined;
  return { registry, create: (ranges) => new Ctor(...ranges) };
}

export function createHighlightPainter(
  api:
    | { registry: HighlightRegistryLike; create: HighlightFactory }
    | undefined = browserHighlightApi(),
): HighlightPainter {
  if (!api) {
    return { supported: false, paint: () => undefined, clear: () => undefined };
  }
  const { registry, create } = api;
  const clear = (): void => {
    for (const name of ALL_NAMES) registry.delete(name);
  };
  return {
    supported: true,
    paint(ranges, active, theme = 'light') {
      clear();
      const names = HIGHLIGHT_NAMES[theme];
      const rest = active ? ranges.filter((r) => r !== active) : [...ranges];
      if (rest.length > 0) registry.set(names.slip, create(rest));
      if (active) registry.set(names.active, create([active]));
    },
    clear,
  };
}
