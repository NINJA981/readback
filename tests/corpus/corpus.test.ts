/**
 * Corpus gates (SPEC AC-1.6, AC-2.6, AC-6.4; ADR-0001 §Testing).
 *   - Ask precision >= 0.90 on >= 60 labelled messages (gated)
 *   - Guard false positives on the deliberate set = 0 (gated)
 *   - Guard recall on the slip set and ask recall are reported, and held at a
 *     floor so a regression is visible. Recall is not the product promise: the
 *     guards accept missing some slips to keep false positives at zero.
 * Labels are written by hand from the SPEC, not from engine output.
 * Provenance: tests/fixtures/threads/README.md.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { check, createContext, fold } from '../../src/core/index';
import type { ContextInput, IgnoreList, Person } from '../../src/core/index';

const DIR = join(import.meta.dirname, '..', 'fixtures', 'threads');
const read = <T>(name: string): T => JSON.parse(readFileSync(join(DIR, name), 'utf8')) as T;
const TODAY = new Date(2026, 10, 2, 12);

interface AskCase {
  id: string;
  message: string;
  asks: string[];
  expectTruncated?: number;
}
interface ThreadDef {
  sentAt: string;
  sender: Person;
  recipients: Person[];
  message: string;
}
interface GuardCase {
  id: string;
  kind: 'slip' | 'deliberate';
  thread: string;
  draft: string;
  ignore?: IgnoreList;
  flags: { guard: string; found: string; expected?: string }[];
}

const asks = read<AskCase[]>('asks.json');
const guards = read<{ threads: Record<string, ThreadDef>; cases: GuardCase[] }>('guards.json');

const norm = (s: string): string =>
  fold(s)
    .replace(/[^\p{L}\p{N}$€£]+/gu, ' ')
    .trim();
const same = (a: string, b: string): boolean => {
  const x = norm(a);
  const y = norm(b);
  return x.length > 0 && y.length > 0 && (x.includes(y) || y.includes(x));
};

function contextFor(def: ThreadDef): ReturnType<typeof createContext> {
  const input: ContextInput = {
    source: 'playground',
    threadId: def.message,
    sentAt: def.sentAt,
    message: def.message,
    sender: def.sender,
    recipients: def.recipients,
  };
  return createContext(input, TODAY);
}

describe('ask corpus (AC-6.4)', () => {
  it('has at least 60 labelled messages', () => {
    expect(asks.length).toBeGreaterThanOrEqual(60);
    expect(new Set(asks.map((a) => a.id)).size).toBe(asks.length);
  });

  const results = asks.map((c) => {
    const ctx = createContext(
      { source: 'playground', threadId: c.id, sentAt: '2026-11-02', message: c.message },
      TODAY,
    );
    const { asks: extracted, truncatedAsks } = check(
      ctx,
      { text: '', version: 0 },
      { today: TODAY },
    );
    const correct = extracted.filter((e) => c.asks.some((l) => same(e.text, l)));
    const found = c.asks.filter((l) => extracted.some((e) => same(e.text, l)));
    return { c, extracted, correct, found, truncatedAsks };
  });

  it('meets precision >= 0.90 (gated) and reports recall', () => {
    const extracted = results.reduce((n, r) => n + r.extracted.length, 0);
    const correct = results.reduce((n, r) => n + r.correct.length, 0);
    const labelled = results.reduce((n, r) => n + r.c.asks.length, 0);
    const found = results.reduce((n, r) => n + r.found.length, 0);
    const precision = correct / extracted;
    const recall = found / labelled;
    const wrong = results.flatMap((r) =>
      r.extracted
        .filter((e) => !r.correct.includes(e))
        .map((e) => `${r.c.id}: ${JSON.stringify(e.text)}`),
    );
    const missed = results.flatMap((r) =>
      r.c.asks.filter((l) => !r.found.includes(l)).map((l) => `${r.c.id}: ${JSON.stringify(l)}`),
    );
    process.stdout.write(
      `ask corpus: ${asks.length} messages, ${labelled} labelled asks, precision ${precision.toFixed(3)} (${correct}/${extracted}), recall ${recall.toFixed(3)} (${found}/${labelled})\n` +
        (wrong.length ? `  false positives:\n   ${wrong.join('\n   ')}\n` : '') +
        (missed.length ? `  missed:\n   ${missed.join('\n   ')}\n` : ''),
    );
    expect(precision, `false positives: ${wrong.join('; ')}`).toBeGreaterThanOrEqual(0.9);
    expect(recall, `missed: ${missed.join('; ')}`).toBeGreaterThanOrEqual(0.8);
  });

  it('extracts nothing from messages labelled as having no asks (boilerplate, quotes, forwards, signatures)', () => {
    const noisy = results.filter((r) => r.c.asks.length === 0 && r.extracted.length > 0);
    expect(noisy.map((r) => `${r.c.id}: ${r.extracted.map((e) => e.text).join(' | ')}`)).toEqual(
      [],
    );
  });

  it('caps at five and counts the rest (AC-6.3)', () => {
    const r = results.find((x) => x.c.expectTruncated !== undefined);
    expect(r?.extracted).toHaveLength(5);
    expect(r?.truncatedAsks).toBe(r?.c.expectTruncated);
  });
});

describe('guard corpus (AC-1.6, AC-2.6)', () => {
  const run = (c: GuardCase) => {
    const ctx = contextFor(guards.threads[c.thread]!);
    return check(
      ctx,
      { text: c.draft, version: 1 },
      { today: TODAY, ...(c.ignore ? { ignore: c.ignore } : {}) },
    ).flags;
  };
  const slips = guards.cases.filter((c) => c.kind === 'slip');
  const deliberate = guards.cases.filter((c) => c.kind === 'deliberate');

  it('has a meaningful slip set and a larger deliberate set', () => {
    expect(slips.length).toBeGreaterThanOrEqual(25);
    expect(deliberate.length).toBeGreaterThanOrEqual(40);
    expect(guards.cases.every((c) => guards.threads[c.thread])).toBe(true);
  });

  it('has zero false positives on the deliberate set (gated)', () => {
    const falsePositives = deliberate.flatMap((c) =>
      run(c).map(
        (f) =>
          `${c.id}: ${f.guard} ${JSON.stringify(f.found)} -> ${JSON.stringify(f.expected)} (${f.rule})`,
      ),
    );
    expect(falsePositives).toEqual([]);
  });

  it('catches the labelled slips and reports recall', () => {
    const missed: string[] = [];
    const unexpected: string[] = [];
    let wanted = 0;
    let caught = 0;
    for (const c of slips) {
      const flags = run(c);
      for (const w of c.flags) {
        wanted += 1;
        const hit = flags.find(
          (f) =>
            f.guard === w.guard &&
            same(f.found, w.found) &&
            (w.expected === undefined ||
              same(f.expected, w.expected) ||
              f.fixes.some((x) => same(x.replacement, w.expected!))),
        );
        if (hit) caught += 1;
        else missed.push(`${c.id}: ${w.guard} ${JSON.stringify(w.found)}`);
      }
      for (const f of flags) {
        if (!c.flags.some((w) => w.guard === f.guard && same(f.found, w.found))) {
          unexpected.push(`${c.id}: ${f.guard} ${JSON.stringify(f.found)}`);
        }
      }
    }
    process.stdout.write(
      `guard corpus: ${slips.length} slip cases, ${deliberate.length} deliberate cases, recall ${(caught / wanted).toFixed(3)} (${caught}/${wanted})\n` +
        (missed.length ? `  missed:\n   ${missed.join('\n   ')}\n` : ''),
    );
    expect(unexpected, 'flags the labels do not expect').toEqual([]);
    expect(caught / wanted).toBeGreaterThanOrEqual(0.9);
  });

  it('every flag carries a citation line from the thread and a fix', () => {
    for (const c of slips) {
      for (const f of run(c)) {
        expect(f.citation.line.length, c.id).toBeGreaterThan(0);
        expect(f.fixes.length, c.id).toBeGreaterThanOrEqual(1);
        expect(f.message, c.id).not.toMatch(/spelling|typo|grammar/i);
      }
    }
  });
});
