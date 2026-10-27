/**
 * System / Light / Dark (DESIGN.md: a toggle on the site). The choice lives in
 * `localStorage` under the same `readback:settings` document the extension
 * uses (`theme` field), validated by the core's own parser. An inline script in
 * each page's <head> applies it before first paint.
 */
// Settings parsing is the extension's own (pure, no engine): light enough for the first-paint bundle.
import { DEFAULT_SETTINGS, THEMES, parseSettings } from '@/state/settings';
import type { Theme } from '@/state/settings';

const KEY = 'readback:settings';

export type { Theme };

export function readTheme(): Theme {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return parseSettings(JSON.parse(raw)).theme;
  } catch {
    // Storage blocked or corrupt: follow the system.
  }
  return DEFAULT_SETTINGS.theme;
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  // The browser chrome follows the forced theme; "System" restores the media-query pair.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    m.dataset.system ??= m.content;
    m.content = theme === 'system' ? m.dataset.system : themeColorHex(theme);
  });
}

function themeColorHex(theme: Theme): string {
  return theme === 'light' ? '#f7f9fa' : '#0b0f13';
}

export function writeTheme(theme: Theme): void {
  try {
    const raw = localStorage.getItem(KEY);
    const current = raw ? parseSettings(JSON.parse(raw)) : { ...DEFAULT_SETTINGS };
    localStorage.setItem(KEY, JSON.stringify({ ...current, theme }));
  } catch {
    // Not persisted; still applied for this visit.
  }
}

export const nextTheme = (t: Theme): Theme => {
  const i = THEMES.indexOf(t);
  return THEMES[(i + 1) % THEMES.length] ?? 'system';
};

export const THEME_LABEL: Record<Theme, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};
