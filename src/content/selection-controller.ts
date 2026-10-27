/**
 * Generic adapter controller (SPEC F8): the user selects the message they are
 * answering on any page and chooses "Use as Readback context". The next
 * textarea or contenteditable they focus is then checked against the selection
 * until the page navigates or they clear it. Nothing is stored: the selection
 * lives in this closure only.
 */
import {
  contextChipLabel,
  editableHostOf,
  editableKindOf,
  selectionContextInput,
  wordCount,
} from '../adapters/generic/selection';
import { createContentEditableTarget, createTextareaTarget } from '../adapters/target';
import type { DraftTarget } from '../adapters/target';
import { createHighlightPainter } from '../dom/highlights';
import type { HighlightPainter } from '../dom/highlights';
import { createContext } from '../engine/index';
import { mountChip } from '../overlay/chip';
import type { ChipHost } from '../overlay/chip';
import { attachOverlay } from '../overlay/controller';
import type { OverlayController } from '../overlay/controller';
import { CONTEXT_ERROR, CONTEXT_ERROR_MS } from '../overlay/model';
import { effectiveBackground, themeForBackground } from '../dom/geometry';
import { createComposeSession } from '../state/session';
import type { ComposeSession } from '../state/session';
import type { ReadbackStorage } from '../storage/repository';
import type { TabStatus } from '../storage/tab-status';
import { bindDraft } from './binding';
import type { Binding } from './binding';
import { createOverlayHost } from './overlay-host';
import type { OverlayHost } from './overlay-host';
import { statusFrom } from './status';

export interface SelectionControllerDeps {
  doc: Document;
  storage: ReadbackStorage;
  report(status: TabStatus): void;
  painter?: HighlightPainter;
  now?: () => number;
}

export interface SelectionController {
  /** "Use as Readback context". False when the selection is too short to be a message. */
  useSelection(text: string): Promise<boolean>;
  clear(): void;
  session(): ComposeSession | undefined;
  nextSlip(): void;
  openLedger(): void;
  stop(): void;
}

export function createSelectionController(deps: SelectionControllerDeps): SelectionController {
  const { doc, storage } = deps;
  const now = deps.now ?? (() => Date.now());
  const painter = deps.painter ?? createHighlightPainter();

  let context: ReturnType<typeof createContext> | undefined;
  const currentContext = (): typeof context => context;
  const isStopped = (): boolean => stopped;
  let words = 0;
  let binding: Binding | undefined;
  let host: OverlayHost | undefined;
  let chips: ChipHost | undefined;
  let overlay: OverlayController | undefined;
  let chipField: HTMLElement | undefined;
  let errorTimer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const getHost = (): OverlayHost => (host ??= createOverlayHost(doc));

  const report = (status: Omit<TabStatus, 'updatedAt'>): void => {
    try {
      deps.report({ ...status, updatedAt: now() });
    } catch {
      // A stale popup status is acceptable.
    }
  };

  const viewport = (): { width: number; height: number } => ({
    width: doc.defaultView?.innerWidth ?? 1280,
    height: doc.defaultView?.innerHeight ?? 800,
  });

  const getChips = (): ChipHost => (chips ??= mountChip(doc, getHost().root));

  /** The context chip, docked to the focused field or, without one, to the viewport. */
  const renderChip = (): void => {
    if (!context || stopped) return;
    const field = chipField;
    const rect = field?.getBoundingClientRect();
    getHost().setTheme(field ? themeForBackground(effectiveBackground(field)) : 'dark');
    getChips().show({
      kind: 'context',
      text: contextChipLabel(words),
      field: rect
        ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
        : undefined,
      viewport: viewport(),
      theme: field ? themeForBackground(effectiveBackground(field)) : 'dark',
      onClear: () => {
        controller.clear();
      },
    });
  };

  const hideChip = (): void => {
    chipField = undefined;
    chips?.hide();
  };

  /** "No text selected. Select the message first." for four seconds. */
  const showError = (): void => {
    if (errorTimer) clearTimeout(errorTimer);
    const active = doc.activeElement;
    const field = active ? editableHostOf(active) : undefined;
    const rect = field?.getBoundingClientRect();
    getChips().show({
      kind: 'error',
      text: CONTEXT_ERROR,
      field: rect
        ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
        : undefined,
      viewport: viewport(),
      theme: field ? themeForBackground(effectiveBackground(field)) : 'dark',
    });
    errorTimer = setTimeout(() => {
      errorTimer = undefined;
      if (context) renderChip();
      else chips?.hide();
    }, CONTEXT_ERROR_MS);
  };

  /**
   * Bumped by every unbind, so an `attach` that is still awaiting storage can tell it was
   * superseded (another field took focus, the context was replaced or cleared) and must not
   * install a binding of its own.
   */
  let attachGeneration = 0;
  let pendingField: Element | undefined;

  const unbind = (): void => {
    attachGeneration++;
    pendingField = undefined;
    overlay?.destroy();
    overlay = undefined;
    binding?.destroy();
    binding = undefined;
    hideChip();
  };

  const loadSettings = (threadKey: string) =>
    Promise.all([storage.getSettings(), storage.getIgnore(), storage.getThreadState(threadKey)]);

  const attach = async (field: Element): Promise<void> => {
    if (!context || stopped) return;
    const kind = editableKindOf(field);
    if (!kind) return;
    if (binding?.target.element === field || pendingField === field) return;
    unbind();
    const generation = attachGeneration;
    pendingField = field;
    let loaded: Awaited<ReturnType<typeof loadSettings>>;
    try {
      loaded = await loadSettings(context.threadKey);
    } finally {
      if (generation === attachGeneration) pendingField = undefined;
    }
    const [settings, ignore, threadState] = loaded;
    // The context may have been cleared, or another attach may have started, while storage loaded.
    const current = currentContext();
    if (!current || isStopped() || generation !== attachGeneration || binding) return;
    const session = createComposeSession({
      context: current,
      settings,
      ignore,
      threadState,
      effects: {
        saveThreadState: (key, state) => storage.setThreadState(key, state),
        saveIgnore: async (list) => {
          await storage.setIgnore(list);
        },
      },
    });
    const h = getHost();
    let target: DraftTarget;
    let mirrorHost: ParentNode | undefined;
    if (kind === 'textarea') {
      const area = field as HTMLTextAreaElement;
      mirrorHost = h.root;
      // The textarea target resolves rects through the binding's mirror.
      target = createTextareaTarget(area, () => []);
    } else {
      target = createContentEditableTarget(field as HTMLElement);
    }
    binding = bindDraft({
      target,
      session,
      painter,
      ...(mirrorHost ? { mirrorHost } : {}),
      onChange: (snap) => {
        report(statusFrom(snap, 'selection-context', words));
      },
    });
    try {
      overlay = attachOverlay({ doc, host: h, binding });
    } catch {
      overlay = undefined; // squiggles still work without the cards
    }
    chipField = field as HTMLElement;
    renderChip();
  };

  const onFocusIn = (event: FocusEvent): void => {
    const target = event.target instanceof Element ? editableHostOf(event.target) : undefined;
    if (target) void attach(target);
  };
  const onReposition = (): void => {
    if (chipField && context && !errorTimer) renderChip();
  };
  const onNavigate = (): void => {
    controller.clear();
  };

  doc.addEventListener('focusin', onFocusIn, true);
  const view = doc.defaultView;
  view?.addEventListener('scroll', onReposition, { capture: true, passive: true });
  view?.addEventListener('resize', onReposition, { passive: true });
  view?.addEventListener('popstate', onNavigate);
  view?.addEventListener('hashchange', onNavigate);

  const controller: SelectionController = {
    async useSelection(text) {
      const input = selectionContextInput(text);
      if (!input) {
        showError();
        return false;
      }
      unbind();
      context = createContext(input);
      words = wordCount(input.message);
      report({
        state: 'selection-context',
        asks: 0,
        open: 0,
        unconfirmed: 0,
        slips: 0,
        contextWords: words,
        failedChecks: [],
      });
      const active = doc.activeElement;
      const field = active ? editableHostOf(active) : undefined;
      if (field) await attach(field);
      else renderChip();
      return true;
    },
    clear() {
      unbind();
      context = undefined;
      words = 0;
      report({
        state: 'idle',
        asks: 0,
        open: 0,
        unconfirmed: 0,
        slips: 0,
        contextWords: 0,
        failedChecks: [],
      });
    },
    session: () => binding?.session,
    nextSlip: () => {
      overlay?.nextSlip();
    },
    openLedger: () => {
      overlay?.openLedger();
    },
    stop() {
      stopped = true;
      unbind();
      context = undefined;
      doc.removeEventListener('focusin', onFocusIn, true);
      view?.removeEventListener('scroll', onReposition, true);
      view?.removeEventListener('resize', onReposition);
      view?.removeEventListener('popstate', onNavigate);
      view?.removeEventListener('hashchange', onNavigate);
      if (errorTimer) clearTimeout(errorTimer);
      chips?.destroy();
      chips = undefined;
      host?.destroy();
      host = undefined;
    },
  };
  return controller;
}
