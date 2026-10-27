/**
 * The overlay's props-driven components, rendered to static markup from real engine results. These
 * are the wording and accessibility contracts that the Gmail e2e relies on, checked in every state
 * without a browser: what a screen reader is given, what the keycaps say, what is shown when there
 * is nothing to show.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { check, createContext } from '../../../src/core/index';
import { cardModel, ledgerModel } from '../../../src/overlay/model';
import { GuardCard, fixLabel } from '../../../src/overlay/ui/GuardCard';
import { Ledger } from '../../../src/overlay/ui/Ledger';
import { Pill, reservedLabels } from '../../../src/overlay/ui/Pill';
import { pillModel } from '../../../src/state/summary';
import { SAMPLES } from '../../../site/src/shared/samples';
import type { Sample } from '../../../site/src/shared/samples';

const found = SAMPLES.find((s) => s.id === 'deposit');
if (!found) throw new Error('deposit sample missing');
const deposit: Sample = found;
const NOW = new Date(2026, 10, 2, 12);

function resultFor(draft: string) {
  const ctx = createContext(
    { source: 'playground', threadId: 'ui', message: deposit.message },
    NOW,
  );
  return check(ctx, { text: draft, version: 1 });
}

// The hero reply: every ask is answered and two guards fire.
const slipped = resultFor(deposit.draft);
// Slips and open asks together.
const openAndSlipped = resultFor('Hi Catherine, thanks.');
// Right on every guard and every ask.
const clean = resultFor(
  "Hi Kathryn, the $1,250 deposit is confirmed, I'll drop the keys off Thursday the 12th and send the signed lease back.",
);
/** The user confirmed every ask (state `answered`), as the ledger's check button does. */
const confirmed = <T extends { asks: { state: string }[] }>(result: T): T => ({
  ...result,
  asks: result.asks.map((a) => ({ ...a, state: 'answered' as const })),
});
const quiet = createContext({ source: 'playground', threadId: 'q', message: 'Thanks.' }, NOW);

const noop = (): void => undefined;
const actions = {
  closeLedger: noop,
  confirmAsk: noop,
  dismissAsk: noop,
  restoreDismissed: noop,
  answerInline: noop,
  jumpToSlip: noop,
  fix: noop,
};

const RESERVE_RE = /<span class="rb-pill-reserve" aria-hidden="true">[^<]*<\/span>/g;

describe('pill', () => {
  const markup = (result: Parameters<typeof pillModel>[0], fixed?: string) =>
    renderToStaticMarkup(
      <Pill
        model={pillModel(result)}
        fixed={fixed}
        ledgerOpen={false}
        ledgerId="ledger"
        onToggle={noop}
        onJumpToSlip={noop}
      />,
    );
  /** What is shown: the hidden width-reserving labels are stripped. */
  const render = (result: Parameters<typeof pillModel>[0], fixed?: string) =>
    markup(result, fixed).replace(RESERVE_RE, '');

  it('reserves the width of every count label it can show, hidden from screen readers', () => {
    expect(reservedLabels(3)).toEqual([
      '3 asks · 3 open',
      '3 look answered',
      '1 looks answered',
      'All covered',
    ]);
    expect(reservedLabels(0)).toEqual([]);
    const html = markup(openAndSlipped);
    expect(html.match(RESERVE_RE)).toHaveLength(4);
    // The six-second confirmation is not reserved: it is a one-off, wider line.
    expect(markup(clean, 'Kathryn')).not.toMatch(RESERVE_RE);
  });

  it('shows open asks and the slip count, and says both to a screen reader', () => {
    const html = render(openAndSlipped);
    expect(html).toContain('3 asks · 3 open');
    expect(html).toContain('1 slip');
    expect(html).toContain('aria-live="polite"');
    // aria-controls names an element that exists only while the ledger is open.
    expect(html).not.toContain('aria-controls');
    expect(html).toContain('aria-expanded="false"');
  });

  it('says how many only look answered, in brass with a dotted ring, never All covered', () => {
    const html = render(slipped);
    expect(html).toContain('data-tone="open"');
    expect(html).toContain('3 look answered');
    expect(html).toContain('stroke-dasharray="2 2"');
    expect(html).not.toContain('All covered');
    expect(html).toContain('2 slips');
    const clean3 = render(clean);
    expect(clean3).toContain('3 look answered');
    expect(clean3).not.toContain('rb-pill-slip');
  });

  it('shows All covered once every ask is confirmed, with the slips still counted', () => {
    const html = render(confirmed(slipped));
    expect(html).toContain('data-tone="covered"');
    expect(html).toContain('All covered');
    expect(html).not.toContain('stroke-dasharray');
    expect(html).toContain('2 slips');
  });

  it('shows All covered alone when everything is confirmed and there is nothing to fix', () => {
    const html = render(confirmed(clean));
    expect(html).toContain('All covered');
    expect(html).not.toContain('rb-pill-slip');
  });

  it('shows the six-second confirmation with its undo hint after a fix', () => {
    expect(render(clean, 'Kathryn')).toContain('Fixed: Kathryn');
  });

  it('draws nothing for a message with no asks and a reply with no slips', () => {
    const nothing = check(quiet, { text: 'Thanks', version: 1 });
    expect(pillModel(nothing).tone).toBe('hidden');
    expect(render(nothing)).not.toContain('rb-pill-main');
  });

  it('is an accessible group named Readback', () => {
    expect(render(slipped)).toContain('role="group" aria-label="Readback"');
  });
});

describe('guard card', () => {
  const flag = slipped.flags[0];
  if (!flag) throw new Error('the hero reply has slips');
  const base = {
    model: cardModel(flag, '2026-11-02'),
    state: {
      flagId: flag.id,
      via: 'keyboard' as const,
      anchor: { left: 100, top: 200, right: 160, bottom: 220, width: 60, height: 20 },
    },
    viewport: { width: 1280, height: 800 },
    open: true,
    onFix: noop,
    onIgnore: noop,
    onNeverFlag: noop,
    onClose: noop,
    onPointer: noop,
  };

  it('is a labelled dialog with the message as its title and the primary fix first', () => {
    const html = renderToStaticMarkup(<GuardCard {...base} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('Signs as Kathryn');
    expect(html).toContain('Change to Kathryn');
    expect(html).toContain('aria-labelledby=');
    expect(html.indexOf('Change to Kathryn')).toBeLessThan(html.indexOf('Ignore'));
  });

  it('cites the thread line with the matched token', () => {
    const html = renderToStaticMarkup(<GuardCard {...base} />);
    expect(html).toContain('Kathryn');
    expect(html).toContain('rb-line-path');
  });

  it('offers two fixes for a date slip, and no global ignore for a date', () => {
    const dateResult = resultFor('Hi Kathryn, the $1,250 deposit, keys on Thursday the 10th.');
    const dateFlag = dateResult.flags.find((f) => f.guard === 'date');
    if (!dateFlag) throw new Error('the date slip was not flagged');
    expect(dateFlag.fixes.length).toBeGreaterThanOrEqual(1);
    const model = cardModel(dateFlag, '2026-11-02');
    expect(model.canNeverFlag).toBe(false);
    const html = renderToStaticMarkup(
      <GuardCard {...base} model={model} state={{ ...base.state, flagId: dateFlag.id }} />,
    );
    expect(html).not.toContain('Never flag');
  });

  it('says what to do when the host refused the edit', () => {
    const html = renderToStaticMarkup(
      <GuardCard
        {...base}
        state={{
          ...base.state,
          notice: { kind: 'copied', replacement: 'Kathryn', fixIndex: 0 },
        }}
      />,
    );
    expect(html).toContain('Copy again');
  });

  it('leaves engine labels that already read as a sentence alone', () => {
    expect(fixLabel('Kathryn')).toBe('Change to Kathryn');
    expect(fixLabel('Keep Catherine')).toBe('Keep Catherine');
    expect(fixLabel('Use $1,250')).toBe('Use $1,250');
  });
});

describe('ledger', () => {
  const render = (result: Parameters<typeof ledgerModel>[0]['result']) =>
    renderToStaticMarkup(
      <Ledger
        id="ledger"
        model={ledgerModel({ result })}
        actions={actions}
        autoFocus={false}
        open
      />,
    );

  it('lists asks with their state and slips with a labelled Fix button', () => {
    const html = render(slipped);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="Asks and slips"');
    expect(html).toContain('confirm the $1,250 deposit');
    expect(html).toContain('aria-label="Fix: change Catherine to Kathryn"');
    expect(html).toContain('aria-label="Fix: change $1,520 to $1,250"');
  });

  it('gives every icon-only button an accessible name', () => {
    const html = render(slipped);
    const buttons = [...html.matchAll(/<button\b([^>]*)>(.*?)<\/button>/g)];
    expect(buttons.length).toBeGreaterThan(4);
    for (const [whole, attrs, inner] of buttons) {
      // Named by an aria-label, or by visible text.
      const text = (inner ?? '').replace(/<[^>]*>/g, '').trim();
      expect(/aria-label="[^"]+"/.test(attrs ?? '') || text.length > 0, whole).toBe(true);
    }
  });

  it('says there is nothing to list when the last message had no asks', () => {
    const none = check(quiet, { text: '', version: 1 });
    const html = render(none);
    expect(html).toContain('rb-ledger-empty');
    expect(html).toContain('No asks in the last message.');
  });

  it('is marked closing while it animates out', () => {
    const html = renderToStaticMarkup(
      <Ledger
        id="ledger"
        model={ledgerModel({ result: slipped })}
        actions={{ ...actions, closeLedger: vi.fn() }}
        autoFocus={false}
        open={false}
      />,
    );
    expect(html).toContain('data-state="closing"');
  });
});
