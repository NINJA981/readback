# HANDOFF: Readback

**State:** release candidate 0.1.0 on branch `release/linkedin` (not merged, not pushed).
**Last updated:** 2026-11-04

Readback is "spellcheck that has read the thread you're replying to": a browser extension (WXT,
Chrome MV3, Firefox MV3 build) whose guards underline near-miss names, numbers and dates in a reply
by checking them against the message being answered, plus an ask pill. The product spec is
`SPEC.md`, the visual system `DESIGN.md`, the architecture `docs/adr/`, the tests `docs/TESTING.md`.

## What is built

| Area                           | State                                                                                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine (`src/engine`)          | Name, number and date guards, ask extraction, lexical "looks answered". Pure TypeScript, one dependency (chrono-node).                                                       |
| Adapters                       | Gmail (selector chains + self-test, built on synthetic fixtures) and generic "Use as Readback context" (any textarea or contenteditable).                                    |
| Overlay (`src/overlay`)        | Pill, guard card with the readback line, ledger, swap-back ghost, context chip, in one shadow root.                                                                          |
| Popup, options (`src/ui`)      | Every state designed and rendered in `gallery/`. The "looks answered" model panel says "Not included in this build".                                                         |
| Site (`site/`)                 | Landing page and `/app` web app (same engine), PWA, offline, CSP `connect-src 'none'`.                                                                                       |
| Launch assets (`docs/launch/`) | Store screenshots, social preview, demo GIF, phone shot, zips, `LAUNCH.md`. Regenerate with `node scripts/launch-assets.mjs` after `pnpm build` and `pnpm --dir site build`. |
| Packaging                      | README, CONTRIBUTING, CODE_OF_CONDUCT (Contributor Covenant 2.1), SECURITY, CHANGELOG, THIRD_PARTY_NOTICES, `.github` (CI, Pages, issue and PR templates).                   |

## How to run

```
pnpm install && pnpm --dir site install
pnpm lint && pnpm typecheck && pnpm --dir site typecheck
pnpm test                         # unit + corpus gates
pnpm build && node scripts/check-size.mjs
pnpm build:firefox
pnpm --dir site build             # also needed by e2e/parity.spec.ts
pnpm test:e2e                     # e2e build (open shadow root) in .output/chrome-mv3-e2e
pnpm --dir site test:e2e
pnpm zip && pnpm zip:firefox
node scripts/launch-assets.mjs    # docs/launch/ from the real builds (needs ffmpeg)
node scripts/screenshots.mjs [filter]   # docs/screenshots/ gallery and live captures
```

On this machine every heavy command runs through the studio RAM gate, vitest with
`--maxWorkers=1 --no-file-parallelism`, Playwright with one worker.

## Release pass (2026-11-04, branch release/linkedin)

- **Build defect:** `.gitignore` had `coverage/`, which also ignored `src/engine/coverage/`, so a
  fresh clone could not build the engine. Anchored to `/coverage/`; the three files are committed.
- **Code review fixes** (with tests in `tests/unit/content/binding.test.ts`,
  `tests/unit/content/controllers.test.ts`, `tests/unit/engine/false-positives.test.ts`,
  `tests/unit/adapters/generic.test.ts`, `tests/unit/dom/dom.test.ts` and six new corpus cases):
  - Status reports are sent only when they change (they were sent, and written to storage by the
    background, on every DOM mutation of an idle Gmail page).
  - The textarea mirror re-places itself on page scroll, window resize and field resize.
  - Name guard: a sentence-initial capital fires only in address position (`Kathyrn, thanks`);
    wider common-word list (Pay, Mine, Job, Wait...).
  - A flag on the word still being typed at the caret is held back until the word ends or typing
    pauses for 600 ms; input is coalesced to one check per frame.
  - IDs: no one-digit-substitution flags for short IDs or labels with real neighbours (room,
    flight, ticket...), and no comparison across different labels.
  - Dates written without a year take the closest year (a past "Tuesday, October 6" is no longer
    read as next year's).
  - One-click fix works over spans with no-break spaces; a fix from a click restores the caret.
  - Quoted lines and "On ... wrote:" blocks in the draft are not checked (generic adapter).
  - The first reply compose on the page is bound, even after a new-message compose.
  - Dead `embed` message removed; duplicated get-slips reply shared.
- **Docs:** README rewritten (accuracy with method, privacy, permissions, limitations); docs made
  self-contained; "near-zero false positives" and "enforced in CI" claims corrected; wording now
  matches the engine ("Signs as Kathryn").
- **UI:** ledger is 320 px (the card's width) and slip rows wrap instead of cutting the
  correction. Extension icons added (16/32/48/128). Landing has the real repository URL and the
  real-mail false-alarm rate next to the corpus number.
- **Hygiene:** QA-round screenshots removed from the tree; fixture page titles no longer name a
  real mail product; OFL notices for the bundled fonts.

## Verified

See "Results of the last run" at the bottom for the commands and numbers.

## Not verified, not done

- **Live Gmail.** All Gmail behaviour is verified only on synthetic, Gmail-shaped fixtures. Needs a
  human with a Gmail account: load the build, reply to a thread, check the squiggle, card, fix and
  undo, then capture sanitised fixtures.
- **Firefox.** Built, never run.
- **Context-menu click and key chords** are driven by sending the same messages the browser would.
- **AC-5.4** (frame-exact swap-back timeline) and **AC-7.3** (model timing; no model host) are not
  automated. **AC-W.12** (Lighthouse) was run by hand once, before the QA-round fixes.
- **Real phones and an installed PWA.**
- **Iframes:** "Use as Readback context" injects into the top frame only; a reply box inside an
  iframe is not reached.
- **English only:** names, greetings and dates assume English. In languages that capitalise nouns
  (German) the name guard can fire on ordinary nouns.
- **Only one compose is bound at a time** (the first reply or forward on the page).
- **Design re-score:** the independent design critic scored 8.3 of 10 before the QA-round-1 fixes;
  no second independent score was taken.
- **Store listings, hosting, trademark check of "Readback":** none done.

## Decisions for the owner

1. **History.** All commits on `main` are authored by a personal name and Gmail address and carry
   `Co-Authored-By` trailers. Rewriting history is your call; this branch did not touch it. Commits
   on `release/linkedin` are authored by NINJA981 with no trailers.
2. **Repository URL.** README, landing, CONTRIBUTING and the issue templates assume
   `https://github.com/NINJA981/readback`. Change them together if it differs.
3. **Hosting the web app.** `.github/workflows/pages.yml` publishes `site/dist` to GitHub Pages
   (Settings > Pages > Source: GitHub Actions). README links
   `https://ninja981.github.io/readback/app/`; it 404s until Pages is enabled. Then build the
   extension with `WXT_PLAYGROUND_URL=https://ninja981.github.io/readback/app/` so the popup links
   to it.
4. **Release.** Create tag `v0.1.0` and attach `docs/launch/readback-0.1.0-chrome.zip` and
   `readback-0.1.0-firefox.zip` (and the sources zip AMO asks for).
5. **Conduct and security contact.** Both route to GitHub private vulnerability reporting. Enable
   it (Settings > Code security) or add an email.
6. **Font subsets and Reserved Font Names.** Mona Sans and Hubot Sans carry RFNs under the OFL; the
   bundled files are subsets. Decide whether to rename the subset families or rely on the common
   reading that web subsetting is acceptable.
7. **Accuracy harness.** The real-mail evaluation scripts are not in this repository (they fetch
   public corpora). Publishing them would let others reproduce the numbers.

## Accuracy re-run on this release's engine

The real-mail evaluation (4,104 public reply pairs; harness outside this repo) was re-run on the
release engine and joined with the original hand labels; the one new squiggle was labelled by hand
(a false date: "Monday and Tuesday, June 18 and 19"). Results are in README "Accuracy". In short:
2.12 squiggles and 1.76 false alarms per 100 replies (was 2.41 and 1.97), precision unchanged at
12%, seeded recall lower (names 71 to 90%, dates 68 to 76%, IDs 95%) because quoted text in the
reply is no longer checked and sentence-initial edit-distance names need address position. One
real misspelling at a sentence start ("Virgina ...") is now missed. Revisit the sentence-start
rule with more labelled data.

## Results of the last run

2026-11-04, every command through the studio RAM gate (`_studio/bin/heavy.sh`), one worker:

| Command                                                       | Result                                                            |
| ------------------------------------------------------------- | ----------------------------------------------------------------- |
| `pnpm lint` (ESLint with the network ban, Prettier)           | clean                                                             |
| `pnpm typecheck`, `pnpm --dir site typecheck`                 | clean                                                             |
| `vitest run --maxWorkers=1 --no-file-parallelism`             | 25 files, 445 tests passed                                        |
| corpus gates (part of the above)                              | 0 flags on 53 deliberate cases, 34/34 slips, asks 1.0 / 1.0 on 64 |
| `pnpm --dir site exec vitest run`                             | 22 passed                                                         |
| `pnpm test:e2e` (extension, `--workers=1`)                    | 51 passed                                                         |
| `pnpm --dir site test:e2e` (desktop and phone)                | 101 passed                                                        |
| `pnpm zip`, `pnpm zip:firefox`, `node scripts/check-size.mjs` | built; gmail.js 144.8 KB gz of 150; zips in `docs/launch/`        |
| `gitleaks detect --no-banner`                                 | no leaks (all commits)                                            |
