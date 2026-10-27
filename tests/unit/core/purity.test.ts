/**
 * The web app in site/ imports src/core/index.ts, so nothing reachable from it
 * may touch an extension API (extension globals stay behind small adapters).
 * This test walks the import graph and fails on a reverse import or an
 * extension global.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(import.meta.dirname, '..', '..', '..', 'src');
const ENTRY = join(SRC, 'core', 'index.ts');

const stripComments = (source: string): string => source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

function resolveImport(from: string, spec: string): string | undefined {
  const base = resolve(dirname(from), spec);
  for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/** Every file reachable from the entry through relative imports, comments removed. */
function graph(): Map<string, string> {
  const files = new Map<string, string>();
  const queue = [ENTRY];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (files.has(file)) continue;
    const code = stripComments(readFileSync(file, 'utf8'));
    files.set(file, code);
    for (const m of code.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const next = resolveImport(file, m[1]!);
      if (next) queue.push(next);
    }
  }
  return files;
}

describe('src/core is free of extension APIs', () => {
  const files = graph();
  const rel = (f: string): string => f.slice(SRC.length + 1).replaceAll('\\', '/');

  it('reaches the layers the web app needs', () => {
    const names = [...files.keys()].map(rel);
    for (const expected of [
      'engine/index.ts',
      'state/session.ts',
      'storage/repository.ts',
      'dom/text-index.ts',
      'adapters/target.ts',
      'platform/web-storage.ts',
    ]) {
      expect(names).toContain(expected);
    }
    expect(names).not.toContain('platform/extension-storage.ts');
  });

  it('never imports wxt, the entrypoints or the extension storage adapter', () => {
    const bad: string[] = [];
    for (const [file, code] of files) {
      if (/from\s+['"](?:wxt|webextension-polyfill|@wxt-dev)[^'"]*['"]/.test(code)) {
        bad.push(`${rel(file)}: imports an extension package`);
      }
      if (/entrypoints\/|extension-storage/.test(code)) bad.push(`${rel(file)}: imports app code`);
    }
    expect(bad).toEqual([]);
  });

  it('never calls chrome.* or browser.*', () => {
    const bad = [...files]
      .filter(([, code]) => /\b(?:chrome|browser)\s*\.\s*[a-z]/.test(code))
      .map(([f]) => rel(f));
    expect(bad).toEqual([]);
  });

  it('the engine layer imports nothing outside src/engine (except chrono-node)', () => {
    const bad: string[] = [];
    for (const [file, code] of files) {
      if (!rel(file).startsWith('engine/')) continue;
      for (const m of code.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        const spec = m[1]!;
        if (spec === 'chrono-node') continue;
        const inside =
          spec.startsWith('.') && resolve(dirname(file), spec).startsWith(join(SRC, 'engine'));
        if (!inside) bad.push(`${rel(file)} -> ${spec}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('loads in a plain Node environment with no DOM at import time', async () => {
    const core = await import('../../../src/core/index');
    expect(typeof core.check).toBe('function');
    expect(typeof core.createComposeSession).toBe('function');
    expect(core.ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    // The web app can build a context and run a check without any browser global.
    const ctx = core.createContext(
      {
        source: 'playground',
        threadId: 't',
        message: 'Hi Sam,\nCan you confirm the $1,250 deposit?\nThanks,\nKathryn',
      },
      new Date(2026, 10, 2),
    );
    const flags = core.check(ctx, {
      text: 'Hi Catherine, the $1,520 deposit is fine.',
      version: 1,
    }).flags;
    expect(flags).toHaveLength(2);
    // The pure parts of the overlay load too, with no DOM: the playground renders from these.
    expect(core.planSwap('Catherine', 'Kathryn', 'name').kind).toBe('morph');
    expect(typeof core.ledgerModel).toBe('function');
    // First import compiles the whole graph; allow for a loaded machine.
  }, 30_000);
});
