/**
 * Mini demos for the three proofs and the compose reproduction. Each one runs
 * the real engine on a short reply, shows the guard card with its citation,
 * and lets the visitor click the fix (the swap-back plays) or try the quiet
 * case that must not fire. Nothing here is a screenshot or a recording.
 */
import { SAMPLES, sampleInput } from '../shared/samples';
import type { Sample } from '../shared/samples';
import { locateCitation } from '../shared/snippet';
import { createGhost, playGhost } from '../shared/swap';
import { h } from '../shared/dom';
import { buildGuardCard, buildLine, buildPill, renderText, zPath } from './parts';
import type { Eng, FlagT, TextSpan } from './parts';

export interface Variant {
  /** Button label, set in mono: what the visitor "types". */
  label: string;
  draft: string;
  /** Said under the reply when the engine stays quiet. */
  quiet: string;
}

export interface MiniConfig {
  sampleId: string;
  /** Lines of the sample message to show as the thread. Must appear in the message. */
  excerpt: string;
  variants: readonly Variant[];
  pill: boolean;
}

export const PROOFS: Record<string, MiniConfig> = {
  names: {
    sampleId: 'deposit',
    excerpt: 'Thanks,\nKathryn',
    pill: false,
    variants: [
      { label: 'Catherine', draft: 'Hi Catherine,', quiet: '' },
      {
        label: 'Bob',
        draft: 'Hi Bob,',
        quiet: 'No slip. Bob is not a near-miss of anyone in the thread, so Readback says nothing.',
      },
    ],
  },
  numbers: {
    sampleId: 'deposit',
    excerpt: 'can you confirm the $1,250 deposit, drop off the keys on Thursday the 12th',
    pill: false,
    variants: [
      { label: '$1,520', draft: 'The $1,520 deposit is confirmed.', quiet: '' },
      {
        label: '$1,200',
        draft: 'Could we do $1,200 instead?',
        quiet: 'No slip. A different amount in a counter-offer is a negotiation, not a typo.',
      },
    ],
  },
  dates: {
    sampleId: 'deposit',
    excerpt: 'drop off the keys on Thursday the 12th, and send the signed lease back?',
    pill: true,
    variants: [
      {
        label: 'Thursday the 10th',
        draft:
          "The $1,250 deposit is confirmed and I'll send the signed lease back. I'll drop the keys off Thursday the 10th.",
        quiet: '',
      },
      {
        label: 'Monday the 23rd',
        draft:
          "The $1,250 deposit is confirmed and I'll send the signed lease back. I'll drop the keys off Monday the 23rd.",
        quiet:
          'No slip. A different day altogether reads as a new proposal, so Readback assumes you meant it.',
      },
    ],
  },
};

export interface Mini {
  /** Runs the first variant's fix once, as if clicked (used when scrolled into view). */
  demonstrate(): void;
  destroy(): void;
}

const TODAY = new Date('2026-11-02T09:00:00Z');

export function mountMini(host: HTMLElement, eng: Eng, cfg: MiniConfig, reduced: boolean): Mini {
  const sample: Sample | undefined = SAMPLES.find((s) => s.id === cfg.sampleId);
  if (!sample) throw new Error(`unknown sample ${cfg.sampleId}`);
  const ctx = eng.createContext(sampleInput(sample), TODAY);
  const run = (text: string): ReturnType<typeof eng.check> =>
    eng.check(ctx, { text, version: 1 }, { today: TODAY });

  let variant = 0;
  let draft = cfg.variants[0]?.draft ?? '';
  let cancelGhost: (() => void) | undefined;
  let fixedSpan: { start: number; end: number } | undefined;
  let touched = false;

  const excerptAt = sample.message.indexOf(cfg.excerpt);
  const excerptText = excerptAt >= 0 ? cfg.excerpt : cfg.excerpt;

  const threadEl = h('div', { class: 'mini__thread' });
  const chip = h('span', { class: 'chip', text: 'Sample thread' });
  const threadText = h('div');
  threadEl.append(chip, threadText);

  const editor = h('div', { class: 'editor' });
  const pill = buildPill();
  const replyEl = h('div', { class: 'mini__reply' }, editor, cfg.pill ? pill.el : null);
  const quiet = h('p', { class: 'mini__quiet', attrs: { 'aria-live': 'polite' } });
  const cardSlot = h('div', { class: 'mini__card' });
  const tryRow = h(
    'div',
    { class: 'mini__try' },
    h('span', { class: 't-caption subtle', text: 'Try this reply' }),
  );
  const buttons = cfg.variants.map((v, i) =>
    h('button', {
      class: 'seg',
      text: v.label,
      attrs: { type: 'button', 'aria-pressed': i === 0 ? 'true' : 'false' },
    }),
  );
  tryRow.append(...buttons);
  const line = buildLine();
  const root = h('div', { class: 'mini' }, threadEl, replyEl, quiet, cardSlot, tryRow, line.el);
  host.replaceChildren(root);

  const rel = (el: Element): { left: number; top: number; right: number; bottom: number } => {
    const rr = root.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return {
      left: r.left - rr.left,
      top: r.top - rr.top,
      right: r.right - rr.left,
      bottom: r.bottom - rr.top,
    };
  };

  let flag: FlagT | undefined;
  const renderThread = (cite: { start: number; end: number } | undefined, on: boolean): void => {
    threadText.replaceChildren();
    if (cite && on) {
      threadText.append(
        excerptText.slice(0, cite.start),
        h('span', {
          class: 'cited',
          text: excerptText.slice(cite.start, cite.end),
          data: { cite: '' },
        }),
        excerptText.slice(cite.end),
      );
    } else if (cite) {
      threadText.append(
        excerptText.slice(0, cite.start),
        h('span', { text: excerptText.slice(cite.start, cite.end), data: { cite: '' } }),
        excerptText.slice(cite.end),
      );
    } else {
      threadText.append(excerptText);
    }
  };

  const render = (): void => {
    const result = run(draft);
    flag = result.flags[0];
    const cite = flag
      ? locateCitation(excerptText, flag.citation.line, flag.citation.text)
      : undefined;
    renderThread(cite, flag !== undefined);

    const spans: TextSpan[] = result.flags.map((f) => ({
      id: f.id,
      start: f.draftSpan.start,
      end: f.draftSpan.end,
      kind: 'slip',
      active: true,
    }));
    if (fixedSpan) spans.push({ id: 'fixed', ...fixedSpan, kind: 'fixed' });
    renderText(eng, editor, draft, spans, false);

    const model = eng.pillModel(result);
    pill.set({ tone: model.tone, text: model.label, slips: model.slipLabel }, false);

    cardSlot.replaceChildren();
    cardSlot.hidden = flag === undefined;
    const variantQuiet = cfg.variants[variant]?.quiet ?? '';
    quiet.textContent = !flag && !fixedSpan ? variantQuiet : '';
    quiet.toggleAttribute('data-ok', false);
    if (flag) {
      const parts = buildGuardCard(eng, flag, sample.sentAt, { class: 'gcard' });
      parts.el.dataset.state = 'in';
      parts.fixes.forEach((btn, i) => {
        btn.addEventListener('click', () => {
          touched = true;
          applyFix(flag as FlagT, i);
        });
      });
      parts.ignore.addEventListener('click', () => {
        touched = true;
        cardSlot.hidden = true;
        line.hide();
        quiet.textContent = 'Ignored for this thread. Readback will not mention it again here.';
      });
      cardSlot.append(parts.el);
    }
    drawLine();
  };

  const drawLine = (): void => {
    const slipEl = editor.querySelector('.slip');
    const tokenEl = threadText.querySelector('[data-cite]');
    if (!flag || !slipEl || !tokenEl) {
      line.hide();
      return;
    }
    const s = rel(slipEl);
    const t = rel(tokenEl);
    const from = { x: (s.left + s.right) / 2, y: s.top - 2 };
    const to = { x: (t.left + t.right) / 2, y: t.bottom + 2 };
    const midY = (rel(threadEl).bottom + rel(replyEl).top) / 2;
    line.show(from, to, 1, zPath(from, to, midY));
  };

  const applyFix = (f: FlagT, index: number): void => {
    const fix = f.fixes[index];
    if (!fix) return;
    cancelGhost?.();
    const before = draft.slice(f.draftSpan.start, f.draftSpan.end);
    const next = draft.slice(0, f.draftSpan.start) + fix.replacement + draft.slice(f.draftSpan.end);
    draft = next;
    fixedSpan = { start: f.draftSpan.start, end: f.draftSpan.start + fix.replacement.length };
    render();
    quiet.textContent = `Fixed: ${fix.replacement}. Ctrl+Z would undo it in the extension.`;
    quiet.setAttribute('data-ok', '');
    line.hide();
    if (reduced) {
      fixedSpan = undefined;
      return;
    }
    const word = editor.querySelector('[data-id="fixed"]');
    if (!word) {
      fixedSpan = undefined;
      return;
    }
    const rr = replyEl.getBoundingClientRect();
    const wr = word.getBoundingClientRect();
    const ghost = createGhost({
      container: replyEl,
      host: editor,
      rect: {
        left: wr.left - rr.left - 1,
        top: wr.top - rr.top - 1,
        width: wr.width,
        height: wr.height,
      },
      from: before,
      to: fix.replacement,
      background: getComputedStyle(replyEl).backgroundColor,
    });
    if (!ghost) {
      fixedSpan = undefined;
      return;
    }
    cancelGhost = playGhost(ghost, () => {
      cancelGhost = undefined;
      fixedSpan = undefined;
    });
  };

  const choose = (i: number): void => {
    cancelGhost?.();
    cancelGhost = undefined;
    fixedSpan = undefined;
    variant = i;
    draft = cfg.variants[i]?.draft ?? '';
    buttons.forEach((b, j) => {
      b.setAttribute('aria-pressed', j === i ? 'true' : 'false');
    });
    render();
  };

  buttons.forEach((b, i) => {
    b.addEventListener('click', () => {
      touched = true;
      choose(i);
    });
  });

  const onResize = (): void => {
    drawLine();
  };
  window.addEventListener('resize', onResize);

  render();
  void document.fonts.ready.then(drawLine);

  return {
    demonstrate() {
      if (touched || !flag || variant !== 0) return;
      applyFix(flag, 0);
    },
    destroy() {
      cancelGhost?.();
      window.removeEventListener('resize', onResize);
      host.replaceChildren();
    },
  };
}
