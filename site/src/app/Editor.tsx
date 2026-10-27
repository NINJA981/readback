/**
 * A text box with squiggles. A transparent textarea sits over a mirror that
 * carries the same text and font metrics (the technique SPEC F4 uses for
 * textareas); the mirror draws the underlines, the textarea stays the real,
 * native, undo-capable editor. Hit-testing for taps and hover dwell goes
 * through the core's `hitTest` over the mirror's client rects.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from 'react';
import type { ReactNode } from 'react';
import type * as Engine from '../shared/engine';

export interface Mark {
  id: string;
  start: number;
  end: number;
  kind: 'slip' | 'cited' | 'fixed';
  active?: boolean;
}

export interface EditorHandle {
  textarea: HTMLTextAreaElement | null;
  mirror: HTMLElement | null;
  box: HTMLElement | null;
  /** Client rect of the first fragment of a mark, if it is drawn. */
  rectOf: (id: string) => DOMRect | null;
}

interface Props {
  eng: typeof Engine | null;
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  marks: readonly Mark[];
  placeholder?: string;
  disabled?: boolean;
  /** Collapsed preview: about six lines, expands when focused. */
  collapsed?: boolean;
  invalid?: boolean;
  describedBy?: string;
  minRows?: number;
  onHit?: (id: string, via: 'tap' | 'hover') => void;
  onTyping?: () => void;
  onFocus?: () => void;
  children?: ReactNode;
}

export const Editor = forwardRef<EditorHandle, Props>(function Editor(props, ref) {
  const { eng, value, marks, onHit, onTyping } = props;
  const taRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const dwell = useRef(0);

  useImperativeHandle(
    ref,
    () => ({
      get textarea() {
        return taRef.current;
      },
      get mirror() {
        return mirrorRef.current;
      },
      get box() {
        return boxRef.current;
      },
      rectOf(id) {
        const el = mirrorRef.current?.querySelector(`[data-id="${CSS.escape(id)}"]`);
        const r = el?.getClientRects()[0];
        return r ?? null;
      },
    }),
    [],
  );

  // Grow with the text so the page scrolls, never the box (keeps the mirror aligned).
  const fit = useCallback((): void => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }, []);
  useLayoutEffect(fit, [fit, value, props.collapsed]);
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    const ro = new ResizeObserver(fit);
    ro.observe(ta.parentElement ?? ta);
    void document.fonts.ready.then(fit);
    return () => {
      ro.disconnect();
    };
  }, [fit]);

  const slips = marks.filter((m) => m.kind === 'slip');
  const hit = (x: number, y: number, slop: number): string | undefined => {
    if (!eng || slips.length === 0) return undefined;
    const rects = slips.map((s) => {
      const el = mirrorRef.current?.querySelector(`[data-id="${CSS.escape(s.id)}"]`);
      return {
        id: s.id,
        rects: el ? Array.from(el.getClientRects()) : [],
      };
    });
    return eng.hitTest(rects, x, y, slop);
  };

  // Segments for the mirror. Without the engine (still loading) the text is plain.
  const nodes: ReactNode[] = [];
  if (eng && marks.length > 0) {
    const byId = new Map(marks.map((m) => [m.id, m]));
    const segs = eng.mirrorSegments(
      value,
      marks.map((m) => ({ id: m.id, start: m.start, end: m.end })),
    );
    segs.forEach((seg, i) => {
      const m = seg.slipId === undefined ? undefined : byId.get(seg.slipId);
      if (!m) {
        nodes.push(seg.text);
        return;
      }
      const cls = m.kind === 'slip' ? 'slip' : m.kind === 'cited' ? 'cited' : undefined;
      nodes.push(
        <span
          key={`${i}-${m.id}`}
          className={cls}
          data-id={m.id}
          data-active={m.active ? '' : undefined}
        >
          {seg.text}
        </span>,
      );
    });
  } else {
    nodes.push(value);
  }
  // A trailing newline needs a visible line box, as in a real textarea.
  if (value.endsWith('\n')) nodes.push(' ');

  return (
    <div
      ref={boxRef}
      className="editor"
      data-collapsed={props.collapsed ? '' : undefined}
      data-invalid={props.invalid ? '' : undefined}
      data-disabled={props.disabled ? '' : undefined}
    >
      <div ref={mirrorRef} className="editor__text editor__mirror" aria-hidden="true">
        {nodes}
      </div>
      <textarea
        ref={taRef}
        id={props.id}
        className="editor__text editor__input"
        aria-label={props.label}
        aria-describedby={props.describedBy}
        aria-invalid={props.invalid ? true : undefined}
        placeholder={props.placeholder}
        rows={props.minRows ?? 5}
        value={value}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="sentences"
        autoComplete="off"
        data-gramm="false"
        onChange={(e) => {
          onTyping?.();
          props.onChange(e.target.value);
        }}
        onFocus={props.onFocus}
        onPointerUp={(e) => {
          if (!onHit) return;
          const id = hit(e.clientX, e.clientY, e.pointerType === 'touch' ? 10 : 3);
          if (id) onHit(id, 'tap');
        }}
        onPointerMove={(e) => {
          if (!onHit || e.pointerType !== 'mouse') return;
          window.clearTimeout(dwell.current);
          const id = hit(e.clientX, e.clientY, 2);
          if (id) {
            dwell.current = window.setTimeout(() => {
              onHit(id, 'hover');
            }, 300);
          }
        }}
        onPointerLeave={() => {
          window.clearTimeout(dwell.current);
        }}
      />
      {props.children}
    </div>
  );
});
