/**
 * False positives found by a code review of the release candidate, pinned here
 * so they stay fixed. Each case is a reply a careful writer could send.
 */
import { describe, expect, it } from 'vitest';
import { check, createContext } from '../../../src/engine/index';
import type { ContextInput } from '../../../src/engine/index';

const TODAY = new Date(2026, 10, 2);

function run(input: Partial<ContextInput> & { message: string }, draft: string) {
  const ctx = createContext(
    { source: 'playground', threadId: 'review', sentAt: '2026-11-02', ...input },
    TODAY,
  );
  return check(ctx, { text: draft, version: 1 }, { today: TODAY });
}

const from = (name: string) => ({ sender: { name, role: 'sender' as const } });

describe('name guard: a capital at the start of a sentence is not a name', () => {
  it.each([
    ['Pat Lowe', 'Part two is attached.'],
    ['Pat Lowe', 'Pay the deposit by Friday.'],
    ['Mike Brennan', 'Mine arrived yesterday.'],
    ['Joe Ferris', 'Job done, thanks.'],
    ['Marc Dubois', 'Mark the date in your calendar.'],
  ])('thread from %s, draft "%s" → no flag', (name, draft) => {
    const r = run(
      { ...from(name), message: `Hi Sam,\n\nThe notes are in.\n\n${name.split(' ')[0]}` },
      draft,
    );
    expect(r.flags.filter((f) => f.guard === 'name')).toEqual([]);
  });

  it('still flags a misspelled name that opens the reply as an address', () => {
    const r = run(
      { ...from('Marc Dubois'), message: 'Hi Sam,\n\nThe notes are in.\n\nMarc' },
      'Mark, thanks for the notes.',
    );
    expect(r.flags.map((f) => [f.found, f.expected])).toEqual([['Mark', 'Marc']]);
  });

  it('still flags a known name variant that starts a sentence', () => {
    const r = run(
      {
        ...from('Mira Patel'),
        recipients: [{ name: 'Jon Reyes', role: 'to' }],
        message: 'Hi both,\n\nNotes are in.\n\nMira',
      },
      'John will be there on Tuesday.',
    );
    expect(r.flags.map((f) => [f.found, f.expected])).toEqual([['John', 'Jon']]);
  });

  it('still flags a misspelled name on a line of its own', () => {
    const r = run(
      { ...from('Kathryn Moss'), message: 'Hi Sam,\n\nAll set.\n\nKathryn' },
      'Kathyrn\n\nThanks for sorting this.',
    );
    expect(r.flags.map((f) => f.found)).toEqual(['Kathyrn']);
  });
});

describe('number guard: IDs with real neighbours', () => {
  const booking =
    'Hi Sam,\n\nYou are in room 204, and flight 482 lands at 9. Your booking reference is BK-77421.\n\nFront Desk';

  it.each([
    'Could my colleague have room 205?',
    'I will be on flight 483 on the way back.',
    'Room 204 is great, and my colleague is on flight 204 too.',
  ])('"%s" → no flag', (draft) => {
    expect(run({ message: booking }, draft).flags).toEqual([]);
  });

  it('still flags swapped digits in a room number, and a changed digit in a booking reference', () => {
    const room = run({ message: booking }, 'See you in room 240.').flags;
    expect(room.map((f) => f.rule)).toEqual(['transposition']);
    expect(room[0]?.expected).toContain('204');
    expect(run({ message: booking }, 'My booking reference is BK-77428.').flags).toHaveLength(1);
  });
});

describe('date guard: a past date in the reply is read in its own year', () => {
  const message = 'Hi Sam,\n\nThanks for coming by.\n\nTess';

  it('"thanks for Tuesday, October 6" on 2 Nov 2026 is correct (6 Oct 2026 was a Tuesday)', () => {
    expect(run({ message }, 'Thanks for Tuesday, October 6, it was great.').flags).toEqual([]);
  });

  it('a wrong weekday on a recent past date is still flagged', () => {
    const r = run({ message }, 'Thanks for Wednesday, October 6, it was great.');
    expect(r.flags.map((f) => f.message)).toEqual(['The 6th is a Tuesday.']);
  });

  it('a date early next year still resolves forward', () => {
    expect(run({ message }, 'See you on Sunday, January 3.').flags).toEqual([]);
  });
});

describe('quoted text in the reply box', () => {
  const message = 'Hi Sam,\n\nThe new figure is $1,520 for the deposit.\n\nKathryn';

  it('does not flag a value on a quoted line or below an "On ... wrote:" header', () => {
    const draft =
      'Thanks, $1,520 it is.\n\n> Last month you said $1,250 would do.\n\nOn Mon, Nov 2, 2026 at 9:14 AM Kathryn Moss wrote:\nThe deposit was $1,250 back then.';
    expect(run({ ...from('Kathryn Moss'), message }, draft).flags).toEqual([]);
  });

  it("still flags the same slip in the writer's own words", () => {
    const r = run({ ...from('Kathryn Moss'), message }, 'Thanks, $1,250 it is.');
    expect(r.flags.map((f) => f.found)).toEqual(['$1,250']);
  });
});
