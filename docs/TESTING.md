# Testing

How Readback is tested, what each layer proves, and which SPEC acceptance criteria (AC) each test covers. The matrix at the bottom is generated: `tests/unit/spec-traceability.test.ts` fails if an AC has no test of the kind it asks for, if a test names an AC the spec does not have, or if this table is stale (`UPDATE_MATRIX=1 pnpm vitest run tests/unit/spec-traceability.test.ts` rewrites it). A test "names" an AC by putting its id in a title or comment; the check proves every criterion has an owner, not that the owner is good. Read the tests.

## Layers

| Layer | Where | Runs | Proves |
| --- | --- | --- | --- |
| Unit (vitest) | `tests/unit`, `site/tests` | `pnpm test`, `pnpm --dir site test` | Engine, state, storage, adapters on DOM fixtures, overlay wording and swap-back maths, web-app helpers. The SPEC (U) criteria. |
| Corpus gates | `tests/corpus` | `pnpm test:corpus` (part of `pnpm test`) | Guard false positives = 0, ask precision >= 0.90. The SPEC (F) criteria. |
| Extension e2e | `e2e` | `pnpm test:e2e` | The built extension in Chromium (`launchPersistentContext` + `--load-extension`) on Gmail fixtures served by request interception: squiggles, card, fix and undo, ledger, popup, options, privacy gate. |
| Parity | `tests/unit/parity.test.ts`, `e2e/parity.spec.ts` | both of the above (the e2e one also needs `pnpm --dir site build`) | The web app and the extension give the same slips, messages, fixes, ask count and repaired reply for the same thread and reply. |
| Site e2e | `site/e2e` | `pnpm --dir site test:e2e` | The landing page and `/app` on the production build, at 1440 x 900 (desktop) and 375 x 812 touch (phone): flows, paste, offline, service worker, install criteria, network purity, deterministic capture, axe. |
| axe-core | `e2e/pages.spec.ts`, `e2e/a11y-overlay.spec.ts`, `site/e2e/a11y.spec.ts` | with the e2e suites | Zero violations on popup, options, the overlay (pill, card, ledger, chip) on a light and a dark host, the landing page, and every web-app state, in both themes. |
| Smoke | `site/e2e/smoke.spec.ts` | `pnpm --dir site test:e2e` | Every built page loads clean (200, h1, title, description, no console errors, no failed requests), every referenced file exists, root files are served. |

## Run everything

```
pnpm install && pnpm --dir site install
pnpm lint && pnpm typecheck
pnpm test                          # unit + corpus
pnpm --dir site test               # site unit
pnpm --dir site typecheck
pnpm --dir site build              # needed by the site e2e and by e2e/parity.spec.ts
pnpm test:e2e                      # builds the extension for e2e, then Playwright
pnpm --dir site test:e2e           # starts vite preview on :4173 if it is not running
pnpm build && pnpm build:firefox   # production builds
```

`pnpm test:e2e` leaves the open-shadow e2e build in `.output/chrome-mv3`; run `pnpm build` again before loading the extension for real.

## What is not tested, and why

- Live Gmail. Every Gmail test runs on synthetic fixtures. Selector chains, card placement against Gmail's real chrome and `execCommand('insertText')` against the real editor are unverified.
- Firefox. The Firefox build is produced and its manifest is checked, but no test runs it.
- The real context-menu click and the Alt+Shift+J / L chords. Playwright cannot drive browser menus or commands, so the e2e sends the same messages the background sends.
- Real phones. The "phone" project is Chromium with touch and mobile emulation at 375 x 812; it is not iOS Safari or Android Chrome, and it does not install the PWA to a home screen.
- The web app has no file upload, so there is no upload flow to test; paste (clipboard and keyboard shortcut) is covered.
- AC-5.4, AC-7.3 and AC-W.12: see the matrix.

## Matrix

<!-- matrix:start -->
| Criterion | Kind | What it says | Covered by |
| --- | --- | --- | --- |
| AC-1.1 | U | Thread signed `Kathryn`, draft `Hi Catherine,` → 1 flag, rule `variant`, message `She signs Kathryn`, fix `... | `tests/unit/engine/acceptance.test.ts` |
| AC-1.2 | U | To chip `Jon Reyes`, draft `Thanks John` → 1 flag, rule `edit-distance`. | `tests/unit/engine/acceptance.test.ts` |
| AC-1.3 | U | Thread names `Kathryn`, draft mentions `Bob` → 0 flags. | `tests/unit/engine/acceptance.test.ts` |
| AC-1.4 | U | Thread contains both `Catherine` and `Kathryn` → `Catherine` in the draft is not flagged. | `tests/unit/engine/acceptance.test.ts` |
| AC-1.5 | U | A global ignore of `Catherine` → 0 flags in any thread. | `tests/unit/engine/acceptance.test.ts`, `tests/unit/state/state.test.ts` |
| AC-1.6 | F | Name-guard false positives on the "deliberate" fixture set = 0. | `tests/corpus/corpus.test.ts` |
| AC-2.1 | U | Thread `$1,250`, draft `$1,520` → 1 flag `transposition`, message `Thread says $1,250. Digits swapped?`, fi... | `tests/unit/engine/acceptance.test.ts` |
| AC-2.2 | U | Thread `$1,250`, draft `$1,100`, `$1,200` or `$1,350` → 0 flags. | `tests/unit/engine/acceptance.test.ts` |
| AC-2.3 | U | Thread `order #48213`, draft `#48231` and, separately, `#48218` → 1 flag each (`transposition`, `substituti... | `tests/unit/engine/acceptance.test.ts` |
| AC-2.4 | U | Thread `$1,250`, draft `could we do $1,520 instead?` → 0 flags (counter-offer frame). | `tests/unit/engine/acceptance.test.ts` |
| AC-2.5 | U | Thread `1.250,00 €`, draft `1.520,00 €` → 1 flag. Thread `$1,250`, draft `1,520 nights` → 0 flags (kind mis... | `tests/unit/engine/acceptance.test.ts` |
| AC-2.6 | F | Number-guard false positives on the deliberate set = 0. | `tests/corpus/corpus.test.ts` |
| AC-3.1 | U | Reference date Mon 2 Nov 2026, draft `Thursday the 10th` → flag `weekday-mismatch`, message `The 10th is a... | `tests/unit/engine/acceptance.test.ts` |
| AC-3.2 | U | Thread proposes `Thursday the 12th`, draft `Thursday the 10th` → message `Thread says Thursday the 12th.`,... | `tests/unit/engine/acceptance.test.ts` |
| AC-3.3 | U | Thread proposes `Thursday the 12th`, draft `Monday the 23rd` → 0 flags. | `tests/unit/engine/acceptance.test.ts` |
| AC-3.4 | U | Draft `next Friday` → 0 flags. | `tests/unit/engine/acceptance.test.ts` |
| AC-3.5 | U | A spike test proves chrono-node 2.10.3 reports a certain weekday and day for `Thursday the 10th` without si... | `tests/unit/engine/harvest.test.ts` |
| AC-4.1 | E | After a flag on the Gmail fixture, a `MutationObserver` on the compose editor records **0 mutations** cause... | `e2e/gmail.spec.ts` |
| AC-4.2 | E | `CSS.highlights.has('readback-slip')` is true, and the highlight's range text equals the flagged token. | `e2e/gmail.spec.ts` |
| AC-4.3 | E | Generic adapter on a `<textarea>` fixture: the mirror underline's bounding box overlaps the token's measure... | `e2e/overlay.spec.ts`, `tests/unit/adapters/generic.test.ts` |
| AC-5.1 | E | Hovering the squiggle for 300 ms shows the card with the message and the cited line. Alt+Shift+J opens it f... | `e2e/overlay.spec.ts` |
| AC-5.2 | E | Clicking the fix changes the editor text to `Kathryn`. Then **Ctrl+Z** restores `Catherine`. The flag disap... | `e2e/overlay.spec.ts` |
| AC-5.3 | E | The card is reachable and operable by keyboard only (Tab, Enter, Esc), and focus returns to the editor care... | `e2e/overlay.spec.ts` |
| AC-5.4 | V | Swap-back frames match the DESIGN.md timeline within ±1 frame at 60 fps in the playground capture. | **Not automated.** Frame-exact swap-back against the playground capture is a visual check. The frame function is unit-tested (tests/unit/overlay/swap.test.ts) and capture is reproducible (AC-9.2), but no automated comparison against the DESIGN.md timeline at 60 fps exists. |
| AC-6.1 | U | The hero sample yields exactly 3 asks from one coordinated sentence. | `tests/unit/engine/acceptance.test.ts` |
| AC-6.2 | U | `Let me know if you have any questions!` yields 0 asks. Quoted history and signature yield 0 asks. A forwar... | `tests/unit/engine/acceptance.test.ts` |
| AC-6.3 | U | A message with 8 asks yields 5, with `truncatedAsks = 3`. | `tests/corpus/corpus.test.ts`, `tests/unit/engine/acceptance.test.ts` |
| AC-6.4 | F | Ask precision ≥ 0.90 on the labelled corpus (≥ 60 messages at MVP), reported by `pnpm test:corpus` and gate... | `tests/corpus/corpus.test.ts` |
| AC-6.5 | E | The pill text and colour flip from `1 open` (brass) to `All covered` (success) when the draft covers the la... | `e2e/overlay.spec.ts` |
| AC-6.6 | E | Dismissing an ask updates the count immediately (0 ms) and persists for that thread in `chrome.storage.sess... | `e2e/overlay.spec.ts`, `tests/unit/content/controllers.test.ts`, `tests/unit/state/state.test.ts` |
| AC-7.1 | U | With the model off, the lexical evidence rule marks `confirm the $1,250 deposit` as looks-answered for the... | `tests/unit/engine/acceptance.test.ts` |
| AC-7.2 | U | Confirming a looks-answered ask sets the state to `answered`. Answer inline inserts `> ask` and counts as a... | `tests/unit/engine/acceptance.test.ts`, `tests/unit/state/state.test.ts` |
| AC-7.3 | E | With the model enabled, the first inference finishes in under 1.5 s on the CI runner, later ones in under 1... | **Not automated.** The model host (MiniLM) is not built, so there is no inference to time. The options panel says "Not included in this build". |
| AC-8.1 | E | On each Gmail fixture (inline reply, pop-out reply, forward, light theme, dark theme, a thread with quoted... | `e2e/gmail-fixtures.spec.ts`, `tests/unit/adapters/gmail.test.ts` |
| AC-8.2 | E | On a Gmail fixture with renamed classes, the self-test fails and the adapter renders nothing. No error reac... | `e2e/gmail.spec.ts`, `tests/unit/adapters/gmail.test.ts`, `tests/unit/content/controllers.test.ts` |
| AC-8.3 | E | Generic adapter: select text on a fixture page, use the context-menu command, then type in a textarea on th... | `e2e/overlay.spec.ts`, `tests/unit/adapters/generic.test.ts`, `tests/unit/content/controllers.test.ts` |
| AC-9.1 | E | `/playground?sample=deposit` renders 3 asks and, after the scripted draft, 2 flags, using the same engine b... | `site/e2e/capture.spec.ts` |
| AC-9.2 | V | `?demo=signature&t=<ms>` renders the same pixels on repeated runs (screenshot diff = 0 at DPR 2). | `site/e2e/capture.spec.ts` |
| AC-9.3 | E | The playground issues 0 network requests after `load`. | `site/e2e/flows.spec.ts` |
| AC-9.4 | E | Pasted text never appears in `location.href` unless **Copy share link** is clicked. | `site/e2e/flows.spec.ts` |
| AC-10.1 | E | The popup's first paint is ≤ 100 ms (performance mark) and it is usable at 360 × 480 without vertical scroll. | `e2e/pages.spec.ts` |
| AC-10.2 | E | Turning a guard off in the popup removes its squiggles in the open compose within 100 ms. | `e2e/overlay.spec.ts`, `tests/unit/content/controllers.test.ts`, `tests/unit/state/state.test.ts` |
| AC-10.3 | E | Options → **Clear all** empties `chrome.storage.local` and `session` of Readback keys. | `e2e/pages.spec.ts`, `tests/unit/storage/storage.test.ts` |
| AC-G.1 | U | Engine check time for a 2,000-word thread plus a 500-word draft is p95 ≤ 16 ms on the CI runner (excluding... | `tests/unit/engine/performance.test.ts` |
| AC-G.2 | E | 0 non-local network requests across the whole e2e suite. | `e2e/fixtures.ts`, `e2e/gmail.spec.ts` |
| AC-G.3 | E | axe-core reports 0 violations on the popup, options, playground and landing in both themes. | `e2e/a11y-overlay.spec.ts`, `e2e/pages.spec.ts`, `site/e2e/a11y.spec.ts` |
| AC-G.4 | E | The content script's injected UI lives in one shadow root, and the page's computed styles are unchanged (sn... | `e2e/overlay.spec.ts` |
| AC-W.1 | E | `/app/` shows the h1, the privacy line and a `Try a sample` button with no thread and no reply. | `site/e2e/flows.spec.ts` |
| AC-W.2 | E | `Try a sample` fills both fields and the Slips list shows exactly the two slips of the sample (`Catherine`... | `site/e2e/flows.spec.ts` |
| AC-W.3 | E | With a sample thread loaded, `Hi Bob,` gives 0 slips and `Hi Catherine,` gives 1 (live, without a button pr... | `site/e2e/app.spec.ts` |
| AC-W.4 | E | A reply typed with no thread shows `Add the thread above` and no slips. | `site/e2e/flows.spec.ts` |
| AC-W.5 | U | For each of the six samples the real engine flags exactly the slips the sample's copy names, and stays quie... | `site/tests/samples.test.ts` |
| AC-W.6 | E | Every request made by `/app/` and by `/` goes to the page's own origin. The page carries a CSP with `connec... | `site/e2e/flows.spec.ts` |
| AC-W.7 | E | After one visit (service worker active), with the network switched off, a reload still renders the app, loa... | `site/e2e/flows.spec.ts`, `site/e2e/pwa.spec.ts` |
| AC-W.8 | E | The manifest is `display: standalone` with 192 px, 512 px and maskable icons. | `site/e2e/app.spec.ts`, `site/e2e/pwa.spec.ts` |
| AC-W.9 | E | At 375 px and 768 px (touch) every button, link, select and text area has a hit area of at least 44 px by 4... | `site/e2e/app.spec.ts`, `site/e2e/flows.spec.ts` |
| AC-W.10 | E | With `prefers-reduced-motion: reduce`, **Fix** applies the correction and the reply is repaired. | `site/e2e/flows.spec.ts` |
| AC-W.11 | E | The landing page has one h1, a hero link to `/app`, no `<canvas>` (no WebGL by decision), no third-party re... | `site/e2e/landing.spec.ts` |
| AC-W.12 | L | Lighthouse on `/` and `/app/` (mobile and desktop): Accessibility 100 and Best practices 100; LCP at most 2... | **Not automated.** Lighthouse and cold performance traces run through the chrome-devtools MCP by hand; the results are recorded in site/HANDOFF.md. |
<!-- matrix:end -->

## Known flaky or machine-sensitive tests

- Popup first paint (AC-10.1) is read from the quietest of six loads because other processes share the CPU.
- axe colour checks read the page at rest: the settings sheet and the guard card fade in, so those tests wait 500 to 600 ms before running axe. Reading mid-fade reports a contrast failure that is not there once the transition ends.
