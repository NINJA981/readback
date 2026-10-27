/**
 * Beat 2: the overlay at rest in a reply box. One squiggle, one pill, no card,
 * nothing else changed. Built from the engine's output for a short draft.
 */
import { SAMPLES, sampleInput } from '../shared/samples';
import { h } from '../shared/dom';
import { buildPill, renderText } from './parts';
import type { Eng } from './parts';

const TODAY = new Date('2026-11-02T09:00:00Z');
const DRAFT =
  "Hi Catherine,\n\nThe $1,250 deposit is confirmed, and I'll send the signed lease tonight.\n\nSam";

export function mountCompose(host: HTMLElement, eng: Eng): void {
  const sample = SAMPLES[0];
  if (!sample) return;
  const ctx = eng.createContext(sampleInput(sample), TODAY);
  const result = eng.check(ctx, { text: DRAFT, version: 1 }, { today: TODAY });

  const body = h('div', { class: 'compose__body' });
  renderText(
    eng,
    body,
    DRAFT,
    result.flags.map((f) => ({
      id: f.id,
      start: f.draftSpan.start,
      end: f.draftSpan.end,
      kind: 'slip' as const,
    })),
    false,
  );
  const pill = buildPill();
  const model = eng.pillModel(result);
  pill.set({ tone: model.tone, text: model.label, slips: model.slipLabel });
  body.append(pill.el);

  const box = h(
    'div',
    { class: 'compose' },
    h(
      'div',
      { class: 'compose__bar' },
      h('span', { text: 'Re: Keys and deposit' }),
      h('span', { class: 'chip', text: 'Sample thread' }),
    ),
    h(
      'div',
      { class: 'compose__field' },
      h('span', { text: 'To' }),
      h('b', { text: 'Kathryn Moss' }),
    ),
    body,
    h('div', { class: 'compose__foot' }, h('span', { class: 'fake-send', text: 'Send' })),
  );
  host.replaceChildren(box);
}
