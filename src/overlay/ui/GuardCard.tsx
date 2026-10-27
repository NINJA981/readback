/**
 * The guard card (DESIGN.md "Guard card"): the citation tooltip. One plain
 * sentence (the message), the thread line it was checked against with the
 * matched token marked, and the fix. The readback line runs from the message
 * down to that token: the product's idea, drawn.
 *
 * Opens after a 300 ms hover or instantly from the keyboard. Esc closes,
 * Enter applies the primary fix, Shift+Enter the second, I ignores.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { placeCard } from '../../dom/geometry';
import { fixNotice } from '../model';
import type { CardModel } from '../model';
import type { CardState } from '../types';
import { CircleAlertIcon, EllipsisIcon } from './icons';
import { Keycap, trapTab } from './parts';

export interface GuardCardProps {
  model: CardModel;
  state: CardState;
  viewport: { width: number; height: number };
  open: boolean;
  onFix: (index: number) => void;
  onIgnore: () => void;
  onNeverFlag: () => void;
  onClose: () => void;
  onPointer: (inside: boolean) => void;
}

export const CARD_WIDTH = 320;

/** "Change to Kathryn": engine labels that already read as a sentence are left alone. */
export function fixLabel(label: string): string {
  return /^(change|use|keep)\b/i.test(label) ? label : `Change to ${label}`;
}

export function GuardCard({
  model,
  state,
  viewport,
  open,
  onFix,
  onIgnore,
  onNeverFlag,
  onClose,
  onPointer,
}: GuardCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const tokenRef = useRef<HTMLElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const startDot = useRef<SVGCircleElement>(null);
  const endDot = useRef<SVGCircleElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const titleId = useId();
  const notice = state.notice ? fixNotice(state.notice.kind, state.notice.replacement) : undefined;
  const { anchor } = state;
  const anchorKey = `${anchor.left},${anchor.top},${anchor.right},${anchor.bottom}`;

  // Place the card, and draw the readback line, before the first paint.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const layout = (): void => {
      // offsetHeight ignores the entry scale transform that getBoundingClientRect includes.
      const height = el.offsetHeight;
      const placement = placeCard(anchor, { width: CARD_WIDTH, height }, viewport);
      el.style.left = `${placement.left}px`;
      el.style.top = `${placement.top}px`;
      // Grow from the slip: origin is the slip's centre in card coordinates.
      const ox = (anchor.left + anchor.right) / 2 - placement.left;
      const oy = placement.side === 'below' ? 0 : height;
      el.style.setProperty('--rb-origin', `${Math.max(0, Math.min(CARD_WIDTH, ox))}px ${oy}px`);

      const icon = iconRef.current;
      const token = tokenRef.current;
      const path = pathRef.current;
      if (!icon || !token || !path || !startDot.current || !endDot.current) return;
      const c = el.getBoundingClientRect();
      const i = icon.getBoundingClientRect();
      // A token that wraps ends on its last line.
      const rects = token.getClientRects();
      const t = rects[rects.length - 1] ?? token.getBoundingClientRect();
      const k = c.width / (el.offsetWidth || 1); // undo the entry scale
      const x0 = (i.left - c.left + i.width / 2) / k;
      const y0 = (i.bottom - c.top) / k + 3;
      const y1 = (t.bottom - c.top) / k + 1;
      const x1 = (t.right - c.left) / k;
      const r = Math.max(0, Math.min(8, (y1 - y0) / 2, (x1 - x0) / 2));
      path.setAttribute('d', `M ${x0} ${y0} V ${y1 - r} A ${r} ${r} 0 0 0 ${x0 + r} ${y1} H ${x1}`);
      startDot.current.setAttribute('cx', String(x0));
      startDot.current.setAttribute('cy', String(y0));
      endDot.current.setAttribute('cx', String(x1));
      endDot.current.setAttribute('cy', String(y1));
    };
    layout();
    // Web fonts arriving, or a notice replacing the actions, change the card's height.
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(layout);
    observer?.observe(el);
    return () => {
      observer?.disconnect();
    };
    // The card's content changes only with the flag, the notice or the anchor.
  }, [anchorKey, viewport.width, viewport.height, model.flagId, notice]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state.via === 'keyboard' && open) primary.current?.focus({ preventScroll: true });
  }, [state.via, open, model.flagId]);

  const [first, second] = model.fixes;
  const keep = (e: React.MouseEvent): void => {
    e.preventDefault();
  };

  return (
    <div
      ref={ref}
      className="rb-card"
      data-state={open ? 'open' : 'closing'}
      data-via={state.via}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      onPointerEnter={() => {
        onPointer(true);
      }}
      onPointerLeave={() => {
        onPointer(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
          return;
        }
        if (e.key === 'Enter' && e.shiftKey && second) {
          e.preventDefault();
          onFix(1);
          return;
        }
        if ((e.key === 'i' || e.key === 'I') && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          onIgnore();
          return;
        }
        trapTab(e, ref.current);
      }}
    >
      <svg className="rb-line" aria-hidden="true" focusable="false">
        <path ref={pathRef} d="" pathLength={1} className="rb-line-path" />
        <circle ref={startDot} r="1.5" className="rb-line-dot" />
        <circle ref={endDot} r="1.5" className="rb-line-dot rb-line-dot-end" />
      </svg>

      <div className="rb-card-head">
        <span className="rb-card-icon" ref={iconRef}>
          <CircleAlertIcon />
        </span>
        <h3 className="rb-card-msg" id={titleId}>
          {model.message}
        </h3>
        <span className="rb-card-esc" aria-hidden="true">
          <Keycap>Esc</Keycap>
        </span>
      </div>

      <figure className="rb-cite">
        <blockquote className="rb-cite-line rb-mono">
          {model.citation.before}
          {model.citation.token ? (
            <mark className="rb-cite-token" ref={tokenRef}>
              {model.citation.token}
            </mark>
          ) : null}
          {model.citation.after}
        </blockquote>
        <figcaption className="rb-caption">{model.source}</figcaption>
      </figure>

      {notice ? (
        <p className="rb-card-notice" role="alert">
          {notice}
        </p>
      ) : null}

      <div className="rb-card-actions">
        {first ? (
          <button
            ref={primary}
            type="button"
            className="rb-btn rb-btn-primary"
            onMouseDown={keep}
            onClick={() => {
              onFix(state.notice?.fixIndex ?? 0);
            }}
          >
            {state.notice?.kind === 'copied' ? 'Copy again' : fixLabel(first.label)}
            <Keycap>↵</Keycap>
          </button>
        ) : null}
        {second && !state.notice ? (
          <button
            type="button"
            className="rb-btn rb-btn-secondary"
            onMouseDown={keep}
            onClick={() => {
              onFix(1);
            }}
          >
            {fixLabel(second.label)}
            <Keycap>⇧↵</Keycap>
          </button>
        ) : null}
        <button
          type="button"
          className="rb-btn rb-btn-ghost"
          aria-keyshortcuts="I"
          onMouseDown={keep}
          onClick={onIgnore}
        >
          Ignore
        </button>
        {model.canNeverFlag ? (
          <button
            type="button"
            className="rb-btn rb-btn-ghost rb-btn-icon"
            aria-label="More options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onMouseDown={keep}
            onClick={() => {
              setMenuOpen((v) => !v);
            }}
          >
            <EllipsisIcon />
          </button>
        ) : null}
      </div>

      {menuOpen && model.canNeverFlag ? (
        <div className="rb-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className="rb-menu-item"
            onMouseDown={keep}
            onClick={onNeverFlag}
          >
            {model.neverFlagLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
