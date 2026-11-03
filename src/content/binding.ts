/**
 * Binds one editable field to one compose session: every edit re-runs the
 * engine, and the result is painted without touching the host's text. Shared
 * by the Gmail controller and the generic selection controller, so both
 * behave the same.
 *
 * - contenteditable: CSS Custom Highlight API ranges (host DOM never changed).
 * - textarea: a mirror in Readback's own shadow root, re-placed when the field
 *   or the page scrolls or resizes.
 * One passive `input` listener on the field. Input is coalesced to at most one
 * check per animation frame (the first runs at once), and the word still being
 * typed at the caret is not flagged until typing pauses or the word ends.
 */
import { createTextareaMirror } from '../adapters/generic/textarea-mirror';
import type { TextareaMirror } from '../adapters/generic/textarea-mirror';
import type { DraftTarget } from '../adapters/target';
import { effectiveBackground, themeForBackground } from '../dom/geometry';
import type { RectLike, SlipRects } from '../dom/geometry';
import type { HighlightPainter } from '../dom/highlights';
import type { Flag } from '../engine/types';
import type { ComposeSession, SessionSnapshot } from '../state/session';

export interface Binding {
  readonly session: ComposeSession;
  readonly target: DraftTarget;
  /** Re-reads the field and re-runs the check (call after programmatic edits). */
  refresh(): void;
  /** Client rects of every current slip, for hover hit-testing. */
  slips(): SlipRects[];
  /** The hovered or focused slip gets the active tint (DESIGN.md). Undefined clears it. */
  setActive(flagId: string | undefined): void;
  destroy(): void;
}

export interface BindingOptions {
  target: DraftTarget;
  session: ComposeSession;
  painter: HighlightPainter;
  /** Where a textarea mirror lives (Readback's shadow root). Required for textareas. */
  mirrorHost?: ParentNode;
  /** Called after each repaint with the new snapshot. */
  onChange?: (snapshot: SessionSnapshot) => void;
}

/** After this long without input, the word at the caret is checked too. */
export const TYPING_PAUSE_MS = 600;

export function bindDraft(options: BindingOptions): Binding {
  const { target, session, painter, mirrorHost, onChange } = options;
  const element = target.element;
  const mirror: TextareaMirror | undefined =
    target.kind === 'textarea' && mirrorHost
      ? createTextareaMirror(target.element as HTMLTextAreaElement, mirrorHost)
      : undefined;

  const slipRects = (flag: Flag): RectLike[] =>
    mirror ? mirror.rectsFor(flag.id) : target.rectsFor(flag.draftSpan);

  let activeId: string | undefined;

  const paint = (snapshot: SessionSnapshot, notify = true): void => {
    const flags = snapshot.result.flags;
    if (mirror) {
      mirror.update(flags.map((f) => ({ id: f.id, ...f.draftSpan })));
    } else {
      const ranges: Range[] = [];
      let active: Range | undefined;
      for (const f of flags) {
        const range = target.rangeFor(f.draftSpan);
        if (!range) continue;
        ranges.push(range);
        if (f.id === activeId) active = range;
      }
      painter.paint(ranges, active, themeForBackground(effectiveBackground(element)));
    }
    if (notify) onChange?.(snapshot);
  };

  const unsubscribe = session.subscribe(() => {
    paint(session.getSnapshot());
  });

  const view = element.ownerDocument.defaultView;
  const nextFrame = (run: () => void): number =>
    view?.requestAnimationFrame ? view.requestAnimationFrame(run) : Number(setTimeout(run, 16));
  const cancelFrame = (id: number): void => {
    if (view?.cancelAnimationFrame) view.cancelAnimationFrame(id);
    else clearTimeout(id);
  };

  /** Re-reads the field. `typing` holds back a flag on the word at the caret. */
  const check = (typing: boolean): void => {
    const before = session.getSnapshot();
    const text = target.read();
    session.setDraft(text, typing ? target.caret() : undefined);
    // Same text can still need a repaint (settings changed, field re-rendered).
    if (session.getSnapshot() === before) paint(before);
  };
  const refresh = (): void => {
    check(false);
  };

  let inputFrame = 0;
  let inputDirty = false;
  let pauseTimer: ReturnType<typeof setTimeout> | undefined;
  const onInput = (): void => {
    if (pauseTimer !== undefined) clearTimeout(pauseTimer);
    pauseTimer = setTimeout(() => {
      pauseTimer = undefined;
      check(false);
    }, TYPING_PAUSE_MS);
    if (inputFrame) {
      inputDirty = true;
      return;
    }
    check(true);
    inputFrame = nextFrame(() => {
      inputFrame = 0;
      if (!inputDirty) return;
      inputDirty = false;
      check(true);
    });
  };

  // The mirror is position: fixed, so it follows the field on any scroll or resize.
  let syncFrame = 0;
  const syncMirror = (): void => {
    if (!mirror || syncFrame) return;
    syncFrame = nextFrame(() => {
      syncFrame = 0;
      mirror.sync();
    });
  };
  const resizeObserver =
    mirror && typeof ResizeObserver === 'function' ? new ResizeObserver(syncMirror) : undefined;
  element.addEventListener('input', onInput, { passive: true });
  if (mirror) {
    element.addEventListener('scroll', syncMirror, { passive: true });
    view?.addEventListener('scroll', syncMirror, { passive: true, capture: true });
    view?.addEventListener('resize', syncMirror, { passive: true });
    resizeObserver?.observe(element);
  }
  refresh();

  return {
    session,
    target,
    refresh,
    slips: () => session.getSnapshot().result.flags.map((f) => ({ id: f.id, rects: slipRects(f) })),
    setActive(flagId) {
      if (activeId === flagId) return;
      activeId = flagId;
      paint(session.getSnapshot(), false);
    },
    destroy() {
      unsubscribe();
      if (pauseTimer !== undefined) clearTimeout(pauseTimer);
      if (inputFrame) cancelFrame(inputFrame);
      if (syncFrame) cancelFrame(syncFrame);
      element.removeEventListener('input', onInput);
      element.removeEventListener('scroll', syncMirror);
      view?.removeEventListener('scroll', syncMirror, { capture: true });
      view?.removeEventListener('resize', syncMirror);
      resizeObserver?.disconnect();
      painter.clear();
      mirror?.destroy();
    },
  };
}
