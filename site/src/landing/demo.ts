/**
 * The hero: the real engine driving a scripted reply (SPEC section 11, DESIGN.md
 * "Signature moment"). Everything on screen is a pure function of the timeline
 * time `t` (milliseconds): the typed text, the squiggles, the card, the
 * readback line, the pointer, the pill and the swap-back ghost. No
 * `Date.now()`, no randomness. `frame(t)` therefore renders the same pixels
 * every time, which is how the poster is captured (`?demo=signature&t=4600`).
 *
 * The squiggles, citations, fixes and pill labels are the engine's own output
 * for the draft at time `t`; the script only decides what is typed when, and
 * when the pointer clicks.
 */
import { SAMPLES, sampleInput } from '../shared/samples';
import { locateCitation } from '../shared/snippet';
import { createGhost, easeInOut, easeOut } from '../shared/swap';
import type { Ghost } from '../shared/swap';
import { h, setIcon, svg } from '../shared/dom';
import { iconSvg } from '../shared/icons';
import { gutterPath } from '../shared/line';
import { buildGuardCard, buildLine, buildPill, renderText } from './parts';
import type { CardParts, Eng, FlagT, LineParts, PillParts, TextSpan } from './parts';

export const DEMO_MS = 10200;

/** Timeline, in ms from frame 0. */
export const T = {
  type1: [1400, 2330] as const,
  open: [3300, 7200] as const,
  click: [4900, 7800] as const,
  type2: [5300, 6700] as const,
  type3: [8100, 9500] as const,
  cardIn: 160,
  cardOut: 120,
  lineDraw: 240,
  fixedShow: 1500,
  corner: 9500,
};

/** Frames worth keeping as stills: empty, name card, number card, resolved. */
export const KEYFRAMES = [1000, 4600, 7600, 9800] as const;

const S1 = 'Hi Catherine,';
const S2 = '\n\nThe $1,520 deposit is confirmed';
const S3 = ", and I'll drop the keys off Thursday the 12th and send the lease tonight.\n\nSam";
const TODAY = new Date('2026-11-02T09:00:00Z');

export type Layout = 'wide' | 'narrow';

export interface HeroOptions {
  stage: HTMLElement;
  eng: Eng;
  layout: Layout;
  /** Reduced motion: no morph, no line draw, no card scale, no pointer. */
  reduced: boolean;
}

export interface Hero {
  frame(t: number): void;
  play(from?: number): void;
  pause(): void;
  resume(): void;
  readonly playing: boolean;
  readonly time: number;
  resize(): void;
  destroy(): void;
  onChange(listener: () => void): void;
}

interface FixInfo {
  flag: FlagT;
  start: number;
  before: string;
  rep: string;
  after: string;
}

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface Geometry {
  slip: Rect;
  token: Rect | undefined;
  button: Rect;
  card: { left: number; top: number };
}

const typed = (t: number, [a, b]: readonly [number, number], s: string): string => {
  if (t <= a) return '';
  if (t >= b) return s;
  return s.slice(0, Math.max(1, Math.floor(((t - a) / (b - a)) * s.length)));
};

export function mountHero(opts: HeroOptions): Hero {
  const { stage, eng, layout, reduced } = opts;
  const design = layout === 'wide' ? { w: 680, h: 560 } : { w: 343, h: 512 };
  const sample = SAMPLES[0];
  if (!sample) throw new Error('missing hero sample');
  const ctx = eng.createContext(sampleInput(sample), TODAY);
  const cache = new Map<string, ReturnType<typeof eng.check>>();
  const run = (text: string): ReturnType<typeof eng.check> => {
    let r = cache.get(text);
    if (!r) {
      r = eng.check(ctx, { text, version: 1 }, { today: TODAY });
      if (cache.size > 400) cache.clear();
      cache.set(text, r);
    }
    return r;
  };

  const doFix = (text: string): FixInfo => {
    const flag = run(text).flags[0];
    const fix = flag?.fixes[0];
    if (!flag || !fix) throw new Error('hero script expected a flag');
    return {
      flag,
      start: flag.draftSpan.start,
      before: flag.found,
      rep: fix.replacement,
      after: text.slice(0, flag.draftSpan.start) + fix.replacement + text.slice(flag.draftSpan.end),
    };
  };
  const fix0 = doFix(S1);
  const fix1 = doFix(fix0.after + S2);
  const fixes = [fix0, fix1] as const;
  const textBeforeFix = [S1, fix0.after + S2] as const;

  const draftAt = (t: number): string => {
    let d = typed(t, T.type1, S1);
    if (t < T.click[0]) return d;
    d = fix0.after;
    d += typed(t, T.type2, S2);
    if (t < T.click[1]) return d;
    d = fix1.after;
    d += typed(t, T.type3, S3);
    return d;
  };

  const typingAt = (t: number): boolean =>
    (t > T.type1[0] && t < T.type1[1]) ||
    (t > T.type2[0] && t < T.type2[1]) ||
    (t > T.type3[0] && t < T.type3[1]);

  // ---- DOM -----------------------------------------------------------------
  const message = eng.splitMessage(sample.message);
  const threadText = `${message.body.trim()}\n\n${message.signature.trim()}`;
  const cites = fixes.map((f) =>
    locateCitation(threadText, f.flag.citation.line, f.flag.citation.text),
  );

  const threadBody = h('div', { class: 'tcard__body' });
  {
    const marks = cites
      .map((c, i) => (c ? { ...c, i } : undefined))
      .filter((c): c is { start: number; end: number; i: number } => c !== undefined)
      .sort((a, b) => a.start - b.start);
    let at = 0;
    for (const m of marks) {
      if (m.start < at) continue;
      threadBody.append(threadText.slice(at, m.start));
      threadBody.append(
        h('span', { text: threadText.slice(m.start, m.end), data: { cite: String(m.i) } }),
      );
      at = m.end;
    }
    threadBody.append(threadText.slice(at));
  }
  const tcard = h(
    'div',
    { class: 'tcard' },
    h(
      'div',
      { class: 'card__head' },
      h(
        'div',
        {},
        h('span', { class: 'card__who', text: 'Kathryn Moss' }),
        h('span', { class: 'card__sub', text: 'To Sam Ortiz, 2 Nov 2026' }),
      ),
      h('span', { class: 'chip', text: 'Sample thread' }),
    ),
    threadBody,
  );

  const editor = h('div', { class: 'editor' });
  const pill: PillParts = buildPill();
  const rcard = h(
    'div',
    { class: 'rcard' },
    h(
      'div',
      { class: 'card__head' },
      h(
        'div',
        {},
        h('span', { class: 'card__who', text: 'Reply' }),
        h('span', { class: 'card__sub', text: 'To Kathryn Moss' }),
      ),
    ),
    editor,
    pill.el,
  );

  const cards: CardParts[] = fixes.map((f) => buildGuardCard(eng, f.flag, sample.sentAt));
  for (const c of cards) {
    c.el.setAttribute('aria-hidden', 'true');
    for (const b of [...c.fixes, c.ignore]) b.tabIndex = -1;
  }
  const lines: LineParts[] = [buildLine(), buildLine()];

  const pointer = svg('svg', {
    class: 'pointer',
    viewBox: '0 0 18 18',
    width: '18',
    height: '18',
    'aria-hidden': 'true',
  });
  const arrow = svg('path', {
    d: 'M3 2 L3 14.5 L6.4 11.4 L8.7 16.4 L10.8 15.5 L8.5 10.6 L13 10.6 Z',
    fill: 'currentColor',
    stroke: 'var(--rb-bg)',
    'stroke-width': '1',
    'stroke-linejoin': 'round',
  });
  pointer.append(arrow);

  const corner = h('span', { class: 'chip stage__corner' });
  corner.append(h('span', { text: '0 network requests' }));

  const live = h('div', { class: 'live' }, tcard, rcard, ...cards.map((c) => c.el));
  live.append(...lines.map((l) => l.el), pointer, corner);

  stage.dataset.layout = layout;
  stage.append(live);

  // ---- geometry ------------------------------------------------------------
  let scale = 1;
  const resize = (): void => {
    const w = stage.clientWidth;
    scale = w > 0 ? w / design.w : 1;
    live.style.setProperty('--s', String(scale));
  };
  resize();

  const rel = (el: Element): Rect => {
    const lr = live.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return {
      left: (r.left - lr.left) / scale,
      top: (r.top - lr.top) / scale,
      right: (r.right - lr.left) / scale,
      bottom: (r.bottom - lr.top) / scale,
    };
  };

  const geometry: (Geometry | undefined)[] = [undefined, undefined];
  const measure = (): void => {
    resize();
    for (const i of [0, 1] as const) {
      const f = fixes[i];
      renderText(
        eng,
        editor,
        textBeforeFix[i],
        [
          {
            id: f.flag.id,
            start: f.flag.draftSpan.start,
            end: f.flag.draftSpan.end,
            kind: 'slip',
          },
        ],
        false,
      );
      const slipEl = editor.querySelector('[data-id]');
      const card = cards[i];
      if (!slipEl || !card) continue;
      const slip = rel(slipEl);
      const width = 276;
      const left =
        layout === 'wide'
          ? Math.min(Math.max(slip.left - 34, 204), design.w - 12 - width)
          : Math.round((design.w - width) / 2);
      const top = slip.bottom + 8;
      card.el.style.left = `${left}px`;
      card.el.style.top = `${top}px`;
      const prev = card.el.style.opacity;
      card.el.style.opacity = '0';
      const btn = card.fixes[0];
      const button = btn ? rel(btn) : { left, top, right: left, bottom: top };
      card.el.style.opacity = prev;
      const tokenEl = tcard.querySelector(`[data-cite="${i}"]`);
      geometry[i] = {
        slip,
        token: tokenEl ? rel(tokenEl) : undefined,
        button,
        card: { left, top },
      };
    }
    lastKey = '';
  };

  // ---- the frame function --------------------------------------------------
  let lastKey = '';
  let lastPill = '';
  let ghost: { i: number; g: Ghost } | undefined;
  let cur = 0;

  const slotPhase = (
    i: 0 | 1,
    t: number,
  ): { vis: number; scale: number; draw: number; active: boolean; open: boolean } => {
    const open = T.open[i];
    const click = T.click[i];
    if (t >= open && t < click) {
      const p = easeOut((t - open) / T.cardIn);
      return {
        vis: reduced ? 1 : p,
        scale: reduced ? 1 : 0.96 + 0.04 * p,
        draw: reduced ? 1 : easeInOut((t - open) / T.lineDraw),
        active: true,
        open: true,
      };
    }
    if (t >= click && t < click + T.cardOut) {
      const q = (t - click) / T.cardOut;
      return { vis: 1 - q, scale: 1, draw: 1, active: false, open: true };
    }
    return { vis: 0, scale: 0.96, draw: 0, active: false, open: false };
  };

  const fixPhase = (t: number): { i: 0 | 1; p: number } | undefined => {
    for (const i of [0, 1] as const) {
      const dur = i === 0 ? 280 : 240;
      if (t >= T.click[i] && t < T.click[i] + dur) return { i, p: (t - T.click[i]) / dur };
    }
    return undefined;
  };

  const fixedLabelAt = (t: number): string | undefined => {
    for (const i of [0, 1] as const) {
      const start = T.click[i] + (i === 0 ? 280 : 240);
      if (t >= start && t < start + T.fixedShow) return eng.fixedLabel(fixes[i].rep);
    }
    return undefined;
  };

  const pillModelAt = (
    t: number,
  ): { tone: 'open' | 'covered' | 'hidden'; text: string; slips: string } => {
    const fixed = fixedLabelAt(t);
    const m = eng.pillModel(run(draftAt(t)));
    if (fixed) return { tone: 'open', text: fixed, slips: '' };
    return { tone: m.tone, text: m.label, slips: m.slipLabel };
  };

  type Key = { t: number; x: number; y: number; o: number };
  const pointerAt = (
    t: number,
  ): { x: number; y: number; o: number; press: boolean } | undefined => {
    const g0 = geometry[0];
    const g1 = geometry[1];
    if (!g0 || !g1 || reduced) return undefined;
    const c = (r: Rect): { x: number; y: number } => ({
      x: (r.left + r.right) / 2,
      y: (r.top + r.bottom) / 2,
    });
    const s0 = c(g0.slip);
    const s1 = c(g1.slip);
    const b0 = c(g0.button);
    const b1 = c(g1.button);
    const at = (p: { x: number; y: number }, dx = 0, dy = 0): { x: number; y: number } => ({
      x: p.x + dx,
      y: p.y + dy,
    });
    const keys: Key[] = [
      { t: 2400, ...at(s0, 80, 70), o: 0 },
      { t: 2900, ...s0, o: 1 },
      { t: 4300, ...s0, o: 1 },
      { t: 4800, ...b0, o: 1 },
      { t: 4960, ...b0, o: 1 },
      { t: 5200, ...b0, o: 0 },
      { t: 6600, ...at(s1, 80, 70), o: 0 },
      { t: 6900, ...s1, o: 1 },
      { t: 7500, ...s1, o: 1 },
      { t: 7760, ...b1, o: 1 },
      { t: 7860, ...b1, o: 1 },
      { t: 8100, ...b1, o: 0 },
    ];
    const first = keys[0];
    const last = keys[keys.length - 1];
    if (!first || !last || t < first.t || t > last.t) return undefined;
    for (let i = 0; i < keys.length - 1; i += 1) {
      const a = keys[i] as Key;
      const b = keys[i + 1] as Key;
      if (t >= a.t && t <= b.t) {
        const u = (t - a.t) / (b.t - a.t);
        const e = easeInOut(u);
        const press = (t >= 4880 && t <= 4960) || (t >= 7780 && t <= 7860);
        return {
          x: a.x + (b.x - a.x) * e,
          y: a.y + (b.y - a.y) * e,
          o: a.o + (b.o - a.o) * u,
          press,
        };
      }
    }
    return undefined;
  };

  const frame = (t: number): void => {
    cur = Math.max(0, Math.min(DEMO_MS, t));
    t = cur;
    const draft = draftAt(t);
    const result = run(draft);
    const phases = [slotPhase(0, t), slotPhase(1, t)] as const;
    const fx = fixPhase(t);

    const spans: TextSpan[] = result.flags.map((f) => ({
      id: f.id,
      start: f.draftSpan.start,
      end: f.draftSpan.end,
      kind: 'slip',
      active:
        (phases[0].active && f.id === fix0.flag.id) || (phases[1].active && f.id === fix1.flag.id),
    }));
    if (fx) {
      const info = fixes[fx.i];
      spans.push({
        id: 'fixed',
        start: info.start,
        end: info.start + info.rep.length,
        kind: 'fixed',
      });
    }
    const caret = t < T.corner && (typingAt(t) || Math.floor(t / 530) % 2 === 0);
    const key = `${draft}|${spans.map((s) => `${s.id}${s.start}${s.active ? 'a' : ''}`).join(',')}|${caret ? 1 : 0}`;
    if (key !== lastKey) {
      renderText(eng, editor, draft, spans, caret);
      lastKey = key;
    }

    // Swap-back ghost.
    if (!fx || reduced) {
      if (ghost) {
        ghost.g.destroy();
        ghost = undefined;
      }
    } else {
      if (ghost && ghost.i !== fx.i) {
        ghost.g.destroy();
        ghost = undefined;
      }
      if (!ghost) {
        const info = fixes[fx.i];
        const word = editor.querySelector('[data-id="fixed"]');
        if (word) {
          const rr = rcard.getBoundingClientRect();
          const wr = word.getBoundingClientRect();
          const g = createGhost({
            container: rcard,
            host: editor,
            rect: {
              left: (wr.left - rr.left) / scale - 1,
              top: (wr.top - rr.top) / scale - 1,
              width: wr.width / scale,
              height: 20,
            },
            from: info.before,
            to: info.rep,
            background: getComputedStyle(rcard).backgroundColor,
          });
          if (g) ghost = { i: fx.i, g };
        }
      }
      ghost?.g.set(fx.p);
    }

    // Cards, lines, cited tokens.
    for (const i of [0, 1] as const) {
      const ph = phases[i];
      const card = cards[i];
      const g = geometry[i];
      const line = lines[i];
      if (!card || !line) continue;
      card.el.style.opacity = String(ph.vis);
      card.el.style.transform = `scale(${ph.scale})`;
      const tok = tcard.querySelector(`[data-cite="${i}"]`);
      tok?.classList.toggle('cited', ph.open && t < T.click[i] + T.cardOut);
      if (g && g.token && ph.open) {
        const from = { x: (g.slip.left + g.slip.right) / 2, y: g.slip.bottom + 5 };
        if (layout === 'narrow') {
          const to = { x: g.token.left - 1, y: g.token.bottom + 2 };
          line.show(from, to, ph.draw, gutterPath(from, to, 237, 8));
        } else {
          const above = g.token.bottom < from.y;
          const to = {
            x: (g.token.left + g.token.right) / 2,
            y: above ? g.token.bottom + 2 : g.token.top - 2,
          };
          line.show(from, to, ph.draw);
        }
        line.el.style.opacity = String(ph.vis);
      } else {
        line.hide();
      }
      const btn = card.fixes[0];
      if (btn) {
        const press = t >= T.click[i] - 20 && t <= T.click[i] + 60 && !reduced;
        if (press) btn.dataset.pressed = '';
        else delete btn.dataset.pressed;
      }
    }

    // Pointer.
    const pt = pointerAt(t);
    if (pt) {
      pointer.style.opacity = String(pt.o);
      pointer.style.transform = `translate(${pt.x - 3}px, ${pt.y - 2}px) scale(${pt.press ? 0.9 : 1})`;
    } else {
      pointer.style.opacity = '0';
    }

    // Pill.
    const model = pillModelAt(t);
    const sig = `${model.tone}|${model.text}|${model.slips}`;
    pill.set(model, sig !== lastPill && !reduced && playingFlag);
    lastPill = sig;

    // On the narrow layout the open card would cover most of the pill, so the pill steps aside.
    pill.el.style.visibility =
      layout === 'narrow' && (phases[0].vis > 0 || phases[1].vis > 0) ? 'hidden' : '';

    corner.style.opacity = t >= T.corner ? '1' : '0';
  };

  // ---- playback ------------------------------------------------------------
  let raf = 0;
  let startPerf = 0;
  let offset = 0;
  let playingFlag = false;
  const listeners: (() => void)[] = [];
  const emit = (): void => {
    for (const l of listeners) l();
  };

  const tick = (now: number): void => {
    const t = offset + (now - startPerf);
    if (t >= DEMO_MS) {
      frame(DEMO_MS);
      playingFlag = false;
      emit();
      return;
    }
    frame(t);
    raf = requestAnimationFrame(tick);
  };

  const hero: Hero = {
    frame(t) {
      playingFlag = false;
      cancelAnimationFrame(raf);
      frame(t);
      emit();
    },
    play(from = 0) {
      cancelAnimationFrame(raf);
      offset = from;
      startPerf = performance.now();
      playingFlag = true;
      stage.dataset.state = 'playing';
      emit();
      raf = requestAnimationFrame(tick);
    },
    pause() {
      if (!playingFlag) return;
      cancelAnimationFrame(raf);
      offset = cur;
      playingFlag = false;
      emit();
    },
    resume() {
      if (playingFlag) return;
      if (cur >= DEMO_MS) {
        hero.play(0);
        return;
      }
      offset = cur;
      startPerf = performance.now();
      playingFlag = true;
      emit();
      raf = requestAnimationFrame(tick);
    },
    get playing() {
      return playingFlag;
    },
    get time() {
      return cur;
    },
    resize() {
      measure();
      frame(cur);
    },
    destroy() {
      cancelAnimationFrame(raf);
      ghost?.g.destroy();
      live.remove();
      delete stage.dataset.layout;
    },
    onChange(listener) {
      listeners.push(listener);
    },
  };

  measure();
  frame(KEYFRAMES[1]);
  return hero;
}

/** Control labels (icon + text) for the demo buttons. */
export function setButton(
  btn: HTMLElement,
  icon: 'play' | 'pause' | 'rotate-ccw',
  label?: string,
): void {
  const iconHost = btn.querySelector('[data-icon]');
  if (iconHost) setIcon(iconHost, iconSvg(icon, 16));
  const labelHost = btn.querySelector('[data-label]');
  if (labelHost && label) labelHost.textContent = label;
}
