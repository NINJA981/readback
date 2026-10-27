# HANDOFF: Readback

**Current stage:** 2 (Scaffold + Core) is complete. Next: Stage 3 (UI: overlay, playground, site).
**Last updated:** 2026-10-27

Readback is "spellcheck that has read the thread you're replying to": a browser extension (WXT, Chrome MV3 first, Firefox MV3 build too) whose guards underline near-miss names, numbers and dates in a reply by checking them against the message being answered, plus an ask pill. Scope authority is `_studio/picks.json` and `SPEC.md`.

## What is done

| Area                                             | State                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scaffold                                         | WXT 0.21.4 app at the **repo root** (ADR-0002), TypeScript strict, ESLint (typescript-eslint strict type-checked) + Prettier, Vitest, Playwright, MIT `LICENSE`, `.gitignore`. Scripts: `dev`, `build`, `test`, `test:e2e`, `lint`, `typecheck` (plus `test:corpus`, `test:coverage`, `build:firefox`, `zip`).                                                           |
| Design tokens                                    | DESIGN.md as CSS variables in `src/styles/tokens.css` (light + dark), wired into Tailwind v4 `@theme inline` (`src/styles/app.css`) with the default palette, radii, shadows, fonts and type scale reset. Hubot Sans, Mona Sans and Geist Mono are self-hosted through Fontsource. `tests/unit/styles/tokens.test.ts` checks the tokens against DESIGN.md's frontmatter. |
| Engine (`src/engine`)                            | Pure TypeScript: text utils, quote/signature/forward stripping, harvest (names, numbers, dates), the three guards, ask extractor, coverage (lexical + model-score interface), hashing, copy strings. Depends only on `chrono-node`.                                                                                                                                      |
| State (`src/state`)                              | Compose session state machine, settings, ignore list, per-thread state reducer, view models (pill, ledger, popup status text), flag diff and navigation. No DOM, no extension API.                                                                                                                                                                                       |
| Storage (`src/storage`, `src/platform`)          | `StorageArea` interface with memory, `localStorage`/`sessionStorage` (web) and `browser.storage` (extension) implementations; a typed repository that validates every read and write.                                                                                                                                                                                    |
| DOM + adapters (`src/dom`, `src/adapters`)       | `TextIndex` (offset to DOM and back), CSS Custom Highlight painter, undo-safe fix path (`execCommand('insertText')` with a clipboard fallback), card geometry, Gmail adapter (selector chains, self-test, thread and recipient reading), generic selection adapter, textarea mirror, `DraftTarget`.                                                                      |
| Content layer (`src/content`, `src/entrypoints`) | Gmail controller and selection controller bind an editor to a session and paint highlights; background routes the context menu, commands and tab status; popup and options are **placeholders over the real storage layer** (working switches, status, ignore lists, Clear all).                                                                                         |
| One entry for the web app                        | `src/core/index.ts` re-exports everything above that is free of `chrome.*` / `browser.*`. `tests/unit/core/purity.test.ts` walks its import graph and fails on an extension import. `site/` imports this and nothing else from `src/`.                                                                                                                                   |
| Tests                                            | 16 vitest files, 342 tests (unit, corpus gates, happy-dom adapter and controller tests) and 12 Playwright tests that load the built extension.                                                                                                                                                                                                                           |

## How to run

```
pnpm install
pnpm dev                 # WXT dev, Chrome (loads .output/chrome-mv3-dev)
pnpm dev:firefox         # WXT dev, Firefox MV3
pnpm build               # .output/chrome-mv3
pnpm build:firefox       # .output/firefox-mv3
pnpm test                # vitest: unit + corpus gates + adapters
pnpm test:corpus         # just the labelled corpus gates
pnpm test:coverage       # v8 coverage (engine >= 90% lines is enforced)
pnpm test:e2e            # builds, then Playwright with the unpacked extension
pnpm lint                # eslint (network ban included) + prettier --check
pnpm typecheck           # app tsconfig + the engine's DOM-free tsconfig
```

Toolchain: Node 24.18.0, pnpm 10.34.6 (pinned via `packageManager`), Playwright Chromium from `PLAYWRIGHT_BROWSERS_PATH`, run headless through the `chromium` channel. To try it by hand: `pnpm build`, load `.output/chrome-mv3` unpacked in `chrome://extensions`.

## Results at the end of Stage 2

All run in this stage, on this machine: `pnpm lint`, `pnpm typecheck`, `pnpm test` (342 passed), `pnpm build` and `pnpm build:firefox` (both build), `pnpm test:e2e` (12 passed).

- Ask corpus: 64 labelled messages, precision 1.000, recall 1.000. Guard corpus: 30 slip cases, 48 deliberate cases, **0 false positives**, recall 1.000 (32 of 32 labelled flags). **These are optimistic**: the corpus was written by the same author as the engine, in one sitting, and is a regression net, not a benchmark. See `tests/fixtures/threads/README.md`.
- AC-G.1: engine p95 about 1.3 to 3 ms for a 2,000-word thread plus a 500-word draft (budget 16 ms), measured under load in three batches.
- Built package (Chrome): 857 kB unpacked, no model. Gmail content script 112 kB minified, **38 kB gzipped** (budget 150 KB gz, with React and the Stage 3 overlay still to come); popup and options share a 74 kB gz chunk (React plus Tailwind runtime). `size-limit` is not set up, so these are one-off measurements.
- Built manifest checked: `host_permissions` is `https://mail.google.com/*` only; permissions are `storage`, `contextMenus`, `activeTab`, `scripting`. Firefox manifest is MV3 with `gecko.strict_min_version` 140.0.
- The e2e suite records every request the browser makes and fails on anything that is not `chrome-extension://`, `data:`, `blob:` or the Gmail fixture origin (fulfilled from disk). Popup test asserts it. No request escaped.
- a11y: axe reports 0 violations on the popup and options page in light and dark.

## Verified versus unverified

**Verified (ran and passed):** the engine against every unit AC (AC-1.x to 3.x, 6.1 to 6.3, 7.1, 7.2, G.1); Gmail adapter extraction on all fixtures; the real content script on a Gmail-shaped page in Chromium (highlights registered with the exact flagged ranges, dark and light sets, 0 mutations by Readback in the editor, 0 attributes or nodes added, counts-only status in `storage.session`, no thread text in storage); the self-test failure path (silent, console clean); settings persistence and Clear all; fonts load from the extension; token parity with DESIGN.md.

**Not verified:**

- **Live Gmail.** No Gmail account is available. The fixtures are synthetic approximations of Gmail's public DOM conventions (`tests/fixtures/gmail/README.md`). Selector chains may not match today's Gmail. A human should capture sanitised real snapshots.
- **Firefox behaviour.** The Firefox MV3 build compiles; nothing was run in Firefox. Whether `::highlight()` honours a wavy `text-decoration` in Firefox 140+ is unknown; `src/styles/highlights.css` ships a solid-underline-plus-tint fallback for Firefox. Firefox MV3 also asks the user to grant the Gmail host permission.
- **AC-8.3 end to end.** Playwright cannot click a browser context menu or grant `activeTab`, so the selection flow (focus a textarea or contenteditable, flag, clear, navigate) is covered by happy-dom controller tests only, not in a real browser. The built `selection.js` is not exercised.
- **AC-4.3** (mirror underline within 2 px of the token's measured box): needs real layout; only the mirror's structure is unit tested.
- **Hover card, Alt+Shift+J / Alt+Shift+L, fix click, Ctrl+Z restore (AC-5.x), pill (AC-6.5), swap-back (AC-5.4), playground (AC-9.x), model (AC-7.3)**: not built in Stage 2 (UI and model are out of scope for this stage). The `next-slip` and `open-ledger` messages are routed by the background and ignored by the content scripts for now.
- `execCommand('insertText')` as the fix path is unit tested with fakes only; it has not been run against Gmail's editor.
- `storage.session` access from content scripts relies on `setAccessLevel`, which Chrome honoured in e2e; Firefox is untested.

## Known issues and open risks

- **Short-name near-misses can false-positive.** By the SPEC rule (Damerau-Levenshtein 1 for names of 5 letters or fewer, same first letter), `Tim` in a reply to a thread signed `Tom`, `Dan`/`Don`, `Lee`/`Leo`, `Mark`/`Marc` are all flagged. They are not in the "deliberate" corpus because the SPEC says to flag them. Mitigations exist (per-thread Ignore, global Never flag), but this is the main false-positive risk to watch. Consider requiring a variant-table pair for 3 to 4 letter names.
- **Only one reply compose is bound at a time** (the first found). Binding several at once needs per-editor painters; the highlight registry is global.
- **Pill, card, ledger, swap-back and the readback line are not drawn yet.** Squiggles and counts work; the user-facing overlay (React in one shadow root) is Stage 3. The shadow host (`src/content/overlay-host.ts`) and token injection exist and are used by the textarea mirror and the context chip.
- **Fonts:** Fontsource's `wdth.css` bundles Latin, Latin-ext and Vietnamese subsets (Hubot latin alone is 93 kB against the 40 KB per face budget in DESIGN.md). Subsetting is not done.
- **No `size-limit`** budgets yet (ADR-0001 lists them). `@huggingface/transformers` and the model host are not added; the `offscreen` permission was left out until the host exists (ADR-0002).
- **Chrome adds an unlayered `body { font-family }` to extension pages**, which beat the Tailwind base layer; `src/styles/app.css` has one deliberately unlayered `body { font: inherit }` rule for it. Keep it.
- **Dependency pins** are exact and valid but a few patches behind (`npm view` on 2026-10-27: wxt 0.21.5, vite 8.3.5, happy-dom 21.0.4, typescript-eslint 8.72.1). TypeScript is 6.0.3, not 7.0.2 (ADR-0002). pnpm is pinned to 10.34.6 although npm's latest is newer.
- **DESIGN.md lint** (`@google/design.md`) was inconclusive in Stage 1; token parity is checked by our own test instead.
- **Trademark check of "Readback"** has not been done. Council risks carried forward: Gemini in Gmail could add a similar check; guard catches are rare so daily value leans on the ask pill; the Gmail adapter needs maintenance; mobile is out.
- The chrono-node spike (AC-3.5) result is recorded in ADR-0002: chrono parses only the weekday from `Thursday the 10th`, so the engine parses `weekday (the) Nth` itself.

## Stage 3 starting order

1. Overlay UI in one shadow root (React 19): ask pill, guard card with citation and fix, ledger, keyboard commands (`next-slip`, `open-ledger`), swap-back. The session, geometry (`placeCard`, `hitTest`) and `fix()` already exist; wire them in `src/content/binding.ts`.
2. Hover dwell (300 ms) using `Binding.slips()` and one passive `pointermove`.
3. `site/`: landing and the paste-thread playground importing `src/core`; the demo timeline and frame capture.
4. Real Gmail snapshots (human), then retune `src/adapters/gmail/selectors.ts`.
5. Firefox smoke test, then the highlight spike result goes into ADR-0002.
6. Model host, package-size measurement, `size-limit`, font subsetting.
