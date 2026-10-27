/** Small shared pieces: keycap, presence (exit animation), reduced-motion. */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export function Keycap({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <kbd className="rb-keycap" {...(label ? { 'aria-label': label } : { 'aria-hidden': true })}>
      {children}
    </kbd>
  );
}

/**
 * Keeps an element mounted for `exitMs` after `present` turns false, so its
 * exit animation can play. Returns `rendered` (mount it) and `open` (it is
 * not leaving). Under reduced motion the exit is skipped.
 */
export function usePresence(
  present: boolean,
  exitMs: number,
): { rendered: boolean; open: boolean } {
  const [leaving, setLeaving] = useState(false);
  const [wasPresent, setWasPresent] = useState(present);
  if (present !== wasPresent) {
    setWasPresent(present);
    setLeaving(!present && !prefersReducedMotion());
  }
  useEffect(() => {
    if (!leaving) return undefined;
    const id = setTimeout(() => {
      setLeaving(false);
    }, exitMs);
    return () => {
      clearTimeout(id);
    };
  }, [leaving, exitMs]);
  return { rendered: present || leaving, open: present };
}

export function prefersReducedMotion(): boolean {
  try {
    return globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Keeps the last non-empty value, so an exiting element still has content to show. */
export function useLastValue<T>(value: T | undefined): T | undefined {
  const [last, setLast] = useState(value);
  if (value !== undefined && value !== last) setLast(value);
  return value ?? last;
}

/** Keyboard focusables inside `root`, for the Tab loop in dialogs. */
export function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
  );
}

/** Tab and Shift+Tab stay inside a dialog. */
export function trapTab(event: React.KeyboardEvent, root: HTMLElement | null): void {
  if (event.key !== 'Tab' || !root) return;
  const items = focusables(root);
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return;
  const active =
    root.getRootNode() instanceof ShadowRoot
      ? (root.getRootNode() as ShadowRoot).activeElement
      : null;
  if (event.shiftKey && (active === first || active === root)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}
