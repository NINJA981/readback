/**
 * Capability tiers for the landing page's 3D (bible §11.4, adapted).
 *
 * The page uses no WebGL (DESIGN.md "Landing 3D plan": CSS/SVG only, by
 * decision, so the 3D chunk is 0 KB and there is no canvas to lose). The
 * only "3D" is T21 in CSS: two real cards in a shallow `perspective` stack.
 * The tiers decide whether that stack and the autoplaying demo are used:
 *
 *   tier 0  poster + "Play the demo" button, no autoplay, flat cards.
 *           Reduced motion, Save-Data / reduced-data, <= 2 GB memory,
 *           <= 2 CPU cores, or no 3D transforms.
 *   tier 1  flat cards, demo autoplays once. Coarse-pointer phones and
 *           anything that is not clearly capable.
 *   tier 2  the CSS stack (`perspective: 1200px`, thread card at
 *           `rotateY(4deg) translateZ(-24px)`), demo autoplays once.
 *
 * There is no tier 3: nothing here scales with a GPU. Detection uses only
 * synchronous browser signals, with no network request and no benchmark file.
 */

export type Tier = 0 | 1 | 2;

interface NavigatorHints {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  connection?: { saveData?: boolean };
}

export const reducedMotionQuery = (): MediaQueryList =>
  matchMedia('(prefers-reduced-motion: reduce)');

export function detectTier(): Tier {
  const nav = navigator as Navigator & NavigatorHints;
  if (reducedMotionQuery().matches) return 0;
  if (matchMedia('(prefers-reduced-data: reduce)').matches) return 0;
  if (nav.connection?.saveData === true) return 0;
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2) return 0;
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 2) return 0;
  if (typeof CSS === 'undefined' || !CSS.supports('transform-style', 'preserve-3d')) return 0;
  const phone = matchMedia('(max-width: 767px)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  if (phone || coarse) return 1;
  return 2;
}
