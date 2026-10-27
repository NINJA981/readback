/**
 * Parity, engine level. The web app builds its engine input from pasted text
 * (`source: 'playground'`, thread id `paste`); the extension builds it from a selection
 * (`selectionContextInput`). Same message, same reply, same day: the answers must be identical.
 * The browser-level twin of this test is e2e/parity.spec.ts, which drives both real surfaces.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { check, createContext, selectionContextInput } from '../../src/core/index';
import type { CheckResult, ContextInput } from '../../src/core/index';
import { SAMPLES } from '../../site/src/shared/samples';

const TODAY = new Date(2026, 10, 2, 12);

interface ThreadDef {
  message: string;
}
interface GuardCase {
  id: string;
  thread: string;
  draft: string;
}
const guards = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'fixtures', 'threads', 'guards.json'), 'utf8'),
) as { threads: Record<string, ThreadDef>; cases: GuardCase[] };

/** What the web app's paste path builds (site/src/app/App.tsx, no sample, no sender). */
const webInput = (message: string): ContextInput => ({
  source: 'playground',
  threadId: 'paste',
  message,
});

/** What the extension builds after "Use as Readback context". */
function extensionInput(message: string): ContextInput {
  const input = selectionContextInput(message);
  if (!input) throw new Error('selection too short');
  return input;
}

/** Everything a person can see of a result; ids hash the thread id, which differs by design. */
function visible(result: CheckResult): unknown {
  return {
    flags: result.flags.map((f) => ({
      guard: f.guard,
      rule: f.rule,
      span: f.draftSpan,
      found: f.found,
      expected: f.expected,
      message: f.message,
      fixes: f.fixes,
    })),
    asks: result.asks.map((a) => ({ text: a.text, state: a.state })),
    truncatedAsks: result.truncatedAsks,
  };
}

function bothWays(message: string, draft: string): [unknown, unknown] {
  const web = check(createContext(webInput(message), TODAY), { text: draft, version: 1 });
  const ext = check(createContext(extensionInput(message), TODAY), { text: draft, version: 1 });
  return [visible(web), visible(ext)];
}

describe('web app and extension give identical engine output', () => {
  for (const s of SAMPLES) {
    it(`sample ${s.id}`, () => {
      const [web, ext] = bothWays(s.message, s.draft);
      expect(ext).toEqual(web);
      expect((web as { flags: unknown[] }).flags.length).toBeGreaterThan(0);
    });
  }

  it('every guard-corpus case, slip or deliberate', () => {
    expect(guards.cases.length).toBeGreaterThanOrEqual(60);
    for (const c of guards.cases) {
      const message = guards.threads[c.thread]?.message;
      if (message === undefined) throw new Error(`case ${c.id}: unknown thread ${c.thread}`);
      const [web, ext] = bothWays(message, c.draft);
      expect(ext, c.id).toEqual(web);
    }
  });

  it('an empty reply and an empty-asks thread agree too', () => {
    for (const s of SAMPLES) {
      const [web, ext] = bothWays(s.message, '');
      expect(ext).toEqual(web);
    }
  });
});
