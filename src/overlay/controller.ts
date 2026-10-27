/**
 * The overlay controller: connects one bound field (a `Binding`) to the React
 * overlay in Readback's shadow root. It owns everything the components cannot:
 * hover hit-testing, the keyboard commands, focus return, docking and card
 * placement, the fix itself and the swap-back ghost.
 *
 * Host-page footprint, by design: one passive `pointermove` and `pointerleave`
 * on the active field (the binding adds its own `input`), plus a document
 * `keydown`/`pointerdown` that exist only while a card or the ledger is open.
 * Nothing is written to the host's DOM. Text changes only on a click or Enter,
 * through the editor's own input path (undo-safe).
 */
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { Binding } from '../content/binding';
import type { OverlayHost } from '../content/overlay-host';
import type { ClipboardLike } from '../dom/apply-fix';
import { effectiveBackground, hitTest, themeForBackground } from '../dom/geometry';
import type { RectLike } from '../dom/geometry';
import { inlineSlotText } from '../engine/index';
import type { Flag } from '../engine/types';
import { nextFlag } from '../state/flags-diff';
import { FIXED_CONFIRMATION_MS } from '../state/summary';
import { createStore } from '../state/store';
import { createHoverIntent } from './hover';
import type { Timers } from './hover';
import { createSwapGhost } from './swap/ghost';
import type { SwapGhost } from './swap/ghost';
import type { OverlayActions, OverlayUi } from './types';
import { INITIAL_UI } from './types';
import { OverlayApp } from './ui/OverlayApp';

export interface OverlayControllerDeps {
  doc: Document;
  host: OverlayHost;
  binding: Binding;
  clipboard?: ClipboardLike;
  timers?: Timers;
  reducedMotion?: () => boolean;
}

export interface OverlayController {
  /** Alt+Shift+J: open the card for the next slip, focus on its fix. */
  nextSlip(): void;
  /** Alt+Shift+L: open the ledger and move focus into it. */
  openLedger(): void;
  /** Re-reads the field's position and theme (call after layout changes). */
  measure(): void;
  destroy(): void;
}

function realTimers(view: Window | null): Timers {
  const w = view ?? window;
  return {
    set: (run, ms) => w.setTimeout(run, ms),
    clear: (handle) => {
      w.clearTimeout(handle);
    },
  };
}

function rectOf(r: RectLike): RectLike {
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}

export function attachOverlay(deps: OverlayControllerDeps): OverlayController {
  const { doc, host, binding } = deps;
  const view = doc.defaultView;
  const { session, target } = binding;
  const editor = target.element;
  const timers = deps.timers ?? realTimers(view);
  const reduced =
    deps.reducedMotion ??
    ((): boolean => view?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false);
  const clipboard: ClipboardLike | undefined =
    deps.clipboard ?? (view?.navigator.clipboard ? view.navigator.clipboard : undefined);

  const ui = createStore<OverlayUi>({ ...INITIAL_UI });
  const patch = (next: Partial<OverlayUi>): void => {
    ui.setState((s) => ({ ...s, ...next }));
  };

  let ledgerKeyboard = false;
  let caretAfterClose: number | undefined;
  let ghost: SwapGhost | undefined;
  let ghostVersion = -1;
  let fixedFlagId: string | undefined;
  let fixedTimer: number | undefined;
  let destroyed = false;

  const flags = (): readonly Flag[] => session.getSnapshot().result.flags;
  const flagById = (id: string): Flag | undefined => flags().find((f) => f.id === id);

  // ---------- docking, theme and anchors ----------

  const slipAnchor = (flagId: string): RectLike | undefined => {
    const rect = binding.slips().find((s) => s.id === flagId)?.rects[0];
    return rect ? rectOf(rect) : undefined;
  };

  const measure = (): void => {
    if (destroyed) return;
    const w = view?.innerWidth ?? 1280;
    const h = view?.innerHeight ?? 800;
    const r = editor.getBoundingClientRect();
    const visible = r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < h && r.right > 0;
    const theme = themeForBackground(effectiveBackground(editor));
    host.setTheme(theme);
    const state = ui.getSnapshot();
    const card = state.card;
    let nextCard = card;
    if (card) {
      const anchor = slipAnchor(card.flagId);
      nextCard = anchor ? { ...card, anchor } : undefined;
    }
    patch({
      theme,
      viewport: { width: w, height: h },
      dock: visible
        ? {
            left: Math.max(0, r.left),
            top: Math.max(0, r.top),
            right: Math.min(w, r.right),
            bottom: Math.min(h, r.bottom),
          }
        : undefined,
      card: nextCard,
    });
    if (card && !nextCard) closeCard(false);
  };

  let measureQueued = false;
  const queueMeasure = (): void => {
    if (measureQueued || destroyed) return;
    measureQueued = true;
    view?.requestAnimationFrame(() => {
      measureQueued = false;
      measure();
    });
  };

  // ---------- card ----------

  const intent = createHoverIntent({
    timers,
    onOpen: (id) => {
      openCard(id, 'hover');
    },
    onClose: () => {
      closeCard(false);
    },
  });

  function openCard(flagId: string, via: 'hover' | 'keyboard'): void {
    const flag = flagById(flagId);
    const anchor = slipAnchor(flagId);
    if (!flag || !anchor) return;
    caretAfterClose = flag.draftSpan.end;
    patch({ card: { flagId, via, anchor }, ledgerOpen: false });
    binding.setActive(flagId);
    listenWhileOpen();
  }

  /** Puts the editor caret at the end of the slip the card was about. */
  function restoreFocus(): void {
    editor.focus({ preventScroll: true });
    const at = caretAfterClose;
    if (at === undefined) return;
    const sel = doc.getSelection();
    if (target.kind === 'textarea') {
      (editor as HTMLTextAreaElement).setSelectionRange(at, at);
      return;
    }
    const range = target.rangeFor({ start: Math.max(0, at - 1), end: at });
    if (range && sel) {
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  function closeCard(refocus: boolean): void {
    const hadCard = ui.getSnapshot().card !== undefined;
    if (hadCard) patch({ card: undefined });
    binding.setActive(undefined);
    intent.closed();
    if (refocus) restoreFocus();
    unlistenIfIdle();
  }

  function closeLedger(refocus: boolean): void {
    if (ui.getSnapshot().ledgerOpen) patch({ ledgerOpen: false });
    if (refocus) editor.focus({ preventScroll: true });
    unlistenIfIdle();
  }

  // ---------- listeners that exist only while something is open ----------

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    const state = ui.getSnapshot();
    if (!state.card && !state.ledgerOpen) return;
    // Gmail would otherwise treat Esc as its own command.
    event.preventDefault();
    event.stopPropagation();
    const inside = host.root.activeElement !== null;
    if (state.card) closeCard(inside || state.card.via === 'keyboard');
    else closeLedger(inside || ledgerKeyboard);
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.composedPath().includes(host.element)) return;
    const state = ui.getSnapshot();
    // A hover card follows the pointer; only keyboard cards and the ledger need an outside click.
    if (state.ledgerOpen) closeLedger(false);
    if (state.card?.via === 'keyboard') closeCard(false);
  };

  let listening = false;
  function listenWhileOpen(): void {
    if (listening) return;
    listening = true;
    doc.addEventListener('keydown', onKeyDown, true);
    doc.addEventListener('pointerdown', onPointerDown, true);
  }
  function unlistenIfIdle(): void {
    const state = ui.getSnapshot();
    if (!listening || state.card || state.ledgerOpen) return;
    listening = false;
    doc.removeEventListener('keydown', onKeyDown, true);
    doc.removeEventListener('pointerdown', onPointerDown, true);
  }

  // ---------- hover ----------

  let lastX = 0;
  let lastY = 0;
  let moveQueued = false;
  const processMove = (): void => {
    moveQueued = false;
    if (destroyed) return;
    intent.over(hitTest(binding.slips(), lastX, lastY));
  };
  const onPointerMove = (event: PointerEvent): void => {
    lastX = event.clientX;
    lastY = event.clientY;
    if (moveQueued) return;
    moveQueued = true;
    view?.requestAnimationFrame(processMove);
  };
  const onPointerLeave = (): void => {
    intent.over(undefined);
  };
  editor.addEventListener('pointermove', onPointerMove, { passive: true });
  editor.addEventListener('pointerleave', onPointerLeave, { passive: true });

  // ---------- fixing ----------

  const playGhost = (flag: Flag, replacement: string): void => {
    ghost?.cancel();
    ghost = undefined;
    if (reduced() || target.kind !== 'contenteditable') return;
    const span = { start: flag.draftSpan.start, end: flag.draftSpan.start + replacement.length };
    const range = target.rangeFor(span);
    const rects = target.rectsFor(span);
    const rect = rects[0];
    // A word that wraps across lines is fixed instantly; the ghost is decoration.
    if (!range || !rect || rects.length !== 1) return;
    const styleSource = range.startContainer.parentElement ?? editor;
    try {
      ghostVersion = session.getSnapshot().version;
      ghost = createSwapGhost({
        doc,
        root: host.root,
        rect,
        styleSource,
        from: flag.found,
        to: replacement,
        guard: flag.guard,
        background: effectiveBackground(editor),
        onDone: () => {
          ghost = undefined;
        },
      });
    } catch {
      ghost = undefined; // fail silent: the real text is already correct
    }
  };

  async function applyFix(flagId: string, index: number): Promise<void> {
    const flag = flagById(flagId);
    const fix = flag?.fixes[index];
    if (!flag || !fix) return;
    const fromKeyboard = ui.getSnapshot().card?.via === 'keyboard';
    editor.focus({ preventScroll: true });
    const outcome = await target.fix(flag.draftSpan, fix.replacement, clipboard);
    if (destroyed) return;
    if (outcome === 'inserted') {
      closeCard(false);
      binding.refresh();
      session.markFixed(fix.replacement);
      fixedFlagId = flag.id;
      if (fixedTimer !== undefined) timers.clear(fixedTimer);
      fixedTimer = timers.set(() => {
        session.expireFixed();
      }, FIXED_CONFIRMATION_MS + 20);
      playGhost(flag, fix.replacement);
      if (fromKeyboard) editor.focus({ preventScroll: true });
      return;
    }
    const card = ui.getSnapshot().card;
    if (card) {
      patch({
        card: { ...card, notice: { kind: outcome, replacement: fix.replacement, fixIndex: index } },
      });
    }
  }

  // ---------- reacting to the session ----------

  let lastVersion = session.getSnapshot().version;
  const unsubscribe = session.subscribe(() => {
    const snap = session.getSnapshot();
    const typed = snap.version !== lastVersion;
    lastVersion = snap.version;
    // Typing ends the moment: stop the ghost and any hover card.
    if (typed) {
      if (ghost && snap.version !== ghostVersion) {
        ghost.cancel();
        ghost = undefined;
      }
      const card = ui.getSnapshot().card;
      if (card?.via === 'hover') closeCard(false);
      intent.cancel();
    }
    const card = ui.getSnapshot().card;
    if (card && !snap.result.flags.some((f) => f.id === card.flagId)) closeCard(false);
    // Ctrl+Z brought the slip back: the "Fixed" confirmation no longer applies.
    if (snap.fixed && fixedFlagId && snap.result.flags.some((f) => f.id === fixedFlagId)) {
      session.clearFixed();
    }
    queueMeasure();
  });

  // ---------- actions ----------

  const actions: OverlayActions = {
    fix(flagId, index) {
      void applyFix(flagId, index);
    },
    ignore(flagId) {
      session.dispatch({ type: 'ignore-flag', id: flagId });
      closeCard(true);
    },
    neverFlag(flagId) {
      const flag = flagById(flagId);
      closeCard(true);
      if (flag) session.neverFlag(flag);
    },
    closeCard() {
      closeCard(true);
    },
    cardPointer(inside) {
      if (inside) intent.cardEnter();
      else intent.cardLeave();
    },
    toggleLedger() {
      if (ui.getSnapshot().ledgerOpen) {
        closeLedger(ledgerKeyboard);
        return;
      }
      ledgerKeyboard = host.root.activeElement !== null;
      closeCard(false);
      patch({ ledgerOpen: true });
      listenWhileOpen();
    },
    closeLedger() {
      closeLedger(true);
    },
    confirmAsk(id) {
      session.dispatch({ type: 'confirm-ask', id });
    },
    dismissAsk(id) {
      session.dispatch({ type: 'dismiss-ask', id });
    },
    restoreDismissed() {
      for (const ask of session.getSnapshot().result.asks) {
        if (ask.state === 'dismissed') session.dispatch({ type: 'restore-ask', id: ask.id });
      }
    },
    answerInline(id) {
      const ask = session.getSnapshot().result.asks.find((a) => a.id === id);
      if (!ask) return;
      closeLedger(false);
      void target.insert(inlineSlotText(ask.text), clipboard).then(() => {
        binding.refresh();
      });
    },
    jumpToSlip(flagId) {
      const flag = flagById(flagId);
      if (!flag) return;
      closeLedger(false);
      const range = target.rangeFor(flag.draftSpan);
      range?.startContainer.parentElement?.scrollIntoView({ block: 'nearest' });
      measure();
      openCard(flagId, 'keyboard');
    },
  };

  // ---------- mount ----------

  const container = doc.createElement('div');
  host.root.append(container);
  const root: Root = createRoot(container);
  root.render(
    createElement(OverlayApp, {
      session,
      ui,
      actions,
      ledgerFocus: () => ledgerKeyboard,
    }),
  );

  const resize =
    view && 'ResizeObserver' in view ? new view.ResizeObserver(queueMeasure) : undefined;
  resize?.observe(editor);
  view?.addEventListener('scroll', queueMeasure, { capture: true, passive: true });
  view?.addEventListener('resize', queueMeasure, { passive: true });
  measure();

  return {
    nextSlip() {
      const list = flags();
      if (list.length === 0) return;
      const current = ui.getSnapshot().card?.flagId;
      const flag = nextFlag(list, target.caret() ?? 0, current);
      if (!flag) return;
      const range = target.rangeFor(flag.draftSpan);
      range?.startContainer.parentElement?.scrollIntoView({ block: 'nearest' });
      measure();
      openCard(flag.id, 'keyboard');
    },
    openLedger() {
      ledgerKeyboard = true;
      closeCard(false);
      patch({ ledgerOpen: true });
      listenWhileOpen();
    },
    measure,
    destroy() {
      destroyed = true;
      unsubscribe();
      ghost?.cancel();
      if (fixedTimer !== undefined) timers.clear(fixedTimer);
      intent.cancel();
      editor.removeEventListener('pointermove', onPointerMove);
      editor.removeEventListener('pointerleave', onPointerLeave);
      view?.removeEventListener('scroll', queueMeasure, true);
      view?.removeEventListener('resize', queueMeasure);
      resize?.disconnect();
      doc.removeEventListener('keydown', onKeyDown, true);
      doc.removeEventListener('pointerdown', onPointerDown, true);
      binding.setActive(undefined);
      root.unmount();
      container.remove();
    },
  };
}
