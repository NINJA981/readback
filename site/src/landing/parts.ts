/**
 * Pieces shared by the hero, the proof mini-demos and the compose
 * reproduction: the reply text with squiggles, the guard card, the ask pill
 * and the readback line. All content comes from the real engine's output.
 */
import { h, setIcon, svg } from '../shared/dom';
import type { Props } from '../shared/dom';
import type * as EngineNs from '../shared/engine';
import { iconSvg } from '../shared/icons';
import { elbowPath } from '../shared/line';
import type { LinePoint } from '../shared/line';
import { snippet } from '../shared/snippet';

export type Eng = typeof EngineNs;
export type FlagT = EngineNs.Flag;

export interface TextSpan {
  id: string;
  start: number;
  end: number;
  kind: 'slip' | 'fixed';
  active?: boolean;
}

/** Renders `text` into `el` with squiggled (and optionally active) slips and an optional caret. */
export function renderText(
  eng: Eng,
  el: HTMLElement,
  text: string,
  spans: readonly TextSpan[],
  caret: boolean,
): void {
  const byId = new Map(spans.map((s) => [s.id, s]));
  const segments = eng.mirrorSegments(
    text,
    spans.map((s) => ({ id: s.id, start: s.start, end: s.end })),
  );
  const nodes: Node[] = segments.map((seg) => {
    const span = seg.slipId === undefined ? undefined : byId.get(seg.slipId);
    if (!span) return document.createTextNode(seg.text);
    const node = h('span', { text: seg.text, data: { id: span.id } });
    if (span.kind === 'slip') {
      node.classList.add('slip');
      if (span.active) node.dataset.active = '';
    }
    return node;
  });
  if (caret) nodes.push(h('span', { class: 'caret', attrs: { 'aria-hidden': 'true' } }));
  el.replaceChildren(...nodes);
}

export interface CardParts {
  el: HTMLElement;
  fixes: HTMLButtonElement[];
  ignore: HTMLButtonElement;
}

export function fixLabel(label: string): string {
  return label.startsWith('Change to') ? label : label;
}

/** The guard card (DESIGN.md Components): message, citation block, fixes, Ignore. */
export function buildGuardCard(
  eng: Eng,
  flag: FlagT,
  sentAt: string | undefined,
  extra: Props = {},
): CardParts {
  const parts = snippet(flag.citation.line, flag.citation.text);
  const msg = h('div', { class: 'gcard__msg' });
  const icon = h('span', { attrs: { 'aria-hidden': 'true' } });
  setIcon(icon, iconSvg('circle-alert', 16));
  msg.append(icon, h('span', { text: flag.message }));

  const cite = h(
    'div',
    { class: 'cite' },
    parts.before,
    parts.token ? h('b', { text: parts.token }) : null,
    parts.after,
    h('span', { class: 'cite__src', text: eng.citationSource(flag.citation, sentAt) }),
  );

  const fixes = flag.fixes.map((f, i) =>
    h('button', {
      class: `btn ${i === 0 ? 'btn--primary' : 'btn--secondary'} gcard__fix`,
      text: fixLabel(f.label),
      attrs: { type: 'button' },
    }),
  );
  const ignore = h('button', {
    class: 'btn btn--ghost gcard__fix',
    text: 'Ignore',
    attrs: { type: 'button' },
  });
  const actions = h('div', { class: 'gcard__actions' }, ...fixes, ignore);

  const el = h('div', { ...extra, class: `gcard ${extra.class ?? ''}`.trim() }, msg, cite, actions);
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', flag.message);
  return { el, fixes, ignore };
}

export interface PillParts {
  el: HTMLElement;
  /** Shows a model. With `animate`, a changed count text fades in over 150 ms with a 2px blur. */
  set(
    model: {
      tone: 'open' | 'covered' | 'hidden';
      text: string;
      slips: string;
      /** Nothing open, but some asks only look answered: the ring is dotted. */
      dotted?: boolean;
    },
    animate?: boolean,
  ): void;
}

/** The ask pill: ring or check, count text, and the slip segment. */
export function buildPill(): PillParts {
  const ring = h('span', { class: 'pill__ring', attrs: { 'aria-hidden': 'true' } });
  const check = h('span', { attrs: { 'aria-hidden': 'true' } });
  setIcon(check, iconSvg('check', 14));
  check.hidden = true;
  const text = h('span', { class: 'pill__text' });
  const slips = h('span', { class: 'pill__slips' });
  slips.hidden = true;
  const dot = h('span', { class: 'pill__dot', attrs: { 'aria-hidden': 'true' } });
  const slipText = h('span');
  slips.append(dot, slipText);
  const el = h('div', { class: 'pill', data: { tone: 'hidden' } }, ring, check, text, slips);
  let lastText = '';
  return {
    el,
    set(model, animate = false) {
      el.dataset.tone = model.tone;
      ring.hidden = model.tone === 'covered';
      ring.toggleAttribute('data-dotted', model.dotted === true);
      check.hidden = model.tone !== 'covered';
      if (model.text !== lastText) {
        text.textContent = model.text;
        lastText = model.text;
        if (animate) {
          text.style.transition = 'none';
          text.dataset.leaving = '';
          text.getBoundingClientRect();
          text.style.transition = '';
          delete text.dataset.leaving;
        }
      }
      slips.hidden = model.slips === '';
      slipText.textContent = model.slips;
    },
  };
}

export { elbowPath, zPath } from '../shared/line';
export type { LinePoint } from '../shared/line';

export interface LineParts {
  el: SVGSVGElement;
  /** `d` overrides the default one-elbow route. */
  show(from: LinePoint, to: LinePoint, draw: number, d?: string): void;
  hide(): void;
}

export function buildLine(): LineParts {
  const root = svg('svg', { class: 'rb-line', 'aria-hidden': 'true' });
  const path = svg('path', { pathLength: '1' });
  path.style.strokeDasharray = '1';
  const a = svg('circle', { r: '1.5' });
  const b = svg('circle', { r: '1.5' });
  root.append(path, a, b);
  root.style.display = 'none';
  return {
    el: root,
    show(from, to, draw, d) {
      root.style.display = '';
      path.setAttribute('d', d ?? elbowPath(from, to));
      path.style.strokeDashoffset = String(1 - draw);
      a.setAttribute('cx', String(from.x));
      a.setAttribute('cy', String(from.y));
      b.setAttribute('cx', String(to.x));
      b.setAttribute('cy', String(to.y));
      a.style.opacity = draw > 0 ? '1' : '0';
      b.style.opacity = draw >= 1 ? '1' : '0';
    },
    hide() {
      root.style.display = 'none';
    },
  };
}
