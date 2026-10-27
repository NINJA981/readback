import { describe, expect, it } from 'vitest';
import { splitSentences } from '../../../src/engine/text/sentences';
import { findSignOff, signOffName, splitMessage } from '../../../src/engine/text/strip';

describe('splitSentences', () => {
  it('splits on terminal punctuation and keeps exact spans', () => {
    const t = 'Hi Sam. Can you come? Great!';
    const s = splitSentences(t);
    expect(s.map((x) => x.text)).toEqual(['Hi Sam.', 'Can you come?', 'Great!']);
    for (const x of s) expect(t.slice(x.start, x.end)).toBe(x.text);
  });

  it('does not split inside amounts, abbreviations or initials', () => {
    const t = 'Dr. Lee paid $1,250.00 at 3 p.m. on Nov. 2, e.g. by card. J. Smith agreed.';
    expect(splitSentences(t).map((x) => x.text)).toEqual([
      'Dr. Lee paid $1,250.00 at 3 p.m. on Nov. 2, e.g. by card.',
      'J. Smith agreed.',
    ]);
  });

  it('ends a sentence after an ordinal ("the 1st.")', () => {
    expect(splitSentences('It is yours from the 1st. Before that, call me.')).toHaveLength(2);
  });

  it('treats list items and blank lines as boundaries and strips bullets', () => {
    const t = 'Could you:\n- send the lease\n- confirm the date\n\nThanks';
    const s = splitSentences(t);
    expect(s.map((x) => x.text)).toEqual([
      'Could you:',
      'send the lease',
      'confirm the date',
      'Thanks',
    ]);
    for (const x of s) expect(t.slice(x.start, x.end)).toBe(x.text);
  });

  it('joins soft-wrapped lines', () => {
    expect(splitSentences('can you send the\nlease back today?')).toHaveLength(1);
  });

  it('absorbs ?! runs and closing quotes', () => {
    expect(splitSentences('Really?! "Yes." OK')).toHaveLength(3);
  });
});

describe('splitMessage', () => {
  it('separates the sign-off and signature from the body', () => {
    const r = splitMessage(
      'Can you send it?\n\nThanks,\nKathryn Moss\nLarchmont Lettings\n+1 415 555 0142',
    );
    expect(r.body).toBe('Can you send it?');
    expect(r.signature.startsWith('Thanks,\nKathryn Moss')).toBe(true);
    expect(r.forwarded).toBe(false);
  });

  it('cuts quoted history at "On … wrote:" and drops > lines', () => {
    const r = splitMessage(
      'Sounds good.\n\nOn Fri, Oct 30, 2026 at 6:02 PM Sam Ortiz <sam@example.com>\nwrote:\n> Can you send the lease?',
    );
    expect(r.body).toBe('Sounds good.');
  });

  it('cuts at an Outlook header block', () => {
    const r = splitMessage(
      'Done.\n\nFrom: Ana Silva\nSent: Monday, November 2, 2026 9:00 AM\nTo: Sam',
    );
    expect(r.body).toBe('Done.');
  });

  it('marks and removes forwarded content', () => {
    const r = splitMessage(
      'FYI below.\n\n---------- Forwarded message ---------\nFrom: Lee\nCan you call me?',
    );
    expect(r.forwarded).toBe(true);
    expect(r.body).toBe('FYI below.');
    expect(splitMessage('Begin forwarded message:\n\nCan you?').forwarded).toBe(true);
  });

  it('honours the "-- " signature delimiter', () => {
    const r = splitMessage('See you then.\n-- \nPriya Natarajan\nNorthgate Primary');
    expect(r.body).toBe('See you then.');
    expect(r.signature).toBe('Priya Natarajan\nNorthgate Primary');
  });

  it('never treats an early "Thanks!" as the signature', () => {
    const body = 'Thanks! One more thing: can you bring the keys?';
    expect(splitMessage(body).body).toBe(body);
  });

  it('does not mistake "Thanks for that!" for a sign-off with a name', () => {
    expect(findSignOff('All sorted.\nThanks for that!')).toBe(-1);
  });

  it('picks the bottom-most sign-off', () => {
    const t = 'Thanks!\n\nCan you bring the keys?\n\nBest,\nKathryn';
    expect(splitMessage(t).body).toBe('Thanks!\n\nCan you bring the keys?');
  });
});

describe('signOffName', () => {
  it.each([
    ['Thanks,\nKathryn', 'Kathryn'],
    ['Thanks, Kathryn', 'Kathryn'],
    ['Best regards,\n\nKathryn Moss\nLarchmont Lettings', 'Kathryn Moss'],
    ['cheers – Tom', 'Tom'],
    ['Priya Natarajan\nNorthgate Primary', 'Priya Natarajan'],
  ])('%j → %s', (sig, name) => {
    const r = signOffName(sig);
    expect(r?.name).toBe(name);
    expect(sig.slice(r?.index, (r?.index ?? 0) + name.length)).toBe(name);
  });

  it('returns undefined when no name follows', () => {
    expect(signOffName('Thanks,\n+1 415 555 0142')).toBeUndefined();
    expect(signOffName('')).toBeUndefined();
  });
});
