import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

/**
 * Screenshot gallery: renders the product's real components (popup, options,
 * the overlay's pill, ledger, card and chip) in every state, including the ones
 * a live browser cannot easily reach (model failures, host-refused fixes, an
 * overflowing ledger). Not shipped: nothing under gallery/ is in the extension.
 */
export default defineConfig({
  root: import.meta.dirname,
  plugins: [tailwindcss()],
  build: { outDir: resolve(import.meta.dirname, '..', '.gallery'), emptyOutDir: true },
});
