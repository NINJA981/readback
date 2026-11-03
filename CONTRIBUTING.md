# Contributing to Readback

Thanks for helping. The most valuable contributions right now are, in order:

1. **False-positive reports** with a thread and a reply that reproduce them (invented details
   only). Use the "Wrong squiggle" issue template.
2. **A run on live Gmail or in Firefox.** Neither has been done; see the README's Limitations.
3. **Corpus cases** for slips the guards miss or flag wrongly (below).

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Set up

You need Node 24 and pnpm 10 (`corepack enable` picks the version from `package.json`).

```sh
git clone https://github.com/NINJA981/readback.git
cd readback
pnpm install            # the extension and the engine
pnpm --dir site install # the landing page and the web app
```

## Layout

| Path                     | What it is                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/engine/`            | The checker. Pure TypeScript, no DOM, one dependency (chrono-node). Guards in `guards/`, ask extraction in `asks/`, copy in `cite.ts`.             |
| `src/core/index.ts`      | The one entry the extension and the web app share.                                                                                                 |
| `src/adapters/`          | Reading the thread and the reply box: `gmail/` (selector chains with a self-test) and `generic/` (any text box, through the context menu).         |
| `src/overlay/`           | Pill, guard card, ledger and the swap-back ghost, in one shadow root per page. `ui/` is props-only React; `controller.ts` is the DOM side.          |
| `src/ui/`, `entrypoints` | Popup, options, background and content scripts (WXT).                                                                                              |
| `site/`                  | Landing page and `/app`, a static Vite build that imports the same engine.                                                                         |
| `gallery/`               | Renders every component state for screenshots and the accessibility suite.                                                                        |
| `tests/`                 | Unit tests, the corpus gates (`tests/corpus`) and fixtures. `e2e/` runs the built extension in Chromium.                                          |
| `.impeccable/`           | `design.json`, the machine-readable sidecar of `DESIGN.md` (tokens and component specs) used by the design tooling. Edit it together with DESIGN.md. |

The architecture and its reasons are in `docs/adr/`. The product spec, with every acceptance
criterion, is `SPEC.md`; `docs/TESTING.md` maps each criterion to its tests.

## Before you open a pull request

```sh
pnpm lint && pnpm typecheck   # also walks site/
pnpm test                     # unit, corpus gates, adapter fixtures
pnpm build && pnpm test:e2e   # if you touched the content script, overlay, popup or options
pnpm --dir site build && pnpm --dir site test:e2e   # if you touched site/
```

CI runs all of these (`.github/workflows/ci.yml`). On a small machine, run vitest with
`--maxWorkers=1 --no-file-parallelism`; Playwright already uses one worker.

Rules the checks enforce, so you are not surprised:

- **No network.** ESLint fails on `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` and
  `EventSource` in extension code, and every e2e test fails if the browser made a request that
  left the machine.
- **No mail text in storage or logs.** Settings and ignored words go to `chrome.storage.local`,
  per-reply choices to `chrome.storage.session` as hashed ids. Tests check that thread text never
  appears in either.
- **Every acceptance criterion has a test.** `tests/unit/spec-traceability.test.ts` fails if a
  test names a criterion that does not exist or the matrix in `docs/TESTING.md` is stale
  (`UPDATE_MATRIX=1 pnpm vitest run tests/unit/spec-traceability.test.ts` rewrites it).
- **Budgets.** `node scripts/check-size.mjs` (after `pnpm build`) fails if the Gmail content
  script passes 150 KB gzipped or a font face passes 40 KB.
- **Prettier** formats code and the root Markdown files; `pnpm format` fixes it.

## Adding a corpus case

The corpus is the regression net for the guards and the ask extractor. It lives in
`tests/fixtures/threads/` and is checked by `tests/corpus/corpus.test.ts`.

**A guard case** goes in `guards.json`:

1. If no existing thread fits, add one under `threads` with an invented sender, recipients,
   `sentAt` (ISO date) and `message`.
2. Add a case under `cases`:

   ```json
   {
     "id": "s31-number-invoice",
     "kind": "slip",
     "thread": "invoice",
     "draft": "Paid invoice #48231 this morning.",
     "flags": [{ "guard": "number", "found": "#48231", "expected": "#48213" }]
   }
   ```

   Use `"kind": "deliberate"` with `"flags": []` for a draft the guards must stay quiet on
   (a counter-offer, a different person, a genuinely new date). Deliberate cases are gated at
   **zero** flags, so they are the best way to pin down a false positive you fixed.

3. Write the label from what a careful human would say, not from what the engine prints. If the
   engine disagrees, decide which one is wrong and say so in the pull request.

**An ask case** goes in `asks.json`: the incoming `message` and the `asks` a reader would say it
makes (`[]` for none). Ask precision on this file is gated at 0.90.

Then run `pnpm test:corpus`. Keep every person, company, address and number invented, and keep
`id` prefixes in order (`s` slip, `d` deliberate, `a` ask).

## Commits and pull requests

- Small, focused changes with a plain-English message saying what changed and why.
- Fill in the pull request template, including how you checked it.
- New UI follows `DESIGN.md` (tokens, type scale, motion rules). The gallery
  (`gallery/`) should get a scene for any new state.

## License

By contributing you agree that your contribution is licensed under the MIT license of this
repository.
