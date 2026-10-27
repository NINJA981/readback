import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import { pwaPlugin } from './scripts/pwa-plugin.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoSrc = resolve(here, '..', 'src');
const norm = (p: string): string => p.replaceAll('\\', '/');

/**
 * Bare imports made by files in the repo's `src/` (the engine imports
 * `chrono-node`) are resolved from this package, so `site/` builds with only
 * its own `pnpm install` and never depends on the repo root's node_modules.
 */
function resolveRepoDeps(): Plugin {
  return {
    name: 'readback-site:resolve-repo-deps',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer || !norm(importer).startsWith(norm(repoSrc))) return null;
      if (source.startsWith('.') || source.startsWith('/') || source.startsWith('\0')) return null;
      return this.resolve(source, resolve(here, 'index.html'), { ...options, skipSelf: true });
    },
  };
}

/** `/app` and `/app?x` become `/app/` in dev and preview (static hosts do the same). */
function appSlash(): Plugin {
  type Next = () => void;
  type Res = { statusCode: number; setHeader(k: string, v: string): void; end(): void };
  const redirect = (req: { url?: string }, res: Res, next: Next): void => {
    const url = req.url ?? '';
    if (url === '/app' || url.startsWith('/app?')) {
      res.statusCode = 301;
      res.setHeader('Location', url.replace('/app', '/app/'));
      res.end();
      return;
    }
    next();
  };
  return {
    name: 'readback-site:app-slash',
    configureServer(server) {
      server.middlewares.use(redirect);
    },
    configurePreviewServer(server) {
      server.middlewares.use(redirect);
    },
  };
}

const pkg = JSON.parse(readFileSync(resolve(here, 'package.json'), 'utf8')) as { version: string };

export default defineConfig({
  root: here,
  base: './',
  publicDir: 'public',
  plugins: [resolveRepoDeps(), react(), appSlash(), pwaPlugin()],
  resolve: {
    alias: { '@': repoSrc },
  },
  define: {
    __SITE_VERSION__: JSON.stringify(pkg.version),
  },
  server: { fs: { allow: [resolve(here, '..')] } },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        main: resolve(here, 'index.html'),
        app: resolve(here, 'app/index.html'),
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
