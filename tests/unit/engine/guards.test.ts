import { describe, expect, it } from 'vitest';
import { check, createContext } from '../../../src/engine/index';
import type { ContextInput } from '../../../src/engine/index';
import { restyleDate } from '../../../src/engine/guards/date';
import { digitRule, inCounterOfferFrame, rewriteDigits } from '../../../src/engine/guards/number';

const TODAY = new Date(2026, 9, 20);

function flags(input: Partial<ContextInput> & { message: string }, draft: string) {
  const ctx = createContext(
    { source: 'playground', threadId: 'g', sentAt: '2026-11-02', ...input },
    TODAY,
  );
  return check(ctx, { text: draft, version: 1 }, { today: TODAY }).flags;
}

describe('name guard details', () => {
  it('uses the To chip for a near-miss of the recipient', () => {
    const f = flags(
      { message: 'Attached.', recipients: [{ name: 'Siobhan Kelleher', role: 'to' }] },
      'Hi Siobahn,',
    );
    expect(f.map((x) => [x.found, x.expected, x.rule])).toEqual([
      ['Siobahn', 'Siobhan', 'edit-distance'],
    ]);
  });

  it('handles possessives and keeps the span on the name only', () => {
    const f = flags({ message: 'Thanks,\nKathryn' }, "Catherine's note was clear.");
    expect(f[0]?.found).toBe('Catherine');
    expect(f[0]?.draftSpan).toEqual({ start: 0, end: 9 });
  });

  it('allows a phonetic first letter (Geoff/Jeff is in the table; Cathryn/Kathryn by distance)', () => {
    // geoff → jeff is distance 2 on a 5-letter name, so only the table catches it.
    expect(flags({ message: 'Cheers,\nGeoff' }, 'Thanks Jeff')[0]?.rule).toBe('variant');
    expect(flags({ message: 'Thanks,\nKathryn' }, 'Hi Cathryn')[0]?.rule).toBe('edit-distance');
  });

  it('never fires on common words, ALL CAPS or short tokens', () => {
    expect(flags({ message: 'Thanks,\nMark' }, 'Make sure you MARK it. Ma')).toHaveLength(0);
    expect(flags({ message: 'Thanks,\nDawn' }, 'Down the road. Done.')).toHaveLength(0);
  });

  it('body-only names fire only for long names or variants', () => {
    // "Kane" (4 letters) only appears in the body: "Kate" is a different person, stay silent.
    expect(
      flags({ message: 'I asked Kane about the boiler.' }, 'Kate will be there.'),
    ).toHaveLength(0);
    // "Marisol" (7 letters) in the body: "Marisole" is a slip.
    expect(
      flags({ message: 'I asked Marisol to bring the keys.' }, 'Thanks, Marisole has them.'),
    ).toHaveLength(1);
  });

  it("does not flag the replier's own name taken from the greeting", () => {
    expect(
      flags({ message: 'Hi Jon,\n\nAll set.\n\nThanks,\nJohanna' }, 'Thanks,\nJon'),
    ).toHaveLength(0);
  });

  it('accepts accented spellings as the same name', () => {
    expect(flags({ message: 'Thanks,\nJosé' }, 'Hi Jose,')).toHaveLength(0);
    expect(flags({ message: 'Thanks,\nJosé' }, 'Hi Josè,')).toHaveLength(0);
  });
});

describe('number guard details', () => {
  it('digitRule finds adjacent and one-apart transpositions and single substitutions', () => {
    expect(digitRule('1250', '1520')).toEqual({ rule: 'transposition', positions: [1, 2] });
    expect(digitRule('1250', '1052')).toEqual({ rule: 'transposition', positions: [1, 3] });
    expect(digitRule('48213', '48218')).toEqual({ rule: 'substitution', positions: [4] });
    expect(digitRule('1250', '1250')).toBeUndefined();
    expect(digitRule('1250', '125')).toBeUndefined();
    expect(digitRule('1250', '2150')?.rule).toBe('transposition');
    expect(digitRule('12345', '52341')).toBeUndefined();
    expect(digitRule('1250', '1360')).toBeUndefined();
  });

  it('rewrites digits keeping the draft format', () => {
    expect(rewriteDigits('$1,520', '1250')).toBe('$1,250');
    expect(rewriteDigits('1.520,00 €', '1250')).toBe('1.250,00 €');
    expect(rewriteDigits('#48231', '48213')).toBe('#48213');
  });

  it('detects counter-offer frames before and after the number', () => {
    const d1 = 'How about $1,520 for both?';
    expect(inCounterOfferFrame(d1, d1.indexOf('$'), d1.indexOf('$') + 6)).toBe(true);
    const d2 = 'I could pay $1,520 instead.';
    expect(inCounterOfferFrame(d2, d2.indexOf('$'), d2.indexOf('$') + 6)).toBe(true);
    const d3 = 'The $1,520 deposit is confirmed.';
    expect(inCounterOfferFrame(d3, 4, 10)).toBe(false);
  });

  it('stays silent when the draft number appears verbatim in the thread', () => {
    expect(
      flags({ message: 'Rent is $1,250 and the deposit is $1,520.' }, 'Sending $1,520 now.'),
    ).toHaveLength(0);
  });

  it('stays silent across currencies and magnitudes', () => {
    expect(flags({ message: 'The fee is $1,250.' }, 'I sent £1,520.')).toHaveLength(0);
    expect(flags({ message: 'The fee is $12.50.' }, 'I sent $125.0 today.')).toHaveLength(0);
  });

  it('flags a transposed phone number and a substituted invoice ID', () => {
    expect(
      flags({ message: 'Call me on 415-555-0142.' }, 'I will call 415-555-0124.')[0]?.rule,
    ).toBe('transposition');
    const inv = flags({ message: 'Invoice INV-20931 is attached.' }, 'Paid INV-20932 today.');
    expect(inv[0]?.message).toBe('Invoice INV-20931 in the thread. One digit differs.');
  });

  it('honours the global numbers ignore list', () => {
    const ctx = createContext({
      source: 'playground',
      threadId: 'x',
      message: 'The fee is $1,250.',
    });
    const r = check(
      ctx,
      { text: 'Paid $1,520.', version: 1 },
      { ignore: { names: [], numbers: ['$1,520'] } },
    );
    expect(r.flags).toHaveLength(0);
  });
});

describe('date guard details', () => {
  it('keeps abbreviations and ordinal style in fixes', () => {
    expect(restyleDate('Thu 10th', 2, 10)).toBe('Tue 10th');
    expect(restyleDate('Thursday the 10th', 4, 12)).toBe('Thursday the 12th');
    expect(restyleDate('Thu 10 Nov', 2, 10)).toBe('Tue 10 Nov');
  });

  it('flags a month-bearing date whose weekday is wrong', () => {
    const f = flags({ message: 'OK.' }, 'Shall we say Thu 10 Nov?');
    expect(f[0]?.rule).toBe('weekday-mismatch');
    expect(f[0]?.fixes[0]?.replacement).toBe('Tue 10 Nov');
  });

  it('matches the same day number with the wrong weekday to the thread date', () => {
    const f = flags(
      { message: 'Can you come Thursday the 12th?' },
      'Yes, Friday the 12th is fine.',
    );
    expect(f[0]?.rule).toBe('thread-near-miss');
    expect(f[0]?.fixes[0]?.replacement).toBe('Thursday the 12th');
  });

  it('never fires on a correct date that differs from the thread (deliberate proposal)', () => {
    expect(
      flags({ message: 'Can you come Thursday the 12th?' }, 'Thursday the 19th works better.'),
    ).toHaveLength(0);
  });

  it('ignores thread dates that are themselves inconsistent', () => {
    const f = flags({ message: 'Can you come Thursday the 10th?' }, 'Sure, Thursday the 11th.');
    expect(f[0]?.rule).toBe('weekday-mismatch');
  });

  it('falls back to today when the context has no sent date', () => {
    const ctx = createContext({ source: 'selection', threadId: 's', message: 'Hi' });
    const r = check(
      ctx,
      { text: 'Thursday the 10th', version: 1 },
      { today: new Date(2026, 10, 2) },
    );
    expect(r.flags[0]?.message).toBe('The 10th is a Tuesday.');
  });
});

describe('check options', () => {
  it('turns guards off individually and filters ignored flags', () => {
    const ctx = createContext(
      {
        source: 'playground',
        threadId: 'o',
        sentAt: '2026-11-02',
        message: 'Can you pay $1,250?\n\nThanks,\nKathryn',
      },
      TODAY,
    );
    const draft = { text: 'Hi Catherine, $1,520 on Thursday the 10th.', version: 1 };
    const all = check(ctx, draft);
    expect(all.flags.map((f) => f.guard)).toEqual(['name', 'number', 'date']);
    const off = check(ctx, draft, {
      guards: { name: false, number: true, date: false, asks: false },
    });
    expect(off.flags.map((f) => f.guard)).toEqual(['number']);
    expect(off.asks).toHaveLength(0);
    const ignored = check(ctx, draft, {
      threadState: {
        dismissedAsks: [],
        confirmedAsks: [],
        ignoredFlags: [all.flags[0]!.id],
        updatedAt: 0,
      },
    });
    expect(ignored.flags.map((f) => f.guard)).toEqual(['number', 'date']);
  });

  it('gives stable ids across checks and different ids across threads', () => {
    const mk = (id: string) =>
      createContext({ source: 'playground', threadId: id, message: 'Thanks,\nKathryn' });
    const a = check(mk('a'), { text: 'Hi Catherine', version: 1 }).flags[0]?.id;
    const a2 = check(mk('a'), { text: 'Hi Catherine!', version: 2 }).flags[0]?.id;
    const b = check(mk('b'), { text: 'Hi Catherine', version: 1 }).flags[0]?.id;
    expect(a).toBe(a2);
    expect(a).not.toBe(b);
  });

  it('marks dismissed asks', () => {
    const ctx = createContext({
      source: 'playground',
      threadId: 'd',
      message: 'Can you send the plan?',
    });
    const id = check(ctx, { text: '', version: 0 }).asks[0]!.id;
    const r = check(
      ctx,
      { text: '', version: 1 },
      {
        threadState: { dismissedAsks: [id], confirmedAsks: [], ignoredFlags: [], updatedAt: 0 },
      },
    );
    expect(r.asks[0]?.state).toBe('dismissed');
  });

  it('never stores the raw thread id: the key is a SHA-256 hex digest', () => {
    const ctx = createContext({ source: 'gmail', threadId: 'thread-f:1812345', message: '' });
    expect(ctx.threadKey).toMatch(/^[0-9a-f]{64}$/);
    expect(ctx.threadKey).not.toContain('1812345');
  });
});
