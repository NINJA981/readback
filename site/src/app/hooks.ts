import { useEffect, useState, useSyncExternalStore } from 'react';

export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = matchMedia(query);
      mq.addEventListener('change', cb);
      return () => {
        mq.removeEventListener('change', cb);
      };
    },
    () => matchMedia(query).matches,
    () => false,
  );
}

export const useReducedMotion = (): boolean => useMedia('(prefers-reduced-motion: reduce)');

export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('online', cb);
      window.addEventListener('offline', cb);
      return () => {
        window.removeEventListener('online', cb);
        window.removeEventListener('offline', cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

/**
 * How far the on-screen keyboard covers the bottom of the layout viewport, so
 * the guard sheet sits above it (iOS does not resize the layout viewport).
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = (): void => {
      setInset(Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop))));
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return inset;
}

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface InstallState {
  /** The browser offered an install prompt (Chromium). */
  available: boolean;
  installed: boolean;
  prompt: () => Promise<void>;
}

export function useInstall(): InstallState {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(
    () => matchMedia('(display-mode: standalone)').matches,
  );
  useEffect(() => {
    const onPrompt = (e: Event): void => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const onInstalled = (): void => {
      setInstalled(true);
      setEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  return {
    available: event !== null,
    installed,
    async prompt() {
      if (!event) return;
      await event.prompt();
      await event.userChoice;
      setEvent(null);
    },
  };
}

/**
 * Counts network requests the page makes after the app has finished loading,
 * from the browser's own resource timeline. It is shown in the footer; if it
 * ever leaves 0 the user sees the real number.
 */
export function useLateRequests(ready: boolean): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!ready || typeof PerformanceObserver === 'undefined') return;
    // Let the app's own lazy files (fonts first used by a card) settle first.
    let obs: PerformanceObserver | undefined;
    const t = window.setTimeout(() => {
      obs = new PerformanceObserver((list) => {
        setCount((c) => c + list.getEntries().length);
      });
      try {
        obs.observe({ type: 'resource', buffered: false });
      } catch {
        obs = undefined;
      }
    }, 800);
    return () => {
      window.clearTimeout(t);
      obs?.disconnect();
    };
  }, [ready]);
  return count;
}

export function useSessionCount(): number {
  const [n] = useState(() => {
    try {
      const prev = Number(localStorage.getItem('readback:visits') ?? '0') || 0;
      localStorage.setItem('readback:visits', String(prev + 1));
      return prev + 1;
    } catch {
      return 1;
    }
  });
  return n;
}
