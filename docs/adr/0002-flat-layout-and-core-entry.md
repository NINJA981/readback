# ADR-0002: App at the repo root, one `src/core` entry, ESLint + Prettier

**Status:** Accepted (Stage 2, Scaffold + Core)
**Date:** 2026-10-27
**Amends:** [ADR-0001](0001-architecture.md) (module layout, lint tool, TypeScript line)

## Context

ADR-0001 proposed a pnpm monorepo (`packages/engine`, `packages/ui`, `apps/extension`, `apps/site`). Stage 2 was told to scaffold the app **at the repo root**, with the landing page and a phone-friendly web app to live later in `site/` as their own package. The web app imports the same engine, so the engine must be importable without any `chrome.*` or `browser.*` API.

## Decision

1. **Flat layout.** The WXT app is the root package. `site/` (later) is a separate package that imports `../src/core` (a path alias or a workspace link, decided when it is created).
2. **One entry module: `src/core/index.ts`.** It re-exports the engine, the state machine, the storage layer, the message protocol, the DOM helpers and the platform storage adapters. Nothing it exports touches `chrome.*` / `browser.*`. The extension and the web app both import from `src/core`.
3. **Layers and the rule that keeps them honest.**

   | Folder | May use | Must not use |
   |---|---|---|
   | `src/engine` | `chrono-node`, relative imports | any DOM global, any other folder (tsconfig `lib: ES2023` + ESLint `no-restricted-imports`) |
   | `src/state`, `src/storage`, `src/messaging` | `src/engine`, each other | DOM, `chrome`/`browser` |
   | `src/dom`, `src/adapters` | the DOM, `src/engine`, `src/state` | `chrome`/`browser` (adapters take their inputs and effects as arguments) |
   | `src/platform` | `StorageArea` implementations: `extension-storage.ts` (the only file besides `src/entrypoints` that imports `wxt/browser`), `web-storage.ts` (`localStorage`, `sessionStorage`) | |
   | `src/entrypoints`, `src/ui` | everything | |

4. **ESLint (typescript-eslint strict, type-checked) + Prettier** replace Biome. The network ban (`fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon`) is an ESLint `no-restricted-globals` / `no-restricted-properties` rule over `src/` with an **empty allow-list**. Reason: the user's brief for Stage 2 named ESLint and Prettier, and typescript-eslint's type-aware rules catch the unsafe-`unknown` mistakes that matter for storage and messaging parsing.
5. **TypeScript 6.0.3**, not 7.0.2. typescript-eslint 8.72 and WXT's generated `.wxt/tsconfig.json` target the classic compiler API. `npm view typescript version` reports 7.0.2 as latest; this is the fallback ADR-0001 allowed. Revisit when typescript-eslint supports the native port.
6. **Versions** stay pinned exactly. On 2026-10-27 `npm view` shows `wxt` 0.21.5, `vite` 8.3.5, `happy-dom` 21.0.4 and `typescript-eslint` 8.72.1 as newer patches than the pins (0.21.4, 8.3.4, 21.0.3, 8.72.0). The pins are kept because the lockfile was resolved and tested against them; bump them together in a dedicated change.

## Recorded spikes

- **AC-3.5, chrono-node 2.10.3 and `Thursday the 10th`.** The unit spike (`tests/unit/engine/harvest.test.ts`) records the result: for `Thursday the 10th` chrono parses **only the weekday** (`text` is `Thursday`, weekday certain, day not certain), and for `Thu 10 Nov` it keeps weekday and day certain and resolves the date by the day (a Tuesday). So chrono does not give a usable weekday-plus-day pair for the month-less form. The engine therefore parses `weekday (the) Nth` itself (`src/engine/harvest/dates.ts`, `WEEKDAY_DAY_RE`) and uses chrono only for forms that carry a month. This is the fallback AC-3.5 allowed.
- **Highlight painting in Firefox.** Not run in this stage (no Firefox build is exercised by tests). `src/styles/highlights.css` declares the wavy underline for Chromium and a solid-underline-plus-tint rule inside a Firefox-only `@supports (-moz-appearance: none)` block, which is the fallback described in ADR-0001 Decision 1. Verification is listed in HANDOFF.md.

## Consequences

- One `package.json`, one lockfile, one `pnpm test`. No workspace plumbing until `site/` exists.
- The web app gets the same engine, state machine, text index and storage code the extension runs, so the playground proves the real mechanism.
- ADR-0001's `packages/*` and `apps/*` paths map to `src/engine`, `src/state`, `src/ui` and the root WXT app respectively. Everything else in ADR-0001 stands.

## Other Stage 2 deviations from ADR-0001

- **No `offscreen` permission yet.** The model host does not exist in Stage 2, and an unused permission is a store-review flag. Add it back with the model host.
- **No Radix, cmdk, Motion, NumberFlow or Lucide yet.** The Stage 2 UI is a placeholder over the real storage layer (plain accessible elements with the DESIGN.md tokens); those libraries arrive with the Stage 3 UI.
- **Tailwind v4 `@theme inline` resets the default palette, radii, shadows, fonts and type scale** (`--color-*: initial` and friends), so an off-token utility such as `bg-red-500` does not exist. `tests/unit/styles/tokens.test.ts` also greps the UI for raw colours and palette utilities.
- **Firefox builds as MV3** through `--mv3` (`pnpm build:firefox`); WXT defaults Firefox to MV2.
- **Fonts** are imported from the Fontsource packages (`wdth.css` for Hubot and Mona, `index.css` for Geist Mono), which bundles every subset. Trimming to Latin only (the 40 KB per face budget in DESIGN.md) is not done yet.
- **Runtime-registered selection script** declares `matches: []` so WXT does not add `<all_urls>` to `host_permissions`; the built manifest is checked in HANDOFF.md.
