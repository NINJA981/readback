/**
 * SPEC §10 acceptance criteria tagged U (vitest unit). Test names carry the AC id.
 */
import { describe, expect, it } from 'vitest';
import { check, createContext } from '../../../src/engine/index';
import type { ContextInput, ThreadState } from '../../../src/engine/index';
import { DEPOSIT_DRAFT_CLEAN, DEPOSIT_DRAFT_SLIPS, DEPOSIT_INPUT } from '../../fixtures/samples';

const TODAY = new Date(2026, 9, 20);

function run(input: Partial<ContextInput> & { message: string }, draft: string, extra = {}) {
  const ctx = createContext(
    { source: 'playground', threadId: 'test', sentAt: '2026-11-02', ...input },
    TODAY,
  );
  return check(ctx, { text: draft, version: 1 }, { today: TODAY, ...extra });
}

describe('F1 name guard', () => {
  it('AC-1.1 signature Kathryn vs draft Catherine → one variant flag', () => {
    const r = run({ message: 'Can you send the keys?\n\nThanks,\nKathryn' }, 'Hi Catherine,');
    expect(r.flags).toHaveLength(1);
    const [f] = r.flags;
    expect(f?.guard).toBe('name');
    expect(f?.rule).toBe('variant');
    expect(f?.message).toBe('Signs as Kathryn');
    expect(f?.fixes[0]?.replacement).toBe('Kathryn');
    expect(f?.found).toBe('Catherine');
    expect(f?.draftSpan).toEqual({ start: 3, end: 12 });
    expect(f?.citation.line).toBe('Kathryn');
  });

  it('AC-1.2 To chip Jon Reyes vs draft John → edit-distance flag', () => {
    const r = run(
      { message: 'See the attached schedule.', recipients: [{ name: 'Jon Reyes', role: 'to' }] },
      'Thanks John',
    );
    expect(r.flags).toHaveLength(1);
    expect(r.flags[0]?.rule).toBe('edit-distance');
    expect(r.flags[0]?.message).toBe('To: Jon Reyes');
    expect(r.flags[0]?.expected).toBe('Jon');
  });

  it('AC-1.3 thread names Kathryn, draft mentions Bob → 0 flags', () => {
    const r = run({ message: 'Thanks,\nKathryn' }, 'I asked Bob to bring the keys.');
    expect(r.flags).toHaveLength(0);
  });

  it('AC-1.4 thread contains both Catherine and Kathryn → Catherine not flagged', () => {
    const r = run(
      { message: 'Catherine from accounts will send the invoice.\n\nThanks,\nKathryn' },
      'Hi Kathryn, thanks. I will wait for Catherine.',
    );
    expect(r.flags).toHaveLength(0);
  });

  it('AC-1.5 global ignore of Catherine → 0 flags in any thread', () => {
    const r = run({ message: 'Thanks,\nKathryn' }, 'Hi Catherine,', {
      ignore: { names: ['Catherine'], numbers: [] },
    });
    expect(r.flags).toHaveLength(0);
  });
});

describe('F2 number guard', () => {
  const msg = 'The deposit is $1,250, due on the 1st.';

  it('AC-2.1 $1,250 vs $1,520 → transposition with formatted fix', () => {
    const r = run({ message: msg }, 'The $1,520 deposit is confirmed.');
    expect(r.flags).toHaveLength(1);
    const [f] = r.flags;
    expect(f?.rule).toBe('transposition');
    expect(f?.message).toBe('Thread says $1,250. Digits swapped?');
    expect(f?.fixes[0]?.replacement).toBe('$1,250');
    expect(f?.found).toBe('$1,520');
  });

  it.each(['$1,100', '$1,200', '$1,350'])('AC-2.2 $1,250 vs %s → 0 flags', (amount) => {
    expect(run({ message: msg }, `I can pay ${amount} now.`).flags).toHaveLength(0);
  });

  it('AC-2.3 order #48213 vs #48231 (transposition) and #48218 (substitution)', () => {
    const m = 'Your order #48213 has shipped.';
    const a = run({ message: m }, 'Thanks, order #48231 arrived.');
    expect(a.flags).toHaveLength(1);
    expect(a.flags[0]?.rule).toBe('transposition');
    expect(a.flags[0]?.message).toBe('Order #48213 in the thread. Digits swapped?');
    const b = run({ message: m }, 'Thanks, order #48218 arrived.');
    expect(b.flags).toHaveLength(1);
    expect(b.flags[0]?.rule).toBe('substitution');
    expect(b.flags[0]?.message).toBe('Order #48213 in the thread. One digit differs.');
    expect(b.flags[0]?.fixes[0]?.replacement).toBe('#48213');
  });

  it('AC-2.4 counter-offer frame "could we do $1,520 instead?" → 0 flags', () => {
    expect(run({ message: msg }, 'Could we do $1,520 instead?').flags).toHaveLength(0);
  });

  it('AC-2.5 European format flags; unit mismatch does not', () => {
    const eu = run(
      { message: 'Die Kaution beträgt 1.250,00 € bis Freitag.' },
      'Ich überweise 1.520,00 € heute.',
    );
    expect(eu.flags).toHaveLength(1);
    expect(eu.flags[0]?.fixes[0]?.replacement).toBe('1.250,00 €');
    expect(run({ message: msg }, 'We booked 1,520 nights in total.').flags).toHaveLength(0);
  });
});

describe('F3 date guard', () => {
  it('AC-3.1 reference Mon 2 Nov 2026, draft "Thursday the 10th" → weekday mismatch', () => {
    const r = run({ message: 'Works for me.' }, 'See you Thursday the 10th.');
    expect(r.flags).toHaveLength(1);
    expect(r.flags[0]?.rule).toBe('weekday-mismatch');
    expect(r.flags[0]?.message).toBe('The 10th is a Tuesday.');
    expect(r.flags[0]?.fixes.map((f) => f.replacement)).toEqual(['Tuesday the 10th']);
    expect(r.flags[0]?.citation.source).toBe('calendar');
  });

  it('AC-3.2 thread proposes Thursday the 12th, draft Thursday the 10th → thread near-miss, two fixes', () => {
    const r = run(
      { message: 'Can you drop off the keys on Thursday the 12th?' },
      'Sure, Thursday the 10th works.',
    );
    expect(r.flags).toHaveLength(1);
    const [f] = r.flags;
    expect(f?.rule).toBe('thread-near-miss');
    expect(f?.message).toBe('Thread says Thursday the 12th.');
    expect(f?.fixes.map((x) => x.label)).toEqual(['Thursday the 12th', 'Tuesday the 10th']);
    expect(f?.fixes.map((x) => x.replacement)).toEqual(['Thursday the 12th', 'Tuesday the 10th']);
  });

  it('AC-3.3 thread Thursday the 12th, draft Monday the 23rd → 0 flags', () => {
    const r = run(
      { message: 'Can you drop off the keys on Thursday the 12th?' },
      'How about Monday the 23rd?',
    );
    expect(r.flags).toHaveLength(0);
  });

  it('AC-3.4 draft "next Friday" → 0 flags', () => {
    expect(run({ message: 'Thursday the 12th?' }, 'Next Friday is better.').flags).toHaveLength(0);
  });
});

describe('F6 ask pill', () => {
  it('AC-6.1 the hero sample yields exactly 3 asks from one coordinated sentence', () => {
    const ctx = createContext(DEPOSIT_INPUT, TODAY);
    const r = check(ctx, { text: '', version: 0 });
    expect(r.asks.map((a) => a.text)).toEqual([
      'confirm the $1,250 deposit',
      'drop off the keys on Thursday the 12th',
      'send the signed lease back',
    ]);
    for (const a of r.asks) expect(ctx.latestMessage.slice(a.span.start, a.span.end)).toBe(a.text);
    expect(r.asks.every((a) => a.state === 'open')).toBe(true);
  });

  it('AC-6.2 boilerplate, quoted history, signature and forwards yield 0 asks', () => {
    expect(run({ message: 'Let me know if you have any questions!' }, '').asks).toHaveLength(0);
    expect(
      run(
        {
          message:
            'Sounds great.\n\nOn Mon, Nov 2, 2026 at 9:00 AM Ana <a@x.com> wrote:\n> Can you send it?',
        },
        '',
      ).asks,
    ).toHaveLength(0);
    expect(
      run({ message: 'Noted.\n\nThanks,\nAna\nCan you believe this weather?' }, '').asks,
    ).toHaveLength(0);
    expect(
      run(
        {
          message:
            'FYI.\n\n---------- Forwarded message ---------\nFrom: Lee <lee@x.com>\nSubject: Fwd: keys\n\nCould you send the keys? Can you confirm Friday?',
        },
        '',
      ).asks,
    ).toHaveLength(0);
  });

  it('AC-6.3 a message with 8 asks yields 5 and truncatedAsks = 3', () => {
    const message = [
      'Can you send the floor plan?',
      'Could you confirm the move-in date?',
      'Will you need parking?',
      'Do you have pets?',
      'Can you share a reference?',
      'Could you sign the inventory?',
      'Would you pay the first month upfront?',
      'Is the 1st still good for you?',
    ].join(' ');
    const r = run({ message }, '');
    expect(r.asks).toHaveLength(5);
    expect(r.truncatedAsks).toBe(3);
  });
});

describe('F7 coverage', () => {
  it('AC-7.1 lexical evidence marks the deposit ask looks-answered', () => {
    const ctx = createContext(DEPOSIT_INPUT, TODAY);
    const r = check(ctx, { text: 'The $1,250 deposit is confirmed.', version: 1 });
    const deposit = r.asks.find((a) => a.text.includes('deposit'));
    expect(deposit?.state).toBe('looks-answered');
    expect(deposit?.evidence?.kind).toBe('lexical');
  });

  it('AC-7.2 confirming sets answered; a filled inline slot counts as answered', () => {
    const ctx = createContext(DEPOSIT_INPUT, TODAY);
    const first = check(ctx, { text: '', version: 0 });
    const target = first.asks[2];
    expect(target).toBeDefined();
    const state: ThreadState = {
      dismissedAsks: [],
      confirmedAsks: [target!.id],
      ignoredFlags: [],
      updatedAt: 1,
    };
    const confirmed = check(ctx, { text: '', version: 1 }, { threadState: state });
    expect(confirmed.asks[2]?.state).toBe('answered');
    expect(confirmed.asks[2]?.evidence?.kind).toBe('user');

    const empty = check(ctx, { text: '> send the signed lease back\n\n', version: 2 });
    expect(empty.asks[2]?.state).toBe('open');
    const filled = check(ctx, {
      text: '> send the signed lease back\n\nPosting it today.',
      version: 3,
    });
    expect(filled.asks[2]?.state).toBe('answered');
    expect(filled.asks[2]?.evidence?.kind).toBe('inline-slot');
  });
});

describe('Demo script (SPEC §11)', () => {
  it('the scripted draft shows the name and number slips and no date slip', () => {
    const ctx = createContext(DEPOSIT_INPUT, TODAY);
    const r = check(ctx, { text: DEPOSIT_DRAFT_SLIPS, version: 1 });
    expect(r.flags.map((f) => [f.guard, f.found, f.expected])).toEqual([
      ['name', 'Catherine', 'Kathryn'],
      ['number', '$1,520', '$1,250'],
    ]);
  });

  it('the fixed draft is clean and covers all three asks', () => {
    const ctx = createContext(DEPOSIT_INPUT, TODAY);
    const r = check(ctx, { text: DEPOSIT_DRAFT_CLEAN, version: 2 });
    expect(r.flags).toHaveLength(0);
    expect(r.asks.map((a) => a.state)).toEqual([
      'looks-answered',
      'looks-answered',
      'looks-answered',
    ]);
  });

  it('the wrong amount still makes the deposit ask look answered (demo shot 5)', () => {
    const ctx = createContext(DEPOSIT_INPUT, TODAY);
    const r = check(ctx, { text: 'Hi Kathryn,\n\nThe $1,520 deposit is confirmed', version: 1 });
    expect(r.asks[0]?.state).toBe('looks-answered');
    expect(r.asks[1]?.state).toBe('open');
  });
});
