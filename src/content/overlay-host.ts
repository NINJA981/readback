/**
 * The one shadow root Readback's page UI lives in (SPEC AC-G.4). The host
 * element is created lazily, so a page where nothing needs drawing never gets
 * an extra node. Tokens are injected into the shadow root's own stylesheet,
 * never into the page's.
 */
import tokensCss from '../styles/tokens.css?inline';
import overlayCss from '../styles/overlay.css?inline';
import { loadOverlayFonts } from '../overlay/fonts';

export const HOST_TAG = 'readback-overlay';
/** DESIGN.md z-index: the shadow host sits above everything. */
export const HOST_Z_INDEX = '2147483647';

declare const __RB_OPEN_SHADOW__: boolean | undefined;
/** True only in the e2e build (wxt.config.ts), so tests can see inside the shadow root. */
const openForTests = (): boolean => typeof __RB_OPEN_SHADOW__ !== 'undefined' && __RB_OPEN_SHADOW__;

export interface OverlayHost {
  readonly root: ShadowRoot;
  /** The host element, so click-outside checks can recognise events from inside the overlay. */
  readonly element: HTMLElement;
  /** Switches the overlay's colour set (the host page's theme, not the OS's). */
  setTheme(theme: 'light' | 'dark'): void;
  destroy(): void;
}

export function createOverlayHost(doc: Document): OverlayHost {
  const element = doc.createElement(HOST_TAG);
  element.style.cssText = `all: initial; position: fixed; inset: 0 auto auto 0; width: 0; height: 0; z-index: ${HOST_Z_INDEX};`;
  const root = element.attachShadow({ mode: openForTests() ? 'open' : 'closed' });
  const style = doc.createElement('style');
  style.textContent = `${tokensCss}\n${overlayCss}`;
  root.append(style);
  doc.documentElement.append(element);
  loadOverlayFonts(doc);
  return {
    root,
    element,
    setTheme(theme) {
      element.dataset.theme = theme;
    },
    destroy() {
      element.remove();
    },
  };
}
