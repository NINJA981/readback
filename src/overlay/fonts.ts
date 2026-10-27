/**
 * Overlay fonts. `@font-face` is ignored inside a shadow root, so the two
 * subset faces (scripts/subset-overlay-fonts.py, about 26 KB together) are
 * added to the page's FontFaceSet from bytes embedded in the content script.
 * Bytes, not URLs: no request is made, the page's CSP cannot block them, and
 * the extension needs no web_accessible_resources. The overlay is Mona Sans
 * plus Geist Mono only (DESIGN.md "Three Hubots Rule"). If anything fails the
 * overlay falls back to system-ui and stays fully usable.
 */
import monaUrl from '../assets/fonts/mona-sans-overlay.woff2?inline';
import monoUrl from '../assets/fonts/geist-mono-overlay.woff2?inline';

let started = false;

function toBuffer(dataUri: string): ArrayBuffer {
  const base64 = dataUri.slice(dataUri.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** Idempotent. Never throws. */
export function loadOverlayFonts(doc: Document): void {
  if (started) return;
  started = true;
  try {
    const set = doc.fonts as FontFaceSet | undefined;
    if (!set || typeof FontFace === 'undefined') return;
    const faces = [
      new FontFace('Mona Sans Variable', toBuffer(monaUrl), { weight: '420 650', display: 'swap' }),
      new FontFace('Geist Mono Variable', toBuffer(monoUrl), { weight: '450', display: 'swap' }),
    ];
    for (const face of faces) {
      set.add(face);
      face.load().catch(() => undefined);
    }
  } catch {
    // System fonts it is.
  }
}
