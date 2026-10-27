/**
 * The overlay's UI state and the actions its components call. The state is
 * plain data (no DOM nodes, no extension APIs), so the same components render
 * in Gmail, on any page through the selection adapter, in the popup gallery
 * and in the web playground.
 */
import type { RectLike } from '../dom/geometry';

export type OverlayTheme = 'light' | 'dark';

export interface CardState {
  flagId: string;
  /** hover opens after the dwell; keyboard moves focus into the card. */
  via: 'hover' | 'keyboard';
  /** First client rect of the slip; the card anchors below it. */
  anchor: RectLike;
  /** Set when the host refused the edit. */
  notice?: { kind: 'copied' | 'failed'; replacement: string; fixIndex: number };
}

export interface OverlayUi {
  theme: OverlayTheme;
  /** Editor rect clipped to the viewport; the pill docks inside its bottom-right corner. */
  dock: RectLike | undefined;
  viewport: { width: number; height: number };
  card: CardState | undefined;
  ledgerOpen: boolean;
}

export interface OverlayActions {
  /** Applies fix `index` of the flag through the editor's own input path. */
  fix: (flagId: string, index: number) => void;
  ignore: (flagId: string) => void;
  neverFlag: (flagId: string) => void;
  closeCard: () => void;
  /** Pointer entered or left the card, for the hover grace period. */
  cardPointer: (inside: boolean) => void;
  toggleLedger: () => void;
  closeLedger: () => void;
  confirmAsk: (id: string) => void;
  dismissAsk: (id: string) => void;
  restoreDismissed: () => void;
  answerInline: (id: string) => void;
  /** Opens the card for a slip from the ledger or the pill. */
  jumpToSlip: (flagId: string) => void;
}

export const INITIAL_UI: OverlayUi = {
  theme: 'light',
  dock: undefined,
  viewport: { width: 1280, height: 800 },
  card: undefined,
  ledgerOpen: false,
};
