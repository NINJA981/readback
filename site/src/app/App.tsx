/**
 * The web app: paste the thread you're replying to, type your reply, and watch
 * the name, number and date guards squiggle with one-tap fixes while the ask
 * pill ticks off live. The checks are the extension's own engine
 * (`../shared/engine` re-exports the repo's `src/core`); this file only draws
 * them and moves text around.
 */
import {
  Component,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { DEFAULT_SETTINGS, parseSettings, setGuard, setTheme } from '@/state/settings';
import type { IgnoreList } from '../shared/engine';
import type * as Engine from '../shared/engine';
import { hvhPath } from '../shared/line';
import { SAMPLES, sampleById, sampleInput } from '../shared/samples';
import { locateCitation } from '../shared/snippet';
import { createGhost, playGhost } from '../shared/swap';
import { applyTheme, writeTheme } from '../shared/theme';
import type { Theme } from '../shared/theme';
import { Editor } from './Editor';
import type { EditorHandle, Mark } from './Editor';
import { Icon } from './Icon';
import { AskLedger, GuardCard, SlipList } from './Panels';
import { Palette } from './Palette';
import type { Command } from './Palette';
import { SettingsDialog } from './SettingsDialog';
import {
  useInstall,
  useKeyboardInset,
  useLateRequests,
  useMedia,
  useOnline,
  useReducedMotion,
  useSessionCount,
} from './hooks';
import {
  EMPTY_DRAFT,
  MAX_THREAD_CHARS,
  canShareLink,
  clearDraftStorage,
  decodeShare,
  encodeShare,
  loadDraft,
  readQuery,
  saveDraft,
  writeQuery,
} from './model';
import type { Draft } from './model';

type Eng = typeof Engine;
type Settings = Engine.Settings;

const GUARD_NAME = {
  name: 'the names guard',
  number: 'the numbers guard',
  date: 'the dates guard',
  asks: 'the asks list',
} as const;

/** The Apple command key on Apple platforms, Ctrl elsewhere. */
const MOD_KEY = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent) ? '⌘' : 'Ctrl';

// ---- persistence of settings (the extension's own keys and parsers) -----------------

const SETTINGS_STORE = 'readback:settings';
const IGNORE_STORE = 'readback:ignore';

function readSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORE);
    return raw ? parseSettings(JSON.parse(raw)) : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function writeStore(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or blocked storage: the change still applies to this visit.
  }
}

// ---- engine loading ------------------------------------------------------------------

type EngineState = { status: 'loading' } | { status: 'ready'; eng: Eng } | { status: 'error' };

function useEngine(attempt: number): EngineState {
  const [state, setState] = useState<EngineState>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    import('../shared/engine').then(
      (eng) => {
        if (live) setState({ status: 'ready', eng });
      },
      () => {
        if (live) setState({ status: 'error' });
      },
    );
    return () => {
      live = false;
    };
  }, [attempt]);
  return state;
}

// ---- error boundary -------------------------------------------------------------------

export class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Deliberately not logged: the message could contain pasted text (SPEC §8).
  }
  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="notice notice--error" role="alert">
        <Icon name="circle-alert" />
        <div>
          <p className="t-h3">The checker stopped.</p>
          <p className="muted t-ui">
            Something unexpected happened, so the app paused instead of guessing. Your text is still
            saved in this tab. Reloading restores it.
          </p>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => {
              location.reload();
            }}
          >
            <Icon name="rotate-ccw" /> Reload
          </button>
        </div>
      </div>
    );
  }
}

// ---- small pieces ---------------------------------------------------------------------

function useThrottled(text: string, ms: number): string {
  const [shown, setShown] = useState(text);
  const last = useRef(0);
  useEffect(() => {
    const wait = Math.max(0, last.current + ms - performance.now());
    const t = window.setTimeout(() => {
      last.current = performance.now();
      setShown(text);
    }, wait);
    return () => {
      window.clearTimeout(t);
    };
  }, [text, ms]);
  return shown;
}

interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

interface Note {
  text: string;
  undo: () => void;
}

// ---- the app --------------------------------------------------------------------------

export function App(): React.JSX.Element {
  const [attempt, setAttempt] = useState(0);
  const engine = useEngine(attempt);
  const eng = engine.status === 'ready' ? engine.eng : null;

  const reduced = useReducedMotion();
  const wide = useMedia('(min-width: 768px)');
  const split = useMedia('(min-width: 960px)');
  const online = useOnline();
  const keyboard = useKeyboardInset();
  const install = useInstall();
  const visits = useSessionCount();

  const [settings, setSettings] = useState<Settings>(() => {
    const s = readSettings();
    const off = readQuery().off;
    return off.length === 0
      ? s
      : {
          ...s,
          guards: {
            name: s.guards.name && !off.includes('name'),
            number: s.guards.number && !off.includes('number'),
            date: s.guards.date && !off.includes('date'),
            asks: s.guards.asks && !off.includes('asks'),
          },
        };
  });
  const [ignore, setIgnore] = useState<IgnoreList>({ names: [], numbers: [] });
  const [draft, setDraftState] = useState<Draft>(() => {
    const q = readQuery();
    const sample = sampleById(q.sample);
    if (sample && q.sample) {
      return {
        thread: sample.message,
        reply: sample.draft,
        sender: '',
        sentOn: sample.sentAt,
        sampleId: sample.id,
      };
    }
    return loadDraft();
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [threadOpen, setThreadOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [card, setCard] = useState<{ id: string; via: 'tap' | 'hover' | 'key' | 'list' } | null>(
    null,
  );
  const [swap, setSwap] = useState<{ start: number; end: number; from: string; to: string } | null>(
    null,
  );
  const [installDismissed, setInstallDismissed] = useState(() => {
    try {
      return localStorage.getItem('readback:install-dismissed') === '1';
    } catch {
      return false;
    }
  });
  const [fixesDone, setFixesDone] = useState(0);

  const threadRef = useRef<EditorHandle>(null);
  const replyRef = useRef<EditorHandle>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const cancelGhost = useRef<(() => void) | null>(null);
  const toastId = useRef(0);
  // Where keyboard focus was when a card was opened from the Slips list, so closing returns there.
  const cardOpener = useRef<HTMLElement | null>(null);
  const cardNow = useRef(card);
  cardNow.current = card;

  // Debounce the thread: the context (harvest, dates) is rebuilt only when typing pauses.
  const [threadForContext, setThreadForContext] = useState(draft.thread);
  useEffect(() => {
    const t = window.setTimeout(
      () => {
        setThreadForContext(draft.thread);
      },
      draft.sampleId ? 0 : 140,
    );
    return () => {
      window.clearTimeout(t);
    };
  }, [draft.thread, draft.sampleId]);

  const sample = sampleById(draft.sampleId);
  const tooLong =
    threadForContext.length > MAX_THREAD_CHARS || draft.thread.length > MAX_THREAD_CHARS;

  // Persist the boxes for this tab, and sample/guards in the URL.
  useEffect(() => {
    saveDraft(draft);
  }, [draft]);
  useEffect(() => {
    const off = (Object.keys(settings.guards) as (keyof Settings['guards'])[]).filter(
      (k) => !settings.guards[k],
    );
    writeQuery(draft.sampleId, off);
  }, [draft.sampleId, settings.guards]);
  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  // Ignore list: loaded with the engine (its parser lives there).
  useEffect(() => {
    if (!eng) return;
    try {
      const raw = localStorage.getItem(IGNORE_STORE);
      setIgnore(eng.parseIgnoreList(raw ? JSON.parse(raw) : null));
    } catch {
      setIgnore(eng.EMPTY_IGNORE);
    }
  }, [eng]);

  // A share link in the fragment: read once, then removed from the address bar.
  useEffect(() => {
    if (!location.hash.startsWith('#t=')) return;
    void decodeShare(location.hash).then((d) => {
      history.replaceState(null, '', location.pathname + location.search);
      if (d) setDraftState(d);
    });
  }, []);

  // ---- the compose session (the extension's state machine) ----------------------------
  const replyNow = useRef(draft.reply);
  replyNow.current = draft.reply;
  const threadStates = useRef(new Map<string, Engine.SessionSnapshot['threadState']>());

  const session = useMemo(() => {
    if (!eng || tooLong) return null;
    const input: Engine.ContextInput = sample
      ? {
          ...sampleInput(sample),
          message: threadForContext,
          ...(draft.sentOn ? { sentAt: draft.sentOn } : {}),
        }
      : {
          source: 'playground',
          threadId: 'paste',
          message: threadForContext,
          ...(draft.sentOn ? { sentAt: draft.sentOn } : {}),
          ...(draft.sender.trim()
            ? { sender: { name: draft.sender.trim(), role: 'sender' as const } }
            : {}),
        };
    const context = eng.createContext(input, new Date());
    const savedThreadState = threadStates.current.get(context.threadKey);
    const s = eng.createComposeSession({
      context,
      settings,
      ignore,
      ...(savedThreadState ? { threadState: savedThreadState } : {}),
      effects: {
        saveThreadState: (key, state) => {
          threadStates.current.set(key, state);
        },
      },
    });
    s.setDraft(replyNow.current);
    return s;
    // The session is rebuilt when the thread, the sample or the date changes. Settings,
    // ignore list and reply are pushed into it below instead.
  }, [eng, tooLong, threadForContext, draft.sampleId, draft.sentOn, draft.sender]);

  useEffect(() => {
    session?.setSettings(settings);
  }, [session, settings]);
  useEffect(() => {
    session?.setIgnore(ignore);
  }, [session, ignore]);
  useEffect(() => {
    session?.setDraft(draft.reply);
  }, [session, draft.reply]);

  const noop = useCallback(() => () => undefined, []);
  const snap = useSyncExternalStore(
    session ? (listener) => session.subscribe(listener) : noop,
    session ? () => session.getSnapshot() : () => null,
  );

  const flags = snap?.result.flags ?? [];
  const activeFlag = card ? flags.find((f) => f.id === card.id) : undefined;

  // The card closes by itself when its slip is gone (fixed, edited away, ignored).
  useEffect(() => {
    if (card && !activeFlag) setCard(null);
  }, [card, activeFlag]);

  // ---- helpers -----------------------------------------------------------------------
  const say = useCallback((text: string, action?: Toast['action']) => {
    toastId.current += 1;
    setToast({ id: toastId.current, text, ...(action ? { action } : {}) });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => {
      setToast(null);
    }, 6000);
    return () => {
      window.clearTimeout(t);
    };
  }, [toast]);
  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => {
      setNote(null);
    }, 6000);
    return () => {
      window.clearTimeout(t);
    };
  }, [note]);

  const setReply = (reply: string): void => {
    setDraftState((d) => ({ ...d, reply }));
  };
  const setThread = (thread: string): void => {
    setDraftState((d) => ({ ...d, thread, sampleId: null }));
  };

  const loadSample = (id: string): void => {
    const s = sampleById(id);
    if (!s) return;
    setCard(null);
    setSwap(null);
    setNote(null);
    setDraftState({
      thread: s.message,
      reply: s.draft,
      sender: '',
      sentOn: s.sentAt,
      sampleId: s.id,
    });
    setThreadOpen(false);
  };

  // ---- applying a fix ------------------------------------------------------------------
  const replaceRange = useCallback(
    async (start: number, end: number, replacement: string): Promise<void> => {
      const ta = replyRef.current?.textarea;
      if (!ta || !eng) return;
      const outcome = await eng.applyFixToField({
        doc: document,
        field: ta,
        start,
        end,
        replacement,
        clipboard: navigator.clipboard,
      });
      if (outcome !== 'inserted') {
        // Our own text box: edit it directly (the clipboard path is for pages we do not own).
        ta.setRangeText(replacement, start, end, 'end');
        setReply(ta.value);
      }
    },
    [eng],
  );

  const applyFix = useCallback(
    async (flag: Engine.Flag, index: number): Promise<void> => {
      const fix = flag.fixes[index];
      if (!fix) return;
      const { start, end } = flag.draftSpan;
      const original = flag.found;
      setCard(null);
      await replaceRange(start, end, fix.replacement);
      setSwap({ start, end: start + fix.replacement.length, from: original, to: fix.replacement });
      setFixesDone((n) => n + 1);
      setNote({
        text:
          eng?.fixedLabel(fix.replacement).replace(' · Undo Ctrl+Z', '') ??
          `Fixed: ${fix.replacement}`,
        undo: () => {
          setNote(null);
          setSwap(null);
          void replaceRange(start, start + fix.replacement.length, original);
        },
      });
    },
    [eng, replaceRange],
  );

  // Swap-back ghost, once the fixed text is in the mirror.
  useLayoutEffect(() => {
    cancelGhost.current?.();
    cancelGhost.current = null;
    if (!swap) return;
    if (reduced) {
      setSwap(null);
      return;
    }
    const handle = replyRef.current;
    const box = handle?.box;
    const mirror = handle?.mirror;
    const rect = handle?.rectOf('fixed');
    if (!box || !mirror || !rect) {
      setSwap(null);
      return;
    }
    const br = box.getBoundingClientRect();
    const ghost = createGhost({
      container: box,
      host: mirror,
      rect: {
        left: rect.left - br.left - box.clientLeft,
        top: rect.top - br.top - box.clientTop,
        width: rect.width,
        height: rect.height,
      },
      from: swap.from,
      to: swap.to,
      background: getComputedStyle(box).backgroundColor,
    });
    if (!ghost) {
      setSwap(null);
      return;
    }
    cancelGhost.current = playGhost(ghost, () => {
      cancelGhost.current = null;
      setSwap(null);
    });
    return () => {
      cancelGhost.current?.();
      cancelGhost.current = null;
    };
  }, [swap, reduced]);

  // ---- card placement and the readback line -------------------------------------------
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const [line, setLine] = useState<{
    d: string;
    a: { x: number; y: number };
    b: { x: number; y: number };
  } | null>(null);

  const measure = useCallback((): void => {
    if (!eng || !activeFlag) {
      setPlace(null);
      setLine(null);
      return;
    }
    const slip = replyRef.current?.rectOf(activeFlag.id);
    if (!slip) {
      setPlace(null);
      setLine(null);
      return;
    }
    if (wide) {
      const p = eng.placeCard(
        slip,
        { width: 320, height: 210 },
        { width: innerWidth, height: innerHeight },
      );
      setPlace({ left: p.left, top: p.top });
    } else {
      setPlace(null);
    }
    const tok = threadRef.current?.rectOf('cite');
    const main = mainRef.current;
    if (split && tok && main) {
      const m = main.getBoundingClientRect();
      const inView = (r: DOMRect): boolean => r.bottom > 0 && r.top < innerHeight;
      if (inView(slip) && inView(tok)) {
        const a = { x: slip.left + slip.width / 2 - m.left, y: slip.bottom + 6 - m.top };
        const b = { x: tok.right - m.left, y: tok.bottom + 2 - m.top };
        const threadBox = threadRef.current?.box?.getBoundingClientRect();
        const replyBox = replyRef.current?.box?.getBoundingClientRect();
        const midX =
          threadBox && replyBox ? (threadBox.right + replyBox.left) / 2 - m.left : (a.x + b.x) / 2;
        setLine({ d: hvhPath(a, b, midX), a, b });
        return;
      }
    }
    setLine(null);
  }, [eng, activeFlag, wide, split]);

  useLayoutEffect(measure, [measure, draft.reply, draft.thread, threadOpen]);
  useEffect(() => {
    if (!activeFlag) return;
    let raf = 0;
    const on = (): void => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', on);
      window.removeEventListener('resize', on);
    };
  }, [activeFlag, measure]);

  // Outside pointer closes the card.
  useEffect(() => {
    if (!card) return;
    const onDown = (e: PointerEvent): void => {
      const t = e.target as Element | null;
      if (t?.closest('.gcard, .row, .editor')) return;
      setCard(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('pointerdown', onDown);
    };
  }, [card]);

  // Ctrl/Cmd+K opens the command palette from anywhere, including inside a text box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // J / K step through slips when no field has focus (DESIGN.md shortcut map).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'TEXTAREA' ||
          t.tagName === 'INPUT' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      )
        return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'l') {
        const el = document.getElementById('ledger');
        if (!el) return;
        e.preventDefault();
        el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
        el.focus({ preventScroll: true });
        return;
      }
      if (flags.length === 0) return;
      if (e.key !== 'j' && e.key !== 'k') return;
      const i = flags.findIndex((f) => f.id === card?.id);
      const next = e.key === 'j' ? (i + 1) % flags.length : (i - 1 + flags.length) % flags.length;
      const f = flags[next];
      if (f) setCard({ id: f.id, via: 'key' });
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [flags, card, reduced]);

  // ---- marks ----------------------------------------------------------------------------
  const replyMarks: Mark[] = useMemo(() => {
    const m: Mark[] = flags.map((f) => ({
      id: f.id,
      start: f.draftSpan.start,
      end: f.draftSpan.end,
      kind: 'slip',
      active: f.id === card?.id,
    }));
    if (swap) m.push({ id: 'fixed', start: swap.start, end: swap.end, kind: 'fixed' });
    return m;
  }, [flags, card, swap]);

  const threadMarks: Mark[] = useMemo(() => {
    if (!activeFlag) return [];
    const at = locateCitation(draft.thread, activeFlag.citation.line, activeFlag.citation.text);
    return at ? [{ id: 'cite', start: at.start, end: at.end, kind: 'cited' }] : [];
  }, [activeFlag, draft.thread]);

  // ---- derived text ---------------------------------------------------------------------
  const pill = snap?.pill;
  const announce = useThrottled(pill?.announcement ?? '', 2000);
  const lateRequests = useLateRequests(eng !== null);
  const hasThread = draft.thread.trim().length > 0;
  const hasText = hasThread || draft.reply.trim().length > 0;
  const harvest = snap?.context.harvested;
  const askCount = snap?.result.asks.filter((a) => a.state !== 'dismissed').length ?? 0;

  const showInstall =
    !install.installed && install.available && !installDismissed && (visits >= 2 || fixesDone >= 1);

  // ---- actions -------------------------------------------------------------------------
  const clearAll = (): void => {
    const snapshot = { draft, settings, ignore };
    try {
      for (const k of Object.keys(localStorage))
        if (k.startsWith('readback:')) localStorage.removeItem(k);
    } catch {
      // ignore
    }
    clearDraftStorage();
    setDraftState(EMPTY_DRAFT);
    setSettings({ ...DEFAULT_SETTINGS });
    setIgnore({ names: [], numbers: [] });
    applyTheme('system');
    setSettingsOpen(false);
    setCard(null);
    say('Cleared everything stored in this browser.', {
      label: 'Undo',
      run: () => {
        setDraftState(snapshot.draft);
        setSettings(snapshot.settings);
        setIgnore(snapshot.ignore);
        writeStore(SETTINGS_STORE, snapshot.settings);
        writeStore(IGNORE_STORE, snapshot.ignore);
        applyTheme(snapshot.settings.theme);
        setToast(null);
      },
    });
  };

  const updateSettings = (next: Settings): void => {
    setSettings(next);
    writeStore(SETTINGS_STORE, next);
  };
  const updateIgnore = (next: IgnoreList): void => {
    setIgnore(next);
    writeStore(IGNORE_STORE, next);
  };

  const hitFlag = (id: string, via: 'tap' | 'hover'): void => {
    setCard({ id, via });
  };

  /** Closes the card. From the keyboard, focus goes back to the opener (the slip row) or the reply. */
  const closeCard = (): void => {
    const via = cardNow.current?.via;
    setCard(null);
    const opener = cardOpener.current;
    cardOpener.current = null;
    // After React has re-rendered: ignoring a slip removes its row, so the opener may be gone.
    window.requestAnimationFrame(() => {
      const back =
        opener?.isConnected === true
          ? opener
          : via === 'list' || via === 'key'
            ? (replyRef.current?.textarea ?? null)
            : null;
      back?.focus({ preventScroll: true });
    });
  };

  const stepSlip = (dir: 1 | -1): void => {
    if (flags.length === 0) {
      say('No slips to step through.');
      return;
    }
    const i = flags.findIndex((f) => f.id === card?.id);
    const next = dir === 1 ? (i + 1) % flags.length : (i - 1 + flags.length) % flags.length;
    const f = flags[next];
    if (f) {
      cardOpener.current = null;
      setCard({ id: f.id, via: 'key' });
    }
  };

  const copyShareLink = (): void => {
    void encodeShare(draft).then(
      (url) =>
        navigator.clipboard.writeText(url).then(
          () => {
            say('Share link copied. It contains your text.');
          },
          () => {
            say('Couldn’t copy the link. Your browser blocked the clipboard.');
          },
        ),
      () => {
        say('Couldn’t build the link.');
      },
    );
  };

  /** Saves the current check as a local file. Built in the page; nothing leaves the browser. */
  const exportJson = (): void => {
    if (!snap) {
      say('Nothing to export yet. Paste a thread first.');
      return;
    }
    const data = {
      app: 'readback',
      exportedAt: new Date().toISOString(),
      thread: draft.thread,
      reply: draft.reply,
      slips: snap.result.flags.map((f) => ({
        guard: f.guard,
        found: f.found,
        expected: f.expected,
        message: f.message,
        fixes: f.fixes.map((x) => x.replacement),
      })),
      asks: snap.result.asks.map((a) => ({ text: a.text, state: a.state })),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'readback-result.json';
    a.click();
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
    say('Saved readback-result.json to your downloads.');
  };

  const clearThread = (): void => {
    const prev = draft;
    setDraftState((d) => ({ ...d, thread: '', sampleId: null, sender: '', sentOn: '' }));
    setThreadOpen(true);
    // The button that called this may remove itself; hand focus to the field that is now empty.
    threadRef.current?.textarea?.focus({ preventScroll: true });
    say('Thread cleared.', {
      label: 'Undo',
      run: () => {
        setDraftState(prev);
        setToast(null);
      },
    });
  };

  const clearReply = (): void => {
    const prev = draft.reply;
    setReply('');
    setSwap(null);
    setCard(null);
    replyRef.current?.textarea?.focus({ preventScroll: true });
    say('Reply cleared.', {
      label: 'Undo',
      run: () => {
        setReply(prev);
        setToast(null);
      },
    });
  };

  const scrollToLedger = (): void => {
    const el = document.getElementById('ledger');
    el?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    el?.focus({ preventScroll: true });
  };

  const commands: Command[] = [
    ...SAMPLES.map((smp) => ({
      id: `sample-${smp.id}`,
      label: `Load sample: ${smp.title}`,
      keywords: 'sample thread example',
      run: () => {
        loadSample(smp.id);
      },
    })),
    { id: 'clear-thread', label: 'Clear thread', run: clearThread },
    { id: 'clear-reply', label: 'Clear reply', run: clearReply },
    {
      id: 'next-slip',
      label: 'Next slip',
      keywords: 'slip squiggle flag',
      hint: ['J'],
      run: () => {
        stepSlip(1);
      },
    },
    {
      id: 'prev-slip',
      label: 'Previous slip',
      keywords: 'slip squiggle flag',
      hint: ['K'],
      run: () => {
        stepSlip(-1);
      },
    },
    { id: 'ledger', label: 'Open ledger', keywords: 'asks list', hint: ['L'], run: scrollToLedger },
    ...(['name', 'number', 'date', 'asks'] as const).map((key) => ({
      id: `guard-${key}`,
      label: `${settings.guards[key] ? 'Turn off' : 'Turn on'} ${GUARD_NAME[key]}`,
      keywords: 'guard toggle check',
      run: () => {
        updateSettings(setGuard(settings, key, !settings.guards[key]));
      },
    })),
    { id: 'share', label: 'Copy share link', keywords: 'url', run: copyShareLink },
    {
      id: 'export',
      label: 'Export result as JSON',
      keywords: 'download save file',
      run: exportJson,
    },
    ...(['system', 'light', 'dark'] as const).map((t) => ({
      id: `theme-${t}`,
      label: `Theme: ${t === 'system' ? 'System' : t === 'light' ? 'Light' : 'Dark'}`,
      keywords: 'appearance colour color',
      run: () => {
        updateSettings(setTheme(settings, t));
        writeTheme(t);
      },
    })),
    {
      id: 'settings',
      label: 'Open settings',
      keywords: 'options preferences',
      run: () => {
        setSettingsOpen(true);
      },
    },
  ];

  // ---- render ---------------------------------------------------------------------------
  const loading = engine.status === 'loading';
  const empty = !hasThread;
  const stacked = !split;
  const collapsed = stacked && hasThread && !threadOpen && !tooLong;

  return (
    <div className="app" data-theme-root>
      <header className="topbar">
        <div className="topbar__in">
          <a className="topbar__back" href="../" aria-label="Readback, back to the site">
            <Icon name="arrow-left" />
            <span className="wordmark">Readback</span>
          </a>
          <div className="topbar__actions">
            {!online && (
              <span className="chip chip--offline" role="status">
                <Icon name="wifi-off" size={14} /> Offline
              </span>
            )}
            <button
              type="button"
              className="btn btn--ghost"
              aria-keyshortcuts="Control+K Meta+K"
              onClick={() => {
                setPaletteOpen(true);
              }}
            >
              Commands
              <span className="topbar__kbd" aria-hidden="true">
                <span className="keycap">{MOD_KEY}</span>
                <span className="keycap">K</span>
              </span>
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setSettingsOpen(true);
              }}
            >
              <Icon name="sliders-horizontal" /> Settings
            </button>
          </div>
        </div>
      </header>

      {!online && (
        <p className="banner" role="status">
          You’re offline. Everything here still works, because the checker runs on this device.
        </p>
      )}

      <main className="main" ref={mainRef} id="main">
        <div className="intro">
          <h1 className="t-h1">Try Readback in your browser</h1>
          <p className="muted t-ui" id="privacy-line">
            Runs entirely in your browser. Nothing is uploaded.
          </p>
          <div className="guards" role="group" aria-label="Checks">
            {(
              [
                ['name', 'Names'],
                ['number', 'Numbers'],
                ['date', 'Dates'],
                ['asks', 'Asks'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className="seg guards__seg"
                aria-pressed={settings.guards[key]}
                onClick={() => {
                  updateSettings(setGuard(settings, key, !settings.guards[key]));
                }}
              >
                <span className="guards__mark" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {engine.status === 'error' && (
          <div className="notice notice--error intro-wide" role="alert">
            <Icon name="circle-alert" />
            <div>
              <p className="t-h3">The checker didn’t load.</p>
              <p className="muted t-ui">
                {online
                  ? 'The file that holds the checker could not be read. Trying again usually fixes it.'
                  : 'You’re offline and this is the first visit, so the app has not saved itself yet. Connect once and it will work offline from then on.'}
              </p>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  setAttempt((n) => n + 1);
                }}
              >
                <Icon name="rotate-ccw" /> Try again
              </button>
            </div>
          </div>
        )}

        {showInstall && (
          <div className="notice notice--float" role="region" aria-label="Install">
            <Icon name="download" />
            <div>
              <p className="t-h3">Keep it on your home screen</p>
              <p className="muted t-ui">Installed, it opens like an app and works offline.</p>
              <div className="notice__actions">
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => {
                    void install.prompt();
                  }}
                >
                  Install
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    setInstallDismissed(true);
                    try {
                      localStorage.setItem('readback:install-dismissed', '1');
                    } catch {
                      // ignore
                    }
                  }}
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Thread */}
        <section className="pane" aria-labelledby="thread-h" data-pane="thread">
          <div className="pane__head">
            <h2 className="t-h3" id="thread-h">
              The thread you’re replying to
            </h2>
            {sample && <span className="chip">Sample thread</span>}
          </div>

          {
            <>
              <div className="threadbox" data-collapsed={collapsed ? '' : undefined}>
                <Editor
                  ref={threadRef}
                  eng={eng}
                  id="thread"
                  label="The message you're replying to"
                  value={draft.thread}
                  onChange={setThread}
                  marks={threadMarks}
                  placeholder="Paste the message you're replying to."
                  collapsed={collapsed}
                  invalid={tooLong}
                  describedBy={tooLong ? 'thread-error' : empty ? undefined : 'thread-meta'}
                  minRows={empty ? 7 : 4}
                  onFocus={() => {
                    setThreadOpen(true);
                  }}
                />
              </div>
              {collapsed && (
                <button
                  type="button"
                  className="btn btn--ghost btn--block"
                  onClick={() => {
                    setThreadOpen(true);
                    // The button removes itself; keep the keyboard where the thread is.
                    threadRef.current?.textarea?.focus({ preventScroll: true });
                  }}
                >
                  Show full thread
                </button>
              )}
              {tooLong && (
                <p className="field-error" id="thread-error" role="alert">
                  <Icon name="circle-alert" /> That’s longer than Readback reads (50,000
                  characters). Paste just the last message.
                </p>
              )}
              {empty ? (
                <div className="empty">
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => {
                      loadSample('deposit');
                    }}
                  >
                    Try a sample
                  </button>
                  <p className="muted t-caption">
                    Loads an invented landlord thread and a reply with two slips in it. Or paste
                    your own above.
                    <span className="empty__kbd">
                      {' '}
                      <span className="keycap">{MOD_KEY}</span> <span className="keycap">K</span>{' '}
                      lists every command.
                    </span>
                  </p>
                </div>
              ) : (
                !tooLong && (
                  <p className="t-caption subtle" id="thread-meta">
                    {askCount} {askCount === 1 ? 'ask' : 'asks'}, {harvest?.names.length ?? 0}{' '}
                    {harvest?.names.length === 1 ? 'name' : 'names'} found
                    {askCount === 0 && (harvest?.names.length ?? 0) === 0
                      ? '. Tip: paste the whole message, including the signature.'
                      : ''}
                  </p>
                )
              )}

              <div className="pane__tools">
                <label className="select">
                  <span className="t-caption subtle">Sample</span>
                  <span className="select__control">
                    <select
                      value={draft.sampleId ?? ''}
                      onChange={(e) => {
                        if (e.target.value) loadSample(e.target.value);
                      }}
                      aria-label="Load a sample thread"
                    >
                      <option value="">Choose a sample…</option>
                      {SAMPLES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                    <Icon name="chevron-down" />
                  </span>
                </label>
                {hasThread && (
                  <button type="button" className="btn btn--ghost" onClick={clearThread}>
                    Clear thread
                  </button>
                )}
              </div>

              <details className="details">
                <summary>Sender and sent date (optional)</summary>
                <div className="fields">
                  <label className="field">
                    <span className="t-label">Who it’s from</span>
                    <input
                      type="text"
                      value={draft.sender}
                      placeholder="Their name"
                      autoComplete="off"
                      disabled={sample !== undefined}
                      onChange={(e) => {
                        setDraftState((d) => ({ ...d, sender: e.target.value }));
                      }}
                    />
                  </label>
                  <label className="field">
                    <span className="t-label">Sent on</span>
                    <input
                      type="date"
                      value={draft.sentOn}
                      onChange={(e) => {
                        setDraftState((d) => ({ ...d, sentOn: e.target.value }));
                      }}
                    />
                    <span className="t-caption subtle">
                      Dates in your reply are checked against this day. Blank means today.
                    </span>
                  </label>
                </div>
              </details>
            </>
          }
        </section>

        {/* Reply */}
        <section
          className="pane"
          aria-labelledby="reply-h"
          data-pane="reply"
          data-quiet={empty ? '' : undefined}
        >
          <div className="pane__head">
            <h2 className="t-h3" id="reply-h">
              Your reply
            </h2>
            {sample && draft.reply !== sample.draft && (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setReply(sample.draft);
                  setSwap(null);
                }}
              >
                <Icon name="rotate-ccw" /> Reset sample reply
              </button>
            )}
          </div>

          {
            <Editor
              ref={replyRef}
              eng={eng}
              id="reply"
              label="Your reply"
              value={draft.reply}
              onChange={setReply}
              marks={replyMarks}
              placeholder={
                empty
                  ? 'Your reply goes here. Readback checks it against the thread above.'
                  : 'Type your reply. Names, numbers and dates are checked as you go.'
              }
              minRows={7}
              onHit={hitFlag}
              onTyping={() => {
                cancelGhost.current?.();
                setSwap(null);
                setCard(null);
                setNote(null);
              }}
            >
              {note ? (
                <div className="pill" data-tone="open" role="status">
                  <span className="pill__text">{note.text}</span>
                  <button type="button" className="pill__undo" onClick={note.undo}>
                    Undo <span className="hint-fine">Ctrl+Z</span>
                  </button>
                </div>
              ) : (
                pill &&
                pill.tone !== 'hidden' && (
                  <button
                    type="button"
                    className="pill pill--button"
                    data-tone={pill.tone}
                    onClick={scrollToLedger}
                  >
                    {pill.tone === 'covered' ? (
                      <Icon name="check" size={14} />
                    ) : (
                      <span className="pill__ring" data-dotted={pill.dotted ? '' : undefined} />
                    )}
                    {pill.label && (
                      <span className="pill__text" key={pill.label}>
                        {pill.label}
                      </span>
                    )}
                    {pill.slipLabel && (
                      <span className="pill__slips">
                        <span className="pill__dot" />
                        {pill.slipLabel}
                      </span>
                    )}
                    {/* The visible text stays first in the name (WCAG 2.5.3 label in name). */}
                    <span className="sr-only">{`. ${pill.announcement} Show the list.`}</span>
                  </button>
                )
              )}
            </Editor>
          }

          <div className="sr-only" aria-live="polite" role="status">
            {announce}
          </div>

          {!loading && hasThread && !tooLong && draft.reply.trim() !== '' && flags.length === 0 && (
            <p className="success-line" role="status">
              <Icon name="check" /> No slips against this thread.
            </p>
          )}
          {tooLong && <p className="muted t-ui">Waiting for a shorter thread before checking.</p>}
          {!loading && !hasThread && draft.reply.trim() !== '' && !tooLong && (
            <p className="muted t-ui">
              Add the thread above and Readback will check this reply against it.
            </p>
          )}
        </section>

        {/* Inspector: slips and asks */}
        <aside className="inspector" aria-label="Slips and asks">
          {loading ? (
            <div className="panel panel--loading" aria-busy="true" role="status">
              <p className="muted t-ui">Loading the checker…</p>
            </div>
          ) : (
            eng &&
            snap && (
              <>
                <SlipList
                  flags={flags}
                  activeId={card?.id ?? null}
                  onOpen={(id) => {
                    cardOpener.current =
                      document.activeElement instanceof HTMLElement ? document.activeElement : null;
                    setCard({ id, via: 'list' });
                    const f = flags.find((x) => x.id === id);
                    if (f && replyRef.current?.textarea) {
                      replyRef.current.textarea.scrollIntoView({ block: 'nearest' });
                    }
                  }}
                  onFix={(f, i) => {
                    void applyFix(f, i);
                  }}
                />
                {settings.guards.asks && (
                  <AskLedger
                    eng={eng}
                    asks={snap.result.asks}
                    truncated={snap.result.truncatedAsks}
                    result={snap.result}
                    onAction={(a) => {
                      session?.dispatch(a);
                    }}
                  />
                )}
              </>
            )
          )}
        </aside>

        {line && !reduced && (
          <svg className="rb-line app-line" aria-hidden="true">
            <path d={line.d} pathLength={1} className="app-line__path" key={card?.id} />
            <circle cx={line.a.x} cy={line.a.y} r={1.5} />
            <circle cx={line.b.x} cy={line.b.y} r={1.5} />
          </svg>
        )}
        {line && reduced && (
          <svg className="rb-line app-line" aria-hidden="true">
            <path d={line.d} pathLength={1} />
            <circle cx={line.a.x} cy={line.a.y} r={1.5} />
            <circle cx={line.b.x} cy={line.b.y} r={1.5} />
          </svg>
        )}
      </main>

      {eng && activeFlag && card && (
        <GuardCard
          eng={eng}
          flag={activeFlag}
          sentAt={snap?.context.sentAt}
          mode={wide ? 'popover' : 'sheet'}
          pos={place}
          keyboardInset={keyboard}
          focusIn={card.via === 'key' || card.via === 'list'}
          onFix={(i) => {
            void applyFix(activeFlag, i);
          }}
          onIgnore={() => {
            session?.dispatch({ type: 'ignore-flag', id: activeFlag.id });
            closeCard();
            say(`Ignoring “${activeFlag.found}” in this thread.`, {
              label: 'Undo',
              run: () => {
                session?.dispatch({ type: 'unignore-flag', id: activeFlag.id });
                setToast(null);
              },
            });
          }}
          onNever={() => {
            session?.neverFlag(activeFlag);
            if (session) {
              const next = session.getSnapshot().ignore;
              updateIgnore(next);
            }
            closeCard();
            say(`Never flagging “${activeFlag.found}”. Change this in Settings.`);
          }}
          onClose={closeCard}
        />
      )}

      <footer className="foot">
        <p className="t-caption subtle" id="privacy-foot">
          Runs entirely in your browser. Nothing is uploaded.{' '}
          <span className="tnum" data-testid="late-requests">
            {lateRequests} {lateRequests === 1 ? 'request' : 'requests'} since the app loaded.
          </span>
        </p>
      </footer>

      {toast && (
        <div className="toast" role="status" key={toast.id}>
          <span>{toast.text}</span>
          {toast.action && (
            <button type="button" className="btn btn--ghost" onClick={toast.action.run}>
              {toast.action.label}
            </button>
          )}
        </div>
      )}

      <Palette
        open={paletteOpen}
        commands={commands}
        onClose={() => {
          setPaletteOpen(false);
        }}
      />

      {eng && (
        <SettingsDialog
          open={settingsOpen}
          onClose={() => {
            setSettingsOpen(false);
          }}
          settings={settings}
          ignore={ignore}
          theme={settings.theme}
          engineVersion={eng.ENGINE_VERSION}
          install={install}
          canShare={canShareLink()}
          hasText={hasText}
          onGuard={(key, on) => {
            updateSettings(setGuard(settings, key, on));
          }}
          onTheme={(t: Theme) => {
            updateSettings(setTheme(settings, t));
            writeTheme(t);
          }}
          onRemoveIgnored={(kind, entry) => {
            updateIgnore(eng.removeIgnored(ignore, kind, entry));
          }}
          onShare={copyShareLink}
          onInstall={() => {
            void install.prompt();
          }}
          onClearAll={clearAll}
        />
      )}
    </div>
  );
}
