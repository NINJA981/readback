import { useEffect } from 'react';
import type { Settings } from '../engine/types';

/**
 * Applies the chosen theme to <html>. "system" removes the attribute so the
 * stylesheet's prefers-color-scheme rule decides. The DOM write is the effect;
 * nothing is mirrored into React state.
 */
export function useTheme(theme: Settings['theme']): void {
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);
}
