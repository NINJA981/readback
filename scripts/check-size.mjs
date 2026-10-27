/* eslint-disable no-console -- a CLI script that reports sizes */
// Size gate for the production build (.output/chrome-mv3): fails when a budget is exceeded.
// Run `pnpm build` first; `pnpm size` does both. Budgets: DESIGN.md 8.3 and SPEC AC-G.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const out = resolve(import.meta.dirname, '..', '.output', 'chrome-mv3');
const KB = 1024;

/** [path relative to the output folder, max gzipped bytes] */
const scripts = [
  ['content-scripts/gmail.js', 150 * KB],
  ['content-scripts/selection.js', 150 * KB],
];
const FONT_MAX = 40 * KB;

const gz = (file) => gzipSync(readFileSync(file), { level: 9 }).length;
const failures = [];
const rows = [];

for (const [rel, max] of scripts) {
  const file = join(out, rel);
  let size;
  try {
    size = gz(file);
  } catch {
    failures.push(`${rel}: missing (run pnpm build first)`);
    continue;
  }
  rows.push(`${rel.padEnd(34)} ${(size / KB).toFixed(1).padStart(7)} KB gz of ${max / KB} KB`);
  if (size > max) failures.push(`${rel}: ${size} bytes gzipped is over the ${max} byte budget`);
}

const assets = join(out, 'assets');
try {
  for (const name of readdirSync(assets)) {
    if (!name.endsWith('.woff2')) continue;
    const size = statSync(join(assets, name)).size;
    rows.push(
      `assets/${name}`.padEnd(34) +
        ` ${(size / KB).toFixed(1).padStart(7)} KB of ${FONT_MAX / KB} KB`,
    );
    if (size > FONT_MAX)
      failures.push(`assets/${name}: ${size} bytes is over the ${FONT_MAX} byte font budget`);
  }
} catch {
  failures.push('assets/: missing (run pnpm build first)');
}

console.log(rows.join('\n'));
if (failures.length > 0) {
  console.error(`\nSize gate failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\nSize gate passed.');
