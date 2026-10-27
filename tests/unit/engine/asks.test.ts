import { describe, expect, it } from 'vitest';
import { isBoilerplate } from '../../../src/engine/asks/boilerplate';
import { extractAsks, keyTerms, splitCoordinated } from '../../../src/engine/asks/extract';
import { filledInlineSlot, inlineSlotText } from '../../../src/engine/coverage/inline';
import { draftTerms, lexicalEvidence } from '../../../src/engine/coverage/lexical';
import { applyModelScores, cosine, similarityMatrix } from '../../../src/engine/coverage/model';
import type { Ask } from '../../../src/engine/types';

const texts = (m: string) => extractAsks(m).asks.map((a) => a.text);

describe('extractAsks', () => {
  it('takes questions and direct requests', () => {
    expect(
      texts(
        'Are you free on Tuesday? Please send the invoice. Let me know whether Friday works. The van is booked.',
      ),
    ).toEqual([
      'Are you free on Tuesday?',
      'Please send the invoice.',
      'Let me know whether Friday works.',
    ]);
  });

  it('takes would-you-mind, if-you-could and need-you-to requests', () => {
    expect(
      texts(
        "Would you mind checking the meter. If you could sign by noon that'd help. I need you to call the bank.",
      ),
    ).toHaveLength(3);
  });

  it('takes reply-needing imperatives but not instructions or statements', () => {
    expect(texts('Send me the signed copy. Bring a coat if it rains. Enjoy the trip.')).toEqual([
      'Send me the signed copy.',
    ]);
  });

  it('drops "please find attached" and similar', () => {
    expect(texts('Please find attached the quote. Please note the new address.')).toEqual([]);
  });

  it('takes bulleted asks under a request lead-in, not the lead-in itself', () => {
    expect(texts('Could you:\n- send the lease\n- confirm the date\n\nThe rest can wait.')).toEqual(
      ['send the lease', 'confirm the date'],
    );
  });

  it('keeps a coordinated sentence whole when a segment is not an action', () => {
    expect(texts('Can you confirm the dates and times?')).toEqual([
      'Can you confirm the dates and times?',
    ]);
    expect(splitCoordinated('Can you confirm the dates and the venue?', 0)).toBeUndefined();
  });

  it('splits coordinated requests with spans into the message', () => {
    const m = 'Also, could you please book the hall, invite the parents; and print the forms?';
    const r = extractAsks(m).asks;
    expect(r.map((a) => a.text)).toEqual([
      'book the hall',
      'invite the parents',
      'print the forms',
    ]);
    for (const a of r) expect(m.slice(a.span.start, a.span.end)).toBe(a.text);
  });

  it('handles questions ending with closing quotes or emoji', () => {
    expect(texts('Did you see "the plan?" Can you come? 🙂')).toHaveLength(2);
  });

  it('caps at five and reports the rest', () => {
    const m = Array.from({ length: 7 }, (_, i) => `Can you bring item ${i + 1}?`).join(' ');
    const r = extractAsks(m);
    expect(r.asks).toHaveLength(5);
    expect(r.truncated).toBe(2);
  });
});

describe('boilerplate stop-list', () => {
  it.each([
    'Let me know if you have any questions!',
    'Please let me know if you need anything else.',
    "Don't hesitate to reach out.",
    'Any questions?',
    'Thoughts?',
    'How are you?',
    "Hope you're well!",
    'Hope this email finds you well.',
    'Does that make sense?',
    'How was your weekend?',
    'Can you believe this weather?',
  ])('%s', (s) => {
    expect(isBoilerplate(s.toLowerCase())).toBe(true);
    expect(texts(s)).toEqual([]);
  });

  it('keeps real asks that start similarly', () => {
    expect(isBoilerplate('let me know if the 12th works')).toBe(false);
    expect(texts('Let me know if the 12th works.')).toHaveLength(1);
  });
});

describe('keyTerms', () => {
  it('keeps amounts, days, names and content stems; drops verbs and function words', () => {
    expect(keyTerms('confirm the $1,250 deposit')).toEqual(['1250', 'deposit']);
    expect(keyTerms('drop off the keys on Thursday the 12th')).toEqual(['12', 'key', 'thursday']);
  });
});

describe('lexical coverage', () => {
  const ask = {
    text: 'confirm the $1,250 deposit',
    span: { start: 0, end: 0 },
    keyTerms: ['1250', 'deposit'],
  };

  it('needs half the key terms', () => {
    expect(lexicalEvidence(ask, draftTerms('Deposit sent.'))?.kind).toBe('lexical');
    expect(lexicalEvidence(ask, draftTerms('All good here.'))).toBeUndefined();
  });

  it('accepts a yes/no cue with one key term', () => {
    const a = { ...ask, keyTerms: ['1250', 'deposit', 'friday'] };
    expect(lexicalEvidence(a, draftTerms('Yes, the deposit is fine.'))?.draftSpan).toEqual({
      start: 0,
      end: 25,
    });
  });

  it('ignores quoted inline-slot lines as evidence', () => {
    expect(lexicalEvidence(ask, draftTerms('> confirm the $1,250 deposit\n\n'))).toBeUndefined();
  });

  it('returns nothing for asks without key terms or empty drafts', () => {
    expect(lexicalEvidence({ ...ask, keyTerms: [] }, draftTerms('Yes.'))).toBeUndefined();
    expect(lexicalEvidence(ask, draftTerms(''))).toBeUndefined();
  });
});

describe('answer inline', () => {
  it('builds the slot text and detects when it is filled', () => {
    expect(inlineSlotText('  send the   lease ')).toBe('> send the lease\n\n');
    const draft = `Hi,\n\n${inlineSlotText('Send the lease?')}Posted today.`;
    expect(filledInlineSlot(draft, 'Send the lease?')).toEqual({
      start: draft.indexOf('Posted'),
      end: draft.length,
    });
    expect(filledInlineSlot('> Send the lease?\n\n> Next ask', 'Send the lease?')).toBeUndefined();
    expect(filledInlineSlot('nothing', '')).toBeUndefined();
  });
});

describe('model coverage adapter', () => {
  it('cosine handles normal and zero vectors', () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosine([0, 0], [1, 1])).toBe(0);
  });

  it('upgrades only open asks above threshold to looks-answered with model evidence', () => {
    const asks: Ask[] = [
      { id: 'a', text: 'x', span: { start: 0, end: 1 }, keyTerms: [], state: 'open' },
      { id: 'b', text: 'y', span: { start: 0, end: 1 }, keyTerms: [], state: 'open' },
      { id: 'c', text: 'z', span: { start: 0, end: 1 }, keyTerms: [], state: 'answered' },
    ];
    const sentences = [
      { start: 0, end: 5 },
      { start: 6, end: 9 },
    ];
    const scores = similarityMatrix(
      [Float32Array.from([1, 0]), Float32Array.from([0, 1]), Float32Array.from([1, 1])],
      [Float32Array.from([1, 0.1]), Float32Array.from([1, 0])],
    );
    const out = applyModelScores(asks, sentences, scores);
    expect(out[0]?.state).toBe('looks-answered');
    expect(out[0]?.evidence?.kind).toBe('model');
    expect(out[0]?.evidence?.draftSpan).toEqual({ start: 6, end: 9 });
    expect(out[1]?.state).toBe('open');
    expect(out[2]).toBe(asks[2]);
  });
});
