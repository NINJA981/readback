/**
 * Hover intent for the guard card (DESIGN.md "Guard card": opens after 300 ms
 * of hover). A small state machine with injected timers so the dwell, the
 * move-away grace and the pointer crossing from the slip into the card are
 * unit tested without a browser.
 *
 * Highlights receive no events (ADR-0001), so the caller feeds this from one
 * passive `pointermove` hit-test and reports pointer enter/leave on the card.
 */

export const DWELL_MS = 300;
/** Time the pointer may leave the slip before the card closes, so it can reach the card. */
export const GRACE_MS = 220;

export interface Timers {
  set: (run: () => void, ms: number) => number;
  clear: (handle: number) => void;
}

export interface HoverIntentOptions {
  timers: Timers;
  dwellMs?: number;
  graceMs?: number;
  /** The pointer rested on `id` long enough. */
  onOpen: (id: string) => void;
  /** The pointer left both the slip and the card. */
  onClose: () => void;
}

export interface HoverIntent {
  /** The slip under the pointer, or undefined. Call on every pointermove. */
  over(id: string | undefined): void;
  cardEnter(): void;
  cardLeave(): void;
  /** The card was closed by something else (Esc, a fix, typing). */
  closed(): void;
  /** Drops every pending timer (typing, scroll, destroy). */
  cancel(): void;
  /** The id the open hover card belongs to. */
  readonly openId: string | undefined;
}

export function createHoverIntent(options: HoverIntentOptions): HoverIntent {
  const { timers, onOpen, onClose } = options;
  const dwellMs = options.dwellMs ?? DWELL_MS;
  const graceMs = options.graceMs ?? GRACE_MS;

  let target: string | undefined; // slip the pointer is on
  let dwell: number | undefined;
  let grace: number | undefined;
  let openId: string | undefined;
  let onCard = false;

  const stopDwell = (): void => {
    if (dwell !== undefined) timers.clear(dwell);
    dwell = undefined;
  };
  const stopGrace = (): void => {
    if (grace !== undefined) timers.clear(grace);
    grace = undefined;
  };
  const startGrace = (): void => {
    if (openId === undefined || grace !== undefined) return;
    grace = timers.set(() => {
      grace = undefined;
      if (onCard || target !== undefined) return;
      openId = undefined;
      onClose();
    }, graceMs);
  };

  return {
    get openId() {
      return openId;
    },
    over(id) {
      if (id === target) {
        if (id !== undefined && id === openId) stopGrace();
        return;
      }
      target = id;
      stopDwell();
      if (id === undefined) {
        startGrace();
        return;
      }
      if (id === openId) {
        stopGrace();
        return;
      }
      // A different slip: keep the current card until the new one opens.
      dwell = timers.set(() => {
        dwell = undefined;
        if (target !== id) return;
        stopGrace();
        openId = id;
        onOpen(id);
      }, dwellMs);
    },
    cardEnter() {
      onCard = true;
      stopGrace();
    },
    cardLeave() {
      onCard = false;
      if (target === undefined) startGrace();
    },
    closed() {
      openId = undefined;
      onCard = false;
      stopGrace();
    },
    cancel() {
      stopDwell();
      stopGrace();
      target = undefined;
    },
  };
}
