import { describe, expect, it } from 'vitest';
import { createComposeSession, createContext } from '../../../src/core/index';
import {
  CONTEXT_ERROR,
  cardModel,
  citationParts,
  fixNotice,
  fixedLabel,
  ledgerModel,
} from '../../../src/overlay/model';
import { DEPOSIT_DRAFT_SLIPS, DEPOSIT_INPUT } from '../../fixtures/samples';

const session = () => {
  const s = createComposeSession({
    context: createContext(DEPOSIT_INPUT),
    today: new Date('2026-11-02T09:00:00Z'),
  });
  s.setDraft(DEPOSIT_DRAFT_SLIPS);
  return s;
};

describe('card model', () => {
  it('cites the thread in the reader’s terms, never a generic spelling label', () => {
    const snap = session().getSnapshot();
    const [name, number] = snap.result.flags.map((f) => cardModel(f, snap.context.sentAt));
    expect(name?.message).toBe('Signs as Kathryn');
    expect(name?.citation.token).toBe('Kathryn');
    expect(name?.source).toBe('From the signature');
    expect(name?.fixes[0]?.replacement).toBe('Kathryn');
    expect(name?.neverFlagLabel).toBe('Never flag “Catherine”');
    expect(number?.message).toBe('Thread says $1,250. Digits swapped?');
    expect(number?.source).toBe('From the message, 2 Nov');
    expect(number?.canNeverFlag).toBe(true);
  });

  it('dates cannot be ignored globally, so the menu entry is off for them', () => {
    const s = session();
    s.setDraft('Hi Kathryn,\n\nI will drop the keys off Thursday the 10th.');
    const flag = s.getSnapshot().result.flags[0];
    expect(flag?.guard).toBe('date');
    expect(cardModel(flag!).canNeverFlag).toBe(false);
  });

  it('splits the cited line around the matched token and windows long lines', () => {
    expect(citationParts('Thanks, Kathryn', 'Kathryn')).toEqual({
      before: 'Thanks, ',
      token: 'Kathryn',
      after: '',
    });
    const long = `${'word '.repeat(30)}$1,250 ${'tail '.repeat(30)}`;
    const parts = citationParts(long, '$1,250');
    expect(parts.token).toBe('$1,250');
    expect(parts.before.startsWith('…')).toBe(true);
    expect(parts.after.endsWith('…')).toBe(true);
    expect(parts.before.length).toBeLessThanOrEqual(45);
  });

  it('a token that is not in the line still shows the line, without a mark', () => {
    expect(citationParts('Order confirmed', 'Kathryn')).toEqual({
      before: 'Order confirmed',
      token: '',
      after: '',
    });
  });

  it('the host-refused states say what to do next', () => {
    expect(fixNotice('copied', 'Kathryn')).toBe(
      'Couldn’t edit this box. “Kathryn” is copied, so paste it over the word.',
    );
    expect(fixNotice('failed', 'Kathryn')).toBe(
      'Couldn’t edit this box. Type “Kathryn” over the word.',
    );
  });

  it('pill and context copy are the DESIGN.md strings', () => {
    expect(fixedLabel('Kathryn')).toBe('Fixed: Kathryn · Undo Ctrl+Z');
    expect(CONTEXT_ERROR).toBe('No text selected. Select the message first.');
  });
});

describe('ledger model', () => {
  it('lists the three asks and both slips, with state labels for screen readers', () => {
    const model = ledgerModel(session().getSnapshot());
    expect(model.asks).toHaveLength(3);
    expect(
      model.asks.every((a) => ['Open', 'Looks answered', 'Answered'].includes(a.stateLabel)),
    ).toBe(true);
    expect(model.slips.map((s) => `${s.found}>${s.expected}`)).toEqual([
      'Catherine>Kathryn',
      '$1,520>$1,250',
    ]);
    expect(model.empty).toBe(false);
    // The sample draft addresses all three, so every ask at least looks answered (dotted).
    expect(model.asks.every((a) => a.covered)).toBe(true);
    // ...but a guess is not a fact: the header is the muted nudge, not the success line.
    expect(model.header).toBe('Nothing left open. Confirm each one to be sure.');
    expect(model.headerOk).toBe(false);
  });

  it('confirming every ask gives the success header; dismissed asks leave the list and can be restored', () => {
    const s = session();
    const [first, ...rest] = s.getSnapshot().result.asks;
    s.dispatch({ type: 'dismiss-ask', id: first!.id });
    for (const a of rest) s.dispatch({ type: 'confirm-ask', id: a.id });
    const model = ledgerModel(s.getSnapshot());
    expect(model.asks).toHaveLength(2);
    expect(model.dismissed).toBe(1);
    expect(model.header).toBe('Everything asked is covered.');
    expect(model.headerOk).toBe(true);
    expect(model.asks.every((a) => a.state === 'answered' && !a.canConfirm)).toBe(true);
  });

  it('a message with no asks and a clean draft is empty, with the explanatory hint', () => {
    const s = createComposeSession({
      context: createContext({
        ...DEPOSIT_INPUT,
        threadId: 'sample:none',
        message: 'Hi Sam, thanks for your note.\n\nKathryn',
      }),
    });
    s.setDraft('Hi Kathryn,');
    const model = ledgerModel(s.getSnapshot());
    expect(model.empty).toBe(true);
    expect(model.header).toBe('No asks in the last message.');
    expect(model.emptyHint).toBe('Readback only lists direct questions and requests.');
  });

  it('caps at five asks and says how many are not shown', () => {
    const asks = Array.from({ length: 8 }, (_, i) => `Can you confirm item number ${i + 1}?`).join(
      ' ',
    );
    const s = createComposeSession({
      context: createContext({
        ...DEPOSIT_INPUT,
        threadId: 'sample:many',
        message: `Hi Sam,\n\n${asks}\n\nKathryn`,
      }),
    });
    const model = ledgerModel(s.getSnapshot());
    expect(model.asks).toHaveLength(5);
    expect(model.overflow).toBe('+3 more not shown');
  });
});
