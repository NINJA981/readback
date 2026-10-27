import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// ADR-0001 §Permissions and manifest, amended by ADR-0002 (app at repo root).
// The only host permission is Gmail. Other sites are reached through activeTab
// after a user gesture (the "Use as Readback context" menu item).
export default defineConfig({
  srcDir: 'src',
  imports: false,
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: ({ browser }) => ({
    name: 'Readback',
    description: "Spellcheck that has read the thread you're replying to. Runs on your device.",
    permissions: ['storage', 'contextMenus', 'activeTab', 'scripting'],
    host_permissions: ['https://mail.google.com/*'],
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
    commands: {
      _execute_action: {
        suggested_key: { default: 'Alt+Shift+R' },
        description: 'Open Readback',
      },
      'next-slip': {
        suggested_key: { default: 'Alt+Shift+J' },
        description: 'Open the next slip in this reply',
      },
      'open-ledger': {
        suggested_key: { default: 'Alt+Shift+L' },
        description: 'Open the ask ledger for this reply',
      },
    },
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: { id: 'readback@readback.local', strict_min_version: '140.0' },
          },
        }
      : {}),
  }),
});
