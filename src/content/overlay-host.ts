/**
 * The one shadow root Readback's page UI lives in (SPEC AC-G.4). The host
 * element is created lazily, so a page where nothing needs drawing never gets
 * an extra node. Tokens are injected into the shadow root's own stylesheet,
 * never into the page's.
 */
import tokensCss from '../styles/tokens.css?inline';
import overlayCss from '../styles/overlay.css?inline';

export const HOST_TAG = 'readback-overlay';
/** DESIGN.md z-index: the shadow host sits above everything. */
export const HOST_Z_INDEX = '2147483647';

export interface OverlayHost {
  readonly root: ShadowRoot;
  /** Switches the overlay's colour set (the host page's theme, not the OS's). */
  setTheme(theme: 'light' | 'dark'): void;
  destroy(): void;
}

export function createOverlayHost(doc: Document): OverlayHost {
  const element = doc.createElement(HOST_TAG);
  element.style.cssText = `all: initial; position: fixed; inset: 0 auto auto 0; width: 0; height: 0; z-index: ${HOST_Z_INDEX};`;
  const root = element.attachShadow({ mode: 'closed' });
  const style = doc.createElement('style');
  style.textContent = `${tokensCss}\n${overlayCss}`;
  root.append(style);
  doc.documentElement.append(element);
  return {
    root,
    setTheme(theme) {
      element.dataset.theme = theme;
    },
    destroy() {
      element.remove();
    },
  };
}
