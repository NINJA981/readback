/**
 * Binds one editable field to one compose session: every edit re-runs the
 * engine, and the result is painted without touching the host's text. Shared
 * by the Gmail controller and the generic selection controller, so both
 * behave the same.
 *
 * - contenteditable: CSS Custom Highlight API ranges (host DOM never changed).
 * - textarea: a mirror in Readback's own shadow root.
 * One passive `input` listener on the field; nothing else is attached to it.
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

  const refresh = (): void => {
    const before = session.getSnapshot();
    const text = target.read();
    session.setDraft(text);
    // Same text can still need a repaint (settings changed, field re-rendered).
    if (session.getSnapshot() === before) paint(before);
  };

  const onInput = (): void => {
    refresh();
  };
  const onScroll = (): void => {
    mirror?.sync();
  };
  element.addEventListener('input', onInput, { passive: true });
  if (mirror) element.addEventListener('scroll', onScroll, { passive: true });
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
      element.removeEventListener('input', onInput);
      element.removeEventListener('scroll', onScroll);
      painter.clear();
      mirror?.destroy();
    },
  };
}
