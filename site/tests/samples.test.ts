import { describe, expect, it } from 'vitest';
import { check, createContext } from '@/core/index';
import { SAMPLES, sampleInput } from '../src/shared/samples';

/**
 * The sample threads are copy the page promises things about ("Catherine for
 * Kathryn", "the 10th is a Tuesday"). Running the real engine over them keeps
 * that copy honest: a guard change that breaks a sample fails here.
 */
const NOW = new Date('2026-11-02T09:00:00Z');

const expected: Record<string, { found: string; expected: string }[]> = {
  deposit: [
    { found: 'Catherine', expected: 'Kathryn' },
    { found: '$1,520', expected: '$1,250' },
  ],
  invoice: [
    { found: 'Stephen', expected: 'Steven' },
    { found: 'INV-20913', expected: 'INV-20931' },
  ],
  school: [
    { found: 'John', expected: 'Jon' },
    { found: 'Tuesday the 18th', expected: 'Wednesday the 18th' },
  ],
  order: [
    { found: '#48231', expected: '#48213' },
    { found: '$89.05', expected: '$89.50' },
  ],
  recruiter: [
    { found: 'Jeff', expected: 'Geoff' },
    { found: 'Thursday the 17th', expected: 'Tuesday the 17th' },
  ],
  quote: [
    { found: 'Sean', expected: 'Shaun' },
    { found: '$12,040', expected: '$12,400' },
  ],
};

describe('AC-W.5: sample threads against the real engine', () => {
  it('covers every sample', () => {
    expect(Object.keys(expected).sort()).toEqual(SAMPLES.map((s) => s.id).sort());
  });

  for (const s of SAMPLES) {
    it(`${s.id}: flags exactly the slips the copy promises`, () => {
      const ctx = createContext(sampleInput(s), NOW);
      const result = check(ctx, { text: s.draft, version: 1 });
      const got = result.flags.map((f) => ({ found: f.found, expected: f.expected }));
      expect(got).toEqual(expected[s.id]);
      for (const f of result.flags) {
        expect(f.fixes.length).toBeGreaterThan(0);
        expect(f.message.length).toBeGreaterThan(0);
      }
    });
  }

  it('stays quiet on the deliberate cases (different person, counter-offer)', () => {
    const s = SAMPLES.find((x) => x.id === 'deposit');
    if (!s) throw new Error('deposit sample missing');
    const ctx = createContext(sampleInput(s), NOW);
    for (const draft of ['Hi Bob,', 'Could we do $1,200 instead?']) {
      expect(check(ctx, { text: draft, version: 1 }).flags).toEqual([]);
    }
  });
});
