import { createRoot } from 'react-dom/client';
import { readTheme, applyTheme } from '../shared/theme';
import { App, Boundary } from './App';

applyTheme(readTheme());

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <Boundary>
      <App />
    </Boundary>,
  );
}

// Offline: a small service worker precaches the app's own files (generated at build time).
// It handles same-origin GET requests only. Skipped in dev, where Vite serves modules.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
      // No service worker (private mode, blocked): the app still works while online.
    });
  });
}
