/**
 * The tokens in src/styles are DESIGN.md's tokens. This test reads DESIGN.md's
 * frontmatter and fails when the two drift, and greps the UI source for
 * off-token values (raw colours, palette utilities, arbitrary colour values).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

const design = read('DESIGN.md');
const frontmatter = /^---\n([\s\S]*?)\n---/.exec(design)?.[1] ?? '';

/** `name: "value"` lines of one top-level frontmatter section. */
function section(name: string): Map<string, string> {
  const out = new Map<string, string>();
  let inside = false;
  for (const line of frontmatter.split('\n')) {
    if (/^\S/.test(line)) inside = line.startsWith(`${name}:`);
    else if (inside) {
      const m = /^\s{2}"?([\w.-]+)"?:\s*"([^"]*)"\s*$/.exec(line);
      if (m?.[1] && m[2] !== undefined) out.set(m[1], m[2]);
    }
  }
  return out;
}

/** Canonical form: numbers parsed, so 0.20 equals 0.2; hex lower-cased. */
function canon(value: string): string {
  const v = value.trim().toLowerCase();
  const m = /^oklch\(([^)]*)\)$/.exec(v);
  if (!m?.[1]) return v;
  const parts = m[1].split(/[\s/]+/).filter(Boolean);
  return `oklch(${parts.map((p) => String(Number.parseFloat(p))).join(' ')})`;
}

/** The declarations of the rule whose selector contains `selector`. */
function block(css: string, selector: string): Map<string, string> {
  const start = css.indexOf(selector);
  expect(start, `selector ${selector}`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  let depth = 0;
  let end = open;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') depth -= 1;
    if (depth === 0) {
      end = i;
      break;
    }
  }
  const out = new Map<string, string>();
  for (const m of css.slice(open + 1, end).matchAll(/(--rb-[\w-]+):\s*([^;]+);/g)) {
    out.set(m[1]!, m[2]!.replace(/\s+/g, ' ').trim());
  }
  return out;
}

const ROLES = [
  'bg',
  'surface',
  'surface-2',
  'surface-3',
  'border',
  'border-strong',
  'text',
  'text-muted',
  'text-subtle',
  'brass',
  'brass-hover',
  'on-brass',
  'brass-soft',
  'brass-text',
  'slip',
  'danger',
  'danger-soft',
  'success',
  'success-soft',
] as const;

const tokensCss = read('src/styles/tokens.css');
const colors = section('colors');

describe('tokens.css matches DESIGN.md', () => {
  it('parsed the frontmatter', () => {
    expect(colors.size).toBeGreaterThanOrEqual(38);
  });

  const themes = [
    ['dark', block(tokensCss, ':root,\n:host {')],
    ['light', block(tokensCss, ":root[data-theme='light']")],
  ] as const;

  for (const [theme, vars] of themes) {
    it.each(ROLES)(`${theme}: --rb-%s`, (role) => {
      const expected = colors.get(`${role}-${theme}`);
      expect(expected, `DESIGN.md has ${role}-${theme}`).toBeDefined();
      expect(canon(vars.get(`--rb-${role}`) ?? ''), `--rb-${role} (${theme})`).toBe(
        canon(expected!),
      );
    });
  }

  it('the light set under prefers-color-scheme equals the data-theme="light" set', () => {
    const media = block(tokensCss, ":root:not([data-theme='dark'])");
    const forced = block(tokensCss, ":root[data-theme='light']");
    expect(media).toEqual(forced);
  });

  it('radii match DESIGN.md', () => {
    const rounded = section('rounded');
    const vars = block(tokensCss, ':root,\n:host {');
    for (const key of ['xs', 'sm', 'md', 'lg']) {
      expect(vars.get(`--rb-radius-${key}`)).toBe(rounded.get(key));
    }
  });

  it('every theme-able role is defined in both themes', () => {
    for (const [, vars] of themes) {
      for (const role of ROLES) expect(vars.has(`--rb-${role}`)).toBe(true);
    }
  });
});

describe('highlights.css uses the slip colours from the tokens', () => {
  const css = read('src/styles/highlights.css');
  it('light and dark squiggle and tint literals equal the tokens', () => {
    for (const literal of [
      colors.get('slip-light'),
      colors.get('slip-dark'),
      colors.get('danger-soft-light'),
      colors.get('danger-soft-dark'),
    ]) {
      const wanted = canon(literal!);
      const found = [...css.matchAll(/oklch\([^)]*\)|#[0-9a-f]{6}/gi)].map((m) => canon(m[0]));
      expect(found, `highlights.css contains ${literal}`).toContain(wanted);
    }
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe('no off-token values in the UI', () => {
  const files = [
    ...walk(join(ROOT, 'src', 'ui')),
    ...walk(join(ROOT, 'src', 'overlay')),
    ...walk(join(ROOT, 'src', 'entrypoints')),
  ].filter((f) => /\.(tsx|ts|html)$/.test(f));
  const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\/|(?<![:'"])\/\/.*$/gm, '');

  it('finds the UI files', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it('contains no hex, rgb, hsl or oklch colour literals', () => {
    const bad = files.flatMap((f) =>
      [
        ...strip(readFileSync(f, 'utf8')).matchAll(
          /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lch)\(/g,
        ),
      ].map((m) => `${relative(ROOT, f)}: ${m[0]}`),
    );
    expect(bad).toEqual([]);
  });

  it('uses no Tailwind palette utilities or arbitrary colour values', () => {
    const palette =
      /\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|decoration|divide|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(?:-\d{2,3})?\b/;
    const arbitraryColour =
      /\b(?:bg|text|border|ring|fill|stroke|shadow)-\[(?:#|rgb|hsl|oklch|var\(--(?!rb-))/;
    const bad = files.flatMap((f) => {
      const src = readFileSync(f, 'utf8');
      return [palette.exec(src)?.[0], arbitraryColour.exec(src)?.[0]]
        .filter((x): x is string => x !== undefined)
        .map((x) => `${relative(ROOT, f)}: ${x}`);
    });
    expect(bad).toEqual([]);
  });

  it('the Tailwind theme resets the default palette so off-token utilities cannot exist', () => {
    const app = read('src/styles/app.css');
    for (const reset of [
      '--color-*: initial',
      '--radius-*: initial',
      '--shadow-*: initial',
      '--font-*: initial',
      '--text-*: initial',
    ]) {
      expect(app).toContain(reset);
    }
  });

  it('declares no network-capable APIs anywhere in src (SPEC 8); eslint enforces it too', () => {
    const src = walk(join(ROOT, 'src')).filter((f) => /\.tsx?$/.test(f));
    const bad = src
      .filter((f) =>
        /\b(?:fetch\s*\(|XMLHttpRequest|new WebSocket|new EventSource|sendBeacon)/.test(
          strip(readFileSync(f, 'utf8')),
        ),
      )
      .map((f) => relative(ROOT, f));
    expect(bad).toEqual([]);
  });
});
