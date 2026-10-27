/**
 * Spec traceability: every acceptance criterion in SPEC.md is either named by a test of the kind
 * it asks for, or listed below as waived with the reason. A criterion nobody tests, or a test
 * that names an id the spec does not have, fails here. `docs/TESTING.md` carries the matrix and
 * is checked against the sources; regenerate it with
 *   UPDATE_MATRIX=1 pnpm vitest run tests/unit/spec-traceability.test.ts
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..', '..');

type Kind = 'U' | 'F' | 'E' | 'V' | 'L';
interface Criterion {
  id: string;
  kind: Kind;
  text: string;
  section: string;
}

/** Where each kind of criterion has to be exercised. */
const HOMES: Record<Kind, string[]> = {
  U: ['tests/unit', 'site/tests'],
  F: ['tests/corpus'],
  E: ['e2e', 'site/e2e'],
  V: ['e2e', 'site/e2e', 'tests/unit'],
  L: [],
};

/** Criteria that are not (fully) automated, and why. Each must still be a real SPEC id. */
const WAIVED: Record<string, string> = {
  'AC-5.4':
    'Frame-exact swap-back against the playground capture is a visual check. The frame function ' +
    'is unit-tested (tests/unit/overlay/swap.test.ts) and capture is reproducible (AC-9.2), ' +
    'but no automated comparison against the DESIGN.md timeline at 60 fps exists.',
  'AC-7.3':
    'The model host (MiniLM) is not built, so there is no inference to time. The options ' +
    'panel says "Not included in this build".',
  'AC-W.12':
    'Lighthouse and cold performance traces run through the chrome-devtools MCP by hand; ' +
    'the results are recorded in site/HANDOFF.md.',
};

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === 'dist' || name === 'test-results') return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function criteria(): Criterion[] {
  const out: Criterion[] = [];
  let section = '';
  for (const line of readFileSync(join(ROOT, 'SPEC.md'), 'utf8').split(/\r?\n/)) {
    const heading = /^\*\*(.+?)\*\*$/.exec(line.trim()) ?? /^#{2,3} (.+)$/.exec(line);
    if (heading?.[1] && !line.startsWith('- ')) section = heading[1];
    const m = /^- (AC-[0-9A-Z]+\.\d+) \(([UFEVL])\) (.*)$/.exec(line);
    if (m) out.push({ id: m[1] as string, kind: m[2] as Kind, text: m[3] as string, section });
  }
  return out;
}

/** File (repo-relative, forward slashes) -> the AC ids its text names. */
function mentions(): Map<string, Set<string>> {
  const files = [
    ...walk(join(ROOT, 'tests')),
    ...walk(join(ROOT, 'e2e')),
    ...walk(join(ROOT, 'site', 'e2e')),
    ...walk(join(ROOT, 'site', 'tests')),
  ].filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('spec-traceability.test.ts'));
  const out = new Map<string, Set<string>>();
  for (const file of files) {
    const ids = new Set(readFileSync(file, 'utf8').match(/AC-[0-9A-Z]+\.\d+/g) ?? []);
    if (ids.size > 0) out.set(relative(ROOT, file).replaceAll('\\', '/'), ids);
  }
  return out;
}

const inHome = (file: string, kind: Kind): boolean =>
  HOMES[kind].some((dir) => file.startsWith(`${dir}/`));

function matrix(all: Criterion[], seen: Map<string, Set<string>>): string {
  const rows = all.map((c) => {
    const files = [...seen.entries()]
      .filter(([, ids]) => ids.has(c.id))
      .map(([f]) => f)
      .sort();
    const covered = WAIVED[c.id]
      ? `**Not automated.** ${WAIVED[c.id]}${files.length ? ` Related: ${files.map((f) => `\`${f}\``).join(', ')}.` : ''}`
      : files.map((f) => `\`${f}\``).join(', ');
    const text = c.text.length > 110 ? `${c.text.slice(0, 107).trimEnd()}...` : c.text;
    return `| ${c.id} | ${c.kind} | ${text.replaceAll('|', '\\|')} | ${covered} |`;
  });
  return [
    '| Criterion | Kind | What it says | Covered by |',
    '| --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
}

const START = '<!-- matrix:start -->';
const END = '<!-- matrix:end -->';

describe('every SPEC acceptance criterion is tested or openly waived', () => {
  const all = criteria();
  const seen = mentions();

  it('finds the criteria', () => {
    expect(all.length).toBeGreaterThanOrEqual(59);
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
  });

  it('names a test of the right kind for each one', () => {
    const problems: string[] = [];
    for (const c of all) {
      if (WAIVED[c.id]) continue;
      const files = [...seen.entries()].filter(([, ids]) => ids.has(c.id)).map(([f]) => f);
      if (!files.some((f) => inHome(f, c.kind))) {
        problems.push(
          `${c.id} (${c.kind}) is not named in ${HOMES[c.kind].join(' or ') || 'any test'}` +
            (files.length ? ` (only in ${files.join(', ')})` : ''),
        );
      }
    }
    expect(problems).toEqual([]);
  });

  it('waivers are for real criteria, and are dropped once something tests them', () => {
    const ids = new Set(all.map((c) => c.id));
    for (const id of Object.keys(WAIVED)) expect(ids.has(id), `${id} is in SPEC.md`).toBe(true);
    const nowTested = Object.keys(WAIVED).filter((id) => {
      const c = all.find((x) => x.id === id);
      if (!c) return false;
      return [...seen.entries()].some(([f, set]) => set.has(id) && inHome(f, c.kind));
    });
    // A waiver whose criterion has gained a test of its own kind is stale and should go.
    expect(nowTested).toEqual([]);
  });

  it('no test names a criterion the spec does not have', () => {
    const ids = new Set(all.map((c) => c.id));
    const unknown: string[] = [];
    for (const [file, set] of seen) {
      for (const id of set) if (!ids.has(id)) unknown.push(`${file}: ${id}`);
    }
    expect(unknown).toEqual([]);
  });

  it('docs/TESTING.md carries the current matrix', () => {
    const path = join(ROOT, 'docs', 'TESTING.md');
    const current = existsSync(path) ? readFileSync(path, 'utf8').replace(/\r\n/g, '\n') : '';
    const fresh = matrix(all, seen);
    if (process.env['UPDATE_MATRIX'] === '1') {
      const head = current.includes(START)
        ? current.slice(0, current.indexOf(START))
        : '# Testing\n\n';
      const tail = current.includes(END) ? current.slice(current.indexOf(END) + END.length) : '\n';
      writeFileSync(path, `${head}${START}\n${fresh}\n${END}${tail}`);
      return;
    }
    const block = current.slice(
      current.indexOf(START) + START.length,
      Math.max(current.indexOf(END), 0),
    );
    expect(
      block.trim(),
      'run: UPDATE_MATRIX=1 pnpm vitest run tests/unit/spec-traceability.test.ts',
    ).toBe(fresh.trim());
  });
});
